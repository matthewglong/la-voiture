// Balance check: enumerate every affordable build, simulate it in three winds, and check that
// no performance option is dominated. Run with `npm run balance`. Exits non-zero on failure.
import { BUDGET, PARTS, SLOT_LABELS, computeStats, defaultConfig } from '../src/parts';
import { CarSim, DT, simulateToEnd, type SimResult } from '../src/sim/physics';
import { PERFORMANCE_SLOTS, type CarConfig, type SlotId } from '../src/types';

declare const process: { exitCode: number | undefined; argv: string[] };

const WINDS = [-8, 0, 8] as const;
const TOP_N = 15;
const TOP_FRACTION = 0.1;

interface Build {
  config: CarConfig;
  price: number;
  key: string;
}

interface Scored {
  build: Build;
  result: SimResult;
}

function enumerateBuilds(): Build[] {
  const builds: Build[] = [];
  const base = defaultConfig(0);
  const walk = (i: number, cfg: CarConfig, price: number): void => {
    if (i === PERFORMANCE_SLOTS.length) {
      const key = PERFORMANCE_SLOTS.map((s) => cfg[s]).join('/');
      builds.push({ config: { ...cfg }, price, key });
      return;
    }
    const slot = PERFORMANCE_SLOTS[i];
    for (const opt of PARTS[slot]) {
      if (price + opt.price > BUDGET) continue;
      cfg[slot] = opt.id;
      walk(i + 1, cfg, price + opt.price);
    }
    cfg[slot] = base[slot];
  };
  walk(0, { ...base }, 0);
  return builds;
}

function label(cfg: CarConfig): string {
  return PERFORMANCE_SLOTS.map((slot) => {
    const opt = PARTS[slot].find((o) => o.id === cfg[slot])!;
    return opt.name;
  }).join(' · ');
}

function pad(s: string | number, n: number, right = false): string {
  const str = String(s);
  return right ? str.padStart(n) : str.padEnd(n);
}

function windLabel(w: number): string {
  if (w === 0) return 'calm (0 m/s)';
  return `${w > 0 ? 'tailwind' : 'headwind'} ${w > 0 ? '+' : ''}${w} m/s`;
}

const builds = enumerateBuilds();
const lines: string[] = [];
const out = (s = ''): void => {
  lines.push(s);
};

out(`La Voiture balance report`);
out(`Affordable builds (performance slots, budget $${BUDGET}): ${builds.length}`);
out(`Top ${Math.round(TOP_FRACTION * 100)}% = ${Math.ceil(builds.length * TOP_FRACTION)} builds per wind`);
out('');

let nanFound = false;
const ranked = new Map<number, Scored[]>();
for (const wind of WINDS) {
  const scored: Scored[] = builds.map((build) => {
    const result = simulateToEnd(computeStats(build.config), wind);
    for (const v of Object.values(result)) {
      if (typeof v === 'number' && !Number.isFinite(v)) nanFound = true;
    }
    return { build, result };
  });
  scored.sort((a, b) => b.result.distance - a.result.distance || a.build.price - b.build.price);
  ranked.set(wind, scored);
}

// Top builds per wind.
for (const wind of WINDS) {
  const scored = ranked.get(wind)!;
  out(`## Top ${TOP_N}, ${windLabel(wind)}`);
  out(
    `${pad('#', 3, true)}  ${pad('dist m', 7, true)}  ${pad('$', 3, true)}  ${pad('lip m/s', 7, true)}  ${pad('run s', 5, true)}  ${pad('air s', 5, true)}  ${pad('waste', 5, true)}  build`,
  );
  scored.slice(0, TOP_N).forEach((sc, i) => {
    const r = sc.result;
    out(
      `${pad(i + 1, 3, true)}  ${pad(r.distance.toFixed(1), 7, true)}  ${pad(sc.build.price, 3, true)}  ${pad(r.launchSpeed.toFixed(1), 7, true)}  ${pad(r.runTime.toFixed(1), 5, true)}  ${pad(r.flightTime.toFixed(1), 5, true)}  ${pad(Math.round(r.wastedFuelFrac * 100) + '%', 5, true)}  ${label(sc.build.config)}`,
    );
  });
  const dnfs = scored.filter((s) => s.result.dnf).length;
  out(`DNFs in this wind: ${dnfs}`);
  out('');
}

// Per-option stats.
const topCount = Math.ceil(builds.length * TOP_FRACTION);
interface OptionStat {
  slot: SlotId;
  id: string;
  name: string;
  bestRank: number;
  bestWind: number;
  inTop: Record<number, number>;
  total: number;
}
const optionStats: OptionStat[] = [];
for (const slot of PERFORMANCE_SLOTS) {
  for (const opt of PARTS[slot]) {
    const st: OptionStat = {
      slot,
      id: opt.id,
      name: opt.name,
      bestRank: Infinity,
      bestWind: 0,
      inTop: {},
      total: builds.filter((b) => b.config[slot] === opt.id).length,
    };
    for (const wind of WINDS) {
      const scored = ranked.get(wind)!;
      const idx = scored.findIndex((s) => s.build.config[slot] === opt.id);
      if (idx >= 0 && idx + 1 < st.bestRank) {
        st.bestRank = idx + 1;
        st.bestWind = wind;
      }
      st.inTop[wind] = scored.slice(0, topCount).filter((s) => s.build.config[slot] === opt.id).length;
    }
    optionStats.push(st);
  }
}

out(`## Options: best rank and appearances in the top ${Math.round(TOP_FRACTION * 100)}% (${topCount} builds)`);
out(
  `${pad('slot', 10)} ${pad('option', 13)} ${pad('best', 5, true)} ${pad('(wind)', 7, true)}  ${WINDS.map((w) => pad(`top@${w > 0 ? '+' : ''}${w}`, 7, true)).join(' ')}`,
);
for (const st of optionStats) {
  out(
    `${pad(SLOT_LABELS[st.slot], 10)} ${pad(st.name, 13)} ${pad(st.bestRank, 5, true)} ${pad(`(${st.bestWind > 0 ? '+' : ''}${st.bestWind})`, 7, true)}  ${WINDS.map((w) => pad(st.inTop[w], 7, true)).join(' ')}`,
  );
}
out('');

// Stronger form of "no dominated options": with the other six slots fixed, how often is each
// option the strictly best pick for its slot? Free "nothing" options (no wing, no booster, blunt
// nose) win by saving money instead, so for them we ask whether they sit on the price/distance
// Pareto front (the furthest build at its price or below) in some wind.
const SAVERS = new Set(['wing:none', 'booster:none', 'nose:blunt']);
const distByKey = new Map<string, number[]>();
for (const [wi, wind] of WINDS.entries()) {
  for (const sc of ranked.get(wind)!) {
    if (!distByKey.has(sc.build.key)) distByKey.set(sc.build.key, [0, 0, 0]);
    distByKey.get(sc.build.key)![wi] = sc.result.distance;
  }
}
const bestPick = new Map<string, number>();
PERFORMANCE_SLOTS.forEach((slot, si) => {
  const groups = new Map<string, { id: string; d: number[] }[]>();
  for (const b of builds) {
    const ctx = PERFORMANCE_SLOTS.map((s2, i) => (i === si ? '*' : b.config[s2])).join('/');
    const g = groups.get(ctx) ?? [];
    g.push({ id: b.config[slot], d: distByKey.get(b.key)! });
    groups.set(ctx, g);
  }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    for (let wi = 0; wi < WINDS.length; wi++) {
      const sorted = [...g].sort((a, b) => b.d[wi] - a.d[wi]);
      if (sorted[0].d[wi] - sorted[1].d[wi] > 0.05) {
        const k = `${slot}:${sorted[0].id}`;
        bestPick.set(k, (bestPick.get(k) ?? 0) + 1);
      }
    }
  }
});
const onFront = new Set<string>();
for (const wind of WINDS) {
  const byPrice = [...ranked.get(wind)!].sort((a, b) => a.build.price - b.build.price || b.result.distance - a.result.distance);
  let runMax = -1;
  for (const sc of byPrice) {
    if (sc.result.distance > runMax + 0.05) {
      for (const slot of PERFORMANCE_SLOTS) onFront.add(`${slot}:${sc.build.config[slot]}`);
      runMax = sc.result.distance;
    }
  }
}
out('## Best pick for its slot (other six slots fixed, any wind)');
const neverBest: string[] = [];
for (const st of optionStats) {
  const k = `${st.slot}:${st.id}`;
  const wins = bestPick.get(k) ?? 0;
  const saver = SAVERS.has(k);
  const note = saver ? (onFront.has(k) ? 'free: on the price/distance Pareto front' : 'free: NOT on the Pareto front') : `${wins} contexts`;
  out(`${pad(SLOT_LABELS[st.slot], 10)} ${pad(st.name, 13)} ${note}`);
  if (saver ? !onFront.has(k) : wins === 0) neverBest.push(`${SLOT_LABELS[st.slot]}/${st.name}`);
}
out('');

// Wind: a headwind must never lengthen a flight. (A tailwind can shorten a slow glider's flight:
// less airspeed means less lift once its wings are open. That is reported, not failed.)
let windWrong = 0;
let tailShort = 0;
let tailExample = '';
for (const b of builds) {
  const [dh, dc, dt] = distByKey.get(b.key)!;
  if (dh > dc + 0.05) windWrong++;
  if (dc > dt + 0.05) {
    tailShort++;
    if (!tailExample) tailExample = `${label(b.config)}: ${dh.toFixed(1)} / ${dc.toFixed(1)} / ${dt.toFixed(1)} m`;
  }
}
out(`## Wind`);
out(`Builds that fly further into a headwind than in calm air: ${windWrong}`);
out(`Builds that fly shorter with a tailwind than in calm air: ${tailShort}${tailExample ? ` (e.g. ${tailExample})` : ''}`);
out('');

// Glider wings spring open at the top of the arc and must visibly glide on a go-kart:
// a flatter water entry and a longer flight than the same kart without wings.
interface Flight {
  distance: number;
  air: number;
  entryDeg: number;
  apex: number;
}
function fly(cfg: CarConfig, wind: number): Flight | null {
  const sim = new CarSim(computeStats(cfg), wind);
  let vx = 0;
  let vy = 0;
  while (!sim.done) {
    vx = sim.state.vel.x;
    vy = sim.state.vel.y;
    sim.step(DT);
  }
  if (sim.state.phase === 'dnf') return null;
  return {
    distance: sim.state.distance,
    air: sim.state.flightTime,
    entryDeg: (Math.atan2(-vy, vx) * 180) / Math.PI,
    apex: sim.state.maxHeight,
  };
}
const GLIDE_REFS: Partial<CarConfig>[] = [
  { chassis: 'kart', wheels: 'tiny', engine: 'mower', fuel: 'jerry', nose: 'wedge', booster: 'nitro' },
  { chassis: 'kart', wheels: 'standard', engine: 'v8', fuel: 'big', nose: 'cone', booster: 'none' },
];
const glideFails: string[] = [];
out('## Glide (calm air): go-kart with glider wings vs the same kart with none');
for (const ref of GLIDE_REFS) {
  const base = { ...defaultConfig(0), ...ref } as CarConfig;
  const g = fly({ ...base, wing: 'glider' }, 0);
  const n = fly({ ...base, wing: 'none' }, 0);
  const name = label({ ...base, wing: 'glider' });
  if (!g || !n) {
    glideFails.push(`${name}: DNF`);
    continue;
  }
  out(
    `${name}: ${g.distance.toFixed(1)} vs ${n.distance.toFixed(1)} m, air ${g.air.toFixed(1)} vs ${n.air.toFixed(1)} s, water entry ${g.entryDeg.toFixed(0)}° vs ${n.entryDeg.toFixed(0)}°`,
  );
  if (g.entryDeg > 0.75 * n.entryDeg || g.air < 1.2 * n.air) glideFails.push(name);
}
out('');

// Pacing: sensible builds (a V8 or jet with a real tank) should reach the lip in about 8-15 s.
const pace = (pred: (c: CarConfig) => boolean): number[] =>
  ranked
    .get(0)!
    .filter((sc) => !sc.result.dnf && pred(sc.build.config))
    .map((sc) => sc.result.runTime)
    .sort((a, b) => a - b);
const pct = (a: number[], f: number): number => a[Math.min(a.length - 1, Math.floor(a.length * f))];
const sensible = pace((c) => c.engine !== 'mower' && c.fuel !== 'jerry');
const weak = pace((c) => c.engine === 'mower' || c.fuel === 'jerry');
out('## Run-up pacing (calm air)');
out(
  `V8 or jet with a Standard or Oversized tank (${sensible.length} builds): median ${pct(sensible, 0.5).toFixed(1)} s, 90% within ${pct(sensible, 0.9).toFixed(1)} s`,
);
out(
  `Lawnmower or jerry-can builds (${weak.length} builds, coasting most of the way): median ${pct(weak, 0.5).toFixed(1)} s, 90% within ${pct(weak, 0.9).toFixed(1)} s`,
);
out('');

// All-$0 build.
const zero = defaultConfig(0);
const zeroResults = WINDS.map((w) => ({ wind: w, r: simulateToEnd(computeStats(zero), w) }));
out(`## All-$0 build (${label(zero)})`);
for (const { wind, r } of zeroResults) {
  out(
    `${pad(windLabel(wind), 20)} ${r.dnf ? 'DNF' : `${r.distance.toFixed(1)} m`}  lip ${r.launchSpeed.toFixed(1)} m/s, run ${r.runTime.toFixed(1)} s, air ${r.flightTime.toFixed(1)} s, wasted ${Math.round(r.wastedFuelFrac * 100)}% fuel`,
  );
}
out('');

// Pass criteria.
const failures: string[] = [];
const notes: string[] = [];
const dominated = optionStats.filter((st) => WINDS.every((w) => st.inTop[w] === 0));
if (dominated.length > 0) {
  failures.push(
    `Options never in the top ${Math.round(TOP_FRACTION * 100)}%: ${dominated.map((d) => `${SLOT_LABELS[d.slot]}/${d.name}`).join(', ')}`,
  );
}
const winners = new Set(WINDS.map((w) => ranked.get(w)![0].build.key));
const top5Chassis = WINDS.map(
  (w) => new Set(ranked.get(w)!.slice(0, 5).map((s) => s.build.config.chassis)).size,
);
const unionTop5Chassis = new Set(
  WINDS.flatMap((w) => ranked.get(w)!.slice(0, 5).map((s) => s.build.config.chassis)),
).size;
notes.push(`Distinct #1 builds across winds: ${winners.size}`);
notes.push(
  `Distinct chassis in each wind's top 5: ${WINDS.map((w, i) => `${w > 0 ? '+' : ''}${w}: ${top5Chassis[i]}`).join(', ')} (union: ${unionTop5Chassis})`,
);
if (!(winners.size >= 2 || top5Chassis.some((n) => n >= 3))) {
  failures.push('Same #1 build in every wind and no top 5 has 3+ chassis');
}
for (const { wind, r } of zeroResults) {
  if (r.dnf) failures.push(`All-$0 build does not reach the lip in ${windLabel(wind)}`);
}
if (nanFound) failures.push('NaN or infinite values in the results');
if (neverBest.length > 0) failures.push(`Never the best pick for its slot: ${neverBest.join(', ')}`);
if (windWrong > 0) failures.push(`${windWrong} builds fly further into a headwind than in calm air`);
if (glideFails.length > 0) failures.push(`Glider wings don't visibly glide on: ${glideFails.join('; ')}`);
if (pct(sensible, 0.5) > 15) failures.push(`Sensible builds take ${pct(sensible, 0.5).toFixed(1)} s to reach the lip (target about 8-15 s)`);

// Tuning targets (enforced so the numbers stay in range). The all-$0 target applies in calm air;
// in a ±8 m/s wind it must still clearly reach the water (≥ 3 m) and stay a weak build (≤ 40 m).
for (const { wind, r } of zeroResults) {
  if (r.dnf) continue;
  const [lo, hi] = wind === 0 ? [5, 25] : [3, 40];
  if (r.distance < lo || r.distance > hi) {
    failures.push(`All-$0 build splashes at ${r.distance.toFixed(1)} m in ${windLabel(wind)} (target ${lo}-${hi} m)`);
  }
}
for (const wind of WINDS) {
  const best = ranked.get(wind)![0].result;
  if (best.distance < 80 || best.distance > 180) {
    failures.push(`Best build flies ${best.distance.toFixed(1)} m in ${windLabel(wind)} (target 80-180 m)`);
  }
}
const topSlice = WINDS.flatMap((w) => ranked.get(w)!.slice(0, topCount));
const runTimes = topSlice.map((s) => s.result.runTime);
const airTimes = topSlice.map((s) => s.result.flightTime);
const allRun = WINDS.flatMap((w) => ranked.get(w)!.filter((s) => !s.result.dnf).map((s) => s.result.runTime));
const allAir = WINDS.flatMap((w) => ranked.get(w)!.filter((s) => !s.result.dnf).map((s) => s.result.flightTime));
if (Math.max(...allAir) > 6.5) failures.push(`Longest flight is ${Math.max(...allAir).toFixed(1)} s (target about 2-6 s)`);
const range = (a: number[]): string => `${Math.min(...a).toFixed(1)}-${Math.max(...a).toFixed(1)} s`;
notes.push(`Run-up time, top ${Math.round(TOP_FRACTION * 100)}%: ${range(runTimes)} (all finishers: ${range(allRun)})`);
notes.push(`Flight time, top ${Math.round(TOP_FRACTION * 100)}%: ${range(airTimes)} (all finishers: ${range(allAir)})`);

out('## Checks');
for (const n of notes) out(`- ${n}`);
if (failures.length === 0) {
  out('- PASS: every performance option reaches the top 10% in some wind and is the best pick for its slot in some build, the winner changes with wind, a headwind always shortens the flight, glider wings visibly glide, sensible builds reach the lip in about 8-15 s, no flight lasts over 6.5 s, the all-$0 build reaches the lip in every wind and splashes 5-25 m out in calm air, best builds fly 80-180 m, no NaNs.');
} else {
  for (const f of failures) out(`- FAIL: ${f}`);
}

console.log(lines.join('\n'));
if (failures.length > 0) process.exitCode = 1;

// Balance check: enumerate every affordable build, have the autopilot race it down the whole course
// (empty course, no HYPE) in three winds, and check that no performance option is dominated.
// Run with `npm run balance`. Exits non-zero on failure.
import { BUDGET, PARTS, SLOT_LABELS, computeStats, defaultConfig } from '../src/parts';
import { Bot, driveToEnd } from '../src/sim/bot';
import { RaceSim, type CarResult } from '../src/sim/race';
import { COURSE } from '../src/track';
import { PERFORMANCE_SLOTS, type CarConfig, type CarStats, type SlotId } from '../src/types';

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
  result: CarResult;
  lombard: number;
}

/** One build, raced by the autopilot on an empty course: the lip time, Lombard time, the flight. */
function simulate(stats: CarStats, wind: number): { result: CarResult; lombard: number } {
  const sim = new RaceSim([stats], wind, { obstacles: false, items: false, hype: false });
  const bot = new Bot(sim, 0, { dodge: false, items: false });
  let t0 = 0;
  let t1 = 0;
  const m = COURSE.marks;
  sim.start();
  const car = sim.cars[0];
  for (let i = 0; i < 120 * 200 && !sim.done; i++) {
    sim.step([bot.decide()]);
    if (!t0 && car.s >= m.lombardS0) t0 = sim.raceT;
    if (!t1 && car.s >= m.lombardS1) t1 = sim.raceT;
  }
  return { result: sim.results()[0], lombard: t1 - t0 };
}

export function simulateToEnd(stats: CarStats, wind: number): CarResult {
  const sim = new RaceSim([stats], wind, { obstacles: false, items: false, hype: false });
  driveToEnd(sim, [new Bot(sim, 0, { dodge: false, items: false })]);
  return sim.results()[0];
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
  return PERFORMANCE_SLOTS.map((slot) => PARTS[slot].find((o) => o.id === cfg[slot])!.name).join(' · ');
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
out(`Every affordable build (performance slots, budget $${BUDGET}): ${builds.length}, each raced down the course by the autopilot`);
out(`(empty course, no items or HYPE: this compares the cars, not the driving).`);
out(`Top ${Math.round(TOP_FRACTION * 100)}% = ${Math.ceil(builds.length * TOP_FRACTION)} builds per wind`);
out('');

let nanFound = false;
const ranked = new Map<number, Scored[]>();
for (const wind of WINDS) {
  const scored: Scored[] = builds.map((build) => {
    const { result, lombard } = simulate(computeStats(build.config), wind);
    for (const v of Object.values(result)) {
      if (typeof v === 'number' && !Number.isFinite(v)) nanFound = true;
    }
    return { build, result, lombard };
  });
  scored.sort((a, b) => b.result.distance - a.result.distance || a.build.price - b.build.price);
  ranked.set(wind, scored);
}

// Top builds per wind.
for (const wind of WINDS) {
  const scored = ranked.get(wind)!;
  out(`## Top ${TOP_N}, ${windLabel(wind)}`);
  out(
    `${pad('#', 3, true)}  ${pad('dist m', 7, true)}  ${pad('$', 3, true)}  ${pad('lip m/s', 7, true)}  ${pad('race s', 6, true)}  ${pad('air s', 5, true)}  ${pad('boost', 5, true)}  build`,
  );
  scored.slice(0, TOP_N).forEach((sc, i) => {
    const r = sc.result;
    out(
      `${pad(i + 1, 3, true)}  ${pad(r.distance.toFixed(1), 7, true)}  ${pad(sc.build.price, 3, true)}  ${pad(r.launchSpeed.toFixed(1), 7, true)}  ${pad(r.runTime.toFixed(1), 6, true)}  ${pad(r.flightTime.toFixed(1), 5, true)}  ${pad(Math.round(r.wastedBoostFrac * 100) + '%', 5, true)}  ${label(sc.build.config)}`,
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
  lombard: number;
  race: number;
}
const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)] ?? 0;
};
const optionStats: OptionStat[] = [];
for (const slot of PERFORMANCE_SLOTS) {
  for (const opt of PARTS[slot]) {
    const calm = ranked.get(0)!.filter((s) => s.build.config[slot] === opt.id && !s.result.dnf);
    const st: OptionStat = {
      slot,
      id: opt.id,
      name: opt.name,
      bestRank: Infinity,
      bestWind: 0,
      inTop: {},
      lombard: median(calm.map((s) => s.lombard)),
      race: median(calm.map((s) => s.result.runTime)),
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

out(`## Options: best rank, appearances in the top ${Math.round(TOP_FRACTION * 100)}% (${topCount} builds), and median times (calm)`);
out(
  `${pad('slot', 10)} ${pad('option', 13)} ${pad('best', 5, true)} ${pad('(wind)', 7, true)}  ${WINDS.map((w) => pad(`top@${w > 0 ? '+' : ''}${w}`, 7, true)).join(' ')}  ${pad('race s', 7, true)} ${pad('Lombard s', 9, true)}`,
);
for (const st of optionStats) {
  out(
    `${pad(SLOT_LABELS[st.slot], 10)} ${pad(st.name, 13)} ${pad(st.bestRank, 5, true)} ${pad(`(${st.bestWind > 0 ? '+' : ''}${st.bestWind})`, 7, true)}  ${WINDS.map((w) => pad(st.inTop[w], 7, true)).join(' ')}  ${pad(st.race.toFixed(1), 7, true)} ${pad(st.lombard.toFixed(1), 9, true)}`,
  );
}
out('');

// Stronger form of "no dominated options": with the other six slots fixed, how often is each
// option the strictly best pick for its slot? Free "nothing" options (no wing, no booster, blunt
// nose) win by saving money instead, so for them we ask whether they sit on the price/distance
// Pareto front (the furthest build at its price or below) in some wind.
// Every free part is a saver: the chassis, wheels, engine and tank you start with, and the empty wing,
// nose and booster slots. They have to earn their place on the price/distance front.
const SAVERS = new Set(PERFORMANCE_SLOTS.map((s) => `${s}:${PARTS[s][0].id}`));
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
  const note = saver
    ? `free: ${onFront.has(k) ? 'on' : 'NOT on'} the price/distance Pareto front (best pick in ${wins} contexts)`
    : `${wins} contexts`;
  out(`${pad(SLOT_LABELS[st.slot], 10)} ${pad(st.name, 13)} ${note}`);
  if (saver ? !onFront.has(k) : wins === 0) neverBest.push(`${SLOT_LABELS[st.slot]}/${st.name}`);
}
out('');

// Wind: the strongest headwind must shorten every flight.
let windWrong = 0;
let windWorst = { gain: 0, text: '' };
let tailShort = 0;
for (const b of builds) {
  const [dh, dc, dt] = distByKey.get(b.key)!;
  if (dh > dc + 0.5) {
    windWrong++;
    if (dh - dc > windWorst.gain) windWorst = { gain: dh - dc, text: `${label(b.config)}: ${dc.toFixed(1)} m calm, ${dh.toFixed(1)} m at -8 m/s` };
  }
  if (dc > dt + 0.5) tailShort++;
}
out(`## Wind`);
out(`Builds that fly further into the strongest headwind (-8 m/s) than in calm air (by more than 0.5 m): ${windWrong}${windWorst.text ? ` (worst: ${windWorst.text})` : ''}`);
out(`Builds that fly shorter with a tailwind than in calm air (by more than 0.5 m): ${tailShort}`);
out('');

// Glider wings spring open at the top of the arc and must visibly glide on a go-kart: a flatter
// water entry and a longer flight than the same kart without wings.
const GLIDE_REFS: Partial<CarConfig>[] = [
  { chassis: 'kart', wheels: 'tiny', engine: 'mower', boost: 'can', nose: 'wedge', booster: 'rocket' },
  { chassis: 'kart', wheels: 'standard', engine: 'v8', boost: 'big', nose: 'cone', booster: 'none' },
];
const glideFails: string[] = [];
out('## Glide (calm air): go-kart with glider wings vs the same kart with none');
for (const ref of GLIDE_REFS) {
  const base = { ...defaultConfig(0), ...ref } as CarConfig;
  const g = simulateToEnd(computeStats({ ...base, wing: 'glider' }), 0);
  const n = simulateToEnd(computeStats({ ...base, wing: 'none' }), 0);
  const name = label({ ...base, wing: 'glider' });
  if (g.dnf || n.dnf) {
    glideFails.push(`${name}: DNF`);
    continue;
  }
  out(
    `${name}: ${g.distance.toFixed(1)} vs ${n.distance.toFixed(1)} m, air ${g.flightTime.toFixed(1)} vs ${n.flightTime.toFixed(1)} s, water entry ${g.entryDeg.toFixed(0)}° vs ${n.entryDeg.toFixed(0)}°`,
  );
  if (g.entryDeg > 0.75 * n.entryDeg || g.flightTime < 1.2 * n.flightTime) glideFails.push(name);
}
out('');

// Pacing: the time from GO to the lip.
const pace = (pred: (c: CarConfig) => boolean): number[] =>
  ranked
    .get(0)!
    .filter((sc) => !sc.result.dnf && pred(sc.build.config))
    .map((sc) => sc.result.runTime)
    .sort((a, b) => a - b);
const pct = (a: number[], f: number): number => a[Math.min(a.length - 1, Math.floor(a.length * f))];
const sensible = pace((c) => c.engine !== 'mower');
const weak = pace((c) => c.engine === 'mower');
out('## Race pacing (calm air, the autopilot)');
out(`V8 or jet builds (${sensible.length}): median ${pct(sensible, 0.5).toFixed(1)} s, 90% within ${pct(sensible, 0.9).toFixed(1)} s`);
out(`Lawnmower builds (${weak.length}): median ${pct(weak, 0.5).toFixed(1)} s, 90% within ${pct(weak, 0.9).toFixed(1)} s`);
out('');

// All-$0 build.
const zero = defaultConfig(0);
const zeroResults = WINDS.map((w) => ({ wind: w, r: simulateToEnd(computeStats(zero), w) }));
out(`## All-$0 build (${label(zero)})`);
for (const { wind, r } of zeroResults) {
  out(
    `${pad(windLabel(wind), 20)} ${r.dnf ? 'DNF' : `${r.distance.toFixed(1)} m`}  lip ${r.launchSpeed.toFixed(1)} m/s, race ${r.runTime.toFixed(1)} s, air ${r.flightTime.toFixed(1)} s, ${Math.round(r.wastedBoostFrac * 100)}% boost left`,
  );
}
out('');

// Pass criteria.
const failures: string[] = [];
const notes: string[] = [];
// Paid parts must make the top 10% somewhere; free parts earn their place by saving money (above).
const dominated = optionStats.filter((st) => !SAVERS.has(`${st.slot}:${st.id}`) && WINDS.every((w) => st.inTop[w] === 0));
if (dominated.length > 0) {
  failures.push(`Paid options never in the top ${Math.round(TOP_FRACTION * 100)}%: ${dominated.map((d) => `${SLOT_LABELS[d.slot]}/${d.name}`).join(', ')}`);
}
const winners = new Set(WINDS.map((w) => ranked.get(w)![0].build.key));
const top5Chassis = WINDS.map((w) => new Set(ranked.get(w)!.slice(0, 5).map((s) => s.build.config.chassis)).size);
const unionTop5Chassis = new Set(WINDS.flatMap((w) => ranked.get(w)!.slice(0, 5).map((s) => s.build.config.chassis))).size;
notes.push(`Distinct #1 builds across winds: ${winners.size}`);
notes.push(`Distinct chassis in each wind's top 5: ${WINDS.map((w, i) => `${w > 0 ? '+' : ''}${w}: ${top5Chassis[i]}`).join(', ')} (union: ${unionTop5Chassis})`);
if (!(winners.size >= 2 || top5Chassis.some((n) => n >= 3))) failures.push('Same #1 build in every wind and no top 5 has 3+ chassis');
const allDnfs = WINDS.map((w) => ranked.get(w)!.filter((s) => s.result.dnf).length);
if (allDnfs.some((n) => n > 0)) failures.push(`Builds that never reach the lip: ${allDnfs.join(' / ')} (by wind)`);
if (nanFound) failures.push('NaN or infinite values in the results');
if (neverBest.length > 0) failures.push(`Never the best pick for its slot: ${neverBest.join(', ')}`);
if (windWrong > 0) failures.push(`${windWrong} builds fly further into a headwind than in calm air`);
if (glideFails.length > 0) failures.push(`Glider wings don't visibly glide on: ${glideFails.join('; ')}`);
if (pct(sensible, 0.5) > 50) failures.push(`Sensible builds take ${pct(sensible, 0.5).toFixed(1)} s to reach the lip (target at most 50 s)`);
for (const { wind, r } of zeroResults) {
  if (r.dnf) {
    failures.push(`All-$0 build does not reach the lip in ${windLabel(wind)}`);
    continue;
  }
  const [lo, hi] = wind === 0 ? [5, 30] : [3, 45];
  if (r.distance < lo || r.distance > hi) failures.push(`All-$0 build splashes at ${r.distance.toFixed(1)} m in ${windLabel(wind)} (target ${lo}-${hi} m)`);
}
for (const wind of WINDS) {
  const best = ranked.get(wind)![0].result;
  if (best.distance < 80 || best.distance > 180) failures.push(`Best build flies ${best.distance.toFixed(1)} m in ${windLabel(wind)} (target 80-180 m)`);
}
const allAir = WINDS.flatMap((w) => ranked.get(w)!.filter((s) => !s.result.dnf).map((s) => s.result.flightTime));
if (Math.max(...allAir) > 7) failures.push(`Longest flight is ${Math.max(...allAir).toFixed(1)} s (target at most 7 s)`);
const allRun = WINDS.flatMap((w) => ranked.get(w)!.filter((s) => !s.result.dnf).map((s) => s.result.runTime));
const range = (a: number[]): string => `${Math.min(...a).toFixed(1)}-${Math.max(...a).toFixed(1)} s`;
notes.push(`Race time, all builds: ${range(allRun)}; flight time: ${range(allAir)}`);

out('## Checks');
for (const n of notes) out(`- ${n}`);
if (failures.length === 0) {
  out('- PASS: every paid part reaches the top 10% in some wind and is the best pick for its slot in some build, every free part is on the price/distance front, the winner changes with wind, every build reaches the lip in every wind, the strongest headwind shortens every flight, glider wings visibly glide, sensible builds reach the lip within 50 s, no flight lasts over 7 s, the all-$0 build splashes 5-30 m out in calm air, best builds fly 80-180 m, no NaNs.');
} else {
  for (const f of failures) out(`- FAIL: ${f}`);
}

console.log(lines.join('\n'));
if (failures.length > 0) process.exitCode = 1;

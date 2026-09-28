// Race-mode balance report: every affordable build, one lap of each loop map from a standing start
// with the autopilot (empty course, no items or HYPE), in three winds. The parts were designed and
// balanced for the long jump (see balance.ts, which enforces it); this reports how they come out
// racing laps, so race mode can be tuned against numbers. It checks nothing (only that every
// build gets round and nothing is NaN): what "balanced" means for racing is still to be decided.
// Run with `npm run balance:race`.
import { MAPS, type MapDef } from '../src/maps';
import { BUDGET, PARTS, SLOT_LABELS, computeStats, defaultConfig } from '../src/parts';
import { Bot } from '../src/sim/bot';
import { RaceSim, type CarResult } from '../src/sim/race';
import { PERFORMANCE_SLOTS, type CarConfig } from '../src/types';
import { enumerateBuilds, label, pad, type Build } from './builds';

declare const process: { exitCode: number | undefined; argv: string[] };

const WINDS = [-8, 0, 8] as const;
const TOP_N = 15;
const TOP_FRACTION = 0.1;

interface Lapped {
  build: Build;
  result: CarResult;
  /** One lap from a standing start (Infinity if it never got round). */
  lap: number;
}

/** One build, one lap: the autopilot on an empty loop. */
function lapTime(map: MapDef, config: CarConfig, wind: number): Lapped['result'] {
  const sim = new RaceSim([computeStats(config)], wind, { obstacles: false, items: false, hype: false, laps: 1 }, map);
  const bot = new Bot(sim, 0, { dodge: false, items: false });
  sim.start();
  for (let i = 0; i < 120 * 400 && !sim.done; i++) sim.step([bot.decide()]);
  return sim.results()[0];
}

const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)] ?? NaN;
};
const pct = (a: number[], f: number): number => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * f))];
};
const windLabel = (w: number): string => (w === 0 ? 'calm' : `${w > 0 ? 'tailwind +' : 'headwind '}${w} m/s`);

const lines: string[] = [];
const out = (s = ''): void => {
  lines.push(s);
};
let nan = false;
let stuck = 0;

const builds = enumerateBuilds();
for (const map of MAPS.filter((m) => m.mode === 'race')) {
  out(`# ${map.name}: one lap (${map.course.length.toFixed(0)} m) from a standing start`);
  out(`Every affordable build (budget $${BUDGET}): ${builds.length}, driven by the autopilot on an empty loop.`);
  out('');
  const ranked = new Map<number, Lapped[]>();
  for (const wind of WINDS) {
    const scored = builds.map((build) => {
      const result = lapTime(map, build.config, wind);
      for (const v of Object.values(result)) if (typeof v === 'number' && Number.isNaN(v)) nan = true;
      if (!result.finished) stuck++;
      return { build, result, lap: result.finished ? result.runTime : Infinity };
    });
    scored.sort((a, b) => a.lap - b.lap || a.build.price - b.build.price);
    ranked.set(wind, scored);
  }

  for (const wind of WINDS) {
    const scored = ranked.get(wind)!;
    out(`## Quickest ${TOP_N}, ${windLabel(wind)}`);
    out(`${pad('#', 3, true)}  ${pad('lap s', 6, true)}  ${pad('$', 3, true)}  build`);
    scored.slice(0, TOP_N).forEach((sc, i) => out(`${pad(i + 1, 3, true)}  ${pad(sc.lap.toFixed(1), 6, true)}  ${pad(sc.build.price, 3, true)}  ${label(sc.build.config)}`));
    out('');
  }

  // Per option: best rank, top-10% appearances, median lap in calm air.
  const topCount = Math.ceil(builds.length * TOP_FRACTION);
  out(`## Options: best rank, appearances in the quickest ${Math.round(TOP_FRACTION * 100)}% (${topCount} builds), median lap (calm)`);
  out(`${pad('slot', 10)} ${pad('option', 13)} ${pad('best', 5, true)}  ${WINDS.map((w) => pad(`top@${w > 0 ? '+' : ''}${w}`, 7, true)).join(' ')}  ${pad('lap s', 6, true)}`);
  const unused: string[] = [];
  for (const slot of PERFORMANCE_SLOTS) {
    for (const opt of PARTS[slot]) {
      let best = Infinity;
      const tops = WINDS.map((w) => {
        const scored = ranked.get(w)!;
        const idx = scored.findIndex((s) => s.build.config[slot] === opt.id);
        if (idx >= 0) best = Math.min(best, idx + 1);
        return scored.slice(0, topCount).filter((s) => s.build.config[slot] === opt.id).length;
      });
      const calm = ranked.get(0)!.filter((s) => s.build.config[slot] === opt.id && Number.isFinite(s.lap));
      out(`${pad(SLOT_LABELS[slot], 10)} ${pad(opt.name, 13)} ${pad(best, 5, true)}  ${tops.map((n) => pad(n, 7, true)).join(' ')}  ${pad(median(calm.map((s) => s.lap)).toFixed(1), 6, true)}`);
      if (opt.price > 0 && tops.every((n) => n === 0)) unused.push(`${SLOT_LABELS[slot]}/${opt.name}`);
    }
  }
  out('');

  // With the other six slots fixed, how often is each option the strictly quickest pick?
  const lapByKey = new Map<string, number[]>();
  WINDS.forEach((w, wi) => {
    for (const sc of ranked.get(w)!) {
      if (!lapByKey.has(sc.build.key)) lapByKey.set(sc.build.key, [0, 0, 0]);
      lapByKey.get(sc.build.key)![wi] = sc.lap;
    }
  });
  const bestPick = new Map<string, number>();
  PERFORMANCE_SLOTS.forEach((slot, si) => {
    const groups = new Map<string, { id: string; t: number[] }[]>();
    for (const b of builds) {
      const ctx = PERFORMANCE_SLOTS.map((s2, i) => (i === si ? '*' : b.config[s2])).join('/');
      const g = groups.get(ctx) ?? [];
      g.push({ id: b.config[slot], t: lapByKey.get(b.key)! });
      groups.set(ctx, g);
    }
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      for (let wi = 0; wi < WINDS.length; wi++) {
        const sorted = [...g].sort((a, b) => a.t[wi] - b.t[wi]);
        if (sorted[1].t[wi] - sorted[0].t[wi] > 0.05) {
          const k = `${slot}:${sorted[0].id}`;
          bestPick.set(k, (bestPick.get(k) ?? 0) + 1);
        }
      }
    }
  });
  out('## Quickest pick for its slot (other six slots fixed, any wind): how many contexts');
  const neverBest: string[] = [];
  for (const slot of PERFORMANCE_SLOTS) {
    for (const opt of PARTS[slot]) {
      const n = bestPick.get(`${slot}:${opt.id}`) ?? 0;
      out(`${pad(SLOT_LABELS[slot], 10)} ${pad(opt.name, 13)} ${n}`);
      if (n === 0) neverBest.push(`${SLOT_LABELS[slot]}/${opt.name}`);
    }
  }
  out('');

  // Pacing.
  const calm = ranked.get(0)!.filter((s) => Number.isFinite(s.lap));
  const paceOf = (pred: (c: CarConfig) => boolean): number[] => calm.filter((s) => pred(s.build.config)).map((s) => s.lap);
  const quick = paceOf((c) => c.engine !== 'mower');
  const mower = paceOf((c) => c.engine === 'mower');
  const zero = lapTime(map, defaultConfig(0), 0);
  out('## Pacing (calm, the autopilot, one lap from a standing start)');
  out(`V8 or jet builds (${quick.length}): median ${median(quick).toFixed(1)} s, 90% within ${pct(quick, 0.9).toFixed(1)} s`);
  out(`Lawnmower builds (${mower.length}): median ${median(mower).toFixed(1)} s, 90% within ${pct(mower, 0.9).toFixed(1)} s`);
  out(`All-$0 build (${label(defaultConfig(0))}): ${zero.finished ? `${zero.runTime.toFixed(1)} s` : 'never got round'}`);
  out(`So ${map.laps} laps take about ${(median(quick) * map.laps * 0.97).toFixed(0)} s for a V8 or jet build (flying laps are a touch quicker), and ${(median(mower) * map.laps).toFixed(0)} s on a lawnmower.`);
  out('');

  out('## Notes');
  out(`- Paid parts never in the quickest ${Math.round(TOP_FRACTION * 100)}% in any wind: ${unused.length ? unused.join(', ') : 'none'}`);
  out(`- Never the quickest pick for their slot: ${neverBest.length ? neverBest.join(', ') : 'none'}`);
  out(`- The long jump's rules (see npm run balance) would call those dominated. Racing laps is a different`);
  out(`  event: flight parts (wings' lift, the kite, the launch rocket) do nothing on the road, and the hills`);
  out(`  reward power. Race mode needs its own targets before it can pass or fail.`);
  out('');
}

out('## Checks');
if (nan || stuck > 0) {
  if (nan) out('- FAIL: NaN values in the results');
  if (stuck > 0) out(`- FAIL: ${stuck} build-and-wind runs never got round the lap`);
  process.exitCode = 1;
} else out('- PASS: every build gets round every loop in every wind, no NaNs.');
console.log(lines.join('\n'));

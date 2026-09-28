// Smoke test for every map and mode: two CPU cars race each other (traffic, items and HYPE on) on
// every map in MAPS, plus test courses built only from the shared builders (a point-to-point spline
// ending in a kicker that points another way, raced as a long jump and as a race; and one ending at
// a finish line). It checks what must hold whatever the map or the tuning: no NaNs, every run ends,
// the results agree with the mode's rules, jumps are measured along the lip, cars that finish point
// to point stop before the road runs out, and the same seed gives the same race.
// Run with `npm run smoke` after any change to the physics, the modes or a map. Exits non-zero on
// failure.
import { MAPS, defineMap, type MapDef, type Venue } from '../src/maps';
import { computeStats } from '../src/parts';
import { Bot } from '../src/sim/bot';
import { makeRng } from '../src/sim/physics';
import { RaceSim, type CarInput, type RaceEvent } from '../src/sim/race';
import { buildSpline, pointAt, type SplineSection } from '../src/track';
import { enumerateBuilds } from './builds';

declare const process: { exitCode: number | undefined };

// ---------------------------------------------------------------------------------------------
// Test courses: nothing but the shared builders and a MapDef.

const edges = (kind: string, name: string, from: number, hw = 7): SplineSection => ({ from, kind, name, hw, edgeL: 'barrier', edgeR: 'barrier' });

/** Down a hill heading -z, a bend, then a pier and a kicker pointing -z into water at y = 1. */
const DROP = buildSpline({
  id: 'test-drop',
  loop: false,
  nodes: [
    { x: 0, z: 0, y: 30 },
    { x: 0, z: -40, y: 29 },
    { x: 10, z: -140, y: 18, round: 0 },
    { x: 60, z: -220, y: 9 },
    { x: 60, z: -300, y: 5 },
    { x: 60, z: -340, y: 5 },
    { x: 60, z: -351, y: 10 },
  ],
  sections: [edges('start', 'Top', 0), edges('block', 'Hill', 1), edges('corner', 'Bend', 2), edges('pier', 'Pier', 4), edges('kicker', 'Kicker', 5)],
  startS: 20,
  kicker: { fromNode: 5, angle: (22 * Math.PI) / 180, runupNode: 4, runupName: 'the pier', finalNode: 3, waterY: 1 },
});

/** Point to point with a finish line (no kicker): the cars must stop in the run-off. */
const LINE = buildSpline({
  id: 'test-line',
  loop: false,
  nodes: [
    { x: 0, z: 0, y: 0 },
    { x: 120, z: 10, y: -4 },
    { x: 220, z: 80, y: -10, round: 0 },
    { x: 300, z: 90, y: -12 },
    { x: 420, z: 90, y: -12 },
  ],
  sections: [edges('start', 'Straight', 0), edges('corner', 'Turn', 1), edges('straight', 'Run-off', 3)],
  startS: 20,
  runoff: 70,
});

const venue = (id: string, course: typeof DROP): Venue => ({
  id,
  name: id,
  course,
  boxes: [{ s: course.startS + 60, ds: [-3, 0, 3] }],
  populate(sim, r) {
    sim.addTraffic(course.startS + 90 + r() * 20, 3.4, 4, course.length * 0.7);
    sim.addStalled(course.startS + 150, -3, Math.PI);
  },
  strip: [],
  splits: [],
  starts: [{ id: 'top', name: 'Top', what: 'all of it', s: null }],
  hints: {},
});

const TEST_MAPS: MapDef[] = [
  defineMap(venue('test-drop', DROP), { id: 'test-drop-jump', mode: 'jump', blurb: '' }),
  defineMap(venue('test-drop', DROP), { id: 'test-drop-race', mode: 'race', blurb: '' }),
  defineMap(venue('test-line', LINE), { id: 'test-line-race', mode: 'race', blurb: '' }),
];

// ---------------------------------------------------------------------------------------------

const failures: string[] = [];
const fail = (msg: string): void => {
  failures.push(msg);
};
const builds = enumerateBuilds();

/** One two-car race with the CPU at both wheels; returns a fingerprint of how it went. */
function race(map: MapDef, seed: number): string {
  const r = makeRng(seed * 131 + 3);
  const a = builds[Math.floor(r() * builds.length)].config;
  const b = builds[Math.floor(r() * builds.length)].config;
  const wind = Math.round((r() * 16 - 8) * 10) / 10;
  const sim = new RaceSim([computeStats(a), computeStats(b)], wind, { seed }, map);
  const bots = [new Bot(sim, 0, { drift: true, aggression: 0.4 }), new Bot(sim, 1, { drift: seed % 2 === 0, skill: 0.95 })];
  const tag = `${map.id} seed ${seed}`;
  const events: RaceEvent[] = [...sim.start()];
  const cap = 120 * (sim.maxTime + 90);
  let i = 0;
  for (; i < cap && !sim.done; i++) {
    const inputs: CarInput[] = bots.map((bt) => bt.decide());
    events.push(...sim.step(inputs));
    for (const c of sim.cars) {
      if (![c.x, c.y, c.z, c.vx, c.vy, c.vz, c.s].every(Number.isFinite)) {
        fail(`${tag}: NaN on car ${c.p} at step ${i}`);
        return 'nan';
      }
    }
  }
  if (!sim.done) fail(`${tag}: never ended (${i} steps)`);
  // Cars past the flag point to point cruise to a stop before the road runs out.
  if (!map.course.loop && !map.course.lip) {
    for (let k = 0; k < 120 * 30; k++) sim.step([]);
    for (const c of sim.cars) {
      if (c.phase !== 'finished') continue;
      if (Math.hypot(c.vx, c.vz) > 0.5) fail(`${tag}: car ${c.p} still rolling ${Math.hypot(c.vx, c.vz).toFixed(1)} m/s after the flag`);
      if (c.s > map.course.length - 1) fail(`${tag}: car ${c.p} ran off the end of the road (s ${c.s.toFixed(1)} of ${map.course.length.toFixed(1)})`);
    }
  }
  const res = sim.results();
  const time = map.rules.score === 'time';
  res.forEach((q, p) => {
    for (const [k, v] of Object.entries(q)) if (typeof v === 'number' && Number.isNaN(v)) fail(`${tag}: NaN in results.${k}`);
    if (time) {
      if (q.finished && q.laps !== sim.laps) fail(`${tag}: car ${p} finished with ${q.laps} of ${sim.laps} laps`);
      if (q.finished && q.dnf) fail(`${tag}: car ${p} both finished and out`);
    } else if (!q.dnf && map.course.lip && q.distance <= 0) fail(`${tag}: car ${p} launched but scored ${q.distance}`);
  });
  // Placing: quicker home is ahead in a race; further is ahead in the long jump.
  const home = res.map((q, p) => ({ q, p })).filter(({ q }) => (time ? q.finished : !q.dnf));
  if (time && home.length === 2 && (home[0].q.runTime < home[1].q.runTime) !== (home[0].q.place < home[1].q.place)) {
    fail(`${tag}: places ${home[0].q.place}/${home[1].q.place} don't follow the times ${home[0].q.runTime.toFixed(2)}/${home[1].q.runTime.toFixed(2)}`);
  }
  // Every splash is measured along the lip: its distance is how far out it landed, and it landed
  // in line with the kicker.
  const lip = map.course.lip;
  for (const e of events) {
    if (e.type !== 'splash' || !lip || e.speed === 0) continue;
    const along = (e.x - lip.x) * lip.tx + (e.z - lip.z) * lip.tz;
    const across = -(e.x - lip.x) * lip.tz + (e.z - lip.z) * lip.tx;
    if (Math.abs(along - e.distance) > 1e-6 && along > 0) fail(`${tag}: splash distance ${e.distance.toFixed(2)} is not ${along.toFixed(2)} out along the lip`);
    if (Math.abs(across) > 25) fail(`${tag}: splash ${across.toFixed(1)} m off the kicker's line`);
  }
  // The kicker drops only in modes where it does.
  if (!map.rules.kickerDrops && sim.rampDropAt !== null) fail(`${tag}: the kicker dropped in ${map.mode}`);
  return JSON.stringify(res.map((q) => [q.dnf, q.finished, q.place, q.runTime.toFixed(4), q.distance.toFixed(4), q.laps]));
}

const SEEDS = [1, 2, 3, 4];
const t0 = Date.now();
for (const map of [...MAPS, ...TEST_MAPS]) {
  const lines: string[] = [];
  for (const seed of SEEDS) lines.push(race(map, seed));
  // Deterministic: the same seed races the same race.
  if (race(map, SEEDS[0]) !== lines[0]) fail(`${map.id}: the same seed gave a different race`);
  const c = map.course;
  const end = c.loop ? `${map.laps} laps of ${c.length.toFixed(0)} m` : c.lip ? `${c.length.toFixed(0)} m to a lip facing ${((c.lip.heading * 180) / Math.PI).toFixed(0)}°` : `a finish line at ${c.finishS?.toFixed(0)} m`;
  console.log(`${map.id.padEnd(18)} ${map.mode.padEnd(5)} ${end}: ${SEEDS.length} races`);
}
// The test drop's lip faces -z: its distances must not be measured along x.
if (Math.abs(pointAt(DROP, DROP.length).heading + Math.PI / 2) > 0.05) fail(`test-drop: the lip should face -z, faces ${pointAt(DROP, DROP.length).heading.toFixed(3)} rad`);

console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (failures.length) {
  console.log(`FAIL (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else console.log('PASS: every map and mode races to the end with no NaNs; results follow the rules; deterministic.');

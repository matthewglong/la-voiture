// Twin Peaks: the lap race. A loop over the shoulder of Twin Peaks under Sutro Tower: the start
// straight along the bottom of the valley, a climb up the switchbacks with a crest at the top, the
// summit hairpin, then a long, fast run back down with two crests that throw the quick cars into
// the air, and a chicane onto the straight. No Three.js or DOM imports.
import type { RaceSim } from '../sim/race';
import { buildLoop, pointAt, type Course, type LoopNode, type LoopSection } from '../track';

/** Road half-width (m). */
export const TP_HW = 6.5;

/**
 * The loop, anticlockwise seen from above (+x east, +z south): heading +x along the start straight,
 * right onto the climb, and round. Heights in metres above the valley floor.
 */
const NODES: LoopNode[] = [
  // 0: the start/finish straight.
  { x: -40, z: 0, y: 0 },
  { x: 60, z: 0, y: 0.5 },
  // 2-3: Turn 1, a fast right, and the foot of the climb.
  { x: 118, z: 14, y: 2 },
  { x: 146, z: 58, y: 5.5 },
  // 4-6: up the switchbacks.
  { x: 138, z: 112, y: 11 },
  { x: 168, z: 158, y: 16 },
  { x: 150, z: 206, y: 21 },
  // 7: the crest at the top of the climb (sharp: the quick cars take off here).
  { x: 150, z: 246, y: 25.5, round: 0 },
  // 8-10: the summit hairpin under the tower.
  { x: 172, z: 274, y: 25.5 },
  { x: 162, z: 304, y: 25.8 },
  { x: 126, z: 312, y: 26 },
  // 11: out of the hairpin, heading back down the hill.
  { x: 98, z: 284, y: 25 },
  // 12-13: the first drop (a crest into the steep part).
  { x: 70, z: 238, y: 24.5, round: 0 },
  { x: 36, z: 208, y: 19 },
  // 14-15: a flat shelf and the second crest.
  { x: 0, z: 196, y: 18.3, round: 0 },
  { x: -38, z: 190, y: 12 },
  // 16-17: the long left-hand sweeper at the bottom of the hill.
  { x: -92, z: 176, y: 6.5 },
  { x: -128, z: 136, y: 3.5 },
  // 18-21: the chicane and the last corner onto the straight.
  { x: -134, z: 92, y: 2 },
  { x: -116, z: 60, y: 1 },
  { x: -120, z: 28, y: 0.3 },
  { x: -92, z: 4, y: 0 },
];

const SECTIONS: LoopSection[] = [
  { from: 0, kind: 'straight', name: 'Portola Straight', hw: TP_HW, edgeL: 'rail', edgeR: 'rail' },
  { from: 1, kind: 'corner', name: 'Turn 1', hw: TP_HW, edgeL: 'barrier', edgeR: 'curb' },
  { from: 3, kind: 'climb', name: 'The Switchbacks', hw: TP_HW, edgeL: 'barrier', edgeR: 'barrier' },
  { from: 7, kind: 'hairpin', name: 'Summit Hairpin', hw: TP_HW, edgeL: 'barrier', edgeR: 'barrier' },
  { from: 11, kind: 'descent', name: 'The Drop', hw: TP_HW, edgeL: 'rail', edgeR: 'rail' },
  { from: 16, kind: 'corner', name: 'The Sweeper', hw: TP_HW, edgeL: 'curb', edgeR: 'barrier' },
  { from: 18, kind: 'chicane', name: 'Chicane', hw: TP_HW, edgeL: 'barrier', edgeR: 'barrier' },
  { from: 21, kind: 'straight', name: 'Portola Straight', hw: TP_HW, edgeL: 'rail', edgeR: 'rail' },
];

export const TWIN_PEAKS: Course = buildLoop({ id: 'twin-peaks', nodes: NODES, sections: SECTIONS, startS: 24 });

// ---------------------------------------------------------------------------------------------
// What's on the road each round

const secS0 = (name: string): number => TWIN_PEAKS.sections.find((q) => q.name === name)!.s0;

/** Two Waymos pottering round the loop for ever (backmarkers to lap), a stalled one with a cone on
 *  its hood on the switchbacks, and tourists at the summit taking photos of the view. */
export function populateTwinPeaks(sim: RaceSim, r: () => number): void {
  const c = sim.course;
  const L = c.length;
  // Well up the road from the grid, one each side, never parked.
  sim.addTraffic(c.startS + 150 + r() * 60, r() < 0.5 ? -3.4 : 3.4, 5 + r() * 1.5, Infinity);
  sim.addTraffic(c.startS + L * 0.55 + r() * 80, r() < 0.5 ? -3.4 : 3.4, 4.5 + r() * 1.5, Infinity);
  {
    const s = secS0('The Switchbacks') + 60 + r() * 60;
    const d = (r() < 0.5 ? -1 : 1) * (2 + r() * 2);
    const wm = sim.addStalled(s, d, Math.PI + (r() - 0.5) * 0.5);
    wm.cone = true;
    wm.hazard = true;
    for (let i = 0; i < 3; i++) sim.addCone(s - 6 - i * 2.2, Math.max(-5.5, Math.min(5.5, d + (r() - 0.5) * 3)));
  }
  // The viewpoint at the top: tourists wander into the road for the photo.
  const top = secS0('Summit Hairpin');
  for (let k = 0; k < 3; k++) {
    const s = top + 40 + k * 22 + r() * 10;
    const hw = pointAt(c, s).hw;
    const p = sim.addPed('tourist', s, (r() * 2 - 1) * (hw - 1.5), 0, 0, 1, 0, 0);
    p.speed = r() < 0.5 ? 0.5 : 0;
    p.d0 = -hw + 0.8;
    p.d1 = hw - 0.8;
  }
}

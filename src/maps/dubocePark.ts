// Duboce Park's plan: where its things stand, worked out from the course alone (no Three.js, no
// scenery), so the course's open ground (the lawn a car can drive anywhere in: its outline, the trees
// and lamps it bounces off, the buildings it can't drive into) and the scenery drawing it agree. The
// lawn runs from Steiner to Scott between Hermann St and the N Judah's tracks, the course's path
// winding up it; along its north side stand the Harvey Milk Center for the Arts at the west end, the
// playground and the dogs' play area.
import { makeRng } from '../sim/physics';
import { pointAt, type Course } from '../track';

/** An axis-aligned footprint on the lawn. */
export interface ParkLot {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface ParkTree {
  x: number;
  z: number;
  kind: 'tree' | 'cypress';
  /** The tree's scale (props.ts). */
  size: number;
}

export interface DubocePlan {
  /** The lawn a car can drive on: [x, z] round it, a simple polygon. */
  outline: [number, number][];
  milk: ParkLot;
  play: ParkLot;
  dogs: ParkLot;
  /** The Milk Center's doors, and where the path from them meets the course's. */
  doors: { x: number; z: number };
  join: { x: number; z: number };
  trees: ParkTree[];
  lamps: { x: number; z: number }[];
  benches: { x: number; z: number; face: number }[];
}

let cached: { course: Course; plan: DubocePlan } | null = null;

/** `mark`: a chunk's mark along the course (the course's osgMark; a parameter, so the course's module
 *  can use this without importing itself). */
export function dubocePlan(c: Course, mark: (chunk: string, name: string) => number): DubocePlan {
  if (cached && cached.course === c) return cached.plan;
  const rng = makeRng(1974);
  const sPark = mark('duboce', 'park');
  const sEnd = mark('duboce', 'parkEnd');
  const pe = pointAt(c, sEnd);
  const pp = pointAt(c, sPark);
  // The path's northern loop runs west at this z: the buildings along the north side.
  let zPath = Infinity;
  for (let s = sPark; s <= sEnd; s += 1) zPath = Math.min(zPath, pointAt(c, s).z);
  const milk: ParkLot = { x0: pe.x - 1.5, x1: pe.x + 16.5, z0: zPath - 22.5, z1: zPath - 9.5 };
  const play: ParkLot = { x0: milk.x1 + 2.5, x1: milk.x1 + 16, z0: zPath - 19.5, z1: zPath - 8.5 };
  const dogs: ParkLot = { x0: play.x1 + 3, x1: play.x1 + 21, z0: zPath - 20, z1: zPath - 8 };
  const lots = [milk, play, dogs];
  const onLot = (x: number, z: number, pad: number): boolean => lots.some((l) => x > l.x0 - pad && x < l.x1 + pad && z > l.z0 - pad && z < l.z1 + pad);

  // The lawn: Hermann St along the north, Steiner's west sidewalk along the east (the crossing's arm is
  // 6 m of road with its sidewalks), the tracks along the south (and round the course's own path where
  // it comes in from Steiner and goes out onto Duboce Ave at Scott), Scott at the west.
  const steinerMid = pointAt(c, mark('duboce', 'steiner') + 3);
  const xE = steinerMid.x - 3 - 3.5;
  const xW = pe.x + 0.7;
  const zN = zPath - 27;
  const zRail = pp.z + 0.6;
  const outline: [number, number][] = [
    [xW, zN],
    [xE, zN],
    [xE, zRail + 6.2],
    [xE - 9, zRail + 6.2],
    [xE - 11, zRail],
    [xW + 14, zRail],
    [xW + 10, zRail + 6.7],
    [xW, zRail + 6.7],
  ];

  // The Milk Center's doors, and the nearest point of the path's northern edge.
  const doors = { x: milk.x0 + 10.5, z: milk.z1 + 1.8 };
  let join = { x: doors.x, z: doors.z };
  {
    let best = Infinity;
    for (let s = sPark + 4; s <= sEnd - 4; s += 1) {
      const p = pointAt(c, s);
      const d = p.pave + 1.2;
      const x = p.x - p.tz * d;
      const z = p.z + p.tx * d;
      const e = Math.hypot(x - doors.x, z - doors.z);
      if (e < best) {
        best = e;
        join = { x, z };
      }
    }
  }

  // How far a point is from the course's paved path (the lawn either side is drivable).
  const path: { x: number; z: number; pave: number }[] = [];
  for (let s = sPark - 6; s <= sEnd + 6; s += 1) {
    const p = pointAt(c, s);
    path.push({ x: p.x, z: p.z, pave: p.pave });
  }
  const offPath = (x: number, z: number): number => {
    let m = Infinity;
    for (const q of path) m = Math.min(m, Math.hypot(q.x - x, q.z - z) - q.pave);
    return m;
  };
  const inside = (x: number, z: number): boolean => {
    let inn = false;
    for (let a = 0, b = outline.length - 1; a < outline.length; b = a++) {
      const p = outline[a];
      const q = outline[b];
      if (p[1] > z !== q[1] > z && x < ((q[0] - p[0]) * (z - p[1])) / (q[1] - p[1]) + p[0]) inn = !inn;
    }
    return inn;
  };

  // Trees round the lawn's edges (a few out on it), clear of the path and the buildings.
  const trees: ParkTree[] = [];
  for (let gx = xW; gx < xE; gx += 4.5) {
    for (let gz = zN + 1; gz < zRail + 4; gz += 4.5) {
      const x = gx + (rng() - 0.5) * 3;
      const z = gz + (rng() - 0.5) * 3;
      const pick = rng();
      const size = rng();
      const kind = rng() < 0.18 ? 'cypress' : 'tree';
      if (!inside(x, z) || onLot(x, z, 2.5)) continue;
      const m = offPath(x, z);
      if (m < 4.5) continue;
      // Mostly round the edges; the lawn's open in the middle.
      const edge = Math.min(x - xW, xE - x, z - zN, zRail - z);
      if (pick > (edge < 4 ? 0.9 : m > 10 ? 0.55 : 0.3)) continue;
      trees.push({ x, z, kind, size: kind === 'cypress' ? 1.1 + size * 0.3 : Math.min(1.35 + size * 0.6, m / 2.6) });
    }
  }

  // Park lamps and benches along the path, just off its paving.
  const lamps: { x: number; z: number }[] = [];
  const benches: { x: number; z: number; face: number }[] = [];
  {
    let k = 0;
    for (let s = sPark + 9; s < sEnd - 4; s += 17) {
      const side = k++ % 2 ? 1 : -1;
      const p = pointAt(c, s);
      const d = side * (p.pave + 2.2);
      const x = p.x - p.tz * d;
      const z = p.z + p.tx * d;
      if (inside(x, z) && !onLot(x, z, 0.5)) lamps.push({ x, z });
    }
    for (const [ds, side] of [
      [15, 1],
      [30, -1],
      [40, 1],
      [52, 1],
    ] as const) {
      const p = pointAt(c, sPark + ds);
      const d = side * (p.pave + 3.2);
      const x = p.x - p.tz * d;
      const z = p.z + p.tx * d;
      if (inside(x, z) && !onLot(x, z, 0.5)) benches.push({ x, z, face: Math.atan2(p.z - z, p.x - x) });
    }
  }

  const plan: DubocePlan = { outline, milk, play, dogs, doors, join, trees, lamps, benches };
  cached = { course: c, plan };
  return plan;
}

// Buena Vista's switchbacks garden (BV_GARDEN: the course's walled block round the zigzag), and the
// ground between its legs. The sim holds a car that comes down in it on a bed at the wall's height
// over the nearest leg and skids it onto that leg, so the ground's terraced the same way: each leg's
// terrace level with the top of its wall, and a retaining wall where two legs' terraces meet (the
// line halfway between them, where the sim hands a car on to the other leg). The plan of it, pure
// (no Three.js): garden.ts draws it, and the ground (index.ts) lies low beneath it.
import { BV_GARDEN, osgMark } from '../../../maps/oldStompingGrounds';
import { gardenFrame, pointAt, type Course, type Garden } from '../../../track';

/** Nearest points further apart than this along the course are on different legs (m). */
export const LEG_GAP = 6;

/** The zigzag's nearest point to somewhere: its arc length, the road's height there, and how far the
 *  place is past the corridor's edge (m; negative on the road). */
export interface Owner {
  s: number;
  y: number;
  e: number;
}

export interface GardenPlan {
  garden: Garden;
  /** Inside the garden's walls (its rectangle), `grow` metres out. */
  inside(x: number, z: number, grow?: number): boolean;
  /** The zigzag's nearest point to (x, z); with `near`, only within LEG_GAP·1.5 of that arc length
   *  (the same leg). */
  owner(x: number, z: number, near?: number): Owner;
  /** The ground at a place `e` past the edge of a leg whose road is at `y` there: level with the
   *  wall's top out on the terrace, under the road and the wall. */
  bed(y: number, e: number): number;
  /** The land under the garden (well below the terraces and the paths across it), or null outside
   *  its walls: for the ground, which the garden's own terraces hide. */
  low(x: number, z: number): number | null;
  /** A ground grid's x (or z) lines with lines added along the garden's walls (and 0.3 m outside
   *  them), so its ground can drop away sharply inside them, under the walls. */
  gridX(axis: number[]): number[];
  gridZ(axis: number[]): number[];
}

let cached: { course: Course; plan: GardenPlan } | null = null;

export function bvGardenPlan(c: Course): GardenPlan {
  if (cached && cached.course === c) return cached.plan;
  const g = BV_GARDEN;
  // The zigzag through it, every quarter metre.
  const s0 = osgMark('buenaVista', 'switchbacks') + g.u0 - 3;
  const s1 = osgMark('buenaVista', 'out') + (g.u1 - (g.oz - pointAt(c, osgMark('buenaVista', 'out')).z)) + 3;
  const n = Math.ceil((s1 - s0) / 0.25) + 1;
  const ss = new Float64Array(n);
  const xs = new Float64Array(n);
  const zs = new Float64Array(n);
  const ys = new Float64Array(n);
  const hws = new Float64Array(n);
  let yMin = Infinity;
  for (let i = 0; i < n; i++) {
    const s = s0 + ((s1 - s0) * i) / (n - 1);
    const p = pointAt(c, s);
    ss[i] = s;
    xs[i] = p.x;
    zs[i] = p.z;
    ys[i] = p.y;
    hws[i] = p.hw;
    yMin = Math.min(yMin, p.y);
  }
  const inside = (x: number, z: number, grow = 0): boolean => {
    const q = gardenFrame(g, x, z);
    const eps = 1e-6;
    return q.u >= g.u0 - grow - eps && q.u <= g.u1 + grow + eps && Math.abs(q.v) <= g.wall + grow + eps;
  };
  const owner = (x: number, z: number, near?: number): Owner => {
    let best = Infinity;
    let k = 0;
    const lo = near === undefined ? -Infinity : near - LEG_GAP * 1.5;
    const hi = near === undefined ? Infinity : near + LEG_GAP * 1.5;
    for (let i = 0; i < n; i++) {
      if (ss[i] < lo || ss[i] > hi) continue;
      const e = Math.hypot(xs[i] - x, zs[i] - z) - hws[i];
      if (e < best) {
        best = e;
        k = i;
      }
    }
    return { s: ss[k], y: ys[k], e: best };
  };
  const bed = (y: number, e: number): number => (e < 0.3 ? y - 0.35 : y + 0.62 + Math.min(0.2, Math.max(0, e - 0.6) * 0.04));
  const low = (x: number, z: number): number | null => {
    if (!inside(x, z)) return null;
    // Below the lowest of the paths about (the terraces stand at least a little above their own).
    let y = Infinity;
    for (let i = 0; i < n; i++) {
      if ((xs[i] - x) ** 2 + (zs[i] - z) ** 2 < 16 * 16) y = Math.min(y, ys[i]);
    }
    return (Number.isFinite(y) ? y : yMin) - 1.4;
  };
  // The walls' lines (the garden is square to the world: see BV_GARDEN).
  const cs = Math.cos(g.heading);
  const sn = Math.sin(g.heading);
  const corners = [
    [g.u0, -g.wall],
    [g.u0, g.wall],
    [g.u1, -g.wall],
    [g.u1, g.wall],
  ].map(([u, v]) => ({ x: g.ox + u * cs - v * sn, z: g.oz + u * sn + v * cs }));
  const lines = (axis: number[], at: number[]): number[] => {
    const lo = Math.min(...at);
    const hi = Math.max(...at);
    const extra = [lo - 0.3, lo, hi, hi + 0.3];
    return [...axis.filter((a) => extra.every((b) => Math.abs(a - b) > 0.05)), ...extra].sort((a, b) => a - b);
  };
  const plan: GardenPlan = {
    garden: g,
    inside,
    owner,
    bed,
    low,
    gridX: (axis) => lines(axis, corners.map((q) => q.x)),
    gridZ: (axis) => lines(axis, corners.map((q) => q.z)),
  };
  cached = { course: c, plan };
  return plan;
}

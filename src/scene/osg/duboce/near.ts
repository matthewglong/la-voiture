// How near a point is to the road: the course sampled every metre over a stretch, hashed on a grid,
// for keeping trees, benches and the rest out of the course's corridor (the physics can't see them).
import { pointAt, type Course } from '../../../track';

export interface NearPt {
  s: number;
  x: number;
  y: number;
  z: number;
  hw: number;
}

export class Near {
  readonly pts: NearPt[] = [];
  private readonly cells = new Map<number, number[]>();
  private static readonly CELL = 16;

  /** `widen`: how much wider than its corridor to keep a stretch clear, by its kind (a street's
   *  sidewalks, say). */
  constructor(c: Course, s0: number, s1: number, step = 1, widen: (kind: string) => number = () => 0) {
    for (let s = s0; s <= s1; s += step) {
      const p = pointAt(c, s);
      const i = this.pts.length;
      this.pts.push({ s: p.s, x: p.x, y: p.y, z: p.z, hw: p.hw + widen(c.sections[p.sec].kind) });
      const k = this.key(Math.floor(p.x / Near.CELL), Math.floor(p.z / Near.CELL));
      let list = this.cells.get(k);
      if (!list) this.cells.set(k, (list = []));
      list.push(i);
    }
  }

  private key(cx: number, cz: number): number {
    return (cx + 4096) * 8192 + (cz + 4096);
  }

  private each(x: number, z: number, reach: number, fn: (i: number) => void): void {
    const r = Math.ceil(reach / Near.CELL);
    const cx = Math.floor(x / Near.CELL);
    const cz = Math.floor(z / Near.CELL);
    for (let ix = cx - r; ix <= cx + r; ix++) {
      for (let iz = cz - r; iz <= cz + r; iz++) {
        const list = this.cells.get(this.key(ix, iz));
        if (list) for (const i of list) fn(i);
      }
    }
  }

  /** The nearest sample within `reach` metres: its index and distance (or null). */
  nearest(x: number, z: number, reach = 60): { i: number; d: number } | null {
    let best = -1;
    let bd = reach * reach;
    this.each(x, z, reach, (i) => {
      const p = this.pts[i];
      const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d2 < bd) {
        bd = d2;
        best = i;
      }
    });
    return best < 0 ? null : { i: best, d: Math.sqrt(bd) };
  }

  /** How far outside the corridor (x, z) is (negative: inside it), within `reach`. */
  margin(x: number, z: number, reach = 30): number {
    let m = reach;
    this.each(x, z, reach, (i) => {
      const p = this.pts[i];
      m = Math.min(m, Math.hypot(p.x - x, p.z - z) - p.hw);
    });
    return m;
  }

  /** Is (x, z) at least `pad` metres outside the corridor all along the stretch? */
  clear(x: number, z: number, pad: number): boolean {
    return this.margin(x, z, pad + 8) >= pad;
  }
}

/** How far the cross streets run off the course at a crossing (streets.ts draws them after the
 *  neighbourhoods are built, so they aren't on the ground's record yet). */
const ARM = 34;

/**
 * The cross streets off the course's crossings between s0 and s1 (both sides, with their sidewalks),
 * as polygons, and a test for whether a point is on one of them (or within `pad` of it).
 */
export function crossingArms(c: Course, s0: number, s1: number, walk: number): { polys: [number, number][][]; on(x: number, z: number, pad?: number): boolean } {
  const polys: [number, number][][] = [];
  for (const sec of c.sections) {
    if (sec.kind !== 'crossing' || sec.s1 < s0 || sec.s0 > s1) continue;
    const mid = pointAt(c, (sec.s0 + sec.s1) / 2);
    const w = sec.s1 - sec.s0;
    for (const side of [1, -1]) {
      const h = mid.heading + (side * Math.PI) / 2;
      const ox = mid.x - mid.tz * side * sec.hw;
      const oz = mid.z + mid.tx * side * sec.hw;
      const ch = Math.cos(h);
      const sh = Math.sin(h);
      const pt = (u: number, v: number): [number, number] => [ox + u * ch - v * sh, oz + u * sh + v * ch];
      const v = w / 2 + walk;
      polys.push([pt(-0.5, -v), pt(ARM, -v), pt(ARM, v), pt(-0.5, v)]);
    }
  }
  const on = (x: number, z: number, pad = 0): boolean =>
    polys.some((p) => {
      // Inside, or within pad of an edge: test the point pushed pad towards each corner's centre.
      const cx = (p[0][0] + p[2][0]) / 2;
      const cz = (p[0][1] + p[2][1]) / 2;
      const d = Math.hypot(x - cx, z - cz) || 1;
      const qx = x + ((cx - x) / d) * pad;
      const qz = z + ((cz - z) / d) * pad;
      let inside = false;
      for (let a = 0, b = p.length - 1; a < p.length; b = a++) {
        if (p[a][1] > qz !== p[b][1] > qz && qx < ((p[b][0] - p[a][0]) * (qz - p[a][1])) / (p[b][1] - p[a][1]) + p[a][0]) inside = !inside;
      }
      return inside;
    });
  return { polys, on };
}

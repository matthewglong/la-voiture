// Open ground: a park you can drive anywhere in. The course runs through it on its paths, but inside
// its outline the road's walls don't hold a car: it can cut across the grass (slower), round the
// trees, along the park's other paths. The outline holds it, but for the gates where the course
// comes in and goes out. The park's ground is a height field of its own, baked once onto a fine
// grid: the physics drives on it and the scenery draws it, so the two always agree.
// No Three.js or DOM imports.
import { heightAt, pointAt, wrapS, type Course, type Surface } from './track';

/** How far along the course two points must be to count as different legs of it (m). */
const GAP_S = 25;

export interface OpenGround {
  id: string;
  /** The outline, [x, z] in the world (a simple polygon). */
  outline: [number, number][];
  /** The stretch of course inside it (arc lengths, s0 < s1). */
  s0: number;
  s1: number;
  /** Where the course crosses the outline: a car may leave (or come in) within `r` of one. */
  gates: { x: number; z: number; s: number; r: number }[];
  /** Tree trunks and posts: circles a car bounces off. */
  posts: { x: number; z: number; r: number }[];
  /** Solid blocks (buildings, fenced courts): polygons a car bounces off. */
  blocks: [number, number][][];
  /** Is (x, z) inside the outline? */
  contains(x: number, z: number): boolean;
  /** The ground's height (m) at (x, z) (anywhere: outside the grid it's the edge's). */
  height(x: number, z: number): number;
  /** The ground's slope at (x, z): dy/dx and dy/dz. */
  slope(x: number, z: number): { gx: number; gz: number };
  /** What's underfoot away from the course's own paths: the park's other paths (paved like the
   *  course's), its rough (long grass, planting: a crawl) or its lawn. */
  surfaceAt(x: number, z: number): Surface;
  /** Its rough patches (polygons: the scenery plants them; the gaps between the course's legs are
   *  rough too, by rule: see OpenGroundSpec.roughAt). */
  rough: [number, number][][];
  /** The arc length of the nearest point of the course inside it. */
  nearestS(x: number, z: number): number;
}

export interface OpenGroundSpec {
  id: string;
  outline: [number, number][];
  s0: number;
  s1: number;
  /** The park's own land (its survey), away from the course's paths. */
  land(x: number, z: number): number;
  posts?: { x: number; z: number; r: number }[];
  blocks?: [number, number][][];
  /** The park's other paths: polylines and their half-width. */
  paths?: { pts: [number, number][]; hw: number }[];
  /** Its rough: long grass and planting, polygons. */
  rough?: [number, number][][];
  /** And rough by rule, given the course round about: `d1` the distance to its nearest path, `d2`
   *  to the nearest other leg of it (well along from that one) and `gap` how far along; and `cut`,
   *  the most course a car could skip by driving through here from the nearest path to any other
   *  leg, less `ratio` times the lawn it would drive to do it (> 0: a cut through here could pay if
   *  the lawn were `ratio` times slower than the path). */
  roughAt?(x: number, z: number, near: { d1: number; d2: number; gap: number; cut: number }): boolean;
  /** How much slower than the paths the lawn is, for `cut` (default 1.5). */
  ratio?: number;
  /** Grid spacing (m, default 0.5). */
  cell?: number;
}

/** Point in polygon (even-odd). */
export function inPoly(poly: readonly (readonly [number, number])[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** The nearest point on segment a-b to (x, z): its parameter and squared distance. */
function onSeg(ax: number, az: number, bx: number, bz: number, x: number, z: number): { t: number; d2: number } {
  const ex = bx - ax;
  const ez = bz - az;
  const l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0;
  const px = ax + ex * t - x;
  const pz = az + ez * t - z;
  return { t, d2: px * px + pz * pz };
}

/**
 * Bake an open ground over the course. Its height: on the course's paths, the course's own height;
 * away from them, the park's land, reached over a bank (never steeper than about 40°); where two
 * paths pass near each other the ground between them is a smooth blend of the two (no step at the
 * halfway line).
 */
export function makeOpenGround(c: Course, spec: OpenGroundSpec): OpenGround {
  const cell = spec.cell ?? 0.5;
  const outline = spec.outline;
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [x, z] of outline) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  // A margin round the outline: cars at its edge, and the scenery's grid, read inside the bake.
  x0 -= 4;
  z0 -= 4;
  x1 += 4;
  z1 += 4;
  const nx = Math.ceil((x1 - x0) / cell) + 1;
  const nz = Math.ceil((z1 - z0) / cell) + 1;

  // The course through it (and a little either side), every metre.
  const span = spec.s1 - spec.s0 + 40;
  const n = Math.ceil(span);
  const sx = new Float64Array(n + 1);
  const sz = new Float64Array(n + 1);
  const sy = new Float64Array(n + 1);
  const ss = new Float64Array(n + 1);
  const sp = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const s = c.loop ? wrapS(c, spec.s0 - 20 + (span * i) / n) : Math.min(c.length, Math.max(0, spec.s0 - 20 + (span * i) / n));
    const p = pointAt(c, s);
    sx[i] = p.x;
    sz[i] = p.z;
    sy[i] = heightAt(c, s);
    ss[i] = s;
    sp[i] = p.pave;
  }
  const paths = spec.paths ?? [];
  const rough = spec.rough ?? [];

  // The grids, baked the first time anything asks (the course is built whichever map is raced).
  let heights = new Float32Array(0);
  let nearest = new Float32Array(0);
  let paved = new Uint8Array(0);
  let baked = false;
  const bake = (): void => {
    if (baked) return;
    baked = true;
    heights = new Float32Array(nx * nz);
    nearest = new Float32Array(nx * nz);
    paved = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * cell;
        const z = z0 + j * cell;
        // The nearest point of the course (exactly, on its segments), and a blend of the paths' heights
        // weighted steeply by distance.
        let best = Infinity;
        let bestK = 0;
        let bestT = 0;
        let wsum = 0;
        let ysum = 0;
        for (let k = 0; k < n; k++) {
          const q = onSeg(sx[k], sz[k], sx[k + 1], sz[k + 1], x, z);
          if (q.d2 < best) {
            best = q.d2;
            bestK = k;
            bestT = q.t;
          }
          if (q.d2 < 900) {
            const w = 1 / (q.d2 * q.d2 + 0.0625);
            wsum += w;
            ysum += w * (sy[k] + (sy[k + 1] - sy[k]) * q.t);
          }
        }
        const dist = Math.sqrt(best);
        const yNear = sy[bestK] + (sy[bestK + 1] - sy[bestK]) * bestT;
        const pave = sp[bestK];
        const yBlend = wsum > 0 ? ysum / wsum : yNear;
        // On the path the path's own height; from its edge out, the blend of the paths about.
        const e = Math.min(1, Math.max(0, (dist - pave) / 2.5));
        const road = yNear + (yBlend - yNear) * e * e * (3 - 2 * e);
        const verge = pave + 0.6;
        let y = road;
        if (dist > verge) {
          const land = spec.land(x, z);
          // (Gently: a car drives off the path onto it.)
          const bank = Math.max(6, Math.abs(land - road) * 3);
          const t = Math.min(1, (dist - verge) / bank);
          y = road + (land - road) * t * t * (3 - 2 * t);
        }
        heights[j * nx + i] = y;
        nearest[j * nx + i] = ss[bestK] + (ss[bestK + 1] - ss[bestK]) * bestT;
        for (const pth of paths) {
          const pts = pth.pts;
          for (let k = 0; k < pts.length - 1; k++) {
            if (onSeg(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], x, z).d2 < pth.hw * pth.hw) {
              paved[j * nx + i] = 1;
              break;
            }
          }
          if (paved[j * nx + i]) break;
        }
        if (!paved[j * nx + i]) {
          for (const poly of rough) {
            if (inPoly(poly, x, z)) {
              paved[j * nx + i] = 2;
              break;
            }
          }
        }
        if (!paved[j * nx + i] && spec.roughAt) {
          // The nearest point of any other leg of the course (well along from the nearest one), and
          // the best cut through here from the nearest path to any other leg.
          let best2 = Infinity;
          let gap = 0;
          let cut = -Infinity;
          const sNear = ss[bestK];
          const ratio = spec.ratio ?? 1.5;
          for (let k = 0; k <= n; k++) {
            const along = Math.abs(ss[k] - sNear);
            if (along < GAP_S) continue;
            const d2 = (sx[k] - x) ** 2 + (sz[k] - z) ** 2;
            if (d2 < best2) {
              best2 = d2;
              gap = along;
            }
            cut = Math.max(cut, along - ratio * Math.sqrt(d2));
          }
          if (spec.roughAt(x, z, { d1: dist, d2: Math.sqrt(best2), gap, cut: cut - ratio * dist })) paved[j * nx + i] = 2;
        }
      }
    }
  };

  const clampI = (v: number, hi: number): number => Math.max(0, Math.min(hi, v));
  const height = (x: number, z: number): number => {
    bake();
    const fx = clampI((x - x0) / cell, nx - 1.000001);
    const fz = clampI((z - z0) / cell, nz - 1.000001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const a = heights[j * nx + i];
    const b = heights[j * nx + i + 1];
    const cc = heights[(j + 1) * nx + i];
    const d = heights[(j + 1) * nx + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (cc * (1 - u) + d * u) * v;
  };
  const grid = (arr: () => Float32Array | Uint8Array, x: number, z: number): number => {
    bake();
    const a = arr();
    const i = Math.round(clampI((x - x0) / cell, nx - 1));
    const j = Math.round(clampI((z - z0) / cell, nz - 1));
    return a[j * nx + i];
  };

  // Where the course crosses the outline.
  const gates: OpenGround['gates'] = [];
  for (let k = 0; k < n; k++) {
    for (let a = 0, b = outline.length - 1; a < outline.length; b = a++) {
      const [px, pz] = outline[b];
      const [qx, qz] = outline[a];
      // Segment-segment intersection.
      const rx = sx[k + 1] - sx[k];
      const rz = sz[k + 1] - sz[k];
      const ux = qx - px;
      const uz = qz - pz;
      const den = rx * uz - rz * ux;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((px - sx[k]) * uz - (pz - sz[k]) * ux) / den;
      const w = ((px - sx[k]) * rz - (pz - sz[k]) * rx) / den;
      if (t < 0 || t > 1 || w < 0 || w > 1) continue;
      const s = ss[k] + (ss[k + 1] - ss[k]) * t;
      gates.push({
        x: sx[k] + rx * t,
        z: sz[k] + rz * t,
        s,
        r: pointAt(c, s).hw + 0.4,
      });
    }
  }

  return {
    id: spec.id,
    outline,
    s0: spec.s0,
    s1: spec.s1,
    gates,
    posts: spec.posts ?? [],
    blocks: spec.blocks ?? [],
    contains: (x, z) => x > x0 + 4 && x < x1 - 4 && z > z0 + 4 && z < z1 - 4 && inPoly(outline, x, z),
    height,
    slope: (x, z) => {
      const e = cell;
      return {
        gx: (height(x + e, z) - height(x - e, z)) / (2 * e),
        gz: (height(x, z + e) - height(x, z - e)) / (2 * e),
      };
    },
    surfaceAt: (x, z) => {
      const v = grid(() => paved, x, z);
      return v === 1 ? 'paved' : v === 2 ? 'rough' : 'grass';
    },
    rough,
    nearestS: (x, z) => grid(() => nearest, x, z),
  };
}

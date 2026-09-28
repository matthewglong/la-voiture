// Ground that follows a course, for any map: right beside the road it's at the road's own height
// (the verge), and between roads it's a smooth blend of the heights of the roads round about, so a
// city's blocks step down its hills with its streets and a park's lawn lies between its paths. A map
// can shape the land further out (a hill, a rock, a survey) and colour it. Plus a heightfield mesh
// over any height function: fine over the course, the cells spreading out towards the horizon.
import * as THREE from 'three';
import { pointAt, type Course } from '../track';
import { makeRng } from './util';

/** Quick nearest-road queries: course samples every `step` metres in a grid of cells over the
 *  course's bounding box (points well outside it are turned away at once). */
export class CourseIndex {
  readonly xs: Float64Array;
  readonly zs: Float64Array;
  readonly ys: Float64Array;
  readonly hws: Float64Array;
  readonly ss: Float64Array;
  private readonly cells: Int32Array[];
  private readonly cell: number;
  private readonly x0: number;
  private readonly z0: number;
  private readonly nx: number;
  private readonly nz: number;

  constructor(readonly course: Course, step = 1, cell = 12) {
    const n = Math.ceil(course.length / step);
    this.xs = new Float64Array(n);
    this.zs = new Float64Array(n);
    this.ys = new Float64Array(n);
    this.hws = new Float64Array(n);
    this.ss = new Float64Array(n);
    this.cell = cell;
    let xa = Infinity;
    let xb = -Infinity;
    let za = Infinity;
    let zb = -Infinity;
    for (let i = 0; i < n; i++) {
      const p = pointAt(course, i * step);
      this.xs[i] = p.x;
      this.zs[i] = p.z;
      this.ys[i] = p.y;
      this.hws[i] = p.hw;
      this.ss[i] = p.s;
      xa = Math.min(xa, p.x);
      xb = Math.max(xb, p.x);
      za = Math.min(za, p.z);
      zb = Math.max(zb, p.z);
    }
    this.x0 = xa;
    this.z0 = za;
    this.nx = Math.floor((xb - xa) / cell) + 1;
    this.nz = Math.floor((zb - za) / cell) + 1;
    const lists: number[][] = Array.from({ length: this.nx * this.nz }, () => []);
    for (let i = 0; i < n; i++) lists[this.cellOf(this.xs[i], this.zs[i])].push(i);
    this.cells = lists.map((l) => Int32Array.from(l));
  }

  private cellOf(x: number, z: number): number {
    return Math.floor((z - this.z0) / this.cell) * this.nx + Math.floor((x - this.x0) / this.cell);
  }

  /** How far (x, z) is outside the course's bounding box (0 inside it). */
  private outside(x: number, z: number): number {
    const dx = Math.max(this.x0 - x, 0, x - (this.x0 + this.nx * this.cell));
    const dz = Math.max(this.z0 - z, 0, z - (this.z0 + this.nz * this.cell));
    return Math.hypot(dx, dz);
  }

  /** The nearest sample within `reach` metres (its index and distance), or null. Searches rings of
   *  cells outwards from the point's own, stopping once no further ring could hold anything nearer. */
  nearest(x: number, z: number, reach: number): { i: number; d: number } | null {
    if (this.outside(x, z) > reach) return null;
    const c = this.cell;
    const R = Math.ceil(reach / c);
    const cx = Math.floor((x - this.x0) / c);
    const cz = Math.floor((z - this.z0) / c);
    let best = -1;
    let bd = reach * reach;
    for (let r = 0; r <= R; r++) {
      // Anything in ring r is at least (r - 1) cells away.
      if (best >= 0 && ((r - 1) * c) ** 2 > bd) break;
      for (let iz = cz - r; iz <= cz + r; iz++) {
        if (iz < 0 || iz >= this.nz) continue;
        const edge = iz === cz - r || iz === cz + r;
        for (let ix = cx - r; ix <= cx + r; ix += edge ? 1 : 2 * r || 1) {
          if (ix < 0 || ix >= this.nx) continue;
          const list = this.cells[iz * this.nx + ix];
          for (let k = 0; k < list.length; k++) {
            const i = list[k];
            const dx = this.xs[i] - x;
            const dz = this.zs[i] - z;
            const d2 = dx * dx + dz * dz;
            if (d2 < bd) {
              bd = d2;
              best = i;
            }
          }
        }
      }
    }
    return best < 0 ? null : { i: best, d: Math.sqrt(bd) };
  }

  /** The road's height abreast of (x, z) near sample i (projected onto the samples either side of
   *  it), and its grade there. */
  roadAt(i: number, x: number, z: number): { y: number; grade: number } {
    const n = this.xs.length;
    const loop = this.course.loop;
    const at = (k: number): number => (loop ? ((k % n) + n) % n : Math.min(Math.max(k, 0), n - 1));
    let bestD = Infinity;
    let y = this.ys[i];
    for (const [a, b] of [
      [at(i - 1), i],
      [i, at(i + 1)],
    ]) {
      if (a === b) continue;
      const ex = this.xs[b] - this.xs[a];
      const ez = this.zs[b] - this.zs[a];
      const l2 = ex * ex + ez * ez;
      const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - this.xs[a]) * ex + (z - this.zs[a]) * ez) / l2)) : 0;
      const px = this.xs[a] + ex * t;
      const pz = this.zs[a] + ez * t;
      const d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bestD) {
        bestD = d;
        y = this.ys[a] + (this.ys[b] - this.ys[a]) * t;
      }
    }
    const lo = at(i - 1);
    const hi = at(i + 1);
    const run = Math.hypot(this.xs[hi] - this.xs[lo], this.zs[hi] - this.zs[lo]) || 1;
    return { y, grade: (this.ys[hi] - this.ys[lo]) / run };
  }

  /** Every sample within `reach` metres, as indices. */
  within(x: number, z: number, reach: number, out: number[] = []): number[] {
    out.length = 0;
    if (this.outside(x, z) > reach) return out;
    const c = this.cell;
    const r = Math.ceil(reach / c);
    const cx = Math.floor((x - this.x0) / c);
    const cz = Math.floor((z - this.z0) / c);
    const r2 = reach * reach;
    for (let iz = Math.max(0, cz - r); iz <= Math.min(this.nz - 1, cz + r); iz++) {
      for (let ix = Math.max(0, cx - r); ix <= Math.min(this.nx - 1, cx + r); ix++) {
        const list = this.cells[iz * this.nx + ix];
        for (let k = 0; k < list.length; k++) {
          const i = list[k];
          const dx = this.xs[i] - x;
          const dz = this.zs[i] - z;
          if (dx * dx + dz * dz < r2) out.push(i);
        }
      }
    }
    return out;
  }
}

export interface CourseGroundOpts {
  /** How far out from the centreline the ground sits at road height, at a sample (default: the
   *  corridor plus 4 m, room for a sidewalk). */
  verge?(i: number, idx: CourseIndex): number;
  /** How far the roads' heights reach out into the land (m, default 70). */
  reach?: number;
  /** A coarser index of the same course to blend the roads' heights from (default: `idx`); the
   *  blend doesn't need every metre, and it's most of the work. */
  blend?: CourseIndex;
  /** The land well away from the roads, given the roads' blended height there and the distance to
   *  the nearest road (default: the blend itself). */
  land?(x: number, z: number, carried: number, dist: number): number;
  /** Where the land takes over from the verge (m past the verge, default: a bank that's never
   *  steeper than about 40°). */
  bank?(drop: number): number;
}

/** A height function for ground that follows a course (see the file comment). */
export function courseGround(idx: CourseIndex, opts: CourseGroundOpts = {}): (x: number, z: number) => number {
  const reach = opts.reach ?? 70;
  const vergeOf = opts.verge ?? ((i: number) => idx.hws[i] + 4);
  const bankOf = opts.bank ?? ((drop: number) => Math.max(4, Math.abs(drop) * 1.3));
  const tmp: number[] = [];
  const blend = opts.blend ?? idx;
  return (x, z) => {
    const near = idx.nearest(x, z, reach);
    if (!near) {
      const far = opts.land ? opts.land(x, z, NaN, Infinity) : 0;
      return far;
    }
    // The roads' heights carried out (inverse-distance weighted over those in reach).
    let wsum = 0;
    let ysum = 0;
    for (const i of blend.within(x, z, reach, tmp)) {
      const dx = blend.xs[i] - x;
      const dz = blend.zs[i] - z;
      const w = 1 / (dx * dx + dz * dz + 30);
      wsum += w;
      ysum += w * blend.ys[i];
    }
    const carried = ysum / wsum;
    const verge = vergeOf(near.i, idx);
    // The road's own height where (x, z) is abreast of it (not the nearest sample's: on a steep hill
    // that's a staircase), a little lower the steeper it is, so the ground never shows through the
    // asphalt between the grid's vertices.
    const rd = idx.roadAt(near.i, x, z);
    const road = rd.y - 0.08 - 0.4 * Math.abs(rd.grade);
    const land = opts.land ? opts.land(x, z, carried, near.d) : carried;
    const off = near.d - verge;
    if (off <= 0) return road;
    const bank = bankOf(land - road);
    const t = Math.min(1, off / bank);
    const f = t * t * (3 - 2 * t);
    return road + (land - road) * f;
  };
}

/** A smooth field sampled once on a grid (cell metres) and read back bilinearly: for expensive
 *  functions that vary slowly (a regional height, say). Outside the grid it's evaluated directly. */
export function cachedField(f: (x: number, z: number) => number, x0: number, x1: number, z0: number, z1: number, cell: number): (x: number, z: number) => number {
  const nx = Math.ceil((x1 - x0) / cell) + 1;
  const nz = Math.ceil((z1 - z0) / cell) + 1;
  const v = new Float64Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = f(x0 + i * cell, z0 + j * cell);
  return (x, z) => {
    const fx = (x - x0) / cell;
    const fz = (z - z0) / cell;
    if (fx < 0 || fz < 0 || fx >= nx - 1 || fz >= nz - 1) return f(x, z);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const w = fz - j;
    const a = v[j * nx + i];
    const b = v[j * nx + i + 1];
    const c = v[(j + 1) * nx + i];
    const d = v[(j + 1) * nx + i + 1];
    return (a * (1 - u) + b * u) * (1 - w) + (c * (1 - u) + d * u) * w;
  };
}

/** Grid lines: every `step` metres over [lo, hi], then spreading out towards `reach`. */
export function gridAxis(lo: number, hi: number, step: number, reach: number, grow = 1.16): number[] {
  const out: number[] = [];
  for (let v = lo; v <= hi + 1e-6; v += step) out.push(v);
  let d = step;
  let v = out[out.length - 1];
  while (v < reach) {
    d *= grow;
    v += d;
    out.push(v);
  }
  d = step;
  v = lo;
  while (v > -reach) {
    d *= grow;
    v -= d;
    out.unshift(v);
  }
  return out;
}

export interface Heightfield {
  mesh: THREE.Mesh;
  /** Height anywhere on the grid: exactly the drawn surface (its triangles). */
  height(x: number, z: number): number;
}

/**
 * A heightfield mesh over a grid (x lines, z lines), heights from `height`, vertex colours from
 * `color` (given the height and the slope's upward normal once the normals are known), a little
 * speckle so it isn't flat.
 */
export function buildHeightfield(opts: {
  xs: number[];
  zs: number[];
  height(x: number, z: number): number;
  color(x: number, z: number, y: number, up: number, out: THREE.Color): void;
  name?: string;
  seed?: number;
  /** A detail texture under the vertex colours, laid in world space: one tile every `scale` m. */
  detail?: { map: THREE.Texture; scale: number };
}): Heightfield {
  const { xs, zs } = opts;
  const nx = xs.length;
  const nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  const heights = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const y = opts.height(xs[i], zs[j]);
      heights[k] = y;
      pos[k * 3] = xs[i];
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = zs[j];
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nrm = g.getAttribute('normal');
  const rng = makeRng(opts.seed ?? 5);
  const c = new THREE.Color();
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      opts.color(xs[i], zs[j], heights[k], nrm.getY(k), c);
      c.multiplyScalar(0.95 + rng() * 0.08);
      col[k * 3] = c.r;
      col[k * 3 + 1] = c.g;
      col[k * 3 + 2] = c.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (opts.detail) {
    const uv = new Float32Array(nx * nz * 2);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        uv[(j * nx + i) * 2] = xs[i] / opts.detail.scale;
        uv[(j * nx + i) * 2 + 1] = zs[j] / opts.detail.scale;
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, map: opts.detail?.map ?? null }));
  mesh.name = opts.name ?? 'ground';
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  const find = (arr: number[], v: number): number => {
    let lo = 0;
    let hi = arr.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= v) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  const height = (x: number, z: number): number => {
    const i = Math.min(nx - 2, find(xs, x));
    const j = Math.min(nz - 2, find(zs, z));
    const fx = Math.min(1, Math.max(0, (x - xs[i]) / (xs[i + 1] - xs[i])));
    const fz = Math.min(1, Math.max(0, (z - zs[j]) / (zs[j + 1] - zs[j])));
    const h00 = heights[j * nx + i];
    const h10 = heights[j * nx + i + 1];
    const h01 = heights[(j + 1) * nx + i];
    const h11 = heights[(j + 1) * nx + i + 1];
    // On the mesh's own two triangles (split corner (i+1, j) to (i, j+1)), not bilinear: where the
    // ground kinks, bilinear sits below the drawn surface and whatever's laid on it gets buried.
    if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  };
  return { mesh, height };
}

/** Is (x, z) inside the polygon (a list of [x, z])? */
export function inPolygon(poly: readonly (readonly [number, number])[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

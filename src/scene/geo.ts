// Geometry accumulation for the procedural scene: every static piece is appended into one
// builder per material and merged, which keeps draw calls low. Plus small primitive helpers.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type V3 = [number, number, number];
export type UV = [number, number];

// ---------------------------------------------------------------------------------------------
// Geometry accumulation: every static piece is appended into one builder per material.

const _col = new THREE.Color();

export function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function norm(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

const _nm = new THREE.Matrix3();
const UNIT_BOX = (() => {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const out = {
    pos: Array.from(g.getAttribute('position').array as ArrayLike<number>),
    nor: Array.from(g.getAttribute('normal').array as ArrayLike<number>),
    uv: Array.from(g.getAttribute('uv').array as ArrayLike<number>),
    idx: Array.from(g.getIndex()!.array as ArrayLike<number>),
  };
  g.dispose();
  return out;
})();

export class GeoBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private uvs: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  private vert(p: V3, n: V3, uv: UV): void {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.uvs.push(uv[0], uv[1]);
    this.col.push(_col.r, _col.g, _col.b);
  }

  /** Quad a-b-c-d; flipped if needed so its normal points along `facing`. */
  quad(
    a: V3,
    b: V3,
    c: V3,
    d: V3,
    color: THREE.ColorRepresentation,
    facing?: V3,
    uv: [UV, UV, UV, UV] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  ): void {
    let n = norm(cross(sub(b, a), sub(d, a)));
    if (facing && dot(n, facing) < 0) {
      [b, d] = [d, b];
      uv = [uv[0], uv[3], uv[2], uv[1]];
      n = [-n[0], -n[1], -n[2]];
    }
    _col.set(color);
    const base = this.vertexCount;
    this.vert(a, n, uv[0]);
    this.vert(b, n, uv[1]);
    this.vert(c, n, uv[2]);
    this.vert(d, n, uv[3]);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  tri(a: V3, b: V3, c: V3, color: THREE.ColorRepresentation, facing?: V3): void {
    let n = norm(cross(sub(b, a), sub(c, a)));
    if (facing && dot(n, facing) < 0) {
      [b, c] = [c, b];
      n = [-n[0], -n[1], -n[2]];
    }
    _col.set(color);
    const base = this.vertexCount;
    this.vert(a, n, [0, 0]);
    this.vert(b, n, [1, 0]);
    this.vert(c, n, [0, 1]);
    this.idx.push(base, base + 1, base + 2);
  }

  /**
   * Append a (temporary) geometry, transformed and painted one colour, or keeping its own
   * vertex colours when `color` is null. Disposes it.
   */
  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation | null, matrix?: THREE.Matrix4): void {
    if (matrix) geo.applyMatrix4(matrix);
    if (color !== null) _col.set(color);
    const p = geo.getAttribute('position').array as ArrayLike<number>;
    const n = geo.getAttribute('normal')?.array as ArrayLike<number> | undefined;
    const uv = geo.getAttribute('uv')?.array as ArrayLike<number> | undefined;
    const c = geo.getAttribute('color')?.array as ArrayLike<number> | undefined;
    const count = p.length / 3;
    const base = this.vertexCount;
    for (let i = 0; i < count; i++) {
      this.pos.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      if (n) this.nor.push(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
      else this.nor.push(0, 1, 0);
      if (uv) this.uvs.push(uv[i * 2], uv[i * 2 + 1]);
      else this.uvs.push(0, 0);
      if (color === null && c) this.col.push(c[i * 3], c[i * 3 + 1], c[i * 3 + 2]);
      else this.col.push(_col.r, _col.g, _col.b);
    }
    const index = geo.getIndex();
    if (index) {
      const ia = index.array as ArrayLike<number>;
      for (let i = 0; i < ia.length; i++) this.idx.push(base + ia[i]);
    } else for (let i = 0; i < count; i++) this.idx.push(base + i);
    geo.dispose();
  }

  /** Append the unit box transformed by `matrix` (no allocation). */
  unitBox(matrix: THREE.Matrix4, color: THREE.ColorRepresentation): void {
    _col.set(color);
    _nm.getNormalMatrix(matrix);
    const e = matrix.elements;
    const ne = _nm.elements;
    const base = this.vertexCount;
    const P = UNIT_BOX.pos;
    const N = UNIT_BOX.nor;
    const U = UNIT_BOX.uv;
    for (let i = 0; i < P.length / 3; i++) {
      const x = P[i * 3];
      const y = P[i * 3 + 1];
      const z = P[i * 3 + 2];
      this.pos.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      const nx = N[i * 3];
      const ny = N[i * 3 + 1];
      const nz = N[i * 3 + 2];
      const tx = ne[0] * nx + ne[3] * ny + ne[6] * nz;
      const ty = ne[1] * nx + ne[4] * ny + ne[7] * nz;
      const tz = ne[2] * nx + ne[5] * ny + ne[8] * nz;
      const l = Math.hypot(tx, ty, tz) || 1;
      this.nor.push(tx / l, ty / l, tz / l);
      this.uvs.push(U[i * 2], U[i * 2 + 1]);
      this.col.push(_col.r, _col.g, _col.b);
    }
    for (const k of UNIT_BOX.idx) this.idx.push(base + k);
  }

  /** Every triangle built so far, its corners in order (for whatever needs to know what's where). */
  eachTriangle(fn: (a: V3, b: V3, c: V3) => void): void {
    const p = this.pos;
    const at = (k: number): V3 => [p[k * 3], p[k * 3 + 1], p[k * 3 + 2]];
    for (let i = 0; i + 2 < this.idx.length; i += 3) fn(at(this.idx[i]), at(this.idx[i + 1]), at(this.idx[i + 2]));
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

export const _m4 = new THREE.Matrix4();
export const _q = new THREE.Quaternion();
export const _e = new THREE.Euler();
export const _v = new THREE.Vector3();
export const _s = new THREE.Vector3();

/** Axis-aligned box from min/max corners. */
export function box(b: GeoBuilder, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: THREE.ColorRepresentation, m?: THREE.Matrix4): void {
  _m4.makeScale(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)).setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (m) _m4.premultiply(m);
  b.unitBox(_m4, color);
}

/** Rounded box from min/max corners (the toy look). */
export function rbox(b: GeoBuilder, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, r: number, color: THREE.ColorRepresentation, m?: THREE.Matrix4, seg = 2): void {
  const g = new RoundedBoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), seg, r);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  b.add(g, color, m);
}

/** Box of size (sx, sy, sz) centred at c, rotated by (rx, ry, rz). */
export function obox(b: GeoBuilder, c: V3, size: V3, rot: V3, color: THREE.ColorRepresentation, m?: THREE.Matrix4): void {
  _m4.compose(_v.set(c[0], c[1], c[2]), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])), _s.set(size[0], size[1], size[2]));
  if (m) _m4.premultiply(m);
  b.unitBox(_m4, color);
}

/** Cylinder between two points. */
export function cyl(b: GeoBuilder, a: V3, c: V3, rTop: number, rBot: number, seg: number, color: THREE.ColorRepresentation, m?: THREE.Matrix4): void {
  const dir = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(rTop, rBot, len, seg);
  _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  _m4.compose(_v.set((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2), _q, _s.set(1, 1, 1));
  if (m) _m4.premultiply(m);
  b.add(g, color, _m4);
}

/** Convex polygon (planar, 3D points) extruded along `dir`, with outward-facing sides. */
export function prism(b: GeoBuilder, poly: V3[], dir: V3, color: THREE.ColorRepresentation, m?: THREE.Matrix4, capColor?: THREE.ColorRepresentation): void {
  const g = new GeoBuilder();
  const top = poly.map((p) => [p[0] + dir[0], p[1] + dir[1], p[2] + dir[2]] as V3);
  const cen: V3 = [0, 0, 0];
  for (const p of poly) for (let k = 0; k < 3; k++) cen[k] += p[k] / poly.length;
  const back: V3 = [-dir[0], -dir[1], -dir[2]];
  for (let i = 1; i < poly.length - 1; i++) {
    g.tri(poly[0], poly[i], poly[i + 1], capColor ?? color, back);
    g.tri(top[0], top[i], top[i + 1], capColor ?? color, dir);
  }
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const mid: V3 = [(poly[i][0] + poly[j][0]) / 2, (poly[i][1] + poly[j][1]) / 2, (poly[i][2] + poly[j][2]) / 2];
    g.quad(poly[i], poly[j], top[j], top[i], color, sub(mid, cen));
  }
  b.add(g.build(), null, m);
}

export function meshOf(b: GeoBuilder, mat: THREE.Material, name: string, cast: boolean, receive: boolean): THREE.Mesh {
  const mesh = new THREE.Mesh(b.build(), mat);
  mesh.name = name;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

export function shade(color: THREE.ColorRepresentation, f: number): THREE.Color {
  return new THREE.Color(color).multiplyScalar(f);
}

/**
 * A flat-topped strip following a polyline of (x, z) points: the top at `top(i)` for each point,
 * from lateral offset d0 to d1 (+ is to the right of the direction of travel). Optional side walls
 * down to `bottom(i)`. UVs: u across (d / uvScale), v along (distance / uvScale).
 */
export function strip(
  b: GeoBuilder,
  pts: { x: number; z: number; tx: number; tz: number }[],
  d0In: number | ((i: number) => number),
  d1In: number | ((i: number) => number),
  top: (i: number) => number,
  color: THREE.ColorRepresentation,
  opts: { uvScale?: number; bottom?: (i: number) => number; sides?: boolean; v0?: number } = {},
): void {
  const uvS = opts.uvScale ?? 1;
  let v = opts.v0 ?? 0;
  const up: V3 = [0, 1, 0];
  // The edges' offsets: fixed, or per point (a road's inside edge pulled in on a tight bend).
  const D0 = typeof d0In === 'number' ? (): number => d0In : d0In;
  const D1 = typeof d1In === 'number' ? (): number => d1In : d1In;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const c = pts[i + 1];
    const ya = top(i);
    const yc = top(i + 1);
    const d0 = D0(i);
    const d1 = D1(i);
    const e0 = D0(i + 1);
    const e1 = D1(i + 1);
    const la0: V3 = [a.x - a.tz * d0, ya, a.z + a.tx * d0];
    const la1: V3 = [a.x - a.tz * d1, ya, a.z + a.tx * d1];
    const lc0: V3 = [c.x - c.tz * e0, yc, c.z + c.tx * e0];
    const lc1: V3 = [c.x - c.tz * e1, yc, c.z + c.tx * e1];
    const seg = Math.hypot(c.x - a.x, c.z - a.z);
    const v1 = v + seg / uvS;
    b.quad(la0, lc0, lc1, la1, color, up, [
      [d0 / uvS, v],
      [e0 / uvS, v1],
      [e1 / uvS, v1],
      [d1 / uvS, v],
    ]);
    if (opts.sides && opts.bottom) {
      const ba = opts.bottom(i);
      const bc = opts.bottom(i + 1);
      for (const [d, e, f] of [
        [d0, e0, -1],
        [d1, e1, 1],
      ] as const) {
        const pa: V3 = [a.x - a.tz * d, ya, a.z + a.tx * d];
        const pc: V3 = [c.x - c.tz * e, yc, c.z + c.tx * e];
        const qa: V3 = [a.x - a.tz * d, ba, a.z + a.tx * d];
        const qc: V3 = [c.x - c.tz * e, bc, c.z + c.tx * e];
        b.quad(pa, pc, qc, qa, color, [-a.tz * f, 0, a.tx * f]);
      }
    }
    v = v1;
  }
}


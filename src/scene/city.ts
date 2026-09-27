// San Francisco street down to the Bay: road, sidewalks, pastel Victorian row houses, cross streets
// with cable-car tracks, a parked cable car, the Embarcadero, the wooden pier and the kicker.
// Everything is procedural and merged by material to keep draw calls low.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TRACK, groundHeightAtX } from '../track';
import { canvasTexture, makeRng } from './util';

export interface City {
  group: THREE.Group;
  update(dt: number, t: number): void;
}

type V3 = [number, number, number];
type UV = [number, number];

// ---------------------------------------------------------------------------------------------
// Layout constants (metres). x runs down the hill, z is to the right when looking along +x.

const T = TRACK;
const INTERSECTIONS = T.segments.filter((s) => s.kind === 'intersection');
const EMB_X0 = T.segments.find((s) => s.kind === 'embarcadero')!.x0;
const SHORE_X = T.shoreX;
const LIP = T.lip;
const KICK_X = T.kickerX;
const DECK_Y = T.deckY;
const START_Y = T.startY;

const ROAD_HALF = 7;
const WALK_OUT = 10;
const CURB = 0.18;
const HOUSE_DEPTH = 12;
const CROSS_WALK = 3;
const CROSS_EXTENT = 300;
const WEST_X = -60;
const TOP_STREET: [number, number] = [-72, -60];
const PARALLEL_Z: [number, number] = [81, 91];
const LAND_Z = 700;
const LAND_X0 = -600;
const SEAWALL_T = 1.2;
const PROMENADE_X = SHORE_X - 5;
const MEDIAN: [number, number] = [EMB_X0 + 11, EMB_X0 + 15];
const PIER_HALF = 8;
const KICKER_HALF = 7;

/** Ground height (flat along z). The kicker is not part of the ground. */
function gy(x: number): number {
  return groundHeightAtX(T, Math.min(x, SHORE_X));
}

const PROFILE_XS = [
  ...new Set(T.segments.filter((s) => s.x1 <= SHORE_X + 1e-6).flatMap((s) => [s.x0, s.x1])),
].sort((a, b) => a - b);

/** x breakpoints of the piecewise-linear ground profile within [x0, x1]. */
function profileXs(x0: number, x1: number): number[] {
  return [x0, ...PROFILE_XS.filter((x) => x > x0 + 1e-6 && x < x1 - 1e-6), x1];
}

/** Arc length along the ground profile (for texture mapping without stretch on the slopes). */
function arcAt(x: number): number {
  if (x <= 0) return x;
  for (const seg of T.segments) {
    if (x <= seg.x1 || seg === T.segments[T.segments.length - 1]) {
      return seg.s0 + (x - seg.x0) / Math.cos(seg.angle);
    }
  }
  return x;
}

// ---------------------------------------------------------------------------------------------
// Geometry accumulation: every static piece is appended into one builder per material.

const _col = new THREE.Color();

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm(a: V3): V3 {
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

class GeoBuilder {
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

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Axis-aligned box from min/max corners. */
function box(b: GeoBuilder, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: THREE.ColorRepresentation, m?: THREE.Matrix4): void {
  _m4.makeScale(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)).setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (m) _m4.premultiply(m);
  b.unitBox(_m4, color);
}

/** Rounded box from min/max corners (the toy look). */
function rbox(b: GeoBuilder, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, r: number, color: THREE.ColorRepresentation, m?: THREE.Matrix4, seg = 2): void {
  const g = new RoundedBoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), seg, r);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  b.add(g, color, m);
}

/** Box of size (sx, sy, sz) centred at c, rotated by (rx, ry, rz). */
function obox(b: GeoBuilder, c: V3, size: V3, rot: V3, color: THREE.ColorRepresentation, m?: THREE.Matrix4): void {
  _m4.compose(_v.set(c[0], c[1], c[2]), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])), _s.set(size[0], size[1], size[2]));
  if (m) _m4.premultiply(m);
  b.unitBox(_m4, color);
}

/** Cylinder between two points. */
function cyl(b: GeoBuilder, a: V3, c: V3, rTop: number, rBot: number, seg: number, color: THREE.ColorRepresentation, m?: THREE.Matrix4): void {
  const dir = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(rTop, rBot, len, seg);
  _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  _m4.compose(_v.set((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2), _q, _s.set(1, 1, 1));
  if (m) _m4.premultiply(m);
  b.add(g, color, _m4);
}

/**
 * A solid slab over [x0,x1]×[z0,z1] whose top follows `top(x)` along the ground profile.
 * UVs: top uses (z, arc length) / uvScale, sides use (arc length or z, y) / uvScale.
 */
function slab(
  b: GeoBuilder,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  top: (x: number) => number,
  bottom: (x: number) => number,
  color: THREE.ColorRepresentation,
  uvScale = 1,
  sides = true,
): void {
  const xs = profileXs(x0, x1);
  const up: V3 = [0, 1, 0];
  for (let i = 0; i < xs.length - 1; i++) {
    const xa = xs[i];
    const xb = xs[i + 1];
    const ya = top(xa);
    const yb = top(xb);
    const sa = arcAt(xa) / uvScale;
    const sb = arcAt(xb) / uvScale;
    b.quad([xa, ya, z1], [xb, yb, z1], [xb, yb, z0], [xa, ya, z0], color, up, [
      [z1 / uvScale, sa],
      [z1 / uvScale, sb],
      [z0 / uvScale, sb],
      [z0 / uvScale, sa],
    ]);
    if (!sides) continue;
    const ba = bottom(xa);
    const bb = bottom(xb);
    for (const [z, f] of [
      [z1, 1],
      [z0, -1],
    ] as const) {
      b.quad([xa, ya, z], [xa, ba, z], [xb, bb, z], [xb, yb, z], color, [0, 0, f], [
        [sa, ya / uvScale],
        [sa, ba / uvScale],
        [sb, bb / uvScale],
        [sb, yb / uvScale],
      ]);
    }
  }
  if (!sides) return;
  for (const [x, f] of [
    [x0, -1],
    [x1, 1],
  ] as const) {
    const yt = top(x);
    const yb = bottom(x);
    b.quad([x, yt, z0], [x, yb, z0], [x, yb, z1], [x, yt, z1], color, [f, 0, 0], [
      [z0 / uvScale, yt / uvScale],
      [z0 / uvScale, yb / uvScale],
      [z1 / uvScale, yb / uvScale],
      [z1 / uvScale, yt / uvScale],
    ]);
  }
}

/** Convex polygon (planar, 3D points) extruded along `dir`, with outward-facing sides. */
function prism(b: GeoBuilder, poly: V3[], dir: V3, color: THREE.ColorRepresentation, m?: THREE.Matrix4, capColor?: THREE.ColorRepresentation): void {
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

function meshOf(b: GeoBuilder, mat: THREE.Material, name: string, cast: boolean, receive: boolean): THREE.Mesh {
  const mesh = new THREE.Mesh(b.build(), mat);
  mesh.name = name;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

// ---------------------------------------------------------------------------------------------
// Canvas textures.

function wrapDraw(w: number, h: number, draw: (ox: number, oy: number) => void): void {
  for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) draw(ox, oy);
}

function asphaltTexture(): THREE.CanvasTexture {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#5a6069';
      ctx.fillRect(0, 0, w, h);
      const rng = makeRng(11);
      // Very faint tar patches so the surface isn't flat, without reading as stains.
      for (let i = 0; i < 5; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const rx = 40 + rng() * 60;
        const ry = 25 + rng() * 40;
        const rot = rng() * Math.PI;
        wrapDraw(w, h, (ox, oy) => {
          ctx.fillStyle = 'rgba(30,32,38,0.035)';
          ctx.beginPath();
          ctx.ellipse(x + ox, y + oy, rx, ry, rot, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      for (let i = 0; i < 14000; i++) {
        const g = 60 + ((rng() * 90) | 0);
        ctx.fillStyle = `rgba(${g},${g},${g + 8},${0.25 + rng() * 0.4})`;
        const s = rng() < 0.9 ? 1 : 2;
        ctx.fillRect(rng() * w, rng() * h, s, s);
      }
    },
    { repeat: [1, 1] },
  );
}

function facadeTexture(): THREE.CanvasTexture {
  // One tile = 4 m wide × 3.2 m tall (one window per floor); white walls get tinted by vertex colours.
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      // floor line
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(0, h - 10, w, 10);
      const wx = 64;
      const wy = 44;
      const ww = 128;
      const wh = 150;
      ctx.fillStyle = 'rgba(40,30,30,0.35)';
      ctx.fillRect(wx - 12, wy - 12, ww + 24, wh + 24);
      ctx.fillStyle = '#fbfbf7';
      ctx.fillRect(wx - 9, wy - 9, ww + 18, wh + 18);
      const grad = ctx.createLinearGradient(0, wy, 0, wy + wh);
      grad.addColorStop(0, '#6f8fb3');
      grad.addColorStop(0.5, '#2d3f5c');
      grad.addColorStop(1, '#22304a');
      ctx.fillStyle = grad;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = '#fbfbf7';
      ctx.fillRect(wx + ww / 2 - 4, wy, 8, wh);
      ctx.fillRect(wx, wy + wh * 0.42, ww, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(wx + 10, wy + wh);
      ctx.lineTo(wx + 50, wy);
      ctx.lineTo(wx + 70, wy);
      ctx.lineTo(wx + 30, wy + wh);
      ctx.fill();
      // sill
      ctx.fillStyle = '#fbfbf7';
      ctx.fillRect(wx - 16, wy + wh + 10, ww + 32, 10);
    },
    { repeat: [1, 1] },
  );
}

function plankTexture(): THREE.CanvasTexture {
  // Tile: 4 m across the pier (u) × 2 m along it (v): 8 planks of 0.25 m running across the pier.
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const rng = makeRng(23);
      const n = 8;
      const ph = h / n;
      for (let i = 0; i < n; i++) {
        const base = 150 + rng() * 40;
        ctx.fillStyle = `rgb(${base + 35},${base - 10},${base - 55})`;
        ctx.fillRect(0, i * ph, w, ph);
        for (let k = 0; k < 26; k++) {
          const y = i * ph + 4 + rng() * (ph - 8);
          ctx.strokeStyle = `rgba(90,50,20,${0.08 + rng() * 0.12})`;
          ctx.lineWidth = 1 + rng() * 1.5;
          ctx.beginPath();
          ctx.moveTo(0, y);
          for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + k) * 1.5);
          ctx.stroke();
        }
        // plank seam
        ctx.fillStyle = 'rgba(55,30,15,0.8)';
        ctx.fillRect(0, i * ph, w, 3);
        // butt joint and nails
        const jx = rng() * w;
        ctx.fillRect(jx, i * ph, 3, ph);
        ctx.fillStyle = 'rgba(60,60,60,0.8)';
        for (const nx of [jx - 10, jx + 12, (jx + w / 2) % w]) {
          ctx.fillRect(nx, i * ph + 12, 4, 4);
          ctx.fillRect(nx, i * ph + ph - 16, 4, 4);
        }
      }
    },
    { repeat: [1, 1] },
  );
}

function plywoodTexture(): THREE.CanvasTexture {
  // Tile = one 2.44 m × 1.22 m sheet.
  return canvasTexture(
    1024,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#e2c08a';
      ctx.fillRect(0, 0, w, h);
      const rng = makeRng(5);
      for (let i = 0; i < 70; i++) {
        const y = rng() * h;
        const amp = 6 + rng() * 22;
        const f = 0.004 + rng() * 0.01;
        ctx.strokeStyle = `rgba(${150 + rng() * 40},${95 + rng() * 30},${45},${0.12 + rng() * 0.18})`;
        ctx.lineWidth = 1 + rng() * 3;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) {
          const yy = y + Math.sin(x * f + i) * amp;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(120,70,30,0.25)';
        ctx.beginPath();
        ctx.ellipse(rng() * w, rng() * h, 8 + rng() * 10, 4 + rng() * 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(90,55,25,0.75)';
      ctx.lineWidth = 5;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = 'rgba(70,70,70,0.7)';
      for (let x = 24; x < w; x += 96) {
        for (const y of [18, h / 2, h - 18]) ctx.fillRect(x, y - 3, 6, 6);
      }
    },
    { repeat: [1, 1] },
  );
}

function stripeTexture(): THREE.CanvasTexture {
  // One tile = 1 m: a yellow and a black diagonal band.
  return canvasTexture(
    256,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#ffcc12';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1b1b1f';
      for (let k = -2; k < 3; k++) {
        const x = k * w;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, 0);
        ctx.lineTo(x + w, 0);
        ctx.lineTo(x + w * 0.5 + h * 0.9, h);
        ctx.lineTo(x + h * 0.9, h);
        ctx.closePath();
        ctx.fill();
      }
    },
    { repeat: [1, 1] },
  );
}

function checkerTexture(cols: number, rows: number): THREE.CanvasTexture {
  return canvasTexture(
    cols * 32,
    rows * 32,
    (ctx) => {
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          ctx.fillStyle = (i + j) % 2 === 0 ? '#f7f7f2' : '#17171b';
          ctx.fillRect(i * 32, j * 32, 32, 32);
        }
      }
    },
    { anisotropy: 8 },
  );
}

function bannerTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 160, (ctx, w, h) => {
    ctx.fillStyle = '#e8322a';
    ctx.fillRect(0, 0, w, h);
    const sq = 16;
    for (let i = 0; i < w / sq; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#17171b' : '#f7f7f2';
        ctx.fillRect(i * sq, j * sq, sq, sq);
        ctx.fillRect(i * sq, h - (j + 1) * sq, sq, sq);
      }
    }
    ctx.font = '900 88px "Arial Rounded MT Bold", "Arial Black", "Helvetica Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#7a1210';
    ctx.strokeText('LA VOITURE', w / 2, h / 2 + 4);
    ctx.fillStyle = '#fff6e0';
    ctx.fillText('LA VOITURE', w / 2, h / 2 + 4);
  });
}

function signTexture(text: string, bg: string, fg: string, w = 512, h = 96): THREE.CanvasTexture {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.font = `900 ${Math.round(h * 0.52)}px "Arial Rounded MT Bold", "Arial Black", "Helvetica Neue", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fg;
    ctx.fillText(text, w / 2, h / 2 + 3);
  });
}

function laneLabelTexture(): THREE.CanvasTexture {
  // Left half "P1", right half "P2": painted on the road behind the start line.
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = '900 190px "Arial Rounded MT Bold", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f7f7f2';
    ctx.fillText('P1', w * 0.25, h / 2 + 8);
    ctx.fillText('P2', w * 0.75, h / 2 + 8);
  });
}

const STREET_NAMES = ['HYDE ST', 'LOMBARD ST', 'CHESTNUT ST', 'BAY ST'];

function streetSignTexture(): THREE.CanvasTexture {
  const rows = STREET_NAMES.length;
  return canvasTexture(512, 64 * rows, (ctx, w) => {
    STREET_NAMES.forEach((name, r) => {
      const y = r * 64;
      ctx.fillStyle = '#12704a';
      ctx.fillRect(0, y, w, 64);
      ctx.strokeStyle = '#f4f4ee';
      ctx.lineWidth = 4;
      ctx.strokeRect(5, y + 5, w - 10, 54);
      ctx.font = '800 38px "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f4f4ee';
      ctx.fillText(name, w / 2, y + 34);
    });
  });
}

/** A street-name plate: `alongZ` plates face ±x (readable from the main street). */
function signPlate(row: number, alongZ: boolean): THREE.BufferGeometry {
  const rows = STREET_NAMES.length;
  const g = alongZ ? new THREE.BoxGeometry(0.05, 0.32, 1.6) : new THREE.BoxGeometry(1.6, 0.32, 0.05);
  const n = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  const v0 = 1 - (row + 1) / rows;
  const v1 = 1 - row / rows;
  for (let i = 0; i < uv.count; i++) {
    const face = alongZ ? Math.abs(n.getX(i)) > 0.5 : Math.abs(n.getZ(i)) > 0.5;
    if (face) uv.setXY(i, uv.getX(i), v0 + uv.getY(i) * (v1 - v0));
    else uv.setXY(i, 0.01, (v0 + v1) / 2);
  }
  return g;
}

// ---------------------------------------------------------------------------------------------
// Palettes.

const HOUSE_COLORS = [
  '#62cfa3', // mint
  '#ffa274', // peach
  '#ab8ef0', // lavender
  '#ffd154', // butter
  '#68b6f2', // sky
  '#ff8db6', // pink
  '#9dcc66', // sage
  '#ff7d66', // coral
  '#58c8c1', // aqua
  '#e592d6', // orchid
  '#f4b64c', // apricot
  '#8aa0f5', // periwinkle
];
const TRIM = '#fffaf0';
const ACCENTS = ['#2f6f8f', '#8a2d4a', '#3d5a80', '#c9a227', '#6b4c9a', '#2e7d6b', '#d9534f'];
const DOORS = ['#b3263a', '#1f3d6b', '#2f6b4f', '#7a4a2a', '#f2c14e', '#5b3a82', '#0f7c7c'];
const ROOF = '#8d9199';
const CONCRETE = '#dcd6c9';
const DARK_WOOD = '#5c4633';
const PINE = '#d6ab70';

function shade(color: string, f: number): THREE.Color {
  const c = new THREE.Color(color);
  return c.multiplyScalar(f);
}

// ---------------------------------------------------------------------------------------------
// Houses.

interface HouseSinks {
  walls: GeoBuilder;
  trim: GeoBuilder;
  glass: GeoBuilder;
}

interface Face {
  /** Face start point in house-local (u, w). */
  ou: number;
  ow: number;
  /** Unit direction along the face in (u, w). */
  du: number;
  dw: number;
  /** Outward normal in (u, w). */
  nu: number;
  nw: number;
  /** Rotation about y that maps the box x-axis onto the face direction. */
  rotY: number;
}

const MAIN_FACE: Face = { ou: 0, ow: 0, du: 1, dw: 0, nu: 0, nw: -1, rotY: 0 };

/** Box on a face: along-face [a0,a1], height [y0,y1], out from the face [c0,c1]. */
function faceBox(b: GeoBuilder, m: THREE.Matrix4, f: Face, a0: number, a1: number, y0: number, y1: number, c0: number, c1: number, color: THREE.ColorRepresentation): void {
  const a = (a0 + a1) / 2;
  const c = (c0 + c1) / 2;
  const cu = f.ou + f.du * a + f.nu * c;
  const cw = f.ow + f.dw * a + f.nw * c;
  obox(b, [cu, (y0 + y1) / 2, cw], [a1 - a0, y1 - y0, c1 - c0], [0, f.rotY, 0], color, m);
}

function faceWindow(s: HouseSinks, m: THREE.Matrix4, f: Face, a0: number, a1: number, y0: number, y1: number, hood: THREE.ColorRepresentation, arched = false): void {
  const w = a1 - a0;
  faceBox(s.trim, m, f, a0 - 0.14, a1 + 0.14, y0 - 0.12, y1 + 0.12, -0.02, 0.07, TRIM);
  faceBox(s.glass, m, f, a0, a1, y0, y1, 0.0, 0.1, '#ffffff');
  faceBox(s.trim, m, f, a0 + w / 2 - 0.035, a0 + w / 2 + 0.035, y0, y1, 0.0, 0.13, TRIM);
  faceBox(s.trim, m, f, a0, a1, y0 + (y1 - y0) * 0.58 - 0.035, y0 + (y1 - y0) * 0.58 + 0.035, 0.0, 0.13, TRIM);
  faceBox(s.trim, m, f, a0 - 0.26, a1 + 0.26, y0 - 0.26, y0 - 0.12, -0.02, 0.24, TRIM);
  if (arched) {
    faceBox(s.trim, m, f, a0 - 0.3, a1 + 0.3, y1 + 0.12, y1 + 0.3, -0.02, 0.26, hood);
    faceBox(s.trim, m, f, a0 - 0.1, a1 + 0.1, y1 + 0.3, y1 + 0.46, -0.02, 0.2, hood);
  } else {
    faceBox(s.trim, m, f, a0 - 0.3, a1 + 0.3, y1 + 0.12, y1 + 0.3, -0.02, 0.28, hood);
  }
}

/** Plain framed window (backs and side walls). */
function simpleWindow(s: HouseSinks, m: THREE.Matrix4, f: Face, a0: number, a1: number, y0: number, y1: number): void {
  faceBox(s.trim, m, f, a0 - 0.12, a1 + 0.12, y0 - 0.12, y1 + 0.12, -0.02, 0.06, TRIM);
  faceBox(s.glass, m, f, a0, a1, y0, y1, 0.0, 0.09, '#ffffff');
  faceBox(s.trim, m, f, a0 - 0.2, a1 + 0.2, y0 - 0.24, y0 - 0.12, -0.02, 0.18, TRIM);
}

/** Rows of plain windows along a wall face of length `len`, one row per floor. */
function wallWindows(s: HouseSinks, m: THREE.Matrix4, f: Face, len: number, yb: number, floors: number, fh: number, spacing: number): void {
  const n = Math.max(1, Math.floor((len - 1) / spacing));
  const step = len / n;
  for (let fl = 0; fl < floors; fl++) {
    const y0 = yb + fl * fh + 0.9;
    for (let k = 0; k < n; k++) {
      const a = step * (k + 0.5);
      simpleWindow(s, m, f, a - 0.5, a + 0.5, y0, y0 + 1.6);
    }
  }
}

function buildHouse(
  s: HouseSinks,
  x0: number,
  x1: number,
  side: 1 | -1,
  rng: () => number,
  exposeUphill = false,
  exposeDownhill = false,
): void {
  const W = x1 - x0;
  const D = HOUSE_DEPTH;
  const m = new THREE.Matrix4();
  if (side > 0) m.makeTranslation(x0, 0, WALK_OUT);
  else m.makeRotationY(Math.PI).setPosition(x1, 0, -WALK_OUT);
  const uToX = (u: number): number => (side > 0 ? x0 + u : x1 - u);

  const color = HOUSE_COLORS[Math.floor(rng() * HOUSE_COLORS.length)];
  const accent = ACCENTS[Math.floor(rng() * ACCENTS.length)];
  const trimAccent = rng() < 0.45 ? accent : TRIM;
  const floors = rng() < 0.3 ? 2 : 3;
  const fh = 3.1;
  const queenAnne = rng() < 0.45;
  const yb = gy(x0) + CURB + 0.35;
  const yFound = gy(x1) + CURB - 0.5;
  const wallTop = yb + floors * fh + (queenAnne ? 0.25 : 1.25);

  // Foundation / garage plinth and the main body.
  box(s.walls, 0.06, W - 0.06, yFound, yb + 0.02, 0.1, D, shade(color, 0.72), m);
  rbox(s.walls, 0, W, yb, wallTop, 0, D, 0.22, color, m);
  // Roof membrane seen from above.
  box(s.walls, 0.3, W - 0.3, wallTop - 0.02, wallTop + 0.04, queenAnne ? 6 : 0.9, D - 0.3, ROOF, m);
  if (rng() < 0.35) {
    const cu = 0.8 + rng() * (W - 2);
    box(s.walls, cu, cu + 0.7, wallTop, wallTop + 1.1, D - 3, D - 2.2, '#b4574a', m);
  }

  // Back wall windows, and side windows where the house faces a cross street.
  wallWindows(s, m, { ou: W, ow: D, du: -1, dw: 0, nu: 0, nw: 1, rotY: Math.PI }, W, yb, floors, fh, 2.6);
  const sideLeft: Face = { ou: 0, ow: D, du: 0, dw: -1, nu: -1, nw: 0, rotY: Math.PI / 2 };
  const sideRight: Face = { ou: W, ow: 0, du: 0, dw: 1, nu: 1, nw: 0, rotY: -Math.PI / 2 };
  // Local u=0 is the uphill end on the right-hand side and the downhill end on the left-hand side.
  const exposeU0 = side > 0 ? exposeUphill : exposeDownhill;
  const exposeUW = side > 0 ? exposeDownhill : exposeUphill;
  if (exposeU0) wallWindows(s, m, sideLeft, D, yb, floors, fh, 3.0);
  if (exposeUW) wallWindows(s, m, sideRight, D, yb, floors, fh, 3.0);

  // Ground floor: door with stoop, plus a garage door or a window.
  const doorLeft = rng() < 0.5;
  const da0 = doorLeft ? 0.55 : W - 1.65;
  const da1 = da0 + 1.1;
  const doorColor = DOORS[Math.floor(rng() * DOORS.length)];
  faceBox(s.trim, m, MAIN_FACE, da0 - 0.18, da1 + 0.18, yb, yb + 2.55, -0.02, 0.08, TRIM);
  faceBox(s.trim, m, MAIN_FACE, da0, da1, yb, yb + 2.3, 0.0, 0.1, doorColor);
  faceBox(s.glass, m, MAIN_FACE, da0 + 0.1, da1 - 0.1, yb + 2.34, yb + 2.5, 0.0, 0.11, '#ffffff');
  faceBox(s.trim, m, MAIN_FACE, da0 - 0.35, da1 + 0.35, yb + 2.6, yb + 2.78, -0.02, 0.5, trimAccent);
  // Stoop down to the sidewalk (the sidewalk drops along the facade on the slope).
  const doorX = uToX((da0 + da1) / 2);
  const walk = gy(doorX) + CURB;
  const rise = Math.max(0.2, yb - walk);
  const steps = Math.max(1, Math.round(rise / 0.2));
  for (let k = 0; k < steps; k++) {
    const yTop = yb - k * (rise / steps);
    faceBox(s.trim, m, MAIN_FACE, da0 - 0.15, da1 + 0.15, walk - 0.1, yTop, 0, 0.32 * (k + 1), '#ece6da');
  }

  const other0 = doorLeft ? 2.1 : 0.5;
  const other1 = doorLeft ? W - 0.5 : W - 2.1;
  if (rng() < 0.55 && other1 - other0 > 2.6) {
    // Garage door with panel grooves.
    const g0 = other0 + 0.2;
    const g1 = Math.min(other1 - 0.2, g0 + 2.7);
    faceBox(s.trim, m, MAIN_FACE, g0 - 0.15, g1 + 0.15, yb, yb + 2.45, -0.02, 0.08, TRIM);
    faceBox(s.trim, m, MAIN_FACE, g0, g1, yb, yb + 2.3, 0, 0.1, '#f3efe6');
    for (let k = 1; k < 4; k++) {
      faceBox(s.trim, m, MAIN_FACE, g0, g1, yb + k * 0.57 - 0.03, yb + k * 0.57 + 0.03, 0, 0.12, '#cfc8ba');
    }
  } else {
    const wa = (other0 + other1) / 2;
    faceWindow(s, m, MAIN_FACE, wa - 0.55, wa + 0.55, yb + 0.9, yb + 2.5, trimAccent);
  }

  // Bay window over the upper floors on the side opposite the door.
  const bayW = Math.min(3.4, W * 0.5);
  const b0 = doorLeft ? W - 0.45 - bayW : 0.45;
  const b1 = b0 + bayW;
  const dB = 0.85;
  const bayY0 = yb + fh - 0.25;
  const bayY1 = yb + floors * fh - 0.1;
  const bayColor = rng() < 0.3 ? shade(color, 0.93) : new THREE.Color(color);
  prism(
    s.walls,
    [
      [b0, bayY0, 0],
      [b0 + dB, bayY0, -dB],
      [b1 - dB, bayY0, -dB],
      [b1, bayY0, 0],
    ],
    [0, bayY1 - bayY0, 0],
    bayColor,
    m,
  );
  // Bay cap and corbel.
  prism(
    s.trim,
    [
      [b0 - 0.25, bayY1, 0],
      [b0 + dB - 0.1, bayY1, -dB - 0.28],
      [b1 - dB + 0.1, bayY1, -dB - 0.28],
      [b1 + 0.25, bayY1, 0],
    ],
    [0, 0.32, 0],
    trimAccent,
    m,
  );
  prism(
    s.trim,
    [
      [b0 + 0.1, bayY0 - 0.3, 0],
      [b0 + dB, bayY0 - 0.3, -dB + 0.1],
      [b1 - dB, bayY0 - 0.3, -dB + 0.1],
      [b1 - 0.1, bayY0 - 0.3, 0],
    ],
    [0, 0.3, 0],
    TRIM,
    m,
  );
  const r2 = Math.SQRT1_2;
  const faces: [Face, number][] = [
    [{ ou: b0 + dB, ow: -dB, du: 1, dw: 0, nu: 0, nw: -1, rotY: 0 }, bayW - 2 * dB],
    [{ ou: b0, ow: 0, du: r2, dw: -r2, nu: -r2, nw: -r2, rotY: Math.PI / 4 }, dB * Math.SQRT2],
    [{ ou: b1 - dB, ow: -dB, du: r2, dw: r2, nu: r2, nw: -r2, rotY: -Math.PI / 4 }, dB * Math.SQRT2],
  ];
  for (let fl = 1; fl < floors; fl++) {
    const y0 = yb + fl * fh + 0.55;
    const y1 = y0 + 1.85;
    for (const [f, len] of faces) {
      const inset = len > 1.4 ? 0.3 : 0.2;
      faceWindow(s, m, f, inset, len - inset, y0, y1, trimAccent, !queenAnne && f === faces[0][0]);
    }
    // Flat window beside the bay, above the door.
    const wa = doorLeft ? (0.3 + b0) / 2 : (b1 + W - 0.3) / 2;
    if (Math.abs((doorLeft ? b0 : W - b1) - 0.3) > 1.3) {
      faceWindow(s, m, MAIN_FACE, wa - 0.5, wa + 0.5, y0, y1, trimAccent, !queenAnne);
    }
    // Floor band.
    faceBox(s.trim, m, MAIN_FACE, 0, W, yb + fl * fh - 0.1, yb + fl * fh + 0.1, -0.02, 0.12, TRIM);
  }

  if (queenAnne) {
    // Front gable facing the street with an attic window and trimmed eaves.
    const gh = W * 0.42;
    const eave = wallTop;
    prism(
      s.walls,
      [
        [0.05, eave, 0],
        [W - 0.05, eave, 0],
        [W / 2, eave + gh, 0],
      ],
      [0, 0, 6.2],
      color,
      m,
    );
    const ang = Math.atan2(gh, W / 2);
    const len = Math.hypot(W / 2, gh) + 0.5;
    for (const sgn of [-1, 1]) {
      const cu = W / 2 + (sgn * (W / 2)) / 2;
      const cy = eave + gh / 2 + 0.12;
      obox(s.walls, [cu, cy + 0.12, 2.9], [len, 0.16, 6.9], [0, 0, -sgn * ang], ROOF, m);
      obox(s.trim, [cu, cy, -0.38], [len, 0.26, 0.2], [0, 0, -sgn * ang], trimAccent, m);
    }
    faceWindow(s, m, MAIN_FACE, W / 2 - 0.45, W / 2 + 0.45, eave + 0.45, eave + Math.min(1.6, gh - 0.5), trimAccent);
    faceBox(s.trim, m, MAIN_FACE, -0.1, W + 0.1, eave - 0.3, eave, -0.02, 0.35, trimAccent);
    // Fish-scale shingle band.
    faceBox(s.walls, m, MAIN_FACE, 0.2, W - 0.2, eave - 1.0, eave - 0.3, -0.02, 0.06, shade(color, 0.88));
  } else {
    // Italianate: bracketed cornice over a frieze, parapet above the roof.
    faceBox(s.trim, m, MAIN_FACE, -0.1, W + 0.1, wallTop - 0.5, wallTop, -0.02, 0.62, TRIM);
    faceBox(s.trim, m, MAIN_FACE, 0, W, wallTop - 1.15, wallTop - 0.5, -0.02, 0.1, accent);
    const n = Math.max(3, Math.round(W / 1.1));
    for (let k = 0; k <= n; k++) {
      const a = 0.25 + (k * (W - 0.5)) / n;
      faceBox(s.trim, m, MAIN_FACE, a - 0.11, a + 0.11, wallTop - 1.0, wallTop - 0.5, -0.02, 0.5, TRIM);
    }
  }
}

function buildHouses(s: HouseSinks, rng: () => number): void {
  const blocks: [number, number][] = [];
  let prev = TOP_STREET[1];
  for (const seg of INTERSECTIONS) {
    blocks.push([prev + CROSS_WALK, seg.x0 - CROSS_WALK]);
    prev = seg.x1;
  }
  for (const [xa, xb] of blocks) {
    for (const side of [1, -1] as const) {
      const widths: number[] = [];
      let total = 0;
      while (total < xb - xa - 6) {
        const w = 6 + rng() * 2;
        widths.push(w);
        total += w;
      }
      const scale = (xb - xa) / total;
      let x = xa;
      widths.forEach((w, i) => {
        const ww = w * scale;
        buildHouse(s, x, x + ww, side, rng, i === 0, i === widths.length - 1);
        x += ww;
      });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Background city blocks: pastel boxes with a tiled window texture.

function worldUvBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  const floorY = y1 - Math.floor((y1 - y0) / 3.2) * 3.2;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i));
    const along = nx > 0.5 ? p.getZ(i) : p.getX(i);
    uv.setXY(i, along / 4, (p.getY(i) - floorY) / 3.2);
  }
  return g;
}

function buildBackground(walls: GeoBuilder, roofs: GeoBuilder, trees: GeoBuilder, rng: () => number): void {
  // x ranges between cross streets (and the top street), each split into lots.
  const ranges: [number, number][] = [[-300, TOP_STREET[0] - 3]];
  let prev = TOP_STREET[1];
  for (const seg of INTERSECTIONS) {
    ranges.push([prev + 3, seg.x0 - 3]);
    prev = seg.x1;
  }
  // Rows (|z| bands) of buildings behind the main-street houses, facing the parallel streets.
  const rows: [number, number, number, number][] = [
    // [zNear, zFar, minH, maxH]
    [PARALLEL_Z[0] - 18, PARALLEL_Z[0] - 3, 8, 15],
    [PARALLEL_Z[1] + 3, PARALLEL_Z[1] + 17, 9, 18],
    [PARALLEL_Z[1] + 26, PARALLEL_Z[1] + 44, 10, 22],
    [PARALLEL_Z[1] + 56, PARALLEL_Z[1] + 76, 10, 24],
  ];
  for (const [xa, xb] of ranges) {
    for (const side of [1, -1]) {
      for (const [zn, zf, h0, h1] of rows) {
        let x = xa;
        while (x < xb - 4) {
          const w = Math.min(xb - x, 7 + rng() * 7);
          const bx0 = x + 0.15;
          const bx1 = x + w - 0.15;
          const hi = gy(bx0) + CURB;
          const lo = gy(bx1) - 0.5;
          const hgt = h0 + rng() * (h1 - h0);
          const depth = (zf - zn) * (0.75 + rng() * 0.25);
          const z0 = side > 0 ? zn : -zn - depth;
          const z1 = side > 0 ? zn + depth : -zn;
          const color = shade(HOUSE_COLORS[Math.floor(rng() * HOUSE_COLORS.length)], 0.95);
          walls.add(worldUvBox(bx0, bx1, lo, hi + hgt, z0, z1), color);
          box(roofs, bx0 + 0.3, bx1 - 0.3, hi + hgt - 0.02, hi + hgt + 0.08, z0 + 0.3, z1 - 0.3, ROOF);
          if (rng() < 0.3) {
            const cx = bx0 + 1 + rng() * (bx1 - bx0 - 3);
            const cz = z0 + 1 + rng() * (z1 - z0 - 3);
            box(roofs, cx, cx + 1.4, hi + hgt, hi + hgt + 1.2, cz, cz + 1.4, '#9aa0a8');
          }
          x += w;
        }
      }
      // Backyard trees between the main-street houses and the next row.
      for (let x = xa + 4; x < xb - 3; x += 9 + rng() * 8) {
        const z = side * (WALK_OUT + HOUSE_DEPTH + 6 + rng() * 30);
        tree(trees, x, gy(x) - 0.4, z, 1.1 + rng() * 0.9, rng);
      }
    }
  }
  // Waterfront blocks along the Embarcadero beyond the grid (seen behind the pier in the side view).
  const lastX0 = INTERSECTIONS[INTERSECTIONS.length - 1].x0;
  const lastX1Prev = INTERSECTIONS[INTERSECTIONS.length - 2].x1;
  for (const side of [1, -1]) {
    for (const [x0, x1] of [
      [lastX0 - 26, lastX0 - 3],
      [lastX1Prev + 3, lastX1Prev + 24],
    ] as const) {
      let z = PARALLEL_Z[1] + 80;
      while (z < 440) {
        const w = 14 + rng() * 10;
        const hgt = 7 + rng() * 9;
        const top = gy(x0) + CURB + hgt;
        const z0 = side > 0 ? z : -z - w;
        const z1 = side > 0 ? z + w : -z;
        const color = shade(HOUSE_COLORS[Math.floor(rng() * HOUSE_COLORS.length)], 0.95);
        walls.add(worldUvBox(x0, x1, gy(x1) - 0.5, top, z0, z1), color);
        box(roofs, x0 + 0.3, x1 - 0.3, top - 0.02, top + 0.08, z0 + 0.3, z1 - 0.3, ROOF);
        z += w + 2 + rng() * 4;
      }
    }
  }
}

function tree(b: GeoBuilder, x: number, y: number, z: number, s: number, rng: () => number): void {
  cyl(b, [x, y, z], [x, y + 2.2 * s, z], 0.13 * s, 0.18 * s, 6, '#7a5a3c');
  const greens = ['#4fae5a', '#5cbf63', '#3f9c56', '#6cc56a'];
  const g = new THREE.IcosahedronGeometry(1.35 * s, 0);
  g.translate(x, y + 3.0 * s, z);
  b.add(g, greens[Math.floor(rng() * greens.length)]);
  const g2 = new THREE.IcosahedronGeometry(0.95 * s, 0);
  g2.translate(x + 0.5 * s, y + 3.8 * s, z - 0.3 * s);
  b.add(g2, greens[Math.floor(rng() * greens.length)]);
}

function palm(b: GeoBuilder, x: number, y: number, z: number, h: number, rng: () => number): void {
  // Slightly curved trunk from stacked tapered segments.
  const lean = (rng() - 0.5) * 0.5;
  const leanZ = (rng() - 0.5) * 0.5;
  let px = x;
  let pz = z;
  let py = y;
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const t = (i + 1) / segs;
    const nx = x + lean * t * t * h * 0.3;
    const nz = z + leanZ * t * t * h * 0.3;
    const ny = y + h * t;
    cyl(b, [px, py, pz], [nx, ny, nz], 0.2 - 0.02 * (i + 1), 0.22 - 0.02 * i, 7, i % 2 ? '#8a6f52' : '#7b624a');
    px = nx;
    py = ny;
    pz = nz;
  }
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rng() * 0.3;
    const g = new THREE.ConeGeometry(0.42, 3.4, 4);
    g.scale(1, 1, 0.22);
    g.translate(0, 1.7, 0);
    // Tip outwards and droop.
    _m4.compose(
      _v.set(px, py, pz),
      _q.setFromEuler(_e.set(0, a, -(Math.PI / 2) * (0.62 + rng() * 0.25), 'YXZ')),
      _s.set(1, 1, 1),
    );
    b.add(g, i % 2 ? '#3f9f4a' : '#52b457', _m4);
  }
  const nut = new THREE.IcosahedronGeometry(0.35, 0);
  nut.translate(px, py - 0.1, pz);
  b.add(nut, '#6b5a3a');
}

// ---------------------------------------------------------------------------------------------
// Cable car (Powell & Hyde): its own small group so it can be placed on the rails.

function buildCableCar(signMat: THREE.Material, glassMat: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'cableCar';
  const paint = new GeoBuilder();
  const glass = new GeoBuilder();
  const brass = new GeoBuilder();
  const RED = '#b01e2c';
  const CREAM = '#f3e7c9';
  const GOLD = '#d9a93c';
  const WOOD = '#8a5a34';
  const L = 8.4;
  const hl = L / 2;
  const hw = 1.2;

  // Trucks and wheels on the rails (rail gauge 1.067 m).
  for (const sx of [-2.6, 2.6]) {
    box(paint, sx - 0.85, sx + 0.85, 0.22, 0.58, -0.62, 0.62, '#2a2c31');
    for (const wx of [sx - 0.5, sx + 0.5]) {
      for (const wz of [-0.535, 0.535]) {
        const g = new THREE.CylinderGeometry(0.27, 0.27, 0.1, 16);
        g.rotateX(Math.PI / 2);
        g.translate(wx, 0.27, wz);
        paint.add(g, '#3a3d44');
      }
    }
  }
  // Floor and body.
  rbox(paint, -hl, hl, 0.58, 0.86, -hw, hw, 0.08, RED);
  rbox(paint, -2.15, 2.15, 0.86, 1.62, -hw, hw, 0.06, RED);
  box(paint, -2.2, 2.2, 1.55, 1.68, -hw - 0.03, hw + 0.03, GOLD);
  rbox(paint, -2.15, 2.15, 1.62, 2.98, -hw + 0.02, hw - 0.02, 0.06, CREAM);
  // Window band on the enclosed saloon.
  for (let i = 0; i < 6; i++) {
    const cx = -1.8 + i * 0.72;
    for (const zs of [-1, 1]) {
      box(glass, cx - 0.27, cx + 0.27, 1.85, 2.72, zs * (hw - 0.03), zs * (hw + 0.02), '#ffffff');
      box(paint, cx - 0.33, cx + 0.33, 1.78, 1.85, zs * (hw - 0.02), zs * (hw + 0.04), WOOD);
    }
  }
  for (const xs of [-1, 1]) {
    box(glass, xs * 2.15 - 0.02, xs * 2.15 + 0.02, 1.85, 2.72, -0.8, 0.8, '#ffffff');
  }
  // Open end platforms: dashers, outward benches and brass poles.
  for (const xs of [-1, 1]) {
    const a = xs * 2.15;
    const b = xs * hl;
    rbox(paint, Math.min(a, b), Math.max(a, b), 0.86, 1.38, -hw, -hw + 0.12, 0.04, RED);
    rbox(paint, Math.min(a, b), Math.max(a, b), 0.86, 1.38, hw - 0.12, hw, 0.04, RED);
    box(paint, Math.min(a, b), Math.max(a, b), 1.3, 1.4, -hw - 0.02, -hw + 0.14, GOLD);
    box(paint, Math.min(a, b), Math.max(a, b), 1.3, 1.4, hw - 0.14, hw + 0.02, GOLD);
    box(paint, Math.min(a, b) + 0.1, Math.max(a, b) - 0.1, 1.2, 1.3, -0.35, 0.35, WOOD);
    box(paint, b - xs * 0.25, b - xs * 0.08, 0.86, 1.9, -0.9, 0.9, CREAM);
    for (const px of [a + xs * 0.25, (a + b) / 2, b - xs * 0.2]) {
      for (const pz of [-hw + 0.06, hw - 0.06]) cyl(brass, [px, 0.86, pz], [px, 2.98, pz], 0.035, 0.035, 8, '#ffffff');
    }
    // Headlight.
    const hg = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16);
    hg.rotateZ(Math.PI / 2);
    hg.translate(b + xs * 0.02, 1.25, 0);
    brass.add(hg, '#ffffff');
  }
  // Grip lever in the front platform.
  cyl(brass, [2.9, 0.86, 0.2], [3.05, 2.0, 0.2], 0.03, 0.04, 6, '#ffffff');
  // Roof, clerestory and bell.
  rbox(paint, -hl - 0.12, hl + 0.12, 2.98, 3.12, -hw - 0.1, hw + 0.1, 0.06, CREAM);
  rbox(paint, -3.2, 3.2, 3.12, 3.46, -0.62, 0.62, 0.06, CREAM);
  for (let i = 0; i < 9; i++) {
    const cx = -2.8 + i * 0.7;
    for (const zs of [-1, 1]) box(glass, cx - 0.2, cx + 0.2, 3.18, 3.38, zs * 0.6, zs * 0.64, '#ffffff');
  }
  rbox(paint, -3.3, 3.3, 3.46, 3.56, -0.72, 0.72, 0.04, RED);
  const bell = new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  bell.translate(2.4, 3.46, 0);
  brass.add(bell, '#ffffff');

  const paintMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#d8ac48', metalness: 1, roughness: 0.28 });
  group.add(meshOf(paint, paintMat, 'cableCarBody', true, true));
  group.add(meshOf(glass, glassMat, 'cableCarGlass', false, false));
  group.add(meshOf(brass, brassMat, 'cableCarBrass', true, false));

  // Destination signs on both roof ends.
  for (const xs of [-1, 1]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.32), signMat);
    sign.position.set(xs * (hl + 0.14), 3.3, 0);
    sign.rotation.y = xs * (Math.PI / 2);
    group.add(sign);
  }
  // Side name boards.
  for (const zs of [-1, 1]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.3), signMat);
    sign.position.set(0, 1.25, zs * (hw + 0.03));
    sign.rotation.y = zs > 0 ? 0 : Math.PI;
    group.add(sign);
  }
  return group;
}

// ---------------------------------------------------------------------------------------------
// Main build.

export function buildCity(): City {
  const group = new THREE.Group();
  group.name = 'city';
  const rng = makeRng(1906);

  // Materials.
  const asphaltTex = asphaltTexture();
  const asphaltMat = new THREE.MeshStandardMaterial({ map: asphaltTex, vertexColors: true, roughness: 0.93, metalness: 0 });
  const markingMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const concreteMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.46 });
  const trimMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#27405e', roughness: 0.1, metalness: 0.55 });
  const facadeMat = new THREE.MeshStandardMaterial({ map: facadeTexture(), vertexColors: true, roughness: 0.7 });
  const foliageMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, flatShading: true });
  const metalMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.75, roughness: 0.3 });
  const woodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const plankMat = new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.8 });
  const plyTex = plywoodTexture();
  const plyMat = new THREE.MeshStandardMaterial({ map: plyTex, roughness: 0.72 });
  const stripeMat = new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.5 });
  const coneMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 });

  const asphalt = new GeoBuilder();
  const marks = new GeoBuilder();
  const concrete = new GeoBuilder();
  const houses: HouseSinks = { walls: new GeoBuilder(), trim: new GeoBuilder(), glass: new GeoBuilder() };
  const facades = new GeoBuilder();
  const foliage = new GeoBuilder();
  const metal = new GeoBuilder();
  const wood = new GeoBuilder();
  const planks = new GeoBuilder();
  const cones = new GeoBuilder();

  const ASPHALT = '#ffffff';
  const WHITE = '#f5f5ef';
  const YELLOW = '#f5c431';
  const road = (x: number): number => gy(x);
  const walkTop = (x: number): number => gy(x) + CURB;
  const deep = (x: number): number => gy(x) - 0.9;

  // --- Land, seawall and waterfront ------------------------------------------------------------
  slab(concrete, LAND_X0, SHORE_X - SEAWALL_T, -LAND_Z, LAND_Z, (x) => gy(x) - 0.4, () => -3, '#9fc27d', 8);
  slab(concrete, SHORE_X - SEAWALL_T, SHORE_X, -LAND_Z, LAND_Z, () => DECK_Y - 0.02, () => -3, '#cfc6b5', 4);
  // Algae line and a coping lip along the seawall.
  box(concrete, SHORE_X, SHORE_X + 0.03, -0.35, 0.55, -LAND_Z, LAND_Z, '#5f6b58');
  box(concrete, SHORE_X - 0.1, SHORE_X + 0.25, DECK_Y - 0.28, DECK_Y - 0.008, -LAND_Z, LAND_Z, '#e3dccd');

  // --- Streets -----------------------------------------------------------------------------------
  // Main road from the top street to the Embarcadero.
  slab(asphalt, WEST_X, EMB_X0, -ROAD_HALF, ROAD_HALF, road, deep, ASPHALT, 6);
  // Top cross street.
  slab(asphalt, TOP_STREET[0], TOP_STREET[1], -CROSS_EXTENT, CROSS_EXTENT, road, deep, ASPHALT, 6);
  // Cross streets at each intersection (the main road covers |z| < ROAD_HALF).
  for (const seg of INTERSECTIONS) {
    slab(asphalt, seg.x0, seg.x1, ROAD_HALF, CROSS_EXTENT, road, deep, ASPHALT, 6);
    slab(asphalt, seg.x0, seg.x1, -CROSS_EXTENT, -ROAD_HALF, road, deep, ASPHALT, 6);
  }
  // Parallel streets, split at the cross streets to avoid overlaps.
  const crossXs: [number, number][] = [TOP_STREET, ...INTERSECTIONS.map((s) => [s.x0, s.x1] as [number, number])];
  for (let i = 0; i < crossXs.length; i++) {
    const xa = i === 0 ? -300 : crossXs[i - 1][1];
    const xb = crossXs[i][0];
    for (const sgn of [1, -1]) {
      const z0 = sgn > 0 ? PARALLEL_Z[0] : -PARALLEL_Z[1];
      const z1 = sgn > 0 ? PARALLEL_Z[1] : -PARALLEL_Z[0];
      slab(asphalt, xa, xb, z0, z1, road, deep, ASPHALT, 6);
      // Sidewalks along the parallel street.
      slab(concrete, xa, xb, z0 - 3, z0, walkTop, deep, CONCRETE, 4);
      slab(concrete, xa, xb, z1, z1 + 3, walkTop, deep, CONCRETE, 4);
    }
  }
  // The Embarcadero: two carriageways, palm median (gap for our road) and the promenade.
  slab(asphalt, EMB_X0, MEDIAN[0], -LAND_Z, LAND_Z, road, deep, ASPHALT, 6);
  slab(asphalt, MEDIAN[1], PROMENADE_X, -LAND_Z, LAND_Z, road, deep, ASPHALT, 6);
  slab(asphalt, MEDIAN[0], MEDIAN[1], -9, 9, road, deep, ASPHALT, 6);
  for (const sgn of [1, -1]) {
    const z0 = sgn > 0 ? 9 : -LAND_Z;
    const z1 = sgn > 0 ? LAND_Z : -9;
    slab(concrete, MEDIAN[0], MEDIAN[1], z0, z1, () => DECK_Y + 0.25, deep, '#d8d1c2', 4);
    slab(concrete, MEDIAN[0] + 0.4, MEDIAN[1] - 0.4, z0 + (sgn > 0 ? 0.4 : 0), z1 - (sgn > 0 ? 0 : 0.4), () => DECK_Y + 0.33, deep, '#78b35a', 4, false);
  }
  slab(concrete, PROMENADE_X, SHORE_X - SEAWALL_T, -LAND_Z, LAND_Z, () => DECK_Y, deep, '#e6dfd1', 4);

  // Sidewalks along the main road, broken by the cross streets.
  const walkRanges: [number, number][] = [];
  let wPrev = WEST_X;
  for (const seg of INTERSECTIONS) {
    walkRanges.push([wPrev, seg.x0]);
    wPrev = seg.x1;
  }
  for (const [xa, xb] of walkRanges) {
    slab(concrete, xa, xb, ROAD_HALF, WALK_OUT, walkTop, deep, CONCRETE, 4);
    slab(concrete, xa, xb, -WALK_OUT, -ROAD_HALF, walkTop, deep, CONCRETE, 4);
  }
  // Cross-street sidewalks (both sides of every cross street).
  for (const [xa, xb] of crossXs) {
    for (const [c0, c1] of [
      [xa - CROSS_WALK, xa],
      [xb, xb + CROSS_WALK],
    ] as const) {
      if (c1 > EMB_X0 - 0.01) continue;
      for (const [za, zb] of [
        [WALK_OUT, PARALLEL_Z[0] - 3],
        [PARALLEL_Z[1] + 3, CROSS_EXTENT],
      ] as const) {
        slab(concrete, c0, c1, za, zb, walkTop, deep, CONCRETE, 4);
        slab(concrete, c0, c1, -zb, -za, walkTop, deep, CONCRETE, 4);
      }
    }
  }
  // Sidewalk behind the top street (the far side).
  slab(concrete, TOP_STREET[0] - CROSS_WALK, TOP_STREET[0], -CROSS_EXTENT, CROSS_EXTENT, walkTop, deep, CONCRETE, 4);

  // --- Road markings ---------------------------------------------------------------------------
  const markTop = (x: number): number => gy(x) + 0.012;
  const lineRanges: [number, number][] = [];
  let lPrev = WEST_X;
  for (const seg of INTERSECTIONS) {
    lineRanges.push([lPrev + 1, seg.x0 - 4]);
    lPrev = seg.x1 + 4;
  }
  for (const [xa, xb] of lineRanges) {
    for (const z of [-0.2, 0.2]) slab(marks, xa, xb, z - 0.07, z + 0.07, markTop, markTop, YELLOW, 1, false);
    for (const z of [-6.35, 6.35]) slab(marks, xa, xb, z - 0.08, z + 0.08, markTop, markTop, WHITE, 1, false);
  }
  // Continental crosswalks either side of every intersection and at the Embarcadero.
  const crosswalk = (xa: number, xb: number): void => {
    for (let z = -6.3; z < 6.3; z += 1.25) slab(marks, xa, xb, z, z + 0.62, markTop, markTop, WHITE, 1, false);
  };
  for (const seg of INTERSECTIONS) {
    crosswalk(seg.x0 - 3.6, seg.x0 - 0.8);
    if (seg !== INTERSECTIONS[INTERSECTIONS.length - 1]) crosswalk(seg.x1 + 0.8, seg.x1 + 3.6);
  }
  crosswalk(EMB_X0 + 1, EMB_X0 + 3.8);
  // Embarcadero lane lines along z.
  for (const x of [EMB_X0 + 5.5, MEDIAN[1] + 5]) {
    for (let z = -LAND_Z; z < LAND_Z; z += 9) {
      if (Math.abs(z + 1.5) < 10) continue;
      slab(marks, x - 0.08, x + 0.08, z, z + 3, markTop, markTop, WHITE, 1, false);
    }
  }
  // Cross-street centre lines.
  for (const [xa, xb] of crossXs) {
    const xc = (xa + xb) / 2;
    if (INTERSECTIONS.some((s) => s.x0 === xa)) continue; // cable-car tracks run down the middle
    for (const sgn of [1, -1]) {
      const z0 = sgn > 0 ? WALK_OUT + 4 : -CROSS_EXTENT;
      const z1 = sgn > 0 ? CROSS_EXTENT : -WALK_OUT - 4;
      for (const dz of [-0.2, 0.2]) slab(marks, xc + dz - 0.07, xc + dz + 0.07, z0, z1, markTop, markTop, YELLOW, 1, false);
    }
  }

  // --- Cable-car tracks at each intersection ---------------------------------------------------
  for (let i = 0; i < T.bumpX.length; i++) {
    const bx = T.bumpX[i];
    const y = gy(bx);
    // Concrete strip, flush with the road, rails slightly proud so the bump reads.
    slab(concrete, bx - 1.0, bx + 1.0, -CROSS_EXTENT, CROSS_EXTENT, (x) => gy(x) + 0.025, deep, '#c9c4b8', 4, false);
    for (const dx of [-0.535, 0.535]) box(metal, bx + dx - 0.045, bx + dx + 0.045, y - 0.05, y + 0.07, -CROSS_EXTENT, CROSS_EXTENT, '#e6e9ee');
    box(marks, bx - 0.03, bx + 0.03, y + 0.027, y + 0.04, -CROSS_EXTENT, CROSS_EXTENT, '#1a1a1d');
    // Manhole-ish plates along the slot.
    for (let z = -CROSS_EXTENT + 5; z < CROSS_EXTENT; z += 18) {
      if (Math.abs(z) < 8) continue;
      box(marks, bx - 0.28, bx + 0.28, y + 0.027, y + 0.04, z, z + 0.56, '#6c6e73');
    }
  }

  // --- Street signs on the corners: cross-street plates face the chase camera ---------------------
  {
    const plates = new GeoBuilder();
    INTERSECTIONS.forEach((seg, i) => {
      for (const zs of [1, -1]) {
        const x = seg.x0 - 1.2;
        const z = zs * (ROAD_HALF + 1.0);
        const y = gy(x) + CURB;
        cyl(metal, [x, y, z], [x, y + 3.6, z], 0.06, 0.07, 8, '#1f4a3a');
        const a = signPlate(i + 1, true);
        a.translate(x, y + 3.25, z);
        plates.add(a, '#ffffff');
        const b = signPlate(0, false);
        b.translate(x, y + 3.62, z);
        plates.add(b, '#ffffff');
      }
    });
    const signs = meshOf(plates, new THREE.MeshStandardMaterial({ map: streetSignTexture(), roughness: 0.45 }), 'streetSigns', true, false);
    group.add(signs);
  }

  // --- Start line, lane labels and the start gantry ---------------------------------------------
  const startX0 = 2.6;
  const startX1 = 3.4;
  const startGeo = new GeoBuilder();
  slab(startGeo, startX0, startX1, -ROAD_HALF + 0.2, ROAD_HALF - 0.2, markTop, markTop, '#ffffff', 1, false);
  const startLine = meshOf(
    startGeo,
    new THREE.MeshStandardMaterial({
      map: checkerTexture(34, 2),
      roughness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    'startLine',
    false,
    true,
  );
  // The slab maps u=z, v=arc: remap to the full texture.
  {
    const uv = startLine.geometry.getAttribute('uv');
    const p = startLine.geometry.getAttribute('position');
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (p.getZ(i) + ROAD_HALF - 0.2) / (2 * (ROAD_HALF - 0.2)), (p.getX(i) - startX0) / (startX1 - startX0));
    }
    uv.needsUpdate = true;
  }
  group.add(startLine);

  const laneTex = laneLabelTexture();
  const laneMat = new THREE.MeshStandardMaterial({ map: laneTex, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
  for (const [i, z] of [
    [0, -3],
    [1, 3],
  ] as const) {
    const g = new THREE.PlaneGeometry(3.0, 3.0);
    const uv = g.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / 2);
    g.rotateX(-Math.PI / 2);
    g.rotateY(-Math.PI / 2);
    const label = new THREE.Mesh(g, laneMat);
    label.position.set(-3.2, START_Y + 0.014, z);
    label.receiveShadow = true;
    label.name = `laneLabel${i + 1}`;
    group.add(label);
  }

  const gantry = new THREE.Group();
  gantry.name = 'startGantry';
  {
    const gb = new GeoBuilder();
    const yb = START_Y + CURB;
    const topY = START_Y + 8.1;
    for (const z of [-8.7, 8.7]) {
      rbox(gb, startX0 - 0.25, startX0 + 0.25, yb, topY + 0.3, z - 0.25, z + 0.25, 0.08, '#f7f7f2');
      box(gb, startX0 - 0.4, startX0 + 0.4, yb, yb + 0.3, z - 0.4, z + 0.4, '#2b2f36');
    }
    rbox(gb, startX0 - 0.3, startX0 + 0.3, topY - 0.45, topY + 0.1, -9.0, 9.0, 0.08, '#2b2f36');
    const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.6 });
    gantry.add(meshOf(gb, mat, 'gantryFrame', true, true));
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.75, 13.6),
      new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.55 }),
    );
    banner.position.set(startX0, topY - 1.45, 0);
    banner.castShadow = true;
    banner.name = 'gantryBanner';
    gantry.add(banner);
  }
  group.add(gantry);

  // Waving checkered flags on the gantry posts.
  const flagMat = new THREE.MeshStandardMaterial({ map: checkerTexture(6, 4), roughness: 0.6, side: THREE.DoubleSide });
  const flags: { mesh: THREE.Mesh; base: Float32Array; phase: number }[] = [];
  for (const [i, z] of [
    [0, -8.7],
    [1, 8.7],
  ] as const) {
    const g = new THREE.PlaneGeometry(1.8, 1.2, 12, 4);
    g.translate(0.9, 0, 0);
    const mesh = new THREE.Mesh(g, flagMat);
    mesh.position.set(startX0, START_Y + 8.1 + 0.9, z);
    mesh.rotation.y = z < 0 ? 0.35 : -0.35 + Math.PI;
    mesh.castShadow = true;
    mesh.name = `startFlag${i + 1}`;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), new THREE.MeshStandardMaterial({ color: '#d8dce2', metalness: 0.8, roughness: 0.3 }));
    pole.position.set(startX0, START_Y + 8.1 + 0.9, z);
    gantry.add(pole);
    gantry.add(mesh);
    flags.push({ mesh, base: Float32Array.from(g.getAttribute('position').array as ArrayLike<number>), phase: i * 1.7 });
  }

  // --- Houses and the city behind them ----------------------------------------------------------
  buildHouses(houses, rng);
  buildBackground(facades, houses.walls, foliage, rng);

  // Street trees along the main sidewalks (clear of the lanes).
  for (const [xa, xb] of walkRanges) {
    for (const side of [1, -1]) {
      for (let x = xa + 7 + rng() * 4; x < xb - 6; x += 14 + rng() * 6) {
        tree(foliage, x, gy(x) + CURB, side * 9.0, 0.75 + rng() * 0.2, rng);
      }
    }
  }

  // --- Embarcadero palms, lamps and waterfront railing -----------------------------------------
  const medX = (MEDIAN[0] + MEDIAN[1]) / 2;
  for (const sgn of [1, -1]) {
    for (let z = 16; z < 420; z += 13) {
      palm(foliage, medX + (rng() - 0.5) * 0.6, DECK_Y + 0.33, sgn * z, 8 + rng() * 3, rng);
    }
    for (let z = 12; z < 420; z += 24) {
      for (const x of [EMB_X0 + 1.2, PROMENADE_X + 1.2]) {
        const zz = sgn * z;
        cyl(metal, [x, DECK_Y, zz], [x, DECK_Y + 6, zz], 0.08, 0.12, 8, '#23443a');
        cyl(metal, [x, DECK_Y + 6, zz], [x + (x < medX ? 0.9 : -0.9), DECK_Y + 6.3, zz], 0.05, 0.05, 6, '#23443a');
        const lamp = new THREE.SphereGeometry(0.26, 12, 8);
        lamp.translate(x + (x < medX ? 0.95 : -0.95), DECK_Y + 6.15, zz);
        metal.add(lamp, '#fff4cf');
      }
    }
    // Railing along the waterfront (gap at the pier entrance).
    const r0 = sgn > 0 ? 9.5 : -LAND_Z;
    const r1 = sgn > 0 ? LAND_Z : -9.5;
    const rx = SHORE_X - 0.35;
    box(metal, rx - 0.05, rx + 0.05, DECK_Y + 1.0, DECK_Y + 1.1, r0, r1, '#2e3b44');
    box(metal, rx - 0.03, rx + 0.03, DECK_Y + 0.55, DECK_Y + 0.6, r0, r1, '#2e3b44');
    for (let z = r0; z <= r1; z += 2.5) box(metal, rx - 0.05, rx + 0.05, DECK_Y, DECK_Y + 1.1, z - 0.05, z + 0.05, '#2e3b44');
  }

  // --- Pier ---------------------------------------------------------------------------------------
  const pierX0 = SHORE_X;
  const pierX1 = LIP.x;
  {
    const deckGeo = new THREE.BoxGeometry(pierX1 - pierX0, 0.45, 2 * PIER_HALF);
    deckGeo.translate((pierX0 + pierX1) / 2, DECK_Y - 0.225, 0);
    // Planks run across the pier: u = z / 4 m, v = x / 2 m.
    const p = deckGeo.getAttribute('position');
    const uv = deckGeo.getAttribute('uv');
    const n = deckGeo.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, p.getZ(i) / 4, p.getX(i) / 2);
      else if (Math.abs(n.getZ(i)) > 0.5) uv.setXY(i, p.getX(i) / 4, p.getY(i) / 2);
      else uv.setXY(i, p.getZ(i) / 4, p.getY(i) / 2);
    }
    planks.add(deckGeo, '#ffffff');
  }
  // Fascia boards along the deck edges.
  for (const z of [-PIER_HALF, PIER_HALF]) {
    box(wood, pierX0, pierX1, DECK_Y - 0.75, DECK_Y - 0.05, z - 0.12, z + 0.12, DARK_WOOD);
  }
  // Pilings and cap beams.
  for (let x = pierX0 + 1.5; x <= pierX1 - 0.3; x += 4) {
    for (const z of [-7.4, -2.5, 2.5, 7.4]) {
      const jx = (rng() - 0.5) * 0.25;
      const jz = (rng() - 0.5) * 0.25;
      cyl(wood, [x + jx, -4.5, z + jz], [x + jx * 0.3, DECK_Y - 0.4, z + jz * 0.3], 0.26, 0.3, 10, rng() < 0.5 ? '#4f3d2d' : '#5c4834');
    }
    box(wood, x - 0.2, x + 0.2, DECK_Y - 0.8, DECK_Y - 0.44, -PIER_HALF + 0.2, PIER_HALF - 0.2, '#4a3828');
  }
  // Diagonal cross bracing between pilings (seen from the side camera).
  for (let x = pierX0 + 1.5; x < pierX1 - 4.3; x += 4) {
    for (const z of [-7.5, 7.5]) {
      obox(wood, [x + 2, 1.2, z], [Math.hypot(4, 3.6), 0.18, 0.12], [0, 0, Math.atan2(3.6, 4) * (Math.floor(x) % 8 < 4 ? 1 : -1)], '#4a3828');
    }
  }
  // Bollards along the edges, clear of the kicker.
  for (let x = pierX0 + 3; x < KICK_X - 1; x += 7) {
    for (const z of [-PIER_HALF + 0.35, PIER_HALF - 0.35]) {
      cyl(metal, [x, DECK_Y, z], [x, DECK_Y + 0.55, z], 0.17, 0.2, 12, '#2b2f36');
      const cap = new THREE.SphereGeometry(0.19, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      cap.translate(x, DECK_Y + 0.55, z);
      metal.add(cap, '#2b2f36');
    }
  }
  // A life ring on a post near the pier entrance.
  {
    const x = pierX0 + 6.5;
    const z = -PIER_HALF + 0.4;
    box(wood, x - 0.1, x + 0.1, DECK_Y, DECK_Y + 1.6, z - 0.1, z + 0.1, DARK_WOOD);
    const ring = new THREE.TorusGeometry(0.42, 0.11, 8, 20);
    ring.translate(x, DECK_Y + 1.05, z + 0.2);
    cones.add(ring, '#ff5a2a');
  }

  // --- Kicker ---------------------------------------------------------------------------------------
  const kx0 = KICK_X;
  const kx1 = LIP.x;
  const ky0 = DECK_Y;
  const ky1 = LIP.y;
  const kAng = LIP.angle;
  const kLen = Math.hypot(kx1 - kx0, ky1 - ky0);
  const kMid: V3 = [(kx0 + kx1) / 2, (ky0 + ky1) / 2, 0];
  const nrm: V3 = [-Math.sin(kAng), Math.cos(kAng), 0];
  const plyGeo = new THREE.BoxGeometry(kLen, 0.12, 2 * KICKER_HALF);
  {
    const p = plyGeo.getAttribute('position');
    const uv = plyGeo.getAttribute('uv');
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + kLen / 2) / 2.44, (p.getZ(i) + KICKER_HALF) / 1.22);
  }
  _m4.compose(
    _v.set(kMid[0] - nrm[0] * 0.06, kMid[1] - nrm[1] * 0.06, 0),
    _q.setFromEuler(_e.set(0, 0, kAng)),
    _s.set(1, 1, 1),
  );
  plyGeo.applyMatrix4(_m4);
  const ply = new THREE.Mesh(plyGeo, plyMat);
  ply.name = 'kickerSurface';
  ply.castShadow = true;
  ply.receiveShadow = true;
  group.add(ply);

  // Striped edge beams along both sides and a fascia across the lip.
  const stripes = new GeoBuilder();
  const stripeBox = (c: V3, size: V3, rot: V3, uScale: number): void => {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const p = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + p.getZ(i)) * uScale, (p.getY(i) + size[1] / 2) / size[1]);
    _m4.compose(_v.set(c[0], c[1], c[2]), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])), _s.set(1, 1, 1));
    stripes.add(g, '#ffffff', _m4);
  };
  for (const z of [-KICKER_HALF - 0.12, KICKER_HALF + 0.12]) {
    stripeBox([kMid[0] - nrm[0] * 0.15, kMid[1] - nrm[1] * 0.15, z], [kLen + 0.2, 0.62, 0.24], [0, 0, kAng], 1 / 0.9);
  }
  // Lip fascia (back of the ramp, facing the Bay) and the front toe board.
  stripeBox([kx1 + 0.12, ky1 - 0.34, 0], [0.24, 0.68, 2 * KICKER_HALF + 0.48], [0, 0, 0], 1 / 0.9);
  stripeBox([kx0 + 0.1, ky0 + 0.05, 0], [0.4, 0.1, 2 * KICKER_HALF], [0, 0, 0], 1 / 0.9);
  // Timber frame under the ramp: posts, stringers and diagonal braces.
  const rampY = (x: number): number => ky0 + (x - kx0) * Math.tan(kAng);
  const postXs = [kx0 + 2.4, kx0 + 4.8, kx0 + 7.2, kx0 + 9.4, kx1 - 0.3];
  for (const z of [-6.7, -3.35, 0, 3.35, 6.7]) {
    for (const x of postXs) {
      const top = rampY(x) - 0.14;
      box(wood, x - 0.09, x + 0.09, ky0, top, z - 0.09, z + 0.09, PINE);
    }
    // Stringer following the ramp underside.
    obox(wood, [kMid[0] - nrm[0] * 0.25, kMid[1] - nrm[1] * 0.25, z], [kLen, 0.2, 0.12], [0, 0, kAng], '#c99c5e');
  }
  for (const z of [-6.8, 6.8]) {
    for (let i = 0; i < postXs.length - 1; i++) {
      const xa = postXs[i];
      const xb = postXs[i + 1];
      const ya = ky0 + 0.2;
      const yb2 = rampY(xb) - 0.3;
      obox(wood, [(xa + xb) / 2, (ya + yb2) / 2, z], [Math.hypot(xb - xa, yb2 - ya), 0.14, 0.08], [0, 0, Math.atan2(yb2 - ya, xb - xa)], '#c99c5e');
    }
    box(wood, kx0, kx1, ky0, ky0 + 0.2, z - 0.06, z + 0.06, '#c99c5e');
  }
  // Yellow lane chevrons on the plywood.
  for (const zc of [-3, 3]) {
    for (let k = 0; k < 3; k++) {
      const along = 1.6 + k * 1.3;
      for (const sgn of [-1, 1]) {
        const x = kx0 + along * Math.cos(kAng);
        const y = ky0 + along * Math.sin(kAng) + 0.005;
        const g = new THREE.BoxGeometry(0.9, 0.01, 0.22);
        g.rotateY(sgn * 0.6);
        g.translate(0.0, 0, sgn * 0.33);
        _m4.compose(_v.set(x, y, zc), _q.setFromEuler(_e.set(0, 0, kAng)), _s.set(1, 1, 1));
        cones.add(g, '#ffd21f', _m4);
      }
    }
  }

  // --- Traffic cones --------------------------------------------------------------------------------
  const cone = (x: number, y: number, z: number): void => {
    box(cones, x - 0.24, x + 0.24, y, y + 0.06, z - 0.24, z + 0.24, '#e8541c');
    cyl(cones, [x, y + 0.06, z], [x, y + 0.82, z], 0.012, 0.19, 16, '#ff6a1f');
    cyl(cones, [x, y + 0.36, z], [x, y + 0.5, z], 0.11, 0.135, 16, '#fbfbf7');
    cyl(cones, [x, y + 0.6, z], [x, y + 0.68, z], 0.07, 0.085, 16, '#fbfbf7');
  };
  for (let x = pierX0 + 4.5; x < KICK_X - 0.5; x += 3.2) {
    cone(x, DECK_Y, -PIER_HALF + 0.95);
    cone(x, DECK_Y, PIER_HALF - 0.95);
  }
  for (const x of [kx0 + 1.5, kx0 + 5, kx0 + 8.5]) {
    cone(x, DECK_Y, -PIER_HALF + 0.55);
    cone(x, DECK_Y, PIER_HALF - 0.55);
  }
  // A few cones at the pier entrance on the promenade.
  for (const z of [-9.4, -8.6, 8.6, 9.4]) cone(SHORE_X - 2.2, DECK_Y, z);

  // --- Cable car parked on the first cross street -------------------------------------------------
  const signMat = new THREE.MeshStandardMaterial({ map: signTexture('POWELL & HYDE', '#1d1d22', '#f6e7b8'), roughness: 0.5 });
  const cableCar = buildCableCar(signMat, glassMat);
  const ccX = T.bumpX[0];
  cableCar.position.set(ccX, gy(ccX) + 0.07, 13.2);
  cableCar.rotation.y = -Math.PI / 2;
  group.add(cableCar);

  // --- Assemble --------------------------------------------------------------------------------------
  group.add(meshOf(concrete, concreteMat, 'concrete', false, true));
  group.add(meshOf(asphalt, asphaltMat, 'asphalt', false, true));
  group.add(meshOf(marks, markingMat, 'markings', false, true));
  group.add(meshOf(houses.walls, wallMat, 'houseWalls', true, true));
  group.add(meshOf(houses.trim, trimMat, 'houseTrim', true, true));
  group.add(meshOf(houses.glass, glassMat, 'houseGlass', false, true));
  group.add(meshOf(facades, facadeMat, 'backgroundBuildings', true, true));
  group.add(meshOf(foliage, foliageMat, 'foliage', true, true));
  group.add(meshOf(metal, metalMat, 'metal', true, true));
  group.add(meshOf(wood, woodMat, 'pierTimber', true, true));
  group.add(meshOf(planks, plankMat, 'pierDeck', true, true));
  group.add(meshOf(stripes, stripeMat, 'kickerStripes', true, true));
  group.add(meshOf(cones, coneMat, 'cones', true, true));

  const update = (_dt: number, t: number): void => {
    for (const f of flags) {
      const pos = f.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const x = f.base[i * 3];
        const y = f.base[i * 3 + 1];
        const amp = 0.18 * (x / 1.8);
        arr[i * 3 + 2] = f.base[i * 3 + 2] + Math.sin(t * 5 + x * 3.2 + f.phase) * amp + Math.sin(t * 3.1 + y * 2) * 0.03 * x;
      }
      pos.needsUpdate = true;
      f.mesh.geometry.computeVertexNormals();
    }
  };

  return { group, update };
}

// The Mission's own props: Canary Island date palms (the BART plaza's), star piñatas hanging out
// of the party shop, papel picado on its strings across the street, a fruit stand with mangoes on
// sticks, paleta carts, Mexican flags on their brackets, the BART entrance with its stairs going
// down and its canopy, and the 14-Mission's trolley wires. Geometry goes into the scene's builders
// (papel picado into its own: it's cut out).
import * as THREE from 'three';
import { box, cyl, type GeoBuilder, type V3 } from '../../geo';
import type { Ctx } from '../../osg/context';
import type { Atlas } from '../../osg/haight/atlas';
import type { Frame } from '../../osg/haight/building';
import { MX, PAPEL_COLORS, PAPEL_KINDS } from './cells';

/** A Canary Island date palm: a thick ringed trunk and a full round crown of arching fronds, the
 *  dead ones hanging under it. */
export function palm(S: Ctx['sinks'], x: number, y: number, z: number, h: number, rng: () => number): void {
  const segs = 6;
  const lean = (rng() - 0.5) * 0.12;
  const la = rng() * Math.PI * 2;
  const at = (f: number): V3 => [x + Math.cos(la) * lean * h * f * f, y + h * f, z + Math.sin(la) * lean * h * f * f];
  for (let i = 0; i < segs; i++) {
    const a = at(i / segs);
    const b = at((i + 1) / segs);
    cyl(S.foliage, a, b, 0.36 - 0.03 * (i / segs), 0.4 - 0.03 * (i / segs), 7, i % 2 ? '#8a6a4a' : '#7a5c3e');
  }
  const top = at(1);
  // The pineapple-ish knob where the fronds spring from.
  const knob = new THREE.SphereGeometry(0.62, 8, 6);
  knob.translate(top[0], top[1], top[2]);
  S.foliage.add(knob, '#7d6a3e');
  const n = 16;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rng() * 0.2;
    const up = k % 2 ? 0.55 : 0.15;
    const len = 3.2 + rng() * 0.8;
    frond(S.foliage, top, a, up, len, k % 5 === 0 ? '#8f9a4a' : '#3f7a3a');
  }
  // The skirt of dead fronds.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    frond(S.foliage, [top[0], top[1] - 0.3, top[2]], a, -1.0, 1.8, '#a88a5a');
  }
}

/** A frond from `base` heading `a` round the trunk, rising at `up` (radians) and drooping as it goes:
 *  a strip of leaflets (a flattened prism) in three bends. */
function frond(b: GeoBuilder, base: V3, a: number, up: number, len: number, color: string): void {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  let p: V3 = base;
  let pitch = up;
  const step = len / 3;
  for (let i = 0; i < 3; i++) {
    const q: V3 = [p[0] + ca * Math.cos(pitch) * step, p[1] + Math.sin(pitch) * step, p[2] + sa * Math.cos(pitch) * step];
    const w = 0.55 - i * 0.12;
    // Leaflets either side: a flat quad, tilted a little to make a V.
    const px = -sa * w;
    const pz = ca * w;
    b.quad([p[0] - px, p[1] + 0.05, p[2] - pz], [q[0] - px * 0.8, q[1] + 0.05, q[2] - pz * 0.8], [q[0], q[1], q[2]], [p[0], p[1], p[2]], color, [0, 1, 0]);
    b.quad([p[0], p[1], p[2]], [q[0], q[1], q[2]], [q[0] + px * 0.8, q[1] + 0.05, q[2] + pz * 0.8], [p[0] + px, p[1] + 0.05, p[2] + pz], color, [0, 1, 0]);
    // (Underneath, so it doesn't vanish seen from below.)
    b.quad([p[0] - px, p[1] + 0.03, p[2] - pz], [q[0] - px * 0.8, q[1] + 0.03, q[2] - pz * 0.8], [q[0] + px * 0.8, q[1] + 0.03, q[2] + pz * 0.8], [p[0] + px, p[1] + 0.03, p[2] + pz], color, [0, -1, 0]);
    p = q;
    pitch -= 0.45;
  }
}

/** A seven-pointed star piñata hanging from (x, ytop, z): the ball, its cones and the streamers off
 *  each point. */
export function starPinata(S: Ctx['sinks'], x: number, ytop: number, z: number, s: number, rng: () => number): void {
  const cols = [MX.magenta, MX.yellow, MX.turquoise, MX.orange, MX.lime, MX.purple, MX.red, MX.pink];
  const cy = ytop - 0.35 - s;
  cyl(S.metal, [x, ytop, z], [x, cy + s, z], 0.008, 0.008, 3, '#3a3a3a');
  const ball = new THREE.SphereGeometry(s, 10, 8);
  ball.translate(x, cy, z);
  S.paint.add(ball, cols[Math.floor(rng() * cols.length)]);
  const dirs: V3[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + rng();
    dirs.push([Math.cos(a), 0.15, Math.sin(a)]);
  }
  dirs.push([0, 1, 0], [0, -1, 0]);
  dirs.forEach((d, k) => {
    const l = Math.hypot(d[0], d[1], d[2]);
    const u: V3 = [d[0] / l, d[1] / l, d[2] / l];
    const tip: V3 = [x + u[0] * s * 2.4, cy + u[1] * s * 2.4, z + u[2] * s * 2.4];
    cyl(S.paint, [x + u[0] * s * 0.8, cy + u[1] * s * 0.8, z + u[2] * s * 0.8], tip, 0.0, s * 0.42, 8, cols[(k + 2) % cols.length]);
    // Streamers off the tips, hanging down.
    if (u[1] < 0.5) {
      for (let j = 0; j < 2; j++) {
        const sx = tip[0] + (j - 0.5) * 0.06;
        box(S.paint, sx - 0.02, sx + 0.02, tip[1] - 0.6, tip[1], tip[2] - 0.004, tip[2] + 0.004, cols[(k + j + 4) % cols.length]);
      }
    }
  });
}

/**
 * Papel picado on a string from a to c, sagging `sag` at its middle: a flag every 0.56 m, each a
 * cut-out sheet (the papel canvas: a column per colour, a row per pattern) hanging square to the
 * string, and the string itself.
 */
export function papelString(papel: GeoBuilder, line: GeoBuilder, a: V3, c: V3, sag: number, rng: () => number): void {
  const len = Math.hypot(c[0] - a[0], c[2] - a[2]);
  const n = Math.max(2, Math.floor(len / 0.56));
  const at = (t: number): V3 => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (c[2] - a[2]) * t];
  // The string: a few straight pieces.
  const pieces = 8;
  for (let i = 0; i < pieces; i++) cyl(line, at(i / pieces), at((i + 1) / pieces), 0.012, 0.012, 3, '#f4f1ea');
  const ux = (c[0] - a[0]) / len;
  const uz = (c[2] - a[2]) / len;
  const kind = Math.floor(rng() * PAPEL_KINDS);
  const nc = PAPEL_COLORS.length;
  const W = 0.44;
  const H = 0.56;
  let col = Math.floor(rng() * nc);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = at(t);
    const u0 = col / nc;
    const u1 = (col + 1) / nc;
    const v1 = 1 - kind / PAPEL_KINDS;
    const v0 = 1 - (kind + 1) / PAPEL_KINDS;
    const l: V3 = [p[0] - ux * W * 0.5, p[1], p[2] - uz * W * 0.5];
    const r: V3 = [p[0] + ux * W * 0.5, p[1], p[2] + uz * W * 0.5];
    // A little flutter: each flag swung out of the vertical a touch.
    const sw = (rng() - 0.5) * 0.12;
    const out: V3 = [-uz * sw, 0, ux * sw];
    papel.quad([l[0] + out[0], l[1] - H, l[2] + out[2]], [r[0] + out[0], r[1] - H, r[2] + out[2]], r, l, '#ffffff', undefined, [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ]);
    col = (col + 1 + Math.floor(rng() * 2)) % nc;
  }
}

/** A fruit stand under a striped umbrella: crates of fruit, and mangoes on sticks cut into flowers
 *  in a rack. (x, y, z): its middle on the sidewalk, `h` the way its front faces. */
export function fruitStand(S: Ctx['sinks'], x: number, y: number, z: number, h: number, rng: () => number): void {
  const m = new THREE.Matrix4().makeRotationY(-h).setPosition(x, y, z);
  box(S.paint, -0.55, 0.55, 0, 0.8, -0.9, 0.9, '#3d8bd9', m);
  box(S.paint, -0.6, 0.6, 0.8, 0.86, -0.95, 0.95, '#f4f1ea', m);
  const fruit = ['#f9a620', '#d7263d', '#8ac926', '#ffd23f', '#ff7f11', '#7b2cbf'];
  for (let i = -3; i <= 3; i++) {
    for (let j = -1; j <= 1; j++) {
      const g = new THREE.SphereGeometry(0.09 + rng() * 0.03, 6, 5);
      g.translate(j * 0.3, 0.98, i * 0.24);
      g.applyMatrix4(m);
      S.paint.add(g, fruit[(i + 3 + j * 2 + 6) % fruit.length]);
    }
  }
  // The mango flowers on their sticks.
  for (let i = -2; i <= 2; i++) {
    const p = new THREE.Vector3(0.5, 1.3, i * 0.3).applyMatrix4(m);
    cyl(S.paint, [p.x, p.y - 0.4, p.z], [p.x, p.y, p.z], 0.01, 0.01, 3, '#e9dcc4');
    const g = new THREE.SphereGeometry(0.11, 6, 5);
    g.scale(1, 1.3, 1);
    g.translate(p.x, p.y + 0.08, p.z);
    S.paint.add(g, '#ffb703');
  }
  // The umbrella.
  const top = new THREE.Vector3(0, 2.5, 0).applyMatrix4(m);
  cyl(S.metal, [x, y, z], [top.x, top.y, top.z], 0.03, 0.03, 5, '#d0d0d0');
  for (let k = 0; k < 8; k++) {
    const g = new THREE.ConeGeometry(1.3, 0.5, 8, 1, true, (k / 8) * Math.PI * 2, Math.PI / 4);
    g.translate(top.x, top.y, top.z);
    S.paint.add(g, k % 2 ? '#ffffff' : MX.red);
  }
}

/** A paletero's cart: a white box on bicycle wheels with its bells and a PALETAS panel, a little
 *  umbrella over it. */
export function paletaCart(S: Ctx['sinks'], x: number, y: number, z: number, h: number): void {
  const m = new THREE.Matrix4().makeRotationY(-h).setPosition(x, y, z);
  box(S.paint, -0.45, 0.45, 0.35, 1.15, -0.32, 0.32, '#f8f8f5', m);
  box(S.paint, -0.47, 0.47, 0.55, 0.85, -0.335, 0.335, MX.pink, m);
  box(S.paint, -0.47, 0.47, 1.15, 1.2, -0.34, 0.34, '#2ec4b6', m);
  for (const sx of [-0.3, 0.3]) {
    const p = new THREE.Vector3(sx, 0.25, 0).applyMatrix4(m);
    const w = new THREE.TorusGeometry(0.22, 0.03, 4, 10);
    w.rotateY(-h + Math.PI / 2);
    w.translate(p.x, p.y, p.z);
    S.metal.add(w, '#2a2c30');
  }
  const handle = new THREE.Vector3(-0.75, 1.0, 0).applyMatrix4(m);
  const hb = new THREE.Vector3(-0.45, 0.9, 0).applyMatrix4(m);
  cyl(S.metal, [hb.x, hb.y, hb.z], [handle.x, handle.y, handle.z], 0.02, 0.02, 4, '#9aa0a6');
  const top = new THREE.Vector3(0, 2.0, 0).applyMatrix4(m);
  cyl(S.metal, [top.x, y + 1.2, top.z], [top.x, top.y, top.z], 0.02, 0.02, 4, '#d0d0d0');
  for (let k = 0; k < 6; k++) {
    const g = new THREE.ConeGeometry(0.75, 0.3, 6, 1, true, (k / 6) * Math.PI * 2, Math.PI / 3);
    g.translate(top.x, top.y, top.z);
    S.paint.add(g, [MX.yellow, MX.magenta, MX.turquoise][k % 3]);
  }
}

/** A Mexican flag on a bracket out of a building's face (a along it, at height y). */
export function bracketFlag(S: Ctx['sinks'], atlas: Atlas, signs: GeoBuilder, f: Frame, a: number, y: number): void {
  const base = f.p(a, y, 0);
  const tip = f.p(a, y + 1.1, -1.5);
  cyl(S.metal, base, tip, 0.03, 0.035, 5, '#d8d8d8');
  const ball = new THREE.SphereGeometry(0.06, 6, 5);
  ball.translate(tip[0], tip[1], tip[2]);
  S.gloss.add(ball, '#e0b23a');
  // The flag hangs off the pole, square to the face (seen along the street both ways).
  const top0 = f.p(a, y + 1.02, -1.38);
  const top1 = f.p(a, y + 0.42, -0.58);
  const H = 0.8;
  const facing: V3 = [f.ux, 0, f.uz];
  atlas.quad(signs, 'flagMX', [top1[0], top1[1] - H, top1[2]], [top0[0], top0[1] - H, top0[2]], top0, top1, facing);
  atlas.quad(signs, 'flagMX', [top0[0], top0[1] - H, top0[2]], [top1[0], top1[1] - H, top1[2]], top1, top0, [-f.ux, 0, -f.uz]);
}

/**
 * The BART entrance on a plaza: a flight of stairs going down into the dark between granite walls,
 * a steel-and-glass canopy over it, the blue BART sign on its totem. (x, z) the middle of the
 * stairwell's mouth at plaza height y; the stairs go down along heading h.
 */
export function bartEntrance(S: Ctx['sinks'], atlas: Atlas, signs: GeoBuilder, x: number, y: number, z: number, h: number): void {
  const m = new THREE.Matrix4().makeRotationY(-h).setPosition(x, y, z);
  const L = 7;
  const Wd = 3.4;
  // The well, dark at the bottom, and the steps down into it.
  box(S.stone, 0, L, -2.6, -2.5, -Wd / 2, Wd / 2, '#2a2a2e', m);
  const n = 14;
  for (let i = 0; i < n; i++) {
    const u0 = (i / n) * (L - 1);
    const top = -((i + 1) / n) * 2.5;
    box(S.concrete, u0, u0 + (L - 1) / n + 0.02, top - 0.2, top, -Wd / 2 + 0.2, Wd / 2 - 0.2, i % 2 ? '#b9b3a6' : '#aaa497', m);
  }
  // The walls round the well: knee-high granite on the plaza, down to the bottom inside.
  for (const sv of [-1, 1]) box(S.stone, -0.3, L, -2.6, 1.05, sv * (Wd / 2) - 0.15, sv * (Wd / 2) + 0.15, '#8f8a84', m);
  box(S.stone, L - 0.3, L, -2.6, 1.05, -Wd / 2, Wd / 2, '#8f8a84', m);
  // Handrails.
  for (const sv of [-1, 1]) {
    const a = new THREE.Vector3(0, 1.0, sv * (Wd / 2 - 0.35)).applyMatrix4(m);
    const b = new THREE.Vector3(L - 1, -1.5, sv * (Wd / 2 - 0.35)).applyMatrix4(m);
    cyl(S.metal, [a.x, a.y, a.z], [b.x, b.y, b.z], 0.03, 0.03, 4, '#c0c4c8');
  }
  // The canopy: posts, a glass roof, the steel fascia.
  for (const [u, sv] of [
    [0.2, -1],
    [0.2, 1],
    [L - 0.4, -1],
    [L - 0.4, 1],
  ] as const) {
    const p = new THREE.Vector3(u, 0, sv * (Wd / 2 + 0.05)).applyMatrix4(m);
    cyl(S.metal, [p.x, y, p.z], [p.x, y + 3.2, p.z], 0.07, 0.07, 6, '#5d6670');
  }
  box(S.glass, -0.3, L, 3.2, 3.28, -Wd / 2 - 0.4, Wd / 2 + 0.4, '#ffffff', m);
  box(S.metal, -0.35, L + 0.05, 3.28, 3.5, -Wd / 2 - 0.45, Wd / 2 + 0.45, '#3d4650', m);
  // The totem with the BART sign, at the stairs' head.
  const tp = new THREE.Vector3(-1.0, 0, Wd / 2 + 0.9).applyMatrix4(m);
  box(S.metal, tp.x - 0.12, tp.x + 0.12, y, y + 3.4, tp.z - 0.12, tp.z + 0.12, '#3d4650');
  const fwd: V3 = [Math.cos(h), 0, Math.sin(h)];
  const side: V3 = [-Math.sin(h), 0, Math.cos(h)];
  const s = 0.6;
  for (const sg of [-1, 1]) {
    const c: V3 = [tp.x - fwd[0] * 0.14 * sg, y + 2.9, tp.z - fwd[2] * 0.14 * sg];
    atlas.quad(
      signs,
      'bart',
      [c[0] - side[0] * s * sg, c[1] - s, c[2] - side[2] * s * sg],
      [c[0] + side[0] * s * sg, c[1] - s, c[2] + side[2] * s * sg],
      [c[0] + side[0] * s * sg, c[1] + s, c[2] + side[2] * s * sg],
      [c[0] - side[0] * s * sg, c[1] + s, c[2] - side[2] * s * sg],
      [-fwd[0] * sg, 0, -fwd[2] * sg],
    );
  }
}

/** A bench on a plaza: concrete ends, a wooden seat. */
export function plazaBench(S: Ctx['sinks'], x: number, y: number, z: number, h: number): void {
  const m = new THREE.Matrix4().makeRotationY(-h).setPosition(x, y, z);
  for (const u of [-0.8, 0.8]) box(S.concrete, u - 0.12, u + 0.12, 0, 0.45, -0.25, 0.25, '#b7b1a5', m);
  box(S.paint, -1.0, 1.0, 0.45, 0.52, -0.28, 0.28, '#9a6a3e', m);
}

/**
 * Trolley wires over the course from s0 to s1 (the 14-Mission's): the two pairs of running wires
 * 5.8 m up, and a pole either side at each of `poles` (arc lengths) with its span wire. Returns
 * where the poles stand.
 */
export function wires(ctx: Ctx, s0: number, s1: number, poles: number[], off: number, pointAt: (s: number) => { x: number; y: number; z: number; tx: number; tz: number }): [number, number][] {
  const S = ctx.sinks;
  const H = 5.8;
  const at = (s: number, d: number, dy: number): V3 => {
    const p = pointAt(s);
    return [p.x - p.tz * d, p.y + dy, p.z + p.tx * d];
  };
  for (const d of [-2.4, -1.8, 1.8, 2.4]) {
    for (let s = s0; s < s1 - 0.01; s += 3) cyl(S.metal, at(s, d, H), at(Math.min(s1, s + 3), d, H), 0.018, 0.018, 3, '#2a2c30');
  }
  const out: [number, number][] = [];
  for (const s of poles) {
    const l = at(s, -off, 0);
    const r = at(s, off, 0);
    for (const q of [l, r]) {
      const gy = Math.max(q[1], ctx.ground(q[0], q[2]));
      cyl(S.metal, [q[0], gy, q[2]], [q[0], gy + H + 1.2, q[2]], 0.1, 0.13, 8, '#5c6168');
      out.push([q[0], q[2]]);
    }
    cyl(S.metal, [l[0], l[1] + H + 0.9, l[2]], [r[0], r[1] + H + 0.9, r[2]], 0.02, 0.02, 3, '#2a2c30');
  }
  return out;
}

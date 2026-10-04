// Noe Valley's things, merged into the scene's builders: strollers (single, double, jogging), kids'
// balance bikes and scooters, pastel balloon arches, Dolores St's Canary Island date palms, the giant
// baby bottle, the diaper van, sign poles (a warning diamond, a pole banner), and the J Church's
// rails and wires.
import * as THREE from 'three';
import { GeoBuilder, box, cyl, obox, prism, type V3 } from '../../geo';
import type { Ctx } from '../../osg/context';
import { signQuad, type Region } from '../../osg/hayes/atlas';

type Sinks = Ctx['sinks'];

/** A matrix placing a thing at (x, y, z) with its local +x along world heading h (+z to its right). */
export function placed(x: number, y: number, z: number, h: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeRotationY(-h).setPosition(x, y, z);
}

/** A wheel: a short cylinder across local z at (x, r, z), radius r. */
function wheel(b: GeoBuilder, m: THREE.Matrix4, x: number, z: number, r: number, w: number, color: string, seg = 8): void {
  cyl(b, [x, r, z - w / 2], [x, r, z + w / 2], r, r, seg, color, m);
}

/** A stroller's canopy: a quarter-round hood over the back of a seat, from z0 to z1, its pivot at
 *  (x, y) (it covers above and behind it, reaching a little forward). */
function hood(b: GeoBuilder, m: THREE.Matrix4, x: number, y: number, r: number, z0: number, z1: number, color: string): void {
  const pts: V3[] = [[x, y, z0]];
  for (let i = 0; i <= 6; i++) {
    const a = ((50 + (140 * i) / 6) * Math.PI) / 180;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r, z0]);
  }
  prism(b, pts, [0, 0, z1 - z0], color, m);
}

export type StrollerKind = 'single' | 'double' | 'jogger';

/**
 * A stroller standing at (x, y, z), pointing along world heading h (its handle behind): a seat in
 * `fabric`, a hood in `canopy`, a basket underneath, a frame in `trim`. A double has two seats side
 * by side; a jogger three big wheels.
 */
export function stroller(S: Sinks, x: number, y: number, z: number, h: number, kind: StrollerKind, fabric: string, canopy: string, trim = '#2b2c30'): void {
  const m = placed(x, y, z, h);
  const tyre = '#1b1b1d';
  if (kind === 'jogger') {
    // One big wheel out front on a fork, two behind.
    wheel(S.paint, m, 0.62, 0, 0.2, 0.06, tyre);
    for (const s of [-1, 1]) {
      wheel(S.paint, m, -0.3, s * 0.32, 0.25, 0.07, tyre);
      cyl(S.metal, [0.62, 0.2, s * 0.05], [0.25, 0.5, s * 0.2], 0.016, 0.016, 4, trim, m);
      cyl(S.metal, [-0.3, 0.25, s * 0.3], [-0.5, 1.08, s * 0.22], 0.016, 0.016, 4, trim, m);
    }
    cyl(S.paint, [-0.5, 1.08, -0.24], [-0.5, 1.08, 0.24], 0.024, 0.024, 6, '#1c1c1c', m);
    box(S.paint, -0.25, 0.25, 0.42, 0.6, -0.22, 0.22, fabric, m);
    obox(S.paint, [-0.27, 0.74, 0], [0.06, 0.36, 0.44], [0, 0, 0.32], fabric, m);
    hood(S.paint, m, -0.16, 0.66, 0.34, -0.24, 0.24, canopy);
    box(S.paint, -0.22, 0.22, 0.2, 0.3, -0.2, 0.2, '#2a2a2e', m);
    return;
  }
  const dbl = kind === 'double';
  const half = dbl ? 0.42 : 0.28;
  for (const s of [-1, 1]) {
    wheel(S.paint, m, -0.3, s * half, 0.15, 0.05, tyre);
    wheel(S.paint, m, 0.3, s * (half - 0.04), 0.1, 0.045, tyre);
    // The legs up to the handle, and the front legs up to the seat.
    cyl(S.metal, [-0.3, 0.15, s * (half - 0.03)], [-0.43, 0.98, s * (half - 0.06)], 0.014, 0.014, 4, trim, m);
    cyl(S.metal, [0.3, 0.1, s * (half - 0.06)], [0.12, 0.5, s * (half - 0.08)], 0.012, 0.012, 4, trim, m);
  }
  cyl(S.paint, [-0.44, 0.99, -half + 0.04], [-0.44, 0.99, half - 0.04], 0.022, 0.022, 6, '#1c1c1c', m);
  const seats = dbl ? [-0.21, 0.21] : [0];
  for (const zc of seats) {
    const w = dbl ? 0.18 : 0.2;
    box(S.paint, -0.18, 0.22, 0.42, 0.58, zc - w, zc + w, fabric, m);
    obox(S.paint, [-0.2, 0.68, zc], [0.06, 0.32, w * 2], [0, 0, 0.35], fabric, m);
    hood(S.paint, m, -0.1, 0.62, 0.3, zc - w - 0.02, zc + w + 0.02, canopy);
  }
  box(S.paint, 0.2, 0.32, 0.35, 0.4, -half + 0.1, half - 0.1, trim, m);
  box(S.paint, -0.2, 0.22, 0.16, 0.28, -half + 0.08, half - 0.08, '#2a2a2e', m);
}

/** A toddler's wooden balance bike, standing at (x, y, z) along heading h. */
export function balanceBike(S: Sinks, x: number, y: number, z: number, h: number, color: string): void {
  const m = placed(x, y, z, h);
  for (const wx of [-0.28, 0.28]) wheel(S.paint, m, wx, 0, 0.15, 0.05, '#222226', 8);
  obox(S.paint, [0, 0.36, 0], [0.62, 0.07, 0.05], [0, 0, 0.18], color, m);
  box(S.paint, -0.14, 0.02, 0.43, 0.47, -0.06, 0.06, '#3a2a22', m);
  cyl(S.metal, [0.28, 0.15, 0], [0.24, 0.58, 0], 0.014, 0.014, 4, '#c8c8c8', m);
  cyl(S.paint, [0.24, 0.58, -0.17], [0.24, 0.58, 0.17], 0.018, 0.018, 5, color, m);
}

/** A kids' three-wheeled scooter at (x, y, z) along heading h. */
export function scooter(S: Sinks, x: number, y: number, z: number, h: number, color: string): void {
  const m = placed(x, y, z, h);
  box(S.paint, -0.24, 0.24, 0.05, 0.09, -0.08, 0.08, color, m);
  for (const s of [-1, 1]) wheel(S.paint, m, 0.24, s * 0.08, 0.055, 0.035, '#f2f2f2', 6);
  wheel(S.paint, m, -0.27, 0, 0.055, 0.035, '#f2f2f2', 6);
  cyl(S.metal, [0.24, 0.09, 0], [0.2, 0.68, 0], 0.016, 0.016, 4, '#d6d6d6', m);
  cyl(S.paint, [0.2, 0.68, -0.15], [0.2, 0.68, 0.15], 0.02, 0.02, 5, color, m);
}

/**
 * A balloon arch from a to b (each [x, y, z]: its feet), shaped like an upturned U as the start
 * gantry is: a column of shiny balloons straight up from each foot to `leg` above it, then an arc
 * over to `top` above the higher foot. Its colours in turn. Returns the arc's top (for a banner).
 */
export function balloonArch(S: Sinks, a: V3, b: V3, leg: number, top: number, colors: string[], rng: () => number): V3 {
  const ux = b[0] - a[0];
  const uz = b[2] - a[2];
  const len = Math.hypot(ux, uz) || 1;
  // Across the arch (horizontal, square to its span).
  const cx = -uz / len;
  const cz = ux / len;
  const yTop = Math.max(a[1], b[1]) + top;
  let n = 0;
  const cluster = (p: V3, k: number, along: V3): void => {
    for (let i = 0; i < k; i++) {
      const ang = (i / k) * Math.PI * 2 + n * 0.9;
      const r = 0.24 + rng() * 0.06;
      const off = 0.2;
      // Round the arch's line: across it, and along `along` (up a leg, or up off the arc).
      const g = new THREE.IcosahedronGeometry(r, 1);
      g.scale(1, 1.12, 1);
      g.translate(p[0] + cx * Math.cos(ang) * off + along[0] * Math.sin(ang) * off, p[1] + along[1] * Math.sin(ang) * off, p[2] + cz * Math.cos(ang) * off + along[2] * Math.sin(ang) * off);
      S.gloss.add(g, colors[(n * k + i) % colors.length]);
    }
    n++;
  };
  // The legs, straight up.
  for (const f of [a, b]) {
    const steps = Math.ceil(leg / 0.48);
    for (let i = 0; i <= steps; i++) cluster([f[0], f[1] + 0.3 + ((leg - 0.3) * i) / steps, f[2]], 2, [ux / len, 0, uz / len]);
    cyl(S.metal, [f[0], f[1], f[2]], [f[0], f[1] + 0.35, f[2]], 0.08, 0.1, 6, '#cfd3d8');
  }
  // The arc over the street, from the top of one leg to the other.
  const ya = a[1] + leg;
  const yb = b[1] + leg;
  const steps = 22;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const base = ya + (yb - ya) * t;
    cluster([a[0] + ux * t, base + (yTop - base) * Math.sin(Math.PI * t), a[2] + uz * t], 3, [0, 1, 0]);
  }
  return [(a[0] + b[0]) / 2, yTop, (a[2] + b[2]) / 2];
}

/** A Canary Island date palm at (x, y, z): a thick, scaly trunk `height` tall, the pineapple-like
 *  knob where the fronds start, and a dense round crown of arching fronds (the lowest ones brown). */
export function datePalm(S: Sinks, x: number, y: number, z: number, height: number, rng: () => number): void {
  const lean = (rng() - 0.5) * 0.4;
  const lz = (rng() - 0.5) * 0.4;
  const top: V3 = [x + lean, y + height, z + lz];
  cyl(S.foliage, [x, y - 0.3, z], top, 0.42, 0.5, 8, '#8c7356');
  // The leaf scars, a few bands.
  for (let f = 0.15; f < 0.95; f += 0.16) cyl(S.foliage, [x + lean * f, y + height * f, z + lz * f], [x + lean * f, y + height * f + 0.12, z + lz * f], 0.47, 0.47, 8, '#7a6249');
  cyl(S.foliage, [top[0], top[1] - 0.6, top[2]], [top[0], top[1] + 0.7, top[2]], 0.55, 0.62, 8, '#6d5a3c');
  const greens = ['#4f7a2e', '#5e8a35', '#476e2a', '#638f3a'];
  const N = 18;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rng() * 0.3;
    const old = i % 6 === 0;
    const up = old ? -0.35 : 0.35 + rng() * 0.35;
    const L1 = 2.0 + rng() * 0.6;
    const L2 = 1.9 + rng() * 0.6;
    const p0: V3 = [top[0], top[1] + 0.5, top[2]];
    const p1: V3 = [p0[0] + Math.cos(a) * Math.cos(up) * L1, p0[1] + Math.sin(up) * L1, p0[2] + Math.sin(a) * Math.cos(up) * L1];
    const down = old ? -1.1 : -0.35 - rng() * 0.4;
    const p2: V3 = [p1[0] + Math.cos(a) * Math.cos(down) * L2, p1[1] + Math.sin(down) * L2, p1[2] + Math.sin(a) * Math.cos(down) * L2];
    const col = old ? '#8f7d4a' : greens[i % greens.length];
    frond(S.foliage, p0, p1, 0.5, col);
    frond(S.foliage, p1, p2, 0.42, col);
  }
}

/** A flat frond blade from a to b, `w` wide, lying across (horizontal) the way it runs. */
function frond(b: GeoBuilder, a: V3, c: V3, w: number, color: string): void {
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const dz = c[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const yaw = Math.atan2(dz, dx);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz));
  const m = new THREE.Matrix4().makeRotationY(-yaw).multiply(new THREE.Matrix4().makeRotationZ(pitch)).setPosition((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2);
  box(b, -len / 2, len / 2, -0.03, 0.03, -w / 2, w / 2, color, m);
}

/** A giant baby bottle (a roof sign) standing on (x, y, z), `s` tall: the bottle, its pink collar,
 *  the teat, the measuring marks, on two steel legs. */
export function babyBottle(S: Sinks, x: number, y: number, z: number, s: number): void {
  const r = s * 0.22;
  const y0 = y + s * 0.18;
  for (const d of [-r * 0.6, r * 0.6]) cyl(S.metal, [x + d, y, z], [x + d, y0 + 0.2, z], 0.06, 0.07, 6, '#8d939a');
  // Milk to the 0.38 mark, then the empty bottle above it.
  cyl(S.gloss, [x, y0, z], [x, y0 + s * 0.38, z], r, r, 14, '#fffdf4');
  cyl(S.gloss, [x, y0 + s * 0.38, z], [x, y0 + s * 0.6, z], r, r, 14, '#dcecf7');
  for (let k = 1; k <= 5; k++) cyl(S.paint, [x, y0 + s * 0.1 * k, z], [x, y0 + s * 0.1 * k + 0.05, z], r * 1.012, r * 1.012, 14, '#6fa9d6');
  cyl(S.gloss, [x, y0 + s * 0.6, z], [x, y0 + s * 0.69, z], r * 1.08, r * 1.08, 14, '#f2a7c1');
  cyl(S.paint, [x, y0 + s * 0.69, z], [x, y0 + s * 0.8, z], r * 0.3, r * 0.62, 12, '#f2d3a8');
  const g = new THREE.SphereGeometry(r * 0.32, 10, 6);
  g.translate(x, y0 + s * 0.82, z);
  S.paint.add(g, '#f2d3a8');
}

/** The diaper van parked at (x, y, z) pointing along h: a white box van, its livery on both sides
 *  (atlas region `side`) and a BABY ON BOARD diamond on its back doors (`back`). */
export function diaperVan(S: Sinks, sign: GeoBuilder, x: number, y: number, z: number, h: number, side: Region, back: Region): void {
  const m = placed(x, y, z, h);
  const white = '#f6f8fa';
  for (const wx of [-1.7, 1.75]) for (const s of [-1, 1]) wheel(S.paint, m, wx, s * 0.92, 0.38, 0.26, '#1a1a1c', 10);
  box(S.gloss, -2.6, 2.6, 0.38, 0.95, -0.98, 0.98, white, m);
  box(S.gloss, 1.4, 2.6, 0.95, 1.95, -0.98, 0.98, white, m);
  box(S.glass, 2.45, 2.62, 1.2, 1.85, -0.85, 0.85, '#ffffff', m);
  for (const s of [-1, 1]) box(S.glass, 1.6, 2.35, 1.25, 1.85, s * 0.99 - 0.01, s * 0.99 + 0.01, '#ffffff', m);
  box(S.gloss, -2.6, 1.38, 0.95, 2.65, -1.06, 1.06, white, m);
  box(S.paint, 2.6, 2.68, 0.45, 0.7, -0.9, 0.9, '#9aa0a6', m);
  for (const s of [-1, 1]) box(S.glow, 2.58, 2.66, 0.75, 0.9, s * 0.72 - 0.12, s * 0.72 + 0.12, '#fff6d8', m);
  const p = (lx: number, ly: number, lz: number): V3 => {
    const v = new THREE.Vector3(lx, ly, lz).applyMatrix4(m);
    return [v.x, v.y, v.z];
  };
  // The livery, reading front to back... from each side as a passer-by sees it.
  signQuad(sign, side, p(-2.5, 1.0, 1.071), p(1.25, 1.0, 1.071), p(1.25, 2.55, 1.071), p(-2.5, 2.55, 1.071));
  signQuad(sign, side, p(1.25, 1.0, -1.071), p(-2.5, 1.0, -1.071), p(-2.5, 2.55, -1.071), p(1.25, 2.55, -1.071));
  // BABY ON BOARD on the back doors: a diamond (the texture is drawn turned to suit).
  const c = [-2.611, 1.9, 0] as const;
  const r = 0.38;
  // (From behind, facing +x, the viewer's right is +z.)
  signQuad(sign, back, p(c[0], c[1] - r, c[2]), p(c[0], c[1], c[2] + r), p(c[0], c[1] + r, c[2]), p(c[0], c[1], c[2] - r));
}

/**
 * A warning diamond on a pole at (x, y, z), facing traffic coming along heading h (its face turned to
 * -h): yellow, stood on its corner (the texture is drawn turned 45° to suit), a grey back.
 */
export function diamondSign(S: Sinks, sign: GeoBuilder, r: Region, x: number, y: number, z: number, h: number): void {
  cyl(S.metal, [x, y, z], [x, y + 2.75, z], 0.035, 0.04, 6, '#9aa0a6');
  const fx = -Math.cos(h);
  const fz = -Math.sin(h);
  // Across the face, to the viewer's right (they face +h: their right is (-sin h, cos h)).
  const rx = -Math.sin(h);
  const rz = Math.cos(h);
  const cy = y + 2.35;
  const k = 0.42;
  const at = (dr: number, dy: number, out: number): V3 => [x + rx * dr + fx * out, cy + dy, z + rz * dr + fz * out];
  signQuad(sign, r, at(0, -k, 0.05), at(k, 0, 0.05), at(0, k, 0.05), at(-k, 0, 0.05));
  const g = new GeoBuilder();
  g.quad(at(0, -k, 0.035), at(-k, 0, 0.035), at(0, k, 0.035), at(k, 0, 0.035), '#8d939a', [-fx, 0, -fz]);
  S.metal.add(g.build(), null);
}

/** A pole with a vertical banner on a bracket, facing traffic coming along heading h. */
export function poleBanner(S: Sinks, sign: GeoBuilder, r: Region, x: number, y: number, z: number, h: number, toward: number): void {
  cyl(S.metal, [x, y, z], [x, y + 5.6, z], 0.06, 0.08, 8, '#3f4a44');
  const fx = -Math.cos(h);
  const fz = -Math.sin(h);
  // The bracket reaches out over the sidewalk towards the street (`toward`: the street's side of the
  // pole, as a world heading), the banner hanging from it.
  const ox = Math.cos(toward);
  const oz = Math.sin(toward);
  const w = 0.6;
  const hh = w / r.aspect;
  for (const yy of [y + 5.3, y + 5.3 - hh]) cyl(S.metal, [x, yy, z], [x + ox * (w + 0.1), yy, z + oz * (w + 0.1)], 0.02, 0.02, 4, '#3f4a44');
  const p = (u: number, v: number, out: number): V3 => [x + ox * u + fx * out, v, z + oz * u + fz * out];
  // Seen from the front (facing +h), is the bracket off to the viewer's right ((-sin h, cos h))?
  const rightIsOut = -Math.sin(h) * ox + Math.cos(h) * oz > 0;
  const [u0, u1] = rightIsOut ? [0.1, 0.1 + w] : [0.1 + w, 0.1];
  signQuad(sign, r, p(u0, y + 5.3 - hh, 0.02), p(u1, y + 5.3 - hh, 0.02), p(u1, y + 5.3, 0.02), p(u0, y + 5.3, 0.02));
  signQuad(sign, r, p(u1, y + 5.3 - hh, -0.02), p(u0, y + 5.3 - hh, -0.02), p(u0, y + 5.3, -0.02), p(u1, y + 5.3, -0.02));
}

/** A rail (or a pair of contact wires' worth of steel) along a polyline of world points [x, y, z]:
 *  a flat strip `w` wide, its top at the points' heights. */
export function railStrip(b: GeoBuilder, pts: V3[], w: number, color: string): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const c = pts[i + 1];
    const dx = c[0] - a[0];
    const dz = c[2] - a[2];
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * (w / 2);
    const nz = (dx / len) * (w / 2);
    b.quad([a[0] - nx, a[1], a[2] - nz], [c[0] - nx, c[1], c[2] - nz], [c[0] + nx, c[1], c[2] + nz], [a[0] + nx, a[1], a[2] + nz], color, [0, 1, 0]);
  }
}

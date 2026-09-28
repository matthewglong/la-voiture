// The trees of Buena Vista's woods (and Duboce Park's), in the toy style of props.ts: coast live oaks
// (a short crooked trunk under a broad dome of dark olive), blue gum eucalyptus (tall and pale, the
// leaves hanging in loose grey-green clumps high up), Monterey pines (a bare trunk and a lumpy,
// flat-topped crown) and the understorey's shrubs. Monterey cypresses and the stacked-cone pines come
// from props.ts. Every one a few dozen triangles, merged into the foliage.
import * as THREE from 'three';
import { cyl, type GeoBuilder } from '../../geo';

const OAK = ['#4b6b35', '#56773c', '#40602f', '#5d7c41'];
const GUM = ['#65866f', '#71907a', '#5a7b66', '#7a967f'];
const PINE = ['#2f5234', '#365b39', '#2b4a2f'];
const SHRUB = ['#4f7a3c', '#5b8743', '#46703a', '#6a8f47'];

/** A clump of leaves: a low-poly ball stretched to (rx, ry, rz), turned `yaw`, at (x, y, z). */
function clump(b: GeoBuilder, x: number, y: number, z: number, rx: number, ry: number, rz: number, yaw: number, color: string): void {
  const g = new THREE.IcosahedronGeometry(1, 0);
  g.scale(rx, ry, rz);
  g.rotateY(yaw);
  g.translate(x, y, z);
  b.add(g, color);
}

/** A coast live oak, `s` about 1 (8 m across): the trunk leans and forks, the crown is broad. */
export function liveOak(b: GeoBuilder, x: number, y: number, z: number, s: number, rng: () => number): void {
  const a = rng() * Math.PI * 2;
  const lx = Math.cos(a) * 0.7 * s;
  const lz = Math.sin(a) * 0.7 * s;
  const ty = y + 1.9 * s;
  cyl(b, [x, y - 0.3, z], [x + lx, ty, z + lz], 0.24 * s, 0.36 * s, 5, '#5b4a3a');
  // A limb off the other way.
  cyl(b, [x + lx * 0.5, y + 1.2 * s, z + lz * 0.5], [x - lx * 1.6, ty + 0.9 * s, z - lz * 1.6], 0.12 * s, 0.17 * s, 4, '#5b4a3a');
  const n = 3 + (rng() < 0.5 ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const t = a + (k / n) * Math.PI * 2 + rng() * 0.8;
    const r = (0.9 + rng() * 0.9) * s;
    const cx = x + lx * 0.4 + Math.cos(t) * r;
    const cz = z + lz * 0.4 + Math.sin(t) * r;
    const rr = (1.9 + rng() * 0.6) * s;
    clump(b, cx, ty + (1.0 + rng() * 0.9) * s, cz, rr, rr * 0.62, rr * (0.85 + rng() * 0.3), rng() * 3, OAK[Math.floor(rng() * OAK.length)]);
  }
}

/** A blue gum, `s` about 1 (15 m tall): a tall pale trunk, limbs reaching out from its top half,
 *  each hung with a loose clump of leaves, and a ragged top. */
export function eucalyptus(b: GeoBuilder, x: number, y: number, z: number, s: number, rng: () => number): void {
  const a = rng() * Math.PI * 2;
  const lean = 0.4 + rng() * 0.8;
  const tx = x + Math.cos(a) * lean * s;
  const tz = z + Math.sin(a) * lean * s;
  const h = (11 + rng() * 4) * s;
  const bark = rng() < 0.5 ? '#d8cdb8' : '#c7b9a0';
  cyl(b, [x, y - 0.3, z], [tx, y + h, tz], 0.14 * s, 0.34 * s, 6, bark);
  for (let k = 0; k < 3; k++) {
    const la = a + (k / 3) * Math.PI * 2 + rng() * 0.9;
    const f = 0.5 + rng() * 0.32;
    const bx = x + (tx - x) * f;
    const by = y + h * f;
    const bz = z + (tz - z) * f;
    const reach = (1.8 + rng() * 1.4) * s;
    const ex = bx + Math.cos(la) * reach;
    const ey = by + (1.2 + rng() * 1.8) * s;
    const ez = bz + Math.sin(la) * reach;
    cyl(b, [bx, by, bz], [ex, ey, ez], 0.05 * s, 0.09 * s, 3, bark);
    const r = (1.0 + rng() * 0.45) * s;
    // Hanging: taller than wide, and below the limb's end.
    clump(b, ex, ey - 0.35 * s, ez, r * 1.05, r * 1.4, r * 0.9, rng() * 3, GUM[Math.floor(rng() * GUM.length)]);
  }
  clump(b, tx, y + h + 0.2 * s, tz, 1.35 * s, 1.7 * s, 1.15 * s, rng() * 3, GUM[Math.floor(rng() * GUM.length)]);
}

/** A Monterey pine, `s` about 1 (12 m tall): a straight bare trunk and a lumpy, flat-topped crown. */
export function montereyPine(b: GeoBuilder, x: number, y: number, z: number, s: number, rng: () => number): void {
  const h = (7.5 + rng() * 2) * s;
  cyl(b, [x, y - 0.3, z], [x, y + h + 1.2 * s, z], 0.14 * s, 0.3 * s, 5, '#5a4636');
  for (let k = 0; k < 4; k++) {
    const t = rng() * Math.PI * 2;
    const r = k === 0 ? 0 : (1.2 + rng() * 0.8) * s;
    const cr = (1.7 + rng() * 0.6) * s;
    clump(b, x + Math.cos(t) * r, y + h + (k === 0 ? 1.1 : rng() * 0.8) * s, z + Math.sin(t) * r, cr * 1.2, cr * 0.55, cr, rng() * 3, PINE[k % PINE.length]);
  }
}

/** An understorey shrub (toyon, coffeeberry, broom): a low ball of leaves. */
export function shrub(b: GeoBuilder, x: number, y: number, z: number, s: number, rng: () => number): void {
  clump(b, x, y + 0.45 * s, z, 1.1 * s, 0.75 * s, (0.9 + rng() * 0.4) * s, rng() * 3, SHRUB[Math.floor(rng() * SHRUB.length)]);
}

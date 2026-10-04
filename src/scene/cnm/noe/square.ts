// Noe Valley Town Square, on the south side of 24th between Sanchez and Vicksburg: a paved square at
// the sidewalk's level behind low planters, its name over the way in; Saturday's farmers' market
// under white tents; a stroller corral (full); benches under two trees; and at the back a little play
// area (a climbing frame with a slide, a sandbox, spring riders) with the kids' bikes dropped by it.
import * as THREE from 'three';
import { box, cyl, obox, prism, type V3 } from '../../geo';
import { markThing } from '../../osg/kerbside';
import { Frame, bench, faceSign, planter, streetTree, type Kit } from '../../osg/hayes/kit';
import { paveQuad } from '../../osg/paving';
import { balanceBike, scooter, stroller, type StrollerKind } from './props';

/** The square's frame: f at its street-front west corner (u east along 24th, w south into it), its
 *  width along the street and depth, the sidewalk's height. */
export function buildTownSquare(k: Kit, f: Frame, W: number, D: number, y: number, fabrics: [string, string][]): void {
  const S = k.S;
  const rng = k.rng;
  const p = (u: number, yy: number, w: number): V3 => f.p(u, yy, w);
  // --- The floor: scored paving at the sidewalk's level, its edges skirted down into the ground.
  {
    const n = 4;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const u0 = (W * i) / n;
        const u1 = (W * (i + 1)) / n;
        const w0 = (D * j) / n;
        const w1 = (D * (j + 1)) / n;
        paveQuad(S.sidewalk, p(u0, y + 0.012, w0), p(u1, y + 0.012, w0), p(u1, y + 0.012, w1), p(u0, y + 0.012, w1));
      }
    }
    const g = (u: number, w: number): number => Math.min(y - 0.3, k.ctx.ground(p(u, 0, w)[0], p(u, 0, w)[2]) - 0.3);
    box(S.concrete, -0.15, 0.0, g(0, D / 2), y + 0.012, 0, D, '#cdc6b8', f.m);
    box(S.concrete, W, W + 0.15, g(W, D / 2), y + 0.012, 0, D, '#cdc6b8', f.m);
    box(S.concrete, -0.15, W + 0.15, g(W / 2, D), y + 0.012, D, D + 0.15, '#cdc6b8', f.m);
  }
  // --- Planters along the street side, with two ways in; the name over the first.
  const h = Math.atan2(f.uz, f.ux);
  for (const [u0, u1] of [
    [0.3, 2.9],
    [5.2, 7.0],
    [W - 1.6, W - 0.3],
  ] as const) {
    const c = p((u0 + u1) / 2, 0, 0.75);
    planter(k, c[0], y, c[2], h, u1 - u0, 0.8, '#7b8a6a', '#5f9a4c');
    markThing(k.ctx, c[0], c[2], 0.5);
  }
  {
    const r = k.atlas.get('townSquare');
    for (const u of [3.05, 5.05]) {
      const q = p(u, 0, 0.55);
      cyl(S.metal, [q[0], y, q[2]], [q[0], y + 3.3, q[2]], 0.06, 0.07, 8, '#2c4a32');
      markThing(k.ctx, q[0], q[2], 0.25);
    }
    box(S.paint, 2.9, 5.2, y + 2.55, y + 3.25, 0.5, 0.62, '#355e3b', f.m);
    faceSign(k, f, r, 4.05, y + 2.62, 0.56, 0.48, 2.2);
  }
  // --- The stroller corral, out front at the east end (rails round it, the street side open),
  // every space taken.
  {
    const u0 = W - 4.3;
    const u1 = W - 0.4;
    const w0 = 1.6;
    const w1 = 5.4;
    const rail = (a: V3, b: V3): void => cyl(S.metal, a, b, 0.025, 0.025, 5, '#2f3a44');
    const corners: [number, number][] = [
      [u0, w0],
      [u0, w1],
      [u1, w1],
      [u1, w0],
    ];
    for (const [u, w] of corners) {
      const q = p(u, y, w);
      cyl(S.metal, q, [q[0], y + 0.85, q[2]], 0.03, 0.03, 5, '#2f3a44');
    }
    for (let i = 0; i < 3; i++) {
      const [ua, wa] = corners[i];
      const [ub, wb] = corners[i + 1];
      rail(p(ua, y + 0.85, wa), p(ub, y + 0.85, wb));
      rail(p(ua, y + 0.45, wa), p(ub, y + 0.45, wb));
    }
    const sign = k.atlas.get('strollerParking');
    const q = p(u0 - 0.15, 0, w0 - 0.2);
    cyl(S.metal, [q[0], y, q[2]], [q[0], y + 2.3, q[2]], 0.035, 0.04, 6, '#9aa0a6');
    faceSign(k, f, sign, u0 - 0.15, y + 1.55, 0.7, w0 - 0.24);
    const kinds: StrollerKind[] = ['single', 'double', 'single', 'single', 'jogger', 'single'];
    for (let i = 0; i < 6; i++) {
      const u = u0 + 0.45 + i * 0.62 + (kinds[i] === 'double' ? 0.12 : 0);
      if (u > u1 - 0.3) break;
      const c = p(u, 0, 3.6);
      const [fab, can] = fabrics[(i * 3 + 1) % fabrics.length];
      // Nose to the street, as they're wheeled in.
      stroller(S, c[0], y, c[2], Math.atan2(-f.wz, -f.wx), kinds[i], fab, can);
    }
  }
  // --- The farmers' market: two white tents, their tables heaped with produce.
  const crates = ['#d8392f', '#f29c1f', '#6ba539', '#7a3c8c', '#f2c81e', '#3d7a2a', '#e86a3c'];
  for (const [u0, u1] of [
    [0.6, 4.4],
    [4.9, 8.7],
  ] as const) {
    const w0 = 7.0;
    const w1 = 10.4;
    for (const [u, w] of [
      [u0, w0],
      [u1, w0],
      [u0, w1],
      [u1, w1],
    ] as const) {
      const q = p(u, y, w);
      cyl(S.metal, q, [q[0], y + 2.45, q[2]], 0.035, 0.035, 5, '#d8d8d8');
    }
    // The roof, a shallow peak, and its scalloped valance.
    const um = (u0 + u1) / 2;
    const wm = (w0 + w1) / 2;
    prism(S.paint, [p(u0 - 0.1, y + 2.45, w0 - 0.1), p(u1 + 0.1, y + 2.45, w0 - 0.1), p(um, y + 2.95, wm)], [0, 0.02, 0], '#fbfbf7');
    prism(S.paint, [p(u1 + 0.1, y + 2.45, w0 - 0.1), p(u1 + 0.1, y + 2.45, w1 + 0.1), p(um, y + 2.95, wm)], [0, 0.02, 0], '#f1f1ec');
    prism(S.paint, [p(u1 + 0.1, y + 2.45, w1 + 0.1), p(u0 - 0.1, y + 2.45, w1 + 0.1), p(um, y + 2.95, wm)], [0, 0.02, 0], '#fbfbf7');
    prism(S.paint, [p(u0 - 0.1, y + 2.45, w1 + 0.1), p(u0 - 0.1, y + 2.45, w0 - 0.1), p(um, y + 2.95, wm)], [0, 0.02, 0], '#f1f1ec');
    box(S.paint, u0 - 0.1, u1 + 0.1, y + 2.2, y + 2.45, w0 - 0.12, w0 - 0.08, '#fbfbf7', f.m);
    // The table along the front, crates on it.
    box(S.paint, u0 + 0.2, u1 - 0.2, y + 0.72, y + 0.78, w0 + 0.3, w0 + 1.2, '#8a6a48', f.m);
    for (const u of [u0 + 0.35, u1 - 0.35]) box(S.paint, u - 0.03, u + 0.03, y, y + 0.72, w0 + 0.7, w0 + 0.76, '#5a4a38', f.m);
    for (let u = u0 + 0.35; u < u1 - 0.5; u += 0.55) {
      const c = crates[Math.floor(rng() * crates.length)];
      box(S.paint, u, u + 0.45, y + 0.78, y + 0.98, w0 + 0.4, w0 + 1.1, '#b08a5c', f.m);
      box(S.paint, u + 0.04, u + 0.41, y + 0.98, y + 1.06, w0 + 0.44, w0 + 1.06, c, f.m);
    }
  }
  faceSign(k, f, k.atlas.get('farmers'), 2.5, y + 2.22, 0.21, 6.86, 3.6);
  // --- Benches under two trees.
  for (const [u, w] of [
    [2.2, 13.5],
    [W - 2.4, 14.2],
  ] as const) {
    const q = p(u, 0, w);
    streetTree(k, q[0], y, q[2], 1.0, ['#5f9a4c', '#6fa857', '#4f8a3f']);
    const b = p(u, 0, w + 1.6);
    bench(k, b[0], y, b[2], Math.atan2(-f.wz, -f.wx), '#2f5d3a', 1.6);
  }
  {
    const b = p(W / 2, 0, 12.5);
    bench(k, b[0], y, b[2], Math.atan2(f.wz, f.wx), '#2f5d3a', 1.8);
  }
  // --- The play area at the back: soft red surface, a climbing frame with a yellow slide, a sandbox,
  // two spring riders.
  {
    const w0 = 17;
    const w1 = D - 0.6;
    box(S.paint, 0.5, W - 0.5, y + 0.012, y + 0.04, w0, w1, '#c4553f', f.m);
    // The frame: a platform on four posts, a peaked roof, a ladder up, the slide down.
    const fu = 3.2;
    const fw = w0 + 2.6;
    for (const [du, dw] of [
      [-0.6, -0.6],
      [0.6, -0.6],
      [-0.6, 0.6],
      [0.6, 0.6],
    ] as const) {
      const q = p(fu + du, y, fw + dw);
      cyl(S.paint, q, [q[0], y + 2.4, q[2]], 0.05, 0.05, 6, '#2f80d6');
    }
    box(S.paint, fu - 0.65, fu + 0.65, y + 1.05, y + 1.15, fw - 0.65, fw + 0.65, '#f2c81e', f.m);
    prism(S.paint, [p(fu - 0.75, y + 2.4, fw - 0.75), p(fu + 0.75, y + 2.4, fw - 0.75), p(fu + 0.75, y + 2.4, fw + 0.75), p(fu - 0.75, y + 2.4, fw + 0.75)], [0, 0.08, 0], '#e2453c');
    prism(S.paint, [p(fu - 0.75, y + 2.48, fw - 0.75), p(fu + 0.75, y + 2.48, fw - 0.75), p(fu, y + 3.1, fw)], [0, 0.01, 0], '#e2453c');
    for (let r = 0; r < 4; r++) box(S.paint, fu - 0.95, fu - 0.65, y + 0.25 + r * 0.25, y + 0.29 + r * 0.25, fw - 0.4, fw + 0.4, '#2f80d6', f.m);
    {
      const a = p(fu + 0.65, y + 1.1, fw);
      const b = p(fu + 2.4, y + 0.25, fw);
      const len = Math.hypot(b[0] - a[0], b[2] - a[2], b[1] - a[1]);
      const ang = Math.atan2(a[1] - b[1], 1.75);
      obox(S.gloss, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [len, 0.06, 0.55], [0, -Math.atan2(f.uz, f.ux), -ang], '#f2c81e');
    }
    // The sandbox.
    const su = W - 3.3;
    const sw = w0 + 2.2;
    box(S.paint, su - 1.3, su + 1.3, y, y + 0.3, sw - 1.1, sw + 1.1, '#9a7650', f.m);
    box(S.paint, su - 1.15, su + 1.15, y + 0.3, y + 0.32, sw - 0.95, sw + 0.95, '#e9d6a6', f.m);
    // Spring riders: a duck and a whale on their coils.
    for (const [u, w, color] of [
      [W / 2 - 0.4, w0 + 4.6, '#f2c81e'],
      [W / 2 + 1.2, w0 + 4.9, '#3fa0d8'],
    ] as const) {
      const q = p(u, y, w);
      cyl(S.metal, q, [q[0], y + 0.45, q[2]], 0.09, 0.09, 6, '#e2453c');
      const b = new THREE.SphereGeometry(0.32, 10, 6);
      b.scale(1.3, 0.8, 0.8);
      b.rotateY(-Math.atan2(f.uz, f.ux));
      b.translate(q[0], y + 0.72, q[2]);
      S.gloss.add(b, color);
      const hd = new THREE.SphereGeometry(0.17, 8, 6);
      hd.translate(q[0] + f.ux * 0.38, y + 1.0, q[2] + f.uz * 0.38);
      S.gloss.add(hd, color);
    }
    // The bikes and scooters dropped by it.
    const bikes = ['#e2453c', '#3fa0d8', '#6ba539'];
    for (let i = 0; i < 3; i++) {
      const q = p(1.0 + i * 0.9, 0, w0 - 0.7);
      if (i === 2) scooter(S, q[0], y, q[2], Math.atan2(f.wz, f.wx) + 0.4, '#f2a7c1');
      else balanceBike(S, q[0], y, q[2], Math.atan2(f.uz, f.ux) + (i ? 0.5 : -0.3), bikes[i]);
    }
  }
  k.ctx.occ.claim(f.poly(-0.2, W + 0.2, 0, D + 0.3));
}

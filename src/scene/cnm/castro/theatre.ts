// The Castro Theatre (1922), on the east side of the 400 block, where the race starts: its Spanish
// Colonial front in cream stucco, the stepped and scrolled crest over a great arched window, the
// marquee over the doors (LA VOITURE GRAND PRIX, today only) with its bulbs, and the tall red
// CASTRO blade standing out over it, readable up and down the street. Built in the frame of its lot
// (osg/haight/building.ts's Frame: a along the front, c into the building).
import * as THREE from 'three';
import type { V3 } from '../../geo';
import type { Lot } from '../../victorian';
import { Frame, type Sinks } from '../../osg/haight/building';

const CREAM = '#ecdfc2';
const STONE = '#dccaa4';
const RED = '#8a1424';
const GOLD = '#c9a24a';

/** The theatre on its lot, the sidewalk at y0; returns its depth and how far the marquee reaches out. */
export function castroTheatre(k: Sinks, lot: Lot, y0: number): { D: number; out: number } {
  const S = k.ctx.sinks;
  const f = Frame.of(lot);
  const W = lot.W;
  const D = 22;
  const H = 12.6;
  let yLow = Infinity;
  for (const [a, c] of [
    [0, 0],
    [W, 0],
    [0, D],
    [W, D],
  ]) {
    const q = f.p(a, 0, c);
    yLow = Math.min(yLow, k.ctx.ground(q[0], q[2]));
  }
  yLow -= 0.5;
  // The auditorium's long box behind, the front block taller.
  f.rbox(S.walls, 0.05, W - 0.05, yLow, y0 + H - 1.2, 3, D, 0.15, '#e2d3b2');
  f.rbox(S.walls, 0.02, W - 0.02, yLow, y0 + H, 0, 3.2, 0.12, CREAM);
  // A plinth of darker stone along the bottom, pilasters at the ends and either side of the window.
  f.box(S.trim, -0.05, W + 0.05, y0 - 0.2, y0 + 0.7, -0.12, 0.02, STONE);
  for (const a of [0.35, W / 2 - 2.6, W / 2 + 2.6, W - 0.35]) f.box(S.trim, a - 0.35, a + 0.35, y0, y0 + H - 0.6, -0.28, 0, STONE);
  // The crest: a stepped gable over the middle bay, scrolls at its shoulders, an urn on top and a
  // cartouche in it.
  {
    const mid = W / 2;
    const yT = y0 + H;
    const steps: [number, number, number][] = [
      [3.7, 0, 1.0],
      [2.6, 1.0, 1.8],
      [1.7, 1.8, 2.6],
      [0.8, 2.6, 3.1],
    ];
    for (const [hw, ya, yb] of steps) f.box(S.walls, mid - hw, mid + hw, yT + ya - 0.02, yT + yb, -0.05, 0.6, CREAM);
    for (const [hw, , yb] of steps) f.box(S.trim, mid - hw - 0.08, mid + hw + 0.08, yT + yb - 0.12, yT + yb + 0.06, -0.12, 0.65, STONE);
    for (const s of [-1, 1]) {
      const g = new THREE.TorusGeometry(0.42, 0.13, 6, 12);
      g.applyMatrix4(new THREE.Matrix4().makeTranslation(mid + s * 3.25, yT + 1.25, -0.08).premultiply(f.m));
      S.trim.add(g, STONE);
    }
    const urn = new THREE.SphereGeometry(0.32, 10, 8);
    urn.applyMatrix4(new THREE.Matrix4().makeTranslation(mid, yT + 3.45, 0.3).premultiply(f.m));
    S.trim.add(urn, GOLD);
    f.sign(k.atlas, k.signs, 'theatreCrest', mid - 0.75, mid + 0.75, yT + 0.75, yT + 2.25, -0.08);
  }
  // The cornice along the top, and the great arched window over the marquee.
  f.box(S.trim, -0.2, W + 0.2, y0 + H - 0.5, y0 + H, -0.45, 0.02, STONE);
  {
    const a0 = W / 2 - 1.9;
    const a1 = W / 2 + 1.9;
    const yb = y0 + 6.4;
    const yt = y0 + 10.4;
    f.box(S.trim, a0 - 0.25, a1 + 0.25, yb - 0.25, yt, -0.12, 0.02, STONE);
    f.box(S.glass, a0, a1, yb, yt - 1.6, -0.16, -0.1, '#c4b38a');
    // The arch's head: a fan of glass segments under a stone arch.
    const ac = (a0 + a1) / 2;
    const r = (a1 - a0) / 2;
    const yc = yt - 1.6;
    for (let i = 0; i < 8; i++) {
      const t0 = (i / 8) * Math.PI;
      const t1 = ((i + 1) / 8) * Math.PI;
      const p = (t: number, rr: number, c: number): V3 => f.p(ac + Math.cos(t) * rr, yc + Math.sin(t) * rr, c);
      S.glass.quad(p(t0, 0, -0.16), p(t0, r, -0.16), p(t1, r, -0.16), p(t1, 0, -0.16), '#c4b38a', [f.out[0], 0, f.out[2]]);
      S.trim.quad(p(t0, r, -0.2), p(t0, r + 0.32, -0.2), p(t1, r + 0.32, -0.2), p(t1, r, -0.2), STONE, [f.out[0], 0, f.out[2]]);
    }
    // Mullions.
    for (const a of [a0 + (a1 - a0) / 3, a0 + (2 * (a1 - a0)) / 3]) f.box(S.trim, a - 0.05, a + 0.05, yb, yc, -0.2, -0.14, STONE);
  }
  // Small windows either side, up high.
  for (const a of [1.6, W - 1.6]) f.box(S.glass, a - 0.45, a + 0.45, y0 + 7.4, y0 + 9.2, -0.08, -0.04, '#c4b38a');

  // --- The entrance: a recess of doors and the ticket booth, posters either side.
  {
    const a0 = W / 2 - 3.2;
    const a1 = W / 2 + 3.2;
    f.box(S.paint, a0, a1, y0, y0 + 3.6, 0.6, 0.7, '#3a1a14');
    for (let a = a0 + 0.4; a < a1 - 0.6; a += 1.1) f.box(S.glass, a, a + 0.9, y0 + 0.05, y0 + 2.5, 0.5, 0.58, '#9aa6b4');
    // The booth.
    f.box(S.trim, W / 2 - 0.7, W / 2 + 0.7, y0, y0 + 2.6, -0.4, 0.3, GOLD);
    f.box(S.glass, W / 2 - 0.55, W / 2 + 0.55, y0 + 1.1, y0 + 2.3, -0.45, -0.35, '#cfe0ea');
    k.doors.push({ x: f.p(W / 2, 0, 0)[0], z: f.p(W / 2, 0, 0)[2] });
    // Poster cases.
    for (const a of [W / 2 - 4.2, W / 2 + 4.2]) {
      f.box(S.trim, a - 0.6, a + 0.6, y0 + 0.8, y0 + 2.7, -0.1, 0.02, GOLD);
      f.box(S.paint, a - 0.5, a + 0.5, y0 + 0.9, y0 + 2.6, -0.13, -0.1, '#7a1222');
    }
  }

  // --- The marquee: out over the sidewalk, its board on the front and both ends, bulbs underneath.
  const out = 1.25;
  {
    const a0 = W / 2 - 4.4;
    const a1 = W / 2 + 4.4;
    const yb = y0 + 3.9;
    const yt = y0 + 5.25;
    f.box(S.paint, a0, a1, yb, yt, -out, 0, '#fbf4dc');
    f.box(S.trim, a0 - 0.1, a1 + 0.1, yt, yt + 0.16, -out - 0.1, 0, RED);
    f.box(S.trim, a0 - 0.1, a1 + 0.1, yb - 0.16, yb, -out - 0.1, 0, RED);
    f.sign(k.atlas, k.signs, 'marquee', a0 + 0.08, a1 - 0.08, yb + 0.05, yt - 0.05, -out - 0.02);
    // The ends, read along the street.
    const endFace = (a: number, s: number): void => {
      const p = (c: number, y: number): V3 => f.p(a + s * 0.02, y, c);
      // (Seen from +a, c into the building runs to the left; from -a, to the right.)
      const l = s > 0 ? 0 : -out;
      const r = s > 0 ? -out : 0;
      k.atlas.quad(k.signs, 'marqueeEnd', p(l, yb + 0.05), p(r, yb + 0.05), p(r, yt - 0.05), p(l, yt - 0.05), [f.ux * s, 0, f.uz * s]);
    };
    endFace(a1, 1);
    endFace(a0, -1);
    // Bulbs under it.
    for (let a = a0 + 0.25; a < a1; a += 0.42) {
      for (const c of [-out + 0.15, -0.25]) f.box(S.glow, a - 0.06, a + 0.06, yb - 0.24, yb - 0.16, c - 0.06, c + 0.06, '#fff1b8');
    }
  }

  // --- The blade: CASTRO top to bottom, standing out from the front over the marquee, both faces, and
  // a crown of neon on top.
  {
    const a = W / 2;
    const yb = y0 + 5.8;
    const yt = y0 + 15.6;
    const c0 = -0.4;
    const c1 = -1.95;
    f.box(S.paint, a - 0.12, a + 0.12, yb, yt, c1, c0, RED);
    f.box(S.glow, a - 0.15, a + 0.15, yt - 0.02, yt + 0.12, c1, c0, '#ffe37a');
    f.box(S.glow, a - 0.15, a + 0.15, yb - 0.12, yb + 0.02, c1, c0, '#ffe37a');
    const face = (s: number): void => {
      const p = (c: number, y: number): V3 => f.p(a + s * 0.13, y, c);
      const l = s > 0 ? c0 : c1;
      const r = s > 0 ? c1 : c0;
      k.atlas.quad(k.signs, 'castroBlade', p(l, yb + 0.1), p(r, yb + 0.1), p(r, yt - 0.1), p(l, yt - 0.1), [f.ux * s, 0, f.uz * s]);
    };
    face(1);
    face(-1);
    // Its brackets to the wall.
    for (const y of [yb + 1.2, yt - 1.2]) f.box(S.metal, a - 0.05, a + 0.05, y - 0.05, y + 0.05, c0, 0.02, '#2a2c30');
  }
  return { D, out };
}

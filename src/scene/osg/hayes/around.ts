// Round the edges of the shops block: Marine Layer across Octavia on the north-east corner (tan
// brick, red fire escapes, its ground floor painted blue: straight ahead as the course comes down
// the block to the turn), Suppenküche on the south-west corner of Laguna (mustard yellow, its name
// in big black letters along the wall, red umbrellas over its parklet; a narrow Victorian up the hill
// from it), and the 21 Hayes' trolley wires down Hayes from Steiner.
import * as THREE from 'three';
import { pointAt } from '../../../track';
import { box, cyl } from '../../geo';
import type { Turn } from '../streets';
import { markThing } from '../kerbside';
import { KERB, POLE_SET, STREET_KINDS, WALK } from '../streets';
import { buildHouse } from '../../victorian';
import { DEPTH, building, type Bldg } from './block';
import { Frame, cafeSet, faceSign, type Kit } from './kit';

const MARINE_LAYER: Bldg = {
  kind: 'flat',
  floors: 3,
  color: '#d49a74',
  trim: '#efe4d2',
  accent: '#8a4a3a',
  escape: '#b8352c',
  corner: true,
  fronts: [{ sign: 'marineLayer', blade: 'b_marineLayer', real: 12, frame: '#2f5d9e', fascia: '#2f5d9e', win: 'clothes', door: 'W', pier: '#2f5d9e', bulk: '#2f5d9e' }],
};

const SUPPENKUCHE: Bldg = {
  kind: 'blank',
  floors: 1,
  color: '#d6ae3a',
  trim: '#b8922a',
  accent: '#d6ae3a',
  corner: true,
  fronts: [{ real: 7, frame: '#3a2a1c', fascia: '#c49a2c', win: 'cafe', door: 'E', pier: '#d6ae3a', wood: '#6b4a30' }],
};

/** Marine Layer on the north-east corner of Hayes & Octavia (across the course's turn). */
export function buildMarineLayer(k: Kit, turn: Turn): void {
  const ctx = k.ctx;
  const hw = 6.5;
  const tx = Math.cos(turn.hIn);
  const tz = Math.sin(turn.hIn);
  // The Hayes arm runs on east from the corner; its north sidewalk's back is 10 m left of its middle.
  const W = 12;
  const a0 = hw + WALK;
  const at = (a: number, d: number): [number, number] => [turn.x + tx * a + tz * d, turn.z + tz * a - tx * d];
  const [ox, oz] = at(a0 + W, hw + WALK);
  const f = new Frame(ox, oz, -tx, -tz);
  const [cx, cz] = at(a0, hw + WALK);
  const gs = [ctx.ground(ox, oz), ctx.ground(cx, cz)];
  const yb = Math.max(...gs, turn.y) + KERB + 0.03;
  const ylo = Math.min(...gs, turn.y) + KERB;
  building(k, f, W, yb, ylo, MARINE_LAYER, [{ s: MARINE_LAYER.fronts[0], u0: 0, u1: W }], true, 1);
  // The red and yellow stripe up the corner.
  box(k.S.paint, W - 0.08, W + 0.02, ylo, yb + 3.95, -0.2, -0.1, '#e03a2f', f.m);
  box(k.S.paint, W + 0.02, W + 0.12, ylo, yb + 3.95, -0.2, -0.1, '#f6c21c', f.m);
  ctx.occ.claim(f.poly(-0.2, W + 0.2, 0, DEPTH + 0.5));
}

/** Suppenküche on the south-west corner of Hayes & Laguna (sLaguna: where the crossing starts). */
export function buildSuppenkuche(k: Kit, sLaguna: number): void {
  const ctx = k.ctx;
  const c = ctx.course;
  const S = k.S;
  // Its east wall on the back of Laguna's west sidewalk.
  const sE = sLaguna - WALK;
  const W = 7;
  const sW = sE - W;
  const p = pointAt(c, sW);
  const [ox, oz] = [p.x - p.tz * (6.5 + WALK), p.z + p.tx * (6.5 + WALK)];
  const f = new Frame(ox, oz, p.tx, p.tz);
  const ys = [pointAt(c, sW).y, pointAt(c, sE).y];
  const yb = Math.max(...ys) + KERB + 0.03;
  const ylo = Math.min(...ys) + KERB;
  building(k, f, W, yb, ylo, SUPPENKUCHE, [{ s: SUPPENKUCHE.fronts[0], u0: 0, u1: W }], false, 1);
  // Up the hill from it, the rest of the frontage is too short for the row of Victorians the streets
  // give it: one narrow house.
  const sec = c.sections.find((q) => q.s1 > sW - 1 && q.s0 < sW - 1);
  if (sec) {
    const s0 = sec.s0 + 0.3;
    if (sW - s0 > 4.6) {
      const q = pointAt(c, s0);
      const lot = { ox: q.x - q.tz * (6.5 + WALK), oz: q.z + q.tx * (6.5 + WALK), ux: q.tx, uz: q.tz, W: sW - s0 - 0.1 };
      buildHouse(S, lot, k.rng, ctx.site, { exposeU0: true, style: { floors: 2, garage: false } });
      ctx.occ.claim(new Frame(lot.ox, lot.oz, lot.ux, lot.uz).poly(0, lot.W, 0, 12));
    }
  }
  // Its name along the wall, on Hayes and round the corner on Laguna.
  const r = k.atlas.get('suppenkuche');
  faceSign(k, f, r, W / 2, yb + 4.55, 1.2, -0.02, W - 0.5);
  faceSign(k, f.sideAtW(W), r, DEPTH / 2, yb + 4.55, 1.2, -0.02, DEPTH - 1);
  ctx.occ.claim(f.poly(-0.2, W + 0.2, 0, DEPTH + 0.5));
  // The parklet on the sidewalk, back behind race day's barriers: a planter-box fence round two
  // tables under red umbrellas (the crowd keeps clear of it).
  const q0 = pointAt(c, sW + 0.8);
  const q1 = pointAt(c, sE - 0.6);
  const d0 = 6.5 + POLE_SET - 0.1;
  const d1 = d0 + 1.5;
  const P = (q: typeof q0, d: number): [number, number, number] => [q.x - q.tz * d, q.y + KERB, q.z + q.tx * d];
  const h = Math.atan2(p.tz, p.tx);
  const len = Math.hypot(q1.x - q0.x, q1.z - q0.z);
  const m = new THREE.Matrix4().makeRotationY(-h).setPosition(...P(q0, d0));
  box(S.paint, 0, len, 0, 0.95, 0, 0.2, '#9a7048', m);
  box(S.paint, 0, 0.2, 0, 0.95, 0, d1 - d0, '#9a7048', m);
  box(S.paint, len - 0.2, len, 0, 0.95, 0, d1 - d0, '#9a7048', m);
  const green = new THREE.BoxGeometry(len - 0.1, 0.3, 0.3);
  green.translate(len / 2, 1.05, 0.1);
  S.hedge.add(green, '#5f9a4c', m);
  for (let u = 0.6; u < len; u += 1.2) {
    const [x, , z] = P(pointAt(c, sW + 0.8 + u), (d0 + d1) / 2);
    markThing(ctx, x, z, 0.75);
  }
  for (const t of [0.3, 0.72]) {
    const q = pointAt(c, sW + 0.8 + (len * t));
    const [x, y, z] = P(q, (d0 + d1) / 2 + 0.15);
    cafeSet(k, x, y, z, h, '#6b4a30', '#8a6a48');
    cyl(S.metal, [x, y, z], [x, y + 2.4, z], 0.03, 0.03, 5, '#d8d8d8');
    const u = new THREE.ConeGeometry(1.25, 0.5, 8);
    u.translate(x, y + 2.4, z);
    S.paint.add(u, '#c8322b');
  }
}

/**
 * The 21 Hayes' overhead wires down Hayes, as streets.ts's trolleyWires hangs them (two pairs of
 * running wires 5.8 m up, a span wire between poles either side), in longer, lighter runs. The
 * poles are the street lamps' (as San Francisco does it: the lamps come every 26 m from 6 m into
 * each stretch of street, sides alternating), with a pole opposite each; the wires run from the
 * first to the last before Octavia, where the course turns off.
 */
export function hayesWires(k: Kit, s0: number, s1: number): void {
  const c = k.ctx.course;
  const S = k.S;
  const H = 5.8;
  const hw = 6.5;
  const poles: number[] = [];
  for (const sec of c.sections) {
    if (!STREET_KINDS.has(sec.kind) || sec.s1 - sec.s0 < 14 || sec.s1 < s0 || sec.s0 > s1) continue;
    for (let s = sec.s0 + 6; s < sec.s1 - 4; s += 26) if (s >= s0 && s <= s1) poles.push(s);
  }
  if (poles.length < 2) return;
  s0 = poles[0];
  const end = poles[poles.length - 1];
  const wire = (a: [number, number, number], b: [number, number, number]): void => {
    const g = new THREE.CylinderGeometry(0.02, 0.02, 1, 3, 1, true);
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    g.scale(1, len, 1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    S.metal.add(g, '#2a2c30');
  };
  const n = Math.max(1, Math.ceil((end - s0) / 5));
  for (const d of [-2.4, -1.8, 1.8, 2.4]) {
    for (let i = 0; i < n; i++) {
      const a = pointAt(c, s0 + ((end - s0) * i) / n);
      const b = pointAt(c, s0 + ((end - s0) * (i + 1)) / n);
      wire([a.x - a.tz * d, a.y + H, a.z + a.tx * d], [b.x - b.tz * d, b.y + H, b.z + b.tx * d]);
    }
  }
  for (const s of poles) {
    const p = pointAt(c, s);
    // (On the lamps' own spots, behind race day's barriers.)
    const q = [-1, 1].map((side) => [p.x - p.tz * side * (hw + POLE_SET), p.y, p.z + p.tx * side * (hw + POLE_SET)] as [number, number, number]);
    for (const [x, y, z] of q) {
      cyl(S.metal, [x, y, z], [x, y + H + 1.2, z], 0.1, 0.13, 8, '#5c6168');
      markThing(k.ctx, x, z, 0.3);
    }
    wire([q[0][0], q[0][1] + H + 0.9, q[0][2]], [q[1][0], q[1][1] + H + 0.9, q[1][2]]);
  }
}

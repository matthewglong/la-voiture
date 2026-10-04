// Noe Valley's cross streets: the J Church crossing 24th at Church (its two tracks across the
// asphalt and up both arms, the trolley wire over them on span wires between poles, its stop sign),
// Dolores St's planted median with its Canary Island date palms up both arms, and the diaper van
// parked down Sanchez.
import { pointAt } from '../../../track';
import { cyl, obox, type V3 } from '../../geo';
import type { Ctx } from '../../osg/context';
import { faceSign, Frame, type Kit } from '../../osg/hayes/kit';
import { markThing } from '../../osg/kerbside';
import { datePalm, diaperVan, railStrip } from './props';

/** How far the cross streets run off the course, their road's half-width, and how far their asphalt
 *  sits over the ground (streets.ts: ARM, CROSS_W / 2, ARM_LIFT). */
const ARM = 34;
const ROAD = 6;
const ARM_LIFT = 0.09;

/** Will streets.ts lay this crossing's arm on `side`? (It doesn't where something has already taken
 *  its mouth: the same test, made with what's been claimed so far.) */
export function armLaid(ctx: Ctx, sMid: number, side: 1 | -1): boolean {
  const A = armAt(ctx, sMid, side);
  return !ctx.occ.taken(A.x + A.ux * 7.5, A.z + A.uz * 7.5);
}

/** A crossing's arm on one side (+1 right): where it leaves the kerb line, its heading, and a
 *  point in it (u out along it, v across it, the course's way along being +v). */
function armAt(ctx: Ctx, sMid: number, side: 1 | -1): { x: number; z: number; h: number; ux: number; uz: number; vx: number; vz: number; hw: number; p(u: number, v: number): [number, number] } {
  const P = pointAt(ctx.course, sMid);
  const x = P.x - P.tz * side * P.hw;
  const z = P.z + P.tx * side * P.hw;
  const ux = -P.tz * side;
  const uz = P.tx * side;
  return { x, z, h: Math.atan2(uz, ux), ux, uz, vx: P.tx, vz: P.tz, hw: P.hw, p: (u, v) => [x + ux * u + P.tx * v, z + uz * u + P.tz * v] };
}

/**
 * The J Church across 24th at Church: two tracks (their rails embedded in the asphalt) square to the
 * course through the crossing's middle and on up both arms, the trolley wire over each on span
 * wires between poles on the arms' sidewalks, carried across 24th over the race; the J stop's sign.
 */
export function jChurchCrossing(k: Kit, sMid: number): void {
  const ctx = k.ctx;
  const S = k.S;
  const c = ctx.course;
  const P = pointAt(c, sMid);
  const nx = -P.tz;
  const nz = P.tx;
  // Out along each arm (only so far as the road goes where an arm isn't laid).
  const reachL = armLaid(ctx, sMid, -1) ? P.hw + ARM - 1 : P.hw + 0.4;
  const reachR = armLaid(ctx, sMid, 1) ? P.hw + ARM - 1 : P.hw + 0.4;
  /** A point on the line through the crossing at `o` metres along the course, d across it, and the
   *  road's top there (the course's asphalt, or an arm's). */
  const at = (o: number, d: number, lift: number): V3 => {
    const x = P.x + P.tx * o + nx * d;
    const z = P.z + P.tz * o + nz * d;
    const y = Math.abs(d) <= P.hw ? pointAt(c, sMid + o).y + 0.03 : ctx.ground(x, z) + ARM_LIFT;
    return [x, y + lift, z];
  };
  for (const track of [-1.7, 1.7]) {
    for (const g of [-0.72, 0.72]) {
      const pts: V3[] = [];
      for (let d = -reachL; d <= reachR + 1e-6; d += 2) pts.push(at(track + g, d, 0.006));
      pts.push(at(track + g, reachR, 0.006));
      railStrip(S.metal, pts, 0.08, '#9aa0a8');
      // The groove beside the rail head.
      const groove = pts.map((q) => [q[0] + P.tx * 0.06 * Math.sign(g), q[1] - 0.001, q[2] + P.tz * 0.06 * Math.sign(g)] as V3);
      railStrip(S.marks, groove, 0.05, '#2c2c2e');
    }
  }
  // Poles in pairs either side of each arm, span wires between them, the contact wire over each track
  // the whole way across.
  const H = 5.8;
  for (const side of [-1, 1] as const) {
    if (!armLaid(ctx, sMid, side)) continue;
    const A = armAt(ctx, sMid, side);
    for (const u of [9, 24]) {
      const tops: V3[] = [];
      for (const v of [-(ROAD + 0.9), ROAD + 0.9]) {
        const [x, z] = A.p(u, v);
        const y = ctx.ground(x, z) + 0.16;
        cyl(S.metal, [x, y, z], [x, y + H + 1.1, z], 0.1, 0.13, 8, '#5c6168');
        markThing(ctx, x, z, 0.3);
        tops.push([x, y + H + 0.8, z]);
      }
      cyl(S.metal, tops[0], tops[1], 0.015, 0.015, 3, '#2a2c30');
    }
  }
  for (const track of [-1.7, 1.7]) {
    let prev: V3 | null = null;
    for (let d = -reachL; d <= reachR + 1e-6; d += 4) {
      const q = at(track, d, H);
      if (prev) cyl(S.metal, prev, q, 0.012, 0.012, 3, '#2a2c30');
      prev = q;
    }
  }
  // The J stop's sign, on the right arm's sidewalk by the corner.
  if (armLaid(ctx, sMid, 1)) {
    const A = armAt(ctx, sMid, 1);
    const [x, z] = A.p(5, ROAD + 1.6);
    const y = ctx.ground(x, z) + 0.16;
    cyl(S.metal, [x, y, z], [x, y + 2.9, z], 0.035, 0.04, 6, '#9aa0a6');
    markThing(ctx, x, z, 0.25);
    // Facing back down the arm towards 24th (the course), so the racers see it: a frame whose +w
    // runs out along the arm (its face, at w < 0, looks back at the course).
    const g = new Frame(x, z, A.uz, -A.ux);
    faceSign(k, g, k.atlas.get('jStop'), 0, y + 2.2, 0.5, -0.06);
  }
}

/**
 * Dolores St's median up both arms of the 24th St crossing: a kerbed strip of lawn down the middle
 * of each arm, past its crosswalk, with Canary Island date palms standing tall along it.
 */
export function doloresPalms(k: Kit, sMid: number): void {
  const ctx = k.ctx;
  const S = k.S;
  for (const side of [-1, 1] as const) {
    if (!armLaid(ctx, sMid, side)) continue;
    const A = armAt(ctx, sMid, side);
    const step = 3;
    for (let u = 4.5; u < ARM - 1; u += step) {
      const [xa, za] = A.p(u, 0);
      const [xb, zb] = A.p(Math.min(ARM - 1, u + step), 0);
      const ya = ctx.ground(xa, za);
      const yb = ctx.ground(xb, zb);
      const top = Math.max(ya, yb) + ARM_LIFT + 0.17;
      const len = Math.hypot(xb - xa, zb - za);
      const cx = (xa + xb) / 2;
      const cz = (za + zb) / 2;
      obox(S.concrete, [cx, (top + Math.min(ya, yb) - 0.2) / 2, cz], [len, top - Math.min(ya, yb) + 0.2, 2.6], [0, -A.h, 0], '#cfc9bd');
      obox(S.hedge, [cx, top + 0.015, cz], [len - 0.12, 0.05, 2.36], [0, -A.h, 0], '#6f9a4c');
    }
    for (const u of [8, 15.5, 23, 30.5]) {
      const [x, z] = A.p(u, 0);
      const y = ctx.ground(x, z) + ARM_LIFT + 0.18;
      datePalm(S, x, y, z, 10.5 + k.rng() * 2.5, k.rng);
    }
  }
}

/** The diaper van, parked down a cross street's arm on the right (Sanchez), nose out. */
export function parkedVan(k: Kit, sMid: number): void {
  const ctx = k.ctx;
  if (!armLaid(ctx, sMid, 1)) return;
  const A = armAt(ctx, sMid, 1);
  const [x, z] = A.p(15, -(ROAD - 1.25));
  const y = ctx.ground(x, z) + ARM_LIFT;
  diaperVan(k.S, k.sign, x, y, z, A.h, k.atlas.get('vanSide'), k.atlas.get('babyOnBoard'));
}

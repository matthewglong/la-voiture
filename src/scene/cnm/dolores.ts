// Dolores Park, and the streets either side of it: Dolores St, the course's way down to the park's
// gate (the southbound carriageway along the park, the median's tall date palms to its left, the
// northbound carriageway and the east side's houses beyond, carried on past the gate to 20th St), the
// park itself (park.ts: its lawn is the course's open ground), 20th St along its top, and Church St,
// the course's way back down past the park (the J Church's right of way between the street and the
// lawn) and on north with the J in the street to Market (rails.ts), Mission Dolores down 16th St and
// the Church St station at Market (landmarks.ts).
import { DOLORES_EAST_SET, DOLORES_OPEN, DOLORES_OUTLINE, DOLORES_SCALE, STREET_HW } from '../../maps/castroNoeMission';
import { inPoly } from '../../openGround';
import { pointAt } from '../../track';
import { strip } from '../geo';
import type { Frontage } from '../victorian';
import { rectPoly, type Ctx, type Hood } from '../osg/context';
import { markThing } from '../osg/kerbside';
import { walkGround } from '../osg/paving';
import { CORNER, KERB, WALK, groundStrip, sideStreet, turnOf } from '../osg/streets';
import { buildMissionDolores, buildStation } from './dolores/landmarks';
import { buildPark } from './dolores/park';
import { palm } from './dolores/palms';
import { buildRails } from './dolores/rails';

/** Dolores St across: the course's carriageway (±STREET_HW), the median to its left, the northbound
 *  carriageway and the east sidewalk beyond (m, + right: the park's side). */
const MED = 4;
const FAR = 6.5;

/** A straight line along the course (u along it, v to its right) through a point of it. */
export interface Line {
  x: number;
  z: number;
  tx: number;
  tz: number;
  at(u: number, v: number): { x: number; z: number };
  uOf(x: number, z: number): number;
  vOf(x: number, z: number): number;
}

export function lineAt(x: number, z: number, tx: number, tz: number): Line {
  return {
    x,
    z,
    tx,
    tz,
    at: (u, v) => ({ x: x + tx * u - tz * v, z: z + tz * u + tx * v }),
    uOf: (px, pz) => (px - x) * tx + (pz - z) * tz,
    vOf: (px, pz) => -(px - x) * tz + (pz - z) * tx,
  };
}

/** Everything the parts of Dolores share: Dolores St's line (through the gate, u south along it) and
 *  where along it the median starts (past 18th's intersection), 19th St and 20th St are. */
export interface DoloresPlan {
  dol: Line;
  uStart: number;
  u19: number;
  uEnd: number;
  /** 20th St along the top of the park: its axis (from where it crosses Dolores St's line, u20 along
   *  that, heading west towards Church St) and how far it runs before Church St's sidewalk. */
  t20: Line;
  u20: number;
  len20: number;
  /** Dolores St's height at u along it: the course's to the gate, the ground's beyond. */
  yDol(u: number): number;
}

export function buildDolores(ctx: Ctx): Hood {
  const c = ctx.course;
  const S = ctx.sinks;
  const sDol = ctx.mark('dolores', 'dolores');
  const sGate = ctx.mark('dolores', 'gate');
  const sChurch = ctx.mark('dolores', 'church');
  const s18 = ctx.mark('dolores', '18th');

  // --- The park's ground: claimed (nothing else is built on its lawn) ----------------------------------
  ctx.occ.claim(DOLORES_OUTLINE);

  // --- Dolores St's line, and where things are along it ----------------------------------------------
  const g = pointAt(c, sGate);
  const dol = lineAt(g.x, g.z, g.tx, g.tz);
  const cornerSec = c.sections.find((q) => q.kind === CORNER && Math.abs(q.s1 - sDol) < 1);
  const corner = cornerSec ? turnOf(c, cornerSec) : { x: g.x - g.tx * 60, z: g.z - g.tz * 60 };
  const uStart = dol.uOf(corner.x, corner.z) + STREET_HW + WALK + 0.6;
  let uEnd = 0;
  for (const [x, z] of DOLORES_OUTLINE) if (Math.abs(dol.vOf(x, z) - DOLORES_EAST_SET) < 0.6) uEnd = Math.max(uEnd, dol.uOf(x, z));
  const u19 = uEnd - (492 - 314.6) * DOLORES_SCALE;
  const yDol = (u: number): number => {
    if (u <= 0) return pointAt(c, sGate + u).y;
    const p = dol.at(u, 0);
    return ctx.ground(p.x, p.z) + 0.08;
  };
  // 20th St: parallel to the lawn's top edge (the outline's run from Dolores St's side to the corner
  // of Church), far enough out for its road and sidewalk; from Dolores St's line to Church St's arm
  // south of the course's corner.
  const O = DOLORES_OUTLINE;
  let iE = 0;
  for (let i = 0; i < O.length; i++) if (Math.abs(dol.vOf(O[i][0], O[i][1]) - DOLORES_EAST_SET) < 0.6 && dol.uOf(O[i][0], O[i][1]) >= uEnd - 0.01) iE = i;
  const [ex, ez] = O[iE];
  const [wx, wz] = O[(iE + 1) % O.length];
  const el = Math.hypot(wx - ex, wz - ez);
  const etx = (wx - ex) / el;
  const etz = (wz - ez) / el;
  let onx = -etz;
  let onz = etx;
  if (inPoly(O, (ex + wx) / 2 + onx, (ez + wz) / 2 + onz)) {
    onx = -onx;
    onz = -onz;
  }
  const OFF20 = 5 + WALK + 0.6;
  const a20 = { x: ex + onx * OFF20, z: ez + onz * OFF20 };
  // Where that axis crosses Dolores St's line.
  const den = etx * dol.tz - etz * dol.tx;
  const k20 = Math.abs(den) > 1e-6 ? ((a20.x - dol.x) * dol.tz - (a20.z - dol.z) * dol.tx) / -den : 0;
  const c20 = { x: a20.x + etx * k20, z: a20.z + etz * k20 };
  const u20 = dol.uOf(c20.x, c20.z);
  const t20 = lineAt(c20.x, c20.z, etx, etz);
  // How far along it Church St's arm south of the corner is (its axis), less its road and sidewalk.
  const outSec = c.sections.find((q) => q.kind === CORNER && Math.abs(q.s0 - ctx.mark('dolores', 'out')) < 1);
  let len20 = el + 20;
  if (outSec) {
    const t = turnOf(c, outSec);
    const ah = t.hOut + Math.PI;
    const ax = Math.cos(ah);
    const az = Math.sin(ah);
    const d2 = etx * az - etz * ax;
    if (Math.abs(d2) > 1e-6) {
      const k = ((t.x - c20.x) * az - (t.z - c20.z) * ax) / d2;
      len20 = k - (STREET_HW + WALK) / Math.max(0.3, Math.abs(d2));
    }
  }
  const plan: DoloresPlan = { dol, uStart, u19, uEnd, t20, u20, len20, yDol };

  const frontages: Frontage[] = [];
  frontages.push(...doloresSt(ctx, plan));
  frontages.push(...twentieth(ctx, plan));
  const park = buildPark(ctx, plan);
  const rails = buildRails(ctx);
  buildMissionDolores(ctx);
  buildStation(ctx);

  // --- What the streets mustn't put along the course here ----------------------------------------------
  // Dolores St: its left side is the median (no sidewalk, no houses: they're across the far
  // carriageway); its right side, the park's (a sidewalk, no houses). Church St past the park: the J
  // Church's right of way on its right (no sidewalk, no houses).
  const noWalk = (s: number, side: 1 | -1): boolean => (side < 0 && s >= sDol - 0.5 && s <= sGate + 1) || (side > 0 && s >= sChurch - 1 && s <= s18 + 0.5);
  const noHouses = (s: number, side: 1 | -1): boolean => side > 0 && s >= sDol - 2 && s <= sGate + 12;
  void S;
  return { noWalk, noHouses, frontages: [...frontages, ...park.frontages, ...rails.frontages], ownSigns: [] };
}

/**
 * Dolores St, both sides of the median: the median itself (kerbed, planted, the tall Canary Island
 * date palms down it), the northbound carriageway and the east sidewalk, from past 18th's
 * intersection to 20th; past the gate, the southbound carriageway too (the course turns off into the
 * park) and its sidewalk along the park. The east side's houses face it (the frontages back).
 */
function doloresSt(ctx: Ctx, plan: DoloresPlan): Frontage[] {
  const S = ctx.sinks;
  const { dol, uStart, u19, uEnd, u20, yDol } = plan;
  const rng = ctx.rng;
  const hw = STREET_HW;
  const out: Frontage[] = [];
  // Points along the line every metre (the course's height to the gate, the ground's beyond).
  const run = (u0: number, u1: number): { x: number; z: number; tx: number; tz: number; y: number }[] => {
    const pts: { x: number; z: number; tx: number; tz: number; y: number }[] = [];
    const n = Math.max(1, Math.ceil(u1 - u0));
    for (let i = 0; i <= n; i++) {
      const u = u0 + ((u1 - u0) * i) / n;
      const p = dol.at(u, 0);
      pts.push({ x: p.x, z: p.z, tx: dol.tx, tz: dol.tz, y: yDol(u) });
    }
    return pts;
  };
  // Gaps for the cross streets (19th; 20th at the end).
  const gap19: [number, number] = [u19 - 6.5, u19 + 6.5];
  const spans: [number, number][] = [
    [uStart, gap19[0]],
    [gap19[1], u20 - 6.5],
    // On south past 20th, out of the race.
    [u20 + 6.5, u20 + 36],
  ];
  for (const [a, b] of spans) {
    if (b - a < 2) continue;
    const r = run(a, b);
    // The median: kerbed, its top planted (the lawn's green, a little darker).
    strip(S.concrete, r, -hw - MED, -hw, (i) => r[i].y + KERB, '#7f9a5a', { sides: true, bottom: (i) => r[i].y - 0.6 });
    strip(S.concrete, r, -hw - 0.25, -hw, (i) => r[i].y + KERB + 0.01, '#d6d0c2');
    strip(S.concrete, r, -hw - MED, -hw - MED + 0.25, (i) => r[i].y + KERB + 0.01, '#d6d0c2');
    // The northbound carriageway and its centre line, the east sidewalk.
    strip(S.asphalt, r, -hw - MED - FAR, -hw - MED, (i) => r[i].y + 0.02, '#ffffff', { uvScale: 6, sides: true, bottom: (i) => r[i].y - 1.4 });
    strip(S.marks, r, -hw - MED - FAR / 2 - 0.07, -hw - MED - FAR / 2 + 0.07, (i) => r[i].y + 0.035, '#f4f4ee');
    strip(S.sidewalk, r, -hw - MED - FAR - WALK, -hw - MED - FAR, (i) => r[i].y + KERB, '#d9d3c6', { uvScale: 3, sides: true, bottom: (i) => r[i].y - 0.8 });
    // Past the gate: the southbound carriageway the course leaves, and its sidewalk along the park.
    if (b > 0) {
      const a2 = Math.max(a, 0);
      const r2 = run(a2, b);
      strip(S.asphalt, r2, -hw, hw, (i) => r2[i].y - 0.01, '#ffffff', { uvScale: 6, sides: true, bottom: (i) => r2[i].y - 1.4 });
      const a3 = Math.max(a, 13);
      const b3 = b < u20 ? Math.min(b, uEnd) : b;
      if (b3 - a3 > 2) {
        const r3 = run(a3, b3);
        strip(S.sidewalk, r3, hw, hw + WALK, (i) => r3[i].y + KERB, '#d9d3c6', { uvScale: 3, sides: true, bottom: (i) => r3[i].y - 0.8 });
      }
    }
    // The palms down the median, every 9 m or so.
    for (let u = a + 3 + rng() * 2; u < b - 2; u += 8.5 + rng() * 1.5) {
      const p = dol.at(u, -hw - MED / 2);
      palm(S.walls, S.foliage, p.x, yDol(u) + KERB, p.z, 11 + rng() * 3, 0.42, 16, rng);
      markThing(ctx, p.x, p.z, 0.6);
    }
    // What it takes, and the east side's frontage behind the sidewalk (facing the street: run
    // backwards, so the houses stand to its right).
    ctx.occ.claim(rectPoly(dol.x, dol.z, Math.atan2(dol.tz, dol.tx), a, b, -hw - MED - FAR - WALK, -hw));
    if (b > 0) ctx.occ.claim(rectPoly(dol.x, dol.z, Math.atan2(dol.tz, dol.tx), Math.max(a, 0), b, -hw, hw + WALK));
    const fa = dol.at(b, -hw - MED - FAR - WALK);
    out.push({ ox: fa.x, oz: fa.z, ux: -dol.tx, uz: -dol.tz, len: b - a });
  }
  // Beyond 20th, houses on the west side too.
  {
    const fa = dol.at(u20 + 6.5 + WALK, hw + WALK);
    out.push({ ox: fa.x, oz: fa.z, ux: dol.tx, uz: dol.tz, len: 36 - 6.5 - WALK });
  }
  // The cross streets' mouths across both carriageways: 19th, and 20th at the park's corner.
  for (const [u0, u1] of [gap19, [u20 - 6.5, u20 + 6.5]] as [number, number][]) {
    const p = dol.at((u0 + u1) / 2, 0);
    groundStrip(ctx, S.asphalt, p.x, p.z, Math.atan2(dol.tz, dol.tx), -(u1 - u0) / 2, (u1 - u0) / 2, -hw - MED - FAR, hw, 0.09, 1.4, '#ffffff', 6, 1);
    ctx.occ.claim(rectPoly(p.x, p.z, Math.atan2(dol.tz, dol.tx), -(u1 - u0) / 2 - WALK, (u1 - u0) / 2 + WALK, -hw - MED - FAR - WALK, hw + WALK));
  }
  // 19th St and 20th St on east of Dolores, short streets between the houses.
  const left = Math.atan2(-dol.tx, dol.tz);
  for (const u of [u19, u20]) {
    const a = dol.at(u, -hw - MED - FAR - WALK - 0.2);
    const b = { x: a.x + Math.cos(left) * 32, z: a.z + Math.sin(left) * 32 };
    out.push(...sideStreet(ctx, a.x, a.z, b.x, b.z, 5, { houses: [true, true] }));
  }
  void walkGround;
  return out;
}

/**
 * 20th St along the top of the park, from Dolores to Church: past the park's lawn (its south edge is
 * its sidewalk), the houses facing the park across it.
 */
function twentieth(ctx: Ctx, plan: DoloresPlan): Frontage[] {
  const { t20, len20 } = plan;
  // From the far side of Dolores St's intersection to Church St's sidewalk (the park's lawn on its
  // north side: a sidewalk, no houses; houses across the street facing the park).
  const u0 = STREET_HW + WALK + 0.2;
  if (len20 - u0 < 6) return [];
  const a = t20.at(u0, 0);
  const b = t20.at(len20, 0);
  // Which side is the park's (the lawn is towards the outline).
  const mid = t20.at((u0 + len20) / 2, 0);
  const parkRight = DOLORES_OPEN.contains(mid.x - t20.tz * 14, mid.z + t20.tx * 14);
  return sideStreet(ctx, a.x, a.z, b.x, b.z, 5, { houses: parkRight ? [true, false] : [false, true] });
}

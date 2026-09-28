// The N Judah along Duboce Ave. Its two steel rails run down the middle of the street in a band of
// concrete from the Muni Metro portal behind the corner of Buchanan (the Duboce portal, where the
// streetcars come up out of the Market St subway), through the corner and west past Church (where
// the J Church's rails swing off south) and Steiner, then on their own right of way along the south
// edge of Duboce Park and round into the Sunset Tunnel's east portal (1928) at the park's far end,
// under Buena Vista Heights. Overhead, the contact wire on its catenary, hung from span wires between
// poles (on the park's edge, from bracket arms). The line is the sim's own (populateOldStompingGrounds
// runs its streetcar along it), straight from the portal into the park; only the park's end curves
// off, clear of the park's path, to the tunnel.
//
// The ground can't be dug, so the Duboce portal is at grade: the rails run between concrete walls
// that rise as the planted banks either side of them climb to the deck over the portal's mouth.
import * as THREE from 'three';
import { N_JUDAH, N_JUDAH_TRACK } from '../../../maps/oldStompingGrounds';
import { pointAt } from '../../../track';
import { cyl, obox, strip, type GeoBuilder, type V3 } from '../../geo';
import { tree } from '../../props';
import { shrub } from '../buenaVista/trees';
import { rectPoly, type Ctx, type Hood } from '../context';
import { markThing } from '../kerbside';
import { CORNER, KERB, POLE_SET, WALK, turnOf } from '../streets';
import { crag } from './mint';
import type { Near } from './near';
import type { Decals } from './signs';

/** Standard gauge (m); the contact wire's height over the rails, and the messenger wire's. */
const GAUGE = 1.435;
/** Half the width of the line's own paved bed, off the street (m). */
const BED_HW = 1.9;
const WIRE_H = 5.6;
const MESSENGER_H = 6.35;
const STEEL = '#9aa0a6';
const POLE = '#3b4a42';
const WIRE = '#2a2c30';
const BAND = '#6f6b64';
const WALLS = '#c9c4b9';
const DARK = '#17191c';

/** A point on a line of rails: where it is, which way it runs (unit), and the surface under it. */
interface RailPt {
  x: number;
  z: number;
  tx: number;
  tz: number;
  y: number;
}

/** The rails' line as the sim has it: through `o`, running `u` (west), `v` to its right (north). */
interface Line {
  ox: number;
  oz: number;
  ux: number;
  uz: number;
  at(al: number, v?: number): { x: number; z: number };
  alongOf(x: number, z: number): number;
}

/** What the rest of Duboce needs to know about the line: which sides of the course it takes, and how
 *  near a point is to its rails in the park (to keep hedges, trees and benches off them). */
export interface NJudahLine {
  hood: Hood;
  railsNear(x: number, z: number): number;
}

export function buildNJudah(ctx: Ctx, decals: Decals, near: Near): NJudahLine {
  const c = ctx.course;
  const S = ctx.sinks;
  const sRails = ctx.mark('duboce', 'rails');
  const sChurch = ctx.mark('duboce', 'church');
  const sPark = ctx.mark('duboce', 'park');
  const sEnd = ctx.mark('duboce', 'parkEnd');
  // The line as the map lays it down (N_JUDAH: the sim runs the streetcar on it), on the eastbound
  // track: the course's centreline is `off` metres to its right.
  const N = N_JUDAH;
  const { ux, uz } = N;
  const off = -N_JUDAH_TRACK;
  const L: Line = {
    ox: N.x,
    oz: N.z,
    ux,
    uz,
    at: (al, v = 0) => ({ x: N.x + ux * al - uz * v, z: N.z + uz * al + ux * v }),
    alongOf: (x, z) => (x - N.x) * ux + (z - N.z) * uz,
  };
  const heading = Math.atan2(uz, ux);

  // The corner behind (Buchanan into Duboce): its centre, and where its intersection and sidewalk
  // squares end on the arm the portal's on.
  const cornerSec = c.sections.find((q) => q.kind === CORNER && Math.abs(q.s1 - sRails) < 1);
  const t = cornerSec ? turnOf(c, cornerSec) : { x: N.x - ux * 15, z: N.z - uz * 15 };
  const hw = cornerSec?.hw ?? 6.5;
  const alT = L.alongOf(t.x, t.z);
  const alBox = alT - hw;
  const alSq = alT - hw - WALK;
  // The subway portal's mouth, and the covered way on past where the streetcar stops inside it.
  const alMouth = N.mouth;
  const alEnd = Math.min(N.a0 - 10, alMouth - 12);
  const pPark = pointAt(c, sPark);
  const alPark = L.alongOf(pPark.x, pPark.z);
  /** The rails' height along the line, as the map has it (the profile the sim sets the car on). */
  const profile = (al: number): number => {
    const P = N.profile;
    if (al <= P[0][0]) return P[0][1];
    for (let i = 0; i < P.length - 1; i++) {
      if (al <= P[i + 1][0]) return P[i][1] + ((P[i + 1][1] - P[i][1]) * (al - P[i][0])) / (P[i + 1][0] - P[i][0]);
    }
    return P[P.length - 1][1];
  };

  // The portal's floor at its mouth: the rails' level (the ground there should be cut down to it; where
  // it stands higher, the portal is built on it, and the floor ramps up to it from the corner).
  const pMouth = L.at(alMouth);
  const yMouth = Math.max(profile(alMouth), ctx.ground(pMouth.x, pMouth.z));

  /** Its bed on the ground at (x, z), heading (tx, tz): as high as the ground under either edge (the
   *  lawn slopes across it), and a little over. */
  const onGround = (x: number, z: number, tx: number, tz: number): number =>
    Math.max(ctx.ground(x, z), ctx.ground(x - tz * BED_HW, z + tx * BED_HW), ctx.ground(x + tz * BED_HW, z - tx * BED_HW)) + 0.05;

  /** The surface the rails lie on, at `al` along the line: the profile (the corner, Duboce Ave, the
   *  Steiner crossing, all level; the portal's arm too, unless the ground there stands higher), then
   *  the ground (the park, beyond the streetcar's end). */
  const surface = (al: number): number => {
    const p = L.at(al);
    if (al <= alPark + 0.5) {
      const y = profile(al) + 0.03;
      if (al >= alBox) return y;
      return Math.max(y, Math.min(ctx.ground(p.x, p.z), yMouth) + 0.06);
    }
    return onGround(p.x, p.z, ux, uz);
  };
  const straight = (al0: number, al1: number, step = 2): RailPt[] => {
    const out: RailPt[] = [];
    const n = Math.max(1, Math.ceil((al1 - al0) / step));
    for (let i = 0; i <= n; i++) {
      const al = al0 + ((al1 - al0) * i) / n;
      const p = L.at(al);
      out.push({ x: p.x, z: p.z, tx: ux, tz: uz, y: surface(al) });
    }
    return out;
  };

  // --- Where the park's end of the line goes: off the straight (clear of the park's path), an S bend
  // south, and on into the Sunset Tunnel's portal ---------------------------------------------------------
  // Find where the straight has got well clear of the path, a little past where it leaves it.
  let alOff = alPark + 10;
  for (let al = alPark; al < alPark + 60; al += 0.5) {
    const p = L.at(al);
    if (near.margin(p.x, p.z) > 5) {
      alOff = al + 1;
      break;
    }
  }
  const R = 13;
  const theta = (62 * Math.PI) / 180;
  const sBend: RailPt[] = [];
  {
    // Left (south) on a circle, then right on another, ending parallel to the line, 2R(1-cos θ) off it.
    const p0 = L.at(alOff);
    const left = { x: uz, z: -ux };
    const c1 = { x: p0.x + left.x * R, z: p0.z + left.z * R };
    const n = 12;
    const h0 = heading;
    for (let i = 0; i <= n; i++) {
      const f = (theta * i) / n;
      const h = h0 - f;
      const x = c1.x - left.x * R * Math.cos(f) + ux * R * Math.sin(f);
      const z = c1.z - left.z * R * Math.cos(f) + uz * R * Math.sin(f);
      sBend.push({ x, z, tx: Math.cos(h), tz: Math.sin(h), y: onGround(x, z, Math.cos(h), Math.sin(h)) });
    }
    const m = sBend[sBend.length - 1];
    const hm = h0 - theta;
    // The second circle's centre is on the right of the bend's middle.
    const c2 = { x: m.x - Math.sin(hm) * R, z: m.z + Math.cos(hm) * R };
    for (let i = 1; i <= n; i++) {
      const f = (theta * i) / n;
      const h = hm + f;
      const a0 = Math.atan2(m.z - c2.z, m.x - c2.x);
      const x = c2.x + Math.cos(a0 + f) * R;
      const z = c2.z + Math.sin(a0 + f) * R;
      sBend.push({ x, z, tx: Math.cos(h), tz: Math.sin(h), y: onGround(x, z, Math.cos(h), Math.sin(h)) });
    }
  }
  const bendEnd = sBend[sBend.length - 1];
  // The portal's mouth, a few metres on.
  const mouth = { x: bendEnd.x + ux * 4, z: bendEnd.z + uz * 4 };
  const toMouth: RailPt[] = [bendEnd, { x: mouth.x, z: mouth.z, tx: ux, tz: uz, y: onGround(mouth.x, mouth.z, ux, uz) }];

  // --- The line itself: the band of concrete, the rails ------------------------------------------------------
  const onStreet = straight(alBox, alPark + 0.5, 1);
  const armIn = straight(alEnd, alBox, 1);
  const parkRun = straight(alPark + 0.5, alOff, 1);
  const west = [...parkRun, ...sBend.slice(1), toMouth[1]];
  // Its own right of way through the park: nothing else built on it (its poles stand beside it).
  for (const p of west) ctx.occ.disc(p.x, p.z, 4.5);
  // Along the street: a band of concrete in the asphalt (painted on, as the markings are).
  strip(S.marks, onStreet, -1.5, 1.5, (i) => onStreet[i].y + 0.012, BAND);
  // On the portal's arm and in the park: its own paved bed, on the ground.
  for (const r of [armIn, west]) strip(S.asphalt, r, -BED_HW, BED_HW, (i) => r[i].y, '#ffffff', { uvScale: 6, sides: true, bottom: (i) => r[i].y - 0.5 });
  for (const r of [armIn, onStreet, west]) rails(S.paint, r);

  // The J Church's rails swinging off south onto Church St (the J runs on down Church).
  {
    const cm = pointAt(c, sChurch + 6);
    const alC = L.alongOf(cm.x, cm.z);
    const Rj = 11;
    const pts: RailPt[] = [];
    const left = { x: uz, z: -ux };
    const p0 = L.at(alC - Rj);
    const cc = { x: p0.x + left.x * Rj, z: p0.z + left.z * Rj };
    for (let i = 0; i <= 14; i++) {
      const f = (Math.PI / 2) * (i / 14);
      const x = cc.x - left.x * Rj * Math.cos(f) + ux * Rj * Math.sin(f);
      const z = cc.z - left.z * Rj * Math.cos(f) + uz * Rj * Math.sin(f);
      const h = heading - f;
      const inCourse = near.margin(x, z) < 0;
      pts.push({ x, z, tx: Math.cos(h), tz: Math.sin(h), y: inCourse ? pointAt(c, sRails + 4 + L.alongOf(x, z)).y + 0.03 : ctx.ground(x, z) + 0.03 });
    }
    // On down Church St to the end of its block.
    const e = pts[pts.length - 1];
    for (let k = 1; k <= 12; k++) {
      const x = e.x + left.x * k * 2.4;
      const z = e.z + left.z * k * 2.4;
      pts.push({ x, z, tx: left.x, tz: left.z, y: ctx.ground(x, z) + 0.03 });
    }
    rails(S.paint, pts);
  }

  // --- The wire: poles in pairs along Duboce Ave (span wires across), on the park's edge from bracket
  // arms, and the contact wire and its messenger over the rails all the way ----------------------------------
  {
    const M = S.metal;
    const supports: { x: number; z: number; y: number }[] = [];
    /** Poles either side of the street (at vN and vS from the rails), a span wire between them. */
    const pair = (al: number, vN: number, vS: number): void => {
      const y = surface(al);
      const pl = L.at(al, vN);
      const pr = L.at(al, vS);
      const gl = Math.max(y, ctx.ground(pl.x, pl.z)) + KERB;
      const gr = Math.max(y, ctx.ground(pr.x, pr.z)) + KERB;
      pole(M, pl.x, gl, pl.z, 7.4);
      pole(M, pr.x, gr, pr.z, 7.4);
      // (Race day's barriers and crowd work round them.)
      markThing(ctx, pl.x, pl.z, 0.3);
      markThing(ctx, pr.x, pr.z, 0.3);
      cyl(M, [pl.x, gl + 7.0, pl.z], [pr.x, gr + 7.0, pr.z], 0.02, 0.02, 3, WIRE);
      const w = L.at(al);
      supports.push({ x: w.x, z: w.z, y });
      // The hanger down to the messenger.
      const f = vN / (vN - vS);
      cyl(M, [w.x, gl + (gr - gl) * f + 7.0, w.z], [w.x, y + MESSENGER_H, w.z], 0.015, 0.015, 3, WIRE);
    };
    const bracket = (p: RailPt, side: number): void => {
      // A pole on one side, its arm reaching out over the rails.
      const nx = -p.tz * side;
      const nz = p.tx * side;
      const px = p.x + nx * 3.0;
      const pz = p.z + nz * 3.0;
      const g = ctx.ground(px, pz);
      pole(M, px, g, pz, 7.2);
      const y = p.y;
      cyl(M, [px, g + 6.9, pz], [p.x - nx * 0.4, y + MESSENGER_H + 0.3, p.z - nz * 0.4], 0.045, 0.045, 5, POLE);
      cyl(M, [px, g + 5.6, pz], [p.x, y + WIRE_H + 0.1, p.z], 0.03, 0.03, 4, POLE);
      supports.push({ x: p.x, z: p.z, y });
    };
    // Along the street, both sides on the sidewalks, in line with the street lamps (behind race day's
    // barriers); beside the portal, on its sidewalks.
    for (const al of [alT + hw + 2, 10, 18.5, 34.5, 49]) pair(al, off + hw + POLE_SET, off - hw - POLE_SET);
    pair(alSq - 1.5, off + 8.6, off - 8.6);
    // Duboce & Church: the eastbound stop, marked Muni's way, a yellow band round the pole and the N's
    // badge.
    {
      const p = L.at(34.5, off - hw - POLE_SET);
      const y = surface(34.5) + KERB;
      cyl(M, [p.x, y + 2.0, p.z], [p.x, y + 2.35, p.z], 0.16, 0.16, 8, '#f2c318');
      for (const e of [1, -1]) {
        const fx = ux * e;
        const fz = uz * e;
        decals.quad('judah', [p.x + fx * 0.17, y + 2.9, p.z + fz * 0.17], [fz, 0, -fx], [0, 1, 0], 0.5, 0.5);
      }
    }
    // Along the park, from brackets on the south side of the line.
    const line = parkRun.filter((p) => near.margin(p.x, p.z) > 1.2);
    for (let i = 0; i < line.length; i += 16) bracket(line[i], -1);
    for (let i = 4; i < sBend.length; i += 8) bracket(sBend[i], -1);
    // The wires, from the Muni portal's mouth to the Sunset Tunnel's, dipping into both.
    const run = [...armIn.filter((p) => L.alongOf(p.x, p.z) >= alMouth - 0.5), ...onStreet.slice(1), ...west.slice(1)];
    const every = (r: RailPt[], step: number): RailPt[] => {
      const out: RailPt[] = [r[0]];
      let d = 0;
      for (let i = 1; i < r.length; i++) {
        d += Math.hypot(r[i].x - r[i - 1].x, r[i].z - r[i - 1].z);
        if (d >= step || i === r.length - 1) {
          out.push(r[i]);
          d = 0;
        }
      }
      return out;
    };
    const w = every(run, 4);
    let total = 0;
    const dist = w.map((p, i) => (total += i ? Math.hypot(p.x - w[i - 1].x, p.z - w[i - 1].z) : 0));
    const dip = (i: number): number => {
      const e = Math.min(dist[i], total - dist[i]);
      return 1.3 * Math.max(0, 1 - e / 14);
    };
    const sag = (x: number, z: number): number => {
      let best = Infinity;
      for (const q of supports) best = Math.min(best, Math.hypot(q.x - x, q.z - z));
      return Math.min(0.45, (best / 12) ** 2 * 0.45);
    };
    for (let i = 0; i < w.length - 1; i++) {
      const p = w[i];
      const q = w[i + 1];
      const ca = p.y + WIRE_H - dip(i);
      const cb = q.y + WIRE_H - dip(i + 1);
      cyl(M, [p.x, ca, p.z], [q.x, cb, q.z], 0.011, 0.011, 3, WIRE);
      // The messenger sags between supports; droppers down to the contact wire.
      const ya = p.y + MESSENGER_H - Math.max(sag(p.x, p.z), dip(i) * 1.1);
      const yb = q.y + MESSENGER_H - Math.max(sag(q.x, q.z), dip(i + 1) * 1.1);
      cyl(M, [p.x, ya, p.z], [q.x, yb, q.z], 0.009, 0.009, 3, WIRE);
      if (ya - ca > 0.12) cyl(M, [p.x, ya, p.z], [p.x, ca, p.z], 0.008, 0.008, 3, WIRE);
    }
  }

  // --- The Duboce portal, on the corner's arm behind the course, and the Sunset Tunnel's east portal at
  // the park's far end -------------------------------------------------------------------------------------
  muniPortal(ctx, decals, L, heading, { alBox, alSq, alMouth, alEnd, off, y: yMouth });
  const hillX = sunsetPortal(ctx, decals, near, mouth.x, mouth.z, heading);
  // No houses on the south side where the tunnel's hill is, at the foot of the wall.
  const pe = pointAt(c, sEnd);
  const hillS = sEnd + Math.max(0, (pe.x - hillX) * -Math.cos(pe.heading)) + 3;
  const railsNear = (x: number, z: number): number => {
    let best = Infinity;
    for (let i = 0; i < west.length - 1; i++) {
      const p = west[i];
      const q = west[i + 1];
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const l2 = dx * dx + dz * dz || 1;
      const f = Math.max(0, Math.min(1, ((x - p.x) * dx + (z - p.z) * dz) / l2));
      best = Math.min(best, Math.hypot(p.x + dx * f - x, p.z + dz * f - z));
    }
    return best;
  };
  return {
    hood: { noHouses: (s, side) => side < 0 && s >= sEnd - 2 && s <= hillS },
    railsNear,
  };
}

/** Two rails along a run, standard gauge, a little proud of the surface. */
function rails(b: GeoBuilder, r: RailPt[]): void {
  // (Matte: the metal material makes them read as painted lines.)
  for (const v of [-GAUGE / 2, GAUGE / 2]) strip(b, r, v - 0.045, v + 0.045, (i) => r[i].y + 0.035, STEEL, { sides: true, bottom: (i) => r[i].y - 0.02 });
}

/** A catenary pole: a tapering steel mast on a collar. */
function pole(b: GeoBuilder, x: number, y: number, z: number, h: number): void {
  cyl(b, [x, y - 0.3, z], [x, y + h, z], 0.1, 0.15, 8, POLE);
  cyl(b, [x, y, z], [x, y + 0.6, z], 0.2, 0.22, 8, POLE);
}

/** A box in the line's frame: `al` along it, `v` to its right, heights y. */
function lineBox(b: GeoBuilder, L: Line, heading: number, al0: number, al1: number, v0: number, v1: number, y0: number, y1: number, color: string): void {
  const p = L.at((al0 + al1) / 2, (v0 + v1) / 2);
  obox(b, [p.x, (y0 + y1) / 2, p.z], [Math.abs(al1 - al0), y1 - y0, Math.abs(v1 - v0)], [0, -heading, 0], color);
}

/**
 * A block in the line's frame whose top slopes along it (from yTop0 at al0 to yTop1 at al1): the
 * portal's walls and banks. Faces: the top, both long sides, the high end.
 */
function slopedBlock(b: GeoBuilder, L: Line, al0: number, al1: number, v0: number, v1: number, yBot: number, yTop0: number, yTop1: number, color: string, top = color): void {
  const P = (al: number, v: number, y: number): V3 => {
    const p = L.at(al, v);
    return [p.x, y, p.z];
  };
  const up: V3 = [0, 1, 0];
  b.quad(P(al0, v0, yTop0), P(al1, v0, yTop1), P(al1, v1, yTop1), P(al0, v1, yTop0), top, up);
  const hi = Math.max(v0, v1);
  const lo = Math.min(v0, v1);
  const rv: V3 = [-L.uz, 0, L.ux];
  b.quad(P(al0, hi, yBot), P(al1, hi, yBot), P(al1, hi, yTop1), P(al0, hi, yTop0), color, rv);
  b.quad(P(al0, lo, yBot), P(al1, lo, yBot), P(al1, lo, yTop1), P(al0, lo, yTop0), color, [-rv[0], 0, -rv[2]]);
  const end: V3 = al1 > al0 ? [L.ux, 0, L.uz] : [-L.ux, 0, -L.uz];
  b.quad(P(al1, v0, yBot), P(al1, v1, yBot), P(al1, v1, yTop1), P(al1, v0, yTop1), color, end);
}

/**
 * The Duboce portal, where the N Judah (and the J, K, L, M) come up out of the Market St subway: on
 * the corner's arm, behind the course, the rails down its south half. They run between concrete walls
 * that rise as the planted banks either side climb to the deck over the mouth (the ground can't be
 * dug, so the portal is at grade: the banks are built up round it); MUNI METRO across the headwall;
 * the covered way runs on under the deck, dark, past where the streetcar stops inside; sidewalks
 * along both sides of the arm.
 */
function muniPortal(ctx: Ctx, decals: Decals, L: Line, heading: number, f: { alBox: number; alSq: number; alMouth: number; alEnd: number; off: number; y: number }): void {
  const S = ctx.sinks;
  const { alBox, alSq, alMouth, alEnd, off, y } = f;
  // The arm is the street's (centred `off` to the rails' right); the rails run down its south half.
  const vN = off + 7.5;
  const vS = off - 7.5;
  ctx.occ.claim(rectPoly(L.ox, L.oz, heading, alEnd - 2, alBox, vS - 3, vN + 3));
  const deck = y + 5.5;
  const mouthH = 4.7;
  const mouthW = 2.2;
  /** A strip in the line's frame from al0 to al1, v0 to v1, on the ground (`lift` above it). */
  const onGround = (b: GeoBuilder, al0: number, al1: number, v0: number, v1: number, lift: number, color: string, uv = 4): void => {
    const n = Math.max(1, Math.ceil(Math.abs(al1 - al0) / 2));
    const r: RailPt[] = [];
    for (let i = 0; i <= n; i++) {
      const al = al0 + ((al1 - al0) * i) / n;
      const p = L.at(al, (v0 + v1) / 2);
      const q = L.at(al);
      r.push({ x: q.x, z: q.z, tx: L.ux, tz: L.uz, y: ctx.ground(p.x, p.z) });
    }
    strip(b, r, v0, v1, (i) => r[i].y + lift, color, { uvScale: uv, sides: true, bottom: (i) => r[i].y - 0.6 });
  };
  // The street's end of the arm, between the corner and the banks: asphalt; sidewalks along both
  // sides, level with the corner's.
  onGround(S.asphalt, alSq - 0.5, alBox + 0.2, 1.9, vN, 0.03, '#ffffff', 6);
  onGround(S.asphalt, alSq - 0.5, alBox + 0.2, vS, -1.9, 0.03, '#ffffff', 6);
  onGround(S.sidewalk, alEnd - 2, alSq, vN, vN + WALK - 1, KERB, '#d9d3c6', 3);
  onGround(S.sidewalk, alEnd - 2, alSq, vS - WALK + 1, vS, KERB, '#d9d3c6', 3);
  // The walls either side of the rails, rising to the headwall; the banks behind them, and their
  // outer walls along the sidewalks.
  const g0 = (() => {
    const p = L.at(alSq);
    return ctx.ground(p.x, p.z);
  })();
  const low = Math.min(g0, y) - 0.4;
  for (const [a, b] of [
    [1.95, 2.45],
    [-2.45, -1.95],
  ]) slopedBlock(S.concrete, L, alSq, alMouth, a, b, low, g0 + 0.35, deck + 0.45, WALLS, '#d8d3c8');
  slopedBlock(S.hedge, L, alSq + 0.5, alMouth, 2.45, vN - 0.2, low, g0 + 0.05, deck, WALLS, '#5f8f4a');
  slopedBlock(S.hedge, L, alSq + 0.5, alMouth, vS + 0.2, -2.45, low, g0 + 0.05, deck, WALLS, '#5f8f4a');
  slopedBlock(S.concrete, L, alSq + 0.5, alMouth, vN - 0.2, vN + 0.05, low, g0 + 0.5, deck + 0.35, WALLS, '#d8d3c8');
  slopedBlock(S.concrete, L, alSq + 0.5, alMouth, vS - 0.05, vS + 0.2, low, g0 + 0.5, deck + 0.35, WALLS, '#d8d3c8');
  // The headwall: piers, the lintel over the mouth, a surround, the cornice.
  const hw0 = alMouth - 0.9;
  const top = deck + 1.9;
  lineBox(S.concrete, L, heading, hw0, alMouth, mouthW, vN + 0.7, y - 0.4, top, WALLS);
  lineBox(S.concrete, L, heading, hw0, alMouth, vS - 0.7, -mouthW, y - 0.4, top, WALLS);
  lineBox(S.concrete, L, heading, hw0, alMouth, -mouthW, mouthW, y + mouthH, top, WALLS);
  lineBox(S.concrete, L, heading, alMouth, alMouth + 0.14, mouthW, mouthW + 0.4, y, y + mouthH + 0.4, '#dcd7cc');
  lineBox(S.concrete, L, heading, alMouth, alMouth + 0.14, -mouthW - 0.4, -mouthW, y, y + mouthH + 0.4, '#dcd7cc');
  lineBox(S.concrete, L, heading, alMouth, alMouth + 0.14, -mouthW - 0.4, mouthW + 0.4, y + mouthH, y + mouthH + 0.4, '#dcd7cc');
  lineBox(S.concrete, L, heading, hw0 - 0.2, alMouth + 0.3, vS - 1.1, vN + 1.1, top, top + 0.3, '#dcd7cc');
  {
    // MUNI METRO across the headwall, over the arm's middle.
    const p = L.at(alMouth + 0.02, off);
    decals.quad('muni', [p.x, deck + 0.95, p.z], [L.uz, 0, -L.ux], [0, 1, 0], 7.4, 0.92);
  }
  // The covered way: its walls, its roof, the deck on top; dark inside.
  lineBox(S.concrete, L, heading, alEnd, hw0, mouthW, vN + 0.05, y - 0.4, deck, WALLS);
  lineBox(S.concrete, L, heading, alEnd, hw0, vS - 0.05, -mouthW, y - 0.4, deck, WALLS);
  lineBox(S.concrete, L, heading, alEnd, hw0, -mouthW, mouthW, y + mouthH, deck, WALLS);
  lineBox(S.concrete, L, heading, alEnd - 0.6, alEnd, vS - 0.05, vN + 0.05, y - 0.4, deck, WALLS);
  lineBox(S.hedge, L, heading, alEnd - 0.6, hw0, vS + 0.2, vN - 0.2, deck, deck + 0.3, '#5f8f4a');
  {
    const P = (al: number, v: number, yy: number): V3 => {
      const p = L.at(al, v);
      return [p.x, yy, p.z];
    };
    const rv: V3 = [-L.uz, 0, L.ux];
    const k = S.paint;
    k.quad(P(alMouth, -mouthW + 0.02, y), P(alEnd, -mouthW + 0.02, y), P(alEnd, -mouthW + 0.02, y + mouthH), P(alMouth, -mouthW + 0.02, y + mouthH), DARK, rv);
    k.quad(P(alMouth, mouthW - 0.02, y), P(alEnd, mouthW - 0.02, y), P(alEnd, mouthW - 0.02, y + mouthH), P(alMouth, mouthW - 0.02, y + mouthH), DARK, [-rv[0], 0, -rv[2]]);
    k.quad(P(alMouth, -mouthW, y + mouthH - 0.02), P(alEnd, -mouthW, y + mouthH - 0.02), P(alEnd, mouthW, y + mouthH - 0.02), P(alMouth, mouthW, y + mouthH - 0.02), DARK, [0, -1, 0]);
    k.quad(P(alEnd + 0.02, -mouthW, y), P(alEnd + 0.02, mouthW, y), P(alEnd + 0.02, mouthW, y + mouthH), P(alEnd + 0.02, -mouthW, y + mouthH), DARK, [L.ux, 0, L.uz]);
  }
  // A few young trees on the deck, and the Mint's rock breaking out of the north bank.
  const rng = ctx.rng;
  for (const [al, v] of [
    [alMouth - 5, off + 4.6],
    [alMouth - 11, off - 3.4],
    [alMouth - 15, off + 3.8],
  ]) {
    const p = L.at(al, v);
    tree(S.foliage, p.x, deck + 0.3, p.z, 0.9 + rng() * 0.3, rng);
  }
  {
    const p = L.at((alSq + alMouth) / 2 - 3, off + 3.6);
    crag(S.stone, p.x, y + 2.6, p.z, 2.2, 1.6, 1.8, rng);
  }
}

/**
 * The Sunset Tunnel's east portal (1928), where the N Judah goes under Buena Vista Heights: a cream
 * concrete headwall with the arched mouth between pilasters, SUNSET TUNNEL · 1928 across it, wing
 * walls stepping down either side, and the hill over it, grassed and planted. (x, z): the middle of
 * the mouth; the rails run in heading `heading`. Returns how far along the course (past the park's
 * end) the hill reaches, for the houses.
 */
function sunsetPortal(ctx: Ctx, decals: Decals, near: Near, x: number, z: number, heading: number): number {
  const S = ctx.sinks;
  const rng = ctx.rng;
  const fx = Math.cos(heading);
  const fz = Math.sin(heading);
  const rx = -fz;
  const rz = fx;
  const y = ctx.ground(x, z) - 0.1;
  const P = (f: number, r: number, yy: number): V3 => [x + fx * f + rx * r, yy, z + fz * f + rz * r];
  const face: V3 = [-fx, 0, -fz];
  const CREAM = '#e3d9c5';
  const TRIM = '#cbbea6';
  // The headwall, its arched mouth cut through it.
  const W = 5.6;
  const H = 8;
  const archW = 2.5;
  const spring = 3.2;
  {
    const sh = new THREE.Shape();
    sh.moveTo(-W, 0);
    sh.lineTo(W, 0);
    sh.lineTo(W, H);
    sh.lineTo(-W, H);
    sh.lineTo(-W, 0);
    const hole = new THREE.Path();
    hole.moveTo(-archW, 0.01);
    hole.lineTo(archW, 0.01);
    hole.lineTo(archW, spring);
    hole.absarc(0, spring, archW, 0, Math.PI, false);
    hole.lineTo(-archW, 0.01);
    sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false, curveSegments: 10 });
    // Shape x → the right (r), shape y → up, extrusion (z) → into the hill (f).
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(rx, 0, rz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(fx, 0, fz));
    m.setPosition(x, y, z);
    g.applyMatrix4(m);
    S.concrete.add(g, CREAM);
  }
  // Pilasters, the cornice and parapet, the lettering, a keystone.
  const pb = (f0: number, f1: number, r0: number, r1: number, y0: number, y1: number, color: string): void => {
    const c = P((f0 + f1) / 2, (r0 + r1) / 2, (y0 + y1) / 2);
    obox(S.concrete, c, [Math.abs(f1 - f0), y1 - y0, Math.abs(r1 - r0)], [0, -heading, 0], color);
  };
  for (const s of [-1, 1]) {
    pb(-0.3, 0.2, s * (archW + 0.5), s * (archW + 1.4), y - 0.2, y + H - 0.4, TRIM);
    pb(-0.45, 0.2, s * (archW + 0.4), s * (archW + 1.5), y + H - 1.6, y + H - 1.3, CREAM);
  }
  pb(-0.4, 1.4, -W - 0.35, W + 0.35, y + H - 0.4, y + H + 0.05, TRIM);
  pb(-0.2, 1.2, -W, W, y + H + 0.05, y + H + 0.9, CREAM);
  pb(-0.25, 0.1, -0.45, 0.45, y + spring + archW - 0.5, y + spring + archW + 0.35, TRIM);
  {
    const c = P(-0.33, 0, y + H - 0.95);
    decals.quad('sunset', c, [rx, 0, rz], [0, 1, 0], 5.8, 0.72);
  }
  // Wing walls, stepping down back into the hill.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const h = H - 2.2 - k * 1.9;
      const r0 = s * (W + k * 1.6);
      const r1 = s * (W + (k + 1) * 1.6);
      pb(0.1 + k * 0.9, 1.3 + k * 0.9, r0, r1, y - 0.4, y + h, CREAM);
      pb(0.05 + k * 0.9, 1.35 + k * 0.9, r0, r1, y + h, y + h + 0.25, TRIM);
    }
  }
  // Dark inside: the walls, the vault, the back; the rails on in.
  {
    const k = S.paint;
    const depth = 7;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a0 = (Math.PI * i) / n;
      const a1 = (Math.PI * (i + 1)) / n;
      const r0 = Math.cos(a0) * (archW - 0.02);
      const r1 = Math.cos(a1) * (archW - 0.02);
      const y0 = y + spring + Math.sin(a0) * (archW - 0.02);
      const y1 = y + spring + Math.sin(a1) * (archW - 0.02);
      k.quad(P(0.05, r0, y0), P(depth, r0, y0), P(depth, r1, y1), P(0.05, r1, y1), DARK, [-(rx * (r0 + r1)), -1, -(rz * (r0 + r1))]);
    }
    for (const s of [-1, 1]) {
      const r = s * (archW - 0.02);
      k.quad(P(0.05, r, y), P(depth, r, y), P(depth, r, y + spring), P(0.05, r, y + spring), DARK, [-rx * s, 0, -rz * s]);
    }
    k.quad(P(depth, -archW, y), P(depth, archW, y), P(depth, archW, y + spring + archW), P(depth, -archW, y + spring + archW), DARK, face);
    rails(S.paint, [0, depth].map((f) => ({ x: x + fx * f, z: z + fz * f, tx: fx, tz: fz, y: y + 0.15 })));
  }
  // The hill over the tunnel: grassed mounds (f along the rails, r across, radii), kept off the road;
  // shrubs and trees on them.
  const mounds: [number, number, number, number, number][] = [];
  // (Clear of the tunnel itself: behind its end, and either side of it.)
  for (const [f, r, af, ay, ar] of [
    [12.6, 0, 5.4, 9, 7.5],
    [6.2, -6.6, 4.6, 7.4, 3.9],
    [6.2, 6.6, 4.6, 7.4, 3.9],
    [15, 5, 6, 7, 6],
    [15, -5, 6, 7, 6],
  ] as const) {
    const c = P(f, r, y);
    if (near.margin(c[0], c[2]) < Math.max(af, ar) * 0.8) continue;
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(af, ay, ar);
    g.rotateY(-heading + (rng() - 0.5) * 0.3);
    g.translate(c[0], y - 0.6, c[2]);
    S.hedge.add(g, rng() < 0.5 ? '#5d8a48' : '#557f42');
    mounds.push([f, r, af, ay, ar]);
  }
  /** The top of the hill over (f, r), if it's on it. */
  const hillTop = (f: number, r: number): number | null => {
    let best: number | null = null;
    for (const [mf, mr, af, ay, ar] of mounds) {
      const q = 1 - ((f - mf) / af) ** 2 - ((r - mr) / ar) ** 2;
      if (q > 0.15) best = Math.max(best ?? -Infinity, y - 0.6 + ay * Math.sqrt(q));
    }
    return best;
  };
  for (let k = 0; k < 9; k++) {
    const f = 4 + rng() * 13;
    const r = (rng() - 0.5) * 13;
    const top = hillTop(f, r);
    const c = P(f, r, 0);
    if (top === null || near.margin(c[0], c[2]) < 3) continue;
    if (k % 3 === 0) shrub(S.foliage, c[0], top - 0.3, c[2], 1.2, rng);
    else tree(S.foliage, c[0], top - 0.4, c[2], 1 + rng() * 0.4, rng);
  }
  ctx.occ.claim([
    [P(-1, -W - 5, 0)[0], P(-1, -W - 5, 0)[2]],
    [P(-1, W + 5, 0)[0], P(-1, W + 5, 0)[2]],
    [P(21, W + 5, 0)[0], P(21, W + 5, 0)[2]],
    [P(21, -W - 5, 0)[0], P(21, -W - 5, 0)[2]],
  ]);
  // How far west the hill goes (world x), for the houses along the wall.
  let west = x;
  for (const [f, r, af] of mounds) west = Math.min(west, P(f + af, r, 0)[0]);
  return west;
}

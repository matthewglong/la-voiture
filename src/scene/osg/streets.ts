// Old Stomping Grounds' streets: the road itself (asphalt on the streets, pale paths in the parks,
// Buena Vista's weathered walks between low stone walls), and everything the course's sections say
// a San Francisco street has: sidewalks and kerbs, the cross streets running off at every crossing
// and corner, continental crosswalks, the double yellow line, green street-name signs, lamps, street
// trees and the trolley wires over Haight and Hayes. Where the houses go is left to the caller: this
// returns the frontages.
import * as THREE from 'three';
import { pointAt, type CoursePoint, type Section } from '../../track';
import { GeoBuilder, box, cyl, meshOf, obox, strip, type V3 } from '../geo';
import { namePlate, namesTexture, tree } from '../props';
import type { Frontage } from '../victorian';
import { along, rectPoly, type Ctx } from './context';
import { markThing } from './kerbside';
import { PARK_PATH, PAVE_UV, SIDEWALK, kerbQuad, paveQuad, walkGround, walkStrip } from './paving';

/** Stretches of plain street (sidewalks and houses both sides). */
export const STREET_KINDS = new Set(['street', 'shops', 'ladies', 'rails', 'wall', 'haight', 'panhandle', 'portal', 'mint', 'castro', 'noe', 'mission', 'market', 'dolores', 'churchPark']);
/** Where a cross street passes across the course, and where the course turns at an intersection. */
export const CROSSING = 'crossing';
export const CORNER = 'corner';
/** Paths through the parks (pale asphalt down the middle, lawn to the hedges). */
export const PARK_KINDS = new Set(['ramp', 'park', 'dogs', 'circle', 'summit', 'lawn', 'green', 'duboce', 'dpark', 'hill', 'top']);
/** Buena Vista's walks between stone walls. */
export const BV_KINDS = new Set(['bv', 'bvSummit', 'switchbacks']);

/** Sidewalk width and kerb height (m). */
export const WALK = 3.5;
export const KERB = 0.16;
/** How far out from the corridor's edge the poles on a sidewalk stand (m): behind race day's
 *  barriers (furniture.ts), which are 0.45 out. */
export const POLE_SET = 1.2;
/** How far the cross streets run off the course before the houses close them off (m), and how wide
 *  they are. */
const ARM = 34;
const CROSS_W = 12;

const ASPHALT = '#ffffff';
const WHITE = '#f4f4ee';
const YELLOW = '#f5c431';

/** Course points every `step` metres from s0 to s1 (both ends). */
export function pts(c: Ctx['course'], s0: number, s1: number, step = 0.5): CoursePoint[] {
  const out: CoursePoint[] = [];
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  for (let i = 0; i <= n; i++) out.push(pointAt(c, s0 + ((s1 - s0) * i) / n));
  return out;
}

/** An intersection where the course turns: its centre and the two ways it doesn't use. */
export interface Turn {
  sec: Section;
  x: number;
  z: number;
  y: number;
  /** The heading the course comes in on and leaves on. */
  hIn: number;
  hOut: number;
}

/** The centre of a corner: where the road coming in, carried straight on, meets the road going out,
 *  carried back. */
export function turnOf(c: Ctx['course'], sec: Section): Turn {
  const a = pointAt(c, sec.s0);
  const b = pointAt(c, sec.s1);
  // a + t·(tx, tz) = b − u·(bx, bz): solve the 2×2 system.
  const det = a.tx * -b.tz - a.tz * -b.tx;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.abs(det) > 1e-6 ? (dx * -b.tz - dz * -b.tx) / det : 0;
  return { sec, x: a.x + a.tx * t, z: a.z + a.tz * t, y: (a.y + b.y) / 2, hIn: a.heading, hOut: b.heading };
}

/** A cross street's arm off the course: from (x, z) heading `h`, `u0` to `u1` along it, its road
 *  `road` either side of its middle and a sidewalk beyond each edge; level with the course (`y`)
 *  where it leaves it, or climbing to `y1` at `u1` (a street between two corners). */
export interface Arm {
  x: number;
  z: number;
  y: number;
  y1?: number;
  h: number;
  u0: number;
  u1: number;
  road: number;
}

/** The arm a crossing puts out on one side of the course (+1 right): a standard-width street from
 *  the kerb line, centred where the crossing's middle would be (a longer crossing section can carry
 *  on into a turn off it). */
function crossingArm(c: Ctx['course'], sec: Section, side: 1 | -1): Arm {
  const mid = pointAt(c, Math.min(sec.s0 + CROSS_W / 2, (sec.s0 + sec.s1) / 2));
  return { x: mid.x - mid.tz * side * sec.hw, z: mid.z + mid.tx * side * sec.hw, y: mid.y, h: mid.heading + (side * Math.PI) / 2, u0: -0.5, u1: ARM, road: CROSS_W / 2 };
}

/** The two arms a turning corner puts out from its centre: straight on from the way in, and back
 *  from the way out. */
function cornerArms(c: Ctx['course'], sec: Section): Arm[] {
  const t = turnOf(c, sec);
  return [t.hIn, t.hOut + Math.PI].map((h) => ({ x: t.x, z: t.z, y: t.y, h, u0: sec.hw - 0.5, u1: ARM, road: sec.hw }));
}

/** Does an arm reach into open ground (a park the cars can drive anywhere in: course.open)? Then
 *  it isn't laid: the street stops at the park (Grove St at Alamo Square). */
export function armInOpen(c: Ctx['course'], a: Arm): boolean {
  const open = c.open;
  if (!open?.length) return false;
  const cx = Math.cos(a.h);
  const sx = Math.sin(a.h);
  for (let u = a.u0 + 2; u <= a.u1; u += 4) {
    for (const v of [-a.road, 0, a.road]) {
      const x = a.x + cx * u - sx * v;
      const z = a.z + sx * u + cx * v;
      if (open.some((o) => o.contains(x, z))) return true;
    }
  }
  return false;
}

/** Every arm the streets could put out along the course (buildStreets lays those whose ground
 *  nothing else has claimed): the ground is graded level under them before anything's built. */
export function streetArms(c: Ctx['course']): Arm[] {
  const out: Arm[] = [];
  for (let k = 0; k < c.sections.length; k++) {
    const sec = c.sections[k];
    if (sec.kind === CROSSING) {
      if (turning(c, c.sections[(k + 1) % c.sections.length]) && sec.s1 - sec.s0 < 8) continue;
      out.push(crossingArm(c, sec, 1), crossingArm(c, sec, -1));
    } else if (turning(c, sec)) out.push(...cornerArms(c, sec));
  }
  return out;
}

/** A flat slab (the top at `top`) over a polygon given in a frame at (x, z) turned `h`: u along,
 *  v to the right. Kerb faces all round down to `bottom`. */
function slab(b: Ctx['sinks']['concrete'], x: number, z: number, h: number, u0: number, u1: number, v0: number, v1: number, top: number, bottom: number, color: string): void {
  obox(b, [x + ((u0 + u1) / 2) * Math.cos(h) - ((v0 + v1) / 2) * Math.sin(h), (top + bottom) / 2, z + ((u0 + u1) / 2) * Math.sin(h) + ((v0 + v1) / 2) * Math.cos(h)], [u1 - u0, top - bottom, v1 - v0], [0, -h, 0], color);
}

/**
 * A strip in a street's own frame (from (x, z), u along heading h, v to its right) that follows the
 * ground: `lift` above it, skirts down `sink` below. For the cross streets running off the course.
 * `cell`: the drape's grid (m); where the ground creases (beside a corner that climbs), a coarse
 * one lets the ground's own facets show through between its points.
 */
export function groundStrip(ctx: Ctx, b: Ctx['sinks']['asphalt'], x: number, z: number, h: number, u0: number, u1: number, v0: number, v1: number, lift: number, sink: number, color: string, uvScale = 4, cell = 2): void {
  const tx = Math.cos(h);
  const tz = Math.sin(h);
  // Draped: a grid `cell` square, every corner on the ground under it (a crossing or a corner
  // square on a hillside slopes both ways), skirted down its two long edges.
  const n = Math.max(1, Math.ceil((u1 - u0) / cell));
  const m = Math.max(1, Math.ceil((v1 - v0) / cell));
  const at = (i: number, j: number): V3 => {
    const u = u0 + ((u1 - u0) * i) / n;
    const v = v0 + ((v1 - v0) * j) / m;
    const px = x + tx * u - tz * v;
    const pz = z + tz * u + tx * v;
    return [px, ctx.ground(px, pz), pz];
  };
  const grid: V3[][] = [];
  for (let i = 0; i <= n; i++) {
    const row: V3[] = [];
    for (let j = 0; j <= m; j++) row.push(at(i, j));
    grid.push(row);
  }
  const up: V3 = [0, 1, 0];
  const lifted = (p: V3, dy: number): V3 => [p[0], p[1] + dy, p[2]];
  const uv = (i: number, j: number): [number, number] => [(v0 + ((v1 - v0) * j) / m) / uvScale, (u0 + ((u1 - u0) * i) / n) / uvScale];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      b.quad(lifted(grid[i][j], lift), lifted(grid[i + 1][j], lift), lifted(grid[i + 1][j + 1], lift), lifted(grid[i][j + 1], lift), color, up, [uv(i, j), uv(i + 1, j), uv(i + 1, j + 1), uv(i, j + 1)]);
    }
    for (const [j, f] of [
      [0, -1],
      [m, 1],
    ] as const) {
      const a = grid[i][j];
      const c = grid[i + 1][j];
      b.quad(lifted(a, lift), lifted(c, lift), lifted(c, -sink), lifted(a, -sink), color, [-tz * f, 0, tx * f]);
    }
  }
}

/**
 * The road: asphalt down every street (with a skirt into the ground), the parks' concrete paths
 * (only as wide as their paved band: the lawn either side is the ground), Buena Vista's walks, and the
 * 39 steps down to Fulton & Steiner as a flight of concrete treads.
 */
export function buildRoad(ctx: Ctx): void {
  const c = ctx.course;
  const S = ctx.sinks;
  for (const sec of c.sections) {
    const ps = pts(c, sec.s0 - 0.25, sec.s1 + 0.25);
    if (sec.kind === 'steps') {
      // Treads: one every 0.4 m of the flight, each a level slab at its height.
      const n = Math.max(2, Math.round((sec.s1 - sec.s0) / 0.4));
      for (let i = 0; i < n; i++) {
        const s = sec.s0 + ((sec.s1 - sec.s0) * i) / n;
        const p = pointAt(c, s);
        slab(S.concrete, p.x, p.z, p.heading, 0, (sec.s1 - sec.s0) / n + 0.02, -sec.hw, sec.hw, p.y + 0.12, p.y - 0.6, i % 2 ? '#ddd6c8' : '#d1cabb');
      }
      // Handrail-less, as surveyed: a kerb each side.
      for (const side of [-1, 1]) strip(S.concrete, ps, side * sec.hw, side * (sec.hw + 0.35), (i) => ps[i].y + 0.35, '#cfc8b8', { sides: true, bottom: (i) => ps[i].y - 0.6 });
      continue;
    }
    // Each edge stops just short of the centre of a bend tighter than the road is wide (else the
    // inside edge folds back over itself, leaving slivers of hole).
    const edge = (w: number, side: 1 | -1) => (i: number): number => {
      const k = ps[i].curv;
      return side * (Math.sign(k) === side ? Math.min(w, 1 / Math.abs(k) - 0.05) : w);
    };
    if (PARK_KINDS.has(sec.kind)) {
      // Scored concrete, as the sidewalks (their slabs, in metres).
      const w = sec.pave;
      strip(S.sidewalk, ps, edge(w, -1), edge(w, 1), (i) => ps[i].y + 0.04, sec.kind === 'green' ? SIDEWALK : PARK_PATH, { uvScale: PAVE_UV, sides: true, bottom: (i) => ps[i].y - 0.4 });
      continue;
    }
    if (BV_KINDS.has(sec.kind)) {
      strip(S.path, ps, edge(sec.hw, -1), edge(sec.hw, 1), (i) => ps[i].y + 0.04, '#cbbfa6', { uvScale: 5, sides: true, bottom: (i) => ps[i].y - 0.8 });
      continue;
    }
    strip(S.asphalt, ps, edge(sec.hw, -1), edge(sec.hw, 1), (i) => ps[i].y + 0.03, ASPHALT, { uvScale: 6, sides: true, bottom: (i) => ps[i].y - 1.6 });
  }
}

/** How far a corner turns (radians, + right; about 0 for a 'corner' that doesn't). */
function turnAngle(c: Ctx['course'], sec: Section): number {
  let d = pointAt(c, sec.s1).heading - pointAt(c, sec.s0).heading;
  d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
  return d;
}

/** A corner that really turns (a 'corner' section that doesn't is just street). */
function turning(c: Ctx['course'], sec: Section): boolean {
  return sec.kind === CORNER && Math.abs(turnAngle(c, sec)) > 0.4;
}

/** Which stretches get sidewalks along the course: the streets, a short crossing that leads
 *  straight into a corner (the corner's intersection has no arms there), and a 'corner' that doesn't
 *  turn. */
function walked(c: Ctx['course'], k: number): boolean {
  const sec = c.sections[k];
  if (STREET_KINDS.has(sec.kind)) return true;
  if (sec.kind === CORNER) return !turning(c, sec);
  const next = c.sections[(k + 1) % c.sections.length];
  return sec.kind === CROSSING && sec.s1 - sec.s0 < 8 && turning(c, next);
}

/** Where a stretch of the course's side is given over to something else: no sidewalk at all
 *  (`walk`), or a sidewalk but no row of houses behind it (`houses`: a park's edge, a landmark
 *  that brings its own buildings). side: +1 right, -1 left. `ownSigns`: corners that have their
 *  own street-name signs already. */
export interface SideRules {
  noWalk(s: number, side: 1 | -1): boolean;
  noHouses(s: number, side: 1 | -1): boolean;
  ownSigns?: [number, number][];
}

/** How far the cross streets' asphalt sits above the ground (m): the ground under a road is 8 cm
 *  below it (5 cm under a graded arm) and the course's own asphalt 3 cm above the road, so a cross
 *  street's stays just under the course's where they meet (by 2 cm) and clear of the ground's
 *  creases between its vertices. */
const ARM_LIFT = 0.09;

/** The grid the cross streets' asphalt is draped on (m): fine enough that the ground's creases (beside
 *  a corner that climbs, or a park's path that runs along its edge above the street) stay under it
 *  (ARM_LIFT). */
const DRAPE = 1;

/** How close to a neighbourhood's own street sign the standard pole may stand (m). */
const OWN_SIGN_R = 14;

/**
 * Sidewalks, cross streets, crosswalks, the centre line, signs, lamps, street trees and trolley
 * wires, as `rules` allow. Returns the frontages that are still free for houses.
 */
export function buildStreets(ctx: Ctx, rules: SideRules): { frontages: Frontage[]; turns: Turn[] } {
  const noSide = rules.noWalk;
  const c = ctx.course;
  const S = ctx.sinks;
  const frontages: Frontage[] = [];
  const turns: Turn[] = [];
  const names = new Set<string>();
  const signAt: { x: number; y: number; z: number; a: string; b: string; h: number }[] = [];

  // --- Sidewalks along the streets, both sides, and the ground they take.
  for (let k = 0; k < c.sections.length; k++) {
    const sec = c.sections[k];
    if (!walked(c, k)) continue;
    for (const side of [1, -1] as const) {
      // Runs of this side not given over to something else.
      let run: CoursePoint[] = [];
      const flush = (): void => {
        if (run.length > 2) {
          const r = run;
          const d0 = side * sec.hw;
          const d1 = side * (sec.hw + WALK);
          walkStrip(S.sidewalk, r, Math.min(d0, d1), Math.max(d0, d1), (i) => r[i].y + KERB, (i) => r[i].y - 0.8);
          // The houses' frontages along the back of the sidewalk, where houses are allowed.
          const dd = side * (sec.hw + WALK);
          let a = -1;
          for (let i = 0; i <= r.length; i++) {
            const ok = i < r.length && !rules.noHouses(r[i].s, side);
            if (ok && a < 0) a = i;
            if (!ok && a >= 0) {
              const pa = { x: r[a].x - r[a].tz * dd, z: r[a].z + r[a].tx * dd };
              const pb = { x: r[i - 1].x - r[i - 1].tz * dd, z: r[i - 1].z + r[i - 1].tx * dd };
              const len = Math.hypot(pb.x - pa.x, pb.z - pa.z);
              if (len > 5) {
                const ux = (pb.x - pa.x) / len;
                const uz = (pb.z - pa.z) / len;
                frontages.push(side > 0 ? { ox: pa.x, oz: pa.z, ux, uz, len } : { ox: pb.x, oz: pb.z, ux: -ux, uz: -uz, len });
              }
              a = -1;
            }
          }
        }
        run = [];
      };
      for (let s = sec.s0; s <= sec.s1 + 1e-6; s += 0.5) {
        if (noSide(s, side)) flush();
        else run.push(pointAt(c, s));
      }
      flush();
    }
  }

  // --- The centre line on the bigger streets (double yellow), stop lines before the crossings.
  for (let k = 0; k < c.sections.length; k++) {
    const sec = c.sections[k];
    if (!walked(c, k) || sec.s1 - sec.s0 < 10) continue;
    if (sec.kind === 'rails') continue;
    const r = pts(c, sec.s0 + 2, sec.s1 - 2, 1);
    for (const dz of [-0.2, 0.2]) strip(S.marks, r, dz - 0.07, dz + 0.07, (i) => r[i].y + 0.045, YELLOW);
  }

  // --- Crossings: the cross street both sides, crosswalks either side of it, the corners' signs.
  for (let k = 0; k < c.sections.length; k++) {
    const sec = c.sections[k];
    if (sec.kind !== CROSSING) continue;
    const next = c.sections[(k + 1) % c.sections.length];
    // A short crossing straight into a corner is that corner's intersection.
    if (turning(c, next) && sec.s1 - sec.s0 < 8) continue;
    // The cross street is a standard width, centred where the crossing's middle would be (a longer
    // crossing section can carry on into a turn off it).
    const w = CROSS_W;
    const mid = pointAt(c, Math.min(sec.s0 + w / 2, (sec.s0 + sec.s1) / 2));
    names.add(sec.name.toUpperCase());
    const courseName = c.sections[(k + c.sections.length - 1) % c.sections.length].name.toUpperCase();
    names.add(courseName);
    for (const side of [1, -1] as const) {
      if (noSide(sec.s0 - 1, side) && noSide(sec.s1 + 1, side)) continue;
      // The arm: asphalt from the kerb line out, sidewalks along both its edges; not where it would
      // run into a park or a landmark (Grove St stops at Alamo Square).
      const arm = crossingArm(c, sec, side);
      const { h, x: ox, z: oz, y } = arm;
      if (ctx.occ.taken(ox + Math.cos(h) * (WALK + 4), oz + Math.sin(h) * (WALK + 4)) || armInOpen(c, arm)) continue;
      groundStrip(ctx, S.asphalt, ox, oz, h, -0.5, ARM, -w / 2, w / 2, ARM_LIFT, 2, ASPHALT, 6, DRAPE);
      for (const e of [-1, 1]) {
        walkGround(ctx, S.sidewalk, ox, oz, h, WALK, ARM, e > 0 ? w / 2 : -w / 2 - WALK, e > 0 ? w / 2 + WALK : -w / 2, KERB, 2);
        // Frontages along the arm, facing it.
        const fx = ox + Math.cos(h) * (WALK + 1) - Math.sin(h) * (e * (w / 2 + WALK));
        const fz = oz + Math.sin(h) * (WALK + 1) + Math.cos(h) * (e * (w / 2 + WALK));
        const ux = Math.cos(h);
        const uz = Math.sin(h);
        const len = ARM - WALK - 3;
        frontages.push(e > 0 ? { ox: fx, oz: fz, ux, uz, len } : { ox: fx + ux * len, oz: fz + uz * len, ux: -ux, uz: -uz, len });
      }
      ctx.occ.claim(rectPoly(ox, oz, h, -0.5, ARM, -w / 2 - WALK, w / 2 + WALK));
      // A crosswalk across the arm, and the corner sign.
      for (let v = -w / 2 + 0.4; v < w / 2 - 0.4; v += 1.2) groundStrip(ctx, S.marks, ox, oz, h, 0.8, 3.2, v, v + 0.6, ARM_LIFT + 0.02, -ARM_LIFT - 0.005, WHITE);
      const sx = ox + Math.cos(h) * (WALK - 0.8) - Math.sin(h) * (w / 2 + 0.8);
      const sz = oz + Math.sin(h) * (WALK - 0.8) + Math.cos(h) * (w / 2 + 0.8);
      signAt.push({ x: sx, y: y + KERB, z: sz, a: sec.name.toUpperCase(), b: courseName, h: mid.heading });
    }
    // Continental crosswalks across the course at both edges of the crossing (not across the way
    // out when the course turns off there: into Alamo Square off Hayes, that's the park's path).
    let out = pointAt(c, sec.s1).heading - mid.heading;
    out -= Math.round(out / (2 * Math.PI)) * 2 * Math.PI;
    for (const s of Math.abs(out) > 0.3 ? [sec.s0 + 1.4] : [sec.s0 + 1.4, sec.s1 - 1.4]) {
      const r = pts(c, s - 1.2, s + 1.2, 0.6);
      for (let d = -sec.hw + 0.5; d < sec.hw - 0.5; d += 1.25) strip(S.marks, r, d, d + 0.62, (i) => r[i].y + 0.05, WHITE);
    }
  }

  // --- Corners: the intersection's other two arms, and a sidewalk square on each of its corners.
  for (const sec of c.sections) {
    if (!turning(c, sec)) continue;
    const t = turnOf(c, sec);
    turns.push(t);
    const hw = sec.hw;
    // Arms: straight on from the way in, and back from the way out.
    for (const arm of cornerArms(c, sec)) {
      const { h } = arm;
      if (ctx.occ.taken(t.x + Math.cos(h) * (hw + WALK + 4), t.z + Math.sin(h) * (hw + WALK + 4)) || armInOpen(c, arm)) continue;
      groundStrip(ctx, S.asphalt, t.x, t.z, h, hw - 0.5, ARM, -hw, hw, ARM_LIFT, 1.6, ASPHALT, 6, DRAPE);
      for (const e of [-1, 1]) {
        walkGround(ctx, S.sidewalk, t.x, t.z, h, hw, ARM, e > 0 ? hw : -hw - WALK, e > 0 ? hw + WALK : -hw, KERB, 0.8);
        const fx = t.x + Math.cos(h) * (hw + WALK + 1) - Math.sin(h) * (e * (hw + WALK));
        const fz = t.z + Math.sin(h) * (hw + WALK + 1) + Math.cos(h) * (e * (hw + WALK));
        const ux = Math.cos(h);
        const uz = Math.sin(h);
        const len = ARM - hw - WALK - 2;
        frontages.push(e > 0 ? { ox: fx, oz: fz, ux, uz, len } : { ox: fx + ux * len, oz: fz + uz * len, ux: -ux, uz: -uz, len });
      }
      ctx.occ.claim(rectPoly(t.x, t.z, h, 0, ARM, -hw - WALK, hw + WALK));
    }
    // The intersection itself, a sidewalk square on its three outer corners, and on the inside of the
    // turn, where the course's own asphalt doesn't reach (the car's arc cuts across the rest of that
    // corner), a kerb-high island from the kerb line in towards the arc's centre, meeting the
    // sidewalks either side, over a flush apron that catches the square's corner past the centre.
    // (All of it on the ground, which follows the road: a corner on a hill slopes.)
    groundStrip(ctx, S.asphalt, t.x, t.z, t.hIn, -hw, hw, -hw, hw, ARM_LIFT, 2, ASPHALT, 6, DRAPE);
    const inB = Math.sign(turnAngle(c, sec));
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        const inside = a < 0 && b === inB;
        walkGround(ctx, S.sidewalk, t.x, t.z, t.hIn, a > 0 ? hw : -hw - WALK, a > 0 ? hw + WALK : -hw, b > 0 ? hw : -hw - WALK, b > 0 ? hw + WALK : -hw, inside ? 0.02 : KERB, inside ? 0.5 : 2, false);
      }
    }
    {
      const ring = pts(c, sec.s0, sec.s1, 0.5);
      // As far in as a sidewalk goes, but never past the arc's centre.
      const reach = (p: CoursePoint): number => Math.min(p.hw + WALK, 1 / Math.max(1e-3, Math.abs(p.curv)) - 0.05);
      const at = (p: CoursePoint, d: number, y: number): V3 => [p.x - p.tz * inB * d, y, p.z + p.tx * inB * d];
      for (let i = 0; i + 1 < ring.length; i++) {
        const a = ring[i];
        const b = ring[i + 1];
        const ya = a.y + KERB;
        const yb = b.y + KERB;
        paveQuad(S.sidewalk, at(a, a.hw, ya), at(b, b.hw, yb), at(b, reach(b), yb), at(a, reach(a), ya));
        kerbQuad(S.sidewalk, at(a, a.hw, ya), at(b, b.hw, yb), at(b, b.hw, b.y - 0.3), at(a, a.hw, a.y - 0.3), [a.tz * inB, 0, -a.tx * inB]);
      }
    }
    ctx.occ.claim(rectPoly(t.x, t.z, t.hIn, -hw - WALK, hw + WALK, -hw - WALK, hw + WALK));
    names.add(sec.name.toUpperCase());
    const hx = Math.cos(t.hIn);
    const hz = Math.sin(t.hIn);
    signAt.push({ x: t.x + (hx - hz) * (hw + 1), y: t.y + KERB, z: t.z + (hz + hx) * (hw + 1), a: sec.name.toUpperCase(), b: '', h: t.hIn });
  }

  // --- The ground the streets take: the corridor and its sidewalks.
  for (let s = 0; s < c.length; s += 1) {
    const p = pointAt(c, s);
    const sec = c.sections[p.sec];
    const r = STREET_KINDS.has(sec.kind) || sec.kind === CROSSING || sec.kind === CORNER || sec.kind === 'hairpin' ? p.hw + WALK : p.hw + 1.2;
    ctx.occ.disc(p.x, p.z, r);
  }

  // --- Street-name signs: two green plates on a pole at the corners.
  {
    const all = [...names].filter((n) => n.length > 0);
    const tex = namesTexture(all);
    const plates = new THREE.Group();
    const geo = new GeoBuilder();
    for (const q of signAt) {
      if (rules.ownSigns?.some(([x, z]) => Math.hypot(q.x - x, q.z - z) < OWN_SIGN_R)) continue;
      const gy = ctx.ground(q.x, q.z);
      const y = Math.max(q.y, gy);
      cyl(S.metal, [q.x, y - 0.2, q.z], [q.x, y + 3.6, q.z], 0.055, 0.065, 8, '#1f4a3a');
      const ra = all.indexOf(q.a);
      const rb = q.b ? all.indexOf(q.b) : -1;
      const alongX = Math.abs(Math.cos(q.h)) > Math.abs(Math.sin(q.h));
      if (ra >= 0) {
        const g = namePlate(ra, all.length, alongX);
        g.translate(q.x, y + 3.25, q.z);
        geo.add(g, '#ffffff');
      }
      if (rb >= 0) {
        const g = namePlate(rb, all.length, !alongX);
        g.translate(q.x, y + 3.62, q.z);
        geo.add(g, '#ffffff');
      }
    }
    plates.add(meshOf(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }), 'streetSigns', true, false));
    ctx.group.add(plates);
  }

  // --- Lamps along the streets: a pole, an arm over the road and a lamp head, every 26 m.
  for (let j = 0; j < c.sections.length; j++) {
    const sec = c.sections[j];
    if (!walked(c, j) || sec.s1 - sec.s0 < 14) continue;
    let k = 0;
    for (let s = sec.s0 + 6; s < sec.s1 - 4; s += 26) {
      const side = k++ % 2 ? 1 : -1;
      if (noSide(s, side as 1 | -1)) continue;
      // (Back from the kerb, behind race day's barriers.)
      const p = along(c, s, side * (sec.hw + POLE_SET));
      markThing(ctx, p.x, p.z, 0.3);
      const y = p.y + KERB;
      const ax = -p.tz * -side;
      const az = p.tx * -side;
      cyl(S.metal, [p.x, y, p.z], [p.x, y + 7.2, p.z], 0.09, 0.13, 8, '#6b7178');
      cyl(S.metal, [p.x, y + 7.2, p.z], [p.x + ax * 1.8, y + 7.5, p.z + az * 1.8], 0.05, 0.05, 6, '#6b7178');
      obox(S.metal, [p.x + ax * 2.1, y + 7.42, p.z + az * 2.1], [0.9, 0.22, 0.4], [0, -Math.atan2(az, ax), 0], '#8a9097');
      obox(S.glow, [p.x + ax * 2.1, y + 7.29, p.z + az * 2.1], [0.7, 0.05, 0.3], [0, -Math.atan2(az, ax), 0], '#fff3cf');
    }
  }

  // --- Street trees in little planters at the kerb on the plainer streets (the neighbourhoods with
  // their own ideas dress theirs), every 13 m or so, sides alternating, clear of lamps and corners.
  for (let j = 0; j < c.sections.length; j++) {
    const sec = c.sections[j];
    if (!TREE_KINDS.has(sec.kind) || sec.s1 - sec.s0 < 16) continue;
    let k = 0;
    for (let s = sec.s0 + 5 + ctx.rng() * 4; s < sec.s1 - 5; s += 11 + ctx.rng() * 5) {
      const side = (k++ % 2 ? 1 : -1) as 1 | -1;
      if (noSide(s, side)) continue;
      // (Back from the kerb, behind race day's barriers.)
      const p = along(c, s, side * (sec.hw + 1.5));
      markThing(ctx, p.x, p.z, 0.7);
      const y = p.y + KERB;
      box(S.concrete, p.x - 0.55, p.x + 0.55, y - 0.3, y + 0.04, p.z - 0.55, p.z + 0.55, '#8a7b66');
      tree(S.foliage, p.x, y, p.z, 0.8 + ctx.rng() * 0.35, ctx.rng);
    }
  }

  return { frontages, turns };
}

/** Street kinds that get street trees here (the rest bring their own, or none: the Painted Ladies'
 *  block is bare, as it is). */
const TREE_KINDS = new Set(['street', 'rails', 'wall', 'mint', 'noe', 'market', 'churchPark']);

/** Trolley wires over a stretch of street: poles both sides every 30 m with span wires, and the two
 *  pairs of running wires 5.8 m up (Muni's trolleybuses). */
export function trolleyWires(ctx: Ctx, s0: number, s1: number, hw: number): void {
  const c = ctx.course;
  const S = ctx.sinks;
  const H = 5.8;
  const r = pts(c, s0, s1, 2);
  for (const d of [-2.4, -1.8, 1.8, 2.4]) {
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i];
      const b = r[i + 1];
      cyl(S.metal, [a.x - a.tz * d, a.y + H, a.z + a.tx * d], [b.x - b.tz * d, b.y + H, b.z + b.tx * d], 0.018, 0.018, 3, '#2a2c30');
    }
  }
  for (let s = s0 + 4; s < s1; s += 30) {
    const l = along(c, s, -(hw + 0.5));
    const rr = along(c, s, hw + 0.5);
    for (const q of [l, rr]) cyl(S.metal, [q.x, q.y, q.z], [q.x, q.y + H + 1.2, q.z], 0.1, 0.13, 8, '#5c6168');
    cyl(S.metal, [l.x, l.y + H + 0.9, l.z], [rr.x, rr.y + H + 0.9, rr.z], 0.02, 0.02, 3, '#2a2c30');
  }
}

/**
 * A street off the course (round a park, say) from a to b: asphalt on the ground, a sidewalk each
 * side unless `walks` says not, the ground it takes, and the frontages behind the sidewalks (facing
 * the street) that `houses` allows: [left, right] looking from a to b.
 */
export function sideStreet(
  ctx: Ctx,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  hw: number,
  opts: { walks?: [boolean, boolean]; houses?: [boolean, boolean]; line?: boolean } = {},
): Frontage[] {
  const S = ctx.sinks;
  const len = Math.hypot(bx - ax, bz - az);
  const tx = (bx - ax) / len;
  const tz = (bz - az) / len;
  const h = Math.atan2(tz, tx);
  // Draped over the ground like the cross streets' arms (a street across a slope tilts with it).
  groundStrip(ctx, S.asphalt, ax, az, h, 0, len, -hw, hw, ARM_LIFT, 1.2, ASPHALT, 6, DRAPE);
  if (opts.line !== false && len > 8) for (const dz of [-0.2, 0.2]) groundStrip(ctx, S.marks, ax, az, h, 4, len - 4, dz - 0.07, dz + 0.07, ARM_LIFT + 0.02, -ARM_LIFT - 0.005, YELLOW);
  const walks = opts.walks ?? [true, true];
  const houses = opts.houses ?? [true, true];
  const out: Frontage[] = [];
  ([-1, 1] as const).forEach((side, k) => {
    if (!walks[k]) return;
    const d0 = side * hw;
    const d1 = side * (hw + WALK);
    walkGround(ctx, S.sidewalk, ax, az, h, 0, len, Math.min(d0, d1), Math.max(d0, d1), KERB, 0.8);
    if (houses[k]) {
      const dd = side * (hw + WALK);
      const pa = { x: ax - tz * dd, z: az + tx * dd };
      out.push(side > 0 ? { ox: pa.x, oz: pa.z, ux: tx, uz: tz, len } : { ox: pa.x + tx * len, oz: pa.z + tz * len, ux: -tx, uz: -tz, len });
    }
  });
  ctx.occ.claim(rectPoly(ax, az, Math.atan2(tz, tx), 0, len, -(hw + (walks[0] ? WALK : 0)), hw + (walks[1] ? WALK : 0)));
  return out;
}

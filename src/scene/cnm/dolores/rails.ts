// The J Church and the F. Past Dolores Park the J runs on its own right of way between Church St and
// the lawn (two tracks on ballast, centre poles carrying both wires, a fence along the street, the
// footbridge at 19th), crossing 20th St at the top of the park by the course's corner; at 18th it swings
// into the middle of Church St and runs in the street (two tracks in concrete bands, span wires
// between poles either side) up past 17th, 16th and 15th and across Market (the sim's J runs on the
// west track: J_CHURCH). At 17th the F's single track turns off west along 17th St to its terminal
// loop, one of its vintage streetcars waiting there: a PCC in Muni's green and cream.
import * as THREE from 'three';
import { J_TRACK, STREET_HW } from '../../../maps/castroNoeMission';
import { pointAt, type Course } from '../../../track';
import { GeoBuilder, box, cyl, obox, rbox, strip, type V3 } from '../../geo';
import type { Frontage } from '../../victorian';
import type { Ctx } from '../../osg/context';
import { markThing } from '../../osg/kerbside';
import { KERB, POLE_SET } from '../../osg/streets';

/** Standard gauge (m); the contact wire's height over the rails, and the messenger's. */
const GAUGE = 1.435;
const WIRE_H = 5.6;
const MESSENGER_H = 6.35;
const STEEL = '#9aa0a6';
const POLE = '#3b4a42';
const WIRE = '#2a2c30';
const BAND = '#6f6b64';
const BALLAST = '#8c8478';
const TIE = '#5b4636';

/** The right of way's tracks, metres right of the course's centreline up Church St past the park,
 *  and the street's (the west one is the sim's J). */
const ROW_TRACKS = [7.75, 11.3];
const ROW_MID = (ROW_TRACKS[0] + ROW_TRACKS[1]) / 2;
const STREET_TRACKS = [J_TRACK, J_TRACK + 3.6];

interface RailPt {
  x: number;
  z: number;
  tx: number;
  tz: number;
  y: number;
  /** Set into the street (a concrete band), not on its own ballast. */
  street?: boolean;
}

export function buildRails(ctx: Ctx): { frontages: Frontage[] } {
  const c = ctx.course;
  const S = ctx.sinks;
  const sChurch = ctx.mark('dolores', 'church');
  const s19 = ctx.mark('dolores', '19th');
  const s18 = ctx.mark('dolores', '18th');
  const sMarket = ctx.mark('church', 'market');

  // The course's height where a point is on its road (and how far off it, across), else null.
  const near = courseNear(c, sChurch - 40, sMarket + 40);
  /** What a rail lies on at (x, z): the road (the course's height), or ballast on the ground. */
  const bed = (x: number, z: number): { y: number; road: boolean } => {
    const n = near(x, z);
    if (n && n.d < n.hw - 0.2) return { y: n.y + 0.03, road: true };
    return { y: ctx.ground(x, z) + 0.12, road: false };
  };

  // --- The tracks: along the right of way (from south of the corner at 20th), into the street at 18th,
  // and up Church St to past Market --------------------------------------------------------------------
  const pc = pointAt(c, sChurch);
  const sMerge0 = s18 - 26;
  const sMerge1 = s18 + 2;
  const tracks: RailPt[][] = [[], []];
  for (let k = 0; k < 2; k++) {
    const r = tracks[k];
    // South of the corner: straight on back along Church St's line, across 20th St, level with the
    // street there.
    for (let t = 14; t > 0; t -= 1) {
      const x = pc.x - pc.tx * t - pc.tz * ROW_TRACKS[k];
      const z = pc.z - pc.tz * t + pc.tx * ROW_TRACKS[k];
      const b = bed(x, z);
      r.push({ x, z, tx: pc.tx, tz: pc.tz, y: b.road ? b.y : Math.max(pc.y + 0.12, Math.min(b.y, pc.y + 0.6)), street: b.road });
    }
    // Up the right of way, easing into the street.
    for (let s = sChurch; s <= sMarket + 34; s += 1) {
      const f = smooth((s - sMerge0) / (sMerge1 - sMerge0));
      const d = ROW_TRACKS[k] + (STREET_TRACKS[k] - ROW_TRACKS[k]) * f;
      let x: number;
      let z: number;
      let tx: number;
      let tz: number;
      if (s <= sMarket) {
        const p = pointAt(c, s);
        x = p.x - p.tz * d;
        z = p.z + p.tx * d;
        tx = p.tx;
        tz = p.tz;
      } else {
        // On across Market, straight on (the J carries on north up Church St).
        const p = pointAt(c, sMarket);
        const t = s - sMarket;
        x = p.x + p.tx * t - p.tz * d;
        z = p.z + p.tz * t + p.tx * d;
        tx = p.tx;
        tz = p.tz;
      }
      const b = bed(x, z);
      r.push({ x, z, tx, tz, y: s >= sMerge0 && !b.road ? ctx.ground(x, z) + 0.11 : b.y, street: s >= sMerge0 || b.road });
    }
  }
  // Ballast and ties on the right of way; the concrete band where they're in the street; the rails.
  for (const r of tracks) {
    let run: RailPt[] = [];
    let onRoad: boolean | null = null;
    const flush = (): void => {
      if (run.length > 1) {
        const q = run;
        if (onRoad) strip(S.marks, q, -1.15, 1.15, (i) => q[i].y + 0.012, BAND);
        else {
          strip(S.concrete, q, -1.35, 1.35, (i) => q[i].y - 0.04, BALLAST, { sides: true, bottom: (i) => q[i].y - 0.5 });
          for (let i = 0; i < q.length; i++) {
            const p = q[i];
            obox(S.paint, [p.x, p.y - 0.02, p.z], [0.24, 0.1, 2.4], [0, -Math.atan2(p.tz, p.tx), 0], TIE);
          }
        }
      }
      run = run.length ? [run[run.length - 1]] : [];
    };
    for (const p of r) {
      const road = !!p.street;
      if (onRoad !== null && road !== onRoad) flush();
      onRoad = road;
      run.push(p);
    }
    flush();
    rails(S.paint, r);
  }

  // --- The wire -----------------------------------------------------------------------------------------
  const M = S.metal;
  const supports: { x: number; z: number; y: number }[] = [];
  // Past the park: centre poles between the tracks, an arm out over each.
  for (let s = sChurch - 18; s < sMerge0 - 4; s += 21) {
    if (Math.abs(s - (s19 + 6)) < 5) continue;
    const p = pointAt(c, s);
    const x = p.x - p.tz * ROW_MID;
    const z = p.z + p.tx * ROW_MID;
    const g = ctx.ground(x, z);
    catPole(M, x, g, z, 7.2);
    for (const d of ROW_TRACKS) {
      const wx = p.x - p.tz * d;
      const wz = p.z + p.tx * d;
      cyl(M, [x, g + 6.9, z], [wx, g + MESSENGER_H + 0.25, wz], 0.04, 0.04, 5, POLE);
      cyl(M, [x, g + 5.9, z], [wx, g + WIRE_H + 0.1, wz], 0.03, 0.03, 4, POLE);
      supports.push({ x: wx, z: wz, y: g });
    }
  }
  // In the street: poles in pairs on the sidewalks, span wires across (clear of the street lamps).
  const lamps = lampSpots(c, sMerge1, sMarket);
  for (let s = sMerge1 + 6; s < sMarket - 4; s += 27) {
    let sp = s;
    while (lamps.some((l) => Math.abs(l - sp) < 2.5)) sp += 2.5;
    const p = pointAt(c, sp);
    const l = { x: p.x - p.tz * -(STREET_HW + POLE_SET), z: p.z + p.tx * -(STREET_HW + POLE_SET) };
    const rr = { x: p.x - p.tz * (STREET_HW + POLE_SET), z: p.z + p.tx * (STREET_HW + POLE_SET) };
    const y = p.y + KERB;
    catPole(M, l.x, y, l.z, 7.4);
    catPole(M, rr.x, y, rr.z, 7.4);
    markThing(ctx, l.x, l.z, 0.3);
    markThing(ctx, rr.x, rr.z, 0.3);
    cyl(M, [l.x, y + 7.0, l.z], [rr.x, y + 7.0, rr.z], 0.02, 0.02, 3, WIRE);
    for (const d of STREET_TRACKS) {
      const wx = p.x - p.tz * d;
      const wz = p.z + p.tx * d;
      cyl(M, [wx, y + 7.0, wz], [wx, p.y + MESSENGER_H, wz], 0.015, 0.015, 3, WIRE);
      supports.push({ x: wx, z: wz, y: p.y });
    }
  }
  // The contact wire and its messenger over each track, sagging between supports.
  for (const r of tracks) {
    const w = every(r, 4);
    const sag = (x: number, z: number): number => {
      let best = Infinity;
      for (const q of supports) best = Math.min(best, Math.hypot(q.x - x, q.z - z));
      return Math.min(0.45, (best / 12) ** 2 * 0.45);
    };
    for (let i = 0; i < w.length - 1; i++) {
      const p = w[i];
      const q = w[i + 1];
      const ya = railTop(p) + WIRE_H;
      const yb = railTop(q) + WIRE_H;
      cyl(M, [p.x, ya, p.z], [q.x, yb, q.z], 0.011, 0.011, 3, WIRE);
      const ma = railTop(p) + MESSENGER_H - sag(p.x, p.z);
      const mb = railTop(q) + MESSENGER_H - sag(q.x, q.z);
      cyl(M, [p.x, ma, p.z], [q.x, mb, q.z], 0.009, 0.009, 3, WIRE);
      if (ma - ya > 0.12) cyl(M, [p.x, ma, p.z], [p.x, ya, p.z], 0.008, 0.008, 3, WIRE);
    }
  }

  // --- The right of way's fence along the street, and the footbridge at 19th ------------------------------
  {
    const r: { x: number; z: number; y: number }[] = [];
    for (let s = sChurch + 2; s < sMerge0; s += 2.4) {
      if (s > s19 - 1 && s < s19 + 13) continue;
      const p = pointAt(c, s);
      const d = STREET_HW + 0.12;
      r.push({ x: p.x - p.tz * d, z: p.z + p.tx * d, y: p.y + 0.02 });
    }
    for (let i = 0; i < r.length; i++) {
      const a = r[i];
      cyl(M, [a.x, a.y, a.z], [a.x, a.y + 1.3, a.z], 0.03, 0.03, 4, '#2e4a3e');
      const b = r[i + 1];
      if (b && Math.hypot(b.x - a.x, b.z - a.z) < 3) {
        for (const h of [0.25, 1.25]) cyl(M, [a.x, a.y + h, a.z], [b.x, b.y + h, b.z], 0.02, 0.02, 4, '#2e4a3e');
      }
    }
  }
  footbridge(ctx, s19 + 6);

  // --- The F: its track off Church St west along 17th St, and a PCC waiting on it ------------------------
  fLine(ctx, near);
  return { frontages: [] };
}

function smooth(f: number): number {
  const t = Math.max(0, Math.min(1, f));
  return t * t * (3 - 2 * t);
}

/** The top of a rail at a point of a track. */
function railTop(p: RailPt): number {
  return p.y + 0.06;
}

/** Points of a run at least `step` apart (and its last). */
function every(r: RailPt[], step: number): RailPt[] {
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
}

/** Two rails along a run, standard gauge, a little proud of what they lie on. */
function rails(b: GeoBuilder, r: RailPt[]): void {
  for (const v of [-GAUGE / 2, GAUGE / 2]) strip(b, r, v - 0.045, v + 0.045, (i) => r[i].y + 0.06, STEEL, { sides: true, bottom: (i) => r[i].y - 0.02 });
}

/** A catenary pole: a tapering steel mast on a collar. */
function catPole(b: GeoBuilder, x: number, y: number, z: number, h: number): void {
  cyl(b, [x, y - 0.3, z], [x, y + h, z], 0.1, 0.15, 8, POLE);
  cyl(b, [x, y, z], [x, y + 0.6, z], 0.2, 0.22, 8, POLE);
}

/** The course near (x, z), from s0 to s1: its height there, how far across, and its half-width. */
function courseNear(c: Course, s0: number, s1: number): (x: number, z: number) => { y: number; d: number; hw: number } | null {
  const pts: { x: number; z: number; y: number; hw: number; tx: number; tz: number }[] = [];
  for (let s = s0; s <= s1; s += 0.5) {
    const p = pointAt(c, s);
    pts.push({ x: p.x, z: p.z, y: p.y, hw: p.hw, tx: p.tx, tz: p.tz });
  }
  return (x, z) => {
    let best = Infinity;
    let q: (typeof pts)[number] | null = null;
    for (const p of pts) {
      const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d2 < best) {
        best = d2;
        q = p;
      }
    }
    if (!q || best > 400) return null;
    return { y: q.y, d: Math.abs(-(x - q.x) * q.tz + (z - q.z) * q.tx), hw: q.hw };
  };
}

/** Where the street lamps stand along the course from s0 to s1 (as streets.ts lays them: every 26 m
 *  from 6 m into each walked section). */
function lampSpots(c: Course, s0: number, s1: number): number[] {
  const out: number[] = [];
  for (const sec of c.sections) {
    if (sec.s1 < s0 || sec.s0 > s1 || sec.s1 - sec.s0 < 14) continue;
    for (let s = sec.s0 + 6; s < sec.s1 - 4; s += 26) out.push(s);
  }
  return out;
}

/**
 * The footbridge over the J's right of way at 19th: a railed deck high over the wires on two lattice
 * piers, one at the street's kerb and one at the lawn's edge.
 */
function footbridge(ctx: Ctx, s: number): void {
  const S = ctx.sinks;
  const p = pointAt(ctx.course, s);
  const at = (d: number): { x: number; z: number } => ({ x: p.x - p.tz * d, z: p.z + p.tx * d });
  const a = at(STREET_HW + 0.25);
  const b = at(ROW_TRACKS[1] + 1.15);
  const ya = p.y;
  const yb = ctx.ground(b.x, b.z);
  const deck = Math.max(ya, yb) + 7.4;
  const h = Math.atan2(b.z - a.z, b.x - a.x);
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const mx = (a.x + b.x) / 2;
  const mz = (a.z + b.z) / 2;
  obox(S.paint, [mx, deck, mz], [len + 0.6, 0.25, 2.0], [0, -h, 0], '#6e7b70');
  for (const e of [-0.95, 0.95]) {
    const ox = -Math.sin(h) * e;
    const oz = Math.cos(h) * e;
    obox(S.metal, [mx + ox, deck + 1.05, mz + oz], [len + 0.6, 0.06, 0.06], [0, -h, 0], '#2e4a3e');
    for (let k = 0; k <= 6; k++) {
      const f = k / 6 - 0.5;
      cyl(S.metal, [mx + Math.cos(h) * len * f + ox, deck, mz + Math.sin(h) * len * f + oz], [mx + Math.cos(h) * len * f + ox, deck + 1.05, mz + Math.sin(h) * len * f + oz], 0.025, 0.025, 4, '#2e4a3e');
    }
  }
  for (const [q, y] of [
    [a, ya],
    [b, yb],
  ] as const) {
    for (const [dx, dz] of [
      [-0.25, -0.7],
      [0.25, -0.7],
      [-0.25, 0.7],
      [0.25, 0.7],
    ]) {
      const ox = Math.cos(h) * dx - Math.sin(h) * dz;
      const oz = Math.sin(h) * dx + Math.cos(h) * dz;
      cyl(S.metal, [q.x + ox, y, q.z + oz], [q.x + ox, deck, q.z + oz], 0.045, 0.045, 5, '#4a564c');
    }
    for (let k = 1; k < 6; k++) {
      const yy = y + ((deck - y) * k) / 6;
      obox(S.metal, [q.x, yy, q.z], [0.55, 0.05, 1.45], [0, -h, 0], '#4a564c');
    }
  }
}

/** The F: a single track off the sim's J track (the west one) round onto 17th St's west arm, along it,
 *  and a PCC on it; a trolley wire over it. */
function fLine(ctx: Ctx, near: (x: number, z: number) => { y: number; d: number; hw: number } | null): void {
  const c = ctx.course;
  const S = ctx.sinks;
  const s17 = ctx.mark('church', '17th');
  const mid = pointAt(c, s17 + 6);
  // West: the course's left. The arm runs from the left kerb (d = -hw) straight out.
  const wx = mid.tz;
  const wz = -mid.tx;
  const R = 9;
  const d0 = STREET_TRACKS[0];
  // The curve: from the J track R short of the arm's middle line, round left onto it.
  const start = { x: mid.x - mid.tx * R - mid.tz * d0, z: mid.z - mid.tz * R + mid.tx * d0 };
  const cx = start.x + wx * R;
  const cz = start.z + wz * R;
  const r: RailPt[] = [];
  const surface = (x: number, z: number): number => {
    const n = near(x, z);
    if (n && n.d < n.hw - 0.2) return n.y + 0.03;
    return ctx.ground(x, z) + 0.1;
  };
  for (let k = 0; k <= 14; k++) {
    const a = (k / 14) * (Math.PI / 2);
    // From the start (heading north along the course), turning left round the centre to head west.
    const x = cx - wx * R * Math.cos(a) + mid.tx * R * Math.sin(a);
    const z = cz - wz * R * Math.cos(a) + mid.tz * R * Math.sin(a);
    const tx = mid.tx * Math.cos(a) + wx * Math.sin(a);
    const tz = mid.tz * Math.cos(a) + wz * Math.sin(a);
    r.push({ x, z, tx, tz, y: surface(x, z) });
  }
  const e = r[r.length - 1];
  for (let t = 1; t <= 28; t += 1) {
    const x = e.x + wx * t;
    const z = e.z + wz * t;
    r.push({ x, z, tx: wx, tz: wz, y: surface(x, z) });
  }
  strip(S.marks, r, -1.4, 1.4, (i) => r[i].y + 0.012, BAND);
  rails(S.paint, r);
  // The trolley wire over it, from the J's wire to the arm's end, on poles beside the arm.
  for (let i = 0; i < r.length - 4; i += 4) {
    const p = r[i];
    const q = r[i + 4];
    cyl(S.metal, [p.x, railTop(p) + WIRE_H, p.z], [q.x, railTop(q) + WIRE_H, q.z], 0.011, 0.011, 3, WIRE);
  }
  for (const t of [12, 26]) {
    const p = { x: e.x + wx * t, z: e.z + wz * t };
    for (const side of [-1, 1]) {
      const px = p.x + mid.tx * side * 7.2;
      const pz = p.z + mid.tz * side * 7.2;
      const y = ctx.ground(px, pz) + KERB;
      catPole(S.metal, px, y, pz, 7.2);
    }
    const y = ctx.ground(p.x, p.z) + 0.1;
    cyl(S.metal, [p.x - mid.tx * 7.2, y + 6.9, p.z - mid.tz * 7.2], [p.x + mid.tx * 7.2, y + 6.9, p.z + mid.tz * 7.2], 0.02, 0.02, 3, WIRE);
  }
  // A PCC waiting on the arm, facing back towards Church St.
  const pm = { x: e.x + wx * 21, z: e.z + wz * 21 };
  pcc(S, pm.x, ctx.ground(pm.x, pm.z) + 0.16, pm.z, Math.atan2(-wz, -wx));
}

/**
 * A PCC streetcar (the F's vintage cars, this one in Muni's green and cream): a streamlined body with
 * rounded ends, a band of windows, the belt line in red, on two trucks; its trolley pole up to the wire.
 * Facing `h` (radians), standing on the rails at y.
 */
function pcc(S: Ctx['sinks'], x: number, y: number, z: number, h: number): void {
  const m = new THREE.Matrix4().makeRotationY(-h).setPosition(x, y, z);
  const L = 14.2;
  const W = 2.55;
  // Trucks and wheels.
  for (const e of [-L * 0.3, L * 0.3]) {
    box(S.metal, e - 1.3, e + 1.3, 0.12, 0.62, -1.0, 1.0, '#26282b', m);
    for (const f of [-0.8, 0.8]) for (const g of [-0.72, 0.72]) cyl(S.metal, [e + f, 0.36, g - 0.06], [e + f, 0.36, g + 0.06], 0.34, 0.34, 10, '#3a3d42', m);
  }
  // The body: green below, cream above, a red belt line, the roof.
  rbox(S.gloss, -L / 2, L / 2, 0.62, 1.75, -W / 2, W / 2, 0.55, '#2f6b45', m, 3);
  rbox(S.gloss, -L / 2 + 0.05, L / 2 - 0.05, 1.7, 3.05, -W / 2 + 0.03, W / 2 - 0.03, 0.55, '#efe4c6', m, 3);
  box(S.gloss, -L / 2 + 0.4, L / 2 - 0.4, 1.68, 1.8, -W / 2 - 0.01, W / 2 + 0.01, '#c23b2e', m);
  rbox(S.gloss, -L / 2 + 0.6, L / 2 - 0.6, 3.0, 3.25, -W / 2 + 0.15, W / 2 - 0.15, 0.25, '#b8b2a0', m, 2);
  // Windows along both sides, and the ends'.
  for (const e of [-1, 1]) box(S.glass, -L / 2 + 1.1, L / 2 - 1.1, 1.95, 2.7, e * (W / 2) - 0.02, e * (W / 2) + 0.02, '#27405e', m);
  for (const e of [-1, 1]) box(S.glass, e * (L / 2) - 0.04, e * (L / 2) + 0.04, 1.95, 2.65, -0.85, 0.85, '#27405e', m);
  // Headlight and the number board.
  box(S.glow, L / 2 + 0.02, L / 2 + 0.08, 1.2, 1.42, -0.16, 0.16, '#fff3cf', m);
  box(S.paint, L / 2 + 0.01, L / 2 + 0.06, 2.75, 3.0, -0.5, 0.5, '#1f1f22', m);
  // The trolley pole, up from the back of the roof to the wire, and its retriever.
  const base: V3 = [-L / 2 + 2.4, 3.3, 0];
  cyl(S.metal, base, [-L / 2 + 6.2, 5.55, 0], 0.03, 0.04, 5, '#2b2d30', m);
  cyl(S.metal, [-L / 2 - 0.05, 1.4, 0], [-L / 2 - 0.05, 1.9, 0], 0.09, 0.09, 8, '#2b2d30', m);
}

// The Duboce Ave wall: the steep block up to Buena Vista Ave East, as San Francisco does its steepest
// streets. Past Castro the grade is near a quarter, so the sidewalks turn into flights of steps (a
// handrail at the kerb), the cars park nose-in to the kerb across the slope with their wheels turned
// in (a row of them each side, outside the course: the road's edge is at their tails), yellow HILL
// signs warn the trucks at the foot and CURB WHEELS plates line the kerbs. The Victorians climb the
// hill behind the steps (the frontages come back for the houses to fill).
import * as THREE from 'three';
import { pointAt, type CoursePoint } from '../../../track';
import { box, cyl, obox, rbox, strip, type GeoBuilder, type V3 } from '../../geo';
import type { Frontage } from '../../victorian';
import type { Ctx, Hood } from '../context';
import { KERB, pts } from '../streets';
import type { Decals } from './signs';

/** The parking bays' depth (nose-in), and the stepped sidewalk's width beyond them. */
const BAY = 4.8;
const STEPS = 3.0;
/** How long each tread is (m): a rise of about 18 cm at the wall's grade. */
const TREAD = 0.75;
const CARS = ['#c62828', '#1e3a5f', '#f2f2ee', '#9ea3a8', '#2b2d31', '#2e7d4f', '#f0b429', '#546e7a', '#7b3f8c', '#e8e0cf'];

export function buildWall(ctx: Ctx, decals: Decals): Hood {
  const c = ctx.course;
  const S = ctx.sinks;
  const rng = ctx.rng;
  // The steep block: from Castro to Buena Vista Ave East.
  const sCastro = ctx.mark('wall', 'castro');
  const sTop = ctx.mark('wall', 'top');
  const sec = c.sections.find((q) => q.kind === 'wall' && q.s0 >= sCastro - 0.5);
  if (!sec) return {};
  const s0 = sec.s0 + 2;
  const s1 = Math.min(sec.s1, sTop) - 0.3;
  const hw = sec.hw;
  const r = pts(c, s0, s1, 0.5);
  const frontages: Frontage[] = [];

  for (const side of [-1, 1] as const) {
    const dK = side * (hw + BAY);
    const dB = side * (hw + BAY + STEPS);
    // The bays: asphalt level with the road across, sloping with it.
    strip(S.asphalt, r, Math.min(side * (hw - 0.05), dK), Math.max(side * (hw - 0.05), dK), (i) => r[i].y + 0.028, '#ffffff', { uvScale: 6, sides: true, bottom: (i) => r[i].y - 1.2 });
    // Bay lines, a car's width apart.
    for (let s = s0 + 0.4; s < s1 - 0.4; s += 2.7) {
      const q = pts(c, s - 0.06, s + 0.06, 0.12);
      strip(S.marks, q, Math.min(side * (hw + 0.4), dK - side * 0.1), Math.max(side * (hw + 0.4), dK - side * 0.1), (i) => q[i].y + 0.04, '#f4f4ee');
    }
    // The steps: level treads, each a rise above the one below, the kerb face along the bays.
    stepped(ctx, S.concrete, s0, s1, dK, dB);
    // A handrail along the kerb's edge of the steps.
    handrail(ctx, S.metal, s0, s1, side * (hw + BAY + 0.25));
    // Cars nose-in to the kerb, wheels turned in (most bays full).
    for (let s = s0 + 1.75; s < s1 - 1.4; s += 2.7) {
      if (rng() < 0.3) continue;
      const p = pointAt(c, s);
      const d = side * (hw + BAY - 2.35);
      toyCar(S, p, d, side, CARS[Math.floor(rng() * CARS.length)]);
    }
    // CURB WHEELS plates at the kerb, and the lamps.
    for (let s = s0 + 9; s < s1 - 3; s += 22) {
      const p = pointAt(c, s);
      const d = side * (hw + BAY + 0.45);
      const x = p.x - p.tz * d;
      const z = p.z + p.tx * d;
      const y = stepTop(ctx, s, s0);
      cyl(S.metal, [x, y - 0.1, z], [x, y + 2.4, z], 0.035, 0.035, 6, '#8a9097');
      const face: V3 = [-p.tx, 0, -p.tz];
      decals.quad('curb', [x + face[0] * 0.04, y + 2.0, z + face[2] * 0.04], rightOf(face), [0, 1, 0], 0.62, 0.25);
    }
    for (let s = s0 + (side > 0 ? 6 : 19); s < s1 - 3; s += 26) {
      const p = pointAt(c, s);
      const d = side * (hw + BAY + 0.55);
      const x = p.x - p.tz * d;
      const z = p.z + p.tx * d;
      const y = stepTop(ctx, s, s0);
      const ax = p.tz * side;
      const az = -p.tx * side;
      cyl(S.metal, [x, y, z], [x, y + 7.6, z], 0.09, 0.13, 8, '#6b7178');
      cyl(S.metal, [x, y + 7.6, z], [x + ax * 3.4, y + 7.9, z + az * 3.4], 0.05, 0.05, 6, '#6b7178');
      obox(S.metal, [x + ax * 3.7, y + 7.82, z + az * 3.7], [0.9, 0.22, 0.4], [0, -Math.atan2(az, ax), 0], '#8a9097');
      obox(S.glow, [x + ax * 3.7, y + 7.69, z + az * 3.7], [0.7, 0.05, 0.3], [0, -Math.atan2(az, ax), 0], '#fff3cf');
    }
    // The houses' frontage along the top of the steps.
    const pa = pointAt(c, s0 + 0.5);
    const pb = pointAt(c, s1 - 0.5);
    const a = { x: pa.x - pa.tz * dB, z: pa.z + pa.tx * dB };
    const b = { x: pb.x - pb.tz * dB, z: pb.z + pb.tx * dB };
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const ux = (b.x - a.x) / len;
    const uz = (b.z - a.z) / len;
    frontages.push(side > 0 ? { ox: a.x, oz: a.z, ux, uz, len } : { ox: b.x, oz: b.z, ux: -ux, uz: -uz, len });
  }

  // The HILL signs: at the foot, facing the traffic about to climb; at the top, facing the drop.
  for (const [s, d, dir] of [
    [sec.s0 + 1.2, hw + 0.75, 1],
    [s1 - 1, -(hw + BAY + 0.55), -1],
  ] as const) {
    const p = pointAt(c, s);
    const x = p.x - p.tz * d;
    const z = p.z + p.tx * d;
    const y = Math.max(p.y, ctx.ground(x, z)) + KERB;
    cyl(S.metal, [x, y - 0.2, z], [x, y + 3.2, z], 0.04, 0.04, 6, '#8a9097');
    const face: V3 = [-p.tx * dir, 0, -p.tz * dir];
    decals.diamond('hill', [x + face[0] * 0.03, y + 2.75, z + face[2] * 0.03], rightOf(face), [0, 1, 0], 0.95);
    decals.quad('hillPlate', [x + face[0] * 0.03, y + 2.02, z + face[2] * 0.03], rightOf(face), [0, 1, 0], 0.62, 0.22);
    // Their backs: plain galvanised.
    obox(S.metal, [x - face[0] * 0.01, y + 2.75, z - face[2] * 0.01], [0.66, 0.66, 0.02], [0, Math.atan2(face[0], face[2]), Math.PI / 4], '#b5b9bd');
    obox(S.metal, [x - face[0] * 0.01, y + 2.02, z - face[2] * 0.01], [0.62, 0.22, 0.02], [0, Math.atan2(face[0], face[2]), 0], '#b5b9bd');
  }

  // The steep block's sides are the steps', not the plain sidewalk's.
  return {
    noWalk: (s) => s >= s0 - 0.25 && s <= s1 + 0.25,
    frontages,
  };
}

/** The top of the steps' tread at s (they're level, each a rise above the one below). */
function stepTop(ctx: Ctx, s: number, s0: number): number {
  const k = Math.floor((s - s0) / TREAD);
  const ya = pointAt(ctx.course, s0 + k * TREAD).y;
  const yb = pointAt(ctx.course, s0 + (k + 1) * TREAD).y;
  return Math.max(ya, yb) + KERB;
}

/** The right-hand vector of a decal facing `face` (horizontal), upright. */
function rightOf(face: V3): V3 {
  return [face[2], 0, -face[0]];
}

/** The stepped sidewalk from s0 to s1 between offsets dK (the kerb) and dB (the back). */
function stepped(ctx: Ctx, b: GeoBuilder, s0: number, s1: number, dK: number, dB: number): void {
  const c = ctx.course;
  const n = Math.floor((s1 - s0) / TREAD);
  for (let k = 0; k < n; k++) {
    const sa = s0 + k * TREAD;
    const sb = sa + TREAD;
    const pa = pointAt(c, sa);
    const pb = pointAt(c, sb);
    // Level at the height the slope reaches at its upper end.
    const top = Math.max(pa.y, pb.y) + KERB;
    const m = pointAt(c, (sa + sb) / 2);
    const dm = (dK + dB) / 2;
    obox(b, [m.x - m.tz * dm, top - 0.45, m.z + m.tx * dm], [TREAD + 0.02, 0.9, Math.abs(dB - dK)], [0, -m.heading, 0], k % 2 ? '#d9d3c6' : '#d2ccbf');
  }
}

/** A handrail along the steps: posts every 3 m, a rail following the slope. */
function handrail(ctx: Ctx, b: GeoBuilder, s0: number, s1: number, d: number): void {
  const c = ctx.course;
  const n = Math.max(1, Math.round((s1 - s0) / 3));
  let prev: V3 | null = null;
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    const p = pointAt(c, s);
    const x = p.x - p.tz * d;
    const z = p.z + p.tx * d;
    const y = p.y + KERB + 0.18;
    cyl(b, [x, y - 0.3, z], [x, y + 0.9, z], 0.03, 0.03, 5, '#3a4a42');
    const top: V3 = [x, y + 0.9, z];
    if (prev) cyl(b, prev, top, 0.028, 0.028, 5, '#3a4a42');
    prev = top;
  }
}

/**
 * A toy car parked nose-in to the kerb across the slope, `d` out from the course's centreline at p:
 * rounded body, glasshouse, roof, wheels (the front ones turned in to the kerb), tilted with the
 * street. `side` +1 right of the course.
 */
function toyCar(S: Ctx['sinks'], p: CoursePoint, d: number, side: 1 | -1, color: string): void {
  // Forward: towards the kerb (away from the road), level; along: up the street, with its grade.
  const fx = -p.tz * side;
  const fz = p.tx * side;
  const g = Math.atan(p.grade);
  const along = new THREE.Vector3(p.tx * Math.cos(g), Math.sin(g), p.tz * Math.cos(g));
  const fwd = new THREE.Vector3(fx, 0, fz);
  // Local z is the car's right: for a car facing the kerb on the right-hand side, that's back down
  // the street.
  const right = along.clone().multiplyScalar(-side);
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  const m = new THREE.Matrix4().makeBasis(fwd, up, right);
  const x = p.x - p.tz * d;
  const z = p.z + p.tx * d;
  m.setPosition(x, p.y + 0.03, z);
  const L = 2.05;
  const Wd = 0.86;
  rbox(S.gloss, -L, L, 0.28, 0.98, -Wd, Wd, 0.22, color, m, 1);
  box(S.glass, -1.05, 0.85, 0.96, 1.5, -Wd + 0.1, Wd - 0.1, '#ffffff', m);
  box(S.gloss, -1.0, 0.75, 1.46, 1.6, -Wd + 0.08, Wd - 0.08, color, m);
  // Wheels, the fronts turned in towards the kerb.
  for (const [wx, wz] of [
    [1.3, -0.8],
    [1.3, 0.8],
    [-1.3, -0.8],
    [-1.3, 0.8],
  ]) {
    const w = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 6);
    w.rotateX(Math.PI / 2);
    if (wx > 0) w.rotateY(0.35 * side * -1);
    w.translate(wx, 0.34, wz);
    S.metal.add(w, '#1f2124', m);
  }
  // Tail lights.
  box(S.paint, -L - 0.02, -L + 0.05, 0.62, 0.78, -Wd + 0.1, -Wd + 0.35, '#c62828', m);
  box(S.paint, -L - 0.02, -L + 0.05, 0.62, 0.78, Wd - 0.35, Wd - 0.1, '#c62828', m);
}

// Buena Vista Park, the city's oldest (1867): a steep hill of woods (coast live oaks, Monterey
// cypresses and pines, and the blue gums planted all over it in the 1880s) with a clearing on the
// summit and the whole city laid out below it. The course comes in off Buena Vista Ave East between
// stone gateposts, winds up the paths to the summit and drops down the switchbacks, out onto Buena
// Vista Ave West. The WPA walled the paths in the 1930s with low walls of grey rubble stone, and lined
// the gutters beside them with broken marble headstones from the city's emptied cemeteries: most lie
// face down, but here and there one shows its rounded head and a name. The walls stand exactly on the
// course's edges (they're the walls the physics knows, low enough to hop onto the leg below); the
// woods keep clear of them. The whole hill is the park's: no houses on it.
import * as THREE from 'three';
import { gardenWorld, pointAt, type CoursePoint } from '../../track';
import { inPolygon } from '../terrain';
import { box, obox, strip, type V3 } from '../geo';
import { cypressTree, parkBench, pineTree } from '../props';
import { buildGarden } from './buenaVista/garden';
import { bvGardenPlan } from './buenaVista/terraces';
import { eucalyptus, liveOak, montereyPine, shrub } from './buenaVista/trees';
import { along, rectPoly, type Ctx, type Hood } from './context';
import { Near, crossingArms } from './duboce/near';
import { Decals, GUTTER, MARBLE, STONES } from './duboce/signs';
import { WALK, pts } from './streets';

/** Rubble stone, and the lighter stones along the top. */
const STONE = ['#8f8e88', '#9d9b93', '#85847e', '#a7a59d', '#7c7b76', '#96907f', '#a19c90'];
const COPING = ['#aeaca4', '#b8b5ac', '#a4a39c'];
/** The broken headstones and marble offcuts in the gutters. */
const SLABS = ['#eceae4', '#dedcd5', '#d1d1cb', '#e7e3d9', '#c7c8c3', MARBLE];

/** How tall the walls are above the path (m). */
const WALL_H = 0.8;

export function buildBuenaVista(ctx: Ctx): Hood {
  const c = ctx.course;
  const S = ctx.sinks;
  const rng = ctx.rng;
  const sIn = ctx.mark('buenaVista', 'in');
  const sSummit = ctx.mark('buenaVista', 'summit');
  const sOut = ctx.mark('buenaVista', 'out');
  const decals = new Decals(ctx);
  // The roads round about (the top of the wall, the park's paths, Buena Vista Ave West, Haight): a
  // street keeps its sidewalks clear too.
  const near = new Near(c, ctx.mark('wall', 'castro'), ctx.mark('haight', 'masonic') + 30, 1, (kind) => (kind.startsWith('bv') || kind === 'switchbacks' ? 0 : WALK));
  /** Buena Vista's woods (as the ground colours them): nearer its paths than any other road. */
  const inWoods = (x: number, z: number): boolean => {
    const n = near.nearest(x, z, 34);
    if (!n) return false;
    const s = near.pts[n.i].s;
    return s >= sIn - 4 && s <= sOut + 2;
  };

  // --- The park's ground: the woods, and the strip between them and Haight St east of Buena Vista Ave
  // West (the park's north edge). Nothing else builds on the hill.
  const pIn = pointAt(c, sIn);
  const pOut = pointAt(c, sOut);
  const ne0 = pOut.x + pOut.hw + WALK + 0.5;
  const northEdge = rectPoly(ne0, pOut.z - 11, 0, 0, pIn.x - WALK - 0.5 - ne0, 0, 36);
  const inNorthEdge = (x: number, z: number): boolean => inPolygon(northEdge, x, z);
  // (Buena Vista Ave East runs along the park's east side: its arms are the street's.)
  const arms = crossingArms(c, ctx.mark('wall', 'top') - 1, sIn + 1, WALK);
  // The switchbacks' walled garden (the zigzag and the terraces between its legs), all of it; and
  // west of Buena Vista Ave West, from the garden's end to Haight St, Haight's corner buildings
  // (haight.ts), not the woods.
  const plan = bvGardenPlan(c);
  const g = plan.garden;
  const pExit = pointAt(c, sOut + 1);
  const xLots = pExit.x - pExit.hw - WALK + 0.3;
  const zEnd = gardenWorld(g, g.u1, 0).z;
  const inLots = (x: number, z: number): boolean => x < xLots && z < zEnd && z > zEnd - 30;
  const inPark = (x: number, z: number): boolean => (inWoods(x, z) || inNorthEdge(x, z)) && !arms.on(x, z, 1) && !inLots(x, z);
  for (let x = Math.floor(pIn.x) - 150; x < pIn.x + 10; x++) {
    for (let z = Math.floor(pOut.z) - 30; z < pOut.z + 110; z++) {
      if (inPark(x + 0.5, z + 0.5)) ctx.occ.disc(x + 0.5, z + 0.5, 0.5);
    }
  }
  ctx.occ.claim(northEdge);
  ctx.occ.claim(rectPoly(g.ox, g.oz, g.heading, g.u0 - 1, g.u1 + 0.6, -g.wall - 1, g.wall + 1));
  /** The ground a wall stands on: in the garden, its terraces. */
  const groundAt = (x: number, z: number): number => {
    if (!plan.inside(x, z)) return ctx.ground(x, z);
    const o = plan.owner(x, z);
    return plan.bed(o.y, o.e);
  };

  // --- The walls: grey rubble stone on both edges, with gateposts where the course comes in and out --
  const w0 = sIn + 1.0;
  const w1 = sOut - 1.0;
  for (const side of [-1, 1] as const) {
    rubbleWall(ctx, w0, w1, side, groundAt, rng);
    gutter(ctx, decals, sIn + 1.2, sOut - 1.2, side, rng);
  }
  buildGarden(ctx, STONE, COPING, rng);
  gatePosts(ctx, sIn, 1, rng);
  gatePosts(ctx, sOut, -1, rng);
  // The park's carved board just inside the gate (clear of Buena Vista Ave East's sidewalk), facing
  // the traffic coming up the wall.
  const board = along(c, sIn + 4.5, -(pointAt(c, sIn + 4.5).hw + 1.9));
  {
    const p = pointAt(c, sIn + 4.5);
    const d = -(p.hw + 1.9);
    const x = p.x - p.tz * d;
    const z = p.z + p.tx * d;
    const gy = Math.max(ctx.ground(x, z), p.y);
    // Facing back down the road (towards -t); two stout posts.
    const back: V3 = [-p.tx, 0, -p.tz];
    const right: V3 = [-p.tz, 0, p.tx];
    for (const e of [-1.05, 1.05]) box(S.paint, x + right[0] * e - 0.07, x + right[0] * e + 0.07, gy - 0.3, gy + 1.55, z + right[2] * e - 0.07, z + right[2] * e + 0.07, '#4a3322');
    obox(S.paint, [x, gy + 1.12, z], [0.1, 0.62, 2.5], [0, -p.heading, 0], '#4a3322');
    decals.quad('bvPark', [x + back[0] * 0.056, gy + 1.12, z + back[2] * 0.056], right, [0, 1, 0], 2.4, 0.6);
    decals.quad('bvPark', [x - back[0] * 0.056, gy + 1.12, z - back[2] * 0.056], [-right[0], 0, -right[2]], [0, 1, 0], 2.4, 0.6);
  }

  // --- The summit clearing: on the crown beside the path at the top, a round of paving inside a low
  // rubble seat wall, benches looking out over the city -------------------------------------------------
  const top = pointAt(c, sSummit + 5);
  const clearing = (() => {
    // The side of the path away from the switchbacks' legs, where the crown rises.
    let best = { x: top.x, z: top.z, y: -Infinity };
    for (const side of [-1, 1]) {
      const d = side * (top.hw + 8);
      const x = top.x - top.tz * d;
      const z = top.z + top.tx * d;
      if (near.margin(x, z) < 5.5 || plan.inside(x, z, 6)) continue;
      const y = ctx.ground(x, z);
      if (y > best.y) best = { x, z, y };
    }
    return best;
  })();
  if (Number.isFinite(clearing.y)) {
    const { x, z } = clearing;
    const y = clearing.y;
    const R = 4.2;
    const disc = new THREE.CylinderGeometry(R, R + 0.3, 1.4, 16);
    disc.translate(x, y - 0.62, z);
    S.path.add(disc, '#d8cdb6');
    for (let k = 0; k < 14; k++) {
      // The seat wall round it, open towards the path.
      const a = (k / 14) * Math.PI * 2;
      const toPath = Math.atan2(top.z - z, top.x - x);
      let da = a - toPath;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) < 0.5) continue;
      const cx = x + Math.cos(a) * (R + 0.25);
      const cz = z + Math.sin(a) * (R + 0.25);
      obox(S.stone, [cx, y + 0.2, cz], [0.5, 0.75, 1.95], [0, -a, 0], STONE[k % STONE.length]);
    }
    for (const a of [0.9, 2.2, 3.5, 4.8]) {
      const toPath = Math.atan2(top.z - z, top.x - x);
      const aa = toPath + a;
      const bx = x + Math.cos(aa) * (R - 1.1);
      const bz = z + Math.sin(aa) * (R - 1.1);
      parkBench(S.paint, S.metal, bx, y + 0.08, bz, aa);
    }
  }
  // --- The woods: oaks, cypresses, pines and blue gums all over the hill, shrubs beneath -----------------
  const trees = S.foliage;
  /** A shrub as big as the room outside the wall allows (m: how far out of the corridor it is). */
  const bush = (x: number, y: number, z: number, m: number): void => {
    const sz = Math.min(1.5, (m - 0.75) / 1.2) * (0.75 + rng() * 0.25);
    if (sz > 0.55) shrub(trees, x, y, z, sz, rng);
  };
  const box0 = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const q of pts(c, sIn, sOut, 4)) {
    box0.x0 = Math.min(box0.x0, q.x - 36);
    box0.x1 = Math.max(box0.x1, q.x + 36);
    box0.z0 = Math.min(box0.z0, q.z - 36);
    box0.z1 = Math.max(box0.z1, q.z + 36);
  }
  for (let gx = box0.x0; gx < box0.x1; gx += 5) {
    for (let gz = box0.z0; gz < box0.z1; gz += 5) {
      const x = gx + (rng() - 0.5) * 4.2;
      const z = gz + (rng() - 0.5) * 4.2;
      const pick = rng();
      const size = 0.85 + rng() * 0.4;
      if (!inPark(x, z) || plan.inside(x, z, 1.2)) continue;
      const m = near.margin(x, z);
      if (m < 1.2) continue;
      // The summit clearing.
      if (Math.hypot(x - top.x, z - top.z) < 12 || Math.hypot(x - clearing.x, z - clearing.z) < 8) continue;
      if (Math.hypot(x - board.x, z - board.z) < 3) continue;
      const gy = ctx.ground(x, z);
      if (pick < 0.24) {
        // Tall blue gums can lean out over the paths, high above them.
        if (m < 2.2) liveOak(trees, x, gy, z, size * 0.8, rng);
        else eucalyptus(trees, x, gy, z, size, rng);
      } else if (pick < 0.62) {
        if (m < 3.4) bush(x, gy, z, m);
        else liveOak(trees, x, gy, z, size, rng);
      } else if (pick < 0.8) {
        if (m < 3.6) bush(x, gy, z, m);
        else cypressTree(trees, x, gy, z, size * 1.1, rng() * Math.PI * 2, rng);
      } else if (pick < 0.94) {
        if (m < 1.8) bush(x, gy, z, m);
        else montereyPine(trees, x, gy, z, size, rng);
      } else if (m > 2.6) pineTree(trees, x, gy, z, size, rng);
      // The understorey.
      if (rng() < 0.45) {
        const a = rng() * Math.PI * 2;
        const sx = x + Math.cos(a) * 2.4;
        const sz = z + Math.sin(a) * 2.4;
        if (inPark(sx, sz) && !plan.inside(sx, sz, 0.8)) bush(sx, ctx.ground(sx, sz), sz, near.margin(sx, sz));
      }
    }
  }

  decals.finish('buenaVistaSigns');
  const out0 = sOut;
  const out1 = sOut + 11;
  return {
    // Buena Vista Ave West runs through the park to Haight: woods both sides.
    noHouses: (s) => s >= out0 - 0.5 && s <= out1,
  };
}

/**
 * A low wall of grey rubble stone along the course from s0 to s1 on one side (+1 right), its inner
 * face on the corridor's edge: courses of stones (their joints wandering, each stone its own grey), a
 * coping of lighter stones along an uneven top, and its outer face down to the ground.
 */
function rubbleWall(ctx: Ctx, s0: number, s1: number, side: 1 | -1, groundAt: (x: number, z: number) => number, rng: () => number): void {
  const b = ctx.sinks.stone;
  const r = pts(ctx.course, s0, s1, 0.6);
  const n = r.length;
  const top: number[] = [];
  const j1: number[] = [];
  const j2: number[] = [];
  const foot: number[] = [];
  const dIn: number[] = [];
  const dOut: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = r[i];
    dIn.push(side * (p.hw + 0.04));
    dOut.push(side * (p.hw + 0.56));
    top.push(p.y + WALL_H + 0.05 * Math.sin(i * 1.3 + side) + (rng() - 0.5) * 0.07);
    j1.push(0.3 + (rng() - 0.5) * 0.14);
    j2.push(0.6 + (rng() - 0.5) * 0.14);
    const ox = p.x - p.tz * dOut[i];
    const oz = p.z + p.tx * dOut[i];
    foot.push(Math.min(p.y, groundAt(ox, oz)) - 0.4);
  }
  const at = (i: number, d: number, y: number): V3 => [r[i].x - r[i].tz * d, y, r[i].z + r[i].tx * d];
  const up: V3 = [0, 1, 0];
  const pick = (): string => STONE[Math.floor(rng() * STONE.length)];
  for (let i = 0; i < n - 1; i++) {
    const a = r[i];
    const nIn: V3 = [a.tz * side, 0, -a.tx * side];
    const nOut: V3 = [-a.tz * side, 0, a.tx * side];
    // The courses: base to the first joint, to the second, to the top.
    const lv = (k: number, i2: number, foot0: boolean): number => {
      const y0 = foot0 ? foot[i2] : r[i2].y - 0.06;
      const h = top[i2] - r[i2].y;
      if (k === 0) return y0;
      if (k === 1) return r[i2].y + h * j1[i2];
      if (k === 2) return r[i2].y + h * j2[i2];
      return top[i2];
    };
    for (let k = 0; k < 3; k++) {
      b.quad(at(i, dIn[i], lv(k, i, false)), at(i + 1, dIn[i + 1], lv(k, i + 1, false)), at(i + 1, dIn[i + 1], lv(k + 1, i + 1, false)), at(i, dIn[i], lv(k + 1, i, false)), pick(), nIn);
      if (k > 0) b.quad(at(i, dOut[i], lv(k, i, true)), at(i + 1, dOut[i + 1], lv(k, i + 1, true)), at(i + 1, dOut[i + 1], lv(k + 1, i + 1, true)), at(i, dOut[i], lv(k + 1, i, true)), pick(), nOut);
    }
    // The outer face below its first joint: where the wall holds up the path over a drop (between
    // the switchbacks' legs), course after course of stone down to its foot.
    {
      const ya = lv(1, i, true);
      const yb = lv(1, i + 1, true);
      const depth = Math.max(ya - foot[i], yb - foot[i + 1]);
      const n = Math.max(1, Math.round(depth / 0.42 - 0.6));
      for (let k = 0; k < n; k++) {
        const fa = k / n;
        const fb = (k + 1) / n;
        const a0 = ya + (foot[i] - ya) * fa;
        const a1 = ya + (foot[i] - ya) * fb;
        const b0 = yb + (foot[i + 1] - yb) * fa;
        const b1 = yb + (foot[i + 1] - yb) * fb;
        b.quad(at(i, dOut[i], a1), at(i + 1, dOut[i + 1], b1), at(i + 1, dOut[i + 1], b0), at(i, dOut[i], a0), pick(), nOut);
      }
    }
    b.quad(at(i, dIn[i], top[i]), at(i + 1, dIn[i + 1], top[i + 1]), at(i + 1, dOut[i + 1], top[i + 1]), at(i, dOut[i], top[i]), COPING[Math.floor(rng() * COPING.length)], up);
  }
  // The ends.
  for (const [i, dir] of [
    [0, -1],
    [n - 1, 1],
  ] as const) {
    const p = r[i];
    b.quad(at(i, dIn[i], foot[i]), at(i, dOut[i], foot[i]), at(i, dOut[i], top[i]), at(i, dIn[i], top[i]), pick(), [p.tx * dir, 0, p.tz * dir]);
  }
}

/**
 * The gutter along one edge of the path (inside the wall, flush with the path), lined with broken
 * headstones and marble offcuts; about one in eight lies face up, its rounded head and inscription
 * showing.
 */
function gutter(ctx: Ctx, decals: Decals, s0: number, s1: number, side: 1 | -1, rng: () => number): void {
  const c = ctx.course;
  const S = ctx.sinks;
  const r = pts(c, s0, s1, 1);
  const d0 = side * (r[0].hw - 0.7);
  const d1 = side * r[0].hw;
  strip(S.marks, r, Math.min(d0, d1), Math.max(d0, d1), (i) => r[i].y + 0.045, GUTTER);
  /** How far the gutter runs per metre of course (less on the inside of a hairpin). */
  const stretch = (at: number): number => {
    const a = pointAt(c, at);
    const b = pointAt(c, at + 0.5);
    const d = side * (a.hw - 0.36);
    return Math.max(0.2, Math.hypot(b.x - b.tz * d - (a.x - a.tz * d), b.z + b.tx * d - (a.z + a.tx * d)) / 0.5);
  };
  let s = s0 + rng() * 0.3;
  while (s < s1 - 1) {
    const face = rng() < 0.13;
    const wid = face ? 0.42 + rng() * 0.08 : 0.4 + rng() * 0.18;
    const len = face ? wid * (1.8 + rng() * 0.2) : 0.3 + rng() * 0.45;
    const k = stretch(s);
    const pa = pointAt(c, s);
    const pb = pointAt(c, s + len / k);
    const p = pointAt(c, s + len / k / 2);
    const pitch = Math.atan2(pb.y - pa.y, len);
    const dm = side * (p.hw - 0.36 + (rng() - 0.5) * 0.05);
    const x = p.x - p.tz * dm;
    const z = p.z + p.tx * dm;
    const yaw = p.heading + (rng() - 0.5) * (face ? 0.08 : 0.18);
    const yTop = p.y + 0.08 - (face ? 0.01 : 0);
    const col = face ? MARBLE : SLABS[Math.floor(rng() * SLABS.length)];
    // The slab: its top, flush with its neighbours (they're only a few centimetres thick).
    const cp = Math.cos(pitch);
    const along: V3 = [Math.cos(yaw) * cp, Math.sin(pitch), Math.sin(yaw) * cp];
    const across: V3 = [-Math.sin(yaw), 0, Math.cos(yaw)];
    const at = (u: number, v: number): V3 => [x + (along[0] * len * u + across[0] * wid * v) / 2, yTop + (along[1] * len * u) / 2, z + (along[2] * len * u + across[2] * wid * v) / 2];
    S.stone.quad(at(-1, -1), at(1, -1), at(1, 1), at(-1, 1), col, [0, 1, 0]);
    if (face) {
      const flip = rng() < 0.5 ? 1 : -1;
      decals.quad(STONES[Math.floor(rng() * STONES.length)], [x, yTop + 0.01, z], [across[0] * flip, 0, across[2] * flip], [along[0] * flip, along[1] * flip, along[2] * flip], wid, len);
    }
    s += (len + 0.04 + rng() * 0.09) / k;
  }
}

/** A pair of rubble-stone gateposts across the path at s, with wing walls out to the sidewalks; `dir`
 *  +1 where the course comes in (the wall runs on past them), -1 where it goes out. */
function gatePosts(ctx: Ctx, s: number, dir: 1 | -1, rng: () => number): void {
  const b = ctx.sinks.stone;
  const p: CoursePoint = pointAt(ctx.course, s + dir * 0.55);
  const hw = p.hw;
  for (const side of [-1, 1]) {
    // The pier: 1 m square, 2 m tall, a cap on top.
    const dm = side * (hw + 0.55);
    const x = p.x - p.tz * dm;
    const z = p.z + p.tx * dm;
    const y = p.y;
    obox(b, [x, y + 0.8, z], [1.0, 2.4, 1.0], [0, -p.heading, 0], STONE[Math.floor(rng() * STONE.length)]);
    obox(b, [x, y + 2.08, z], [1.2, 0.16, 1.2], [0, -p.heading, 0], COPING[0]);
    obox(b, [x, y + 2.26, z], [0.7, 0.2, 0.7], [0, -p.heading, 0], COPING[1]);
    // The wing wall out to the street's kerb line and beyond.
    const dw = side * (hw + 1.45);
    obox(b, [p.x - p.tz * dw, y + 0.3, p.z + p.tx * dw], [0.9, 1.3, 1.1], [0, -p.heading, 0], STONE[Math.floor(rng() * STONE.length)]);
  }
}

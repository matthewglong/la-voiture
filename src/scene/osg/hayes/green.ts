// Patricia's Green, Octavia Blvd's park from Hayes to Fell, with the course straight down its
// middle: lawn either side of it to Octavia's two side lanes (one each, the stretch north of Linden
// Alley given over to people: raised, paved, bollards across the ends), their sidewalks, and the
// buildings beyond (Proxy's on the east are proxy.ts's; the west side's are Victorians, from
// Hazie's corner down to Fell). On the Green: the round art plaza with "Talking Heads" in it, a
// row of trees and navy acorn lamps down each side, benches facing in, two palms at the Hayes
// end, the park's sign, and the playground at the Fell end. South of Fell, Octavia Boulevard: the
// planted medians under their trees between the through lanes (the course) and the side lanes.
import * as THREE from 'three';
import { pointAt } from '../../../track';
import { cyl, obox, strip } from '../../geo';
import { parkBench } from '../../props';
import type { Frontage } from '../../victorian';
import type { Ctx } from '../context';
import { KERB } from '../streets';
import { signQuad } from './atlas';
import { talkingHeads } from './heads';
import { acornLamp, bollard, streetTree, type Kit } from './kit';

/** Across the Green (m from its middle): the course's walls, the side lanes, the sidewalks' backs. */
export const EDGE = 6.2;
export const LANE0 = 10;
export const LANE1 = 13.5;
export const BACK = 16;
/** Linden Alley's half-width and its sidewalks. */
export const LINDEN_HW = 2.25;
export const LINDEN_WALK = 1.5;

/** The Green's straight frame: v along the course from the Green's start, d to its right (west). */
export interface GreenFrame {
  x0: number;
  z0: number;
  gx: number;
  gz: number;
  /** World point at (v, d). */
  at(v: number, d: number): [number, number];
  /** The course's height abreast of v. */
  roadY(v: number): number;
  /** Where things are along it (v): the back of Hayes' sidewalk, Linden's middle, Fell's sidewalks
   *  and kerbs, the Page crossing and its corner. */
  vWalk: number;
  vLinden: number;
  vFellWalk: number;
  vFell: number;
  vFellS: number;
  vFellSWalk: number;
  /** Where the Page crossing starts (its sidewalks and its corner's take over from there). */
  vPage: number;
  vPageSquares: number;
}

export function greenFrame(ctx: Ctx, pageTurn: { x: number; z: number }, hayesTurn: { x: number; z: number }): GreenFrame {
  const c = ctx.course;
  const sG = ctx.mark('green', 'green');
  const sF = ctx.mark('green', 'fell');
  const p = pointAt(c, sG);
  const fell = c.sections.find((q) => q.kind === 'crossing' && Math.abs(q.s0 - sF) < 1);
  const sFs = fell ? fell.s1 : sF + 12;
  const gx = p.tx;
  const gz = p.tz;
  const vOf = (x: number, z: number): number => (x - p.x) * gx + (z - p.z) * gz;
  const vH = vOf(hayesTurn.x, hayesTurn.z);
  const vFell = sF - sG;
  const vFellS = sFs - sG;
  // Linden Alley: as far down the block from Hayes towards Fell as it really is (46 m of 103).
  const vLinden = vH + ((vFell + vFellS) / 2 - vH) * (46 / 103) + 1.5;
  return {
    x0: p.x,
    z0: p.z,
    gx,
    gz,
    at: (v, d) => [p.x + gx * v - gz * d, p.z + gz * v + gx * d],
    roadY: (v) => pointAt(c, sG + Math.max(0, Math.min(v, vOf(pageTurn.x, pageTurn.z) - 12))).y,
    vWalk: vH + 6.5 + 3.5,
    vLinden,
    vFellWalk: vFell - 3.5,
    vFell,
    vFellS,
    vFellSWalk: vFellS + 3.5,
    vPage: ctx.mark('green', 'page') - sG,
    vPageSquares: vOf(pageTurn.x, pageTurn.z) - 10,
  };
}

/** A strip along the Green's frame from v0 to v1, d0 to d1, `lift` above the higher of the road
 *  and the ground, with kerb faces down into the ground. */
export function gStrip(ctx: Ctx, G: GreenFrame, b: Ctx['sinks']['concrete'], v0: number, v1: number, d0: number, d1: number, lift: number, color: string, uv = 3): void {
  const n = Math.max(1, Math.ceil((v1 - v0) / 2));
  const r: { x: number; z: number; tx: number; tz: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const v = v0 + ((v1 - v0) * i) / n;
    const [x, z] = G.at(v, 0);
    const [xa, za] = G.at(v, d0);
    const [xb, zb] = G.at(v, d1);
    r.push({ x, z, tx: G.gx, tz: G.gz, y: Math.max(G.roadY(v), ctx.ground(xa, za), ctx.ground(xb, zb)) });
  }
  strip(b, r, Math.min(d0, d1), Math.max(d0, d1), (i) => r[i].y + lift, color, { uvScale: uv, sides: true, bottom: (i) => r[i].y - 0.6 });
}

/**
 * A patch of surface over the ground, v0 to v1 by d0 to d1 in 2 m cells that follow it, `lift` above
 * it, with skirts down into it all round (for lots and alleys that climb away from the course);
 * textured in world metres / `uv`.
 */
export function gPatch(ctx: Ctx, G: GreenFrame, b: Ctx['sinks']['concrete'], v0: number, v1: number, d0: number, d1: number, lift: number, color: string, uv = 6): void {
  const nv = Math.max(1, Math.ceil(Math.abs(v1 - v0) / 2));
  const nd = Math.max(1, Math.ceil(Math.abs(d1 - d0) / 2));
  const grid: [number, number, number][][] = [];
  for (let i = 0; i <= nv; i++) {
    const row: [number, number, number][] = [];
    for (let j = 0; j <= nd; j++) {
      const [x, z] = G.at(v0 + ((v1 - v0) * i) / nv, d0 + ((d1 - d0) * j) / nd);
      row.push([x, ctx.ground(x, z) + lift, z]);
    }
    grid.push(row);
  }
  const uvOf = (p: [number, number, number]): [number, number] => [p[0] / uv, p[2] / uv];
  for (let i = 0; i < nv; i++) {
    for (let j = 0; j < nd; j++) {
      const q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
      b.quad(q[0], q[1], q[2], q[3], color, [0, 1, 0], [uvOf(q[0]), uvOf(q[1]), uvOf(q[2]), uvOf(q[3])]);
    }
  }
  // Skirts: round the edge, down into the ground, facing out.
  const [cx, cz] = G.at((v0 + v1) / 2, (d0 + d1) / 2);
  const edge = (a: [number, number, number], c: [number, number, number]): void => {
    const down = (p: [number, number, number]): [number, number, number] => [p[0], p[1] - lift - 0.5, p[2]];
    b.quad(a, c, down(c), down(a), color, [(a[0] + c[0]) / 2 - cx, 0, (a[2] + c[2]) / 2 - cz]);
  };
  for (let i = 0; i < nv; i++) {
    edge(grid[i][0], grid[i + 1][0]);
    edge(grid[i][nd], grid[i + 1][nd]);
  }
  for (let j = 0; j < nd; j++) {
    edge(grid[0][j], grid[0][j + 1]);
    edge(grid[nv][j], grid[nv][j + 1]);
  }
}

/** A palm (a Canary Island date palm, as at the Hayes end): a tall trunk, a crown of drooping fronds. */
function palm(k: Kit, x: number, y: number, z: number, h: number): void {
  const S = k.S;
  cyl(S.foliage, [x, y - 0.2, z], [x, y + h, z], 0.26, 0.36, 7, '#8a7560');
  cyl(S.foliage, [x, y + h - 0.6, z], [x, y + h + 0.1, z], 0.42, 0.3, 7, '#6b7d3c');
  // Fronds: each rises a little from the crown, then arches over and droops.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + k.rng() * 0.25;
    const up = i % 3 === 0 ? 0.5 : 0.15;
    const l1 = 1.3;
    const l2 = 1.5 + k.rng() * 0.4;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const x1 = x + ca * l1 * Math.cos(up);
    const z1 = z + sa * l1 * Math.cos(up);
    const y1 = y + h + 0.1 + l1 * Math.sin(up);
    const col = i % 2 ? '#4f7f3a' : '#5d8f41';
    obox(S.foliage, [(x + x1) / 2, (y + h + 0.1 + y1) / 2, (z + z1) / 2], [l1, 0.06, 0.7], [0, -a, up], col);
    const dr = 0.55 + k.rng() * 0.3;
    obox(S.foliage, [x1 + (ca * l2 * Math.cos(dr)) / 2, y1 - (l2 * Math.sin(dr)) / 2, z1 + (sa * l2 * Math.cos(dr)) / 2], [l2, 0.06, 0.55], [0, -a, -dr], col);
  }
}

/**
 * The Green, its side lanes and sidewalks, and the boulevard beyond Fell. Returns the frontages for
 * the houses along the west side and along the boulevard.
 */
export function buildGreen(k: Kit, G: GreenFrame): Frontage[] {
  const ctx = k.ctx;
  const S = k.S;
  const rng = k.rng;
  const pos = (v: number, d: number): [number, number, number] => {
    const [x, z] = G.at(v, d);
    return [x, Math.max(G.roadY(v), ctx.ground(x, z)), z];
  };
  const south = Math.atan2(G.gz, G.gx);
  const north = south + Math.PI;
  const east = south - Math.PI / 2;
  const west = south + Math.PI / 2;
  const vL0 = G.vLinden - LINDEN_HW;
  const vL1 = G.vLinden + LINDEN_HW;

  // --- The lanes and sidewalks, both sides. North of Linden the lanes are the people's: raised to
  // the sidewalks, paved.
  for (const side of [-1, 1] as const) {
    // (North of the Hayes sidewalk's line: that's the sidewalks' along Hayes.)
    const v0 = G.vWalk;
    gStrip(ctx, G, S.sidewalk, v0, vL0, side * LANE0, side * LANE1, KERB, '#d9d1c1');
    // Yellow tactile strips where the plaza meets a street.
    gStrip(ctx, G, S.marks, v0 + 0.05, v0 + 0.65, side * (LANE0 + 0.3), side * (LANE1 - 0.3), KERB + 0.012, '#e7c24a');
    // South of Linden, a lane of asphalt with a kerb along the Green, to Fell; over Fell's sidewalk
    // a driveway.
    const vs = side > 0 ? vL0 : vL1;
    gStrip(ctx, G, S.asphalt, vs, G.vFellWalk, side * LANE0, side * LANE1, 0.03, '#ffffff', 6);
    gStrip(ctx, G, S.asphalt, G.vFellWalk, G.vFell, side * LANE0, side * LANE1, KERB + 0.012, '#ffffff', 6);
    gStrip(ctx, G, S.concrete, vs, G.vFell, side * (LANE0 - 0.25), side * LANE0, KERB, '#d4cdbf');
    // Sidewalks (the east one broken by Linden).
    if (side > 0) {
      gStrip(ctx, G, S.sidewalk, G.vWalk, G.vFellWalk, LANE1, BACK, KERB, '#d9d3c6');
    } else {
      gStrip(ctx, G, S.sidewalk, G.vWalk, vL0, -BACK, -LANE1, KERB, '#d9d3c6');
      gStrip(ctx, G, S.sidewalk, vL1, G.vFellWalk, -BACK, -LANE1, KERB, '#d9d3c6');
      // Linden where it meets the lane.
      gStrip(ctx, G, S.asphalt, vL0, vL1, -LANE0, -BACK - 0.02, 0.03, '#ffffff', 6);
    }
    // Bollards across the plaza's ends: at Hayes, and where the lane goes on south of Linden.
    for (let d = LANE0 + 0.5; d < LANE1; d += 1.0) {
      const [x, y, z] = pos(v0 + 0.9, side * d);
      bollard(k, x, y + KERB, z);
      const [x2, y2, z2] = pos(vL0 - 0.5, side * d);
      bollard(k, x2, y2 + KERB, z2);
    }
  }
  // The ground they (and the Green's own strips) take.
  for (const side of [-1, 1] as const) {
    const [ax, az] = G.at(G.vWalk, side * EDGE);
    const [bx, bz] = G.at(G.vFell, side * EDGE);
    const [cx, cz] = G.at(G.vFell, side * BACK);
    const [dx, dz] = G.at(G.vWalk, side * BACK);
    ctx.occ.claim([
      [ax, az],
      [bx, bz],
      [cx, cz],
      [dx, dz],
    ]);
  }

  // --- The art plaza on the west side, with the Talking Heads in the middle of it (the lawn round it
  // is the ground's own).
  const plazaV = 12.5;
  const plazaD = 10.4;
  const plazaR = 4.3;
  const inPlaza = (v: number, d: number): boolean => (v - plazaV) ** 2 + (d - plazaD) ** 2 < (plazaR + 0.2) ** 2;
  const play0 = G.vFell - 15;
  const play1 = G.vFell - 1.2;
  {
    // The plaza: a disc of pavers (not into the course's lawn), a darker ring round it.
    const n = 36;
    const [cx, cy, cz] = pos(plazaV, plazaD);
    const ring = (r: number, y: number, color: string, b = S.path): void => {
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        const P = (a: number, rr: number): [number, number, number] => {
          const d = Math.max(EDGE + 0.5, plazaD + Math.sin(a) * rr);
          const [x, z] = G.at(plazaV + Math.cos(a) * rr, d);
          return [x, y, z];
        };
        b.quad(P(a0, r * 0.001), P(a0, r), P(a1, r), P(a1, r * 0.001), color, [0, 1, 0]);
      }
    };
    ring(plazaR, cy + KERB + 0.02, '#cfc4ae');
    ring(plazaR - 0.5, cy + KERB + 0.03, '#e6decd');
    // Its edge, down into the lawn.
    for (let i = 0; i < n; i++) {
      const E = (a: number, yy: number): [number, number, number] => {
        const d = Math.max(EDGE + 0.5, plazaD + Math.sin(a) * plazaR);
        const [x, z] = G.at(plazaV + Math.cos(a) * plazaR, d);
        return [x, yy, z];
      };
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const [ox, oz] = G.at(plazaV + Math.cos(am) * 2, plazaD + Math.sin(am) * 2);
      const [mx, , mz] = E(am, 0);
      S.concrete.quad(E(a0, cy - 0.3), E(a1, cy - 0.3), E(a1, cy + KERB + 0.02), E(a0, cy + KERB + 0.02), '#cfc4ae', [mx - ox, 0, mz - oz]);
    }
    talkingHeads(k, cx, cy + KERB + 0.03, cz, north);
    // Benches round it, facing the sculpture.
    for (const a of [0.35, 1.2, 2.1, -1.35, -2.1]) {
      const [x, y, z] = pos(plazaV + Math.cos(a) * (plazaR - 0.9), plazaD + Math.sin(a) * (plazaR - 0.9));
      if (Math.abs(Math.sin(a) * (plazaR - 0.9) + plazaD) < EDGE + 1) continue;
      parkBench(S.paint, S.metal, x, y + KERB + 0.03, z, Math.atan2(cz - z, cx - x));
    }
    ctx.occ.claim(circlePoly(G, plazaV, plazaD, plazaR));
  }

  // --- The course's walls (the physics has them at ±EDGE): a knee-high granite kerb with a paler
  // coping down both sides of the Green, the course's own lawn inside it, its inner face right on the
  // line, so a car that runs wide hits what it looks like it hits.
  for (const side of [-1, 1] as const) {
    const n = Math.max(1, Math.ceil(G.vFell / 2));
    const r: { x: number; z: number; tx: number; tz: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const v = 0.05 + ((G.vFell - 0.1) * i) / n;
      const [x, z] = G.at(v, 0);
      const [xa, za] = G.at(v, side * EDGE);
      const [xb, zb] = G.at(v, side * (EDGE + 0.5));
      r.push({ x, z, tx: G.gx, tz: G.gz, y: Math.max(G.roadY(v), ctx.ground(xa, za), ctx.ground(xb, zb)) });
    }
    const span = (w: number): [number, number] => [Math.min(side * EDGE, side * (EDGE + w)), Math.max(side * EDGE, side * (EDGE + w))];
    const [a0, a1] = span(0.4);
    strip(S.stone, r, a0, a1, (i) => r[i].y + 0.44, '#a8a398', { sides: true, bottom: (i) => r[i].y - 0.5 });
    const [b0, b1] = span(0.48);
    strip(S.stone, r, b0, b1, (i) => r[i].y + 0.52, '#d2cdc1', { sides: true, bottom: (i) => r[i].y + 0.44 });
  }

  // --- Trees in rows down both sides, two palms at the Hayes end, benches with their backs to the
  // kerb, lamps.
  const greens = ['#4f9a55', '#5aa85c', '#3f8a4c', '#62ad5e'];
  for (const side of [-1, 1] as const) {
    for (let v = G.vWalk + 4; v < G.vFell - 2; v += 7.5) {
      if (side > 0 && (inPlaza(v, 8.4) || Math.abs(v - plazaV) < plazaR + 1.2)) continue;
      if (v > play0 - 1 && v < play1) continue;
      if (side < 0 && v < G.vWalk + 7) continue;
      const [x, y, z] = pos(v, side * 8.5);
      streetTree(k, x, y, z, 1.05 + rng() * 0.15, greens);
    }
    for (let v = G.vWalk + 7.8; v < play0 - 2; v += 7.5) {
      if (side > 0 && Math.abs(v - plazaV) < plazaR + 1.5) continue;
      const [x, y, z] = pos(v, side * 7.4);
      parkBench(S.paint, S.metal, x, y, z, side > 0 ? west : east);
    }
  }
  for (const [v, d, h] of [
    [G.vWalk + 1.6, -8.3, 7.5],
    [G.vWalk + 5.2, -8.6, 8.4],
  ] as const) {
    const [x, y, z] = pos(v, d);
    palm(k, x, y, z, h);
  }
  for (const [v, side] of [
    [G.vWalk + 2.5, 1],
    [G.vWalk + 9, -1],
    [G.vWalk + 24, 1],
    [G.vWalk + 26, -1],
    [G.vWalk + 39, 1],
    [G.vWalk + 43, -1],
  ] as const) {
    const [x, y, z] = pos(v, side * 9.5);
    acornLamp(k, x, y, z);
  }
  // The park's sign at the Hayes end, facing Hayes.
  {
    const [x, y, z] = pos(G.vWalk + 1.2, 8.2);
    const r = k.atlas.get('patriciasGreen');
    cyl(S.metal, [x, y, z], [x, y + 3.3, z], 0.07, 0.09, 8, '#1f4d33');
    const w = 1.45;
    const h = w / r.aspect;
    const ux = -G.gz;
    const uz = G.gx;
    // Facing north (back towards Hayes), and south into the Green.
    const P = (u: number, yy: number, off: number): [number, number, number] => [x + ux * u - G.gx * off, yy, z + uz * u - G.gz * off];
    obox(S.paint, [x, y + 2.55, z], [0.08, h + 0.08, w + 0.08], [0, -Math.atan2(G.gz, G.gx), 0], '#1f4d33');
    // (u is westwards: from the north, the viewer's left is east.)
    signQuad(k.sign, r, P(-w / 2, y + 2.55 - h / 2, 0.05), P(w / 2, y + 2.55 - h / 2, 0.05), P(w / 2, y + 2.55 + h / 2, 0.05), P(-w / 2, y + 2.55 + h / 2, 0.05));
    signQuad(k.sign, r, P(w / 2, y + 2.55 - h / 2, -0.05), P(-w / 2, y + 2.55 - h / 2, -0.05), P(-w / 2, y + 2.55 + h / 2, -0.05), P(w / 2, y + 2.55 + h / 2, -0.05));
  }

  // --- The playground at the Fell end: soft red surfacing either side, a climbing tower with a
  // slide on the west, swings and spring riders on the east, a low fence round each.
  {
    const cols = ['#ff6a3d', '#ffd23f', '#2fb5ff', '#7ad151'];
    for (const side of [-1, 1] as const) {
      gStrip(ctx, G, S.paint, play0, play1, side * (EDGE + 0.6), side * (LANE0 - 0.4), 0.06, '#d9734f', 4);
      // Fence along the outside and the ends.
      for (const [va, da, vb, db] of [
        [play0, EDGE + 0.6, play1, EDGE + 0.6],
        [play0, EDGE + 0.6, play0, LANE0 - 0.4],
        [play1, EDGE + 0.6, play1, LANE0 - 0.4],
      ] as const) {
        const [ax, ay, az] = pos(va, side * da);
        const [bx, , bz] = pos(vb, side * db);
        const len = Math.hypot(bx - ax, bz - az);
        obox(S.paint, [(ax + bx) / 2, ay + 0.85, (az + bz) / 2], [len, 0.06, 0.06], [0, -Math.atan2(bz - az, bx - ax), 0], '#2d5a44');
        for (let t = 0; t <= len; t += 1.2) {
          const px = ax + ((bx - ax) * t) / len;
          const pz = az + ((bz - az) * t) / len;
          cyl(S.paint, [px, ay, pz], [px, ay + 0.9, pz], 0.03, 0.03, 4, '#2d5a44');
        }
      }
    }
    // West: a tower (deck on four posts, a pointed roof) with a slide down towards Fell.
    {
      const vt = play0 + 4.5;
      const dt = 8.1;
      const [x, y, z] = pos(vt, dt);
      for (const [dv, dd] of [
        [-0.8, -0.8],
        [0.8, -0.8],
        [-0.8, 0.8],
        [0.8, 0.8],
      ]) {
        const [px, , pz] = pos(vt + dv, dt + dd);
        cyl(S.metal, [px, y, pz], [px, y + 2.6, pz], 0.06, 0.06, 6, '#d8dde3');
      }
      obox(S.gloss, [x, y + 1.35, z], [1.8, 0.14, 1.8], [0, -south, 0], cols[1]);
      const roof = new THREE.ConeGeometry(1.35, 1.0, 4);
      roof.rotateY(Math.PI / 4 - south);
      roof.translate(x, y + 3.1, z);
      S.gloss.add(roof, cols[0]);
      const [sx, , sz] = pos(vt + 2.6, dt);
      obox(S.gloss, [sx, y + 0.72, sz], [3.2, 0.1, 0.7], [0, -south, -0.46], cols[2]);
      // A climbing net up the other side.
      const [nx, , nz] = pos(vt - 1.6, dt);
      obox(S.metal, [nx, y + 0.7, nz], [1.6, 0.04, 1.4], [0, -south, 0.9], '#3b4a5a');
      // Spring riders.
      for (const [dv, c] of [
        [6.5, cols[3]],
        [9.5, cols[0]],
      ] as const) {
        const [rx, ry, rz] = pos(vt + dv, 8.2);
        cyl(S.metal, [rx, ry, rz], [rx, ry + 0.45, rz], 0.08, 0.08, 6, '#8c939c');
        const body = new THREE.SphereGeometry(0.34, 10, 8);
        body.scale(1.4, 0.8, 0.7);
        body.rotateY(-south);
        body.translate(rx, ry + 0.7, rz);
        S.gloss.add(body, c);
      }
    }
    // East: a swing set.
    {
      const vs = play0 + 6;
      const y = pos(vs, -8.2)[1];
      for (const dv of [-1.6, 1.6]) {
        for (const dd of [-0.7, 0.7]) {
          const [fx, , fz] = pos(vs + dv, -8.2 + dd);
          const [tx, , tz] = pos(vs + dv, -8.2);
          cyl(S.metal, [fx, y, fz], [tx, y + 2.4, tz], 0.05, 0.05, 6, '#2fb5ff');
        }
      }
      const [ax, , az] = pos(vs - 1.6, -8.2);
      const [bx, , bz] = pos(vs + 1.6, -8.2);
      cyl(S.metal, [ax, y + 2.4, az], [bx, y + 2.4, bz], 0.06, 0.06, 6, '#2fb5ff');
      for (const dv of [-0.7, 0.7]) {
        const [sx, , sz] = pos(vs + dv, -8.2);
        for (const e of [-0.2, 0.2]) {
          const [cx, , cz] = pos(vs + dv + e, -8.2);
          cyl(S.metal, [cx, y + 2.4, cz], [cx, y + 0.55, cz], 0.01, 0.01, 3, '#8c939c');
        }
        obox(S.gloss, [sx, y + 0.52, sz], [0.5, 0.05, 0.22], [0, -south, 0], '#ff6a3d');
      }
      // A little climbing dome.
      const [dx, dy, dz] = pos(play0 + 11.2, -8.2);
      const dome = new THREE.SphereGeometry(1.1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      dome.translate(dx, dy + 0.05, dz);
      S.metal.add(dome, '#ffd23f');
    }
  }

  // --- South of Fell: Octavia Boulevard. Planted medians between the through lanes (the course)
  // and the side lanes, trees down them; the side lanes, their sidewalks.
  // (At the Page end the crossing's own sidewalks take the medians' place, then its corner's.)
  const b0 = G.vFellS;
  const b1 = G.vPage;
  const b2 = G.vPageSquares;
  for (const side of [-1, 1] as const) {
    // (The medians' kerbs a little off the corridor's edge: race day's barrier stands on the road there.)
    gStrip(ctx, G, S.concrete, b0 + 0.3, b1 - 0.3, side * 7.05, side * 9.5, KERB, '#d4cdbf');
    gStrip(ctx, G, S.hedge, b0 + 0.6, b1 - 0.6, side * 7.35, side * 9.2, KERB + 0.05, '#6aa84a');
    gStrip(ctx, G, S.asphalt, G.vFellSWalk, b1, side * 9.5, side * 12.5, 0.03, '#ffffff', 6);
    gStrip(ctx, G, S.asphalt, b1, b2, side * 10, side * 12.5, 0.03, '#ffffff', 6);
    gStrip(ctx, G, S.sidewalk, G.vFellSWalk, b2, side * 12.5, side * BACK, KERB, '#d9d3c6');
    for (let v = b0 + 2.5; v < b1 - 1.5; v += 5.5) {
      const [x, y, z] = pos(v, side * 8);
      streetTree(k, x, y + KERB, z, 1.15 + rng() * 0.15, greens);
    }
    const [lx, ly, lz] = pos((b0 + b1) / 2 + side * 2.7, side * 8);
    acornLamp(k, lx, ly + KERB, lz, 5.2);
    const [ax, az] = G.at(b0, side * 6.5);
    const [bx, bz] = G.at(b2, side * 6.5);
    const [cx, cz] = G.at(b2, side * BACK);
    const [dx, dz] = G.at(b0, side * BACK);
    ctx.occ.claim([
      [ax, az],
      [bx, bz],
      [cx, cz],
      [dx, dz],
    ]);
  }

  // --- The houses: down the Green's west side (south of Hazie's), and both sides of the boulevard.
  const front = (v0: number, v1: number, side: 1 | -1): Frontage => {
    // The house stands to the left of its frontage's direction: west of the Green that's walking
    // south (the course's way), east of it walking north.
    const [ax, az] = G.at(side > 0 ? v0 : v1, side * BACK);
    return { ox: ax, oz: az, ux: side > 0 ? G.gx : -G.gx, uz: side > 0 ? G.gz : -G.gz, len: v1 - v0 };
  };
  return [front(G.vWalk + 13.5, G.vFellWalk, 1), front(G.vFellSWalk, b2, 1), front(G.vFellSWalk, b2, -1)];
}

/** A disc as a polygon of world [x, z] (for claiming ground). */
function circlePoly(G: GreenFrame, v: number, d: number, r: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    out.push(G.at(v + Math.cos(a) * r, d + Math.sin(a) * r));
  }
  return out;
}

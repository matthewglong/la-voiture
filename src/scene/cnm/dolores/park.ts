// Dolores Park as surveyed (maps/data/doloresPark.ts) at the course's scale: its footpaths and steps on
// the lawn, its trees and benches (the sim's own lists: DOLORES_THINGS), the tennis and basketball
// courts and the bike polo court by 18th St, the Helen Diller Playground at the top, the restrooms;
// Mexico's Liberty Bell by the gate on Dolores St and Miguel Hidalgo on his plinth; picnics all over the
// hill (blankets, friends, dogs), and at the top's Church St corner, "Gay Beach": rainbow umbrellas and
// flags, sunbathers. Round it, race day's barriers on the lawn's edge with the crowd outside, the
// DOLORES PARK arch over the gate, and palms along its Dolores St side.
import * as THREE from 'three';
import { DOLORES_ARCHES, DOLORES_BEACH, DOLORES_BLOCKS, DOLORES_OPEN, DOLORES_OUTLINE, DOLORES_PICNICS, DOLORES_THINGS, STREET_HW, doloresWorld, onDoloresCourse } from '../../../maps/castroNoeMission';
import { DOLORES_PARK } from '../../../maps/data/doloresPark';
import { inPoly } from '../../../openGround';
import { pointAt } from '../../../track';
import { Crowd, type Spot } from '../../crowd';
import { GeoBuilder, box, cyl, meshOf, obox, rbox, strip, type V3 } from '../../geo';
import { barrierPanel, cypressTree, parkBench, tree } from '../../props';
import { buildGantry } from '../../trackside';
import type { Frontage } from '../../victorian';
import { signBoard } from '../../osg/alamo';
import type { Ctx } from '../../osg/context';
import { kerbside, markThing } from '../../osg/kerbside';
import { PARK_PATH, PAVE_UV } from '../../osg/paving';
import { WALK } from '../../osg/streets';
import type { DoloresPlan } from '../dolores';
import { palm } from './palms';

const RAINBOW = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
const SKIN = ['#f3c9a8', '#e0a987', '#c68a64', '#9a6546', '#6e4630', '#f7d8bf'];
const CLOTHES = ['#ff5a36', '#2e8bff', '#ffd23f', '#3ccf7a', '#b06bff', '#ff7fbf', '#20c5c2', '#ffffff', '#1f2a44', '#ff9d2e'];
const BLANKETS = ['#d94040', '#3e7cc4', '#f2c14e', '#e7e2d3', '#6a9b4a', '#c55fa5', '#ef8a3a'];
const DOGS = ['#c8964f', '#2b2420', '#efe6d4', '#8a5a33', '#d8b07a'];

/** Inside the lawn (as the sim has it). */
const inLawn = (x: number, z: number): boolean => DOLORES_OPEN.contains(x, z);

/** `poly` ∩ the convex `clip` (Sutherland–Hodgman: `poly`, any simple polygon, clipped by each edge of
 *  `clip`). */
function clipConvex(poly: [number, number][], clip: [number, number][]): [number, number][] {
  // The clip polygon's winding, to know which side of each edge is inside.
  let area = 0;
  for (let i = 0; i < clip.length; i++) {
    const [ax, az] = clip[i];
    const [bx, bz] = clip[(i + 1) % clip.length];
    area += ax * bz - bx * az;
  }
  const sign = Math.sign(area) || 1;
  let out = poly;
  for (let i = 0; i < clip.length && out.length; i++) {
    const [ax, az] = clip[i];
    const [bx, bz] = clip[(i + 1) % clip.length];
    const side = (x: number, z: number): number => sign * ((bx - ax) * (z - az) - (bz - az) * (x - ax));
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const sp = side(p[0], p[1]);
      const sq = side(q[0], q[1]);
      if (sp >= 0) out.push(p);
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

/** A ring without its repeated last point. */
const ring = (poly: [number, number][]): [number, number][] => {
  const a = poly[0];
  const b = poly[poly.length - 1];
  return Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01 ? poly.slice(0, -1) : poly;
};

/** A flat slab over a (possibly concave) polygon, top at y, sides down `sink`. */
function slabOver(b: GeoBuilder, poly: [number, number][], y: number, sink: number, color: string): void {
  const shape = poly.map(([x, z]) => new THREE.Vector2(x, z));
  const tris = THREE.ShapeUtils.triangulateShape(shape, []);
  for (const [i, j, k] of tris) b.tri([poly[i][0], y, poly[i][1]], [poly[j][0], y, poly[j][1]], [poly[k][0], y, poly[k][1]], color, [0, 1, 0]);
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[(i + 1) % poly.length];
    b.quad([ax, y, az], [bx, y, bz], [bx, y - sink, bz], [ax, y - sink, az], color);
  }
}

export function buildPark(ctx: Ctx, plan: DoloresPlan): { frontages: Frontage[] } {
  const S = ctx.sinks;
  const rng = ctx.rng;
  const gy = (x: number, z: number): number => ctx.ground(x, z);

  // --- Footpaths and steps on the lawn (not on the course's own path) -----------------------------------
  for (const [list, steps] of [
    [DOLORES_PARK.paths, false],
    [DOLORES_PARK.steps, true],
  ] as const) {
    for (const line of list) {
      const w = line.map(([x, z]) => doloresWorld(x, z));
      let run: { x: number; z: number; tx: number; tz: number; y: number }[] = [];
      const flush = (): void => {
        if (run.length > 1) {
          const r = run;
          strip(S.sidewalk, r, -0.95, 0.95, (i) => r[i].y + 0.05, steps ? '#d3ccbd' : PARK_PATH, { uvScale: PAVE_UV });
          if (steps) for (let i = 1; i < r.length - 1; i += 2) strip(S.marks, [r[i], r[i + 1]], -0.95, 0.95, () => Math.max(r[i].y, r[i + 1].y) + 0.065, '#b9b2a3');
        }
        run = [];
      };
      for (let i = 0; i < w.length; i++) {
        const [px, pz] = w[i];
        const q = w[Math.min(i + 1, w.length - 1)];
        const o = w[Math.max(i - 1, 0)];
        const dx = q[0] - o[0];
        const dz = q[1] - o[1];
        const l = Math.hypot(dx, dz) || 1;
        if (!inLawn(px, pz) || onDoloresCourse(px, pz, -1.6)) {
          flush();
          continue;
        }
        if (run.length) {
          const a = run[run.length - 1];
          const seg = Math.hypot(px - a.x, pz - a.z);
          const m = Math.floor(seg / (steps ? 0.4 : 1.5));
          for (let j = 1; j < m; j++) {
            const f = j / m;
            const x = a.x + (px - a.x) * f;
            const z = a.z + (pz - a.z) * f;
            run.push({ x, z, tx: dx / l, tz: dz / l, y: gy(x, z) });
          }
        }
        run.push({ x: px, z: pz, tx: dx / l, tz: dz / l, y: gy(px, pz) });
      }
      flush();
    }
  }

  // --- Trees and benches, bins and fountains (where the sim has them) ------------------------------------
  for (const [x, z] of DOLORES_THINGS.trees) {
    const r = rng();
    if (r < 0.22) cypressTree(S.foliage, x, gy(x, z), z, 0.85 + rng() * 0.3, rng() * Math.PI * 2, rng);
    else tree(S.foliage, x, gy(x, z) - 0.2, z, 1.25 + rng() * 0.8, rng);
  }
  // The benches face down the hill, towards downtown (the view from the park).
  const view = doloresWorld(880, 40);
  for (const [x, z] of DOLORES_THINGS.benches) parkBench(S.paint, S.metal, x, gy(x, z), z, Math.atan2(view[1] - z, view[0] - x));
  for (const [x, z] of DOLORES_THINGS.bins) cyl(S.paint, [x, gy(x, z), z], [x, gy(x, z) + 0.95, z], 0.3, 0.28, 10, '#2f5d4a');
  for (const [x, z] of DOLORES_THINGS.fountains) {
    cyl(S.stone, [x, gy(x, z), z], [x, gy(x, z) + 0.9, z], 0.22, 0.3, 8, '#bdb5a6');
    cyl(S.metal, [x, gy(x, z) + 0.9, z], [x, gy(x, z) + 0.98, z], 0.3, 0.3, 10, '#8c949c');
  }

  // --- The courts, the restrooms, the playground (what's solid: DOLORES_BLOCKS) ------------------------
  const blocks = DOLORES_BLOCKS.map((b) => ring(b));
  const same = (a: [number, number][], src: [number, number][]): boolean => {
    const w = ring(src).map(([x, z]) => doloresWorld(x, z));
    return w.length === a.length && w.every((p, i) => Math.hypot(p[0] - a[i][0], p[1] - a[i][1]) < 0.01);
  };
  const isA = (b: [number, number][], list: [number, number][][]): boolean => list.some((src) => same(b, src));
  for (const b of blocks) {
    if (isA(b, DOLORES_PARK.tennis)) court(ctx, b, 'tennis');
    else if (isA(b, DOLORES_PARK.basketball)) court(ctx, b, 'basketball');
    else if (isA(b, DOLORES_PARK.playground)) playground(ctx, b);
    else restroom(ctx, b);
  }
  // The bike polo court by the basketball court (flat: the sim drives over it).
  for (const src of DOLORES_PARK.polo) {
    const w = clipConvex(DOLORES_OUTLINE, ring(src).map(([x, z]) => doloresWorld(x, z)));
    if (w.length < 3) continue;
    const y = Math.max(...w.map(([x, z]) => gy(x, z)));
    slabOver(S.asphalt, w, y + 0.04, 0.6, '#c9c9c9');
  }

  // --- Mexico's Liberty Bell, by the gate (on the sidewalk along the park, just past the turn in) -------
  const D = plan.dol;
  {
    const p = D.at(15.5, STREET_HW + WALK - 0.9);
    libertyBell(ctx, p.x, plan.yDol(15.5) + 0.16, p.z, Math.atan2(D.tz, D.tx) - Math.PI / 2);
    markThing(ctx, p.x, p.z, 1.4);
  }
  // Miguel Hidalgo on his plinth, at the park's north edge by 18th St (looking up the hill).
  {
    const sp = statueSpot(ctx);
    if (sp) hidalgo(ctx, sp.x, gy(sp.x, sp.z), sp.z, sp.face);
  }
  // Palms along the park's Dolores St side (behind the sidewalk, outside the lawn's barriers).
  for (let u = plan.uStart + 6; u < plan.uEnd - 4; u += 11 + rng() * 3) {
    if (Math.abs(u - 15.5) < 4 || (u > -4 && u < 10)) continue;
    const p = D.at(u, STREET_HW + WALK + 0.3);
    if (inLawn(p.x, p.z)) continue;
    palm(S.walls, S.foliage, p.x, gy(p.x, p.z), p.z, 7 + rng() * 2.5, 0.3, 13, rng);
    markThing(ctx, p.x, p.z, 0.6);
  }

  // --- Picnics on the hill, and Gay Beach at the top ------------------------------------------------------
  picnics(ctx);
  gayBeach(ctx);

  // --- Race day round the lawn: barriers, the crowd outside, the arch over the gate, the park's sign -------
  parkEdge(ctx, plan);
  for (const a of DOLORES_ARCHES) {
    const g = buildGantry(ctx.course, a.s, `doloresArch${a.text}`, { text: a.text });
    ctx.group.add(g.group);
    ctx.updaters.push((_dt, t) => g.update(t));
  }
  {
    const s = ctx.mark('dolores', 'gate') - 6;
    const p = pointAt(ctx.course, s);
    const d = STREET_HW + WALK - 0.6;
    const x = p.x - p.tz * d;
    const z = p.z + p.tx * d;
    const y = p.y + 0.16;
    const m = new THREE.Matrix4().makeRotationY(-p.heading).setPosition(x, y, z);
    box(S.paint, -1.1, -0.98, 0, 1.0, -0.08, 0.08, '#5b4331', m);
    box(S.paint, 0.98, 1.1, 0, 1.0, -0.08, 0.08, '#5b4331', m);
    box(S.paint, -1.15, 1.15, 0.55, 1.25, -0.06, 0.06, '#3d5e3a', m);
    signBoard(ctx, x, y + 0.9, z, p.heading, 'MISSION DOLORES PARK', '#3d5e3a', 2.2, 0.62);
    markThing(ctx, x, z, 1.2);
  }
  return { frontages: [] };
}

// ---------------------------------------------------------------------------------------------
// Courts, restrooms, the playground

/** A tennis or basketball court: its surface and lines, the net or the hoops, a chain-link fence (only
 *  on the lawn: where the court runs under the street beyond, the lawn's edge is its edge). */
function court(ctx: Ctx, block: [number, number][], kind: 'tennis' | 'basketball'): void {
  const S = ctx.sinks;
  const w = clipConvex(DOLORES_OUTLINE, block);
  if (w.length < 3) return;
  // Level, at the slope's highest corner (a terrace cut into the hill).
  const y = Math.max(...w.map(([x, z]) => ctx.ground(x, z))) + 0.06;
  slabOver(S.paint, w, y, 1.2, kind === 'tennis' ? '#3f7f5f' : '#7b8794');
  // The court's own axes, from the full block's longest side.
  let best = 0;
  let h = 0;
  for (let i = 0; i < block.length; i++) {
    const [ax, az] = block[i];
    const [bx, bz] = block[(i + 1) % block.length];
    const l = Math.hypot(bx - ax, bz - az);
    if (l > best) {
      best = l;
      h = Math.atan2(bz - az, bx - ax);
    }
  }
  const cx = w.reduce((a, q) => a + q[0], 0) / w.length;
  const cz = w.reduce((a, q) => a + q[1], 0) / w.length;
  const span = Math.min(best, 9.6);
  if (kind === 'tennis') {
    obox(S.marks, [cx, y + 0.01, cz], [span * 0.86, 0.01, 3.9], [0, -h, 0], '#f4f4ee');
    obox(S.paint, [cx, y + 0.015, cz], [span * 0.84, 0.01, 3.7], [0, -h, 0], '#4b8f68');
    obox(S.metal, [cx, y + 0.45, cz], [0.05, 0.85, 4.2], [0, -h, 0], '#2b2f33');
  } else {
    obox(S.marks, [cx, y + 0.01, cz], [span * 0.9, 0.01, 4.6], [0, -h, 0], '#f4f4ee');
    obox(S.paint, [cx, y + 0.015, cz], [span * 0.88, 0.01, 4.4], [0, -h, 0], '#c56a3a');
    for (const e of [-1, 1]) {
      const px = cx + Math.cos(h) * e * span * 0.42;
      const pz = cz + Math.sin(h) * e * span * 0.42;
      cyl(S.metal, [px, y, pz], [px, y + 3.0, pz], 0.06, 0.08, 6, '#3b4046');
      obox(S.paint, [px - Math.cos(h) * e * 0.3, y + 3.0, pz - Math.sin(h) * e * 0.3], [0.05, 0.75, 1.1], [0, -h, 0], '#f4f4ee');
    }
  }
  // The fence: on the lawn's side only.
  for (let i = 0; i < w.length; i++) {
    const [ax, az] = w[i];
    const [bx, bz] = w[(i + 1) % w.length];
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    // (An edge along the lawn's own edge is the barriers'.)
    let onEdge = false;
    for (let k = 0; k < DOLORES_OUTLINE.length; k++) {
      const [ox, oz] = DOLORES_OUTLINE[k];
      const [px, pz] = DOLORES_OUTLINE[(k + 1) % DOLORES_OUTLINE.length];
      const ex = px - ox;
      const ez = pz - oz;
      const t = Math.max(0, Math.min(1, ((mx - ox) * ex + (mz - oz) * ez) / (ex * ex + ez * ez || 1)));
      if (Math.hypot(ox + ex * t - mx, oz + ez * t - mz) < 0.3) onEdge = true;
    }
    if (onEdge) continue;
    const len = Math.hypot(bx - ax, bz - az);
    cyl(S.metal, [ax, y, az], [ax, y + 3, az], 0.05, 0.05, 6, '#2b3a33');
    cyl(S.metal, [ax, y + 3, az], [bx, y + 3, bz], 0.03, 0.03, 4, '#2b3a33');
    obox(S.metal, [mx, y + 1.5, mz], [len, 3, 0.03], [0, -Math.atan2(bz - az, bx - ax), 0], '#3c4a42');
  }
}

/** A restroom: a small stucco block under a flat roof. */
function restroom(ctx: Ctx, block: [number, number][]): void {
  const S = ctx.sinks;
  const y = Math.min(...block.map(([x, z]) => ctx.ground(x, z)));
  slabOver(S.walls, block, y + 3.0, 3.4, '#e6dcc6');
  slabOver(S.trim, block, y + 3.3, 0.3, '#8a5a44');
}

/**
 * The Helen Diller Playground at the top of the park: a soft rubber floor inside a low fence, and on
 * it the playground's big things in its bright colours: climbing towers under pointed roofs joined by
 * a bridge, the long slide down the hill, swings, a rope pyramid, a sand pit.
 */
function playground(ctx: Ctx, block: [number, number][]): void {
  const S = ctx.sinks;
  const ys = block.map(([x, z]) => ctx.ground(x, z));
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  // The floor follows the hill in two terraces.
  const cx = block.reduce((a, q) => a + q[0], 0) / block.length;
  const cz = block.reduce((a, q) => a + q[1], 0) / block.length;
  slabOver(S.paint, block, (y0 + y1) / 2 + 0.08, (y1 - y0) / 2 + 0.8, '#d9774f');
  const fy = (y0 + y1) / 2 + 0.08;
  // A low fence round it.
  for (let i = 0; i < block.length; i += 2) {
    const [ax, az] = block[i];
    const [bx, bz] = block[(i + 2) % block.length];
    cyl(S.metal, [ax, fy, az], [ax, fy + 0.9, az], 0.03, 0.03, 4, '#2e4a3e');
    cyl(S.metal, [ax, fy + 0.9, az], [bx, fy + 0.9, bz], 0.025, 0.025, 4, '#2e4a3e');
  }
  // Its long axis.
  let far = 0;
  let ux = 1;
  let uz = 0;
  for (const [x, z] of block) {
    const d = Math.hypot(x - cx, z - cz);
    if (d > far) {
      far = d;
      ux = (x - cx) / d;
      uz = (z - cz) / d;
    }
  }
  const vx = -uz;
  const vz = ux;
  const at = (u: number, v: number): [number, number] => [cx + ux * u + vx * v, cz + uz * u + vz * v];
  const inside = (u: number, v: number): boolean => inPoly(block, ...at(u, v));
  const colours = ['#ff6a3d', '#ffd23f', '#2fb5ff', '#7ad151', '#c86bfa'];
  // Towers: platforms on posts under pointed roofs.
  const towers: [number, number][] = [];
  for (const [u, v] of [
    [-far * 0.45, -2],
    [-far * 0.1, 2],
    [far * 0.3, -1.5],
  ] as [number, number][]) {
    if (!inside(u, v)) continue;
    towers.push([u, v]);
    const [x, z] = at(u, v);
    const col = colours[towers.length % colours.length];
    rbox(S.gloss, x - 1.1, x + 1.1, fy + 1.5, fy + 1.75, z - 1.1, z + 1.1, 0.1, col);
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) cyl(S.metal, [x + dx, fy, z + dz], [x + dx, fy + 3.1, z + dz], 0.06, 0.06, 6, '#e3e7ec');
    const roof = new THREE.ConeGeometry(1.6, 1.3, 4);
    roof.rotateY(Math.PI / 4);
    roof.translate(x, fy + 3.7, z);
    S.gloss.add(roof, colours[(towers.length + 2) % colours.length]);
  }
  // A bridge between the first two towers.
  if (towers.length > 1) {
    const [ax, az] = at(...towers[0]);
    const [bx, bz] = at(...towers[1]);
    const len = Math.hypot(bx - ax, bz - az);
    obox(S.gloss, [(ax + bx) / 2, fy + 1.62, (az + bz) / 2], [len, 0.12, 0.9], [0, -Math.atan2(bz - az, bx - ax), 0], '#2fb5ff');
    for (const e of [-0.45, 0.45]) {
      const ox = -Math.sin(Math.atan2(bz - az, bx - ax)) * e;
      const oz = Math.cos(Math.atan2(bz - az, bx - ax)) * e;
      cyl(S.metal, [ax + ox, fy + 2.4, az + oz], [bx + ox, fy + 2.4, bz + oz], 0.03, 0.03, 4, '#e3e7ec');
    }
  }
  // The long slide: from the last tower down the slope, a chute in yellow.
  if (towers.length) {
    const [tu, tv] = towers[towers.length - 1];
    const [sx, sz] = at(tu, tv);
    // Down the hill (towards the lowest corner of the floor).
    let lo = 0;
    for (let i = 1; i < block.length; i++) if (ys[i] < ys[lo]) lo = i;
    const dx = block[lo][0] - sx;
    const dz = block[lo][1] - sz;
    const l = Math.hypot(dx, dz) || 1;
    const len = Math.min(l - 1, 9);
    const ex = sx + (dx / l) * len;
    const ez = sz + (dz / l) * len;
    const n = 8;
    let prev: V3 = [sx, fy + 1.6, sz];
    for (let k = 1; k <= n; k++) {
      const f = k / n;
      const p: V3 = [sx + (ex - sx) * f, fy + 1.6 * (1 - f) ** 1.6 + 0.25 * f, sz + (ez - sz) * f];
      const h = Math.atan2(p[2] - prev[2], p[0] - prev[0]);
      const run = Math.hypot(p[0] - prev[0], p[2] - prev[2]);
      const pitch = Math.atan2(p[1] - prev[1], run);
      obox(S.gloss, [(p[0] + prev[0]) / 2, (p[1] + prev[1]) / 2, (p[2] + prev[2]) / 2], [Math.hypot(run, p[1] - prev[1]), 0.08, 0.8], [0, -h, pitch], '#ffd23f');
      for (const e of [-0.42, 0.42]) {
        const ox = -Math.sin(h) * e;
        const oz = Math.cos(h) * e;
        obox(S.gloss, [(p[0] + prev[0]) / 2 + ox, (p[1] + prev[1]) / 2 + 0.15, (p[2] + prev[2]) / 2 + oz], [Math.hypot(run, p[1] - prev[1]), 0.3, 0.06], [0, -h, pitch], '#ffb300');
      }
      prev = p;
    }
  }
  // Swings: an A-frame and three seats.
  {
    const [u, v] = [far * 0.62, 1.5];
    if (inside(u, v)) {
      const [x, z] = at(u, v);
      const h = Math.atan2(uz, ux);
      for (const e of [-2.2, 2.2]) {
        const px = x + ux * e;
        const pz = z + uz * e;
        for (const w of [-0.7, 0.7]) cyl(S.metal, [px + vx * w, fy, pz + vz * w], [px, fy + 2.6, pz], 0.05, 0.05, 6, '#d8392f');
      }
      cyl(S.metal, [x - ux * 2.2, fy + 2.6, z - uz * 2.2], [x + ux * 2.2, fy + 2.6, z + uz * 2.2], 0.05, 0.05, 6, '#d8392f');
      for (const e of [-1.2, 0, 1.2]) {
        const px = x + ux * e;
        const pz = z + uz * e;
        for (const w of [-0.22, 0.22]) cyl(S.metal, [px + ux * w, fy + 2.6, pz + uz * w], [px + ux * w, fy + 0.6, pz + uz * w], 0.012, 0.012, 3, '#2b2f33');
        obox(S.paint, [px, fy + 0.58, pz], [0.5, 0.05, 0.22], [0, -h, 0], '#1f2a44');
      }
    }
  }
  // A rope pyramid: a mast and its ropes.
  {
    const [u, v] = [-far * 0.7, 1.2];
    if (inside(u, v)) {
      const [x, z] = at(u, v);
      cyl(S.metal, [x, fy, z], [x, fy + 4.2, z], 0.06, 0.08, 6, '#c8ccd2');
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        cyl(S.metal, [x, fy + 4.1, z], [x + Math.cos(a) * 2.4, fy + 0.05, z + Math.sin(a) * 2.4], 0.025, 0.025, 3, '#d8392f');
      }
    }
  }
  // A sand pit.
  {
    const [x, z] = at(far * 0.05, -far * 0.25);
    if (inPoly(block, x, z)) cyl(S.paint, [x, fy - 0.05, z], [x, fy + 0.06, z], 2.0, 2.0, 14, '#e8d29a');
  }
}

// ---------------------------------------------------------------------------------------------
// The bell and the statue

/** Mexico's Liberty Bell (a copy of the Dolores Hidalgo bell): bronze, hung in a dark iron frame on a
 *  stone plinth, its plaque in front. `face`: the way its front faces. */
function libertyBell(ctx: Ctx, x: number, y: number, z: number, face: number): void {
  const S = ctx.sinks;
  const m = new THREE.Matrix4().makeRotationY(-face).setPosition(x, y, z);
  // The plinth.
  box(S.stone, -0.7, 0.7, -0.4, 0.55, -1.2, 1.2, '#c9c0ad', m);
  // The frame: two posts and a beam.
  for (const e of [-0.95, 0.95]) box(S.metal, -0.12, 0.12, 0.55, 3.3, e - 0.12, e + 0.12, '#2b2a28', m);
  box(S.metal, -0.16, 0.16, 3.15, 3.45, -1.15, 1.15, '#2b2a28', m);
  // The bell: a lathe of bronze, its lip and crown.
  const pts = [
    new THREE.Vector2(0.0, 0),
    new THREE.Vector2(0.52, 0),
    new THREE.Vector2(0.5, 0.12),
    new THREE.Vector2(0.4, 0.3),
    new THREE.Vector2(0.34, 0.7),
    new THREE.Vector2(0.3, 0.95),
    new THREE.Vector2(0.18, 1.08),
    new THREE.Vector2(0.0, 1.1),
  ];
  const bell = new THREE.LatheGeometry(pts, 14);
  bell.translate(0, 1.85, 0);
  S.gloss.add(bell, '#9a6b2f', m);
  cyl(S.gloss, [0, 2.95, 0], [0, 3.18, 0], 0.07, 0.09, 6, '#7d5527', m);
  // The plaque.
  box(S.gloss, 0.7, 0.74, 0.08, 0.42, -0.45, 0.45, '#c9a227', m);
}

/** Where Miguel Hidalgo stands: off the lawn by 18th St, on the park's north edge (the first good spot
 *  along it, clear of the course and the streets' sidewalks), looking up the hill. */
function statueSpot(ctx: Ctx): { x: number; z: number; face: number } | null {
  const O = DOLORES_OUTLINE;
  // The north edge: the outline's closing side (from its last point back to its first).
  const [ax, az] = O[O.length - 1];
  const [bx, bz] = O[0];
  const len = Math.hypot(bx - ax, bz - az);
  const tx = (bx - ax) / len;
  const tz = (bz - az) / len;
  // Outward (away from the lawn).
  let nx = -tz;
  let nz = tx;
  if (inPoly(O, (ax + bx) / 2 + nx, (az + bz) / 2 + nz)) {
    nx = -nx;
    nz = -nz;
  }
  for (const f of [0.55, 0.45, 0.65, 0.35]) {
    const x = ax + tx * len * f + nx * 1.8;
    const z = az + tz * len * f + nz * 1.8;
    if (!onDoloresCourse(x, z, 3) && !inPoly(O, x, z)) {
      ctx.occ.disc(x, z, 1.8);
      return { x, z, face: Math.atan2(-nz, -nx) };
    }
  }
  return null;
}

/** Miguel Hidalgo: a bronze figure in a long coat, one arm raised, on a tall stone plinth. */
function hidalgo(ctx: Ctx, x: number, y: number, z: number, face: number): void {
  const S = ctx.sinks;
  const m = new THREE.Matrix4().makeRotationY(-face).setPosition(x, y, z);
  box(S.stone, -1.0, 1.0, -0.3, 0.35, -1.0, 1.0, '#bdb5a6', m);
  box(S.stone, -0.7, 0.7, 0.35, 2.4, -0.7, 0.7, '#cfc8b8', m);
  box(S.stone, -0.8, 0.8, 2.4, 2.6, -0.8, 0.8, '#bdb5a6', m);
  const B = '#4f5a4b';
  const coat = new THREE.CylinderGeometry(0.28, 0.5, 1.5, 8);
  coat.translate(0, 3.35, 0);
  S.gloss.add(coat, B, m);
  const head = new THREE.SphereGeometry(0.2, 10, 8);
  head.translate(0, 4.32, 0);
  S.gloss.add(head, B, m);
  cyl(S.gloss, [0, 3.95, 0.3], [0.25, 4.75, 0.55], 0.08, 0.09, 6, B, m);
  cyl(S.gloss, [0, 3.95, -0.3], [0.25, 3.3, -0.45], 0.08, 0.09, 6, B, m);
  ctx.occ.disc(x, z, 1.4);
}

// ---------------------------------------------------------------------------------------------
// People in the park

/** A seated figure (legs out, facing `face`) at (x, y, z). */
function sitter(b: GeoBuilder, x: number, y: number, z: number, face: number, shirt: string, skin: string): void {
  const m = new THREE.Matrix4().makeRotationY(-face).setPosition(x, y, z);
  box(b, -0.14, 0.14, 0.05, 0.6, -0.17, 0.17, shirt, m);
  box(b, 0.08, 0.55, 0.02, 0.16, -0.16, 0.16, '#3a4a6a', m);
  const head = new THREE.IcosahedronGeometry(0.13, 0);
  head.translate(0, 0.77, 0);
  b.add(head, skin, m);
  box(b, -0.03, 0.25, 0.38, 0.46, 0.17, 0.25, shirt, m);
}

/** A dog lying down beside a blanket. */
function dog(b: GeoBuilder, x: number, y: number, z: number, face: number, coat: string): void {
  const m = new THREE.Matrix4().makeRotationY(-face).setPosition(x, y, z);
  box(b, -0.35, 0.3, 0.02, 0.28, -0.15, 0.15, coat, m);
  box(b, 0.24, 0.48, 0.12, 0.38, -0.11, 0.11, coat, m);
  box(b, 0.46, 0.58, 0.16, 0.26, -0.06, 0.06, '#2a2420', m);
  box(b, -0.55, -0.35, 0.18, 0.22, -0.03, 0.03, coat, m);
}

/**
 * Picnics all over the lawn, the hill above all: blankets with two or three friends on each, a dog now
 * and then, a cooler, a bottle; where the course's plan puts them (DOLORES_PICNICS: the sim knows them,
 * so a car cutting across the lawn steers round them).
 */
function picnics(ctx: Ctx): void {
  const S = ctx.sinks;
  let seed = 4815;
  const rng = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (const [x, z] of DOLORES_PICNICS) {
    const y = ctx.ground(x, z) + 0.02;
    const face = Math.atan2(-1, 0.5) + (rng() - 0.5) * 1.6;
    const m = new THREE.Matrix4().makeRotationY(-face).setPosition(x, y, z);
    box(S.paint, -0.8, 0.8, 0, 0.03, -0.6, 0.6, BLANKETS[Math.floor(rng() * BLANKETS.length)], m);
    const n = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const a = face + (k - (n - 1) / 2) * 1.1 + Math.PI;
      const px = x + Math.cos(a) * 0.45;
      const pz = z + Math.sin(a) * 0.45;
      sitter(S.paint, px, y + 0.03, pz, a + Math.PI, CLOTHES[Math.floor(rng() * CLOTHES.length)], SKIN[Math.floor(rng() * SKIN.length)]);
    }
    if (rng() < 0.4) {
      const a = face + Math.PI / 2;
      dog(S.paint, x + Math.cos(a) * 1.3, y, z + Math.sin(a) * 1.3, face + rng(), DOGS[Math.floor(rng() * DOGS.length)]);
    }
    if (rng() < 0.6) box(S.paint, -0.2, 0.2, 0.03, 0.32, 0.25, 0.5, rng() < 0.5 ? '#2e8bff' : '#d94040', m);
    if (rng() < 0.5) cyl(S.glass, [x + 0.3, y + 0.03, z - 0.1], [x + 0.3, y + 0.32, z - 0.1], 0.035, 0.04, 6, '#3b6b3a');
  }
}

/** A rainbow umbrella at (x, y, z), its pole and six coloured panels. */
function umbrella(b: GeoBuilder, metal: GeoBuilder, x: number, y: number, z: number, tilt: number): void {
  const top: V3 = [x + Math.sin(tilt) * 0.35, y + 2.1, z];
  cyl(metal, [x, y - 0.2, z], top, 0.025, 0.025, 4, '#e8e8e8');
  const R = 1.25;
  for (let k = 0; k < 6; k++) {
    const a0 = (k / 6) * Math.PI * 2;
    const a1 = ((k + 1) / 6) * Math.PI * 2;
    const p0: V3 = [top[0] + Math.cos(a0) * R, top[1] - 0.45, top[2] + Math.sin(a0) * R];
    const p1: V3 = [top[0] + Math.cos(a1) * R, top[1] - 0.45, top[2] + Math.sin(a1) * R];
    const apex: V3 = [top[0], top[1] + 0.12, top[2]];
    b.tri(apex, p0, p1, RAINBOW[k], [0, 1, 0]);
    b.tri(apex, p0, p1, RAINBOW[k], [0, -1, 0]);
  }
}

/** A rainbow flag on a pole: six stripes (both faces). */
function flag(b: GeoBuilder, metal: GeoBuilder, x: number, y: number, z: number, face: number, h = 4.2): void {
  cyl(metal, [x, y, z], [x, y + h, z], 0.04, 0.05, 6, '#e8e8e8');
  const fx = Math.cos(face);
  const fz = Math.sin(face);
  const W = 1.6;
  const H = 1.0;
  for (let k = 0; k < 6; k++) {
    const y1 = y + h - 0.05 - (k * H) / 6;
    const y0 = y1 - H / 6;
    const a: V3 = [x, y0, z];
    const c: V3 = [x + fx * W, y0 - 0.06, z + fz * W];
    const d: V3 = [x + fx * W, y1 - 0.06, z + fz * W];
    const e: V3 = [x, y1, z];
    b.quad(a, c, d, e, RAINBOW[k], [-fz, 0, fx]);
    b.quad(a, c, d, e, RAINBOW[k], [fz, 0, -fx]);
  }
}

/** "Gay Beach", the top of the park by the corner of Church & 20th: rainbow umbrellas and flags,
 *  sunbathers on their towels, where the course's plan puts them (DOLORES_BEACH: solid). */
function gayBeach(ctx: Ctx): void {
  const S = ctx.sinks;
  let seed = 1969;
  const rng = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  DOLORES_BEACH.forEach((q, i) => {
    const y = ctx.ground(q.x, q.z);
    if (q.kind === 'flag') flag(S.paint, S.metal, q.x, y, q.z, rng() * Math.PI * 2);
    else umbrella(S.paint, S.metal, q.x, y, q.z, (rng() - 0.5) * 0.4);
    // A towel and a sunbather or two beside it.
    const face = rng() * Math.PI * 2;
    const tx = q.x + Math.cos(face) * 1.4;
    const tz = q.z + Math.sin(face) * 1.4;
    const ty = ctx.ground(tx, tz) + 0.02;
    const m = new THREE.Matrix4().makeRotationY(-face).setPosition(tx, ty, tz);
    box(S.paint, -0.95, 0.95, 0, 0.025, -0.4, 0.4, RAINBOW[i % RAINBOW.length], m);
    // Lying down: a long low body.
    box(S.paint, -0.75, 0.55, 0.03, 0.22, -0.17, 0.17, SKIN[Math.floor(rng() * SKIN.length)], m);
    box(S.paint, -0.2, 0.2, 0.05, 0.24, -0.18, 0.18, RAINBOW[(i + 3) % RAINBOW.length], m);
    const head = new THREE.IcosahedronGeometry(0.13, 0);
    head.translate(0.72, 0.15, 0);
    S.paint.add(head, SKIN[Math.floor(rng() * SKIN.length)], m);
  });
}

// ---------------------------------------------------------------------------------------------
// Race day round the lawn

/**
 * The lawn is open ground (the cars can drive anywhere on it), so its edge is the wall: race barriers
 * all round, but for the gates where the course comes in and goes out; the crowd outside on the
 * sidewalks of Dolores, 18th and 20th Sts (not along Church St, where the J Church's right of way is).
 */
function parkEdge(ctx: Ctx, plan: DoloresPlan): void {
  const o = DOLORES_OPEN;
  const rng = ctx.rng;
  const things = kerbside(ctx).things;
  const nearGate = (x: number, z: number): boolean => o.gates.some((g) => Math.hypot(g.x - x, g.z - z) < g.r + 1.2);
  const metal = new GeoBuilder();
  const spots: Spot[] = [];
  const pts = o.outline;
  // The west side (up Church St) is the outline's last run of points: it starts after the top corner.
  const westFrom = pts.length - 9;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % pts.length];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 2.4));
    let ox = -(bz - az) / len;
    let oz = (bx - ax) / len;
    if (o.contains((ax + bx) / 2 + ox, (az + bz) / 2 + oz)) {
      ox = -ox;
      oz = -oz;
    }
    const west = i >= westFrom && i < pts.length - 1;
    for (let k = 0; k < n; k++) {
      const x0 = ax + ((bx - ax) * k) / n;
      const z0 = az + ((bz - az) * k) / n;
      const x1 = ax + ((bx - ax) * (k + 1)) / n;
      const z1 = az + ((bz - az) * (k + 1)) / n;
      if (nearGate(x0, z0) || nearGate(x1, z1)) continue;
      barrierPanel(metal, x0, z0, x1, z1, ctx.ground(x0, z0), ctx.ground(x1, z1));
      if (west || rng() > 0.5) continue;
      const f = rng();
      const out = 1.1 + rng() * 1.3;
      const x = x0 + (x1 - x0) * f + ox * out;
      const z = z0 + (z1 - z0) * f + oz * out;
      // (Not in the road, on the bell's plinth or in the palms; and along the course's own stretch of
      // Dolores St the street's crowd is there already.)
      if (onDoloresCourse(x, z, 0.4)) continue;
      if (things.some((q) => Math.hypot(q.x - x, q.z - z) < q.r + 0.45)) continue;
      if (plan.dol.uOf(x, z) < 12 && Math.abs(plan.dol.vOf(x, z)) < 12) continue;
      spots.push({ x, y: ctx.ground(x, z), z, face: Math.atan2(-oz, -ox) + (rng() - 0.5) * 0.8 });
    }
  }
  ctx.group.add(meshOf(metal, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.32 }), 'doloresBarriers', true, true));
  if (spots.length) {
    const crowd = new Crowd(spots, rng);
    ctx.group.add(crowd.group);
    ctx.updaters.push((dt, t, cars) => crowd.update(dt, t, cars));
  }
}

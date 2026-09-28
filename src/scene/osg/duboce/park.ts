// Duboce Park: a long lawn sloping up from Steiner to the foot of Buena Vista Heights, the dogs' park
// of the city (the whole lawn is off-leash, and there's a fenced play area besides). The course winds
// up its path, but the lawn is open ground (a car can cut across it, round the trees: the course's
// open ground has the same plan, maps/dubocePark.ts); round it, the lawn's trees, benches and park
// lamps, the dog play area, the playground, and at the far end the Harvey Milk Center for the Arts;
// the N Judah's rails leave the lawn by a gate (duboce/nJudah.ts lays them). The park's ground is
// claimed: no houses on it.
import * as THREE from 'three';
import { pointAt } from '../../../track';
import { box, cyl, obox, rbox, strip, type GeoBuilder } from '../../geo';
import { cypressTree, parkBench, parkLamp, tree } from '../../props';
import { inPolygon } from '../../terrain';
import type { Ctx, Hood } from '../context';
import { WALK, pts } from '../streets';
import { crossingArms, type Near } from './near';
import { dubocePlan, type ParkLot } from '../../../maps/dubocePark';
import type { Decals } from './signs';

const PLAY = ['#ff6a3d', '#ffd23f', '#2fb5ff', '#7ad151'];
const RAINBOW = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];

export function buildDubocePark(ctx: Ctx, decals: Decals, near: Near, railsNear: (x: number, z: number) => number): Hood {
  const c = ctx.course;
  const S = ctx.sinks;
  const rng = ctx.rng;
  const sPark = ctx.mark('duboce', 'park');
  const sEnd = ctx.mark('duboce', 'parkEnd');
  const pe = pointAt(c, sEnd);
  // The park as the ground colours it: nearer its path than any other road, within 22 m.
  const inLawn = (x: number, z: number): boolean => {
    const n = near.nearest(x, z, 22);
    if (!n) return false;
    const s = near.pts[n.i].s;
    return s >= sPark - 2 && s <= sEnd + 2;
  };
  // Where everything stands (shared with the course's open ground).
  const plan = dubocePlan(c, ctx.mark);
  const { milk, play, dogs, doors, join, outline } = plan;
  const lots = [milk, play, dogs];
  const onLot = (x: number, z: number, pad: number): boolean => lots.some((l) => x > l.x0 - pad && x < l.x1 + pad && z > l.z0 - pad && z < l.z1 + pad);
  const onLawn = (x: number, z: number): boolean => inPolygon(outline, x, z);
  const arms = crossingArms(c, ctx.mark('duboce', 'steiner') - 1, sEnd + 1, WALK);

  // --- The park's ground --------------------------------------------------------------------------------
  {
    const b0 = pts(c, sPark, sEnd, 3);
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const p of b0) {
      x0 = Math.min(x0, p.x - 28);
      x1 = Math.max(x1, p.x + 28);
      z0 = Math.min(z0, p.z - 28);
      z1 = Math.max(z1, p.z + 28);
    }
    for (let x = Math.floor(x0); x < x1; x++) {
      for (let z = Math.floor(z0); z < z1; z++) {
        const cx = x + 0.5;
        const cz = z + 0.5;
        if ((inLawn(cx, cz) || onLawn(cx, cz) || onLot(cx, cz, 1)) && !arms.on(cx, cz, 0.5)) ctx.occ.disc(cx, cz, 0.5);
      }
    }
  }

  // --- The gate where the N Judah's rails leave the lawn for their own right of way: two brick piers
  // and a closed iron gate across the rails, on the lawn's edge.
  {
    let gate: { x: number; z: number; h: number } | null = null;
    for (let a = 0, b = outline.length - 1; a < outline.length && !gate; b = a++) {
      const [px, pz] = outline[b];
      const [qx, qz] = outline[a];
      for (let t = 0; t <= 1; t += 0.01) {
        const x = px + (qx - px) * t;
        const z = pz + (qz - pz) * t;
        if (railsNear(x, z) < 0.3 && near.margin(x, z) > 0.5) {
          gate = { x, z, h: Math.atan2(qz - pz, qx - px) };
          break;
        }
      }
    }
    if (gate) {
      const g = gate;
      const y = ctx.ground(g.x, g.z);
      const tx = Math.cos(g.h);
      const tz = Math.sin(g.h);
      for (const e of [-1.9, 1.9]) {
        const px = g.x + tx * e;
        const pz = g.z + tz * e;
        box(S.walls, px - 0.3, px + 0.3, y - 0.2, y + 1.05, pz - 0.3, pz + 0.3, '#9c4a3a');
        box(S.walls, px - 0.36, px + 0.36, y + 1.05, y + 1.15, pz - 0.36, pz + 0.36, '#d8d0c0');
      }
      for (let k = -8; k <= 8; k++) {
        const e = (k / 8) * 1.55;
        cyl(S.metal, [g.x + tx * e, y, g.z + tz * e], [g.x + tx * e, y + 0.92, g.z + tz * e], 0.018, 0.018, 4, '#23332b');
      }
      for (const hh of [0.15, 0.85]) cyl(S.metal, [g.x - tx * 1.6, y + hh, g.z - tz * 1.6], [g.x + tx * 1.6, y + hh, g.z + tz * 1.6], 0.03, 0.03, 4, '#23332b');
    }
  }

  // --- Lamps and benches along the path ----------------------------------------------------------------
  for (const q of plan.lamps) parkLamp(S.metal, S.glow, q.x, ctx.ground(q.x, q.z), q.z);
  for (const q of plan.benches) parkBench(S.paint, S.metal, q.x, ctx.ground(q.x, q.z), q.z, q.face);

  // --- Trees: the lawn's own (the course's open ground knows them), and more beyond its edge, round the
  // tracks and along Hermann St ---------------------------------------------------------------------------
  {
    const b = S.foliage;
    for (const t of plan.trees) {
      const gy = ctx.ground(t.x, t.z);
      if (t.kind === 'cypress') cypressTree(b, t.x, gy, t.z, t.size, Math.PI + (rng() - 0.5) * 0.8, rng);
      else tree(b, t.x, gy - 0.2, t.z, t.size, rng);
    }
    for (let gx = pe.x - 8; gx < pointAt(c, sPark).x + 14; gx += 6) {
      for (let gz = plan.outline[0][1] - 8; gz < pe.z + 18; gz += 6) {
        const x = gx + (rng() - 0.5) * 4;
        const z = gz + (rng() - 0.5) * 4;
        const pick = rng();
        const size = 1.35 + rng() * 0.6;
        if (!inLawn(x, z) || onLawn(x, z) || pick > 0.55) continue;
        if (near.margin(x, z) < 3 || railsNear(x, z) < 3.4 || onLot(x, z, 2.5) || arms.on(x, z, 2.5)) continue;
        tree(b, x, ctx.ground(x, z) - 0.2, z, size, rng);
      }
    }
  }

  // --- The dog play area: decomposed granite inside a fence, a fountain, some logs to jump -----------------
  {
    const l = dogs;
    const y = pad(ctx, S.concrete, l, '#cdb994');
    const fence: { x: number; y: number; z: number }[] = [
      { x: l.x0, y, z: l.z0 },
      { x: l.x1, y, z: l.z0 },
      { x: l.x1, y, z: l.z1 },
      { x: l.x0 + 2.2, y, z: l.z1 },
    ];
    parkFence(S.metal, fence, 1.2);
    parkFence(S.metal, [
      { x: l.x0, y, z: l.z1 - 0.01 },
      { x: l.x0, y, z: l.z0 },
    ], 1.2);
    // The fountain (a bowl at the foot for the dogs), a bench, logs.
    const fx = l.x1 - 2;
    const fz = l.z0 + 2;
    cyl(S.stone, [fx, y, fz], [fx, y + 0.95, fz], 0.22, 0.3, 8, '#9aa0a6');
    cyl(S.metal, [fx + 0.5, y, fz], [fx + 0.5, y + 0.12, fz], 0.3, 0.3, 10, '#8c949c');
    parkBench(S.paint, S.metal, l.x0 + 3, y, l.z0 + 1.2, Math.PI / 2);
    for (let k = 0; k < 3; k++) {
      const lx = l.x0 + 5 + k * 4.5;
      const lz = l.z0 + 4 + rng() * 3;
      const g = new THREE.CylinderGeometry(0.28, 0.3, 2.4, 7);
      g.rotateZ(Math.PI / 2);
      g.rotateY(rng() * Math.PI);
      g.translate(lx, y + 0.28, lz);
      S.paint.add(g, '#8a6a4a');
    }
    // A hydrant for luck.
    cyl(S.gloss, [l.x1 - 5, y, l.z1 - 2], [l.x1 - 5, y + 0.7, l.z1 - 2], 0.16, 0.18, 8, '#d32f2f');
  }

  // --- The playground: a soft surface, a climbing frame with slides, swings -------------------------------
  {
    const l = play;
    const y = pad(ctx, S.paint, l, '#e7875a');
    parkFence(S.metal, [
      { x: l.x0, y, z: l.z0 },
      { x: l.x1, y, z: l.z0 },
      { x: l.x1, y, z: l.z1 },
      { x: l.x0, y, z: l.z1 },
      { x: l.x0, y, z: l.z0 + 2 },
    ], 0.9);
    const cx = (l.x0 + l.x1) / 2;
    const cz = (l.z0 + l.z1) / 2;
    // The climbing frame: two towers joined by a bridge, a slide off each.
    for (const [dx, k] of [
      [-2.2, 0],
      [2.2, 1],
    ] as const) {
      const x = cx + dx;
      rbox(S.gloss, x - 0.9, x + 0.9, y + 1.3, y + 1.55, cz - 0.9, cz + 0.9, 0.08, PLAY[k]);
      for (const [px, pz] of [
        [-0.8, -0.8],
        [0.8, -0.8],
        [-0.8, 0.8],
        [0.8, 0.8],
      ]) cyl(S.metal, [x + px, y, cz + pz], [x + px, y + 2.5, cz + pz], 0.06, 0.06, 6, '#d8dde3');
      const roof = new THREE.ConeGeometry(1.35, 1.0, 4);
      roof.rotateY(Math.PI / 4);
      roof.translate(x, y + 3.0, cz);
      S.gloss.add(roof, PLAY[k + 2]);
      obox(S.gloss, [x + dx * 0.55, y + 0.72, cz + 1.9 * (k ? 1 : -1)], [0.7, 0.07, 2.6], [(k ? -1 : 1) * 0.55, 0, 0], PLAY[(k + 1) % 4]);
    }
    obox(S.paint, [cx, y + 1.45, cz], [2.6, 0.12, 1.1], [0, 0, 0], '#b07a4a');
    // Swings.
    const sx = l.x1 - 2.4;
    for (const dz of [-1.6, 1.6]) {
      cyl(S.metal, [sx - 0.9, y, cz + dz], [sx, y + 2.4, cz + dz], 0.05, 0.05, 6, '#3d6b8f');
      cyl(S.metal, [sx + 0.9, y, cz + dz], [sx, y + 2.4, cz + dz], 0.05, 0.05, 6, '#3d6b8f');
    }
    cyl(S.metal, [sx, y + 2.4, cz - 1.6], [sx, y + 2.4, cz + 1.6], 0.06, 0.06, 6, '#3d6b8f');
    for (const dz of [-0.7, 0.7]) {
      for (const e of [-0.22, 0.22]) cyl(S.metal, [sx, y + 2.4, cz + dz + e], [sx, y + 0.55, cz + dz + e], 0.012, 0.012, 3, '#555a60');
      box(S.paint, sx - 0.2, sx + 0.2, y + 0.5, y + 0.56, cz + dz - 0.26, cz + dz + 0.26, '#2b2b2b');
    }
  }

  // --- The Harvey Milk Center for the Arts: low and white, glass to the park, a rainbow along its top ------
  {
    const l = milk;
    const S2 = S;
    const g0 = Math.min(ctx.ground(l.x0, l.z1), ctx.ground(l.x1, l.z1), ctx.ground(l.x0, l.z0), ctx.ground(l.x1, l.z0));
    const g1 = Math.max(ctx.ground(l.x0, l.z1), ctx.ground(l.x1, l.z1), ctx.ground(l.x0, l.z0), ctx.ground(l.x1, l.z0));
    const y = (g0 + g1) / 2 + 0.2;
    box(S2.concrete, l.x0 - 0.3, l.x1 + 0.3, g0 - 0.5, y, l.z0 - 0.3, l.z1 + 0.3, '#cfc8ba');
    // Two storeys: the long block, and a taller hall at its west end.
    rbox(S2.walls, l.x0, l.x1, y, y + 7.2, l.z0, l.z1, 0.15, '#f2eee6');
    rbox(S2.walls, l.x0, l.x0 + 6.5, y, y + 9.2, l.z0 + 1, l.z1 - 1, 0.15, '#e9e3d8');
    // The glass front (south, onto the park): bays of it between white piers, a floor apart; the east
    // end glazed the same.
    const zf = l.z1 + 0.02;
    for (let x = l.x0 + 7.4; x + 2.2 <= l.x1 - 0.6; x += 2.6) {
      for (const [y0, y1] of [
        [0.5, 3.0],
        [3.7, 6.3],
      ]) box(S2.glass, x, x + 2.2, y + y0, y + y1, zf - 0.1, zf + 0.04, '#ffffff');
      box(S2.trim, x + 1.04, x + 1.16, y + 0.5, y + 6.3, zf, zf + 0.08, '#3a3f45');
    }
    for (let z = l.z0 + 1.6; z + 2.2 <= l.z1 - 1.2; z += 2.6) {
      for (const [y0, y1] of [
        [0.5, 3.0],
        [3.7, 6.3],
      ]) box(S2.glass, l.x1 - 0.04, l.x1 + 0.1, y + y0, y + y1, z, z + 2.2, '#ffffff');
    }
    // A canopy over the doors, the rainbow band along the parapet.
    box(S2.trim, l.x0 + 8, l.x0 + 13, y + 2.8, y + 3.0, zf, zf + 1.6, '#3a3f45');
    RAINBOW.forEach((col, i) => {
      const y0 = y + 6.6 + i * 0.1;
      box(S2.paint, l.x0 + 6.6, l.x1 + 0.03, y0, y0 + 0.1, l.z1 - 0.1, l.z1 + 0.04, col);
      box(S2.paint, l.x1 - 0.1, l.x1 + 0.04, y0, y0 + 0.1, l.z0, l.z1 + 0.03, col);
    });
    decals.quad('milk', [l.x0 + 3.25, y + 7.6, l.z1 - 0.95], [1, 0, 0], [0, 1, 0], 6.2, 0.78);
    // The rainbow flag on its pole by the doors.
    const fx = l.x1 + 1.2;
    const fz = l.z1 + 1.5;
    cyl(S2.metal, [fx, g1 - 1, fz], [fx, y + 9, fz], 0.05, 0.08, 8, '#e8e8e4');
    RAINBOW.forEach((col, i) => box(S2.paint, fx + 0.05, fx + 1.9, y + 8.6 - i * 0.18, y + 8.78 - i * 0.18, fz - 0.02, fz + 0.02, col));
    // A path from the doors down to the park's.
    const r: { x: number; z: number; tx: number; tz: number; y: number }[] = [];
    const { x: ax, z: az } = doors;
    const { x: bx, z: bz } = join;
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.ceil(len / 1.5));
    for (let i = 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n;
      const z = az + ((bz - az) * i) / n;
      r.push({ x, z, tx: (bx - ax) / len, tz: (bz - az) / len, y: ctx.ground(x, z) });
    }
    strip(S2.path, r, -1.1, 1.1, (i) => r[i].y + 0.05, '#dcd7cc', { uvScale: 4 });
  }

  // The park's board by the way in, facing the traffic coming along Duboce.
  {
    const p = pointAt(c, sPark - 3);
    const d = p.hw + 2.6;
    const x = p.x - p.tz * d;
    const z = p.z + p.tx * d;
    if (near.margin(x, z) > 0.2) {
      const gy = ctx.ground(x, z);
      const back: [number, number, number] = [-p.tx, 0, -p.tz];
      const right: [number, number, number] = [-p.tz, 0, p.tx];
      for (const e of [-1.05, 1.05]) box(S.paint, x + right[0] * e - 0.07, x + right[0] * e + 0.07, gy - 0.3, gy + 1.55, z + right[2] * e - 0.07, z + right[2] * e + 0.07, '#4a3322');
      obox(S.paint, [x, gy + 1.12, z], [0.1, 0.62, 2.5], [0, -p.heading, 0], '#4a3322');
      decals.quad('dubocePark', [x + back[0] * 0.056, gy + 1.12, z + back[2] * 0.056], right, [0, 1, 0], 2.4, 0.6);
    }
  }

  return {};
}

/** A level pad over a lot on the sloping lawn, cut in on its uphill side: returns its top. */
function pad(ctx: Ctx, b: GeoBuilder, l: ParkLot, color: string): number {
  const ys = [ctx.ground(l.x0, l.z0), ctx.ground(l.x1, l.z0), ctx.ground(l.x0, l.z1), ctx.ground(l.x1, l.z1)];
  const y = (Math.min(...ys) + Math.max(...ys)) / 2 + 0.06;
  box(b, l.x0, l.x1, Math.min(...ys) - 0.4, y, l.z0, l.z1, color);
  return y;
}

/** A park fence along a polyline: posts every 2 m, top and bottom rails, pickets between. */
function parkFence(b: GeoBuilder, line: { x: number; y: number; z: number }[], h: number): void {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const e = line[i + 1];
    const len = Math.hypot(e.x - a.x, e.z - a.z);
    const n = Math.max(1, Math.round(len / 2));
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      cyl(b, [a.x + (e.x - a.x) * f, a.y, a.z + (e.z - a.z) * f], [a.x + (e.x - a.x) * f, a.y + h + 0.05, a.z + (e.z - a.z) * f], 0.04, 0.04, 5, '#23332b');
    }
    for (const hh of [0.12, h]) cyl(b, [a.x, a.y + hh, a.z], [e.x, e.y + hh, e.z], 0.025, 0.025, 4, '#23332b');
    const m = Math.max(1, Math.round(len / 0.5));
    for (let k = 1; k < m; k++) {
      const f = k / m;
      cyl(b, [a.x + (e.x - a.x) * f, a.y + 0.12, a.z + (e.z - a.z) * f], [a.x + (e.x - a.x) * f, a.y + h, a.z + (e.z - a.z) * f], 0.012, 0.012, 3, '#23332b');
    }
  }
}


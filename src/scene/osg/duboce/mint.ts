// The United States Mint (1937) at 155 Hermann St: "the Fortress", a massive grey Art Deco block of
// concrete on a granite base, few windows and those narrow, high on its outcrop of rock above
// Buchanan and Duboce. Here it stands on the ground's rock (the mound index.ts raises west of
// Buchanan): a granite plinth on the crags, the central pavilion facing the course on Buchanan with
// its slit windows between fluted piers and the flag above, lower wings either side, and granite
// retaining walls at the back of the sidewalks along Buchanan and Duboce, the rock rising behind them.
import * as THREE from 'three';
import { box, cyl, type GeoBuilder, type V3 } from '../../geo';
import { pointAt } from '../../../track';
import type { Ctx, Hood } from '../context';
import { walkStrip } from '../paving';
import { KERB, WALK, pts } from '../streets';
import type { Decals } from './signs';

const CONCRETE = '#b1ada4';
const CAP = '#c2beb5';
const GRANITE = '#80837f';
const GRANITE_DARK = '#6c6f6b';
const ROCK = ['#6f6a63', '#7d766c', '#5f5b55', '#8a8278', '#7a6558', '#696259'];

/**
 * A crag: an angular block of the outcrop's chert, (rx, ry, rz) across, at (x, y, z), its long face
 * turned to `yaw` (random if left out). Few facets, knocked about, so a stack of them reads as a rock
 * face rather than a heap of boulders.
 */
export function crag(b: GeoBuilder, x: number, y: number, z: number, rx: number, ry: number, rz: number, rng: () => number, yaw = rng() * Math.PI * 2): void {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const p = g.getAttribute('position');
  const moved = new Map<string, [number, number, number]>();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let v = moved.get(k);
    if (!v) {
      const f = 0.72 + rng() * 0.4;
      // Flatten the top and bottom a little: bedding planes.
      v = [p.getX(i) * f, p.getY(i) * f * (Math.abs(p.getY(i)) > 0.5 ? 0.8 : 1), p.getZ(i) * f];
      moved.set(k, v);
    }
    p.setXYZ(i, v[0], v[1], v[2]);
  }
  g.computeVertexNormals();
  g.scale(rx, ry, rz);
  g.rotateZ((rng() - 0.5) * 0.35);
  g.rotateY(yaw);
  g.translate(x, y, z);
  b.add(g, ROCK[Math.floor(rng() * ROCK.length)]);
}

/** The Mint, its rock and its walls. Returns the sides of the course it takes (no houses there). */
export function buildMint(ctx: Ctx, decals: Decals): Hood {
  const S = ctx.sinks;
  const rng = ctx.rng;
  const sM0 = ctx.mark('mint', 'mint');
  const sM1 = ctx.mark('mint', 'duboce');
  const sRails = ctx.mark('duboce', 'rails');
  const sChurch = ctx.mark('duboce', 'church');
  // The block: Buchanan's west sidewalk, Haight's (the crossing's) south sidewalk, Duboce's north
  // sidewalk, and Church St (which doesn't carry on north of Duboce).
  const m0 = along(ctx, sM0, 0);
  const rails = along(ctx, sRails, 0);
  const hw = m0.hw;
  const xE = m0.x - (hw + WALK);
  const zN = m0.z + WALK;
  const zS = rails.z - (hw + WALK);
  const xW = along(ctx, sChurch + 12, 0).x + 0.5;
  ctx.occ.claim([
    [xW, zN],
    [xE, zN],
    [xE, zS],
    [xW, zS],
  ]);
  // The rock's top (where index.ts raises it) and the plinth the building stands on.
  const mk = along(ctx, sM0 + 16, 26);
  const mx = mk.x;
  const mz = mk.z;
  const y0 = ctx.ground(mx, mz) + 0.8;
  const P = { x0: mx - 15, x1: mx + 12.5, z0: mz - 11, z1: mz + 11.5 };

  // --- The plinth: granite, rusticated, down into the rock ----------------------------------------------
  {
    const base = Math.min(ctx.ground(P.x0, P.z1), ctx.ground(P.x1, P.z1), ctx.ground(P.x0, P.z0)) - 1;
    box(S.stone, P.x0, P.x1, base, y0, P.z0, P.z1, GRANITE);
    // Rustication: a darker band every 1.1 m up the exposed faces.
    for (let y = y0 - 1.1; y > base + 0.5; y -= 1.1) {
      box(S.stone, P.x0 - 0.06, P.x1 + 0.06, y - 0.06, y, P.z0 - 0.06, P.z1 + 0.06, GRANITE_DARK);
    }
    // The terrace on top, and its parapet.
    box(S.concrete, P.x0 + 0.1, P.x1 - 0.1, y0, y0 + 0.08, P.z0 + 0.1, P.z1 - 0.1, '#bfbab0');
    parapet(S.concrete, P.x0, P.x1, P.z0, P.z1, y0);
  }

  // --- The rock: a craggy face from the walls at the sidewalks (or the ground) up to the plinth on
  // every side, a few crags breaking out of it ------------------------------------------------------------
  {
    const rock = S.stone;
    /** A face along one edge of the plinth (a to b), its foot `out` metres further out (the height
     *  there from `footY`), its head tucked under the terrace. */
    const edge = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number, out: number, footY: (x: number, z: number) => number): void => {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(2, Math.round(len / 1.3));
      const foot: V3[] = [];
      const head: V3[] = [];
      for (let i = 0; i <= n; i++) {
        const x = ax + ((bx - ax) * i) / n;
        const z = az + ((bz - az) * i) / n;
        foot.push([x + nx * out, footY(x + nx * out, z + nz * out) - 0.15, z + nz * out]);
        head.push([x + nx * 0.15, y0 - 0.25, z + nz * 0.15]);
      }
      rockFace(rock, foot, head, nx, nz, rng);
      // A few crags standing proud of it.
      for (let i = 1; i < n; i += 3 + Math.floor(rng() * 3)) {
        const t = 0.25 + rng() * 0.45;
        const f = foot[i];
        const h = head[i];
        crag(rock, f[0] + (h[0] - f[0]) * t + nx * 0.5, f[1] + (h[1] - f[1]) * t, f[2] + (h[2] - f[2]) * t + nz * 0.5, 1.2 + rng() * 0.8, 1.1 + rng() * 0.8, 0.8 + rng() * 0.4, rng, Math.atan2(-nx, nz));
      }
    };
    // Buchanan's side, down to the top of its retaining wall; Duboce's likewise; the other two, to
    // the ground.
    const byZ = (z: number): number => along(ctx, sM0 + (z - m0.z), hw + WALK).y + KERB + 2.25;
    edge(P.x1, P.z0 - 1, P.x1, P.z1 + 1, 1, 0, xE - P.x1 - 1.0, (_x, z) => byZ(z));
    edge(P.x0 - 1, P.z1, P.x1 + 1, P.z1, 0, 1, zS - P.z1 - 1.0, () => rails.y + KERB + 2.65);
    edge(P.x0, P.z0 - 1, P.x0, P.z1 + 1, -1, 0, 2.6, (x, z) => ctx.ground(x, z) - 0.2);
    edge(P.x0 - 1, P.z0, P.x1 + 1, P.z0, 0, -1, Math.max(0.5, P.z0 - zN - 0.5), (x, z) => ctx.ground(x, z) - 0.2);
    // The corner over Buchanan & Duboce, where the two faces meet: the crags pile up.
    for (let k = 0; k < 4; k++) {
      const t = (k + 0.5) / 4;
      crag(rock, P.x1 + 1.2 + rng(), rails.y + 3 + (y0 - rails.y - 3.5) * t, P.z1 + 1.4 + rng(), 1.8, 1.5 + rng(), 1.6, rng);
    }
  }

  // --- Retaining walls at the back of the sidewalks: granite panels stepping down Buchanan ---------------
  {
    const b = S.stone;
    // Along Buchanan (the course's right, heading south), in 4 m panels, each with a level top.
    const n = Math.max(1, Math.round((sM1 - sM0 + 1) / 4));
    for (let i = 0; i < n; i++) {
      const sa = sM0 - 0.5 + ((sM1 - sM0 + 1) * i) / n;
      const sb = sM0 - 0.5 + ((sM1 - sM0 + 1) * (i + 1)) / n;
      const a = along(ctx, sa, hw + WALK);
      const e = along(ctx, sb, hw + WALK);
      const lo = Math.min(a.y, e.y) + KERB - 0.4;
      const hi = Math.max(a.y, e.y) + KERB + 2.1;
      box(b, xE - 0.9, xE, lo, hi, Math.min(a.z, e.z), Math.max(a.z, e.z), GRANITE);
      box(b, xE - 1.0, xE + 0.1, hi, hi + 0.18, Math.min(a.z, e.z), Math.max(a.z, e.z), CAP);
    }
    // Along Duboce (the course's right, heading west): level, and on round the Church St corner.
    const y = rails.y + KERB;
    box(b, xW, xE, y - 0.4, y + 2.5, zS - 0.9, zS, GRANITE);
    box(b, xW, xE + 0.1, y + 2.5, y + 2.68, zS - 1.0, zS + 0.1, CAP);
    // (Church St doesn't carry on north: the sidewalk does, across its mouth, along the wall, paved
    // like the rest.)
    const mouth = ctx.course.sections.find((q) => q.s0 <= sChurch + 0.5 && q.s1 >= sChurch + 0.5);
    if (mouth) walkStrip(S.sidewalk, pts(ctx.course, mouth.s0, mouth.s1, 0.5), hw, hw + WALK, () => y, () => y - 0.8);
  }

  // --- The building: a granite base, the pavilion facing Buchanan, wings and a rear block ---------------
  {
    const W = S.concrete;
    const G = S.stone;
    const mass = (x0: number, x1: number, z0: number, z1: number, h: number): void => {
      box(W, x0, x1, y0, y0 + h, z0, z1, CONCRETE);
      // Granite base course, and the cap along the top.
      box(G, x0 - 0.12, x1 + 0.12, y0, y0 + 2.4, z0 - 0.12, z1 + 0.12, GRANITE);
      box(W, x0 - 0.2, x1 + 0.2, y0 + h - 0.1, y0 + h + 0.45, z0 - 0.2, z1 + 0.2, CAP);
      box(W, x0 + 0.3, x1 - 0.3, y0 + h + 0.45, y0 + h + 0.75, z0 + 0.3, z1 - 0.3, CAP);
    };
    // Wings: a long block along Buchanan, the rear block behind.
    const wx0 = mx - 12;
    const wx1 = mx + 9;
    const wz0 = mz - 8.5;
    const wz1 = mz + 9;
    mass(wx0, wx1, wz0, wz1, 10.5);
    mass(mx - 14.2, mx - 9, mz - 6, mz + 6.5, 13);
    // The pavilion: forward of the wings, tall, stepping back at the top.
    const px0 = mx - 5;
    const px1 = mx + 11;
    const pz0 = mz - 5.5;
    const pz1 = mz + 5.5;
    mass(px0, px1, pz0, pz1, 17);
    box(W, px0 + 1.2, px1 - 1.4, y0 + 17.7, y0 + 20.6, pz0 + 1, pz1 - 1, CONCRETE);
    box(W, px0 + 1, px1 - 1.2, y0 + 20.6, y0 + 21, pz0 + 0.8, pz1 - 0.8, CAP);
    box(W, mx - 2, mx + 4, y0 + 21, y0 + 22.6, mz - 2.2, mz + 2.2, CONCRETE);
    // Fluted piers up the pavilion's front, the slit windows between them, bronze doors below.
    const nP = 6;
    for (let i = 0; i < nP; i++) {
      const z = pz0 + 1.2 + ((pz1 - pz0 - 2.4) * i) / (nP - 1);
      box(W, px1, px1 + 0.35, y0 + 2.4, y0 + 17.2, z - 0.28, z + 0.28, CAP);
      if (i < nP - 1) {
        const zm = z + (pz1 - pz0 - 2.4) / (nP - 1) / 2;
        box(S.glass, px1 - 0.05, px1 + 0.06, y0 + 4.2, y0 + 15.2, zm - 0.42, zm + 0.42, '#ffffff');
        // Spandrels across the slits, a floor apart.
        for (let f = 1; f < 4; f++) box(W, px1, px1 + 0.12, y0 + 4.2 + f * 2.75 - 0.2, y0 + 4.2 + f * 2.75 + 0.2, zm - 0.45, zm + 0.45, CAP);
      }
    }
    box(S.metal, px1 - 0.05, px1 + 0.1, y0, y0 + 3.2, mz - 1.3, mz + 1.3, '#6a5234');
    box(W, px1, px1 + 1.4, y0 + 3.4, y0 + 3.7, mz - 2.2, mz + 2.2, CAP);
    decals.quad('mint', [px1 + 0.37, y0 + 16.2, mz], [0, 0, -1], [0, 1, 0], 9, 1.1);
    // Few windows in the wings: a row of small ones high up, slits below.
    const winRow = (x0: number, x1: number, z: number, nz: number): void => {
      for (let x = x0 + 1.5; x < x1 - 1; x += 2.6) {
        box(S.glass, x - 0.45, x + 0.45, y0 + 7.6, y0 + 8.7, z - 0.06 * nz, z + 0.06 * nz, '#ffffff');
        box(S.glass, x - 0.18, x + 0.18, y0 + 3.4, y0 + 5.8, z - 0.06 * nz, z + 0.06 * nz, '#ffffff');
      }
    };
    winRow(wx0, wx1, wz1, 1);
    winRow(wx0, wx1, wz0, -1);
    for (const [za, zb] of [
      [wz0, pz0],
      [pz1, wz1],
    ]) {
      for (let z = za + 1.2; z < zb - 0.6; z += 2.4) {
        box(S.glass, wx1 - 0.06, wx1 + 0.06, y0 + 7.6, y0 + 8.7, z - 0.45, z + 0.45, '#ffffff');
      }
    }
    // Corner piers on the wings.
    for (const [x, z] of [
      [wx1, wz0],
      [wx1, wz1],
      [wx0, wz1],
      [wx0, wz0],
    ]) box(G, x - 0.5, x + 0.5, y0, y0 + 10.6, z - 0.5, z + 0.5, GRANITE);
    // The flag on its pole in front of the pavilion.
    const fx = P.x1 - 1.6;
    const fz = mz;
    cyl(S.metal, [fx, y0, fz], [fx, y0 + 13, fz], 0.06, 0.1, 8, '#e8e8e4');
    cyl(S.metal, [fx, y0, fz], [fx, y0 + 0.5, fz], 0.25, 0.3, 8, '#9a9c9e');
    const ball = new THREE.SphereGeometry(0.14, 8, 6);
    ball.translate(fx, y0 + 13.1, fz);
    S.metal.add(ball, '#d8b045');
    const flag: V3 = [fx, y0 + 12.1, fz - 1.02];
    decals.quad('flag', flag, [0, 0, -1], [0, 1, 0], 1.9, 1.0);
    decals.quad('flag', [flag[0] - 0.01, flag[1], flag[2]], [0, 0, 1], [0, 1, 0], 1.9, 1.0, '#ffffff', true);
  }

  // No houses on the Mint's sides of Buchanan and Duboce.
  const sR1 = sChurch;
  return {
    noHouses: (s, side) => side > 0 && ((s >= sM0 - 0.5 && s <= sM1 + 0.5) || (s >= sRails - 0.5 && s <= sR1 + 0.5)),
  };
}

/**
 * A face of rock between a foot line and a head line (in step): rows of facets, bulging out between
 * them and knocked about, each its own shade of the chert. (nx, nz): outwards.
 */
function rockFace(b: GeoBuilder, foot: V3[], head: V3[], nx: number, nz: number, rng: () => number): void {
  const rows = 4;
  const grid: V3[][] = foot.map((f, i) => {
    const h = head[i];
    const end = i === 0 || i === foot.length - 1;
    const col: V3[] = [];
    for (let k = 0; k <= rows; k++) {
      const t = k / rows;
      const mid = k > 0 && k < rows;
      const bulge = mid ? (0.25 + rng() * 0.9) * Math.sin(t * Math.PI) : 0;
      const j = end ? 0 : 0.45;
      col.push([
        f[0] + (h[0] - f[0]) * t + nx * bulge + (rng() - 0.5) * j,
        f[1] + (h[1] - f[1]) * t + (mid ? (rng() - 0.5) * 0.7 : 0),
        f[2] + (h[2] - f[2]) * t + nz * bulge + (rng() - 0.5) * j,
      ]);
    }
    return col;
  });
  const out: V3 = [nx, 0.4, nz];
  for (let i = 0; i < grid.length - 1; i++) {
    for (let k = 0; k < rows; k++) {
      const a = grid[i][k];
      const c = grid[i + 1][k];
      const d = grid[i + 1][k + 1];
      const e = grid[i][k + 1];
      b.tri(a, c, d, ROCK[Math.floor(rng() * ROCK.length)], out);
      b.tri(a, d, e, ROCK[Math.floor(rng() * ROCK.length)], out);
    }
  }
}

/** A course point `d` metres to its right, with its half-width. */
function along(ctx: Ctx, s: number, d: number): { x: number; y: number; z: number; hw: number } {
  const p = pointAt(ctx.course, s);
  return { x: p.x - p.tz * d, y: p.y, z: p.z + p.tx * d, hw: p.hw };
}

/** A parapet round the terrace's edge, 1.1 m tall. */
function parapet(b: GeoBuilder, x0: number, x1: number, z0: number, z1: number, y: number): void {
  box(b, x0, x1, y, y + 1.1, z0, z0 + 0.4, CAP);
  box(b, x0, x1, y, y + 1.1, z1 - 0.4, z1, CAP);
  box(b, x0, x0 + 0.4, y, y + 1.1, z0, z1, CAP);
  box(b, x1 - 0.4, x1, y, y + 1.1, z0, z1, CAP);
}


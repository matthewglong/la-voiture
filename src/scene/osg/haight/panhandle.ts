// The Panhandle: Golden Gate Park's long thin arm along the north side of Oak (the course's left
// all down the Oak straight), running on west past the end of Ashbury. Rows of tall old blue-gum
// eucalyptus and dark Monterey cypress, the paved multi-use path winding down its middle (a dashed
// line down it for the bikes), a walk along the Oak side with paths across between them, benches
// facing the path, park lamps, bins and a drinking fountain, and the McKinley monument at its east
// end. Fell St runs along its far side with plain blocks facing the park. Nothing stands nearer the
// course than the back of Oak's sidewalk.
import * as THREE from 'three';
import { pointAt, type Course, type LaidChunk } from '../../../track';
import { box, cyl, strip, type GeoBuilder } from '../../geo';
import { cypressTree, parkBench, parkLamp } from '../../props';
import { rowBlocks } from '../../victorian';
import type { Ctx } from '../context';
import { WALK, sideStreet, turnOf } from '../streets';

/** How deep the park is beyond Oak's sidewalk (m). */
const DEPTH = 34;
/** Fell St along the far side. */
const FELL_HW = 5.5;

/** A blue-gum eucalyptus: a tall pale trunk leaning a little, forking high up into limbs hung with
 *  clumps of grey-green leaves. */
export function eucalyptus(b: GeoBuilder, x: number, y: number, z: number, s: number, rng: () => number): void {
  const lean = rng() * Math.PI * 2;
  const lx = Math.cos(lean) * 0.8 * s;
  const lz = Math.sin(lean) * 0.8 * s;
  const H = (14 + rng() * 6) * s;
  const fork: [number, number, number] = [x + lx, y + H * 0.6, z + lz];
  cyl(b, [x, y - 0.3, z], fork, 0.24 * s, 0.46 * s, 7, rng() < 0.5 ? '#cfc3aa' : '#bfb49c');
  const greens = ['#6f9a7a', '#7fa889', '#5f8a6d', '#88ad8c', '#6b9270'];
  const limbs = 3;
  for (let i = 0; i < limbs; i++) {
    const a = lean + (i / limbs) * Math.PI * 2 + rng() * 0.8;
    const r = (2.4 + rng() * 1.6) * s;
    const end: [number, number, number] = [fork[0] + Math.cos(a) * r, fork[1] + H * (0.2 + rng() * 0.14), fork[2] + Math.sin(a) * r];
    cyl(b, fork, end, 0.1 * s, 0.17 * s, 5, '#c4b89e');
    // A clump of leaves hanging from the limb's end.
    const g = new THREE.IcosahedronGeometry(1, 0);
    const cr = (2.3 + rng() * 0.9) * s;
    g.scale(cr * 1.25, cr * (1.1 + rng() * 0.3), cr * 1.1);
    g.rotateY(rng() * Math.PI);
    g.translate(end[0] + (rng() - 0.5) * 1.2 * s, end[1] - 0.5 * s, end[2] + (rng() - 0.5) * 1.2 * s);
    b.add(g, greens[Math.floor(rng() * greens.length)]);
  }
  // The crown's top.
  const g = new THREE.IcosahedronGeometry(1, 0);
  const cr = (2.3 + rng()) * s;
  g.scale(cr, cr * 1.2, cr);
  g.translate(fork[0] + lx * 0.4, y + H * 0.95, fork[2] + lz * 0.4);
  b.add(g, greens[Math.floor(rng() * greens.length)]);
}

/** A path following the ground: a polyline of (x, z), `hw` either side. */
function groundPath(ctx: Ctx, line: [number, number][], hw: number, color: string): { x: number; z: number; tx: number; tz: number; y: number }[] {
  const r = line.map(([x, z], i) => {
    const a = line[Math.max(0, i - 1)];
    const c = line[Math.min(line.length - 1, i + 1)];
    const l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    return { x, z, tx: (c[0] - a[0]) / l, tz: (c[1] - a[1]) / l, y: ctx.ground(x, z) };
  });
  strip(ctx.sinks.path, r, -hw, hw, (i) => r[i].y + 0.05, color, { uvScale: 5, sides: true, bottom: (i) => r[i].y - 0.3 });
  return r;
}

export interface Panhandle {
  /** The course's side given over to the park (no row of houses). */
  noHouses(s: number, side: 1 | -1): boolean;
}

/**
 * The Panhandle's lawn in the world, as buildPanhandle lays the park out and parks() paints it: x
 * from its west end (past the end of Ashbury, about 40 m back from Oak's start) east to short of
 * Fell St's arm off Scott; z from the back of Oak's north sidewalk (zNear) out to Fell (zFar, the
 * smaller). Oak runs east along it. Null if the course has no corner onto Oak.
 */
export function panhandleBounds(c: Course, chunk: (id: string) => LaidChunk): { xWest: number; xEast: number; zNear: number; zFar: number } | null {
  const oak = chunk('oak');
  // The corner of Ashbury & Oak (where the course turns onto Oak).
  const corner = c.sections.find((q) => q.kind === 'corner' && Math.abs(q.s1 - oak.s0) < 1.5);
  if (!corner) return null;
  const t = turnOf(c, corner);
  const edge = c.sections[pointAt(c, oak.s0 + 1).sec].hw + WALK;
  // East: short of Scott, and of the end of Fell St's arm off it (it runs off the course's left for
  // 34 m past the kerb).
  let xEast = pointAt(c, oak.s1 - 18).x;
  const fellAt = chunk('scott').marks.fell;
  const fell = fellAt === undefined ? undefined : c.sections.find((q) => q.kind === 'crossing' && Math.abs(q.s0 - fellAt) < 1);
  if (fell) {
    const m = pointAt(c, (fell.s0 + fell.s1) / 2);
    xEast = Math.min(xEast, m.x + m.tz * (m.hw + 34) - 1.5);
  }
  const xWest = Math.min(t.x - edge - 12, pointAt(c, oak.s0).x - 39);
  return { xWest, xEast, zNear: t.z - edge, zFar: t.z - edge - DEPTH };
}

export function buildPanhandle(ctx: Ctx): Panhandle {
  const c = ctx.course;
  const S = ctx.sinks;
  const rng = ctx.rng;
  const oak = ctx.chunk('oak');
  // Ashbury doesn't go on across the park: its ground is claimed here, so the corner onto Oak grows
  // no arm north.
  const bounds = panhandleBounds(c, ctx.chunk);
  if (!bounds) return { noHouses: () => false };
  const { xWest, xEast, zNear, zFar } = bounds;
  const pieces: [number, number][] = [[xWest, xEast]];
  ctx.occ.claim([
    [xWest, zNear - 0.5],
    [xEast, zNear - 0.5],
    [xEast, zFar],
    [xWest, zFar],
  ]);
  const inPark = (x: number, z: number, pad = 0): boolean => z < zNear - 1.5 - pad && z > zFar + 1 + pad && x > xWest + 1 + pad && x < xEast - 1 - pad;

  // --- Fell St along the far side, plain blocks beyond it facing the park -------------------------
  const fellZ = zFar - WALK - FELL_HW;
  sideStreet(ctx, xWest - 6, fellZ, xEast - 4, fellZ, FELL_HW, { houses: [false, false] });
  {
    const x0 = xWest - 4;
    const x1 = xEast - 6;
    const fz = fellZ - FELL_HW - WALK;
    // Along Fell heading west, so the blocks stand to its right (north).
    rowBlocks(S.facades, S.walls, { ox: x1, oz: fz, ux: -1, uz: 0, len: x1 - x0 }, 12, rng, ctx.site, [9, 15]);
    ctx.occ.claim([
      [x0, fz],
      [x1, fz],
      [x1, fz - 12],
      [x0, fz - 12],
    ]);
  }

  // --- The paths ------------------------------------------------------------------------------
  // The multi-use path, winding down the middle; the walk along the Oak side; paths between.
  const mid = (zNear + zFar) / 2;
  const main: [number, number][] = [];
  const pathZ = (x: number): number => mid - 2 + 3 * Math.sin(x / 21 + 0.7);
  for (let x = xWest - 2; x <= xEast + 2; x += 1.5) main.push([x, pathZ(x)]);
  const r = groundPath(ctx, main, 1.7, '#d8d1c2');
  // Its dashed centre line.
  for (let i = 0; i + 1 < r.length; i += 2) strip(S.marks, r.slice(i, i + 2), -0.06, 0.06, (j) => r[i + j].y + 0.065, '#f5c431');
  const walkZ = zNear - 5.5;
  for (const [x0, x1] of pieces) {
    const line: [number, number][] = [];
    for (let x = x0 + 0.5; x <= x1 - 0.5; x += 2) line.push([x, walkZ + 0.6 * Math.sin(x / 9)]);
    groundPath(ctx, line, 1.1, '#ddd6c8');
  }
  // Paths across, from the walk to the multi-use path, every so often.
  const cross: number[] = [];
  for (const [x0, x1] of pieces) for (let x = x0 + 14; x < x1 - 8; x += 26) cross.push(x);
  for (const x of cross) {
    const line: [number, number][] = [];
    for (let z = walkZ; z >= pathZ(x) + 1; z -= 1.5) line.push([x + (walkZ - z) * 0.35, z]);
    if (line.length > 1) groundPath(ctx, line, 1.0, '#ddd6c8');
  }
  const nearPath = (x: number, z: number, pad: number): boolean => {
    if (Math.abs(z - pathZ(x)) < 1.7 + pad) return true;
    if (Math.abs(z - walkZ) < 1.1 + pad) return true;
    return cross.some((cx) => z < walkZ + 1 && z > pathZ(cx) && Math.abs(x - (cx + (walkZ - z) * 0.35)) < 1 + pad);
  };

  // --- Benches facing the path, lamps along it, bins, a fountain -------------------------------
  const things: [number, number][] = [];
  let side = 1;
  for (const [x0, x1] of pieces) {
    for (let x = x0 + 8; x < x1 - 4; x += 19) {
      const z = pathZ(x) + side * 3.1;
      parkBench(S.paint, S.metal, x, ctx.ground(x, z), z, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      things.push([x, z]);
      side = -side;
    }
    for (let x = x0 + 16; x < x1 - 4; x += 24) {
      const z = pathZ(x) - 2.6;
      parkLamp(S.metal, S.glow, x, ctx.ground(x, z), z);
      things.push([x, z]);
    }
    for (let x = x0 + 25; x < x1 - 4; x += 38) {
      const z = pathZ(x) + 2.4;
      const gy = ctx.ground(x, z);
      cyl(S.paint, [x, gy, z], [x, gy + 0.95, z], 0.3, 0.28, 10, '#2f5d4a');
      things.push([x, z]);
    }
  }
  {
    const x = xWest + (xEast - xWest) * 0.62;
    const z = pathZ(x) + 2.6;
    const gy = ctx.ground(x, z);
    cyl(S.stone, [x, gy, z], [x, gy + 0.9, z], 0.22, 0.3, 8, '#bdb5a6');
    cyl(S.metal, [x, gy + 0.9, z], [x, gy + 0.98, z], 0.3, 0.3, 10, '#8c949c');
    things.push([x, z]);
  }
  // The McKinley monument at the east end: a bronze figure on a granite column.
  {
    const x = xEast - 6;
    const z = pathZ(x) - 5.5;
    const gy = ctx.ground(x, z);
    box(S.stone, x - 1.6, x + 1.6, gy - 0.3, gy + 0.5, z - 1.6, z + 1.6, '#b9b2a4');
    box(S.stone, x - 1.1, x + 1.1, gy + 0.5, gy + 1.0, z - 1.1, z + 1.1, '#c4bdae');
    cyl(S.stone, [x, gy + 1.0, z], [x, gy + 4.6, z], 0.62, 0.72, 10, '#cfc8b9');
    box(S.stone, x - 0.85, x + 0.85, gy + 4.6, gy + 5.0, z - 0.85, z + 0.85, '#c4bdae');
    // The figure: a robed woman holding up a palm (the monument's Columbia), in bronze.
    const bronze = '#5b6a4f';
    cyl(S.gloss, [x, gy + 5.0, z], [x, gy + 6.5, z], 0.26, 0.42, 8, bronze);
    const head = new THREE.SphereGeometry(0.2, 8, 6);
    head.translate(x, gy + 6.72, z);
    S.gloss.add(head, bronze);
    cyl(S.gloss, [x + 0.15, gy + 6.3, z], [x + 0.5, gy + 7.3, z - 0.1], 0.07, 0.07, 5, bronze);
    things.push([x, z]);
  }
  const clear = (x: number, z: number, r: number): boolean => things.every(([tx, tz]) => (tx - x) ** 2 + (tz - z) ** 2 > r * r);

  // --- The trees: rows of eucalyptus and cypress --------------------------------------------------
  const rows: { z: number; step: number; jitter: number; cypress: number }[] = [
    { z: zNear - 1.9, step: 13, jitter: 0.5, cypress: 0.15 },
    { z: (walkZ + mid) / 2 - 0.5, step: 11, jitter: 1.4, cypress: 0.45 },
    { z: zFar + 3.2, step: 12, jitter: 1.2, cypress: 0.55 },
  ];
  for (const row of rows) {
    for (const [x0, x1] of pieces) {
      for (let x = x0 + 3 + rng() * 4; x < x1 - 2; x += row.step * (0.8 + rng() * 0.4)) {
        const tx = x + (rng() - 0.5) * 2;
        const tz = row.z + (rng() - 0.5) * 2 * row.jitter;
        if (!inPark(tx, tz, -0.5) || nearPath(tx, tz, 1.2) || !clear(tx, tz, 2.6)) continue;
        const gy = ctx.ground(tx, tz);
        if (rng() < row.cypress) cypressTree(S.foliage, tx, gy, tz, 1.25 + rng() * 0.35, Math.PI * (0.9 + rng() * 0.3), rng);
        else eucalyptus(S.foliage, tx, gy, tz, 0.85 + rng() * 0.3, rng);
        things.push([tx, tz]);
      }
    }
  }

  const s0 = oak.s0 - 1;
  const s1 = oak.s1 - 18;
  return { noHouses: (s, sd) => sd < 0 && s >= s0 && s <= s1 };
}

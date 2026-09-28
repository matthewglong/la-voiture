// Buena Vista's switchbacks garden, drawn: the terraced woods floor between the zigzag's legs (as
// terraces.ts plans it), a rubble retaining wall wherever one leg's terrace drops to the next's, the
// garden's own walls round it, and shrubs on the terraces. A car that hops a wall comes down on a
// terrace (the sim's bed) and skids onto its leg, or drops off the terrace's edge to the leg below.
import * as THREE from 'three';
import { gardenWorld } from '../../../track';
import { obox, type GeoBuilder, type V3 } from '../../geo';
import type { Ctx } from '../context';
import { woodsTone } from '../lawn';
import { shrub } from './trees';
import { LEG_GAP, bvGardenPlan, type GardenPlan } from './terraces';

/** The floor's grid (m). */
const CELL = 1;
/** Half a retaining wall's thickness (m). */
const HALF = 0.3;
/** How tall the stone courses are (m). */
const COURSE = 0.42;
/** The leaf litter, the terraces' floor under the woods' green. */
const LITTER = new THREE.Color('#6b5638');

interface Vtx {
  x: number;
  z: number;
  s: number;
  e: number;
  h: number;
}

/** Where the line between two legs' terraces crosses an edge of the grid, from vertex `from`: the
 *  ground either side of it ([0] on `from`'s leg), and its two vertices in the floor. */
interface Cut {
  key: string;
  from: number;
  x: number;
  z: number;
  s: [number, number];
  h: [number, number];
  k: [number, number];
}

/** A wall's line: at each point, the side it faces (`n`: towards face B), its faces' feet, its top. */
interface WallPt {
  x: number;
  z: number;
  nx: number;
  nz: number;
  botA: number;
  botB: number;
  top: number;
}

export function buildGarden(ctx: Ctx, stones: readonly string[], coping: readonly string[], rng: () => number): GardenPlan {
  const plan = bvGardenPlan(ctx.course);
  const g = plan.garden;
  const S = ctx.sinks;
  /** The terrace at (x, z), `e` past its leg's edge: never under the ground about (which lies low
   *  in the garden, but for where it rises to meet the land outside it). */
  const over = (x: number, z: number, y: number, e: number): number => (e < 0.3 ? y : Math.max(y, ctx.ground(x, z) + 0.05));

  // --- The floor: every grid point on its nearest leg's terrace -----------------------------------
  const nu = Math.ceil((g.u1 - g.u0) / CELL);
  const nv = Math.ceil((2 * g.wall) / CELL);
  const grid: Vtx[] = [];
  for (let j = 0; j <= nu; j++) {
    for (let i = 0; i <= nv; i++) {
      const w = gardenWorld(g, g.u0 + ((g.u1 - g.u0) * j) / nu, -g.wall + (2 * g.wall * i) / nv);
      const o = plan.owner(w.x, w.z);
      grid.push({ x: w.x, z: w.z, s: o.s, e: o.e, h: over(w.x, w.z, plan.bed(o.y, o.e), o.e) });
    }
  }
  const at = (i: number, j: number): number => j * (nv + 1) + i;
  // Its own geometry (smooth, in the woods' colours), each terrace's triangles cut off at the line
  // where the next leg's terrace begins.
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const tone = new THREE.Color();
  const vert = (x: number, y: number, z: number): number => {
    woodsTone(x, z, tone)
      .multiplyScalar(0.72)
      .lerp(LITTER, 0.2 + rng() * 0.4)
      .multiplyScalar(0.9 + rng() * 0.2);
    pos.push(x, y, z);
    col.push(tone.r, tone.g, tone.b);
    return pos.length / 3 - 1;
  };
  const gv = grid.map((q) => vert(q.x, q.h, q.z));
  const cuts = new Map<string, Cut>();
  const cutOn = (a: number, b: number): Cut => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const had = cuts.get(key);
    if (had) return had;
    const A = grid[a];
    const B = grid[b];
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 14; k++) {
      const t = (lo + hi) / 2;
      const x = A.x + (B.x - A.x) * t;
      const z = A.z + (B.z - A.z) * t;
      if (plan.owner(x, z, A.s).e < plan.owner(x, z, B.s).e) lo = t;
      else hi = t;
    }
    const t = (lo + hi) / 2;
    const x = A.x + (B.x - A.x) * t;
    const z = A.z + (B.z - A.z) * t;
    const oa = plan.owner(x, z, A.s);
    const ob = plan.owner(x, z, B.s);
    const ha = over(x, z, plan.bed(oa.y, oa.e), oa.e);
    const hb = over(x, z, plan.bed(ob.y, ob.e), ob.e);
    const cut: Cut = { key, from: a, x, z, s: [oa.s, ob.s], h: [ha, hb], k: [vert(x, ha, z), vert(x, hb, z)] };
    cuts.set(key, cut);
    return cut;
  };
  const side = (cut: Cut, v: number): 0 | 1 => (cut.from === v ? 0 : 1);
  /** The lines between terraces: pairs of cuts, and a point on the lower terrace beside each. */
  const segs: { a: Cut; b: Cut; lowX: number; lowZ: number }[] = [];
  // Likewise where a terrace steps down under its leg's wall to the path (inside the wall, hidden):
  // cut there, or a triangle reaching from the terrace to under the path pokes up through the gutter.
  const RISE = 0.3;
  const steps = new Map<string, [number, number]>();
  /** The floor's two vertices where the edge from `a` (under the wall) to `b` (on the terrace)
   *  crosses the step. */
  const stepOn = (a: number, b: number): [number, number] => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const had = steps.get(key);
    if (had) return had;
    const A = grid[a];
    const B = grid[b];
    const t = (RISE - A.e) / (B.e - A.e);
    const x = A.x + (B.x - A.x) * t;
    const z = A.z + (B.z - A.z) * t;
    const o = plan.owner(x, z, A.s);
    const k: [number, number] = [vert(x, plan.bed(o.y, 0), z), vert(x, over(x, z, plan.bed(o.y, RISE), RISE), z)];
    steps.set(key, k);
    return k;
  };
  const tri = (a: number, b: number, c: number): void => {
    const A = grid[a];
    const B = grid[b];
    const C = grid[c];
    // (Under the path: it hides the ground.)
    if (A.e < -0.3 && B.e < -0.3 && C.e < -0.3) return;
    const ab = Math.abs(A.s - B.s) < LEG_GAP;
    const bc = Math.abs(B.s - C.s) < LEG_GAP;
    const ca = Math.abs(C.s - A.s) < LEG_GAP;
    let t: [number, number, number] | null = null;
    if (ab && bc && ca) {
      const la = A.e < RISE;
      const lb = B.e < RISE;
      const lc = C.e < RISE;
      if (la === lb && lb === lc) {
        idx.push(gv[a], gv[b], gv[c]);
        return;
      }
      const [lone, p1, p2] = la === lb ? [c, a, b] : lb === lc ? [a, b, c] : [b, c, a];
      const low = grid[lone].e < RISE;
      const k1 = low ? stepOn(lone, p1) : stepOn(p1, lone);
      const k2 = low ? stepOn(lone, p2) : stepOn(p2, lone);
      const mine = low ? 0 : 1;
      idx.push(gv[lone], k1[mine], k2[mine]);
      idx.push(k1[mine ^ 1], gv[p1], gv[p2], k1[mine ^ 1], gv[p2], k2[mine ^ 1]);
      return;
    }
    if (ab && !bc && !ca) t = [c, a, b];
    else if (bc && !ab && !ca) t = [a, b, c];
    else if (ca && !ab && !bc) t = [b, c, a];
    if (!t) {
      // (Where three terraces meet, inside a hairpin's island: too small to matter.)
      idx.push(gv[a], gv[b], gv[c]);
      return;
    }
    const [lone, p1, p2] = t;
    const x1 = cutOn(lone, p1);
    const x2 = cutOn(lone, p2);
    const s1 = side(x1, lone);
    const s2 = side(x2, lone);
    idx.push(gv[lone], x1.k[s1], x2.k[s2]);
    idx.push(x1.k[s1 ^ 1], gv[p1], gv[p2], x1.k[s1 ^ 1], gv[p2], x2.k[s2 ^ 1]);
    const L = grid[lone];
    const P = grid[p1];
    const low = L.s > P.s ? L : P;
    segs.push({ a: x1, b: x2, lowX: low.x, lowZ: low.z });
  };
  for (let j = 0; j < nu; j++) {
    for (let i = 0; i < nv; i++) {
      tri(at(i, j), at(i + 1, j), at(i + 1, j + 1));
      tri(at(i, j), at(i + 1, j + 1), at(i, j + 1));
    }
  }
  const floor = new THREE.BufferGeometry();
  floor.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  floor.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  floor.setIndex(idx);
  floor.computeVertexNormals();
  S.path.add(floor, null);

  // --- The retaining walls where a terrace drops to the next leg's -----------------------------------
  const byCut = new Map<string, number[]>();
  segs.forEach((sg, i) => {
    for (const cut of [sg.a, sg.b]) {
      const list = byCut.get(cut.key) ?? [];
      list.push(i);
      byCut.set(cut.key, list);
    }
  });
  const used = new Uint8Array(segs.length);
  const chainFrom = (start: number, first: Cut): { cuts: Cut[]; segs: number[] } => {
    const cs: Cut[] = [first];
    const ss: number[] = [];
    let cur = start;
    let at = first;
    while (cur >= 0 && !used[cur]) {
      used[cur] = 1;
      ss.push(cur);
      const sg = segs[cur];
      const next = sg.a.key === at.key ? sg.b : sg.a;
      cs.push(next);
      at = next;
      cur = (byCut.get(next.key) ?? []).find((k) => !used[k]) ?? -1;
    }
    return { cuts: cs, segs: ss };
  };
  const chains: { cuts: Cut[]; segs: number[] }[] = [];
  // Open lines first (from an end: a cut only one segment reaches), then any closed ones.
  for (const [key, list] of byCut) {
    if (list.length !== 1 || used[list[0]]) continue;
    const sg = segs[list[0]];
    chains.push(chainFrom(list[0], sg.a.key === key ? sg.a : sg.b));
  }
  segs.forEach((sg, i) => {
    if (!used[i]) chains.push(chainFrom(i, sg.a));
  });
  for (const ch of chains) {
    // (Cuts a sliver apart make a twisted scrap of wall: keep them a little apart.)
    const kept = ch.cuts.filter((cut, k) => k === 0 || Math.hypot(cut.x - ch.cuts[k - 1].x, cut.z - ch.cuts[k - 1].z) > 0.15);
    ch.cuts = kept;
    if (ch.cuts.length < 2) continue;
    const pts: WallPt[] = ch.cuts.map((cut, k) => {
      const prev = ch.cuts[Math.max(0, k - 1)];
      const next = ch.cuts[Math.min(ch.cuts.length - 1, k + 1)];
      let tx = next.x - prev.x;
      let tz = next.z - prev.z;
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl;
      tz /= tl;
      // Face B towards the lower terrace.
      const sg = segs[ch.segs[Math.min(k, ch.segs.length - 1)]];
      let nx = -tz;
      let nz = tx;
      if (nx * (sg.lowX - cut.x) + nz * (sg.lowZ - cut.z) < 0) {
        nx = -nx;
        nz = -nz;
      }
      const up = cut.s[0] < cut.s[1] ? cut.h[0] : cut.h[1];
      const down = cut.s[0] < cut.s[1] ? cut.h[1] : cut.h[0];
      return { x: cut.x, z: cut.z, nx, nz, botA: up - 0.2, botB: down - 0.25, top: up + 0.18 + (rng() - 0.5) * 0.06 };
    });
    stoneWall(S.stone, pts, stones, coping, rng);
  }

  // --- The garden's own walls: down its sides (on past the corners, over the ends' ends), and across
  // its ends but for the way in and out ------------------------------------------------------------
  const past = HALF * 2;
  for (const [u0, v0, u1, v1, out] of [
    [g.u0 - past, -g.wall, g.u1 + past, -g.wall, -1],
    [g.u0 - past, g.wall, g.u1 + past, g.wall, 1],
    [g.u0, -g.wall, g.u0, g.wall, -1],
    [g.u1, -g.wall, g.u1, g.wall, 1],
  ] as const) {
    const len = Math.hypot(u1 - u0, v1 - v0);
    const n = Math.max(1, Math.round(len / 0.6));
    const alongU = u0 !== u1;
    let run: WallPt[] = [];
    // Piers where it stops for the path, as tall as the ground it holds back there.
    let openBefore = false;
    let runOpens = false;
    const pier = (q: WallPt): void => {
      const yaw = Math.atan2(q.nz, q.nx);
      const bot = Math.min(q.botA, q.botB);
      const top = q.top + 0.35;
      obox(S.stone, [q.x, (bot + top) / 2, q.z], [1.1, top - bot, 1.1], [0, -yaw, 0], stones[Math.floor(rng() * stones.length)]);
      obox(S.stone, [q.x, top + 0.08, q.z], [1.3, 0.16, 1.3], [0, -yaw, 0], coping[0]);
    };
    const flush = (atPath: boolean): void => {
      if (run.length > 1) {
        stoneWall(S.stone, run, stones, coping, rng);
        if (runOpens) pier(run[0]);
        if (atPath) pier(run[run.length - 1]);
      }
      run = [];
    };
    for (let k = 0; k <= n; k++) {
      const u = u0 + ((u1 - u0) * k) / n;
      const v = v0 + ((v1 - v0) * k) / n;
      const w = gardenWorld(g, u, v);
      const o = plan.owner(w.x, w.z);
      // (The path's way through, and its own walls.)
      if (o.e < 0.7) {
        if (run.length) flush(true);
        openBefore = true;
        continue;
      }
      if (!run.length) {
        runOpens = openBefore;
        openBefore = false;
      }
      // Outwards: across the sides, or past the ends.
      const ow = alongU ? gardenWorld(g, u, v + out * 0.5) : gardenWorld(g, u + out * 0.5, v);
      const nx = ow.x - w.x;
      const nz = ow.z - w.z;
      const inY = plan.bed(o.y, o.e);
      // (The ground just beyond its outer face: where two walls meet at a corner, the same ground.)
      const outY = ctx.ground(ow.x + nx * 0.2, ow.z + nz * 0.2);
      run.push({ x: w.x + nx * 0.5, z: w.z + nz * 0.5, nx: nx * 2, nz: nz * 2, botA: inY - 0.2, botB: outY - 0.3, top: Math.max(inY + 0.85, outY + 0.3) + (rng() - 0.5) * 0.06 });
    }
    flush(false);
  }

  // --- Shrubs on the terraces, clear of the paths and back from the drops ---------------------------
  for (let u = g.u0 + 1.5; u < g.u1; u += 3) {
    for (let v = -g.wall + 1.5; v < g.wall; v += 3) {
      const w = gardenWorld(g, u + (rng() - 0.5) * 2, v + (rng() - 0.5) * 2);
      const pick = rng();
      const size = 0.55 + rng() * 0.35;
      if (!plan.inside(w.x, w.z, -0.9)) continue;
      const o = plan.owner(w.x, w.z);
      if (o.e < 1.4 || pick > 0.4) continue;
      // Not at a terrace's edge: its leg must be the nearest a metre round about too.
      let edge = false;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (Math.abs(plan.owner(w.x + dx, w.z + dz).s - o.s) > LEG_GAP) edge = true;
      }
      if (edge) continue;
      shrub(S.foliage, w.x, over(w.x, w.z, plan.bed(o.y, o.e), o.e), w.z, size, rng);
    }
  }
  return plan;
}

/**
 * A wall of rubble stone along a line of points: face A on the -n side, face B on the +n side (HALF
 * either side of the line), each coursed down to its own foot, a coping along the top, the ends
 * closed.
 */
function stoneWall(b: GeoBuilder, pts: WallPt[], stones: readonly string[], coping: readonly string[], rng: () => number): void {
  const pick = (): string => stones[Math.floor(rng() * stones.length)];
  const P = (q: WallPt, sgn: number, y: number): V3 => [q.x + q.nx * HALF * sgn, y, q.z + q.nz * HALF * sgn];
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    for (const sgn of [-1, 1]) {
      const bp = sgn < 0 ? p.botA : p.botB;
      const bq = sgn < 0 ? q.botA : q.botB;
      const facing: V3 = [p.nx * sgn, 0, p.nz * sgn];
      const n = Math.max(1, Math.round(Math.max(p.top - bp, q.top - bq) / COURSE));
      for (let k = 0; k < n; k++) {
        const f0 = k / n;
        const f1 = (k + 1) / n;
        b.quad(P(p, sgn, bp + (p.top - bp) * f0), P(q, sgn, bq + (q.top - bq) * f0), P(q, sgn, bq + (q.top - bq) * f1), P(p, sgn, bp + (p.top - bp) * f1), pick(), facing);
      }
    }
    b.quad(P(p, -1, p.top), P(q, -1, q.top), P(q, 1, q.top), P(p, 1, p.top), coping[Math.floor(rng() * coping.length)], [0, 1, 0]);
  }
  for (const [i, dir] of [
    [0, -1],
    [pts.length - 1, 1],
  ] as const) {
    const p = pts[i];
    const o = pts[i - dir];
    const tx = p.x - o.x;
    const tz = p.z - o.z;
    const bot = Math.min(p.botA, p.botB);
    b.quad(P(p, -1, bot), P(p, 1, bot), P(p, 1, p.top), P(p, -1, p.top), pick(), [tx, 0, tz]);
  }
}

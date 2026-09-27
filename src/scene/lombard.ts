// Lombard St's crooked block: a red-brick road snaking down through terraced gardens, hedges along
// every switchback (low enough to jump), hydrangeas in the beds, and stairs down both sides.
import * as THREE from 'three';
import { COURSE, LOMBARD, heightAt, terrainY, type CoursePoint } from '../track';
import { GeoBuilder, box, cyl, strip, type V3 } from './geo';

const C = COURSE;
const SEC = C.sections.find((s) => s.kind === 'lombard')!;
export const LOMBARD_X0 = SEC.xMin;
export const LOMBARD_X1 = SEC.xMax;
export const BAND = LOMBARD.bandHalf;
export const LOMBARD_WALK = 3;
const CURB = 0.18;

/** The road samples along the crooked block (every 0.5 m). */
function roadPoints(): CoursePoint[] {
  const out: CoursePoint[] = [];
  for (const p of C.points) if (p.s >= SEC.s0 - 0.01 && p.s <= SEC.s1 + 0.01 && Math.round(p.s / 0.25) % 2 === 0) out.push(p);
  return out;
}

/** Runs of samples that make up each leg or hairpin, for blending heights between neighbours. */
function nearestOnRuns(pts: CoursePoint[], x: number, z: number): { h: number; dist: number } {
  // The nearest point on each separate stretch of road within reach; blend their heights by distance.
  let wsum = 0;
  let hsum = 0;
  let dmin = Infinity;
  let bestIdx = -1;
  let bestD2 = Infinity;
  const picks: { i: number; d2: number }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const dx = x - p.x;
    const dz = z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestIdx = i;
    }
    // Local minima along the course: the closest point of each pass.
    const prev = pts[i - 1];
    const next = pts[i + 1];
    const d2p = prev ? (x - prev.x) ** 2 + (z - prev.z) ** 2 : Infinity;
    const d2n = next ? (x - next.x) ** 2 + (z - next.z) ** 2 : Infinity;
    if (d2 <= d2p && d2 <= d2n && d2 < 26 * 26) picks.push({ i, d2 });
  }
  if (picks.length === 0 && bestIdx >= 0) picks.push({ i: bestIdx, d2: bestD2 });
  for (const { i, d2 } of picks) {
    const w = 1 / (d2 + 2);
    wsum += w;
    hsum += w * pts[i].y;
    dmin = Math.min(dmin, Math.sqrt(d2));
  }
  return { h: hsum / wsum, dist: dmin };
}

export interface LombardSinks {
  brick: GeoBuilder;
  hedge: GeoBuilder;
  garden: GeoBuilder;
  flowers: GeoBuilder;
  concrete: GeoBuilder;
  metal: GeoBuilder;
}

export function buildLombard(k: LombardSinks, rng: () => number): void {
  const pts = roadPoints();
  const hw = SEC.hw;

  // --- The brick road.
  strip(k.brick, pts, -hw, hw, (i) => pts[i].y + 0.01, '#ffffff', { uvScale: 2 });

  // --- Garden terrain filling the band: follows the road beside it, blends between the legs, and
  // meets the sidewalks at the edges of the band. Raised a little into planting beds.
  const x0 = LOMBARD_X0;
  const x1 = LOMBARD_X1;
  const nx = Math.ceil((x1 - x0) / 1);
  const nz = Math.ceil((2 * BAND) / 1);
  const H: number[][] = [];
  for (let i = 0; i <= nx; i++) {
    H.push([]);
    const x = x0 + ((x1 - x0) * i) / nx;
    const edgeY = terrainY(x) + CURB;
    for (let j = 0; j <= nz; j++) {
      const z = -BAND + (2 * BAND * j) / nz;
      const r = nearestOnRuns(pts, x, z);
      let h = r.h;
      // Planting beds sit a little proud of the road; under the road the ground hides below the bricks.
      if (r.dist > hw + 0.4) h += 0.3 + Math.min(0.5, (r.dist - hw) * 0.05);
      else h -= 0.25;
      // Meet the sidewalk at the band's edge.
      const e = Math.max(0, (Math.abs(z) - (BAND - 2.5)) / 2.5);
      h = h + (edgeY - h) * Math.min(1, e);
      H[i].push(h);
    }
  }
  // Lawn all over: the square grid can't follow the diagonal hedges, so a soil border would step
  // along them like a staircase. The hedges and the bricks hide where the lawn dips under the road.
  const lawn = new THREE.Color('#62a34e');
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const xa = x0 + ((x1 - x0) * i) / nx;
      const xb = x0 + ((x1 - x0) * (i + 1)) / nx;
      const za = -BAND + (2 * BAND * j) / nz;
      const zb = -BAND + (2 * BAND * (j + 1)) / nz;
      const col = lawn.clone().offsetHSL(0, 0, (rng() - 0.5) * 0.04);
      k.garden.quad([xa, H[i][j], za], [xb, H[i + 1][j], za], [xb, H[i + 1][j + 1], zb], [xa, H[i][j + 1], zb], col, [0, 1, 0]);
    }
  }
  const groundAt = (x: number, z: number): number => {
    const fi = Math.min(Math.max(((x - x0) / (x1 - x0)) * nx, 0), nx - 1e-6);
    const fj = Math.min(Math.max(((z + BAND) / (2 * BAND)) * nz, 0), nz - 1e-6);
    const i = Math.floor(fi);
    const j = Math.floor(fj);
    const u = fi - i;
    const v = fj - j;
    return (
      H[i][j] * (1 - u) * (1 - v) + H[i + 1][j] * u * (1 - v) + H[i][j + 1] * (1 - u) * v + H[i + 1][j + 1] * u * v
    );
  };

  // --- Hedges along every jumpable edge, low brick kerbs along the others.
  const edgeRuns = (side: 1 | -1): { a: number; b: number; kind: string }[] => {
    const runs: { a: number; b: number; kind: string }[] = [];
    for (let i = 0; i < pts.length; i++) {
      const kind = side > 0 ? pts[i].edgeR : pts[i].edgeL;
      const last = runs[runs.length - 1];
      if (last && last.kind === kind) last.b = i;
      else runs.push({ a: i, b: i, kind });
    }
    return runs;
  };
  for (const side of [1, -1] as const) {
    for (const run of edgeRuns(side)) {
      const seg = pts.slice(run.a, Math.min(run.b + 2, pts.length));
      if (seg.length < 2) continue;
      const d0 = side > 0 ? hw : -hw - 0.75;
      const d1 = side > 0 ? hw + 0.75 : -hw;
      if (run.kind === 'hedge') {
        strip(k.hedge, seg, d0, d1, (i) => seg[i].y + 0.95, '#2f7d3a', {
          bottom: (i) => seg[i].y - 0.1,
          sides: true,
          uvScale: 1,
        });
        // A rounded top: a second, narrower layer.
        const m0 = side > 0 ? hw + 0.12 : -hw - 0.63;
        const m1 = side > 0 ? hw + 0.63 : -hw - 0.12;
        strip(k.hedge, seg, m0, m1, (i) => seg[i].y + 1.08, '#3b9146', { bottom: (i) => seg[i].y + 0.9, sides: true });
      } else {
        strip(k.concrete, seg, d0, d0 + (d1 - d0) * 0.4, (i) => seg[i].y + CURB + 0.06, '#b5523b', {
          bottom: (i) => seg[i].y - 0.1,
          sides: true,
        });
      }
    }
  }

  // --- Hydrangeas and little topiary in the beds.
  const blooms = ['#ff8fc4', '#f569a6', '#8fa8ff', '#b28cff', '#fdf6ff', '#ff6f91', '#7fb4ff'];
  for (let n = 0; n < 1400; n++) {
    const x = x0 + 1 + rng() * (x1 - x0 - 2);
    const z = (rng() * 2 - 1) * (BAND - 1.2);
    const r = nearestOnRuns(pts, x, z);
    if (r.dist < hw + 1.1) continue;
    const y = groundAt(x, z);
    const s = 0.55 + rng() * 0.6;
    const col = new THREE.Color(rng() < 0.22 ? '#4f9a45' : blooms[Math.floor(rng() * blooms.length)]);
    const gg = new THREE.IcosahedronGeometry(0.45 * s, 0);
    gg.scale(1, 0.8, 1);
    gg.translate(x, y + 0.3 * s, z);
    k.flowers.add(gg, col);
  }

  // --- Stairs down both sides of the block, with lamp posts.
  for (const sz of [1, -1]) {
    const za = sz > 0 ? BAND : -BAND - LOMBARD_WALK;
    const zb = sz > 0 ? BAND + LOMBARD_WALK : -BAND;
    const n = Math.ceil((x1 - x0) / 1.6);
    for (let i = 0; i < n; i++) {
      const xa = x0 + ((x1 - x0) * i) / n;
      const xb = x0 + ((x1 - x0) * (i + 1)) / n;
      const y = terrainY(xa) + CURB;
      const yb = Math.min(terrainY(xb), terrainY(xa)) - 0.6;
      box(k.concrete, xa, xb, yb, y, za, zb, i % 2 ? '#d9d2c4' : '#d2cabb');
    }
    // A handrail and lamp posts along the stairs.
    for (let x = x0 + 4; x < x1 - 2; x += 14) {
      const y = terrainY(x) + CURB;
      const z = sz * (BAND + 0.35);
      cyl(k.metal, [x, y, z], [x, y + 4.2, z], 0.06, 0.08, 8, '#23443a');
      const lamp = new THREE.SphereGeometry(0.22, 10, 8);
      lamp.translate(x, y + 4.35, z);
      k.metal.add(lamp, '#fff4cf');
    }
    // Brick retaining edge where the gardens meet the stairs.
    const edge: V3[] = [];
    for (let x = x0; x <= x1 + 1e-6; x += 1) edge.push([x, terrainY(x) + CURB + 0.28, sz * BAND]);
    for (let i = 0; i < edge.length - 1; i++) {
      const a = edge[i];
      const b = edge[i + 1];
      box(k.concrete, a[0], b[0], Math.min(a[1], b[1]) - 0.6, (a[1] + b[1]) / 2, sz * BAND - 0.15, sz * BAND + 0.15, '#b5523b');
    }
  }

  // --- Road height sanity: the hedges read from the road samples; nothing else needed here.
  void heightAt;
}

// Alamo Square as surveyed (maps/data/alamoSquare.ts), at the course's scale: the lawns and planted
// beds (painted into the ground), every path and flight of steps, the trees (windswept Monterey
// cypresses, pines and the rest, where OpenStreetMap has them), the benches (the row facing the
// Painted Ladies among them), picnic tables and drinking fountains, the low fences and retaining
// walls, the tennis court, the playground and the restrooms; low hedges along the course's own
// paths (they're its walls). Round it, the streets that bound it (Hayes, Scott, Fulton; Steiner is
// the course) with houses facing the park, the corner of Fulton & Steiner at the foot of the steps,
// and the famous houses: the Painted Ladies on Steiner, the Archbishop's Mansion across Fulton from
// the steps, and the Westerfeld House at Fulton & Scott.
import * as THREE from 'three';
import { ALAMO_PARK } from '../../maps/data/alamoSquare';
import { ALAMO_ARCHES, ALAMO_OPEN, ALAMO_SCALE, ALAMO_THINGS, ALAMO_TREES, STREET_HW, alamoCorners } from '../../maps/oldStompingGrounds';
import { pointAt, type Course, type LaidChunk } from '../../track';
import { Crowd, type Spot } from '../crowd';
import { GeoBuilder, box, cyl, meshOf, obox, prism, rbox, strip, type V3 } from '../geo';
import { barrierPanel, cypressTree, hoopFence, parkBench, parkLamp, pineTree, tree } from '../props';
import { buildGantry } from '../trackside';
import type { Frontage, HouseStyle } from '../victorian';
import { along, placeAt, rectPoly, type Ctx, type Hood } from './context';
import { archbishopsMansion, paintedLady, westerfeldHouse } from './ladies';
import { PARK_PATH, PAVE_UV, kerbQuad, paveQuad, walkGround } from './paving';
import { KERB, WALK, sideStreet, type Arm } from './streets';

const k = ALAMO_SCALE;

/** The Painted Ladies, south to north (710 to 722 Steiner): their frontages (relative: 710 is the
 *  widest of the six, 722 the corner house keeps its width and the others give up theirs to fit the
 *  block) and a style for each (ladies.ts paints every one as she was in August 2026; the style is
 *  only its fallback). */
const LADIES: { addr: string; w: number; style: HouseStyle }[] = [
  { addr: '710', w: 6.8, style: { color: '#c9b79c', trim: '#f1e8d2', accent: '#7c5d45', door: '#6b4a34', gable: '#e8dcc0', shingles: '#b8a386', queenAnne: true, floors: 3, doorLeft: false, garage: false } },
  { addr: '712', w: 5.7, style: { color: '#9fc6e4', trim: '#fbfbf7', accent: '#3d6d99', door: '#fbfbf7', gable: '#fbfbf7', shingles: '#88b4d6', queenAnne: true, floors: 3, doorLeft: true, garage: false } },
  { addr: '714', w: 5.7, style: { color: '#f1e8d0', trim: '#8a2d3d', accent: '#8a2d3d', door: '#8a2d3d', gable: '#c9a24a', shingles: '#e6d8b5', queenAnne: true, floors: 3, doorLeft: false, garage: false } },
  { addr: '716', w: 5.7, style: { color: '#f4d77a', trim: '#fbf6e6', accent: '#c0392b', door: '#c0392b', gable: '#c0392b', shingles: '#e8c55e', queenAnne: true, floors: 3, doorLeft: true, garage: false } },
  { addr: '718', w: 5.7, style: { color: '#a9b5a1', trim: '#f2efe4', accent: '#5f6f5c', door: '#3f4f45', gable: '#e4e8dc', shingles: '#96a38f', queenAnne: true, floors: 3, doorLeft: false, garage: false } },
  { addr: '720', w: 5.7, style: { color: '#9a9a62', trim: '#f3e6a8', accent: '#6b6b3a', door: '#6b4a34', gable: '#f3e6a8', shingles: '#88884f', queenAnne: true, floors: 3, doorLeft: true, garage: false } },
  { addr: '722', w: 8.4, style: { color: '#26365c', trim: '#dce9f5', accent: '#8a2d3d', door: '#8a2d3d', shingles: '#1f2d4d', roof: '#3a4250', queenAnne: false, floors: 3, doorLeft: false, garage: false, turret: 1 } },
];

/**
 * The streets round the park, as the ground is graded under them before anything's built
 * (index.ts) and buildAlamo lays them: Scott up the west side, Fulton along the north (both climbing
 * from one corner's height to the next: the course's where it crosses, the survey's at Fulton &
 * Scott), Hayes along the south between the course's two crossings' arms, and the corner of Fulton &
 * Steiner at the foot of the steps where the course hairpins round, level with it, with Fulton east
 * and Steiner north off it.
 */
export function alamoStreets(c: Course, chunk: (id: string) => LaidChunk): { scottX: number; fultonZ: number; steinerX: number; yNE: number; hw: number; pads: Arm[] } {
  const al = chunk('alamo');
  const at = (u: number, v: number): { x: number; z: number } => al.toWorld(u * k, v * k);
  const sw = at(4.8, 1.8);
  const se = at(270.1, 5.9);
  const nw = at(1.7, -181.6);
  const hw = STREET_HW - 1;
  const off = WALK + hw;
  const scottX = sw.x - off;
  const fultonZ = nw.z - off;
  const steinerX = pointAt(c, al.marks.steiner + 4).x;

  // (The corners' heights are the park's edge's too: alamoCorners.)
  const { ySW: yScott, ySE: ySteiner, yNW, yNE } = alamoCorners();
  const pads: Arm[] = [];
  const street = (ax: number, az: number, bx: number, bz: number, y: number, y1: number): void => {
    pads.push({ x: ax, z: az, y, y1, h: Math.atan2(bz - az, bx - ax), u0: 0, u1: Math.hypot(bx - ax, bz - az), road: hw });
  };
  // Scott, Hayes to Fulton; Fulton & Scott; Fulton, Scott to Steiner.
  street(scottX, sw.z + 3, scottX, fultonZ, yScott, yNW);
  pads.push({ x: scottX, z: fultonZ, y: yNW, h: 0, u0: -hw - WALK, u1: hw + WALK, road: hw });
  street(scottX, fultonZ, steinerX, fultonZ, yNW, yNE);
  // Hayes, between the course's crossings' arms.
  street(sw.x + 34 + hw, sw.z + off, se.x - 34 - STREET_HW, se.z + off, yScott, ySteiner);
  // Fulton & Steiner, Fulton east and Steiner north.
  const pad = (h: number, u0: number, u1: number): Arm => ({ x: steinerX, z: fultonZ, y: yNE, h, u0, u1, road: hw });
  pads.push(pad(0, -STREET_HW - WALK, STREET_HW + WALK), pad(0, STREET_HW, STREET_HW + 34), pad(-Math.PI / 2, hw, hw + 34));
  return { scottX, fultonZ, steinerX, yNE, hw, pads };
}


/** Survey point → world (x, z). */
function world(ctx: Ctx, x: number, z: number): { x: number; z: number } {
  return ctx.chunk('alamo').toWorld(x * k, z * k);
}

export function buildAlamo(ctx: Ctx): Hood {
  const S = ctx.sinks;
  const c = ctx.course;
  const rng = ctx.rng;
  const W = (p: readonly [number, number]): { x: number; z: number } => world(ctx, p[0], p[1]);
  const courseSamples: { x: number; z: number; r: number }[] = [];
  for (let s = ctx.mark('scott', 'hayes') - 10; s < ctx.mark('alamo', 'ladiesEnd') + 10; s += 1) {
    const p = pointAt(c, s);
    courseSamples.push({ x: p.x, z: p.z, r: p.hw });
  }
  /** Within the course's corridor (plus pad) anywhere through the park? */
  const onCourse = (x: number, z: number, pad: number): boolean => courseSamples.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < (q.r + pad) ** 2);

  // --- The park's ground: claim it (nothing else is built here) -------------------------------------
  const boundary = ALAMO_PARK.boundary.map((p) => {
    const w = W(p);
    return [w.x, w.z] as [number, number];
  });
  ctx.occ.claim(boundary);

  // --- Paths that aren't the course: pale asphalt, 2.2 m wide; the steps as treads ----------------
  for (const path of ALAMO_PARK.paths) {
    const line = path.pts.map((p) => W(p));
    // Break it where it runs along (or across) the course's own path.
    let run: { x: number; z: number; tx: number; tz: number; y: number }[] = [];
    const flush = (): void => {
      if (run.length > 1) {
        const r = run;
        if (path.kind === 'steps') {
          for (let i = 0; i < r.length - 1; i++) {
            const a = r[i];
            const b = r[i + 1];
            const len = Math.hypot(b.x - a.x, b.z - a.z);
            const n = Math.max(2, Math.round(len / 0.45));
            for (let j = 0; j < n; j++) {
              const f = (j + 0.5) / n;
              const x = a.x + (b.x - a.x) * f;
              const z = a.z + (b.z - a.z) * f;
              const h = a.y + (b.y - a.y) * f;
              obox(S.concrete, [x, h - 0.2, z], [len / n + 0.03, 0.5, 2.4], [0, -Math.atan2(b.z - a.z, b.x - a.x), 0], j % 2 ? '#ddd6c8' : '#d1cabb');
            }
          }
        } else if (path.kind === 'dirt') strip(S.path, r, -1.1, 1.1, (i) => r[i].y + 0.05, '#c9b18a', { uvScale: 4 });
        else strip(S.sidewalk, r, -1.1, 1.1, (i) => r[i].y + 0.05, PARK_PATH, { uvScale: PAVE_UV });
      }
      run = [];
    };
    for (let i = 0; i < line.length; i++) {
      const p = line[i];
      const q = line[Math.min(i + 1, line.length - 1)];
      const o = line[Math.max(i - 1, 0)];
      const dx = q.x - o.x;
      const dz = q.z - o.z;
      const l = Math.hypot(dx, dz) || 1;
      if (onCourse(p.x, p.z, -1.2)) {
        flush();
        continue;
      }
      // Densify so the path follows the ground.
      if (run.length) {
        const a = run[run.length - 1];
        const seg = Math.hypot(p.x - a.x, p.z - a.z);
        const m = Math.floor(seg / 2);
        for (let j = 1; j < m; j++) {
          const f = j / m;
          const x = a.x + (p.x - a.x) * f;
          const z = a.z + (p.z - a.z) * f;
          run.push({ x, z, tx: dx / l, tz: dz / l, y: ctx.ground(x, z) });
        }
      }
      run.push({ x: p.x, z: p.z, tx: dx / l, tz: dz / l, y: ctx.ground(p.x, p.z) });
    }
    flush();
  }

  // --- Trees: Monterey cypresses, pines and others where OpenStreetMap has them ------------------------
  // (The same trees the sim knows: ALAMO_TREES.)
  ALAMO_TREES.forEach(([x, z]) => {
    const w = { x, z };
    const gy = ctx.ground(w.x, w.z);
    const r = rng();
    const s = 0.7 + rng() * 0.45;
    if (r < 0.45) cypressTree(S.foliage, w.x, gy, w.z, s * 1.2, 0.9 + (rng() - 0.5) * 0.6, rng);
    else if (r < 0.7) pineTree(S.foliage, w.x, gy, w.z, s * 1.1, rng);
    else tree(S.foliage, w.x, gy - 0.2, w.z, 1.2 + rng() * 0.7, rng);
  });

  // --- Benches (the ones on the Steiner path face the Painted Ladies, east), picnic tables, fountains --
  // (What stands off the course is ALAMO_THINGS: the sim knocks into the same.)
  for (const [bx, bz] of ALAMO_THINGS.benches) {
    const w = { x: bx, z: bz };
    // Face the nearest path (or the view, on the east side).
    const east = ctx.chunk('alamo').toChunk(bx, bz).x / k > 200;
    let face = 0;
    if (!east) {
      let best = Infinity;
      for (const pp of ALAMO_PARK.paths) {
        for (const pt of pp.pts) {
          const q = W(pt);
          const d2 = (q.x - w.x) ** 2 + (q.z - w.z) ** 2;
          if (d2 < best && d2 > 0.5) {
            best = d2;
            face = Math.atan2(q.z - w.z, q.x - w.x);
          }
        }
      }
    }
    parkBench(S.paint, S.metal, w.x, ctx.ground(w.x, w.z), w.z, face);
  }
  for (const [tx, tz] of ALAMO_THINGS.picnic) {
    const w = { x: tx, z: tz };
    const gy = ctx.ground(w.x, w.z);
    box(S.paint, w.x - 0.9, w.x + 0.9, gy + 0.72, gy + 0.78, w.z - 0.4, w.z + 0.4, '#8f6a45');
    for (const dz of [-0.7, 0.7]) box(S.paint, w.x - 0.9, w.x + 0.9, gy + 0.42, gy + 0.47, w.z + dz - 0.14, w.z + dz + 0.14, '#8f6a45');
    for (const dx of [-0.7, 0.7]) box(S.metal, w.x + dx - 0.04, w.x + dx + 0.04, gy, gy + 0.74, w.z - 0.6, w.z + 0.6, '#3b3f44');
  }
  for (const [fx, fz] of ALAMO_THINGS.fountains) {
    const w = { x: fx, z: fz };
    const gy = ctx.ground(w.x, w.z);
    cyl(S.stone, [w.x, gy, w.z], [w.x, gy + 0.9, w.z], 0.22, 0.3, 8, '#bdb5a6');
    cyl(S.metal, [w.x, gy + 0.9, w.z], [w.x, gy + 0.98, w.z], 0.3, 0.3, 10, '#8c949c');
  }
  for (const [fx, fz] of ALAMO_THINGS.bins) {
    const w = { x: fx, z: fz };
    const gy = ctx.ground(w.x, w.z);
    cyl(S.paint, [w.x, gy, w.z], [w.x, gy + 0.95, w.z], 0.3, 0.28, 10, '#2f5d4a');
  }
  // Park lamps along the course's paths.
  for (const [lx, lz] of ALAMO_THINGS.lamps) parkLamp(S.metal, S.glow, lx, ctx.ground(lx, lz), lz);

  // --- Fences (the low perimeter hoops) and retaining walls -----------------------------------------------
  // (The park is open ground: the low hoops that edged its lawns would be driven straight through, so
  // only those round the fenced courts and the playground stay: those the sim knows as solid.)
  const solid = [...ALAMO_PARK.tennis, ...ALAMO_PARK.play].map((poly) => poly.map((p) => W(p)));
  const byFence = (x: number, z: number): boolean =>
    solid.some((poly) => poly.some((q, i) => {
      const r = poly[(i + 1) % poly.length];
      const ex = r.x - q.x;
      const ez = r.z - q.z;
      const t = Math.max(0, Math.min(1, ((x - q.x) * ex + (z - q.z) * ez) / (ex * ex + ez * ez || 1)));
      return Math.hypot(q.x + ex * t - x, q.z + ez * t - z) < 1.2;
    }));
  for (const line of ALAMO_PARK.fences) {
    const r = line.map((p) => {
      const w = W(p);
      return { x: w.x, y: ctx.ground(w.x, w.z), z: w.z };
    });
    let run: typeof r = [];
    for (const q of r) {
      if (!byFence(q.x, q.z) || onCourse(q.x, q.z, 0.5)) {
        if (run.length > 1) hoopFence(S.metal, run);
        run = [];
      } else run.push(q);
    }
    if (run.length > 1) hoopFence(S.metal, run);
  }
  for (const [[ax, az], [bx, bz]] of ALAMO_THINGS.walls) {
    {
      const a = { x: ax, z: az };
      const b = { x: bx, z: bz };
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const ya = ctx.ground(a.x, a.z);
      const yb = ctx.ground(b.x, b.z);
      obox(S.stone, [(a.x + b.x) / 2, (ya + yb) / 2 + 0.3, (a.z + b.z) / 2], [len + 0.1, 1.2, 0.45], [0, -Math.atan2(b.z - a.z, b.x - a.x), 0], '#c2b8a3');
    }
  }

  // --- The tennis court, the playground, the restrooms ------------------------------------------------------
  for (const poly of ALAMO_PARK.tennis) {
    const w = poly.map((p) => W(p));
    const gy = Math.min(...w.map((q) => ctx.ground(q.x, q.z))) + 0.05;
    const cx = w.reduce((a, q) => a + q.x, 0) / w.length;
    const cz = w.reduce((a, q) => a + q.z, 0) / w.length;
    prism(S.paint, w.map((q) => [q.x, gy - 0.4, q.z] as [number, number, number]), [0, 0.45, 0], '#3f7f5f');
    // The court: lines on a green surface, the net across its middle.
    let a = 0;
    for (let i = 0; i < w.length; i++) {
      const q = w[i];
      const r = w[(i + 1) % w.length];
      const len = Math.hypot(r.x - q.x, r.z - q.z);
      if (len > a) a = len;
    }
    const e0 = w[0];
    const e1 = w[1];
    const h = Math.atan2(e1.z - e0.z, e1.x - e0.x);
    obox(S.marks, [cx, gy + 0.06, cz], [a * 0.72, 0.01, 6.2], [0, -h, 0], '#f4f4ee');
    obox(S.paint, [cx, gy + 0.07, cz], [a * 0.7, 0.01, 5.9], [0, -h, 0], '#4b8f68');
    obox(S.metal, [cx, gy + 0.5, cz], [0.05, 0.9, 6.4], [0, -h, 0], '#2b2f33');
    // Chain-link fence round it.
    for (let i = 0; i < w.length; i++) {
      const q = w[i];
      const r = w[(i + 1) % w.length];
      cyl(S.metal, [q.x, gy, q.z], [q.x, gy + 3, q.z], 0.05, 0.05, 6, '#2b3a33');
      cyl(S.metal, [q.x, gy + 3, q.z], [r.x, gy + 3, r.z], 0.03, 0.03, 4, '#2b3a33');
      const len = Math.hypot(r.x - q.x, r.z - q.z);
      obox(S.metal, [(q.x + r.x) / 2, gy + 1.5, (q.z + r.z) / 2], [len, 3, 0.03], [0, -Math.atan2(r.z - q.z, r.x - q.x), 0], '#3c4a42');
    }
  }
  for (const poly of ALAMO_PARK.play) {
    const w = poly.map((p) => W(p));
    const gy = ctx.ground(w[0].x, w[0].z);
    prism(S.paint, w.map((q) => [q.x, gy - 0.3, q.z] as [number, number, number]), [0, 0.36, 0], '#e7875a');
  }
  const playColors = ['#ff6a3d', '#ffd23f', '#2fb5ff', '#7ad151'];
  ALAMO_PARK.playThings.forEach((p, i) => {
    const w = W(p);
    const gy = ctx.ground(w.x, w.z) + 0.06;
    const col = playColors[i % playColors.length];
    rbox(S.gloss, w.x - 0.8, w.x + 0.8, gy + 1.1, gy + 1.4, w.z - 0.8, w.z + 0.8, 0.1, col);
    for (const [dx, dz] of [
      [-0.7, -0.7],
      [0.7, -0.7],
      [-0.7, 0.7],
      [0.7, 0.7],
    ]) cyl(S.metal, [w.x + dx, gy, w.z + dz], [w.x + dx, gy + 2.1, w.z + dz], 0.05, 0.05, 6, '#d8dde3');
    const roof = new THREE.ConeGeometry(1.2, 0.9, 4);
    roof.rotateY(Math.PI / 4);
    roof.translate(w.x, gy + 2.5, w.z);
    S.gloss.add(roof, playColors[(i + 1) % playColors.length]);
    obox(S.gloss, [w.x + 1.2, gy + 0.6, w.z], [2.2, 0.08, 0.6], [0, 0, -0.5], playColors[(i + 2) % playColors.length]);
  });
  for (const poly of ALAMO_PARK.buildings) {
    const w = poly.map((p) => W(p));
    const gy = Math.min(...w.map((q) => ctx.ground(q.x, q.z)));
    prism(S.walls, w.map((q) => [q.x, gy - 0.3, q.z] as [number, number, number]), [0, 3.2, 0], '#e8dcc4');
    prism(S.trim, w.map((q) => [q.x, gy + 2.9, q.z] as [number, number, number]), [0, 0.35, 0], '#b5573f');
  }

  // --- The summit plaza (the course swings round it) and the park's sign at the ramp --------------------------
  {
    // The plaza is the middle of the loop: the average of its points.
    let cx = 0;
    let cz = 0;
    let n = 0;
    for (let s = ctx.mark('alamo', 'summit') + 4; s < ctx.mark('alamo', 'summit') + 30; s += 1) {
      const q = pointAt(c, s);
      cx += q.x;
      cz += q.z;
      n++;
    }
    cx /= n;
    cz /= n;
    const gy = ctx.ground(cx, cz);
    // Paved as the paths are, a kerb round it.
    const R = 2.6;
    const top = gy + 0.1;
    const rim = (a: number, y: number): V3 => [cx + Math.cos(a) * R, y, cz + Math.sin(a) * R];
    for (let k = 0; k < 18; k++) {
      const a0 = (k / 18) * Math.PI * 2;
      const a1 = ((k + 1) / 18) * Math.PI * 2;
      paveQuad(S.sidewalk, [cx, top, cz], rim(a0, top), rim(a1, top), [cx, top, cz]);
      const am = (a0 + a1) / 2;
      kerbQuad(S.sidewalk, rim(a0, top), rim(a1, top), rim(a1, gy - 0.4), rim(a0, gy - 0.4), [Math.cos(am), 0, Math.sin(am)]);
    }
    parkBench(S.paint, S.metal, cx, top, cz, 0);
  }
  {
    const p = along(c, ctx.mark('alamo', 'in') + 3, -5.6);
    const gy = ctx.ground(p.x, p.z);
    const m = placeAt(p.x, gy, p.z, p.heading - Math.PI / 2);
    box(S.paint, -0.08, 0.08, 0, 1.0, -1.1, -0.98, '#5b4331', m);
    box(S.paint, -0.08, 0.08, 0, 1.0, 0.98, 1.1, '#5b4331', m);
    box(S.paint, -0.06, 0.06, 0.55, 1.25, -1.15, 1.15, '#3d5e3a', m);
    signBoard(ctx, p.x, gy + 0.9, p.z, p.heading - Math.PI / 2, 'ALAMO SQUARE', '#3d5e3a', 2.2, 0.62);
  }

  // --- The streets round the park: Hayes along the south, Scott along the west, Fulton along the north ---------
  const frontages: Frontage[] = [];
  const corner = (u: number, v: number): { x: number; z: number } => W([u, v]);
  // The park's corners, as surveyed (southwest, southeast, northeast; the northwest one is where
  // fultonSteiner puts Fulton).
  const sw = corner(4.8, 1.8);
  const se = corner(270.1, 5.9);
  const ne = corner(270.8, -181.8);
  const hw = STREET_HW - 1;
  const off = WALK + hw;
  // Hayes, from the arm off Scott to the arm off Steiner (those come with the course's crossings).
  {
    const a = { x: sw.x + 34 + hw, z: sw.z + off };
    const b = { x: se.x - 34 - STREET_HW, z: se.z + off };
    if (b.x > a.x + 4) frontages.push(...sideStreet(ctx, a.x, a.z, b.x, b.z, hw, { houses: [false, true], walks: [true, true] }));
  }
  // Scott, from Hayes north to Fulton (houses on its west side; the park on its east).
  const { scottX, fultonZ, steinerX, yNE } = alamoStreets(c, ctx.chunk);
  frontages.push(...sideStreet(ctx, scottX, sw.z + 3, scottX, fultonZ + hw, hw, { houses: [true, false] }));
  // Fulton & Scott: the intersection.
  {
    const gy = ctx.ground(scottX, fultonZ);
    box(S.asphalt, scottX - hw, scottX + hw, gy - 1.2, gy + 0.03, fultonZ - hw, fultonZ + hw, '#ffffff');
    ctx.occ.claim(rectPoly(scottX, fultonZ, 0, -hw - WALK, hw + WALK, -hw - WALK, hw + WALK));
  }
  // Fulton along the park's north side, east to Steiner (the park's sidewalk stops where the steps
  // come down at its corner).
  const parkCornerX = ne.x - 0.5;
  frontages.push(...sideStreet(ctx, scottX + hw, fultonZ, parkCornerX, fultonZ, hw, { houses: [true, false] }));
  frontages.push(...sideStreet(ctx, parkCornerX, fultonZ, steinerX - STREET_HW, fultonZ, hw, { houses: [true, false], walks: [true, false] }));
  // The corner of Fulton & Steiner, where the course comes off the steps and hairpins round: the
  // intersection (a touch under the course's own asphalt), Fulton on east and Steiner on north.
  {
    const cx = steinerX;
    const cz = fultonZ;
    const y0 = yNE;
    box(S.asphalt, cx - STREET_HW, cx + STREET_HW, y0 - 1.4, y0, cz - hw, cz + hw, '#ffffff');
    frontages.push(...sideStreet(ctx, cx + STREET_HW, cz, cx + STREET_HW + 34, cz, hw, { houses: [true, true] }));
    frontages.push(...sideStreet(ctx, cx, cz - hw, cx, cz - hw - 34, hw, { houses: [true, true] }));
    // The corners' sidewalks: northwest, northeast, and the southeast one running down into Steiner's.
    const zSteiner = pointAt(c, ctx.mark('alamo', 'steiner')).z;
    walkGround(ctx, S.sidewalk, cx, cz, 0, -STREET_HW - WALK, -STREET_HW, -hw - WALK, -hw, KERB, 0.8, false);
    walkGround(ctx, S.sidewalk, cx, cz, 0, STREET_HW, STREET_HW + WALK, -hw - WALK, -hw, KERB, 0.8, false);
    walkGround(ctx, S.sidewalk, cx, cz, Math.PI / 2, hw, Math.max(hw + WALK, zSteiner - cz), -STREET_HW - WALK, -STREET_HW, KERB, 0.8);
    ctx.occ.claim(rectPoly(cx, cz, 0, -STREET_HW - WALK, STREET_HW + WALK, -hw - WALK, hw + WALK));
  }

  // --- The famous houses -------------------------------------------------------------------------------------
  // The Painted Ladies: Steiner's east side from Hayes up to Grove (the course's left, heading south),
  // 722 on the corner behind Grove's sidewalk.
  {
    const s0 = ctx.mark('alamo', 'ladies') + WALK + 0.3;
    const s1 = ctx.mark('alamo', 'ladiesEnd') - 0.3;
    const d = -(STREET_HW + WALK);
    const pa = along(c, s1, d);
    const pb = along(c, s0, d);
    const len = Math.hypot(pb.x - pa.x, pb.z - pa.z);
    const ux = (pb.x - pa.x) / len;
    const uz = (pb.z - pa.z) / len;
    const corner = LADIES[LADIES.length - 1].w;
    const total = LADIES.reduce((a, h) => a + h.w, 0);
    const f = Math.min(1, (len - corner) / (total - corner));
    let u = Math.max(0, (len - corner - (total - corner) * f) / 2);
    LADIES.forEach((h, i) => {
      const w = i === LADIES.length - 1 ? h.w : h.w * f;
      const ox = pa.x + ux * u;
      const oz = pa.z + uz * u;
      paintedLady(ctx, { ox, oz, ux, uz, W: w }, h.addr, h.style, { first: i === 0, last: i === LADIES.length - 1 });
      ctx.occ.claim(rectPoly(ox, oz, Math.atan2(uz, ux), 0, w, 0, 12));
      u += w;
    });
  }
  // The Archbishop's Mansion (1000 Fulton): across Fulton from the foot of the steps, facing the park.
  archbishopsMansion(ctx, steinerX - STREET_HW - WALK - 1, fultonZ - hw - WALK);
  // The Westerfeld House (1198 Fulton): at Scott, facing the park across Fulton.
  westerfeldHouse(ctx, scottX + hw + WALK + 1, fultonZ - hw - WALK);

  // No houses on Steiner's park side (the park's edge), nor in front of the Painted Ladies (they're
  // here already); sidewalks on both.
  const st0 = ctx.mark('alamo', 'stepsFoot');
  const st1 = ctx.mark('alamo', 'ladiesEnd') + 7;
  const la0 = ctx.mark('alamo', 'ladies');
  const noHouses = (s: number, side: 1 | -1): boolean => (s >= st0 && s <= st1 && side > 0) || (s >= la0 - 1 && s <= st1 && side < 0);
  buildParkEdge(ctx);
  return { noHouses, frontages };
}

/**
 * Alamo Square is open ground (the cars can drive anywhere in it): its edge is the wall, so it's
 * lined with race barriers, spectators behind them on the sidewalk, but for the two gates where the
 * course comes in and goes out, each under a banner arch.
 */
function buildParkEdge(ctx: Ctx): void {
  const o = ALAMO_OPEN;
  const rng = ctx.rng;
  const nearGate = (x: number, z: number): boolean => o.gates.some((g) => Math.hypot(g.x - x, g.z - z) < g.r + 1.2);
  const metal = new GeoBuilder();
  const spots: Spot[] = [];
  const pts = o.outline;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % pts.length];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 2.4));
    // Outward from the park (the outline runs round it one way or the other: test a point).
    let ox = -(bz - az) / len;
    let oz = (bx - ax) / len;
    if (o.contains((ax + bx) / 2 + ox, (az + bz) / 2 + oz)) {
      ox = -ox;
      oz = -oz;
    }
    for (let k = 0; k < n; k++) {
      const x0 = ax + ((bx - ax) * k) / n;
      const z0 = az + ((bz - az) * k) / n;
      const x1 = ax + ((bx - ax) * (k + 1)) / n;
      const z1 = az + ((bz - az) * (k + 1)) / n;
      if (nearGate(x0, z0) || nearGate(x1, z1)) continue;
      barrierPanel(metal, x0, z0, x1, z1, ctx.ground(x0, z0), ctx.ground(x1, z1));
      // A few fans on the sidewalk outside, now and then two deep.
      if (rng() < 0.45) {
        const f = rng();
        const out = 1.1 + rng() * 1.4;
        const x = x0 + (x1 - x0) * f + ox * out;
        const z = z0 + (z1 - z0) * f + oz * out;
        spots.push({ x, y: ctx.ground(x, z), z, face: Math.atan2(-oz, -ox) + (rng() - 0.5) * 0.8 });
      }
    }
  }
  ctx.group.add(meshOf(metal, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.32 }), 'parkBarriers', true, true));
  if (spots.length) {
    const crowd = new Crowd(spots, rng);
    ctx.group.add(crowd.group);
    ctx.updaters.push((dt, t, cars) => crowd.update(dt, t, cars));
  }
  for (const a of ALAMO_ARCHES) {
    const g = buildGantry(ctx.course, a.s, `alamoArch${a.text}`, { text: a.text });
    ctx.group.add(g.group);
    ctx.updaters.push((_dt, t) => g.update(t));
  }
}

/** A painted sign board (text on a coloured panel) standing at (x, y, z), facing `face`. */
export function signBoard(ctx: Ctx, x: number, y: number, z: number, face: number, text: string, bg: string, w: number, h: number): void {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round((512 * h) / w);
  const g = canvas.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = '#f3ead2';
  g.lineWidth = 8;
  g.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  g.fillStyle = '#f3ead2';
  g.font = `800 ${Math.round(canvas.height * 0.42)}px "Georgia", "Times New Roman", serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, canvas.width / 2, canvas.height / 2 + 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x + Math.cos(face) * 0.07 * side, y, z + Math.sin(face) * 0.07 * side);
    m.rotation.y = -face + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    ctx.group.add(m);
  }
}

// San Francisco around the race: an SF street grid on the hill, pastel Victorian row houses along
// the course, race barriers with cheering crowds, cable-car lines, Lombard's crooked block, the
// Embarcadero and the wooden pier. Procedural, and merged by material to keep draw calls low. (The
// start line, the gantry, the kicker and the Bay are shared with every map: src/scene/maps.ts adds
// them from the course.)
import * as THREE from 'three';
import { DECK_Y, EMB_X as SF_EMB_X, KICKER_X, ROAD_HW, RUSSIAN_HILL, SHORE_X as SF_SHORE_X, terrainBreaks, terrainY } from '../maps/russianHill';
import { pointAt, type CoursePoint } from '../track';
import { Crowd, type Spot } from './crowd';
import { GeoBuilder, _e, _m4, _q, _s, _v, box, cyl, meshOf, obox, strip, type V3 } from './geo';
import { BAND, LOMBARD_WALK, LOMBARD_X0, LOMBARD_X1, buildLombard } from './lombard';
import { canvasTexture, makeRng } from './util';
import { asphaltTexture, barricade, barricadeTexture, barrierPanel, buildCableCar, namePlate, namesTexture, signTexture, tree, tyreWall, type TyreSpot } from './props';
import { facadeTexture, rowBlocks, rowHouses, type HouseSinks, type HouseSite } from './victorian';

export interface City {
  group: THREE.Group;
  /** Racers' positions, so the crowd cheers as they pass. */
  update(dt: number, t: number, cars?: { x: number; z: number }[]): void;
}

// ---------------------------------------------------------------------------------------------
// Layout (metres). x runs down the hill towards the Bay, z is to the right looking along +x.
// The course follows real grid streets: Greenwich St, a jog up Hyde St, then Lombard St.

const C = RUSSIAN_HILL;
const SECS = C.sections;
const START = SECS.find((s) => s.kind === 'start')!;
const HYDE = SECS.find((s) => s.kind === 'hyde')!;
const INTS = SECS.filter((s) => s.kind === 'intersection');
const midX = (s: { xMin: number; xMax: number }): number => (s.xMin + s.xMax) / 2;
const HYDE_X = HYDE.xMin;
const GREENWICH_Z = C.points[0].z;
const LARKIN_X = midX(INTS[0]);
const LEAV_X = midX(INTS[1]);
const MASON_X = midX(INTS[2]);
const POLK_X = START.xMin - 22;
const EMB_X = SF_EMB_X;
const SHORE_X = SF_SHORE_X;
const LIP = C.lip!;
const KICK_X = KICKER_X;

const RH = ROAD_HW;
const CONCRETE = '#dcd6c9';
const DARK_WOOD = '#5c4633';
const WALK = 3;
const CURB = 0.18;
const HOUSE_DEPTH = 12;
const GRID_DZ = Math.abs(GREENWICH_Z);
const X_STREETS = [-3, -2, -1, 0, 1, 2, 3].map((k) => k * GRID_DZ);
const Z_STREETS = [POLK_X - 96, POLK_X, LARKIN_X, HYDE_X, LEAV_X, MASON_X];
const GRID_X0 = POLK_X - 240;
const GRID_Z = 3 * GRID_DZ + 70;
const LAND_Z = 700;
const LAND_X0 = -600;
const SEAWALL_T = 1.2;
const PROMENADE_X = SHORE_X - 5;
const MEDIAN: [number, number] = [EMB_X + 11, EMB_X + 15];
const PIER_HALF = 8;
/** Lombard's crooked block replaces the plain street between Hyde and Leavenworth. */
const CROOKED: [number, number] = [HYDE_X + RH, LEAV_X - RH];

/** City ground height (the hill is flat along z). */
const gy = (x: number): number => terrainY(Math.min(x, SHORE_X));
/** Where the houses stand (src/scene/victorian.ts): the Victorians on the hill itself, the background
 *  blocks on the city's ground. */
const HOUSE_SITE: HouseSite = { ground: (x) => terrainY(x) };
const BLOCK_SITE: HouseSite = { ground: (x) => gy(x) };

/**
 * A solid slab over [x0,x1]×[z0,z1] whose top follows `top(x)` up and down the hill.
 * UVs: top uses (z, x) / uvScale, sides (x or z, y) / uvScale.
 */
function slab(
  b: GeoBuilder,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  top: (x: number) => number,
  bottom: (x: number) => number,
  color: THREE.ColorRepresentation,
  uvScale = 1,
  sides = true,
): void {
  const xs = [x0, ...terrainBreaks(x0, x1), x1];
  const up: V3 = [0, 1, 0];
  for (let i = 0; i < xs.length - 1; i++) {
    const xa = xs[i];
    const xb = xs[i + 1];
    const ya = top(xa);
    const yb = top(xb);
    const sa = xa / uvScale;
    const sb = xb / uvScale;
    b.quad([xa, ya, z1], [xb, yb, z1], [xb, yb, z0], [xa, ya, z0], color, up, [
      [z1 / uvScale, sa],
      [z1 / uvScale, sb],
      [z0 / uvScale, sb],
      [z0 / uvScale, sa],
    ]);
    if (!sides) continue;
    const ba = bottom(xa);
    const bb = bottom(xb);
    for (const [z, f] of [
      [z1, 1],
      [z0, -1],
    ] as const) {
      b.quad([xa, ya, z], [xa, ba, z], [xb, bb, z], [xb, yb, z], color, [0, 0, f], [
        [sa, ya / uvScale],
        [sa, ba / uvScale],
        [sb, bb / uvScale],
        [sb, yb / uvScale],
      ]);
    }
  }
  if (!sides) return;
  for (const [x, f] of [
    [x0, -1],
    [x1, 1],
  ] as const) {
    const yt = top(x);
    const yb = bottom(x);
    b.quad([x, yt, z0], [x, yb, z0], [x, yb, z1], [x, yt, z1], color, [f, 0, 0], [
      [z0 / uvScale, yt / uvScale],
      [z0 / uvScale, yb / uvScale],
      [z1 / uvScale, yb / uvScale],
      [z1 / uvScale, yt / uvScale],
    ]);
  }
}

/** Course points between two arc lengths (every 0.5 m, inclusive), for strips that follow the road. */
function coursePts(s0: number, s1: number, step = 0.5): CoursePoint[] {
  const out: CoursePoint[] = [];
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  for (let i = 0; i <= n; i++) out.push(pointAt(C, s0 + ((s1 - s0) * i) / n));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Canvas textures.



function plankTexture(): THREE.CanvasTexture {
  // Tile: 4 m across the pier (u) × 2 m along it (v): 8 planks of 0.25 m running across the pier.
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const rng = makeRng(23);
      const n = 8;
      const ph = h / n;
      for (let i = 0; i < n; i++) {
        const base = 150 + rng() * 40;
        ctx.fillStyle = `rgb(${base + 35},${base - 10},${base - 55})`;
        ctx.fillRect(0, i * ph, w, ph);
        for (let k = 0; k < 26; k++) {
          const y = i * ph + 4 + rng() * (ph - 8);
          ctx.strokeStyle = `rgba(90,50,20,${0.08 + rng() * 0.12})`;
          ctx.lineWidth = 1 + rng() * 1.5;
          ctx.beginPath();
          ctx.moveTo(0, y);
          for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + k) * 1.5);
          ctx.stroke();
        }
        // plank seam
        ctx.fillStyle = 'rgba(55,30,15,0.8)';
        ctx.fillRect(0, i * ph, w, 3);
        // butt joint and nails
        const jx = rng() * w;
        ctx.fillRect(jx, i * ph, 3, ph);
        ctx.fillStyle = 'rgba(60,60,60,0.8)';
        for (const nx of [jx - 10, jx + 12, (jx + w / 2) % w]) {
          ctx.fillRect(nx, i * ph + 12, 4, 4);
          ctx.fillRect(nx, i * ph + ph - 16, 4, 4);
        }
      }
    },
    { repeat: [1, 1] },
  );
}







function brickTexture(): THREE.CanvasTexture {
  // Tile = 2 m × 2 m of red herringbone brick (Lombard's paving).
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#8e4a3c';
      ctx.fillRect(0, 0, w, h);
      const rng = makeRng(77);
      const bw = 64;
      const bh = 32;
      const colors = ['#b5523b', '#a84b36', '#c05c43', '#9e4633', '#b8604a', '#a5563f'];
      for (let row = -2; row < h / bh + 2; row++) {
        for (let col = -2; col < w / bh + 2; col++) {
          const x = col * bh * 2 + (row % 2) * bh;
          const y = row * bh;
          for (const [dx, dy, ww, hh] of [
            [0, 0, bw, bh],
            [bw, 0, bh, bw],
          ] as const) {
            ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
            ctx.fillRect(x + dx + 2, y + dy + 2, ww - 4, hh - 4);
          }
        }
      }
      for (let i = 0; i < 2500; i++) {
        ctx.fillStyle = `rgba(40,20,15,${0.05 + rng() * 0.1})`;
        ctx.fillRect(rng() * w, rng() * h, 2, 2);
      }
    },
    { repeat: [1, 1] },
  );
}

// ---------------------------------------------------------------------------------------------
// Background buildings, trees and palms.



function palm(b: GeoBuilder, x: number, y: number, z: number, h: number, rng: () => number): void {
  // Slightly curved trunk from stacked tapered segments.
  const lean = (rng() - 0.5) * 0.5;
  const leanZ = (rng() - 0.5) * 0.5;
  let px = x;
  let pz = z;
  let py = y;
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const t = (i + 1) / segs;
    const nx = x + lean * t * t * h * 0.3;
    const nz = z + leanZ * t * t * h * 0.3;
    const ny = y + h * t;
    cyl(b, [px, py, pz], [nx, ny, nz], 0.2 - 0.02 * (i + 1), 0.22 - 0.02 * i, 7, i % 2 ? '#8a6f52' : '#7b624a');
    px = nx;
    py = ny;
    pz = nz;
  }
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rng() * 0.3;
    const g = new THREE.ConeGeometry(0.42, 3.4, 4);
    g.scale(1, 1, 0.22);
    g.translate(0, 1.7, 0);
    // Tip outwards and droop.
    _m4.compose(
      _v.set(px, py, pz),
      _q.setFromEuler(_e.set(0, a, -(Math.PI / 2) * (0.62 + rng() * 0.25), 'YXZ')),
      _s.set(1, 1, 1),
    );
    b.add(g, i % 2 ? '#3f9f4a' : '#52b457', _m4);
  }
  const nut = new THREE.IcosahedronGeometry(0.35, 0);
  nut.translate(px, py - 0.1, pz);
  b.add(nut, '#6b5a3a');
}


// ---------------------------------------------------------------------------------------------
// The grid: blocks between the streets, each ringed by a sidewalk, with houses facing out.

interface Block {
  /** Kerb lines (the sidewalk ring sits inside them). */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Sides without a sidewalk ring (Lombard's stairs are drawn with the crooked block). */
  noWalk: Set<'n' | 's' | 'e' | 'w'>;
}

function gridBlocks(): Block[] {
  const cols: [number, number][] = [[GRID_X0, Z_STREETS[0] - RH]];
  for (let i = 0; i < Z_STREETS.length - 1; i++) cols.push([Z_STREETS[i] + RH, Z_STREETS[i + 1] - RH]);
  cols.push([Z_STREETS[Z_STREETS.length - 1] + RH, EMB_X]);
  const rows: [number, number][] = [[-GRID_Z, X_STREETS[0] - RH]];
  for (let i = 0; i < X_STREETS.length - 1; i++) rows.push([X_STREETS[i] + RH, X_STREETS[i + 1] - RH]);
  rows.push([X_STREETS[X_STREETS.length - 1] + RH, GRID_Z]);
  const out: Block[] = [];
  for (const [x0, x1] of cols) {
    for (let [z0, z1] of rows) {
      const noWalk = new Set<'n' | 's' | 'e' | 'w'>();
      const crooked = Math.abs(x0 - CROOKED[0]) < 0.01 && Math.abs(x1 - CROOKED[1]) < 0.01;
      if (crooked && Math.abs(z1 + RH) < 0.01) {
        z1 = -BAND;
        noWalk.add('n');
      }
      if (crooked && Math.abs(z0 - RH) < 0.01) {
        z0 = BAND;
        noWalk.add('s');
      }
      // No sidewalk facing the Embarcadero or the open ends of the grid.
      if (Math.abs(x1 - EMB_X) < 0.01) noWalk.add('e');
      if (Math.abs(x0 - GRID_X0) < 0.01) noWalk.add('w');
      if (Math.abs(z0 + GRID_Z) < 0.01) noWalk.add('s');
      if (Math.abs(z1 - GRID_Z) < 0.01) noWalk.add('n');
      out.push({ x0, x1, z0, z1, noWalk });
    }
  }
  return out;
}

/** Is this block side on the race course (it gets the detailed Victorian houses)? */
function onCourse(b: Block, side: 'n' | 's' | 'e' | 'w'): boolean {
  const overlapX = (a: number, c: number): boolean => b.x1 > a && b.x0 < c;
  const overlapZ = (a: number, c: number): boolean => b.z1 > a && b.z0 < c;
  if (side === 'n' || side === 's') {
    const street = side === 'n' ? b.z1 + RH : b.z0 - RH;
    const edge = side === 'n' ? b.z1 : b.z0;
    // Greenwich from just behind the start to Hyde.
    if (Math.abs(street - GREENWICH_Z) < 0.01 && overlapX(START.xMin - 30, HYDE_X)) return true;
    // Lombard's crooked block and on down to the Embarcadero.
    if (Math.abs(Math.abs(edge) - BAND) < 0.01 && overlapX(CROOKED[0], CROOKED[1])) return true;
    if (Math.abs(street) < 0.01 && overlapX(LEAV_X, EMB_X)) return true;
    return false;
  }
  const street = side === 'e' ? b.x1 + RH : b.x0 - RH;
  return Math.abs(street - HYDE_X) < 0.01 && overlapZ(GREENWICH_Z, 0);
}

// ---------------------------------------------------------------------------------------------
// Street furniture (the sawhorse barricades are props.ts's, shared with Old Stomping Grounds).


// ---------------------------------------------------------------------------------------------
// Main build.

export function buildCity(): City {
  const group = new THREE.Group();
  group.name = 'city';
  const rng = makeRng(1906);

  // Materials.
  const asphaltTex = asphaltTexture();
  const asphaltMat = new THREE.MeshStandardMaterial({ map: asphaltTex, vertexColors: true, roughness: 0.93, metalness: 0 });
  const markingMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const concreteMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.46 });
  const trimMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#27405e', roughness: 0.1, metalness: 0.55 });
  const facadeMat = new THREE.MeshStandardMaterial({ map: facadeTexture(), vertexColors: true, roughness: 0.7 });
  const foliageMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, flatShading: true });
  const metalMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.75, roughness: 0.3 });
  const woodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const plankMat = new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.8 });
  const coneMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const brickMat = new THREE.MeshStandardMaterial({
    map: brickTexture(),
    roughness: 0.82,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const hedgeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const gardenMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const barricadeMat = new THREE.MeshStandardMaterial({ map: barricadeTexture(), roughness: 0.55 });

  const asphalt = new GeoBuilder();
  const marks = new GeoBuilder();
  const concrete = new GeoBuilder();
  const houses: HouseSinks = { walls: new GeoBuilder(), trim: new GeoBuilder(), glass: new GeoBuilder() };
  const facades = new GeoBuilder();
  const foliage = new GeoBuilder();
  const metal = new GeoBuilder();
  const wood = new GeoBuilder();
  const planks = new GeoBuilder();
  const cones = new GeoBuilder();
  const brick = new GeoBuilder();
  const hedge = new GeoBuilder();
  const garden = new GeoBuilder();
  const boards = new GeoBuilder();
  const crowdSpots: Spot[] = [];

  const ASPHALT = '#ffffff';
  const WHITE = '#f5f5ef';
  const YELLOW = '#f5c431';
  const road = (x: number): number => gy(x);
  const walkTop = (x: number): number => gy(x) + CURB;
  const deep = (x: number): number => gy(x) - 0.9;

  // --- Land, seawall and waterfront ------------------------------------------------------------
  // The land, with Lombard's block cut out: its gardens and bricks follow the switchbacks down, not
  // the hill's average slope, and the land would poke up through them in places.
  const land = (x0: number, x1: number, z0: number, z1: number): void =>
    slab(concrete, x0, x1, z0, z1, (x) => gy(x) - 0.4, () => -3, '#9fc27d', 8);
  land(LAND_X0, LOMBARD_X0, -LAND_Z, LAND_Z);
  land(LOMBARD_X1, SHORE_X - SEAWALL_T, -LAND_Z, LAND_Z);
  land(LOMBARD_X0, LOMBARD_X1, BAND, LAND_Z);
  land(LOMBARD_X0, LOMBARD_X1, -LAND_Z, -BAND);
  slab(concrete, SHORE_X - SEAWALL_T, SHORE_X, -LAND_Z, LAND_Z, () => DECK_Y - 0.02, () => -3, '#cfc6b5', 4);
  // Algae line and a coping lip along the seawall.
  box(concrete, SHORE_X, SHORE_X + 0.03, -0.35, 0.55, -LAND_Z, LAND_Z, '#5f6b58');
  box(concrete, SHORE_X - 0.1, SHORE_X + 0.25, DECK_Y - 0.28, DECK_Y - 0.008, -LAND_Z, LAND_Z, '#e3dccd');

  // --- Streets: the x-streets run down the hill, the z-streets run across it (flat) -----------------
  X_STREETS.forEach((zc) => {
    const spans: [number, number][] = zc === 0 ? [[GRID_X0, CROOKED[0]], [CROOKED[1], EMB_X]] : [[GRID_X0, EMB_X]];
    for (const [xa, xb] of spans) slab(asphalt, xa, xb, zc - RH, zc + RH, road, deep, ASPHALT, 6);
  });
  Z_STREETS.forEach((xc) => {
    const zs = [-GRID_Z, ...X_STREETS.flatMap((z) => [z - RH, z + RH]), GRID_Z];
    for (let i = 0; i < zs.length; i += 2) {
      let za = zs[i];
      let zb = zs[i + 1];
      // The Lombard band meets Hyde St and Leavenworth St: the street runs up to the band's kerb.
      if (za >= zb) continue;
      slab(asphalt, xc - RH, xc + RH, za, zb, road, deep, ASPHALT, 6);
      void za;
      void zb;
    }
  });

  // --- Sidewalks ring every block ------------------------------------------------------------------
  const blocks = gridBlocks();
  for (const b of blocks) {
    const { x0, x1, z0, z1 } = b;
    if (!b.noWalk.has('n')) slab(concrete, x0, x1, z1 - WALK, z1, walkTop, deep, CONCRETE, 4);
    if (!b.noWalk.has('s')) slab(concrete, x0, x1, z0, z0 + WALK, walkTop, deep, CONCRETE, 4);
    const za = b.noWalk.has('s') ? z0 : z0 + WALK;
    const zb = b.noWalk.has('n') ? z1 : z1 - WALK;
    if (!b.noWalk.has('w')) slab(concrete, x0, x0 + WALK, za, zb, walkTop, deep, CONCRETE, 4);
    if (!b.noWalk.has('e')) slab(concrete, x1 - WALK, x1, za, zb, walkTop, deep, CONCRETE, 4);
  }

  // --- Road markings -------------------------------------------------------------------------------
  const markTop = (x: number): number => gy(x) + 0.012;
  const clear = (x: number): boolean => Z_STREETS.some((xc) => Math.abs(x - xc) < RH + 4);
  X_STREETS.forEach((zc) => {
    let xa = GRID_X0 + 2;
    for (let x = GRID_X0 + 2; x <= EMB_X - 2; x += 1) {
      const skip = clear(x) || (zc === 0 && x > CROOKED[0] - 2 && x < CROOKED[1] + 2) || x > EMB_X - 5;
      if (skip || x >= EMB_X - 2.5) {
        if (x - xa > 3) {
          for (const dz of [-0.2, 0.2]) slab(marks, xa, x, zc + dz - 0.07, zc + dz + 0.07, markTop, markTop, YELLOW, 1, false);
          const courseStreet = (zc === GREENWICH_Z && xa < HYDE_X) || (zc === 0 && xa > CROOKED[1]);
          if (courseStreet) for (const dz of [-6.35, 6.35]) slab(marks, xa, x, zc + dz - 0.08, zc + dz + 0.08, markTop, markTop, WHITE, 1, false);
        }
        xa = x + 1;
      }
    }
  });
  Z_STREETS.forEach((xc) => {
    if ([HYDE_X, LARKIN_X, LEAV_X, MASON_X].includes(xc)) return; // cable-car tracks run down the middle
    const zs = [-GRID_Z, ...X_STREETS.flatMap((z) => [z - RH, z + RH]), GRID_Z];
    for (let i = 0; i < zs.length; i += 2) {
      const za = zs[i] + 4;
      const zb = zs[i + 1] - 4;
      if (zb - za < 3) continue;
      for (const dx of [-0.2, 0.2]) slab(marks, xc + dx - 0.07, xc + dx + 0.07, za, zb, markTop, markTop, YELLOW, 1, false);
    }
  });
  // Continental crosswalks across the course at every intersection it crosses.
  for (const cw of C.crosswalks) {
    const pts = coursePts(cw.s0, cw.s1, 0.5);
    for (let d = -6.3; d < 6.3; d += 1.25) strip(marks, pts, d, d + 0.62, (i) => pts[i].y + 0.012, WHITE);
  }

  // --- Cable-car lines: along Hyde St, and across the course at Larkin, Leavenworth and Mason ------------
  for (const xc of [HYDE_X, LARKIN_X, LEAV_X, MASON_X]) {
    const zs = [-GRID_Z, GRID_Z];
    const y = gy(xc);
    slab(concrete, xc - 1.0, xc + 1.0, zs[0], zs[1], (x) => gy(x) + 0.025, deep, '#c9c4b8', 4, false);
    for (const dx of [-0.535, 0.535]) box(metal, xc + dx - 0.045, xc + dx + 0.045, y - 0.05, y + 0.07, zs[0], zs[1], '#e6e9ee');
    box(marks, xc - 0.03, xc + 0.03, y + 0.027, y + 0.04, zs[0], zs[1], '#1a1a1d');
    for (let z = zs[0] + 5; z < zs[1]; z += 18) box(marks, xc - 0.28, xc + 0.28, y + 0.027, y + 0.04, z, z + 0.56, '#6c6e73');
  }

  // --- Race furniture: barriers and crowds along the course, barricades across side streets -------
  const courseSecs = SECS.filter((s) => s.kind === 'start' || s.kind === 'block' || s.kind === 'hyde');
  for (const sec of courseSecs) {
    const s0 = sec.s0 + (sec.kind === 'start' ? 0.5 : 0.6);
    const s1 = sec.s1 - 0.6;
    const n = Math.max(1, Math.round((s1 - s0) / 2.4));
    for (const side of [1, -1]) {
      const d = side * (RH + 0.45);
      for (let i = 0; i < n; i++) {
        const a = pointAt(C, s0 + ((s1 - s0) * i) / n);
        const c = pointAt(C, s0 + ((s1 - s0) * (i + 1)) / n);
        const ax = a.x - a.tz * d;
        const az = a.z + a.tx * d;
        const cx = c.x - c.tz * d;
        const cz = c.z + c.tx * d;
        barrierPanel(metal, ax, az, cx, cz, walkTop(ax), walkTop(cx));
      }
      // The crowd, two deep in places.
      for (let s = s0 + rng() * 2; s < s1; s += 1.1 + rng() * 1.8) {
        if (rng() < 0.18) continue;
        const dd = side * (RH + 1.2 + rng() * 1.3);
        const p = pointAt(C, s);
        const x = p.x - p.tz * dd;
        const z = p.z + p.tx * dd;
        crowdSpots.push({ x, y: walkTop(x), z, face: p.heading - side * Math.PI / 2 + (rng() - 0.5) * 0.8 });
      }
    }
  }
  // Barricades where the course crosses a street, and behind the start.
  for (const sec of INTS) {
    for (const side of [1, -1]) {
      const d = side * (RH + 0.8);
      for (let s = sec.s0 + 1.1; s < sec.s1 - 0.6; s += 2.3) {
        const p = pointAt(C, s);
        const x = p.x - p.tz * d;
        const z = p.z + p.tx * d;
        barricade(boards, metal, x, gy(x), z, -p.heading);
      }
      for (let k = 0; k < 9; k++) {
        const s = sec.s0 + 1 + rng() * (sec.s1 - sec.s0 - 2);
        const dd = side * (RH + 2 + rng() * 5);
        const p = pointAt(C, s);
        const x = p.x - p.tz * dd;
        const z = p.z + p.tx * dd;
        crowdSpots.push({ x, y: gy(x), z, face: p.heading - side * Math.PI / 2 + (rng() - 0.5) * 0.6 });
      }
    }
  }
  {
    const p = pointAt(C, 0);
    for (let d = -RH + 1.1; d < RH; d += 2.3) {
      barricade(boards, metal, p.x - 0.6, gy(p.x), p.z + d, Math.PI / 2);
    }
  }
  // Tyre walls round the outside of the Hyde St corners.
  const tyreSpots: TyreSpot[] = [];
  for (const sec of SECS.filter((s) => s.kind === 'corner')) {
    let i = 0;
    for (let s = sec.s0 - 1; s <= sec.s1 + 1; s += 0.72) {
      const p = pointAt(C, s);
      const side = p.curv > 0 || (s < sec.s0 + 0.01 && pointAt(C, sec.s0 + 1).curv > 0) ? -1 : 1;
      const d = side * (RH + 0.45);
      const x = p.x - p.tz * d;
      const z = p.z + p.tx * d;
      tyreSpots.push({ x, y: gy(x), z, i: i++ });
    }
    // Fans in the corner, behind the tyres.
    for (let k = 0; k < 16; k++) {
      const s = sec.s0 + rng() * (sec.s1 - sec.s0);
      const p = pointAt(C, s);
      const side = p.curv > 0 ? -1 : 1;
      const dd = side * (RH + 2.2 + rng() * 4);
      const x = p.x - p.tz * dd;
      const z = p.z + p.tx * dd;
      crowdSpots.push({ x, y: gy(x), z, face: p.heading - side * Math.PI / 2 });
    }
  }

  // --- Street signs at the corners the course passes ----------------------------------------------
  {
    const names = ['LARKIN ST', 'HYDE ST', 'LEAVENWORTH ST', 'MASON ST', 'GREENWICH ST', 'LOMBARD ST'];
    const plates = new GeoBuilder();
    const put = (x: number, z: number, row: number, alongZ: boolean, row2: number): void => {
      const y = gy(x) + CURB;
      cyl(metal, [x, y, z], [x, y + 3.6, z], 0.06, 0.07, 8, '#1f4a3a');
      const a = namePlate(row, names.length, alongZ);
      a.translate(x, y + 3.25, z);
      plates.add(a, '#ffffff');
      const b = namePlate(row2, names.length, !alongZ);
      b.translate(x, y + 3.62, z);
      plates.add(b, '#ffffff');
    };
    // Cross-street names face the approaching racers.
    put(LARKIN_X - RH - 1.2, GREENWICH_Z + RH + 1.0, 0, true, 4);
    put(LARKIN_X - RH - 1.2, GREENWICH_Z - RH - 1.0, 0, true, 4);
    put(HYDE_X - RH - 1.2, GREENWICH_Z + RH + 1.0, 1, true, 4);
    put(HYDE_X - RH - 1.0, -RH - 1.2, 5, false, 1);
    put(LEAV_X - RH - 1.2, RH + 1.0, 2, true, 5);
    put(LEAV_X - RH - 1.2, -RH - 1.0, 2, true, 5);
    put(MASON_X - RH - 1.2, RH + 1.0, 3, true, 5);
    put(MASON_X - RH - 1.2, -RH - 1.0, 3, true, 5);
    group.add(meshOf(plates, new THREE.MeshStandardMaterial({ map: namesTexture(names), roughness: 0.45 }), 'streetSigns', true, false));
  }


  // --- Houses: Victorians facing the course, simpler blocks everywhere else ------------------------
  for (const b of blocks) {
    const sides = (['s', 'n', 'e', 'w'] as const).map((side) => ({ side, course: onCourse(b, side) }));
    const walkOf = (side: 'n' | 's' | 'e' | 'w'): number => (b.noWalk.has(side) ? (side === 'n' || side === 's') && Math.abs(Math.abs(side === 'n' ? b.z1 : b.z0) - BAND) < 0.01 ? LOMBARD_WALK : 0 : WALK);
    const lx0 = b.x0 + walkOf('w');
    const lx1 = b.x1 - walkOf('e');
    const lz0 = b.z0 + walkOf('s');
    const lz1 = b.z1 - walkOf('n');
    if (lx1 - lx0 < 8 || lz1 - lz0 < 8) continue;
    // Far from the course, the city is just a backdrop.
    const far = Math.min(Math.abs(b.z0 + b.z1) / 2 - Math.abs(GREENWICH_Z) / 2, 1e9) > 150 || b.x1 < START.xMin - 120;
    const depthOf = (course: boolean): number => (course ? HOUSE_DEPTH : 10 + rng() * 5);
    const nsDepth = { n: 0, s: 0 };
    for (const { side, course } of sides) {
      if (side !== 'n' && side !== 's') continue;
      const D = depthOf(course);
      nsDepth[side] = D;
      const lot = side === 's' ? { ox: lx0, oz: lz0, ux: 1, uz: 0, len: lx1 - lx0 } : { ox: lx1, oz: lz1, ux: -1, uz: 0, len: lx1 - lx0 };
      if (course) rowHouses(houses, lot, rng, HOUSE_SITE);
      else if (!far || rng() < 0.9) rowBlocks(facades, houses.walls, lot, D, rng, BLOCK_SITE);
    }
    for (const { side, course } of sides) {
      if (side !== 'e' && side !== 'w') continue;
      const D = depthOf(course);
      const za = lz0 + nsDepth.s;
      const zb = lz1 - nsDepth.n;
      if (zb - za < 6) continue;
      const lot = side === 'e' ? { ox: lx1, oz: za, ux: 0, uz: 1, len: zb - za } : { ox: lx0, oz: zb, ux: 0, uz: -1, len: zb - za };
      if (course) rowHouses(houses, lot, rng, HOUSE_SITE);
      else rowBlocks(facades, houses.walls, lot, D, rng, BLOCK_SITE);
    }
    // Backyard trees.
    const inner = { x0: lx0 + HOUSE_DEPTH + 2, x1: lx1 - HOUSE_DEPTH - 2, z0: lz0 + HOUSE_DEPTH + 2, z1: lz1 - HOUSE_DEPTH - 2 };
    if (!far && inner.x1 > inner.x0 && inner.z1 > inner.z0) {
      const n = Math.floor(((inner.x1 - inner.x0) * (inner.z1 - inner.z0)) / 120);
      for (let i = 0; i < Math.min(n, 8); i++) {
        const x = inner.x0 + rng() * (inner.x1 - inner.x0);
        const z = inner.z0 + rng() * (inner.z1 - inner.z0);
        tree(foliage, x, gy(x) - 0.4, z, 1.0 + rng() * 0.8, rng);
      }
    }
  }

  // --- Lombard St's crooked block -------------------------------------------------------------------
  buildLombard({ brick, hedge, garden, flowers: hedge, concrete, metal }, rng);
  {
    // "The crookedest street" sign at the top of the block.
    const x = LOMBARD_X0 + 1.5;
    const z = -BAND - 1.2;
    const y = gy(x) + CURB;
    cyl(metal, [x, y, z], [x, y + 3.2, z], 0.07, 0.08, 8, '#1f4a3a');
    const tex = namesTexture(['LOMBARD ST', 'CROOKEDEST STREET'], '#8a2d2d');
    const plates = new GeoBuilder();
    const a = namePlate(0, 2, true, 2.2);
    a.translate(x, y + 3.0, z);
    plates.add(a, '#ffffff');
    const b2 = namePlate(1, 2, true, 2.2);
    b2.translate(x, y + 2.62, z);
    plates.add(b2, '#ffffff');
    group.add(meshOf(plates, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }), 'lombardSign', true, false));
    void LOMBARD_X1;
  }

  // --- The Embarcadero: two carriageways, a palm median (with a gap for our road) and the promenade.
  slab(asphalt, EMB_X, MEDIAN[0], -LAND_Z, LAND_Z, road, deep, ASPHALT, 6);
  slab(asphalt, MEDIAN[1], PROMENADE_X, -LAND_Z, LAND_Z, road, deep, ASPHALT, 6);
  slab(asphalt, MEDIAN[0], MEDIAN[1], -9, 9, road, deep, ASPHALT, 6);
  for (const sgn of [1, -1]) {
    const z0 = sgn > 0 ? 9 : -LAND_Z;
    const z1 = sgn > 0 ? LAND_Z : -9;
    slab(concrete, MEDIAN[0], MEDIAN[1], z0, z1, () => DECK_Y + 0.25, deep, '#d8d1c2', 4);
    slab(concrete, MEDIAN[0] + 0.4, MEDIAN[1] - 0.4, z0 + (sgn > 0 ? 0.4 : 0), z1 - (sgn > 0 ? 0 : 0.4), () => DECK_Y + 0.33, deep, '#78b35a', 4, false);
  }
  slab(concrete, PROMENADE_X, SHORE_X - SEAWALL_T, -LAND_Z, LAND_Z, () => DECK_Y, deep, '#e6dfd1', 4);
  for (const x of [EMB_X + 5.5, MEDIAN[1] + 5]) {
    for (let z = -LAND_Z; z < LAND_Z; z += 9) {
      if (Math.abs(z + 1.5) < 10) continue;
      slab(marks, x - 0.08, x + 0.08, z, z + 3, markTop, markTop, WHITE, 1, false);
    }
  }

  // --- Embarcadero palms, lamps and waterfront railing -----------------------------------------
  const medX = (MEDIAN[0] + MEDIAN[1]) / 2;
  for (const sgn of [1, -1]) {
    for (let z = 16; z < 420; z += 13) {
      palm(foliage, medX + (rng() - 0.5) * 0.6, DECK_Y + 0.33, sgn * z, 8 + rng() * 3, rng);
    }
    for (let z = 12; z < 420; z += 24) {
      for (const x of [EMB_X + 1.2, PROMENADE_X + 1.2]) {
        const zz = sgn * z;
        cyl(metal, [x, DECK_Y, zz], [x, DECK_Y + 6, zz], 0.08, 0.12, 8, '#23443a');
        cyl(metal, [x, DECK_Y + 6, zz], [x + (x < medX ? 0.9 : -0.9), DECK_Y + 6.3, zz], 0.05, 0.05, 6, '#23443a');
        const lamp = new THREE.SphereGeometry(0.26, 12, 8);
        lamp.translate(x + (x < medX ? 0.95 : -0.95), DECK_Y + 6.15, zz);
        metal.add(lamp, '#fff4cf');
      }
    }
    // Railing along the waterfront (gap at the pier entrance).
    const r0 = sgn > 0 ? 9.5 : -LAND_Z;
    const r1 = sgn > 0 ? LAND_Z : -9.5;
    const rx = SHORE_X - 0.35;
    box(metal, rx - 0.05, rx + 0.05, DECK_Y + 1.0, DECK_Y + 1.1, r0, r1, '#2e3b44');
    box(metal, rx - 0.03, rx + 0.03, DECK_Y + 0.55, DECK_Y + 0.6, r0, r1, '#2e3b44');
    for (let z = r0; z <= r1; z += 2.5) box(metal, rx - 0.05, rx + 0.05, DECK_Y, DECK_Y + 1.1, z - 0.05, z + 0.05, '#2e3b44');
  }

  // --- Pier ---------------------------------------------------------------------------------------
  const pierX0 = SHORE_X;
  const pierX1 = LIP.x;
  {
    const deckGeo = new THREE.BoxGeometry(pierX1 - pierX0, 0.45, 2 * PIER_HALF);
    deckGeo.translate((pierX0 + pierX1) / 2, DECK_Y - 0.225, 0);
    // Planks run across the pier: u = z / 4 m, v = x / 2 m.
    const p = deckGeo.getAttribute('position');
    const uv = deckGeo.getAttribute('uv');
    const n = deckGeo.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, p.getZ(i) / 4, p.getX(i) / 2);
      else if (Math.abs(n.getZ(i)) > 0.5) uv.setXY(i, p.getX(i) / 4, p.getY(i) / 2);
      else uv.setXY(i, p.getZ(i) / 4, p.getY(i) / 2);
    }
    planks.add(deckGeo, '#ffffff');
  }
  // Fascia boards along the deck edges.
  for (const z of [-PIER_HALF, PIER_HALF]) {
    box(wood, pierX0, pierX1, DECK_Y - 0.75, DECK_Y - 0.05, z - 0.12, z + 0.12, DARK_WOOD);
  }
  // Pilings and cap beams.
  for (let x = pierX0 + 1.5; x <= pierX1 - 0.3; x += 4) {
    for (const z of [-7.4, -2.5, 2.5, 7.4]) {
      const jx = (rng() - 0.5) * 0.25;
      const jz = (rng() - 0.5) * 0.25;
      cyl(wood, [x + jx, -4.5, z + jz], [x + jx * 0.3, DECK_Y - 0.4, z + jz * 0.3], 0.26, 0.3, 10, rng() < 0.5 ? '#4f3d2d' : '#5c4834');
    }
    box(wood, x - 0.2, x + 0.2, DECK_Y - 0.8, DECK_Y - 0.44, -PIER_HALF + 0.2, PIER_HALF - 0.2, '#4a3828');
  }
  // Diagonal cross bracing between pilings (seen from the side camera).
  for (let x = pierX0 + 1.5; x < pierX1 - 4.3; x += 4) {
    for (const z of [-7.5, 7.5]) {
      obox(wood, [x + 2, 1.2, z], [Math.hypot(4, 3.6), 0.18, 0.12], [0, 0, Math.atan2(3.6, 4) * (Math.floor(x) % 8 < 4 ? 1 : -1)], '#4a3828');
    }
  }
  // Bollards along the edges, clear of the kicker.
  for (let x = pierX0 + 3; x < KICK_X - 1; x += 7) {
    for (const z of [-PIER_HALF + 0.35, PIER_HALF - 0.35]) {
      cyl(metal, [x, DECK_Y, z], [x, DECK_Y + 0.55, z], 0.17, 0.2, 12, '#2b2f36');
      const cap = new THREE.SphereGeometry(0.19, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      cap.translate(x, DECK_Y + 0.55, z);
      metal.add(cap, '#2b2f36');
    }
  }
  // A life ring on a post near the pier entrance.
  {
    const x = pierX0 + 6.5;
    const z = -PIER_HALF + 0.4;
    box(wood, x - 0.1, x + 0.1, DECK_Y, DECK_Y + 1.6, z - 0.1, z + 0.1, DARK_WOOD);
    const ring = new THREE.TorusGeometry(0.42, 0.11, 8, 20);
    ring.translate(x, DECK_Y + 1.05, z + 0.2);
    cones.add(ring, '#ff5a2a');
  }

  // (The kicker at the end of the pier is shared with every lip: src/scene/kicker.ts.)
  const kx0 = KICK_X;

  // --- Traffic cones --------------------------------------------------------------------------------
  const cone = (x: number, y: number, z: number): void => {
    box(cones, x - 0.24, x + 0.24, y, y + 0.06, z - 0.24, z + 0.24, '#e8541c');
    cyl(cones, [x, y + 0.06, z], [x, y + 0.82, z], 0.012, 0.19, 16, '#ff6a1f');
    cyl(cones, [x, y + 0.36, z], [x, y + 0.5, z], 0.11, 0.135, 16, '#fbfbf7');
    cyl(cones, [x, y + 0.6, z], [x, y + 0.68, z], 0.07, 0.085, 16, '#fbfbf7');
  };
  for (let x = pierX0 + 4.5; x < KICK_X - 0.5; x += 3.2) {
    cone(x, DECK_Y, -PIER_HALF + 0.95);
    cone(x, DECK_Y, PIER_HALF - 0.95);
  }
  for (const x of [kx0 + 1.5, kx0 + 5, kx0 + 8.5]) {
    cone(x, DECK_Y, -PIER_HALF + 0.55);
    cone(x, DECK_Y, PIER_HALF - 0.55);
  }
  // A few cones at the pier entrance on the promenade.
  for (const z of [-9.4, -8.6, 8.6, 9.4]) cone(SHORE_X - 2.2, DECK_Y, z);

  // --- A cable car waiting on Mason St (the Powell-Hyde one runs up Hyde St in the race).
  const signMat = new THREE.MeshStandardMaterial({ map: signTexture('POWELL & MASON', '#1d1d22', '#f6e7b8'), roughness: 0.5 });
  const parked = buildCableCar(signMat, glassMat);
  parked.position.set(MASON_X, gy(MASON_X) + 0.07, 34);
  parked.rotation.y = -Math.PI / 2;
  group.add(parked);

  // --- The crowd ---------------------------------------------------------------------------------------
  const crowd = new Crowd(crowdSpots, rng);
  group.add(crowd.group);
  group.add(tyreWall(tyreSpots));

  // --- Assemble --------------------------------------------------------------------------------------
  group.add(meshOf(concrete, concreteMat, 'concrete', false, true));
  group.add(meshOf(asphalt, asphaltMat, 'asphalt', false, true));
  group.add(meshOf(marks, markingMat, 'markings', false, true));
  group.add(meshOf(houses.walls, wallMat, 'houseWalls', true, true));
  group.add(meshOf(houses.trim, trimMat, 'houseTrim', true, true));
  group.add(meshOf(houses.glass, glassMat, 'houseGlass', false, true));
  group.add(meshOf(facades, facadeMat, 'backgroundBuildings', true, true));
  group.add(meshOf(foliage, foliageMat, 'foliage', true, true));
  group.add(meshOf(metal, metalMat, 'metal', true, true));
  group.add(meshOf(wood, woodMat, 'pierTimber', true, true));
  group.add(meshOf(planks, plankMat, 'pierDeck', true, true));
  group.add(meshOf(cones, coneMat, 'cones', true, true));
  group.add(meshOf(brick, brickMat, 'lombardBrick', false, true));
  group.add(meshOf(hedge, hedgeMat, 'hedges', true, true));
  group.add(meshOf(garden, gardenMat, 'lombardGarden', false, true));
  group.add(meshOf(boards, barricadeMat, 'barricades', true, true));

  const update = (dt: number, t: number, cars: { x: number; z: number }[] = []): void => {
    crowd.update(dt, t, cars);
  };

  return { group, update };
}

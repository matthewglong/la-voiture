// Old Stomping Grounds' scenery: the Haight, Alamo Square, Hayes Valley, Duboce and Buena Vista
// round the lap race. The ground follows the course (Alamo Square's own surveyed hill in the park),
// the streets bring their sidewalks, cross streets, signs, lamps and wires (streets.ts), each
// neighbourhood brings its landmarks and parks (alamo.ts, hayes.ts, duboce.ts, buenaVista.ts,
// haight.ts), and pastel Victorians fill every frontage that's left (victorian.ts, shared with
// Russian Hill), with plainer blocks behind them and the city, Twin Peaks and downtown beyond.
// Procedural, and merged by material to keep draw calls low. (The start line and the gantry are
// shared with every map: src/scene/maps.ts adds them from the course.)
import * as THREE from 'three';
import { ALAMO_PARK } from '../../maps/data/alamoSquare';
import { ALAMO_OPEN, ALAMO_SCALE, DUBOCE_OPEN, N_JUDAH, OLD_STOMPING_GROUNDS } from '../../maps/oldStompingGrounds';
import type { OpenGround } from '../../openGround';
import { pointAt } from '../../track';
import { meshOf } from '../geo';
import type { VenueScene } from '../maps';
import { asphaltTexture } from '../props';
import { CourseIndex, buildHeightfield, cachedField, courseGround, gridAxis, inPolygon } from '../terrain';
import { makeRng, smoothstep } from '../util';
import { buildHouse, facadeTexture, type Frontage } from '../victorian';
import { alamoStreets, buildAlamo } from './alamo';
import { buildBuenaVista } from './buenaVista';
import { bvGardenPlan } from './buenaVista/terraces';
import { Occupancy, TWIN_PEAKS_SUMMITS, chunkOf, makeSinks, markOf, type Ctx } from './context';
import { buildDistance } from './distance';
import { buildDuboce } from './duboce';
import { buildFurniture } from './furniture';
import { buildHaight } from './haight';
import { panhandleBounds } from './haight/panhandle';
import { buildHayes } from './hayes';
import { BANK, GRASS_TILE, grassTexture, lawnTone, woodsTone } from './lawn';
import { sidewalkTexture } from './paving';
import { buildTufts, roughGround, roughTone, roughWeight } from './rough';
import { BV_KINDS, CORNER, PARK_KINDS, WALK, armInOpen, buildRoad, buildStreets, streetArms, type Arm } from './streets';

const C = OLD_STOMPING_GROUNDS;

// ---------------------------------------------------------------------------------------------
// Parks and the ground

/** A patch of park: what it is and whether a point's in it. */
export interface Park {
  kind: 'lawn' | 'woods';
  contains(x: number, z: number): boolean;
}

/** The parks, in the world: Alamo Square (its surveyed boundary), Patricia's Green, Duboce Park,
 *  Buena Vista's woods and the Panhandle along Oak. */
export function parks(idx: CourseIndex): Park[] {
  const alamo = alamoBoundary();
  const near = (s0: number, s1: number, r: number) => (x: number, z: number): boolean => {
    const n = idx.nearest(x, z, r);
    if (!n) return false;
    const s = idx.ss[n.i];
    return s >= s0 && s <= s1;
  };
  const green = near(markOf('green', 'green'), markOf('green', 'fell'), 10.5);
  const duboce = (x: number, z: number): boolean => DUBOCE_OPEN.contains(x, z);
  const bv = near(markOf('buenaVista', 'in') - 4, markOf('buenaVista', 'out') + 2, 34);
  // The Panhandle: north of Oak St's sidewalk, from well west of Ashbury (it carries on past the
  // corner, as it does) to short of Scott; the same rectangle haight/panhandle.ts lays it out in.
  const pb = panhandleBounds(C, chunkOf);
  const panhandle = (x: number, z: number): boolean => !!pb && x > pb.xWest && x < pb.xEast && z < pb.zNear && z > pb.zFar;
  const ax0 = Math.min(...alamo.map((p) => p[0]));
  const ax1 = Math.max(...alamo.map((p) => p[0]));
  const az0 = Math.min(...alamo.map((p) => p[1]));
  const az1 = Math.max(...alamo.map((p) => p[1]));
  return [
    { kind: 'lawn', contains: (x, z) => x > ax0 && x < ax1 && z > az0 && z < az1 && inPolygon(alamo, x, z) },
    { kind: 'lawn', contains: green },
    { kind: 'lawn', contains: duboce },
    { kind: 'woods', contains: bv },
    { kind: 'lawn', contains: panhandle },
  ];
}

/** How far the ground takes to ease from a graded arm back to the land about it (m). */
const GRADE_EASE = 10;

/** The ground graded under `arms` (a little under their height, as under the road; level, or
 *  climbing from one end to the other), easing back to the land over GRADE_EASE beyond their
 *  sidewalks. */
export function gradeUnder(arms: Arm[]): (x: number, z: number, y: number) => number {
  const q = arms.map((a) => ({ ...a, c: Math.cos(a.h), s: Math.sin(a.h), w: a.road + WALK + 1, r: a.u1 + a.road + WALK + GRADE_EASE + 2 }));
  return (x, z, y) => {
    let best = 0;
    let to = y;
    for (const a of q) {
      const dx = x - a.x;
      const dz = z - a.z;
      if (Math.abs(dx) > a.r || Math.abs(dz) > a.r) continue;
      const u = dx * a.c + dz * a.s;
      const v = dz * a.c - dx * a.s;
      const out = Math.max(a.u0 - u, u - a.u1, Math.abs(v) - a.w, 0);
      if (out >= GRADE_EASE) continue;
      const f = 1 - smoothstep(0, GRADE_EASE, out);
      if (f > best) {
        best = f;
        const along = Math.min(1, Math.max(0, (u - a.u0) / (a.u1 - a.u0)));
        to = a.y + ((a.y1 ?? a.y) - a.y) * along - 0.05;
      }
    }
    return y + (to - y) * best;
  };
}

/** The ground the N Judah's portal takes: along its line from 20 to 62 m back from the line's
 *  origin (the mouth is at -40), from 8 m south of the rails to 11 m north (across the arm). */
function inPortal(x: number, z: number): boolean {
  const L = N_JUDAH;
  const dx = x - L.x;
  const dz = z - L.z;
  const along = dx * L.ux + dz * L.uz;
  const north = dz * L.ux - dx * L.uz;
  return along > -62 && along < -20 && north > -8 && north < 11;
}

/** How far (x, z) is from the nearest edge of `poly` (m). */
export function edgeDistance(poly: [number, number][], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j];
    const ex = poly[i][0] - ax;
    const ez = poly[i][1] - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
    best = Math.min(best, Math.hypot(ax + ex * t - x, az + ez * t - z));
  }
  return best;
}

/** How many course samples either side a park path's verge widens towards a street's (a metre per
 *  metre along it). */
const VERGE_TAPER = 12;

/** How far the open grounds' grass carries on past their edges onto bare ground (m): the verges
 *  between Alamo Square's fence and its sidewalks, and up the bank over the Sunset Tunnel's portal by
 *  Duboce Park. (Everywhere else round them, streets and houses cover the ground.) */
const LAWN_SPILL: [OpenGround, number][] = [
  [ALAMO_OPEN, 8],
  [DUBOCE_OPEN, 20],
];

/** Alamo Square's surveyed boundary, in the world. */
function alamoBoundary(): [number, number][] {
  const al = chunkOf('alamo');
  return ALAMO_PARK.boundary.map(([x, z]) => {
    const w = al.toWorld(x * ALAMO_SCALE, z * ALAMO_SCALE);
    return [w.x, w.z] as [number, number];
  });
}


/** The hills far off (above the land's regional height): Twin Peaks to the southwest with Mount
 *  Sutro beyond, Corona Heights nearer in; the land falls away towards downtown and the Bay in the
 *  east and north. */
function farHills(x: number, z: number): number {
  const peaks: [number, number, number, number][] = [...TWIN_PEAKS_SUMMITS, [-900, 700, 60, 260], [-150, 520, 22, 150]];
  let h = 0;
  for (const [px, pz, ph, pr] of peaks) h += ph * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (2 * pr * pr));
  h -= 10 * smoothstep(500, 1600, x) + 8 * smoothstep(-500, -1800, z);
  return h + 2.5 * Math.sin(x / 97 + 1.1) * Math.cos(z / 83 - 0.3) * smoothstep(80, 300, Math.hypot(x - 135, z));
}

/** The lie of the land at the scale of the whole map: the course's heights blended over a few
 *  hundred metres (the Haight up high in the west, Hayes Valley low in the east), settling to their
 *  average far off. */
export function regionalHeight(idx: CourseIndex): (x: number, z: number) => number {
  const xs: number[] = [];
  const zs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < idx.xs.length; i += 10) {
    xs.push(idx.xs[i]);
    zs.push(idx.zs[i]);
    ys.push(idx.ys[i]);
  }
  return (x, z) => {
    let w = 0;
    let y = 0;
    for (let i = 0; i < xs.length; i++) {
      const k = 1 / ((xs[i] - x) ** 2 + (zs[i] - z) ** 2 + 2500);
      w += k;
      y += k * ys[i];
    }
    return y / w;
  };
}

// ---------------------------------------------------------------------------------------------
// Build

export function buildOldStompingGrounds(): VenueScene {
  const group = new THREE.Group();
  group.name = 'old-stomping-grounds';
  const rng = makeRng(1969);
  const sinks = makeSinks();
  const idx = new CourseIndex(C, 1, 12);
  const coarse = new CourseIndex(C, 3, 16);
  const parkList = parks(idx);
  const inPark = (x: number, z: number): Park | null => parkList.find((p) => p.contains(x, z)) ?? null;

  // --- The ground ---------------------------------------------------------------------------------
  // Buena Vista's crown: on the clearing south of the summit's straight (clear of the zigzag's garden).
  const bvTop = pointAt(C, markOf('buenaVista', 'summit') + 5);
  const bvSummit = { x: bvTop.x, z: bvTop.z + 12 };
  const mint = pointAt(C, markOf('mint', 'mint') + 16);
  const mintX = mint.x - mint.tz * 26;
  const mintZ = mint.z + mint.tx * 26;
  const regional = cachedField(regionalHeight(idx), -700, 1000, -700, 700, 20);
  // The cross streets' arms (not those running into a park): level with the course where they
  // leave it, so a side street on a hillside isn't draped over the bank below it.
  const graded = gradeUnder([
    ...streetArms(C).filter((a) => !inPark(a.x + Math.cos(a.h) * (a.u0 + WALK + 4.5), a.z + Math.sin(a.h) * (a.u0 + WALK + 4.5)) && !armInOpen(C, a)),
    ...alamoStreets(C, chunkOf).pads,
  ]);
  const land = (x: number, z: number, carried: number, dist: number): number => {
    // The N Judah's portal east of the Duboce corner: level with its rails, walled in by duboce/.
    if (inPortal(x, z)) return N_JUDAH.y - 0.1;
    const far = regional(x, z) + farHills(x, z);
    if (!Number.isFinite(carried)) return far;
    let y = carried;
    // Buena Vista's crown, and the Mint's rock above Buchanan.
    y += 7 * Math.exp(-((x - bvSummit.x) ** 2 + (z - bvSummit.z) ** 2) / (2 * 26 * 26));
    y += 9 * smoothstep(20, 6, Math.hypot(x - mintX, z - mintZ));
    // Out to the land beyond, well away from the roads; the side streets graded (a park keeps its own
    // ground).
    y += (far - y) * smoothstep(30, 69, dist);
    return inPark(x, z) ? y : graded(x, z, y);
  };
  // Alamo Square and Duboce Park are open ground: their ground is the one the cars drive on
  // (course.open), a few centimetres lower under the course's path strips so the lawn never shows
  // through them.
  const OPEN = C.open ?? [];
  const parkGround = (o: OpenGround, x: number, z: number): number => {
    const y = o.height(x, z);
    const n = idx.nearest(x, z, 8);
    if (!n) return y;
    const pave = pointAt(C, idx.ss[n.i]).pave;
    return y - 0.08 * (1 - smoothstep(pave - 0.3, pave + 0.7, n.d));
  };
  // How far out the ground stays at the road's height, sample by sample: a park's path only to its
  // verge, a street to past its sidewalks.
  const narrow = (kind: string): boolean => PARK_KINDS.has(kind) || BV_KINDS.has(kind) || kind === 'steps';
  const rawVerge = idx.ss.map((s) => {
    const p = pointAt(C, s);
    const kind = C.sections[p.sec].kind;
    if (narrow(kind)) return p.pave + 0.6;
    // A corner's arc cuts inside its intersection: level out to the far corner of the sidewalk
    // squares beyond it ((hw + WALK)·√2 from the crossing point, which is R(√2 - 1) outside the arc).
    if (kind === CORNER) return (p.hw + WALK) * Math.SQRT2 + 4.5;
    return p.hw + WALK + 0.5;
  });
  // Where a street hands over to a park's path, the path's verge narrows a metre a metre, not all at
  // once: else the ground jumps where the nearest sample does (from the street's height to the bank
  // beyond the path's), and the grid draws the jump as a crest through the cross street beside it.
  const ds = idx.ss[1] - idx.ss[0];
  const verges = rawVerge.map((v, i) => {
    if (!narrow(C.sections[pointAt(C, idx.ss[i]).sec].kind)) return v;
    const n = rawVerge.length;
    for (let k = -VERGE_TAPER; k <= VERGE_TAPER; k++) v = Math.max(v, rawVerge[(i + k + n) % n] - Math.abs(k) * ds);
    return v;
  });
  const roads = courseGround(idx, {
    reach: 70,
    blend: coarse,
    verge: (i) => verges[i],
    land,
    bank: (drop) => Math.max(3, Math.abs(drop) * 1.1),
  });
  const height = (x: number, z: number): number => {
    for (const o of OPEN) if (o.contains(x, z)) return parkGround(o, x, z);
    return roads(x, z);
  };
  // The grass detail over all of it (lawn.ts): the parks' own greens are picked to sit under it; the
  // city's and the far land's are lifted by its gain, to come out as they were.
  const grass = grassTexture();
  const cGrass = new THREE.Color('#8cc262').multiplyScalar(grass.gain);
  const cCity = new THREE.Color('#aab592').multiplyScalar(grass.gain);
  const cFar = new THREE.Color('#a9ae94').multiplyScalar(grass.gain);
  const cDirt = new THREE.Color('#a8906b').multiplyScalar(grass.gain);
  const cBank = new THREE.Color(BANK);
  const spillC = new THREE.Color();
  const beds = ALAMO_PARK.beds.map((poly) => {
    const al = chunkOf('alamo');
    return poly.map(([x, z]) => {
      const w = al.toWorld(x * ALAMO_SCALE, z * ALAMO_SCALE);
      return [w.x, w.z] as [number, number];
    });
  });
  const inBed = (x: number, z: number): boolean => beds.some((b) => inPolygon(b, x, z));
  // The open grounds' rough (rough.ts): how much of it is round each of the ground's vertices.
  const roughness = OPEN.map((o) => ({ o, w: roughWeight(o, C) }));
  const roughAt = (x: number, z: number): number => {
    for (const q of roughness) if (q.o.contains(x, z)) return q.w(x, z);
    return 0;
  };
  // Buena Vista's zigzag: the ground lies under its terraced garden (buenaVista/terraces.ts draws the
  // garden's floor; the grid gets lines on its walls so the step hides inside them).
  const bvGarden = bvGardenPlan(C);
  const ground = buildHeightfield({
    xs: bvGarden.gridX(gridAxis(-150, 420, 2.5, 3600, 1.15)),
    zs: bvGarden.gridZ(gridAxis(-210, 180, 2.5, 3600, 1.15)),
    height: (x, z) => bvGarden.low(x, z) ?? height(x, z),
    color: (x, z, _y, up, out) => {
      const p = inPark(x, z);
      if (p?.kind === 'woods') woodsTone(x, z, out);
      else if (p) {
        lawnTone(x, z, out, p === parkList[0] && inBed(x, z));
        const r = roughAt(x, z);
        if (r > 0) roughTone(x, z, out, r, inBed(x, z));
      } else {
        const n = idx.nearest(x, z, 120);
        out.copy(cCity).lerp(cFar, n ? smoothstep(60, 120, n.d) : 1);
        if (!n) out.lerp(cGrass, 0.35 * smoothstep(0.3, 0.9, Math.sin(x / 140) * Math.cos(z / 170)));
        let spill = 0;
        for (const [o, r] of LAWN_SPILL) spill = Math.max(spill, smoothstep(r, r / 2, edgeDistance(o.outline, x, z)));
        if (spill > 0) out.lerp(lawnTone(x, z, spillC), spill);
      }
      out.lerp(p ? cBank : cDirt, smoothstep(0.9, 0.7, up) * (p ? 0.55 : 0.8));
    },
    name: 'ground',
    seed: 1967,
    detail: { map: grass.map, scale: GRASS_TILE },
  });
  roughGround(ground.mesh, roughAt, GRASS_TILE);
  group.add(ground.mesh);

  const occ = new Occupancy(-260, -330, 780, 600);
  const ctx: Ctx = {
    course: C,
    chunk: chunkOf,
    mark: markOf,
    ground: ground.height,
    rng,
    sinks,
    site: { ground: ground.height, curb: 0.16 },
    occ,
    group,
    updaters: [],
  };

  // --- The road, and the neighbourhoods' own things (they claim their ground first) -----------------
  buildRoad(ctx);
  const walks: ((s: number, side: 1 | -1) => boolean)[] = [];
  const houses: ((s: number, side: 1 | -1) => boolean)[] = [];
  const extra: Frontage[] = [];
  const ownSigns: [number, number][] = [];
  for (const build of [buildAlamo, buildHayes, buildDuboce, buildBuenaVista, buildHaight]) {
    const r = build(ctx);
    if (r?.noWalk) walks.push(r.noWalk);
    if (r?.noHouses) houses.push(r.noHouses);
    if (r?.frontages) extra.push(...r.frontages);
    if (r?.ownSigns) ownSigns.push(...r.ownSigns);
  }
  const { frontages } = buildStreets(ctx, {
    noWalk: (s, side) => walks.some((f) => f(s, side)),
    noHouses: (s, side) => walks.some((f) => f(s, side)) || houses.some((f) => f(s, side)),
    ownSigns,
  });
  buildFurniture(ctx, frontages, (s, side) => walks.some((f) => f(s, side)));
  frontages.push(...extra);

  // --- Victorians in every free frontage, plain blocks behind them ------------------------------------
  fillFrontages(ctx, frontages);
  buildDistance(ctx, idx, inPark);
  // The open grounds' long grass last: its tufts keep off everything laid on the parks' ground.
  for (const o of OPEN) buildTufts(ctx, o, o === ALAMO_OPEN ? inBed : () => false);

  // --- Assemble -------------------------------------------------------------------------------------
  const asphaltMat = new THREE.MeshStandardMaterial({ map: asphaltTexture(), vertexColors: true, roughness: 0.92 });
  const pathMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const markMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const concreteMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ map: sidewalkTexture(), vertexColors: true, roughness: 0.9 });
  const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.46 });
  const trimMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#27405e', roughness: 0.1, metalness: 0.55 });
  const facadeMat = new THREE.MeshStandardMaterial({ map: facadeTexture(), vertexColors: true, roughness: 0.7 });
  const foliageMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, flatShading: true });
  const hedgeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const metalMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.32 });
  const paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
  const glossMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.08 });
  const stoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
  const glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#fff1c4', emissiveIntensity: 0.9, roughness: 0.4 });
  const S = sinks;
  group.add(meshOf(S.asphalt, asphaltMat, 'asphalt', false, true));
  group.add(meshOf(S.path, pathMat, 'paths', false, true));
  group.add(meshOf(S.marks, markMat, 'markings', false, true));
  group.add(meshOf(S.concrete, concreteMat, 'concrete', true, true));
  group.add(meshOf(S.sidewalk, sidewalkMat, 'sidewalks', true, true));
  group.add(meshOf(S.walls, wallMat, 'houseWalls', true, true));
  // (The trim's tiny shadows aren't worth drawing it twice for: the walls cast the houses' shadows.)
  group.add(meshOf(S.trim, trimMat, 'houseTrim', false, true));
  group.add(meshOf(S.glass, glassMat, 'houseGlass', false, true));
  group.add(meshOf(S.facades, facadeMat, 'blocks', true, true));
  group.add(meshOf(S.foliage, foliageMat, 'foliage', true, true));
  group.add(meshOf(S.hedge, hedgeMat, 'hedges', true, true));
  group.add(meshOf(S.metal, metalMat, 'metal', true, true));
  group.add(meshOf(S.paint, paintMat, 'painted', true, true));
  group.add(meshOf(S.gloss, glossMat, 'gloss', true, true));
  group.add(meshOf(S.stone, stoneMat, 'stone', true, true));
  group.add(meshOf(S.glow, glowMat, 'lamps', false, false));

  const update = (dt: number, t: number, cars: { x: number; z: number }[]): void => {
    for (const u of ctx.updaters) u(dt, t, cars);
  };
  return { group, update };
}

/** Victorians along every frontage that's still free (skipping any lot something else has
 *  taken). Behind them, backyards, then the city (distance.ts). */
export function fillFrontages(ctx: Ctx, frontages: Frontage[]): void {
  const rng = ctx.rng;
  const D = 12;
  for (const f of frontages) {
    let u = 0.3;
    const wx = -f.uz;
    const wz = f.ux;
    let first = true;
    while (u < f.len - 5.5) {
      const W = Math.min(f.len - u, 6 + rng() * 2);
      if (W < 5.5) break;
      const ox = f.ox + f.ux * u;
      const oz = f.oz + f.uz * u;
      const poly: [number, number][] = [
        [ox, oz],
        [ox + f.ux * W, oz + f.uz * W],
        [ox + f.ux * W + wx * D, oz + f.uz * W + wz * D],
        [ox + wx * D, oz + wz * D],
      ];
      if (ctx.occ.free(poly)) {
        ctx.occ.claim(poly);
        const last = u + W >= f.len - 5.5;
        buildHouse(ctx.sinks, { ox, oz, ux: f.ux, uz: f.uz, W }, rng, ctx.site, { exposeU0: first, exposeUW: last });
        first = false;
      } else first = true;
      u += W;
    }
  }
}

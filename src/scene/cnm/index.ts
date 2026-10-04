// Castro, Noe & Mission's scenery: the Castro, Noe Valley, the Mission and Dolores Park round the lap
// race. Built the way Old Stomping Grounds' is, from its shared parts (scene/osg/): the ground follows
// the course (Dolores Park's own surveyed hill in the park), the streets bring their sidewalks, cross
// streets, signs, lamps and trees (streets.ts), race day brings its barriers, tyres and crowd
// (furniture.ts), each neighbourhood brings its landmarks (castro.ts, noe.ts, mission.ts,
// dolores.ts), and Victorians fill every frontage that's left (victorian.ts), with plainer blocks
// behind them, Twin Peaks and Sutro Tower over the Castro and downtown beyond Dolores Park
// (distance.ts, skyline.ts). Procedural, and merged by material to keep draw calls low. (The start
// line and the gantry are shared with every map: src/scene/maps.ts adds them from the course.)
import * as THREE from 'three';
import { CASTRO_NOE_MISSION, DOLORES_OPEN, cnmChunk, cnmMark } from '../../maps/castroNoeMission';
import type { OpenGround } from '../../openGround';
import { pointAt } from '../../track';
import { meshOf } from '../geo';
import type { VenueScene } from '../maps';
import { asphaltTexture } from '../props';
import { CourseIndex, buildHeightfield, cachedField, courseGround, gridAxis } from '../terrain';
import { makeRng, smoothstep } from '../util';
import { facadeTexture, type Frontage } from '../victorian';
import { edgeDistance, fillFrontages, gradeUnder, regionalHeight } from '../osg';
import { Occupancy, makeSinks, type Ctx, type Hood } from '../osg/context';
import { buildDistance, type DistanceConfig } from '../osg/distance';
import { buildFurniture } from '../osg/furniture';
import { BANK, GRASS_TILE, grassTexture, lawnTone } from '../osg/lawn';
import { sidewalkTexture } from '../osg/paving';
import { buildTufts, roughGround, roughTone, roughWeight } from '../osg/rough';
import { CORNER, PARK_KINDS, WALK, armInOpen, buildRoad, buildStreets, streetArms } from '../osg/streets';
import { buildCastro } from './castro';
import { buildDolores } from './dolores';
import { buildMission } from './mission';
import { buildNoe } from './noe';

const C = CASTRO_NOE_MISSION;

// ---------------------------------------------------------------------------------------------
// Where the real city is

/** Castro & Market, where the course's first chunk starts (the world's origin). */
const ORIGIN = { lat: 37.76252, lon: -122.43515 };
const E_PER_DEG = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const N_PER_DEG = 110574;

/**
 * A real place in the world, its distance from Castro & Market drawn in to `drawIn` (the course's
 * own streets are about a third of their real length; what's far off is drawn in less). The world is
 * the map turned as the first chunk is (Market St runs along +x into the corner of Castro).
 */
export function cnmReal(lat: number, lon: number, drawIn = 0.6): { x: number; z: number } {
  const e = (lon - ORIGIN.lon) * E_PER_DEG;
  const n = (lat - ORIGIN.lat) * N_PER_DEG;
  return cnmChunk('castro').toWorld(e * drawIn, -n * drawIn);
}

/** Twin Peaks' two summits (north and south), Mount Sutro's ridge and Diamond Heights to the west and
 *  southwest of the Castro, Bernal Heights south of the Mission, Corona Heights over the Castro's
 *  north: world x, z, height above the land round them, spread. Sutro Tower stands on the first. */
export const CNM_HILLS: [number, number, number, number][] = (() => {
  const h = (lat: number, lon: number, height: number, spread: number, drawIn = 0.6): [number, number, number, number] => {
    const p = cnmReal(lat, lon, drawIn);
    return [p.x, p.z, height, spread];
  };
  return [
    h(37.7544, -122.4477, 150, 170),
    h(37.7518, -122.4475, 140, 160),
    h(37.7586, -122.4583, 95, 240),
    h(37.7432, -122.4437, 70, 220),
    h(37.7432, -122.4158, 55, 170, 0.5),
    h(37.7647, -122.4385, 30, 90, 0.7),
  ];
})();

/** The middle of the course, and how far it reaches from there. */
const MID = (() => {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const p of C.points) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    z0 = Math.min(z0, p.z);
    z1 = Math.max(z1, p.z);
  }
  return { x0, x1, z0, z1, x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
})();

/** The city beyond the course: its blocks round the course, taller towards downtown (northeast of
 *  the Castro), bare above Twin Peaks' shoulders; downtown's towers beyond, where they really are. */
function cnmDistance(): DistanceConfig {
  const castro = cnmChunk('castro');
  const down = cnmReal(37.7865, -122.4035, 0.44);
  const toward = Math.atan2(down.z, down.x);
  return {
    x: MID.x,
    z: MID.z,
    reach: 1400,
    downtown: (x, z) => 1 - smoothstep(500, 1400, Math.hypot(x - down.x, z - down.z)),
    bareAbove: 95,
    skyline: {
      anchor: { lat: ORIGIN.lat, lon: ORIGIN.lon, x: 0, z: 0 },
      turn: castro.rot,
      drawIn: 0.44,
      push: { x: Math.cos(toward) * 80, z: Math.sin(toward) * 80 },
      city: { x: MID.x, z: MID.z, reach: 1400 },
      sutro: { x: CNM_HILLS[0][0], z: CNM_HILLS[0][1] },
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Parks and the ground

/** A patch of park: what it is and whether a point's in it. */
export interface Park {
  kind: 'lawn' | 'woods';
  contains(x: number, z: number): boolean;
}

/** The parks, in the world: Dolores Park's lawn (its open ground). The neighbourhoods' small
 *  squares are paved, and lie on the ground the streets give them. */
export function cnmParks(): Park[] {
  return [{ kind: 'lawn', contains: (x, z) => DOLORES_OPEN.contains(x, z) }];
}

/** How many course samples either side a park path's verge widens towards a street's (a metre per
 *  metre along it). */
const VERGE_TAPER = 12;

/** How far the open ground's grass carries on past its edge onto bare ground (m). */
const LAWN_SPILL: [OpenGround, number][] = [[DOLORES_OPEN, 6]];

/** The far hills (above the land's regional height). */
function farHills(x: number, z: number): number {
  let h = 0;
  for (const [px, pz, ph, pr] of CNM_HILLS) h += ph * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (2 * pr * pr));
  return h;
}

// ---------------------------------------------------------------------------------------------
// Build

/** The neighbourhoods, in the order they claim their ground. */
const HOODS: ((ctx: Ctx) => Hood | void)[] = [buildDolores, buildCastro, buildNoe, buildMission];

export function buildCastroNoeMission(): VenueScene {
  const group = new THREE.Group();
  group.name = 'castro-noe-mission';
  const rng = makeRng(1978);
  const sinks = makeSinks();
  const idx = new CourseIndex(C, 1, 12);
  const coarse = new CourseIndex(C, 3, 16);
  const parkList = cnmParks();
  const inPark = (x: number, z: number): Park | null => parkList.find((p) => p.contains(x, z)) ?? null;

  // --- The ground ---------------------------------------------------------------------------------
  const regional = cachedField(regionalHeight(idx), MID.x0 - 900, MID.x1 + 900, MID.z0 - 900, MID.z1 + 900, 20);
  // The cross streets' arms (not those running into the park): level with the course where they
  // leave it, so a side street on a hillside isn't draped over the bank below it.
  const graded = gradeUnder(streetArms(C).filter((a) => !inPark(a.x + Math.cos(a.h) * (a.u0 + WALK + 4.5), a.z + Math.sin(a.h) * (a.u0 + WALK + 4.5)) && !armInOpen(C, a)));
  const land = (x: number, z: number, carried: number, dist: number): number => {
    const far = regional(x, z) + farHills(x, z);
    if (!Number.isFinite(carried)) return far;
    // Out to the land beyond, well away from the roads; the side streets graded (a park keeps its own
    // ground).
    const y = carried + (far - carried) * smoothstep(30, 69, dist);
    return inPark(x, z) ? y : graded(x, z, y);
  };
  // Dolores Park is open ground: its ground is the one the cars drive on (course.open), a few
  // centimetres lower under the course's path so the lawn never shows through it.
  const OPEN = C.open ?? [];
  const parkGround = (o: OpenGround, x: number, z: number): number => {
    const y = o.height(x, z);
    const n = idx.nearest(x, z, 8);
    if (!n) return y;
    const pave = pointAt(C, idx.ss[n.i]).pave;
    return y - 0.08 * (1 - smoothstep(pave - 0.3, pave + 0.7, n.d));
  };
  // How far out the ground stays at the road's height, sample by sample: a park's path only to its
  // verge, a street to past its sidewalks (a corner out to the far corner of its sidewalk squares).
  const narrow = (kind: string): boolean => PARK_KINDS.has(kind);
  const rawVerge = idx.ss.map((s) => {
    const p = pointAt(C, s);
    const kind = C.sections[p.sec].kind;
    if (narrow(kind)) return p.pave + 0.6;
    if (kind === CORNER) return (p.hw + WALK) * Math.SQRT2 + 4.5;
    return p.hw + WALK + 0.5;
  });
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
  // The grass detail over all of it (lawn.ts), the city's and the far land's tints lifted by its gain.
  const grass = grassTexture();
  const cGrass = new THREE.Color('#8cc262').multiplyScalar(grass.gain);
  const cCity = new THREE.Color('#aab592').multiplyScalar(grass.gain);
  const cFar = new THREE.Color('#b3ae8e').multiplyScalar(grass.gain);
  const cDirt = new THREE.Color('#a8906b').multiplyScalar(grass.gain);
  const cBank = new THREE.Color(BANK);
  const spillC = new THREE.Color();
  const roughness = OPEN.map((o) => ({ o, w: roughWeight(o, C) }));
  const roughAt = (x: number, z: number): number => {
    for (const q of roughness) if (q.o.contains(x, z)) return q.w(x, z);
    return 0;
  };
  const ground = buildHeightfield({
    xs: gridAxis(MID.x0 - 60, MID.x1 + 60, 2.5, 3600, 1.15),
    zs: gridAxis(MID.z0 - 60, MID.z1 + 60, 2.5, 3600, 1.15),
    height,
    color: (x, z, _y, up, out) => {
      const p = inPark(x, z);
      if (p) {
        lawnTone(x, z, out, false);
        const r = roughAt(x, z);
        if (r > 0) roughTone(x, z, out, r, false);
      } else {
        const n = idx.nearest(x, z, 120);
        out.copy(cCity).lerp(cFar, n ? smoothstep(60, 120, n.d) : 1);
        // Twin Peaks' grassy tops and the far hills, greener.
        if (!n) out.lerp(cGrass, 0.45 * smoothstep(40, 120, farHills(x, z)));
        let spill = 0;
        for (const [o, r] of LAWN_SPILL) spill = Math.max(spill, smoothstep(r, r / 2, edgeDistance(o.outline, x, z)));
        if (spill > 0) out.lerp(lawnTone(x, z, spillC), spill);
      }
      out.lerp(p ? cBank : cDirt, smoothstep(0.9, 0.7, up) * (p ? 0.55 : 0.8));
    },
    name: 'ground',
    seed: 1978,
    detail: { map: grass.map, scale: GRASS_TILE },
  });
  roughGround(ground.mesh, roughAt, GRASS_TILE);
  group.add(ground.mesh);

  const ox = Math.floor(MID.x0 - 160);
  const oz = Math.floor(MID.z0 - 160);
  const occ = new Occupancy(ox, oz, Math.ceil(MID.x1 + 160 - ox), Math.ceil(MID.z1 + 160 - oz));
  const ctx: Ctx = {
    course: C,
    chunk: cnmChunk,
    mark: cnmMark,
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
  for (const build of HOODS) {
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

  // --- Victorians in every free frontage, plain blocks behind them, the city and the skyline ---------
  fillFrontages(ctx, frontages);
  buildDistance(ctx, idx, inPark, cnmDistance());
  // The open ground's long grass last: its tufts keep off everything laid on the park's ground.
  for (const o of OPEN) buildTufts(ctx, o, () => false);

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

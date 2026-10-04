// Old Stomping Grounds: a lap race round the Haight, Alamo Square, Hayes Valley, Duboce Triangle and
// Buena Vista, in that order, with every turn going the way the real streets do. From the start
// under the clock stuck at 4:20 on Haight & Ashbury: up Ashbury and east along the Panhandle on Oak,
// up Scott into Alamo Square Park by its southwest ramp, round the dog lawn, over the summit, down
// through the tourists photographing the Painted Ladies and off the northeast steps; a hairpin onto
// Steiner past the Painted Ladies themselves; left down Hayes through Hayes Valley, crests at every
// cross street; right through Patricia's Green and down Octavia; the zigzag up Page, over the Mint's
// hill on Buchanan and down to Duboce Ave; along the N Judah's tracks and through Duboce Park; up the
// Duboce Ave wall to Buena Vista Park, up its winding paths to the summit and down its switchbacks,
// hopping the stone walls if you dare; and back onto Haight to the line.
//
// The course is built from chunks (track.ts: buildChunkLoop), one per stretch, laid end to end; the
// Panhandle straight is the flexible one that closes the loop. Take a chunk out, put one in or
// resize one (its `scale`) and the rest of the loop follows. The park is Alamo Square as surveyed
// (data/alamoSquare.ts) at three quarters of its size; the streets are compressed to about a third
// of their length, and their heights to about 0.6 of the real ones, so the hills come round in a
// few blocks at the steepness a lap race can take. No Three.js or DOM imports.
import type { Venue } from '.';
import type { RaceSim } from '../sim/race';
import { ALAMO_PARK, ALAMO_ROUTE } from './data/alamoSquare';
import { dubocePlan } from './dubocePark';
import { inPoly, makeOpenGround, type OpenGround } from '../openGround';
import { Pen, buildChunkLoop, heightAt, pointAt, type ChunkDef, type ChunkSection, type FlexChunkDef, type Garden, type LaidChunk } from '../track';

const DEG = Math.PI / 180;
/** Heading on the map (+x east, +z south): which way each chunk is drawn arriving. */
const EAST = 0;
const SOUTH = 90 * DEG;
const WEST = 180 * DEG;
const NORTH = -90 * DEG;

/** Road half-widths (m): the streets, a park's corridor (path and lawn) and its paved path, Buena
 *  Vista's walled paths, the steps. */
export const STREET_HW = 6.5;
export const PARK_HW = 5.2;
export const PATH_PAVE = 3.1;
export const BV_HW = 5;

/** The N Judah's track: this far right of the course's centreline along Duboce Ave (negative: left,
 *  the south side, heading west). */
export const N_JUDAH_TRACK = -3;

/** The park is drawn at this fraction of its surveyed size, heights too (so its grades are real),
 *  and Steiner St alongside it to match. */
export const ALAMO_SCALE = 0.54;
/** Where Steiner's cross streets are in the survey's frame (z of Fulton, Grove and Hayes). */
const STEINER_Z = { fulton: -191.9, grove: -87.7, hayes: 16.8 };

type Sec = Omit<ChunkSection, 'from'>;
const street = (name: string, kind = 'street'): Sec => ({ kind, name, hw: STREET_HW, edgeL: 'curb', edgeR: 'curb' });
const crossing = (name: string): Sec => ({ kind: 'crossing', name, hw: STREET_HW, edgeL: 'curb', edgeR: 'curb' });
const park = (name: string, kind = 'park', hw = PARK_HW): Sec => ({ kind, name, hw, pave: PATH_PAVE, verge: 'grass', edgeL: 'hedge', edgeR: 'hedge' });

// ---------------------------------------------------------------------------------------------
// The chunks, in order from Oak & Scott (the end of the Panhandle straight).

/** Left off Oak onto Scott, up past Fell to Hayes, and right into Alamo Square's southwest ramp. */
function scott(): ChunkDef {
  const p = new Pen(EAST);
  p.section(street('Oak St', 'corner')).go(6).arc(-90, 10, 0.2).mark('scott');
  p.section(street('Scott St')).go(18, 1.0);
  p.mark('fell').section(crossing('Fell St')).go(12, 0.1, { round: 0 });
  p.section(street('Scott St')).go(18, 2.4, { round: 10 });
  p.mark('hayes').section(crossing('Hayes St')).go(6, 0.2).arc(62, 10, 0.4).go(3);
  return p.chunk('scott');
}

/** Points round a circle in the survey's frame: centre, radius, from angle a0 to a1 (radians, as
 *  atan2(z, x)), n steps after the first, the height going from y0 to y1. */
function arcPts(cx: number, cz: number, r: number, a0: number, a1: number, n: number, y0: number, y1: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const a = a0 + (a1 - a0) * f;
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, y0 + (y1 - y0) * f]);
  }
  return out;
}

/**
 * Route A through Alamo Square, in the survey's frame (data/alamoSquare.ts), made drivable where
 * the real paths double back on the spot: at the summit (the path up to the plaza at the top of the
 * south steps, and the one down from it to the northeast) the course swings right round the plaza;
 * where the southeast path meets the path along Steiner it loops across the tourists' lawn between
 * them. Indices of where each stretch starts come back too.
 */
function alamoRoute(): { pts: [number, number, number][]; at: Record<string, number> } {
  const R = ALAMO_ROUTE;
  const pts: [number, number, number][] = [];
  const at: Record<string, number> = {};
  // (Skipping the kinks where one path meets another: the circle's way in and out.)
  const skip = new Set([28, 37, 38, 40, 41, 43, 45, 47]);
  const take = (i0: number, i1: number): void => {
    for (let i = i0; i <= i1; i++) if (!skip.has(i)) pts.push([R[i][0], R[i][1], R[i][2]]);
  };
  const mark = (name: string): void => {
    at[name] = pts.length;
  };
  take(1, 5);
  mark('west');
  take(6, 12);
  mark('dogs');
  take(13, 27);
  mark('circle');
  take(28, 45);
  // Round the summit plaza (centred on it), in from the west side heading south, out north-east.
  const sx = R[48][0];
  const sz = R[48][1];
  const sy = R[48][2];
  const rs = 10;
  pts.push([sx - rs - 1.5, sz - 20, 15.6], [sx - rs - 0.2, sz - 12, 16.4]);
  mark('summit');
  const exitA = (48 * Math.PI) / 180;
  pts.push(...arcPts(sx, sz, rs, Math.PI, exitA, 6, sy - 0.1, sy));
  // Back onto the path down to the northeast, the offset easing away.
  const dx = Math.cos((-41.5 * Math.PI) / 180);
  const dz = Math.sin((-41.5 * Math.PI) / 180);
  const ex = sx + Math.cos(exitA) * rs;
  const ez = sz + Math.sin(exitA) * rs;
  for (const u of [7, 15, 23, 31]) {
    const f = 1 - u / 38;
    const off = f * f * (3 - 2 * f);
    pts.push([sx + dx * (u + 1) + (ex - sx - dx) * off, sz + dz * (u + 1) + (ez - sz - dz) * off, sy - 0.07 * u]);
  }
  take(54, 64);
  // The tourists' lawn: a loop across it from the southeast path onto the path along Steiner.
  mark('lawn');
  const V = R[67];
  const r = 14;
  const d1 = (42 * Math.PI) / 180;
  const t = r / Math.tan(((180 - 137) / 2) * (Math.PI / 180));
  const t1x = V[0] - Math.cos(d1) * t;
  const t1z = V[1] - Math.sin(d1) * t;
  const cx = t1x + Math.sin(d1) * r;
  const cz = t1z - Math.cos(d1) * r;
  const a0 = Math.atan2(t1z - cz, t1x - cx);
  pts.push(...arcPts(cx, cz, r, a0, a0 - (137 * Math.PI) / 180, 5, 7.4, 4.9));
  take(72, 75);
  mark('north');
  take(76, 83);
  // A flat landing at the top of the steps (a sharp crest there), and the steps themselves.
  pts.push([R[84][0], R[84][1], -8.5]);
  mark('stepsTop');
  pts.push([R[85][0], R[85][1], -8.9]);
  pts.push([R[86][0], R[86][1], -14.5]);
  mark('stepsFoot');
  return { pts, at };
}

/**
 * Alamo Square as surveyed (route A): in by the southwest ramp, north up the west path and round
 * the dog lawn's west and north sides and the little circle on its east, over the summit, down the
 * southeast path through the tourists photographing the Painted Ladies, onto the path along
 * Steiner past the benches that face them, down the steep last stretch and off the 39 steps onto
 * the corner of Fulton & Steiner. Then a hairpin onto Steiner, south past the Painted Ladies to
 * Hayes.
 */
function alamo(): ChunkDef {
  const k = ALAMO_SCALE;
  const { pts, at } = alamoRoute();
  // Drawn in the survey's frame (the park's southwest ramp at the origin, arriving heading ENE).
  const p = new Pen(Math.atan2(-1.8, 3.4));
  // (Surveyed points are only a few metres apart: their vertical curves are kept as short.)
  const run = (i0: number, i1: number, opts: { round?: number } = {}): void => {
    p.through(pts.slice(i0, i1).map(([x, z, y]) => [x - p.x / k, z - p.z / k, y - p.y / k] as [number, number, number]), { scale: k, round: 2.5, ...opts });
  };
  // The ramp in from the corner is narrow and curls round to the north.
  p.section({ kind: 'ramp', name: 'Alamo Square', hw: 4.6, edgeL: 'curb', edgeR: 'hedge' }).mark('in');
  run(0, at.west);
  p.section(park('Alamo Square', 'park'));
  run(at.west, at.dogs);
  p.section(park('The Dog Park', 'dogs')).mark('dogs');
  run(at.dogs, at.circle);
  p.section({ ...park('The Circle', 'circle', 3.9), pave: 3 }).mark('circle');
  run(at.circle, at.summit);
  p.section(park('The Summit', 'summit', 4.4)).mark('summit');
  run(at.summit, at.lawn);
  p.section(park('Postcard Row', 'lawn', 5.4)).mark('lawn');
  run(at.lawn, at.north);
  p.section(park('Alamo Square', 'park')).mark('north');
  run(at.north, at.stepsTop);
  run(at.stepsTop, at.stepsTop + 1, { round: 0 });
  p.section({ kind: 'steps', name: 'The Steps', hw: 4.6, edgeL: 'curb', edgeR: 'curb' }).mark('stepsTop');
  run(at.stepsTop + 1, at.stepsFoot, { round: 2 });
  p.section(street('Fulton St', 'hairpin')).mark('stepsFoot');
  p.go(3, -0.2).arc(132, 7.2, -0.2).go(2, 0.2);
  // South on Steiner along the park's edge: its cross streets where they are beside the park.
  p.section(street('Steiner St')).mark('steiner');
  const zGrove = STEINER_Z.grove * k;
  const zHayes = STEINER_Z.hayes * k;
  p.go(zGrove - 6 - p.z, 12.1 * k);
  p.mark('grove').section(crossing('Grove St')).go(12, 0.2, { round: 0 });
  p.section(street('Steiner St', 'ladies')).mark('ladies');
  p.go(zHayes - 6 - p.z, 7.6 * k);
  p.mark('ladiesEnd').section(crossing('Hayes St')).go(6, 0.1);
  return p.chunk('alamo');
}

/** Left down Hayes, a crest at every cross street, to the 500 block and its shops. */
function hayes(): ChunkDef {
  const p = new Pen(SOUTH);
  p.section(street('Hayes St', 'corner')).go(1).arc(-90, 9, 0).go(5, -0.1, { round: 0 });
  p.section(street('Hayes St')).mark('hayes');
  p.go(34, -8.6);
  p.mark('fillmore').section(crossing('Fillmore St')).go(12, -0.3, { round: 0 });
  p.section(street('Hayes St')).go(34, -8.2);
  p.mark('webster').section(crossing('Webster St')).go(12, -0.3, { round: 0 });
  p.section(street('Hayes St')).go(16, -3.2);
  p.mark('laguna').section(crossing('Laguna St')).go(12, -0.3, { round: 0 });
  p.section(street('Hayes St', 'shops')).mark('shops').go(52, -1.2);
  p.mark('octavia').section(crossing('Octavia St')).go(6, 0);
  return p.chunk('hayes');
}

/** Right through Patricia's Green, and on down Octavia Blvd. */
function green(): ChunkDef {
  const p = new Pen(EAST);
  p.section(street('Octavia St', 'corner')).go(1).arc(90, 8.5, 0).go(1);
  p.section({ ...park("Patricia's Green", 'green', 6.2), pave: 3.4, edgeL: 'curb', edgeR: 'curb' }).mark('green');
  p.go(54, -0.8);
  p.mark('fell').section(crossing('Fell St')).go(12, 0);
  p.section(street('Octavia Blvd')).go(22, 0.3);
  p.mark('page').section(crossing('Page St')).go(6, 0);
  return p.chunk('green');
}

/** The zigzag: right up Page (steep), left over the Mint's hill on Buchanan, right onto Duboce Ave. */
function mint(): ChunkDef {
  const p = new Pen(SOUTH);
  p.section(street('Page St', 'corner')).arc(90, 8.5, 0.2).go(2, 0.3);
  p.section(street('Page St')).mark('page');
  // (Easing off at the top: a crest straight into the corner would throw cars into its wall.)
  p.go(33, 8.1).go(8, 0.7, { round: 8 });
  p.mark('buchanan').section(street('Buchanan St', 'corner')).go(2, 0.2).arc(-90, 8.5, 0.2).go(2, 0.1);
  p.section(street('Buchanan St')).go(12, 1.8);
  p.mark('haight').section(crossing('Haight St')).go(12, 0, { round: 0 });
  p.section(street('Buchanan St', 'mint')).mark('mint').go(32, -7.7);
  // (Level round the corner onto Duboce Ave: the N Judah's tracks cross it.)
  p.mark('duboce').section(street('Duboce Ave', 'corner')).go(2, 0).arc(90, 9, 0).go(2);
  return p.chunk('mint');
}

/** Along Duboce Ave on the N Judah's tracks, then through Duboce Park and out by the tunnel. */
function duboce(): ChunkDef {
  const p = new Pen(WEST);
  // (Flat along the tracks: Duboce Ave hardly climbs here, and the streetcar runs level.)
  p.section(street('Duboce Ave', 'rails')).mark('rails');
  p.go(24, 0);
  p.mark('church').section(crossing('Church St')).go(12, 0);
  p.section(street('Duboce Ave', 'rails')).go(20, 0);
  p.mark('steiner').section(crossing('Steiner St')).go(6, 0);
  // Into the park at its southeast corner, up its path, and back out at the southwest.
  p.section(park('Duboce Park', 'duboce')).mark('park');
  p.arc(40, 14, 1.0).go(6, 1.2).arc(-40, 14, 1.4).go(18, 2.8).arc(-40, 14, 1.4).go(6, 0.6).arc(40, 14, 0.8);
  p.mark('parkEnd').section(street('Duboce Ave', 'portal')).go(8, 0.4);
  return p.chunk('duboce');
}

/** Up the Duboce Ave wall to Buena Vista: a crest onto Buena Vista Ave East throws the quick cars. */
function wall(): ChunkDef {
  const p = new Pen(WEST);
  p.section(street('Duboce Ave', 'wall')).mark('wall');
  p.go(28, 2.6);
  p.mark('castro').section(crossing('Castro St')).go(12, 0.4);
  p.section(street('Duboce Ave', 'wall')).go(30, 7).go(32, 7.6, { round: 0 });
  p.mark('top').section(crossing('Buena Vista Ave E')).go(14, 0);
  return p.chunk('wall');
}

/** Buena Vista's zigzag, Lombard's way: legs at ±60° to the fall line (north), 120° hairpins of this
 *  radius, two full legs of this length between them and half legs at either end. */
export const BV_ZIGZAG = { legAngle: 60, hairpinR: 7, legLen: 14 } as const;

/**
 * Buena Vista Park: in off Buena Vista Ave East and up round the east and south sides of the hill to
 * the summit, then down the zigzag between low stone walls, three hairpins as tight as Lombard's (hop
 * a wall onto the leg below, with a Jump, and cut the corner: the band of garden they swing across is
 * walled in like Lombard's, so a car coming down between the legs slides onto the nearest one), out
 * onto Buena Vista Ave West.
 */
function buenaVista(): ChunkDef {
  const p = new Pen(WEST);
  const bv = (name: string, kind: string): Sec => ({ kind, name, hw: BV_HW, edgeL: 'hedge', edgeR: 'hedge' });
  const { legAngle: th, hairpinR: r, legLen: leg } = BV_ZIGZAG;
  const half = leg / 2 - r * Math.tan((th / 2) * DEG);
  const turn = r * th * DEG;
  const pin = r * 2 * th * DEG;
  // Down the zigzag at about this grade (a little gentler round the hairpins).
  const g = 0.125;
  p.section(bv('Buena Vista Park', 'bv')).mark('in');
  // (Straight on at first: the quick cars come down off the crest here.)
  p.go(13, 1.3).arc(-90, 14, 3.0).go(13.3, 2.3).arc(90, 10, 1.6);
  p.mark('summit').section(bv('The Summit', 'bvSummit')).go(6.7, 0);
  p.arc(90, 9, -2.1).go(2.9, -0.6);
  p.mark('switchbacks').section(bv('The Switchbacks', 'switchbacks'));
  p.arc(-th, r, -turn * g).go(half, -half * g);
  p.arc(2 * th, r, -pin * g * 0.9).go(leg, -leg * g * 1.1);
  p.arc(-2 * th, r, -pin * g * 0.9).go(leg, -leg * g * 1.1);
  p.arc(2 * th, r, -pin * g * 0.9).go(half, -half * g);
  p.section(bv('Buena Vista Park', 'bv')).arc(-th, r, -turn * g).go(2, -0.3);
  p.mark('out').section(street('Buena Vista Ave W')).go(2.8, -0.9);
  return p.chunk('buenaVista');
}

/** Left onto Haight, west through the Upper Haight to Ashbury: the start line is on this stretch. */
function haight(): ChunkDef {
  const p = new Pen(NORTH);
  p.section(street('Haight St', 'corner')).go(2).arc(-90, 9, 0).go(2);
  p.section(street('Haight St', 'haight')).mark('haight');
  p.go(38, -0.4);
  p.mark('masonic').section(crossing('Masonic Ave')).go(12, 0);
  p.section(street('Haight St', 'haight')).mark('upper').go(64, -0.3);
  p.mark('ashbury').section(crossing('Ashbury St')).go(6, 0);
  return p.chunk('haight');
}

/** Right up Ashbury past Page, and right again onto Oak by the Panhandle. */
function ashbury(): ChunkDef {
  const p = new Pen(WEST);
  p.section(street('Ashbury St', 'corner')).go(1).arc(90, 9, -0.4).go(2, -0.3);
  p.section(street('Ashbury St')).go(22, -2.6);
  p.mark('page').section(crossing('Page St')).go(12, -0.1, { round: 0 });
  p.section(street('Ashbury St')).go(24, -2.4);
  p.mark('oak').section(street('Oak St', 'corner')).go(1).arc(90, 9, -0.2).go(4);
  return p.chunk('ashbury');
}

/** The Panhandle straight on Oak: it stretches or bends to close the loop back to Scott. */
const OAK: FlexChunkDef = {
  id: 'oak',
  flex: true,
  step: 30,
  section: { kind: 'panhandle', name: 'Oak St', hw: STREET_HW, edgeL: 'curb', edgeR: 'curb' },
  marks: { oak: 0, mid: 0.5 },
};

export const OSG_CHUNK_DEFS: (ChunkDef | FlexChunkDef)[] = [scott(), alamo(), hayes(), green(), mint(), duboce(), wall(), buenaVista(), haight(), ashbury(), OAK];

const built = buildChunkLoop({
  id: 'old-stomping-grounds',
  chunks: OSG_CHUNK_DEFS,
  // The start line on Haight, just short of the corner of Ashbury (the grid facing west).
  start: { chunk: 'haight', mark: 'ashbury', offset: -40 },
  wideViews: [
    { chunk: 'alamo', from: 'circle', to: 'north' },
    { chunk: 'buenaVista', from: 'switchbacks', to: 'out' },
  ],
  followGrade: 0.8,
});

export const OLD_STOMPING_GROUNDS = built.course;
/** Where each chunk was laid (the scenery places each stretch's things in its frame). */
export const OSG_CHUNKS: LaidChunk[] = built.chunks;

export function osgChunk(id: string): LaidChunk {
  const c = OSG_CHUNKS.find((q) => q.id === id);
  if (!c) throw new Error(`old-stomping-grounds: no chunk ${id}`);
  return c;
}

/** A named point along the course: a chunk's mark. */
export function osgMark(chunk: string, mark: string): number {
  const s = osgChunk(chunk).marks[mark];
  if (s === undefined) throw new Error(`old-stomping-grounds: chunk ${chunk} has no mark ${mark}`);
  return s;
}

/**
 * The band of garden Buena Vista's zigzag swings across, walled in like Lombard's block (the sim's
 * gardens): come down between two legs after hopping a wall and you slide onto the nearest one, and
 * its sides hold a car in. It runs down the fall line from the way in, the zigzag either side, square
 * to the world (the chunk's north is within a fraction of a degree of it), so the ground's grid can
 * run along its walls; and it stops short of the way out, clear of the backs of Haight's buildings on
 * the corner (9 m back from it). The zigzag's last bend crosses that end at a slant, so its gate is
 * wide: the ends are open but for their outer few metres.
 */
export const BV_GARDEN: Garden = (() => {
  const c = OLD_STOMPING_GROUNDS;
  const a = pointAt(c, osgMark('buenaVista', 'switchbacks'));
  const b = pointAt(c, osgMark('buenaVista', 'out'));
  return { ox: a.x, oz: a.z, heading: NORTH, u0: -1.5, u1: a.z - (b.z + 9.9), wall: 17, gate: 14 };
})();
OLD_STOMPING_GROUNDS.gardens = [BV_GARDEN];

// ---------------------------------------------------------------------------------------------
// Alamo Square: open ground

/** A point of the park's survey in the world. */
function alamoWorld(u: number, v: number): [number, number] {
  const w = osgChunk('alamo').toWorld(u * ALAMO_SCALE, v * ALAMO_SCALE);
  return [w.x, w.z];
}

/** Alamo Square's surveyed ground, in the world; null off the survey. (Its 12 m grid of heights was
 *  surveyed square to latitude and longitude, so it sits turned in the park's frame, which is turned
 *  to the streets: bilinear along the grid's own axes.) */
export function alamoSurvey(): (x: number, z: number) => number | null {
  const al = osgChunk('alamo');
  const k = ALAMO_SCALE;
  const g = ALAMO_PARK.elevation;
  // The grid's axes and spacing, from its first two points (a row).
  const ex = g[1][0] - g[0][0];
  const ez = g[1][1] - g[0][1];
  const cell = Math.hypot(ex, ez);
  const ca = ex / cell;
  const sa = ez / cell;
  const ij = (u: number, v: number): [number, number] => {
    const du = u - g[0][0];
    const dv = v - g[0][1];
    return [(du * ca + dv * sa) / cell, (-du * sa + dv * ca) / cell];
  };
  const heights = new Map<string, number>();
  for (const [u, v, y] of g) {
    const [i, j] = ij(u, v);
    heights.set(`${Math.round(i)},${Math.round(j)}`, y);
  }
  return (x, z) => {
    const q = al.toChunk(x, z);
    const [fi, fj] = ij(q.x / k, q.z / k);
    const i = Math.floor(fi);
    const j = Math.floor(fj);
    const h00 = heights.get(`${i},${j}`);
    const h10 = heights.get(`${i + 1},${j}`);
    const h01 = heights.get(`${i},${j + 1}`);
    const h11 = heights.get(`${i + 1},${j + 1}`);
    if (h00 === undefined || h10 === undefined || h01 === undefined || h11 === undefined) return null;
    const u = fi - i;
    const v = fj - j;
    const y = (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v;
    return al.yToWorld(y * k);
  };
}

/**
 * The park's four corners (survey frame) and how high the streets round it are there: where the
 * course crosses Hayes at Scott, at the foot of the steps (Fulton & Steiner), where it crosses Hayes
 * at Steiner, and Fulton & Scott as surveyed. The streets climb evenly between them (the scenery
 * grades them so), and the park's own ground meets them at its edge.
 */
export function alamoCorners(): { sw: [number, number]; se: [number, number]; ne: [number, number]; nw: [number, number]; ySW: number; ySE: number; yNE: number; yNW: number } {
  const c = OLD_STOMPING_GROUNDS;
  const ySW = heightAt(c, osgMark('scott', 'hayes') + 6);
  const ySE = heightAt(c, osgMark('alamo', 'ladiesEnd') + 3);
  const yNE = heightAt(c, osgMark('alamo', 'stepsFoot') + 8);
  const nw = alamoWorld(1.7, -181.6);
  const yNW = alamoSurvey()(nw[0] + 1, nw[1] + 1) ?? (ySW + yNE) / 2;
  return { sw: [4.8, 1.8], se: [270.1, 5.9], ne: [270.8, -181.8], nw: [1.7, -181.6], ySW, ySE, yNE, yNW };
}

/** The trees of Alamo Square that stand clear of the course's corridor (the scenery grows them; the
 *  sim knows their trunks). */
export const ALAMO_TREES: [number, number][] = (() => {
  const c = OLD_STOMPING_GROUNDS;
  const near: { x: number; z: number; r: number }[] = [];
  for (let s = osgMark('scott', 'hayes') - 10; s < osgMark('alamo', 'ladiesEnd') + 10; s += 1) {
    const p = pointAt(c, s);
    near.push({ x: p.x, z: p.z, r: p.hw + 1.2 });
  }
  return ALAMO_PARK.trees.map(([u, v]) => alamoWorld(u, v)).filter(([x, z]) => !near.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < q.r * q.r));
})();

/** How far out from a path through Alamo Square its band of long grass reaches, where a cut from it
 *  would pay (m, beyond the paved path). */
const BAND = 11;

/** Near the course's corridor through the park (plus `pad`)? What stands there is cleared for it. */
export function onAlamoCourse(x: number, z: number, pad: number): boolean {
  const c = OLD_STOMPING_GROUNDS;
  for (let s = osgMark('scott', 'hayes') - 10; s < osgMark('alamo', 'ladiesEnd') + 10; s += 1) {
    const p = pointAt(c, s);
    if ((p.x - x) ** 2 + (p.z - z) ** 2 < (p.hw + pad) ** 2) return true;
  }
  return false;
}

/**
 * What stands in Alamo Square off the course's corridor, one list for the scenery that builds it and
 * the sim that knocks into it: the benches, picnic tables, bins, drinking fountains, the park lamps
 * along the course's paths and the retaining walls (segments). Each keeps clear of the corridor by
 * its own size. (The trees: ALAMO_TREES.)
 */
export const ALAMO_THINGS = (() => {
  const keep = (pts: [number, number][], r: number): [number, number][] => pts.map(([u, v]) => alamoWorld(u, v)).filter(([x, z]) => !onAlamoCourse(x, z, r));
  const c = OLD_STOMPING_GROUNDS;
  const lamps: [number, number][] = [];
  let n = 0;
  for (let s = osgMark('alamo', 'in') + 10; s < osgMark('alamo', 'stepsTop'); s += 24) {
    const p = pointAt(c, s);
    const d = (n++ % 2 ? 1 : -1) * (p.hw + 1.4);
    lamps.push([p.x - p.tz * d, p.z + p.tx * d]);
  }
  const walls: [[number, number], [number, number]][] = [];
  for (const line of ALAMO_PARK.walls) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = alamoWorld(line[i][0], line[i][1]);
      const b = alamoWorld(line[i + 1][0], line[i + 1][1]);
      if (!onAlamoCourse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.5)) walls.push([a, b]);
    }
  }
  return {
    benches: keep(ALAMO_PARK.benches, 1.1),
    picnic: keep(ALAMO_PARK.picnic, 1.8),
    bins: keep(ALAMO_PARK.bins, 0.75),
    fountains: keep(ALAMO_PARK.fountains, 0.8),
    lamps,
    walls,
  };
})();

/** The gates into and out of Alamo Square: banner arches over the course at its ramp and on Steiner
 *  just past the hairpin at the foot of its steps (not in the hairpin itself, where the chase camera
 *  swings round through anything standing on its inside). Their posts stand where the scenery puts
 *  them and the sim knows them. */
export const ALAMO_ARCHES: { s: number; text: string; posts: [number, number][] }[] = [
  { s: osgMark('alamo', 'in') + 4, text: 'ALAMO SQUARE' },
  { s: osgMark('alamo', 'steiner') + 6, text: 'PAINTED LADIES' },
].map((a) => {
  const p = pointAt(OLD_STOMPING_GROUNDS, a.s);
  const d = p.hw + 1.8;
  return { ...a, posts: [-d, d].map((dd) => [p.x - p.tz * dd, p.z + p.tx * dd] as [number, number]) };
});

/**
 * Long grass in Alamo Square's lawns: ragged patches away from the paths (a mown strip beside each
 * path stays short), so cutting across the park wades through it. Only a car in the air skims over
 * it, or a boosting one ploughs through.
 */
function alamoLongGrass(outline: [number, number][], paths: { pts: [number, number][] }[]): [number, number][][] {
  const c = OLD_STOMPING_GROUNDS;
  let seed = 4150;
  const rng = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const course: [number, number][] = [];
  for (let s = osgMark('alamo', 'in'); s < osgMark('alamo', 'stepsFoot'); s += 1.5) {
    const p = pointAt(c, s);
    course.push([p.x, p.z]);
  }
  const clearOf = (x: number, z: number, r: number): boolean => {
    for (const [px, pz] of course) if ((px - x) ** 2 + (pz - z) ** 2 < (PATH_PAVE + 3.5 + r) ** 2) return false;
    for (const q of paths) for (const [px, pz] of q.pts) if ((px - x) ** 2 + (pz - z) ** 2 < (2.6 + r) ** 2) return false;
    return true;
  };
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [x, z] of outline) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  const out: [number, number][][] = [];
  const STEP = 9;
  for (let gx = x0 + 3; gx < x1 - 3; gx += STEP) {
    for (let gz = z0 + 3; gz < z1 - 3; gz += STEP) {
      const x = gx + (rng() - 0.5) * STEP * 0.8;
      const z = gz + (rng() - 0.5) * STEP * 0.8;
      const r = 3 + rng() * 3.5;
      if (rng() < 0.2 || !inPoly(outline, x, z) || !clearOf(x, z, r * 0.6)) continue;
      // A ragged blob, shrunk wherever an edge would reach a path.
      const poly: [number, number][] = [];
      const n = 9;
      const a0 = rng() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * Math.PI * 2;
        let rr = r * (0.7 + rng() * 0.5);
        while (rr > 1 && !clearOf(x + Math.cos(a) * rr, z + Math.sin(a) * rr, 0)) rr *= 0.8;
        poly.push([x + Math.cos(a) * rr, z + Math.sin(a) * rr]);
      }
      out.push(poly);
    }
  }
  return out;
}

/**
 * Alamo Square is open ground: from the southwest ramp to the foot of the steps a car can leave the
 * course's paths anywhere and drive the whole park: on the grass (slow; the park's footpaths are no
 * quicker), through the long grass and the beds (a crawl), round the trees, benches and bins; the
 * park's edge holds it but for the ramp and the steps. Only a jump over the rough (or a boost through it) makes a cut pay. Its ground is the survey, easing
 * over its outer few metres to the height of the streets round it, and the course's paths cut into
 * it (openGround.ts).
 */
export const ALAMO_OPEN: OpenGround = (() => {
  const c = OLD_STOMPING_GROUNDS;
  const al = osgChunk('alamo');
  const outline = ALAMO_PARK.boundary.map(([u, v]) => alamoWorld(u, v));
  const survey = alamoSurvey();
  const k = alamoCorners();
  const u0 = (k.sw[0] + k.nw[0]) / 2;
  const u1 = (k.se[0] + k.ne[0]) / 2;
  const v0 = (k.sw[1] + k.se[1]) / 2;
  const v1 = (k.nw[1] + k.ne[1]) / 2;
  const perim = (x: number, z: number): number => {
    const q = al.toChunk(x, z);
    const fu = Math.max(0, Math.min(1, (q.x / ALAMO_SCALE - u0) / (u1 - u0)));
    const fv = Math.max(0, Math.min(1, (q.z / ALAMO_SCALE - v0) / (v1 - v0)));
    return (k.ySW + (k.ySE - k.ySW) * fu) * (1 - fv) + (k.yNW + (k.yNE - k.yNW) * fu) * fv;
  };
  const edge = (x: number, z: number): number => {
    let best = Infinity;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const [ax, az] = outline[j];
      const [bx, bz] = outline[i];
      const ex = bx - ax;
      const ez = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
      best = Math.min(best, Math.hypot(ax + ex * t - x, az + ez * t - z));
    }
    return best;
  };
  const land = (x: number, z: number): number => {
    const p = perim(x, z);
    const a = survey(x, z);
    if (a === null || !inPoly(outline, x, z)) return p;
    const t = Math.min(1, edge(x, z) / 10);
    return p + (a - p) * t * t * (3 - 2 * t);
  };
  // The courts, the playground and the restrooms are solid; so are the retaining walls.
  const blocks: [number, number][][] = [...ALAMO_PARK.tennis, ...ALAMO_PARK.play, ...ALAMO_PARK.buildings].map((poly) => poly.map(([u, v]) => alamoWorld(u, v)));
  for (const [[ax, az], [bx, bz]] of ALAMO_THINGS.walls) {
    const l = Math.hypot(bx - ax, bz - az) || 1;
    const nx = (-(bz - az) / l) * 0.25;
    const nz = ((bx - ax) / l) * 0.25;
    blocks.push([
      [ax + nx, az + nz],
      [bx + nx, bz + nz],
      [bx - nx, bz - nz],
      [ax - nx, az - nz],
    ]);
  }
  const paths = ALAMO_PARK.paths.filter((q) => q.kind !== 'steps').map((q) => ({ pts: q.pts.map(([u, v]) => alamoWorld(u, v)), hw: 1.1 }));
  return makeOpenGround(c, {
    id: 'alamo',
    outline,
    s0: osgMark('alamo', 'in'),
    s1: osgMark('alamo', 'stepsFoot'),
    land,
    posts: [
      ...ALAMO_TREES.map(([x, z]) => ({ x, z, r: 0.45 })),
      ...ALAMO_THINGS.benches.map(([x, z]) => ({ x, z, r: 0.8 })),
      ...ALAMO_THINGS.picnic.map(([x, z]) => ({ x, z, r: 1.0 })),
      ...ALAMO_THINGS.bins.map(([x, z]) => ({ x, z, r: 0.35 })),
      ...ALAMO_THINGS.fountains.map(([x, z]) => ({ x, z, r: 0.4 })),
      ...ALAMO_THINGS.lamps.map(([x, z]) => ({ x, z, r: 0.2 })),
      ...ALAMO_ARCHES.flatMap((a) => a.posts.map(([x, z]) => ({ x, z, r: 0.4 }))),
    ],
    blocks,
    rough: [...ALAMO_PARK.beds.map((poly) => poly.map(([u, v]) => alamoWorld(u, v))), ...alamoLongGrass(outline, paths)],
    // Wherever a cut through the lawn could pay (the course it skips is more than half again the lawn
    // it crosses), long grass, to a mown strip beside each path: cutting across only pays in the
    // air, as over Lombard's flower beds.
    roughAt: (_x, _z, q) => q.d1 > PATH_PAVE + 1.6 && ((q.cut > 0 && q.d1 < PATH_PAVE + BAND) || (q.d2 < 22 && q.d2 > PATH_PAVE + 1.6)),
  });
})();
/**
 * Duboce Park is open ground too: the lawn from Steiner to Scott between Hermann St and the N Judah's
 * tracks (dubocePark.ts lays it out, and the scenery builds from the same plan). Its ground is its
 * path's, carried out across the lawn; the Harvey Milk Center, the playground and the dog run are
 * solid, the trees, lamps and benches too; long grass wherever a cut from the path would pay.
 */
export const DUBOCE_OPEN: OpenGround = (() => {
  const c = OLD_STOMPING_GROUNDS;
  const plan = dubocePlan(c, osgMark);
  const s0 = osgMark('duboce', 'park') - 8;
  const s1 = osgMark('duboce', 'parkEnd') + 8;
  // The lawn: the path's heights carried out (weighted steeply to the nearest).
  const samples: [number, number, number][] = [];
  for (let s = s0 - 10; s <= s1 + 10; s += 2) {
    const p = pointAt(c, s);
    samples.push([p.x, p.z, heightAt(c, s)]);
  }
  const land = (x: number, z: number): number => {
    let w = 0;
    let y = 0;
    for (const [px, pz, py] of samples) {
      const d2 = (px - x) ** 2 + (pz - z) ** 2 + 1;
      const k = 1 / (d2 * d2);
      w += k;
      y += k * py;
    }
    return y / w;
  };
  const rect = (l: { x0: number; x1: number; z0: number; z1: number }): [number, number][] => [
    [l.x0, l.z0],
    [l.x1, l.z0],
    [l.x1, l.z1],
    [l.x0, l.z1],
  ];
  return makeOpenGround(c, {
    id: 'duboce',
    outline: plan.outline,
    s0,
    s1,
    land,
    posts: [
      ...plan.trees.map((t) => ({ x: t.x, z: t.z, r: 0.45 })),
      ...plan.lamps.map((l) => ({ x: l.x, z: l.z, r: 0.15 })),
      ...plan.benches.map((b) => ({ x: b.x, z: b.z, r: 0.9 })),
    ],
    blocks: [rect(plan.milk), rect(plan.play), rect(plan.dogs)],
    roughAt: (_x, _z, q) => q.d1 > PATH_PAVE + 1.6 && ((q.cut > 0 && q.d1 < PATH_PAVE + BAND) || (q.d2 < 22 && q.d2 > PATH_PAVE + 1.6)),
  });
})();

OLD_STOMPING_GROUNDS.open = [ALAMO_OPEN, DUBOCE_OPEN];

/**
 * The N Judah's line along Duboce Ave: straight rails through (x, z) along (ux, uz) (4 m into the
 * course's stretch of tracks, on the eastbound track), the streetcar's two ends (metres along them:
 * a0 at the east end, inside the Muni subway portal whose mouth is at `mouth`; a1 at the west end, at
 * Steiner, where the park's lawn starts to rise: the tracks carry on to the Sunset Tunnel as scenery),
 * the rails' height along them (level: the course is level along them), and the stretch of course
 * they run along. The sim runs the streetcar on it and the scenery lays the rails and builds the
 * portals to it.
 */
export interface TramLine {
  x: number;
  z: number;
  ux: number;
  uz: number;
  y: number;
  a0: number;
  a1: number;
  mouth: number;
  profile: [number, number][];
  span: [number, number];
}

function nJudahLine(): TramLine {
  const c = OLD_STOMPING_GROUNDS;
  const m = osgMark;
  const a = pointAt(c, m('duboce', 'rails') + 4);
  const b = pointAt(c, m('duboce', 'steiner'));
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const ux = (b.x - a.x) / len;
  const uz = (b.z - a.z) / len;
  const x = a.x - uz * N_JUDAH_TRACK;
  const z = a.z + ux * N_JUDAH_TRACK;
  const a0 = -49;
  const a1 = len - 2;
  const profile: [number, number][] = [
    [a0, a.y],
    [a1, a.y],
  ];
  return { x, z, ux, uz, y: a.y, a0, a1, mouth: -40, profile, span: [m('duboce', 'rails') - 12, m('duboce', 'steiner')] };
}

export const N_JUDAH: TramLine = nJudahLine();

// ---------------------------------------------------------------------------------------------
// What's on the course each round

/**
 * The cast: Waymos pottering round (backmarkers), a stalled one with a protest cone; tourists
 * photographing the Painted Ladies from the lawn, and the Haight & Ashbury sign; dogs loose in
 * Alamo Square's dog park and Duboce Park, some of them chasers; people crossing in Hayes Valley;
 * and the N Judah trundling along Duboce Ave in and out of its tunnel.
 */
export function populateOldStompingGrounds(sim: RaceSim, r: () => number): void {
  const c = sim.course;
  const L = c.length;
  const m = osgMark;
  // (Waymos don't drive in the parks: each one pulls over and parks before the next one.)
  const lane = (): number => (r() < 0.5 ? -3.2 : 3.2);
  sim.addTraffic(m('haight', 'masonic') + 4 + r() * 20, lane(), 5 + r() * 1.5, m('scott', 'hayes') - 6);
  sim.addTraffic(m('hayes', 'hayes') + 10 + r() * 30, lane(), 4.5 + r() * 1.5, m('green', 'green') - 8);
  sim.addTraffic(m('mint', 'mint') + r() * 10, lane(), 4.5 + r(), m('duboce', 'park') - 8);
  sim.addTraffic(m('wall', 'wall') + 4 + r() * 10, lane(), 3.5 + r(), m('wall', 'top') + 4);
  void L;
  {
    const s = m('mint', 'page') + 12 + r() * 16;
    const d = (r() < 0.5 ? -1 : 1) * (2.4 + r() * 1.4);
    const wm = sim.addStalled(s, d, Math.PI + (r() - 0.5) * 0.5);
    wm.cone = true;
    wm.hazard = true;
    for (let i = 0; i < 3; i++) sim.addCone(s - 6 - i * 2.2, Math.max(-5, Math.min(5, d + (r() - 0.5) * 3)));
  }
  // Tourists on the lawn and the path below it, photographing the Painted Ladies.
  const lawn = m('alamo', 'lawn');
  for (let k = 0; k < 5; k++) {
    const s = lawn + 6 + k * 9 + r() * 4;
    const pt = pointAt(c, s);
    // On the lawn on the outside of the loop, facing the Painted Ladies; one of them wanders to the
    // path's edge for the shot.
    const d = -(pt.pave + 1.1 + r() * Math.max(0, pt.hw - pt.pave - 1.7));
    const p = sim.addPed('tourist', s, d, 0, 0, 1, 0, 0);
    p.speed = k === 2 ? 0.35 : 0;
    p.d0 = k === 2 ? -(pt.pave - 0.2) : d;
    p.d1 = k === 2 ? d : d;
    if (k === 2) {
      p.d0 = Math.min(d, -(pt.pave - 0.2));
      p.d1 = Math.max(d, -(pt.pave - 0.2));
    }
  }
  // And at Haight & Ashbury, photographing the street sign on the inside of the corner (clear of
  // the line the cars take into it, mostly).
  for (let k = 0; k < 3; k++) {
    const s = m('haight', 'ashbury') - 18 + k * 4 + r() * 2;
    const p = sim.addPed('tourist', s, STREET_HW - 0.9 - r() * 0.6, 0, 0, 1, 0, 0);
    p.d0 = STREET_HW - 1.6;
    p.d1 = STREET_HW - 0.8;
  }
  // People crossing Hayes in the shops block.
  for (let k = 0; k < 2; k++) {
    const s = m('hayes', 'shops') + 20 + k * 32 + r() * 6;
    const dir: 1 | -1 = r() < 0.5 ? 1 : -1;
    sim.addPed('crosser', s, dir * -(STREET_HW - 0.8), -(STREET_HW - 0.8), STREET_HW - 0.8, dir, 1.1 + r() * 0.4, r() * 4);
  }
  // Dogs: the dog park (round the dog lawn), and Duboce Park.
  const dogs = (s0: number, s1: number, n: number, chasers: number): void => {
    for (let k = 0; k < n; k++) {
      const s = s0 + ((k + 0.5) / n) * (s1 - s0) + (r() - 0.5) * 6;
      const hw = pointAt(c, s).hw;
      sim.addDog(s, (r() * 2 - 1) * (hw - 1), s0, s1, -hw + 0.7, hw - 0.7, k < chasers);
    }
  };
  dogs(m('alamo', 'in') + 18, m('alamo', 'circle') - 4, 5, 2);
  dogs(m('duboce', 'park') + 8, m('duboce', 'parkEnd') - 6, 3, 1);
  // The N Judah: out of the Muni subway portal east of the corner, along Duboce Ave past the course's
  // stretch of it and on past the park to where its tracks turn off for the Sunset Tunnel, and back.
  {
    const L = N_JUDAH;
    sim.addCable({ x: L.x, z: L.z, ux: L.ux, uz: L.uz }, L.y, L.a0, L.a1, L.a0 + (L.a1 - L.a0) * r(), r() < 0.5 ? 1 : -1, 2 + r() * 4, L.span, 'N JUDAH', 'streetcar', L.profile);
  }
}

// ---------------------------------------------------------------------------------------------
// The venue

const mk = osgMark;

export const OSG_VENUE: Venue = {
  id: 'old-stomping-grounds',
  name: 'Old Stomping Grounds',
  course: OLD_STOMPING_GROUNDS,
  boxes: [
    { s: mk('oak', 'mid'), ds: [-4, 0, 4] },
    { s: mk('alamo', 'circle') + 14, ds: [-2.2, 2.2] },
    { s: mk('hayes', 'shops') + 30, ds: [-4, 0, 4] },
    { s: mk('duboce', 'church') + 30, ds: [-4, 0, 4] },
    { s: mk('buenaVista', 'summit') + 8, ds: [-2.6, 2.6] },
  ],
  populate: populateOldStompingGrounds,
  strip: [
    { label: 'START', s: OLD_STOMPING_GROUNDS.startS },
    { label: 'PANHANDLE', s: mk('oak', 'oak') },
    { label: 'ALAMO SQ', s: mk('alamo', 'in') },
    { label: 'PAINTED LADIES', s: mk('alamo', 'ladies') },
    { label: 'HAYES', s: mk('hayes', 'hayes') },
    { label: 'DUBOCE', s: mk('duboce', 'park') },
    { label: 'BUENA VISTA', s: mk('buenaVista', 'in') },
  ],
  splits: [
    { label: 'ALAMO SQ', s: mk('alamo', 'in') },
    { label: 'HAYES', s: mk('hayes', 'hayes') },
    { label: 'DUBOCE', s: mk('duboce', 'park') },
    { label: 'SUMMIT', s: mk('buenaVista', 'summit') },
  ],
  starts: [{ id: 'grid', name: 'The grid', what: 'a full race', s: null }],
  hints: {
    driftUntil: Infinity,
    // Buena Vista's switchbacks: hop the stone walls onto the leg below (with a Jump item).
    hedges: [mk('buenaVista', 'switchbacks') - 4, mk('buenaVista', 'out')],
    hedgeHop: [mk('buenaVista', 'switchbacks') - 4, mk('buenaVista', 'out') + 4],
    hopName: 'wall',
  },
  windWhere: 'on the Panhandle',
  tip: 'Drive anywhere in Alamo Square, but the grass is slow and the long grass a crawl: only a JUMP makes a cut pay · Tap the brake while turning to DRIFT · Boost on the Panhandle · Gas as “1” fades: rocket start',
  warn: '⚠ Crests down Hayes, the Alamo Square steps and the top of the Duboce wall throw you in the air: line up before them',
  marks: {
    alamo: mk('alamo', 'in'),
    steps: mk('alamo', 'stepsTop'),
    ladies: mk('alamo', 'ladies'),
    hayes: mk('hayes', 'hayes'),
    green: mk('green', 'green'),
    duboce: mk('duboce', 'park'),
    wall: mk('wall', 'wall'),
    summit: mk('buenaVista', 'summit'),
  },
};

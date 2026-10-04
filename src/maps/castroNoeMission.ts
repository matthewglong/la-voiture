// Castro, Noe & Mission: a lap race from the Castro over the hill to Noe Valley, down into the Mission
// and back up through Dolores Park, every turn the way the real streets go. From the start in front of
// the Castro Theatre, under the rainbow flag at Harvey Milk Plaza: south down Castro St through the
// rainbow crosswalks at 18th, up the hill past the Victorians to the crest at 22nd and down to 24th;
// left along 24th through Noe Valley's shops (strollers, everywhere), over the crest at Dolores and
// down into the Mission; left up Mission St past El Farolito, the BART plaza and the Alamo Drafthouse;
// left along 18th past the Women's Building, Tartine and Bi-Rite; left down Dolores St under its palms
// and right into Dolores Park by Mexico's Liberty Bell, up the hill to the top; right onto Church St,
// down past the park with the J Church to Market; and a sharp left up Market St to the line.
//
// The course is built from chunks (track.ts: buildChunkLoop) laid end to end, as Old Stomping Grounds
// is; Market St is the flexible one that closes the loop. The streets are compressed to between a
// quarter and a third of their length and their heights to about half (the hill on Castro St still
// climbs at 17%, as near as a race can take it); Dolores Park, and Dolores and Church Sts beside it,
// are drawn at DOLORES_SCALE of the survey, heights too (data/doloresPark.ts), so their grades are
// the real ones. Where things are is surveyed (data/cnmStreets.ts). No Three.js or DOM imports.
import type { Venue } from '.';
import type { PedDress, RaceSim } from '../sim/race';
import { DOLORES_PARK } from './data/doloresPark';
import { inPoly, makeOpenGround, type OpenGround } from '../openGround';
import type { TramLine } from './oldStompingGrounds';
import { Pen, buildChunkLoop, pointAt, type ChunkDef, type ChunkSection, type FlexChunkDef, type LaidChunk } from '../track';

const DEG = Math.PI / 180;
/** The streets' headings on the map (+x east, +z south), as surveyed. */
const MARKET_H = 135.7 * DEG;
const CASTRO_H = 85.6 * DEG;
const T24_H = -4.3 * DEG;
const MISSION_H = -94.4 * DEG;
const E18_H = 175.6 * DEG;
const CHURCH_H = -94.3 * DEG;

/** Road half-widths (m): the streets, Mission St and Market St (wider), a park path's corridor
 *  (path and lawn) and its paved path. */
export const STREET_HW = 6.5;
export const MISSION_HW = 7.2;
export const MARKET_HW = 7.8;
export const PARK_HW = 5.2;
export const PATH_PAVE = 3.1;

/** Dolores Park (and Dolores and Church Sts along it) are drawn at this fraction of the survey,
 *  heights too, so the park's grades are the real ones. */
export const DOLORES_SCALE = 0.4;

/** The J Church's track along Church St: this far right of the course's centreline (negative: left,
 *  the west side, heading north). */
export const J_TRACK = -2.7;

type Sec = Omit<ChunkSection, 'from'>;
const street = (name: string, kind = 'street', hw = STREET_HW): Sec => ({ kind, name, hw, edgeL: 'curb', edgeR: 'curb' });
const crossing = (name: string, hw = STREET_HW): Sec => ({ kind: 'crossing', name, hw, edgeL: 'curb', edgeR: 'curb' });
const park = (name: string, kind = 'dpark', hw = PARK_HW): Sec => ({ kind, name, hw, pave: PATH_PAVE, verge: 'grass', edgeL: 'hedge', edgeR: 'hedge' });

// ---------------------------------------------------------------------------------------------
// The chunks, in order from the corner of Market & Castro (the end of the Market St straight).

/**
 * Off Market onto Castro St (the rainbow flag on the right, Twin Peaks Tavern on the left), the start
 * in front of the Castro Theatre, the rainbow crosswalks at 18th, Harvey Milk's old camera shop; then
 * up the hill, steeper every block, to the crest at 22nd (Castro Hill), and down a steep last block
 * to 24th. A sharp crest at 22nd and another at 23rd throw the quick cars.
 */
function castro(): ChunkDef {
  const p = new Pen(MARKET_H);
  p.section(street('Castro St', 'corner', MARKET_HW)).go(3).arc(-50.1, 11, -0.2).go(2, -0.1);
  p.section(street('Castro St', 'castro')).mark('castro');
  p.go(22, -1.4).mark('theatre');
  p.go(36, -2.6);
  p.mark('18th').section(crossing('18th St')).go(12, -0.2);
  p.section(street('Castro St', 'castro')).mark('milk').go(40, 3.0);
  p.mark('19th').section(crossing('19th St')).go(12, 0.6);
  p.section(street('Castro St')).mark('hill').go(48, 8.0);
  p.mark('20th').section(crossing('20th St')).go(12, 1.2);
  p.section(street('Castro St')).go(62, 11.2);
  p.mark('21st').section(crossing('21st St')).go(12, 1.0);
  p.section(street('Castro St')).go(40, 5.2, { round: 6 });
  // Castro Hill: over the top at 22nd, sharp (it throws you), and down.
  p.mark('22nd').section(crossing('22nd St')).go(12, 0.2, { round: 0 });
  p.section(street('Castro St')).mark('down').go(42, -7.4);
  p.mark('23rd').section(crossing('23rd St')).go(12, -0.6, { round: 0 });
  // (Easing off at the foot: the corner onto 24th comes on a level run.)
  p.section(street('Castro St')).mark('steep').go(40, -11.4).go(7, -0.5, { round: 8 });
  return p.chunk('castro');
}

/** Left along 24th through Noe Valley's shops: Noe St, Sanchez, the Town Square, Vicksburg, Church
 *  (the J Church's tracks across it). Strollers. */
function noe(): ChunkDef {
  const p = new Pen(CASTRO_H);
  p.section(street('24th St', 'corner')).go(1).arc(-90, 9, -0.3).go(2, -0.1);
  p.section(street('24th St', 'noe')).mark('noe');
  p.go(42, -2.2);
  p.mark('noeSt').section(crossing('Noe St')).go(12, -0.1);
  p.section(street('24th St', 'noe')).mark('books').go(42, -0.4);
  p.mark('sanchez').section(crossing('Sanchez St')).go(12, 0);
  p.section(street('24th St', 'noe')).mark('square').go(24, -0.3);
  p.mark('vicksburg').section(crossing('Vicksburg St')).go(12, 0);
  p.section(street('24th St', 'noe')).mark('martha').go(24, -0.2);
  p.mark('church').section(crossing('Church St')).go(12, 0);
  return p.chunk('noe');
}

/** 24th on east: the last of Noe Valley to Dolores, where the street tips over (a crest by the palms)
 *  and drops into the Mission past Guerrero and Valencia to Mission St. */
function mission24(): ChunkDef {
  const p = new Pen(T24_H);
  p.section(street('24th St')).mark('upper').go(36, 0.3, { round: 6 });
  p.mark('dolores').section(crossing('Dolores St')).go(12, 0, { round: 0 });
  p.section(street('24th St', 'mission')).mark('drop').go(38, -10.0);
  p.mark('guerrero').section(crossing('Guerrero St')).go(12, -0.4);
  p.section(street('24th St', 'mission')).mark('murals').go(38, -5.4);
  p.mark('valencia').section(crossing('Valencia St')).go(12, -0.3);
  p.section(street('24th St', 'mission')).mark('calle').go(36, -2.2);
  return p.chunk('mission24');
}

/** Left up Mission St, flat and wide: El Farolito and the BART plaza at 24th, the Alamo Drafthouse,
 *  Taqueria Cancún; lowriders cruising. */
function missionSt(): ChunkDef {
  const hw = MISSION_HW;
  const p = new Pen(T24_H);
  p.section(street('Mission St', 'corner', hw)).go(1).arc(-90.1, 10, 0).go(2);
  p.section(street('Mission St', 'mission', hw)).mark('farolito').go(29, -0.1);
  p.mark('23rd').section(crossing('23rd St', hw)).go(12, 0);
  p.section(street('Mission St', 'mission', hw)).go(29, 0);
  p.mark('22nd').section(crossing('22nd St', hw)).go(12, 0);
  p.section(street('Mission St', 'mission', hw)).mark('drafthouse').go(29, -1.0);
  p.mark('21st').section(crossing('21st St', hw)).go(12, -0.2);
  p.section(street('Mission St', 'mission', hw)).go(29, -1.6);
  p.mark('20th').section(crossing('20th St', hw)).go(12, -0.2);
  p.section(street('Mission St', 'mission', hw)).mark('cancun').go(29, -1.6);
  p.mark('19th').section(crossing('19th St', hw)).go(12, -0.2);
  p.section(street('Mission St', 'mission', hw)).go(29, -1.2);
  return p.chunk('missionSt');
}

/** Left along 18th: Valencia, the Women's Building's murals, Guerrero and Tartine on its corner,
 *  Bi-Rite, to Dolores. */
function eighteenth(): ChunkDef {
  const p = new Pen(MISSION_H);
  p.section(street('18th St', 'corner')).go(1).arc(-90, 9, 0.1).go(2);
  p.section(street('18th St', 'mission')).mark('e18').go(36, 1.2);
  p.mark('valencia').section(crossing('Valencia St')).go(12, 0.1);
  p.section(street('18th St', 'mission')).mark('women').go(36, 0.8);
  p.mark('guerrero').section(crossing('Guerrero St')).go(12, 0.1);
  p.section(street('18th St')).mark('birite').go(36, 0.7);
  return p.chunk('eighteenth');
}

/** Where the dolores chunk starts in the park's survey frame (DOLORES_PARK): on 18th St at the east
 *  side of Dolores St (the course's line down Dolores runs along its west carriageway). */
export const DOLORES_ANCHOR: [number, number] = [811.5, 137.6];

/** The turn (degrees, + right) from heading h onto heading to. */
function turnTo(h: number, to: number): number {
  let d = to - h;
  d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
  return d / DEG;
}

/** Points of the park's survey frame round a bend that leaves `from` heading h, turning `deg` degrees
 *  (+ right) on a circle of radius r: n of them after `from`. */
function fillet(from: [number, number], h: number, deg: number, r: number, n: number): [number, number][] {
  const t = deg * DEG;
  const side = Math.sign(t);
  const cx = from[0] - Math.sin(h) * r * side;
  const cz = from[1] + Math.cos(h) * r * side;
  const a0 = Math.atan2(from[1] - cz, from[0] - cx);
  const out: [number, number][] = [];
  for (let i = 1; i <= n; i++) out.push([cx + Math.cos(a0 + (t * i) / n) * r, cz + Math.sin(a0 + (t * i) / n) * r]);
  return out;
}

/** The park's height (m above sea level) at a point of its survey (bilinear on its 20 m grid). */
export function doloresHeight(x: number, z: number): number {
  const g = DOLORES_PARK.elevation;
  const x0 = g[0][0];
  const z0 = g[0][1];
  let nz = 0;
  while (nz < g.length && g[nz][0] === x0) nz++;
  const nx = g.length / nz;
  const fi = Math.max(0, Math.min(nx - 1.001, (x - x0) / 20));
  const fj = Math.max(0, Math.min(nz - 1.001, (z - z0) / 20));
  const i = Math.floor(fi);
  const j = Math.floor(fj);
  const at = (a: number, b: number): number => g[a * nz + b][2];
  const u = fi - i;
  const v = fj - j;
  return (at(i, j) * (1 - v) + at(i, j + 1) * v) * (1 - u) + (at(i + 1, j) * (1 - v) + at(i + 1, j + 1) * v) * u;
}

/** The course's way up through the park (survey frame): in from Dolores St at the gate just north of
 *  19th (Mexico's Liberty Bell beside it, to the left), west along the walk towards the middle, then
 *  up the hill south of the plaza and west of the playground to the top by the viewpoint. */
export const DOLORES_ROUTE: [number, number][] = [
  [764, 300],
  [748, 306],
  [734, 318],
  [721, 336],
  [708, 356],
  [697, 378],
  [687, 401],
  [679, 424],
  [672, 446],
  [665, 465],
];

/** Where the course's line down Dolores St turns into the park (survey z), just north of the Liberty
 *  Bell. */
const GATE_Z = 282;

/**
 * Down Dolores St along the park under its palms, right into Dolores Park by Mexico's Liberty Bell,
 * up the hill (dogs, picnics) to the top by the viewpoint, out at the corner of Church & 20th; then
 * right, down Church St past the park (the J Church's right of way beside it) and its steep drop from
 * 19th to 18th. Drawn in the survey's frame at DOLORES_SCALE: the corners' arcs in metres as drawn,
 * the rest from where the survey says.
 */
function dolores(): ChunkDef {
  const k = DOLORES_SCALE;
  const [ax, az] = DOLORES_ANCHOR;
  const p = new Pen(E18_H);
  // Where the pen is in the survey, and a height there (above the chunk's start, at the park's scale).
  const sx = (): number => ax + p.x / k;
  const sz = (): number => az + p.z / k;
  const y0 = doloresHeight(ax - 10, az + 4);
  const yAt = (x: number, z: number): number => (doloresHeight(x, z) - y0) * k;
  /** Through surveyed points (their heights from the survey) from wherever the pen is. */
  const thru = (pts: [number, number][], round = 6): void => {
    const x0 = sx();
    const z0 = sz();
    const yb = p.y;
    p.through(
      pts.map(([x, z]) => [x - x0, z - z0, (yAt(x, z) - yb) / k] as [number, number, number]),
      { scale: k, round },
    );
  };
  p.section(street('Dolores St', 'corner')).go(1).arc(-90, 8, 0.1).go(1);
  // South along the park (the median's palms to the left), to the gate.
  p.section(street('Dolores St', 'dolores')).mark('dolores');
  p.go((GATE_Z - sz()) * k, yAt(sx(), GATE_Z) - p.y);
  // Right through the gate, and up the park's paths.
  p.mark('gate').section(park('Dolores Park', 'dpark')).arc(87, 6, 0.2);
  thru(DOLORES_ROUTE.slice(0, 2));
  p.section(park('Dolores Park', 'hill')).mark('hill');
  thru(DOLORES_ROUTE.slice(2));
  // Along the top, and out at the corner of Church & 20th.
  p.section(park('The Top', 'top')).mark('top');
  {
    const [a, b] = DOLORES_ROUTE.slice(-2);
    const h = Math.atan2(b[1] - a[1], b[0] - a[0]);
    thru(fillet(b, h, turnTo(h, Math.PI), 18, 5));
  }
  // (Round onto Church St's own heading, however the path above left the pen.)
  p.mark('out').section(street('Church St', 'corner')).arc(turnTo(p.h, CHURCH_H), 8.5, -0.3).go(1);
  // North on Church St past the park: 20th to 19th, then the drop to 18th (a crest at 19th).
  p.section(street('Church St', 'churchPark')).mark('church');
  p.go((sz() - 335) * k, yAt(612, 330) - p.y, { round: 4 });
  p.mark('19th').section(crossing('19th St')).go(12, -0.6, { round: 0 });
  p.section(street('Church St', 'churchPark')).mark('drop');
  p.go((sz() - 160) * k, yAt(600, 160) - p.y - 0.3);
  p.mark('18th').section(crossing('18th St')).go(12, 0.2);
  return p.chunk('dolores');
}

/** North on Church St with the J Church on its tracks: 17th (the F's tracks off to the west), 16th
 *  (Mission Dolores down the street to the east), 15th, and the sharp left onto Market. */
function church(): ChunkDef {
  const p = new Pen(CHURCH_H);
  p.section(street('Church St', 'rails')).mark('rails').go(38, 5.6);
  p.mark('17th').section(crossing('17th St')).go(12, 0.2);
  p.section(street('Church St', 'rails')).go(32, 0.6);
  p.mark('16th').section(crossing('16th St')).go(12, 0);
  p.section(street('Church St', 'rails')).go(32, 0.3);
  p.mark('15th').section(crossing('15th St')).go(12, 0);
  p.section(street('Church St', 'rails')).go(28, 0.5);
  p.mark('market').section(street('Market St', 'corner', MARKET_HW)).go(2).arc(-130, 10, 0.2).go(3, 0.1);
  return p.chunk('church');
}

/** Market St, the straight back to Castro: it stretches or bends to close the loop. */
const MARKET: FlexChunkDef = {
  id: 'market',
  flex: true,
  step: 30,
  section: { kind: 'market', name: 'Market St', hw: MARKET_HW, edgeL: 'curb', edgeR: 'curb' },
  marks: { market: 0, mid: 0.5, flag: 0.85 },
};

export const CNM_CHUNK_DEFS: (ChunkDef | FlexChunkDef)[] = [castro(), noe(), mission24(), missionSt(), eighteenth(), dolores(), church(), MARKET];

const built = buildChunkLoop({
  id: 'castro-noe-mission',
  chunks: CNM_CHUNK_DEFS,
  // The start line in front of the Castro Theatre (the grid facing south down Castro St).
  start: { chunk: 'castro', mark: 'theatre' },
  wideViews: [{ chunk: 'dolores', from: 'gate', to: 'out' }],
  followGrade: 0.8,
});

export const CASTRO_NOE_MISSION = built.course;
/** Where each chunk was laid (the scenery places each stretch's things in its frame). */
export const CNM_CHUNKS: LaidChunk[] = built.chunks;

export function cnmChunk(id: string): LaidChunk {
  const c = CNM_CHUNKS.find((q) => q.id === id);
  if (!c) throw new Error(`castro-noe-mission: no chunk ${id}`);
  return c;
}

/** A named point along the course: a chunk's mark. */
export function cnmMark(chunk: string, mark: string): number {
  const s = cnmChunk(chunk).marks[mark];
  if (s === undefined) throw new Error(`castro-noe-mission: chunk ${chunk} has no mark ${mark}`);
  return s;
}

// ---------------------------------------------------------------------------------------------
// Dolores Park: open ground

/** A point of the park's survey (DOLORES_PARK's frame) in the world. */
export function doloresWorld(x: number, z: number): [number, number] {
  const w = cnmChunk('dolores').toWorld((x - DOLORES_ANCHOR[0]) * DOLORES_SCALE, (z - DOLORES_ANCHOR[1]) * DOLORES_SCALE);
  return [w.x, w.z];
}

/** A height of the park's survey (m above sea level) in the world. */
export function doloresY(y: number): number {
  const [ax, az] = DOLORES_ANCHOR;
  return cnmChunk('dolores').yToWorld((y - doloresHeight(ax - 10, az + 4)) * DOLORES_SCALE);
}

/** Near the course's corridor (plus `pad`), from Dolores St to Church St? What stands there is
 *  cleared for it. */
export function onDoloresCourse(x: number, z: number, pad: number): boolean {
  const c = CASTRO_NOE_MISSION;
  for (let s = cnmMark('dolores', 'dolores') - 6; s < cnmMark('dolores', '18th') + 12; s += 1) {
    const p = pointAt(c, s);
    if ((p.x - x) ** 2 + (p.z - z) ** 2 < (p.hw + pad) ** 2) return true;
  }
  return false;
}

/** How far the park's lawn stands back from the course's corridor: past Dolores St's sidewalk, and
 *  past Church St's sidewalk and the J Church's right of way (m). */
export const DOLORES_EAST_SET = STREET_HW + 4;
export const DOLORES_WEST_SET = STREET_HW + 6;

/**
 * The lawn a car can drive on, a simple polygon in the world: down its east side DOLORES_EAST_SET back
 * from the course's line down Dolores St (carried on past the gate to 20th St), along 20th St to the
 * corner of Church, up its west side DOLORES_WEST_SET back from the course's line up Church St, and
 * back along 18th St. (The park is drawn small but the streets keep their width, so the lawn's edges
 * follow the streets rather than the survey; the course crosses it at the gate and at the top.)
 */
export const DOLORES_OUTLINE: [number, number][] = (() => {
  const c = CASTRO_NOE_MISSION;
  const off = (s: number, d: number): [number, number] => {
    const p = pointAt(c, s);
    return [p.x - p.tz * d, p.z + p.tx * d];
  };
  const s0 = cnmMark('dolores', 'dolores') + 3;
  const sGate = cnmMark('dolores', 'gate');
  const east: [number, number][] = [];
  for (let i = 0; i <= 6; i++) east.push(off(s0 + ((sGate - s0) * i) / 6, DOLORES_EAST_SET));
  // On south past the gate, along Dolores St's line, to 20th St.
  const g = pointAt(c, sGate);
  const run = (492 - GATE_Z) * DOLORES_SCALE;
  for (const f of [0.5, 1]) east.push([g.x + g.tx * run * f - g.tz * DOLORES_EAST_SET, g.z + g.tz * run * f + g.tx * DOLORES_EAST_SET]);
  const west: [number, number][] = [];
  const c0 = cnmMark('dolores', 'church') + 3;
  const c1 = cnmMark('dolores', '18th') - 2;
  for (let i = 0; i <= 8; i++) west.push(off(c0 + ((c1 - c0) * i) / 8, DOLORES_WEST_SET));
  return [...east, doloresWorld(652, 492), ...west];
})();

/** The courts, the playground and the restrooms: solid (polygons in the world), trimmed off the
 *  course. */
export const DOLORES_BLOCKS: [number, number][][] = [...DOLORES_PARK.tennis, ...DOLORES_PARK.basketball, ...DOLORES_PARK.playground, ...DOLORES_PARK.buildings]
  .map((poly) => poly.map(([x, z]) => doloresWorld(x, z)))
  .filter((poly) => {
    const cx = poly.reduce((a, q) => a + q[0], 0) / poly.length;
    const cz = poly.reduce((a, q) => a + q[1], 0) / poly.length;
    return inPoly(DOLORES_OUTLINE, cx, cz) && poly.every(([x, z]) => !onDoloresCourse(x, z, 1.5));
  });

const inBlock = (x: number, z: number): boolean => DOLORES_BLOCKS.some((b) => inPoly(b, x, z));

/** The park's trees, palms, benches, bins and fountains that stand clear of the course's corridor
 *  and of the courts (at the park's scale two benches come out inside the tennis court): the scenery
 *  builds them; the sim knows the trunks and seats. */
export const DOLORES_THINGS = (() => {
  const keep = (pts: [number, number][], r: number): [number, number][] =>
    pts.map(([x, z]) => doloresWorld(x, z)).filter(([x, z]) => inPoly(DOLORES_OUTLINE, x, z) && !onDoloresCourse(x, z, r) && !inBlock(x, z));
  return {
    trees: keep(DOLORES_PARK.trees, 1.4),
    palms: keep(DOLORES_PARK.palms, 1.4),
    benches: keep(DOLORES_PARK.benches, 1.1),
    bins: keep(DOLORES_PARK.bins, 0.8),
    fountains: keep(DOLORES_PARK.fountains, 0.8),
  };
})();

/** A seeded RNG for placing the park's people (the same every build). */
function parkRng(seed: number): () => number {
  let v = seed;
  return () => {
    v = (v * 16807) % 2147483647;
    return v / 2147483647;
  };
}

/** Picnics all over the lawn, the hill above all (blankets, friends, a dog now and then), well off the
 *  course's path, the courts and the playground: the scenery builds them and the sim knows them, so a
 *  car cutting across the lawn steers round them as round the benches. */
export const DOLORES_PICNICS: [number, number][] = (() => {
  const rng = parkRng(4815);
  const out: [number, number][] = [];
  const near = [...DOLORES_THINGS.trees, ...DOLORES_THINGS.benches];
  for (let tries = 0; tries < 900 && out.length < 34; tries++) {
    const [x, z] = doloresWorld(655 + rng() * 150, 210 + Math.sqrt(rng()) * 280);
    if (!inPoly(DOLORES_OUTLINE, x, z) || onDoloresCourse(x, z, 3.2) || inBlock(x, z)) continue;
    if (near.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 1.8) || out.some(([qx, qz]) => Math.hypot(qx - x, qz - z) < 3.2)) continue;
    out.push([x, z]);
  }
  return out;
})();

/** "Gay Beach", the top of the park by the corner of Church & 20th: rainbow umbrellas and flags on
 *  poles (every third a flag), each with a sunbather on a towel; solid, as the picnics are. */
export const DOLORES_BEACH: { x: number; z: number; kind: 'umbrella' | 'flag' }[] = (() => {
  const rng = parkRng(1969);
  const out: { x: number; z: number; kind: 'umbrella' | 'flag' }[] = [];
  for (let tries = 0; tries < 400 && out.length < 9; tries++) {
    const [x, z] = doloresWorld(655 + rng() * 75, 432 + rng() * 55);
    if (!inPoly(DOLORES_OUTLINE, x, z) || onDoloresCourse(x, z, 2.6) || inBlock(x, z)) continue;
    if (out.some((q) => Math.hypot(q.x - x, q.z - z) < 3) || DOLORES_PICNICS.some(([qx, qz]) => Math.hypot(qx - x, qz - z) < 2.4)) continue;
    out.push({ x, z, kind: out.length % 3 === 0 ? 'flag' : 'umbrella' });
  }
  return out;
})();

/** The banner arch over the course at the park's gate off Dolores St (the start gantry's kind, as
 *  Alamo Square's are): its posts stand where the scenery puts them and the sim knows them. */
export const DOLORES_ARCHES: { s: number; text: string; posts: [number, number][] }[] = [{ s: cnmMark('dolores', 'gate') + 9, text: 'DOLORES PARK' }].map((a) => {
  const p = pointAt(CASTRO_NOE_MISSION, a.s);
  const d = p.hw + 1.8;
  return { ...a, posts: [-d, d].map((dd) => [p.x - p.tz * dd, p.z + p.tx * dd] as [number, number]) };
});

/** How far out from the course's path its band of long grass reaches where a cut would pay (m). */
const BAND = 11;

/**
 * Dolores Park is open ground: from the gate on Dolores St to the corner of Church & 20th, a car can
 * leave the path anywhere and drive the lawn (slow), round the trees, palms and benches; the courts,
 * the playground and the restrooms are solid; long grass wherever a cut from the path would pay. Its
 * ground is the survey, at the park's scale.
 */
export const DOLORES_OPEN: OpenGround = (() => {
  const c = CASTRO_NOE_MISSION;
  const [ax, az] = DOLORES_ANCHOR;
  const dl = cnmChunk('dolores');
  const y0 = doloresHeight(ax - 10, az + 4);
  const land = (x: number, z: number): number => {
    const q = dl.toChunk(x, z);
    return dl.yToWorld((doloresHeight(ax + q.x / DOLORES_SCALE, az + q.z / DOLORES_SCALE) - y0) * DOLORES_SCALE);
  };
  const T = DOLORES_THINGS;
  return makeOpenGround(c, {
    id: 'dolores',
    outline: DOLORES_OUTLINE,
    s0: cnmMark('dolores', 'gate'),
    s1: cnmMark('dolores', 'out'),
    land,
    posts: [
      ...T.trees.map(([x, z]) => ({ x, z, r: 0.45 })),
      ...T.palms.map(([x, z]) => ({ x, z, r: 0.5 })),
      ...T.benches.map(([x, z]) => ({ x, z, r: 0.8 })),
      ...T.bins.map(([x, z]) => ({ x, z, r: 0.35 })),
      ...T.fountains.map(([x, z]) => ({ x, z, r: 0.4 })),
      ...DOLORES_ARCHES.flatMap((a) => a.posts.map(([x, z]) => ({ x, z, r: 0.4 }))),
      ...DOLORES_PICNICS.map(([x, z]) => ({ x, z, r: 1.0 })),
      ...DOLORES_BEACH.map((q) => ({ x: q.x, z: q.z, r: q.kind === 'flag' ? 0.15 : 0.3 })),
    ],
    blocks: DOLORES_BLOCKS,
    roughAt: (_x, _z, q) => q.d1 > PATH_PAVE + 1.6 && ((q.cut > 0 && q.d1 < PATH_PAVE + BAND) || (q.d2 < 22 && q.d2 > PATH_PAVE + 1.6)),
  });
})();

CASTRO_NOE_MISSION.open = [DOLORES_OPEN];

// ---------------------------------------------------------------------------------------------
// The J Church

/** The J Church's line up Church St: straight rails from where it comes out of the park's right of way
 *  at 18th to past Market (it carries on north, out of the race), on the southbound track. */
function jChurchLine(): TramLine {
  const c = CASTRO_NOE_MISSION;
  const m = cnmMark;
  const a = pointAt(c, m('dolores', '18th') + 6);
  const b = pointAt(c, m('church', 'market'));
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const ux = (b.x - a.x) / len;
  const uz = (b.z - a.z) / len;
  const x = a.x - uz * J_TRACK;
  const z = a.z + ux * J_TRACK;
  const profile: [number, number][] = [];
  for (let s = m('dolores', '18th') + 6; s <= m('church', 'market') + 0.1; s += 6) {
    const p = pointAt(c, s);
    profile.push([(p.x - a.x) * ux + (p.z - a.z) * uz, p.y]);
  }
  const last = profile[profile.length - 1];
  profile.push([len + 40, last[1]]);
  return { x, z, ux, uz, y: a.y, a0: -4, a1: len + 30, mouth: len + 30, profile, span: [m('dolores', '18th'), m('church', 'market')] };
}

export const J_CHURCH: TramLine = jChurchLine();

// ---------------------------------------------------------------------------------------------
// What's on the course each round

/**
 * The cast: Waymos on Castro St, 24th and Church; lowriders cruising Mission St, low and slow; drag
 * queens crossing at the rainbow crosswalks; strollers, a lot of them, crossing 24th in Noe Valley; a
 * mariachi trio playing outside El Farolito and a paletero pushing his cart across Mission St; dogs
 * loose in Dolores Park and picnickers taking in the view from the top; and the J Church up Church
 * St.
 */
export function populateCastroNoeMission(sim: RaceSim, r: () => number): void {
  const c = sim.course;
  const m = cnmMark;
  const lane = (hw = STREET_HW): number => (r() < 0.5 ? -1 : 1) * (hw * 0.5);
  // Waymos (they park before the next stretch they'd block).
  sim.addTraffic(m('castro', 'hill') + 6 + r() * 20, lane(), 4.5 + r() * 1.5, m('castro', 'steep') + 20);
  sim.addTraffic(m('noe', 'books') + r() * 20, lane(), 4 + r() * 1.5, m('noe', 'church'));
  sim.addTraffic(m('church', 'rails') + 46 + r() * 30, 3.2, 4.5 + r() * 1.5, m('church', 'market') - 4);
  // Lowriders cruising Mission St, low and slow (on hydraulics: the scenery bounces them).
  for (let k = 0; k < 3; k++) {
    const w = sim.addTraffic(m('missionSt', 'farolito') + 14 + k * 58 + r() * 14, lane(MISSION_HW), 3 + r() * 1.2, m('missionSt', '19th') + 30);
    w.dress = 'lowrider';
  }
  // A stalled Waymo with a protest cone on Church St.
  {
    const s = m('church', '16th') + 16 + r() * 12;
    const d = (r() < 0.5 ? -1 : 1) * (2.4 + r() * 1.4);
    const wm = sim.addStalled(s, d, Math.PI + (r() - 0.5) * 0.5);
    wm.cone = true;
    wm.hazard = true;
    for (let i = 0; i < 3; i++) sim.addCone(s - 6 - i * 2.2, Math.max(-5, Math.min(5, d + (r() - 0.5) * 3)));
  }
  const crosser = (s: number, hw: number, speed: number, dress: PedDress): void => {
    const dir: 1 | -1 = r() < 0.5 ? 1 : -1;
    const p = sim.addPed('crosser', s, dir * -(hw - 0.8), -(hw - 0.8), hw - 0.8, dir, speed, r() * 4);
    p.dress = dress;
  };
  // Drag queens crossing Castro St at the rainbow crosswalks (and one mid-block on the 500 block).
  crosser(m('castro', '18th') + 1.6, STREET_HW, 1.0 + r() * 0.3, 'drag');
  crosser(m('castro', '19th') - 1.6, STREET_HW, 1.0 + r() * 0.3, 'drag');
  crosser(m('castro', 'milk') + 18 + r() * 8, STREET_HW, 0.9 + r() * 0.3, 'drag');
  // Strollers crossing 24th: at every crosswalk in Noe Valley, and mid-block too.
  for (const s of [m('noe', 'noeSt') + 1.6, m('noe', 'noeSt') + 10.4, m('noe', 'sanchez') + 1.6, m('noe', 'vicksburg') + 10.4, m('noe', 'church') + 1.6]) {
    crosser(s, STREET_HW, 0.75 + r() * 0.3, 'stroller');
  }
  crosser(m('noe', 'books') + 16 + r() * 14, STREET_HW, 0.7 + r() * 0.3, 'stroller');
  crosser(m('noe', 'square') + 8 + r() * 8, STREET_HW, 0.7 + r() * 0.3, 'stroller');
  // A mariachi trio playing at the kerb outside El Farolito, up the block from the BART plaza (clear
  // of where the cars run wide out of the corner).
  for (let k = 0; k < 3; k++) {
    const s = m('missionSt', 'farolito') + 21 + k * 1.6;
    const p = sim.addPed('tourist', s, MISSION_HW - 0.6 - r() * 0.15, 0, 0, 1, 0, 0);
    p.d0 = MISSION_HW - 0.8;
    p.d1 = MISSION_HW - 0.5;
    p.dress = 'mariachi';
  }
  // A paletero pushing his cart across Mission St.
  crosser(m('missionSt', 'drafthouse') + 14 + r() * 10, MISSION_HW, 0.6 + r() * 0.2, 'paletero');
  crosser(m('mission24', 'murals') + 20 + r() * 10, STREET_HW, 0.6 + r() * 0.2, 'paletero');
  // Dolores Park: dogs loose on the hill, two of them chasers.
  {
    const s0 = m('dolores', 'gate') + 10;
    const s1 = m('dolores', 'out') - 6;
    for (let k = 0; k < 5; k++) {
      const s = s0 + ((k + 0.5) / 5) * (s1 - s0) + (r() - 0.5) * 6;
      const hw = pointAt(c, s).hw;
      sim.addDog(s, (r() * 2 - 1) * (hw - 1), s0, s1, -hw + 0.7, hw - 0.7, k < 2);
    }
  }
  // Picnickers at the top taking in the view (on the lawn on the outside of the path), one wandering.
  for (let k = 0; k < 4; k++) {
    const s = m('dolores', 'top') - 18 + k * 7 + r() * 3;
    const pt = pointAt(c, s);
    const d = -(pt.pave + 1.1 + r() * Math.max(0, pt.hw - pt.pave - 1.7));
    const p = sim.addPed('tourist', s, d, d, d, 1, 0, 0);
    p.dress = 'hipster';
    if (k === 1) {
      p.speed = 0.35;
      p.d0 = Math.min(d, -(pt.pave - 0.2));
      p.d1 = Math.max(d, -(pt.pave - 0.2));
    }
  }
  // The J Church: up Church St from the park's right of way and on north past Market, and back.
  {
    const L = J_CHURCH;
    sim.addCable({ x: L.x, z: L.z, ux: L.ux, uz: L.uz }, L.y, L.a0, L.a1, L.a0 + (L.a1 - L.a0) * r(), r() < 0.5 ? 1 : -1, 2 + r() * 4, L.span, 'J CHURCH', 'streetcar', L.profile);
  }
}

// ---------------------------------------------------------------------------------------------
// The venue

const mk = cnmMark;

export const CNM_VENUE: Venue = {
  id: 'castro-noe-mission',
  name: 'Castro, Noe & Mission',
  course: CASTRO_NOE_MISSION,
  boxes: [
    { s: mk('market', 'mid'), ds: [-4.5, 0, 4.5] },
    { s: mk('castro', 'milk') + 26, ds: [-4, 0, 4] },
    { s: mk('noe', 'books') + 26, ds: [-4, 0, 4] },
    { s: mk('missionSt', 'drafthouse') + 18, ds: [-4.5, 0, 4.5] },
    { s: mk('dolores', 'hill') + 10, ds: [-2.2, 2.2] },
    { s: mk('church', '16th') + 30, ds: [-4, 0, 4] },
  ],
  populate: populateCastroNoeMission,
  strip: [
    { label: 'START', s: CASTRO_NOE_MISSION.startS },
    { label: 'CASTRO HILL', s: mk('castro', '22nd') },
    { label: 'NOE VALLEY', s: mk('noe', 'noe') },
    { label: 'MISSION', s: mk('missionSt', 'farolito') },
    { label: 'DOLORES PARK', s: mk('dolores', 'gate') },
    { label: 'CHURCH ST', s: mk('church', 'rails') },
    { label: 'MARKET ST', s: mk('market', 'market') },
  ],
  splits: [
    { label: 'CASTRO HILL', s: mk('castro', '22nd') },
    { label: 'NOE VALLEY', s: mk('noe', 'noe') },
    { label: 'MISSION ST', s: mk('missionSt', 'farolito') },
    { label: 'DOLORES PARK', s: mk('dolores', 'gate') },
  ],
  starts: [{ id: 'grid', name: 'The grid', what: 'a full race', s: null }],
  hints: { driftUntil: Infinity },
  windWhere: 'on Market St',
  tip: 'Drive anywhere in Dolores Park, but the grass is slow: only a JUMP makes a cut pay · Tap the brake while turning to DRIFT · Boost up Market St · Gas as “1” fades: rocket start',
  warn: '⚠ The crests at 22nd & Castro and 24th & Dolores throw you in the air · Strollers cross 24th St, lowriders cruise Mission St',
  marks: {
    hill: mk('castro', 'hill'),
    summit: mk('castro', '22nd'),
    noe: mk('noe', 'noe'),
    mission: mk('missionSt', 'farolito'),
    eighteenth: mk('eighteenth', 'e18'),
    park: mk('dolores', 'gate'),
    church: mk('church', 'rails'),
    market: mk('market', 'market'),
  },
};


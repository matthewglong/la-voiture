// Old Stomping Grounds: the city's skyline beyond its neighbourhoods. Downtown far off to the east,
// standing behind the Painted Ladies as it does in the postcard from Alamo Square: the Transamerica
// Pyramid, Salesforce Tower's rounded crown, dark 555 California, 181 Fremont's slanted top, the
// Millennium Tower, 345 and 101 California, the Embarcadero Center's slabs, the stepped towers of
// the twenties and a crowd of plainer ones, with Coit Tower on Telegraph Hill to the north. And
// Sutro Tower on top of Twin Peaks to the southwest, its lamps blinking.
//
// The towers stand where they really are (latitude and longitude), the city turned and drawn in so
// the skyline is where it should be seen from the park, their heights cut to match the map's hills.
// Everything is merged into the scenery's builders; the lamps are one small mesh of their own.
import * as THREE from 'three';
import { GeoBuilder, box, cyl, meshOf, prism, type V3 } from '../geo';
import { makeRng } from '../util';
import { ROOF, worldUvBox } from '../victorian';
import { TWIN_PEAKS_SUMMITS, type Ctx } from './context';

// ---------------------------------------------------------------------------------------------
// Where the real city goes on the map

/** The postcard spot on the lawn in Alamo Square, in the world and on the map. */
const LAWN = { lat: 37.7763, lon: -122.4337, x: 150, z: -95 };
/** The real city is turned this far clockwise round the lawn (so downtown, east-northeast of the
 *  park, stands due east behind the Painted Ladies), drawn in to this fraction of its distances
 *  and pushed this far on east, past the last of the city's blocks. */
const TURN = (28 * Math.PI) / 180;
const DRAW_IN = 0.44;
const PUSH = 60;
/** Heights are this fraction of the real ones: a touch more than the map's hills get (about 0.6),
 *  so the towers clear the Painted Ladies' roofs from the park. */
const TALL = 0.72;
/** Metres per degree of longitude and latitude at the park. */
const E_PER_DEG = 111320 * Math.cos((LAWN.lat * Math.PI) / 180);
const N_PER_DEG = 110574;
/** How the street grids lie on the map, as turns about y (+x along the grid): the Financial
 *  District's (north–south in reality) and South of Market's (square to Market Street). */
const FIDI = -TURN;
const SOMA = -TURN + Math.PI / 4;
/** The city's plain blocks (distance.ts) stand out to here from the map's middle (their middles:
 *  they're up to 19 m across). Downtown's buildings stand beyond, so the two never build through
 *  each other. */
const CITY = { x: 135, z: -15, reach: 1400 };

/** Is a building reaching r from (x, z) clear of the city's blocks? */
function pastCity(x: number, z: number, r: number): boolean {
  return Math.hypot(x - CITY.x, z - CITY.z) > CITY.reach + 20 + r;
}

/** Metres east and north of the lawn, in reality. */
function real(lat: number, lon: number): { e: number; n: number } {
  return { e: (lon - LAWN.lon) * E_PER_DEG, n: (lat - LAWN.lat) * N_PER_DEG };
}

/** Where a real place (metres east and north of the lawn) is on the map. */
function mapOf(e: number, n: number): { x: number; z: number } {
  const c = Math.cos(TURN);
  const s = Math.sin(TURN);
  return { x: LAWN.x + PUSH + DRAW_IN * (e * c + n * s), z: LAWN.z - DRAW_IN * (n * c - e * s) };
}

/** Market Street, from Van Ness to the Ferry Building (real metres from the lawn). */
const MARKET = (() => {
  const a = real(37.7752, -122.4194);
  const b = real(37.7955, -122.3937);
  const l = Math.hypot(b.e - a.e, b.n - a.n);
  return { e: a.e, n: a.n, de: (b.e - a.e) / l, dn: (b.n - a.n) / l };
})();

function southOfMarket(e: number, n: number): boolean {
  return (e - MARKET.e) * MARKET.dn - (n - MARKET.n) * MARKET.de > 0;
}

/** How far east the land goes (real metres) at a given northing: the Embarcadero's shore, from
 *  Rincon Point past the Ferry Building to the piers below Telegraph Hill. */
function shore(n: number): number {
  if (n <= 1294) return 3960;
  if (n <= 2123) return 3934 + (3520 - 3934) * ((n - 1294) / (2123 - 1294));
  return 3520 + (3142 - 3520) * ((n - 2123) / (2455 - 2123));
}

// ---------------------------------------------------------------------------------------------
// Colours

const PYRAMID_WHITE = '#f1eee6';
const PEARL = '#d9dcdc';
const PEARL_CROWN = '#eceeed';
const DARK_GRANITE = '#3d3432';
const GRANITE = '#d9d1c3';
const TERRACOTTA = '#d8c6ab';
const CONCRETE_WHITE = '#ecebe5';
const BLUE_GLASS = '#a9bac8';
const STEEL_GLASS = '#8193a6';
const GREY_GLASS = '#98a4b0';
const ROOFTOP = '#a4a6a8';
const STONES = ['#e6e1d5', '#ddd6c7', '#d3ccbd', '#e9e5dc', '#cfc7b6', '#e2dccd'];
const GLASSES = ['#a9b8c6', '#9aabbb', '#b6c3ce', '#8c9dae', '#c3ccd3', '#aeb9c2'];
const DARKS = ['#5f6873', '#6b6560', '#57606b', '#4f5660'];
const HOUSES = ['#f1ece2', '#e8dccb', '#f3e3c8', '#dfe6e8', '#efd9cf', '#e4e7dc', '#ffffff'];
/** Downtown's low blocks: the city's pale tints (distance.ts), a little greyer. */
const LOW = ['#e3ddd0', '#d9d4ca', '#e6dccd', '#d5d9dc', '#e2d6cf', '#dcdfd3', '#ece8df'];

// ---------------------------------------------------------------------------------------------
// Pieces

/** A ring of a turned tower: its height, half-widths along its own x and z, and the colour of the
 *  band above it (the top ring's colours the roof). */
type Ring = [y: number, a: number, b: number, color: string];

/**
 * A tower turned on a superellipse (|x/a|^n + |z/b|^n = 1: n = 2 round, 4 a rounded square), in the
 * frame m: each band between two rings smooth all round but crisp against the next (so a setback
 * is a clean step), a flat roof on top unless the last ring closes. `tilt` slopes the roof, rising
 * towards the tower's +x by that much overall.
 */
function turned(b: GeoBuilder, m: THREE.Matrix4, rings: Ring[], n: number, seg = 28, tilt = 0): void {
  const e = 2 / n;
  const cs: [number, number][] = [];
  for (let j = 0; j < seg; j++) {
    const t = (j / seg) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    cs.push([Math.sign(c) * Math.abs(c) ** e, Math.sign(s) * Math.abs(s) ** e]);
  }
  const last = rings.length - 1;
  const lift = (i: number, cx: number): number => (i === last ? (tilt * cx) / 2 : 0);
  for (let i = 0; i < last; i++) {
    const [y0, a0, b0, color] = rings[i];
    const [y1, a1, b1] = rings[i + 1];
    const pos: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j < seg; j++) {
      const [cx, cz] = cs[j];
      pos.push(cx * a0, y0 + lift(i, cx), cz * b0, cx * a1, y1 + lift(i + 1, cx), cz * b1);
      const k = j * 2;
      const k2 = ((j + 1) % seg) * 2;
      idx.push(k, k + 1, k2, k + 1, k2 + 1, k2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    b.add(g, color, m);
  }
  const [yt, at, bt, roof] = rings[last];
  if (at < 0.05 || bt < 0.05) return;
  const pos: number[] = [0, yt, 0];
  const idx: number[] = [];
  for (let j = 0; j < seg; j++) {
    const [cx, cz] = cs[j];
    pos.push(cx * at, yt + lift(last, cx), cz * bt);
    idx.push(0, 1 + ((j + 1) % seg), 1 + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  b.add(g, roof, m);
}

/** A square pyramid (or spire): flat faces square to the frame's axes, half-width a at y0, its tip
 *  at y1, centred on (x, z) in the frame m. */
function pyramid(b: GeoBuilder, m: THREE.Matrix4, x: number, z: number, y0: number, y1: number, a: number, color: string): void {
  const cone = new THREE.ConeGeometry(a * Math.SQRT2, y1 - y0, 4, 1);
  const g = cone.toNonIndexed();
  cone.dispose();
  g.rotateY(Math.PI / 4);
  g.translate(x, (y0 + y1) / 2, z);
  g.computeVertexNormals();
  b.add(g, color, m);
}

/** Where a building stands: its middle on the map, the ground there, where its walls start (below
 *  the lowest ground under it, so it never floats) and its own frame (+x along its street grid;
 *  y stays the world's height). */
interface Site {
  x: number;
  z: number;
  g: number;
  y0: number;
  m: THREE.Matrix4;
}

function site(ctx: Ctx, x: number, z: number, r: number, rot: number): Site {
  const g = ctx.ground(x, z);
  let lo = g;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    lo = Math.min(lo, ctx.ground(x + Math.cos(a) * r, z + Math.sin(a) * r));
  }
  return { x, z, g, y0: lo - 4, m: new THREE.Matrix4().makeRotationY(rot).setPosition(x, 0, z) };
}

/** Ground taken by a building (or the hill): no other tower goes within r of (x, z). */
interface Disc {
  x: number;
  z: number;
  r: number;
}

// ---------------------------------------------------------------------------------------------
// Downtown's landmarks

function landmarks(ctx: Ctx, taken: Disc[]): void {
  const S = ctx.sinks;
  /** A landmark's site, from its real latitude and longitude; `r` is about its footprint's reach. */
  const at = (lat: number, lon: number, r: number, rot: number): Site => {
    const q = real(lat, lon);
    const p = mapOf(q.e, q.n);
    taken.push({ x: p.x, z: p.z, r });
    return site(ctx, p.x, p.z, r, rot);
  };

  // The Transamerica Pyramid (260 m): a white four-sided spike, with its lift and stair shafts
  // standing proud of two faces of the upper floors (the "wings").
  {
    const s = at(37.7952, -122.4028, 18, FIDI);
    const tip = s.g + 260 * TALL;
    const a = 15.5;
    pyramid(S.walls, s.m, 0, 0, s.y0, tip, a, PYRAMID_WHITE);
    const half = (y: number): number => (a * (tip - y)) / (tip - s.y0);
    const w0 = s.g + (tip - s.g) * 0.44;
    const w1 = s.g + (tip - s.g) * 0.72;
    for (const sx of [-1, 1]) box(S.walls, sx * 2, sx * (half(w0) + 1.4), w0, w1, -4.4, 4.4, PYRAMID_WHITE, s.m);
  }

  // Salesforce Tower (326 m): a rounded square that tapers as it rises, into a paler crown that
  // curves in at the top.
  {
    const s = at(37.7897, -122.3972, 17, SOMA);
    const h = 326 * TALL;
    const w = 15;
    const y = (f: number): number => s.g + h * f;
    turned(
      S.walls,
      s.m,
      [
        [s.y0, w, w, PEARL],
        [y(0.35), w * 0.97, w * 0.97, PEARL],
        [y(0.65), w * 0.92, w * 0.92, PEARL],
        [y(0.84), w * 0.86, w * 0.86, PEARL_CROWN],
        [y(0.91), w * 0.8, w * 0.8, PEARL_CROWN],
        [y(0.955), w * 0.7, w * 0.7, PEARL_CROWN],
        [y(0.985), w * 0.52, w * 0.52, PEARL_CROWN],
        [y(1), w * 0.3, w * 0.3, PEARL_CROWN],
      ],
      3.2,
      32,
    );
  }

  // 555 California (237 m): the dark granite one, its top stepping down in blocks.
  {
    const s = at(37.7921, -122.4035, 22, FIDI);
    const h = 237 * TALL;
    box(S.walls, -12, 6, s.y0, s.g + h, -13, 13, DARK_GRANITE, s.m);
    box(S.walls, -18, -12, s.y0, s.g + h * 0.955, -13, 9, DARK_GRANITE, s.m);
    box(S.walls, 6, 12, s.y0, s.g + h * 0.92, -9, 13, DARK_GRANITE, s.m);
    box(S.walls, 12, 18, s.y0, s.g + h * 0.87, -13, 4, DARK_GRANITE, s.m);
  }

  // 181 Fremont (245 m to its spire): pale glass, its top floors cut on a slant, and the spire.
  {
    const s = at(37.7896, -122.3951, 13, SOMA);
    const roof = s.g + 213 * TALL;
    const r = 8.5;
    const cut = roof - 14;
    box(S.walls, -r, r, s.y0, cut, -r, r, BLUE_GLASS, s.m);
    prism(
      S.walls,
      [
        [-r, cut, -r],
        [r, cut, -r],
        [r, roof, -r],
      ],
      [0, 0, 2 * r],
      BLUE_GLASS,
      s.m,
    );
    cyl(S.metal, [r * 0.55, roof - 6, 0], [r * 0.55, s.g + 245 * TALL, 0], 0.35, 0.9, 6, '#d6dade', s.m);
  }

  // The Millennium Tower (197 m): blue-grey glass, round-cornered, stepping in near the top.
  {
    const s = at(37.7904, -122.3963, 13, SOMA);
    const h = 197 * TALL;
    const y = (f: number): number => s.g + h * f;
    turned(
      S.walls,
      s.m,
      [
        [s.y0, 11.5, 8.5, STEEL_GLASS],
        [y(0.8), 11.5, 8.5, STEEL_GLASS],
        [y(0.8), 10.3, 7.6, STEEL_GLASS],
        [y(0.9), 10.3, 7.6, STEEL_GLASS],
        [y(0.9), 8.8, 6.5, STEEL_GLASS],
        [y(1), 8.8, 6.5, '#9aa9b8'],
      ],
      2.4,
      28,
    );
  }

  // One Rincon Hill (188 m): grey glass, a step at the top and a fin.
  {
    const s = at(37.7875, -122.3924, 12, SOMA);
    const h = 188 * TALL;
    box(S.walls, -8.5, 8.5, s.y0, s.g + h * 0.9, -8.5, 8.5, GREY_GLASS, s.m);
    box(S.walls, -6.5, 6.5, s.g + h * 0.9, s.g + h * 0.96, -7, 7, GREY_GLASS, s.m);
    box(S.walls, 1.5, 3.5, s.g + h * 0.96, s.g + h, -6, 6, GREY_GLASS, s.m);
  }

  // 345 California Center (211 m to its spires): granite, two pointed spires on top.
  {
    const s = at(37.7928, -122.4004, 15, FIDI);
    const tip = s.g + 211 * TALL;
    const roof = s.g + 211 * TALL * 0.84;
    box(S.walls, -13, 13, s.y0, roof, -8.5, 8.5, GRANITE, s.m);
    for (const sx of [-1, 1]) {
      box(S.walls, sx * 6.5, sx * 12, roof, roof + 7, -4.2, 4.2, GRANITE, s.m);
      pyramid(S.walls, s.m, sx * 9.25, 0, roof + 7, tip, 2.8, GRANITE);
    }
  }

  // 101 California (183 m): a glass cylinder with a sloping top.
  {
    const s = at(37.793, -122.3983, 12, FIDI);
    const top = s.g + 183 * TALL;
    turned(
      S.walls,
      s.m,
      [
        [s.y0, 11, 11, BLUE_GLASS],
        [top - 7, 11, 11, '#b8c6d2'],
      ],
      2,
      24,
      14,
    );
  }

  // The Embarcadero Center: four white slabs in a row, broadside to the city.
  for (const [lat, lon, tall] of [
    [37.7949, -122.4001, 172],
    [37.7948, -122.399, 125],
    [37.7947, -122.3978, 125],
    [37.7946, -122.3966, 174],
  ]) {
    const s = at(lat, lon, 19, FIDI);
    const top = s.g + tall * TALL;
    box(S.concrete, -6.5, 6.5, s.y0, top, -11, 11, CONCRETE_WHITE, s.m);
    box(S.concrete, -5, 5, s.y0, top - 8, -17, 17, CONCRETE_WHITE, s.m);
  }

  // Plainer towers that make the Financial District's roofline: 44 Montgomery, One Market, the
  // Chevron tower, 525 Market, 50 Fremont (dark) and 50 California.
  for (const [lat, lon, tall, hx, hz, color, rot] of [
    [37.7894, -122.4019, 172, 14.5, 8.5, GRANITE, FIDI],
    [37.7938, -122.395, 172, 14.5, 8.5, '#d6d1c6', SOMA],
    [37.7889, -122.4013, 174, 11, 8.5, '#dcd6ca', FIDI],
    [37.7904, -122.4, 161, 12, 9, '#cfd5d9', SOMA],
    [37.7907, -122.3976, 183, 10, 10, '#737c86', SOMA],
    [37.7937, -122.3978, 148, 12, 8, '#e3dccd', FIDI],
  ] as const) {
    const s = at(lat, lon, Math.hypot(hx, hz), rot);
    const top = s.g + tall * TALL;
    box(S.walls, -hx, hx, s.y0, top, -hz, hz, color, s.m);
    box(S.walls, -hx * 0.55, hx * 0.55, top, top + 5, -hz * 0.55, hz * 0.55, ROOFTOP, s.m);
  }

  // Park Tower at 250 Howard (184 m): blue glass, its crown angled.
  {
    const s = at(37.7895, -122.3935, 14, SOMA);
    const top = s.g + 184 * TALL;
    const r = 10;
    box(S.walls, -r, r, s.y0, top - 9, -r, r, '#9fb2c4', s.m);
    prism(
      S.walls,
      [
        [-r, top - 9, -r],
        [-r, top - 9, r],
        [-r, top, r],
      ],
      [2 * r, 0, 0],
      '#9fb2c4',
      s.m,
    );
  }

  // The towers of the twenties, stepped back as they rise: the Russ Building (133 m) and the
  // telephone company's building at 140 New Montgomery (133 m).
  {
    const s = at(37.7911, -122.4022, 20, FIDI);
    const h = 133 * TALL;
    box(S.walls, -17.5, 17.5, s.y0, s.g + h * 0.7, -13, 13, TERRACOTTA, s.m);
    box(S.walls, -10, 10, s.g + h * 0.7, s.g + h * 0.9, -9, 9, TERRACOTTA, s.m);
    box(S.walls, -6, 6, s.g + h * 0.9, s.g + h * 0.96, -5, 5, TERRACOTTA, s.m);
    pyramid(S.walls, s.m, 0, 0, s.g + h * 0.96, s.g + h, 3.5, TERRACOTTA);
  }
  {
    const s = at(37.7869, -122.3998, 16, SOMA);
    const h = 133 * TALL;
    box(S.walls, -11.5, 11.5, s.y0, s.g + h * 0.68, -11.5, 11.5, '#dcd2bf', s.m);
    box(S.walls, -9.5, 9.5, s.g + h * 0.68, s.g + h * 0.84, -8.5, 8.5, '#dcd2bf', s.m);
    box(S.walls, -6.5, 6.5, s.g + h * 0.84, s.g + h * 0.95, -5.5, 5.5, '#dcd2bf', s.m);
    box(S.walls, -3.5, 3.5, s.g + h * 0.95, s.g + h, -3, 3, '#dcd2bf', s.m);
  }
}

// ---------------------------------------------------------------------------------------------
// The crowd

/** A bell round a place (real metres), 1 at it. */
function bell(e: number, n: number, c: { e: number; n: number }, r: number): number {
  return Math.exp(-((e - c.e) ** 2 + (n - c.n) ** 2) / (2 * r * r));
}

/**
 * The plainer towers round the landmarks, where there's room: tallest in the Financial District
 * and round the Transbay terminal, lower towards the edges, never out in the Bay. Pale stone
 * (punched windows), glass (some with a sloping or pointed crown), stepped towers, and now and
 * then a dark one.
 */
function crowd(ctx: Ctx, rng: () => number, taken: Disc[]): void {
  const S = ctx.sinks;
  const fidi = real(37.7925, -122.401);
  const transbay = real(37.7893, -122.3962);
  let built = 0;
  for (let tries = 0; tries < 900 && built < 56; tries++) {
    const e = 2250 + rng() * 1750;
    const n = 850 + rng() * 1750;
    const hx = 7 + rng() * 6;
    const hz = 7 + rng() * 5;
    const pick = rng();
    const tone = rng();
    const crown = rng();
    const tall = rng();
    if (e > shore(n)) continue;
    const p = mapOf(e, n);
    const r = Math.hypot(hx, hz);
    if (!pastCity(p.x, p.z, r)) continue;
    if (taken.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < t.r + r + 3)) continue;
    taken.push({ x: p.x, z: p.z, r });
    built++;
    const core = Math.max(bell(e, n, fidi, 330), bell(e, n, transbay, 280));
    const h = (20 + 85 * core) * (0.55 + 0.45 * tall);
    const s = site(ctx, p.x, p.z, r, southOfMarket(e, n) ? SOMA : FIDI);
    const top = s.g + h;
    if (pick < 0.1 && h > 40) {
      // Dark glass.
      box(S.walls, -hx, hx, s.y0, top, -hz, hz, DARKS[Math.floor(tone * DARKS.length)], s.m);
      box(S.walls, -hx * 0.5, hx * 0.5, top, top + 4, -hz * 0.5, hz * 0.5, ROOFTOP, s.m);
    } else if (pick < 0.45) {
      // Glass, with a crown if it's tall.
      const color = GLASSES[Math.floor(tone * GLASSES.length)];
      if (h > 60 && crown < 0.3) {
        box(S.walls, -hx, hx, s.y0, top - 8, -hz, hz, color, s.m);
        prism(
          S.walls,
          [
            [-hx, top - 8, -hz],
            [hx, top - 8, -hz],
            [hx, top, -hz],
          ],
          [0, 0, 2 * hz],
          color,
          s.m,
        );
      } else if (h > 60 && crown < 0.5) {
        box(S.walls, -hx, hx, s.y0, top, -hz, hz, color, s.m);
        pyramid(S.walls, s.m, 0, 0, top, top + Math.min(hx, hz) * 1.3, Math.min(hx, hz) * 0.8, color);
      } else {
        box(S.walls, -hx, hx, s.y0, top, -hz, hz, color, s.m);
        box(S.walls, -hx * 0.6, hx * 0.6, top, top + 4.5, -hz * 0.5, hz * 0.5, ROOFTOP, s.m);
      }
    } else if (pick < 0.62 && h > 45) {
      // Stepped back as it rises.
      const color = STONES[Math.floor(tone * STONES.length)];
      box(S.walls, -hx, hx, s.y0, s.g + h * 0.72, -hz, hz, color, s.m);
      box(S.walls, -hx * 0.75, hx * 0.75, s.g + h * 0.72, s.g + h * 0.9, -hz * 0.75, hz * 0.75, color, s.m);
      box(S.walls, -hx * 0.45, hx * 0.45, s.g + h * 0.9, top, -hz * 0.45, hz * 0.45, color, s.m);
    } else {
      // Pale stone with punched windows, a cornice and a plant room on the roof.
      const color = STONES[Math.floor(tone * STONES.length)];
      S.facades.add(worldUvBox(-hx, hx, s.y0, top, -hz, hz), color, s.m);
      box(S.trim, -hx - 0.5, hx + 0.5, top - 1.4, top, -hz - 0.5, hz + 0.5, color, s.m);
      box(S.walls, -hx * 0.5, hx * 0.5, top, top + 4, -hz * 0.45, hz * 0.45, ROOFTOP, s.m);
    }
  }
}

/**
 * The low city round the towers' feet, out to the Bay: blocks of offices and flats on the grid,
 * 10–35 m tall (taller towards the middle of downtown), so the towers don't stand about on open
 * ground and the city's own blocks (distance.ts) run on into downtown's.
 */
function lowRise(ctx: Ctx, rng: () => number, taken: Disc[]): void {
  const S = ctx.sinks;
  const fidi = real(37.7925, -122.401);
  const transbay = real(37.7893, -122.3962);
  const STEP = 77;
  for (let e0 = 2300; e0 <= 4000; e0 += STEP) {
    for (let n0 = 700; n0 <= 2900; n0 += STEP) {
      const e = e0 + (rng() - 0.5) * 24;
      const n = n0 + (rng() - 0.5) * 24;
      const hx = 8 + rng() * 5;
      const hz = 8 + rng() * 5;
      const tall = rng();
      const tone = rng();
      if (e > shore(n) - 20) continue;
      const p = mapOf(e, n);
      const r = Math.hypot(hx, hz);
      if (!pastCity(p.x, p.z, Math.max(hx, hz))) continue;
      if (taken.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < t.r + r)) continue;
      const core = Math.max(bell(e, n, fidi, 420), bell(e, n, transbay, 380));
      const h = 10 + tall * 13 + core * 12;
      const s = site(ctx, p.x, p.z, r, southOfMarket(e, n) ? SOMA : FIDI);
      const top = s.g + h;
      S.facades.add(worldUvBox(-hx, hx, s.y0, top, -hz, hz), LOW[Math.floor(tone * LOW.length)], s.m);
      box(S.walls, -hx + 0.3, hx - 0.3, top - 0.02, top + 0.12, -hz + 0.3, hz - 0.3, ROOF, s.m);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Telegraph Hill and Coit Tower

/**
 * Telegraph Hill north of downtown: a hump with houses all down its slopes, the park on top and
 * Coit Tower, a white fluted column, standing up out of it.
 */
function telegraphHill(ctx: Ctx, rng: () => number, taken: Disc[]): void {
  const S = ctx.sinks;
  const q = real(37.8024, -122.4058);
  const p = mapOf(q.e, q.n);
  const g = ctx.ground(p.x, p.z);
  const R = 140;
  const H = 46;
  taken.push({ x: p.x, z: p.z, r: R * 1.1 });
  const m = new THREE.Matrix4().makeRotationY(FIDI).setPosition(p.x, 0, p.z);
  const SLOPE = '#b8b39d';
  const PARK = '#6f8d58';
  // The hill's shape: [height above the ground, reach] from the foot to the top.
  const shape: [number, number][] = [
    [-8, 1.1],
    [H * 0.3, 0.8],
    [H * 0.62, 0.52],
    [H * 0.86, 0.3],
    [H, 0.12],
  ];
  turned(
    S.foliage,
    m,
    shape.map(([y, f], i) => [g + y, R * f, R * f * 0.86, i >= 3 ? PARK : SLOPE] as Ring),
    2,
    24,
  );
  /** The hill's height at a fraction of its reach. */
  const hillAt = (f: number): number => {
    for (let i = 0; i < shape.length - 1; i++) {
      const [ya, fa] = shape[i];
      const [yb, fb] = shape[i + 1];
      if (f <= fa && f >= fb) return g + ya + ((yb - ya) * (fa - f)) / (fa - fb);
    }
    return g + H;
  };
  // Houses down its slopes (below the park on top).
  for (let k = 0; k < 44; k++) {
    const a = rng() * Math.PI * 2;
    const f = 0.34 + rng() * 0.66;
    const lx = Math.cos(a) * R * f * 0.92;
    const lz = Math.sin(a) * R * f * 0.86 * 0.92;
    const y = hillAt(f) - 3;
    const w = 4.5 + rng() * 2;
    const hh = 7 + rng() * 5;
    box(S.walls, lx - w, lx + w, y, y + hh, lz - w * 0.9, lz + w * 0.9, HOUSES[Math.floor(rng() * HOUSES.length)], m);
  }
  // Coit Tower (64 m): the fluted column, its gallery and the little lantern on top.
  const top = g + H + 40;
  cyl(S.walls, [0, g + H - 3, 0], [0, top, 0], 5, 5.4, 16, '#efebe2', m);
  cyl(S.walls, [0, top, 0], [0, top + 3.5, 0], 6, 6, 16, '#e6e1d6', m);
  cyl(S.walls, [0, top + 3.5, 0], [0, top + 6.5, 0], 3.4, 4.2, 12, '#e6e1d6', m);
  box(S.stone, -9, 9, g + H - 4, g + H + 2, -9, 9, '#d9d2c2', m);
}

// ---------------------------------------------------------------------------------------------
// Sutro Tower

/** The top of the hill under (x, z): climbing the ground in 4 m steps. */
function summit(ctx: Ctx, x: number, z: number): { x: number; y: number; z: number } {
  let y = ctx.ground(x, z);
  for (let i = 0; i < 250; i++) {
    let bx = x;
    let bz = z;
    let by = y;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const qx = x + Math.cos(a) * 4;
      const qz = z + Math.sin(a) * 4;
      const qy = ctx.ground(qx, qz);
      if (qy > by + 1e-3) {
        bx = qx;
        bz = qz;
        by = qy;
      }
    }
    if (bx === x && bz === z) break;
    x = bx;
    z = bz;
    y = by;
  }
  return { x, y, z };
}

/** A leg of the tower from a to c in red and white bands, thinning from r0 to r1. */
function bands(b: GeoBuilder, a: V3, c: V3, r0: number, r1: number, n: number): void {
  for (let k = 0; k < n; k++) {
    const f0 = k / n;
    const f1 = (k + 1) / n;
    const p0: V3 = [a[0] + (c[0] - a[0]) * f0, a[1] + (c[1] - a[1]) * f0, a[2] + (c[2] - a[2]) * f0];
    const p1: V3 = [a[0] + (c[0] - a[0]) * f1, a[1] + (c[1] - a[1]) * f1, a[2] + (c[2] - a[2]) * f1];
    cyl(b, p0, p1, r0 + (r1 - r0) * f1, r0 + (r1 - r0) * f0, 8, k % 2 ? '#f4f1ea' : '#d8392f');
  }
}

/**
 * Sutro Tower on top of Twin Peaks: three red-and-white legs that pinch in at the waist and splay
 * out again to three antenna masts, braced at a few heights, with red lamps on the masts and the
 * crossarms that blink (their own mesh, switched in an updater).
 */
function sutroTower(ctx: Ctx): void {
  const S = ctx.sinks;
  // The first of the two summits (osg/index.ts), or rather the top of the hill it's on.
  const [px, pz] = TWIN_PEAKS_SUMMITS[0];
  const { x, y, z } = summit(ctx, px, pz);
  const H = 146;
  const MAST = 24;
  const waist = 0.45 * H;
  const legs = [0, 1, 2].map((k) => (k / 3) * Math.PI * 2 + 0.5);
  const lamps: V3[] = [];
  const at = (a: number, r: number, h: number): V3 => [x + Math.cos(a) * r, y + h, z + Math.sin(a) * r];
  /** The legs' distance from the middle at a fraction of the height. */
  const reach = (f: number): number => (f < 0.45 ? 22 + (5.6 - 22) * (f / 0.45) : 5.6 + (15 - 5.6) * ((f - 0.45) / 0.55));
  for (const a of legs) {
    const fx = x + Math.cos(a) * 22;
    const fz = z + Math.sin(a) * 22;
    const fy = ctx.ground(fx, fz);
    const foot: V3 = [fx, Math.min(fy, y) - 1.5, fz];
    const mid = at(a, reach(0.45), waist);
    const top = at(a, reach(1), H);
    bands(S.walls, foot, mid, 2.4, 1.9, 7);
    bands(S.walls, mid, top, 1.9, 1.5, 7);
    cyl(S.walls, top, [top[0], top[1] + MAST, top[2]], 0.55, 0.95, 6, '#f4f1ea');
    lamps.push([top[0], top[1] + MAST + 1.2, top[2]]);
    box(S.concrete, fx - 3, fx + 3, fy - 3, fy + 1.4, fz - 3, fz + 3, '#c9c2b2');
  }
  // Cross bracing: platforms at a few heights, the top one red.
  for (const f of [0.2, 0.45, 0.66, 0.84, 1]) {
    const r = reach(f);
    for (let k = 0; k < 3; k++) {
      cyl(S.walls, at(legs[k], r, H * f), at(legs[(k + 1) % 3], r, H * f), 1, 1, 6, f === 1 ? '#d8392f' : '#e9e4da');
    }
    if (f === 0.45 || f === 1) for (const a of legs) lamps.push(at(a + 0.18, r + 0.5, H * f + 1.8));
  }
  // The lamps: one mesh, blinking.
  const lb = new GeoBuilder();
  for (const [lx, ly, lz] of lamps) lb.add(new THREE.SphereGeometry(2.3, 8, 6).translate(lx, ly, lz), '#ffffff');
  const lampMat = new THREE.MeshStandardMaterial({ color: '#ff2a20', emissive: '#ff1a10', emissiveIntensity: 1.6 });
  const lampMesh = meshOf(lb, lampMat, 'sutroLamps', false, false);
  ctx.group.add(lampMesh);
  ctx.updaters.push((_dt, t) => {
    lampMesh.visible = Math.sin(t * 2.4) > 0.2;
  });
}

// ---------------------------------------------------------------------------------------------

/** Downtown to the east (its landmarks, Telegraph Hill, the crowd of towers round them and the low
 *  city at their feet), and Sutro Tower on Twin Peaks. */
export function buildSkyline(ctx: Ctx): void {
  const rng = makeRng(1906);
  const taken: Disc[] = [];
  landmarks(ctx, taken);
  telegraphHill(ctx, rng, taken);
  crowd(ctx, rng, taken);
  lowRise(ctx, rng, taken);
  sutroTower(ctx);
}

// Victorian row houses: the pastel Queen Annes and Italianates that line San Francisco's streets,
// shared by every map that has a city (Russian Hill's, Old Stomping Grounds'), plus the plain
// background buildings behind them. Built on a lot (a frontage on the property line, the house
// extending away from the street) over a map's own ground (HouseSite); random within the palettes
// unless a style pins a house down (the Painted Ladies). Merged into the caller's builders.
import * as THREE from 'three';
import { GeoBuilder, box, obox, prism, rbox, shade } from './geo';
import { canvasTexture } from './util';

/** Sidewalk kerb height and house depth (m) unless a site says otherwise. */
export const CURB = 0.18;
export const HOUSE_DEPTH = 12;

/** Where houses stand: the map's ground, and its sidewalks' kerb height and the houses' depth. */
export interface HouseSite {
  ground(x: number, z: number): number;
  curb?: number;
  depth?: number;
}

/** A house pinned down (anything left out is random, as for any other house). */
export interface HouseStyle {
  color?: string;
  /** The bands, hoods and cornice (and the trim, unless `trim` is set). */
  accent?: string;
  trim?: string;
  door?: string;
  floors?: number;
  /** A front gable (else an Italianate cornice). */
  queenAnne?: boolean;
  doorLeft?: boolean;
  garage?: boolean;
  /** The fish-scale shingles, a painted panel in the gable, the roofing. */
  shingles?: string;
  gable?: string;
  roof?: string;
  /** A round corner tower: +1 on the far end of the frontage, -1 on the near end. */
  turret?: number;
}

export interface HouseOpts {
  exposeU0?: boolean;
  exposeUW?: boolean;
  style?: HouseStyle;
}

// ---------------------------------------------------------------------------------------------
// Palettes.

export const HOUSE_COLORS = [
  '#62cfa3', // mint
  '#ffa274', // peach
  '#ab8ef0', // lavender
  '#ffd154', // butter
  '#68b6f2', // sky
  '#ff8db6', // pink
  '#9dcc66', // sage
  '#ff7d66', // coral
  '#58c8c1', // aqua
  '#e592d6', // orchid
  '#f4b64c', // apricot
  '#8aa0f5', // periwinkle
];
export const TRIM = '#fffaf0';
export const ACCENTS = ['#2f6f8f', '#8a2d4a', '#3d5a80', '#c9a227', '#6b4c9a', '#2e7d6b', '#d9534f'];
export const DOORS = ['#b3263a', '#1f3d6b', '#2f6b4f', '#7a4a2a', '#f2c14e', '#5b3a82', '#0f7c7c'];
export const ROOF = '#8d9199';



// ---------------------------------------------------------------------------------------------
// Houses.

export interface HouseSinks {
  walls: GeoBuilder;
  trim: GeoBuilder;
  glass: GeoBuilder;
}

interface Face {
  /** Face start point in house-local (u, w). */
  ou: number;
  ow: number;
  /** Unit direction along the face in (u, w). */
  du: number;
  dw: number;
  /** Outward normal in (u, w). */
  nu: number;
  nw: number;
  /** Rotation about y that maps the box x-axis onto the face direction. */
  rotY: number;
}

const MAIN_FACE: Face = { ou: 0, ow: 0, du: 1, dw: 0, nu: 0, nw: -1, rotY: 0 };

/** Box on a face: along-face [a0,a1], height [y0,y1], out from the face [c0,c1]. */
function faceBox(b: GeoBuilder, m: THREE.Matrix4, f: Face, a0: number, a1: number, y0: number, y1: number, c0: number, c1: number, color: THREE.ColorRepresentation): void {
  const a = (a0 + a1) / 2;
  const c = (c0 + c1) / 2;
  const cu = f.ou + f.du * a + f.nu * c;
  const cw = f.ow + f.dw * a + f.nw * c;
  obox(b, [cu, (y0 + y1) / 2, cw], [a1 - a0, y1 - y0, c1 - c0], [0, f.rotY, 0], color, m);
}

function faceWindow(s: HouseSinks, m: THREE.Matrix4, f: Face, a0: number, a1: number, y0: number, y1: number, hood: THREE.ColorRepresentation, arched = false): void {
  const w = a1 - a0;
  faceBox(s.trim, m, f, a0 - 0.14, a1 + 0.14, y0 - 0.12, y1 + 0.12, -0.02, 0.07, TRIM);
  faceBox(s.glass, m, f, a0, a1, y0, y1, 0.0, 0.1, '#ffffff');
  faceBox(s.trim, m, f, a0 + w / 2 - 0.035, a0 + w / 2 + 0.035, y0, y1, 0.0, 0.13, TRIM);
  faceBox(s.trim, m, f, a0, a1, y0 + (y1 - y0) * 0.58 - 0.035, y0 + (y1 - y0) * 0.58 + 0.035, 0.0, 0.13, TRIM);
  faceBox(s.trim, m, f, a0 - 0.26, a1 + 0.26, y0 - 0.26, y0 - 0.12, -0.02, 0.24, TRIM);
  if (arched) {
    faceBox(s.trim, m, f, a0 - 0.3, a1 + 0.3, y1 + 0.12, y1 + 0.3, -0.02, 0.26, hood);
    faceBox(s.trim, m, f, a0 - 0.1, a1 + 0.1, y1 + 0.3, y1 + 0.46, -0.02, 0.2, hood);
  } else {
    faceBox(s.trim, m, f, a0 - 0.3, a1 + 0.3, y1 + 0.12, y1 + 0.3, -0.02, 0.28, hood);
  }
}

/** Plain framed window (backs and side walls). */
function simpleWindow(s: HouseSinks, m: THREE.Matrix4, f: Face, a0: number, a1: number, y0: number, y1: number): void {
  faceBox(s.trim, m, f, a0 - 0.12, a1 + 0.12, y0 - 0.12, y1 + 0.12, -0.02, 0.06, TRIM);
  faceBox(s.glass, m, f, a0, a1, y0, y1, 0.0, 0.09, '#ffffff');
  faceBox(s.trim, m, f, a0 - 0.2, a1 + 0.2, y0 - 0.24, y0 - 0.12, -0.02, 0.18, TRIM);
}

/** Rows of plain windows along a wall face of length `len`, one row per floor. */
function wallWindows(s: HouseSinks, m: THREE.Matrix4, f: Face, len: number, yb: number, floors: number, fh: number, spacing: number): void {
  const n = Math.max(1, Math.floor((len - 1) / spacing));
  const step = len / n;
  for (let fl = 0; fl < floors; fl++) {
    const y0 = yb + fl * fh + 0.9;
    for (let k = 0; k < n; k++) {
      const a = step * (k + 0.5);
      simpleWindow(s, m, f, a - 0.5, a + 0.5, y0, y0 + 1.6);
    }
  }
}

/**
 * Where a house stands: its frontage starts at (ox, oz) on the property line and runs along (ux, uz)
 * for W metres; the house extends away from the street, to the left of that direction.
 */
export interface Lot {
  ox: number;
  oz: number;
  ux: number;
  uz: number;
  W: number;
}

/**
 * A Victorian row house on a lot: a garage plinth or a raised ground floor with a stoop down to the
 * sidewalk, a bay window over the upper floors, and a Queen Anne front gable with fish-scale
 * shingles or an Italianate bracketed cornice. Random unless `style` pins it down (the Painted
 * Ladies); the first and last of a row show their side walls (exposeU0 / exposeUW).
 */
export function buildHouse(s: HouseSinks, lot: Lot, rng: () => number, site: HouseSite, opts: HouseOpts = {}): void {
  const exposeU0 = opts.exposeU0 ?? false;
  const exposeUW = opts.exposeUW ?? false;
  const st: HouseStyle = opts.style ?? {};
  const ground = site.ground;
  const curb = site.curb ?? CURB;
  const W = lot.W;
  const D = site.depth ?? HOUSE_DEPTH;
  // Local u runs along the frontage, w into the house: w = u x up.
  const wx = -lot.uz;
  const wz = lot.ux;
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(lot.ux, 0, lot.uz),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(wx, 0, wz),
  );
  m.setPosition(lot.ox, 0, lot.oz);
  const uToX = (u: number): number => lot.ox + lot.ux * u;
  const groundHi = Math.max(ground(lot.ox, lot.oz), ground(lot.ox + lot.ux * W, lot.oz + lot.uz * W));
  const groundLo = Math.min(
    ground(lot.ox, lot.oz),
    ground(lot.ox + lot.ux * W, lot.oz + lot.uz * W),
    ground(lot.ox + wx * D, lot.oz + wz * D),
    ground(lot.ox + lot.ux * W + wx * D, lot.oz + lot.uz * W + wz * D),
  );

  const color = st.color ?? HOUSE_COLORS[Math.floor(rng() * HOUSE_COLORS.length)];
  const accent = st.accent ?? ACCENTS[Math.floor(rng() * ACCENTS.length)];
  const trimAccent = st.trim ?? (rng() < 0.45 ? accent : TRIM);
  const floors = st.floors ?? (rng() < 0.3 ? 2 : 3);
  const fh = 3.1;
  const queenAnne = st.queenAnne ?? rng() < 0.45;
  const yb = groundHi + curb + 0.35;
  const yFound = groundLo + curb - 0.9;
  const wallTop = yb + floors * fh + (queenAnne ? 0.25 : 1.25);

  // Foundation / garage plinth and the main body.
  box(s.walls, 0.06, W - 0.06, yFound, yb + 0.02, 0.1, D, shade(color, 0.72), m);
  rbox(s.walls, 0, W, yb, wallTop, 0, D, 0.22, color, m);
  // Roof membrane seen from above.
  box(s.walls, 0.3, W - 0.3, wallTop - 0.02, wallTop + 0.04, queenAnne ? 6 : 0.9, D - 0.3, ROOF, m);
  if (rng() < 0.35) {
    const cu = 0.8 + rng() * (W - 2);
    box(s.walls, cu, cu + 0.7, wallTop, wallTop + 1.1, D - 3, D - 2.2, '#b4574a', m);
  }

  // Back wall windows, and side windows where the house faces a cross street.
  wallWindows(s, m, { ou: W, ow: D, du: -1, dw: 0, nu: 0, nw: 1, rotY: Math.PI }, W, yb, floors, fh, 2.6);
  const sideLeft: Face = { ou: 0, ow: D, du: 0, dw: -1, nu: -1, nw: 0, rotY: Math.PI / 2 };
  const sideRight: Face = { ou: W, ow: 0, du: 0, dw: 1, nu: 1, nw: 0, rotY: -Math.PI / 2 };
  if (exposeU0) wallWindows(s, m, sideLeft, D, yb, floors, fh, 3.0);
  if (exposeUW) wallWindows(s, m, sideRight, D, yb, floors, fh, 3.0);

  // Ground floor: door with stoop, plus a garage door or a window.
  const doorLeft = st.doorLeft ?? rng() < 0.5;
  const da0 = doorLeft ? 0.55 : W - 1.65;
  const da1 = da0 + 1.1;
  const doorColor = st.door ?? DOORS[Math.floor(rng() * DOORS.length)];
  faceBox(s.trim, m, MAIN_FACE, da0 - 0.18, da1 + 0.18, yb, yb + 2.55, -0.02, 0.08, TRIM);
  faceBox(s.trim, m, MAIN_FACE, da0, da1, yb, yb + 2.3, 0.0, 0.1, doorColor);
  faceBox(s.glass, m, MAIN_FACE, da0 + 0.1, da1 - 0.1, yb + 2.34, yb + 2.5, 0.0, 0.11, '#ffffff');
  faceBox(s.trim, m, MAIN_FACE, da0 - 0.35, da1 + 0.35, yb + 2.6, yb + 2.78, -0.02, 0.5, trimAccent);
  // Stoop down to the sidewalk (the sidewalk drops along the facade on the slope).
  const doorU = (da0 + da1) / 2;
  const walk = ground(uToX(doorU), lot.oz + lot.uz * doorU) + curb;
  const rise = Math.max(0.2, yb - walk);
  const steps = Math.max(1, Math.round(rise / 0.2));
  for (let k = 0; k < steps; k++) {
    const yTop = yb - k * (rise / steps);
    faceBox(s.trim, m, MAIN_FACE, da0 - 0.15, da1 + 0.15, walk - 0.1, yTop, 0, 0.32 * (k + 1), '#ece6da');
  }

  const other0 = doorLeft ? 2.1 : 0.5;
  const other1 = doorLeft ? W - 0.5 : W - 2.1;
  if ((st.garage ?? rng() < 0.55) && other1 - other0 > 2.6) {
    // Garage door with panel grooves.
    const g0 = other0 + 0.2;
    const g1 = Math.min(other1 - 0.2, g0 + 2.7);
    faceBox(s.trim, m, MAIN_FACE, g0 - 0.15, g1 + 0.15, yb, yb + 2.45, -0.02, 0.08, TRIM);
    faceBox(s.trim, m, MAIN_FACE, g0, g1, yb, yb + 2.3, 0, 0.1, '#f3efe6');
    for (let k = 1; k < 4; k++) {
      faceBox(s.trim, m, MAIN_FACE, g0, g1, yb + k * 0.57 - 0.03, yb + k * 0.57 + 0.03, 0, 0.12, '#cfc8ba');
    }
  } else {
    const wa = (other0 + other1) / 2;
    faceWindow(s, m, MAIN_FACE, wa - 0.55, wa + 0.55, yb + 0.9, yb + 2.5, trimAccent);
  }

  // Bay window over the upper floors on the side opposite the door.
  const bayW = Math.min(3.4, W * 0.5);
  const b0 = doorLeft ? W - 0.45 - bayW : 0.45;
  const b1 = b0 + bayW;
  const dB = 0.85;
  const bayY0 = yb + fh - 0.25;
  const bayY1 = yb + floors * fh - 0.1;
  const bayColor = rng() < 0.3 ? shade(color, 0.93) : new THREE.Color(color);
  prism(
    s.walls,
    [
      [b0, bayY0, 0],
      [b0 + dB, bayY0, -dB],
      [b1 - dB, bayY0, -dB],
      [b1, bayY0, 0],
    ],
    [0, bayY1 - bayY0, 0],
    bayColor,
    m,
  );
  // Bay cap and corbel.
  prism(
    s.trim,
    [
      [b0 - 0.25, bayY1, 0],
      [b0 + dB - 0.1, bayY1, -dB - 0.28],
      [b1 - dB + 0.1, bayY1, -dB - 0.28],
      [b1 + 0.25, bayY1, 0],
    ],
    [0, 0.32, 0],
    trimAccent,
    m,
  );
  prism(
    s.trim,
    [
      [b0 + 0.1, bayY0 - 0.3, 0],
      [b0 + dB, bayY0 - 0.3, -dB + 0.1],
      [b1 - dB, bayY0 - 0.3, -dB + 0.1],
      [b1 - 0.1, bayY0 - 0.3, 0],
    ],
    [0, 0.3, 0],
    TRIM,
    m,
  );
  const r2 = Math.SQRT1_2;
  const faces: [Face, number][] = [
    [{ ou: b0 + dB, ow: -dB, du: 1, dw: 0, nu: 0, nw: -1, rotY: 0 }, bayW - 2 * dB],
    [{ ou: b0, ow: 0, du: r2, dw: -r2, nu: -r2, nw: -r2, rotY: Math.PI / 4 }, dB * Math.SQRT2],
    [{ ou: b1 - dB, ow: -dB, du: r2, dw: r2, nu: r2, nw: -r2, rotY: -Math.PI / 4 }, dB * Math.SQRT2],
  ];
  for (let fl = 1; fl < floors; fl++) {
    const y0 = yb + fl * fh + 0.55;
    const y1 = y0 + 1.85;
    for (const [f, len] of faces) {
      const inset = len > 1.4 ? 0.3 : 0.2;
      faceWindow(s, m, f, inset, len - inset, y0, y1, trimAccent, !queenAnne && f === faces[0][0]);
    }
    // Flat window beside the bay, above the door.
    const wa = doorLeft ? (0.3 + b0) / 2 : (b1 + W - 0.3) / 2;
    if (Math.abs((doorLeft ? b0 : W - b1) - 0.3) > 1.3) {
      faceWindow(s, m, MAIN_FACE, wa - 0.5, wa + 0.5, y0, y1, trimAccent, !queenAnne);
    }
    // Floor band.
    faceBox(s.trim, m, MAIN_FACE, 0, W, yb + fl * fh - 0.1, yb + fl * fh + 0.1, -0.02, 0.12, TRIM);
  }

  if (st.turret) {
    // A round corner tower rising past the eaves to a candle-snuffer roof (722 Steiner's).
    const tr = Math.min(1.9, W * 0.2);
    const cu = st.turret > 0 ? W - tr * 0.7 : tr * 0.7;
    const tw = -tr * 0.55;
    const top = wallTop + 1.4;
    const tg = new THREE.CylinderGeometry(tr, tr, top - yb, 10);
    tg.translate(cu, (top + yb) / 2, tw);
    s.walls.add(tg, color, m);
    for (let fl = 1; fl <= floors; fl++) {
      const ring = new THREE.CylinderGeometry(tr + 0.06, tr + 0.06, 0.18, 10);
      ring.translate(cu, yb + fl * fh - 0.1, tw);
      s.trim.add(ring, trimAccent, m);
    }
    const cone = new THREE.ConeGeometry(tr + 0.35, 3.6, 10);
    cone.translate(cu, top + 1.8, tw);
    s.walls.add(cone, st.roof ?? ROOF, m);
    const fin = new THREE.SphereGeometry(0.16, 8, 6);
    fin.translate(cu, top + 3.7, tw);
    s.trim.add(fin, TRIM, m);
  }

  if (queenAnne) {
    // Front gable facing the street with an attic window and trimmed eaves.
    const gh = W * 0.42;
    const eave = wallTop;
    prism(
      s.walls,
      [
        [0.05, eave, 0],
        [W - 0.05, eave, 0],
        [W / 2, eave + gh, 0],
      ],
      [0, 0, 6.2],
      color,
      m,
    );
    const ang = Math.atan2(gh, W / 2);
    const len = Math.hypot(W / 2, gh) + 0.5;
    for (const sgn of [-1, 1]) {
      const cu = W / 2 + (sgn * (W / 2)) / 2;
      const cy = eave + gh / 2 + 0.12;
      obox(s.walls, [cu, cy + 0.12, 2.9], [len, 0.16, 6.9], [0, 0, -sgn * ang], ROOF, m);
      obox(s.trim, [cu, cy, -0.38], [len, 0.26, 0.2], [0, 0, -sgn * ang], trimAccent, m);
    }
    faceWindow(s, m, MAIN_FACE, W / 2 - 0.45, W / 2 + 0.45, eave + 0.45, eave + Math.min(1.6, gh - 0.5), trimAccent);
    faceBox(s.trim, m, MAIN_FACE, -0.1, W + 0.1, eave - 0.3, eave, -0.02, 0.35, trimAccent);
    // Fish-scale shingle band.
    faceBox(s.walls, m, MAIN_FACE, 0.2, W - 0.2, eave - 1.0, eave - 0.3, -0.02, 0.06, st.shingles ?? shade(color, 0.88));
    if (st.gable) {
      // A painted panel in the gable (the sunburst the Painted Ladies are known for).
      prism(s.trim, [
        [W * 0.2, eave + 0.2, -0.05],
        [W * 0.8, eave + 0.2, -0.05],
        [W / 2, eave + gh * 0.72, -0.05],
      ], [0, 0, 0.1], st.gable, m);
    }
  } else {
    // Italianate: bracketed cornice over a frieze, parapet above the roof.
    faceBox(s.trim, m, MAIN_FACE, -0.1, W + 0.1, wallTop - 0.5, wallTop, -0.02, 0.62, TRIM);
    faceBox(s.trim, m, MAIN_FACE, 0, W, wallTop - 1.15, wallTop - 0.5, -0.02, 0.1, accent);
    const n = Math.max(3, Math.round(W / 1.1));
    for (let k = 0; k <= n; k++) {
      const a = 0.25 + (k * (W - 0.5)) / n;
      faceBox(s.trim, m, MAIN_FACE, a - 0.11, a + 0.11, wallTop - 1.0, wallTop - 0.5, -0.02, 0.5, TRIM);
    }
  }
}

export function worldUvBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  const floorY = y1 - Math.floor((y1 - y0) / 3.2) * 3.2;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i));
    const along = nx > 0.5 ? p.getZ(i) : p.getX(i);
    uv.setXY(i, along / 4, (p.getY(i) - floorY) / 3.2);
  }
  return g;
}

export function facadeTexture(): THREE.CanvasTexture {
  // One tile = 4 m wide × 3.2 m tall (one window per floor); white walls get tinted by vertex colours.
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      // floor line
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(0, h - 10, w, 10);
      const wx = 64;
      const wy = 44;
      const ww = 128;
      const wh = 150;
      ctx.fillStyle = 'rgba(40,30,30,0.35)';
      ctx.fillRect(wx - 12, wy - 12, ww + 24, wh + 24);
      ctx.fillStyle = '#fbfbf7';
      ctx.fillRect(wx - 9, wy - 9, ww + 18, wh + 18);
      const grad = ctx.createLinearGradient(0, wy, 0, wy + wh);
      grad.addColorStop(0, '#6f8fb3');
      grad.addColorStop(0.5, '#2d3f5c');
      grad.addColorStop(1, '#22304a');
      ctx.fillStyle = grad;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = '#fbfbf7';
      ctx.fillRect(wx + ww / 2 - 4, wy, 8, wh);
      ctx.fillRect(wx, wy + wh * 0.42, ww, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(wx + 10, wy + wh);
      ctx.lineTo(wx + 50, wy);
      ctx.lineTo(wx + 70, wy);
      ctx.lineTo(wx + 30, wy + wh);
      ctx.fill();
      // sill
      ctx.fillStyle = '#fbfbf7';
      ctx.fillRect(wx - 16, wy + wh + 10, ww + 32, 10);
    },
    { repeat: [1, 1] },
  );
}

// ---------------------------------------------------------------------------------------------
// Frontages.

export interface Frontage {
  ox: number;
  oz: number;
  ux: number;
  uz: number;
  len: number;
}

/** Victorian row houses filling a frontage (the first and last show their side walls). */
export function rowHouses(s: HouseSinks, f: Frontage, rng: () => number, site: HouseSite): void {
  const widths: number[] = [];
  let total = 0;
  while (total < f.len - 6) {
    const w = 6 + rng() * 2;
    widths.push(w);
    total += w;
  }
  if (widths.length === 0) return;
  const scale = f.len / total;
  let u = 0;
  widths.forEach((w, i) => {
    const ww = w * scale;
    buildHouse(s, { ox: f.ox + f.ux * u, oz: f.oz + f.uz * u, ux: f.ux, uz: f.uz, W: ww }, rng, site, { exposeU0: i === 0, exposeUW: i === widths.length - 1 });
    u += ww;
  });
}

/** Plain pastel buildings with a tiled window texture (facadeTexture), filling a frontage to a depth. */
export function rowBlocks(walls: GeoBuilder, roofs: GeoBuilder, f: Frontage, depth: number, rng: () => number, site: HouseSite, height: [number, number] = [8, 19]): void {
  const gy = (x: number, z: number): number => site.ground(x, z);
  const CURB = site.curb ?? 0.18;
  const wx = -f.uz;
  const wz = f.ux;
  let u = 0;
  while (u < f.len - 4) {
    const w = Math.min(f.len - u, 7 + rng() * 7);
    const a = u + 0.15;
    const b = u + w - 0.15;
    const xs = [f.ox + f.ux * a, f.ox + f.ux * b, f.ox + f.ux * a + wx * depth, f.ox + f.ux * b + wx * depth];
    const zs = [f.oz + f.uz * a, f.oz + f.uz * b, f.oz + f.uz * a + wz * depth, f.oz + f.uz * b + wz * depth];
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const z0 = Math.min(...zs);
    const z1 = Math.max(...zs);
    const hi = Math.max(gy(x0, z0), gy(x1, z0), gy(x0, z1), gy(x1, z1)) + CURB;
    const lo = Math.min(gy(x0, z0), gy(x1, z0), gy(x0, z1), gy(x1, z1)) - 0.5;
    const hgt = height[0] + rng() * (height[1] - height[0]);
    const color = shade(HOUSE_COLORS[Math.floor(rng() * HOUSE_COLORS.length)], 0.95);
    walls.add(worldUvBox(x0, x1, lo, hi + hgt, z0, z1), color);
    box(roofs, x0 + 0.3, x1 - 0.3, hi + hgt - 0.02, hi + hgt + 0.08, z0 + 0.3, z1 - 0.3, ROOF);
    if (rng() < 0.3 && x1 - x0 > 4 && z1 - z0 > 4) {
      const cx = x0 + 1 + rng() * (x1 - x0 - 3);
      const cz = z0 + 1 + rng() * (z1 - z0 - 3);
      box(roofs, cx, cx + 1.4, hi + hgt, hi + hgt + 1.2, cz, cz + 1.4, '#9aa0a8');
    }
    u += w;
  }
}

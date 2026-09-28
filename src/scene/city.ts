// San Francisco around the race: an SF street grid on the hill, pastel Victorian row houses along
// the course, race barriers with cheering crowds, cable-car lines, Lombard's crooked block, the
// Embarcadero, the wooden pier and the kicker. Procedural, and merged by material to keep draw
// calls low.
import * as THREE from 'three';
import { DECK_Y, EMB_X as SF_EMB_X, KICKER_X, ROAD_HW, RUSSIAN_HILL, SHORE_X as SF_SHORE_X, terrainBreaks, terrainY } from '../maps/russianHill';
import { pointAt, type CoursePoint } from '../track';
import { Crowd, type Spot } from './crowd';
import { GeoBuilder, _e, _m4, _q, _s, _v, box, cyl, meshOf, obox, prism, rbox, shade, strip, type V3 } from './geo';
import { buildKicker, type Kicker } from './kicker';
import { BAND, LOMBARD_WALK, LOMBARD_X0, LOMBARD_X1, buildLombard } from './lombard';
import { canvasTexture, makeRng } from './util';
import { asphaltTexture, bannerTexture, barrierPanel, checkerTexture, laneLabelTexture, tree, tyreStack } from './props';

export interface City {
  group: THREE.Group;
  /** The kicker at the end of the pier (it drops once the first car is off it). */
  kicker: Kicker;
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
const START_Y = C.startY;

const RH = ROAD_HW;
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



function facadeTexture(): THREE.CanvasTexture {
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

function plywoodTexture(): THREE.CanvasTexture {
  // Tile = one 2.44 m × 1.22 m sheet.
  return canvasTexture(
    1024,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#e2c08a';
      ctx.fillRect(0, 0, w, h);
      const rng = makeRng(5);
      for (let i = 0; i < 70; i++) {
        const y = rng() * h;
        const amp = 6 + rng() * 22;
        const f = 0.004 + rng() * 0.01;
        ctx.strokeStyle = `rgba(${150 + rng() * 40},${95 + rng() * 30},${45},${0.12 + rng() * 0.18})`;
        ctx.lineWidth = 1 + rng() * 3;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) {
          const yy = y + Math.sin(x * f + i) * amp;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(120,70,30,0.25)';
        ctx.beginPath();
        ctx.ellipse(rng() * w, rng() * h, 8 + rng() * 10, 4 + rng() * 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(90,55,25,0.75)';
      ctx.lineWidth = 5;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = 'rgba(70,70,70,0.7)';
      for (let x = 24; x < w; x += 96) {
        for (const y of [18, h / 2, h - 18]) ctx.fillRect(x, y - 3, 6, 6);
      }
    },
    { repeat: [1, 1] },
  );
}

function stripeTexture(): THREE.CanvasTexture {
  // One tile = 1 m: a yellow and a black diagonal band.
  return canvasTexture(
    256,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#ffcc12';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1b1b1f';
      for (let k = -2; k < 3; k++) {
        const x = k * w;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, 0);
        ctx.lineTo(x + w, 0);
        ctx.lineTo(x + w * 0.5 + h * 0.9, h);
        ctx.lineTo(x + h * 0.9, h);
        ctx.closePath();
        ctx.fill();
      }
    },
    { repeat: [1, 1] },
  );
}



export function signTexture(text: string, bg: string, fg: string, w = 512, h = 96): THREE.CanvasTexture {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.font = `900 ${Math.round(h * 0.52)}px "Arial Rounded MT Bold", "Arial Black", "Helvetica Neue", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fg;
    ctx.fillText(text, w / 2, h / 2 + 3);
  });
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

function barricadeTexture(): THREE.CanvasTexture {
  // Orange and white stripes with ROAD CLOSED in the middle; one tile per board.
  return canvasTexture(512, 96, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff6a1f';
    for (let x = -h; x < w + h; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 32, h);
      ctx.lineTo(x + 32 + h, 0);
      ctx.lineTo(x + h, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w * 0.22, 12, w * 0.56, h - 24);
    ctx.font = '900 44px "Arial Rounded MT Bold", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1b1b1f';
    ctx.fillText('ROAD CLOSED', w / 2, h / 2 + 2);
  });
}

function namesTexture(names: string[], bg = '#12704a'): THREE.CanvasTexture {
  const rows = names.length;
  return canvasTexture(512, 64 * rows, (ctx, w) => {
    names.forEach((name, r) => {
      const y = r * 64;
      ctx.fillStyle = bg;
      ctx.fillRect(0, y, w, 64);
      ctx.strokeStyle = '#f4f4ee';
      ctx.lineWidth = 4;
      ctx.strokeRect(5, y + 5, w - 10, 54);
      ctx.font = '800 36px "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f4f4ee';
      ctx.fillText(name, w / 2, y + 34);
    });
  });
}

/** A plate for row `row` of a names texture; `alongZ` plates face ±x. */
function namePlate(row: number, rows: number, alongZ: boolean, len = 1.6): THREE.BufferGeometry {
  const g = alongZ ? new THREE.BoxGeometry(0.05, 0.32, len) : new THREE.BoxGeometry(len, 0.32, 0.05);
  const n = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  const v0 = 1 - (row + 1) / rows;
  const v1 = 1 - row / rows;
  for (let i = 0; i < uv.count; i++) {
    const face = alongZ ? Math.abs(n.getX(i)) > 0.5 : Math.abs(n.getZ(i)) > 0.5;
    if (face) uv.setXY(i, uv.getX(i), v0 + uv.getY(i) * (v1 - v0));
    else uv.setXY(i, 0.01, (v0 + v1) / 2);
  }
  return g;
}

// ---------------------------------------------------------------------------------------------
// Palettes.

const HOUSE_COLORS = [
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
const TRIM = '#fffaf0';
const ACCENTS = ['#2f6f8f', '#8a2d4a', '#3d5a80', '#c9a227', '#6b4c9a', '#2e7d6b', '#d9534f'];
const DOORS = ['#b3263a', '#1f3d6b', '#2f6b4f', '#7a4a2a', '#f2c14e', '#5b3a82', '#0f7c7c'];
const ROOF = '#8d9199';
const CONCRETE = '#dcd6c9';
const DARK_WOOD = '#5c4633';


// ---------------------------------------------------------------------------------------------
// Houses.

interface HouseSinks {
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
interface Lot {
  ox: number;
  oz: number;
  ux: number;
  uz: number;
  W: number;
}

function buildHouse(s: HouseSinks, lot: Lot, rng: () => number, exposeU0 = false, exposeUW = false): void {
  const W = lot.W;
  const D = HOUSE_DEPTH;
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
  const groundHi = Math.max(terrainY(lot.ox), terrainY(lot.ox + lot.ux * W));
  const groundLo = Math.min(
    terrainY(lot.ox),
    terrainY(lot.ox + lot.ux * W),
    terrainY(lot.ox + wx * D),
    terrainY(lot.ox + lot.ux * W + wx * D),
  );

  const color = HOUSE_COLORS[Math.floor(rng() * HOUSE_COLORS.length)];
  const accent = ACCENTS[Math.floor(rng() * ACCENTS.length)];
  const trimAccent = rng() < 0.45 ? accent : TRIM;
  const floors = rng() < 0.3 ? 2 : 3;
  const fh = 3.1;
  const queenAnne = rng() < 0.45;
  const yb = groundHi + CURB + 0.35;
  const yFound = groundLo + CURB - 0.9;
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
  const doorLeft = rng() < 0.5;
  const da0 = doorLeft ? 0.55 : W - 1.65;
  const da1 = da0 + 1.1;
  const doorColor = DOORS[Math.floor(rng() * DOORS.length)];
  faceBox(s.trim, m, MAIN_FACE, da0 - 0.18, da1 + 0.18, yb, yb + 2.55, -0.02, 0.08, TRIM);
  faceBox(s.trim, m, MAIN_FACE, da0, da1, yb, yb + 2.3, 0.0, 0.1, doorColor);
  faceBox(s.glass, m, MAIN_FACE, da0 + 0.1, da1 - 0.1, yb + 2.34, yb + 2.5, 0.0, 0.11, '#ffffff');
  faceBox(s.trim, m, MAIN_FACE, da0 - 0.35, da1 + 0.35, yb + 2.6, yb + 2.78, -0.02, 0.5, trimAccent);
  // Stoop down to the sidewalk (the sidewalk drops along the facade on the slope).
  const doorX = uToX((da0 + da1) / 2);
  const walk = terrainY(doorX) + CURB;
  const rise = Math.max(0.2, yb - walk);
  const steps = Math.max(1, Math.round(rise / 0.2));
  for (let k = 0; k < steps; k++) {
    const yTop = yb - k * (rise / steps);
    faceBox(s.trim, m, MAIN_FACE, da0 - 0.15, da1 + 0.15, walk - 0.1, yTop, 0, 0.32 * (k + 1), '#ece6da');
  }

  const other0 = doorLeft ? 2.1 : 0.5;
  const other1 = doorLeft ? W - 0.5 : W - 2.1;
  if (rng() < 0.55 && other1 - other0 > 2.6) {
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
    faceBox(s.walls, m, MAIN_FACE, 0.2, W - 0.2, eave - 1.0, eave - 0.3, -0.02, 0.06, shade(color, 0.88));
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

// ---------------------------------------------------------------------------------------------
// Background buildings, trees and palms.

function worldUvBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.BufferGeometry {
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
// Cable car (Powell & Hyde): its own small group so it can be placed on the rails.

export function buildCableCar(signMat: THREE.Material, glassMat: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'cableCar';
  const paint = new GeoBuilder();
  const glass = new GeoBuilder();
  const brass = new GeoBuilder();
  const RED = '#b01e2c';
  const CREAM = '#f3e7c9';
  const GOLD = '#d9a93c';
  const WOOD = '#8a5a34';
  const L = 8.4;
  const hl = L / 2;
  const hw = 1.2;

  // Trucks and wheels on the rails (rail gauge 1.067 m).
  for (const sx of [-2.6, 2.6]) {
    box(paint, sx - 0.85, sx + 0.85, 0.22, 0.58, -0.62, 0.62, '#2a2c31');
    for (const wx of [sx - 0.5, sx + 0.5]) {
      for (const wz of [-0.535, 0.535]) {
        const g = new THREE.CylinderGeometry(0.27, 0.27, 0.1, 16);
        g.rotateX(Math.PI / 2);
        g.translate(wx, 0.27, wz);
        paint.add(g, '#3a3d44');
      }
    }
  }
  // Floor and body.
  rbox(paint, -hl, hl, 0.58, 0.86, -hw, hw, 0.08, RED);
  rbox(paint, -2.15, 2.15, 0.86, 1.62, -hw, hw, 0.06, RED);
  box(paint, -2.2, 2.2, 1.55, 1.68, -hw - 0.03, hw + 0.03, GOLD);
  rbox(paint, -2.15, 2.15, 1.62, 2.98, -hw + 0.02, hw - 0.02, 0.06, CREAM);
  // Window band on the enclosed saloon.
  for (let i = 0; i < 6; i++) {
    const cx = -1.8 + i * 0.72;
    for (const zs of [-1, 1]) {
      box(glass, cx - 0.27, cx + 0.27, 1.85, 2.72, zs * (hw - 0.03), zs * (hw + 0.02), '#ffffff');
      box(paint, cx - 0.33, cx + 0.33, 1.78, 1.85, zs * (hw - 0.02), zs * (hw + 0.04), WOOD);
    }
  }
  for (const xs of [-1, 1]) {
    box(glass, xs * 2.15 - 0.02, xs * 2.15 + 0.02, 1.85, 2.72, -0.8, 0.8, '#ffffff');
  }
  // Open end platforms: dashers, outward benches and brass poles.
  for (const xs of [-1, 1]) {
    const a = xs * 2.15;
    const b = xs * hl;
    rbox(paint, Math.min(a, b), Math.max(a, b), 0.86, 1.38, -hw, -hw + 0.12, 0.04, RED);
    rbox(paint, Math.min(a, b), Math.max(a, b), 0.86, 1.38, hw - 0.12, hw, 0.04, RED);
    box(paint, Math.min(a, b), Math.max(a, b), 1.3, 1.4, -hw - 0.02, -hw + 0.14, GOLD);
    box(paint, Math.min(a, b), Math.max(a, b), 1.3, 1.4, hw - 0.14, hw + 0.02, GOLD);
    box(paint, Math.min(a, b) + 0.1, Math.max(a, b) - 0.1, 1.2, 1.3, -0.35, 0.35, WOOD);
    box(paint, b - xs * 0.25, b - xs * 0.08, 0.86, 1.9, -0.9, 0.9, CREAM);
    for (const px of [a + xs * 0.25, (a + b) / 2, b - xs * 0.2]) {
      for (const pz of [-hw + 0.06, hw - 0.06]) cyl(brass, [px, 0.86, pz], [px, 2.98, pz], 0.035, 0.035, 8, '#ffffff');
    }
    // Headlight.
    const hg = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16);
    hg.rotateZ(Math.PI / 2);
    hg.translate(b + xs * 0.02, 1.25, 0);
    brass.add(hg, '#ffffff');
  }
  // Grip lever in the front platform.
  cyl(brass, [2.9, 0.86, 0.2], [3.05, 2.0, 0.2], 0.03, 0.04, 6, '#ffffff');
  // Roof, clerestory and bell.
  rbox(paint, -hl - 0.12, hl + 0.12, 2.98, 3.12, -hw - 0.1, hw + 0.1, 0.06, CREAM);
  rbox(paint, -3.2, 3.2, 3.12, 3.46, -0.62, 0.62, 0.06, CREAM);
  for (let i = 0; i < 9; i++) {
    const cx = -2.8 + i * 0.7;
    for (const zs of [-1, 1]) box(glass, cx - 0.2, cx + 0.2, 3.18, 3.38, zs * 0.6, zs * 0.64, '#ffffff');
  }
  rbox(paint, -3.3, 3.3, 3.46, 3.56, -0.72, 0.72, 0.04, RED);
  const bell = new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  bell.translate(2.4, 3.46, 0);
  brass.add(bell, '#ffffff');

  const paintMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#d8ac48', metalness: 1, roughness: 0.28 });
  group.add(meshOf(paint, paintMat, 'cableCarBody', true, true));
  group.add(meshOf(glass, glassMat, 'cableCarGlass', false, false));
  group.add(meshOf(brass, brassMat, 'cableCarBrass', true, false));

  // Destination signs on both roof ends.
  for (const xs of [-1, 1]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.32), signMat);
    sign.position.set(xs * (hl + 0.14), 3.3, 0);
    sign.rotation.y = xs * (Math.PI / 2);
    group.add(sign);
  }
  // Side name boards.
  for (const zs of [-1, 1]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.3), signMat);
    sign.position.set(0, 1.25, zs * (hw + 0.03));
    sign.rotation.y = zs > 0 ? 0 : Math.PI;
    group.add(sign);
  }
  return group;
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
// Street furniture.


/** A sawhorse barricade (two striped boards on A-frame legs) centred at (x, z), facing along `ang`. */
function barricade(boards: GeoBuilder, legs: GeoBuilder, x: number, y: number, z: number, ang: number, len = 2.2): void {
  for (const h of [0.62, 1.02]) {
    const g = new THREE.BoxGeometry(len, 0.26, 0.05);
    _m4.compose(_v.set(x, y + h, z), _q.setFromEuler(_e.set(0, ang, 0)), _s.set(1, 1, 1));
    boards.add(g, '#ffffff', _m4);
  }
  for (const f of [-0.42, 0.42]) {
    const px = x + Math.cos(-ang) * len * f;
    const pz = z + Math.sin(-ang) * len * f;
    for (const t of [-1, 1]) {
      obox(legs, [px, y + 0.55, pz], [0.07, 1.15, 0.07], [t * 0.18, ang, 0], '#e8e8e2');
    }
  }
}


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
  const plyTex = plywoodTexture();
  const plyMat = new THREE.MeshStandardMaterial({ map: plyTex, roughness: 0.72 });
  const stripeMat = new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.5 });
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
  for (const sec of SECS.filter((s) => s.kind === 'corner')) {
    let i = 0;
    for (let s = sec.s0 - 1; s <= sec.s1 + 1; s += 0.72) {
      const p = pointAt(C, s);
      const side = p.curv > 0 || (s < sec.s0 + 0.01 && pointAt(C, sec.s0 + 1).curv > 0) ? -1 : 1;
      const d = side * (RH + 0.45);
      const x = p.x - p.tz * d;
      const z = p.z + p.tx * d;
      tyreStack(cones, x, gy(x), z, i++);
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

  // --- Start line, grid labels and the start gantry -----------------------------------------------
  const startS = C.startS;
  const sp = pointAt(C, startS);
  const startX0 = sp.x - 0.4;
  const startX1 = sp.x + 0.4;
  const startGeo = new GeoBuilder();
  slab(startGeo, startX0, startX1, GREENWICH_Z - RH + 0.2, GREENWICH_Z + RH - 0.2, markTop, markTop, '#ffffff', 1, false);
  const startLine = meshOf(
    startGeo,
    new THREE.MeshStandardMaterial({
      map: checkerTexture(34, 2),
      roughness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    'startLine',
    false,
    true,
  );
  {
    const uv = startLine.geometry.getAttribute('uv');
    const p = startLine.geometry.getAttribute('position');
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (p.getZ(i) - GREENWICH_Z + RH - 0.2) / (2 * (RH - 0.2)), (p.getX(i) - startX0) / (startX1 - startX0));
    }
    uv.needsUpdate = true;
  }
  group.add(startLine);

  const laneTex = laneLabelTexture();
  const laneMat = new THREE.MeshStandardMaterial({ map: laneTex, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
  for (const [i, slot] of [
    [0, C.grid[0]],
    [1, C.grid[1]],
  ] as const) {
    const g = new THREE.PlaneGeometry(3.0, 3.0);
    const uv = g.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / 2);
    g.rotateX(-Math.PI / 2);
    g.rotateY(-Math.PI / 2);
    const label = new THREE.Mesh(g, laneMat);
    const lp = pointAt(C, slot.s - 3.2);
    label.position.set(lp.x, lp.y + 0.014, lp.z + slot.d);
    label.receiveShadow = true;
    label.name = `laneLabel${i + 1}`;
    group.add(label);
  }

  const gantry = new THREE.Group();
  gantry.name = 'startGantry';
  const flags: { mesh: THREE.Mesh; base: Float32Array; phase: number }[] = [];
  {
    const gb = new GeoBuilder();
    const yb = START_Y + CURB;
    const topY = START_Y + 8.1;
    const gz = GREENWICH_Z;
    for (const dz of [-8.7, 8.7]) {
      rbox(gb, startX0 - 0.25, startX0 + 0.25, yb, topY + 0.3, gz + dz - 0.25, gz + dz + 0.25, 0.08, '#f7f7f2');
      box(gb, startX0 - 0.4, startX0 + 0.4, yb, yb + 0.3, gz + dz - 0.4, gz + dz + 0.4, '#2b2f36');
    }
    rbox(gb, startX0 - 0.3, startX0 + 0.3, topY - 0.45, topY + 0.1, gz - 9.0, gz + 9.0, 0.08, '#2b2f36');
    const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.6 });
    gantry.add(meshOf(gb, mat, 'gantryFrame', true, true));
    const banner = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.75, 13.6), new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.55 }));
    banner.position.set(startX0, topY - 1.45, gz);
    banner.castShadow = true;
    banner.name = 'gantryBanner';
    gantry.add(banner);
    // Waving chequered flags on the gantry posts.
    const flagMat = new THREE.MeshStandardMaterial({ map: checkerTexture(6, 4), roughness: 0.6, side: THREE.DoubleSide });
    for (const [i, dz] of [
      [0, -8.7],
      [1, 8.7],
    ] as const) {
      const g = new THREE.PlaneGeometry(1.8, 1.2, 12, 4);
      g.translate(0.9, 0, 0);
      const mesh = new THREE.Mesh(g, flagMat);
      mesh.position.set(startX0, START_Y + 8.1 + 0.9, gz + dz);
      mesh.rotation.y = dz < 0 ? 0.35 : -0.35 + Math.PI;
      mesh.castShadow = true;
      mesh.name = `startFlag${i + 1}`;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), new THREE.MeshStandardMaterial({ color: '#d8dce2', metalness: 0.8, roughness: 0.3 }));
      pole.position.set(startX0, START_Y + 8.1 + 0.9, gz + dz);
      gantry.add(pole);
      gantry.add(mesh);
      flags.push({ mesh, base: Float32Array.from(g.getAttribute('position').array as ArrayLike<number>), phase: i * 1.7 });
    }
  }
  group.add(gantry);

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
      if (course) rowHouses(houses, lot, rng);
      else if (!far || rng() < 0.9) rowBlocks(facades, houses.walls, lot, D, rng);
    }
    for (const { side, course } of sides) {
      if (side !== 'e' && side !== 'w') continue;
      const D = depthOf(course);
      const za = lz0 + nsDepth.s;
      const zb = lz1 - nsDepth.n;
      if (zb - za < 6) continue;
      const lot = side === 'e' ? { ox: lx1, oz: za, ux: 0, uz: 1, len: zb - za } : { ox: lx0, oz: zb, ux: 0, uz: -1, len: zb - za };
      if (course) rowHouses(houses, lot, rng);
      else rowBlocks(facades, houses.walls, lot, D, rng);
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

  // --- Kicker: a hinged ramp on hydraulic rams (it drops once the first car is off it) ----------------
  const kicker = buildKicker({ ply: plyMat, stripe: stripeMat, cone: coneMat });
  group.add(kicker.group);
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
    for (const f of flags) {
      const pos = f.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const x = f.base[i * 3];
        const y = f.base[i * 3 + 1];
        const amp = 0.18 * (x / 1.8);
        arr[i * 3 + 2] = f.base[i * 3 + 2] + Math.sin(t * 5 + x * 3.2 + f.phase) * amp + Math.sin(t * 3.1 + y * 2) * 0.03 * x;
      }
      pos.needsUpdate = true;
      f.mesh.geometry.computeVertexNormals();
    }
    crowd.update(dt, t, cars);
  };

  return { group, kicker, update };
}

// ---------------------------------------------------------------------------------------------
// Frontages.

interface Frontage {
  ox: number;
  oz: number;
  ux: number;
  uz: number;
  len: number;
}

/** Victorian row houses filling a frontage (the first and last show their side walls). */
function rowHouses(s: HouseSinks, f: Frontage, rng: () => number): void {
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
    buildHouse(s, { ox: f.ox + f.ux * u, oz: f.oz + f.uz * u, ux: f.ux, uz: f.uz, W: ww }, rng, i === 0, i === widths.length - 1);
    u += ww;
  });
}

/** Plain pastel buildings with a tiled window texture, filling a frontage to a depth. */
function rowBlocks(walls: GeoBuilder, roofs: GeoBuilder, f: Frontage, depth: number, rng: () => number): void {
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
    const hi = Math.max(gy(x0), gy(x1)) + CURB;
    const lo = Math.min(gy(x0), gy(x1)) - 0.5;
    const hgt = 8 + rng() * 11;
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

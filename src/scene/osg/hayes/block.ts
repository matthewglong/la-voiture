// The 500 block of Hayes St, Laguna to Octavia: Hayes Valley's shopping street as it stood in
// September 2026, every shop on its own side in its own order (the north side's even numbers
// counting down from Todd Snyder at 590 to La Boulangerie at 500, the south side's odd ones from
// Topo Designs at 597 to Hazie's at 501), each frontage its real width squeezed into the model's
// shorter block (a little more squeeze for the wide ones, so the narrow ones stay readable). The
// buildings over them are the real ones as the street survey shows them: the modern block on the
// Laguna corner, the grey and the pale green Victorians, the brown-shingled one, the salmon one with
// its black fire escapes, the black single-storey fronts, Nabila's painted parapet, La Boulangerie's
// powder-blue corner and Hazie's salmon-red one. And what's on the sidewalk: Salt & Straw's red
// benches, the parklet under a steel pergola in front of Souvla and Patxi's, La Boulangerie's orange
// café chairs, the Muni shelter, planters, bike racks and street trees.
import * as THREE from 'three';
import { pointAt } from '../../../track';
import { box, cyl, obox, prism, rbox } from '../../geo';
import { markDoor, markThing } from '../kerbside';
import { KERB, POLE_SET, WALK } from '../streets';
import { signQuad, type Region, type WindowKind } from './atlas';
import { Frame, bench, bladeSign, cafeSet, faceSign, faceSignDown, festoon, planter, streetTree, type Kit } from './kit';

/** Storefront storey, upper storeys, building depth (m). */
const GF = 4.4;
const FH = 3.05;
export const DEPTH = 13;
const ROOF = '#8d9199';

/** A shopfront (or the one doorway that isn't a shop). Its door is at its west or east end. */
export interface Front {
  /** The fascia's sign (atlas key); none for an empty shop. */
  sign?: string;
  /** Its blade sign, standing out over the sidewalk. */
  blade?: string;
  /** A residential doorway and ground floor, not a shop. */
  res?: boolean;
  /** The real frontage (m), and whether it's one of the block's best known (a little wider). */
  real: number;
  named?: boolean;
  frame: string;
  fascia: string;
  win: WindowKind;
  door: 'W' | 'E';
  awning?: string;
  /** Lettering along the awning's valance. */
  valance?: string;
  bulk?: string;
  pier?: string;
  /** Natural-timber transom band (Industry of All Nations, Cotton Sheep). */
  wood?: string;
}

type Kind = 'bay' | 'flat' | 'shingle' | 'modern' | 'blank' | 'parapet';

export interface Bldg {
  fronts: Front[];
  kind: Kind;
  floors: number;
  color: string;
  trim: string;
  accent: string;
  bays?: number;
  escape?: string;
  quoins?: string;
  /** Its corner shows (Laguna or Octavia). */
  corner?: boolean;
  /** A few small windows in a blank upper storey. */
  windows?: number;
}

// ---------------------------------------------------------------------------------------------
// The block, west to east. Widths are the real frontages (m) from the survey.

const NORTH: Bldg[] = [
  {
    // 590 Hayes: five storeys, white and grey, bronze fins, glass balconies.
    kind: 'modern',
    floors: 4,
    color: '#e3e3df',
    trim: '#3d3f43',
    accent: '#8b5e3c',
    corner: true,
    fronts: [
      { sign: 'toddSnyder', real: 17, frame: '#1f1f21', fascia: '#1b1b1d', win: 'clothes', door: 'E', pier: '#3d3f43' },
      { sign: 'saltStraw', blade: 'b_saltStraw', real: 8, named: true, frame: '#2a2a2c', fascia: '#f2ebdd', win: 'icecream', door: 'E', pier: '#3d3f43' },
      { sign: 'throughHayes', real: 13, frame: '#2a2a2c', fascia: '#2b2d31', win: 'shelves', door: 'W', pier: '#3d3f43' },
    ],
  },
  {
    kind: 'bay',
    floors: 2,
    bays: 2,
    color: '#cfd3d6',
    trim: '#f4f2ec',
    accent: '#5e4a6e',
    fronts: [
      { sign: 'cottonSheep', blade: 'b_cottonSheep', real: 10, frame: '#9a7048', fascia: '#b98a58', win: 'clothes', door: 'E', wood: '#a87b4f' },
      { sign: 'buckMason', blade: 'b_buckMason', real: 7.5, named: true, frame: '#f4f2ec', fascia: '#f7f6f2', win: 'clothes', door: 'W', bulk: '#e8e6e0' },
    ],
  },
  {
    kind: 'bay',
    floors: 2,
    bays: 1,
    color: '#dedcd4',
    trim: '#f7f5ef',
    accent: '#4d6b8a',
    escape: '#2a2a2a',
    fronts: [
      { sign: 'orangeBird', blade: 'b_orangeBird', real: 5, frame: '#1e2c6e', fascia: '#2338a4', win: 'shelves', door: 'E' },
      { sign: 'trueSake', real: 6.5, frame: '#1a1a1a', fascia: '#1f4fb4', win: 'bar', door: 'W', awning: '#1f4fb4' },
    ],
  },
  {
    kind: 'bay',
    floors: 2,
    bays: 1,
    color: '#b9d1b0',
    trim: '#f6f4ec',
    accent: '#6f8a66',
    escape: '#b8352c',
    fronts: [{ sign: 'credo', blade: 'b_credo', real: 8.2, frame: '#f4f4f0', fascia: '#2e8a8c', win: 'shelves', door: 'W' }],
  },
  {
    kind: 'shingle',
    floors: 2,
    color: '#6e4a32',
    trim: '#f2efe6',
    accent: '#3a2a20',
    fronts: [
      { sign: 'reliquary', real: 5.7, frame: '#2a2826', fascia: '#262422', win: 'clothes', door: 'E' },
      { sign: 'faherty', blade: 'b_faherty', real: 4.4, frame: '#1a1a1a', fascia: '#121212', win: 'clothes', door: 'W' },
      { sign: 'fiddlesticks', blade: 'b_fiddlesticks', real: 5.2, frame: '#f7f5ef', fascia: '#fbf8f0', win: 'shelves', door: 'E', bulk: '#2a2a2a' },
    ],
  },
  {
    kind: 'flat',
    floors: 2,
    color: '#e2a893',
    trim: '#f7f1e8',
    accent: '#9b5a4a',
    escape: '#1e1e1e',
    fronts: [
      { sign: 'ioan', blade: 'b_ioan', real: 5.4, named: true, frame: '#c49a68', fascia: '#c9a77c', win: 'clothes', door: 'W', wood: '#c9a77c', bulk: '#b88d5c' },
      { sign: 'archer', real: 5.2, frame: '#1f2d4f', fascia: '#1f2d4f', win: 'dark', door: 'E' },
      { sign: 'paolo', real: 4.8, frame: '#6a3726', fascia: '#6a3726', win: 'papered', door: 'W', wood: '#7a4430' },
      { sign: 'aviator', blade: 'b_aviator', real: 6, frame: '#1f52d6', fascia: '#1f52d6', win: 'clothes', door: 'E', bulk: '#1f52d6', pier: '#1f52d6' },
    ],
  },
  {
    kind: 'flat',
    floors: 2,
    color: '#7d8ea3',
    trim: '#f1efe9',
    accent: '#3e4c5e',
    escape: '#2a2a2a',
    fronts: [
      // Undefeated's old shop: black, empty.
      { real: 8, frame: '#151515', fascia: '#151515', win: 'dark', door: 'E' },
      { sign: 'malinGoetz', blade: 'b_malinGoetz', real: 6.2, frame: '#efefec', fascia: '#eeeeea', win: 'shelves', door: 'W', bulk: '#d9602c' },
      // Timbuk2 left for Chestnut St in January.
      { real: 6.3, frame: '#151515', fascia: '#151515', win: 'papered', door: 'E' },
    ],
  },
  {
    // 500 Hayes: La Boulangerie's powder-blue corner, cream quoins, navy awnings.
    kind: 'flat',
    floors: 2,
    color: '#9db7cc',
    trim: '#efe6cc',
    accent: '#26324a',
    quoins: '#efe6cc',
    corner: true,
    fronts: [{ sign: 'boulangerie', blade: 'b_laBoulangerie', real: 13.8, named: true, frame: '#26324a', fascia: '#9db7cc', win: 'bakery', door: 'E', awning: '#26324a', valance: 'laBoulangerie', pier: '#efe6cc' }],
  },
];

const SOUTH: Bldg[] = [
  {
    kind: 'bay',
    floors: 2,
    bays: 2,
    color: '#e9ddc2',
    trim: '#f8f3e6',
    accent: '#8c7a5a',
    corner: true,
    fronts: [
      { sign: 'topo', blade: 'b_topo', real: 13, frame: '#161616', fascia: '#151515', win: 'clothes', door: 'E' },
      { res: true, real: 8, frame: '#1e1e1e', fascia: '#e9ddc2', win: 'dark', door: 'W' },
      { sign: 'gambit', blade: 'b_gambit', real: 8, frame: '#1a1a1a', fascia: '#141414', win: 'bar', door: 'W' },
    ],
  },
  {
    kind: 'bay',
    floors: 2,
    bays: 2,
    color: '#3f5a57',
    trim: '#efe2b0',
    accent: '#8c7fb0',
    fronts: [
      { sign: 'gioia', blade: 'b_gioia', real: 5.5, named: true, frame: '#1f3a2c', fascia: '#1f3a2c', win: 'cafe', door: 'E' },
      { sign: 'metier', real: 5, frame: '#3a2618', fascia: '#3a2618', win: 'shelves', door: 'W', wood: '#4a3020' },
    ],
  },
  {
    // Oak + Fort's old shop, dark grey, papered up.
    kind: 'bay',
    floors: 2,
    bays: 1,
    color: '#50545a',
    trim: '#e6e4de',
    accent: '#2f3236',
    fronts: [{ real: 5, frame: '#141414', fascia: '#141414', win: 'papered', door: 'E' }],
  },
  {
    // Nabila's: one storey under its painted parapet, jazz on the piers.
    kind: 'parapet',
    floors: 0,
    color: '#c8322b',
    trim: '#f2c12e',
    accent: '#2a58b8',
    fronts: [{ real: 7.5, frame: '#2a58b8', fascia: '#c8322b', win: 'shelves', door: 'W', pier: '#161616' }],
  },
  {
    kind: 'blank',
    floors: 1,
    color: '#161616',
    trim: '#2c2c2c',
    accent: '#161616',
    fronts: [{ sign: 'seventhAve', blade: 'b_seventhAve', real: 8.6, frame: '#1a1a1a', fascia: '#121212', win: 'beds', door: 'E' }],
  },
  {
    kind: 'bay',
    floors: 2,
    bays: 2,
    color: '#8f9d8f',
    trim: '#f3f1ea',
    accent: '#5a6a5a',
    fronts: [
      { sign: 'sfDance', blade: 'b_sfDance', real: 5.6, frame: '#3b3b3b', fascia: '#262626', win: 'clothes', door: 'W' },
      { sign: 'cotopaxi', blade: 'b_cotopaxi', real: 5.8, frame: '#1c1c1c', fascia: '#1c1c1c', win: 'clothes', door: 'E' },
      { sign: 'rails', blade: 'rails', real: 6.6, frame: '#6f7c6f', fascia: '#8f9d8f', win: 'clothes', door: 'W', wood: '#7a6a58' },
      { sign: 'allaPrima', real: 7.1, frame: '#6f7c6f', fascia: '#9ba692', win: 'clothes', door: 'E', wood: '#7a6a58' },
    ],
  },
  {
    // Painted black: Peak Design, Brooklinen, Souvla.
    kind: 'blank',
    floors: 1,
    color: '#151515',
    trim: '#262626',
    accent: '#151515',
    fronts: [
      { sign: 'peakDesign', blade: 'b_peakDesign', real: 9, frame: '#1a1a1a', fascia: '#141414', win: 'shelves', door: 'W' },
      { sign: 'brooklinen', blade: 'b_brooklinen', real: 9.2, frame: '#1a1a1a', fascia: '#111111', win: 'beds', door: 'E' },
      { sign: 'souvla', blade: 'b_souvla', real: 6.6, named: true, frame: '#1a1a1a', fascia: '#111111', win: 'cafe', door: 'W', wood: '#9a6a3a' },
    ],
  },
  {
    kind: 'blank',
    floors: 1,
    color: '#e3d7a6',
    trim: '#f3eed8',
    accent: '#b8a878',
    windows: 2,
    fronts: [{ sign: 'patxis', blade: 'b_patxis', real: 6.5, frame: '#1a1a1a', fascia: '#121212', win: 'cafe', door: 'E' }],
  },
  {
    // 501 Hayes: Hazie's, salmon-red over a white ground floor, on the corner of the Green.
    kind: 'bay',
    floors: 3,
    bays: 2,
    color: '#d9776b',
    trim: '#f6f1e6',
    accent: '#a84a40',
    corner: true,
    escape: '#8a2a22',
    fronts: [{ sign: 'hazies', real: 16, frame: '#141414', fascia: '#f4f1ea', win: 'cafe', door: 'W', pier: '#f3f0e8', bulk: '#f3f0e8' }],
  },
];

/** The model's widths: in proportion to real^0.8 (the wide ones give a little), named shops 15%
 *  wider, none under 2 m, filling `total`. */
function lay(fronts: Front[], total: number): number[] {
  const base = fronts.map((f) => Math.pow(f.real, 0.8) * (f.named ? 1.15 : 1));
  let k = total / base.reduce((a, b) => a + b, 0);
  let w = base;
  for (let it = 0; it < 40; it++) {
    w = base.map((b) => Math.max(2, k * b));
    k *= total / w.reduce((a, b) => a + b, 0);
  }
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => (x * total) / sum);
}

// ---------------------------------------------------------------------------------------------
// Pieces of a building, in its frame (u along the front, w into the lot, the front at w = 0).

/** A Victorian window: surround, glass, mullion, sill, and a hood if it has one. */
function win(k: Kit, f: Frame, u0: number, u1: number, y0: number, y1: number, trim: string, hood: string | null): void {
  const S = k.S;
  box(S.trim, u0 - 0.12, u1 + 0.12, y0 - 0.12, y1 + 0.12, -0.06, 0.02, trim, f.m);
  box(S.glass, u0, u1, y0, y1, -0.08, -0.02, '#ffffff', f.m);
  if (u1 - u0 > 0.7) box(S.trim, (u0 + u1) / 2 - 0.03, (u0 + u1) / 2 + 0.03, y0, y1, -0.1, -0.02, trim, f.m);
  box(S.trim, u0 - 0.2, u1 + 0.2, y0 - 0.24, y0 - 0.12, -0.2, 0.02, trim, f.m);
  if (hood) box(S.trim, u0 - 0.24, u1 + 0.24, y1 + 0.12, y1 + 0.3, -0.24, 0.02, hood, f.m);
}

/** A frame on a face of the building turned `ang` from its front (+ towards the street), at (u, w). */
function turned(f: Frame, u: number, w: number, ang: number): Frame {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const p = f.p(u, 0, w);
  return new Frame(p[0], p[2], f.ux * c - f.wx * s, f.uz * c - f.wz * s);
}

/** The bracketed cornice along the top: frieze, brackets, a deep cap. */
function cornice(k: Kit, f: Frame, u0: number, u1: number, top: number, trim: string, accent: string, brackets = true): void {
  const S = k.S;
  box(S.trim, u0 - 0.1, u1 + 0.1, top - 0.34, top, -0.55, 0.02, trim, f.m);
  box(S.trim, u0, u1, top - 0.95, top - 0.34, -0.1, 0.02, accent, f.m);
  if (brackets) for (let u = u0 + 0.25; u <= u1 - 0.2; u += 1.05) box(S.trim, u - 0.09, u + 0.09, top - 0.95, top - 0.34, -0.45, 0.02, trim, f.m);
}

/** A fire escape across the front at uc: a platform and rail on each upper floor, ladders between. */
function fireEscape(k: Kit, f: Frame, uc: number, yb: number, floors: number, color: string): void {
  const S = k.S;
  const hw = 1.15;
  for (let fl = 0; fl < floors; fl++) {
    const y = yb + GF + fl * FH + 0.06;
    box(S.metal, uc - hw, uc + hw, y - 0.05, y, -0.95, 0, color, f.m);
    box(S.metal, uc - hw, uc + hw, y + 0.88, y + 0.93, -0.97, -0.92, color, f.m);
    for (const u of [uc - hw, uc - hw / 3, uc + hw / 3, uc + hw]) box(S.metal, u - 0.02, u + 0.02, y, y + 0.93, -0.97, -0.92, color, f.m);
    for (const u of [uc - hw, uc + hw]) box(S.metal, u - 0.02, u + 0.02, y + 0.88, y + 0.93, -0.95, 0, color, f.m);
    // The ladder up to the next platform (or the drop ladder under the first): two thin rails.
    const lad = fl < floors - 1 ? FH : 1.7;
    const dy = fl < floors - 1 ? lad : -lad;
    const tilt = (fl % 2 ? 1 : -1) * Math.atan2(1.2, lad) * Math.sign(dy);
    for (const wr of [-0.3, -0.62]) obox(S.metal, [uc + (fl % 2 ? -0.35 : 0.35), y + dy / 2, wr], [0.035, Math.hypot(lad, 1.2), 0.035], [0, 0, tilt], color, f.m);
  }
}

/** Plain windows along a face (a corner building's side), one row per upper floor. */
function sideWindows(k: Kit, f: Frame, u0: number, u1: number, yb: number, floors: number, trim: string, hood: string | null): void {
  const n = Math.max(1, Math.floor((u1 - u0) / 2.4));
  const step = (u1 - u0) / n;
  for (let fl = 0; fl < floors; fl++) {
    const y0 = yb + GF + fl * FH + 0.75;
    for (let i = 0; i < n; i++) {
      const c = u0 + step * (i + 0.5);
      win(k, f, c - 0.5, c + 0.5, y0, y0 + 1.7, trim, hood);
    }
  }
}

/**
 * A shopfront from u0 to u1 in the building's frame: piers, the fascia and its sign, the display
 * windows (lit, from the atlas), the door, a transom, a bulkhead; an awning or a blade sign.
 * `westHigh`: the west end is u1 (the north side's lots run westwards).
 */
function shopfront(k: Kit, f: Frame, u0: number, u1: number, yb: number, ylo: number, s: Front, b: Bldg, westHigh: boolean): void {
  const S = k.S;
  const pier = s.pier ?? b.trim;
  const pw = 0.22;
  box(S.trim, u0, u0 + pw, ylo - 0.4, yb + GF - 0.3, -0.14, 0.02, pier, f.m);
  box(S.trim, u1 - pw, u1, ylo - 0.4, yb + GF - 0.3, -0.14, 0.02, pier, f.m);
  const i0 = u0 + pw;
  const i1 = u1 - pw;
  // The fascia board and its sign.
  box(S.paint, i0, i1, yb + 3.3, yb + 3.98, -0.16, 0.0, s.fascia, f.m);
  if (s.sign) {
    const r = k.atlas.get(s.sign);
    const sq = r.aspect < 1.5;
    faceSign(k, f, r, (i0 + i1) / 2, sq ? yb + 3.28 : yb + 3.38, sq ? 0.72 : 0.52, -0.175, i1 - i0 - 0.16);
  }
  // Door at its end, windows over the rest.
  const doorHigh = (s.door === 'W') === westHigh;
  const dw = Math.min(1.0, (i1 - i0) * 0.42);
  const d0 = doorHigh ? i1 - dw - 0.04 : i0 + 0.04;
  const d1 = d0 + dw;
  // (Race day's crowd leaves the door clear.)
  const door = f.p((d0 + d1) / 2, 0, 0);
  markDoor(k.ctx, door[0], door[2]);
  const w0 = doorHigh ? i0 : d1 + 0.08;
  const w1 = doorHigh ? d0 - 0.08 : i1;
  const frame = s.frame;
  // Transom (glass, or natural timber) over windows and door.
  if (s.wood) box(S.paint, i0, i1, yb + 2.84, yb + 3.3, -0.1, 0.0, s.wood, f.m);
  else box(S.glass, i0, i1, yb + 2.88, yb + 3.28, -0.05, 0.0, '#ffffff', f.m);
  box(S.paint, i0, i1, yb + 2.76, yb + 2.88, -0.12, 0.0, frame, f.m);
  if (s.res) {
    // A residential doorway: a panelled door under a transom, an iron gate; dark windows.
    box(S.paint, d0, d1, yb, yb + 2.7, -0.04, 0.0, '#3a2e28', f.m);
    for (let u = d0 + 0.08; u < d1; u += 0.13) box(S.metal, u - 0.015, u + 0.015, yb, yb + 2.6, -0.14, -0.1, frame, f.m);
    box(S.metal, d0, d1, yb + 2.5, yb + 2.58, -0.15, -0.09, frame, f.m);
  } else {
    // Door: a glass door in its frame, a kick plate.
    box(S.paint, d0 - 0.06, d1 + 0.06, ylo - 0.1, yb + 2.76, -0.07, 0.0, frame, f.m);
    signQuadFlat(k, f, k.atlas.get('w_dark'), d0 + 0.05, d1 - 0.05, yb + 0.3, yb + 2.7, -0.08);
    box(S.paint, d0, d1, ylo - 0.1, yb + 0.3, -0.09, -0.06, frame, f.m);
  }
  if (w1 - w0 > 0.2) {
    // Bulkhead, head, the panes (display tiles) and their mullions.
    box(S.paint, w0, w1, ylo - 0.4, yb + 0.55, -0.11, 0.0, s.bulk ?? frame, f.m);
    const n = Math.max(1, Math.round((w1 - w0) / 1.6));
    const pane = (w1 - w0) / n;
    const tile = k.atlas.get(`w_${s.res ? 'dark' : s.win}`);
    for (let i = 0; i < n; i++) {
      const a = w0 + pane * i;
      signQuadFlat(k, f, tile, a + 0.04, a + pane - 0.04, yb + 0.55, yb + 2.76, -0.03);
      if (i > 0) box(S.paint, a - 0.035, a + 0.035, yb + 0.55, yb + 2.76, -0.1, 0.0, frame, f.m);
    }
    box(S.paint, w0 - 0.04, w0 + 0.04, yb + 0.55, yb + 2.76, -0.1, 0.0, frame, f.m);
    box(S.paint, w1 - 0.04, w1 + 0.04, yb + 0.55, yb + 2.76, -0.1, 0.0, frame, f.m);
  }
  if (b.kind === 'parapet') {
    // The jazz musicians painted on the piers either end.
    const mu = Math.min(0.7, (u1 - u0) * 0.24);
    signQuadFlat(k, f, k.atlas.get('mural0'), u0, u0 + mu, ylo + 0.1, yb + 2.7, -0.16);
    signQuadFlat(k, f, k.atlas.get('mural1'), u1 - mu, u1, ylo + 0.1, yb + 2.7, -0.16);
  }
  if (s.awning) {
    // A sloping fabric awning with a valance.
    const out = 1.3;
    const drop = 0.55;
    const ang = Math.atan2(drop, out);
    obox(S.paint, [(u0 + u1) / 2, yb + 3.15 - drop / 2, -out / 2], [u1 - u0 - 0.1, 0.05, Math.hypot(out, drop)], [ang, 0, 0], s.awning, f.m);
    box(S.paint, u0 + 0.05, u1 - 0.05, yb + 3.15 - drop - 0.28, yb + 3.15 - drop, -out - 0.03, -out + 0.02, s.awning, f.m);
    if (s.valance) faceSign(k, f, k.atlas.get(s.valance), (u0 + u1) / 2, yb + 3.15 - drop - 0.26, 0.24, -out - 0.04, u1 - u0 - 0.4);
  }
  if (s.blade) {
    const r = k.atlas.get(s.blade);
    const at = doorHigh ? d0 - 0.05 : d1 + 0.05;
    const len = r.aspect < 1.2 ? 0.95 : 1.2;
    bladeSign(k, f, r, Math.min(i1 - 0.1, Math.max(i0 + 0.1, at)), yb + (s.awning ? 3.3 : 2.9), len);
  }
}

/** A tile from the atlas stretched over a face from u0 to u1 (a shop window, a mural). */
function signQuadFlat(k: Kit, f: Frame, r: Region, u0: number, u1: number, y0: number, y1: number, w: number): void {
  // (The viewer's left is +u.)
  signQuad(k.sign, r, f.p(u1, y0, w), f.p(u0, y0, w), f.p(u0, y1, w), f.p(u1, y1, w));
}

/**
 * A building on a lot of width W: its body, the shopfronts across its ground floor (`fronts` with
 * their widths, in order along u), and its upper floors in its style. `westHigh`: the west end is at
 * u = W (the north side's lots run westwards). `corner`: which end shows its side (0 or W).
 */
export function building(k: Kit, f: Frame, W: number, yb: number, ylo: number, b: Bldg, fronts: { s: Front; u0: number; u1: number }[], westHigh: boolean, corner: 0 | 1 | null): void {
  const S = k.S;
  const D = DEPTH;
  const tops = { modern: 0.7, bay: 0.4, flat: 0.4, shingle: 0.35, blank: 0.9, parapet: 1.7 };
  const top = yb + GF + b.floors * FH + tops[b.kind];
  if (b.kind === 'modern' || b.kind === 'blank' || b.kind === 'parapet') box(S.walls, 0.02, W - 0.02, ylo - 0.8, top, 0, D, b.color, f.m);
  else rbox(S.walls, 0.02, W - 0.02, ylo - 0.8, top, 0, D, 0.14, b.color, f.m, 1);
  box(S.walls, 0.3, W - 0.3, top - 0.02, top + 0.05, 0.3, D - 0.3, ROOF, f.m);
  // Shopfronts, and the cornice over them.
  for (const q of fronts) shopfront(k, f, q.u0, q.u1, yb, ylo, q.s, b, westHigh);
  const capC = b.kind === 'modern' ? '#3d3f43' : b.trim;
  box(S.trim, -0.02, W + 0.02, yb + GF - 0.34, yb + GF - 0.06, -0.3, 0.02, capC, f.m);
  box(S.trim, 0, W, yb + 3.98, yb + GF - 0.34, -0.06, 0.02, b.kind === 'modern' ? '#3d3f43' : b.accent, f.m);

  const y1 = yb + GF;
  switch (b.kind) {
    case 'bay': {
      const n = b.bays ?? 1;
      const dB = 0.62;
      const slot = W / n;
      const bw = Math.min(3.3, slot * 0.7);
      for (let i = 0; i < n; i++) {
        const c = slot * (i + 0.5);
        const b0 = c - bw / 2;
        const b1 = c + bw / 2;
        const by0 = y1 + 0.12;
        const by1 = y1 + b.floors * FH - 0.12;
        prism(S.walls, [
          [b0, by0, 0],
          [b0 + dB, by0, -dB],
          [b1 - dB, by0, -dB],
          [b1, by0, 0],
        ], [0, by1 - by0, 0], b.color, f.m);
        prism(S.trim, [
          [b0 - 0.2, by1, 0],
          [b0 + dB - 0.08, by1, -dB - 0.24],
          [b1 - dB + 0.08, by1, -dB - 0.24],
          [b1 + 0.2, by1, 0],
        ], [0, 0.3, 0], b.trim, f.m);
        prism(S.trim, [
          [b0 + 0.1, by0 - 0.3, 0],
          [b0 + dB, by0 - 0.3, -dB + 0.08],
          [b1 - dB, by0 - 0.3, -dB + 0.08],
          [b1 - 0.1, by0 - 0.3, 0],
        ], [0, 0.3, 0], b.trim, f.m);
        const front = f.at(b0 + dB, -dB);
        const left = turned(f, b0, 0, Math.PI / 4);
        const right = turned(f, b1 - dB, -dB, -Math.PI / 4);
        const side = dB * Math.SQRT2;
        for (let fl = 0; fl < b.floors; fl++) {
          const wy = y1 + fl * FH + 0.62;
          const fw = bw - 2 * dB;
          win(k, front, 0.22, fw - 0.22, wy, wy + 1.8, b.trim, b.accent);
          win(k, left, 0.2, side - 0.2, wy, wy + 1.8, b.trim, null);
          win(k, right, 0.2, side - 0.2, wy, wy + 1.8, b.trim, null);
          // Flat windows in the gaps beside the bay.
          const gap = (slot - bw) / 2;
          if (gap > 1.1) {
            for (const gc of [slot * i + gap / 2, slot * (i + 1) - gap / 2]) win(k, f, gc - Math.min(0.45, gap / 2 - 0.3), gc + Math.min(0.45, gap / 2 - 0.3), wy, wy + 1.8, b.trim, b.accent);
          }
        }
      }
      for (let fl = 1; fl < b.floors; fl++) box(S.trim, 0, W, y1 + fl * FH - 0.08, y1 + fl * FH + 0.08, -0.1, 0.02, b.trim, f.m);
      cornice(k, f, 0, W, top, b.trim, b.accent);
      break;
    }
    case 'flat':
    case 'shingle': {
      const n = Math.max(1, Math.round(W / 1.9));
      const step = W / n;
      const hood = b.kind === 'shingle' ? null : b.accent;
      for (let fl = 0; fl < b.floors; fl++) {
        const wy = y1 + fl * FH + 0.65;
        for (let i = 0; i < n; i++) {
          const c = step * (i + 0.5);
          const hwid = Math.min(0.55, step / 2 - 0.35);
          win(k, f, c - hwid, c + hwid, wy, wy + 1.75, b.trim, hood);
        }
        if (fl > 0) box(S.trim, 0, W, y1 + fl * FH - 0.08, y1 + fl * FH + 0.08, -0.1, 0.02, b.kind === 'shingle' ? '#5a3c28' : b.trim, f.m);
      }
      if (b.kind === 'shingle') {
        // Shingle courses, and a plain eave.
        for (let y = y1 + 0.35; y < top - 0.4; y += 0.5) box(S.walls, 0.05, W - 0.05, y, y + 0.05, -0.03, 0.0, '#5d3e29', f.m);
        box(S.trim, -0.1, W + 0.1, top - 0.3, top, -0.4, 0.02, '#4a3222', f.m);
      } else cornice(k, f, 0, W, top, b.trim, b.accent);
      if (b.quoins) {
        for (const qu of [0, W]) {
          for (let y = y1 + 0.1, i = 0; y < top - 1; y += 0.42, i++) {
            const ww = i % 2 ? 0.34 : 0.56;
            const a = qu === 0 ? 0 : W - ww;
            box(S.trim, a, a + ww, y, y + 0.36, -0.06, 0.02, b.quoins, f.m);
          }
        }
      }
      break;
    }
    case 'modern': {
      // Bands of glass between white spandrels, bronze fins every other bay, glass balconies.
      const n = Math.max(2, Math.round(W / 2.3));
      const step = W / n;
      for (let fl = 0; fl < b.floors; fl++) {
        const fy = y1 + fl * FH;
        for (let i = 0; i < n; i++) {
          const c = step * (i + 0.5);
          box(S.glass, c - step / 2 + 0.18, c + step / 2 - 0.18, fy + 0.35, fy + 2.75, -0.05, 0.0, '#ffffff', f.m);
          box(S.trim, c - 0.03, c + 0.03, fy + 0.35, fy + 2.75, -0.09, 0.0, '#2c2e31', f.m);
          if ((i + fl) % 3 === 1) {
            box(S.paint, c - step / 2 + 0.1, c + step / 2 - 0.1, fy + 0.02, fy + 0.14, -1.05, 0.0, '#d9d7d0', f.m);
            box(S.glass, c - step / 2 + 0.12, c + step / 2 - 0.12, fy + 0.14, fy + 1.1, -1.05, -0.99, '#ffffff', f.m);
          }
        }
        box(S.walls, 0, W, fy - 0.02, fy + 0.35, -0.08, 0.0, '#f1f1ee', f.m);
      }
      for (let i = 0; i <= n; i += 2) {
        const u = Math.min(W - 0.25, Math.max(0.25, step * i));
        box(S.paint, u - 0.25, u + 0.25, y1, top - 0.7, -0.35, 0.0, b.accent, f.m);
      }
      box(S.trim, -0.05, W + 0.05, top - 0.7, top, -0.12, 0.02, '#f4f4f0', f.m);
      break;
    }
    case 'blank': {
      box(S.trim, -0.05, W + 0.05, top - 0.35, top, -0.2, 0.02, b.trim, f.m);
      if (b.windows) {
        for (let i = 0; i < b.windows; i++) {
          const c = (W * (i + 0.5)) / b.windows;
          win(k, f, c - 0.5, c + 0.5, y1 + 0.8, y1 + 2.3, b.trim, null);
        }
      }
      break;
    }
    case 'parapet': {
      // Nabila's painted parapet with its name, and jazz musicians on the piers.
      box(S.paint, 0, W, y1 - 0.1, top - 0.2, -0.12, 0.0, b.color, f.m);
      box(S.trim, -0.08, W + 0.08, top - 0.25, top, -0.3, 0.02, b.accent, f.m);
      faceSign(k, f, k.atlas.get('nabilas'), W / 2, y1 + 0.02, top - 0.3 - y1, -0.13, W - 0.2);
      break;
    }
  }
  if (b.escape) fireEscape(k, f, W / 2, yb, b.floors, b.escape);

  // The corner: the side's upper windows, and the shop wrapping round.
  if (corner !== null) {
    const sf = corner === 1 ? f.sideAtW(W) : f.sideAt0(D);
    // In the side frame, the front corner is at u = 0 (sideAtW) or u = D (sideAt0).
    const a0 = 0.6;
    const a1 = D - 0.6;
    if (b.kind === 'modern') {
      for (let fl = 0; fl < b.floors; fl++) {
        const fy = y1 + fl * FH;
        box(S.glass, a0 + 0.4, a1 - 0.4, fy + 0.35, fy + 2.75, -0.05, 0.0, '#ffffff', sf.m);
        box(S.walls, 0, D, fy - 0.02, fy + 0.35, -0.08, 0.0, '#f1f1ee', sf.m);
      }
      box(S.trim, 0, D, top - 0.7, top, -0.12, 0.02, '#f4f4f0', sf.m);
    } else if (b.floors > 0) {
      sideWindows(k, sf, a0, a1, yb, b.floors, b.trim, b.kind === 'shingle' ? null : b.accent);
      if (b.kind !== 'blank') cornice(k, sf, 0, D, top, b.trim, b.accent);
    }
    // Ground floor round the corner: the corner shop's windows and fascia for 6 m, then wall.
    const s = fronts[corner === 1 ? fronts.length - 1 : 0].s;
    const g0 = corner === 1 ? 0 : D - 6.5;
    const g1 = corner === 1 ? 6.5 : D;
    box(S.trim, 0, D, yb + GF - 0.34, yb + GF - 0.06, -0.3, 0.02, capC, sf.m);
    box(S.paint, g0 + 0.2, g1 - 0.2, yb + 3.3, yb + 3.98, -0.16, 0.0, s.fascia, sf.m);
    const tile = k.atlas.get(`w_${s.win}`);
    for (let a = g0 + 0.3; a < g1 - 0.5; a += 1.55) {
      signQuadFlat(k, sf, tile, a, a + 1.4, yb + 0.55, yb + 2.76, -0.03);
      box(S.paint, a + 1.4, a + 1.55, yb + 0.55, yb + 2.76, -0.1, 0.0, s.frame, sf.m);
    }
    box(S.paint, g0, g1, ylo - 0.4, yb + 0.55, -0.11, 0.0, s.bulk ?? s.frame, sf.m);
    box(S.paint, g0, g1, yb + 2.76, yb + 3.3, -0.1, 0.0, s.frame, sf.m);
    if (s.sign && s.sign !== 'hazies') {
      const r = k.atlas.get(s.sign);
      faceSign(k, sf, r, (g0 + g1) / 2, yb + 3.38, 0.52, -0.175, g1 - g0 - 0.6);
    }
    if (s.awning) {
      const out = 1.3;
      const drop = 0.55;
      obox(S.paint, [(g0 + g1) / 2, yb + 3.15 - drop / 2, -out / 2], [g1 - g0 - 0.3, 0.05, Math.hypot(out, drop)], [Math.atan2(drop, out), 0, 0], s.awning, sf.m);
      box(S.paint, g0 + 0.15, g1 - 0.15, yb + 3.15 - drop - 0.28, yb + 3.15 - drop, -out - 0.03, -out + 0.02, s.awning, sf.m);
      if (s.valance) faceSign(k, sf, k.atlas.get(s.valance), (g0 + g1) / 2, yb + 3.15 - drop - 0.26, 0.24, -out - 0.04, g1 - g0 - 0.6);
    }
    if (s.sign === 'hazies') {
      // Hazie's red blades, flat on the piers either side of the corner.
      const cu = corner === 1 ? 0.35 : D - 0.35;
      faceSignDown(k, sf, k.atlas.get('v_restaurant'), cu, yb + 0.9, 2.3, -0.16);
      faceSignDown(k, f, k.atlas.get('v_cocktails'), corner === 1 ? W - 0.4 : 0.4, yb + 0.9, 2.3, -0.16);
    }
    // The rest of the side's ground floor: wall with two small windows.
    const r0 = corner === 1 ? 6.5 : 0.4;
    const r1 = corner === 1 ? D - 0.4 : D - 6.5;
    for (const c of [r0 + (r1 - r0) * 0.3, r0 + (r1 - r0) * 0.72]) win(k, sf, c - 0.5, c + 0.5, yb + 1.0, yb + 2.6, b.trim, null);
  }
}

// ---------------------------------------------------------------------------------------------

/** The block's two sides, as laid out: their frames and what's where along them. */
export interface BlockLayout {
  /** Arc length at the block's west corner (the back of Laguna's east sidewalk). */
  sW: number;
  /** Lengths of the north and south sides (to Octavia's sidewalk, and the Green's buildings). */
  lenN: number;
  lenS: number;
}

/**
 * Build the block. `lenN`, `lenS`: how far each side runs east from Laguna (the north side to the
 * sidewalk up Octavia, the south to the sidewalk along the Green's west side).
 */
export function buildBlock(k: Kit, sShops: number, lenN: number, lenS: number): BlockLayout {
  const c = k.ctx.course;
  const S = k.S;
  const sW = sShops + WALK;
  const P = pointAt(c, sW);
  const tx = P.tx;
  const tz = P.tz;
  // Right of the course (south here) is (-tz, tx).
  const rx = -tz;
  const rz = tx;
  const PL = 6.5 + WALK;
  /** World (x, z) at a metres east of the corner, d to the right (south). */
  const at = (a: number, d: number): [number, number] => [P.x + tx * a + rx * d, P.z + tz * a + rz * d];
  const roadY = (a: number): number => pointAt(c, sW + Math.min(Math.max(a, -WALK), lenN)).y;
  const walkY = (a: number): number => roadY(a) + KERB;

  const sides: { side: 1 | -1; list: Bldg[]; len: number }[] = [
    { side: -1, list: NORTH, len: lenN },
    { side: 1, list: SOUTH, len: lenS },
  ];
  for (const { side, list, len } of sides) {
    const fronts = list.flatMap((b) => b.fronts);
    const widths = lay(fronts, len);
    let a = 0;
    let fi = 0;
    list.forEach((b, bi) => {
      const a0 = a;
      const parts: { s: Front; a0: number; a1: number }[] = [];
      for (const s of b.fronts) {
        parts.push({ s, a0: a, a1: a + widths[fi] });
        a += widths[fi++];
      }
      const a1 = a;
      const W = a1 - a0;
      // The lot: the south side's run east (west at u = 0), the north side's west (west at u = W).
      const o = side > 0 ? at(a0, PL) : at(a1, -PL);
      const f = side > 0 ? new Frame(o[0], o[1], tx, tz) : new Frame(o[0], o[1], -tx, -tz);
      const yb = Math.max(walkY(a0), walkY(a1)) + 0.03;
      const ylo = Math.min(walkY(a0), walkY(a1));
      const us = parts.map((p) => (side > 0 ? { s: p.s, u0: p.a0 - a0, u1: p.a1 - a0 } : { s: p.s, u0: a1 - p.a1, u1: a1 - p.a0 }));
      if (side < 0) us.reverse();
      let corner: 0 | 1 | null = null;
      if (b.corner) {
        const west = bi === 0;
        // North: west is u = W; south: west is u = 0.
        corner = side > 0 ? (west ? 0 : 1) : west ? 1 : 0;
      }
      building(k, f, W, yb, ylo, b, us, side < 0, corner);
      k.ctx.occ.claim(f.poly(-0.2, W + 0.2, 0, DEPTH + 0.5));
    });
  }

  // --- On the sidewalks. Sidewalk things by (a, e): e metres out from the buildings' line. On race
  // day the barriers stand along the kerb (hw + 0.45) with the crowd behind them, so nothing stands
  // nearer the kerb than the lamps do (hw + POLE_SET), and each thing is marked for the crowd to
  // keep clear of (kerbside.ts).
  const put = (side: 1 | -1, a: number, e: number): [number, number, number] => {
    const [x, z] = at(a, side * (PL - e));
    return [x, walkY(a), z];
  };
  const mark = (p: [number, number, number], r: number): void => markThing(k.ctx, p[0], p[2], r);
  /** e for a thing whose kerb side is `half` out from its middle: behind the barriers. */
  const behind = (half: number): number => PL - (6.5 + POLE_SET) - half;
  const face = (side: 1 | -1): number => Math.atan2(-rz * side, -rx * side);
  const posN = (key: string): [number, number] => span(NORTH, lenN, key);
  const posS = (key: string): [number, number] => span(SOUTH, lenS, key);

  // Salt & Straw's red benches against the front, and its queue's rope posts.
  {
    const [a0, a1] = posN('saltStraw');
    for (const t of [0.28, 0.72]) {
      const [x, y, z] = put(-1, a0 + (a1 - a0) * t, 0.45);
      bench(k, x, y, z, face(-1), '#c8322b', Math.min(1.5, (a1 - a0) * 0.4));
    }
  }
  // The Muni shelter by the corner of Laguna (the 21 Hayes stops here): its back to the shops, its
  // roof out over the sidewalk (local +z is towards the street), its roof's edge no nearer the kerb
  // than the lamps.
  {
    const [x, y, z] = put(-1, 5.6, behind(0.77));
    for (const u of [-1.3, 0, 1.3]) mark(put(-1, 5.6 + u, behind(0.77)), 0.75);
    const h = Math.atan2(tz, tx);
    const m = new THREE.Matrix4().makeRotationY(-h).setPosition(x, y, z);
    // (Its back is glass you see the shops through: here just the frame, and the ad panel at one end.)
    for (const u of [-1.9, 0, 1.9]) box(S.metal, u - 0.04, u + 0.04, 0, 2.6, -0.05, 0.05, '#8c939c', m);
    for (const y of [0.35, 2.45]) box(S.metal, -1.9, 1.9, y - 0.03, y + 0.03, -0.03, 0.03, '#8c939c', m);
    box(S.paint, 1.0, 1.86, 0.4, 2.3, -0.06, 0.06, '#f4f4f0', m);
    box(S.paint, 1.08, 1.78, 0.5, 2.2, -0.07, 0.07, '#3d7fd6', m);
    // The red canopy, gently vaulted.
    for (const [z, rot] of [
      [-0.3, 0.16],
      [0.4, -0.16],
    ] as const) obox(S.paint, [0, 2.68, z], [4.1, 0.07, 0.74], [rot, 0, 0], '#c8322b', m);
    box(S.paint, -1.4, 1.4, 0.45, 0.5, 0.08, 0.4, '#c8322b', m);
  }
  // La Boulangerie's orange café chairs, round the corner up Octavia and along Hayes.
  {
    const [a0, a1] = posN('boulangerie');
    for (const t of [0.3, 0.75]) {
      const p = put(-1, a0 + (a1 - a0) * t, 1.25);
      cafeSet(k, p[0], p[1], p[2], Math.atan2(tz, tx), '#e8742c');
      mark(p, 0.75);
    }
    // Up Octavia: along the building's east side (on the corner's sidewalk).
    const [cx, cz] = at(lenN, -PL);
    for (const dz of [2.2, 4.4, 6.6, 8.8]) {
      const x = cx + tx * 1.1 - rx * dz;
      const z = cz + tz * 1.1 - rz * dz;
      cafeSet(k, x, walkY(lenN), z, Math.atan2(-rz, -rx), '#e8742c');
      markThing(k.ctx, x, z, 0.75);
    }
  }
  // Souvla and Patxi's parklet: a rusted-steel pergola with timber beams and festoon lights over
  // tables, its kerb-side posts on the lamps' line.
  {
    const [a0] = posS('souvla');
    const [, a1] = posS('patxis');
    const e0 = behind(0);
    const e1 = e0 - 1.6;
    for (let a = a0 + 0.6; a < a1; a += 1.2) mark(put(1, a, (e0 + e1) / 2), 0.8);
    const posts: [number, number, number][][] = [];
    for (let a = a0 + 0.3; a <= a1 - 0.2; a += (a1 - a0 - 0.5) / 2) {
      const row: [number, number, number][] = [];
      for (const e of [e0, e1]) {
        const [x, y, z] = put(1, a, e);
        cyl(S.paint, [x, y, z], [x, y + 2.9, z], 0.06, 0.06, 6, '#8a4b2a');
        row.push([x, y + 2.9, z]);
      }
      posts.push(row);
    }
    for (let i = 0; i < posts.length; i++) {
      cyl(S.paint, posts[i][0], posts[i][1], 0.07, 0.07, 4, '#9a6a3a');
      if (i > 0) {
        for (const j of [0, 1]) {
          cyl(S.paint, posts[i - 1][j], posts[i][j], 0.07, 0.07, 4, '#9a6a3a');
          festoon(k, posts[i - 1][j], posts[i][j], 0.25, 6);
        }
      }
    }
    for (let a = a0 + 0.9; a < a1 - 0.5; a += 1.7) {
      const [x, y, z] = put(1, a, (e0 + e1) / 2);
      cafeSet(k, x, y, z, Math.atan2(tz, tx), '#6b4a30', '#8a6a48');
    }
  }
  // Planters and bike racks along the fronts, and a café table at Gioia's.
  {
    const spots: [1 | -1, string, number][] = [
      [-1, 'credo', 0.5],
      [-1, 'ioan', 0.5],
      [1, 'rails', 0.5],
      [1, 'topo', 0.35],
      [-1, 'malinGoetz', 0.5],
    ];
    for (const [side, key, t] of spots) {
      const [a0, a1] = side < 0 ? posN(key) : posS(key);
      const [x, y, z] = put(side, a0 + (a1 - a0) * t, 0.4);
      planter(k, x, y, z, Math.atan2(tz, tx), 1.2, 0.5, side < 0 ? '#3c3f44' : '#6b5a48');
    }
    for (const [side, a] of [
      [1, 10.5],
      [-1, 33.5],
      [1, 33.5],
    ] as [1 | -1, number][]) {
      const p = put(side, a, behind(0.1));
      mark(p, 0.45);
      const h = Math.atan2(tz, tx);
      const m = new THREE.Matrix4().makeRotationY(-h).setPosition(p[0], p[1], p[2]);
      for (const u of [-0.35, 0.35]) box(S.metal, u - 0.03, u + 0.03, 0, 0.85, -0.03, 0.03, '#3a3f45', m);
      box(S.metal, -0.38, 0.38, 0.82, 0.88, -0.03, 0.03, '#3a3f45', m);
    }
    const [g0, g1] = posS('gioia');
    const p = put(1, (g0 + g1) / 2 + 0.4, 0.9);
    cafeSet(k, p[0], p[1], p[2], Math.atan2(tz, tx), '#1f3a2c');
    mark(p, 0.75);
  }
  // Street trees in their wells, back from the kerb as the streets' own are (hw + 1.5), where the
  // signs and the lamps leave room.
  {
    const greens = ['#4f9a55', '#5aa85c', '#3f8a4c', '#6cb865'];
    const reds = ['#8a3b3b', '#a0524a', '#6f8a45', '#b5654f'];
    // (Clear of the lamp and trolley poles, 2.6 and 28.6 m along, both sides.)
    const trees: [1 | -1, number, string[]][] = [
      [-1, 10.5, greens],
      [-1, 20.5, greens],
      [-1, 39, greens],
      [-1, 47.5, greens],
      [1, 7.5, reds],
      [1, 17.5, reds],
      [1, 25, greens],
      [1, 36.5, reds],
      [1, 44, greens],
    ];
    for (const [side, a, cols] of trees) {
      if (a > (side < 0 ? lenN : lenS) - 3) continue;
      const p = put(side, a, WALK - 1.5);
      streetTree(k, p[0], p[1], p[2], 0.92 + k.rng() * 0.18, cols);
      mark(p, 0.55);
    }
  }
  return { sW, lenN, lenS };
}

/** Where a shop is along its side (a0, a1), as laid out. */
function span(list: Bldg[], len: number, key: string): [number, number] {
  const fronts = list.flatMap((b) => b.fronts);
  const widths = lay(fronts, len);
  let a = 0;
  for (let i = 0; i < fronts.length; i++) {
    if (fronts[i].sign === key) return [a, a + widths[i]];
    a += widths[i];
  }
  throw new Error(`hayes: no shop ${key}`);
}

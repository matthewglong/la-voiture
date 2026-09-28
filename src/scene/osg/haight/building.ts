// A Haight Street building: Victorian flats over shops. The ground floor is its shopfronts (each
// with its own paint, glass, door, fascia sign from the atlas, and maybe an awning, a blade sign
// or a mural over the lot); above it, the flats with their bay windows, and an Italianate cornice,
// a Queen Anne gable or a plain parapet on top. A corner building dresses its side on the cross
// street too, and can round or cut its corner or raise a turret on it. Each face is built in its
// own frame (a along the face, c into the building, y as in the world), so a landmark's extras
// (the legs, the clock) can be put on it the same way.
import * as THREE from 'three';
import { box, cyl, obox, prism, rbox, shade, type GeoBuilder, type V3 } from '../../geo';
import { worldUvBox, type Lot } from '../../victorian';
import type { Ctx } from '../context';
import type { Atlas } from './atlas';

/** A face of a building: a along it (from its origin), c into the building (c < 0 is out in front
 *  of it), y as in the world. Seen from outside, a runs right to left. */
export class Frame {
  readonly m: THREE.Matrix4;
  readonly wx: number;
  readonly wz: number;

  constructor(
    readonly ox: number,
    readonly oz: number,
    readonly ux: number,
    readonly uz: number,
  ) {
    this.wx = -uz;
    this.wz = ux;
    this.m = new THREE.Matrix4().makeBasis(new THREE.Vector3(ux, 0, uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(this.wx, 0, this.wz));
    this.m.setPosition(ox, 0, oz);
  }

  static of(lot: Lot): Frame {
    return new Frame(lot.ox, lot.oz, lot.ux, lot.uz);
  }

  /** A point on the face, in the world. */
  p(a: number, y: number, c: number): V3 {
    return [this.ox + this.ux * a + this.wx * c, y, this.oz + this.uz * a + this.wz * c];
  }

  /** Out of the face, towards the street. */
  get out(): V3 {
    return [-this.wx, 0, -this.wz];
  }

  box(b: GeoBuilder, a0: number, a1: number, y0: number, y1: number, c0: number, c1: number, color: THREE.ColorRepresentation): void {
    box(b, Math.min(a0, a1), Math.max(a0, a1), Math.min(y0, y1), Math.max(y0, y1), Math.min(c0, c1), Math.max(c0, c1), color, this.m);
  }

  rbox(b: GeoBuilder, a0: number, a1: number, y0: number, y1: number, c0: number, c1: number, r: number, color: THREE.ColorRepresentation, seg = 1): void {
    rbox(b, Math.min(a0, a1), Math.max(a0, a1), Math.min(y0, y1), Math.max(y0, y1), Math.min(c0, c1), Math.max(c0, c1), r, color, this.m, seg);
  }

  /** A box centred at (a, y, c), tipped `tilt` about the a axis (awnings). */
  tilted(b: GeoBuilder, a: number, y: number, c: number, sa: number, sy: number, sc: number, tilt: number, color: THREE.ColorRepresentation): void {
    obox(b, [a, y, c], [sa, sy, sc], [tilt, 0, 0], color, this.m);
  }

  /** A cell of the atlas on the face's plane at depth c, facing out, the right way round. */
  sign(atlas: Atlas, b: GeoBuilder, name: string, a0: number, a1: number, y0: number, y1: number, c: number, sub?: [number, number, number, number]): void {
    const lo = Math.min(a0, a1);
    const hi = Math.max(a0, a1);
    atlas.quad(b, name, this.p(hi, y0, c), this.p(lo, y0, c), this.p(lo, y1, c), this.p(hi, y1, c), this.out, sub);
  }

  /** The side face at a = 0 (end 0) or a = W (end 1), running from its front corner back (end 1)
   *  or from its back corner forward (end 0), so that it too runs right to left seen from outside. */
  side(end: 0 | 1, W: number, D: number): Frame {
    if (end === 1) {
      const o = this.p(W, 0, 0);
      return new Frame(o[0], o[2], this.wx, this.wz);
    }
    const o = this.p(0, 0, D);
    return new Frame(o[0], o[2], -this.wx, -this.wz);
  }
}

// ---------------------------------------------------------------------------------------------
// What a building is

/** A shopfront on the ground floor. */
export interface Front {
  /** Its share of the building's width. */
  w: number;
  /** Its paint: the surround, the fascia board. */
  paint: string;
  /** Pilasters and window frames (default: the building's trim). */
  trim?: string;
  sign?: string;
  /** The fascia board's height (m, default 0.9). */
  fascia?: number;
  /** A painted picture over the whole front instead of glass (it has its windows in it). */
  mural?: string;
  muralSub?: [number, number, number, number];
  bulk?: string;
  awning?: string;
  awningSign?: string;
  /** A blade sign standing out from the front's far end, readable along the street. */
  blade?: string;
  bladeH?: number;
  /** The blade at the front's near end (a corner shop's) rather than its far end. */
  bladeNear?: boolean;
  /** No shop at all: windows and a door (a school, flats). */
  plain?: boolean;
  /** Shut up behind a steel gate. */
  gate?: boolean;
  /** Arched windows (Blue Front, Hippie Thai, Amal's). */
  arched?: boolean;
  door?: 'l' | 'r';
}

export interface Spec {
  name: string;
  w: number;
  /** Storeys, the shop floor included. */
  floors: number;
  body: string;
  trim?: string;
  accent?: string;
  top?: 'cornice' | 'gable' | 'parapet';
  bays?: number;
  /** Bay windows square rather than cut (the Doolan-Larson's neighbours). */
  squareBays?: boolean;
  fronts: Front[];
  depth?: number;
  shopH?: number;
  /** A cross street at this end, in course order (the start of the lot's span, or its end). */
  corner?: 'start' | 'end';
  cornerKind?: 'round' | 'cut' | 'turret';
  /** The shopfronts round the corner on the side street (default: the first front's paint). */
  sideFront?: Front;
  /** Landmark extras, given the finished building. */
  extra?: (b: Built) => void;
}

/** A finished building, for its extras. */
export interface Built {
  spec: Spec;
  front: Frame;
  /** The side face on the cross street, if it's on a corner. */
  side: Frame | null;
  /** a on the front at the corner. */
  cornerA: number;
  W: number;
  D: number;
  /** Sidewalk level, the top of the shop floor, the upper floors' height, the wall top. */
  y0: number;
  shopTop: number;
  fh: number;
  top: number;
  /** Where the bays are on the front (a0, a1). */
  bays: [number, number][];
}

const CREAM = '#fbf6e8';
const GLASS = '#ffffff';
const FH = 3.2;

/** What a building needs from the scene. */
export interface Sinks {
  ctx: Ctx;
  atlas: Atlas;
  signs: GeoBuilder;
  /** Where every shop door is (the crowd leaves them clear). */
  doors: { x: number; z: number }[];
}

/**
 * A building on its lot (the frontage on the property line, the building extending to the right
 * of the lot's direction, away from the street): the body, the shopfronts, the flats, the top.
 * `cornerEnd` is which end of the lot (0 or 1) is on a cross street, if either.
 */
export function building(k: Sinks, lot: Lot, spec: Spec, y0: number, cornerEnd: 0 | 1 | null): Built {
  const ctx = k.ctx;
  const S = ctx.sinks;
  const f = Frame.of(lot);
  const W = lot.W;
  const D = spec.depth ?? 13;
  const trim = spec.trim ?? CREAM;
  const accent = spec.accent ?? shade(spec.body, 0.72).getStyle();
  const G = spec.shopH ?? 4.2;
  const upper = spec.floors - 1;
  const shopTop = y0 + G;
  const top = spec.top ?? (upper > 0 ? 'cornice' : 'parapet');
  const wallTop = shopTop + upper * FH + (top === 'cornice' ? 1.0 : top === 'parapet' ? 0.9 : 0.35);
  let yLow = Infinity;
  for (const [a, c] of [
    [0, 0],
    [W, 0],
    [0, D],
    [W, D],
    [W / 2, D / 2],
  ]) {
    const q = f.p(a, 0, c);
    yLow = Math.min(yLow, ctx.ground(q[0], q[2]));
  }
  yLow -= 0.5;

  // --- The body and its roof; the back's windows are the facade texture (it's seen from the hills
  // behind, and down the cross streets).
  f.rbox(S.walls, 0.03, W - 0.03, yLow, wallTop, 0, D, 0.14, spec.body);
  {
    const p0 = f.p(0.2, 0, D - 0.02);
    const p1 = f.p(W - 0.2, 0, D + 0.05);
    S.facades.add(worldUvBox(Math.min(p0[0], p1[0]), Math.max(p0[0], p1[0]), yLow, wallTop - 0.15, Math.min(p0[2], p1[2]), Math.max(p0[2], p1[2])), shade(spec.body, 0.97));
  }
  f.box(S.walls, 0.35, W - 0.35, wallTop - 0.02, wallTop + 0.05, 0.4, D - 0.35, '#8d9199');
  if (upper > 0 && ctx.rng() < 0.5) {
    const a = 0.8 + ctx.rng() * (W - 2.2);
    f.box(S.walls, a, a + 0.7, wallTop, wallTop + 1.1, D - 3, D - 2.2, '#b4574a');
  }

  // --- The shopfronts.
  const total = spec.fronts.reduce((s, fr) => s + fr.w, 0);
  let a = 0;
  spec.fronts.forEach((fr, i) => {
    const a1 = a + (fr.w / total) * W;
    shopfront(k, f, a, a1, y0, G, fr, trim, i === spec.fronts.length - 1);
    a = a1;
  });

  // --- The flats: bay windows, flat windows between, the bands between floors.
  const baysAt: [number, number][] = [];
  if (upper > 0) {
    const n = spec.bays ?? (W > 8.5 ? 2 : 1);
    const slot = W / Math.max(1, n);
    const bw = Math.min(3.3, slot - 1.1);
    for (let i = 0; i < n; i++) {
      const mid = slot * (i + 0.5);
      baysAt.push([mid - bw / 2, mid + bw / 2]);
    }
    for (const [b0, b1] of baysAt) bay(k, f, b0, b1, shopTop + 0.05, shopTop + upper * FH - 0.3, upper, spec.body, trim, accent, spec.squareBays ?? false);
    // Flat windows where there's room between bays and ends.
    const edges = [0.2, ...baysAt.flat(), W - 0.2];
    for (let i = 0; i < edges.length; i += 2) {
      const g0 = edges[i];
      const g1 = edges[i + 1];
      const room = g1 - g0;
      if (room < 1.5) continue;
      const nw = Math.max(1, Math.floor(room / 2.1));
      for (let j = 0; j < nw; j++) {
        const cx = g0 + (room * (j + 0.5)) / nw;
        for (let fl = 0; fl < upper; fl++) flatWindow(S, f, cx - 0.5, cx + 0.5, shopTop + fl * FH + 0.75, shopTop + fl * FH + 2.55, trim, accent);
      }
    }
    for (let fl = 1; fl < upper; fl++) f.box(S.trim, 0, W, shopTop + fl * FH - 0.1, shopTop + fl * FH + 0.1, -0.1, 0.02, trim);
  }

  // --- The top.
  if (top === 'cornice') {
    f.box(S.trim, -0.12, W + 0.12, wallTop - 0.42, wallTop, -0.6, 0.02, trim);
    f.box(S.trim, 0, W, wallTop - 1.0, wallTop - 0.42, -0.1, 0.02, accent);
    const nb = Math.max(3, Math.round(W / 1.7));
    for (let i = 0; i <= nb; i++) {
      const ab = 0.25 + (i * (W - 0.5)) / nb;
      f.box(S.trim, ab - 0.1, ab + 0.1, wallTop - 0.95, wallTop - 0.42, -0.48, 0, trim);
    }
  } else if (top === 'parapet') {
    f.box(S.trim, -0.08, W + 0.08, wallTop - 0.14, wallTop + 0.06, -0.22, 0.35, trim);
  } else {
    gable(S, f, W, wallTop, spec.body, trim, accent);
  }

  // --- The side on the cross street.
  let side: Frame | null = null;
  const cornerA = cornerEnd === 1 ? W : 0;
  if (cornerEnd !== null) {
    side = f.side(cornerEnd, W, D);
    const sf = side;
    // The side runs 0..D; its corner with the front is at a = 0 for end 1, a = D for end 0.
    const nearA = cornerEnd === 1 ? 0 : D;
    const dir = cornerEnd === 1 ? 1 : -1;
    const run = Math.min(D - 1, 6.5);
    const sfr: Front = spec.sideFront ?? { ...spec.fronts[cornerEnd === 1 ? spec.fronts.length - 1 : 0], w: 1, awning: undefined, blade: undefined, door: cornerEnd === 1 ? 'l' : 'r' };
    const s0 = nearA + dir * (spec.cornerKind ? 1.2 : 0.05);
    const s1 = nearA + dir * run;
    shopfront(k, sf, Math.min(s0, s1), Math.max(s0, s1), y0, G, sfr, trim, false);
    if (upper > 0) {
      for (let x = 2.2; x < D - 1; x += 2.6) {
        const ax = cornerEnd === 1 ? x : D - x;
        if (spec.cornerKind && x < 2.4) continue;
        for (let fl = 0; fl < upper; fl++) flatWindow(S, sf, ax - 0.5, ax + 0.5, shopTop + fl * FH + 0.75, shopTop + fl * FH + 2.55, trim, accent);
      }
      for (let fl = 1; fl < upper; fl++) sf.box(S.trim, 0, D, shopTop + fl * FH - 0.1, shopTop + fl * FH + 0.1, -0.1, 0.02, trim);
    }
    if (top === 'cornice') {
      sf.box(S.trim, -0.12, D + 0.12, wallTop - 0.42, wallTop, -0.6, 0.02, trim);
      sf.box(S.trim, 0, D, wallTop - 1.0, wallTop - 0.42, -0.1, 0.02, accent);
    } else if (top === 'parapet') {
      sf.box(S.trim, -0.08, D + 0.08, wallTop - 0.14, wallTop + 0.06, -0.22, 0, trim);
    }
    if (spec.cornerKind && upper > 0) cornerPiece(k, f, cornerA, spec.cornerKind, shopTop, wallTop, upper, spec.body, trim, accent);
  }

  const built: Built = { spec, front: f, side, cornerA, W, D, y0, shopTop, fh: FH, top: wallTop, bays: baysAt };
  spec.extra?.(built);
  return built;
}

/** A shopfront from a0 to a1 on a face: paint, pilasters, bulkhead and glass (or a mural), a door,
 *  the fascia with its sign, the ledge over it; an awning and a blade sign if it has them. */
export function shopfront(k: Sinks, f: Frame, a0: number, a1: number, y0: number, G: number, fr: Front, trim: string, last: boolean): void {
  const S = k.ctx.sinks;
  const tr = fr.trim ?? trim;
  const w = a1 - a0;
  const fasciaY1 = y0 + G - 0.14;
  const fasciaY0 = fasciaY1 - (fr.fascia ?? 0.9);
  // Paint over the ground floor.
  f.box(S.paint, a0, a1, y0 - 0.2, y0 + G, -0.06, 0.02, fr.paint);
  // Pilasters.
  f.box(S.trim, a0, a0 + 0.26, y0 - 0.05, fasciaY0, -0.2, 0, tr);
  if (last) f.box(S.trim, a1 - 0.26, a1, y0 - 0.05, fasciaY0, -0.2, 0, tr);
  const doorW = Math.min(1.15, w * 0.3);
  const doorL = (fr.door ?? 'r') === 'l';
  const d0 = doorL ? a0 + 0.4 : a1 - 0.4 - doorW;
  const d1 = d0 + doorW;
  if (fr.mural) {
    f.sign(k.atlas, k.signs, fr.mural, a0 + 0.26, last ? a1 - 0.26 : a1, y0, fasciaY1, -0.08, fr.muralSub);
  } else if (fr.plain) {
    // Windows along it instead of a shopfront.
    const g0 = doorL ? d1 + 0.3 : a0 + 0.4;
    const g1 = doorL ? a1 - 0.4 : d0 - 0.3;
    const nw = Math.max(0, Math.floor((g1 - g0) / 1.9));
    for (let i = 0; i < nw; i++) {
      const am = g0 + ((g1 - g0) * (i + 0.5)) / nw;
      flatWindow(S, f, am - 0.55, am + 0.55, y0 + 1.0, fasciaY0 - 0.35, tr, tr);
    }
  } else {
    // Bulkhead, glass, mullions.
    const g0 = doorL ? d1 + 0.15 : a0 + 0.3;
    const g1 = doorL ? a1 - 0.3 : d0 - 0.15;
    if (g1 - g0 > 0.4) {
      f.box(S.paint, g0, g1, y0 - 0.05, y0 + 0.6, -0.14, 0, fr.bulk ?? shade(fr.paint, 0.7).getStyle());
      const gTop = fr.arched ? fasciaY0 - 0.35 : fasciaY0 - 0.12;
      f.box(S.glass, g0, g1, y0 + 0.6, gTop, -0.04, 0.03, GLASS);
      f.box(S.trim, g0 - 0.05, g1 + 0.05, gTop, gTop + 0.1, -0.12, 0, tr);
      const nm = Math.max(0, Math.round((g1 - g0) / 1.6) - 1);
      for (let i = 1; i <= nm; i++) {
        const am = g0 + ((g1 - g0) * i) / (nm + 1);
        f.box(S.trim, am - 0.05, am + 0.05, y0 + 0.6, gTop, -0.1, 0, tr);
      }
      if (fr.gate) {
        for (let am = g0 + 0.12; am < g1; am += 0.22) f.box(S.metal, am - 0.018, am + 0.018, y0 + 0.62, gTop, -0.14, -0.1, '#2a2c30');
        f.box(S.metal, g0, g1, gTop - 0.1, gTop, -0.16, -0.1, '#2a2c30');
      }
    }
  }
  // The door.
  const dc = f.p((d0 + d1) / 2, y0, 0);
  k.doors.push({ x: dc[0], z: dc[2] });
  f.box(S.trim, d0 - 0.1, d1 + 0.1, y0 - 0.05, y0 + 2.55, -0.1, 0, tr);
  f.box(S.glass, d0, d1, y0, y0 + 2.4, -0.13, -0.09, '#9aa6b4');
  f.box(S.paint, d0, d1, y0, y0 + 0.9, -0.15, -0.1, shade(fr.paint, 0.6).getStyle());
  // The fascia, its sign and the ledge over it.
  if (!fr.mural && !fr.plain) f.box(S.paint, a0 + 0.1, a1 - 0.1, fasciaY0, fasciaY1, -0.22, 0, fr.paint);
  if (fr.sign) {
    // As wide as the board allows, but not stretched much past its own proportions.
    const asp = k.atlas.aspect(fr.sign);
    const hMax = fasciaY1 - fasciaY0 - 0.1;
    const sw = Math.min(w - 0.4, hMax * asp * 1.15);
    const sh = Math.min(hMax, sw / (asp * 0.85));
    const am = (a0 + a1) / 2;
    const ym = (fasciaY0 + fasciaY1) / 2;
    f.sign(k.atlas, k.signs, fr.sign, am - sw / 2, am + sw / 2, ym - sh / 2, ym + sh / 2, fr.mural ? -0.1 : -0.235);
  }
  f.box(S.trim, a0 - 0.04, a1 + 0.04, fasciaY1, y0 + G + 0.08, -0.38, 0, tr);
  // A canvas awning, sloping out and down under the fascia.
  if (fr.awning) {
    const out = 1.55;
    const drop = 0.75;
    const tilt = Math.atan2(drop, out);
    const len = Math.hypot(out, drop);
    const yTop = fasciaY0 - 0.05;
    f.tilted(S.paint, (a0 + a1) / 2, yTop - drop / 2, -out / 2, w - 0.3, 0.06, len, -tilt, fr.awning);
    f.box(S.paint, a0 + 0.15, a1 - 0.15, yTop - drop - 0.32, yTop - drop, -out - 0.04, -out + 0.02, fr.awning);
    if (fr.awningSign) {
      // On the slope, the right way up seen from the street.
      const hi = Math.max(a0, a1) - 0.2;
      const lo = Math.min(a0, a1) + 0.2;
      const eps = 0.05;
      k.atlas.quad(k.signs, fr.awningSign, f.p(hi, yTop - drop + eps, -out - eps * 0.5), f.p(lo, yTop - drop + eps, -out - eps * 0.5), f.p(lo, yTop + eps, eps * 0.5), f.p(hi, yTop + eps, eps * 0.5), [f.out[0], 1.8, f.out[2]]);
    }
  }
  // A blade sign at the front's far end (or near), both faces readable along the street.
  if (fr.blade) {
    const bh = fr.bladeH ?? 1.1;
    const ab = fr.bladeNear ? a0 + 0.35 : a1 - 0.35;
    const yb0 = y0 + G + 0.35;
    const cOut = -0.35;
    const bw = bh * k.atlas.aspect(fr.blade);
    cyl(S.metal, f.p(ab, yb0 + bh + 0.1, 0), f.p(ab, yb0 + bh + 0.1, cOut - bw - 0.1), 0.03, 0.03, 5, '#2a2c30');
    f.box(S.paint, ab - 0.04, ab + 0.04, yb0, yb0 + bh, cOut - bw, cOut, fr.paint);
    const facing = (s: number): V3 => [f.ux * s, 0, f.uz * s];
    // The face towards +a (seen from further along the street) and the one towards -a.
    k.atlas.quad(k.signs, fr.blade, f.p(ab + 0.045, yb0, cOut), f.p(ab + 0.045, yb0, cOut - bw), f.p(ab + 0.045, yb0 + bh, cOut - bw), f.p(ab + 0.045, yb0 + bh, cOut), facing(1));
    k.atlas.quad(k.signs, fr.blade, f.p(ab - 0.045, yb0, cOut - bw), f.p(ab - 0.045, yb0, cOut), f.p(ab - 0.045, yb0 + bh, cOut), f.p(ab - 0.045, yb0 + bh, cOut - bw), facing(-1));
  }
}

/** A plain sash window with a frame, a sill and a hood. */
export function flatWindow(S: Ctx['sinks'], f: Frame, a0: number, a1: number, y0: number, y1: number, trim: string, hood: string): void {
  f.box(S.trim, a0 - 0.13, a1 + 0.13, y0 - 0.12, y1 + 0.12, -0.08, 0.02, trim);
  f.box(S.glass, a0, a1, y0, y1, -0.11, -0.07, GLASS);
  f.box(S.trim, a0 - 0.22, a1 + 0.22, y0 - 0.24, y0 - 0.12, -0.24, 0, trim);
  f.box(S.trim, a0 - 0.25, a1 + 0.25, y1 + 0.12, y1 + 0.3, -0.26, 0, hood);
}

/** A bay window over the upper floors: cut (three faces) or square, capped and bracketed, with a
 *  window in each face on each floor. */
function bay(k: Sinks, f: Frame, b0: number, b1: number, yB: number, yT: number, floors: number, body: string, trim: string, accent: string, square: boolean): void {
  const S = k.ctx.sinks;
  const dB = 0.75;
  const inset = square ? 0 : dB;
  const pts = (y: number, grow: number): V3[] => [
    [b0 - grow, y, 0],
    [b0 + inset - grow * 0.4, y, -dB - grow],
    [b1 - inset + grow * 0.4, y, -dB - grow],
    [b1 + grow, y, 0],
  ];
  prism(S.walls, pts(yB, 0), [0, yT - yB, 0], body, f.m);
  prism(S.trim, pts(yT, 0.22), [0, 0.3, 0], accent, f.m);
  prism(S.trim, pts(yB - 0.28, -0.08), [0, 0.28, 0], trim, f.m);
  const faces: { a0: number; a1: number; rot: number; c: number }[] = square
    ? [{ a0: b0 + 0.3, a1: b1 - 0.3, rot: 0, c: -dB }]
    : [
        { a0: b0 + inset + 0.15, a1: b1 - inset - 0.15, rot: 0, c: -dB },
        { a0: b0, a1: b0 + inset, rot: Math.PI / 4, c: -dB / 2 },
        { a0: b1 - inset, a1: b1, rot: -Math.PI / 4, c: -dB / 2 },
      ];
  for (let fl = 0; fl < floors; fl++) {
    const y0 = yB + fl * FH + 0.55;
    const y1 = y0 + 1.85;
    for (const face of faces) {
      const len = face.rot === 0 ? face.a1 - face.a0 : (face.a1 - face.a0) * Math.SQRT2;
      const am = (face.a0 + face.a1) / 2;
      const ww = Math.max(0.35, len - (face.rot === 0 ? 0.25 : 0.34));
      // (The narrow cut faces' panes go without frames.)
      if (face.rot === 0) obox(S.trim, [am, (y0 + y1) / 2, face.c - 0.02], [ww + 0.22, y1 - y0 + 0.22, 0.08], [0, face.rot, 0], trim, f.m);
      obox(S.glass, [am, (y0 + y1) / 2, face.c - 0.06], [ww, y1 - y0, 0.04], [0, face.rot, 0], GLASS, f.m);
    }
    if (fl > 0) prism(S.trim, pts(yB + fl * FH - 0.08, 0.04), [0, 0.16, 0], trim, f.m);
  }
}

/** A Queen Anne front gable with its attic window and fish-scale band. */
function gable(S: Ctx['sinks'], f: Frame, W: number, eave: number, body: string, trim: string, accent: string): void {
  const gh = W * 0.42;
  prism(S.walls, [
    [0.05, eave, 0],
    [W - 0.05, eave, 0],
    [W / 2, eave + gh, 0],
  ], [0, 0, 6.2], body, f.m);
  const ang = Math.atan2(gh, W / 2);
  const len = Math.hypot(W / 2, gh) + 0.5;
  for (const sgn of [-1, 1]) {
    const cu = W / 2 + (sgn * (W / 2)) / 2;
    const cy = eave + gh / 2 + 0.12;
    obox(S.walls, [cu, cy + 0.12, 2.9], [len, 0.16, 6.9], [0, 0, -sgn * ang], '#8d9199', f.m);
    obox(S.trim, [cu, cy, -0.38], [len, 0.26, 0.2], [0, 0, -sgn * ang], accent, f.m);
  }
  flatWindow(S, f, W / 2 - 0.45, W / 2 + 0.45, eave + 0.45, eave + Math.min(1.6, gh - 0.5), trim, accent);
  f.box(S.trim, -0.1, W + 0.1, eave - 0.3, eave, -0.35, 0.02, accent);
  f.box(S.walls, 0.2, W - 0.2, eave - 1.0, eave - 0.3, -0.06, 0.02, shade(body, 0.88));
}

/** The corner: a round bay (Ben & Jerry's), a cut bay (the Counterculture Museum's) or a turret
 *  (Psychedelic SF's) over the upper floors. */
function cornerPiece(k: Sinks, f: Frame, a: number, kind: 'round' | 'cut' | 'turret', shopTop: number, wallTop: number, floors: number, body: string, trim: string, accent: string): void {
  const S = k.ctx.sinks;
  const inward = a > 0 ? -1 : 1;
  if (kind === 'cut') {
    // A square bay turned 45° on the corner.
    const s = 1.5;
    const ca = a + inward * 0.35;
    const q = f.p(ca, 0, 0.35);
    const rot = Math.atan2(f.uz, f.ux) - (inward * Math.PI) / 4;
    const m = new THREE.Matrix4().makeRotationY(-rot).setPosition(q[0], 0, q[2]);
    box(S.walls, -s / 2, s / 2, shopTop, wallTop - 0.4, -s / 2 - 0.4, s / 2 - 0.4, body, m);
    for (let fl = 0; fl < floors; fl++) {
      const y0 = shopTop + fl * FH + 0.55;
      box(S.trim, -0.55, 0.55, y0 - 0.1, y0 + 1.95, -s / 2 - 0.44, -s / 2 - 0.4, trim, m);
      box(S.glass, -0.45, 0.45, y0, y0 + 1.85, -s / 2 - 0.47, -s / 2 - 0.44, GLASS, m);
    }
    box(S.trim, -s / 2 - 0.2, s / 2 + 0.2, wallTop - 0.4, wallTop - 0.1, -s / 2 - 0.65, s / 2 - 0.2, accent, m);
    return;
  }
  const r = kind === 'turret' ? 1.55 : 1.35;
  // Standing proud of both faces by 0.7 m.
  const ctr = f.p(a + inward * (r - 0.7), 0, r - 0.7);
  const yTop = kind === 'turret' ? wallTop + 1.6 : wallTop - 0.35;
  const body3 = new THREE.CylinderGeometry(r, r, yTop - shopTop + 0.2, 14);
  body3.translate(ctr[0], (yTop + shopTop - 0.2) / 2, ctr[2]);
  S.walls.add(body3, body);
  for (let fl = 0; fl < floors; fl++) {
    const y0 = shopTop + fl * FH + 0.55;
    const gl = new THREE.CylinderGeometry(r + 0.03, r + 0.03, 1.85, 14, 1, true);
    gl.translate(ctr[0], y0 + 0.92, ctr[2]);
    S.glass.add(gl, GLASS);
    const band = new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.2, 14);
    band.translate(ctr[0], shopTop + fl * FH, ctr[2]);
    S.trim.add(band, fl === 0 ? accent : trim);
    // Mullions round it.
    for (let j = 0; j < 7; j++) {
      const ang = (j / 7) * Math.PI * 2;
      cyl(S.trim, [ctr[0] + Math.cos(ang) * (r + 0.05), y0, ctr[2] + Math.sin(ang) * (r + 0.05)], [ctr[0] + Math.cos(ang) * (r + 0.05), y0 + 1.85, ctr[2] + Math.sin(ang) * (r + 0.05)], 0.05, 0.05, 4, trim);
    }
  }
  const cap = new THREE.CylinderGeometry(r + 0.22, r + 0.1, 0.35, 14);
  cap.translate(ctr[0], yTop, ctr[2]);
  S.trim.add(cap, accent);
  if (kind === 'turret') {
    const cone = new THREE.ConeGeometry(r + 0.3, 3.2, 14);
    cone.translate(ctr[0], yTop + 1.75, ctr[2]);
    S.walls.add(cone, '#3d4a8a');
    const fin = new THREE.SphereGeometry(0.2, 8, 6);
    fin.translate(ctr[0], yTop + 3.45, ctr[2]);
    S.gloss.add(fin, '#e0b23a');
  } else {
    const dome = new THREE.SphereGeometry(r + 0.1, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(1, 0.45, 1);
    dome.translate(ctr[0], yTop + 0.17, ctr[2]);
    S.walls.add(dome, '#8d9199');
  }
  // A corbel under it, over the shop's corner.
  const corb = new THREE.ConeGeometry(r, 0.9, 14, 1, false);
  corb.rotateX(Math.PI);
  corb.translate(ctr[0], shopTop - 0.25, ctr[2]);
  S.trim.add(corb, trim);
}

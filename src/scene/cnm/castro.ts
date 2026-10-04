// The Castro, where the race starts and finishes: Castro St from Market (Harvey Milk Plaza and the
// giant rainbow flag on the right, Twin Peaks Tavern on the left corner), the Castro Theatre at the
// start line, the shops and bars of the 400 and 500 blocks with a rainbow flag on every lamp post and
// over every shop, the rainbow crosswalks at 18th and 19th with disco balls over 18th, Pride bunting
// and balloon arches across the street; then up the hill past the Victorians (the generic houses)
// under the 24's trolley wires to Castro Hill at 22nd and down to 24th. And Market St back from
// Church: its shops (Walgreens, Twin Peaks Hotel, the Swedish American Hall, Hi Tops, Peet's, Café
// Flore, the Lookout, Super Duper), the F-line's tracks and wires down its middle, a vintage PCC
// streetcar waiting at the Castro terminus, and Pink Triangle Park across the corner.
//
// Shopfronts are the Haight's buildings (osg/haight/building.ts) with the Castro's own signs
// (castro/signs.ts), the theatre is its own (castro/theatre.ts), the flags and the rest are
// castro/kit.ts. Every lot is fitted to the compressed blocks in the order the real ones stand, on
// their real sides (odd numbers on the east side of Castro St, the south side of Market).
import * as THREE from 'three';
import { pointAt, wrapS, type CoursePoint, type Section } from '../../track';
import { GeoBuilder, box, cyl, meshOf, obox, strip, type V3 } from '../geo';
import { tree } from '../props';
import { makeRng } from '../util';
import type { Lot } from '../victorian';
import { along, rectPoly, type Ctx, type Hood } from '../osg/context';
import { Atlas } from '../osg/haight/atlas';
import { Frame, building, type Built, type Sinks as Kit, type Spec } from '../osg/haight/building';
import { markDoor, markThing } from '../osg/kerbside';
import { paveQuad } from '../osg/paving';
import { CORNER, CROSSING, KERB, POLE_SET, STREET_KINDS, WALK, groundStrip, pts, streetArms, trolleyWires, turnOf } from '../osg/streets';
import { balloonArch, bracketFlag, bunting, discoBalls, giantFlag, pccCar, pylon } from './castro/kit';
import { PRIDE, castroCells } from './castro/signs';
import { castroTheatre } from './castro/theatre';

/** Standard gauge, and the F-line's two tracks either side of Market St's middle (m). */
const GAUGE = 1.435;
const F_TRACK = 1.9;
const WIRE_H = 5.6;
const SPAN_H = 6.6;
const STEEL = '#9aa0a6';
const WIRE = '#2a2c30';
const POLE = '#3b4a42';

type XZ = [number, number];

function inPoly(poly: readonly XZ[], x: number, z: number): boolean {
  let inside = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const p = poly[a];
    const q = poly[b];
    if (p[1] > z !== q[1] > z && x < ((q[0] - p[0]) * (z - p[1])) / (q[1] - p[1]) + p[0]) inside = !inside;
  }
  return inside;
}

export function buildCastro(ctx: Ctx): Hood {
  const c = ctx.course;
  const S = ctx.sinks;
  const rng = makeRng(1977);
  const atlas = new Atlas(castroCells());
  const signs = new GeoBuilder();
  const k: Kit = { ctx, atlas, signs, doors: [] };
  const mat = new THREE.MeshStandardMaterial({ map: atlas.texture, vertexColors: true, roughness: 0.55 });
  const things: { x: number; z: number; r: number }[] = [];

  const ch = ctx.chunk('castro');
  const mk = ctx.chunk('market');
  const cornerC = c.sections.find((q) => q.kind === CORNER && Math.abs(q.s0 - ch.s0) < 1);
  const cornerM = c.sections.find((q) => q.kind === CORNER && Math.abs(q.s1 - mk.s0) < 1);
  const crossAt = (name: string): Section | undefined => c.sections.find((q) => q.kind === CROSSING && Math.abs(q.s0 - ctx.mark('castro', name)) < 0.5);
  const x18 = crossAt('18th');
  const x19 = crossAt('19th');
  if (!cornerC || !cornerM || !x18 || !x19) return {};
  // (Non-optional, for the pieces below.)
  const corner: Section = cornerC;
  const hw = x18.hw;
  const edge = hw + WALK;
  const mHw = c.sections[pointAt(c, (mk.s0 + mk.s1) / 2).sec].hw;
  const mEdge = mHw + WALK;
  const L = c.length;
  const yAt = (s: number): number => pointAt(c, wrapS(c, s)).y;

  // --- What a lot must keep off: the cross streets' arms (with their sidewalks), any other stretch of
  // road (with its sidewalks), and what's built here already.
  const arms = streetArms(c).map((a) => rectPoly(a.x, a.z, a.h, a.u0, a.u1, -(a.road + WALK), a.road + WALK));
  const mine: XZ[][] = [];
  const nearRoad = (x: number, z: number, s0: number, s1: number): boolean => {
    for (let s = s0; s <= s1; s += 1) {
      const p = pointAt(c, wrapS(c, s));
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < (p.hw + WALK - 0.3) ** 2) return true;
    }
    return false;
  };
  const clear = (poly: XZ[], s: number): boolean => {
    const probes: XZ[] = [...poly];
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      probes.push([(poly[i][0] + poly[j][0]) / 2, (poly[i][1] + poly[j][1]) / 2]);
    }
    for (const [x, z] of probes) {
      if (arms.some((r) => inPoly(r, x, z)) || mine.some((r) => inPoly(r, x, z))) return false;
      if (nearRoad(x, z, s - 70, s + 70)) return false;
    }
    for (const r of [...arms, ...mine]) for (const [x, z] of r) if (inPoly(poly, x, z)) return false;
    return true;
  };
  /** A lot's footprint: its front `w` long from s on one side, `D` deep. */
  const lotPoly = (s: number, w: number, side: 1 | -1, e: number, D: number): XZ[] => {
    const a = along(c, wrapS(c, s), side * e);
    const b = along(c, wrapS(c, s + w), side * e);
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const ox = (side * -(b.z - a.z)) / len;
    const oz = (side * (b.x - a.x)) / len;
    return [
      [a.x, a.z],
      [b.x, b.z],
      [b.x + ox * D, b.z + oz * D],
      [a.x + ox * D, a.z + oz * D],
    ];
  };
  /** The first s from s0 (or last back from s1) where a lot of depth D is clear. */
  const firstClear = (s0: number, s1: number, side: 1 | -1, e: number, D: number): number => {
    for (let s = s0; s < s1; s += 0.5) if (clear(lotPoly(s, 2.5, side, e, D), s)) return s;
    return s1;
  };
  const lastClear = (s0: number, s1: number, side: 1 | -1, e: number, D: number): number => {
    for (let s = s1; s > s0; s -= 0.5) if (clear(lotPoly(s - 2.5, 2.5, side, e, D), s)) return s;
    return s0;
  };

  // --- Buildings in a row along the course -------------------------------------------------------
  const built: Record<string, Built> = {};
  /** A side of a block, the buildings given in course order and fitted to [s0, s1], fronting the
   *  street `e` out from the centreline. */
  const row = (s0: number, s1: number, side: 1 | -1, e: number, specs: Spec[]): void => {
    const total = specs.reduce((a, q) => a + q.w, 0);
    const scale = (s1 - s0) / total;
    let s = s0;
    for (const spec of specs) {
      const w = spec.w * scale;
      // The right side's lots run with the course, the left's against it (the building always
      // stands to the lot's right).
      const pa = along(c, wrapS(c, side > 0 ? s : s + w), side * e);
      const pb = along(c, wrapS(c, side > 0 ? s + w : s), side * e);
      const len = Math.hypot(pb.x - pa.x, pb.z - pa.z);
      const lot: Lot = { ox: pa.x, oz: pa.z, ux: (pb.x - pa.x) / len, uz: (pb.z - pa.z) / len, W: len };
      const fronts = side > 0 ? spec.fronts : [...spec.fronts].reverse();
      const end = spec.corner === undefined ? null : (spec.corner === 'start') === side > 0 ? 0 : 1;
      const b = building(k, lot, { ...spec, fronts, depth: spec.depth ?? 14 }, yAt(s + w / 2) + KERB, end);
      built[spec.name] = b;
      const poly = rectPoly(lot.ox, lot.oz, Math.atan2(lot.uz, lot.ux), 0, len, 0, b.D) as XZ[];
      ctx.occ.claim(poly);
      mine.push(poly);
      // A rainbow flag out over the sidewalk from most of them.
      if (!spec.name.startsWith('-') && rng() < 0.85 && b.spec.floors > 1) {
        const a = b.W * (0.78 + rng() * 0.1);
        const p = b.front.p(a, b.shopTop + 0.9, 0);
        bracketFlag(S, p[0], p[1], p[2], b.front.out[0], b.front.out[2], 1.7, 1.35, 0.9);
      }
      s += w;
    }
  };

  // ==============================================================================================
  // The corner of Market & Castro: Harvey Milk Plaza and its flag, Twin Peaks Tavern
  // ==============================================================================================
  const t = turnOf(c, cornerC);
  const u1: XZ = [Math.cos(t.hOut), Math.sin(t.hOut)];
  const n1: XZ = [-u1[1], u1[0]];
  const u2: XZ = [Math.cos(t.hIn), Math.sin(t.hIn)];
  const n2: XZ = [-u2[1], u2[0]];
  // The plaza's apex: where the back of Castro St's west sidewalk meets the back of the sidewalk
  // along Market's straight-on arm (its left, the plaza's side).
  const P = pointAt(c, cornerC.s1 + 2);
  const cE = cornerC.hw + WALK;
  const ax = P.x + n1[0] * edge;
  const az = P.z + n1[1] * edge;
  const bx = t.x - n2[0] * cE;
  const bz = t.z - n2[1] * cE;
  // ax + λ u1 = bx + μ u2.
  const det = u1[0] * -u2[1] - u1[1] * -u2[0];
  const lam = ((bx - ax) * -u2[1] - (bz - az) * -u2[0]) / det;
  const A: XZ = [ax + u1[0] * lam, az + u1[1] * lam];
  const PL = 15;
  const B: XZ = [A[0] + u1[0] * PL, A[1] + u1[1] * PL];
  const Cc: XZ = [A[0] + u2[0] * PL, A[1] + u2[1] * PL];
  const D: XZ = [B[0] + u2[0] * PL * 0.8, B[1] + u2[1] * PL * 0.8];
  const plaza: XZ[] = [A, B, D, Cc];
  const yPl = pointAt(c, cornerC.s1).y + KERB + 0.012;
  ctx.occ.claim(plaza);
  mine.push(plaza);
  const sPlazaEnd = cornerC.s1 + 2 + lam + PL + 0.4;
  harveyMilkPlaza();

  // ==============================================================================================
  // Castro St, the 400 block: east (left) Twin Peaks Tavern to Dog Eared Books, the theatre at the
  // start line; west (right) from the plaza, Marcello's and QBar to Walgreens on 18th
  // ==============================================================================================
  const s400b = x18.s0 - WALK;
  const s500a = x18.s1 + WALK;
  const s500b = x19.s0 - WALK;
  const sL0 = firstClear(cornerC.s0 + 1, cornerC.s1 + 20, -1, edge, 14);
  const TW = 14;
  const sTh0 = c.startS - TW / 2;
  const sTh1 = c.startS + TW / 2;
  const pastel = ['#f2dfe6', '#e6ecf2', '#f3e8cf', '#e3efe0', '#efe3f2', '#f6eadb', '#dfe9f1', '#f4e1d2'];
  const P0 = (): string => pastel[Math.floor(rng() * pastel.length)];
  row(sL0, sTh0, -1, edge, [
    {
      name: 'twinPeaks', w: 8, floors: 2, body: '#ece4cf', trim: '#1f3d2f', accent: '#1f3d2f', bays: 0, top: 'cornice', corner: 'start', shopH: 4.4,
      fronts: [{ w: 1, paint: '#1f3d2f', trim: '#2a4a3a', sign: 'twinPeaks', fascia: 1.1 }],
      sideFront: { w: 1, paint: '#1f3d2f', trim: '#2a4a3a', sign: 'twinPeaks', fascia: 1.1, door: 'r' },
    },
    { name: 'hotCookie', w: 4.6, floors: 3, body: '#f6d6e4', trim: '#fbf6e8', accent: '#d6337a', fronts: [{ w: 1, paint: '#f2b6cf', sign: 'hotCookie', awning: '#d6337a' }] },
    { name: 'smokeHouse', w: 4.2, floors: 3, body: P0(), trim: '#fbf6e8', fronts: [{ w: 1, paint: '#1d1b1a', sign: 'smokeHouse' }] },
    { name: 'castroCoffee', w: 5.2, floors: 3, body: '#e9d8b4', trim: '#fbf6e8', accent: '#3a2216', fronts: [{ w: 1, paint: '#3a2216', sign: 'castroCoffee', awning: '#6b3a22' }] },
  ]);
  // The Castro Theatre at the start line.
  {
    const pa = along(c, sTh1, -edge);
    const pb = along(c, sTh0, -edge);
    const len = Math.hypot(pb.x - pa.x, pb.z - pa.z);
    const lot: Lot = { ox: pa.x, oz: pa.z, ux: (pb.x - pa.x) / len, uz: (pb.z - pa.z) / len, W: len };
    const th = castroTheatre(k, lot, yAt(c.startS) + KERB);
    const poly = rectPoly(lot.ox, lot.oz, Math.atan2(lot.uz, lot.ux), 0, len, 0, th.D) as XZ[];
    ctx.occ.claim(poly);
    mine.push(poly);
    // Flags flying either side of its crest.
    const f = new Frame(lot.ox, lot.oz, lot.ux, lot.uz);
    for (const a of [1.2, len - 1.2]) {
      const p0 = f.p(a, yAt(c.startS) + KERB + 12.6, 0.4);
      cyl(S.metal, p0, [p0[0], p0[1] + 4.2, p0[2]], 0.04, 0.05, 6, '#d8d8d8');
      bannerFlag(p0[0], p0[1] + 4.1, p0[2], f.ux, f.uz, 1.8, 1.2);
    }
  }
  row(sTh1, s400b, -1, edge, [
    { name: 'nails', w: 4.4, floors: 3, body: '#fbe3ef', trim: '#ffffff', accent: '#d6337a', fronts: [{ w: 1, paint: '#f7c4dc', sign: 'nails' }] },
    { name: 'cliffs', w: 9, floors: 2, body: '#f1e3b0', trim: '#1b3f8f', accent: '#1b3f8f', top: 'parapet', bays: 0, fronts: [{ w: 1, paint: '#f3c12b', sign: 'cliffs', fascia: 1.15 }, { w: 1, paint: '#1b3f8f', trim: '#f3c12b' }] },
    { name: 'dogEared', w: 7, floors: 3, body: '#d9e4ec', trim: '#fbfbf7', accent: '#2a4a6a', corner: 'end', cornerKind: 'round', fronts: [{ w: 1, paint: '#2a4a6a', sign: 'rainbowCorner' }] },
  ]);
  const sR0 = Math.max(sPlazaEnd, firstClear(cornerC.s0 + 1, cornerC.s1 + 30, 1, edge, 14));
  row(sR0, s400b, 1, edge, [
    { name: 'marcellos', w: 6, floors: 3, body: P0(), trim: '#fbf6e8', fronts: [{ w: 1, paint: '#1f6b3a', sign: 'marcellos' }] },
    { name: 'proud', w: 5, floors: 3, body: '#f3e8cf', trim: '#fbf6e8', accent: '#750787', fronts: [{ w: 1, paint: '#5b2a8c', sign: 'rainbowCorner' }] },
    { name: 'qbar', w: 6, floors: 3, body: '#2a1a2e', trim: '#ff4fb4', accent: '#ff4fb4', fronts: [{ w: 1, paint: '#16081a', trim: '#ff4fb4', sign: 'qbar' }] },
    { name: 'walgreens', w: 11, floors: 2, body: '#e9e6df', trim: '#ffffff', top: 'parapet', bays: 0, corner: 'end', fronts: [{ w: 1, paint: '#f4f1ea', sign: 'walgreens' }, { w: 1, paint: '#e31837', trim: '#ffffff' }] },
  ]);

  // ==============================================================================================
  // The 500 block: east Rainbow Gifts, the Sausage Factory, Welcome Castro, Castro Camera and Harvey
  // Milk's mural, Spike's on 19th; west Harvey's, Castro Tarts, the Castro Fountain, Kiehl's
  // ==============================================================================================
  row(s500a, s500b, -1, edge, [
    { name: 'rainbowGifts', w: 6, floors: 3, body: '#fbfbf7', trim: '#5b2a8c', accent: '#ff8c00', corner: 'start', fronts: [{ w: 1, paint: '#ffffff', trim: '#5b2a8c', sign: 'rainbowGifts' }] },
    { name: 'welcome', w: 5, floors: 3, body: P0(), trim: '#fbf6e8', fronts: [{ w: 1, paint: '#750787', sign: 'welcome' }] },
    {
      name: 'castroCamera', w: 8, floors: 3, body: '#efe6d2', trim: '#fbf6e8', accent: '#5b2a8c', bays: 0,
      fronts: [{ w: 1, paint: '#f4efe2', trim: '#1b1b1f', sign: 'castroCamera' }],
      extra: (b) => {
        // The mural over the shop, across the flats' front.
        b.front.box(S.paint, 0.3, b.W - 0.3, b.shopTop + 0.15, b.top - 0.6, -0.1, 0.02, '#f2cfa0');
        b.front.sign(atlas, signs, 'milkMural', 0.4, b.W - 0.4, b.shopTop + 0.25, b.top - 0.7, -0.12);
      },
    },
    { name: 'spikes', w: 6, floors: 3, body: '#e3efe0', trim: '#fbf6e8', accent: '#3a6a3a', corner: 'end', cornerKind: 'cut', fronts: [{ w: 1, paint: '#3a2216', sign: 'castroCoffee' }] },
  ]);
  row(s500a, s500b, 1, edge, [
    { name: 'harveys', w: 8, floors: 3, body: '#3a3f4a', trim: '#e9c46a', accent: '#e9c46a', corner: 'start', cornerKind: 'turret', fronts: [{ w: 1, paint: '#101318', trim: '#e9c46a', sign: 'harveys' }] },
    { name: 'tarts', w: 5, floors: 3, body: '#f6d6c8', trim: '#fbf6e8', accent: '#7a2a3a', fronts: [{ w: 1, paint: '#f6d6c8', sign: 'tarts', awning: '#7a2a3a' }] },
    { name: 'fountain', w: 6, floors: 3, body: P0(), trim: '#fbf6e8', fronts: [{ w: 1, paint: '#e9f3f7', trim: '#2f6f8f', sign: 'fountain' }] },
    { name: 'kiehls', w: 6, floors: 3, body: '#2b2b2f', trim: '#e9e4d8', accent: '#e9e4d8', corner: 'end', fronts: [{ w: 1, paint: '#1b1b1f', sign: 'kiehls' }] },
  ]);

  // ==============================================================================================
  // Round the corner on 18th: Moby Dick (east, its south side), Toad Hall and Badlands (west)
  // ==============================================================================================
  armBar(x18, -1, 1, { name: 'mobyDick', w: 9, floors: 2, body: '#cfe0ec', trim: '#0f2f4f', accent: '#0f2f4f', fronts: [{ w: 1, paint: '#0f2f4f', sign: 'mobyDick' }] });
  armBar(x18, 1, 1, { name: 'toadHall', w: 9, floors: 2, body: '#e3efd2', trim: '#1f4a2a', accent: '#1f4a2a', fronts: [{ w: 1, paint: '#1f4a2a', sign: 'toadHall' }] });
  armBar(x18, 1, -1, { name: 'badlands', w: 9, floors: 2, body: '#2a1f1f', trim: '#ff3b2f', accent: '#ff3b2f', top: 'parapet', fronts: [{ w: 1, paint: '#120d0d', sign: 'badlands' }] });

  // ==============================================================================================
  // The crossings at 18th and 19th: rainbow crosswalks; disco balls over 18th
  // ==============================================================================================
  for (const x of [x18, x19]) rainbowCrosswalks(x);
  {
    const mid = x18.s0 + 6;
    const y = yAt(mid);
    const cornerPt = (s: number, d: number, h: number): V3 => {
      const p = along(c, s, d);
      return [p.x, y + h, p.z];
    };
    // Two wires across the intersection from corner to corner, the balls hung along them.
    const a1 = cornerPt(s400b + 0.6, -edge, 8.6);
    const b1 = cornerPt(s500a - 0.6, edge, 8.6);
    const a2 = cornerPt(s400b + 0.6, edge, 8.6);
    const b2 = cornerPt(s500a - 0.6, -edge, 8.6);
    for (const [a, b] of [
      [a1, b1],
      [a2, b2],
    ]) cyl(S.metal, a, b, 0.015, 0.015, 3, WIRE);
    const balls: V3[] = [];
    for (const f of [0.3, 0.5, 0.7]) {
      for (const [a, b] of [
        [a1, b1],
        [a2, b2],
      ]) {
        if (f === 0.5 && a === a2) continue;
        const p: V3 = [a[0] + (b[0] - a[0]) * f, a[1] - 0.6, a[2] + (b[2] - a[2]) * f];
        cyl(S.metal, [p[0], a[1] - 0.02, p[2]], [p[0], p[1] + 0.5, p[2]], 0.01, 0.01, 3, WIRE);
        balls.push(p);
      }
    }
    discoBalls(ctx, balls, 0.5);
  }

  // ==============================================================================================
  // Race day over Castro St: bunting, balloon arches (the 500 block; Castro Hill), Honor Walk plaques
  // ==============================================================================================
  for (const s of [sL0 + 6, c.startS - 9, c.startS + 13, c.startS + 22, s400b - 3, s500a + 5, s500a + 11, s500b - 4]) {
    if (Math.abs(s - c.startS) < 6) continue;
    const a = along(c, s, -edge);
    const b = along(c, s, edge);
    bunting(S, [a.x, a.y + 6.8, a.z], [b.x, b.y + 6.8, b.z], 0.55);
  }
  arch((s500a + s500b) / 2 + 2, null);
  arch(ctx.mark('castro', '22nd') - 20, 'castroHill');
  // The plaques set in the sidewalks, both sides of both blocks.
  for (const [s0, s1] of [
    [sL0 + 2, s400b - 1],
    [s500a + 1, s500b - 1],
  ]) {
    for (let s = s0; s < s1; s += 6.5) {
      if (Math.abs(s - c.startS) < 1.6) continue;
      for (const side of [-1, 1]) plaque(along(c, s, side * (hw + 2.4)), side);
    }
  }

  // ==============================================================================================
  // Rainbow flags on every lamp post along Castro St and Market St (where streets.ts puts them)
  // ==============================================================================================
  const sCastroEnd = ch.s1;
  for (let j = 0; j < c.sections.length; j++) {
    const sec = c.sections[j];
    const inCastro = sec.s0 >= ch.s0 - 0.5 && sec.s1 <= sCastroEnd + 0.5;
    const inMarket = sec.s0 >= mk.s0 - 0.5 && sec.s1 <= mk.s1 + 0.5;
    if ((!inCastro && !inMarket) || !STREET_KINDS.has(sec.kind) || sec.s1 - sec.s0 < 14) continue;
    let kk = 0;
    for (let s = sec.s0 + 6; s < sec.s1 - 4; s += 26) {
      const side = kk++ % 2 ? 1 : -1;
      const p = along(c, s, side * (sec.hw + POLE_SET));
      // Out from the pole, away from the road, at the height of the shops' flags.
      bracketFlag(S, p.x, p.y + KERB + 4.6, p.z, -p.tz * side, p.tx * side, 1.5, 1.2, 0.8);
    }
  }

  // ==============================================================================================
  // The 24's trolley wires up Castro St from 18th to 24th (poles clear of the lamps)
  // ==============================================================================================
  {
    const lamps: number[] = [];
    for (const sec of c.sections) {
      if (sec.s0 < s500a - 2 || sec.s1 > sCastroEnd + 1 || !STREET_KINDS.has(sec.kind) || sec.s1 - sec.s0 < 14) continue;
      for (let s = sec.s0 + 6; s < sec.s1 - 4; s += 26) lamps.push(s);
    }
    const crossings = c.sections.filter((q) => q.kind === CROSSING && q.s0 > s500a && q.s1 < sCastroEnd);
    const wireEnd = sCastroEnd - 6;
    const score = (p: number): number => (crossings.some((q) => p > q.s0 - 4 && p < q.s1 + 4) ? 0 : Math.min(...lamps.map((l) => Math.abs(p - l))));
    let start = s500a;
    let best = -1;
    for (let s0 = s500a; s0 < s500a + 30; s0 += 0.5) {
      let sc = Infinity;
      for (let p = s0 + 4; p < wireEnd; p += 30) sc = Math.min(sc, score(p));
      if (sc > best + 0.25) {
        best = sc;
        start = s0;
      }
    }
    trolleyWires(ctx, start, wireEnd, hw + POLE_SET - 0.5);
    for (let p = start + 4; p < wireEnd; p += 30) for (const side of [1, -1] as const) {
      const q = along(c, p, side * (hw + POLE_SET));
      things.push({ x: q.x, z: q.z, r: 0.3 });
      // Up the hill the flags fly from the wire poles too, out over the sidewalk.
      bracketFlag(S, q.x, q.y + KERB + 4.0, q.z, -q.tz * side, q.tx * side, 1.4, 1.1, 0.75);
    }
  }

  // ==============================================================================================
  // Market St, from Church back to Castro
  // ==============================================================================================
  const sM0L = firstClear(mk.s0, mk.s0 + 40, -1, mEdge, 14);
  const sM1L = lastClear(mk.s1 - 50, mk.s1 + 14, -1, mEdge, 14);
  const sM0R = firstClear(mk.s0, mk.s0 + 40, 1, mEdge, 14);
  const sM1R = lastClear(mk.s1 - 50, mk.s1 + 14, 1, mEdge, 14);
  if (sM1L - sM0L > 20) {
    row(sM0L, sM1L, -1, mEdge, [
      { name: 'walgreensM', w: 12, floors: 2, body: '#e9e6df', trim: '#ffffff', top: 'parapet', bays: 0, fronts: [{ w: 1, paint: '#e31837', sign: 'walgreensRed' }] },
      { name: 'mkt1', w: 8, floors: 4, body: '#d9cdb8', trim: '#fbf6e8', fronts: [{ w: 1, paint: '#3a4a5a', awning: '#2f6f8f' }, { w: 1, paint: '#5a3a2a' }] },
      { name: 'hiTops', w: 7, floors: 3, body: '#2b2b2f', trim: '#ffffff', accent: '#ff4fb4', fronts: [{ w: 1, paint: '#1b1b1f', sign: 'hiTops' }] },
      { name: 'peets', w: 7, floors: 3, body: '#e9dcc8', trim: '#fbf6e8', accent: '#2b1a12', fronts: [{ w: 1, paint: '#2b1a12', sign: 'peets', awning: '#2b1a12' }] },
      { name: 'mkt2', w: 9, floors: 4, body: '#c9d6de', trim: '#fbfbf7', top: 'parapet', fronts: [{ w: 1, paint: '#2a3a4a' }, { w: 1, paint: '#4a2a3a', awning: '#750787' }] },
      { name: 'mkt3', w: 8, floors: 3, body: P0(), trim: '#fbf6e8', fronts: [{ w: 1, paint: '#5b2a8c', sign: 'theCastro' }] },
    ]);
  }
  if (sM1R - sM0R > 20) {
    row(sM0R, sM1R, 1, mEdge, [
      { name: 'twinPeaksHotel', w: 10, floors: 4, body: '#e6d2b8', trim: '#fbf6e8', accent: '#5a3a2a', bays: 2, fronts: [{ w: 1, paint: '#5a3a2a', sign: 'twinPeaksHotel' }] },
      { name: 'swedishHall', w: 11, floors: 3, body: '#d8c39a', trim: '#2a4a7a', accent: '#2a4a7a', top: 'gable', bays: 1, fronts: [{ w: 1, paint: '#2a4a7a', sign: 'swedishHall', fascia: 1.1 }] },
      { name: 'mkt4', w: 8, floors: 3, body: P0(), trim: '#fbf6e8', fronts: [{ w: 1, paint: '#2f4f3f', awning: '#ff8c00' }] },
      {
        name: 'cafeFlore', w: 9, floors: 1, shopH: 4.6, top: 'parapet', body: '#e9e2cf', trim: '#2f6b4f', fronts: [{ w: 1, paint: '#f6f1e2', trim: '#2f6b4f', sign: 'cafeFlore', awning: '#2f6b4f' }],
        extra: (b) => {
          // Its garden: tubs of plants along the front.
          for (let a = 0.8; a < b.W - 0.6; a += 1.6) {
            const p = b.front.p(a, b.y0, -0.6);
            cyl(S.paint, [p[0], b.y0, p[2]], [p[0], b.y0 + 0.5, p[2]], 0.32, 0.26, 8, '#8a5a34');
            const g = new THREE.IcosahedronGeometry(0.45, 0);
            g.translate(p[0], b.y0 + 0.85, p[2]);
            S.foliage.add(g, '#4f8f42');
            things.push({ x: p[0], z: p[2], r: 0.45 });
          }
        },
      },
      {
        name: 'lookout', w: 8, floors: 3, body: '#2a3a4a', trim: '#3fd2ff', accent: '#3fd2ff', bays: 0, fronts: [{ w: 1, paint: '#151a24', sign: 'lookout' }],
        extra: (b) => {
          // The balcony over Market, and the flags along it.
          b.front.box(S.metal, 0.3, b.W - 0.3, b.shopTop + 0.1, b.shopTop + 0.22, -1.4, 0, '#2a2c30');
          for (let a = 0.4; a < b.W - 0.3; a += 0.25) b.front.box(S.metal, a - 0.02, a + 0.02, b.shopTop + 0.22, b.shopTop + 1.25, -1.38, -1.34, '#2a2c30');
          b.front.box(S.metal, 0.3, b.W - 0.3, b.shopTop + 1.2, b.shopTop + 1.28, -1.42, -1.3, '#2a2c30');
          for (const a of [1.2, b.W - 1.2]) {
            const p = b.front.p(a, b.shopTop + 1.3, -1.36);
            bracketFlag(S, p[0], p[1], p[2], b.front.out[0], b.front.out[2], 1.4, 1.1, 0.75);
          }
        },
      },
      { name: 'superDuper', w: 7, floors: 2, body: '#f4f1ea', trim: '#e8322a', top: 'parapet', bays: 0, fronts: [{ w: 1, paint: '#e8322a', sign: 'superDuper' }] },
    ]);
  }
  marketTracks();
  pinkTrianglePark();

  // --- Kerbside: the crowd and the barriers keep clear of doors and what stands on the sidewalk -------
  for (const d of k.doors) markDoor(ctx, d.x, d.z);
  for (const q of things) markThing(ctx, q.x, q.z, q.r);
  ctx.group.add(meshOf(signs, mat, 'castroSigns', false, true));

  // No generic houses along the 400 and 500 blocks or Market St (it's all shops); the hill's are
  // the Victorians.
  return {
    noHouses: (s) => (s >= ch.s0 - 0.5 && s <= x19.s0 + 0.5) || (s >= mk.s0 - 0.5 && s <= mk.s1 + 0.5) || s >= L - 0.5,
  };

  // ==============================================================================================
  // Pieces
  // ==============================================================================================

  /** A rainbow flag flying from (x, y, z) along (ux, uz): its two faces, its stripes. */
  function bannerFlag(x: number, y: number, z: number, ux: number, uz: number, w: number, h: number): void {
    const nx = -uz;
    const nz = ux;
    PRIDE.forEach((col, i) => {
      const t0 = y - (h * i) / PRIDE.length;
      const t1 = y - (h * (i + 1)) / PRIDE.length;
      const q = (a: number, yy: number): V3 => [x + ux * a, yy - a * 0.06, z + uz * a];
      for (const f of [1, -1]) S.paint.quad(q(0, t0), q(w, t0), q(w, t1), q(0, t1), col, [nx * f, 0, nz * f]);
    });
  }

  /** Harvey Milk Plaza: paved, its flagpole near the corner flying the giant flag, the Castro
   *  station's stair behind it, planters, seat walls, its sign. */
  function harveyMilkPlaza(): void {
    // The paving, level with the sidewalks, skirted down at its back.
    const at = (p: XZ, y = yPl): V3 => [p[0], y, p[1]];
    paveQuad(S.sidewalk, at(A), at(B), at(D), at(Cc));
    for (const [p, q] of [
      [B, D],
      [D, Cc],
    ] as const) {
      const out: V3 = [(p[0] + q[0]) / 2 - (A[0] + D[0]) / 2, 0, (p[1] + q[1]) / 2 - (A[1] + D[1]) / 2];
      S.sidewalk.quad(at(p), at(q), [q[0], yPl - 0.8, q[1]], [p[0], yPl - 0.8, p[1]], '#c9c2b2', out);
    }
    const bis: XZ = [u1[0] + u2[0], u1[1] + u2[1]];
    const bl = Math.hypot(bis[0], bis[1]);
    bis[0] /= bl;
    bis[1] /= bl;
    const inPlaza = (d: number, side = 0): XZ => [A[0] + bis[0] * d + -bis[1] * side, A[1] + bis[1] * d + bis[0] * side];
    // The flagpole and its flag (downwind, over the plaza's back).
    const fp = inPlaza(4.2);
    const top = yPl + 21;
    box(S.stone, fp[0] - 0.8, fp[0] + 0.8, yPl - 0.2, yPl + 0.55, fp[1] - 0.8, fp[1] + 0.8, '#8b8a86');
    cyl(S.metal, [fp[0], yPl + 0.55, fp[1]], [fp[0], top, fp[1]], 0.12, 0.22, 10, '#e4e6ea');
    {
      const g = new THREE.SphereGeometry(0.28, 10, 8);
      g.translate(fp[0], top + 0.25, fp[1]);
      S.gloss.add(g, '#e0b23a');
    }
    giantFlag(ctx, fp[0] + bis[0] * 0.25, top - 0.4, fp[1] + bis[1] * 0.25, bis[0], bis[1], 7.2, 4.6);
    things.push({ x: fp[0], z: fp[1], r: 1.0 });
    // The stair down to Castro station: a parapet round a dark well, its last treads, the Muni sign.
    {
      const sc = inPlaza(10.5);
      const h = Math.atan2(u1[1], u1[0]);
      const m = new THREE.Matrix4().makeRotationY(-h).setPosition(sc[0], yPl, sc[1]);
      box(S.paint, -3.4, 3.4, 0.0, 0.02, -1.7, 1.7, '#1a1b1e', m);
      for (let i = 0; i < 6; i++) box(S.concrete, -3.3 + i * 0.5, -2.8 + i * 0.5, -0.3, 0.02 - i * 0.004, -1.6, 1.6, i % 2 ? '#cfc8b8' : '#c4bdad', m);
      for (const [x0, x1, z0, z1] of [
        [-3.6, 3.6, -1.95, -1.7],
        [-3.6, 3.6, 1.7, 1.95],
        [3.35, 3.6, -1.95, 1.95],
      ]) box(S.concrete, x0, x1, 0, 1.0, z0, z1, '#bdb6a6', m);
      for (const z of [-1.82, 1.82]) box(S.metal, -3.5, 3.5, 1.0, 1.06, z - 0.03, z + 0.03, '#5c6168', m);
      // The sign: a tall pylon by the stair, the worm and CASTRO on both faces.
      const sp = new THREE.Vector3(-3.9, 0, -1.9).applyMatrix4(m);
      box(S.paint, sp.x - 0.2, sp.x + 0.2, yPl, yPl + 3.6, sp.z - 0.2, sp.z + 0.2, '#e9e9e4');
      const f = new Frame(sp.x, sp.z, Math.cos(h + Math.PI / 2), Math.sin(h + Math.PI / 2));
      for (const s of [1, -1]) {
        const g = new Frame(sp.x, sp.z, f.ux * s, f.uz * s);
        g.sign(atlas, signs, 'muni', -0.5, 0.5, yPl + 2.6, yPl + 3.1, -0.21);
      }
      things.push({ x: sc[0], z: sc[1], r: 3.5 });
    }
    // The plaza's sign: a low granite block facing the corner.
    {
      const p = inPlaza(1.6, -2.4);
      const f = new Frame(p[0] + bis[1] * 1.3, p[1] - bis[0] * 1.3, -bis[1], bis[0]);
      f.box(S.stone, -0.1, 2.7, yPl, yPl + 0.95, 0, 0.5, '#7a7975');
      f.sign(atlas, signs, 'milkPlaza', 0.05, 2.55, yPl + 0.25, yPl + 0.78, -0.02);
    }
    // Planters with trees along the back, seat walls.
    for (const [d, sd] of [
      [13, 3.5],
      [12.5, -3.5],
      [16, 0],
    ] as [number, number][]) {
      const p = inPlaza(d, sd);
      if (!inPoly(plaza, p[0], p[1])) continue;
      box(S.stone, p[0] - 1, p[0] + 1, yPl, yPl + 0.5, p[1] - 1, p[1] + 1, '#a8a49a');
      tree(S.foliage, p[0], yPl + 0.45, p[1], 1.05 + rng() * 0.2, rng);
    }
    // Small rainbow flags on poles at its two street corners.
    for (const p of [B, Cc]) {
      const q: XZ = [p[0] + (A[0] - p[0]) * 0.12 + bis[0] * 0.5, p[1] + (A[1] - p[1]) * 0.12 + bis[1] * 0.5];
      cyl(S.metal, [q[0], yPl, q[1]], [q[0], yPl + 5, q[1]], 0.04, 0.05, 6, '#d8d8d8');
      bannerFlag(q[0], yPl + 4.9, q[1], bis[0], bis[1], 1.5, 1.0);
    }
  }

  /** A bar on a crossing's arm: on the course's `side` of it, on the arm's own side e (+1: its right,
   *  looking out along it), a building on the first lot from the corner. */
  function armBar(x: Section, side: 1 | -1, e: 1 | -1, spec: Spec): void {
    const mid = pointAt(c, x.s0 + 6);
    const ox = mid.x - mid.tz * side * x.hw;
    const oz = mid.z + mid.tx * side * x.hw;
    const h = mid.heading + (side * Math.PI) / 2;
    const ux = Math.cos(h);
    const uz = Math.sin(h);
    const v = 6 + WALK;
    const u0 = WALK + 1.2;
    const W = spec.w;
    const fx = ox + ux * u0 - uz * e * v;
    const fz = oz + uz * u0 + ux * e * v;
    const lot: Lot = e > 0 ? { ox: fx, oz: fz, ux, uz, W } : { ox: fx + ux * W, oz: fz + uz * W, ux: -ux, uz: -uz, W };
    const poly = rectPoly(lot.ox, lot.oz, Math.atan2(lot.uz, lot.ux), 0, W, 0, 12) as XZ[];
    if (!ctx.occ.free(poly)) return;
    const y0 = Math.max(ctx.ground(fx + ux * W * 0.5, fz + uz * W * 0.5), mid.y) + KERB;
    const b = building(k, lot, { ...spec, corner: undefined, depth: 12 }, y0, e > 0 ? 0 : 1);
    built[spec.name] = b;
    ctx.occ.claim(poly);
    mine.push(poly);
    const p = b.front.p(b.W * (e > 0 ? 0.8 : 0.2), b.shopTop + 0.9, 0);
    bracketFlag(S, p[0], p[1], p[2], b.front.out[0], b.front.out[2], 1.6, 1.3, 0.85);
  }

  /** Rainbow crosswalks at a crossing: across the course at both edges of it, and across each of its
   *  arms, six bands laid just over the white stripes. */
  function rainbowCrosswalks(x: Section): void {
    for (const sc of [x.s0 + 1.4, x.s1 - 1.4]) {
      for (let i = 0; i < PRIDE.length; i++) {
        const r = pts(c, sc - 1.2 + i * 0.4, sc - 1.2 + (i + 1) * 0.4, 0.2);
        strip(S.marks, r, -x.hw + 0.4, x.hw - 0.4, (j) => r[j].y + 0.06, PRIDE[i]);
      }
    }
    const mid = pointAt(c, x.s0 + 6);
    for (const side of [1, -1]) {
      const ox = mid.x - mid.tz * side * x.hw;
      const oz = mid.z + mid.tx * side * x.hw;
      const h = mid.heading + (side * Math.PI) / 2;
      for (let i = 0; i < PRIDE.length; i++) groundStrip(ctx, S.marks, ox, oz, h, 0.8 + i * 0.4, 0.8 + (i + 1) * 0.4, -5.6, 5.6, 0.12, -0.12, PRIDE[i]);
    }
  }

  /** A balloon arch over Castro St at s (its feet on the sidewalks), a sign hung from its top. */
  function arch(s: number, sign: string | null): void {
    const l = along(c, s, -(hw + 1.3));
    const r = along(c, s, hw + 1.3);
    const rise = 6.3;
    balloonArch(S, [l.x, l.y + KERB, l.z], [r.x, r.y + KERB, r.z], rise, rng);
    things.push({ x: l.x, z: l.z, r: 0.6 }, { x: r.x, z: r.z, r: 0.6 });
    if (!sign) return;
    // Hung under the top, both faces: the way up the hill, and back.
    const p = pointAt(c, s);
    const y = (l.y + r.y) / 2 + KERB + rise - 0.55;
    const w = 4.2;
    const hh = w / atlas.aspect(sign);
    for (const f of [1, -1]) {
      const g = new Frame(p.x + p.tx * 0.05 * f, p.z + p.tz * 0.05 * f, -p.tz * f, p.tx * f);
      g.sign(atlas, signs, sign, -w / 2, w / 2, y - hh, y, 0);
    }
    for (const d of [-w / 2 + 0.2, w / 2 - 0.2]) {
      const q = along(c, s, d);
      cyl(S.metal, [q.x, y - 0.02, q.z], [q.x, y + 0.5, q.z], 0.01, 0.01, 3, WIRE);
    }
  }

  /** A bronze plaque of the Rainbow Honor Walk, set in the sidewalk at p. */
  function plaque(p: { x: number; y: number; z: number; tx: number; tz: number }, side: number): void {
    const r = 0.3;
    const y = p.y + KERB + 0.006;
    const ux = p.tx * -side;
    const uz = p.tz * -side;
    const nx = -uz;
    const nz = ux;
    const q = (a: number, b: number): V3 => [p.x + ux * a + nx * b, y, p.z + uz * a + nz * b];
    atlas.quad(signs, 'honorPlaque', q(-r, -r), q(r, -r), q(r, r), q(-r, r), [0, 1, 0]);
  }

  /** The F-line down Market St's middle: its two tracks, the overhead wires on poles either side; and
   *  at the Castro terminus, round the corner up Castro St, a vintage PCC car waiting under its wire. */
  function marketTracks(): void {
    const s0 = mk.s0 + 4;
    const s1 = mk.s1 + 1;
    const r = pts(c, s0, s1, 1);
    for (const tc of [-F_TRACK, F_TRACK]) {
      strip(S.marks, r, tc - 1.0, tc + 1.0, (i) => r[i].y + 0.04, '#6c6962');
      for (const v of [tc - GAUGE / 2, tc + GAUGE / 2]) strip(S.paint, r, v - 0.045, v + 0.045, (i) => r[i].y + 0.065, STEEL, { sides: true, bottom: (i) => r[i].y + 0.01 });
    }
    // The wires: poles in pairs (clear of the lamps), span wires across, a contact wire over each track.
    const lamps: number[] = [];
    {
      const sec = c.sections[pointAt(c, (mk.s0 + mk.s1) / 2).sec];
      for (let s = sec.s0 + 6; s < sec.s1 - 4; s += 26) lamps.push(s);
    }
    const poles: CoursePoint[] = [];
    for (let s = s0 + 3; s < s1 - 3; s += 27) {
      let ps = s;
      for (const l of lamps) if (Math.abs(ps - l) < 2.5) ps = l + (ps < l ? -2.5 : 2.5);
      if (ps < s0 + 1 || ps > s1 - 1) continue;
      poles.push(pointAt(c, wrapS(c, ps)));
    }
    for (const p of poles) {
      const ends: V3[] = [];
      for (const side of [-1, 1]) {
        const d = side * (mHw + POLE_SET);
        const x = p.x - p.tz * d;
        const z = p.z + p.tx * d;
        cyl(S.metal, [x, p.y + KERB - 0.2, z], [x, p.y + SPAN_H + 0.9, z], 0.1, 0.15, 8, POLE);
        things.push({ x, z, r: 0.3 });
        ends.push([x, p.y + SPAN_H, z]);
      }
      cyl(S.metal, ends[0], ends[1], 0.015, 0.015, 3, WIRE);
    }
    for (const tc of [-F_TRACK, F_TRACK]) {
      for (let i = 0; i + 2 < r.length; i += 2) {
        const a = r[i];
        const b = r[i + 2];
        cyl(S.metal, [a.x - a.tz * tc, a.y + WIRE_H, a.z + a.tx * tc], [b.x - b.tz * tc, b.y + WIRE_H, b.z + b.tx * tc], 0.016, 0.016, 3, WIRE);
      }
    }
    // The terminus: up Castro St's arm north of Market (the corner's arm back the way the course
    // leaves), a track and its wire, the PCC car on it facing the corner.
    {
      const hb = t.hOut + Math.PI;
      const ux = Math.cos(hb);
      const uz = Math.sin(hb);
      const tv = -2.3;
      const at = (u: number, v = tv): { x: number; z: number; y: number } => {
        const x = t.x + ux * u - uz * v;
        const z = t.z + uz * u + ux * v;
        return { x, z, y: ctx.ground(x, z) + 0.09 };
      };
      const line: { x: number; z: number; tx: number; tz: number; y: number }[] = [];
      for (let u = corner.hw + 0.5; u <= 33; u += 1) {
        const q = at(u);
        line.push({ x: q.x, z: q.z, tx: ux, tz: uz, y: q.y });
      }
      for (const v of [-GAUGE / 2, GAUGE / 2]) strip(S.paint, line, v - 0.045, v + 0.045, (i) => line[i].y + 0.035, STEEL, { sides: true, bottom: (i) => line[i].y - 0.02 });
      for (let i = 0; i + 2 < line.length; i += 2) cyl(S.metal, [line[i].x, line[i].y + WIRE_H, line[i].z], [line[i + 2].x, line[i + 2].y + WIRE_H, line[i + 2].z], 0.016, 0.016, 3, WIRE);
      for (const u of [14, 30]) {
        const ends: V3[] = [];
        for (const side of [-1, 1]) {
          const q = at(u, side * (corner.hw + POLE_SET));
          cyl(S.metal, [q.x, q.y - 0.2, q.z], [q.x, q.y + SPAN_H + 0.9, q.z], 0.1, 0.15, 8, POLE);
          ends.push([q.x, q.y + SPAN_H, q.z]);
        }
        cyl(S.metal, ends[0], ends[1], 0.015, 0.015, 3, WIRE);
      }
      const q = at(22);
      pccCar(S, q.x, q.y + 0.04, q.z, hb + Math.PI, WIRE_H - 0.1);
    }
  }

  /** Pink Triangle Park, across the corner from Harvey Milk Plaza: a triangle of gravel between
   *  Market's arm on past Castro and Castro's on north, fifteen granite pylons topped with pink
   *  triangles, its sign, a couple of trees. */
  function pinkTrianglePark(): void {
    const h = t.hIn;
    const ux = Math.cos(h);
    const uz = Math.sin(h);
    const at = (u: number, v: number): XZ => [t.x + ux * u - uz * v, t.z + uz * u + ux * v];
    const v0 = corner.hw + WALK + 0.6;
    const poly: XZ[] = [at(13, v0), at(31, v0), at(15, v0 + 13)];
    const probe = poly.every(([x, z]) => !arms.some((r) => inPoly(r, x, z)) && !nearRoad(x, z, L - 40, L + 40)) && ctx.occ.free(poly);
    if (!probe) return;
    ctx.occ.claim(poly);
    mine.push(poly);
    const y = Math.max(ctx.ground(...at(18, v0 + 4)), t.y) + KERB;
    const tri = poly.map(([x, z]) => [x, y, z] as V3);
    S.concrete.tri(tri[0], tri[1], tri[2], '#c9bfae', [0, 1, 0]);
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      S.concrete.quad(tri[i], tri[j], [tri[j][0], y - 0.6, tri[j][2]], [tri[i][0], y - 0.6, tri[i][2]], '#b8ae9c');
    }
    // The pylons in rows, filling the triangle.
    let n = 0;
    for (let row = 0; row < 5 && n < 15; row++) {
      for (let col = 0; col <= 4 - row && n < 15; col++) {
        const u = 15 + col * 2.9 + row * 0.6;
        const v = v0 + 1.6 + row * 2.1;
        const [x, z] = at(u, v);
        if (!inPoly(poly, x, z)) continue;
        pylon(S, x, y, z, h + Math.PI / 2);
        n++;
      }
    }
    {
      const [x, z] = at(13.6, v0 + 0.5);
      const f = new Frame(x, z, ux, uz);
      f.box(S.stone, 0, 2.6, y, y + 0.8, 0, 0.4, '#5a5956');
      f.sign(atlas, signs, 'pinkTriangle', 0.1, 2.5, y + 0.22, y + 0.72, -0.02);
    }
    for (const [u, v] of [
      [26, v0 + 2.5],
      [17, v0 + 10],
    ]) {
      const [x, z] = at(u, v);
      tree(S.foliage, x, y, z, 0.9 + rng() * 0.2, rng);
    }
    obox(S.metal, [at(22, v0 - 0.2)[0], y + 0.5, at(22, v0 - 0.2)[1]], [18, 0.05, 0.05], [0, -h, 0], '#2a2c30');
  }
}

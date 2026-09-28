// The Upper Haight, where the race starts: Haight St west from Buena Vista Ave West past Masonic to
// the corner of Ashbury, its Victorian flats over shopfronts in the order they stand today
// (shops.json, from Street View 2025) with the Haight's wild paint, signs and murals; the
// Doolan-Larson building on the far corner with HAIGHT and ASHBURY on its frieze and the jeweller's
// clock stuck at 4:20, the white HAIGHT / ASHBURY blades on the near corner, Piedmont's fishnet legs
// kicking out of their window over the grid, and the Muni trolley wires overhead. Past Ashbury the
// 1500 block runs on (Aviator Nation, the Jimi Hendrix Red House, Gus's) to Golden Gate Park's
// trees at the end of the street. Up Ashbury, street trees; along Oak, the Panhandle
// (haight/panhandle.ts). The blocks are a third or so of their real length, so each keeps its
// order with fewer, narrower lots. Signs, murals and the like are one atlas and one material
// (haight/atlas.ts, haight/signs.ts); the buildings are haight/building.ts; the landmarks'
// extras haight/landmarks.ts.
import * as THREE from 'three';
import { pointAt, type Section } from '../../track';
import { GeoBuilder, cyl, meshOf, type V3 } from '../geo';
import { cypressTree, pineTree, tree } from '../props';
import { rowBlocks, type Lot } from '../victorian';
import { along, rectPoly, type Ctx, type Hood } from './context';
import { Atlas } from './haight/atlas';
import { building, type Built, type Sinks, type Spec } from './haight/building';
import { cafeTables, clock, crates, fireEscape, hangings, hipRoof, ivy, paintedPillars, piedmontLegs, pots, streetBlades, stringLights, umbrella, wallBench } from './haight/landmarks';
import { buildPanhandle, eucalyptus } from './haight/panhandle';
import { haightCells } from './haight/signs';
import { markDoor, markThing } from './kerbside';
import { KERB, POLE_SET, WALK, sideStreet, trolleyWires, turnOf } from './streets';

/** How far the 1500 block's street runs on past Ashbury's arm before Golden Gate Park (m). */
const ON_PAST = 40;
const WIRE_H = 5.8;
/** Where the wire poles stand out from the corridor's edge (m): behind race day's barriers. */
const POLE = POLE_SET;

/**
 * The Upper Haight, the 1500 block past Ashbury, Ashbury's street trees and the Panhandle: builds
 * them into the shared sinks (the signs into their own mesh, Piedmont's legs into theirs), claims
 * their ground, and hands back where the generic houses mustn't go.
 */
export function buildHaight(ctx: Ctx): Hood {
  const c = ctx.course;
  const S = ctx.sinks;
  const rng = ctx.rng;
  const atlas = new Atlas(haightCells());
  const signs = new GeoBuilder();
  const k: Sinks = { ctx, atlas, signs, doors: [] };
  const mat = new THREE.MeshStandardMaterial({ map: atlas.texture, vertexColors: true, roughness: 0.55 });

  const hc = ctx.chunk('haight');
  const ac = ctx.chunk('ashbury');
  const cornerAt = (s: number): Section | undefined => c.sections.find((q) => q.kind === 'corner' && Math.abs(q.s0 - s) < 1.5);
  const central = cornerAt(hc.s0);
  const ashbury = cornerAt(ac.s0);
  if (!central || !ashbury) return {};
  const hw = ashbury.hw;
  const edge = hw + WALK;
  const tC = turnOf(c, central);
  const tA = turnOf(c, ashbury);
  const dist = (t: { x: number; z: number }, s: number): number => {
    const p = pointAt(c, s);
    return Math.hypot(p.x - t.x, p.z - t.z);
  };
  // Where each block's buildings start and end along the course: the backs of the cross streets'
  // sidewalks.
  const s1300a = central.s1 - (dist(tC, central.s1) - edge);
  const s1300b = ctx.mark('haight', 'masonic') - WALK;
  const s1400a = ctx.mark('haight', 'upper') + WALK;
  const s1400b = ashbury.s0 + dist(tA, ashbury.s0) - edge;

  // Race day: the crowd's thickest this far either side of the start line (no street trees there);
  // the sidewalk's bits and pieces it stands clear of (furniture.ts puts it out).
  const raceFrom = c.startS - 35;
  const raceTo = c.startS + 35;
  const clutter: { x: number; z: number; r: number }[] = [];

  // --- Buildings along the course -------------------------------------------------------------
  const built: Record<string, Built> = {};
  /** A side of a block, the buildings given in course order and fitted to [s0, s1]. */
  const row = (s0: number, s1: number, side: 1 | -1, specs: Spec[]): void => {
    const total = specs.reduce((a, q) => a + q.w, 0);
    const scale = (s1 - s0) / total;
    let s = s0;
    for (const spec of specs) {
      const w = spec.w * scale;
      const d = side * edge;
      // The right side's lots run with the course, the left's against it (the building always
      // stands to the lot's right).
      const pa = along(c, side > 0 ? s : s + w, d);
      const pb = along(c, side > 0 ? s + w : s, d);
      const len = Math.hypot(pb.x - pa.x, pb.z - pa.z);
      const lot: Lot = { ox: pa.x, oz: pa.z, ux: (pb.x - pa.x) / len, uz: (pb.z - pa.z) / len, W: len };
      const fronts = side > 0 ? spec.fronts : [...spec.fronts].reverse();
      const end = spec.corner === undefined ? null : (spec.corner === 'start') === side > 0 ? 0 : 1;
      const b = building(k, lot, { ...spec, fronts }, pointAt(c, s + w / 2).y + KERB, end);
      built[spec.name] = b;
      ctx.occ.claim(rectPoly(lot.ox, lot.oz, Math.atan2(lot.uz, lot.ux), 0, len, 0, b.D));
      s += w;
    }
  };

  // The 1300 block, Central to Masonic. North: the Coffee Lama on the corner of Central, Braindrops,
  // Sunshine Coast, Pipe Dreams, and Magnolia on the corner of Masonic (its black awning, the blade
  // at the corner, red chairs out front).
  row(s1300a, s1300b, 1, [
    { name: 'coffeeLama', w: 6, floors: 3, body: '#d9d4c7', trim: '#fbfbf7', accent: '#8a2432', corner: 'start', fronts: [{ w: 1, paint: '#8a2432', sign: 'coffeeLama' }] },
    { name: 'braindrops', w: 5.6, floors: 3, body: '#b9c4a0', trim: '#f4f1e6', accent: '#6b7a55', top: 'gable', fronts: [{ w: 1, paint: '#2a1d17', sign: 'braindrops' }] },
    { name: 'sunshine', w: 6, floors: 3, body: '#d8d0c0', trim: '#fbfbf7', fronts: [{ w: 1, paint: '#4a2a7a', sign: 'sunshine' }] },
    { name: 'pipeDreams', w: 6, floors: 3, body: '#e6d6b0', trim: '#fbfbf7', accent: '#b5462c', fronts: [{ w: 1, paint: '#7a1f1f', sign: 'pipeDreams', awning: '#b5462c' }] },
    {
      name: 'magnolia', w: 12, floors: 3, body: '#d9c49a', trim: '#f6efdc', accent: '#8a6a3a', bays: 2, corner: 'end',
      fronts: [{ w: 1, paint: '#1c1c1c', trim: '#2a2a2a', awning: '#1c1c1c', blade: 'magnolia', bladeH: 3.2 }],
      sideFront: { w: 1, paint: '#1c1c1c', trim: '#2a2a2a', door: 'l' },
      extra: (b) => clutter.push(...cafeTables(S, b.front, 0.5, b.W - 1.5, b.y0, 2.2, '#c62828', rng)),
    },
  ]);
  // South: Central Haight Market on the corner, the school, Bound Together, and Psychedelic SF on
  // the corner of Masonic, its turret over murals all round.
  row(s1300a, s1300b, -1, [
    { name: 'centralMarket', w: 7, floors: 3, body: '#8fa39a', trim: '#f2efe6', accent: '#5f7a70', bays: 1, corner: 'start', fronts: [{ w: 1, paint: '#ff7a1a', sign: 'centralMarket', fascia: 1.15 }] },
    { name: 'school', w: 11, floors: 2, body: '#e8a49a', trim: '#f6efe2', accent: '#c7786a', top: 'parapet', bays: 0, fronts: [{ w: 1, paint: '#e8a49a', trim: '#f6efe2', sign: 'school', plain: true, fascia: 0.6 }] },
    { name: 'bound', w: 5.6, floors: 2, body: '#5a4a3c', trim: '#e9dcc0', accent: '#3a2e24', top: 'gable', fronts: [{ w: 1, paint: '#121214', sign: 'bound' }] },
    {
      name: 'psychSF', w: 12, floors: 3, body: '#f2c94c', trim: '#2f4fb0', accent: '#2f4fb0', bays: 1, corner: 'end', cornerKind: 'turret',
      fronts: [{ w: 1, paint: '#3b2a8a', trim: '#7b3fc4', mural: 'psychMural', muralSub: [0, 0, 0.62, 1], sign: 'psychSF', fascia: 1.1 }],
      sideFront: { w: 1, paint: '#3b2a8a', trim: '#7b3fc4', mural: 'psychMural', muralSub: [0.38, 0, 1, 1] },
    },
  ]);

  // The 1400 block, Masonic to Ashbury: the start. North: Love on Haight on the corner of Masonic,
  // Mom's Body Shop (World Famous), Amal's Deli and Hippie Thai, the 1428 café, the Blue Front,
  // GoodFellas, Head Rush and Piedmont Boutique (the legs), Toxic Thrillz, Derby, and Wake Cup and
  // Ben & Jerry's on the corner of Ashbury.
  row(s1400a, s1400b, 1, [
    {
      name: 'love', w: 6.5, floors: 3, body: '#f3eee4', trim: '#fbfbf7', accent: '#d7cfbf', bays: 1, corner: 'start',
      fronts: [{ w: 1, paint: '#7b3fc4', trim: '#ff5fb8', mural: 'loveMural', muralSub: [0, 0, 0.58, 1], blade: 'loveSign', bladeH: 0.8 }],
      sideFront: { w: 1, paint: '#7b3fc4', trim: '#ff5fb8', mural: 'loveMural', muralSub: [0.3, 0, 1, 1] },
      extra: (b) => {
        paintedPillars(S, b.front, [0.15, b.W - 0.15], b.y0, b.shopTop - b.y0 - 0.2);
        hangings(k, b.front, [b.W * 0.2, b.W * 0.82], b.shopTop + 1.6);
        if (b.side) hangings(k, b.side, [b.D * 0.35, b.D * 0.7], b.shopTop + 1.6);
      },
    },
    { name: 'moms', w: 4.2, floors: 3, body: '#f2efe8', trim: '#fbfbf7', fronts: [{ w: 1, paint: '#18171a', trim: '#c9a54a', sign: 'worldFamous', fascia: 1.15, arched: true }] },
    {
      name: 'amals', w: 8.5, floors: 1, shopH: 4.6, top: 'parapet', body: '#2f7fd0', trim: '#f4f1e6',
      fronts: [
        { w: 1, paint: '#2f7fd0', sign: 'amals', fascia: 1.15, arched: true },
        { w: 1, paint: '#1e5fb8', sign: 'hippieThai', fascia: 1.15, arched: true, blade: 'tukTuk', bladeH: 0.85 },
      ],
    },
    { name: 'cafe1428', w: 5.4, floors: 2, body: '#f7c843', trim: '#ff8f1f', accent: '#ff8f1f', bays: 1, fronts: [{ w: 1, paint: '#f7a51c', trim: '#fbfbf7', sign: 'cafe1428' }] },
    { name: 'blueFront', w: 5.6, floors: 1, shopH: 4.4, top: 'parapet', body: '#1f47b8', trim: '#fbfbf7', fronts: [{ w: 1, paint: '#1f47b8', sign: 'blueFront', fascia: 1.2, arched: true, gate: true }] },
    { name: 'goodfellas', w: 7.2, floors: 3, body: '#f4f1ea', trim: '#fbfbf7', accent: '#1b1b1f', fronts: [{ w: 1, paint: '#15141a', trim: '#2a2a2e', sign: 'goodfellas', fascia: 1.3 }] },
    {
      name: 'piedmont', w: 9, floors: 3, body: '#f8f8f5', trim: '#ffffff', accent: '#c9a54a', bays: 2,
      fronts: [
        { w: 1, paint: '#141416', sign: 'headRush' },
        { w: 1, paint: '#f8f8f5', trim: '#c62828', sign: 'piedmont', fascia: 1.25 },
      ],
      extra: (b) => piedmontLegs(k, b, 1, mat),
    },
    { name: 'toxic', w: 6, floors: 3, body: '#c9ced3', trim: '#fbfbf7', fronts: [{ w: 1, paint: '#1b1b1f', awning: '#f4f4ee', awningSign: 'toxic' }] },
    { name: 'derby', w: 5.8, floors: 3, body: '#efe6cf', trim: '#fffaf0', fronts: [{ w: 1, paint: '#6b1f2a', trim: '#2e6b45', sign: 'derby' }] },
    {
      name: 'benJerry', w: 11, floors: 3, body: '#f3e3b0', trim: '#fffaf0', accent: '#e0cf98', bays: 1, corner: 'end', cornerKind: 'round',
      fronts: [
        { w: 1, paint: '#efe6d2', sign: 'wakeCup' },
        { w: 1.3, paint: '#a9d8f2', trim: '#ffffff', sign: 'benJerry', fascia: 1.1 },
      ],
      sideFront: { w: 1, paint: '#a9d8f2', trim: '#ffffff', sign: 'benJerry', fascia: 1.1, door: 'l' },
      extra: (b) => {
        const wake = b.W / 2.3;
        wallBench(S, b.front, wake + 0.6, wake + 2.6, b.y0);
        const bench = b.front.p(wake + 1.6, b.y0, -0.3);
        clutter.push({ x: bench[0], z: bench[2], r: 1.2 });
        for (const a of [wake * 0.3, wake * 0.75]) {
          const p = b.front.p(a, b.y0, -2.1);
          umbrella(S, p[0], b.y0, p[2], '#ff9ec4', '#fbfbf7');
          clutter.push({ x: p[0], z: p[2], r: 1.25 });
        }
      },
    },
  ]);
  // South: The Mellow on the corner of Masonic, Flippin' Burger, Cookies and the colour-block
  // shutter, a dark Victorian, the Pork Store Cafe, Bizza with Pure Land and World Famous Glass,
  // Relic Vintage, and the Counterculture Museum on the corner of Ashbury.
  row(s1400a, s1400b, -1, [
    {
      name: 'mellow', w: 9, floors: 1, shopH: 4.8, top: 'parapet', body: '#1d2a5c', trim: '#fbfbf7', corner: 'start', fronts: [{ w: 1, paint: '#1d2a5c', sign: 'mellow', fascia: 1.0 }],
      extra: (b) => clutter.push(...pots(S, b.front, 0.6, b.W - 1.8, b.y0, rng)),
    },
    // (Its sidewalk tables are cleared for race day.)
    { name: 'flippin', w: 7, floors: 1, shopH: 4.6, top: 'parapet', body: '#c62828', trim: '#1b1b1f', fronts: [{ w: 1, paint: '#c62828', sign: 'flippin' }] },
    {
      name: 'cookies', w: 8, floors: 3, body: '#a8543a', trim: '#e9dcc0', accent: '#6b2f22', bays: 1,
      fronts: [
        { w: 1.2, paint: '#101218', sign: 'cookies' },
        { w: 1, paint: '#3a3a3a', mural: 'mosaic' },
      ],
    },
    {
      name: 'teal', w: 7, floors: 3, body: '#2f5a5a', trim: '#f4f1e8', accent: '#1f3a3a', bays: 1,
      fronts: [
        { w: 1, paint: '#3a1f2a', gate: true },
        { w: 1, paint: '#1f2a3a' },
      ],
      extra: (b) => hangings(k, b.front, [b.W * 0.3, b.W * 0.7], b.y0 + 2.2),
    },
    {
      name: 'porkStore', w: 6.5, floors: 3, body: '#f2b8a8', trim: '#fbf6e8', accent: '#c77a6a', fronts: [{ w: 1, paint: '#20234a', sign: 'porkStore', fascia: 1.15 }],
      extra: (b) => fireEscape(S, b.front, 0.4, 2.4, b.shopTop + 0.05, 2, b.fh),
    },
    {
      name: 'bizza', w: 9, floors: 1, shopH: 4.6, top: 'parapet', body: '#e9e2d0', trim: '#fbfbf7',
      fronts: [
        { w: 1, paint: '#141416', sign: 'bizza' },
        { w: 1, paint: '#f2ead7', sign: 'pureLand' },
        { w: 1, paint: '#5b2a8c', sign: 'wfGlass' },
      ],
    },
    { name: 'relic', w: 6, floors: 3, body: '#f0c9cf', trim: '#fbf6e8', accent: '#c77a8a', fronts: [{ w: 1, paint: '#3a2a2a', awning: '#c62828', awningSign: 'relic' }] },
    { name: 'counterculture', w: 11, floors: 3, body: '#a9bf9a', trim: '#2a4a4a', accent: '#2a4a4a', bays: 2, corner: 'end', cornerKind: 'cut', fronts: [{ w: 1, paint: '#1b1b1f', trim: '#f2e7c8', sign: 'counterculture' }] },
  ]);

  // Murals on the side walls standing clear of a one-storey neighbour: they face the grid.
  const sideMural = (name: string, end: 0 | 1, cell: string, over: string): void => {
    const b = built[name];
    const n = built[over];
    if (!b || !n || n.top > b.top - 2.5) return;
    b.front.side(end, b.W, b.D).sign(atlas, signs, cell, 0.8, b.D - 0.8, n.top + 0.35, b.top - 0.6, -0.05);
  };
  sideMural('goodfellas', 0, 'summerMural', 'blueFront');
  sideMural('cafe1428', 0, 'mosaic', 'amals');
  sideMural('cookies', 1, 'psychMural', 'flippin');
  sideMural('relic', 1, 'cosmicMural', 'bizza');

  // --- Past Ashbury: the 1500 block, on to the park --------------------------------------------
  const hx = Math.cos(tA.hIn);
  const hz = Math.sin(tA.hIn);
  // (Right of Haight heading west: north.)
  const rx = -hz;
  const rz = hx;
  /** A lot on the 1500 block from u0 to u1 metres past the corner's centre: north side (+1) or south. */
  const lot1500 = (u0: number, u1: number, side: 1 | -1): { lot: Lot; y0: number } => {
    const ua = side > 0 ? u0 : u1;
    const ox = tA.x + hx * ua + rx * side * edge;
    const oz = tA.z + hz * ua + rz * side * edge;
    const W = u1 - u0;
    const lot: Lot = { ox, oz, ux: hx * side, uz: hz * side, W };
    const mx = tA.x + hx * ((u0 + u1) / 2) + rx * side * (edge - 1.5);
    const mz = tA.z + hz * ((u0 + u1) / 2) + rz * side * (edge - 1.5);
    return { lot, y0: Math.max(ctx.ground(mx, mz), tA.y - 0.05) + KERB };
  };
  /** A side of the 1500 block from the corner out, the first on the corner; returns where it ends. */
  const street1500 = (specs: Spec[], side: 1 | -1): number => {
    let u = edge;
    specs.forEach((spec, i) => {
      const { lot, y0 } = lot1500(u, u + spec.w, side);
      // North lots run away from the corner (the corner at a = 0), south lots towards it (a = W).
      const end = i === 0 ? (side > 0 ? 0 : 1) : null;
      const b = building(k, lot, spec, y0, end);
      built[spec.name] = b;
      ctx.occ.claim(rectPoly(lot.ox, lot.oz, Math.atan2(lot.uz, lot.ux), 0, lot.W, 0, b.D));
      u += spec.w;
    });
    return u;
  };
  const green = '#1f4a3a';
  const dlFront = { paint: green, trim: '#f4f1e8', bulk: '#1d3b30' };
  const endN = street1500(
    [
      {
        name: 'doolanLarson', w: 14, floors: 3, body: '#f4f1e8', trim: '#faf8f2', accent: '#e4dfd2', bays: 0, depth: 13,
        fronts: [
          { w: 1.2, ...dlFront, blade: 'welcome', bladeH: 1.1, bladeNear: true },
          { w: 1, ...dlFront, sign: 'jewelry' },
          { w: 1, ...dlFront, sign: 'gallery1506' },
          { w: 0.8, ...dlFront },
        ],
        sideFront: { w: 1, ...dlFront, door: 'r' },
        extra: (b) => doolanLarson(b),
      },
      { name: 'wootBear', w: 4.5, floors: 1, shopH: 4.4, top: 'parapet', body: '#f4f1e8', trim: '#f4f1e8', fronts: [{ w: 1, paint: '#fbfbf7', trim: '#ece6da', sign: 'wootBear' }] },
      { name: 'redHouse', w: 6.5, floors: 3, body: '#b3243a', trim: '#fbf6e8', accent: '#7a1624', bays: 1, fronts: [{ w: 1, paint: '#d31f2f', sign: 'redHouse', fascia: 1.15 }] },
      {
        name: 'gus', w: 11, floors: 2, top: 'parapet', body: '#1f7a3a', trim: '#d8c79a', accent: '#155a2a', bays: 0,
        fronts: [
          { w: 1, paint: '#1f7a3a', awning: '#1f7a3a', awningSign: 'gusAwning' },
          { w: 1, paint: '#1f7a3a', awning: '#1f7a3a', awningSign: 'gusAwning' },
        ],
        extra: (b) => {
          // The painted farm-scene sign standing up over the middle of the front.
          const am = b.W / 2;
          b.front.box(S.paint, am - 2.4, am + 2.4, b.top - 0.4, b.top + 1.9, -0.12, 0.1, '#1f7a3a');
          b.front.sign(atlas, signs, 'gus', am - 2.3, am + 2.3, b.top - 0.35, b.top + 1.85, -0.14);
          crates(S, b.front, 0.4, b.W - 0.4, b.y0, rng);
        },
      },
    ],
    1,
  );
  const endS = street1500(
    [
      {
        name: 'aviator', w: 10, floors: 3, body: '#6f6f9a', trim: '#f4f1e8', accent: '#4a4a72', bays: 2,
        fronts: [{ w: 1, paint: '#1f3fbf', sign: 'aviator', fascia: 1.2 }],
        sideFront: { w: 1, paint: '#8d9096', trim: '#8d9096', door: 'r' },
        extra: (b) => {
          // The skeletal creature painted down the side wall on Ashbury.
          if (b.side) b.side.sign(atlas, signs, 'skeleton', 1.2, b.D - 0.6, b.y0 + 0.2, b.y0 + 3.1, -0.1);
        },
      },
      { name: 'deluxe', w: 5.5, floors: 3, body: '#3a3a44', trim: '#e9e4d8', fronts: [{ w: 1, paint: '#101014', sign: 'deluxe' }] },
      { name: 'hsVintage', w: 5.5, floors: 3, body: '#e6d9c2', trim: '#fbfbf7', top: 'gable', fronts: [{ w: 1, paint: '#121214', sign: 'hsVintage' }] },
    ],
    -1,
  );
  // Haight runs on past the arm to the park: plain blocks beyond the shops, Golden Gate Park's trees
  // across the end of the street.
  {
    const u0 = 34;
    const u1 = 34 + ON_PAST;
    const a = { x: tA.x + hx * u0, z: tA.z + hz * u0 };
    const b = { x: tA.x + hx * u1, z: tA.z + hz * u1 };
    sideStreet(ctx, a.x, a.z, b.x, b.z, hw, { houses: [false, false] });
    for (const side of [1, -1] as const) {
      const from = side > 0 ? endN : endS;
      if (u1 - from < 6) continue;
      const { lot } = lot1500(from, u1, side);
      rowBlocks(S.facades, S.walls, { ox: lot.ox, oz: lot.oz, ux: lot.ux, uz: lot.uz, len: lot.W }, 12, rng, ctx.site, [8, 13]);
      ctx.occ.claim(rectPoly(lot.ox, lot.oz, Math.atan2(lot.uz, lot.ux), 0, lot.W, 0, 12));
    }
    // The park: a wood across the end of the street (and its ground kept clear of the city beyond).
    const park = rectPoly(tA.x + hx * (u1 + 2), tA.z + hz * (u1 + 2), tA.hIn, 0, 44, -34, 34);
    for (let u = u1 + 4; u < u1 + 26; u += 7) {
      for (let v = -20; v <= 20; v += 8) {
        const uu = u + (rng() - 0.5) * 5;
        const vv = v + (rng() - 0.5) * 5;
        if (Math.abs(vv) > 12 && rng() < 0.4) continue;
        const x = tA.x + hx * uu + rx * vv;
        const z = tA.z + hz * uu + rz * vv;
        if (!ctx.occ.free([
          [x - 1.5, z - 1.5],
          [x + 1.5, z - 1.5],
          [x + 1.5, z + 1.5],
          [x - 1.5, z + 1.5],
        ])) continue;
        const gy = ctx.ground(x, z);
        const r = rng();
        if (r < 0.4) eucalyptus(S.foliage, x, gy, z, 1 + rng() * 0.3, rng);
        else if (r < 0.75) cypressTree(S.foliage, x, gy, z, 1.4 + rng() * 0.4, Math.PI * (0.9 + rng() * 0.3), rng);
        else pineTree(S.foliage, x, gy, z, 1.5 + rng() * 0.3, rng);
      }
    }
    ctx.occ.claim(park);
  }

  /** The Doolan-Larson building's own things: the lettering, the ivy, the lights, the roof, the
   *  clock on its corner. */
  function doolanLarson(b: Built): void {
    const f = b.front;
    const asp = atlas.aspect('friezeHaight');
    f.sign(atlas, signs, 'friezeHaight', 0.5, 0.5 + 0.62 * asp, b.shopTop + 0.14, b.shopTop + 0.76, -0.03);
    if (b.side) {
      const a1 = b.D - 0.5;
      const aspA = atlas.aspect('friezeAshbury');
      b.side.sign(atlas, signs, 'friezeAshbury', a1 - 0.62 * aspA, a1, b.shopTop + 0.14, b.shopTop + 0.76, -0.03);
      ivy(S, b.side, 0.2, b.D, b.shopTop - 0.05, rng);
      stringLights(S, b.side, 0.3, b.D - 0.3, b.shopTop + 0.95);
    }
    ivy(S, f, 0, b.W, b.shopTop - 0.05, rng);
    stringLights(S, f, 0.3, b.W - 0.3, b.shopTop + 0.95);
    hipRoof(S, f, b.W, b.D, b.top + 0.05, 3.4, '#6b7078', '#f4f1e8');
    // The clock, out from the corner on its bracket, a face to the east (the grid) and the west.
    const corner = f.p(0, 0, 0);
    const out = f.out;
    const dx = out[0] - f.ux;
    const dz = out[2] - f.uz;
    const l = Math.hypot(dx, dz);
    clock(k, corner[0], b.shopTop + 1.35, corner[2], [dx / l, dz / l], Math.atan2(-hz, -hx));
    // Half-barrels of flowers by the door.
    for (const a of [1.2, b.W * 0.55]) {
      const p = f.p(a, b.y0, -0.7);
      cyl(S.paint, [p[0], b.y0, p[2]], [p[0], b.y0 + 0.55, p[2]], 0.36, 0.3, 10, '#8a5a34');
      const g = new THREE.IcosahedronGeometry(0.42, 0);
      g.translate(p[0], b.y0 + 0.75, p[2]);
      S.foliage.add(g, '#4f8f42');
    }
    crates(S, f, 0.3, 2.4, b.y0, rng);
  }

  // --- The corner of Haight & Ashbury: the blades on their pole, on the near corner -------------
  // (Where it stands goes back as our own sign, so the streets' standard green pole stays away.)
  const ownSigns: [number, number][] = [];
  {
    // The corner's arc: its centre is the inside of the turn; the pole stands on the kerb there.
    const p1 = pointAt(c, ashbury.s0 + 2);
    const p2 = pointAt(c, (ashbury.s0 + ashbury.s1) / 2);
    const p3 = pointAt(c, ashbury.s1 - 3);
    const cc = circumcentre(p1, p2, p3);
    const tx = tA.x - cc.x;
    const tz = tA.z - cc.z;
    const tl = Math.hypot(tx, tz);
    const px = cc.x + (tx / tl) * 1.6;
    const pz = cc.z + (tz / tl) * 1.6;
    // (The island follows the ground.)
    streetBlades(k, px, ctx.ground(px, pz) + KERB, pz, tA.hIn, tA.hOut, Math.atan2(-hz, -hx));
    ownSigns.push([px, pz]);
  }

  // --- Trolley wires down Haight, and on across Ashbury to the end of the street ----------------
  // streets.ts's down the course (its poles every 30 m from 4 m in: started where they stand clear of
  // the street lamps, Masonic and the gantry); ours on from either end, straight.
  const lamps: number[] = [];
  for (const sec of c.sections) {
    if (sec.kind !== 'haight' || sec.s1 - sec.s0 < 14) continue;
    for (let s = sec.s0 + 6; s < sec.s1 - 4; s += 26) lamps.push(s);
  }
  const clearance = (p: number): number => {
    if (p > ctx.mark('haight', 'masonic') - 1.5 && p < ctx.mark('haight', 'upper') + 1.5) return 0;
    return Math.min(Math.abs(p - c.startS) - 1, ...lamps.map((l) => Math.abs(p - l)));
  };
  const wireEnd = ashbury.s0 - 2;
  let wireStart = s1300a + 1;
  {
    let best = -1;
    for (let s0 = s1300a + 1; s0 < s1300a + 31; s0 += 0.5) {
      let score = Infinity;
      for (let p = s0 + 4; p < wireEnd; p += 30) score = Math.min(score, clearance(p));
      if (score > best + 0.5) {
        best = score;
        wireStart = s0;
      }
    }
  }
  // (Its poles stand hw + 0.5 out from the half-width it's given: back behind race day's barriers.)
  trolleyWires(ctx, wireStart, wireEnd, hw + POLE - 0.5);
  const poles: number[] = [];
  for (let p = wireStart + 4; p < wireEnd; p += 30) {
    poles.push(p);
    for (const side of [1, -1]) {
      const q = along(c, p, side * (hw + POLE));
      markThing(ctx, q.x, q.z, 0.3);
    }
  }
  {
    const p = pointAt(c, wireEnd);
    /** Straight wires from (x0, z0) to (x1, z1) over the ground (y0 near the start), poles at `at`
     *  metres along. */
    const run = (x0: number, z0: number, y0: number, x1: number, z1: number, at: number[]): void => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ux = (x1 - x0) / len;
      const uz = (z1 - z0) / len;
      const nx = -uz;
      const nz = ux;
      const yAt = (u: number): number => (u < 12 ? y0 : Math.max(y0 - 0.4, ctx.ground(x0 + ux * u, z0 + uz * u)));
      for (const d of [-2.4, -1.8, 1.8, 2.4]) {
        let prev: V3 | null = null;
        for (let u = 0; u <= len + 0.01; u += 4) {
          const q: V3 = [x0 + ux * u + nx * d, yAt(u) + WIRE_H, z0 + uz * u + nz * d];
          if (prev) cyl(S.metal, prev, q, 0.018, 0.018, 3, '#2a2c30');
          prev = q;
        }
      }
      for (const u of at) {
        const y = yAt(u);
        const ends: V3[] = [];
        for (const sd of [-1, 1]) {
          const x = x0 + ux * u + nx * sd * (hw + POLE);
          const z = z0 + uz * u + nz * sd * (hw + POLE);
          cyl(S.metal, [x, y, z], [x, y + WIRE_H + 1.2, z], 0.1, 0.13, 8, '#5c6168');
          markThing(ctx, x, z, 0.3);
          ends.push([x, y + WIRE_H + 0.9, z]);
        }
        cyl(S.metal, ends[0], ends[1], 0.02, 0.02, 3, '#2a2c30');
      }
    };
    // West, from where the course turns off across the intersection and down the 1500 block.
    const w1 = { x: tA.x + hx * (34 + ON_PAST), z: tA.z + hz * (34 + ON_PAST) };
    const lenW = Math.hypot(w1.x - p.x, w1.z - p.z);
    run(p.x, p.z, p.y, w1.x, w1.z, [lenW * 0.38, lenW * 0.78]);
    // East, from where streets.ts's wires start, back over Central and on along the park: a pole in
    // the stretch before theirs where it's clearest, another past Central.
    const q = pointAt(c, wireStart);
    const e1 = { x: tC.x - Math.cos(tC.hOut) * 34, z: tC.z - Math.sin(tC.hOut) * 34 };
    const lenE = Math.hypot(e1.x - q.x, e1.z - q.z);
    const gap = wireStart - s1300a;
    const east = [lenE - 12];
    if (gap > 14) {
      let bu = 8;
      for (let u = 8; u < gap - 6; u += 0.5) if (clearance(wireStart - u) > clearance(wireStart - bu)) bu = u;
      east.push(bu);
      poles.push(wireStart - bu);
    }
    run(q.x, q.z, q.y, e1.x, e1.z, east);
  }

  // --- Street trees ----------------------------------------------------------------------------
  // On Haight, between the shops, clear of the lamps, the wire poles, the gantry, the blades and
  // Piedmont's legs; bigger ones on Magnolia's corner.
  {
    // (Nor round the grid, where the chase cameras wait for the start.)
    const avoid: [number, number][] = [
      [ctx.mark('haight', 'masonic') - 3, ctx.mark('haight', 'upper') + 3],
      [raceFrom - 2, raceTo + 2],
    ];
    for (const p of poles) avoid.push([p - 2.2, p + 2.2]);
    const pied = built.piedmont;
    const spots: [number, 1 | -1][] = [];
    for (const side of [1, -1] as const) {
      for (let s = s1300a + 7 + (side > 0 ? 5 : 0); s < s1400b - 4; s += 13 + rng() * 4) spots.push([s, side]);
    }
    for (const [s, side] of spots) {
      if (avoid.some(([a, b]) => s > a && s < b)) continue;
      // The lamps (every 26 m from each section's start, alternating sides, the left first).
      const sec = c.sections[pointAt(c, s).sec];
      if (sec.kind !== 'haight') continue;
      const lampK = Math.round((s - sec.s0 - 6) / 26);
      const lampS = sec.s0 + 6 + lampK * 26;
      if (Math.abs(s - lampS) < 2.5 && (lampK % 2 ? 1 : -1) === side) continue;
      if (side > 0 && pied) {
        const p0 = pied.front.p(0, 0, 0);
        const p1 = pied.front.p(pied.W, 0, 0);
        const q = along(c, s, edge);
        if ((q.x - p0[0]) * (q.x - p1[0]) + (q.z - p0[2]) * (q.z - p1[2]) < 4) continue;
      }
      // (Set back so the crowns stay off the road, and behind race day's barriers.)
      const q = along(c, s, side * (hw + 1.2));
      tree(S.foliage, q.x, q.y + KERB, q.z, 0.85 + rng() * 0.2, rng);
      clutter.push({ x: q.x, z: q.z, r: 0.5 });
    }
    const mag = built.magnolia;
    if (mag) {
      for (const a of [mag.W - 1.4, mag.W - 6.5]) {
        const p = mag.front.p(a, 0, -(WALK - 1.6));
        tree(S.foliage, p[0], mag.y0, p[2], 1.6, rng);
        clutter.push({ x: p[0], z: p[2], r: 0.6 });
      }
    }
    // (Ashbury's street trees are streets.ts's, as on any plain street.)
  }

  // --- Race day: the barriers and the crowd are furniture.ts's; what the crowd keeps clear of --------
  for (const d of k.doors) markDoor(ctx, d.x, d.z);
  for (const t of clutter) markThing(ctx, t.x, t.z, t.r);

  // --- The Panhandle ---------------------------------------------------------------------------
  const pan = buildPanhandle(ctx);

  ctx.group.add(meshOf(signs, mat, 'haightSigns', false, true));

  // No generic houses on either side of Haight (it's all built), nor where the corner buildings
  // run up Ashbury, nor along the Panhandle; and the corner's street-name sign is ours.
  const bj = built.benJerry;
  const dl = built.doolanLarson;
  const upAshbury = (b: Built | undefined): number => (b ? ashbury.s1 + edge + b.D - dist(tA, ashbury.s1) + 0.5 : ashbury.s1);
  const bjEnd = upAshbury(bj);
  const dlEnd = upAshbury(dl);
  return {
    noHouses: (s, side) => {
      if (s >= hc.s0 && s <= ashbury.s0 + 1) return true;
      if (s >= ashbury.s1 - 1 && s <= (side > 0 ? bjEnd : dlEnd)) return true;
      return pan.noHouses(s, side);
    },
    ownSigns,
  };
}

/** The centre of the circle through three points (x, z). */
function circumcentre(a: { x: number; z: number }, b: { x: number; z: number }, c: { x: number; z: number }): { x: number; z: number } {
  const d = 2 * (a.x * (b.z - c.z) + b.x * (c.z - a.z) + c.x * (a.z - b.z));
  const a2 = a.x * a.x + a.z * a.z;
  const b2 = b.x * b.x + b.z * b.z;
  const c2 = c.x * c.x + c.z * c.z;
  return { x: (a2 * (b.z - c.z) + b2 * (c.z - a.z) + c2 * (a.z - b.z)) / d, z: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d };
}

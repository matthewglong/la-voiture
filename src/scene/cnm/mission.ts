// The Mission: 24th St from Dolores down past Guerrero and Valencia to Mission St, Mission St from
// 24th to 18th, and 18th St from Mission to Dolores. Flats over shopfronts painted the Mission's
// colours (osg/haight/building.ts builds them), the shops in Spanish, papel picado strung across the
// street, murals on the walls and the shutters, Mexican flags out on their brackets. At 24th &
// Mission the BART plazas with their palms and stairs going down, El Farolito just up Mission, Calle
// 24's welcome sign and La Victoria down the street east, La Taqueria and the Mission Cultural
// Center down Mission south; the New Mission's tall sign and the Alamo Drafthouse's marquee, a party
// shop with its piñatas, a lowrider shop, Taqueria Cancún; the 14-Mission's trolley wires. Along
// 18th, the Women's Building in its MaestraPeace mural, Tartine on the corner of Guerrero and Bi-Rite
// with their queues, Dandelion down Valencia, whose green bike lanes run off both ways. Landmarks
// stand where the survey has them (maps/data/cnmStreets.ts), at their share of their real block.
import * as THREE from 'three';
import { pointAt, type Section } from '../../track';
import { Crowd, type Spot } from '../crowd';
import { GeoBuilder, box, cyl, meshOf, type V3 } from '../geo';
import { along, rectPoly, type Ctx, type Hood } from '../osg/context';
import { Atlas } from '../osg/haight/atlas';
import { building, type Built, type Front, type Sinks, type Spec } from '../osg/haight/building';
import { markDoor, markThing } from '../osg/kerbside';
import { KERB, POLE_SET, WALK, groundStrip, turnOf, type Arm, type Turn } from '../osg/streets';
import { makeRng } from '../util';
import type { Lot } from '../victorian';
import { MX, missionCells, papelCanvas } from './mission/cells';
import { bartEntrance, bracketFlag, fruitStand, palm, papelString, paletaCart, plazaBench, starPinata, wires } from './mission/props';

/** The plazas on the outside corners of 24th & Mission (m, square, beyond the corner's sidewalk). */
const PLAZA = 12.3;
/** A building's depth back from its frontage (building.ts's default). */
const DEPTH = 13;
/** How high the papel picado hangs over the street (above the sidewalk at its ends), and over Mission
 *  St (higher, over the trolley wires). */
const PAPEL_Y = 6.3;
const PAPEL_Y_MISSION = 7.5;

/** The Mission's walls, stucco and paint. */
const BODIES = ['#f3c98b', '#f7a072', '#9ad1d4', '#f6d55c', '#ed6a5a', '#c5e99b', '#d4a5d6', '#fff4dc', '#e9b44c', '#84d2c5', '#f28482', '#b8e0d2', '#ffcf9f'];
/** The shopfronts' bolder paint. */
const PAINTS = [MX.red, MX.orange, MX.marigold, MX.green, MX.turquoise, MX.blue, MX.purple, MX.magenta, MX.chili, MX.jade, MX.cobalt];

export function buildMission(ctx: Ctx): Hood {
  const c = ctx.course;
  const S = ctx.sinks;
  const rng = makeRng(2424);
  const atlas = new Atlas(missionCells(), 2048, 2048);
  const signs = new GeoBuilder();
  const k: Sinks = { ctx, atlas, signs, doors: [] };
  const papel = new GeoBuilder();
  const clutter: { x: number; z: number; r: number }[] = [];
  const spots: Spot[] = [];
  const m = (chunk: string, name: string): number => ctx.mark(chunk, name);

  // --- The corners --------------------------------------------------------------------------------
  const cornerAt = (s: number): Section | undefined => c.sections.find((q) => q.kind === 'corner' && Math.abs(q.s0 - s) < 1.5);
  const mc = cornerAt(ctx.chunk('missionSt').s0);
  const ec = cornerAt(ctx.chunk('eighteenth').s0);
  const dc = cornerAt(ctx.chunk('dolores').s0);
  if (!mc || !ec || !dc) return {};
  const tM = turnOf(c, mc);
  const tE = turnOf(c, ec);
  const tD = turnOf(c, dc);
  const dist = (t: { x: number; z: number }, s: number): number => {
    const p = pointAt(c, s);
    return Math.hypot(p.x - t.x, p.z - t.z);
  };
  /** Where a row of buildings stops before a corner (the back of its sidewalk squares), and starts
   *  after one. */
  const before = (sec: Section, t: Turn): number => sec.s0 + (dist(t, sec.s0) - (sec.hw + WALK));
  const after = (sec: Section, t: Turn): number => sec.s1 - (dist(t, sec.s1) - (sec.hw + WALK));
  /** A point in a corner's frame (u along the way in, v to its right). */
  const inCorner = (t: Turn, u: number, v: number): { x: number; z: number } => ({
    x: t.x + u * Math.cos(t.hIn) - v * Math.sin(t.hIn),
    z: t.z + u * Math.sin(t.hIn) + v * Math.cos(t.hIn),
  });

  // --- Buildings along the course ------------------------------------------------------------------
  const built: Record<string, Built> = {};
  /** The stretches of each side we've built on (the generic houses keep off them). */
  const own: { s0: number; s1: number; side: 1 | -1 }[] = [];
  /** A side of a block, its buildings given in course order and fitted to [s0, s1]. */
  const row = (s0: number, s1: number, side: 1 | -1, specs: Spec[]): void => {
    if (s1 - s0 < 3) return;
    const total = specs.reduce((a, q) => a + q.w, 0);
    const scale = (s1 - s0) / total;
    let s = s0;
    for (const spec of specs) {
      const w = spec.w * scale;
      const mid = pointAt(c, s + w / 2);
      const d = side * (mid.hw + WALK);
      // The right side's lots run with the course, the left's against it (the building always
      // stands to the lot's right).
      const pa = along(c, side > 0 ? s : s + w, d);
      const pb = along(c, side > 0 ? s + w : s, d);
      const len = Math.hypot(pb.x - pa.x, pb.z - pa.z);
      const lot: Lot = { ox: pa.x, oz: pa.z, ux: (pb.x - pa.x) / len, uz: (pb.z - pa.z) / len, W: len };
      const poly = rectPoly(lot.ox, lot.oz, Math.atan2(lot.uz, lot.ux), 0.2, len - 0.2, 0.2, spec.depth ?? DEPTH);
      if (ctx.occ.free(poly)) {
        const fronts = side > 0 ? spec.fronts : [...spec.fronts].reverse();
        const end = spec.corner === undefined ? null : (spec.corner === 'start') === side > 0 ? 0 : 1;
        built[spec.name] = building(k, lot, { ...spec, fronts }, mid.y + KERB, end);
        ctx.occ.claim(rectPoly(lot.ox, lot.oz, Math.atan2(lot.uz, lot.ux), 0, len, 0, spec.depth ?? DEPTH));
        own.push({ s0: s, s1: s + w, side });
      }
      s += w;
    }
  };
  let pick = 0;
  /** A plain Mission building of flats over shops (its colours picked in turn). */
  const flats = (name: string, w: number, fronts: Front[], extra: Partial<Spec> = {}): Spec => {
    pick++;
    return { name, w, floors: 2 + (pick % 3 === 0 ? 1 : 0), body: BODIES[(pick * 5) % BODIES.length], top: pick % 2 ? 'parapet' : 'cornice', bays: pick % 4 === 0 ? 0 : 1, squareBays: pick % 3 === 1, fronts, ...extra };
  };
  /** A shopfront with its sign, paint picked in turn. */
  const shop = (sign: string, opts: Partial<Front> = {}): Front => ({ w: 1, paint: PAINTS[(pick * 3 + sign.length) % PAINTS.length], sign, ...opts });

  // 24th St, Guerrero to Valencia ('murals'): steep, so narrow lots (each sits at its own middle's
  // height). South side: the mercado on the corner of Guerrero, a lavandería, a mural wall, the café,
  // discos on Valencia. North: a panadería on the corner, the joyería, quinceañeras, the cell phone
  // shop, the carnicería on Valencia.
  const b24a = m('mission24', 'murals') + WALK;
  const b24b = m('mission24', 'valencia') - WALK;
  row(b24a, b24b, 1, [
    flats('mercado', 6.5, [shop('mercado', { paint: MX.lime, awning: MX.red })], { corner: 'start', extra: (b) => standAt(b, 2.4, 'fruit') }),
    flats('lavanderia', 5, [shop('lavanderia', { paint: MX.blue })]),
    flats('muralWall', 5.5, [{ w: 1, paint: MX.purple, mural: 'muralSun' }], { floors: 2, bays: 0 }),
    flats('cafe0', 5, [shop('cafe', { paint: MX.brown })]),
    flats('discos', 5.5, [shop('discos', { awning: MX.orange })], { corner: 'end' }),
  ]);
  row(b24a, b24b, -1, [
    flats('panaderia', 6, [shop('panaderia', { paint: MX.chili, awning: '#f4f1ea' })], { corner: 'start' }),
    flats('joyeria', 4.8, [shop('joyeria', { paint: MX.ink, gate: true })]),
    flats('quince', 5.5, [shop('quince', { paint: MX.pink, mural: 'quinceWindow', fascia: 0.8 })]),
    flats('celulares0', 4.8, [shop('celulares', { paint: MX.cobalt })]),
    flats('carniceria', 6, [shop('carniceria', { awning: '#f4f1ea', blade: 'bladeTaco' })], { corner: 'end' }),
  ]);

  // 24th St, Valencia to Mission ('calle'). South: Fiesta Piñatas on the corner of Valencia with its
  // piñatas out, the paletería with its carts; the BART plaza on the corner of Mission. North: El Gran
  // Taco on Valencia, envíos, the western wear shop, and the dulcería on the corner of Mission (the
  // inside of the turn).
  const bcA = m('mission24', 'calle') + WALK;
  const bcB = before(mc, tM);
  row(bcA, bcB - PLAZA, 1, [
    flats('pinatas', 8, [shop('pinatas', { paint: MX.turquoise, awning: MX.magenta, blade: 'bladePinata' })], { corner: 'start', floors: 2, extra: (b) => pinatasOut(b) }),
    flats('paleteria', 7, [shop('paleteria', { paint: MX.pink })], { floors: 2, extra: (b) => standAt(b, b.W * 0.5, 'paletas') }),
  ]);
  own.push({ s0: bcB - PLAZA, s1: bcB, side: 1 });
  row(bcA, bcB, -1, [
    flats('granTaco', 8, [shop('granTaco', { paint: MX.chili, awning: MX.yellow, blade: 'bladeTaco' })], { corner: 'start', extra: (b) => muralSide(b, 'muralCalavera') }),
    flats('envios', 5.5, [shop('envios', { paint: MX.green })], { floors: 3 }),
    flats('western', 7, [shop('western', { paint: MX.brown })], { extra: (b) => flagOn(b, b.W * 0.5) }),
    flats('dulceria', 8, [shop('dulceria', { paint: MX.magenta, awning: MX.yellow })], { corner: 'end', floors: 2, extra: (b) => muralSide(b, 'muralFlowers') }),
  ]);

  // Mission St, 24th to 23rd: the BART plaza on the corner, El Farolito, the celulares on 23rd (east).
  // West: from past the dulcería's side, the farmacia and the luchas shop.
  const B = [after(mc, tM), m('missionSt', '23rd') - WALK, m('missionSt', '23rd') + 12 + WALK, m('missionSt', '22nd') - WALK, m('missionSt', '22nd') + 12 + WALK, m('missionSt', '21st') - WALK, m('missionSt', '21st') + 12 + WALK, m('missionSt', '20th') - WALK, m('missionSt', '20th') + 12 + WALK, m('missionSt', '19th') - WALK, m('missionSt', '19th') + 12 + WALK, before(ec, tE)];
  own.push({ s0: B[0], s1: B[0] + PLAZA, side: 1 });
  row(B[0] + PLAZA, B[1], 1, [
    flats('farolito', 9, [{ w: 1, paint: MX.red, sign: 'farolito', fascia: 1.2, awning: MX.yellow, blade: 'bladeFarolito', bladeH: 1.0 }], { floors: 2, body: '#ffd23f', extra: (b) => flagOn(b, b.W * 0.25) }),
    flats('celulares', 5, [shop('celulares', { paint: '#0d47a1' })], { corner: 'end' }),
  ]);
  row(B[0] + DEPTH, B[1], -1, [
    flats('farmacia', 6, [shop('farmacia', { paint: '#f4f4f0', trim: MX.jade })]),
    flats('luchas', 7, [shop('musica', { paint: MX.purple, mural: 'luchas', fascia: 0.9 })], { corner: 'end', extra: (b) => muralSide(b, 'muralWoman') }),
  ]);

  // 23rd to 22nd. East: mariscos on 23rd, the zapatería, música on 22nd. West: the tortillería on
  // 23rd, a shuttered shop painted over, the ofrenda in the joyería's window.
  row(B[2], B[3], 1, [
    flats('mariscos', 7, [shop('mariscos', { paint: MX.turquoise, awning: MX.blue })], { corner: 'start' }),
    flats('zapateria', 5.5, [shop('zapateria', { paint: MX.brown })], { floors: 3 }),
    flats('musica', 7, [shop('musica', { paint: MX.purple, awning: MX.yellow })], { corner: 'end', extra: (b) => muralSide(b, 'muralQuetzal') }),
  ]);
  row(B[2], B[3], -1, [
    flats('tortilleria', 7, [shop('tortilleria', { paint: MX.marigold })], { corner: 'start', extra: (b) => muralSide(b, 'muralVirgen') }),
    flats('shutter1', 5, [{ w: 1, paint: MX.turquoise, mural: 'shutterA' }], { floors: 2 }),
    flats('ofrenda', 7, [shop('joyeria', { paint: '#2b0f3a', mural: 'ofrenda', fascia: 0.9 })], { corner: 'end' }),
  ]);

  // 22nd to 21st: the New Mission (west), its tall sign and the Drafthouse's marquee. East: the
  // llantera on 22nd, the lowrider shop, the café on 21st.
  row(B[4], B[5], -1, [
    flats('cafe', 5, [shop('cafe', { paint: MX.brown, awning: MX.marigold })], { corner: 'start' }),
    { name: 'newMission', w: 12, floors: 2, body: '#efe2c8', trim: '#fbf6e8', accent: MX.red, top: 'parapet', bays: 0, fronts: [{ w: 1, paint: MX.ink, trim: '#2a2a2e', fascia: 1.2 }], extra: (b) => newMission(b) },
    flats('celulares2', 5, [shop('celulares', { paint: MX.cobalt })], { corner: 'end' }),
  ]);
  row(B[4], B[5], 1, [
    flats('llantera', 7, [shop('llantera', { paint: MX.yellow, gate: true })], { corner: 'start', floors: 2 }),
    flats('lowrider', 7, [{ w: 1, paint: '#2a0845', sign: 'lowrider', mural: 'muralLowrider', fascia: 0.95 }], { floors: 2 }),
    flats('cafe2', 6, [shop('cafe', { paint: MX.chili })], { corner: 'end', extra: (b) => muralSide(b, 'muralSun') }),
  ]);

  // 21st to 20th. East: the panadería, quinceañeras, envíos. West: música, discos, the farmacia.
  row(B[6], B[7], 1, [
    flats('panaderia2', 6.5, [shop('panaderia', { paint: MX.pink, awning: '#ffffff' })], { corner: 'start' }),
    flats('quince2', 6, [shop('quince', { paint: '#fdf2f8', mural: 'quinceWindow', fascia: 0.8 })], { extra: (b) => flagOn(b, b.W * 0.5) }),
    flats('envios2', 6, [shop('envios', { paint: MX.green })], { corner: 'end' }),
  ]);
  row(B[6], B[7], -1, [
    flats('musica2', 6.5, [shop('musica', { paint: MX.purple })], { corner: 'start', extra: (b) => muralSide(b, 'muralFlowers') }),
    flats('discos2', 5.5, [shop('discos', { paint: MX.orange, awning: MX.ink })]),
    flats('farmacia2', 6.5, [shop('farmacia', { paint: '#ffffff', trim: MX.green })], { corner: 'end' }),
  ]);

  // 20th to 19th. East: the mercado with its fruit stand, the lavandería, the joyería. West: western
  // wear, a painted shutter, mariscos.
  row(B[8], B[9], 1, [
    flats('mercado2', 7, [shop('mercado', { paint: MX.lime, awning: MX.green })], { corner: 'start', extra: (b) => standAt(b, b.W * 0.55, 'fruit') }),
    flats('lavanderia2', 5.5, [shop('lavanderia', { paint: MX.blue })]),
    flats('joyeria2', 6, [shop('joyeria', { paint: MX.ink })], { corner: 'end', extra: (b) => muralSide(b, 'muralCalavera') }),
  ]);
  row(B[8], B[9], -1, [
    flats('western2', 7, [shop('western', { paint: MX.brown })], { corner: 'start' }),
    flats('shutter2', 5, [{ w: 1, paint: MX.magenta, mural: 'shutterB' }]),
    flats('mariscos2', 7, [shop('mariscos', { paint: MX.turquoise })], { corner: 'end' }),
  ]);

  // 19th to 18th. West: Taqueria Cancún on 19th, the dulcería, and the paletería on the corner of
  // 18th (the inside of the turn), dressing 18th too. East: celulares on 19th, Fiesta's second shop,
  // the carnicería on the corner of 18th.
  row(B[10], B[11], -1, [
    { name: 'cancun', w: 9, floors: 2, body: MX.turquoise, trim: '#fbf6e8', accent: '#0e7c86', top: 'parapet', bays: 1, corner: 'start', fronts: [{ w: 1, paint: '#0e7c86', sign: 'cancun', fascia: 1.25, awning: MX.yellow, blade: 'bladeTaco' }] },
    flats('dulceria2', 5.5, [shop('dulceria', { paint: MX.magenta })]),
    flats('paleteria2', 8, [shop('paleteria', { paint: MX.pink, awning: MX.turquoise })], { corner: 'end', extra: (b) => muralSide(b, 'muralWoman') }),
  ]);
  row(B[10], B[11], 1, [
    flats('celulares3', 6, [shop('celulares', { paint: MX.cobalt })], { corner: 'start' }),
    flats('pinatas2', 6.5, [shop('pinatas', { paint: MX.yellow, awning: MX.turquoise })], { extra: (b) => pinatasOut(b) }),
    flats('carniceria2', 7.5, [shop('carniceria', { paint: MX.red, awning: '#ffffff' })], { corner: 'end', extra: (b) => flagOn(b, b.W * 0.4) }),
  ]);

  // 18th St, Mission to Valencia. North: the tortillería on the corner of Mission (dressing Mission St
  // north), a painted shutter, mariscos, El Gran Taco's other shop on Valencia. South: from past the
  // paletería's side, the mural wall and the café on Valencia.
  const E = [after(ec, tE), m('eighteenth', 'valencia') - WALK, m('eighteenth', 'valencia') + 12 + WALK, m('eighteenth', 'guerrero') - WALK, m('eighteenth', 'guerrero') + 12 + WALK, before(dc, tD)];
  row(E[0], E[1], 1, [
    flats('tortilleria2', 7, [shop('tortilleria', { paint: MX.marigold })], { corner: 'start', extra: (b) => muralSide(b, 'muralQuetzal') }),
    flats('shutter3', 5.5, [{ w: 1, paint: MX.green, mural: 'shutterC' }]),
    flats('mariscos3', 6, [shop('mariscos', { paint: MX.blue })]),
    flats('granTaco2', 7, [shop('granTaco', { paint: MX.chili, blade: 'bladeTaco' })], { corner: 'end' }),
  ]);
  row(E[0] + DEPTH, E[1], -1, [
    flats('muralWall2', 7, [{ w: 1, paint: MX.purple, mural: 'muralCalavera' }], { bays: 0 }),
    flats('cafe3', 6.5, [shop('cafe', { paint: MX.brown })], { corner: 'end', extra: (b) => muralSide(b, 'muralSun') }),
  ]);

  // Valencia to Guerrero: the Women's Building on the south side, all of it in the MaestraPeace
  // mural; a joyería beside it on Valencia, the bakery-café on Guerrero. (The north side is houses.)
  row(E[2], E[3], -1, [
    flats('joyeria3', 5, [shop('joyeria', { paint: MX.ink })], { corner: 'start' }),
    { name: 'womens', w: 14, floors: 4, body: MX.purple, trim: MX.yellow, accent: MX.magenta, top: 'cornice', bays: 0, depth: 15, fronts: [{ w: 1, paint: MX.purple, trim: MX.yellow, mural: 'maestra1', sign: 'womens', fascia: 0.7 }], extra: (b) => womensMural(b) },
    flats('panaderia3', 6, [shop('panaderia', { paint: MX.cream, awning: MX.chili })], { corner: 'end' }),
  ]);

  // Guerrero to Dolores. South: Tartine on the corner of Guerrero (its door round on Guerrero, the
  // queue down 18th), Bi-Rite Market; houses on to Dolores. North: houses, then Bi-Rite Creamery and
  // its queue.
  const e3 = E[5] - E[4];
  row(E[4], E[4] + e3 * 0.62, -1, [
    { name: 'tartine', w: 9, floors: 2, body: '#9aa79a', trim: '#f3efe6', accent: '#3e4a45', top: 'cornice', bays: 1, corner: 'start', fronts: [{ w: 1, paint: '#3e4a45', trim: '#f3efe6', sign: 'tartine' }], sideFront: { w: 1, paint: '#3e4a45', trim: '#f3efe6', sign: 'tartine', door: 'l' }, extra: (b) => queue(b, 0.6, 8) },
    { name: 'biRite', w: 10, floors: 2, body: '#f6efdc', trim: '#1f3f8a', accent: '#1f3f8a', top: 'parapet', bays: 1, fronts: [{ w: 1, paint: '#1f3f8a', sign: 'biRite', fascia: 1.4, awning: '#2e7d32' }], extra: (b) => standAt(b, b.W * 0.3, 'fruit') },
  ]);
  row(E[4] + e3 * 0.66, E[4] + e3 * 0.95, 1, [
    { name: 'creamery', w: 8, floors: 2, body: '#fde6ef', trim: '#ffffff', accent: '#8a4b2a', top: 'cornice', bays: 1, fronts: [{ w: 1, paint: MX.pink, trim: '#ffffff', sign: 'creamery', blade: 'bladeNieves', fascia: 1.15 }], extra: (b) => queue(b, b.W - 0.6, 10) },
  ]);

  // --- 24th & Mission: the BART plazas on the outside corners ----------------------------------------
  {
    const t = tM;
    const yP = t.y + KERB;
    for (const [su, sv] of [
      [-1, 1],
      [1, -1],
    ] as const) {
      const u0 = su * (mc.hw + WALK);
      const u1 = su * (mc.hw + WALK + PLAZA);
      const v0 = sv * (mc.hw + WALK - 0.7);
      const v1 = sv * (mc.hw + WALK + PLAZA);
      const poly = rectPoly(t.x, t.z, t.hIn, Math.min(u0, u1), Math.max(u0, u1), Math.min(v0, v1), Math.max(v0, v1));
      ctx.occ.claim(poly);
      // The plaza: pale paving in a grid, a step down at its edges.
      const mid = inCorner(t, (u0 + u1) / 2, (v0 + v1) / 2);
      const mat = new THREE.Matrix4().makeRotationY(-t.hIn).setPosition(mid.x, 0, mid.z);
      const hu = Math.abs(u1 - u0) / 2;
      const hv = Math.abs(v1 - v0) / 2;
      box(S.sidewalk, -hu, hu, yP - 0.8, yP + 0.01, -hv, hv, '#ddd5c6', mat);
      for (let i = -hu + 2; i < hu; i += 2) box(S.concrete, i - 0.04, i + 0.04, yP + 0.01, yP + 0.015, -hv, hv, '#c3b9a8', mat);
      // The stairs down, the canopy and the BART sign; palms and benches round them.
      const sMid = inCorner(t, su * (mc.hw + WALK + PLAZA - 1.5), sv * (mc.hw + WALK + PLAZA / 2 + 0.5));
      bartEntrance(S, atlas, signs, sMid.x, yP, sMid.z, t.hIn + (su > 0 ? Math.PI : 0));
      clutter.push({ x: sMid.x, z: sMid.z, r: 2.5 });
      for (const [pu, pv] of [
        [mc.hw + WALK + 1.8, mc.hw + WALK + PLAZA - 1.6],
        [mc.hw + WALK + PLAZA - 1.4, mc.hw + WALK + 0.9],
      ]) {
        const p = inCorner(t, su * pu, sv * pv);
        palm(S, p.x, yP, p.z, 7 + rng() * 2, rng);
        box(S.concrete, p.x - 0.8, p.x + 0.8, yP - 0.2, yP + 0.35, p.z - 0.8, p.z + 0.8, '#b9b1a2');
      }
      const bp = inCorner(t, su * (mc.hw + WALK + 4.5), sv * (mc.hw + WALK + PLAZA - 1.2));
      plazaBench(S, bp.x, yP, bp.z, t.hIn);
      // People about the plaza: waiting, chatting, on their way down.
      for (let i = 0; i < 6; i++) {
        const p = inCorner(t, su * (mc.hw + WALK + 1.5 + rng() * (PLAZA - 3)), sv * (mc.hw + WALK + 0.8 + rng() * 3.2));
        spots.push({ x: p.x, y: yP, z: p.z, face: rng() * Math.PI * 2 });
      }
    }
  }

  // --- The cross streets' arms: Calle 24, Mission St south, 22nd, Valencia ----------------------------
  const ARM_LEN = 34;
  const eastArm: Arm = { x: tM.x, z: tM.z, y: tM.y, h: tM.hIn, u0: mc.hw - 0.5, u1: ARM_LEN, road: mc.hw };
  const southArm: Arm = { x: tM.x, z: tM.z, y: tM.y, h: tM.hOut + Math.PI, u0: mc.hw - 0.5, u1: ARM_LEN, road: mc.hw };
  /** A crossing's arm on a side of the course (as streets.ts lays it). */
  const crossArm = (s: number, side: 1 | -1): Arm => {
    const sec = c.sections.find((q) => q.kind === 'crossing' && Math.abs(q.s0 - s) < 0.5)!;
    const mid = pointAt(c, Math.min(sec.s0 + 6, (sec.s0 + sec.s1) / 2));
    return { x: mid.x - mid.tz * side * sec.hw, z: mid.z + mid.tx * side * sec.hw, y: mid.y, h: mid.heading + (side * Math.PI) / 2, u0: -0.5, u1: ARM_LEN, road: 6 };
  };
  /** A lot on an arm's frontage (the building away from the arm), from u0 to u1 out along it. */
  const armLot = (a: Arm, side: 1 | -1, u0: number, u1: number): Lot => {
    const ux = Math.cos(a.h);
    const uz = Math.sin(a.h);
    const v = side * (a.road + WALK);
    const ox = a.x + ux * u0 - uz * v;
    const oz = a.z + uz * u0 + ux * v;
    const len = u1 - u0;
    return side > 0 ? { ox, oz, ux, uz, W: len } : { ox: ox + ux * len, oz: oz + uz * len, ux: -ux, uz: -uz, W: len };
  };
  const onArm = (a: Arm, side: 1 | -1, u0: number, u1: number, spec: Spec): Built | null => {
    const lot = armLot(a, side, u0, u1);
    const poly = rectPoly(lot.ox, lot.oz, Math.atan2(lot.uz, lot.ux), 0.2, lot.W - 0.2, 0.2, spec.depth ?? DEPTH);
    if (!ctx.occ.free(poly)) return null;
    const cx = lot.ox + lot.ux * lot.W * 0.5;
    const cz = lot.oz + lot.uz * lot.W * 0.5;
    const b = building(k, lot, spec, ctx.ground(cx, cz) + KERB, null);
    ctx.occ.claim(rectPoly(lot.ox, lot.oz, Math.atan2(lot.uz, lot.ux), 0, lot.W, 0, spec.depth ?? DEPTH));
    built[spec.name] = b;
    return b;
  };
  // Calle 24, east of Mission: La Victoria on the south side; murals on the north beyond the plaza;
  // the welcome sign across the street and papel picado all down it.
  onArm(eastArm, 1, 22.5, 32, { name: 'laVictoria', w: 9.5, floors: 2, body: '#f7c6d9', trim: MX.cream, accent: MX.magenta, top: 'cornice', bays: 1, fronts: [{ w: 1, paint: MX.pink, sign: 'laVictoria', fascia: 1.25, awning: '#ffffff' }], extra: (b) => flagOn(b, b.W * 0.7) });
  onArm(eastArm, -1, mc.hw + WALK + PLAZA + 0.5, 32, { name: 'balmy', w: 9, floors: 2, body: MX.marigold, top: 'parapet', bays: 0, fronts: [{ w: 1, paint: MX.purple, mural: 'muralQuetzal' }], extra: (b) => muralFront(b, 'muralFlowers') });
  {
    const a = eastArm;
    const at = (u: number, v: number): { x: number; z: number } => ({ x: a.x + Math.cos(a.h) * u - Math.sin(a.h) * v, z: a.z + Math.sin(a.h) * u + Math.cos(a.h) * v });
    // The welcome sign over the street on its two poles.
    const u = 27;
    const l = at(u, -(a.road + 1.2));
    const r = at(u, a.road + 1.2);
    const gl = ctx.ground(l.x, l.z);
    const gr = ctx.ground(r.x, r.z);
    for (const [p, g] of [
      [l, gl],
      [r, gr],
    ] as const) {
      cyl(S.metal, [p.x, g, p.z], [p.x, g + 7.4, p.z], 0.12, 0.15, 8, '#3d4650');
      clutter.push({ x: p.x, z: p.z, r: 0.4 });
    }
    const y0 = (gl + gr) / 2 + 5.4;
    const y1 = y0 + 1.6;
    const fx = Math.cos(a.h);
    const fz = Math.sin(a.h);
    atlas.quad(signs, 'calle24', [l.x - fx * 0.03, y0, l.z - fz * 0.03], [r.x - fx * 0.03, y0, r.z - fz * 0.03], [r.x - fx * 0.03, y1, r.z - fz * 0.03], [l.x - fx * 0.03, y1, l.z - fz * 0.03], [-fx, 0, -fz]);
    atlas.quad(signs, 'calle24', [r.x + fx * 0.03, y0, r.z + fz * 0.03], [l.x + fx * 0.03, y0, l.z + fz * 0.03], [l.x + fx * 0.03, y1, l.z + fz * 0.03], [r.x + fx * 0.03, y1, r.z + fz * 0.03], [fx, 0, fz]);
    cyl(S.paint, [l.x, y1 + 0.07, l.z], [r.x, y1 + 0.07, r.z], 0.09, 0.09, 6, MX.yellow);
    cyl(S.paint, [l.x, y0 - 0.07, l.z], [r.x, y0 - 0.07, r.z], 0.07, 0.07, 6, MX.yellow);
    // Papel picado over Calle 24, where there are buildings both sides to tie it to.
    for (const uu of [24.5, 30.5]) {
      const pl = at(uu, -(a.road + WALK));
      const pr = at(uu, a.road + WALK);
      papelString(papel, S.paint, [pl.x, ctx.ground(pl.x, pl.z) + PAPEL_Y, pl.z], [pr.x, ctx.ground(pr.x, pr.z) + PAPEL_Y, pr.z], 0.55, rng);
    }
  }
  // Mission St south: the Mission Cultural Center on the west side past the plaza, its front a mural;
  // La Taqueria on the east side.
  onArm(southArm, 1, mc.hw + WALK + PLAZA + 0.5, 32, { name: 'mccla', w: 9, floors: 3, body: MX.ink, trim: MX.marigold, accent: MX.orange, top: 'parapet', bays: 0, fronts: [{ w: 1, paint: MX.ink, trim: MX.marigold, sign: 'mccla', fascia: 1.0 }], extra: (b) => muralFront(b, 'muralSun') });
  onArm(southArm, -1, 21, 32, { name: 'laTaqueria', w: 11, floors: 1, shopH: 4.8, body: '#f4ead5', trim: '#fffaf0', accent: MX.chili, top: 'parapet', fronts: [{ w: 1, paint: '#f4ead5', trim: MX.chili, sign: 'laTaqueria', fascia: 1.3, arched: true }], extra: (b) => flagOn(b, b.W * 0.8) });
  // 22nd St east: the Florería Regalos Guadalupana on its north side.
  onArm(crossArm(m('missionSt', '22nd'), 1), -1, 18.5, 29, { name: 'floreria', w: 10.5, floors: 2, body: '#f9d5e5', trim: '#ffffff', accent: MX.jade, top: 'cornice', bays: 1, fronts: [{ w: 1, paint: MX.pink, sign: 'floreria', fascia: 1.15, awning: MX.jade }], extra: (b) => standAt(b, b.W * 0.5, 'flowers') });
  // Valencia: Dandelion down the south arm off 18th; green bike lanes down all four arms.
  onArm(crossArm(m('eighteenth', 'valencia'), -1), 1, 18.5, 30, { name: 'dandelion', w: 11.5, floors: 2, body: '#9c5b3d', trim: '#e9d8bf', accent: '#3b2416', top: 'parapet', bays: 1, fronts: [{ w: 1, paint: '#3b2416', trim: '#e9d8bf', sign: 'dandelion', fascia: 1.1 }] });
  for (const a of [crossArm(m('mission24', 'valencia'), 1), crossArm(m('mission24', 'valencia'), -1), crossArm(m('eighteenth', 'valencia'), 1), crossArm(m('eighteenth', 'valencia'), -1)]) {
    for (const sv of [-1, 1]) {
      const v0 = sv * (a.road - 1.9);
      const v1 = sv * (a.road - 0.3);
      groundStrip(ctx, S.marks, a.x, a.z, a.h, 3.6, 33, Math.min(v0, v1), Math.max(v0, v1), 0.11, -0.095, '#3a9d5d');
    }
  }

  // --- Papel picado over 24th, Mission St and 18th --------------------------------------------------
  const across = (s: number, y: number): void => {
    const p = pointAt(c, s);
    const e = p.hw + WALK;
    const l = along(c, s, -e);
    const r = along(c, s, e);
    papelString(papel, S.paint, [l.x, p.y + KERB + y, l.z], [r.x, p.y + KERB + y, r.z], 0.6, rng);
  };
  // (Where there are walls both sides to tie the strings to: not over the plazas.)
  for (const [s0, s1] of [
    [b24a, b24b],
    [bcA, bcB - PLAZA],
    [E[0], E[1]],
  ]) {
    for (let s = s0 + 4; s < s1 - 2; s += 9) across(s, PAPEL_Y);
  }
  for (let i = 0; i < B.length; i += 2) {
    const s0 = i === 0 ? B[0] + PLAZA : B[i];
    for (let s = s0 + 4; s < B[i + 1] - 2; s += 8) across(s, PAPEL_Y_MISSION);
  }

  // --- The 14-Mission's trolley wires --------------------------------------------------------------
  {
    const s0 = B[0] + 1;
    const s1 = B[B.length - 1] - 1;
    // A pole either side in the middle of each block (streets.ts's lamps are 6 m into each block).
    const poles: number[] = [];
    for (let i = 0; i < B.length; i += 2) poles.push((B[i] + B[i + 1]) / 2);
    const at = wires(ctx, s0, s1, poles, mc.hw + POLE_SET, (s) => pointAt(c, s));
    for (const [x, z] of at) markThing(ctx, x, z, 0.3);
  }

  // --- Race day: the crowd keeps clear of the doors, carts, stands and queues ------------------------
  for (const d of k.doors) markDoor(ctx, d.x, d.z);
  for (const t of clutter) markThing(ctx, t.x, t.z, t.r);
  if (spots.length) {
    const crowd = new Crowd(spots, rng);
    ctx.group.add(crowd.group);
    ctx.updaters.push((dt, t, cars) => crowd.update(dt, t, cars));
  }

  // --- The meshes of our own ------------------------------------------------------------------------
  const signMat = new THREE.MeshStandardMaterial({ map: atlas.texture, vertexColors: true, roughness: 0.55 });
  ctx.group.add(meshOf(signs, signMat, 'missionSigns', false, true));
  const tex = new THREE.CanvasTexture(papelCanvas());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const papelMat = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.8, alphaTest: 0.5, side: THREE.DoubleSide });
  ctx.group.add(meshOf(papel, papelMat, 'papelPicado', false, false));

  return {
    noHouses: (s, side) => own.some((q) => q.side === side && s >= q.s0 - 0.5 && s <= q.s1 + 0.5),
  };

  // --- Landmarks' extras (hoisted) -------------------------------------------------------------------

  /** Something on the sidewalk in front of a building, at a along its face: a fruit stand, paleta
   *  carts, buckets of flowers. */
  function standAt(b: Built, a: number, what: 'fruit' | 'paletas' | 'flowers'): void {
    const f = b.front;
    const p = f.p(Math.min(b.W - 1, Math.max(1, a)), b.y0, -1.3);
    const h = Math.atan2(f.uz, f.ux);
    if (what === 'fruit') {
      fruitStand(S, p[0], b.y0, p[2], h + Math.PI / 2, rng);
      clutter.push({ x: p[0], z: p[2], r: 1.3 });
      for (let i = 0; i < 2; i++) {
        const q = f.p(Math.min(b.W - 0.5, a + 1.6 + i * 0.7), b.y0, -0.9);
        spots.push({ x: q[0], y: b.y0, z: q[2], face: Math.atan2(-f.wz, -f.wx) + Math.PI });
      }
    } else if (what === 'paletas') {
      for (const da of [-0.8, 0.8]) {
        const q = f.p(Math.min(b.W - 1, Math.max(1, a + da)), b.y0, -1.1);
        paletaCart(S, q[0], b.y0, q[2], h);
        clutter.push({ x: q[0], z: q[2], r: 0.9 });
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const q = f.p(Math.min(b.W - 0.6, Math.max(0.6, a - 1.6 + i * 0.8)), b.y0, -0.7);
        cyl(S.paint, [q[0], b.y0, q[2]], [q[0], b.y0 + 0.45, q[2]], 0.2, 0.16, 8, '#5b6b7a');
        const g = new THREE.IcosahedronGeometry(0.28, 0);
        g.translate(q[0], b.y0 + 0.65, q[2]);
        S.paint.add(g, [MX.red, MX.pink, MX.yellow, MX.marigold, '#ffffff'][i]);
        clutter.push({ x: q[0], z: q[2], r: 0.35 });
      }
    }
  }

  /** Star piñatas hanging along the front of the party shop's awning. */
  function pinatasOut(b: Built): void {
    const f = b.front;
    const n = Math.max(3, Math.floor(b.W / 1.4));
    for (let i = 0; i < n; i++) {
      const a = 0.7 + ((b.W - 1.4) * (i + 0.5)) / n;
      const p = f.p(a, b.y0 + 2.35, -1.25);
      starPinata(S, p[0], p[1], p[2], 0.16 + rng() * 0.05, rng);
      clutter.push({ x: p[0], z: p[2], r: 0.45 });
    }
  }

  /** A Mexican flag out on its bracket over the sidewalk, at a along the front, over the shop. */
  function flagOn(b: Built, a: number): void {
    bracketFlag(S, atlas, signs, b.front, a, b.shopTop + 0.6);
  }

  /** A mural over the free part of a corner building's side wall on its cross street (the part its
   *  shopfront and windows leave), floor to roofline. */
  function muralSide(b: Built, cell: string): void {
    if (!b.side) return;
    const end1 = b.cornerA > 0;
    const a0 = end1 ? 6.9 : 0.4;
    const a1 = end1 ? b.D - 0.4 : b.D - 6.9;
    if (a1 - a0 < 2) return;
    b.side.sign(atlas, signs, cell, a0, a1, b.y0 + 0.1, b.top - 0.9, -0.03);
  }

  /** A mural over a building's upper floors. */
  function muralFront(b: Built, cell: string): void {
    b.front.sign(atlas, signs, cell, 0.3, b.W - 0.3, b.shopTop + 0.15, b.top - 0.9, -0.03);
  }

  /** The Women's Building: MaestraPeace over the upper floors (the ground floor's is its front's). */
  function womensMural(b: Built): void {
    b.front.sign(atlas, signs, 'maestra2', 0.15, b.W - 0.15, b.shopTop + 0.1, b.top - 1.05, -0.025);
    flagOn(b, b.W * 0.15);
  }

  /** A queue along the sidewalk from a (along the front, one way), n people, facing the door. */
  function queue(b: Built, a: number, n: number): void {
    const f = b.front;
    const dir = a > b.W / 2 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const aa = a + dir * (0.4 + i * 0.75);
      if (aa < 0.3 || aa > b.W - 0.3) {
        // On past the building, still in line.
        const q = f.p(aa, b.y0, -1.0);
        spots.push({ x: q[0], y: b.y0, z: q[2], face: Math.atan2(-dir * f.uz, -dir * f.ux) });
        clutter.push({ x: q[0], z: q[2], r: 0.45 });
        continue;
      }
      const q = f.p(aa, b.y0, -1.0 - (i % 2) * 0.25);
      spots.push({ x: q[0], y: b.y0, z: q[2], face: Math.atan2(-dir * f.uz, -dir * f.ux) });
      clutter.push({ x: q[0], z: q[2], r: 0.45 });
    }
  }

  /** The New Mission: its tall sign standing out from the front up past the roof, the Alamo
   *  Drafthouse's marquee over the sidewalk with its bulbs. */
  function newMission(b: Built): void {
    const f = b.front;
    const a = b.W * 0.5;
    const y0 = b.shopTop + 0.2;
    const y1 = b.top + 9;
    const c0 = -0.25;
    const c1 = -2.35;
    f.box(S.paint, a - 0.2, a + 0.2, y0, y1, c0, c1, MX.red);
    f.box(S.trim, a - 0.26, a + 0.26, y1, y1 + 0.35, c0 + 0.05, c1 - 0.05, MX.yellow);
    const facing = (sg: number): V3 => [f.ux * sg, 0, f.uz * sg];
    for (const sg of [1, -1]) {
      const aa = a + sg * 0.205;
      const pTop = (c: number): V3 => f.p(aa, y1 - 0.15, c);
      const pBot = (c: number): V3 => f.p(aa, y0 + 0.15, c);
      if (sg > 0) atlas.quad(signs, 'newMission', pBot(c0 - 0.1), pBot(c1 + 0.1), pTop(c1 + 0.1), pTop(c0 - 0.1), facing(1));
      else atlas.quad(signs, 'newMission', pBot(c1 + 0.1), pBot(c0 - 0.1), pTop(c0 - 0.1), pTop(c1 + 0.1), facing(-1));
    }
    // A brace back to the wall at the top.
    cyl(S.metal, f.p(a, b.top - 0.5, 0), f.p(a, y1 - 1.5, c1 + 0.4), 0.06, 0.06, 5, '#3a3a3e');
    // The marquee.
    const ma0 = 0.8;
    const ma1 = b.W - 0.8;
    const my0 = b.shopTop - 0.95;
    const my1 = b.shopTop + 0.35;
    const mc0 = -2.55;
    f.box(S.paint, ma0, ma1, my0, my1, -0.05, mc0, MX.ink);
    f.sign(atlas, signs, 'marquee', ma0 + 0.15, ma1 - 0.15, my0 + 0.08, my1 - 0.08, mc0 - 0.01);
    for (let aa = ma0 + 0.2; aa < ma1 - 0.1; aa += 0.45) {
      const p = f.p(aa, my0 - 0.03, mc0 + 0.12);
      box(S.glow, p[0] - 0.06, p[0] + 0.06, p[1] - 0.08, p[1], p[2] - 0.06, p[2] + 0.06, '#fff3b0');
    }
    flagOn(b, b.W * 0.2);
  }
}

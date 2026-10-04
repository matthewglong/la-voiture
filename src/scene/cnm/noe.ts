// Noe Valley on race day: 24th St from Castro to Church, Stroller Valley. Its shops both sides in the
// order they stand (noe/shops.ts: Noe Valley Bakery, the post office, Starbucks, Bernie's, Noe Valley
// Books, Fresca, Whole Foods, Haystack Pizza, Martha & Bros., Noe Valley Wine & Spirits...) and the
// ones a valley of strollers needs (a toy shop, a children's boutique, a baby gym, mommy-and-me yoga,
// a stroller dealership, a diaper depot with a giant baby bottle on its roof); the Town Square with
// its farmers' market, stroller corral and play area (noe/square.ts); strollers parked outside every
// café; pastel balloon arches over the street (IT'S A BOY! IT'S A GIRL!), pole banners, SLOW —
// CHILDREN AT PLAY; the J Church's tracks and wires across 24th at Church, Dolores St's palms at the
// top of the drop into the Mission (noe/crossings.ts); and Noe Valley Pediatrics up the last block,
// its queue of strollers. All of it merged into the shared builders, but for the lettering: one atlas,
// one mesh (noe/signs.ts).
import * as THREE from 'three';
import { pointAt } from '../../track';
import { GeoBuilder, cyl, meshOf, type V3 } from '../geo';
import type { Ctx, Hood } from '../osg/context';
import { SignAtlas, signQuad, type Region } from '../osg/hayes/atlas';
import { Frame, faceSign, type Kit } from '../osg/hayes/kit';
import { markThing } from '../osg/kerbside';
import { POLE_SET, WALK } from '../osg/streets';
import { doloresPalms, jChurchCrossing, parkedVan } from './noe/crossings';
import { babyBottle, balanceBike, balloonArch, diamondSign, poleBanner, scooter, stroller, type StrollerKind } from './noe/props';
import { BLOCK_A, BLOCK_B, BLOCK_C, BLOCK_D, PEDIATRICS, blockFrame, buildShops, type Block } from './noe/shops';
import { paintNoeSigns } from './noe/signs';
import { buildTownSquare } from './noe/square';

/** Strollers' fabrics and hoods, as the valley buys them: navy, grey, olive, sand, black, the odd
 *  burgundy, camel, dusty blue, blush and red. */
const FABRICS: [string, string][] = [
  ['#2b3a55', '#2b3a55'],
  ['#5f6b73', '#3e4a52'],
  ['#3e5a3a', '#c9b38a'],
  ['#d9cbb3', '#7a6a55'],
  ['#1f1f22', '#1f1f22'],
  ['#7a2e3a', '#d9cbb3'],
  ['#c9a96e', '#5a4632'],
  ['#8fa9c4', '#e9eef3'],
  ['#e7b9c3', '#ffffff'],
  ['#d64545', '#1f1f22'],
];

type Item = StrollerKind | 'bike' | 'scooter';

/** How much frontage an item takes along the wall (m). */
const ROOM: Record<Item, number> = { single: 1.0, double: 1.05, jogger: 1.3, bike: 0.75, scooter: 0.65 };

export function buildNoe(ctx: Ctx): Hood {
  const c = ctx.course;
  const S = ctx.sinks;
  const atlas = new SignAtlas();
  paintNoeSigns(atlas);
  const k: Kit = { ctx, S, atlas, sign: new GeoBuilder(), rng: ctx.rng };
  const rng = k.rng;
  const m = (name: string): number => ctx.mark('noe', name);
  const mm = (name: string): number => ctx.mark('mission24', name);
  const HW = pointAt(c, m('books')).hw;
  const PL = HW + WALK;
  const fabric = (): [string, string] => FABRICS[Math.floor(rng() * FABRICS.length)];

  // --- The shops, block by block, from the back of one cross street's sidewalk to the next's (the
  // first from the corner off Castro, whose sidewalk squares end where its section does).
  const span = (s0: number, s1: number): Block => blockFrame(k, s0, s1 - s0);
  const A = span(m('noe'), m('noeSt') - WALK);
  const B = span(m('books') + WALK, m('sanchez') - WALK);
  const C = span(m('square') + WALK, m('vicksburg') - WALK);
  const D = span(m('martha') + WALK, m('church') - WALK);
  const E = span(mm('upper') + WALK, mm('dolores') - WALK);
  buildShops(k, A, HW, BLOCK_A);
  buildShops(k, B, HW, BLOCK_B);
  // The Town Square takes most of the south side of Sanchez to Vicksburg, beside Haystack Pizza.
  const SQ = 5.5;
  buildShops(k, C, HW, BLOCK_C.filter((q) => q.side < 0));
  buildShops(k, C, HW, BLOCK_C.filter((q) => q.side > 0), 0, SQ);
  buildShops(k, D, HW, BLOCK_D);
  // Noe Valley Pediatrics, the last building on the north side before Dolores.
  const PED = 9;
  buildShops(k, E, HW, [{ side: -1, list: [PEDIATRICS] }], E.len - PED, E.len);
  {
    const [x, z] = C.at(SQ, PL);
    const f = new Frame(x, z, C.tx, C.tz);
    buildTownSquare(k, f, C.len - SQ, 24, C.walkY((SQ + C.len) / 2), FABRICS);
  }

  // --- On the sidewalks: what's parked outside each shop, along its front (strollers mostly), each
  // one marked so race day's crowd stands clear of it.
  const out = (B: Block, sign: string, side: 1 | -1, items: Item[]): void => {
    const sp = B.pos.get(sign);
    if (!sp) return;
    const [a0, a1] = sp;
    let need = items.reduce((t, it) => t + ROOM[it], 0);
    while (items.length > 1 && need > a1 - a0 - 0.5) need -= ROOM[items.pop()!];
    let a = (a0 + a1) / 2 - need / 2;
    const along = Math.atan2(B.tz, B.tx);
    for (const it of items) {
      const mid = a + ROOM[it] / 2;
      a += ROOM[it];
      const e = it === 'bike' || it === 'scooter' ? 0.35 : 0.5;
      const [x, z] = B.at(mid, side * (PL - e));
      const y = B.walkY(mid);
      const turn = rng() < 0.5 ? 0 : Math.PI;
      if (it === 'bike') balanceBike(S, x, y, z, along + turn, ['#e2453c', '#3fa0d8', '#6ba539', '#f2a541'][Math.floor(rng() * 4)]);
      else if (it === 'scooter') scooter(S, x, y, z, along + turn, ['#f2a7c1', '#7cc6e8', '#b6e07a'][Math.floor(rng() * 3)]);
      else {
        const [fab, can] = fabric();
        stroller(S, x, y, z, along + turn, it, fab, can);
      }
      markThing(ctx, x, z, it === 'single' || it === 'bike' || it === 'scooter' ? 0.55 : 0.68);
    }
  };
  // Castro to Noe.
  out(A, 'station', 1, ['single', 'single']);
  out(A, 'bakery', 1, ['single', 'double', 'single', 'jogger', 'single']);
  out(A, 'tumblers', 1, ['bike', 'bike', 'scooter', 'single']);
  out(A, 'namaste', 1, ['single', 'single', 'double']);
  out(A, 'sprouts', -1, ['single', 'double']);
  out(A, 'spa', -1, ['single']);
  out(A, 'bump', -1, ['single', 'single']);
  // Noe to Sanchez.
  out(B, 'starbucks', 1, ['single', 'jogger', 'single', 'double']);
  out(B, 'books', 1, ['single', 'single']);
  out(B, 'fresca', 1, ['double', 'single']);
  out(B, 'justForFun', -1, ['scooter', 'scooter', 'single']);
  out(B, 'bernies', -1, ['single', 'single', 'double', 'single']);
  out(B, 'wholeFoods', -1, ['single', 'double', 'single', 'jogger', 'single', 'double', 'single']);
  out(B, 'smiles', -1, ['single', 'single']);
  // Sanchez to Vicksburg.
  out(C, 'haystack', 1, ['single', 'single']);
  out(C, 'tinyToes', -1, ['single', 'bike']);
  out(C, 'martha', -1, ['double', 'single', 'single', 'jogger']);
  // Vicksburg to Church.
  out(D, 'diaperDash', 1, ['double', 'single']);
  out(D, 'wine', 1, ['single']);
  out(D, 'saru', -1, ['single']);
  out(D, 'firstCuts', -1, ['single', 'scooter']);
  out(D, 'peekaboo', -1, ['single', 'double']);
  // The queue outside the pediatrician's.
  out(E, 'pediatrics', -1, ['single', 'double', 'single', 'single', 'jogger', 'single', 'single']);

  // The stroller dealership's display out front, nose to the street, each with its price.
  {
    const sp = B.pos.get('strollerDepot');
    if (sp) {
      const [a0, a1] = sp;
      const tag = atlas.get('priceTag');
      const toStreet = Math.atan2(-B.tx, B.tz);
      const kinds: StrollerKind[] = ['jogger', 'double', 'single', 'single', 'double'];
      const n = Math.min(kinds.length, Math.floor((a1 - a0 - 0.8) / 0.85));
      const colours: [string, string][] = [
        ['#e2453c', '#1f1f22'],
        ['#2563c9', '#2563c9'],
        ['#f2a541', '#ffffff'],
        ['#6ba539', '#3e5a3a'],
        ['#8a4fc2', '#e8e2f6'],
      ];
      for (let i = 0; i < n; i++) {
        const a = a0 + 0.4 + ((a1 - a0 - 0.8) * (i + 0.5)) / n;
        const [x, z] = B.at(a, PL - 0.62);
        const y = B.walkY(a);
        stroller(S, x, y, z, toStreet, kinds[i], colours[i][0], colours[i][1]);
        markThing(ctx, x, z, 0.6);
        // A price card on a stalk in front of it, facing the street.
        const [px, pz] = B.at(a, PL - 1.25);
        cyl(S.metal, [px, y, pz], [px, y + 0.75, pz], 0.012, 0.012, 4, '#9aa0a6');
        markThing(ctx, px, pz, 0.2);
        cardFacing(k.sign, tag, px, y + 0.75, pz, 0.3, toStreet);
      }
    }
  }

  // --- Over the street: balloon arches for the babies on the way, with their banners. Their legs
  // stand where the start gantry's posts do (1.8 m out from the road's edge, in the crowd's row, which
  // keeps clear), and the arc clears the road by the gantry's margin.
  const arch = (B: Block, a: number, boy: boolean): void => {
    const y = B.walkY(a);
    const [xa, za] = B.at(a, -(HW + 1.8));
    const [xb, zb] = B.at(a, HW + 1.8);
    markThing(ctx, xa, za, 0.6);
    markThing(ctx, xb, zb, 0.6);
    const colours = boy ? ['#a9d6f2', '#ffffff', '#7cc6e8', '#e3f2fb', '#c9d3dc'] : ['#f6bfd2', '#ffffff', '#f2a7c1', '#fbe3ec', '#e8c66a'];
    const top = balloonArch(S, [xa, y, za], [xb, y, zb], 5.6, 8.6, colours, rng);
    // The banner hangs under the top on two cords, facing the traffic both ways.
    const r = atlas.get(boy ? 'itsABoy' : 'itsAGirl');
    const w = 4.4;
    const h = w / r.aspect;
    const yTop = top[1] - 1.1;
    const nx = -B.tz;
    const nz = B.tx;
    for (const s of [-1, 1]) cyl(S.metal, [top[0], top[1] - 0.2, top[2]], [top[0] + nx * s * (w / 2), yTop, top[2] + nz * s * (w / 2)], 0.012, 0.012, 3, '#d8d8d8');
    const q = (dn: number, dy: number, dt: number): V3 => [top[0] + nx * dn + B.tx * dt, yTop - h + dy, top[2] + nz * dn + B.tz * dt];
    // Facing the racers (who come along +t: their right is +n).
    signQuad(k.sign, r, q(-w / 2, 0, -0.02), q(w / 2, 0, -0.02), q(w / 2, h, -0.02), q(-w / 2, h, -0.02));
    signQuad(k.sign, r, q(w / 2, 0, 0.02), q(-w / 2, 0, 0.02), q(-w / 2, h, 0.02), q(w / 2, h, 0.02));
  };
  arch(A, A.len * 0.55, false);
  arch(B, B.len * 0.48, true);
  arch(E, E.len * 0.3, false);

  // --- Signs on their own poles at the kerb (behind race day's barriers, as the lamps stand).
  const heading = Math.atan2(A.tz, A.tx);
  const pole = (B: Block, a: number, side: 1 | -1): [number, number, number] => {
    const [x, z] = B.at(a, side * (HW + POLE_SET));
    markThing(ctx, x, z, 0.3);
    return [x, B.walkY(a), z];
  };
  {
    const [x, y, z] = pole(A, 2.5, 1);
    diamondSign(S, k.sign, atlas.get('kidsAtPlay'), x, y, z, heading);
  }
  {
    const [x, y, z] = pole(D, 3.5, 1);
    diamondSign(S, k.sign, atlas.get('kidsAtPlay'), x, y, z, heading);
  }
  {
    const [x, y, z] = pole(E, E.len - PED - 2.5, -1);
    diamondSign(S, k.sign, atlas.get('babyOnBoard'), x, y, z, heading);
  }
  // Pole banners: NOE VALLEY, and what everyone calls it.
  const banners: [Block, number, 1 | -1, string][] = [
    [A, 12, 1, 'pbNoe'],
    [A, 30, -1, 'pbStroller'],
    [B, 12, 1, 'pbStroller'],
    [B, 24, -1, 'pbNoe'],
    [D, 10, 1, 'pbStroller'],
  ];
  for (const [Bk, a, side, key] of banners) {
    if (a > Bk.len - 1) continue;
    const [x, y, z] = pole(Bk, a, side);
    // (Its bracket reaches out towards the street: from a pole on side s, that's -s across the course.)
    poleBanner(S, k.sign, atlas.get(key), x, y, z, heading, Math.atan2(-side * Bk.tx, side * Bk.tz));
  }
  // STROLLER PARKING by Whole Foods' door.
  {
    const sp = B.pos.get('wholeFoods');
    if (sp) {
      const a = sp[1] - 0.35;
      const [x, z] = B.at(a, -(PL - 0.3));
      const y = B.walkY(a);
      cyl(S.metal, [x, y, z], [x, y + 2.4, z], 0.035, 0.04, 6, '#9aa0a6');
      markThing(ctx, x, z, 0.25);
      cardFacing(k.sign, atlas.get('strollerParking'), x, y + 1.6, z, 0.6, heading + Math.PI);
    }
  }
  // The giant baby bottle on Diaper Dash's roof, and the delivery van down Sanchez.
  {
    const sp = D.pos.get('diaperDash');
    if (sp) {
      const a = (sp[0] + sp[1]) / 2;
      const [x, z] = D.at(a, PL + 5);
      babyBottle(S, x, D.walkY(a) + 0.03 + 4.4 + 3.05 + 0.4 + 0.05, z, 4.6);
    }
  }
  parkedVan(k, m('sanchez') + 6);
  // The Pediatrician's two doors: well kids to the left, sick kids to the right.
  {
    const a1 = E.len;
    const o = E.at(a1, -PL);
    const f = new Frame(o[0], o[1], -E.tx, -E.tz);
    const yb = Math.max(E.walkY(E.len - PED), E.walkY(a1)) + 0.03;
    faceSign(k, f, atlas.get('wellKids'), PED - 1.4, yb + 2.95, 0.3, -0.2, 1.8);
    faceSign(k, f, atlas.get('sickKids'), 1.4, yb + 2.95, 0.3, -0.2, 1.8);
  }

  // --- The cross streets: the J Church at Church, the palms of Dolores.
  jChurchCrossing(k, m('church') + 6);
  doloresPalms(k, mm('dolores') + 6);

  ctx.group.add(meshOf(k.sign, new THREE.MeshStandardMaterial({ map: atlas.texture(), vertexColors: true, roughness: 0.55 }), 'noeSigns', false, true));

  // The shops bring their own buildings (and the Town Square its square); Pediatrics too.
  const shops: [number, number][] = [A, B, C, D].map((q) => [q.s0 - 1, q.s0 + q.len + 1]);
  const ped: [number, number] = [E.s0 + E.len - PED - 1, E.s0 + E.len + 1];
  return {
    noHouses: (s, side) => shops.some(([a, b]) => s >= a && s <= b) || (side < 0 && s >= ped[0] && s <= ped[1]),
  };
}

/** A card `w` wide at (x, y, z) (its bottom edge's middle), standing upright and facing world heading
 *  `face` (read by someone looking the other way). */
function cardFacing(b: GeoBuilder, r: Region, x: number, y: number, z: number, w: number, face: number): void {
  const h = w / r.aspect;
  const fx = Math.cos(face);
  const fz = Math.sin(face);
  // The viewer looks along face + π: their right is (sin face, -cos face).
  const rx = Math.sin(face);
  const rz = -Math.cos(face);
  const p = (dr: number, dy: number): V3 => [x + rx * dr + fx * 0.02, y + dy, z + rz * dr + fz * 0.02];
  signQuad(b, r, p(-w / 2, 0), p(w / 2, 0), p(w / 2, h), p(-w / 2, h));
}

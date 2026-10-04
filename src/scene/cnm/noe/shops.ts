// 24th St's shops in Noe Valley, block by block from Castro to Church: each side's buildings in the
// order they stand, the real shops where the survey puts them (data/cnmStreets.ts: the even numbers
// on the north side, the course's left heading east; the odd ones on the south, its right) and the
// ones a valley of strollers needs in between, every frontage its real width squeezed into the model's
// shorter blocks. The buildings are Hayes Valley's (osg/hayes/block.ts): two-storey Edwardians and
// Victorians with bays over the shops, a few flat fronts, a one-storey supermarket, in Noe Valley's
// pastels. And Noe Valley Pediatrics up the next block, near Dolores.
import { pointAt } from '../../../track';
import { DEPTH, building, type Bldg, type Front } from '../../osg/hayes/block';
import { Frame, type Kit } from '../../osg/hayes/kit';
import { KERB, WALK } from '../../osg/streets';
import { nw } from './signs';

/** One side of a block, west to east. */
export interface Side {
  side: 1 | -1;
  list: Bldg[];
}

/** A front, from the defaults Noe Valley's shopfronts mostly share. */
const F = (sign: string, real: number, fascia: string, win: Parameters<typeof nw>[0], extra: Partial<Front> = {}): Front => ({
  sign,
  real,
  frame: '#2c2c30',
  fascia,
  win: nw(win),
  door: 'E',
  ...extra,
});

// ---------------------------------------------------------------------------------------------
// The blocks. Left (north) and right (south) of the course heading east.

/** Castro to Noe: the post office and the bakery on the south side, a baby gym and mommy-and-me yoga;
 *  a children's boutique, the garage, the spa and a maternity shop on the north. */
export const BLOCK_A: Side[] = [
  {
    side: 1,
    list: [
      { kind: 'bay', floors: 2, bays: 1, color: '#d6e2f0', trim: '#fbfaf6', accent: '#5b7fa8', corner: true, fronts: [F('station', 7, '#1b3a73', 'dark', { door: 'W', frame: '#1b3a73' })] },
      { kind: 'flat', floors: 2, color: '#f3e1c7', trim: '#fffaf0', accent: '#a0623a', fronts: [F('bakery', 9, '#f7efe2', 'bakery', { blade: 'b_bakery', named: true, awning: '#7a3b1e', frame: '#5a2d14' })] },
      {
        kind: 'bay',
        floors: 2,
        bays: 2,
        color: '#f6edb5',
        trim: '#ffffff',
        accent: '#e2453c',
        corner: true,
        fronts: [F('tumblers', 7, '#ffd84d', 'toys', { blade: 'b_tumblers', awning: '#e2453c', door: 'W' }), F('namaste', 7, '#f6d6e3', 'yoga', { frame: '#7a4b8c' })],
      },
    ],
  },
  {
    side: -1,
    list: [
      { kind: 'bay', floors: 2, bays: 1, color: '#dff0d4', trim: '#ffffff', accent: '#3e7a3a', corner: true, fronts: [F('sprouts', 7, '#dff0d4', 'kids', { blade: 'b_sprouts', awning: '#7cb86e' })] },
      { kind: 'blank', floors: 1, color: '#c9c4bb', trim: '#7d7a74', accent: '#2b2f36', windows: 2, fronts: [F('autoworks', 9, '#2b2f36', 'dark', { door: 'W' })] },
      {
        kind: 'bay',
        floors: 2,
        bays: 2,
        color: '#f2d0d6',
        trim: '#fffaf6',
        accent: '#b65a6e',
        corner: true,
        fronts: [F('spa', 6, '#e8efe9', 'beds', { frame: '#4a6b5d' }), F('bump', 7, '#fbe3d4', 'kids', { awning: '#c45a3c', door: 'W' })],
      },
    ],
  },
];

/** Noe to Sanchez: Starbucks, Noe Valley Books, Fresca and the stroller dealership on the south side;
 *  a toy shop, Bernie's, Whole Foods and the kids' dentist on the north. */
export const BLOCK_B: Side[] = [
  {
    side: 1,
    list: [
      { kind: 'modern', floors: 2, color: '#e9e6df', trim: '#2f3a35', accent: '#00704a', corner: true, fronts: [F('starbucks', 8, '#1e3932', 'cafe', { blade: 'b_starbucks', named: true, door: 'W', pier: '#2f3a35' })] },
      {
        kind: 'bay',
        floors: 2,
        bays: 2,
        color: '#e7d9f0',
        trim: '#ffffff',
        accent: '#6a5a9e',
        fronts: [F('books', 6, '#2f4f3a', 'shelves', { blade: 'b_books', awning: '#2f4f3a' }), F('fresca', 7, '#f2a541', 'cafe', { door: 'W', frame: '#5a2d14' })],
      },
      { kind: 'flat', floors: 2, color: '#d6e2f0', trim: '#ffffff', accent: '#2563c9', corner: true, fronts: [F('strollerDepot', 10, '#2563c9', 'strollers', { blade: 'b_strollerDepot', named: true, door: 'W' })] },
    ],
  },
  {
    side: -1,
    list: [
      { kind: 'bay', floors: 2, bays: 1, color: '#f6edb5', trim: '#ffffff', accent: '#e2453c', corner: true, fronts: [F('justForFun', 7, '#ffffff', 'toys', { blade: 'b_justForFun', awning: '#2f80d6', frame: '#2f80d6' })] },
      { kind: 'flat', floors: 2, color: '#e3d2bf', trim: '#fbf6ee', accent: '#5b3a26', fronts: [F('bernies', 6, '#5b3a26', 'cafe', { named: true, awning: '#5b3a26', frame: '#3a2a20' })] },
      { kind: 'blank', floors: 1, color: '#d9d2c4', trim: '#5f6b5a', accent: '#00674b', windows: 3, fronts: [F('wholeFoods', 16, '#00674b', 'shelves', { blade: 'b_wholeFoods', named: true, awning: '#00674b', door: 'W' })] },
      { kind: 'bay', floors: 2, bays: 1, color: '#cfe3d4', trim: '#ffffff', accent: '#2b7fb8', corner: true, fronts: [F('smiles', 7, '#e9f6fb', 'clinic', { frame: '#2b7fb8' })] },
    ],
  },
];

/** Sanchez to Vicksburg: Haystack Pizza by the Town Square on the south side; kids' shoes and Martha &
 *  Bros. on the north. */
export const BLOCK_C: Side[] = [
  {
    side: 1,
    list: [{ kind: 'flat', floors: 2, color: '#f3e1c7', trim: '#ffffff', accent: '#c8382e', corner: true, fronts: [F('haystack', 6, '#c8382e', 'cafe', { blade: 'b_haystack', awning: '#c8382e', door: 'W' })] }],
  },
  {
    side: -1,
    list: [
      { kind: 'bay', floors: 2, bays: 1, color: '#fff4c2', trim: '#ffffff', accent: '#d2583a', corner: true, fronts: [F('tinyToes', 6, '#fff4c2', 'shoes', { awning: '#d2583a' })] },
      { kind: 'flat', floors: 2, color: '#d8cfc4', trim: '#fbf8f2', accent: '#1d1d1d', corner: true, fronts: [F('martha', 6, '#1d1d1d', 'cafe', { blade: 'b_martha', named: true, awning: '#1d1d1d', door: 'W' })] },
    ],
  },
];

/** Vicksburg to Church: the diaper depot (the giant baby bottle on its roof), Noe Valley Wine &
 *  Spirits and the baby-furniture shop on the south side; Saru, the kids' barber and the baby
 *  photographer on the north. */
export const BLOCK_D: Side[] = [
  {
    side: 1,
    list: [
      { kind: 'flat', floors: 1, color: '#e6f3fa', trim: '#ffffff', accent: '#7cc6e8', corner: true, fronts: [F('diaperDash', 7, '#7cc6e8', 'diapers', { awning: '#7cc6e8', door: 'W' })] },
      {
        kind: 'bay',
        floors: 2,
        bays: 1,
        color: '#e8e2f6',
        trim: '#ffffff',
        accent: '#6a5a9e',
        corner: true,
        fronts: [F('wine', 6, '#5a1e2e', 'bar', { blade: 'b_wine', frame: '#5a1e2e' }), F('lullaby', 6, '#e8e2f6', 'kids', { door: 'W', awning: '#a99ad6' })],
      },
    ],
  },
  {
    side: -1,
    list: [
      { kind: 'flat', floors: 2, color: '#cdd5cf', trim: '#ffffff', accent: '#171717', corner: true, fronts: [F('saru', 6, '#171717', 'bar', { door: 'W' })] },
      {
        kind: 'bay',
        floors: 2,
        bays: 1,
        color: '#f2d0d6',
        trim: '#ffffff',
        accent: '#d64545',
        corner: true,
        fronts: [F('firstCuts', 6, '#d64545', 'kids', { awning: '#d64545' }), F('peekaboo', 6, '#fbd3e0', 'kids', { door: 'W', frame: '#3d6fb4' })],
      },
    ],
  },
];

/** Noe Valley Pediatrics, on the north side of 24th near Dolores. */
export const PEDIATRICS: Bldg = {
  kind: 'flat',
  floors: 2,
  color: '#f4f6f2',
  trim: '#2e7fb8',
  accent: '#9ecbe6',
  corner: true,
  fronts: [F('pediatrics', 9, '#ffffff', 'clinic', { blade: 'b_pediatrics', frame: '#2e7fb8', named: true })],
};

// ---------------------------------------------------------------------------------------------
// Laying them out

/** Frontages by their real widths, squeezed to fit (the narrow ones keep a little more). */
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

/** Where a block's things go: s0 its west end along the course, the frame along it. */
export interface Block {
  s0: number;
  len: number;
  /** World (x, z) at a metres along from s0 and d to the right of the centreline. */
  at(a: number, d: number): [number, number];
  /** The sidewalk's height at a. */
  walkY(a: number): number;
  tx: number;
  tz: number;
  /** Where each front's shop is along the block (a0, a1), by its sign. */
  pos: Map<string, [number, number]>;
}

/** The block's frame: the course is straight along 24th St, so one tangent serves it. */
export function blockFrame(k: Kit, s0: number, len: number): Block {
  const c = k.ctx.course;
  const P = pointAt(c, s0);
  const tx = P.tx;
  const tz = P.tz;
  const at = (a: number, d: number): [number, number] => [P.x + tx * a - tz * d, P.z + tz * a + tx * d];
  const walkY = (a: number): number => pointAt(c, s0 + Math.min(Math.max(a, -WALK), len + WALK)).y + KERB;
  return { s0, len, at, walkY, tx, tz, pos: new Map() };
}

/**
 * Build a block's shops: each side's buildings along the back of its sidewalk (hw + WALK out), from
 * a0 to a1 of the block, their shops in order and to width; claims their ground. Returns where each
 * shop is (by its sign), so the sidewalk's things can find them.
 */
export function buildShops(k: Kit, B: Block, hw: number, sides: Side[], a0 = 0, a1 = B.len): void {
  const PL = hw + WALK;
  for (const { side, list } of sides) {
    const fronts = list.flatMap((b) => b.fronts);
    const widths = lay(fronts, a1 - a0);
    let a = a0;
    let fi = 0;
    list.forEach((b, bi) => {
      const b0 = a;
      const parts: { s: Front; a0: number; a1: number }[] = [];
      for (const s of b.fronts) {
        parts.push({ s, a0: a, a1: a + widths[fi] });
        if (s.sign) B.pos.set(s.sign, [a, a + widths[fi]]);
        a += widths[fi++];
      }
      const b1 = a;
      const W = b1 - b0;
      // The lot: the right side's runs east (west at u = 0), the left side's west (west at u = W).
      const o = side > 0 ? B.at(b0, PL) : B.at(b1, -PL);
      const f = side > 0 ? new Frame(o[0], o[1], B.tx, B.tz) : new Frame(o[0], o[1], -B.tx, -B.tz);
      const yb = Math.max(B.walkY(b0), B.walkY(b1)) + 0.03;
      const ylo = Math.min(B.walkY(b0), B.walkY(b1));
      const us = parts.map((p) => (side > 0 ? { s: p.s, u0: p.a0 - b0, u1: p.a1 - b0 } : { s: p.s, u0: b1 - p.a1, u1: b1 - p.a0 }));
      if (side < 0) us.reverse();
      // A corner building shows its side to the cross street at whichever end of the block it's at
      // (the right side's lots run east: its west end is u = 0; the left side's west end is u = W).
      let corner: 0 | 1 | null = null;
      if (b.corner) {
        const west = bi === 0 && b0 <= 0.01;
        const east = bi === list.length - 1 && b1 >= B.len - 0.01;
        if (west || east) corner = side > 0 ? (west ? 0 : 1) : west ? 1 : 0;
      }
      building(k, f, W, yb, ylo, b, us, side < 0, corner);
      k.ctx.occ.claim(f.poly(-0.2, W + 0.2, 0, DEPTH + 0.5));
    });
  }
}

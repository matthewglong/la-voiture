// Alamo Square's famous houses, bespoke: the Painted Ladies of "Postcard Row" (710-722 Steiner,
// built by Matthew Kavanaugh in 1892-96), the Archbishop's Mansion (1904) across Fulton from the
// park's northeast steps, and the Westerfeld House (1889) at Fulton & Scott. alamo.ts decides where
// each one stands; this builds them, painted as they were in August 2026.
//
// The six Queen Annes (710-720) stand on raised basements with their garages under the bays: a long
// flight of stairs up to a recessed porch, a two-storey bay beside it, a balcony over the porch under
// a spindlework frieze, and over everything a steep front gable with its pediment (an attic window
// between panels, bargeboards, a finial). Every band, bracket and moulding is picked out in three or
// four colours. All but 720 have their porch at the north end; 720 is built the other way round, so
// its stairs and 718's stand side by side. 722, the big corner house at Grove, has a hipped roof, a
// turret over the bay by 720, a balconied bay at the corner, fish-scale shingles upstairs and a
// running scroll under its eaves. The course's block is shorter than the real one, so the houses keep
// their height and give up width.
import * as THREE from 'three';
import { STREET_HW } from '../../maps/oldStompingGrounds';
import { locate, pointAt } from '../../track';
import { GeoBuilder, box, cyl, obox, prism, rbox, shade, type V3 } from '../geo';
import type { HouseStyle, Lot } from '../victorian';
import type { Ctx, Sinks } from './context';
import { KERB, WALK } from './streets';

type Col = THREE.ColorRepresentation;
type P2 = [number, number];

// ---------------------------------------------------------------------------------------------
// The paint.

/** A painted lady's scheme: her body and the three or four colours that pick out her trim. */
interface Paint {
  /** The siding. */
  body: string;
  /** Casings, corner boards, rakes, cornices, columns, rails. */
  trim: string;
  /** Bands, hoods, the gable's panels: the scheme's second colour. */
  accent: string;
  /** The picked-out details: fans, fillets, the frieze's panels, the balls on the finials. */
  pick: string;
  /** Window sashes and the doors. */
  sash: string;
  roof: string;
  /** The stairs' cheek walls (else the body colour). */
  stair?: string;
  /** Round the gable's panels (else the accent colour). */
  outline?: string;
  /** The frieze under the gable and the panels on it (else the accent and the picked-out colour). */
  frieze?: [string, string];
}

/** What sets each of the six Queen Annes apart besides her paint. */
interface Lady {
  paint: Paint;
  /** Porch and stairs at the lot's north end (else its south). */
  porchNorth: boolean;
  /** What fills the gable: an attic window between panels, a pair of windows under fish-scale
   *  shingles, a louvred vent between panels, or a pair under a fanlight between lattice. */
  gable: 'panels' | 'pair' | 'louvre' | 'lattice';
  /** The gable's corner panels solid in the accent colour (716's red triangles), else outlined. */
  solid?: boolean;
  /** A round-arched porch (720's), else a square one under spindlework. */
  arch?: boolean;
  /** A squared bay (710's), else an angled one. */
  squareBay?: boolean;
  /** A sunburst in the peak. */
  sunburst?: boolean;
}

/** The six Queen Annes, south to north. */
const LADIES: Record<string, Lady> = {
  '710': { porchNorth: true, gable: 'lattice', squareBay: true, paint: { body: '#b39a7b', trim: '#f6eed9', accent: '#6f5140', pick: '#e0bd5e', sash: '#5a3f2f', roof: '#5f6873', stair: '#f6eed9', frieze: ['#f6eed9', '#6f5140'] } },
  '712': { porchNorth: true, gable: 'pair', paint: { body: '#96bfde', trim: '#fcfbf6', accent: '#2d5a86', pick: '#dcebf6', sash: '#2c4a6b', roof: '#575b63', stair: '#e3e9ee' } },
  '714': { porchNorth: true, gable: 'panels', sunburst: true, paint: { body: '#f2e8d0', trim: '#fcf8ee', accent: '#7f2a38', pick: '#cda54e', sash: '#7f2a38', roof: '#7d5749', stair: '#fcf8ee' } },
  '716': { porchNorth: true, gable: 'panels', solid: true, paint: { body: '#f5da8b', trim: '#fcf4de', accent: '#bb362d', pick: '#2e5a4e', sash: '#8f2b25', roof: '#7e5b4f', stair: '#bb362d', frieze: ['#fcf4de', '#bb362d'] } },
  '718': { porchNorth: true, gable: 'louvre', paint: { body: '#a5b09d', trim: '#f0efe4', accent: '#58684f', pick: '#d2bd80', sash: '#45543f', roof: '#4f5155', stair: '#f0efe4', outline: '#f0efe4' } },
  '720': { porchNorth: false, gable: 'panels', arch: true, sunburst: true, paint: { body: '#908d5a', trim: '#f2e5a8', accent: '#5e5c33', pick: '#dcac3c', sash: '#5c4731', roof: '#4c4d50', outline: '#f2e5a8' } },
};

/** 722's paint: navy siding, darker fish-scale shingles upstairs, pale blue and white trim, burgundy
 *  garlands. */
const NAVY: Paint = { body: '#3b5078', trim: '#e7eff6', accent: '#a9c4db', pick: '#ffffff', sash: '#1f2b46', roof: '#3c3d42' };
const SHINGLES = '#28385b';
const SCALES = '#34497a';
const GARLAND = '#7e2834';
const IRON = '#1b1d21';
const LACE = '#f4efe3';
const STEP = '#aca69a';
const STEP2 = '#a29c90';

/** The Ladies' lots are 12 m deep (alamo.ts claims that much). */
const DEPTH = 11.8;
/** Garages in the Ladies' basements, under their bays (as there are today: painted to match). */
const GARAGES = true;

// ---------------------------------------------------------------------------------------------
// A house's frame, and the shapes it's made of.

/** A wall face in a house's frame: from (u, w) along (du, dw); it faces out to (dw, -du). */
interface Face {
  u: number;
  w: number;
  du: number;
  dw: number;
}

/** The front of a house (facing the street) at depth w. */
const front = (w: number): Face => ({ u: 0, w, du: 1, dw: 0 });

/** A point on a face: `a` along it, `c` out from it. */
function fpt(f: Face, a: number, y: number, c: number): V3 {
  return [f.u + f.du * a + f.dw * c, y, f.w + f.dw * a - f.du * c];
}

/**
 * A house's frame and the builders it draws into: u along its frontage, y up, w back from the street
 * (which is at w < 0), and the sidewalk's top by a point of the frontage (x, z). Flat details
 * (shingles, fans, lattice, pickets) are gathered in the frame and merged into their builders by
 * done().
 */
class Kit {
  readonly m: THREE.Matrix4;
  readonly S: Sinks;
  /** Roofing and chimneys: matte (the walls' sheen would grey dark shingles against the sky). */
  readonly roofs: GeoBuilder;
  private readonly flats = new Map<GeoBuilder, GeoBuilder>();

  constructor(
    private readonly ctx: Ctx,
    readonly lot: Lot,
    private readonly sidewalk: (x: number, z: number) => number,
  ) {
    this.S = ctx.sinks;
    this.roofs = ctx.sinks.concrete;
    this.m = new THREE.Matrix4()
      .makeBasis(new THREE.Vector3(lot.ux, 0, lot.uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-lot.uz, 0, lot.ux))
      .setPosition(lot.ox, 0, lot.oz);
  }

  /** The ground under (u, w). */
  ground(u: number, w: number): number {
    const l = this.lot;
    return this.ctx.site.ground(l.ox + l.ux * u - l.uz * w, l.oz + l.uz * u + l.ux * w);
  }

  /** The sidewalk's top in front of u (or the ground, where there's no sidewalk above it). */
  walk(u: number): number {
    return Math.max(this.sidewalk(this.lot.ox + this.lot.ux * u, this.lot.oz + this.lot.uz * u), this.ground(u, -0.4) + 0.02);
  }

  box(b: GeoBuilder, u0: number, u1: number, y0: number, y1: number, w0: number, w1: number, c: Col): void {
    box(b, u0, u1, y0, y1, w0, w1, c, this.m);
  }

  rbox(b: GeoBuilder, u0: number, u1: number, y0: number, y1: number, w0: number, w1: number, r: number, c: Col): void {
    rbox(b, u0, u1, y0, y1, w0, w1, r, c, this.m, 1);
  }

  obox(b: GeoBuilder, c: V3, size: V3, rot: V3, col: Col): void {
    obox(b, c, size, rot, col, this.m);
  }

  prism(b: GeoBuilder, poly: V3[], dir: V3, col: Col): void {
    prism(b, poly, dir, col, this.m);
  }

  cyl(b: GeoBuilder, a: V3, c: V3, r0: number, r1: number, seg: number, col: Col): void {
    cyl(b, a, c, r0, r1, seg, col, this.m);
  }

  /** A temporary geometry in the frame. */
  add(b: GeoBuilder, g: THREE.BufferGeometry, col: Col): void {
    b.add(g, col, this.m);
  }

  /** Box on a face: along it [a0, a1], up [y0, y1], out from it [c0, c1]. */
  fbox(b: GeoBuilder, f: Face, a0: number, a1: number, y0: number, y1: number, c0: number, c1: number, col: Col): void {
    obox(b, fpt(f, (a0 + a1) / 2, (y0 + y1) / 2, (c0 + c1) / 2), [a1 - a0, y1 - y0, c1 - c0], [0, Math.atan2(-f.dw, f.du), 0], col, this.m);
  }

  /** A convex polygon in a face's (a, y), from c0 out to c1. */
  fprism(b: GeoBuilder, f: Face, pts: P2[], c0: number, c1: number, col: Col): void {
    const d = c1 - c0;
    prism(b, pts.map(([a, y]) => fpt(f, a, y, c0)), [f.dw * d, 0, -f.du * d], col, this.m);
  }

  /** A flat convex polygon in a face's (a, y), `c` out from it and facing out. */
  flat(b: GeoBuilder, f: Face, pts: P2[], c: number, col: Col): void {
    let g = this.flats.get(b);
    if (!g) {
      g = new GeoBuilder();
      this.flats.set(b, g);
    }
    const n: V3 = [f.dw, 0, -f.du];
    const q = pts.map(([a, y]) => fpt(f, a, y, c));
    for (let i = 1; i < q.length - 1; i++) g.tri(q[0], q[i], q[i + 1], col, n);
  }

  /** Merge the flat details into their builders. */
  done(): void {
    for (const [b, g] of this.flats) if (g.vertexCount) b.add(g.build(), null, this.m);
    this.flats.clear();
  }
}

/** Steiner's sidewalk by (x, z): the course's road there, plus the kerb (the Ladies' stairs and
 *  driveways come down to it). */
function steinerWalk(ctx: Ctx): (x: number, z: number) => number {
  const s0 = ctx.mark('alamo', 'ladies');
  const s1 = ctx.mark('alamo', 'ladiesEnd');
  return (x, z) => pointAt(ctx.course, locate(ctx.course, x, z, (s0 + s1) / 2, (s1 - s0) / 2 + 10).s).y + KERB;
}

/** Fulton's sidewalk by (x, z) on its north property line: the street's ground at its middle, plus the
 *  kerb (as alamo.ts lays Fulton along the park). */
function fultonWalk(ctx: Ctx): (x: number, z: number) => number {
  return (x, z) => ctx.ground(x, z + WALK + STREET_HW - 1) + KERB;
}

const ball = (r: number, u: number, y: number, w: number): THREE.BufferGeometry => new THREE.SphereGeometry(r, 5, 3).translate(u, y, w);
const spike = (r: number, h: number, u: number, y: number, w: number): THREE.BufferGeometry => new THREE.ConeGeometry(r, h, 6).translate(u, y + h / 2, w);
const diamond = (a: number, y: number, r: number): P2[] => [
  [a, y - r],
  [a + r, y],
  [a, y + r],
  [a - r, y],
];

/** Flat-shaded (each face its own normal): the turret's walls. */
function faceted(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.toNonIndexed();
  g.dispose();
  n.computeVertexNormals();
  return n;
}

/** A triangle shrunk toward its incentre, leaving a border `d` wide. */
function inset(t: P2[], d: number): P2[] {
  const [A, B, C] = t;
  const a = Math.hypot(B[0] - C[0], B[1] - C[1]);
  const b = Math.hypot(C[0] - A[0], C[1] - A[1]);
  const c = Math.hypot(A[0] - B[0], A[1] - B[1]);
  const s = a + b + c;
  const ix = (a * A[0] + b * B[0] + c * C[0]) / s;
  const iy = (a * A[1] + b * B[1] + c * C[1]) / s;
  const r = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / s;
  const f = Math.max(0, (r - d) / r);
  return t.map(([x, y]) => [ix + (x - ix) * f, iy + (y - iy) * f]);
}

function inTri(t: P2[], x: number, y: number): boolean {
  const [a, b, c] = t;
  const s1 = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  const s2 = (c[0] - b[0]) * (y - b[1]) - (c[1] - b[1]) * (x - b[0]);
  const s3 = (a[0] - c[0]) * (y - c[1]) - (a[1] - c[1]) * (x - c[0]);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

interface WinOpts {
  /** Over the head: a cornice, a little pediment, or nothing. */
  hood?: 'cornice' | 'pediment' | 'none';
  /** A band of coloured lights across the top (the bays' big windows). */
  transom?: boolean;
  /** Lace curtains drawn to the sides. */
  drapes?: boolean;
}

/** A tall Queen Anne sash window on a face: casing, sill and apron, the sashes, a hood. */
function sashWindow(k: Kit, f: Face, a0: number, a1: number, y0: number, y1: number, p: Paint, o: WinOpts = {}): void {
  const { trim, glass } = k.S;
  const t = 0.1;
  const wd = a1 - a0;
  k.fbox(glass, f, a0, a1, y0, y1, 0, 0.015, '#ffffff');
  k.fbox(trim, f, a0 - t, a0, y0, y1 + t, -0.02, 0.08, p.trim);
  k.fbox(trim, f, a1, a1 + t, y0, y1 + t, -0.02, 0.08, p.trim);
  k.fbox(trim, f, a0, a1, y1, y1 + t, -0.02, 0.08, p.trim);
  k.fbox(trim, f, a0 - t - 0.05, a1 + t + 0.05, y0 - 0.07, y0, -0.02, 0.14, p.trim);
  k.fbox(trim, f, a0 + 0.02, a1 - 0.02, y0 - 0.22, y0 - 0.07, -0.02, 0.04, p.accent);
  if (o.transom) {
    // A bar under the transom, its coloured lights, and the meeting rail below.
    const yt = y1 - Math.min(0.42, (y1 - y0) * 0.24);
    k.fbox(trim, f, a0, a1, yt - 0.05, yt + 0.02, 0, 0.04, p.sash);
    const n = Math.max(2, Math.round(wd / 0.3));
    for (let i = 0; i < n; i++) {
      const u0 = a0 + (i * wd) / n + 0.05;
      const u1 = a0 + ((i + 1) * wd) / n - 0.05;
      k.fbox(trim, f, u0, u1, yt + 0.08, y1 - 0.07, 0.015, 0.025, i % 2 ? p.pick : p.accent);
    }
    const ym = y0 + (yt - y0) * 0.5;
    k.fbox(trim, f, a0, a1, ym - 0.03, ym + 0.03, 0, 0.035, p.sash);
  } else {
    const ym = y0 + (y1 - y0) * 0.52;
    k.fbox(trim, f, a0, a1, ym - 0.03, ym + 0.03, 0, 0.035, p.sash);
  }
  if (o.drapes) {
    const dw = Math.min(0.26, wd * 0.2);
    for (const [u0, u1] of [
      [a0, a0 + dw],
      [a1 - dw, a1],
    ]) {
      k.fbox(trim, f, u0, u1, y0 + 0.05, y1 - (o.transom ? 0.5 : 0.08), 0.015, 0.03, LACE);
    }
  }
  const hood = o.hood ?? 'cornice';
  if (hood === 'cornice') {
    k.fbox(trim, f, a0 - t - 0.03, a1 + t + 0.03, y1 + t, y1 + t + 0.08, -0.02, 0.1, p.pick);
    k.fbox(trim, f, a0 - t - 0.1, a1 + t + 0.1, y1 + t + 0.08, y1 + t + 0.22, -0.02, 0.19, p.accent);
  } else if (hood === 'pediment') {
    k.fbox(trim, f, a0 - t - 0.08, a1 + t + 0.08, y1 + t, y1 + t + 0.1, -0.02, 0.15, p.accent);
    const h = 0.14 + wd * 0.16;
    k.fprism(trim, f, [
      [a0 - t - 0.1, y1 + t + 0.1],
      [a1 + t + 0.1, y1 + t + 0.1],
      [(a0 + a1) / 2, y1 + t + 0.1 + h],
    ], -0.02, 0.11, p.accent);
    k.flat(trim, f, [
      [(a0 + a1) / 2 - wd * 0.3, y1 + t + 0.14],
      [(a0 + a1) / 2 + wd * 0.3, y1 + t + 0.14],
      [(a0 + a1) / 2, y1 + t + 0.1 + h * 0.62],
    ], 0.115, p.pick);
  }
}

/** A plainer window (the mansion's and the Westerfeld's): casing, glass, sash bar, sill, a hood. */
function plainWindow(k: Kit, f: Face, a0: number, a1: number, y0: number, y1: number, p: Paint, hood: 'cornice' | 'pediment' | 'none' = 'cornice'): void {
  const { trim, glass } = k.S;
  k.fbox(trim, f, a0 - 0.13, a1 + 0.13, y0 - 0.02, y1 + 0.13, -0.02, 0.05, p.trim);
  k.fbox(glass, f, a0, a1, y0, y1, 0.05, 0.065, '#ffffff');
  const ym = y0 + (y1 - y0) * 0.52;
  k.fbox(trim, f, a0, a1, ym - 0.035, ym + 0.035, 0.05, 0.09, p.sash);
  k.fbox(trim, f, a0 - 0.2, a1 + 0.2, y0 - 0.12, y0, -0.02, 0.17, p.trim);
  if (hood === 'cornice') {
    k.fbox(trim, f, a0 - 0.22, a1 + 0.22, y1 + 0.13, y1 + 0.3, -0.02, 0.21, p.accent);
  } else if (hood === 'pediment') {
    k.fprism(trim, f, [
      [a0 - 0.24, y1 + 0.13],
      [a1 + 0.24, y1 + 0.13],
      [(a0 + a1) / 2, y1 + 0.35 + (a1 - a0) * 0.2],
    ], -0.02, 0.19, p.accent);
  }
}

/** A sunburst: a fan of `n` rays about (a, y) from angle t0 to t1, alternately coloured. */
function sunburst(k: Kit, b: GeoBuilder, f: Face, a: number, y: number, r: number, t0: number, t1: number, n: number, c: number, colA: Col, colB: Col): void {
  for (let i = 0; i < n; i++) {
    const ta = t0 + ((t1 - t0) * i) / n;
    const tb = t0 + ((t1 - t0) * (i + 1)) / n;
    k.flat(b, f, [
      [a, y],
      [a + r * Math.cos(ta), y + r * Math.sin(ta)],
      [a + r * Math.cos(tb), y + r * Math.sin(tb)],
    ], c, i % 2 ? colA : colB);
  }
}

/** Fish-scale shingles over a panel of a face: rows of half-discs, every other row offset and a
 *  shade lighter (only those whose centres `keep` allows). */
function fishScales(k: Kit, b: GeoBuilder, f: Face, a0: number, a1: number, y0: number, y1: number, c: number, color: Col, r: number, keep?: (a: number, y: number) => boolean): void {
  const dark = new THREE.Color(color);
  const light = dark.clone().lerp(new THREE.Color('#ffffff'), 0.13);
  let row = 0;
  for (let y = y1; y - r >= y0 - 1e-6; y -= r, row++) {
    for (let a = a0 + r + (row % 2 ? r : 0); a + r <= a1 + 1e-6; a += 2 * r) {
      if (keep && !keep(a, y - r / 2)) continue;
      k.flat(b, f, [
        [a, y],
        [a - r, y],
        [a - r * 0.7, y - r * 0.7],
        [a, y - r],
        [a + r * 0.7, y - r * 0.7],
        [a + r, y],
      ], c, row % 2 ? dark : light);
    }
  }
}

/** A running scroll along a band: half-discs alternately above and below its middle. */
function scrollBand(k: Kit, b: GeoBuilder, f: Face, a0: number, a1: number, y0: number, y1: number, c: number, col: Col): void {
  const ym = (y0 + y1) / 2;
  const r = (y1 - y0) * 0.44;
  const n = Math.floor((a1 - a0) / (4 * r));
  const s = a0 + (a1 - a0 - n * 4 * r) / 2;
  for (let i = 0; i < n; i++) {
    const a = s + i * 4 * r;
    sunburst(k, b, f, a + r, ym, r, 0, Math.PI, 3, c, col, col);
    sunburst(k, b, f, a + 3 * r, ym, r, Math.PI, 2 * Math.PI, 3, c, col, col);
  }
}

/** Garlands hung along a band: `n` swags between (a0, y) and (a1, y), each sagging `sag`. */
function swags(k: Kit, f: Face, a0: number, a1: number, y: number, n: number, sag: number, c: number, col: Col): void {
  const len = (a1 - a0) / n;
  for (let j = 0; j < n; j++) {
    const s0 = a0 + j * len;
    const m = 6;
    for (let i = 0; i < m; i++) {
      const t0 = i / m;
      const t1 = (i + 1) / m;
      const th0 = sag * 0.35 * (0.4 + Math.sin(Math.PI * t0));
      const th1 = sag * 0.35 * (0.4 + Math.sin(Math.PI * t1));
      const ya = y - sag * Math.sin(Math.PI * t0);
      const yb = y - sag * Math.sin(Math.PI * t1);
      k.flat(k.S.trim, f, [
        [s0 + len * t0, ya],
        [s0 + len * t0, ya - th0],
        [s0 + len * t1, yb - th1],
        [s0 + len * t1, yb],
      ], c, col);
    }
    k.flat(k.S.trim, f, diamond(s0, y - 0.03, 0.05), c + 0.005, col);
  }
  k.flat(k.S.trim, f, diamond(a1, y - 0.03, 0.05), c + 0.005, col);
}

/** Clapboard siding over a panel of a face: the shadow line under each board (windows, standing
 *  proud of the wall, cover them). */
function clapboards(k: Kit, f: Face, a0: number, a1: number, y0: number, y1: number, color: Col, gap = 0.24): void {
  const line = shade(color, 0.82);
  for (let y = y0 + gap; y < y1 - 0.02; y += gap) {
    k.flat(k.S.walls, f, [
      [a0, y - 0.028],
      [a1, y - 0.028],
      [a1, y],
      [a0, y],
    ], 0.006, line);
  }
}

/** A row of turned spindles between rails (the Queen Anne's spindlework frieze). */
function spindles(k: Kit, f: Face, a0: number, a1: number, y0: number, y1: number, c: number, p: Paint, gap = 0.13): void {
  const { trim } = k.S;
  k.fbox(trim, f, a0, a1, y1 - 0.07, y1, c - 0.04, c + 0.04, p.trim);
  k.fbox(trim, f, a0, a1, y0, y0 + 0.07, c - 0.04, c + 0.04, p.trim);
  const n = Math.max(2, Math.round((a1 - a0) / gap));
  for (let i = 1; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    k.fbox(trim, f, a - 0.022, a + 0.022, y0 + 0.07, y1 - 0.07, c - 0.022, c + 0.022, p.trim);
  }
  k.fbox(trim, f, a0, a1, (y0 + y1) / 2 - 0.025, (y0 + y1) / 2 + 0.025, c - 0.03, c + 0.03, p.pick);
}

/** A balustrade: top and bottom rails, balusters, posts at the ends. */
function balustrade(k: Kit, f: Face, a0: number, a1: number, y0: number, h: number, p: Paint, gap = 0.16): void {
  const { trim } = k.S;
  k.fbox(trim, f, a0, a1, y0 + h - 0.1, y0 + h, -0.07, 0.07, p.trim);
  k.fbox(trim, f, a0, a1, y0 + h - 0.14, y0 + h - 0.1, -0.05, 0.05, p.accent);
  k.fbox(trim, f, a0, a1, y0, y0 + 0.1, -0.05, 0.05, p.trim);
  const n = Math.max(2, Math.round((a1 - a0) / gap));
  for (let i = 1; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    k.fbox(trim, f, a - 0.032, a + 0.032, y0 + 0.1, y0 + h - 0.14, -0.032, 0.032, p.trim);
  }
  for (const a of [a0, a1]) k.fbox(trim, f, a - 0.07, a + 0.07, y0, y0 + h + 0.08, -0.07, 0.07, p.trim);
}

/** A turned finial on a peak at (u, y, w): a post, a ball, a spike. */
function finial(k: Kit, u: number, y: number, w: number, h: number, p: Paint): void {
  k.cyl(k.S.trim, [u, y - 0.3, w], [u, y + h * 0.55, w], 0.07, 0.08, 6, p.trim);
  k.add(k.S.trim, ball(0.12, u, y + h * 0.42, w), p.pick);
  k.add(k.S.trim, spike(0.055, h * 0.5, u, y + h * 0.52, w), p.trim);
}

/** A hipped roof over [u0, u1] x [w0, w1] from y, rising h, its ridge along the longer side. */
function hipRoof(k: Kit, b: GeoBuilder, u0: number, u1: number, w0: number, w1: number, y: number, h: number, col: Col): void {
  const g = new GeoBuilder();
  const hu = (u1 - u0) / 2;
  const hw = (w1 - w0) / 2;
  const A: V3 = [u0, y, w0];
  const B: V3 = [u1, y, w0];
  const C: V3 = [u1, y, w1];
  const E: V3 = [u0, y, w1];
  if (hw >= hu) {
    const r0: V3 = [u0 + hu, y + h, w0 + hu];
    const r1: V3 = [u0 + hu, y + h, w1 - hu];
    g.tri(A, B, r0, col, [0, 0.5, -1]);
    g.quad(B, C, r1, r0, col, [1, 0.5, 0]);
    g.tri(C, E, r1, col, [0, 0.5, 1]);
    g.quad(E, A, r0, r1, col, [-1, 0.5, 0]);
  } else {
    const r0: V3 = [u0 + hw, y + h, w0 + hw];
    const r1: V3 = [u1 - hw, y + h, w0 + hw];
    g.quad(A, B, r1, r0, col, [0, 0.5, -1]);
    g.tri(B, C, r1, col, [1, 0.5, 0]);
    g.quad(C, E, r0, r1, col, [0, 0.5, 1]);
    g.tri(E, A, r0, col, [-1, 0.5, 0]);
  }
  b.add(g.build(), null, k.m);
}

/** A mansard's steep slopes: from [u0, u1] x [w0, w1] at y up h, drawn in by `inset` all round. */
function mansard(k: Kit, b: GeoBuilder, u0: number, u1: number, w0: number, w1: number, y: number, h: number, inset: number, col: Col): void {
  const g = new GeoBuilder();
  const lo: V3[] = [
    [u0, y, w0],
    [u1, y, w0],
    [u1, y, w1],
    [u0, y, w1],
  ];
  const hi: V3[] = [
    [u0 + inset, y + h, w0 + inset],
    [u1 - inset, y + h, w0 + inset],
    [u1 - inset, y + h, w1 - inset],
    [u0 + inset, y + h, w1 - inset],
  ];
  const out: V3[] = [
    [0, 0.2, -1],
    [1, 0.2, 0],
    [0, 0.2, 1],
    [-1, 0.2, 0],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    g.quad(lo[i], lo[j], hi[j], hi[i], col, out[i]);
  }
  b.add(g.build(), null, k.m);
}

/** A flight of stairs across [u0, u1] from the porch (y, its front edge at w = top) down to the
 *  sidewalk (its nose at w = bot); the treads alternate a shade. Returns its steps' count, rise and run. */
function stairs(k: Kit, b: GeoBuilder, u0: number, u1: number, y: number, top: number, bot: number, walk: number, cols: [Col, Col]): { n: number; rise: number; run: number } {
  const n = Math.max(3, Math.round((y - walk) / 0.19));
  const rise = (y - walk) / n;
  const run = (top - bot) / (n - 1);
  for (let i = 1; i < n; i++) k.box(b, u0, u1, walk - 0.25, y - i * rise, top - i * run, top - (i - 1) * run + 0.02, cols[i % 2]);
  return { n, rise, run };
}

// ---------------------------------------------------------------------------------------------
// The Painted Ladies.

/** One of the Painted Ladies on her lot (the frontage runs along Steiner, the house extends back
 *  from it), in her own colours. `first`/`last`: the ends of the row show their side walls; 722, the
 *  corner house, is the last. `style` paints any address this doesn't know. */
export function paintedLady(ctx: Ctx, lot: Lot, addr: string, style: HouseStyle, ends: { first: boolean; last: boolean }): void {
  if (addr === '722') cornerLady(ctx, lot);
  else queenAnne(ctx, lot, LADIES[addr] ?? fromStyle(style), ends);
}

/** A Queen Anne for an address without her own details, from the style alamo.ts gives her. */
function fromStyle(st: HouseStyle): Lady {
  return {
    porchNorth: !st.doorLeft,
    gable: 'panels',
    paint: { body: st.color ?? '#e9dcc0', trim: st.trim ?? '#fbf7ec', accent: st.accent ?? '#7e2a37', pick: st.gable ?? '#c9a24c', sash: st.door ?? '#5b4630', roof: st.roof ?? '#555a62' },
  };
}

/** One of the six Queen Annes (710-720). */
function queenAnne(ctx: Ctx, lot: Lot, q: Lady, ends: { first: boolean; last: boolean }): void {
  const k = new Kit(ctx, lot, steinerWalk(ctx));
  const S = k.S;
  const p = q.paint;
  const W = lot.W;
  const D = DEPTH;
  // alamo.ts runs the row north (the frontage points north when uz < 0).
  const hi = q.porchNorth === (lot.uz < 0);
  // Levels: the porch a long flight up from the sidewalk, the upper floor, the frieze, the gable.
  const yb = Math.max(k.walk(0.3), k.walk(W - 0.3)) + 2.45;
  const y2 = yb + 3.05;
  const yF = y2 + 2.85;
  const yG = yF + 0.55;
  const half = W / 2;
  const gh = W * 0.56;
  const yA = yG + gh;
  // Depths: the house's front, the bay (and the gable over it) standing out, the porch's back wall.
  const F = 4;
  const dB = 0.75;
  const fG = F - dB;
  const Fd = F + 0.72;
  const yFound = Math.min(k.walk(0.3), k.walk(W - 0.3), k.ground(0.1, fG), k.ground(W - 0.1, fG), k.ground(0.1, D), k.ground(W - 0.1, D)) - 0.8;
  // The bay on one side, the porch and its stairs on the other.
  const bayW = Math.min(3.5, W * 0.6);
  const b0 = hi ? 0.24 : W - 0.24 - bayW;
  const b1 = b0 + bayW;
  const e0 = hi ? b1 + 0.08 : 0.12;
  const e1 = hi ? W - 0.12 : b0 - 0.08;
  const ec = (e0 + e1) / 2;
  const FR = front(fG);
  const base = shade(p.body, 0.86);

  // --- The raised basement: the garage under the bay and its driveway, a water table on top.
  k.box(S.walls, 0.1, W - 0.1, yFound, yb - 0.2, fG + 0.14, D, base);
  const facing = (u0: number, u1: number, y0: number, y1: number): void => k.box(S.walls, u0, u1, y0, y1, fG, fG + 0.16, base);
  if (GARAGES) {
    const g0 = b0 + 0.36;
    const g1 = b1 - 0.36;
    const gt = yb - 0.66;
    facing(0.1, g0 - 0.13, yFound, yb - 0.2);
    facing(g1 + 0.13, W - 0.1, yFound, yb - 0.2);
    facing(g0 - 0.13, g1 + 0.13, gt + 0.13, yb - 0.2);
    garageDoor(k, g0, g1, Math.min(k.walk(g0), k.walk(g1)) - 0.05, gt, fG, p);
    const ya = (u: number): number => k.walk(u) + 0.015;
    k.prism(S.concrete, [
      [g0 - 0.3, ya(g0 - 0.3), 0.02],
      [g1 + 0.3, ya(g1 + 0.3), 0.02],
      [g1 + 0.3, yFound, 0.02],
      [g0 - 0.3, yFound, 0.02],
    ], [0, 0, fG + 0.1], '#c9c3b6');
  } else {
    // A plain basement with a pair of little windows under the bay.
    facing(0.1, W - 0.1, yFound, yb - 0.2);
    for (const du of [-0.7, 0.7]) sashWindow(k, FR, (b0 + b1) / 2 + du - 0.3, (b0 + b1) / 2 + du + 0.3, yb - 1.45, yb - 0.8, p, { hood: 'none' });
  }
  k.box(S.trim, 0.06, W - 0.06, yb - 0.36, yb - 0.2, fG - 0.06, fG + 0.2, p.trim);

  // --- The house: its core behind the porch, the fronts of its floors, the bay.
  k.rbox(S.walls, 0.1, W - 0.1, yb - 0.25, yG + 0.02, Fd, D, 0.1, p.body);
  k.box(S.walls, 0.1, W - 0.1, y2 - 0.3, yF + 0.04, F, Fd + 0.05, p.body);
  k.box(S.walls, hi ? 0.1 : e1 + 0.04, hi ? e0 - 0.04 : W - 0.1, yb - 0.25, y2 - 0.3, F, Fd + 0.05, p.body);
  const bay = (o: number, y: number): V3[] =>
    q.squareBay
      ? [
          [b0 - o, y, F + 0.02],
          [b0 - o, y, fG - o],
          [b1 + o, y, fG - o],
          [b1 + o, y, F + 0.02],
        ]
      : [
          [b0 - o * Math.SQRT2, y, F + 0.02],
          [b0 + dB - o * (Math.SQRT2 - 1), y, fG - o],
          [b1 - dB + o * (Math.SQRT2 - 1), y, fG - o],
          [b1 + o * Math.SQRT2, y, F + 0.02],
        ];
  k.prism(S.walls, bay(0, yb - 0.25), [0, yF + 0.29 - yb, 0], p.body);
  k.prism(S.trim, bay(0.1, yb - 0.46), [0, 0.22, 0], p.trim);
  k.prism(S.trim, bay(0.04, yb - 0.6), [0, 0.14, 0], p.accent);
  k.prism(S.trim, bay(0.06, y2 - 0.52), [0, 0.1, 0], p.trim);
  k.prism(S.trim, bay(0.06, y2 + 0.04), [0, 0.1, 0], p.trim);
  const r2 = Math.SQRT1_2;
  const faces: [Face, number][] = q.squareBay
    ? [[{ u: b0, w: fG, du: 1, dw: 0 }, bayW]]
    : [
        [{ u: b0, w: F, du: r2, dw: -r2 }, dB * Math.SQRT2],
        [{ u: b0 + dB, w: fG, du: 1, dw: 0 }, bayW - 2 * dB],
        [{ u: b1 - dB, w: fG, du: r2, dw: r2 }, dB * Math.SQRT2],
      ];
  for (const [f, len] of faces) {
    const lights: [number, number, boolean][] =
      len > 3
        ? [
            [0.24, 0.74, false],
            [1.0, len - 1.0, true],
            [len - 0.74, len - 0.24, false],
          ]
        : len > 1.5
          ? [[0.27, len - 0.27, true]]
          : [[0.19, len - 0.19, false]];
    for (const [a0, a1, wide] of lights) {
      sashWindow(k, f, a0, a1, yb + 0.45, yb + 2.3, p, { transom: wide, drapes: wide });
      sashWindow(k, f, a0, a1, y2 + 0.4, y2 + 2.2, p, { transom: wide, drapes: wide });
    }
    clapboards(k, f, 0.02, len - 0.02, yb - 0.25, y2 - 0.52, p.body);
    clapboards(k, f, 0.02, len - 0.02, y2 + 0.14, yF, p.body);
    // The apron between the floors: a panel with a diamond on it.
    k.fbox(S.trim, f, 0.12, len - 0.12, y2 - 0.42, y2 + 0.04, -0.02, 0.025, p.accent);
    k.flat(S.trim, f, diamond(len / 2, y2 - 0.19, 0.15), 0.03, p.pick);
  }
  if (q.squareBay) {
    for (const cu of [b0, b1]) k.box(S.trim, cu - 0.08, cu + 0.08, yb - 0.25, yF, fG - 0.08, fG + 0.06, p.trim);
  } else {
    // Colonettes at its corners, and fans where it cuts the corners away under the frieze.
    for (const cu of [b0 + dB, b1 - dB]) k.cyl(S.trim, [cu, yb - 0.25, fG - 0.02], [cu, yF, fG - 0.02], 0.06, 0.06, 6, p.trim);
    sunburst(k, S.trim, FR, b0 + dB, yF - 0.02, 0.46, Math.PI, 1.5 * Math.PI, 5, 0.04, p.pick, p.trim);
    sunburst(k, S.trim, FR, b1 - dB, yF - 0.02, 0.46, 1.5 * Math.PI, 2 * Math.PI, 5, 0.04, p.trim, p.pick);
  }
  for (const cu of [b0, b1]) k.box(S.trim, cu - 0.07, cu + 0.07, yb - 0.25, yF, F - 0.04, F + 0.06, p.trim);

  // --- The porch: its floor, columns, header (or 720's arch), the front door at its back.
  k.box(S.trim, e0, e1, yb - 0.14, yb, fG - 0.05, Fd, '#b8b2a6');
  k.box(S.walls, hi ? e1 - 0.06 : e0, hi ? e1 : e0 + 0.06, yb, y2 - 0.3, F, Fd, p.body);
  const archR = (e1 - e0) / 2 - 0.3;
  const colTop = q.arch ? yb + 1.72 : yb + 2.22;
  const hb = q.arch ? colTop + 0.16 + archR : yb + 2.36;
  for (const cu of [e0 + 0.16, e1 - 0.16]) {
    k.box(S.trim, cu - 0.14, cu + 0.14, yb, yb + 0.22, fG + 0.02, fG + 0.3, p.trim);
    k.cyl(S.trim, [cu, yb + 0.22, fG + 0.16], [cu, colTop, fG + 0.16], 0.07, 0.085, 8, p.trim);
    k.box(S.trim, cu - 0.13, cu + 0.13, colTop, colTop + 0.14, fG + 0.03, fG + 0.29, p.pick);
  }
  k.box(S.trim, e0, e1, hb, y2 - 0.28, fG - 0.04, fG + 0.3, p.trim);
  k.box(S.trim, e0 + 0.06, e1 - 0.06, hb + 0.06, y2 - 0.36, fG - 0.07, fG - 0.04, p.accent);
  if (q.arch) {
    const ys = colTop + 0.14;
    k.add(S.trim, new THREE.TorusGeometry(archR, 0.07, 6, 14, Math.PI).translate(ec, ys, fG + 0.02), p.trim);
    // The spandrels between the arch and the header.
    for (const s of [-1, 1]) {
      const cu = ec + s * (archR + 0.2);
      const pts: P2[] = [
        [cu, hb],
        [cu, ys],
      ];
      for (let i = 0; i <= 5; i++) {
        const t = (i / 5) * (Math.PI / 2);
        pts.push([ec + s * archR * Math.cos(t), ys + archR * Math.sin(t)]);
      }
      pts.push([ec, hb]);
      for (let i = 1; i < pts.length - 1; i++) k.fprism(S.trim, FR, [pts[0], pts[i], pts[i + 1]], -0.02, 0.06, p.accent);
    }
  } else {
    spindles(k, FR, e0 + 0.3, e1 - 0.3, hb - 0.34, hb, -0.1, p);
    for (const s of [-1, 1]) {
      const cu = s < 0 ? e0 + 0.3 : e1 - 0.3;
      k.fprism(S.trim, FR, [
        [cu, hb],
        [cu - s * 0.4, hb],
        [cu, hb - 0.4],
      ], -0.14, -0.06, p.pick);
    }
  }
  const DF = front(Fd);
  const dw = Math.min(0.5, (e1 - e0) / 2 - 0.42);
  k.fbox(S.trim, DF, ec - dw - 0.14, ec + dw + 0.14, yb, yb + 2.86, -0.03, 0.06, p.trim);
  k.fbox(S.trim, DF, ec - dw, ec + dw, yb, yb + 2.24, 0, 0.08, p.sash);
  k.fbox(S.glass, DF, ec - dw + 0.14, ec + dw - 0.14, yb + 1.25, yb + 2.0, 0, 0.1, '#ffffff');
  k.fbox(S.trim, DF, ec - dw + 0.12, ec + dw - 0.12, yb + 0.25, yb + 1.05, 0.08, 0.1, p.pick);
  k.fbox(S.glass, DF, ec - dw, ec + dw, yb + 2.34, yb + 2.74, 0, 0.02, '#ffffff');

  // --- The stairs down to the sidewalk between solid cheek walls, newels at their foot.
  const sw = Math.min(1.5, e1 - e0 - 0.1);
  const s0 = ec - sw / 2;
  const s1 = ec + sw / 2;
  const walkS = k.walk(ec);
  const top = fG - 0.04;
  const bot = 0.32;
  const st = stairs(k, S.trim, s0 + 0.14, s1 - 0.14, yb, top, bot, walkS, [STEP, STEP2]);
  const cheek = p.stair ?? p.body;
  const beta = Math.atan2(yb - walkS - st.rise, top - bot);
  const clen = Math.hypot(top - bot, yb - walkS - st.rise);
  for (const [c0, c1] of [
    [s0, s0 + 0.15],
    [s1 - 0.15, s1],
  ]) {
    k.prism(S.walls, [
      [c0, yb + 0.92, top + 0.06],
      [c0, walkS + st.rise + 0.92, bot],
      [c0, walkS - 0.25, bot],
      [c0, walkS - 0.25, top + 0.06],
    ], [c1 - c0, 0, 0], cheek);
    k.obox(S.trim, [(c0 + c1) / 2, (yb + walkS + st.rise) / 2 + 0.95, (top + bot) / 2 + 0.03], [c1 - c0 + 0.06, 0.07, clen + 0.1], [-beta, 0, 0], p.trim);
    k.box(S.walls, c0 - 0.05, c1 + 0.05, walkS - 0.25, walkS + st.rise + 1.2, bot - 0.14, bot + 0.2, cheek);
    k.box(S.trim, c0 - 0.08, c1 + 0.08, walkS + st.rise + 1.2, walkS + st.rise + 1.28, bot - 0.17, bot + 0.23, p.trim);
    k.add(S.trim, ball(0.1, (c0 + c1) / 2, walkS + st.rise + 1.36, bot + 0.03), p.pick);
  }

  // --- Over the porch: the balcony, the window behind it, spindlework hung from the frieze.
  k.box(S.trim, e0 - 0.02, e1 + 0.02, y2 - 0.28, y2 - 0.12, fG - 0.12, F + 0.02, p.trim);
  balustrade(k, FR, e0 + 0.04, e1 - 0.04, y2 - 0.12, 0.8, p);
  sashWindow(k, front(F), ec - 0.42, ec + 0.42, y2 + 0.42, y2 + 2.1, p, { drapes: true });
  clapboards(k, front(F), e0, e1, y2 - 0.12, yF - 0.05, p.body);
  spindles(k, FR, e0 + 0.02, e1 - 0.02, yF - 0.42, yF - 0.02, 0.02, p);

  // --- The frieze under the gable, out over the balcony and the bay's corners, with drops at its ends.
  k.box(S.trim, 0.06, W - 0.06, yF - 0.07, yF + 0.03, fG - 0.07, Fd, p.trim);
  const [band, panel] = p.frieze ?? [p.accent, p.pick];
  k.box(S.walls, 0.06, W - 0.06, yF + 0.03, yG - 0.12, fG - 0.03, Fd, band);
  const np = Math.max(3, Math.round((W - 0.4) / 0.72));
  for (let i = 0; i < np; i++) {
    const u0 = 0.2 + (i * (W - 0.4)) / np;
    k.box(S.trim, u0 + 0.07, u0 + (W - 0.4) / np - 0.07, yF + 0.12, yG - 0.36, fG - 0.07, fG - 0.03, panel);
  }
  const nd = Math.max(8, Math.round((W - 0.3) / 0.34));
  for (let i = 0; i <= nd; i++) {
    const u = 0.15 + (i * (W - 0.3)) / nd;
    k.box(S.trim, u - 0.045, u + 0.045, yG - 0.28, yG - 0.12, fG - 0.15, fG - 0.03, p.trim);
  }
  k.box(S.trim, 0.02, W - 0.02, yG - 0.12, yG + 0.12, fG - 0.3, fG + 0.2, p.trim);
  k.box(S.trim, 0.06, W - 0.06, yG - 0.17, yG - 0.12, fG - 0.2, fG, p.pick);
  for (const cu of [0.16, W - 0.16]) {
    k.cyl(S.trim, [cu, yF - 0.44, fG + 0.06], [cu, yF - 0.06, fG + 0.06], 0.035, 0.065, 6, p.trim);
    k.add(S.trim, ball(0.075, cu, yF - 0.48, fG + 0.06), p.pick);
  }

  // --- The gable: its field, the roof behind, bargeboards and the finial, and what fills it.
  k.prism(S.walls, [
    [0.06, yG, fG],
    [W - 0.06, yG, fG],
    [half, yA, fG],
  ], [0, 0, D - 0.25 - fG], p.body);
  const ang = Math.atan2(gh, half);
  const cs = Math.cos(ang);
  const sn = Math.sin(ang);
  const L = Math.hypot(half, gh);
  const t = 0.14;
  const eo = 0.08;
  const wr0 = fG - 0.45;
  const wr1 = D + 0.05;
  // The left rake's middle, `off` out from it (the right one mirrors it).
  const rake = (off: number): P2 => [(half - eo * cs) / 2 - off * sn, (yG - eo * sn + yA) / 2 + off * cs];
  for (const s of [-1, 1]) {
    const mu = (u: number): number => half + s * (half - u);
    const [su, sy] = rake(t / 2);
    k.obox(k.roofs, [mu(su), sy, (wr0 + wr1) / 2], [L + eo, t, wr1 - wr0], [0, 0, -s * ang], p.roof);
    const [fu, fy] = rake(t - 0.17);
    k.obox(S.trim, [mu(fu), fy, wr0 + 0.04], [L + eo, 0.34, 0.12], [0, 0, -s * ang], p.trim);
    k.obox(S.trim, [mu(fu), fy, wr0 - 0.03], [L + eo - 0.14, 0.06, 0.03], [0, 0, -s * ang], p.pick);
    const [au, ay] = rake(t - 0.39);
    k.obox(S.trim, [mu(au), ay, wr0 + 0.1], [L + eo - 0.3, 0.1, 0.1], [0, 0, -s * ang], p.accent);
  }
  k.box(k.roofs, half - t * sn - 0.03, half + t * sn + 0.03, yA - 0.04, yA + t / cs + 0.06, wr0, wr1, shade(p.roof, 0.82));
  finial(k, half, yA, wr0 + 0.03, 1.15, p);
  k.box(S.trim, half - 0.05, half + 0.05, yA - 1.25, yA - 0.1, fG - 0.07, fG, p.trim);
  const slope = gh / half;
  const rakeY = (u: number): number => yG + Math.min(u, W - u) * slope;
  // Triangular panels either side of the middle, their long sides along the rakes.
  const panels = (inner: number, tw: number, y0: number): void => {
    for (const s of [-1, 1]) {
      const ui = half + s * inner;
      const tri: P2[] = [
        [ui + s * tw, y0],
        [ui, y0],
        [ui, y0 + tw * slope],
      ];
      if (q.solid) k.fprism(S.trim, FR, tri, 0, 0.04, p.accent);
      else {
        k.fprism(S.trim, FR, tri, 0, 0.03, p.outline ?? p.accent);
        k.fprism(S.trim, FR, inset(tri, 0.075), 0.03, 0.045, p.body);
      }
    }
  };
  switch (q.gable) {
    case 'panels':
      sashWindow(k, FR, half - 0.4, half + 0.4, yG + 0.5, yG + 1.42, p, { hood: 'pediment' });
      k.box(S.trim, half - 0.62, half + 0.62, yG + 0.15, yG + 0.32, fG - 0.06, fG, p.accent);
      panels(0.72, Math.min(1, half - 1.2), yG + 0.22);
      break;
    case 'pair':
      sashWindow(k, FR, half - 0.72, half - 0.08, yG + 0.45, yG + 1.3, p, { hood: 'none' });
      sashWindow(k, FR, half + 0.08, half + 0.72, yG + 0.45, yG + 1.3, p, { hood: 'none' });
      k.box(S.trim, half - 0.95, half + 0.95, yG + 1.4, yG + 1.54, fG - 0.2, fG, p.accent);
      k.box(S.trim, half - 0.95, half + 0.95, yG + 0.15, yG + 0.3, fG - 0.08, fG, p.accent);
      fishScales(k, S.walls, FR, 0.2, W - 0.2, yG + 1.62, yA - 0.2, 0.012, new THREE.Color(p.body).lerp(new THREE.Color(p.pick), 0.45), 0.12, (a, y) => y + 0.1 < Math.min(rakeY(a - 0.12), rakeY(a + 0.12)) - 0.2);
      panels(1.04, Math.min(0.72, half - 1.5), yG + 0.22);
      break;
    case 'louvre':
      k.fbox(S.trim, FR, half - 0.5, half + 0.5, yG + 0.45, yG + 1.45, -0.02, 0.04, p.trim);
      k.fbox(S.trim, FR, half - 0.38, half + 0.38, yG + 0.57, yG + 1.33, 0.04, 0.05, p.sash);
      for (let i = 0; i < 5; i++) k.fbox(S.trim, FR, half - 0.38, half + 0.38, yG + 0.62 + i * 0.145, yG + 0.69 + i * 0.145, 0.05, 0.1, p.trim);
      k.fbox(S.trim, FR, half - 0.62, half + 0.62, yG + 1.45, yG + 1.55, -0.02, 0.14, p.accent);
      k.fprism(S.trim, FR, [
        [half - 0.64, yG + 1.55],
        [half + 0.64, yG + 1.55],
        [half, yG + 1.86],
      ], -0.02, 0.1, p.accent);
      k.box(S.trim, half - 0.62, half + 0.62, yG + 0.15, yG + 0.32, fG - 0.06, fG, p.accent);
      panels(0.72, Math.min(1, half - 1.2), yG + 0.22);
      break;
    case 'lattice': {
      // A deep base board, a pair of windows under a fanlight, lattice either side.
      k.box(S.trim, 0.1, W - 0.1, yG + 0.12, yG + 0.44, fG - 0.06, fG, p.trim);
      k.box(S.trim, 0.25, W - 0.25, yG + 0.25, yG + 0.31, fG - 0.08, fG - 0.06, p.accent);
      sashWindow(k, FR, half - 0.62, half - 0.06, yG + 0.66, yG + 1.45, p, { hood: 'none' });
      sashWindow(k, FR, half + 0.06, half + 0.62, yG + 0.66, yG + 1.45, p, { hood: 'none' });
      sunburst(k, S.trim, FR, half, yG + 1.6, 0.76, 0, Math.PI, 8, 0.01, p.trim, p.trim);
      sunburst(k, S.trim, FR, half, yG + 1.6, 0.62, 0, Math.PI, 8, 0.02, p.pick, shade(p.pick, 0.86));
      for (const s of [-1, 1]) {
        const ui = half + s * 0.84;
        const y0 = yG + 0.56;
        const uo = s < 0 ? (y0 - yG + 0.3) / slope : W - (y0 - yG + 0.3) / slope;
        const tri: P2[] = [
          [uo, y0],
          [ui, y0],
          [ui, rakeY(ui) - 0.3],
        ];
        k.fprism(S.trim, FR, tri, 0, 0.03, p.trim);
        const inner = inset(tri, 0.05);
        for (let i = Math.floor(Math.min(uo, ui) / 0.1); i * 0.1 < Math.max(uo, ui); i++) {
          for (let j = 0; y0 + j * 0.1 < rakeY(ui); j++) {
            if ((i + j) % 2) continue;
            const d = diamond(i * 0.1, y0 + j * 0.1, 0.056);
            if (d.every(([x, y]) => inTri(inner, x, y))) k.flat(S.trim, FR, d, 0.035, p.accent);
          }
        }
      }
      break;
    }
  }
  if (q.sunburst) sunburst(k, S.trim, FR, half, yA - 0.14, 0.95, Math.PI + ang + 0.14, 2 * Math.PI - ang - 0.14, 7, 0.02, p.pick, p.trim);
  if (q.gable === 'lattice') {
    // 710's bargeboards have a sawtooth fringe: teeth hung under them, `d` along a rake from its
    // foot and `off` in from it.
    const edge = (s: number, d: number, off: number): P2 => {
      const u = d * cs + off * sn;
      return [s < 0 ? u : W - u, yG + d * sn - off * cs];
    };
    const n = Math.floor(L / 0.2);
    for (const s of [-1, 1]) {
      for (let i = 1; i < n; i++) {
        const d = (i / n) * L;
        k.flat(S.trim, front(wr0), [edge(s, d - L / n / 2, 0.2), edge(s, d + L / n / 2, 0.2), edge(s, d, 0.3)], 0.03, p.trim);
      }
    }
  }

  // --- A chimney, and windows down the side walls at the ends of the row.
  const chU = hi ? W - 0.72 : 0.72;
  const chW = D - 2.8;
  const chTop = yA - 0.35;
  k.box(k.roofs, chU - 0.27, chU + 0.27, yG, chTop, chW - 0.33, chW + 0.33, '#94483a');
  k.box(k.roofs, chU - 0.33, chU + 0.33, chTop, chTop + 0.12, chW - 0.39, chW + 0.39, '#5e3a31');
  const side = (f: Face, a: number[]): void => {
    clapboards(k, f, 0, D - Fd, yb - 0.25, yF, p.body, 0.3);
    for (const x of a) {
      sashWindow(k, f, x - 0.4, x + 0.4, yb + 0.55, yb + 2.3, p);
      sashWindow(k, f, x - 0.4, x + 0.4, y2 + 0.45, y2 + 2.15, p);
    }
  };
  if (ends.first) side({ u: 0.1, w: D, du: 0, dw: -1 }, [2.2, 4.9]);
  if (ends.last) side({ u: W - 0.1, w: Fd, du: 0, dw: 1 }, [2.2, 4.9]);
  k.done();
}

/** A panelled garage door (two leaves, a row of lights across the top) set in the basement's front
 *  at w, the opening [g0, g1] x [y0, y1]. */
function garageDoor(k: Kit, g0: number, g1: number, y0: number, y1: number, w: number, p: Paint): void {
  const S = k.S;
  const f = front(w + 0.14);
  k.box(S.trim, g0 - 0.13, g0, y0, y1 + 0.13, w - 0.04, w + 0.16, p.trim);
  k.box(S.trim, g1, g1 + 0.13, y0, y1 + 0.13, w - 0.04, w + 0.16, p.trim);
  k.box(S.trim, g0 - 0.13, g1 + 0.13, y1, y1 + 0.13, w - 0.04, w + 0.16, p.trim);
  k.fbox(S.trim, f, g0, g1, y0, y1, 0, 0.02, shade(p.body, 0.7));
  const gm = (g0 + g1) / 2;
  k.fbox(S.trim, f, gm - 0.03, gm + 0.03, y0, y1, 0.02, 0.05, p.trim);
  k.fbox(S.glass, f, g0 + 0.1, g1 - 0.1, y1 - 0.44, y1 - 0.14, 0.02, 0.03, '#ffffff');
  const ph = (y1 - 0.62 - y0) / 2;
  for (const [a0, a1] of [
    [g0 + 0.1, gm - 0.07],
    [gm + 0.07, g1 - 0.1],
  ]) {
    for (let i = 1; i < 3; i++) {
      const a = a0 + ((a1 - a0) * i) / 3;
      k.fbox(S.trim, f, a - 0.02, a + 0.02, y1 - 0.44, y1 - 0.14, 0.02, 0.04, p.trim);
    }
    for (let r = 0; r < 2; r++) k.fbox(S.trim, f, a0 + 0.04, a1 - 0.04, y0 + 0.18 + r * ph, y0 + 0.18 + (r + 1) * ph - 0.14, 0.02, 0.045, shade(p.body, 0.82));
  }
}

/** 722, the big corner house at Grove: siding downstairs and fish-scale shingles up, a turret over
 *  the bay by 720 (the frontage's start), the front door and its iron-railed stairs, a bay with a
 *  balcony at the corner, a running scroll under the eaves and a hipped roof; on its Grove side
 *  (the frontage's far end) a cross gable and a bay at the back. */
function cornerLady(ctx: Ctx, lot: Lot): void {
  const k = new Kit(ctx, lot, steinerWalk(ctx));
  const S = k.S;
  const p = NAVY;
  const W = lot.W;
  const D = DEPTH;
  const yb = Math.max(k.walk(0.3), k.walk(W - 0.3)) + 2.3;
  const y2 = yb + 3.2;
  const yF = y2 + 3.0;
  const yE = yF + 0.62;
  const F = 3.8;
  // The Grove side stands in from the lot's end so its bay at the back stays on the lot.
  const uN = W - 0.55;
  const yFound = Math.min(k.walk(0.3), k.walk(W - 0.3), k.ground(uN + 0.3, F), k.ground(uN + 0.3, D), k.ground(0.1, D)) - 0.8;
  const FF = front(F);
  const GS: Face = { u: uN, w: F, du: 0, dw: 1 };
  const gl = D - F;
  const r2 = Math.SQRT1_2;
  // Across the front (laid out for its 8.4 m lot): the turret, the door, the bay at the corner.
  const sx = W / 8.4;
  const ud = 4.78 * sx;

  // --- The raised basement (drawn back under the landing), the house on it.
  const base = '#2e3645';
  k.box(S.walls, 0.1, ud - 0.75, yFound, yb - 0.2, F - 0.95, D, base);
  k.box(S.walls, ud + 0.75, uN, yFound, yb - 0.2, F - 0.95, D, base);
  k.box(S.walls, ud - 0.75, ud + 0.75, yFound, yb - 0.2, F - 0.55, D, base);
  k.box(S.trim, 0.06, uN + 0.04, yb - 0.36, yb - 0.2, F - 0.5, D + 0.02, p.trim);
  k.rbox(S.walls, 0.1, uN, yb - 0.25, y2 - 0.1, F, D, 0.08, p.body);
  k.rbox(S.walls, 0.1, uN, y2 - 0.1, yE, F, D, 0.08, SHINGLES);
  k.box(S.trim, 0.06, uN + 0.04, y2 - 0.26, y2 - 0.06, F - 0.06, D + 0.02, p.trim);
  for (const cu of [0.1, uN]) k.box(S.trim, cu - 0.08, cu + 0.08, yb - 0.25, yF, F - 0.08, F + 0.08, p.trim);

  // --- The turret: an octagon standing out of the front by 720, its windows, its bands, its cone.
  const R = 1.5 * Math.min(1, sx);
  const uc = 1.78 * sx;
  const wc = F + 0.25;
  const oct = (r: number, y0: number, y1: number): THREE.BufferGeometry => faceted(new THREE.CylinderGeometry(r, r, y1 - y0, 8, 1, false, Math.PI / 8).translate(uc, (y0 + y1) / 2, wc));
  k.add(S.walls, oct(R, yb - 0.25, y2 - 0.1), p.body);
  k.add(S.walls, oct(R, y2 - 0.1, yE), SHINGLES);
  k.add(S.trim, oct(R + 0.12, yb - 0.46, yb - 0.22), p.trim);
  k.add(S.trim, oct(R + 0.05, yb + 2.62, y2 - 0.26), GARLAND);
  k.add(S.trim, oct(R + 0.08, y2 - 0.26, y2 - 0.06), p.trim);
  k.add(S.trim, oct(R + 0.06, yF - 0.02, yF + 0.06), p.trim);
  k.add(S.trim, oct(R + 0.36, yE - 0.2, yE + 0.02), p.accent);
  k.add(k.roofs, new THREE.ConeGeometry(R + 0.48, 4.9, 8, 1, false, Math.PI / 8).translate(uc, yE + 2.47, wc), p.roof);
  finial(k, uc, yE + 4.92, wc, 1.2, p);
  const cR = Math.cos(Math.PI / 8) * R;
  const sR = Math.sin(Math.PI / 8) * R;
  const tl = 2 * sR;
  const turretFaces: Face[] = [
    { u: uc - cR, w: wc - sR, du: r2, dw: -r2 },
    { u: uc - sR, w: wc - cR, du: 1, dw: 0 },
    { u: uc + sR, w: wc - cR, du: r2, dw: r2 },
  ];
  for (const f of turretFaces) {
    sashWindow(k, f, 0.24, tl - 0.24, yb + 0.5, yb + 2.4, p, { hood: 'none', drapes: true });
    sashWindow(k, f, 0.24, tl - 0.24, y2 + 0.32, y2 + 2.25, p, { hood: 'none' });
    swags(k, f, 0.08, tl - 0.08, y2 - 0.33, 2, 0.13, 0.06, p.pick);
    scrollBand(k, S.trim, f, 0.05, tl - 0.05, yF + 0.1, yE - 0.24, 0.015, p.pick);
  }

  // --- The front door under a pediment, a little window beside it, the landing and the stairs.
  k.fbox(S.trim, FF, ud - 0.62, ud + 0.62, yb, yb + 2.95, -0.03, 0.07, p.trim);
  k.fbox(S.trim, FF, ud - 0.48, ud + 0.48, yb, yb + 2.3, 0, 0.09, GARLAND);
  k.fbox(S.glass, FF, ud - 0.3, ud + 0.3, yb + 1.2, yb + 2.0, 0, 0.1, '#ffffff');
  k.fbox(S.glass, FF, ud - 0.48, ud + 0.48, yb + 2.4, yb + 2.82, 0, 0.02, '#ffffff');
  k.fbox(S.trim, FF, ud - 0.8, ud + 0.8, yb + 2.95, yb + 3.07, -0.03, 0.5, p.trim);
  k.fprism(S.trim, FF, [
    [ud - 0.82, yb + 3.07],
    [ud + 0.82, yb + 3.07],
    [ud, yb + 3.42],
  ], 0, 0.48, p.accent);
  for (const s of [-1, 1]) k.fbox(S.trim, FF, ud + s * 0.7 - 0.06, ud + s * 0.7 + 0.06, yb + 2.45, yb + 2.95, 0, 0.4, p.trim);
  sashWindow(k, FF, ud - 1.36, ud - 0.86, yb + 0.95, yb + 1.95, p);
  k.box(S.concrete, ud - 0.75, ud + 0.75, yb - 0.2, yb, F - 0.55, F, STEP2);
  const walkS = k.walk(ud);
  const top = F - 0.55;
  const bot = 0.3;
  const st = stairs(k, S.concrete, ud - 0.66, ud + 0.66, yb, top, bot, walkS, [STEP, STEP2]);
  const beta = Math.atan2(yb - walkS - st.rise, top - bot);
  const rl = Math.hypot(top - bot, yb - walkS - st.rise);
  for (const su of [ud - 0.7, ud + 0.7]) {
    k.obox(S.metal, [su, (yb + walkS + st.rise) / 2 + 0.92, (top + bot) / 2], [0.05, 0.06, rl + 0.12], [-beta, 0, 0], IRON);
    for (let i = 0; i < st.n; i += 2) {
      const w = top - i * st.run;
      const y = yb - i * st.rise;
      k.box(S.metal, su - 0.016, su + 0.016, y, y + 0.92, w - 0.016, w + 0.016, IRON);
    }
    k.box(S.metal, su - 0.045, su + 0.045, walkS, walkS + st.rise + 1.05, bot - 0.05, bot + 0.05, IRON);
    k.add(S.metal, ball(0.07, su, walkS + st.rise + 1.1, bot), IRON);
  }

  // --- The bay at the corner: a picture window, garlands on burgundy, a balcony on its roof.
  const q0 = 5.5 * sx;
  const q1 = uN - 0.18;
  const qf = F - 0.9;
  const qt = y2 - 0.72;
  k.box(S.walls, q0, q1, yb - 0.25, qt, qf, F + 0.05, p.body);
  k.box(S.trim, q0 - 0.1, q1 + 0.1, yb - 0.46, yb - 0.22, qf - 0.1, F, p.trim);
  const QF = front(qf);
  sashWindow(k, QF, q0 + 0.36, q1 - 0.36, yb + 0.45, yb + 2.4, p, { hood: 'none', transom: true, drapes: true });
  const QS: Face = { u: q0, w: F, du: 0, dw: -1 };
  const QN: Face = { u: q1, w: qf, du: 0, dw: 1 };
  for (const f of [QS, QN]) sashWindow(k, f, 0.22, 0.68, yb + 0.6, yb + 2.4, p, { hood: 'none' });
  for (const cu of [q0, q1]) k.box(S.trim, cu - 0.1, cu + 0.1, yb - 0.25, qt, qf - 0.07, qf + 0.13, p.trim);
  k.box(S.trim, q0 - 0.04, q1 + 0.04, qt, y2 - 0.36, qf - 0.04, F, GARLAND);
  swags(k, QF, q0 + 0.12, q1 - 0.12, y2 - 0.42, 4, 0.15, 0.05, p.pick);
  k.box(S.trim, q0 - 0.18, q1 + 0.18, y2 - 0.36, y2 - 0.12, qf - 0.18, F, p.trim);
  balustrade(k, QF, q0 - 0.05, q1 + 0.05, y2 - 0.12, 0.78, p);
  balustrade(k, QS, 0.12, 0.84, y2 - 0.12, 0.78, p);
  balustrade(k, QN, 0.06, 0.78, y2 - 0.12, 0.78, p);
  for (const cu of [q0 - 0.05, q1 + 0.05]) {
    k.add(S.trim, ball(0.11, cu, y2 + 0.84, qf), p.trim);
    k.add(S.trim, spike(0.05, 0.28, cu, y2 + 0.9, qf), p.trim);
  }

  // --- Upstairs at the front: a window over the corner bay, fish-scale shingles either side.
  const uq = (q0 + q1) / 2;
  sashWindow(k, FF, uq - 0.45, uq + 0.45, y2 + 0.32, y2 + 2.25, p, { hood: 'pediment' });
  fishScales(k, S.walls, FF, uc + cR + 0.06, uq - 0.7, y2 + 0.02, yF - 0.04, 0.012, SCALES, 0.17);
  fishScales(k, S.walls, FF, uq + 0.7, uN - 0.04, y2 + 0.02, yF - 0.04, 0.012, SCALES, 0.17);

  // --- The Grove side: windows under a cross gable, a bay at the back, a door in the basement.
  for (const a of [1.25, 3.05]) {
    sashWindow(k, GS, a - 0.4, a + 0.4, yb + 0.5, yb + 2.4, p);
    sashWindow(k, GS, a - 0.4, a + 0.4, y2 + 0.32, y2 + 2.2, p, { hood: 'pediment' });
  }
  sashWindow(k, GS, 4.55, 5.15, yb + 1.1, yb + 2.0, p);
  sashWindow(k, GS, 4.55, 5.15, y2 + 1.0, y2 + 1.9, p);
  const clear = (a: number, y: number): boolean => !(y > y2 + 0.1 && y < y2 + 2.95 && [1.25, 3.05, 4.85].some((x) => Math.abs(a - x) < (x > 4 ? 0.62 : 0.72)));
  fishScales(k, S.walls, GS, 0.12, 5.5, y2 + 0.02, yF - 0.04, 0.012, SCALES, 0.17, clear);
  const rb0 = 5.75;
  const rb1 = gl - 0.25;
  k.box(S.walls, uN - 0.02, uN + 0.5, yb - 0.25, y2 - 0.1, F + rb0, F + rb1, p.body);
  k.box(S.walls, uN - 0.02, uN + 0.5, y2 - 0.1, yF + 0.2, F + rb0, F + rb1, SHINGLES);
  k.box(S.walls, uN - 0.02, uN + 0.5, yFound, yb - 0.2, F + rb0, F + rb1, base);
  k.box(S.trim, uN - 0.02, uN + 0.62, yF + 0.2, yF + 0.42, F + rb0 - 0.22, F + rb1 + 0.22, p.accent);
  k.add(k.roofs, new THREE.ConeGeometry(1.95, 1.1, 4, 1, false, Math.PI / 4).scale(0.52, 1, 1).translate(uN + 0.28, yF + 0.97, F + (rb0 + rb1) / 2), p.roof);
  const RB: Face = { u: uN + 0.5, w: F + rb0, du: 0, dw: 1 };
  for (const a of [0.5, rb1 - rb0 - 0.5]) {
    sashWindow(k, RB, a - 0.3, a + 0.3, yb + 0.55, yb + 2.4, p, { hood: 'none' });
    sashWindow(k, RB, a - 0.3, a + 0.3, y2 + 0.35, y2 + 2.2, p, { hood: 'none' });
  }
  const gy = Math.min(k.ground(uN + 0.4, F + 2.3), k.ground(uN + 0.4, F + 3.8)) + 0.16;
  k.fbox(S.trim, GS, 2.2, 3.8, gy, yb - 0.5, -0.02, 0.06, p.trim);
  k.fbox(S.trim, GS, 2.32, 3.68, gy, yb - 0.62, 0.06, 0.08, '#262d3a');
  sashWindow(k, GS, 0.8, 1.35, yb - 1.35, yb - 0.75, p, { hood: 'none' });
  crossGable(k, uN, F + 0.35, F + 3.95, yE, 2.7, p);

  // --- The eaves: a running scroll on the shingles, a cornice on modillions; the hipped roof.
  scrollBand(k, S.trim, FF, uc + cR + 0.1, uN - 0.05, yF + 0.1, yE - 0.24, 0.015, p.pick);
  scrollBand(k, S.trim, GS, 0.15, rb0 - 0.1, yF + 0.1, yE - 0.24, 0.015, p.pick);
  k.box(S.trim, 0.06, uN + 0.04, yF - 0.02, yF + 0.06, F - 0.04, D + 0.02, p.trim);
  k.box(S.trim, 0.04, uN + 0.36, yE - 0.22, yE + 0.02, F - 0.4, D + 0.12, p.accent);
  for (let u = uc + cR + 0.2; u < uN; u += 0.55) k.box(S.trim, u - 0.05, u + 0.05, yE - 0.36, yE - 0.22, F - 0.34, F, p.trim);
  for (let a = 0.3; a < gl; a += 0.55) k.box(S.trim, uN, uN + 0.3, yE - 0.36, yE - 0.22, F + a - 0.05, F + a + 0.05, p.trim);
  hipRoof(k, k.roofs, 0.04, uN + 0.3, F - 0.36, D + 0.1, yE + 0.02, 4.3, p.roof);
  k.box(k.roofs, 2.9, 3.5, yE + 1.2, yE + 4.6, D - 3.2, D - 2.5, '#9c4a3c');
  k.box(k.roofs, 2.84, 3.56, yE + 4.6, yE + 4.74, D - 3.26, D - 2.44, '#5c3a33');

  // --- A low iron fence round the front garden, shrubs behind it.
  ironFence(k, 0.22, ud - 0.82, 0.24);
  ironFence(k, ud + 0.82, W - 0.22, 0.24);
  for (const [u0, u1] of [
    [0.3, ud - 0.9],
    [ud + 0.9, W - 0.3],
  ]) {
    k.prism(S.concrete, [
      [u0, k.walk(u0) + 0.12, 0.02],
      [u1, k.walk(u1) + 0.12, 0.02],
      [u1, yFound, 0.02],
      [u0, yFound, 0.02],
    ], [0, 0, F - 0.97], '#5a4a3b');
  }
  for (const [u, w, r] of [
    [1.0, 1.35, 0.62],
    [2.5, 1.2, 0.5],
    [6.2, 1.25, 0.66],
    [7.6, 1.45, 0.5],
  ]) {
    const y = k.walk(u) + 0.1;
    k.rbox(S.hedge, u - r, u + r, y, y + r * 1.5, w - r * 0.8, w + r * 0.8, r * 0.45, '#5b8249');
  }
  k.done();
}

/** A cross gable on the side of a hipped roof, its face at u = uF over [w0, w1], rising h from y:
 *  its shingled field, bargeboards, a window and a finial. */
function crossGable(k: Kit, uF: number, w0: number, w1: number, y: number, h: number, p: Paint): void {
  const S = k.S;
  const wm = (w0 + w1) / 2;
  const hw = (w1 - w0) / 2;
  const dep = 3.8;
  k.prism(S.walls, [
    [uF + 0.02, y - 0.2, w0],
    [uF + 0.02, y - 0.2, w1],
    [uF + 0.02, y + h, wm],
  ], [-dep, 0, 0], SHINGLES);
  const ang = Math.atan2(h + 0.2, hw);
  const cs = Math.cos(ang);
  const sn = Math.sin(ang);
  const L = Math.hypot(hw, h + 0.2);
  const t = 0.14;
  const eo = 0.3;
  const u0 = uF + 0.42;
  const u1 = uF - dep;
  const slab = (off: number): P2 => [(w0 - eo * cs + wm) / 2 - off * sn, (y - 0.2 - eo * sn + y + h) / 2 + off * cs];
  for (const s of [-1, 1]) {
    const mw = (w: number): number => wm + s * (wm - w);
    const [sw, sy] = slab(t / 2);
    k.obox(k.roofs, [(u0 + u1) / 2, sy, mw(sw)], [u0 - u1, t, L + eo], [s * ang, 0, 0], p.roof);
    const [fw, fy] = slab(t - 0.16);
    k.obox(S.trim, [u0 - 0.02, fy, mw(fw)], [0.1, 0.32, L + eo], [s * ang, 0, 0], p.trim);
    k.obox(S.trim, [u0 + 0.04, fy, mw(fw)], [0.02, 0.06, L + eo - 0.14], [s * ang, 0, 0], p.accent);
  }
  finial(k, u0 - 0.02, y + h + 0.05, wm, 1.0, p);
  const GF: Face = { u: uF + 0.02, w: w0, du: 0, dw: 1 };
  sashWindow(k, GF, hw - 0.36, hw + 0.36, y + 0.25, y + 1.2, p, { hood: 'pediment' });
  const slope = (h + 0.2) / hw;
  fishScales(k, S.walls, GF, 0.1, 2 * hw - 0.1, y + 1.62, y + h - 0.25, 0.012, SCALES, 0.13, (a, yy) => yy + 0.1 < y - 0.2 + Math.min(a - 0.13, 2 * hw - a - 0.13) * slope - 0.18);
  scrollBand(k, S.trim, GF, 0.35, 2 * hw - 0.35, y - 0.12, y + 0.14, 0.015, p.pick);
}

/** A low iron fence along the sidewalk from u0 to u1, at w: posts, rails, pickets. */
function ironFence(k: Kit, u0: number, u1: number, w: number): void {
  const S = k.S;
  const h = 0.95;
  const y0 = k.walk(u0);
  const y1 = k.walk(u1);
  const len = u1 - u0;
  const tilt = Math.atan2(y1 - y0, len);
  for (const dy of [0.1, h - 0.05]) k.obox(S.metal, [(u0 + u1) / 2, (y0 + y1) / 2 + dy, w], [Math.hypot(len, y1 - y0), 0.035, 0.035], [0, 0, tilt], IRON);
  const f = front(w);
  const n = Math.max(2, Math.round(len / 0.13));
  for (let i = 0; i <= n; i++) {
    const u = u0 + (len * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    if (i % 8 === 0 || i === n) {
      k.box(S.metal, u - 0.04, u + 0.04, y - 0.05, y + h + 0.1, w - 0.04, w + 0.04, IRON);
      k.add(S.metal, ball(0.05, u, y + h + 0.14, w), IRON);
    } else {
      k.flat(S.metal, f, [
        [u - 0.013, y],
        [u + 0.013, y],
        [u + 0.013, y + h + 0.06],
        [u - 0.013, y + h + 0.06],
      ], 0.02, IRON);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The Archbishop's Mansion.

const MANSION: Paint = { body: '#e3d6ba', trim: '#fbf8f0', accent: '#d2c4a6', pick: '#b89452', sash: '#4a3a2e', roof: '#3f4652' };
const LIMESTONE = '#cbc0a9';

/** The Archbishop's Mansion (1000 Fulton, 1904): a grand Second Empire house of two tall floors over
 *  a rusticated base, under a mansard roof with dormers; a porch of Ionic columns with a balcony on
 *  it before the central pavilion (which rises higher), two-storey bays either side, quoins, a
 *  bracketed cornice, facing south across Fulton to the park. (x, z) is its southeast corner at the
 *  property line; it extends west and north. */
export function archbishopsMansion(ctx: Ctx, x: number, z: number): void {
  const Wd = 17;
  const D = 15.5;
  ctx.occ.claim([
    [x - Wd - 1, z + 0.5],
    [x + 0.5, z + 0.5],
    [x + 0.5, z - D - 0.5],
    [x - Wd - 1, z - D - 0.5],
  ]);
  // Its frame runs west along Fulton from the corner (u), and north away from it (w).
  const k = new Kit(ctx, { ox: x, oz: z, ux: -1, uz: 0, W: Wd }, fultonWalk(ctx));
  const S = k.S;
  const p = MANSION;
  const yb = Math.max(k.walk(0.5), k.walk(Wd - 0.5)) + 1.7;
  const y2 = yb + 4;
  const yC = y2 + 3.6;
  const yM = yC + 0.5;
  const yT = yM + 3.1;
  const F = 5;
  const yFound = Math.min(k.walk(0.5), k.walk(Wd - 0.5), k.ground(0.3, D), k.ground(Wd - 0.3, D)) - 0.8;
  const FF = front(F);
  const EF: Face = { u: 0.3, w: D - 0.1, du: 0, dw: -1 };
  const pv0 = 6.4;
  const pv1 = Wd - 6.4;
  const pf = F - 0.5;
  const po0 = pv0 - 0.7;
  const po1 = pv1 + 0.7;
  const pw = pf - 1.8;

  // --- A rusticated stone base, the two floors on it, quoins, a belt course between them.
  k.box(S.stone, 0.2, Wd - 0.2, yFound, yb, F - 0.15, D, LIMESTONE);
  for (let y = yb - 0.42; y > yFound + 0.3; y -= 0.42) k.box(S.stone, 0.16, Wd - 0.16, y - 0.035, y, F - 0.19, D + 0.04, '#b1a58f');
  k.rbox(S.walls, 0.3, Wd - 0.3, yb - 0.05, yC, F, D - 0.1, 0.1, p.body);
  k.box(S.walls, pv0, pv1, yb - 0.05, yC, pf, F + 0.1, p.body);
  k.box(S.trim, 0.22, Wd - 0.22, y2 - 0.14, y2 + 0.12, F - 0.1, D, p.trim);
  k.box(S.trim, pv0 - 0.08, pv1 + 0.08, y2 - 0.14, y2 + 0.12, pf - 0.1, F, p.trim);
  const quoins = (u: number, s: number, w: number, deep: boolean): void => {
    for (let i = 0, y = yb; y < yC - 0.3; i++, y += 0.4) {
      const l = i % 2 ? 0.34 : 0.62;
      k.box(S.trim, s < 0 ? u - 0.06 : u - l, s < 0 ? u + l : u + 0.06, y + 0.03, y + 0.37, w - 0.06, deep ? w + l : w + 0.1, p.trim);
    }
  };
  quoins(0.3, -1, F, true);
  quoins(Wd - 0.3, 1, F, true);
  quoins(pv0, -1, pf, false);
  quoins(pv1, 1, pf, false);

  // --- Two-storey bays either side of the pavilion.
  const r2 = Math.SQRT1_2;
  const dB = 0.9;
  for (const [b0, b1] of [
    [1.0, 4.4],
    [Wd - 4.4, Wd - 1.0],
  ]) {
    const foot = (y: number, o: number): V3[] => [
      [b0 - o * Math.SQRT2, y, F + 0.02],
      [b0 + dB - o * (Math.SQRT2 - 1), y, F - dB - o],
      [b1 - dB + o * (Math.SQRT2 - 1), y, F - dB - o],
      [b1 + o * Math.SQRT2, y, F + 0.02],
    ];
    k.prism(S.stone, foot(yFound, 0.04), [0, yb - yFound, 0], LIMESTONE);
    k.prism(S.walls, foot(yb - 0.05, 0), [0, yC - yb + 0.05, 0], p.body);
    k.prism(S.trim, foot(y2 - 0.14, 0.08), [0, 0.26, 0], p.trim);
    const faces: [Face, number][] = [
      [{ u: b0, w: F, du: r2, dw: -r2 }, dB * Math.SQRT2],
      [{ u: b0 + dB, w: F - dB, du: 1, dw: 0 }, b1 - b0 - 2 * dB],
      [{ u: b1 - dB, w: F - dB, du: r2, dw: r2 }, dB * Math.SQRT2],
    ];
    for (const [f, len] of faces) {
      const i = len > 1.4 ? 0.3 : 0.24;
      plainWindow(k, f, i, len - i, yb + 0.7, yb + 3.2, p, len > 1.4 ? 'pediment' : 'cornice');
      plainWindow(k, f, i, len - i, y2 + 0.55, y2 + 2.85, p, 'cornice');
    }
  }

  // --- The windows between, and down the Steiner side.
  for (const u of [5.2, Wd - 5.2]) {
    plainWindow(k, FF, u - 0.42, u + 0.42, yb + 0.7, yb + 3.2, p, 'pediment');
    plainWindow(k, FF, u - 0.42, u + 0.42, y2 + 0.55, y2 + 2.85, p, 'cornice');
  }
  for (const a of [1.7, 4.3, 6.9, 9.5]) {
    plainWindow(k, EF, a - 0.48, a + 0.48, yb + 0.7, yb + 3.2, p, 'pediment');
    plainWindow(k, EF, a - 0.48, a + 0.48, y2 + 0.55, y2 + 2.85, p, 'cornice');
  }

  // --- The pavilion: the doorcase, and a pair of windows over the porch.
  const PF = front(pf);
  const um = Wd / 2;
  k.fbox(S.trim, PF, um - 1.15, um + 1.15, yb, yb + 3.55, -0.03, 0.1, p.trim);
  k.fbox(S.trim, PF, um - 0.88, um + 0.88, yb, yb + 2.85, 0.1, 0.13, p.sash);
  for (const s of [-1, 1]) k.fbox(S.glass, PF, um + s * 0.47 - 0.3, um + s * 0.47 + 0.3, yb + 1.25, yb + 2.55, 0.13, 0.15, '#ffffff');
  k.fbox(S.glass, PF, um - 0.88, um + 0.88, yb + 2.95, yb + 3.42, 0.1, 0.12, '#ffffff');
  for (const s of [-1, 1]) plainWindow(k, PF, um + s * 1.62 - 0.26, um + s * 1.62 + 0.26, yb + 0.6, yb + 2.85, p, 'none');
  for (const s of [-1, 1]) plainWindow(k, PF, um + s * 0.78 - 0.48, um + s * 0.78 + 0.48, y2 + 0.55, y2 + 2.9, p, 'pediment');

  // --- The porch: Ionic columns on plinths, the entablature, a balustraded balcony on top.
  k.box(S.stone, po0, po1, yFound, yb - 0.1, pw, pf, LIMESTONE);
  k.box(S.trim, po0 - 0.05, po1 + 0.05, yb - 0.14, yb + 0.02, pw - 0.06, pf, '#dcd5c7');
  for (const cu of [po0 + 0.32, po0 + 1.9, po1 - 1.9, po1 - 0.32]) {
    k.box(S.trim, cu - 0.26, cu + 0.26, yb, yb + 0.32, pw + 0.06, pw + 0.58, p.trim);
    k.cyl(S.trim, [cu, yb + 0.32, pw + 0.32], [cu, y2 - 0.78, pw + 0.32], 0.17, 0.2, 12, p.trim);
    k.box(S.trim, cu - 0.3, cu + 0.3, y2 - 0.78, y2 - 0.62, pw + 0.02, pw + 0.62, p.trim);
    for (const s of [-1, 1]) k.cyl(S.trim, [cu + s * 0.24, y2 - 0.7, pw], [cu + s * 0.24, y2 - 0.7, pw + 0.64], 0.08, 0.08, 8, p.pick);
  }
  k.box(S.trim, po0, po1, y2 - 0.62, y2 - 0.08, pw - 0.02, pf, p.trim);
  k.box(S.trim, po0 + 0.1, po1 - 0.1, y2 - 0.48, y2 - 0.24, pw - 0.05, pw - 0.02, p.accent);
  k.box(S.trim, po0 - 0.12, po1 + 0.12, y2 - 0.08, y2 + 0.08, pw - 0.14, pf, p.trim);
  balustrade(k, front(pw - 0.05), po0 - 0.02, po1 + 0.02, y2 + 0.08, 0.9, p, 0.22);
  balustrade(k, { u: po0 - 0.02, w: pf, du: 0, dw: -1 }, 0, pf - pw, y2 + 0.08, 0.9, p, 0.22);
  balustrade(k, { u: po1 + 0.02, w: pw, du: 0, dw: 1 }, 0, pf - pw, y2 + 0.08, 0.9, p, 0.22);
  const walkS = k.walk(um);
  stairs(k, S.stone, um - 1.9, um + 1.9, yb, pw - 0.02, 0.38, walkS, ['#d8d0bf', '#ccc4b3']);
  for (const s of [-1, 1]) {
    const cu = um + s * 2.15;
    k.prism(S.stone, [
      [cu - 0.25, yb + 0.35, pw],
      [cu - 0.25, walkS + 0.75, 0.3],
      [cu - 0.25, walkS - 0.25, 0.3],
      [cu - 0.25, walkS - 0.25, pw],
    ], [0.5, 0, 0], LIMESTONE);
    k.box(S.stone, cu - 0.32, cu + 0.32, walkS - 0.25, walkS + 1.0, 0.1, 0.74, LIMESTONE);
    k.add(S.stone, ball(0.22, cu, walkS + 1.2, 0.42), LIMESTONE);
  }
  // A low stone wall along the sidewalk.
  for (const [u0, u1] of [
    [0.3, um - 2.5],
    [um + 2.5, Wd - 0.3],
  ]) {
    k.prism(S.stone, [
      [u0, k.walk(u0) + 0.55, 0.15],
      [u1, k.walk(u1) + 0.55, 0.15],
      [u1, k.walk(u1) - 0.3, 0.15],
      [u0, k.walk(u0) - 0.3, 0.15],
    ], [0, 0, 0.4], LIMESTONE);
  }

  // --- The bracketed cornice, the mansard with its dormers, the pavilion's taller roof.
  k.box(S.walls, 0.3, Wd - 0.3, yC - 0.62, yC - 0.1, F - 0.05, D - 0.1, shade(p.body, 0.95));
  k.box(S.trim, 0.05, Wd - 0.05, yC - 0.14, yC + 0.12, F - 0.4, D + 0.15, p.trim);
  k.box(S.trim, -0.1, Wd + 0.1, yC + 0.12, yM, F - 0.7, D + 0.3, p.trim);
  k.box(S.trim, pv0 - 0.25, pv1 + 0.25, yC - 0.14, yM + 0.02, pf - 0.7, F, p.trim);
  const bracketsAlong = (f: Face, a0: number, a1: number): void => {
    const n = Math.max(2, Math.round((a1 - a0) / 1.25));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      for (const s of [-1, 1]) k.fbox(S.trim, f, a + s * 0.12 - 0.05, a + s * 0.12 + 0.05, yC - 0.6, yC + 0.12, 0, 0.55, p.accent);
    }
  };
  bracketsAlong(FF, 0.6, pv0 - 0.5);
  bracketsAlong(FF, pv1 + 0.5, Wd - 0.6);
  bracketsAlong(front(pf), pv0 + 0.3, pv1 - 0.3);
  bracketsAlong(EF, 0.4, D - F - 0.4);
  mansard(k, k.roofs, 0.05, Wd - 0.05, F - 0.55, D + 0.2, yM, yT - yM, 0.95, p.roof);
  for (const [t0, t1] of [
    [0.32, 0.4],
    [0.66, 0.74],
  ]) {
    const e = 0.02;
    const h = yT - yM;
    mansard(k, k.roofs, 0.05 + 0.95 * t0 - e, Wd - 0.05 - 0.95 * t0 + e, F - 0.55 + 0.95 * t0 - e, D + 0.2 - 0.95 * t0 + e, yM + h * t0, h * (t1 - t0), 0.95 * (t1 - t0), '#525b69');
  }
  hipRoof(k, k.roofs, 1.0, Wd - 1.0, F + 0.4, D - 0.75, yT, 0.9, shade(p.roof, 0.9));
  mansard(k, k.roofs, pv0 - 0.25, pv1 + 0.25, pf - 0.62, F + 4.2, yM, 4.3, 0.8, p.roof);
  hipRoof(k, k.roofs, pv0 + 0.55, pv1 - 0.55, pf + 0.18, F + 3.4, yM + 4.3, 1.0, shade(p.roof, 0.9));
  for (const u of [pv0 + 0.55, pv1 - 0.55]) k.add(S.metal, spike(0.06, 0.7, u, yM + 4.3, pf + 0.18), IRON);
  // Cresting along the mansard's top.
  k.box(S.metal, 1.0, Wd - 1.0, yT, yT + 0.06, F + 0.37, F + 0.43, IRON);
  for (let u = 1.2; u < Wd - 1.0; u += 0.5) {
    if (u > pv0 - 0.3 && u < pv1 + 0.3) continue;
    k.flat(S.metal, front(F + 0.4), [
      [u - 0.05, yT + 0.06],
      [u + 0.05, yT + 0.06],
      [u, yT + 0.36],
    ], 0, IRON);
  }
  // Dormers: four across the front, the pavilion's big one, three down the Steiner side.
  const df = front(F - 0.3);
  for (const u of [2.7, 5.2, Wd - 5.2, Wd - 2.7]) dormer(k, df, u, yM + 0.25, 1.3, p);
  dormer(k, front(pf - 0.35), um, yM + 0.35, 1.9, p);
  const de: Face = { u: 0.35, w: D, du: 0, dw: -1 };
  for (const a of [3.0, 6.0, 9.0]) dormer(k, de, a, yM + 0.25, 1.3, p);
  // Chimneys.
  for (const u of [3.4, Wd - 3.4]) {
    k.box(k.roofs, u - 0.45, u + 0.45, yT - 0.6, yT + 2.3, D - 3.8, D - 2.9, '#9a5443');
    k.box(k.roofs, u - 0.52, u + 0.52, yT + 2.3, yT + 2.45, D - 3.87, D - 2.83, '#6c4034');
  }
  k.done();
}

/** A dormer standing out of a roof: its front on face f at `a` (from y, `wd` wide), a window, pilasters,
 *  a pediment. */
function dormer(k: Kit, f: Face, a: number, y: number, wd: number, p: Paint): void {
  const S = k.S;
  const a0 = a - wd / 2;
  const a1 = a + wd / 2;
  k.fbox(S.walls, f, a0, a1, y, y + 2.0, -1.4, 0, p.body);
  plainWindow(k, f, a0 + 0.24, a1 - 0.24, y + 0.3, y + 1.55, p, 'none');
  for (const e of [a0, a1]) k.fbox(S.trim, f, e - 0.08, e + 0.08, y, y + 1.82, -0.1, 0.1, p.trim);
  k.fbox(S.trim, f, a0 - 0.14, a1 + 0.14, y + 1.82, y + 1.98, -1.4, 0.15, p.trim);
  k.fprism(S.trim, f, [
    [a0 - 0.18, y + 1.98],
    [a1 + 0.18, y + 1.98],
    [a, y + 2.2 + wd * 0.2],
  ], -1.4, 0.15, p.trim);
}

// ---------------------------------------------------------------------------------------------
// The Westerfeld House.

const WESTERFELD: Paint = { body: '#141317', trim: '#6c1813', accent: '#4a120e', pick: '#c9a85a', sash: '#6c1813', roof: '#1f1e23' };

/** The Westerfeld House (1198 Fulton, 1889): a tall Stick-Eastlake Italianate, near-black with red
 *  trim and gold lines; three floors over a basement with red belt courses and stick-work, a bay on
 *  its east side, a bracketed cornice, and on the corner by Scott its square tower rising past the
 *  roof to a windowed belvedere under a pyramid. (x, z) is its southwest corner at the property line;
 *  it extends east and north, facing south onto Fulton and the park. */
export function westerfeldHouse(ctx: Ctx, x: number, z: number): void {
  const Wd = 12;
  const D = 14;
  ctx.occ.claim([
    [x - 0.5, z + 0.5],
    [x + Wd + 0.5, z + 0.5],
    [x + Wd + 0.5, z - D - 0.5],
    [x - 0.5, z - D - 0.5],
  ]);
  // Its frame runs west along Fulton from its southeast corner (u), and north away from it (w).
  const k = new Kit(ctx, { ox: x + Wd, oz: z, ux: -1, uz: 0, W: Wd }, fultonWalk(ctx));
  const S = k.S;
  const p = WESTERFELD;
  const yb = Math.max(k.walk(0.5), k.walk(Wd - 0.5)) + 1.9;
  const y2 = yb + 3.5;
  const y3 = y2 + 3.3;
  const yC = y3 + 3.0;
  const F = 4.6;
  const yFound = Math.min(k.walk(0.5), k.walk(Wd - 0.5), k.ground(0.3, D), k.ground(Wd - 0.3, D)) - 0.8;
  const FF = front(F);
  const t0 = 7.9;
  const t1 = Wd - 0.3;
  const tf = F - 1.0;
  const tw1 = F + 2.8;
  const yTw = yC + 3.1;

  // --- The basement, three floors, the tower on the corner by Scott. (Its near-black paint is matte:
  // the walls' sheen would grey it.)
  const matte = S.concrete;
  k.box(matte, 0.2, Wd - 0.2, yFound, yb, F - 0.1, D, '#2b2828');
  k.rbox(matte, 0.3, Wd - 0.3, yb - 0.05, yC, F, D - 0.1, 0.08, p.body);
  k.box(matte, t0, t1, yFound, yb, tf - 0.1, tw1, '#2b2828');
  k.rbox(matte, t0, t1, yb - 0.05, yTw, tf, tw1, 0.08, p.body);
  // Belt courses at every floor (red over a gold fillet), round the house and the tower.
  for (const y of [yb, y2, y3]) {
    k.box(S.trim, 0.22, Wd - 0.22, y - 0.2, y + 0.04, F - 0.08, D - 0.02, p.trim);
    k.box(S.trim, 0.24, Wd - 0.24, y - 0.26, y - 0.2, F - 0.06, D - 0.04, p.pick);
    k.box(S.trim, t0 - 0.08, t1 + 0.08, y - 0.2, y + 0.04, tf - 0.08, tw1 + 0.08, p.trim);
    k.box(S.trim, t0 - 0.06, t1 + 0.06, y - 0.26, y - 0.2, tf - 0.06, tw1 + 0.06, p.pick);
  }
  // Stick-work: boards up the corners.
  for (const [u, w] of [
    [0.3, F],
    [t0, tf],
    [t1, tf],
  ]) k.box(S.trim, u - 0.09, u + 0.09, yb, u === 0.3 ? yC : yTw, w - 0.09, w + 0.09, p.trim);

  // --- The bay on the east side of the front, three storeys.
  const r2 = Math.SQRT1_2;
  const b0 = 0.8;
  const b1 = 4.8;
  const dB = 0.9;
  const foot = (y: number, o: number): V3[] => [
    [b0 - o * Math.SQRT2, y, F + 0.02],
    [b0 + dB - o * (Math.SQRT2 - 1), y, F - dB - o],
    [b1 - dB + o * (Math.SQRT2 - 1), y, F - dB - o],
    [b1 + o * Math.SQRT2, y, F + 0.02],
  ];
  k.prism(matte, foot(yFound, 0.04), [0, yb - yFound, 0], '#2b2828');
  k.prism(matte, foot(yb - 0.05, 0), [0, yC - yb + 0.05, 0], p.body);
  for (const y of [y2, y3]) k.prism(S.trim, foot(y - 0.22, 0.07), [0, 0.26, 0], p.trim);
  const bayFaces: [Face, number][] = [
    [{ u: b0, w: F, du: r2, dw: -r2 }, dB * Math.SQRT2],
    [{ u: b0 + dB, w: F - dB, du: 1, dw: 0 }, b1 - b0 - 2 * dB],
    [{ u: b1 - dB, w: F - dB, du: r2, dw: r2 }, dB * Math.SQRT2],
  ];
  for (const [f, len] of bayFaces) {
    const i = len > 1.4 ? 0.34 : 0.26;
    for (const [y0, y1] of [
      [yb + 0.6, yb + 2.95],
      [y2 + 0.5, y2 + 2.75],
      [y3 + 0.45, y3 + 2.4],
    ]) {
      plainWindow(k, f, i, len - i, y0, y1, p, len > 1.4 ? 'pediment' : 'cornice');
      k.fbox(S.trim, f, 0.1, len - 0.1, y0 - 0.72, y0 - 0.2, -0.02, 0.03, p.accent);
      k.flat(S.trim, f, diamond(len / 2, y0 - 0.46, 0.14), 0.035, p.pick);
    }
  }

  // --- Windows across the middle, down the tower, and along the Scott side.
  for (const [y0, y1] of [
    [yb + 0.6, yb + 2.95],
    [y2 + 0.5, y2 + 2.75],
    [y3 + 0.45, y3 + 2.4],
  ]) {
    plainWindow(k, FF, 5.75, 6.75, y0, y1, p, 'pediment');
    k.fbox(S.trim, FF, 5.5, 5.62, y0 - 0.3, y1 + 0.5, 0, 0.08, p.trim);
    k.fbox(S.trim, FF, 6.88, 7.0, y0 - 0.3, y1 + 0.5, 0, 0.08, p.trim);
  }
  const TF = front(tf);
  const tm = (t0 + t1) / 2;
  // Stick-work: boards either side of a window from belt to belt, a panel with a diamond under it.
  const stick = (f: Face, a0: number, a1: number, y0: number, y1: number): void => {
    for (const a of [a0 - 0.22, a1 + 0.1]) k.fbox(S.trim, f, a, a + 0.12, y0 - 0.85, y1 + 0.55, 0, 0.08, p.trim);
    k.fbox(S.trim, f, a0 - 0.1, a1 + 0.1, y0 - 0.7, y0 - 0.2, -0.02, 0.03, p.accent);
    k.flat(S.trim, f, diamond((a0 + a1) / 2, y0 - 0.45, 0.13), 0.035, p.pick);
  };
  for (const [y0, y1] of [
    [y2 + 0.5, y2 + 2.75],
    [y3 + 0.45, y3 + 2.4],
  ]) {
    for (const s of [-1, 1]) plainWindow(k, TF, tm + s * 0.62 - 0.4, tm + s * 0.62 + 0.4, y0, y1, p, 'pediment');
    stick(TF, tm - 1.02, tm + 1.02, y0, y1);
  }
  const SF: Face = { u: Wd - 0.3, w: tw1, du: 0, dw: 1 };
  for (const a of [1.7, 4.3, 6.9]) {
    for (const [y0, y1] of [
      [yb + 0.6, yb + 2.95],
      [y2 + 0.5, y2 + 2.75],
      [y3 + 0.45, y3 + 2.4],
    ]) {
      plainWindow(k, SF, a - 0.45, a + 0.45, y0, y1, p, 'pediment');
      stick(SF, a - 0.45, a + 0.45, y0, y1);
    }
  }

  // --- The entrance in the tower's foot: the door, a hood on brackets, the stairs.
  k.fbox(S.trim, TF, tm - 0.85, tm + 0.85, yb, yb + 3.05, -0.03, 0.08, p.trim);
  k.fbox(S.trim, TF, tm - 0.62, tm + 0.62, yb, yb + 2.5, 0.08, 0.11, '#5a2a22');
  k.fbox(S.glass, TF, tm - 0.62, tm + 0.62, yb + 2.58, yb + 2.95, 0.08, 0.1, '#ffffff');
  k.fbox(S.trim, TF, tm - 1.25, tm + 1.25, yb + 3.05, yb + 3.22, -0.03, 1.3, p.trim);
  k.fprism(S.trim, TF, [
    [tm - 1.28, yb + 3.22],
    [tm + 1.28, yb + 3.22],
    [tm, yb + 3.85],
  ], 0.9, 1.3, p.trim);
  k.fprism(S.trim, TF, [
    [tm - 0.9, yb + 3.3],
    [tm + 0.9, yb + 3.3],
    [tm, yb + 3.72],
  ], 1.3, 1.32, p.pick);
  for (const s of [-1, 1]) {
    k.fbox(S.trim, TF, tm + s * 1.1 - 0.08, tm + s * 1.1 + 0.08, yb, yb + 3.05, 1.12, 1.28, p.trim);
    k.fprism(S.trim, TF, [
      [tm + s * 1.1, yb + 3.05],
      [tm + s * 0.7, yb + 3.05],
      [tm + s * 1.1, yb + 2.65],
    ], 1.16, 1.24, p.trim);
  }
  const walkS = k.walk(tm);
  stairs(k, S.stone, tm - 1.0, tm + 1.0, yb, tf - 0.02, 0.35, walkS, ['#6f6a66', '#65605c']);
  k.box(S.stone, tm - 1.1, tm + 1.1, yb - 0.25, yb, tf - 0.02, tf + 0.3, '#6f6a66');

  // --- The bracketed cornice and a low hipped roof over the house.
  k.box(matte, 0.3, Wd - 0.3, yC - 0.7, yC - 0.1, F - 0.04, D - 0.1, p.body);
  k.box(S.trim, 0.26, Wd - 0.26, yC - 0.66, yC - 0.6, F - 0.08, D - 0.06, p.pick);
  k.box(S.trim, -0.2, Wd + 0.2, yC - 0.1, yC + 0.35, F - 0.75, D + 0.3, p.trim);
  hipRoof(k, k.roofs, -0.1, Wd + 0.1, F - 0.65, D + 0.2, yC + 0.35, 2.4, p.roof);
  for (let a = 0.55; a < Wd - 0.4; a += 0.9) for (const s of [-1, 1]) k.fbox(S.trim, FF, a + s * 0.1 - 0.045, a + s * 0.1 + 0.045, yC - 0.62, yC - 0.1, 0, 0.62, p.trim);
  for (const u of [2.6, 5.4]) {
    k.box(k.roofs, u - 0.4, u + 0.4, yC, yC + 3.2, D - 3.6, D - 2.8, '#5b3b33');
    k.box(k.roofs, u - 0.47, u + 0.47, yC + 3.2, yC + 3.34, D - 3.67, D - 2.73, '#3d2a25');
  }

  // --- The tower above the roof: the belvedere (windows all round) under a bracketed cornice and a
  // tall pyramid with a finial.
  const faces: [Face, number][] = [
    [{ u: t0, w: tf, du: 1, dw: 0 }, t1 - t0],
    [{ u: t1, w: tf, du: 0, dw: 1 }, tw1 - tf],
    [{ u: t1, w: tw1, du: -1, dw: 0 }, t1 - t0],
    [{ u: t0, w: tw1, du: 0, dw: -1 }, tw1 - tf],
  ];
  for (const [f, len] of faces) {
    for (const s of [-1, 1]) {
      const a = len / 2 + s * 0.7;
      plainWindow(k, f, a - 0.45, a + 0.45, yC + 0.75, yC + 2.3, p, 'none');
      sunburst(k, S.trim, f, a, yC + 2.43, 0.58, 0, Math.PI, 4, 0.02, p.trim, p.trim);
      sunburst(k, S.trim, f, a, yC + 2.43, 0.45, 0, Math.PI, 4, 0.03, p.pick, p.pick);
    }
    k.fbox(S.trim, f, 0, len, yC + 0.35, yC + 0.55, -0.04, 0.06, p.trim);
    k.fbox(S.trim, f, 0, len, yC + 2.7, yC + 2.78, -0.04, 0.06, p.pick);
  }
  k.box(S.trim, t0 - 0.35, t1 + 0.35, yTw, yTw + 0.32, tf - 0.35, tw1 + 0.35, p.trim);
  for (const [f, len] of faces) {
    for (let a = 0.3; a < len; a += 0.62) k.fbox(S.trim, f, a - 0.05, a + 0.05, yTw - 0.36, yTw, 0, 0.34, p.trim);
  }
  // Iron cresting round the top.
  for (const [f, len] of faces) {
    k.fbox(S.metal, f, -0.35, len + 0.35, yTw + 0.32, yTw + 0.37, 0.3, 0.35, IRON);
    for (let a = -0.2; a < len + 0.3; a += 0.32) {
      k.flat(S.metal, f, [
        [a - 0.04, yTw + 0.37],
        [a + 0.04, yTw + 0.37],
        [a, yTw + 0.72],
      ], 0.33, IRON);
    }
  }
  const hwT = (t1 - t0) / 2 + 0.35;
  k.add(k.roofs, new THREE.ConeGeometry(hwT * Math.SQRT2, 3.3, 4, 1, false, Math.PI / 4).translate(tm, yTw + 0.32 + 1.65, (tf + tw1) / 2), p.roof);
  finial(k, tm, yTw + 3.62, (tf + tw1) / 2, 1.5, p);
  k.done();
}

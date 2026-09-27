// The course: a winding centreline in the horizontal plane (x runs down towards the Bay, z is to
// the right when looking along +x) with a road height, a corridor half-width and a wall type on
// each edge. Shared by the physics, the bots and the visuals. No Three.js or DOM imports.
//
// Route: the top of Russian Hill, two steep blocks of Greenwich St, a right turn onto Hyde St (the
// cable-car line), a left turn into the eight... well, five hairpins of Lombard St, two more steep
// blocks, across the Embarcadero, along the pier and up the kicker. The waterfront (Embarcadero,
// pier, kicker and lip) sits exactly where it always has, so the Bay, the buoys and the landmarks
// line up as before.

export type SectionKind =
  | 'start'
  | 'block'
  | 'intersection'
  | 'corner'
  | 'hyde'
  | 'lombard'
  | 'embarcadero'
  | 'pier'
  | 'kicker';

/**
 * What bounds the road at an edge. Everything is a wall to the physics; hedges are low enough to
 * jump over (Lombard's flower beds), the rest are not.
 */
export type EdgeKind = 'curb' | 'hedge' | 'barrier' | 'rail' | 'open';

export const WALL_HEIGHT: Record<EdgeKind, number> = {
  curb: Infinity,
  hedge: 0.9,
  barrier: Infinity,
  rail: Infinity,
  open: Infinity,
};

export interface Section {
  kind: SectionKind;
  /** Street name (signs, HUD). */
  name: string;
  s0: number;
  s1: number;
  /** Corridor half-width (m). */
  hw: number;
  /** x range covered (min, max), for the terrain and the city. */
  xMin: number;
  xMax: number;
  /** Straight sections: the heading (radians, 0 = +x, π/2 = +z). */
  heading: number;
}

export interface CoursePoint {
  s: number;
  x: number;
  y: number;
  z: number;
  /** Unit tangent in the horizontal plane. */
  tx: number;
  tz: number;
  /** Heading (radians). */
  heading: number;
  /** dy/ds over the interval that starts here. */
  grade: number;
  /** dψ/ds: + turns right (towards +z when heading +x). */
  curv: number;
  hw: number;
  edgeL: EdgeKind;
  edgeR: EdgeKind;
  sec: number;
}

export interface Located {
  s: number;
  /** Signed lateral offset from the centreline: + is to the right. */
  d: number;
  /** Index of the sample at or before s. */
  i: number;
}

interface Piece {
  sec: number;
  s0: number;
  len: number;
  x0: number;
  z0: number;
  h0: number;
  /** Curvature (1/m, signed); 0 for straights. */
  k: number;
}

export interface Course {
  points: CoursePoint[];
  sections: Section[];
  length: number;
  /** Cable-car track crossings (arc length of each). */
  bumps: { s: number; sec: number }[];
  /** Crosswalk bands (arc length ranges). */
  crosswalks: { s0: number; s1: number }[];
  lip: { s: number; x: number; y: number; z: number; angle: number; cos: number; sin: number };
  /** The start line and the grid slots (P1 left, P2 right). */
  startS: number;
  grid: [{ s: number; d: number }, { s: number; d: number }];
  startY: number;
  deckY: number;
  /** x where the Embarcadero begins, the shoreline (pier start) and the kicker. */
  embX: number;
  shoreX: number;
  kickerX: number;
  /** Arc lengths of the key landmarks along the route. */
  marks: {
    hydeS0: number;
    hydeS1: number;
    lombardS0: number;
    lombardS1: number;
    embS0: number;
    pierS0: number;
    kickerS0: number;
  };
  /** Buoy rows in the Bay (z of the two rows, either side of the pier axis). */
  laneZ: readonly [number, number];
}

// ---------------------------------------------------------------------------------------------
// Layout

export const DS = 0.25;
export const DECK_Y = 4;
/** tan(25°) as a literal, so the kicker is identical in every JS engine. */
export const KICKER_GRADE = 0.4663076581549986;
export const KICKER_ANGLE = (25 * Math.PI) / 180;
/** The kicker is 12 m of ramp at 25°. */
export const KICKER_LEN = 12 / Math.sqrt(1 + KICKER_GRADE * KICKER_GRADE);
/** Where the Embarcadero has always started (three 60 m blocks and three intersections down). */
export const EMB_X = 10 + 3 * (60 / Math.sqrt(1 + 0.18 * 0.18) + 12 / Math.sqrt(1 + 0.03 * 0.03));
export const EMB_LEN = 30;
export const PIER_LEN = 40;
export const ROAD_HW = 7;
export const LOMBARD_HW = 4.8;
export const CORNER_R = 7;
export const LANE_Z = [-3, 3] as const;

/** Lombard's switchbacks. */
export const LOMBARD = {
  turns: 4,
  legAngle: (60 * Math.PI) / 180,
  hairpinR: 7,
  legLen: 14,
  drop: 13,
  /** Half-width of the garden band the switchbacks swing across. */
  bandHalf: 15.5,
} as const;

interface PlanSection {
  kind: SectionKind;
  name: string;
  hw: number;
  /** Rise over run along x for x-running sections. */
  grade?: number;
  pieces: { len: number; turn?: number }[];
}

const DEG = Math.PI / 180;

function lombardPieces(): { len: number; turn?: number }[] {
  const { turns, legAngle: th, hairpinR: r, legLen: L } = LOMBARD;
  const half = L / 2 - r * Math.tan(th / 2);
  const out: { len: number; turn?: number }[] = [];
  out.push({ len: r * th, turn: th });
  out.push({ len: half });
  for (let i = 0; i < turns; i++) {
    const sign = i % 2 === 0 ? -1 : 1;
    out.push({ len: r * 2 * th, turn: sign * 2 * th });
    out.push({ len: i === turns - 1 ? half : L });
  }
  // Straighten up again: after an odd number of hairpins the heading is -θ (turn right), after an
  // even number it is +θ (turn left).
  out.push({ len: r * th, turn: turns % 2 === 1 ? th : -th });
  return out;
}

const PLAN: PlanSection[] = [
  { kind: 'start', name: 'Greenwich St', hw: ROAD_HW, grade: 0, pieces: [{ len: 40 }] },
  { kind: 'block', name: 'Greenwich St', hw: ROAD_HW, grade: -0.15, pieces: [{ len: 64 }] },
  { kind: 'intersection', name: 'Larkin St', hw: ROAD_HW, grade: -0.02, pieces: [{ len: 14 }] },
  { kind: 'block', name: 'Greenwich St', hw: ROAD_HW, grade: -0.17, pieces: [{ len: 64 }] },
  { kind: 'corner', name: 'Hyde St', hw: ROAD_HW, pieces: [{ len: (CORNER_R * Math.PI) / 2, turn: 90 * DEG }] },
  { kind: 'hyde', name: 'Hyde St', hw: ROAD_HW, pieces: [{ len: 52 }] },
  { kind: 'corner', name: 'Lombard St', hw: ROAD_HW, pieces: [{ len: (CORNER_R * Math.PI) / 2, turn: -90 * DEG }] },
  { kind: 'lombard', name: 'Lombard St', hw: LOMBARD_HW, pieces: lombardPieces() },
  { kind: 'intersection', name: 'Leavenworth St', hw: ROAD_HW, grade: -0.02, pieces: [{ len: 14 }] },
  { kind: 'block', name: 'Lombard St', hw: ROAD_HW, grade: -0.18, pieces: [{ len: 64 }] },
  { kind: 'intersection', name: 'Mason St', hw: ROAD_HW, grade: -0.02, pieces: [{ len: 14 }] },
  { kind: 'block', name: 'Lombard St', hw: ROAD_HW, grade: -0.16, pieces: [{ len: 64 }] },
  { kind: 'embarcadero', name: 'The Embarcadero', hw: ROAD_HW, grade: 0, pieces: [{ len: EMB_LEN }] },
  { kind: 'pier', name: 'Pier 23', hw: ROAD_HW, grade: 0, pieces: [{ len: PIER_LEN }] },
  { kind: 'kicker', name: 'The kicker', hw: ROAD_HW, pieces: [{ len: KICKER_LEN }] },
];

// ---------------------------------------------------------------------------------------------
// Construction

function piecePos(p: Piece, u: number): { x: number; z: number; h: number } {
  if (p.k === 0) return { x: p.x0 + Math.cos(p.h0) * u, z: p.z0 + Math.sin(p.h0) * u, h: p.h0 };
  const h = p.h0 + p.k * u;
  return {
    x: p.x0 + (Math.sin(h) - Math.sin(p.h0)) / p.k,
    z: p.z0 - (Math.cos(h) - Math.cos(p.h0)) / p.k,
    h,
  };
}

/** Piecewise-linear terrain profile along x: [x, y] breakpoints, ascending x. */
let PROFILE: [number, number][] = [];

/** City ground height at x (flat along z): the hill the whole city sits on. */
export function terrainY(x: number): number {
  const P = PROFILE;
  if (x <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) {
    if (x <= P[i][0]) {
      const [x0, y0] = P[i - 1];
      const [x1, y1] = P[i];
      return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return P[P.length - 1][1];
}

/** The terrain's breakpoints strictly inside (x0, x1), for geometry that must follow the hill. */
export function terrainBreaks(x0: number, x1: number): number[] {
  return PROFILE.map((p) => p[0]).filter((x) => x > x0 + 1e-6 && x < x1 - 1e-6);
}

/** Slope of the terrain at x (dy/dx), looking ahead of any breakpoint. */
export function terrainGrade(x: number): number {
  const P = PROFILE;
  for (let i = 1; i < P.length; i++) {
    if (x < P[i][0]) {
      const [x0, y0] = P[i - 1];
      const [x1, y1] = P[i];
      return x1 === x0 ? 0 : (y1 - y0) / (x1 - x0);
    }
  }
  return 0;
}

function buildCourse(): Course {
  // 1. Lay the pieces out from the origin heading +x.
  const pieces: Piece[] = [];
  const sections: Section[] = [];
  let x = 0;
  let z = 0;
  let h = 0;
  let s = 0;
  PLAN.forEach((ps, si) => {
    const s0 = s;
    let xMin = x;
    let xMax = x;
    for (const pd of ps.pieces) {
      const k = pd.turn ? pd.turn / pd.len : 0;
      const p: Piece = { sec: si, s0: s, len: pd.len, x0: x, z0: z, h0: h, k };
      pieces.push(p);
      // Track the x range covered (arcs can bulge).
      for (let u = 0; u <= pd.len; u += 0.5) {
        const q = piecePos(p, u);
        xMin = Math.min(xMin, q.x);
        xMax = Math.max(xMax, q.x);
      }
      const e = piecePos(p, pd.len);
      x = e.x;
      z = e.z;
      h = e.h;
      s += pd.len;
    }
    sections.push({ kind: ps.kind, name: ps.name, s0, s1: s, hw: ps.hw, xMin, xMax: Math.max(xMax, x), heading: h });
  });

  // 2. Shift so the Embarcadero starts where it always has, on the pier axis (z = 0).
  const emb = sections.find((q) => q.kind === 'embarcadero')!;
  const embPiece = pieces.find((p) => p.s0 === emb.s0)!;
  const dx = EMB_X - embPiece.x0;
  const dz = -embPiece.z0;
  for (const p of pieces) {
    p.x0 += dx;
    p.z0 += dz;
  }
  for (const q of sections) {
    q.xMin += dx;
    q.xMax += dx;
  }

  // 3. Terrain profile, built backwards (uphill) from the Embarcadero at deck height.
  const prof: [number, number][] = [];
  let y = DECK_Y;
  prof.push([EMB_X + EMB_LEN + PIER_LEN + 40, DECK_Y]);
  prof.push([EMB_X, DECK_Y]);
  for (let si = PLAN.indexOf(PLAN.find((q) => q.kind === 'embarcadero')!) - 1; si >= 0; si--) {
    const ps = PLAN[si];
    const sec = sections[si];
    const w = sec.xMax - sec.xMin;
    if (ps.kind === 'lombard') y += LOMBARD.drop;
    else if (ps.kind === 'corner' || ps.kind === 'hyde') y += 0;
    else y += -(ps.grade ?? 0) * w;
    prof.push([sec.xMin, y]);
  }
  prof.push([sections[0].xMin - 600, y]);
  prof.reverse();
  // Merge duplicate x breakpoints (the flat Hyde band has zero-width sections in x).
  PROFILE = prof.filter((p, i) => i === 0 || p[0] > prof[i - 1][0] + 1e-9 || p[1] !== prof[i - 1][1]);

  // 4. Sample the centreline.
  const total = s;
  const n = Math.floor(total / DS) + 1;
  const points: CoursePoint[] = [];
  let pi = 0;
  for (let i = 0; i < n; i++) {
    const si = Math.min(i * DS, total);
    while (pi < pieces.length - 1 && si >= pieces[pi].s0 + pieces[pi].len) pi++;
    const p = pieces[pi];
    const q = piecePos(p, si - p.s0);
    const sec = sections[p.sec];
    points.push({
      s: si,
      x: q.x,
      y: 0,
      z: q.z,
      tx: Math.cos(q.h),
      tz: Math.sin(q.h),
      heading: q.h,
      grade: 0,
      curv: p.k,
      hw: sec.hw,
      edgeL: 'curb',
      edgeR: 'curb',
      sec: p.sec,
    });
  }
  // The last sample sits exactly on the lip.
  {
    const p = pieces[pieces.length - 1];
    const q = piecePos(p, p.len);
    const last = points[points.length - 1];
    if (last.s < total - 1e-9) {
      points.push({ ...last, s: total, x: q.x, z: q.z });
    }
  }

  // 5. Heights: the terrain for the city streets, a steady descent along Lombard's switchbacks, and
  // the ramp for the kicker.
  const lomb = sections.find((q) => q.kind === 'lombard')!;
  const kick = sections.find((q) => q.kind === 'kicker')!;
  const lombY0 = terrainY(lomb.xMin);
  const lombY1 = terrainY(lomb.xMax);
  for (const pt of points) {
    const sec = sections[pt.sec];
    if (sec.kind === 'lombard') pt.y = lombY0 + ((lombY1 - lombY0) * (pt.s - sec.s0)) / (sec.s1 - sec.s0);
    else if (sec.kind === 'kicker') pt.y = DECK_Y + (pt.s - kick.s0) * KICKER_GRADE;
    else pt.y = terrainY(pt.x);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    a.grade = (b.y - a.y) / (b.s - a.s);
  }
  points[points.length - 1].grade = KICKER_GRADE;

  // 6. Edges. Lombard's flower beds are hedges; the Embarcadero lanes are open (invisible walls, the
  // Waymos cross there); the pier and kicker have rails; corner outsides get tyre barriers.
  for (const pt of points) {
    const sec = sections[pt.sec];
    let l: EdgeKind = 'curb';
    let r: EdgeKind = 'curb';
    if (sec.kind === 'lombard') {
      const out = (side: number): EdgeKind => {
        const ox = pt.x + -pt.tz * side * (pt.hw + 1.5);
        const oz = pt.z + pt.tx * side * (pt.hw + 1.5);
        const inBand = Math.abs(oz) < LOMBARD.bandHalf - 0.6 && ox > lomb.xMin + 1 && ox < lomb.xMax - 1;
        return inBand ? 'hedge' : 'curb';
      };
      l = out(-1);
      r = out(1);
    } else if (sec.kind === 'corner') {
      // The outside of the turn gets tyre barriers.
      if (pt.curv > 0) l = 'barrier';
      else r = 'barrier';
    } else if (sec.kind === 'embarcadero') {
      l = r = 'open';
    } else if (sec.kind === 'pier' || sec.kind === 'kicker') {
      l = r = 'rail';
    }
    pt.edgeL = l;
    pt.edgeR = r;
  }

  // 7. Features.
  const bumps: { s: number; sec: number }[] = [];
  const crosswalks: { s0: number; s1: number }[] = [];
  sections.forEach((sec, si) => {
    if (sec.kind === 'intersection') {
      bumps.push({ s: (sec.s0 + sec.s1) / 2, sec: si });
      crosswalks.push({ s0: sec.s0 - 3.4, s1: sec.s0 - 0.6 });
      crosswalks.push({ s0: sec.s1 + 0.6, s1: sec.s1 + 3.4 });
    }
    if (sec.kind === 'embarcadero') crosswalks.push({ s0: sec.s0 + 1, s1: sec.s0 + 3.8 });
  });

  const lipPt = points[points.length - 1];
  const startS = 33;
  const pier = sections.find((q) => q.kind === 'pier')!;
  const hyde = sections.find((q) => q.kind === 'hyde')!;
  const course: Course = {
    points,
    sections,
    length: total,
    bumps,
    crosswalks,
    lip: {
      s: total,
      x: lipPt.x,
      y: lipPt.y,
      z: lipPt.z,
      angle: KICKER_ANGLE,
      cos: 1 / Math.sqrt(1 + KICKER_GRADE * KICKER_GRADE),
      sin: KICKER_GRADE / Math.sqrt(1 + KICKER_GRADE * KICKER_GRADE),
    },
    startS,
    grid: [
      { s: startS - 3.2, d: -3 },
      { s: startS - 3.2, d: 3 },
    ],
    startY: points[0].y,
    deckY: DECK_Y,
    embX: EMB_X,
    shoreX: EMB_X + EMB_LEN,
    kickerX: EMB_X + EMB_LEN + PIER_LEN,
    marks: {
      hydeS0: hyde.s0,
      hydeS1: hyde.s1,
      lombardS0: lomb.s0,
      lombardS1: lomb.s1,
      embS0: emb.s0,
      pierS0: pier.s0,
      kickerS0: kick.s0,
    },
    laneZ: LANE_Z,
  };
  buildIndex(course);
  return course;
}

// ---------------------------------------------------------------------------------------------
// Queries

/** Spatial hash of the samples for global lookups (landing after a jump, placing things). */
const CELL = 6;
let GRID = new Map<number, number[]>();
const key = (cx: number, cz: number): number => (cx + 4096) * 8192 + (cz + 4096);

function buildIndex(c: Course): void {
  GRID = new Map();
  c.points.forEach((p, i) => {
    const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
    let list = GRID.get(k);
    if (!list) GRID.set(k, (list = []));
    list.push(i);
  });
}

export const COURSE: Course = buildCourse();
/** The old name, kept for the modules that only need the lip and the waterfront. */
export const TRACK = COURSE;

/** Index of the sample at or before s (clamped). */
export function indexAt(c: Course, s: number): number {
  const i = Math.floor(s / DS);
  return Math.min(Math.max(i, 0), c.points.length - 2);
}

/** Interpolated centreline point at arc length s (clamped to the course). */
export function pointAt(c: Course, s: number, out?: CoursePoint): CoursePoint {
  const i = indexAt(c, s);
  const a = c.points[i];
  const b = c.points[i + 1];
  const f = Math.min(Math.max((s - a.s) / (b.s - a.s), 0), 1);
  const o = out ?? { ...a };
  o.s = a.s + (b.s - a.s) * f;
  o.x = a.x + (b.x - a.x) * f;
  o.y = a.y + (b.y - a.y) * f;
  o.z = a.z + (b.z - a.z) * f;
  // Tangent: interpolate the heading (continuous along the course).
  const hd = a.heading + (b.heading - a.heading) * f;
  o.heading = hd;
  o.tx = Math.cos(hd);
  o.tz = Math.sin(hd);
  o.grade = a.grade;
  o.curv = a.curv;
  o.hw = a.hw;
  o.edgeL = a.edgeL;
  o.edgeR = a.edgeR;
  o.sec = a.sec;
  return o;
}

/** Road height at arc length s. */
export function heightAt(c: Course, s: number): number {
  const i = indexAt(c, s);
  const a = c.points[i];
  const b = c.points[i + 1];
  const f = Math.min(Math.max((s - a.s) / (b.s - a.s), 0), 1);
  return a.y + (b.y - a.y) * f;
}

/** World position of a point given in course coordinates (s along, d to the right). */
export function toWorld(c: Course, s: number, d: number): { x: number; y: number; z: number; heading: number } {
  const p = pointAt(c, s);
  return { x: p.x - p.tz * d, y: p.y, z: p.z + p.tx * d, heading: p.heading };
}

function project(c: Course, i: number, x: number, z: number): { s: number; d: number; dist2: number } {
  const a = c.points[i];
  const b = c.points[Math.min(i + 1, c.points.length - 1)];
  const ex = b.x - a.x;
  const ez = b.z - a.z;
  const len2 = ex * ex + ez * ez;
  let f = len2 > 0 ? ((x - a.x) * ex + (z - a.z) * ez) / len2 : 0;
  f = Math.min(Math.max(f, 0), 1);
  const px = a.x + ex * f;
  const pz = a.z + ez * f;
  const hd = a.heading + (b.heading - a.heading) * f;
  const rx = -Math.sin(hd);
  const rz = Math.cos(hd);
  const d = (x - px) * rx + (z - pz) * rz;
  const dx = x - px;
  const dz = z - pz;
  return { s: a.s + (b.s - a.s) * f, d, dist2: dx * dx + dz * dz };
}

/**
 * Where (x, z) sits on the course, searching near a previous arc length (a car can't jump more
 * than a few metres between steps, and Lombard's legs are close together, so a local search keeps
 * it on the right leg).
 */
export function locate(c: Course, x: number, z: number, sHint: number, window = 6, out?: Located): Located {
  const i0 = Math.max(0, indexAt(c, sHint - window));
  const i1 = Math.min(c.points.length - 2, indexAt(c, sHint + window));
  let best = i0;
  let bestD = Infinity;
  for (let i = i0; i <= i1; i++) {
    const p = c.points[i];
    const dx = x - p.x;
    const dz = z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD) {
      bestD = d2;
      best = i;
    }
  }
  // Refine on the two segments either side of the nearest sample.
  let r = project(c, best, x, z);
  if (best > 0) {
    const r2 = project(c, best - 1, x, z);
    if (r2.dist2 < r.dist2) r = r2;
  }
  const o = out ?? { s: 0, d: 0, i: 0 };
  o.s = r.s;
  o.d = r.d;
  o.i = indexAt(c, r.s);
  return o;
}

/**
 * Global lookup: every stretch of road whose corridor contains (x, z). Used when a car lands after
 * a jump (it may have cleared a hedge onto another leg) and to place things on the road.
 */
export function roadsAt(c: Course, x: number, z: number): Located[] {
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  const cand = new Set<number>();
  for (let ix = cx - 2; ix <= cx + 2; ix++) {
    for (let iz = cz - 2; iz <= cz + 2; iz++) {
      for (const i of GRID.get(key(ix, iz)) ?? []) cand.add(i);
    }
  }
  // Group candidate samples into contiguous runs (one per stretch of road passing by) and take the
  // nearest point of each run.
  const idx = [...cand].sort((a, b) => a - b);
  const out: Located[] = [];
  let runStart = 0;
  for (let k = 0; k <= idx.length; k++) {
    if (k === idx.length || (k > 0 && idx[k] !== idx[k - 1] + 1)) {
      if (k > runStart) {
        let best: { s: number; d: number; dist2: number } | null = null;
        for (let m = runStart; m < k; m++) {
          const r = project(c, idx[m], x, z);
          if (!best || r.dist2 < best.dist2) best = r;
        }
        if (best) {
          const hw = c.points[indexAt(c, best.s)].hw;
          if (Math.abs(best.d) <= hw + 0.05) out.push({ s: best.s, d: best.d, i: indexAt(c, best.s) });
        }
      }
      runStart = k;
    }
  }
  return out;
}

export function sectionAt(c: Course, s: number): Section {
  return c.sections[c.points[indexAt(c, s)].sec];
}

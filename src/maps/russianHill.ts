// Russian Hill: the long-jump course. From the top of Russian Hill, two steep blocks of Greenwich
// St, a right turn onto Hyde St (the cable-car line), a left turn into the eight... well, five
// hairpins of Lombard St, two more steep blocks, across the Embarcadero, along the pier and up the
// kicker into the Bay. The waterfront (Embarcadero, pier, kicker and lip) sits exactly where it
// always has, so the Bay, the buoys and the landmarks line up as before.
//
// x runs down towards the Bay, z is to the right when looking along +x. The city's ground is a hill
// that only varies along x (terrainY). No Three.js or DOM imports.
import type { RaceSim } from '../sim/race';
import { DS, finishCourse, pointAt, type Course, type CoursePoint, type EdgeKind, type Section, type SectionKind } from '../track';

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

// ---------------------------------------------------------------------------------------------
// Layout

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

function buildCourse(): { course: Course; marks: Marks } {
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
    id: 'russian-hill',
    loop: false,
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
      grade: KICKER_GRADE,
      cos: 1 / Math.sqrt(1 + KICKER_GRADE * KICKER_GRADE),
      sin: KICKER_GRADE / Math.sqrt(1 + KICKER_GRADE * KICKER_GRADE),
      rampS0: kick.s0,
      baseY: DECK_Y,
      runupS0: pier.s0,
      finalS0: lomb.s1,
    },
    startS,
    grid: [
      { s: startS - 3.2, d: -3 },
      { s: startS - 3.2, d: 3 },
    ],
    startY: points[0].y,
    wideViews: [{ s0: lomb.s0, s1: lomb.s1 }],
    // The chase camera was tuned for the hill as it is: it doesn't tilt with the grade.
    followGrade: 0,
    // Lombard's block (gardens between the switchbacks): walled in along its sides, houses at its ends.
    garden: { x0: lomb.xMin + 0.5, x1: lomb.xMax - 0.5, zWall: LOMBARD.bandHalf - 0.9, gate: 7.5 },
    index: new Map(),
  };
  const marks: Marks = {
    hydeS0: hyde.s0,
    hydeS1: hyde.s1,
    lombardS0: lomb.s0,
    lombardS1: lomb.s1,
    embS0: emb.s0,
    pierS0: pier.s0,
    kickerS0: kick.s0,
  };
  return { course: finishCourse(course, KICKER_GRADE), marks };
}

/** Arc lengths of the landmarks along the route. */
export interface Marks {
  hydeS0: number;
  hydeS1: number;
  lombardS0: number;
  lombardS1: number;
  embS0: number;
  pierS0: number;
  kickerS0: number;
}

const BUILT = buildCourse();
export const RUSSIAN_HILL: Course = BUILT.course;
export const SF_MARKS: Marks = BUILT.marks;

/** The waterfront: where the Embarcadero begins, the shoreline (pier start) and the kicker. */
export const SHORE_X = EMB_X + EMB_LEN;
export const KICKER_X = EMB_X + EMB_LEN + PIER_LEN;


// ---------------------------------------------------------------------------------------------
// What's on the road each round

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/** Waymos creeping down the blocks, a stalled one with a cone on its hood, cross traffic on the
 *  Embarcadero, the cable car on Hyde St, pedestrians on the crosswalks and tourists on Lombard. */
export function populateRussianHill(sim: RaceSim, r: () => number): void {
  const c = sim.course;
  const m = SF_MARKS;
  const blocks = c.sections.filter((q) => q.kind === 'block');
  // Traffic creeping down the first two blocks and pulling over before the Hyde St corner.
  const firstRun: [number, number] = [blocks[0].s0 + 10, blocks[1].s1 - 16];
  const lastRun: [number, number] = [blocks[2].s0 + 4, blocks[3].s1 - 8];
  sim.addTraffic(firstRun[0] + 28 + r() * 30, r() < 0.5 ? -3.4 : 3.4, 4 + r() * 2, firstRun[1]);
  sim.addTraffic(firstRun[0] + 95 + r() * 30, r() < 0.5 ? -3.4 : 3.4, 3.5 + r() * 2, firstRun[1]);
  sim.addTraffic(lastRun[0] + 70 + r() * 35, r() < 0.5 ? -3.4 : 3.4, 3 + r() * 2.5, lastRun[1]);
  // A stalled Waymo with a traffic cone on its hood (SF's favourite protest), hazards on.
  {
    const s = blocks[2].s0 + 22 + r() * 24;
    const d = (r() < 0.5 ? -1 : 1) * (1.5 + r() * 2.2);
    // Facing uphill, so the cone on its hood faces the racers coming down.
    const wm = sim.addStalled(s, d, Math.PI + (r() - 0.5) * 0.5);
    wm.cone = true;
    wm.hazard = true;
    // A few loose cones around it.
    for (let i = 0; i < 3; i++) {
      const cs = s - 6 - i * 2.2;
      const cd = d + (r() - 0.5) * 3;
      sim.addCone(cs, clamp(cd, -6, 6));
    }
  }
  // Cross traffic on the Embarcadero: one lane each way. They brake for anything in their path.
  const lanes: [number, 1 | -1][] = [
    [EMB_X + 5.4, 1],
    [EMB_X + 19.5, -1],
  ];
  for (const [lx, dir] of lanes) {
    let z = -dir * (60 + r() * 40);
    for (let k = 0; k < 3; k++) {
      sim.addCrossing(lx, dir, z, DECK_Y, 7 + r() * 1.5, m.embS0 + 10);
      z -= dir * (38 + r() * 34);
    }
  }
  // The Powell-Hyde cable car shuttles up and down the middle of Hyde St on its rails: a big,
  // slow thing to get round, never parked in a corner.
  {
    const hyde = c.sections.find((q) => q.kind === 'hyde')!;
    const h0 = pointAt(c, hyde.s0);
    const h1 = pointAt(c, hyde.s1);
    const z0 = h0.z + 9;
    const z1 = h1.z - 9;
    const along = z0 + r() * (z1 - z0);
    const dir: 1 | -1 = r() < 0.5 ? 1 : -1;
    sim.addCable(h0.x, h0.y, z0, z1, along, dir, 2 + r() * 3);
  }
  // Pedestrians on the crosswalks: each walks across and back, pausing at the kerb.
  for (const cw of c.crosswalks) {
    if (r() < 0.25) continue;
    const n = 1 + (r() < 0.4 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const s = cw.s0 + 0.6 + r() * (cw.s1 - cw.s0 - 1.2);
      const hw = pointAt(c, s).hw;
      const d0 = -hw - 1.2;
      const d1 = hw + 1.2;
      const d = d0 + r() * (d1 - d0);
      const dir: 1 | -1 = r() < 0.5 ? 1 : -1;
      sim.addPed('crosser', s, d, d0, d1, dir, 1.1 + r() * 0.5, r() * 2);
    }
  }
  // Tourists on Lombard, in the road for the perfect photo.
  const span = m.lombardS1 - m.lombardS0;
  for (let k = 0; k < 4; k++) {
    const s = m.lombardS0 + span * (0.14 + 0.21 * k + r() * 0.08);
    const hw = pointAt(c, s).hw;
    const d = (r() * 2 - 1) * (hw - 1);
    const p = sim.addPed('tourist', s, d, d, d, 1, 0, 0);
    p.speed = r() < 0.4 ? 0.5 : 0;
    p.d0 = -hw + 0.8;
    p.d1 = hw - 0.8;
  }
}

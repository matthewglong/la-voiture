// Courses: a centreline in the horizontal plane (heading 0 is +x, π/2 is +z, so + curvature turns
// right) with a road height, a corridor half-width and a wall type on each edge. Shared by the
// physics, the bots and the visuals. No Three.js or DOM imports.
//
// A course is either point to point (ending at a lip or a finish line) or a closed loop (laps). On a
// loop the arc length s wraps: it runs over [0, length) and the last sample sits exactly on the
// first. The maps build their courses (src/maps); this module holds the types, the builders they
// share and the queries.

/** What a stretch of road is (the map decides: Lombard's switchbacks, a hairpin, the pier...). */
export type SectionKind = string;

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
  /** Heading at the end of the section (radians, 0 = +x, π/2 = +z). */
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
  /** Heading (radians), continuous along the course (a loop's last sample is a whole turn on). */
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

/** The end of a course that finishes in the air: the kicker's lip, and the run-up to it. */
export interface Lip {
  s: number;
  x: number;
  y: number;
  z: number;
  /** Which way the kicker launches (the course's heading at the lip), as an angle and a unit
   *  vector in the horizontal plane. Jumps are measured along it. */
  heading: number;
  tx: number;
  tz: number;
  /** Height of the water the cars land in (a jump ends where a car first touches it). */
  waterY: number;
  angle: number;
  /** tan(angle), as the ramp is built (the ramp drops by scaling it). */
  grade: number;
  cos: number;
  sin: number;
  /** Where the ramp begins (it drops about here), and the flat deck height it rises from. */
  rampS0: number;
  baseY: number;
  /** The flat run-up before the ramp (the pier): first onto it earns HYPE. */
  runupS0: number;
  /** What the run-up is called ("the pier"), for the HUD. */
  runupName: string;
  /** The last run to the lip after the technical part of the course: the CPU saves its boost for it. */
  finalS0: number;
}

/**
 * A walled-in block the road winds through (Lombard's gardens): a rectangle in its own frame, with
 * side walls and end walls that have gaps where the road comes in and goes out. A hop across it
 * stays inside it, and off the road inside it is all flower beds.
 */
export interface Garden {
  /** The frame: an origin, and the heading (radians) the block's length runs along (u); v is
   *  across it, to the right. */
  ox: number;
  oz: number;
  heading: number;
  /** Its extent along u, and where its side walls stand (|v|). */
  u0: number;
  u1: number;
  wall: number;
  /** Half-width of the gaps in the end walls where the road comes in and goes out. */
  gate: number;
}

/** A point in a garden's frame: along its length (u) and across it (v). */
export function gardenFrame(g: Garden, x: number, z: number): { u: number; v: number } {
  const c = Math.cos(g.heading);
  const sn = Math.sin(g.heading);
  const dx = x - g.ox;
  const dz = z - g.oz;
  return { u: dx * c + dz * sn, v: -dx * sn + dz * c };
}

/** A garden-frame point back in the world. */
export function gardenWorld(g: Garden, u: number, v: number): { x: number; z: number } {
  const c = Math.cos(g.heading);
  const sn = Math.sin(g.heading);
  return { x: g.ox + u * c - v * sn, z: g.oz + u * sn + v * c };
}

export interface Course {
  id: string;
  /** A closed loop (laps) rather than point to point. */
  loop: boolean;
  points: CoursePoint[];
  sections: Section[];
  length: number;
  /** Cable-car track crossings (arc length of each). */
  bumps: { s: number; sec: number }[];
  /** Crosswalk bands (arc length ranges). */
  crosswalks: { s0: number; s1: number }[];
  /** Courses that end in the air end at a lip; loops have none. */
  lip: Lip | null;
  /** A point-to-point course without a lip: where its finish line is (arc length). Null otherwise
   *  (a loop's finish is its start line; a lip is its own finish). */
  finishS: number | null;
  /** The start line and the grid slots (P1 left, P2 right). On a loop the start line is also the
   *  finish line. */
  startS: number;
  grid: [{ s: number; d: number }, { s: number; d: number }];
  startY: number;
  /** Stretches the chase camera pulls up and back for (Lombard's switchbacks). */
  wideViews: { s0: number; s1: number }[];
  /** How far the chase camera tilts with the road: looking up a climb and down a drop (0: it
   *  doesn't; 1: fully). */
  followGrade: number;
  /** Walled-in blocks the road winds through (Lombard's). */
  gardens: Garden[];
  /** Spatial hash of the samples (built by finishCourse). */
  index: Map<number, number[]>;
}

// ---------------------------------------------------------------------------------------------
// Building

export const DS = 0.25;

/** Grades from the sampled heights (the last sample keeps `lastGrade`), and the spatial index. */
export function finishCourse(c: Course, lastGrade: number): Course {
  const P = c.points;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i];
    const b = P[i + 1];
    a.grade = (b.y - a.y) / (b.s - a.s);
  }
  P[P.length - 1].grade = lastGrade;
  c.index = buildIndex(c);
  return c;
}

// ---------------------------------------------------------------------------------------------
// Building a course from pieces: straights and circular arcs laid end to end (Russian Hill's
// streets and Lombard's hairpins). The plan only fixes the plan view; the map gives the heights and
// the edges, then calls finishCourse.

/** One piece of road: a straight (no turn) or an arc turning `turn` radians (+ right) over `len`. */
export interface PieceDef {
  len: number;
  turn?: number;
}

/** A stretch of road made of pieces. */
export interface PieceSection {
  kind: SectionKind;
  name: string;
  hw: number;
  pieces: PieceDef[];
}

/** A laid piece: where it starts (arc length, position, heading) and its curvature. */
export interface Piece {
  sec: number;
  s0: number;
  len: number;
  x0: number;
  z0: number;
  h0: number;
  /** Curvature (1/m, signed); 0 for straights. */
  k: number;
}

/** The point `u` metres along a piece, and the heading there. */
export function piecePos(p: Piece, u: number): { x: number; z: number; h: number } {
  if (p.k === 0) return { x: p.x0 + Math.cos(p.h0) * u, z: p.z0 + Math.sin(p.h0) * u, h: p.h0 };
  const h = p.h0 + p.k * u;
  return {
    x: p.x0 + (Math.sin(h) - Math.sin(p.h0)) / p.k,
    z: p.z0 - (Math.cos(h) - Math.cos(p.h0)) / p.k,
    h,
  };
}

/** Lay a plan's pieces end to end from the origin heading +x: the pieces, the sections (with the x
 *  range each covers) and the total length. */
export function layPieces(plan: readonly PieceSection[]): { pieces: Piece[]; sections: Section[]; length: number } {
  const pieces: Piece[] = [];
  const sections: Section[] = [];
  let x = 0;
  let z = 0;
  let h = 0;
  let s = 0;
  plan.forEach((ps, si) => {
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
  return { pieces, sections, length: s };
}

/** Move laid pieces (and their sections' x ranges) by (dx, dz). */
export function shiftPieces(pieces: Piece[], sections: Section[], dx: number, dz: number): void {
  for (const p of pieces) {
    p.x0 += dx;
    p.z0 += dz;
  }
  for (const q of sections) {
    q.xMin += dx;
    q.xMax += dx;
  }
}

/** Sample laid pieces every DS metres (the last sample exactly on the end), flat, kerbed both sides:
 *  the map sets the heights and the edges. */
export function samplePieces(pieces: Piece[], sections: Section[], total: number): CoursePoint[] {
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
  // The last sample sits exactly on the end.
  {
    const p = pieces[pieces.length - 1];
    const q = piecePos(p, p.len);
    const last = points[points.length - 1];
    if (last.s < total - 1e-9) {
      points.push({ ...last, s: total, x: q.x, z: q.z });
    }
  }
  return points;
}

/** What a kicker at the end of a course is like (the rest of its Lip comes from the course). */
export interface LipSpec {
  /** The ramp's angle (radians) and slope (its tangent, as the ramp's heights are built). */
  angle: number;
  grade: number;
  /** Where the ramp begins, and the flat deck height it rises from. */
  rampS0: number;
  baseY: number;
  /** The flat run-up before the ramp, and what it's called ("the pier"). */
  runupS0: number;
  runupName: string;
  /** The last run to the lip after the technical part of the course. */
  finalS0: number;
  /** Height of the water beyond it (default 0). */
  waterY?: number;
}

/** The lip of a kicker on a course's last sample (the course ends where the ramp does). */
export function lipAt(points: CoursePoint[], spec: LipSpec): Lip {
  const p = points[points.length - 1];
  return {
    s: p.s,
    x: p.x,
    y: p.y,
    z: p.z,
    heading: p.heading,
    tx: p.tx,
    tz: p.tz,
    waterY: spec.waterY ?? 0,
    angle: spec.angle,
    grade: spec.grade,
    cos: 1 / Math.sqrt(1 + spec.grade * spec.grade),
    sin: spec.grade / Math.sqrt(1 + spec.grade * spec.grade),
    rampS0: spec.rampS0,
    baseY: spec.baseY,
    runupS0: spec.runupS0,
    runupName: spec.runupName,
    finalS0: spec.finalS0,
  };
}

/** One node of a course drawn as a spline: where the centreline passes, and how high the road is. */
export interface SplineNode {
  x: number;
  z: number;
  y: number;
  /**
   * Length (m) of the vertical curve that rounds the change of grade here. 0 is a sharp change:
   * a crest like that throws fast cars into the air. Defaults to 14 m.
   */
  round?: number;
}

/** A stretch of a spline course, from a node to the next section's first node. */
export interface SplineSection {
  from: number;
  kind: SectionKind;
  name: string;
  hw: number;
  edgeL: EdgeKind;
  edgeR: EdgeKind;
}

/** A kicker at the end of a point-to-point spline course: the ramp runs from node `fromNode` to
 *  the last node, rising at `angle` from that node's height (the builder sets the ramp's heights). */
export interface SplineKicker {
  fromNode: number;
  angle: number;
  /** The flat run-up before the ramp starts at this node, and what it's called ("the pier"). */
  runupNode: number;
  runupName: string;
  /** The last run to the lip starts at this node (the CPU saves its boost for it). */
  finalNode: number;
  /** Height of the water beyond it (default 0). */
  waterY?: number;
}

export interface SplineDef {
  id: string;
  /** A closed loop (default), or point to point from the first node to the last. */
  loop?: boolean;
  /** Nodes along the course (the centreline is a centripetal Catmull-Rom spline through them). */
  nodes: SplineNode[];
  /** Sections in order; the first must start at node 0. */
  sections: SplineSection[];
  /** Arc length of the start line (the grid sits just behind it; a loop's finish line too). */
  startS: number;
  /** Point to point: end in a kicker (the lip is the finish), or else a finish line this far (m)
   *  before the end of the road (default 60: room to stop). */
  kicker?: SplineKicker;
  runoff?: number;
  wideViews?: { s0: number; s1: number }[];
  /** See Course.followGrade (default 0.8: on a hill the ups and downs are the point). */
  followGrade?: number;
}

/** Centripetal Catmull-Rom point between p1 and p2 (u in 0..1). */
function catmull(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], u: number): [number, number] {
  const tj = (a: [number, number], b: [number, number]): number => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-6;
  const t0 = 0;
  const t1 = t0 + tj(p0, p1);
  const t2 = t1 + tj(p1, p2);
  const t3 = t2 + tj(p2, p3);
  const t = t1 + (t2 - t1) * u;
  const lerp = (a: [number, number], b: [number, number], ta: number, tb: number): [number, number] => {
    const f = (t - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
  const a1 = lerp(p0, p1, t0, t1);
  const a2 = lerp(p1, p2, t1, t2);
  const a3 = lerp(p2, p3, t2, t3);
  const b1 = lerp(a1, a2, t0, t2);
  const b2 = lerp(a2, a3, t1, t3);
  return lerp(b1, b2, t1, t2);
}

/**
 * A course from its nodes, as a closed loop or point to point: the plan is a smooth spline through
 * them, sampled every DS metres of arc length; the height runs in straight grades from node to node,
 * each change of grade rounded over its node's `round` length (or left sharp, for a crest to jump).
 * Point to point, the course can end in a kicker (a lip) or at a finish line.
 */
export function buildSpline(def: SplineDef): Course {
  const loop = def.loop ?? true;
  const N = def.nodes.length;
  if (!loop && N < 2) throw new Error(`${def.id}: a course needs at least two nodes`);
  // Round a loop the nodes wrap; point to point, a ghost node before the first and after the last
  // carries each end straight on.
  const at = (k: number): SplineNode => def.nodes[((k % N) + N) % N];
  const xz = (k: number): [number, number] => {
    if (loop || (k >= 0 && k < N)) return [at(k).x, at(k).z];
    const [a, b] = k < 0 ? [def.nodes[0], def.nodes[1]] : [def.nodes[N - 1], def.nodes[N - 2]];
    return [2 * a.x - b.x, 2 * a.z - b.z];
  };
  const spans = loop ? N : N - 1;
  // 1. A dense polyline of the plan, with the arc length at each node.
  const SUB = 400;
  const dense: [number, number][] = [];
  const nodeS: number[] = [];
  let len = 0;
  for (let k = 0; k < spans; k++) {
    for (let j = 0; j < SUB; j++) {
      const q = catmull(xz(k - 1), xz(k), xz(k + 1), xz(k + 2), j / SUB);
      if (dense.length) {
        const [px, pz] = dense[dense.length - 1];
        len += Math.hypot(q[0] - px, q[1] - pz);
      }
      if (j === 0) nodeS.push(len);
      dense.push(q);
    }
  }
  {
    // Close the loop back onto the first node, or run on to the last one.
    const end = loop ? dense[0] : xz(N - 1);
    const [px, pz] = dense[dense.length - 1];
    len += Math.hypot(end[0] - px, end[1] - pz);
    dense.push(end);
    if (!loop) nodeS.push(len);
  }
  const total = len;
  // Cumulative arc length of the dense polyline.
  const cum = new Float64Array(dense.length);
  for (let i = 1; i < dense.length; i++) cum[i] = cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);

  // 2. Height: straight grades between nodes, rounded at each node.
  // The heights sit on the nodes snapped to the sample grid, so a sharp crest falls exactly on a
  // sample: the whole change of grade then lands in one step (as it does at the city's crossings).
  const nodeY = nodeS.map((s) => Math.round(s / DS) * DS);
  /** Arc length where span k (node k to node k + 1) ends; on a loop the last span ends back at node 0. */
  const spanEnd = (k: number): number => (k + 1 < N ? nodeY[k + 1] : total);
  const segGrade = (k: number): number => {
    // Point to point, the grade carries on straight past either end.
    if (!loop) k = Math.min(Math.max(k, 0), N - 2);
    k = ((k % N) + N) % N;
    return (at(k + 1).y - at(k).y) / (spanEnd(k) - nodeY[k]);
  };
  const height = (s: number): number => {
    // Which span, and the straight-grade height along it.
    let k = spans - 1;
    for (let i = 0; i < spans; i++) {
      if (s < spanEnd(i)) {
        k = i;
        break;
      }
    }
    let y = at(k).y + segGrade(k) * (s - nodeY[k]);
    // The vertical curves round the span's two end nodes (on a loop node 0 sits at both 0 and the
    // length; point to point the two ends aren't rounded).
    for (const [kk, sk] of [
      [k, nodeY[k]],
      [k + 1, spanEnd(k)],
    ] as [number, number][]) {
      if (!loop && (kk <= 0 || kk >= N - 1)) continue;
      const R = at(kk).round ?? 14;
      if (R <= 0) continue;
      const x = s - (sk - R / 2);
      if (x < 0 || x > R) continue;
      const g1 = segGrade(kk - 1);
      const g2 = segGrade(kk);
      const yk = at(kk).y;
      // Replace this span's straight grade with the parabola from g1 to g2 centred on the node.
      const yLine = s < sk ? yk + g1 * (s - sk) : yk + g2 * (s - sk);
      const yCurve = yk - g1 * (R / 2) + g1 * x + ((g2 - g1) * x * x) / (2 * R);
      y += yCurve - yLine;
    }
    return y;
  };

  // 3. Sample every DS metres (on a loop the last sample sits exactly on the first; point to point,
  // exactly on the end).
  const secAt = (s: number): number => {
    let si = 0;
    for (let i = 0; i < def.sections.length; i++) if (s >= nodeS[def.sections[i].from]) si = i;
    return si;
  };
  const points: CoursePoint[] = [];
  let j = 0;
  let heading = 0;
  let prevRaw = 0;
  const sample = (s: number, first: boolean): CoursePoint => {
    while (j < dense.length - 2 && cum[j + 1] < s) j++;
    const f = Math.min(1, (s - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]));
    const x = dense[j][0] + (dense[j + 1][0] - dense[j][0]) * f;
    const z = dense[j][1] + (dense[j + 1][1] - dense[j][1]) * f;
    // Tangent from the dense polyline around this point.
    const ja = Math.max(0, j - 2);
    const jb = Math.min(dense.length - 1, j + 3);
    const raw = Math.atan2(dense[jb][1] - dense[ja][1], dense[jb][0] - dense[ja][0]);
    if (first) heading = raw;
    else {
      let dh = raw - prevRaw;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      heading += dh;
    }
    prevRaw = raw;
    const si = secAt(s);
    const sd = def.sections[si];
    return { s, x, y: height(s), z, tx: Math.cos(heading), tz: Math.sin(heading), heading, grade: 0, curv: 0, hw: sd.hw, edgeL: sd.edgeL, edgeR: sd.edgeR, sec: si };
  };
  for (let i = 0; i * DS < total - 1e-6; i++) points.push(sample(i * DS, i === 0));
  if (loop) {
    // Close the loop: the last sample is the first one again, a whole turn on.
    const p0 = points[0];
    const turn = Math.round((points[points.length - 1].heading - p0.heading) / (2 * Math.PI)) * 2 * Math.PI;
    points.push({ ...p0, s: total, heading: p0.heading + turn, sec: points[points.length - 1].sec });
  } else points.push(sample(total, false));
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    a.curv = (b.heading - a.heading) / (b.s - a.s);
  }
  points[points.length - 1].curv = loop ? points[0].curv : points[points.length - 2].curv;

  // 4. A kicker at the end: a straight ramp up from its first node at the kicker's angle.
  const kick = !loop ? def.kicker : undefined;
  let lip: Lip | null = null;
  if (kick) {
    const rampS0 = nodeS[kick.fromNode];
    const baseY = height(rampS0);
    const grade = Math.tan(kick.angle);
    for (const p of points) if (p.s >= rampS0) p.y = baseY + (p.s - rampS0) * grade;
    lip = lipAt(points, {
      angle: kick.angle,
      grade,
      rampS0,
      baseY,
      runupS0: nodeS[kick.runupNode],
      runupName: kick.runupName,
      finalS0: nodeS[kick.finalNode],
      waterY: kick.waterY,
    });
  }

  // 5. Sections.
  const sections: Section[] = def.sections.map((sd, si) => {
    const s0 = nodeS[sd.from];
    const s1 = si + 1 < def.sections.length ? nodeS[def.sections[si + 1].from] : total;
    let xMin = Infinity;
    let xMax = -Infinity;
    let h = 0;
    for (const p of points) {
      if (p.sec !== si) continue;
      xMin = Math.min(xMin, p.x);
      xMax = Math.max(xMax, p.x);
      h = p.heading;
    }
    return { kind: sd.kind, name: sd.name, s0, s1, hw: sd.hw, xMin, xMax, heading: h };
  });

  const startS = def.startS;
  const course: Course = {
    id: def.id,
    loop,
    points,
    sections,
    length: total,
    bumps: [],
    crosswalks: [],
    lip,
    finishS: loop || lip ? null : total - (def.runoff ?? 60),
    startS,
    grid: [
      { s: startS - 3.2, d: -3 },
      { s: startS - 3.2, d: 3 },
    ],
    startY: height(startS),
    wideViews: def.wideViews ?? [],
    followGrade: def.followGrade ?? 0.8,
    gardens: [],
    index: new Map(),
  };
  if (loop) {
    // The loop's last sample closes onto the first, so its grade is the first one's.
    finishCourse(course, 0);
    points[points.length - 1].grade = points[0].grade;
  } else finishCourse(course, lip ? lip.grade : segGrade(N - 2));
  return course;
}

/** A closed loop from its nodes (buildSpline with loop on). */
export function buildLoop(def: SplineDef): Course {
  return buildSpline({ ...def, loop: true });
}

// ---------------------------------------------------------------------------------------------
// Queries

/** Spatial hash of the samples for global lookups (landing after a jump, placing things). */
const CELL = 6;
const key = (cx: number, cz: number): number => (cx + 4096) * 8192 + (cz + 4096);

function buildIndex(c: Course): Map<number, number[]> {
  const grid = new Map<number, number[]>();
  c.points.forEach((p, i) => {
    const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
    let list = grid.get(k);
    if (!list) grid.set(k, (list = []));
    list.push(i);
  });
  return grid;
}

/** An arc length on the course: wrapped onto [0, length) on a loop, as it is otherwise. */
export function wrapS(c: Course, s: number): number {
  if (!c.loop) return s;
  const L = c.length;
  return ((s % L) + L) % L;
}

/** How far `b` is ahead of `a` along the course (negative behind); on a loop the short way round. */
export function deltaS(c: Course, a: number, b: number): number {
  const d = b - a;
  if (!c.loop) return d;
  const L = c.length;
  return d - Math.round(d / L) * L;
}

/** Did a car going from s0 to s1 (one step) cross arc length `at` forwards? */
export function crossedS(c: Course, s0: number, s1: number, at: number): boolean {
  if (!c.loop) return s0 < at && s1 >= at;
  const d = deltaS(c, s0, s1);
  if (d <= 0) return false;
  const u = deltaS(c, s0, at);
  return u > 0 && u <= d;
}

export function indexAt(c: Course, s: number): number {
  const i = Math.floor(wrapS(c, s) / DS);
  return Math.min(Math.max(i, 0), c.points.length - 2);
}

/** Interpolated centreline point at arc length s (clamped to the course, or wrapped on a loop). */
export function pointAt(c: Course, s: number, out?: CoursePoint): CoursePoint {
  s = wrapS(c, s);
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
  s = wrapS(c, s);
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
  return { s: wrapS(c, a.s + (b.s - a.s) * f), d, dist2: dx * dx + dz * dz };
}

/**
 * Where (x, z) sits on the course, searching near a previous arc length (a car can't jump more
 * than a few metres between steps, and Lombard's legs are close together, so a local search keeps
 * it on the right leg).
 */
export function locate(c: Course, x: number, z: number, sHint: number, window = 6, out?: Located): Located {
  let best: number;
  if (c.loop) {
    // Walk the samples either side of the hint, round the seam if need be.
    const segs = c.points.length - 1;
    const k0 = Math.floor((sHint - window) / DS);
    const k1 = Math.floor((sHint + window) / DS);
    best = 0;
    let bestD = Infinity;
    for (let k = k0; k <= k1; k++) {
      const i = ((k % segs) + segs) % segs;
      const p = c.points[i];
      const dx = x - p.x;
      const dz = z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD) {
        bestD = d2;
        best = i;
      }
    }
    let r = project(c, best, x, z);
    const r2 = project(c, (best - 1 + segs) % segs, x, z);
    if (r2.dist2 < r.dist2) r = r2;
    const o = out ?? { s: 0, d: 0, i: 0 };
    o.s = r.s;
    o.d = r.d;
    o.i = indexAt(c, r.s);
    return o;
  }
  const i0 = Math.max(0, indexAt(c, sHint - window));
  const i1 = Math.min(c.points.length - 2, indexAt(c, sHint + window));
  best = i0;
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
  const last = c.points.length - 1;
  for (let ix = cx - 2; ix <= cx + 2; ix++) {
    for (let iz = cz - 2; iz <= cz + 2; iz++) {
      // (A loop's closing sample is its first one again.)
      for (const i of c.index.get(key(ix, iz)) ?? []) if (!(c.loop && i === last)) cand.add(i);
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

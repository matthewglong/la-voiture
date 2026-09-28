// Courses: a centreline in the horizontal plane (heading 0 is +x, π/2 is +z, so + curvature turns
// right) with a road height, a corridor half-width and a wall type on each edge. Shared by the
// physics, the bots and the visuals. No Three.js or DOM imports.
//
// A course is either point to point (it ends at a lip: the long jump) or a closed loop (laps). On a
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

/** The end of a long-jump course: the kicker's lip, and the run-up to it. */
export interface Lip {
  s: number;
  x: number;
  y: number;
  z: number;
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
  /** The last run to the lip after the technical part of the course: the CPU saves its boost for it. */
  finalS0: number;
}

/** A walled-in block the road winds through (Lombard's gardens): an x range and |z| limit. */
export interface Garden {
  x0: number;
  x1: number;
  zWall: number;
  /** Half-width of the gaps in the end walls where the road comes in and goes out. */
  gate: number;
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
  /** Long-jump courses end at a lip; loops have none. */
  lip: Lip | null;
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
  garden: Garden | null;
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

/** One node of a loop: where the centreline passes, and how high the road is there. */
export interface LoopNode {
  x: number;
  z: number;
  y: number;
  /**
   * Length (m) of the vertical curve that rounds the change of grade here. 0 is a sharp change:
   * a crest like that throws fast cars into the air. Defaults to 14 m.
   */
  round?: number;
}

/** A stretch of a loop, from a node to the next section's first node. */
export interface LoopSection {
  from: number;
  kind: SectionKind;
  name: string;
  hw: number;
  edgeL: EdgeKind;
  edgeR: EdgeKind;
}

export interface LoopDef {
  id: string;
  /** Nodes round the loop (the centreline is a closed centripetal Catmull-Rom spline through them). */
  nodes: LoopNode[];
  /** Sections in order; the first must start at node 0. */
  sections: LoopSection[];
  /** Arc length of the start/finish line (the grid sits just behind it). */
  startS: number;
  wideViews?: { s0: number; s1: number }[];
  /** See Course.followGrade (default 0.8: on a loop the ups and downs are the point). */
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
 * A closed loop from its nodes: the plan is a smooth spline through them, sampled every DS metres
 * of arc length; the height runs in straight grades from node to node, each change of grade rounded
 * over its node's `round` length (or left sharp, for a crest to jump).
 */
export function buildLoop(def: LoopDef): Course {
  const N = def.nodes.length;
  const at = (k: number): LoopNode => def.nodes[((k % N) + N) % N];
  const xz = (k: number): [number, number] => [at(k).x, at(k).z];
  // 1. A dense polyline of the plan, with the arc length at each node.
  const SUB = 400;
  const dense: [number, number][] = [];
  const nodeS: number[] = [];
  let len = 0;
  for (let k = 0; k < N; k++) {
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
    const [px, pz] = dense[dense.length - 1];
    len += Math.hypot(dense[0][0] - px, dense[0][1] - pz);
    dense.push(dense[0]);
  }
  const total = len;
  // Cumulative arc length of the dense polyline.
  const cum = new Float64Array(dense.length);
  for (let i = 1; i < dense.length; i++) cum[i] = cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);

  // 2. Height: straight grades between nodes, rounded at each node.
  // The heights sit on the nodes snapped to the sample grid, so a sharp crest falls exactly on a
  // sample: the whole change of grade then lands in one step (as it does at the city's crossings).
  const nodeY = nodeS.map((s) => Math.round(s / DS) * DS);
  /** Arc length where span k (node k to node k + 1) ends; the last span ends back at node 0. */
  const spanEnd = (k: number): number => (k + 1 < N ? nodeY[k + 1] : total);
  const segGrade = (k: number): number => {
    k = ((k % N) + N) % N;
    return (at(k + 1).y - at(k).y) / (spanEnd(k) - nodeY[k]);
  };
  const height = (s: number): number => {
    // Which span, and the straight-grade height along it.
    let k = N - 1;
    for (let i = 0; i < N; i++) {
      if (s < spanEnd(i)) {
        k = i;
        break;
      }
    }
    let y = at(k).y + segGrade(k) * (s - nodeY[k]);
    // The vertical curves round the span's two end nodes (node 0 sits at both 0 and the length).
    for (const [kk, sk] of [
      [k, nodeY[k]],
      [k + 1, spanEnd(k)],
    ] as [number, number][]) {
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

  // 3. Sample every DS metres (the last sample sits exactly on the first).
  const secAt = (s: number): number => {
    let si = 0;
    for (let i = 0; i < def.sections.length; i++) if (s >= nodeS[def.sections[i].from]) si = i;
    return si;
  };
  const points: CoursePoint[] = [];
  let j = 0;
  let heading = 0;
  let prevRaw = 0;
  for (let i = 0; i * DS < total - 1e-6; i++) {
    const s = i * DS;
    while (j < dense.length - 2 && cum[j + 1] < s) j++;
    const f = (s - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]);
    const x = dense[j][0] + (dense[j + 1][0] - dense[j][0]) * f;
    const z = dense[j][1] + (dense[j + 1][1] - dense[j][1]) * f;
    // Tangent from the dense polyline around this point.
    const ja = Math.max(0, j - 2);
    const jb = Math.min(dense.length - 1, j + 3);
    const raw = Math.atan2(dense[jb][1] - dense[ja][1], dense[jb][0] - dense[ja][0]);
    if (i === 0) heading = raw;
    else {
      let dh = raw - prevRaw;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      heading += dh;
    }
    prevRaw = raw;
    const si = secAt(s);
    const sd = def.sections[si];
    points.push({ s, x, y: height(s), z, tx: Math.cos(heading), tz: Math.sin(heading), heading, grade: 0, curv: 0, hw: sd.hw, edgeL: sd.edgeL, edgeR: sd.edgeR, sec: si });
  }
  {
    // Close the loop: the last sample is the first one again, a whole turn on.
    const p0 = points[0];
    const turn = Math.round((points[points.length - 1].heading - p0.heading) / (2 * Math.PI)) * 2 * Math.PI;
    points.push({ ...p0, s: total, heading: p0.heading + turn, sec: points[points.length - 1].sec });
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    a.curv = (b.heading - a.heading) / (b.s - a.s);
  }
  points[points.length - 1].curv = points[0].curv;

  // 4. Sections.
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
    loop: true,
    points,
    sections,
    length: total,
    bumps: [],
    crosswalks: [],
    lip: null,
    startS,
    grid: [
      { s: startS - 3.2, d: -3 },
      { s: startS - 3.2, d: 3 },
    ],
    startY: height(startS),
    wideViews: def.wideViews ?? [],
    followGrade: def.followGrade ?? 0.8,
    garden: null,
    index: new Map(),
  };
  // The loop's last sample closes onto the first, so its grade is the first one's.
  finishCourse(course, 0);
  points[points.length - 1].grade = points[0].grade;
  return course;
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

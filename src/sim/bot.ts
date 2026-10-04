// Autopilot: a racing line through the course, a speed plan from the car's grip and brakes,
// dodging traffic, using items, and spending the boost where it pays (saved for the run to the
// kicker in the long jump; on the straights in a race). It drives the CPU car, the balance check
// and the automated tests. Deterministic; no Three.js or DOM imports.
import { DS, deltaS, indexAt, locate, pointAt, toWorld, type Course, type CoursePoint } from '../track';
import type { PlayerIndex } from '../types';
import { G, brakeDecel, cornerGrip, cornerSpeed, driftGrip, flatLoad, maxYawRate, topSpeedIn, windAlong } from './physics';
import { DRIFT_MIN, IPO_LIP, TOPUP, type CarInput, type ItemKind, type RaceCar, type RaceSim } from './race';

interface Line {
  /** Lateral offset of the line at each course sample. */
  d: Float64Array;
  /** Curvature of the line (1/m, unsigned). */
  k: Float64Array;
}

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const wrap = (a: number): number => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

const lines = new Map<Course, Line>();

/**
 * A racing line: the minimum-curvature path through the corridor, keeping a safe margin inside the
 * kerbs (inside the paved band, where the corridor has verges: the CPU keeps off a park's lawns). It swings wide into a corner, clips the apex and runs out wide again, and through
 * Lombard's switchbacks it uses the whole width. Solved once per course by projected gradient
 * descent on the summed squared curvature, on a 2 m resampling of the centreline (fast to converge),
 * then interpolated back onto every sample.
 */
export function racingLine(c: Course): Line {
  const cached = lines.get(c);
  if (cached) return cached;
  const line = c.loop ? loopLine(c) : openLine(c);
  lines.set(c, line);
  return line;
}

/** Point to point: the line's ends stay on the centreline, and it runs straight at the kicker. */
function openLine(c: Course): Line {
  const P = c.points;
  const n = P.length;
  const STEP = 8;
  const idx: number[] = [];
  for (let i = 0; i < n; i += STEP) idx.push(i);
  if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
  const m = idx.length;
  const cx = idx.map((i) => P[i].x);
  const cz = idx.map((i) => P[i].z);
  const nx = idx.map((i) => -P[i].tz);
  const nz = idx.map((i) => P[i].tx);
  const lim = idx.map((i) => Math.max(0, P[i].pave - 2.2));
  const d = new Float64Array(m);
  const X = new Float64Array(m);
  const Z = new Float64Array(m);
  const g = new Float64Array(m);
  for (let it = 0; it < 4000; it++) {
    for (let j = 0; j < m; j++) {
      X[j] = cx[j] + nx[j] * d[j];
      Z[j] = cz[j] + nz[j] * d[j];
    }
    for (let j = 2; j < m - 2; j++) {
      const fx = X[j - 2] - 4 * X[j - 1] + 6 * X[j] - 4 * X[j + 1] + X[j + 2];
      const fz = Z[j - 2] - 4 * Z[j - 1] + 6 * Z[j] - 4 * Z[j + 1] + Z[j + 2];
      g[j] = fx * nx[j] + fz * nz[j];
    }
    for (let j = 2; j < m - 2; j++) d[j] = clamp(d[j] - 0.03 * g[j], -lim[j], lim[j]);
  }
  // Back onto every sample, straight at the kicker.
  const full = new Float64Array(n);
  for (let j = 0; j < m - 1; j++) {
    const a = idx[j];
    const b = idx[j + 1];
    for (let i = a; i <= b; i++) full[i] = d[j] + ((d[j + 1] - d[j]) * (i - a)) / (b - a);
  }
  const kick = c.lip ? c.lip.runupS0 : Infinity;
  for (let i = 0; i < n; i++) {
    if (P[i].s > kick) full[i] *= clamp(1 - (P[i].s - kick) / 12, 0, 1);
    const mm = Math.max(0, P[i].pave - 2.2);
    full[i] = clamp(full[i], -mm, mm);
  }
  const FX = new Float64Array(n);
  const FZ = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    FX[i] = P[i].x - P[i].tz * full[i];
    FZ[i] = P[i].z + P[i].tx * full[i];
  }
  const kk = new Float64Array(n);
  const h = 8;
  for (let i = h; i < n - h; i++) {
    // Curvature from the circle through three points of the line.
    const ax = FX[i - h];
    const az = FZ[i - h];
    const bx = FX[i];
    const bz = FZ[i];
    const ex = FX[i + h];
    const ez = FZ[i + h];
    const ab = Math.hypot(bx - ax, bz - az);
    const bc = Math.hypot(ex - bx, ez - bz);
    const ca = Math.hypot(ax - ex, az - ez);
    const cross = Math.abs((bx - ax) * (ez - az) - (bz - az) * (ex - ax));
    kk[i] = ab * bc * ca > 1e-9 ? (2 * cross) / (ab * bc * ca) : 0;
  }
  return { d: full, k: kk };
}

/** A loop: the same minimum-curvature line, solved all the way round (no ends to pin). */
function loopLine(c: Course): Line {
  const P = c.points;
  const n = P.length;
  // The closing sample is the first one again.
  const segs = n - 1;
  const STEP = 8;
  const idx: number[] = [];
  for (let i = 0; i < segs; i += STEP) idx.push(i);
  const m = idx.length;
  const at = (j: number): number => ((j % m) + m) % m;
  const cx = idx.map((i) => P[i].x);
  const cz = idx.map((i) => P[i].z);
  const nx = idx.map((i) => -P[i].tz);
  const nz = idx.map((i) => P[i].tx);
  const lim = idx.map((i) => Math.max(0, P[i].pave - 2.2));
  const d = new Float64Array(m);
  const X = new Float64Array(m);
  const Z = new Float64Array(m);
  const g = new Float64Array(m);
  for (let it = 0; it < 4000; it++) {
    for (let j = 0; j < m; j++) {
      X[j] = cx[j] + nx[j] * d[j];
      Z[j] = cz[j] + nz[j] * d[j];
    }
    for (let j = 0; j < m; j++) {
      const fx = X[at(j - 2)] - 4 * X[at(j - 1)] + 6 * X[j] - 4 * X[at(j + 1)] + X[at(j + 2)];
      const fz = Z[at(j - 2)] - 4 * Z[at(j - 1)] + 6 * Z[j] - 4 * Z[at(j + 1)] + Z[at(j + 2)];
      g[j] = fx * nx[j] + fz * nz[j];
    }
    for (let j = 0; j < m; j++) d[j] = clamp(d[j] - 0.03 * g[j], -lim[j], lim[j]);
  }
  const full = new Float64Array(n);
  for (let j = 0; j < m; j++) {
    const a = idx[j];
    const b = j + 1 < m ? idx[j + 1] : segs;
    const db = d[at(j + 1)];
    for (let i = a; i <= b; i++) full[i] = d[j] + ((db - d[j]) * (i - a)) / (b - a);
  }
  const FX = new Float64Array(segs);
  const FZ = new Float64Array(segs);
  for (let i = 0; i < segs; i++) {
    FX[i] = P[i].x - P[i].tz * full[i];
    FZ[i] = P[i].z + P[i].tx * full[i];
  }
  const kk = new Float64Array(n);
  const h = 8;
  const w = (i: number): number => ((i % segs) + segs) % segs;
  for (let i = 0; i < segs; i++) {
    const ax = FX[w(i - h)];
    const az = FZ[w(i - h)];
    const bx = FX[i];
    const bz = FZ[i];
    const ex = FX[w(i + h)];
    const ez = FZ[w(i + h)];
    const ab = Math.hypot(bx - ax, bz - az);
    const bc = Math.hypot(ex - bx, ez - bz);
    const ca = Math.hypot(ax - ex, az - ez);
    const cross = Math.abs((bx - ax) * (ez - az) - (bz - az) * (ex - ax));
    kk[i] = ab * bc * ca > 1e-9 ? (2 * cross) / (ab * bc * ca) : 0;
  }
  kk[segs] = kk[0];
  full[segs] = full[0];
  return { d: full, k: kk };
}

/** A corner worth drifting: where it is along the course, which way it turns (+1 right), and its
 *  tightest and average radius on the racing line. */
export interface DriftCorner {
  s0: number;
  s1: number;
  dir: number;
  rMin: number;
  rAvg: number;
}

const cornerCache = new Map<Course, DriftCorner[]>();

/** The big corners of the racing line (turning 50° or more): Hyde St's two and Lombard's hairpins. */
export function driftCorners(c: Course): DriftCorner[] {
  const cached = cornerCache.get(c);
  if (cached) return cached;
  const line = racingLine(c);
  const P = c.points;
  const out: DriftCorner[] = [];
  let i = 0;
  while (i < P.length) {
    if (line.k[i] <= 1 / 45) {
      i++;
      continue;
    }
    let j = i;
    let kMax = 0;
    // A corner, allowing short gaps where the line's curvature dips (one bend drawn as two).
    while (j < P.length && (line.k[j] > 1 / 45 || (j + 12 < P.length && line.k[j + 12] > 1 / 45 && line.k[j + 6] > 1 / 90))) {
      kMax = Math.max(kMax, line.k[j]);
      j++;
    }
    const turn = wrap(P[Math.min(j, P.length - 1)].heading - P[i].heading);
    const s1 = P[Math.min(j, P.length - 1)].s;
    if (Math.abs(turn) >= (50 * Math.PI) / 180) out.push({ s0: P[i].s, s1, dir: Math.sign(turn), rMin: 1 / kMax, rAvg: (s1 - P[i].s) / Math.abs(turn) });
    i = j + 1;
  }
  cornerCache.set(c, out);
  return out;
}

/** How hard (share of the slide's grip) the CPU leans on a drift: the rest is room to correct. */
const BOT_BITE = 0.8;

export interface BotOptions {
  /** 1 = the full speed plan; lower drives more cautiously. */
  skill?: number;
  /** Drift through the big corners (brake tap on the way in) and spend the boost it banks. */
  drift?: boolean;
  /** Leans on the other car when alongside (the CPU opponent). */
  aggression?: number;
  /** Dodge traffic and tourists (off for the empty-course balance check). */
  dodge?: boolean;
  /** Use items. */
  items?: boolean;
}

interface Threat {
  s: number;
  d: number;
  r: number;
  /** Tall enough that only a jump clears it. */
  tall: boolean;
}

export class Bot {
  readonly p: PlayerIndex;
  private readonly sim: RaceSim;
  private readonly line: Line;
  private readonly plan: Float64Array;
  private readonly opt: Required<BotOptions>;
  private readonly tmp: CoursePoint;
  private lastItem = false;
  private lastSwap = false;
  private dodgeD: number | null = null;
  /** Seconds going nowhere with the gas on, and seconds left of backing out. */
  private stuckT = 0;
  private backT = 0;
  /** Which way it's swinging round after ending up facing backwards (0 when it isn't). */
  private turnDir = 0;
  private turnRev = false;
  private turnT = 0;
  private turnFlipped = false;
  private backSteer = 1;
  /** Seconds left of the brake tap that starts a drift, and the way it turns. */
  private tapT = 0;
  private tapDir = 0;
  private readonly corners: DriftCorner[];

  constructor(sim: RaceSim, p: PlayerIndex, opts: BotOptions = {}) {
    this.sim = sim;
    this.p = p;
    this.opt = {
      skill: opts.skill ?? 1,
      aggression: opts.aggression ?? 0,
      dodge: opts.dodge ?? true,
      items: opts.items ?? true,
      drift: opts.drift ?? false,
    };
    this.line = racingLine(sim.course);
    this.corners = this.opt.drift ? driftCorners(sim.course) : [];
    // Through a park it could drive anywhere in, the CPU keeps to the paths (walled as a road is).
    sim.cars[p].keepToRoad = true;
    this.tmp = { ...sim.course.points[0] };
    this.plan = this.speedPlan();
  }

  /** The drift corner the car is in, or about to enter (within `ahead` metres). */
  private cornerAt(s: number, ahead: number): DriftCorner | null {
    const c = this.sim.course;
    for (const dc of this.corners) {
      if (c.loop) {
        const u = deltaS(c, dc.s0, s);
        if (u > -ahead && u < dc.s1 - dc.s0) return dc;
      } else if (s > dc.s0 - ahead && s < dc.s1) return dc;
    }
    return null;
  }

  /** Top speed at every sample the car can take the line at, braking in time for what's next. */
  private speedPlan(): Float64Array {
    const c = this.sim.course;
    const k = this.sim.cars[this.p].stats;
    const P = c.points;
    const n = P.length;
    const v = new Float64Array(n);
    const safety = 0.92 * this.opt.skill;
    const slide = driftGrip(k, flatLoad(k)) * BOT_BITE;
    for (let i = 0; i < n; i++) {
      const kap = Math.max(this.line.k[i], 1e-4);
      // The sim's grip with the wing's downforce (see cornerSpeed); no limit on the line: 60.
      const corner = cornerSpeed(k, kap);
      let lim = Number.isFinite(corner) ? corner : 60;
      // Drifting through a big corner: the slide's grip, with a margin to correct in, round the
      // corner's average bend (a drift sweeps wide round the line's tightest kink).
      const dc = this.cornerAt(P[i].s, 0);
      if (dc) lim = Math.max(lim, Math.sqrt(slide * dc.rAvg));
      // Can't turn tighter than the steering allows at any speed.
      if (kap > 1 / k.turnRadius) lim = Math.min(lim, 3);
      v[i] = Math.min(60, lim * safety);
    }
    const brake = brakeDecel(k) * 0.85 * this.opt.skill;
    // Braking back from what's ahead (on a loop twice round, so the end of the lap brakes for the
    // first corner of the next).
    const passes = c.loop ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) {
      if (c.loop) v[n - 1] = v[0];
      for (let i = n - 2; i >= 0; i--) {
        const a = Math.max(1.5, brake + G * P[i].grade);
        v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * a * DS));
      }
    }
    if (c.loop) v[n - 1] = v[0];
    return v;
  }

  /** The planned speed at arc length s. */
  planAt(s: number): number {
    return this.plan[indexAt(this.sim.course, s)];
  }

  lineAt(s: number): number {
    return this.line.d[indexAt(this.sim.course, s)];
  }

  decide(): CarInput {
    const sim = this.sim;
    const c = sim.course;
    const car = sim.cars[this.p];
    const out: CarInput = { throttle: 0, brake: 0, steer: 0, item: false, boost: false, swap: false };
    if (car.phase !== 'race') return out;
    const k = car.stats;
    const v = Math.hypot(car.vx, car.vz);
    const fwd = Math.cos(car.heading) * car.vx + Math.sin(car.heading) * car.vz;

    // --- Where to aim: the line, bent round anything in the way.
    const look = 3 + 0.3 * Math.max(v, 4);
    const sT = c.loop ? car.s + look : Math.min(car.s + look, c.length - 0.1);
    let dT = this.line.d[indexAt(c, sT)];
    const threat = this.opt.dodge ? this.nextThreat(car, 34) : null;
    let blocked = false;
    if (threat) {
      const hw = pointAt(c, threat.s, this.tmp).hw;
      const need = threat.r + k.width / 2 + 0.9;
      const lineD = this.line.d[indexAt(c, threat.s)];
      if (Math.abs(lineD - threat.d) < need) {
        const left = threat.d - need;
        const right = threat.d + need;
        const lim = hw - k.width / 2 - 0.4;
        const opts = [left, right].filter((x) => Math.abs(x) <= lim);
        if (opts.length) {
          // Keep to the side already chosen, else the nearer one.
          let pick = opts.reduce((a, b) => (Math.abs(a - lineD) < Math.abs(b - lineD) ? a : b));
          if (this.dodgeD !== null) {
            const same = opts.find((o) => Math.sign(o - threat.d) === Math.sign(this.dodgeD! - threat.d));
            if (same !== undefined) pick = same;
          }
          this.dodgeD = pick;
          dT = pick;
        } else blocked = true;
      } else this.dodgeD = null;
    } else this.dodgeD = null;

    // Lean on the other car when alongside (the CPU's personality).
    if (this.opt.aggression > 0) {
      for (const o of sim.cars) {
        if (o === car || o.phase !== 'race') continue;
        const ds = deltaS(c, car.s, o.s);
        if (Math.abs(ds) < 3.5 && Math.abs(o.d - car.d) < 4.5) dT += Math.sign(o.d - car.d) * 1.8 * this.opt.aggression;
      }
    }
    const hwT = pointAt(c, sT, this.tmp).hw;
    dT = clamp(dT, -hwT + k.width / 2 + 0.3, hwT - k.width / 2 - 0.3);
    const tgt = toWorld(c, sT, dT);

    // --- Steer: pure pursuit, converted to the car's steering (lock maps to a yaw rate).
    const dx = tgt.x - car.x;
    const dz = tgt.z - car.z;
    const dist = Math.max(1, Math.hypot(dx, dz));
    let ang = wrap(Math.atan2(dz, dx) - car.heading);
    if (fwd < -0.5) ang = wrap(ang + Math.PI);
    const kappa = (2 * Math.sin(ang)) / dist;
    const wMax = maxYawRate(k, Math.max(Math.abs(fwd), 0.5), cornerGrip(k, flatLoad(k)));
    out.steer = clamp((kappa * Math.max(Math.abs(fwd), 1)) / Math.max(wMax, 0.05), -1, 1);
    // Facing backwards (after a knock, or a landing the wrong way round): turn round. The first
    // swing takes the nose away from the nearer wall (the short way round can be straight into it).
    const facing = wrap(car.heading - pointAt(c, car.s, this.tmp).heading);
    if (this.turnDir === 0 && Math.abs(facing) > 1.9) {
      this.turnDir = Math.abs(car.d) > 1.2 ? Math.sign(car.d) : facing > 0 ? -1 : 1;
      this.turnRev = false;
      this.turnT = 0;
      this.turnFlipped = false;
    } else if (this.turnDir !== 0 && Math.abs(facing) < 1) this.turnDir = 0;

    // --- Speed.
    let vPlan = Infinity;
    for (let s = car.s; s <= car.s + 2 + v * 0.35; s += 1) vPlan = Math.min(vPlan, this.planAt(s));
    if (blocked && threat) {
      const gap = threat.s - car.s - k.length / 2 - threat.r;
      const stop = Math.sqrt(Math.max(0, 2 * 5 * (gap - 3)));
      vPlan = Math.min(vPlan, stop);
    }
    if (v > vPlan + 0.6) {
      out.brake = clamp((v - vPlan) / 2.5, 0.3, 1);
      // Hard braking with the wheel turned throws the car into a drift: brake gently in a turn.
      if (Math.abs(out.steer) > 0.5) out.brake = Math.min(out.brake, 0.5);
    } else if (v < vPlan - 0.4) {
      out.throttle = 1;
    }
    this.steerDrift(car, out, v, tgt);
    if (c.lip) {
      // --- Boost: dump the bottle on the run to the kicker (whatever is left at the lip is wasted),
      // starting just soon enough to empty it at the lip.
      const toLip = c.length - car.s;
      if (car.boost > 0 && car.s > c.lip.finalS0 && toLip / Math.max(v, 5) <= car.boost + 0.4) out.boost = true;
    } else if (car.boost > 0 && car.grounded && car.drift === 0 && out.brake === 0) {
      // A race: boost wherever the speed plan says there's no braking coming for a good while.
      let clear = Infinity;
      for (let s = car.s; s <= car.s + 25 + v * 1.2; s += 2) clear = Math.min(clear, this.planAt(s));
      if (clear > v + 4) out.boost = true;
    }
    const dtStep = 1 / 120;
    if (this.turnDir !== 0) {
      // A three-point turn: forward on full lock until the nose is about to meet an edge (or the
      // car stops), then back with the wheel the other way until the tail is, and so on.
      this.turnT += dtStep;
      const reach = (k.length / 2 + 0.8 + v * 0.25) * (this.turnRev ? -1 : 1);
      const loc = locate(c, car.x + Math.cos(car.heading) * reach, car.z + Math.sin(car.heading) * reach, car.s, 12);
      const edge = Math.abs(loc.d) > pointAt(c, loc.s, this.tmp).hw - k.width / 2 - 0.3 || (!c.loop && loc.s < 1.2);
      if ((edge && this.turnT > 0.3) || (this.turnT > 0.6 && v < 0.4) || this.turnT > 3.5) {
        this.turnRev = !this.turnRev;
        this.turnT = 0;
        // Off forwards again, still facing back and off to one side: swing across the road, away
        // from the near wall (the car may have drifted over since the turn began). Once only, or a
        // narrow road has it dithering.
        if (!this.turnRev && !this.turnFlipped && Math.abs(facing) > Math.PI / 2 && Math.abs(car.d) > 1.2) {
          this.turnFlipped = true;
          this.turnDir = Math.sign(car.d);
        }
      }
      // The nose swings the chosen way whichever way the car is rolling.
      const rolling = fwd > 0.3 ? 1 : fwd < -0.3 ? -1 : this.turnRev ? -1 : 1;
      out.steer = this.turnDir * rolling;
      out.throttle = this.turnRev ? 0 : v < 4 ? 1 : 0.3;
      out.brake = this.turnRev ? 1 : 0;
      this.stuckT = 0;
      this.backT = 0;
    } else if (this.backT > 0) {
      // Pinned against something (a wall, the start's back fence)? Back out, wheel the other way.
      this.backT -= dtStep;
      out.throttle = 0;
      out.brake = 1;
      out.steer = this.backSteer;
    } else if (out.throttle > 0.5 && v < 0.6) {
      this.stuckT += dtStep;
      if (this.stuckT > 1) {
        this.stuckT = 0;
        this.backT = 1.2;
        // Reverse with the wheel the other way (so the nose swings the way it wants to go), held.
        this.backSteer = out.steer > 0.1 ? -1 : out.steer < -0.1 ? 1 : this.backSteer || 1;
      }
    } else this.stuckT = 0;

    // --- Items: use the selected one when it's worth it; if only the other one is, swap to it.
    if (this.opt.items && car.items.length) {
      const rival = sim.cars.find((o) => o !== car && o.phase === 'race');
      const lip = c.lip;
      // A crab goes straight down the road: throw it at a rival close ahead and in line with it (the
      // car pointing down the road), or back at one close behind.
      const crabAim = ((): 'ahead' | 'back' | null => {
        if (!rival || Math.abs(rival.d - car.d) > 2.2) return null;
        const gap = rival.prog - car.prog;
        const straight = Math.abs(wrap(car.heading - pointAt(c, car.s, this.tmp).heading)) < 0.25;
        if (gap > 4 && gap < 45 && straight) return 'ahead';
        if (gap < -3 && gap > -25) return 'back';
        return null;
      })();
      const worth = (it: ItemKind): boolean => {
        if (it === 'grit') return !!threat || (lip !== null && car.s > lip.runupS0);
        if (it === 'jump') {
          const onRamp = lip !== null && car.s > lip.rampS0 + 3;
          const tHit = threat ? (deltaS(c, car.s, threat.s) - k.length / 2) / Math.max(v, 1) : Infinity;
          return onRamp || (blocked && tHit < 0.45 && tHit > 0.1);
        }
        const behind = rival !== undefined ? car.prog - rival.prog : 0;
        if (it === 'poo') return (rival !== undefined && behind > 3 && behind < 30) || (lip !== null && car.s > lip.runupS0 + 10);
        // A refill only pays if there's road left to burn it on before the lip (a race always has more).
        const runway = lip ? (c.length - car.s) / Math.max(v, 5) : Infinity;
        if (it === 'topup') return car.boostFrac < 0.45 && runway > car.boost + TOPUP * k.boostCap + 0.5;
        if (it === 'refill') return car.boostFrac < 0.15 && runway > k.boostCap + 0.5;
        if (it === 'crab') return crabAim !== null;
        // IPO coin: well behind, on the road, with room to ride it before the kicker.
        if (it === 'ipo') return car.grounded && (rival === undefined || behind < -25) && (!lip || car.s < lip.rampS0 - IPO_LIP - 15);
        // Seagull: at a rival that's ahead (or, late on, behind), while they're still well short of the lip.
        if (!lip) return rival !== undefined && behind < -4;
        return rival !== undefined && rival.s < lip.rampS0 - 30 && (rival.s > car.s + 4 || car.s > lip.runupS0 - 70);
      };
      const sel = car.items[car.sel];
      const other = car.items.length > 1 ? car.items[1 - car.sel] : null;
      if (worth(sel)) {
        out.item = !this.lastItem;
        out.back = sel === 'crab' && crabAim === 'back';
      }
      else if (other && worth(other) && !this.lastSwap) out.swap = true;
    }
    this.lastItem = out.item;
    this.lastSwap = out.swap === true;
    return out;
  }

  /**
   * The CPU drifts the big corners: a brake tap at the way in with the wheel turned, then the wheel
   * sets the slide's arc so the direction of travel follows the racing line (a drift steers by its
   * arc, not its nose), unwinding as the corner opens out. With a drift banking boost, a full
   * bottle is spent on the straights rather than wasted.
   */
  private steerDrift(car: RaceCar, out: CarInput, v: number, tgt: { x: number; z: number }): void {
    if (!this.opt.drift || this.turnDir !== 0 || this.backT > 0) return;
    const k = car.stats;
    const dtStep = 1 / 120;
    const dc = this.cornerAt(car.s, 2 + v * 0.14);
    if (car.drift === 0) {
      if (this.tapT > 0) {
        this.tapT -= dtStep;
        out.brake = 1;
        out.steer = this.tapDir;
      } else if (dc && car.grounded && car.s < dc.s0 + 2 && v > DRIFT_MIN + 2 && car.driftCool <= 0) {
        // The tap has to be a fresh press: let a held brake off first.
        if (car.brakeTap === Infinity) {
          this.tapT = 0.08;
          this.tapDir = dc.dir;
          out.brake = 1;
          out.steer = dc.dir;
        } else out.brake = Math.min(out.brake, 0.4);
      }
    } else {
      this.tapT = 0;
      // Steer the direction of travel at the target: the arc it needs sets how hard to bite.
      const dx = tgt.x - car.x;
      const dz = tgt.z - car.z;
      const dist = Math.max(1, Math.hypot(dx, dz));
      const e = wrap(Math.atan2(dz, dx) - Math.atan2(car.vz, car.vx));
      const want = ((2 * Math.sin(e)) / dist) * v * car.drift;
      const bite = (want * Math.max(v, 4)) / driftGrip(k, flatLoad(k));
      out.steer = car.drift * clamp((bite - 0.55) / 0.45, -1, 1);
      if (out.brake > 0) out.brake = Math.min(out.brake, 0.6);
    }
    // Drifts fill the bottle, so before a run of them leave it room: spend down to half on a
    // straight (where the push isn't wasted past the engine's reach), never into a corner. (A race
    // spends it on every straight anyway.)
    const lip = this.sim.course.lip;
    if (!lip) return;
    const toLip = this.sim.course.length - car.s;
    const straight = !this.cornerAt(car.s, 25 + v) && car.drift === 0 && car.grounded;
    const reach = topSpeedIn(k, windAlong(this.sim.wind, car.heading, this.sim.course.loop)) * 0.95;
    if (car.boostFrac > 0.5 && straight && v < reach && car.s < lip.finalS0 && toLip > 150) out.boost = true;
  }

  /** The nearest thing ahead on or near the car's path. */
  private nextThreat(car: RaceCar, range: number): Threat | null {
    const sim = this.sim;
    const c = sim.course;
    let best: Threat | null = null;
    const consider = (s: number, d: number, r: number, tall: boolean): void => {
      const ahead = deltaS(c, car.s, s);
      if (ahead < 0.5 || ahead > range) return;
      if (!best || s < best.s) best = { s, d, r, tall };
    };
    for (const w of sim.waymos) {
      if (w.kind === 'cross') {
        const loc = locate(c, w.x, w.z, w.crossS, 25);
        if (Math.abs(loc.d) < pointAt(c, loc.s, this.tmp).hw + 3) consider(loc.s, loc.d, 1.9, true);
      } else if (Math.abs(deltaS(c, car.s, w.s)) < range + 5) {
        const loc = locate(c, w.x, w.z, w.s, 4);
        consider(loc.s, loc.d, 1.6, true);
      }
    }
    for (const cb of sim.cables) {
      const loc = locate(c, cb.x, cb.z, car.s + 10, 30);
      if (Math.abs(loc.d) >= 8) continue;
      // Points along its body, a few metres apart (a cable car's two ends, more for a streetcar).
      const half = cb.length / 2 - 1.3;
      const n = Math.max(1, Math.ceil((2 * half) / 6));
      for (let k = 0; k <= n; k++) consider(loc.s - half + (2 * half * k) / n, loc.d, 1.6, true);
    }
    for (const p of sim.peds) {
      // (Dogs leap clear by themselves.)
      if (p.down > 0 || p.dive > 0 || p.kind === 'dog') continue;
      if (Math.abs(deltaS(c, car.s, p.s)) > range + 2) continue;
      consider(p.s, p.d, 0.5, true);
    }
    for (const q of sim.poos) {
      if (!q.alive) continue;
      if (Math.abs(deltaS(c, car.s, q.s)) > range + 2) continue;
      const loc = locate(c, q.x, q.z, q.s, 3);
      consider(loc.s, loc.d, 0.6, false);
    }
    return best;
  }
}

/** Race one car on an empty course with the autopilot (the balance check and `predict()`). */
export function driveToEnd(sim: RaceSim, bots: Bot[], maxSteps = 120 * Math.max(200, sim.maxTime + 30)): void {
  sim.start();
  const inputs: CarInput[] = sim.cars.map(() => ({ throttle: 0, brake: 0, steer: 0, item: false, boost: false, swap: false }));
  for (let i = 0; i < maxSteps && !sim.done; i++) {
    for (const b of bots) inputs[b.p] = b.decide();
    sim.step(inputs);
  }
}

// The race: two driven cars on the course, the traffic and tourists they dodge, the item boxes,
// the HYPE they earn, and the launch off the kicker into the flight model. Deterministic with a
// fixed step and a seeded RNG; no Three.js or DOM imports (the bots and the balance check use it).
import {
  COURSE,
  KICKER_ANGLE,
  KICKER_GRADE,
  WALL_HEIGHT,
  heightAt,
  indexAt,
  LOMBARD,
  locate,
  pointAt,
  roadsAt,
  toWorld,
  type Course,
  type CoursePoint,
  type Located,
} from '../track';
import type { CarStats, PlayerIndex } from '../types';
import { DT, G, MAX_FLIGHT_TIME, RHO, makeRng, stepFlightBody } from './physics';

// ---------------------------------------------------------------------------------------------
// Tuning

/** Launch-speed bonus at full HYPE. */
export const HYPE_BOOST = 0.15;
export const HYPE_MAX = 100;
const REVERSE_FORCE = 2600;
const REVERSE_MAX = 5;
export const MAX_YAW = 3.3;
/** Arcade tyres: cornering grip is this multiple of the tyres' friction (braking and traction are not). */
export const CORNER_GRIP = 1.6;
/** Full lock turns the nose this much faster than the tyres can follow: a touch of oversteer. */
export const OVERSTEER = 1.15;
const AIR_YAW = 0.9;
// Drifting: tap the brake while turning at speed and the tail steps out. The slide's arc is set by
// the wheel (Mario Kart style), not by a fragile slip angle, so it's easy to steer on keys.
/** Slowest speed a drift can start at, and the speed it gives up at (m/s). */
export const DRIFT_MIN = 8;
const DRIFT_END = 5;
/** A drift starts when the brake goes down this recently (s) with the wheel turned: a tap, not a
 *  brake held from before the corner. After one ends, the next can't start for a moment. */
const DRIFT_TAP = 0.2;
const DRIFT_COOL = 0.3;
/** Yaw kick that throws the tail out (rad/s). */
const DRIFT_KICK = 2.2;
/** The nose's angle to the direction of travel: wheel let go, and turned into the slide (rad). */
const DRIFT_SLIP = 0.3;
const DRIFT_SLIP_MAX = 0.62;
/** How hard the nose chases that angle (1/s), and the fastest it may yaw (rad/s). */
const DRIFT_HOLD = 8;
const DRIFT_YAW = 4.2;
/** Sideways grip while sliding with the wheel turned into it (× the tyres' friction): tighter than
 *  plain cornering (CORNER_GRIP), which is what makes a drift the fast way round. */
export const DRIFT_GRIP = 2.4;
/** Share of that the slide keeps with the wheel let go (a wider arc) and counter-steered. */
const DRIFT_BITE = 0.55;
const DRIFT_BITE_OUT = 0.1;
/** Speed a slide scrubs off, at full bite (× the tyres' load). */
const DRIFT_SCRUB = 0.3;
/** Share of the tyres' traction left for the engine while they slide sideways. */
const DRIFT_TRACTION = 0.55;
/** Seconds without steering into the slide before the tyres grip again. */
const DRIFT_RELEASE = 0.3;
/** Seconds of boost a flat-out drift earns per second. */
export const DRIFT_CHARGE = 0.5;
// Boost: a rocket push from the bottle while the boost key is held.
/** Push at full thrust (m/s², the same for every car). */
export const BOOST_ACC = 6;
/** How far past the engine's top speed boost can take the car (× top speed); it fades on the way. */
export const BOOST_TOP = 1.1;
/** Item top-up: share of the bottle it refills. */
export const TOPUP = 0.5;
/** How much the wind shifts an engine's top speed (m/s per m/s of tailwind). */
const WIND_TOP = 0.3;
/** How fast the nose eases back along the road when nobody is steering (rad/s). */
const ASSIST = 0.35;
/** How fast the smoothed wheel follows the stick or keys (full lock per second). */
const STEER_RATE = 8;
const WALL_E = 0.18;
/** The furthest a wall pushes a car out in one step (m): overlaps resolve as a quick slide. */
const WALL_PUSH = 0.25;
/** Impact speed (m/s, into the wall) beyond which a wall hit is a crash that costs extra. */
const WALL_HARD = 8;
const CAR_E = 0.35;
/** After the first car finishes, the other has this long to reach the lip. */
export const STRAGGLER_TIME = 25;
export const MAX_RACE_TIME = 150;
const ROULETTE_TIME = 0.9;
/** Items a car can hold at once. */
export const ITEM_SLOTS = 2;
const GRIT_TIME = 12;
/** Seagull: flying speed (m/s), how long it pesters the car it lands on, and how long it may hunt. */
const GULL_SPEED = 44;
const GULL_TIME = 1.8;
const GULL_LIFE = 8;
const SPIN_TIME = 1.05;
const WAYMO_MASS = 2300;
const PED_R = 0.42;
/** Half-width of the road where the course crosses the Embarcadero. */
const RH_CROSS = 7;
const POO_R = 0.55;
const BOX_R = 1.25;
/** Seconds without progress before a wedged car is put back on the road. */
const STUCK_TIME = 6;
/** Share of the Jump's spring that goes into the launch when it's used on the kicker. */
const KICKER_JUMP = 0.5;
/** The kicker holds its full angle (KICKER_ANGLE, 25°) for the first car to reach it, then drops
 *  this fast (2°/s) down to this (12°): every second behind costs a chasing car about 5% of its
 *  distance, and at most about a third. */
export const RAMP_RATE = (2 * Math.PI) / 180;
export const RAMP_MIN = (12 * Math.PI) / 180;
/** Seconds of driving the wrong way before the marshals turn the car round. */
const WRONG_WAY_TIME = 5;

// ---------------------------------------------------------------------------------------------
// Types

export type ItemKind = 'jump' | 'grit' | 'poo' | 'topup' | 'refill' | 'gull';

export const ITEM_KINDS: readonly ItemKind[] = ['jump', 'grit', 'poo', 'topup', 'refill', 'gull'];

export const ITEM_NAMES: Record<ItemKind, string> = {
  jump: 'Jump',
  grit: 'Determination',
  poo: 'Poo',
  topup: 'Boost top-up',
  refill: 'Full boost',
  gull: 'Seagull',
};

export interface CarInput {
  throttle: number;
  brake: number;
  /** -1 (left) .. 1 (right). */
  steer: number;
  /** True on the step the item key goes down. */
  item: boolean;
  /** Boost key held. */
  boost?: boolean;
  /** True on the step the swap key goes down (switch to the other held item). */
  swap?: boolean;
}

export const NO_INPUT: CarInput = { throttle: 0, brake: 0, steer: 0, item: false, boost: false, swap: false };

export type CarPhase = 'grid' | 'race' | 'flight' | 'splashed' | 'dnf';

export interface Tally {
  waymo: number;
  ped: number;
  poo: number;
  walls: number;
  shoves: number;
  shoved: number;
  items: number;
  pooLanded: number;
  air: number;
  drift: number;
  /** Seconds of boost earned by drifting, and spent. */
  driftBoost: number;
  boostUsed: number;
  nearMiss: number;
  overtakes: number;
  shortcuts: number;
  plowed: number;
  topSpeed: number;
  rocket: boolean;
  lead: number;
  /** Seagulls landed on the rival, and seagulls shooed away with Determination. */
  gulls: number;
  shooed: number;
}

export interface RaceCar {
  p: PlayerIndex;
  stats: CarStats;
  phase: CarPhase;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  yawRate: number;
  s: number;
  d: number;
  grounded: boolean;
  airTime: number;
  /** Smoothed controls. */
  steer: number;
  throttle: number;
  brake: number;
  /** Seconds of boost left in the bottle, and as a share of it. */
  boost: number;
  boostFrac: number;
  /** The boost is firing this step. */
  boosting: boolean;
  engineOn: boolean;
  wheelspin: boolean;
  /** Tyres sliding; slip angle (nose minus direction of travel) in radians. */
  sliding: boolean;
  slip: number;
  /** Drifting left (-1) or right (1), or not (0); for how long; seconds since the wheel last
   *  turned into it; how fast the slide is swinging the car round (rad/s); how hard it's biting
   *  (0..1, from the wheel); boost it has earned; seconds before the next can start. */
  drift: number;
  driftT: number;
  driftOff: number;
  driftTurn: number;
  driftBite: number;
  driftGain: number;
  driftCool: number;
  /** Seconds the drift has been in the air (a short hop keeps it). */
  driftAir: number;
  /** Seconds since the brake last went down (Infinity while it's up). */
  brakeTap: number;
  /** Held items (at most ITEM_SLOTS) and which one the item key uses. */
  items: ItemKind[];
  sel: number;
  /** Seconds left on the item roulette. */
  roulette: number;
  /** Seconds of Determination left (it also ends on the first hit). */
  grit: number;
  spin: number;
  /** Seconds left with a seagull flapping on the windscreen. */
  gullT: number;
  /** Length of the current spin-out (grippy wheels shorten it). */
  spinDur: number;
  spinHeading0: number;
  spinDir: number;
  stun: number;
  /** 0..1 slipstream behind the other car. */
  draft: number;
  hype: number;
  wrongWay: number;
  /** Seconds spent facing the wrong way (moving or not). */
  backwardsT: number;
  kiteOpen: boolean;
  wingsOpen: boolean;
  runTime: number;
  flightTime: number;
  launchSpeed: number;
  launchBoost: number;
  /** The kicker's angle when the car went off it (radians). */
  launchRamp: number;
  /** Share of the bottle still unspent at the lip (wasted). */
  wastedBoostFrac: number;
  distance: number;
  maxHeight: number;
  wheelspinTime: number;
  bumpsHit: number;
  splashT: number | null;
  entryDeg: number;
  tally: Tally;
  /** Throttle held on the grid since (sim time), for the rocket start. */
  gridHeld: number | null;
  /** Seconds after GO in which pressing the gas still gives a rocket start. */
  rocketWindow: number;
  /** Progress check for the stuck rescue. */
  stuckS: number;
  stuckT: number;
  /** Near misses already counted, by obstacle id. */
  missed: Set<number>;
  overtakeCd: number;
  /** Collision circles along the car ([offset, radius]). */
  circles: [number, number][];
  /** A shortcut already paid on this jump. */
  jumpShortcut: boolean;
  /** Airborne off the road (over a hedge, a flower bed, a corner): where it left the tarmac (-1 when
   *  it hasn't) and how far it has flown since, to see how much route it cut when it's back. */
  hopS: number;
  hopDist: number;
  /** A hop that cut the course: the landing lines the car up with the road (arcade kindness). */
  hopLand: boolean;
  /** Close passes that become near misses if nothing is hit in the next moment (id → race time). */
  nearPending: Map<number, { t: number; what: Obstacle }>;
  /** After ploughing through a Waymo, ignore that one Waymo for a moment. */
  ghostId: number;
  ghostT: number;
}

export interface Waymo {
  id: number;
  kind: 'traffic' | 'stalled' | 'cross';
  x: number;
  z: number;
  y: number;
  heading: number;
  /** Heading when parked or stalled (before any knock). */
  baseHeading: number;
  /** Course Waymos: progress and lane. Cross traffic: position along its lane (z = dir * s). */
  s: number;
  d: number;
  v: number;
  vTarget: number;
  /** Where course traffic pulls over and parks. */
  sEnd: number;
  /** Cross traffic: the lane's x and direction (+1 = +z). */
  laneX: number;
  dir: 1 | -1;
  /** Displacement from its path after a knock, and its velocity; both decay. */
  px: number;
  pz: number;
  pvx: number;
  pvz: number;
  spinV: number;
  spinA: number;
  /** Seconds stopped (confused after a knock). */
  stopped: number;
  /** Where a parking Waymo is gliding to at the kerb. */
  parkD: number;
  hazard: boolean;
  cone: boolean;
  parked: boolean;
}

export interface Ped {
  id: number;
  kind: 'crosser' | 'tourist';
  x: number;
  z: number;
  y: number;
  heading: number;
  s: number;
  d: number;
  /** Crossers walk between d0 and d1. */
  d0: number;
  d1: number;
  dir: 1 | -1;
  speed: number;
  wait: number;
  /** Knocked over: seconds left before they wobble back up, and which way they fell. */
  down: number;
  fallX: number;
  fallZ: number;
  /** Dived out of the way of a determined driver. */
  dive: number;
  walk: number;
  look: number;
  color: number;
}

export interface Poo {
  id: number;
  x: number;
  y: number;
  z: number;
  s: number;
  owner: PlayerIndex;
  alive: boolean;
  age: number;
}

export interface ItemBox {
  id: number;
  s: number;
  d: number;
  x: number;
  y: number;
  z: number;
  hidden: number;
}

/** A seagull from the item: it flies down the course (over the road, not through the houses) to the
 *  rival, flaps on their windscreen for a moment and flies off. */
export interface Gull {
  id: number;
  owner: PlayerIndex;
  target: PlayerIndex;
  x: number;
  y: number;
  z: number;
  heading: number;
  /** Course position it flies above. */
  s: number;
  d: number;
  age: number;
  state: 'hunt' | 'perch' | 'leave';
  stateT: number;
}

export interface CableCar {
  x: number;
  y: number;
  z: number;
  heading: number;
  v: number;
  /** Position along the Hyde St rails (z), shuttling between z0 and z1. */
  along: number;
  z0: number;
  z1: number;
  dir: 1 | -1;
  /** Seconds left waiting at the end of the line. */
  dwell: number;
  bell: number;
}

export interface LooseCone {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  rz: number;
  spin: number;
  hit: boolean;
  ground: number;
}

export type Obstacle = 'waymo' | 'ped' | 'poo' | 'cable' | 'cone' | 'gull';

export type RaceEvent =
  | { type: 'go'; t: number }
  | { type: 'rocket'; t: number; p: PlayerIndex; good: boolean }
  | { type: 'bump'; t: number; p: PlayerIndex; s: number; keLostJ: number }
  | { type: 'drift'; t: number; p: PlayerIndex; dir: number }
  | { type: 'driftEnd'; t: number; p: PlayerIndex; time: number; gain: number }
  | { type: 'boostEmpty'; t: number; p: PlayerIndex; s: number }
  | { type: 'boostGain'; t: number; p: PlayerIndex; amount: number; full: boolean }
  | { type: 'takeoff'; t: number; p: PlayerIndex; speed: number }
  | { type: 'land'; t: number; p: PlayerIndex; impact: number; air: number }
  | { type: 'wall'; t: number; p: PlayerIndex; impact: number; x: number; y: number; z: number }
  | { type: 'shove'; t: number; p: PlayerIndex; victim: PlayerIndex; impact: number; ram: string; x: number; y: number; z: number }
  | { type: 'hit'; t: number; p: PlayerIndex; what: Obstacle; id: number; impact: number; plowed: boolean; x: number; y: number; z: number }
  | { type: 'nearMiss'; t: number; p: PlayerIndex; what: Obstacle }
  | { type: 'overtake'; t: number; p: PlayerIndex }
  | { type: 'box'; t: number; p: PlayerIndex; id: number; got: boolean }
  | { type: 'item'; t: number; p: PlayerIndex; item: ItemKind }
  | { type: 'use'; t: number; p: PlayerIndex; item: ItemKind; x: number; y: number; z: number }
  | { type: 'swap'; t: number; p: PlayerIndex; item: ItemKind }
  | { type: 'gull'; t: number; p: PlayerIndex; by: PlayerIndex; shooed: boolean; x: number; y: number; z: number }
  | { type: 'honk'; t: number; p: PlayerIndex }
  | { type: 'spinout'; t: number; p: PlayerIndex; by: PlayerIndex | null }
  | { type: 'shortcut'; t: number; p: PlayerIndex; s: number; gained: number }
  | { type: 'hype'; t: number; p: PlayerIndex; amount: number; why: string }
  | { type: 'rescue'; t: number; p: PlayerIndex }
  | { type: 'bell'; t: number }
  | { type: 'pierFirst'; t: number; p: PlayerIndex }
  | { type: 'launch'; t: number; p: PlayerIndex; speed: number; speedBeforeNitro: number; wastedBoostFrac: number; boost: number; ramp: number }
  | { type: 'rampDrop'; t: number; p: PlayerIndex }
  | { type: 'wingsOpen'; t: number; p: PlayerIndex; x: number; y: number }
  | { type: 'splash'; t: number; p: PlayerIndex; distance: number; x: number; z: number; speed: number }
  | { type: 'dnf'; t: number; p: PlayerIndex; s: number; reason: 'timeout' | 'straggler' };

export interface RaceOptions {
  seed?: number;
  /** Traffic, tourists and the cable car (default true). */
  obstacles?: boolean;
  /** Item boxes (default true). */
  items?: boolean;
  /** HYPE boosts the launch (default true; the balance check turns it off to compare builds). */
  hype?: boolean;
}

export interface CarResult {
  distance: number;
  dnf: boolean;
  runTime: number;
  flightTime: number;
  launchSpeed: number;
  launchBoost: number;
  /** The kicker's angle at launch (radians). */
  launchRamp: number;
  hype: number;
  wastedBoostFrac: number;
  wheelspinTime: number;
  maxHeight: number;
  bumpsHit: number;
  /** Angle below the horizontal at which the car hit the water (degrees). */
  entryDeg: number;
  tally: Tally;
}

// ---------------------------------------------------------------------------------------------

const TWO_PI = Math.PI * 2;
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const wrapAngle = (a: number): number => {
  while (a > Math.PI) a -= TWO_PI;
  while (a < -Math.PI) a += TWO_PI;
  return a;
};

function newTally(): Tally {
  return {
    waymo: 0,
    ped: 0,
    poo: 0,
    walls: 0,
    shoves: 0,
    shoved: 0,
    items: 0,
    pooLanded: 0,
    air: 0,
    drift: 0,
    driftBoost: 0,
    boostUsed: 0,
    nearMiss: 0,
    overtakes: 0,
    shortcuts: 0,
    plowed: 0,
    topSpeed: 0,
    rocket: false,
    lead: 0,
    gulls: 0,
    shooed: 0,
  };
}

/** Collision circles along a body: [offset along the heading, radius]. */
export function bodyCircles(length: number, width: number): [number, number][] {
  const r = width / 2;
  const n = Math.max(2, Math.ceil(length / width));
  const a = Math.max(0, length / 2 - r);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) out.push([n === 1 ? 0 : -a + (2 * a * i) / (n - 1), r]);
  return out;
}

const WAYMO_LEN = 4.7;
const WAYMO_W = 2.0;
const WAYMO_CIRCLES = bodyCircles(WAYMO_LEN, WAYMO_W);
const CABLE_LEN = 8.6;
const CABLE_W = 2.6;
const CABLE_CIRCLES = bodyCircles(CABLE_LEN, CABLE_W);
/** How close a pass has to be to count as a near miss, and the bodies grown by it. */
const NEAR_MARGIN = 0.9;
const grow = (cs: [number, number][]): [number, number][] => cs.map(([o, r]) => [o, r + NEAR_MARGIN]);
const WAYMO_NEAR = grow(WAYMO_CIRCLES);
const CABLE_NEAR = grow(CABLE_CIRCLES);
const PED_NEAR = grow([[0, PED_R]]);
export const WAYMO_DIMS = { length: WAYMO_LEN, width: WAYMO_W, height: 1.75 };
export const CABLE_DIMS = { length: CABLE_LEN, width: CABLE_W, height: 3.4 };

interface Contact {
  /** Normal from B to A. */
  nx: number;
  nz: number;
  depth: number;
  /** Contact point. */
  cx: number;
  cz: number;
  /** Which of A's circles touched (index into its circle list). */
  ia: number;
}

/** Deepest contact between two circle chains, or null. */
function contact(
  ax: number,
  az: number,
  ah: number,
  ac: [number, number][],
  bx: number,
  bz: number,
  bh: number,
  bc: [number, number][],
): Contact | null {
  const afx = Math.cos(ah);
  const afz = Math.sin(ah);
  const bfx = Math.cos(bh);
  const bfz = Math.sin(bh);
  let best: Contact | null = null;
  for (let i = 0; i < ac.length; i++) {
    const [oa, ra] = ac[i];
    const pax = ax + afx * oa;
    const paz = az + afz * oa;
    for (const [ob, rb] of bc) {
      const pbx = bx + bfx * ob;
      const pbz = bz + bfz * ob;
      const dx = pax - pbx;
      const dz = paz - pbz;
      const d2 = dx * dx + dz * dz;
      const rr = ra + rb;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 1e-6;
      const depth = rr - d;
      if (!best || depth > best.depth) {
        best = { nx: dx / d, nz: dz / d, depth, cx: pbx + (dx / d) * rb, cz: pbz + (dz / d) * rb, ia: i };
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------

export class RaceSim {
  readonly course: Course;
  readonly wind: number;
  readonly cars: RaceCar[];
  readonly waymos: Waymo[] = [];
  readonly peds: Ped[] = [];
  readonly poos: Poo[] = [];
  readonly boxes: ItemBox[] = [];
  readonly cones: LooseCone[] = [];
  readonly gulls: Gull[] = [];
  cable: CableCar | null = null;
  readonly opts: Required<RaceOptions>;
  /** Sim time since construction (the countdown runs on the grid). */
  t = 0;
  /** Time since GO. */
  raceT = 0;
  started = false;
  /** When the first car finished (splashed or out), in race time. */
  firstDoneAt: number | null = null;
  private readonly rng: () => number;
  private nextId = 1;
  private readonly tmp: CoursePoint;
  private readonly tmp2: CoursePoint;
  private readonly tmpW: CoursePoint;
  private readonly loc: Located = { s: 0, d: 0, i: 0 };
  private leader: PlayerIndex = 0;
  /** Who reached the pier first (a HYPE bonus for winning the race to it). */
  pierFirst: PlayerIndex | null = null;
  /** The kicker's angle now (radians): full until the first car goes off it, then dropping. */
  rampAngle = KICKER_ANGLE;
  /** Race time the first car went off the kicker (the ramp has been dropping since), or null. */
  rampDropAt: number | null = null;
  /** The kicker's rise as a share of its full height, and where the (flat) pier hands over to it. */
  private rampScale = 1;
  private readonly rampFrom: number;
  /** Lombard's block (gardens between the switchbacks): its x extent and where its side walls are. */
  private readonly garden: { x0: number; x1: number; zWall: number; gate: number };

  constructor(stats: CarStats[], wind: number, opts: RaceOptions = {}, course: Course = COURSE) {
    this.course = course;
    const lomb = course.sections.find((q) => q.kind === 'lombard');
    this.garden = lomb
      ? { x0: lomb.xMin + 0.5, x1: lomb.xMax - 0.5, zWall: LOMBARD.bandHalf - 0.9, gate: 7.5 }
      : { x0: Infinity, x1: -Infinity, zWall: Infinity, gate: 0 };
    this.wind = wind;
    this.rampFrom = course.marks.kickerS0 - 1;
    this.opts = { seed: opts.seed ?? 1, obstacles: opts.obstacles ?? true, items: opts.items ?? true, hype: opts.hype ?? true };
    this.rng = makeRng(this.opts.seed * 7919 + 17);
    this.tmp = { ...course.points[0] };
    this.tmp2 = { ...course.points[0] };
    this.tmpW = { ...course.points[0] };
    this.cars = stats.map((st, i) => this.makeCar(i as PlayerIndex, st, stats.length));
    if (this.opts.items) this.placeBoxes();
    if (this.opts.obstacles) this.placeObstacles();
  }

  private makeCar(p: PlayerIndex, stats: CarStats, n: number): RaceCar {
    const slot = n === 1 ? { s: this.course.grid[0].s, d: 0 } : this.course.grid[p];
    const w = toWorld(this.course, slot.s, slot.d);
    return {
      p,
      stats,
      phase: 'grid',
      x: w.x,
      y: w.y,
      z: w.z,
      vx: 0,
      vy: 0,
      vz: 0,
      heading: w.heading,
      yawRate: 0,
      s: slot.s,
      d: slot.d,
      grounded: true,
      airTime: 0,
      steer: 0,
      throttle: 0,
      brake: 0,
      boost: stats.boostCap,
      boostFrac: stats.boostCap > 0 ? 1 : 0,
      boosting: false,
      engineOn: false,
      wheelspin: false,
      sliding: false,
      slip: 0,
      drift: 0,
      driftT: 0,
      driftOff: 0,
      driftTurn: 0,
      driftBite: 0,
      driftGain: 0,
      driftCool: 0,
      driftAir: 0,
      brakeTap: Infinity,
      items: [],
      sel: 0,
      roulette: 0,
      grit: 0,
      spin: 0,
      gullT: 0,
      spinDur: SPIN_TIME,
      spinHeading0: 0,
      spinDir: 1,
      stun: 0,
      draft: 0,
      hype: 0,
      wrongWay: 0,
      backwardsT: 0,
      kiteOpen: false,
      wingsOpen: false,
      runTime: 0,
      flightTime: 0,
      launchSpeed: 0,
      launchBoost: 0,
      launchRamp: KICKER_ANGLE,
      wastedBoostFrac: 0,
      distance: 0,
      maxHeight: this.course.lip.y,
      wheelspinTime: 0,
      bumpsHit: 0,
      splashT: null,
      entryDeg: 0,
      tally: newTally(),
      gridHeld: null,
      rocketWindow: 0,
      stuckS: slot.s,
      stuckT: 0,
      missed: new Set(),
      overtakeCd: 0,
      circles: bodyCircles(stats.length, stats.width),
      jumpShortcut: false,
      hopS: -1,
      hopDist: 0,
      hopLand: false,
      nearPending: new Map(),
      ghostId: 0,
      ghostT: 0,
    };
  }

  // ---------------------------------------------------------------------------------------------
  // World setup (seeded per round, so every race is a little different)

  private placeBoxes(): void {
    const c = this.course;
    const m = c.marks;
    const rows: { s: number; ds: number[] }[] = [
      { s: 62, ds: [-4.2, 0, 4.2] },
      { s: m.hydeS0 + 30, ds: [-4.2, 0, 4.2] },
      { s: m.lombardS0 + (m.lombardS1 - m.lombardS0) * 0.46, ds: [-2.2, 2.2] },
      { s: m.lombardS1 + 34, ds: [-4.2, 0, 4.2] },
      { s: m.pierS0 + 6, ds: [-4.2, 0, 4.2] },
    ];
    for (const row of rows) {
      for (const d of row.ds) {
        const w = toWorld(c, row.s, d);
        this.boxes.push({ id: this.nextId++, s: row.s, d, x: w.x, y: w.y, z: w.z, hidden: 0 });
      }
    }
  }

  private placeObstacles(): void {
    const c = this.course;
    const m = c.marks;
    const r = this.rng;
    const blocks = c.sections.filter((q) => q.kind === 'block');
    // Traffic creeping down the first two blocks and pulling over before the Hyde St corner.
    const firstRun: [number, number] = [blocks[0].s0 + 10, blocks[1].s1 - 16];
    const lastRun: [number, number] = [blocks[2].s0 + 4, blocks[3].s1 - 8];
    const traffic = (s: number, d: number, v: number, sEnd: number): void => {
      const w = toWorld(c, s, d);
      this.waymos.push(this.makeWaymo('traffic', w.x, w.z, w.y, w.heading, s, d, v, sEnd));
    };
    traffic(firstRun[0] + 28 + r() * 30, r() < 0.5 ? -3.4 : 3.4, 4 + r() * 2, firstRun[1]);
    traffic(firstRun[0] + 95 + r() * 30, r() < 0.5 ? -3.4 : 3.4, 3.5 + r() * 2, firstRun[1]);
    traffic(lastRun[0] + 70 + r() * 35, r() < 0.5 ? -3.4 : 3.4, 3 + r() * 2.5, lastRun[1]);
    // A stalled Waymo with a traffic cone on its hood (SF's favourite protest), hazards on.
    {
      const s = blocks[2].s0 + 22 + r() * 24;
      const d = (r() < 0.5 ? -1 : 1) * (1.5 + r() * 2.2);
      const w = toWorld(c, s, d);
      // Facing uphill, so the cone on its hood faces the racers coming down.
      const wm = this.makeWaymo('stalled', w.x, w.z, w.y, w.heading + Math.PI + (r() - 0.5) * 0.5, s, d, 0, s);
      wm.cone = true;
      wm.hazard = true;
      this.waymos.push(wm);
      // A few loose cones around it.
      for (let i = 0; i < 3; i++) {
        const cs = s - 6 - i * 2.2;
        const cd = d + (r() - 0.5) * 3;
        const cw = toWorld(c, cs, clamp(cd, -6, 6));
        this.cones.push({ id: this.nextId++, x: cw.x, y: cw.y, z: cw.z, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0, spin: 0, hit: false, ground: cw.y });
      }
    }
    // Cross traffic on the Embarcadero: one lane each way. They brake for anything in their path.
    const embX = c.embX;
    const lanes: [number, 1 | -1][] = [
      [embX + 5.4, 1],
      [embX + 19.5, -1],
    ];
    for (const [lx, dir] of lanes) {
      let z = -dir * (60 + r() * 40);
      for (let k = 0; k < 3; k++) {
        const wm = this.makeWaymo('cross', lx, z, c.deckY, dir > 0 ? Math.PI / 2 : -Math.PI / 2, z * dir, 0, 7 + r() * 1.5, 0);
        wm.laneX = lx;
        wm.dir = dir;
        this.waymos.push(wm);
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
      this.cable = { x: h0.x, y: h0.y, z: along, heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2, v: 0, along, z0, z1, dir, dwell: 0, bell: 2 + r() * 3 };
    }
    // Pedestrians on the crosswalks: each walks across and back, pausing at the kerb.
    const walks = [...c.crosswalks];
    for (const cw of walks) {
      if (r() < 0.25) continue;
      const n = 1 + (r() < 0.4 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const s = cw.s0 + 0.6 + r() * (cw.s1 - cw.s0 - 1.2);
        const hw = pointAt(c, s).hw;
        const d0 = -hw - 1.2;
        const d1 = hw + 1.2;
        const d = d0 + r() * (d1 - d0);
        const dir: 1 | -1 = r() < 0.5 ? 1 : -1;
        this.peds.push(this.makePed('crosser', s, d, d0, d1, dir, 1.1 + r() * 0.5, r() * 2));
      }
    }
    // Tourists on Lombard, in the road for the perfect photo.
    const span = m.lombardS1 - m.lombardS0;
    for (let k = 0; k < 4; k++) {
      const s = m.lombardS0 + span * (0.14 + 0.21 * k + r() * 0.08);
      const hw = pointAt(c, s).hw;
      const d = (r() * 2 - 1) * (hw - 1);
      const p = this.makePed('tourist', s, d, d, d, 1, 0, 0);
      p.speed = r() < 0.4 ? 0.5 : 0;
      p.d0 = -hw + 0.8;
      p.d1 = hw - 0.8;
      this.peds.push(p);
    }
  }

  private makeWaymo(
    kind: Waymo['kind'],
    x: number,
    z: number,
    y: number,
    heading: number,
    s: number,
    d: number,
    v: number,
    sEnd: number,
  ): Waymo {
    return {
      id: this.nextId++,
      kind,
      x,
      z,
      y,
      heading,
      baseHeading: heading,
      s,
      d,
      v: 0,
      vTarget: v,
      sEnd,
      laneX: 0,
      dir: 1,
      px: 0,
      pz: 0,
      pvx: 0,
      pvz: 0,
      spinV: 0,
      spinA: 0,
      stopped: 0,
      parkD: 0,
      hazard: kind === 'stalled',
      cone: false,
      parked: kind === 'stalled',
    };
  }

  private makePed(kind: Ped['kind'], s: number, d: number, d0: number, d1: number, dir: 1 | -1, speed: number, wait: number): Ped {
    const w = toWorld(this.course, s, d);
    return {
      id: this.nextId++,
      kind,
      x: w.x,
      z: w.z,
      y: w.y,
      heading: w.heading + (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      s,
      d,
      d0,
      d1,
      dir,
      speed,
      wait,
      down: 0,
      fallX: 0,
      fallZ: 0,
      dive: 0,
      walk: this.rng() * 10,
      look: this.rng() * TWO_PI,
      color: Math.floor(this.rng() * 1000),
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Public API

  get done(): boolean {
    return this.cars.every((c) => c.phase === 'splashed' || c.phase === 'dnf');
  }

  /** Road height at s, with the kicker at its angle right now. */
  roadY(s: number): number {
    const h = heightAt(this.course, s);
    return this.rampScale === 1 || s <= this.rampFrom ? h : this.course.deckY + (h - this.course.deckY) * this.rampScale;
  }

  /** The road's grade at a course point (the kicker's is its slope right now). */
  gradeAt(pt: CoursePoint): number {
    return this.rampScale === 1 || pt.s <= this.rampFrom ? pt.grade : pt.grade * this.rampScale;
  }

  /** The kicker drops once the first car is off it: whoever is behind launches lower. */
  private updateRamp(): void {
    if (this.rampDropAt === null || this.rampAngle <= RAMP_MIN) return;
    this.rampAngle = Math.max(RAMP_MIN, KICKER_ANGLE - RAMP_RATE * (this.raceT - this.rampDropAt));
    this.rampScale = Math.tan(this.rampAngle) / KICKER_GRADE;
    // Poo dropped on the ramp goes down with it.
    for (const q of this.poos) if (q.s > this.rampFrom) q.y = this.roadY(q.s);
  }

  /** GO: release the cars. Throttle held from a beat before GO gives a rocket start. */
  start(): RaceEvent[] {
    const ev: RaceEvent[] = [{ type: 'go', t: this.t }];
    this.started = true;
    for (const car of this.cars) {
      car.phase = 'race';
      if (car.gridHeld === null) {
        // Hitting the gas as GO lands still counts.
        car.rocketWindow = 0.15;
        continue;
      }
      const held = this.t - car.gridHeld;
      if (held <= 0.6) {
        this.rocket(car, ev);
      } else if (held > 1.4) {
        // Revving through the whole countdown bogs the engine down.
        car.stun = 0.7;
        ev.push({ type: 'rocket', t: this.t, p: car.p, good: false });
      }
    }
    return ev;
  }

  /** Nailed the start: a shove off the line. */
  private rocket(car: RaceCar, ev: RaceEvent[]): void {
    const v = 7;
    car.vx = Math.cos(car.heading) * v;
    car.vz = Math.sin(car.heading) * v;
    car.tally.rocket = true;
    this.addHype(car, 8, 'rocket start', ev);
    ev.push({ type: 'rocket', t: this.t, p: car.p, good: true });
  }

  step(inputs: readonly CarInput[]): RaceEvent[] {
    const ev: RaceEvent[] = [];
    const dt = DT;
    this.t += dt;
    if (!this.started) {
      for (const car of this.cars) {
        const inp = inputs[car.p] ?? NO_INPUT;
        if (inp.throttle > 0.5) car.gridHeld ??= this.t;
        else car.gridHeld = null;
        car.throttle = inp.throttle;
      }
      return ev;
    }
    this.raceT += dt;
    this.updateRamp();
    this.updateWorld(dt, ev);
    for (const car of this.cars) {
      if (car.phase === 'race') this.drive(car, inputs[car.p] ?? NO_INPUT, dt, ev);
    }
    this.carVsCar(ev);
    for (const car of this.cars) {
      if (car.phase !== 'race') continue;
      this.hitObstacles(car, ev);
      this.settleNearMisses(car, ev);
      // Collisions can shove a car: find it on the road again and keep it inside the walls.
      const loc = locate(this.course, car.x, car.z, car.s, 4, this.loc);
      car.s = loc.s;
      car.d = loc.d;
      this.walls(car, ev);
      this.pickups(car, dt, ev);
      this.useItem(car, inputs[car.p] ?? NO_INPUT, ev);
      this.checkLip(car, ev);
    }
    for (const car of this.cars) if (car.phase === 'flight') this.fly(car, dt, ev);
    this.raceHype(dt, ev);
    this.endRules(ev);
    return ev;
  }

  results(): CarResult[] {
    return this.cars.map((c) => ({
      distance: c.phase === 'dnf' ? 0 : c.distance,
      dnf: c.phase === 'dnf',
      runTime: c.runTime,
      flightTime: c.flightTime,
      launchSpeed: c.launchSpeed,
      launchBoost: c.launchBoost,
      launchRamp: c.launchRamp,
      hype: c.hype,
      wastedBoostFrac: c.wastedBoostFrac,
      wheelspinTime: c.wheelspinTime,
      maxHeight: c.maxHeight,
      bumpsHit: c.bumpsHit,
      entryDeg: c.entryDeg,
      tally: { ...c.tally },
    }));
  }

  /** Race order by progress (index 0 leads). Launched cars are ahead of any still on the road. */
  order(): PlayerIndex[] {
    const key = (c: RaceCar): number => (c.phase === 'race' || c.phase === 'grid' ? c.s : this.course.length + 1000 - (c.runTime || 0));
    return [...this.cars].sort((a, b) => key(b) - key(a)).map((c) => c.p);
  }

  // ---------------------------------------------------------------------------------------------
  // Driving

  private drive(car: RaceCar, inp: CarInput, dt: number, ev: RaceEvent[]): void {
    const C = this.course;
    const k = car.stats;
    const m = k.mass;

    // Controls: the wheel follows the input at a finite rate (keys feel smooth, not twitchy).
    const want = clamp(inp.steer, -1, 1);
    car.steer += clamp(want - car.steer, -STEER_RATE * dt, STEER_RATE * dt);
    let T = clamp(inp.throttle, 0, 1);
    let B = clamp(inp.brake, 0, 1);
    if (B > 0.5) car.brakeTap = car.brakeTap === Infinity ? 0 : car.brakeTap + dt;
    else car.brakeTap = Infinity;
    let S = car.steer;
    if (car.stun > 0) {
      car.stun -= dt;
      T = 0;
      B = 0;
      S *= 0.25;
    }
    if (car.spin > 0) {
      T = 0;
      B = 0;
      S = 0;
    }
    // A seagull on the windscreen: you can't see where you're going, so you lift and weave.
    if (car.gullT > 0) {
      car.gullT -= dt;
      T = Math.min(T, 0.45);
      S = clamp(S + 0.5 * Math.sin(this.raceT * 7.1 + car.p * 2.3), -1, 1);
    }
    car.throttle = T;
    car.brake = B;
    if (car.rocketWindow > 0) {
      car.rocketWindow -= dt;
      if (T > 0.5) {
        car.rocketWindow = 0;
        this.rocket(car, ev);
      }
    }

    const pt = pointAt(C, car.s, this.tmp);
    const grade = car.grounded ? this.gradeAt(pt) : 0;
    const cosT = 1 / Math.sqrt(1 + grade * grade);
    const speed2 = car.vx * car.vx + car.vz * car.vz;
    const down = car.grounded ? 0.5 * RHO * k.downforce * speed2 : 0;
    const N = car.grounded ? m * G * cosT + down : 0;
    const mu = k.mu;

    let fx = Math.cos(car.heading);
    let fz = Math.sin(car.heading);
    let vf = car.vx * fx + car.vz * fz;

    // --- Drift: tap the brake while turning at speed and the tail steps out. Hold the wheel into the
    // slide for a tight arc; let it go for a wider one, and after a moment the tyres grip again.
    if (car.drift === 0) {
      car.driftCool = Math.max(0, car.driftCool - dt);
      const tap = car.brakeTap <= DRIFT_TAP;
      if (car.grounded && car.spin <= 0 && car.stun <= 0 && tap && Math.abs(want) > 0.5 && vf > DRIFT_MIN && car.driftCool <= 0) {
        car.drift = want > 0 ? 1 : -1;
        car.driftT = 0;
        car.driftOff = 0;
        car.driftTurn = 0;
        car.driftGain = 0;
        car.driftAir = 0;
        car.yawRate += car.drift * DRIFT_KICK;
        ev.push({ type: 'drift', t: this.t, p: car.p, dir: car.drift });
      }
    } else {
      car.driftT += dt;
      const into = S * car.drift;
      car.driftOff = into > 0.3 ? 0 : car.driftOff + dt;
      car.driftAir = car.grounded ? 0 : car.driftAir + dt;
      const over = car.driftAir > 0.35 || car.spin > 0 || car.stun > 0 || Math.sqrt(speed2) < DRIFT_END || car.driftOff > DRIFT_RELEASE;
      if (over) this.endDrift(car, ev);
    }

    // --- Yaw.
    if (car.spin > 0) {
      car.spin -= dt;
      const u = 1 - Math.max(car.spin, 0) / car.spinDur;
      const ease = 1 - Math.pow(1 - clamp(u, 0, 1), 3);
      const target = car.spinHeading0 + car.spinDir * TWO_PI * ease;
      car.yawRate = (target - car.heading) / dt;
      car.heading = target;
      if (car.spin <= 0) car.heading = wrapAngle(car.heading);
    } else if (car.grounded && car.drift !== 0) {
      // Drifting: the nose holds an angle to the direction of travel (more with the wheel turned into
      // the slide, less as it's let go, none by the time the tyres grip again) while the slide
      // swings the whole car round.
      const beta = wrapAngle(car.heading - Math.atan2(car.vz, car.vx));
      const into = clamp(S * car.drift, -1, 1);
      const settle = 1 - clamp(car.driftOff / DRIFT_RELEASE, 0, 1);
      const slip = (into >= 0 ? DRIFT_SLIP + (DRIFT_SLIP_MAX - DRIFT_SLIP) * into : DRIFT_SLIP * (1 + into)) * settle;
      const wTarget = clamp(car.driftTurn + DRIFT_HOLD * (car.drift * slip - beta), -DRIFT_YAW, DRIFT_YAW);
      car.yawRate += (wTarget - car.yawRate) * (1 - Math.exp(-k.yawResponse * dt));
      car.heading += car.yawRate * dt;
    } else if (car.grounded) {
      const v = Math.abs(vf);
      const gripAcc = (mu * CORNER_GRIP * N) / m;
      const wKin = v / k.turnRadius;
      const wGrip = (gripAcc / Math.max(v, 2)) * OVERSTEER;
      const wMax = Math.min(wKin, wGrip, MAX_YAW);
      const wTarget = S * wMax * (vf >= 0 ? 1 : -1);
      car.yawRate += (wTarget - car.yawRate) * (1 - Math.exp(-k.yawResponse * dt));
      car.heading += car.yawRate * dt;
      // Hands off the wheel: ease the nose along the road (keys can only steer full lock or not).
      if (Math.abs(S) < 0.05 && vf > 5) {
        const off = wrapAngle(pt.heading - car.heading);
        if (Math.abs(off) < 0.45) car.heading += Math.sign(off) * Math.min(Math.abs(off), ASSIST * dt);
      }
    } else if (car.drift !== 0) {
      // A hop mid-drift: nothing to slide on, so the car holds its angle and carries on.
      car.yawRate *= Math.exp(-12 * dt);
      car.heading += car.yawRate * dt;
    } else {
      car.yawRate += (S * AIR_YAW - car.yawRate) * (1 - Math.exp(-2.5 * dt));
      car.heading += car.yawRate * dt;
    }
    fx = Math.cos(car.heading);
    fz = Math.sin(car.heading);
    const rx = -fz;
    const rz = fx;
    vf = car.vx * fx + car.vz * fz;

    // --- Engine (the jet pushes even in the air). The gas is free: it never runs dry.
    let engineF = 0;
    let spinning = false;
    const onPower = car.grounded || k.isJet;
    const top = k.topSpeed + WIND_TOP * this.wind;
    if (T > 0 && onPower && k.power > 0) {
      // Near its top speed the engine runs out of revs (or the jet out of thrust). A headwind loads
      // the engine and lowers the speed it can reach; a tailwind raises it.
      const rev = vf <= 0.6 * top ? 1 : Math.max(0, (top - vf) / (0.4 * top));
      const demand = ((T * k.power) / Math.max(Math.abs(vf), 1)) * rev;
      if (k.isJet) engineF = Math.min(demand, k.thrustCap * T);
      else {
        const grip = k.traction * N * (car.drift !== 0 ? DRIFT_TRACTION : 1);
        spinning = demand > grip && car.drift === 0;
        engineF = Math.min(demand, grip);
      }
    }
    car.engineOn = T > 0 && k.power > 0;
    car.wheelspin = spinning;
    if (spinning) car.wheelspinTime += dt;

    // --- Boost: a rocket push along the nose while the key is held (on the road or in the air)
    // until the bottle runs dry. It fades out on the way past the engine's top speed.
    let boostF = 0;
    car.boosting = false;
    if (inp.boost && car.boost > 0 && car.spin <= 0 && car.stun <= 0) {
      const topB = top * BOOST_TOP;
      const fade = vf <= 0.8 * topB ? 1 : Math.max(0, (topB - vf) / (0.2 * topB));
      boostF = m * BOOST_ACC * fade;
      const used = Math.min(car.boost, dt);
      car.boost -= used;
      car.tally.boostUsed += used;
      car.boosting = true;
      if (car.boost <= 1e-9) {
        car.boost = 0;
        ev.push({ type: 'boostEmpty', t: this.t, p: car.p, s: car.s });
      }
    }

    // Reverse: the brake held at a standstill backs up (no fuel needed).
    let reverseF = 0;
    if (car.grounded && B > 0 && T === 0 && vf <= 0.4 && vf > -REVERSE_MAX) reverseF = B * Math.min(REVERSE_FORCE, mu * N);

    // --- Drag (slipstream behind the other car cuts it).
    const ax = car.vx - this.wind;
    const az = car.vz;
    const air = Math.sqrt(ax * ax + az * az);
    const cd = k.cdA * (1 - 0.45 * car.draft);
    const dragX = -0.5 * RHO * cd * air * ax;
    const dragZ = -0.5 * RHO * cd * air * az;

    // --- Gravity along the slope.
    const ga = car.grounded ? (-G * grade) / (1 + grade * grade) : 0;

    const aDrive = (engineF + boostF - reverseF) / m;
    // Sliding, the push goes along the direction of travel (the wheel alone sets the drift's arc).
    let ux = fx;
    let uz = fz;
    if (car.drift !== 0 && speed2 > 1) {
      const v = Math.sqrt(speed2);
      ux = car.vx / v;
      uz = car.vz / v;
    }
    car.vx += (aDrive * ux + dragX / m + ga * pt.tx) * dt;
    car.vz += (aDrive * uz + dragZ / m + ga * pt.tz) * dt;

    // --- Brakes and rolling resistance: slow the wheels' rolling, never reverse them.
    if (car.grounded) {
      vf = car.vx * fx + car.vz * fz;
      let decel = k.crr * N;
      let brakeF = 0;
      if (B > 0 && vf > 0.4) {
        brakeF = B * Math.min(k.brakeForce, mu * N);
        decel += brakeF;
      }
      const dv = (decel / m) * dt;
      if (car.drift !== 0) {
        // Sliding: the brakes and the tyres' drag work against the direction of travel.
        const v = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
        const f = v > dv ? (v - dv) / v : 0;
        car.vx *= f;
        car.vz *= f;
      } else if (Math.abs(vf) <= dv) {
        // Rolling resistance holds a car at rest unless something pushes harder.
        car.vx -= vf * fx;
        car.vz -= vf * fz;
      } else {
        const sg = vf > 0 ? 1 : -1;
        car.vx -= sg * dv * fx;
        car.vz -= sg * dv * fz;
      }

      // --- Tyres: turn the velocity to follow the nose, as far as the grip allows. Within grip the
      // tyres roll (no speed lost); beyond it they slide and friction scrubs speed.
      const vx0 = car.vx;
      const vz0 = car.vz;
      const v = Math.sqrt(vx0 * vx0 + vz0 * vz0);
      if (car.drift !== 0 && v > 1e-6) {
        // Drifting: the slide swings the direction of travel round on an arc the wheel sets (held
        // into the slide: tighter than plain grip could; let go: wider; counter-steered: almost
        // straight), scrubbing a little speed as it goes.
        const into = clamp(S * car.drift, -1, 1);
        const bite = into >= 0 ? DRIFT_BITE + (1 - DRIFT_BITE) * into : DRIFT_BITE + (DRIFT_BITE - DRIFT_BITE_OUT) * into;
        const turnAcc = ((mu * DRIFT_GRIP * N) / m) * bite;
        const w = Math.min(turnAcc / Math.max(v, 4), v / k.turnRadius, DRIFT_YAW);
        const a2 = Math.atan2(vz0, vx0) + car.drift * w * dt;
        const v2 = Math.max(0, v - ((DRIFT_SCRUB * N) / m) * bite * dt);
        car.vx = Math.cos(a2) * v2;
        car.vz = Math.sin(a2) * v2;
        car.driftTurn = car.drift * w;
        car.driftBite = bite;
        car.slip = wrapAngle(car.heading - a2);
        car.sliding = true;
      } else if (v > 1e-6) {
        const vl = vx0 * rx + vz0 * rz;
        const vfw = vx0 * fx + vz0 * fz;
        const used = Math.min(1, Math.abs(engineF + brakeF) / (mu * N + 1e-6));
        let latMax = mu * CORNER_GRIP * N * (1 - 0.35 * used * used);
        if (spinning) latMax *= 0.75;
        if (car.spin > 0) latMax *= 0.22;
        const dvLat = (latMax / m) * dt;
        // Slip angle relative to the direction of travel (forwards or backwards).
        const dirSign = vfw >= 0 ? 1 : -1;
        const beta = Math.atan2(vl, Math.abs(vfw));
        car.slip = beta;
        if (Math.abs(vl) <= dvLat) {
          // Grip: roll along the nose at the same speed.
          car.vx = fx * dirSign * v;
          car.vz = fz * dirSign * v;
          car.sliding = false;
        } else {
          // Slide: friction opposes the sideways slip.
          const sg = vl > 0 ? 1 : -1;
          car.vx -= sg * dvLat * rx;
          car.vz -= sg * dvLat * rz;
          car.sliding = Math.abs(beta) > 0.16 && v > 6;
        }
      }
    } else {
      car.sliding = false;
    }

    // --- Move.
    car.x += car.vx * dt;
    car.z += car.vz * dt;
    // Lombard's block is walled in: retaining walls and stairs along its sides, houses at its ends
    // except where the road comes in and goes out. A hop across the gardens stays inside it.
    const g = this.garden;
    const px = car.x - car.vx * dt;
    const pz = car.z - car.vz * dt;
    if (px > g.x0 && px < g.x1 && Math.abs(pz) <= g.zWall) {
      if (Math.abs(car.z) > g.zWall) {
        const side = Math.sign(car.z);
        car.z = side * g.zWall;
        this.blockWall(car, 0, side, ev);
      }
      if ((car.x < g.x0 || car.x > g.x1) && Math.abs(car.z) > g.gate) {
        const side = car.x < g.x0 ? -1 : 1;
        car.x = side < 0 ? g.x0 : g.x1;
        this.blockWall(car, side, 0, ev);
      }
    }
    const sPrev = car.s;

    // --- Where are we now?
    const loc = locate(C, car.x, car.z, car.s, car.grounded ? 6 : 10, this.loc);
    if (!car.grounded && Math.abs(loc.d) > pointAt(C, loc.s, this.tmp2).hw) {
      // Flying over a hedge: are we over another stretch of road (another Lombard leg)?
      let bestS = loc.s;
      let bestD = loc.d;
      let bestGap = Infinity;
      for (const r of roadsAt(C, car.x, car.z)) {
        const h = this.roadY(r.s);
        if (h > car.y + 0.4) continue;
        const gap = Math.abs(r.s - car.s);
        if (gap < bestGap) {
          bestGap = gap;
          bestS = r.s;
          bestD = r.d;
        }
      }
      loc.s = bestS;
      loc.d = bestD;
    }
    car.s = loc.s;
    car.d = loc.d;
    // Over one of Lombard's flower beds (off the road, beyond a hedge): you can't sink into the
    // hydrangeas. Skid across the top of them towards the nearest road and drop onto it.
    let onBed = false;
    if (!car.grounded) {
      const bp = pointAt(C, car.s, this.tmp2);
      const edge = car.d > 0 ? bp.edgeR : bp.edgeL;
      // (All of Lombard's block off the road is garden, including the islands inside the
      // hairpins, whose kerbs aren't hedges.)
      if ((edge === 'hedge' || this.inGarden(car.x, car.z)) && Math.abs(car.d) > bp.hw + 0.3) {
        const top = this.roadY(car.s) + WALL_HEIGHT.hedge + 0.05;
        if (car.y <= top) {
          onBed = true;
          // The nearest road might be the next leg.
          const near = locate(C, car.x, car.z, car.s, 30);
          const nearHw = pointAt(C, near.s, this.tmp2).hw;
          if (Math.abs(near.d) - nearHw < Math.abs(car.d) - bp.hw - 0.5 && Math.abs(near.s - car.s) > 3) {
            car.s = near.s;
            car.d = near.d;
          }
          const np = pointAt(C, car.s, this.tmp2);
          const side = car.d > 0 ? 1 : -1;
          car.y = Math.max(car.y, this.roadY(car.s) + WALL_HEIGHT.hedge + 0.05);
          if (car.vy < 0) car.vy = 0;
          // Towards the road, losing speed in the flowers.
          car.vx += side * np.tz * 14 * dt;
          car.vz -= side * np.tx * 14 * dt;
          const f = Math.exp(-1.6 * dt);
          car.vx *= f;
          car.vz *= f;
          car.airTime = 0;
        }
      }
    }

    // Cutting across in the air (over Lombard's hedges, the inside of a hairpin, a corner): back
    // over the road further along than the flight alone explains is a shortcut.
    if (!car.grounded && Math.abs(car.d) > pointAt(C, car.s, this.tmp2).hw + 0.2) {
      if (car.hopS < 0) {
        car.hopS = sPrev;
        car.hopDist = 0;
      }
      car.hopDist += Math.sqrt(car.vx * car.vx + car.vz * car.vz) * dt;
    } else if (car.hopS >= 0) {
      const gained = car.s - car.hopS - car.hopDist;
      if (gained > 2.5 && !car.jumpShortcut) {
        car.jumpShortcut = true;
        car.hopLand = true;
        car.tally.shortcuts++;
        this.addHype(car, 12, 'shortcut', ev);
        ev.push({ type: 'shortcut', t: this.t, p: car.p, s: car.s, gained });
      }
      car.hopS = -1;
    }

    // Cable-car tracks: lose a share of kinetic energy crossing them (big wheels roll over).
    if (car.grounded) {
      for (const b of C.bumps) {
        if (sPrev < b.s && car.s >= b.s) {
          const ke = 0.5 * m * (car.vx * car.vx + car.vz * car.vz);
          const f = Math.sqrt(1 - k.bumpLoss);
          car.vx *= f;
          car.vz *= f;
          car.bumpsHit++;
          ev.push({ type: 'bump', t: this.t, p: car.p, s: b.s, keLostJ: ke * k.bumpLoss });
        }
      }
    }

    // --- Vertical: follow the road, leave it over a crest, land.
    const p2 = pointAt(C, car.s, this.tmp2);
    const hRoad = this.roadY(car.s);
    const vAlong = car.vx * p2.tx + car.vz * p2.tz;
    const vyRoad = this.gradeAt(p2) * vAlong;
    if (car.grounded) {
      // Over a crest the road falls away faster than gravity can pull the car down: it flies
      // (a Bullitt jump at the intersections). Tiny hops at low speed are ignored.
      if (vyRoad < car.vy - G * dt - 1.6) {
        car.grounded = false;
        // Leaving the road mid-turn doesn't set the car spinning in the air.
        car.yawRate = clamp(car.yawRate, -AIR_YAW, AIR_YAW);
        car.airTime = 0;
        car.y = Math.max(car.y + car.vy * dt - 0.5 * G * dt * dt, hRoad);
        car.vy -= G * dt;
        ev.push({ type: 'takeoff', t: this.t, p: car.p, speed: Math.sqrt(car.vx * car.vx + car.vz * car.vz) });
      } else {
        car.y = hRoad;
        car.vy = vyRoad;
      }
    } else if (!onBed) {
      car.vy -= G * dt;
      car.y += car.vy * dt;
      car.airTime += dt;
      if (car.y <= hRoad) {
        const impact = vyRoad - car.vy;
        car.y = hRoad;
        car.grounded = true;
        // A hard landing costs a little speed; a toy bounces a bit.
        if (impact > 5) {
          const f = 1 - Math.min(0.12, (impact - 5) * 0.012);
          car.vx *= f;
          car.vz *= f;
        }
        car.vy = vyRoad;
        if (impact > 7) {
          car.vy = vyRoad + (impact - 7) * 0.22;
          car.grounded = false;
        }
        // Down on the far side of a hedge hop: touch down lined up with the road, carrying the speed.
        if (car.hopLand) {
          car.hopLand = false;
          const sp = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
          const off = wrapAngle(p2.heading - Math.atan2(car.vz, car.vx));
          if (Math.abs(off) < 1.35 && sp > 1) {
            const h = p2.heading - off * 0.12;
            car.vx = Math.cos(h) * sp * 0.96;
            car.vz = Math.sin(h) * sp * 0.96;
            car.heading = h;
            car.yawRate = 0;
          }
        }
        if (car.airTime > 0.12) ev.push({ type: 'land', t: this.t, p: car.p, impact, air: car.airTime });
        if (car.grounded) {
          car.airTime = 0;
          car.jumpShortcut = false;
        }
      }
    }

    this.walls(car, ev);

    // Can't back out past the start line area.
    if (car.s < 0.6) {
      const w = toWorld(C, 0.6, car.d);
      car.x = w.x;
      car.z = w.z;
      car.s = 0.6;
      const vfw = car.vx * p2.tx + car.vz * p2.tz;
      if (vfw < 0) {
        car.vx -= vfw * p2.tx;
        car.vz -= vfw * p2.tz;
      }
    }

    // Book-keeping.
    const sp = Math.sqrt(car.vx * car.vx + car.vz * car.vz + car.vy * car.vy);
    if (sp > car.tally.topSpeed) car.tally.topSpeed = sp;
    const along = car.vx * p2.tx + car.vz * p2.tz;
    const facing = Math.cos(car.heading - p2.heading);
    car.wrongWay = facing < -0.3 && along < -1 ? car.wrongWay + dt : 0;
    car.backwardsT = facing < -0.3 ? car.backwardsT + dt : 0;
    car.boostFrac = k.boostCap > 0 ? car.boost / k.boostCap : 0;
    if (car.grit > 0) car.grit = Math.max(0, car.grit - dt);
    if (car.overtakeCd > 0) car.overtakeCd -= dt;

    // Stuck (wedged against something facing the wrong way)? Put the car back on the road.
    car.stuckT += dt;
    const onRamp = car.s > C.marks.kickerS0 - 12;
    // Only a car that's trying (on the gas) and getting nowhere: sitting still or reversing is fine.
    if (car.s > car.stuckS + 2.5 || T < 0.5) {
      car.stuckS = car.s;
      car.stuckT = 0;
    } else if (onRamp && car.stuckT > 2.5) {
      // Too slow to make the kicker: the pier crew give it a shove over the lip.
      this.crewPush(car, ev);
      return;
    } else if (car.stuckT > STUCK_TIME) {
      this.rescue(car, ev);
    }
    // Lost: driving the wrong way for a while, or facing it for longer (a big car making a meal of a
    // three-point turn on Lombard). The marshals turn it round.
    if (car.wrongWay > WRONG_WAY_TIME || car.backwardsT > WRONG_WAY_TIME + 3) this.rescue(car, ev);
  }

  private crewPush(car: RaceCar, ev: RaceEvent[]): void {
    const lip = this.course.lip;
    const last = this.course.points[this.course.points.length - 1];
    car.x = lip.x;
    car.z = lip.z + Math.max(-4, Math.min(4, car.d));
    car.y = this.roadY(lip.s);
    car.s = lip.s;
    car.heading = last.heading;
    const v = 3;
    const cos = Math.cos(this.rampAngle);
    car.vx = last.tx * v * cos;
    car.vz = last.tz * v * cos;
    car.vy = v * Math.sin(this.rampAngle);
    car.grounded = false;
    ev.push({ type: 'rescue', t: this.t, p: car.p });
    this.launch(car, ev, 0);
  }

  /** Nothing big within `r` metres of this point (for putting a car back on the road). */
  private clearAt(x: number, z: number, r: number): boolean {
    const r2 = r * r;
    for (const w of this.waymos) if ((w.x - x) ** 2 + (w.z - z) ** 2 < r2 + 9) return false;
    if (this.cable && Math.abs(this.cable.x - x) < 2 + r * 0.5 && Math.abs(this.cable.z - z) < 5 + r) return false;
    for (const p of this.peds) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r2) return false;
    return true;
  }

  /** Bounce off one of the walls round Lombard's block (outward normal nx, nz). */
  private blockWall(car: RaceCar, nx: number, nz: number, ev: RaceEvent[]): void {
    const vn = car.vx * nx + car.vz * nz;
    if (vn <= 0) return;
    if (vn > 1.2) ev.push({ type: 'wall', t: this.t, p: car.p, impact: vn, x: car.x + nx, y: car.y + 0.5, z: car.z + nz });
    car.vx -= (1 + WALL_E) * vn * nx;
    car.vz -= (1 + WALL_E) * vn * nz;
    car.vx *= 0.85;
    car.vz *= 0.85;
  }

  /** Inside Lombard's block (on the road or in its gardens). */
  private inGarden(x: number, z: number): boolean {
    const g = this.garden;
    return x >= g.x0 - 0.01 && x <= g.x1 + 0.01 && Math.abs(z) <= g.zWall + 0.5;
  }

  private rescue(car: RaceCar, ev: RaceEvent[]): void {
    const C = this.course;
    let s = Math.min(car.s + 3, C.marks.kickerS0 - 2);
    let d = 0;
    // A clear spot a little further on (not on top of whatever it was stuck behind).
    search: for (const ds of [3, 6, 10, 15, 22]) {
      const ss = Math.min(car.s + ds, C.marks.kickerS0 - 2);
      const hw = pointAt(C, ss, this.tmp2).hw;
      for (const dd of [0, -hw / 2, hw / 2]) {
        const p = toWorld(C, ss, dd);
        if (this.clearAt(p.x, p.z, 3.5)) {
          s = ss;
          d = dd;
          break search;
        }
      }
    }
    const w = toWorld(C, s, d);
    car.x = w.x;
    car.z = w.z;
    car.y = w.y;
    car.s = s;
    car.d = d;
    car.heading = w.heading;
    car.vx = Math.cos(w.heading) * 3;
    car.vz = Math.sin(w.heading) * 3;
    car.vy = 0;
    car.yawRate = 0;
    car.grounded = true;
    car.spin = 0;
    car.stun = 0;
    car.gullT = 0;
    car.drift = 0;
    car.stuckS = s;
    car.stuckT = 0;
    car.wrongWay = 0;
    car.backwardsT = 0;
    car.hopS = -1;
    car.hopLand = false;
    this.addHype(car, -5, 'rescued', ev);
    ev.push({ type: 'rescue', t: this.t, p: car.p });
  }

  private walls(car: RaceCar, ev: RaceEvent[]): void {
    const C = this.course;
    const pt = pointAt(C, car.s, this.tmpW);
    const rx = -pt.tz;
    const rz = pt.tx;
    const rel = car.heading - pt.heading;
    const k = car.stats;
    const rEff = 0.5 * k.width * Math.abs(Math.cos(rel)) + 0.5 * k.length * Math.abs(Math.sin(rel));
    const lim = pt.hw - rEff;
    let side = 0;
    if (car.d > lim) side = 1;
    else if (car.d < -lim) side = -1;
    if (side === 0) return;
    const edge = side > 0 ? pt.edgeR : pt.edgeL;
    // Clearing a hedge in the air.
    if (!car.grounded && car.y - this.roadY(car.s) > WALL_HEIGHT[edge]) return;
    // Already across the hedge and over the flower bed: the bed handles it (no snapping back).
    if (!car.grounded && Math.abs(car.d) > pt.hw + 0.3 && (edge === 'hedge' || this.inGarden(car.x, car.z))) return;
    // Out of the wall, but no teleports: a car that came down half on a hedge slides off it.
    const pen = Math.min(Math.abs(car.d) - lim, WALL_PUSH);
    car.x -= side * rx * pen;
    car.z -= side * rz * pen;
    car.d -= side * pen;
    const nx = -side * rx;
    const nz = -side * rz;
    const vn = car.vx * nx + car.vz * nz;
    if (vn >= 0) return;
    // Bounce off, scrape along it, and swing the nose along the wall (arcade kindness).
    const tx = -nz;
    const tz = nx;
    let vt = car.vx * tx + car.vz * tz;
    const vnAfter = -WALL_E * vn;
    const scrape = Math.min(Math.abs(vt), 0.35 * Math.abs(vn));
    vt -= Math.sign(vt) * scrape;
    car.vx = tx * vt + nx * vnAfter;
    car.vz = tz * vt + nz * vnAfter;
    const along = Math.atan2(tz * Math.sign(vt || 1), tx * Math.sign(vt || 1));
    const dh = wrapAngle(along - car.heading);
    if (Math.abs(dh) < Math.PI / 2) car.heading += dh * Math.min(1, 0.06 * Math.abs(vn));
    car.yawRate *= 0.6;
    const impact = -vn;
    if (impact > 3) this.endDrift(car, ev);
    // Straight into the tyres at speed is a proper crash: it knocks the wind out of the car (so
    // bouncing round a corner off the barrier is never quicker than braking or drifting through).
    if (impact > WALL_HARD) {
      const f = 1 - Math.min(0.4, (impact - WALL_HARD) * 0.025);
      car.vx *= f;
      car.vz *= f;
      car.stun = Math.max(car.stun, Math.min(0.6, (impact - WALL_HARD) * 0.05));
    }
    if (impact > 1.2) {
      ev.push({ type: 'wall', t: this.t, p: car.p, impact, x: car.x + side * rx * rEff, y: car.y + 0.5, z: car.z + side * rz * rEff });
      if (impact > 6) {
        car.tally.walls++;
        this.addHype(car, -3, 'wall', ev);
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Collisions

  private carVsCar(ev: RaceEvent[]): void {
    const racing = this.cars.filter((c) => c.phase === 'race');
    for (let i = 0; i < racing.length; i++) {
      for (let j = i + 1; j < racing.length; j++) {
        const a = racing[i];
        const b = racing[j];
        if (Math.abs(a.y - b.y) > 1.3) continue;
        const ca = a.circles;
        const cb = b.circles;
        const hit = contact(a.x, a.z, a.heading, ca, b.x, b.z, b.heading, cb);
        if (!hit) continue;
        this.resolveCars(a, b, hit, ca, ev);
      }
    }
  }

  private resolveCars(a: RaceCar, b: RaceCar, h: Contact, ca: [number, number][], ev: RaceEvent[]): void {
    const ma = a.stats.mass;
    const mb = b.stats.mass;
    const Ia = (ma * (a.stats.length ** 2 + a.stats.width ** 2)) / 12;
    const Ib = (mb * (b.stats.length ** 2 + b.stats.width ** 2)) / 12;
    // Separate by mass.
    const tot = ma + mb;
    a.x += h.nx * h.depth * (mb / tot);
    a.z += h.nz * h.depth * (mb / tot);
    b.x -= h.nx * h.depth * (ma / tot);
    b.z -= h.nz * h.depth * (ma / tot);
    const rax = h.cx - a.x;
    const raz = h.cz - a.z;
    const rbx = h.cx - b.x;
    const rbz = h.cz - b.z;
    const vax = a.vx - a.yawRate * raz;
    const vaz = a.vz + a.yawRate * rax;
    const vbx = b.vx - b.yawRate * rbz;
    const vbz = b.vz + b.yawRate * rbx;
    const rvx = vax - vbx;
    const rvz = vaz - vbz;
    const vn = rvx * h.nx + rvz * h.nz;
    if (vn >= 0) return;
    const crA = rax * h.nz - raz * h.nx;
    const crB = rbx * h.nz - rbz * h.nx;
    const denom = 1 / ma + 1 / mb + (crA * crA) / Ia + (crB * crB) / Ib;
    const j = (-(1 + CAR_E) * vn) / denom;
    // Who rammed whom: a nose pointing into the other car.
    const noseA = Math.cos(a.heading) * -h.nx + Math.sin(a.heading) * -h.nz;
    const noseB = Math.cos(b.heading) * h.nx + Math.sin(b.heading) * h.nz;
    const frontA = ca[h.ia][0] > 0 && noseA > 0.55;
    let rammer: RaceCar | null = null;
    let victim: RaceCar | null = null;
    if (a.grit > 0 && b.grit > 0) {
      // Two Determined cars: the Determination cancels out and it's a plain collision.
      a.grit = 0;
      b.grit = 0;
    } else if (frontA && (noseB < 0.55 || a.grit > 0)) {
      rammer = a;
      victim = b;
    } else if (noseB > 0.55 && (!frontA || b.grit > 0)) {
      rammer = b;
      victim = a;
    }
    let ja = j;
    let jb = j;
    let ram = 'none';
    if (rammer && victim) {
      const onA = rammer === a;
      if (rammer.grit > 0) {
        // Determination: plough through, the other car takes the lot.
        ram = 'grit';
        if (onA) {
          ja = 0;
          jb = j * 2.2;
        } else {
          jb = 0;
          ja = j * 2.2;
        }
        victim.stun = Math.max(victim.stun, 0.5);
        rammer.grit = 0;
        rammer.tally.plowed++;
        this.addHype(rammer, 6, 'powered through', ev);
      } else if (rammer.stats.ram === 'bull') {
        ram = 'bull';
        if (onA) jb *= 1.5;
        else ja *= 1.5;
      } else if (rammer.stats.ram === 'wedge') {
        ram = 'wedge';
        if (-vn > 2.5) {
          victim.vy += 1.2 + Math.min(3, -vn * 0.35);
          victim.grounded = false;
          victim.stun = Math.max(victim.stun, 0.3);
        }
      } else ram = 'spike';
    }
    a.vx += (ja * h.nx) / ma;
    a.vz += (ja * h.nz) / ma;
    b.vx -= (jb * h.nx) / mb;
    b.vz -= (jb * h.nz) / mb;
    a.yawRate += (crA * ja) / Ia;
    b.yawRate -= (crB * jb) / Ib;
    const impact = -vn;
    if (impact > 1.5) {
      const p = rammer ?? a;
      const q = victim ?? b;
      ev.push({ type: 'shove', t: this.t, p: p.p, victim: q.p, impact, ram, x: h.cx, y: (a.y + b.y) / 2 + 0.6, z: h.cz });
      if (impact > 3 && rammer && victim) {
        rammer.tally.shoves++;
        victim.tally.shoved++;
        this.addHype(rammer, 4, 'shove', ev);
        this.addHype(victim, -3, 'shoved', ev);
      }
    }
  }

  private hitObstacles(car: RaceCar, ev: RaceEvent[]): void {
    const k = car.stats;
    const cc = car.circles;
    const clearance = car.y - this.roadY(car.s);
    const speed = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
    const reach = k.length / 2 + 4;

    if (car.ghostT > 0) car.ghostT -= DT;
    for (const w of this.waymos) {
      if (car.ghostT > 0 && w.id === car.ghostId) continue;
      const dx = w.x - car.x;
      const dz = w.z - car.z;
      if (dx * dx + dz * dz > (reach + 3) * (reach + 3)) continue;
      if (clearance > WAYMO_DIMS.height) continue;
      const h = contact(car.x, car.z, car.heading, cc, w.x, w.z, w.heading, WAYMO_CIRCLES);
      if (!h) {
        this.nearMiss(car, w.id, 'waymo', car.x, car.z, cc, w.x, w.z, w.heading, WAYMO_NEAR, speed, ev);
        continue;
      }
      this.noNearMiss(car, w.id);
      this.hitHeavy(car, h, w, WAYMO_MASS, ev);
    }
    if (this.cable && clearance < CABLE_DIMS.height) {
      const cb = this.cable;
      const h = contact(car.x, car.z, car.heading, cc, cb.x, cb.z, cb.heading, CABLE_CIRCLES);
      if (h) {
        this.noNearMiss(car, -1);
        this.hitHeavy(car, h, null, 60000, ev);
      }
      else this.nearMiss(car, -1, 'cable', car.x, car.z, cc, cb.x, cb.z, cb.heading, CABLE_NEAR, speed, ev);
    }
    for (const p of this.peds) {
      if (p.down > 0 || p.dive > 0) continue;
      const dx = p.x - car.x;
      const dz = p.z - car.z;
      if (dx * dx + dz * dz > reach * reach) continue;
      if (clearance > 1.5) continue;
      const h = contact(car.x, car.z, car.heading, cc, p.x, p.z, 0, [[0, PED_R]]);
      if (!h) {
        this.nearMiss(car, p.id, 'ped', car.x, car.z, cc, p.x, p.z, 0, PED_NEAR, speed, ev);
        continue;
      }
      this.noNearMiss(car, p.id);
      if (car.grit > 0) {
        p.dive = 1.4;
        p.fallX = -h.nz * (Math.sign(h.nx * car.vz - h.nz * car.vx) || 1);
        p.fallZ = h.nx * (Math.sign(h.nx * car.vz - h.nz * car.vx) || 1);
        car.grit = 0;
        car.tally.plowed++;
        this.addHype(car, 6, 'powered through', ev);
        ev.push({ type: 'hit', t: this.t, p: car.p, what: 'ped', id: p.id, impact: speed, plowed: true, x: p.x, y: p.y + 1, z: p.z });
        continue;
      }
      // A wobbly toy tourist: they topple (and bounce back up); you lose a lot of speed.
      p.down = 2.6;
      const sp = Math.max(speed, 1e-6);
      p.fallX = car.vx / sp;
      p.fallZ = car.vz / sp;
      const f = 0.55;
      car.vx *= f;
      car.vz *= f;
      car.yawRate += (this.rng() < 0.5 ? -1 : 1) * 2.2;
      car.stun = Math.max(car.stun, 0.25);
      car.tally.ped++;
      this.addHype(car, -8, 'tourist', ev);
      ev.push({ type: 'hit', t: this.t, p: car.p, what: 'ped', id: p.id, impact: speed, plowed: false, x: p.x, y: p.y + 1, z: p.z });
    }
    for (const poo of this.poos) {
      if (!poo.alive || poo.age < 0.35) continue;
      if (clearance > 0.45) continue;
      const dx = poo.x - car.x;
      const dz = poo.z - car.z;
      if (dx * dx + dz * dz > reach * reach) continue;
      const h = contact(car.x, car.z, car.heading, cc, poo.x, poo.z, 0, [[0, POO_R]]);
      if (!h) continue;
      poo.alive = false;
      if (car.grit > 0) {
        car.grit = 0;
        car.tally.plowed++;
        this.addHype(car, 6, 'powered through', ev);
        ev.push({ type: 'hit', t: this.t, p: car.p, what: 'poo', id: poo.id, impact: speed, plowed: true, x: poo.x, y: poo.y, z: poo.z });
        continue;
      }
      this.spinOut(car, poo.owner !== car.p ? poo.owner : null, ev);
      ev.push({ type: 'hit', t: this.t, p: car.p, what: 'poo', id: poo.id, impact: speed, plowed: false, x: poo.x, y: poo.y, z: poo.z });
    }
    for (const cn of this.cones) {
      if (cn.hit) continue;
      const dx = cn.x - car.x;
      const dz = cn.z - car.z;
      if (dx * dx + dz * dz > reach * reach) continue;
      if (clearance > 0.8) continue;
      const h = contact(car.x, car.z, car.heading, cc, cn.x, cn.z, 0, [[0, 0.3]]);
      if (!h) continue;
      cn.hit = true;
      cn.vx = car.vx * 1.15 - h.nx * 3;
      cn.vz = car.vz * 1.15 - h.nz * 3;
      cn.vy = 3.5 + speed * 0.15;
      cn.spin = 8 + speed * 0.4;
      car.vx *= 0.97;
      car.vz *= 0.97;
      ev.push({ type: 'hit', t: this.t, p: car.p, what: 'cone', id: cn.id, impact: speed, plowed: false, x: cn.x, y: cn.y + 0.4, z: cn.z });
    }
  }

  /** Bounce off something heavy (a Waymo or the cable car). */
  private hitHeavy(car: RaceCar, h: Contact, w: Waymo | null, mass: number, ev: RaceEvent[]): void {
    const m = car.stats.mass;
    const I = (m * (car.stats.length ** 2 + car.stats.width ** 2)) / 12;
    car.x += h.nx * h.depth;
    car.z += h.nz * h.depth;
    const rax = h.cx - car.x;
    const raz = h.cz - car.z;
    const wvx = w ? this.waymoVel(w).x : 0;
    const wvz = w ? this.waymoVel(w).z : this.cable ? this.cable.dir * this.cable.v : 0;
    const rvx = car.vx - car.yawRate * raz - wvx;
    const rvz = car.vz + car.yawRate * rax - wvz;
    const vn = rvx * h.nx + rvz * h.nz;
    if (vn >= 0) return;
    const what: Obstacle = w ? 'waymo' : 'cable';
    const id = w ? w.id : -1;
    if (car.grit > 0 && w) {
      // Determination: the Waymo gets shoved out of your path (sideways, off your line) and you
      // keep going; you won't hit that one again for a moment.
      const sp = Math.max(0.1, Math.hypot(car.vx, car.vz));
      const fx = car.vx / sp;
      const fz = car.vz / sp;
      const lx = -fz;
      const lz = fx;
      const side = (w.x - car.x) * lx + (w.z - car.z) * lz >= 0 ? 1 : -1;
      const push = 4 + 0.9 * -vn;
      w.pvx += side * lx * push + fx * 0.4 * -vn;
      w.pvz += side * lz * push + fz * 0.4 * -vn;
      car.ghostId = w.id;
      car.ghostT = 0.9;
      w.spinV += (this.rng() < 0.5 ? -1 : 1) * 2.5;
      w.stopped = 3;
      w.hazard = true;
      car.grit = 0;
      car.tally.plowed++;
      this.addHype(car, 6, 'powered through', ev);
      ev.push({ type: 'hit', t: this.t, p: car.p, what, id, impact: -vn, plowed: true, x: h.cx, y: car.y + 0.8, z: h.cz });
      return;
    }
    const cr = rax * h.nz - raz * h.nx;
    const denom = 1 / m + 1 / mass + (cr * cr) / I;
    const j = (-(1 + 0.25) * vn) / denom;
    car.vx += (j * h.nx) / m;
    car.vz += (j * h.nz) / m;
    car.yawRate += (cr * j) / I;
    if (w) {
      w.pvx -= (j * h.nx) / mass;
      w.pvz -= (j * h.nz) / mass;
      w.stopped = Math.max(w.stopped, 2.2);
      w.hazard = true;
    }
    const impact = -vn;
    if (impact > 2) {
      // A proper crunch: you lose most of your way.
      const f = impact > 6 ? 0.55 : 0.8;
      car.vx *= f;
      car.vz *= f;
      car.stun = Math.max(car.stun, impact > 6 ? 0.5 : 0.25);
      if (what === 'waymo') car.tally.waymo++;
      this.addHype(car, impact > 6 ? -12 : -5, what === 'waymo' ? 'Waymo' : 'cable car', ev);
    }
    if (impact > 1) ev.push({ type: 'hit', t: this.t, p: car.p, what, id, impact, plowed: false, x: h.cx, y: car.y + 0.8, z: h.cz });
  }

  private nearMiss(
    car: RaceCar,
    id: number,
    what: Obstacle,
    ax: number,
    az: number,
    ac: [number, number][],
    bx: number,
    bz: number,
    bh: number,
    near: [number, number][],
    speed: number,
    ev: RaceEvent[],
  ): void {
    if (speed < 10 || car.missed.has(id) || car.nearPending.has(id)) return;
    // `near` is the other body grown by NEAR_MARGIN: a pass that close is a near miss (paid once
    // you're past it without hitting it, see settleNearMisses).
    if (!contact(ax, az, car.heading, ac, bx, bz, bh, near)) return;
    car.nearPending.set(id, { t: this.raceT, what });
    void ev;
  }

  /** Close passes with nothing hit for a moment afterwards become near misses. */
  private settleNearMisses(car: RaceCar, ev: RaceEvent[]): void {
    for (const [id, pend] of car.nearPending) {
      if (this.raceT - pend.t < 0.4) continue;
      car.nearPending.delete(id);
      car.missed.add(id);
      car.tally.nearMiss++;
      this.addHype(car, 4, 'near miss', ev);
      ev.push({ type: 'nearMiss', t: this.t, p: car.p, what: pend.what });
    }
  }

  /** A hit on this obstacle cancels any near miss it was about to pay. */
  private noNearMiss(car: RaceCar, id: number): void {
    car.nearPending.delete(id);
    car.missed.add(id);
  }

  private spinOut(car: RaceCar, by: PlayerIndex | null, ev: RaceEvent[]): void {
    this.endDrift(car, ev);
    const resist = car.stats.spinResist;
    car.spin = SPIN_TIME * (1 - 0.4 * resist);
    car.spinDur = car.spin;
    car.spinHeading0 = car.heading;
    car.spinDir = car.yawRate >= 0 ? 1 : -1;
    const f = 0.5 + 0.25 * resist;
    car.vx *= f;
    car.vz *= f;
    car.tally.poo++;
    this.addHype(car, -10, 'spun out', ev);
    if (by !== null) {
      const o = this.cars[by];
      if (o) {
        o.tally.pooLanded++;
        this.addHype(o, 8, 'poo landed', ev);
      }
    }
    ev.push({ type: 'spinout', t: this.t, p: car.p, by });
  }

  // ---------------------------------------------------------------------------------------------
  // Items

  private pickups(car: RaceCar, dt: number, ev: RaceEvent[]): void {
    if (car.roulette > 0) {
      car.roulette -= dt;
      if (car.roulette <= 0) {
        car.roulette = 0;
        // The new item goes in the free slot; the one already held stays the one the key uses.
        const it = this.rollItem(car);
        car.items.push(it);
        if (car.items.length === 1) car.sel = 0;
        ev.push({ type: 'item', t: this.t, p: car.p, item: it });
      }
    }
    // Hands full: drive through without breaking the boxes (they stay for the other car).
    if (car.items.length >= ITEM_SLOTS || car.roulette > 0) return;
    const reach = car.stats.length / 2 + BOX_R;
    for (const b of this.boxes) {
      if (b.hidden > 0) continue;
      const dx = b.x - car.x;
      const dz = b.z - car.z;
      if (dx * dx + dz * dz > reach * reach) continue;
      if (Math.abs(car.y + 0.6 - (b.y + 1)) > 2) continue;
      // The car's actual footprint must touch the box (one box per car, not a sweep of the row).
      if (!contact(car.x, car.z, car.heading, car.circles, b.x, b.z, 0, [[0, BOX_R * 0.8]])) continue;
      b.hidden = 3;
      car.roulette = ROULETTE_TIME;
      ev.push({ type: 'box', t: this.t, p: car.p, id: b.id, got: true });
      return;
    }
  }

  /**
   * Item odds lean on the race order: the leader gets defence (poo), the chaser gets comebacks
   * (Determination, boost and seagulls; the full boost is rare, and rarer still in front). With
   * nobody else on the road there's no one to drop poo for or send a seagull after.
   */
  private rollItem(car: RaceCar): ItemKind {
    const others = this.cars.filter((c) => c !== car && c.phase === 'race');
    // Weights in ITEM_KINDS order: jump, grit, poo, topup, refill, gull.
    let w: number[];
    if (!others.length) w = [0.34, 0.2, 0, 0.36, 0.1, 0];
    else {
      const gap = Math.max(...others.map((o) => o.s)) - car.s;
      if (gap <= 0) w = [0.26, 0.08, 0.44, 0.18, 0.01, 0.03];
      else if (gap < 30) w = [0.22, 0.18, 0.2, 0.22, 0.04, 0.14];
      else w = [0.16, 0.24, 0.06, 0.26, 0.1, 0.18];
    }
    let r = this.rng() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) {
      r -= w[i];
      if (r < 0) return ITEM_KINDS[i];
    }
    return ITEM_KINDS[0];
  }

  /** Put boost in a car's bottle (up to its size); returns how much went in. */
  addBoost(car: RaceCar, seconds: number): number {
    const before = car.boost;
    car.boost = Math.min(car.stats.boostCap, car.boost + Math.max(0, seconds));
    car.boostFrac = car.stats.boostCap > 0 ? car.boost / car.stats.boostCap : 0;
    return car.boost - before;
  }

  private endDrift(car: RaceCar, ev: RaceEvent[]): void {
    if (car.drift === 0) return;
    ev.push({ type: 'driftEnd', t: this.t, p: car.p, time: car.driftT, gain: car.driftGain });
    car.drift = 0;
    car.driftTurn = 0;
    car.driftBite = 0;
    car.driftCool = DRIFT_COOL;
  }

  private useItem(car: RaceCar, inp: CarInput, ev: RaceEvent[]): void {
    // Two items held: the swap key picks which one the item key uses.
    if (inp.swap && car.items.length > 1) {
      car.sel = (car.sel + 1) % car.items.length;
      ev.push({ type: 'swap', t: this.t, p: car.p, item: car.items[car.sel] });
    }
    if (!inp.item) return;
    if (car.items.length === 0) {
      if (car.roulette === 0) ev.push({ type: 'honk', t: this.t, p: car.p });
      return;
    }
    car.sel = Math.min(car.sel, car.items.length - 1);
    const it = car.items[car.sel];
    if (it === 'jump') {
      if (!car.grounded) return;
      // Off the kicker it only steepens the launch a little (a whole hop there would be worth more
      // than most builds are).
      const onKicker = car.s > this.course.marks.kickerS0 - 1;
      car.vy += car.stats.jumpSpeed * (onKicker ? KICKER_JUMP : 1);
      car.grounded = false;
      car.airTime = 0;
    } else if (it === 'grit') {
      car.grit = GRIT_TIME;
    } else if (it === 'topup' || it === 'refill') {
      // A full bottle keeps the item for later (a refill wasted on a full bottle helps nobody).
      if (car.boost >= car.stats.boostCap - 0.02) {
        ev.push({ type: 'boostGain', t: this.t, p: car.p, amount: 0, full: it === 'refill' });
        return;
      }
      const got = this.addBoost(car, (it === 'refill' ? 1 : TOPUP) * car.stats.boostCap);
      ev.push({ type: 'boostGain', t: this.t, p: car.p, amount: got, full: it === 'refill' });
    } else if (it === 'gull') {
      this.releaseGull(car);
    } else {
      const back = car.stats.length / 2 + 0.9;
      const x = car.x - Math.cos(car.heading) * back;
      const z = car.z - Math.sin(car.heading) * back;
      const loc = locate(this.course, x, z, car.s, 6);
      const hw = pointAt(this.course, loc.s, this.tmp).hw;
      const d = clamp(loc.d, -hw + 0.6, hw - 0.6);
      const w = toWorld(this.course, loc.s, d);
      this.poos.push({ id: this.nextId++, x: w.x, y: w.y, z: w.z, s: loc.s, owner: car.p, alive: true, age: 0 });
    }
    car.items.splice(car.sel, 1);
    car.sel = 0;
    car.tally.items++;
    ev.push({ type: 'use', t: this.t, p: car.p, item: it, x: car.x, y: car.y, z: car.z });
  }

  /** Let a seagull go after the rival (with nobody left racing, it just flies off). */
  private releaseGull(car: RaceCar): void {
    const target = this.cars.find((c) => c !== car && c.phase === 'race');
    const d = clamp(car.d, -4, 4);
    const w = toWorld(this.course, car.s, d);
    this.gulls.push({
      id: this.nextId++,
      owner: car.p,
      target: target ? target.p : car.p,
      x: w.x,
      y: car.y + 2.2,
      z: w.z,
      heading: car.heading,
      s: car.s,
      d,
      age: 0,
      state: target ? 'hunt' : 'leave',
      stateT: 0,
    });
  }

  /**
   * A seagull hunts its target along the course, above the road (so it never cuts through the
   * houses), always a good deal faster than the car it's after; close in, it dives at the
   * windscreen. Then it perches there for a moment and flies off.
   */
  private updateGull(g: Gull, dt: number, ev: RaceEvent[]): void {
    const C = this.course;
    g.age += dt;
    g.stateT += dt;
    const tc = this.cars[g.target];
    if (g.state === 'hunt') {
      if (!tc || tc.phase !== 'race' || g.age > GULL_LIFE) {
        g.state = 'leave';
        g.stateT = 0;
        return;
      }
      const px = g.x;
      const pz = g.z;
      const gap = tc.s - g.s;
      const tv = Math.hypot(tc.vx, tc.vz);
      if (Math.abs(gap) > 7) {
        const speed = Math.max(GULL_SPEED, tv + 18);
        g.s += Math.sign(gap) * Math.min(Math.abs(gap) - 6.9, speed * dt);
        g.d += clamp(tc.d - g.d, -6 * dt, 6 * dt);
        const w = toWorld(C, g.s, g.d);
        g.x = w.x;
        g.z = w.z;
        g.y += clamp(this.roadY(g.s) + 3.4 - g.y, -9 * dt, 9 * dt);
      } else {
        const dx = tc.x - g.x;
        const dy = tc.y + 1.2 - g.y;
        const dz = tc.z - g.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const step = Math.min(dist, (GULL_SPEED + tv) * dt);
        if (dist > 1e-6) {
          g.x += (dx / dist) * step;
          g.y += (dy / dist) * step;
          g.z += (dz / dist) * step;
        }
        g.s = tc.s - Math.sign(gap || 1) * Math.max(0, dist - step);
        if (dist - step < 0.9) this.gullStrike(g, tc, ev);
      }
      if ((g.x - px) ** 2 + (g.z - pz) ** 2 > 1e-8) g.heading = Math.atan2(g.z - pz, g.x - px);
    } else if (g.state === 'perch') {
      // Flapping on the roof over the windscreen, facing the driver (taller cars are longer ones).
      const f = tc.stats.length * 0.12;
      g.x = tc.x + Math.cos(tc.heading) * f;
      g.y = tc.y + 1.05 + 0.33 * Math.max(0, tc.stats.length - 2.3);
      g.z = tc.z + Math.sin(tc.heading) * f;
      g.heading = tc.heading + Math.PI;
      if (g.stateT > GULL_TIME || tc.phase !== 'race') {
        g.state = 'leave';
        g.stateT = 0;
        g.heading = tc.heading + (this.rng() < 0.5 ? -1 : 1) * 0.9;
      }
    } else {
      // Up and away over the rooftops.
      g.y += 7 * dt;
      g.x += Math.cos(g.heading) * 14 * dt;
      g.z += Math.sin(g.heading) * 14 * dt;
    }
  }

  private gullStrike(g: Gull, tc: RaceCar, ev: RaceEvent[]): void {
    g.stateT = 0;
    if (tc.grit > 0) {
      // Determination: shoo! It bounces off and flies away.
      tc.grit = 0;
      tc.tally.shooed++;
      this.addHype(tc, 6, 'shooed a seagull', ev);
      g.state = 'leave';
      g.heading = tc.heading + (this.rng() < 0.5 ? -1 : 1) * 1.3;
      ev.push({ type: 'gull', t: this.t, p: tc.p, by: g.owner, shooed: true, x: g.x, y: g.y, z: g.z });
      return;
    }
    g.state = 'perch';
    tc.gullT = GULL_TIME;
    tc.vx *= 0.85;
    tc.vz *= 0.85;
    this.endDrift(tc, ev);
    const o = this.cars[g.owner];
    if (o && o !== tc) {
      o.tally.gulls++;
      this.addHype(o, 6, 'seagull', ev);
    }
    this.addHype(tc, -4, 'seagull', ev);
    ev.push({ type: 'gull', t: this.t, p: tc.p, by: g.owner, shooed: false, x: g.x, y: g.y, z: g.z });
  }

  // ---------------------------------------------------------------------------------------------
  // Launch and flight

  private checkLip(car: RaceCar, ev: RaceEvent[]): void {
    const lip = this.course.lip;
    const last = this.course.points[this.course.points.length - 1];
    // Past the lip plane (the end of the ramp)?
    const ahead = (car.x - lip.x) * last.tx + (car.z - lip.z) * last.tz;
    if (ahead < 0 || car.s < lip.s - 2) return;
    // Wind back to the exact crossing inside this step.
    const vAlong = car.vx * last.tx + car.vz * last.tz;
    const back = vAlong > 1e-6 ? Math.min(ahead / vAlong, DT) : 0;
    car.x -= car.vx * back;
    car.z -= car.vz * back;
    if (car.grounded) {
      car.y = this.roadY(lip.s);
      car.vy = this.gradeAt(last) * vAlong;
    } else car.y -= car.vy * back;
    this.launch(car, ev, back);
  }

  private launch(car: RaceCar, ev: RaceEvent[], rewind: number): void {
    const k = car.stats;
    // Boost left in the bottle at the lip is wasted: it only ever pushes on the way down.
    car.wastedBoostFrac = k.boostCap > 0 ? car.boost / k.boostCap : 0;
    car.boost = 0;
    car.boostFrac = 0;
    car.boosting = false;
    car.drift = 0;
    car.engineOn = false;
    car.wheelspin = false;
    car.sliding = false;
    let v = Math.sqrt(car.vx * car.vx + car.vy * car.vy + car.vz * car.vz);
    const before = v;
    if (k.nitroJ > 0) v = Math.sqrt(v * v + (2 * k.nitroJ) / k.mass);
    const boost = this.opts.hype ? 1 + (HYPE_BOOST * car.hype) / HYPE_MAX : 1;
    v *= boost;
    const scale = before > 1e-9 ? v / before : 1;
    car.vx *= scale;
    car.vy *= scale;
    car.vz *= scale;
    car.kiteOpen = k.kite !== null;
    car.roulette = 0;
    car.runTime = this.raceT - rewind;
    car.launchSpeed = v;
    car.launchBoost = boost - 1;
    car.launchRamp = this.rampAngle;
    car.maxHeight = car.y;
    car.distance = 0;
    car.phase = 'flight';
    car.grounded = false;
    ev.push({
      type: 'launch',
      t: this.t,
      p: car.p,
      speed: v,
      speedBeforeNitro: before,
      wastedBoostFrac: car.wastedBoostFrac,
      boost: boost - 1,
      ramp: car.launchRamp,
    });
    // The first car off the kicker had it at full angle; from now on it drops for the rest.
    if (this.rampDropAt === null && this.cars.some((c) => c.phase === 'race')) {
      this.rampDropAt = this.raceT - rewind;
      ev.push({ type: 'rampDrop', t: this.t, p: car.p });
    }
  }

  private fly(car: RaceCar, dt: number, ev: RaceEvent[]): void {
    const k = car.stats;
    const px = car.x;
    const py = car.y;
    const pz = car.z;
    if (stepFlightBody(car, k, this.wind, dt)) ev.push({ type: 'wingsOpen', t: this.t, p: car.p, x: car.x, y: car.y });
    // The jet keeps nothing: the engine shut off at the lip.
    car.flightTime += dt;
    car.heading = Math.atan2(car.vz, car.vx);
    if (car.y > car.maxHeight) car.maxHeight = car.y;
    const lipX = this.course.lip.x;
    if (car.y <= 0) {
      const f = py / (py - car.y);
      const x = px + (car.x - px) * f;
      const z = pz + (car.z - pz) * f;
      car.flightTime -= dt * (1 - f);
      car.x = x;
      car.z = z;
      car.y = 0;
      car.distance = Math.max(0, x - lipX);
      car.phase = 'splashed';
      car.splashT = this.raceT;
      car.entryDeg = (Math.atan2(-car.vy, Math.sqrt(car.vx * car.vx + car.vz * car.vz)) * 180) / Math.PI;
      const speed = Math.sqrt(car.vx * car.vx + car.vy * car.vy + car.vz * car.vz);
      ev.push({ type: 'splash', t: this.t, p: car.p, distance: car.distance, x, z, speed });
      return;
    }
    car.distance = Math.max(0, car.x - lipX);
    if (car.flightTime >= MAX_FLIGHT_TIME) {
      car.phase = 'splashed';
      car.splashT = this.raceT;
      ev.push({ type: 'splash', t: this.t, p: car.p, distance: car.distance, x: car.x, z: car.z, speed: 0 });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // HYPE: drifting, air, drafting, overtakes and leading all build it

  addHype(car: RaceCar, amount: number, why: string, ev: RaceEvent[]): void {
    if (car.phase !== 'race' && car.phase !== 'grid') return;
    const before = car.hype;
    car.hype = clamp(car.hype + amount, 0, HYPE_MAX);
    if (car.hype !== before) ev.push({ type: 'hype', t: this.t, p: car.p, amount: car.hype - before, why });
  }

  private raceHype(dt: number, ev: RaceEvent[]): void {
    const racing = this.cars.filter((c) => c.phase === 'race');
    for (const car of racing) {
      // Steady trickles don't spam events; they just add up.
      let add = 0;
      if (car.drift !== 0 && car.spin <= 0) {
        // A drift earns HYPE and fills the boost bottle, more for a fast, wide-angle slide. A full
        // bottle can't take any more: spend some before the next corner.
        const f = Math.min(1, Math.hypot(car.vx, car.vz) / 14) * car.driftBite;
        add += 3 * f * dt;
        car.tally.drift += dt;
        const got = this.addBoost(car, DRIFT_CHARGE * f * dt);
        car.driftGain += got;
        car.tally.driftBoost += got;
      }
      if (!car.grounded && car.airTime > 0.15) {
        add += 6 * dt;
        car.tally.air += dt;
      }
      // Slipstream: close behind the other car and lined up with it.
      car.draft = 0;
      for (const o of racing) {
        if (o === car) continue;
        const dx = o.x - car.x;
        const dz = o.z - car.z;
        const fx = Math.cos(o.heading);
        const fz = Math.sin(o.heading);
        const behind = dx * fx + dz * fz;
        const side = Math.abs(-dx * fz + dz * fx);
        if (behind > 1.5 && behind < 14 && side < 2.2) {
          const sp = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
          if (sp > 8) car.draft = 1 - behind / 14;
        }
      }
      if (car.draft > 0) add += 1.5 * dt * car.draft;
      if (add > 0) car.hype = Math.min(HYPE_MAX, car.hype + add);
    }
    // First onto the pier: the race to the kicker is worth something.
    if (this.pierFirst === null && this.cars.length === 2) {
      const first = racing.find((c) => c.s >= this.course.marks.pierS0);
      if (first) {
        this.pierFirst = first.p;
        this.addHype(first, 10, 'first to the pier', ev);
        ev.push({ type: 'pierFirst', t: this.t, p: first.p });
      }
    }
    // Overtakes and the lead.
    if (racing.length === 2) {
      const [a, b] = racing;
      const lead = a.s > b.s ? a : b;
      const prev = this.leader;
      if (Math.abs(a.s - b.s) > 1.5 && lead.p !== prev) {
        this.leader = lead.p;
        if (lead.overtakeCd <= 0 && this.raceT > 2) {
          lead.overtakeCd = 4;
          lead.tally.overtakes++;
          this.addHype(lead, 6, 'overtake', ev);
          ev.push({ type: 'overtake', t: this.t, p: lead.p });
        }
      }
      lead.tally.lead += dt;
      lead.hype = Math.min(HYPE_MAX, lead.hype + 0.3 * dt);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // The world moves: traffic, tourists, the cable car, boxes, poo and cones

  private waymoVel(w: Waymo): { x: number; z: number } {
    const moving = w.stopped > 0 || w.parked ? 0 : w.v;
    return { x: Math.cos(w.heading) * moving + w.pvx, z: Math.sin(w.heading) * moving + w.pvz };
  }

  private updateWorld(dt: number, ev: RaceEvent[]): void {
    const C = this.course;
    for (const b of this.boxes) if (b.hidden > 0) b.hidden = Math.max(0, b.hidden - dt);
    for (const p of this.poos) p.age += dt;
    for (const g of this.gulls) this.updateGull(g, dt, ev);
    for (let i = this.gulls.length - 1; i >= 0; i--) {
      if (this.gulls[i].state === 'leave' && this.gulls[i].stateT > 2.5) this.gulls.splice(i, 1);
    }

    for (const w of this.waymos) {
      // Knocks decay; the car drifts back to its path.
      w.pvx *= Math.exp(-2.2 * dt);
      w.pvz *= Math.exp(-2.2 * dt);
      w.px += w.pvx * dt;
      w.pz += w.pvz * dt;
      w.px *= Math.exp(-0.35 * dt);
      w.pz *= Math.exp(-0.35 * dt);
      w.spinA += w.spinV * dt;
      w.spinV *= Math.exp(-2.5 * dt);
      w.spinA *= Math.exp(-0.5 * dt);
      if (w.stopped > 0) {
        w.stopped -= dt;
        if (w.stopped <= 0 && w.kind !== 'stalled' && !w.parked) w.hazard = false;
      }
      if (w.kind === 'stalled' || w.parked) {
        if (w.parked && w.parkD !== 0) w.d += clamp(w.parkD - w.d, -1.4 * dt, 1.4 * dt);
        this.keepOnRoad(w);
        const base = toWorld(C, w.s, w.d);
        w.x = base.x + w.px;
        w.z = base.z + w.pz;
        w.y = base.y;
        w.heading = w.baseHeading + w.spinA;
        continue;
      }
      // Lidar: brake for anything just ahead in the path.
      const blocked = this.waymoBlocked(w);
      const target = w.stopped > 0 || blocked ? 0 : w.vTarget;
      w.v += clamp(target - w.v, -7 * dt, 2.2 * dt);
      if (w.kind === 'traffic') {
        w.s += w.v * dt;
        if (w.s >= w.sEnd) {
          // Pull over and park at the kerb with the hazards on (gliding over, not jumping), clear of
          // anyone already parked there.
          w.s = w.sEnd;
          w.parked = true;
          w.hazard = true;
          const hw = pointAt(C, w.s, this.tmp).hw;
          let side = Math.sign(w.d || 1);
          for (const o of this.waymos) {
            if (o !== w && (o.parked || o.kind === 'stalled') && Math.abs(o.s - w.s) < 6 && Math.sign(o.parkD || o.d) === side) {
              side = -side;
              break;
            }
          }
          w.parkD = side * (hw - 1.3);
          w.baseHeading = pointAt(C, w.s, this.tmp).heading;
        }
        this.keepOnRoad(w);
        const base = toWorld(C, w.s, w.d);
        w.x = base.x + w.px;
        w.z = base.z + w.pz;
        w.y = base.y;
        w.heading = base.heading + w.spinA;
      } else {
        w.s += w.v * dt;
        // Off the far end: loop back round, out of sight.
        if (w.s > 140) w.s -= 280;
        w.x = w.laneX + w.px;
        w.z = w.dir * w.s + w.pz;
        w.y = C.deckY;
        w.heading = (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + w.spinA;
      }
    }

    if (this.cable) {
      const cb = this.cable;
      if (cb.dwell > 0) {
        cb.dwell -= dt;
        cb.v = 0;
      } else {
        // Stop for anything on the rails just ahead.
        const blocked = this.cars.some(
          (c) => c.phase === 'race' && Math.abs(c.x - cb.x) < 2.2 && cb.dir * (c.z - cb.z) > 3 && cb.dir * (c.z - cb.z) < 7.5,
        );
        const target = blocked ? 0 : 3.2;
        cb.v += clamp(target - cb.v, -5 * dt, 1.2 * dt);
        cb.along += cb.dir * cb.v * dt;
        if ((cb.dir > 0 && cb.along >= cb.z1) || (cb.dir < 0 && cb.along <= cb.z0)) {
          // End of the line: wait, ring the bell, head back.
          cb.along = cb.dir > 0 ? cb.z1 : cb.z0;
          cb.dir = cb.dir > 0 ? -1 : 1;
          cb.dwell = 2.5;
          cb.bell = 0.4;
        }
      }
      cb.z = cb.along;
      cb.heading = cb.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      cb.bell -= dt;
      if (cb.bell <= 0) {
        cb.bell = 4 + this.rng() * 5;
        ev.push({ type: 'bell', t: this.t });
      }
    }

    for (const p of this.peds) {
      if (p.down > 0) {
        p.down -= dt;
        continue;
      }
      if (p.dive > 0) {
        p.dive -= dt;
        // Leap out of the way (along the road and across it, never past its edge), and carry on
        // from where they land: their beat widens to take it in, so nothing snaps back.
        if (p.dive > 0.6) {
          const pt = pointAt(C, p.s, this.tmp2);
          const lim = pt.hw - 0.3;
          p.s = clamp(p.s + (p.fallX * pt.tx + p.fallZ * pt.tz) * 4 * dt, 0.5, C.length - 0.5);
          p.d = clamp(p.d + (-p.fallX * pt.tz + p.fallZ * pt.tx) * 4 * dt, -lim, lim);
          p.d0 = Math.min(p.d0, p.d);
          p.d1 = Math.max(p.d1, p.d);
          const w = toWorld(C, p.s, p.d);
          p.x = w.x;
          p.z = w.z;
          p.y = w.y;
        }
        continue;
      }
      p.walk += dt;
      if (p.kind === 'crosser') {
        if (p.wait > 0) {
          p.wait -= dt;
        } else {
          p.d += p.dir * p.speed * dt;
          if ((p.dir > 0 && p.d >= p.d1) || (p.dir < 0 && p.d <= p.d0)) {
            p.d = p.dir > 0 ? p.d1 : p.d0;
            p.dir = p.dir > 0 ? -1 : 1;
            p.wait = 1.5 + this.rng() * 3.5;
          }
        }
        const w = toWorld(C, p.s, p.d);
        p.x = w.x;
        p.z = w.z;
        p.y = w.y;
        p.heading = w.heading + (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      } else {
        if (p.speed > 0) {
          p.d += p.dir * p.speed * dt;
          if (p.d > p.d1 || p.d < p.d0) {
            p.dir = p.dir > 0 ? -1 : 1;
            p.d = clamp(p.d, p.d0, p.d1);
          }
        }
        const w = toWorld(C, p.s, p.d);
        p.x = w.x;
        p.z = w.z;
        p.y = w.y;
        // Tourists turn about taking photos.
        p.look += dt * 0.6;
        p.heading = w.heading + Math.sin(p.look) * 2.2;
      }
    }

    for (const cn of this.cones) {
      if (!cn.hit) continue;
      if (cn.y > cn.ground || cn.vy > 0) {
        cn.vy -= G * dt;
        cn.x += cn.vx * dt;
        cn.y += cn.vy * dt;
        cn.z += cn.vz * dt;
        cn.rx += cn.spin * dt;
        cn.rz += cn.spin * 0.6 * dt;
        if (cn.y <= cn.ground && cn.vy < 0) {
          cn.y = cn.ground;
          cn.vy = -cn.vy * 0.3;
          cn.vx *= 0.6;
          cn.vz *= 0.6;
          cn.spin *= 0.5;
          if (Math.abs(cn.vy) < 1) cn.vy = 0;
        }
      } else {
        cn.vx *= Math.exp(-3 * dt);
        cn.vz *= Math.exp(-3 * dt);
        cn.x += cn.vx * dt;
        cn.z += cn.vz * dt;
      }
    }
  }

  /** A knocked course Waymo can't be shoved off the road (through the kerb). */
  private keepOnRoad(w: Waymo): void {
    const C = this.course;
    const p = pointAt(C, w.s, this.tmp);
    const rx = -p.tz;
    const rz = p.tx;
    const lat = w.d + w.px * rx + w.pz * rz;
    const lim = p.hw - WAYMO_W / 2 - 0.2;
    if (Math.abs(lat) <= lim) return;
    const over = lat - Math.sign(lat) * lim;
    w.px -= rx * over;
    w.pz -= rz * over;
    const vn = w.pvx * rx + w.pvz * rz;
    if (Math.sign(vn) === Math.sign(lat)) {
      w.pvx -= rx * vn;
      w.pvz -= rz * vn;
    }
  }

  /** Something in a Waymo's path within a few metres (they are very polite). */
  private waymoBlocked(w: Waymo): boolean {
    const fx = Math.cos(w.heading);
    const fz = Math.sin(w.heading);
    const look = 4 + w.v * 0.9;
    const check = (x: number, z: number, r: number): boolean => {
      const dx = x - w.x;
      const dz = z - w.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(-dx * fz + dz * fx);
      return ahead > WAYMO_LEN / 2 && ahead < WAYMO_LEN / 2 + look && side < WAYMO_W / 2 + r + 0.4;
    };
    for (const p of this.peds) if (p.down <= 0 && check(p.x, p.z, PED_R)) return true;
    for (const c of this.cars) if (c.phase === 'race' && check(c.x, c.z, c.stats.width / 2)) return true;
    if (w.kind === 'cross') {
      // Lidar sees racers coming down the hill: stop short of the crossing and let them through.
      // Distance from its nose to the kerb, less what it needs to stop: once it can't stop short of
      // the road it's committed and carries on across.
      const before = w.dir * -w.z;
      const room = before - WAYMO_LEN / 2 - (w.v * w.v) / 14 - RH_CROSS;
      const approaching = room > 0 && before < 26;
      if (approaching) {
        for (const c of this.cars) {
          if (c.phase !== 'race') continue;
          const toLane = w.laneX - c.x;
          const vx = c.vx;
          if (toLane > -3 && toLane < 34 && Math.abs(c.z) < 9 && (toLane < 6 || vx > 1)) return true;
        }
      }
    }
    for (const o of this.waymos) if (o !== w && check(o.x, o.z, WAYMO_W / 2)) return true;
    return false;
  }

  // ---------------------------------------------------------------------------------------------

  private endRules(ev: RaceEvent[]): void {
    for (const car of this.cars) {
      if ((car.phase === 'splashed' || car.phase === 'dnf') && this.firstDoneAt === null) this.firstDoneAt = this.raceT;
    }
    for (const car of this.cars) {
      if (car.phase !== 'race') continue;
      const straggler = this.firstDoneAt !== null && this.raceT - this.firstDoneAt > STRAGGLER_TIME;
      if (straggler || this.raceT > MAX_RACE_TIME) {
        car.phase = 'dnf';
        car.vx = car.vz = car.vy = 0;
        car.engineOn = false;
        car.roulette = 0;
        car.distance = 0;
        ev.push({ type: 'dnf', t: this.t, p: car.p, s: car.s, reason: straggler ? 'straggler' : 'timeout' });
      }
    }
  }

  /** Seconds the straggler has left to reach the lip (null if no clock is running). */
  stragglerLeft(): number | null {
    if (this.firstDoneAt === null) return null;
    return Math.max(0, STRAGGLER_TIME - (this.raceT - this.firstDoneAt));
  }

  /** Arc-length gap from this car to the leader (0 if leading). */
  gapToLeader(p: PlayerIndex): number {
    const me = this.cars[p];
    let best = me.s;
    for (const c of this.cars) if (c.phase === 'race' && c.s > best) best = c.s;
    return best - me.s;
  }

  /** Give a car an item directly and select it (test hook). A full hand swaps out the selected one. */
  giveItem(p: PlayerIndex, item: ItemKind): void {
    const car = this.cars[p];
    if (!car) return;
    if (car.items.length >= ITEM_SLOTS) car.items[car.sel] = item;
    else {
      car.items.push(item);
      car.sel = car.items.length - 1;
    }
    car.roulette = 0;
  }

  /** Put a car at a point on the course (test hook). */
  place(p: PlayerIndex, s: number, d = 0, speed = 0): void {
    const car = this.cars[p];
    if (!car) return;
    const w = toWorld(this.course, s, d);
    car.x = w.x;
    car.z = w.z;
    car.y = this.roadY(s);
    car.s = s;
    car.d = d;
    car.heading = w.heading;
    car.vx = Math.cos(w.heading) * speed;
    car.vz = Math.sin(w.heading) * speed;
    car.vy = this.gradeAt(pointAt(this.course, s, this.tmp)) * speed;
    car.grounded = true;
    car.drift = 0;
    car.stuckS = s;
    car.stuckT = 0;
    car.wrongWay = 0;
    car.backwardsT = 0;
    car.hopS = -1;
    car.hopLand = false;
  }

  /**
   * Start a car further down the course (solo training): at rest in the middle of the road, with the
   * start clear. Traffic sitting on it moves on down the road, and on Hyde St the cable car waits at
   * the far end of its line for a while: something to steer round, never in the way at GO.
   */
  placeStart(p: PlayerIndex, s: number): void {
    this.place(p, s, 0, 0);
    for (const w of this.waymos) {
      if (w.kind !== 'traffic' || w.s < s - 10 || w.s > s + 24) continue;
      w.s = Math.min(w.sEnd, s + 24 + (w.s - s + 10) * 0.5);
      const base = toWorld(this.course, w.s, w.d);
      w.x = base.x;
      w.y = base.y;
      w.z = base.z;
      w.heading = base.heading;
    }
    const hyde = this.course.sections.find((q) => q.kind === 'hyde');
    const cb = this.cable;
    if (cb && hyde && s > hyde.s0 - 5 && s < hyde.s1) {
      const z = this.cars[p].z;
      cb.along = Math.abs(cb.z1 - z) > Math.abs(cb.z0 - z) ? cb.z1 : cb.z0;
      cb.z = cb.along;
      cb.dir = cb.along === cb.z1 ? -1 : 1;
      cb.heading = cb.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      cb.dwell = 12;
    }
  }

  /** Index into the course samples for a car (for renderers). */
  sampleIndex(p: PlayerIndex): number {
    return indexAt(this.course, this.cars[p].s);
  }
}

// The race: two driven cars on the course, the traffic and tourists they dodge, the item boxes,
// the HYPE they earn, and how it ends. Every map and every mode runs through this one sim; the
// map's course and the mode's rules (src/modes.ts) decide the ending: off the kicker into the flight
// model (a course with a lip: the long jump scores the distance, a race the time to the lip), the
// chequered flag after the last lap (a loop), or a finish line (point to point, no lip).
// Deterministic with a fixed step and a seeded RNG; no Three.js or DOM imports (the bots and the
// balance check use it).
import { RUSSIAN_HILL_MAP, type MapDef } from '../maps';
import type { ModeRules } from '../modes';
import {
  WALL_HEIGHT,
  crossedS,
  deltaS,
  gardenFrame,
  gardenWorld,
  heightAt,
  indexAt,
  locate,
  pointAt,
  roadsAt,
  surfaceAt,
  toWorld,
  wrapS,
  type Course,
  type CoursePoint,
  type Garden,
  type Located,
  type Surface,
} from '../track';
import { inPoly, type OpenGround } from '../openGround';
import type { CarStats, PlayerIndex } from '../types';
import {
  CRAWL_ACC,
  CRAWL_GRADE,
  CRAWL_SPEED,
  DT,
  G,
  MAX_FLIGHT_TIME,
  RHO,
  SURFACES,
  cornerForce,
  cornerGrip,
  driftGrip,
  makeRng,
  maxYawRate,
  normalLoad,
  stepFlightBody,
  topSpeedIn,
  windAlong,
} from './physics';

// ---------------------------------------------------------------------------------------------
// Tuning

/** Launch-speed bonus at full HYPE. */
export const HYPE_BOOST = 0.15;
export const HYPE_MAX = 100;
const REVERSE_FORCE = 2600;
const REVERSE_MAX = 5;
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
export const BOOST_ACC = 10;
/** How far past the engine's top speed boost can take the car (× top speed); it fades on the way. */
export const BOOST_TOP = 1.35;
/** Item top-up: share of the bottle it refills. */
export const TOPUP = 0.5;
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
/** After the first car finishes, the other has this long to reach the lip (or the flag). */
export const STRAGGLER_TIME = 25;
/** A car that has taken the flag cruises on at about this speed (m/s), off the racing line. */
const CRUISE_SPEED = 11;
/** Past a point-to-point finish line, a car eases to a stop this far (m) short of the road's end. */
const RUNOFF_STOP = 6;
/** However fast it crossed the line, the run-off stops it by then, like a gravel trap (m/s²). */
const RUNOFF_ARREST = 9;
const ROULETTE_TIME = 0.9;
/** Items a car can hold at once. */
export const ITEM_SLOTS = 2;
const GRIT_TIME = 12;
/** Seagull: flying speed (m/s), how long it carries the car it lands on, and how long it may hunt. */
const GULL_SPEED = 44;
const GULL_TIME = 1.4;
const GULL_LIFE = 8;
/** How high (m) a seagull hauls its catch before letting go, and how far back from its target it's
 *  let loose when the thrower is further behind than that (m along the course). */
const GULL_LIFT = 5;
const GULL_SPAWN = 30;
/** Seconds a poo spin-out leaves the windscreen splattered. */
const POO_BLIND = 5;
/** Dungeness crab (the item, a green shell): how fast it scuttles off (m/s, and at least this much
 *  faster than the car that threw it), how long before it gives up and burrows into the road (s),
 *  its size (m), and how long before it can nip the car that threw it (s). */
const CRAB_SPEED = 32;
const CRAB_LEAD = 10;
const CRAB_LIFE = 5;
const CRAB_R = 0.6;
const CRAB_GRACE = 0.5;
/** Thrown forwards, it goes where the nose points, give or take this much (radians) off the road's
 *  own direction (any more and it only zigzags from kerb to kerb). */
const CRAB_AIM = 0.35;
/** IPO coin (the item, a Bullet Bill): how long the ride lasts (s), how fast it goes (m/s), and how
 *  far short of the foot of the kicker it lets go (m): the jump is always the car's own. */
const IPO_TIME = 4.5;
const IPO_SPEED = 34;
export const IPO_LIP = 30;
const SPIN_TIME = 1.05;
const WAYMO_MASS = 2300;
const PED_R = 0.42;
/** Cross traffic drives this far (m) either side of the course, then comes round again out of sight. */
const CROSS_REACH = 140;
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

export type ItemKind = 'jump' | 'grit' | 'poo' | 'topup' | 'refill' | 'gull' | 'crab' | 'ipo';

export const ITEM_KINDS: readonly ItemKind[] = ['jump', 'grit', 'poo', 'topup', 'refill', 'gull', 'crab', 'ipo'];

export const ITEM_NAMES: Record<ItemKind, string> = {
  jump: 'Jump',
  grit: 'Determination',
  poo: 'Poo',
  topup: 'Boost top-up',
  refill: 'Full boost',
  gull: 'Seagull',
  crab: 'Dungeness crab',
  ipo: 'IPO coin',
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
  /** Throw the item backwards (a crab). Unset, holding the brake does. */
  back?: boolean;
}

export const NO_INPUT: CarInput = { throttle: 0, brake: 0, steer: 0, item: false, boost: false, swap: false };

/** On the grid, racing, in the air off the kicker, in the water, past the flag, out. */
export type CarPhase = 'grid' | 'race' | 'flight' | 'splashed' | 'finished' | 'dnf';

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
  /** Crabs that nipped the rival, and crabs that nipped this car. */
  crabs: number;
  crabbed: number;
  /** IPO coins ridden. */
  ipo: number;
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
  /** Progress along the course since the start line (m): s on a point-to-point course; on a loop
   *  it counts the laps too, so it's what race order is decided on. */
  prog: number;
  /** Laps: the one being driven (0 behind the line on the grid), the race time it began, and the
   *  times of those completed. */
  lap: number;
  lapStart: number;
  lapTimes: number[];
  /** Race time the car took the flag (a race), or null. */
  finishT: number | null;
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
  /** What the tyres are on ('paved' in the air). */
  surface: Surface;
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
  /** Seconds left in a seagull's grip, hauled up off the road. */
  gullT: number;
  /** Seconds left with poo on the windscreen. */
  blindT: number;
  /** Seconds left riding an IPO coin (on rails down the course, ploughing through everything), and
   *  how fast it's going. */
  ipoT: number;
  ipoV: number;
  /** Up in the air because a seagull hauled it there (no air time, no HYPE for it). */
  carried: boolean;
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
  /** The open ground (a park you can drive anywhere in: course.open) the car is in, by index; -1 on
   *  the road. */
  og: number;
  /** Off the paths across open ground: where it left them (-1 when it hasn't) and how far it has
   *  driven since, to see how much route it cut when it's back on one. */
  cutS: number;
  cutDist: number;
  /** Where it was at the last stuck check (on open ground, progress along the course doesn't say
   *  whether a car is getting anywhere). */
  stuckX: number;
  stuckZ: number;
  /** Held to the course's paths on open ground as if it were a road (the CPU: it doesn't roam). */
  keepToRoad: boolean;
  /** Close passes that become near misses if nothing is hit in the next moment (id → race time). */
  nearPending: Map<number, { t: number; what: Obstacle }>;
  /** After ploughing through a Waymo, ignore that one Waymo for a moment. */
  ghostId: number;
  ghostT: number;
}

/** The nearest point on a polygon's outline to (x, z). */
function nearestOnOutline(poly: readonly (readonly [number, number])[], x: number, z: number): { x: number; z: number } {
  let best = Infinity;
  let bx = poly[0][0];
  let bz = poly[0][1];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j];
    const ex = poly[i][0] - ax;
    const ez = poly[i][1] - az;
    const l2 = ex * ex + ez * ez;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0;
    const px = ax + ex * t;
    const pz = az + ez * t;
    const d2 = (px - x) ** 2 + (pz - z) ** 2;
    if (d2 < best) {
      best = d2;
      bx = px;
      bz = pz;
    }
  }
  return { x: bx, z: bz };
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
  /** Cross traffic: where its lane crosses the course's centreline, the way it drives (a unit
   *  vector; `s` is how far along the lane it is from that point), where on the course it crosses
   *  and how wide the road is there, and the way the course runs there (a unit vector). */
  laneX: number;
  laneZ: number;
  lux: number;
  luz: number;
  dir: 1 | -1;
  crossS: number;
  crossHw: number;
  ctx: number;
  ctz: number;
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
  /** A crosser walks back and forth across the road; a tourist stands about in it taking photos; a
   *  dog roams its patch of park (see addDog). */
  kind: 'crosser' | 'tourist' | 'dog';
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
  /** A dog's patch of park along the course, where it's trotting to, whether it's the sort that
   *  chases cars, who it's chasing and for how much longer, and the time to its next bark. */
  sMin: number;
  sMax: number;
  toS: number;
  toD: number;
  chaser: boolean;
  chaseP: PlayerIndex | -1;
  chase: number;
  chaseCool: number;
  bark: number;
  /** How fast it's going (m/s), for the legs. */
  pace: number;
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
 *  leading rival, hauls them up off the road, drops them and flies off. */
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

/** A Dungeness crab from the item: it scuttles down the course (or back up it) in a straight line
 *  along the road, bouncing off the kerbs, and nips the first car it meets (the thrower too, once
 *  it's had a moment to get clear). Traffic and trams stop it; after a while it burrows away. */
export interface Crab {
  id: number;
  owner: PlayerIndex;
  s: number;
  d: number;
  x: number;
  y: number;
  z: number;
  /** Speed along the course (m/s; negative: back up it) and across it. */
  vs: number;
  vd: number;
  /** Direction of travel (the crab itself faces across it: it walks sideways). */
  heading: number;
  age: number;
  /** Seconds since it was stopped or burrowed (null: still going). */
  gone: number | null;
}

/** A cable car (or any tram): it shuttles along straight rails, stopping for anything on them. */
export interface CableCar {
  /** Collision id (negative: not a sim object id). */
  id: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  v: number;
  /** The rails: a point on them and their direction (a unit vector). */
  ox: number;
  oz: number;
  ux: number;
  uz: number;
  /** Position along the rails from that point, shuttling between a0 and a1, heading `dir`. */
  along: number;
  a0: number;
  a1: number;
  dir: 1 | -1;
  /** The stretch of course the rails run along (a solo start there sends it to the far end). */
  span: [number, number] | null;
  /** Its destination sign ("POWELL & HYDE"). */
  sign: string;
  /** Seconds left waiting at the end of the line. */
  dwell: number;
  bell: number;
  /** What it is, its body (see TRAM_DIMS) as collision circles along it, and grown for near
   *  misses. */
  vehicle: TramKind;
  length: number;
  width: number;
  height: number;
  cruise: number;
  circles: [number, number][];
  near: [number, number][];
  /** The rails' height along them ([along, y] points; null: level at y), and so its pitch now
   *  (radians, nose up along its heading). */
  profile: [number, number][] | null;
  pitch: number;
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
  | { type: 'bark'; t: number; id: number; x: number; z: number; chasing: boolean }
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
  | { type: 'spinout'; t: number; p: PlayerIndex; by: PlayerIndex | null; cause: 'poo' | 'crab' }
  | { type: 'crab'; t: number; p: PlayerIndex; by: PlayerIndex; shielded: boolean; x: number; y: number; z: number }
  | { type: 'crabGone'; t: number; id: number; why: 'bonk' | 'burrow' | 'crab'; x: number; y: number; z: number }
  | { type: 'ipoEnd'; t: number; p: PlayerIndex }
  | { type: 'shortcut'; t: number; p: PlayerIndex; s: number; gained: number }
  | { type: 'hype'; t: number; p: PlayerIndex; amount: number; why: string }
  | { type: 'rescue'; t: number; p: PlayerIndex }
  | { type: 'bell'; t: number }
  | { type: 'runupFirst'; t: number; p: PlayerIndex }
  | { type: 'launch'; t: number; p: PlayerIndex; speed: number; speedBeforeNitro: number; wastedBoostFrac: number; boost: number; ramp: number }
  | { type: 'rampDrop'; t: number; p: PlayerIndex }
  | { type: 'wingsOpen'; t: number; p: PlayerIndex; x: number; y: number }
  | { type: 'splash'; t: number; p: PlayerIndex; distance: number; x: number; z: number; speed: number }
  | { type: 'lap'; t: number; p: PlayerIndex; lap: number; time: number; best: boolean }
  | { type: 'finish'; t: number; p: PlayerIndex; time: number; place: number }
  | { type: 'dnf'; t: number; p: PlayerIndex; s: number; reason: 'timeout' | 'straggler' };

export interface RaceOptions {
  seed?: number;
  /** Laps in a race (default: the map's). Ignored for the long jump. */
  laps?: number;
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
  /** Long jump: time to the lip. Race: time to the flag (or the time the car went out). */
  runTime: number;
  /** Race: took the flag, the laps done and their times, the best of them, and where it finished. */
  finished: boolean;
  laps: number;
  lapTimes: number[];
  bestLap: number | null;
  place: number;
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
    crabs: 0,
    crabbed: 0,
    ipo: 0,
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
/** How close a pass has to be to count as a near miss, and the bodies grown by it. */
const NEAR_MARGIN = 0.9;
const grow = (cs: [number, number][]): [number, number][] => cs.map(([o, r]) => [o, r + NEAR_MARGIN]);
const WAYMO_NEAR = grow(WAYMO_CIRCLES);
const PED_NEAR = grow([[0, PED_R]]);
export const WAYMO_DIMS = { length: WAYMO_LEN, width: WAYMO_W, height: 1.75 };

/** What runs on a map's rails: a cable car (Powell & Hyde) or a Muni streetcar (the N Judah). */
export type TramKind = 'cable' | 'streetcar';

/** Each kind of tram's body (m), the speed it trundles along at (m/s) and how long it waits at the
 *  end of its line (s: the N Judah sits in its tunnel a while before coming out again). */
export const TRAM_DIMS: Record<TramKind, { length: number; width: number; height: number; cruise: number; dwell: number }> = {
  cable: { length: 8.6, width: 2.6, height: 3.4, cruise: 3.2, dwell: 2.5 },
  streetcar: { length: 15.6, width: 2.7, height: 3.6, cruise: 6, dwell: 7 },
};
export const CABLE_DIMS = TRAM_DIMS.cable;

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
  readonly map: MapDef;
  readonly course: Course;
  /** What the event is raced for (the map's mode). */
  readonly rules: ModeRules;
  /** Laps to race (1 for the long jump). */
  readonly laps: number;
  /** The time limit (s): past it, anyone still on the road is out. */
  readonly maxTime: number;
  readonly wind: number;
  readonly cars: RaceCar[];
  readonly waymos: Waymo[] = [];
  readonly peds: Ped[] = [];
  readonly poos: Poo[] = [];
  readonly boxes: ItemBox[] = [];
  readonly cones: LooseCone[] = [];
  readonly gulls: Gull[] = [];
  readonly crabs: Crab[] = [];
  readonly cables: CableCar[] = [];
  readonly opts: Required<RaceOptions>;
  /** Sim time since construction (the countdown runs on the grid). */
  t = 0;
  /** Time since GO. */
  raceT = 0;
  started = false;
  /** When the first car finished (splashed, took the flag or went out), in race time. */
  firstDoneAt: number | null = null;
  /** Cars that have taken the flag, in order. */
  private readonly flagged: PlayerIndex[] = [];
  private readonly rng: () => number;
  private nextId = 1;
  private readonly tmp: CoursePoint;
  private readonly tmp2: CoursePoint;
  private readonly tmpW: CoursePoint;
  private readonly loc: Located = { s: 0, d: 0, i: 0 };
  private readonly loc2: Located = { s: 0, d: 0, i: 0 };
  private leader: PlayerIndex = 0;
  /** Who reached the lip's run-up (the pier) first (a HYPE bonus for winning the race to it). */
  runupFirst: PlayerIndex | null = null;
  /** The kicker's angle now (radians): full until the first car goes off it, then dropping. */
  rampAngle: number;
  /** Race time the first car went off the kicker (the ramp has been dropping since), or null. */
  rampDropAt: number | null = null;
  /** The kicker's rise as a share of its full height, and where the (flat) pier hands over to it. */
  private rampScale = 1;
  private readonly rampFrom: number;
  /** Where a point-to-point race without a lip finishes (Infinity otherwise). */
  private readonly finishS: number;

  constructor(stats: CarStats[], wind: number, opts: RaceOptions = {}, map: MapDef = RUSSIAN_HILL_MAP) {
    const course = map.course;
    this.map = map;
    this.course = course;
    this.rules = map.rules;
    this.rules.check(course, map.id);
    this.laps = this.rules.laps(course, map.laps, opts.laps);
    this.maxTime = this.rules.maxTime(course, this.laps);
    this.finishS = !course.loop && !course.lip && course.finishS !== null ? course.finishS : Infinity;
    this.wind = wind;
    this.rampFrom = course.lip ? course.lip.rampS0 - 1 : Infinity;
    this.rampAngle = course.lip?.angle ?? 0;
    this.opts = { seed: opts.seed ?? 1, laps: this.laps, obstacles: opts.obstacles ?? true, items: opts.items ?? true, hype: opts.hype ?? true };
    this.rng = makeRng(this.opts.seed * 7919 + 17);
    this.tmp = { ...course.points[0] };
    this.tmp2 = { ...course.points[0] };
    this.tmpW = { ...course.points[0] };
    this.cars = stats.map((st, i) => this.makeCar(i as PlayerIndex, st, stats.length));
    for (const car of this.cars) car.prog = this.progressOf(car);
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
      prog: 0,
      lap: 0,
      lapStart: 0,
      lapTimes: [],
      finishT: null,
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
      surface: 'paved',
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
      blindT: 0,
      ipoT: 0,
      ipoV: 0,
      carried: false,
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
      launchRamp: this.course.lip?.angle ?? 0,
      wastedBoostFrac: 0,
      distance: 0,
      maxHeight: this.course.lip?.y ?? this.course.startY,
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
      og: -1,
      cutS: -1,
      cutDist: 0,
      stuckX: 0,
      stuckZ: 0,
      keepToRoad: false,
      nearPending: new Map(),
      ghostId: 0,
      ghostT: 0,
    };
  }

  // ---------------------------------------------------------------------------------------------
  // World setup (seeded per round, so every race is a little different). The map says what goes
  // where (MapDef.boxes and MapDef.populate); these put it there.

  private placeBoxes(): void {
    const c = this.course;
    for (const row of this.map.boxes) {
      for (const d of row.ds) {
        const w = toWorld(c, row.s, d);
        this.boxes.push({ id: this.nextId++, s: wrapS(c, row.s), d, x: w.x, y: w.y, z: w.z, hidden: 0 });
      }
    }
  }

  private placeObstacles(): void {
    this.map.populate?.(this, this.rng);
  }

  /** A Waymo driving along the course at lane offset d, pulling over and parking at sEnd (Infinity:
   *  it drives round a loop for ever). */
  addTraffic(s: number, d: number, v: number, sEnd: number): Waymo {
    const w = toWorld(this.course, s, d);
    const wm = this.makeWaymo('traffic', w.x, w.z, w.y, w.heading, s, d, v, sEnd);
    this.waymos.push(wm);
    return wm;
  }

  /** A stalled Waymo at (s, d), turned `turn` radians from the way the course runs. */
  addStalled(s: number, d: number, turn: number): Waymo {
    const w = toWorld(this.course, s, d);
    const wm = this.makeWaymo('stalled', w.x, w.z, w.y, w.heading + turn, s, d, 0, s);
    this.waymos.push(wm);
    return wm;
  }

  /**
   * Cross traffic on a road that crosses the course at about crossS: its lane passes through
   * (x, z) on the course's centreline, running along the unit vector (ux, uz) (the way it drives);
   * it starts `along` metres down the lane from there (negative: still coming), at height y.
   */
  addCrossing(lane: { x: number; z: number; ux: number; uz: number }, along: number, y: number, v: number, crossS: number): Waymo {
    const heading = Math.atan2(lane.uz, lane.ux);
    const wm = this.makeWaymo('cross', lane.x + lane.ux * along, lane.z + lane.uz * along, y, heading, along, 0, v, 0);
    const pt = pointAt(this.course, crossS);
    wm.laneX = lane.x;
    wm.laneZ = lane.z;
    wm.lux = lane.ux;
    wm.luz = lane.uz;
    wm.baseHeading = heading;
    wm.crossS = crossS;
    wm.crossHw = pt.hw;
    wm.ctx = pt.tx;
    wm.ctz = pt.tz;
    this.waymos.push(wm);
    return wm;
  }

  /** A traffic cone standing loose on the road. */
  addCone(s: number, d: number): void {
    const cw = toWorld(this.course, s, d);
    this.cones.push({ id: this.nextId++, x: cw.x, y: cw.y, z: cw.z, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0, spin: 0, hit: false, ground: cw.y });
  }

  /**
   * A cable car (or a streetcar: `vehicle`) on straight rails through (x, z) along the unit vector
   * (ux, uz), at height y, shuttling between a0 and a1 metres along them, starting at `along`
   * heading `dir`. `span` is the stretch of course the rails run along, if they do.
   */
  addCable(
    rail: { x: number; z: number; ux: number; uz: number },
    y: number,
    a0: number,
    a1: number,
    along: number,
    dir: 1 | -1,
    bell: number,
    span: [number, number] | null = null,
    sign = 'CABLE CAR',
    vehicle: TramKind = 'cable',
    profile: [number, number][] | null = null,
  ): CableCar {
    const dims = TRAM_DIMS[vehicle];
    const circles = bodyCircles(dims.length, dims.width);
    const cb: CableCar = {
      id: -1 - this.cables.length,
      x: 0,
      y,
      z: 0,
      heading: 0,
      v: 0,
      ox: rail.x,
      oz: rail.z,
      ux: rail.ux,
      uz: rail.uz,
      along,
      a0,
      a1,
      dir,
      span,
      sign,
      dwell: 0,
      bell,
      vehicle,
      length: dims.length,
      width: dims.width,
      height: dims.height,
      cruise: dims.cruise,
      circles,
      near: grow(circles),
      profile,
      pitch: 0,
    };
    this.placeCable(cb);
    this.cables.push(cb);
    return cb;
  }

  /** Put a cable car where its position along the rails says, facing the way it's going (and up or
   *  down the rails' slope, if they have one). */
  private placeCable(cb: CableCar): void {
    cb.x = cb.ox + cb.ux * cb.along;
    cb.z = cb.oz + cb.uz * cb.along;
    cb.heading = cb.dir > 0 ? Math.atan2(cb.uz, cb.ux) : Math.atan2(-cb.uz, -cb.ux);
    const pr = cb.profile;
    if (pr && pr.length > 1) {
      let i = 0;
      while (i < pr.length - 2 && pr[i + 1][0] < cb.along) i++;
      const [a0, y0] = pr[i];
      const [a1, y1] = pr[i + 1];
      const f = clamp((cb.along - a0) / (a1 - a0), 0, 1);
      cb.y = y0 + (y1 - y0) * f;
      cb.pitch = Math.atan2((y1 - y0) * cb.dir, a1 - a0);
    }
  }

  /** A point relative to a cable car: along its rails, and across them. */
  private cableRel(cb: CableCar, x: number, z: number): { along: number; across: number } {
    const dx = x - cb.x;
    const dz = z - cb.z;
    return { along: dx * cb.ux + dz * cb.uz, across: dx * cb.uz - dz * cb.ux };
  }

  /**
   * A dog loose in a park: it trots about its patch (sMin..sMax along the course, d0..d1 across it),
   * stopping to sniff; a chaser also runs alongside any racer that comes past, barking, until the
   * car leaves its patch. Dogs are too quick to hit: they leap clear.
   */
  addDog(s: number, d: number, sMin: number, sMax: number, d0: number, d1: number, chaser: boolean): Ped {
    const p = this.makePed('dog', s, d, d0, d1, 1, 0, this.rng() * 3);
    p.sMin = sMin;
    p.sMax = sMax;
    p.toS = s;
    p.toD = d;
    p.chaser = chaser;
    p.bark = this.rng() * 4;
    this.peds.push(p);
    return p;
  }

  /** A pedestrian: a crosser walks between d0 and d1 and back; a tourist stands about in the road. */
  addPed(kind: Ped['kind'], s: number, d: number, d0: number, d1: number, dir: 1 | -1, speed: number, wait: number): Ped {
    const p = this.makePed(kind, s, d, d0, d1, dir, speed, wait);
    this.peds.push(p);
    return p;
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
      laneZ: 0,
      lux: 0,
      luz: 0,
      dir: 1,
      crossS: 0,
      crossHw: 0,
      ctx: 1,
      ctz: 0,
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
      sMin: s,
      sMax: s,
      toS: s,
      toD: d,
      chaser: false,
      chaseP: -1,
      chase: 0,
      chaseCool: 0,
      bark: 0,
      pace: 0,
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Public API

  get done(): boolean {
    return this.cars.every((c) => c.phase === 'splashed' || c.phase === 'finished' || c.phase === 'dnf');
  }

  /** Road height at s, with the kicker at its angle right now. */
  roadY(s: number): number {
    const h = heightAt(this.course, s);
    if (this.rampScale === 1 || s <= this.rampFrom) return h;
    const base = this.course.lip!.baseY;
    return base + (h - base) * this.rampScale;
  }

  /** The road's grade at a course point (the kicker's is its slope right now). */
  gradeAt(pt: CoursePoint): number {
    return this.rampScale === 1 || pt.s <= this.rampFrom ? pt.grade : pt.grade * this.rampScale;
  }

  /** The kicker drops once the first car is off it: whoever is behind launches lower. */
  private updateRamp(): void {
    const lip = this.course.lip;
    if (!lip || this.rampDropAt === null || this.rampAngle <= RAMP_MIN) return;
    this.rampAngle = Math.max(RAMP_MIN, lip.angle - RAMP_RATE * (this.raceT - this.rampDropAt));
    this.rampScale = Math.tan(this.rampAngle) / lip.grade;
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
    const sPrev = this.cars.map((c) => c.s);
    for (const car of this.cars) {
      if (car.phase === 'race') {
        if (car.ipoT > 0) this.ipoRide(car, dt, ev);
        else this.drive(car, inputs[car.p] ?? NO_INPUT, dt, ev);
      }
      // Past the flag, a car cruises on out of the way.
      else if (car.phase === 'finished') {
        this.drive(car, this.cruise(car), dt, ev);
        if (!this.course.loop && car.grounded) {
          const room = Math.max(0, this.course.length - RUNOFF_STOP - car.s);
          const v = Math.hypot(car.vx, car.vz);
          const vMax = Math.sqrt(2 * RUNOFF_ARREST * room);
          if (v > vMax && v > 1e-6) {
            car.vx *= vMax / v;
            car.vz *= vMax / v;
          }
        }
      }
    }
    this.carVsCar(ev);
    for (const car of this.cars) {
      if (car.phase !== 'race' && car.phase !== 'finished') continue;
      this.hitObstacles(car, ev);
      this.settleNearMisses(car, ev);
      // Collisions can shove a car: find it on the road again and keep it inside the walls (on open
      // ground, the park's).
      const loc = locate(this.course, car.x, car.z, car.s, 4, this.loc);
      car.s = loc.s;
      car.d = loc.d;
      if (this.course.open) car.og = this.openGroundAt(car);
      if (car.og >= 0) this.openWalls(this.course.open![car.og], car, ev);
      else this.walls(car, ev);
      if (car.phase !== 'race') continue;
      this.pickups(car, dt, ev);
      this.useItem(car, inputs[car.p] ?? NO_INPUT, ev);
      // The ending: off the kicker (a course with a lip), or over the line.
      if (this.course.lip) this.checkLip(car, ev);
      else this.checkLine(car, sPrev[car.p], ev);
      car.prog = this.progressOf(car);
    }
    for (const car of this.cars) if (car.phase === 'flight') this.fly(car, dt, ev);
    this.raceHype(dt, ev);
    this.endRules(ev);
    return ev;
  }

  results(): CarResult[] {
    const order = this.order();
    return this.cars.map((c) => ({
      distance: c.phase === 'dnf' ? 0 : c.distance,
      dnf: c.phase === 'dnf',
      runTime: c.runTime,
      finished: c.finishT !== null,
      laps: c.lapTimes.length,
      lapTimes: [...c.lapTimes],
      bestLap: c.lapTimes.length ? Math.min(...c.lapTimes) : null,
      place: order.indexOf(c.p) + 1,
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

  /**
   * Race order (index 0 leads). Scored on distance (the long jump): by progress, and launched cars
   * are ahead of any still on the road. Scored on time (a race): whoever finished first, then by
   * progress (laps and all); out last.
   */
  order(): PlayerIndex[] {
    if (this.rules.score === 'time') {
      const key = (c: RaceCar): number => {
        if (c.finishT !== null) return 1e9 - this.flagged.indexOf(c.p);
        return c.phase === 'dnf' ? -1e9 + c.prog : c.prog;
      };
      return [...this.cars].sort((a, b) => key(b) - key(a)).map((c) => c.p);
    }
    const key = (c: RaceCar): number => (c.phase === 'race' || c.phase === 'grid' ? c.s : this.course.length + 1000 - (c.runTime || 0));
    return [...this.cars].sort((a, b) => key(b) - key(a)).map((c) => c.p);
  }

  /** Progress since the start line: s itself point to point; on a loop, the laps done plus the way
   *  round this one (behind the line on the grid it's a few metres short of zero). */
  private progressOf(car: RaceCar): number {
    const c = this.course;
    if (!c.loop) return car.s;
    return (car.lap - 1) * c.length + wrapS(c, car.s - c.startS);
  }

  /** Over the line: on a loop, count the laps as the car crosses the start line and wave the flag
   *  after the last one; point to point, the finish line is the flag. */
  private checkLine(car: RaceCar, sPrev: number, ev: RaceEvent[]): void {
    const c = this.course;
    if (!c.loop) {
      if (!crossedS(c, sPrev, car.s, this.finishS)) return;
      const along = Math.max(1e-6, car.s - sPrev);
      const at = this.raceT - DT * ((car.s - this.finishS) / along);
      car.lapTimes.push(at);
      ev.push({ type: 'lap', t: this.t, p: car.p, lap: 1, time: at, best: true });
      this.flag(car, at, ev);
      return;
    }
    if (crossedS(c, car.s, sPrev, c.startS)) {
      // Back over the line the wrong way: that lap has to be driven again.
      car.lap--;
      return;
    }
    if (!crossedS(c, sPrev, car.s, c.startS)) return;
    // The moment it crossed, inside this step.
    const along = Math.max(1e-6, deltaS(c, sPrev, car.s));
    const at = this.raceT - DT * (deltaS(c, c.startS, car.s) / along);
    car.lap++;
    if (car.lap === 1) {
      car.lapStart = at;
      return;
    }
    const time = at - car.lapStart;
    const best = car.lapTimes.length === 0 || time < Math.min(...car.lapTimes);
    car.lapTimes.push(time);
    car.lapStart = at;
    ev.push({ type: 'lap', t: this.t, p: car.p, lap: car.lapTimes.length, time, best });
    if (car.lapTimes.length < this.laps) return;
    this.flag(car, at, ev);
  }

  /** Home at race time `at`: the chequered flag (a car off a kicker flies on into the water). */
  private flag(car: RaceCar, at: number, ev: RaceEvent[]): void {
    if (car.phase === 'race') car.phase = 'finished';
    if (car.ipoT > 0) this.endIpo(car, ev);
    car.finishT = at;
    car.runTime = at;
    car.boosting = false;
    car.roulette = 0;
    this.flagged.push(car.p);
    ev.push({ type: 'finish', t: this.t, p: car.p, time: at, place: this.flagged.length });
  }

  /** Past the flag: ease along the middle of the road at a gentle speed, out of everyone's way (and,
   *  point to point, to a stop before the road runs out). */
  private cruise(car: RaceCar): CarInput {
    const c = this.course;
    const tgt = toWorld(c, car.s + 10, clamp(car.d, -2, 2) * 0.5);
    const ang = wrapAngle(Math.atan2(tgt.z - car.z, tgt.x - car.x) - car.heading);
    const v = Math.hypot(car.vx, car.vz);
    const room = c.loop ? Infinity : c.length - RUNOFF_STOP - car.s;
    const stopBy = Math.sqrt(2 * 3 * Math.max(0, room));
    const target = Math.min(CRUISE_SPEED, stopBy);
    // Running out of road: brake as hard as it takes to stop in time.
    const stopping = stopBy < v + 2;
    return {
      throttle: v < target - 1 ? 0.6 : 0,
      brake: stopping ? (v > target + 0.5 ? clamp((v - target) / 3, 0.35, 1) : room < 1 && v > 0.3 ? 1 : 0) : v > target + 2 ? 0.35 : 0,
      steer: clamp(ang * 2.2, -1, 1),
      item: false,
    };
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
    // In a seagull's grip: up in the air, nothing to drive on, swinging about.
    if (car.gullT > 0) {
      car.gullT -= dt;
      T = 0;
      B = 0;
      S = clamp(S + 0.5 * Math.sin(this.raceT * 7.1 + car.p * 2.3), -1, 1);
    }
    if (car.blindT > 0) car.blindT = Math.max(0, car.blindT - dt);
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
    // On open ground (a park) the ground's own slope, whichever way the car is going; on the
    // course's own path through it, the path's.
    const og = car.og >= 0 ? C.open![car.og] : null;
    let gx = 0;
    let gz = 0;
    let grade = car.grounded ? this.gradeAt(pt) : 0;
    if (og && car.grounded) {
      if (Math.abs(car.d) <= pt.pave) {
        gx = grade * pt.tx;
        gz = grade * pt.tz;
      } else {
        const sl = og.slope(car.x, car.z);
        gx = sl.gx;
        gz = sl.gz;
      }
      grade = Math.sqrt(gx * gx + gz * gz);
    }
    const cosT = 1 / Math.sqrt(1 + grade * grade);
    const speed2 = car.vx * car.vx + car.vz * car.vz;
    const N = car.grounded ? normalLoad(k, cosT, speed2) : 0;
    // What the tyres are on (a park's lawn beside its path is slower and slidier): its grip scales
    // everything the tyres do, its top speed the engine's. On open ground the park's other paths are
    // paved too.
    car.surface = car.grounded ? surfaceAt(pt, car.d) : 'paved';
    if (og && car.surface !== 'paved') car.surface = og.surfaceAt(car.x, car.z);
    const surf = SURFACES[car.surface];
    const sg = surf.grip;
    const mu = k.mu * sg;

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
      const wMax = maxYawRate(k, Math.abs(vf), cornerGrip(k, N) * sg);
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
    // (See windAlong: on a loop, behind you on one straight and in your face on the way back.)
    const topRoad = topSpeedIn(k, windAlong(this.wind, car.heading, C.loop));
    const top = Math.min(topRoad * surf.top, surf.cap);
    if (T > 0 && onPower && k.power > 0) {
      // Near its top speed the engine runs out of revs (or the jet out of thrust). A headwind loads
      // the engine and lowers the speed it can reach; a tailwind raises it.
      const rev = vf <= 0.6 * top ? 1 : Math.max(0, (top - vf) / (0.4 * top));
      const demand = ((T * k.power) / Math.max(Math.abs(vf), 1)) * rev;
      if (k.isJet) engineF = Math.min(demand, k.thrustCap * T);
      else {
        const grip = k.traction * N * sg * (car.drift !== 0 ? DRIFT_TRACTION : 1);
        spinning = demand > grip && car.drift === 0;
        engineF = Math.min(demand, grip);
      }
    }
    car.engineOn = T > 0 && k.power > 0;
    car.wheelspin = spinning;
    if (spinning) car.wheelspinTime += dt;

    // --- Boost: a rocket push along the nose while the key is held (on the road or in the air)
    // until the bottle runs dry. It fades out on the way past the engine's top speed on the road:
    // a rocket needs no grip, so on grass or long grass it ploughs through just as fast.
    let boostF = 0;
    car.boosting = false;
    if (inp.boost && car.boost > 0 && car.spin <= 0 && car.stun <= 0 && car.gullT <= 0) {
      const topB = topRoad * BOOST_TOP;
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

    // --- Gravity along the slope (on open ground, down the ground's own slope).
    const ga = car.grounded ? (-G * grade) / (1 + grade * grade) : 0;
    const gax = og ? (car.grounded ? (-G * gx) / (1 + grade * grade) : 0) : ga * pt.tx;
    const gaz = og ? (car.grounded ? (-G * gz) / (1 + grade * grade) : 0) : ga * pt.tz;

    const aDrive = (engineF + boostF - reverseF) / m;
    // Sliding, the push goes along the direction of travel (the wheel alone sets the drift's arc).
    let ux = fx;
    let uz = fz;
    if (car.drift !== 0 && speed2 > 1) {
      const v = Math.sqrt(speed2);
      ux = car.vx / v;
      uz = car.vz / v;
    }
    car.vx += (aDrive * ux + dragX / m + gax) * dt;
    car.vz += (aDrive * uz + dragZ / m + gaz) * dt;

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
        const turnAcc = driftGrip(k, N) * sg * bite;
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
        let latMax = cornerForce(k, N) * sg * (1 - 0.35 * used * used);
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

    if (car.grounded && surf.drag > 0 && !car.boosting) {
      // A slow surface: speed over what it allows bleeds away (a car coming onto the grass fast
      // is slowed to it in a second or two, not stopped dead). Boosting, it isn't.
      const v = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
      if (v > top && v > 1e-6) {
        const f = (top + (v - top) * Math.exp(-surf.drag * dt)) / v;
        car.vx *= f;
        car.vz *= f;
      }
    }
    // --- The crawl: up a steep hill on the gas, the lowest gear always pulls the car along at a
    // walk, however heavy or weak it is (see CRAWL_SPEED).
    if (car.grounded && T > 0 && car.drift === 0 && car.spin <= 0 && car.stun <= 0) {
      const up = og ? gx * fx + gz * fz : grade * (pt.tx * fx + pt.tz * fz);
      if (up > CRAWL_GRADE) {
        const vfw = car.vx * fx + car.vz * fz;
        const want = CRAWL_SPEED * T;
        if (vfw < want) {
          // Net of the pull of the slope, which has already had its say this step.
          const dv = Math.min(want - vfw, (CRAWL_ACC + (G * up) / (1 + grade * grade)) * dt);
          car.vx += fx * dv;
          car.vz += fz * dv;
        }
      }
    }

    // --- Move.
    car.x += car.vx * dt;
    car.z += car.vz * dt;
    // Walled-in blocks (Lombard's): retaining walls and stairs along their sides, houses at their
    // ends except where the road comes in and goes out. A hop across the gardens stays inside.
    for (const g of C.gardens) this.gardenWalls(g, car, dt, ev);
    const sPrev = car.s;

    // --- Where are we now?
    const loc = locate(C, car.x, car.z, car.s, car.grounded ? 6 : 10, this.loc);
    // On open ground (a park): which of its paths is the car by? The one it has been following,
    // unless another is clearly nearer (it has cut across the grass to it).
    const ogNow = C.open ? this.openGroundAt(car) : -1;
    if (ogNow >= 0) {
      const o = C.open![ogNow];
      const near = locate(C, car.x, car.z, o.nearestS(car.x, car.z), 3, this.loc2);
      if (Math.abs(near.d) + 2 < Math.abs(loc.d)) {
        loc.s = near.s;
        loc.d = near.d;
      }
    } else if (!car.grounded && Math.abs(loc.d) > pointAt(C, loc.s, this.tmp2).hw) {
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
    car.og = ogNow;
    car.s = loc.s;
    car.d = loc.d;
    // Over one of Lombard's flower beds (off the road, beyond a hedge): you can't sink into the
    // hydrangeas. Skid across the top of them towards the nearest road and drop onto it.
    let onBed = false;
    if (!car.grounded && ogNow < 0) {
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

    // Across open ground's grass from one path onto another further on: a shortcut (however it got
    // there, on the ground or in the air).
    if (ogNow >= 0) {
      car.hopS = -1;
      const pp = pointAt(C, car.s, this.tmp2);
      if (Math.abs(car.d) > pp.pave && C.open![ogNow].surfaceAt(car.x, car.z) !== 'paved') {
        if (car.cutS < 0) {
          car.cutS = sPrev;
          car.cutDist = 0;
        }
        car.cutDist += Math.sqrt(car.vx * car.vx + car.vz * car.vz) * dt;
      } else if (car.cutS >= 0) {
        const gained = deltaS(C, car.cutS, car.s) - car.cutDist;
        if (gained > 12) {
          car.tally.shortcuts++;
          this.addHype(car, 12, 'shortcut', ev);
          ev.push({ type: 'shortcut', t: this.t, p: car.p, s: car.s, gained });
        }
        car.cutS = -1;
      }
    } else if (car.cutS >= 0) car.cutS = -1;
    // Cutting across in the air (over Lombard's hedges, the inside of a hairpin, a corner): back
    // over the road further along than the flight alone explains is a shortcut.
    if (ogNow >= 0) {
      // (Open ground has its own, above.)
    } else if (!car.grounded && Math.abs(car.d) > pointAt(C, car.s, this.tmp2).hw + 0.2) {
      if (car.hopS < 0) {
        car.hopS = sPrev;
        car.hopDist = 0;
      }
      car.hopDist += Math.sqrt(car.vx * car.vx + car.vz * car.vz) * dt;
    } else if (car.hopS >= 0) {
      const gained = (C.loop ? deltaS(C, car.hopS, car.s) : car.s - car.hopS) - car.hopDist;
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
        if (crossedS(C, sPrev, car.s, b.s)) {
          const ke = 0.5 * m * (car.vx * car.vx + car.vz * car.vz);
          const f = Math.sqrt(1 - k.bumpLoss);
          car.vx *= f;
          car.vz *= f;
          car.bumpsHit++;
          ev.push({ type: 'bump', t: this.t, p: car.p, s: b.s, keLostJ: ke * k.bumpLoss });
        }
      }
    }

    // --- Vertical: follow the road (on open ground, the ground), leave it over a crest, land. On
    // the course's own path through a park, the path's profile exactly, as the road's: the park's
    // ground is smoothed, and a sharp crest (the top of Alamo Square's steps) must still throw a car.
    const p2 = pointAt(C, car.s, this.tmp2);
    const vAlong = car.vx * p2.tx + car.vz * p2.tz;
    let hRoad: number;
    let vyRoad: number;
    if (car.og >= 0 && Math.abs(car.d) > p2.pave) {
      const o = C.open![car.og];
      const sl = o.slope(car.x, car.z);
      hRoad = o.height(car.x, car.z);
      vyRoad = sl.gx * car.vx + sl.gz * car.vz;
    } else {
      hRoad = this.roadY(car.s);
      vyRoad = this.gradeAt(p2) * vAlong;
    }
    if (car.gullT > 0) {
      // Hauled up by a seagull: rising to its height, drifting on slowly, then dropped.
      car.grounded = false;
      car.vy = clamp((hRoad + GULL_LIFT - car.y) * 3, -2, 6);
      car.y += car.vy * dt;
      const hold = Math.exp(-1.5 * dt);
      car.vx *= hold;
      car.vz *= hold;
      car.airTime += dt;
    } else if (car.grounded) {
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
        if (car.airTime > 0.12) ev.push({ type: 'land', t: this.t, p: car.p, impact, air: car.carried ? 0 : car.airTime });
        if (car.grounded) {
          car.carried = false;
          car.airTime = 0;
          car.jumpShortcut = false;
        }
      }
    }

    if (car.og >= 0) this.openWalls(C.open![car.og], car, ev);
    else this.walls(car, ev);

    // Can't back out past the start line area (point to point: a loop has no back fence), nor run
    // off the far end of a course that doesn't end in a kicker.
    if (!C.loop && car.s < 0.6) {
      const w = toWorld(C, 0.6, car.d);
      car.x = w.x;
      car.z = w.z;
      car.s = 0.6;
      const vfw = car.vx * p2.tx + car.vz * p2.tz;
      if (vfw < 0) {
        car.vx -= vfw * p2.tx;
        car.vz -= vfw * p2.tz;
      }
    } else if (!C.loop && !C.lip && car.s > C.length - 0.6) {
      const w = toWorld(C, C.length - 0.6, car.d);
      car.x = w.x;
      car.z = w.z;
      car.s = C.length - 0.6;
      const vfw = car.vx * p2.tx + car.vz * p2.tz;
      if (vfw > 0) {
        car.vx -= vfw * p2.tx;
        car.vz -= vfw * p2.tz;
      }
    }

    // Book-keeping.
    const sp = Math.sqrt(car.vx * car.vx + car.vz * car.vz + car.vy * car.vy);
    if (sp > car.tally.topSpeed) car.tally.topSpeed = sp;
    const along = car.vx * p2.tx + car.vz * p2.tz;
    const facing = Math.cos(car.heading - p2.heading);
    // (Roaming open ground's grass, any way is fine.)
    const roaming = car.og >= 0 && car.surface !== 'paved';
    car.wrongWay = !roaming && facing < -0.3 && along < -1 ? car.wrongWay + dt : 0;
    car.backwardsT = !roaming && facing < -0.3 ? car.backwardsT + dt : 0;
    car.boostFrac = k.boostCap > 0 ? car.boost / k.boostCap : 0;
    if (car.grit > 0) car.grit = Math.max(0, car.grit - dt);
    if (car.overtakeCd > 0) car.overtakeCd -= dt;

    // Stuck (wedged against something facing the wrong way)? Put the car back on the road.
    car.stuckT += dt;
    const onRamp = C.lip !== null && car.phase === 'race' && car.s > C.lip.rampS0 - 12;
    // Only a car that's trying (on the gas) and getting nowhere: sitting still or reversing is fine.
    // (On open ground, getting anywhere at all: progress along the course doesn't say.)
    const moved =
      car.og >= 0 ? Math.hypot(car.x - car.stuckX, car.z - car.stuckZ) > 2.5 : C.loop ? deltaS(C, car.stuckS, car.s) > 2.5 : car.s > car.stuckS + 2.5;
    if (moved || T < 0.5) {
      car.stuckS = car.s;
      car.stuckX = car.x;
      car.stuckZ = car.z;
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
    const lip = this.course.lip!;
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
    for (const cb of this.cables) {
      const q = this.cableRel(cb, x, z);
      if (Math.abs(q.across) < cb.width / 2 + 0.7 + r * 0.5 && Math.abs(q.along) < cb.length / 2 + 0.7 + r) return false;
    }
    for (const p of this.peds) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r2) return false;
    return true;
  }

  /** Keep a car that was inside a walled-in block inside it (its side walls, and its end walls
   *  outside the gates). */
  private gardenWalls(g: Garden, car: RaceCar, dt: number, ev: RaceEvent[]): void {
    const prev = gardenFrame(g, car.x - car.vx * dt, car.z - car.vz * dt);
    if (!(prev.u > g.u0 && prev.u < g.u1 && Math.abs(prev.v) <= g.wall)) return;
    const c = Math.cos(g.heading);
    const sn = Math.sin(g.heading);
    let q = gardenFrame(g, car.x, car.z);
    if (Math.abs(q.v) > g.wall) {
      const side = Math.sign(q.v);
      const w = gardenWorld(g, q.u, side * g.wall);
      car.x = w.x;
      car.z = w.z;
      this.blockWall(car, -sn * side, c * side, ev);
      q = gardenFrame(g, car.x, car.z);
    }
    if ((q.u < g.u0 || q.u > g.u1) && Math.abs(q.v) > g.gate) {
      const side = q.u < g.u0 ? -1 : 1;
      const w = gardenWorld(g, side < 0 ? g.u0 : g.u1, q.v);
      car.x = w.x;
      car.z = w.z;
      this.blockWall(car, c * side, sn * side, ev);
    }
  }

  /** Bounce off one of the walls round a walled-in block (outward normal nx, nz). */
  private blockWall(car: RaceCar, nx: number, nz: number, ev: RaceEvent[]): void {
    const vn = car.vx * nx + car.vz * nz;
    if (vn <= 0) return;
    if (vn > 1.2) ev.push({ type: 'wall', t: this.t, p: car.p, impact: vn, x: car.x + nx, y: car.y + 0.5, z: car.z + nz });
    car.vx -= (1 + WALL_E) * vn * nx;
    car.vz -= (1 + WALL_E) * vn * nz;
    car.vx *= 0.85;
    car.vz *= 0.85;
  }

  /** Which open ground the car is in (-1: none). It leaves one only through a gate: a car pushed out
   *  of its edge anywhere else is still in it (and openWalls puts it back). */
  private openGroundAt(car: RaceCar): number {
    const open = this.course.open!;
    for (let i = 0; i < open.length; i++) if (open[i].contains(car.x, car.z)) return i;
    if (car.og < 0) return -1;
    for (const g of open[car.og].gates) if ((car.x - g.x) ** 2 + (car.z - g.z) ** 2 < g.r * g.r) return -1;
    return car.og;
  }

  /** On open ground: its edge (but for its gates), its trees and its solid blocks (and for a car
   *  that keeps to the road, the road's walls too). */
  private openWalls(o: OpenGround, car: RaceCar, ev: RaceEvent[]): void {
    if (car.keepToRoad) this.walls(car, ev);
    const r = 0.5 * car.stats.width + 0.1;
    // Out of the park anywhere but a gate: back in.
    if (!o.contains(car.x, car.z)) {
      const q = nearestOnOutline(o.outline, car.x, car.z);
      const d = Math.hypot(car.x - q.x, car.z - q.z) || 1;
      const nx = (car.x - q.x) / d;
      const nz = (car.z - q.z) / d;
      car.x = q.x - nx * 0.05;
      car.z = q.z - nz * 0.05;
      this.openHit(car, nx, nz, ev);
    }
    for (const t of o.posts) {
      const dx = t.x - car.x;
      const dz = t.z - car.z;
      const rr = t.r + r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-9) continue;
      const d = Math.sqrt(d2);
      car.x -= (dx / d) * (rr - d);
      car.z -= (dz / d) * (rr - d);
      this.openHit(car, dx / d, dz / d, ev);
    }
    for (const b of o.blocks) {
      const q = nearestOnOutline(b, car.x, car.z);
      const inside = inPoly(b, car.x, car.z);
      const dx = q.x - car.x;
      const dz = q.z - car.z;
      const d = Math.hypot(dx, dz);
      if (!inside && d >= r) continue;
      // Towards the block (from the car), and out to just clear of it.
      const nx = d > 1e-6 ? (inside ? -dx : dx) / d : 1;
      const nz = d > 1e-6 ? (inside ? -dz : dz) / d : 0;
      car.x = q.x - nx * r;
      car.z = q.z - nz * r;
      this.openHit(car, nx, nz, ev);
    }
  }

  /** Bouncing off something on open ground (a tree, a wall, the park's edge; nx, nz towards it): as
   *  off a road's wall, a hard hit knocks the wind out of the car. */
  private openHit(car: RaceCar, nx: number, nz: number, ev: RaceEvent[]): void {
    const vn = car.vx * nx + car.vz * nz;
    if (vn <= 0) return;
    this.blockWall(car, nx, nz, ev);
    if (vn > 3) this.endDrift(car, ev);
    if (vn > WALL_HARD) {
      car.stun = Math.max(car.stun, Math.min(0.6, (vn - WALL_HARD) * 0.05));
      car.tally.walls++;
      this.addHype(car, -3, 'wall', ev);
    }
  }

  /** Inside a walled-in block (on the road or in its gardens). */
  private inGarden(x: number, z: number): boolean {
    for (const g of this.course.gardens) {
      const q = gardenFrame(g, x, z);
      if (q.u >= g.u0 - 0.01 && q.u <= g.u1 + 0.01 && Math.abs(q.v) <= g.wall + 0.5) return true;
    }
    return false;
  }

  private rescue(car: RaceCar, ev: RaceEvent[]): void {
    const C = this.course;
    // Never past the foot of the kicker (a loop just carries on round).
    const sMax = C.lip ? C.lip.rampS0 - 2 : Infinity;
    let s = wrapS(C, Math.min(car.s + 3, sMax));
    let d = 0;
    // A clear spot a little further on (not on top of whatever it was stuck behind).
    search: for (const ds of [3, 6, 10, 15, 22]) {
      const ss = wrapS(C, Math.min(car.s + ds, sMax));
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
    car.ipoT = 0;
    car.ipoV = 0;
    car.carried = false;
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
    const racing = this.cars.filter((c) => c.phase === 'race' || c.phase === 'finished');
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
    // Separate by mass (a car riding an IPO coin doesn't budge: the other takes all of it).
    const ipoA = a.ipoT > 0;
    const ipoB = b.ipoT > 0;
    const shareA = ipoA && !ipoB ? 0 : ipoB && !ipoA ? 1 : mb / (ma + mb);
    a.x += h.nx * h.depth * shareA;
    a.z += h.nz * h.depth * shareA;
    b.x -= h.nx * h.depth * (1 - shareA);
    b.z -= h.nz * h.depth * (1 - shareA);
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
    if (ipoA !== ipoB) {
      // An IPO coin rams whatever it meets, whichever way round.
      rammer = ipoA ? a : b;
      victim = ipoA ? b : a;
    } else if (a.grit > 0 && b.grit > 0) {
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
      if (this.tough(rammer)) {
        // Determination (or an IPO coin): plough through, the other car takes the lot.
        ram = rammer.ipoT > 0 ? 'ipo' : 'grit';
        if (onA) {
          ja = 0;
          jb = j * 2.2;
        } else {
          jb = 0;
          ja = j * 2.2;
        }
        victim.stun = Math.max(victim.stun, 0.5);
        this.ploughed(rammer, ev);
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
    const clearance = car.y - (car.og >= 0 ? this.course.open![car.og].height(car.x, car.z) : this.roadY(car.s));
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
    for (const cb of this.cables) {
      if (clearance >= cb.height || car.ipoT > 0) continue;
      const h = contact(car.x, car.z, car.heading, cc, cb.x, cb.z, cb.heading, cb.circles);
      if (h) {
        this.noNearMiss(car, cb.id);
        this.hitHeavy(car, h, null, 60000, ev, cb);
      } else this.nearMiss(car, cb.id, 'cable', car.x, car.z, cc, cb.x, cb.z, cb.heading, cb.near, speed, ev);
    }
    for (const p of this.peds) {
      if (p.down > 0 || p.dive > 0) continue;
      const dx = p.x - car.x;
      const dz = p.z - car.z;
      if (dx * dx + dz * dz > reach * reach) continue;
      if (clearance > 1.5) continue;
      if (p.kind === 'dog') {
        // Too quick to hit: a dog in the way leaps clear (off to the side the car isn't going).
        if (!contact(car.x, car.z, car.heading, cc, p.x, p.z, 0, [[0, PED_R + 0.6]])) continue;
        const side = Math.sign(-dx * Math.sin(car.heading) + dz * Math.cos(car.heading)) || 1;
        p.dive = 0.9;
        p.fallX = -Math.sin(car.heading) * side;
        p.fallZ = Math.cos(car.heading) * side;
        ev.push({ type: 'bark', t: this.t, id: p.id, x: p.x, z: p.z, chasing: false });
        continue;
      }
      const h = contact(car.x, car.z, car.heading, cc, p.x, p.z, 0, [[0, PED_R]]);
      if (!h) {
        this.nearMiss(car, p.id, 'ped', car.x, car.z, cc, p.x, p.z, 0, PED_NEAR, speed, ev);
        continue;
      }
      this.noNearMiss(car, p.id);
      if (this.tough(car)) {
        p.dive = 1.4;
        p.fallX = -h.nz * (Math.sign(h.nx * car.vz - h.nz * car.vx) || 1);
        p.fallZ = h.nx * (Math.sign(h.nx * car.vz - h.nz * car.vx) || 1);
        this.ploughed(car, ev);
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
      if (this.tough(car)) {
        this.ploughed(car, ev);
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

  /** Bounce off something heavy (a Waymo or a cable car). */
  private hitHeavy(car: RaceCar, h: Contact, w: Waymo | null, mass: number, ev: RaceEvent[], cb: CableCar | null = null): void {
    const m = car.stats.mass;
    const I = (m * (car.stats.length ** 2 + car.stats.width ** 2)) / 12;
    car.x += h.nx * h.depth;
    car.z += h.nz * h.depth;
    const rax = h.cx - car.x;
    const raz = h.cz - car.z;
    const cbv = cb ? cb.dir * cb.v : 0;
    const wvx = w ? this.waymoVel(w).x : cb ? cb.ux * cbv : 0;
    const wvz = w ? this.waymoVel(w).z : cb ? cb.uz * cbv : 0;
    const rvx = car.vx - car.yawRate * raz - wvx;
    const rvz = car.vz + car.yawRate * rax - wvz;
    const vn = rvx * h.nx + rvz * h.nz;
    if (vn >= 0) return;
    const what: Obstacle = w ? 'waymo' : 'cable';
    const id = w ? w.id : cb ? cb.id : -1;
    if (w && this.tough(car)) {
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
      this.ploughed(car, ev);
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

  /** Ploughing through things: Determination (spent on the first thing it hits), or an IPO coin. */
  private tough(car: RaceCar): boolean {
    return car.grit > 0 || car.ipoT > 0;
  }

  /** Through something: Determination is spent on it (and pays HYPE); an IPO coin just carries on. */
  private ploughed(car: RaceCar, ev: RaceEvent[]): void {
    if (car.ipoT > 0) return;
    car.grit = 0;
    car.tally.plowed++;
    this.addHype(car, 6, 'powered through', ev);
  }

  /** Spun round and slowed: by poo (which splatters the windscreen too) or a crab's nip. */
  private spinOut(car: RaceCar, by: PlayerIndex | null, ev: RaceEvent[], cause: 'poo' | 'crab' = 'poo'): void {
    this.endDrift(car, ev);
    const resist = car.stats.spinResist;
    car.spin = SPIN_TIME * (1 - 0.4 * resist);
    car.spinDur = car.spin;
    car.spinHeading0 = car.heading;
    car.spinDir = car.yawRate >= 0 ? 1 : -1;
    const f = 0.5 + 0.25 * resist;
    car.vx *= f;
    car.vz *= f;
    if (cause === 'poo') {
      car.tally.poo++;
      car.blindT = POO_BLIND;
    } else car.tally.crabbed++;
    this.addHype(car, -10, 'spun out', ev);
    if (by !== null) {
      const o = this.cars[by];
      if (o) {
        if (cause === 'poo') o.tally.pooLanded++;
        else o.tally.crabs++;
        this.addHype(o, 8, cause === 'poo' ? 'poo landed' : 'crab landed', ev);
      }
    }
    ev.push({ type: 'spinout', t: this.t, p: car.p, by, cause });
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
   * Item odds lean on the race order: the leader gets defence (poo, and crabs to throw back), a
   * close chaser gets crabs to throw ahead, and a car further back gets comebacks (Determination,
   * boost and seagulls; the full boost is rare, and rarer still in front), and well back the IPO
   * coin. With nobody else on the road there's no one to drop poo for or throw anything at, and no
   * one to catch up.
   */
  private rollItem(car: RaceCar): ItemKind {
    const others = this.cars.filter((c) => c !== car && c.phase === 'race');
    // Weights in ITEM_KINDS order: jump, grit, poo, topup, refill, gull, crab, ipo.
    let w: number[];
    if (!others.length) w = [0.34, 0.2, 0, 0.36, 0.1, 0, 0, 0];
    else {
      const gap = Math.max(...others.map((o) => o.prog)) - car.prog;
      if (gap <= 0) w = [0.26, 0.08, 0.36, 0.18, 0.01, 0.03, 0.14, 0];
      else if (gap < 30) w = [0.22, 0.18, 0.2, 0.22, 0.04, 0.14, 0.18, 0];
      else if (gap < 90) w = [0.16, 0.24, 0.06, 0.26, 0.1, 0.18, 0.08, 0.06];
      else w = [0.12, 0.2, 0.04, 0.22, 0.1, 0.16, 0.04, 0.2];
      // Too near the kicker to ride a coin (it would have to let go almost at once).
      const lip = this.course.lip;
      if (lip && car.s > lip.rampS0 - IPO_LIP - 60) w[7] = 0;
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
      const lip = this.course.lip;
      const onKicker = lip !== null && car.s > lip.rampS0 - 1;
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
    } else if (it === 'crab') {
      this.throwCrab(car, inp.back ?? inp.brake > 0.5);
    } else if (it === 'ipo') {
      // On the road, and not on the run-up to the kicker (it would let go on the ramp): kept for later.
      const lip = this.course.lip;
      if (!car.grounded || (lip !== null && car.s > lip.rampS0 - IPO_LIP - 15)) return;
      this.startIpo(car, ev);
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

  /** Let a seagull go after the leading rival (with nobody left racing, it just flies off). It's
   *  let loose not far behind them, so it's on them in a couple of seconds wherever the thrower is. */
  private releaseGull(car: RaceCar): void {
    const C = this.course;
    const target = this.order()
      .map((p) => this.cars[p])
      .find((c) => c !== car && c.phase === 'race');
    let s = car.s;
    let d = clamp(car.d, -4, 4);
    let y = car.y + 2.2;
    let heading = car.heading;
    if (target) {
      const gap = deltaS(C, car.s, target.s);
      if (Math.abs(gap) > GULL_SPAWN) {
        s = wrapS(C, target.s - Math.sign(gap) * GULL_SPAWN);
        d = clamp(target.d, -4, 4);
        y = this.roadY(s) + 3.4;
        heading = pointAt(C, s, this.tmp).heading + (gap < 0 ? Math.PI : 0);
      }
    }
    const w = toWorld(C, s, d);
    this.gulls.push({
      id: this.nextId++,
      owner: car.p,
      target: target ? target.p : car.p,
      x: w.x,
      y,
      z: w.z,
      heading,
      s,
      d,
      age: 0,
      state: target ? 'hunt' : 'leave',
      stateT: 0,
    });
  }

  /**
   * A seagull hunts its target along the course, above the road (so it never cuts through the
   * houses), always a good deal faster than the car it's after; close in, it dives at the
   * roof. Then it hauls the car up, lets go and flies off.
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
      const gap = deltaS(C, g.s, tc.s);
      const tv = Math.hypot(tc.vx, tc.vz);
      if (Math.abs(gap) > 7) {
        // Closing in to 5 m, well inside the 7 m where it dives: the car pulls ahead a little every
        // step, and stopping right at the line left it chasing forever at speed.
        const speed = Math.max(GULL_SPEED, tv + 18);
        g.s = wrapS(C, g.s + Math.sign(gap) * Math.min(Math.abs(gap) - 5, speed * dt));
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
        g.s = wrapS(C, tc.s - Math.sign(gap || 1) * Math.max(0, dist - step));
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
      if (tc.gullT <= 0 || tc.phase !== 'race') {
        tc.gullT = 0;
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
    if (this.tough(tc)) {
      // Determination (or an IPO coin): shoo! It bounces off and flies away.
      if (tc.ipoT <= 0) {
        tc.grit = 0;
        tc.tally.shooed++;
        this.addHype(tc, 6, 'shooed a seagull', ev);
      }
      g.state = 'leave';
      g.heading = tc.heading + (this.rng() < 0.5 ? -1 : 1) * 1.3;
      ev.push({ type: 'gull', t: this.t, p: tc.p, by: g.owner, shooed: true, x: g.x, y: g.y, z: g.z });
      return;
    }
    g.state = 'perch';
    tc.gullT = GULL_TIME;
    tc.grounded = false;
    tc.carried = true;
    tc.airTime = 0;
    tc.yawRate = clamp(tc.yawRate, -AIR_YAW, AIR_YAW);
    tc.vx *= 0.7;
    tc.vz *= 0.7;
    this.endDrift(tc, ev);
    const o = this.cars[g.owner];
    if (o && o !== tc) {
      o.tally.gulls++;
      this.addHype(o, 6, 'seagull', ev);
    }
    this.addHype(tc, -4, 'seagull', ev);
    ev.push({ type: 'gull', t: this.t, p: tc.p, by: g.owner, shooed: false, x: g.x, y: g.y, z: g.z });
  }

  /** Throw a crab: off the nose down the road (about where the car points), or off the tail back up
   *  it. */
  private throwCrab(car: RaceCar, back: boolean): void {
    const C = this.course;
    const pt = pointAt(C, car.s, this.tmp);
    let aim: number;
    let speed: number;
    if (back) {
      aim = Math.PI;
      speed = CRAB_SPEED * 0.75;
    } else {
      // (Facing back up the road, forwards is back up it.)
      const rel = wrapAngle(car.heading - pt.heading);
      aim = Math.abs(rel) > Math.PI / 2 ? Math.PI + clamp(wrapAngle(rel - Math.PI), -CRAB_AIM, CRAB_AIM) : clamp(rel, -CRAB_AIM, CRAB_AIM);
      speed = Math.max(CRAB_SPEED, Math.abs(car.vx * pt.tx + car.vz * pt.tz) + CRAB_LEAD);
    }
    const off = (car.stats.length / 2 + CRAB_R + 0.4) * (back ? -1 : 1);
    const loc = locate(C, car.x + Math.cos(car.heading) * off, car.z + Math.sin(car.heading) * off, car.s, 6);
    const hw = pointAt(C, loc.s, this.tmp).hw;
    const d = clamp(loc.d, -hw + CRAB_R, hw - CRAB_R);
    const w = toWorld(C, loc.s, d);
    const vs = speed * Math.cos(aim);
    const vd = speed * Math.sin(aim);
    this.crabs.push({
      id: this.nextId++,
      owner: car.p,
      s: loc.s,
      d,
      x: w.x,
      y: this.roadY(loc.s),
      z: w.z,
      vs,
      vd,
      heading: w.heading + Math.atan2(vd, vs),
      age: 0,
      gone: null,
    });
  }

  /** A crab scuttles on along the road, off the kerbs, until it meets a car, traffic or a tram. */
  private updateCrab(c: Crab, dt: number, ev: RaceEvent[]): void {
    const C = this.course;
    if (c.gone !== null) {
      c.gone += dt;
      return;
    }
    c.age += dt;
    if (c.age > CRAB_LIFE) return this.crabGone(c, 'burrow', ev);
    const s = c.s + c.vs * dt;
    // Off either end of a point-to-point course (off the lip into the bay, say): gone.
    if (!C.loop && (s < 0.6 || s > (C.lip ? C.lip.s : C.length - 0.6))) return this.crabGone(c, 'burrow', ev);
    c.s = wrapS(C, s);
    const pt = pointAt(C, c.s, this.tmp);
    const lim = Math.max(0, pt.hw - CRAB_R);
    c.d += c.vd * dt;
    if (Math.abs(c.d) > lim) {
      // Off the kerb and back across.
      c.d = Math.sign(c.d) * lim;
      c.vd = -c.vd;
    }
    const w = toWorld(C, c.s, c.d);
    c.x = w.x;
    c.z = w.z;
    c.y = this.roadY(c.s);
    c.heading = pt.heading + Math.atan2(c.vd, c.vs);
    const body: [number, number][] = [[0, CRAB_R]];
    for (const wm of this.waymos) {
      if ((wm.x - c.x) ** 2 + (wm.z - c.z) ** 2 > 64) continue;
      if (contact(c.x, c.z, 0, body, wm.x, wm.z, wm.heading, WAYMO_CIRCLES)) return this.crabGone(c, 'bonk', ev);
    }
    for (const cb of this.cables) {
      if (contact(c.x, c.z, 0, body, cb.x, cb.z, cb.heading, cb.circles)) return this.crabGone(c, 'bonk', ev);
    }
    for (const car of this.cars) {
      if (car.phase !== 'race' || (car.p === c.owner && c.age < CRAB_GRACE)) continue;
      // Over it in the air.
      if (car.y - c.y > 0.9 || (car.x - c.x) ** 2 + (car.z - c.z) ** 2 > (car.stats.length + 2) ** 2) continue;
      if (!contact(car.x, car.z, car.heading, car.circles, c.x, c.z, 0, body)) continue;
      this.crabHit(c, car, ev);
      return;
    }
  }

  /** A crab gets a car: it spins out, unless it's ploughing through things anyway. */
  private crabHit(c: Crab, car: RaceCar, ev: RaceEvent[]): void {
    const shielded = this.tough(car);
    if (shielded) this.ploughed(car, ev);
    else this.spinOut(car, c.owner !== car.p ? c.owner : null, ev, 'crab');
    ev.push({ type: 'crab', t: this.t, p: car.p, by: c.owner, shielded, x: c.x, y: c.y + 0.4, z: c.z });
    c.gone = 0;
  }

  private crabGone(c: Crab, why: 'bonk' | 'burrow' | 'crab', ev: RaceEvent[]): void {
    c.gone = 0;
    ev.push({ type: 'crabGone', t: this.t, id: c.id, why, x: c.x, y: c.y + 0.4, z: c.z });
  }

  /** Onto an IPO coin: whatever the car was up to (spinning, stunned, drifting) is over. */
  private startIpo(car: RaceCar, ev: RaceEvent[]): void {
    const pt = pointAt(this.course, car.s, this.tmp);
    car.ipoT = IPO_TIME;
    car.ipoV = Math.max(0, car.vx * pt.tx + car.vz * pt.tz);
    car.spin = 0;
    car.stun = 0;
    this.endDrift(car, ev);
    car.tally.ipo++;
  }

  /**
   * Riding an IPO coin: on rails down the middle of the road, speeding up to IPO_SPEED, round a tram
   * in the way and straight through everything else. It lets go when the time's up, or short of
   * the kicker.
   */
  private ipoRide(car: RaceCar, dt: number, ev: RaceEvent[]): void {
    const C = this.course;
    const k = car.stats;
    car.ipoV += (IPO_SPEED - car.ipoV) * (1 - Math.exp(-2.5 * dt));
    const s = C.loop ? wrapS(C, car.s + car.ipoV * dt) : Math.min(car.s + car.ipoV * dt, C.length - 0.6);
    const pt = pointAt(C, s, this.tmp);
    const lim = Math.max(0, pt.hw - k.width / 2 - 0.3);
    let want = 0;
    for (const cb of this.cables) {
      const loc = locate(C, cb.x, cb.z, s, 40, this.loc2);
      const ahead = deltaS(C, s, loc.s);
      if (ahead < -cb.length / 2 - 3 || ahead > cb.length / 2 + 30) continue;
      const clear = cb.width / 2 + k.width / 2 + 0.6;
      if (Math.abs(loc.d - want) < clear) want = loc.d + (loc.d > 0 ? -clear : clear);
    }
    want = clamp(want, -lim, lim);
    const d = clamp(car.d + clamp(want - car.d, -5 * dt, 5 * dt), -lim, lim);
    const w = toWorld(C, s, d);
    const fx = Math.cos(pt.heading);
    const fz = Math.sin(pt.heading);
    car.x = w.x;
    car.z = w.z;
    car.y = this.roadY(s);
    car.s = s;
    car.d = d;
    car.heading = pt.heading;
    car.vx = fx * car.ipoV;
    car.vz = fz * car.ipoV;
    car.vy = this.gradeAt(pt) * car.ipoV;
    car.yawRate = 0;
    car.grounded = true;
    car.airTime = 0;
    car.carried = false;
    car.surface = 'paved';
    car.sliding = false;
    car.slip = 0;
    car.boosting = false;
    car.engineOn = true;
    car.wheelspin = false;
    car.throttle = 1;
    car.brake = 0;
    car.hopS = -1;
    car.hopLand = false;
    car.cutS = -1;
    car.stuckS = s;
    car.stuckX = car.x;
    car.stuckZ = car.z;
    car.stuckT = 0;
    car.wrongWay = 0;
    car.backwardsT = 0;
    if (car.blindT > 0) car.blindT = Math.max(0, car.blindT - dt);
    if (car.grit > 0) car.grit = Math.max(0, car.grit - dt);
    car.ipoT -= dt;
    const lip = C.lip;
    if (car.ipoT <= 0 || (lip !== null && s >= lip.rampS0 - IPO_LIP)) this.endIpo(car, ev);
  }

  /** Off the coin: back to the car's own driving, at no more than its own top speed. */
  private endIpo(car: RaceCar, ev: RaceEvent[]): void {
    const top = topSpeedIn(car.stats, windAlong(this.wind, car.heading, this.course.loop));
    const v = Math.hypot(car.vx, car.vz);
    if (v > top && v > 1e-6) {
      car.vx *= top / v;
      car.vz *= top / v;
      car.vy *= top / v;
    }
    car.ipoT = 0;
    car.ipoV = 0;
    ev.push({ type: 'ipoEnd', t: this.t, p: car.p });
  }

  // ---------------------------------------------------------------------------------------------
  // Launch and flight

  private checkLip(car: RaceCar, ev: RaceEvent[]): void {
    const lip = this.course.lip!;
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
    const boost = this.opts.hype && this.rules.hype ? 1 + (HYPE_BOOST * car.hype) / HYPE_MAX : 1;
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
    // A race to the lip: the lip is the finish line (the whole run is its one lap).
    if (this.rules.score === 'time') {
      car.lapTimes.push(car.runTime);
      this.flag(car, car.runTime, ev);
    }
    // The first car off the kicker had it at full angle; from now on it drops for the rest.
    if (this.rules.kickerDrops && this.rampDropAt === null && this.cars.some((c) => c.phase === 'race')) {
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
    // Distance is measured from the lip along the way the kicker points.
    const lip = this.course.lip!;
    const water = lip.waterY;
    if (car.y <= water) {
      const f = (py - water) / (py - car.y);
      const x = px + (car.x - px) * f;
      const z = pz + (car.z - pz) * f;
      car.flightTime -= dt * (1 - f);
      car.x = x;
      car.z = z;
      car.y = water;
      car.distance = Math.max(0, (x - lip.x) * lip.tx + (z - lip.z) * lip.tz);
      car.phase = 'splashed';
      car.splashT = this.raceT;
      car.entryDeg = (Math.atan2(-car.vy, Math.sqrt(car.vx * car.vx + car.vz * car.vz)) * 180) / Math.PI;
      const speed = Math.sqrt(car.vx * car.vx + car.vy * car.vy + car.vz * car.vz);
      ev.push({ type: 'splash', t: this.t, p: car.p, distance: car.distance, x, z, speed });
      return;
    }
    car.distance = Math.max(0, (car.x - lip.x) * lip.tx + (car.z - lip.z) * lip.tz);
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
      if (!car.grounded && !car.carried && car.airTime > 0.15) {
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
    // First onto the run-up (the pier): when HYPE pays at the lip, the race to the kicker is worth
    // something.
    const lip = this.course.lip;
    if (lip && this.rules.hype && this.runupFirst === null && this.cars.length === 2) {
      const first = racing.find((c) => c.s >= lip.runupS0);
      if (first) {
        this.runupFirst = first.p;
        this.addHype(first, 10, `first to ${lip.runupName}`, ev);
        ev.push({ type: 'runupFirst', t: this.t, p: first.p });
      }
    }
    // Overtakes and the lead.
    if (racing.length === 2) {
      const [a, b] = racing;
      const lead = a.prog > b.prog ? a : b;
      const prev = this.leader;
      if (Math.abs(a.prog - b.prog) > 1.5 && lead.p !== prev) {
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
    for (const c of this.crabs) this.updateCrab(c, dt, ev);
    // Two crabs that meet get into a fight and neither goes any further.
    for (let i = 0; i < this.crabs.length; i++) {
      const a = this.crabs[i];
      for (let j = i + 1; j < this.crabs.length && a.gone === null; j++) {
        const b = this.crabs[j];
        if (b.gone !== null || (a.x - b.x) ** 2 + (a.z - b.z) ** 2 > (2 * CRAB_R) ** 2) continue;
        this.crabGone(a, 'crab', ev);
        this.crabGone(b, 'crab', ev);
      }
    }
    for (let i = this.crabs.length - 1; i >= 0; i--) {
      const g = this.crabs[i].gone;
      if (g !== null && g > 0.6) this.crabs.splice(i, 1);
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
        w.s = wrapS(C, w.s + w.v * dt);
        if (w.s >= w.sEnd) {
          // Pull over and park at the kerb with the hazards on (gliding over, not jumping), clear of
          // anyone already parked there.
          w.s = w.sEnd;
          w.parked = true;
          w.hazard = true;
          const hw = pointAt(C, w.s, this.tmp).hw;
          let side = Math.sign(w.d || 1);
          for (const o of this.waymos) {
            if (o !== w && (o.parked || o.kind === 'stalled') && Math.abs(deltaS(C, w.s, o.s)) < 6 && Math.sign(o.parkD || o.d) === side) {
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
        if (w.s > CROSS_REACH) w.s -= 2 * CROSS_REACH;
        w.x = w.laneX + w.lux * w.s + w.px;
        w.z = w.laneZ + w.luz * w.s + w.pz;
        w.heading = w.baseHeading + w.spinA;
      }
    }

    for (const cb of this.cables) {
      if (cb.dwell > 0) {
        cb.dwell -= dt;
        cb.v = 0;
      } else {
        // Stop for anything on the rails just ahead.
        const blocked = this.cars.some((c) => {
          if (c.phase !== 'race') return false;
          const q = this.cableRel(cb, c.x, c.z);
          return Math.abs(q.across) < cb.width / 2 + 0.9 && cb.dir * q.along > cb.length / 2 - 1.3 && cb.dir * q.along < cb.length / 2 + 3.2;
        });
        const target = blocked ? 0 : cb.cruise;
        cb.v += clamp(target - cb.v, -5 * dt, 1.2 * dt);
        cb.along += cb.dir * cb.v * dt;
        if ((cb.dir > 0 && cb.along >= cb.a1) || (cb.dir < 0 && cb.along <= cb.a0)) {
          // End of the line: wait, ring the bell, head back.
          cb.along = cb.dir > 0 ? cb.a1 : cb.a0;
          cb.dir = cb.dir > 0 ? -1 : 1;
          cb.dwell = TRAM_DIMS[cb.vehicle].dwell;
          cb.bell = 0.4;
        }
      }
      this.placeCable(cb);
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
          const ps = p.s + (p.fallX * pt.tx + p.fallZ * pt.tz) * 4 * dt;
          p.s = C.loop ? wrapS(C, ps) : clamp(ps, 0.5, C.length - 0.5);
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
      if (p.kind === 'dog') {
        this.updateDog(p, dt, ev);
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

  /**
   * A dog's moment: sniffing about its patch and trotting somewhere else on it (now and then a
   * woof), or, for a chaser that a racer has just come past, running flat out alongside the car's
   * back wheels, barking, until the car has got away or reached the edge of the patch.
   */
  private updateDog(p: Ped, dt: number, ev: RaceEvent[]): void {
    const C = this.course;
    p.chaseCool = Math.max(0, p.chaseCool - dt);
    let tS = p.toS;
    let tD = p.toD;
    let top = 2.4;
    if (p.chase > 0) {
      const car = p.chaseP >= 0 ? this.cars[p.chaseP] : undefined;
      const ahead = car ? deltaS(C, p.s, car.s) : Infinity;
      // (It noticed the car up to 14 m off: it gives up only once the car's got further than that.)
      if (!car || car.phase !== 'race' || ahead > 16 || ahead < -16) {
        p.chase = 0;
        p.chaseCool = 5;
      } else {
        p.chase -= dt;
        if (p.chase <= 0) p.chaseCool = 5;
        const side = Math.sign(p.d - car.d) || 1;
        tS = car.s - 1.5;
        tD = car.d + side * 2.8;
        top = 10.5;
        p.bark -= dt;
        if (p.bark <= 0) {
          p.bark = 0.35 + this.rng() * 0.4;
          ev.push({ type: 'bark', t: this.t, id: p.id, x: p.x, z: p.z, chasing: true });
        }
      }
    } else if (p.chaser && p.chaseCool <= 0) {
      for (const car of this.cars) {
        if (car.phase !== 'race') continue;
        const ds = deltaS(C, p.s, car.s);
        if (ds > -14 && ds < 6 && Math.abs(car.d - p.d) < 14) {
          p.chase = 2.8 + this.rng() * 1.6;
          p.chaseP = car.p;
          p.bark = 0;
          p.wait = 0;
          break;
        }
      }
    }
    if (p.chase <= 0) {
      if (p.wait > 0) {
        p.wait -= dt;
        top = 0;
      } else if (Math.abs(deltaS(C, p.s, p.toS)) < 0.6 && Math.abs(p.d - p.toD) < 0.6) {
        // Found something to sniff: stay a moment, then off somewhere else on the patch.
        p.wait = 1 + this.rng() * 4;
        p.toS = p.sMin + this.rng() * (p.sMax - p.sMin);
        p.toD = p.d0 + this.rng() * (p.d1 - p.d0);
        if (this.rng() < 0.2) ev.push({ type: 'bark', t: this.t, id: p.id, x: p.x, z: p.z, chasing: false });
      }
      tS = p.toS;
      tD = p.toD;
    }
    tS = clamp(tS, p.sMin, p.sMax);
    tD = clamp(tD, p.d0, p.d1);
    const ds = deltaS(C, p.s, tS);
    const dd = tD - p.d;
    const dist = Math.hypot(ds, dd);
    const step = Math.min(dist, top * dt);
    const pt = pointAt(C, p.s, this.tmp2);
    if (dist > 1e-6 && step > 1e-6) {
      p.s = wrapS(C, p.s + (ds / dist) * step);
      p.d += (dd / dist) * step;
      // Facing the way it's going: along the road and across it.
      p.heading = Math.atan2(pt.tz * ds + pt.tx * dd, pt.tx * ds - pt.tz * dd);
    }
    p.pace = step / dt;
    p.walk += dt * (1 + p.pace * 0.9);
    const w = toWorld(C, p.s, p.d);
    p.x = w.x;
    p.z = w.z;
    p.y = w.y;
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
    for (const c of this.cars) if ((c.phase === 'race' || c.phase === 'finished') && check(c.x, c.z, c.stats.width / 2)) return true;
    if (w.kind === 'cross') {
      // Lidar sees racers coming down the course: stop short of the crossing and let them through.
      // Distance from its nose to the kerb, less what it needs to stop: once it can't stop short of
      // the road it's committed and carries on across.
      const before = -((w.x - w.laneX) * w.lux + (w.z - w.laneZ) * w.luz);
      const room = before - WAYMO_LEN / 2 - (w.v * w.v) / 14 - w.crossHw;
      const approaching = room > 0 && before < 26;
      if (approaching) {
        for (const c of this.cars) {
          if (c.phase !== 'race') continue;
          // How far the car is from the lane (along the course), and off to the side of it.
          const toLane = (w.laneX - c.x) * w.ctx + (w.laneZ - c.z) * w.ctz;
          const side = (c.x - w.laneX) * w.lux + (c.z - w.laneZ) * w.luz;
          const vAlong = c.vx * w.ctx + c.vz * w.ctz;
          if (toLane > -3 && toLane < 34 && Math.abs(side) < 9 && (toLane < 6 || vAlong > 1)) return true;
        }
      }
    }
    for (const o of this.waymos) if (o !== w && check(o.x, o.z, WAYMO_W / 2)) return true;
    return false;
  }

  // ---------------------------------------------------------------------------------------------

  private endRules(ev: RaceEvent[]): void {
    for (const car of this.cars) {
      if ((car.phase === 'splashed' || car.phase === 'finished' || car.phase === 'dnf') && this.firstDoneAt === null) this.firstDoneAt = this.raceT;
    }
    for (const car of this.cars) {
      if (car.phase !== 'race') continue;
      const straggler = this.firstDoneAt !== null && this.raceT - this.firstDoneAt > STRAGGLER_TIME;
      if (straggler || this.raceT > this.maxTime) {
        car.phase = 'dnf';
        car.vx = car.vz = car.vy = 0;
        car.engineOn = false;
        car.roulette = 0;
        car.distance = 0;
        car.runTime = this.raceT;
        ev.push({ type: 'dnf', t: this.t, p: car.p, s: car.s, reason: straggler ? 'straggler' : 'timeout' });
      }
    }
  }

  /** Seconds the straggler has left to reach the lip or the flag (null if no clock is running). */
  stragglerLeft(): number | null {
    if (this.firstDoneAt === null) return null;
    return Math.max(0, STRAGGLER_TIME - (this.raceT - this.firstDoneAt));
  }

  /** Distance from this car to the leader on the road (0 if leading). */
  gapToLeader(p: PlayerIndex): number {
    const me = this.cars[p];
    let best = me.prog;
    for (const c of this.cars) if (c.phase === 'race' && c.prog > best) best = c.prog;
    return best - me.prog;
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
    car.ipoT = 0;
    car.ipoV = 0;
    car.stuckS = s;
    car.stuckT = 0;
    car.wrongWay = 0;
    car.backwardsT = 0;
    car.hopS = -1;
    car.hopLand = false;
    car.prog = this.progressOf(car);
  }

  /**
   * Start a car further down the course (solo training): at rest in the middle of the road, with the
   * start clear. Traffic sitting on it moves on down the road, and a cable car whose rails run along
   * that stretch (Hyde St's) waits at the far end of its line for a while: something to steer round,
   * never in the way at GO.
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
    const car = this.cars[p];
    for (const cb of this.cables) {
      if (!cb.span || s <= cb.span[0] - 5 || s >= cb.span[1]) continue;
      const a = (car.x - cb.ox) * cb.ux + (car.z - cb.oz) * cb.uz;
      cb.along = Math.abs(cb.a1 - a) > Math.abs(cb.a0 - a) ? cb.a1 : cb.a0;
      cb.dir = cb.along === cb.a1 ? -1 : 1;
      this.placeCable(cb);
      cb.dwell = 12;
    }
  }

  /** Index into the course samples for a car (for renderers). */
  sampleIndex(p: PlayerIndex): number {
    return indexAt(this.course, this.cars[p].s);
  }
}

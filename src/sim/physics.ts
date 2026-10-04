// Shared physics: constants, a seeded RNG, the road-handling model and the flight model from the
// lip to the splash. No Three.js or DOM imports: the race sim (every map, every mode), the CPU and
// the balance scripts share it exactly. The sim drives with these formulas and the CPU plans with
// the same ones, so a change here reaches every map, every mode and the CPU's judgement at once.
import type { Surface } from '../track';
import type { CarStats } from '../types';

export const RHO = 1.225;
export const G = 9.81;
export const DT = 1 / 120;
export const MAX_FLIGHT_TIME = 30;

// ---------------------------------------------------------------------------------------------
// Road handling

/** Arcade tyres: cornering grip is this multiple of the tyres' friction (braking and traction are not). */
export const CORNER_GRIP = 1.6;
/** Full lock turns the nose this much faster than the tyres can follow: a touch of oversteer. */
export const OVERSTEER = 1.15;
/** The fastest the nose can swing round (rad/s). */
export const MAX_YAW = 3.3;
/** Sideways grip while sliding with the wheel turned into it (× the tyres' friction): tighter than
 *  plain cornering (CORNER_GRIP), which is what makes a drift the fast way round. */
export const DRIFT_GRIP = 2.4;
/** How much the wind shifts an engine's top speed (m/s per m/s of tailwind along the car). */
export const WIND_TOP = 0.3;

/** The steepest climb a course may have (every map is checked against it: see courseProblems). */
export const MAX_CLIMB = 0.25;
/**
 * The crawl: on a climb steeper than CRAWL_GRADE, a car on the gas (not sliding, spun or stunned)
 * never drops below CRAWL_SPEED (m/s): its lowest gear pulls anything up any hill a course is
 * allowed to have, however heavy or weak it is. It picks up at CRAWL_ACC (m/s²).
 */
export const CRAWL_SPEED = 4;
export const CRAWL_GRADE = 0.12;
export const CRAWL_ACC = 2.5;

/** What driving on a surface does: grip (× the tyres' friction), the top speed (× the engine's),
 *  and how fast (1/s) speed above that bleeds away. */
export interface SurfaceGrip {
  grip: number;
  top: number;
  drag: number;
  /** The fastest anything goes on it (m/s), whatever the engine: a jet on a lawn is still on a lawn. */
  cap: number;
}

/** Every surface, the same on every map (a course says where each one is: see Surface). Boosting,
 *  only the grip counts: the rocket needs none, so it ploughs through at road speed (see race.ts). */
export const SURFACES: Record<Surface, SurfaceGrip> = {
  paved: { grip: 1, top: 1, drag: 0, cap: Infinity },
  // A lawn: about half speed (and never more than about 30 km/h), and slidey.
  grass: { grip: 0.7, top: 0.5, drag: 1.4, cap: 8 },
  // Long grass and planting (a park's rough patches and beds): a crawl, and it grabs the wheels.
  rough: { grip: 0.55, top: 0.15, drag: 3.5, cap: 2.5 },
};

/** The tyres' load (N): the car's weight into a slope whose cos is `cosT`, plus the wing's downforce
 *  at this speed² (m²/s²). */
export function normalLoad(k: CarStats, cosT: number, speed2: number): number {
  return k.mass * G * cosT + 0.5 * RHO * k.downforce * speed2;
}

/** The load on the flat at a standstill (what the CPU plans with). */
export function flatLoad(k: CarStats): number {
  return normalLoad(k, 1, 0);
}

/** Sideways force the tyres can hold while gripping (N), under load N. */
export function cornerForce(k: CarStats, N: number): number {
  return k.mu * CORNER_GRIP * N;
}

/** Sideways acceleration the tyres can hold while gripping (m/s²), under load N. */
export function cornerGrip(k: CarStats, N: number): number {
  return cornerForce(k, N) / k.mass;
}

/** Sideways acceleration of a full-bite drift (m/s²), under load N. */
export function driftGrip(k: CarStats, N: number): number {
  return (k.mu * DRIFT_GRIP * N) / k.mass;
}

/** How fast the nose can turn at speed v (rad/s): the steering's tightest circle, what the grip
 *  (`gripAcc`, from cornerGrip) allows with a touch of oversteer, and never past MAX_YAW. */
export function maxYawRate(k: CarStats, v: number, gripAcc: number): number {
  return Math.min(v / k.turnRadius, (gripAcc / Math.max(v, 2)) * OVERSTEER, MAX_YAW);
}

/**
 * The fastest a car can hold a bend of curvature kappa (1/m) on the flat while gripping, with the
 * wing's downforce growing with speed: mu·CORNER_GRIP·(g + aDown v²) = kappa v². Infinity when the
 * downforce keeps up with any speed.
 */
export function cornerSpeed(k: CarStats, kappa: number): number {
  const aDown = (0.5 * RHO * k.downforce) / k.mass;
  const muC = k.mu * CORNER_GRIP;
  const den = kappa - muC * aDown;
  return den > 1e-6 ? Math.sqrt((muC * G) / den) : Infinity;
}

/** The hardest a car can brake on the flat (m/s²): the brakes, or the tyres' grip if that's less. */
export function brakeDecel(k: CarStats): number {
  return Math.min(k.mu * G, k.brakeForce / k.mass);
}

/**
 * The wind blows along +x, the way every map points its course's main run (Russian Hill's, down to
 * the Bay; Twin Peaks' start straight). Drag and flight feel it as a vector; this is how much of it
 * shifts the engine's top speed for a car heading `heading` (negative: in its face). Round a loop
 * that's the part along the car. Point to point it's the whole wind wherever the car points: the
 * long jump was balanced that way, and the part along the car tips one glider build over the
 * balance check's headwind rule (see "Wind along the car" in DECISIONS.md). This is the one place
 * the rule differs by course, and the sim and the CPU both read it from here.
 */
export function windAlong(wind: number, heading: number, loop: boolean): number {
  return loop ? wind * Math.cos(heading) : wind;
}

/** The speed the engine stops pushing at (m/s), with `windAlong` m/s of tailwind along the car. */
export function topSpeedIn(k: CarStats, windAlong: number): number {
  return k.topSpeed + WIND_TOP * windAlong;
}

/** Deterministic PRNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface FlightBody {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  kiteOpen: boolean;
  wingsOpen: boolean;
}

/**
 * One step of flight: gravity, drag against the airspeed (the wind blows along x), and lift
 * perpendicular to the airspeed in the vertical plane that contains it. Glider wings spring open
 * as the car tips over the top of its arc; with the kite, their lift is trimmed to a steady glide.
 * Returns true on the step the wings open.
 */
export function stepFlightBody(b: FlightBody, k: CarStats, wind: number, dt: number): boolean {
  const m = k.mass;
  let opened = false;
  if (!b.wingsOpen && k.apexClA > 0 && b.vy <= 0) {
    b.wingsOpen = true;
    opened = true;
  }
  const ax = b.vx - wind;
  const ay = b.vy;
  const az = b.vz;
  const sp2 = ax * ax + ay * ay + az * az;
  const sp = Math.sqrt(sp2);
  let fx = 0;
  let fy = -m * G;
  let fz = 0;
  const cdA = k.cdA + (b.kiteOpen && k.kite ? k.kite.cdA : 0) + (b.wingsOpen ? k.apexCdA : 0);
  const q = 0.5 * RHO * cdA * sp;
  fx -= q * ax;
  fy -= q * ay;
  fz -= q * az;
  if (sp > 1e-9) {
    // Up, minus its component along the airspeed: perpendicular to the airspeed, pointing up.
    const uy = ay / sp;
    let lx = -uy * (ax / sp);
    let ly = 1 - uy * uy;
    let lz = -uy * (az / sp);
    const ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
    if (ll > 1e-9) {
      lx /= ll;
      ly /= ll;
      lz /= ll;
      let lift = 0.5 * RHO * k.clA * sp2;
      let extra = b.kiteOpen && k.kite ? Math.min(0.5 * RHO * k.kite.clA * sp2, k.kite.liftCap) : 0;
      if (b.wingsOpen) {
        // Open glider wings trim to a steady glide: with the kite, their combined lift is capped at
        // a fraction of the car's weight (a kite that already pulls harder keeps its own lift).
        const wings = 0.5 * RHO * k.apexClA * sp2;
        extra = Math.min(extra + wings, Math.max(extra, k.apexTrim * m * G));
      }
      lift += extra;
      fx += lift * lx;
      fy += lift * ly;
      fz += lift * lz;
    }
  }
  b.vx += (fx / m) * dt;
  b.vy += (fy / m) * dt;
  b.vz += (fz / m) * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  return opened;
}

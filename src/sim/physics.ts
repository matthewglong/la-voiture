// Shared physics: constants, a seeded RNG and the flight model from the lip to the splash.
// No Three.js or DOM imports: the game, the bots and scripts/balance.ts share it exactly.
import type { CarStats } from '../types';

export const RHO = 1.225;
export const G = 9.81;
export const DT = 1 / 120;
export const MAX_FLIGHT_TIME = 30;

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

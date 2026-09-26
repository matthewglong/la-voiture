// Deterministic car physics, shared exactly by the game and scripts/balance.ts.
// No Three.js or DOM imports. Always step with the fixed DT for identical results.
import { TRACK, sampleTrack, type Track } from '../track';
import type { CarStats } from '../types';

export const RHO = 1.225;
export const G = 9.81;
export const DT = 1 / 120;
/** At or below this speed after leaving the line, the car has stalled (DNF). */
export const STALL_SPEED = 0.3;
/** Distance the car must cover before the stall check applies. */
export const START_GRACE = 1;
export const MAX_RUN_TIME = 90;
export const MAX_FLIGHT_TIME = 30;

export type SimPhase = 'run' | 'flight' | 'splashed' | 'dnf';

export type SimEvent =
  | { type: 'bump'; t: number; index: number; s: number; keLostJ: number }
  | { type: 'fuelEmpty'; t: number; s: number }
  | {
      type: 'launch';
      t: number;
      speed: number;
      speedBeforeNitro: number;
      wastedFuelFrac: number;
    }
  | { type: 'splash'; t: number; distance: number; x: number; speed: number }
  | { type: 'dnf'; t: number; s: number; reason: 'stalled' | 'timeout' };

export interface Vec2 {
  x: number;
  y: number;
}

export interface SimState {
  phase: SimPhase;
  /** Total simulated time (s). */
  t: number;
  /** Arc length along the course (run-up), frozen at the lip afterwards. */
  s: number;
  /** Speed along the course on the run-up, |velocity| in flight. */
  speed: number;
  pos: Vec2;
  vel: Vec2;
  /** Track slope on the run-up, velocity angle in flight (radians). */
  angle: number;
  fuelJ: number;
  fuelFrac: number;
  engineOn: boolean;
  /** Demanded engine force exceeds the tyre grip limit this step. */
  wheelspin: boolean;
  /** Engine force delivered this step (N). */
  engineForce: number;
  bumpsHit: number;
  kiteOpen: boolean;
  /** Seconds from the start to the lip (set at launch). */
  runTime: number;
  /** Seconds in the air so far / total at splash. */
  flightTime: number;
  launchSpeed: number;
  /** Fraction of the tank still unburned at the lip (wasted). */
  wastedFuelFrac: number;
  /** Seconds spent with the wheels spinning. */
  wheelspinTime: number;
  /** Horizontal distance past the lip: live in flight, final after the splash. */
  distance: number;
  /** Highest point of the flight (the lip height until launch). */
  maxHeight: number;
  fuelEmptyAt: number | null;
}

export interface SimResult {
  distance: number;
  dnf: boolean;
  runTime: number;
  flightTime: number;
  launchSpeed: number;
  wastedFuelFrac: number;
  wheelspinTime: number;
  maxHeight: number;
  bumpsHit: number;
  fuelEmptyAt: number | null;
  totalTime: number;
}

export class CarSim {
  readonly stats: CarStats;
  readonly wind: number;
  readonly track: Track;
  readonly state: SimState;

  constructor(stats: CarStats, wind: number, track: Track = TRACK) {
    this.stats = stats;
    this.wind = wind;
    this.track = track;
    const p = sampleTrack(track, 0);
    this.state = {
      phase: 'run',
      t: 0,
      s: 0,
      speed: 0,
      pos: { x: p.x, y: p.y },
      vel: { x: 0, y: 0 },
      angle: p.angle,
      fuelJ: stats.energy,
      fuelFrac: stats.energy > 0 ? 1 : 0,
      engineOn: stats.energy > 0 && stats.power > 0,
      wheelspin: false,
      engineForce: 0,
      bumpsHit: 0,
      kiteOpen: false,
      runTime: 0,
      flightTime: 0,
      launchSpeed: 0,
      wastedFuelFrac: 0,
      wheelspinTime: 0,
      distance: 0,
      maxHeight: track.lip.y,
      fuelEmptyAt: null,
    };
  }

  get done(): boolean {
    return this.state.phase === 'splashed' || this.state.phase === 'dnf';
  }

  step(dt: number = DT): SimEvent[] {
    const events: SimEvent[] = [];
    const st = this.state;
    if (st.phase === 'run') this.stepRun(dt, events);
    else if (st.phase === 'flight') this.stepFlight(dt, events);
    return events;
  }

  private stepRun(dt: number, events: SimEvent[]): void {
    const st = this.state;
    const k = this.stats;
    const m = k.mass;
    const seg = sampleTrack(this.track, st.s).segment;
    const c = Math.cos(seg.angle);
    const sn = Math.sin(seg.angle);
    let v = st.speed;

    const normal = m * G * c;
    let force = -m * G * sn;

    // Aerodynamic drag from the airspeed vector (horizontal wind), projected on the tangent.
    const ax = v * c - this.wind;
    const ay = v * sn;
    const airspeed = Math.hypot(ax, ay);
    force += -0.5 * RHO * k.cdA * airspeed * (ax * c + ay * sn);

    // Engine: burns a constant P watts while there is fuel, grip or thrust permitting.
    let engineForce = 0;
    let spinning = false;
    if (st.fuelJ > 0 && k.power > 0) {
      const burn = Math.min(st.fuelJ, k.power * dt);
      const frac = burn / (k.power * dt);
      const demand = k.power / Math.max(v, 1);
      if (k.isJet) {
        engineForce = Math.min(demand, k.thrustCap);
      } else {
        const grip = k.mu * normal;
        spinning = demand > grip;
        engineForce = Math.min(demand, grip);
      }
      engineForce *= frac;
      st.fuelJ -= burn;
      if (st.fuelJ <= 1e-6) {
        st.fuelJ = 0;
        st.fuelEmptyAt = st.t + dt;
        events.push({ type: 'fuelEmpty', t: st.t + dt, s: st.s });
      }
    }
    force += engineForce;
    st.engineForce = engineForce;
    st.engineOn = st.fuelJ > 0 && k.power > 0;
    st.wheelspin = spinning;
    if (spinning) st.wheelspinTime += dt;

    // Rolling resistance opposes motion; at rest it acts like static friction.
    const rolling = k.crr * normal;
    if (v > 1e-9) force -= rolling;
    else if (force > rolling) force -= rolling;
    else if (force < -rolling) force += rolling;
    else force = 0;

    v += (force / m) * dt;
    const sPrev = st.s;
    let s = st.s + v * dt;
    st.t += dt;

    // Cable-car tracks: lose a fraction of kinetic energy on each crossing.
    for (let i = 0; i < this.track.bumpS.length; i++) {
      const b = this.track.bumpS[i];
      if (sPrev < b && s >= b && v > 0) {
        const ke = 0.5 * m * v * v;
        v *= Math.sqrt(1 - k.bumpLoss);
        st.bumpsHit++;
        events.push({ type: 'bump', t: st.t, index: i, s: b, keLostJ: ke * k.bumpLoss });
      }
    }

    st.fuelFrac = k.energy > 0 ? st.fuelJ / k.energy : 0;
    const lip = this.track.lip;
    if (s >= lip.s) {
      this.launch(v, events);
      return;
    }

    st.s = s;
    st.speed = v;
    const p = sampleTrack(this.track, s);
    st.pos.x = p.x;
    st.pos.y = p.y;
    st.angle = p.angle;
    st.vel.x = v * Math.cos(p.angle);
    st.vel.y = v * Math.sin(p.angle);

    if ((s > START_GRACE && v <= STALL_SPEED) || (st.t >= 5 && s <= START_GRACE)) {
      this.dnf('stalled', events);
    } else if (st.t >= MAX_RUN_TIME) {
      this.dnf('timeout', events);
    }
  }

  private launch(v: number, events: SimEvent[]): void {
    const st = this.state;
    const k = this.stats;
    const lip = this.track.lip;
    // The engine shuts off at the lip; whatever is left in the tank is wasted.
    st.wastedFuelFrac = k.energy > 0 ? st.fuelJ / k.energy : 0;
    st.fuelJ = 0;
    st.fuelFrac = 0;
    st.engineOn = false;
    st.engineForce = 0;
    st.wheelspin = false;
    const before = v;
    if (k.nitroJ > 0) v = Math.sqrt(v * v + (2 * k.nitroJ) / k.mass);
    st.kiteOpen = k.kite !== null;
    st.s = lip.s;
    st.pos.x = lip.x;
    st.pos.y = lip.y;
    st.vel.x = v * Math.cos(lip.angle);
    st.vel.y = v * Math.sin(lip.angle);
    st.angle = lip.angle;
    st.speed = v;
    st.runTime = st.t;
    st.launchSpeed = v;
    st.maxHeight = lip.y;
    st.distance = 0;
    st.phase = 'flight';
    events.push({
      type: 'launch',
      t: st.t,
      speed: v,
      speedBeforeNitro: before,
      wastedFuelFrac: st.wastedFuelFrac,
    });
  }

  private stepFlight(dt: number, events: SimEvent[]): void {
    const st = this.state;
    const k = this.stats;
    const m = k.mass;
    const vax = st.vel.x - this.wind;
    const vay = st.vel.y;
    const sp2 = vax * vax + vay * vay;
    const sp = Math.sqrt(sp2);

    let fx = 0;
    let fy = -m * G;
    const cdA = k.cdA + (st.kiteOpen && k.kite ? k.kite.cdA : 0);
    fx -= 0.5 * RHO * cdA * sp * vax;
    fy -= 0.5 * RHO * cdA * sp * vay;
    if (sp > 1e-9) {
      // Lift acts perpendicular to the airspeed, on the side that points up.
      let px = -vay / sp;
      let py = vax / sp;
      if (py < 0) {
        px = -px;
        py = -py;
      }
      let lift = 0.5 * RHO * k.clA * sp2;
      if (st.kiteOpen && k.kite) lift += Math.min(0.5 * RHO * k.kite.clA * sp2, k.kite.liftCap);
      fx += lift * px;
      fy += lift * py;
    }

    st.vel.x += (fx / m) * dt;
    st.vel.y += (fy / m) * dt;
    const px0 = st.pos.x;
    const py0 = st.pos.y;
    st.pos.x += st.vel.x * dt;
    st.pos.y += st.vel.y * dt;
    st.t += dt;
    st.flightTime += dt;
    st.speed = Math.hypot(st.vel.x, st.vel.y);
    st.angle = Math.atan2(st.vel.y, st.vel.x);
    if (st.pos.y > st.maxHeight) st.maxHeight = st.pos.y;
    const lipX = this.track.lip.x;

    if (st.pos.y <= 0) {
      // Interpolate the exact water entry within this step.
      const f = py0 / (py0 - st.pos.y);
      const x = px0 + (st.pos.x - px0) * f;
      st.t -= dt * (1 - f);
      st.flightTime -= dt * (1 - f);
      st.pos.x = x;
      st.pos.y = 0;
      st.distance = Math.max(0, x - lipX);
      st.phase = 'splashed';
      events.push({ type: 'splash', t: st.t, distance: st.distance, x, speed: st.speed });
      return;
    }
    st.distance = Math.max(0, st.pos.x - lipX);
    if (st.flightTime >= MAX_FLIGHT_TIME) {
      st.phase = 'splashed';
      events.push({ type: 'splash', t: st.t, distance: st.distance, x: st.pos.x, speed: st.speed });
    }
  }

  private dnf(reason: 'stalled' | 'timeout', events: SimEvent[]): void {
    const st = this.state;
    st.phase = 'dnf';
    st.speed = 0;
    st.vel.x = 0;
    st.vel.y = 0;
    st.distance = 0;
    st.engineOn = false;
    st.wheelspin = false;
    events.push({ type: 'dnf', t: st.t, s: st.s, reason });
  }

  result(): SimResult {
    const st = this.state;
    return {
      distance: st.phase === 'dnf' ? 0 : st.distance,
      dnf: st.phase === 'dnf',
      runTime: st.runTime,
      flightTime: st.flightTime,
      launchSpeed: st.launchSpeed,
      wastedFuelFrac: st.wastedFuelFrac,
      wheelspinTime: st.wheelspinTime,
      maxHeight: st.maxHeight,
      bumpsHit: st.bumpsHit,
      fuelEmptyAt: st.fuelEmptyAt,
      totalTime: st.t,
    };
  }
}

/** Run one car to its splash or DNF with the fixed step. */
export function simulateToEnd(stats: CarStats, wind: number, track: Track = TRACK): SimResult {
  const sim = new CarSim(stats, wind, track);
  // Upper bound on steps is implied by MAX_RUN_TIME and MAX_FLIGHT_TIME.
  while (!sim.done) sim.step(DT);
  return sim.result();
}

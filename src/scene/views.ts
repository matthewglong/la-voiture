// Cameras and the split screen.
//
// Three orbit rigs (focus, yaw, pitch, distance): one per player and one shared. Chase rigs sit
// behind their car looking down the course (not along the car's nose, so Lombard's hairpins and
// spin-outs don't whip the view round). Off the road (across a park's lawn, over a hedge, cutting a
// corner) the course's direction says nothing about where the car is going, so the chase camera
// turns to follow the car instead, never faster than a steady turn. The shared rig frames both cars and fills the screen in the
// garage, through the countdown and behind the results (racing solo, it follows Player 1 the whole
// way). Two players race in split screen, Player 1 left and Player 2 right, from GO to the results.
// They start side by side in that order, so at GO the screen splits down the middle of the shared
// view: each half starts as its own half of it (an off-centre projection, so nothing on it moves)
// and eases into its player's own camera, centred. The results run the same move backwards.
import * as THREE from 'three';
import { deltaS, heightAt, pointAt, type Course, type CoursePoint } from '../track';
import { damp, smoothstep } from './util';

export type RigMode = 'build' | 'chase' | 'side' | 'results' | 'stalled';

export interface ViewTarget {
  pos: THREE.Vector3;
  /** Where the car is along the course (arc length), and its progress in the race (laps and all). */
  s: number;
  prog: number;
  speed: number;
  /** Which way its nose points (radians, like the course's headings), and its velocity. */
  heading: number;
  vx: number;
  vz: number;
  /** How far (m) it is from the course's centreline, sideways (+ or −). */
  d: number;
  /** On the road (racing, or cruising past the flag), in the air after the lip, or finished. */
  phase: 'grid' | 'race' | 'flight' | 'splashed' | 'finished' | 'dnf';
}

interface Pose {
  focus: THREE.Vector3;
  yaw: number;
  pitch: number;
  dist: number;
}

const DEG = Math.PI / 180;
/** The course the cameras follow (the map in play). */
let C: Course;
/** The side-on views look across the jump from its right, a quarter turn round from the lip. */
const SIDE_YAW = Math.PI / 2;

/** The jump's frame: where the lip is, and the way it launches (a course without one: world x). */
function lipFrame(): { x: number; y: number; z: number; tx: number; tz: number; heading: number } {
  const l = C.lip;
  return l ? { x: l.x, y: l.y, z: l.z, tx: l.tx, tz: l.tz, heading: l.heading } : { x: 0, y: 0, z: 0, tx: 1, tz: 0, heading: 0 };
}

/** A point in the jump's frame: how far out past the lip (a), and off to its right (l). */
function inLipFrame(p: { x: number; z: number }): { a: number; l: number } {
  const f = lipFrame();
  const dx = p.x - f.x;
  const dz = p.z - f.z;
  return { a: dx * f.tx + dz * f.tz, l: -dx * f.tz + dz * f.tx };
}
/** The furthest back (m) the shared chase camera goes to fit both cars in. */
const MAX_SHARED_DIST = 36;
/** How close (m) the racers still on the road must be to the lip for one shared side-on view. */
const NEAR_LIP = 25;
/** Seconds for the screen to split at GO (and to come back together for the results). */
const SPLIT_TIME = 0.5;
/** Past the paved edge (m): where the chase camera starts following the car rather than the course,
 *  and where it's following the car alone. */
const OFF_START = 1.5;
const OFF_FULL = 6;
/** How quickly (1/s) it eases into following the car and back (a hop between legs is sudden). */
const OFF_EASE = 2.5;
/** Off the road, the way the car is going is where its nose points up to TRAVEL_V0 (m/s), and the
 *  way it's moving from TRAVEL_V1. Reversing (at most 5 m/s) keeps the camera behind the nose;
 *  sliding sideways or spinning at speed keeps it on the way the car is actually going. */
const TRAVEL_V0 = 5.5;
const TRAVEL_V1 = 10;
/** The fastest (rad/s) the off-road camera turns: a car spinning on the spot doesn't spin it. */
const OFF_TURN = 90 * DEG;
const tmpPt = {} as CoursePoint;

function clonePose(p: Pose): Pose {
  return { focus: p.focus.clone(), yaw: p.yaw, pitch: p.pitch, dist: p.dist };
}

/** An angle brought into −π..π. */
function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapAngle(b - a) * t;
}

/** Inside one of the course's wide views (Lombard's switchbacks), or just before one. */
function inWideView(s: number): boolean {
  return C.wideViews.some((v) => s + 14 >= v.s0 && s < v.s1);
}

/** Heading the course is going at s, averaged over the stretch ahead (and much longer on Lombard). */
export function courseDirection(s: number): number {
  const lomb = inWideView(s);
  const [a, b] = lomb ? [-20, 40] : [-3, 16];
  let x = 0;
  let z = 0;
  for (let u = a; u <= b; u += 2) {
    const p = pointAt(C, C.loop ? s + u : Math.min(Math.max(s + u, 0), C.length));
    const w = lomb ? 1 : 1 + (u > 0 ? 0.5 : 0);
    x += p.tx * w;
    z += p.tz * w;
  }
  return Math.atan2(z, x);
}

function wideViewBlend(s: number): number {
  // 0..1: how far into a wide view's framing (eases in and out around Lombard's block).
  let f = 0;
  for (const v of C.wideViews) {
    const a = Math.min(1, Math.max(0, (s - (v.s0 - 16)) / 14));
    const b = Math.min(1, Math.max(0, (v.s1 + 6 - s) / 12));
    f = Math.max(f, Math.min(a, b));
  }
  return f;
}

function orbitPosition(p: Pose, out: THREE.Vector3): THREE.Vector3 {
  const cp = Math.cos(p.pitch);
  return out.set(
    p.focus.x + Math.cos(p.yaw) * cp * p.dist,
    p.focus.y + Math.sin(p.pitch) * p.dist,
    p.focus.z + Math.sin(p.yaw) * cp * p.dist,
  );
}

/** One orbit camera rig: a goal pose computed from the cars, and a smoothed current pose. */
class Rig {
  mode: RigMode = 'build';
  cur: Pose;
  goal: Pose;
  private modeTime = 0;
  private sideFocusX = 0;
  /** Off the road: how far into following the car (0..1), the way the car is going (turned at
   *  most OFF_TURN), and the wide-view framing held from where it left the road. */
  private off = 0;
  private travel = 0;
  private lombHeld = 0;

  constructor() {
    this.cur = this.buildPose(0);
    this.goal = this.buildPose(0);
  }

  setMode(mode: RigMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.modeTime = 0;
    // (sideFocusX: how far out past the lip the side-on view is centred.)
    if (mode === 'side' || mode === 'results') this.sideFocusX = Math.max(inLipFrame(this.cur.focus).a, -10);
  }

  snap(targets: ViewTarget[], t: number, aspect: number, fov: number): void {
    this.computeGoal(targets, t, 0, aspect, fov);
    this.cur = clonePose(this.goal);
  }

  update(dt: number, t: number, targets: ViewTarget[], aspect: number, fov: number): void {
    this.modeTime += dt;
    this.computeGoal(targets, t, dt, aspect, fov);
    let rate = 4;
    let angleRate = 3;
    if (this.mode === 'side') {
      angleRate = this.modeTime < 2 ? 1.6 : 2.5;
      rate = this.modeTime < 2 ? 3.5 : 4.5;
    } else if (this.mode === 'results') {
      rate = 1.2;
      angleRate = 1.2;
    } else if (this.mode === 'chase') {
      rate = 6;
      angleRate = 2.6;
    } else if (this.mode === 'build') {
      rate = 3;
      angleRate = 3;
    }
    const k = damp(rate, dt);
    const ka = damp(angleRate, dt);
    this.cur.focus.lerp(this.goal.focus, k);
    this.cur.yaw = lerpAngle(this.cur.yaw, this.goal.yaw, ka);
    this.cur.pitch += (this.goal.pitch - this.cur.pitch) * ka;
    this.cur.dist += (this.goal.dist - this.cur.dist) * ka;
  }

  private buildPose(t: number): Pose {
    // Both cars on the start line, the street dropping away behind them towards the Bay.
    const p = pointAt(C, C.startS + 1);
    const back = p.heading + Math.PI;
    return {
      focus: new THREE.Vector3(p.x + p.tx * 0.5, p.y - 1.6, p.z + p.tz * 0.5),
      yaw: back + Math.sin(t * 0.07) * 1.2 * DEG,
      pitch: 18.5 * DEG,
      dist: 27,
    };
  }

  /** How far into following the car rather than the course (0..1), easing it along; `dir` is the
   *  course's direction here. Keeps `travel` (the way the car is going) up to date. */
  private offRoad(tg: ViewTarget, dir: number, dt: number, grid: boolean): number {
    const past = Math.abs(tg.d) - pointAt(C, tg.s, tmpPt).pave;
    const raw = grid ? 0 : smoothstep(OFF_START, OFF_FULL, past);
    this.off = dt > 0 ? this.off + (raw - this.off) * damp(OFF_EASE, dt) : raw;
    // The way it's going: the nose when slow (stopped, reversing, turning round), its velocity once
    // it's properly moving.
    const w = tg.speed > 0.01 ? smoothstep(TRAVEL_V0, TRAVEL_V1, tg.speed) : 0;
    const x = Math.cos(tg.heading) * (1 - w) + (w > 0 ? (tg.vx / tg.speed) * w : 0);
    const z = Math.sin(tg.heading) * (1 - w) + (w > 0 ? (tg.vz / tg.speed) * w : 0);
    const want = x * x + z * z > 0.09 ? Math.atan2(z, x) : this.travel;
    if (this.off < 0.01) {
      // On the road: start from the course's direction when it leaves, so there's no jump.
      this.travel = dir;
    } else if (dt === 0) {
      this.travel = want;
    } else {
      const max = OFF_TURN * dt;
      this.travel = wrapAngle(this.travel + Math.max(-max, Math.min(max, wrapAngle(want - this.travel))));
    }
    return this.off < 0.01 ? 0 : this.off;
  }

  /** Chase framing for one or two cars. */
  private chase(targets: ViewTarget[], aspect: number, fov: number, grid: boolean, dt: number): void {
    const g = this.goal;
    const n = targets.length;
    // With two cars: sit behind the trailing one and look ahead towards the leader.
    const sorted = [...targets].sort((a, b) => a.prog - b.prog);
    const trail = sorted[0];
    const lead = sorted[n - 1];
    let speed = 0;
    for (const tg of targets) speed = Math.max(speed, tg.speed);
    const sMid = n === 2 ? trail.s + deltaS(C, trail.s, lead.s) * 0.4 : trail.s;
    // Off the road the course's s can jump (to whichever path or leg is nearest), so its direction,
    // wide-view framing and grade give way to the car's own way and what it had on the road.
    const road = courseDirection(sMid);
    const off = this.offRoad(trail, road, dt, grid);
    const dir = off > 0 ? lerpAngle(road, this.travel, off) : road;
    const dx = Math.cos(dir);
    const dz = Math.sin(dir);
    const lombNow = wideViewBlend(sMid);
    if (off === 0) this.lombHeld = lombNow;
    const lomb = lombNow + (this.lombHeld - lombNow) * off;
    const look = grid ? 2 : 3 + Math.min(10, speed * 0.28);
    const fx = new THREE.Vector3().copy(trail.pos);
    // Two cars: aim between the trailing car and a point just ahead of the leader, so the trailing
    // car stays well up the screen (the look-ahead only runs ahead of the leader).
    if (n === 2) fx.lerp(lead.pos, 0.5);
    const ahead = n === 2 ? look * 0.5 : look;
    fx.x += dx * ahead;
    fx.z += dz * ahead;
    fx.y += 1.0;
    const base = (grid ? 12.5 : 14.5 + Math.min(6, speed * 0.14)) * (1 - lomb) + 23 * lomb;
    let fit = base;
    let pitch = (grid ? 18 : 25 + Math.min(4, speed * 0.1)) * DEG * (1 - lomb) + 42 * DEG * lomb;
    if (C.followGrade > 0 && !grid) {
      // Tilt with the road: look up the climb ahead (the road rising into the frame), and down a
      // drop, aiming at the road's height where the look-ahead lands.
      const k = C.followGrade * (1 - lomb) * (1 - off);
      const reach = 8 + speed * 0.5;
      const yAhead = heightAt(C, trail.s + ahead);
      const grade = (heightAt(C, sMid + reach) - heightAt(C, sMid - 4)) / (reach + 4);
      pitch -= Math.atan(grade) * k;
      fx.y += (yAhead + 1 - fx.y) * 0.5 * k;
    }
    if (n === 2) {
      const a = trail.pos;
      const b = lead.pos;
      const lat = Math.abs((b.x - a.x) * -dz + (b.z - a.z) * dx);
      const lon = Math.max(0, (b.x - a.x) * dx + (b.z - a.z) * dz);
      const tanH = Math.tan((fov * DEG) / 2) * aspect;
      fit = Math.max(base, (lat / 2 / tanH) * 1.5 + 4, base * 0.85 + (lon + look * 0.5) * 0.8);
      // Look a little more steeply down as they string out, so the leader stays on screen.
      pitch += Math.min(10, lon * 0.35) * DEG * (1 - lomb);
    }
    g.focus.copy(fx);
    g.yaw = dir + Math.PI;
    g.pitch = pitch;
    g.dist = Math.min(fit, MAX_SHARED_DIST);
  }

  private computeGoal(targets: ViewTarget[], t: number, dt: number, aspect: number, fov: number): void {
    const g = this.goal;
    if (this.mode === 'build') {
      const p = this.buildPose(t);
      g.focus.copy(p.focus);
      g.yaw = p.yaw;
      g.pitch = p.pitch;
      g.dist = p.dist;
      return;
    }
    if (this.mode === 'chase' || this.mode === 'stalled') {
      const live = targets.filter((c) => c.phase === 'race' || c.phase === 'grid' || c.phase === 'finished');
      const pool = live.length ? live : targets;
      const grid = pool.every((c) => c.phase === 'grid');
      this.chase(pool, aspect, fov, grid, dt);
      if (this.mode === 'stalled') {
        g.focus.y -= 4;
        g.pitch = 24 * DEG;
      }
      return;
    }
    // Side-on: pan with the leader; keep the lip and every car in the air (or close to the lip) in
    // frame while possible. Worked out in the jump's frame (x: out past the lip, z: across it).
    const f = lipFrame();
    const lip = { x: 0, y: f.y };
    const rel = (c: ViewTarget): { a: number; l: number } => inLipFrame(c.pos);
    const flown = targets.filter((c) => c.phase === 'flight' || c.phase === 'splashed');
    const near = targets.filter((c) => c.phase === 'race' && rel(c).a > -65 && Math.abs(rel(c).l) < 20);
    const framed = [...new Set([...flown, ...near])];
    const side = framed.length > 0 ? framed : targets;
    const xs = side.map((c) => rel(c).a);
    const ys = side.map((c) => c.pos.y);
    const zs = side.map((c) => rel(c).l);
    const lead = Math.max(...xs);
    const trail = Math.min(...xs);
    const maxDist = this.mode === 'results' ? 170 : 150;
    const tanH = Math.tan((fov * DEG) / 2) * aspect;
    const tanV = Math.tan((fov * DEG) / 2);
    const margin = 1.25;
    const widthFor = (x0: number, x1: number): number => ((x1 - x0) / 2 / tanH) * margin;
    let x0 = Math.min(lip.x - 14, trail - 6);
    // After the race, frame through the next big distance label rather than cutting it in half.
    const nextBig = lip.x + Math.ceil((lead - lip.x + 1) / 50) * 50 + 7;
    const x1 = this.mode === 'results' ? Math.max(lead + 26, nextBig) : lead + 32;
    if (widthFor(x0, x1) > maxDist) x0 = Math.min(trail - 6, x1 - (2 * maxDist * tanH) / margin);
    if (widthFor(x0, x1) > maxDist) x0 = x1 - (2 * maxDist * tanH) / margin;
    const centerX = (x0 + x1) / 2;
    const top = Math.max(lip.y + 4, ...ys.map((y) => y + 4));
    const heightDist = ((top + 2) / 2 / tanV) * margin;
    const minDist = this.mode === 'results' ? 64 : 52;
    const dist = Math.max(minDist, Math.min(maxDist, Math.max(widthFor(x0, x1), heightDist)));
    const panRate = this.mode === 'results' ? 1.5 : 5;
    this.sideFocusX += (centerX - this.sideFocusX) * damp(panRate, dt || 1 / 60);
    const results = this.mode === 'results';
    const zMid = Math.max(-20, Math.min(20, (Math.min(...zs) + Math.max(...zs)) / 2));
    // Back to the world: sideFocusX out along the jump, zMid across it.
    g.focus.set(f.x + f.tx * this.sideFocusX - f.tz * zMid, results ? -dist * 0.16 : Math.max(5, top * 0.42), f.z + f.tz * this.sideFocusX + f.tx * zMid);
    g.yaw = f.heading + SIDE_YAW + (results ? Math.sin(t * 0.15) * 3 * DEG : 0);
    g.pitch = (results ? 13 : 8) * DEG;
    g.dist = dist;
  }
}

export interface Pane {
  /** In CSS pixels from the top-left. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Views {
  readonly shared: Rig;
  readonly rigs: [Rig, Rig];
  /** The camera for the whole screen, and one per half. */
  readonly camera: THREE.PerspectiveCamera;
  readonly paneCams: [THREE.PerspectiveCamera, THREE.PerspectiveCamera];
  /** 0 = one screen, 1 = fully split. */
  split = 0;
  private readonly divider: HTMLElement;
  private readonly tmp = new THREE.Vector3();
  /** What each half shows while the screen splits or comes back together: a blend of the shared
   *  view and its player's own. */
  private readonly blend: [Pose, Pose] = [
    { focus: new THREE.Vector3(), yaw: 0, pitch: 0, dist: 0 },
    { focus: new THREE.Vector3(), yaw: 0, pitch: 0, dist: 0 },
  ];
  private w = 1;
  private h = 1;
  /** Camera shake per player (decays). */
  private readonly shakeAmt: [number, number] = [0, 0];
  private shakeT = 0;

  constructor(camera: THREE.PerspectiveCamera, overlay: HTMLElement, course: Course) {
    C = course;
    this.shared = new Rig();
    this.rigs = [new Rig(), new Rig()];
    this.camera = camera;
    this.paneCams = [camera.clone(), camera.clone()];
    this.divider = document.createElement('div');
    this.divider.className = 'split-divider';
    overlay.appendChild(this.divider);
  }

  /** Shake a player's view (a big hit). */
  shake(p: 0 | 1, amount: number): void {
    this.shakeAmt[p] = Math.min(1.2, Math.max(this.shakeAmt[p], amount));
  }

  /** Every rig to one mode (build, results...). */
  setMode(mode: RigMode): void {
    this.shared.setMode(mode);
    this.rigs[0].setMode(mode);
    this.rigs[1].setMode(mode);
  }

  /** Racing alone: the shared view follows Player 1 and the screen never splits. */
  solo = false;

  /** Follow a (new) course: the map in play. */
  setCourse(course: Course): void {
    C = course;
  }

  /** Jump straight to the goal poses and to one screen (after a reset or a cut). */
  snap(targets: ViewTarget[], t = 0): void {
    const aspect = this.camera.aspect;
    this.shared.snap(this.solo ? [targets[0]] : targets, t, aspect, this.camera.fov);
    this.rigs.forEach((r, p) => r.snap([targets[p]], t, aspect / 2, this.camera.fov));
    this.split = 0;
  }

  setSize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  /**
   * Per-frame: pick each rig's mode from what the cars are doing, and split the screen while two
   * players race (`racing`: from GO until the results), easing it apart or back together.
   */
  update(dt: number, t: number, targets: [ViewTarget, ViewTarget], racing: boolean): void {
    const aspect = this.w / this.h;
    const fov = this.camera.fov;
    const live = this.solo ? [targets[0]] : targets;
    if (racing) {
      for (const p of [0, 1] as const) {
        const ph = targets[p].phase;
        this.rigs[p].setMode(ph === 'flight' || ph === 'splashed' || ph === 'dnf' ? (ph === 'dnf' ? 'stalled' : 'side') : 'chase');
      }
      // The shared view is on screen racing solo; with two players it stays on both cars so the
      // results can come back together from it.
      const flying = live.some((c) => c.phase === 'flight' || c.phase === 'splashed');
      const allDone = live.every((c) => c.phase === 'flight' || c.phase === 'splashed' || c.phase === 'dnf');
      const nearLip = live.every((c) => c.phase !== 'race' || (C.lip !== null && inLipFrame(c.pos).a > -NEAR_LIP && Math.abs(inLipFrame(c.pos).l) < 20));
      this.shared.setMode(flying && (nearLip || allDone) ? 'side' : 'chase');
    }
    this.shared.update(dt, t, live, aspect, fov);
    this.rigs[0].update(dt, t, [targets[0]], aspect / 2, fov);
    this.rigs[1].update(dt, t, [targets[1]], aspect / 2, fov);
    const dir = racing && !this.solo ? 1 : -1;
    this.split = Math.min(1, Math.max(0, this.split + (dir * dt) / SPLIT_TIME));
    this.shakeT += dt;
    for (const p of [0, 1] as const) this.shakeAmt[p] *= Math.exp(-6 * dt);
    // The divider grows out from the middle as the halves part (and shrinks as they rejoin).
    this.divider.classList.toggle('on', this.isSplit);
    this.divider.style.scale = `1 ${Math.min(1, this.split * 3).toFixed(3)}`;
  }

  private ease(): number {
    const x = this.split;
    return x * x * (3 - 2 * x);
  }

  /** Point a camera at a pose; `win` = which vertical strip of a w×h frustum it shows (null: all). */
  private configure(
    cam: THREE.PerspectiveCamera,
    pose: Pose,
    w: number,
    h: number,
    win: { x: number; w: number } | null,
    shake = 0,
  ): THREE.PerspectiveCamera {
    orbitPosition(pose, cam.position);
    cam.up.set(0, 1, 0);
    if (shake > 0.005) {
      const t = this.shakeT;
      this.tmp.set(Math.sin(t * 47) + Math.sin(t * 31), Math.sin(t * 53) * 1.2, Math.sin(t * 41) + Math.sin(t * 29)).multiplyScalar(0.18 * shake);
      cam.position.add(this.tmp);
      cam.lookAt(this.tmp.add(pose.focus));
    } else cam.lookAt(pose.focus);
    cam.aspect = w / h;
    if (win) cam.setViewOffset(w, h, win.x, 0, win.w, h);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    return cam;
  }

  /** The pose a half shows right now, and which strip of a full-screen frustum it draws: its own
   *  half of the shared view as the split starts, easing into its player's camera, centred. */
  private panePose(p: 0 | 1): { pose: Pose; offX: number } {
    const e = this.ease();
    const a = this.shared.cur;
    const own = this.rigs[p].cur;
    const pose = this.blend[p];
    pose.focus.copy(a.focus).lerp(own.focus, e);
    pose.yaw = lerpAngle(a.yaw, own.yaw, e);
    pose.pitch = a.pitch + (own.pitch - a.pitch) * e;
    pose.dist = a.dist + (own.dist - a.dist) * e;
    const half = this.w / 2;
    const crop = p === 0 ? 0 : half;
    return { pose, offX: crop + (half / 2 - crop) * e };
  }

  /** Whether the screen is (even partly) split. */
  get isSplit(): boolean {
    return this.split > 0.001;
  }

  /** Where each player's view is on screen: their half when split, else the whole screen. */
  pane(p: 0 | 1): Pane {
    if (!this.isSplit) return { x: 0, y: 0, w: this.w, h: this.h };
    const half = this.w / 2;
    return { x: p === 0 ? 0 : half, y: 0, w: half, h: this.h };
  }

  /** The camera that draws a player's pane (or the whole screen). */
  cameraFor(p: 0 | 1): THREE.PerspectiveCamera {
    return this.isSplit ? this.paneCams[p] : this.camera;
  }

  /** Focus of a player's view (for the shadow frustum). */
  focusFor(p: 0 | 1): THREE.Vector3 {
    return this.isSplit ? this.panePose(p).pose.focus : this.shared.cur.focus;
  }

  /**
   * Draw the frame. `before(camera, p)` runs before each pane is drawn (p = -1 for the whole
   * screen) so the caller can move the shadow frustum and face the trails.
   */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, before: (cam: THREE.Camera, p: -1 | 0 | 1) => void): void {
    const w = this.w;
    const h = this.h;
    if (!this.isSplit) {
      this.configure(this.camera, this.shared.cur, w, h, null, Math.max(this.shakeAmt[0], this.shakeAmt[1]));
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);
      before(this.camera, -1);
      renderer.render(scene, this.camera);
      return;
    }
    renderer.setScissorTest(true);
    for (const p of [0, 1] as const) {
      const { pose, offX } = this.panePose(p);
      const { x, w: wp } = this.pane(p);
      const cam = this.configure(this.paneCams[p], pose, w, h, { x: offX, w: wp }, this.shakeAmt[p]);
      renderer.setViewport(x, 0, wp, h);
      renderer.setScissor(x, 0, wp, h);
      before(cam, p);
      renderer.render(scene, cam);
    }
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
  }

  /** Screen position (CSS px) of a world point in a player's pane, and whether it's visible there. */
  project(p: 0 | 1, world: THREE.Vector3, out: { x: number; y: number; vis: boolean }): void {
    const cam = this.cameraFor(p);
    const pane = this.pane(p);
    this.tmp.copy(world).project(cam);
    out.x = pane.x + (this.tmp.x * 0.5 + 0.5) * pane.w;
    out.y = pane.y + (-this.tmp.y * 0.5 + 0.5) * pane.h;
    out.vis = this.tmp.z < 1 && Math.abs(this.tmp.x) < 1.02 && Math.abs(this.tmp.y) < 1.05;
  }
}

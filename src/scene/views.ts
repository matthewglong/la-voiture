// Cameras and the fluid split screen.
//
// Three orbit rigs (focus, yaw, pitch, distance): one per player and one shared. Chase rigs sit
// behind their car looking down the course (not along the car's nose, so Lombard's hairpins and
// spin-outs don't whip the view round). While the shared rig can frame both cars, one camera fills
// the screen. When it can't, the screen splits, Player 1 left and Player 2 right. The shared chase
// camera already sits behind the trailing car, so that player's view carries straight on: the
// divider slides in from the other side, cropping it (an off-centre projection, so nothing on it
// moves), while it eases into that player's own camera. The leader's view slides in with the
// divider, attached to it. Healing runs the same move backwards: the leader's half slides out and
// the other half widens back into the shared view. No moment shows two overlapping blends of the
// same scene, so a car is never drawn twice side by side.
import * as THREE from 'three';
import { COURSE, pointAt, sectionAt } from '../track';
import { damp } from './util';

export type RigMode = 'build' | 'chase' | 'side' | 'results' | 'stalled';

export interface ViewTarget {
  pos: THREE.Vector3;
  /** Progress along the course. */
  s: number;
  speed: number;
  /** On the road (racing), in the air after the lip, or finished. */
  phase: 'grid' | 'race' | 'flight' | 'splashed' | 'dnf';
}

interface Pose {
  focus: THREE.Vector3;
  yaw: number;
  pitch: number;
  dist: number;
}

const DEG = Math.PI / 180;
const C = COURSE;
const SIDE_YAW = Math.PI / 2;
const MAX_SHARED_DIST = 30;
/** How close (m) the racers still on the road must be to the lip for one shared side-on view. */
const NEAR_LIP = 25;
/** Seconds for the divider to slide in or out. */
const SPLIT_TIME = 0.5;

function clonePose(p: Pose): Pose {
  return { focus: p.focus.clone(), yaw: p.yaw, pitch: p.pitch, dist: p.dist };
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Heading the course is going at s, averaged over the stretch ahead (and much longer on Lombard). */
export function courseDirection(s: number): number {
  const lomb = sectionAt(C, s).kind === 'lombard' || sectionAt(C, s + 14).kind === 'lombard';
  const [a, b] = lomb ? [-20, 40] : [-3, 16];
  let x = 0;
  let z = 0;
  for (let u = a; u <= b; u += 2) {
    const p = pointAt(C, Math.min(Math.max(s + u, 0), C.length));
    const w = lomb ? 1 : 1 + (u > 0 ? 0.5 : 0);
    x += p.tx * w;
    z += p.tz * w;
  }
  return Math.atan2(z, x);
}

function inLombard(s: number): number {
  // 0..1: how far into the Lombard framing (eases in and out around the block).
  const m = C.marks;
  const a = Math.min(1, Math.max(0, (s - (m.lombardS0 - 16)) / 14));
  const b = Math.min(1, Math.max(0, (m.lombardS1 + 6 - s) / 12));
  return Math.min(a, b);
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
  private sideFocusX = C.lip.x;

  constructor() {
    this.cur = this.buildPose(0);
    this.goal = this.buildPose(0);
  }

  setMode(mode: RigMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.modeTime = 0;
    if (mode === 'side' || mode === 'results') this.sideFocusX = Math.max(this.cur.focus.x, C.lip.x - 10);
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

  /** Chase framing for one or two cars; returns how far back it needs to be to fit them. */
  private chase(targets: ViewTarget[], aspect: number, fov: number, grid: boolean): number {
    const g = this.goal;
    const n = targets.length;
    // With two cars: sit behind the trailing one and look ahead towards the leader.
    const sorted = [...targets].sort((a, b) => a.s - b.s);
    const trail = sorted[0];
    const lead = sorted[n - 1];
    let speed = 0;
    for (const tg of targets) speed = Math.max(speed, tg.speed);
    const sMid = n === 2 ? trail.s + (lead.s - trail.s) * 0.4 : trail.s;
    const dir = courseDirection(sMid);
    const dx = Math.cos(dir);
    const dz = Math.sin(dir);
    const lomb = inLombard(sMid);
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
    g.dist = Math.min(fit, MAX_SHARED_DIST + 6);
    return fit;
  }

  /** Last computed need (chase): how far back the camera wants to be to fit everyone. */
  need = 0;

  private computeGoal(targets: ViewTarget[], t: number, dt: number, aspect: number, fov: number): void {
    const g = this.goal;
    if (this.mode === 'build') {
      const p = this.buildPose(t);
      g.focus.copy(p.focus);
      g.yaw = p.yaw;
      g.pitch = p.pitch;
      g.dist = p.dist;
      this.need = 0;
      return;
    }
    if (this.mode === 'chase' || this.mode === 'stalled') {
      const live = targets.filter((c) => c.phase === 'race' || c.phase === 'grid');
      const pool = live.length ? live : targets;
      const grid = pool.every((c) => c.phase === 'grid');
      this.need = this.chase(pool, aspect, fov, grid);
      if (this.mode === 'stalled') {
        g.focus.y -= 4;
        g.pitch = 24 * DEG;
      }
      return;
    }
    // Side-on: pan with the leader; keep the lip and every car in the air (or close to the lip) in
    // frame while possible.
    const lip = C.lip;
    const flown = targets.filter((c) => c.phase === 'flight' || c.phase === 'splashed');
    const near = targets.filter((c) => c.phase === 'race' && c.pos.x > lip.x - 65 && Math.abs(c.pos.z) < 20);
    const framed = [...new Set([...flown, ...near])];
    const side = framed.length > 0 ? framed : targets;
    const xs = side.map((c) => c.pos.x);
    const ys = side.map((c) => c.pos.y);
    const zs = side.map((c) => c.pos.z);
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
    const zMid = (Math.min(...zs) + Math.max(...zs)) / 2;
    g.focus.set(this.sideFocusX, results ? -dist * 0.16 : Math.max(5, top * 0.42), Math.max(-20, Math.min(20, zMid)));
    g.yaw = SIDE_YAW + (results ? Math.sin(t * 0.15) * 3 * DEG : 0);
    g.pitch = (results ? 13 : 8) * DEG;
    g.dist = dist;
    this.need = 0;
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
  readonly shared = new Rig();
  readonly rigs: [Rig, Rig] = [new Rig(), new Rig()];
  /** The camera for the whole screen, and one per half. */
  readonly camera: THREE.PerspectiveCamera;
  readonly paneCams: [THREE.PerspectiveCamera, THREE.PerspectiveCamera];
  /** 0 = one screen, 1 = fully split. */
  split = 0;
  /** Where the split is heading. */
  splitting = false;
  /** The player whose view carries on through a split or a heal (the other one slides). */
  private anchor: 0 | 1 = 1;
  private calm = 0;
  private readonly divider: HTMLElement;
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private w = 1;
  private h = 1;
  /** Seconds the shared framing has been failing (debounce). */
  private strain = 0;
  /** Camera shake per player (decays). */
  private readonly shakeAmt: [number, number] = [0, 0];
  private shakeT = 0;

  constructor(camera: THREE.PerspectiveCamera, overlay: HTMLElement) {
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

  /** Jump straight to the goal poses and to one screen (after a reset or a cut). */
  snap(targets: ViewTarget[], t = 0): void {
    const aspect = this.camera.aspect;
    this.shared.snap(this.solo ? [targets[0]] : targets, t, aspect, this.camera.fov);
    this.rigs.forEach((r, p) => r.snap([targets[p]], t, aspect / 2, this.camera.fov));
    this.split = 0;
    this.splitting = false;
    this.strain = 0;
    this.calm = 0;
  }

  setSize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  /**
   * Per-frame: pick each rig's mode from what the cars are doing, decide whether the screen should
   * be split, and ease the split in or out.
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
      const flying = live.some((c) => c.phase === 'flight' || c.phase === 'splashed');
      const allDone = live.every((c) => c.phase === 'flight' || c.phase === 'splashed' || c.phase === 'dnf');
      const nearLip = live.every(
        (c) => c.phase !== 'race' || (c.pos.x > C.lip.x - NEAR_LIP && Math.abs(c.pos.z) < 20),
      );
      this.shared.setMode(flying && (nearLip || allDone) ? 'side' : 'chase');
    }
    this.shared.update(dt, t, live, aspect, fov);
    this.rigs[0].update(dt, t, [targets[0]], aspect / 2, fov);
    this.rigs[1].update(dt, t, [targets[1]], aspect / 2, fov);

    // Should we be split? Only while racing: the rigs disagree about the mode, or the shared chase
    // can't fit both cars (checked on the real projection, with some slack before splitting).
    let want = false;
    if (racing && !this.solo) {
      const modes = [this.rigs[0].mode, this.rigs[1].mode];
      const sameMode = modes[0] === modes[1] || this.shared.mode === 'side';
      let fits = true;
      if (this.shared.mode === 'chase') {
        fits = this.shared.need <= MAX_SHARED_DIST && this.bothVisible(targets, 0.84);
        // Coming back together needs more room (hysteresis).
        if (this.splitting) fits = this.shared.need <= MAX_SHARED_DIST - 5 && this.bothVisible(targets, 0.62);
      } else if (this.shared.mode === 'side') {
        fits = targets.every((c) => c.phase !== 'race' || (c.pos.x > C.lip.x - NEAR_LIP - 5 && Math.abs(c.pos.z) < 20));
      }
      want = !sameMode || !fits;
    }
    if (want) {
      this.strain += dt;
      this.calm = 0;
    } else {
      this.calm += dt;
      this.strain = 0;
    }
    const was = this.splitting;
    if (!this.splitting && this.strain > 0.3) this.splitting = true;
    if (this.splitting && this.calm > 0.6) this.splitting = false;
    if (!racing) this.splitting = false;
    // A move starting from rest picks whose view carries on: the one most like the shared view. For
    // the shared chase camera that's whoever is still on the road, else whoever is behind (it looks
    // over their shoulder); for the shared side-on view, whoever is already flying.
    if (this.splitting !== was && (this.split < 0.001 || this.split > 0.999)) {
      const onRoad = targets.map((c) => c.phase === 'race' || c.phase === 'grid');
      const behind = targets[0].s <= targets[1].s ? 0 : 1;
      if (onRoad[0] === onRoad[1]) this.anchor = behind;
      else if (this.shared.mode === 'side') this.anchor = onRoad[0] ? 1 : 0;
      else this.anchor = onRoad[0] ? 0 : 1;
    }
    const speed = 1 / SPLIT_TIME;
    this.split = Math.min(1, Math.max(0, this.split + (this.splitting ? speed : -speed) * dt));
    this.shakeT += dt;
    for (const p of [0, 1] as const) this.shakeAmt[p] *= Math.exp(-6 * dt);
    this.divider.style.left = `${this.dividerX().toFixed(1)}px`;
    this.divider.classList.toggle('on', this.isSplit);
  }

  /** Where the divider is (CSS px from the left): sliding in from the side of the player who isn't
   *  carrying on, to the middle. */
  private dividerX(): number {
    const e = this.ease();
    return this.anchor === 1 ? (this.w / 2) * e : this.w - (this.w / 2) * e;
  }

  private ease(): number {
    const x = this.split;
    return x * x * (3 - 2 * x);
  }

  /** Both cars inside the shared view, within `limit` of the edges in NDC. */
  private bothVisible(targets: ViewTarget[], limit: number): boolean {
    const cam = this.configure(this.camera, this.shared.cur, this.w, this.h, null);
    for (const tg of targets) {
      if (tg.phase !== 'race' && tg.phase !== 'grid') continue;
      this.tmp.copy(tg.pos);
      this.tmp.y += 0.8;
      this.tmp.project(cam);
      if (this.tmp.z > 1 || Math.abs(this.tmp.x) > limit || this.tmp.y > limit || this.tmp.y < -limit - 0.08) return false;
    }
    return true;
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

  /** The pose each half shows right now, and which strip of a full-screen frustum it draws. */
  private panePose(p: 0 | 1): { pose: Pose; offX: number; wp: number } {
    const e = this.ease();
    const wp = this.pane(p).w;
    const own = this.rigs[p].cur;
    if (p !== this.anchor) {
      // Sliding in (or out) from its own side: its finished view, stuck to the divider.
      return { pose: own, offX: p === 0 ? (3 * this.w) / 4 - wp : this.w / 4, wp };
    }
    // Carrying on: the shared view, cropped where the other half comes in, easing into this
    // player's own camera, centred in its half.
    const a = this.shared.cur;
    const pose: Pose = {
      focus: this.tmp2.copy(a.focus).lerp(own.focus, e).clone(),
      yaw: lerpAngle(a.yaw, own.yaw, e),
      pitch: a.pitch + (own.pitch - a.pitch) * e,
      dist: a.dist + (own.dist - a.dist) * e,
    };
    const crop = p === 0 ? 0 : this.w - wp;
    const centred = (this.w - wp) / 2;
    return { pose, offX: crop + (centred - crop) * e, wp };
  }

  /** Whether the screen is (even partly) split. */
  get isSplit(): boolean {
    return this.split > 0.001;
  }

  /** Where each player's view is on screen (the whole screen when not split). */
  pane(p: 0 | 1): Pane {
    if (!this.isSplit) return { x: 0, y: 0, w: this.w, h: this.h };
    const x = this.dividerX();
    return p === 0 ? { x: 0, y: 0, w: x, h: this.h } : { x, y: 0, w: this.w - x, h: this.h };
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
      const { pose, offX, wp } = this.panePose(p);
      const cam = this.configure(this.paneCams[p], pose, w, h, { x: offX, w: Math.max(wp, 1) }, this.shakeAmt[p]);
      if (wp < 0.5) continue;
      const x = this.pane(p).x;
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

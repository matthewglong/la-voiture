// Camera rig: build framing, chase cam, a smooth orbit to the side-on flight view, results hold.
// The pose is an orbit (focus, yaw, pitch, distance) so transitions swing around the action.
import * as THREE from 'three';
import { TRACK, roadHeightAtX } from '../track';
import { damp } from './util';

export type CameraMode = 'build' | 'countdown' | 'chase' | 'stalled' | 'side' | 'results';

export interface CameraTarget {
  pos: THREE.Vector3;
  /** Still in play (on the run-up or in the air). */
  active: boolean;
  inFlight: boolean;
  splashed: boolean;
}

interface Pose {
  focus: THREE.Vector3;
  yaw: number;
  pitch: number;
  dist: number;
}

const DEG = Math.PI / 180;
const sampleY = (x: number): number => roadHeightAtX(TRACK, x);
const CHASE_YAW = Math.PI; // camera behind the cars (-x)
const SIDE_YAW = Math.PI / 2; // camera on the +z side, +x reads left-to-right

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  mode: CameraMode = 'build';
  private cur: Pose;
  private goal: Pose;
  private modeTime = 0;
  private sideFocusX = TRACK.lip.x;
  /** Scratch vector. */
  private readonly tmp = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.cur = this.buildPose(0);
    this.goal = this.buildPose(0);
    this.apply();
  }

  /** Where the camera is looking (used to centre the shadow frustum). */
  get focus(): THREE.Vector3 {
    return this.cur.focus;
  }

  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.modeTime = 0;
    if (mode === 'side' || mode === 'results') {
      this.sideFocusX = Math.max(this.cur.focus.x, TRACK.lip.x - 10);
    }
  }

  /** Jump straight to the goal pose (after a reset). */
  snap(targets: CameraTarget[], t = 0): void {
    this.computeGoal(targets, t, 0);
    this.cur = { focus: this.goal.focus.clone(), yaw: this.goal.yaw, pitch: this.goal.pitch, dist: this.goal.dist };
    this.apply();
  }

  update(dt: number, t: number, targets: CameraTarget[]): void {
    this.modeTime += dt;
    this.computeGoal(targets, t, dt);
    // Slower blend right after a mode change gives the swing its weight.
    let rate = 3.2;
    let angleRate = 3.2;
    if (this.mode === 'countdown') {
      rate = 1.6;
      angleRate = 1.6;
    } else if (this.mode === 'side') {
      angleRate = this.modeTime < 2 ? 1.6 : 2.5;
      rate = this.modeTime < 2 ? 3.5 : 4.5;
    } else if (this.mode === 'results') {
      rate = 1.2;
      angleRate = 1.2;
    } else if (this.mode === 'chase') {
      rate = 4.5;
      angleRate = 3;
    }
    const k = damp(rate, dt);
    const ka = damp(angleRate, dt);
    this.cur.focus.lerp(this.goal.focus, k);
    this.cur.yaw += (this.goal.yaw - this.cur.yaw) * ka;
    this.cur.pitch += (this.goal.pitch - this.cur.pitch) * ka;
    this.cur.dist += (this.goal.dist - this.cur.dist) * ka;
    this.apply();
  }

  private apply(): void {
    const { focus, yaw, pitch, dist } = this.cur;
    const cp = Math.cos(pitch);
    this.camera.position.set(
      focus.x + Math.cos(yaw) * cp * dist,
      focus.y + Math.sin(pitch) * dist,
      focus.z + Math.sin(yaw) * cp * dist,
    );
    this.camera.lookAt(focus);
  }

  private buildPose(t: number): Pose {
    // Both cars on the start line, the street dropping away to the Bay behind them. Far enough
    // back (~16 m to the cars) that turning cars stay in the gap between the two side panels.
    const y = TRACK.startY;
    return {
      focus: new THREE.Vector3(9, y - 1.6, 0),
      yaw: CHASE_YAW + Math.sin(t * 0.07) * 1.2 * DEG,
      pitch: 18.5 * DEG,
      dist: 27,
    };
  }

  private hFovHalf(): number {
    const v = (this.camera.fov * DEG) / 2;
    return Math.atan(Math.tan(v) * this.camera.aspect);
  }

  private computeGoal(targets: CameraTarget[], t: number, dt: number): void {
    const g = this.goal;
    if (this.mode === 'build') {
      const p = this.buildPose(t);
      g.focus.copy(p.focus);
      g.yaw = p.yaw;
      g.pitch = p.pitch;
      g.dist = p.dist;
      return;
    }
    const live = targets.filter((c) => c.active);
    const pool = live.length > 0 ? live : targets;

    if (this.mode === 'countdown' || this.mode === 'chase' || this.mode === 'stalled') {
      // Behind and above the trailing car, looking at a point ahead of the midpoint, so both cars
      // stay in frame as they separate (beyond 45 m the view follows the leader).
      const xs = pool.map((c) => c.pos.x);
      const lead = Math.max(...xs);
      const trailX = Math.max(Math.min(...xs), lead - 45);
      const sep = lead - trailX;
      const trailY = pool.reduce((y, c) => (c.pos.x <= trailX + 0.01 ? c.pos.y : y), pool[0].pos.y);
      const back = (this.mode === 'countdown' ? 13 : 12) + sep * 0.35;
      // Start low enough to pass under the start-line banner (5.6 m up), rise as they separate.
      const up = 4.6 + sep * 0.32;
      const cam = this.tmp.set(trailX - back, Math.max(trailY, sampleY(trailX - back)) + up, 0);
      const midX = (trailX + lead) / 2 + 5;
      // Stalled results: aim below the cars so they sit above the results card.
      g.focus.set(midX, sampleY(midX) + 1.2 - (this.mode === 'stalled' ? 7 : 0), 0);
      const dx = g.focus.x - cam.x;
      const dy = cam.y - g.focus.y;
      g.dist = Math.hypot(dx, dy);
      g.pitch = Math.atan2(dy, dx);
      g.yaw = CHASE_YAW;
      return;
    }

    // Side-on: pan right with the leader; keep the lip and both cars in frame while possible.
    // Cars still on the hill (or stalled there) don't drag the view back up the street.
    const lip = TRACK.lip;
    const flown = targets.filter((c) => c.inFlight || c.splashed);
    // Matches the straggler hand-over in main.ts (55 m of track before the lip), plus a margin.
    const near = targets.filter((c) => c.active && c.pos.x > lip.x - 65);
    const framed = [...new Set([...flown, ...near])];
    const side = framed.length > 0 ? framed : pool;
    const xs = side.map((c) => c.pos.x);
    const ys = side.map((c) => c.pos.y);
    const lead = Math.max(...xs);
    const trail = Math.min(...xs);
    const maxDist = this.mode === 'results' ? 150 : 135;
    const tanH = Math.tan(this.hFovHalf());
    const tanV = Math.tan((this.camera.fov * DEG) / 2);
    const margin = 1.25;
    const widthFor = (x0: number, x1: number): number => ((x1 - x0) / 2 / tanH) * margin;

    let x0 = Math.min(lip.x - 14, trail - 6);
    const x1 = lead + (this.mode === 'results' ? 18 : 32);
    if (widthFor(x0, x1) > maxDist) x0 = Math.min(trail - 6, x1 - 2 * maxDist * tanH / margin);
    if (widthFor(x0, x1) > maxDist) x0 = x1 - (2 * maxDist * tanH) / margin;
    const centerX = (x0 + x1) / 2;
    const top = Math.max(lip.y + 4, ...ys.map((y) => y + 4));
    const heightDist = ((top + 2) / 2 / tanV) * margin;
    const dist = Math.max(52, Math.min(maxDist, Math.max(widthFor(x0, x1), heightDist)));
    const panRate = this.mode === 'results' ? 1.5 : 5;
    this.sideFocusX += (centerX - this.sideFocusX) * damp(panRate, dt || 1 / 60);
    const results = this.mode === 'results';
    // In the results the card sits low on screen, so aim below the water to lift the splashes up.
    g.focus.set(this.sideFocusX, results ? -dist * 0.16 : Math.max(5, top * 0.42), 0);
    g.yaw = SIDE_YAW + (results ? Math.sin(t * 0.15) * 3 * DEG : 0);
    g.pitch = (results ? 13 : 8) * DEG;
    g.dist = dist;
  }
}

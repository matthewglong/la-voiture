// La Voiture: game state machine.
// BUILD -> COUNTDOWN -> RACE (driving; FLIGHT once someone launches) -> RESULTS -> (Rematch -> BUILD) | (New players -> BUILD, reset)
// The event is picked in the garage: a map is an event (the long jump, a race) on a venue (a
// course and its scenery). The map in play decides the course, its scenery, the strip, the splits
// and starts; its mode's rules (map.rules, src/modes.ts) decide how a run is scored and shown.
import './style.css';
import * as THREE from 'three';
import { Sound, type BoostVoice, type EngineKind, type EngineVoice, type HornKind, type SkidVoice, type WindVoice } from './audio';
import {
  allReady,
  cyclePart,
  fitPart,
  hasPartBeyond,
  moneyLeft,
  newGarage,
  openTab,
  randomize,
  removePart,
  setReady,
  stepTab,
  togglePart,
  type Garage,
} from './garage';
import { DriveInput, type PadPress } from './input';
import { MAPS, mapById, type MapDef } from './maps';
import { PARTS, computeStats, getOption } from './parts';
import { Actors } from './scene/actors';
import { buildCarMesh, type CarMesh } from './scene/carMesh';
import { Splashes, Trail } from './scene/effects';
import { Aura, DizzyStars, Particles, SkidMarks } from './scene/fx';
import { mapScene, type MapScene } from './scene/maps';
import { damp, makeRng } from './scene/util';
import { Views, type ViewTarget } from './scene/views';
import { createWorld } from './scene/world';
import { Bot, driveToEnd } from './sim/bot';
import { DT } from './sim/physics';
import { HYPE_BOOST, HYPE_MAX, ITEM_KINDS, RAMP_MIN, RaceSim, type CarInput, type CarResult, type ItemKind, type RaceEvent } from './sim/race';
import { deltaS, pointAt, wrapS } from './track';
import type { CarConfig, CarStats, PlayerIndex, SlotId } from './types';
import { BuildUI, GARAGE_KEYS, type GarageAction, type LastRun, type Training, type TrainStart } from './ui/build';
import { fmtTime } from './ui/format';
import { HUD, ITEM_LABELS, type HudEvent, type HudKeys, type ResultsView } from './ui/hud';

type GameState = 'BUILD' | 'COUNTDOWN' | 'RACE' | 'FLIGHT' | 'RESULTS';

const PLAYER_COLORS: [string, string] = ['#ff5a36', '#2e8bff'];
const DEFAULT_NAMES: [string, string] = ['Player 1', 'Player 2'];
const PLAYERS: PlayerIndex[] = [0, 1];
const COUNT_STEP = 0.85; // seconds per countdown number
const RESULTS_DELAY = 2.6; // seconds after the last car finishes
// Real-time grace periods, so keys still being mashed don't skip a screen.
const RESULTS_KEY_GRACE = 1500; // ms before Enter/Space can leave the results
const READY_KEY_GRACE = 600; // ms before the READY keys work in a fresh garage
const DEG = 180 / Math.PI;

// ---------- URL parameters ----------
const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const seed =
  seedParam !== null && seedParam !== '' && Number.isFinite(Number(seedParam))
    ? Math.floor(Number(seedParam))
    : Math.floor(Math.random() * 2 ** 31);
const parseSpeed = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.max(n, 0.05), 50) : 1;
};
let simSpeed = parseSpeed(params.get('speed') ?? 1);
const autobuild = params.get('autobuild') === '1';
// ?autodrive=1 lets the autopilot drive both cars (tests, demos); ?cpu=1 makes Player 2 a CPU.
const autodriveParam = params.get('autodrive');
const autodrive: [boolean, boolean] = [autodriveParam === '1' || autodriveParam === 'p1', autodriveParam === '1' || autodriveParam === 'p2'];
/** Player 2 driven by the computer (the garage toggle, or ?cpu=1). */
let cpuOn = params.get('cpu') === '1';
/** Racing alone: solo training (the garage toggle, or ?solo=1). Never on at the same time as the CPU. */
let solo = params.get('solo') === '1' && !cpuOn;

/** Sensible builds the CPU picks from, so it's a fair (and varied) rival. */
const CPU_BUILDS: Partial<CarConfig>[] = [
  { chassis: 'kart', wheels: 'standard', engine: 'v8', boost: 'bottle', wing: 'glider', nose: 'wedge', booster: 'rocket' },
  { chassis: 'tub', wheels: 'standard', engine: 'jet', boost: 'bottle', wing: 'none', nose: 'cone', booster: 'rocket' },
  { chassis: 'pickup', wheels: 'monster', engine: 'v8', boost: 'big', wing: 'spoiler', nose: 'blunt', booster: 'none' },
  { chassis: 'sedan', wheels: 'standard', engine: 'v8', boost: 'big', wing: 'spoiler', nose: 'wedge', booster: 'kite' },
  { chassis: 'kart', wheels: 'monster', engine: 'v8', boost: 'big', wing: 'spoiler', nose: 'cone', booster: 'rocket' },
  { chassis: 'tub', wheels: 'tiny', engine: 'v8', boost: 'big', wing: 'glider', nose: 'wedge', booster: 'kite' },
];

const cpuRng = makeRng(seed ^ 0x7f4a7c15);
// Extra test hook: ?wind=-8 pins the wind (m/s, + = tailwind) for every round.
const windParam = params.get('wind');
const fixedWind =
  windParam !== null && windParam !== '' && Number.isFinite(Number(windParam))
    ? Math.min(Math.max(Number(windParam), -8), 8)
    : null;
// ?traffic=0 empties the course (no Waymos, tourists or cable car); ?items=0 removes the boxes.
// (Racing solo, the training panel can change both.)
const trafficOn = params.get('traffic') !== '0';
const itemsOn = params.get('items') !== '0';
const windRng = makeRng(seed);
const buildRng = makeRng(seed ^ 0x5bd1e995);
const worldRng = makeRng(seed ^ 0x2c1b3c6d);

/** The event in play (?map=twin-peaks picks one from the start). */
let map: MapDef = mapById(params.get('map')) ?? MAPS[0];

/** Solo training: where the run starts, whether to race the best run's ghost, and what's on the road. */
const training: Training = { start: 'top', ghost: true, traffic: trafficOn, items: itemsOn };

/** Solo: the best run from each start of each map (the furthest splash, or a race's quickest time):
 *  its car, time and splits, and its ghost (a pose per frame: race time, x, y, z, yaw, pitch, roll,
 *  race progress). */
interface SoloBest {
  /** Distance (the long jump) or time (a race). */
  score: number;
  runTime: number;
  config: CarConfig;
  splits: (number | null)[];
  ghost: Float32Array;
}
const soloBests = new Map<string, SoloBest>();
const soloKey = (start: TrainStart): string => `${map.id}:${start}`;
const GHOST_STRIDE = 8;
/** Is a score better than another (the mode's rules: further in the long jump, quicker in a race). */
const better = (a: number, b: number): boolean => map.rules.better(a, b);
/** Scored on time (a race) rather than on distance (the long jump). */
const timed = (): boolean => map.rules.score === 'time';

/** What the HUD needs to know about the event in play. */
function hudEvent(laps: number): HudEvent {
  const c = map.course;
  return { rules: map.rules, laps, loop: c.loop, goal: map.rules.goal(c), windWhere: map.windWhere, tip: map.tip, warn: map.warn };
}

/** The split points (race progress) for a solo run: the map's, and on a loop every lap's end too. */
function splitsFor(m: MapDef, laps: number): { label: string; s: number }[] {
  const c = m.course;
  if (!c.loop) return m.splits;
  const out: { label: string; s: number }[] = [];
  for (let lap = 1; lap <= laps; lap++) {
    for (const sp of m.splits) out.push({ label: laps > 1 ? `L${lap} ${sp.label}` : sp.label, s: (lap - 1) * c.length + wrapS(c, sp.s - c.startS) });
    if (lap < laps) out.push({ label: `LAP ${lap}`, s: lap * c.length });
  }
  return out;
}
let splits = splitsFor(map, map.laps);

/** Where a point on the course sits on the HUD's strip (0..1): along the course, or round a lap. */
function stripAt(s: number): number {
  const c = map.course;
  return c.loop ? wrapS(c, s - c.startS) / c.length : s / c.length;
}

const graphemes = new Intl.Segmenter();

function cleanName(p: PlayerIndex, raw: string): string {
  // Cut by user-perceived characters, so an emoji (even a flag or a family) is never split.
  const chars = Array.from(graphemes.segment(raw.trim()), (s) => s.segment);
  const name = chars.slice(0, 16).join('').trim();
  return name === '' ? DEFAULT_NAMES[p] : name;
}

const isPlayer = (p: unknown): p is PlayerIndex => p === 0 || p === 1;

function rollWind(): number {
  const rolled = Math.round((windRng() * 16 - 8) * 10) / 10;
  return fixedWind ?? rolled;
}

// ---------- Scene ----------
const app = document.getElementById('app')!;
const sceneHost = document.createElement('div');
sceneHost.className = 'scene-host';
app.appendChild(sceneHost);
const world = createWorld(sceneHost);
const { scene, camera } = world;
/** The map's scenery (swapped when the event changes). */
let scenery: MapScene = mapScene(map, world);
scene.add(scenery.group);
// The start gantry fades out while the chase camera looks through its banner and crossbar.
let gantry: THREE.Object3D | null = null;
const gantryMats: THREE.Material[] = [];
function findGantry(): void {
  gantry = scenery.gantry;
  gantryMats.length = 0;
  gantry?.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      if (gantryMats.includes(mat)) continue;
      mat.transparent = true;
      gantryMats.push(mat);
    }
  });
}
findGantry();
/** Start-gantry fade, per half of the screen (index 0 is also the single screen). */
const gantryOpacity: [number, number] = [1, 1];
const gantryHidden: [boolean, boolean] = [false, false];
const splashes = new Splashes();
scene.add(splashes.group);
const actors = new Actors();
scene.add(actors.group);
const particles = new Particles();
scene.add(particles.mesh);
const skids = new SkidMarks();
scene.add(skids.mesh);

// ---------- UI root (the split divider lives in it) ----------
const overlay = document.createElement('div');
overlay.className = 'overlay';
app.appendChild(overlay);
const views = new Views(camera, overlay, map.course);

// ---------- Cars ----------
function configKey(c: CarConfig): string {
  return Object.values(c).join('|');
}

const HORNS: Record<string, HornKind> = { kart: 'kart', tub: 'tub', sedan: 'sedan', pickup: 'pickup' };

class CarView {
  readonly p: PlayerIndex;
  /** World position and heading. */
  readonly root = new THREE.Group();
  /** Pitch and roll. */
  readonly tilt = new THREE.Group();
  /** Turntable yaw and bump hops. */
  readonly holder = new THREE.Group();
  mesh: CarMesh | null = null;
  key = '';
  wheelAngle = 0;
  pitch = 0;
  roll = 0;
  hopY = 0;
  hopV = 0;
  /** Squash (−) and stretch (+) of the body on its springs: a jump stretches it, a landing squashes. */
  squash = 0;
  squashV = 0;
  yaw = 0;
  splashT = -1;
  nitro = 0;
  /** Boost flame level (eases in and out). */
  boostFlame = 0;
  readonly trail: Trail;
  readonly stars = new DizzyStars();
  readonly aura = new Aura();
  engine: EngineVoice | null = null;
  wind: WindVoice | null = null;
  skid: SkidVoice | null = null;
  boostVoice: BoostVoice | null = null;
  horn: HornKind = 'kart';
  lastScrape = 0;
  rouletteTick = 0;
  /** One-off hints this race (the Lombard shortcut, the slipstream). */
  hinted = new Set<string>();
  draftTime = 0;

  constructor(p: PlayerIndex) {
    this.p = p;
    this.root.add(this.tilt);
    this.tilt.add(this.holder);
    this.root.rotation.order = 'YXZ';
    this.trail = new Trail(PLAYER_COLORS[p]);
    scene.add(this.root, this.trail.mesh, this.stars.group, this.aura.mesh);
  }

  setConfig(cfg: CarConfig): void {
    const k = configKey(cfg);
    if (k === this.key) return;
    this.key = k;
    if (this.mesh) {
      this.holder.remove(this.mesh.group);
      this.mesh.dispose();
    }
    this.mesh = buildCarMesh(cfg, { accent: PLAYER_COLORS[this.p] });
    this.holder.add(this.mesh.group);
    this.horn = HORNS[getOption('chassis', cfg.chassis).id] ?? 'kart';
  }

  placeAtStart(): void {
    const slot = map.course.grid[this.p];
    const p = pointAt(map.course, slot.s);
    this.root.position.set(p.x - p.tz * slot.d, p.y, p.z + p.tx * slot.d);
    this.root.rotation.set(0, -p.heading, 0);
    this.tilt.rotation.set(0, 0, 0);
    this.pitch = 0;
    this.roll = 0;
    this.holder.position.set(0, 0, 0);
    this.hopY = 0;
    this.hopV = 0;
    this.squash = 0;
    this.squashV = 0;
    this.holder.scale.set(1, 1, 1);
    this.splashT = -1;
    this.nitro = 0;
    this.boostFlame = 0;
    // Racing solo, Player 2's car stays in the garage.
    this.root.visible = !(solo && this.p === 1);
    this.mesh?.setKiteOpen(false);
    this.mesh?.setThrottle(0);
    this.mesh?.setNitro(0);
    this.mesh?.setBoost(0);
    // Glider wings show spread in the garage; they fold for the run at the countdown.
    this.mesh?.setWingsOpen(true, true);
  }

  stopAudio(): void {
    this.engine?.stop();
    this.engine = null;
    this.wind?.stop();
    this.wind = null;
    this.skid?.stop();
    this.skid = null;
    this.boostVoice?.stop();
    this.boostVoice = null;
  }
}

const cars: [CarView, CarView] = [new CarView(0), new CarView(1)];

/** Solo: a see-through replay of the best run from this start, raced alongside you. */
class GhostCar {
  readonly root = new THREE.Group();
  private readonly tilt = new THREE.Group();
  private mesh: CarMesh | null = null;
  private key = '';
  private frames: Float32Array | null = null;
  private i = 0;
  private static readonly MAT = new THREE.MeshStandardMaterial({
    color: '#dcefff',
    emissive: '#5fa8ff',
    emissiveIntensity: 0.45,
    roughness: 0.5,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });

  constructor() {
    this.root.add(this.tilt);
    this.root.rotation.order = 'YXZ';
    this.root.visible = false;
    scene.add(this.root);
  }

  /** Race this best run's ghost (null: no ghost). */
  load(best: SoloBest | null): void {
    this.frames = best ? best.ghost : null;
    this.i = 0;
    this.root.visible = false;
    if (!best) return;
    const k = configKey(best.config);
    if (k === this.key) return;
    this.key = k;
    this.mesh?.dispose();
    this.mesh = buildCarMesh(best.config, { accent: '#5fa8ff' });
    this.mesh.setWingsOpen(false, true);
    this.mesh.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = GhostCar.MAT;
      m.castShadow = false;
      m.receiveShadow = false;
      m.renderOrder = 4;
    });
    this.tilt.add(this.mesh.group);
  }

  /** Put the ghost where the best run was at race time t; returns its course progress (or null
   *  once it has splashed down, before it starts, or with no ghost). */
  update(t: number): number | null {
    const f = this.frames;
    const n = f ? f.length / GHOST_STRIDE : 0;
    if (!f || n < 2 || t > f[(n - 1) * GHOST_STRIDE]) {
      this.root.visible = false;
      return null;
    }
    // Waiting on the grid through the countdown.
    t = Math.max(t, f[0]);
    // Walk the cursor to the frame at or before t (runs forward; restarts after a retry).
    if (this.i >= n - 1 || f[this.i * GHOST_STRIDE] > t) this.i = 0;
    while (this.i < n - 2 && f[(this.i + 1) * GHOST_STRIDE] <= t) this.i++;
    const a = this.i * GHOST_STRIDE;
    const b = a + GHOST_STRIDE;
    const u = Math.min(1, Math.max(0, (t - f[a]) / Math.max(1e-6, f[b] - f[a])));
    const lerp = (k: number): number => f[a + k] + (f[b + k] - f[a + k]) * u;
    let dyaw = f[b + 4] - f[a + 4];
    dyaw -= Math.round(dyaw / (Math.PI * 2)) * Math.PI * 2;
    this.root.position.set(lerp(1), lerp(2), lerp(3));
    this.root.rotation.y = f[a + 4] + dyaw * u;
    this.tilt.rotation.set(lerp(6), 0, lerp(5), 'YXZ');
    this.root.visible = true;
    return lerp(7);
  }

  hide(): void {
    this.root.visible = false;
  }
}

const ghost = new GhostCar();
/** Solo: this run's ghost frames (race time, x, y, z, yaw, pitch, roll, course progress), split
 *  times, and the next split to cross. */
let ghostRec: number[] = [];
let splitTimes: (number | null)[] = [];
let nextSplit = 0;
/** Solo: the world seed of this run, so a retry meets the same traffic. */
let runSeed = 0;

// ---------- Game state ----------
const sound = new Sound();
const input = new DriveInput();
let state: GameState = 'BUILD';
let names: [string, string] = [...DEFAULT_NAMES];
let round = 1;
let wind = rollWind();
let garage: Garage = newGarage([null, null]);
/** The part each player is hovering, previewed on their car (null: the fitted car). */
const previews: [CarConfig | null, CarConfig | null] = [null, null];
let lastConfigs: [CarConfig | null, CarConfig | null] = [null, null];
let lastRuns: [LastRun | null, LastRun | null] = [null, null];
let wins: [number, number] = [0, 0];
/** performance.now() when the garage and the results card last appeared. */
let garageAt = 0;
let resultsAt = 0;
let sim: RaceSim | null = null;
let bots: [Bot | null, Bot | null] = [null, null];
let raceConfigs: [CarConfig, CarConfig] | null = null;
let raceStats: [CarStats, CarStats] | null = null;
let accumulator = 0;
let stateTime = 0;
let doneTime = -1;
let countIndex = -1;
let gameClock = 0;
let firstLaunchSeen = false;
let results: Record<string, unknown> | null = null;
/** Behind a race's results, the camera follows this car's cool-down lap (the winner's). */
let resultsFocus: PlayerIndex | null = null;
/** Each map's session best: the furthest jump, or a race's fastest lap (in `distance`). */
const sessionBests = new Map<string, { distance: number; name: string; player: PlayerIndex; round: number }>();
const eventLog: { t: number; player: PlayerIndex; event: RaceEvent }[] = [];
/** Scripted inputs from the test hooks (override the keys for that player). */
const scripted: [CarInput | null, CarInput | null] = [null, null];

// ---------- UI ----------
const buildUI = new BuildUI(overlay, {
  onPart: (p, slot, id) => {
    if (state !== 'BUILD' || (p === 1 && (cpuOn || solo)) || !togglePart(garage, p, slot, id)) return;
    sound.click();
    renderBuild();
  },
  onDenied: () => sound.deny(),
  onTab: (p, slot) => {
    if (state !== 'BUILD' || !openTab(garage, p, slot)) return;
    sound.click();
    renderBuild();
  },
  onReady: (p) => toggleReady(p),
  onHover: (p, cfg) => {
    previews[p] = cfg;
    if (state === 'BUILD') refreshCars();
  },
  onName: (p, name) => {
    names[p] = cleanName(p, name);
    renderBuild();
  },
  onCpu: () => {
    if (state !== 'BUILD') return;
    sound.click();
    setCpu(!cpuOn);
  },
  onSolo: () => {
    if (state !== 'BUILD') return;
    sound.click();
    setSolo(!solo);
  },
  onTraining: (change) => {
    if (state !== 'BUILD') return;
    sound.click();
    Object.assign(training, change);
    renderBuild();
  },
  onMap: (id) => {
    if (state !== 'BUILD' || id === map.id) return;
    sound.click();
    setMap(id);
  },
});
const hud = new HUD(overlay);
hud.setStrip(map.strip.map((m) => ({ label: m.label, at: stripAt(m.s) })));
const fade = document.createElement('div');
fade.className = 'fade';
overlay.appendChild(fade);
/** Jump the camera to its current goal behind a short white fade (no flying through houses). */
function cutCamera(): void {
  views.snap(camTargets, 0);
  fade.classList.remove('go', 'quick');
  void fade.offsetWidth;
  fade.classList.add('go');
}

const muteBtn = document.createElement('button');
muteBtn.className = 'mute';
muteBtn.id = 'mute-btn';
overlay.appendChild(muteBtn);
const renderMute = (): void => {
  muteBtn.textContent = sound.muted ? '🔇 SOUND OFF · M' : '🔊 SOUND ON · M';
  muteBtn.classList.toggle('muted', sound.muted);
  muteBtn.dataset.muted = String(sound.muted);
};
muteBtn.addEventListener('click', () => {
  sound.unlock();
  sound.toggleMute();
});
sound.onMuteChange(renderMute);
renderMute();

function renderBuild(): void {
  const bests: Partial<Record<TrainStart, number>> = {};
  for (const st of map.starts) {
    const b = soloBests.get(soloKey(st.id));
    if (b) bests[st.id] = b.score;
  }
  buildUI.render({
    garage,
    names,
    colors: PLAYER_COLORS,
    wind,
    round,
    lastRuns,
    cpu: [false, cpuOn],
    solo,
    training,
    soloBests: bests,
    pads: [input.usingPad[0], input.usingPad[1]],
    map,
    maps: MAPS,
  });
}

/**
 * Switch the event (in the garage): the new map's scenery, course, strip and starts, and nobody
 * is READY any more (a car built for one event may not suit the other).
 */
function setMap(id: string): boolean {
  const next = mapById(id);
  if (!next || state !== 'BUILD') return false;
  if (next.id === map.id) return true;
  scene.remove(scenery.group);
  map = next;
  scenery = mapScene(map, world);
  scene.add(scenery.group);
  findGantry();
  gantryOpacity[0] = gantryOpacity[1] = 1;
  gantryHidden[0] = gantryHidden[1] = false;
  views.setCourse(map.course);
  hud.setStrip(map.strip.map((m) => ({ label: m.label, at: stripAt(m.s) })));
  splits = splitsFor(map, map.laps);
  if (!map.starts.some((q) => q.id === training.start)) training.start = map.starts[0].id;
  for (const p of PLAYERS) if (!(p === 1 && cpuOn)) setReady(garage, p, false);
  showBestInWater();
  clearScene();
  refreshCars();
  renderBuild();
  views.snap(camTargets, 0);
  cutCamera();
  return true;
}

/** The CPU picks one of its builds (and a paint and topper) for Player 2's car. */
function cpuBuild(): void {
  const b = garage.builds[1];
  b.ready = false;
  const pick = CPU_BUILDS[Math.floor(cpuRng() * CPU_BUILDS.length)];
  for (const slot of Object.keys(b.config) as SlotId[]) b.config[slot] = PARTS[slot][0].id;
  b.config.paint = PARTS.paint[Math.floor(cpuRng() * PARTS.paint.length)].id;
  b.config.topper = PARTS.topper[Math.floor(cpuRng() * PARTS.topper.length)].id;
  for (const [slot, id] of Object.entries(pick) as [SlotId, string][]) fitPart(garage, 1, slot, id);
}

/** Player 2's own car and name, kept while the CPU borrows the seat. */
let p2Saved: { config: CarConfig; name: string } | null = null;

function setCpu(on: boolean): void {
  if (on === cpuOn) return;
  if (on && solo) setSolo(false);
  cpuOn = on;
  if (on) {
    p2Saved = { config: { ...garage.builds[1].config }, name: names[1] };
    cpuBuild();
    names[1] = 'CPU';
  } else {
    garage.builds[1].ready = false;
    if (p2Saved) {
      garage.builds[1].config = { ...p2Saved.config };
      names[1] = p2Saved.name;
    } else if (names[1] === 'CPU') names[1] = DEFAULT_NAMES[1];
    p2Saved = null;
  }
  previews[1] = null;
  refreshCars();
  renderBuild();
  if (on && garage.builds[0].ready) startCountdown();
}

/** Racing alone: Player 2's car stays home and their panel becomes the training settings. */
function setSolo(on: boolean): void {
  if (on === solo) return;
  if (on && cpuOn) setCpu(false);
  solo = on;
  views.solo = on;
  garage.builds[1].ready = false;
  previews[1] = null;
  cars[1].root.visible = !on;
  refreshCars();
  renderBuild();
  if (on && garage.builds[0].ready) startCountdown();
}

/** Show each player's fitted car, or the part they are hovering. */
function refreshCars(): void {
  for (const p of PLAYERS) cars[p].setConfig(previews[p] ?? garage.builds[p].config);
}

/** READY locks a player's car in; the race starts as soon as both players are ready (the CPU always is). */
function toggleReady(p: PlayerIndex, ready = !garage.builds[p].ready): boolean {
  if (state !== 'BUILD' || (p === 1 && (cpuOn || solo)) || !setReady(garage, p, ready)) return false;
  sound.readyChime(ready);
  renderBuild();
  if (allReady(garage) || ((cpuOn || solo) && garage.builds[0].ready)) startCountdown();
  return true;
}

function garageKey(p: PlayerIndex, action: GarageAction, repeat: boolean): void {
  if (p === 1 && (cpuOn || solo)) return;
  // Keys win over a mouse preview on the same car, so the change shows at once.
  buildUI.endPreview(p);
  if (action === 'ready') {
    // The key that left the results screen mustn't also ready a player in the fresh garage.
    if (!repeat && performance.now() - garageAt >= READY_KEY_GRACE) toggleReady(p);
    return;
  }
  const dir = action === 'nextTab' || action === 'nextPart' ? 1 : -1;
  const isTab = action === 'prevTab' || action === 'nextTab';
  if (isTab ? stepTab(garage, p, dir) : cyclePart(garage, p, dir)) {
    sound.click();
    renderBuild();
  } else if (!isTab && !repeat && !garage.builds[p].ready && hasPartBeyond(garage, p, dir)) {
    // Every part that way costs too much: the same feedback as clicking a locked card.
    sound.deny();
    buildUI.deny(p);
  }
}

/** Enter the garage with last race's cars (or the free build), keeping each player's open tab. */
function enterBuild(tabs?: [SlotId, SlotId]): void {
  state = 'BUILD';
  stateTime = 0;
  sim = null;
  bots = [null, null];
  raceConfigs = null;
  raceStats = null;
  results = null;
  resultsFocus = null;
  firstLaunchSeen = false;
  garage = newGarage(lastConfigs, tabs);
  garageAt = performance.now();
  scripted[0] = scripted[1] = null;
  if (autobuild) for (const p of PLAYERS) randomize(garage, p, buildRng);
  // The CPU picks a fresh build every round (so the rival keeps you guessing).
  if (cpuOn) {
    cpuBuild();
    if (names[1] === DEFAULT_NAMES[1]) names[1] = 'CPU';
  }
  previews[0] = previews[1] = null;
  clearScene();
  ghost.hide();
  refreshCars();
  views.setMode('build');
  hud.hideResults();
  hud.show(false);
  hud.showCountdown(null);
  hud.showHelp(false);
  hud.hideTags();
  buildUI.show(true);
  renderBuild();
}

/** Stop the cars' sounds and clear the last race off the course (trails, splashes, skids, the cast). */
function clearScene(): void {
  for (const c of cars) {
    c.stopAudio();
    c.trail.clear();
    c.placeAtStart();
  }
  splashes.clear();
  particles.clear();
  skids.clear();
  actors.reset();
}

/** The players with a car in this race (racing solo, only Player 1). */
function racers(): PlayerIndex[] {
  return solo ? [0] : PLAYERS;
}

/** The controls card's key chips for a player. */
function helpKeys(p: PlayerIndex): { label: string; keys: string }[] {
  const k = input.labels(p);
  return [
    { keys: k.throttle, label: 'go' },
    { keys: k.brake, label: 'brake' },
    { keys: k.steer, label: 'steer' },
    { keys: k.boost, label: 'boost' },
    { keys: k.item, label: 'item' },
    { keys: k.swap, label: 'swap items' },
  ];
}

function hudKeys(p: PlayerIndex): HudKeys {
  const k = input.labels(p);
  return { item: k.item, swap: k.swap, boost: k.boost };
}

function startCountdown(): boolean {
  if (state !== 'BUILD') return false;
  raceConfigs = [{ ...garage.builds[0].config }, { ...garage.builds[1].config }];
  // A fresh world each round: traffic, tourists and the cable car are placed by the round's seed.
  runSeed = Math.floor(worldRng() * 2 ** 31);
  beginRun();
  // A solo run from further down: jump the camera there rather than fly it through the houses.
  if (solo && training.start !== 'top') cutCamera();
  return true;
}

/** Solo: the same car from the same start again, straight away (same wind, same traffic). */
function retry(): boolean {
  if (!solo || !raceConfigs || state === 'BUILD') return false;
  clearScene();
  hud.hideResults();
  beginRun();
  cutCamera();
  return true;
}

/** Solo: abandon the run and go back to the garage (a new wind, as after any race). */
function toGarage(): boolean {
  if (!solo || state === 'BUILD') return false;
  round++;
  wind = rollWind();
  enterBuild([garage.builds[0].tab, garage.builds[1].tab]);
  cutCamera();
  return true;
}

/** Put the cars on the grid (or, solo, at the chosen start) and count down. */
function beginRun(): void {
  const configs = raceConfigs!;
  resultsFocus = null;
  raceStats = [computeStats(configs[0]), computeStats(configs[1])];
  previews[0] = previews[1] = null;
  for (const p of PLAYERS) cars[p].setConfig(configs[p]);
  const obstacles = solo ? training.traffic : trafficOn;
  const items = solo ? training.items : itemsOn;
  sim = new RaceSim(solo ? [raceStats[0]] : raceStats, wind, { seed: runSeed, obstacles, items }, map);
  splits = splitsFor(map, sim.laps);
  if (solo) {
    const start = map.starts.find((q) => q.id === training.start)?.s ?? null;
    if (start !== null) sim.placeStart(0, start);
  }
  // The car views stand where the sim put the cars (racing solo, one car in the middle of the road).
  for (const p of racers()) {
    const sc = sim.cars[p];
    cars[p].root.position.set(sc.x, sc.y, sc.z);
    cars[p].root.rotation.y = -sc.heading;
  }
  cars[1].root.visible = !solo;
  bots = [
    autodrive[0] ? new Bot(sim, 0, { aggression: 0.3, drift: true }) : null,
    !solo && (autodrive[1] || cpuOn) ? new Bot(sim, 1, { aggression: 0.5, skill: 0.97, drift: true }) : null,
  ];
  // Solo: record this run for its ghost, time it at the splits, and race the best run's ghost.
  ghostRec = [];
  splitTimes = splits.map(() => null);
  nextSplit = 0;
  while (nextSplit < splits.length && splits[nextSplit].s <= sim.cars[0].prog + 1) nextSplit++;
  ghost.load(solo && training.ghost ? (soloBests.get(soloKey(training.start)) ?? null) : null);
  // Alone at the keyboard (against the CPU, or solo), Player 1 drives on the arrows.
  input.single = solo || cpuOn;
  input.clear();
  accumulator = 0;
  eventLog.length = 0;
  for (const c of cars) {
    c.hinted.clear();
    c.draftTime = 0;
  }
  state = 'COUNTDOWN';
  stateTime = 0;
  countIndex = -1;
  buildUI.show(false);
  hud.setup(names, PLAYER_COLORS, wind, [bots[0] ? null : hudKeys(0), bots[1] ? null : hudKeys(1)], solo, hudEvent(sim.laps));
  hud.showCars(true);
  hud.show(true);
  const soloItems: ItemKind[] = ITEM_KINDS.filter((k) => k !== 'poo' && k !== 'gull');
  hud.showHelp(true, [bots[0] ? null : helpKeys(0), bots[1] ? null : helpKeys(1)], PLAYER_COLORS, names, {
    solo,
    items: solo ? soloItems : undefined,
  });
  for (const c of cars) c.mesh?.setWingsOpen(false);
  views.solo = solo;
  views.setMode('chase');
  actors.reset();
  actors.update(0, 0, sim);
  // Starting further down the course: the camera jumps there (behind a quick fade).
  for (const p of PLAYERS) {
    camTargets[p].pos.copy(cars[p].root.position);
    camTargets[p].s = sim.cars[p]?.s ?? map.course.grid[p].s;
    camTargets[p].prog = sim.cars[p]?.prog ?? 0;
    camTargets[p].speed = 0;
    camTargets[p].phase = 'grid';
  }
}

function startRace(): void {
  if (!sim || !raceConfigs) return;
  for (const e of sim.start()) handleEvent(e);
  state = 'RACE';
  stateTime = 0;
  doneTime = -1;
  firstLaunchSeen = false;
  hud.showHelp(false);
  for (const p of racers()) {
    const kind = getOption('engine', raceConfigs[p].engine).id as EngineKind;
    const pan = p === 0 ? -0.45 : 0.45;
    cars[p].engine = sound.engine(kind, pan);
    cars[p].skid = sound.skid(pan);
    cars[p].boostVoice = sound.boost(pan);
  }
}

// ---------- Race events: sound, flashes and effects ----------
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

function carPos(p: PlayerIndex): THREE.Vector3 {
  return cars[p].root.position;
}

/** Shout a word over a player's car on their part of the screen (not for a speck on the horizon). */
function shoutAt(p: PlayerIndex, text: string): void {
  const out = { x: 0, y: 0, vis: false };
  const pane = views.isSplit ? p : 0;
  tmpV.copy(carPos(p));
  tmpV.y += 3.2;
  views.project(pane as 0 | 1, tmpV, out);
  if (!out.vis || out.y < views.pane(pane).h * 0.22) return;
  hud.shout(p, text, PLAYER_COLORS[p]);
}

const HIT_TEXT: Record<string, string> = {
  waymo: "WAYMO'D!",
  cable: 'CABLE CAR!',
  ped: 'TOURIST!',
  poo: 'SPLAT!',
  cone: 'CONE!',
};

/** Buzz a player's pad (not the CPU's). */
function rumble(p: PlayerIndex, strong: number, weak: number, ms: number): void {
  if (!bots[p] && !scripted[p]) input.rumble(p, strong, weak, ms);
}

function handleEvent(e: RaceEvent): void {
  if ('p' in e) eventLog.push({ t: gameClock, player: e.p, event: e });
  const now = gameClock;
  switch (e.type) {
    case 'go':
      break;
    case 'rocket': {
      const c = cars[e.p];
      sound.rocket(e.p === 0 ? -0.45 : 0.45, e.good);
      if (e.good) {
        rumble(e.p, 0.3, 0.8, 250);
        hud.flash(e.p, 'rocket', 'ROCKET START!', 'good', now, 2.2);
        particles.puff(tmpV.copy(c.root.position), 8, '#f4f1ea', 0.6);
        shoutAt(e.p, 'ROCKET START!');
      } else hud.flash(e.p, 'rocket', 'BOGGED DOWN', 'hit', now, 2);
      break;
    }
    case 'bump': {
      const c = cars[e.p];
      c.hopV = 2.2 + Math.min(3, Math.hypot(sim!.cars[e.p].vx, sim!.cars[e.p].vz) / 12);
      sound.thump(e.p === 0 ? -0.45 : 0.45);
      break;
    }
    case 'drift':
      sound.chirp(e.p === 0 ? -0.45 : 0.45);
      break;
    case 'driftEnd': {
      // A drift that banked some boost says so (a full bottle banks nothing: spend some first).
      const cap = raceStats?.[e.p].boostCap ?? 0;
      if (e.gain > 0.12 && cap > 0) hud.flash(e.p, 'drift', `DRIFT +${Math.round((e.gain / cap) * 100)}% BOOST`, 'boost', now, 1.6);
      else if (e.time > 0.8 && (sim?.cars[e.p]?.boostFrac ?? 0) > 0.99) hud.flash(e.p, 'drift', 'BOOST FULL · use it!', 'boost', now, 1.6);
      break;
    }
    case 'boostEmpty':
      sound.sputter(e.p === 0 ? -0.45 : 0.45);
      hud.flash(e.p, 'empty', 'BOOST EMPTY', 'empty', now, 1.4);
      break;
    case 'boostGain': {
      const pan = e.p === 0 ? -0.45 : 0.45;
      if (e.amount <= 0) {
        hud.flash(e.p, 'use', 'BOOST ALREADY FULL', 'item', now, 1.4);
        break;
      }
      sound.refill(pan, e.full);
      hud.flash(e.p, 'use', e.full ? '🌟 FULL BOOST!' : '⚡ BOOST TOP-UP!', 'boost', now, 1.8);
      if (e.full) shoutAt(e.p, 'FULL BOOST!');
      particles.confetti(tmpV.copy(carPos(e.p)).setY(carPos(e.p).y + 1.2), e.full ? 16 : 8);
      break;
    }
    case 'swap':
      sound.click();
      break;
    case 'gull': {
      const pan = e.p === 0 ? -0.45 : 0.45;
      sound.squawk(pan);
      if (e.shooed) {
        hud.flash(e.p, 'gull', 'SHOOED THE SEAGULL!', 'good', now, 1.8);
        shoutAt(e.p, 'SHOO!');
        particles.confetti(tmpV.set(e.x, e.y, e.z), 10);
      } else {
        hud.flash(e.p, 'gull', `🐦 SEAGULL! (from ${names[e.by]})`, 'hit', now, 2);
        shoutAt(e.p, 'SEAGULL!');
        views.shake(e.p, 0.35);
        particles.puff(tmpV.set(e.x, e.y, e.z), 10, '#ffffff', 0.35, 0.8);
        if (e.by !== e.p) hud.flash(e.by, 'gull-hit', 'SEAGULL LANDED!', 'hype', now, 2);
      }
      break;
    }
    case 'takeoff':
      break;
    case 'land': {
      const c = cars[e.p];
      if (e.impact > 2.5) sound.thump(e.p === 0 ? -0.45 : 0.45);
      if (e.impact > 4) views.shake(e.p, Math.min(0.8, e.impact / 14));
      if (e.impact > 2.5) rumble(e.p, Math.min(1, e.impact / 12), 0.4, 120 + Math.min(200, e.impact * 15));
      if (e.impact > 3) particles.puff(tmpV.copy(c.root.position), 6 + Math.min(10, e.impact), '#e8e4dc', 0.55);
      if (e.air > 0.5) particles.ring(tmpV.copy(c.root.position).setY(c.root.position.y + 0.15), 14, '#ece8df', 3 + Math.min(4, e.impact * 0.5));
      c.squashV -= Math.min(4.5, 0.8 + e.impact * 0.35);
      if (e.air > 0.45) hud.flash(e.p, 'air', `AIR ${e.air.toFixed(1)}s`, 'air', now, 1.6);
      break;
    }
    case 'wall': {
      const c = cars[e.p];
      if (e.impact > 5) views.shake(e.p, Math.min(0.9, e.impact / 12));
      if (e.impact > 3 && gameClock - c.lastScrape > 0.18) rumble(e.p, Math.min(1, e.impact / 10), 0.5, 140);
      // Straight into the tyres at a corner: show how to get round it.
      if (e.impact > 7 && !bots[e.p] && !c.hinted.has('drift') && sim && sim.cars[e.p].s < (map.hints.driftUntil ?? Infinity)) {
        c.hinted.add('drift');
        hud.flash(e.p, 'hint', `TAP ${input.labels(e.p).brake} WHILE TURNING TO DRIFT!`, 'boost', now, 3.2);
      }
      if (gameClock - c.lastScrape > 0.18) {
        c.lastScrape = gameClock;
        sound.scrape(e.p === 0 ? -0.45 : 0.45, e.impact);
        particles.sparks(tmpV.set(e.x, e.y, e.z), tmpV2.set(0, 0, 0), Math.min(14, 3 + Math.round(e.impact)));
      }
      break;
    }
    case 'shove': {
      sound.bonk(0, e.impact / 6);
      views.shake(e.p, Math.min(1, e.impact / 10));
      views.shake(e.victim, Math.min(1.2, e.impact / 7));
      rumble(e.p, Math.min(0.7, e.impact / 10), 0.4, 150);
      rumble(e.victim, Math.min(1, e.impact / 6), 0.6, 220);
      particles.sparks(tmpV.set(e.x, e.y, e.z), tmpV2.set(0, 0, 0), Math.min(20, 5 + Math.round(e.impact * 2)));
      if (e.impact > 3 && e.ram !== 'none') {
        const word = e.ram === 'grit' ? 'POWERED THROUGH!' : e.ram === 'bull' ? 'BULL BAR!' : e.ram === 'wedge' ? 'SCOOPED!' : 'SHOVE!';
        hud.flash(e.p, 'shove', word, 'good', now, 1.8);
        hud.flash(e.victim, 'shoved', 'SHOVED!', 'hit', now, 1.8);
        shoutAt(e.p, word);
      }
      break;
    }
    case 'hit': {
      const pan = e.p === 0 ? -0.45 : 0.45;
      rumble(e.p, e.what === 'cone' ? 0.15 : Math.min(1, 0.4 + e.impact / 8), 0.6, e.what === 'cone' ? 80 : 300);
      if (e.what === 'waymo' || e.what === 'cable') {
        sound.crunch(pan, e.impact / 6);
        views.shake(e.p, Math.min(1.2, e.impact / 6));
        if (e.what === 'waymo') sound.robotChime(pan);
        else sound.bell(pan);
        particles.sparks(tmpV.set(e.x, e.y, e.z), tmpV2.set(0, 0, 0), 12);
      } else if (e.what === 'ped') sound.whoa(pan);
      else if (e.what === 'poo') {
        sound.splat(pan);
        particles.splat(tmpV.set(e.x, e.y + 0.3, e.z));
        views.shake(e.p, 0.55);
      } else if (e.what === 'cone') sound.tock(pan);
      if (e.plowed) {
        hud.flash(e.p, 'plowed', 'POWERED THROUGH!', 'good', now, 2);
        shoutAt(e.p, 'POWERED THROUGH!');
        particles.confetti(tmpV.set(e.x, e.y, e.z), 18);
      } else if (e.what !== 'cone' && e.what !== 'poo') {
        hud.flash(e.p, `hit-${e.what}`, HIT_TEXT[e.what], 'hit', now, 2);
        shoutAt(e.p, HIT_TEXT[e.what]);
      }
      break;
    }
    case 'nearMiss':
      sound.whoosh(e.p === 0 ? -0.45 : 0.45);
      hud.flash(e.p, 'near', 'NEAR MISS!', 'hype', now, 1.4);
      break;
    case 'overtake':
      hud.flash(e.p, 'overtake', 'OVERTAKE!', 'hype', now, 1.8);
      shoutAt(e.p, 'OVERTAKE!');
      particles.confetti(tmpV.copy(carPos(e.p)).setY(carPos(e.p).y + 1.5), 14);
      break;
    case 'box':
      sound.itemBox(e.p === 0 ? -0.45 : 0.45);
      particles.confetti(tmpV.copy(carPos(e.p)).setY(carPos(e.p).y + 1.2), 10);
      if (!e.got) hud.flash(e.p, 'box', 'HANDS FULL', 'item', now, 1);
      break;
    case 'item':
      sound.itemReady(e.p === 0 ? -0.45 : 0.45);
      hud.flash(e.p, 'item', `GOT ${ITEM_LABELS[e.item]}!`, 'item', now, 1.8);
      break;
    case 'use': {
      const pan = e.p === 0 ? -0.45 : 0.45;
      const c = cars[e.p];
      if (e.item === 'jump') {
        sound.boing(pan, (raceStats?.[e.p].mass ?? 0) > 1000);
        particles.ring(tmpV.copy(c.root.position).setY(c.root.position.y + 0.15), 20, '#ece8df', 6);
        particles.puff(tmpV.copy(c.root.position), 8, '#e8e4dc', 0.5);
        c.squashV += 3.4;
        hud.flash(e.p, 'use', 'BOING!', 'item', now, 1.2);
        shoutAt(e.p, 'BOING!');
      } else if (e.item === 'grit') {
        sound.grit(pan);
        hud.flash(e.p, 'use', 'DETERMINED!', 'good', now, 2);
        shoutAt(e.p, 'DETERMINED!');
      } else if (e.item === 'poo') {
        sound.plop(pan);
        hud.flash(e.p, 'use', 'POO DROPPED', 'item', now, 1.4);
      } else if (e.item === 'gull') {
        sound.squawk(pan);
        hud.flash(e.p, 'use', 'SEAGULL AWAY!', 'item', now, 1.4);
      }
      // (The boost refills speak through their boostGain event.)
      break;
    }
    case 'honk':
      sound.horn(cars[e.p].horn, e.p === 0 ? -0.45 : 0.45);
      break;
    case 'spinout': {
      rumble(e.p, 0.6, 0.9, 450);
      hud.flash(e.p, 'spin-out', e.by !== null ? `SPUN BY ${names[e.by].toUpperCase()}'S POO!` : 'SPUN OUT!', 'hit', now, 2.2);
      shoutAt(e.p, 'SPUN OUT!');
      if (e.by !== null) hud.flash(e.by, 'poo-hit', 'POO LANDED!', 'hype', now, 2);
      break;
    }
    case 'shortcut': {
      const hop = map.hints.hedgeHop;
      const lomb = !!hop && e.s > hop[0] && e.s < hop[1];
      const word = lomb ? 'HEDGE HOP!' : 'SHORTCUT!';
      hud.flash(e.p, 'shortcut', `${word} +${Math.round(e.gained)} m`, 'hype', now, 2.2);
      shoutAt(e.p, word);
      particles.confetti(tmpV.copy(carPos(e.p)), 20);
      break;
    }
    case 'hype':
      if (e.amount >= 4) sound.hype(e.p === 0 ? -0.45 : 0.45, e.amount);
      break;
    case 'rescue':
      hud.flash(e.p, 'rescue', 'BACK ON TRACK', 'item', now, 1.6);
      break;
    case 'bell':
      sound.bell(0);
      break;
    case 'runupFirst': {
      const word = `FIRST TO ${(map.course.lip?.runupName ?? 'the kicker').toUpperCase()}!`;
      hud.flash(e.p, 'pier', word, 'hype', now, 2.2);
      shoutAt(e.p, word);
      break;
    }
    case 'launch': {
      const c = cars[e.p];
      const pan = e.p === 0 ? -0.45 : 0.45;
      const pct = Math.round(e.wastedBoostFrac * 100);
      hud.flash(e.p, 'waste', pct >= 1 ? `${pct}% BOOST UNSPENT` : 'EVERY DROP OF BOOST USED', pct >= 1 ? 'waste' : 'air', now, 3.5);
      if (e.boost > 0.004) hud.flash(e.p, 'boost', `HYPE BOOST +${Math.round(e.boost * 100)}%`, 'hype', now, 3.5);
      // Off the kicker after it started to drop: how far down it was (by a whole degree or more).
      const rampDeg = Math.round(e.ramp * DEG);
      if (rampDeg < Math.round((map.course.lip?.angle ?? 0) * DEG)) hud.flash(e.p, 'ramp', `RAMP DOWN TO ${rampDeg}°`, 'ramp', now, 3.5);
      c.engine?.stop();
      c.engine = null;
      c.skid?.stop();
      c.skid = null;
      c.boostVoice?.stop();
      c.boostVoice = null;
      c.wind = sound.wind(pan);
      sound.launch(pan);
      rumble(e.p, 0.5, 1, 400);
      c.mesh?.setKiteOpen(true);
      c.mesh?.setThrottle(0);
      if (raceConfigs && raceConfigs[e.p].booster === 'rocket') c.nitro = 1;
      skids.lift(String(e.p));
      if (!firstLaunchSeen) {
        firstLaunchSeen = true;
        state = 'FLIGHT';
      }
      break;
    }
    case 'rampDrop':
      // The first car is off the kicker: it starts coming down for everyone behind.
      sound.rampDrop();
      hud.flash(e.p, 'ramp', 'FULL RAMP!', 'good', now, 2.5);
      for (const q of racers()) {
        if (q === e.p || sim?.cars[q]?.phase !== 'race') continue;
        hud.flash(q, 'ramp', '⚠ THE RAMP IS DROPPING!', 'ramp', now, 3);
        shoutAt(q, 'HURRY!');
      }
      break;
    case 'wingsOpen':
      cars[e.p].mesh?.setWingsOpen(true);
      hud.flash(e.p, 'wings', 'GLIDING!', 'air', now, 2.5);
      sound.wings(e.p === 0 ? -0.45 : 0.45);
      break;
    case 'splash': {
      const c = cars[e.p];
      c.splashT = 0;
      splashes.spawn(new THREE.Vector3(e.x, map.course.lip?.waterY ?? 0, e.z), e.speed, PLAYER_COLORS[e.p]);
      rumble(e.p, 1, 1, 600);
      sound.splash(e.p === 0 ? -0.45 : 0.45, e.speed / 30);
      c.wind?.stop();
      c.wind = null;
      break;
    }
    case 'lap': {
      // A lap done: its time (gold for a personal best), and the bell for the last one.
      const laps = sim?.laps ?? 1;
      const final = e.lap === laps - 1;
      hud.flash(e.p, 'lap', `LAP ${e.lap} · ${fmtTime(e.time)}${e.best && e.lap > 1 ? ' · BEST' : ''}`, e.best && e.lap > 1 ? 'hype' : 'item', now, 2.6);
      if (final) {
        sound.bell(e.p === 0 ? -0.45 : 0.45);
        shoutAt(e.p, 'FINAL LAP!');
      } else if (e.lap < laps) sound.beep(false);
      break;
    }
    case 'finish': {
      const c = cars[e.p];
      const win = e.place === 1 && !solo;
      hud.flash(e.p, 'finish', `🏁 ${solo ? 'FINISHED' : e.place === 1 ? 'WINNER' : '2ND'} · ${fmtTime(e.time)}`, win ? 'good' : 'item', now, 0);
      shoutAt(e.p, win ? 'WINNER!' : 'FINISHED!');
      sound.beep(true);
      if (win || solo) sound.cheer();
      rumble(e.p, 0.6, 1, 500);
      particles.confetti(tmpV.copy(c.root.position).setY(c.root.position.y + 1.5), 30);
      break;
    }
    case 'dnf':
      hud.flash(e.p, 'dnf', e.reason === 'straggler' ? "TIME'S UP · DNF" : 'DNF', 'dnf', now, 0);
      cars[e.p].stopAudio();
      cars[e.p].mesh?.setThrottle(0);
      break;
  }
}

// ---------- Results ----------
function awardsFor(p: PlayerIndex, res: CarResult[]): string[] {
  const t = res[p].tally;
  const o = res[1 - p] as CarResult | undefined;
  const race = timed();
  const lip = map.course.lip !== null;
  const out: [number, string][] = [];
  if (!race && o && !res[p].dnf && (o.dnf || res[p].runTime < o.runTime - 0.05)) out.push([6, '🏁 First to the lip']);
  if (race && sim && sim.laps > 1 && o && res[p].bestLap !== null && (o.bestLap === null || res[p].bestLap! < o.bestLap - 0.005)) out.push([7, '⏱ Fastest lap']);
  if (t.rocket) out.push([5, '🚀 Rocket start']);
  if (t.shortcuts > 0) out.push([9, map.hints.hedgeHop ? '🌸 Hedge hopper' : '✂️ Corner cutter']);
  if (t.pooLanded > 0) out.push([8, `💩 Poo sniper${t.pooLanded > 1 ? ` ×${t.pooLanded}` : ''}`]);
  if (t.plowed > 0) out.push([7, '😤 Unstoppable']);
  if (t.shoves >= 3) out.push([6, `🥊 Bully ×${t.shoves}`]);
  if (t.air >= 1.5) out.push([5, `🎈 ${t.air.toFixed(1)} s of air`]);
  if (t.drift >= 4) out.push([5, `🌀 Drift king`]);
  if (t.driftBoost >= 2) out.push([5, `⚡ ${t.driftBoost.toFixed(1)} s of boost from drifts`]);
  if (t.gulls > 0) out.push([8, `🐦 Seagull sniper${t.gulls > 1 ? ` ×${t.gulls}` : ''}`]);
  if (t.shooed > 0) out.push([7, '🧹 Shooed a seagull']);
  if (lip && res[p].wastedBoostFrac < 0.01 && t.boostUsed > 1 && !res[p].dnf) out.push([3, '💨 Every drop of boost']);
  if (t.nearMiss >= 3) out.push([4, `😬 ${t.nearMiss} near misses`]);
  if (map.rules.hype && res[p].hype >= 90) out.push([6, '🔥 Maxed-out HYPE']);
  if (t.waymo >= 2) out.push([7, `🤖 Waymo magnet ×${t.waymo}`]);
  else if (t.waymo === 1) out.push([3, "🤖 Waymo'd"]);
  if (t.ped >= 2) out.push([6, `🧍 Tourist trouble ×${t.ped}`]);
  if (t.poo >= 2) out.push([6, `💩 Poo magnet ×${t.poo}`]);
  if (t.overtakes >= 3) out.push([5, `🔁 ${t.overtakes} overtakes`]);
  out.sort((a, b) => b[0] - a[0]);
  return out.slice(0, 3).map((x) => x[1]);
}

/** Record a session best for this map if it beats the last (a jump's distance, a race's lap: on a
 *  point-to-point race that's the whole run). */
function noteSessionBest(score: number, p: PlayerIndex): boolean {
  const prev = sessionBests.get(map.id);
  if (prev && !better(score, prev.distance)) return false;
  sessionBests.set(map.id, { distance: score, name: names[p], player: p, round });
  return true;
}

/** Show the session's best jump in the water, or no marker (only jumps scored on distance). */
function showBestInWater(): void {
  if (map.rules.score !== 'distance') {
    scenery.setBest?.(null);
    return;
  }
  const best = sessionBests.get(map.id);
  if (best) scenery.setBest?.(best.distance, best.name, PLAYER_COLORS[best.player]);
  else scenery.setBest?.(null);
}

/** A race's row on the results card. */
function raceRow(r: CarResult): NonNullable<ResultsView['rows'][number]['race']> {
  return { time: r.runTime, laps: r.laps, bestLap: r.bestLap, place: r.place, finished: r.finished };
}

function finishRace(): void {
  if (!sim || !raceConfigs) return;
  const res = sim.results();
  if (solo) {
    finishSolo(res);
    return;
  }
  const race = timed();
  const d = res.map((r) => (r.dnf ? 0 : r.distance));
  let winner: PlayerIndex | null = null;
  if (race) {
    // First home wins; if nobody made it, nobody does.
    const home = PLAYERS.filter((p) => res[p].finished);
    if (home.length) winner = home.reduce((a, b) => (res[a].place <= res[b].place ? a : b));
  } else {
    if (Math.abs(d[0] - d[1]) > 0.005) winner = d[0] > d[1] ? 0 : 1;
    if (d[0] <= 0 && d[1] <= 0) winner = null;
  }
  if (winner !== null) wins[winner]++;
  if (race) resultsFocus = winner ?? sim.order()[0];
  let newRecord = false;
  for (const p of PLAYERS) {
    if (race) {
      const lap = res[p].bestLap;
      if (lap !== null && noteSessionBest(lap, p)) newRecord = true;
    } else if (!res[p].dnf && d[p] > 0 && noteSessionBest(d[p], p)) newRecord = true;
  }
  showBestInWater();
  const sessionBest = sessionBests.get(map.id) ?? null;
  lastConfigs = [raceConfigs[0], raceConfigs[1]];
  lastRuns = PLAYERS.map((p) => (race ? { distance: 0, dnf: res[p].dnf, time: res[p].runTime, place: res[p].place } : { distance: d[p], dnf: res[p].dnf })) as [LastRun, LastRun];
  const awards = PLAYERS.map((p) => awardsFor(p, res));
  results = {
    mode: map.mode,
    map: map.id,
    round,
    wind,
    winner,
    wins: [...wins],
    players: PLAYERS.map((p) => ({
      name: names[p],
      config: { ...raceConfigs![p] },
      distance: d[p],
      dnf: res[p].dnf,
      finished: res[p].finished,
      place: res[p].place,
      lapTimes: [...res[p].lapTimes],
      bestLap: res[p].bestLap,
      launchSpeed: res[p].launchSpeed,
      launchBoost: res[p].launchBoost,
      launchRampDeg: res[p].launchRamp * DEG,
      hype: res[p].hype,
      wastedBoostFrac: res[p].wastedBoostFrac,
      runTime: res[p].runTime,
      flightTime: res[p].flightTime,
      wheelspinTime: res[p].wheelspinTime,
      maxHeight: res[p].maxHeight,
      bumpsHit: res[p].bumpsHit,
      tally: { ...res[p].tally },
      awards: awards[p],
    })),
    sessionBest: sessionBest ? { ...sessionBest } : null,
  };
  const view: ResultsView = {
    rules: map.rules,
    map: map.name,
    laps: sim.laps,
    loop: map.course.loop,
    goal: map.rules.goal(map.course),
    rows: [0, 1].map((p) => ({
      name: names[p],
      color: PLAYER_COLORS[p],
      race: race ? raceRow(res[p]) : undefined,
      distance: d[p],
      dnf: res[p].dnf,
      launchKmh: res[p].launchSpeed * 3.6,
      boostLeft: res[p].wastedBoostFrac,
      airTime: res[p].flightTime,
      runTime: res[p].runTime,
      hypeBonus: res[p].launchBoost,
      ramp: res[p].launchRamp * DEG,
      awards: awards[p],
      wins: wins[p],
    })),
    winner,
    round,
    wind,
    best: sessionBest ? { distance: sessionBest.distance, name: sessionBest.name, round: sessionBest.round } : null,
    newRecord,
  };
  showResults(view, [
    { label: 'Rematch', primary: true, id: 'rematch-btn', padKey: 'A', onClick: rematch },
    { label: 'New players', id: 'newplayers-btn', padKey: 'Y', onClick: newPlayers },
  ]);
}

function showResults(view: ResultsView, actions: { label: string; primary?: boolean; id: string; padKey?: string; onClick: () => boolean }[]): void {
  state = 'RESULTS';
  stateTime = 0;
  resultsAt = performance.now();
  // After a flight the camera looks side-on over the water; otherwise it follows the winner's
  // cool-down lap, framed high (as for a stalled jump) so the car shows above the card.
  views.setMode(firstLaunchSeen ? 'results' : 'stalled');
  hud.showCars(false);
  hud.hideTags();
  for (const c of cars) c.stopAudio();
  hud.showResults(
    view,
    actions.map((a) => ({
      ...a,
      key: input.usingPad[0] || input.usingPad[1] ? a.padKey : undefined,
      onClick: () => {
        sound.click();
        a.onClick();
      },
    })),
  );
  sound.cheer();
}

/** A solo run is over: keep it (and its ghost) if it's the best from this start. */
function finishSolo(res: CarResult[]): void {
  const r = res[0];
  const race = timed();
  if (race) resultsFocus = 0;
  const cfg = { ...raceConfigs![0] };
  const d = r.dnf ? 0 : r.distance;
  // A race is scored on its time (only if it made the flag), the long jump on its distance.
  const score = race ? r.runTime : d;
  const counts = race ? r.finished : !r.dnf;
  const start = map.starts.find((q) => q.id === training.start)!;
  const key = soloKey(training.start);
  const prev = soloBests.get(key) ?? null;
  const record = counts && (prev === null || better(score, prev.score));
  if (record) {
    soloBests.set(key, { score, runTime: r.runTime, config: cfg, splits: [...splitTimes], ghost: Float32Array.from(ghostRec) });
  }
  if (race) {
    if (r.bestLap !== null) noteSessionBest(r.bestLap, 0);
  } else if (!r.dnf && d > 0) noteSessionBest(d, 0);
  showBestInWater();
  const sessionBest = sessionBests.get(map.id) ?? null;
  lastConfigs = [cfg, lastConfigs[1]];
  lastRuns = [race ? { distance: 0, dnf: r.dnf, time: r.runTime, place: 1 } : { distance: d, dnf: r.dnf }, lastRuns[1]];
  const awards = awardsFor(0, res);
  const splitRows = splits.map((sp, i) => ({
    label: sp.label,
    delta: prev && prev.splits[i] !== null && splitTimes[i] !== null ? splitTimes[i]! - prev.splits[i]! : null,
  }));
  if (prev && counts) splitRows.push({ label: map.rules.goal(map.course).replace(/^the /, '').toUpperCase(), delta: r.runTime - prev.runTime });
  results = {
    mode: 'solo',
    event: map.mode,
    map: map.id,
    start: training.start,
    round,
    wind,
    distance: d,
    time: race ? r.runTime : null,
    dnf: r.dnf,
    record,
    previousBest: prev?.score ?? null,
    splits: splitTimes.map((t, i) => ({ label: splits[i].label, t })),
    players: [
      {
        name: names[0],
        config: cfg,
        distance: d,
        dnf: r.dnf,
        finished: r.finished,
        lapTimes: [...r.lapTimes],
        bestLap: r.bestLap,
        launchSpeed: r.launchSpeed,
        launchBoost: r.launchBoost,
        hype: r.hype,
        wastedBoostFrac: r.wastedBoostFrac,
        runTime: r.runTime,
        flightTime: r.flightTime,
        tally: { ...r.tally },
        awards,
      },
    ],
    sessionBest: sessionBest ? { ...sessionBest } : null,
  };
  const best = soloBests.get(key) ?? null;
  const view: ResultsView = {
    rules: map.rules,
    map: map.name,
    laps: sim?.laps ?? 1,
    loop: map.course.loop,
    goal: map.rules.goal(map.course),
    rows: [
      {
        name: names[0],
        color: PLAYER_COLORS[0],
        race: race ? raceRow(r) : undefined,
        distance: d,
        dnf: r.dnf,
        launchKmh: r.launchSpeed * 3.6,
        boostLeft: r.wastedBoostFrac,
        airTime: r.flightTime,
        runTime: r.runTime,
        hypeBonus: r.launchBoost,
        ramp: null,
        awards,
        wins: 0,
      },
    ],
    winner: null,
    round,
    wind,
    best: best ? { distance: best.score, name: names[0], round } : null,
    newRecord: record,
    solo: { start: start.name, prevBest: prev?.score ?? null, splits: splitRows },
  };
  showResults(view, [
    { label: 'Retry', primary: true, id: 'retry-btn', padKey: 'A', onClick: retry },
    { label: 'Garage', id: 'garage-btn', padKey: 'B', onClick: toGarage },
  ]);
}

/** Back to the garage with both cars as they raced, ready to tweak. */
function rematch(): boolean {
  if (state !== 'RESULTS') return false;
  round++;
  wind = rollWind();
  enterBuild([garage.builds[0].tab, garage.builds[1].tab]);
  cutCamera();
  return true;
}

function newPlayers(): boolean {
  names = [...DEFAULT_NAMES];
  if (cpuOn) names[1] = 'CPU';
  round = 1;
  wins = [0, 0];
  lastConfigs = [null, null];
  lastRuns = [null, null];
  sessionBests.clear();
  soloBests.clear();
  scenery.setBest?.(null);
  wind = rollWind();
  enterBuild();
  cutCamera();
  return true;
}

// ---------- Input ----------
window.addEventListener('pointerdown', () => sound.unlock(), { capture: true });
// Buttons drop focus after a click so Enter/Space never re-press them behind the game's back.
document.addEventListener('click', (e) => (e.target as HTMLElement | null)?.closest('button')?.blur());
const garageKeys = new Map<string, { p: PlayerIndex; action: GarageAction }>();
for (const p of PLAYERS) {
  for (const [action, key] of Object.entries(GARAGE_KEYS[p])) {
    for (const code of key.codes) garageKeys.set(code, { p, action: action as GarageAction });
  }
}
window.addEventListener('keydown', (e) => {
  sound.unlock();
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
  const driving = state === 'COUNTDOWN' || state === 'RACE' || state === 'FLIGHT';
  // Leave browser shortcuts (Cmd+D, Ctrl+W, ...) alone. Mid-race Ctrl is Player 1's item key, so
  // while it's held the driving keys still drive (and don't open Ctrl+S or Ctrl+D behind the game).
  if (e.metaKey || e.altKey || (e.ctrlKey && !(driving && input.owner(e.code) !== null))) return;
  if (e.key === 'm' || e.key === 'M') {
    e.preventDefault();
    sound.toggleMute();
    return;
  }
  // A button reached with Tab keeps its native Enter/Space press (mouse clicks blur buttons). Tab and
  // Space are driving keys too, so while the results are fresh neither walks onto nor presses one.
  const fresh = state === 'RESULTS' && performance.now() - resultsAt < RESULTS_KEY_GRACE;
  if (fresh && e.code === 'Tab') {
    e.preventDefault();
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && target?.closest('button')) {
    if (fresh) e.preventDefault();
    return;
  }
  if (state === 'BUILD') {
    const key = garageKeys.get(e.code);
    if (!key) return;
    e.preventDefault();
    if (input.setUsingPad(key.p, false)) renderBuild();
    garageKey(key.p, key.action, e.repeat);
  } else if (state === 'RESULTS') {
    if (e.key === 'Enter' || e.key === ' ' || (solo && e.code === 'KeyR')) {
      e.preventDefault();
      // Keys still being mashed from the race mustn't skip the results.
      if (e.repeat || performance.now() - resultsAt < RESULTS_KEY_GRACE) return;
      sound.click();
      if (solo) retry();
      else rematch();
    } else if (solo && e.code === 'Escape') {
      e.preventDefault();
      sound.click();
      toGarage();
    }
  } else if (solo && (e.code === 'KeyR' || e.code === 'Escape')) {
    // Solo: R starts the run again at once, Esc goes back to the garage.
    e.preventDefault();
    if (e.repeat) return;
    sound.click();
    if (e.code === 'KeyR') retry();
    else toGarage();
  } else if (input.key(e, true) !== null) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  input.key(e, false);
});
window.addEventListener('blur', () => input.clear());

const PAD_GARAGE: Partial<Record<PadPress['button'], GarageAction>> = {
  left: 'prevTab',
  right: 'nextTab',
  lb: 'prevTab',
  rb: 'nextTab',
  up: 'prevPart',
  down: 'nextPart',
  a: 'ready',
  menu: 'ready',
};

/** The gamepads' menu presses: the garage, the results, and solo's retry and back to the garage. */
// `?pads` shows what the browser reports for each gamepad (to debug a pad that won't drive).
const padDebug = params.has('pads') ? document.createElement('pre') : null;
if (padDebug) {
  padDebug.style.cssText =
    'position:fixed;left:8px;top:8px;z-index:99;margin:0;padding:8px 10px;max-width:60vw;white-space:pre-wrap;font:12px/1.35 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.8);border-radius:6px;pointer-events:none';
  document.body.appendChild(padDebug);
}

function handlePads(): void {
  if (padDebug) padDebug.textContent = input.debugPads();
  for (const { p, button, repeat } of input.pollMenu()) {
    sound.unlock();
    const switched = input.setUsingPad(p, true);
    if (state === 'BUILD') {
      padGarage(p, button, repeat);
      if (switched) renderBuild();
    } else if (state === 'RESULTS') {
      // Buttons still being mashed from the race mustn't skip the results.
      if (repeat || performance.now() - resultsAt < RESULTS_KEY_GRACE) continue;
      if (button === 'a' || button === 'menu') {
        sound.click();
        if (solo) retry();
        else rematch();
      } else if (solo && (button === 'b' || button === 'view')) {
        sound.click();
        toGarage();
      } else if (!solo && button === 'y') {
        sound.click();
        newPlayers();
      }
    } else if (solo && !repeat && (button === 'menu' || button === 'view')) {
      // Solo: Menu starts the run again at once, View goes back to the garage.
      sound.click();
      if (button === 'menu') retry();
      else toGarage();
    }
  }
}

function padGarage(p: PlayerIndex, button: PadPress['button'], repeat: boolean): void {
  // Clicking the left stick swaps which pad drives which car.
  if (button === 'stick' && !repeat) {
    input.swapSeats();
    sound.click();
    for (const q of PLAYERS) input.rumble(q, 0.5, 0.5, q === 0 ? 150 : 400);
    renderBuild();
    return;
  }
  // A second pad while the CPU drives (or racing solo) takes over Player 2's car.
  if (p === 1 && (cpuOn || solo)) {
    if (!repeat && (button === 'a' || button === 'menu')) {
      sound.click();
      if (cpuOn) setCpu(false);
      else setSolo(false);
    }
    return;
  }
  // Player 1's View button goes round the modes: two players, against the CPU, solo.
  if (p === 0 && button === 'view' && !repeat) {
    sound.click();
    if (solo) setSolo(false);
    else if (cpuOn) setSolo(true);
    else setCpu(true);
    return;
  }
  // Solo: Y picks the next start.
  if (p === 0 && solo && button === 'y' && !repeat && !garage.builds[0].ready) {
    const i = map.starts.findIndex((q) => q.id === training.start);
    training.start = map.starts[(i + 1) % map.starts.length].id;
    sound.click();
    renderBuild();
    return;
  }
  // Otherwise Player 1's Y picks the next event.
  if (p === 0 && button === 'y' && !repeat) {
    const i = MAPS.indexOf(map);
    sound.click();
    setMap(MAPS[(i + 1) % MAPS.length].id);
    return;
  }
  // B takes the car back out of READY.
  if (button === 'b' && !repeat && garage.builds[p].ready) {
    toggleReady(p, false);
    return;
  }
  const action = PAD_GARAGE[button];
  if (action) garageKey(p, action, repeat);
}
window.addEventListener('resize', () => {
  world.resize();
  views.setSize(world.renderer.domElement.clientWidth, world.renderer.domElement.clientHeight);
});
views.setSize(world.renderer.domElement.clientWidth || window.innerWidth, world.renderer.domElement.clientHeight || window.innerHeight);

/** Inputs for this step: bots, scripted test inputs, or the keys and pads. */
function readInputs(firstStep: boolean): CarInput[] {
  return PLAYERS.map((p) => {
    const bot = bots[p];
    if (bot) return bot.decide();
    const sc = scripted[p];
    if (sc) {
      const out = { ...sc, item: sc.item && firstStep, swap: !!sc.swap && firstStep };
      if (firstStep) {
        sc.item = false;
        sc.swap = false;
      }
      return out;
    }
    const st = input.state(p);
    return {
      throttle: st.throttle,
      brake: st.brake,
      steer: st.steer,
      boost: st.boost,
      item: firstStep && input.takeItem(p),
      swap: firstStep && input.takeSwap(p),
    };
  });
}

// ---------- Frame loop ----------
/** Nobody at the wheel (the cool-down behind a race's results: the sim drives cars past the flag). */
const NO_DRIVE: CarInput = { throttle: 0, brake: 0, steer: 0, item: false, boost: false, swap: false };
const timer = new THREE.Timer();
timer.connect(document);
const tagPos = new THREE.Vector3();
const camTargets: [ViewTarget, ViewTarget] = [0, 1].map(() => ({
  pos: new THREE.Vector3(),
  s: 0,
  prog: 0,
  speed: 0,
  phase: 'grid' as ViewTarget['phase'],
})) as [ViewTarget, ViewTarget];
let frames = 0;
/** The cars each view keeps in sight (P1's half, P2's half, the shared screen). */
const fadeCars: THREE.Vector3[][] = [[], [], []];
/** Which car's tag sits on top when both tags share a pane. */
const tagUpper: [PlayerIndex, PlayerIndex] = [0, 0];

function updateGantry(dt: number): void {
  if (!gantry) return;
  const C = map.course;
  const racing = state === 'RACE' || state === 'FLIGHT';
  const sp = pointAt(C, C.startS);
  // Only once a car has driven under the banner can it come between a camera and its car (on a
  // loop, only just after it has: every lap passes under it).
  const carPassed =
    !!sim &&
    sim.cars.some((c) => {
      if (!C.loop) return c.s > C.startS + 1;
      const past = deltaS(C, C.startS, c.s);
      return (c.phase === 'race' || c.phase === 'finished') && past > 1 && past < 60;
    });
  for (const pane of [0, 1] as const) {
    const cam = views.cameraFor(pane).position;
    // Where the camera is: along the course from the start line, and off to the side.
    const along = (cam.x - sp.x) * sp.tx + (cam.z - sp.z) * sp.tz;
    const side = Math.abs(-(cam.x - sp.x) * sp.tz + (cam.z - sp.z) * sp.tx);
    if (!racing || along >= 1 || (C.loop && side > 25)) gantryHidden[pane] = false;
    else if (carPassed && along > -45 && cam.y - sp.y > 4.9) gantryHidden[pane] = true;
    gantryOpacity[pane] += ((gantryHidden[pane] ? 0 : 1) - gantryOpacity[pane]) * damp(10, dt);
  }
}

/** Apply a half's gantry fade just before that half is drawn. */
function applyGantry(pane: 0 | 1): void {
  if (!gantry) return;
  const o = gantryOpacity[pane];
  for (const m of gantryMats) {
    m.opacity = o;
    m.depthWrite = o > 0.5;
  }
  gantry.visible = o > 0.02;
}

function updateCars(dt: number, gdt: number, t: number): void {
  const building = state === 'BUILD';
  for (const p of PLAYERS) {
    const car = cars[p];
    const mesh = car.mesh;
    // Turntable in the garage; face forward otherwise.
    if (building) {
      car.yaw += dt * 0.55;
      car.holder.rotation.y = car.yaw + (p === 0 ? 0.6 : -0.6);
    } else {
      const target = Math.round(car.holder.rotation.y / (Math.PI * 2)) * Math.PI * 2;
      car.holder.rotation.y += (target - car.holder.rotation.y) * damp(5, dt);
      car.yaw = car.holder.rotation.y;
    }
    const sc = sim?.cars[p];
    if (!sc || state === 'COUNTDOWN' || sc.phase === 'grid') {
      if (state === 'COUNTDOWN') mesh?.setThrottle(sc && sc.throttle > 0.5 ? 0.9 + 0.1 * Math.sin(t * 40) : 0.25 + 0.15 * Math.sin(t * 30));
      mesh?.update(dt, t);
      car.stars.update(t, false, car.root.position, 0);
      car.aura.update(t, 0, car.root.position, 0, 1, 1);
      continue;
    }
    const k = sc.stats;
    let targetPitch = car.pitch;
    let targetRoll = 0;
    const speed = Math.hypot(sc.vx, sc.vz);
    // On the road: racing, or cruising on past the flag.
    const onRoad = sc.phase === 'race' || sc.phase === 'finished';
    if (onRoad || sc.phase === 'dnf') {
      car.root.position.set(sc.x, sc.y, sc.z);
      car.root.rotation.y = -sc.heading;
      const pt = pointAt(map.course, sc.s);
      if (sc.grounded) {
        // Nose follows the slope along the car's heading; the body leans out of turns.
        const grade = sim!.gradeAt(pt);
        const along = grade * Math.cos(sc.heading - pt.heading);
        targetPitch = Math.atan(along);
        const side = -grade * Math.sin(sc.heading - pt.heading);
        targetRoll = Math.atan(side) + Math.max(-0.14, Math.min(0.14, -sc.yawRate * speed * 0.009));
      } else {
        targetPitch = Math.atan2(sc.vy, Math.max(speed, 1)) * 0.8;
      }
      mesh?.setThrottle(sc.engineOn ? (sc.wheelspin ? 1 : 0.8) : 0);
    } else if (sc.phase === 'flight') {
      car.root.position.set(sc.x, sc.y, sc.z);
      car.root.rotation.y = -Math.atan2(sc.vz, sc.vx);
      targetPitch = Math.atan2(sc.vy, Math.hypot(sc.vx, sc.vz)) * 0.85;
      car.trail.add(tagPos.set(sc.x, sc.y + 0.7, sc.z));
    } else if (sc.phase === 'splashed') {
      car.splashT += gdt;
      const bob = (scenery.waterHeight?.(sc.x, sc.z, t) ?? 0) * 2.2;
      const sink = Math.max(0, car.splashT - 1.8) * 0.32;
      car.root.position.set(sc.x, (map.course.lip?.waterY ?? 0) + bob - 0.35 - Math.min(sink, 5), sc.z);
      targetPitch = -0.12 + Math.sin(t * 1.7 + p) * 0.06;
    }
    const rate = sc.phase === 'flight' || !sc.grounded ? 3 : 10;
    car.pitch += (targetPitch - car.pitch) * damp(rate, gdt);
    car.roll += (targetRoll - car.roll) * damp(6, gdt);
    car.tilt.rotation.set(car.roll, 0, car.pitch, 'YXZ');
    // Wheels roll with speed on the road and wind down in the air.
    const r = mesh?.wheelRadius ?? 0.3;
    const fwd = Math.cos(sc.heading) * sc.vx + Math.sin(sc.heading) * sc.vz;
    if (onRoad && sc.grounded) car.wheelAngle -= ((sc.wheelspin ? fwd * 1.6 + 6 : fwd) * gdt) / r;
    else if (sc.phase === 'flight' || !sc.grounded) car.wheelAngle -= (speed * 0.5 * gdt) / r;
    mesh?.setWheelRotation(car.wheelAngle);
    // Bump hop.
    car.hopV -= 9.81 * gdt;
    car.hopY = Math.max(0, car.hopY + car.hopV * gdt);
    if (car.hopY === 0 && car.hopV < 0) car.hopV = 0;
    car.holder.position.y = car.hopY;
    // Squash and stretch on a stiff spring.
    car.squashV += (-170 * car.squash - 11 * car.squashV) * gdt;
    car.squash = THREE.MathUtils.clamp(car.squash + car.squashV * gdt, -0.28, 0.3);
    car.holder.scale.set(1 - car.squash * 0.45, 1 + car.squash, 1 - car.squash * 0.45);
    // Launch-rocket flame fades after the lip; the boost flame follows the boost key.
    car.nitro = Math.max(0, car.nitro - gdt * 0.9);
    mesh?.setNitro(car.nitro);
    car.boostFlame += ((sc.boosting && sc.phase === 'race' ? 1 : 0) - car.boostFlame) * damp(14, gdt);
    mesh?.setBoost(car.boostFlame);
    car.boostVoice?.set(car.boostFlame);
    mesh?.update(dt, t);
    car.engine?.set(speed, sc.engineOn, sc.wheelspin);
    const slide = onRoad && sc.grounded ? Math.min(1, Math.abs(sc.slip) * 2.2 * Math.min(1, speed / 10)) : 0;
    car.skid?.set(sc.sliding || (sc.brake > 0 && speed > 8 && sc.grounded) ? Math.max(slide, sc.brake > 0 ? 0.35 : 0) : 0);
    if (sc.phase === 'flight') car.wind?.set(Math.hypot(sc.vx - wind, sc.vy, sc.vz));
    // Skid marks and tyre smoke.
    if (onRoad && sc.grounded && (sc.sliding || sc.wheelspin || (sc.brake > 0 && speed > 9))) {
      const halfTrack = k.width / 2 - 0.15;
      const back = -k.length * 0.3;
      skids.lay(String(p), sc.x + Math.cos(sc.heading) * back, sc.y, sc.z + Math.sin(sc.heading) * back, sc.heading, halfTrack, Math.max(slide, 0.5));
      if ((sc.sliding || sc.wheelspin) && Math.random() < gdt * 18) {
        particles.puff(tmpV.set(sc.x + Math.cos(sc.heading) * back, sc.y + 0.2, sc.z + Math.sin(sc.heading) * back), 1, '#f2f0ec', 0.45, 0.6);
      }
    } else skids.lift(String(p));
    // Drifting: sparks off the rear tyres, icy blue while the slide banks boost, gold once it's long.
    if (sc.phase === 'race' && sc.drift !== 0 && sc.grounded && speed > 8 && Math.random() < gdt * 40) {
      const back = -k.length * 0.38;
      const out = sc.drift * (k.width / 2);
      const fx = Math.cos(sc.heading);
      const fz = Math.sin(sc.heading);
      tmpV.set(sc.x + fx * back - fz * out, sc.y + 0.15, sc.z + fz * back + fx * out);
      particles.driftSparks(tmpV, tmpV2.set(-fx, 0, -fz), 3, sc.driftT > 1.2);
    }
    // Status effects: spinning in poo flings brown from the wheels.
    if (sc.phase === 'race' && sc.spin > 0 && sc.grounded && Math.random() < gdt * 30) {
      particles.puff(tmpV.set(sc.x, sc.y + 0.25, sc.z), 1, Math.random() < 0.5 ? '#6b4122' : '#7a4a24', 0.32, 1.2);
    }
    car.stars.update(t, sc.spin > 0 || sc.stun > 0.2, car.root.position, 1.4);
    car.aura.update(t, sc.grit, car.root.position, sc.heading, k.length, k.width);
    // Hints: jump Lombard's hedges; spend the boost on the pier; the slipstream.
    if (sc.phase === 'race' && !bots[p]) {
      const dump = map.hints.boostDump;
      const hedges = map.hints.hedges;
      if (dump && sc.boostFrac > 0.3 && sc.s > dump[0] && sc.s < dump[1] && !car.hinted.has('pier')) {
        car.hinted.add('pier');
        hud.flash(p, 'hint', `🔥 EMPTY YOUR BOOST FOR THE JUMP! (${input.labels(p).boost})`, 'boost', gameClock, 2.6);
      }
      if (hedges && sc.items.includes('jump') && sc.s > hedges[0] && sc.s < hedges[1] && !car.hinted.has('lombard')) {
        car.hinted.add('lombard');
        hud.flash(p, 'hint', '🦘 JUMP THE HEDGES!', 'hype', gameClock, 3);
      }
      car.draftTime = sc.draft > 0.35 ? car.draftTime + gdt : 0;
      if (car.draftTime > 0.6 && !car.hinted.has(`draft${Math.floor(gameClock / 8)}`)) {
        car.hinted.add(`draft${Math.floor(gameClock / 8)}`);
        hud.flash(p, 'draft', 'SLIPSTREAM!', 'air', gameClock, 1.5);
      }
    }
    // Roulette ticks.
    if (sc.roulette > 0 && sc.phase === 'race') {
      car.rouletteTick -= gdt;
      if (car.rouletteTick <= 0) {
        car.rouletteTick = 0.07;
        sound.rouletteTick(p === 0 ? -0.45 : 0.45);
      }
    }
  }
}

function frame(): void {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  const t = timer.getElapsed();
  const gdt = dt * simSpeed;
  stateTime += gdt;
  gameClock += gdt;
  handlePads();

  if (state === 'COUNTDOWN' && sim) {
    // The sim runs on the grid through the countdown, so a well-timed throttle gives a rocket start.
    accumulator += gdt;
    let first = true;
    while (accumulator >= DT) {
      accumulator -= DT;
      sim.step(readInputs(first));
      first = false;
    }
    const idx = Math.min(3, Math.floor(stateTime / COUNT_STEP));
    if (idx > countIndex) {
      countIndex = idx;
      const labels = ['3', '2', '1', 'GO!'];
      hud.showCountdown(labels[idx]);
      sound.beep(idx === 3);
      // Even if a long frame skipped straight past "1", GO still happens.
      if (idx === 3) startRace();
    }
  } else if ((state === 'RACE' || state === 'FLIGHT') && sim) {
    if (stateTime > COUNT_STEP * 1.1) hud.showCountdown(null);
    accumulator += gdt;
    let steps = 0;
    while (accumulator >= DT && steps < 5000) {
      accumulator -= DT;
      for (const e of sim.step(readInputs(steps === 0))) handleEvent(e);
      steps++;
    }
    if (sim.done) {
      if (doneTime < 0) doneTime = stateTime;
      // Nobody launched: skip straight to the results after a short pause.
      if (stateTime - doneTime > (firstLaunchSeen || timed() ? RESULTS_DELAY : 1.2)) finishRace();
    }
  } else if (state === 'RESULTS' && sim && sim.cars.some((c) => c.phase === 'finished')) {
    // Behind the results, cars past the flag carry on their cool-down lap.
    accumulator += gdt;
    while (accumulator >= DT) {
      accumulator -= DT;
      sim.step([NO_DRIVE, NO_DRIVE]);
    }
  }

  // HUD.
  if (sim && (state === 'RACE' || state === 'FLIGHT' || state === 'COUNTDOWN')) {
    const order = sim.order();
    const clock = sim.stragglerLeft();
    for (const p of racers()) {
      const c = sim.cars[p];
      const o = sim.cars[1 - p] as (typeof sim.cars)[number] | undefined;
      const racing = c.phase === 'race' && o?.phase === 'race';
      hud.update(
        p,
        {
          speedKmh: Math.hypot(c.vx, c.vy, c.vz) * 3.6,
          boostFrac: c.boostFrac,
          boosting: c.boosting,
          charging: c.drift !== 0 && c.grounded,
          wheelspin: c.wheelspin,
          phase: c.phase,
          distance: c.distance,
          lap: c.lap,
          raceTime: c.finishT ?? sim.raceT,
          hype: c.hype,
          hypeBonus: (HYPE_BOOST * c.hype) / HYPE_MAX,
          items: c.items,
          sel: c.sel,
          roulette: c.roulette > 0,
          grit: c.grit > 0,
          gull: c.gullT > 0,
          position: order.indexOf(p) + 1,
          gap: racing && o ? c.prog - o.prog : null,
          wrongWay: c.wrongWay > 1.2,
          clock,
          ramp: sim.rampDropAt !== null ? { deg: sim.rampAngle * DEG, moving: sim.rampAngle > RAMP_MIN + 1e-6 } : null,
        },
        gameClock,
        c.phase === 'race' || c.phase === 'grid' ? stripAt(c.s) : 1,
      );
    }
  }
  if (solo && sim && (state === 'RACE' || state === 'FLIGHT')) soloTiming();

  updateCars(dt, gdt, t);
  // Solo: record this run's ghost, and race the best run's.
  if (solo && sim) {
    const sc = sim.cars[0];
    const c = cars[0];
    if ((state === 'RACE' || state === 'FLIGHT') && (sc.phase === 'race' || sc.phase === 'flight')) {
      ghostRec.push(sim.raceT, c.root.position.x, c.root.position.y, c.root.position.z, c.root.rotation.y, c.pitch, c.roll, sc.phase === 'race' ? sc.prog : Infinity);
    }
    const racingNow = state === 'RACE' || state === 'FLIGHT' || state === 'COUNTDOWN';
    const g = racingNow ? ghost.update(state === 'COUNTDOWN' ? 0 : sim.raceT) : null;
    if (!racingNow) ghost.hide();
    // The ghost's progress on the strip (point to point, progress is the arc length itself).
    const C = map.course;
    hud.setGhost(g === null ? null : Number.isFinite(g) ? stripAt(C.loop ? C.startS + g : g) : 1);
  }

  // Camera targets (behind a race's results, both on the winner's cool-down lap).
  for (const p of PLAYERS) {
    const ct = camTargets[p];
    const q = state === 'RESULTS' && resultsFocus !== null ? resultsFocus : p;
    ct.pos.copy(cars[q].root.position);
    const sc = sim?.cars[q] as (NonNullable<typeof sim>['cars'][number] | undefined);
    ct.s = sc ? sc.s : map.course.grid[p].s;
    ct.prog = sc ? (sc.finishT !== null ? sc.prog + 1e6 : sc.prog) : 0;
    ct.speed = sc ? Math.hypot(sc.vx, sc.vz) : 0;
    ct.phase = sc ? sc.phase : 'grid';
  }
  const racing = state === 'RACE' || state === 'FLIGHT' || state === 'COUNTDOWN';
  views.update(state === 'BUILD' ? dt : gdt, t, camTargets, racing && state !== 'COUNTDOWN');
  updateGantry(dt);

  splashes.update(gdt);
  particles.update(gdt);
  scenery.update(dt, t, sim ? sim.cars.filter((c) => c.phase === 'race' || c.phase === 'finished').map((c) => ({ x: c.x, z: c.z })) : []);
  // The kicker stands at full height in the garage and until the first car is off it; its lamps
  // flash while it comes down in front of someone still racing.
  const lip = map.course.lip;
  if (lip) {
    const ramping = !!sim && state !== 'BUILD' && sim.rampDropAt !== null;
    scenery.setRamp?.(
      ramping ? sim!.rampAngle : lip.angle,
      ramping && sim!.rampAngle > RAMP_MIN + 1e-6 && sim!.cars.some((c) => c.phase === 'race'),
      t,
    );
  }
  actors.update(gdt, t, sim);
  fadeCars[0][0] = fadeCars[2][0] = carPos(0);
  fadeCars[1][0] = carPos(1);
  if (solo) fadeCars[2].length = 1;
  else fadeCars[2][1] = carPos(1);
  views.render(world.renderer, scene, (cam, pane) => {
    applyGantry(pane === -1 ? 0 : pane);
    // See through Waymos (and the cable car) that are in this view's way.
    actors.fadeFor(cam.position, fadeCars[pane === -1 ? 2 : pane]);
    scenery.beforeRender?.(cam);
    const focus = pane === -1 ? views.shared.cur.focus : views.focusFor(pane);
    world.setShadowFocus(focus, state === 'BUILD' ? 40 : 60);
    for (const c of cars) c.trail.update(cam);
  });

  // Name tags over the cars while racing, in whichever panes show them. Two tags in the same pane
  // stack instead of overlapping when the cars are side by side: the vertical gap they need shrinks
  // smoothly as they separate sideways, and which tag sits on top only changes when the order
  // clearly flips.
  const showTags = state === 'COUNTDOWN' || state === 'RACE' || state === 'FLIGHT';
  const ownTag = [
    { x: 0, y: 0, vis: false },
    { x: 0, y: 0, vis: false },
  ];
  for (const pane of [0, 1] as const) {
    const use = showTags && (views.isSplit || pane === 0);
    const tags = PLAYERS.map((p) => {
      const out = { x: 0, y: 0, vis: false };
      if (!use || (solo && p === 1)) return out;
      tagPos.copy(cars[p].root.position);
      tagPos.y += 3.0;
      views.project(pane, tagPos, out);
      const phase = sim?.cars[p]?.phase;
      out.vis &&= phase !== 'splashed' && phase !== 'dnf' && out.y > views.pane(pane).h * 0.2;
      return out;
    });
    if (tags[0].vis && tags[1].vis) {
      const dy = tags[0].y - tags[1].y;
      if (dy < -12) tagUpper[pane] = 0;
      else if (dy > 12) tagUpper[pane] = 1;
      const up = tagUpper[pane];
      const need = 34 * THREE.MathUtils.clamp((140 - Math.abs(tags[0].x - tags[1].x)) / 40, 0, 1);
      tags[up].y = Math.min(tags[up].y, tags[1 - up].y - need);
    }
    for (const p of PLAYERS) {
      hud.setTag(p, pane, tags[p].x, tags[p].y, tags[p].vis);
      if (pane === (views.isSplit ? p : 0)) ownTag[p] = tags[p];
    }
  }
  // Shouts ride just above the tag on the player's own part of the screen.
  for (const p of PLAYERS) hud.placeShouts(p, ownTag[p].x, ownTag[p].y, ownTag[p].vis);
  if (++frames === 3) api.ready = true;
}

/** Solo: time the run at each split and show how it compares with the best run from this start. */
function soloTiming(): void {
  if (!sim) return;
  const car = sim.cars[0];
  const best = soloBests.get(soloKey(training.start));
  while (nextSplit < splits.length && car.phase === 'race' && car.prog >= splits[nextSplit].s) {
    const i = nextSplit++;
    splitTimes[i] = sim.raceT;
    const ref = best?.splits[i];
    hud.split(0, splits[i].label, ref === undefined || ref === null ? null : sim.raceT - ref, gameClock);
  }
}

// ---------- Test hooks ----------
function botRun(cfg: CarConfig): CarResult {
  const s = new RaceSim([computeStats(cfg)], wind, { obstacles: false, items: false }, map);
  driveToEnd(s, [new Bot(s, 0, { dodge: false, items: false })]);
  return s.results()[0];
}

const api = {
  ready: false,
  get state(): GameState {
    return state;
  },
  /** Fit a part (by id or option index) on a player's car. */
  select(p: PlayerIndex, slot: SlotId, option: string | number): boolean {
    const id = typeof option === 'number' ? PARTS[slot]?.[option]?.id : option;
    if (state !== 'BUILD' || !isPlayer(p) || id === undefined || !fitPart(garage, p, slot, id)) return false;
    renderBuild();
    return true;
  },
  /** Remove a paid part: the slot falls back to its free part. */
  remove(p: PlayerIndex, slot: SlotId): boolean {
    if (state !== 'BUILD' || !isPlayer(p) || !removePart(garage, p, slot)) return false;
    renderBuild();
    return true;
  },
  openTab(p: PlayerIndex, slot: SlotId): boolean {
    if (state !== 'BUILD' || !isPlayer(p) || !openTab(garage, p, slot)) return false;
    renderBuild();
    return true;
  },
  /** Set a player's READY; the countdown starts once both are ready. */
  setReady(p: PlayerIndex, ready = true): boolean {
    return isPlayer(p) && toggleReady(p, ready);
  },
  get configs(): [CarConfig, CarConfig] {
    return raceConfigs && state !== 'BUILD'
      ? [{ ...raceConfigs[0] }, { ...raceConfigs[1] }]
      : [{ ...garage.builds[0].config }, { ...garage.builds[1].config }];
  },
  get wind(): number {
    return wind;
  },
  get results(): Record<string, unknown> | null {
    return results ? structuredClone(results) : null;
  },
  launch(): boolean {
    return startCountdown();
  },
  rematch(): boolean {
    return rematch();
  },
  newPlayers(): boolean {
    return newPlayers();
  },
  setSpeed(n: number): number {
    simSpeed = parseSpeed(n);
    return simSpeed;
  },
  get speed(): number {
    return simSpeed;
  },
  get seed(): number {
    return seed;
  },
  get round(): number {
    return round;
  },
  get names(): [string, string] {
    return [...names] as [string, string];
  },
  setName(p: PlayerIndex, name: string): void {
    names[p] = cleanName(p, name);
    if (state === 'BUILD') renderBuild();
  },
  get garage() {
    return {
      configs: [{ ...garage.builds[0].config }, { ...garage.builds[1].config }],
      money: [moneyLeft(garage, 0), moneyLeft(garage, 1)],
      ready: [garage.builds[0].ready, garage.builds[1].ready],
      tabs: [garage.builds[0].tab, garage.builds[1].tab],
      previous: [garage.prev[0] ? { ...garage.prev[0] } : null, garage.prev[1] ? { ...garage.prev[1] } : null],
      lastRuns: [lastRuns[0] ? { ...lastRuns[0] } : null, lastRuns[1] ? { ...lastRuns[1] } : null],
    };
  },
  /** Live race state per car (position, speed, item, HYPE...). */
  get cars() {
    if (!sim) return null;
    return sim.cars.map((c) => {
      const { stats: _stats, missed: _missed, nearPending: _near, ...rest } = c;
      void _stats;
      void _missed;
      void _near;
      return structuredClone({ ...rest, speed: Math.hypot(c.vx, c.vz) });
    });
  },
  get events() {
    return eventLog.map((e) => ({ ...e, event: { ...e.event } }));
  },
  /** The race world: traffic, tourists, boxes, poo and the cable car. */
  get world() {
    if (!sim) return null;
    return structuredClone({
      t: sim.raceT,
      waymos: sim.waymos.map((w) => ({ id: w.id, kind: w.kind, x: w.x, z: w.z, s: w.s, stopped: w.stopped > 0, parked: w.parked })),
      peds: sim.peds.map((p) => ({ id: p.id, kind: p.kind, x: p.x, z: p.z, s: p.s, d: p.d, down: p.down > 0 })),
      poos: sim.poos.filter((q) => q.alive).map((q) => ({ id: q.id, x: q.x, z: q.z, s: q.s, owner: q.owner })),
      gulls: sim.gulls.map((g) => ({ id: g.id, owner: g.owner, target: g.target, state: g.state, x: g.x, y: g.y, z: g.z })),
      boxes: sim.boxes.map((b) => ({ id: b.id, s: b.s, d: b.d, hidden: b.hidden > 0 })),
      cable: sim.cables[0] ? { x: sim.cables[0].x, z: sim.cables[0].z } : null,
      cables: sim.cables.map((cb) => ({ x: cb.x, z: cb.z })),
    });
  },
  /** Split-screen state: 0 = one screen, 1 = fully split. */
  get split(): number {
    return views.split;
  },
  /** The kicker: its angle now (degrees), and the race time the first car went off it (or null). */
  get ramp() {
    const live = !!sim && state !== 'BUILD';
    const full = map.course.lip?.angle ?? 0;
    return { deg: (live ? sim!.rampAngle : full) * DEG, dropAt: live ? sim!.rampDropAt : null };
  },
  /** The driving keys' layout: one player alone on the arrows, or two sharing the keyboard. */
  get keyLayout(): 'single' | 'duo' {
    return input.single ? 'single' : 'duo';
  },
  /** The session best on the map in play: the furthest jump, or a race's fastest lap (in `distance`). */
  get sessionBest() {
    const best = sessionBests.get(map.id);
    return best ? { ...best } : null;
  },
  /** The event in play, and the ones to pick from. */
  get map(): { id: string; venue: string; name: string; mode: MapDef['mode']; laps: number; loop: boolean } {
    return { id: map.id, venue: map.venue, name: map.name, mode: map.mode, laps: map.laps, loop: map.course.loop };
  },
  get maps(): string[] {
    return MAPS.map((m) => m.id);
  },
  /** Pick the event (in the garage): a map id. */
  setMap(id: string): boolean {
    return setMap(id);
  },
  get wins(): [number, number] {
    return [...wins] as [number, number];
  },
  /** Audio state: started (after the first click/key), muted, and the current output level. */
  get sound() {
    return { ready: sound.ready, muted: sound.muted, level: sound.level() };
  },
  toggleMute(): boolean {
    return sound.toggleMute();
  },
  /** Player 2 driven by the CPU (the garage toggle). */
  setCpu(on: boolean): boolean {
    if (state !== 'BUILD') return false;
    setCpu(on);
    return true;
  },
  get cpu(): boolean {
    return cpuOn;
  },
  /** Let the autopilot drive a player's car (or give it back). Takes effect at once. */
  autodrive(p: PlayerIndex, on = true): boolean {
    if (!isPlayer(p)) return false;
    autodrive[p] = on;
    if (sim && sim.cars[p]) bots[p] = on ? new Bot(sim, p, { aggression: 0.4, drift: true }) : null;
    return true;
  },
  /** Drive a car from a script: throttle/brake 0..1, steer -1..1, boost held, item/swap true for
   *  one press. null ends it. */
  input(p: PlayerIndex, inp: Partial<CarInput> | null): boolean {
    if (!isPlayer(p)) return false;
    scripted[p] = inp
      ? {
          throttle: inp.throttle ?? 0,
          brake: inp.brake ?? 0,
          steer: inp.steer ?? 0,
          item: inp.item ?? false,
          boost: inp.boost ?? false,
          swap: inp.swap ?? false,
        }
      : null;
    return true;
  },
  /** Hand a car an item (test hook): it goes in a free slot and is selected. */
  giveItem(p: PlayerIndex, item: ItemKind): boolean {
    if (!sim || !isPlayer(p) || !sim.cars[p] || !ITEM_KINDS.includes(item)) return false;
    sim.giveItem(p, item);
    return true;
  },
  /** Solo training (the garage toggle): race alone. */
  setSolo(on: boolean): boolean {
    if (state !== 'BUILD') return false;
    setSolo(on);
    return true;
  },
  get solo(): boolean {
    return solo;
  },
  /** Solo training settings: start ('top' | 'hyde' | 'lombard' | 'final'), ghost, traffic, items. */
  setTraining(change: Partial<Training>): boolean {
    if (state !== 'BUILD') return false;
    Object.assign(training, change);
    renderBuild();
    return true;
  },
  get training(): Training {
    return { ...training };
  },
  /** Solo: race again from the same start at once (R), or go back to the garage (Esc). */
  retry(): boolean {
    return retry();
  },
  toGarage(): boolean {
    return toGarage();
  },
  /** Solo: the best run from each start of the map in play (distance or time, splits, ghost frames). */
  get soloBests() {
    const out: Record<string, { distance: number; runTime: number; splits: (number | null)[]; ghostFrames: number }> = {};
    for (const st of map.starts) {
      const b = soloBests.get(soloKey(st.id));
      if (b) out[st.id] = { distance: timed() ? 0 : b.score, runTime: b.runTime, splits: [...b.splits], ghostFrames: b.ghost.length / GHOST_STRIDE };
    }
    return out;
  },
  /** Solo: whether the ghost is on screen. */
  get ghostVisible(): boolean {
    return ghost.root.visible;
  },
  /** Put a car somewhere on the course (arc length s, offset d, speed m/s): test hook. */
  place(p: PlayerIndex, s: number, d = 0, speed = 0): boolean {
    if (!sim || !isPlayer(p) || ![s, d, speed].every(Number.isFinite)) return false;
    const C = map.course;
    sim.place(p, C.loop ? wrapS(C, s) : Math.min(Math.max(s, 0.6), C.length - 0.5), d, speed);
    return true;
  },
  /** The course in play: its length, whether it's a loop, the start line, its landmarks along the
   *  route (the long jump's named marks; arc lengths) and its sections. */
  get course() {
    const C = map.course;
    return {
      id: C.id,
      length: C.length,
      loop: C.loop,
      startS: C.startS,
      ...(map.marks ?? {}),
      sections: C.sections.map((s) => ({ kind: s.kind, name: s.name, s0: s.s0, s1: s.s1 })),
    };
  },
  /** The autopilot's result for each current car on an empty course, in this wind. */
  predict(): CarResult[] {
    return api.configs.map((c) => botRun(c));
  },
  /** Autopilot on an empty course (the balance check's measure of a build). */
  simulateToEnd(stats: CarStats, w = wind): CarResult {
    const s = new RaceSim([stats], w, { obstacles: false, items: false }, map);
    driveToEnd(s, [new Bot(s, 0, { dodge: false, items: false })]);
    return s.results()[0];
  },
  computeStats,
  parts: PARTS,
};

declare global {
  interface Window {
    __game: typeof api;
  }
}
window.__game = api;

enterBuild();
views.snap(camTargets, 0);
world.renderer.setAnimationLoop(frame);

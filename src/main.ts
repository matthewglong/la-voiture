// La Voiture: game state machine.
// BUILD -> COUNTDOWN -> RACE (run-up) -> FLIGHT -> RESULTS -> (Rematch -> BUILD) | (New players -> BUILD, reset)
import './style.css';
import * as THREE from 'three';
import { Sound, type EngineKind, type EngineVoice, type WindVoice } from './audio';
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
import { PARTS, computeStats, getOption } from './parts';
import { buildBay } from './scene/bay';
import { CameraRig, type CameraTarget } from './scene/camera';
import { buildCarMesh, type CarMesh } from './scene/carMesh';
import { buildCity } from './scene/city';
import { Splashes, Trail } from './scene/effects';
import { buildLandmarks } from './scene/landmarks';
import { damp, makeRng } from './scene/util';
import { createWorld } from './scene/world';
import { CarSim, DT, simulateToEnd, type SimEvent, type SimResult } from './sim/physics';
import { TRACK, sampleTrack } from './track';
import type { CarConfig, PlayerIndex, SlotId } from './types';
import { BuildUI, GARAGE_KEYS, type GarageAction, type LastRun } from './ui/build';
import { HUD, type ResultsView } from './ui/hud';

type GameState = 'BUILD' | 'COUNTDOWN' | 'RACE' | 'FLIGHT' | 'RESULTS';

const PLAYER_COLORS: [string, string] = ['#ff5a36', '#2e8bff'];
const DEFAULT_NAMES: [string, string] = ['Player 1', 'Player 2'];
const PLAYERS: PlayerIndex[] = [0, 1];
const COUNT_STEP = 0.85; // seconds per countdown number
const RESULTS_DELAY = 2.6; // seconds after the last car finishes
// Real-time grace periods, so keys still being mashed don't skip a screen.
const RESULTS_KEY_GRACE = 1000; // ms before Enter/Space can leave the results
const READY_KEY_GRACE = 600; // ms before the READY keys work in a fresh garage

// ---------- URL parameters ----------
const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const seed = seedParam !== null && seedParam !== '' && Number.isFinite(Number(seedParam))
  ? Math.floor(Number(seedParam))
  : Math.floor(Math.random() * 2 ** 31);
const parseSpeed = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.max(n, 0.05), 50) : 1;
};
let simSpeed = parseSpeed(params.get('speed') ?? 1);
const autobuild = params.get('autobuild') === '1';
// Extra test hook: ?wind=-8 pins the wind (m/s, + = tailwind) for every round.
const windParam = params.get('wind');
const fixedWind =
  windParam !== null && windParam !== '' && Number.isFinite(Number(windParam))
    ? Math.min(Math.max(Number(windParam), -8), 8)
    : null;
const windRng = makeRng(seed);
const buildRng = makeRng(seed ^ 0x5bd1e995);

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
const city = buildCity();
scene.add(city.group);
// The start gantry fades out while the chase camera looks through its banner and crossbar.
const gantry = city.group.getObjectByName('startGantry') ?? null;
const gantryMats: THREE.Material[] = [];
gantry?.traverse((o) => {
  const m = (o as THREE.Mesh).material;
  if (!m) return;
  for (const mat of Array.isArray(m) ? m : [m]) {
    if (gantryMats.includes(mat)) continue;
    mat.transparent = true;
    gantryMats.push(mat);
  }
});
let gantryOpacity = 1;
let gantryHidden = false;
const landmarks = buildLandmarks();
scene.add(landmarks.group);
const bay = buildBay({ envMap: world.skyEnv, anisotropy: world.renderer.capabilities.getMaxAnisotropy() });
scene.add(bay.group);
const splashes = new Splashes();
scene.add(splashes.group);
const rig = new CameraRig(camera);

// ---------- Cars ----------
function configKey(c: CarConfig): string {
  return Object.values(c).join('|');
}

class CarView {
  readonly p: PlayerIndex;
  /** World placement and pitch. */
  readonly root = new THREE.Group();
  /** Turntable yaw and bump hops. */
  readonly holder = new THREE.Group();
  mesh: CarMesh | null = null;
  key = '';
  wheelAngle = 0;
  pitch = 0;
  hopY = 0;
  hopV = 0;
  yaw = 0;
  splashT = -1;
  nitro = 0;
  readonly trail: Trail;
  engine: EngineVoice | null = null;
  wind: WindVoice | null = null;

  constructor(p: PlayerIndex) {
    this.p = p;
    this.root.add(this.holder);
    this.trail = new Trail(PLAYER_COLORS[p]);
    scene.add(this.root, this.trail.mesh);
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
  }

  placeAtStart(): void {
    const s = sampleTrack(TRACK, 0);
    this.root.position.set(s.x, s.y, TRACK.laneZ[this.p]);
    this.root.rotation.set(0, 0, s.angle);
    this.pitch = s.angle;
    this.holder.position.set(0, 0, 0);
    this.hopY = 0;
    this.hopV = 0;
    this.splashT = -1;
    this.nitro = 0;
    this.root.visible = true;
    this.mesh?.setKiteOpen(false);
    this.mesh?.setThrottle(0);
    this.mesh?.setNitro(0);
    // Glider wings show spread in the garage; they fold for the run-up at the countdown.
    this.mesh?.setWingsOpen(true, true);
  }

  stopAudio(): void {
    this.engine?.stop();
    this.engine = null;
    this.wind?.stop();
    this.wind = null;
  }
}

const cars: [CarView, CarView] = [new CarView(0), new CarView(1)];

// ---------- Game state ----------
const sound = new Sound();
let state: GameState = 'BUILD';
let names: [string, string] = [...DEFAULT_NAMES];
let round = 1;
let wind = rollWind();
let garage: Garage = newGarage([null, null]);
/** The part each player is hovering, previewed on their car (null: the fitted car). */
const previews: [CarConfig | null, CarConfig | null] = [null, null];
let lastConfigs: [CarConfig | null, CarConfig | null] = [null, null];
let lastRuns: [LastRun | null, LastRun | null] = [null, null];
/** performance.now() when the garage and the results card last appeared. */
let garageAt = 0;
let resultsAt = 0;
let sims: [CarSim, CarSim] | null = null;
let raceConfigs: [CarConfig, CarConfig] | null = null;
let accumulator = 0;
let stateTime = 0;
let doneTime = -1;
let countIndex = -1;
let gameClock = 0;
let firstLaunchSeen = false;
/** Game time of the most recent splash (the camera holds on it briefly). */
let lastSplashAt = -1;
let results: Record<string, unknown> | null = null;
let sessionBest: { distance: number; name: string; player: PlayerIndex; round: number } | null = null;
const eventLog: { t: number; player: PlayerIndex; event: SimEvent }[] = [];

// ---------- UI ----------
const overlay = document.createElement('div');
overlay.className = 'overlay';
app.appendChild(overlay);

const buildUI = new BuildUI(overlay, {
  onPart: (p, slot, id) => {
    if (state !== 'BUILD' || !togglePart(garage, p, slot, id)) return;
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
});
const hud = new HUD(overlay);
const fade = document.createElement('div');
fade.className = 'fade';
overlay.appendChild(fade);
/** Jump the camera to its current goal behind a short white fade (no flying through houses). */
function cutCamera(quick = false): void {
  rig.snap(camTargets, 0);
  fade.classList.remove('go', 'quick');
  void fade.offsetWidth;
  fade.classList.add('go');
  if (quick) fade.classList.add('quick');
}
/** Cut the camera back to the start line behind a short fade. */
function cutToStart(): void {
  cutCamera();
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
  buildUI.render({ garage, names, colors: PLAYER_COLORS, wind, round, lastRuns });
}

/** Show each player's fitted car, or the part they are hovering. */
function refreshCars(): void {
  for (const p of PLAYERS) cars[p].setConfig(previews[p] ?? garage.builds[p].config);
}

/** READY locks a player's car in; the race starts as soon as both players are ready. */
function toggleReady(p: PlayerIndex, ready = !garage.builds[p].ready): boolean {
  if (state !== 'BUILD' || !setReady(garage, p, ready)) return false;
  sound.readyChime(ready);
  renderBuild();
  if (allReady(garage)) startCountdown();
  return true;
}

function garageKey(p: PlayerIndex, action: GarageAction, repeat: boolean): void {
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
  sims = null;
  raceConfigs = null;
  results = null;
  firstLaunchSeen = false;
  garage = newGarage(lastConfigs, tabs);
  garageAt = performance.now();
  if (autobuild) for (const p of PLAYERS) randomize(garage, p, buildRng);
  previews[0] = previews[1] = null;
  for (const c of cars) {
    c.stopAudio();
    c.trail.clear();
    c.placeAtStart();
  }
  splashes.clear();
  refreshCars();
  rig.setMode('build');
  hud.hideResults();
  hud.show(false);
  hud.showCountdown(null);
  buildUI.show(true);
  renderBuild();
}

function startCountdown(): boolean {
  if (state !== 'BUILD') return false;
  raceConfigs = [{ ...garage.builds[0].config }, { ...garage.builds[1].config }];
  previews[0] = previews[1] = null;
  for (const p of PLAYERS) cars[p].setConfig(raceConfigs[p]);
  state = 'COUNTDOWN';
  stateTime = 0;
  countIndex = -1;
  buildUI.show(false);
  hud.setup(names, PLAYER_COLORS, wind);
  hud.showCars(true);
  hud.show(true);
  for (const c of cars) c.mesh?.setWingsOpen(false);
  rig.setMode('countdown');
  return true;
}

function startRace(): void {
  if (!raceConfigs) return;
  sims = [new CarSim(computeStats(raceConfigs[0]), wind), new CarSim(computeStats(raceConfigs[1]), wind)];
  accumulator = 0;
  eventLog.length = 0;
  state = 'RACE';
  stateTime = 0;
  doneTime = -1;
  firstLaunchSeen = false;
  lastSplashAt = -1;
  rig.setMode('chase');
  for (const p of PLAYERS) {
    const kind = getOption('engine', raceConfigs[p].engine).id as EngineKind;
    cars[p].engine = sound.engine(kind, p === 0 ? -0.45 : 0.45);
  }
}

function handleEvent(p: PlayerIndex, e: SimEvent): void {
  eventLog.push({ t: gameClock, player: p, event: e });
  const car = cars[p];
  const pan = p === 0 ? -0.45 : 0.45;
  switch (e.type) {
    case 'bump':
      car.hopV = 2.2 + Math.min(3, (sims?.[p].state.speed ?? 10) / 12);
      sound.thump(pan);
      break;
    case 'fuelEmpty':
      hud.flash(p, 'empty', 'OUT OF FUEL', 'empty', gameClock, 2.5);
      break;
    case 'launch': {
      const pct = Math.round(e.wastedFuelFrac * 100);
      hud.flash(p, 'waste', pct >= 1 ? `WASTED ${pct}% FUEL` : 'ALL FUEL USED', pct >= 1 ? 'waste' : 'air', gameClock, 3.5);
      car.engine?.stop();
      car.engine = null;
      car.wind = sound.wind(pan);
      sound.launch(pan);
      car.mesh?.setKiteOpen(true);
      car.mesh?.setThrottle(0);
      if (raceConfigs && raceConfigs[p].booster === 'nitro') car.nitro = 1;
      if (!firstLaunchSeen) {
        firstLaunchSeen = true;
        state = 'FLIGHT';
        stateTime = 0;
        rig.setMode('side');
      }
      break;
    }
    case 'wingsOpen':
      car.mesh?.setWingsOpen(true);
      hud.flash(p, 'wings', 'GLIDING!', 'air', gameClock, 2.5);
      sound.wings(pan);
      break;
    case 'splash': {
      car.splashT = 0;
      lastSplashAt = gameClock;
      const pos = new THREE.Vector3(e.x, 0, TRACK.laneZ[p]);
      splashes.spawn(pos, e.speed, PLAYER_COLORS[p]);
      sound.splash(pan, e.speed / 30);
      car.wind?.stop();
      car.wind = null;
      break;
    }
    case 'dnf':
      hud.flash(p, 'dnf', 'STALLED · DNF', 'dnf', gameClock, 0);
      car.stopAudio();
      car.mesh?.setThrottle(0);
      break;
  }
}

function finishRace(): void {
  if (!sims || !raceConfigs) return;
  const res: SimResult[] = [sims[0].result(), sims[1].result()];
  const d = res.map((r) => (r.dnf ? 0 : r.distance));
  let winner: PlayerIndex | null = null;
  if (Math.abs(d[0] - d[1]) > 0.005) winner = d[0] > d[1] ? 0 : 1;
  if (d[0] <= 0 && d[1] <= 0) winner = null;
  let newRecord = false;
  for (const p of PLAYERS) {
    if (!res[p].dnf && d[p] > (sessionBest?.distance ?? 0)) {
      sessionBest = { distance: d[p], name: names[p], player: p, round };
      newRecord = true;
    }
  }
  if (sessionBest) bay.setBest(sessionBest.distance, sessionBest.name, PLAYER_COLORS[sessionBest.player]);
  lastConfigs = [raceConfigs[0], raceConfigs[1]];
  lastRuns = [
    { distance: d[0], dnf: res[0].dnf },
    { distance: d[1], dnf: res[1].dnf },
  ];
  results = {
    round,
    wind,
    winner,
    players: PLAYERS.map((p) => ({
      name: names[p],
      config: { ...raceConfigs![p] },
      distance: d[p],
      dnf: res[p].dnf,
      launchSpeed: res[p].launchSpeed,
      wastedFuelFrac: res[p].wastedFuelFrac,
      runTime: res[p].runTime,
      flightTime: res[p].flightTime,
      wheelspinTime: res[p].wheelspinTime,
      maxHeight: res[p].maxHeight,
      bumpsHit: res[p].bumpsHit,
      fuelEmptyAt: res[p].fuelEmptyAt,
    })),
    sessionBest: sessionBest ? { ...sessionBest } : null,
  };
  const view: ResultsView = {
    rows: [0, 1].map((p) => ({
      name: names[p],
      color: PLAYER_COLORS[p],
      distance: d[p],
      dnf: res[p].dnf,
      launchKmh: res[p].launchSpeed * 3.6,
      wastedFuelFrac: res[p].wastedFuelFrac,
      airTime: res[p].flightTime,
    })) as ResultsView['rows'],
    winner,
    round,
    wind,
    best: sessionBest ? { distance: sessionBest.distance, name: sessionBest.name, round: sessionBest.round } : null,
    newRecord,
  };
  state = 'RESULTS';
  stateTime = 0;
  resultsAt = performance.now();
  rig.setMode(firstLaunchSeen ? 'results' : 'stalled');
  hud.showCars(false);
  for (const p of PLAYERS) hud.setTag(p, 0, 0, false);
  hud.showResults(
    view,
    () => {
      sound.click();
      rematch();
    },
    () => {
      sound.click();
      newPlayers();
    },
  );
  sound.cheer();
}

/** Back to the garage with both cars as they raced, ready to tweak. */
function rematch(): boolean {
  if (state !== 'RESULTS') return false;
  round++;
  wind = rollWind();
  enterBuild([garage.builds[0].tab, garage.builds[1].tab]);
  cutToStart();
  return true;
}

function newPlayers(): boolean {
  names = [...DEFAULT_NAMES];
  round = 1;
  lastConfigs = [null, null];
  lastRuns = [null, null];
  sessionBest = null;
  bay.setBest(null);
  wind = rollWind();
  enterBuild();
  cutToStart();
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
  // Leave browser shortcuts (Cmd+D, Ctrl+W, ...) alone.
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'm' || e.key === 'M') {
    e.preventDefault();
    sound.toggleMute();
    return;
  }
  // A button reached with Tab keeps its native Enter/Space press (mouse clicks blur buttons).
  if ((e.key === 'Enter' || e.key === ' ') && target?.closest('button')) return;
  if (state === 'BUILD') {
    const key = garageKeys.get(e.code);
    if (!key) return;
    e.preventDefault();
    garageKey(key.p, key.action, e.repeat);
  } else if (state === 'RESULTS' && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    // READY keys still being mashed from the race mustn't skip the results.
    if (e.repeat || performance.now() - resultsAt < RESULTS_KEY_GRACE) return;
    sound.click();
    rematch();
  }
});
window.addEventListener('resize', () => world.resize());

// ---------- Frame loop ----------
const timer = new THREE.Timer();
timer.connect(document);
const tagPos = new THREE.Vector3();
const camTargets: CameraTarget[] = [0, 1].map(() => ({
  pos: new THREE.Vector3(),
  active: true,
  inFlight: false,
  splashed: false,
}));
let frames = 0;
let tagUpper: PlayerIndex = 0;

function updateGantry(dt: number): void {
  if (!gantry) return;
  const cam = camera.position;
  const racing = state === 'RACE' || state === 'FLIGHT';
  // Only once a car has driven under the banner can it come between the camera and the cars.
  const carPassed = !!sims && sims.some((sim) => sim.state.pos.x > 3);
  if (!racing || cam.x >= 4) gantryHidden = false;
  else if (carPassed && cam.x > -45 && cam.y - TRACK.startY > 4.9) gantryHidden = true;
  // Once faded it stays faded until the camera itself has passed the gantry.
  gantryOpacity += ((gantryHidden ? 0 : 1) - gantryOpacity) * damp(10, dt);
  for (const m of gantryMats) {
    m.opacity = gantryOpacity;
    m.depthWrite = gantryOpacity > 0.5;
  }
  gantry.visible = gantryOpacity > 0.02;
}

function updateCars(dt: number, gdt: number, t: number): void {
  const building = state === 'BUILD';
  for (const p of PLAYERS) {
    const car = cars[p];
    const mesh = car.mesh;
    const z = TRACK.laneZ[p];
    // Turntable in the garage; face forward otherwise.
    if (building) {
      car.yaw += dt * 0.55;
      car.holder.rotation.y = car.yaw + (p === 0 ? 0.6 : -0.6);
    } else {
      const target = Math.round(car.holder.rotation.y / (Math.PI * 2)) * Math.PI * 2;
      car.holder.rotation.y += (target - car.holder.rotation.y) * damp(5, dt);
      car.yaw = car.holder.rotation.y;
    }
    const sim = sims?.[p];
    if (!sim || state === 'COUNTDOWN') {
      if (state === 'COUNTDOWN') mesh?.setThrottle(0.25 + 0.15 * Math.sin(t * 30));
      mesh?.update(dt, t);
      continue;
    }
    const st = sim.state;
    let targetPitch = car.pitch;
    if (st.phase === 'run' || st.phase === 'dnf') {
      car.root.position.set(st.pos.x, st.pos.y, z);
      targetPitch = st.angle;
      mesh?.setThrottle(st.engineOn ? (st.wheelspin ? 1 : 0.8) : 0);
    } else if (st.phase === 'flight') {
      car.root.position.set(st.pos.x, st.pos.y, z);
      targetPitch = Math.atan2(st.vel.y, st.vel.x) * 0.85;
      car.trail.add(tagPos.set(st.pos.x, st.pos.y + 0.7, z));
    } else if (st.phase === 'splashed') {
      car.splashT += gdt;
      const bob = bay.waveHeight(st.pos.x, z, t) * 2.2;
      const sink = Math.max(0, car.splashT - 1.8) * 0.32;
      car.root.position.set(st.pos.x, bob - 0.35 - Math.min(sink, 5), z);
      targetPitch = -0.12 + Math.sin(t * 1.7 + p) * 0.06;
    }
    car.pitch += (targetPitch - car.pitch) * damp(st.phase === 'flight' ? 3 : 9, gdt);
    car.root.rotation.z = car.pitch;
    // Wheels roll with speed on the road and wind down in the air.
    const r = mesh?.wheelRadius ?? 0.3;
    if (st.phase === 'run') car.wheelAngle -= (st.speed * gdt) / r;
    else if (st.phase === 'flight') car.wheelAngle -= (st.speed * 0.5 * gdt) / r;
    mesh?.setWheelRotation(car.wheelAngle);
    // Bump hop.
    car.hopV -= 9.81 * gdt;
    car.hopY = Math.max(0, car.hopY + car.hopV * gdt);
    if (car.hopY === 0 && car.hopV < 0) car.hopV = 0;
    car.holder.position.y = car.hopY;
    // Nitro flame fades after the lip.
    car.nitro = Math.max(0, car.nitro - gdt * 0.9);
    mesh?.setNitro(car.nitro);
    mesh?.update(dt, t);
    car.engine?.set(st.speed, st.engineOn, st.wheelspin);
    if (st.phase === 'flight') car.wind?.set(Math.hypot(st.vel.x - wind, st.vel.y));
  }
}

function frame(): void {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  const t = timer.getElapsed();
  const gdt = dt * simSpeed;
  stateTime += gdt;
  gameClock += gdt;

  if (state === 'COUNTDOWN') {
    const idx = Math.floor(stateTime / COUNT_STEP);
    if (idx !== countIndex) {
      countIndex = idx;
      const labels = ['3', '2', '1', 'GO!'];
      if (idx < 4) {
        hud.showCountdown(labels[idx]);
        sound.beep(idx === 3);
      }
      if (idx === 3) startRace();
    }
  } else if ((state === 'RACE' || state === 'FLIGHT') && sims) {
    if (stateTime > COUNT_STEP * 1.1) hud.showCountdown(null);
    accumulator += gdt;
    let steps = 0;
    while (accumulator >= DT && steps < 5000) {
      accumulator -= DT;
      steps++;
      for (const p of PLAYERS) {
        if (sims[p].done) continue;
        for (const e of sims[p].step(DT)) handleEvent(p, e);
      }
    }
    // Camera: side-on while anyone is airborne. If the other car is still well up the hill after a
    // splash, cut (behind a quick fade) to chase it, and cut back side-on as it nears the lip. A
    // blended swing between the Bay and the hill would fly through the houses.
    if (state === 'FLIGHT') {
      const phases = sims.map((sim) => sim.state.phase);
      const runner = PLAYERS.find((p) => phases[p] === 'run');
      if (phases.includes('flight')) rig.setMode('side');
      else if (runner !== undefined) {
        const far = sims[runner].state.s < TRACK.lip.s - 55;
        if (far && gameClock - lastSplashAt > 1.6 && rig.mode !== 'chase') {
          rig.setMode('chase');
          cutCamera(true);
        } else if (!far && rig.mode === 'chase') {
          rig.setMode('side');
          cutCamera(true);
        }
      }
    }
    if (sims[0].done && sims[1].done) {
      if (doneTime < 0) doneTime = stateTime;
      // Nobody launched: skip straight to the results after a short pause.
      if (stateTime - doneTime > (firstLaunchSeen ? RESULTS_DELAY : 1.2)) finishRace();
    }
  }

  // HUD.
  if (sims && (state === 'RACE' || state === 'FLIGHT')) {
    for (const p of PLAYERS) {
      const st = sims[p].state;
      hud.update(
        p,
        {
          speedKmh: st.speed * 3.6,
          fuelFrac: st.fuelFrac,
          wheelspin: st.wheelspin,
          phase: st.phase,
          distance: st.distance,
        },
        gameClock,
      );
    }
  }

  updateCars(dt, gdt, t);

  // Camera targets.
  for (const p of PLAYERS) {
    const ct = camTargets[p];
    ct.pos.copy(cars[p].root.position);
    const ph = sims?.[p].state.phase;
    ct.active = !ph || ph === 'run' || ph === 'flight';
    ct.inFlight = ph === 'flight';
    ct.splashed = ph === 'splashed';
  }
  rig.update(state === 'BUILD' ? dt : gdt, t, camTargets);
  updateGantry(dt);
  world.setShadowFocus(rig.focus, state === 'BUILD' ? 40 : 60);

  // Name tags over the cars while racing.
  const racing = state === 'COUNTDOWN' || state === 'RACE' || state === 'FLIGHT';
  const w = world.renderer.domElement.clientWidth;
  const h = world.renderer.domElement.clientHeight;
  const tags: { x: number; y: number; vis: boolean }[] = [];
  for (const p of PLAYERS) {
    tagPos.copy(cars[p].root.position);
    tagPos.y += 3.2;
    tagPos.project(camera);
    const vis = racing && tagPos.z < 1 && Math.abs(tagPos.x) < 1.05 && Math.abs(tagPos.y) < 1.05;
    tags.push({ x: (tagPos.x * 0.5 + 0.5) * w, y: (-tagPos.y * 0.5 + 0.5) * h, vis });
  }
  // Keep the two tags from stacking when the cars are side by side on screen. The vertical gap they
  // need shrinks smoothly as they move apart sideways, and a tag only moves as far as it has to, so
  // nothing pops; which tag sits on top only changes when the order clearly flips.
  if (tags[0].vis && tags[1].vis) {
    const dy = tags[0].y - tags[1].y;
    if (dy < -12) tagUpper = 0;
    else if (dy > 12) tagUpper = 1;
    const need = 34 * THREE.MathUtils.clamp((140 - Math.abs(tags[0].x - tags[1].x)) / 40, 0, 1);
    tags[tagUpper].y = Math.min(tags[tagUpper].y, tags[1 - tagUpper].y - need);
  }
  for (const p of PLAYERS) hud.setTag(p, tags[p].x, tags[p].y, tags[p].vis);

  for (const c of cars) c.trail.update(camera);
  splashes.update(gdt);
  city.update(dt, t);
  landmarks.update(dt, t);
  bay.update(dt, t, camera);
  world.render();
  if (++frames === 3) api.ready = true;
}

// ---------- Test hooks ----------
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
  /** Live sim state per car during a race. */
  get cars() {
    return sims ? sims.map((s) => structuredClone(s.state)) : null;
  },
  get events() {
    return eventLog.map((e) => ({ ...e, event: { ...e.event } }));
  },
  get sessionBest() {
    return sessionBest ? { ...sessionBest } : null;
  },
  /** Audio state: started (after the first click/key), muted, and the current output level. */
  get sound() {
    return { ready: sound.ready, muted: sound.muted, level: sound.level() };
  },
  toggleMute(): boolean {
    return sound.toggleMute();
  },
  /** What simulateToEnd predicts for the current configs and wind. */
  predict(): SimResult[] {
    const cfgs = api.configs;
    return cfgs.map((c) => simulateToEnd(computeStats(c), wind));
  },
  computeStats,
  simulateToEnd,
  parts: PARTS,
};

declare global {
  interface Window {
    __game: typeof api;
  }
}
window.__game = api;

enterBuild();
rig.snap(camTargets, 0);
world.renderer.setAnimationLoop(frame);

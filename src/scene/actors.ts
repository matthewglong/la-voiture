// The race's moving cast, drawn from the simulation each frame: toy Waymos (lidar hats spinning,
// hazards blinking, sometimes a protest cone on the hood), wobbly tourist figurines, the map's
// cable cars, loose traffic cones, item boxes, poo and seagulls.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { RaceSim } from '../sim/race';
import { buildCableCar, signTexture } from './props';
import { canvasTexture } from './util';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------
// Shared materials and geometry: built once, reused by every Waymo, tourist, cone and poo of every
// round (a new race only adds and removes meshes, never GPU buffers).

let M: ReturnType<typeof makeMats> | null = null;
function makeMats() {
  return {
    white: new THREE.MeshPhysicalMaterial({ color: '#f6f7f8', roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.15 }),
    black: new THREE.MeshPhysicalMaterial({ color: '#17191d', roughness: 0.2, metalness: 0.2, clearcoat: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#1c2633', roughness: 0.05, metalness: 0.4, clearcoat: 1 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#1d1e21', roughness: 0.85 }),
    hub: new THREE.MeshStandardMaterial({ color: '#c9ced6', roughness: 0.3, metalness: 0.8 }),
    teal: new THREE.MeshStandardMaterial({ color: '#23c4c0', roughness: 0.4, emissive: '#0b5957', emissiveIntensity: 0.4 }),
    hazardOff: new THREE.MeshStandardMaterial({ color: '#7a4a12', roughness: 0.5 }),
    hazardOn: new THREE.MeshStandardMaterial({ color: '#ffb52e', emissive: '#ff9a00', emissiveIntensity: 2.2, roughness: 0.4 }),
    tail: new THREE.MeshStandardMaterial({ color: '#b3141d', emissive: '#4a0508', roughness: 0.4 }),
    cone: new THREE.MeshPhysicalMaterial({ color: '#ff6a1f', roughness: 0.35, clearcoat: 0.8 }),
    coneWhite: new THREE.MeshPhysicalMaterial({ color: '#fbfbf7', roughness: 0.35, clearcoat: 0.8 }),
    skin: new THREE.MeshStandardMaterial({ color: '#f0c6a2', roughness: 0.6 }),
    poo: new THREE.MeshPhysicalMaterial({ color: '#7a4a24', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }),
    eye: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }),
    pupil: new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.3 }),
    gullWhite: new THREE.MeshPhysicalMaterial({ color: '#fbfbf8', roughness: 0.5, clearcoat: 0.4 }),
    gullGrey: new THREE.MeshStandardMaterial({ color: '#98a2ae', roughness: 0.55 }),
    gullTip: new THREE.MeshStandardMaterial({ color: '#23262c', roughness: 0.5 }),
    beak: new THREE.MeshPhysicalMaterial({ color: '#ffc21f', roughness: 0.35, clearcoat: 0.6 }),
    gullLeg: new THREE.MeshStandardMaterial({ color: '#ff8a3d', roughness: 0.5 }),
  };
}
const mats = (): NonNullable<typeof M> => (M ??= makeMats());

/** Plain coloured materials (shirts, shorts, hats), one per colour. */
const matte = new Map<string, THREE.MeshStandardMaterial>();
function matteMat(color: string, roughness: number): THREE.MeshStandardMaterial {
  const key = `${color}/${roughness}`;
  let m = matte.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness });
    matte.set(key, m);
  }
  return m;
}

let GEO: ReturnType<typeof makeGeos> | null = null;
function makeGeos() {
  const tire = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 20);
  tire.rotateX(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.22, 0.22, 0.32, 14);
  hub.rotateX(Math.PI / 2);
  const pooRings = (
    [
      [0.36, 0.13],
      [0.27, 0.12],
      [0.17, 0.1],
    ] as const
  ).map(([R, r]) => {
    const g = new THREE.TorusGeometry(R, r, 10, 24);
    g.rotateX(Math.PI / 2);
    return g;
  });
  return {
    body: new RoundedBoxGeometry(4.5, 0.9, 1.95, 3, 0.3),
    glasshouse: new RoundedBoxGeometry(2.7, 0.62, 1.78, 3, 0.22),
    roof: new RoundedBoxGeometry(2.3, 0.1, 1.7, 2, 0.05),
    stalk: new THREE.CylinderGeometry(0.1, 0.12, 0.2, 10),
    drum: new THREE.CylinderGeometry(0.34, 0.36, 0.3, 18),
    band: new THREE.CylinderGeometry(0.365, 0.365, 0.07, 18),
    cap: new THREE.SphereGeometry(0.34, 16, 8, 0, TAU, 0, Math.PI / 2),
    nub: new THREE.BoxGeometry(0.12, 0.1, 0.16),
    pod: new THREE.SphereGeometry(0.16, 12, 8),
    nosePod: new RoundedBoxGeometry(0.2, 0.24, 0.6, 2, 0.06),
    hazard: new RoundedBoxGeometry(0.12, 0.14, 0.34, 2, 0.04),
    tailLight: new RoundedBoxGeometry(0.1, 0.12, 0.5, 2, 0.04),
    tire,
    hub,
    coneBase: new THREE.BoxGeometry(0.44, 0.05, 0.44),
    coneBody: new THREE.CylinderGeometry(0.015, 0.18, 0.72, 16),
    coneBand: new THREE.CylinderGeometry(0.1, 0.125, 0.12, 16),
    leg: new THREE.CapsuleGeometry(0.075, 0.42, 2, 8),
    torso: new THREE.CapsuleGeometry(0.24, 0.38, 3, 12),
    head: new THREE.SphereGeometry(0.19, 14, 10),
    brim: new THREE.CylinderGeometry(0.3, 0.3, 0.03, 16),
    crown: new THREE.CylinderGeometry(0.15, 0.17, 0.14, 14),
    arm: new THREE.CapsuleGeometry(0.06, 0.34, 2, 6),
    camera: new THREE.BoxGeometry(0.16, 0.12, 0.1),
    pooRings,
    pooTip: new THREE.ConeGeometry(0.12, 0.26, 12),
    eye: new THREE.SphereGeometry(0.075, 10, 8),
    pupil: new THREE.SphereGeometry(0.038, 8, 6),
    fly: new THREE.SphereGeometry(0.035, 6, 4),
    gullBody: new THREE.SphereGeometry(0.5, 16, 12),
    gullHead: new THREE.SphereGeometry(0.2, 14, 10),
    gullBeak: new THREE.ConeGeometry(0.07, 0.3, 10).rotateZ(-Math.PI / 2),
    gullWing: new RoundedBoxGeometry(0.42, 0.04, 0.9, 2, 0.02),
    gullWingTip: new RoundedBoxGeometry(0.3, 0.04, 0.34, 2, 0.02),
    gullTail: new THREE.ConeGeometry(0.16, 0.4, 4).rotateZ(Math.PI / 2),
    gullLeg: new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6),
  };
}
const geos = (): NonNullable<typeof GEO> => (GEO ??= makeGeos());

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A toy traffic cone (on the road, or on a Waymo's hood). */
function buildCone(): THREE.Group {
  const m = mats();
  const g = geos();
  const cone = new THREE.Group();
  cone.add(mesh(g.coneBase, m.cone, 0, 0.025, 0));
  cone.add(mesh(g.coneBody, m.cone, 0, 0.41, 0));
  cone.add(mesh(g.coneBand, m.coneWhite, 0, 0.36, 0));
  return cone;
}

// ---------------------------------------------------------------------------------------------
// Waymo: a white toy SUV, black glasshouse, the spinning lidar "hat", sensor pods and hazards.

interface WaymoView {
  root: THREE.Group;
  lidar: THREE.Object3D;
  hazards: THREE.Mesh[];
  cone: THREE.Object3D;
  wheels: THREE.Object3D[];
  roll: number;
  /** Drawn see-through for the view being drawn (the camera is on top of it, or it hides a car). */
  faded: boolean;
}

function buildWaymo(): WaymoView {
  const m = mats();
  const g = geos();
  const root = new THREE.Group();
  root.name = 'waymo';
  const body = new THREE.Group();
  root.add(body);
  body.add(mesh(g.body, m.white, 0, 0.78, 0));
  // Glasshouse with a sloping windscreen, white roof.
  body.add(mesh(g.glasshouse, m.glass, -0.25, 1.46, 0));
  body.add(mesh(g.roof, m.white, -0.35, 1.8, 0));
  // Lidar: a dark drum on a stalk, with a teal band. It spins.
  body.add(mesh(g.stalk, m.black, -0.1, 1.95, 0));
  const lidar = new THREE.Group();
  lidar.position.set(-0.1, 2.12, 0);
  lidar.add(mesh(g.drum, m.black));
  lidar.add(mesh(g.band, m.teal));
  lidar.add(mesh(g.cap, m.black, 0, 0.14, 0));
  lidar.add(mesh(g.nub, m.teal, 0.34, 0, 0));
  body.add(lidar);
  // Sensor pods on the front wings and the nose.
  for (const s of [1, -1]) body.add(mesh(g.pod, m.black, 1.55, 1.3, s * 0.95));
  body.add(mesh(g.nosePod, m.black, 2.27, 0.95, 0));
  // Hazard lights front and back.
  const hazards: THREE.Mesh[] = [];
  for (const x of [2.2, -2.2]) {
    for (const s of [1, -1]) {
      const h = mesh(g.hazard, m.hazardOff, x, 0.98, s * 0.72);
      hazards.push(h);
      body.add(h);
    }
  }
  for (const s of [1, -1]) body.add(mesh(g.tailLight, m.tail, -2.24, 1.08, s * 0.5));
  // Wheels.
  const wheels: THREE.Object3D[] = [];
  for (const x of [1.45, -1.45]) {
    for (const s of [1, -1]) {
      const w = new THREE.Group();
      w.position.set(x, 0.4, s * 0.86);
      w.add(mesh(g.tire, m.rubber), mesh(g.hub, m.hub));
      wheels.push(w);
      root.add(w);
    }
  }
  // A traffic cone on the hood: SF's way of stopping a robotaxi. Oversized, so it reads from a
  // chase camera over the lidar.
  const cone = buildCone();
  cone.position.set(1.4, 1.24, 0);
  cone.rotation.z = -0.1;
  cone.scale.setScalar(1.45);
  cone.visible = false;
  body.add(cone);
  return { root, lidar, hazards, cone, wheels, roll: 0, faded: false };
}

// ---------------------------------------------------------------------------------------------
// Tourists: wobbly toy figures in bright shirts, some with cameras. They topple and bob back up.

interface PedView {
  root: THREE.Group;
  body: THREE.Group;
  legs: THREE.Object3D[];
  arm: THREE.Object3D;
  wobble: number;
  wobbleV: number;
  tilt: number;
}

const SHIRTS = ['#ff4f7a', '#2fb5ff', '#ffd23f', '#7ad151', '#b67dff', '#ff8a3d', '#1fd1c0', '#f7f7f7'];
const HATS = ['#ffffff', '#e8322a', '#2b2f36', '#ffd23f', '#3ccf7a'];

function buildPed(seed: number, tourist: boolean): PedView {
  const m = mats();
  const g = geos();
  const root = new THREE.Group();
  root.name = 'pedestrian';
  const body = new THREE.Group();
  root.add(body);
  const shirt = matteMat(SHIRTS[seed % SHIRTS.length], 0.55);
  const shorts = matteMat(seed % 3 === 0 ? '#2e4a7a' : '#d8c49a', 0.7);
  const legs: THREE.Object3D[] = [];
  for (const s of [1, -1]) {
    const leg = new THREE.Group();
    leg.position.set(0, 0.62, s * 0.11);
    leg.add(mesh(g.leg, shorts, 0, -0.3, 0));
    legs.push(leg);
    body.add(leg);
  }
  body.add(mesh(g.torso, shirt, 0, 0.98, 0));
  body.add(mesh(g.head, m.skin, 0, 1.52, 0));
  if (tourist || seed % 2 === 0) {
    const hm = matteMat(HATS[seed % HATS.length], 0.6);
    body.add(mesh(g.brim, hm, 0, 1.64, 0));
    body.add(mesh(g.crown, hm, 0, 1.71, 0));
  }
  const arm = new THREE.Group();
  arm.position.set(0.05, 1.22, 0.25);
  arm.add(mesh(g.arm, shirt, 0.12, -0.12, 0));
  if (tourist) arm.add(mesh(g.camera, m.black, 0.32, -0.02, -0.05));
  body.add(arm);
  return { root, body, legs, arm, wobble: 0, wobbleV: 0, tilt: 0 };
}

// ---------------------------------------------------------------------------------------------
// Poo: a glossy swirl with eyes (the emoji, in toy form), and a couple of flies.

interface PooView {
  root: THREE.Group;
  flies: THREE.Object3D[];
  born: number;
  splat: number;
  /** When a car drove through it (it stays squashed on the road for a while). */
  hitT: number | null;
}

function buildPoo(): PooView {
  const m = mats();
  const g = geos();
  const root = new THREE.Group();
  root.name = 'poo';
  const swirl = new THREE.Group();
  root.add(swirl);
  const ys = [0.13, 0.33, 0.5];
  g.pooRings.forEach((ring, i) => swirl.add(mesh(ring, m.poo, 0, ys[i], 0)));
  swirl.add(mesh(g.pooTip, m.poo, 0, 0.66, 0));
  for (const s of [1, -1]) {
    swirl.add(mesh(g.eye, m.eye, 0.26, 0.4, s * 0.1));
    swirl.add(mesh(g.pupil, m.pupil, 0.32, 0.4, s * 0.1));
  }
  const flies: THREE.Object3D[] = [];
  for (let i = 0; i < 2; i++) {
    const f = mesh(g.fly, m.pupil);
    flies.push(f);
    root.add(f);
  }
  return { root, flies, born: 0, splat: 0, hitT: null };
}

// ---------------------------------------------------------------------------------------------
// Seagulls (the item): a big cartoon gull, grey wings with black tips, a yellow beak. It flaps
// along the course, then frantically on its victim's windscreen.

interface GullView {
  root: THREE.Group;
  wings: [THREE.Group, THREE.Group];
  legs: THREE.Group;
}

function buildGull(): GullView {
  const m = mats();
  const g = geos();
  const root = new THREE.Group();
  root.name = 'seagull';
  const body = new THREE.Group();
  body.scale.setScalar(1.6);
  root.add(body);
  const torso = mesh(g.gullBody, m.gullWhite, 0, 0, 0);
  torso.scale.set(1, 0.42, 0.42);
  body.add(torso);
  body.add(mesh(g.gullHead, m.gullWhite, 0.45, 0.12, 0));
  body.add(mesh(g.gullBeak, m.beak, 0.72, 0.1, 0));
  for (const s of [1, -1]) {
    body.add(mesh(g.eye, m.eye, 0.56, 0.2, s * 0.1));
    body.add(mesh(g.pupil, m.pupil, 0.61, 0.21, s * 0.11));
  }
  body.add(mesh(g.gullTail, m.gullGrey, -0.55, 0.02, 0));
  const wings: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.02, 0.08, s * 0.14);
    pivot.add(mesh(g.gullWing, m.gullGrey, 0, 0, s * 0.45));
    pivot.add(mesh(g.gullWingTip, m.gullTip, -0.04, 0, s * 1.02));
    body.add(pivot);
    wings.push(pivot);
  }
  const legs = new THREE.Group();
  for (const s of [1, -1]) legs.add(mesh(g.gullLeg, m.gullLeg, 0.05, -0.28, s * 0.08));
  body.add(legs);
  return { root, wings: wings as [THREE.Group, THREE.Group], legs };
}

// ---------------------------------------------------------------------------------------------
// Item boxes: glossy rainbow cubes with a question mark, spinning and bobbing.

function boxTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#ff5a8a');
    g.addColorStop(0.25, '#ffd23f');
    g.addColorStop(0.5, '#3ccf7a');
    g.addColorStop(0.75, '#2e9bff');
    g.addColorStop(1, '#b06bff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(18, 18, w - 36, h - 36);
    ctx.font = '900 190px "Arial Rounded MT Bold", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#1b1b1f';
    ctx.strokeText('?', w / 2, h / 2 + 10);
    ctx.fillStyle = '#ffcf2e';
    ctx.fillText('?', w / 2, h / 2 + 10);
  });
}

// ---------------------------------------------------------------------------------------------

export class Actors {
  readonly group = new THREE.Group();
  private waymos = new Map<number, WaymoView>();
  private peds = new Map<number, PedView>();
  private poos = new Map<number, PooView>();
  private boxes = new Map<number, { root: THREE.Object3D; scale: number; seen: number }>();
  private cones = new Map<number, THREE.Object3D>();
  private gulls = new Map<number, GullView>();
  /** Cable cars: built once and kept (they only move between rounds), one per car on the rails. */
  private readonly cables: { root: THREE.Group; faded: boolean; sign: string }[] = [];
  private readonly boxGeo = new RoundedBoxGeometry(1.25, 1.25, 1.25, 3, 0.18);
  private readonly boxMat = new THREE.MeshPhysicalMaterial({
    map: boxTexture(),
    roughness: 0.15,
    clearcoat: 1,
    transparent: true,
    opacity: 0.92,
    emissive: '#ffffff',
    emissiveIntensity: 0.12,
  });
  /** Dithered see-through stand-ins for the shared materials (and the way back). */
  private readonly fadedOf = new Map<THREE.Material, THREE.Material>();
  private readonly solidOf = new Map<THREE.Material, THREE.Material>();
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly fall = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private static readonly UP = new THREE.Vector3(0, 1, 0);

  constructor() {
    this.group.name = 'actors';
  }

  /** Clear the cast (a new race builds its own lazily from the sim). Only meshes go: the geometry
   *  and materials are shared, and the cable car waits for the next round. */
  reset(): void {
    for (const o of [...this.group.children]) this.group.remove(o);
    this.waymos.clear();
    this.peds.clear();
    this.poos.clear();
    this.boxes.clear();
    this.cones.clear();
    this.gulls.clear();
  }

  update(dt: number, t: number, sim: RaceSim | null): void {
    if (!sim) return;
    const m = mats();
    // Waymos.
    for (const w of sim.waymos) {
      let v = this.waymos.get(w.id);
      if (!v) {
        v = buildWaymo();
        v.cone.visible = w.cone;
        this.waymos.set(w.id, v);
        this.group.add(v.root);
      }
      v.root.position.set(w.x, w.y, w.z);
      v.root.rotation.set(0, -w.heading, 0);
      v.lidar.rotation.y += dt * 9;
      const blink = w.hazard && Math.floor(t * 2.6) % 2 === 0;
      const hazard = blink ? m.hazardOn : m.hazardOff;
      for (const h of v.hazards) h.material = v.faded ? this.faded(hazard) : hazard;
      const moving = w.parked || w.kind === 'stalled' || w.stopped > 0 ? 0 : w.v;
      for (const wh of v.wheels) wh.rotation.z -= (moving * dt) / 0.4;
      // A knock rocks it on its springs.
      v.roll += (Math.hypot(w.pvx, w.pvz) * 0.05 - v.roll) * Math.min(1, dt * 8);
      v.root.children[0].rotation.x = Math.sin(t * 14) * v.roll;
    }
    // Pedestrians.
    for (const p of sim.peds) {
      let v = this.peds.get(p.id);
      if (!v) {
        v = buildPed(p.color, p.kind === 'tourist');
        this.peds.set(p.id, v);
        this.group.add(v.root);
      }
      v.root.position.set(p.x, p.y, p.z);
      v.root.rotation.set(0, -p.heading, 0);
      // Walk cycle.
      const walking = p.down <= 0 && p.dive <= 0 && ((p.kind === 'crosser' && p.wait <= 0) || p.speed > 0);
      const swing = walking ? Math.sin(p.walk * 9) * 0.5 : 0;
      v.legs[0].rotation.z = swing;
      v.legs[1].rotation.z = -swing;
      v.arm.rotation.z = p.kind === 'tourist' && !walking ? 1.3 + Math.sin(t * 1.5 + p.id) * 0.1 : -swing * 0.6;
      // Knocked over like a weeble: tip away from the car, then wobble back up.
      const target = p.down > 0.4 ? 1.35 : p.dive > 0 ? 1.1 : 0;
      v.wobbleV += ((target - v.tilt) * 60 - v.wobbleV * 7) * dt;
      v.tilt += v.wobbleV * dt;
      this.fall.set(p.fallX, 0, p.fallZ);
      this.axis.crossVectors(Actors.UP, this.fall);
      if (this.axis.lengthSq() > 1e-6) {
        this.axis.normalize().applyQuaternion(this.tmpQ.copy(v.root.quaternion).invert());
        v.body.quaternion.setFromAxisAngle(this.axis, v.tilt);
      } else v.body.quaternion.identity();
      v.body.position.y = p.dive > 0.6 ? Math.sin((1.4 - p.dive) * 4) * 0.8 : 0;
    }
    // Poo.
    for (const q of sim.poos) {
      let v = this.poos.get(q.id);
      if (!v) {
        v = buildPoo();
        v.born = t;
        this.poos.set(q.id, v);
        this.group.add(v.root);
      }
      v.root.position.set(q.x, q.y, q.z);
      if (!q.alive) {
        v.hitT ??= t;
        v.splat = Math.min(1, v.splat + dt * 5);
      }
      const age = t - v.born;
      const drop = Math.max(0, 1 - age * 3);
      v.root.position.y += drop * 1.2;
      const squash = age < 0.6 ? 1 + Math.sin(age * 20) * 0.15 * (1 - age / 0.6) : 1;
      // Run over: splatted flat and wide on the road, and it stays there a while (shrinking away).
      const gone = v.hitT === null ? 0 : Math.max(0, (t - v.hitT - 6) / 2);
      const wide = (1 + v.splat * 1.7) * (1 - Math.min(1, gone));
      v.root.scale.set(Math.max(0.001, wide), Math.max(0.04, squash * (1 - v.splat * 0.92)), Math.max(0.001, wide));
      v.root.visible = gone < 1;
      v.flies.forEach((f, i) => {
        const a = t * (5 + i) + i * 2;
        f.position.set(Math.cos(a) * 0.5, 0.8 + Math.sin(t * 7 + i) * 0.12, Math.sin(a) * 0.5);
        f.visible = q.alive;
      });
    }
    // Item boxes.
    for (const b of sim.boxes) {
      let v = this.boxes.get(b.id);
      if (!v) {
        const root = new THREE.Mesh(this.boxGeo, this.boxMat);
        root.castShadow = true;
        v = { root, scale: 1, seen: 0 };
        this.boxes.set(b.id, v);
        this.group.add(root);
      }
      const target = b.hidden > 0 ? 0 : 1;
      v.scale += (target - v.scale) * Math.min(1, dt * (target > v.scale ? 5 : 18));
      const pop = target === 1 && v.scale < 0.98 ? Math.sin(v.scale * Math.PI) * 0.25 : 0;
      v.root.scale.setScalar(Math.max(0.001, v.scale + pop));
      v.root.visible = v.scale > 0.02;
      v.root.position.set(b.x, b.y + 1.15 + Math.sin(t * 2.4 + b.id) * 0.15, b.z);
      v.root.rotation.set(0.35, t * 1.4 + b.id, 0.2);
    }
    // Loose cones.
    for (const c of sim.cones) {
      let v = this.cones.get(c.id);
      if (!v) {
        v = buildCone();
        this.cones.set(c.id, v);
        this.group.add(v);
      }
      v.position.set(c.x, c.y, c.z);
      v.rotation.set(c.rx, 0, c.rz);
    }
    // Seagulls: they come and go during a race.
    for (const g of sim.gulls) {
      let v = this.gulls.get(g.id);
      if (!v) {
        v = buildGull();
        this.gulls.set(g.id, v);
        this.group.add(v.root);
      }
      const perched = g.state === 'perch';
      v.root.position.set(g.x, g.y + (perched ? Math.abs(Math.sin(t * 11 + g.id)) * 0.15 : Math.sin(t * 6 + g.id) * 0.1), g.z);
      v.root.rotation.set(0, -g.heading, perched ? 0.25 : g.state === 'leave' ? 0.3 : -0.08);
      const flap = Math.sin(t * (perched ? 26 : 13) + g.id) * (perched ? 0.95 : 0.6);
      v.wings[0].rotation.x = -flap;
      v.wings[1].rotation.x = flap;
      v.legs.visible = perched;
    }
    for (const [id, v] of this.gulls) {
      if (sim.gulls.some((g) => g.id === id)) continue;
      this.group.remove(v.root);
      this.gulls.delete(id);
    }
    // The cable cars.
    sim.cables.forEach((cb, i) => {
      let v = this.cables[i];
      if (!v || v.sign !== cb.sign) {
        if (v) this.group.remove(v.root);
        const signMat = new THREE.MeshStandardMaterial({ map: signTexture(cb.sign, '#1d1d22', '#f6e7b8'), roughness: 0.5 });
        v = this.cables[i] = { root: buildCableCar(signMat, m.glass), faded: false, sign: cb.sign };
      }
      if (v.root.parent !== this.group) this.group.add(v.root);
      v.root.position.set(cb.x, cb.y + 0.07, cb.z);
      v.root.rotation.y = -cb.heading;
    });
  }

  /**
   * Just before a view is drawn: Waymos (and the cable car) that the camera is right up against,
   * or that stand between the camera and a car it follows, are drawn see-through (dithered, so
   * there's nothing to sort) instead of filling the screen with white panels.
   */
  fadeFor(cam: THREE.Vector3, cars: THREE.Vector3[]): void {
    for (const v of this.waymos.values()) {
      const fade = this.inTheWay(v.root, cam, cars, 2.5, 2.6, 1.15);
      if (fade !== v.faded) {
        v.faded = fade;
        this.swap(v.root, fade);
      }
    }
    for (const v of this.cables) {
      if (!v.root.parent) continue;
      const fade = this.inTheWay(v.root, cam, cars, 4.4, 3.4, 1.35);
      if (fade !== v.faded) {
        v.faded = fade;
        this.swap(v.root, fade);
      }
    }
  }

  private faded(m: THREE.Material): THREE.Material {
    let f = this.fadedOf.get(m);
    if (!f) {
      f = m.clone();
      f.alphaHash = true;
      f.opacity = 0.28;
      this.fadedOf.set(m, f);
      this.solidOf.set(f, m);
    }
    return f;
  }

  private swap(root: THREE.Object3D, fade: boolean): void {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const solid = this.solidOf.get(mesh.material) ?? mesh.material;
      mesh.material = fade ? this.faded(solid) : solid;
    });
  }

  /** The camera within a metre and a half of this box (half-lengths hx, hz, height h, in the
   *  object's own frame), or the box crossing the sightline to one of the cars. */
  private inTheWay(root: THREE.Object3D, cam: THREE.Vector3, cars: THREE.Vector3[], hx: number, h: number, hz: number): boolean {
    root.updateMatrixWorld();
    const a = root.worldToLocal(this.tmpA.copy(cam));
    const dx = Math.max(Math.abs(a.x) - hx, 0);
    const dy = Math.max(a.y - h, -a.y, 0);
    const dz = Math.max(Math.abs(a.z) - hz, 0);
    if (dx * dx + dy * dy + dz * dz < 1.5 * 1.5) return true;
    for (const car of cars) {
      const b = root.worldToLocal(this.tmpB.copy(car));
      b.y += 0.8;
      // Slab test on the segment camera → car (stopping short of the car itself).
      this.t0 = 0;
      this.t1 = 0.92;
      const hit = this.slab(a.x, b.x, -hx, hx) && this.slab(a.y, b.y, 0, h) && this.slab(a.z, b.z, -hz, hz);
      if (hit) return true;
    }
    return false;
  }

  private t0 = 0;
  private t1 = 1;
  /** Narrow [t0, t1] to where the segment p0→p1 is between lo and hi; false once it's empty. */
  private slab(p0: number, p1: number, lo: number, hi: number): boolean {
    const d = p1 - p0;
    if (Math.abs(d) < 1e-9) return p0 >= lo && p0 <= hi;
    let u0 = (lo - p0) / d;
    let u1 = (hi - p0) / d;
    if (u0 > u1) {
      const u = u0;
      u0 = u1;
      u1 = u;
    }
    this.t0 = Math.max(this.t0, u0);
    this.t1 = Math.min(this.t1, u1);
    return this.t0 <= this.t1;
  }
}

// The race's moving cast, drawn from the simulation each frame: toy Waymos (lidar hats spinning,
// hazards blinking, sometimes a protest cone on the hood) and a map's own traffic (lowriders, on
// their hydraulics), wobbly tourist figurines and a map's own locals (strollers, drag queens,
// mariachis, paleteros, hipsters), dogs loose in the parks, the map's cable cars (or its
// streetcar), loose traffic cones, item boxes, poo, seagulls and crabs.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Ped, PedDress, RaceSim, TramKind, Waymo } from '../sim/race';
import { GeoBuilder, box, cyl, rbox, type V3 } from './geo';
import { buildCableCar, buildStreetcar, signTexture } from './props';
import { canvasTexture, damp, smoothstep } from './util';

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
    // A Dungeness crab, cooked Fisherman's Wharf orange, its claws tipped white.
    crab: new THREE.MeshPhysicalMaterial({ color: '#e2542b', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    crabBelly: new THREE.MeshStandardMaterial({ color: '#f6c9a0', roughness: 0.5 }),
    crabTip: new THREE.MeshPhysicalMaterial({ color: '#fbf6ee', roughness: 0.3, clearcoat: 0.6 }),
    // Dogs: every breed's coat (and collar) is vertex colour on one material, eyes, noses and
    // tags on a glossy one.
    dogCoat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }),
    dogGloss: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }),
    // A map's own locals (Ped.dress): clothes, skin and what they push in vertex colour on one
    // material (double-sided, for the canopies and umbrellas), sequins, silver and brass on another.
    dress: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, side: THREE.DoubleSide }),
    dressGloss: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.55, clearcoat: 0.9, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
    // Lowriders: chrome, wire wheels with whitewalls, and their lamps.
    chrome: new THREE.MeshStandardMaterial({ color: '#eef1f4', roughness: 0.12, metalness: 1 }),
    lowWheel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.45, side: THREE.DoubleSide }),
    lowLamp: new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffe9b0', emissiveIntensity: 0.8, roughness: 0.3 }),
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
    crabShell: new THREE.SphereGeometry(0.5, 22, 14),
    crabLeg: new THREE.CapsuleGeometry(0.04, 0.3, 2, 6).rotateX(Math.PI / 2),
    crabArm: new THREE.CapsuleGeometry(0.05, 0.24, 2, 8).rotateZ(-Math.PI / 2),
    crabClaw: new THREE.SphereGeometry(0.13, 14, 10),
    crabTip: new THREE.ConeGeometry(0.05, 0.18, 8).rotateZ(-Math.PI / 2),
    crabStalk: new THREE.CylinderGeometry(0.018, 0.024, 0.16, 6),
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
  /** A lowrider: its hydraulics' phase (it hops; a Waymo doesn't). */
  hop?: number;
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
// Lowriders (Waymo.dress): a long, low sixties hardtop in candy paint, chrome bumpers and trim,
// quad headlamps and triple tail lamps, wire wheels with whitewalls and knock-off spinners, sitting
// on its hydraulics: it hops now and then as it cruises, and dances when it stops. The sim drives
// it as a Waymo (same footprint).

const CANDY = ['#b5121b', '#6a1b9a', '#0d7c7c', '#c9a227', '#1b3a8c', '#2e8b3e', '#c2185b'];
const candy = new Map<string, THREE.MeshPhysicalMaterial>();
function candyMat(color: string): THREE.MeshPhysicalMaterial {
  let m = candy.get(color);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.05 });
    candy.set(color, m);
  }
  return m;
}

let LOW: ReturnType<typeof makeLowGeos> | null = null;
function makeLowGeos() {
  const chrome = new GeoBuilder();
  const W = '#ffffff';
  // Bumpers, the grille, the trim along the sides, the hood ornament.
  rbox(chrome, 2.36, 2.52, 0.34, 0.54, -0.99, 0.99, 0.05, W, undefined, 1);
  rbox(chrome, -2.52, -2.36, 0.34, 0.54, -0.99, 0.99, 0.05, W, undefined, 1);
  box(chrome, 2.37, 2.43, 0.5, 0.74, -0.62, 0.62, W);
  for (const s of [1, -1]) box(chrome, -2.3, 2.3, 0.64, 0.68, s > 0 ? 0.962 : -0.986, s > 0 ? 0.986 : -0.962, W);
  blob(chrome, W, 2.05, 0.86, 0, 0.12, 0.05, 0.03, 0, 0, 0, 8);
  const heads = new GeoBuilder();
  for (const z of [-0.66, -0.44, 0.44, 0.66]) cyl(heads, [2.36, 0.66, z], [2.45, 0.66, z], 0.075, 0.075, 8, W);
  const tails = new GeoBuilder();
  for (const z of [-0.84, -0.66, -0.48, 0.48, 0.66, 0.84]) cyl(tails, [-2.45, 0.64, z], [-2.36, 0.64, z], 0.06, 0.06, 8, W);
  // A wheel (axle along z, whitewall and the chrome dish on +z: the far side's are mirrored).
  const wheel = new GeoBuilder();
  wheel.add(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14).rotateX(Math.PI / 2), '#1d1e21');
  for (const f of [1, -1]) {
    wheel.add(new THREE.RingGeometry(0.21, 0.29, 14).rotateY(f > 0 ? 0 : Math.PI).translate(0, 0, f * 0.121), '#f4f4ef');
    wheel.add(new THREE.CircleGeometry(0.21, 12).rotateY(f > 0 ? 0 : Math.PI).translate(0, 0, f * 0.122), '#d9dde2');
  }
  // Wire spokes on the outside, and the three-eared knock-off spinner.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    wheel.add(new THREE.BoxGeometry(0.2, 0.012, 0.012).translate(0.1, 0, 0).rotateZ(a).translate(0, 0, 0.13), '#b9bec6');
  }
  for (let k = 0; k < 3; k++) wheel.add(new THREE.BoxGeometry(0.15, 0.035, 0.03).translate(0.06, 0, 0).rotateZ((k / 3) * TAU + 0.3).translate(0, 0, 0.15), '#e6b54c');
  wheel.add(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 10).rotateX(Math.PI / 2).translate(0, 0, 0.145), '#e6b54c');
  return {
    hull: new RoundedBoxGeometry(4.8, 0.46, 1.94, 2, 0.16),
    cabin: new RoundedBoxGeometry(1.95, 0.38, 1.66, 2, 0.12),
    roof: new RoundedBoxGeometry(1.8, 0.08, 1.62, 1, 0.04),
    fin: new RoundedBoxGeometry(1.4, 0.1, 0.13, 1, 0.04),
    chrome: chrome.build(),
    heads: heads.build(),
    tails: tails.build(),
    wheel: wheel.build(),
  };
}
const lowGeos = (): NonNullable<typeof LOW> => (LOW ??= makeLowGeos());

function buildLowrider(id: number): WaymoView {
  const m = mats();
  const g = lowGeos();
  const paint = candyMat(CANDY[id % CANDY.length]);
  const root = new THREE.Group();
  root.name = 'lowrider';
  // (The body first: the knock rocks root.children[0], the hydraulics lift and pitch it.)
  const body = new THREE.Group();
  root.add(body);
  body.add(mesh(g.hull, paint, 0, 0.58, 0));
  body.add(mesh(g.cabin, m.glass, -0.35, 1.0, 0));
  body.add(mesh(g.roof, id % 3 === 0 ? m.white : paint, -0.4, 1.22, 0));
  for (const s of [1, -1]) body.add(mesh(g.fin, paint, -1.8, 0.85, s * 0.9));
  body.add(mesh(g.chrome, m.chrome), mesh(g.heads, m.lowLamp), mesh(g.tails, m.tail));
  const gg = geos();
  const hazards: THREE.Mesh[] = [];
  for (const x of [2.3, -2.3]) {
    for (const s of [1, -1]) {
      const h = mesh(gg.hazard, m.hazardOff, x, 0.5, s * 0.86);
      hazards.push(h);
      body.add(h);
    }
  }
  const wheels: THREE.Object3D[] = [];
  for (const x of [1.5, -1.5]) {
    for (const s of [1, -1]) {
      const w = new THREE.Group();
      w.position.set(x, 0.33, s * 0.84);
      w.scale.z = s;
      w.add(mesh(g.wheel, m.lowWheel));
      wheels.push(w);
      root.add(w);
    }
  }
  // No lidar to spin, but the view has one; nor does it stall with a cone on its hood.
  const lidar = new THREE.Group();
  const cone = buildCone();
  cone.visible = false;
  body.add(cone);
  return { root, lidar, hazards, cone, wheels, roll: 0, faded: false, hop: id };
}

/** A lowrider's hydraulics: stopped, it dances (front up, back up, in turn); cruising, it throws a
 *  front-then-back hop every six or seven seconds. Lifts and pitches the body, wheels on the road. */
function hydraulics(v: WaymoView, w: Waymo, t: number): void {
  const body = v.root.children[0];
  const k = (v.hop ?? 0) * 2.3;
  const still = w.parked || w.kind === 'stalled' || w.stopped > 0 || w.v < 0.6;
  let front = 0;
  let back = 0;
  if (still) {
    front = Math.max(0, Math.sin(t * 5.5 + k));
    back = 0.6 * Math.max(0, Math.sin(t * 5.5 + k + Math.PI));
  } else {
    const c = (((t + k) % 6.5) + 6.5) % 6.5;
    if (c < 0.7) front = Math.sin((c / 0.7) * Math.PI);
    else if (c < 1.4) back = 0.8 * Math.sin(((c - 0.7) / 0.7) * Math.PI);
  }
  body.position.y = 0.17 * front + 0.12 * back;
  body.rotation.z = 0.15 * front - 0.12 * back;
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
  /** A map's own local (Ped.dress): their look's moving parts. */
  dress?: DressRig;
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
// A map's own locals (Ped.dress): Noe Valley's parents pushing strollers, the Castro's drag queens,
// a mariachi trio outside El Farolito, paleteros pushing their carts, hipsters at the top of Dolores
// Park photographing the view. The same wobbly toy figures (they topple and bob back up with
// whatever they're pushing), each in its own clothes with its own props and moves; the sim treats
// them as their kind. Everything that doesn't move is merged per look (vertex colour, two shared
// materials); the legs, arms, wheels and what's in hand move.

interface DressRig {
  kind: PedDress;
  /** Between the body (which wobbles) and the figure: a sashay, a sway to the music. */
  sway: THREE.Group;
  /** The figure's other arm (its left). */
  arm2: THREE.Object3D;
  /** Wheels of what they push (each spun by its own k: the small ones faster), their reference
   *  radius, and how far they've turned. */
  wheels: { obj: THREE.Object3D; k: number }[];
  wheelR: number;
  spin: number;
  /** What moves in hand (a fan; a violin's bow), and the paletero's bell. */
  prop: THREE.Object3D | null;
  bell: THREE.Object3D | null;
  /** Which instrument a mariachi plays (0 guitar, 1 trumpet, 2 violin, 3 guitarrón). */
  variant: number;
}

/** Skin tones (and warmer ones). */
const SKINS = ['#f0c6a2', '#e0ac85', '#c68e65', '#a8714c', '#87553a', '#f5d7bf', '#6e4630'];
const WARM_SKINS = ['#c68e65', '#a8714c', '#b47e58', '#8d5a3b', '#d39b72', '#9b6744'];
const HAIRS = ['#2b1d14', '#5a3a22', '#c9a35b', '#8a5a2b', '#141414', '#b8854a'];

/** A matrix placing a part at (x, y, z), turned (rx, ry, rz), scaled (sx, sy, sz). */
function at(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  return _dm.compose(_dp.set(x, y, z), _dq.setFromEuler(_de.set(rx, ry, rz)), _ds.set(sx, sy, sz));
}

/** The toy figure's body and head (as the plain pedestrian's: torso round its middle at 0.98 m, a
 *  head at 1.52), in a top colour and a skin tone. */
function figure(b: GeoBuilder, top: string, skin: string): void {
  b.add(new THREE.CapsuleGeometry(0.24, 0.38, 3, 12), top, at(0, 0.98, 0));
  b.add(new THREE.SphereGeometry(0.19, 14, 10), skin, at(0, 1.52, 0));
}

/** A leg from the hip (as the plain pedestrian's), with a shoe; `extra` dresses it. */
function legOf(trouser: string, shoe: string, extra?: (b: GeoBuilder) => void): THREE.BufferGeometry {
  const b = new GeoBuilder();
  b.add(new THREE.CapsuleGeometry(0.075, 0.42, 2, 8), trouser, at(0, -0.3, 0));
  blob(b, shoe, 0.04, -0.58, 0, 0.11, 0.05, 0.075, 0, 0, 0, 8);
  extra?.(b);
  return b.build();
}

/** An arm from the shoulder, hanging (a sleeve and a hand). */
function armOf(sleeve: string, skin: string): THREE.BufferGeometry {
  const b = new GeoBuilder();
  b.add(new THREE.CapsuleGeometry(0.06, 0.3, 2, 6), sleeve, at(0.12, -0.1, 0));
  blob(b, skin, 0.12, -0.33, 0, 0.065, 0.065, 0.065, 0, 0, 0, 8);
  return b.build();
}

/** Where the hand is, from the shoulder, hanging. */
const HAND: V3 = [0.12, -0.34, 0];

/** A wheel (axle along z): tyre and hub. */
function wheelOf(r: number, w: number, tyre: string, hub: string): THREE.BufferGeometry {
  const b = new GeoBuilder();
  b.add(new THREE.CylinderGeometry(r, r, w, 12).rotateX(Math.PI / 2), tyre);
  b.add(new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.01, 8).rotateX(Math.PI / 2), hub);
  return b.build();
}

/** What a look is made of (cached per look and variant). */
interface DressKit {
  matte: THREE.BufferGeometry;
  gloss: THREE.BufferGeometry | null;
  /** The legs (the left one is the right mirrored), or none showing. */
  leg: THREE.BufferGeometry | null;
  arm: THREE.BufferGeometry;
  /** In the right hand (from the shoulder), and the left; glossy or not. */
  hand: THREE.BufferGeometry | null;
  handGloss: boolean;
  hand2: THREE.BufferGeometry | null;
  /** The wheels of what they push: where (each with its size against the first). */
  wheel: THREE.BufferGeometry | null;
  wheelAt: [number, number, number, number][];
  wheelR: number;
  bell: THREE.BufferGeometry | null;
  bellAt: V3;
}

const DRESS_KITS = new Map<string, DressKit>();

/** The frame of a stroller or a cart's handle: a bar across at the hands (x 0.36, y 1.0). */
function handleBar(b: GeoBuilder, color: string, half: number): void {
  rod(b, color, [0.36, 1.0, -half], [0.36, 1.0, half], 0.024, 0.024, 8);
}

/** A parent pushing a stroller (pram, canopy, a baby peeking out, the changing bag on the handle). */
function strollerKit(v: number): DressKit {
  const TOPS = ['#9aa5b1', '#2d3e5c', '#a8bfa3', '#e8b4b8', '#f2efe6', '#4a4a4a'];
  const LEGS = ['#26262b', '#3b4a63', '#5d6168', '#26262b', '#7a6a58', '#2f2f35'];
  const PRAMS = ['#2d3e5c', '#5c6b52', '#3a3a40', '#b5523b', '#7c8fa6', '#c9b28f'];
  const BABY = ['#f7c6d9', '#bfe3f7', '#fff1a8', '#c9f2d4', '#e6d3ff', '#ffd6b8'];
  const skin = SKINS[(v * 3) % SKINS.length];
  const hair = HAIRS[v % HAIRS.length];
  const b = new GeoBuilder();
  figure(b, TOPS[v], skin);
  // Hair: a cap of it over the top and back, then a bun, a ponytail or a baseball cap.
  b.add(new THREE.SphereGeometry(0.2, 12, 6, 0, TAU, 0, Math.PI * 0.55), hair, at(-0.02, 1.53, 0, 0, 0, 0.35));
  if (v % 3 === 0) blob(b, hair, -0.15, 1.67, 0, 0.09, 0.09, 0.09, 0, 0, 0, 10);
  else if (v % 3 === 1) blob(b, hair, -0.2, 1.52, 0, 0.06, 0.15, 0.06, 0, 0, -0.5, 10);
  else {
    b.add(new THREE.SphereGeometry(0.205, 12, 6, 0, TAU, 0, Math.PI / 2), '#e8322a', at(0, 1.57, 0));
    blob(b, '#e8322a', 0.2, 1.6, 0, 0.13, 0.02, 0.12, 0, 0, 0, 10);
  }
  // The stroller: handle, push bars down to the rear axle, legs down to the front wheels.
  const frame = '#26272b';
  handleBar(b, frame, 0.24);
  for (const s of [1, -1]) {
    rod(b, '#a7adb5', [0.36, 1.0, s * 0.22], [0.62, 0.12, s * 0.23], 0.018, 0.018, 8);
    rod(b, '#a7adb5', [0.72, 0.5, s * 0.2], [1.2, 0.1, s * 0.19], 0.016, 0.016, 8);
  }
  rod(b, '#a7adb5', [0.62, 0.11, -0.25], [0.62, 0.11, 0.25], 0.012, 0.012, 6);
  // The pram and its canopy (folded half up), the footboard.
  rbox(b, 0.6, 1.2, 0.42, 0.76, -0.22, 0.22, 0.08, PRAMS[v]);
  b.add(new THREE.CylinderGeometry(0.25, 0.25, 0.47, 10, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), PRAMS[v], at(0.82, 0.74, 0));
  box(b, 1.14, 1.24, 0.38, 0.42, -0.18, 0.18, frame);
  // The baby, in a knitted hat, peeking out from under the canopy.
  blob(b, '#f3cfb3', 0.98, 0.8, 0, 0.085, 0.085, 0.085, 0, 0, 0, 10);
  b.add(new THREE.SphereGeometry(0.09, 10, 5, 0, TAU, 0, Math.PI / 2), BABY[v], at(0.97, 0.82, 0));
  blob(b, BABY[v], 0.97, 0.92, 0, 0.03, 0.03, 0.03, 0, 0, 0, 6);
  // The changing bag hanging off the handle.
  box(b, 0.4, 0.5, 0.74, 0.96, 0.17, 0.29, '#33415c');
  return {
    matte: b.build(),
    gloss: null,
    leg: legOf(LEGS[v], '#f4f4f4'),
    arm: armOf(TOPS[v], skin),
    hand: null,
    handGloss: false,
    hand2: null,
    wheel: wheelOf(0.11, 0.05, '#1c1d20', '#c9ced6'),
    wheelAt: [
      [0.62, 0.11, 0.26, 1],
      [0.62, 0.11, -0.26, 1],
      [1.2, 0.09, 0.2, 0.82],
      [1.2, 0.09, -0.2, 0.82],
    ],
    wheelR: 0.11,
    bell: null,
    bellAt: [0, 0, 0],
  };
}

/** A drag queen: a sequinned gown to the floor, long gloves, a feather boa, hoops, a face, and a wig
 *  of her own (a platinum bouffant, a pink beehive, a rainbow one, purple curls, a red bob, golden
 *  curls); a fan in her raised hand, the other on her hip. */
function dragKit(v: number): DressKit {
  const GOWNS = ['#ff2fa0', '#ffd23f', '#2f6bff', '#9b3cff', '#18c98f', '#ff3b30'];
  const BOAS = ['#ffc2e2', '#ffffff', '#1b1b1f', '#e0b3ff', '#ffe082', '#ff8fb1'];
  const GLOVES = ['#f7f7f7', '#1b1b1f', '#f7f7f7', '#1b1b1f', '#f7f7f7', '#ff2fa0'];
  const skin = SKINS[(v * 5 + 1) % SKINS.length];
  const gown = GOWNS[v];
  const b = new GeoBuilder();
  const gl = new GeoBuilder();
  // The gown and bodice (sequins), the face (lips, shadow), the boa.
  gl.add(new THREE.CylinderGeometry(0.2, 0.47, 1.08, 18), gown, at(0, 0.54, 0));
  gl.add(new THREE.CapsuleGeometry(0.21, 0.3, 3, 12), gown, at(0, 1.05, 0));
  b.add(new THREE.SphereGeometry(0.19, 14, 10), skin, at(0, 1.52, 0));
  blob(b, '#d0103a', 0.178, 1.455, 0, 0.022, 0.018, 0.055, 0, 0, 0, 8);
  for (const s of [1, -1]) blob(b, v % 2 ? '#c04cff' : '#3fb6ff', 0.166, 1.565, s * 0.066, 0.02, 0.026, 0.045, 0, 0, 0, 8);
  b.add(new THREE.TorusGeometry(0.25, 0.075, 6, 18).rotateX(Math.PI / 2), BOAS[v], at(0, 1.34, 0, 0, 0, 0.12));
  for (const s of [1, -1]) b.add(new THREE.CapsuleGeometry(0.065, 0.34, 2, 8), BOAS[v], at(0.16, 1.07, s * 0.17, 0, 0, s * 0.12));
  // Gold hoops.
  for (const s of [1, -1]) gl.add(new THREE.TorusGeometry(0.055, 0.012, 5, 14), '#e6b54c', at(0.01, 1.42, s * 0.205));
  // The wig.
  const RAINBOW = ['#e8322a', '#ff8a1f', '#ffd23f', '#3ccf7a', '#2f6bff', '#8a44d8'];
  if (v === 0 || v === 5) {
    const c = v === 0 ? '#f3e9c6' : '#ffd75e';
    blob(b, c, -0.03, 1.66, 0, 0.27, 0.24, 0.27, 0, 0, 0, 14);
    blob(b, c, -0.03, 1.88, 0, 0.17, 0.13, 0.17, 0, 0, 0, 12);
    for (const s of [1, -1]) blob(b, c, -0.02, 1.47, s * 0.21, 0.1, 0.12, 0.08, 0, 0, 0, 10);
  } else if (v === 1) {
    blob(b, '#ff4fb8', -0.04, 1.62, 0, 0.23, 0.2, 0.23, 0, 0, 0, 14);
    blob(b, '#ff4fb8', -0.06, 1.93, 0, 0.18, 0.3, 0.18, 0, 0, 0, 14);
    blob(b, '#ff4fb8', -0.07, 2.22, 0, 0.09, 0.08, 0.09, 0, 0, 0, 10);
  } else if (v === 2) {
    RAINBOW.forEach((c, i) => blob(b, c, -0.05, 1.62 + i * 0.105, 0, 0.245 - i * 0.025, 0.08, 0.245 - i * 0.025, 0, 0, 0, 14));
    blob(b, '#ffffff', -0.05, 2.23, 0, 0.07, 0.07, 0.07, 0, 0, 0, 8);
  } else if (v === 3) {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU;
      blob(b, '#9b3cff', -0.04 + Math.cos(a) * 0.15, 1.7 + (k % 2) * 0.06, Math.sin(a) * 0.17, 0.11, 0.11, 0.11, 0, 0, 0, 10);
    }
    blob(b, '#9b3cff', -0.04, 1.84, 0, 0.14, 0.12, 0.14, 0, 0, 0, 12);
  } else {
    blob(b, '#c4161c', -0.03, 1.6, 0, 0.24, 0.22, 0.25, 0, 0, 0, 14);
    blob(b, '#c4161c', 0.12, 1.67, 0, 0.08, 0.06, 0.2, 0, 0, 0, 10);
  }
  // The fan: a half-disc of lace, upright.
  const fan = new GeoBuilder();
  fan.add(new THREE.CircleGeometry(0.2, 10, 0, Math.PI).rotateY(Math.PI / 2), v % 2 ? '#1b1b1f' : '#e8322a', at(HAND[0] + 0.02, HAND[1] - 0.02, 0, 0, 0, -1.3));
  return {
    matte: b.build(),
    gloss: gl.build(),
    leg: null,
    arm: armOf(GLOVES[v], GLOVES[v]),
    hand: fan.build(),
    handGloss: false,
    hand2: null,
    wheel: null,
    wheelAt: [],
    wheelR: 1,
    bell: null,
    bellAt: [0, 0, 0],
  };
}

/** A mariachi in a charro suit (black, cream or navy, silver down the trousers and the jacket), a red
 *  bow, a moustache and a wide sombrero, playing a guitar, a trumpet, a violin or a guitarrón. */
function mariachiKit(inst: number, suit: number): DressKit {
  const SUITS = ['#16161a', '#16161a', '#efe7d3', '#1a2440'];
  const BOWS = ['#c4161c', '#0f7a3d', '#c4161c', '#d4a72c'];
  const HATS = ['#1d1b1f', '#1d1b1f', '#efe4c8', '#1d1b1f'];
  const SILVER = '#d8dde3';
  const cloth = SUITS[suit];
  const skin = WARM_SKINS[(inst * 2 + suit) % WARM_SKINS.length];
  const b = new GeoBuilder();
  const gl = new GeoBuilder();
  figure(b, cloth, skin);
  // The shirt front, the bow, the moustache.
  blob(b, '#ffffff', 0.2, 1.08, 0, 0.06, 0.2, 0.11, 0, 0, 0, 10);
  for (const s of [1, -1]) blob(b, BOWS[suit], 0.215, 1.33, s * 0.065, 0.04, 0.05, 0.07, s * 0.4, 0, 0, 8);
  blob(b, BOWS[suit], 0.225, 1.33, 0, 0.035, 0.035, 0.035, 0, 0, 0, 6);
  blob(b, '#2a1a12', 0.172, 1.47, 0, 0.026, 0.022, 0.085, 0, 0, 0, 8);
  // Silver buttons down the jacket.
  for (const y of [0.86, 0.96, 1.06, 1.16]) for (const s of [1, -1]) gl.add(new THREE.SphereGeometry(0.018, 5, 3), SILVER, at(0.225, y, s * 0.13));
  // The sombrero: a wide brim, upturned at its silver edge, a tall crown with a silver band.
  const hat = HATS[suit];
  b.add(new THREE.CylinderGeometry(0.5, 0.5, 0.035, 18), hat, at(0, 1.68, 0));
  gl.add(new THREE.TorusGeometry(0.49, 0.035, 4, 18).rotateX(Math.PI / 2), SILVER, at(0, 1.71, 0));
  b.add(new THREE.CylinderGeometry(0.13, 0.18, 0.3, 14), hat, at(0, 1.84, 0));
  gl.add(new THREE.CylinderGeometry(0.183, 0.183, 0.05, 14), SILVER, at(0, 1.73, 0));
  // The instrument (static, in front), and what moves in hand.
  let hand: THREE.BufferGeometry | null = null;
  const WOOD = '#c98a4b';
  const DARK = '#5a3a22';
  if (inst === 0 || inst === 3) {
    // Guitar (or the bigger, deeper guitarrón), across the body, neck up to the left.
    const big = inst === 3;
    const ib = new GeoBuilder();
    blob(ib, big ? '#8a5a2b' : WOOD, 0, 0, 0, big ? 0.1 : 0.055, big ? 0.27 : 0.2, big ? 0.24 : 0.17, 0, 0, 0, 12);
    blob(ib, big ? '#8a5a2b' : WOOD, 0, big ? 0.27 : 0.2, 0, big ? 0.09 : 0.05, big ? 0.2 : 0.15, big ? 0.18 : 0.13, 0, 0, 0, 12);
    ib.add(new THREE.CircleGeometry(0.055, 10).rotateY(Math.PI / 2), '#1e140e', at(big ? 0.105 : 0.06, 0.13, 0));
    ib.add(new THREE.BoxGeometry(0.035, big ? 0.42 : 0.55, 0.06), DARK, at(0, big ? 0.62 : 0.62, 0));
    ib.add(new THREE.BoxGeometry(0.04, 0.12, 0.08), DARK, at(0, big ? 0.88 : 0.95, 0));
    const g = ib.build();
    g.applyMatrix4(at(0.3, 0.98, 0.04, -1.05, 0, 0.2));
    b.add(g, null);
  } else if (inst === 1) {
    // Trumpet, at the lips.
    gl.add(new THREE.CylinderGeometry(0.024, 0.024, 0.32, 8).rotateZ(-Math.PI / 2), '#e6b54c', at(0.36, 1.46, 0, 0, 0, 0.12));
    gl.add(new THREE.CylinderGeometry(0.1, 0.026, 0.16, 12, 1, true).rotateZ(-Math.PI / 2), '#e6b54c', at(0.59, 1.49, 0, 0, 0, 0.12));
    for (const dx of [0, 0.045, 0.09]) gl.add(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6), '#e6b54c', at(0.3 + dx, 1.5, 0));
  } else {
    // Violin under the chin on the left shoulder; the bow in the right hand.
    const ib = new GeoBuilder();
    blob(ib, WOOD, 0, 0, 0, 0.17, 0.035, 0.09, 0, 0, 0, 10);
    ib.add(new THREE.BoxGeometry(0.26, 0.025, 0.035), '#1e140e', at(0.24, 0.0, 0));
    blob(ib, DARK, 0.38, 0, 0, 0.035, 0.03, 0.03, 0, 0, 0, 8);
    const g = ib.build();
    g.applyMatrix4(at(0.2, 1.36, -0.16, 0.3, 0.6, 0.15));
    b.add(g, null);
    const bow = new GeoBuilder();
    rod(bow, '#3a2a1e', [HAND[0] - 0.05, HAND[1] - 0.02, -0.3], [HAND[0] + 0.02, HAND[1] - 0.02, 0.3], 0.008, 0.008, 5);
    hand = bow.build();
  }
  // The trousers: silver buttons down the outside seam.
  const leg = legOf(cloth, '#141416', (lb) => {
    for (let k = 0; k < 5; k++) lb.add(new THREE.SphereGeometry(0.02, 5, 3), SILVER, at(0, -0.12 - k * 0.09, 0.075));
  });
  return {
    matte: b.build(),
    gloss: gl.build(),
    leg,
    arm: armOf(cloth, skin),
    hand,
    handGloss: false,
    hand2: null,
    wheel: null,
    wheelAt: [],
    wheelR: 1,
    bell: null,
    bellAt: [0, 0, 0],
  };
}

/** A paletero pushing his cart: a white box painted with paletas, a striped umbrella over it, big
 *  wheels, a bell on the handle; a straw hat. */
function paleteroKit(v: number): DressKit {
  const SHIRTS = ['#f4f4ef', '#9fd3f2', '#f2f0e4', '#ffd6a5', '#cfe8c9', '#ffffff'];
  const PANTS = ['#4a3f35', '#2f3f5c', '#5b5048', '#3a3a40', '#6b5a45', '#2f2f35'];
  const UMBRELLAS: [string, string][] = [
    ['#e8322a', '#ffd23f'],
    ['#2f6bff', '#ffffff'],
    ['#3ccf7a', '#ff4f9a'],
    ['#ff8a1f', '#ffffff'],
    ['#8a44d8', '#ffd23f'],
    ['#1fd1c0', '#ff5fa2'],
  ];
  const skin = WARM_SKINS[v % WARM_SKINS.length];
  const b = new GeoBuilder();
  figure(b, SHIRTS[v], skin);
  if (v % 2 === 0) blob(b, '#2a1a12', 0.172, 1.47, 0, 0.026, 0.022, 0.08, 0, 0, 0, 8);
  // The straw hat.
  b.add(new THREE.CylinderGeometry(0.31, 0.31, 0.03, 14), '#d9b56a', at(0, 1.66, 0));
  b.add(new THREE.CylinderGeometry(0.15, 0.17, 0.15, 10), '#d9b56a', at(0, 1.74, 0));
  b.add(new THREE.CylinderGeometry(0.172, 0.172, 0.04, 10), '#6b4a2b', at(0, 1.69, 0));
  // The cart: a white box, a pink band round it, paletas painted on its sides, a lid, the handle.
  rbox(b, 0.5, 1.26, 0.3, 1.0, -0.3, 0.3, 0.04, '#f7f7f2', undefined, 1);
  box(b, 0.49, 1.27, 0.6, 0.7, -0.31, 0.31, '#ff5fa2');
  box(b, 0.5, 1.26, 1.0, 1.04, -0.3, 0.3, '#c9ced6');
  const POPS = ['#ff5fa2', '#ffd23f', '#7ad151', '#ff8a3d'];
  for (const s of [1, -1]) {
    POPS.forEach((c, k) => {
      const x = 0.62 + k * 0.17;
      box(b, x - 0.045, x + 0.045, 0.78, 0.94, s * 0.305 - 0.006, s * 0.305 + 0.006, c);
      box(b, x - 0.008, x + 0.008, 0.72, 0.78, s * 0.305 - 0.004, s * 0.305 + 0.004, '#e8d3a8');
    });
  }
  handleBar(b, '#8a8f96', 0.27);
  for (const s of [1, -1]) rod(b, '#8a8f96', [0.36, 1.0, s * 0.27], [0.5, 0.85, s * 0.27], 0.018, 0.018, 6);
  // The umbrella: a pole and eight panels, striped.
  rod(b, '#8a8f96', [0.9, 1.04, 0], [0.9, 2.1, 0], 0.015, 0.015, 6);
  const [ua, ub] = UMBRELLAS[v];
  const apex: V3 = [0.9, 2.18, 0];
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * TAU;
    const a1 = ((k + 1) / 8) * TAU;
    const p0: V3 = [0.9 + Math.cos(a0) * 0.66, 1.94, Math.sin(a0) * 0.66];
    const p1: V3 = [0.9 + Math.cos(a1) * 0.66, 1.94, Math.sin(a1) * 0.66];
    b.tri(apex, p1, p0, k % 2 ? ua : ub, [0, 1, 0]);
  }
  const bell = new GeoBuilder();
  bell.add(new THREE.ConeGeometry(0.035, 0.07, 10).translate(0, -0.06, 0), '#e6b54c');
  bell.add(new THREE.SphereGeometry(0.014, 6, 4).translate(0, -0.1, 0), '#8a6a2a');
  return {
    matte: b.build(),
    gloss: null,
    leg: legOf(PANTS[v], '#3a2a1e'),
    arm: armOf(SHIRTS[v], skin),
    hand: null,
    handGloss: false,
    hand2: null,
    wheel: wheelOf(0.19, 0.05, '#1c1d20', '#c9ced6'),
    wheelAt: [
      [0.95, 0.19, 0.345, 1],
      [0.95, 0.19, -0.345, 1],
      [1.2, 0.07, 0, 0.37],
    ],
    wheelR: 0.19,
    bell: bell.build(),
    bellAt: [0.36, 1.0, 0.2],
  };
}

/** A hipster: beanie, thick glasses, maybe a beard, a flannel shirt, jeans, a tote bag; a phone held
 *  up in one hand (photographing the view), an iced coffee in the other. */
function hipsterKit(v: number): DressKit {
  const BEANIES = ['#d4a72c', '#b5523b', '#6b7a3a', '#3a3a40', '#2c7a7b', '#8c2f39'];
  const FLANNEL = ['#a3242b', '#2f5d3a', '#3a5f8f', '#8a5a2b', '#5b2a6e', '#a3242b'];
  const skin = SKINS[(v * 4 + 2) % SKINS.length];
  const b = new GeoBuilder();
  // The shirt is the flannel's own (plaid) mesh: just the head here.
  b.add(new THREE.SphereGeometry(0.19, 14, 10), skin, at(0, 1.52, 0));
  // Beanie: a knitted dome and a turned-up band (a pompom on some).
  b.add(new THREE.SphereGeometry(0.205, 12, 6, 0, TAU, 0, Math.PI / 2), BEANIES[v], at(-0.01, 1.55, 0));
  b.add(new THREE.TorusGeometry(0.195, 0.035, 5, 16).rotateX(Math.PI / 2), BEANIES[v], at(-0.01, 1.58, 0));
  if (v % 2) blob(b, '#f4f1ea', -0.01, 1.78, 0, 0.055, 0.055, 0.055, 0, 0, 0, 8);
  // Thick black glasses.
  for (const s of [1, -1]) b.add(new THREE.TorusGeometry(0.045, 0.012, 5, 12).rotateY(Math.PI / 2), '#141416', at(0.178, 1.54, s * 0.062));
  rod(b, '#141416', [0.18, 1.545, -0.02], [0.18, 1.545, 0.02], 0.008, 0.008, 4);
  if (v % 3 !== 0) blob(b, HAIRS[(v + 1) % HAIRS.length], 0.12, 1.41, 0, 0.1, 0.1, 0.14, 0, 0, 0, 10);
  // The tote bag on the left side, and its strap.
  rbox(b, -0.13, 0.13, 0.8, 1.1, -0.33, -0.3, 0.02, '#e9e2cf');
  rod(b, '#d9cfb3', [-0.1, 1.1, -0.31], [-0.04, 1.36, -0.2], 0.012, 0.012, 4);
  rod(b, '#d9cfb3', [0.1, 1.1, -0.31], [0.04, 1.36, -0.2], 0.012, 0.012, 4);
  // The phone (in the right hand, held up), the iced coffee (the left).
  const phone = new GeoBuilder();
  phone.add(new THREE.BoxGeometry(0.02, 0.15, 0.075), '#141416', at(HAND[0] + 0.07, HAND[1] + 0.02, -0.02));
  phone.add(new THREE.PlaneGeometry(0.12, 0.06).rotateY(-Math.PI / 2), '#9fd0ff', at(HAND[0] + 0.059, HAND[1] + 0.02, -0.02));
  const cup = new GeoBuilder();
  cup.add(new THREE.CylinderGeometry(0.045, 0.035, 0.15, 10), '#d8c7a8', at(HAND[0] + 0.03, HAND[1] + 0.02, 0));
  cup.add(new THREE.CylinderGeometry(0.047, 0.047, 0.05, 10), '#6b4a2b', at(HAND[0] + 0.03, HAND[1] + 0.0, 0));
  rod(cup, '#2f8f4e', [HAND[0] + 0.03, HAND[1] + 0.08, 0], [HAND[0] + 0.05, HAND[1] + 0.18, 0], 0.006, 0.006, 4);
  return {
    matte: b.build(),
    gloss: null,
    leg: legOf('#2f4466', '#5a3a22'),
    arm: armOf(FLANNEL[v], skin),
    hand: phone.build(),
    handGloss: true,
    hand2: cup.build(),
    wheel: null,
    wheelAt: [],
    wheelR: 1,
    bell: null,
    bellAt: [0, 0, 0],
  };
}

/** Flannel: a check in a shirt's colour over black, with a pale line through it. */
const flannels = new Map<string, THREE.MeshStandardMaterial>();
function flannelMat(color: string): THREE.MeshStandardMaterial {
  let m = flannels.get(color);
  if (!m) {
    const tex = canvasTexture(
      32,
      32,
      (g, w, h) => {
        g.fillStyle = color;
        g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(20, 20, 24, 0.55)';
        g.fillRect(0, 0, w / 2, h);
        g.fillRect(0, 0, w, h / 2);
        g.fillStyle = 'rgba(240, 232, 210, 0.55)';
        g.fillRect(w * 0.72, 0, 2, h);
        g.fillRect(0, h * 0.72, w, 2);
      },
      { repeat: [4, 3] },
    );
    m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    flannels.set(color, m);
  }
  return m;
}

function dressKit(kind: PedDress, v: number, w: number): DressKit {
  const key = `${kind}/${v}/${w}`;
  let k = DRESS_KITS.get(key);
  if (!k) {
    k =
      kind === 'stroller'
        ? strollerKit(v)
        : kind === 'drag'
          ? dragKit(v)
          : kind === 'mariachi'
            ? mariachiKit(v, w)
            : kind === 'paletero'
              ? paleteroKit(v)
              : hipsterKit(v);
    DRESS_KITS.set(key, k);
  }
  return k;
}

/** A dressed figure: the same view as a plain pedestrian's (the legs swing, the body topples and
 *  bobs back up), with its look's parts and its rig. */
function buildDressed(p: Ped): PedView {
  const m = mats();
  const kind = p.dress!;
  const seed = Math.abs(p.color * 7 + p.id * 13);
  const v = kind === 'mariachi' ? p.id % 4 : seed % 6;
  const k = dressKit(kind, v, kind === 'mariachi' ? seed % 4 : 0);
  const root = new THREE.Group();
  root.name = kind;
  const body = new THREE.Group();
  root.add(body);
  const sway = new THREE.Group();
  body.add(sway);
  sway.add(mesh(k.matte, m.dress));
  if (k.gloss) sway.add(mesh(k.gloss, m.dressGloss));
  if (kind === 'hipster') sway.add(mesh(geos().torso, flannelMat(['#a3242b', '#2f5d3a', '#3a5f8f', '#8a5a2b', '#5b2a6e', '#a3242b'][v]), 0, 0.98, 0));
  const legs: THREE.Object3D[] = [];
  for (const s of [1, -1]) {
    const leg = new THREE.Group();
    leg.position.set(0, 0.62, s * 0.11);
    if (k.leg) {
      const lm = mesh(k.leg, m.dress);
      lm.scale.z = s;
      leg.add(lm);
    }
    legs.push(leg);
    sway.add(leg);
  }
  const arm = new THREE.Group();
  arm.position.set(0.05, 1.22, 0.25);
  arm.add(mesh(k.arm, m.dress));
  let prop: THREE.Object3D | null = null;
  if (k.hand) {
    prop = new THREE.Group();
    // (A fan turns about the wrist.)
    prop.position.set(HAND[0], HAND[1], 0);
    const pm = mesh(k.hand, k.handGloss ? m.dressGloss : m.dress, -HAND[0], -HAND[1], 0);
    prop.add(pm);
    arm.add(prop);
  }
  sway.add(arm);
  const arm2 = new THREE.Group();
  arm2.position.set(0.05, 1.22, -0.25);
  const a2 = mesh(k.arm, m.dress);
  a2.scale.z = -1;
  arm2.add(a2);
  if (k.hand2) arm2.add(mesh(k.hand2, m.dress));
  sway.add(arm2);
  const wheels: { obj: THREE.Object3D; k: number }[] = [];
  if (k.wheel) {
    for (const [x, y, z, size] of k.wheelAt) {
      const w = mesh(k.wheel, m.dress, x, y, z);
      w.scale.set(size, size, 1);
      wheels.push({ obj: w, k: 1 / size });
      sway.add(w);
    }
  }
  let bell: THREE.Object3D | null = null;
  if (k.bell) {
    bell = mesh(k.bell, m.dressGloss, k.bellAt[0], k.bellAt[1], k.bellAt[2]);
    sway.add(bell);
  }
  return {
    root,
    body,
    legs,
    arm,
    wobble: 0,
    wobbleV: 0,
    tilt: 0,
    dress: { kind, sway, arm2, wheels, wheelR: k.wheelR, spin: 0, prop, bell, variant: v },
  };
}

/** A dressed figure's pose this frame (the legs are already swinging with the walk). */
function poseDressed(v: PedView, p: Ped, walking: boolean, swing: number, t: number, dt: number): void {
  const r = v.dress!;
  const ph = p.id * 1.7;
  switch (r.kind) {
    case 'stroller':
    case 'paletero': {
      // Both hands on the handle; the wheels turn as they walk, the bell swings.
      v.arm.rotation.z = 0.63;
      r.arm2.rotation.z = 0.63;
      if (walking) r.spin += (p.speed * dt) / r.wheelR;
      for (const w of r.wheels) w.obj.rotation.z = -r.spin * w.k;
      if (r.bell) r.bell.rotation.x = walking ? Math.sin(t * 9 + ph) * 0.45 : Math.sin(t * 1.7 + ph) * 0.08;
      r.sway.rotation.y = walking ? Math.sin(p.walk * 4.5) * 0.025 : 0;
      break;
    }
    case 'drag': {
      // A sashay: the hips twist and swing with every step; the fan going, the other hand on her hip.
      const step = p.walk * 4.5;
      r.sway.rotation.y = walking ? Math.sin(step) * 0.24 : Math.sin(t * 1.3 + ph) * 0.08;
      r.sway.position.z = walking ? Math.sin(step) * 0.05 : 0;
      r.sway.rotation.x = walking ? Math.sin(step) * 0.05 : 0;
      v.arm.rotation.set(-0.15, 0, 1.25 + Math.sin(t * 5 + ph) * 0.18);
      if (r.prop) r.prop.rotation.x = Math.sin(t * 13 + ph) * 0.4;
      r.arm2.rotation.set(0.6, 0, -0.25);
      break;
    }
    case 'mariachi': {
      // Playing, swaying to the beat (or walking, like anyone).
      r.sway.rotation.y = Math.sin(t * 2.2 + ph) * 0.1;
      r.sway.position.y = Math.abs(Math.sin(t * 4.4 + ph)) * 0.02;
      if (walking) {
        v.arm.rotation.set(0, 0, -swing * 0.6);
        r.arm2.rotation.set(0, 0, swing * 0.6);
        break;
      }
      if (r.variant === 1) {
        // Trumpet: both hands up on it.
        v.arm.rotation.set(-0.3, 0, 1.4);
        r.arm2.rotation.set(0.3, 0, 1.4);
      } else if (r.variant === 2) {
        // Violin: the left hand up on its neck, the bow sawing.
        r.arm2.rotation.set(0.35, 0, 1.55);
        v.arm.rotation.set(0, Math.sin(t * 5 + ph) * 0.35, 1.05);
      } else {
        // Guitar or guitarrón: strumming, the left hand up the neck.
        v.arm.rotation.set(0, 0, 0.72 + Math.sin(t * 14 + ph) * 0.18);
        r.arm2.rotation.set(0.6, 0, 1.15);
      }
      break;
    }
    case 'hipster': {
      // The phone up to the view (or swinging along, walking), the coffee at the waist.
      v.arm.rotation.z = walking ? -swing * 0.6 : 1.3 + Math.sin(t * 1.5 + p.id) * 0.1;
      r.arm2.rotation.z = walking ? swing * 0.6 : 0.55;
      break;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Dogs: toy dogs of a few breeds, loose in the parks. They trot about their patch, sit (or lie
// down, or stop to sniff) when they get somewhere, gallop alongside a passing car barking, and
// leap clear of one that comes at them.

type EarKind = 'flop' | 'long' | 'prick' | 'bat' | 'puff';
type TailKind = 'plume' | 'otter' | 'whip' | 'stub' | 'pom' | 'curl';

/** A breed: its colours, its proportions (m, before each dog's own size) and its stride. */
interface Breed {
  name: string;
  coat: string;
  /** The chest (a corgi's white, a golden's cream), or null: all coat. */
  under: string | null;
  /** The muzzle (a corgi's white, a French bulldog's dark mask), if not the coat. */
  muzzle?: string;
  ears: string;
  /** White socks (the lower legs and paws in `under`), white cheeks (a shiba's). */
  socks?: boolean;
  cheeks?: boolean;
  /** Torso length, depth (its radius) and half-width. */
  len: number;
  girth: number;
  wide: number;
  /** Legs: shoulder or hip to the ground, and thickness. */
  leg: number;
  legR: number;
  /** Skull radius, muzzle length and radius, neck length and its angle up from level (rad). */
  head: number;
  snout: number;
  snoutR: number;
  neck: number;
  neckUp: number;
  ear: EarKind;
  earSize: number;
  /** The tail, its length, and how it's carried at a trot (radians back from straight up). */
  tail: TailKind;
  tailLen: number;
  tailUp: number;
  /** Dalmatian spots, a poodle's pompoms. */
  spots?: boolean;
  pom?: boolean;
  /** Stride rate: short legs step quicker. */
  cadence: number;
}

const BREEDS: Breed[] = [
  {
    name: 'golden retriever', coat: '#dfa052', under: '#ecc084', muzzle: '#e8ad62', ears: '#cf8d42',
    len: 0.68, girth: 0.16, wide: 0.14, leg: 0.3, legR: 0.055,
    head: 0.12, snout: 0.13, snoutR: 0.058, neck: 0.16, neckUp: 0.95,
    ear: 'flop', earSize: 1, tail: 'plume', tailLen: 0.38, tailUp: 1, cadence: 1,
  },
  {
    name: 'black lab', coat: '#2b2724', under: null, ears: '#221f1c',
    len: 0.66, girth: 0.165, wide: 0.145, leg: 0.3, legR: 0.058,
    head: 0.12, snout: 0.13, snoutR: 0.062, neck: 0.15, neckUp: 0.9,
    ear: 'flop', earSize: 0.95, tail: 'otter', tailLen: 0.36, tailUp: 1.2, cadence: 1,
  },
  {
    name: 'corgi', coat: '#e3883a', under: '#fbf5ea', muzzle: '#fbf5ea', ears: '#e3883a', socks: true,
    len: 0.6, girth: 0.135, wide: 0.13, leg: 0.14, legR: 0.05,
    head: 0.115, snout: 0.1, snoutR: 0.05, neck: 0.1, neckUp: 0.9,
    ear: 'prick', earSize: 1, tail: 'stub', tailLen: 0.1, tailUp: 0.7, cadence: 1.3,
  },
  {
    name: 'dalmatian', coat: '#f7f4ed', under: null, ears: '#26262a', spots: true,
    len: 0.66, girth: 0.14, wide: 0.12, leg: 0.34, legR: 0.046,
    head: 0.11, snout: 0.13, snoutR: 0.05, neck: 0.17, neckUp: 0.95,
    ear: 'flop', earSize: 0.9, tail: 'whip', tailLen: 0.4, tailUp: 1.05, cadence: 0.95,
  },
  {
    name: 'poodle', coat: '#f8f5ef', under: null, ears: '#f8f5ef', pom: true,
    len: 0.5, girth: 0.13, wide: 0.11, leg: 0.34, legR: 0.038,
    head: 0.1, snout: 0.12, snoutR: 0.042, neck: 0.18, neckUp: 1.05,
    ear: 'puff', earSize: 1, tail: 'pom', tailLen: 0.2, tailUp: 0.35, cadence: 1,
  },
  {
    name: 'dachshund', coat: '#9a4a22', under: null, ears: '#7a3818',
    len: 0.64, girth: 0.105, wide: 0.1, leg: 0.11, legR: 0.038,
    head: 0.09, snout: 0.14, snoutR: 0.04, neck: 0.1, neckUp: 0.85,
    ear: 'long', earSize: 1, tail: 'whip', tailLen: 0.3, tailUp: 1.2, cadence: 1.35,
  },
  {
    name: 'French bulldog', coat: '#d9b58a', under: null, muzzle: '#4a3a30', ears: '#cda679',
    len: 0.46, girth: 0.155, wide: 0.15, leg: 0.17, legR: 0.056,
    head: 0.135, snout: 0.035, snoutR: 0.07, neck: 0.07, neckUp: 0.7,
    ear: 'bat', earSize: 1, tail: 'stub', tailLen: 0.06, tailUp: 0.6, cadence: 1.25,
  },
  {
    name: 'shiba inu', coat: '#d9772f', under: '#fbf0de', muzzle: '#fbf0de', ears: '#d9772f', socks: true, cheeks: true,
    len: 0.5, girth: 0.14, wide: 0.125, leg: 0.22, legR: 0.048,
    head: 0.11, snout: 0.085, snoutR: 0.05, neck: 0.12, neckUp: 0.95,
    ear: 'prick', earSize: 0.72, tail: 'curl', tailLen: 0.1, tailUp: 0.25, cadence: 1.1,
  },
];
const COLLARS = ['#e8322a', '#2e8bff', '#ff4f9a', '#3ccf7a', '#ffd23f', '#1fd1c0', '#b67dff'];
/** Every dog a little larger than life, so it reads from a car going past. */
const DOG_SCALE = 1.1;
/** Dogs stand a touch above the sim's height (the course's): the parks' paths are drawn a few
 *  centimetres above it and the lawn beside them a few below, and this splits the difference. */
const DOG_LIFT = 0.02;
/** Legs' swing per foot in a trot and in a gallop (radians of phase): diagonal pairs, then the
 *  front pair together and the back pair together, each just out of step. */
const TROT = [0, Math.PI, Math.PI, 0];
const GALLOP = [0, -0.5, Math.PI - 0.25, Math.PI - 0.75];
/** Each leg's angle this frame (reused, dog after dog). */
const LEG_ANGLES = [0, 0, 0, 0];

/**
 * A breed's shared geometry, built the first time one turns up, and where its joints are. The torso
 * hangs from the rump (a pivot at the back of the belly, so it can sit back on it); the legs, neck,
 * jaw and tail each turn about their own joint. `rest` is the pose it drops into when it stops: a
 * sit (the rump down, the torso tipped up until the forelegs reach the ground) or, for the short
 * legged, lying down with its legs out front and back.
 */
interface DogKit {
  torso: THREE.BufferGeometry;
  gloss: THREE.BufferGeometry;
  jaw: THREE.BufferGeometry;
  fore: THREE.BufferGeometry;
  hind: THREE.BufferGeometry;
  tail: THREE.BufferGeometry;
  rumpX: number;
  rumpY: number;
  /** Joints in the rump's frame: [along, up, half the spacing across]. */
  shoulder: V3;
  hip: V3;
  neckAt: [number, number];
  /** In the neck's frame. */
  jawAt: [number, number];
  tailAt: [number, number];
  rest: { drop: number; pitch: number; fore: number; hind: number; stretch: number };
}

const DOG_KITS = new Map<number, DogKit>();
/** Heads carry the collar, so there's one per breed and collar colour. */
const DOG_HEADS = new Map<string, THREE.BufferGeometry>();

const _dm = new THREE.Matrix4();
const _dq = new THREE.Quaternion();
const _de = new THREE.Euler();
const _dp = new THREE.Vector3();
const _ds = new THREE.Vector3();
const _dn = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** An ellipsoid (radii sx, sy, sz) at (x, y, z), turned by (rx, ry, rz). */
function blob(b: GeoBuilder, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0, seg = 14): void {
  const g = new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.7)));
  b.add(g, color, _dm.compose(_dp.set(x, y, z), _dq.setFromEuler(_de.set(rx, ry, rz)), _ds.set(sx, sy, sz)));
}

/** A tapering rod from a (radius ra) to c (radius rc). */
function rod(b: GeoBuilder, color: string, a: V3, c: V3, ra: number, rc: number, seg = 10): void {
  cyl(b, a, c, rc, ra, seg, color);
}

/** A pointed ear: a cone standing on (x, y, z), `thick` front to back, tipped out by `rx`. */
function earCone(b: GeoBuilder, color: string, x: number, y: number, z: number, h: number, wide: number, thick: number, rx: number): void {
  const g = new THREE.ConeGeometry(1, 1, 10);
  g.translate(0, 0.5, 0);
  b.add(g, color, _dm.compose(_dp.set(x, y, z), _dq.setFromEuler(_de.set(rx, 0, -0.12)), _ds.set(thick, h, wide)));
}

/** Dalmatian spots over an ellipsoid (centre cx, cy; radii ax, ay, az): flat black dabs on its skin,
 *  none underneath. */
function spots(b: GeoBuilder, cx: number, cy: number, ax: number, ay: number, az: number, n: number, size: number, seed: number): void {
  for (let k = 0; k < n; k++) {
    const u = -0.82 + 1.64 * (((k + seed) * 0.618034) % 1);
    const phi = -2.3 + 4.6 * (((k + seed) * 0.381966 + 0.13) % 1);
    const w = Math.sqrt(1 - u * u);
    const x = ax * u;
    const y = ay * Math.cos(phi) * w;
    const z = az * Math.sin(phi) * w;
    _dn.set(x / (ax * ax), y / (ay * ay), z / (az * az)).normalize();
    const r = size * (0.75 + 0.5 * (((k + seed) * 0.7548) % 1));
    _dq.setFromUnitVectors(Y_AXIS, _dn);
    b.add(new THREE.SphereGeometry(1, 10, 6), '#1f1f23', _dm.compose(_dp.set(cx + x, cy + y, z).addScaledVector(_dn, -r * 0.12), _dq, _ds.set(r, r * 0.3, r)));
  }
}

function dogKit(bi: number): DogKit {
  const have = DOG_KITS.get(bi);
  if (have) return have;
  const B = BREEDS[bi];
  const { len, girth, wide, leg, legR, head: h } = B;
  const coat = B.coat;
  // The torso's middle, and the rump pivot at the back of the belly (the torso's frame from here).
  const yT = leg + girth * 0.45;
  const rumpX = -len * 0.42;
  const rumpY = yT - girth * 0.8;
  const tx = len * 0.42;
  const ty = girth * 0.8;

  const torso = new GeoBuilder();
  blob(torso, coat, tx, ty, 0, len / 2, girth, wide, 0, 0, 0, 18);
  // A deep chest, the haunches, and the chest's colour showing in front.
  blob(torso, coat, tx + len * 0.24, ty - girth * 0.08, 0, len * 0.25, girth * 1.02, wide);
  if (B.under) blob(torso, B.under, tx + len * 0.4, ty - girth * 0.28, 0, len * 0.13, girth * 0.7, wide * 0.78);
  for (const s of [1, -1]) blob(torso, coat, tx - len * 0.28, ty - girth * 0.15, s * wide * 0.5, len * 0.2, girth * 0.75, wide * 0.55);
  if (B.pom) {
    // The poodle's clip: a big ruff over the chest and a pompom on each hip.
    blob(torso, coat, tx + len * 0.2, ty + girth * 0.15, 0, len * 0.32, girth * 1.3, wide * 1.3);
    for (const s of [1, -1]) blob(torso, coat, tx - len * 0.3, ty + girth * 0.1, s * wide * 0.45, len * 0.16, girth * 0.8, wide * 0.6);
  }
  if (B.spots) spots(torso, tx, ty, len / 2, girth, wide, 18, 0.034, 0);

  // Joints (in the rump's frame).
  const shoulder: V3 = [len * 0.72, girth * 0.35, wide * 0.55];
  const hip: V3 = [len * 0.12, girth * 0.35, wide * 0.55];
  const neckAt: [number, number] = [len * 0.82, girth * 1.15];
  const tailAt: [number, number] = [-len * 0.06, girth * 1.2];

  // Head parts that don't depend on the collar: eyes, nose and tag (gloss), and the jaw.
  const dx = Math.cos(B.neckUp);
  const dy = Math.sin(B.neckUp);
  const hx = dx * B.neck;
  const hy = dy * B.neck;
  const muzzle = B.muzzle ?? coat;
  const my = hy - h * 0.3;
  const tip = hx + h * 0.7 + B.snout + B.snoutR * 0.5;
  const gloss = new GeoBuilder();
  for (const s of [1, -1]) blob(gloss, '#141417', hx + h * 0.74, hy + h * 0.28, s * h * 0.42, h * 0.14, h * 0.15, h * 0.12, 0, 0, 0, 10);
  const nr = B.snoutR * 0.45;
  blob(gloss, '#141417', tip - nr * 0.4, my + B.snoutR * 0.45, 0, nr, nr * 0.8, nr * 1.25, 0, 0, 0, 10);
  {
    const c = collarRing(B);
    blob(gloss, '#e8c250', c.x + dy * (c.r + 0.012), c.y - dx * (c.r + 0.012), 0, 0.02, 0.024, 0.009, 0, 0, 0, 8);
  }
  const jawAt: [number, number] = [hx + h * 0.45, hy - h * 0.55];
  const jaw = new GeoBuilder();
  blob(jaw, muzzle, B.snout * 0.5 + h * 0.2, -B.snoutR * 0.12, 0, B.snout * 0.5 + B.snoutR * 0.35, B.snoutR * 0.5, B.snoutR * 0.92);
  blob(jaw, '#f07a90', B.snout * 0.45 + h * 0.16, B.snoutR * 0.28, 0, B.snout * 0.42 + B.snoutR * 0.2, B.snoutR * 0.22, B.snoutR * 0.62, 0, 0, 0, 10);

  // Legs, hanging from their joints: fore and hind (a thicker thigh), paws, socks or pompoms.
  const legGeo = (hindLeg: boolean): THREE.BufferGeometry => {
    const b = new GeoBuilder();
    const foot = B.socks && B.under ? B.under : coat;
    rod(b, coat, [0, legR * 0.3, 0], [0, -leg + legR * 0.7, 0], legR * (hindLeg ? 1.35 : 1.1), legR * 0.85);
    if (B.socks && B.under) rod(b, B.under, [0, -leg * 0.52, 0], [0, -leg + legR * 0.7, 0], legR * 1.02, legR * 0.9);
    blob(b, foot, legR * 0.35, -leg + legR * 0.75, 0, legR * 1.45, legR * 0.75, legR * 1.15, 0, 0, 0, 10);
    if (B.pom) blob(b, coat, 0, -leg * 0.7, 0, legR * 2.3, legR * 2.1, legR * 2.3);
    return b.build();
  };

  // The tail, standing up from its root (+y); the pose leans it back and wags it.
  const tail = new GeoBuilder();
  const tl = B.tailLen;
  switch (B.tail) {
    case 'plume':
      blob(tail, coat, 0, tl * 0.5, 0, 0.05, tl * 0.55, 0.038);
      blob(tail, B.under ?? coat, -0.012, tl * 0.56, 0, 0.042, tl * 0.44, 0.03);
      break;
    case 'otter':
      rod(tail, coat, [0, 0, 0], [0, tl, 0], 0.045, 0.02);
      blob(tail, coat, 0, tl, 0, 0.02, 0.02, 0.02, 0, 0, 0, 8);
      break;
    case 'whip':
      rod(tail, coat, [0, 0, 0], [0, tl, 0], 0.028, 0.009);
      break;
    case 'stub':
      blob(tail, coat, 0, 0.02, 0, 0.03 + tl * 0.3, 0.035 + tl * 0.35, 0.03 + tl * 0.3);
      break;
    case 'pom':
      rod(tail, coat, [0, 0, 0], [0, tl * 0.8, 0], 0.02, 0.016);
      blob(tail, coat, 0, tl * 0.85, 0, 0.07, 0.07, 0.07);
      break;
    case 'curl': {
      // Up and over onto the back.
      const R = 0.075;
      const g = new THREE.TorusGeometry(R, 0.034, 8, 18, Math.PI * 1.4);
      g.rotateY(Math.PI);
      g.translate(R, 0, 0);
      tail.add(g, coat);
      break;
    }
  }
  if (B.spots) for (const s of [0.25, 0.6]) blob(tail, '#1f1f23', 0, tl * s, 0.02, 0.015, 0.02, 0.012, 0, 0, 0, 8);

  // Resting: a sit for the long legged, lying down for the short.
  let rest: DogKit['rest'];
  if (leg < 0.2) {
    const drop = rumpY - girth * 0.2;
    rest = { drop, pitch: 0.03, fore: 1.35, hind: -1.35, stretch: 1 };
  } else {
    const sitY = girth * 0.22;
    const target = leg * 1.15;
    const [sx, sy] = shoulder;
    let pitch = 0.4;
    for (let i = 0; i < 8; i++) pitch = Math.asin(Math.min(0.99, Math.max(0, (target - sitY - sy * Math.cos(pitch)) / sx)));
    pitch = Math.min(1, Math.max(0.2, pitch));
    const stretch = (sitY + sx * Math.sin(pitch) + sy * Math.cos(pitch)) / leg;
    rest = { drop: rumpY - sitY, pitch, fore: -pitch, hind: 1.35 - pitch, stretch };
  }

  const kit: DogKit = {
    torso: torso.build(),
    gloss: gloss.build(),
    jaw: jaw.build(),
    fore: legGeo(false),
    hind: legGeo(true),
    tail: tail.build(),
    rumpX,
    rumpY,
    shoulder,
    hip,
    neckAt,
    jawAt,
    tailAt,
    rest,
  };
  DOG_KITS.set(bi, kit);
  return kit;
}

/** Where the collar sits on a breed's neck (in the neck's frame), and its radius. */
function collarRing(B: Breed): { x: number; y: number; r: number } {
  const f = Math.max(0.35, Math.min(0.6, (B.neck - B.head * 0.6) / B.neck));
  return { x: Math.cos(B.neckUp) * B.neck * f, y: Math.sin(B.neckUp) * B.neck * f, r: B.head * 0.6 };
}

/** A breed's neck and head, with its collar in one of the collar colours. */
function dogHead(bi: number, ci: number): THREE.BufferGeometry {
  const key = `${bi}/${ci}`;
  const have = DOG_HEADS.get(key);
  if (have) return have;
  const B = BREEDS[bi];
  const h = B.head;
  const coat = B.coat;
  const b = new GeoBuilder();
  const dx = Math.cos(B.neckUp);
  const dy = Math.sin(B.neckUp);
  const hx = dx * B.neck;
  const hy = dy * B.neck;
  rod(b, coat, [-dx * 0.03, -dy * 0.03, 0], [hx, hy, 0], h * 0.62, h * 0.5);
  // The collar, round the neck.
  {
    const c = collarRing(B);
    const g = new THREE.TorusGeometry(c.r, 0.018 + h * 0.05, 8, 22);
    b.add(g, COLLARS[ci], _dm.compose(_dp.set(c.x, c.y, 0), _dq.setFromUnitVectors(Z_AXIS, _dn.set(dx, dy, 0)), _ds.set(1, 1, 1)));
  }
  // Skull and muzzle.
  blob(b, coat, hx, hy, 0, h * 1.05, h * 0.95, h * 0.9, 0, 0, 0, 16);
  const muzzle = B.muzzle ?? coat;
  blob(b, muzzle, hx + h * 0.7 + B.snout * 0.45, hy - h * 0.3, 0, B.snout * 0.55 + B.snoutR * 0.5, B.snoutR, B.snoutR * 1.1);
  if (B.spots) spots(b, hx, hy, h * 1.05, h * 0.95, h * 0.9, 4, 0.022, 3);
  if (B.cheeks && B.under) for (const s of [1, -1]) blob(b, B.under, hx + h * 0.42, hy - h * 0.32, s * h * 0.36, h * 0.48, h * 0.42, h * 0.42);
  // Ears.
  const e = B.earSize;
  for (const s of [1, -1]) {
    switch (B.ear) {
      case 'flop':
        blob(b, B.ears, hx - h * 0.1, hy - h * 0.05, s * h * 0.92, h * 0.38 * e, h * 0.62 * e, h * 0.14, -s * 0.2, 0, 0.1);
        break;
      case 'long':
        blob(b, B.ears, hx - h * 0.15, hy - h * 0.35, s * h * 0.9, h * 0.42, h * 0.95, h * 0.13, -s * 0.12, 0, 0.15);
        break;
      case 'prick':
        earCone(b, B.ears, hx - h * 0.12, hy + h * 0.5, s * h * 0.45, h * 0.95 * e, h * 0.36 * e, h * 0.16, s * 0.32);
        earCone(b, B.under ?? '#f3c3b3', hx - h * 0.06, hy + h * 0.56, s * h * 0.47, h * 0.62 * e, h * 0.2 * e, h * 0.1, s * 0.32);
        break;
      case 'bat':
        blob(b, B.ears, hx - h * 0.05, hy + h * 0.85, s * h * 0.5, h * 0.12, h * 0.55, h * 0.36, s * 0.4);
        blob(b, '#e8b0a0', hx + h * 0.02, hy + h * 0.87, s * h * 0.52, h * 0.06, h * 0.4, h * 0.24, s * 0.4);
        break;
      case 'puff':
        blob(b, B.ears, hx - h * 0.1, hy - h * 0.3, s * h * 0.85, h * 0.42, h * 0.78, h * 0.38);
        break;
    }
  }
  // A poodle's topknot.
  if (B.pom) blob(b, coat, hx - h * 0.1, hy + h * 0.7, 0, h * 0.78, h * 0.72, h * 0.72);
  const g = b.build();
  DOG_HEADS.set(key, g);
  return g;
}

interface DogView {
  root: THREE.Group;
  /** Bounces (the leap, the gait) and squashes on landing. */
  lift: THREE.Group;
  /** The torso's pivot: sits, rocks with a gallop, tips with a leap. */
  rump: THREE.Group;
  neck: THREE.Group;
  jaw: THREE.Object3D;
  /** Fore left, fore right, hind left, hind right. */
  legs: THREE.Object3D[];
  tail: THREE.Group;
  tailLean: THREE.Group;
  breed: Breed;
  kit: DogKit;
  yaw: number;
  /** Stride phase, and the sim's walk clock when it was last seen. */
  gait: number;
  walk: number;
  pace: number;
  /** How far into the resting pose, and into sniffing (0..1). */
  sit: number;
  sniff: number;
  sniffing: boolean;
  idle: boolean;
  /** The sim's bark timer and leap as last seen, and the time since the last bark. */
  bark: number;
  dive: number;
  barkT: number;
  wag: number;
  look: number;
}

function buildDog(p: Ped): DogView {
  const m = mats();
  const bi = p.color % BREEDS.length;
  const ci = Math.floor(p.color / BREEDS.length) % COLLARS.length;
  const B = BREEDS[bi];
  const k = dogKit(bi);
  const root = new THREE.Group();
  root.name = 'dog';
  root.scale.setScalar(DOG_SCALE * (0.94 + ((p.color * 7) % 13) / 100));
  const lift = new THREE.Group();
  root.add(lift);
  const rump = new THREE.Group();
  rump.position.set(k.rumpX, k.rumpY, 0);
  lift.add(rump);
  rump.add(mesh(k.torso, m.dogCoat));
  const neck = new THREE.Group();
  neck.position.set(k.neckAt[0], k.neckAt[1], 0);
  neck.add(mesh(dogHead(bi, ci), m.dogCoat), mesh(k.gloss, m.dogGloss));
  const jaw = mesh(k.jaw, m.dogCoat, k.jawAt[0], k.jawAt[1], 0);
  neck.add(jaw);
  rump.add(neck);
  const legs: THREE.Object3D[] = [];
  for (const [j, g] of [
    [k.shoulder, k.fore],
    [k.hip, k.hind],
  ] as const) {
    for (const s of [-1, 1]) {
      const l = mesh(g, m.dogCoat, j[0], j[1], s * j[2]);
      legs.push(l);
      rump.add(l);
    }
  }
  const tail = new THREE.Group();
  tail.position.set(k.tailAt[0], k.tailAt[1], 0);
  const tailLean = new THREE.Group();
  tailLean.add(mesh(k.tail, m.dogCoat));
  tail.add(tailLean);
  rump.add(tail);
  return {
    root,
    lift,
    rump,
    neck,
    jaw,
    legs,
    tail,
    tailLean,
    breed: B,
    kit: k,
    yaw: p.heading,
    gait: p.walk * 3,
    walk: p.walk,
    pace: p.pace,
    sit: 0,
    sniff: 0,
    sniffing: false,
    idle: false,
    bark: p.bark,
    dive: p.dive,
    barkT: 1,
    wag: p.id,
    look: 0,
  };
}

const wrapAngle = (a: number): number => a - TAU * Math.round(a / TAU);

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
// Crabs (the item): a toy Dungeness crab, wide oval shell, eyes on stalks, big white-tipped claws
// held up, four legs a side. It charges claws first (its wide back to the chase camera) with a
// sideways swagger.

interface CrabView {
  root: THREE.Group;
  /** Leg pivots, and which side each is on (+1: +z). */
  legs: { pivot: THREE.Group; side: number; i: number }[];
  arms: THREE.Group[];
}

function buildCrab(): CrabView {
  const m = mats();
  const g = geos();
  const root = new THREE.Group();
  root.name = 'crab';
  const body = new THREE.Group();
  body.scale.setScalar(1.6);
  body.position.y = 0.2;
  root.add(body);
  const shell = mesh(g.crabShell, m.crab, 0, 0.04, 0);
  shell.scale.set(0.72, 0.36, 1);
  body.add(shell);
  const belly = mesh(g.crabShell, m.crabBelly, 0, -0.03, 0);
  belly.scale.set(0.66, 0.22, 0.92);
  body.add(belly);
  for (const side of [1, -1]) {
    // Eyes on stalks at the front.
    body.add(mesh(g.crabStalk, m.crab, 0.3, 0.2, side * 0.09));
    body.add(mesh(g.eye, m.eye, 0.31, 0.3, side * 0.09));
    body.add(mesh(g.pupil, m.pupil, 0.37, 0.31, side * 0.09));
  }
  const legs: CrabView['legs'] = [];
  for (const side of [1, -1]) {
    for (let i = 0; i < 4; i++) {
      const pivot = new THREE.Group();
      pivot.position.set(0.16 - i * 0.13, 0, side * 0.38);
      pivot.add(mesh(g.crabLeg, m.crab, 0, 0, side * 0.17));
      body.add(pivot);
      legs.push({ pivot, side, i });
    }
  }
  const arms: THREE.Group[] = [];
  for (const side of [1, -1]) {
    const arm = new THREE.Group();
    arm.position.set(0.26, 0.06, side * 0.3);
    arm.rotation.y = -side * 0.5;
    arm.add(mesh(g.crabArm, m.crab, 0.16, 0, 0));
    const claw = mesh(g.crabClaw, m.crab, 0.4, 0.02, 0);
    claw.scale.set(1.5, 0.8, 1);
    arm.add(claw);
    arm.add(mesh(g.crabTip, m.crabTip, 0.62, 0.05, 0.03));
    arm.add(mesh(g.crabTip, m.crabTip, 0.6, -0.03, -0.03));
    body.add(arm);
    arms.push(arm);
  }
  return { root, legs, arms };
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
  private dogs = new Map<number, DogView>();
  private poos = new Map<number, PooView>();
  private boxes = new Map<number, { root: THREE.Object3D; scale: number; seen: number }>();
  private cones = new Map<number, THREE.Object3D>();
  private gulls = new Map<number, GullView>();
  private crabs = new Map<number, CrabView>();
  /** Cable cars (and streetcars): built once and kept (they only move between rounds), one per car
   *  on the rails, with the half-length, height and half-width of the box that fades them. */
  private readonly cables: { root: THREE.Group; faded: boolean; sign: string; vehicle: TramKind; hx: number; h: number; hz: number }[] = [];
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
    this.dogs.clear();
    this.poos.clear();
    this.boxes.clear();
    this.cones.clear();
    this.gulls.clear();
    this.crabs.clear();
  }

  update(dt: number, t: number, sim: RaceSim | null): void {
    if (!sim) return;
    const m = mats();
    // Waymos.
    for (const w of sim.waymos) {
      let v = this.waymos.get(w.id);
      if (!v) {
        v = w.dress === 'lowrider' ? buildLowrider(w.id) : buildWaymo();
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
      if (v.hop !== undefined) hydraulics(v, w, t);
    }
    // Pedestrians (and dogs).
    for (const p of sim.peds) {
      if (p.kind === 'dog') {
        let d = this.dogs.get(p.id);
        if (!d) {
          d = buildDog(p);
          this.dogs.set(p.id, d);
          this.group.add(d.root);
        }
        this.updateDog(d, p, dt, t, sim);
        continue;
      }
      let v = this.peds.get(p.id);
      if (!v) {
        v = p.dress ? buildDressed(p) : buildPed(p.color, p.kind === 'tourist');
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
      if (v.dress) poseDressed(v, p, walking, swing, t, dt);
      else v.arm.rotation.z = p.kind === 'tourist' && !walking ? 1.3 + Math.sin(t * 1.5 + p.id) * 0.1 : -swing * 0.6;
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
    // Crabs: scuttling sideways, legs going, claws snapping; stopped, they flip and vanish.
    for (const c of sim.crabs) {
      let v = this.crabs.get(c.id);
      if (!v) {
        v = buildCrab();
        this.crabs.set(c.id, v);
        this.group.add(v.root);
      }
      const gone = c.gone ?? 0;
      const going = c.gone === null;
      v.root.position.set(c.x, c.y + (going ? Math.abs(Math.sin(t * 24 + c.id)) * 0.08 : gone * 2.2), c.z);
      v.root.rotation.set(0, -c.heading + (going ? Math.sin(t * 9 + c.id) * 0.3 : 0), going ? 0 : gone * 9);
      v.root.scale.setScalar(going ? Math.min(1, 0.3 + c.age * 6) : Math.max(0.001, 1 - gone / 0.6));
      for (const l of v.legs) {
        const ph = t * 30 + l.i * 1.6 + (l.side > 0 ? 0 : Math.PI);
        l.pivot.rotation.set(l.side * (0.3 + Math.max(0, Math.sin(ph)) * 0.35), Math.cos(ph) * 0.35, 0);
      }
      v.arms.forEach((a, i) => (a.rotation.z = 0.55 + Math.sin(t * 11 + i * 1.9) * 0.2));
    }
    for (const [id, v] of this.crabs) {
      if (sim.crabs.some((c) => c.id === id)) continue;
      this.group.remove(v.root);
      this.crabs.delete(id);
    }
    // The cable cars (or the streetcar, its destination in amber LEDs), tipped up or down their
    // rails' slope.
    sim.cables.forEach((cb, i) => {
      let v = this.cables[i];
      if (!v || v.sign !== cb.sign || v.vehicle !== cb.vehicle) {
        if (v) this.group.remove(v.root);
        let root: THREE.Group;
        if (cb.vehicle === 'streetcar') {
          const led = signTexture(cb.sign, '#141518', '#ffb238');
          const signMat = new THREE.MeshStandardMaterial({ map: led, emissiveMap: led, emissive: '#ffffff', emissiveIntensity: 0.6, roughness: 0.45 });
          root = buildStreetcar(signMat, m.glass, cb);
        } else {
          const signMat = new THREE.MeshStandardMaterial({ map: signTexture(cb.sign, '#1d1d22', '#f6e7b8'), roughness: 0.5 });
          root = buildCableCar(signMat, m.glass);
        }
        v = this.cables[i] = { root, faded: false, sign: cb.sign, vehicle: cb.vehicle, hx: cb.length / 2 + 0.1, h: cb.height, hz: cb.width / 2 + 0.05 };
      }
      if (v.root.parent !== this.group) this.group.add(v.root);
      v.root.position.set(cb.x, cb.y + 0.07, cb.z);
      v.root.rotation.set(0, -cb.heading, cb.pitch);
    });
  }

  /**
   * A dog's pose from the sim: its legs stepping with its walk clock (a trot, stretching into a
   * gallop as it speeds up), its tail wagging (harder when it's chasing), its head nodding and its
   * jaw snapping open with every bark (turned to the car it's chasing), the resting pose when it
   * stops (or its nose to the ground), and a springy leap clear when a car comes at it.
   */
  private updateDog(v: DogView, p: Ped, dt: number, t: number, sim: RaceSim): void {
    const B = v.breed;
    const k = v.kit;
    const R = k.rest;
    const chasing = p.chase > 0;
    const leaping = p.dive > 0;
    // A bark: the chase's bark timer starting over, or a yelp as it leaps.
    if ((chasing && p.bark > v.bark + 0.05) || (leaping && v.dive <= 0)) v.barkT = 0;
    v.bark = p.bark;
    v.dive = p.dive;
    v.barkT += dt;
    // Strides follow the sim's walk clock (it runs faster the faster the dog goes): at a gallop
    // they lengthen more than they quicken.
    const dw = p.walk - v.walk;
    v.walk = p.walk;
    if (!leaping && dw > 0 && dw < 1) v.gait += (dw * 5.5 * B.cadence) / (1 + 0.06 * p.pace);
    v.pace += (p.pace - v.pace) * damp(10, dt);
    // Stopped a moment: sit (or lie down), or now and then put its nose to the ground.
    const idle = !chasing && !leaping && p.wait > 0 && p.pace < 0.05;
    if (idle && !v.idle) v.sniffing = (p.color + Math.round(p.toS * 7)) % 3 === 0;
    v.idle = idle;
    v.sit += ((idle && !v.sniffing ? 1 : 0) - v.sit) * damp(idle ? 6 : 12, dt);
    v.sniff += ((idle && v.sniffing ? 1 : 0) - v.sniff) * damp(idle ? 6 : 12, dt);
    const rest = smoothstep(0, 1, v.sit);
    const sniff = smoothstep(0, 1, v.sniff);

    // The gait: diagonal pairs at a trot; flat out, a bounding gallop, the body rocking.
    const pace = leaping ? 0 : v.pace;
    const gal = smoothstep(3.5, 7.5, pace);
    const ph = v.gait;
    const trotA = Math.min(0.55, pace * 0.24) * (1 - gal);
    const galA = 0.85 * gal;
    let lift = (1 - gal) * Math.abs(Math.cos(ph)) * 0.022 * Math.min(1, pace / 2) + gal * Math.max(0, Math.sin(ph + 1.3)) * 0.07;
    let pitch = gal * Math.sin(ph + 0.3) * 0.12;
    const legs = LEG_ANGLES;
    for (let i = 0; i < 4; i++) {
      const swing = trotA * Math.sin(ph + TROT[i]) + galA * Math.sin(ph + GALLOP[i]);
      legs[i] = swing * (1 - rest) + (i < 2 ? R.fore : R.hind) * rest;
    }
    pitch = pitch * (1 - rest) + R.pitch * rest;
    let tailLean = B.tail === 'curl' ? B.tailUp : (B.tailUp + 0.45 * gal) * (1 - rest) + (1.9 - R.pitch) * rest;
    // The head: kept up when sitting, down when sniffing, nodding at a trot, low and level at a
    // gallop, and jerking up with each bark.
    const open = v.barkT < 0.3 ? Math.sin((v.barkT / 0.3) * Math.PI) : 0;
    let neck =
      -R.pitch * 0.75 * rest -
      sniff * (1 - Math.sin(t * 19 + p.id) * 0.035) +
      Math.sin(ph * 2) * 0.05 * (1 - gal) * Math.min(1, pace / 2) -
      (pitch * 0.6 + 0.2) * gal +
      0.25 * open;
    let squash = 0;
    let yawTo = p.heading;
    if (leaping) {
      // Leaping clear, the way it's jumping.
      yawTo = Math.atan2(p.fallZ, p.fallX);
      if (p.dive > 0.6) {
        // In the air: a springy arc, nose up then down, stretched out fore and aft.
        const u = 1 - Math.min(1, (p.dive - 0.6) / 0.3);
        const st = Math.sin(u * Math.PI);
        lift = 0.55 * 4 * u * (1 - u);
        pitch = 0.6 * (0.5 - u);
        legs[0] = legs[1] = st;
        legs[2] = legs[3] = -st;
        tailLean = B.tail === 'curl' ? 0.4 : 1.35;
        neck = 0.25 - pitch * 0.5;
      } else {
        // Down again: squash, spring back up in a little hop, settle.
        const t2 = 0.6 - p.dive;
        squash = Math.exp(-t2 * 9) * Math.cos(t2 * 24);
        lift = 0.16 * Math.max(0, Math.sin((t2 - 0.1) * 9)) * Math.exp(-t2 * 4);
      }
    }
    v.yaw += wrapAngle(yawTo - v.yaw) * damp(leaping ? 18 : 10, dt);
    // Looking round at the car it's chasing, or about the park while it sits.
    let look = Math.sin(t * 0.7 + p.id * 1.3) * 0.45 * rest;
    const car = chasing && p.chaseP >= 0 ? sim.cars[p.chaseP] : undefined;
    if (car) look = -Math.max(-0.8, Math.min(0.8, wrapAngle(Math.atan2(car.z - p.z, car.x - p.x) - v.yaw)));
    v.look += (look - v.look) * damp(8, dt);
    // Tail and jaw: panting on the run.
    v.wag += dt * (chasing ? 19 : rest > 0.5 ? 8 : sniff > 0.5 ? 13 : 10 + pace);
    const wagAmp = (B.tail === 'curl' ? 0.18 : B.tail === 'stub' ? 0.7 : 0.5) * (1 - 0.35 * gal);
    const pant = chasing ? 0.2 + 0.05 * Math.sin(t * 15) : gal > 0.5 ? 0.12 : 0.02;

    v.root.position.set(p.x, p.y + DOG_LIFT, p.z);
    v.root.rotation.set(0, -v.yaw, 0);
    v.lift.position.y = lift;
    v.lift.scale.set(1 + 0.12 * squash, 1 - 0.2 * squash, 1 + 0.12 * squash);
    v.rump.position.y = k.rumpY - R.drop * rest;
    v.rump.rotation.z = pitch;
    for (let i = 0; i < 4; i++) v.legs[i].rotation.z = legs[i];
    v.legs[0].scale.y = v.legs[1].scale.y = 1 + (R.stretch - 1) * rest;
    v.neck.rotation.set(0, v.look, neck);
    v.jaw.rotation.z = -(pant + 0.55 * open);
    v.tail.rotation.y = Math.sin(v.wag) * wagAmp;
    v.tailLean.rotation.z = tailLean;
  }

  /**
   * Just before a view is drawn: Waymos (and the cable car or streetcar) that the camera is right
   * up against, or that stand between the camera and a car it follows, are drawn see-through
   * (dithered, so there's nothing to sort) instead of filling the screen with white panels.
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
      const fade = this.inTheWay(v.root, cam, cars, v.hx, v.h, v.hz);
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

// The race's moving cast, drawn from the simulation each frame: toy Waymos (lidar hats spinning,
// hazards blinking, sometimes a protest cone on the hood), wobbly tourist figurines, dogs loose in
// the parks, the map's cable cars (or its streetcar), loose traffic cones, item boxes, poo and
// seagulls.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Ped, RaceSim, TramKind } from '../sim/race';
import { GeoBuilder, cyl, type V3 } from './geo';
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
    // Dogs: every breed's coat (and collar) is vertex colour on one material, eyes, noses and
    // tags on a glossy one.
    dogCoat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }),
    dogGloss: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }),
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

// Procedural "premium toy" cars: chunky clearcoat bodies, chrome and rubber, one look per part option.
// Geometry and materials are cached at module level, so a rebuild (e.g. on hover) only creates meshes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getOption } from '../parts';
import type { CarConfig } from '../types';

export interface CarMesh {
  /** Origin at the road contact point between the wheels, +x forward, +y up, width along z. */
  readonly group: THREE.Group;
  readonly wheelRadius: number;
  /** Rolling angle in radians (distance / wheelRadius); spins all wheels. */
  setWheelRotation(angle: number): void;
  /** Kite: packed bundle (false) vs big open kite flying above/behind the car (true). No-op without a kite. */
  setKiteOpen(open: boolean): void;
  /** 0..1 engine effort: jet afterburner flame length/brightness, V8/mower exhaust flicker. */
  setThrottle(level: number): void;
  /** 0..1 nitro flame burst from the nitro bottles' nozzles. No-op without nitro. */
  setNitro(level: number): void;
  /** Glider wings: folded back along the body (false) or spread (true); animated unless instant. */
  setWingsOpen(open: boolean, instant?: boolean): void;
  /** Idle animation (flag flutter, kite sway, flame flicker). */
  update(dt: number, t: number): void;
  /** Frees per-car resources only (never shared cached geometry/materials). */
  dispose(): void;
}

// ---------------------------------------------------------------------------------------------
// Shared caches

const geoCache = new Map<string, THREE.BufferGeometry>();

function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    g.computeBoundingBox();
    geoCache.set(key, g);
  }
  return g;
}

const k3 = (n: number): string => n.toFixed(3);

/** Rounded box centred on the origin. */
function rbox(w: number, h: number, d: number, r = 0.04, seg = 3): THREE.BufferGeometry {
  return cached(`rbox:${k3(w)}:${k3(h)}:${k3(d)}:${k3(r)}:${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, r));
}

type Axis = 'x' | 'y' | 'z';

/** Cylinder along an axis; for 'x' the rTop end points to +x, for 'z' to +z. */
function cyl(axis: Axis, rTop: number, rBottom: number, len: number, seg = 20): THREE.BufferGeometry {
  return cached(`cyl:${axis}:${k3(rTop)}:${k3(rBottom)}:${k3(len)}:${seg}`, () => {
    const g = new THREE.CylinderGeometry(rTop, rBottom, len, seg);
    if (axis === 'x') g.rotateZ(-Math.PI / 2);
    else if (axis === 'z') g.rotateX(Math.PI / 2);
    return g;
  });
}

function sphere(r: number, ws = 18, hs = 12): THREE.BufferGeometry {
  return cached(`sph:${k3(r)}:${ws}:${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
}

/** Torus in the yz plane (axis along x), e.g. a steering wheel facing the driver. */
function torusX(R: number, r: number): THREE.BufferGeometry {
  return cached(`torx:${k3(R)}:${k3(r)}`, () => new THREE.TorusGeometry(R, r, 10, 28).rotateY(Math.PI / 2));
}

const UNIT_CYL_Y = (): THREE.BufferGeometry => cyl('y', 1, 1, 1, 12);

// ---------------------------------------------------------------------------------------------
// Materials

type MatSet = ReturnType<typeof makeMaterials>;
let mats: MatSet | null = null;

function physical(color: number, extra: THREE.MeshPhysicalMaterialParameters = {}): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08, ...extra });
}

function flameMat(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function makeMaterials() {
  return {
    chrome: new THREE.MeshStandardMaterial({ color: 0xf2f3f6, metalness: 1, roughness: 0.13 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xc8ced8, metalness: 0.85, roughness: 0.3 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x3a3d45, metalness: 0.75, roughness: 0.42 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: 0.88 }),
    tread: new THREE.MeshStandardMaterial({ color: 0x232429, roughness: 0.8 }),
    darkPlastic: new THREE.MeshStandardMaterial({ color: 0x2b2e36, roughness: 0.55 }),
    carbon: physical(0x1e2026, { roughness: 0.45 }),
    glass: physical(0x15222f, { metalness: 0.15, roughness: 0.06, clearcoatRoughness: 0.02 }),
    enamel: physical(0xf8f6f0, { roughness: 0.18 }),
    foam: physical(0xfbfdff, { roughness: 0.7, clearcoat: 0.2 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe6b54c, metalness: 1, roughness: 0.22 }),
    headlight: new THREE.MeshStandardMaterial({
      color: 0xfffbe8,
      emissive: 0xfff0c0,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    }),
    taillight: new THREE.MeshStandardMaterial({
      color: 0xff3a30,
      emissive: 0xb00000,
      emissiveIntensity: 0.7,
      roughness: 0.25,
    }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe28a, emissiveIntensity: 0.8 }),
    jerryRed: physical(0xc92b1f, { roughness: 0.45, clearcoat: 0.6 }),
    propane: physical(0xf3f0e7, { roughness: 0.3 }),
    nitroBlue: physical(0x1f63e8, { metalness: 0.3, roughness: 0.22 }),
    mowerGreen: physical(0x2fa24a, { roughness: 0.32 }),
    red: physical(0xd8262e, { roughness: 0.3 }),
    yellow: physical(0xffc61a, { roughness: 0.3 }),
    white: physical(0xf6f6f2, { roughness: 0.3 }),
    suit: physical(0xf3f3ef, { roughness: 0.55, clearcoat: 0.3 }),
    black: physical(0x141418, { roughness: 0.4 }),
    orange: physical(0xff6613, { roughness: 0.35 }),
    duck: physical(0xffd21c, { roughness: 0.25 }),
    beak: physical(0xff8a1a, { roughness: 0.3 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.2 }),
    kiteYellow: new THREE.MeshStandardMaterial({ color: 0xffd21c, roughness: 0.6, side: THREE.DoubleSide }),
    kiteFabric: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      side: THREE.DoubleSide,
    }),
    line: new THREE.LineBasicMaterial({ color: 0x33302c }),
    flameOuter: flameMat(0xff4a0c, 0.85),
    flameCore: flameMat(0xffb43c, 0.8),
    nitroOuter: flameMat(0x1f6dff, 0.9),
    nitroCore: flameMat(0x9fd4ff, 0.85),
    glow: new THREE.MeshBasicMaterial({ color: 0xff8a2a, toneMapped: false }),
  };
}

function M(): MatSet {
  if (!mats) mats = makeMaterials();
  return mats;
}

const paintCache = new Map<string, THREE.MeshPhysicalMaterial>();
function paintMat(hex: string): THREE.MeshPhysicalMaterial {
  let m = paintCache.get(hex);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(hex),
      metalness: 0.25,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
    });
    paintCache.set(hex, m);
  }
  return m;
}

const accentCache = new Map<string, THREE.MeshPhysicalMaterial>();
function accentMat(hex: string): THREE.MeshPhysicalMaterial {
  let m = accentCache.get(hex);
  if (!m) {
    m = physical(new THREE.Color(hex).getHex(), { roughness: 0.25 });
    accentCache.set(hex, m);
  }
  return m;
}

const flagCache = new Map<string, THREE.MeshStandardMaterial>();
function flagMat(hex: string): THREE.MeshStandardMaterial {
  let m = flagCache.get(hex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.65, side: THREE.DoubleSide });
    flagCache.set(hex, m);
  }
  return m;
}

// ---------------------------------------------------------------------------------------------
// Build context and small mesh helpers

interface Flame {
  obj: THREE.Object3D;
  kind: 'engine' | 'nitro';
  baseLen: number;
  gainLen: number;
  width: number;
}

interface Ctx {
  root: THREE.Group;
  body: THREE.Group;
  paint: THREE.MeshPhysicalMaterial;
  accentHex: string;
  accent: THREE.MeshPhysicalMaterial;
  r: number;
  wheelW: number;
  wb: number;
  halfTrack: number;
  hasJet: boolean;
  flames: Flame[];
  /** Objects excluded from shadows and from the topper's height probe. */
  fx: Set<THREE.Object3D>;
  disposables: { dispose(): void }[];
  wheelSpins: THREE.Object3D[];
  /** Glider wing hinges (one per side, side = +1 for +z), and the upright tip plates. */
  wingPivots: { pivot: THREE.Group; side: number; winglet: THREE.Object3D }[];
}

interface MeshOpts {
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

function add(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  o: MeshOpts = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  if (o.rx || o.ry || o.rz) mesh.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
  if (o.sx !== undefined || o.sy !== undefined || o.sz !== undefined) mesh.scale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  parent.add(mesh);
  return mesh;
}

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

/** A cylinder rod between two points (unit cylinder scaled). */
function rod(
  parent: THREE.Object3D,
  mat: THREE.Material,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  radius: number,
): THREE.Mesh {
  _dir.set(bx - ax, by - ay, bz - az);
  const len = _dir.length();
  const mesh = new THREE.Mesh(UNIT_CYL_Y(), mat);
  mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  mesh.quaternion.setFromUnitVectors(_up, _dir.normalize());
  mesh.scale.set(radius, len, radius);
  parent.add(mesh);
  return mesh;
}

/** Flame cone: base at the local origin, tip along local -x; scaled (length, width, width). */
function flameGeo(): THREE.BufferGeometry {
  return cached('flame', () => {
    const g = new THREE.ConeGeometry(1, 1, 14, 1, true);
    g.rotateZ(Math.PI / 2);
    g.translate(-0.5, 0, 0);
    return g;
  });
}

function addFlame(
  ctx: Ctx,
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  kind: 'engine' | 'nitro',
  baseLen: number,
  gainLen: number,
  width: number,
  rot: MeshOpts = {},
): void {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.set(rot.rx ?? 0, rot.ry ?? 0, rot.rz ?? 0);
  const m = M();
  const outer = new THREE.Mesh(flameGeo(), kind === 'nitro' ? m.nitroOuter : m.flameOuter);
  const core = new THREE.Mesh(flameGeo(), kind === 'nitro' ? m.nitroCore : m.flameCore);
  core.scale.set(0.5, 0.45, 0.45);
  outer.renderOrder = 2;
  core.renderOrder = 3;
  g.add(outer, core);
  g.visible = false;
  parent.add(g);
  ctx.fx.add(g);
  ctx.flames.push({ obj: g, kind, baseLen, gainLen, width });
}

// ---------------------------------------------------------------------------------------------
// Wheels

interface WheelType {
  r: number;
  w: number;
}

const WHEEL_TYPES: Record<string, WheelType> = {
  tiny: { r: 0.2, w: 0.13 },
  standard: { r: 0.34, w: 0.24 },
  monster: { r: 0.62, w: 0.5 },
};

function tireGeo(R: number, Ri: number, w: number, bevel: number, segs: number): THREE.BufferGeometry {
  return cached(`tire:${k3(R)}:${k3(Ri)}:${k3(w)}:${k3(bevel)}`, () => {
    // Profile traversed from -z to +z so the lathe faces point outwards.
    const pts: THREE.Vector2[] = [];
    const hw = w / 2;
    const steps = 5;
    pts.push(new THREE.Vector2(Ri, -hw));
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
      pts.push(new THREE.Vector2(R - bevel + Math.cos(a) * bevel, -hw + bevel + Math.sin(a) * bevel));
    }
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * (Math.PI / 2);
      pts.push(new THREE.Vector2(R - bevel + Math.cos(a) * bevel, hw - bevel + Math.sin(a) * bevel));
    }
    pts.push(new THREE.Vector2(Ri, hw));
    const g = new THREE.LatheGeometry(pts, segs);
    g.rotateX(Math.PI / 2);
    return g;
  });
}

/** Spokes / slots / bolts merged into one geometry, symmetric on both faces. */
function hubDetailGeo(kind: string): THREE.BufferGeometry {
  return cached(`hub:${kind}`, () => {
    const parts: THREE.BufferGeometry[] = [];
    if (kind === 'tiny') {
      for (let i = 0; i < 3; i++) {
        const g = new THREE.BoxGeometry(0.035, 0.2, 0.15);
        g.rotateZ((i * Math.PI) / 3);
        parts.push(g);
      }
    } else if (kind === 'standard') {
      for (let i = 0; i < 5; i++) {
        const g = new THREE.BoxGeometry(0.045, 0.12, 0.26);
        g.translate(0, 0.12, 0);
        g.rotateZ((i * 2 * Math.PI) / 5);
        parts.push(g);
      }
    } else {
      for (let i = 0; i < 6; i++) {
        const g = new THREE.CylinderGeometry(0.045, 0.045, 0.52, 10);
        g.rotateX(Math.PI / 2);
        g.translate(0, 0.21, 0);
        g.rotateZ((i * Math.PI) / 3);
        parts.push(g);
      }
      const hub = new THREE.CylinderGeometry(0.11, 0.11, 0.56, 16);
      hub.rotateX(Math.PI / 2);
      parts.push(hub);
    }
    return mergeGeometries(parts)!;
  });
}

function lugGeo(R: number, w: number): THREE.BufferGeometry {
  return cached(`lugs:${k3(R)}:${k3(w)}`, () => {
    const parts: THREE.BufferGeometry[] = [];
    const n = 16;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < n; i++) {
        const a = ((i + row * 0.5) / n) * Math.PI * 2;
        const g = new THREE.BoxGeometry(0.15, 0.11, w * 0.46);
        g.translate(0, R + 0.005, (row === 0 ? 1 : -1) * w * 0.24);
        g.rotateZ(a);
        parts.push(g);
      }
    }
    return mergeGeometries(parts)!;
  });
}

function buildWheel(ctx: Ctx, kind: string, x: number, z: number): void {
  const t = WHEEL_TYPES[kind];
  const m = M();
  const mount = new THREE.Group();
  mount.position.set(x, 0, z);
  const spin = new THREE.Group();
  mount.add(spin);
  if (kind === 'tiny') {
    add(spin, tireGeo(t.r, 0.1, t.w, 0.05, 22), m.rubber);
    add(spin, cyl('z', 0.105, 0.105, t.w - 0.01, 18), m.white);
    add(spin, hubDetailGeo('tiny'), ctx.accent);
  } else if (kind === 'standard') {
    add(spin, tireGeo(t.r, 0.21, t.w, 0.08, 28), m.rubber);
    add(spin, cyl('z', 0.215, 0.215, t.w - 0.03, 24), m.chrome);
    add(spin, hubDetailGeo('standard'), m.darkPlastic);
    add(spin, cyl('z', 0.06, 0.06, t.w + 0.04, 14), m.chrome);
  } else {
    add(spin, tireGeo(t.r - 0.06, 0.34, t.w, 0.12, 30), m.tread);
    add(spin, lugGeo(t.r - 0.06, t.w), m.tread);
    add(spin, cyl('z', 0.345, 0.345, t.w - 0.08, 26), m.yellow);
    add(spin, hubDetailGeo('monster'), m.chrome);
  }
  ctx.body.add(mount);
  ctx.wheelSpins.push(spin);
}

/** Fender arch over a wheel (sedan / pickup). */
function fenderGeo(R: number, t: number, depth: number): THREE.BufferGeometry {
  return cached(`fender:${k3(R)}:${k3(t)}:${k3(depth)}`, () => {
    const s = new THREE.Shape();
    s.moveTo(R + t, 0);
    s.absarc(0, 0, R + t, 0, Math.PI, false);
    s.lineTo(-R, 0);
    s.absarc(0, 0, R, Math.PI, 0, true);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      bevelSegments: 2,
      curveSegments: 18,
    });
    g.translate(0, 0, -depth / 2);
    return g;
  });
}

function addFenders(ctx: Ctx): void {
  const R = ctx.r + 0.07;
  const geo = fenderGeo(R, 0.08, ctx.wheelW + 0.06);
  for (const x of [ctx.wb / 2, -ctx.wb / 2]) {
    for (const s of [1, -1]) add(ctx.body, geo, ctx.paint, x, 0, s * ctx.halfTrack);
  }
}

function addAxles(ctx: Ctx, y = 0): void {
  const m = M();
  for (const x of [ctx.wb / 2, -ctx.wb / 2]) {
    add(ctx.body, cyl('z', 0.04, 0.04, ctx.halfTrack * 2, 10), m.darkMetal, x, y, 0);
  }
}

// ---------------------------------------------------------------------------------------------
// Chassis layouts. Body frame: y = 0 at axle height, x = 0 mid-wheelbase.

interface Layout {
  engine: { x: number; y: number };
  jet: { x: number; y: number; len: number; pylonY: number; pylonX: number[] };
  jerry: { x: number; y: number; z: number };
  tank: { x: number; y: number; z: number; axis: 'x' | 'z'; len: number };
  big: { x: number; y: number; z: number; len: number; r: number; baseY: number };
  spoiler: { x: number; baseY: number; y: number; span: number; strutZ: number };
  glider: { x: number; y: number; rootZ: number; strutFromY?: number; strutZ?: number };
  nose: { x: number; y: number; h: number; w: number };
  /** Nose position when the oversized tank sits in front of the body. */
  noseWithBig?: number;
  nitro: { x: number; y: number; z: number; len: number };
  kite: { x: number; z: number; baseY: number; topY: number };
  topperX: number;
}

function driver(ctx: Ctx, x: number, y: number, lean = 0.18): void {
  const m = M();
  add(ctx.body, rbox(0.3, 0.44, 0.38, 0.12), m.suit, x, y, 0, { rz: lean });
  add(ctx.body, sphere(0.175), ctx.accent, x + 0.03, y + 0.36, 0);
  add(ctx.body, rbox(0.1, 0.1, 0.25, 0.045), m.glass, x + 0.165, y + 0.37, 0);
}

function buildKart(ctx: Ctx): Layout {
  const m = M();
  const b = ctx.body;
  const railLen = Math.max(1.9, ctx.wb + 0.5);
  for (const z of [0.36, -0.36]) add(b, cyl('x', 0.035, 0.035, railLen, 10), m.chrome, 0, 0.0, z);
  for (const x of [railLen / 2 - 0.08, 0.28, -0.28, -railLen / 2 + 0.08]) {
    add(b, cyl('z', 0.03, 0.03, 0.74, 10), m.chrome, x, 0.0, 0);
  }
  addAxles(ctx, 0);
  add(b, rbox(1.3, 0.04, 0.68, 0.015), m.darkPlastic, 0.08, 0.02, 0);
  // Front fairing and side pods in body colour.
  add(b, rbox(0.44, 0.22, 0.8, 0.09), ctx.paint, 0.74, 0.1, 0);
  const podLen = THREE.MathUtils.clamp(ctx.wb - 2 * ctx.r - 0.14, 0.3, 0.8);
  for (const s of [1, -1]) {
    add(b, rbox(podLen, 0.2, 0.18, 0.08), ctx.paint, 0.0, 0.12, s * 0.47);
    // Racing number roundel on each pod.
    add(b, cyl('z', 0.075, 0.075, 0.02, 16), m.white, 0.0, 0.13, s * 0.565);
    add(b, cyl('z', 0.05, 0.05, 0.03, 16), ctx.accent, 0.0, 0.13, s * 0.565);
  }
  add(b, cyl('z', 0.045, 0.045, 0.9, 12), m.chrome, -railLen / 2 - 0.02, 0.06, 0);
  // Seat, driver, steering.
  add(b, rbox(0.42, 0.1, 0.46, 0.04), m.darkPlastic, 0.02, 0.09, 0);
  add(b, rbox(0.1, 0.52, 0.46, 0.05), m.darkPlastic, -0.2, 0.36, 0, { rz: 0.25 });
  driver(ctx, 0.04, 0.38);
  add(b, torusX(0.13, 0.022), m.darkPlastic, 0.33, 0.47, 0, { rz: 0.35 });
  rod(b, m.darkMetal, 0.36, 0.46, 0, 0.58, 0.12, 0, 0.02);
  rod(b, m.suit, 0.08, 0.56, 0.17, 0.3, 0.5, 0.11, 0.05);
  rod(b, m.suit, 0.08, 0.56, -0.17, 0.3, 0.5, -0.11, 0.05);
  // Roll hoop.
  add(b, rollHoopGeo(), m.chrome, -0.27, 0, 0);

  return {
    engine: { x: -0.62, y: 0.03 },
    jet: { x: -1.17, y: 0.74, len: 1.5, pylonY: 0.03, pylonX: [-0.85] },
    jerry: { x: 0.72, y: 0.21, z: 0.22 },
    tank: { x: 0.72, y: 0.21 + 0.15, z: 0, axis: 'z', len: 0.74 },
    big: { x: 0.74, y: 0.68, z: 0, len: 1.0, r: 0.38, baseY: 0.03 },
    spoiler: {
      x: -railLen / 2 - 0.05,
      baseY: 0.02,
      y: ctx.hasJet ? 1.24 : 0.98,
      span: 1.1,
      strutZ: ctx.hasJet ? 0.42 : 0.25,
    },
    glider: { x: -0.12, y: 0.58, rootZ: 0.34, strutFromY: 0.22, strutZ: 0.47 },
    nose: { x: 0.96, y: 0.1, h: 0.26, w: 0.8 },
    nitro: { x: -0.5, y: 0.2, z: 0.46, len: 0.5 },
    kite: { x: -0.3, z: 0, baseY: 0.0, topY: 1.3 },
    topperX: 0.07,
  };
}

function rollHoopGeo(): THREE.BufferGeometry {
  return cached('rollhoop', () => {
    const pts = [
      new THREE.Vector3(0, 0.0, -0.3),
      new THREE.Vector3(0, 0.62, -0.3),
      new THREE.Vector3(0, 0.88, -0.22),
      new THREE.Vector3(0, 0.96, 0),
      new THREE.Vector3(0, 0.88, 0.22),
      new THREE.Vector3(0, 0.62, 0.3),
      new THREE.Vector3(0, 0.0, 0.3),
    ];
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.032, 8, false);
  });
}

/** Closed rounded-rectangle loop in the xz plane (for the bathtub's rolled rim). */
class RoundedRectCurve extends THREE.Curve<THREE.Vector3> {
  private readonly a: number;
  private readonly b: number;
  private readonly c: number;
  constructor(a: number, b: number, c: number) {
    super();
    this.a = a;
    this.b = b;
    this.c = c;
  }
  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const { a, b, c } = this;
    const sx = 2 * (a - c);
    const sz = 2 * (b - c);
    const arc = (Math.PI / 2) * c;
    const total = 2 * sx + 2 * sz + 4 * arc;
    let d = (((t % 1) + 1) % 1) * total;
    // Walk: +x edge (along z), corner, +z edge (along -x), corner, -x edge, corner, -z edge, corner.
    const edges: [number, number, number, number, number][] = [
      // length, startX, startZ, dirX, dirZ
      [sz, a, -(b - c), 0, 1],
      [sx, a - c, b, -1, 0],
      [sz, -a, b - c, 0, -1],
      [sx, -(a - c), -b, 1, 0],
    ];
    const corners: [number, number, number][] = [
      // centreX, centreZ, startAngle
      [a - c, b - c, 0],
      [-(a - c), b - c, Math.PI / 2],
      [-(a - c), -(b - c), Math.PI],
      [a - c, -(b - c), (3 * Math.PI) / 2],
    ];
    for (let i = 0; i < 4; i++) {
      const [len, x0, z0, dx, dz] = edges[i];
      if (d <= len) return target.set(x0 + dx * d, 0, z0 + dz * d);
      d -= len;
      if (d <= arc) {
        const [cx, cz, a0] = corners[i];
        const ang = a0 + d / c;
        return target.set(cx + Math.cos(ang) * c, 0, cz + Math.sin(ang) * c);
      }
      d -= arc;
    }
    return target.set(a, 0, -(b - c));
  }
}

const TUB_STRETCH = 0.98;

/** Clawfoot tub shell: outer (painted) or inner (enamel) surface, bottom at y = 0, rim at y = 0.6. */
function tubShellGeo(inner: boolean): THREE.BufferGeometry {
  return cached(`tub:${inner}`, () => {
    const outer: [number, number][] = [
      [0.0, 0.0],
      [0.2, 0.0],
      [0.29, 0.02],
      [0.35, 0.07],
      [0.39, 0.16],
      [0.42, 0.3],
      [0.445, 0.45],
      [0.46, 0.57],
      [0.465, 0.61],
    ];
    const innerPts: [number, number][] = [
      [0.44, 0.61],
      [0.43, 0.5],
      [0.405, 0.34],
      [0.365, 0.21],
      [0.31, 0.13],
      [0.22, 0.1],
      [0.0, 0.1],
    ];
    const pts = (inner ? innerPts : outer).map(([r, y]) => new THREE.Vector2(r, y));
    const segs = 36;
    const g = new THREE.LatheGeometry(pts, segs, Math.PI / segs);
    // Stretch the circle into a stadium: push each half out along x.
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setX(i, x + Math.sign(x) * (TUB_STRETCH / 2));
    }
    pos.needsUpdate = true;
    return g;
  });
}

function buildTub(ctx: Ctx, fuelId: string): Layout {
  const m = M();
  const b = ctx.body;
  const bigFront = fuelId === 'big';
  const frontExt = bigFront ? 1.8 : 1.05;
  const rearExt = -1.55;
  for (const z of [0.28, -0.28]) {
    const len = frontExt - rearExt;
    add(b, cyl('x', 0.035, 0.035, len, 10), m.darkMetal, (frontExt + rearExt) / 2, -0.02, z);
  }
  addAxles(ctx, -0.02);
  add(b, rbox(0.62, 0.05, 0.64, 0.015), m.darkPlastic, -1.25, 0.03, 0);
  if (bigFront) add(b, rbox(0.8, 0.05, 0.64, 0.015), m.darkPlastic, 1.36, 0.03, 0);
  // The tub: a stretched lathe (stadium plan, flared sides), painted outside, enamel inside.
  add(b, tubShellGeo(false), ctx.paint, 0, 0.14, 0);
  add(b, tubShellGeo(true), m.enamel, 0, 0.14, 0);
  add(
    b,
    cached('tubrim', () => new THREE.TubeGeometry(new RoundedRectCurve(0.465 + TUB_STRETCH / 2, 0.465, 0.465), 72, 0.04, 8, true)),
    m.enamel,
    0,
    0.745,
    0,
  );
  // Bubble bath around the driver.
  const bubbles: [number, number, number, number][] = [
    [0.62, 0.72, 0.18, 0.13],
    [0.66, 0.7, -0.16, 0.12],
    [0.02, 0.71, 0.24, 0.13],
    [-0.05, 0.7, -0.22, 0.14],
    [-0.4, 0.69, 0.1, 0.15],
    [-0.62, 0.7, -0.14, 0.13],
    [-0.3, 0.72, -0.28, 0.1],
    [0.3, 0.74, 0.3, 0.09],
  ];
  for (const [bx, by, bz, br] of bubbles) add(b, sphere(br, 14, 10), m.foam, bx, by, bz);
  // Gold clawfeet.
  for (const x of [0.66, -0.66]) {
    for (const z of [0.22, -0.22]) {
      add(b, sphere(0.075, 12, 8), m.gold, x, 0.1, z);
      add(b, sphere(0.07, 12, 8), m.gold, x + Math.sign(x) * 0.04, 0.025, z + Math.sign(z) * 0.02, { sx: 1.6, sy: 0.55, sz: 1.3 });
    }
  }
  // Taps at the back.
  add(b, cyl('y', 0.035, 0.035, 0.16, 10), m.chrome, -0.88, 0.83, 0);
  rod(b, m.chrome, -0.88, 0.9, 0, -0.76, 0.9, 0, 0.03);
  for (const z of [0.13, -0.13]) add(b, sphere(0.045, 10, 8), m.chrome, -0.88, 0.82, z);
  // Driver and a steering wheel on a stalk.
  add(b, rbox(0.34, 0.5, 0.38, 0.1), m.suit, 0.28, 0.45, 0);
  driver(ctx, 0.3, 0.86, 0.12);
  add(b, torusX(0.13, 0.022), m.darkPlastic, 0.66, 1.02, 0, { rz: 0.35 });
  rod(b, m.darkMetal, 0.7, 1.0, 0, 0.86, 0.75, 0, 0.022);
  rod(b, m.suit, 0.33, 1.05, 0.17, 0.62, 1.04, 0.11, 0.05);
  rod(b, m.suit, 0.33, 1.05, -0.17, 0.62, 1.04, -0.11, 0.05);

  return {
    engine: { x: -1.25, y: 0.055 },
    jet: { x: -0.8, y: 1.22, len: 1.5, pylonY: 0.76, pylonX: [-1.2, -0.45] },
    jerry: { x: -0.02, y: 0.3, z: 0.54 },
    tank: { x: 0.28, y: 0.5, z: -0.58, axis: 'x', len: 0.52 },
    big: { x: 1.36, y: 0.46, z: 0, len: 1.0, r: 0.4, baseY: 0.055 },
    spoiler: { x: -0.86, baseY: 0.76, y: ctx.hasJet ? 1.72 : 1.18, span: 1.0, strutZ: ctx.hasJet ? 0.4 : 0.22 },
    glider: { x: -0.02, y: 0.81, rootZ: 0.3 },
    nose: { x: 0.97, y: 0.44, h: 0.55, w: 0.82 },
    noseWithBig: 1.78,
    nitro: { x: -0.45, y: 0.52, z: 0.57, len: 0.55 },
    kite: { x: -0.55, z: 0.4, baseY: 0.78, topY: 1.95 },
    topperX: 0.33,
  };
}

function lights(ctx: Ctx, x: number, y: number, z: number, rearX: number, rearY: number, rearZ: number): void {
  const m = M();
  for (const s of [1, -1]) {
    add(ctx.body, cyl('x', 0.12, 0.12, 0.07, 18), m.headlight, x, y, s * z);
    add(ctx.body, cyl('x', 0.14, 0.14, 0.04, 18), m.chrome, x - 0.02, y, s * z);
    add(ctx.body, rbox(0.06, 0.13, 0.34, 0.03), m.taillight, rearX, rearY, s * rearZ);
  }
}

function roundels(ctx: Ctx, x: number, y: number, z: number): void {
  const m = M();
  for (const s of [1, -1]) {
    add(ctx.body, cyl('z', 0.2, 0.2, 0.03, 24), m.white, x, y, s * z);
    add(ctx.body, cyl('z', 0.15, 0.15, 0.04, 24), ctx.accent, x, y, s * z);
  }
}

function buildSedan(ctx: Ctx): Layout {
  const m = M();
  const b = ctx.body;
  add(b, rbox(4.2, 0.72, 1.7, 0.26, 4), ctx.paint, 0, 0.24, 0);
  // Cabin: painted shell with glass set into each face.
  add(b, rbox(2.0, 0.64, 1.5, 0.16, 4), ctx.paint, -0.28, 0.88, 0);
  for (const s of [1, -1]) {
    add(b, rbox(0.8, 0.34, 0.03, 0.06), m.glass, 0.2, 0.93, s * 0.75);
    add(b, rbox(0.72, 0.34, 0.03, 0.06), m.glass, -0.72, 0.93, s * 0.75);
  }
  add(b, rbox(0.03, 0.36, 1.26, 0.06), m.glass, 0.725, 0.93, 0);
  add(b, rbox(0.03, 0.32, 1.2, 0.06), m.glass, -1.285, 0.93, 0);
  // Hood and trunk trim, bumpers, grille.
  add(b, rbox(0.16, 0.2, 1.76, 0.08), m.chrome, 2.12, 0.03, 0);
  add(b, rbox(0.16, 0.2, 1.76, 0.08), m.chrome, -2.12, 0.03, 0);
  add(b, rbox(0.06, 0.22, 0.86, 0.04), m.darkPlastic, 2.1, 0.33, 0);
  lights(ctx, 2.08, 0.34, 0.6, -2.1, 0.38, 0.58);
  roundels(ctx, 0.42, 0.2, 0.85);
  addFenders(ctx);
  return {
    engine: { x: 1.45, y: 0.53 },
    jet: { x: -0.4, y: 1.62, len: 1.55, pylonY: 1.22, pylonX: [-0.4] },
    jerry: { x: -1.72, y: 0.6, z: 0 },
    tank: { x: -1.72, y: 0.6 + 0.15, z: 0, axis: 'z', len: 0.9 },
    big: { x: -1.7, y: 0.6 + 0.37, z: 0, len: 1.0, r: 0.37, baseY: 0.6 },
    spoiler: { x: -1.96, baseY: 0.6, y: 1.02, span: 1.6, strutZ: 0.35 },
    glider: { x: -0.3, y: 0.42, rootZ: 0.8 },
    nose: { x: 2.2, y: 0.24, h: 0.72, w: 1.72 },
    nitro: { x: -1.62, y: 0.7, z: 0.63, len: 0.6 },
    kite: { x: 0.62, z: 0, baseY: 1.2, topY: 2.05 },
    topperX: -0.34,
  };
}

function buildPickup(ctx: Ctx): Layout {
  const m = M();
  const b = ctx.body;
  add(b, rbox(5.0, 0.84, 1.9, 0.24, 4), ctx.paint, 0, 0.3, 0);
  add(b, rbox(1.3, 0.1, 1.2, 0.05), ctx.paint, 1.82, 0.75, 0);
  add(b, rbox(1.55, 0.72, 1.76, 0.16, 4), ctx.paint, 0.45, 1.07, 0);
  for (const s of [1, -1]) add(b, rbox(0.95, 0.38, 0.03, 0.06), m.glass, 0.5, 1.13, s * 0.88);
  add(b, rbox(0.03, 0.4, 1.46, 0.06), m.glass, 1.225, 1.13, 0);
  add(b, rbox(0.03, 0.3, 1.3, 0.06), m.glass, -0.325, 1.16, 0);
  // Bed: liner, side walls and tailgate.
  add(b, rbox(2.05, 0.03, 1.66, 0.01), m.darkPlastic, -1.43, 0.735, 0);
  for (const s of [1, -1]) add(b, rbox(2.16, 0.38, 0.1, 0.04), ctx.paint, -1.42, 0.9, s * 0.9);
  add(b, rbox(0.1, 0.38, 1.9, 0.04), ctx.paint, -2.45, 0.9, 0);
  // Grille, bumpers.
  add(b, rbox(0.08, 0.38, 1.18, 0.04), m.chrome, 2.52, 0.42, 0);
  for (let i = 0; i < 4; i++) add(b, rbox(0.06, 0.03, 1.1, 0.01), m.darkPlastic, 2.56, 0.3 + i * 0.08, 0);
  add(b, rbox(0.22, 0.24, 1.98, 0.08), m.darkPlastic, 2.56, 0.02, 0);
  add(b, rbox(0.22, 0.24, 1.98, 0.08), m.darkPlastic, -2.56, 0.02, 0);
  lights(ctx, 2.5, 0.44, 0.72, -2.52, 0.5, 0.78);
  roundels(ctx, 0.8, 0.28, 0.95);
  // Roll bar with light pods.
  for (const s of [1, -1]) add(b, cyl('y', 0.05, 0.05, 1.0, 12), m.chrome, -0.5, 1.22, s * 0.78);
  add(b, cyl('z', 0.05, 0.05, 1.66, 12), m.chrome, -0.5, 1.72, 0);
  for (const z of [0.2, -0.2, 0.58, -0.58]) {
    add(b, cyl('x', 0.1, 0.1, 0.14, 16), m.black, -0.44, 1.82, z);
    add(b, cyl('x', 0.08, 0.08, 0.02, 16), m.lamp, -0.37, 1.82, z);
  }
  addFenders(ctx);
  return {
    engine: { x: 1.85, y: 0.7 },
    jet: { x: -1.05, y: 2.26, len: 1.6, pylonY: 1.74, pylonX: [-0.5] },
    jerry: { x: -2.05, y: 0.75, z: 0.5 },
    tank: { x: -1.4, y: 0.75 + 0.16, z: -0.52, axis: 'x', len: 1.1 },
    big: { x: -1.38, y: 0.75 + 0.4, z: 0, len: 1.5, r: 0.4, baseY: 0.75 },
    spoiler: { x: -2.38, baseY: 1.09, y: 1.5, span: 1.9, strutZ: 0.5 },
    glider: { x: 0.1, y: 0.5, rootZ: 0.9 },
    nose: { x: 2.67, y: 0.3, h: 0.84, w: 1.9 },
    nitro: { x: -1.55, y: 0.93, z: 1.03, len: 0.7 },
    kite: { x: -0.5, z: 0.78, baseY: 1.74, topY: 2.55 },
    topperX: 0.42,
  };
}

// ---------------------------------------------------------------------------------------------
// Engines

function buildMower(ctx: Ctx, x: number, y: number): void {
  const m = M();
  const b = ctx.body;
  add(b, rbox(0.46, 0.06, 0.42, 0.02), m.darkMetal, x, y + 0.03, 0);
  add(b, rbox(0.34, 0.22, 0.32, 0.05), m.darkMetal, x, y + 0.17, 0);
  add(b, rbox(0.42, 0.22, 0.38, 0.1), m.mowerGreen, x + 0.02, y + 0.33, 0);
  add(b, cyl('y', 0.12, 0.13, 0.06, 20), m.black, x + 0.02, y + 0.46, 0);
  rod(b, m.darkPlastic, x + 0.08, y + 0.48, 0.02, x + 0.18, y + 0.55, 0.02, 0.008);
  add(b, rbox(0.03, 0.03, 0.15, 0.012), m.red, x + 0.19, y + 0.56, 0.02);
  add(b, cyl('x', 0.05, 0.05, 0.18, 12), m.chrome, x - 0.22, y + 0.2, 0.14);
  addFlame(ctx, b, x - 0.31, y + 0.2, 0.14, 'engine', 0.05, 0.22, 0.045);
}

function buildV8(ctx: Ctx, x: number, y: number): void {
  const m = M();
  const b = ctx.body;
  add(b, rbox(0.64, 0.38, 0.5, 0.06), m.darkMetal, x, y + 0.14, 0);
  for (const s of [1, -1]) {
    add(b, rbox(0.6, 0.08, 0.11, 0.03), m.red, x, y + 0.36, s * 0.15);
    for (const dx of [0.14, -0.14]) {
      rod(b, m.chrome, x + dx, y + 0.24, s * 0.25, x + dx, y + 0.24, s * 0.31, 0.04);
      rod(b, m.chrome, x + dx, y + 0.24, s * 0.31, x + dx - 0.12, y + 0.72, s * 0.31, 0.042);
      addFlame(ctx, b, x + dx - 0.125, y + 0.74, s * 0.31, 'engine', 0.08, 0.3, 0.05, { rz: -Math.PI / 2 + 0.24 });
    }
  }
  add(b, rbox(0.44, 0.2, 0.32, 0.05), m.chrome, x, y + 0.5, 0);
  add(b, rbox(0.06, 0.26, 0.14, 0.02), m.black, x + 0.26, y + 0.42, 0);
  add(b, rbox(0.36, 0.2, 0.3, 0.08), ctx.paint, x + 0.02, y + 0.69, 0);
  add(b, rbox(0.03, 0.12, 0.22, 0.02), m.black, x + 0.2, y + 0.69, 0);
}

function buildJet(ctx: Ctx, x: number, y: number, len: number, pylonY: number, pylonX: number[]): void {
  const m = M();
  const b = ctx.body;
  const r = 0.3;
  const front = x + len / 2;
  const back = x - len / 2;
  add(b, cyl('x', r, r * 0.92, len - 0.3, 26), m.alu, x + 0.15, y, 0);
  add(b, cyl('x', r * 1.02, r * 1.02, 0.26, 26), ctx.paint, x + 0.1, y, 0);
  add(
    b,
    cached('jetring', () => new THREE.TorusGeometry(r + 0.01, 0.055, 10, 28).rotateY(Math.PI / 2)),
    m.chrome,
    front,
    y,
    0,
  );
  add(b, cyl('x', r - 0.03, r - 0.03, 0.02, 24), m.black, front - 0.04, y, 0);
  add(b, cyl('x', 0, 0.1, 0.16, 16), m.chrome, front - 0.02, y, 0);
  add(b, cyl('x', r * 0.92, r * 0.72, 0.32, 24), m.darkMetal, back + 0.16, y, 0);
  add(b, cyl('x', r * 0.62, r * 0.62, 0.02, 20), m.glow, back + 0.02, y, 0);
  addFlame(ctx, b, back, y, 0, 'engine', 0.35, 2.4, 0.2);
  for (const px of pylonX) {
    const h = y - r - pylonY;
    if (h > 0.02) add(b, rbox(0.34, h + 0.06, 0.08, 0.03), m.darkMetal, px, pylonY + h / 2, 0);
  }
}

// ---------------------------------------------------------------------------------------------
// Fuel tanks

function buildJerry(ctx: Ctx, x: number, y: number, z: number): void {
  const m = M();
  const b = ctx.body;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  b.add(g);
  add(g, rbox(0.3, 0.42, 0.14, 0.035), m.jerryRed, 0, 0.21, 0);
  for (const s of [1, -1]) {
    add(g, rbox(0.3, 0.03, 0.01, 0.005), m.jerryRed, 0, 0.21, s * 0.072, { rz: 0.95 });
    add(g, rbox(0.3, 0.03, 0.01, 0.005), m.jerryRed, 0, 0.21, s * 0.072, { rz: -0.95 });
  }
  add(g, rbox(0.14, 0.05, 0.08, 0.02), m.jerryRed, -0.05, 0.44, 0);
  add(g, cyl('y', 0.035, 0.035, 0.08, 10), m.black, 0.1, 0.45, 0);
  add(g, rbox(0.33, 0.035, 0.17, 0.01), m.black, 0, 0.12, 0);
}

function capsule(
  ctx: Ctx,
  axis: 'x' | 'z',
  x: number,
  y: number,
  z: number,
  len: number,
  r: number,
  mat: THREE.Material,
): void {
  const b = ctx.body;
  add(b, cyl(axis, r, r, len, 26), mat, x, y, z);
  const s = axis === 'x' ? { sx: 0.55 } : { sz: 0.55 };
  for (const e of [1, -1]) {
    const ox = axis === 'x' ? (e * len) / 2 : 0;
    const oz = axis === 'z' ? (e * len) / 2 : 0;
    add(b, sphere(r, 24, 14), mat, x + ox, y, z + oz, s);
  }
}

function buildStdTank(ctx: Ctx, t: Layout['tank']): void {
  const m = M();
  const r = 0.15;
  capsule(ctx, t.axis, t.x, t.y, t.z, t.len, r, m.alu);
  for (const e of [0.3, -0.3]) {
    const ox = t.axis === 'x' ? e * t.len : 0;
    const oz = t.axis === 'z' ? e * t.len : 0;
    add(ctx.body, cyl(t.axis, r + 0.012, r + 0.012, 0.05, 20), m.black, t.x + ox, t.y, t.z + oz);
  }
  add(ctx.body, cyl('y', 0.045, 0.045, 0.06, 12), m.chrome, t.x, t.y + r + 0.01, t.z);
}

function buildBigTank(ctx: Ctx, t: Layout['big']): void {
  const m = M();
  const b = ctx.body;
  capsule(ctx, 'z', t.x, t.y, t.z, t.len, t.r, m.propane);
  add(b, cyl('z', t.r + 0.008, t.r + 0.008, 0.12, 28), m.red, t.x, t.y, t.z);
  // Valve collar and hazard diamond.
  add(b, cyl('y', 0.13, 0.13, 0.1, 18), m.darkMetal, t.x, t.y + t.r + 0.02, t.z);
  add(b, cyl('y', 0.04, 0.04, 0.14, 10), m.chrome, t.x, t.y + t.r + 0.1, t.z);
  add(b, rbox(0.03, 0.2, 0.2, 0.01), m.red, t.x + t.r + 0.005, t.y, t.z + t.len * 0.26, { rx: Math.PI / 4 });
  add(b, rbox(0.03, 0.2, 0.2, 0.01), m.red, t.x - t.r - 0.005, t.y, t.z + t.len * 0.26, { rx: Math.PI / 4 });
  // Cradle.
  const h = t.y - t.r * 0.6 - t.baseY;
  if (h > 0.02) {
    for (const e of [0.32, -0.32]) {
      add(b, rbox(t.r * 1.3, h + 0.06, 0.08, 0.02), m.darkMetal, t.x, t.baseY + h / 2, t.z + e * t.len);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Wings, noses, boosters, toppers

function buildSpoiler(ctx: Ctx, s: Layout['spoiler'], baseY: number): void {
  const m = M();
  const b = ctx.body;
  add(b, rbox(0.36, 0.055, s.span, 0.022), m.carbon, s.x, s.y, 0, { rz: 0.1 });
  for (const e of [1, -1]) {
    add(b, rbox(0.42, 0.24, 0.035, 0.015), ctx.paint, s.x, s.y - 0.04, (e * s.span) / 2);
    const h = s.y - baseY;
    add(b, rbox(0.1, h, 0.045, 0.02), m.darkMetal, s.x - 0.02, baseY + h / 2, e * s.strutZ);
  }
}

function gliderGeo(rootZ: number): THREE.BufferGeometry {
  return cached(`glider:${k3(rootZ)}`, () => {
    const tipZ = 2.42;
    const rootC = 0.82;
    const tipC = 0.42;
    const sweep = 0.22;
    const s = new THREE.Shape();
    // Planform in (x = chord, y = span); extruded thickness becomes world y after rotation.
    s.moveTo(rootC / 2, rootZ - 0.05);
    s.lineTo(rootC / 2 - sweep, tipZ - 0.06);
    s.quadraticCurveTo(rootC / 2 - sweep - 0.02, tipZ, rootC / 2 - sweep - 0.1, tipZ);
    s.lineTo(rootC / 2 - sweep - tipC, tipZ);
    s.lineTo(-rootC / 2, rootZ - 0.05);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.018,
      bevelSegments: 2,
      curveSegments: 6,
    });
    g.rotateX(Math.PI / 2);
    g.translate(0, 0.02, 0);
    return g;
  });
}

function buildGlider(ctx: Ctx, gl: Layout['glider']): void {
  const m = M();
  const geo = gliderGeo(gl.rootZ);
  for (const e of [1, -1]) {
    // Each wing (and its strut) hangs off a hinge so it can fold back along the body.
    const pivot = new THREE.Group();
    pivot.position.set(gl.x, gl.y, 0);
    ctx.body.add(pivot);
    const b = pivot;
    const wing = add(b, geo, m.white, 0, 0, 0, { rx: -e * 0.08, sz: e });
    // Painted tip with a tall winglet so the wing still reads edge-on from the side camera.
    add(wing, rbox(0.46, 0.09, 0.1, 0.03), ctx.paint, -0.14, 0, 2.4);
    const winglet = add(wing, rbox(0.42, 0.42, 0.06, 0.03), ctx.paint, -0.2, 0.19, 2.44, { rz: 0.12 });
    ctx.wingPivots.push({ pivot, side: e, winglet });
    add(wing, rbox(0.62, 0.075, 0.12, 0.02), ctx.paint, -0.08, 0, 1.75);
    const le = Math.atan2(0.22, 2.42 - gl.rootZ);
    add(wing, rbox(0.1, 0.07, 2.42 - gl.rootZ, 0.03), ctx.paint, 0.36 - 0.11, 0, (2.42 + gl.rootZ) / 2 - 0.03, { ry: -le });
    if (gl.strutFromY !== undefined && gl.strutZ !== undefined) {
      add(b, rbox(0.08, gl.y - gl.strutFromY, 0.05, 0.02), m.darkMetal, 0, (gl.strutFromY - gl.y) / 2, e * gl.strutZ);
    }
  }
}

function wedgeGeo(h: number, w: number, len: number): THREE.BufferGeometry {
  return cached(`wedge:${k3(h)}:${k3(w)}:${k3(len)}`, () => {
    const s = new THREE.Shape();
    s.moveTo(0, h / 2);
    s.lineTo(len, -h / 2 + 0.06);
    s.lineTo(len - 0.02, -h / 2);
    s.lineTo(0, -h / 2);
    s.closePath();
    const bev = 0.025;
    const g = new THREE.ExtrudeGeometry(s, {
      depth: w - 2 * bev,
      bevelEnabled: true,
      bevelThickness: bev,
      bevelSize: bev,
      bevelSegments: 2,
    });
    g.translate(0, 0, -(w - 2 * bev) / 2);
    return g;
  });
}

function buildNose(ctx: Ctx, id: string, n: Layout['nose']): void {
  const m = M();
  const b = ctx.body;
  const h = Math.max(n.h, 0.36);
  const w = Math.max(n.w, 0.72);
  if (id === 'blunt') {
    add(b, rbox(0.08, h * 0.95, w * 0.95, 0.03), m.darkPlastic, n.x + 0.04, n.y, 0);
    for (const s of [1, -1]) {
      add(b, cyl('y', 0.035, 0.035, h * 1.02, 10), m.chrome, n.x + 0.16, n.y, s * w * 0.3);
      rod(b, m.chrome, n.x + 0.02, n.y - h * 0.3, s * w * 0.3, n.x + 0.16, n.y - h * 0.3, s * w * 0.3, 0.03);
    }
    add(b, cyl('z', 0.035, 0.035, w * 0.64, 10), m.chrome, n.x + 0.16, n.y + h * 0.48, 0);
    add(b, cyl('z', 0.035, 0.035, w * 0.64, 10), m.chrome, n.x + 0.16, n.y, 0);
  } else if (id === 'wedge') {
    const hw = h * 0.9;
    const len = 0.45 + hw * 0.5;
    add(b, wedgeGeo(hw, w, len), ctx.paint, n.x - 0.02, n.y - (h - hw) / 2, 0);
    add(b, cyl('z', 0.022, 0.022, w * 0.98, 10), m.chrome, n.x + len - 0.03, n.y - h / 2 + 0.05, 0);
  } else {
    const rb = Math.min(h, w) * 0.52;
    const len = 0.75 + rb * 1.3;
    add(b, cyl('x', 0.0, rb, len, 24), ctx.paint, n.x + len / 2, n.y, 0);
    add(b, cyl('x', rb + 0.03, rb + 0.03, 0.06, 24), m.chrome, n.x + 0.03, n.y, 0);
    add(b, cyl('x', 0, 0.07, 0.16, 12), m.chrome, n.x + len - 0.02, n.y, 0);
  }
}

function buildNitro(ctx: Ctx, n: Layout['nitro']): void {
  const m = M();
  const b = ctx.body;
  for (const s of [1, -1]) {
    const z = s * n.z;
    add(b, cyl('x', 0.1, 0.1, n.len, 20), m.nitroBlue, n.x, n.y, z);
    add(b, sphere(0.1, 18, 12), m.nitroBlue, n.x + n.len / 2, n.y, z, { sx: 0.7 });
    add(b, cyl('x', 0.103, 0.103, 0.1, 20), m.white, n.x + n.len * 0.12, n.y, z);
    add(b, cyl('y', 0.025, 0.025, 0.08, 10), m.chrome, n.x + n.len / 2 - 0.02, n.y + 0.1, z);
    add(b, rbox(0.06, 0.03, 0.06, 0.012), m.red, n.x + n.len / 2 - 0.02, n.y + 0.145, z);
    add(b, cyl('x', 0.05, 0.075, 0.1, 14), m.chrome, n.x - n.len / 2 - 0.04, n.y, z);
    addFlame(ctx, b, n.x - n.len / 2 - 0.09, n.y, z, 'nitro', 0.2, 1.8, 0.1);
  }
}

interface KiteRig {
  packed: THREE.Object3D;
  open: THREE.Group;
  lines: THREE.LineSegments;
  linePos: THREE.BufferAttribute;
  mastTop: THREE.Vector3;
  bridle: THREE.Vector3[];
  tail: THREE.Object3D[];
  base: THREE.Vector3;
}

function kiteGeo(): THREE.BufferGeometry {
  return cached('kitesail', () => {
    // Delta kite in the yz plane: nose at +y, wingtips at +-z, facing +-x.
    const nose = [0, 1.35, 0];
    const lt = [0, -0.75, -1.75];
    const rt = [0, -0.75, 1.75];
    const notch = [0, -0.45, 0];
    const midL = [0, 0.3, -0.85];
    const midR = [0, 0.3, 0.85];
    const tris = [
      [nose, midL, notch],
      [midL, lt, notch],
      [nose, notch, midR],
      [midR, notch, rt],
    ];
    const cols = [
      [1, 1, 1],
      [1, 0.82, 0.1],
      [1, 1, 1],
      [1, 0.82, 0.1],
    ];
    const pos: number[] = [];
    const col: number[] = [];
    tris.forEach((t, i) => {
      for (const v of t) {
        pos.push(v[0], v[1], v[2]);
        col.push(cols[i][0], cols[i][1], cols[i][2]);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  });
}

function buildKite(ctx: Ctx, k: Layout['kite']): KiteRig {
  const m = M();
  const b = ctx.body;
  add(b, cyl('y', 0.025, 0.025, k.topY - k.baseY, 8), m.darkMetal, k.x, (k.topY + k.baseY) / 2, k.z);
  const packed = new THREE.Group();
  packed.position.set(k.x, k.topY - 0.14, k.z);
  add(packed, cyl('z', 0.1, 0.1, 0.6, 16), ctx.accent);
  add(packed, cyl('z', 0.105, 0.105, 0.05, 16), m.black, 0, 0, 0.16);
  add(packed, cyl('z', 0.105, 0.105, 0.05, 16), m.black, 0, 0, -0.16);
  add(packed, sphere(0.1, 12, 8), m.kiteYellow, 0, 0, 0.3, { sz: 0.4 });
  add(packed, sphere(0.1, 12, 8), m.kiteYellow, 0, 0, -0.3, { sz: 0.4 });
  b.add(packed);

  const open = new THREE.Group();
  const base = new THREE.Vector3(k.x - 3.0, k.topY + 1.7, 0);
  open.position.copy(base);
  open.rotation.z = 0.65;
  add(open, kiteGeo(), m.kiteFabric);
  // Accent-coloured leading edges, spine and spar.
  rod(open, ctx.accent, 0, 1.35, 0, 0, -0.75, -1.75, 0.035);
  rod(open, ctx.accent, 0, 1.35, 0, 0, -0.75, 1.75, 0.035);
  rod(open, m.darkMetal, 0.02, 1.3, 0, 0.02, -0.45, 0, 0.02);
  rod(open, m.darkMetal, 0.02, 0.3, -0.85, 0.02, 0.3, 0.85, 0.02);
  const tail: THREE.Object3D[] = [];
  let parent: THREE.Object3D = open;
  let py = -0.45;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, py, 0);
    parent.add(seg);
    add(seg, rbox(0.03, 0.12, 0.26, 0.02), i % 2 ? ctx.accent : m.kiteYellow, 0, -0.3, 0);
    rod(seg, m.darkPlastic, 0, 0, 0, 0, -0.34, 0, 0.008);
    tail.push(seg);
    parent = seg;
    py = -0.34;
  }
  open.visible = false;
  b.add(open);

  const linePos = new THREE.BufferAttribute(new Float32Array(12), 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', linePos);
  const lines = new THREE.LineSegments(lineGeo, m.line);
  lines.visible = false;
  lines.frustumCulled = false;
  b.add(lines);
  ctx.fx.add(open);
  ctx.fx.add(lines);
  ctx.disposables.push(lineGeo);
  return {
    packed,
    open,
    lines,
    linePos,
    mastTop: new THREE.Vector3(k.x, k.topY, k.z),
    bridle: [new THREE.Vector3(0, 0.3, -0.85), new THREE.Vector3(0, 0.3, 0.85)],
    tail,
    base,
  };
}

interface FlagRig {
  geo: THREE.BufferGeometry;
  base: Float32Array;
}

function buildTopper(ctx: Ctx, id: string, x: number, y: number): FlagRig | null {
  const m = M();
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  ctx.body.add(g);
  if (id === 'tophat') {
    add(g, cyl('y', 0.3, 0.3, 0.035, 28), m.black, 0, 0.018, 0);
    add(g, cyl('y', 0.2, 0.19, 0.46, 28), m.black, 0, 0.26, 0);
    add(g, cyl('y', 0.198, 0.198, 0.08, 28), m.red, 0, 0.09, 0);
  } else if (id === 'duck') {
    add(g, sphere(0.28, 22, 14), m.duck, 0, 0.2, 0, { sx: 1.3, sy: 0.8, sz: 1.0 });
    add(g, cyl('y', 0.0, 0.12, 0.18, 12), m.duck, -0.3, 0.3, 0, { rz: 0.9 });
    add(g, sphere(0.17, 18, 12), m.duck, 0.17, 0.5, 0);
    add(g, sphere(0.1, 14, 8), m.beak, 0.33, 0.46, 0, { sx: 1.1, sy: 0.38, sz: 0.9 });
    for (const s of [1, -1]) add(g, sphere(0.03, 8, 6), m.eye, 0.28, 0.56, s * 0.08);
  } else if (id === 'cone') {
    add(g, rbox(0.52, 0.05, 0.52, 0.02), m.black, 0, 0.025, 0);
    add(g, cyl('y', 0.035, 0.23, 0.62, 24), m.orange, 0, 0.36, 0);
    add(g, cyl('y', 0.155, 0.175, 0.08, 24), m.white, 0, 0.26, 0);
    add(g, cyl('y', 0.095, 0.115, 0.07, 24), m.white, 0, 0.46, 0);
  } else if (id === 'flag') {
    add(g, cyl('y', 0.02, 0.02, 1.25, 8), m.chrome, 0, 0.625, 0);
    add(g, sphere(0.045, 10, 8), m.gold, 0, 1.27, 0);
    const geo = new THREE.PlaneGeometry(0.78, 0.5, 12, 6);
    geo.translate(-0.39, 0, 0);
    const flag = add(g, geo, flagMat(ctx.accentHex), 0, 1.0, 0);
    add(flag, rbox(0.78, 0.07, 0.012, 0.005), m.white, -0.39, 0, 0);
    ctx.disposables.push(geo);
    return { geo, base: Float32Array.from(geo.getAttribute('position').array as Float32Array) };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------

const _box = new THREE.Box3();

/** Highest point of the car inside a small vertical column (body frame), ignoring effects. */
function columnTop(ctx: Ctx, x: number, halfSize: number): number {
  ctx.root.updateMatrixWorld(true);
  let top = -Infinity;
  ctx.body.traverse((o) => {
    if (ctx.fx.has(o)) return;
    for (let p: THREE.Object3D | null = o.parent; p; p = p.parent) if (ctx.fx.has(p)) return;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry.boundingBox) return;
    _box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    if (_box.max.x < x - halfSize || _box.min.x > x + halfSize) return;
    if (_box.max.z < -halfSize || _box.min.z > halfSize) return;
    top = Math.max(top, _box.max.y);
  });
  return top - ctx.body.position.y;
}

export function buildCarMesh(config: CarConfig, opts: { accent?: string } = {}): CarMesh {
  const chassisId = getOption('chassis', config.chassis).id;
  const wheelId = getOption('wheels', config.wheels).id;
  const engineId = getOption('engine', config.engine).id;
  const fuelId = getOption('fuel', config.fuel).id;
  const wingId = getOption('wing', config.wing).id;
  const noseId = getOption('nose', config.nose).id;
  const boosterId = getOption('booster', config.booster).id;
  const topperId = getOption('topper', config.topper).id;
  const paintHex = getOption('paint', config.paint).color ?? '#e8322a';
  const accentHex = opts.accent ?? '#ff5a36';

  const wt = WHEEL_TYPES[wheelId] ?? WHEEL_TYPES.standard;
  const root = new THREE.Group();
  root.name = 'car';
  const body = new THREE.Group();
  body.position.y = wt.r;
  root.add(body);

  const baseWb: Record<string, number> = { kart: 1.3, tub: 1.4, sedan: 2.6, pickup: 3.1 };
  const wb = Math.max(baseWb[chassisId] ?? 2.6, 2 * wt.r + 0.3);
  // Wheel centre z: outside the frame for kart/tub, tucked slightly under the body for sedan/pickup.
  const halfTrackBase: Record<string, number> = { kart: 0.58, tub: 0.72, sedan: 0.8, pickup: 0.9 };
  const halfTrack = (halfTrackBase[chassisId] ?? 0.8) + wt.w / 2;

  const ctx: Ctx = {
    root,
    body,
    paint: paintMat(paintHex),
    accentHex,
    accent: accentMat(accentHex),
    r: wt.r,
    wheelW: wt.w,
    wb,
    halfTrack,
    hasJet: engineId === 'jet',
    flames: [],
    fx: new Set(),
    disposables: [],
    wheelSpins: [],
    wingPivots: [],
  };

  let L: Layout;
  if (chassisId === 'kart') L = buildKart(ctx);
  else if (chassisId === 'tub') L = buildTub(ctx, fuelId);
  else if (chassisId === 'pickup') L = buildPickup(ctx);
  else L = buildSedan(ctx);

  for (const x of [wb / 2, -wb / 2]) for (const s of [1, -1]) buildWheel(ctx, wheelId, x, s * halfTrack);

  if (engineId === 'mower') buildMower(ctx, L.engine.x, L.engine.y);
  else if (engineId === 'v8') buildV8(ctx, L.engine.x, L.engine.y);
  else buildJet(ctx, L.jet.x, L.jet.y, L.jet.len, L.jet.pylonY, L.jet.pylonX);

  let trunkTop = L.spoiler.baseY;
  if (fuelId === 'jerry') buildJerry(ctx, L.jerry.x, L.jerry.y, L.jerry.z);
  else if (fuelId === 'tank') {
    buildStdTank(ctx, L.tank);
    if (L.tank.axis === 'z' && Math.abs(L.tank.x - L.spoiler.x) < 0.5) trunkTop = L.tank.y + 0.15;
  } else {
    buildBigTank(ctx, L.big);
    if (Math.abs(L.big.x - L.spoiler.x) < L.big.r + 0.2) trunkTop = L.big.y + L.big.r;
  }

  if (wingId === 'spoiler') {
    const sp = { ...L.spoiler, y: Math.max(L.spoiler.y, trunkTop + 0.18) };
    buildSpoiler(ctx, sp, trunkTop);
  } else if (wingId === 'glider') {
    buildGlider(ctx, L.glider);
  }

  const noseX = fuelId === 'big' && L.noseWithBig !== undefined ? L.noseWithBig : L.nose.x;
  buildNose(ctx, noseId, { ...L.nose, x: noseX });

  let kite: KiteRig | null = null;
  if (boosterId === 'nitro') buildNitro(ctx, L.nitro);
  else if (boosterId === 'kite') kite = buildKite(ctx, L.kite);

  let flag: FlagRig | null = null;
  if (topperId !== 'none') {
    const y = columnTop(ctx, L.topperX, 0.12);
    flag = buildTopper(ctx, topperId, L.topperX, Number.isFinite(y) ? y - 0.01 : 1);
  }

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    let isFx = false;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (ctx.fx.has(p)) isFx = true;
    if (isFx && !(kite && isDescendant(o, kite.open))) return;
    mesh.castShadow = true;
    mesh.receiveShadow = !isFx;
  });

  // ------------------------------------------------------------------------------------------
  let throttle = 0;
  let nitro = 0;
  let kiteOpen = false;
  let disposed = false;
  const tmp = new THREE.Vector3();

  const applyFlames = (flicker: boolean): void => {
    for (const f of ctx.flames) {
      const level = f.kind === 'nitro' ? nitro : throttle;
      if (level < 0.02) {
        f.obj.visible = false;
        continue;
      }
      f.obj.visible = true;
      const jitter = flicker ? 0.82 + Math.random() * 0.36 : 1;
      const len = (f.baseLen + f.gainLen * level) * jitter;
      const w = f.width * (0.65 + 0.35 * level) * (flicker ? 0.92 + Math.random() * 0.16 : 1);
      f.obj.scale.set(len, w, w);
    }
  };

  const updateKiteLines = (): void => {
    if (!kite) return;
    kite.open.updateMatrix();
    const a = kite.linePos.array as Float32Array;
    for (let i = 0; i < 2; i++) {
      tmp.copy(kite.bridle[i]).applyMatrix4(kite.open.matrix);
      a[i * 6] = kite.mastTop.x;
      a[i * 6 + 1] = kite.mastTop.y;
      a[i * 6 + 2] = kite.mastTop.z;
      a[i * 6 + 3] = tmp.x;
      a[i * 6 + 4] = tmp.y;
      a[i * 6 + 5] = tmp.z;
    }
    kite.linePos.needsUpdate = true;
  };

  // Wing hinge: 0 = folded back, 1 = spread. A springy approach gives the unfold a little pop.
  // Folded, the wings also telescope in (so the tips stay over the body, not trailing off the
  // back) and the upright tip plates tuck away.
  const WING_FOLD = 1.42;
  let wingTarget = 1;
  let wingPos = 1;
  let wingVel = 0;
  const applyWings = (): void => {
    const span = 0.55 + 0.45 * THREE.MathUtils.clamp(wingPos, 0, 1.2);
    for (const w of ctx.wingPivots) {
      w.pivot.rotation.y = -w.side * WING_FOLD * (1 - wingPos);
      w.pivot.scale.set(1, 1, span);
      w.winglet.visible = wingPos > 0.55;
    }
  };

  return {
    group: root,
    wheelRadius: wt.r,
    setWingsOpen(open: boolean, instant = false): void {
      wingTarget = open ? 1 : 0;
      if (instant) {
        wingPos = wingTarget;
        wingVel = 0;
        applyWings();
      }
    },
    setWheelRotation(angle: number): void {
      for (const w of ctx.wheelSpins) w.rotation.z = -angle;
    },
    setKiteOpen(open: boolean): void {
      if (!kite) return;
      kiteOpen = open;
      kite.packed.visible = !open;
      kite.open.visible = open;
      kite.lines.visible = open;
      if (open) updateKiteLines();
    },
    setThrottle(level: number): void {
      throttle = THREE.MathUtils.clamp(level, 0, 1);
      applyFlames(false);
    },
    setNitro(level: number): void {
      nitro = THREE.MathUtils.clamp(level, 0, 1);
      applyFlames(false);
    },
    update(dt: number, t: number): void {
      if (disposed) return;
      applyFlames(true);
      if (ctx.wingPivots.length && (wingPos !== wingTarget || wingVel !== 0)) {
        const h = Math.min(dt, 1 / 30);
        wingVel += (180 * (wingTarget - wingPos) - 16 * wingVel) * h;
        wingPos += wingVel * h;
        if (Math.abs(wingTarget - wingPos) < 1e-3 && Math.abs(wingVel) < 1e-2) {
          wingPos = wingTarget;
          wingVel = 0;
        }
        applyWings();
      }
      if (flag) {
        const pos = flag.geo.getAttribute('position') as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        for (let i = 0; i < arr.length; i += 3) {
          const u = -flag.base[i] / 0.78;
          arr[i + 2] = Math.sin(u * 7 - t * 9) * 0.07 * u + Math.sin(u * 3 - t * 5) * 0.03 * u;
          arr[i + 1] = flag.base[i + 1] - u * u * 0.04;
        }
        pos.needsUpdate = true;
        flag.geo.computeVertexNormals();
      }
      if (kite && kiteOpen) {
        kite.open.position.set(kite.base.x, kite.base.y + Math.sin(t * 0.9) * 0.2, kite.base.z + Math.sin(t * 0.6) * 0.25);
        kite.open.rotation.set(Math.sin(t * 1.3) * 0.12, 0, 0.65 + Math.sin(t * 1.1) * 0.06);
        kite.tail.forEach((seg, i) => {
          seg.rotation.x = Math.sin(t * 3 - i * 0.7) * 0.25;
          seg.rotation.z = 0.25 + Math.sin(t * 2.2 - i * 0.5) * 0.1;
        });
        updateKiteLines();
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      for (const d of ctx.disposables) d.dispose();
    },
  };
}

function isDescendant(o: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === ancestor) return true;
  return false;
}

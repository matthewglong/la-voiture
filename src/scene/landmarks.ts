// Background landmarks: the Golden Gate Bridge, Alcatraz, the Marin Headlands and hills around the
// Bay, sailboats, and the sea lions lounging on a float by the pier. All procedural; static pieces are
// merged per material so the whole set costs only a couple of dozen draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, makeRng, paintGeometry, setShadows, smoothstep } from './util';

export interface Landmarks {
  group: THREE.Group;
  update(dt: number, t: number): void;
}

// ---------------------------------------------------------------------------------------------
// Layout (metres; x = down the hill / out over the Bay, y = up, z = right looking along +x)

const BRIDGE_Z = -1000;
const TOWER_X = [-60, 900] as const;
const MID_X = (TOWER_X[0] + TOWER_X[1]) / 2;
const HALF_SPAN = (TOWER_X[1] - TOWER_X[0]) / 2;
const ANCHOR_X = [-320, 1160] as const;
const ANCHOR_Y = 44;
const DECK_Y = 50;
const DECK_X = [-600, 1330] as const;
const LEG_Z = 14;
const TRUSS_Z = 10.8;
const CABLE_Z = 11.2;
const CABLE_R = 1.5;
const SADDLE_Y = 168;
const CABLE_LOW_Y = 56;

const ALCATRAZ = { x: 1000, z: -200 };
const DOCK = { x: 274, z: 16.5, top: 0.36 };

/** Fraction of the scene fog applied to the bridge's orange steel. */
const BRIDGE_FOG = 0.5;
const ORANGE = 0xb83616;
const ORANGE_DEEP = 0x9a2c10;
const CONCRETE = 0xbdb6a8;
const ROAD = 0x3b3d42;

// ---------------------------------------------------------------------------------------------
// Geometry batching

const KEEP_ATTRS = new Set(['position', 'normal', 'uv', 'color']);
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Translation, Euler rotation (XYZ) and scale as one matrix. */
function tf(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

/** Collects transformed, vertex-coloured pieces and merges them into a single mesh. */
class Batch {
  private parts: THREE.BufferGeometry[] = [];

  /** Add a piece painted one colour. */
  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, matrix?: THREE.Matrix4): void {
    const g = this.prepare(geo, matrix);
    paintGeometry(g, color);
    this.parts.push(g);
  }

  /** Add a piece that already carries a colour attribute. */
  addColored(geo: THREE.BufferGeometry, matrix?: THREE.Matrix4): void {
    this.parts.push(this.prepare(geo, matrix));
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, ry = 0): void {
    this.add(new THREE.BoxGeometry(w, h, d), color, tf(x, y, z, 0, ry, 0));
  }

  private prepare(geo: THREE.BufferGeometry, matrix?: THREE.Matrix4): THREE.BufferGeometry {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (matrix) g.applyMatrix4(matrix);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (!g.getAttribute('uv')) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    }
    for (const name of Object.keys(g.attributes)) if (!KEEP_ATTRS.has(name)) g.deleteAttribute(name);
    g.clearGroups();
    return g;
  }

  build(material: THREE.Material, name: string): THREE.Mesh {
    const merged = mergeGeometries(this.parts, false);
    if (!merged) throw new Error(`landmarks: could not merge ${name}`);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name;
    return mesh;
  }
}

/**
 * Scale how strongly the scene fog tints a material. Fog is mixed in after tone mapping, so at a
 * kilometre even pure orange turns salmon; the hero landmark keeps some haze but stays vivid.
 */
function scaleFog<T extends THREE.Material>(mat: T, scale: number): T {
  const chunk = THREE.ShaderChunk.fog_fragment.replace('fogColor, fogFactor )', `fogColor, fogFactor * ${scale.toFixed(3)} )`);
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', chunk);
  };
  mat.customProgramCacheKey = () => `fog-scale-${scale}`;
  return mat;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth pseudo-noise in about [-1, 1] from a few incommensurate sine waves. */
function wave(x: number, z: number, seed: number): number {
  return (
    (Math.sin(x * 0.0123 + seed) * Math.cos(z * 0.0157 - seed * 0.7) +
      0.5 * Math.sin(x * 0.031 + z * 0.023 + seed * 1.3) +
      0.25 * Math.sin(x * 0.067 - z * 0.059 + seed * 2.1)) /
    1.75
  );
}

/** The two low-frequency terms of wave(): rolling rather than spiky. */
function roll(x: number, z: number, seed: number): number {
  return (Math.sin(x * 0.0123 + seed) * Math.cos(z * 0.0157 - seed * 0.7) + 0.5 * Math.sin(x * 0.029 + z * 0.021 + seed * 1.3)) / 1.5;
}

/** A heightfield grid over [x0,x1]×[z0,z1] with per-vertex colours from its height and slope. */
function heightfield(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  nx: number,
  nz: number,
  height: (x: number, z: number) => number,
  color: (x: number, z: number, h: number, flat: number, out: THREE.Color) => void,
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nrm = geo.getAttribute('normal');
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    color(pos.getX(i), pos.getZ(i), pos.getY(i), nrm.getY(i), c);
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}

/** Colour each triangle of a non-indexed geometry: tops from one palette, walls from another. */
function colorFacets(
  geo: THREE.BufferGeometry,
  rng: () => number,
  top: number[],
  wall: number[],
  topThreshold = 0.6,
): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.computeVertexNormals();
  const nrm = g.getAttribute('normal');
  const pos = g.getAttribute('position');
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const ny = (nrm.getY(i) + nrm.getY(i + 1) + nrm.getY(i + 2)) / 3;
    const pal = ny > topThreshold ? top : wall;
    c.set(pal[Math.floor(rng() * pal.length)]);
    c.multiplyScalar(0.9 + rng() * 0.18);
    for (let k = 0; k < 3; k++) {
      cols[(i + k) * 3] = c.r;
      cols[(i + k) * 3 + 1] = c.g;
      cols[(i + k) * 3 + 2] = c.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

/** A box oriented from point a to point b (its local z runs along a→b). */
function beam(batch: Batch, a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, color: THREE.ColorRepresentation): void {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.BoxGeometry(w, h, len);
  // lookAt aligns the box's z axis with the a-b line (sign is irrelevant for a symmetric box).
  const m = new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0));
  m.setPosition(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5));
  batch.add(geo, color, m);
}

// ---------------------------------------------------------------------------------------------
// Terrain around the Bay

function presidioHeight(x0: number, z0: number): number {
  // Wiggle the coordinates a little so the shorelines aren't ruler-straight.
  const x = x0 + 18 * roll(0, z0 * 1.9, 4.1);
  const z = z0 + 26 * roll(x0 * 1.7, 0, 2.6);
  let p = -8 + 12.5 * smoothstep(-286, -312, x); // beach up to the Fort Point shelf
  p += 53 * smoothstep(-478, -585, x); // Presidio bluff
  p += 14 * smoothstep(-585, -720, x) + 5 * wave(x, z, 1.7) * smoothstep(-500, -620, x);
  const fz = smoothstep(-790, -880, z) * smoothstep(-1470, -1380, z);
  const fx = smoothstep(-900, -860, x);
  return lerp(-8, p, fz * fx);
}

function marinHeight(x0: number, z0: number): number {
  // Keep the shore at the bridge's north end fixed; wiggle it elsewhere.
  const nearBridge = 1 - smoothstep(60, 220, Math.abs(z0 - BRIDGE_Z));
  const x = x0 + (1 - nearBridge) * 40 * roll(0, z0 * 1.4, 7.7);
  const z = z0 + 30 * roll(x0 * 1.5, 0, 1.9);
  let p = -10 + 12 * smoothstep(1028, 1062, x); // shoreline
  p += 48 * smoothstep(1060, 1250, x); // slope up to deck level at the north approach
  p += 150 * smoothstep(1230, 1660, x); // the headlands
  p += 46 * roll(x, z, 3.1) * smoothstep(1300, 1720, x);
  p += 30 * Math.sin(z * 0.0042 + 0.8) * smoothstep(1250, 1620, x);
  p = lerp(p, -10, smoothstep(2450, 2720, x));
  const fz = smoothstep(-420, -580, z) * smoothstep(-2380, -2180, z);
  return lerp(-10, p, fz);
}

function angelHeight(x: number, z: number): number {
  const hump = (cx: number, cz: number, rx: number, rz: number, h: number): number => {
    const dx = (x - cx) / rx;
    const dz = (z - cz) / rz;
    const r2 = dx * dx + dz * dz;
    return r2 < 1 ? h * Math.pow(1 - r2, 1.6) : 0;
  };
  const main = hump(1960, 250, 360, 300, 150) * (1 + 0.22 * roll(x * 1.6, z * 1.6, 6.2));
  const shoulder = hump(2170, 90, 250, 200, 80) + hump(1800, 420, 200, 170, 55);
  return Math.max(main, shoulder) + 0.35 * Math.min(main, shoulder) - 12;
}

function eastBayHeight(x: number, z: number): number {
  const rise = smoothstep(3330, 3950, x);
  return -12 + 372 * rise * (0.72 + 0.28 * wave(x * 0.6, z * 0.6, 5.3));
}

function landColor(slopeLimit: number) {
  const sand = new THREE.Color(0x9a8f78);
  const cliff = new THREE.Color(0xa38a66);
  const gold = new THREE.Color(0xc8a55a);
  const green = new THREE.Color(0x7f9453);
  const scrub = new THREE.Color(0x5d7442);
  return (x: number, z: number, h: number, flat: number, out: THREE.Color): void => {
    if (h < 2.5) {
      out.copy(sand);
      return;
    }
    const mix = 0.5 + 0.5 * wave(x * 1.7, z * 1.7, 9.1);
    out.copy(gold).lerp(green, smoothstep(0.35, 0.75, mix));
    if (wave(x * 2.3, z * 2.1, 4.4) < -0.45) out.lerp(scrub, 0.7);
    if (flat < slopeLimit) out.lerp(cliff, smoothstep(slopeLimit, slopeLimit - 0.2, flat));
  };
}

function buildTerrain(): THREE.Mesh {
  const land = new Batch();
  const rng = makeRng(415);

  // Presidio / Fort Point: the south end of the bridge.
  const presidioPalette = landColor(0.78);
  const forest = new THREE.Color(0x4b673a);
  land.addColored(
    heightfield(-900, -268, -1480, -780, 56, 60, presidioHeight, (x, z, h, flat, out) => {
      presidioPalette(x, z, h, flat, out);
      if (h > 40 && flat > 0.8) out.lerp(forest, 0.55 + 0.25 * wave(x * 3, z * 3, 2.2));
      if (h > 2.5 && h < 7 && flat > 0.9) out.set(0x9ca36e); // lawn on the shelf
    }),
  );
  // Presidio trees: chunky toy cypress cones and round canopies.
  for (let i = 0; i < 70; i++) {
    const x = -600 - rng() * 280;
    const z = -1360 + rng() * 480;
    const h = presidioHeight(x, z);
    if (h < 45) continue;
    const s = 9 + rng() * 9;
    const col = new THREE.Color(0x3f5a33).multiplyScalar(0.85 + rng() * 0.35);
    if (rng() < 0.55) land.add(new THREE.ConeGeometry(s * 0.42, s * 1.5, 7), col, tf(x, h + s * 0.7, z));
    else land.add(new THREE.IcosahedronGeometry(s * 0.6, 0), col, tf(x, h + s * 0.45, z, rng(), rng(), 0, 1, 0.75, 1));
  }

  // Marin Headlands: golden hills north of the bridge.
  land.addColored(heightfield(980, 2720, -2400, -400, 80, 84, marinHeight, landColor(0.72)));
  // Angel Island.
  land.addColored(heightfield(1540, 2460, -170, 680, 40, 36, angelHeight, landColor(0.7)));
  // East Bay hills far off, mostly a silhouette in the fog.
  land.addColored(
    heightfield(3300, 4700, -3200, 5200, 22, 70, eastBayHeight, (x, z, h, _flat, out) => {
      out.set(0x7c8a64).lerp(new THREE.Color(0x9a9a72), 0.5 + 0.5 * wave(x, z, 8));
      if (h < 2) out.set(0x8a8272);
    }),
  );

  const mesh = land.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }), 'bay-hills');
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  return mesh;
}

// ---------------------------------------------------------------------------------------------
// Golden Gate Bridge

/** Catenary parameter a for a symmetric span of half-length L that sags by `sag`. */
function catenaryParam(halfSpan: number, sag: number): number {
  let lo = 1;
  let hi = 1e6;
  for (let i = 0; i < 200; i++) {
    const a = 0.5 * (lo + hi);
    if (a * (Math.cosh(halfSpan / a) - 1) > sag) lo = a;
    else hi = a;
  }
  return 0.5 * (lo + hi);
}

/** The catenary with parameter a passing through (x1, y1) and (x2, y2), as y(x). */
function catenaryThrough(x1: number, y1: number, x2: number, y2: number, a: number): (x: number) => number {
  const g = (x0: number): number => a * Math.cosh((x2 - x0) / a) - a * Math.cosh((x1 - x0) / a) - (y2 - y1);
  let lo = Math.min(x1, x2) - 6 * a;
  let hi = Math.max(x1, x2) + 6 * a;
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    if (g(mid) > 0 === x2 > x1) lo = mid;
    else hi = mid;
  }
  const x0 = 0.5 * (lo + hi);
  const c = y1 - a * Math.cosh((x1 - x0) / a);
  return (x: number) => a * Math.cosh((x - x0) / a) + c;
}

function addTower(orange: Batch, concrete: Batch, xt: number): void {
  const zc = BRIDGE_Z;
  // Legs step in at each portal, Art Deco style.
  const sections = [
    { y0: 6, y1: 52, wx: 11, wz: 6.2 },
    { y0: 52, y1: 84, wx: 10, wz: 5.9 },
    { y0: 84, y1: 114, wx: 9.1, wz: 5.6 },
    { y0: 114, y1: 142, wx: 8.3, wz: 5.3 },
    { y0: 142, y1: 166, wx: 7.6, wz: 5.0 },
  ];
  for (const side of [-1, 1]) {
    const zl = zc + side * LEG_Z;
    sections.forEach((s, i) => {
      const h = s.y1 - s.y0;
      const yc = (s.y0 + s.y1) / 2;
      orange.box(s.wx, h, s.wz, xt, yc, zl, ORANGE);
      if (i > 0) orange.box(s.wx + 1.7, 1.5, s.wz + 1.3, xt, s.y0 + 0.75, zl, ORANGE_DEEP);
      // Vertical fluting on the broad faces.
      for (const k of [-1, 1]) {
        for (const f of [-0.22, 0.22]) orange.box(1.0, h - 2.2, 1.1, xt + k * (s.wx / 2 + 0.3), yc, zl + f * s.wz, ORANGE_DEEP);
      }
      orange.box(s.wx * 0.46, h - 2.2, 0.8, xt, yc, zl + side * (s.wz / 2 + 0.25), ORANGE_DEEP);
    });
    // Cable saddle housing crowning each leg.
    orange.box(8.8, 3.8, 6.2, xt, 167.9, zl, ORANGE);
    orange.box(6.6, 1.4, 4.8, xt, 170.5, zl, ORANGE_DEEP);
  }
  // Portal struts above the deck, each with vertical ribs.
  for (const p of [
    { y: 65, h: 8.5 },
    { y: 98, h: 8.5 },
    { y: 128, h: 8 },
    { y: 155, h: 7.5 },
  ]) {
    orange.box(5.6, p.h, 2 * LEG_Z - 2, xt, p.y, zc, ORANGE);
    for (let k = -3; k <= 3; k++) orange.box(6.3, p.h - 1.8, 1.1, xt, p.y, zc + k * 3.3, ORANGE_DEEP);
  }
  // Below the deck: a strut and an X brace.
  orange.box(6.2, 4.2, 2 * LEG_Z - 2, xt, 42.4, zc, ORANGE);
  const y0 = 9;
  const y1 = 40;
  for (const s of [-1, 1]) {
    beam(
      orange,
      new THREE.Vector3(xt, y0, zc - s * (LEG_Z - 2)),
      new THREE.Vector3(xt, y1, zc + s * (LEG_Z - 2)),
      3.6,
      2.4,
      ORANGE_DEEP,
    );
  }
  // Elliptical concrete fender at the waterline.
  concrete.add(new THREE.CylinderGeometry(1, 1, 11, 32), CONCRETE, tf(xt, 0.5, zc, 0, 0, 0, 11.5, 1, 24.5));
  concrete.add(new THREE.CylinderGeometry(1, 1, 1.2, 32), 0x9e978a, tf(xt, 6.4, zc, 0, 0, 0, 12.2, 1, 25.2));
}

function buildBridge(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'golden-gate-bridge';
  const orange = new Batch();
  const concrete = new Batch();
  const zc = BRIDGE_Z;

  for (const xt of TOWER_X) addTower(orange, concrete, xt);

  // Deck: roadway slab between two stiffening trusses.
  const deckLen = DECK_X[1] - DECK_X[0];
  const deckCx = (DECK_X[0] + DECK_X[1]) / 2;
  concrete.box(deckLen, 1.2, 2 * TRUSS_Z, deckCx, DECK_Y - 0.6, zc, ROAD);
  for (const side of [-1, 1]) {
    const zt = zc + side * TRUSS_Z;
    orange.box(deckLen, 5.2, 0.6, deckCx, DECK_Y - 3.4, zt, ORANGE_DEEP);
    orange.box(deckLen, 1.0, 1.3, deckCx, DECK_Y - 6.2, zt, ORANGE);
    orange.box(deckLen, 1.0, 1.3, deckCx, DECK_Y - 0.6, zt, ORANGE);
    orange.box(deckLen, 1.1, 0.35, deckCx, DECK_Y + 1.0, zc + side * (TRUSS_Z - 0.6), ORANGE);
    // Truss posts and diagonals.
    for (let x = DECK_X[0] + 3; x < DECK_X[1]; x += 7.6) {
      orange.box(0.8, 5.4, 1.4, x, DECK_Y - 3.4, zt, ORANGE);
      beam(
        orange,
        new THREE.Vector3(x, DECK_Y - 6.0, zt + side * 0.35),
        new THREE.Vector3(x + 3.8, DECK_Y - 0.8, zt + side * 0.35),
        0.5,
        0.6,
        ORANGE,
      );
      beam(
        orange,
        new THREE.Vector3(x + 3.8, DECK_Y - 0.8, zt + side * 0.35),
        new THREE.Vector3(x + 7.6, DECK_Y - 6.0, zt + side * 0.35),
        0.5,
        0.6,
        ORANGE,
      );
    }
  }
  // A few toy cars crossing the bridge.
  const rng = makeRng(1937);
  const carCols = [0xffffff, 0x2f63ea, 0xffc81f, 0x222222, 0xe8322a, 0x14b8b0];
  for (let i = 0; i < 26; i++) {
    const x = DECK_X[0] + 60 + rng() * (deckLen - 120);
    const lane = Math.floor(rng() * 4);
    const z = zc - 7 + lane * 4.6;
    const col = carCols[Math.floor(rng() * carCols.length)];
    concrete.box(4.4, 1.5, 1.9, x, DECK_Y + 0.75, z, col);
  }

  // Main cables: catenaries over both towers, down to the anchorages.
  const a = catenaryParam(HALF_SPAN, SADDLE_Y - CABLE_LOW_Y);
  const mainY = (x: number): number => a * Math.cosh((x - MID_X) / a) + (CABLE_LOW_Y - a);
  const southY = catenaryThrough(ANCHOR_X[0], ANCHOR_Y, TOWER_X[0], SADDLE_Y, a);
  const northY = catenaryThrough(TOWER_X[1], SADDLE_Y, ANCHOR_X[1], ANCHOR_Y, a);
  const spans: [number, number, (x: number) => number][] = [
    [ANCHOR_X[0], TOWER_X[0], southY],
    [TOWER_X[0], TOWER_X[1], mainY],
    [TOWER_X[1], ANCHOR_X[1], northY],
  ];
  for (const side of [-1, 1]) {
    const z = zc + side * CABLE_Z;
    for (const [x0, x1, f] of spans) {
      const n = Math.ceil((x1 - x0) / 5);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        pts.push(new THREE.Vector3(x, f(x), z));
      }
      orange.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, CABLE_R, 10, false), ORANGE);
      // Suspender ropes every 15 m, hanging from the cable to the truss.
      for (let x = x0 + 15; x < x1 - 8; x += 15) {
        const top = f(x) - CABLE_R * 0.8;
        const bottom = DECK_Y + 0.2;
        const h = top - bottom;
        if (h < 0.6) continue;
        orange.box(0.55, h, 0.55, x, bottom + h / 2, z, ORANGE_DEEP);
      }
    }
  }

  // Anchorages: massive concrete blocks where the cables go to ground.
  for (const ax of ANCHOR_X) {
    const cx = ax + (ax < 0 ? -6 : 6);
    concrete.box(36, 36, 46, cx, 12, zc, 0x9d9689);
    concrete.box(28, 14, 40, cx, 36.5, zc, 0xa49d90);
    concrete.box(30, 1.6, 42, cx, 44.2, zc, 0x8b8479);
    for (let k = -2; k <= 2; k++) concrete.box(2.2, 30, 1.2, cx + k * 6.5, 13, zc + 23.3, 0x8f887c);
  }

  // South approach: the Fort Point arch over the old brick fort.
  const archX0 = -334;
  const archX1 = -472;
  for (const side of [-1, 1]) {
    const z = zc + side * 8.6;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      pts.push(new THREE.Vector3(lerp(archX0, archX1, u), 5 + 37 * Math.sin(Math.PI * u) ** 0.8, z));
    }
    for (let i = 0; i < 20; i++) beam(orange, pts[i], pts[i + 1], 2.4, 3.2, ORANGE);
    for (let i = 2; i < 20; i += 2) {
      const p = pts[i];
      const h = DECK_Y - 6.5 - p.y;
      if (h > 1) orange.box(1.4, h, 1.4, p.x, p.y + h / 2, z, ORANGE_DEEP);
    }
  }
  for (let i = 1; i < 10; i++) {
    const x = lerp(archX0, archX1, i / 10);
    orange.box(1.2, 1.2, 17.2, x, 5 + 37 * Math.sin((Math.PI * i) / 10) ** 0.8, zc, ORANGE_DEEP);
  }
  // Fort Point: a stout brick fort tucked under the arch.
  concrete.box(46, 15, 48, -403, 11.5, zc, 0x9a5a42);
  concrete.box(47, 1.4, 49, -403, 19.6, zc, 0x7e4634);
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 9; i++) {
      concrete.box(1.6, 1.9, 0.3, -421 + i * 4.5, 8 + r * 4, zc + 24.1, 0x3a2a24);
    }
  }
  // Approach piers into the Presidio bluff and the Marin slope.
  for (const x of [-500, -540, 1200, 1236, 1272]) {
    const ground = x < 0 ? presidioHeight(x, zc) : marinHeight(x, zc);
    const h = DECK_Y - 6.8 - ground + 4;
    if (h < 2) continue;
    for (const side of [-1, 1]) orange.box(2.8, h, 2.8, x, ground - 4 + h / 2, zc + side * 8.5, ORANGE);
    orange.box(3, 2.4, 20, x, DECK_Y - 7.6, zc, ORANGE_DEEP);
  }

  const orangeMat = scaleFog(new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.52,
    metalness: 0.18,
    // A touch of self-light keeps International Orange saturated through a kilometre of fog.
    emissive: new THREE.Color(0x8c2206),
    emissiveIntensity: 1,
  }), BRIDGE_FOG);
  const concreteMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  const orangeMesh = orange.build(orangeMat, 'bridge-orange');
  const concreteMesh = concrete.build(concreteMat, 'bridge-concrete');
  group.add(orangeMesh, concreteMesh);
  return group;
}

// ---------------------------------------------------------------------------------------------
// Alcatraz

function cellhouseTexture(): THREE.CanvasTexture {
  // One 20 m × 14 m facade bay: pale concrete with tall barred windows in two rows.
  const tex = canvasTexture(256, 180, (ctx, w, h) => {
    ctx.fillStyle = '#ebe4d2';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d6ccb4';
    ctx.fillRect(0, h - 16, w, 16);
    ctx.fillStyle = '#c9bfa7';
    ctx.fillRect(0, 0, w, 9);
    for (let i = 0; i < 6; i++) {
      const x = 14 + i * 40;
      for (const [y0, wh] of [
        [26, 60],
        [104, 58],
      ] as const) {
        ctx.fillStyle = '#c6bca4';
        ctx.fillRect(x - 3, y0 - 3, 26, wh + 6);
        ctx.fillStyle = '#2f3b46';
        ctx.fillRect(x, y0, 20, wh);
        ctx.fillStyle = '#56636d';
        for (let b = 1; b < 4; b++) ctx.fillRect(x + b * 5 - 1, y0, 2, wh);
        ctx.fillRect(x, y0 + wh / 2 - 1, 20, 2);
      }
    }
  }, { repeat: [1, 1] });
  return tex;
}

function glowTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,250,225,1)');
    g.addColorStop(0.18, 'rgba(255,232,150,0.85)');
    g.addColorStop(0.5, 'rgba(255,210,110,0.22)');
    g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function buildAlcatraz(): { group: THREE.Group; update(t: number): void } {
  const group = new THREE.Group();
  group.name = 'alcatraz';
  group.position.set(ALCATRAZ.x, 0, ALCATRAZ.z);
  group.rotation.y = 0.1;
  const rng = makeRng(1934);

  // Island outline: an irregular long oval with a flat dock shelf at the -x end.
  const jitter = Array.from({ length: 64 }, () => (rng() - 0.5) * 0.05);
  const outline = (scale: number, dockBulge: number): THREE.Vector2[] => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const r = 1 + 0.07 * Math.sin(3 * a + 0.4) + 0.05 * Math.sin(5 * a + 2.1) + jitter[i];
      const da = Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI));
      const bulge = dockBulge * Math.exp(-((da / 0.5) ** 2));
      const rx = 112 * r * scale + bulge;
      const rz = 44 * r * scale * (1 + 0.1 * Math.cos(a)) + bulge * 0.35;
      // Shape y becomes world -z after the extrusion is stood up.
      pts.push(new THREE.Vector2(Math.cos(a) * rx, -Math.sin(a) * rz));
    }
    return pts;
  };

  const rockWall = [0x6e6357, 0x7b6f61, 0x645a4f, 0x857868, 0x716a5f];
  const rock = new Batch();
  const apron = new THREE.ExtrudeGeometry(new THREE.Shape(outline(1, 24)), {
    depth: 9,
    bevelEnabled: true,
    bevelThickness: 1.5,
    bevelSize: 2.5,
    bevelSegments: 1,
    curveSegments: 4,
  });
  apron.rotateX(-Math.PI / 2);
  apron.translate(0, -4.5, 0); // y in [-6, 6]
  rock.addColored(colorFacets(apron, rng, [0x8a8175, 0x7f776b, 0x938a7c], rockWall));
  const cliff = new THREE.ExtrudeGeometry(new THREE.Shape(outline(0.84, 0)), {
    depth: 22,
    bevelEnabled: true,
    bevelThickness: 3,
    bevelSize: 3.5,
    bevelSegments: 2,
    curveSegments: 4,
  });
  cliff.rotateX(-Math.PI / 2);
  cliff.translate(0, 5, 0); // y in [2, 30]
  rock.addColored(colorFacets(cliff, rng, [0x8e8a5e, 0x7c8b50, 0x9b9070, 0x86845a], rockWall));
  // Boulders along the waterline.
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2;
    const r = 1.02 + rng() * 0.06;
    const s = 2 + rng() * 3.5;
    rock.add(
      new THREE.DodecahedronGeometry(s, 0),
      new THREE.Color(rockWall[i % rockWall.length]).multiplyScalar(0.95),
      tf(Math.cos(a) * 112 * r, rng() * 1.5, Math.sin(a) * 46 * r, rng() * 3, rng() * 3, rng() * 3),
    );
  }
  const rockMesh = rock.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, flatShading: true }), 'alcatraz-rock');
  group.add(rockMesh);

  // Buildings and greenery.
  const bld = new Batch();
  const top = 30;
  // Cellhouse roof (the textured walls are a separate mesh below).
  bld.box(79.2, 1, 23.2, -5, top + 14.5, 2, 0x8f8a80);
  bld.box(68, 1.8, 6, -5, top + 15.9, 2, 0xa7a297);
  bld.box(12, 4, 12, 30, top + 2, 14, 0xe0d8c4); // administration wing
  bld.box(12.6, 0.8, 12.6, 30, top + 4.4, 14, 0x8f5a44);
  // Lighthouse: white octagonal tower, dark gallery and cap; the lantern glows separately.
  const lh = { x: -47, z: 14 };
  bld.add(new THREE.CylinderGeometry(1.9, 2.5, 23, 8), 0xf4f1e8, tf(lh.x, top + 11.5, lh.z));
  bld.add(new THREE.CylinderGeometry(3, 3, 0.7, 12), 0x33383d, tf(lh.x, top + 23.3, lh.z));
  bld.add(new THREE.CylinderGeometry(0.4, 2, 2.2, 10), 0x2b3035, tf(lh.x, top + 27.8, lh.z));
  bld.add(new THREE.SphereGeometry(0.45, 8, 6), 0x2b3035, tf(lh.x, top + 29.1, lh.z));
  // Keeper's house beside it.
  bld.box(9, 5.5, 7, lh.x + 8, top + 2.75, lh.z + 6, 0xe6dfcd);
  bld.add(new THREE.ConeGeometry(6.4, 3, 4), 0x9a3b2c, tf(lh.x + 8, top + 7, lh.z + 6, 0, Math.PI / 4, 0, 1, 1, 0.8));
  // Water tower at the far end.
  const wt = { x: 72, z: -10 };
  for (const dx of [-3.4, 3.4]) {
    for (const dz of [-3.4, 3.4]) bld.box(0.7, 19, 0.7, wt.x + dx, top + 9.5, wt.z + dz, 0x8a8e92);
  }
  for (const y of [top + 6, top + 12.5]) {
    bld.box(7.6, 0.4, 0.4, wt.x, y, wt.z - 3.4, 0x8a8e92);
    bld.box(7.6, 0.4, 0.4, wt.x, y, wt.z + 3.4, 0x8a8e92);
    bld.box(0.4, 0.4, 7.6, wt.x - 3.4, y, wt.z, 0x8a8e92);
    bld.box(0.4, 0.4, 7.6, wt.x + 3.4, y, wt.z, 0x8a8e92);
  }
  bld.add(new THREE.CylinderGeometry(5, 5, 7, 18), 0xe4ddd0, tf(wt.x, top + 22.5, wt.z));
  bld.add(new THREE.CylinderGeometry(5.05, 5.05, 1.1, 18), 0xb4553b, tf(wt.x, top + 20, wt.z));
  bld.add(new THREE.ConeGeometry(5.4, 2.6, 18), 0xb9b2a4, tf(wt.x, top + 27.3, wt.z));
  // Dock barracks on the shelf at the -x end, with rows of windows, and the wharf.
  const bx = -121;
  bld.box(14, 12, 32, bx, 6 + 6, 4, 0xdcc48e);
  bld.box(14.8, 0.9, 32.8, bx, 6 + 12.4, 4, 0x7a6b58);
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 8; i++) bld.box(0.25, 1.7, 1.5, bx - 7.05, 8.4 + r * 3.2, -9.5 + i * 3.8, 0x2f3b46);
  }
  bld.box(24, 1.3, 8, bx - 17, 0.9, 10, 0x7b5c40);
  for (let i = 0; i < 5; i++) bld.add(new THREE.CylinderGeometry(0.35, 0.35, 4, 6), 0x4e3a2a, tf(bx - 27 + i * 5, -0.8, 13.5));
  // Ruins and small outbuildings on the plateau.
  bld.box(14, 3.5, 9, 18, top + 1.75, -18, 0xcfc6b3);
  bld.box(8, 3, 8, 52, top + 1.5, 16, 0xd8cfbb);
  // Green patches of ice plant and trees clinging to the slopes.
  const greens = [0x5f7d3f, 0x6d8c45, 0x4f6d38, 0x7a9150];
  const cliffPts = outline(0.84, 0);
  for (let i = 0; i < 46; i++) {
    const p = cliffPts[Math.floor(rng() * cliffPts.length)];
    const len = Math.hypot(p.x, p.y);
    const onTop = rng() < 0.45;
    // On the plateau: somewhere inside the rim. On the cliffs: on the (bevelled) wall surface.
    const k = onTop ? 0.5 + rng() * 0.35 : (len + 3.2) / len;
    const x = p.x * k;
    const z = -p.y * k;
    if (onTop && Math.abs(x + 5) < 45 && Math.abs(z - 2) < 16) continue; // not on the cellhouse
    const y = onTop ? top + 0.6 : 9 + rng() * 17;
    const s = onTop ? 2.5 + rng() * 3.5 : 2 + rng() * 2.6;
    bld.add(new THREE.IcosahedronGeometry(s, 0), greens[i % greens.length], tf(x, y, z, rng(), rng(), rng(), 1.3, onTop ? 0.55 : 0.9, 1.1));
  }
  const bldMesh = bld.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), 'alcatraz-buildings');
  group.add(bldMesh);

  // Cellhouse walls: window-textured box with UVs scaled so one texture tile is 20 m of facade.
  const cell = new THREE.BoxGeometry(78, 14, 22);
  const uv = cell.getAttribute('uv') as THREE.BufferAttribute;
  const faceScale = [22 / 20, 22 / 20, 0, 0, 78 / 20, 78 / 20]; // px, nx, py, ny, pz, nz
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (faceScale[f] === 0) uv.setXY(i, 0.02, 0.5);
      else uv.setX(i, uv.getX(i) * faceScale[f]);
    }
  }
  const cellTex = cellhouseTexture();
  const cellMesh = new THREE.Mesh(cell, new THREE.MeshStandardMaterial({ map: cellTex, roughness: 0.85 }));
  cellMesh.position.set(-5, top + 7, 2);
  cellMesh.name = 'alcatraz-cellhouse';
  group.add(cellMesh);

  // Lighthouse lantern and its soft blink.
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xfff1c0,
    emissive: new THREE.Color(0xffc94d),
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.2, 10), lanternMat);
  lantern.position.set(lh.x, top + 25.2, lh.z);
  lantern.name = 'alcatraz-lantern';
  group.add(lantern);
  const glowMat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: 0xffe6a0,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    opacity: 0.3,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.position.copy(lantern.position);
  glow.scale.setScalar(14);
  glow.name = 'alcatraz-lighthouse-glow';
  group.add(glow);

  return {
    group,
    update(t: number): void {
      // A slow beacon: fade up, hold briefly, fade out, then rest.
      const p = (t % 5) / 5;
      const k = p < 0.3 ? Math.sin((p / 0.3) * Math.PI) ** 2 : 0;
      lanternMat.emissiveIntensity = 0.5 + 2.5 * k;
      glowMat.opacity = 0.1 + 0.7 * k;
      glow.scale.setScalar(8 + 12 * k);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Sea lions on their float

type LionPose = 'rest' | 'look' | 'bark';

interface LionSpec {
  x: number;
  z: number;
  ry: number;
  scale: number;
  pose: LionPose;
  tint: number;
  phase: number;
}

interface Lion {
  spec: LionSpec;
  head: THREE.Group;
  headBase: number;
}

/** Toy exaggeration: a bit bigger than life so they read from the launch camera. */
const LION_SCALE = 1.25;

const LIONS: LionSpec[] = [
  { x: -5.4, z: -1.5, ry: 0.25, scale: 1, pose: 'rest', tint: 0x75502f, phase: 0 },
  { x: -2.6, z: 1.4, ry: -1.35, scale: 1.05, pose: 'look', tint: 0x6a4629, phase: 1.3 },
  { x: 0.5, z: -1.3, ry: 0.95, scale: 0.96, pose: 'rest', tint: 0x80593a, phase: 2.2 },
  { x: 3.1, z: 1.3, ry: -1.15, scale: 1.1, pose: 'bark', tint: 0x6e4a2c, phase: 0.6 },
  { x: 5.9, z: -1.0, ry: 2.5, scale: 1, pose: 'look', tint: 0x7a5534, phase: 3.1 },
  { x: -0.2, z: 2.3, ry: -0.2, scale: 0.66, pose: 'look', tint: 0x8d6a47, phase: 4.4 },
];

/** A flattened capsule: length along x, width along z, thin in y. */
function paddle(len: number, width: number, thick: number): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(0.5, 1, 4, 10);
  g.rotateZ(-Math.PI / 2);
  g.scale(len / 2, thick, width);
  return g;
}

function makeSeaLion(spec: LionSpec, mat: THREE.Material): { root: THREE.Group; lion: Lion } {
  const root = new THREE.Group();
  root.position.set(spec.x, DOCK.top, spec.z);
  root.rotation.y = spec.ry;
  root.scale.setScalar(spec.scale * LION_SCALE);

  const tint = new THREE.Color(spec.tint);
  const dark = tint.clone().multiplyScalar(0.6);
  const snout = tint.clone().lerp(new THREE.Color(0xc9a27a), 0.35);
  const pitch = spec.pose === 'bark' ? 0.5 : spec.pose === 'look' ? 0.22 : 0.12;

  // Body: a lathe that is thick at the chest and tapers to the tail, lying along +x.
  const profile = [
    [0.02, 0],
    [0.11, 0.1],
    [0.19, 0.32],
    [0.27, 0.62],
    [0.34, 0.92],
    [0.4, 1.18],
    [0.39, 1.38],
    [0.33, 1.55],
    [0.25, 1.7],
    [0.2, 1.78],
    [0.001, 1.84],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const bodyGeo = new THREE.LatheGeometry(profile, 18);
  const place = new THREE.Matrix4()
    .makeRotationZ(pitch)
    .multiply(new THREE.Matrix4().makeScale(1, 0.84, 1.08))
    .multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2));
  bodyGeo.applyMatrix4(place);
  bodyGeo.computeBoundingBox();
  const lift = -bodyGeo.boundingBox!.min.y;
  bodyGeo.translate(0, lift, 0);
  const axis = (s: number): THREE.Vector3 => new THREE.Vector3(s * Math.cos(pitch), s * Math.sin(pitch) + lift, 0);

  const body = new Batch();
  body.add(bodyGeo, tint);
  // Front flippers splayed out and down to the deck from the chest.
  const chest = axis(1.12);
  for (const s of [-1, 1]) {
    // Positive roll about z lifts the inner end to the chest; the outer tip rests on the deck.
    const reach = chest.y > 0.35 ? 0.55 : 0.15;
    body.add(paddle(0.62, 0.26, 0.09), dark, tf(chest.x + 0.08, Math.max(0.06, chest.y * 0.45), s * 0.42, 0, s * 1.05, reach));
  }
  // Rear flippers fanned out behind the tail.
  const tail = axis(0.06);
  for (const s of [-1, 1]) {
    body.add(paddle(0.5, 0.26, 0.07), dark, tf(tail.x - 0.2, 0.05, s * 0.14, 0, s * 0.55, 0));
  }
  root.add(body.build(mat, 'sea-lion-body'));

  // Head on a neck pivot so it can bob.
  const head = new THREE.Group();
  head.position.copy(axis(1.7));
  const hb = new Batch();
  hb.add(new THREE.SphereGeometry(0.21, 18, 14), tint, tf(0.1, 0.07, 0, 0, 0, 0, 1.18, 1, 1));
  hb.add(new THREE.SphereGeometry(0.12, 14, 10), snout, tf(0.3, 0.01, 0, 0, 0, 0, 1.35, 0.82, 0.95));
  hb.add(new THREE.SphereGeometry(0.045, 10, 8), 0x161311, tf(0.46, 0.04, 0));
  for (const s of [-1, 1]) {
    hb.add(new THREE.SphereGeometry(0.042, 10, 8), 0x0d0c0b, tf(0.269, 0.143, s * 0.127));
    hb.add(new THREE.SphereGeometry(0.013, 6, 4), 0xffffff, tf(0.3, 0.165, s * 0.138));
    hb.add(new THREE.CylinderGeometry(0.02, 0.012, 0.06, 6), dark, tf(0.05, 0.17, s * 0.16, s * 0.5, 0, 0));
  }
  head.add(hb.build(mat, 'sea-lion-head'));
  const headBase = spec.pose === 'bark' ? 0.6 : spec.pose === 'look' ? 0.28 : -0.34;
  head.rotation.z = headBase;
  root.add(head);
  return { root, lion: { spec, head, headBase } };
}

function buildSeaLions(): { group: THREE.Group; update(t: number): void } {
  const dock = new THREE.Group();
  dock.name = 'sea-lion-float';
  dock.position.set(DOCK.x, 0.05, DOCK.z);

  // The float: weathered planks on black drums, with a frame and a couple of tyre fenders.
  const wood = new Batch();
  const len = 16;
  const wid = 7;
  const plank = 0.44;
  const n = Math.floor(wid / (plank + 0.05));
  for (let i = 0; i < n; i++) {
    const z = -wid / 2 + plank / 2 + i * (plank + 0.05) + 0.1;
    wood.box(len, 0.12, plank, 0, DOCK.top - 0.06, z, i % 2 ? 0xa27b52 : 0x93704a);
  }
  wood.box(len + 0.3, 0.3, 0.3, 0, DOCK.top - 0.2, -wid / 2, 0x6e5238);
  wood.box(len + 0.3, 0.3, 0.3, 0, DOCK.top - 0.2, wid / 2, 0x6e5238);
  for (const x of [-len / 2, len / 2]) wood.box(0.3, 0.3, wid, x, DOCK.top - 0.2, 0, 0x6e5238);
  for (let i = 0; i < 6; i++) {
    const x = -len / 2 + 1.4 + i * ((len - 2.8) / 5);
    wood.add(new THREE.CylinderGeometry(0.42, 0.42, wid - 0.6, 14), 0x2a2d31, tf(x, -0.12, 0, Math.PI / 2, 0, 0));
  }
  for (const x of [-4.5, 3.5]) {
    wood.add(new THREE.TorusGeometry(0.34, 0.13, 8, 16), 0x1c1c1e, tf(x, 0.05, wid / 2 + 0.16));
  }
  dock.add(wood.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }), 'sea-lion-float'));

  const lionMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.36,
    clearcoat: 0.85,
    clearcoatRoughness: 0.22,
  });
  const lions: Lion[] = [];
  for (const spec of LIONS) {
    const { root, lion } = makeSeaLion(spec, lionMat);
    dock.add(root);
    lions.push(lion);
  }
  setShadows(dock, true, true);

  return {
    group: dock,
    update(t: number): void {
      dock.position.y = 0.05 + 0.06 * Math.sin(t * 1.1);
      dock.rotation.x = 0.014 * Math.sin(t * 0.9);
      dock.rotation.z = 0.01 * Math.sin(t * 1.3 + 1);
      for (const l of lions) {
        const s = l.spec;
        let r = l.headBase + 0.07 * Math.sin(t * 0.8 + s.phase);
        if (s.pose === 'bark') {
          const c = (t + s.phase) % 2.4;
          if (c < 0.36) r += 0.3 * Math.sin((c / 0.36) * Math.PI);
          else if (c > 0.5 && c < 0.8) r += 0.2 * Math.sin(((c - 0.5) / 0.3) * Math.PI);
        }
        l.head.rotation.z = r;
        l.head.rotation.y = 0.22 * Math.sin(t * 0.37 + s.phase * 2);
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Sailboats

function triangle(a: [number, number, number], b: [number, number, number], c: [number, number, number]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...a, ...b, ...c]), 3));
  g.computeVertexNormals();
  return g;
}

function buildSailboats(): { group: THREE.Group; update(t: number): void } {
  const group = new THREE.Group();
  group.name = 'sailboats';
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide });
  const specs = [
    { x: 700, z: -440, ry: 0.5, stripe: 0x2f63ea, jib: 0xffc81f, phase: 0 },
    { x: 1330, z: 160, ry: -0.8, stripe: 0xe8322a, jib: 0xffffff, phase: 1.7 },
    { x: 1580, z: -700, ry: 2.6, stripe: 0x14b8b0, jib: 0xff5fae, phase: 3.1 },
  ];
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-4.6, -1.35);
  hullShape.lineTo(0.5, -1.65);
  hullShape.quadraticCurveTo(3.6, -1.4, 5, 0);
  hullShape.quadraticCurveTo(3.6, 1.4, 0.5, 1.65);
  hullShape.lineTo(-4.6, 1.35);
  hullShape.quadraticCurveTo(-5, 0, -4.6, -1.35);
  const boats: { inner: THREE.Object3D; phase: number }[] = [];
  for (const s of specs) {
    const b = new Batch();
    const hull = new THREE.ExtrudeGeometry(hullShape, { depth: 1.3, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 2 });
    hull.rotateX(-Math.PI / 2);
    b.add(hull, 0xf6f4ee, tf(0, -0.4, 0));
    const band = new THREE.ExtrudeGeometry(hullShape, { depth: 0.3, bevelEnabled: false });
    band.rotateX(-Math.PI / 2);
    b.add(band, s.stripe, tf(0, 0.35, 0, 0, 0, 0, 1.07, 1, 1.2));
    b.box(2.6, 0.8, 1.7, -0.8, 1.35, 0, 0xf2eee4);
    b.add(new THREE.CylinderGeometry(0.08, 0.1, 11.5, 6), 0xd9dadc, tf(0.7, 6.9, 0));
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 5), 0xd9dadc, tf(-1.3, 2.4, 0, 0, 0, Math.PI / 2));
    b.add(triangle([0.62, 2.6, 0], [0.62, 12.3, 0], [-3.3, 2.6, 0]), 0xfbfaf4);
    b.add(triangle([0.78, 1.9, 0], [0.78, 10.6, 0], [4.7, 1.4, 0]), s.jib);
    const outer = new THREE.Group();
    outer.position.set(s.x, 0, s.z);
    outer.rotation.y = s.ry;
    const inner = b.build(mat, 'sailboat');
    outer.add(inner);
    group.add(outer);
    boats.push({ inner, phase: s.phase });
  }
  return {
    group,
    update(t: number): void {
      for (const b of boats) {
        b.inner.rotation.x = 0.07 * Math.sin(t * 0.9 + b.phase);
        b.inner.rotation.z = 0.03 * Math.sin(t * 0.6 + b.phase * 1.3);
        b.inner.position.y = 0.15 * Math.sin(t * 0.8 + b.phase);
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------

export function buildLandmarks(): Landmarks {
  const group = new THREE.Group();
  group.name = 'landmarks';

  group.add(buildBridge());
  group.add(buildTerrain());
  const alcatraz = buildAlcatraz();
  group.add(alcatraz.group);
  const sealions = buildSeaLions();
  group.add(sealions.group);
  const boats = buildSailboats();
  group.add(boats.group);

  return {
    group,
    update(_dt: number, t: number): void {
      alcatraz.update(t);
      sealions.update(t);
      boats.update(t);
    },
  };
}

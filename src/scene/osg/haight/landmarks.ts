// The Haight's landmarks, as extras on their buildings: Piedmont Boutique's giant fishnet legs
// kicking out of the bay window (their own two meshes, so they can kick), the jeweller's clock on
// the Doolan-Larson building's corner stuck at twenty past four, HAIGHT and ASHBURY lettered on its
// frieze under the ivy, its hipped roof and dormer; the white HAIGHT / ASHBURY blades on their green
// pole; Love on Haight's painted pillars and tie-dye; and the street's bits and pieces (café tables,
// umbrellas, a fire escape, a bench, string lights).
import * as THREE from 'three';
import { GeoBuilder, box, cyl, obox, type V3 } from '../../geo';
import type { Ctx } from '../context';
import type { Atlas } from './atlas';
import type { Built, Frame, Sinks } from './building';

// ---------------------------------------------------------------------------------------------
// Piedmont's legs

/**
 * A leg in a fishnet stocking and a red stiletto, from the hip (the origin) along +y: the thigh up
 * to the knee, the calf bent back `knee` radians from it, the foot pointed. One geometry, the
 * stocking's UVs in the atlas's fishnet cell, the shoe's on its white cell (painted red).
 */
function legGeometry(atlas: Atlas, knee: number): THREE.BufferGeometry {
  const b = new GeoBuilder();
  const lathe = (pts: number[][]): THREE.BufferGeometry => atlas.remap(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 14), 'fishnet');
  b.add(lathe([
    [0.001, -0.08],
    [0.3, 0],
    [0.33, 0.25],
    [0.29, 0.7],
    [0.21, 1.12],
    [0.19, 1.2],
  ]), '#ffffff');
  const kneeM = new THREE.Matrix4().makeRotationX(-knee).setPosition(0, 1.16, 0);
  b.add(lathe([
    [0.2, 0],
    [0.23, 0.3],
    [0.2, 0.62],
    [0.12, 0.95],
    [0.085, 1.08],
    [0.001, 1.14],
  ]), '#ffffff', kneeM);
  // The shoe, on the pointed foot: the toe box, a sole, the stiletto heel.
  const foot = kneeM.clone().multiply(new THREE.Matrix4().makeTranslation(0, 1.06, 0));
  const shoe = (g: THREE.BufferGeometry, m: THREE.Matrix4): void => b.add(atlas.remap(g, 'white'), '#d0122e', foot.clone().multiply(m));
  const toe = new THREE.SphereGeometry(0.13, 10, 6);
  toe.scale(0.85, 2.1, 0.75);
  shoe(toe, new THREE.Matrix4().setPosition(0, 0.16, -0.03));
  shoe(new THREE.BoxGeometry(0.15, 0.46, 0.05), new THREE.Matrix4().setPosition(0, 0.16, -0.12));
  shoe(new THREE.CylinderGeometry(0.018, 0.035, 0.36, 6), new THREE.Matrix4().makeRotationX(Math.PI / 2 + 0.35).setPosition(0, -0.02, 0.2));
  const back = new THREE.SphereGeometry(0.1, 8, 5);
  shoe(back, new THREE.Matrix4().setPosition(0, 0.0, 0.04));
  return b.build();
}

/**
 * Piedmont's legs: out of the front window of the bay over the shop, thighs up and out over the
 * sidewalk, knees bent, heels in the air, kicking in turn.
 */
export function piedmontLegs(k: Sinks, b: Built, bayIndex: number, mat: THREE.Material): void {
  const [b0, b1] = b.bays[bayIndex];
  const f = b.front;
  const mid = (b0 + b1) / 2;
  // The hips, on the sill of the bay's first-floor front window.
  const hipY = b.shopTop + 0.62;
  const hipC = -0.95;
  const facing = Math.atan2(-f.wz, -f.wx);
  const legs: { mesh: THREE.Mesh; lift: number; phase: number }[] = [];
  [-0.45, 0.45].forEach((da, i) => {
    const geo = legGeometry(k.atlas, 0.75 + i * 0.25);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `piedmontLeg${i + 1}`;
    mesh.castShadow = true;
    // Giant (as they are, a bit more so).
    mesh.scale.setScalar(1.45);
    const p = f.p(mid + da, hipY, hipC);
    mesh.position.set(p[0], p[1], p[2]);
    // Local +y is the leg; tip it out over the street (towards `facing`) and splay it.
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = Math.PI / 2 - facing;
    mesh.rotation.z = (i ? -1 : 1) * 0.12;
    k.ctx.group.add(mesh);
    legs.push({ mesh, lift: 0.95 - i * 0.12, phase: i * Math.PI });
  });
  k.ctx.updaters.push((_dt, t) => {
    for (const l of legs) l.mesh.rotation.x = l.lift + 0.22 * Math.max(0, Math.sin(t * 2.1 + l.phase)) ** 2;
  });
  // The window they're kicking out of stands open: a dark hole behind them.
  f.box(k.ctx.sinks.paint, mid - 0.85, mid + 0.85, hipY - 0.05, hipY + 1.7, -0.87, -0.85, '#241a24');
}

// ---------------------------------------------------------------------------------------------
// The Doolan-Larson building's clock, frieze, ivy and roof; the street blades

/** The jeweller's clock: a drum with a face each side, on a bracket out from a corner, its hands
 *  at 4:20. `dir` is the way the bracket reaches out (unit, x z); the faces look along `face`. */
export function clock(k: Sinks, x: number, y: number, z: number, dir: [number, number], face: number): void {
  const S = k.ctx.sinks;
  const r = 0.78;
  const reach = 1.35;
  const cx = x + dir[0] * reach;
  const cz = z + dir[1] * reach;
  // The bracket: an arm from the wall, a scroll under it, a hanger.
  cyl(S.metal, [x, y + r + 0.35, z], [cx, y + r + 0.35, cz], 0.05, 0.05, 6, '#1c1d20');
  cyl(S.metal, [x, y + r - 0.35, z], [x + dir[0] * reach * 0.55, y + r + 0.3, z + dir[1] * reach * 0.55], 0.04, 0.04, 6, '#1c1d20');
  cyl(S.metal, [cx, y + r + 0.35, cz], [cx, y + r, cz], 0.035, 0.035, 6, '#1c1d20');
  const fx = Math.cos(face);
  const fz = Math.sin(face);
  const drum = new THREE.CylinderGeometry(r, r, 0.3, 28);
  drum.rotateX(Math.PI / 2);
  drum.rotateY(-face + Math.PI / 2);
  drum.translate(cx, y, cz);
  S.gloss.add(drum, '#15161a');
  const ring = new THREE.TorusGeometry(r, 0.06, 6, 28);
  for (const s of [1, -1]) {
    const g = ring.clone();
    g.rotateY(-face + Math.PI / 2);
    g.translate(cx + fx * 0.15 * s, y, cz + fz * 0.15 * s);
    S.gloss.add(g, '#c9a54a');
  }
  ring.dispose();
  for (const s of [1, -1]) {
    const g = k.atlas.remap(new THREE.CircleGeometry(r * 0.94, 28), 'clock');
    // CircleGeometry faces +z with the picture upright; turn it to face along ±face.
    g.rotateY(Math.PI / 2 - face + (s < 0 ? Math.PI : 0));
    g.translate(cx + fx * 0.16 * s, y, cz + fz * 0.16 * s);
    k.signs.add(g, '#ffffff');
  }
  const fin = new THREE.SphereGeometry(0.1, 8, 6);
  fin.translate(cx, y - r - 0.1, cz);
  S.gloss.add(fin, '#c9a54a');
}

/** The white street blades on their green pole: HAIGHT along Haight, ASHBURY along Ashbury, and
 *  the speed limit under them, facing `limitFace`. */
export function streetBlades(k: Sinks, x: number, y: number, z: number, haightH: number, ashburyH: number, limitFace: number): void {
  const S = k.ctx.sinks;
  cyl(S.metal, [x, y - 0.3, z], [x, y + 4.1, z], 0.07, 0.085, 10, '#1f4a3a');
  const cap = new THREE.SphereGeometry(0.09, 8, 6);
  cap.translate(x, y + 4.12, z);
  S.metal.add(cap, '#1f4a3a');
  const plate = (h: number, name: string, yy: number): void => {
    const len = 1.7;
    const ht = 0.33;
    const hx = Math.cos(h);
    const hz = Math.sin(h);
    obox(S.paint, [x, yy, z], [len, ht, 0.04], [0, -h, 0], '#fbfbf7');
    // The side you see looking along -right, and the other side.
    const nx = -hz;
    const nz = hx;
    const e = 0.025;
    const P = (a: number, b: number, s: number): V3 => [x + hx * a + nx * e * s, yy + b, z + hz * a + nz * e * s];
    k.atlas.quad(k.signs, name, P(-len / 2, -ht / 2, 1), P(len / 2, -ht / 2, 1), P(len / 2, ht / 2, 1), P(-len / 2, ht / 2, 1), [nx, 0, nz]);
    k.atlas.quad(k.signs, name, P(len / 2, -ht / 2, -1), P(-len / 2, -ht / 2, -1), P(-len / 2, ht / 2, -1), P(len / 2, ht / 2, -1), [-nx, 0, -nz]);
  };
  plate(haightH, 'bladeHaight', y + 3.72);
  plate(ashburyH, 'bladeAshbury', y + 3.34);
  // SPEED LIMIT 20, lower down, facing the traffic.
  const lx = Math.cos(limitFace);
  const lz = Math.sin(limitFace);
  const px = x + lx * 0.1;
  const pz = z + lz * 0.1;
  obox(S.paint, [px - lx * 0.02, y + 2.25, pz - lz * 0.02], [0.03, 0.72, 0.56], [0, -limitFace, 0], '#fbfbf7');
  // Seen from `limitFace`, the picture's right is to that viewer's right.
  const rx = lz;
  const rz = -lx;
  const Q = (a: number, b: number): V3 => [px + rx * a, y + 2.25 + b, pz + rz * a];
  k.atlas.quad(k.signs, 'speed20', Q(-0.26, -0.35), Q(0.26, -0.35), Q(0.26, 0.35), Q(-0.26, 0.35), [lx, 0, lz]);
}

/** A hipped roof over a building's footprint (from its front frame), and a dormer on the front. */
export function hipRoof(S: Ctx['sinks'], f: Frame, W: number, D: number, y: number, h: number, color: string, dormer: string): void {
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  g.rotateY(Math.PI / 4);
  g.scale(W + 0.5, h, D + 0.5);
  g.translate(W / 2, y + h / 2, D / 2);
  S.walls.add(g, color, f.m);
  // The dormer: a little gabled box on the front slope with a window.
  const a = W / 2;
  f.box(S.walls, a - 0.8, a + 0.8, y + 0.1, y + h * 0.55 + 0.4, 1.2, 3.2, dormer);
  f.box(S.glass, a - 0.45, a + 0.45, y + 0.5, y + h * 0.55, 1.15, 1.2, '#ffffff');
  const cap = new THREE.ConeGeometry(1.25, 0.8, 4);
  cap.rotateY(Math.PI / 4);
  cap.scale(1, 1, 1.4);
  cap.translate(a, y + h * 0.55 + 0.8, 2.2);
  S.walls.add(cap, color, f.m);
}

/** Ivy along a ledge: a row of lumps of leaves from a0 to a1 on a face, just under y. */
export function ivy(S: Ctx['sinks'], f: Frame, a0: number, a1: number, y: number, rng: () => number): void {
  for (let a = a0; a < a1; a += 0.8) {
    const g = new THREE.IcosahedronGeometry(0.42 + rng() * 0.12, 0);
    g.scale(1.3, 0.8, 0.8);
    const p = f.p(a + rng() * 0.2, y - 0.1 - rng() * 0.2, -0.35);
    g.translate(p[0], p[1], p[2]);
    S.foliage.add(g, rng() < 0.5 ? '#3f7a3a' : '#4f8f42');
  }
}

/** A string of lights hung in swags along a face, from a0 to a1 at height y. */
export function stringLights(S: Ctx['sinks'], f: Frame, a0: number, a1: number, y: number): void {
  const swag = 2.4;
  for (let a = a0; a < a1 - 0.1; a += swag) {
    const n = 4;
    let prev: V3 | null = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = f.p(a + swag * t, y - 0.35 * Math.sin(t * Math.PI), -0.6);
      if (prev) cyl(S.metal, prev, p, 0.008, 0.008, 3, '#2a2a2a');
      if (i > 0 && i < n) {
        const bulb = new THREE.OctahedronGeometry(0.08);
        bulb.translate(p[0], p[1] - 0.08, p[2]);
        S.glow.add(bulb, '#fff4d0');
      }
      prev = p;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Bits and pieces

/** Love on Haight's pillars: fat, round and painted in rainbow bands, either side of its fronts. */
export function paintedPillars(S: Ctx['sinks'], f: Frame, as: number[], y0: number, h: number): void {
  const cols = ['#e8322a', '#f7862a', '#f9d423', '#4cb944', '#2f8fd8', '#8e44d8', '#ff5fb8'];
  for (const a of as) {
    const p = f.p(a, 0, -0.32);
    const n = cols.length;
    for (let i = 0; i < n; i++) {
      const ya = y0 + (h * i) / n;
      const r = 0.3 + 0.07 * Math.sin((i / (n - 1)) * Math.PI);
      const g = new THREE.CylinderGeometry(r, r, h / n + 0.01, 10);
      g.translate(p[0], ya + h / n / 2, p[2]);
      S.gloss.add(g, cols[(i + Math.round(a)) % n]);
    }
  }
}

/** Tie-dye shirts and flags hanging from the upper windows. */
export function hangings(k: Sinks, f: Frame, as: number[], y: number): void {
  as.forEach((a, i) => {
    const name = i % 2 ? 'peaceFlag' : 'tieDye';
    const w = 1.0;
    const h = 1.05;
    cyl(k.ctx.sinks.metal, f.p(a - 0.6, y + h / 2 + 0.05, -0.15), f.p(a + 0.6, y + h / 2 + 0.05, -0.15), 0.02, 0.02, 4, '#6b4a2a');
    f.sign(k.atlas, k.signs, name, a - w / 2, a + w / 2, y - h / 2, y + h / 2, -0.18);
  });
}

/** Café tables and chairs on the sidewalk in front of a face (between a0 and a1), `out` metres out;
 *  where each table stands (and the room it and its chairs take). */
export function cafeTables(S: Ctx['sinks'], f: Frame, a0: number, a1: number, y: number, out: number, chair: string, rng: () => number): { x: number; z: number; r: number }[] {
  const placed: { x: number; z: number; r: number }[] = [];
  for (let a = a0 + 0.8; a < a1 - 0.6; a += 1.9) {
    const c = -out - rng() * 0.3;
    const p = f.p(a, y, c);
    placed.push({ x: p[0], z: p[2], r: 0.95 });
    cyl(S.metal, [p[0], y, p[2]], [p[0], y + 0.72, p[2]], 0.03, 0.05, 4, '#26272b');
    const top = new THREE.CylinderGeometry(0.34, 0.34, 0.04, 8);
    top.translate(p[0], y + 0.74, p[2]);
    S.metal.add(top, '#3a3b40');
    for (const s of [-1, 1]) {
      // A chair: a seat on a pedestal, a back.
      const q = f.p(a + s * 0.52, y, c + (rng() - 0.5) * 0.2);
      box(S.paint, q[0] - 0.2, q[0] + 0.2, y + 0.42, y + 0.47, q[2] - 0.2, q[2] + 0.2, chair);
      box(S.metal, q[0] - 0.03, q[0] + 0.03, y, y + 0.42, q[2] - 0.03, q[2] + 0.03, '#26272b');
      const back = f.p(a + s * 0.72, y, c);
      box(S.paint, back[0] - 0.03, back[0] + 0.03, y + 0.45, y + 0.85, back[2] - 0.2, back[2] + 0.2, chair);
    }
  }
  return placed;
}

/** A patio umbrella: a pole, a canopy in two colours' segments. */
export function umbrella(S: Ctx['sinks'], x: number, y: number, z: number, a: string, b: string): void {
  cyl(S.metal, [x, y, z], [x, y + 2.4, z], 0.03, 0.03, 6, '#d8d8d8');
  for (let i = 0; i < 8; i++) {
    const g = new THREE.ConeGeometry(1.2, 0.45, 2, 1, true, (i / 8) * Math.PI * 2, (Math.PI * 2) / 8);
    g.translate(x, y + 2.3, z);
    S.paint.add(g, i % 2 ? a : b);
  }
}

/** A black fire escape zigzagging up a face between a0 and a1 over the upper floors. */
export function fireEscape(S: Ctx['sinks'], f: Frame, a0: number, a1: number, yFrom: number, floors: number, fh: number): void {
  for (let i = 0; i < floors; i++) {
    const y = yFrom + i * fh;
    f.box(S.metal, a0, a1, y - 0.05, y, -1.0, 0, '#222326');
    // Railings.
    f.box(S.metal, a0, a1, y + 0.95, y + 1.0, -1.02, -0.96, '#222326');
    for (let a = a0; a <= a1 + 0.01; a += 0.5) f.box(S.metal, a - 0.015, a + 0.015, y, y + 1.0, -1.02, -0.98, '#222326');
    if (i > 0) {
      const from = f.p(a0 + 0.3, y - fh, -0.5);
      const to = f.p(a1 - 0.3, y, -0.5);
      cyl(S.metal, from, to, 0.05, 0.05, 4, '#222326');
    }
  }
}

/** A plain wooden bench against a face. */
export function wallBench(S: Ctx['sinks'], f: Frame, a0: number, a1: number, y: number): void {
  f.box(S.paint, a0, a1, y + 0.42, y + 0.48, -0.55, -0.12, '#8a5a34');
  f.box(S.paint, a0, a1, y + 0.55, y + 0.95, -0.14, -0.08, '#8a5a34');
  for (const a of [a0 + 0.1, a1 - 0.1]) f.box(S.metal, a - 0.03, a + 0.03, y, y + 0.44, -0.5, -0.15, '#2a2a2a');
}

/** Potted plants out on the sidewalk (The Mellow sells them): terracotta pots, leafy tops, the odd
 *  cactus. Where each stands. */
export function pots(S: Ctx['sinks'], f: Frame, a0: number, a1: number, y: number, rng: () => number): { x: number; z: number; r: number }[] {
  const placed: { x: number; z: number; r: number }[] = [];
  for (let a = a0; a < a1; a += 0.9 + rng() * 0.5) {
    const p = f.p(a, y, -0.55 - rng() * 0.35);
    const r = 0.18 + rng() * 0.12;
    placed.push({ x: p[0], z: p[2], r: r * 1.6 });
    cyl(S.paint, [p[0], y, p[2]], [p[0], y + r * 1.6, p[2]], r, r * 0.75, 8, '#c8643c');
    if (rng() < 0.3) {
      cyl(S.foliage, [p[0], y + r * 1.6, p[2]], [p[0], y + r * 1.6 + 0.7, p[2]], r * 0.45, r * 0.55, 6, '#4c9a4f');
    } else {
      const g = new THREE.IcosahedronGeometry(r * 1.6, 0);
      g.scale(1, 1.2, 1);
      g.translate(p[0], y + r * 1.6 + r * 1.2, p[2]);
      S.foliage.add(g, rng() < 0.5 ? '#3f8f4a' : '#5aa84f');
    }
  }
  return placed;
}

/** Flower buckets and produce crates on the sidewalk (Gus's, the corner gift shop). */
export function crates(S: Ctx['sinks'], f: Frame, a0: number, a1: number, y: number, rng: () => number): void {
  const fruit = ['#e8322a', '#ff8f1f', '#ffd23f', '#7ad151', '#8e44d8', '#ff5fb8'];
  for (let a = a0; a < a1 - 0.5; a += 0.7) {
    const c = -0.6 - rng() * 0.3;
    f.box(S.paint, a, a + 0.6, y, y + 0.5 + rng() * 0.2, c - 0.45, c, '#9a6b3c');
    const p = f.p(a + 0.3, y + 0.62, c - 0.22);
    const g = new THREE.IcosahedronGeometry(0.26, 0);
    g.scale(1.1, 0.5, 0.8);
    g.translate(p[0], p[1], p[2]);
    S.foliage.add(g, fruit[Math.floor(rng() * fruit.length)]);
  }
}


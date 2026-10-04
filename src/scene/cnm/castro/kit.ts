// The Castro's pieces: rainbow flags (still ones on the lamp posts' brackets and over the shops, and
// the giant one at Harvey Milk Plaza, waving), Pride bunting strung across the street, a balloon arch,
// disco balls, the bronze plaques of the Rainbow Honor Walk, a vintage F-line streetcar, and Pink
// Triangle Park's granite pylons. All built into the scene's shared builders by material, but for
// the big flag and the disco balls (they move).
import * as THREE from 'three';
import { GeoBuilder, cyl, obox, type V3 } from '../../geo';
import type { Ctx } from '../../osg/context';
import { PRIDE } from './signs';

type Sinks = Ctx['sinks'];

/** A unit vector's right-angle turn in the ground plane (to the right of (ux, uz)). */
const right = (ux: number, uz: number): [number, number] => [-uz, ux];

/**
 * A flag hanging from its top hoist corner (x, y, z), flying along (ux, uz) for w and h deep, its
 * stripes top to bottom: both faces, so it reads from either side. `droop` lets the fly end sag.
 */
export function flag(b: GeoBuilder, x: number, y: number, z: number, ux: number, uz: number, w: number, h: number, cols: string[] = PRIDE, droop = 0): void {
  const [nx, nz] = right(ux, uz);
  const n = cols.length;
  for (let i = 0; i < n; i++) {
    const t0 = y - (h * i) / n;
    const t1 = y - (h * (i + 1)) / n;
    const a0: V3 = [x, t0, z];
    const a1: V3 = [x, t1, z];
    const b0: V3 = [x + ux * w, t0 - droop, z + uz * w];
    const b1: V3 = [x + ux * w, t1 - droop, z + uz * w];
    b.quad(a0, b0, b1, a1, cols[i], [nx, 0, nz]);
    b.quad(a0, b0, b1, a1, cols[i], [-nx, 0, -nz]);
  }
}

/**
 * A rainbow flag on a short pole out from a post (a lamp post, a facade) at (x, y, z): the pole leans
 * out along (ox, oz) and up, the flag hangs from it flying along the pole's way out.
 */
export function bracketFlag(S: Sinks, x: number, y: number, z: number, ox: number, oz: number, len = 1.9, w = 1.5, h = 1.0): void {
  const up = 0.45;
  const tip: V3 = [x + ox * len, y + up * len, z + oz * len];
  cyl(S.metal, [x, y, z], tip, 0.025, 0.03, 5, '#d8d8d8');
  const sphere = new THREE.SphereGeometry(0.06, 6, 4);
  sphere.translate(tip[0], tip[1], tip[2]);
  S.gloss.add(sphere, '#e0b23a');
  // The flag: from the pole's tip, back along it towards the post (hanging off the pole).
  const l = Math.hypot(ox, oz) || 1;
  flag(S.paint, tip[0] - (ox / l) * 0.05, tip[1] - 0.04, tip[2] - (oz / l) * 0.05, -ox / l, -oz / l, Math.min(w, len - 0.15), h, PRIDE, 0.12);
}

/** A rainbow banner hanging down a lamp post from two arms (the Castro's light poles carry them). */
export function poleBanner(S: Sinks, x: number, y: number, z: number, ox: number, oz: number, top: number, h = 2.1, w = 0.75): void {
  const l = Math.hypot(ox, oz) || 1;
  const ux = ox / l;
  const uz = oz / l;
  for (const yy of [top, top - h]) cyl(S.metal, [x, y + yy, z], [x + ux * (w + 0.15), y + yy, z + uz * (w + 0.15)], 0.02, 0.02, 4, '#d8d8d8');
  // Vertical stripes are wrong for the flag: it hangs as the flag, turned on its side, stripes running
  // down the banner.
  const [nx, nz] = right(ux, uz);
  const n = PRIDE.length;
  for (let i = 0; i < n; i++) {
    const a0 = 0.12 + (w * i) / n;
    const a1 = 0.12 + (w * (i + 1)) / n;
    const p = (a: number, yy: number): V3 => [x + ux * a, y + yy, z + uz * a];
    S.paint.quad(p(a0, top), p(a1, top), p(a1, top - h), p(a0, top - h), PRIDE[i], [nx, 0, nz]);
    S.paint.quad(p(a0, top), p(a1, top), p(a1, top - h), p(a0, top - h), PRIDE[i], [-nx, 0, -nz]);
  }
}

/**
 * Pride bunting: a line from a to b sagging `sag` in the middle, with a triangular pennant every
 * `step` metres in the flag's colours in turn.
 */
export function bunting(S: Sinks, a: V3, b: V3, sag: number, step = 0.7, cols = PRIDE): void {
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const n = Math.max(2, Math.round(len / step));
  const at = (f: number): V3 => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - sag * 4 * f * (1 - f), a[2] + (b[2] - a[2]) * f];
  const ux = (b[0] - a[0]) / len;
  const uz = (b[2] - a[2]) / len;
  const [nx, nz] = right(ux, uz);
  let prev = at(0);
  for (let i = 1; i <= n; i++) {
    const q = at(i / n);
    cyl(S.metal, prev, q, 0.012, 0.012, 3, '#f4f4f4');
    prev = q;
  }
  for (let i = 0; i < n; i++) {
    const p0 = at((i + 0.12) / n);
    const p1 = at((i + 0.88) / n);
    const mid = at((i + 0.5) / n);
    const tip: V3 = [mid[0], mid[1] - 0.42, mid[2]];
    const c = cols[i % cols.length];
    S.paint.tri(p0, p1, tip, c, [nx, 0, nz]);
    S.paint.tri(p0, p1, tip, c, [-nx, 0, -nz]);
  }
}

/**
 * A balloon arch over the road from l to r (its feet), rising `rise` over them: clusters of four
 * balloons all along it, in the flag's colours in bands, on a pair of weighted bases.
 */
export function balloonArch(S: Sinks, l: V3, r: V3, rise: number, rng: () => number): void {
  const n = 46;
  const span = Math.hypot(r[0] - l[0], r[2] - l[2]);
  const ux = (r[0] - l[0]) / span;
  const uz = (r[2] - l[2]) / span;
  const [nx, nz] = right(ux, uz);
  const ball = new THREE.IcosahedronGeometry(0.34, 1);
  ball.scale(1, 1.15, 1);
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const ang = Math.PI * f;
    const x = l[0] + (r[0] - l[0]) * f;
    const z = l[2] + (r[2] - l[2]) * f;
    const y = l[1] + (r[1] - l[1]) * f + Math.sin(ang) * rise;
    const col = PRIDE[Math.min(PRIDE.length - 1, Math.floor(f * PRIDE.length))];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + i * 0.7;
      const off = 0.28;
      const g = ball.clone();
      // Round the arch's line, tipped with it.
      const ox = Math.cos(a) * off;
      const oy = Math.sin(a) * off;
      g.translate(x + nx * ox - ux * oy * Math.cos(ang), y + oy * Math.sin(ang) + (rng() - 0.5) * 0.05, z + nz * ox - uz * oy * Math.cos(ang));
      S.gloss.add(g, k % 2 ? col : new THREE.Color(col).lerp(new THREE.Color('#ffffff'), 0.25).getStyle());
    }
  }
  ball.dispose();
  for (const p of [l, r]) {
    obox(S.paint, [p[0], p[1] + 0.25, p[2]], [0.9, 0.5, 0.9], [0, 0, 0], '#f4f4f4');
    obox(S.paint, [p[0], p[1] + 0.52, p[2]], [0.95, 0.06, 0.95], [0, 0, 0], '#ff4fb4');
  }
}

/** Disco balls, each its own little mesh turning in the light (they share one geometry). */
export function discoBalls(ctx: Ctx, at: V3[], r = 0.55): void {
  const geo = new THREE.IcosahedronGeometry(r, 2);
  const mat = new THREE.MeshStandardMaterial({ color: '#e9eef5', metalness: 1, roughness: 0.12, flatShading: true, emissive: '#2a2a40', emissiveIntensity: 0.25 });
  const group = new THREE.Group();
  group.name = 'discoBalls';
  const balls: THREE.Mesh[] = [];
  for (const p of at) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(p[0], p[1], p[2]);
    m.castShadow = true;
    group.add(m);
    balls.push(m);
  }
  ctx.group.add(group);
  ctx.updaters.push((_dt, t) => {
    balls.forEach((m, i) => {
      m.rotation.y = t * (0.6 + i * 0.13);
    });
  });
}

/**
 * The giant rainbow flag on Harvey Milk Plaza's flagpole, its own mesh, waving: its hoist on the pole
 * at (x, top, z), flying along (ux, uz) (downwind), w long and h deep.
 */
export function giantFlag(ctx: Ctx, x: number, top: number, z: number, ux: number, uz: number, w: number, h: number): void {
  const nu = 22;
  const nv = 2;
  const n = PRIDE.length;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const base: { u: number; v: number }[] = [];
  const c = new THREE.Color();
  for (let s = 0; s < n; s++) {
    c.set(PRIDE[s]);
    const start = pos.length / 3;
    for (let j = 0; j <= nv; j++) {
      const v = (s + j / nv) / n;
      for (let i = 0; i <= nu; i++) {
        const u = i / nu;
        base.push({ u, v });
        pos.push(0, 0, 0);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = start + j * (nu + 1) + i;
        const b = a + 1;
        const d = a + (nu + 1);
        const e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.Float32BufferAttribute(pos, 3);
  geo.setAttribute('position', attr);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'milkFlag';
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  ctx.group.add(mesh);
  const [nx, nz] = right(ux, uz);
  const arr = attr.array as Float32Array;
  const pose = (t: number): void => {
    for (let k = 0; k < base.length; k++) {
      const { u, v } = base[k];
      // Out from the pole, rippling more towards the fly; the fly droops a little.
      const wave = (Math.sin(u * 5.2 - t * 3.1) * 0.55 + Math.sin(u * 9 - t * 4.7 + v * 2) * 0.18) * u;
      const along = u * w * (1 - 0.04 * Math.sin(u * 5.2 - t * 3.1) * u);
      arr[k * 3] = x + ux * along + nx * wave;
      arr[k * 3 + 1] = top - v * h - u * u * 0.5;
      arr[k * 3 + 2] = z + uz * along + nz * wave;
    }
    attr.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  };
  pose(0);
  ctx.updaters.push((_dt, t) => pose(t));
}

/**
 * A vintage F-line streetcar (a PCC car in Muni's 1950s cream and green) standing on its rails at
 * (x, y, z), facing `h` (radians): its streamlined body, the belt of windows, the roof and its trolley
 * pole up to the wire.
 */
export function pccCar(S: Sinks, x: number, y: number, z: number, h: number, wireY: number): void {
  const m = new THREE.Matrix4().makeRotationY(-h).setPosition(x, y, z);
  const L = 14.2;
  const W = 2.55;
  const body = (g: THREE.BufferGeometry, b: GeoBuilder, color: string): void => b.add(g, color, m);
  // Lower body (green), the window band and the cream upper body, the rounded ends.
  {
    const g = new THREE.BoxGeometry(L - 2.4, 1.15, W);
    g.translate(0, 0.95, 0);
    body(g, S.gloss, '#2f6b4f');
  }
  {
    const g = new THREE.BoxGeometry(L - 2.4, 1.5, W - 0.06);
    g.translate(0, 2.25, 0);
    body(g, S.gloss, '#f1e6c8');
  }
  for (const s of [-1, 1]) {
    // (A cylinder's x is r·sin θ: the half from θ = 0 faces +x, from π faces -x.)
    const g = new THREE.CylinderGeometry(W / 2, W / 2, 2.65, 16, 1, false, s > 0 ? 0 : Math.PI, Math.PI);
    g.translate(s * (L / 2 - 1.2), 1.7, 0);
    body(g, S.gloss, '#f1e6c8');
    const b = new THREE.CylinderGeometry(W / 2 + 0.02, W / 2 + 0.02, 1.15, 16, 1, false, s > 0 ? 0 : Math.PI, Math.PI);
    b.translate(s * (L / 2 - 1.2), 0.95, 0);
    body(b, S.gloss, '#2f6b4f');
    // Headlight and the destination sign over the windscreen.
    obox(S.glow, [s * (L / 2 - 0.05), 1.15, 0], [0.08, 0.28, 0.28], [0, 0, 0], '#fff3cf', m);
    obox(S.paint, [s * (L / 2 - 0.25), 2.75, 0], [0.08, 0.32, 1.3], [0, 0, 0], '#1b1b1f', m);
  }
  // The windows down both sides.
  for (let a = -L / 2 + 1.6; a < L / 2 - 1.5; a += 1.05) {
    for (const side of [-1, 1]) obox(S.glass, [a, 2.2, side * (W / 2 + 0.01)], [0.8, 0.85, 0.04], [0, 0, 0], '#9fb3c4', m);
  }
  // The roof and its gear, the trolley pole up to the wire.
  obox(S.paint, [0, 3.08, 0], [L - 1.6, 0.18, W - 0.3], [0, 0, 0], '#9a9a94', m);
  obox(S.metal, [0, 3.3, 0], [4, 0.28, 1.2], [0, 0, 0], '#5c6168', m);
  {
    const a = new THREE.Vector3(-1.5, 3.4, 0).applyMatrix4(m);
    const tip = new THREE.Vector3(3.6, 0, 0).applyMatrix4(m);
    cyl(S.metal, [a.x, a.y, a.z], [tip.x, y + wireY, tip.z], 0.04, 0.05, 5, '#2a2c30');
  }
  // Trucks.
  for (const s of [-1, 1]) obox(S.metal, [s * 4.2, 0.35, 0], [2.4, 0.55, W - 0.4], [0, 0, 0], '#222326', m);
}

/** Pink Triangle Park's memorial: granite pylons, each topped with a pink triangle. */
export function pylon(S: Sinks, x: number, y: number, z: number, face: number): void {
  const m = new THREE.Matrix4().makeRotationY(-face).setPosition(x, y, z);
  obox(S.stone, [0, 0.55, 0], [0.42, 1.1, 0.42], [0, 0, 0], '#8b8a86', m);
  const g = new GeoBuilder();
  const tri: V3[] = [
    [0, 1.12, -0.32],
    [0, 1.12, 0.32],
    [0, 1.66, 0],
  ];
  const back = tri.map((p) => [p[0] - 0.08, p[1], p[2]] as V3);
  g.tri(tri[0], tri[1], tri[2], '#f28ab8', [1, 0, 0]);
  g.tri(back[0], back[1], back[2], '#f28ab8', [-1, 0, 0]);
  const cen: V3 = [-0.04, (1.12 + 1.12 + 1.66) / 3, 0];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    const mid: V3 = [(tri[i][0] + tri[j][0]) / 2 - 0.04, (tri[i][1] + tri[j][1]) / 2, (tri[i][2] + tri[j][2]) / 2];
    g.quad(tri[i], tri[j], back[j], back[i], '#e66fa3', [mid[0] - cen[0], mid[1] - cen[1], mid[2] - cen[2]]);
  }
  S.gloss.add(g.build(), null, m);
}

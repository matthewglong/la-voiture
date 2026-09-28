// Twin Peaks around the lap race: golden grassy hills that meet the road in embankments and
// cuttings, the two peaks with Sutro Tower on one of them, a grandstand and the start gantry on the
// straight, armco and tyre walls, eucalyptus and cypress, a few houses down in the valley, and the
// city and the Bay far below. Procedural, and merged by material to keep draw calls low.
import * as THREE from 'three';
import { TP_HW, TWIN_PEAKS } from '../maps/twinPeaks';
import { pointAt, toWorld, type CoursePoint } from '../track';
import { Crowd, type Spot } from './crowd';
import { GeoBuilder, box, cyl, meshOf, obox, prism, rbox, strip, type V3 } from './geo';
import type { MapScene } from './maps';
import { asphaltTexture, bannerTexture, checkerTexture, laneLabelTexture, tree } from './props';
import { canvasTexture, makeRng, smoothstep } from './util';

const C = TWIN_PEAKS;
const HW = TP_HW;

// ---------------------------------------------------------------------------------------------
// The ground

/** The two peaks (x, z, height, spread) and Sutro Tower's spot. */
const PEAKS: [number, number, number, number][] = [
  [262, 360, 96, 78],
  [44, 400, 84, 70],
];
const TOWER = { x: 262, z: 360 };

/** Road samples every `step` metres round the loop (x, z, y). */
function roadSamples(step: number): { x: number; z: number; y: number }[] {
  const out: { x: number; z: number; y: number }[] = [];
  for (let s = 0; s < C.length; s += step) {
    const p = pointAt(C, s);
    out.push({ x: p.x, z: p.z, y: p.y });
  }
  return out;
}

const COARSE = roadSamples(6);
const FINE = roadSamples(1);

/** Inside the loop (the infield)? */
function insideLoop(x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = COARSE.length - 1; i < COARSE.length; j = i++) {
    const a = COARSE[i];
    const b = COARSE[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** Rolling folds everywhere, bigger further out. */
function folds(x: number, z: number): number {
  const far = smoothstep(300, 1400, Math.hypot(x - 20, z - 150));
  return (2 + 18 * far) * Math.sin(x / 83 + 1.3) * Math.cos(z / 97 - 0.4) + (1 + 9 * far) * Math.sin((x + z) / 41);
}

/** The massif behind the summit: the peaks and the ridge between them, falling away to the south
 *  towards the city and the Bay. */
function massif(x: number, z: number): number {
  let h = 0;
  for (const [px, pz, ph, pr] of PEAKS) {
    const d2 = (x - px) ** 2 + (z - pz) ** 2;
    h += ph * Math.exp(-d2 / (2 * pr * pr));
  }
  return h + 30 * smoothstep(250, 620, z) - 46 * smoothstep(-160, -1300, z);
}

/** The water level of the reservoir at the bottom of the infield. */
export const RESERVOIR_Y = -9;

/**
 * The hillside the loop is cut into: rising to the north (up to the summit) and to the east,
 * falling to the west and down into the valley south of the straight. It roughly follows the
 * road's own heights, so round the loop the road runs through cuttings and along embankments.
 */
function hillside(x: number, z: number): number {
  const up = 27 * smoothstep(-40, 320, z) * (0.55 + 0.45 * smoothstep(-220, 120, x));
  const east = 0.12 * Math.max(0, x - 150) * smoothstep(-60, 120, z);
  const valley = -9 * smoothstep(0, -140, z);
  return up + east + valley;
}

/**
 * Ground height. Outside the loop, the hillside with the peaks behind it; inside, a bowl with
 * the reservoir at the bottom. Right by the road it's the road's own height (the verge), less a
 * little, and it meets the landscape in a short steep bank (a cutting, or an embankment).
 */
function groundAt(x: number, z: number): number {
  // Nearest road sample, coarsely, then finely when it's close.
  let best = Infinity;
  let bestY = 0;
  for (const p of COARSE) {
    const d2 = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d2 < best) {
      best = d2;
      bestY = p.y;
    }
  }
  let dist = Math.sqrt(best);
  if (dist < 40) {
    best = Infinity;
    for (const p of FINE) {
      const d2 = (x - p.x) ** 2 + (z - p.z) ** 2;
      if (d2 < best) {
        best = d2;
        bestY = p.y;
      }
    }
    dist = Math.sqrt(best);
  }
  // The road's height carried out into the landscape (inverse-distance weighted).
  let wsum = 0;
  let ysum = 0;
  for (const p of COARSE) {
    const w = 1 / ((x - p.x) ** 2 + (z - p.z) ** 2 + 100);
    wsum += w;
    ysum += w * p.y;
  }
  const carried = ysum / wsum;
  const off = Math.max(0, dist - (HW + 1.6));
  let land: number;
  if (insideLoop(x, z)) {
    // The infield bowl.
    land = carried - 22 * (1 - Math.exp(-off / 34)) + 0.4 * folds(x, z) * smoothstep(10, 60, off);
  } else {
    // (The peaks rise beyond the roadside, not straight out of it.)
    land = hillside(x, z) + (massif(x, z) + folds(x, z)) * smoothstep(4, 70, off);
  }
  // The bank down (or up) from the verge: wider the bigger the drop, so it's never a cliff.
  const verge = bestY - 0.12;
  const bank = Math.max(4, Math.abs(land - verge) * 1.3);
  return verge + (land - verge) * smoothstep(HW + 1.0, HW + 1.0 + bank, dist);
}

/** Grid lines: fine over the course, spreading out towards the horizon. */
function axis(lo: number, hi: number, step: number, reach: number): number[] {
  const out: number[] = [];
  for (let v = lo; v <= hi + 1e-6; v += step) out.push(v);
  let d = step;
  let v = hi;
  while (v < reach) {
    d *= 1.16;
    v += d;
    out.push(v);
  }
  d = step;
  v = lo;
  while (v > -reach) {
    d *= 1.16;
    v -= d;
    out.unshift(v);
  }
  return out;
}

function buildGround(): { mesh: THREE.Mesh; height: (x: number, z: number) => number } {
  const xs = axis(-260, 380, 4, 4200);
  const zs = axis(-180, 520, 4, 4200);
  const nx = xs.length;
  const nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  const heights = new Float32Array(nx * nz);
  const rng = makeRng(7);
  const cGrass = new THREE.Color('#9fb65c');
  const cGold = new THREE.Color('#cbb766');
  const cVerge = new THREE.Color('#86ad55');
  const cRock = new THREE.Color('#a39a86');
  const tmp = new THREE.Color();
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = xs[i];
      const z = zs[j];
      const y = groundAt(x, z);
      const k = j * nx + i;
      heights[k] = y;
      pos[k * 3] = x;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = z;
      // Golden grass on the high ground, greener low down and on the verges.
      const gold = smoothstep(4, 40, y) * (0.6 + 0.4 * Math.sin(x / 37 + z / 53));
      tmp.copy(cGrass).lerp(cGold, Math.max(0, Math.min(1, gold)));
      let near = Infinity;
      for (const p of COARSE) near = Math.min(near, (x - p.x) ** 2 + (z - p.z) ** 2);
      tmp.lerp(cVerge, 1 - smoothstep(HW + 2, HW + 14, Math.sqrt(near)));
      if (y > 70) tmp.lerp(cRock, smoothstep(70, 110, y) * 0.6);
      tmp.multiplyScalar(0.94 + rng() * 0.1);
      col[k * 3] = tmp.r;
      col[k * 3 + 1] = tmp.g;
      col[k * 3 + 2] = tmp.b;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Steep banks and cuttings show bare earth.
  {
    const nrm = g.getAttribute('normal');
    const dirt = new THREE.Color('#b59d76');
    for (let k = 0; k < nx * nz; k++) {
      const f = smoothstep(0.93, 0.72, nrm.getY(k));
      if (f <= 0) continue;
      tmp.setRGB(col[k * 3], col[k * 3 + 1], col[k * 3 + 2]).lerp(dirt, f * 0.85);
      col[k * 3] = tmp.r;
      col[k * 3 + 1] = tmp.g;
      col[k * 3 + 2] = tmp.b;
    }
  }
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }));
  mesh.name = 'ground';
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  // Height anywhere on the grid (bilinear), for standing things on the ground.
  const find = (arr: number[], v: number): number => {
    let lo = 0;
    let hi = arr.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= v) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  const height = (x: number, z: number): number => {
    const i = Math.min(nx - 2, find(xs, x));
    const j = Math.min(nz - 2, find(zs, z));
    const fx = Math.min(1, Math.max(0, (x - xs[i]) / (xs[i + 1] - xs[i])));
    const fz = Math.min(1, Math.max(0, (z - zs[j]) / (zs[j + 1] - zs[j])));
    const h00 = heights[j * nx + i];
    const h10 = heights[j * nx + i + 1];
    const h01 = heights[(j + 1) * nx + i];
    const h11 = heights[(j + 1) * nx + i + 1];
    return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
  };
  return { mesh, height };
}

// ---------------------------------------------------------------------------------------------
// Road and trackside

/** Course samples every half metre, round the loop and back onto the first. */
function loopPts(): CoursePoint[] {
  const out: CoursePoint[] = [];
  for (let i = 0; i < C.points.length; i += 2) out.push(C.points[i]);
  const last = C.points[C.points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/** Samples between two arc lengths (every half metre). */
function span(s0: number, s1: number, step = 0.5): CoursePoint[] {
  const out: CoursePoint[] = [];
  for (let s = s0; s <= s1 + 1e-6; s += step) out.push(pointAt(C, s));
  return out;
}

function kerbTexture(): THREE.CanvasTexture {
  // One tile = 2 m along: a red and a white block.
  return canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e8322a';
    ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = '#f7f7f2';
    ctx.fillRect(0, h / 2, w, h / 2);
  }, { repeat: [1, 1] });
}

function towerBand(b: GeoBuilder, a: V3, c: V3, r: number, bands: number): void {
  for (let k = 0; k < bands; k++) {
    const f0 = k / bands;
    const f1 = (k + 1) / bands;
    const p0: V3 = [a[0] + (c[0] - a[0]) * f0, a[1] + (c[1] - a[1]) * f0, a[2] + (c[2] - a[2]) * f0];
    const p1: V3 = [a[0] + (c[0] - a[0]) * f1, a[1] + (c[1] - a[1]) * f1, a[2] + (c[2] - a[2]) * f1];
    cyl(b, p0, p1, r, r, 8, k % 2 ? '#f4f1ea' : '#d8392f');
  }
}

/** Sutro Tower: three red-and-white legs that pinch in at the waist and splay out to three prongs. */
function buildSutro(b: GeoBuilder, x: number, y: number, z: number, lights: THREE.Vector3[]): void {
  const H = 118;
  const waist = 0.46 * H;
  const legs = [0, 1, 2].map((k) => (k / 3) * Math.PI * 2 + 0.4);
  for (const a of legs) {
    const foot: V3 = [x + Math.cos(a) * 17, y, z + Math.sin(a) * 17];
    const mid: V3 = [x + Math.cos(a) * 4.5, y + waist, z + Math.sin(a) * 4.5];
    const top: V3 = [x + Math.cos(a) * 12, y + H, z + Math.sin(a) * 12];
    towerBand(b, foot, mid, 0.85, 7);
    towerBand(b, mid, top, 0.6, 7);
    cyl(b, [top[0], top[1], top[2]], [top[0], top[1] + 14, top[2]], 0.35, 0.45, 6, '#f4f1ea');
    lights.push(new THREE.Vector3(top[0], top[1] + 14.5, top[2]));
    box(b, foot[0] - 1.6, foot[0] + 1.6, y - 1, y + 1.2, foot[2] - 1.6, foot[2] + 1.6, '#c9c2b2');
  }
  // Cross bracing: platforms at a few heights.
  for (const f of [0.22, 0.46, 0.66, 0.84, 1]) {
    const hy = y + H * f;
    const r = f < 0.46 ? 17 + (4.5 - 17) * (f / 0.46) : 4.5 + (12 - 4.5) * ((f - 0.46) / 0.54);
    for (let k = 0; k < 3; k++) {
      const a0 = legs[k];
      const a1 = legs[(k + 1) % 3];
      cyl(b, [x + Math.cos(a0) * r, hy, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, hy, z + Math.sin(a1) * r], 0.32, 0.32, 6, f === 1 ? '#d8392f' : '#e9e4da');
    }
  }
}

/** A toy house: a pastel box with a gable roof, windows and a door, facing `ang`. */
function house(walls: GeoBuilder, roofs: GeoBuilder, x: number, y: number, z: number, ang: number, rng: () => number): void {
  const colors = ['#f2c5c9', '#bfe0ea', '#f6e2a8', '#cfe8c4', '#e4d2f0', '#f7d3b5', '#ffffff'];
  const w = 7 + rng() * 3;
  const d = 8 + rng() * 3;
  const h = 5 + rng() * 2.5;
  const m = new THREE.Matrix4().makeRotationY(-ang).setPosition(x, y, z);
  rbox(walls, -w / 2, w / 2, -1, h, -d / 2, d / 2, 0.25, colors[Math.floor(rng() * colors.length)], m);
  const roof: V3[] = [
    [-w / 2 - 0.4, h, -d / 2 - 0.3],
    [w / 2 + 0.4, h, -d / 2 - 0.3],
    [0, h + 2.6, -d / 2 - 0.3],
  ];
  prism(roofs, roof, [0, 0, d + 0.6], rng() < 0.5 ? '#8d6f62' : '#6f7b88', m);
  // Windows and a door on the front.
  for (const wx of [-w / 4, w / 4]) box(walls, wx - 0.7, wx + 0.7, h * 0.45, h * 0.45 + 1.3, d / 2, d / 2 + 0.06, '#35506e', m);
  box(walls, -0.55, 0.55, 0, 2.1, d / 2, d / 2 + 0.07, '#b3263a', m);
}

/** A cypress: a dark green spire. */
function cypress(b: GeoBuilder, x: number, y: number, z: number, s: number): void {
  cyl(b, [x, y - 0.3, z], [x, y + 1.2 * s, z], 0.14 * s, 0.2 * s, 6, '#6b4f36');
  const g = new THREE.ConeGeometry(1.25 * s, 6.5 * s, 7);
  g.translate(x, y + 4.2 * s, z);
  b.add(g, '#3d6e45');
}

// ---------------------------------------------------------------------------------------------
// Build

export function buildTwinPeaks(): MapScene {
  const group = new THREE.Group();
  group.name = 'twin-peaks';
  const rng = makeRng(1932);

  const ground = buildGround();
  group.add(ground.mesh);
  const gh = ground.height;
  // The reservoir at the bottom of the infield (the ground hides all but the flooded hollow).
  {
    let cx = 0;
    let cz = 0;
    for (const p of COARSE) {
      cx += p.x / COARSE.length;
      cz += p.z / COARSE.length;
    }
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(170, 48).rotateX(-Math.PI / 2).translate(cx, RESERVOIR_Y, cz),
      new THREE.MeshStandardMaterial({ color: '#4d86a6', roughness: 0.18, metalness: 0.15 }),
    );
    water.name = 'reservoir';
    water.receiveShadow = true;
    group.add(water);
  }

  const asphaltMat = new THREE.MeshStandardMaterial({ map: asphaltTexture(), vertexColors: true, roughness: 0.92 });
  const markMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const kerbMat = new THREE.MeshStandardMaterial({ map: kerbTexture(), roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const metalMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.32 });
  const paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
  const foliageMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true });
  const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
  const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const towerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.2 });
  const cityMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });

  const asphalt = new GeoBuilder();
  const marks = new GeoBuilder();
  const kerbs = new GeoBuilder();
  const metal = new GeoBuilder();
  const paint = new GeoBuilder();
  const foliage = new GeoBuilder();
  const walls = new GeoBuilder();
  const roofs = new GeoBuilder();
  const tower = new GeoBuilder();
  const city = new GeoBuilder();
  const crowdSpots: Spot[] = [];

  // --- The road: asphalt with skirts down into the ground, edge lines, kerbs on the corners -------
  const pts = loopPts();
  strip(asphalt, pts, -HW, HW, (i) => pts[i].y + 0.03, '#ffffff', { uvScale: 6, sides: true, bottom: (i) => pts[i].y - 1.6 });
  for (const side of [-1, 1]) {
    const d0 = side * (HW - 0.55);
    strip(marks, pts, Math.min(d0, d0 + side * 0.16), Math.max(d0, d0 + side * 0.16), (i) => pts[i].y + 0.045, '#f5f5ef');
  }
  // How hard the road bends at a sample (1/m, + to the right), over 8 m of road so a wobble in the
  // spline doesn't count as a corner.
  const P = C.points;
  const segs = P.length - 1;
  const bend = (i: number): number => {
    const a = P[(((i - 16) % segs) + segs) % segs];
    const b = P[(i + 16) % segs];
    let dh = b.heading - a.heading;
    dh -= Math.round(dh / (2 * Math.PI)) * 2 * Math.PI;
    return dh / 8;
  };
  // Kerbs through the corners: along the inside, and the outside where it's tight.
  {
    let i = 0;
    while (i < segs) {
      if (Math.abs(bend(i)) < 1 / 70) {
        i++;
        continue;
      }
      let j = i;
      let peak = 0;
      while (j < segs && Math.abs(bend(j)) >= 1 / 90) {
        if (Math.abs(bend(j)) > Math.abs(peak)) peak = bend(j);
        j++;
      }
      const run = span(P[i].s - 4, P[j].s + 4, 0.5);
      const inside = peak > 0 ? 1 : -1;
      const sides = Math.abs(peak) > 1 / 30 ? [1, -1] : [inside];
      for (const side of sides) {
        const a = side * (HW - 1.05);
        const b = side * (HW - 0.05);
        strip(kerbs, run, Math.min(a, b), Math.max(a, b), (k) => run[k].y + 0.075, '#ffffff', { uvScale: 2 });
      }
      i = j + 1;
    }
  }

  // --- Walls: tyre walls round the outside of the tight bends, armco everywhere else there's a
  // wall, and a low kerbstone where the road just runs onto the grass -----------------------------
  const tyreAt: { x: number; y: number; z: number; i: number }[] = [];
  {
    for (const side of [-1, 1] as const) {
      const edgeOf = (p: CoursePoint): string => (side > 0 ? p.edgeR : p.edgeL);
      // Tyres where it's the outside of a tight bend (it turns away from this side).
      const tyres = (i: number): boolean => edgeOf(P[i]) === 'barrier' && bend(i) * side < -1 / 55;
      // Armco: posts every 2.5 m, two rails between them.
      let prev: { x: number; y: number; z: number } | null = null;
      for (let i = 0; i < P.length; i += 10) {
        const p = P[i];
        const e = edgeOf(p);
        if ((e !== 'rail' && e !== 'barrier') || tyres(i % segs)) {
          prev = null;
          continue;
        }
        const d = side * (HW + 0.35);
        const x = p.x - p.tz * d;
        const z = p.z + p.tx * d;
        const y = p.y;
        box(metal, x - 0.07, x + 0.07, y - 0.4, y + 0.85, z - 0.07, z + 0.07, '#9aa1a9');
        if (prev) {
          const len = Math.hypot(x - prev.x, z - prev.z);
          const ang = -Math.atan2(z - prev.z, x - prev.x);
          const pitch = Math.atan2(y - prev.y, len);
          for (const h of [0.5, 0.78]) {
            obox(metal, [(x + prev.x) / 2, (y + prev.y) / 2 + h, (z + prev.z) / 2], [len + 0.05, 0.2, 0.05], [0, ang, pitch], '#d9dee4');
          }
        }
        prev = { x, y, z };
      }
      // Tyre stacks every 0.72 m.
      let n = 0;
      for (let s = 0; s < C.length; s += 0.72) {
        const i = Math.floor(s / 0.25) % segs;
        if (!tyres(i)) continue;
        const p = pointAt(C, s);
        const d = side * (HW + 0.45);
        tyreAt.push({ x: p.x - p.tz * d, y: p.y, z: p.z + p.tx * d, i: n++ });
      }
      // Kerbstones where the road just runs onto the grass.
      const kerbRun: CoursePoint[] = [];
      const flush = (): void => {
        if (kerbRun.length > 1) {
          const a = side * HW;
          const b = side * (HW + 0.3);
          strip(paint, kerbRun, Math.min(a, b), Math.max(a, b), (k) => kerbRun[k].y + 0.18, '#dcd6c9', { sides: true, bottom: (k) => kerbRun[k].y - 0.3 });
        }
        kerbRun.length = 0;
      };
      for (let i = 0; i < P.length; i += 2) {
        if (edgeOf(P[i]) === 'curb') kerbRun.push(P[i]);
        else flush();
      }
      flush();
    }
  }
  // The tyres, three to a stack, instanced (there are thousands).
  {
    const geo = new THREE.TorusGeometry(0.32, 0.15, 5, 10);
    geo.rotateX(Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshPhysicalMaterial({ roughness: 0.45, clearcoat: 0.4 }), tyreAt.length * 3);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    const colors = ['#1e1f22', '#e8322a', '#f4f4ef'];
    tyreAt.forEach((t, k) => {
      for (let j = 0; j < 3; j++) {
        m.makeTranslation(t.x, t.y + 0.15 + j * 0.29, t.z);
        mesh.setMatrixAt(k * 3 + j, m);
        mesh.setColorAt(k * 3 + j, c.set(j === 1 ? colors[1 + (t.i % 2)] : colors[0]));
      }
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'tyreWalls';
    mesh.computeBoundingSphere();
    group.add(mesh);
  }

  // --- Start/finish: the chequered line, the grid, the gantry and the grandstand -------------------
  const sp = pointAt(C, C.startS);
  {
    const g = new THREE.PlaneGeometry(0.9, 2 * HW - 0.4);
    g.rotateX(-Math.PI / 2);
    g.rotateY(-sp.heading);
    g.translate(sp.x, sp.y + 0.05, sp.z);
    const line = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: checkerTexture(2, 34), roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    line.name = 'startLine';
    line.receiveShadow = true;
    group.add(line);
    const laneMat = new THREE.MeshStandardMaterial({ map: laneLabelTexture(), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
    C.grid.forEach((slot, i) => {
      const lg = new THREE.PlaneGeometry(3.0, 3.0);
      const uv = lg.getAttribute('uv');
      for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / 2);
      lg.rotateX(-Math.PI / 2);
      lg.rotateY(-Math.PI / 2 - sp.heading);
      const w = toWorld(C, slot.s - 3.2, slot.d);
      lg.translate(w.x, w.y + 0.05, w.z);
      const label = new THREE.Mesh(lg, laneMat);
      label.receiveShadow = true;
      label.name = `laneLabel${i + 1}`;
      group.add(label);
    });
  }
  const gantry = new THREE.Group();
  gantry.name = 'startGantry';
  const flags: { mesh: THREE.Mesh; base: Float32Array; phase: number }[] = [];
  {
    const gb = new GeoBuilder();
    const topY = 8.1;
    const post = HW + 1.9;
    for (const dz of [-post, post]) {
      rbox(gb, -0.25, 0.25, 0, topY + 0.3, dz - 0.25, dz + 0.25, 0.08, '#f7f7f2');
      box(gb, -0.4, 0.4, -0.4, 0.3, dz - 0.4, dz + 0.4, '#2b2f36');
    }
    rbox(gb, -0.3, 0.3, topY - 0.45, topY + 0.1, -post - 0.3, post + 0.3, 0.08, '#2b2f36');
    gantry.add(meshOf(gb, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.6 }), 'gantryFrame', true, true));
    const banner = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.75, 2 * HW + 0.4), new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.55 }));
    banner.position.set(0, topY - 1.45, 0);
    banner.castShadow = true;
    banner.name = 'gantryBanner';
    gantry.add(banner);
    const flagMat = new THREE.MeshStandardMaterial({ map: checkerTexture(6, 4), roughness: 0.6, side: THREE.DoubleSide });
    for (const [i, dz] of [
      [0, -post],
      [1, post],
    ] as const) {
      const g = new THREE.PlaneGeometry(1.8, 1.2, 12, 4);
      g.translate(0.9, 0, 0);
      const mesh = new THREE.Mesh(g, flagMat);
      mesh.position.set(0, topY + 0.9, dz);
      mesh.rotation.y = dz < 0 ? 0.35 : -0.35 + Math.PI;
      mesh.castShadow = true;
      mesh.name = `startFlag${i + 1}`;
      gantry.add(mesh);
      flags.push({ mesh, base: Float32Array.from(g.getAttribute('position').array as ArrayLike<number>), phase: i * 1.7 });
    }
    gantry.position.set(sp.x, sp.y, sp.z);
    gantry.rotation.y = -sp.heading;
  }
  group.add(gantry);
  // The grandstand on the outside of the straight, tiers of fans under a roof.
  {
    const s0 = C.startS - 40;
    const s1 = C.startS + 40;
    const d0 = -(HW + 5);
    const tiers = 7;
    for (let s = s0; s < s1; s += 2) {
      const p = pointAt(C, s);
      const q = pointAt(C, s + 2);
      for (let k = 0; k < tiers; k++) {
        const dA = d0 - k * 1.4;
        const dB = dA - 1.4;
        const y = p.y + 0.6 + k * 0.75;
        const corners = [
          [p.x - p.tz * dA, p.z + p.tx * dA],
          [q.x - q.tz * dA, q.z + q.tx * dA],
          [q.x - q.tz * dB, q.z + q.tx * dB],
          [p.x - p.tz * dB, p.z + p.tx * dB],
        ];
        const poly: V3[] = corners.map(([x, z]) => [x, p.y - 1, z]);
        prism(paint, poly, [0, y - p.y + 1, 0], k % 2 ? '#dfe4ea' : '#c9d0d8');
        if (rng() < 0.85) {
          const dd = (dA + dB) / 2;
          crowdSpots.push({ x: p.x - p.tz * dd, y, z: p.z + p.tx * dd, face: p.heading + Math.PI / 2 + (rng() - 0.5) * 0.5 });
        }
      }
    }
    // The roof on posts.
    const roofY = sp.y + 0.6 + tiers * 0.75 + 3.2;
    const pa = pointAt(C, s0);
    const pb = pointAt(C, s1);
    for (const p of [pa, sp, pb]) {
      for (const d of [d0 - 0.3, d0 - tiers * 1.4]) {
        const x = p.x - p.tz * d;
        const z = p.z + p.tx * d;
        cyl(metal, [x, p.y - 0.5, z], [x, roofY, z], 0.18, 0.2, 8, '#e3e7ec');
      }
    }
    const dm = d0 - (tiers * 1.4) / 2;
    const cx = sp.x - sp.tz * dm;
    const cz = sp.z + sp.tx * dm;
    obox(paint, [cx, roofY + 0.2, cz], [s1 - s0 + 4, 0.4, tiers * 1.4 + 3], [0, -sp.heading, 0], '#e8322a');
  }

  // --- Fans at the corners, behind the tyres -------------------------------------------------------
  for (const name of ['Turn 1', 'Summit Hairpin', 'Chicane', 'The Sweeper']) {
    const sec = C.sections.find((q) => q.name === name)!;
    for (let k = 0; k < 40; k++) {
      const s = sec.s0 + rng() * (sec.s1 - sec.s0);
      const p = pointAt(C, s);
      const side = p.curv > 0 ? -1 : 1;
      const dd = side * (HW + 3 + rng() * 5);
      const x = p.x - p.tz * dd;
      const z = p.z + p.tx * dd;
      crowdSpots.push({ x, y: gh(x, z), z, face: p.heading - (side * Math.PI) / 2 + (rng() - 0.5) * 0.6 });
    }
  }

  // --- Trees, clear of the road ---------------------------------------------------------------------
  const clearOfRoad = (x: number, z: number, r: number): boolean => {
    for (const p of COARSE) if ((x - p.x) ** 2 + (z - p.z) ** 2 < r * r) return false;
    return true;
  };
  for (let k = 0; k < 900; k++) {
    const x = -360 + rng() * 800;
    const z = -260 + rng() * 820;
    if (!clearOfRoad(x, z, HW + 9)) continue;
    if (Math.hypot(x - TOWER.x, z - TOWER.z) < 26) continue;
    const y = gh(x, z);
    // Not in the reservoir, nor on the bare tops of the peaks.
    if (y < RESERVOIR_Y + 0.8 || y > 95) continue;
    // Eucalyptus groves in the gullies, cypresses on the slopes.
    if (rng() < 0.55) tree(foliage, x, y - 0.2, z, 1.4 + rng() * 1.2, rng);
    else cypress(foliage, x, y, z, 0.9 + rng() * 0.6);
  }

  // --- Houses down in the valley, beyond the grandstand ----------------------------------------------
  for (let k = 0; k < 60; k++) {
    const row = k % 3;
    const x = -240 + Math.floor(k / 3) * 26 + rng() * 6;
    const z = -58 - row * 24 - rng() * 4;
    if (!clearOfRoad(x, z, HW + 14)) continue;
    house(walls, roofs, x, gh(x, z), z, Math.PI / 2 + (row === 1 ? Math.PI : 0), rng);
  }

  // --- Sutro Tower on the eastern peak, with blinking lamps --------------------------------------------
  const lamps: THREE.Vector3[] = [];
  buildSutro(tower, TOWER.x, gh(TOWER.x, TOWER.z), TOWER.z, lamps);
  const lampMat = new THREE.MeshStandardMaterial({ color: '#ff3b2f', emissive: '#ff2a1a', emissiveIntensity: 2 });
  const lampGeo = new THREE.SphereGeometry(0.9, 10, 8);
  const lampMeshes = lamps.map((v) => {
    const m = new THREE.Mesh(lampGeo, lampMat);
    m.position.copy(v);
    group.add(m);
    return m;
  });

  // --- The city and the Bay, far below to the north ---------------------------------------------------
  {
    const crng = makeRng(94);
    const tones = ['#e9e4d8', '#d8dde3', '#f1e6d0', '#cfd6dd', '#e6d7c8', '#bfc7cf'];
    for (let k = 0; k < 520; k++) {
      const x = -900 + crng() * 1900;
      const z = -700 - crng() * 1100;
      const downtown = Math.exp(-((x - 380) ** 2 + (z + 1450) ** 2) / (2 * 260 * 260));
      const h = 6 + crng() * 14 + downtown * (30 + crng() * 90);
      const w = 10 + crng() * 18;
      const y = gh(x, z);
      if (y < -32) continue;
      box(city, x - w / 2, x + w / 2, y - 2, y + h, z - w / 2, z + w / 2, tones[Math.floor(crng() * tones.length)]);
    }
    // The Transamerica Pyramid and the Salesforce Tower.
    {
      const x = 330;
      const z = -1500;
      const y = gh(x, z);
      const g = new THREE.ConeGeometry(16, 150, 4);
      g.rotateY(Math.PI / 4);
      g.translate(x, y + 75, z);
      city.add(g, '#f2efe6');
    }
    {
      const x = 440;
      const z = -1380;
      const y = gh(x, z);
      cyl(city, [x, y, z], [x, y + 170, z], 13, 16, 16, '#dcd3c2');
      const cap = new THREE.SphereGeometry(13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      cap.scale(1, 0.7, 1);
      cap.translate(x, y + 170, z);
      city.add(cap, '#dcd3c2');
    }
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(9000, 5000).rotateX(-Math.PI / 2).translate(0, -34, -3300),
      new THREE.MeshStandardMaterial({ color: '#5c8fae', roughness: 0.25, metalness: 0.1 }),
    );
    water.name = 'bayWater';
    water.receiveShadow = false;
    group.add(water);
  }

  // --- Assemble ---------------------------------------------------------------------------------------
  const crowd = new Crowd(crowdSpots, rng);
  group.add(crowd.group);
  group.add(meshOf(asphalt, asphaltMat, 'asphalt', false, true));
  group.add(meshOf(marks, markMat, 'markings', false, true));
  group.add(meshOf(kerbs, kerbMat, 'kerbs', false, true));
  group.add(meshOf(metal, metalMat, 'armco', true, true));
  group.add(meshOf(paint, paintMat, 'trackside', true, true));
  group.add(meshOf(foliage, foliageMat, 'trees', true, true));
  group.add(meshOf(walls, wallMat, 'houses', true, true));
  group.add(meshOf(roofs, roofMat, 'roofs', true, true));
  group.add(meshOf(tower, towerMat, 'sutroTower', true, true));
  group.add(meshOf(city, cityMat, 'distantCity', false, false));

  const update = (dt: number, t: number, cars: { x: number; z: number }[]): void => {
    for (const f of flags) {
      const pos = f.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const x = f.base[i * 3];
        const y = f.base[i * 3 + 1];
        const amp = 0.18 * (x / 1.8);
        arr[i * 3 + 2] = f.base[i * 3 + 2] + Math.sin(t * 5 + x * 3.2 + f.phase) * amp + Math.sin(t * 3.1 + y * 2) * 0.03 * x;
      }
      pos.needsUpdate = true;
      f.mesh.geometry.computeVertexNormals();
    }
    crowd.update(dt, t, cars);
    const on = Math.sin(t * 2.4) > 0.2;
    for (const m of lampMeshes) m.visible = on;
  };

  return { group, gantry, update };
}

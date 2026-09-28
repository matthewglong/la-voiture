// "Talking Heads" (Oleg Lobykin, 2019), on Patricia's Green since January 2025: an 18 ft tall
// mirror-polished stainless steel totem, 7'6" square in plan. Here two crossed slabs, each edge of
// each one a stack of three faces in profile (brow, nose, lips, chin) looking outwards, with oval
// voids between them and the spine where the slabs cross, a column of heads stacked one on the
// next, all of it in the shiny paint (the gloss sink), on a low concrete plinth.
import * as THREE from 'three';
import { cyl } from '../../geo';
import type { Kit } from './kit';

/** Catmull-Rom through points (closed), `n` samples per span. */
function smooth(pts: [number, number][], n: number): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  const m = pts.length;
  for (let i = 0; i < m; i++) {
    const p0 = pts[(i - 1 + m) % m];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % m];
    const p3 = pts[(i + 2) % m];
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number): number => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push(new THREE.Vector2(f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])));
    }
  }
  return out;
}

/** One side's profile, bottom to top: three heads stacked, each looking outwards (x > 0). */
const PROFILE: [number, number][] = [
  [1.12, 0.06],
  [0.86, 0.34],
  // Head one: neck, chin, lips, nose, eye, brow, forehead, crown.
  [0.6, 0.56],
  [0.88, 0.8],
  [0.95, 1.0],
  [0.86, 1.1],
  [1.16, 1.32],
  [0.9, 1.45],
  [1.03, 1.62],
  [0.9, 1.84],
  [0.66, 1.98],
  // Head two.
  [0.6, 2.12],
  [0.87, 2.34],
  [0.94, 2.53],
  [0.85, 2.63],
  [1.12, 2.85],
  [0.88, 2.98],
  [1.0, 3.14],
  [0.87, 3.36],
  [0.62, 3.52],
  // Head three, and the crown.
  [0.55, 3.66],
  [0.8, 3.88],
  [0.88, 4.05],
  [0.8, 4.14],
  [1.04, 4.36],
  [0.84, 4.48],
  [0.94, 4.63],
  [0.78, 4.88],
  [0.46, 5.16],
  [0.16, 5.34],
];

let panel: THREE.BufferGeometry | null = null;

/** One slab: the profile both sides (mirrored), the voids, extruded with rounded edges; centred
 *  on x = 0, z = 0, standing on y = 0. */
function slab(): THREE.BufferGeometry {
  if (panel) return panel.clone();
  const right = PROFILE;
  const left = PROFILE.map(([x, y]) => [-x, y] as [number, number]).reverse();
  const outline = smooth([...right, [0, 5.42], ...left, [0, 0.02]], 2);
  const shape = new THREE.Shape(outline);
  for (const cy of [1.28, 2.78, 4.28]) {
    for (const cx of [-0.5, 0.5]) {
      const hole = new THREE.Path();
      const rx = 0.2;
      const ry = cy > 4 ? 0.3 : 0.36;
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i < 12; i++) {
        const a = (-i / 12) * Math.PI * 2;
        pts.push(new THREE.Vector2(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry));
      }
      hole.setFromPoints(pts);
      shape.holes.push(hole);
    }
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -0.1);
  panel = g;
  return g.clone();
}

/** The sculpture at (x, y, z), one slab turned to face `face` (radians). */
export function talkingHeads(k: Kit, x: number, y: number, z: number, face: number): void {
  const S = k.S;
  const steel = '#f1f4f8';
  // The plinth.
  cyl(S.concrete, [x, y - 0.3, z], [x, y + 0.22, z], 1.45, 1.5, 20, '#cbc4b6');
  cyl(S.metal, [x, y + 0.22, z], [x, y + 0.27, z], 1.2, 1.2, 20, '#9aa2aa');
  const base = y + 0.27;
  for (const turn of [0, Math.PI / 2]) {
    const g = slab();
    // The slab's face is its local +z; turn it to `face`, then the other a quarter on.
    g.rotateY(Math.PI / 2 - face + turn);
    g.translate(x, base, z);
    S.gloss.add(g, steel);
  }
  // The spine: heads stacked one on the next where the slabs cross.
  const heads: [number, number][] = [
    [0.55, 0.3],
    [1.3, 0.34],
    [2.05, 0.3],
    [2.8, 0.34],
    [3.55, 0.29],
    [4.3, 0.31],
    [5.0, 0.26],
  ];
  for (const [hy, r] of heads) {
    const g = new THREE.SphereGeometry(r, 10, 7);
    g.scale(1, 1.3, 1);
    g.translate(x, base + hy, z);
    S.gloss.add(g, steel);
  }
  const top = new THREE.SphereGeometry(0.19, 10, 8);
  top.scale(1, 1.5, 1);
  top.translate(x, base + 5.55, z);
  S.gloss.add(top, steel);
}

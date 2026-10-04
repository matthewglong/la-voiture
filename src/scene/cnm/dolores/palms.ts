// Palms for Dolores St and Dolores Park: the tall Canary Island date palms down Dolores St's median (a
// thick, slightly swollen trunk under a round head of long arching fronds and a knob of old leaf bases)
// and, smaller, the park's Chilean wine palms. Merged into the scenery's builders.
import * as THREE from 'three';
import { cyl, type GeoBuilder, type V3 } from '../../geo';

const FROND = ['#3f7d3a', '#4a8a40', '#3b7436', '#56913f'];
const OLD = ['#7f8f3c', '#93944a'];

/**
 * A palm at (x, y, z), `h` metres to the base of its crown: the trunk (`trunk` builder), the fronds
 * (`leaves`), `n` of them, the outer ones drooping. `r` is the trunk's radius at its foot.
 */
export function palm(trunk: GeoBuilder, leaves: GeoBuilder, x: number, y: number, z: number, h: number, r: number, n: number, rng: () => number): void {
  // A slight lean and a swollen foot.
  const lean = rng() * Math.PI * 2;
  const lx = Math.cos(lean) * h * 0.03;
  const lz = Math.sin(lean) * h * 0.03;
  const top: V3 = [x + lx, y + h, z + lz];
  cyl(trunk, [x, y - 0.3, z], [x + lx * 0.3, y + h * 0.3, z + lz * 0.3], r * 0.86, r * 1.18, 9, '#76634c');
  cyl(trunk, [x + lx * 0.3, y + h * 0.3, z + lz * 0.3], top, r * 0.78, r * 0.86, 9, '#7d6a52');
  // The knob of old leaf bases under the crown.
  const knob = new THREE.IcosahedronGeometry(r * 1.6, 0);
  knob.scale(1, 0.9, 1);
  knob.translate(top[0], top[1] + r * 0.6, top[2]);
  trunk.add(knob, '#8b7a4c');
  // The fronds: arching out and down, both faces (they're seen from below as often as above).
  const L = h * 0.42 + 2.2;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // Upper fronds stand up; the rest arch over and droop.
    const up = k % 3 === 0 ? 0.65 : k % 3 === 1 ? 0.25 : -0.1;
    const len = L * (0.85 + rng() * 0.3);
    const base: V3 = [top[0] + ca * r * 0.6, top[1] + r * 1.1, top[2] + sa * r * 0.6];
    const mid: V3 = [base[0] + ca * len * 0.5, base[1] + len * (0.28 + up * 0.5), base[2] + sa * len * 0.5];
    const tip: V3 = [base[0] + ca * len * 0.95, base[1] + len * (up * 0.4 - 0.22), base[2] + sa * len * 0.95];
    // Across the frond (horizontal, square to it).
    const wx = -sa;
    const wz = ca;
    const w0 = 0.18;
    const w1 = 0.62 + rng() * 0.2;
    const col = up < 0 && rng() < 0.35 ? OLD[k % OLD.length] : FROND[k % FROND.length];
    const a0: V3 = [base[0] - wx * w0, base[1], base[2] - wz * w0];
    const a1: V3 = [base[0] + wx * w0, base[1], base[2] + wz * w0];
    const m0: V3 = [mid[0] - wx * w1, mid[1], mid[2] - wz * w1];
    const m1: V3 = [mid[0] + wx * w1, mid[1], mid[2] + wz * w1];
    for (const f of [1, -1]) {
      leaves.quad(a0, a1, m1, m0, col, [0, f, 0]);
      leaves.tri(m0, m1, tip, col, [0, f, 0]);
    }
  }
}

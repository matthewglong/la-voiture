// The kicker: a plywood ramp hinged to the end of the pier and held up by hydraulic rams. It stands
// at its full angle for the first car to reach it, then drops (RAMP_RATE in sim/race.ts) while amber
// lamps flash at the lip. The lip stays over the same spot and only comes down, as in the sim.
import * as THREE from 'three';
import { DECK_Y, KICKER_ANGLE, KICKER_X, RUSSIAN_HILL } from '../maps/russianHill';
import { GeoBuilder, _q, box, cyl, meshOf, type V3 } from './geo';

export interface Kicker {
  group: THREE.Group;
  /** Stand the ramp at an angle (radians). `alarm`: the lamps flash (t: seconds, for the beat). */
  set(angle: number, alarm: boolean, t: number): void;
}

const LIP = RUSSIAN_HILL.lip!;
/** The hinge, and how far out the lip is from it (fixed: the ramp drops, it doesn't move out). */
const X0 = KICKER_X;
const RUN = LIP.x - X0;
/** The ramp's length at full angle; the leaf is built at that length and stretched to fit. */
const LEN = RUN / Math.cos(KICKER_ANGLE);
const HALF = 7;
/** The rams: where they stand on the deck, and where they push on the leaf (along it, below it). */
const RAM_X = X0 + 8.4;
const RAM_ALONG = 0.84 * LEN;
const RAM_BELOW = -0.34;
const RAM_ZS = [-4.4, 4.4];
const BARREL = 1.35;

export function buildKicker(mats: { ply: THREE.Material; stripe: THREE.Material; cone: THREE.Material }): Kicker {
  const group = new THREE.Group();
  group.name = 'kicker';
  // The leaf: everything that tilts with the ramp, built along its local +x from the hinge with the
  // riding surface at y = 0.
  const leaf = new THREE.Group();
  leaf.name = 'kickerLeaf';
  leaf.position.set(X0, DECK_Y, 0);
  group.add(leaf);

  const plyGeo = new THREE.BoxGeometry(LEN, 0.12, 2 * HALF);
  {
    const p = plyGeo.getAttribute('position');
    const uv = plyGeo.getAttribute('uv');
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + LEN / 2) / 2.44, (p.getZ(i) + HALF) / 1.22);
  }
  plyGeo.translate(LEN / 2, -0.06, 0);
  const ply = new THREE.Mesh(plyGeo, mats.ply);
  ply.name = 'kickerSurface';
  ply.castShadow = true;
  ply.receiveShadow = true;
  leaf.add(ply);

  // Striped edge beams along both sides.
  const stripes = new GeoBuilder();
  const stripeBox = (b: GeoBuilder, c: V3, size: V3, uScale: number): void => {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const p = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + p.getZ(i)) * uScale, (p.getY(i) + size[1] / 2) / size[1]);
    g.translate(c[0], c[1], c[2]);
    b.add(g, '#ffffff');
  };
  for (const z of [-HALF - 0.12, HALF + 0.12]) stripeBox(stripes, [LEN / 2, -0.15, z], [LEN + 0.2, 0.62, 0.24], 1 / 0.9);
  leaf.add(meshOf(stripes, mats.stripe, 'kickerStripes', true, true));

  // Steel under the plywood: stringers, cross members, and the pads the rams push on.
  const steel = new GeoBuilder();
  for (const z of [-5.6, -2.2, 2.2, 5.6]) box(steel, 0.2, LEN - 0.1, -0.42, -0.12, z - 0.09, z + 0.09, '#3b4149');
  for (let x = 0.6; x < LEN; x += 2.3) box(steel, x - 0.08, x + 0.08, -0.36, -0.12, -HALF + 0.3, HALF - 0.3, '#3b4149');
  for (const z of RAM_ZS) box(steel, RAM_ALONG - 0.35, RAM_ALONG + 0.35, RAM_BELOW, -0.12, z - 0.3, z + 0.3, '#2a2f36');
  leaf.add(meshOf(steel, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.45 }), 'kickerSteel', true, true));

  // Yellow lane chevrons on the plywood.
  const chev = new GeoBuilder();
  for (const zc of [-3, 3]) {
    for (let k = 0; k < 3; k++) {
      for (const sgn of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.9, 0.01, 0.22);
        g.rotateY(sgn * 0.6);
        g.translate(1.6 + k * 1.3, 0.005, zc + sgn * 0.33);
        chev.add(g, '#ffd21f');
      }
    }
  }
  leaf.add(meshOf(chev, mats.cone, 'kickerChevrons', false, true));

  // Amber lamps on the lip's corners: dark while the ramp stands, flashing while it drops.
  const lampMat = new THREE.MeshStandardMaterial({ color: '#a86200', emissive: '#ffa412', emissiveIntensity: 0, roughness: 0.3 });
  const lamps = new GeoBuilder();
  for (const z of [-HALF - 0.12, HALF + 0.12]) {
    const g = new THREE.CylinderGeometry(0.2, 0.22, 0.34, 16);
    g.translate(LEN - 0.45, 0.33, z);
    lamps.add(g, '#ffffff');
    const cap = new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.translate(LEN - 0.45, 0.5, z);
    lamps.add(cap, '#ffffff');
  }
  leaf.add(meshOf(lamps, lampMat, 'kickerLamps', false, false));

  // Fixed to the pier: the hinge, the toe board and the lip's fascia (which rides down with the lip).
  const fixed = new GeoBuilder();
  cyl(fixed, [X0, DECK_Y + 0.08, -HALF], [X0, DECK_Y + 0.08, HALF], 0.16, 0.16, 16, '#2a2f36');
  for (const z of RAM_ZS) box(fixed, RAM_X - 0.45, RAM_X + 0.45, DECK_Y, DECK_Y + 0.12, z - 0.45, z + 0.45, '#2a2f36');
  group.add(meshOf(fixed, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.45 }), 'kickerHinge', true, true));
  const toe = new GeoBuilder();
  stripeBox(toe, [X0 + 0.1, DECK_Y + 0.05, 0], [0.4, 0.1, 2 * HALF], 1 / 0.9);
  group.add(meshOf(toe, mats.stripe, 'kickerToe', false, true));
  const fasciaGeo = new GeoBuilder();
  stripeBox(fasciaGeo, [0.12, -0.34, 0], [0.24, 0.68, 2 * HALF + 0.48], 1 / 0.9);
  const fascia = meshOf(fasciaGeo, mats.stripe, 'kickerFascia', true, true);
  fascia.matrixAutoUpdate = true;
  group.add(fascia);

  // The rams: a yellow barrel standing on the deck and a chrome rod up to the leaf.
  const barrelGeo = new THREE.CylinderGeometry(0.2, 0.23, 1, 18);
  barrelGeo.translate(0, 0.5, 0);
  const rodGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 14);
  rodGeo.translate(0, 0.5, 0);
  const barrelMat = new THREE.MeshStandardMaterial({ color: '#f2b705', metalness: 0.35, roughness: 0.45 });
  const rodMat = new THREE.MeshStandardMaterial({ color: '#e4e8ee', metalness: 1, roughness: 0.14 });
  const rams = RAM_ZS.map((z) => {
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    const rod = new THREE.Mesh(rodGeo, rodMat);
    for (const m of [barrel, rod]) {
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
    return { z, barrel, rod };
  });

  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const base = new THREE.Vector3();
  let last = NaN;
  let lampOn = -1;
  const set = (angle: number, alarm: boolean, t: number): void => {
    const on = alarm ? (Math.sin(t * Math.PI * 5) > 0 ? 1 : 0.15) : 0;
    if (on !== lampOn) {
      lampOn = on;
      lampMat.emissiveIntensity = on * 2.4;
    }
    if (angle === last) return;
    last = angle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Stretched so the lip stays over the same spot as it comes down.
    const stretch = RUN / cos / LEN;
    leaf.rotation.z = angle;
    leaf.scale.x = stretch;
    const lipY = DECK_Y + RUN * Math.tan(angle);
    fascia.position.set(LIP.x, lipY, 0);
    const along = RAM_ALONG * stretch;
    const ax = X0 + along * cos - RAM_BELOW * sin;
    const ay = DECK_Y + along * sin + RAM_BELOW * cos;
    for (const r of rams) {
      base.set(RAM_X, DECK_Y + 0.12, r.z);
      dir.set(ax - RAM_X, ay - base.y, 0);
      const len = dir.length();
      dir.divideScalar(len);
      _q.setFromUnitVectors(up, dir);
      const b = Math.min(BARREL, len);
      r.barrel.position.copy(base);
      r.barrel.quaternion.copy(_q);
      r.barrel.scale.set(1, b, 1);
      r.rod.position.copy(base).addScaledVector(dir, b - 0.05);
      r.rod.quaternion.copy(_q);
      r.rod.scale.set(1, Math.max(0.05, len - b + 0.05), 1);
    }
  };
  set(KICKER_ANGLE, false, 0);
  return { group, set };
}

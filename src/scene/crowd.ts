// Spectators: toy figures lining the race barriers. They bob about and jump and wave as the cars
// go by. Instanced, so a few hundred of them cost three draw calls.
import * as THREE from 'three';

export interface Spot {
  x: number;
  y: number;
  z: number;
  /** Heading they face (radians, 0 = +x). */
  face: number;
}

interface Fan extends Spot {
  phase: number;
  rate: number;
  excite: number;
  waver: boolean;
  scale: number;
}

const SHIRTS = ['#ff5a36', '#2e8bff', '#ffd23f', '#3ccf7a', '#b06bff', '#ff7fbf', '#20c5c2', '#ffffff', '#ff9d2e', '#5a6cff'];
const SKIN = ['#f3c9a8', '#e0a987', '#c68a64', '#9a6546', '#6e4630', '#f7d8bf'];

export class Crowd {
  readonly group = new THREE.Group();
  private readonly fans: Fan[] = [];
  private readonly bodies: THREE.InstancedMesh;
  private readonly heads: THREE.InstancedMesh;
  private readonly arms: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly armDummy = new THREE.Object3D();

  constructor(spots: Spot[], rng: () => number) {
    for (const s of spots) {
      this.fans.push({
        ...s,
        phase: rng() * Math.PI * 2,
        rate: 3.2 + rng() * 2.4,
        excite: 0,
        waver: rng() < 0.6,
        scale: 0.85 + rng() * 0.3,
      });
    }
    const n = this.fans.length;
    const bodyGeo = new THREE.CapsuleGeometry(0.21, 0.55, 3, 10);
    bodyGeo.translate(0, 0.49, 0);
    const headGeo = new THREE.SphereGeometry(0.17, 12, 9);
    headGeo.translate(0, 1.1, 0);
    const armGeo = new THREE.CapsuleGeometry(0.06, 0.42, 2, 6);
    armGeo.translate(0, 0.22, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 });
    this.bodies = new THREE.InstancedMesh(bodyGeo, mat, n);
    this.heads = new THREE.InstancedMesh(headGeo, mat, n);
    this.arms = new THREE.InstancedMesh(armGeo, mat, n);
    const c = new THREE.Color();
    this.fans.forEach((_f, i) => {
      const shirt = SHIRTS[Math.floor(rng() * SHIRTS.length)];
      this.bodies.setColorAt(i, c.set(shirt));
      this.heads.setColorAt(i, c.set(SKIN[Math.floor(rng() * SKIN.length)]));
      this.arms.setColorAt(i, c.set(shirt));
    });
    for (const m of [this.bodies, this.heads, this.arms]) {
      m.castShadow = true;
      m.receiveShadow = false;
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.group.name = 'crowd';
    this.update(0, 0, []);
  }

  /** `cars`: where the racers are, so the nearby crowd gets excited. */
  update(dt: number, t: number, cars: { x: number; z: number }[]): void {
    const d = this.dummy;
    const a = this.armDummy;
    this.fans.forEach((f, i) => {
      let near = 0;
      for (const car of cars) {
        const dx = car.x - f.x;
        const dz = car.z - f.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 30 * 30) near = Math.max(near, 1 - Math.sqrt(d2) / 30);
      }
      f.excite += (near - f.excite) * Math.min(1, dt * (near > f.excite ? 6 : 1.2));
      const e = f.excite;
      const beat = Math.sin(t * f.rate * (1 + e * 0.6) + f.phase);
      const hop = Math.max(0, beat) * (0.03 + 0.32 * e);
      d.position.set(f.x, f.y + hop, f.z);
      d.rotation.set(0, -f.face + Math.PI / 2, Math.sin(t * 1.3 + f.phase) * 0.06);
      d.scale.setScalar(f.scale);
      d.updateMatrix();
      this.bodies.setMatrixAt(i, d.matrix);
      this.heads.setMatrixAt(i, d.matrix);
      // One arm up and waving (more when excited).
      a.position.set(0.24, 0.78, 0);
      const up = f.waver || e > 0.4 ? 2.6 + Math.sin(t * 7 + f.phase) * (0.25 + 0.35 * e) : 0.25;
      a.rotation.set(0, 0, up);
      a.updateMatrix();
      a.matrix.premultiply(d.matrix);
      this.arms.setMatrixAt(i, a.matrix);
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    this.arms.instanceMatrix.needsUpdate = true;
  }
}

// Visual effects: camera-facing flight trails and splash bursts.
import * as THREE from 'three';

const MAX_TRAIL = 900;

/** A coloured ribbon that always faces the camera, built from the points a car flies through. */
export class Trail {
  readonly mesh: THREE.Mesh;
  private readonly pts: THREE.Vector3[] = [];
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly geo: THREE.BufferGeometry;
  private readonly color: THREE.Color;
  private readonly width: number;

  constructor(color: THREE.ColorRepresentation, width = 0.45) {
    this.color = new THREE.Color(color);
    this.width = width;
    this.positions = new Float32Array(MAX_TRAIL * 2 * 3);
    this.colors = new Float32Array(MAX_TRAIL * 2 * 4);
    const index: number[] = [];
    for (let i = 0; i < MAX_TRAIL - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setIndex(index);
    this.geo.setDrawRange(0, 0);
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  clear(): void {
    this.pts.length = 0;
    this.geo.setDrawRange(0, 0);
  }

  add(p: THREE.Vector3): void {
    const last = this.pts[this.pts.length - 1];
    if (last && last.distanceToSquared(p) < 0.36) return;
    if (this.pts.length >= MAX_TRAIL) return;
    this.pts.push(p.clone());
  }

  /** Rebuild the ribbon so it faces the camera (the camera moves every frame). */
  update(camera: THREE.Camera): void {
    const n = this.pts.length;
    if (n < 2) {
      this.geo.setDrawRange(0, 0);
      return;
    }
    const cam = camera.position;
    const tangent = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    const side = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      const a = this.pts[Math.max(0, i - 1)];
      const b = this.pts[Math.min(n - 1, i + 1)];
      tangent.subVectors(b, a).normalize();
      toCam.subVectors(cam, p).normalize();
      side.crossVectors(tangent, toCam).normalize();
      // Taper the newest end and fade the oldest a little.
      const age = i / (n - 1);
      const w = this.width * (0.35 + 0.65 * Math.min(1, (n - 1 - i) / 6 + 0.2)) * (0.75 + 0.25 * age);
      const o = i * 6;
      this.positions[o] = p.x + side.x * w;
      this.positions[o + 1] = p.y + side.y * w;
      this.positions[o + 2] = p.z + side.z * w;
      this.positions[o + 3] = p.x - side.x * w;
      this.positions[o + 4] = p.y - side.y * w;
      this.positions[o + 5] = p.z - side.z * w;
      const alpha = 0.35 + 0.6 * age;
      const c = i * 8;
      for (let k = 0; k < 2; k++) {
        this.colors[c + k * 4] = this.color.r;
        this.colors[c + k * 4 + 1] = this.color.g;
        this.colors[c + k * 4 + 2] = this.color.b;
        this.colors[c + k * 4 + 3] = alpha;
      }
    }
    this.geo.getAttribute('position').needsUpdate = true;
    this.geo.getAttribute('color').needsUpdate = true;
    this.geo.setDrawRange(0, (n - 1) * 6);
  }

  dispose(): void {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

interface Droplet {
  p: THREE.Vector3;
  v: THREE.Vector3;
  s: number;
  life: number;
  max: number;
}

interface Burst {
  drops: Droplet[];
  ring: THREE.Mesh;
  foam: THREE.Mesh;
  t: number;
  scale: number;
}

const DROPS_PER_SPLASH = 70;
const MAX_BURSTS = 4;

/** Pooled splash bursts: droplets thrown up and out, an expanding ring and a foam patch. */
export class Splashes {
  readonly group = new THREE.Group();
  private readonly drops: THREE.InstancedMesh;
  private readonly bursts: Burst[] = [];
  private readonly ringGeo = new THREE.RingGeometry(0.8, 1.2, 40);
  private readonly foamGeo = new THREE.CircleGeometry(1, 32);
  private readonly dummy = new THREE.Object3D();
  private seed = 1;

  constructor() {
    const geo = new THREE.IcosahedronGeometry(0.22, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2fbff, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.92 });
    this.drops = new THREE.InstancedMesh(geo, mat, DROPS_PER_SPLASH * MAX_BURSTS);
    this.drops.count = 0;
    this.drops.frustumCulled = false;
    this.group.add(this.drops);
  }

  private rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /** Spawn a splash at p (on the water) with a size scaled by impact speed. */
  spawn(p: THREE.Vector3, impactSpeed: number, color: THREE.ColorRepresentation = 0xffffff): void {
    if (this.bursts.length >= MAX_BURSTS) this.removeBurst(0);
    const scale = THREE.MathUtils.clamp(impactSpeed / 25, 0.6, 1.8);
    const drops: Droplet[] = [];
    for (let i = 0; i < DROPS_PER_SPLASH; i++) {
      const ang = this.rand() * Math.PI * 2;
      const out = (1.5 + this.rand() * 5) * scale;
      const up = (5 + this.rand() * 9) * scale;
      drops.push({
        p: new THREE.Vector3(p.x + Math.cos(ang) * 0.6, 0.2, p.z + Math.sin(ang) * 0.6),
        v: new THREE.Vector3(Math.cos(ang) * out + 2 * scale, up, Math.sin(ang) * out),
        s: (0.6 + this.rand() * 1.3) * scale,
        life: 0,
        max: 1.1 + this.rand() * 0.9,
      });
    }
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    const ring = new THREE.Mesh(this.ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, 0.06, p.z);
    const foamMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.75),
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const foam = new THREE.Mesh(this.foamGeo, foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(p.x, 0.04, p.z);
    this.group.add(ring, foam);
    this.bursts.push({ drops, ring, foam, t: 0, scale });
  }

  private removeBurst(i: number): void {
    const b = this.bursts[i];
    this.group.remove(b.ring, b.foam);
    (b.ring.material as THREE.Material).dispose();
    (b.foam.material as THREE.Material).dispose();
    this.bursts.splice(i, 1);
  }

  clear(): void {
    while (this.bursts.length) this.removeBurst(0);
    this.drops.count = 0;
  }

  update(dt: number): void {
    let n = 0;
    for (let bi = this.bursts.length - 1; bi >= 0; bi--) {
      const b = this.bursts[bi];
      b.t += dt;
      const ringT = Math.min(b.t / 2.2, 1);
      const r = (1 + ringT * 9) * b.scale;
      b.ring.scale.set(r, r, r);
      (b.ring.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - ringT);
      const f = (1.2 + Math.min(b.t, 3) * 1.2) * b.scale;
      b.foam.scale.set(f, f, f);
      (b.foam.material as THREE.MeshBasicMaterial).opacity = 0.7 * Math.max(0, 1 - b.t / 7);
      if (b.t > 7) this.removeBurst(bi);
    }
    for (const b of this.bursts) {
      for (const d of b.drops) {
        d.life += dt;
        if (d.life > d.max || d.p.y < -0.5) continue;
        d.v.y -= 9.81 * dt;
        d.v.multiplyScalar(1 - 0.6 * dt);
        d.p.addScaledVector(d.v, dt);
        const k = 1 - d.life / d.max;
        this.dummy.position.copy(d.p);
        this.dummy.scale.setScalar(d.s * (0.4 + 0.6 * k));
        this.dummy.updateMatrix();
        this.drops.setMatrixAt(n++, this.dummy.matrix);
      }
    }
    this.drops.count = n;
    this.drops.instanceMatrix.needsUpdate = true;
  }
}

// Race effects: pooled particles (sparks, dust, tyre smoke, confetti, splats), skid marks laid on
// the road while the tyres slide, dizzy stars over a spun-out car, and a golden aura while a car
// is Determined.
import * as THREE from 'three';

interface Particle {
  p: THREE.Vector3;
  v: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  grav: number;
  drag: number;
  grow: number;
  color: THREE.Color;
  spin: number;
}

const MAX_PARTICLES = 700;

/** Instanced, pooled particles: little faceted blobs that fly, fall, shrink and fade. */
export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private readonly list: Particle[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly tmpColor = new THREE.Color();

  constructor() {
    const geo = new THREE.IcosahedronGeometry(0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, emissiveIntensity: 0 });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3);
  }

  spawn(
    p: THREE.Vector3,
    v: THREE.Vector3,
    color: THREE.ColorRepresentation,
    size: number,
    life: number,
    opts: { grav?: number; drag?: number; grow?: number } = {},
  ): void {
    if (this.list.length >= MAX_PARTICLES) this.list.shift();
    this.list.push({
      p: p.clone(),
      v: v.clone(),
      life: 0,
      max: life,
      size,
      grav: opts.grav ?? 9.81,
      drag: opts.drag ?? 0.5,
      grow: opts.grow ?? 0,
      color: new THREE.Color(color),
      spin: Math.random() * 6,
    });
  }

  /** A shower of sparks off a wall or a car. */
  sparks(at: THREE.Vector3, dir: THREE.Vector3, n: number): void {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(
        dir.x * 4 + (Math.random() - 0.5) * 7,
        2 + Math.random() * 5,
        dir.z * 4 + (Math.random() - 0.5) * 7,
      );
      this.spawn(at, v, Math.random() < 0.5 ? '#ffd23f' : '#ff8a1f', 0.09 + Math.random() * 0.08, 0.35 + Math.random() * 0.3, { drag: 1.5 });
    }
  }

  /** Puffs of dust or tyre smoke. */
  puff(at: THREE.Vector3, n: number, color: THREE.ColorRepresentation = '#e8e4dc', size = 0.5, up = 1): void {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 2.5, up * (0.6 + Math.random()), (Math.random() - 0.5) * 2.5);
      this.spawn(at, v, color, size * (0.7 + Math.random() * 0.6), 0.7 + Math.random() * 0.5, { grav: -0.4, drag: 2.2, grow: 1.4 });
    }
  }

  /** Confetti (overtakes, the rocket start, a new record). */
  confetti(at: THREE.Vector3, n: number): void {
    const cols = ['#ff5a36', '#2e8bff', '#ffd23f', '#3ccf7a', '#b06bff', '#ff7fbf'];
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 7, 4 + Math.random() * 5, (Math.random() - 0.5) * 7);
      this.spawn(at, v, cols[i % cols.length], 0.12, 1.2 + Math.random() * 0.6, { grav: 5, drag: 1.2 });
    }
  }

  /** Brown splatter (driving through poo): a big wet fountain of it. */
  splat(at: THREE.Vector3): void {
    for (let i = 0; i < 44; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2.5 + Math.random() * 5;
      const v = new THREE.Vector3(Math.cos(a) * s, 3 + Math.random() * 5.5, Math.sin(a) * s);
      this.spawn(at, v, i % 3 === 0 ? '#5e3818' : '#7a4a24', 0.2 + Math.random() * 0.24, 0.7 + Math.random() * 0.5, { drag: 0.9 });
    }
  }

  /** A ring of dust bursting out along the ground (a jump's take-off, a big landing). */
  ring(at: THREE.Vector3, n: number, color: THREE.ColorRepresentation = '#ece8df', speed = 5, size = 0.55): void {
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
      const s = speed * (0.8 + Math.random() * 0.4);
      v.set(Math.cos(a) * s, 0.4 + Math.random() * 0.6, Math.sin(a) * s);
      this.spawn(at, v, color, size * (0.8 + Math.random() * 0.4), 0.55 + Math.random() * 0.25, { grav: -0.3, drag: 3.2, grow: 1.6 });
    }
  }

  clear(): void {
    this.list.length = 0;
    this.mesh.count = 0;
  }

  update(dt: number): void {
    const d = this.dummy;
    let n = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const q = this.list[i];
      q.life += dt;
      if (q.life >= q.max) {
        this.list.splice(i, 1);
        continue;
      }
      q.v.y -= q.grav * dt;
      q.v.multiplyScalar(Math.exp(-q.drag * dt));
      q.p.addScaledVector(q.v, dt);
      if (q.p.y < -0.3 && q.grav > 0) continue;
    }
    for (const q of this.list) {
      const k = 1 - q.life / q.max;
      d.position.copy(q.p);
      d.rotation.set(q.spin * q.life, q.spin * 0.7 * q.life, 0);
      d.scale.setScalar(q.size * (q.grow > 0 ? 1 + q.grow * (1 - k) : 0.35 + 0.65 * k) * (q.grow > 0 ? k * 0.9 + 0.1 : 1));
      d.updateMatrix();
      this.mesh.setMatrixAt(n, d.matrix);
      this.mesh.setColorAt(n, this.tmpColor.copy(q.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

const SKID_SEGS = 900;

/** Dark rubber streaks on the road: two wheel tracks per car, laid while the tyres slide. */
export class SkidMarks {
  readonly mesh: THREE.Mesh;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly geo: THREE.BufferGeometry;
  private next = 0;
  private count = 0;
  /** Last point of each open track (per car and wheel). */
  private readonly last = new Map<string, THREE.Vector3>();
  /** Each car's two track keys (so laying marks doesn't build strings every frame). */
  private readonly keys = new Map<string, [string, string]>();
  private readonly tmpP = new THREE.Vector3();

  constructor() {
    this.pos = new Float32Array(SKID_SEGS * 4 * 3);
    this.col = new Float32Array(SKID_SEGS * 4 * 4);
    const idx: number[] = [];
    for (let i = 0; i < SKID_SEGS; i++) {
      const a = i * 4;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setIndex(idx);
    this.geo.setDrawRange(0, 0);
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  clear(): void {
    this.next = 0;
    this.count = 0;
    this.last.clear();
    this.geo.setDrawRange(0, 0);
  }

  /** End a car's tracks (it stopped sliding). */
  lift(key: string): void {
    this.last.delete(`${key}:0`);
    this.last.delete(`${key}:1`);
  }

  /** Lay the next bit of both wheel tracks for a car. */
  lay(key: string, x: number, y: number, z: number, heading: number, halfTrack: number, strength: number): void {
    const rx = -Math.sin(heading);
    const rz = Math.cos(heading);
    let keys = this.keys.get(key);
    if (!keys) {
      keys = [`${key}:0`, `${key}:1`];
      this.keys.set(key, keys);
    }
    for (let w = 0; w < 2; w++) {
      const s = w === 0 ? -1 : 1;
      const p = this.tmpP.set(x + rx * s * halfTrack, y + 0.02, z + rz * s * halfTrack);
      const k = keys[w];
      const prev = this.last.get(k);
      if (!prev) {
        this.last.set(k, p.clone());
        continue;
      }
      // Wait until the wheel has moved far enough for a segment (whatever the frame rate).
      const gap2 = prev.distanceToSquared(p);
      if (gap2 < 0.04) continue;
      if (gap2 > 9) {
        prev.copy(p);
        continue;
      }
      const i = this.next;
      this.next = (this.next + 1) % SKID_SEGS;
      this.count = Math.min(SKID_SEGS, this.count + 1);
      const hw = 0.13;
      const o = i * 12;
      const put = (j: number, v: THREE.Vector3, side: number): void => {
        this.pos[o + j * 3] = v.x + rx * side * hw;
        this.pos[o + j * 3 + 1] = v.y;
        this.pos[o + j * 3 + 2] = v.z + rz * side * hw;
      };
      put(0, prev, -1);
      put(1, prev, 1);
      put(2, p, -1);
      put(3, p, 1);
      const a = Math.min(0.55, 0.2 + 0.4 * strength);
      for (let j = 0; j < 4; j++) {
        const c = i * 16 + j * 4;
        this.col[c] = 0.08;
        this.col[c + 1] = 0.08;
        this.col[c + 2] = 0.09;
        this.col[c + 3] = a;
      }
      prev.copy(p);
    }
    this.geo.getAttribute('position').needsUpdate = true;
    this.geo.getAttribute('color').needsUpdate = true;
    this.geo.setDrawRange(0, this.count * 6);
  }
}

/** Little stars circling over a spun-out car's head. */
export class DizzyStars {
  readonly group = new THREE.Group();
  private readonly stars: THREE.Mesh[] = [];

  constructor() {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.3 : 0.13;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
    geo.scale(1.5, 1.5, 1);
    const mat = new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ffb000', emissiveIntensity: 0.8, roughness: 0.4 });
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(geo, mat);
      this.stars.push(m);
      this.group.add(m);
    }
    this.group.visible = false;
  }

  update(t: number, on: boolean, at: THREE.Vector3, height: number): void {
    this.group.visible = on;
    if (!on) return;
    this.group.position.set(at.x, at.y + height + 0.5, at.z);
    // A tilted halo of stars, bobbing as they go round.
    this.stars.forEach((s, i) => {
      const a = t * 4.5 + (i * Math.PI * 2) / this.stars.length;
      s.position.set(Math.cos(a) * 1.25, Math.sin(a) * 0.28 + Math.sin(t * 7 + i) * 0.1, Math.sin(a) * 1.25);
      s.rotation.set(0, a, t * 3);
    });
  }
}

/** A pulsing golden glow around a Determined car: bright at the silhouette, clear in the middle. */
export class Aura {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#ffc21a') }, uStrength: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uStrength;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
          float a = pow(rim, 2.6) * uStrength;
          gl_FragColor = vec4(uColor * (0.8 + rim), a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), this.mat);
    this.mesh.visible = false;
    this.mesh.renderOrder = 4;
  }

  update(t: number, level: number, at: THREE.Vector3, heading: number, length: number, width: number): void {
    const on = level > 0;
    this.mesh.visible = on;
    if (!on) return;
    const pulse = 0.5 + 0.5 * Math.sin(t * 9);
    this.mat.uniforms.uStrength.value = 1.1 + 0.6 * pulse;
    this.mesh.position.set(at.x, at.y + 0.75, at.z);
    this.mesh.rotation.set(0, -heading, 0);
    const s = 1 + 0.05 * pulse;
    this.mesh.scale.set((length / 2 + 0.5) * s, 1.15 * s, (width / 2 + 0.5) * s);
  }
}

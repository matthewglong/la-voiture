// Small helpers shared by the procedural scene modules.
import * as THREE from 'three';

/** Deterministic PRNG (mulberry32) so procedural placement is stable between reloads. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draw into a canvas and wrap it as a texture. Colour textures are tagged sRGB. */
export function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { repeat?: [number, number]; srgb?: boolean; anisotropy?: number } = {},
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  tex.anisotropy = opts.anisotropy ?? 8;
  tex.needsUpdate = true;
  return tex;
}

/** Give every vertex of a geometry one colour (for merging many pieces into one mesh). */
export function paintGeometry(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Enable shadows on every mesh under an object. */
export function setShadows(obj: THREE.Object3D, cast: boolean, receive: boolean): void {
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
}

/** Dispose geometries and materials (and their textures) under an object. */
export function disposeObject(obj: THREE.Object3D, keep?: Set<unknown>): void {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry && !keep?.has(mesh.geometry)) mesh.geometry.dispose();
    const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const m of mats) {
      if (keep?.has(m)) continue;
      for (const v of Object.values(m)) {
        if (v instanceof THREE.Texture && !keep?.has(v)) v.dispose();
      }
      m.dispose();
    }
  });
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential approach factor. */
export function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

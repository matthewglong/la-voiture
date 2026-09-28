// The ground's grass: a tiling detail texture (tufts, blades, the odd clover flower, soft clumps)
// laid over the whole ground in world space, and the colours under it: the parks' lawns a rich
// green that wanders between darker and lighter patches every twenty metres or so, worn and dry
// spots, mowing stripes; Buena Vista's woods a darker floor with leaf litter. Deterministic (hashed
// noise of the position), so the same patch is the same every time.
import * as THREE from 'three';
import { canvasTexture, makeRng, smoothstep } from '../util';

/** The detail texture repeats every this many metres. */
export const GRASS_TILE = 6;

// ---------------------------------------------------------------------------------------------
// Noise

function hash(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 144269);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1], features about 1 unit across. */
export function vnoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed);
  const b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed);
  const d = hash(ix + 1, iz + 1, seed);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}

/** Two octaves of it. */
function fbm(x: number, z: number, seed: number): number {
  return vnoise(x, z, seed) * 0.65 + vnoise(x * 2.3 + 17.1, z * 2.3 - 8.4, seed + 1) * 0.35;
}

// ---------------------------------------------------------------------------------------------
// Colours under the texture

/** A park's steep banks, worn to the earth (the city's are the ground's own dirt colour). */
export const BANK = '#7c744c';

const DARK = new THREE.Color('#4e9136');
const LIGHT = new THREE.Color('#6aad45');
const DRY = new THREE.Color('#9c9a5e');
const BED = new THREE.Color('#3f7a2e');
const WOODS = new THREE.Color('#557a40');
const LITTER = new THREE.Color('#7a6446');
const MOSS = new THREE.Color('#4a7a36');
const _c = new THREE.Color();

/**
 * A lawn's colour at (x, z): between a darker and a lighter green in patches, a little finer
 * variation, dry worn spots here and there, and mowing stripes (bands 5 m wide, east-west) unless
 * it's a planted bed.
 */
export function lawnTone(x: number, z: number, out: THREE.Color, bed = false): THREE.Color {
  if (bed) {
    out.copy(BED).multiplyScalar(0.9 + vnoise(x / 3, z / 3, 7) * 0.2);
    return out;
  }
  out.copy(DARK).lerp(LIGHT, smoothstep(0.25, 0.75, fbm(x / 23, z / 23, 11)));
  out.multiplyScalar(0.93 + vnoise(x / 6.5, z / 6.5, 13) * 0.14);
  const worn = smoothstep(0.74, 0.9, vnoise(x / 9 + 40, z / 9 - 12, 17));
  out.lerp(_c.copy(DRY).multiplyScalar(0.92 + vnoise(x / 2.5, z / 2.5, 19) * 0.16), worn * 0.7);
  // Mowing stripes, 5 m wide (on the ground's 2.5 m grid, a band is a row of cells, then a soft edge).
  return out.multiplyScalar(Math.floor(z / 5) % 2 === 0 ? 1.07 : 0.94);
}

/** Buena Vista's floor under its trees: dark green, patches of brown leaf litter, mossy hollows. */
export function woodsTone(x: number, z: number, out: THREE.Color): THREE.Color {
  out.copy(WOODS).lerp(LITTER, smoothstep(0.45, 0.8, fbm(x / 11, z / 11, 23)) * 0.8);
  out.lerp(MOSS, smoothstep(0.65, 0.85, vnoise(x / 5, z / 5, 29)) * 0.6);
  return out.multiplyScalar(0.9 + vnoise(x / 3, z / 3, 31) * 0.2);
}

// ---------------------------------------------------------------------------------------------
// The detail texture

/**
 * The grass detail (1024², one tile = GRASS_TILE m): near-white, so the vertex colours under it
 * set the hue; soft clumps, tufts and blades darken it, the odd clover flower lightens it. Tiles
 * seamlessly (everything is drawn wrapped). `gain` is what the ground's colours need multiplying by
 * to come out as bright as they were before it (its mean, in linear light, inverted).
 */
export function grassTexture(): { map: THREE.CanvasTexture; gain: number } {
  const W = 1024;
  let gain = 1;
  const map = canvasTexture(
    W,
    W,
    (g) => {
      const rng = makeRng(424242);
      g.fillStyle = 'rgb(222, 226, 210)';
      g.fillRect(0, 0, W, W);
      const wrap = (x: number, y: number, r: number, draw: (x: number, y: number) => void): void => {
        for (const ox of [-W, 0, W]) {
          for (const oy of [-W, 0, W]) {
            const px = x + ox;
            const py = y + oy;
            if (px + r < 0 || px - r > W || py + r < 0 || py - r > W) continue;
            draw(px, py);
          }
        }
      };
      // Soft clumps, darker and lighter, 20 to 80 cm across.
      for (let i = 0; i < 140; i++) {
        const x = rng() * W;
        const y = rng() * W;
        const r = 25 + rng() * 70;
        const dark = rng() < 0.6;
        const a = 0.1 + rng() * 0.14;
        wrap(x, y, r, (px, py) => {
          const gr = g.createRadialGradient(px, py, 0, px, py, r);
          gr.addColorStop(0, dark ? `rgba(70, 86, 44, ${a})` : `rgba(255, 255, 236, ${a})`);
          gr.addColorStop(1, dark ? 'rgba(70, 86, 44, 0)' : 'rgba(255, 255, 236, 0)');
          g.fillStyle = gr;
          g.fillRect(px - r, py - r, 2 * r, 2 * r);
        });
      }
      // Tufts: small dark ovals where the grass is thick.
      for (let i = 0; i < 1600; i++) {
        const x = rng() * W;
        const y = rng() * W;
        const r = 3 + rng() * 8;
        g.fillStyle = `rgba(${60 + rng() * 40}, ${80 + rng() * 40}, ${40 + rng() * 25}, ${0.14 + rng() * 0.2})`;
        wrap(x, y, r, (px, py) => {
          g.beginPath();
          g.ellipse(px, py, r, r * (0.5 + rng() * 0.5), rng() * Math.PI, 0, Math.PI * 2);
          g.fill();
        });
      }
      // Blades: short strokes, dark and light.
      g.lineCap = 'round';
      for (let i = 0; i < 9000; i++) {
        const x = rng() * W;
        const y = rng() * W;
        const len = 5 + rng() * 12;
        const ang = rng() * Math.PI * 2;
        const light = rng() < 0.35;
        g.strokeStyle = light ? `rgba(248, 250, 225, ${0.25 + rng() * 0.3})` : `rgba(${50 + rng() * 50}, ${72 + rng() * 50}, ${30 + rng() * 30}, ${0.22 + rng() * 0.3})`;
        g.lineWidth = 1 + rng() * 1.4;
        wrap(x, y, len, (px, py) => {
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
          g.stroke();
        });
      }
      // Clover and the odd daisy.
      for (let i = 0; i < 90; i++) {
        const x = rng() * W;
        const y = rng() * W;
        g.fillStyle = rng() < 0.7 ? 'rgba(255, 255, 250, 0.85)' : 'rgba(250, 226, 120, 0.85)';
        wrap(x, y, 3, (px, py) => {
          g.beginPath();
          g.arc(px, py, 1.6 + rng() * 1.2, 0, Math.PI * 2);
          g.fill();
        });
      }
      // Its mean brightness in linear light, for the gain.
      const d = g.getImageData(0, 0, W, W).data;
      let sum = 0;
      const lin = (v: number): number => Math.pow(v / 255, 2.2);
      for (let i = 0; i < d.length; i += 4 * 7) sum += (lin(d[i]) + lin(d[i + 1]) + lin(d[i + 2])) / 3;
      gain = 1 / (sum / (d.length / (4 * 7)));
    },
    { repeat: [1, 1], anisotropy: 8 },
  );
  map.repeat.set(1, 1);
  return { map, gain };
}

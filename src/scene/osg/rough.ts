// Alamo Square's rough: the long grass and the planted beds, the open ground's slowest surface
// (openGround.ts: a crawl). It has to read from the car as deep before you're in it, so it's drawn
// three ways over the ground where the open ground says it's rough: a yellower, wilder green in the
// ground's colours (the beds a lusher one); a shaggier texture blended into the ground's own there
// (long blades leaning in the wind, seed heads, wildflowers); and low tufts of long blades standing
// in it, sparse, merged into one mesh. The course's own path strips are never rough.
import * as THREE from 'three';
import { inPoly, type OpenGround } from '../../openGround';
import { pointAt, type Course } from '../../track';
import { canvasTexture, makeRng, smoothstep } from '../util';
import type { Ctx } from './context';
import { vnoise } from './lawn';

/** The rough texture repeats every this many metres. */
const ROUGH_TILE = 4;
/** Across its edge the rough fades in over about this much (m) either side. */
const EDGE = 1;

/**
 * How rough the ground is round (x, z), 0 to 1: the share of the open ground's surface samples
 * (every 0.5 m, EDGE m round it) that are rough, not counting the course's own path strips.
 */
export function roughWeight(open: OpenGround, c: Course): (x: number, z: number) => number {
  const onPath = (x: number, z: number): boolean => {
    const p = pointAt(c, open.nearestS(x, z));
    return Math.hypot(p.x - x, p.z - z) < p.pave + 0.25;
  };
  const rough = (x: number, z: number): boolean => open.contains(x, z) && open.surfaceAt(x, z) === 'rough' && !onPath(x, z);
  return (x, z) => {
    if (!open.contains(x, z) && !open.contains(x + EDGE, z) && !open.contains(x - EDGE, z) && !open.contains(x, z + EDGE) && !open.contains(x, z - EDGE)) return 0;
    let n = 0;
    let k = 0;
    for (let i = -EDGE; i <= EDGE + 1e-6; i += 0.5) {
      for (let j = -EDGE; j <= EDGE + 1e-6; j += 0.5) {
        k++;
        if (rough(x + i, z + j)) n++;
      }
    }
    return n / k;
  };
}

// ---------------------------------------------------------------------------------------------
// The colours under the texture

const STRAW = new THREE.Color('#a8a04a');
const WILD = new THREE.Color('#7c9038');
const SEED = new THREE.Color('#b8a765');
const BED_DARK = new THREE.Color('#3e6a2c');
const BED_LUSH = new THREE.Color('#5a8a36');
const _c = new THREE.Color();

/** The rough's colour at (x, z), `w` of the way from whatever `out` holds (the lawn's): long grass
 *  between straw and a wild green with paler seed heads; a planted bed a lusher, darker green. */
export function roughTone(x: number, z: number, out: THREE.Color, w: number, bed: boolean): THREE.Color {
  if (bed) _c.copy(BED_DARK).lerp(BED_LUSH, vnoise(x / 3.5, z / 3.5, 61));
  else {
    _c.copy(WILD).lerp(STRAW, smoothstep(0.3, 0.75, vnoise(x / 7, z / 7, 53)));
    _c.lerp(SEED, smoothstep(0.65, 0.9, vnoise(x / 2.2, z / 2.2, 57)) * 0.6);
  }
  return out.lerp(_c, w);
}

// ---------------------------------------------------------------------------------------------
// The texture, blended into the ground's

/** Long grass (512², tiling, ROUGH_TILE m): blades half a metre long leaning downwind in clumps,
 *  darker gaps between, paler seed heads, and wildflowers: white, yellow, purple. */
export function roughTexture(): THREE.CanvasTexture {
  const W = 512;
  return canvasTexture(
    W,
    W,
    (g) => {
      const rng = makeRng(8086);
      g.fillStyle = 'rgb(214, 214, 176)';
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
      // Shadowed hollows between the clumps.
      for (let i = 0; i < 90; i++) {
        const x = rng() * W;
        const y = rng() * W;
        const r = 14 + rng() * 34;
        wrap(x, y, r, (px, py) => {
          const gr = g.createRadialGradient(px, py, 0, px, py, r);
          gr.addColorStop(0, 'rgba(58, 62, 26, 0.34)');
          gr.addColorStop(1, 'rgba(58, 62, 26, 0)');
          g.fillStyle = gr;
          g.fillRect(px - r, py - r, 2 * r, 2 * r);
        });
      }
      // Blades: long, slightly curved, leaning mostly one way, in clumps; dark at the root, pale at
      // the tip (two strokes each).
      g.lineCap = 'round';
      for (let c = 0; c < 520; c++) {
        const cx = rng() * W;
        const cy = rng() * W;
        const n = 8 + Math.floor(rng() * 12);
        for (let b = 0; b < n; b++) {
          const x = cx + (rng() - 0.5) * 16;
          const y = cy + (rng() - 0.5) * 16;
          const len = 26 + rng() * 44;
          const a = -Math.PI / 2 + 0.55 + (rng() - 0.5) * 1.1;
          const bend = (rng() - 0.3) * 0.5;
          const mx = x + Math.cos(a) * len * 0.55;
          const my = y + Math.sin(a) * len * 0.55;
          const ex = x + Math.cos(a + bend) * len;
          const ey = y + Math.sin(a + bend) * len;
          const dark = `rgba(${60 + rng() * 40}, ${72 + rng() * 34}, ${24 + rng() * 20}, ${0.5 + rng() * 0.3})`;
          const pale = `rgba(${226 + rng() * 29}, ${222 + rng() * 30}, ${150 + rng() * 60}, ${0.45 + rng() * 0.35})`;
          wrap(x, y, len + 4, (px, py) => {
            const dx = px - x;
            const dy = py - y;
            g.lineWidth = 2.2 + rng() * 1.6;
            g.strokeStyle = dark;
            g.beginPath();
            g.moveTo(px, py);
            g.quadraticCurveTo(mx + dx, my + dy, ex + dx, ey + dy);
            g.stroke();
            g.lineWidth = 1.2 + rng() * 0.8;
            g.strokeStyle = pale;
            g.beginPath();
            g.moveTo(mx + dx, my + dy);
            g.lineTo(ex + dx, ey + dy);
            g.stroke();
          });
        }
      }
      // Seed heads: small pale ovals.
      for (let i = 0; i < 260; i++) {
        const x = rng() * W;
        const y = rng() * W;
        g.fillStyle = `rgba(${236 + rng() * 19}, ${224 + rng() * 20}, ${170 + rng() * 40}, 0.8)`;
        wrap(x, y, 4, (px, py) => {
          g.beginPath();
          g.ellipse(px, py, 1.6, 3.4, rng() * Math.PI, 0, Math.PI * 2);
          g.fill();
        });
      }
      // Wildflowers.
      const flowers = ['rgba(255, 255, 250, 0.95)', 'rgba(255, 214, 64, 0.95)', 'rgba(168, 120, 220, 0.95)', 'rgba(250, 150, 190, 0.9)'];
      for (let i = 0; i < 120; i++) {
        const x = rng() * W;
        const y = rng() * W;
        const r = 2.2 + rng() * 2;
        g.fillStyle = flowers[Math.floor(rng() * flowers.length)];
        wrap(x, y, r, (px, py) => {
          g.beginPath();
          g.arc(px, py, r, 0, Math.PI * 2);
          g.fill();
        });
      }
    },
    { repeat: [1, 1], anisotropy: 8 },
  );
}

/**
 * Blend the rough's texture into a ground mesh's own detail map (the mesh's `map`, in world space:
 * one tile every `tile` m), by how rough each vertex is.
 */
export function roughGround(mesh: THREE.Mesh, weight: (x: number, z: number) => number, tile: number): void {
  const g = mesh.geometry;
  const pos = g.getAttribute('position');
  const w = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) w[i] = weight(pos.getX(i), pos.getZ(i));
  g.setAttribute('groundRough', new THREE.BufferAttribute(w, 1));
  const map = roughTexture();
  const mat = mesh.material as THREE.MeshStandardMaterial;
  const k = (tile / ROUGH_TILE).toFixed(4);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.roughMap = { value: map };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float groundRough;\nvarying float vGroundRough;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvGroundRough = groundRough;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D roughMap;\nvarying float vGroundRough;')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          diffuseColor *= mix( texture2D( map, vMapUv ), texture2D( roughMap, vMapUv * ${k} ), vGroundRough );
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => 'ground-rough';
}

// ---------------------------------------------------------------------------------------------
// Tufts

/** The tufts' cards (512 × 256: two cells, long grass and a planted bed): blades fanning up out of
 *  the bottom middle on transparent, the long grass's straw-tipped with seed heads, the bed's green
 *  and in flower. Tinted by the tufts' vertex colours. */
function tuftTexture(): THREE.CanvasTexture {
  return canvasTexture(
    512,
    256,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const rng = makeRng(7707);
      for (const cell of [0, 1]) {
        const ox = cell * 256;
        const bed = cell === 1;
        const tips: [number, number][] = [];
        for (let i = 0; i < 34; i++) {
          const bx = ox + 128 + (rng() - 0.5) * 84;
          const lean = (bx - ox - 128) / 70 + (rng() - 0.5) * 0.9;
          const len = (bed ? 110 : 150) + rng() * (bed ? 80 : 100);
          const tx = Math.min(ox + 250, Math.max(ox + 6, bx + Math.sin(lean) * len));
          const ty = Math.max(6, h - Math.cos(lean) * len);
          const mx = bx + Math.sin(lean) * len * 0.35;
          const my = h - len * 0.55;
          const wb = 9 + rng() * 7;
          const gr = g.createLinearGradient(bx, h, tx, ty);
          if (bed) {
            gr.addColorStop(0, '#2a4a1f');
            gr.addColorStop(1, rng() < 0.5 ? '#6fae48' : '#8cc35a');
          } else {
            gr.addColorStop(0, '#46531f');
            gr.addColorStop(0.55, rng() < 0.5 ? '#8f9a3e' : '#7d9036');
            gr.addColorStop(1, rng() < 0.6 ? '#e6db92' : '#c9cf78');
          }
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(bx - wb / 2, h);
          g.quadraticCurveTo(mx - wb / 3, my, tx, ty);
          g.quadraticCurveTo(mx + wb / 3, my, bx + wb / 2, h);
          g.closePath();
          g.fill();
          tips.push([tx, ty]);
        }
        // Seed heads on the long grass; flowers on the bed.
        const flowers = ['#fbf7ef', '#f6c93c', '#a978dc', '#f48fb4'];
        for (const [tx, ty] of tips) {
          if (rng() < (bed ? 0.45 : 0.35)) {
            g.fillStyle = bed ? flowers[Math.floor(rng() * flowers.length)] : '#efe3a6';
            g.beginPath();
            if (bed) g.arc(tx, ty + 4, 7 + rng() * 4, 0, Math.PI * 2);
            else g.ellipse(tx, ty + 8, 4, 11, 0, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    },
    { anisotropy: 4 },
  );
}

/**
 * Tufts over the rough: one on about every 6 m² of it (a jittered grid), each two crossed cards of
 * long grass a metre and more across and knee high (a planted bed's lower, greener and in flower),
 * lit on both sides as if they faced up (as grass is), in one mesh of their own: 4 triangles a tuft.
 */
export function buildTufts(ctx: Ctx, open: OpenGround, bed: (x: number, z: number) => boolean): void {
  const c = ctx.course;
  const rng = makeRng(5150);
  const onPath = (x: number, z: number): boolean => {
    const p = pointAt(c, open.nearestS(x, z));
    return Math.hypot(p.x - x, p.z - z) < p.pave + 0.9;
  };
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const uvs: number[] = [];
  const tint = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  const n = new THREE.Vector3();
  const card = (x: number, y: number, z: number, a: number, w: number, h: number, u0: number): void => {
    const dx = (Math.cos(a) * w) / 2;
    const dz = (Math.sin(a) * w) / 2;
    // Facing across the card, tipped up.
    n.set(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.25).add(up).normalize();
    const P = [
      [x - dx, y, z - dz, u0, 0],
      [x + dx, y, z + dz, u0 + 0.5, 0],
      [x + dx, y + h, z + dz, u0 + 0.5, 1],
      [x - dx, y + h, z - dz, u0, 1],
    ];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      pos.push(P[k][0], P[k][1], P[k][2]);
      nor.push(n.x, n.y, n.z);
      col.push(tint.r, tint.g, tint.b);
      uvs.push(P[k][3], P[k][4]);
    }
  };
  // A jittered grid over the park: a tuft wherever it lands in the rough.
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [x, z] of open.outline) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  // What else is laid on the park's ground (its paths and plazas, its courts, a street's arm, the
  // benches): the flat faces of everything built so far that's near the ground, rasterised onto a
  // 0.5 m grid. No tuft grows through any of it.
  const M = 0.5;
  const mx = Math.ceil((x1 - x0) / M) + 1;
  const mz = Math.ceil((z1 - z0) / M) + 1;
  const mask = new Uint8Array(mx * mz);
  const S = ctx.sinks;
  for (const b of [S.asphalt, S.path, S.sidewalk, S.concrete, S.stone, S.paint, S.hedge, S.marks]) {
    b.eachTriangle((a, p, q) => {
      const bx0 = Math.min(a[0], p[0], q[0]);
      const bx1 = Math.max(a[0], p[0], q[0]);
      const bz0 = Math.min(a[2], p[2], q[2]);
      const bz1 = Math.max(a[2], p[2], q[2]);
      if (bx1 < x0 || bx0 > x1 || bz1 < z0 || bz0 > z1) return;
      // Flat-ish faces (tops, and the bottoms under them), not far off the ground.
      const ux = p[0] - a[0];
      const uz = p[2] - a[2];
      const vx = q[0] - a[0];
      const vz = q[2] - a[2];
      const area = ux * vz - uz * vx;
      if (Math.abs(area) < 1e-6) return;
      const ny = Math.abs(area) / Math.hypot((p[1] - a[1]) * vz - uz * (q[1] - a[1]), uz * vx - ux * vz, ux * (q[1] - a[1]) - (p[1] - a[1]) * vx);
      if (ny < 0.5 || Math.min(a[1], p[1], q[1]) > ctx.ground((bx0 + bx1) / 2, (bz0 + bz1) / 2) + 1.3) return;
      for (let i = Math.max(0, Math.floor((bx0 - x0) / M)); i <= Math.min(mx - 1, Math.ceil((bx1 - x0) / M)); i++) {
        for (let j = Math.max(0, Math.floor((bz0 - z0) / M)); j <= Math.min(mz - 1, Math.ceil((bz1 - z0) / M)); j++) {
          // (Barycentric, in plan.)
          const px = x0 + i * M - a[0];
          const pz = z0 + j * M - a[2];
          const s = (px * vz - pz * vx) / area;
          const t = (ux * pz - uz * px) / area;
          if (s >= -0.02 && t >= -0.02 && s + t <= 1.04) mask[j * mx + i] = 1;
        }
      }
    });
  }
  const covered = (x: number, z: number): boolean => {
    const i = Math.round((x - x0) / M);
    const j = Math.round((z - z0) / M);
    return i >= 0 && j >= 0 && i < mx && j < mz && mask[j * mx + i] === 1;
  };
  // (Clear of the park's edge, whatever's laid on its ground, its courts and buildings, and its
  // trunks and posts.)
  const E = 0.8;
  const clear = (x: number, z: number): boolean =>
    open.contains(x + E, z) &&
    open.contains(x - E, z) &&
    open.contains(x, z + E) &&
    open.contains(x, z - E) &&
    !covered(x, z) &&
    !covered(x + E, z) &&
    !covered(x - E, z) &&
    !covered(x, z + E) &&
    !covered(x, z - E) &&
    !open.blocks.some((poly) => inPoly(poly, x, z)) &&
    !open.posts.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < (q.r + 0.35) ** 2);
  const STEP = 2.4;
  for (let gx = x0; gx < x1; gx += STEP) {
    for (let gz = z0; gz < z1; gz += STEP) {
      const x = gx + rng() * STEP;
      const z = gz + rng() * STEP;
      if (!open.contains(x, z) || open.surfaceAt(x, z) !== 'rough' || onPath(x, z) || !clear(x, z)) continue;
      const lush = bed(x, z);
      const y = ctx.ground(x, z) - 0.06;
      const a = rng() * Math.PI;
      const w = (lush ? 0.9 : 1.1) + rng() * 0.4;
      const h = (lush ? 0.5 : 0.62) + rng() * 0.28;
      tint.setRGB(0.88 + rng() * 0.14, 0.88 + rng() * 0.14, 0.82 + rng() * 0.12);
      const u0 = lush ? 0.5 : 0;
      card(x, y, z, a, w, h, u0);
      card(x, y, z, a + Math.PI / 2 + (rng() - 0.5) * 0.4, w * (0.85 + rng() * 0.2), h * (0.9 + rng() * 0.15), u0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ map: tuftTexture(), alphaTest: 0.4, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85 });
  // Both faces lit by the one (upward) normal: grass doesn't go dark from behind.
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  mat.customProgramCacheKey = () => 'rough-tufts';
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'roughTufts';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  ctx.group.add(mesh);
}

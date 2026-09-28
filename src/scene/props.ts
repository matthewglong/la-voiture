// Props and textures shared by the maps' scenery: road asphalt, chequers, the start banner, the
// grid's lane labels, trees, tyre walls and crowd barriers.
import * as THREE from 'three';
import { GeoBuilder, cyl, obox } from './geo';
import { canvasTexture, makeRng } from './util';

function wrapDraw(w: number, h: number, draw: (ox: number, oy: number) => void): void {
  for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) draw(ox, oy);
}

export function asphaltTexture(): THREE.CanvasTexture {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#5a6069';
      ctx.fillRect(0, 0, w, h);
      const rng = makeRng(11);
      // Very faint tar patches so the surface isn't flat, without reading as stains.
      for (let i = 0; i < 5; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const rx = 40 + rng() * 60;
        const ry = 25 + rng() * 40;
        const rot = rng() * Math.PI;
        wrapDraw(w, h, (ox, oy) => {
          ctx.fillStyle = 'rgba(30,32,38,0.035)';
          ctx.beginPath();
          ctx.ellipse(x + ox, y + oy, rx, ry, rot, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      for (let i = 0; i < 14000; i++) {
        const g = 60 + ((rng() * 90) | 0);
        ctx.fillStyle = `rgba(${g},${g},${g + 8},${0.25 + rng() * 0.4})`;
        const s = rng() < 0.9 ? 1 : 2;
        ctx.fillRect(rng() * w, rng() * h, s, s);
      }
    },
    { repeat: [1, 1] },
  );
}

export function checkerTexture(cols: number, rows: number): THREE.CanvasTexture {
  return canvasTexture(
    cols * 32,
    rows * 32,
    (ctx) => {
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          ctx.fillStyle = (i + j) % 2 === 0 ? '#f7f7f2' : '#17171b';
          ctx.fillRect(i * 32, j * 32, 32, 32);
        }
      }
    },
    { anisotropy: 8 },
  );
}

export function bannerTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 160, (ctx, w, h) => {
    ctx.fillStyle = '#e8322a';
    ctx.fillRect(0, 0, w, h);
    const sq = 16;
    for (let i = 0; i < w / sq; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#17171b' : '#f7f7f2';
        ctx.fillRect(i * sq, j * sq, sq, sq);
        ctx.fillRect(i * sq, h - (j + 1) * sq, sq, sq);
      }
    }
    ctx.font = '900 88px "Arial Rounded MT Bold", "Arial Black", "Helvetica Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#7a1210';
    ctx.strokeText('LA VOITURE', w / 2, h / 2 + 4);
    ctx.fillStyle = '#fff6e0';
    ctx.fillText('LA VOITURE', w / 2, h / 2 + 4);
  });
}

export function laneLabelTexture(): THREE.CanvasTexture {
  // Left half "P1", right half "P2": painted on the road behind the start line.
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = '900 190px "Arial Rounded MT Bold", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f7f7f2';
    ctx.fillText('P1', w * 0.25, h / 2 + 8);
    ctx.fillText('P2', w * 0.75, h / 2 + 8);
  });
}

export function tree(b: GeoBuilder, x: number, y: number, z: number, s: number, rng: () => number): void {
  cyl(b, [x, y, z], [x, y + 2.2 * s, z], 0.13 * s, 0.18 * s, 6, '#7a5a3c');
  const greens = ['#4fae5a', '#5cbf63', '#3f9c56', '#6cc56a'];
  const g = new THREE.IcosahedronGeometry(1.35 * s, 0);
  g.translate(x, y + 3.0 * s, z);
  b.add(g, greens[Math.floor(rng() * greens.length)]);
  const g2 = new THREE.IcosahedronGeometry(0.95 * s, 0);
  g2.translate(x + 0.5 * s, y + 3.8 * s, z - 0.3 * s);
  b.add(g2, greens[Math.floor(rng() * greens.length)]);
}

/** A stack of three racing tyres. */
export function tyreStack(b: GeoBuilder, x: number, y: number, z: number, i: number): void {
  const colors = ['#1e1f22', '#e8322a', '#f4f4ef'];
  for (let k = 0; k < 3; k++) {
    const g = new THREE.TorusGeometry(0.32, 0.15, 6, 14);
    g.rotateX(Math.PI / 2);
    g.translate(x, y + 0.15 + k * 0.29, z);
    b.add(g, k === 1 ? colors[1 + (i % 2)] : colors[0]);
  }
}

/** A crowd-control barrier panel from a to b (on the sidewalk), 1.1 m tall. */
export function barrierPanel(b: GeoBuilder, ax: number, az: number, bx: number, bz: number, y0: number, y1: number): void {
  const len = Math.hypot(bx - ax, bz - az);
  const ang = -Math.atan2(bz - az, bx - ax);
  const cx = (ax + bx) / 2;
  const cz = (az + bz) / 2;
  const ym = (y0 + y1) / 2;
  const col = '#dfe4ea';
  // Rails, posts, bars and feet.
  obox(b, [cx, ym + 1.05, cz], [len, 0.06, 0.06], [0, ang, 0], col);
  obox(b, [cx, ym + 0.2, cz], [len, 0.05, 0.05], [0, ang, 0], col);
  for (const f of [-0.5, 0.5]) {
    const px = cx + Math.cos(-ang) * len * f * 0.98;
    const pz = cz + Math.sin(-ang) * len * f * 0.98;
    const py = f < 0 ? y0 : y1;
    obox(b, [px, py + 0.55, pz], [0.06, 1.1, 0.06], [0, ang, 0], col);
    obox(b, [px, py + 0.02, pz], [0.1, 0.04, 0.7], [0, ang, 0], '#8c939c');
  }
  for (let k = 1; k < 7; k++) {
    const f = k / 7 - 0.5;
    const px = cx + Math.cos(-ang) * len * f;
    const pz = cz + Math.sin(-ang) * len * f;
    obox(b, [px, ym + 0.62, pz], [0.025, 0.82, 0.025], [0, ang, 0], col);
  }
}

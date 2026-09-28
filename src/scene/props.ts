// Props and textures shared by every map's scenery (and the race's cast): road asphalt, chequers,
// the start banner, the grid's lane labels, signs, trees, tyre walls, crowd barriers, the kicker's
// plywood and hazard stripes, and the cable car. Change one here and every map gets it.
import * as THREE from 'three';
import { GeoBuilder, box, cyl, meshOf, obox, rbox } from './geo';
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

/** Where a stack of three racing tyres stands (i picks its colours: every other one is white). */
export interface TyreSpot {
  x: number;
  y: number;
  z: number;
  i: number;
}

/** Tyre walls: stacks of three racing tyres (black, red or white, black), instanced (there can be
 *  thousands of them). */
export function tyreWall(spots: TyreSpot[], name = 'tyreWalls'): THREE.InstancedMesh {
  const geo = new THREE.TorusGeometry(0.32, 0.15, 5, 10);
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshPhysicalMaterial({ roughness: 0.45, clearcoat: 0.4 }), Math.max(1, spots.length * 3));
  mesh.count = spots.length * 3;
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const colors = ['#1e1f22', '#e8322a', '#f4f4ef'];
  spots.forEach((t, k) => {
    for (let j = 0; j < 3; j++) {
      m.makeTranslation(t.x, t.y + 0.15 + j * 0.29, t.z);
      mesh.setMatrixAt(k * 3 + j, m);
      mesh.setColorAt(k * 3 + j, c.set(j === 1 ? colors[1 + (t.i % 2)] : colors[0]));
    }
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  mesh.computeBoundingSphere();
  return mesh;
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

export function signTexture(text: string, bg: string, fg: string, w = 512, h = 96): THREE.CanvasTexture {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.font = `900 ${Math.round(h * 0.52)}px "Arial Rounded MT Bold", "Arial Black", "Helvetica Neue", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fg;
    ctx.fillText(text, w / 2, h / 2 + 3);
  });
}

/** Plywood sheets (the kicker's riding surface). */
export function plywoodTexture(): THREE.CanvasTexture {
  // Tile = one 2.44 m × 1.22 m sheet.
  return canvasTexture(
    1024,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#e2c08a';
      ctx.fillRect(0, 0, w, h);
      const rng = makeRng(5);
      for (let i = 0; i < 70; i++) {
        const y = rng() * h;
        const amp = 6 + rng() * 22;
        const f = 0.004 + rng() * 0.01;
        ctx.strokeStyle = `rgba(${150 + rng() * 40},${95 + rng() * 30},${45},${0.12 + rng() * 0.18})`;
        ctx.lineWidth = 1 + rng() * 3;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) {
          const yy = y + Math.sin(x * f + i) * amp;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(120,70,30,0.25)';
        ctx.beginPath();
        ctx.ellipse(rng() * w, rng() * h, 8 + rng() * 10, 4 + rng() * 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(90,55,25,0.75)';
      ctx.lineWidth = 5;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = 'rgba(70,70,70,0.7)';
      for (let x = 24; x < w; x += 96) {
        for (const y of [18, h / 2, h - 18]) ctx.fillRect(x, y - 3, 6, 6);
      }
    },
    { repeat: [1, 1] },
  );
}

/** Yellow and black hazard stripes. */
export function stripeTexture(): THREE.CanvasTexture {
  // One tile = 1 m: a yellow and a black diagonal band.
  return canvasTexture(
    256,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#ffcc12';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1b1b1f';
      for (let k = -2; k < 3; k++) {
        const x = k * w;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, 0);
        ctx.lineTo(x + w, 0);
        ctx.lineTo(x + w * 0.5 + h * 0.9, h);
        ctx.lineTo(x + h * 0.9, h);
        ctx.closePath();
        ctx.fill();
      }
    },
    { repeat: [1, 1] },
  );
}

// ---------------------------------------------------------------------------------------------
// Cable car (Powell & Hyde): its own small group so it can be placed on the rails.

export function buildCableCar(signMat: THREE.Material, glassMat: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'cableCar';
  const paint = new GeoBuilder();
  const glass = new GeoBuilder();
  const brass = new GeoBuilder();
  const RED = '#b01e2c';
  const CREAM = '#f3e7c9';
  const GOLD = '#d9a93c';
  const WOOD = '#8a5a34';
  const L = 8.4;
  const hl = L / 2;
  const hw = 1.2;

  // Trucks and wheels on the rails (rail gauge 1.067 m).
  for (const sx of [-2.6, 2.6]) {
    box(paint, sx - 0.85, sx + 0.85, 0.22, 0.58, -0.62, 0.62, '#2a2c31');
    for (const wx of [sx - 0.5, sx + 0.5]) {
      for (const wz of [-0.535, 0.535]) {
        const g = new THREE.CylinderGeometry(0.27, 0.27, 0.1, 16);
        g.rotateX(Math.PI / 2);
        g.translate(wx, 0.27, wz);
        paint.add(g, '#3a3d44');
      }
    }
  }
  // Floor and body.
  rbox(paint, -hl, hl, 0.58, 0.86, -hw, hw, 0.08, RED);
  rbox(paint, -2.15, 2.15, 0.86, 1.62, -hw, hw, 0.06, RED);
  box(paint, -2.2, 2.2, 1.55, 1.68, -hw - 0.03, hw + 0.03, GOLD);
  rbox(paint, -2.15, 2.15, 1.62, 2.98, -hw + 0.02, hw - 0.02, 0.06, CREAM);
  // Window band on the enclosed saloon.
  for (let i = 0; i < 6; i++) {
    const cx = -1.8 + i * 0.72;
    for (const zs of [-1, 1]) {
      box(glass, cx - 0.27, cx + 0.27, 1.85, 2.72, zs * (hw - 0.03), zs * (hw + 0.02), '#ffffff');
      box(paint, cx - 0.33, cx + 0.33, 1.78, 1.85, zs * (hw - 0.02), zs * (hw + 0.04), WOOD);
    }
  }
  for (const xs of [-1, 1]) {
    box(glass, xs * 2.15 - 0.02, xs * 2.15 + 0.02, 1.85, 2.72, -0.8, 0.8, '#ffffff');
  }
  // Open end platforms: dashers, outward benches and brass poles.
  for (const xs of [-1, 1]) {
    const a = xs * 2.15;
    const b = xs * hl;
    rbox(paint, Math.min(a, b), Math.max(a, b), 0.86, 1.38, -hw, -hw + 0.12, 0.04, RED);
    rbox(paint, Math.min(a, b), Math.max(a, b), 0.86, 1.38, hw - 0.12, hw, 0.04, RED);
    box(paint, Math.min(a, b), Math.max(a, b), 1.3, 1.4, -hw - 0.02, -hw + 0.14, GOLD);
    box(paint, Math.min(a, b), Math.max(a, b), 1.3, 1.4, hw - 0.14, hw + 0.02, GOLD);
    box(paint, Math.min(a, b) + 0.1, Math.max(a, b) - 0.1, 1.2, 1.3, -0.35, 0.35, WOOD);
    box(paint, b - xs * 0.25, b - xs * 0.08, 0.86, 1.9, -0.9, 0.9, CREAM);
    for (const px of [a + xs * 0.25, (a + b) / 2, b - xs * 0.2]) {
      for (const pz of [-hw + 0.06, hw - 0.06]) cyl(brass, [px, 0.86, pz], [px, 2.98, pz], 0.035, 0.035, 8, '#ffffff');
    }
    // Headlight.
    const hg = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16);
    hg.rotateZ(Math.PI / 2);
    hg.translate(b + xs * 0.02, 1.25, 0);
    brass.add(hg, '#ffffff');
  }
  // Grip lever in the front platform.
  cyl(brass, [2.9, 0.86, 0.2], [3.05, 2.0, 0.2], 0.03, 0.04, 6, '#ffffff');
  // Roof, clerestory and bell.
  rbox(paint, -hl - 0.12, hl + 0.12, 2.98, 3.12, -hw - 0.1, hw + 0.1, 0.06, CREAM);
  rbox(paint, -3.2, 3.2, 3.12, 3.46, -0.62, 0.62, 0.06, CREAM);
  for (let i = 0; i < 9; i++) {
    const cx = -2.8 + i * 0.7;
    for (const zs of [-1, 1]) box(glass, cx - 0.2, cx + 0.2, 3.18, 3.38, zs * 0.6, zs * 0.64, '#ffffff');
  }
  rbox(paint, -3.3, 3.3, 3.46, 3.56, -0.72, 0.72, 0.04, RED);
  const bell = new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  bell.translate(2.4, 3.46, 0);
  brass.add(bell, '#ffffff');

  const paintMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#d8ac48', metalness: 1, roughness: 0.28 });
  group.add(meshOf(paint, paintMat, 'cableCarBody', true, true));
  group.add(meshOf(glass, glassMat, 'cableCarGlass', false, false));
  group.add(meshOf(brass, brassMat, 'cableCarBrass', true, false));

  // Destination signs on both roof ends.
  for (const xs of [-1, 1]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.32), signMat);
    sign.position.set(xs * (hl + 0.14), 3.3, 0);
    sign.rotation.y = xs * (Math.PI / 2);
    group.add(sign);
  }
  // Side name boards.
  for (const zs of [-1, 1]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.3), signMat);
    sign.position.set(0, 1.25, zs * (hw + 0.03));
    sign.rotation.y = zs > 0 ? 0 : Math.PI;
    group.add(sign);
  }
  return group;
}

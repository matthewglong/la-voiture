// Props and textures shared by every map's scenery (and the race's cast): road asphalt, chequers,
// the start banner, the grid's lane labels, signs, trees, tyre walls, crowd barriers, sawhorse
// barricades, the kicker's plywood and hazard stripes, the cable car and the streetcar. Change one
// here and every map gets it.
import * as THREE from 'three';
import { GeoBuilder, _e, _m4, _q, _s, _v, box, cyl, meshOf, obox, rbox, type V3 } from './geo';
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

export function bannerTexture(text = 'LA VOITURE'): THREE.CanvasTexture {
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
    ctx.strokeText(text, w / 2, h / 2 + 4);
    ctx.fillStyle = '#fff6e0';
    ctx.fillText(text, w / 2, h / 2 + 4);
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

/** A Monterey cypress, windswept: a stout leaning trunk under broad, flat-topped layers of dark
 *  green (Alamo Square's and the Presidio's). `lean` is the way the wind has pushed it (radians). */
export function cypressTree(b: GeoBuilder, x: number, y: number, z: number, s: number, lean: number, rng: () => number): void {
  const lx = Math.cos(lean) * 0.9 * s;
  const lz = Math.sin(lean) * 0.9 * s;
  cyl(b, [x, y - 0.2, z], [x + lx, y + 3.2 * s, z + lz], 0.22 * s, 0.34 * s, 7, '#6d5642');
  const greens = ['#2f5d3a', '#355f3c', '#2c5536', '#3b6a41'];
  for (let k = 0; k < 4; k++) {
    const g = new THREE.IcosahedronGeometry(1, 0);
    const r = (1.9 - k * 0.25) * s;
    g.scale(r * (1.25 + rng() * 0.3), r * 0.42, r * (0.9 + rng() * 0.3));
    g.rotateY(lean + (rng() - 0.5) * 0.6);
    g.translate(x + lx * (1 + k * 0.35) + (rng() - 0.5) * s, y + (3.4 + k * 0.85) * s, z + lz * (1 + k * 0.35) + (rng() - 0.5) * s);
    b.add(g, greens[Math.floor(rng() * greens.length)]);
  }
}

/** A pine: a tall bare trunk and a dark green crown of stacked cones. */
export function pineTree(b: GeoBuilder, x: number, y: number, z: number, s: number, rng: () => number): void {
  cyl(b, [x, y - 0.2, z], [x, y + 5 * s, z], 0.14 * s, 0.22 * s, 6, '#6a5140');
  for (let k = 0; k < 3; k++) {
    const g = new THREE.ConeGeometry((1.6 - k * 0.35) * s, 2.2 * s, 7);
    g.translate(x + (rng() - 0.5) * 0.2 * s, y + (5 + k * 1.1) * s, z + (rng() - 0.5) * 0.2 * s);
    b.add(g, k % 2 ? '#2e5a3a' : '#355f40');
  }
}

/** A park bench facing `face` (radians): wooden slats on cast-iron ends. */
export function parkBench(wood: GeoBuilder, iron: GeoBuilder, x: number, y: number, z: number, face: number): void {
  const m = new THREE.Matrix4().makeRotationY(-face).setPosition(x, y, z);
  // Local +x is the way it faces; the bench runs along z.
  for (const bz of [-0.75, 0.75]) {
    box(iron, -0.25, 0.25, 0, 0.45, bz - 0.04, bz + 0.04, '#2b2f33', m);
    box(iron, -0.28, -0.2, 0.42, 0.95, bz - 0.04, bz + 0.04, '#2b2f33', m);
  }
  for (const [x0, y0] of [
    [-0.2, 0.45],
    [0.0, 0.45],
    [0.2, 0.45],
  ] as const) box(wood, x0 - 0.08, x0 + 0.08, y0, y0 + 0.05, -0.95, 0.95, '#a8743f', m);
  for (const y0 of [0.62, 0.8]) box(wood, -0.3, -0.24, y0, y0 + 0.12, -0.95, 0.95, '#a8743f', m);
}

/** A park lamp: a dark green post with a white acorn globe (the globe goes in `glow`). */
export function parkLamp(iron: GeoBuilder, glow: GeoBuilder, x: number, y: number, z: number): void {
  cyl(iron, [x, y, z], [x, y + 3.6, z], 0.06, 0.1, 8, '#24463a');
  cyl(iron, [x, y, z], [x, y + 0.5, z], 0.13, 0.15, 8, '#24463a');
  const g = new THREE.SphereGeometry(0.24, 12, 8);
  g.scale(1, 1.35, 1);
  g.translate(x, y + 3.95, z);
  glow.add(g, '#fff8e2');
  cyl(iron, [x, y + 4.25, z], [x, y + 4.4, z], 0.05, 0.12, 8, '#24463a');
}

/** A low hoop fence along a polyline (SF's parks edge their lawns with them): hoops every 1.2 m. */
export function hoopFence(iron: GeoBuilder, line: { x: number; y: number; z: number }[], h = 0.5): void {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const c = line[i + 1];
    const len = Math.hypot(c.x - a.x, c.z - a.z);
    const n = Math.max(1, Math.round(len / 1.2));
    for (let k = 0; k < n; k++) {
      const f0 = k / n;
      const f1 = (k + 1) / n;
      const p0 = { x: a.x + (c.x - a.x) * f0, y: a.y + (c.y - a.y) * f0, z: a.z + (c.z - a.z) * f0 };
      const p1 = { x: a.x + (c.x - a.x) * f1, y: a.y + (c.y - a.y) * f1, z: a.z + (c.z - a.z) * f1 };
      cyl(iron, [p0.x, p0.y, p0.z], [p0.x, p0.y + h, p0.z], 0.02, 0.02, 4, '#2e4a3e');
      cyl(iron, [p0.x, p0.y + h, p0.z], [p1.x, p1.y + h, p1.z], 0.02, 0.02, 4, '#2e4a3e');
    }
  }
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

export function barricadeTexture(): THREE.CanvasTexture {
  // Orange and white stripes with ROAD CLOSED in the middle; one tile per board.
  return canvasTexture(512, 96, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff6a1f';
    for (let x = -h; x < w + h; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 32, h);
      ctx.lineTo(x + 32 + h, 0);
      ctx.lineTo(x + h, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w * 0.22, 12, w * 0.56, h - 24);
    ctx.font = '900 44px "Arial Rounded MT Bold", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1b1b1f';
    ctx.fillText('ROAD CLOSED', w / 2, h / 2 + 2);
  });
}

/** A sawhorse barricade (two striped boards on A-frame legs) centred at (x, z), facing along `ang`:
 *  the boards go in `boards` (drawn with barricadeTexture()), the legs in `legs`. */
export function barricade(boards: GeoBuilder, legs: GeoBuilder, x: number, y: number, z: number, ang: number, len = 2.2): void {
  for (const h of [0.62, 1.02]) {
    const g = new THREE.BoxGeometry(len, 0.26, 0.05);
    _m4.compose(_v.set(x, y + h, z), _q.setFromEuler(_e.set(0, ang, 0)), _s.set(1, 1, 1));
    boards.add(g, '#ffffff', _m4);
  }
  for (const f of [-0.42, 0.42]) {
    const px = x + Math.cos(-ang) * len * f;
    const pz = z + Math.sin(-ang) * len * f;
    for (const t of [-1, 1]) {
      obox(legs, [px, y + 0.55, pz], [0.07, 1.15, 0.07], [t * 0.18, ang, 0], '#e8e8e2');
    }
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

/** San Francisco's green street-name signs: one row per name, 64 px each. */
export function namesTexture(names: string[], bg = '#12704a'): THREE.CanvasTexture {
  const rows = names.length;
  return canvasTexture(512, 64 * rows, (ctx, w) => {
    names.forEach((name, r) => {
      const y = r * 64;
      ctx.fillStyle = bg;
      ctx.fillRect(0, y, w, 64);
      ctx.strokeStyle = '#f4f4ee';
      ctx.lineWidth = 4;
      ctx.strokeRect(5, y + 5, w - 10, 54);
      ctx.font = '800 36px "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f4f4ee';
      ctx.fillText(name, w / 2, y + 34);
    });
  });
}

/** A plate for row `row` of a names texture; `alongZ` plates face ±x. */
export function namePlate(row: number, rows: number, alongZ: boolean, len = 1.6): THREE.BufferGeometry {
  const g = alongZ ? new THREE.BoxGeometry(0.05, 0.32, len) : new THREE.BoxGeometry(len, 0.32, 0.05);
  const n = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  const v0 = 1 - (row + 1) / rows;
  const v1 = 1 - row / rows;
  for (let i = 0; i < uv.count; i++) {
    const face = alongZ ? Math.abs(n.getX(i)) > 0.5 : Math.abs(n.getZ(i)) > 0.5;
    if (face) uv.setXY(i, uv.getX(i), v0 + uv.getY(i) * (v1 - v0));
    else uv.setXY(i, 0.01, (v0 + v1) / 2);
  }
  return g;
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

// ---------------------------------------------------------------------------------------------
// Muni streetcar (the N Judah's Siemens S200 SF): its own small group too, placed on its rails.

/** Height of the overhead wire above the rails: the pantograph reaches up to it (the same height
 *  as the trolley wires over the city's streets). */
export const STREETCAR_WIRE_Y = 5.6;

/**
 * A slab with a rounded-rectangle plan (x0..x1 along, ±hw across; corner radius r0 at the x0 end
 * and r1 at the x1 end) from y0 up to y1: smooth round its corners, flat on top and underneath.
 * The streetcar's body is a stack of these, so its bands of livery wrap round the cab ends.
 */
function roundedSlab(x0: number, x1: number, hw: number, r0: number, r1: number, y0: number, y1: number, seg = 6): THREE.BufferGeometry {
  // The outline round the corners, with its outward normals: [x, z, nx, nz].
  const ring: [number, number, number, number][] = [];
  const corner = (cx: number, cz: number, r: number, a0: number): void => {
    for (let k = 0; k <= seg; k++) {
      const a = a0 + (k / seg) * (Math.PI / 2);
      ring.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, Math.cos(a), Math.sin(a)]);
    }
  };
  corner(x1 - r1, hw - r1, r1, 0);
  corner(x0 + r0, hw - r0, r0, Math.PI / 2);
  corner(x0 + r0, -hw + r0, r0, Math.PI);
  corner(x1 - r1, -hw + r1, r1, Math.PI * 1.5);
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const n = ring.length;
  // Sides: a bottom and a top vertex at each point of the outline.
  for (const [x, z, nx, nz] of ring) {
    pos.push(x, y0, z, x, y1, z);
    nor.push(nx, 0, nz, nx, 0, nz);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    idx.push(2 * i, 2 * j + 1, 2 * j, 2 * i, 2 * i + 1, 2 * j + 1);
  }
  // Top and bottom: fans from the middle (the outline is convex).
  const cx = (x0 + x1) / 2;
  for (const [y, ny] of [
    [y1, 1],
    [y0, -1],
  ] as const) {
    const c = pos.length / 3;
    pos.push(cx, y, 0);
    nor.push(0, ny, 0);
    for (const [x, z] of ring) {
      pos.push(x, y, z);
      nor.push(0, ny, 0);
    }
    for (let i = 0; i < n; i++) {
      const a = c + 1 + i;
      const b = c + 1 + ((i + 1) % n);
      if (ny > 0) idx.push(c, b, a);
      else idx.push(c, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** Muni's worm: "muni" in one unbroken line (the letters share their stems), red on clear. */
function wormTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 160, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#c8102e';
    ctx.fillStyle = '#c8102e';
    ctx.lineWidth = 24;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const s = 70;
    const r = s / 2;
    const x0 = (w - 5 * s) / 2;
    const top = 72;
    const foot = 138;
    ctx.beginPath();
    // m (two humps), down into u's bowl, up into n's hump, down into i's bowl and up the i.
    ctx.moveTo(x0, foot);
    ctx.lineTo(x0, top);
    ctx.arc(x0 + r, top, r, Math.PI, 0);
    ctx.arc(x0 + s + r, top, r, Math.PI, 0);
    ctx.lineTo(x0 + 2 * s, foot - r);
    ctx.arc(x0 + 2 * s + r, foot - r, r, Math.PI, 0, true);
    ctx.lineTo(x0 + 3 * s, top);
    ctx.arc(x0 + 3 * s + r, top, r, Math.PI, 0);
    ctx.lineTo(x0 + 4 * s, foot - r);
    ctx.arc(x0 + 4 * s + r, foot - r, r, Math.PI, 0, true);
    ctx.lineTo(x0 + 5 * s, top);
    // m's middle stem.
    ctx.moveTo(x0 + s, top);
    ctx.lineTo(x0 + s, foot);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x0 + 5 * s, top - 42, 14, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * A Muni light-rail car, the Siemens S200 SF that runs the N Judah: two sections on three trucks,
 * silver under a black window band with Muni's red belt line, both of them wrapping round the
 * rounded cab at each end, glass doors, the worm on each flank, destination signs front, back and
 * on the sides, and a pantograph reaching up to the wire. Its body is `dims` (TRAM_DIMS.streetcar:
 * length along x, width across z, height to the top of the roof gear); the signs use `signMat` and
 * the windows `glassMat`.
 */
export function buildStreetcar(signMat: THREE.Material, glassMat: THREE.Material, dims: { length: number; width: number; height: number }): THREE.Group {
  const group = new THREE.Group();
  group.name = 'streetcar';
  const paint = new GeoBuilder();
  const glass = new GeoBuilder();
  const metal = new GeoBuilder();
  const lamps = new GeoBuilder();
  const signs = new GeoBuilder();
  const decals = new GeoBuilder();
  const SILVER = '#e2e5e8';
  const RED = '#c8102e';
  const ROOF = '#c4c9cf';
  const DARK = '#34383e';
  const IRON = '#2a2d32';
  const hl = dims.length / 2;
  const hw = dims.width / 2;
  // Heights are drawn for a 3.6 m car and scaled to `dims`.
  const f = dims.height / 3.6;
  const CAB = 0.75;
  const JOINT = 0.32;
  const add = (g: THREE.BufferGeometry, b: GeoBuilder, color: THREE.ColorRepresentation): void => b.add(g, color);

  // Two sections, each rounded at its cab end, joined by the bellows in the middle. The livery is a
  // stack of bands (skirt, silver, the red belt, the window band, silver, the roof).
  for (const xs of [-1, 1]) {
    const x0 = xs < 0 ? -hl : JOINT;
    const x1 = xs < 0 ? -JOINT : hl;
    const r0 = xs < 0 ? CAB : 0.12;
    const r1 = xs < 0 ? 0.12 : CAB;
    const slab = (y0: number, y1: number, grow: number, b: GeoBuilder, color: THREE.ColorRepresentation): void =>
      add(roundedSlab(x0 - grow, x1 + grow, hw + grow, r0 + grow, r1 + grow, y0 * f, y1 * f), b, color);
    slab(0.3, 0.62, -0.06, paint, DARK);
    slab(0.58, 1.12, 0, paint, SILVER);
    slab(1.1, 1.3, 0.012, paint, RED);
    slab(1.28, 2.62, 0.006, glass, '#ffffff');
    slab(2.6, 3.16, 0, paint, SILVER);
    slab(3.12, 3.24, -0.07, paint, ROOF);
    slab(3.22, 3.28, -0.3, paint, ROOF);
    // Doors: two double doors a side, dark glass in a silver frame.
    const secL = x1 - x0;
    const cabEnd = xs < 0 ? x0 : x1;
    for (const u of [0.25, 0.7]) {
      const dx = cabEnd - xs * u * secL;
      for (const zs of [-1, 1]) {
        box(paint, dx - 0.69, dx + 0.69, 0.34 * f, 2.66 * f, zs * (hw - 0.02), zs * (hw + 0.014), SILVER);
        box(glass, dx - 0.62, dx + 0.62, 0.4 * f, 2.58 * f, zs * (hw - 0.02), zs * (hw + 0.02), '#ffffff');
        box(paint, dx - 0.025, dx + 0.025, 0.4 * f, 2.58 * f, zs * (hw - 0.02), zs * (hw + 0.026), SILVER);
        box(paint, dx - 0.62, dx + 0.62, 1.12 * f, 1.18 * f, zs * (hw - 0.02), zs * (hw + 0.026), SILVER);
      }
    }
    // Roof gear: an air-conditioning pod on each section.
    const ac = xs * hl * 0.62;
    rbox(paint, ac - 1.1, ac + 1.1, 3.24 * f, 3.5 * f, -0.8, 0.8, 0.08, '#d3d7dc');
    box(paint, ac - 0.9, ac + 0.9, 3.5 * f, 3.54 * f, -0.55, 0.55, ROOF);
    // Destination signs on the side (in the silver above the windows), the worm below the belt.
    const mid = xs * (hl + JOINT) * 0.54;
    for (const zs of [-1, 1]) {
      const sg = new THREE.PlaneGeometry(1.15, 0.24 * f);
      sg.rotateY(zs > 0 ? 0 : Math.PI);
      sg.translate(mid, 2.8 * f, zs * (hw + 0.009));
      signs.add(sg, '#ffffff');
      box(paint, mid - 0.63, mid + 0.63, 2.66 * f, 2.94 * f, zs * (hw - 0.02), zs * (hw + 0.003), '#15161a');
      const wg = new THREE.PlaneGeometry(1.47, 0.46);
      wg.rotateY(zs > 0 ? 0 : Math.PI);
      wg.translate(mid, 0.85 * f, zs * (hw + 0.004));
      decals.add(wg, '#ffffff');
    }
  }
  // The bellows between the sections, ribbed.
  box(paint, -JOINT - 0.02, JOINT + 0.02, 0.45 * f, 3.12 * f, -(hw - 0.12), hw - 0.12, '#2b2e33');
  for (const rx of [-0.22, -0.07, 0.07, 0.22]) box(paint, rx - 0.03, rx + 0.03, 0.45 * f, 3.12 * f, -(hw - 0.08), hw - 0.08, '#454a51');

  // The cab ends: a bumper, headlights and red marker lamps, and the destination sign at the top of
  // the windscreen.
  for (const xs of [-1, 1]) {
    const x = xs * hl;
    const b0 = x - xs * 0.2;
    const b1 = x + xs * 0.12;
    rbox(paint, Math.min(b0, b1), Math.max(b0, b1), 0.36 * f, 0.62 * f, -0.5, 0.5, 0.05, DARK);
    for (const zs of [-1, 1]) {
      const hg = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16);
      hg.rotateZ(Math.PI / 2);
      hg.translate(x + xs * 0.01, 0.88 * f, zs * 0.34);
      lamps.add(hg, '#ffffff');
      const tg = new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12);
      tg.rotateZ(Math.PI / 2);
      tg.translate(x + xs * 0.005, 0.88 * f, zs * 0.52);
      paint.add(tg, '#e02530');
    }
    const sg = new THREE.PlaneGeometry(1.15, 0.26 * f);
    sg.rotateY(xs * (Math.PI / 2));
    sg.translate(x + xs * 0.014, 2.44 * f, 0);
    signs.add(sg, '#ffffff');
  }

  // Three trucks on the rails (standard gauge, 1.435 m), mostly hidden behind the skirt.
  for (const tx of [-(hl - 2.3), 0, hl - 2.3]) {
    box(metal, tx - 1.15, tx + 1.15, 0.3, 0.62, -0.95, 0.95, IRON);
    for (const wx of [tx - 0.9, tx + 0.9]) {
      for (const wz of [-0.7175, 0.7175]) {
        const g = new THREE.CylinderGeometry(0.33, 0.33, 0.12, 18);
        g.rotateX(Math.PI / 2);
        g.translate(wx, 0.33, wz);
        metal.add(g, '#3b3e44');
      }
    }
  }

  // The pantograph on the first section's roof: a frame on insulators, a single folding arm up to
  // the collector head on the wire.
  {
    const px = -hl * 0.3;
    const base = 3.3 * f;
    const top = STREETCAR_WIRE_Y;
    box(metal, px - 0.75, px + 0.75, base, base + 0.08, -0.6, 0.6, '#5e646c');
    for (const ix of [px - 0.6, px + 0.6]) {
      for (const iz of [-0.45, 0.45]) cyl(paint, [ix, 3.22 * f, iz], [ix, base, iz], 0.07, 0.08, 8, '#f1efe8');
    }
    const hinge: V3 = [px - 0.6, base + 0.12, 0];
    const knee: V3 = [px + 0.8, base + (top - base) * 0.52, 0];
    const head: V3 = [px - 0.25, top - 0.08, 0];
    for (const zs of [-1, 1]) cyl(metal, [hinge[0], hinge[1], zs * 0.3], [knee[0], knee[1], zs * 0.05], 0.045, 0.045, 6, '#6a7079');
    cyl(metal, knee, head, 0.035, 0.035, 6, '#6a7079');
    cyl(metal, [px - 0.25, base + 0.1, 0], [(knee[0] + head[0]) / 2, (knee[1] + head[1]) / 2, 0], 0.02, 0.02, 5, '#6a7079');
    const kg = new THREE.SphereGeometry(0.07, 10, 8);
    kg.translate(knee[0], knee[1], knee[2]);
    metal.add(kg, '#4a4f57');
    // The collector head: a bar across on its springs, the carbon strip on top, horns at the ends.
    box(metal, head[0] - 0.07, head[0] + 0.07, top - 0.1, top - 0.04, -0.72, 0.72, '#3a3d42');
    box(metal, head[0] - 0.04, head[0] + 0.04, top - 0.04, top, -0.62, 0.62, '#17181b');
    for (const zs of [-1, 1]) cyl(metal, [head[0], top - 0.07, zs * 0.72], [head[0], top - 0.22, zs * 0.9], 0.02, 0.02, 5, '#3a3d42');
  }

  const paintMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.12 });
  const metalMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.4 });
  const lampMat = new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: '#fff2cc', emissiveIntensity: 1.2, roughness: 0.3 });
  const decalMat = new THREE.MeshStandardMaterial({ map: wormTexture(), alphaTest: 0.5, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  group.add(meshOf(paint, paintMat, 'streetcarBody', true, true));
  group.add(meshOf(glass, glassMat, 'streetcarGlass', false, false));
  group.add(meshOf(metal, metalMat, 'streetcarGear', true, false));
  group.add(meshOf(lamps, lampMat, 'streetcarLamps', false, false));
  group.add(meshOf(signs, signMat, 'streetcarSigns', false, false));
  group.add(meshOf(decals, decalMat, 'streetcarWorm', false, true));
  return group;
}

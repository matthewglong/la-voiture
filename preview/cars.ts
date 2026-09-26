// Dev-only showroom for src/scene/carMesh.ts: every part option, a few full builds, and a build-time benchmark.
// Open /preview/cars.html?view=<overview|chassis|wheels|engines|tanks|wings|noses|boosters|toppers|full>.
import * as THREE from 'three';
import { startPreview, type PreviewView } from './harness';
import { buildCarMesh, type CarMesh } from '../src/scene/carMesh';
import { PARTS, defaultConfig } from '../src/parts';
import type { CarConfig } from '../src/types';

type Spec = Partial<CarConfig> & {
  throttle?: number;
  nitro?: number;
  kite?: boolean;
  accent?: string;
  /** Yaw override (the flight camera sees cars side-on) and pitch in radians. */
  yaw?: number;
  pitch?: number;
};

const P1 = '#ff5a36';
const P2 = '#2e8bff';
const base = (over: Spec): Spec => ({
  chassis: 'kart',
  wheels: 'standard',
  engine: 'mower',
  fuel: 'jerry',
  wing: 'none',
  nose: 'blunt',
  booster: 'none',
  paint: 'red',
  topper: 'none',
  ...over,
});

const ROWS: { name: string; cars: Spec[] }[] = [
  {
    name: 'chassis',
    cars: [
      base({ chassis: 'kart', paint: 'red' }),
      base({ chassis: 'tub', paint: 'yellow', accent: P2 }),
      base({ chassis: 'sedan', paint: 'teal' }),
      base({ chassis: 'pickup', paint: 'blue', accent: P2 }),
    ],
  },
  {
    name: 'wheels',
    cars: [
      base({ wheels: 'tiny', paint: 'orange' }),
      base({ wheels: 'standard', paint: 'orange' }),
      base({ wheels: 'monster', paint: 'orange' }),
      base({ chassis: 'pickup', wheels: 'monster', paint: 'grape' }),
    ],
  },
  {
    name: 'engines',
    cars: [
      base({ engine: 'mower', paint: 'lime' }),
      base({ engine: 'v8', paint: 'lime', throttle: 1 }),
      base({ engine: 'jet', paint: 'lime', throttle: 1 }),
      base({ chassis: 'sedan', engine: 'v8', paint: 'pink', throttle: 0.6 }),
      base({ chassis: 'pickup', engine: 'jet', paint: 'yellow', throttle: 0.5 }),
    ],
  },
  {
    name: 'tanks',
    cars: [
      base({ fuel: 'jerry', paint: 'grape' }),
      base({ fuel: 'tank', paint: 'grape' }),
      base({ fuel: 'big', paint: 'grape' }),
      base({ chassis: 'sedan', fuel: 'jerry', paint: 'yellow' }),
      base({ chassis: 'sedan', fuel: 'tank', paint: 'yellow' }),
      base({ chassis: 'sedan', fuel: 'big', paint: 'yellow' }),
    ],
  },
  {
    name: 'wings',
    cars: [
      base({ wing: 'none', paint: 'teal' }),
      base({ wing: 'spoiler', paint: 'teal' }),
      base({ wing: 'glider', paint: 'teal' }),
      base({ chassis: 'sedan', wing: 'spoiler', paint: 'red' }),
      base({ chassis: 'sedan', wing: 'glider', paint: 'red' }),
    ],
  },
  {
    name: 'noses',
    cars: [
      base({ chassis: 'sedan', nose: 'blunt', paint: 'blue' }),
      base({ chassis: 'sedan', nose: 'wedge', paint: 'blue' }),
      base({ chassis: 'sedan', nose: 'cone', paint: 'blue' }),
      base({ nose: 'blunt', paint: 'pink' }),
      base({ nose: 'wedge', paint: 'pink' }),
      base({ nose: 'cone', paint: 'pink' }),
    ],
  },
  {
    name: 'boosters',
    cars: [
      base({ booster: 'nitro', paint: 'yellow', nitro: 1 }),
      base({ booster: 'kite', paint: 'yellow' }),
      base({ booster: 'kite', paint: 'yellow', kite: true }),
      base({ chassis: 'pickup', booster: 'nitro', paint: 'lime', nitro: 0.7, accent: P2 }),
      base({ chassis: 'tub', booster: 'kite', paint: 'pink', kite: true, accent: P2 }),
    ],
  },
  {
    name: 'toppers',
    cars: [
      base({ topper: 'tophat', paint: 'red' }),
      base({ chassis: 'pickup', topper: 'tophat', paint: 'teal' }),
      base({ chassis: 'pickup', topper: 'flag', paint: 'teal' }),
      base({ chassis: 'pickup', topper: 'duck', paint: 'teal', accent: P2 }),
      base({ chassis: 'pickup', topper: 'cone', paint: 'teal' }),
    ],
  },
  {
    name: 'full',
    cars: [
      base({ wheels: 'monster', engine: 'jet', fuel: 'big', wing: 'glider', nose: 'cone', booster: 'kite', kite: true, throttle: 1, paint: 'orange', topper: 'duck' }),
      base({ chassis: 'pickup', wheels: 'monster', engine: 'v8', fuel: 'big', wing: 'spoiler', nose: 'wedge', booster: 'nitro', nitro: 1, paint: 'red', topper: 'flag', accent: P2 }),
      base({ chassis: 'tub', engine: 'jet', fuel: 'big', wing: 'glider', nose: 'cone', booster: 'kite', throttle: 0.7, paint: 'teal', topper: 'tophat' }),
      base({ chassis: 'sedan', wheels: 'monster', engine: 'jet', fuel: 'big', wing: 'spoiler', nose: 'cone', booster: 'nitro', paint: 'grape', topper: 'cone', accent: P2 }),
      base({ chassis: 'tub', wheels: 'monster', engine: 'v8', fuel: 'tank', wing: 'spoiler', nose: 'wedge', booster: 'nitro', paint: 'lime', topper: 'flag' }),
      base({ chassis: 'sedan', wheels: 'tiny', engine: 'v8', fuel: 'jerry', wing: 'glider', nose: 'wedge', booster: 'kite', paint: 'pink', topper: 'duck' }),
      base({ chassis: 'pickup', wheels: 'standard', engine: 'jet', fuel: 'tank', wing: 'glider', nose: 'cone', booster: 'kite', kite: true, paint: 'yellow', topper: 'tophat', accent: P2 }),
      base({ chassis: 'kart', wheels: 'tiny', engine: 'v8', fuel: 'big', wing: 'spoiler', nose: 'wedge', booster: 'nitro', paint: 'blue', topper: 'flag' }),
    ],
  },
];

ROWS.push({
  name: 'sideline',
  cars: [
    base({ yaw: 0, wing: 'glider', booster: 'kite', kite: true, engine: 'jet', fuel: 'big', throttle: 0, paint: 'yellow', topper: 'flag' }),
    base({ yaw: 0, pitch: -0.5, wing: 'glider', booster: 'kite', kite: true, paint: 'orange', topper: 'duck' }),
    base({ yaw: 0, pitch: 0.35, chassis: 'sedan', engine: 'jet', fuel: 'big', booster: 'nitro', nitro: 1, paint: 'teal', topper: 'tophat' }),
    base({ yaw: 0, chassis: 'pickup', wheels: 'monster', engine: 'v8', throttle: 1, fuel: 'tank', wing: 'glider', nose: 'cone', paint: 'red', accent: P2 }),
    base({ yaw: 0, chassis: 'tub', wheels: 'tiny', engine: 'mower', throttle: 1, fuel: 'jerry', booster: 'kite', kite: true, paint: 'pink', topper: 'cone' }),
  ],
});

const SPACING = 7.5;
const ROW_GAP = 14;
const YAW = -0.5;

const views: Record<string, PreviewView> = {
  overview: { pos: [28, 70, 42], target: [22, 0, -52] },
};
ROWS.forEach((row, i) => {
  const z = -i * ROW_GAP;
  const cx = ((row.cars.length - 1) * SPACING) / 2;
  const d = Math.max(9, row.cars.length * 3.1 + 2);
  views[row.name] = { pos: [cx, 2.6 + d * 0.16, z + d], target: [cx, 0.9, z - 1.5] };
});
{
  const i = ROWS.length - 1;
  const z = -i * ROW_GAP;
  const cx = ((ROWS[i].cars.length - 1) * SPACING) / 2;
  views['sideline-far'] = { pos: [cx, 6, z + 40], target: [cx, 2, z] };
}
// Singles for close inspection: ?view=car-<row>-<index>
ROWS.forEach((row, i) =>
  row.cars.forEach((_c, j) => {
    const z = -i * ROW_GAP;
    const x = j * SPACING;
    views[`car-${row.name}-${j}`] = { pos: [x + 3.2, 2.6, z + 5.6], target: [x, 1.0, z] };
    views[`rear-${row.name}-${j}`] = { pos: [x - 5.2, 3.2, z + 3.4], target: [x, 1.0, z] };
    views[`side-${row.name}-${j}`] = { pos: [x + 1.8, 1.6, z + 7.5], target: [x, 1.0, z] };
  }),
);

function toConfig(s: Spec): CarConfig {
  const cfg = defaultConfig(0);
  for (const k of Object.keys(cfg) as (keyof CarConfig)[]) if (s[k]) cfg[k] = s[k]!;
  return cfg;
}

startPreview({
  defaultView: 'overview',
  views,
  build: (scene) => {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0xe6e1d6, roughness: 0.9 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const cars: CarMesh[] = [];
    ROWS.forEach((row, i) => {
      row.cars.forEach((spec, j) => {
        const car = buildCarMesh(toConfig(spec), { accent: spec.accent ?? P1 });
        car.group.position.set(j * SPACING, 0, -i * ROW_GAP);
        car.group.rotation.y = spec.yaw ?? YAW;
        car.group.rotation.z = spec.pitch ?? 0;
        car.setWheelRotation(0.4 * j);
        if (spec.throttle) car.setThrottle(spec.throttle);
        if (spec.nitro) car.setNitro(spec.nitro);
        if (spec.kite) car.setKiteOpen(true);
        scene.add(car.group);
        cars.push(car);
      });
    });

    // Build-time benchmark: 100 random configs (caches are warm after the showroom).
    const rnd = (n: number): number => Math.floor(Math.random() * n);
    const configs: CarConfig[] = [];
    for (let i = 0; i < 100; i++) {
      const cfg = defaultConfig(0);
      for (const slot of Object.keys(PARTS) as (keyof typeof PARTS)[]) cfg[slot] = PARTS[slot][rnd(PARTS[slot].length)].id;
      configs.push(cfg);
    }
    const t0 = performance.now();
    for (const cfg of configs) buildCarMesh(cfg, { accent: P2 }).dispose();
    const avg = (performance.now() - t0) / configs.length;
    console.log(`[cars] average buildCarMesh time over 100 random configs: ${avg.toFixed(2)} ms`);

    const params = new URLSearchParams(location.search);
    if (params.get('stress') === '1') {
      // Every performance combination with every topper: must build without throwing, NaN or oversize.
      const slots = ['chassis', 'wheels', 'engine', 'fuel', 'wing', 'nose', 'booster', 'topper'] as const;
      let count = 0;
      let bad = 0;
      let maxW = 0;
      const box = new THREE.Box3();
      const size = new THREE.Vector3();
      const walk = (i: number, cfg: CarConfig): void => {
        if (i === slots.length) {
          try {
            const car = buildCarMesh(cfg, { accent: P1 });
            car.setKiteOpen(true);
            car.setThrottle(1);
            car.setNitro(1);
            car.update(0.016, 1);
            box.setFromObject(car.group);
            box.getSize(size);
            if (!Number.isFinite(size.x + size.y + size.z)) bad++;
            maxW = Math.max(maxW, size.z);
            car.dispose();
          } catch (e) {
            bad++;
            if (bad < 5) console.log('[cars] build failed', JSON.stringify(cfg), String(e));
          }
          count++;
          return;
        }
        for (const o of PARTS[slots[i]]) walk(i + 1, { ...cfg, [slots[i]]: o.id });
      };
      const t1 = performance.now();
      walk(0, defaultConfig(0));
      console.log(`[cars] stress: ${count} builds, ${bad} bad, max width ${maxW.toFixed(2)} m, ${((performance.now() - t1) / count).toFixed(3)} ms each`);
      const visibleBox = (root: THREE.Object3D): THREE.Box3 => {
        root.updateMatrixWorld(true);
        const out = new THREE.Box3();
        const tmp = new THREE.Box3();
        const visit = (o: THREE.Object3D): void => {
          if (!o.visible) return;
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
            out.union(tmp.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld));
          }
          o.children.forEach(visit);
        };
        visit(root);
        return out;
      };
      for (const c of ['kart', 'tub', 'sedan', 'pickup']) {
        const car = buildCarMesh({ ...defaultConfig(0), chassis: c, wheels: 'standard', engine: 'v8', fuel: 'tank' });
        visibleBox(car.group).getSize(size);
        console.log(`[cars] ${c}: length ${size.x.toFixed(2)} m, height ${size.y.toFixed(2)} m, width ${size.z.toFixed(2)} m`);
        car.dispose();
      }
    }
    const spinWheels = params.get('spin') === '1';
    let dist = 0;
    return {
      update: (dt: number, t: number) => {
        dist += dt * 6;
        for (const c of cars) {
          c.update(dt, t);
          if (spinWheels) c.setWheelRotation(dist / c.wheelRadius);
        }
      },
    };
  },
});

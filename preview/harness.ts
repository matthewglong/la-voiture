// Dev-only preview harness: renders one scene module with the game's lighting and named camera views.
// Open /preview/<name>.html?view=<view>. window.__previewReady turns true after the first frames.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWorld } from '../src/scene/world';

export interface PreviewView {
  pos: [number, number, number];
  target: [number, number, number];
  fov?: number;
}

export interface PreviewModule {
  update?(dt: number, t: number): void;
}

declare global {
  interface Window {
    __previewReady?: boolean;
  }
}

export function startPreview(opts: {
  build: (scene: THREE.Scene) => PreviewModule | void;
  views: Record<string, PreviewView>;
  defaultView: string;
  /** Adds a flat placeholder bay at y=0 (the real animated water lives in the game). */
  water?: boolean;
}): void {
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0';
  document.body.appendChild(host);
  const world = createWorld(host);
  const { scene, camera, renderer } = world;

  if (opts.water) {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(12000, 12000),
      new THREE.MeshStandardMaterial({ color: 0x1f5f7a, roughness: 0.25, metalness: 0.1 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.02;
    water.receiveShadow = true;
    scene.add(water);
  }

  const mod = opts.build(scene) || {};
  const params = new URLSearchParams(location.search);
  const view = opts.views[params.get('view') ?? opts.defaultView] ?? opts.views[opts.defaultView];
  camera.position.set(...view.pos);
  if (view.fov) {
    camera.fov = view.fov;
    camera.updateProjectionMatrix();
  }
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...view.target);
  controls.update();
  world.setShadowFocus(new THREE.Vector3(...view.target), 90);

  window.addEventListener('resize', () => world.resize());
  const timer = new THREE.Timer();
  let frames = 0;
  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    const t = timer.getElapsed();
    mod.update?.(dt, t);
    controls.update();
    world.render();
    if (++frames === 5) window.__previewReady = true;
  });
}

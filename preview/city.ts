// Dev preview of the SF street, pier and kicker.
// /preview/city.html?view=start|startLow|midhill|chase2|intersection|pier|kicker|embarcadero|aerial[&stats=1]
import * as THREE from 'three';
import { buildCity } from '../src/scene/city';
import { startPreview } from './harness';

startPreview({
  water: true,
  defaultView: 'start',
  views: {
    start: { pos: [-12, 44, 0], target: [40, 30, 0] },
    startLow: { pos: [-9, 40.5, 0], target: [8, 37.2, 0] },
    midhill: { pos: [95, 30, 0], target: [125, 20, 0] },
    chase1: { pos: [36, 39, 0], target: [66, 29, 2] },
    chase2: { pos: [168, 18, 0], target: [200, 8, 0] },
    chase3: { pos: [228, 12, 0], target: [262, 5, 0] },
    sideFar: { pos: [330, 16, 110], target: [320, 6, 0] },
    intersection: { pos: [96, 33, 44], target: [75, 26, 8] },
    cablecar: { pos: [66, 29.5, 26], target: [75, 27, 13] },
    houses: { pos: [30, 33.5, -3], target: [42, 32, 14] },
    housesL: { pos: [100, 26, 4], target: [112, 24, -14] },
    pier: { pos: [280, 14, 70], target: [285, 5, 0] },
    kicker: { pos: [305, 11, 26], target: [297, 6, 0] },
    embarcadero: { pos: [205, 16, 40], target: [240, 6, 0] },
    aerial: { pos: [-120, 170, 230], target: [120, 10, 0] },
  },
  build: (scene: THREE.Scene) => {
    const t0 = performance.now();
    const city = buildCity();
    const buildMs = performance.now() - t0;
    scene.add(city.group);
    if (new URLSearchParams(location.search).has('stats')) {
      let calls = 0;
      let tris = 0;
      city.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        calls++;
        const g = m.geometry;
        tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      });
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;left:8px;top:8px;background:#000a;color:#fff;font:14px monospace;padding:6px 8px;z-index:9';
      div.textContent = `city meshes (draw calls/pass): ${calls}  triangles: ${Math.round(tris).toLocaleString()}  build: ${buildMs.toFixed(0)} ms`;
      document.body.appendChild(div);
    }
    return { update: (dt: number, t: number) => city.update(dt, t) };
  },
});

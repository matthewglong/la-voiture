// Dev preview for src/scene/landmarks.ts: /preview/landmarks.html?view=flight
import * as THREE from 'three';
import { startPreview } from './harness';
import { buildLandmarks } from '../src/scene/landmarks';

declare global {
  interface Window {
    __lmInfo?: { calls: number; triangles: number; landmarkDrawables: number; landmarkTriangles: number };
  }
}

startPreview({
  water: true,
  defaultView: 'flight',
  views: {
    flight: { pos: [400, 18, 90], target: [400, 10, 0] },
    flightWide: { pos: [420, 30, 160], target: [420, 20, 0] },
    launch: { pos: [305, 12, 70], target: [305, 8, 0] },
    start: { pos: [-12, 44, 0], target: [60, 28, 0] },
    chase: { pos: [120, 34, 0], target: [200, 20, 0] },
    sealions: { pos: [263, 5.5, 31], target: [270, 0.7, 16.5] },
    alcatraz: { pos: [850, 48, -40], target: [1000, 28, -200] },
    bridge: { pos: [120, 75, -760], target: [-60, 105, -1000] },
    headlands: { pos: [700, 80, -300], target: [1300, 120, -1300] },
    overview: { pos: [-600, 900, 1400], target: [800, 0, -400] },
  },
  build: (scene) => {
    const lm = buildLandmarks();
    scene.add(lm.group);
    // Tuning knobs: ?oc=<hex multiplier>&oe=<hex emissive> for the bridge's orange material.
    const q = new URLSearchParams(location.search);
    const orange = lm.group.getObjectByName('bridge-orange') as THREE.Mesh | undefined;
    const om = orange?.material as THREE.MeshStandardMaterial | undefined;
    if (om && q.get('oc')) om.color.set(`#${q.get('oc')}`);
    if (om && q.get('oe')) om.emissive.set(`#${q.get('oe')}`);
    // Stand-in for the pier and kicker (the real ones live in city.ts).
    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(51, 0.5, 16),
      new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.8 }),
    );
    pier.position.set((253 + 304) / 2, 3.75, 0);
    pier.castShadow = true;
    pier.receiveShadow = true;
    pier.frustumCulled = false; // always rendered, so onAfterRender can hand us the renderer
    scene.add(pier);

    let renderer: THREE.WebGLRenderer | null = null;
    pier.onAfterRender = (r) => {
      renderer = r;
    };
    let frame = 0;
    return {
      update: (dt: number, t: number) => {
        lm.update(dt, t);
        if (++frame === 20 && renderer) {
          const r: THREE.WebGLRenderer = renderer;
          let drawables = 0;
          let lmTriangles = 0;
          lm.group.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh || (o as THREE.Sprite).isSprite) drawables++;
            if (m.isMesh) lmTriangles += (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3;
          });
          window.__lmInfo = { calls: r.info.render.calls, triangles: r.info.render.triangles, landmarkDrawables: drawables, landmarkTriangles: lmTriangles };
          document.title = `calls=${r.info.render.calls} tris=${r.info.render.triangles} drawables=${drawables}`;
        }
      },
    };
  },
});

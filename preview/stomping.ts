// Dev preview of Old Stomping Grounds' scenery (as the game builds it: the venue and the course's
// shared start line and gantry).
// /preview/stomping.html?view=aerial|start|ramp|dogs|summit|lawn|steps|ladies|hayes|shops|green|
//   page|mint|duboce|wall|bv|switchbacks|haight|panhandle[&stats=1]   or ?pos=x,y,z&target=x,y,z
import * as THREE from 'three';
import { OLD_STOMPING_GROUNDS_MAP } from '../src/maps';
import { OLD_STOMPING_GROUNDS as C, osgMark } from '../src/maps/oldStompingGrounds';
import { mapScene } from '../src/scene/maps';
import { pointAt } from '../src/track';
import { startPreview, type PreviewView } from './harness';

/** A chase-like view: `back` metres behind the course point at s, `up` above it, looking ahead. */
function along(s: number, back = 14, up = 6, ahead = 16): PreviewView {
  const p = pointAt(C, s);
  const q = pointAt(C, s + ahead);
  return { pos: [p.x - p.tx * back, p.y + up, p.z - p.tz * back], target: [q.x, q.y + 1.5, q.z] };
}
/** Looking at the course point at s from the side (`side` metres to its right, + left). */
function beside(s: number, side: number, up: number, look = 0): PreviewView {
  const p = pointAt(C, s);
  return { pos: [p.x - p.tz * side, p.y + up, p.z + p.tx * side], target: [p.x + p.tx * look, p.y + 2, p.z + p.tz * look] };
}

const m = osgMark;
const params = new URLSearchParams(location.search);
const vec = (k: string): [number, number, number] | null => {
  const v = params.get(k)?.split(',').map(Number);
  return v && v.length === 3 && v.every(Number.isFinite) ? (v as [number, number, number]) : null;
};
const custom = vec('pos') && vec('target') ? { pos: vec('pos')!, target: vec('target')! } : null;

startPreview({
  defaultView: custom ? 'custom' : 'aerial',
  views: {
    ...(custom ? { custom } : {}),
    aerial: { pos: [-120, 300, 330], target: [150, 0, -30] },
    top: { pos: [135, 520, 1], target: [135, 0, 0] },
    start: along(C.startS - 14),
    ramp: along(m('scott', 'hayes') - 12),
    dogs: along(m('alamo', 'dogs') + 10),
    summit: along(m('alamo', 'summit') - 6),
    lawn: along(m('alamo', 'lawn') - 4, 14, 5, 20),
    tourists: beside(m('alamo', 'lawn') + 24, 18, 3, 0),
    steps: along(m('alamo', 'stepsTop') - 16, 12, 5, 20),
    ladies: along(m('alamo', 'ladies') - 8, 14, 5, 26),
    postcard: { pos: [0, 0, 0], target: [0, 0, 0] },
    hayes: along(m('hayes', 'hayes') - 6, 14, 6, 30),
    shops: along(m('hayes', 'shops') - 4, 12, 4, 24),
    green: along(m('green', 'green') - 10, 14, 6, 24),
    page: along(m('mint', 'page') - 4, 14, 5, 24),
    mint: along(m('mint', 'mint') - 10, 14, 6, 24),
    duboce: along(m('duboce', 'rails') - 4, 14, 5, 30),
    park: along(m('duboce', 'park') - 6, 14, 5, 20),
    wall: along(m('wall', 'wall') - 6, 14, 4, 30),
    bv: along(m('buenaVista', 'in') + 10, 12, 5, 18),
    switchbacks: along(m('buenaVista', 'switchbacks') - 4, 12, 7, 20),
    haight: along(m('haight', 'haight') + 4, 14, 5, 26),
    panhandle: along(m('oak', 'oak') + 6, 14, 5, 30),
  },
  build: (scene, world) => {
    const t0 = performance.now();
    const sc = mapScene(OLD_STOMPING_GROUNDS_MAP, world);
    const buildMs = performance.now() - t0;
    scene.add(sc.group);
    // For scripts: the scene (to count what's in it).
    (window as unknown as { __scene: THREE.Scene }).__scene = scene;
    if (params.has('stats')) {
      let calls = 0;
      let tris = 0;
      sc.group.traverse((o) => {
        const mm = o as THREE.Mesh;
        if (!mm.isMesh) return;
        calls++;
        const g = mm.geometry;
        tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      });
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;left:8px;top:8px;background:#000a;color:#fff;font:14px monospace;padding:6px 8px;z-index:9';
      div.textContent = `meshes: ${calls}  triangles: ${Math.round(tris).toLocaleString()}  build: ${buildMs.toFixed(0)} ms`;
      document.body.appendChild(div);
    }
    return { update: (dt: number, t: number) => sc.update(dt, t, []) };
  },
});

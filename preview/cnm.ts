// Dev preview of Castro, Noe & Mission's scenery (as the game builds it: the venue and the course's
// shared start line and gantry).
// /preview/cnm.html?view=aerial|top|start|castro|crosswalks|milk|hill|summit|steep|noe|square|
//   dolores24|drop|calle|farolito|drafthouse|cancun|e18|women|birite|doloresSt|gate|park|top|church|
//   drop19|rails|basilica|market[&stats=1]   or ?pos=x,y,z&target=x,y,z
import * as THREE from 'three';
import { CASTRO_NOE_MISSION_MAP } from '../src/maps';
import { CASTRO_NOE_MISSION as C, cnmMark } from '../src/maps/castroNoeMission';
import { mapScene } from '../src/scene/maps';
import { pointAt } from '../src/track';
import { startPreview, type PreviewView } from './harness';

/** A chase-like view: `back` metres behind the course point at s, `up` above it, looking ahead. */
function along(s: number, back = 14, up = 6, ahead = 16): PreviewView {
  const p = pointAt(C, s);
  const q = pointAt(C, s + ahead);
  return { pos: [p.x - p.tx * back, p.y + up, p.z - p.tz * back], target: [q.x, q.y + 1.5, q.z] };
}

const m = cnmMark;
const params = new URLSearchParams(location.search);
const vec = (k: string): [number, number, number] | null => {
  const v = params.get(k)?.split(',').map(Number);
  return v && v.length === 3 && v.every(Number.isFinite) ? (v as [number, number, number]) : null;
};
const custom = vec('pos') && vec('target') ? { pos: vec('pos')!, target: vec('target')! } : null;
// The middle of the course, for the overviews.
let mx = 0;
let mz = 0;
for (const p of C.points) {
  mx += p.x / C.points.length;
  mz += p.z / C.points.length;
}

startPreview({
  defaultView: custom ? 'custom' : 'aerial',
  views: {
    ...(custom ? { custom } : {}),
    aerial: { pos: [mx - 260, 320, mz + 260], target: [mx, 0, mz] },
    overhead: { pos: [mx, 560, mz + 1], target: [mx, 0, mz] },
    start: along(C.startS - 14),
    castro: along(m('castro', 'castro') - 10, 14, 6, 30),
    crosswalks: along(m('castro', '18th') - 12, 14, 7, 18),
    milk: along(m('castro', 'milk') - 4, 14, 5, 24),
    hill: along(m('castro', 'hill') - 4, 14, 6, 30),
    summit: along(m('castro', '22nd') - 16, 14, 6, 26),
    steep: along(m('castro', 'steep') - 6, 14, 6, 26),
    noe: along(m('noe', 'noe') - 4, 14, 5, 26),
    square: along(m('noe', 'square') - 10, 14, 5, 22),
    dolores24: along(m('mission24', 'dolores') - 14, 14, 6, 22),
    drop: along(m('mission24', 'drop') - 4, 14, 7, 28),
    calle: along(m('mission24', 'calle') - 4, 14, 5, 26),
    farolito: along(m('missionSt', 'farolito') - 8, 14, 5, 26),
    drafthouse: along(m('missionSt', 'drafthouse') - 6, 14, 5, 26),
    cancun: along(m('missionSt', 'cancun') - 6, 14, 5, 26),
    e18: along(m('eighteenth', 'e18') - 4, 14, 5, 26),
    women: along(m('eighteenth', 'women') - 6, 14, 5, 24),
    birite: along(m('eighteenth', 'birite') - 6, 14, 5, 24),
    doloresSt: along(m('dolores', 'dolores') - 4, 14, 5, 26),
    gate: along(m('dolores', 'gate') - 10, 14, 6, 20),
    park: along(m('dolores', 'hill') - 4, 12, 6, 22),
    top: along(m('dolores', 'top') - 14, 12, 7, 18),
    church: along(m('dolores', 'church') - 4, 14, 6, 26),
    drop19: along(m('dolores', '19th') - 10, 14, 6, 26),
    rails: along(m('church', 'rails') - 6, 14, 5, 30),
    basilica: along(m('church', '16th') - 14, 14, 6, 20),
    market: along(m('market', 'market') + 6, 14, 5, 40),
  },
  build: (scene, world) => {
    const t0 = performance.now();
    const sc = mapScene(CASTRO_NOE_MISSION_MAP, world);
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

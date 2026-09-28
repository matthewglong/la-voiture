// Dev preview of the Twin Peaks loop's scenery.
// /preview/twinpeaks.html?view=aerial|start|climb|summit|drop|sweeper|city[&stats=1]
// or any view: ?pos=x,y,z&target=x,y,z
import * as THREE from 'three';
import { TWIN_PEAKS } from '../src/maps/twinPeaks';
import { buildTwinPeaks } from '../src/scene/twinPeaks';
import { pointAt } from '../src/track';
import { startPreview, type PreviewView } from './harness';

/** A chase-like view: `back` metres behind the course point at s, `up` above it, looking ahead. */
function along(s: number, back = 16, up = 7, ahead = 14): PreviewView {
  const p = pointAt(TWIN_PEAKS, s);
  const q = pointAt(TWIN_PEAKS, s + ahead);
  return { pos: [p.x - p.tx * back, p.y + up, p.z - p.tz * back], target: [q.x, q.y + 1, q.z] };
}

const sec = (name: string): number => TWIN_PEAKS.sections.find((q) => q.name === name)!.s0;
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
    aerial: { pos: [-260, 260, -320], target: [40, 10, 170] },
    start: along(TWIN_PEAKS.startS - 12),
    climb: along(sec('The Switchbacks') + 40),
    summit: along(sec('Summit Hairpin') - 30, 22, 10, 30),
    drop: along(sec('The Drop') + 30, 18, 6, 30),
    sweeper: along(sec('The Sweeper') + 10),
    city: { pos: [120, 60, 290], target: [120, 0, -600] },
  },
  build: (scene: THREE.Scene) => {
    const t0 = performance.now();
    const tp = buildTwinPeaks();
    const buildMs = performance.now() - t0;
    scene.add(tp.group);
    if (params.has('stats')) {
      let calls = 0;
      let tris = 0;
      tp.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        calls++;
        const g = m.geometry;
        tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      });
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;left:8px;top:8px;background:#000a;color:#fff;font:14px monospace;padding:6px 8px;z-index:9';
      div.textContent = `meshes: ${calls}  triangles: ${Math.round(tris).toLocaleString()}  build: ${buildMs.toFixed(0)} ms`;
      document.body.appendChild(div);
    }
    return { update: (dt: number, t: number) => tp.update(dt, t, []) };
  },
});

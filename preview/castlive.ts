// Dev-only: Old Stomping Grounds' cast live, in the real scenery: the race sim with two autopilot
// cars (plain stand-in boxes), and the camera on a dog (the one nearest the leading car), the
// streetcar, or the leading car. window.__previewReady turns true after the first frames.
// /preview/castlive.html?follow=dog|tram|car[&place=<s>][&tram=<along>][&seed=<n>][&side=<m>][&up=<m>]
//   [&pos=x,y,z&target=x,y,z]
//   place: start both cars at that arc length (the dog park is around 110-210, Duboce ~1000-1100);
//   tram: start the streetcar that far along its rails; pos/target: a fixed camera.
import * as THREE from 'three';
import { OLD_STOMPING_GROUNDS_MAP } from '../src/maps';
import { computeStats, defaultConfig } from '../src/parts';
import { Actors } from '../src/scene/actors';
import { mapScene } from '../src/scene/maps';
import { createWorld } from '../src/scene/world';
import { Bot } from '../src/sim/bot';
import { DT } from '../src/sim/physics';
import { RaceSim } from '../src/sim/race';

declare global {
  interface Window {
    __previewReady?: boolean;
  }
}

const params = new URLSearchParams(location.search);
const num = (k: string, d: number): number => (params.has(k) && Number.isFinite(Number(params.get(k))) ? Number(params.get(k)) : d);
const follow = params.get('follow') ?? 'dog';
const side = num('side', follow === 'tram' ? 16 : 3.2);
const up = num('up', follow === 'tram' ? 4 : 1.4);
const vec = (k: string): THREE.Vector3 | null => {
  const v = params.get(k)?.split(',').map(Number);
  return v && v.length === 3 && v.every(Number.isFinite) ? new THREE.Vector3(v[0], v[1], v[2]) : null;
};
const fixed = vec('pos') && vec('target') ? { pos: vec('pos')!, target: vec('target')! } : null;

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
const host = document.createElement('div');
host.style.cssText = 'position:fixed;inset:0';
document.body.appendChild(host);
const world = createWorld(host);
const { scene, camera } = world;
window.addEventListener('resize', () => world.resize());

const map = OLD_STOMPING_GROUNDS_MAP;
const sc = mapScene(map, world);
scene.add(sc.group);
const sim = new RaceSim([computeStats(defaultConfig(0)), computeStats(defaultConfig(1))], 0, { seed: num('seed', 7), obstacles: true, items: false }, map);
const bots = [new Bot(sim, 0, { aggression: 0.3 }), new Bot(sim, 1, { aggression: 0.5, skill: 0.97 })];
sim.start();
if (params.has('place')) {
  const s = num('place', 0);
  sim.place(0, s, -1.5, 12);
  sim.place(1, s - 12, 1.5, 12);
}
// ?tram=<along>: the streetcar starts there on its rails, heading back towards a0 (the Muni portal).
if (params.has('tram') && sim.cables[0]) {
  sim.cables[0].along = num('tram', 0);
  sim.cables[0].dir = -1;
}
const actors = new Actors();
scene.add(actors.group);
const stand = sim.cars.map((_, i) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.1, 1.7), new THREE.MeshStandardMaterial({ color: i ? '#2e8bff' : '#ff5a36', roughness: 0.4 }));
  m.castShadow = true;
  scene.add(m);
  return m;
});

const target = new THREE.Vector3();
const eye = new THREE.Vector3();
let first = true;
let acc = 0;
let t = 0;
let frames = 0;
const timer = new THREE.Timer();
world.renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  acc += dt;
  while (acc >= DT) {
    sim.step(bots.map((b) => b.decide()));
    acc -= DT;
  }
  t += dt;
  actors.update(dt, t, sim);
  sc.update(dt, t, sim.cars.map((c) => ({ x: c.x, z: c.z })));
  sim.cars.forEach((c, i) => {
    stand[i].position.set(c.x, c.y + 0.55, c.z);
    stand[i].rotation.y = -c.heading;
  });
  // What to look at, and from where (the side of it, a little behind).
  const lead = sim.cars.reduce((a, b) => (b.prog > a.prog ? b : a));
  let h = lead.heading;
  if (follow === 'tram' && sim.cables[0]) {
    const cb = sim.cables[0];
    target.set(cb.x, cb.y + 1.8, cb.z);
    h = cb.heading;
  } else if (follow === 'dog') {
    let best = Infinity;
    for (const p of sim.peds) {
      if (p.kind !== 'dog') continue;
      const d = (p.x - lead.x) ** 2 + (p.z - lead.z) ** 2;
      if (d < best) {
        best = d;
        target.set(p.x, p.y + 0.4, p.z);
      }
    }
  } else target.set(lead.x, lead.y + 0.8, lead.z);
  const want = new THREE.Vector3(target.x - Math.cos(h) * side * 0.6 - Math.sin(h) * side, target.y + up, target.z - Math.sin(h) * side * 0.6 + Math.cos(h) * side);
  // ?pos=x,y,z&target=x,y,z: a fixed camera instead.
  if (fixed) {
    want.copy(fixed.pos);
    target.copy(fixed.target);
  }
  if (first) eye.copy(want);
  else eye.lerp(want, 1 - Math.exp(-dt * 3));
  first = false;
  camera.position.copy(eye);
  camera.lookAt(target);
  actors.fadeFor(camera.position, sim.cars.map((c) => new THREE.Vector3(c.x, c.y, c.z)));
  world.setShadowFocus(target, 60);
  world.render();
  if (++frames === 5) window.__previewReady = true;
});

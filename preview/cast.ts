// Dev-only preview of the race's cast as src/scene/actors.ts draws it from the sim: every breed of
// dog in each of its states (trotting, galloping after a car and barking, resting, sniffing,
// leaping clear, and facing the camera), the N Judah streetcar beside a cable car, a map's own
// locals (strollers, drag queens, mariachis, paleteros, hipsters: walking and standing) and
// lowriders (cruising and stopped). The sim is faked: each row gets the fields the real sim would.
// /preview/cast.html?view=<row>|<row>1|<row>2|dogs|tram|tramside|tramback|pantograph|trams|locals|lowriders
//   rows: trot gallop rest sniff leap faces; <row>1 / <row>2 are its first and last four breeds.
//   &freeze=<seconds> runs the fake sim that long and holds the pose; &tramPitch=<rad> tips the
//   streetcar nose up (it faces +x).
import * as THREE from 'three';
import { Actors } from '../src/scene/actors';
import { TRAM_DIMS, type CableCar, type Ped, type PedDress, type RaceSim, type TramKind, type Waymo } from '../src/sim/race';
import { startPreview, type PreviewView } from './harness';

const params = new URLSearchParams(location.search);
const freeze = params.has('freeze') ? Number(params.get('freeze')) : null;
/** The streetcar's pitch (radians, nose up), as on a sloping line. */
const tramPitch = Number(params.get('tramPitch') ?? 0) || 0;

const BREEDS = 8;
const GAP = 1.7;
const ROWS = ['trot', 'gallop', 'rest', 'sniff', 'leap', 'faces'] as const;
type Row = (typeof ROWS)[number];
const rowZ = (r: Row): number => -ROWS.indexOf(r) * 6;

function dog(id: number, bi: number, row: Row): Ped {
  const color = bi + BREEDS * ((id * 3) % 7);
  // The resting rows: a target whose hash makes the dog's view sit, or sniff.
  let n = 0;
  while (((color + n) % 3 === 0) !== (row === 'sniff')) n++;
  return {
    id,
    kind: 'dog',
    x: bi * GAP,
    y: 0,
    z: rowZ(row),
    heading: row === 'faces' ? Math.PI / 2 : 0,
    s: 0,
    d: 0,
    d0: 0,
    d1: 0,
    dir: 1,
    speed: 0,
    wait: 0,
    down: 0,
    fallX: 1,
    fallZ: 0,
    dive: 0,
    walk: id * 1.7,
    look: 0,
    color,
    sMin: 0,
    sMax: 0,
    toS: n / 7,
    toD: 0,
    chaser: row === 'gallop',
    chaseP: -1,
    chase: 0,
    chaseCool: 0,
    bark: 0,
    pace: 0,
  };
}

/** What the sim would be doing with a dog in this row at time T. */
function drive(p: Ped, row: Row, T: number, dt: number): void {
  p.pace = 0;
  p.wait = 0;
  p.chase = 0;
  p.chaseP = -1;
  p.dive = 0;
  if (row === 'trot') p.pace = 2.4;
  else if (row === 'gallop') {
    p.pace = 10.5;
    p.chase = 2;
    p.chaseP = 0;
    p.bark = 0.5 - ((T + p.id * 0.13) % 0.5);
  } else if (row === 'rest' || row === 'sniff') p.wait = 3;
  else if (row === 'leap') {
    const c = T % 2.2;
    p.dive = c < 0.9 ? 0.9 - c : 0;
  }
  if (p.dive <= 0) p.walk += dt * (1 + p.pace * 0.9);
}

function tramOf(vehicle: TramKind, sign: string, x: number, z: number): CableCar {
  const d = TRAM_DIMS[vehicle];
  return {
    id: vehicle === 'streetcar' ? -1 : -2,
    x,
    y: 0,
    z,
    heading: 0,
    v: 0,
    ox: x,
    oz: z,
    ux: 1,
    uz: 0,
    along: 0,
    a0: 0,
    a1: 0,
    dir: 1,
    span: null,
    sign,
    dwell: 0,
    bell: 0,
    vehicle,
    length: d.length,
    width: d.width,
    height: d.height,
    cruise: d.cruise,
    circles: [],
    near: [],
    profile: null,
    pitch: 0,
  };
}

const TRAM_Z = 22;
const CABLE_Z = 34;
/** The locals' rows (one per look, four of each: the first two walking) and the lowriders'. */
const LOCAL_Z = -40;
const LOW_Z = -76;
const DRESSES: PedDress[] = ['stroller', 'drag', 'mariachi', 'paletero', 'hipster'];

function local(id: number, dress: PedDress, k: number): Ped {
  const standing = dress === 'mariachi' || k >= 2;
  return {
    ...dog(id, 0, 'trot'),
    kind: dress === 'mariachi' || dress === 'hipster' ? 'tourist' : 'crosser',
    dress,
    x: k * 3,
    z: LOCAL_Z - DRESSES.indexOf(dress) * 5,
    heading: 0.35,
    speed: standing ? 0 : 0.9,
    wait: standing && dress !== 'mariachi' && dress !== 'hipster' ? 3 : 0,
    walk: 0,
    color: k * 5 + 3,
  };
}

function lowrider(id: number, k: number): Waymo {
  return { id, kind: 'traffic', dress: 'lowrider', x: k * 6, y: 0, z: LOW_Z, heading: 0.3, v: k % 2 ? 0 : 3.5, stopped: 0, parked: false, hazard: false, cone: false, pvx: 0, pvz: 0 } as unknown as Waymo;
}
const views: Record<string, PreviewView> = {
  dogs: { pos: [6, 7, 12], target: [6, 0, -12] },
  tram: { pos: [14, 3.2, TRAM_Z + 7], target: [0, 1.8, TRAM_Z] },
  tramside: { pos: [0, 2.2, TRAM_Z - 13], target: [0, 1.9, TRAM_Z] },
  tramback: { pos: [-15, 4, TRAM_Z - 5], target: [0, 2, TRAM_Z] },
  pantograph: { pos: [1.5, 6.5, TRAM_Z + 5], target: [-2.3, 4.4, TRAM_Z] },
  trams: { pos: [24, 9, (TRAM_Z + CABLE_Z) / 2 + 4], target: [0, 1.5, (TRAM_Z + CABLE_Z) / 2] },
  locals: { pos: [4.5, 4, LOCAL_Z + 8], target: [4.5, 0.9, LOCAL_Z - 10] },
  lowriders: { pos: [18, 4.5, LOW_Z + 11], target: [18, 0.6, LOW_Z] },
};
for (const r of ROWS) {
  const z = rowZ(r);
  const side = r === 'faces' ? 3.6 : 3.4;
  views[r] = { pos: [5.95, 1.6, z + 7.5], target: [5.95, 0.35, z] };
  views[`${r}1`] = { pos: [2.55, 1.1, z + side], target: [2.55, 0.35, z] };
  views[`${r}2`] = { pos: [9.35, 1.1, z + side], target: [9.35, 0.35, z] };
}

startPreview({
  defaultView: 'dogs',
  views,
  build: (scene) => {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#8cc262', roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(60, 26), new THREE.MeshStandardMaterial({ color: '#6b7078', roughness: 0.9 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, (TRAM_Z + CABLE_Z) / 2);
    road.receiveShadow = true;
    scene.add(road);

    const actors = new Actors();
    scene.add(actors.group);
    const rows: { p: Ped; row: Row }[] = [];
    let id = 1;
    for (const row of ROWS) for (let bi = 0; bi < BREEDS; bi++) rows.push({ p: dog(id++, bi, row), row });
    const locals: Ped[] = [];
    for (const d of DRESSES) for (let k = 0; k < 4; k++) locals.push(local(id++, d, k));
    const lows: Waymo[] = [];
    for (let k = 0; k < 7; k++) lows.push(lowrider(id++, k));
    const sim = {
      waymos: lows,
      peds: [...rows.map((r) => r.p), ...locals],
      poos: [],
      boxes: [],
      cones: [],
      gulls: [],
      cables: [{ ...tramOf('streetcar', 'N JUDAH', 0, TRAM_Z), pitch: tramPitch }, tramOf('cable', 'POWELL & HYDE', 0, CABLE_Z)],
      cars: [{ x: 3.5 * GAP, z: rowZ('gallop') + 3 }],
    } as unknown as RaceSim;
    let clock = 0;
    const step = (dt: number): void => {
      clock += dt;
      for (const r of rows) drive(r.p, r.row, clock, dt);
      for (const p of locals) p.walk += dt;
      actors.update(dt, clock, sim);
    };
    step(0);
    let held = false;
    return {
      update: (dt: number) => {
        if (freeze === null) step(dt);
        else if (!held) {
          while (clock < freeze) step(1 / 60);
          held = true;
        }
      },
    };
  },
});

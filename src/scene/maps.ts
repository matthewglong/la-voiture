// Each map's scenery behind one interface, so the game shell doesn't care which map is up: the
// static world, the start gantry the chase camera looks through, and the few things that move or
// only some maps have (the kicker, the Bay's water and its record buoy).
import * as THREE from 'three';
import type { MapDef } from '../maps';
import { buildBay } from './bay';
import { buildCity } from './city';
import { buildLandmarks } from './landmarks';
import { buildTwinPeaks } from './twinPeaks';
import type { World } from './world';

export interface MapScene {
  group: THREE.Group;
  /** The start gantry (the chase camera fades it out when it looks through it), or null. */
  gantry: THREE.Object3D | null;
  /** Per frame: `cars` are the racers on the road (the crowd cheers as they pass). */
  update(dt: number, t: number, cars: { x: number; z: number }[]): void;
  /** Long jump: stand the kicker at an angle; `alarm` flashes its lamps while it drops. */
  setRamp?(angle: number, alarm: boolean, t: number): void;
  /** The water's height, for a car floating in it. */
  waterHeight?(x: number, z: number, t: number): number;
  /** The session's best jump, marked in the water (null hides it). */
  setBest?(distance: number | null, name?: string, color?: string): void;
  /** Just before a view is drawn with this camera. */
  beforeRender?(camera: THREE.Camera): void;
}

function russianHill(world: World): MapScene {
  const group = new THREE.Group();
  group.name = 'russian-hill';
  const city = buildCity();
  const landmarks = buildLandmarks();
  const bay = buildBay({ envMap: world.skyEnv, anisotropy: world.renderer.capabilities.getMaxAnisotropy() });
  group.add(city.group, landmarks.group, bay.group);
  return {
    group,
    gantry: city.group.getObjectByName('startGantry') ?? null,
    update(dt, t, cars) {
      city.update(dt, t, cars);
      landmarks.update(dt, t);
      bay.update(t);
    },
    setRamp: (angle, alarm, t) => city.kicker.set(angle, alarm, t),
    waterHeight: (x, z, t) => bay.waveHeight(x, z, t),
    setBest: (d, name, color) => bay.setBest(d, name, color),
    beforeRender: (cam) => bay.labelsFor(cam),
  };
}

const BUILDERS: Record<string, (world: World) => MapScene> = {
  'russian-hill': russianHill,
  'twin-peaks': () => buildTwinPeaks(),
};

const built = new Map<string, MapScene>();

/** A map's scenery (built the first time it's asked for, then kept). */
export function mapScene(map: MapDef, world: World): MapScene {
  let scene = built.get(map.id);
  if (!scene) {
    const build = BUILDERS[map.id];
    if (!build) throw new Error(`No scenery for map ${map.id}`);
    scene = build(world);
    built.set(map.id, scene);
  }
  return scene;
}

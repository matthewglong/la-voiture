// Scenery. Each venue builds only what's its own (Russian Hill: the city, the landmarks; Twin
// Peaks: the hills and Sutro Tower), registered below under the venue's id. Everything a course
// implies is added here the same way for every map: the start line, the grid and the start gantry
// (and a finish gantry on a point-to-point course with a finish line), and, on a course that ends
// in a kicker, the kicker and the water beyond it with its distance buoys. So a new map gets all
// of that for free, and a change to any of it shows up on every map.
//
// The scenery is built once per venue and shared by every event there; setEvent dresses it for
// the event in play (the finish band on the kicker for a race to the lip, the finish gantry).
import * as THREE from 'three';
import type { MapDef } from '../maps';
import type { Course } from '../track';
import { buildBay, type Bay } from './bay';
import { buildCity } from './city';
import { buildCastroNoeMission } from './cnm';
import { buildKicker, type Kicker } from './kicker';
import { buildLandmarks } from './landmarks';
import { buildOldStompingGrounds } from './osg';
import { buildTrackside } from './trackside';
import { buildTwinPeaks } from './twinPeaks';
import type { World } from './world';

/** What a venue builds: its own world, and anything in it that moves. */
export interface VenueScene {
  group: THREE.Group;
  /** Per frame: `cars` are the racers on the road (the crowd cheers as they pass). */
  update(dt: number, t: number, cars: { x: number; z: number }[]): void;
  /** Just before a view is drawn with this camera. */
  beforeRender?(camera: THREE.Camera): void;
}

/** A map's scenery: its venue's, plus the course's shared furniture, behind one interface so the
 *  game shell doesn't care which map is up. */
export interface MapScene {
  group: THREE.Group;
  /** The start gantry (the chase camera fades it out when it looks through it). */
  gantry: THREE.Object3D | null;
  /** Per frame: `cars` are the racers on the road (the crowd cheers as they pass). */
  update(dt: number, t: number, cars: { x: number; z: number }[]): void;
  /** Dress the scenery for the event in play. */
  setEvent(map: MapDef): void;
  /** A course with a lip: stand the kicker at an angle; `alarm` flashes its lamps while it drops. */
  setRamp?(angle: number, alarm: boolean, t: number): void;
  /** The water's height (its wave offset from the lip's water level), for a car floating in it. */
  waterHeight?(x: number, z: number, t: number): number;
  /** The session's best jump, marked in the water (null hides it). */
  setBest?(distance: number | null, name?: string, color?: string): void;
  /** Just before a view is drawn with this camera. */
  beforeRender?(camera: THREE.Camera): void;
}

/** Each venue's own scenery, by venue id (src/maps: Venue.id). */
const VENUES: Record<string, (world: World) => VenueScene> = {
  'russian-hill': () => {
    const group = new THREE.Group();
    const city = buildCity();
    const landmarks = buildLandmarks();
    group.add(city.group, landmarks.group);
    return {
      group,
      update(dt, t, cars) {
        city.update(dt, t, cars);
        landmarks.update(dt, t);
      },
    };
  },
  'twin-peaks': () => buildTwinPeaks(),
  'old-stomping-grounds': () => buildOldStompingGrounds(),
  'castro-noe-mission': () => buildCastroNoeMission(),
};

/** A venue's scenery with the course's shared furniture on top. */
function compose(venueId: string, course: Course, world: World): MapScene {
  const build = VENUES[venueId];
  if (!build) throw new Error(`No scenery for venue ${venueId}`);
  const venue = build(world);
  const group = new THREE.Group();
  group.name = venueId;
  group.add(venue.group);
  const trackside = buildTrackside(course);
  group.add(trackside.group);
  let kicker: Kicker | null = null;
  let bay: Bay | null = null;
  if (course.lip) {
    kicker = buildKicker(course);
    bay = buildBay(
      course.lip,
      course.grid.map((g) => g.d),
      { envMap: world.skyEnv, anisotropy: world.renderer.capabilities.getMaxAnisotropy() },
    );
    group.add(kicker.group, bay.group);
  }
  const k = kicker;
  const b = bay;
  return {
    group,
    gantry: trackside.gantry,
    update(dt, t, cars) {
      venue.update(dt, t, cars);
      trackside.update(t);
      b?.update(t);
    },
    setEvent(map) {
      // A race finishes at the lip (the chequered band on the kicker) or at the finish line.
      const race = map.rules.score === 'time';
      k?.setFinish(race);
      if (trackside.finish) trackside.finish.visible = race;
    },
    setRamp: k ? (angle, alarm, t) => k.set(angle, alarm, t) : undefined,
    waterHeight: b ? (x, z, t) => b.waveHeight(x, z, t) : undefined,
    setBest: b ? (d, name, color) => b.setBest(d, name, color) : undefined,
    beforeRender(cam) {
      venue.beforeRender?.(cam);
      b?.labelsFor(cam);
    },
  };
}

const built = new Map<string, MapScene>();

/** A map's scenery: its venue's (built the first time any event there asks for it, then kept and
 *  shared by every event on that venue), dressed for this event. */
export function mapScene(map: MapDef, world: World): MapScene {
  let scene = built.get(map.venue);
  if (!scene) {
    scene = compose(map.venue, map.course, world);
    built.set(map.venue, scene);
  }
  scene.setEvent(map);
  return scene;
}

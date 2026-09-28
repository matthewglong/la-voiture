// What every part of Old Stomping Grounds' scenery shares while it's built: the course and its
// chunks, the ground, one geometry builder per material (so the whole map merges into a few dozen
// draw calls), a record of which ground is taken (roads, parks, landmarks, houses) so nothing is
// built on top of anything else, and a few helpers for placing things along the course or in a
// chunk's frame.
import * as THREE from 'three';
import { osgChunk, osgMark } from '../../maps/oldStompingGrounds';
import { pointAt, type Course, type LaidChunk } from '../../track';
import { GeoBuilder } from '../geo';
import type { HouseSinks, HouseSite } from '../victorian';

/** Twin Peaks' two summits far off to the southwest (x, z, height above the land round them, spread):
 *  the ground (index.ts) raises them and Sutro Tower stands on the first (skyline.ts). */
export const TWIN_PEAKS_SUMMITS: [number, number, number, number][] = [
  [-420, 1150, 150, 190],
  [-640, 1210, 140, 170],
];

/** One builder per material (see buildOldStompingGrounds for what each material is). */
export interface Sinks extends HouseSinks {
  asphalt: GeoBuilder;
  /** Park paths: pale asphalt. */
  path: GeoBuilder;
  marks: GeoBuilder;
  concrete: GeoBuilder;
  /** Sidewalks: scored slabs (paving.ts's texture, a UV unit to 3 m), kerbs. */
  sidewalk: GeoBuilder;
  facades: GeoBuilder;
  foliage: GeoBuilder;
  hedge: GeoBuilder;
  metal: GeoBuilder;
  /** Anything painted: benches, signs' frames, awnings, containers, sculpture... */
  paint: GeoBuilder;
  /** Shiny paint (clearcoat): the Talking Heads, cars, the streetcar's portal trim. */
  gloss: GeoBuilder;
  stone: GeoBuilder;
  /** Lit things: lamp globes, shop windows at dusk. */
  glow: GeoBuilder;
}

/** Which ground is taken, on a metre grid. */
export class Occupancy {
  private readonly cells: Uint8Array;
  constructor(
    readonly x0: number,
    readonly z0: number,
    readonly nx: number,
    readonly nz: number,
  ) {
    this.cells = new Uint8Array(nx * nz);
  }

  private idx(x: number, z: number): number {
    const i = Math.floor(x - this.x0);
    const j = Math.floor(z - this.z0);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return -1;
    return j * this.nx + i;
  }

  taken(x: number, z: number): boolean {
    const k = this.idx(x, z);
    return k >= 0 && this.cells[k] !== 0;
  }

  /** Mark a disc taken. */
  disc(x: number, z: number, r: number): void {
    for (let i = Math.floor(x - r); i <= Math.ceil(x + r); i++) {
      for (let j = Math.floor(z - r); j <= Math.ceil(z + r); j++) {
        if ((i + 0.5 - x) ** 2 + (j + 0.5 - z) ** 2 <= r * r) {
          const k = this.idx(i + 0.5, j + 0.5);
          if (k >= 0) this.cells[k] = 1;
        }
      }
    }
  }

  /** The cells of a convex or concave polygon (a list of [x, z]): call fn on each cell centre. */
  private eachIn(poly: readonly (readonly [number, number])[], fn: (k: number) => boolean | void): boolean {
    let xa = Infinity;
    let xb = -Infinity;
    let za = Infinity;
    let zb = -Infinity;
    for (const [x, z] of poly) {
      xa = Math.min(xa, x);
      xb = Math.max(xb, x);
      za = Math.min(za, z);
      zb = Math.max(zb, z);
    }
    for (let i = Math.floor(xa); i <= Math.ceil(xb); i++) {
      for (let j = Math.floor(za); j <= Math.ceil(zb); j++) {
        const cx = i + 0.5;
        const cz = j + 0.5;
        let inside = false;
        for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
          const p = poly[a];
          const q = poly[b];
          if (p[1] > cz !== q[1] > cz && cx < ((q[0] - p[0]) * (cz - p[1])) / (q[1] - p[1]) + p[0]) inside = !inside;
        }
        if (!inside) continue;
        const k = this.idx(cx, cz);
        if (k < 0) continue;
        if (fn(k) === false) return false;
      }
    }
    return true;
  }

  /** Mark a polygon taken. */
  claim(poly: readonly (readonly [number, number])[]): void {
    this.eachIn(poly, (k) => {
      this.cells[k] = 1;
    });
  }

  /** Is all of a polygon free? */
  free(poly: readonly (readonly [number, number])[]): boolean {
    return this.eachIn(poly, (k) => this.cells[k] === 0);
  }
}

export interface Ctx {
  course: Course;
  chunk(id: string): LaidChunk;
  /** A chunk's mark (arc length). */
  mark(chunk: string, name: string): number;
  /** The finished ground's height. */
  ground(x: number, z: number): number;
  rng: () => number;
  sinks: Sinks;
  /** Houses stand on the ground (see victorian.ts). */
  site: HouseSite;
  occ: Occupancy;
  /** For meshes with their own materials (textured signs and the like). */
  group: THREE.Group;
  /** Per-frame animation. */
  updaters: ((dt: number, t: number, cars: { x: number; z: number }[]) => void)[];
}

/** What a neighbourhood's builder hands back: stretches of the course's sides where the streets
 *  shouldn't put a sidewalk (`noWalk`) or a row of houses (`noHouses`: it brings its own, or it's a
 *  park), extra frontages for the houses to fill (a street of its own), and the corners where it
 *  puts up its own street-name signs (`ownSigns`, world x, z: the standard green pole stays away).
 *  side: +1 right. */
export interface Hood {
  noWalk?(s: number, side: 1 | -1): boolean;
  noHouses?(s: number, side: 1 | -1): boolean;
  frontages?: import('../victorian').Frontage[];
  ownSigns?: [number, number][];
}

export function makeSinks(): Sinks {
  const b = (): GeoBuilder => new GeoBuilder();
  return {
    walls: b(),
    trim: b(),
    glass: b(),
    asphalt: b(),
    path: b(),
    marks: b(),
    concrete: b(),
    sidewalk: b(),
    facades: b(),
    foliage: b(),
    hedge: b(),
    metal: b(),
    paint: b(),
    gloss: b(),
    stone: b(),
    glow: b(),
  };
}

/** The chunk and mark lookups every module uses. */
export const chunkOf = osgChunk;
export const markOf = osgMark;

/** World position (and road height, heading) at arc length s, `d` metres to the right. */
export function along(c: Course, s: number, d: number): { x: number; y: number; z: number; heading: number; tx: number; tz: number } {
  const p = pointAt(c, s);
  return { x: p.x - p.tz * d, y: p.y, z: p.z + p.tx * d, heading: p.heading, tx: p.tx, tz: p.tz };
}

/** A matrix placing a thing at (x, y, z), its local +x along `heading` (+z to its right). */
export function placeAt(x: number, y: number, z: number, heading: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeRotationY(-heading).setPosition(x, y, z);
}

/** A rectangle (u along `heading`, v to its right) as a polygon of world [x, z]. */
export function rectPoly(cx: number, cz: number, heading: number, u0: number, u1: number, v0: number, v1: number): [number, number][] {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  const pt = (u: number, v: number): [number, number] => [cx + u * c - v * s, cz + u * s + v * c];
  return [pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)];
}

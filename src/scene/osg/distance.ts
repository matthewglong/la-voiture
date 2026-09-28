// Old Stomping Grounds: the city beyond the streets the course uses. Blocks of flats and houses on
// San Francisco's grid out to the haze (closer together near the course, thinning out, taller
// towards downtown), up the lower slopes of Twin Peaks but not over its grassy tops, and never on a
// road, a park or anything already built. Then the skyline itself (skyline.ts).
import * as THREE from 'three';
import type { CourseIndex } from '../terrain';
import { makeRng, smoothstep } from '../util';
import { HOUSE_COLORS, ROOF, worldUvBox } from '../victorian';
import { box } from '../geo';
import type { Ctx } from './context';
import { buildSkyline } from './skyline';

/** How far out the city goes (m from the map's middle). */
const REACH = 1400;
const MID_X = 135;
const MID_Z = -15;

export function buildDistance(ctx: Ctx, idx: CourseIndex, inPark: (x: number, z: number) => unknown): void {
  const rng = makeRng(2026);
  const S = ctx.sinks;
  // Rings of blocks: spacing grows with distance.
  const rings: [number, number, number][] = [
    [0, 320, 19],
    [320, 800, 28],
    [800, REACH, 44],
  ];
  for (const [r0, r1, step] of rings) {
    for (let gx = MID_X - r1; gx <= MID_X + r1; gx += step) {
      for (let gz = MID_Z - r1; gz <= MID_Z + r1; gz += step) {
        const x = gx + (rng() - 0.5) * step * 0.3;
        const z = gz + (rng() - 0.5) * step * 0.3;
        const r = Math.hypot(x - MID_X, z - MID_Z);
        if (r < r0 || r >= r1) continue;
        // Clear of the course (its own streets are lined already), parks and what's built.
        if (idx.nearest(x, z, 30)) continue;
        if (inPark(x, z)) continue;
        const w = step * (0.55 + rng() * 0.3);
        const d = step * (0.5 + rng() * 0.35);
        if (!ctx.occ.free([
          [x - w / 2, z - d / 2],
          [x + w / 2, z - d / 2],
          [x + w / 2, z + d / 2],
          [x - w / 2, z + d / 2],
        ])) continue;
        const y0 = Math.min(ctx.ground(x - w / 2, z - d / 2), ctx.ground(x + w / 2, z + d / 2), ctx.ground(x - w / 2, z + d / 2), ctx.ground(x + w / 2, z - d / 2));
        const y1 = Math.max(ctx.ground(x - w / 2, z - d / 2), ctx.ground(x + w / 2, z + d / 2));
        // Twin Peaks' tops are open grass.
        if (y1 > 70) continue;
        if (y1 - y0 > 9) continue;
        // Taller towards downtown (east), lower on the hills.
        const east = smoothstep(500, 1300, x) * smoothstep(900, 200, Math.abs(z + 200));
        const h = 7 + rng() * 6 + east * (8 + rng() * 22);
        const color = new THREE.Color(HOUSE_COLORS[Math.floor(rng() * HOUSE_COLORS.length)]).lerp(new THREE.Color('#e9e4d8'), 0.45 + rng() * 0.25);
        S.facades.add(worldUvBox(x - w / 2, x + w / 2, y0 - 1, y1 + h, z - d / 2, z + d / 2), color);
        box(S.walls, x - w / 2 + 0.3, x + w / 2 - 0.3, y1 + h - 0.02, y1 + h + 0.12, z - d / 2 + 0.3, z + d / 2 - 0.3, ROOF);
      }
    }
  }
  buildSkyline(ctx);
}

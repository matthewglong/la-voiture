// What stands on the sidewalks beside the course that race day works round: the shop doors (the
// crowd leaves them clear, so the shops stay readable behind their fans), and the poles, trees,
// tables and the like (the crowd stands clear of them, and a barrier stops short either side of
// one standing on its line). Each builder marks its own as it goes (streets.ts its lamps and trees);
// the race furniture (furniture.ts) reads them. One list per scene.
import type { Ctx } from './context';

export interface Kerbside {
  /** Shop doors: the middle of each, on its frontage. */
  doors: { x: number; z: number }[];
  /** Things standing on the sidewalk, r the radius of what they take up. */
  things: { x: number; z: number; r: number }[];
}

const lists = new WeakMap<Ctx, Kerbside>();

/** The scene's list (made on first use). */
export function kerbside(ctx: Ctx): Kerbside {
  let k = lists.get(ctx);
  if (!k) lists.set(ctx, (k = { doors: [], things: [] }));
  return k;
}

/** A shop door on the sidewalk: the middle of it, on the frontage. */
export function markDoor(ctx: Ctx, x: number, z: number): void {
  kerbside(ctx).doors.push({ x, z });
}

/** Something standing on the sidewalk (a pole, a tree, a table), r the radius it takes up. */
export function markThing(ctx: Ctx, x: number, z: number, r: number): void {
  kerbside(ctx).things.push({ x, z, r });
}

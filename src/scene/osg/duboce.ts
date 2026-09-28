// Duboce: the Mint's hill and Duboce Ave. Down Buchanan past the United States Mint on its rock
// (duboce/mint.ts), right onto Duboce Ave along the N Judah's tracks under its wire, from the Muni
// Metro portal behind the corner, past Church and Steiner (duboce/nJudah.ts); through Duboce Park,
// the dogs' park, to the Harvey Milk Center and the Sunset Tunnel's portal at its far end
// (duboce/park.ts); and up the Duboce Ave wall to Buena Vista, its sidewalks stepped and its cars
// parked nose-in to the kerb (duboce/wall.ts). Each part claims its ground and says which of the
// course's sides are its own (no row of houses there); the lettering is one mesh (duboce/signs.ts).
import type { Frontage } from '../victorian';
import type { Ctx, Hood } from './context';
import { buildMint } from './duboce/mint';
import { Near } from './duboce/near';
import { buildNJudah } from './duboce/nJudah';
import { buildDubocePark } from './duboce/park';
import { Decals } from './duboce/signs';
import { buildWall } from './duboce/wall';
import { PARK_KINDS, WALK } from './streets';

export function buildDuboce(ctx: Ctx): Hood {
  const decals = new Decals(ctx);
  // The road round about (a street keeps its sidewalks clear too, a park path its lawn).
  const near = new Near(ctx.course, ctx.mark('mint', 'page'), ctx.mark('wall', 'top') + 14, 1, (kind) => (PARK_KINDS.has(kind) ? 0 : WALK));
  const line = buildNJudah(ctx, decals, near);
  const mint = buildMint(ctx, decals);
  const park = buildDubocePark(ctx, decals, near, line.railsNear);
  const wall = buildWall(ctx, decals);
  const parts: Hood[] = [mint, line.hood, park, wall];
  decals.finish('duboceSigns');
  const frontages: Frontage[] = [];
  for (const h of parts) if (h.frontages) frontages.push(...h.frontages);
  return {
    noWalk: (s, side) => parts.some((h) => h.noWalk?.(s, side) ?? false),
    noHouses: (s, side) => parts.some((h) => h.noHouses?.(s, side) ?? false),
    frontages,
  };
}

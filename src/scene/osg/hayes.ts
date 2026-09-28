// Hayes Valley, round Old Stomping Grounds: the 500 block of Hayes with every shop on it where it
// really is (hayes/block.ts), lettered from one atlas of signs (hayes/signs.ts), Marine Layer and
// Suppenküche on the corners either end and the 21's trolley wires overhead (hayes/around.ts);
// Patricia's Green with the Talking Heads, Octavia's side lanes and the boulevard south of Fell
// (hayes/green.ts); Proxy's containers, the Biergarten and Blue Bottle down Linden (hayes/proxy.ts).
// All of it merged into the shared builders, but for the lettering: one mesh, one material, one
// 2048 × 1024 canvas.
import * as THREE from 'three';
import { pointAt } from '../../track';
import { GeoBuilder, meshOf } from '../geo';
import type { Ctx, Hood } from './context';
import { buildMarineLayer, buildSuppenkuche, hayesWires } from './hayes/around';
import { SignAtlas } from './hayes/atlas';
import { buildBlock } from './hayes/block';
import { BACK, buildGreen, greenFrame } from './hayes/green';
import type { Kit } from './hayes/kit';
import { buildProxy } from './hayes/proxy';
import { paintSigns } from './hayes/signs';
import { WALK, turnOf } from './streets';

export function buildHayes(ctx: Ctx): Hood {
  const c = ctx.course;
  const atlas = new SignAtlas();
  paintSigns(atlas);
  const k: Kit = { ctx, S: ctx.sinks, atlas, sign: new GeoBuilder(), rng: ctx.rng };

  // The two corners: off Hayes into the Green (the corner's centre is on the Green's middle), and
  // off Octavia onto Page.
  const turnAfter = (s: number): ReturnType<typeof turnOf> => {
    const sec = c.sections.find((q) => q.kind === 'corner' && q.s0 >= s - 1 && q.s0 < s + 12);
    if (!sec) throw new Error(`hayes: no corner after ${s.toFixed(0)}`);
    return turnOf(c, sec);
  };
  const sShops = ctx.mark('hayes', 'shops');
  const sOct = ctx.mark('hayes', 'octavia');
  const hayesTurn = turnAfter(sOct);
  const pageTurn = turnAfter(ctx.mark('green', 'page'));

  // The shops block (its north side runs to the sidewalk up Octavia, its south side to the buildings
  // along the Green), the corners either end, the wires.
  const p0 = pointAt(c, sShops + WALK);
  const aT = (hayesTurn.x - p0.x) * p0.tx + (hayesTurn.z - p0.z) * p0.tz;
  buildBlock(k, sShops, aT - (6.5 + WALK), aT - BACK);
  buildMarineLayer(k, hayesTurn);
  buildSuppenkuche(k, ctx.mark('hayes', 'laguna'));
  hayesWires(k, ctx.mark('hayes', 'hayes'), sOct);

  // The Green, Octavia, Proxy and Linden.
  const G = greenFrame(ctx, pageTurn, hayesTurn);
  const frontages = [...buildGreen(k, G), ...buildProxy(k, G)];

  ctx.group.add(meshOf(k.sign, new THREE.MeshStandardMaterial({ map: atlas.texture(), vertexColors: true, roughness: 0.55 }), 'hayesSigns', false, true));

  // The shops block brings its own buildings; the boulevard its own sidewalks (beyond its medians
  // and side lanes).
  const blvd = c.sections.find((q) => q.name === 'Octavia Blvd');
  return {
    noHouses: (s) => s >= sShops - 1 && s <= sOct + 1,
    noWalk: (s) => !!blvd && s >= blvd.s0 - 0.5 && s <= blvd.s1 + 0.5,
    frontages,
  };
}

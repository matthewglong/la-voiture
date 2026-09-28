// East of the Green: Proxy, the village of shipping containers on the two half-blocks either side
// of Linden Alley. North of Linden (Hayes to Linden): the black steel PROXY totem on the corner,
// LuxFit's black kiosk, the big angled outdoor-movie screen, the stack of charcoal containers that's
// Aether, the plaza of yellow and coral bistro chairs under string lights, Ritual Coffee's grey
// container kiosk facing the Green, and on the corner of Linden SF's Hometown Creamery (the old
// Smitten spot: red below, glass above). South of Linden to Fell: the Biergarten, fenced, its bar
// in containers and picnic tables in rows, a green container and a silver Airstream along Linden.
// Down Linden Alley itself (it climbs away east), on the south side, Blue Bottle's original kiosk:
// two garage-door counters under fold-up steel awnings, weathered grey planks above.
import * as THREE from 'three';
import { box, cyl, obox } from '../../geo';
import type { Frontage } from '../../victorian';
import { KERB } from '../streets';
import { BACK, LINDEN_HW, LINDEN_WALK, gPatch, type GreenFrame } from './green';
import { Frame, cafeSet, faceSign, faceSignDown, festoon, planter, streetTree, type Kit } from './kit';

/** A 20 ft container is 6.06 × 2.44 × 2.59 m. */
const CH = 2.59;
/** The lots' surfaces sit this far over the ground. */
const LOT = 0.04;

export function buildProxy(k: Kit, G: GreenFrame): Frontage[] {
  const ctx = k.ctx;
  const S = k.S;
  // The Green's frame as a matrix: local (v, y, d) to the world.
  const Mg = new THREE.Matrix4().makeBasis(new THREE.Vector3(G.gx, 0, G.gz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-G.gz, 0, G.gx)).setPosition(G.x0, 0, G.z0);
  /** The lots' surface at (v, d). */
  const ground = (v: number, d: number): number => {
    const [x, z] = G.at(v, d);
    return ctx.ground(x, z) + LOT;
  };
  const Y = (v: number, d: number): [number, number, number] => {
    const [x, z] = G.at(v, d);
    return [x, ctx.ground(x, z) + LOT, z];
  };
  /** What a box standing on the lot sits on: the lowest of its corners (it sinks at the others). */
  const base = (v0: number, v1: number, d0: number, d1: number): number => Math.min(ground(v0, d0), ground(v1, d0), ground(v0, d1), ground(v1, d1)) - 0.02;
  // Frames on faces (see kit.ts): facing west (the Green), north, south.
  const westFace = (v: number, d: number): Frame => {
    const [x, z] = G.at(v, d);
    return new Frame(x, z, -G.gx, -G.gz);
  };
  const northFace = (v: number, d: number): Frame => {
    const [x, z] = G.at(v, d);
    return new Frame(x, z, G.gz, -G.gx);
  };
  const southFace = (v: number, d: number): Frame => {
    const [x, z] = G.at(v, d);
    return new Frame(x, z, -G.gz, G.gx);
  };
  const claim = (v0: number, v1: number, d0: number, d1: number): void => {
    ctx.occ.claim([G.at(v0, d0), G.at(v1, d0), G.at(v1, d1), G.at(v0, d1)]);
  };
  /** A container, axis-aligned in the Green's frame, corrugated along its long sides; standing on
   *  the lot unless it's given a height (a stacked one). Returns its floor. */
  const container = (v0: number, v1: number, d0: number, d1: number, color: string, y0 = base(v0, v1, d0, d1)): number => {
    const dark = new THREE.Color(color).multiplyScalar(0.78);
    box(S.paint, v0, v1, y0, y0 + CH, d0, d1, color, Mg);
    box(S.paint, v0 - 0.02, v1 + 0.02, y0 + CH - 0.12, y0 + CH, d0 - 0.02, d1 + 0.02, dark, Mg);
    box(S.paint, v0 - 0.02, v1 + 0.02, y0, y0 + 0.14, d0 - 0.02, d1 + 0.02, dark, Mg);
    const alongV = Math.abs(v1 - v0) > Math.abs(d1 - d0);
    if (alongV) {
      for (let v = v0 + 0.35; v < v1 - 0.2; v += 0.55) for (const d of [d0, d1]) box(S.paint, v - 0.07, v + 0.07, y0 + 0.14, y0 + CH - 0.12, d - 0.03, d + 0.03, dark, Mg);
    } else {
      for (let d = Math.min(d0, d1) + 0.35; d < Math.max(d0, d1) - 0.2; d += 0.55) for (const v of [v0, v1]) box(S.paint, v - 0.03, v + 0.03, y0 + 0.14, y0 + CH - 0.12, d - 0.07, d + 0.07, dark, Mg);
    }
    return y0;
  };

  const vN0 = G.vWalk;
  const vLinden0 = G.vLinden - LINDEN_HW;
  const vLinden1 = G.vLinden + LINDEN_HW;
  const vN1 = vLinden0 - LINDEN_WALK;
  const vS0 = vLinden1 + LINDEN_WALK;
  const vS1 = G.vFellWalk;
  const dW = -BACK;
  const dE = -40;
  const dL = -60;

  // --- Linden Alley, east from Octavia and up the rise: asphalt, a narrow sidewalk each side.
  gPatch(ctx, G, S.asphalt, vLinden0, vLinden1, dW, dL, 0.03, '#ffffff', 6);
  gPatch(ctx, G, S.sidewalk, vN1, vLinden0, dW, dL, KERB, '#d9d3c6', 3);
  gPatch(ctx, G, S.sidewalk, vLinden1, vS0, dW, dL, KERB, '#d9d3c6', 3);
  claim(vN1, vS0, dW, dL);

  // --- Proxy, north of Linden: its asphalt, the containers and kiosks round the plaza.
  gPatch(ctx, G, S.asphalt, vN0, vN1, dW, dE, LOT, '#e8e4dc', 6);
  claim(vN0, vN1, dW, dE);
  {
    // The totem on the corner: a black steel slab, PROXY down it, facing Hayes and the plaza.
    const v = vN0 + 1.1;
    const d = dW - 0.8;
    const y = base(v - 0.2, v + 0.2, d - 0.46, d + 0.46);
    box(S.paint, v - 0.2, v + 0.2, y - 0.2, y + 5.4, d - 0.46, d + 0.46, '#161616', Mg);
    const r = k.atlas.get('proxy');
    faceSignDown(k, northFace(v - 0.21, d + 0.46), r, 0.46, y + 1.2, 3.5, 0);
    faceSignDown(k, southFace(v + 0.21, d - 0.46), r, 0.46, y + 1.2, 3.5, 0);
  }
  // LuxFit's kiosk: a black container along the sidewalk.
  const lux0 = vN0 + 2.4;
  const lux1 = lux0 + 4.6;
  {
    const y = container(lux0, lux1, dW - 0.4, dW - 2.84, '#1c1c1e');
    faceSign(k, westFace(lux1, dW - 0.4), k.atlas.get('luxfit'), (lux1 - lux0) / 2, y + 1.75, 0.46, -0.04);
    box(S.paint, lux0 + 1.2, lux0 + 3.2, y + 0.15, y + 1.6, dW - 0.43, dW - 0.36, '#3a3a3c', Mg);
  }
  // The outdoor-movie screen: a big white sheet angled at the plaza, on black steel legs.
  {
    // (Turned so it faces south-west, over the plaza to the Green: its face is along +v, +d.)
    const v = vN0 + 1.6;
    const d = dW - 7.8;
    const ang = -0.42;
    const nv = Math.cos(ang);
    const nd = -Math.sin(ang);
    const y = ground(v, d);
    obox(S.paint, [v, y + 4.7, d], [0.12, 3.9, 7.2], [0, ang, 0], '#f6f6f2', Mg);
    obox(S.paint, [v - nv * 0.12, y + 4.7, d - nd * 0.12], [0.12, 4.1, 7.4], [0, ang, 0], '#1b1b1b', Mg);
    for (const e of [-3.2, 3.2]) {
      const pv = v + Math.sin(ang) * e - nv * 0.4;
      const pd = d + Math.cos(ang) * e - nd * 0.4;
      box(S.metal, pv - 0.1, pv + 0.1, ground(pv, pd) - 0.2, y + 6.7, pd - 0.1, pd + 0.1, '#1b1b1b', Mg);
    }
  }
  // Aether: two containers by two, charcoal, the lower ones glazed at their west ends.
  {
    const d0 = dW - 11.6;
    const d1 = d0 - 6.06;
    const y = base(vN0 + 0.4, vN0 + 5.3, d0, d1);
    for (let row = 0; row < 2; row++) {
      const v0 = vN0 + 0.4 + row * 2.46;
      for (let lvl = 0; lvl < 2; lvl++) container(v0, v0 + 2.44, d0, d1, lvl ? '#3a3c40' : '#34363a', y + lvl * CH);
      box(S.glass, v0 + 0.2, v0 + 2.24, y + 0.2, y + 2.4, d0 + 0.02, d0 + 0.06, '#ffffff', Mg);
    }
    const a = k.atlas.get('aether');
    faceSign(k, westFace(vN0 + 5.3, d0 + 0.07), a, 2.45, y + CH + 0.55, 1.45, -0.02);
    faceSign(k, northFace(vN0 + 0.37, d0), a, 3.03, y + CH + 0.6, 1.3, -0.02);
  }
  // Ritual Coffee's kiosk: a grey container facing the Green, a glass door, a walk-up window, the
  // round sign; orange planters out front.
  const rit1 = vN1 - 3.4;
  const rit0 = rit1 - 4.5;
  {
    const y = container(rit0, rit1, dW - 0.4, dW - 2.84, '#8f9499');
    const f = westFace(rit1, dW - 0.42);
    // (u runs north from the kiosk's south end.)
    box(S.glass, 3.4, 4.3, y + 0.15, y + 2.3, -0.06, 0.0, '#ffffff', f.m);
    box(S.paint, 0.7, 2.9, y + 0.95, y + 1.85, -0.05, 0.0, '#2a2622', f.m);
    box(S.paint, 0.6, 3.0, y + 0.9, y + 1.0, -0.4, 0.0, '#b5895a', f.m);
    const r = k.atlas.get('ritual');
    faceSign(k, f, r, 1.8, y + 1.9, 0.64, -0.08);
    faceSign(k, northFace(rit0 - 0.04, dW - 0.4), r, 1.22, y + 0.9, 1.0, -0.02);
    for (const v of [rit0 + 0.6, rit1 - 0.6]) {
      const [x, yy, z] = Y(v, dW + 1.1);
      planter(k, x, Math.max(yy, G.roadY(v)) + KERB, z, Math.atan2(G.gz, G.gx), 1.0, 0.7, '#e8742c', '#d9573a');
    }
  }
  // SF's Hometown Creamery on the corner of Linden: red below, glass above, a white fascia.
  {
    const v0 = vN1 - 3.1;
    const v1 = vN1 - 0.1;
    const d0 = dW - 0.4;
    const d1 = dW - 3.6;
    const y = base(v0, v1, d0, d1);
    box(S.paint, v0, v1, y - 0.2, y + 1.0, d0, d1, '#e23b3b', Mg);
    box(S.glass, v0 + 0.05, v1 - 0.05, y + 1.0, y + 2.3, d0 - 0.05, d1 + 0.05, '#ffffff', Mg);
    for (const v of [v0, v1]) for (const d of [d0, d1]) box(S.paint, v - 0.05, v + 0.05, y + 1.0, y + 2.3, d - 0.05, d + 0.05, '#fbfaf6', Mg);
    box(S.paint, v0 - 0.12, v1 + 0.12, y + 2.3, y + 2.75, d0 + 0.12, d1 - 0.12, '#fbfaf6', Mg);
    faceSign(k, westFace(v1, d0 + 0.12), k.atlas.get('hometown'), 1.5, y + 2.33, 0.4, -0.02);
    faceSign(k, westFace(v1, d0 - 0.06), k.atlas.get('iceCream'), 1.5, y + 1.12, 0.26, -0.02);
    faceSign(k, southFace(v1 + 0.12, d1 - 0.12), k.atlas.get('hometown'), 1.72, y + 2.33, 0.4, -0.02);
    for (const [v, d] of [
      [v0 + 0.8, d1 - 1.4],
      [v0 + 2.3, d1 - 1.6],
    ] as const) {
      const [x, yy, z] = Y(v, d);
      cafeSet(k, x, yy, z, Math.atan2(G.gz, G.gx), '#f2c230');
    }
  }
  // The plaza: yellow and coral bistro sets, string lights on poles.
  {
    const cols = ['#f2c230', '#f07a5a'];
    let i = 0;
    for (let v = lux1 + 1.2; v < rit0 - 0.6; v += 1.9) {
      for (let d = dW - 1.8; d > dW - 10.5; d -= 2.2) {
        const [x, y, z] = Y(v + (i % 2) * 0.4, d);
        cafeSet(k, x, y, z, 0.6 * i, cols[i++ % 2], '#f2f2ee');
      }
    }
    const poles: [number, number, number][] = [];
    for (const [v, d] of [
      [lux1 + 0.4, dW - 3.2],
      [lux1 + 0.4, dW - 11],
      [rit0 - 0.4, dW - 3.2],
      [rit0 - 0.4, dW - 11],
    ] as const) {
      const [x, y, z] = Y(v, d);
      cyl(S.metal, [x, y - 0.1, z], [x, y + 4.2, z], 0.05, 0.06, 6, '#1b1b1b');
      poles.push([x, y + 4.2, z]);
    }
    festoon(k, poles[0], poles[3], 0.6, 10);
    festoon(k, poles[1], poles[2], 0.6, 10);
    festoon(k, poles[0], poles[1], 0.4, 8);
    festoon(k, poles[2], poles[3], 0.4, 8);
  }
  // More containers at the back along Linden (House of Agatha's, the juice bar's).
  container(vN1 - 2.5, vN1 - 0.06, dW - 11.3, dW - 17.36, '#4f7f6a');
  container(vN1 - 5.2, vN1 - 2.76, dW - 11.3, dW - 17.36, '#e8e4da');
  container(vN1 - 2.5, vN1 - 0.06, dW - 17.8, dW - 23.86, '#b8452c');

  // --- The Biergarten, south of Linden to Fell: a gravel yard behind a board fence, the bar in two
  // containers on its east side, picnic tables in rows under string lights, an Airstream and a green
  // container along Linden.
  gPatch(ctx, G, S.path, vS0, vS1, dW, dE, LOT, '#cdb58c', 3);
  claim(vS0, vS1, dW, dE);
  {
    const fence = (va: number, da: number, vb: number, db: number, gap?: [number, number]): void => {
      // Panels of boards between posts, every 2.4 m.
      const len = Math.hypot(vb - va, db - da);
      const n = Math.max(1, Math.round(len / 2.4));
      const alongV = Math.abs(vb - va) > Math.abs(db - da);
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        const vm = va + (vb - va) * ((t0 + t1) / 2);
        const dm = da + (db - da) * ((t0 + t1) / 2);
        if (gap && vm > gap[0] && vm < gap[1]) continue;
        const yy = ground(vm, dm);
        const hl = len / n / 2;
        if (alongV) box(S.paint, vm - hl, vm + hl, yy - 0.2, yy + 1.45, dm - 0.05, dm + 0.05, i % 2 ? '#8a6a48' : '#7f6142', Mg);
        else box(S.paint, vm - 0.05, vm + 0.05, yy - 0.2, yy + 1.45, dm - hl, dm + hl, i % 2 ? '#8a6a48' : '#7f6142', Mg);
        const pv = va + (vb - va) * t0;
        const pd = da + (db - da) * t0;
        box(S.paint, pv - 0.09, pv + 0.09, yy - 0.2, yy + 1.6, pd - 0.09, pd + 0.09, '#5a4230', Mg);
      }
    };
    fence(vS0 + 0.1, dW - 0.3, vS1 - 0.1, dW - 0.3, [vS0 + 9, vS0 + 11]);
    fence(vS1 - 0.2, dW - 0.3, vS1 - 0.2, dE + 0.3);
    const bar0 = vS0 + 4.5;
    const yb = base(bar0, bar0 + 12.26, dE + 0.4, dE + 2.84);
    container(bar0, bar0 + 6.06, dE + 0.4, dE + 2.84, '#2d4a34', yb);
    container(bar0 + 6.2, bar0 + 12.26, dE + 0.4, dE + 2.84, '#8a4b2a', yb);
    box(S.paint, bar0, bar0 + 12.26, yb - 0.6, yb, dE + 0.4, dE + 2.84, '#6b5a48', Mg);
    for (const v of [bar0 + 1, bar0 + 7.2]) box(S.paint, v, v + 4, yb + 0.95, yb + 2.1, dE + 2.84, dE + 2.9, '#2a2622', Mg);
    box(S.paint, bar0 + 0.6, bar0 + 11.6, yb + 0.9, yb + 1.0, dE + 2.84, dE + 3.4, '#9a7048', Mg);
    box(S.paint, bar0 + 4, bar0 + 8.3, yb + CH, yb + CH + 0.8, dE + 2.8, dE + 2.9, '#2d4a34', Mg);
    faceSign(k, westFace(bar0 + 12.26, dE + 2.92), k.atlas.get('biergarten'), 6.13, yb + CH + 0.1, 0.62, -0.02);
    // Along Linden: the silver Airstream and the green container.
    {
      const [x, y, z] = Y(vS0 + 1.8, dW - 5.2);
      const g = new THREE.CapsuleGeometry(1.2, 5.2, 6, 12);
      g.rotateZ(Math.PI / 2);
      g.scale(1, 1.05, 1);
      g.rotateY(-Math.atan2(-G.gx, G.gz));
      g.translate(x, y + 1.55, z);
      S.gloss.add(g, '#d3d8de');
      const [wx, , wz] = Y(vS0 + 0.6, dW - 5.2);
      obox(S.glass, [wx, y + 1.9, wz], [0.05, 0.45, 3.6], [0, -Math.atan2(G.gz, G.gx), 0], '#ffffff');
      container(vS0 + 0.4, vS0 + 2.84, dW - 9.6, dW - 15.66, '#3e6b45');
    }
    // Picnic tables in rows, with a few umbrellas.
    let i = 0;
    for (let v = vS0 + 5.5; v < vS1 - 2.5; v += 3.4) {
      for (const d of [dW - 4.2, dW - 9.8, dW - 15.4]) {
        const [x, y, z] = Y(v, d);
        const h = Math.atan2(-G.gx, G.gz);
        const m = new THREE.Matrix4().makeRotationY(-h).setPosition(x, y, z);
        box(S.paint, -1.2, 1.2, 0.72, 0.78, -0.4, 0.4, '#9a7048', m);
        for (const e of [-0.72, 0.72]) box(S.paint, -1.2, 1.2, 0.42, 0.47, e - 0.14, e + 0.14, '#8a6440', m);
        for (const e of [-0.9, 0.9]) box(S.paint, e - 0.05, e + 0.05, -0.1, 0.72, -0.72, 0.72, '#6b4e33', m);
        if (i++ % 3 === 0) {
          cyl(S.metal, [x, y, z], [x, y + 2.5, z], 0.03, 0.03, 5, '#d8d8d8');
          const u = new THREE.ConeGeometry(1.4, 0.55, 8);
          u.translate(x, y + 2.5, z);
          S.paint.add(u, i % 2 ? '#c8322b' : '#f1e6cf');
        }
      }
    }
    // String lights over it all, a couple of trees.
    for (const d of [dW - 7, dW - 12.6]) {
      const a = Y(vS0 + 3, d);
      const b = Y(vS1 - 1, d);
      for (const q of [a, b]) cyl(S.metal, [q[0], q[1] - 0.1, q[2]], [q[0], q[1] + 4.3, q[2]], 0.05, 0.06, 6, '#2a2a2a');
      festoon(k, [a[0], a[1] + 4.3, a[2]], [b[0], b[1] + 4.3, b[2]], 0.9, 14);
    }
    for (const [v, d] of [
      [vS0 + 10.2, dW - 7],
      [vS1 - 5, dE + 6],
    ] as const) {
      const [x, y, z] = Y(v, d);
      streetTree(k, x, y, z, 1.15, ['#4f9a55', '#5aa85c']);
    }
  }

  // --- Blue Bottle's kiosk on Linden's south side, and navy Revelation in Fit next door.
  {
    const d0 = -43;
    const W = 6;
    const v0 = vS0;
    const D = 8;
    // (Its floor is the sidewalk's at its middle; it steps down into the rise.)
    const yb = ground(v0 - 0.7, d0 - W / 2) - LOT + KERB;
    box(S.walls, v0, v0 + D, yb - 1.4, yb + 6.6, d0 - W, d0, '#e8dcc4', Mg);
    box(S.walls, v0, v0 + D, yb - 1.4, yb + 7.4, d0 - W - 5, d0 - W, '#1f2a44', Mg);
    const f = northFace(v0, d0);
    // Weathered planks above.
    box(S.paint, 0.35, W - 0.35, yb + 3.4, yb + 6.3, -0.08, 0.0, '#9a958c', f.m);
    for (let y = yb + 3.6; y < yb + 6.3; y += 0.24) box(S.paint, 0.35, W - 0.35, y, y + 0.03, -0.1, -0.07, '#7f7a72', f.m);
    faceSign(k, f, k.atlas.get('bb315'), W - 1.0, yb + 5.6, 0.36, -0.11);
    // Two garage-door counters under fold-up steel mesh awnings.
    for (const [a, b] of [
      [0.4, 2.85],
      [3.15, 5.6],
    ]) {
      box(S.paint, a, b, yb, yb + 2.95, -0.02, 0.4, '#2a2622', f.m);
      obox(S.metal, [(a + b) / 2, yb + 3.15, -0.55], [b - a + 0.1, 0.05, 1.2], [0.35, 0, 0], '#2e3440', f.m);
    }
    box(S.paint, 0.5, 2.75, yb - 0.5, yb + 1.0, -0.3, -0.02, '#c9a77c', f.m);
    faceSign(k, f, k.atlas.get('blueBottle'), 1.62, yb + 0.2, 0.62, -0.31);
    box(S.paint, 3.3, 5.45, yb + 0.9, yb + 1.0, -0.25, 0.0, '#b5895a', f.m);
    claim(v0, v0 + D, d0, d0 - W - 5);
  }

  // Houses along Linden's north side past Proxy, facing the alley.
  const [ox, oz] = G.at(vN1, dL);
  return [{ ox, oz, ux: -G.gz, uz: G.gx, len: dE - dL }];
}

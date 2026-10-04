// Mission Dolores, seen down 16th St to the east from Church St: the Basilica (1918), its cream
// Churrigueresque front between two tall towers crowned with domes and lanterns, the long nave behind
// it; and beside it, small and white, the old Mission (1791), the city's oldest building: its adobe
// front of four thick columns under a balcony with three bells in it, the low tile roof. And at the
// foot of Church St by Market, the Church St station's stairs down, its Muni sign beside them.
import * as THREE from 'three';
import { STREET_HW } from '../../../maps/castroNoeMission';
import { pointAt } from '../../../track';
import { box, cyl, obox, prism, type GeoBuilder, type V3 } from '../../geo';
import { signBoard } from '../../osg/alamo';
import { rectPoly, type Ctx } from '../../osg/context';
import { markThing } from '../../osg/kerbside';
import { KERB, WALK } from '../../osg/streets';

const CREAM = '#efe3c6';
const STONE = '#e2d3b2';
const OCHRE = '#c9a45e';
const TILE = '#b0573c';
const WHITE = '#f5f1e8';
const DARK = '#2a2420';
const WOOD = '#5b3a2a';
const BRONZE = '#8c6a33';

/** A frame on 16th St's arm east of Church St: u out along it, v to its right (south), heights y. */
interface ArmFrame {
  m(u: number, v: number, y: number, face: number): THREE.Matrix4;
  at(u: number, v: number): { x: number; z: number };
  h: number;
}

export function buildMissionDolores(ctx: Ctx): void {
  const c = ctx.course;
  const s16 = ctx.mark('church', '16th');
  const mid = pointAt(c, s16 + 6);
  // The arm east: the course's right, from its kerb.
  const ex = -mid.tz;
  const ez = mid.tx;
  const h = Math.atan2(ez, ex);
  const ox = mid.x + ex * STREET_HW;
  const oz = mid.z + ez * STREET_HW;
  // Right of the arm (south): (-ez, ex).
  const F: ArmFrame = {
    h,
    at: (u, v) => ({ x: ox + ex * u - ez * v, z: oz + ez * u + ex * v }),
    m: (u, v, y, face) => {
      const p = { x: ox + ex * u - ez * v, z: oz + ez * u + ex * v };
      return new THREE.Matrix4().makeRotationY(-face).setPosition(p.x, y, p.z);
    },
  };
  // The lots, behind the arm's south sidewalk (it's 6 m of road and 3.5 of sidewalk off its middle).
  const v0 = 6 + WALK + 0.4;
  ctx.occ.claim(rectPoly(ox, oz, h, 7.5, 24.5, v0, v0 + 30));
  ctx.occ.claim(rectPoly(ox, oz, h, 24.5, 36.5, v0, v0 + 24));
  // Facing the arm: the fronts face north, up the street (the way back to the course is -u).
  const face = h - Math.PI / 2;
  const groundAt = (u: number, v: number): number => {
    const p = F.at(u, v);
    return ctx.ground(p.x, p.z);
  };
  basilica(ctx.sinks, F, 16, v0, Math.min(groundAt(9, v0), groundAt(23, v0), groundAt(16, v0 + 20)) - 0.2, face);
  oldMission(ctx.sinks, F, 30.5, v0 + 1, Math.min(groundAt(25.5, v0 + 1), groundAt(35.5, v0 + 1), groundAt(30.5, v0 + 18)) - 0.2, face);
}

/** The Basilica: front centred at (u, v) facing `face`, its nave running back 26 m. */
function basilica(S: Ctx['sinks'], F: ArmFrame, u: number, v: number, y: number, face: number): void {
  // Local frame: x out of the front (towards the street), z across it.
  const m = F.m(u, v + 0.1, y, face);
  const W = 14;
  const D = 26;
  // The nave behind, a gabled tile roof.
  box(S.walls, -D, -1.2, 0, 11, -W / 2 + 1, W / 2 - 1, STONE, m);
  prism(S.walls, [
    [-D, 11, -W / 2 + 0.6],
    [-D, 11, W / 2 - 0.6],
    [-D, 14.6, 0],
  ], [D - 1.6, 0, 0], TILE, m, TILE);
  // The towers.
  for (const e of [-1, 1]) {
    const cz = e * (W / 2 - 1.7);
    box(S.walls, -2.4, 1.0, 0, 17, cz - 1.7, cz + 1.7, CREAM, m);
    // Cornices.
    for (const yy of [6.2, 12.4, 17]) box(S.trim, -2.55, 1.15, yy - 0.18, yy + 0.18, cz - 1.85, cz + 1.85, OCHRE, m);
    // The belfry: open arches (dark) between corner piers, then the dome and lantern.
    for (const [dx, dz] of [
      [-2.0, -1.3],
      [0.6, -1.3],
      [-2.0, 1.3],
      [0.6, 1.3],
    ]) box(S.walls, dx - 0.35, dx + 0.35, 17, 21, cz + dz - 0.35, cz + dz + 0.35, CREAM, m);
    box(S.glass, -1.6, 0.2, 17.6, 20.4, cz - 1.0, cz + 1.0, DARK, m);
    box(S.trim, -2.55, 1.15, 21, 21.4, cz - 1.85, cz + 1.85, OCHRE, m);
    const dome = new THREE.SphereGeometry(1.75, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(1, 1.35, 1);
    dome.translate(-0.7, 21.4, cz);
    S.gloss.add(dome, '#e8b88a', m);
    cyl(S.walls, [-0.7, 23.7, cz], [-0.7, 25.4, cz], 0.45, 0.55, 8, CREAM, m);
    cyl(S.gloss, [-0.7, 25.4, cz], [-0.7, 26.2, cz], 0.05, 0.5, 8, OCHRE, m);
    cyl(S.metal, [-0.7, 26.2, cz], [-0.7, 27.4, cz], 0.05, 0.05, 4, '#d8b25a', m);
    box(S.metal, -0.75, -0.65, 26.7, 26.8, cz - 0.3, cz + 0.3, '#d8b25a', m);
    // Tall arched windows (dark) up the tower's front.
    for (const yy of [3.6, 9.4, 14.6]) box(S.glass, 1.0, 1.05, yy - 1.3, yy + 1.3, cz - 0.45, cz + 0.45, DARK, m);
  }
  // The front between the towers: its scalloped parapet, the great arched door, the rose window,
  // pilasters and the ornament round the door.
  const cw = W / 2 - 3.4;
  box(S.walls, -1.2, 0.8, 0, 13.2, -cw, cw, CREAM, m);
  prism(S.walls, [
    [0.8, 13.2, -cw],
    [0.8, 13.2, cw],
    [0.8, 15.6, 0],
  ], [-2.0, 0, 0], CREAM, m);
  cyl(S.walls, [-0.2, 15.6, 0], [-0.2, 16.3, 0], 0.32, 0.4, 8, CREAM, m);
  cyl(S.metal, [-0.2, 16.3, 0], [-0.2, 17.6, 0], 0.05, 0.05, 4, '#d8b25a', m);
  box(S.metal, -0.25, -0.15, 17.1, 17.2, -0.35, 0.35, '#d8b25a', m);
  box(S.glass, 0.8, 0.9, 0, 4.6, -1.3, 1.3, DARK, m);
  const arch = new THREE.CylinderGeometry(1.3, 1.3, 0.1, 12, 1, false, 0, Math.PI);
  arch.rotateZ(Math.PI / 2);
  arch.rotateY(Math.PI / 2);
  arch.translate(0.85, 4.6, 0);
  S.glass.add(arch, DARK, m);
  for (const e of [-1, 1]) {
    box(S.trim, 0.8, 1.15, 0, 7.2, e * 1.75 - 0.25, e * 1.75 + 0.25, OCHRE, m);
    box(S.trim, 0.8, 1.05, 7.2, 12.6, e * 1.2 - 0.18, e * 1.2 + 0.18, OCHRE, m);
  }
  box(S.trim, 0.8, 1.1, 7.0, 7.4, -cw, cw, OCHRE, m);
  const rose = new THREE.CylinderGeometry(1.15, 1.15, 0.12, 14);
  rose.rotateZ(Math.PI / 2);
  rose.translate(0.88, 9.6, 0);
  S.glass.add(rose, '#4a5f8a', m);
  const ring = new THREE.TorusGeometry(1.2, 0.14, 6, 16);
  ring.rotateY(Math.PI / 2);
  ring.translate(0.9, 9.6, 0);
  S.trim.add(ring, OCHRE, m);
  // Steps up to the door.
  for (let k = 0; k < 3; k++) box(S.concrete, 0.8 + k * 0.45, 1.25 + k * 0.45, -0.2, 0.55 - k * 0.18, -2.4, 2.4, '#d6cfbf', m);
}

/** The old Mission: its front centred at (u, v) facing `face`, the chapel running back 22 m. */
function oldMission(S: Ctx['sinks'], F: ArmFrame, u: number, v: number, y: number, face: number): void {
  const m = F.m(u, v + 0.1, y, face);
  const W = 7.6;
  const D = 22;
  // The chapel: thick white adobe walls under a low tile roof.
  box(S.walls, -D, -0.4, 0, 7.4, -W / 2, W / 2, WHITE, m);
  prism(S.walls, [
    [-D, 7.4, -W / 2 - 0.5],
    [-D, 7.4, W / 2 + 0.5],
    [-D, 9.4, 0],
  ], [D + 0.9, 0, 0], TILE, m, TILE);
  // The front: its gable wall standing up over the roof's end.
  prism(S.walls, [
    [0.5, 7.4, -W / 2],
    [0.5, 7.4, W / 2],
    [0.5, 9.9, 0],
  ], [-0.9, 0, 0], WHITE, m);
  // Four thick columns, two storeys, a balcony between them under the eaves with its three bells.
  for (const e of [-1, -0.33, 0.33, 1]) {
    const cz = e * (W / 2 - 0.55);
    box(S.walls, 0.5, 1.5, 0, 7.4, cz - 0.45, cz + 0.45, WHITE, m);
  }
  box(S.trim, -0.4, 1.7, 3.6, 3.9, -W / 2, W / 2, WOOD, m);
  box(S.trim, 0.9, 1.7, 3.9, 4.6, -W / 2 + 0.3, W / 2 - 0.3, WOOD, m);
  for (const e of [-0.66, 0, 0.66]) {
    const bz = e * (W / 2 - 1.1);
    box(S.glass, 0.45, 0.5, 4.8, 6.6, bz - 0.55, bz + 0.55, DARK, m);
    const bell: V3 = [0.3, 5.6, bz];
    const g = new THREE.ConeGeometry(0.34, 0.6, 10, 1, true);
    g.translate(bell[0], bell[1], bell[2]);
    S.gloss.add(g, BRONZE, m);
  }
  // The door.
  box(S.trim, 0.45, 0.52, 0, 2.9, -0.9, 0.9, WOOD, m);
  // A pepper tree and a palm in the garden beside it.
  void cyl;
  void obox;
}

/**
 * The Church St station at the foot of Church St by Market: stairs down through an opening in the
 * east sidewalk, railed round, and Muni's sign beside them.
 */
export function buildStation(ctx: Ctx): void {
  const S = ctx.sinks;
  const c = ctx.course;
  const s = ctx.mark('church', 'market') - 12;
  const p = pointAt(c, s);
  const d = STREET_HW + WALK / 2 + 0.1;
  const x = p.x - p.tz * d;
  const z = p.z + p.tx * d;
  const y = p.y + KERB;
  const m = new THREE.Matrix4().makeRotationY(-p.heading).setPosition(x, y, z);
  // The opening (dark, the stairs falling away into it) and its railings on three sides.
  box(S.glass, -2.4, 2.4, -0.6, 0.012, -0.75, 0.75, '#141618', m);
  for (let k = 0; k < 6; k++) box(S.concrete, -2.2 + k * 0.4, -1.85 + k * 0.4, -0.2 - k * 0.12, -0.08 - k * 0.12, -0.7, 0.7, '#9a948a', m);
  const rail = (a: V3, b: V3): void => {
    cyl(S.metal, a, b, 0.03, 0.03, 4, '#8f969e', m);
  };
  for (const zz of [-0.82, 0.82]) {
    rail([-2.45, 1.0, zz], [2.45, 1.0, zz]);
    for (const xx of [-2.45, -0.8, 0.8, 2.45]) rail([xx, 0, zz], [xx, 1.0, zz]);
  }
  rail([2.45, 1.0, -0.82], [2.45, 1.0, 0.82]);
  // The sign: a pole with Muni's orange disc, and the station's name board.
  const sx = x + p.tx * 3.2;
  const sz = z + p.tz * 3.2;
  cyl(S.metal, [sx, y, sz], [sx, y + 3.3, sz], 0.06, 0.07, 8, '#4a4f55');
  const disc = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 16);
  disc.rotateX(Math.PI / 2);
  disc.rotateY(-p.heading + Math.PI / 2);
  disc.translate(sx, y + 3.55, sz);
  S.gloss.add(disc, '#e8641e');
  signBoard(ctx, sx, y + 2.65, sz, p.heading + Math.PI / 2, 'CHURCH ST', '#1d3557', 1.6, 0.42);
  markThing(ctx, x, z, 2.6);
  markThing(ctx, sx, sz, 0.4);
}

void (null as unknown as GeoBuilder);

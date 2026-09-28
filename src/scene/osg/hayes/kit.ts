// What Hayes Valley's builders share: a building's frame (a lot, as victorian.ts has it: the
// frontage from a corner along the street, the building to its left), the signs' atlas and the
// builder their quads go into, and the small things on the sidewalks (benches, café tables,
// planters, bollards, street trees, lamps).
import * as THREE from 'three';
import { GeoBuilder, box, cyl, obox, type V3 } from '../../geo';
import type { Ctx } from '../context';
import { SignAtlas, signQuad, type Region } from './atlas';

/** Everything a Hayes Valley builder needs: the scene's context, the signs and where they go. */
export interface Kit {
  ctx: Ctx;
  S: Ctx['sinks'];
  atlas: SignAtlas;
  /** Lettered quads (the atlas's material). */
  sign: GeoBuilder;
  rng: () => number;
}

/**
 * A lot's frame: u along the frontage from (ox, oz) in direction (ux, uz), w into the lot (to the
 * left of that direction), y up in the world. The frontage faces -w, and a viewer in the street
 * facing it has +u on their left.
 */
export class Frame {
  readonly wx: number;
  readonly wz: number;
  readonly m: THREE.Matrix4;
  constructor(
    readonly ox: number,
    readonly oz: number,
    readonly ux: number,
    readonly uz: number,
  ) {
    this.wx = -uz;
    this.wz = ux;
    this.m = new THREE.Matrix4().makeBasis(new THREE.Vector3(ux, 0, uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(this.wx, 0, this.wz)).setPosition(ox, 0, oz);
  }

  p(u: number, y: number, w: number): V3 {
    return [this.ox + this.ux * u + this.wx * w, y, this.oz + this.uz * u + this.wz * w];
  }

  /** The same frame moved along (du) and into the lot (dw). */
  at(du: number, dw: number): Frame {
    return new Frame(this.ox + this.ux * du + this.wx * dw, this.oz + this.uz * du + this.wz * dw, this.ux, this.uz);
  }

  /** Round the corner: the side face at u = W (it faces +u), its u running back from the front corner. */
  sideAtW(W: number): Frame {
    return new Frame(this.ox + this.ux * W, this.oz + this.uz * W, this.wx, this.wz);
  }

  /** The side face at u = 0 (it faces -u), its u running forward from the back (the front corner at u = D). */
  sideAt0(D: number): Frame {
    return new Frame(this.ox + this.wx * D, this.oz + this.wz * D, -this.wx, -this.wz);
  }

  /** A polygon of world [x, z] for the local rectangle u0..u1 × w0..w1. */
  poly(u0: number, u1: number, w0: number, w1: number): [number, number][] {
    return [this.p(u0, 0, w0), this.p(u1, 0, w0), this.p(u1, 0, w1), this.p(u0, 0, w1)].map((q) => [q[0], q[2]] as [number, number]);
  }
}

/**
 * A lettered panel on a face, in a frame: centred at u, from y0 up, `h` tall (its width from the
 * sign's shape), on the plane w (facing -w, the street).
 */
export function faceSign(k: Kit, f: Frame, r: Region, u: number, y0: number, h: number, w: number, maxW = Infinity): { w: number; h: number } {
  let ww = h * r.aspect;
  if (ww > maxW) {
    ww = maxW;
    h = ww / r.aspect;
  }
  // The viewer's left is +u.
  signQuad(k.sign, r, f.p(u + ww / 2, y0, w), f.p(u - ww / 2, y0, w), f.p(u - ww / 2, y0 + h, w), f.p(u + ww / 2, y0 + h, w));
  return { w: ww, h };
}

/** A lettered panel stood on its end (reading downwards), centred at u, from y0 up. */
export function faceSignDown(k: Kit, f: Frame, r: Region, u: number, y0: number, len: number, w: number): void {
  const t = len / r.aspect;
  // Texture left (the start of the word) at the top, its top edge to the viewer's right (-u).
  signQuad(k.sign, r, f.p(u + t / 2, y0 + len, w), f.p(u + t / 2, y0, w), f.p(u - t / 2, y0, w), f.p(u - t / 2, y0 + len, w));
}

/**
 * A blade sign: a double-sided lettered board standing out from the face at u, perpendicular to
 * it (so it faces the traffic both ways), from `out0` to `out0 + len` in front of the face, bottom
 * at y0, in a painted frame on an iron bracket.
 */
export function bladeSign(k: Kit, f: Frame, r: Region, u: number, y0: number, len: number, frame = '#1c1c1c', out0 = 0.25): void {
  const h = len / r.aspect;
  const S = k.S;
  const t = 0.07;
  // The board and its frame.
  box(S.paint, u - t / 2, u + t / 2, y0 - 0.04, y0 + h + 0.04, -(out0 + len + 0.04), -(out0 - 0.04), frame, f.m);
  // Bracket to the wall.
  box(S.metal, u - 0.02, u + 0.02, y0 + h + 0.04, y0 + h + 0.1, -(out0 + len * 0.9), 0.02, '#2a2a2a', f.m);
  box(S.metal, u - 0.02, u + 0.02, y0 + h * 0.3, y0 + h * 0.7, -out0, 0.02, '#2a2a2a', f.m);
  const e = t / 2 + 0.004;
  const w0 = -out0;
  const w1 = -(out0 + len);
  // Face towards +u: seen from +u, the viewer's right is -w (away from the wall): start at the wall.
  signQuad(k.sign, r, f.p(u + e, y0, w0), f.p(u + e, y0, w1), f.p(u + e, y0 + h, w1), f.p(u + e, y0 + h, w0));
  // Face towards -u: seen from -u, the viewer's right is +w: start at the outer end.
  signQuad(k.sign, r, f.p(u - e, y0, w1), f.p(u - e, y0, w0), f.p(u - e, y0 + h, w0), f.p(u - e, y0 + h, w1));
}

// ---------------------------------------------------------------------------------------------
// On the sidewalks

/** A bench with a back, facing `face` (radians, world heading), in one colour. */
export function bench(k: Kit, x: number, y: number, z: number, face: number, color: string, len = 1.8): void {
  const m = new THREE.Matrix4().makeRotationY(-face).setPosition(x, y, z);
  const S = k.S;
  // Local +x is the way it faces; it runs along z.
  box(S.paint, -0.22, 0.22, 0.42, 0.48, -len / 2, len / 2, color, m);
  box(S.paint, -0.26, -0.2, 0.5, 0.92, -len / 2, len / 2, color, m);
  for (const bz of [-len / 2 + 0.12, len / 2 - 0.12]) box(S.metal, -0.2, 0.2, 0, 0.42, bz - 0.03, bz + 0.03, '#2b2f33', m);
}

/** A bistro table and two chairs, turned `rot`. */
export function cafeSet(k: Kit, x: number, y: number, z: number, rot: number, chair: string, top = '#e9e5dc'): void {
  const S = k.S;
  cyl(S.metal, [x, y, z], [x, y + 0.72, z], 0.03, 0.05, 5, '#2b2b2b');
  cyl(S.paint, [x, y + 0.72, z], [x, y + 0.76, z], 0.34, 0.34, 8, top);
  for (const s of [-1, 1]) {
    const cx = x + Math.cos(rot) * 0.55 * s;
    const cz = z + Math.sin(rot) * 0.55 * s;
    const m = new THREE.Matrix4().makeRotationY(-rot + (s > 0 ? Math.PI : 0)).setPosition(cx, y, cz);
    // Seat, back, and the legs as one splayed frame.
    box(S.paint, -0.2, 0.2, 0.42, 0.47, -0.2, 0.2, chair, m);
    box(S.paint, 0.17, 0.21, 0.47, 0.86, -0.2, 0.2, chair, m);
    box(S.paint, -0.17, 0.17, 0, 0.42, -0.02, 0.02, chair, m);
  }
}

/** A box planter with a shrub in it. */
export function planter(k: Kit, x: number, y: number, z: number, heading: number, len: number, wid: number, color: string, green = '#5f9a4c'): void {
  const S = k.S;
  obox(S.paint, [x, y + 0.3, z], [len, 0.6, wid], [0, -heading, 0], color);
  const g = new THREE.IcosahedronGeometry(1, 0);
  g.scale(len * 0.5, 0.45, wid * 0.55);
  g.rotateY(-heading);
  g.translate(x, y + 0.75, z);
  S.hedge.add(g, green);
}

/** A black steel bollard. */
export function bollard(k: Kit, x: number, y: number, z: number, color = '#22262b'): void {
  cyl(k.S.metal, [x, y, z], [x, y + 0.95, z], 0.11, 0.13, 8, color);
  cyl(k.S.metal, [x, y + 0.95, z], [x, y + 1.02, z], 0.07, 0.12, 8, color);
}

/** A street tree: a trunk in a square well, a rounded crown (two lumps) up above the shop signs. */
export function streetTree(k: Kit, x: number, y: number, z: number, s: number, greens: string[]): void {
  const S = k.S;
  const rng = k.rng;
  box(S.paint, x - 0.6, x + 0.6, y - 0.1, y + 0.02, z - 0.6, z + 0.6, '#5c4a38');
  const lx = (rng() - 0.5) * 0.3;
  const lz = (rng() - 0.5) * 0.3;
  cyl(S.foliage, [x, y - 0.2, z], [x + lx, y + 4.1 * s, z + lz], 0.09 * s, 0.14 * s, 6, '#6e5846');
  const a = new THREE.IcosahedronGeometry(1.35 * s, 0);
  a.scale(1, 0.8, 1);
  a.translate(x + lx, y + 4.95 * s, z + lz);
  S.foliage.add(a, greens[Math.floor(rng() * greens.length)]);
  const b = new THREE.IcosahedronGeometry(0.85 * s, 0);
  b.translate(x + lx + (rng() - 0.5) * 1.1 * s, y + 5.7 * s, z + lz + (rng() - 0.5) * 1.1 * s);
  S.foliage.add(b, greens[Math.floor(rng() * greens.length)]);
}

/** A tall ornamental street lamp (Octavia's: dark navy, an acorn globe). */
export function acornLamp(k: Kit, x: number, y: number, z: number, h = 4.4): void {
  const S = k.S;
  cyl(S.metal, [x, y, z], [x, y + 0.7, z], 0.14, 0.17, 8, '#1f2a44');
  cyl(S.metal, [x, y + 0.7, z], [x, y + h, z], 0.07, 0.1, 8, '#1f2a44');
  cyl(S.metal, [x, y + h, z], [x, y + h + 0.12, z], 0.16, 0.08, 8, '#1f2a44');
  const g = new THREE.SphereGeometry(0.26, 8, 6);
  g.scale(1, 1.3, 1);
  g.translate(x, y + h + 0.42, z);
  S.glow.add(g, '#fff8e2');
  cyl(S.metal, [x, y + h + 0.74, z], [x, y + h + 0.9, z], 0.04, 0.13, 8, '#1f2a44');
}

/** Festoon lights (a string of bulbs) from a to b, sagging `sag`. */
export function festoon(k: Kit, a: V3, b: V3, sag: number, n: number): void {
  const S = k.S;
  let prev: V3 = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const q: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
    cyl(S.metal, prev, q, 0.008, 0.008, 3, '#2a2a2a');
    if (i < n) box(S.glow, q[0] - 0.05, q[0] + 0.05, q[1] - 0.14, q[1] - 0.04, q[2] - 0.05, q[2] + 0.05, '#fff4d6');
    prev = q;
  }
}

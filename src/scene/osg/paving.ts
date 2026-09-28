// Sidewalks: San Francisco's scored concrete slabs, a paler kerb band along the street with an
// expansion joint behind it, the kerb face a shade darker. One tiling texture (a 3 m square: two
// slabs by two, 1.5 m each, their joints, stains, gum, speckle, a hairline crack or two) mapped in
// metres (a UV unit is 3 m, as the city's other concrete has it), so any strip of paving laid with
// that scale shows slabs; the builders here also start the slabs at the kerb band.
import * as THREE from 'three';
import type { GeoBuilder, UV, V3 } from '../geo';
import { canvasTexture, makeRng } from '../util';
import type { Ctx } from './context';

/** Metres per UV unit (one texture tile). */
export const PAVE_UV = 3;
/** The sidewalk's colour (under the texture), the kerb band's and the kerb face's. */
export const SIDEWALK = '#d9d3c6';
/** The parks' paths: the same scored concrete, a shade greyer. */
export const PARK_PATH = '#cbc6bb';
const KERB_TOP = '#e9e5dd';
const KERB_FACE = '#b9b4aa';
/** The kerb band's width (m). */
const BAND = 0.3;
/** Where in the texture a plain run of slab is (no lengthwise joint): for kerbs. */
const PLAIN_U0 = 0.14;
const PLAIN_U1 = 0.3;

/** The paving texture (512², tiling). */
export function sidewalkTexture(): THREE.CanvasTexture {
  const W = 512;
  const S = W / 2;
  return canvasTexture(
    W,
    W,
    (g) => {
      const rng = makeRng(1906);
      const wrap = (x: number, y: number, r: number, draw: (x: number, y: number) => void): void => {
        for (const ox of [-W, 0, W]) {
          for (const oy of [-W, 0, W]) {
            const px = x + ox;
            const py = y + oy;
            if (px + r < 0 || px - r > W || py + r < 0 || py - r > W) continue;
            draw(px, py);
          }
        }
      };
      // The slabs, each its own shade of warm grey (the texture carries the sidewalks' tone: the
      // builders' vertex colours stay the city's usual pale concrete).
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const v = 190 + rng() * 14;
          g.fillStyle = `rgb(${v}, ${v - 4}, ${v - 11})`;
          g.fillRect(i * S, j * S, S, S);
        }
      }
      // Speckle: the aggregate.
      for (let i = 0; i < 9000; i++) {
        const dark = rng() < 0.55;
        g.fillStyle = dark ? `rgba(70, 64, 56, ${0.06 + rng() * 0.12})` : `rgba(255, 252, 244, ${0.1 + rng() * 0.15})`;
        const s = rng() < 0.85 ? 1 : 2;
        g.fillRect(rng() * W, rng() * W, s, s);
      }
      // Stains and old spills, soft; gum, dark and round.
      for (let i = 0; i < 22; i++) {
        const x = rng() * W;
        const y = rng() * W;
        const r = 12 + rng() * 55;
        const a = 0.04 + rng() * 0.08;
        wrap(x, y, r, (px, py) => {
          const gr = g.createRadialGradient(px, py, 0, px, py, r);
          gr.addColorStop(0, `rgba(88, 80, 68, ${a})`);
          gr.addColorStop(1, 'rgba(88, 80, 68, 0)');
          g.fillStyle = gr;
          g.fillRect(px - r, py - r, 2 * r, 2 * r);
        });
      }
      for (let i = 0; i < 26; i++) {
        const x = rng() * W;
        const y = rng() * W;
        const r = 1.5 + rng() * 2.5;
        g.fillStyle = `rgba(60, 58, 56, ${0.25 + rng() * 0.25})`;
        wrap(x, y, r, (px, py) => {
          g.beginPath();
          g.arc(px, py, r, 0, Math.PI * 2);
          g.fill();
        });
      }
      // A hairline crack or two, wandering across a slab.
      g.strokeStyle = 'rgba(80, 74, 66, 0.35)';
      g.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        let x = rng() * W;
        let y = rng() * W;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 8; k++) {
          x += (rng() - 0.3) * 18;
          y += (rng() - 0.5) * 18;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      // The joints, scored between the slabs (on each tile edge and down its middle, wrapped so they
      // meet the next tile's): a dark groove with a lit edge.
      const line = (at: number, color: string): void => {
        const p = ((at % W) + W) % W;
        g.fillStyle = color;
        g.fillRect(p, 0, 1, W);
        g.fillRect(0, p, W, 1);
      };
      for (const at of [0, S]) {
        for (const [dx, a] of [
          [-2, 0.75],
          [-1, 0.85],
          [0, 0.85],
          [1, 0.6],
        ] as const) line(at + dx, `rgba(92, 86, 78, ${a})`);
        line(at + 2, 'rgba(255, 253, 246, 0.5)');
      }
    },
    { repeat: [1, 1], anisotropy: 8 },
  );
}

type P = { x: number; z: number; tx: number; tz: number };

/**
 * A sidewalk along a line of points (a street's side, offsets d0..d1 to the right of it; the kerb
 * is the edge nearer the line): the kerb band, the slabs starting at a joint behind it, the kerb
 * face down to `bottom` and the back edge. Every other point of a fine line is plenty.
 */
export function walkStrip(b: GeoBuilder, ptsIn: P[], d0: number, d1: number, top: (i: number) => number, bottom: (i: number) => number): void {
  // (Keep each point's index for top/bottom.)
  const idx: number[] = [];
  for (let i = 0; i < ptsIn.length; i += 2) idx.push(i);
  if (idx[idx.length - 1] !== ptsIn.length - 1) idx.push(ptsIn.length - 1);
  const kerb = Math.abs(d0) < Math.abs(d1) ? d0 : d1;
  const far = kerb === d0 ? d1 : d0;
  const sgn = Math.sign(far - kerb) || 1;
  const band = kerb + sgn * Math.min(BAND, Math.abs(far - kerb) * 0.3);
  const up: V3 = [0, 1, 0];
  let v = 0;
  for (let k = 0; k + 1 < idx.length; k++) {
    const ia = idx[k];
    const ic = idx[k + 1];
    const a = ptsIn[ia];
    const c = ptsIn[ic];
    const at = (p: P, d: number, y: number): V3 => [p.x - p.tz * d, y, p.z + p.tx * d];
    const ya = top(ia);
    const yc = top(ic);
    const v1 = v + Math.hypot(c.x - a.x, c.z - a.z) / PAVE_UV;
    const u = (d: number): number => (Math.abs(d - kerb) - BAND) / PAVE_UV;
    b.quad(at(a, kerb, ya), at(c, kerb, yc), at(c, band, yc), at(a, band, ya), KERB_TOP, up, [
      [PLAIN_U0, v],
      [PLAIN_U0, v1],
      [PLAIN_U1, v1],
      [PLAIN_U1, v],
    ]);
    b.quad(at(a, band, ya), at(c, band, yc), at(c, far, yc), at(a, far, ya), SIDEWALK, up, [
      [u(band), v],
      [u(band), v1],
      [u(far), v1],
      [u(far), v],
    ]);
    // The kerb's face, and the back edge.
    const n = (s: number): V3 => [-a.tz * s, 0, a.tx * s];
    const ba = bottom(ia);
    const bc = bottom(ic);
    b.quad(at(a, kerb, ya), at(c, kerb, yc), at(c, kerb, bc), at(a, kerb, ba), KERB_FACE, n(-sgn), [
      [PLAIN_U0, v],
      [PLAIN_U0, v1],
      [PLAIN_U1, v1],
      [PLAIN_U1, v],
    ]);
    b.quad(at(a, far, ya), at(c, far, yc), at(c, far, bc), at(a, far, ba), SIDEWALK, n(sgn), [
      [PLAIN_U0, v],
      [PLAIN_U0, v1],
      [PLAIN_U1, v1],
      [PLAIN_U1, v],
    ]);
    v = v1;
  }
}

/**
 * A sidewalk draped over the ground in a street's frame (from (x, z), u along heading h, v to its
 * right: as streets.ts's groundStrip): about 2 m cells, `lift` over the ground, skirts `sink` below
 * down both long edges. With `kerb`, its kerb is the edge nearer the street's middle (a band, then
 * the slabs); without (a corner's square), just slabs.
 */
export function walkGround(ctx: Ctx, b: GeoBuilder, x: number, z: number, h: number, u0: number, u1: number, v0: number, v1: number, lift: number, sink: number, kerb = true): void {
  const tx = Math.cos(h);
  const tz = Math.sin(h);
  const k = Math.abs(v0) < Math.abs(v1) ? v0 : v1;
  const f = k === v0 ? v1 : v0;
  const sgn = Math.sign(f - k) || 1;
  const bandV = kerb ? k + sgn * Math.min(BAND, Math.abs(f - k) * 0.3) : k;
  // Across: the band (if any), then cells of 2 m at most, from the kerb out.
  const cols: number[] = [k];
  if (kerb) cols.push(bandV);
  const m = Math.max(1, Math.ceil(Math.abs(f - bandV) / 2));
  for (let j = 1; j <= m; j++) cols.push(bandV + ((f - bandV) * j) / m);
  const n = Math.max(1, Math.ceil((u1 - u0) / 2));
  const P = (u: number, v: number, dy: number): V3 => {
    const px = x + tx * u - tz * v;
    const pz = z + tz * u + tx * v;
    return [px, ctx.ground(px, pz) + dy, pz];
  };
  const texU = (v: number): number => (kerb ? Math.abs(v - k) - BAND : sgn * (v - k)) / PAVE_UV;
  const up: V3 = [0, 1, 0];
  for (let i = 0; i < n; i++) {
    const ua = u0 + ((u1 - u0) * i) / n;
    const ub = u0 + ((u1 - u0) * (i + 1)) / n;
    const ta = ua / PAVE_UV;
    const tb = ub / PAVE_UV;
    for (let j = 0; j + 1 < cols.length; j++) {
      const va = cols[j];
      const vb = cols[j + 1];
      const isBand = kerb && j === 0;
      const uv: [UV, UV, UV, UV] = isBand
        ? [
            [PLAIN_U0, ta],
            [PLAIN_U0, tb],
            [PLAIN_U1, tb],
            [PLAIN_U1, ta],
          ]
        : [
            [texU(va), ta],
            [texU(va), tb],
            [texU(vb), tb],
            [texU(vb), ta],
          ];
      b.quad(P(ua, va, lift), P(ub, va, lift), P(ub, vb, lift), P(ua, vb, lift), isBand ? KERB_TOP : SIDEWALK, up, uv);
    }
    // Skirts down the long edges: the kerb's face (a shade darker), the back.
    for (const [v, face] of [
      [k, true],
      [f, false],
    ] as const) {
      const s = face ? -sgn : sgn;
      b.quad(P(ua, v, lift), P(ub, v, lift), P(ub, v, -sink), P(ua, v, -sink), face ? KERB_FACE : SIDEWALK, [-tz * s, 0, tx * s], [
        [PLAIN_U0, ta],
        [PLAIN_U0, tb],
        [PLAIN_U1, tb],
        [PLAIN_U1, ta],
      ]);
    }
  }
}

/** A piece of paving's top, textured in world metres (the inside of a corner, a plaza). */
export function paveQuad(b: GeoBuilder, a: V3, c: V3, d: V3, e: V3): void {
  const uv = (p: V3): [number, number] => [p[0] / PAVE_UV, p[2] / PAVE_UV];
  b.quad(a, c, d, e, SIDEWALK, [0, 1, 0], [uv(a), uv(c), uv(d), uv(e)]);
}

/** A kerb's face (facing `out`). */
export function kerbQuad(b: GeoBuilder, a: V3, c: V3, d: V3, e: V3, out: V3): void {
  b.quad(a, c, d, e, KERB_FACE, out, [
    [PLAIN_U0, 0],
    [PLAIN_U0, 0.5],
    [PLAIN_U1, 0.5],
    [PLAIN_U1, 0],
  ]);
}

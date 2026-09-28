// Old Stomping Grounds, Duboce and Buena Vista: one canvas of everything painted or lettered round
// here (the HILL sign and the CURB WHEELS plates on the Duboce wall, the Muni Metro portal's letters,
// the Sunset Tunnel's, the Mint's, the Harvey Milk Center's, the parks' carved boards, the N Judah's
// stop flag, the Stars and Stripes, and the inscriptions on Buena Vista's headstones), so all of it
// is one material. Each neighbourhood gathers its decals (textured quads) into its own mesh of it.
import * as THREE from 'three';
import { GeoBuilder, meshOf, type V3 } from '../../geo';
import { canvasTexture, makeRng } from '../../util';
import type { Ctx } from '../context';

const W = 1024;
const H = 1024;

/** Where each picture is on the canvas (px: x, y, w, h). */
const RECTS = {
  hill: [0, 0, 256, 256],
  hillPlate: [256, 0, 256, 88],
  curb: [256, 88, 256, 104],
  judah: [256, 192, 64, 64],
  flag: [320, 192, 120, 64],
  bvPark: [512, 0, 512, 128],
  dubocePark: [512, 128, 512, 128],
  muni: [0, 256, 1024, 128],
  sunset: [0, 384, 1024, 128],
  milk: [0, 512, 1024, 128],
  mint: [0, 640, 1024, 128],
  stone0: [0, 768, 128, 256],
  stone1: [128, 768, 128, 256],
  stone2: [256, 768, 128, 256],
  stone3: [384, 768, 128, 256],
  stone4: [512, 768, 128, 256],
  stone5: [640, 768, 128, 256],
  stone6: [768, 768, 128, 256],
  stone7: [896, 768, 128, 256],
} as const;

export type Decal = keyof typeof RECTS;
/** The headstone inscriptions, for picking one at random. */
export const STONES: Decal[] = ['stone0', 'stone1', 'stone2', 'stone3', 'stone4', 'stone5', 'stone6', 'stone7'];
/** The marble of the headstones (the inscriptions' ground, so the slabs under them match), and the
 *  gutter they lie in. */
export const MARBLE = '#e4e2dc';
export const GUTTER = '#8e8b83';

const SANS = '"Arial Rounded MT Bold", "Arial Black", "Helvetica Neue", Arial, sans-serif';
const SERIF = '"Georgia", "Times New Roman", serif';
const DECO = '"Futura", "Avenir Next Condensed", "Gill Sans", "Helvetica Neue", Arial, sans-serif';

/** Lettering centred in a box, squeezed to fit its width. */
function letter(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW: number, px: number, font: string, weight = 800, spacing = 0): void {
  g.font = `${weight} ${px}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const chars = [...text];
  const widths = chars.map((c) => g.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  const k = Math.min(1, maxW / total);
  g.save();
  g.translate(cx, cy);
  g.scale(k, 1);
  let x = -total / 2;
  chars.forEach((c, i) => {
    g.fillText(c, x + widths[i] / 2, 0);
    x += widths[i] + spacing;
  });
  g.restore();
}

/** A carved park board: routed cream letters on stained redwood, a border round it (SF Rec & Park's). */
function parkBoard(g: CanvasRenderingContext2D, [x, y, w, h]: readonly number[], text: string): void {
  g.fillStyle = '#5a3a24';
  g.fillRect(x, y, w, h);
  const rng = makeRng(text.length * 7 + 3);
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(${40 + rng() * 30},${22 + rng() * 16},${12},${0.25 + rng() * 0.25})`;
    g.lineWidth = 1 + rng() * 2;
    const yy = y + rng() * h;
    g.beginPath();
    g.moveTo(x, yy);
    g.bezierCurveTo(x + w * 0.3, yy + (rng() - 0.5) * 8, x + w * 0.7, yy + (rng() - 0.5) * 8, x + w, yy + (rng() - 0.5) * 6);
    g.stroke();
  }
  g.strokeStyle = '#efe0b8';
  g.lineWidth = 5;
  g.strokeRect(x + 9, y + 9, w - 18, h - 18);
  g.fillStyle = '#f3e6c0';
  letter(g, text, x + w / 2, y + h / 2 + 3, w - 60, Math.round(h * 0.44), SERIF, 700, 4);
}

/** Letters cast in (or fixed to) a wall: `ink` on the wall's own colour, lit from above. */
function wallLetters(g: CanvasRenderingContext2D, [x, y, w, h]: readonly number[], text: string, wall: string, ink: string, font: string, spacing: number, px = h * 0.56): void {
  g.fillStyle = wall;
  g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  letter(g, text, x + w / 2, y + h / 2 - 2, w - 40, Math.round(px), font, 800, spacing);
  g.fillStyle = ink;
  letter(g, text, x + w / 2, y + h / 2 + 1, w - 40, Math.round(px), font, 800, spacing);
}

/** An old marble headstone's face, weathered, the inscription faint (they were laid face up in the
 *  gutters in the 1930s, and cars and rain have been at them since): a tablet with a rounded head,
 *  on the gutter's grey. */
function headstone(g: CanvasRenderingContext2D, [x, y, w, h]: readonly number[], lines: string[], seed: number): void {
  const rng = makeRng(seed);
  g.fillStyle = GUTTER;
  g.fillRect(x, y, w, h);
  g.save();
  g.beginPath();
  const r = w / 2 - 3;
  g.moveTo(x + 3, y + h - 3);
  g.lineTo(x + 3, y + r + 3);
  g.arc(x + w / 2, y + r + 3, r, Math.PI, 0);
  g.lineTo(x + w - 3, y + h - 3);
  g.closePath();
  g.clip();
  g.fillStyle = MARBLE;
  g.fillRect(x, y, w, h);
  // Grey veins and lichen.
  for (let i = 0; i < 7; i++) {
    g.strokeStyle = `rgba(120,122,120,${0.08 + rng() * 0.12})`;
    g.lineWidth = 1 + rng() * 1.5;
    g.beginPath();
    let vx = x + rng() * w;
    let vy = y;
    g.moveTo(vx, vy);
    while (vy < y + h) {
      vx += (rng() - 0.5) * 18;
      vy += 10 + rng() * 22;
      g.lineTo(vx, vy);
    }
    g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(${150 + rng() * 40},${150 + rng() * 30},${110 + rng() * 30},${0.12 + rng() * 0.14})`;
    g.beginPath();
    g.ellipse(x + rng() * w, y + rng() * h, 3 + rng() * 9, 2 + rng() * 6, rng() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // The inscription: cut letters, darker in the grooves.
  g.fillStyle = 'rgba(70,72,74,0.42)';
  const top = y + 40;
  const step = (h - 70) / Math.max(4, lines.length);
  lines.forEach((t, i) => {
    const big = i === 1 || lines.length < 4;
    letter(g, t, x + w / 2, top + step * (i + 0.5), w - 22, big ? 21 : 15, SERIF, 700, 1);
  });
  // A broken corner: chipped away to the gutter.
  g.fillStyle = GUTTER;
  g.beginPath();
  g.moveTo(x + w, y + h * (0.6 + rng() * 0.25));
  g.lineTo(x + w - 12 - rng() * 16, y + h);
  g.lineTo(x + w, y + h);
  g.fill();
  g.restore();
}

function drawAtlas(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#808080';
  g.fillRect(0, 0, W, H);
  const R = RECTS;
  // HILL: the yellow diamond with a lorry on a slope, filling its square corner to corner.
  {
    const [x, y, w, h] = R.hill;
    g.fillStyle = '#1b1b1f';
    g.fillRect(x, y, w, h);
    const cx = x + w / 2;
    const cy = y + h / 2;
    g.fillStyle = '#ffd21f';
    g.beginPath();
    g.moveTo(cx, y + 9);
    g.lineTo(x + w - 9, cy);
    g.lineTo(cx, y + h - 9);
    g.lineTo(x + 9, cy);
    g.closePath();
    g.fill();
    g.strokeStyle = '#1b1b1f';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(cx, y + 22);
    g.lineTo(x + w - 22, cy);
    g.lineTo(cx, y + h - 22);
    g.lineTo(x + 22, cy);
    g.closePath();
    g.stroke();
    // The slope and the lorry going down it.
    g.fillStyle = '#1b1b1f';
    g.save();
    g.translate(cx, cy + 20);
    g.rotate(0.38);
    g.fillRect(-70, 22, 140, 9);
    g.fillRect(-44, -14, 48, 30);
    g.fillRect(6, -2, 30, 18);
    g.beginPath();
    g.moveTo(36, -2);
    g.lineTo(46, 8);
    g.lineTo(46, 16);
    g.lineTo(36, 16);
    g.fill();
    for (const wx of [-32, -6, 30]) {
      g.beginPath();
      g.arc(wx, 18, 7, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  // The plate under it, and SF's plate on its steep blocks.
  {
    const [x, y, w, h] = R.hillPlate;
    g.fillStyle = '#ffd21f';
    g.fillRect(x, y, w, h);
    g.strokeStyle = '#1b1b1f';
    g.lineWidth = 6;
    g.strokeRect(x + 7, y + 7, w - 14, h - 14);
    g.fillStyle = '#1b1b1f';
    letter(g, 'HILL', x + w / 2, y + h / 2 + 3, w - 40, 58, SANS, 900, 6);
  }
  {
    const [x, y, w, h] = R.curb;
    g.fillStyle = '#f7f7f2';
    g.fillRect(x, y, w, h);
    g.strokeStyle = '#1b1b1f';
    g.lineWidth = 4;
    g.strokeRect(x + 6, y + 6, w - 12, h - 12);
    g.fillStyle = '#1b1b1f';
    letter(g, 'PREVENT RUNAWAY VEHICLES', x + w / 2, y + 26, w - 30, 17, SANS, 800);
    g.fillStyle = '#c62828';
    letter(g, 'CURB WHEELS', x + w / 2, y + 54, w - 30, 28, SANS, 900, 2);
    g.fillStyle = '#1b1b1f';
    letter(g, 'SET BRAKE', x + w / 2, y + 82, w - 30, 20, SANS, 800, 1);
  }
  // The N Judah's route badge on its stop flag.
  {
    const [x, y, w, h] = R.judah;
    g.fillStyle = '#f7f7f2';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#1d4f91';
    g.beginPath();
    g.arc(x + w / 2, y + h / 2, w * 0.42, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    letter(g, 'N', x + w / 2, y + h / 2 + 2, w, 40, SANS, 900);
  }
  // The Stars and Stripes (for the Mint's flagpole).
  {
    const [x, y, w, h] = R.flag;
    for (let i = 0; i < 13; i++) {
      g.fillStyle = i % 2 ? '#f5f5f0' : '#b22234';
      g.fillRect(x, y + (i * h) / 13, w, h / 13 + 0.5);
    }
    g.fillStyle = '#3c3b6e';
    g.fillRect(x, y, w * 0.4, (h * 7) / 13);
    g.fillStyle = '#f5f5f0';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) g.fillRect(x + 3 + c * 7.6, y + 3 + r * 6.6, 2, 2);
  }
  parkBoard(g, R.bvPark, 'BUENA VISTA PARK');
  parkBoard(g, R.dubocePark, 'DUBOCE PARK');
  wallLetters(g, R.muni, 'MUNI METRO', '#cfcac0', '#b8352b', SANS, 18);
  wallLetters(g, R.sunset, 'SUNSET TUNNEL  ·  1928', '#d8cfbd', '#6b5a45', SERIF, 10);
  wallLetters(g, R.milk, 'HARVEY MILK CENTER FOR THE ARTS', '#f2eee6', '#2c3440', DECO, 6, 60);
  wallLetters(g, R.mint, 'UNITED STATES MINT', '#9c9fa1', '#3b3326', DECO, 22);
  // Headstones: the inscriptions that can still be read in the gutters.
  const words: string[][] = [
    ['IN MEMORY OF', 'JOHN', 'MURPHY', 'DIED', 'MAY 3 1868'],
    ['BELOVED WIFE', 'MARY', 'ANN', '1841 · 1879'],
    ['SACRED', 'TO THE MEMORY', 'OF', 'HENRY', 'LOCKWOOD'],
    ['OUR', 'BABY', 'ELLEN', 'AGED 2 YRS'],
    ['MOTHER', '1822', '1887', 'AT REST'],
    ['ERECTED BY', 'HIS', 'COMRADES', 'CO. B', '1864'],
    ['FATHER', 'JAMES', 'O’CONNELL', 'NATIVE OF', 'CORK'],
    ['GONE', 'HOME', 'SARAH', '1859'],
  ];
  STONES.forEach((k, i) => headstone(g, RECTS[k], words[i], 17 + i * 31));
}

/** The atlas material, one per scene (the scene's disposal takes it with it). */
const mats = new WeakMap<Ctx, THREE.MeshStandardMaterial>();

export function signMaterial(ctx: Ctx): THREE.MeshStandardMaterial {
  let m = mats.get(ctx);
  if (!m) {
    const tex = canvasTexture(W, H, (g) => drawAtlas(g));
    m = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.7 });
    mats.set(ctx, m);
  }
  return m;
}

/** Decals on the atlas: add them, then `finish` puts them in the scene as one mesh. */
export class Decals {
  readonly geo = new GeoBuilder();

  constructor(private readonly ctx: Ctx) {}

  /**
   * A picture from the atlas on a flat quad: centred at c, `right` and `up` its unit axes in the
   * world (it faces right × up), w by h metres. `tint` darkens or colours it (white leaves it be);
   * `mirror` flips it left to right (the back of a flag).
   */
  quad(name: Decal, c: V3, right: V3, up: V3, w: number, h: number, tint = '#ffffff', mirror = false): void {
    const [x, y, pw, ph] = RECTS[name];
    const ua = (x + 1) / W;
    const ub = (x + pw - 1) / W;
    const u0 = mirror ? ub : ua;
    const u1 = mirror ? ua : ub;
    const vt = 1 - (y + 1) / H;
    const vb = 1 - (y + ph - 1) / H;
    const p = (a: number, b: number): V3 => [c[0] + right[0] * a + up[0] * b, c[1] + right[1] * a + up[1] * b, c[2] + right[2] * a + up[2] * b];
    const n: V3 = [right[1] * up[2] - right[2] * up[1], right[2] * up[0] - right[0] * up[2], right[0] * up[1] - right[1] * up[0]];
    this.geo.quad(p(-w / 2, -h / 2), p(w / 2, -h / 2), p(w / 2, h / 2), p(-w / 2, h / 2), tint, n, [
      [u0, vb],
      [u1, vb],
      [u1, vt],
      [u0, vt],
    ]);
  }

  /** A diamond cut from a square picture (corner to corner): the HILL sign. */
  diamond(name: Decal, c: V3, right: V3, up: V3, size: number): void {
    const [x, y, pw, ph] = RECTS[name];
    const um = (x + pw / 2) / W;
    const vm = 1 - (y + ph / 2) / H;
    const du = (pw / 2 - 4) / W;
    const dv = (ph / 2 - 4) / H;
    const r = size / 2;
    const p = (a: number, b: number): V3 => [c[0] + right[0] * a + up[0] * b, c[1] + right[1] * a + up[1] * b, c[2] + right[2] * a + up[2] * b];
    const n: V3 = [right[1] * up[2] - right[2] * up[1], right[2] * up[0] - right[0] * up[2], right[0] * up[1] - right[1] * up[0]];
    this.geo.quad(p(0, -r), p(r, 0), p(0, r), p(-r, 0), '#ffffff', n, [
      [um, vm - dv],
      [um + du, vm],
      [um, vm + dv],
      [um - du, vm],
    ]);
  }

  finish(name: string): void {
    if (this.geo.vertexCount === 0) return;
    this.ctx.group.add(meshOf(this.geo, signMaterial(this.ctx), name, false, true));
  }
}

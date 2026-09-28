// Hayes Valley's lettering: every shopfront's sign (fascia, awning valance and blade), Proxy's,
// the Green's and the rest, painted into one canvas atlas along with a few shop-window tiles (lit
// interiors), so the neighbourhood's whole signage is one texture, one material and one mesh. System
// fonts only (they're there at once, no loading); each sign's lettering is fitted to its own box.
import * as THREE from 'three';
import type { GeoBuilder, V3 } from '../../geo';

export const ATLAS_W = 2048;
export const ATLAS_H = 1024;

/** Where a sign is in the atlas: its UVs (v up: three flips canvases) and its shape (w / h). */
export interface Region {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  aspect: number;
}

export type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

/** Signs packed row by row, each with a few pixels of its own background round it (so the mipmaps
 *  don't bleed one sign into the next). */
export class SignAtlas {
  readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private readonly regions = new Map<string, Region>();
  private x = 0;
  private y = 0;
  private row = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_W;
    this.canvas.height = ATLAS_H;
    this.g = this.canvas.getContext('2d')!;
    this.g.fillStyle = '#6b6b6b';
    this.g.fillRect(0, 0, ATLAS_W, ATLAS_H);
  }

  /** Paint a sign (w × h px) into the next free spot; `edge` fills its margin. */
  add(key: string, w: number, h: number, edge: string, draw: Draw): Region {
    const pad = 4;
    if (this.x + w + 2 * pad > ATLAS_W) {
      this.x = 0;
      this.y += this.row;
      this.row = 0;
    }
    // (signs.ts's set fills about three quarters of it: more than fit would fall off the bottom.)
    const g = this.g;
    const x = this.x + pad;
    const y = this.y + pad;
    g.fillStyle = edge;
    g.fillRect(x - pad, y - pad, w + 2 * pad, h + 2 * pad);
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.translate(x, y);
    draw(g, w, h);
    g.restore();
    this.x += w + 2 * pad;
    this.row = Math.max(this.row, h + 2 * pad);
    const r: Region = { u0: (x + 0.5) / ATLAS_W, u1: (x + w - 0.5) / ATLAS_W, v0: 1 - (y + h - 0.5) / ATLAS_H, v1: 1 - (y + 0.5) / ATLAS_H, aspect: w / h };
    this.regions.set(key, r);
    return r;
  }

  get(key: string): Region {
    const r = this.regions.get(key);
    if (!r) throw new Error(`hayes signs: no sign ${key}`);
    return r;
  }

  has(key: string): boolean {
    return this.regions.has(key);
  }

  texture(): THREE.CanvasTexture {
    const tex = new THREE.CanvasTexture(this.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }
}

/**
 * A textured quad: `bl`, `br`, `tr`, `tl` are its corners as a viewer in front of it sees them
 * (bottom left, bottom right, top right, top left), so the lettering reads the right way round.
 */
export function signQuad(b: GeoBuilder, r: Region, bl: V3, br: V3, tr: V3, tl: V3, tint = '#ffffff'): void {
  const e1: V3 = [br[0] - bl[0], br[1] - bl[1], br[2] - bl[2]];
  const e2: V3 = [tl[0] - bl[0], tl[1] - bl[1], tl[2] - bl[2]];
  // Facing the viewer: right × up.
  const n: V3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  b.quad(bl, br, tr, tl, tint, n, [
    [r.u0, r.v0],
    [r.u1, r.v0],
    [r.u1, r.v1],
    [r.u0, r.v1],
  ]);
}

// ---------------------------------------------------------------------------------------------
// Lettering

export const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
export const WIDE = '"Avenir Next", "Helvetica Neue", Arial, sans-serif';
export const GEO = 'Futura, "Century Gothic", "Avenir Next", sans-serif';
export const SERIF = 'Didot, "Bodoni 72", Georgia, "Times New Roman", serif';
export const BOOK = 'Georgia, "Times New Roman", serif';
export const SCRIPT = '"Snell Roundhand", "Brush Script MT", "Segoe Script", cursive';
export const HAND = '"Marker Felt", "Chalkboard SE", "Comic Sans MS", cursive';
export const ROUND = '"Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif';

/** Canvas letter-spacing (Chrome, Safari 17+; ignored elsewhere). */
function track(g: CanvasRenderingContext2D, px: number): void {
  (g as unknown as { letterSpacing: string }).letterSpacing = `${px.toFixed(1)}px`;
}

/** Set the largest font (up to maxH px) that fits `text` in maxW, tracking a fraction of its size. */
export function fitFont(g: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, maxH: number, tr = 0): number {
  let px = Math.max(6, Math.floor(maxH));
  for (let k = 0; k < 4; k++) {
    g.font = font(px);
    track(g, px * tr);
    const m = g.measureText(text).width;
    if (m <= maxW) break;
    px = Math.max(6, Math.floor((px * maxW) / m) - 1);
  }
  g.font = font(px);
  track(g, px * tr);
  return px;
}

/** A plain sign: lettering on a ground, one line or more. */
export interface Letters {
  bg: string;
  fg: string;
  lines: string[];
  font: string;
  weight?: number;
  italic?: boolean;
  /** Letter-spacing as a fraction of the size. */
  tr?: number;
  /** Relative sizes of the lines (default all the same). */
  sizes?: number[];
  /** A keyline inset round the edge. */
  rule?: string;
  /** How much of the height the lettering takes (default 0.62). */
  fill?: number;
}

export function lettered(s: Letters): Draw {
  return (g, w, h) => {
    g.fillStyle = s.bg;
    g.fillRect(0, 0, w, h);
    if (s.rule) {
      g.strokeStyle = s.rule;
      g.lineWidth = Math.max(2, h * 0.04);
      const i = h * 0.09;
      g.strokeRect(i, i, w - 2 * i, h - 2 * i);
    }
    const sizes = s.sizes ?? s.lines.map(() => 1);
    const total = sizes.reduce((a, b) => a + b, 0);
    const band = h * (s.fill ?? 0.62);
    let y = (h - band) / 2;
    g.fillStyle = s.fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    s.lines.forEach((line, i) => {
      const lh = (band * sizes[i]) / total;
      const font = (px: number): string => `${s.italic ? 'italic ' : ''}${s.weight ?? 700} ${px}px ${s.font}`;
      fitFont(g, line, font, w * 0.86, lh * 0.95, s.tr ?? 0);
      g.fillText(line, w / 2, y + lh / 2 + lh * 0.04);
      y += lh;
    });
    track(g, 0);
  };
}

// ---------------------------------------------------------------------------------------------
// Shop windows: what's behind the glass, lit, with the street's reflection over it.

export type WindowKind = 'clothes' | 'cafe' | 'beds' | 'shelves' | 'icecream' | 'dark' | 'papered' | 'bar' | 'bakery' | 'shoes';

export function windowTile(kind: WindowKind): Draw {
  return (g, w, h) => {
    const grad = (a: string, b: string): void => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, a);
      gr.addColorStop(1, b);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    };
    const rect = (c: string, x: number, y: number, rw: number, rh: number): void => {
      g.fillStyle = c;
      g.fillRect(x * w, y * h, rw * w, rh * h);
    };
    const dot = (c: string, x: number, y: number, r: number): void => {
      g.fillStyle = c;
      g.beginPath();
      g.arc(x * w, y * h, r * w, 0, Math.PI * 2);
      g.fill();
    };
    const pendant = (x: number, y: number): void => {
      rect('rgba(30,20,15,0.8)', x - 0.004, 0, 0.008, y);
      const glow = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, 0.16 * w);
      glow.addColorStop(0, 'rgba(255,214,140,0.55)');
      glow.addColorStop(1, 'rgba(255,214,140,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
      dot('#ffe2a6', x, y, 0.045);
    };
    switch (kind) {
      case 'clothes': {
        grad('#f1e6d2', '#d8c3a0');
        rect('#b99b76', 0, 0.84, 1, 0.16);
        for (const x of [0.25, 0.55, 0.82]) pendant(x, 0.12);
        rect('#3a3430', 0.06, 0.34, 0.88, 0.012);
        const cols = ['#2f4a6b', '#c9b89a', '#8a3b35', '#e9e3d6', '#5b6b4a', '#1f1f22', '#c47a3d', '#7d8ea3'];
        for (let i = 0; i < 8; i++) {
          const x = 0.08 + i * 0.105;
          rect(cols[i], x, 0.35, 0.085, 0.24 + ((i * 37) % 10) * 0.012);
          rect('rgba(0,0,0,0.12)', x, 0.35, 0.085, 0.02);
        }
        // A mannequin in front.
        dot('#e7e2da', 0.72, 0.5, 0.05);
        rect('#e7e2da', 0.66, 0.54, 0.12, 0.22);
        rect('#2c3e5c', 0.655, 0.58, 0.13, 0.2);
        rect('#cfc8bd', 0.715, 0.78, 0.01, 0.07);
        break;
      }
      case 'shoes': {
        grad('#f3ede4', '#dcd0bf');
        for (const x of [0.3, 0.7]) pendant(x, 0.1);
        for (let r = 0; r < 4; r++) {
          const y = 0.3 + r * 0.16;
          rect('#a67c52', 0.08, y, 0.84, 0.018);
          for (let i = 0; i < 5; i++) rect(['#3b2a20', '#c9a27a', '#1c1c1c', '#8a3b35', '#e8e2d8'][(i + r) % 5], 0.12 + i * 0.16, y - 0.05, 0.11, 0.05);
        }
        rect('#b59474', 0, 0.9, 1, 0.1);
        break;
      }
      case 'cafe': {
        grad('#4b3024', '#6e4832');
        rect('#8a5a3c', 0, 0.7, 1, 0.3);
        rect('#2f1f18', 0.05, 0.62, 0.9, 0.1);
        rect('#f0e2c6', 0.12, 0.52, 0.34, 0.1);
        for (let i = 0; i < 5; i++) dot(['#d9a45a', '#c6743d', '#e8c27a', '#b5582f', '#f2d7a0'][i], 0.16 + i * 0.065, 0.575, 0.022);
        for (const x of [0.18, 0.5, 0.82]) pendant(x, 0.16 + (x > 0.4 && x < 0.6 ? 0.06 : 0));
        // People at the counter.
        for (const [x, s] of [
          [0.62, 1],
          [0.8, 0.9],
        ] as const) {
          dot('#2a1b14', x, 0.44 * s + 0.1, 0.05);
          rect('#2a1b14', x - 0.07, 0.5 * s + 0.1, 0.14, 0.3);
        }
        break;
      }
      case 'bakery': {
        grad('#f5e9d6', '#e1cba7');
        for (const x of [0.25, 0.75]) pendant(x, 0.12);
        rect('#caa77e', 0.04, 0.3, 0.92, 0.015);
        rect('#caa77e', 0.04, 0.46, 0.92, 0.015);
        for (let i = 0; i < 7; i++) {
          dot(['#c8843f', '#e0a55a', '#b56a2e', '#d99a52'][i % 4], 0.1 + i * 0.13, 0.275, 0.04);
          dot(['#e0a55a', '#b56a2e', '#c8843f', '#f0c07a'][i % 4], 0.1 + i * 0.13, 0.435, 0.04);
        }
        rect('#8e6a48', 0.02, 0.62, 0.96, 0.38);
        rect('#f7efe2', 0.06, 0.64, 0.88, 0.14);
        for (let i = 0; i < 6; i++) dot(['#9b4a2c', '#f2d7a0', '#c46f3a'][i % 3], 0.14 + i * 0.145, 0.71, 0.035);
        break;
      }
      case 'beds': {
        grad('#f6f2eb', '#e6dfd3');
        rect('#d9ccb8', 0, 0.8, 1, 0.2);
        pendant(0.3, 0.14);
        rect('#c9b79c', 0.08, 0.42, 0.84, 0.16);
        rect('#fdfcf9', 0.1, 0.52, 0.8, 0.2);
        rect('#fdfcf9', 0.14, 0.46, 0.2, 0.08);
        rect('#fdfcf9', 0.38, 0.46, 0.2, 0.08);
        rect('#2c3e5f', 0.52, 0.56, 0.38, 0.17);
        rect('#8a7a64', 0.1, 0.72, 0.03, 0.08);
        rect('#8a7a64', 0.87, 0.72, 0.03, 0.08);
        dot('#6f9a5a', 0.85, 0.3, 0.07);
        rect('#b5a48c', 0.83, 0.34, 0.04, 0.1);
        break;
      }
      case 'shelves': {
        grad('#f3eee6', '#ddd3c4');
        for (const x of [0.3, 0.72]) pendant(x, 0.1);
        for (let r = 0; r < 4; r++) {
          const y = 0.3 + r * 0.15;
          rect('#b08a62', 0.05, y, 0.9, 0.02);
          for (let i = 0; i < 9; i++) {
            const c = ['#e85d4a', '#2f6fb0', '#f2c14e', '#3e8e6a', '#e9e3d6', '#8a4f9e', '#1f1f22', '#f29e4c', '#8fc1d9'][(i * 3 + r) % 9];
            const hh = 0.05 + ((i + r) % 3) * 0.02;
            rect(c, 0.08 + i * 0.095, y - hh, 0.07, hh);
          }
        }
        rect('#c7b59a', 0, 0.9, 1, 0.1);
        break;
      }
      case 'icecream': {
        grad('#fdf3ea', '#f1dccb');
        rect('#2b2f2c', 0.1, 0.1, 0.8, 0.22);
        for (let i = 0; i < 4; i++) rect('#f4efe4', 0.16, 0.14 + i * 0.045, 0.3 + (i % 2) * 0.2, 0.012);
        rect('#f7f7f4', 0.04, 0.58, 0.92, 0.42);
        rect('#e36f79', 0.04, 0.58, 0.92, 0.04);
        for (let i = 0; i < 6; i++) dot(['#f6d8e0', '#fff3c9', '#7a4a33', '#c9e7d4', '#f4b8a0', '#e8e0f5'][i], 0.12 + i * 0.15, 0.55, 0.045);
        dot('#3a2a22', 0.66, 0.4, 0.05);
        rect('#3a2a22', 0.59, 0.45, 0.14, 0.14);
        break;
      }
      case 'bar': {
        grad('#2b1d17', '#3d2a20');
        rect('#5a3b28', 0.04, 0.2, 0.92, 0.42);
        for (let r = 0; r < 3; r++) {
          const y = 0.28 + r * 0.12;
          rect('#caa25c', 0.06, y + 0.045, 0.88, 0.008);
          for (let i = 0; i < 10; i++) dot(['#e8c070', '#9fd1b0', '#f0e0b0', '#d98a4a'][(i + r) % 4], 0.1 + i * 0.087, y + 0.02, 0.018);
        }
        rect('#1b120e', 0, 0.66, 1, 0.34);
        for (const x of [0.22, 0.5, 0.78]) pendant(x, 0.1);
        g.fillStyle = 'rgba(255,70,90,0.85)';
        g.font = `700 ${Math.round(h * 0.07)}px ${SANS}`;
        g.textAlign = 'center';
        g.fillText('OPEN', w * 0.5, h * 0.16);
        break;
      }
      case 'papered': {
        grad('#cdb58f', '#b99e76');
        for (let i = 0; i < 7; i++) rect('rgba(90,60,30,0.12)', 0, i * 0.15, 1, 0.006);
        rect('#f5f1e8', 0.2, 0.36, 0.6, 0.22);
        g.fillStyle = '#b3262d';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        fitFont(g, 'FOR LEASE', (px) => `800 ${px}px ${SANS}`, w * 0.5, h * 0.08);
        g.fillText('FOR LEASE', w * 0.5, h * 0.47);
        break;
      }
      case 'dark':
      default: {
        grad('#35404c', '#1b222b');
        break;
      }
    }
    // The glass: the sky's reflection across the top, a streak of light, the frame's shadow.
    const sky = g.createLinearGradient(0, 0, 0, h * 0.45);
    sky.addColorStop(0, kind === 'dark' ? 'rgba(190,210,230,0.55)' : 'rgba(200,220,240,0.32)');
    sky.addColorStop(1, 'rgba(200,220,240,0)');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h * 0.45);
    g.fillStyle = 'rgba(255,255,255,0.13)';
    g.beginPath();
    g.moveTo(w * 0.55, 0);
    g.lineTo(w * 0.8, 0);
    g.lineTo(w * 0.35, h);
    g.lineTo(w * 0.1, h);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = w * 0.04;
    g.strokeRect(0, 0, w, h);
  };
}

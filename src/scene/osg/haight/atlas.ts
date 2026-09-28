// The Haight's signs, murals and painted things, all on one canvas: every shop's fascia and blade,
// the murals that wrap the shopfronts, the Haight & Ashbury street blades, the clock stuck at 4:20,
// the fishnet on Piedmont's legs. Cells are shelf-packed onto one texture (each cell's edges
// smeared into its gutter so mipmaps don't bleed), and quads map a cell (or part of one) across
// them; one material draws the lot. The painting helpers here are the ones the cells share.
import * as THREE from 'three';
import type { GeoBuilder, V3 } from '../../geo';

/** Paint a cell: (0, 0) is its top-left, w × h its size in pixels. */
export type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

export interface Cell {
  name: string;
  w: number;
  h: number;
  draw: Draw;
}

/** Gutter between cells (px), filled with each cell's own edge. */
const PAD = 4;

export class Atlas {
  readonly texture: THREE.CanvasTexture;
  private readonly rects = new Map<string, { x: number; y: number; w: number; h: number }>();

  constructor(
    cells: Cell[],
    readonly width = 2048,
    readonly height = 2048,
  ) {
    // Skyline packing, tallest first: each cell goes where its top comes out lowest.
    const sky: { x: number; y: number; w: number }[] = [{ x: 0, y: 0, w: width }];
    const placed: Cell[] = [];
    for (const c of [...cells].sort((a, b) => b.h - a.h || b.w - a.w)) {
      const cw = c.w + 2 * PAD;
      const ch = c.h + 2 * PAD;
      let best: { x: number; y: number } | null = null;
      for (const seg of sky) {
        if (seg.x + cw > width) continue;
        let y = 0;
        for (const q of sky) if (q.x < seg.x + cw && q.x + q.w > seg.x) y = Math.max(y, q.y);
        if (y + ch <= height && (!best || y < best.y || (y === best.y && seg.x < best.x))) best = { x: seg.x, y };
      }
      if (!best) {
        // No room: it shows the white cell instead (and says so), rather than stopping the scene.
        console.warn(`haight atlas: no room for ${c.name}`);
        continue;
      }
      this.rects.set(c.name, { x: best.x + PAD, y: best.y + PAD, w: c.w, h: c.h });
      placed.push(c);
      // Raise the skyline under it.
      const x0 = best.x;
      const x1 = best.x + cw;
      const next: { x: number; y: number; w: number }[] = [];
      for (const q of sky) {
        if (q.x + q.w <= x0 || q.x >= x1) next.push(q);
        else {
          if (q.x < x0) next.push({ x: q.x, y: q.y, w: x0 - q.x });
          if (q.x + q.w > x1) next.push({ x: x1, y: q.y, w: q.x + q.w - x1 });
        }
      }
      next.push({ x: x0, y: best.y + ch, w: cw });
      next.sort((a, b) => a.x - b.x);
      sky.length = 0;
      for (const q of next) {
        const last = sky[sky.length - 1];
        if (last && last.y === q.y && last.x + last.w === q.x) last.w += q.w;
        else sky.push({ ...q });
      }
    }
    cells = placed;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d')!;
    for (const c of cells) {
      const r = this.rects.get(c.name)!;
      g.save();
      g.beginPath();
      g.rect(r.x, r.y, r.w, r.h);
      g.clip();
      g.translate(r.x, r.y);
      c.draw(g, r.w, r.h);
      g.restore();
      // Smear the edges into the gutter.
      g.drawImage(canvas, r.x, r.y, 1, r.h, r.x - PAD, r.y, PAD, r.h);
      g.drawImage(canvas, r.x + r.w - 1, r.y, 1, r.h, r.x + r.w, r.y, PAD, r.h);
      g.drawImage(canvas, r.x - PAD, r.y, r.w + 2 * PAD, 1, r.x - PAD, r.y - PAD, r.w + 2 * PAD, PAD);
      g.drawImage(canvas, r.x - PAD, r.y + r.h - 1, r.w + 2 * PAD, 1, r.x - PAD, r.y + r.h, r.w + 2 * PAD, PAD);
    }
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.needsUpdate = true;
  }

  /** A cell's width over its height. */
  aspect(name: string): number {
    const r = this.rects.get(name);
    return r ? r.w / r.h : 4;
  }

  /** A cell's UV rectangle (u0, v0 at its bottom-left), or a part of it: sub = [x0, y0, x1, y1] as
   *  fractions of the cell from its top-left. */
  uv(name: string, sub: [number, number, number, number] = [0, 0, 1, 1]): [number, number, number, number] {
    const r = this.rects.get(name) ?? this.rects.get('white');
    if (!r) throw new Error(`haight atlas: no cell ${name}`);
    const W = this.width;
    const H = this.height;
    const x0 = r.x + sub[0] * r.w;
    const x1 = r.x + sub[2] * r.w;
    const y0 = r.y + sub[1] * r.h;
    const y1 = r.y + sub[3] * r.h;
    return [x0 / W, 1 - y1 / H, x1 / W, 1 - y0 / H];
  }

  /**
   * A quad showing a cell: corners bottom-left, bottom-right, top-right, top-left (the picture the
   * right way round seen from the side they wind anticlockwise on). `facing` flips it if need be.
   */
  quad(b: GeoBuilder, name: string, bl: V3, br: V3, tr: V3, tl: V3, facing?: V3, sub?: [number, number, number, number], color: THREE.ColorRepresentation = '#ffffff'): void {
    const [u0, v0, u1, v1] = this.uv(name, sub);
    b.quad(bl, br, tr, tl, color, facing, [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ]);
  }

  /** Remap a geometry's own 0..1 UVs into a cell (for the legs' stockings and the like). */
  remap(geo: THREE.BufferGeometry, name: string): THREE.BufferGeometry {
    const [u0, v0, u1, v1] = this.uv(name);
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    return geo;
  }
}

// ---------------------------------------------------------------------------------------------
// Painting helpers

export const ROUND = '"Arial Rounded MT Bold", "Nunito", "Arial Black", sans-serif';
export const HEAVY = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
export const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
export const SERIF = 'Georgia, "Times New Roman", serif';
export const SLAB = 'Rockwell, "Roboto Slab", Georgia, serif';
export const SCRIPT = '"Brush Script MT", "Snell Roundhand", "Segoe Script", cursive';
export const FUNKY = '"Cooper Black", "Cooper Std", "Arial Rounded MT Bold", Georgia, serif';
export const GOTHIC = '"Old English Text MT", "UnifrakturMaguntia", Luminari, Georgia, serif';

export interface TextOpts {
  family: string;
  weight?: string;
  fill: string | CanvasGradient;
  stroke?: string;
  strokeW?: number;
  italic?: boolean;
  /** Extra letter spacing (px). */
  track?: number;
  shadow?: string;
}

/** The largest font size (≤ maxH) at which `s` fits maxW. */
function fit(g: CanvasRenderingContext2D, s: string, maxW: number, maxH: number, o: TextOpts): number {
  let px = maxH;
  for (let k = 0; k < 3; k++) {
    g.font = `${o.italic ? 'italic ' : ''}${o.weight ?? '800'} ${px}px ${o.family}`;
    const w = g.measureText(s).width + (o.track ?? 0) * (s.length - 1);
    if (w <= maxW) break;
    px = Math.floor((px * maxW) / w);
  }
  return px;
}

/** Text centred on (cx, cy), as big as fits maxW × maxH, with an optional outline. */
export function text(g: CanvasRenderingContext2D, s: string, cx: number, cy: number, maxW: number, maxH: number, o: TextOpts): void {
  const px = fit(g, s, maxW, maxH, o);
  g.font = `${o.italic ? 'italic ' : ''}${o.weight ?? '800'} ${px}px ${o.family}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const draw = (fn: (t: string, x: number, y: number) => void): void => {
    if (!o.track) {
      fn(s, cx, cy + px * 0.05);
      return;
    }
    const total = g.measureText(s).width + o.track * (s.length - 1);
    let x = cx - total / 2;
    g.textAlign = 'left';
    for (const ch of s) {
      fn(ch, x, cy + px * 0.05);
      x += g.measureText(ch).width + o.track;
    }
    g.textAlign = 'center';
  };
  if (o.shadow) {
    g.fillStyle = o.shadow;
    g.save();
    g.translate(px * 0.06, px * 0.07);
    draw((t, x, y) => g.fillText(t, x, y));
    g.restore();
  }
  if (o.stroke) {
    g.strokeStyle = o.stroke;
    g.lineWidth = o.strokeW ?? px * 0.16;
    draw((t, x, y) => g.strokeText(t, x, y));
  }
  g.fillStyle = o.fill;
  draw((t, x, y) => g.fillText(t, x, y));
}

/** Psychedelic lettering, the '67 poster way: every letter swells and sways on a wave. */
export function trippy(g: CanvasRenderingContext2D, s: string, cx: number, cy: number, maxW: number, maxH: number, o: TextOpts & { wave?: number; swell?: number; colors?: string[] }): void {
  const wave = o.wave ?? 0.12;
  const swell = o.swell ?? 0.18;
  const px = fit(g, s, maxW * 0.92, maxH * 0.8, o);
  g.font = `${o.weight ?? '800'} ${px}px ${o.family}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const widths = [...s].map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = cx - total / 2;
  [...s].forEach((ch, i) => {
    const t = i / Math.max(1, s.length - 1);
    const k = 1 + swell * Math.sin(t * Math.PI);
    const y = cy + Math.sin(t * Math.PI * 2.2) * px * wave;
    g.save();
    g.translate(x + widths[i] / 2, y);
    g.rotate(Math.cos(t * Math.PI * 2.2) * 0.12);
    g.scale(k, k * 1.08);
    if (o.stroke) {
      g.strokeStyle = o.stroke;
      g.lineWidth = o.strokeW ?? px * 0.18;
      g.strokeText(ch, 0, 0);
    }
    g.fillStyle = o.colors ? o.colors[i % o.colors.length] : o.fill;
    g.fillText(ch, 0, 0);
    g.restore();
    x += widths[i];
  });
}

/** A painted board: background, and an inset rim. */
export function board(g: CanvasRenderingContext2D, w: number, h: number, bg: string | CanvasGradient, rim?: string, rimW = 6, inset = 8): void {
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (rim) {
    g.strokeStyle = rim;
    g.lineWidth = rimW;
    g.strokeRect(inset, inset, w - 2 * inset, h - 2 * inset);
  }
}

/** A rainbow's bands, outermost first (red to violet), as arcs round (cx, cy). */
export function rainbow(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, band: number, a0 = Math.PI, a1 = 2 * Math.PI): void {
  const cols = ['#e8322a', '#f7862a', '#f9d423', '#4cb944', '#2f8fd8', '#6a4bc4'];
  g.lineCap = 'butt';
  cols.forEach((c, i) => {
    g.strokeStyle = c;
    g.lineWidth = band + 1;
    g.beginPath();
    g.arc(cx, cy, r - i * band, a0, a1);
    g.stroke();
  });
}

export function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  g.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.75, x, y + s);
  g.bezierCurveTo(x, y + s * 0.75, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  g.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.35);
  g.fill();
}

/** A daisy (petals round a yellow middle). */
export function flower(g: CanvasRenderingContext2D, x: number, y: number, r: number, petal: string, mid = '#f9d423'): void {
  g.fillStyle = petal;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    g.beginPath();
    g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.45, r * 0.28, a, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = mid;
  g.beginPath();
  g.arc(x, y, r * 0.3, 0, Math.PI * 2);
  g.fill();
}

/** A peace sign. */
export function peace(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, lw = r * 0.16): void {
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.moveTo(x, y - r);
  g.lineTo(x, y + r);
  g.moveTo(x, y);
  g.lineTo(x - r * 0.7, y + r * 0.7);
  g.moveTo(x, y);
  g.lineTo(x + r * 0.7, y + r * 0.7);
  g.stroke();
}

/** A red-capped mushroom with white spots. */
export function mushroom(g: CanvasRenderingContext2D, x: number, y: number, s: number, cap = '#e8322a'): void {
  g.fillStyle = '#f6ecd6';
  g.fillRect(x - s * 0.16, y - s * 0.45, s * 0.32, s * 0.45);
  g.fillStyle = cap;
  g.beginPath();
  g.ellipse(x, y - s * 0.45, s * 0.5, s * 0.36, 0, Math.PI, 2 * Math.PI);
  g.fill();
  g.fillStyle = '#ffffff';
  for (const [dx, dy, r] of [
    [-0.25, -0.58, 0.07],
    [0.05, -0.7, 0.08],
    [0.28, -0.55, 0.06],
  ]) {
    g.beginPath();
    g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    g.fill();
  }
}

/** An eye (the all-seeing kind). */
export function eye(g: CanvasRenderingContext2D, x: number, y: number, w: number, iris: string): void {
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#1b1b1f';
  g.lineWidth = Math.max(2, w * 0.06);
  g.beginPath();
  g.moveTo(x - w / 2, y);
  g.quadraticCurveTo(x, y - w * 0.45, x + w / 2, y);
  g.quadraticCurveTo(x, y + w * 0.45, x - w / 2, y);
  g.fill();
  g.stroke();
  g.fillStyle = iris;
  g.beginPath();
  g.arc(x, y, w * 0.17, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1b1b1f';
  g.beginPath();
  g.arc(x, y, w * 0.08, 0, Math.PI * 2);
  g.fill();
}

/** Radiating stripes from (cx, cy): the sunburst behind half the Haight's signs. */
export function sunburst(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, cols: string[], n = 24): void {
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2;
    const a1 = ((k + 1) / n) * Math.PI * 2;
    g.fillStyle = cols[k % cols.length];
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, r, a0, a1);
    g.closePath();
    g.fill();
  }
}

/** Swirls of colour: a tie-dye spiral filling w × h. */
export function tieDye(g: CanvasRenderingContext2D, w: number, h: number, cols: string[]): void {
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.hypot(w, h) / 2;
  const n = cols.length * 3;
  for (let k = 0; k < n; k++) {
    g.fillStyle = cols[k % cols.length];
    g.beginPath();
    for (let t = 0; t <= 1.001; t += 0.05) {
      const r = t * R;
      const a = (k / n) * Math.PI * 2 + t * 5;
      if (t === 0) g.moveTo(cx, cy);
      else g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    for (let t = 1; t >= 0; t -= 0.05) {
      const r = t * R;
      const a = ((k + 1) / n) * Math.PI * 2 + t * 5;
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.fill();
  }
  // The crinkles.
  g.globalAlpha = 0.18;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2;
  for (let r = 6; r < R; r += 9) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
}

// Noe Valley's lettering, all in one atlas (osg/hayes/atlas.ts): 24th St's shops, the real ones where
// they are (Noe Valley Bakery, the post office, Starbucks, Bernie's, Noe Valley Books, Fresca, Whole
// Foods, Haystack Pizza, Martha & Bros., Noe Valley Wine & Spirits, Noe Valley Pediatrics...) and the
// ones a valley of strollers needs (a toy shop, a children's boutique, a baby gym, mommy-and-me yoga,
// a stroller dealership); their blade signs; the Town Square's; race day's baby-shower bunting (IT'S A
// BOY! IT'S A GIRL!), the pole banners, SLOW — CHILDREN AT PLAY and BABY ON BOARD diamonds,
// STROLLER PARKING; the diaper van's livery; and the shop-window tiles, the kids' ones painted here.
import { BOOK, GEO, HAND, ROUND, SANS, SCRIPT, SERIF, WIDE, SignAtlas, fitFont, lettered, windowTile, type Draw, type Letters, type WindowKind } from '../../osg/hayes/atlas';

interface Spec {
  key: string;
  w: number;
  h: number;
  edge: string;
  draw: Draw;
}

const L = (key: string, w: number, h: number, s: Letters): Spec => ({ key, w, h, edge: s.bg, draw: lettered(s) });

const centre = (g: CanvasRenderingContext2D): void => {
  g.textAlign = 'center';
  g.textBaseline = 'middle';
};

/** Noe Valley's own window displays, as WindowKinds the shopfronts can ask for (`w_<kind>`). */
export const NOE_WINDOWS = ['toys', 'kids', 'yoga', 'strollers', 'clinic', 'diapers'] as const;
export type NoeWindow = (typeof NOE_WINDOWS)[number];
/** A Noe Valley window as the shopfront builder's WindowKind (it only reads `w_<kind>` from the atlas). */
export const nw = (k: NoeWindow | WindowKind): WindowKind => k as WindowKind;

/** A little stroller pictogram: the hood, the seat, two wheels, the handle. */
function strollerIcon(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string): void {
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = s * 0.09;
  g.lineCap = 'round';
  // Hood: a quarter disc.
  g.beginPath();
  g.moveTo(cx - s * 0.1, cy - s * 0.05);
  g.arc(cx - s * 0.1, cy - s * 0.05, s * 0.42, Math.PI, Math.PI * 1.5);
  g.closePath();
  g.fill();
  // Seat and the bar to the handle.
  g.beginPath();
  g.moveTo(cx - s * 0.52, cy - s * 0.05);
  g.lineTo(cx + s * 0.32, cy - s * 0.05);
  g.lineTo(cx + s * 0.18, cy + s * 0.22);
  g.lineTo(cx - s * 0.38, cy + s * 0.22);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(cx + s * 0.32, cy - s * 0.05);
  g.lineTo(cx + s * 0.5, cy - s * 0.45);
  g.lineTo(cx + s * 0.66, cy - s * 0.45);
  g.stroke();
  for (const wx of [-0.3, 0.12]) {
    g.beginPath();
    g.arc(cx + s * wx, cy + s * 0.42, s * 0.13, 0, Math.PI * 2);
    g.fill();
  }
}

/** A yellow warning diamond, drawn turned 45° so that on a quad stood on its corner it reads level
 *  (see noe/props.ts: diamondSign): its lettering and a pictogram. */
function diamond(lines: string[], icon: 'kids' | 'baby'): Draw {
  return (g, w, h) => {
    g.fillStyle = '#f7c81e';
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(Math.PI / 4);
    const s = w * 0.62;
    g.strokeStyle = '#151515';
    g.lineWidth = w * 0.03;
    g.strokeRect(-s / 2, -s / 2, s, s);
    centre(g);
    g.fillStyle = '#151515';
    if (icon === 'kids') {
      // Two running children.
      for (const [x, k] of [
        [-0.13, 1],
        [0.13, 0.82],
      ] as const) {
        const cx = x * s;
        const cy = -0.02 * s;
        g.beginPath();
        g.arc(cx, cy - 0.17 * s * k, 0.055 * s * k, 0, Math.PI * 2);
        g.fill();
        g.lineWidth = 0.04 * s * k;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(cx, cy - 0.1 * s * k);
        g.lineTo(cx, cy + 0.04 * s * k);
        g.moveTo(cx, cy + 0.04 * s * k);
        g.lineTo(cx - 0.07 * s * k, cy + 0.15 * s * k);
        g.moveTo(cx, cy + 0.04 * s * k);
        g.lineTo(cx + 0.08 * s * k, cy + 0.13 * s * k);
        g.moveTo(cx - 0.08 * s * k, cy - 0.04 * s * k);
        g.lineTo(cx + 0.08 * s * k, cy - 0.08 * s * k);
        g.stroke();
      }
    } else {
      // A baby's face.
      g.beginPath();
      g.arc(0, -0.08 * s, 0.13 * s, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f7c81e';
      for (const ex of [-0.045, 0.045]) {
        g.beginPath();
        g.arc(ex * s, -0.1 * s, 0.018 * s, 0, Math.PI * 2);
        g.fill();
      }
      g.lineWidth = 0.014 * s;
      g.strokeStyle = '#f7c81e';
      g.beginPath();
      g.arc(0, -0.06 * s, 0.05 * s, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
      g.fillStyle = '#151515';
    }
    lines.forEach((t, i) => {
      fitFont(g, t, (px) => `900 ${px}px ${WIDE}`, s * 0.8, s * 0.12);
      g.fillText(t, 0, (0.16 + i * 0.13) * s);
    });
    g.restore();
  };
}

/** A baby-shower banner: pastel, with stars, and its message. */
function shower(text: string, bg: string, fg: string, star: string): Draw {
  return (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = star;
    for (let i = 0; i < 14; i++) {
      const x = ((i * 97) % 100) / 100;
      const y = ((i * 61) % 100) / 100;
      const r = h * (0.04 + (i % 3) * 0.015);
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = k % 2 ? r * 0.45 : r;
        g.lineTo(x * w + Math.cos(a) * rr, y * h + Math.sin(a) * rr);
      }
      g.fill();
    }
    g.strokeStyle = '#ffffff';
    g.lineWidth = h * 0.05;
    g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
    centre(g);
    fitFont(g, text, (px) => `900 ${px}px ${ROUND}`, w * 0.84, h * 0.6);
    g.lineWidth = h * 0.06;
    g.strokeStyle = '#ffffff';
    g.strokeText(text, w / 2, h * 0.53);
    g.fillStyle = fg;
    g.fillText(text, w / 2, h * 0.53);
  };
}

/** A vertical pole banner: lettering running down it, a heart or a stroller under it. */
function poleBanner(text: string, bg: string, fg: string, icon: 'heart' | 'stroller'): Draw {
  return (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.fillRect(0, 0, w, h * 0.04);
    g.fillRect(0, h * 0.96, w, h * 0.04);
    centre(g);
    const letters = text.split('');
    const step = (h * 0.62) / letters.length;
    letters.forEach((ch, i) => {
      fitFont(g, ch === ' ' ? 'M' : ch, (px) => `900 ${px}px ${ROUND}`, w * 0.7, step * 0.92);
      if (ch !== ' ') g.fillText(ch, w / 2, h * 0.08 + step * (i + 0.5));
    });
    if (icon === 'heart') {
      const cx = w / 2;
      const cy = h * 0.84;
      const r = w * 0.2;
      g.beginPath();
      g.moveTo(cx, cy + r * 1.1);
      g.bezierCurveTo(cx - r * 2, cy - r * 0.4, cx - r * 0.6, cy - r * 1.6, cx, cy - r * 0.5);
      g.bezierCurveTo(cx + r * 0.6, cy - r * 1.6, cx + r * 2, cy - r * 0.4, cx, cy + r * 1.1);
      g.fill();
    } else strollerIcon(g, w / 2 - w * 0.05, h * 0.83, w * 0.42, fg);
  };
}

/** Starbucks: the green ground, the round white-ringed badge, the name. */
function starbucks(blade: boolean): Draw {
  return (g, w, h) => {
    g.fillStyle = blade ? '#00704a' : '#1e3932';
    g.fillRect(0, 0, w, h);
    const r = (blade ? Math.min(w, h) : h) * 0.4;
    const cx = blade ? w / 2 : h * 0.6;
    const cy = h / 2;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#00704a';
    g.beginPath();
    g.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
    g.fill();
    // The star on her crown.
    g.fillStyle = '#00704a';
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = k % 2 ? r * 0.08 : r * 0.2;
      g.lineTo(cx + Math.cos(a) * rr, cy - r * 0.18 + Math.sin(a) * rr);
    }
    g.fill();
    if (!blade) {
      centre(g);
      g.fillStyle = '#ffffff';
      fitFont(g, 'STARBUCKS', (px) => `700 ${px}px ${WIDE}`, w - h * 1.4, h * 0.42, 0.12);
      g.fillText('STARBUCKS', (w + h * 1.2) / 2, h * 0.53);
    }
  };
}

/** Just for Fun: every letter its own colour, on white. */
function justForFun(blade: boolean): Draw {
  return (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    const cols = ['#e2453c', '#f29c1f', '#f2c81e', '#4caf50', '#2f80d6', '#8a4fc2'];
    const text = blade ? 'TOYS!' : 'Just for Fun';
    centre(g);
    const px = fitFont(g, text, (p) => `900 ${p}px ${ROUND}`, w * 0.88, h * (blade ? 0.5 : 0.56));
    g.font = `900 ${px}px ${ROUND}`;
    const total = g.measureText(text).width;
    let x = (w - total) / 2;
    text.split('').forEach((ch, i) => {
      const cw = g.measureText(ch).width;
      g.fillStyle = cols[i % cols.length];
      g.fillText(ch, x + cw / 2, h * (blade ? 0.5 : 0.42));
      x += cw;
    });
    if (!blade) {
      g.fillStyle = '#555555';
      fitFont(g, 'toys · games · gifts', (p) => `700 ${p}px ${ROUND}`, w * 0.7, h * 0.2);
      g.fillText('toys · games · gifts', w / 2, h * 0.8);
    }
  };
}

/** The diaper van's side: its name, the promise, a smiling baby. */
function vanSide(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = '#f8fbfd';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#7cc6e8';
  g.fillRect(0, h * 0.72, w, h * 0.28);
  // The baby.
  const cx = w * 0.16;
  const cy = h * 0.42;
  const r = h * 0.27;
  g.fillStyle = '#f6cfae';
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3a2a22';
  for (const ex of [-0.35, 0.35]) {
    g.beginPath();
    g.arc(cx + ex * r, cy - 0.1 * r, r * 0.09, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#3a2a22';
  g.lineWidth = r * 0.08;
  g.beginPath();
  g.arc(cx, cy + 0.1 * r, r * 0.4, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
  g.fillStyle = '#e88aa0';
  g.beginPath();
  g.arc(cx, cy - r * 1.02, r * 0.18, 0, Math.PI * 2);
  g.fill();
  centre(g);
  g.fillStyle = '#2b7fb8';
  fitFont(g, 'DIAPER DASH', (px) => `900 ${px}px ${ROUND}`, w * 0.62, h * 0.32);
  g.fillText('DIAPER DASH', w * 0.63, h * 0.32);
  g.fillStyle = '#e2453c';
  fitFont(g, 'we deliver · 24/7 · 20 min', (px) => `800 ${px}px ${ROUND}`, w * 0.6, h * 0.14);
  g.fillText('we deliver · 24/7 · 20 min', w * 0.63, h * 0.58);
  g.fillStyle = '#ffffff';
  fitFont(g, 'NOE VALLEY’S #1 POOP PATROL', (px) => `800 ${px}px ${WIDE}`, w * 0.9, h * 0.13);
  g.fillText('NOE VALLEY’S #1 POOP PATROL', w / 2, h * 0.86);
}

/** STROLLER PARKING: a blue panel, a big P and a stroller. */
function strollerParking(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = '#1f5fbf';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ffffff';
  g.lineWidth = w * 0.04;
  g.strokeRect(w * 0.05, w * 0.05, w - w * 0.1, h - w * 0.1);
  centre(g);
  g.fillStyle = '#ffffff';
  fitFont(g, 'P', (px) => `900 ${px}px ${SANS}`, w * 0.5, h * 0.36);
  g.fillText('P', w * 0.5, h * 0.25);
  strollerIcon(g, w * 0.46, h * 0.58, w * 0.42, '#ffffff');
  fitFont(g, 'STROLLER', (px) => `900 ${px}px ${WIDE}`, w * 0.8, h * 0.09);
  g.fillText('STROLLER', w / 2, h * 0.82);
  fitFont(g, 'PARKING', (px) => `900 ${px}px ${WIDE}`, w * 0.8, h * 0.09);
  g.fillText('PARKING', w / 2, h * 0.92);
}

// ---------------------------------------------------------------------------------------------
// The kids' window displays

function kidsWindow(kind: NoeWindow): Draw {
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
    switch (kind) {
      case 'toys': {
        grad('#fff6e0', '#f3dcae');
        rect('#c99a5c', 0.04, 0.42, 0.92, 0.015);
        rect('#c99a5c', 0.04, 0.64, 0.92, 0.015);
        // Blocks, a ball, a teddy, a rocking horse.
        for (let i = 0; i < 6; i++) rect(['#e2453c', '#2f80d6', '#f2c81e', '#4caf50', '#f29c1f', '#8a4fc2'][i], 0.1 + i * 0.13, 0.33, 0.1, 0.09);
        dot('#e2453c', 0.2, 0.58, 0.06);
        dot('#ffffff', 0.18, 0.56, 0.015);
        dot('#a8743f', 0.62, 0.55, 0.07);
        dot('#a8743f', 0.57, 0.47, 0.03);
        dot('#a8743f', 0.67, 0.47, 0.03);
        dot('#3a2a22', 0.6, 0.53, 0.008);
        dot('#3a2a22', 0.64, 0.53, 0.008);
        rect('#f2c81e', 0.3, 0.74, 0.4, 0.08);
        rect('#e2453c', 0.32, 0.82, 0.04, 0.12);
        rect('#e2453c', 0.64, 0.82, 0.04, 0.12);
        dot('#e2453c', 0.74, 0.72, 0.05);
        rect('#d9b07a', 0, 0.94, 1, 0.06);
        break;
      }
      case 'kids': {
        grad('#fdf3f6', '#f1dde6');
        rect('#8a7a6a', 0.06, 0.22, 0.88, 0.012);
        const cols = ['#f6c7d6', '#bde3f2', '#fff0b3', '#c9ecd2', '#e3d3f4', '#ffd8b5'];
        for (let i = 0; i < 6; i++) {
          const x = 0.09 + i * 0.145;
          // A onesie on its hanger.
          rect('#8a7a6a', x + 0.045, 0.2, 0.01, 0.04);
          rect(cols[i], x, 0.24, 0.1, 0.16);
          rect(cols[i], x - 0.025, 0.24, 0.15, 0.05);
        }
        // A crib, and a mobile over it.
        rect('#ffffff', 0.2, 0.6, 0.6, 0.03);
        for (let i = 0; i <= 10; i++) rect('#ffffff', 0.2 + i * 0.058, 0.6, 0.012, 0.22);
        rect('#ffffff', 0.2, 0.8, 0.6, 0.03);
        rect('#cbbba8', 0.5, 0.44, 0.004, 0.08);
        for (const [x, c] of [
          [0.42, '#f6c7d6'],
          [0.5, '#bde3f2'],
          [0.58, '#fff0b3'],
        ] as const) dot(c, x, 0.53, 0.025);
        rect('#d9c8b4', 0, 0.9, 1, 0.1);
        break;
      }
      case 'yoga': {
        grad('#f4eefa', '#e2d6ef');
        rect('#d9c8e8', 0, 0.78, 1, 0.22);
        // Mats, and mothers with babies in the air.
        for (let i = 0; i < 3; i++) {
          const x = 0.12 + i * 0.3;
          rect(['#9ad1c2', '#f2a7c1', '#b3c7f2'][i], x - 0.05, 0.76, 0.22, 0.03);
          dot('#5a4a6a', x + 0.06, 0.5, 0.04);
          rect('#5a4a6a', x + 0.035, 0.54, 0.05, 0.2);
          rect('#5a4a6a', x + 0.02, 0.42, 0.012, 0.1);
          rect('#5a4a6a', x + 0.09, 0.42, 0.012, 0.1);
          dot('#f6cfae', x + 0.06, 0.38, 0.03);
          rect('#f2a7c1', x + 0.04, 0.4, 0.04, 0.04);
        }
        g.fillStyle = '#7a4b8c';
        centre(g);
        fitFont(g, 'om · nom · om', (px) => `italic 700 ${px}px ${SERIF}`, w * 0.8, h * 0.08);
        g.fillText('om · nom · om', w / 2, h * 0.16);
        break;
      }
      case 'strollers': {
        grad('#eef5fb', '#d9e8f5');
        rect('#bfd3e6', 0, 0.84, 1, 0.16);
        const cols = ['#1f3f6b', '#7a8a96', '#4f6b3a', '#c45a3c', '#2b2b2b'];
        for (let i = 0; i < 3; i++) strollerIcon(g, w * (0.2 + i * 0.3), h * (0.45 + (i % 2) * 0.22), w * 0.2, cols[i]);
        g.fillStyle = '#e2453c';
        centre(g);
        fitFont(g, 'SALE', (px) => `900 ${px}px ${WIDE}`, w * 0.5, h * 0.08);
        g.fillText('SALE', w * 0.75, h * 0.15);
        break;
      }
      case 'clinic': {
        grad('#f2f8fb', '#dfeef5');
        rect('#bcd9e6', 0, 0.82, 1, 0.18);
        // A teddy-bear mural and a row of little chairs.
        dot('#c9965c', 0.5, 0.4, 0.13);
        dot('#c9965c', 0.4, 0.29, 0.05);
        dot('#c9965c', 0.6, 0.29, 0.05);
        dot('#f2e3cf', 0.5, 0.45, 0.06);
        dot('#3a2a22', 0.45, 0.38, 0.012);
        dot('#3a2a22', 0.55, 0.38, 0.012);
        for (let i = 0; i < 5; i++) rect(['#e2453c', '#2f80d6', '#f2c81e', '#4caf50', '#f29c1f'][i], 0.08 + i * 0.18, 0.7, 0.12, 0.08);
        break;
      }
      case 'diapers':
      default: {
        grad('#f3fafe', '#dcedf7');
        // Stacked packs of diapers to the ceiling.
        for (let r = 0; r < 6; r++) {
          for (let i = 0; i < 4; i++) {
            const c = ['#7cc6e8', '#f2a7c1', '#fff0b3', '#c9ecd2'][(i + r) % 4];
            rect(c, 0.06 + i * 0.225, 0.16 + r * 0.12, 0.2, 0.105);
            rect('rgba(255,255,255,0.6)', 0.08 + i * 0.225, 0.19 + r * 0.12, 0.16, 0.03);
          }
        }
        break;
      }
    }
    // The glass, as windowTile does.
    const sky = g.createLinearGradient(0, 0, 0, h * 0.45);
    sky.addColorStop(0, 'rgba(200,220,240,0.32)');
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

const WINDOWS: WindowKind[] = ['clothes', 'cafe', 'bakery', 'beds', 'shelves', 'icecream', 'dark', 'papered', 'bar', 'shoes'];

/** Paint every sign Noe Valley has into the atlas. */
export function paintNoeSigns(atlas: SignAtlas): void {
  const specs: Spec[] = [
    // --- Shop windows: the standard displays, and the kids' ones.
    ...WINDOWS.map((k) => ({ key: `w_${k}`, w: 128, h: 172, edge: '#2a2a2a', draw: windowTile(k) })),
    ...NOE_WINDOWS.map((k) => ({ key: `w_${k}`, w: 128, h: 172, edge: '#2a2a2a', draw: kidsWindow(k) })),
    // --- Fascias, west to east: Castro to Noe.
    L('station', 384, 80, { bg: '#1b3a73', fg: '#ffffff', lines: ['NOE VALLEY STATION', 'UNITED STATES POST OFFICE'], font: WIDE, weight: 700, sizes: [1.25, 0.75], tr: 0.06, fill: 0.66 }),
    L('bakery', 384, 80, { bg: '#f7efe2', fg: '#7a3b1e', lines: ['Noe Valley Bakery'], font: SCRIPT, fill: 0.78 }),
    L('tumblers', 320, 80, { bg: '#ffd84d', fg: '#e2453c', lines: ['TINY TUMBLERS', 'baby gym · ages 0–3'], font: ROUND, weight: 900, sizes: [1.3, 0.7], fill: 0.7 }),
    L('namaste', 320, 80, { bg: '#f6d6e3', fg: '#7a4b8c', lines: ['Namaste Mama', 'mommy & me yoga'], font: SCRIPT, sizes: [1.35, 0.65], fill: 0.8 }),
    L('sprouts', 320, 80, { bg: '#dff0d4', fg: '#3e7a3a', lines: ['little sprouts', 'children’s boutique'], font: ROUND, weight: 800, sizes: [1.3, 0.7], fill: 0.72 }),
    L('autoworks', 384, 64, { bg: '#2b2f36', fg: '#f2c230', lines: ['NOE VALLEY AUTO WORKS'], font: WIDE, weight: 800, tr: 0.06, fill: 0.5 }),
    L('spa', 320, 64, { bg: '#e8efe9', fg: '#4a6b5d', lines: ['Noe Valley Spa'], font: SERIF, weight: 400, tr: 0.04, fill: 0.6 }),
    L('bump', 320, 80, { bg: '#fbe3d4', fg: '#c45a3c', lines: ['THE BUMP', 'maternity & nursing'], font: GEO, weight: 700, sizes: [1.3, 0.7], tr: 0.08, fill: 0.7 }),
    // Noe to Sanchez.
    { key: 'starbucks', w: 384, h: 80, edge: '#1e3932', draw: starbucks(false) },
    { key: 'justForFun', w: 320, h: 96, edge: '#ffffff', draw: justForFun(false) },
    L('bernies', 256, 80, { bg: '#5b3a26', fg: '#f4e3c4', lines: ['BERNIE’S', 'coffee'], font: BOOK, sizes: [1.3, 0.7], tr: 0.08, fill: 0.7 }),
    L('wholeFoods', 448, 80, { bg: '#00674b', fg: '#ffffff', lines: ['WHOLE FOODS', 'MARKET'], font: SERIF, weight: 700, sizes: [1.3, 0.7], tr: 0.08, fill: 0.72 }),
    L('books', 384, 64, { bg: '#2f4f3a', fg: '#f1e6c8', lines: ['NOE VALLEY BOOKS'], font: BOOK, weight: 700, tr: 0.08, fill: 0.56 }),
    L('fresca', 256, 80, { bg: '#f2a541', fg: '#5a2d14', lines: ['fresca', 'peruvian cuisine'], font: SCRIPT, sizes: [1.4, 0.6], fill: 0.8 }),
    L('smiles', 384, 80, { bg: '#e9f6fb', fg: '#2b7fb8', lines: ['Noe Valley Smiles', 'kids’ dentistry & braces'], font: ROUND, weight: 800, sizes: [1.25, 0.75], fill: 0.72 }),
    L('strollerDepot', 384, 80, { bg: '#2563c9', fg: '#ffffff', lines: ['STROLLER DEPOT', '40 MODELS IN STOCK · TEST DRIVES DAILY'], font: WIDE, weight: 800, sizes: [1.35, 0.65], tr: 0.04, fill: 0.72 }),
    // Sanchez to Vicksburg, and the Town Square.
    L('haystack', 320, 64, { bg: '#c8382e', fg: '#fff2c8', lines: ['HAYSTACK PIZZA'], font: SANS, weight: 900, tr: 0.04, fill: 0.58 }),
    L('tinyToes', 256, 80, { bg: '#fff4c2', fg: '#d2583a', lines: ['tiny toes', 'kids’ shoes'], font: ROUND, weight: 900, sizes: [1.35, 0.65], fill: 0.74 }),
    L('martha', 320, 80, { bg: '#1d1d1d', fg: '#f2e6cf', lines: ['MARTHA & BROS.', 'COFFEE CO.'], font: SERIF, weight: 700, sizes: [1.2, 0.8], tr: 0.1, fill: 0.7 }),
    L('townSquare', 448, 80, { bg: '#355e3b', fg: '#f6efd8', lines: ['NOE VALLEY TOWN SQUARE'], font: SERIF, weight: 700, tr: 0.08, fill: 0.5, rule: '#f6efd8' }),
    L('farmers', 384, 64, { bg: '#f6efd8', fg: '#355e3b', lines: ['FARMERS MARKET · SATURDAYS'], font: WIDE, weight: 800, tr: 0.06, fill: 0.5 }),
    // Vicksburg to Church.
    L('diaperDash', 384, 80, { bg: '#7cc6e8', fg: '#ffffff', lines: ['DIAPER DASH', 'delivered in 20 min · 24/7'], font: ROUND, weight: 900, sizes: [1.35, 0.65], fill: 0.74 }),
    L('wine', 320, 80, { bg: '#5a1e2e', fg: '#f1d9a8', lines: ['NOE VALLEY', 'WINE & SPIRITS'], font: SERIF, weight: 700, sizes: [0.8, 1.2], tr: 0.08, fill: 0.72 }),
    L('lullaby', 320, 80, { bg: '#e8e2f6', fg: '#6a5a9e', lines: ['Lullaby Lane', 'cribs · gliders · nursery'], font: SCRIPT, sizes: [1.35, 0.65], fill: 0.8 }),
    L('saru', 256, 64, { bg: '#171717', fg: '#e8d6b0', lines: ['SARU', 'sushi bar'], font: WIDE, weight: 600, sizes: [1.3, 0.7], tr: 0.2, fill: 0.64 }),
    L('firstCuts', 320, 80, { bg: '#d64545', fg: '#ffffff', lines: ['FIRST CUTS', 'kids’ haircuts · lollipops'], font: ROUND, weight: 900, sizes: [1.3, 0.7], fill: 0.72 }),
    L('peekaboo', 320, 80, { bg: '#fbd3e0', fg: '#3d6fb4', lines: ['peek-a-boo', 'baby portraits'], font: HAND, sizes: [1.35, 0.65], fill: 0.8 }),
    // The upper block.
    L('pediatrics', 448, 72, { bg: '#ffffff', fg: '#2e7fb8', lines: ['NOE VALLEY PEDIATRICS'], font: ROUND, weight: 900, tr: 0.04, fill: 0.56 }),
    L('sickKids', 192, 56, { bg: '#f4c0c0', fg: '#8a1f1f', lines: ['SICK KIDS →'], font: ROUND, weight: 900, fill: 0.56 }),
    L('wellKids', 192, 56, { bg: '#c9ecd2', fg: '#1f6b3a', lines: ['← WELL KIDS'], font: ROUND, weight: 900, fill: 0.56 }),
    // --- Blade signs.
    L('b_bakery', 160, 96, { bg: '#7a3b1e', fg: '#f7efe2', lines: ['BAKERY'], font: SERIF, weight: 700, tr: 0.1, fill: 0.5, rule: '#f7efe2' }),
    { key: 'b_starbucks', w: 112, h: 112, edge: '#00704a', draw: starbucks(true) },
    L('b_books', 160, 96, { bg: '#2f4f3a', fg: '#f1e6c8', lines: ['BOOKS'], font: BOOK, weight: 700, tr: 0.12, fill: 0.5 }),
    L('b_wholeFoods', 160, 112, { bg: '#00674b', fg: '#ffffff', lines: ['WHOLE', 'FOODS'], font: SERIF, weight: 700, fill: 0.7 }),
    L('b_martha', 160, 96, { bg: '#1d1d1d', fg: '#f2e6cf', lines: ['COFFEE'], font: SERIF, weight: 700, tr: 0.12, fill: 0.5 }),
    { key: 'b_justForFun', w: 160, h: 96, edge: '#ffffff', draw: justForFun(true) },
    L('b_strollerDepot', 192, 96, { bg: '#2563c9', fg: '#ffffff', lines: ['STROLLERS'], font: WIDE, weight: 900, fill: 0.5 }),
    L('b_sprouts', 160, 96, { bg: '#dff0d4', fg: '#3e7a3a', lines: ['kids'], font: ROUND, weight: 900, fill: 0.62 }),
    L('b_haystack', 160, 96, { bg: '#c8382e', fg: '#fff2c8', lines: ['PIZZA'], font: SANS, weight: 900, fill: 0.56 }),
    L('b_wine', 160, 96, { bg: '#5a1e2e', fg: '#f1d9a8', lines: ['WINE'], font: SERIF, weight: 700, tr: 0.14, fill: 0.56 }),
    L('b_pediatrics', 192, 96, { bg: '#ffffff', fg: '#2e7fb8', lines: ['KIDS’', 'DOCTOR'], font: ROUND, weight: 900, fill: 0.72 }),
    L('b_tumblers', 160, 96, { bg: '#ffd84d', fg: '#e2453c', lines: ['BABY', 'GYM'], font: ROUND, weight: 900, fill: 0.74 }),
    // --- Race day and the street.
    { key: 'itsABoy', w: 512, h: 112, edge: '#a9d6f2', draw: shower('IT’S A BOY!', '#a9d6f2', '#2b7fb8', '#ffffff') },
    { key: 'itsAGirl', w: 512, h: 112, edge: '#f6bfd2', draw: shower('IT’S A GIRL!', '#f6bfd2', '#c2457a', '#ffffff') },
    { key: 'pbNoe', w: 96, h: 288, edge: '#3e8f6a', draw: poleBanner('NOE VALLEY', '#3e8f6a', '#fdf6e3', 'heart') },
    { key: 'pbStroller', w: 96, h: 288, edge: '#f2a7c1', draw: poleBanner('STROLLER VALLEY', '#f2a7c1', '#ffffff', 'stroller') },
    { key: 'kidsAtPlay', w: 224, h: 224, edge: '#f7c81e', draw: diamond(['SLOW', 'CHILDREN AT PLAY'], 'kids') },
    { key: 'babyOnBoard', w: 224, h: 224, edge: '#f7c81e', draw: diamond(['BABY', 'ON BOARD'], 'baby') },
    { key: 'strollerParking', w: 192, h: 256, edge: '#1f5fbf', draw: strollerParking },
    { key: 'vanSide', w: 448, h: 144, edge: '#f8fbfd', draw: vanSide },
    L('jStop', 96, 96, { bg: '#c6672a', fg: '#ffffff', lines: ['J'], font: SANS, weight: 900, fill: 0.72, rule: '#ffffff' }),
    L('priceTag', 96, 64, { bg: '#fff7d6', fg: '#c62828', lines: ['$1,299'], font: ROUND, weight: 900, fill: 0.6, rule: '#c62828' }),
  ];
  // (Drawn at 0.82 of the sizes above, as Hayes Valley's are: still sharper than the screen shows them.)
  for (const s of specs) {
    if (s.key.startsWith('w_')) continue;
    s.w = Math.round(s.w * 0.82);
    s.h = Math.round(s.h * 0.82);
  }
  specs.sort((a, b) => b.h - a.h);
  for (const s of specs) atlas.add(s.key, s.w, s.h, s.edge, s.draw);
}

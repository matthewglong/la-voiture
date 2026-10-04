// What's painted in the Castro: the shops' and bars' signs along Castro St and Market St as they hang
// (Twin Peaks Tavern, Hot Cookie, Castro Coffee, the Castro Theatre's blade and marquee, QBar's
// pink neon, Cliff's Variety, Walgreens, Harvey's, Castro Camera with Harvey Milk's mural, Welcome
// Castro, Castro Tarts; on Market, Café Flore, the Lookout, Twin Peaks Hotel, Peet's, Super Duper),
// the bars round the corner on 18th (Moby Dick, Toad Hall, Badlands), Harvey Milk Plaza's sign and
// the Castro station's. Each is a cell of one atlas (osg/haight/atlas.ts).
import type { Cell, Draw } from '../../osg/haight/atlas';
import { FUNKY, HEAVY, ROUND, SANS, SCRIPT, SERIF, board, heart, rainbow, text } from '../../osg/haight/atlas';

/** A standard fascia is 496 × 96; a tall one 496 × 128. */
const FW = 496;

/** The six stripes of Gilbert Baker's flag, top to bottom. */
export const PRIDE = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'];

const cell = (name: string, w: number, h: number, draw: Draw): Cell => ({ name, w, h, draw });

/** Neon lettering: a soft glow round bright tubes. */
function neon(g: CanvasRenderingContext2D, s: string, cx: number, cy: number, maxW: number, maxH: number, color: string, family = ROUND): void {
  g.save();
  g.shadowColor = color;
  g.shadowBlur = maxH * 0.35;
  text(g, s, cx, cy, maxW, maxH, { family, weight: '900', fill: color });
  g.shadowBlur = maxH * 0.12;
  text(g, s, cx, cy, maxW, maxH, { family, weight: '900', fill: '#fff7fb' });
  g.restore();
}

/** Rainbow stripes across a rectangle (horizontal bands). */
function stripes(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cols = PRIDE): void {
  cols.forEach((c, i) => {
    g.fillStyle = c;
    g.fillRect(x, y + (h * i) / cols.length, w, h / cols.length + 1);
  });
}

/** The atlas's cells. */
export function castroCells(): Cell[] {
  return [
    cell('white', 16, 16, (g, w, h) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
    }),

    // --- Castro St, the 400 block ---------------------------------------------------------------
    cell('twinPeaks', FW, 128, (g, w, h) => {
      board(g, w, h, '#14301f', '#d9c27a', 5, 7);
      text(g, 'Twin Peaks', w / 2, h * 0.52, w * 0.86, h * 0.7, { family: SCRIPT, weight: '700', fill: '#f2e3a0', shadow: '#0a1a10' });
    }),
    cell('hotCookie', FW, 96, (g, w, h) => {
      board(g, w, h, '#f7d9e6');
      text(g, 'HOT COOKIE', w / 2, h / 2, w * 0.86, h * 0.68, { family: FUNKY, weight: '900', fill: '#8a3a1f', stroke: '#fff3c4', strokeW: 6 });
    }),
    cell('smokeHouse', FW, 96, (g, w, h) => {
      board(g, w, h, '#1d1b1a', '#c9a54a', 3, 6);
      text(g, 'CASTRO SMOKE HOUSE', w / 2, h / 2, w * 0.88, h * 0.5, { family: SERIF, weight: '700', fill: '#e9d69c', track: 3 });
    }),
    cell('castroCoffee', FW, 96, (g, w, h) => {
      board(g, w, h, '#3a2216', '#e9d8b4', 3, 6);
      text(g, 'CASTRO COFFEE CO.', w / 2, h / 2, w * 0.86, h * 0.5, { family: SERIF, weight: '700', fill: '#f4e7c8', track: 2 });
    }),
    cell('nails', FW, 96, (g, w, h) => {
      board(g, w, h, '#fbe3ef');
      text(g, 'CASTRO NAILS', w / 2, h / 2, w * 0.8, h * 0.56, { family: ROUND, weight: '800', fill: '#d6337a' });
    }),
    cell('cliffs', FW, 128, (g, w, h) => {
      board(g, w, h, '#f3c12b', '#1b3f8f', 6, 7);
      text(g, "CLIFF'S", w / 2, h * 0.36, w * 0.7, h * 0.44, { family: HEAVY, weight: '900', fill: '#1b3f8f' });
      text(g, 'VARIETY', w / 2, h * 0.74, w * 0.6, h * 0.28, { family: SANS, weight: '800', fill: '#1b3f8f', track: 8 });
    }),
    cell('marcellos', FW, 96, (g, w, h) => {
      board(g, w, h, '#1f6b3a');
      g.fillStyle = '#c62828';
      g.fillRect(0, h * 0.78, w, h * 0.22);
      text(g, "MARCELLO'S PIZZA", w / 2, h * 0.42, w * 0.86, h * 0.48, { family: SERIF, weight: '700', fill: '#fff7e6' });
    }),
    cell('qbar', FW, 96, (g, w, h) => {
      board(g, w, h, '#16081a');
      neon(g, 'Q BAR', w / 2, h / 2, w * 0.6, h * 0.66, '#ff4fb4');
    }),
    cell('walgreens', FW, 96, (g, w, h) => {
      board(g, w, h, '#ffffff');
      text(g, 'Walgreens', w / 2, h * 0.54, w * 0.82, h * 0.74, { family: SCRIPT, weight: '700', fill: '#e31837' });
    }),
    cell('rainbowCorner', FW, 96, (g, w, h) => {
      stripes(g, 0, 0, w, h);
      text(g, 'PROUD', w / 2, h / 2, w * 0.6, h * 0.6, { family: HEAVY, weight: '900', fill: '#ffffff', stroke: '#1b1b1f', strokeW: 6 });
    }),

    // --- Castro St, the 500 block ---------------------------------------------------------------
    cell('harveys', FW, 96, (g, w, h) => {
      board(g, w, h, '#101318', '#e9c46a', 3, 6);
      text(g, "HARVEY'S", w / 2, h / 2, w * 0.66, h * 0.6, { family: SERIF, weight: '800', fill: '#e9c46a', track: 4 });
    }),
    cell('castroCamera', FW, 96, (g, w, h) => {
      board(g, w, h, '#f4efe2', '#1b1b1f', 4, 6);
      text(g, 'CASTRO CAMERA', w / 2, h / 2, w * 0.86, h * 0.52, { family: SANS, weight: '900', fill: '#1b1b1f', track: 4 });
    }),
    cell('milkMural', 512, 384, (g, w, h) => drawMilkMural(g, w, h)),
    cell('welcome', FW, 96, (g, w, h) => {
      stripes(g, 0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.86)';
      g.fillRect(w * 0.06, h * 0.18, w * 0.88, h * 0.64);
      text(g, 'WELCOME CASTRO', w / 2, h / 2, w * 0.82, h * 0.48, { family: ROUND, weight: '900', fill: '#5b2a8c' });
    }),
    cell('tarts', FW, 96, (g, w, h) => {
      board(g, w, h, '#f6d6c8');
      text(g, 'Castro Tarts', w / 2, h * 0.54, w * 0.84, h * 0.66, { family: SCRIPT, weight: '700', fill: '#7a2a3a' });
    }),
    cell('fountain', FW, 96, (g, w, h) => {
      board(g, w, h, '#e9f3f7', '#2f6f8f', 4, 6);
      text(g, 'CASTRO FOUNTAIN', w / 2, h / 2, w * 0.84, h * 0.5, { family: SERIF, weight: '700', fill: '#2f6f8f' });
    }),
    cell('kiehls', FW, 96, (g, w, h) => {
      board(g, w, h, '#1b1b1f');
      text(g, "KIEHL'S", w / 2, h / 2, w * 0.5, h * 0.56, { family: SERIF, weight: '700', fill: '#f4efe2', track: 6 });
    }),
    cell('rainbowGifts', FW, 96, (g, w, h) => {
      board(g, w, h, '#ffffff');
      rainbow(g, w / 2, h * 1.15, h * 1.0, h * 0.11);
      text(g, 'RAINBOW GIFTS', w / 2, h * 0.62, w * 0.8, h * 0.44, { family: ROUND, weight: '900', fill: '#3a2a6a' });
    }),

    // --- The Castro Theatre ---------------------------------------------------------------------
    cell('castroBlade', 128, 640, (g, w, h) => {
      board(g, w, h, '#7a1222', '#f2c14e', 6, 6);
      g.save();
      g.shadowColor = '#ffe37a';
      g.shadowBlur = 18;
      [...'CASTRO'].forEach((ch, i) => {
        text(g, ch, w / 2, h * (0.1 + (i * 0.8) / 5), w * 0.82, h * 0.15, { family: HEAVY, weight: '900', fill: '#fff4c2' });
      });
      g.restore();
    }),
    cell('marquee', 1024, 192, (g, w, h) => {
      board(g, w, h, '#fbf4dc', '#7a1222', 10, 8);
      // Bulbs round the board.
      g.fillStyle = '#ffd34a';
      for (let x = 24; x < w - 12; x += 28) {
        for (const y of [10, h - 10]) {
          g.beginPath();
          g.arc(x, y, 5, 0, Math.PI * 2);
          g.fill();
        }
      }
      text(g, 'LA VOITURE GRAND PRIX', w / 2, h * 0.38, w * 0.86, h * 0.3, { family: HEAVY, weight: '900', fill: '#1b1b1f' });
      text(g, 'TODAY ONLY · 3 LAPS · ALL WELCOME', w / 2, h * 0.7, w * 0.8, h * 0.2, { family: SANS, weight: '800', fill: '#7a1222', track: 3 });
    }),
    cell('marqueeEnd', 384, 192, (g, w, h) => {
      board(g, w, h, '#fbf4dc', '#7a1222', 10, 8);
      text(g, 'PRIDE', w / 2, h * 0.36, w * 0.74, h * 0.3, { family: HEAVY, weight: '900', fill: '#d6337a' });
      text(g, 'NIGHTLY', w / 2, h * 0.7, w * 0.6, h * 0.22, { family: SANS, weight: '800', fill: '#1b1b1f', track: 4 });
    }),
    cell('theatreCrest', 256, 256, (g, w, h) => {
      g.fillStyle = '#e8dcc2';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#a8844a';
      g.lineWidth = 10;
      g.beginPath();
      g.arc(w / 2, h / 2, w * 0.38, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#c9a24a';
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        g.beginPath();
        g.ellipse(w / 2 + Math.cos(a) * w * 0.24, h / 2 + Math.sin(a) * h * 0.24, w * 0.07, w * 0.035, a, 0, Math.PI * 2);
        g.fill();
      }
      text(g, 'C', w / 2, h / 2, w * 0.3, h * 0.3, { family: SERIF, weight: '700', fill: '#7a1222' });
    }),

    // --- Harvey Milk Plaza, the station ---------------------------------------------------------
    cell('milkPlaza', FW, 96, (g, w, h) => {
      board(g, w, h, '#2e3a2f', '#d8c79a', 3, 6);
      text(g, 'HARVEY MILK PLAZA', w / 2, h / 2, w * 0.86, h * 0.5, { family: SERIF, weight: '700', fill: '#efe3bf', track: 4 });
    }),
    cell('muni', 256, 128, (g, w, h) => {
      board(g, w, h, '#ffffff');
      // The worm.
      g.strokeStyle = '#c8102e';
      g.lineWidth = h * 0.13;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(w * 0.12, h * 0.72);
      g.lineTo(w * 0.12, h * 0.32);
      g.quadraticCurveTo(w * 0.12, h * 0.18, w * 0.26, h * 0.28);
      g.lineTo(w * 0.42, h * 0.62);
      g.lineTo(w * 0.58, h * 0.28);
      g.quadraticCurveTo(w * 0.72, h * 0.18, w * 0.72, h * 0.32);
      g.lineTo(w * 0.72, h * 0.72);
      g.stroke();
      text(g, 'CASTRO', w * 0.5, h * 0.88, w * 0.8, h * 0.18, { family: SANS, weight: '900', fill: '#1b1b1f', track: 3 });
    }),
    cell('honorPlaque', 128, 128, (g, w, h) => {
      g.fillStyle = '#9a6a2e';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d9b06a';
      g.lineWidth = 6;
      g.strokeRect(8, 8, w - 16, h - 16);
      stripes(g, w * 0.25, h * 0.2, w * 0.5, h * 0.22);
      g.fillStyle = '#5a3a14';
      for (let k = 0; k < 3; k++) g.fillRect(w * 0.2, h * (0.55 + k * 0.1), w * 0.6, h * 0.04);
    }),
    cell('castroHill', FW, 128, (g, w, h) => {
      stripes(g, 0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fillRect(w * 0.05, h * 0.14, w * 0.9, h * 0.72);
      text(g, 'CASTRO HILL', w / 2, h * 0.5, w * 0.78, h * 0.5, { family: HEAVY, weight: '900', fill: '#1b1b1f' });
      heart(g, w * 0.1, h * 0.32, h * 0.38, '#e40303');
      heart(g, w * 0.9, h * 0.32, h * 0.38, '#750787');
    }),
    cell('theCastro', FW, 128, (g, w, h) => {
      stripes(g, 0, 0, w, h);
      g.fillStyle = 'rgba(20,10,30,0.82)';
      g.fillRect(w * 0.04, h * 0.16, w * 0.92, h * 0.68);
      neon(g, 'THE CASTRO', w / 2, h / 2, w * 0.8, h * 0.52, '#ff7ad9');
    }),

    // --- Round the corner on 18th ---------------------------------------------------------------
    cell('mobyDick', FW, 96, (g, w, h) => {
      board(g, w, h, '#0f2f4f', '#f4f1e8', 3, 6);
      text(g, 'MOBY DICK', w / 2, h / 2, w * 0.7, h * 0.56, { family: SERIF, weight: '800', fill: '#f4f1e8', track: 3 });
    }),
    cell('toadHall', FW, 96, (g, w, h) => {
      board(g, w, h, '#1f4a2a');
      text(g, 'TOAD HALL', w / 2, h / 2, w * 0.7, h * 0.56, { family: FUNKY, weight: '900', fill: '#c7f46a' });
    }),
    cell('badlands', FW, 96, (g, w, h) => {
      board(g, w, h, '#120d0d');
      neon(g, 'BADLANDS', w / 2, h / 2, w * 0.8, h * 0.6, '#ff3b2f', HEAVY);
    }),

    // --- Market St ------------------------------------------------------------------------------
    cell('cafeFlore', FW, 96, (g, w, h) => {
      board(g, w, h, '#f6f1e2', '#2f6b4f', 3, 6);
      text(g, 'CAFÉ FLORE', w / 2, h / 2, w * 0.76, h * 0.56, { family: SERIF, weight: '700', fill: '#2f6b4f', track: 4 });
    }),
    cell('lookout', FW, 96, (g, w, h) => {
      board(g, w, h, '#151a24');
      neon(g, 'LOOKOUT', w / 2, h / 2, w * 0.76, h * 0.6, '#3fd2ff', HEAVY);
    }),
    cell('twinPeaksHotel', FW, 96, (g, w, h) => {
      board(g, w, h, '#f1ead6', '#5a3a2a', 3, 6);
      text(g, 'TWIN PEAKS HOTEL', w / 2, h / 2, w * 0.86, h * 0.5, { family: SERIF, weight: '700', fill: '#5a3a2a', track: 2 });
    }),
    cell('peets', FW, 96, (g, w, h) => {
      board(g, w, h, '#2b1a12');
      text(g, "Peet's Coffee", w / 2, h * 0.54, w * 0.8, h * 0.62, { family: SERIF, weight: '700', italic: true, fill: '#f4e9d6' });
    }),
    cell('superDuper', FW, 96, (g, w, h) => {
      board(g, w, h, '#e8322a');
      text(g, 'SUPER DUPER', w / 2, h / 2, w * 0.8, h * 0.58, { family: HEAVY, weight: '900', fill: '#ffffff' });
    }),
    cell('hiTops', FW, 96, (g, w, h) => {
      board(g, w, h, '#1b1b1f', '#ffffff', 3, 6);
      text(g, 'HI TOPS', w / 2, h / 2, w * 0.6, h * 0.58, { family: HEAVY, weight: '900', fill: '#ffffff', italic: true });
    }),
    cell('walgreensRed', FW, 96, (g, w, h) => {
      board(g, w, h, '#e31837');
      text(g, 'Walgreens', w / 2, h * 0.54, w * 0.82, h * 0.74, { family: SCRIPT, weight: '700', fill: '#ffffff' });
    }),
    cell('swedishHall', FW, 96, (g, w, h) => {
      board(g, w, h, '#2a4a7a', '#f2c94c', 3, 6);
      text(g, 'SWEDISH AMERICAN HALL', w / 2, h / 2, w * 0.88, h * 0.44, { family: SERIF, weight: '700', fill: '#f2c94c', track: 2 });
    }),
    cell('pinkTriangle', FW, 96, (g, w, h) => {
      board(g, w, h, '#2b2b2f', '#f2a6c8', 3, 6);
      text(g, 'PINK TRIANGLE PARK', w / 2, h / 2, w * 0.86, h * 0.5, { family: SANS, weight: '800', fill: '#f2a6c8', track: 3 });
    }),
    cell('balloonSign', FW, 128, (g, w, h) => {
      board(g, w, h, '#ffffff', '#ff4fb4', 8, 6);
      text(g, 'LOVE WINS', w / 2, h / 2, w * 0.76, h * 0.56, { family: HEAVY, weight: '900', fill: '#5b2a8c' });
      heart(g, w * 0.1, h * 0.3, h * 0.4, '#e40303');
      heart(g, w * 0.9, h * 0.3, h * 0.4, '#004dff');
    }),
  ];
}

/** Harvey Milk's mural over his old camera shop: his face in profile over the rainbow, and his words. */
function drawMilkMural(g: CanvasRenderingContext2D, w: number, h: number): void {
  // Sky to rainbow.
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#f7e7c4');
  sky.addColorStop(1, '#f2cfa0');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  rainbow(g, w * 0.5, h * 1.05, w * 0.62, w * 0.06);
  // The portrait: a warm face, dark hair, the smile.
  const cx = w * 0.36;
  const cy = h * 0.45;
  g.fillStyle = '#3a2a1f';
  g.beginPath();
  g.ellipse(cx, cy - h * 0.1, w * 0.13, h * 0.17, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e8b896';
  g.beginPath();
  g.ellipse(cx + w * 0.01, cy, w * 0.115, h * 0.2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3a2a1f';
  g.beginPath();
  g.ellipse(cx - w * 0.035, cy - h * 0.03, w * 0.014, h * 0.012, 0, 0, Math.PI * 2);
  g.ellipse(cx + w * 0.05, cy - h * 0.03, w * 0.014, h * 0.012, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#8a3a2a';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(cx + w * 0.01, cy + h * 0.06, w * 0.045, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
  // His suit and tie.
  g.fillStyle = '#2a2f3a';
  g.beginPath();
  g.moveTo(cx - w * 0.17, h);
  g.lineTo(cx - w * 0.13, cy + h * 0.2);
  g.lineTo(cx + w * 0.15, cy + h * 0.2);
  g.lineTo(cx + w * 0.19, h);
  g.fill();
  g.fillStyle = '#c62828';
  g.fillRect(cx - w * 0.012, cy + h * 0.2, w * 0.028, h * 0.3);
  text(g, 'HARVEY MILK', w * 0.74, h * 0.2, w * 0.44, h * 0.13, { family: HEAVY, weight: '900', fill: '#2a1f3a' });
  text(g, "YOU GOTTA", w * 0.74, h * 0.42, w * 0.42, h * 0.1, { family: SERIF, weight: '700', fill: '#5b2a8c' });
  text(g, "GIVE 'EM HOPE", w * 0.74, h * 0.55, w * 0.42, h * 0.1, { family: SERIF, weight: '700', fill: '#5b2a8c' });
}

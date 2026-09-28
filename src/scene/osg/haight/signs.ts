// What's painted on the Haight: every shop's sign as it hangs today (shops.json, Street View 2025),
// the murals that wrap Love on Haight, Psychedelic SF and GoodFellas, the colour-block shutter by
// Cookies, the skeletal creature on Aviator Nation's side wall, the Haight & Ashbury street blades
// (white, as they still are there), the clock stuck at 4:20 and the fishnet on Piedmont's legs.
// Each is a cell of the one atlas (atlas.ts).
import type { Cell, Draw } from './atlas';
import { FUNKY, GOTHIC, HEAVY, ROUND, SANS, SCRIPT, SERIF, SLAB, board, eye, flower, heart, mushroom, peace, rainbow, sunburst, text, tieDye, trippy } from './atlas';

/** A standard fascia is 496 × 96 (four to a row of the atlas); a tall one 496 × 128. */
const FW = 496;

const cell = (name: string, w: number, h: number, draw: Draw): Cell => ({ name, w, h, draw });

/** The atlas's cells. */
export function haightCells(): Cell[] {
  return [
    cell('white', 16, 16, (g, w, h) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
    }),

    // --- Haight & Ashbury: the street blades, the speed limit, the clock --------------------------------
    cell('bladeHaight', FW, 96, (g, w, h) => blade(g, w, h, 'Haight', '1500')),
    cell('bladeAshbury', FW, 96, (g, w, h) => blade(g, w, h, 'Ashbury', '600')),
    cell('speed20', 96, 128, (g, w, h) => {
      board(g, w, h, '#fbfbf7', '#1b1b1f', 5, 5);
      text(g, 'SPEED', w / 2, h * 0.2, w * 0.8, h * 0.17, { family: SANS, weight: '800', fill: '#1b1b1f' });
      text(g, 'LIMIT', w / 2, h * 0.38, w * 0.8, h * 0.17, { family: SANS, weight: '800', fill: '#1b1b1f' });
      text(g, '20', w / 2, h * 0.7, w * 0.8, h * 0.42, { family: SANS, weight: '900', fill: '#1b1b1f' });
    }),
    cell('clock', 256, 256, (g, w) => {
      const c = w / 2;
      g.fillStyle = '#1b1b1f';
      g.beginPath();
      g.arc(c, c, c, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#c9a54a';
      g.beginPath();
      g.arc(c, c, c * 0.93, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fbf8ef';
      g.beginPath();
      g.arc(c, c, c * 0.86, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#1b1b1f';
      for (let k = 0; k < 60; k++) {
        const a = (k / 60) * Math.PI * 2;
        const r0 = k % 5 ? c * 0.8 : c * 0.72;
        g.lineWidth = k % 5 ? 2 : 6;
        g.beginPath();
        g.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0);
        g.lineTo(c + Math.sin(a) * c * 0.84, c - Math.cos(a) * c * 0.84);
        g.stroke();
      }
      g.fillStyle = '#1b1b1f';
      g.font = `700 ${Math.round(c * 0.22)}px ${SERIF}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      ['XII', 'III', 'VI', 'IX'].forEach((n, k) => {
        const a = (k / 4) * Math.PI * 2;
        g.fillText(n, c + Math.sin(a) * c * 0.56, c - Math.cos(a) * c * 0.56);
      });
      g.font = `600 ${Math.round(c * 0.085)}px ${SERIF}`;
      g.fillText('HAIGHT · ASHBURY', c, c * 1.36);
      // Twenty past four, for ever.
      const hand = (a: number, len: number, lw: number): void => {
        g.lineWidth = lw;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(c - Math.sin(a) * len * 0.18, c + Math.cos(a) * len * 0.18);
        g.lineTo(c + Math.sin(a) * len, c - Math.cos(a) * len);
        g.stroke();
      };
      g.strokeStyle = '#1b1b1f';
      hand(((4 + 20 / 60) / 12) * Math.PI * 2, c * 0.46, 11);
      hand((20 / 60) * Math.PI * 2, c * 0.7, 7);
      g.fillStyle = '#c9a54a';
      g.beginPath();
      g.arc(c, c, 9, 0, Math.PI * 2);
      g.fill();
    }),
    cell('fishnet', 256, 256, (g, w, h) => {
      g.fillStyle = '#f0c3a0';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#1d1a1c';
      g.lineWidth = 2.6;
      const step = 16;
      for (let k = -h; k < w + h; k += step) {
        g.beginPath();
        g.moveTo(k, 0);
        g.lineTo(k + h, h);
        g.moveTo(k, 0);
        g.lineTo(k - h, h);
        g.stroke();
      }
      // The seam up the back.
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(w / 2, 0);
      g.lineTo(w / 2, h);
      g.stroke();
    }),

    // --- 1400 Haight, north side (Masonic to Ashbury) ----------------------------------------------------
    cell('loveMural', 760, 288, drawLoveMural),
    cell('loveSign', 256, 128, (g, w, h) => {
      board(g, w, h, '#fff7fb', '#e8327c', 7, 6);
      for (let k = 0; k < 8; k++) heart(g, 18 + k * 31, 12, 14, ['#e8322a', '#f7862a', '#f9d423', '#4cb944', '#2f8fd8', '#6a4bc4'][k % 6]);
      trippy(g, 'Love on', w / 2, h * 0.47, w * 0.8, h * 0.36, { family: SCRIPT, weight: '700', fill: '#c2185b', colors: ['#e8322a', '#f7862a', '#e0a800', '#2e9e44', '#2f8fd8', '#7a4bc4'], wave: 0.1, swell: 0.1 });
      trippy(g, 'HAIGHT', w / 2, h * 0.76, w * 0.84, h * 0.3, { family: FUNKY, weight: '900', fill: '#6a1b9a', stroke: '#ffffff', strokeW: 5, wave: 0.14 });
    }),
    cell('tieDye', 128, 128, (g, w, h) => tieDye(g, w, h, ['#e8322a', '#f7862a', '#f9d423', '#4cb944', '#2f8fd8', '#8e44d8'])),
    cell('peaceFlag', 128, 128, (g, w, h) => {
      tieDye(g, w, h, ['#ff4f9a', '#ffd23f', '#29c5f6', '#7ad151']);
      peace(g, w / 2, h / 2, w * 0.33, '#ffffff', w * 0.07);
    }),
    cell('worldFamous', FW, 128, (g, w, h) => {
      board(g, w, h, '#18171a');
      g.strokeStyle = '#3a3a40';
      g.lineWidth = 3;
      for (let k = 0; k < 7; k++) {
        g.beginPath();
        g.arc(60 + k * 64, h * 0.95, 40 + (k % 3) * 8, Math.PI, 2 * Math.PI);
        g.stroke();
      }
      arch(g, w, h, '#c9a54a', 6);
      text(g, 'World Famous', w / 2, h * 0.48, w * 0.8, h * 0.52, { family: SCRIPT, weight: '700', fill: '#e5c46a', stroke: '#4a3a14', strokeW: 4 });
      text(g, 'TATTOO · PIERCING', w / 2, h * 0.84, w * 0.5, h * 0.16, { family: SANS, weight: '800', fill: '#ff5fb8', shadow: '#ff5fb8' });
    }),
    cell('amals', FW, 128, (g, w, h) => {
      board(g, w, h, '#2f7fd0');
      arch(g, w, h, '#f4f1e6', 8);
      const cedar = (x: number): void => {
        g.fillStyle = '#1f8a3a';
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.moveTo(x, 18 + k * 16);
          g.lineTo(x - 22 + k * 3, 44 + k * 18);
          g.lineTo(x + 22 - k * 3, 44 + k * 18);
          g.fill();
        }
        g.fillStyle = '#7a4a2a';
        g.fillRect(x - 3, 90, 6, 14);
      };
      cedar(56);
      cedar(w - 56);
      text(g, "AMAL'S Deli", w / 2, h * 0.42, w * 0.62, h * 0.42, { family: SERIF, weight: '800', fill: '#ffffff', stroke: '#16406e', strokeW: 6 });
      text(g, 'GROCERY · BEER · WINE · SANDWICHES', w / 2, h * 0.8, w * 0.66, h * 0.14, { family: SANS, weight: '800', fill: '#fff2a8' });
    }),
    cell('hippieThai', FW, 128, (g, w, h) => {
      board(g, w, h, '#1e5fb8');
      arch(g, w, h, '#f7a8d8', 8);
      flower(g, 40, h * 0.55, 22, '#ff7fbf');
      flower(g, w - 40, h * 0.55, 22, '#ffd23f', '#ff5f2a');
      trippy(g, 'Hippie Thai', w / 2, h * 0.55, w * 0.74, h * 0.66, { family: FUNKY, weight: '900', fill: '#fff5c2', stroke: '#16305e', strokeW: 8, colors: ['#fff5c2', '#ffd23f', '#ff9ad5'], wave: 0.16, swell: 0.22 });
    }),
    cell('tukTuk', 128, 128, (g, w, h) => {
      g.fillStyle = '#fbf6e8';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#1e5fb8';
      g.lineWidth = 8;
      g.strokeRect(4, 4, w - 8, h - 8);
      // The tuk-tuk: a canopy, a body, three wheels.
      g.fillStyle = '#e8322a';
      g.fillRect(28, 36, 72, 12);
      g.fillStyle = '#ffd23f';
      g.fillRect(34, 48, 60, 30);
      g.fillStyle = '#1e5fb8';
      g.fillRect(40, 52, 22, 14);
      g.fillStyle = '#1b1b1f';
      for (const x of [42, 88]) {
        g.beginPath();
        g.arc(x, 82, 9, 0, Math.PI * 2);
        g.fill();
      }
      text(g, 'Hippie Thai', w / 2, h * 0.84, w * 0.8, h * 0.17, { family: FUNKY, weight: '900', fill: '#1e5fb8' });
      text(g, 'STREET FOOD', w / 2, h * 0.16, w * 0.7, h * 0.12, { family: SANS, weight: '800', fill: '#e8322a' });
    }),
    cell('cafe1428', FW, 96, (g, w, h) => {
      board(g, w, h, '#f7a51c', '#ffffff', 5, 6);
      text(g, '1428 HAIGHT', w / 2, h * 0.42, w * 0.8, h * 0.5, { family: SLAB, weight: '800', fill: '#2a1c12' });
      text(g, 'PATIO CAFE · CRÊPERIE', w / 2, h * 0.78, w * 0.6, h * 0.18, { family: SANS, weight: '800', fill: '#fff8e8' });
    }),
    cell('blueFront', FW, 128, (g, w, h) => {
      g.fillStyle = '#1f47b8';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#fbfbf7';
      g.fillRect(0, 0, w, h * 0.5);
      // The row of Moorish arches.
      g.fillStyle = '#fbfbf7';
      const n = 9;
      const aw = w / n;
      for (let k = 0; k < n; k++) {
        const x = k * aw + aw * 0.18;
        const ww = aw * 0.64;
        const y0 = h * 0.5;
        g.beginPath();
        g.moveTo(x, h * 0.95);
        g.lineTo(x, y0 + h * 0.2);
        g.quadraticCurveTo(x, y0 + h * 0.05, x + ww / 2, y0 - h * 0.06);
        g.quadraticCurveTo(x + ww, y0 + h * 0.05, x + ww, y0 + h * 0.2);
        g.lineTo(x + ww, h * 0.95);
        g.fill();
      }
      text(g, 'BLUE FRONT CAFE', w / 2, h * 0.27, w * 0.9, h * 0.4, { family: SERIF, weight: '800', fill: '#1f47b8', track: 3 });
    }),
    cell('goodfellas', FW, 128, (g, w, h) => {
      board(g, w, h, '#15141a');
      rainbow(g, w * 0.62, h * 1.25, h * 1.05, 11, Math.PI * 1.02, Math.PI * 1.98);
      sunburst(g, w * 0.86, h * 0.45, 30, ['#ffd23f', '#ff7f2a']);
      mushroom(g, w * 0.55, h * 0.95, 46, '#e8322a');
      mushroom(g, w * 0.66, h * 0.98, 32, '#8e44d8');
      // A VW bus, side on: two-tone, split windscreen, round wheels.
      const bx = w * 0.72;
      const by = h * 0.52;
      g.fillStyle = '#29b6f6';
      roundRect(g, bx, by, 96, 40, 12);
      g.fillStyle = '#fbfbf7';
      roundRect(g, bx, by, 96, 20, 12);
      g.fillStyle = '#1b3550';
      for (let k = 0; k < 3; k++) g.fillRect(bx + 10 + k * 26, by + 5, 20, 11);
      g.fillStyle = '#1b1b1f';
      for (const x of [bx + 20, bx + 76]) {
        g.beginPath();
        g.arc(x, by + 40, 9, 0, Math.PI * 2);
        g.fill();
      }
      peace(g, bx + 48, by + 29, 7, '#fbfbf7', 2.5);
      flower(g, w * 0.97, h * 0.2, 14, '#ff5fb8');
      trippy(g, 'Goodfellas', w * 0.28, h * 0.5, w * 0.54, h * 0.9, { family: FUNKY, weight: '900', fill: '#e8322a', stroke: '#ffd23f', strokeW: 9, wave: 0.14, swell: 0.2 });
    }),
    cell('piedmont', FW, 160, (g, w, h) => {
      board(g, w, h, '#fbfbf7', '#c62828', 8, 5);
      text(g, 'PIEDMONT', w / 2, h * 0.37, w * 0.9, h * 0.52, { family: HEAVY, weight: '900', fill: '#e53935', stroke: '#1b1b1f', strokeW: 7 });
      // Polka dots over the letters (clipped to them by drawing them in their colour's shadow).
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = '#1b1b1f';
      for (let k = 0; k < 90; k++) {
        const x = (k * 97) % w;
        const y = h * 0.14 + ((k * 53) % Math.round(h * 0.46));
        g.beginPath();
        g.arc(x, y, 3.2, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      g.fillStyle = '#1e63c6';
      roundRect(g, w * 0.1, h * 0.68, w * 0.8, h * 0.24, h * 0.12);
      text(g, 'B O U T I Q U E', w / 2, h * 0.8, w * 0.7, h * 0.19, { family: HEAVY, weight: '900', fill: '#ffffff' });
    }),
    cell('headRush', FW, 96, (g, w, h) => {
      g.fillStyle = '#fbfbf7';
      g.fillRect(0, 0, w, h);
      const panel = (x0: number, x1: number, s: string, italic: boolean): void => {
        g.fillStyle = '#141416';
        g.fillRect(x0, 6, x1 - x0, h - 12);
        text(g, s, (x0 + x1) / 2, h / 2, x1 - x0 - 16, h * 0.62, { family: italic ? SERIF : HEAVY, weight: '900', fill: '#fbfbf7', italic });
      };
      panel(6, w * 0.4, 'HEAD RUSH', true);
      panel(w * 0.42, w * 0.72, 'SMOKE', false);
      panel(w * 0.74, w - 6, 'SHOP', false);
    }),
    cell('toxic', FW, 96, (g, w, h) => {
      board(g, w, h, '#fbfbf7');
      g.fillStyle = '#5fbf4a';
      g.fillRect(0, h - 14, w, 14);
      g.fillRect(0, 0, w, 6);
      text(g, 'TOXIC THRILLZ', w / 2, h * 0.46, w * 0.84, h * 0.62, { family: HEAVY, weight: '900', fill: '#232326', italic: true, track: 2 });
    }),
    cell('derby', FW, 96, (g, w, h) => {
      board(g, w, h, '#1a1614', '#c9a54a', 4, 7);
      g.fillStyle = '#2e6b45';
      g.fillRect(14, h - 22, w - 28, 5);
      text(g, 'derby', w / 2, h * 0.44, w * 0.6, h * 0.66, { family: SERIF, weight: '700', fill: '#e2c16a', italic: true });
    }),
    cell('wakeCup', FW, 96, (g, w, h) => {
      board(g, w, h, '#f3ead6', '#6b4a34', 4, 6);
      g.fillStyle = '#6b4a34';
      g.beginPath();
      g.arc(58, h / 2, 32, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f3ead6';
      g.fillRect(44, h / 2 - 10, 24, 22);
      g.strokeStyle = '#f3ead6';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(70, h / 2 + 1, 7, -Math.PI / 2, Math.PI / 2);
      g.stroke();
      text(g, 'wake cup', w * 0.58, h / 2, w * 0.66, h * 0.6, { family: ROUND, weight: '800', fill: '#4a3222' });
    }),
    cell('benJerry', FW, 128, drawBenJerry),

    // --- 1400 Haight, south side --------------------------------------------------------------------
    cell('mellow', FW, 96, (g, w, h) => {
      board(g, w, h, '#1d2a5c', '#fbfbf7', 3, 5);
      text(g, 'The Mellow', w * 0.24, h / 2, w * 0.4, h * 0.7, { family: SCRIPT, weight: '700', fill: '#fbfbf7' });
      text(g, 'HOUSEPLANTS, POTS & MORE', w * 0.71, h / 2, w * 0.52, h * 0.3, { family: SANS, weight: '900', fill: '#fbfbf7' });
      g.fillStyle = '#4cb944';
      for (const x of [w * 0.46, w * 0.97]) {
        g.beginPath();
        g.ellipse(x, h * 0.5, 7, 16, 0.4, 0, Math.PI * 2);
        g.fill();
      }
    }),
    cell('flippin', FW, 96, (g, w, h) => {
      board(g, w, h, '#161618', '#d32f2f', 5, 4);
      g.fillStyle = '#d32f2f';
      g.beginPath();
      g.arc(h / 2 + 6, h / 2, h * 0.38, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f6b042';
      g.fillRect(h / 2 - 16, h / 2 - 13, 44, 10);
      g.fillStyle = '#6d3b1c';
      g.fillRect(h / 2 - 16, h / 2 - 2, 44, 7);
      g.fillStyle = '#f6b042';
      g.fillRect(h / 2 - 16, h / 2 + 6, 44, 7);
      text(g, "FLIPPIN' BURGER", w * 0.58, h / 2, w * 0.7, h * 0.5, { family: HEAVY, weight: '900', fill: '#fbfbf7', track: 1 });
    }),
    cell('cookies', FW, 96, (g, w, h) => {
      board(g, w, h, '#101218');
      text(g, 'Cookies', w / 2, h * 0.5, w * 0.7, h * 0.8, { family: FUNKY, weight: '900', fill: '#29a8ff', stroke: '#e8f6ff', strokeW: 5, italic: true });
    }),
    cell('mosaic', 256, 128, (g, w, h) => {
      const cols = ['#e8322a', '#ffd23f', '#29a8ff', '#7ad151', '#ff7fbf', '#8e44d8', '#ff8f1f', '#fbfbf7'];
      let k = 0;
      for (let y = 0; y < h; y += 32) {
        for (let x = -16; x < w; x += 32) {
          const xo = x + ((y / 32) % 2) * 16;
          for (const up of [true, false]) {
            g.fillStyle = cols[k++ % cols.length];
            g.beginPath();
            if (up) {
              g.moveTo(xo, y + 32);
              g.lineTo(xo + 16, y);
              g.lineTo(xo + 32, y + 32);
            } else {
              g.moveTo(xo + 16, y);
              g.lineTo(xo + 48, y);
              g.lineTo(xo + 32, y + 32);
            }
            g.fill();
            g.strokeStyle = '#141414';
            g.lineWidth = 2;
            g.stroke();
          }
        }
      }
    }),
    cell('porkStore', FW, 128, (g, w, h) => {
      g.fillStyle = '#e3a79a';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#20234a';
      g.beginPath();
      g.moveTo(10, h - 12);
      g.lineTo(10, 30);
      const n = 8;
      for (let k = 0; k < n; k++) g.quadraticCurveTo(10 + ((k + 0.5) * (w - 20)) / n, 4, 10 + ((k + 1) * (w - 20)) / n, 30);
      g.lineTo(w - 10, h - 12);
      g.closePath();
      g.fill();
      // A pig.
      g.fillStyle = '#f6a5b8';
      g.beginPath();
      g.ellipse(64, h * 0.62, 30, 20, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(92, h * 0.55, 12, 0, Math.PI * 2);
      g.fill();
      g.fillRect(44, h * 0.72, 7, 14);
      g.fillRect(74, h * 0.72, 7, 14);
      text(g, 'Pork Store Cafe', w * 0.6, h * 0.58, w * 0.66, h * 0.5, { family: SERIF, weight: '800', fill: '#f7ecd2', italic: true });
    }),
    cell('bizza', FW, 96, (g, w, h) => {
      board(g, w, h, '#141416');
      text(g, 'BIZZA', w / 2, h * 0.4, w * 0.6, h * 0.6, { family: HEAVY, weight: '900', fill: '#ff8a1f', stroke: '#6b2a00', strokeW: 4 });
      text(g, 'PIZZAS · CALZONES · HOT DOGS · VEGAN', w / 2, h * 0.82, w * 0.8, h * 0.15, { family: SANS, weight: '800', fill: '#fbfbf7' });
    }),
    cell('pureLand', FW, 96, (g, w, h) => {
      board(g, w, h, '#f2ead7', '#8a6a3a', 3, 6);
      text(g, 'PURE LAND', w / 2, h * 0.42, w * 0.7, h * 0.5, { family: SERIF, weight: '700', fill: '#4a3522', track: 4 });
      text(g, 'HIMALAYAN HANDICRAFTS', w / 2, h * 0.78, w * 0.6, h * 0.16, { family: SERIF, weight: '700', fill: '#8a2d2d' });
    }),
    cell('wfGlass', FW, 96, (g, w, h) => {
      board(g, w, h, '#5b2a8c');
      sunburst(g, w * 0.5, h * 0.5, w, ['#5b2a8c', '#6d37a4']);
      text(g, 'WORLD FAMOUS', w * 0.3, h * 0.5, w * 0.36, h * 0.3, { family: SANS, weight: '900', fill: '#fbfbf7' });
      trippy(g, 'GLASS', w * 0.7, h * 0.52, w * 0.38, h * 0.8, { family: FUNKY, weight: '900', fill: '#7ad151', stroke: '#1b1b1f', strokeW: 6, colors: ['#7ad151', '#ffd23f', '#29c5f6', '#ff7fbf', '#ff8f1f'] });
    }),
    cell('relic', FW, 96, (g, w, h) => {
      board(g, w, h, '#c62828');
      text(g, 'Relic Vintage', w / 2, h * 0.52, w * 0.8, h * 0.8, { family: SCRIPT, weight: '700', fill: '#fbfbf7' });
    }),
    cell('counterculture', FW, 96, (g, w, h) => {
      board(g, w, h, '#1f3a3a', '#d8c79a', 3, 6);
      peace(g, 40, h / 2, 24, '#f9d423', 5);
      peace(g, w - 40, h / 2, 24, '#f9d423', 5);
      text(g, 'COUNTERCULTURE', w / 2, h * 0.4, w * 0.7, h * 0.4, { family: SERIF, weight: '800', fill: '#f2e7c8', track: 2 });
      text(g, 'M U S E U M', w / 2, h * 0.76, w * 0.5, h * 0.2, { family: SANS, weight: '800', fill: '#f9d423' });
    }),

    // --- 1300 Haight (Central to Masonic) --------------------------------------------------------------
    cell('psychSF', FW, 128, (g, w, h) => {
      board(g, w, h, '#fbfbf7', '#1b1b1f', 5, 6);
      trippy(g, 'Psychedelic SF', w / 2, h * 0.52, w * 0.92, h * 0.86, { family: FUNKY, weight: '900', fill: '#141416', wave: 0.2, swell: 0.3 });
    }),
    cell('psychMural', 760, 288, drawPsychMural),
    cell('summerMural', 512, 256, drawSummerMural),
    cell('cosmicMural', 512, 256, drawCosmicMural),
    cell('bound', FW, 96, (g, w, h) => {
      board(g, w, h, '#121214');
      text(g, 'BOUND TOGETHER', w / 2, h * 0.42, w * 0.86, h * 0.5, { family: HEAVY, weight: '900', fill: '#f9d423' });
      text(g, 'ANARCHIST COLLECTIVE BOOKSTORE', w / 2, h * 0.8, w * 0.76, h * 0.15, { family: SANS, weight: '800', fill: '#f9d423' });
    }),
    cell('school', FW, 64, (g, w, h) => {
      board(g, w, h, '#f6efe2', '#8a2d2d', 3, 4);
      text(g, 'CHINESE IMMERSION SCHOOL AT DE AVILA', w / 2, h / 2, w * 0.9, h * 0.44, { family: SERIF, weight: '700', fill: '#8a2d2d' });
    }),
    cell('centralMarket', FW, 128, (g, w, h) => {
      board(g, w, h, '#ff7a1a', '#fbfbf7', 4, 6);
      g.fillStyle = '#fbfbf7';
      g.beginPath();
      g.arc(58, h / 2, 40, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#d32f2f';
      g.beginPath();
      g.arc(58, h / 2, 34, Math.PI, 2 * Math.PI);
      g.fill();
      g.fillStyle = '#1e4fb0';
      g.beginPath();
      g.arc(58, h / 2, 34, 0, Math.PI);
      g.fill();
      g.fillStyle = '#fbfbf7';
      g.fillRect(24, h / 2 - 5, 68, 10);
      text(g, 'CENTRAL HAIGHT', w * 0.58, h * 0.36, w * 0.68, h * 0.34, { family: HEAVY, weight: '900', fill: '#fbfbf7', stroke: '#8a3a00', strokeW: 4 });
      text(g, 'MARKET & LIQUOR', w * 0.58, h * 0.72, w * 0.6, h * 0.26, { family: HEAVY, weight: '900', fill: '#1b1b1f' });
    }),
    cell('magnolia', 128, 496, (g, w, h) => {
      board(g, w, h, '#161616', '#d8c9a3', 4, 6);
      flower(g, w / 2, 44, 26, '#f6e9ef', '#f0c05a');
      const s = 'MAGNOLIA';
      [...s].forEach((ch, k) => text(g, ch, w / 2, 100 + k * 48, w * 0.7, 46, { family: SERIF, weight: '800', fill: '#efe3c3' }));
    }),
    cell('pipeDreams', FW, 96, (g, w, h) => {
      board(g, w, h, '#7a1f1f', '#f9d423', 4, 6);
      trippy(g, 'PIPE DREAMS', w / 2, h / 2, w * 0.86, h * 0.8, { family: FUNKY, weight: '900', fill: '#fff', stroke: '#1b1b1f', strokeW: 6, colors: ['#ff5f5f', '#ff9f1f', '#ffd23f', '#7ad151', '#29c5f6', '#b388ff'] });
    }),
    cell('sunshine', FW, 96, (g, w, h) => {
      board(g, w, h, '#4a2a7a', '#f9d423', 4, 6);
      sunburst(g, 50, h / 2, 34, ['#f9d423', '#ff9f1f'], 16);
      text(g, 'SUNSHINE COAST', w * 0.56, h / 2, w * 0.74, h * 0.52, { family: FUNKY, weight: '900', fill: '#f9d423' });
    }),
    cell('braindrops', FW, 96, (g, w, h) => {
      board(g, w, h, '#2a1d17', '#c9a54a', 3, 6);
      text(g, 'braindrops', w * 0.46, h * 0.46, w * 0.62, h * 0.6, { family: ROUND, weight: '800', fill: '#efe3c3' });
      text(g, 'TATTOO', w * 0.86, h * 0.5, w * 0.2, h * 0.26, { family: SANS, weight: '900', fill: '#c9a54a' });
    }),
    cell('coffeeLama', FW, 96, (g, w, h) => {
      board(g, w, h, '#8a2432', '#f2b632', 4, 6);
      text(g, 'THE COFFEE LAMA', w / 2, h / 2, w * 0.86, h * 0.5, { family: SLAB, weight: '800', fill: '#f7d67a' });
    }),

    // --- 1500 Haight (past Ashbury): the Doolan-Larson building and its neighbours ------------------------
    cell('friezeHaight', FW, 96, (g, w, h) => frieze(g, w, h, 'HAIGHT')),
    cell('friezeAshbury', FW, 96, (g, w, h) => frieze(g, w, h, 'ASHBURY')),
    cell('welcome', 256, 256, (g, w) => {
      const c = w / 2;
      g.fillStyle = '#c9a54a';
      g.beginPath();
      g.arc(c, c, c, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1f6b52';
      g.beginPath();
      g.arc(c, c, c * 0.9, 0, Math.PI * 2);
      g.fill();
      text(g, 'Welcome to', c, c * 0.62, w * 0.7, w * 0.16, { family: SCRIPT, weight: '700', fill: '#f6e7b8' });
      text(g, 'HAIGHT', c, c * 0.96, w * 0.72, w * 0.2, { family: SERIF, weight: '800', fill: '#fbfbf7' });
      text(g, 'ASHBURY', c, c * 1.3, w * 0.72, w * 0.16, { family: SERIF, weight: '800', fill: '#fbfbf7' });
    }),
    cell('jewelry', FW, 96, (g, w, h) => {
      board(g, w, h, '#123a2c', '#c9a54a', 3, 6);
      text(g, 'HAIGHT JEWELRY · WATCH REPAIR', w / 2, h / 2, w * 0.86, h * 0.36, { family: SERIF, weight: '800', fill: '#e5c46a', track: 1 });
    }),
    cell('gallery1506', FW, 96, (g, w, h) => {
      board(g, w, h, '#16161a', '#c9a54a', 2, 6);
      text(g, 'GALLERY 1506', w / 2, h / 2, w * 0.7, h * 0.5, { family: SERIF, weight: '800', fill: '#e5c46a', track: 3 });
    }),
    cell('wootBear', FW, 96, (g, w, h) => {
      board(g, w, h, '#fbfbf7', '#ff7fbf', 5, 6);
      const bear = (x: number): void => {
        g.fillStyle = '#b07a4a';
        for (const dx of [-18, 18]) {
          g.beginPath();
          g.arc(x + dx, h * 0.3, 11, 0, Math.PI * 2);
          g.fill();
        }
        g.beginPath();
        g.arc(x, h * 0.55, 26, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#1b1b1f';
        for (const dx of [-9, 9]) {
          g.beginPath();
          g.arc(x + dx, h * 0.5, 3.5, 0, Math.PI * 2);
          g.fill();
        }
      };
      bear(48);
      bear(w - 48);
      text(g, 'WOOT BEAR', w / 2, h / 2, w * 0.66, h * 0.5, { family: ROUND, weight: '800', fill: '#ff4f9a' });
    }),
    cell('aviator', FW, 128, (g, w, h) => {
      board(g, w, h, '#1f3fbf');
      const band = ['#ff3b1f', '#ff8f1f', '#ffd23f'];
      band.forEach((c, k) => {
        g.fillStyle = c;
        g.fillRect(0, h * 0.62 + k * 12, w, 12);
      });
      text(g, 'AVIATOR NATION', w / 2, h * 0.32, w * 0.84, h * 0.4, { family: ROUND, weight: '800', fill: '#fbfbf7', track: 2 });
    }),
    cell('skeleton', 760, 192, drawSkeleton),
    cell('deluxe', FW, 96, (g, w, h) => {
      board(g, w, h, '#101014');
      g.shadowColor = '#ff4fd8';
      g.shadowBlur = 14;
      text(g, 'THE DELUXE', w / 2, h / 2, w * 0.76, h * 0.56, { family: SANS, weight: '800', fill: '#ffd0f4', italic: true, stroke: '#ff4fd8', strokeW: 3 });
      g.shadowBlur = 0;
    }),
    cell('hsVintage', FW, 96, (g, w, h) => {
      board(g, w, h, '#121214', '#fbfbf7', 2, 5);
      text(g, 'Haight Street Vintage', w / 2, h / 2, w * 0.86, h * 0.6, { family: GOTHIC, weight: '700', fill: '#fbfbf7' });
    }),
    cell('redHouse', FW, 128, (g, w, h) => {
      board(g, w, h, '#d31f2f', '#fbfbf7', 4, 6);
      text(g, '1524 Haight Street', w / 2, h * 0.3, w * 0.6, h * 0.24, { family: SERIF, weight: '700', fill: '#fbfbf7', italic: true });
      text(g, 'JIMI HENDRIX RED HOUSE', w / 2, h * 0.66, w * 0.86, h * 0.36, { family: HEAVY, weight: '900', fill: '#fbfbf7' });
    }),
    cell('gus', FW, 192, drawGus),
    cell('gusAwning', FW, 64, (g, w, h) => {
      for (let x = 0; x < w; x += 24) {
        g.fillStyle = (x / 24) % 2 ? '#fbfbf7' : '#1f7a3a';
        g.fillRect(x, 0, 24, h);
      }
      g.fillStyle = '#1f7a3a';
      g.fillRect(0, h * 0.55, w, h * 0.45);
      text(g, "GUS'S COMMUNITY MARKET", w / 2, h * 0.78, w * 0.8, h * 0.36, { family: SANS, weight: '900', fill: '#fbfbf7' });
    }),
  ];
}

// ---------------------------------------------------------------------------------------------
// The bigger pieces

/** An old San Francisco street blade: white, black letters, the block number in a tab. */
function blade(g: CanvasRenderingContext2D, w: number, h: number, name: string, block: string): void {
  g.fillStyle = '#fbfbf7';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#1b1b1f';
  g.lineWidth = 5;
  g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = '#1b1b1f';
  g.fillRect(14, 14, 84, 26);
  text(g, `← ${block}`, 56, 27, 76, 20, { family: SANS, weight: '800', fill: '#fbfbf7' });
  text(g, name, w * 0.58, h * 0.56, w * 0.7, h * 0.72, { family: SERIF, weight: '700', fill: '#1b1b1f' });
}

/** Black serif capitals lettered on a white frieze (the Doolan-Larson building's corner). */
function frieze(g: CanvasRenderingContext2D, w: number, h: number, s: string): void {
  g.fillStyle = '#f4f1e8';
  g.fillRect(0, 0, w, h);
  text(g, s, w / 2, h * 0.54, w * 0.92, h * 0.8, { family: SERIF, weight: '800', fill: '#16161a', track: 8 });
}

/** The top of a shopfront's painted arch, as a rim. */
function arch(g: CanvasRenderingContext2D, w: number, h: number, color: string, lw: number): void {
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.beginPath();
  g.moveTo(lw, h);
  g.lineTo(lw, h * 0.45);
  g.quadraticCurveTo(lw, lw, w * 0.18, lw);
  g.lineTo(w * 0.82, lw);
  g.quadraticCurveTo(w - lw, lw, w - lw, h * 0.45);
  g.lineTo(w - lw, h);
  g.stroke();
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fill();
}

/** Ben & Jerry's: sky, a green hill, clouds, a cow, the name. */
function drawBenJerry(g: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#7cc8f4');
  sky.addColorStop(1, '#c6ecff');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#5cb84a';
  g.beginPath();
  g.moveTo(0, h);
  g.quadraticCurveTo(w * 0.3, h * 0.62, w * 0.62, h * 0.86);
  g.quadraticCurveTo(w * 0.85, h * 0.7, w, h * 0.8);
  g.lineTo(w, h);
  g.fill();
  g.fillStyle = '#ffffff';
  for (const [x, y, r] of [
    [60, 26, 18],
    [84, 22, 22],
    [108, 28, 16],
    [390, 20, 16],
    [412, 16, 20],
    [436, 24, 14],
  ]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // The cow: white, black patches, pink nose.
  const cx = w - 64;
  const cy = h * 0.66;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(cx, cy, 34, 20, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(cx - 26, cy + 10, 7, 20);
  g.fillRect(cx + 18, cy + 10, 7, 20);
  g.beginPath();
  g.ellipse(cx - 36, cy - 10, 13, 11, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1b1b1f';
  g.beginPath();
  g.ellipse(cx + 6, cy - 4, 12, 8, 0.4, 0, Math.PI * 2);
  g.ellipse(cx - 14, cy + 6, 7, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f4a0b4';
  g.beginPath();
  g.ellipse(cx - 44, cy - 6, 6, 5, 0, 0, Math.PI * 2);
  g.fill();
  text(g, "BEN & JERRY'S", w * 0.44, h * 0.5, w * 0.78, h * 0.62, { family: ROUND, weight: '900', fill: '#1f2f7a', stroke: '#ffffff', strokeW: 10 });
}

/** Love on Haight's ground floor: ART COLLECTIVE across the top, rainbows over its windows (tie-dye
 *  hanging in them), hearts and flowers on violet. */
function drawLoveMural(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = '#7b3fc4';
  g.fillRect(0, 0, w, h);
  // Swirls behind everything.
  g.globalAlpha = 0.35;
  for (let k = 0; k < 14; k++) {
    g.strokeStyle = ['#ff7fbf', '#29c5f6', '#ffd23f'][k % 3];
    g.lineWidth = 8;
    g.beginPath();
    g.arc((k * 131) % w, h * 0.3 + ((k * 71) % Math.round(h * 0.7)), 30 + (k % 4) * 12, 0, Math.PI * 1.5);
    g.stroke();
  }
  g.globalAlpha = 1;
  // The band.
  g.fillStyle = '#fbfbf7';
  g.fillRect(0, 0, w, h * 0.2);
  const band = 'ART COLLECTIVE ✿ LOVE ON HAIGHT ✿';
  trippy(g, band, w / 2, h * 0.1, w * 0.98, h * 0.2, { family: FUNKY, weight: '900', fill: '#e8322a', colors: ['#e8322a', '#f7862a', '#e0a800', '#2e9e44', '#2f8fd8', '#7a4bc4'], wave: 0.05, swell: 0.05 });
  // Three windows under rainbows, tie-dye shirts in them.
  const n = 3;
  for (let k = 0; k < n; k++) {
    const cx = ((k + 0.5) / n) * w;
    const ww = w / n - 70;
    rainbow(g, cx, h * 0.62, ww / 2 + 30, 9, Math.PI, 2 * Math.PI);
    g.fillStyle = '#1b2a4a';
    g.fillRect(cx - ww / 2, h * 0.5, ww, h * 0.44);
    g.beginPath();
    g.arc(cx, h * 0.5, ww / 2, Math.PI, 2 * Math.PI);
    g.fill();
    for (const dx of [-ww * 0.24, ww * 0.24]) {
      g.save();
      g.beginPath();
      // A T-shirt.
      const sx = cx + dx;
      const sy = h * 0.52;
      g.moveTo(sx - 30, sy);
      g.lineTo(sx - 48, sy + 18);
      g.lineTo(sx - 38, sy + 28);
      g.lineTo(sx - 26, sy + 20);
      g.lineTo(sx - 26, sy + 80);
      g.lineTo(sx + 26, sy + 80);
      g.lineTo(sx + 26, sy + 20);
      g.lineTo(sx + 38, sy + 28);
      g.lineTo(sx + 48, sy + 18);
      g.lineTo(sx + 30, sy);
      g.closePath();
      g.clip();
      g.translate(sx - 50, sy - 10);
      tieDye(g, 100, 100, k % 2 ? ['#ff4f9a', '#ffd23f', '#29c5f6', '#7ad151'] : ['#e8322a', '#f7862a', '#f9d423', '#2f8fd8', '#8e44d8']);
      g.restore();
    }
  }
  for (let k = 0; k < 10; k++) heart(g, 20 + ((k * 173) % (w - 40)), h * 0.24 + ((k * 37) % 40), 22, ['#ff4f9a', '#ffd23f', '#29c5f6', '#e8322a'][k % 4]);
  for (let k = 0; k < 6; k++) flower(g, (k + 0.5) * (w / 6), h * 0.96, 18, ['#ff7fbf', '#ffd23f', '#fbfbf7'][k % 3]);
  g.fillStyle = '#fbfbf7';
  g.font = `italic 700 ${Math.round(h * 0.07)}px ${SERIF}`;
  g.textAlign = 'center';
  g.fillText('We Will Get By · We Will Survive', w / 2, h * 0.47);
}

/** Psychedelic SF's wrap: a winged scarab over the door, eyes and roses, the eye in the pyramid. */
function drawPsychMural(g: CanvasRenderingContext2D, w: number, h: number): void {
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#2a1a6e');
  bg.addColorStop(0.5, '#4b1f8a');
  bg.addColorStop(1, '#1f3a8a');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  sunburst(g, w * 0.5, h * 0.45, w * 0.7, ['rgba(255,210,63,0.16)', 'rgba(0,0,0,0)'], 36);
  // The scarab: wings spread in bands of colour, a gold body.
  const cx = w * 0.5;
  const cy = h * 0.42;
  for (const s of [-1, 1]) {
    const cols = ['#29c5f6', '#7ad151', '#ffd23f', '#ff8f1f', '#e8322a'];
    cols.forEach((c, k) => {
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(cx, cy);
      g.quadraticCurveTo(cx + s * (w * 0.2 - k * 16), cy - h * 0.34 + k * 10, cx + s * (w * 0.3 - k * 22), cy - h * 0.08 + k * 8);
      g.quadraticCurveTo(cx + s * (w * 0.2 - k * 16), cy + h * 0.02, cx, cy + h * 0.08);
      g.fill();
    });
  }
  g.fillStyle = '#e0a800';
  g.beginPath();
  g.ellipse(cx, cy + h * 0.06, 26, 40, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ff4f9a';
  g.beginPath();
  g.arc(cx, cy - h * 0.1, 18, 0, Math.PI * 2);
  g.fill();
  // Eyes and roses along the wall.
  for (const [x, y, s] of [
    [0.1, 0.3, 70],
    [0.9, 0.3, 70],
    [0.22, 0.75, 56],
    [0.78, 0.75, 56],
  ] as const) eye(g, w * x, h * y, s, ['#29c5f6', '#7ad151', '#ff8f1f', '#e8322a'][Math.round(x * 10) % 4]);
  const rose = (x: number, y: number, r: number): void => {
    for (let k = 3; k > 0; k--) {
      g.fillStyle = ['#8a0f2a', '#c2185b', '#e8322a'][k - 1];
      g.beginPath();
      g.arc(x, y, (r * k) / 3, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#2e9e44';
    g.beginPath();
    g.ellipse(x + r, y + r * 0.6, r * 0.5, r * 0.25, 0.5, 0, Math.PI * 2);
    g.fill();
  };
  rose(w * 0.06, h * 0.72, 20);
  rose(w * 0.36, h * 0.84, 16);
  rose(w * 0.64, h * 0.84, 16);
  rose(w * 0.94, h * 0.72, 20);
  // The eye in the pyramid.
  g.fillStyle = '#ffd23f';
  g.beginPath();
  g.moveTo(w * 0.5, h * 0.62);
  g.lineTo(w * 0.42, h * 0.97);
  g.lineTo(w * 0.58, h * 0.97);
  g.closePath();
  g.fill();
  eye(g, w * 0.5, h * 0.84, 40, '#29c5f6');
  // Checkerboard along the foot.
  for (let x = 0; x < w; x += 16) {
    g.fillStyle = (x / 16) % 2 ? '#fbfbf7' : '#141416';
    g.fillRect(x, h - 10, 16, 10);
  }
}

/** A '67 poster on a side wall: rainbow bands swirling out of a sun, SUMMER OF LOVE, flowers. */
function drawSummerMural(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = '#ff9f1f';
  g.fillRect(0, 0, w, h);
  const cols = ['#e8322a', '#ff7f2a', '#ffd23f', '#7ad151', '#29a8ff', '#8e44d8', '#ff5fb8'];
  for (let k = 14; k >= 0; k--) {
    g.fillStyle = cols[k % cols.length];
    g.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
      const r = (k + 1) * 26 * (1 + 0.12 * Math.sin(a * 5 + k * 0.7));
      const x = w * 0.3 + Math.cos(a + k * 0.15) * r;
      const y = h * 0.55 + Math.sin(a + k * 0.15) * r * 0.8;
      if (a === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.fill();
  }
  sunburst(g, w * 0.3, h * 0.55, 34, ['#ffd23f', '#fff4b0'], 18);
  for (let k = 0; k < 7; k++) flower(g, w * (0.55 + 0.07 * k), h * (0.82 + 0.08 * Math.sin(k)), 16, ['#fbfbf7', '#ff5fb8', '#ffd23f'][k % 3]);
  trippy(g, 'SUMMER', w * 0.7, h * 0.24, w * 0.56, h * 0.3, { family: FUNKY, weight: '900', fill: '#fbfbf7', stroke: '#6a1b9a', strokeW: 8, wave: 0.16, swell: 0.25 });
  trippy(g, 'OF LOVE', w * 0.7, h * 0.52, w * 0.5, h * 0.28, { family: FUNKY, weight: '900', fill: '#ffd23f', stroke: '#6a1b9a', strokeW: 8, wave: 0.2, swell: 0.3 });
  text(g, '1967', w * 0.7, h * 0.7, w * 0.2, h * 0.12, { family: SERIF, weight: '800', fill: '#6a1b9a' });
}

/** Planets, stars and an all-seeing eye on deep blue: a cosmic wall. */
function drawCosmicMural(g: CanvasRenderingContext2D, w: number, h: number): void {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0f1a4a');
  bg.addColorStop(1, '#3a1f6e');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  for (let k = 0; k < 70; k++) {
    g.fillStyle = k % 5 ? '#fbfbf7' : '#ffd23f';
    g.fillRect((k * 173) % w, (k * 97) % h, 2 + (k % 3), 2 + (k % 3));
  }
  const planet = (x: number, y: number, r: number, a: string, b: string, ring: boolean): void => {
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    gr.addColorStop(0, a);
    gr.addColorStop(1, b);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    if (ring) {
      g.strokeStyle = '#ffd23f';
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(x, y, r * 1.7, r * 0.45, -0.3, 0, Math.PI * 2);
      g.stroke();
    }
  };
  planet(w * 0.18, h * 0.35, 40, '#ff9fd0', '#c2185b', true);
  planet(w * 0.82, h * 0.62, 52, '#9fe0ff', '#1f6fbf', false);
  planet(w * 0.62, h * 0.2, 20, '#d0ff9f', '#4c9a1f', false);
  sunburst(g, w * 0.46, h * 0.56, 90, ['rgba(255,210,63,0.35)', 'rgba(0,0,0,0)'], 24);
  eye(g, w * 0.46, h * 0.56, 120, '#29c5f6');
  peace(g, w * 0.2, h * 0.82, 22, '#fbfbf7', 5);
}

/** The long skeletal creature painted down Aviator Nation's side wall, on grey. */
function drawSkeleton(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = '#8d9096';
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.25;
  for (let k = 0; k < 8; k++) {
    g.fillStyle = ['#ff8f1f', '#29c5f6', '#ff4f9a', '#7ad151'][k % 4];
    g.beginPath();
    g.arc((k * 113) % w, (k * 61) % h, 40, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // The spine: a wave of vertebrae, ribs off each, a skull at the head.
  const n = 26;
  const pts: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    pts.push([w * (0.06 + t * 0.78), h * (0.52 + Math.sin(t * Math.PI * 2.4) * 0.18)]);
  }
  g.strokeStyle = '#1b1b1f';
  g.lineWidth = 3;
  pts.forEach(([x, y], k) => {
    const rib = 26 * Math.sin((k / n) * Math.PI) + 6;
    g.strokeStyle = '#f4f1e8';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(x, y - rib);
    g.quadraticCurveTo(x + 8, y, x, y + rib);
    g.stroke();
    g.fillStyle = '#f4f1e8';
    g.strokeStyle = '#1b1b1f';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(x, y, 9, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  });
  const [hx, hy] = pts[n];
  g.fillStyle = '#f4f1e8';
  g.beginPath();
  g.ellipse(hx + 40, hy - 6, 44, 30, -0.2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#1b1b1f';
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = '#1b1b1f';
  g.beginPath();
  g.arc(hx + 52, hy - 12, 9, 0, Math.PI * 2);
  g.fill();
  for (let k = 0; k < 5; k++) g.fillRect(hx + 30 + k * 10, hy + 14, 5, 10);
}

/** Gus's painted sign: fields in rows under a sunny sky, the market's name round the arch. */
function drawGus(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = '#1f7a3a';
  g.fillRect(0, 0, w, h);
  g.save();
  g.beginPath();
  g.moveTo(12, h - 8);
  g.lineTo(12, h * 0.4);
  g.quadraticCurveTo(w / 2, -h * 0.2, w - 12, h * 0.4);
  g.lineTo(w - 12, h - 8);
  g.closePath();
  g.clip();
  g.fillStyle = '#9bd6f5';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffd23f';
  g.beginPath();
  g.arc(w * 0.8, h * 0.36, 22, 0, Math.PI * 2);
  g.fill();
  const rows = ['#6cbf3a', '#4d9a2f', '#8fcf4a', '#3f8a2a', '#b5d95a'];
  rows.forEach((c, k) => {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(0, h * 0.55 + k * 18);
    g.quadraticCurveTo(w / 2, h * 0.45 + k * 18, w, h * 0.58 + k * 18);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
  });
  for (let k = 0; k < 16; k++) {
    g.fillStyle = ['#e8322a', '#ff8f1f', '#ffd23f', '#8e44d8'][k % 4];
    g.beginPath();
    g.arc(30 + k * 29, h * 0.86 + (k % 3) * 6, 7, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  g.strokeStyle = '#d8c79a';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(12, h - 8);
  g.lineTo(12, h * 0.4);
  g.quadraticCurveTo(w / 2, -h * 0.2, w - 12, h * 0.4);
  g.lineTo(w - 12, h - 8);
  g.stroke();
  trippy(g, 'HAIGHT STREET', w / 2, h * 0.3, w * 0.66, h * 0.26, { family: FUNKY, weight: '900', fill: '#ffd23f', stroke: '#8a1f1f', strokeW: 6, wave: 0.08, swell: 0.08 });
  text(g, 'MARKET', w / 2, h * 0.56, w * 0.4, h * 0.2, { family: FUNKY, weight: '900', fill: '#ffd23f', stroke: '#8a1f1f', strokeW: 6 });
}

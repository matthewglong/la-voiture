// Every sign in Hayes Valley as its shop really letters it (colours, typeface, the odd logo), from
// the street-level survey of September 2026: the 500 block of Hayes both sides, Proxy's containers,
// the Biergarten, Blue Bottle's kiosk, Suppenküche, Marine Layer, Patricia's Green; blade signs (the
// ones that face the traffic) for most of the shops; and the shop-window tiles. All painted into one
// atlas (atlas.ts), tallest first so the rows pack tight.
import { BOOK, GEO, HAND, ROUND, SANS, SCRIPT, SERIF, SignAtlas, WIDE, fitFont, lettered, windowTile, type Draw, type Letters, type WindowKind } from './atlas';

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

/** Aviator Nation's shopfront: cobalt, the orange-red-yellow stripes, "AV". */
function aviator(blade: boolean): Draw {
  return (g, w, h) => {
    g.fillStyle = '#1f52d6';
    g.fillRect(0, 0, w, h);
    const stripes = ['#f6c21c', '#f28a1c', '#e8452c'];
    const top = blade ? h * 0.18 : h * 0.3;
    stripes.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(0, top + i * h * 0.1, blade ? w : w * 0.66, h * 0.1);
    });
    centre(g);
    g.fillStyle = '#ffffff';
    if (blade) {
      fitFont(g, 'AV', (px) => `italic 900 ${px}px ${WIDE}`, w * 0.6, h * 0.36);
      g.fillText('AV', w / 2, h * 0.7);
    } else {
      fitFont(g, 'AV', (px) => `italic 900 ${px}px ${WIDE}`, w * 0.25, h * 0.66);
      g.fillText('AV', w * 0.83, h * 0.46);
      g.fillStyle = '#f4f4f0';
      fitFont(g, 'AVIATOR NATION', (px) => `700 ${px}px ${WIDE}`, w * 0.6, h * 0.16, 0.12);
      g.fillText('AVIATOR NATION', w * 0.34, h * 0.8);
    }
  };
}

/** A little orange bird on the wing. */
function bird(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  g.fillStyle = '#f39a2b';
  g.beginPath();
  g.ellipse(x, y, s, s * 0.55, -0.2, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(x - s * 0.2, y - s * 0.2);
  g.lineTo(x - s * 1.1, y - s * 1.1);
  g.lineTo(x + s * 0.4, y - s * 0.3);
  g.fill();
  g.beginPath();
  g.moveTo(x + s * 0.9, y - s * 0.1);
  g.lineTo(x + s * 1.4, y + s * 0.05);
  g.lineTo(x + s * 0.9, y + s * 0.2);
  g.fill();
}

const orangeBird: Draw = (g, w, h) => {
  g.fillStyle = '#2338a4';
  g.fillRect(0, 0, w, h);
  // The band's rough plaster.
  for (let i = 0; i < 60; i++) {
    g.fillStyle = i % 2 ? 'rgba(10,20,90,0.25)' : 'rgba(80,100,220,0.2)';
    g.beginPath();
    g.arc(((i * 97) % w) + 3, ((i * 53) % h) + 2, 3 + (i % 5) * 2, 0, Math.PI * 2);
    g.fill();
  }
  bird(g, w * 0.13, h * 0.52, h * 0.16);
  centre(g);
  g.fillStyle = '#ffffff';
  fitFont(g, 'Orange Bird', (px) => `700 ${px}px ${SCRIPT}`, w * 0.7, h * 0.72);
  g.fillText('Orange Bird', w * 0.58, h * 0.52);
};

const archer: Draw = (g, w, h) => {
  g.fillStyle = '#1f2d4f';
  g.fillRect(0, 0, w, h);
  centre(g);
  g.fillStyle = '#ffffff';
  fitFont(g, 'ARCHER', (px) => `400 ${px}px ${WIDE}`, w * 0.62, h * 0.46, 0.12);
  g.fillText('ARCHER', w * 0.5, h * 0.38);
  g.fillStyle = '#f07f2c';
  g.fillRect(w * 0.44, h * 0.64, w * 0.36, h * 0.22);
  g.fillStyle = '#ffffff';
  fitFont(g, 'NAIL BAR', (px) => `700 ${px}px ${WIDE}`, w * 0.32, h * 0.16, 0.1);
  g.fillText('NAIL BAR', w * 0.62, h * 0.755);
};

const metier: Draw = (g, w, h) => {
  g.fillStyle = '#3a2618';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c9a24c';
  g.lineWidth = h * 0.07;
  g.beginPath();
  g.arc(w * 0.17, h * 0.5, h * 0.24, 0, Math.PI * 2);
  g.stroke();
  centre(g);
  g.fillStyle = '#c9a24c';
  fitFont(g, 'METIER', (px) => `400 ${px}px ${SERIF}`, w * 0.6, h * 0.46, 0.2);
  g.fillText('METIER', w * 0.6, h * 0.53);
};

/** Nabila's: the painted parapet (red, the diamond, yellow and blue bands), its name in the middle. */
const nabilas: Draw = (g, w, h) => {
  g.fillStyle = '#c8322b';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#f2c12e';
  g.fillRect(0, h * 0.78, w, h * 0.1);
  g.fillStyle = '#2a58b8';
  g.fillRect(0, h * 0.88, w, h * 0.12);
  g.fillRect(0, 0, w, h * 0.08);
  for (const x of [0.1, 0.9]) {
    g.fillStyle = '#f2c12e';
    g.beginPath();
    g.moveTo(w * x, h * 0.3);
    g.lineTo(w * x + h * 0.14, h * 0.46);
    g.lineTo(w * x, h * 0.62);
    g.lineTo(w * x - h * 0.14, h * 0.46);
    g.fill();
    g.fillStyle = '#2a58b8';
    g.beginPath();
    g.arc(w * x, h * 0.46, h * 0.05, 0, Math.PI * 2);
    g.fill();
  }
  centre(g);
  g.fillStyle = '#fff6dc';
  fitFont(g, 'NABILA’S', (px) => `800 ${px}px ${BOOK}`, w * 0.62, h * 0.3, 0.04);
  g.fillText('NABILA’S', w / 2, h * 0.33);
  fitFont(g, 'NATURALS', (px) => `700 ${px}px ${BOOK}`, w * 0.56, h * 0.2, 0.12);
  g.fillText('NATURALS', w / 2, h * 0.6);
};

const seventhAve: Draw = (g, w, h) => {
  g.fillStyle = '#121212';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#f4f4f0';
  g.lineWidth = h * 0.06;
  g.strokeRect(w * 0.1, h * 0.14, w * 0.8, h * 0.72);
  centre(g);
  g.fillStyle = '#f4f4f0';
  fitFont(g, '7th Avenue', (px) => `700 ${px}px ${BOOK}`, w * 0.7, h * 0.5);
  g.fillText('7th Avenue', w / 2, h * 0.53);
};

const rails: Draw = (g, w, h) => {
  g.fillStyle = '#fbfbf8';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#1b1b1b';
  g.lineWidth = w * 0.03;
  g.strokeRect(w * 0.06, h * 0.06, w * 0.88, h * 0.88);
  centre(g);
  g.fillStyle = '#1b1b1b';
  fitFont(g, 'Rails', (px) => `700 ${px}px ${SCRIPT}`, w * 0.78, h * 0.5);
  g.fillText('Rails', w / 2, h * 0.52);
};

function tagged(text: string, lines: string[], tag: string): Draw {
  return (g, w, h) => {
    g.fillStyle = '#141414';
    g.fillRect(0, 0, w, h);
    centre(g);
    g.fillStyle = '#e8e8e8';
    const lh = (h * 0.56) / lines.length;
    lines.forEach((line, i) => {
      fitFont(g, line, (px) => `600 ${px}px ${WIDE}`, w * 0.74, lh * 0.9, 0.18);
      g.fillText(line, w * 0.46, h * 0.22 + lh * (i + 0.5));
    });
    g.fillStyle = tag;
    g.fillRect(w * 0.88, h * 0.3, w * 0.06, h * 0.4);
    void text;
  };
}

function patxis(blade: boolean): Draw {
  return (g, w, h) => {
    g.fillStyle = '#121212';
    g.fillRect(0, 0, w, h);
    const oval = (x: number, y: number, rx: number, ry: number): void => {
      g.fillStyle = '#f2a623';
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#121212';
      g.beginPath();
      g.ellipse(x, y, rx * 0.84, ry * 0.74, 0, 0, Math.PI * 2);
      g.fill();
    };
    centre(g);
    if (!blade) {
      oval(w * 0.1, h * 0.5, w * 0.075, h * 0.3);
      oval(w * 0.9, h * 0.5, w * 0.075, h * 0.3);
      g.fillStyle = '#f2a623';
      fitFont(g, 'Patxi’s', (px) => `700 ${px}px ${SCRIPT}`, w * 0.56, h * 0.8);
      g.fillText('Patxi’s', w / 2, h * 0.52);
    } else {
      oval(w / 2, h * 0.44, w * 0.44, h * 0.34);
      g.fillStyle = '#f2a623';
      fitFont(g, 'Patxi’s', (px) => `700 ${px}px ${SCRIPT}`, w * 0.7, h * 0.46);
      g.fillText('Patxi’s', w / 2, h * 0.45);
      fitFont(g, 'PIZZA', (px) => `700 ${px}px ${WIDE}`, w * 0.4, h * 0.12, 0.2);
      g.fillText('PIZZA', w / 2, h * 0.88);
    }
  };
}

const gioiaBlade: Draw = (g, w, h) => {
  g.fillStyle = '#101010';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d9c9a0';
  g.lineWidth = 3;
  g.strokeRect(5, 5, w - 10, h - 10);
  centre(g);
  g.fillStyle = '#f7f3ea';
  fitFont(g, 'GIOIA', (px) => `700 ${px}px ${SERIF}`, w * 0.8, h * 0.44, 0.08);
  g.fillText('GIOIA', w / 2, h * 0.4);
  g.fillStyle = '#d9c9a0';
  fitFont(g, 'pizzeria', (px) => `700 ${px}px ${SCRIPT}`, w * 0.62, h * 0.28);
  g.fillText('pizzeria', w / 2, h * 0.74);
};

const sfDance: Draw = (g, w, h) => {
  g.fillStyle = '#3b3b3b';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fbfbf8';
  g.beginPath();
  g.arc(w / 2, h / 2, w * 0.47, 0, Math.PI * 2);
  g.fill();
  centre(g);
  g.fillStyle = '#c8322b';
  fitFont(g, 'SF', (px) => `800 ${px}px ${GEO}`, w * 0.5, h * 0.34);
  g.fillText('SF', w / 2, h * 0.4);
  g.fillStyle = '#1b1b1b';
  fitFont(g, 'DANCE GEAR', (px) => `700 ${px}px ${WIDE}`, w * 0.66, h * 0.12, 0.05);
  g.fillText('DANCE GEAR', w / 2, h * 0.66);
};

/** Proxy's totem at the corner: the name up a tall black steel slab (drawn lying down). */
const proxy: Draw = (g, w, h) => {
  g.fillStyle = '#161616';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#5b5b5b';
  g.lineWidth = 3;
  g.strokeRect(6, 6, w - 12, h - 12);
  centre(g);
  g.fillStyle = '#f2f2ee';
  fitFont(g, 'PROXY', (px) => `800 ${px}px ${WIDE}`, w * 0.8, h * 0.62, 0.35);
  g.fillText('PROXY', w / 2, h * 0.54);
};

const aether: Draw = (g, w, h) => {
  g.fillStyle = '#3a3c40';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#f2f2ee';
  g.lineWidth = h * 0.05;
  g.beginPath();
  g.arc(w * 0.5, h * 0.33, h * 0.2, 0, Math.PI * 2);
  g.stroke();
  centre(g);
  g.fillStyle = '#f2f2ee';
  fitFont(g, 'A', (px) => `300 ${px}px ${WIDE}`, h * 0.3, h * 0.26);
  g.fillText('A', w * 0.5, h * 0.35);
  fitFont(g, 'AETHER', (px) => `600 ${px}px ${WIDE}`, w * 0.7, h * 0.22, 0.4);
  g.fillText('AETHER', w * 0.5, h * 0.76);
};

/** Ritual's round sign: the red flag, the name round it. */
const ritual: Draw = (g, w, h) => {
  g.fillStyle = '#8f9499';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fbfbf8';
  g.beginPath();
  g.arc(w / 2, h / 2, w * 0.48, 0, Math.PI * 2);
  g.fill();
  // The flag: a staff and a swallow-tailed red pennant.
  g.fillStyle = '#d0202e';
  g.fillRect(w * 0.36, h * 0.16, w * 0.035, h * 0.4);
  g.beginPath();
  g.moveTo(w * 0.395, h * 0.17);
  g.lineTo(w * 0.7, h * 0.2);
  g.lineTo(w * 0.6, h * 0.29);
  g.lineTo(w * 0.7, h * 0.38);
  g.lineTo(w * 0.395, h * 0.4);
  g.fill();
  centre(g);
  g.fillStyle = '#1b1b1b';
  fitFont(g, 'RITUAL', (px) => `800 ${px}px ${WIDE}`, w * 0.66, h * 0.17, 0.12);
  g.fillText('RITUAL', w / 2, h * 0.64);
  fitFont(g, 'COFFEE ROASTERS', (px) => `600 ${px}px ${WIDE}`, w * 0.6, h * 0.08, 0.1);
  g.fillText('COFFEE ROASTERS', w / 2, h * 0.79);
};

const blueBottle: Draw = (g, w, h) => {
  g.fillStyle = '#fbfbf8';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#2f7dc1';
  g.beginPath();
  g.moveTo(w * 0.44, h * 0.14);
  g.lineTo(w * 0.56, h * 0.14);
  g.lineTo(w * 0.56, h * 0.3);
  g.quadraticCurveTo(w * 0.66, h * 0.36, w * 0.66, h * 0.46);
  g.lineTo(w * 0.66, h * 0.72);
  g.lineTo(w * 0.34, h * 0.72);
  g.lineTo(w * 0.34, h * 0.46);
  g.quadraticCurveTo(w * 0.34, h * 0.36, w * 0.44, h * 0.3);
  g.fill();
  centre(g);
  g.fillStyle = '#1b1b1b';
  fitFont(g, 'BLUE BOTTLE', (px) => `600 ${px}px ${WIDE}`, w * 0.8, h * 0.1, 0.12);
  g.fillText('BLUE BOTTLE', w / 2, h * 0.86);
};

const patriciasGreen: Draw = (g, w, h) => {
  g.fillStyle = '#1f4d33';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#efe6c8';
  g.lineWidth = h * 0.045;
  g.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16);
  centre(g);
  g.fillStyle = '#efe6c8';
  fitFont(g, 'PATRICIA’S GREEN', (px) => `700 ${px}px ${BOOK}`, w * 0.8, h * 0.34, 0.04);
  g.fillText('PATRICIA’S GREEN', w / 2, h * 0.42);
  fitFont(g, 'HAYES VALLEY', (px) => `600 ${px}px ${WIDE}`, w * 0.4, h * 0.14, 0.25);
  g.fillText('HAYES VALLEY', w / 2, h * 0.72);
};

/** The jazz musicians painted on Nabila's piers, black and white: a trumpeter, a singer. */
function mural(which: 0 | 1): Draw {
  return (g, w, h) => {
    g.fillStyle = '#e9e6df';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#161616';
    if (which === 0) {
      g.beginPath();
      g.ellipse(w * 0.45, h * 0.3, w * 0.26, h * 0.13, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(w * 0.12, h * 0.42, w * 0.7, h * 0.6);
      g.fillStyle = '#e9e6df';
      g.fillRect(w * 0.55, h * 0.36, w * 0.4, h * 0.04);
      g.beginPath();
      g.arc(w * 0.92, h * 0.38, w * 0.08, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(w * 0.36, h * 0.27, w * 0.05, h * 0.02, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.27, w * 0.3, h * 0.16, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(w * 0.18, h * 0.45, w * 0.64, h * 0.6);
      g.fillStyle = '#e9e6df';
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.3, w * 0.16, h * 0.1, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#161616';
      g.fillRect(w * 0.38, h * 0.27, w * 0.08, h * 0.015);
      g.fillRect(w * 0.54, h * 0.27, w * 0.08, h * 0.015);
      g.fillRect(w * 0.44, h * 0.35, w * 0.12, h * 0.02);
    }
  };
}

/** Hazie's red vertical blades (lettered lying down, mapped standing up). */
function vertical(text: string): Draw {
  return (g, w, h) => {
    g.fillStyle = '#c8322b';
    g.fillRect(0, 0, w, h);
    centre(g);
    g.fillStyle = '#fbf6ec';
    fitFont(g, text, (px) => `700 ${px}px ${WIDE}`, w * 0.86, h * 0.56, 0.2);
    g.fillText(text, w / 2, h * 0.54);
  };
}

const WINDOWS: WindowKind[] = ['clothes', 'cafe', 'bakery', 'beds', 'shelves', 'icecream', 'dark', 'papered', 'bar', 'shoes'];

/** Paint every sign the neighbourhood has into the atlas. */
export function paintSigns(atlas: SignAtlas): void {
  const specs: Spec[] = [
    // --- Shop windows and the murals.
    ...WINDOWS.map((k) => ({ key: `w_${k}`, w: 128, h: 172, edge: '#2a2a2a', draw: windowTile(k) })),
    { key: 'mural0', w: 72, h: 144, edge: '#e9e6df', draw: mural(0) },
    { key: 'mural1', w: 72, h: 144, edge: '#e9e6df', draw: mural(1) },
    { key: 'ritual', w: 160, h: 160, edge: '#8f9499', draw: ritual },
    // --- 500 Hayes, north side (590 to 500), fascias.
    L('toddSnyder', 384, 64, { bg: '#1b1b1d', fg: '#f3f1ea', lines: ['TODD SNYDER'], font: WIDE, weight: 600, tr: 0.2, fill: 0.46 }),
    L('saltStraw', 320, 96, { bg: '#f2ebdd', fg: '#1d1a18', lines: ['Salt & Straw'], font: SCRIPT, fill: 0.8 }),
    L('throughHayes', 384, 80, { bg: '#2b2d31', fg: '#e9e6df', lines: ['THROUGH THE HAYES', 'OPTOMETRY'], font: WIDE, weight: 600, sizes: [1.3, 0.8], tr: 0.08, fill: 0.62 }),
    L('cottonSheep', 320, 72, { bg: '#b98a58', fg: '#35251a', lines: ['COTTON SHEEP'], font: BOOK, tr: 0.1, fill: 0.5 }),
    L('buckMason', 320, 64, { bg: '#f7f6f2', fg: '#151515', lines: ['BUCK MASON'], font: WIDE, weight: 500, tr: 0.3, fill: 0.44 }),
    { key: 'orangeBird', w: 320, h: 80, edge: '#2338a4', draw: orangeBird },
    L('trueSake', 320, 56, { bg: '#1f4fb4', fg: '#ffffff', lines: ['TRUE SAKE'], font: WIDE, weight: 700, tr: 0.14, fill: 0.56 }),
    L('credo', 256, 72, { bg: '#2e8a8c', fg: '#ffffff', lines: ['credo'], font: SANS, weight: 300, fill: 0.72 }),
    L('reliquary', 320, 64, { bg: '#262422', fg: '#d9caa6', lines: ['RELIQUARY'], font: SERIF, weight: 400, tr: 0.2, fill: 0.5 }),
    L('faherty', 256, 64, { bg: '#121212', fg: '#ffffff', lines: ['FAHERTY'], font: WIDE, weight: 600, tr: 0.26, fill: 0.5 }),
    L('fiddlesticks', 320, 80, { bg: '#fbf8f0', fg: '#e0492a', lines: ['fiddlesticks'], font: HAND, fill: 0.74 }),
    L('ioan', 448, 64, { bg: '#c9a77c', fg: '#2a2118', lines: ['INDUSTRY OF ALL NATIONS'], font: WIDE, weight: 600, tr: 0.14, fill: 0.42 }),
    { key: 'archer', w: 320, h: 80, edge: '#1f2d4f', draw: archer },
    L('paolo', 256, 64, { bg: '#6a3726', fg: '#e6d3b0', lines: ['PAOLO'], font: SERIF, weight: 400, tr: 0.3, fill: 0.5 }),
    { key: 'aviator', w: 384, h: 96, edge: '#1f52d6', draw: aviator(false) },
    L('malinGoetz', 320, 64, { bg: '#eeeeea', fg: '#161616', lines: ['MALIN+GOETZ'], font: WIDE, weight: 600, tr: 0.12, fill: 0.46 }),
    L('laBoulangerie', 448, 64, { bg: '#26324a', fg: '#f1e6cf', lines: ['LA BOULANGERIE'], font: SERIF, weight: 700, tr: 0.1, fill: 0.56 }),
    L('boulangerie', 448, 72, { bg: '#9db7cc', fg: '#a8801f', lines: ['BOULANGERIE'], font: SERIF, weight: 700, tr: 0.16, fill: 0.62 }),
    // --- 500 Hayes, south side (597 to 501), fascias.
    L('topo', 320, 64, { bg: '#151515', fg: '#f2f2f2', lines: ['TOPO DESIGNS'], font: WIDE, weight: 600, tr: 0.2, fill: 0.46 }),
    L('gambit', 256, 64, { bg: '#141414', fg: '#c9a24c', lines: ['GAMBIT'], font: SERIF, weight: 700, tr: 0.3, fill: 0.5 }),
    L('gioia', 320, 72, { bg: '#1f3a2c', fg: '#f1e3c0', lines: ['GIOIA PIZZERIA'], font: SERIF, weight: 700, tr: 0.1, fill: 0.5 }),
    { key: 'metier', w: 256, h: 72, edge: '#3a2618', draw: metier },
    { key: 'nabilas', w: 256, h: 144, edge: '#c8322b', draw: nabilas },
    { key: 'seventhAve', w: 320, h: 80, edge: '#121212', draw: seventhAve },
    L('sfDance', 320, 64, { bg: '#262626', fg: '#ffffff', lines: ['SF DANCE GEAR'], font: WIDE, weight: 700, tr: 0.1, fill: 0.46 }),
    L('cotopaxi', 256, 72, { bg: '#1c1c1c', fg: '#ffffff', lines: ['cotopaxi'], font: ROUND, weight: 700, fill: 0.6 }),
    { key: 'rails', w: 128, h: 128, edge: '#fbfbf8', draw: rails },
    L('allaPrima', 320, 64, { bg: '#9ba692', fg: '#2b3128', lines: ['ALLA PRIMA'], font: SERIF, weight: 400, tr: 0.25, fill: 0.46 }),
    { key: 'peakDesign', w: 320, h: 64, edge: '#141414', draw: tagged('PEAK DESIGN', ['PEAK DESIGN'], '#f26b21') },
    L('brooklinen', 320, 72, { bg: '#111111', fg: '#ffffff', lines: ['brooklinen'], font: BOOK, weight: 700, fill: 0.58 }),
    L('souvla', 256, 72, { bg: '#111111', fg: '#ffffff', lines: ['SOUVLA'], font: WIDE, weight: 700, tr: 0.32, fill: 0.5 }),
    { key: 'patxis', w: 384, h: 80, edge: '#121212', draw: patxis(false) },
    L('hazies', 256, 64, { bg: '#f4f1ea', fg: '#1a1a1a', lines: ['HAZIE’S'], font: SERIF, weight: 700, tr: 0.2, fill: 0.5 }),
    // --- Blade signs (they face the traffic).
    L('b_saltStraw', 160, 96, { bg: '#f2ebdd', fg: '#1d1a18', lines: ['Salt &', 'Straw'], font: SCRIPT, fill: 0.84, rule: '#1d1a18' }),
    L('b_cottonSheep', 160, 96, { bg: '#b98a58', fg: '#35251a', lines: ['COTTON', 'SHEEP'], font: BOOK, fill: 0.62, rule: '#35251a' }),
    L('b_buckMason', 160, 96, { bg: '#f7f6f2', fg: '#151515', lines: ['BUCK', 'MASON'], font: WIDE, weight: 600, tr: 0.18, fill: 0.6, rule: '#151515' }),
    L('b_orangeBird', 160, 96, { bg: '#2338a4', fg: '#ffffff', lines: ['Orange', 'Bird'], font: SCRIPT, fill: 0.84, rule: '#f39a2b' }),
    L('b_trueSake', 160, 96, { bg: '#1f4fb4', fg: '#ffffff', lines: ['TRUE', 'SAKE'], font: WIDE, weight: 700, tr: 0.12, fill: 0.6, rule: '#ffffff' }),
    L('b_credo', 160, 96, { bg: '#2e8a8c', fg: '#ffffff', lines: ['credo'], font: SANS, weight: 400, fill: 0.62 }),
    L('b_faherty', 160, 96, { bg: '#121212', fg: '#ffffff', lines: ['FAHERTY'], font: WIDE, weight: 600, tr: 0.16, fill: 0.4, rule: '#ffffff' }),
    L('b_fiddlesticks', 160, 96, { bg: '#fbf8f0', fg: '#e0492a', lines: ['fiddle-', 'sticks'], font: HAND, fill: 0.8, rule: '#e0492a' }),
    L('b_ioan', 160, 96, { bg: '#c9a77c', fg: '#2a2118', lines: ['INDUSTRY', 'OF ALL', 'NATIONS'], font: WIDE, weight: 700, tr: 0.06, fill: 0.7, rule: '#2a2118' }),
    { key: 'b_aviator', w: 160, h: 96, edge: '#1f52d6', draw: aviator(true) },
    L('b_malinGoetz', 160, 96, { bg: '#eeeeea', fg: '#161616', lines: ['MALIN+', 'GOETZ'], font: WIDE, weight: 600, tr: 0.1, fill: 0.6, rule: '#161616' }),
    L('b_laBoulangerie', 160, 96, { bg: '#26324a', fg: '#f1e6cf', lines: ['LA', 'BOULANGERIE'], font: SERIF, sizes: [0.7, 1], fill: 0.62, rule: '#c9a24a' }),
    L('b_topo', 160, 96, { bg: '#151515', fg: '#f2f2f2', lines: ['TOPO', 'DESIGNS'], font: WIDE, weight: 600, tr: 0.14, fill: 0.58, rule: '#f2f2f2' }),
    L('b_gambit', 160, 96, { bg: '#141414', fg: '#c9a24c', lines: ['GAMBIT'], font: SERIF, tr: 0.18, fill: 0.44, rule: '#c9a24c' }),
    { key: 'b_gioia', w: 160, h: 112, edge: '#101010', draw: gioiaBlade },
    L('b_seventhAve', 160, 96, { bg: '#121212', fg: '#f4f4f0', lines: ['7th', 'Avenue'], font: BOOK, fill: 0.66, rule: '#f4f4f0' }),
    { key: 'b_sfDance', w: 128, h: 128, edge: '#3b3b3b', draw: sfDance },
    L('b_cotopaxi', 160, 96, { bg: '#1c1c1c', fg: '#ffffff', lines: ['cotopaxi'], font: ROUND, weight: 700, fill: 0.46 }),
    { key: 'b_peakDesign', w: 160, h: 96, edge: '#141414', draw: tagged('PEAK DESIGN', ['PEAK', 'DESIGN'], '#f26b21') },
    L('b_brooklinen', 160, 96, { bg: '#111111', fg: '#ffffff', lines: ['brook-', 'linen'], font: BOOK, weight: 700, fill: 0.66 }),
    L('b_souvla', 160, 96, { bg: '#111111', fg: '#ffffff', lines: ['SOUVLA'], font: WIDE, weight: 700, tr: 0.16, fill: 0.42, rule: '#ffffff' }),
    { key: 'b_patxis', w: 160, h: 96, edge: '#121212', draw: patxis(true) },
    { key: 'v_restaurant', w: 256, h: 48, edge: '#c8322b', draw: vertical('RESTAURANT') },
    { key: 'v_cocktails', w: 256, h: 48, edge: '#c8322b', draw: vertical('COCKTAILS') },
    L('b_marineLayer', 160, 96, { bg: '#2f5d9e', fg: '#ffffff', lines: ['MARINE', 'LAYER'], font: WIDE, weight: 600, tr: 0.16, fill: 0.58, rule: '#ffffff' }),
    // --- Round the corner: Marine Layer, Proxy, Octavia, Linden, Laguna.
    L('marineLayer', 384, 64, { bg: '#2f5d9e', fg: '#ffffff', lines: ['MARINE LAYER'], font: WIDE, weight: 600, tr: 0.22, fill: 0.46 }),
    { key: 'proxy', w: 384, h: 96, edge: '#161616', draw: proxy },
    L('luxfit', 256, 64, { bg: '#111111', fg: '#f5b82e', lines: ['[ LUXFIT ]'], font: WIDE, weight: 800, tr: 0.1, fill: 0.5 }),
    { key: 'aether', w: 256, h: 128, edge: '#3a3c40', draw: aether },
    L('hometown', 320, 80, { bg: '#fbfaf6', fg: '#c8252f', lines: ['SF’s HOMETOWN', 'CREAMERY'], font: BOOK, sizes: [1, 1], tr: 0.04, fill: 0.7 }),
    L('iceCream', 256, 56, { bg: '#f4f1ea', fg: '#c8252f', lines: ['ICE CREAM'], font: BOOK, tr: 0.12, fill: 0.56 }),
    L('biergarten', 384, 80, { bg: '#2d4a34', fg: '#f3e6c4', lines: ['BIERGARTEN'], font: SERIF, tr: 0.12, fill: 0.5, rule: '#f3e6c4' }),
    { key: 'blueBottle', w: 128, h: 128, edge: '#fbfbf8', draw: blueBottle },
    L('bb315', 96, 56, { bg: '#8d8a84', fg: '#f4f2ee', lines: ['315'], font: SANS, weight: 400, fill: 0.6 }),
    { key: 'patriciasGreen', w: 320, h: 112, edge: '#1f4d33', draw: patriciasGreen },
    L('suppenkuche', 512, 72, { bg: '#d6ae3a', fg: '#161616', lines: ['SUPPENKÜCHE'], font: SANS, weight: 800, tr: 0.06, fill: 0.62 }),
  ];
  // (Drawn at 0.82 of the sizes above, which are easier to design at: they still come out sharper
  // than the screen shows them from the car.)
  for (const s of specs) {
    if (s.key.startsWith('w_') || s.key.startsWith('mural') || s.key === 'ritual') continue;
    s.w = Math.round(s.w * 0.82);
    s.h = Math.round(s.h * 0.82);
  }
  specs.sort((a, b) => b.h - a.h);
  for (const s of specs) atlas.add(s.key, s.w, s.h, s.edge, s.draw);
}

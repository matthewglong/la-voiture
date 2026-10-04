// The Mission's signs, murals and painted things, on one atlas (osg/haight/atlas.ts packs and maps
// them): the taquerias' boards (El Farolito, La Taqueria, Taqueria Cancún), La Victoria's, the New
// Mission's tall sign and the Alamo Drafthouse's marquee, the BART sign, Tartine, Bi-Rite and its
// creamery, Dandelion, the Mission Cultural Center, the shops of Mission St and 24th (carnicería,
// lavandería, paletería, piñatas, joyería, envíos, quinceañeras, western wear...), and the murals:
// suns and Aztec frets, the Virgen de Guadalupe, flowers and birds, calaveras, a lowrider, the
// MaestraPeace mural that covers the Women's Building. The papel picado is its own, cut-out canvas
// (papelCanvas).
import { HEAVY, ROUND, SANS, SCRIPT, SERIF, SLAB, board, flower, heart, sunburst, text, type Cell } from '../../osg/haight/atlas';

/** The Mission's paint box. */
export const MX = {
  red: '#d7263d',
  chili: '#b5172f',
  orange: '#f46036',
  marigold: '#f9a620',
  yellow: '#ffd23f',
  lime: '#8ac926',
  green: '#1b998b',
  jade: '#0b7a4b',
  turquoise: '#2ec4b6',
  blue: '#1d4ed8',
  cobalt: '#1e3a8a',
  purple: '#7b2cbf',
  magenta: '#e0218a',
  pink: '#ff70a6',
  brown: '#6b3e26',
  cream: '#fff4dc',
  ink: '#1b1b1f',
};

/** Rows of the step fret (greca) along a band: the Aztec border. */
function greca(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fg: string, bg: string): void {
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);
  g.fillStyle = fg;
  const u = h / 4;
  for (let i = x; i < x + w; i += u * 4) {
    g.fillRect(i, y + u * 3, u * 4, u);
    g.fillRect(i, y, u, u * 3);
    g.fillRect(i, y, u * 3, u);
    g.fillRect(i + u * 2, y + u, u, u * 1.2);
  }
}

/** A row of little triangles (a zigzag border). */
function zigzag(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cols: string[]): void {
  const n = Math.max(2, Math.round(w / h));
  const step = w / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[i % cols.length];
    g.beginPath();
    g.moveTo(x + i * step, y + h);
    g.lineTo(x + (i + 0.5) * step, y);
    g.lineTo(x + (i + 1) * step, y + h);
    g.fill();
  }
}

/** A sugar skull (calavera) with flower eyes. */
export function calavera(g: CanvasRenderingContext2D, x: number, y: number, s: number, accent: string): void {
  g.fillStyle = '#fbfbf7';
  g.beginPath();
  g.ellipse(x, y, s * 0.5, s * 0.46, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x - s * 0.28, y + s * 0.2, s * 0.56, s * 0.36);
  for (const dx of [-0.2, 0.2]) {
    flower(g, x + dx * s, y - s * 0.02, s * 0.2, accent, MX.yellow);
    g.fillStyle = MX.ink;
    g.beginPath();
    g.arc(x + dx * s, y - s * 0.02, s * 0.05, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = MX.ink;
  g.beginPath();
  g.moveTo(x, y + s * 0.1);
  g.lineTo(x - s * 0.06, y + s * 0.22);
  g.lineTo(x + s * 0.06, y + s * 0.22);
  g.fill();
  g.lineWidth = Math.max(1, s * 0.025);
  g.strokeStyle = MX.ink;
  for (let i = -3; i <= 3; i++) {
    g.beginPath();
    g.moveTo(x + i * s * 0.07, y + s * 0.34);
    g.lineTo(x + i * s * 0.07, y + s * 0.5);
    g.stroke();
  }
  g.strokeStyle = accent;
  g.lineWidth = s * 0.04;
  g.beginPath();
  g.arc(x, y - s * 0.3, s * 0.12, 0, Math.PI * 2);
  g.stroke();
}

/** A marigold (cempasúchil). */
function marigold(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  for (let k = 0; k < 3; k++) {
    g.fillStyle = k === 0 ? MX.orange : k === 1 ? MX.marigold : MX.yellow;
    g.beginPath();
    for (let a = 0; a <= 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const rr = r * (1 - k * 0.3) * (a % 2 ? 0.8 : 1);
      if (a === 0) g.moveTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
      else g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    }
    g.fill();
  }
}

/** A bird: a hummingbird or a quetzal, wings up. */
function bird(g: CanvasRenderingContext2D, x: number, y: number, s: number, body: string, wing: string): void {
  g.fillStyle = wing;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x - s * 0.6, y - s * 0.9, x - s * 0.1, y - s * 0.2);
  g.fill();
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + s * 0.5, y - s * 0.95, x + s * 0.15, y - s * 0.15);
  g.fill();
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(x, y, s * 0.35, s * 0.15, -0.3, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(x - s * 0.3, y + s * 0.08);
  g.lineTo(x - s * 0.85, y + s * 0.35);
  g.lineTo(x - s * 0.75, y + s * 0.15);
  g.fill();
  g.strokeStyle = MX.ink;
  g.lineWidth = Math.max(1, s * 0.04);
  g.beginPath();
  g.moveTo(x + s * 0.32, y - s * 0.1);
  g.lineTo(x + s * 0.7, y - s * 0.22);
  g.stroke();
}

/** A shop sign: a painted board with its name and an optional second line. */
function shop(name: string, bg: string, fg: string, opts: { sub?: string; family?: string; rim?: string; stroke?: string; italic?: boolean; deco?: (g: CanvasRenderingContext2D, w: number, h: number) => void; w?: number } = {}): Cell {
  return {
    name,
    w: opts.w ?? 384,
    h: 96,
    draw: (g, w, h) => {
      board(g, w, h, bg, opts.rim, 4, 6);
      opts.deco?.(g, w, h);
      const t = SIGN_TEXT[name] ?? [name];
      if (opts.sub || t.length > 1) {
        text(g, t[0], w / 2, h * 0.38, w * 0.86, h * 0.48, { family: opts.family ?? HEAVY, fill: fg, stroke: opts.stroke, strokeW: 5, italic: opts.italic });
        text(g, opts.sub ?? t[1], w / 2, h * 0.78, w * 0.7, h * 0.22, { family: SANS, weight: '800', fill: fg, track: 3 });
      } else text(g, t[0], w / 2, h / 2, w * 0.86, h * 0.62, { family: opts.family ?? HEAVY, fill: fg, stroke: opts.stroke, strokeW: 5, italic: opts.italic });
    },
  };
}

/** What each sign says (its first line, and a second). */
const SIGN_TEXT: Record<string, string[]> = {
  carniceria: ['CARNICERÍA LOS ALTOS', 'CARNES · CHORIZO · CHICHARRÓN'],
  lavanderia: ['LAVANDERÍA LA ESTRELLA', 'SELF SERVICE · WASH & FOLD'],
  paleteria: ['PALETERÍA LA MICHOACANA', 'PALETAS · AGUAS FRESCAS · NIEVES'],
  pinatas: ['FIESTA PIÑATAS', 'DULCES · DECORACIONES'],
  joyeria: ['JOYERÍA GUADALAJARA', 'ORO · PLATA · RELOJES'],
  envios: ['ENVÍOS DE DINERO', 'A MÉXICO Y CENTROAMÉRICA'],
  discos: ['DISCOS EL GALLO', 'NORTEÑO · RANCHERA · CUMBIA'],
  zapateria: ['ZAPATERÍA LA FAMA', 'BOTAS · HUARACHES'],
  panaderia: ['PANADERÍA LA MEXICANA', 'PAN DULCE · CONCHAS · BOLILLOS'],
  mercado: ['MERCADO LA LOMA', 'FRUTAS · VERDURAS · ABARROTES'],
  llantera: ['LLANTERA EL CHUY', 'LLANTAS NUEVAS Y USADAS'],
  lowrider: ['LOW & SLOW', 'CUSTOMS · HYDRAULICS · CHROME'],
  mariscos: ['MARISCOS EL PUERTO', 'COCTELES · CEVICHE · CAMARONES'],
  tortilleria: ['TORTILLERÍA LA PALMA', 'TORTILLAS · TAMALES · MASA'],
  quince: ['QUINCEAÑERAS', 'VESTIDOS · NOVIAS · BAUTIZOS'],
  western: ['RANCHO WESTERN WEAR', 'BOTAS · SOMBREROS · CINTOS'],
  farmacia: ['FARMACIA DEL PUEBLO', ''],
  dulceria: ['DULCERÍA LA PIÑATA', ''],
  granTaco: ['TAQUERIA EL GRAN TACO', 'BURRITOS · TACOS · TORTAS'],
  cafe: ['CAFÉ DE OLLA', 'CHOCOLATE · CHAMPURRADO'],
  musica: ['MÚSICA LATINA', 'GUITARRAS · ACORDEONES'],
  celulares: ['CELULARES', 'PREPAGO · REPARACIONES'],
  floreria: ['FLORERÍA REGALOS GUADALUPANA', 'FLORES · REGALOS'],
};

// ---------------------------------------------------------------------------------------------
// The landmarks' own signs

function farolito(): Cell {
  return {
    name: 'farolito',
    w: 512,
    h: 112,
    draw: (g, w, h) => {
      board(g, w, h, MX.yellow, MX.red, 7, 8);
      // A paper lantern either end.
      for (const x of [w * 0.09, w * 0.91]) {
        g.fillStyle = MX.red;
        g.beginPath();
        g.ellipse(x, h * 0.52, h * 0.2, h * 0.3, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = MX.yellow;
        g.lineWidth = 3;
        for (const dy of [-0.15, 0, 0.15]) {
          g.beginPath();
          g.moveTo(x - h * 0.18, h * (0.52 + dy));
          g.lineTo(x + h * 0.18, h * (0.52 + dy));
          g.stroke();
        }
        g.fillStyle = MX.ink;
        g.fillRect(x - h * 0.09, h * 0.18, h * 0.18, h * 0.06);
        g.fillRect(x - h * 0.09, h * 0.8, h * 0.18, h * 0.06);
      }
      text(g, 'El Farolito', w / 2, h * 0.42, w * 0.7, h * 0.62, { family: SCRIPT, weight: '700', fill: MX.red, stroke: MX.ink, strokeW: 3 });
      text(g, 'TAQUERIA · DESDE 1983', w / 2, h * 0.84, w * 0.6, h * 0.17, { family: SANS, weight: '900', fill: MX.chili, track: 4 });
    },
  };
}

function laTaqueria(): Cell {
  return {
    name: 'laTaqueria',
    w: 448,
    h: 104,
    draw: (g, w, h) => {
      board(g, w, h, MX.cream, MX.chili, 6, 9);
      text(g, 'La Taqueria', w / 2, h * 0.45, w * 0.82, h * 0.68, { family: SCRIPT, weight: '700', fill: MX.chili });
      zigzag(g, 14, h - 24, w - 28, 12, [MX.green, MX.chili, MX.marigold]);
    },
  };
}

function cancun(): Cell {
  return {
    name: 'cancun',
    w: 480,
    h: 112,
    draw: (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, MX.turquoise);
      sky.addColorStop(1, '#0e7c86');
      board(g, w, h, sky);
      // The sun going down over the sea, and a palm.
      g.fillStyle = MX.marigold;
      g.beginPath();
      g.arc(w * 0.12, h * 0.78, h * 0.32, Math.PI, 2 * Math.PI);
      g.fill();
      g.strokeStyle = '#3b2a1f';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(w * 0.9, h);
      g.quadraticCurveTo(w * 0.93, h * 0.5, w * 0.88, h * 0.28);
      g.stroke();
      g.fillStyle = '#1f7a3a';
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k - 2.5) * 0.55;
        g.beginPath();
        g.ellipse(w * 0.88 + Math.cos(a) * 26, h * 0.28 + Math.sin(a) * 14, 30, 7, a, 0, Math.PI * 2);
        g.fill();
      }
      text(g, 'TAQUERIA CANCÚN', w * 0.5, h * 0.42, w * 0.62, h * 0.42, { family: HEAVY, fill: MX.yellow, stroke: MX.chili, strokeW: 7 });
      text(g, 'BURRITOS · TACOS · QUESADILLAS', w * 0.5, h * 0.8, w * 0.58, h * 0.17, { family: SANS, weight: '900', fill: '#ffffff', track: 2 });
    },
  };
}

function laVictoria(): Cell {
  return {
    name: 'laVictoria',
    w: 448,
    h: 112,
    draw: (g, w, h) => {
      board(g, w, h, MX.pink, MX.cream, 6, 8);
      // Conchas either side.
      for (const x of [w * 0.1, w * 0.9]) {
        g.fillStyle = '#f2d2a2';
        g.beginPath();
        g.ellipse(x, h * 0.55, h * 0.26, h * 0.2, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#c99a62';
        g.lineWidth = 3;
        for (let k = -2; k <= 2; k++) {
          g.beginPath();
          g.moveTo(x + k * h * 0.06, h * 0.38);
          g.quadraticCurveTo(x + k * h * 0.1, h * 0.55, x + k * h * 0.06, h * 0.72);
          g.stroke();
        }
      }
      text(g, 'La Victoria', w / 2, h * 0.4, w * 0.66, h * 0.55, { family: SERIF, weight: '700', italic: true, fill: MX.cream, stroke: MX.chili, strokeW: 5 });
      text(g, 'PANADERÍA MEXICANA · 1951', w / 2, h * 0.8, w * 0.62, h * 0.18, { family: SANS, weight: '900', fill: MX.cream, track: 3 });
    },
  };
}

/** The New Mission's tall sign: NEW over MISSION, letter above letter (read up the sign). */
function newMission(): Cell {
  return {
    name: 'newMission',
    w: 128,
    h: 768,
    draw: (g, w, h) => {
      board(g, w, h, MX.cream, MX.red, 10, 10);
      const letters = ['N', 'E', 'W', '★', 'M', 'I', 'S', 'S', 'I', 'O', 'N'];
      const step = (h - 60) / letters.length;
      letters.forEach((ch, i) => {
        const y = 30 + step * (i + 0.5);
        if (ch === '★') {
          sunburst(g, w / 2, y, step * 0.42, [MX.yellow, MX.orange], 12);
          return;
        }
        text(g, ch, w / 2, y, w * 0.7, step * 0.92, { family: HEAVY, fill: i < 3 ? MX.cobalt : MX.red, stroke: MX.ink, strokeW: 4 });
      });
      // The bulbs down both edges.
      g.fillStyle = MX.yellow;
      for (let y = 24; y < h - 12; y += 34) {
        for (const x of [16, w - 16]) {
          g.beginPath();
          g.arc(x, y, 6, 0, Math.PI * 2);
          g.fill();
        }
      }
    },
  };
}

function marquee(): Cell {
  return {
    name: 'marquee',
    w: 576,
    h: 144,
    draw: (g, w, h) => {
      board(g, w, h, '#fbf3df', MX.ink, 8, 6);
      g.fillStyle = MX.red;
      g.fillRect(0, 0, w, h * 0.3);
      text(g, 'ALAMO DRAFTHOUSE · NEW MISSION', w / 2, h * 0.15, w * 0.9, h * 0.24, { family: HEAVY, fill: MX.yellow, track: 4 });
      text(g, 'NOW SHOWING', w / 2, h * 0.42, w * 0.4, h * 0.12, { family: SANS, weight: '900', fill: MX.ink, track: 6 });
      text(g, 'LA VOITURE: DRIFT DE LOS MUERTOS', w / 2, h * 0.62, w * 0.9, h * 0.2, { family: HEAVY, fill: MX.ink });
      text(g, 'TONIGHT 7 · 9:30 · MIDNIGHT', w / 2, h * 0.85, w * 0.7, h * 0.15, { family: HEAVY, fill: MX.chili });
    },
  };
}

function bart(): Cell {
  return {
    name: 'bart',
    w: 192,
    h: 192,
    draw: (g, w, h) => {
      board(g, w, h, '#0099d8');
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(w * 0.5, h * 0.36, w * 0.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0099d8';
      g.fillRect(w * 0.3, h * 0.33, w * 0.4, h * 0.06);
      text(g, 'BART', w / 2, h * 0.72, w * 0.8, h * 0.26, { family: HEAVY, fill: '#ffffff', track: 4 });
      text(g, '24TH ST MISSION', w / 2, h * 0.9, w * 0.86, h * 0.1, { family: SANS, weight: '900', fill: '#ffffff', track: 2 });
    },
  };
}

function calle24(): Cell {
  return {
    name: 'calle24',
    w: 768,
    h: 120,
    draw: (g, w, h) => {
      board(g, w, h, MX.purple);
      greca(g, 0, 0, w, 22, MX.yellow, MX.purple);
      greca(g, 0, h - 22, w, 22, MX.yellow, MX.purple);
      text(g, '¡BIENVENIDOS A CALLE 24!', w / 2, h * 0.44, w * 0.86, h * 0.4, { family: HEAVY, fill: '#ffffff', stroke: MX.magenta, strokeW: 8 });
      text(g, 'LATINO CULTURAL DISTRICT', w / 2, h * 0.73, w * 0.5, h * 0.13, { family: SANS, weight: '900', fill: MX.yellow, track: 6 });
    },
  };
}

function flagMX(): Cell {
  return {
    name: 'flagMX',
    w: 210,
    h: 120,
    draw: (g, w, h) => {
      g.fillStyle = '#006847';
      g.fillRect(0, 0, w / 3, h);
      g.fillStyle = '#ffffff';
      g.fillRect(w / 3, 0, w / 3, h);
      g.fillStyle = '#ce1126';
      g.fillRect((2 * w) / 3, 0, w / 3, h);
      // The eagle on its cactus, simply.
      g.fillStyle = '#8a5a2b';
      g.beginPath();
      g.ellipse(w / 2, h * 0.47, w * 0.07, h * 0.16, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2e7d32';
      g.fillRect(w / 2 - w * 0.06, h * 0.62, w * 0.12, h * 0.06);
      g.strokeStyle = '#2e7d32';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(w / 2, h * 0.5, w * 0.12, 0.3, Math.PI - 0.3);
      g.stroke();
    },
  };
}

function tartine(): Cell {
  return {
    name: 'tartine',
    w: 320,
    h: 88,
    draw: (g, w, h) => {
      board(g, w, h, '#f3efe6', '#3e4a45', 4, 8);
      text(g, 'TARTINE', w / 2, h * 0.42, w * 0.7, h * 0.46, { family: SERIF, weight: '700', fill: '#2f3a36', track: 10 });
      text(g, 'BAKERY & CAFE', w / 2, h * 0.78, w * 0.5, h * 0.16, { family: SANS, weight: '700', fill: '#2f3a36', track: 5 });
    },
  };
}

function biRite(): Cell {
  return {
    name: 'biRite',
    w: 448,
    h: 128,
    draw: (g, w, h) => {
      board(g, w, h, '#f6efdc', '#1f3f8a', 7, 8);
      text(g, 'Bi-Rite', w * 0.5, h * 0.42, w * 0.72, h * 0.62, { family: SCRIPT, weight: '700', fill: MX.red, stroke: '#7a0f1c', strokeW: 3 });
      g.fillStyle = '#1f3f8a';
      g.fillRect(w * 0.2, h * 0.7, w * 0.6, h * 0.2);
      text(g, 'MARKET', w / 2, h * 0.8, w * 0.5, h * 0.16, { family: HEAVY, fill: '#f6efdc', track: 10 });
    },
  };
}

function creamery(): Cell {
  return {
    name: 'creamery',
    w: 448,
    h: 112,
    draw: (g, w, h) => {
      board(g, w, h, '#fde6ef', '#8a4b2a', 6, 8);
      // A cone.
      g.fillStyle = '#d9a35b';
      g.beginPath();
      g.moveTo(w * 0.07, h * 0.45);
      g.lineTo(w * 0.13, h * 0.45);
      g.lineTo(w * 0.1, h * 0.88);
      g.fill();
      g.fillStyle = MX.pink;
      g.beginPath();
      g.arc(w * 0.1, h * 0.38, h * 0.14, 0, Math.PI * 2);
      g.fill();
      text(g, 'Bi-Rite Creamery', w * 0.55, h * 0.44, w * 0.76, h * 0.55, { family: SCRIPT, weight: '700', fill: '#8a4b2a' });
      text(g, 'ICE CREAM · BAKESHOP', w * 0.55, h * 0.82, w * 0.5, h * 0.15, { family: SANS, weight: '900', fill: '#8a4b2a', track: 4 });
    },
  };
}

function dandelion(): Cell {
  return {
    name: 'dandelion',
    w: 416,
    h: 96,
    draw: (g, w, h) => {
      board(g, w, h, '#3b2416', '#e9d8bf', 4, 8);
      text(g, 'DANDELION', w / 2, h * 0.4, w * 0.7, h * 0.42, { family: SERIF, weight: '700', fill: '#f2e3c8', track: 8 });
      text(g, 'CHOCOLATE · SMALL BATCH · BEAN TO BAR', w / 2, h * 0.78, w * 0.8, h * 0.15, { family: SANS, weight: '700', fill: '#e2c393', track: 2 });
    },
  };
}

function womens(): Cell {
  return {
    name: 'womens',
    w: 512,
    h: 88,
    draw: (g, w, h) => {
      board(g, w, h, MX.purple, MX.yellow, 5, 7);
      text(g, "THE WOMEN'S BUILDING", w / 2, h / 2, w * 0.88, h * 0.5, { family: HEAVY, fill: MX.yellow, track: 4 });
    },
  };
}

function culturalCenter(): Cell {
  return {
    name: 'mccla',
    w: 576,
    h: 96,
    draw: (g, w, h) => {
      board(g, w, h, MX.ink, MX.marigold, 5, 7);
      text(g, 'MISSION CULTURAL CENTER', w / 2, h * 0.38, w * 0.86, h * 0.36, { family: HEAVY, fill: MX.marigold, track: 3 });
      text(g, 'FOR LATINO ARTS', w / 2, h * 0.76, w * 0.5, h * 0.2, { family: SANS, weight: '900', fill: '#ffffff', track: 6 });
    },
  };
}

/** A blade sign: a vertical-ish board readable along the street. */
function blade(name: string, words: string, bg: string, fg: string, deco?: 'skull' | 'pinata' | 'cone' | 'taco'): Cell {
  return {
    name,
    w: 192,
    h: 144,
    draw: (g, w, h) => {
      board(g, w, h, bg, fg, 4, 6);
      if (deco === 'skull') calavera(g, w / 2, h * 0.36, h * 0.4, MX.magenta);
      else if (deco === 'pinata') starPinata(g, w / 2, h * 0.36, h * 0.24);
      else if (deco === 'cone') {
        g.fillStyle = '#d9a35b';
        g.beginPath();
        g.moveTo(w / 2 - 18, h * 0.38);
        g.lineTo(w / 2 + 18, h * 0.38);
        g.lineTo(w / 2, h * 0.62);
        g.fill();
        g.fillStyle = MX.pink;
        g.beginPath();
        g.arc(w / 2, h * 0.32, 22, 0, Math.PI * 2);
        g.fill();
      } else if (deco === 'taco') {
        g.fillStyle = '#f1c27d';
        g.beginPath();
        g.arc(w / 2, h * 0.44, h * 0.2, Math.PI, 2 * Math.PI);
        g.fill();
        g.fillStyle = '#4caf50';
        g.fillRect(w / 2 - h * 0.17, h * 0.4, h * 0.34, h * 0.05);
        g.fillStyle = MX.red;
        g.fillRect(w / 2 - h * 0.12, h * 0.35, h * 0.24, h * 0.05);
      }
      text(g, words, w / 2, deco ? h * 0.8 : h / 2, w * 0.86, deco ? h * 0.26 : h * 0.5, { family: HEAVY, fill: fg });
    },
  };
}

/** A seven-pointed star piñata, flat. */
function starPinata(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const cols = [MX.magenta, MX.yellow, MX.turquoise, MX.orange, MX.lime, MX.purple, MX.red];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 - Math.PI / 2;
    g.fillStyle = cols[k];
    g.beginPath();
    g.moveTo(x + Math.cos(a - 0.25) * r * 0.5, y + Math.sin(a - 0.25) * r * 0.5);
    g.lineTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3);
    g.lineTo(x + Math.cos(a + 0.25) * r * 0.5, y + Math.sin(a + 0.25) * r * 0.5);
    g.fill();
  }
  g.fillStyle = MX.pink;
  g.beginPath();
  g.arc(x, y, r * 0.6, 0, Math.PI * 2);
  g.fill();
}

// ---------------------------------------------------------------------------------------------
// Murals

/** Wavy bands of colour filling the cell (the ground most murals are painted over). */
function bands(g: CanvasRenderingContext2D, w: number, h: number, cols: string[], waves = 2): void {
  const n = cols.length;
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[i];
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const y = (h * (i + 0.6)) / n + Math.sin((x / w) * Math.PI * waves + i * 1.3) * h * 0.05;
      g.lineTo(x, y);
    }
    g.lineTo(w, h);
    g.fill();
  }
}

/** The sun: an Aztec sun stone's rays and face over hills of corn. */
function muralSun(): Cell {
  return {
    name: 'muralSun',
    w: 384,
    h: 240,
    draw: (g, w, h) => {
      bands(g, w, h, ['#ffcf56', MX.orange, MX.red, MX.magenta, MX.purple], 1.5);
      sunburst(g, w * 0.5, h * 0.42, h * 0.42, [MX.yellow, MX.marigold], 20);
      g.fillStyle = MX.orange;
      g.beginPath();
      g.arc(w * 0.5, h * 0.42, h * 0.22, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = MX.yellow;
      g.beginPath();
      g.arc(w * 0.5, h * 0.42, h * 0.16, 0, Math.PI * 2);
      g.fill();
      // A face.
      g.fillStyle = MX.ink;
      for (const dx of [-0.05, 0.05]) {
        g.beginPath();
        g.ellipse(w * (0.5 + dx), h * 0.39, 7, 5, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillRect(w * 0.48, h * 0.48, w * 0.04, 5);
      // Corn along the bottom.
      for (let x = 20; x < w; x += 46) {
        g.fillStyle = MX.jade;
        g.beginPath();
        g.moveTo(x, h);
        g.quadraticCurveTo(x - 20, h * 0.78, x - 6, h * 0.66);
        g.quadraticCurveTo(x + 2, h * 0.8, x + 6, h);
        g.fill();
        g.fillStyle = MX.yellow;
        g.beginPath();
        g.ellipse(x + 8, h * 0.8, 6, 16, 0.2, 0, Math.PI * 2);
        g.fill();
      }
      greca(g, 0, 0, w, 20, MX.ink, MX.yellow);
    },
  };
}

/** The Virgen de Guadalupe: her starry mantle in the golden rays, roses at her feet. */
function muralVirgen(): Cell {
  return {
    name: 'muralVirgen',
    w: 240,
    h: 384,
    draw: (g, w, h) => {
      board(g, w, h, MX.cobalt);
      // The rays.
      g.save();
      g.translate(w / 2, h * 0.48);
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * Math.PI * 2;
        g.strokeStyle = k % 2 ? MX.yellow : MX.marigold;
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(Math.cos(a) * w * 0.2, Math.sin(a) * h * 0.26);
        g.lineTo(Math.cos(a) * w * 0.46, Math.sin(a) * h * 0.44);
        g.stroke();
      }
      g.restore();
      // The mantle, the robe, the face.
      g.fillStyle = MX.green;
      g.beginPath();
      g.moveTo(w * 0.5, h * 0.18);
      g.quadraticCurveTo(w * 0.24, h * 0.3, w * 0.28, h * 0.78);
      g.lineTo(w * 0.72, h * 0.78);
      g.quadraticCurveTo(w * 0.76, h * 0.3, w * 0.5, h * 0.18);
      g.fill();
      g.fillStyle = MX.pink;
      g.beginPath();
      g.moveTo(w * 0.5, h * 0.3);
      g.quadraticCurveTo(w * 0.38, h * 0.5, w * 0.4, h * 0.78);
      g.lineTo(w * 0.6, h * 0.78);
      g.quadraticCurveTo(w * 0.62, h * 0.5, w * 0.5, h * 0.3);
      g.fill();
      g.fillStyle = '#c68a64';
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.27, w * 0.06, h * 0.045, 0.15, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = MX.yellow;
      for (let k = 0; k < 14; k++) {
        g.beginPath();
        g.arc(w * (0.33 + ((k * 37) % 34) / 100), h * (0.3 + ((k * 53) % 44) / 100), 3, 0, Math.PI * 2);
        g.fill();
      }
      // The crescent moon and the roses.
      g.fillStyle = MX.ink;
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.8, w * 0.22, h * 0.04, 0, 0, Math.PI);
      g.fill();
      for (let k = 0; k < 7; k++) flower(g, w * (0.18 + k * 0.11), h * 0.9, 14, MX.red, MX.chili);
    },
  };
}

/** Flowers and birds over bright bands. */
function muralFlowers(): Cell {
  return {
    name: 'muralFlowers',
    w: 384,
    h: 240,
    draw: (g, w, h) => {
      bands(g, w, h, [MX.turquoise, MX.lime, MX.yellow, MX.pink], 3);
      const cols = [MX.magenta, MX.red, MX.orange, MX.purple, MX.blue];
      for (let k = 0; k < 14; k++) flower(g, ((k * 97) % 100) * (w / 100), h * (0.15 + ((k * 61) % 70) / 100), 18 + (k % 3) * 8, cols[k % cols.length]);
      bird(g, w * 0.3, h * 0.35, 46, MX.green, MX.turquoise);
      bird(g, w * 0.72, h * 0.28, 40, MX.red, MX.marigold);
      for (let k = 0; k < 4; k++) heart(g, w * (0.12 + k * 0.25), h * 0.72, 20, MX.red);
    },
  };
}

/** Día de los Muertos: calaveras among marigolds. */
function muralCalavera(): Cell {
  return {
    name: 'muralCalavera',
    w: 384,
    h: 240,
    draw: (g, w, h) => {
      board(g, w, h, MX.purple);
      bands(g, w, h, [MX.purple, MX.magenta, MX.orange], 2);
      for (let k = 0; k < 18; k++) marigold(g, ((k * 59) % 100) * (w / 100), h * (0.08 + ((k * 37) % 90) / 100), 12 + (k % 3) * 5);
      calavera(g, w * 0.3, h * 0.48, h * 0.42, MX.turquoise);
      calavera(g, w * 0.7, h * 0.5, h * 0.38, MX.yellow);
      text(g, 'DÍA DE LOS MUERTOS', w / 2, h * 0.9, w * 0.8, h * 0.13, { family: HEAVY, fill: MX.yellow, stroke: MX.ink, strokeW: 4 });
    },
  };
}

/** A feathered serpent along Aztec frets. */
function muralQuetzal(): Cell {
  return {
    name: 'muralQuetzal',
    w: 384,
    h: 240,
    draw: (g, w, h) => {
      board(g, w, h, MX.jade);
      greca(g, 0, 0, w, 24, MX.yellow, MX.red);
      greca(g, 0, h - 24, w, 24, MX.yellow, MX.red);
      // The serpent's body: a fat sine wave with scales.
      g.lineCap = 'round';
      g.strokeStyle = MX.turquoise;
      g.lineWidth = 34;
      g.beginPath();
      for (let x = 30; x <= w - 60; x += 6) {
        const y = h * 0.5 + Math.sin((x / w) * Math.PI * 3) * h * 0.18;
        if (x === 30) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      g.strokeStyle = MX.yellow;
      g.lineWidth = 6;
      g.stroke();
      // The head and its plumes.
      const hx = w - 50;
      const hy = h * 0.5 + Math.sin(((w - 60) / w) * Math.PI * 3) * h * 0.18;
      g.fillStyle = MX.turquoise;
      g.beginPath();
      g.ellipse(hx, hy, 34, 26, 0, 0, Math.PI * 2);
      g.fill();
      for (let k = 0; k < 6; k++) {
        g.fillStyle = [MX.green, MX.lime, MX.red][k % 3];
        g.beginPath();
        g.ellipse(hx - 20, hy - 30 - k * 4, 40, 8, -0.9 + k * 0.25, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = MX.ink;
      g.beginPath();
      g.arc(hx + 10, hy - 6, 5, 0, Math.PI * 2);
      g.fill();
    },
  };
}

/** A woman with flowers in her hair. */
function muralWoman(): Cell {
  return {
    name: 'muralWoman',
    w: 240,
    h: 300,
    draw: (g, w, h) => {
      board(g, w, h, MX.yellow);
      sunburst(g, w / 2, h * 0.45, h * 0.6, [MX.yellow, MX.marigold], 28);
      g.fillStyle = MX.ink;
      g.beginPath();
      g.ellipse(w / 2, h * 0.36, w * 0.3, h * 0.24, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#b97a52';
      g.beginPath();
      g.ellipse(w / 2, h * 0.46, w * 0.2, h * 0.2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(w * 0.43, h * 0.6, w * 0.14, h * 0.14);
      g.fillStyle = MX.red;
      g.beginPath();
      g.ellipse(w / 2, h * 0.88, w * 0.36, h * 0.18, 0, Math.PI, 2 * Math.PI);
      g.fill();
      g.fillStyle = MX.ink;
      for (const dx of [-0.07, 0.07]) {
        g.beginPath();
        g.ellipse(w * (0.5 + dx), h * 0.43, 8, 5, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillRect(w * 0.4, h * 0.38, w * 0.2, 4);
      g.fillStyle = '#a3172b';
      g.beginPath();
      g.ellipse(w / 2, h * 0.54, 12, 5, 0, 0, Math.PI * 2);
      g.fill();
      for (let k = 0; k < 6; k++) flower(g, w * (0.26 + k * 0.1), h * (0.16 + (k % 2) * 0.04), 22, [MX.red, MX.magenta, MX.orange][k % 3], MX.yellow);
    },
  };
}

/** A candy-painted lowrider, three-wheel motion, on a garage door. */
function muralLowrider(): Cell {
  return {
    name: 'muralLowrider',
    w: 384,
    h: 216,
    draw: (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#2a0845');
      sky.addColorStop(1, MX.magenta);
      board(g, w, h, sky);
      // The car, nose up on its hydraulics.
      g.save();
      g.translate(w * 0.5, h * 0.62);
      g.rotate(-0.12);
      g.fillStyle = '#b5179e';
      g.beginPath();
      g.moveTo(-w * 0.38, 10);
      g.lineTo(-w * 0.36, -24);
      g.lineTo(-w * 0.16, -30);
      g.lineTo(-w * 0.08, -62);
      g.lineTo(w * 0.14, -62);
      g.lineTo(w * 0.22, -30);
      g.lineTo(w * 0.38, -24);
      g.lineTo(w * 0.4, 10);
      g.fill();
      g.fillStyle = '#9fd3ff';
      g.fillRect(-w * 0.06, -56, w * 0.18, 24);
      g.strokeStyle = '#f2f2f2';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(-w * 0.36, -6);
      g.lineTo(w * 0.38, -6);
      g.stroke();
      for (const x of [-w * 0.24, w * 0.24]) {
        g.fillStyle = MX.ink;
        g.beginPath();
        g.arc(x, 12, 24, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#e8e8ea';
        g.beginPath();
        g.arc(x, 12, 15, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      text(g, 'LOW & SLOW', w / 2, h * 0.14, w * 0.7, h * 0.18, { family: SCRIPT, weight: '700', fill: MX.yellow, stroke: MX.ink, strokeW: 4 });
    },
  };
}

/** The MaestraPeace mural, as near as paint and a few shapes get it: women's faces and hands
 *  round the building, a goddess figure, flowers, rainbows of colour, names of women in gold. */
function maestraPeace(name: string, seed: number): Cell {
  return {
    name,
    w: 512,
    h: 384,
    draw: (g, w, h) => {
      bands(g, w, h, [MX.purple, MX.blue, MX.turquoise, MX.yellow, MX.orange, MX.magenta], 2.5);
      const skins = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#6b3e26'];
      const hair = [MX.ink, '#3b2416', MX.purple, MX.cobalt];
      // Faces: big ones, in profile and full.
      for (let k = 0; k < 5; k++) {
        const x = w * (0.12 + ((k * 0.21 + seed * 0.07) % 0.8));
        const y = h * (0.28 + ((k * 0.37 + seed * 0.11) % 0.5));
        const r = h * (0.12 + ((k + seed) % 3) * 0.04);
        g.fillStyle = hair[(k + seed) % hair.length];
        g.beginPath();
        g.ellipse(x, y - r * 0.2, r * 1.15, r * 1.25, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = skins[(k + seed) % skins.length];
        g.beginPath();
        g.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = MX.ink;
        for (const dx of [-0.3, 0.3]) {
          g.beginPath();
          g.ellipse(x + dx * r, y - r * 0.12, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = '#a3172b';
        g.beginPath();
        g.ellipse(x, y + r * 0.45, r * 0.22, r * 0.08, 0, 0, Math.PI * 2);
        g.fill();
      }
      // Hands, raised.
      for (let k = 0; k < 4; k++) {
        const x = w * (0.08 + k * 0.28);
        const y = h * 0.86;
        g.fillStyle = skins[(k + 2 + seed) % skins.length];
        g.fillRect(x - 14, y - 40, 28, 50);
        for (let f = 0; f < 4; f++) g.fillRect(x - 14 + f * 7, y - 66, 6, 28);
        g.fillRect(x + 14, y - 34, 14, 8);
      }
      for (let k = 0; k < 10; k++) flower(g, w * ((k * 0.11 + seed * 0.05) % 1), h * (0.06 + ((k * 0.17) % 0.2)), 14, [MX.red, MX.pink, MX.yellow][k % 3]);
      g.globalAlpha = 0.9;
      text(g, 'MAESTRAPEACE', w / 2, h * 0.08, w * 0.6, h * 0.08, { family: HEAVY, fill: MX.yellow, track: 6 });
      g.globalAlpha = 1;
    },
  };
}

/** An ofrenda in a shop window: the altar's tiers, candles, marigolds, calaveras, photos. */
function ofrenda(): Cell {
  return {
    name: 'ofrenda',
    w: 288,
    h: 192,
    draw: (g, w, h) => {
      board(g, w, h, '#2b0f3a');
      // Papel picado along the top.
      for (let k = 0; k < 8; k++) {
        g.fillStyle = [MX.magenta, MX.orange, MX.yellow, MX.turquoise][k % 4];
        g.fillRect(k * (w / 8) + 3, 6, w / 8 - 6, 30);
      }
      for (let tier = 0; tier < 3; tier++) {
        const y = h * (0.55 + tier * 0.15);
        g.fillStyle = tier % 2 ? '#f6efe0' : MX.magenta;
        g.fillRect(w * (0.1 + tier * 0.05), y, w * (0.8 - tier * 0.1), h * 0.1);
      }
      for (let k = 0; k < 7; k++) {
        const x = w * (0.16 + k * 0.11);
        g.fillStyle = '#f6efe0';
        g.fillRect(x - 5, h * 0.42, 10, 26);
        g.fillStyle = MX.yellow;
        g.beginPath();
        g.ellipse(x, h * 0.4, 5, 9, 0, 0, Math.PI * 2);
        g.fill();
      }
      calavera(g, w * 0.3, h * 0.6, 40, MX.turquoise);
      calavera(g, w * 0.7, h * 0.6, 40, MX.magenta);
      for (let k = 0; k < 9; k++) marigold(g, w * (0.1 + k * 0.1), h * 0.92, 11);
      for (let k = 0; k < 3; k++) {
        g.fillStyle = '#e8dcc4';
        g.fillRect(w * (0.42 + k * 0.06), h * 0.22, 18, 24);
        g.fillStyle = '#5a4a3c';
        g.fillRect(w * (0.42 + k * 0.06) + 3, h * 0.22 + 3, 12, 18);
      }
    },
  };
}

/** Luchador masks in a shop window. */
function luchas(): Cell {
  return {
    name: 'luchas',
    w: 288,
    h: 192,
    draw: (g, w, h) => {
      board(g, w, h, '#f1e3c6');
      const cols: [string, string][] = [
        [MX.red, MX.yellow],
        [MX.blue, '#ffffff'],
        [MX.green, MX.pink],
        [MX.ink, '#d4af37'],
        [MX.purple, MX.lime],
        ['#ffffff', MX.red],
      ];
      cols.forEach(([a, b], k) => {
        const x = w * (0.18 + (k % 3) * 0.32);
        const y = h * (0.3 + Math.floor(k / 3) * 0.42);
        g.fillStyle = a;
        g.beginPath();
        g.ellipse(x, y, 34, 44, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = b;
        for (const dx of [-13, 13]) {
          g.beginPath();
          g.ellipse(x + dx, y - 6, 11, 8, dx > 0 ? 0.4 : -0.4, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = MX.ink;
        for (const dx of [-13, 13]) {
          g.beginPath();
          g.ellipse(x + dx, y - 6, 6, 4, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = b;
        g.fillRect(x - 3, y - 40, 6, 30);
        g.beginPath();
        g.ellipse(x, y + 22, 9, 6, 0, 0, Math.PI * 2);
        g.fill();
      });
      text(g, '¡LUCHA LIBRE!', w / 2, h * 0.95, w * 0.6, h * 0.1, { family: HEAVY, fill: MX.red });
    },
  };
}

/** Quinceañera dresses in a window. */
function quinceWindow(): Cell {
  return {
    name: 'quinceWindow',
    w: 288,
    h: 192,
    draw: (g, w, h) => {
      board(g, w, h, '#fdf2f8');
      const cols = [MX.pink, '#a5d8ff', '#e9d5ff', MX.turquoise];
      cols.forEach((c, k) => {
        const x = w * (0.14 + k * 0.24);
        g.fillStyle = '#f1c27d';
        g.beginPath();
        g.arc(x, h * 0.16, 12, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = c;
        g.beginPath();
        g.moveTo(x - 14, h * 0.24);
        g.lineTo(x + 14, h * 0.24);
        g.lineTo(x + 10, h * 0.42);
        g.quadraticCurveTo(x + 60, h * 0.8, x + 44, h * 0.94);
        g.lineTo(x - 44, h * 0.94);
        g.quadraticCurveTo(x - 60, h * 0.8, x - 10, h * 0.42);
        g.fill();
        g.fillStyle = '#ffffff';
        for (let j = 0; j < 6; j++) {
          g.beginPath();
          g.arc(x - 30 + j * 12, h * 0.9, 4, 0, Math.PI * 2);
          g.fill();
        }
      });
    },
  };
}

/** A painted roll-down gate: frets and a sun, over corrugations. */
function shutter(name: string, a: string, b: string): Cell {
  return {
    name,
    w: 192,
    h: 144,
    draw: (g, w, h) => {
      board(g, w, h, a);
      sunburst(g, w / 2, h * 0.55, h * 0.45, [a, b], 16);
      greca(g, 0, h - 22, w, 22, b, a);
      g.globalAlpha = 0.18;
      g.fillStyle = MX.ink;
      for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 2);
      g.globalAlpha = 1;
    },
  };
}

/** Every cell the Mission's atlas holds. */
export function missionCells(): Cell[] {
  return [
    { name: 'white', w: 16, h: 16, draw: (g, w, h) => board(g, w, h, '#ffffff') },
    farolito(),
    laTaqueria(),
    cancun(),
    laVictoria(),
    newMission(),
    marquee(),
    bart(),
    calle24(),
    flagMX(),
    tartine(),
    biRite(),
    creamery(),
    dandelion(),
    womens(),
    culturalCenter(),
    shop('carniceria', MX.red, '#ffffff', { rim: '#ffffff' }),
    shop('lavanderia', MX.blue, '#ffffff', { rim: MX.yellow }),
    shop('paleteria', MX.pink, '#ffffff', { stroke: MX.magenta, rim: '#ffffff' }),
    shop('pinatas', MX.yellow, MX.magenta, { rim: MX.turquoise, deco: (g, w, h) => zigzag(g, 8, h - 20, w - 16, 12, [MX.magenta, MX.turquoise, MX.orange]) }),
    shop('joyeria', MX.ink, '#d4af37', { rim: '#d4af37', family: SERIF }),
    shop('envios', MX.green, '#ffffff', { rim: MX.red }),
    shop('discos', MX.orange, MX.ink, { rim: MX.ink, family: SLAB }),
    shop('zapateria', MX.brown, MX.cream, { rim: MX.cream, family: SLAB }),
    shop('panaderia', MX.cream, MX.chili, { rim: MX.chili, family: SERIF }),
    shop('mercado', MX.lime, MX.ink, { rim: MX.red }),
    shop('llantera', MX.yellow, MX.ink, { rim: MX.ink }),
    shop('lowrider', '#2a0845', MX.yellow, { rim: MX.magenta, family: SCRIPT }),
    shop('mariscos', MX.turquoise, '#ffffff', { rim: MX.blue, stroke: MX.cobalt }),
    shop('tortilleria', MX.marigold, MX.brown, { rim: MX.brown }),
    shop('quince', '#fdf2f8', MX.magenta, { rim: MX.pink, family: SCRIPT }),
    shop('western', MX.brown, MX.yellow, { rim: MX.yellow, family: SLAB }),
    shop('farmacia', '#ffffff', MX.jade, { rim: MX.jade }),
    shop('dulceria', MX.magenta, MX.yellow, { rim: MX.yellow, family: ROUND }),
    shop('granTaco', MX.chili, MX.yellow, { rim: MX.yellow }),
    shop('cafe', MX.brown, MX.marigold, { rim: MX.marigold, family: SERIF }),
    shop('musica', MX.purple, MX.yellow, { rim: MX.yellow }),
    shop('celulares', '#0d47a1', '#ffffff', { rim: MX.yellow }),
    shop('floreria', MX.pink, MX.jade, { rim: MX.jade, family: SERIF }),
    blade('bladeTaco', 'TACOS', MX.yellow, MX.red, 'taco'),
    blade('bladePinata', 'PIÑATAS', MX.turquoise, MX.ink, 'pinata'),
    blade('bladeSkull', 'ARTE', MX.purple, MX.yellow, 'skull'),
    blade('bladeNieves', 'NIEVES', MX.cream, MX.magenta, 'cone'),
    blade('bladeFarolito', 'TACOS', MX.red, MX.yellow, 'taco'),
    muralSun(),
    muralVirgen(),
    muralFlowers(),
    muralCalavera(),
    muralQuetzal(),
    muralWoman(),
    muralLowrider(),
    maestraPeace('maestra1', 1),
    maestraPeace('maestra2', 4),
    ofrenda(),
    luchas(),
    quinceWindow(),
    shutter('shutterA', MX.turquoise, MX.yellow),
    shutter('shutterB', MX.magenta, MX.orange),
    shutter('shutterC', MX.green, MX.pink),
  ];
}

// ---------------------------------------------------------------------------------------------
// Papel picado

/** The papel picado's colours (one flag each, cut the same way but for its pattern). */
export const PAPEL_COLORS = [MX.magenta, MX.orange, MX.yellow, MX.lime, MX.turquoise, MX.blue, MX.purple, MX.red];

/** One flag's cell size (px) on the papel picado canvas, and how many patterns per colour. */
export const PAPEL_W = 128;
export const PAPEL_H = 160;
export const PAPEL_KINDS = 3;

/**
 * The papel picado: one canvas, a row of flags per pattern (a flower, a calavera, a dove), a column
 * per colour, each flag cut out (transparent holes) with a scalloped bottom edge and a fold at the
 * top where it hangs over its string.
 */
export function papelCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = PAPEL_W * PAPEL_COLORS.length;
  canvas.height = PAPEL_H * PAPEL_KINDS;
  const g = canvas.getContext('2d')!;
  for (let kind = 0; kind < PAPEL_KINDS; kind++) {
    PAPEL_COLORS.forEach((col, i) => {
      const x0 = i * PAPEL_W;
      const y0 = kind * PAPEL_H;
      const w = PAPEL_W;
      const h = PAPEL_H;
      g.save();
      g.translate(x0, y0);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(4, 0);
      g.lineTo(w - 4, 0);
      g.lineTo(w - 4, h - 22);
      // The scalloped bottom.
      const n = 6;
      for (let k = n; k > 0; k--) {
        const xa = 4 + ((w - 8) * k) / n;
        const xb = 4 + ((w - 8) * (k - 1)) / n;
        g.quadraticCurveTo((xa + xb) / 2, h, xb, h - 22);
      }
      g.closePath();
      g.fill();
      // The cuts.
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = '#000000';
      // A border of little diamonds.
      for (let x = 14; x < w - 10; x += 14) {
        g.beginPath();
        g.moveTo(x, 18);
        g.lineTo(x + 4, 13);
        g.lineTo(x + 8, 18);
        g.lineTo(x + 4, 23);
        g.fill();
      }
      const cx = w / 2;
      const cy = h * 0.5;
      if (kind === 0) {
        // A flower.
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          g.beginPath();
          g.ellipse(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, 12, 6, a, 0, Math.PI * 2);
          g.fill();
        }
        g.beginPath();
        g.arc(cx, cy, 8, 0, Math.PI * 2);
        g.fill();
      } else if (kind === 1) {
        // A calavera's eyes, nose and teeth.
        for (const dx of [-14, 14]) {
          g.beginPath();
          g.arc(cx + dx, cy - 8, 10, 0, Math.PI * 2);
          g.fill();
        }
        g.beginPath();
        g.moveTo(cx, cy + 2);
        g.lineTo(cx - 5, cy + 12);
        g.lineTo(cx + 5, cy + 12);
        g.fill();
        for (let k = -2; k <= 2; k++) g.fillRect(cx + k * 8 - 3, cy + 20, 6, 10);
      } else {
        // A dove.
        g.beginPath();
        g.ellipse(cx, cy, 26, 10, -0.2, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(cx - 6, cy - 4);
        g.quadraticCurveTo(cx - 20, cy - 36, cx + 14, cy - 30);
        g.quadraticCurveTo(cx + 2, cy - 14, cx + 6, cy - 4);
        g.fill();
      }
      // Holes round about.
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        g.beginPath();
        g.arc(cx + Math.cos(a) * 44, cy + Math.sin(a) * 40, 4, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    });
  }
  g.globalCompositeOperation = 'source-over';
  return canvas;
}

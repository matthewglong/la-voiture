// Race HUD: per-car cards (position, speed, the boost bottle, HYPE, the two item slots and status
// flashes; in a lap race the lap and the race clock), a strip showing where the cars are on the
// course, the countdown with a controls card, name tags over the cars, and the results. Racing solo
// there's one card, split times against the best run and the ghost's marker on the strip.
import type { ModeRules } from '../modes';
import type { ItemKind } from '../sim/race';
import type { PlayerIndex } from '../types';
import { renderWind } from './build';
import { fmtTime } from './format';

export interface CarHudState {
  speedKmh: number;
  /** Boost left in the bottle (0..1); firing; being topped up by a drift. */
  boostFrac: number;
  boosting: boolean;
  charging: boolean;
  wheelspin: boolean;
  phase: 'grid' | 'race' | 'flight' | 'splashed' | 'finished' | 'dnf';
  distance: number;
  /** A race: the lap being driven (1-based) and the race time (or the finishing time once home). */
  lap: number;
  raceTime: number;
  /** 0..100. */
  hype: number;
  /** Launch-speed bonus the HYPE is worth right now (0..0.15). */
  hypeBonus: number;
  /** Held items and which one the item key uses. */
  items: ItemKind[];
  sel: number;
  roulette: boolean;
  grit: boolean;
  /** A seagull has hold of the car. */
  gull: boolean;
  /** 1-based race position, and the gap to the other car in metres (+ ahead). */
  position: number;
  gap: number | null;
  wrongWay: boolean;
  /** Seconds left to reach the lip or the flag (the straggler clock), or null. */
  clock: number | null;
  /** The kicker once it has started to drop (its angle in degrees, and whether it's still coming
   *  down), shown while this car still has to get there; null before that. */
  ramp: { deg: number; moving: boolean } | null;
}

/** Key labels shown on a card (or null: the CPU drives it). */
export interface HudKeys {
  item: string;
  swap: string;
  boost: string;
}

export interface ResultRow {
  name: string;
  color: string;
  /** A race: the time home (or out), the laps done, the best of them, where it finished. */
  race?: { time: number; laps: number; bestLap: number | null; place: number; finished: boolean };
  distance: number;
  dnf: boolean;
  launchKmh: number;
  /** Share of the boost bottle still unspent at the lip. */
  boostLeft: number;
  airTime: number;
  runTime: number;
  /** HYPE's launch bonus. */
  hypeBonus: number;
  /** The kicker's angle at launch (degrees), or null racing solo (always the full ramp). */
  ramp: number | null;
  awards: string[];
  wins: number;
}

/** What the HUD needs to know about the event in play. */
export interface HudEvent {
  rules: ModeRules;
  /** Laps to race; a loop shows the lap counter. */
  laps: number;
  loop: boolean;
  /** Where the run ends ("the lip", "the flag"), for the straggler's clock. */
  goal: string;
  /** Where the wind forecast applies ("on the straight"), if not everywhere. */
  windWhere?: string;
  /** The controls card's tip, and its warning line (shown racing two, not solo). */
  tip?: string;
  warn?: string;
}

export interface ResultsView {
  rules: ModeRules;
  /** The map's name, its laps, whether it's a loop, and where the run ends ("the lip"). */
  map: string;
  laps: number;
  loop: boolean;
  goal: string;
  rows: ResultRow[];
  winner: PlayerIndex | null;
  round: number;
  wind: number;
  /** The session's best: the furthest jump, or a race's fastest lap (distance holds its time). */
  best: { distance: number; name: string; round: number } | null;
  newRecord: boolean;
  /** Racing alone: where the run started, and the best from there before this run (a race: the
   *  best time). */
  solo?: { start: string; prevBest: number | null; splits: { label: string; delta: number | null }[] };
}

type FlashKind = 'spin' | 'empty' | 'waste' | 'dnf' | 'air' | 'hit' | 'good' | 'hype' | 'item' | 'boost' | 'ramp';

export const ITEM_ICONS: Record<ItemKind, string> = { jump: '🦘', grit: '😤', poo: '💩', topup: '⚡', refill: '🌟', gull: '🐦', crab: '🦀', ipo: '🪙' };
export const ITEM_LABELS: Record<ItemKind, string> = {
  jump: 'JUMP',
  grit: 'DETERMINATION',
  poo: 'POO',
  topup: 'BOOST +50%',
  refill: 'FULL BOOST',
  gull: 'SEAGULL',
  crab: 'CRAB',
  ipo: 'IPO COIN',
};
/** One line per item for the controls card. */
export const ITEM_HELP: [ItemKind, string][] = [
  ['jump', 'Jump: hop over trouble, or a low hedge'],
  ['grit', 'Determination: plough through the next thing'],
  ['poo', 'Poo: drop it for your rival'],
  ['topup', 'Boost +50%: refills half the bottle'],
  ['refill', 'Full boost (rare): a full bottle'],
  ['gull', 'Seagull: swoops on the leader, carries them up and drops them'],
  ['crab', 'Crab: scuttles straight down the road and nips who it meets (hold brake: throw it back)'],
  ['ipo', 'IPO coin (well behind): ride it to the moon, through everything'],
];
const ROULETTE = ['🦘', '😤', '💩', '⚡', '🐦', '🦀', '🌟', '🪙'];

interface SlotRefs {
  root: HTMLElement;
  icon: HTMLElement;
  key: HTMLElement;
  last: string;
}

interface CarRefs {
  root: HTMLElement;
  name: HTMLElement;
  pos: HTMLElement;
  speed: HTMLElement;
  dist: HTMLElement;
  split: HTMLElement;
  /** A race: LAP 2/3. */
  lap: HTMLElement;
  boostRow: HTMLElement;
  gauge: HTMLElement;
  boostKey: HTMLElement;
  hype: HTMLElement;
  hypeVal: HTMLElement;
  slots: [SlotRefs, SlotRefs];
  sel: number;
  flashes: HTMLElement;
  spin: HTMLElement;
  wrong: HTMLElement;
  clock: HTMLElement;
  ramp: HTMLElement;
  timed: Map<string, { el: HTMLElement; until: number }>;
  /** Name tags: one for each pane the car might show up in. */
  tags: [HTMLElement, HTMLElement];
  dot: HTMLElement;
  splitUntil: number;
  /** Poo splats over the player's view. */
  blind: HTMLElement;
}

/** A closed, lumpy blob through `n` points jittered around a circle (a Catmull-Rom loop as Béziers). */
function blobPath(cx: number, cy: number, r: number, n: number, lumpy: number, arms: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + (Math.random() - 0.5) * 0.6) / n) * Math.PI * 2;
    // Now and then a point flung well out: a splash arm.
    const k = Math.random() < arms ? 1.3 + Math.random() * 0.45 : 1 + (Math.random() - 0.5) * lumpy;
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]);
  }
  const f = (v: number): string => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [pts[(i + n - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
    d +=
      `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return `${d}Z`;
}

/**
 * Poo thrown at the windscreen, the way ink hits you in Mario Kart: a handful of big glossy splats
 * with flecks and drips, and clear glass between them. Random each time; sized for a w x h pane.
 */
function splatter(w: number, h: number): SVGSVGElement {
  const s = Math.min(w, h);
  const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
  // One big splat near the middle, then one in most cells of a 3 x 2 grid.
  const spots: [number, number, number][] = [[w * rnd(0.38, 0.62), h * rnd(0.35, 0.6), s * rnd(0.2, 0.25)]];
  for (let gy = 0; gy < 2; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      if (Math.random() < 0.25) continue;
      spots.push([w * ((gx + rnd(0.2, 0.8)) / 3), h * (0.08 + (gy + rnd(0.15, 0.85)) * 0.4), s * rnd(0.09, 0.17)]);
    }
  }
  let out = '';
  spots.forEach(([x, y, r], i) => {
    let bits = `<path d="${blobPath(x, y, r, 16, 0.3, 0.2)}"/>`;
    // Flecks flung out around it.
    for (let j = 0, m = 4 + Math.floor(Math.random() * 6); j < m; j++) {
      const a = Math.random() * Math.PI * 2;
      const dd = r * rnd(1.15, 1.9);
      const fr = r * rnd(0.04, 0.12);
      bits += `<path d="${blobPath(x + Math.cos(a) * dd, y + Math.sin(a) * dd, fr, 6, 0.4, 0)}"/>`;
    }
    // Drips running down from its lower edge.
    let drips = '';
    for (let j = 0, m = Math.floor(rnd(0, 3)); j < m; j++) {
      const dx = x + r * rnd(-0.6, 0.6);
      const top = y + r * 0.5;
      const len = r * rnd(0.6, 1.4);
      const dw = r * rnd(0.05, 0.09);
      drips +=
        `<g class="drip" style="animation-delay:${rnd(0.2, 1).toFixed(2)}s">` +
        `<rect x="${(dx - dw).toFixed(1)}" y="${top.toFixed(1)}" width="${(dw * 2).toFixed(1)}" height="${len.toFixed(1)}" rx="${dw.toFixed(1)}"/>` +
        `<circle cx="${dx.toFixed(1)}" cy="${(top + len).toFixed(1)}" r="${(dw * 1.5).toFixed(1)}"/></g>`;
    }
    // A glossy sheen and a glint up and to the left.
    const shine =
      `<path class="sheen" d="${blobPath(x - r * 0.12, y - r * 0.15, r * 0.62, 10, 0.3, 0)}"/>` +
      `<ellipse class="glint" cx="${(x - r * 0.35).toFixed(1)}" cy="${(y - r * 0.4).toFixed(1)}" ` +
      `rx="${(r * 0.16).toFixed(1)}" ry="${(r * 0.09).toFixed(1)}" transform="rotate(-30 ${(x - r * 0.35).toFixed(1)} ${(y - r * 0.4).toFixed(1)})"/>`;
    out +=
      `<g class="splat" style="--slide:${(h * rnd(0.03, 0.08)).toFixed(1)}px;animation-delay:${(i * 0.04).toFixed(2)}s,0s">` +
      `${drips}${bits}${shine}</g>`;
  });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${w.toFixed(0)} ${h.toFixed(0)}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.innerHTML = out;
  return svg;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  parent?: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

const ORD = ['1ST', '2ND'];

/** A split against the best run: −0.42s ahead, +0.42s behind. */
function fmtDelta(d: number): string {
  if (Math.abs(d) < 0.005) return '±0.00s';
  return `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}s`;
}


export class HUD {
  readonly root: HTMLElement;
  private readonly cars: [CarRefs, CarRefs];
  private readonly wind: HTMLElement;
  private readonly countdown: HTMLElement;
  private readonly help: HTMLElement;
  private readonly strip: HTMLElement;
  private readonly ghostDot: HTMLElement;
  private readonly progress: [number, number] = [0, 0];
  private readonly callout: HTMLElement;
  private results: HTMLElement | null = null;
  private solo = false;
  private ev: HudEvent | null = null;
  private laps = 1;
  private readonly marks: HTMLElement[] = [];
  private readonly line: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud overlay hidden', parent);
    const top = el('div', 'topbar', this.root);
    this.wind = el('div', 'wind small', top);
    this.wind.id = 'hud-wind';
    this.strip = el('div', 'course-strip', top);
    const line = el('div', 'line', this.strip);
    this.line = line;
    this.ghostDot = el('span', 'car ghost hidden', line, '👻');
    this.ghostDot.title = 'Your best run';
    this.cars = [this.makeCar(0, line), this.makeCar(1, line)];
    this.countdown = el('div', 'countdown', this.root);
    this.countdown.id = 'countdown';
    this.help = el('div', 'drive-help hidden', this.root);
    this.callout = el('div', 'callout', this.root);
  }

  private makeSlot(parent: HTMLElement, cls: string): SlotRefs {
    const root = el('div', `islot ${cls}`, parent);
    const icon = el('span', 'icon', root);
    const key = el('span', 'key', root);
    return { root, icon, key, last: '' };
  }

  /** The landmarks along the course strip (at: 0..1 of the way along, or round a lap). */
  setStrip(marks: { label: string; at: number }[]): void {
    for (const m of this.marks) m.remove();
    this.marks.length = 0;
    marks.forEach((m, i) => {
      const mk = el('span', `mark ${i % 2 ? 'up' : ''}`, this.line, m.label);
      mk.style.left = `${m.at * 100}%`;
      this.line.prepend(mk);
      this.marks.push(mk);
    });
  }

  private makeCar(p: PlayerIndex, line: HTMLElement): CarRefs {
    // (Before the panel, so the splat sits under the HUD.)
    const blind = el('div', 'blind hidden', this.root);
    const root = el('div', `hud-car p${p + 1}`, this.root);
    root.id = `hud-p${p + 1}`;
    const who = el('div', 'who', root);
    el('span', 'dot', who);
    const name = el('span', 'nm', who);
    const pos = el('span', 'pos', who);
    const main = el('div', 'main', root);
    const left = el('div', 'left', main);
    const row = el('div', 'row', left);
    const speed = el('div', 'speed', row);
    const dist = el('div', 'dist hidden', row);
    const split = el('div', 'split hidden', row);
    const lap = el('div', 'lapc hidden', row);
    const boostRow = el('div', 'meter boost', left);
    el('span', '', boostRow, 'BOOST');
    const g = el('div', 'gauge', boostRow);
    const gauge = el('i', '', g);
    const boostKey = el('kbd', '', boostRow);
    const hypeRow = el('div', 'meter hype', left);
    el('span', '', hypeRow, 'HYPE');
    const hg = el('div', 'gauge', hypeRow);
    const hype = el('i', '', hg);
    const hypeVal = el('b', 'hv', hypeRow);
    const slotsWrap = el('div', 'islots', main);
    const slots: [SlotRefs, SlotRefs] = [this.makeSlot(slotsWrap, 'first'), this.makeSlot(slotsWrap, 'second')];
    const flashes = el('div', 'flashes', root);
    const spin = el('span', 'flash spin hidden', flashes, 'WHEELSPIN!');
    const wrong = el('span', 'flash dnf hidden', flashes, 'WRONG WAY!');
    const clock = el('div', 'clock hidden', root);
    const ramp = el('div', 'ramp-warn hidden', root);
    const tags: [HTMLElement, HTMLElement] = [el('div', 'tag3d hidden', this.root), el('div', 'tag3d hidden', this.root)];
    const dot = el('span', 'car', line);
    return {
      root,
      name,
      pos,
      speed,
      dist,
      split,
      lap,
      boostRow,
      gauge,
      boostKey,
      hype,
      hypeVal,
      slots,
      sel: 0,
      flashes,
      spin,
      wrong,
      clock,
      ramp,
      timed: new Map(),
      tags,
      dot,
      splitUntil: 0,
      blind,
    };
  }

  show(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  setup(names: [string, string], colors: [string, string], wind: number, keys: [HudKeys | null, HudKeys | null], solo: boolean, ev: HudEvent): void {
    this.solo = solo;
    this.ev = ev;
    this.laps = ev.laps;
    renderWind(this.wind, wind, 'WIND', ev.windWhere);
    this.root.classList.toggle('solo', solo);
    this.root.classList.toggle('no-hype', !ev.rules.hype);
    this.ghostDot.classList.add('hidden');
    for (const p of [0, 1] as PlayerIndex[]) {
      const c = this.cars[p];
      const k = keys[p];
      c.root.style.setProperty('--pc', colors[p]);
      for (const t of c.tags) {
        t.style.setProperty('--pc', colors[p]);
        t.textContent = names[p];
      }
      c.dot.style.setProperty('--pc', colors[p]);
      c.dot.textContent = `P${p + 1}`;
      c.dot.classList.toggle('hidden', solo && p === 1);
      c.name.textContent = names[p];
      c.speed.innerHTML = '0<small>km/h</small>';
      c.dist.classList.add('hidden');
      c.speed.classList.remove('hidden');
      c.split.classList.add('hidden');
      c.lap.classList.toggle('hidden', !ev.loop);
      c.lap.textContent = '';
      c.splitUntil = 0;
      c.gauge.style.width = '100%';
      c.boostKey.textContent = k ? k.boost : '';
      c.boostKey.classList.toggle('hidden', !k);
      c.hype.style.width = '0%';
      c.hypeVal.textContent = '';
      c.slots[0].key.textContent = k ? k.item : 'CPU';
      c.slots[1].key.textContent = k ? `${k.swap} ⇄` : '';
      c.slots[1].root.title = k ? `Two items held: ${k.swap} picks which one ${k.item} uses` : '';
      for (const s of c.slots) {
        s.icon.textContent = '';
        s.root.className = `islot ${s === c.slots[0] ? 'first' : 'second'}`;
        s.last = '';
      }
      c.sel = 0;
      c.spin.classList.add('hidden');
      c.wrong.classList.add('hidden');
      c.clock.classList.add('hidden');
      c.ramp.classList.add('hidden');
      c.pos.textContent = '';
      c.root.classList.remove('grit', 'gull', 'done', 'hot', 'firing');
      for (const t of c.timed.values()) t.el.remove();
      c.timed.clear();
    }
  }

  update(p: PlayerIndex, s: CarHudState, now: number, progress: number): void {
    const c = this.cars[p];
    c.speed.innerHTML = `${Math.round(s.speedKmh)}<small>km/h</small>`;
    c.gauge.style.width = `${Math.max(0, Math.min(1, s.boostFrac)) * 100}%`;
    c.boostRow.classList.toggle('firing', s.boosting);
    c.boostRow.classList.toggle('charging', s.charging && s.boostFrac < 0.999);
    c.boostRow.classList.toggle('full', s.boostFrac >= 0.999 && s.phase === 'race');
    c.boostRow.classList.toggle('empty', s.boostFrac <= 0.001 && s.phase === 'race');
    c.root.classList.toggle('firing', s.boosting);
    c.hype.style.width = `${Math.max(0, Math.min(100, s.hype))}%`;
    c.hypeVal.textContent = s.hypeBonus > 0.004 ? `+${Math.round(s.hypeBonus * 100)}%` : '';
    c.root.classList.toggle('hot', s.hype >= 70);
    c.spin.classList.toggle('hidden', !s.wheelspin || s.phase !== 'race');
    c.wrong.classList.toggle('hidden', !s.wrongWay || s.phase !== 'race');
    const flying = s.phase === 'flight' || s.phase === 'splashed';
    const home = s.phase === 'finished';
    c.dist.classList.toggle('hidden', !flying && !home);
    c.speed.classList.toggle('hidden', flying || home);
    if (flying) c.dist.innerHTML = `${s.distance.toFixed(1)}<small>m</small>`;
    if (home) c.dist.textContent = fmtTime(s.raceTime);
    if (this.ev?.loop) {
      const text = home ? `${ORD[s.position - 1] ?? ''} 🏁` : s.lap >= this.laps ? `FINAL LAP` : `LAP ${Math.max(1, s.lap)}/${this.laps}`;
      if (c.lap.textContent !== text) c.lap.textContent = text;
      c.lap.classList.toggle('final', !home && s.lap >= this.laps);
    }
    if (c.splitUntil > 0 && now > c.splitUntil) {
      c.split.classList.add('hidden');
      c.splitUntil = 0;
    }
    // Position and the gap.
    if (s.phase === 'race' && !this.solo) {
      const gap = s.gap === null ? '' : s.gap >= 0 ? ` +${Math.round(s.gap)}m` : ` ${Math.round(s.gap)}m`;
      c.pos.textContent = `${ORD[s.position - 1] ?? ''}${s.gap !== null && Math.abs(s.gap) >= 1 ? gap : ''}`;
      c.pos.className = `pos p${s.position}`;
    } else c.pos.textContent = '';
    // Item slots: the one the item key uses first, the other beside it. A roulette spins in the slot
    // the new item will land in.
    const sel = Math.min(s.sel, Math.max(0, s.items.length - 1));
    const shown: (ItemKind | null)[] = [s.items[sel] ?? null, s.items.length > 1 ? s.items[1 - sel] : null];
    const rouletteIn = s.roulette ? (s.items.length === 0 ? 0 : 1) : -1;
    const swapped = s.items.length > 1 && sel !== c.sel;
    c.sel = sel;
    c.slots.forEach((slot, i) => {
      const item = shown[i];
      const key = i === rouletteIn ? 'roulette' : (item ?? '');
      if (key !== slot.last || swapped) {
        slot.last = key;
        slot.root.className = `islot ${i === 0 ? 'first' : 'second'} ${i === rouletteIn ? 'spinning' : item ? 'has' : ''} ${swapped ? 'swap' : ''}`;
        if (i !== rouletteIn) slot.icon.textContent = item ? ITEM_ICONS[item] : '';
        slot.root.title = item ? ITEM_LABELS[item] : i === 0 ? 'Item' : slot.root.title;
      }
      if (i === rouletteIn) slot.icon.textContent = ROULETTE[Math.floor(now * 14 + i * 3) % ROULETTE.length];
    });
    c.root.classList.toggle('two', s.items.length > 1);
    c.root.classList.toggle('grit', s.grit);
    c.root.classList.toggle('gull', s.gull);
    c.root.classList.toggle('done', s.phase !== 'race' && s.phase !== 'grid');
    // The straggler's clock.
    const clock = s.phase === 'race' && s.clock !== null && s.clock < 20;
    c.clock.classList.toggle('hidden', !clock);
    if (clock && s.clock !== null) c.clock.textContent = `⏱ ${Math.ceil(s.clock)}s to ${this.ev?.goal ?? 'the finish'}!`;
    // The kicker dropping in front of a car that's still on its way to it.
    const ramp = s.phase === 'race' && s.ramp !== null;
    c.ramp.classList.toggle('hidden', !ramp);
    if (ramp && s.ramp !== null) c.ramp.textContent = `⚠ RAMP ${s.ramp.moving ? 'DROPPING' : 'DOWN'} · ${Math.round(s.ramp.deg)}°`;
    // Course strip: the two markers step apart (P1 up, P2 down) when they meet.
    this.progress[p] = Math.max(0, Math.min(1, progress));
    c.dot.style.left = `${this.progress[p] * 100}%`;
    const close = !this.solo && Math.abs(this.progress[0] - this.progress[1]) < 0.035;
    for (const q of [0, 1] as const) this.cars[q].dot.classList.toggle(q === 0 ? 'hi' : 'lo', close);
    for (const [k, t] of c.timed) {
      if (t.until > 0 && now > t.until) {
        t.el.remove();
        c.timed.delete(k);
      }
    }
  }

  /** The ghost's place on the course strip (solo), or null to hide it. */
  setGhost(progress: number | null): void {
    this.ghostDot.classList.toggle('hidden', progress === null);
    if (progress !== null) this.ghostDot.style.left = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  }

  /** A split time against the best run, beside the speed (solo). */
  split(p: PlayerIndex, label: string, delta: number | null, now: number): void {
    const c = this.cars[p];
    c.split.classList.remove('hidden', 'ahead', 'behind', 'first');
    void c.split.offsetWidth;
    if (delta === null) {
      c.split.textContent = label;
      c.split.classList.add('first');
    } else {
      c.split.textContent = `${label} ${fmtDelta(delta)}`;
      c.split.classList.add(delta <= 0 ? 'ahead' : 'behind');
    }
    c.splitUntil = now + 3;
  }

  /** Show a status flash; duration 0 keeps it until the next setup(). */
  flash(p: PlayerIndex, key: string, text: string, kind: FlashKind, now: number, duration: number): void {
    const c = this.cars[p];
    c.timed.get(key)?.el.remove();
    const f = el('span', `flash ${kind}`, c.flashes, text);
    f.dataset.flash = key;
    c.timed.set(key, { el: f, until: duration > 0 ? now + duration : 0 });
    // Keep the card from growing without end: at most four timed flashes.
    const keys = [...c.timed.keys()];
    while (keys.length > 4) {
      const k = keys.shift()!;
      c.timed.get(k)?.el.remove();
      c.timed.delete(k);
    }
  }

  /** Big words over the cars (OVERTAKE!...), stacked so two at once don't overlap. */
  private readonly shouts: { el: HTMLElement; p: PlayerIndex; slot: number }[] = [];

  /** A big word over a player's car, in their colour. It rides along with the car (placeShouts). */
  shout(p: PlayerIndex, text: string, color: string): void {
    const used = new Set(this.shouts.filter((q) => q.p === p).map((q) => q.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    const s = el('div', 'shout', this.callout, text);
    s.style.setProperty('--pc', color);
    s.style.left = '-9999px';
    const entry = { el: s, p, slot };
    this.shouts.push(entry);
    s.addEventListener('animationend', () => {
      s.remove();
      this.shouts.splice(this.shouts.indexOf(entry), 1);
    });
  }

  /** Every frame: keep a player's shouts just above their name tag (hidden with it). */
  placeShouts(p: PlayerIndex, x: number, y: number, visible: boolean): void {
    for (const q of this.shouts) {
      if (q.p !== p) continue;
      q.el.style.visibility = visible ? '' : 'hidden';
      q.el.style.left = `${x}px`;
      q.el.style.top = `${y - 46 - q.slot * 40}px`;
    }
  }

  /**
   * Poo on a player's windscreen over their part of the screen (amount 0..1, the splats' opacity;
   * null pane hides it). Each new hit throws new splats.
   */
  setBlind(p: PlayerIndex, pane: { x: number; y: number; w: number; h: number } | null, amount: number): void {
    const b = this.cars[p].blind;
    const on = pane !== null && amount > 0.001;
    // A fresh hit throws a fresh set of splats.
    if (on && b.classList.contains('hidden')) b.replaceChildren(splatter(pane.w, pane.h));
    b.classList.toggle('hidden', !on);
    if (!on) return;
    b.style.left = `${pane.x}px`;
    b.style.top = `${pane.y}px`;
    b.style.width = `${pane.w}px`;
    b.style.height = `${pane.h}px`;
    b.style.opacity = amount.toFixed(3);
  }

  setTag(p: PlayerIndex, pane: 0 | 1, x: number, y: number, visible: boolean): void {
    const t = this.cars[p].tags[pane];
    t.classList.toggle('hidden', !visible);
    if (visible) {
      t.style.left = `${x}px`;
      t.style.top = `${y}px`;
    }
  }

  hideTags(): void {
    for (const c of this.cars) for (const t of c.tags) t.classList.add('hidden');
  }

  showCountdown(text: string | null): void {
    this.countdown.replaceChildren();
    if (!text) return;
    const s = el('span', text === 'GO!' ? 'go' : '', this.countdown, text);
    s.dataset.count = text;
  }

  /**
   * The controls card shown during the countdown: each driver's keys (or "the computer drives"),
   * the items, and the tips. `lines` holds the key chips per player, or null for the CPU.
   */
  showHelp(
    visible: boolean,
    lines?: [{ label: string; keys: string }[] | null, { label: string; keys: string }[] | null],
    colors?: [string, string],
    names?: [string, string],
    opts: { solo?: boolean; items?: ItemKind[] } = {},
  ): void {
    this.help.classList.toggle('hidden', !visible);
    if (!visible || !lines || !colors || !names) return;
    this.help.replaceChildren();
    for (const p of [0, 1] as PlayerIndex[]) {
      if (opts.solo && p === 1) continue;
      const row = el('div', 'hl', this.help);
      row.style.setProperty('--pc', colors[p]);
      el('b', '', row, names[p]);
      const ks = lines[p];
      if (!ks) {
        el('span', '', row, 'the computer drives');
        continue;
      }
      const keys = el('span', 'ks', row);
      for (const k of ks) {
        const it = el('span', 'k', keys);
        el('kbd', '', it, k.keys);
        it.append(k.label);
      }
    }
    const items = el('div', 'items', this.help);
    for (const [kind, text] of ITEM_HELP) {
      if (opts.items && !opts.items.includes(kind)) continue;
      const it = el('span', 'it', items);
      el('b', '', it, ITEM_ICONS[kind]);
      it.append(text);
    }
    const ev = this.ev;
    if (ev?.tip) el('div', 'tip', this.help, `${ev.loop && ev.laps > 1 ? `${ev.laps} laps · ` : ''}${ev.tip}`);
    // The map's own warning, else the mode's (the dropping kicker only matters racing two).
    if (ev?.warn) el('div', 'tip ramp', this.help, ev.warn);
    else if (ev?.rules.warn && !opts.solo) el('div', 'tip ramp', this.help, ev.rules.warn);
  }

  showResults(v: ResultsView, actions: { label: string; primary?: boolean; id: string; key?: string; onClick: () => void }[]): void {
    this.hideResults();
    const r = el('div', 'results', this.root);
    r.id = 'results';
    const solo = v.solo;
    const row0 = v.rows[0];
    // Scored on time (a race) or on distance (the long jump): the mode's rules say how to show it.
    const race = v.rules.score === 'time';
    const fmt = (x: number): string => v.rules.format(x);
    const title = solo
      ? row0.dnf
        ? `Never made ${v.goal}`
        : fmt(race ? (row0.race?.time ?? 0) : row0.distance)
      : v.winner === null
        ? v.rows.every((x) => x.dnf)
          ? 'Nobody made it!'
          : "It's a tie!"
        : `${v.rows[v.winner].name} wins!`;
    const h = el('h1', '', r, title);
    if (solo) h.style.color = row0.color;
    else if (v.winner !== null) h.style.color = v.rows[v.winner].color;
    const windKmh = Math.round(Math.abs(v.wind) * 3.6);
    const windText = windKmh === 0 ? 'calm' : `${windKmh} km/h ${v.wind < 0 ? 'headwind' : 'tailwind'}`;
    const event = v.loop ? `${v.map}, ${v.laps} laps` : v.map;
    // Solo: how this run compares with the best before it (further is better in the long jump,
    // quicker in a race).
    const score = race ? (row0.race?.time ?? 0) : row0.distance;
    const better = (a: number, b: number): boolean => v.rules.better(a, b);
    el(
      'div',
      'sub',
      r,
      solo
        ? `Solo ${race ? 'at' : 'from'} ${solo.start} · ${event} · ${windText}${
            row0.dnf ? '' : solo.prevBest === null ? ' · first run from here' : better(score, solo.prevBest) ? ` · new best (was ${fmt(solo.prevBest)})` : ` · best ${fmt(solo.prevBest)}`
          }`
        : `Round ${v.round} · ${event} · ${windText} · ${v.rows[0].name} ${v.rows[0].wins} – ${v.rows[1].wins} ${v.rows[1].name}`,
    );
    const rows = el('div', 'rows', r);
    const order: PlayerIndex[] = solo ? [0] : v.winner === 1 ? [1, 0] : [0, 1];
    for (const p of order) {
      const row = v.rows[p];
      const div = el('div', 'row', rows);
      div.dataset.player = String(p);
      div.style.setProperty('--pc', row.color);
      if (v.winner === p || (solo && v.newRecord)) div.classList.add('win');
      const done = race ? '🏁' : '🌊';
      el('div', 'medal', div, solo ? (row.dnf ? '💥' : v.newRecord ? '🏆' : done) : v.winner === p ? '🏆' : row.dnf ? '💥' : done);
      const mid = el('div', '', div);
      const nm = el('div', 'nm', mid);
      el('i', '', nm);
      nm.append(row.name);
      const boostNote = row.boostLeft >= 0.01 ? ` · ${Math.round(row.boostLeft * 100)}% boost unspent` : '';
      const rr = row.race;
      const line = v.loop ? 'across the line' : `to ${v.goal}`;
      el(
        'div',
        'det',
        mid,
        rr
          ? v.loop
            ? `${rr.finished ? (solo ? `${v.laps} laps` : `${rr.place === 1 ? 'First' : 'Second'} ${line}`) : `Out after ${rr.laps} of ${v.laps} laps`}${rr.bestLap !== null ? ` · best lap ${fmtTime(rr.bestLap)}` : ''}`
            : rr.finished
              ? `${solo ? 'Home' : `${rr.place === 1 ? 'First' : 'Second'} ${line}`}${row.airTime > 0 ? ` · ${Math.round(row.launchKmh)} km/h off the kicker, ${row.airTime.toFixed(1)} s in the air` : ''}`
              : `Never made ${v.goal}`
          : row.dnf
            ? 'Never reached the lip'
            : `Lip in ${row.runTime.toFixed(1)} s at ${Math.round(row.launchKmh)} km/h${row.hypeBonus > 0.004 ? ` (HYPE +${Math.round(row.hypeBonus * 100)}%)` : ''}${row.ramp === null ? '' : ` · ramp ${Math.round(row.ramp)}°`} · ${row.airTime.toFixed(1)} s in the air${boostNote}`,
      );
      if (row.awards.length) {
        const aw = el('div', 'awards', mid);
        for (const a of row.awards) el('span', 'award', aw, a);
      }
      const d = el('div', `d ${row.dnf ? 'dnf' : ''}`, div, row.dnf ? 'DNF' : rr ? fmtTime(rr.time) : `${row.distance.toFixed(1)} m`);
      d.dataset.distance = row.dnf ? 'DNF' : rr ? rr.time.toFixed(2) : row.distance.toFixed(2);
    }
    if (solo && solo.splits.some((s) => s.delta !== null)) {
      const sp = el('div', 'splits', r);
      el('span', 'lbl', sp, 'vs best run');
      for (const s of solo.splits) {
        if (s.delta === null) continue;
        el('span', `sp ${s.delta <= 0 ? 'ahead' : 'behind'}`, sp, `${s.label} ${fmtDelta(s.delta)}`);
      }
    }
    const best = el('div', 'best', r);
    best.id = 'session-best';
    if (v.best) {
      // A solo race keeps the best run (all its laps); a race of laps between two, the fastest lap.
      const what = race ? (solo ? 'best run' : v.loop ? 'session best lap' : 'session best') : 'session best';
      best.append(v.newRecord ? `🎉 New ${what}: ` : `${what[0].toUpperCase()}${what.slice(1)}: `);
      el('b', '', best, fmt(v.best.distance));
      best.append(solo ? ` ${race ? 'at' : 'from'} ${solo.start}` : ` by ${v.best.name} (round ${v.best.round})`);
    } else {
      best.textContent = 'No session best yet';
    }
    const bar = el('div', 'actions', r);
    for (const a of actions) {
      const b = el('button', `btn ${a.primary ? 'primary' : ''}`, bar, a.label);
      if (a.key) el('kbd', '', b, a.key);
      b.id = a.id;
      b.addEventListener('click', a.onClick);
    }
    this.results = r;
  }

  hideResults(): void {
    this.results?.remove();
    this.results = null;
  }

  /** Hide the per-car HUD cards (the results card replaces them). Racing solo, P2's stays hidden. */
  showCars(visible: boolean): void {
    this.cars.forEach((c, p) => c.root.classList.toggle('hidden', !visible || (this.solo && p === 1)));
    this.strip.classList.toggle('hidden', !visible);
  }
}

// Race HUD: per-car cards (position, speed, fuel, HYPE, the item slot and status flashes), a strip
// showing where both cars are on the course, the countdown with a controls card, name tags over the
// cars, and the results.
import type { ItemKind } from '../sim/race';
import type { PlayerIndex } from '../types';
import { renderWind } from './build';

export interface CarHudState {
  speedKmh: number;
  fuelFrac: number;
  wheelspin: boolean;
  phase: 'grid' | 'race' | 'flight' | 'splashed' | 'dnf';
  distance: number;
  /** 0..100. */
  hype: number;
  /** Launch-speed bonus the HYPE is worth right now (0..0.15). */
  boost: number;
  item: ItemKind | null;
  roulette: boolean;
  grit: boolean;
  /** 1-based race position, and the gap to the other car in metres (+ ahead). */
  position: number;
  gap: number | null;
  wrongWay: boolean;
  /** Seconds left to reach the lip (the straggler clock), or null. */
  clock: number | null;
}

export interface ResultRow {
  name: string;
  color: string;
  distance: number;
  dnf: boolean;
  launchKmh: number;
  wastedFuelFrac: number;
  airTime: number;
  runTime: number;
  boost: number;
  awards: string[];
  wins: number;
}

export interface ResultsView {
  rows: [ResultRow, ResultRow];
  winner: PlayerIndex | null;
  round: number;
  wind: number;
  best: { distance: number; name: string; round: number } | null;
  newRecord: boolean;
}

type FlashKind = 'spin' | 'empty' | 'waste' | 'dnf' | 'air' | 'hit' | 'good' | 'hype' | 'item';

export const ITEM_ICONS: Record<ItemKind, string> = { jump: '🦘', grit: '😤', poo: '💩' };
export const ITEM_LABELS: Record<ItemKind, string> = { jump: 'JUMP', grit: 'DETERMINATION', poo: 'POO' };
const ROULETTE = ['🦘', '😤', '💩'];

interface CarRefs {
  root: HTMLElement;
  name: HTMLElement;
  pos: HTMLElement;
  speed: HTMLElement;
  dist: HTMLElement;
  gauge: HTMLElement;
  hype: HTMLElement;
  hypeVal: HTMLElement;
  item: HTMLElement;
  itemIcon: HTMLElement;
  itemKey: HTMLElement;
  flashes: HTMLElement;
  spin: HTMLElement;
  wrong: HTMLElement;
  clock: HTMLElement;
  timed: Map<string, { el: HTMLElement; until: number }>;
  /** Name tags: one for each pane the car might show up in. */
  tags: [HTMLElement, HTMLElement];
  dot: HTMLElement;
  lastItem: string;
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

export class HUD {
  readonly root: HTMLElement;
  private readonly cars: [CarRefs, CarRefs];
  private readonly wind: HTMLElement;
  private readonly countdown: HTMLElement;
  private readonly help: HTMLElement;
  private readonly strip: HTMLElement;
  private readonly progress: [number, number] = [0, 0];
  private readonly callout: HTMLElement;
  private results: HTMLElement | null = null;

  constructor(parent: HTMLElement, marks: { label: string; at: number }[]) {
    this.root = el('div', 'hud overlay hidden', parent);
    const top = el('div', 'topbar', this.root);
    this.wind = el('div', 'wind small', top);
    this.wind.id = 'hud-wind';
    this.strip = el('div', 'course-strip', top);
    const line = el('div', 'line', this.strip);
    marks.forEach((m, i) => {
      const mk = el('span', `mark ${i % 2 ? 'up' : ''}`, line, m.label);
      mk.style.left = `${m.at * 100}%`;
    });
    this.cars = [this.makeCar(0, line), this.makeCar(1, line)];
    this.countdown = el('div', 'countdown', this.root);
    this.countdown.id = 'countdown';
    this.help = el('div', 'drive-help hidden', this.root);
    this.callout = el('div', 'callout', this.root);
  }

  private makeCar(p: PlayerIndex, line: HTMLElement): CarRefs {
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
    const fuel = el('div', 'meter fuel', left);
    el('span', '', fuel, 'FUEL');
    const g = el('div', 'gauge', fuel);
    const gauge = el('i', '', g);
    const hypeRow = el('div', 'meter hype', left);
    el('span', '', hypeRow, 'HYPE');
    const hg = el('div', 'gauge', hypeRow);
    const hype = el('i', '', hg);
    const hypeVal = el('b', 'hv', hypeRow);
    const item = el('div', 'islot', main);
    item.title = 'Item';
    const itemIcon = el('span', 'icon', item);
    const itemKey = el('span', 'key', item);
    const flashes = el('div', 'flashes', root);
    const spin = el('span', 'flash spin hidden', flashes, 'WHEELSPIN!');
    const wrong = el('span', 'flash dnf hidden', flashes, 'WRONG WAY!');
    const clock = el('div', 'clock hidden', root);
    const tags: [HTMLElement, HTMLElement] = [el('div', 'tag3d hidden', this.root), el('div', 'tag3d hidden', this.root)];
    const dot = el('span', 'car', line);
    return {
      root,
      name,
      pos,
      speed,
      dist,
      gauge,
      hype,
      hypeVal,
      item,
      itemIcon,
      itemKey,
      flashes,
      spin,
      wrong,
      clock,
      timed: new Map(),
      tags,
      dot,
      lastItem: '',
    };
  }

  show(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  setup(names: [string, string], colors: [string, string], wind: number, itemKeys: [string, string]): void {
    renderWind(this.wind, wind, 'WIND');
    for (const p of [0, 1] as PlayerIndex[]) {
      const c = this.cars[p];
      c.root.style.setProperty('--pc', colors[p]);
      for (const t of c.tags) {
        t.style.setProperty('--pc', colors[p]);
        t.textContent = names[p];
      }
      c.dot.style.setProperty('--pc', colors[p]);
      c.dot.textContent = `P${p + 1}`;
      c.name.textContent = names[p];
      c.speed.innerHTML = '0<small>km/h</small>';
      c.dist.classList.add('hidden');
      c.speed.classList.remove('hidden');
      c.gauge.style.width = '100%';
      c.hype.style.width = '0%';
      c.hypeVal.textContent = '';
      c.itemKey.textContent = itemKeys[p];
      c.itemIcon.textContent = '';
      c.item.className = 'islot';
      c.lastItem = '';
      c.spin.classList.add('hidden');
      c.wrong.classList.add('hidden');
      c.clock.classList.add('hidden');
      c.pos.textContent = '';
      for (const t of c.timed.values()) t.el.remove();
      c.timed.clear();
    }
  }

  update(p: PlayerIndex, s: CarHudState, now: number, progress: number): void {
    const c = this.cars[p];
    c.speed.innerHTML = `${Math.round(s.speedKmh)}<small>km/h</small>`;
    c.gauge.style.width = `${Math.max(0, Math.min(1, s.fuelFrac)) * 100}%`;
    c.hype.style.width = `${Math.max(0, Math.min(100, s.hype))}%`;
    c.hypeVal.textContent = s.boost > 0.004 ? `+${Math.round(s.boost * 100)}%` : '';
    c.root.classList.toggle('hot', s.hype >= 70);
    c.spin.classList.toggle('hidden', !s.wheelspin || s.phase !== 'race');
    c.wrong.classList.toggle('hidden', !s.wrongWay || s.phase !== 'race');
    const flying = s.phase === 'flight' || s.phase === 'splashed';
    c.dist.classList.toggle('hidden', !flying);
    c.speed.classList.toggle('hidden', flying);
    if (flying) c.dist.innerHTML = `${s.distance.toFixed(1)}<small>m</small>`;
    // Position and the gap.
    if (s.phase === 'race') {
      const gap = s.gap === null ? '' : s.gap >= 0 ? ` +${Math.round(s.gap)}m` : ` ${Math.round(s.gap)}m`;
      c.pos.textContent = `${ORD[s.position - 1] ?? ''}${s.gap !== null && Math.abs(s.gap) >= 1 ? gap : ''}`;
      c.pos.className = `pos p${s.position}`;
    } else c.pos.textContent = '';
    // Item slot.
    const key = s.roulette ? 'roulette' : s.item ?? '';
    if (key !== c.lastItem) {
      c.lastItem = key;
      c.item.className = `islot ${s.roulette ? 'spinning' : s.item ? 'has' : ''}`;
      if (!s.roulette) c.itemIcon.textContent = s.item ? ITEM_ICONS[s.item] : '';
      c.item.title = s.item ? ITEM_LABELS[s.item] : 'Item';
    }
    if (s.roulette) c.itemIcon.textContent = ROULETTE[Math.floor(now * 14) % ROULETTE.length];
    c.root.classList.toggle('grit', s.grit);
    c.root.classList.toggle('done', s.phase !== 'race' && s.phase !== 'grid');
    // The straggler's clock.
    const clock = s.phase === 'race' && s.clock !== null && s.clock < 20;
    c.clock.classList.toggle('hidden', !clock);
    if (clock && s.clock !== null) c.clock.textContent = `⏱ ${Math.ceil(s.clock)}s to the lip!`;
    // Course strip: the two markers step apart (P1 up, P2 down) when they meet.
    this.progress[p] = Math.max(0, Math.min(1, progress));
    c.dot.style.left = `${this.progress[p] * 100}%`;
    const close = Math.abs(this.progress[0] - this.progress[1]) < 0.035;
    for (const q of [0, 1] as const) this.cars[q].dot.classList.toggle(q === 0 ? 'hi' : 'lo', close);
    for (const [k, t] of c.timed) {
      if (t.until > 0 && now > t.until) {
        t.el.remove();
        c.timed.delete(k);
      }
    }
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

  /** The controls card shown during the countdown. */
  showHelp(visible: boolean, lines?: [string, string], colors?: [string, string], names?: [string, string]): void {
    this.help.classList.toggle('hidden', !visible);
    if (!visible || !lines || !colors || !names) return;
    this.help.replaceChildren();
    for (const p of [0, 1] as PlayerIndex[]) {
      const row = el('div', 'hl', this.help);
      row.style.setProperty('--pc', colors[p]);
      el('b', '', row, names[p]);
      el('span', '', row, lines[p]);
    }
    const items = el('div', 'items', this.help);
    for (const [icon, text] of [
      ['🦘', 'Jump: hop over trouble, or Lombard’s hedges'],
      ['😤', 'Determination: plough through the next thing'],
      ['💩', 'Poo: drop it for your rival'],
    ]) {
      const it = el('span', 'it', items);
      el('b', '', it, icon);
      it.append(text);
    }
    el('div', 'tip', this.help, 'Hit the gas as “1” fades (or right on GO!) for a rocket start · Save some gas for the run to the kicker · Drift, fly, overtake and shove to build HYPE: it boosts your launch');
  }

  showResults(v: ResultsView, onRematch: () => void, onNewPlayers: () => void): void {
    this.hideResults();
    const r = el('div', 'results', this.root);
    r.id = 'results';
    const title =
      v.winner === null
        ? v.rows.every((x) => x.dnf)
          ? 'Nobody made it!'
          : "It's a tie!"
        : `${v.rows[v.winner].name} wins!`;
    const h = el('h1', '', r, title);
    if (v.winner !== null) h.style.color = v.rows[v.winner].color;
    const windKmh = Math.round(Math.abs(v.wind) * 3.6);
    el(
      'div',
      'sub',
      r,
      `Round ${v.round} · ${windKmh === 0 ? 'calm' : `${windKmh} km/h ${v.wind < 0 ? 'headwind' : 'tailwind'}`} · ${v.rows[0].name} ${v.rows[0].wins} – ${v.rows[1].wins} ${v.rows[1].name}`,
    );
    const rows = el('div', 'rows', r);
    const order: PlayerIndex[] = v.winner === 1 ? [1, 0] : [0, 1];
    for (const p of order) {
      const row = v.rows[p];
      const div = el('div', 'row', rows);
      div.dataset.player = String(p);
      div.style.setProperty('--pc', row.color);
      if (v.winner === p) div.classList.add('win');
      el('div', 'medal', div, v.winner === p ? '🏆' : row.dnf ? '💥' : '🌊');
      const mid = el('div', '', div);
      const nm = el('div', 'nm', mid);
      el('i', '', nm);
      nm.append(row.name);
      el(
        'div',
        'det',
        mid,
        row.dnf
          ? 'Never reached the lip'
          : `Lip in ${row.runTime.toFixed(1)} s at ${Math.round(row.launchKmh)} km/h${row.boost > 0.004 ? ` (HYPE +${Math.round(row.boost * 100)}%)` : ''} · ${row.airTime.toFixed(1)} s in the air`,
      );
      if (row.awards.length) {
        const aw = el('div', 'awards', mid);
        for (const a of row.awards) el('span', 'award', aw, a);
      }
      const d = el('div', `d ${row.dnf ? 'dnf' : ''}`, div, row.dnf ? 'DNF' : `${row.distance.toFixed(1)} m`);
      d.dataset.distance = row.dnf ? 'DNF' : row.distance.toFixed(2);
    }
    const best = el('div', 'best', r);
    best.id = 'session-best';
    if (v.best) {
      best.append(v.newRecord ? '🎉 New session best: ' : 'Session best: ');
      el('b', '', best, `${v.best.distance.toFixed(1)} m`);
      best.append(` by ${v.best.name} (round ${v.best.round})`);
    } else {
      best.textContent = 'No session best yet';
    }
    const actions = el('div', 'actions', r);
    const again = el('button', 'btn primary', actions, 'Rematch');
    again.id = 'rematch-btn';
    again.addEventListener('click', onRematch);
    const fresh = el('button', 'btn', actions, 'New players');
    fresh.id = 'newplayers-btn';
    fresh.addEventListener('click', onNewPlayers);
    this.results = r;
  }

  hideResults(): void {
    this.results?.remove();
    this.results = null;
  }

  /** Hide the per-car HUD cards (the results card replaces them). */
  showCars(visible: boolean): void {
    for (const c of this.cars) c.root.classList.toggle('hidden', !visible);
    this.strip.classList.toggle('hidden', !visible);
  }
}

// Race HUD (per-car speed, fuel, flashes, live distance), countdown, name tags and results.
import type { PlayerIndex } from '../types';
import { renderWind } from './build';

export interface CarHudState {
  speedKmh: number;
  fuelFrac: number;
  wheelspin: boolean;
  phase: 'run' | 'flight' | 'splashed' | 'dnf';
  distance: number;
}

export interface ResultRow {
  name: string;
  color: string;
  distance: number;
  dnf: boolean;
  launchKmh: number;
  wastedFuelFrac: number;
  airTime: number;
}

export interface ResultsView {
  rows: [ResultRow, ResultRow];
  winner: PlayerIndex | null;
  round: number;
  wind: number;
  best: { distance: number; name: string; round: number } | null;
  newRecord: boolean;
}

type FlashKind = 'spin' | 'empty' | 'waste' | 'dnf' | 'air';

interface CarRefs {
  root: HTMLElement;
  name: HTMLElement;
  speed: HTMLElement;
  dist: HTMLElement;
  gauge: HTMLElement;
  flashes: HTMLElement;
  spin: HTMLElement;
  timed: Map<string, { el: HTMLElement; until: number }>;
  tag: HTMLElement;
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

export class HUD {
  readonly root: HTMLElement;
  private readonly cars: [CarRefs, CarRefs];
  private readonly wind: HTMLElement;
  private readonly countdown: HTMLElement;
  private results: HTMLElement | null = null;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud overlay hidden', parent);
    const top = el('div', 'topbar', this.root);
    this.wind = el('div', 'wind small', top);
    this.wind.id = 'hud-wind';
    this.cars = [this.makeCar(0), this.makeCar(1)];
    this.countdown = el('div', 'countdown', this.root);
    this.countdown.id = 'countdown';
  }

  private makeCar(p: PlayerIndex): CarRefs {
    const root = el('div', `hud-car p${p + 1}`, this.root);
    root.id = `hud-p${p + 1}`;
    const who = el('div', 'who', root);
    el('span', 'dot', who);
    const name = el('span', '', who);
    const row = el('div', 'row', root);
    const speed = el('div', 'speed', row);
    const dist = el('div', 'dist hidden', row);
    const fuel = el('div', 'fuel', root);
    el('span', '', fuel, 'FUEL');
    const g = el('div', 'gauge', fuel);
    const gauge = el('i', '', g);
    const flashes = el('div', 'flashes', root);
    const spin = el('span', 'flash spin hidden', flashes, 'WHEELSPIN!');
    const tag = el('div', 'tag3d hidden', this.root);
    return { root, name, speed, dist, gauge, flashes, spin, timed: new Map(), tag };
  }

  show(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  setup(names: [string, string], colors: [string, string], wind: number): void {
    renderWind(this.wind, wind, 'WIND');
    for (const p of [0, 1] as PlayerIndex[]) {
      const c = this.cars[p];
      c.root.style.setProperty('--pc', colors[p]);
      c.tag.style.setProperty('--pc', colors[p]);
      c.name.textContent = names[p];
      c.tag.textContent = names[p];
      c.speed.innerHTML = '0<small>km/h</small>';
      c.dist.classList.add('hidden');
      c.speed.classList.remove('hidden');
      c.gauge.style.width = '100%';
      c.spin.classList.add('hidden');
      for (const t of c.timed.values()) t.el.remove();
      c.timed.clear();
    }
  }

  update(p: PlayerIndex, s: CarHudState, now: number): void {
    const c = this.cars[p];
    c.speed.innerHTML = `${Math.round(s.speedKmh)}<small>km/h</small>`;
    c.gauge.style.width = `${Math.max(0, Math.min(1, s.fuelFrac)) * 100}%`;
    c.spin.classList.toggle('hidden', !s.wheelspin || s.phase !== 'run');
    const flying = s.phase === 'flight' || s.phase === 'splashed';
    c.dist.classList.toggle('hidden', !flying);
    c.speed.classList.toggle('hidden', flying);
    if (flying) c.dist.innerHTML = `${s.distance.toFixed(1)}<small>m</small>`;
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
  }

  setTag(p: PlayerIndex, x: number, y: number, visible: boolean): void {
    const t = this.cars[p].tag;
    t.classList.toggle('hidden', !visible);
    if (visible) {
      t.style.left = `${x}px`;
      t.style.top = `${y}px`;
    }
  }

  showCountdown(text: string | null): void {
    this.countdown.replaceChildren();
    if (!text) return;
    const s = el('span', text === 'GO!' ? 'go' : '', this.countdown, text);
    s.dataset.count = text;
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
      `Round ${v.round} · ${windKmh === 0 ? 'calm' : `${windKmh} km/h ${v.wind < 0 ? 'headwind' : 'tailwind'}`}`,
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
          ? 'Stalled before the lip'
          : `Left the lip at ${Math.round(row.launchKmh)} km/h · ${row.airTime.toFixed(1)} s in the air · wasted ${Math.round(row.wastedFuelFrac * 100)}% fuel`,
      );
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
  }
}

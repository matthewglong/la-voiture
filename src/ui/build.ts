// Build phase UI: two player panels (P1 left, P2 right), wind forecast, draft banner, LAUNCH.
import {
  activePlayer,
  canAfford,
  currentSlot,
  displayConfig,
  isDone,
  moneyLeft,
  previousPick,
  type Draft,
} from '../draft';
import { PARTS, SLOT_LABELS, computeStats } from '../parts';
import { RHO } from '../sim/physics';
import { SLOT_ORDER, type CarConfig, type CarStats, type PlayerIndex } from '../types';

export interface BuildHandlers {
  onPick(optionIndex: number): void;
  onKeep(): void;
  /** Preview a config on a player's car (null restores the drafted car). */
  onHover(player: PlayerIndex, config: CarConfig | null): void;
  onLaunch(): void;
  onName(player: PlayerIndex, name: string): void;
}

export interface BuildView {
  draft: Draft;
  names: [string, string];
  colors: [string, string];
  wind: number;
  round: number;
}

// ---------- Stat bars ----------

const maxOf = (slot: keyof typeof PARTS, f: (o: (typeof PARTS)['chassis'][number]) => number): number =>
  Math.max(...PARTS[slot].map(f));
const sumMax = (f: (o: (typeof PARTS)['chassis'][number]) => number): number =>
  SLOT_ORDER.reduce((a, s) => a + maxOf(s, f), 0);

/** Kite lift expressed as an equivalent lift area at a typical 30 m/s launch. */
function kiteEquivalent(k: CarStats['kite']): number {
  if (!k) return 0;
  return Math.min(k.clA, k.liftCap / (0.5 * RHO * 30 * 30));
}

const RANGE = {
  mass: sumMax((o) => o.mass),
  drag: sumMax((o) => o.cdA ?? 0),
  power: maxOf('engine', (o) => o.power ?? 0),
  fuel: maxOf('fuel', (o) => o.energy ?? 0),
  grip: maxOf('wheels', (o) => o.mu ?? 0) * maxOf('chassis', (o) => o.gripMul ?? 1),
  lift:
    maxOf('chassis', (o) => o.clA ?? 0) +
    maxOf('wing', (o) => o.clA ?? 0) +
    Math.max(...PARTS.booster.map((o) => kiteEquivalent(o.kite ?? null))),
  bump: maxOf('wheels', (o) => o.bumpLoss ?? 0),
};

interface StatRow {
  key: string;
  label: string;
  /** 0..1 bar fill. */
  frac: number;
  /** Raw value for comparisons. */
  raw: number;
  text: string;
  /** Lower is better (drawn in grey). */
  cost: boolean;
}

function statRows(s: CarStats): StatRow[] {
  const lift = s.clA + kiteEquivalent(s.kite);
  return [
    { key: 'mass', label: 'Mass', frac: s.mass / RANGE.mass, raw: s.mass, text: `${Math.round(s.mass)} kg`, cost: true },
    { key: 'drag', label: 'Drag', frac: s.cdA / RANGE.drag, raw: s.cdA, text: `${s.cdA.toFixed(2)} m²`, cost: true },
    {
      key: 'power',
      label: 'Power',
      frac: Math.sqrt(s.power / RANGE.power),
      raw: s.power,
      text: `${Math.round(s.power / 1000)} kW${s.isJet ? ' jet' : ''}`,
      cost: false,
    },
    {
      key: 'fuel',
      label: 'Fuel',
      frac: Math.sqrt(s.energy / RANGE.fuel),
      raw: s.energy,
      text: `${Math.round(s.energy / 1000)} kJ`,
      cost: false,
    },
    { key: 'grip', label: 'Grip', frac: s.mu / RANGE.grip, raw: s.mu, text: `μ ${s.mu.toFixed(2)}`, cost: false },
    {
      key: 'lift',
      label: 'Lift',
      frac: lift / RANGE.lift,
      raw: lift,
      text: s.kite ? `${s.clA.toFixed(1)}+kite` : `${s.clA.toFixed(1)} m²`,
      cost: false,
    },
    {
      key: 'bump',
      label: 'Bump resist.',
      frac: 1 - (s.bumpLoss / RANGE.bump) * 0.9,
      raw: -s.bumpLoss,
      text: `−${(s.bumpLoss * 100).toFixed(s.bumpLoss < 0.01 ? 1 : 0)}%/bump`,
      cost: false,
    },
  ];
}

// ---------- DOM helpers ----------

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

export function windText(wind: number): { value: string; arrow: string; kind: 'head' | 'tail' | 'calm' } {
  const kmh = Math.round(Math.abs(wind) * 3.6);
  if (kmh === 0) return { value: 'CALM', arrow: '·', kind: 'calm' };
  return wind < 0
    ? { value: `${kmh} km/h HEADWIND`, arrow: '←', kind: 'head' }
    : { value: `${kmh} km/h TAILWIND`, arrow: '→', kind: 'tail' };
}

export function renderWind(host: HTMLElement, wind: number, label = 'WIND FORECAST'): void {
  const w = windText(wind);
  host.className = `wind ${w.kind === 'calm' ? '' : w.kind}`;
  host.replaceChildren();
  el('span', 'tag', host, label);
  el('span', 'value', host, w.value);
  el('span', 'arrow', host, w.arrow);
  host.dataset.wind = wind.toFixed(2);
}

interface PanelRefs {
  root: HTMLElement;
  name: HTMLInputElement;
  money: HTMLElement;
  stats: HTMLElement;
  statEls: Map<string, { row: HTMLElement; fill: HTMLElement; ghost: HTMLElement; val: HTMLElement }>;
  picks: HTMLElement;
  options: HTMLElement;
}

export class BuildUI {
  readonly root: HTMLElement;
  private readonly h: BuildHandlers;
  private readonly wind: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly roundChip: HTMLElement;
  private readonly launchBtn: HTMLButtonElement;
  private readonly hint: HTMLElement;
  private readonly bottom: HTMLElement;
  private readonly panels: [PanelRefs, PanelRefs];
  private view: BuildView | null = null;
  /** Stops re-rendering the option cards while the pointer is over them. */
  private optionsKey = ['', ''];

  constructor(parent: HTMLElement, handlers: BuildHandlers) {
    this.h = handlers;
    this.root = el('div', 'build-ui overlay', parent);
    const top = el('div', 'topbar', this.root);
    this.roundChip = el('div', 'round-chip', top);
    this.wind = el('div', 'wind', top);
    this.wind.id = 'wind-forecast';
    const bottom = el('div', 'bottombar', this.root);
    this.banner = el('div', 'banner', bottom);
    this.banner.id = 'draft-banner';
    this.panels = [this.makePanel(0), this.makePanel(1)];
    this.launchBtn = el('button', 'launch hidden', this.root);
    this.launchBtn.id = 'launch-btn';
    this.launchBtn.innerHTML = 'LAUNCH ▶<small>ENTER</small>';
    this.launchBtn.addEventListener('click', () => this.h.onLaunch());
    this.hint = el('div', 'title-card', bottom);
    this.bottom = bottom;
  }

  private makePanel(p: PlayerIndex): PanelRefs {
    const root = el('section', `panel p${p + 1}`, this.root);
    root.dataset.player = String(p);
    root.id = `panel-p${p + 1}`;
    const head = el('div', 'panel-head', root);
    el('div', 'dot', head, `P${p + 1}`);
    const name = el('input', '', head);
    name.type = 'text';
    // Generous box limit: cleanName() trims whitespace first, then cuts to 16 characters.
    name.maxLength = 40;
    name.spellcheck = false;
    name.id = `name-p${p + 1}`;
    name.setAttribute('aria-label', `Player ${p + 1} name`);
    name.addEventListener('input', () => this.h.onName(p, name.value));
    name.addEventListener('blur', () => {
      if (this.view) name.value = this.view.names[p];
    });
    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') name.blur();
      e.stopPropagation();
    });
    const money = el('div', 'money', head);
    money.id = `money-p${p + 1}`;

    const statsWrap = el('div', '', root);
    el('div', 'section-title', statsWrap, 'Stats');
    const stats = el('div', 'stats', statsWrap);
    const statEls = new Map<string, { row: HTMLElement; fill: HTMLElement; ghost: HTMLElement; val: HTMLElement }>();

    const picksWrap = el('div', '', root);
    el('div', 'section-title', picksWrap, 'Build so far');
    const picks = el('div', 'picks', picksWrap);
    const options = el('div', 'options', root);
    return { root, name, money, stats, statEls, picks, options };
  }

  show(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  render(view: BuildView): void {
    this.view = view;
    const d = view.draft;
    const active = activePlayer(d);
    const slot = currentSlot(d);

    this.roundChip.textContent = `ROUND ${view.round}`;
    renderWind(this.wind, view.wind);

    if (slot && active !== null) {
      this.banner.replaceChildren();
      this.banner.append(`Slot ${d.slotIndex + 1}/${SLOT_ORDER.length} · ${SLOT_LABELS[slot].toUpperCase()} · `);
      const who = el('span', 'who', this.banner, `${view.names[active]}'s pick`);
      who.style.background = view.colors[active];
      this.banner.dataset.slot = slot;
      this.banner.dataset.active = String(active);
      this.banner.classList.remove('hidden');
    } else {
      this.banner.textContent = 'Both cars are built!';
      this.banner.dataset.slot = 'done';
      this.banner.dataset.active = '';
    }
    this.launchBtn.classList.toggle('hidden', !isDone(d));
    this.bottom.classList.toggle('hidden', isDone(d));
    this.hint.textContent = isDone(d)
      ? 'Click LAUNCH (or press Enter) to race'
      : `Click a card or press 1-${Math.min(9, PARTS[slot!].length)} · M mutes`;

    for (const p of [0, 1] as PlayerIndex[]) this.renderPanel(p, view);
  }

  private renderPanel(p: PlayerIndex, view: BuildView): void {
    const d = view.draft;
    const refs = this.panels[p];
    const active = activePlayer(d);
    const isActive = active === p;
    refs.root.style.setProperty('--pc', view.colors[p]);
    refs.root.classList.toggle('active', isActive);
    refs.root.classList.toggle('dim', active !== null && !isActive);
    refs.root.dataset.active = String(isActive);
    if (document.activeElement !== refs.name) refs.name.value = view.names[p];
    const money = moneyLeft(d, p);
    refs.money.textContent = `$${money}`;
    refs.money.classList.toggle('low', money < 10);
    refs.money.dataset.money = String(money);

    this.renderStats(p, displayConfig(d, p), null);

    // Picks so far.
    refs.picks.replaceChildren();
    SLOT_ORDER.forEach((slot, i) => {
      const id = d.picks[p][slot];
      const row = el('div', 'pick', refs.picks);
      if (!id) row.classList.add('empty');
      if (i === d.slotIndex && !isDone(d)) row.classList.add('current');
      el('span', 'k', row, SLOT_LABELS[slot]);
      const opt = id ? PARTS[slot].find((o) => o.id === id) : null;
      el('span', 'v', row, opt ? opt.name : '—');
      row.dataset.slot = slot;
      row.dataset.pick = id ?? '';
    });

    // Option cards (active player only).
    const slot = currentSlot(d);
    const key = `${isActive}|${slot}|${money}|${d.slotIndex}|${d.turn}|${view.round}|${view.names.join('|')}`;
    if (key === this.optionsKey[p]) return;
    this.optionsKey[p] = key;
    refs.options.replaceChildren();
    if (!slot) {
      const w = el('div', 'waiting', refs.options);
      w.innerHTML = `<b>Ready!</b><br/>Final price $${100 - money}`;
      return;
    }
    if (!isActive) {
      const w = el('div', 'waiting', refs.options);
      const other = view.names[active ?? 0];
      w.append('Waiting for ');
      el('b', '', w, other);
      const label = SLOT_LABELS[slot].toLowerCase();
      w.append(` to pick ${/^[aeiou]/.test(label) ? 'an' : 'a'} ${label}…`);
      return;
    }
    el('div', 'section-title', refs.options, `Pick your ${SLOT_LABELS[slot].toLowerCase()}`);
    const cards = el('div', 'cards', refs.options);
    const opts = PARTS[slot];
    const simple = slot === 'paint' || slot === 'topper';
    if (simple) cards.classList.add('grid2');
    const prev = previousPick(d, p);
    opts.forEach((opt, i) => {
      const card = el('button', 'card', cards);
      card.type = 'button';
      card.dataset.optionIndex = String(i);
      card.dataset.optionId = opt.id;
      const affordable = canAfford(d, p, opt);
      card.disabled = !affordable;
      card.setAttribute('aria-disabled', String(!affordable));
      if (prev === opt.id) {
        card.classList.add('prev');
        card.dataset.prev = 'true';
      }
      if (i < 9) el('span', 'key', card, String(i + 1));
      if (slot === 'paint') {
        card.classList.add('swatch');
        const chip = el('span', 'chip', card);
        chip.style.background = opt.color ?? '#fff';
        el('span', 'name', card, opt.name);
      } else {
        if (simple) card.classList.add('compact');
        el('span', 'name', card, opt.name);
        const price = el('span', 'price', card, opt.price === 0 ? 'FREE' : `$${opt.price}`);
        if (opt.price === 0) price.classList.add('free');
        el('span', 'tagline', card, opt.tagline);
      }
      card.title = affordable ? opt.tagline : `Can't afford: $${opt.price} > $${money} left`;
      card.addEventListener('click', () => this.h.onPick(i));
      card.addEventListener('pointerenter', () => this.preview(p, opt.id));
      card.addEventListener('pointerleave', () => this.preview(p, null));
    });
    if (prev) {
      const prevOpt = opts.find((o) => o.id === prev);
      const keep = el('button', 'keep', refs.options);
      keep.id = `keep-p${p + 1}`;
      keep.type = 'button';
      keep.textContent = `Keep ${prevOpt?.name ?? prev}`;
      el('kbd', '', keep, 'ENTER');
      keep.disabled = !prevOpt || !canAfford(d, p, prevOpt);
      keep.addEventListener('click', () => this.h.onKeep());
      keep.addEventListener('pointerenter', () => this.preview(p, prev));
      keep.addEventListener('pointerleave', () => this.preview(p, null));
    }
  }

  private preview(p: PlayerIndex, optionId: string | null): void {
    const v = this.view;
    if (!v) return;
    const slot = currentSlot(v.draft);
    const base = displayConfig(v.draft, p);
    if (!slot || optionId === null) {
      this.renderStats(p, base, null);
      this.h.onHover(p, null);
      return;
    }
    const cfg = { ...base, [slot]: optionId } as CarConfig;
    this.renderStats(p, base, cfg);
    this.h.onHover(p, cfg);
  }

  private renderStats(p: PlayerIndex, cfg: CarConfig, preview: CarConfig | null): void {
    const refs = this.panels[p];
    const rows = statRows(computeStats(cfg));
    const prow = preview ? statRows(computeStats(preview)) : null;
    rows.forEach((r, i) => {
      let s = refs.statEls.get(r.key);
      if (!s) {
        const row = el('div', 'stat', refs.stats);
        if (r.cost) row.classList.add('cost');
        el('span', 'label', row, r.label);
        const bar = el('div', 'bar', row);
        const ghost = el('i', 'ghost', bar);
        const fill = el('i', 'fill', bar);
        const val = el('span', 'val', row);
        row.dataset.stat = r.key;
        s = { row, fill, ghost, val };
        refs.statEls.set(r.key, s);
      }
      const pr = prow?.[i];
      const clamp = (x: number): string => `${Math.max(0.02, Math.min(1, x)) * 100}%`;
      s.fill.style.width = clamp(pr ? Math.min(r.frac, pr.frac) : r.frac);
      s.ghost.style.width = clamp(pr ? Math.max(r.frac, pr.frac) : r.frac);
      const changed = pr && Math.abs(pr.raw - r.raw) > 1e-9;
      s.row.classList.toggle('preview', !!changed);
      s.val.textContent = pr ? pr.text : r.text;
      s.val.classList.remove('up', 'down');
      if (pr && changed) {
        const better = r.cost ? pr.raw < r.raw : pr.raw > r.raw;
        s.val.classList.add(better ? 'up' : 'down');
      }
    });
  }
}

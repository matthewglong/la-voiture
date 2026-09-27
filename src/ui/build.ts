// Build phase UI: the garage. Two player panels (P1 left, P2 right) that both players use at the
// same time: stat bars, a tab per slot showing the fitted part, the parts for the open tab, and a
// READY button. Plus the wind forecast and a status banner.
import { fittedPart, moneyAfter, moneyLeft, stockPart, swappedOut, type Garage } from '../garage';
import { PARTS, SLOT_LABELS, computeStats } from '../parts';
import { G, RHO } from '../sim/physics';
import { SLOT_ORDER, type CarConfig, type CarStats, type PartOption, type PlayerIndex, type SlotId } from '../types';

export interface BuildHandlers {
  /** A click on a part: fit it, or remove it when it is the paid part already fitted. */
  onPart(player: PlayerIndex, slot: SlotId, optionId: string): void;
  /** A click on a part the player can't afford. */
  onDenied(player: PlayerIndex): void;
  onTab(player: PlayerIndex, slot: SlotId): void;
  /** Toggle READY. */
  onReady(player: PlayerIndex): void;
  /** Preview a config on a player's car (null restores the fitted car). */
  onHover(player: PlayerIndex, config: CarConfig | null): void;
  onName(player: PlayerIndex, name: string): void;
}

export interface LastRun {
  distance: number;
  dnf: boolean;
}

export interface BuildView {
  garage: Garage;
  names: [string, string];
  colors: [string, string];
  wind: number;
  round: number;
  /** Each player's result in the last race (null in round 1). */
  lastRuns: [LastRun | null, LastRun | null];
}

export type GarageAction = 'prevTab' | 'nextTab' | 'prevPart' | 'nextPart' | 'ready';

/**
 * Garage keys, so both players can build at once on one keyboard: P1 on the left, P2 on the
 * arrows. `codes` are KeyboardEvent.code values (the same physical keys on any layout); the panels
 * show the labels.
 */
export const GARAGE_KEYS: Record<PlayerIndex, Record<GarageAction, { codes: string[]; label: string }>> = {
  0: {
    prevTab: { codes: ['KeyA'], label: 'A' },
    nextTab: { codes: ['KeyD'], label: 'D' },
    prevPart: { codes: ['KeyW'], label: 'W' },
    nextPart: { codes: ['KeyS'], label: 'S' },
    ready: { codes: ['Space'], label: 'SPACE' },
  },
  1: {
    prevTab: { codes: ['ArrowLeft'], label: '←' },
    nextTab: { codes: ['ArrowRight'], label: '→' },
    prevPart: { codes: ['ArrowUp'], label: '↑' },
    nextPart: { codes: ['ArrowDown'], label: '↓' },
    ready: { codes: ['Enter', 'NumpadEnter'], label: 'ENTER' },
  },
};

const PLAYERS: PlayerIndex[] = [0, 1];

// ---------- Stat bars ----------

const maxOf = (slot: keyof typeof PARTS, f: (o: (typeof PARTS)['chassis'][number]) => number): number =>
  Math.max(...PARTS[slot].map(f));
const sumMax = (f: (o: (typeof PARTS)['chassis'][number]) => number): number =>
  SLOT_ORDER.reduce((a, s) => a + maxOf(s, f), 0);

/**
 * Lift at a typical 30 m/s as a share of the car's weight, composed like the physics: body and
 * fixed wings, plus the kite and glider wings together (glider capped by its trim, kite by its
 * maximum pull). The same wings therefore read higher on a light car.
 */
function liftShare(s: CarStats): number {
  const q = 0.5 * RHO * 30 * 30;
  const weight = s.mass * G;
  let extra = s.kite ? Math.min(s.kite.clA * q, s.kite.liftCap) : 0;
  if (s.apexClA > 0) extra = Math.min(extra + s.apexClA * q, Math.max(extra, s.apexTrim * weight));
  return (s.clA * q + extra) / weight;
}

const RANGE = {
  mass: sumMax((o) => o.mass),
  drag: sumMax((o) => o.cdA ?? 0),
  power: maxOf('engine', (o) => o.power ?? 0),
  fuel: maxOf('fuel', (o) => o.energy ?? 0),
  grip: maxOf('wheels', (o) => o.mu ?? 0) * maxOf('chassis', (o) => o.gripMul ?? 1),
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
  const lift = liftShare(s);
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
      // A full bar means lift equal to the car's weight at 30 m/s.
      frac: lift,
      raw: lift,
      text: `${Math.round(lift * 100)}% wt`,
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

function keyHint(parent: HTMLElement, labels: string[]): void {
  const keys = el('span', 'keys', parent);
  for (const label of labels) el('kbd', '', keys, label);
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

interface TabRefs {
  btn: HTMLButtonElement;
  cost: HTMLElement;
  part: HTMLElement;
}

interface CardRefs {
  btn: HTMLButtonElement;
  opt: PartOption;
  /** Status tag on the card's bottom edge (fitted, can't afford, last race). */
  tag: HTMLElement;
}

interface PanelRefs {
  root: HTMLElement;
  name: HTMLInputElement;
  money: HTMLElement;
  lastRun: HTMLElement;
  stats: HTMLElement;
  statEls: Map<string, { row: HTMLElement; fill: HTMLElement; ghost: HTMLElement; val: HTMLElement }>;
  /** "changed" legend for the gold tabs. */
  changedKey: HTMLElement;
  tabs: Map<SlotId, TabRefs>;
  parts: HTMLElement;
  partsTitle: HTMLElement;
  cards: HTMLElement;
  cardEls: CardRefs[];
  /** The slot the cards were built for (they are rebuilt only when the open tab changes). */
  cardsSlot: SlotId | null;
  readyCard: HTMLElement;
  readyWait: HTMLElement;
  readyBtn: HTMLButtonElement;
}

export class BuildUI {
  readonly root: HTMLElement;
  private readonly h: BuildHandlers;
  private readonly wind: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly roundChip: HTMLElement;
  private readonly panels: [PanelRefs, PanelRefs];
  private view: BuildView | null = null;
  /** The part each player's pointer is over (previewed on the car and the stat bars). */
  private hover: [string | null, string | null] = [null, null];

  constructor(parent: HTMLElement, handlers: BuildHandlers) {
    this.h = handlers;
    this.root = el('div', 'build-ui overlay', parent);
    const top = el('div', 'topbar', this.root);
    this.roundChip = el('div', 'round-chip', top);
    this.wind = el('div', 'wind', top);
    this.wind.id = 'wind-forecast';
    const bottom = el('div', 'bottombar', this.root);
    this.banner = el('div', 'banner', bottom);
    this.banner.id = 'garage-banner';
    el('div', 'title-card', bottom, 'Click a part to fit it, click it again to remove it');
    this.panels = [this.makePanel(0), this.makePanel(1)];
  }

  private makePanel(p: PlayerIndex): PanelRefs {
    const keys = GARAGE_KEYS[p];
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
    money.title = 'Money left';
    money.addEventListener('animationend', () => money.classList.remove('shake'));

    const statsWrap = el('div', '', root);
    const statsHead = el('div', 'section-title', statsWrap);
    el('span', '', statsHead, 'Stats');
    const lastRun = el('span', 'aside', statsHead);
    const stats = el('div', 'stats', statsWrap);
    const statEls = new Map<string, { row: HTMLElement; fill: HTMLElement; ghost: HTMLElement; val: HTMLElement }>();

    // One tab per slot, showing the part fitted there and what it cost.
    const carWrap = el('div', '', root);
    const carHead = el('div', 'section-title', carWrap);
    el('span', '', carHead, 'Your car');
    // Explains the gold tabs after a rematch.
    const changedKey = el('span', 'legend hidden', carHead, 'changed');
    changedKey.title = 'Gold tabs have changed since the last race';
    keyHint(carHead, [keys.prevTab.label, keys.nextTab.label]);
    const tabList = el('div', 'tabs', carWrap);
    tabList.setAttribute('role', 'tablist');
    tabList.setAttribute('aria-label', `Player ${p + 1}'s car`);
    const tabs = new Map<SlotId, TabRefs>();
    for (const slot of SLOT_ORDER) {
      const btn = el('button', 'tab', tabList);
      btn.type = 'button';
      btn.dataset.slot = slot;
      btn.setAttribute('role', 'tab');
      const top = el('span', 'top', btn);
      el('span', 'slot', top, SLOT_LABELS[slot]);
      const cost = el('span', 'cost', top);
      const part = el('span', 'part', btn);
      btn.addEventListener('click', () => this.h.onTab(p, slot));
      tabs.set(slot, { btn, cost, part });
    }

    // The open tab's parts, or the READY card once the car is locked in.
    const options = el('div', 'options', root);
    options.setAttribute('role', 'tabpanel');
    const parts = el('div', 'parts', options);
    const partsHead = el('div', 'section-title', parts);
    const partsTitle = el('span', '', partsHead);
    keyHint(partsHead, [keys.prevPart.label, keys.nextPart.label]);
    const cards = el('div', 'cards', parts);
    const readyCard = el('div', 'ready-card hidden', options);
    el('div', 'tick', readyCard, '✓');
    el('div', 'big', readyCard, 'Ready!');
    const readyWait = el('div', 'sub', readyCard);

    const readyBtn = el('button', 'ready-btn', root);
    readyBtn.type = 'button';
    readyBtn.id = `ready-p${p + 1}`;
    // The second click of a double-click would undo the first.
    readyBtn.addEventListener('click', (e) => {
      if (e.detail <= 1) this.h.onReady(p);
    });

    return {
      root,
      name,
      money,
      lastRun,
      stats,
      statEls,
      changedKey,
      tabs,
      parts,
      partsTitle,
      cards,
      cardEls: [],
      cardsSlot: null,
      readyCard,
      readyWait,
      readyBtn,
    };
  }

  show(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
    if (!visible) this.hover = [null, null];
  }

  render(view: BuildView): void {
    this.view = view;
    this.roundChip.textContent = `ROUND ${view.round}`;
    renderWind(this.wind, view.wind);

    const ready = PLAYERS.filter((p) => view.garage.builds[p].ready);
    this.banner.replaceChildren();
    if (ready.length === 1) {
      const p = ready[0];
      // Only the name sits in the pill, so a long name is cut without losing "is ready".
      el('span', 'who', this.banner, view.names[p]).style.background = view.colors[p];
      this.banner.append(` is ready · waiting for ${view.names[1 - p]}`);
    } else {
      this.banner.append(`${view.round === 1 ? 'Build' : 'Tweak'} your cars, then both hit READY`);
    }
    this.banner.dataset.ready = ready.join(',');

    for (const p of PLAYERS) this.renderPanel(p, view);
  }

  /** Drop a player's hover preview, e.g. when they act with the keyboard. */
  endPreview(p: PlayerIndex): void {
    if (this.hover[p] === null) return;
    this.hover[p] = null;
    this.applyPreview(p);
  }

  /** Shake a player's money: they clicked a part they can't afford. */
  deny(p: PlayerIndex): void {
    const money = this.panels[p].money;
    money.classList.remove('shake');
    void money.offsetWidth;
    money.classList.add('shake');
  }

  private renderPanel(p: PlayerIndex, view: BuildView): void {
    const g = view.garage;
    const b = g.builds[p];
    const refs = this.panels[p];
    refs.root.style.setProperty('--pc', view.colors[p]);
    refs.root.classList.toggle('ready', b.ready);
    refs.root.dataset.ready = String(b.ready);
    if (document.activeElement !== refs.name) refs.name.value = view.names[p];

    const last = view.lastRuns[p];
    refs.lastRun.textContent = last ? `last race ${last.dnf ? 'DNF' : `${last.distance.toFixed(1)} m`}` : '';

    let anyChanged = false;
    for (const slot of SLOT_ORDER) {
      const t = refs.tabs.get(slot)!;
      const opt = fittedPart(g, p, slot);
      const was = swappedOut(g, p, slot);
      const open = slot === b.tab;
      anyChanged ||= was !== null;
      t.btn.classList.toggle('open', open);
      t.btn.setAttribute('aria-selected', String(open));
      t.btn.disabled = b.ready;
      t.btn.classList.toggle('changed', was !== null);
      t.btn.title = was ? `Changed since the last race (was ${was.name})` : '';
      t.btn.dataset.part = opt.id;
      t.cost.textContent = opt.price > 0 ? `$${opt.price}` : '';
      t.part.replaceChildren();
      if (opt.color) el('i', 'sw', t.part).style.background = opt.color;
      t.part.append(opt.name);
    }
    refs.changedKey.classList.toggle('hidden', !anyChanged);

    if (refs.cardsSlot !== b.tab) this.buildCards(p, b.tab);
    for (const c of refs.cardEls) this.renderCard(p, c, g);
    refs.parts.classList.toggle('hidden', b.ready);
    refs.readyCard.classList.toggle('hidden', !b.ready);
    refs.readyWait.textContent = `Waiting for ${view.names[1 - p]}…`;

    refs.readyBtn.replaceChildren(b.ready ? 'Edit car' : 'Ready');
    el('kbd', '', refs.readyBtn, GARAGE_KEYS[p].ready.label);
    refs.readyBtn.setAttribute('aria-pressed', String(b.ready));

    if (b.ready) this.hover[p] = null;
    this.applyPreview(p);
  }

  private buildCards(p: PlayerIndex, slot: SlotId): void {
    const refs = this.panels[p];
    refs.cardsSlot = slot;
    refs.cardEls = [];
    refs.cards.replaceChildren();
    // The card under the pointer (if any) is gone, and no pointerleave will fire for it.
    this.hover[p] = null;
    // Cosmetic slots are all free: say so once instead of on every card.
    const allFree = PARTS[slot].every((o) => o.price === 0);
    refs.partsTitle.textContent = allFree ? `${SLOT_LABELS[slot]} · all free` : SLOT_LABELS[slot];
    refs.cards.classList.toggle('grid2', slot === 'paint');
    refs.cards.classList.toggle('cosmetic', allFree);
    PARTS[slot].forEach((opt, i) => {
      const btn = el('button', 'card', refs.cards);
      btn.type = 'button';
      btn.dataset.optionIndex = String(i);
      btn.dataset.optionId = opt.id;
      if (slot === 'paint') {
        btn.classList.add('swatch');
        el('span', 'chip', btn).style.background = opt.color ?? '#fff';
        el('span', 'name', btn, opt.name);
      } else {
        el('span', 'radio', btn);
        el('span', 'name', btn, opt.name);
        if (!allFree) {
          const price = el('span', 'price', btn, opt.price === 0 ? 'FREE' : `$${opt.price}`);
          if (opt.price === 0) price.classList.add('free');
        }
        el('span', 'tagline', btn, opt.tagline);
      }
      const tag = el('span', 'tag', btn);
      // Unaffordable cards stay hoverable (the preview shows what the part would do), so they are
      // aria-disabled rather than disabled.
      btn.addEventListener('click', (e) => {
        // The second click of a double-click would undo the first (fit, then remove).
        if (e.detail > 1) return;
        if (btn.getAttribute('aria-disabled') === 'true') {
          this.deny(p);
          this.h.onDenied(p);
          return;
        }
        // Show the car as it now is (a removed part must not linger as a preview); the preview
        // comes back on the next hover.
        this.endPreview(p);
        this.h.onPart(p, slot, opt.id);
      });
      btn.addEventListener('pointerenter', () => {
        this.hover[p] = opt.id;
        this.applyPreview(p);
      });
      btn.addEventListener('pointerleave', () => {
        if (this.hover[p] !== opt.id) return;
        this.hover[p] = null;
        this.applyPreview(p);
      });
      refs.cardEls.push({ btn, opt, tag });
    });
  }

  private renderCard(p: PlayerIndex, c: CardRefs, g: Garage): void {
    const { btn, opt, tag } = c;
    const fitted = g.builds[p].config[opt.slot] === opt.id;
    const after = moneyAfter(g, p, opt);
    const locked = !fitted && after < 0;
    const last = !fitted && g.prev[p]?.[opt.slot] === opt.id;
    const removable = fitted && opt.price > 0;
    btn.classList.toggle('fitted', fitted);
    btn.classList.toggle('locked', locked);
    btn.classList.toggle('last', last);
    btn.classList.toggle('removable', removable);
    btn.setAttribute('aria-pressed', String(fitted));
    btn.setAttribute('aria-disabled', String(locked));
    // The full tagline leads every tooltip (short windows cut taglines to one line).
    const status = locked
      ? `Can't afford: $${opt.price}, you're $${-after} short`
      : removable
        ? `Fitted. Click to remove it and get $${opt.price} back (back to the free ${stockPart(opt.slot).name})`
        : fitted
          ? 'Fitted'
          : '';
    btn.title = status ? `${opt.tagline}\n${status}` : opt.tagline;
    tag.replaceChildren();
    if (fitted) {
      el('span', 'rest', tag, 'FITTED');
      if (removable) el('span', 'hover', tag, '✕ REMOVE');
    } else if (locked) {
      tag.textContent = `${last ? 'LAST RACE · ' : ''}NEED $${-after} MORE`;
    } else if (last) {
      tag.textContent = 'LAST RACE';
    }
  }

  /**
   * Preview what clicking the hovered card would do, on the stat bars, the money and the car: fit
   * that part, or, on the fitted paid part, remove it. (A click ends the preview until the pointer
   * comes back, so a part just fitted doesn't flip to showing its removal.)
   */
  private applyPreview(p: PlayerIndex): void {
    const v = this.view;
    if (!v) return;
    const b = v.garage.builds[p];
    const id = this.hover[p];
    const opt = id !== null && !b.ready ? PARTS[b.tab].find((o) => o.id === id) : undefined;
    let preview: PartOption | null = null;
    if (opt && b.config[b.tab] !== opt.id) preview = opt;
    else if (opt && opt.price > 0) preview = stockPart(b.tab);
    const cfg = preview ? ({ ...b.config, [b.tab]: preview.id } as CarConfig) : null;
    this.renderStats(p, b.config, cfg);
    this.renderMoney(p, v.garage, preview);
    this.h.onHover(p, cfg);
  }

  private renderMoney(p: PlayerIndex, g: Garage, preview: PartOption | null): void {
    const m = this.panels[p].money;
    const left = moneyLeft(g, p);
    const after = preview ? moneyAfter(g, p, preview) : left;
    m.textContent = after < 0 ? `−$${-after}` : `$${after}`;
    m.classList.toggle('preview', after !== left);
    m.classList.toggle('up', after > left);
    // Red only for a part you can't afford: spending right down to $0 is fine.
    m.classList.toggle('short', after < 0);
    m.dataset.money = String(left);
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

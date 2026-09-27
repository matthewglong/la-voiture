// The garage: both players build at the same time, in any order, and can change any part until
// they press READY. Every slot always holds a part (its free stock part until something else is
// fitted), so a car is always complete and within budget. Swapping a part refunds the one it
// replaces. Pure logic (no DOM) shared by the UI, keyboard input, autobuild and the test hooks.
import { BUDGET, PARTS, configPrice, defaultConfig, getOption } from './parts';
import { SLOT_ORDER, type CarConfig, type PartOption, type PlayerIndex, type SlotId } from './types';

export interface Build {
  config: CarConfig;
  /** The slot whose parts are on show. */
  tab: SlotId;
  /** A ready player's car is locked in; the race starts once both are ready. */
  ready: boolean;
}

export interface Garage {
  builds: [Build, Build];
  /** Last race's cars (null in round 1). A rematch starts from them. */
  prev: [CarConfig | null, CarConfig | null];
}

export function newGarage(
  prev: [CarConfig | null, CarConfig | null],
  tabs: [SlotId, SlotId] = ['chassis', 'chassis'],
): Garage {
  const build = (p: PlayerIndex): Build => ({
    config: { ...(prev[p] ?? defaultConfig(p)) },
    tab: tabs[p],
    ready: false,
  });
  return { builds: [build(0), build(1)], prev };
}

export function moneyLeft(g: Garage, p: PlayerIndex): number {
  return BUDGET - configPrice(g.builds[p].config);
}

export function fittedPart(g: Garage, p: PlayerIndex, slot: SlotId): PartOption {
  return getOption(slot, g.builds[p].config[slot]);
}

/** Money left after fitting `opt` in place of the part in its slot (negative: can't afford it). */
export function moneyAfter(g: Garage, p: PlayerIndex, opt: PartOption): number {
  return moneyLeft(g, p) + fittedPart(g, p, opt.slot).price - opt.price;
}

export function canFit(g: Garage, p: PlayerIndex, opt: PartOption): boolean {
  return moneyAfter(g, p, opt) >= 0;
}

/** The free part a slot falls back to when its paid part is removed. */
export function stockPart(slot: SlotId): PartOption {
  return PARTS[slot][0];
}

/** Fit a part (by id). False if it is unknown, already fitted, unaffordable, or the car is locked. */
export function fitPart(g: Garage, p: PlayerIndex, slot: SlotId, id: string): boolean {
  const b = g.builds[p];
  const opt = PARTS[slot]?.find((o) => o.id === id);
  if (b.ready || !opt || b.config[slot] === id || !canFit(g, p, opt)) return false;
  b.config[slot] = id;
  return true;
}

/** Remove a paid part: the slot falls back to its free stock part. False if the part is free. */
export function removePart(g: Garage, p: PlayerIndex, slot: SlotId): boolean {
  if (!SLOT_ORDER.includes(slot) || fittedPart(g, p, slot).price === 0) return false;
  return fitPart(g, p, slot, stockPart(slot).id);
}

/** A click on a part: fit it, or remove it when it is the paid part already fitted. */
export function togglePart(g: Garage, p: PlayerIndex, slot: SlotId, id: string): boolean {
  return g.builds[p].config[slot] === id ? removePart(g, p, slot) : fitPart(g, p, slot, id);
}

/** Fit the next (dir 1) or previous (dir -1) affordable part in the open tab. */
export function cyclePart(g: Garage, p: PlayerIndex, dir: 1 | -1): boolean {
  const b = g.builds[p];
  if (b.ready) return false;
  const opts = PARTS[b.tab];
  for (let i = opts.findIndex((o) => o.id === b.config[b.tab]) + dir; i >= 0 && i < opts.length; i += dir) {
    if (canFit(g, p, opts[i])) return fitPart(g, p, b.tab, opts[i].id);
  }
  return false;
}

/** Whether the open tab lists any part beyond the fitted one in that direction, affordable or not. */
export function hasPartBeyond(g: Garage, p: PlayerIndex, dir: 1 | -1): boolean {
  const b = g.builds[p];
  const i = PARTS[b.tab].findIndex((o) => o.id === b.config[b.tab]) + dir;
  return i >= 0 && i < PARTS[b.tab].length;
}

export function openTab(g: Garage, p: PlayerIndex, slot: SlotId): boolean {
  const b = g.builds[p];
  if (b.ready || b.tab === slot || !SLOT_ORDER.includes(slot)) return false;
  b.tab = slot;
  return true;
}

/** Open the next (dir 1) or previous (dir -1) slot's tab, wrapping around. */
export function stepTab(g: Garage, p: PlayerIndex, dir: 1 | -1): boolean {
  const n = SLOT_ORDER.length;
  return openTab(g, p, SLOT_ORDER[(SLOT_ORDER.indexOf(g.builds[p].tab) + dir + n) % n]);
}

export function setReady(g: Garage, p: PlayerIndex, ready: boolean): boolean {
  const b = g.builds[p];
  if (b.ready === ready) return false;
  b.ready = ready;
  return true;
}

export function allReady(g: Garage): boolean {
  return g.builds.every((b) => b.ready);
}

/** Last race's part for this slot if the player has swapped it out since, else null. */
export function swappedOut(g: Garage, p: PlayerIndex, slot: SlotId): PartOption | null {
  const was = g.prev[p]?.[slot];
  return was !== undefined && was !== g.builds[p].config[slot] ? getOption(slot, was) : null;
}

/** Random affordable parts in every slot (the ?autobuild=1 hook). */
export function randomize(g: Garage, p: PlayerIndex, rng: () => number): void {
  g.builds[p].config = defaultConfig(p);
  for (const slot of SLOT_ORDER) {
    const opts = PARTS[slot].filter((o) => canFit(g, p, o));
    g.builds[p].config[slot] = opts[Math.floor(rng() * opts.length)].id;
  }
}

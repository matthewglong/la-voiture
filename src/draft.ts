// Turn-based draft: for each slot the first picker chooses, then the other player.
// Pure logic (no DOM) shared by the UI, keyboard input, autobuild and the test hooks.
import { BUDGET, PARTS, defaultConfig, getOption } from './parts';
import { SLOT_ORDER, type CarConfig, type PartOption, type PlayerIndex, type SlotId } from './types';

export interface Draft {
  firstPicker: PlayerIndex;
  /** Index into SLOT_ORDER; equals SLOT_ORDER.length when the draft is complete. */
  slotIndex: number;
  /** 0 = the first picker's turn in this slot, 1 = the other player's. */
  turn: 0 | 1;
  picks: [Partial<CarConfig>, Partial<CarConfig>];
  /** Last round's cars (null in round 1). */
  prev: [CarConfig | null, CarConfig | null];
}

export function newDraft(firstPicker: PlayerIndex, prev: [CarConfig | null, CarConfig | null]): Draft {
  return { firstPicker, slotIndex: 0, turn: 0, picks: [{}, {}], prev };
}

export function isDone(d: Draft): boolean {
  return d.slotIndex >= SLOT_ORDER.length;
}

export function currentSlot(d: Draft): SlotId | null {
  return isDone(d) ? null : SLOT_ORDER[d.slotIndex];
}

export function activePlayer(d: Draft): PlayerIndex | null {
  if (isDone(d)) return null;
  return (d.turn === 0 ? d.firstPicker : 1 - d.firstPicker) as PlayerIndex;
}

export function spent(d: Draft, p: PlayerIndex): number {
  let total = 0;
  for (const slot of SLOT_ORDER) {
    const id = d.picks[p][slot];
    if (id) total += getOption(slot, id).price;
  }
  return total;
}

export function moneyLeft(d: Draft, p: PlayerIndex): number {
  return BUDGET - spent(d, p);
}

export function canAfford(d: Draft, p: PlayerIndex, opt: PartOption): boolean {
  return opt.price <= moneyLeft(d, p);
}

/** What the car looks like right now: this round's picks, else last round's car, else the $0 part. */
export function displayConfig(d: Draft, p: PlayerIndex): CarConfig {
  const base = d.prev[p] ?? defaultConfig(p);
  return { ...base, ...d.picks[p] } as CarConfig;
}

/** The previous round's pick for the current slot, if any. */
export function previousPick(d: Draft, p: PlayerIndex): string | null {
  const slot = currentSlot(d);
  if (!slot) return null;
  return d.prev[p]?.[slot] ?? null;
}

/** Pick an option (by id) for the active player. Returns false if not allowed. */
export function applyPick(d: Draft, optionId: string): boolean {
  const slot = currentSlot(d);
  const p = activePlayer(d);
  if (slot === null || p === null) return false;
  const opt = PARTS[slot].find((o) => o.id === optionId);
  if (!opt || !canAfford(d, p, opt)) return false;
  d.picks[p][slot] = opt.id;
  if (d.turn === 0) {
    d.turn = 1;
  } else {
    d.turn = 0;
    d.slotIndex++;
  }
  return true;
}

/** Fill every remaining pick with the $0 option (used by the launch() hook). */
export function completeWithDefaults(d: Draft): void {
  while (!isDone(d)) {
    const slot = currentSlot(d)!;
    const p = activePlayer(d)!;
    const keep = previousPick(d, p);
    const keepOpt = keep ? PARTS[slot].find((o) => o.id === keep) : undefined;
    const choice = keepOpt && canAfford(d, p, keepOpt) ? keepOpt.id : PARTS[slot][0].id;
    applyPick(d, choice);
  }
}

export function finalConfig(d: Draft, p: PlayerIndex): CarConfig {
  return displayConfig(d, p);
}

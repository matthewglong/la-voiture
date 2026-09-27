// Driving input: two players on one keyboard (P1 on WASD, P2 on the arrows), or one player alone
// on the arrows, plus up to two gamepads (the first pad to press a button is P1's, the next P2's, and
// each keeps its seat until it disconnects or the pads swap). Pads also work the menus and rumble on
// crashes. Keys are
// KeyboardEvent.code values, so the same physical keys work on any layout. Tap the brake while
// turning to drift (no key of its own).
import type { PlayerIndex } from './types';

export interface DriveState {
  throttle: number;
  brake: number;
  steer: number;
  /** The item key is held. */
  itemHeld: boolean;
  /** The boost key is held. */
  boost: boolean;
}

export interface DriveKeys {
  throttle: string[];
  brake: string[];
  left: string[];
  right: string[];
  item: string[];
  /** Switch between the two held items. */
  swap: string[];
  boost: string[];
  /** Labels for the on-screen help (`move`: the four driving keys together). */
  labels: { move: string; throttle: string; brake: string; steer: string; item: string; swap: string; boost: string };
}

// Two players: P1's left hand sits on WASD with Shift, Ctrl and Tab under the little finger. P2's
// right hand is on the arrows and the left one on P, O and the semicolon.
const DUO_KEYS: Record<PlayerIndex, DriveKeys> = {
  0: {
    throttle: ['KeyW'],
    brake: ['KeyS'],
    left: ['KeyA'],
    right: ['KeyD'],
    item: ['ControlLeft'],
    swap: ['Tab'],
    boost: ['ShiftLeft'],
    labels: { move: 'WASD', throttle: 'W', brake: 'S', steer: 'A D', item: 'CTRL', swap: 'TAB', boost: 'SHIFT' },
  },
  1: {
    throttle: ['ArrowUp'],
    brake: ['ArrowDown'],
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    item: ['Semicolon'],
    swap: ['KeyO'],
    boost: ['KeyP'],
    labels: { move: 'ARROWS', throttle: '↑', brake: '↓', steer: '← →', item: ';', swap: 'O', boost: 'P' },
  },
};

// One player alone (against the CPU, or solo) has the keyboard to themselves: the right hand on the
// arrows, the left on Shift, Tab and Space. WASD drives too.
const SINGLE_KEYS: Record<PlayerIndex, DriveKeys> = {
  0: {
    throttle: ['ArrowUp', 'KeyW'],
    brake: ['ArrowDown', 'KeyS'],
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    item: ['Space'],
    swap: ['Tab'],
    boost: ['ShiftLeft', 'ShiftRight'],
    labels: { move: 'ARROWS', throttle: '↑', brake: '↓', steer: '← →', item: 'SPACE', swap: 'TAB', boost: 'SHIFT' },
  },
  1: {
    throttle: [],
    brake: [],
    left: [],
    right: [],
    item: [],
    swap: [],
    boost: [],
    labels: { move: '', throttle: '', brake: '', steer: '', item: '', swap: '', boost: '' },
  },
};

/** The driving keys for a player, with two players at the keyboard or one alone. */
export function driveKeys(p: PlayerIndex, single: boolean): DriveKeys {
  return (single ? SINGLE_KEYS : DUO_KEYS)[p];
}

const PLAYERS: PlayerIndex[] = [0, 1];

/** Gamepad buttons (standard mapping): X uses the item, Y swaps, either shoulder boosts. */
const PAD_ITEM = 2;
const PAD_SWAP = 3;
const PAD_BOOST = [4, 5];

/** The on-screen labels for a player driving with a gamepad (Xbox names). */
export const PAD_LABELS: DriveKeys['labels'] = {
  move: 'STICK',
  throttle: 'RT',
  brake: 'LT',
  steer: 'STICK',
  item: 'X',
  swap: 'Y',
  boost: 'LB/RB',
};

/** A menu press on a gamepad (the stick counts as the d-pad). */
export type PadButton = 'a' | 'b' | 'x' | 'y' | 'lb' | 'rb' | 'view' | 'menu' | 'stick' | 'up' | 'down' | 'left' | 'right';

export interface PadPress {
  p: PlayerIndex;
  button: PadButton;
  /** A held direction repeating. */
  repeat: boolean;
}

/** Standard-mapping button indices for the menu presses (directions come from the d-pad or stick). */
const PAD_BUTTONS: [PadButton, number][] = [
  ['a', 0],
  ['b', 1],
  ['x', 2],
  ['y', 3],
  ['lb', 4],
  ['rb', 5],
  ['view', 8],
  ['menu', 9],
  ['stick', 10],
];
const DIRS: PadButton[] = ['up', 'down', 'left', 'right'];
/** A held direction repeats after this long, then this often (seconds). */
const REPEAT_DELAY = 0.4;
const REPEAT_EVERY = 0.13;
const STICK_MENU = 0.6;

interface PadMenuState {
  held: Set<PadButton>;
  /** When each held direction next repeats (performance.now() seconds). */
  next: Map<PadButton, number>;
}

export class DriveInput {
  private readonly down = new Set<string>();
  /** Item and swap presses not yet taken by the race (one per key-down). */
  private readonly pending: [number, number] = [0, 0];
  private readonly pendingSwap: [number, number] = [0, 0];
  private readonly padItem: [boolean, boolean] = [false, false];
  private readonly padSwap: [boolean, boolean] = [false, false];
  /** Whether each player last used their gamepad (rather than the keyboard): the hints follow it. */
  readonly usingPad: [boolean, boolean] = [false, false];
  /** Which gamepad (by Gamepad.index) sits in each player's seat. */
  private readonly seats: [number | null, number | null] = [null, null];
  private readonly menu: [PadMenuState, PadMenuState] = [
    { held: new Set(), next: new Map() },
    { held: new Set(), next: new Map() },
  ];
  private isSingle = false;

  /** One player alone at the keyboard (they drive on the arrows), or two sharing it. */
  get single(): boolean {
    return this.isSingle;
  }

  set single(on: boolean) {
    if (on === this.isSingle) return;
    this.isSingle = on;
    this.clear();
  }

  /** The driving keys a player has right now. */
  keys(p: PlayerIndex): DriveKeys {
    return driveKeys(p, this.isSingle);
  }

  /** The control labels to show a player: their pad's buttons if they are on it, else their keys. */
  labels(p: PlayerIndex): DriveKeys['labels'] {
    return this.usingPad[p] ? PAD_LABELS : this.keys(p).labels;
  }

  /** Note which device a player last used; true if that changed (the hints need redrawing). */
  setUsingPad(p: PlayerIndex, on: boolean): boolean {
    if (this.usingPad[p] === on) return false;
    this.usingPad[p] = on;
    return true;
  }

  /** Whether a player has a gamepad connected. */
  hasPad(p: PlayerIndex): boolean {
    return this.pad(p) !== null;
  }

  /** The player a key code drives (or null). */
  owner(code: string): PlayerIndex | null {
    for (const p of PLAYERS) {
      const k = this.keys(p);
      if ([...k.throttle, ...k.brake, ...k.left, ...k.right, ...k.item, ...k.swap, ...k.boost].includes(code)) return p;
    }
    return null;
  }

  /** Feed a key event; returns the player it belongs to (or null). */
  key(e: KeyboardEvent, isDown: boolean): PlayerIndex | null {
    const p = this.owner(e.code);
    if (p === null) return null;
    const k = this.keys(p);
    if (isDown) {
      this.usingPad[p] = false;
      if (!e.repeat && k.item.includes(e.code)) this.pending[p]++;
      if (!e.repeat && k.swap.includes(e.code)) this.pendingSwap[p]++;
      this.down.add(e.code);
    } else this.down.delete(e.code);
    return p;
  }

  /** Forget held keys (the window lost focus, or a new race starts). */
  clear(): void {
    this.down.clear();
    this.pending[0] = this.pending[1] = 0;
    this.pendingSwap[0] = this.pendingSwap[1] = 0;
  }

  /** Take one pending item press for a player (true at most once per key-down). */
  takeItem(p: PlayerIndex): boolean {
    if (this.pending[p] > 0) {
      this.pending[p] = 0;
      return true;
    }
    return false;
  }

  /** Take one pending swap press for a player. */
  takeSwap(p: PlayerIndex): boolean {
    if (this.pendingSwap[p] > 0) {
      this.pendingSwap[p] = 0;
      return true;
    }
    return false;
  }

  private any(codes: string[]): boolean {
    for (const c of codes) if (this.down.has(c)) return true;
    return false;
  }

  /** Current controls for a player: keys and their gamepad combined. */
  state(p: PlayerIndex): DriveState {
    const k = this.keys(p);
    let throttle = this.any(k.throttle) ? 1 : 0;
    let brake = this.any(k.brake) ? 1 : 0;
    let steer = (this.any(k.right) ? 1 : 0) - (this.any(k.left) ? 1 : 0);
    let itemHeld = this.any(k.item);
    let boost = this.any(k.boost);
    const pad = this.pad(p);
    if (pad) {
      const b = pad.buttons;
      const val = (i: number): number => (b[i] ? Math.max(b[i].value, b[i].pressed ? 1 : 0) : 0);
      const stick = pad.axes[0] ?? 0;
      const padSteer = Math.abs(stick) > 0.12 ? Math.sign(stick) * Math.min(1, (Math.abs(stick) - 0.12) / 0.8) : 0;
      const dpad = (val(15) > 0.5 ? 1 : 0) - (val(14) > 0.5 ? 1 : 0);
      const pt = Math.max(val(7), val(0));
      const pb = Math.max(val(6), val(1));
      const pi = val(PAD_ITEM) > 0.5;
      const ps = val(PAD_SWAP) > 0.5;
      const pboost = PAD_BOOST.some((i) => val(i) > 0.5);
      if (pt || pb || padSteer || dpad || pi || ps || pboost) this.usingPad[p] = true;
      throttle = Math.max(throttle, pt);
      brake = Math.max(brake, pb);
      if (padSteer !== 0) steer = padSteer;
      else if (dpad !== 0) steer = dpad;
      if (pi && !this.padItem[p]) this.pending[p]++;
      if (ps && !this.padSwap[p]) this.pendingSwap[p]++;
      this.padItem[p] = pi;
      this.padSwap[p] = ps;
      itemHeld ||= pi;
      boost ||= pboost;
    }
    return { throttle, brake, steer: Math.max(-1, Math.min(1, steer)), itemHeld, boost };
  }

  /**
   * Menu presses since the last poll, per player: buttons as they go down, and the d-pad or stick
   * directions with a key-like repeat while held. Also seats newly connected pads.
   */
  pollMenu(): PadPress[] {
    const out: PadPress[] = [];
    const now = performance.now() / 1000;
    this.claimSeats();
    for (const p of PLAYERS) {
      const pad = this.pad(p);
      const m = this.menu[p];
      if (!pad) {
        m.held.clear();
        m.next.clear();
        continue;
      }
      const b = pad.buttons;
      const on = (i: number): boolean => !!b[i] && (b[i].pressed || b[i].value > 0.5);
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const down = new Set<PadButton>();
      for (const [name, i] of PAD_BUTTONS) if (on(i)) down.add(name);
      if (on(12) || ay < -STICK_MENU) down.add('up');
      if (on(13) || ay > STICK_MENU) down.add('down');
      if (on(14) || ax < -STICK_MENU) down.add('left');
      if (on(15) || ax > STICK_MENU) down.add('right');
      for (const name of down) {
        const dir = DIRS.includes(name);
        if (!m.held.has(name)) {
          out.push({ p, button: name, repeat: false });
          if (dir) m.next.set(name, now + REPEAT_DELAY);
        } else if (dir && now >= (m.next.get(name) ?? Infinity)) {
          out.push({ p, button: name, repeat: true });
          m.next.set(name, now + REPEAT_EVERY);
        }
      }
      for (const name of m.held) if (!down.has(name)) m.next.delete(name);
      m.held.clear();
      for (const name of down) m.held.add(name);
    }
    return out;
  }

  /** Buzz a player's pad (strong and weak motors 0..1), if it can. */
  rumble(p: PlayerIndex, strong: number, weak: number, ms: number): void {
    const act = (this.pad(p) as (Gamepad & { vibrationActuator?: { playEffect?: (type: string, params: object) => Promise<unknown> } }) | null)
      ?.vibrationActuator;
    if (!act?.playEffect) return;
    act
      .playEffect('dual-rumble', {
        duration: Math.round(ms),
        strongMagnitude: Math.min(1, Math.max(0, strong)),
        weakMagnitude: Math.min(1, Math.max(0, weak)),
      })
      .catch(() => {});
  }

  /** Every pad the browser lists, what it reports, and whose seat it's in (for `?pads`). */
  debugPads(): string {
    const lines = this.pads().map((g, i) => {
      if (!g) return `[${i}] empty`;
      const seat = this.seats.indexOf(g.index);
      const held = g.buttons.flatMap((b, j) => (b.pressed || b.value > 0.05 ? [`${j}:${b.value.toFixed(2)}`] : []));
      const axes = g.axes.map((a) => a.toFixed(2)).join(' ');
      return [
        `[${g.index}] ${seat < 0 ? 'NO SEAT' : `P${seat + 1}`} · ${g.connected ? 'connected' : 'DISCONNECTED'} · mapping "${g.mapping}"`,
        `    ${g.id}`,
        `    ${g.buttons.length} buttons, held: ${held.join(' ') || '-'}`,
        `    axes: ${axes}`,
      ].join('\n');
    });
    return [`seats: P1=${this.seats[0]} P2=${this.seats[1]} · single=${this.isSingle}`, ...lines].join('\n');
  }

  /** Swap the two pads' players (or move a lone pad to the other seat). */
  swapSeats(): void {
    const [a, b] = this.seats;
    this.seats[0] = b;
    this.seats[1] = a;
    const [ua, ub] = this.usingPad;
    this.usingPad[0] = ub;
    this.usingPad[1] = ua;
    for (const m of this.menu) {
      m.held.clear();
      m.next.clear();
    }
    // Whatever is held on the pads now counts as held, so the swap press doesn't act again.
    this.pollMenu();
  }

  /**
   * An unseated pad takes the first free seat when it's first used (a button, a trigger or the
   * stick), not when the browser lists it: Chrome shows every connected pad at once after the first
   * press, in its own order.
   */
  private claimSeats(): void {
    const pads = this.pads();
    for (const q of PLAYERS) if (this.seats[q] !== null && !live(pads, this.seats[q])) this.seats[q] = null;
    for (const g of pads) {
      if (!g || !g.connected || this.seats.includes(g.index)) continue;
      const used = g.buttons.some((b) => b.pressed || b.value > 0.5) || g.axes.some((a) => Math.abs(a) > 0.5);
      if (!used) continue;
      const free = PLAYERS.find((q) => this.seats[q] === null);
      if (free === undefined) break;
      this.seats[free] = g.index;
      this.rumble(free, 0.4, 0.4, 150);
    }
    // Alone at the controls, a lone pad in Player 2's seat moves over to Player 1.
    if (this.isSingle && this.seats[0] === null && this.seats[1] !== null) {
      this.seats[0] = this.seats[1];
      this.seats[1] = null;
    }
  }

  private pads(): (Gamepad | null)[] {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    return Array.from(navigator.getGamepads());
  }

  /** A player's pad, if one sits in their seat and is still connected. */
  private pad(p: PlayerIndex): Gamepad | null {
    return live(this.pads(), this.seats[p]);
  }
}

function live(pads: (Gamepad | null)[], i: number | null): Gamepad | null {
  const g = i === null ? null : pads[i];
  return g && g.connected ? g : null;
}

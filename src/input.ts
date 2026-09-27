// Driving input for two players on one keyboard (P1 on WASD + Space, P2 on the arrows + Enter),
// plus up to two gamepads (the first is P1's, the second P2's). Keys are KeyboardEvent.code values,
// so the same physical keys work on any layout.
import type { PlayerIndex } from './types';

export interface DriveState {
  throttle: number;
  brake: number;
  steer: number;
  /** The item key is held. */
  itemHeld: boolean;
}

export interface DriveKeys {
  throttle: string[];
  brake: string[];
  left: string[];
  right: string[];
  item: string[];
  /** Labels for the on-screen help. */
  labels: { throttle: string; brake: string; steer: string; item: string };
}

export const DRIVE_KEYS: Record<PlayerIndex, DriveKeys> = {
  0: {
    throttle: ['KeyW'],
    brake: ['KeyS'],
    left: ['KeyA'],
    right: ['KeyD'],
    item: ['Space', 'KeyE', 'ShiftLeft'],
    labels: { throttle: 'W', brake: 'S', steer: 'A D', item: 'SPACE' },
  },
  1: {
    throttle: ['ArrowUp'],
    brake: ['ArrowDown'],
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    item: ['Enter', 'NumpadEnter', 'ShiftRight', 'Slash', 'Numpad0'],
    labels: { throttle: '↑', brake: '↓', steer: '← →', item: 'ENTER' },
  },
};

const PLAYERS: PlayerIndex[] = [0, 1];

export class DriveInput {
  private readonly down = new Set<string>();
  /** Item presses not yet taken by the race (one per key-down). */
  private readonly pending: [number, number] = [0, 0];
  private readonly padItem: [boolean, boolean] = [false, false];
  /** Whether each player has touched a gamepad (then their pad drives). */
  readonly padSeen: [boolean, boolean] = [false, false];

  /** Feed a key event; returns the player it belongs to (or null). */
  key(e: KeyboardEvent, isDown: boolean): PlayerIndex | null {
    for (const p of PLAYERS) {
      const k = DRIVE_KEYS[p];
      const all = [...k.throttle, ...k.brake, ...k.left, ...k.right, ...k.item];
      if (!all.includes(e.code)) continue;
      if (isDown) {
        if (!e.repeat && k.item.includes(e.code)) this.pending[p]++;
        this.down.add(e.code);
      } else this.down.delete(e.code);
      return p;
    }
    return null;
  }

  /** Forget held keys (the window lost focus, or a new race starts). */
  clear(): void {
    this.down.clear();
    this.pending[0] = this.pending[1] = 0;
  }

  /** Take one pending item press for a player (true at most once per key-down). */
  takeItem(p: PlayerIndex): boolean {
    if (this.pending[p] > 0) {
      this.pending[p] = 0;
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
    const k = DRIVE_KEYS[p];
    let throttle = this.any(k.throttle) ? 1 : 0;
    let brake = this.any(k.brake) ? 1 : 0;
    let steer = (this.any(k.right) ? 1 : 0) - (this.any(k.left) ? 1 : 0);
    let itemHeld = this.any(k.item);
    const pad = this.pad(p);
    if (pad) {
      const b = pad.buttons;
      const val = (i: number): number => (b[i] ? Math.max(b[i].value, b[i].pressed ? 1 : 0) : 0);
      const stick = pad.axes[0] ?? 0;
      const padSteer = Math.abs(stick) > 0.12 ? Math.sign(stick) * Math.min(1, (Math.abs(stick) - 0.12) / 0.8) : 0;
      const dpad = (val(15) > 0.5 ? 1 : 0) - (val(14) > 0.5 ? 1 : 0);
      const pt = Math.max(val(7), val(0));
      const pb = Math.max(val(6), val(1));
      const pi = val(2) > 0.5 || val(5) > 0.5 || val(3) > 0.5;
      if (pt || pb || padSteer || dpad || pi) this.padSeen[p] = true;
      throttle = Math.max(throttle, pt);
      brake = Math.max(brake, pb);
      if (padSteer !== 0) steer = padSteer;
      else if (dpad !== 0) steer = dpad;
      if (pi && !this.padItem[p]) this.pending[p]++;
      this.padItem[p] = pi;
      itemHeld ||= pi;
    }
    return { throttle, brake, steer: Math.max(-1, Math.min(1, steer)), itemHeld };
  }

  private pad(p: PlayerIndex): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = Array.from(navigator.getGamepads()).filter((g): g is Gamepad => !!g && g.connected);
    return pads[p] ?? null;
  }
}

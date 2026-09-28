// Shared by the balance checks: every affordable build, and how to print one.
import { BUDGET, PARTS, defaultConfig } from '../src/parts';
import { PERFORMANCE_SLOTS, type CarConfig } from '../src/types';

export interface Build {
  config: CarConfig;
  price: number;
  key: string;
}

export function enumerateBuilds(): Build[] {
  const builds: Build[] = [];
  const base = defaultConfig(0);
  const walk = (i: number, cfg: CarConfig, price: number): void => {
    if (i === PERFORMANCE_SLOTS.length) {
      const key = PERFORMANCE_SLOTS.map((s) => cfg[s]).join('/');
      builds.push({ config: { ...cfg }, price, key });
      return;
    }
    const slot = PERFORMANCE_SLOTS[i];
    for (const opt of PARTS[slot]) {
      if (price + opt.price > BUDGET) continue;
      cfg[slot] = opt.id;
      walk(i + 1, cfg, price + opt.price);
    }
    cfg[slot] = base[slot];
  };
  walk(0, { ...base }, 0);
  return builds;
}

export function label(cfg: CarConfig): string {
  return PERFORMANCE_SLOTS.map((slot) => PARTS[slot].find((o) => o.id === cfg[slot])!.name).join(' · ');
}

export function pad(s: string | number, n: number, right = false): string {
  const str = String(s);
  return right ? str.padStart(n) : str.padEnd(n);
}


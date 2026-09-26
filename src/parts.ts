// Parts catalog and stat computation. No Three.js or DOM imports: shared with scripts/balance.ts.
import {
  SLOT_ORDER,
  type CarConfig,
  type CarStats,
  type PartOption,
  type PlayerIndex,
  type SlotId,
} from './types';

export const BUDGET = 100;

export const SLOT_LABELS: Record<SlotId, string> = {
  chassis: 'Chassis',
  wheels: 'Wheels',
  engine: 'Engine',
  fuel: 'Fuel tank',
  wing: 'Wing',
  nose: 'Nose',
  booster: 'Booster',
  paint: 'Paint',
  topper: 'Topper',
};

type OptionDef = Omit<PartOption, 'slot'>;

// Tuned with scripts/balance.ts (see DECISIONS.md for the report and the reasoning).
const CHASSIS: OptionDef[] = [
  {
    id: 'kart',
    name: 'Go-kart',
    price: 0,
    mass: 200,
    cdA: 0.85,
    tagline: 'Light and slim, but drag hurts light cars more in flight',
  },
  {
    id: 'tub',
    name: 'Bathtub',
    price: 5,
    mass: 250,
    cdA: 1.05,
    clA: 1.7,
    tagline: 'Flat bottom makes it a lifting body, but heavier and draggier than a kart',
  },
  {
    id: 'sedan',
    name: 'Sedan',
    price: 15,
    mass: 660,
    cdA: 0.9,
    tagline: 'Balanced and slippery for its size, but 660 kg needs a strong engine',
  },
  {
    id: 'pickup',
    name: 'Pickup 4x4',
    price: 25,
    mass: 1210,
    cdA: 1.05,
    gripMul: 1.35,
    tagline: '4WD grip and momentum shrug off drag, but heavy and a quarter of your budget',
  },
];

const WHEELS: OptionDef[] = [
  {
    id: 'tiny',
    name: 'Tiny',
    price: 0,
    mass: 20,
    mu: 0.85,
    crr: 0.009,
    bumpLoss: 0.25,
    tagline: 'Light and free-rolling, but they spin under power and lose 25% at each track',
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 10,
    mass: 60,
    mu: 0.95,
    crr: 0.021,
    bumpLoss: 0.07,
    tagline: 'Good grip and only lose 7% at each track, for a little weight',
  },
  {
    id: 'monster',
    name: 'Monster',
    price: 20,
    mass: 220,
    mu: 1.3,
    crr: 0.024,
    bumpLoss: 0.005,
    cdA: 0.35,
    tagline: 'Huge grip and roll right over the tracks, but heavy, draggy and slow-rolling',
  },
];

const ENGINES: OptionDef[] = [
  {
    id: 'mower',
    name: 'Lawnmower',
    price: 0,
    mass: 30,
    power: 2500,
    tagline: 'Free and light, but only 2.5 kW: it putters down the hill',
  },
  {
    id: 'v8',
    name: 'V8',
    price: 20,
    mass: 250,
    power: 185_000,
    tagline: '185 kW of shove for $20, but wheel-driven: bad tyres just spin',
  },
  {
    id: 'jet',
    name: 'Jet',
    price: 35,
    mass: 350,
    power: 200_000,
    jet: true,
    thrustCap: 17_500,
    tagline: 'Thrust ignores grip, so no wheelspin, but heavy, pricey and capped off the line',
  },
];

const FUEL: OptionDef[] = [
  {
    id: 'jerry',
    name: 'Jerry can',
    price: 0,
    mass: 10,
    energy: 120_000,
    tagline: 'Light and free: plenty for a lawnmower, a sip for a V8',
  },
  {
    id: 'tank',
    name: 'Standard',
    price: 10,
    mass: 60,
    energy: 460_000,
    tagline: '460 kJ: a few seconds of V8 or jet for 60 kg',
  },
  {
    id: 'big',
    name: 'Oversized',
    price: 20,
    mass: 230,
    energy: 760_000,
    tagline: '760 kJ, the most push, but 230 kg to haul and leftovers are wasted',
  },
];

const WINGS: OptionDef[] = [
  { id: 'none', name: 'None', price: 0, mass: 0, tagline: 'No drag, no weight, no lift' },
  {
    id: 'spoiler',
    name: 'Spoiler',
    price: 8,
    mass: 10,
    clA: 0.7,
    cdA: 0.1,
    tagline: 'A little lift for a little drag',
  },
  {
    id: 'glider',
    name: 'Glider wings',
    price: 25,
    mass: 60,
    clA: 13.2,
    cdA: 0.2,
    openCdA: 2.6,
    trim: 0.65,
    opensAtApex: true,
    tagline: 'Pop open at the top of the arc to glide far on light cars, but pricey and draggy',
  },
];

const NOSES: OptionDef[] = [
  { id: 'blunt', name: 'Blunt', price: 0, mass: 0, cdA: 0.5, tagline: 'Free, but pushes a wall of air' },
  { id: 'wedge', name: 'Wedge', price: 8, mass: 20, cdA: 0.1, tagline: 'Cuts most of the drag for a little weight' },
  { id: 'cone', name: 'Cone', price: 15, mass: 40, cdA: 0.0, tagline: 'No extra drag at all, but the priciest and heaviest' },
];

const BOOSTERS: OptionDef[] = [
  { id: 'none', name: 'None', price: 0, mass: 0, tagline: 'Keep the money' },
  {
    id: 'nitro',
    name: 'Nitro',
    price: 15,
    mass: 30,
    nitroJ: 110_000,
    tagline: '+110 kJ kick at the lip: huge on light cars, small on heavy ones',
  },
  {
    id: 'kite',
    name: 'Kite',
    price: 10,
    mass: 15,
    kite: { clA: 6.5, liftCap: 2200, cdA: 1.1 },
    tagline: 'Opens at the lip for big lift even when slow, but drags in flight',
  },
];

export const PAINTS: OptionDef[] = [
  { id: 'red', name: 'Racing Red', price: 0, mass: 0, color: '#e8322a', tagline: 'Cosmetic' },
  { id: 'blue', name: 'Royal Blue', price: 0, mass: 0, color: '#2f63ea', tagline: 'Cosmetic' },
  { id: 'orange', name: 'Tangerine', price: 0, mass: 0, color: '#ff8a1f', tagline: 'Cosmetic' },
  { id: 'yellow', name: 'Sunshine', price: 0, mass: 0, color: '#ffc81f', tagline: 'Cosmetic' },
  { id: 'lime', name: 'Lime', price: 0, mass: 0, color: '#5ccc36', tagline: 'Cosmetic' },
  { id: 'teal', name: 'Teal', price: 0, mass: 0, color: '#14b8b0', tagline: 'Cosmetic' },
  { id: 'grape', name: 'Grape', price: 0, mass: 0, color: '#8a44d8', tagline: 'Cosmetic' },
  { id: 'pink', name: 'Bubblegum', price: 0, mass: 0, color: '#ff5fae', tagline: 'Cosmetic' },
];

const TOPPERS: OptionDef[] = [
  { id: 'none', name: 'None', price: 0, mass: 0, tagline: 'Clean roofline' },
  { id: 'tophat', name: 'Top hat', price: 0, mass: 1, tagline: 'Cosmetic: very distinguished' },
  { id: 'flag', name: 'Flag', price: 0, mass: 2, tagline: 'Cosmetic: flies your colours' },
  { id: 'duck', name: 'Rubber duck', price: 0, mass: 1, tagline: 'Cosmetic: squeak' },
  { id: 'cone', name: 'Traffic cone', price: 0, mass: 2, tagline: 'Cosmetic: borrowed from the pier' },
];

function withSlot(slot: SlotId, defs: OptionDef[]): PartOption[] {
  return defs.map((d) => ({ ...d, slot }));
}

export const PARTS: Record<SlotId, PartOption[]> = {
  chassis: withSlot('chassis', CHASSIS),
  wheels: withSlot('wheels', WHEELS),
  engine: withSlot('engine', ENGINES),
  fuel: withSlot('fuel', FUEL),
  wing: withSlot('wing', WINGS),
  nose: withSlot('nose', NOSES),
  booster: withSlot('booster', BOOSTERS),
  paint: withSlot('paint', PAINTS),
  topper: withSlot('topper', TOPPERS),
};

/** Default paint per player so the two cars differ before Paint is drafted. */
export const DEFAULT_PAINT: Record<PlayerIndex, string> = { 0: 'red', 1: 'blue' };

export function getOption(slot: SlotId, id: string): PartOption {
  const opt = PARTS[slot].find((o) => o.id === id);
  if (!opt) throw new Error(`Unknown option ${slot}:${id}`);
  return opt;
}

export function optionIndex(slot: SlotId, id: string): number {
  return PARTS[slot].findIndex((o) => o.id === id);
}

/** The all-$0 build: first option in every slot. */
export function defaultConfig(player: PlayerIndex = 0): CarConfig {
  const cfg = {} as CarConfig;
  for (const slot of SLOT_ORDER) cfg[slot] = PARTS[slot][0].id;
  cfg.paint = DEFAULT_PAINT[player];
  return cfg;
}

export function configPrice(config: CarConfig): number {
  let price = 0;
  for (const slot of SLOT_ORDER) price += getOption(slot, config[slot]).price;
  return price;
}

export function computeStats(config: CarConfig): CarStats {
  const opts = SLOT_ORDER.map((slot) => getOption(slot, config[slot]));
  const chassis = getOption('chassis', config.chassis);
  const wheels = getOption('wheels', config.wheels);
  const engine = getOption('engine', config.engine);
  const fuel = getOption('fuel', config.fuel);
  const booster = getOption('booster', config.booster);

  let mass = 0;
  let cdA = 0;
  let clA = 0;
  let apexClA = 0;
  let apexCdA = 0;
  let apexTrim = 0;
  let price = 0;
  for (const o of opts) {
    mass += o.mass;
    cdA += o.cdA ?? 0;
    if (o.opensAtApex) {
      apexClA += o.clA ?? 0;
      apexCdA += o.openCdA ?? 0;
      apexTrim = Math.max(apexTrim, o.trim ?? 1);
    } else clA += o.clA ?? 0;
    price += o.price;
  }

  return {
    mass,
    cdA,
    clA,
    apexClA,
    apexCdA,
    apexTrim,
    mu: (wheels.mu ?? 0.9) * (chassis.gripMul ?? 1),
    power: engine.power ?? 0,
    energy: fuel.energy ?? 0,
    isJet: engine.jet === true,
    thrustCap: engine.jet ? (engine.thrustCap ?? Infinity) : Infinity,
    crr: wheels.crr ?? 0.015,
    bumpLoss: wheels.bumpLoss ?? 0.05,
    nitroJ: booster.nitroJ ?? 0,
    kite: booster.kite ?? null,
    price,
  };
}

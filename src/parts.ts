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
  boost: 'Boost',
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
    mass: 195,
    cdA: 0.76,
    length: 2.3,
    bodyWidth: 1.3,
    halfTrack: 0.58,
    turnRadius: 3.2,
    yawRate: 13,
    tagline: 'Turns on a dime, but gets shoved around and drag hurts light cars in flight',
  },
  {
    id: 'tub',
    name: 'Bathtub',
    price: 5,
    mass: 250,
    cdA: 1.05,
    clA: 1.45,
    length: 2.7,
    bodyWidth: 1.5,
    halfTrack: 0.72,
    turnRadius: 3.8,
    yawRate: 8,
    tagline: 'A lifting body that floats in the air, but it wallows through the turns',
  },
  {
    id: 'sedan',
    name: 'Sedan',
    price: 15,
    mass: 620,
    cdA: 0.76,
    length: 4.3,
    bodyWidth: 1.72,
    halfTrack: 0.8,
    turnRadius: 4.6,
    yawRate: 10,
    tagline: 'Planted and slippery, holds its own in a shove, but 660\u00a0kg needs a strong engine',
  },
  {
    id: 'pickup',
    name: 'Pickup 4x4',
    price: 25,
    mass: 1000,
    cdA: 0.95,
    gripMul: 1.35,
    gearing: 1.1,
    length: 5.1,
    bodyWidth: 1.92,
    halfTrack: 0.9,
    turnRadius: 5.4,
    yawRate: 8.5,
    tagline: 'A tall-geared 4WD bulldozer that wins every shove, but slow to turn, stop and jump',
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
    gearing: 0.82,
    wheelWidth: 0.13,
    brakeForce: 6500,
    spinResist: 0,
    tagline: 'Free-rolling and light, but they spin, slide wide, and lose 25% at each track',
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 10,
    mass: 60,
    mu: 0.95,
    crr: 0.021,
    bumpLoss: 0.07,
    gearing: 1,
    wheelWidth: 0.24,
    brakeForce: 9500,
    spinResist: 0.2,
    tagline: 'Good grip for turns and brakes, and only 7% lost at each track',
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
    gearing: 1.15,
    wheelWidth: 0.5,
    brakeForce: 13000,
    spinResist: 0.5,
    tagline: 'Huge grip, brakes and gearing, roll over tracks, but heavy and draggy',
  },
];

const ENGINES: OptionDef[] = [
  {
    id: 'mower',
    name: 'Lawnmower',
    price: 0,
    mass: 30,
    power: 5000,
    topSpeed: 16,
    tagline: 'Free and light, but only 5\u00a0kW: it putters along',
  },
  {
    id: 'v8',
    name: 'V8',
    price: 20,
    mass: 250,
    power: 130_000,
    topSpeed: 26,
    tagline: '130\u00a0kW of shove for $20, but wheel-driven: bad tyres just spin',
  },
  {
    id: 'jet',
    name: 'Jet',
    price: 35,
    mass: 350,
    power: 140_000,
    jet: true,
    thrustCap: 12_000,
    topSpeed: 27.5,
    tagline: 'Thrust ignores grip and pushes even in the air, but heavy and pricey',
  },
];

// Boost bottles: the meter starts full, refills from drifts and items, and whatever is left at the
// lip is wasted. A bigger bottle banks more of it.
const BOOSTS: OptionDef[] = [
  {
    id: 'can',
    name: 'Nitro can',
    price: 0,
    mass: 8,
    boost: 1.5,
    tagline: 'Free and light, but only 1.5\u00a0s of boost: spend it before a drift refills it',
  },
  {
    id: 'bottle',
    name: 'Bottle',
    price: 10,
    mass: 25,
    boost: 3,
    tagline: '3\u00a0s of boost: enough to bank Lombard’s drifts for the run to the kicker',
  },
  {
    id: 'big',
    name: 'Big bottle',
    price: 20,
    mass: 60,
    boost: 4.5,
    tagline: '4.5\u00a0s to boost all race and still dump plenty on the pier, but 60\u00a0kg',
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
    downforce: 2.4,
    tagline: 'Downforce for grip in fast turns and a little lift in the air, for a little drag',
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
  {
    id: 'blunt',
    name: 'Blunt',
    price: 0,
    mass: 0,
    cdA: 0.5,
    ram: 'bull',
    tagline: 'A free bull bar that shoves rivals hard, but it pushes a wall of air',
  },
  {
    id: 'wedge',
    name: 'Wedge',
    price: 8,
    mass: 20,
    cdA: 0.1,
    ram: 'wedge',
    tagline: 'Scoops rivals off their wheels and cuts most of the drag',
  },
  {
    id: 'cone',
    name: 'Cone',
    price: 15,
    mass: 40,
    cdA: 0.0,
    ram: 'spike',
    tagline: 'No extra drag at all, but the priciest and heaviest, and no bite in a shove',
  },
];

const BOOSTERS: OptionDef[] = [
  { id: 'none', name: 'None', price: 0, mass: 0, tagline: 'Keep the money' },
  {
    id: 'rocket',
    name: 'Launch rocket',
    price: 15,
    mass: 30,
    nitroJ: 95_000,
    tagline: 'Fires at the lip for a +95\u00a0kJ kick: huge on light cars, small on heavy ones',
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
  { id: 'midnight', name: 'Midnight', price: 0, mass: 0, color: '#2b2440', tagline: 'Cosmetic' },
  { id: 'bone', name: 'Bone', price: 0, mass: 0, color: '#e9e0c8', tagline: 'Cosmetic' },
];

const TOPPERS: OptionDef[] = [
  { id: 'none', name: 'None', price: 0, mass: 0, tagline: 'Clean roofline' },
  { id: 'tophat', name: 'Top hat', price: 0, mass: 1, tagline: 'Cosmetic: very distinguished' },
  { id: 'flag', name: 'Flag', price: 0, mass: 2, tagline: 'Cosmetic: flies your colours' },
  { id: 'duck', name: 'Rubber duck', price: 0, mass: 1, tagline: 'Cosmetic: squeak' },
  { id: 'cone', name: 'Traffic cone', price: 0, mass: 2, tagline: 'Cosmetic: borrowed from the pier' },
  { id: 'pumpkin', name: 'Pumpkin', price: 0, mass: 2, tagline: 'Cosmetic: carved, candle lit' },
  { id: 'ghost', name: 'Ghost', price: 0, mass: 1, tagline: 'Cosmetic: boo' },
  { id: 'bat', name: 'Bat', price: 0, mass: 1, tagline: 'Cosmetic: flaps all race' },
  { id: 'witch', name: 'Witch hat', price: 0, mass: 1, tagline: 'Cosmetic: banded in your colours' },
  { id: 'spider', name: 'Spider', price: 0, mass: 1, tagline: 'Cosmetic: lives here now' },
];

function withSlot(slot: SlotId, defs: OptionDef[]): PartOption[] {
  return defs.map((d) => ({ ...d, slot }));
}

export const PARTS: Record<SlotId, PartOption[]> = {
  chassis: withSlot('chassis', CHASSIS),
  wheels: withSlot('wheels', WHEELS),
  engine: withSlot('engine', ENGINES),
  boost: withSlot('boost', BOOSTS),
  wing: withSlot('wing', WINGS),
  nose: withSlot('nose', NOSES),
  booster: withSlot('booster', BOOSTERS),
  paint: withSlot('paint', PAINTS),
  topper: withSlot('topper', TOPPERS),
};

/** Default paint per player so the two cars differ until someone picks a paint. */
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
  const bottle = getOption('boost', config.boost);
  const booster = getOption('booster', config.booster);
  const nose = getOption('nose', config.nose);

  let mass = 0;
  let cdA = 0;
  let clA = 0;
  let apexClA = 0;
  let apexCdA = 0;
  let apexTrim = 0;
  let price = 0;
  let downforce = 0;
  for (const o of opts) {
    mass += o.mass;
    downforce += o.downforce ?? 0;
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
    // Tyres lose a little grip under load, so heavy cars corner and brake a little worse.
    mu: (wheels.mu ?? 0.9) * loadFactor(mass),
    traction: (wheels.mu ?? 0.9) * (chassis.gripMul ?? 1) * loadFactor(mass),
    power: engine.power ?? 0,
    boostCap: bottle.boost ?? 0,
    isJet: engine.jet === true,
    thrustCap: engine.jet ? (engine.thrustCap ?? Infinity) : Infinity,
    // Wheel size is the gearing: small wheels rev the engine out sooner. A jet doesn't care.
    topSpeed: (engine.topSpeed ?? 30) * (engine.jet ? 1 : (wheels.gearing ?? 1) * (chassis.gearing ?? 1)),
    crr: wheels.crr ?? 0.015,
    bumpLoss: wheels.bumpLoss ?? 0.05,
    nitroJ: booster.nitroJ ?? 0,
    kite: booster.kite ?? null,
    price,
    length: chassis.length ?? 3,
    width: Math.max(chassis.bodyWidth ?? 1.6, 2 * ((chassis.halfTrack ?? 0.7) + (wheels.wheelWidth ?? 0.2))),
    turnRadius: chassis.turnRadius ?? 4,
    // Heavier cars answer the wheel more slowly.
    yawResponse: (chassis.yawRate ?? 9) * Math.pow(450 / mass, 0.2),
    brakeForce: wheels.brakeForce ?? 9000,
    downforce,
    ram: nose.ram ?? 'bull',
    jumpSpeed: jumpSpeedFor(mass),
    spinResist: wheels.spinResist ?? 0,
  };
}

/** Tyre load sensitivity: grip per kilogram falls slowly with weight (1 at 450 kg). */
export function loadFactor(mass: number): number {
  return Math.pow(450 / mass, 0.1);
}

/** The Jump item's take-off speed: a fixed spring, so heavier cars jump lower (about 3 m to 1.8 m,
 *  enough for anything to clear a hedge). */
export function jumpSpeedFor(mass: number): number {
  const h = Math.min(3.2, Math.max(1.8, 3.1 * Math.sqrt(450 / mass)));
  return Math.sqrt(2 * 9.81 * h);
}

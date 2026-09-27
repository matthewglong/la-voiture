// Shared data types. No Three.js or DOM imports: the Node balance script uses these too.

export const SLOT_ORDER = [
  'chassis',
  'wheels',
  'engine',
  'fuel',
  'wing',
  'nose',
  'booster',
  'paint',
  'topper',
] as const;

export type SlotId = (typeof SLOT_ORDER)[number];

/** Slots that change the physics. Paint and Topper are cosmetic. */
export const PERFORMANCE_SLOTS: readonly SlotId[] = [
  'chassis',
  'wheels',
  'engine',
  'fuel',
  'wing',
  'nose',
  'booster',
];

/** A car is one option id per slot. */
export type CarConfig = Record<SlotId, string>;

export interface KiteSpec {
  /** Lift area of the kite canopy (m²), before the cap. */
  clA: number;
  /** Maximum kite lift (N). */
  liftCap: number;
  /** Extra drag area while the kite is open (m²). */
  cdA: number;
}

export interface PartOption {
  id: string;
  slot: SlotId;
  name: string;
  price: number;
  mass: number;
  /** One line that states the tradeoff. */
  tagline: string;
  /** Chassis: base drag area. Other slots: added drag area. */
  cdA?: number;
  /** Added lift area (m²). */
  clA?: number;
  /** Folded until the top of the arc, then springs open (glider wings): clA and openCdA apply once open. */
  opensAtApex?: boolean;
  /** Extra drag area once the wings are open (m²). */
  openCdA?: number;
  /** Open wings trim to a glide: their lift is capped at this multiple of the car's weight. */
  trim?: number;
  /** Chassis grip multiplier (4WD). */
  gripMul?: number;
  /** Wheels: tyre friction coefficient. */
  mu?: number;
  /** Wheels: rolling-resistance coefficient. */
  crr?: number;
  /** Wheels: fraction of kinetic energy lost on each cable-car track bump. */
  bumpLoss?: number;
  /** Engine: power (W). */
  power?: number;
  /** Engine: thrust engine that ignores grip. */
  jet?: boolean;
  /** Engine: maximum thrust (N) for a jet. */
  thrustCap?: number;
  /** Engine: top speed on standard wheels (m/s); the push fades out as it nears it. */
  topSpeed?: number;
  /** Wheels: gearing, which scales a wheel-driven engine's top speed. */
  gearing?: number;
  /** Wheels: share of the power they can't put down that is burned anyway (wheelspin). */
  spinWaste?: number;
  /** Fuel tank: energy (J). */
  energy?: number;
  /** Booster: kinetic energy added at the lip (J). */
  nitroJ?: number;
  /** Booster: kite that opens at the lip. */
  kite?: KiteSpec;
  /** Paint: CSS hex colour. */
  color?: string;
  /** Chassis: footprint length and body width (m). */
  length?: number;
  bodyWidth?: number;
  /** Chassis: distance from the centreline to the wheel hubs, before the wheel width (m). */
  halfTrack?: number;
  /** Chassis: tightest turning circle radius (m). */
  turnRadius?: number;
  /** Chassis: how quickly the car answers the wheel (1/s), before the mass effect. */
  yawRate?: number;
  /** Wheels: tyre width (m), which widens the footprint. */
  wheelWidth?: number;
  /** Wheels: most braking force the brakes can deliver (N). */
  brakeForce?: number;
  /** Wheels: how much of a spin-out the tyres shrug off (0..1). */
  spinResist?: number;
  /** Wing: downforce area on the road (m²): extra grip that grows with speed. */
  downforce?: number;
  /** Nose: what a hit with it does to the other car. */
  ram?: RamKind;
}

/** Bull bar: shoves hard. Wedge: scoops the other car up. Spike: no special effect, just slippery. */
export type RamKind = 'bull' | 'wedge' | 'spike';

export interface CarStats {
  /** Total mass (kg). */
  mass: number;
  /** Drag area used on the road and in the air (m²). The kite adds more once open. */
  cdA: number;
  /** Lift area in flight from the body and fixed wings (m²). */
  clA: number;
  /** Extra lift area of wings that spring open at the top of the arc (m²). */
  apexClA: number;
  /** Extra drag area of those wings once open (m²). */
  apexCdA: number;
  /** Cap on the open wings' lift, as a multiple of the car's weight. */
  apexTrim: number;
  /** Tyre grip for cornering and braking (the wheels, a little less on heavy cars). */
  mu: number;
  /** Grip for putting power down (4WD multiplies it). */
  traction: number;
  /** Engine power (W). */
  power: number;
  /** Fuel energy (J). */
  energy: number;
  isJet: boolean;
  /** Maximum jet thrust (N). Infinity for wheel-driven engines. */
  thrustCap: number;
  /** Speed at which the engine stops pushing (m/s). Gravity can still take the car past it. */
  topSpeed: number;
  /** Share of the power the tyres can't use that is burned anyway (wheelspin). */
  spinWaste: number;
  crr: number;
  bumpLoss: number;
  nitroJ: number;
  kite: KiteSpec | null;
  price: number;
  /** Footprint (m) for collisions. */
  length: number;
  width: number;
  /** Tightest turning radius (m). */
  turnRadius: number;
  /** Steering response (1/s): chassis agility, slowed by mass. */
  yawResponse: number;
  /** Braking force (N), limited in use by grip. */
  brakeForce: number;
  /** Downforce area on the road (m²). */
  downforce: number;
  ram: RamKind;
  /** Vertical launch speed of the Jump item (m/s): heavier cars jump lower. */
  jumpSpeed: number;
  /** Share of a spin-out the tyres shrug off (0..1). */
  spinResist: number;
}

export type PlayerIndex = 0 | 1;

// The maps. A map is an event on a venue:
//   - a venue (src/maps/<venue>.ts) is a course and what lives on it: the item boxes, the traffic
//     and tourists, the HUD strip's landmarks, the solo splits and starts, the tips. Its scenery is
//     registered under the same id in src/scene/maps.ts.
//   - an event is what's raced there: a mode (src/modes.ts), laps, and a line for the garage.
// One venue can host several events (Russian Hill has the long jump and a race to the Bay), and they
// share everything: the course, the traffic, the scenery. The race sim, the CPU, the HUD and the
// balance scripts read maps only through MapDef. No Three.js or DOM imports.
import { MODES, type Mode, type ModeRules } from '../modes';
import { MAX_CLIMB } from '../sim/physics';
import type { RaceSim } from '../sim/race';
import { courseProblems, type Course } from '../track';
import { CNM_VENUE } from './castroNoeMission';
import { OSG_VENUE } from './oldStompingGrounds';
import { RUSSIAN_HILL_VENUE } from './russianHill';
import { TWIN_PEAKS_VENUE } from './twinPeaks';

export type { Mode } from '../modes';

/** Where a solo run can start (s: arc length; null: the grid). */
export interface SoloStart {
  id: string;
  name: string;
  what: string;
  s: number | null;
}

export interface Venue {
  /** Also the scenery's id (src/scene/maps.ts). */
  id: string;
  /** Shown in the garage and the results. */
  name: string;
  course: Course;
  /** Rows of item boxes across the road (arc length, and offsets from the centreline). */
  boxes: { s: number; ds: number[] }[];
  /** Put the traffic and tourists out for a round (with the round's seeded RNG). */
  populate?(sim: RaceSim, rng: () => number): void;
  /** Landmarks on the HUD's course strip (arc length). */
  strip: { label: string; s: number }[];
  /** Solo split points along the course (arc length; on a loop, every lap). */
  splits: { label: string; s: number }[];
  /** Where a solo run can start. */
  starts: SoloStart[];
  /** Stretches the tips talk about (arc lengths), for the one-off hints. */
  hints: {
    /** Empty the boost here: the run to the lip. */
    boostDump?: [number, number];
    /** Hop the hedges here (with a Jump item). */
    hedges?: [number, number];
    /** A shortcut through here is a hedge hop. */
    hedgeHop?: [number, number];
    /** What's hopped there (default 'hedge': Lombard's flower beds; Buena Vista's are walls). */
    hopName?: string;
    /** Before here a corner is a good place to learn to drift. */
    driftUntil?: number;
  };
  /** Where the wind forecast's head- or tailwind applies ("on the straight"), if not everywhere. */
  windWhere?: string;
  /** The countdown card's tip, and a warning line (shown instead of the mode's). */
  tip?: string;
  warn?: string;
  /** Named arc lengths along the route (the test hooks and the balance check read them). */
  marks?: Record<string, number>;
}

export interface EventDef {
  /** The map's id (?map=...). */
  id: string;
  mode: Mode;
  /** Laps round a loop (ignored point to point). */
  laps?: number;
  /** One line on what the event is. */
  blurb: string;
  /** Overrides for this event (a different tip, fewer starts...). */
  tip?: string;
  warn?: string;
  starts?: SoloStart[];
}

export interface MapDef extends Omit<Venue, 'id'> {
  id: string;
  /** The venue it's raced on (the scenery's id). */
  venue: string;
  mode: Mode;
  rules: ModeRules;
  /** Laps in a race (1 point to point). */
  laps: number;
  blurb: string;
}

/** An event on a venue. Checks the course is sound (courseProblems) and can host the mode. */
export function defineMap(venue: Venue, ev: EventDef): MapDef {
  const problems = courseProblems(venue.course, { maxClimb: MAX_CLIMB });
  if (problems.length) throw new Error(`${ev.id}: the course doesn't hold up:\n- ${problems.join('\n- ')}`);
  const rules = MODES[ev.mode];
  rules.check(venue.course, ev.id);
  const { id: venueId, ...rest } = venue;
  return {
    ...rest,
    id: ev.id,
    venue: venueId,
    mode: ev.mode,
    rules,
    laps: rules.laps(venue.course, ev.laps ?? 1),
    blurb: ev.blurb,
    tip: ev.tip ?? venue.tip,
    warn: ev.warn ?? venue.warn,
    starts: ev.starts ?? venue.starts,
  };
}

export const RUSSIAN_HILL_MAP: MapDef = defineMap(RUSSIAN_HILL_VENUE, {
  id: 'russian-hill',
  mode: 'jump',
  blurb: 'Down the hill, through Lombard St, off the pier: furthest splash wins',
});

export const RUSSIAN_HILL_RACE: MapDef = defineMap(RUSSIAN_HILL_VENUE, {
  id: 'russian-hill-race',
  mode: 'race',
  blurb: 'Down the hill, through Lombard St and off the pier: first into the Bay wins',
  tip: 'Tap the brake while turning to DRIFT: tighter corners, and it fills your boost · Empty the boost on the pier · The kicker is the finish line · Gas as “1” fades: rocket start',
});

export const TWIN_PEAKS_MAP: MapDef = defineMap(TWIN_PEAKS_VENUE, {
  id: 'twin-peaks',
  mode: 'race',
  laps: 3,
  blurb: 'Three laps up and over Twin Peaks: first across the line wins',
});

export const OLD_STOMPING_GROUNDS_MAP: MapDef = defineMap(OSG_VENUE, {
  id: 'old-stomping-grounds',
  mode: 'race',
  laps: 3,
  blurb: 'The Haight, Alamo Square, Hayes Valley, Duboce and Buena Vista: three laps of the old neighbourhood',
});

export const CASTRO_NOE_MISSION_MAP: MapDef = defineMap(CNM_VENUE, {
  id: 'castro-noe-mission',
  mode: 'race',
  laps: 3,
  blurb: 'The Castro, over the hill to Noe Valley, down into the Mission and up through Dolores Park: three laps',
});

export const MAPS: readonly MapDef[] = [RUSSIAN_HILL_MAP, RUSSIAN_HILL_RACE, TWIN_PEAKS_MAP, OLD_STOMPING_GROUNDS_MAP, CASTRO_NOE_MISSION_MAP];

export function mapById(id: string | null | undefined): MapDef | null {
  return MAPS.find((m) => m.id === id) ?? null;
}

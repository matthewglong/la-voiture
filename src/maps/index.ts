// The maps: a course, what to race on it (the long jump or laps), and what lives on it (item boxes,
// traffic, tourists). The race sim, the CPU and the balance check use these; the scenery for each
// map lives in src/scene/maps.ts. No Three.js or DOM imports.
import type { RaceSim } from '../sim/race';
import type { Course } from '../track';
import { RUSSIAN_HILL, SF_MARKS, populateRussianHill } from './russianHill';
import { TWIN_PEAKS, populateTwinPeaks } from './twinPeaks';

/** The long jump (point to point, furthest splash wins) or a lap race (first home wins). */
export type Mode = 'jump' | 'race';

export interface MapDef {
  id: string;
  /** Shown in the garage and the results. */
  name: string;
  mode: Mode;
  /** One line on what the event is. */
  blurb: string;
  course: Course;
  /** Laps in a race (1 for the long jump). */
  laps: number;
  /** Rows of item boxes across the road (arc length, and offsets from the centreline). */
  boxes: { s: number; ds: number[] }[];
  /** Put the traffic and tourists out for a round (with the round's seeded RNG). */
  populate?(sim: RaceSim, rng: () => number): void;
  /** Landmarks on the HUD's course strip (arc length). */
  strip: { label: string; s: number }[];
  /** Solo split points along the course (arc length; on a loop, every lap). */
  splits: { label: string; s: number }[];
  /** Where a solo run can start (null: the grid). */
  starts: { id: string; name: string; what: string; s: number | null }[];
  /** Stretches the tips talk about (arc lengths), for the one-off hints. */
  hints: {
    /** Empty the boost here: the run to the lip. */
    boostDump?: [number, number];
    /** Hop the hedges here (with a Jump item). */
    hedges?: [number, number];
    /** A shortcut through here is a hedge hop. */
    hedgeHop?: [number, number];
    /** Before here a corner is a good place to learn to drift. */
    driftUntil?: number;
  };
}

const M = SF_MARKS;

export const RUSSIAN_HILL_MAP: MapDef = {
  id: 'russian-hill',
  name: 'Russian Hill',
  mode: 'jump',
  blurb: 'Down the hill, through Lombard St, off the pier: furthest splash wins',
  course: RUSSIAN_HILL,
  laps: 1,
  boxes: [
    { s: 62, ds: [-4.2, 0, 4.2] },
    { s: M.hydeS0 + 30, ds: [-4.2, 0, 4.2] },
    { s: M.lombardS0 + (M.lombardS1 - M.lombardS0) * 0.46, ds: [-2.2, 2.2] },
    { s: M.lombardS1 + 34, ds: [-4.2, 0, 4.2] },
    { s: M.pierS0 + 6, ds: [-4.2, 0, 4.2] },
  ],
  populate: populateRussianHill,
  strip: [
    { label: 'START', s: 0 },
    { label: 'HYDE', s: M.hydeS0 },
    { label: 'LOMBARD', s: M.lombardS0 },
    { label: 'PIER', s: M.pierS0 },
  ],
  splits: [
    { label: 'HYDE', s: M.hydeS0 },
    { label: 'LOMBARD', s: M.lombardS0 },
    { label: 'LEAVENWORTH', s: M.lombardS1 },
    { label: 'PIER', s: M.pierS0 },
  ],
  starts: [
    { id: 'top', name: 'The top', what: 'the whole run', s: null },
    { id: 'hyde', name: 'Larkin St', what: 'the fast Hyde St corners', s: RUSSIAN_HILL.sections.find((q) => q.kind === 'intersection')!.s0 + 1 },
    // Just round the Hyde St corner: the cable car waits at the far end (see RaceSim.placeStart).
    { id: 'lombard', name: 'Hyde St', what: 'Lombard’s switchbacks', s: M.hydeS0 + 4 },
    { id: 'final', name: 'Leavenworth', what: 'the last blocks and the jump', s: M.lombardS1 + 3 },
  ],
  hints: {
    boostDump: [M.embS0 - 20, M.embS0],
    hedges: [M.lombardS0 - 25, M.lombardS0 + 20],
    hedgeHop: [M.lombardS0, M.lombardS1 + 6],
    driftUntil: M.lombardS1,
  },
};

const tp = (name: string): number => TWIN_PEAKS.sections.find((q) => q.name === name)!.s0;

export const TWIN_PEAKS_MAP: MapDef = {
  id: 'twin-peaks',
  name: 'Twin Peaks',
  mode: 'race',
  blurb: 'Three laps up and over Twin Peaks: first across the line wins',
  course: TWIN_PEAKS,
  laps: 3,
  boxes: [
    { s: tp('Turn 1') - 30, ds: [-4.4, 0, 4.4] },
    { s: tp('The Switchbacks') + 90, ds: [-4.4, 0, 4.4] },
    { s: tp('The Drop') + 20, ds: [-4.4, 0, 4.4] },
    { s: tp('The Sweeper') + 70, ds: [-4.4, 0, 4.4] },
  ],
  populate: populateTwinPeaks,
  strip: [
    { label: 'START', s: TWIN_PEAKS.startS },
    { label: 'CLIMB', s: tp('The Switchbacks') },
    { label: 'SUMMIT', s: tp('Summit Hairpin') },
    { label: 'DROP', s: tp('The Drop') },
    { label: 'CHICANE', s: tp('Chicane') },
  ],
  splits: [
    { label: 'SUMMIT', s: tp('Summit Hairpin') },
    { label: 'SWEEPER', s: tp('The Sweeper') },
  ],
  starts: [{ id: 'top', name: 'The grid', what: 'a full race', s: null }],
  hints: {
    driftUntil: Infinity,
  },
};

export const MAPS: readonly MapDef[] = [RUSSIAN_HILL_MAP, TWIN_PEAKS_MAP];

export function mapById(id: string | null | undefined): MapDef | null {
  return MAPS.find((m) => m.id === id) ?? null;
}

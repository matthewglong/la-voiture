// Modes: what an event is raced for. A mode is one set of rules that the whole game reads (the
// sim, the CPU, the HUD, the garage and the results), so a new mode is a new entry here rather
// than new branches all over the code. The course decides the rest: a race runs laps on a loop,
// or from the top to the bottom point to point (ending at a kicker: first into the water wins).
// No Three.js or DOM imports.
import type { Course } from './track';
import { fmtTime } from './ui/format';

/** The long jump (furthest splash wins) or a race (first home wins). */
export type Mode = 'jump' | 'race';

/** What a run is scored on: how far it flew from the lip, or how long it took to get home. */
export type Score = 'distance' | 'time';

export interface ModeRules {
  id: Mode;
  score: Score;
  /** Is score a better than score b (further, or quicker)? */
  better(a: number, b: number): boolean;
  /** A score as the HUD and the garage show it: "123.4 m" or "1:02.3". */
  format(v: number): string;
  /** The garage's event chip for a course: "🪂 Long jump", "🏁 Race · 3 laps", "🏁 Sprint". */
  chip(course: Course, laps: number): string;
  /** Where the run ends, as the straggler's clock says it: "the lip", "the flag". */
  goal(course: Course): string;
  /** HYPE pays off: it boosts the launch at the lip, so the HUD shows its meter. */
  hype: boolean;
  /** The kicker drops once the first car is off it (whoever is behind launches lower). */
  kickerDrops: boolean;
  /** Laps to race: the map's, or what was asked for. */
  laps(course: Course, mapLaps: number, asked?: number): number;
  /** The time limit (s): past it, anyone still on the road is out. */
  maxTime(course: Course, laps: number): number;
  /** The countdown card's warning (shown racing two, not solo), if the mode has one. */
  warn?: string;
  /** Throws if the course can't host this mode. */
  check(course: Course, mapId: string): void;
}

/** The long jump's time limit (s). */
export const JUMP_TIME = 150;
/** A race allows its distance at a crawl (this, m/s) plus a minute. */
const RACE_CRAWL = 6;

const further = (a: number, b: number): boolean => a > b + 0.005;
const quicker = (a: number, b: number): boolean => a < b - 0.005;

export const MODES: Record<Mode, ModeRules> = {
  jump: {
    id: 'jump',
    score: 'distance',
    better: further,
    format: (v) => `${v.toFixed(1)} m`,
    chip: () => '🪂 Long jump',
    goal: () => 'the lip',
    hype: true,
    kickerDrops: true,
    laps: () => 1,
    maxTime: () => JUMP_TIME,
    warn: '⚠ Be first to the kicker: it drops the moment someone jumps, and the later you get there the lower it is',
    check(course, id) {
      if (!course.lip) throw new Error(`${id}: the long jump needs a course with a lip`);
    },
  },
  race: {
    id: 'race',
    score: 'time',
    better: quicker,
    format: fmtTime,
    chip: (course, laps) => (course.loop ? `🏁 Race · ${laps} laps` : '🏁 Sprint'),
    goal: (course) => (course.lip ? 'the lip' : 'the flag'),
    hype: false,
    kickerDrops: false,
    laps: (course, mapLaps, asked) => (course.loop ? Math.max(1, Math.floor(asked ?? mapLaps)) : 1),
    maxTime: (course, laps) => 60 + (laps * course.length) / RACE_CRAWL,
    check(course, id) {
      if (!course.loop && !course.lip && course.finishS === null) throw new Error(`${id}: a point-to-point race needs a lip or a finish line`);
    },
  },
};

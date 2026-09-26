// The course as a 2D elevation polyline (x forward, y up) with cumulative arc length s.
// Shared by the physics and the visuals. No Three.js or DOM imports.

export type SegmentKind = 'start' | 'block' | 'intersection' | 'embarcadero' | 'pier' | 'kicker';

export interface TrackSegment {
  kind: SegmentKind;
  /** Block/intersection number (0-based); 0 for the others. */
  index: number;
  s0: number;
  s1: number;
  length: number;
  /** Slope angle in radians (negative = downhill). */
  angle: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TrackSample {
  x: number;
  y: number;
  angle: number;
  segment: TrackSegment;
}

export interface Track {
  segments: TrackSegment[];
  /** Arc length of each cable-car track crossing (one per intersection). */
  bumpS: number[];
  bumpX: number[];
  lip: { s: number; x: number; y: number; angle: number };
  /** Height of the start line. */
  startY: number;
  /** Height of the Embarcadero and the pier deck. */
  deckY: number;
  /** x where the Embarcadero meets the pier (the seawall / shoreline). */
  shoreX: number;
  /** x where the kicker starts (end of the flat pier deck). */
  kickerX: number;
  laneZ: readonly [number, number];
}

export const START_LEN = 10;
export const NUM_BLOCKS = 3;
export const BLOCK_LEN = 60;
export const BLOCK_GRADE = 0.18;
export const INTERSECTION_LEN = 12;
export const INTERSECTION_GRADE = 0.03;
export const EMBARCADERO_LEN = 30;
export const PIER_LEN = 40;
export const DECK_Y = 4;
export const KICKER_LEN = 12;
export const KICKER_ANGLE = (25 * Math.PI) / 180;
export const LANE_Z = [-3, 3] as const;

export function buildTrack(): Track {
  const plan: { kind: SegmentKind; index: number; length: number; angle: number }[] = [];
  plan.push({ kind: 'start', index: 0, length: START_LEN, angle: 0 });
  for (let i = 0; i < NUM_BLOCKS; i++) {
    plan.push({ kind: 'block', index: i, length: BLOCK_LEN, angle: -Math.atan(BLOCK_GRADE) });
    plan.push({
      kind: 'intersection',
      index: i,
      length: INTERSECTION_LEN,
      angle: -Math.atan(INTERSECTION_GRADE),
    });
  }
  plan.push({ kind: 'embarcadero', index: 0, length: EMBARCADERO_LEN, angle: 0 });
  plan.push({ kind: 'pier', index: 0, length: PIER_LEN, angle: 0 });
  plan.push({ kind: 'kicker', index: 0, length: KICKER_LEN, angle: KICKER_ANGLE });

  // The hill drops to the Embarcadero, which sits at deck height.
  let drop = 0;
  for (const p of plan) {
    if (p.kind === 'block' || p.kind === 'intersection') drop += -Math.sin(p.angle) * p.length;
  }
  const startY = DECK_Y + drop;

  const segments: TrackSegment[] = [];
  let s = 0;
  let x = 0;
  let y = startY;
  for (const p of plan) {
    const x1 = x + Math.cos(p.angle) * p.length;
    const y1 = y + Math.sin(p.angle) * p.length;
    segments.push({
      kind: p.kind,
      index: p.index,
      s0: s,
      s1: s + p.length,
      length: p.length,
      angle: p.angle,
      x0: x,
      y0: y,
      x1,
      y1,
    });
    s += p.length;
    x = x1;
    y = y1;
  }

  const bumpS: number[] = [];
  const bumpX: number[] = [];
  for (const seg of segments) {
    if (seg.kind === 'intersection') {
      bumpS.push((seg.s0 + seg.s1) / 2);
      bumpX.push((seg.x0 + seg.x1) / 2);
    }
  }

  const last = segments[segments.length - 1];
  const pier = segments.find((g) => g.kind === 'pier')!;
  return {
    segments,
    bumpS,
    bumpX,
    lip: { s: last.s1, x: last.x1, y: last.y1, angle: last.angle },
    startY,
    deckY: DECK_Y,
    shoreX: pier.x0,
    kickerX: last.x0,
    laneZ: LANE_Z,
  };
}

export const TRACK: Track = buildTrack();

export function segmentAt(track: Track, s: number): TrackSegment {
  const segs = track.segments;
  if (s <= segs[0].s0) return segs[0];
  for (const seg of segs) if (s < seg.s1) return seg;
  return segs[segs.length - 1];
}

/** Position and slope at arc length s (clamped to the course). */
export function sampleTrack(track: Track, s: number): TrackSample {
  const seg = segmentAt(track, s);
  const u = Math.min(Math.max(s - seg.s0, 0), seg.length);
  return {
    x: seg.x0 + Math.cos(seg.angle) * u,
    y: seg.y0 + Math.sin(seg.angle) * u,
    angle: seg.angle,
    segment: seg,
  };
}

/** Road surface height at horizontal position x (flat extension beyond both ends). */
export function roadHeightAtX(track: Track, x: number): number {
  const segs = track.segments;
  if (x <= segs[0].x0) return segs[0].y0;
  for (const seg of segs) {
    if (x <= seg.x1) {
      const u = (x - seg.x0) / (seg.x1 - seg.x0);
      return seg.y0 + (seg.y1 - seg.y0) * u;
    }
  }
  return segs[segs.length - 1].y1;
}

/** Road height ignoring the kicker ramp (the flat deck continues under it). */
export function groundHeightAtX(track: Track, x: number): number {
  if (x >= track.kickerX) return track.deckY;
  return roadHeightAtX(track, x);
}

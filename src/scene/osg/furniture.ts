// Old Stomping Grounds on race day, in Russian Hill's furniture (props.ts, as city.ts puts it out):
// a crowd-control barrier along both kerbs of every street the course runs down, a sawhorse
// barricade across the mouth of every cross street it passes, tyre walls round the outside of every
// turn, and the crowd behind them: two deep at the start on Haight, in Hayes Valley's shops block,
// along Duboce by the N Judah and round the turns, thinner elsewhere, and never in front of a shop
// door. They stand on the lines the physics' walls are on (the corridor's edges), so every wall
// down the streets is one you can see. Not in the parks (their edges are the parks' own), in Buena
// Vista (its stone walls are its walls), on the steps, or anywhere inside the course's open ground
// (Alamo Square, lined by alamo.ts). All of it from the course's own sections, so it follows the
// chunks wherever they're laid.
import * as THREE from 'three';
import { pointAt, type Section } from '../../track';
import { Crowd, type Spot } from '../crowd';
import { GeoBuilder, meshOf } from '../geo';
import { barricade, barricadeTexture, barrierPanel, tyreWall, type TyreSpot } from '../props';
import type { Frontage } from '../victorian';
import { along, type Ctx } from './context';
import { kerbside } from './kerbside';
import { CORNER, CROSSING, KERB, STREET_KINDS, WALK, streetArms, type Arm } from './streets';

/** Streets where the crowd stands two deep: shopping streets, and along the streetcars' tracks. (Not
 *  the Mission's long main drags or Market St: two deep there doubled the crowd on Castro, Noe &
 *  Mission to twice Old Stomping Grounds'.) */
const LIVELY = new Set(['shops', 'rails', 'castro', 'noe']);

/** Where each thing stands out from the corridor's edge (m), as Russian Hill has them; a barrier
 *  where the side has no sidewalk (a neighbourhood's own edge beyond it: the wall's parked cars,
 *  the boulevard's medians) stands right on the wall line, on the road. */
const BARRIER = 0.45;
const BARRIER_BARE = 0.15;
const BARRICADE = 0.8;
const TYRES = 0.45;
/** A barrier panel's length (m). */
const PANEL = 2.4;

/** How much a section turns (radians, + right). */
function turnOf(c: Ctx['course'], sec: Section): number {
  let d = pointAt(c, sec.s1).heading - pointAt(c, sec.s0).heading;
  d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
  return d;
}

/** A corner the course really turns at (as streets.ts reads them), or a hairpin. */
function turns(c: Ctx['course'], sec: Section): boolean {
  return (sec.kind === CORNER && Math.abs(turnOf(c, sec)) > 0.4) || sec.kind === 'hairpin';
}

/**
 * The race furniture. `frontages` are the ones buildStreets handed back (a cross street it laid has
 * its pair, so a mouth with none has no street to close off); `noWalk` says where a side has no
 * sidewalk (the crowd doesn't stand there).
 */
export function buildFurniture(ctx: Ctx, frontages: Frontage[], noWalk: (s: number, side: 1 | -1) => boolean): void {
  const c = ctx.course;
  const S = ctx.sinks;
  const rng = ctx.rng;
  const kerb = kerbside(ctx);
  const boards = new GeoBuilder();
  const tyres: TyreSpot[] = [];
  const spots: Spot[] = [];
  const n = c.sections.length;

  // --- Where things stand, in the course's terms (s along it, d across it) ---------------------------
  const samples: { s: number; x: number; z: number }[] = [];
  for (let s = 0; s < c.length; s += 0.5) {
    const p = pointAt(c, s);
    samples.push({ s, x: p.x, z: p.z });
  }
  const locate = (x: number, z: number): { s: number; d: number } => {
    let best = samples[0];
    let bd = Infinity;
    for (const q of samples) {
      const d2 = (q.x - x) ** 2 + (q.z - z) ** 2;
      if (d2 < bd) {
        bd = d2;
        best = q;
      }
    }
    const p = pointAt(c, best.s);
    const u = (x - p.x) * p.tx + (z - p.z) * p.tz;
    const q = pointAt(c, best.s + u);
    return { s: best.s + u, d: -(x - q.x) * q.tz + (z - q.z) * q.tx };
  };
  const things = kerb.things.map((t) => ({ ...t, ...locate(t.x, t.z) }));
  const doors = kerb.doors.map((t) => ({ ...t, ...locate(t.x, t.z) }));
  // Open ground (Alamo Square: the cars drive anywhere in it) is its own; nothing of ours goes in it.
  const open = c.open ?? [];
  const inOpen = (x: number, z: number): boolean => open.some((o) => o.contains(x, z));

  // --- Which cross streets were laid: their frontages come back from buildStreets ------------------
  const laid = (a: Arm): boolean => {
    const hx = Math.cos(a.h);
    const hz = Math.sin(a.h);
    return frontages.some((f) => {
      if (Math.abs(f.ux * hx + f.uz * hz) < 0.98) return false;
      const u = (f.ox - a.x) * hx + (f.oz - a.z) * hz;
      const v = -(f.ox - a.x) * hz + (f.oz - a.z) * hx;
      return u > WALK - 1.5 && u < a.u1 + 1 && Math.abs(Math.abs(v) - (a.road + WALK)) < 0.8;
    });
  };
  // Each crossing's mouths (s0..s1 along the course), by side.
  const mouths = new Map<Section, { side: 1 | -1; s0: number; s1: number }[]>();
  for (const a of streetArms(c)) {
    const { s, d } = locate(a.x, a.z);
    const sec = c.sections[pointAt(c, s).sec];
    if (sec.kind !== CROSSING || !laid(a)) continue;
    const list = mouths.get(sec) ?? [];
    list.push({ side: d > 0 ? 1 : -1, s0: s - a.road, s1: s + a.road });
    mouths.set(sec, list);
  }

  // --- The crowd: how thick it is along the course --------------------------------------------------
  const lively = (s: number, sec: Section): boolean =>
    Math.abs(s - c.startS) < 36 || LIVELY.has(sec.kind);
  const clear = (x: number, z: number, s: number, d: number, side: 1 | -1): boolean => {
    if (things.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < (t.r + 0.45) ** 2)) return false;
    // Not in front of a door (within 0.9 m of one along the street, on this side); the front row at
    // the barrier stands where it likes (race day: the shops' doors are behind it).
    if (Math.abs(d) > pointAt(c, s).hw + 1.7 && doors.some((q) => Math.abs(q.s - s) < 0.9 && q.d * side > 0 && Math.abs(q.d - d) < 4)) return false;
    // Nor by the gantry's posts.
    return !(Math.abs(s - c.startS) < 1.2 && Math.abs(Math.abs(d) - (pointAt(c, s).hw + 1.8)) < 1);
  };
  const fan = (s: number, d: number, side: 1 | -1, onRoad = false): void => {
    const p = along(c, s, d);
    if (!clear(p.x, p.z, s, d, side) || inOpen(p.x, p.z)) return;
    const y = onRoad ? Math.max(p.y, ctx.ground(p.x, p.z)) + 0.03 : p.y + KERB;
    spots.push({ x: p.x, y, z: p.z, face: p.heading - (side * Math.PI) / 2 + (rng() - 0.5) * 0.7 });
  };

  // --- Along the kerbs: barriers, and the crowd behind them -------------------------------------------
  /** Barrier panels on one side from s0 to s1 (on the sidewalk, or on the wall line where there's
   *  none), and the crowd behind them. */
  const kerbRun = (s0: number, s1: number, side: 1 | -1, hw: number): void => {
    if (s1 - s0 < 0.8) return;
    // (A side the course leaves open has no wall to show.)
    const mid = pointAt(c, (s0 + s1) / 2);
    if ((side > 0 ? mid.edgeR : mid.edgeL) === 'open') return;
    let a = s0;
    let bare = noWalk(s0, side);
    for (let s = s0 + 0.5; s < s1; s += 0.5) {
      if (noWalk(s, side) === bare) continue;
      panels(a, s, side, hw, bare);
      a = s;
      bare = !bare;
    }
    panels(a, s1, side, hw, bare);
    // The crowd: two deep where it's lively, a scattering elsewhere; only on a sidewalk.
    for (let s = s0 + rng() * 1.5; s < s1 - 0.3; ) {
      const sec = c.sections[pointAt(c, s).sec];
      const busy = lively(s, sec);
      if (!noWalk(s, side) && rng() < (busy ? 0.85 : 0.5)) fan(s, side * (hw + 1.35 + rng() * (busy ? 0.95 : 0.5)), side);
      s += busy ? 0.95 + rng() * 1.4 : 3.5 + rng() * 4;
    }
  };
  /** Barrier panels from s0 to s1 on one side, stopping short either side of anything standing on
   *  their line. */
  function panels(s0: number, s1: number, side: 1 | -1, hw: number, bare: boolean): void {
    const d = side * (hw + (bare ? BARRIER_BARE : BARRIER));
    const base = (p: { x: number; y: number; z: number }): number => Math.max(p.y + (bare ? 0.03 : KERB), ctx.ground(p.x, p.z));
    const cuts = things
      .filter((t) => Math.abs(t.d - d) < t.r + 0.1 && t.s > s0 - t.r - 0.2 && t.s < s1 + t.r + 0.2)
      .map((t) => [t.s - t.r - 0.12, t.s + t.r + 0.12] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    const pieces: [number, number][] = [];
    let a = s0;
    for (const [c0, c1] of cuts) {
      if (c0 > a) pieces.push([a, c0]);
      a = Math.max(a, c1);
    }
    if (s1 > a) pieces.push([a, s1]);
    for (const [p0, p1] of pieces) {
      if (p1 - p0 < 0.5) continue;
      // As many panels as fit the line they stand on (longer than the centreline round a turn's outside).
      let lineLen = 0;
      for (let s = p0; s < p1; s += 0.5) {
        const pa = along(c, s, d);
        const pb = along(c, Math.min(p1, s + 0.5), d);
        lineLen += Math.hypot(pb.x - pa.x, pb.z - pa.z);
      }
      const k = Math.max(1, Math.round(lineLen / PANEL));
      for (let i = 0; i < k; i++) {
        const pa = along(c, p0 + ((p1 - p0) * i) / k, d);
        const pb = along(c, p0 + ((p1 - p0) * (i + 1)) / k, d);
        if (inOpen(pa.x, pa.z) || inOpen(pb.x, pb.z) || inOpen((pa.x + pb.x) / 2, (pa.z + pb.z) / 2)) continue;
        barrierPanel(S.metal, pa.x, pa.z, pb.x, pb.z, base(pa), base(pb));
      }
    }
  }

  /** Tyres from s0 to s1 on one side (a turn's outside), stacks about a metre apart along their own
   *  line; `fans` of the crowd behind them. */
  const tyreRun = (s0: number, s1: number, side: 1 | -1, hw: number, fans: number): void => {
    const d = side * (hw + TYRES);
    let i = 0;
    for (let s = s0; s <= s1; ) {
      const p = along(c, s, d);
      if (!inOpen(p.x, p.z)) tyres.push({ x: p.x, y: Math.max(p.y, ctx.ground(p.x, p.z)), z: p.z, i: i++ });
      s += 0.95 / (1 + Math.abs(pointAt(c, s).curv) * (hw + TYRES));
    }
    for (let j = 0; j < fans; j++) fan(s0 + rng() * (s1 - s0), side * (hw + 2.2 + rng() * 4), side, true);
  };

  for (let k = 0; k < n; k++) {
    const sec = c.sections[k];
    const next = c.sections[(k + 1) % n];
    const hw = sec.hw;
    const len = sec.s1 - sec.s0;
    const street = STREET_KINDS.has(sec.kind) || (sec.kind === CORNER && !turns(c, sec)) || (sec.kind === CROSSING && len < 8 && turns(c, next));
    if (street) {
      for (const side of [1, -1] as const) kerbRun(sec.s0 + 0.6, sec.s1 - 0.6, side, hw);
    } else if (sec.kind === CROSSING) {
      // Barricades across each laid cross street's mouth; barriers the rest of the way, but for a
      // crossing that carries on into a turn (Hayes into Alamo Square), tyres round its outside past
      // the mouth, as at any turn.
      const turn = turnOf(c, sec);
      const outside = Math.abs(turn) > 0.4 ? (turn > 0 ? -1 : 1) : 0;
      for (const side of [1, -1] as const) {
        const m = (mouths.get(sec) ?? []).filter((q) => q.side === side);
        let a = sec.s0 + 0.6;
        for (const q of m) {
          kerbRun(a, q.s0 + 0.5, side, hw);
          const d = side * (hw + BARRICADE);
          for (let s = Math.max(sec.s0, q.s0) + 1.1; s < Math.min(sec.s1, q.s1) - 0.6; ) {
            const p = along(c, s, d);
            // (Its ends reach 1.1 m either way along the course.)
            if (!inOpen(p.x, p.z) && !inOpen(p.x - p.tx * 1.1, p.z - p.tz * 1.1) && !inOpen(p.x + p.tx * 1.1, p.z + p.tz * 1.1)) {
              barricade(boards, S.metal, p.x, Math.max(p.y, ctx.ground(p.x, p.z)), p.z, -p.heading);
            }
            // 2.3 m apart along their own line (shorter than the centreline's on a turn's inside).
            s += 2.3 / Math.max(0.25, 1 - pointAt(c, s).curv * d);
          }
          // Fans in the side street behind them.
          for (let j = 0; j < 5; j++) fan(q.s0 + 1 + rng() * (q.s1 - q.s0 - 2), side * (hw + 2.2 + rng() * 5), side, true);
          a = q.s1 - 0.5;
        }
        if (side === outside) tyreRun(a + 0.5, sec.s1 + 1, side, hw, 8);
        else kerbRun(a, sec.s1 - 0.6, side, hw);
      }
    } else if (turns(c, sec)) {
      // Tyres round the outside of the turn (+ turns right: the outside is on the left); the fans
      // behind them.
      tyreRun(sec.s0 - 1, sec.s1 + 1, turnOf(c, sec) > 0 ? -1 : 1, hw, 16);
    }
  }

  // --- Assemble -----------------------------------------------------------------------------------
  const boardMat = new THREE.MeshStandardMaterial({ map: barricadeTexture(), roughness: 0.55 });
  ctx.group.add(meshOf(boards, boardMat, 'barricades', true, true));
  if (tyres.length) ctx.group.add(tyreWall(tyres));
  const crowd = new Crowd(spots, rng);
  ctx.group.add(crowd.group);
  ctx.updaters.push((dt, t, cars) => crowd.update(dt, t, cars));
}

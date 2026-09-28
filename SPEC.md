# La Voiture — Spec

Two players build cars on one shared screen, then race each other down a San Francisco hill, through
Lombard Street's switchbacks, along the pier and off a kicker into the Bay. The furthest splash wins.
Or race the same run (first into the Bay wins), or laps round a hilly loop at Twin Peaks (first across
the line wins).

## Events and maps
- The garage picks the **event**: a mode raced on a venue. **The long jump** (Russian Hill): point
  to point, ending at a kicker; the furthest splash wins. **The sprint** (Russian Hill): the same
  course, traffic and scenery, raced for time: the kicker is the finish line, the first car off it
  wins, and it never drops. **The race** (Twin Peaks): a loop, three laps; first across the line
  wins.
- **Modes** are rules the whole game reads (`src/modes.ts`): what a run is scored on (distance from
  the lip, or time), laps, the time limit, whether HYPE boosts the launch and whether the kicker
  drops. A race point to point ends at the course's lip (the launch is the finish; the car flies on
  into the water) or at a finish line, after which the cars brake to a stop in the run-off.
- **Venues** are courses with their traffic, item boxes, strip, splits, starts and scenery; several
  events can share one. Every course gets the same start line, grid and gantry, and a course with a
  lip the same kicker, water and distance buoys, built from its shape.
- Everything below holds for every event unless it says otherwise (the dropping kicker and HYPE's
  launch boost are the long jump's).
- **Elevation matters on the loop:** climbs at up to 11% that the weakest engines crawl up, three
  sharp crests that launch fast cars, and a drop at up to 16%. The ground contours the course
  (cuttings, embankments, the peaks behind) and the chase camera tilts with the road, so the climbs
  look like climbs.
- **Laps:** a lap counts on crossing the start line; backing over it undoes one. After the last lap
  a car takes the flag and cruises on. 25 s after the first car is home, anyone still racing is out
  (as in the long jump).
- A race's results show the times home, the best laps and the session's fastest lap; solo racing is a
  time trial of the full race against a ghost of the best run, with splits every lap.
- **Balance:** `npm run balance` enforces the long jump's rules (below). `npm run balance:race`
  reports how every build does on each race map (a lap of a loop, or the whole sprint); race mode
  has no balance targets yet. `npm run smoke` races the CPU against itself on every map and mode.

## Scope
- **One screen, two players.** Build phase → countdown → race → flight → results → rematch. No
  networking and no backend. A CPU can drive Player 2, or one player can train solo.
- **3D** with Three.js, using a "premium toy" look: procedural primitives, clearcoat car paint,
  shadows, a sky shader, fog, and procedural environment lighting.
- **Scene:** an SF street grid on the hill with pastel Victorian row houses, race barriers and
  cheering crowds; cable-car lines (bumps) at the intersections; Lombard St's brick switchbacks with
  hedges and hydrangeas; the Embarcadero; a pier with a kicker ramp; the Bay with buoys every 10 m;
  the Golden Gate Bridge, Alcatraz, sea lions.
- **Sound:** procedural Web Audio for engines, tyres, bumps, crashes, items, the cable-car bell,
  wind, splashes, the countdown and cheering.
- **Wind:** a random headwind or tailwind each round, shown *before* building.

## Build phase (the garage)
- Both players build at the same time and can change any part until they press READY.
- A tab per slot shows the fitted part and its price. Click a part to fit it; click the fitted part
  again to remove it. A **$100 budget** as a hard cap; every slot has a $0 option.
- Slots: Chassis, Wheels, Engine, Boost (the bottle), Wing, Nose, Booster, then the free cosmetics
  (Paint, Topper).
- Stats: Mass, Power, Boost (seconds), Grip, Handling, Brakes, Drag, Lift.
- **No dominated options:** every paid part must make the top 10% for distance in some wind and be
  the best pick for its slot in some build; every free part must sit on the price/distance front.
  Checked by `npm run balance`, which races every build with the autopilot.

## The race
- **Driving:** throttle, brake (and reverse), steering, boost. Keys, or gamepads. The gas is free.
  Two players share the keyboard (P1: WASD, Left Shift boost, Left Ctrl item, Tab swap; P2: the
  arrows, P boost, ; item, O swap); one player alone drives on the arrows (Shift, Space, Tab).
- **Arcade cornering grip,** and a **drift**: tap the brake while turning at speed; the wheel then
  sets the slide's arc (tighter than grip allows), and letting go ends it. Drifting fills the boost.
- **Boost:** a bottle of a few seconds (the Boost slot sets its size), full at the start, refilled by
  drifting and items. Holding boost pushes the car up to a little past its top speed. What's left at
  the lip is wasted.
- **Handling from the parts:** grip (wheels; tyres lose a little under load), how quickly the nose
  answers (chassis, slowed by weight), the tightest turn (chassis), brakes (wheels, limited by grip
  and weight), downforce (spoiler), top speed (engine × wheel gearing; the wind shifts it).
- **Crests** at the intersections (and on Twin Peaks, at the top of the climb and on the drop)
  launch fast cars into the air.
- **Collisions:** car against car (mass and the nose decide the shove), against walls, Waymos,
  tourists, the cable car, loose cones.
- **Items** from boxes, two held at once with a key to swap which one fires: Jump, Determination,
  Poo, Boost +50%, Full boost (rare), Seagull (chases the rival and blinds them for a moment). The
  odds lean on the race order.
- **HYPE** (0-100) from racing with flair, turned into up to +15% launch speed at the lip (the long
  jump; a race doesn't show it).
- **The kicker drops:** it stands at 25° for the first car off it, then comes down 2° a second to
  12°, so whoever is behind launches lower (about 5% less distance per second behind, at most about
  a third). Racing alone, it never moves.
- **Split screen:** one camera while both cars fit; a fluid split when they don't; it heals when they
  come back together.

## Physics (`src/sim/`, deterministic fixed 1/120 s step)
- Driving in the horizontal plane with gravity along the slope, drag against the wind, rolling
  resistance, tyre grip (rolling within grip, sliding beyond it), a jet that ignores grip.
- **At the lip:** unused boost is wasted; the launch rocket adds its energy; HYPE scales the speed;
  the kite opens. The car leaves along the kicker's slope at that moment (the lip stays over the
  same spot and only comes down).
- **Flight:** gravity, drag against the airspeed, lift perpendicular to it (capped kite; glider wings
  that spring open at the top of the arc and trim to a glide).
- **Score:** the horizontal distance from the lip, along the way the kicker points, to the first
  contact with the water.
- **One sim, one model:** every map and mode runs the same sim, and the CPU plans with the same
  handling formulas (`src/sim/physics.ts`). The one rule that still depends on the course is the
  wind's effect on top speed (see "Wind along the car" in `DECISIONS.md`).

## Rematch
- Both cars are kept exactly as they raced; changed slots and last race's parts are marked. A new
  wind, new traffic and new item luck are rolled. "New players" resets everything.

## Solo training
- Player 2's panel becomes the settings: start from the top, Larkin St, Hyde St or Leavenworth; a
  ghost of the best run from there; traffic and items on or off.
- One car, one screen, split times against the best run. R retries at once, Esc returns to the
  garage.

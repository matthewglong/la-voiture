# La Voiture — decisions log

Choices made while building that `BUILD_PROMPT.md` did not pin down, plus the final balance report.
Where this file and the prompt disagree, the prompt's intent was followed and the reason is given here.

The game has had three shapes: the prompt's turn-based draft and hands-off run-up; the garage (both
players building at once, see "Garage"); and now **the race**, where players drive the cars down a
much longer course with items, traffic, collisions and a split screen. "The race" records every
decision behind that change. The race then got arcade handling with a drift, a boost bottle in place
of fuel, two item slots with more items, and a solo training mode: "Drift, boost and solo" comes
first because it overrides parts of "The race" (those passages now point back to it). Then the keys
were laid out afresh for one player or two, and the kicker started dropping once the first car is
off it ("Keys, and a kicker worth racing to"). Most recently the game got a second event, a lap race
on a new map, and the code was restructured so events and maps can be added: "Two events, and maps"
comes first of all. The older sections that still hold are kept after them.

## Two events, and maps

The request: split the game into two modes, the long jump (what there was) and a race round a loop
with laps, with room to extend the map or add new ones, and elevation that matters: the race goes
uphill and downhill.

### What changed in the structure

- **`src/track.ts` is generic.** It holds the course types, the builders and the queries, and no
  longer any San Francisco. A `Course` is self-contained: its spatial index lives on it (it was a
  module-level global that the next course built would have overwritten), and the old SF-only fields
  (`embX`, `kickerX`, `deckY`, `marks.*`) are gone. What the sim needs of the long jump's ending is
  an optional `lip` (the ramp's start, its base height, the pier where "first to the pier" pays, and
  where the CPU starts saving its boost); Lombard's walled gardens are an optional `garden`; the
  camera's Lombard framing is `wideViews`.
- **Loops.** `Course.loop` makes the arc length wrap: `pointAt`, `heightAt`, `indexAt` and `locate`
  wrap round the seam, and three helpers (`wrapS`, `deltaS`, `crossedS`) replace every raw `s`
  comparison in the sim and the CPU that could straddle it (bumps, shortcuts, gulls, traffic, the
  stuck check, rescues, threats ahead). On a point-to-point course they reduce to the old arithmetic
  exactly.
- **Two ways to build a course.** The long jump's is still straights and arcs laid end to end
  (`src/maps/russianHill.ts`, moved verbatim from the old `track.ts`, heights from its x-only hill).
  A loop is `buildLoop`: nodes with a height each, a closed centripetal Catmull-Rom spline through
  them for the plan, and straight grades from node to node for the height, each change of grade
  rounded over the node's `round` length, or left sharp (a crest that launches fast cars, like the
  city's crossings). Node heights are snapped to the 0.25 m sample grid so a sharp crest lands in one
  sample: straddling two, it split into two smaller breaks and the cars that should have flown didn't.
- **Maps (`src/maps/index.ts`).** A `MapDef` is a course plus what's raced on it (`mode`: `'jump'` or
  `'race'`, and `laps`), its item-box rows, a `populate(sim, rng)` that puts out the traffic and
  tourists, the HUD strip's landmarks, the solo split points and starts, and the tips' ranges. SF's
  traffic placement moved out of the sim into the map, in the same RNG order, so a seed still gives
  the same world. The sim gained small `addTraffic` / `addStalled` / `addCrossing` / `addCone` /
  `addCable` / `addPed` methods for maps to call.
- **Scenery per map (`src/scene/maps.ts`).** A `MapScene` is the static world plus the few things the
  shell drives: the start gantry (faded when the camera looks through it), and, optionally, the kicker,
  the water a splashed car floats in, the record buoy and a per-view hook (the Bay's labels). SF's
  city, landmarks and Bay are wrapped as one; each map's scenery is built the first time it's picked
  and kept. Shared props and textures (asphalt, chequers, banner, trees, tyre stacks, barriers) moved
  out of `city.ts` into `scene/props.ts`.
- **The shell (`main.ts`)** follows `map` instead of importing one course: the garage's event picker
  swaps the scenery, the camera's course, the strip, the splits and the solo starts. Picking an event
  un-READYs both players (a car built for one may not suit the other). `?map=twin-peaks` starts on it;
  Player 1's pad Y cycles events in the garage (outside solo, where Y picks the start).

### The race mode (`src/sim/race.ts`)

- Every car has a `prog` (progress since the start line: the arc length itself point to point; on a
  loop, laps × length + the way round this one) and a `lap`. Race order, gaps, overtakes, the item
  odds and the straggler logic use `prog`. Laps count on crossing the start line; backing over it
  undoes one (drive it again). Lap times are interpolated to the moment of crossing inside the step.
- After the last lap a car takes the flag (`finished`, a new phase) and cruises on at about 11 m/s
  along the middle of the road, still solid, until everyone's done; the sim keeps stepping behind the
  results card so the cool-down lap carries on. The straggler rule is the long jump's: 25 s after the
  first car is home, anyone still racing is out. The time limit scales with the laps (a crawl at
  6 m/s, plus a minute) instead of the jump's 150 s.
- HYPE still builds (the awards use the tallies) but only pays off at a kicker, so the race HUD hides
  its meter. Race awards swap "First to the lip", "Every drop of boost" and "Maxed-out HYPE" for
  "Fastest lap". The session best on a race map is the fastest lap; solo keeps the quickest full run
  and its ghost, with splits at the map's points on every lap and at each lap's end.
- **Wind on a loop:** the drag always took the wind's direction into account, but the engine's
  top-speed shift (`WIND_TOP`) didn't, which is right for a course that runs one way. On a loop it now
  uses the wind's component along the car's heading (a tailwind on the straight is a headwind on the
  way back). The long jump is unchanged. The forecast chip says "on the straight" in race mode.
- **The CPU:** the racing line is solved all the way round a loop (no pinned ends), the speed plan
  brakes back round the seam (two passes), and it spends boost wherever its speed plan shows no
  braking for a good while (the long jump's "save it for the pier" logic only runs with a lip). Item
  choices use progress rather than the pier and kicker marks when there's no lip.

### Twin Peaks (`src/maps/twinPeaks.ts`, `src/scene/twinPeaks.ts`)

- **Layout** (1,056 m, 22 nodes): Portola Straight (the start/finish), a fast right into the climb,
  the switchbacks up at 7-11%, a sharp crest at the top (+11% to flat: fast cars take off at
  15 m/s), the summit hairpin under Sutro Tower, then The Drop: a crest into −12%, a short shelf and a
  second crest into −16%, the long sweeper at the bottom, a chicane and the straight. 26 m of climb.
  Tightest centreline radius 8.7 m (the hairpin; more than the 6.5 m half-width, so the inside edge
  never folds), 49 m between legs at the closest.
- **Grades** were kept inside what the weakest engine can climb: the lawnmower on a light kart holds
  about 16 m/s up 11%; on a pickup it crawls up at about 4 m/s, which is the point.
- **Elevation has to show.** The first version sat the loop on a gentle, road-following surface and
  looked flat: from the chase camera the 10% climb read as level road, and from the air the peaks
  were mounds. The ground now contours the course round a hillside: outside the loop a regional slope
  rising north and east (so the road runs through cuttings and along embankments), the two peaks
  rising up to 96 m beyond the roadside, the valley falling away south of the straight to the houses
  and the city; inside the loop a bowl with a reservoir at the bottom. The bank from the verge widens
  with the height difference, so it's never a cliff, and steep banks show bare earth.
- **The chase camera tilts with the road** on this map (`Course.followGrade` 0.8): it looks up the
  climbs and down the drops, and aims at the road's height where the look-ahead lands. Russian Hill's
  camera was tuned as it is, so its `followGrade` is 0 and it's untouched.
- **Traffic:** two Waymos potter round the loop for ever (backmarkers to lap; they never park), a
  stalled one with a cone on the switchbacks, and tourists at the summit viewpoint. Over 30 CPU-vs-CPU
  races that's 0.3-0.4 Waymo hits a race, against about 1 on Russian Hill.
- **Walls** are all hard to the physics; the scenery chooses the look: tyre walls on the outside of
  the tight bends (instanced, three low-poly tyres a stack: thousands of them as merged tori were a
  million triangles), armco elsewhere, a kerbstone where the road runs onto grass. The scene is about
  225k triangles in 27 meshes (Russian Hill's city alone is about 380k).
- Three laps by default: about 2:15-2:30 for two decent builds.

### What stayed the same

The long jump plays exactly as before: `npm run balance` prints a byte-identical report after the
restructure (every build, every wind), and a two-car jump in the browser still drops the kicker for
the chaser, flies, splashes and puts the record buoy out.

### Race-mode balance: measured, not yet designed

The parts were balanced for the long jump, and `npm run balance` still enforces that. A lap race
rewards different things, so `npm run balance:race` races every affordable build round each loop map
(one lap from a standing start, three winds) and reports, without passing or failing on balance:

- Monster wheels are in every one of the quickest 10% of builds (grip and traction on the hills);
  standard wheels are in none.
- The lawnmower laps in about 92 s against 47 s for a V8 or jet: a three-lap race on it takes about
  4½ minutes. In the long jump the gap is 43 s to 32 s.
- The glider wings, the bathtub and the blunt nose are never the quickest pick for their slot; the
  kite and the launch rocket almost never.

What "balanced" means for racing is a design decision (race-only parts, a separate budget, parts
that do something on the road, or just a different lap count or course), so it's left as data.

### Known limits

- **The seagull trails its target on a fast straight.** It hunts to 7 m behind and only dives from
  inside 7 m, but the target pulls back out of that each step at more than about 12 m/s; it strikes
  when the car slows. This was already so on Russian Hill (checked against the old code); on Twin
  Peaks' long straight it just shows more.
- **The first switch to a map** builds its scenery (about a quarter of a second) in the garage.

## Keys, and a kicker worth racing to

The request: new keys. Alone, the arrows drive, Space drops the item, Shift boosts and Tab swaps
items. Two players: Player 1 keeps W, A, S and D with Shift to boost, Ctrl to use the item and Tab to
swap; Player 2 keeps the arrows with P to boost, ; to use and O to swap; the garage keys stay as they
are. And: make it worth being in the lead ("the entire game feels like a race, but then it's just
the very last leg that really matters, because that's when you build up the speed to ramp off"),
with the suggestion that the jump starts off pointing higher and is progressively lowered, so that
whoever gets there late can't jump as far.

### Keys

| | Gas | Brake | Steer | Boost | Item | Swap items |
|---|---|---|---|---|---|---|
| Two players: Player 1 | W | S | A / D | Left Shift | Left Ctrl | Tab |
| Two players: Player 2 | ↑ | ↓ | ← / → | P | ; | O |
| One player (CPU or solo) | ↑ (or W) | ↓ (or S) | ← / → (or A / D) | either Shift | Space | Tab |

- The layout is picked when a run starts (one player when the CPU drives Player 2 or racing solo).
  The garage's race-keys strip follows the CPU and Solo toggles, and the countdown card, the HUD's
  key chips and the hints read the layout in use. Alone, WASD drives as well as the arrows (the
  garage still uses WASD, so nobody has to swap hands to start); Ctrl, P, ; and O do nothing.
- The old keys are gone (Player 1's Space, Q and E, Player 2's Enter, Right Shift, / and .), so no
  key has two jobs.
- The keydown handler used to ignore every key while Ctrl, Cmd or Alt was held, to leave browser
  shortcuts alone. With Ctrl as Player 1's item key that swallowed the item press itself, and every
  key the other player pressed while Ctrl was down. Now, from the countdown to the end of the
  flight, a driving key reaches the game even with Ctrl held, and is kept from the browser (Ctrl+S,
  Ctrl+D and Ctrl+A do nothing mid-race). Cmd and Alt shortcuts, and Ctrl with any other key, still
  reach the browser, and the garage is unchanged.
- Tab no longer walks the focus mid-race. On the results card, for its first 1.5 s (the grace Enter
  and Space already had), Tab doesn't move the focus onto a button and Enter or Space doesn't press
  one: a swap mashed at the end of a race could otherwise tab onto Rematch and a Space press it.
- **Conflicts a page can't fix.** On macOS, Control with an arrow key is a system shortcut (Mission
  Control, application windows, move a space left or right, all on by default) that the browser
  never sees: if Player 1 taps Ctrl just as Player 2 presses an arrow, the window slides away
  mid-race. Turn those shortcuts off for two-player sessions (System Settings → Keyboard → Keyboard
  Shortcuts → Mission Control); alone, Ctrl isn't used. Ctrl+Tab (both Player 1's keys at once)
  switches browser tabs. On Windows and Linux, Ctrl+W closes the tab and pages can't stop it, so
  Player 1 shouldn't hold Ctrl while pressing W. Gamepads avoid all of it.

### Why the lead didn't matter

The score is the jump, and the jump depends only on the launch: the speed at the lip (the last blocks
and the pier), the boost burned on the pier, the launch rocket and HYPE. Being ahead paid only a
little HYPE (leading 0.3/s, first onto the pier +10, overtakes +6). The autopilot shows the lead
mattering anyway: in mirror matches (the same build for both cars, both on the drifting autopilot,
traffic and items, 120 races) the first car to the lip won 84% of them. But that is because the
autopilot drives the pier the same way every time, so the car ahead is simply the one with more HYPE
and fewer knocks. People differ most in exactly that last leg (when to dump the boost, a clean run
along the pier), so for them the order through the race counted for little, which is the feedback.

### The dropping kicker

Taken from the suggestion, with the trigger made precise:

- **The first car off the kicker gets its full 25°** (exactly the old ramp). From that moment it
  comes down **2° a second, to 12°**, so the gap at the lip turns straight into launch angle: 1 s
  behind is 23°, 3 s is 19°, 6.5 s or more is 12°.
- **Why the first launch starts the clock,** not GO or a par time: a clock from GO would give two
  slow drivers who are racing each other closely flat ramps, would tie solo runs and the balance
  check to the race time, and would shift every part's value with the autopilot's pace. From the
  first launch only the gap counts. A lone car (solo, the balance check, `predict()`) always gets
  25°, so the balance report is unchanged, bit for bit. Racing solo there's nobody to beat to it;
  the ghost doesn't drop it (its run was flown off the full ramp).
- **Why the leader's ramp isn't raised** above 25°: every flight would lengthen, and the best
  tailwind build already flies 179.8 m against the check's 180 m cap.
- **What a second is worth** (a car held on the grid, the calm-air best build, both on the
  autopilot, an empty course): 1 s behind −5%, 1.5 s −8%, 2.5 s −13.5%, 3.5 s −19%, 4.5 s −24%,
  12° (6.5 s or more) −35%. The steeper ramp costs the car some speed on the way up, and a lower lip
  gives some of it back, so in the full sim the angle costs more than in the flight model alone
  (about 2% a degree there). Slow, cheap cars hardly notice: at 12 m/s the all-$0 build flies about
  as far off 12° as off 25°. For scale, full HYPE is worth +25-33% and a well-timed boost dump
  +13-23%.
- **Tuning** (the same 120 mirror matches under each setting: how much shorter the chasing car flew
  than off the old kicker, and how often the first car to the lip won):

  | Drop | < 1 s behind | 1-2 s | 2-4 s | 4 s + | First to the lip wins |
  |---|---|---|---|---|---|
  | none (the old kicker) | 0% | 0% | 0% | 0% | 84% |
  | 1°/s to 10° | −1% | −4% | −8% | −13% | 89% |
  | 1.5°/s to 10° | −1% | −5% | −11% | −19% | 90% |
  | **2°/s to 12°** | −2% | −7% | −15% | −26% | 92% |
  | 2.5°/s to 10° | −2% | −9% | −19% | −31% | 93% |

  The first try, 2.5°/s to 10°, made a 4 s gap cost about as much as full HYPE is worth; 2°/s keeps a
  photo finish a photo finish and still makes a clear lead count. The floor is what a straggler still
  gets, a real jump. With the CPU's six builds mixed (80 races), the first car to the lip won 81% off
  the old kicker and 88% now. It's two constants, `RAMP_RATE` and `RAMP_MIN` in `src/sim/race.ts`.
- **It shows.** A klaxon and the hiss of the rams when it starts; "FULL RAMP!" on the leader's card;
  "⚠ THE RAMP IS DROPPING!" and a HURRY! shout for the chaser, whose card then carries a live hazard
  strip ("⚠ RAMP DROPPING · 19°", "DOWN" once it's at 12°); "RAMP DOWN TO 14°" at the chaser's
  launch; each car's angle in the results; a line on the countdown card. The kicker's amber lamps
  flash while it comes down in front of someone still racing.
- **In the sim** the lip stays over the same spot (so the distance is still measured from it and the
  buoys still line up) and only comes down: the kicker's rise scales by tan(angle)/tan(25°), and
  everything that reads the road's height or grade asks the race (`RaceSim.roadY`, `gradeAt`), so a
  car on the ramp rides down with it (at most a few centimetres a step), poo dropped on it comes down
  too, and the pier crew's push leaves at the angle of the moment. The renderer pitches the car to
  the moving slope.
- **In the scene** the old timber posts couldn't hold up a ramp that moves, so the kicker is a
  plywood leaf hinged to the pier with a steel frame under it, on two hydraulic rams (yellow barrels,
  chrome rods) near the lip. The leaf stretches a little as it drops, so the lip stays over its spot;
  the striped fascia rides down with the lip; amber lamps sit on the lip's corners. It's its own
  module, `src/scene/kicker.ts`.
- **Considered:** a bonus for the first car through each landmark (HYPE or boost at Hyde, Lombard and
  the pier) pays for leading during the race too, but it's one more thing feeding HYPE, already the
  least visible part of the launch; the ramp is plain to see and happens at the moment that decides
  the round. A bonus added to the distance for the finishing order was arbitrary. Either could be
  added later.

## Drift, boost and solo

The feedback, from playing it: there should be a solo/training mode; steering and handling needed
work ("even the best optimized cars can't turn a corner"), with the question of whether drifting is
part of the fix or the fix; each car should hold two power-ups and toggle between them; fuel doesn't
really come into play unless you try to waste it, so should it be a nitro/boost meter that runs out
much faster (pressure-test it); and more power-ups, including a partial and a rare full boost refill,
keeping Determination.

### Why the cars couldn't corner

Measured with scripted keyboard drivers (full lock or nothing, a 0.15 s reaction) on an empty course:
every build arrived at Hyde St's 90° corner at 28-31 m/s and, holding the gas and steering, hit the
tyre wall at about 25 m/s; Lombard's entry corner took 5 s and three or four wall hits. A driver who
braked for the corners still hit walls at 10-13 m/s. The physics was honest: the tyres gave about
1 g sideways (μ 0.85-1.3), so the 7 m city corners wanted 9-12 m/s, and braking from 30 m/s to that
takes 30-40 m of a steep block. The autopilot only got round by braking early to an exact plan;
humans on keys couldn't.

### Handling: arcade grip first, drifting on top

Drifting is part of the fix, not all of it. Making the drift the only way round would put a skill
wall in front of newcomers in a party game, and an automatic drift would take away the skill and its
reward. So there are two layers:

- **Arcade cornering grip.** Sideways grip is 1.6× the tyres' friction (`CORNER_GRIP`; braking and
  traction are unchanged), and full lock now pushes the nose only 15% past what the tyres can follow
  (was 40%), so plain steering grips cleanly instead of sliding wide. Brake to a sensible speed, turn,
  and you're round.
- **Drift: tap the brake while turning at speed** (over 8 m/s). No new key: it's the brake, and the
  thing a panicking newcomer does anyway (brake and turn) now throws the car sideways and gets it
  round. Only a fresh press counts (within 0.2 s of the brake going down): a brake held from before the
  corner gives a normal braking turn, and holding the brake while unwinding a drift doesn't throw you
  into another one the other way. (The first version triggered on a held brake and chained drifts
  into the walls.) After a drift, the next can't start for 0.3 s.
- **The wheel sets the slide's arc** (Mario Kart style): held into the slide, the car turns on 2.4×
  the tyres' friction (1.5× plain cornering, so about 22% more corner speed); with the wheel let go the
  arc widens to 55% of that, and counter-steered it runs nearly straight. Let go for 0.3 s and the tyres
  grip again. The nose holds an angle to the direction of travel (17° let go, 35° held in) that settles
  to nothing as the drift ends, so it doesn't snap straight or over-rotate. The first version let the
  slip angle drive the turn, like a real car: on keys it over-rotated past the exit every time.
- **What a drift costs and pays:** it scrubs a little speed (0.3 g at full bite), leaves the engine
  55% of its traction (no free speed from the throttle), and pushes along the direction of travel.
  It pays in HYPE (as before) and, above all, in **boost** (below).
- A short hop mid-drift (up to 0.35 s, e.g. over the little crest into Lombard) keeps the drift;
  leaving the road mid-turn no longer sets the car spinning in the air (a sedan used to land
  backwards there). Tiny crests are ignored up to 1.6 m/s of drop (was 1.2).
- **Hard wall hits cost more.** Before, a newcomer who never braked and bounced round the corners off
  the tyre walls was *faster* over the lap than a careful driver. Now an impact over 8 m/s into a wall
  takes up to 40% more speed and stuns the car for up to 0.6 s.
- The first hard hit on a corner wall flashes "TAP S WHILE TURNING TO DRIFT!".

With a "reasonable human" driver model (keys only, 0.15 s reaction, looks ahead and brakes to a
corner speed learned by feel ±10%), time to the lip on good builds: grip drivers 32.6-39 s; drifters
32.8-36 s on the kart, Bathtub and Sedan (the Bathtub 33.3 s against 37.5 s on grip). The long Pickup
is the exception: drifting, it gets itself crosswise in a hairpin now and then (a real driver backs
out; the model waits for the 6 s rescue). A newcomer who never brakes is now the slowest (34.6 s in
the kart). The autopilot drives 27-32 s. In the browser, a brake tap on the keys carried 25 m/s
through the Hyde St corner in one drift.

### Fuel → boost: the pressure test

**What fuel did.** It was a hidden budget, engine power × tank energy, burned only on the gas. In
practice careful players never ran out (invisible), careless ones ran dry after Lombard and limped
(harsh, late and confusing), and the only decision it asked for was "lift off the gas to save fuel",
which is the opposite of fun in a racing game. Its real job was in the garage: the tank slot traded
money and weight against how much of the engine you could use.

**What a boost meter changes.**

- The gas becomes free and unlimited: the base car always performs, nobody is ever stranded, and the
  engine and wheels alone set the car's pace.
- The resource becomes a decision every few seconds: spend now (overtake, climb out of a corner,
  recover from a hit) or save it for the pier, where it sets the launch. That is visible and active,
  instead of an invisible reserve.
- It gives the drift a purpose: drifting refills the bottle, so a good corner pays out on the next
  straight. That drift → boost → speed loop is what makes Mario Kart and Burnout feel good.
- Items get a clean new category (refills), and refill odds that favour the chaser are a comeback
  mechanism.

**Risks, and what handles them.**

- *Hoarding* (the launch is the score, so why boost before the pier?). The bottle has a cap, so
  drifting on a full bottle banks nothing: spend some before a run of corners or lose the refill.
  What's left at the lip is still wasted, so you want to arrive empty having burned it on the pier.
  And racing position still pays through HYPE, item odds and first to the pier. The intended rhythm:
  spend on the top blocks and Hyde St, refill through Lombard's drifts, dump it on the pier.
- *Boost at the lip swamping everything else.* The push fades to nothing at 1.1× the engine's top
  speed, and the engines' top speeds came down (below), so a full, well-timed dump adds 8-14% to the
  launch speed of a real build (13-23% more distance), about what full HYPE gives. The rare full
  refill late in the race is then a real comeback without being decisive.
- *No fuel limit makes the V8 and jet stronger.* Rebalanced (below), with the balance check passing.
- *One more button* on a shared keyboard. Boost is on Shift (a modifier key, so it never ghosts the
  others); gamepads have it on the shoulders.

**Verdict: better, as suggested,** and implemented:

- **Bottles** (the old Fuel tank slot, now "Boost"): Nitro can (free, 8 kg, 1.5 s), Bottle ($10,
  25 kg, 3 s), Big bottle ($20, 60 kg, 4.5 s). The meter starts full and drains 1 s per second held.
- **The push:** 6 m/s² along the nose (the same for every car: boost is a driving tool, not a build
  stat), at full strength up to 80% of the ceiling and fading to nothing at 1.1× the engine's top speed
  (wind included). It works in the air (it's a rocket), not while spun out or stunned.
- **Refills:** drifting banks up to 0.5 s of boost per second (more for a fast, tight slide); the Boost
  +50% and Full boost items. A refill used on a full bottle is kept for later rather than wasted.
- **The Launch rocket** (the old Nitro booster, renamed so it isn't confused with the boost) still
  fires once at the lip. Its flames double as the boost flames; cars without one get a pair of small
  boost nozzles in the same place. The bottles are nitrous blue.
- Wheelspin no longer wastes anything: the tyres' "spin waste" is gone with the fuel. Tiny wheels still
  lose traction, grip, brakes and 25% at each track.

### Two item slots and more items

- **Two slots:** a box's item goes in the free slot; the one you already hold stays the one the item
  key uses. The **swap key** (P1 Q or E, P2 / or .; now Tab and O, see "Keys") switches which one fires. With both slots full,
  boxes stay in place for the other car.
- **New items:** ⚡ **Boost +50%** (refills half the bottle), 🌟 **Full boost** (rare: a full
  bottle), 🐦 **Seagull**. 😤 **Determination** stays, and now also shoos a seagull.
- **The seagull** flies down the course above the road (never through the houses), always at least
  18 m/s faster than its target, dives onto the rival's windscreen and flaps there for 1.8 s: the
  victim loses 15% speed, can use only 45% throttle and weaves. A Determined car swats it away. It's
  the chaser's answer to a runaway leader, since poo only works backwards. With nobody left racing
  it just flies off.
- **Odds** (jump / Determination / poo / +50% / full / seagull): leading 26/8/44/18/1/3, within
  30 m 22/18/20/22/4/14, further back 16/24/6/26/10/18, and alone (solo) 34/20/0/36/10/0.

### Solo training

- **🏁 Solo** on Player 2's panel (or `?solo=1`) takes Player 2 off the grid and turns their panel into
  the training settings: where to start (the top, Larkin St for the fast Hyde St corners, Hyde St for
  Lombard's switchbacks, or Leavenworth for the last blocks and the jump), a ghost, traffic and items.
- **The ghost** is a see-through replay of the furthest run from that start, raced alongside you; its
  marker (👻) rides the course strip. **Splits** at Hyde, Lombard, Leavenworth and the pier show
  ±seconds against it as you pass, and the results card lists them all, with the lip.
- **R** starts the run again at once with the same car, wind and traffic (for practising a section);
  **Esc** goes back to the garage. Enter or Space on the results card also retries.
- Starting further down, the start is cleared: traffic on it moves on, and on Hyde St the cable car
  waits at the far end of its line for 12 s, something to steer round rather than a wall at GO (the
  first try started the car right behind it). The camera jumps there behind the white fade.
- One car, one screen: the camera follows Player 1 and never splits, the HUD shows one card, and the
  item odds leave out poo and the seagull.
- Bests and ghosts last for the session, like the session best; New players clears them.

### Controls

(Superseded for the keys: see "Keys" under "Keys, and a kicker worth racing to". The gamepad row
still holds.)

| | Gas | Brake (tap while turning: drift) | Steer | Boost | Item | Swap items |
|---|---|---|---|---|---|---|
| Player 1 | W | S | A / D | Left Shift | Space | Q or E |
| Player 2 | ↑ | ↓ | ← / → | Right Shift | Enter | / or . |
| Gamepad | RT or A | LT or B | stick, d-pad | LB or RB | X | Y |

Solo adds R (retry) and Esc (garage). E and Left Shift were spare item keys for P1, and Right Shift
and / for P2; they now have jobs. (On Windows, pressing Shift five times in a row can open the Sticky
Keys prompt; gamepads avoid it.)

### The CPU

- It drifts the big corners (Hyde St's two, Lombard's entry and its four hairpins): a brake tap at the
  way in, then the wheel sets the arc so its direction of travel follows the racing line, planned at
  80% of the slide's grip round the corner's average bend. That's 1-2 s a race over grip driving,
  with the odd scrape.
- It spends boost down to half a bottle on the straights before Lombard (so the drifts have somewhere
  to go), then dumps the rest on the run to the kicker, starting just early enough to empty it at the
  lip. It uses a refill only when there's road left to burn it, and swaps to the other item when only
  that one is worth using now.
- The balance check's autopilot doesn't drift (it compares the cars, not the driving).

## The race

### Why, and how it's scored

The request: steering, throttle and brakes instead of automatic fuel use; items (a jump,
"determination" to power through the next obstacle, and poo); Waymos and pedestrians that slow or
stop you; knocking into the other player; car parts that matter for steering and weight; a longer,
more dynamic course with Lombard St half way; and a split screen that breaks apart and heals.

The score is still the jump: the horizontal distance from the lip to the splash. That created a
problem: the launch speed only depends on the last couple of hundred metres, so how you raced the
first half would have been pointless. Two things tie the whole race to the jump:

- **HYPE (0-100)** is earned by racing with flair and turned into launch speed at the lip, up to
  **+15%** at full HYPE: a quarter to a third further (+12-16% distance at 50). Sources: drifting
  (3/s), air time (6/s), slipstream (up to 1.5/s), leading (0.3/s), near misses (+4), overtakes (+6),
  shoves (+4, and −3 for the victim), landing a poo on the rival (+8), powering through something
  with Determination (+6), a hedge hop on Lombard (+12), a rocket start (+8), first onto the pier
  (+10). Crashes cost: a Waymo
  (−12, or −5 for a glancing hit), a tourist (−8), a poo spin (−10), a hard wall (−3), a rescue
  (−5). Tuned so a typical race ends between about 30 and 85 and 100 is rare. It's the original
  ideation's "style points", made to matter.
- **Fuel** only burned when you pressed the gas, so what you spent on the way down was not there for
  the run along the pier. (Superseded: the gas is free now, and a boost bottle, refilled by drifting,
  plays that part; see "Fuel → boost".)

The winner is still the furthest splash; the results also show each player's awards (first to the
lip, rocket start, hedge hopper, poo sniper, bully, drift king, Waymo magnet, ...) and a running score of
rounds won.

### The course (now `src/maps/russianHill.ts`; see "Two events, and maps")

- A winding centreline in the horizontal plane, built from straights and arcs, sampled every 0.25 m,
  with a road height, a corridor half-width and a wall type on each edge. Every consumer (physics,
  bots, city, cameras) reads the same course. It has exactly the old waterfront: the Embarcadero
  starts at the same x, so the pier, the kicker, the lip, the Bay, the buoys and the landmarks are
  untouched.
- **Route** (614 m): a 40 m flat start on Greenwich St, two steep blocks (−15%, −17%) with the Larkin
  St intersection between them, a right turn up **Hyde St** (52 m, flat: it runs along the hill's
  contour), a left turn into **Lombard St's crooked block**, then Leavenworth, two more steep blocks
  (−18%, −16%) with Mason St between them, across the Embarcadero, along the pier and up the kicker.
  Street names are borrowed for flavour, not geography.
- The course follows grid streets, so the two Hyde St corners turn inside their intersection squares
  (centreline radius 7 m = the road half-width). The drivable area is then exactly the union of
  ordinary street rectangles, which lets the city be a plain SF grid. Tyre walls line the outside of
  each corner.
- **Lombard:** four 120° hairpins (radius 7 m) joined by 14 m legs at ±60°, on a 9.6 m wide brick
  road, descending 13 m over 121 m of road (10.7%). The switchbacks swing ±14.4 m across a 31 m
  garden band. Lombard's hairpins take 11-13 s. (Five hairpins and a 9.2 m road took 17-30 s, too
  long for a third of the race.)
- **Heights:** the city sits on a hill that only varies along x (the old model), built backwards
  from the Embarcadero at deck height. Streets follow it, so cross streets are flat and x-streets
  slope. Lombard's road descends evenly along its winding length instead, and its gardens are a
  heightfield blended between the legs. The city's land slab is cut out under the block (following
  the hill's average slope, it poked up through the bricks as pale green wedges), and the beds are
  lawn right up to the hedges (a soil border on a square grid stepped along the diagonal hedges like
  a staircase).
- **Crests:** each intersection is almost flat (−2%) and the next block drops at −15 to −18%. The
  sharp grade change launches fast cars into the air: the "Bullitt jumps".
- **Edges:** kerbs (behind race barriers), tyre walls on the corners, rails on the pier, invisible
  walls across the Embarcadero lanes (the Waymos cross there), and **hedges** on Lombard wherever the
  ground beyond the edge is garden. Hedges are the only walls low enough (0.9 m) to jump.
- The start line and grid sit 33 m from the course's back wall, behind the garage camera, so the
  barricade there never blocks the view of the cars.
- Cable-car tracks (the energy-losing bumps) cross the course at Larkin, Leavenworth and Mason. The
  final stretch has two, as the old run-up had three, so tiny wheels still pay for being light.

### Driving model (`src/sim/race.ts`)

- The fixed 1/120 s step and seeded RNG are kept: a race is deterministic given its inputs, so the
  same seed with the autopilot replays identically. The old bit-exact agreement between Node and the
  browser is dropped: steering needs sin/cos, whose last bits differ between JS engines, and a race
  with collisions amplifies that. The balance check runs in Node; `predict()` runs the same autopilot
  in the browser.
- **Motion** is in the horizontal plane with the height taken from the road under the car. On a slope
  gravity accelerates the car at g·grade/(1+grade²) along the road's fall line, which is exact for a
  plane. Drag uses the airspeed against the wind (horizontal, along x); rolling resistance and brakes
  slow the rolling speed without ever reversing it.
- **Tyres** (the grip is now arcade grip, 1.6× the tyres' friction sideways, and there's a proper
  drift: see "Handling"): each step the velocity is turned towards the nose as far as the lateral grip allows. Within
  grip the car rolls (no speed lost); beyond it the tyres slide and friction opposing the sideways
  slip scrubs speed. That is a real drift: flick into a hairpin too fast and the car slides wide and
  sheds speed. Braking hard or spinning the wheels leaves less grip for turning.
- **Steering:** the input sets a target yaw rate, the smallest of v / turning radius (the chassis), the
  grip limit × 1.4 (a touch of oversteer, so full lock at speed drifts; now × 1.15, with the drift on
  the brake), and 3.3 rad/s. The nose
  follows it at the chassis' response rate, slowed by weight (mass^0.2). With no steering input above
  5 m/s, the nose eases along the road at 0.35 rad/s: keys can only give full lock or none. Keys
  ramp the wheel at 8 lock/s.
- **Weight's new meaning:** tyres lose a little grip under load (450/m)^0.1, so heavy cars corner and
  brake a little worse; brakes have a force limit (bigger on bigger wheels), so heavy cars stop
  later; the nose answers more slowly; the Jump item is a fixed spring, so heavy cars jump lower
  (about 2.8 m for a kart, 1.8 m for a loaded pickup: the floor is set so that anything can clear a
  hedge and the hop reads on screen); and in any collision mass decides who moves.
- **Top speed and gearing:** a wheel-driven engine revs out near its top speed (full push up to 60%,
  fading to none at 100%): the lawnmower at 17 m/s, the V8 at 32 m/s, the jet at 33 m/s. Wheels are
  the gearing (tiny ×0.82, standard ×1, monster ×1.18; the pickup's drivetrain ×1.1), so wheels now
  trade top speed against weight, grip and drag. Gravity can still take a car past its top speed down
  a hill. Without this, a player flooring it down the last two blocks launched at up to 50 m/s
  and flew 280 m.
- **Wind** shifts the top speed by 0.3 × the wind (a headwind loads the engine). With speeds capped,
  launches had become wind-proof while a headwind still adds lift, so some slow gliders flew further
  into a headwind; now the strongest headwind shortens every build, as the brief requires.
- **Fuel** burned at the engine's power while the gas was held, less on the rev limiter, and tiny
  wheels spun all the power they couldn't put down away. Superseded: the engine now runs on unlimited
  gas and the tyres' "spin waste" is gone; see "Fuel → boost".
- **Crests and landings:** a grounded car leaves the road when the road's vertical speed drops more
  than 1.2 m/s below what gravity could follow in one step; tiny hops are ignored. In practice cars
  faster than about 9 m/s take off at the intersections (even the all-$0 build gets a small hop). In
  the air it keeps its horizontal speed and has a little air steering; the jet keeps pushing. Hard
  landings cost up to 12% speed and bounce a little.
- **Lombard's flower beds:** a car that comes down beyond a hedge doesn't sink into the hydrangeas: it
  skids across the top of them towards the nearest road (maybe the next leg) and drops onto it. All
  of the block off the road counts as garden, the islands inside the hairpins included. The block
  itself is walled in (its retaining walls and stairs along the sides, the houses at the ends, open
  only where the road comes in and goes out), so a sideways hop can't carry a car out over the city.
  Before that, a car that drifted far over a bed could have its tracked road point slide onto a
  kerbed stretch and be snapped back up to 18 m in one step.
- **Walls** push the car out along the road's normal, bounce it (restitution 0.18), scrape speed along
  the wall, and swing the nose a little along it. The push-out is at most 0.25 m a step, so a car that
  comes down half on a hedge slides off it over a frame or two instead of jumping.
- **Kindness:** a car on the gas that makes less than 2.5 m of progress for 6 s is put back on the
  road a little ahead, on a spot clear of Waymos, tourists and the cable car (−5 HYPE, "BACK ON
  TRACK"); sitting still or reversing never triggers it. A car driving the wrong way for 5 s (the
  HUD says WRONG WAY! after 1.2 s), or facing the wrong way for 8 s, is turned round the same way.
  A car too slow to climb the kicker (the last 12 m before it) is shoved over the lip by the pier crew
  after 2.5 s instead of ending the round on the ramp. Reverse is free.
- **Rocket start:** throttle held from less than 0.6 s before GO, or pressed within 0.15 s after it,
  gives a 7 m/s push and +8 HYPE; held for more than 1.4 s bogs the engine for 0.7 s.
- **The end:** when the first car splashes, the other has 25 s to reach the lip (a countdown shows in
  its card after 5 s); a race is capped at 150 s. A car that misses either is DNF.

### Collisions

- Cars, Waymos and the cable car are chains of circles along their length (enough circles that a
  pickup has no waist). Contacts are resolved with a proper impulse including rotation, so an
  off-centre hit spins a car. Restitution 0.35 between cars.
- **The nose:** a car whose nose hits the other is the rammer. A **Blunt** nose is a bull bar (the
  victim takes 1.5× the impulse); a **Wedge** scoops the victim off its wheels (a hop and a moment of
  no control); a **Cone** is just slippery. The free Blunt nose now earns its drag.
- **Waymos** weigh 2,300 kg and the cable car is immovable: hitting either costs a lot of speed and a
  moment of control. A knocked Waymo stops for two seconds with its hazards on, drifts back to its
  path and plays a polite chime.
- **Tourists** are wobbly toy figures: hitting one topples it (it bobs back up after 2.6 s) and costs
  45% of your speed and a little spin. With Determination they dive out of the way instead, up to the
  road's edge, and carry on from where they land.
- **Poo** spins a car round a full turn over about a second (less on grippy wheels) and halves its
  speed; its owner gets HYPE. Loose traffic cones fly off and cost 3%.

### Items

- Rainbow boxes in rows (Greenwich St, Hyde St, Lombard, the block after Leavenworth, the start of
  the pier). Driving through one starts a 0.9 s roulette; you hold up to two items (see "Two item
  slots"); a box pops
  back after 3 s.
- **Odds lean on the race order:** the leader draws Poo 55%, Jump 35%, Determination 10%; within
  30 m it's even; further behind, Determination 50%, Jump 35%, Poo 15%.
- **Jump:** a vertical kick (heavier cars jump lower). It clears tourists, poo, cones and, with a
  light car, even Waymos.
- **Hedge hop:** turn across the inside of a Lombard hairpin, jump, and come down on the next leg.
  Any flight that leaves the road and rejoins it further round than the flight alone explains is a
  shortcut ("HEDGE HOP! +n m", +12 HYPE, once per jump). The car then touches down lined up with the
  road, keeping 96% of its speed: without that arcade kindness it landed pointing across the next leg
  and bounced off the far hedge, and even a perfect hop lost time to simply driving the hairpin. Now
  a well-aimed hop at 12 m/s saves 0.4-0.8 s in a kart (up to 1 s in a pickup, which brakes harder
  for the hairpin), plus the HYPE. The CPU doesn't try it: hopping at its braked hairpin speed it
  lost 0.3-0.8 s every time.
- **Jump on the kicker** puts half its spring into the launch: +7-12% distance. At full strength it
  was worth +25-50%, more than the gap between most builds, from one lucky box.
- **Determination** lasts 12 s or one hit: plough through a Waymo (it's shoved aside and spun, and
  you pass through it for a moment instead of snagging on it again), a tourist, poo, or your rival
  (2.2× the shove and a moment of no control for them). Two Determined cars meeting cancel out.
- **Poo** is dropped just behind the car and stays for the rest of the race. The item key with no
  item honks; every chassis has its own horn.

### Traffic and tourists

- Placed from the round's seed: two Waymos creeping down the first blocks and one down the last
  ones (they pull over and park with their hazards on at the end of their stretch, the first ones
  16 m short of the Hyde St corner, where the chase camera swings wide), one stalled mid-block with a
  traffic cone on its hood and loose cones behind it, and three each way crossing the Embarcadero.
  The stalled one faces uphill, so its hood and the cone face the racers coming down (facing
  downhill, the lidar hid the cone from every chase camera). Waymos brake for anything just ahead, and the Embarcadero ones stop short of the
  crossing when a racer is coming (but not once they're committed), so the crossing is a sight to
  steer round rather than a lottery.
- Tourists cross at most of the crosswalks (walking across and back, pausing at the kerb), and four
  stand in the road on Lombard taking photos.
- The Powell-Hyde cable car shuttles up and down the middle of Hyde St (stopping for anything on the
  rails ahead and ringing its bell). Moving along the line it kept arriving in the corners just as
  the cars did.

### The autopilot (`src/sim/bot.ts`)

- A **racing line** solved once per course: the minimum-curvature path within the kerbs (projected
  gradient descent on the summed squared curvature, on a 2 m resampling). It takes Lombard's hairpins
  at about a 6.5 m radius and the Hyde corners at 13 m.
- A **speed plan** per car from its grip (with downforce), turning radius and brakes, braking back
  from every corner.
- Pure-pursuit steering, dodging whatever is ahead near its line, items used sensibly, boost saved for
  the run to the kicker. It drives the CPU opponent (a little less than full speed, and leaning on
  you when alongside), `?autodrive`, and the balance check (with dodging and items off). The CPU and
  `?autodrive` also drift the big corners (see "The CPU" under "Drift, boost and solo").
- **Turning round:** facing backwards (knocked round, or landed that way), it makes a three-point
  turn: forward on full lock until its nose is about to meet an edge, back with the wheel the other
  way until its tail is, and so on. The first swing takes the nose away from the nearer wall (the
  short way round can be straight into it), re-aimed once if it has drifted across. Pinned against
  something, it reverses with the wheel held the other way. Placed backwards at a standstill near the
  start fence, every test build now gets going (a long pickup used to dither there for good), and no
  random landing on Lombard leaves it stuck.

### Split screen and cameras (`src/scene/views.ts`)

- Three orbit rigs: one per player and a shared one. Chase rigs sit behind their car and look **down
  the course**, not along the car's nose, averaging the course direction ahead (and over 60 m on
  Lombard, so the hairpins and spin-outs don't whip the view round). On Lombard the camera rises to
  42° and backs off.
- The shared rig sits behind the trailing car and looks between the cars, zooming out and tilting
  down as they string out.
- **Splitting:** when the shared rig can't frame both cars (it would need to be more than 30 m back,
  or either car's projection nears the screen edge) for 0.3 s, the screen splits: Player 1 left,
  Player 2 right, matching the HUD cards, the garage panels and the keyboard. The shared chase camera
  already sits behind the trailing car, so **that player's view carries on**: the divider slides in
  from the other side over 0.5 s, cropping it (an off-centre projection with `setViewOffset`, so
  nothing on it moves), while it eases into that player's own camera. **The leader's view slides in
  attached to the divider**, already their own camera.
- **Healing:** when both cars would fit again (with some margin) for 0.6 s, the same move runs
  backwards: the leader's half slides out to its side and the trailing player's half widens back into
  the shared view. (If only one car is still on the road, that car's view is the one that carries
  on.)
- The first version eased both halves at once, from their halves of the shared view to the players'
  cameras. It was seamless at the two ends, but in between two overlapping blends of the same scene
  sat side by side: with the cars running one behind the other down the middle, both halves showed
  both cars, twice, at slightly different places.
- A Voronoi split (a divider at any angle) was considered: it suits a top-down camera, but with
  forward-looking chase cameras each player's half ends up on the wrong side for seeing ahead.
- **Flight:** each player's rig swings to the side-on flight view when their car launches; if the
  other car is still racing, the screen stays split (flight on one side, the race on the other). Once
  both are in the air or within 25 m of the lip, the shared rig frames them together and the screen
  heals. (At 60 m the shared side view took over while a car was still racing along the pier, as a
  speck.)
- **See-through traffic:** just before each view is drawn, any Waymo (or the cable car) that the
  camera is within 1.5 m of, or that stands between the camera and a car that view follows, swaps to
  dithered see-through versions of its materials (`alphaHash`, so there's nothing to sort). A camera
  swinging round the Hyde St corner used to fill half the screen with a parked Waymo's white panels.
- Each half is drawn with a scissor and its own shadow focus; trails are re-faced for each half. It
  holds 60 fps at 1920×1080 (2× pixel ratio) on an M1 Pro, split or not.
- Big hits, landings and shoves shake that player's view a little.

### Driving controls

- P1: W gas, S brake/reverse, A/D steer, Space item. P2: ↑, ↓, ←/→, Enter (also Numpad Enter,
  Numpad 0). The old spare item keys (E, Left Shift, Right Shift, /) now boost and swap items: see
  "Controls" under "Drift, boost and solo". (Superseded: see "Keys" under "Keys, and a kicker worth
  racing to".)
- Gamepads: the first connected pad drives Player 1 and the second Player 2, alongside the keys.
  Right trigger or A for gas, left trigger or B to brake, the stick or d-pad to steer, X for the item,
  Y to swap, either shoulder to boost. (Extended: see "Xbox controllers".)
- An item press is taken once per key-down, on the first physics step of a frame.

### HUD

- Each card: name, race position and gap, speed (then the live distance in flight), the boost bottle
  (with its key; it burns blue-white while firing and pulses while a drift fills it), HYPE with the
  launch boost it's worth, two item slots (the one the item key uses, and the one the swap key
  switches to, each with its key; a roulette spins in the slot the new item will land in), and
  flashes. Flashes that name a cause (WAYMO'D!, SPUN BY SAM'S POO!, NEAR MISS!, SLIPSTREAM!, DRIFT +20%
  BOOST, 🐦 SEAGULL!, ...) and big shouts over the car for the moments that matter. At most four
  timed flashes per card. Hints: tap the brake to drift (after the first hard corner-wall hit), and
  empty the boost before the pier.
- Shouts ride along just above the car's name tag in that player's view, stack upwards when two
  come at once, and are skipped for a car that's only a speck near the horizon (the card's flash
  still says it).
- A strip at the top shows both cars on the course (start, Hyde, Lombard, the pier), which matters
  most when the screen is split. When the two markers meet they step apart, P1 above the line and
  P2 below, clear of the labels.
- The Bay's distance labels fade by where each view is looking (side-on they're solid, end-on they're
  gone), per half of a split screen.
- The countdown shows a controls card with the items explained. A hint appears when you reach Lombard
  holding a Jump ("JUMP THE HEDGES!").
- A Jump bursts a ring of dust from the road and stretches the car on its springs; a landing
  squashes it. A poo hit throws a fountain of brown, shakes the view, flings brown from the wheels
  while the car spins under a halo of dizzy stars, and leaves the splat on the road for a few
  seconds.
- Name tags are projected in every half that shows the car.

### Garage stats and parts

- Stats: Mass, Power, **Boost** in seconds (was Fuel as seconds of full throttle), Grip (μ, with
  "4WD" when traction is well above grip), **Handling** (0-10: nose response and turning radius),
  **Brakes** (g), Drag, Lift.
- Every tagline was rewritten to state the part's tradeoff in the race as well as in the air (for
  example the kart "turns on a dime, but gets shoved around", the pickup is "a tall-geared 4WD
  bulldozer that wins every shove, but slow to turn, stop and jump").
- **CPU:** a toggle on Player 2's panel. The CPU picks one of six sensible builds (a new one each
  round, so the rival varies), is always ready, and its panel is dimmed. `?cpu=1` starts with it on.

### Sound

New procedural voices: a tyre screech that follows the slide, item-box sparkle, roulette ticks, a
boing, a power chord, a plop and a splat, a toy bonk for shoves, a crunch and a robotaxi chime for
Waymos, a cartoon "whoa" for tourists, a plastic tock for cones, the cable-car bell, a horn per
chassis, a rocket start (or a bogged-down sputter), HYPE blips and a near-miss whoosh.

### Test hooks

`window.__game` keeps everything listed under "Test hooks" below, and adds:

- `cars` (live race state per car: position, speed, boost, drift, HYPE, items and the selected one,
  tallies, ...), `world` (the traffic, tourists, boxes, poo, seagulls and the cable car), `split`
  (0-1), `wins`, `course` (the course in play: length, loop, start line, sections, and on Russian
  Hill its landmark arc lengths), `cpu`, and `map`, `maps`, `setMap(id)` (the event).
- `input(p, {throttle, brake, steer, boost, item, swap})` drives a car from a script (`null` gives it
  back), `autodrive(p, on)`, `setCpu(on)`, `giveItem(p, 'jump' | 'grit' | 'poo' | 'topup' | 'refill'
  | 'gull')`, `place(p, s, d, speed)`.
- Solo: `setSolo(on)`, `solo`, `setTraining({start, ghost, traffic, items})`, `training`, `retry()`,
  `toGarage()`, `soloBests` and `ghostVisible`.
- `ramp` (the kicker's angle in degrees, and the race time the first car went off it, or null) and
  `keyLayout` (`'single'` or `'duo'`).
- `predict()` and `simulateToEnd(stats, wind)` now mean the autopilot's run on an empty course.
- URL: `?autodrive=1|p1|p2`, `?cpu=1`, `?solo=1`, `?traffic=0`, `?items=0`, `?map=russian-hill|twin-peaks`.

## Tooling and environment

- **Dev server port 5199 (`strictPort`).** Another local project's Vite server already listens on
  `localhost:5173` (IPv6), so requests to the default port silently reached the wrong app.
  `npm run dev` still runs `vite --host`; the port lives in `vite.config.ts`.
- **Shadows use `THREE.PCFShadowMap`, not `PCFSoftShadowMap`.** three r186 removed
  `PCFSoftShadowMap` and logs a console warning when it is requested (the spec forbids warnings).
  In r186 `PCFShadowMap` itself does soft Vogel-disk filtering, so `shadow.radius` gives the soft look.
- **`THREE.Timer` instead of `THREE.Clock`.** `Clock` is deprecated in r186 and warns.
- **TypeScript 7 (the native `tsc`)** is what `package.json` pins; `tsconfig.json` uses
  `moduleResolution: "bundler"` and lists `vite/client` in `types` (TS 6+ no longer auto-includes
  `@types`). `scripts/balance.ts` declares the tiny slice of `process` it uses instead of pulling in
  `@types/node`.
- **Verification uses the Playwright library directly** (the cached `playwright@1.63` package and its
  Chromium 1243), launched per agent with `--use-angle=metal`. The Playwright MCP server drives one
  shared browser, so parallel agents would steal each other's tabs; separate browser processes keep
  the flow, visual and physics agents isolated. Headless Chromium gets real GPU WebGL this way.

- `preview/*.html` are dev-only showroom pages for each scene module (city, landmarks, cars) using the
  game's lighting (`preview/harness.ts`). They are type-checked but not part of the production build.

## Garage (replaces the turn-based draft)

The brief's turn-based draft (one slot at a time, players alternating, no going back) didn't work in
play. You could only act on your turn, and you had to commit to a part before seeing what the later
slots cost, so budgets went wrong. At the team's request the build phase is now a garage that both
players use at the same time. (`BUILD_PROMPT.md` still describes the draft as it was first built.)

- **A tab per slot.** Each panel has a 3×3 grid of tabs, one per slot, showing the part fitted there
  and what it cost. Every price is one click away, and the grid is the budget breakdown. The open
  tab's parts are listed below it.
- **Fit and remove.** Every slot always holds a part: its free stock part (the first, $0 option)
  until something else is fitted. So a car is always complete and within budget, and there's no
  "unfinished" state to fill in at launch.
  - Clicking a part fits it. Swapping refunds the part it replaces, so a part is affordable when
    `price ≤ money left + price of the part fitted in that slot`.
  - Clicking the fitted paid part again removes it, and the slot falls back to its free part. Free
    parts can only be swapped, since there's nothing to refund.
  - Parts you can't afford show "NEED $X MORE". Clicking one shakes the money and buzzes. So does W/S
    or ↑/↓ when every part that way costs too much. At the end of the list they stay quiet.
  - Hovering previews what a click would do, including hovering the fitted paid part: that shows
    its removal (the refund in green, the free part's stats, and the car with it). A click ends the
    preview until the pointer comes back, so a part you've just fitted doesn't flip to showing its
    removal.
  - Cosmetic slots are all free, so their title says "· all free" instead of a FREE chip on every
    card.
- **READY per player.** READY locks a car in: its parts give way to a READY card, and READY again
  ("Edit car") unlocks it. The race starts as soon as both players are ready.
  - A single LAUNCH button would let one player start the race while the other is still building.
  - The `launch()` hook still starts at once, ready or not.
- **Rematch keeps the cars.** A rematch starts from both cars exactly as they raced, and each
  player's open tab is kept. To make tweaking quick:
  - Slots changed since the last race turn gold with a gold edge, and their tooltip says what was
    there. A "changed" legend appears next to YOUR CAR while any slot differs.
  - Last race's part is tagged LAST RACE in its slot.
  - The Stats header shows each player's last distance.

  New players resets both cars to the free build.
- **Two players on one keyboard.** Keys are `KeyboardEvent.code` values, so the same physical keys
  work on any layout. The panels show them next to the tabs, the parts and READY.
  - P1 uses the left of the keyboard: A/D for slot tabs, W/S for parts, Space for READY.
  - P2 uses the arrows: ←/→, ↑/↓, Enter.
  - W/S and ↑/↓ fit the next or previous affordable part straight away. Tab keys wrap around.
  - The old number keys are gone. With both players building at once they'd be ambiguous.
- **Sounds.** A rising chime plays for READY and a falling one when a player goes back to editing.
  A low buzz plays for a part you can't afford.
- **No turn order.** The first-picker swap is gone with the turns.
- **Mashing is safe.** Space and Enter are both READY keys and the results screen's rematch keys,
  so:
  - The results ignore them for 1 s. Otherwise keys still being mashed from the race skip the
    results.
  - A fresh garage ignores the READY keys for 0.6 s, so the press that left the results doesn't
    also ready a player.

  Both grace periods are real time, whatever `?speed` is. On part cards and READY, the second click
  of a double-click is ignored, since it would undo the first (fit then remove, ready then unready).
- **Short windows.** A 1366×768 laptop minus the browser's toolbars leaves about 610–660 px. There
  the 11 px text floor stops the UI shrinking with the height, and the cards spilled over READY. So:
  - Panels never get narrower than at 720p (`--panel-w`).
  - Windows up to 660 px tall get one-line taglines (each card's tooltip leads with the full text),
    no cosmetic taglines, and tighter spacing.
  - The part list scrolls as a last resort, and READY always paints on top.

  Everything fits down to 580 px. At 560 px, Chassis scrolls by 13 px.

## Game flow and UI

- **Wind** is rolled uniformly in −8…+8 m/s at the start of each round and rounded to 0.1 m/s.
  Anything under 0.5 km/h displays as "CALM". Traffic, tourists, the cable car and item luck are
  rolled from the same seed each round, so every round is a little different.
- **Keys.** The garage keys are listed under "Garage" above; the driving keys under "Driving
  controls" below. **Enter** or **Space** starts a rematch from the results screen, after a 1.5 s
  grace period (they're the item keys too, and are often still being mashed when the race ends). **M** mutes, and a clickable sound button does the same for
  mouse-only players. Keys pressed with Ctrl, Cmd or Alt are left to the browser.
- In round 1 a car is the all-$0 build in its player's own default paint (P1 red, P2 blue). On a
  rematch it's last race's car.
- Player identity colours: P1 `#ff5a36` (coral), P2 `#2e8bff` (blue). They tint panels, HUD cards,
  name tags over the cars and the flight trails; the chosen Paint colours the car body.
- Hovering a card previews the part on the car, on the stat bars (striped ghost bar, green/red
  value when it is better/worse) and on the money (dashed, showing what would be left after the
  swap; negative for a part you can't afford).
  - Unaffordable cards stay hoverable: they're `aria-disabled`, not `disabled`.
  - Clicking a part, or pressing that player's garage keys, ends the preview. The car shows the
    change at once, and a removed part doesn't linger as a preview under the pointer.
- The stat bars show what matters on the road and in the air: Mass, Power, Boost, Grip, Handling,
  Brakes, Drag and Lift (see "Garage stats" under "The race").
- The Lift bar shows lift at a typical 30 m/s as a share of the car's weight ("65% wt"; a full bar
  means lift equal to weight). It is composed exactly like the physics: body and spoiler lift, plus
  the kite and glider wings together (wings capped by their trim, the kite by its maximum pull).
  The same wings read higher on a light car (a go-kart shows 65%, a pickup 45%), matching where
  they help most.
- Stat bars: Power uses a square-root scale so the lawnmower is still visible (Fuel did too; Boost is
  linear). Bump resistance moved out of the bars into the wheels' taglines.
- Toppers have 1–2 kg of mass (the table says "small"), and `computeStats` includes it, so the game
  and `simulateToEnd` stay identical. The balance check uses the no-topper default.
- **"New players"** resets names, the round counter, last round's cars and distances, and the
  session best (and hides the best-distance buoy). The wind RNG simply continues.
- The best-distance flag buoy sits between the lanes at the record distance and is labelled with
  the record holder's name, tinted in their colour.
- Buoys float in both lanes every 10 m out to 250 m. Their number labels sit between the lanes so
  the two rows never overlap on screen; every 50 m gets a big yellow buoy with a tall marker label.
- `?speed=N` scales all game time (countdown, race, pause before results), clamped to 0.05–50.
- Both panels are live at once, and each glows in its player's colour while they build. A ready
  player's panel loses the glow and its tabs read as a plain summary.
- The status banner ("Build your cars…", "Sam is ready · waiting for Alex") sits bottom-centre,
  above two hints: fitting parts, and the race keys. The in-world "LA VOITURE" start gantry then stays visible under the wind forecast
  rather than hidden behind the UI.
- Topper parts are listed one per row like the performance slots. Only Paint uses the two-column
  swatch grid.
- Small text never drops below ~11 px (panels, taglines, card tags, key chips, HUD) so 1280×720 on a
  TV stays legible.
  - The card tags' fills give their white text at least 5:1 contrast (the FITTED tag is the player
    colour darkened to 72%).
  - Preview numbers use a darker green and red than the bars (`#0f7a4a`, `#c62f35`).
  - The name box is a dark recess, even while typing, so its white text reads on both player
    colours.
  - The stat value column fits "−0.5%/bump" in the fallback fonts too (no web font is bundled).
  - In the "… is ready" banner only the name sits in the coloured pill, so a very long name is cut
    without losing "is ready".
  - The money turns green when a hovered swap gives money back, and red only for a part you can't
    afford. Spending right down to $0 is fine.
  - Taglines keep numbers and units together (`660\u00a0kg`).
- Buttons drop keyboard focus after a mouse click, and the game's keys call `preventDefault`, so
  Enter never re-presses the last clicked button (e.g. the sound toggle). A button reached with Tab
  keeps its native Enter/Space press.
- Names are trimmed, cut to 16 characters and trimmed again; an empty name falls back to
  "Player N". Characters are user-perceived ones (`Intl.Segmenter`), so an emoji, even a flag or a
  family, is never split.
  The name box accepts up to 40 raw characters so leading spaces don't eat into the 16.
- Name tags over the cars stack instead of overlapping when the cars are side by side. The vertical
  gap they need shrinks smoothly as they separate sideways, and a tag only moves as far as it has to,
  so nothing pops. Which tag sits on top only changes when the order clearly flips.
- The Bay reflects a sky-only PMREM environment (the rest of the scene keeps the RoomEnvironment
  studio look for glossy toys). At grazing angles, the studio reflection read as oily streaks on the
  water. Two ripple layers with large, non-integer tile sizes and full anisotropy cut the
  distance moiré.
- The best-distance flag is taller than the 50 m markers, and distance labels draw above the
  flight trails.
- Distance labels fade when the camera looks down the lanes (chase and build views). From behind,
  they line up into one cluttered stack over the kicker; side-on, where distances are read, they
  are fully opaque.
- The results card sits at the bottom of the screen and the results camera aims so the splash zone,
  both trajectories and the record buoy sit above it.

## Physics details that carry over

- Lift (wings, the bathtub's body, the kite) only acts in flight. The kite's lift is ½ρ·ClA_kite·|v_air|²
  capped at its limit, added to the body/wing lift along the same "perpendicular, rotated towards up"
  direction; its extra drag only applies once open (at the lip).
- The flight is now 3D (a car can leave the lip at an angle); with no sideways speed it is exactly
  the old 2D model. Lift acts perpendicular to the airspeed in the vertical plane that contains it.
- The lip crossing and the splash are interpolated inside their step. The score is the horizontal
  distance along x (the buoys' axis) and is clamped at ≥ 0.

### Glider wings (a deliberate model change, kept from the first version)

With the spec's lift model (constant ClA from the lip, perpendicular to the airspeed), glider wings
never *glide*. Verification measured the same ~33–40° water entry with or without wings at any lift
value: lift is strongest in the fast climb, so the car balloons into a taller lob. The physics
check "glider wings on a go-kart visibly glide" could not pass, so the glider changed, in the same
spirit as the spec's kite that opens at the lip:

- **Spring-loaded wings:** folded (sleek, small drag) on the run-up and the climb; they pop open at
  the top of the arc (`wingsOpen` event, "GLIDING!" on the HUD, a swoosh, and the mesh unfolds).
  Folded, the mesh also telescopes them to 55% span and tucks the upright tip plates away: swung
  straight back at full span, the tips trailed off the back of short cars like two loose flaps.
- **Open wings** add their lift area (`clA`) and extra drag (`openCdA`).
- **Trim cap.** Their lift, together with a kite's, is capped at `trim` × the car's weight: the wings
  settle into a steady glide instead of ballooning. A kite that already pulls harder keeps its own
  capped lift.
- The cap also keeps "a headwind shortens distances" true for gliders in the strongest headwind.
  Uncapped, extra airspeed meant extra lift, and gliders flew *further* into a headwind.
- Result: a ballistic climb, then a visibly flatter, longer descent on light cars. Heavy cars barely
  change ("great on light cars").
- With the race, the −8 m/s headwind still shortens every one of the 2,428 builds (see "Wind"
  below). Slow gliders can still be the exception to "wind in your favour means further":
  - A handful whose wings open below their trim speed can gain up to ~1.7 m from a *moderate*
    headwind: extra airspeed adds lift faster than drag.
  - A tailwind can cost such a glider up to ~5 m: less airspeed, less lift.
  - `npm run balance` sweeps every headwind and reports both effects. They follow from the spec's
    airspeed = v − wind. Beyond the fixed-step wobble (see "Residual fixed-step wobble"), only
    slow glider builds are affected.

Body lift (the bathtub), the spoiler and the kite otherwise follow the spec exactly.

## Xbox controllers

Two Xbox pads can play the whole game without touching the keyboard or mouse.

- **Seats stick.** Each pad takes the first free player seat when it's first *used* (a button, a
  trigger or the stick) and keeps it until it disconnects, so a pad dropping out doesn't hand the
  other player's car over. Not when it's first listed: once one pad is pressed, Chrome lists every
  connected pad at once in its own order, which put the pad that was pressed first in Player 2's
  seat. Clicking the left stick in the garage swaps the pads (and buzzes them: short for P1, long for
  P2). Alone at the
  controls (solo or against the CPU), a lone pad in Player 2's seat moves to Player 1.
- **Menus.** Garage: ◀ ▶ or LB/RB change tabs, ▲ ▼ step parts (the stick works as a d-pad, and held
  directions repeat like keys), A or Menu readies, B un-readies. Player 1's View cycles two players →
  CPU → solo, and Y picks the solo start. A second pad's A while the CPU drives, or in solo, brings
  Player 2 back. Results: A (or Menu) rematches or retries, Y is New players, solo B is Garage; the
  same 1.5 s grace as the keys stops race mashing skipping the card. In a solo run Menu retries and
  View goes to the garage (R and Esc on the keys).
- **Hints follow the device.** Each player's hints (garage key chips, READY, the race line, the
  countdown card, the HUD's boost chip, the drift and jump tips) show pad buttons once they last
  used their pad, and keys once they press a key again. The countdown card and HUD are set when the
  countdown starts.
- **Rumble** through `vibrationActuator.playEffect('dual-rumble')` (Chrome and Edge; Safari and
  Firefox ignore it): hard landings, walls, shoves (both cars), traffic hits, spin-outs, a rocket
  start, the launch and the splash. The CPU's seat never rumbles.
- **Not on the pad:** the name boxes, the solo ghost, traffic and items toggles, and mute. They stay
  on the mouse and keyboard.

## Known minor issues (left as is)

- **Glider unfold from the side view.** From the side camera the wing unfold is hard to see: the
  wings go from a thin trailing rod to edge-on. The "GLIDING!" flash, the swoosh and the flatter
  trail mark the moment.
- **First-launch hitch.** The first race of a session can stall a countdown beat for a moment while
  the flame and effect shaders compile.
- **Very wide names** (e.g. sixteen "W"s) are ellipsized in the name box but shown in full elsewhere.
- **Keyboard ghosting.** Some keyboards can't register every combination of six held keys; boost sits
  on Shift (a modifier, which doesn't ghost), and gamepads are the way round the rest.
- **The autopilot is decent, not great.** It hits Lombard's tourists more often than a careful human,
  its line through the hairpins is conservative, it never hedge-hops, and a good human drifter is
  quicker through Hyde St than the CPU (it plans its drifts round the corner's average bend, with a
  margin).
- **The seagull at a distance.** Perched on a car far down the road it's a small white blob with
  flapping wings; the SEAGULL! shout and the victim's card say what happened.
- **Solo bests don't persist.** Bests and ghosts last for the session, like the session best.
- **The kicker dropping is hard to see from the chaser's own camera:** the chase view looks down the
  course, so the kicker sits at the top edge of it until the last second. The card's hazard strip,
  the flash and the klaxon carry the news; the side-on flight view shows the lower launch.
- **Results card at 1280×720** sits a few pixels above the sound button (not overlapping).

## Test hooks

`window.__game` exposes `state`, `configs`, `wind`, `results`, `launch()`, `rematch()`,
`newPlayers()`, `setSpeed(n)` and more:

- **Garage:** `select(p, slot, option)` (fit a part by id or index), `remove(p, slot)`,
  `openTab(p, slot)`, `setReady(p, on)` (the countdown starts once both are ready), and `garage`
  (configs, money, ready flags, open tabs, and last race's cars and distances).
- `ready`, `round`, `names`, `setName(p, name)`, `sessionBest`, `events` (the race's event log),
  `sound` (`ready`, `muted` and the output RMS `level`, to prove audio plays and that M silences it),
  `toggleMute()`, `computeStats`, `parts`, plus the race hooks above.
- `launch()` works from the build phase at any time: it races both cars as they are.
- `?autobuild=1` builds both cars at random (affordable parts only) at the start of every round.
- `?wind=W` pins the wind to W m/s for every round, for deterministic checks.

## Balance

`npm run balance` enumerates all 2,428 affordable builds and has the autopilot race each one down the
empty course in three winds (−8, 0, +8 m/s), with HYPE off so it compares the cars, not the driving.
It takes about 35 s. It fails on:

- a paid part that never makes the top 10% in any wind, or that is never the strictly best pick for
  its slot (the other six slots fixed) in any build and wind;
- a free part that isn't on the price/distance Pareto front in some wind (every free part is the
  "keep the money" option now, not just the empty wing, nose and booster: the lawnmower and the nitro
  can can't win a long race on their own, but they fund everything else);
- the same #1 build in every wind with fewer than three chassis in any top 5;
- any build that fails to reach the lip; the strongest headwind lengthening any flight; glider wings
  that don't visibly glide; sensible builds (a V8 or jet) taking more than 50 s; any flight over 7 s;
  the all-$0 build outside 5-30 m in calm air; the best build outside 80-180 m.

The autopilot in the check keeps its boost for the run to the kicker and dumps it there (starting
just early enough to empty the bottle at the lip), and doesn't drift, so a bottle's worth is what it
holds at the start. Its "boost" column is the share of the bottle left unspent at the lip.

What changed for boost and the arcade handling, and why. With no fuel to save, every car ran flat out
all race, and boost on the pier raised the launch further: the first run of the check flew the best
builds 204-282 m (launches of 41-50 m/s) against the 180 m cap.

| Part | Before | Now | Why |
|---|---|---|---|
| V8 | top 32 m/s | top 26 m/s | Launch speeds with free gas and a boost bottle on the pier |
| Jet | top 33 m/s | top 27.5 m/s | As above; still wins some headwinds |
| Lawnmower | top 17 m/s | top 16 m/s | Keeps the all-$0 build in 5-30 m |
| Monster wheels | gearing ×1.18 | ×1.15 | The best tailwind build flew 184 m |
| Sedan | 660 kg, CdA 0.9 | 620 kg, CdA 0.76 | Never the best pick for its slot; now the slipperiest chassis |
| Nitro → Launch rocket | 110 kJ | 95 kJ | Best pick in over 2,100 contexts; renamed so it isn't confused with the boost |
| Fuel tanks → boost bottles | 250 kJ / 1.4 MJ / 2.6 MJ | 1.5 s / 3 s / 4.5 s (8 / 25 / 60 kg) | See "Fuel → boost" |
| Wheels | spin waste 100/30/15% | gone | Nothing to waste without fuel |

Tried and reverted: a gentler wind effect on top speed (0.2 × the wind instead of 0.3) brought the
tailwind distances down, but slow glider builds flew further into a headwind again, which the check
forbids (see "Wind"); so did taking the wind out of the boost's ceiling.

What changed for the race (the version before boost), and why:

| Part | Before | Now | Why |
|---|---|---|---|
| Lawnmower | 2.5 kW | 5 kW, top speed 17 m/s | A whole race on a jerry can; still the all-$0 build's weak engine |
| V8 | 185 kW | 130 kW, top 32 m/s | Launch speeds; the top speed caps a floored run down the last blocks |
| Jet | 200 kW, cap 17.5 kN | 140 kW, cap 12 kN, top 33 m/s | As above; still wins headwinds |
| Jerry can | 120 kJ | 250 kJ | Fuel is spent across a 40-50 s race now |
| Standard tank | 460 kJ | 1.4 MJ | Enough for careful driving plus the run to the kicker |
| Oversized tank | 760 kJ | 2.6 MJ | Floor it all race; a newcomer who holds the gas doesn't run dry |
| Go-kart | 200 kg, CdA 0.85 | 195 kg, CdA 0.76 | So the slimmest chassis wins tailwinds (the Bathtub won every wind) |
| Bathtub | ClA 1.7 | ClA 1.45 | Lifting body plus glider wings dominated every wind |
| Pickup | 1210 kg, CdA 1.05 | 1000 kg, CdA 0.95, gearing ×1.1 | Never reached the top 10%; now wins some headwind contexts and every shove |
| Wheels | | gearing ×0.82 / ×1 / ×1.18, brakes 6.5/9.5/13 kN, spin waste 100/30/15% | New jobs: top speed, stopping, fuel economy |
| Spoiler | | downforce 2.4 m² | Grip in fast turns |
| Noses | | bull bar / wedge / spike | The free Blunt nose shoves hardest |

**How the winds differ:** a Bathtub with Monster wheels, a V8, a Nitro can, Glider wings and the
Launch rocket wins headwinds and calm air; a Go-kart with Monster wheels, a V8, a Bottle, Glider wings
and the Launch rocket wins tailwinds. The free Nitro can is in the top builds because its $10 goes on
the Launch rocket or the Cone. The chassis' race times on Lombard (the kart quickest, the pickup
slowest), how well they drift and their shoving weight are what the balance check can't see; they
are what makes the Sedan and Pickup worth racing.

**Driving tests** (scripts, not in the repo): see "Handling" for the keyboard drivers. In 60 two-car
races with traffic and items, both cars on the drifting autopilot: no NaNs, no DNFs, no rescues, a
median 33.5 s to the lip, 17 seagulls landed and 2 shooed, 87 item swaps.

Before boost (the fuel version): a "keyboard" driver (the autopilot's intent quantised to on/off keys
with a 0.15 s reaction) got round every build cleanly; one that held the gas all race ran dry after
Lombard with a Standard tank but not with an Oversized one; in 16 two-car races with traffic, V8
karts landed 90-137 m in 37-57 s.

### Final balance report (`npm run balance`)

```
La Voiture balance report
Every affordable build (performance slots, budget $100): 2428, each raced down the course by the autopilot
(empty course, no items or HYPE: this compares the cars, not the driving).
Top 10% = 243 builds per wind

## Top 15, headwind -8 m/s
  #   dist m    $  lip m/s  race s  air s  boost  build
  1    136.7  100     32.5    30.1    5.8     0%  Bathtub · Monster · V8 · Nitro can · Glider wings · Cone · Launch rocket
  2    135.1   93     32.4    30.1    5.8     0%  Bathtub · Monster · V8 · Nitro can · Glider wings · Wedge · Launch rocket
  3    131.5   95     32.6    30.2    5.8     0%  Bathtub · Monster · V8 · Bottle · Glider wings · Blunt · Launch rocket
  4    130.9   98     31.3    32.9    5.8     0%  Bathtub · Tiny · Jet · Bottle · Glider wings · Wedge · Launch rocket
  5    130.4   95     31.0    33.0    5.7     0%  Bathtub · Tiny · Jet · Nitro can · Glider wings · Cone · Launch rocket
  6    130.3  100     33.7    30.8    4.8     0%  Pickup 4x4 · Monster · V8 · Bottle · Glider wings · Blunt · None
  7    129.0   88     31.0    33.0    5.8     0%  Bathtub · Tiny · Jet · Nitro can · Glider wings · Wedge · Launch rocket
  8    128.4   85     32.2    30.3    5.7     0%  Bathtub · Monster · V8 · Nitro can · Glider wings · Blunt · Launch rocket
  9    127.8  100     31.5    33.0    5.7     1%  Bathtub · Tiny · Jet · Big bottle · Glider wings · Blunt · Launch rocket
 10    127.4   98     30.7    32.2    5.6     0%  Bathtub · Standard · Jet · Nitro can · Glider wings · Wedge · Launch rocket
 11    126.0   98     32.6    30.9    4.7     0%  Pickup 4x4 · Monster · V8 · Nitro can · Glider wings · Wedge · None
 12    125.0  100     32.3    31.0    5.0     0%  Pickup 4x4 · Monster · V8 · Nitro can · Glider wings · Blunt · Kite
 13    123.8   90     31.0    33.1    5.7     0%  Bathtub · Tiny · Jet · Bottle · Glider wings · Blunt · Launch rocket
 14    122.9  100     29.9    33.4    5.6     0%  Bathtub · Standard · V8 · Bottle · Glider wings · Cone · Launch rocket
 15    122.6  100     30.7    32.2    5.6     0%  Bathtub · Standard · Jet · Bottle · Glider wings · Blunt · Launch rocket
DNFs in this wind: 0

## Top 15, calm (0 m/s)
  #   dist m    $  lip m/s  race s  air s  boost  build
  1    162.7  100     35.4    29.1    5.8     0%  Bathtub · Monster · V8 · Nitro can · Glider wings · Cone · Launch rocket
  2    160.8   93     35.3    29.1    5.8     0%  Bathtub · Monster · V8 · Nitro can · Glider wings · Wedge · Launch rocket
  3    160.5   95     35.8    29.1    5.8     0%  Bathtub · Monster · V8 · Bottle · Glider wings · Blunt · Launch rocket
  4    156.9   98     34.3    31.8    5.8     0%  Bathtub · Tiny · Jet · Bottle · Glider wings · Wedge · Launch rocket
  5    155.1   85     35.1    29.2    5.7     0%  Bathtub · Monster · V8 · Nitro can · Glider wings · Blunt · Launch rocket
  6    154.0  100     34.5    31.8    5.7     4%  Bathtub · Tiny · Jet · Big bottle · Glider wings · Blunt · Launch rocket
  7    154.0   95     33.8    31.9    5.7     0%  Bathtub · Tiny · Jet · Nitro can · Glider wings · Cone · Launch rocket
  8    152.7   88     33.8    31.8    5.7     0%  Bathtub · Tiny · Jet · Nitro can · Glider wings · Wedge · Launch rocket
  9    150.9   98     33.5    31.0    5.6     0%  Bathtub · Standard · Jet · Nitro can · Glider wings · Wedge · Launch rocket
 10    150.6   90     34.1    31.8    5.7     0%  Bathtub · Tiny · Jet · Bottle · Glider wings · Blunt · Launch rocket
 11    149.9   98     36.4    28.7    5.1     0%  Go-kart · Monster · V8 · Bottle · Glider wings · Wedge · Launch rocket
 12    148.7  100     33.8    31.0    5.6     0%  Bathtub · Standard · Jet · Bottle · Glider wings · Blunt · Launch rocket
 13    148.6   98     32.8    28.9    6.2     0%  Bathtub · Monster · V8 · Bottle · Glider wings · Wedge · Kite
 14    147.8  100     36.5    28.7    5.1     4%  Go-kart · Monster · V8 · Big bottle · Glider wings · Blunt · Launch rocket
 15    147.1   80     33.6    31.9    5.6     0%  Bathtub · Tiny · Jet · Nitro can · Glider wings · Blunt · Launch rocket
DNFs in this wind: 0

## Top 15, tailwind +8 m/s
  #   dist m    $  lip m/s  race s  air s  boost  build
  1    179.8   98     39.5    28.0    5.4     0%  Go-kart · Monster · V8 · Bottle · Glider wings · Wedge · Launch rocket
  2    176.3   95     39.0    28.2    5.5     0%  Bathtub · Monster · V8 · Bottle · Glider wings · Blunt · Launch rocket
  3    175.6  100     39.6    27.9    5.3     4%  Go-kart · Monster · V8 · Big bottle · Glider wings · Blunt · Launch rocket
  4    173.8   98     37.4    30.9    5.5     0%  Bathtub · Tiny · Jet · Bottle · Glider wings · Wedge · Launch rocket
  5    173.7  100     38.3    28.4    5.4     0%  Bathtub · Monster · V8 · Nitro can · Glider wings · Cone · Launch rocket
  6    173.6   90     39.3    28.0    5.3     0%  Go-kart · Monster · V8 · Bottle · Glider wings · Blunt · Launch rocket
  7    173.4   93     38.3    28.3    5.4     0%  Bathtub · Monster · V8 · Nitro can · Glider wings · Wedge · Launch rocket
  8    172.6   95     38.7    28.1    5.2     0%  Go-kart · Monster · V8 · Nitro can · Glider wings · Cone · Launch rocket
  9    172.3   88     38.7    28.1    5.3     0%  Go-kart · Monster · V8 · Nitro can · Glider wings · Wedge · Launch rocket
 10    172.2   98     36.3    28.2    6.0     0%  Bathtub · Monster · V8 · Bottle · Glider wings · Wedge · Kite
 11    171.4  100     36.5    28.0    5.8     0%  Go-kart · Monster · V8 · Bottle · Glider wings · Cone · Kite
 12    169.8   93     36.4    27.9    5.8     0%  Go-kart · Monster · V8 · Bottle · Glider wings · Wedge · Kite
 13    169.6  100     37.7    30.7    5.2     0%  Go-kart · Tiny · Jet · Bottle · Glider wings · Cone · Launch rocket
 14    168.8  100     36.4    28.1    5.9     4%  Bathtub · Monster · V8 · Big bottle · Glider wings · Blunt · Kite
 15    168.7   93     37.8    30.6    5.2     0%  Go-kart · Tiny · Jet · Bottle · Glider wings · Wedge · Launch rocket
DNFs in this wind: 0

## Options: best rank, appearances in the top 10% (243 builds), and median times (calm)
slot       option         best  (wind)   top@-8   top@0  top@+8   race s Lombard s
Chassis    Go-kart           1    (+8)       54      79      93     31.9       9.6
Chassis    Bathtub           1    (-8)      118     106      93     32.2       9.7
Chassis    Sedan            28    (-8)       26      21      22     35.5      10.2
Chassis    Pickup 4x4        6    (-8)       45      37      35     35.6      10.4
Wheels     Tiny              4    (-8)       59      54      45     35.4      10.3
Wheels     Standard          9     (0)       55      58      45     32.5       9.9
Wheels     Monster           1    (-8)      129     131     153     30.0       8.8
Engine     Lawnmower       623    (-8)        0       0       0     42.9      10.3
Engine     V8                1    (-8)      160     158     174     32.4       9.8
Engine     Jet               4    (-8)       83      85      69     31.2       9.8
Boost      Nitro can         1    (-8)       98      96      81     34.3       9.9
Boost      Bottle            1    (+8)       83      86      98     34.8       9.9
Boost      Big bottle        3    (+8)       62      61      64     35.3      10.0
Wing       None             56    (-8)       45      38      52     32.8       9.9
Wing       Spoiler          50    (-8)       57      42      50     34.5       9.8
Wing       Glider wings      1    (-8)      141     163     141     35.7      10.1
Nose       Blunt             2    (+8)       84      92      94     34.2       9.9
Nose       Wedge             1    (+8)       87      82      84     34.9       9.9
Nose       Cone              1    (-8)       72      69      65     35.1      10.0
Booster    None              6    (-8)       57      56      45     34.2       9.9
Booster    Launch rocket     1    (-8)      124      87      92     35.2      10.0
Booster    Kite             10    (+8)       62     100     106     34.9       9.9

## Best pick for its slot (other six slots fixed, any wind)
Chassis    Go-kart       free: on the price/distance Pareto front (best pick in 133 contexts)
Chassis    Bathtub       977 contexts
Chassis    Sedan         16 contexts
Chassis    Pickup 4x4    841 contexts
Wheels     Tiny          free: on the price/distance Pareto front (best pick in 620 contexts)
Wheels     Standard      299 contexts
Wheels     Monster       1528 contexts
Engine     Lawnmower     free: on the price/distance Pareto front (best pick in 0 contexts)
Engine     V8            1176 contexts
Engine     Jet           1353 contexts
Boost      Nitro can     free: on the price/distance Pareto front (best pick in 369 contexts)
Boost      Bottle        460 contexts
Boost      Big bottle    1553 contexts
Wing       None          free: on the price/distance Pareto front (best pick in 2 contexts)
Wing       Spoiler       567 contexts
Wing       Glider wings  1976 contexts
Nose       Blunt         free: on the price/distance Pareto front (best pick in 139 contexts)
Nose       Wedge         439 contexts
Nose       Cone          1735 contexts
Booster    None          free: on the price/distance Pareto front (best pick in 0 contexts)
Booster    Launch rocket 2016 contexts
Booster    Kite          380 contexts

## Wind
Builds that fly further into the strongest headwind (-8 m/s) than in calm air (by more than 0.5 m): 0
Builds that fly shorter with a tailwind than in calm air (by more than 0.5 m): 3

## Glide (calm air): go-kart with glider wings vs the same kart with none
Go-kart · Tiny · Lawnmower · Nitro can · Glider wings · Wedge · Launch rocket: 88.8 vs 72.9 m, air 4.2 vs 3.0 s, water entry 26° vs 37°
Go-kart · Standard · V8 · Big bottle · Glider wings · Cone · None: 109.3 vs 80.1 m, air 4.4 vs 3.1 s, water entry 23° vs 36°

## Race pacing (calm air, the autopilot)
V8 or jet builds (1472): median 31.7 s, 90% within 35.3 s
Lawnmower builds (956): median 42.9 s, 90% within 45.4 s

## All-$0 build (Go-kart · Tiny · Lawnmower · Nitro can · None · Blunt · None)
headwind -8 m/s      16.1 m  lip 10.4 m/s, race 55.4 s, air 1.9 s, 0% boost left
calm (0 m/s)         21.8 m  lip 12.5 m/s, race 45.5 s, air 2.0 s, 0% boost left
tailwind +8 m/s      34.1 m  lip 16.9 m/s, race 41.2 s, air 2.3 s, 0% boost left

## Checks
- Distinct #1 builds across winds: 2
- Distinct chassis in each wind's top 5: -8: 1, 0: 1, +8: 2 (union: 2)
- Race time, all builds: 27.5-56.4 s; flight time: 1.8-6.2 s
- PASS: every paid part reaches the top 10% in some wind and is the best pick for its slot in some build, every free part is on the price/distance front, the winner changes with wind, every build reaches the lip in every wind, the strongest headwind shortens every flight, glider wings visibly glide, sensible builds reach the lip within 50 s, no flight lasts over 7 s, the all-$0 build splashes 5-30 m out in calm air, best builds fly 80-180 m, no NaNs.
```

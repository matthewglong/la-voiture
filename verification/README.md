# Verification

## Two events and maps pass

A second event (a lap race round a new loop, Twin Peaks) and the restructure that makes events and
maps pluggable (see "Two events, and maps" in `DECISIONS.md`). Checked with Node simulations and
Playwright against `npm run dev`:

- **The long jump is unchanged.** `npm run balance` prints a report byte-identical to the one before
  the restructure (diffed, every build in every wind), after every change in this pass. In the
  browser, switching from Twin Peaks back to Russian Hill and racing two autopilot cars: both launch,
  the kicker drops for the chaser (25° then 24°), both splash, the results and the record buoy show.
- **Race mode, headless.** 30 CPU-vs-CPU races with random affordable builds, winds, traffic and
  items: no NaNs, no rescues, no wrong-way episodes; laps 44 s (10th percentile) / 49 s (median) /
  106 s (90th, the lawnmowers); 11-12 of 60 cars out on the straggler rule (all slow builds);
  0.3-0.4 Waymo hits a race (Russian Hill: about 1). Every build gets round a lap in every wind
  (`npm run balance:race`).
- **The seam** (the arc length wrapping at the end of the lap): laps count crossing the line from
  the end of a lap; backing off the grid stays on lap 0; backing over the line after crossing it
  undoes the lap (and wraps past the seam); driving over it again restarts the lap's clock; a rescue
  near the seam lands on the road; a seagull chases its target the short way round across the line;
  the Waymos lap the loop without ever parking.
- **Race mode, in the browser:** two autopilot cars, then P1 on the autopilot against the CPU: the
  countdown, lap counter, position and gap, the course strip, split screen and healing, items
  (poo spin-out, seagull, Determination), the stalled Waymo, tourists, the three crests (0.4-0.8 s
  of air every lap), lap flashes, the flag, the cool-down lap behind the results card, results with
  times, best laps and "Fastest lap", the session's best lap. Solo: a time trial of three laps with
  per-lap splits, a ghost on the retry, "New best run".
- **Terrain and camera:** the first version of the ground looked flat (the climb read as level road);
  after the rework the course contours a hillside (cuttings, embankments, peaks, a reservoir in the
  infield bowl) and the chase camera tilts with the grade. The scene is about 225k triangles in 27
  meshes (the first version was a million, nearly all tyre walls).
- 0 console errors or warnings; `npm run build` and `tsc` clean.

`maps/` holds the walkthrough (JPEG, 1280×720; 02-04 are from the dev preview page with the game's
lighting, `/preview/twinpeaks.html`):

| File | Shows |
|---|---|
| `maps-01-garage-event-picker` | The garage's event picker on the race, and the wind "on the straight" |
| `maps-02-twin-peaks-aerial` | The loop, the reservoir in the infield, the peaks and Sutro Tower |
| `maps-03-the-switchbacks` | The climb: armco, tyre walls on the outside of the bends, the descent above |
| `maps-04-over-the-crest-into-the-drop` | The road falling away over the first crest, the valley below |
| `maps-05-race-split-screen-climb` | Split screen on the climb: a poo spin-out |
| `maps-06-summit-hairpin` | The summit hairpin, a tourist in the road |
| `maps-07-landing-off-the-crest` | Both cars landing off the crest (AIR 0.5 s / 0.6 s) |
| `maps-08-race-results` | Race results: times, best laps, the session's best lap, the cool-down lap |
| `maps-09-solo-time-trial` | Solo: a three-lap time trial and a new best run |
| `maps-10-long-jump-after-switching-back` | The long jump after switching back: two arcs, the record buoy |

## Keys and the dropping kicker pass

New keys for one player and for two, and a kicker that drops once the first car is off it (see
"Keys, and a kicker worth racing to" in `DECISIONS.md`). Checked with Node simulations and scripted
Playwright runs against `npm run dev` (Chromium on the real GPU, ANGLE/Metal):

- **Keys, pressed for real in the browser (30 checks, all passing).** Two players: W and ↑ are the
  gas, Left Shift and P boost (and stop on release), Tab and O swap the held items, Left Ctrl and ;
  use them; the old keys (Space, Enter, Right Shift, Q, E, /, .) do nothing. With Ctrl held, the
  other player's ↑ and Player 1's own S still drive, and Ctrl+S and Ctrl+D never reach the browser.
  Tab leaves the focus on the page. Against the CPU: the arrows drive, either Shift boosts, Tab
  swaps, Space uses the item, Ctrl does nothing, and WASD drives too. The HUD's key chips, the
  garage's race-keys strip (it switches when the CPU is turned on) and the countdown card show the
  keys in use. (The macOS Ctrl+arrow and Windows Ctrl+W conflicts are the operating system's and
  can't be seen from a page; they're documented, not tested.)
- **The kicker in the browser (9 checks).** Both cars on the autopilot with the same build, Player 2
  held on the grid for 4 s: the ramp starts dropping at the first launch, the leader's card says FULL
  RAMP!, the chaser's says THE RAMP IS DROPPING! and carries the live strip (24°, then 19° on the
  pier), the leader went off at 25° and flew 139.5 m, the chaser at 14° and flew 93.9 m, the results
  list both angles, and a rematch stands the kicker back up. 0 console errors or warnings.
- **Fuzz:** 120 two-car races, random affordable builds and winds, traffic, items and HYPE, both cars
  drifting on the autopilot: no NaNs, no DNFs, one drop per race, the first car off at exactly 25°
  and the second at 25° − 2°/s × the gap (never below 12°), and grounded cars always on the moving
  ramp. Edge cases: a car already on the ramp when it starts to drop rides down with it (the largest
  height change in a step 7.7 cm) and leaves along the lowered slope; a car in the air over the
  ramp comes down and launches; poo on the ramp goes down with it; the pier crew's push leaves from
  the lowered lip at 12°; a lone car never sees it move.
- **Tuning:** the drop rate was chosen from mirror matches and mixed-build races under five settings
  (the table in `DECISIONS.md`).
- `npm run balance` passes, with a report identical to the previous one (a lone car always gets the
  full ramp).

`ramp/` holds the walkthrough (JPEG, 1280×720; the kicker close-ups at 1100×620 are from a throwaway
preview page with the game's lighting):

| File | Shows |
|---|---|
| `ramp-01-garage-keys-two-players` | The garage's race-keys strip for two players |
| `ramp-02-countdown-one-player` | Against the CPU: the arrows, Shift, Space and Tab, and the kicker tip |
| `ramp-03-race-hud-two-players` | Mid-race: SHIFT and CTRL on Player 1's card, P and ; on Player 2's |
| `ramp-04-leader-off-full-ramp` | The leader launches (FULL RAMP!); the chaser is told to hurry |
| `ramp-05-chaser-ramp-dropping` | The chaser onto the Embarcadero with the ramp down to 19° |
| `ramp-06-two-arcs` | The leader's arc off 25° and the chaser's lower one off 14° |
| `ramp-07-results` | Both angles in the results |
| `ramp-08-kicker-25deg` | The kicker at its full 25°, on its rams |
| `ramp-09-kicker-12deg-lamps` | Down at 12°, lamps lit |
| `ramp-10-kicker-rams` | Underneath: the steel frame and the hydraulic rams |

## Drift, boost and solo pass

Handling, a boost bottle in place of fuel, two item slots with three new items, and solo training
(see "Drift, boost and solo" in `DECISIONS.md`). Checked with Node simulations and scripted
Playwright runs against `npm run dev` (Chromium on the real GPU, ANGLE/Metal):

- **The cornering problem, reproduced and fixed.** Scripted keyboard drivers (full lock or nothing,
  a 0.15 s reaction) hit the Hyde St tyre wall at about 25 m/s with every build before; after,
  drivers who brake to a sensible speed or tap the brake to drift get round (drifters fastest on the
  light cars), and a newcomer who never brakes is the slowest instead of the fastest. In the browser,
  real key events (W, D, a 110 ms tap of S) put the kart into a drift at 25 m/s through the corner.
- **Boost, items, swapping and seagulls on the keys:** Shift fires the boost (the gauge burns, the
  flames show, the meter drains), Q switches the selected item, Space uses it, and a seagull hunts
  down and perches on the CPU 110 m back.
- **Fuzz:** 60 two-car races with traffic and items, both cars on the drifting autopilot: no NaNs,
  no DNFs, no rescues; every item kind rolled and used; 87 swaps, 17 seagulls landed, 2 shooed.
- **Every mode to the results with 0 console errors or warnings:** two players on the autopilot
  (random builds), the CPU, a tailwind jet against a pickup, solo from each of the four starts, a
  solo retry and back to the garage.
- **Solo:** the ghost is recorded and raced on a retry (2,636 frames for a 42 s run), splits compare
  against the best, and each start is clear at GO (the Hyde St start first put the car right behind
  the cable car; now it waits at the far end of its line).
- `npm run balance` passes (report in `DECISIONS.md`).


## Race pass (driving the cars down the city)

The game became a race: steering, throttle and brakes, items, traffic, collisions, Lombard St and a
fluid split screen (see "The race" in `DECISIONS.md`). Four agents checked it in parallel, each
driving its own headless Chromium on the real GPU (ANGLE/Metal) against `npm run dev`, or writing
targeted simulations in Node:

- **Flow QA** played the real UI with real mouse and keys in about 25 browser sessions (1280×720,
  1920×1080, a mid-race resize, and an 800×600 window): the garage, the CPU toggle, the countdown and
  rocket starts, items on their keys, splitting and joining, full races to results, rematch, "New
  players" and mute. 9 of 10 checks passed with 0 console errors. The failure: turning the CPU on
  after Player 1 was already ready left the garage waiting forever (it now starts the countdown).
  Also fixed from its list: the stuck rescue firing on a car that was only stopped or reversing, a
  rocket-start tip that promised "right on GO!" when only an early press counted (there's now a short
  window after GO too), the start banner fading for only one half of a split, the CPU toggle
  throwing away Player 2's own car, and, in the small window, the garage's wind forecast
  over both panels and its hints cut off at the bottom (they all wrap between the panels now).
- **Visual/UX** reviewed about 300 captures at 1280×720 and 1920×1080. Fixed from its report: both
  cars drawn twice while the split healed (the split now slides, see `DECISIONS.md`), the camera
  inside a parked Waymo at the Hyde St corner (traffic now goes see-through), the stalled Waymo's
  cone hidden behind its lidar, sawtooth soil and pale-green wedges along Lombard's hedges,
  overlapping and lingering shouts, ghostly buoy labels in a split, a heavy car's jump that didn't
  read, a weak poo spin-out, folded glider wings sticking up like flaps, course-strip markers over
  the labels, the side view taking over while a car still raced along the pier, a clipped results
  label, and a hedge shortcut that could not be triggered on purpose.
- **Mechanics** wrote repro simulations: hedge jumps, Determination against Waymos, head-ons, cars
  facing backwards at the start fence, rescues into the cable car, parked Waymos pinning cars. After
  the fixes they all run clean. In a sweep of 5,664 random jumps on Lombard every car gets off the
  block within 45 s with no NaNs. No car moves more than 0.5 m beyond its own motion in a step (the
  worst was an 18 m snap out of a flower bed), and none rests outside the road for longer than the
  two steps it takes to slide off a hedge top. Every build placed backwards at a standstill by the
  start fence gets going.
- **Code review** passed the type-check, the production build and the balance check, and found ten
  real bugs. The main ones: every round rebuilt the cast's geometry and materials and never freed
  them (they're shared now), and a poo spin-out snapped the car's heading on grippy wheels (it was
  eased over the wrong duration). The others included item boxes collected by the car's centre point
  only, side-swipes counted as shoves, a countdown that could skip GO when sped up, and scripted
  inputs outliving their round. All fixed, along with per-frame allocations in the cast.

After the fixes: `npm run balance` passes; three fuzz suites of 60 two-car races with traffic and
items show no NaNs and no car ever grounded outside the road; 1920×1080 at a 2× pixel ratio holds
60 fps merged, mid-split and split; and every scripted page load in the final runs logged 0 console
errors or warnings.

`race/` holds a walkthrough (JPEG, 1280×720 unless noted):

| File | Shows |
|---|---|
| `race-01-garage-800x600` | The garage in a small window: the forecast and the hints wrap between the panels |
| `race-02-countdown` | The grid, the controls card, glider wings folded away on P1's sedan |
| `race-03-split-slides-in` | Splitting: P2's view carries on while P1's slides in with the divider |
| `race-04-split` | Split: each player's own chase camera |
| `race-05-heal-slides-out` | Healing: P1's half slides out, P2's widens back into the shared view |
| `race-06-lombard` | Lombard's switchbacks: brick, hedges, hydrangeas |
| `race-07-jump` | A loaded pickup's Jump: the dust ring left on the road, the car in the air |
| `race-08-poo-spin` | Spun out in poo: dizzy stars, brown spray, the splat on the road |
| `race-09-stalled-waymo` | The stalled Waymo facing uphill with its cone, hazards, loose cones |
| `race-10-determination` | Determined: the golden aura, the shout |
| `race-11-shouts-stacked` | Three shouts at once, stacked above the name tag |
| `race-12-flight-split-1920` | One car flying (side-on), the other still on the pier |
| `race-13-flight-heal-1920` | Healing into the shared flight view: the pier half slides out |
| `race-14-results-1920` | Results, framed through the next distance label |

## Garage pass (the build-phase redesign)

The turn-based draft was replaced by a garage that both players use at the same time (see "Garage"
in `DECISIONS.md`). Three agents verified it, each driving its own headless Chromium against
`npm run dev`:

- **Flow QA** drove the real UI with mouse, keys and touch at 1280×720 and 1920×1080. That covered
  about 80 races, a fit/swap fuzz and a whole-game fuzz.
- **Visual/UX** reviewed every garage state at both sizes and on short laptop windows.
- **Re-verification** ran after their findings were fixed. It confirmed every fix and re-ran the
  regression sweep, and came back clean: 0 console errors or warnings in about 60 page loads, and
  race results still equal to `simulateToEnd`. It also raised four low-severity follow-ups (the
  focused name box, long names in the banner, fallback-font room in the stats, multi-character
  emoji). Those were fixed and checked with scripted Playwright runs.

`garage/` holds a walkthrough at both sizes (`1280-*`, `1920-*`):

| File | Shows |
|---|---|
| `01-garage-start` | A fresh garage: both panels live, one tab per slot |
| `02-hover-preview` | Hovering the Jet: ghost stat bars, the money after the swap, the jet on the car |
| `03-locked-parts-and-keys` | P1 nearly spent (NEED $X MORE); P2 built with the arrow keys |
| `04-one-ready` | P1 ready and locked in, P2 still building |
| `05-results` | The results after both players hit READY |
| `06-rematch-tweaked` | Round 2 with both cars kept, then tweaked: gold changed tabs, LAST RACE, last distances |

The build-phase screenshots below show the old draft from `554a8ef`. That's `*-01-build-start` and
`U-03` in `visual/`, and the draft and rematch shots in `flow/`. Everything from the countdown on is
unchanged.

## Original pass

Screenshots from the final Playwright verification pass on commit `554a8ef`. Three agents ran in
parallel, each driving its own headless Chromium on the real GPU (ANGLE/Metal) against
`npm run dev`. All three came back **fully clean**, with 0 console errors or warnings on every page
load.

| Agent | Folder | What it checked |
|---|---|---|
| Flow | `flow/` (10) | The full loop through the real UI (mouse and keys, both players drafting 9 slots, 6 races, two seeds, 1280×720 and 1920×1080). Covers: unaffordable options disabled, alternating turns, the first picker swapping on rematch, last round's picks highlighted with Keep, New players resetting everything, sensible results, and the keyboard shortcuts. |
| Physics | `physics/` (42) | Game results match `simulateToEnd` bit for bit, in the browser and in Node. Also: V8 + tiny wheels wheelspin, wasted fuel and out-of-fuel flashes, glider wings visibly gliding on a go-kart, a headwind shortening distances, determinism at any `?speed`, DNF handling and the straggler camera, and the balance targets. |
| Visual | `visual/` (128) | Every spec moment at 1280×720 and 1920×1080 (`1280-01…14`, `1920-01…14`: build, chase, launch, flight, glide, splash, results). Plus the SF scenery, effects, car parts, camera cuts, UI layout audit, water, the Lift stat and long names. |

Visual file prefixes:

| Prefix | Shows |
|---|---|
| `F-` | Far-apart race |
| `S-` | Straggler camera cuts |
| `C-` | Rematch / New players cuts |
| `O-` | Start gantry |
| `U-` | UI audit |
| `N-` | Long names |
| `R-` | Short round |
| `D-` | Both-DNF results |
| `L-` | Lift stat |
| `W-` | Water |
| `1280x2-` | 2× pixel-density close-ups (best flag, effects, glider, all car parts) |

Accepted, documented behaviour is listed in `DECISIONS.md` ("Known minor issues" and "Camera").

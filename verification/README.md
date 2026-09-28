# Verification

## Old Stomping Grounds pass

The new race map round the Haight, Alamo Square, Hayes Valley, Duboce and Buena Vista, and what came
with it for every map: surfaces, the crawl, dogs, streetcars, chunked courses and `courseProblems`
(see "Old Stomping Grounds" in `DECISIONS.md`). Checked with Node simulations and Playwright against
`npm run dev`:

- **Existing maps unchanged:** 18 fingerprinted two-car races on Russian Hill (both events) and Twin
  Peaks identical after every change; `npm run balance` passes as before; the shared scenery helpers
  give byte-identical geometry for what the old maps ask of them.
- **`npm run smoke`** passes with the new map; `defineMap` checks every course against the shared
  rules (climbs up to 25%, no bend tighter than the road, no overlapping legs).
- **`npm run balance:race`:** every build gets home on every race map in every wind. Here, a V8 or
  jet lap is 109.0 s (median), three laps about 5¼ minutes; a lawnmower's about 9.
- **Open parks:** straight across Alamo Square takes a V8 40 s against 25 on the paths (the lawn's
  cap, the long grass, the obstacles); the best line a route search finds, lawn allowed, gains about
  a second; a Jump over the summit loop saves two.
- **CPU races, headless:** no rescues; per car per lap about 2.7 dog chases, and air every lap off
  the steps (0.6 s), three Hayes crests, Buchanan over the Mint's hill and the top of the Duboce
  wall.
- **Ground under the asphalt:** looking straight down every metre of the course out to 22 m either
  side, the ground shows through nowhere a racer sees it (see "The ground under the streets").
- **Browser:** two autopilot cars from the garage to the results; 0 console errors or warnings; 60
  fps (the cap) on the results and in every still view at 1920×1080 on a 2× display, 48-58 racing
  in split screen there with the machine busy (Russian Hill 52-61 alongside); the scenery about 1.12
  million triangles in 59 meshes, built in about 1.4 s. `npm run build` clean.

`osg/` (JPEG, 1280×720; `osg-p*` are from the dev preview, `/preview/stomping.html`, with the game's
lighting):

| File | Shows |
|---|---|
| `osg-01-garage` | The garage with the fourth event, "Old Stomping Grounds", the wind "on the Panhandle", the grid on Haight St |
| `osg-02-start-haight` | Race day on the Upper Haight: barriers down both kerbs, the crowd, Piedmont's legs, the murals, two rocket starts |
| `osg-03-ashbury` | Over the crest at Ashbury (0.8 s of air), barriers and the crowd |
| `osg-04-panhandle` | Along Oak beside the Panhandle |
| `osg-05-scott` | Up Scott St: crosswalks, barricades across the cross streets |
| `osg-06-alamo-ramp` | Into Alamo Square under the ALAMO SQUARE arch, tyres round the corner, the paths scored concrete |
| `osg-07-dog-park` | Round the dog lawn: the grass darker, patchy and textured, long grass in it, the dogs loose |
| `osg-08-summit` | The summit loop and its paved plaza, the railing along the park's edge |
| `osg-09-tourists-lawn` | Split screen through the tourists on the lawn, long grass either side of the path |
| `osg-10-steps-jump` | Off the 39 steps (0.6 s of air) and down onto Fulton & Steiner, tyres round the hairpin |
| `osg-11-painted-ladies` | South on Steiner towards Hayes |
| `osg-12-hayes-crests` | Air off the crests down Hayes |
| `osg-13-hayes-shops` | The 500 block of Hayes, its shops behind the barriers |
| `osg-14-patricias-green` | Down the middle of Patricia's Green |
| `osg-15-page` | Page St, tyres round the corner |
| `osg-16-mint` | Over Buchanan's crest at Haight St, the Mint on its rock |
| `osg-17-n-judah` | Along Duboce Ave on the N Judah's tracks under its wires |
| `osg-18-duboce-park` | Through Duboce Park on its concrete path, the dogs, the Harvey Milk Center's playground |
| `osg-19-duboce-wall` | Up the Duboce wall, cars parked nose-in |
| `osg-20-buena-vista` | Buena Vista's zigzag between its stone walls, item boxes |
| `osg-21-switchbacks` | Buena Vista's switchbacks |
| `osg-22-upper-haight` | Back on Haight: over the line into lap 2 |
| `osg-99-results` | The results: times, best laps, badges, the session's best lap |
| `osg-p1-aerial` | The whole map: the Panhandle, Alamo Square, Hayes Valley, Duboce Park and Buena Vista |
| `osg-p2-postcard` | Postcard Row from the tourists' lawn, downtown behind |
| `osg-p3-ladies` | Steiner past the Painted Ladies, the park's lawn up to its fence |
| `osg-p4-green` | Patricia's Green: the sculpture, Proxy's containers |
| `osg-p5-hayes` | Down Hayes from the top, downtown beyond |
| `osg-p6-buena-vista` | Into Buena Vista: its walk, stone walls and woods |
| `osg-p7-dog-park` | The dog lawn from the path: the grass's patches, long grass, the concrete path |
| `osg-p8-alamo-gate` | The ALAMO SQUARE arch over the ramp, from the chase camera's height |
| `osg-p9-duboce-park` | Duboce Park from Steiner: its path, the N Judah into the Sunset Tunnel, the grass up the bank over it |

## One game, many maps pass

The restructure that defines modes, maps and physics once (see "One game, many maps" in
`DECISIONS.md`), and the Russian Hill sprint. Checked in Node and in headless Chromium (GPU) against
`npm run dev`:

- **Existing maps unchanged:** 16 fingerprinted two-car races (traffic, items, HYPE, drifting CPUs)
  identical before and after every step (one Twin Peaks trace moved by rounding when the CPU took the
  sim's grip formula; no result changed). `npm run balance` byte-identical and passing;
  `npm run balance:race`'s Twin Peaks section byte-identical.
- **`npm run smoke`:** every map and mode, plus spline test courses (a kicker facing −z raced as a
  long jump and as a race; a finish line with a run-off): no NaNs, all runs end, results follow the
  rules, splashes measured along the lip, deterministic. Passing.
- **Browser:** autopilot races to the results on all three events; switching events in the garage;
  a solo sprint; 0 console errors or warnings; `npm run build` clean.

`extensible/` (JPEG, 1280×720; 05 is 1100×620 from `/preview/city.html?view=kickerTop&map=russian-hill-race`):

| File | Shows |
|---|---|
| `ext-01-garage-three-events` | The event picker: long jump and sprint on Russian Hill, the Twin Peaks race; the shared gantry and grid |
| `ext-02-long-jump-flight` | The long jump as before: the kicker and buoys built from the lip, the ramp dropping for the chaser |
| `ext-03-sprint-winner-off-the-kicker` | The sprint: first off the kicker is the winner (no HYPE, the ramp stays up) |
| `ext-04-sprint-results` | Sprint results: times, "First to the lip", the flights, the session best |
| `ext-05-kicker-finish-band` | The chequered finish band on the kicker, shown only for the sprint |
| `ext-06-twin-peaks-shared-gantry` | Twin Peaks' start line, grid and gantry from the shared builders |
| `ext-07-twin-peaks-shared-tyre-walls` | Twin Peaks mid-race with the shared tyre walls |
| `ext-08-solo-sprint` | A solo sprint from Leavenworth: a time trial against the ghost |

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

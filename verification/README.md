# Verification

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

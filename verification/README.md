# Verification

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

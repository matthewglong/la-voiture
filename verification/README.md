# Verification

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

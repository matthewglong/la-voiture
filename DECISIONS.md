# La Voiture — decisions log

Choices made while building that `BUILD_PROMPT.md` did not pin down, plus the final balance report.
Where this file and the prompt disagree, the prompt's intent was followed and the reason is given here.

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

## Track

- Segment lengths are **arc lengths** along the road. The kicker is 12 m of ramp at 25°, which puts
  the lip at y = 4 + 12·sin 25° ≈ 9.07 m ("about 9 m").
- The start line sits at y ≈ 36.97 m: the three blocks and intersections drop ≈ 32.97 m to the
  Embarcadero, which is at deck height (y = 4) like the pier.
- Each intersection's cable-car tracks (the bump) are at its centre.
- Lanes are z = −3 (P1) and z = +3 (P2); looking down the hill, P1 is on the left like the P1 panel.

## Physics details

- Run-up drag uses the full airspeed vector: the car moves along the slope, the wind is horizontal,
  and the drag's tangential component is applied. On a flat road this is exactly ½ρ·CdA·|v−w|·(v−w).
- Rolling resistance acts like static friction at rest, so a car on the flat start line only moves
  under power.
- **Stall rule:** DNF when speed ≤ 0.3 m/s after the first 1 m, or if the car has not covered 1 m
  after 5 s. A 90 s run-up cap and a 30 s flight cap are safety nets (never reached by any build).
- Lift (wings, bathtub body, kite) only acts in flight. The kite's lift is ½ρ·ClA_kite·|v_air|²
  capped at its limit, added to the body/wing lift along the same "perpendicular, rotated towards up"
  direction; its extra drag only applies once open (at the lip).
- The splash point is interpolated inside the last step, so distances don't jump in 1/120 s steps.
  The score is clamped at ≥ 0.
- The game and `simulateToEnd` share `CarSim.step(DT)` with a fixed 1/120 s step; the game only
  changes how many steps run per frame, so results match `simulateToEnd` bit for bit.

## Game flow and UI

- **Wind** is rolled uniformly in −8…+8 m/s at the start of each round and rounded to 0.1 m/s.
  Anything under 0.5 km/h displays as "CALM".
- **Keys 1–9** pick the Nth option (the prompt says 1–4, but Paint has eight options).
  **Enter** keeps last round's pick during a rematch draft, launches once the draft is complete, and
  starts a rematch from the results screen. **M** mutes; a clickable sound button does the same for
  mouse-only players.
- Before a slot is drafted, a car shows last round's part (rematch) or the $0 part (round 1). Each
  player's car starts in their own default paint (P1 red, P2 blue) until Paint is drafted.
- Player identity colours: P1 `#ff5a36` (coral), P2 `#2e8bff` (blue). They tint panels, HUD cards,
  name tags over the cars and the flight trails; the drafted Paint colours the car body.
- Hovering a card previews the part on the car **and** on the stat bars (striped ghost bar,
  green/red value when it is better/worse).
- Stat bars: Power and Fuel use a square-root scale so the lawnmower and jerry can are still
  visible; the Lift bar counts the kite as its lift area at a typical 30 m/s launch; Bump resistance
  shows the kinetic energy lost per cable-car crossing.
- Toppers have 1–2 kg of mass (the table says "small"), and `computeStats` includes it, so the game
  and `simulateToEnd` stay identical. The balance check uses the no-topper default.
- **"New players"** resets names, the round counter, the first picker (P1), last round's cars and
  the session best (and hides the best-distance buoy). The wind RNG simply continues.
- The best-distance flag buoy sits between the lanes at the record distance and is labelled with
  the record holder's name, tinted in their colour.
- Buoys float in both lanes every 10 m out to 250 m. Their number labels sit between the lanes so
  the two rows never overlap on screen; every 50 m gets a big yellow buoy with a tall marker label.
- `?speed=N` scales all game time (countdown, race, pause before results), clamped to 0.05–50.

## Test hooks

`window.__game` exposes everything the prompt lists (`state`, `pick(i)`, `configs`, `wind`,
`results`, `launch()`, `rematch()`, `newPlayers()`, `setSpeed(n)`) plus: `ready`, `keep()`,
`draft` (slot, active player, first picker, money, picks, previous picks), `cars` (live sim
states), `events` (bump/fuelEmpty/launch/splash/dnf log), `sessionBest`, `round`, `names`,
`setName(p, name)`, `predict()` (simulateToEnd for the current configs and wind), `computeStats`,
`simulateToEnd` and `parts`.

- `launch()` works from the build phase at any time: unfinished picks are completed by keeping last
  round's part when affordable, otherwise the $0 option.
- `?autobuild=1` drafts both cars at random (affordable options only) at the start of every round.
- `?wind=W` (extra) pins the wind to W m/s for every round, for deterministic physics checks.

## Balance tuning

The starting numbers in the prompt's table missed every tuning target when simulated: the all-$0
build flew 39–84 m, the best builds ~290 m with 8–10 s of airtime, the same Go-kart + V8 build won in
every wind, and the Pickup never reached the top 10%. `npm run balance` enumerates all 2,428
affordable builds in three winds. A scripted local search over the catalog found the region below;
it was then rounded by hand and re-checked. The search penalised:

- the pass criteria and the tuning targets;
- distance from the table's numbers;
- any broken tagline ordering (e.g. the Go-kart must stay the slimmest chassis, Blunt > Wedge >
  Cone, Lawnmower < V8 < Jet).

**A stricter test than the prompt's.** The top-10% criterion can pass while a part is never worth
picking: it slips into the top 10% riding on otherwise-strong builds. An early tune did exactly that.
The Bathtub was never the best chassis for any build, and Glider wings made every V8 build fly
*shorter*, because their drag on the run-up cost more than their lift gained in a 3–5 s flight.

`balance.ts` therefore also checks the prompt's actual design rule ("every part must be the best
choice for some build and wind"):

- **Paid options:** with the other six slots fixed, each must be the strictly best pick for its slot
  in at least one build and wind.
- **Free "keep the money" options** (no wing, no booster, blunt nose): each must sit on the
  price/distance Pareto front in some wind.

That is why the Bathtub became a real lifting body (small extra drag, big lift) and the Glider got
its table lift back.

What changed and why:

| Part | Table | Now | Why |
|---|---|---|---|
| Go-kart | CdA 0.45 | CdA 0.8 | Everything was too slippery; still the slimmest chassis |
| Bathtub | 350 kg, CdA 1.1, ClA 0.6 | 300 kg, CdA 1.0, ClA 2.0 | A lifting body needs lift that repays its drag; now wins in headwinds and calm air |
| Sedan | 1000 kg, CdA 0.7 | 900 kg, CdA 1.0 | Heavy chassis were starved of energy per kg |
| Pickup 4x4 | 1600 kg, CdA 1.0 | 1250 kg, CdA 1.05 | As above; 4WD grip ×1.35 unchanged |
| Tiny wheels | μ 0.70, crr 0.010, bump 8% | μ 0.85, crr 0.008, bump 25% | Cable-car tracks are now the all-$0 build's main brake |
| Standard wheels | crr 0.015, bump 4% | crr 0.015, bump 8% | Makes Monster wheels worth their weight |
| Monster wheels | crr 0.030 | crr 0.035 | Slightly slower-rolling to offset the bigger bump savings |
| Lawnmower | 12 kW | 2.5 kW | 150 kJ on a 260 kg kart outran most real builds |
| V8 | 120 kW | 185 kW | Now spins its wheels on light cars unless you buy grip |
| Jet | 250 kW, cap 12 kN, 400 kg | 190 kW, cap 16.5 kN, 420 kg | V8-like power that never spins: wins in a headwind |
| Jerry can | 150 kJ | 80 kJ | Sized for the lawnmower (32 s burn) |
| Oversized tank | 1200 kJ, 250 kg | 1000 kJ, 280 kg | Keeps the best distances under 180 m |
| Spoiler | ClA 0.4 | ClA 0.6 | Needed a niche next to the stronger Glider |
| Glider wings | CdA 0.35 | CdA 0.4 | Lift kept at 3.0; a touch more drag keeps airtime under 6 s |
| Blunt nose | +0.3 CdA | +0.55 CdA | Keeps the free nose a real tradeoff |
| Nitro | 150 kJ | 120 kJ | Distances |
| Kite | cap 3000 N, +0.8 CdA | cap 2300 N, +1.1 CdA | Airtime; still the best booster for slow builds |

Unchanged: all prices, Standard/Monster grip, Monster drag, the Standard tank, Wedge, Cone, the
Kite's lift area, and the other masses. The design relationships the taglines describe (slim kart,
lifting-body tub, 4WD pickup, spinning V8, grip-free jet, matched tanks, cheap-but-draggy nose,
lift that only pays off on light cars) are all still true.

**How the winds differ.**

- Headwind: a Bathtub with a Jet (no wheelspin) and Nitro wins.
- Calm air: a Bathtub on Monster wheels with a V8 and Nitro wins.
- Tailwind: a Go-kart on Monster wheels with a V8 and a Kite wins.

All three winners are within a few metres of the next builds.

**Targets.** The all-$0 target (5–25 m) is checked in calm air. In a ±8 m/s wind the same build must
still reach the lip and land 3–40 m out; it lands 6.0 m (headwind) and 35.3 m (tailwind). Top builds
reach the lip in 9–10 s and fly for 3–5.5 s. The all-$0 build takes ~21 s to reach the lip; it is
meant to be the slow one, and a few lawnmower builds that make the headwind top 10% take up to 29 s.

### Final balance report (`npm run balance`)

```
La Voiture balance report
Affordable builds (performance slots, budget $100): 2428
Top 10% = 243 builds per wind

## Top 15, headwind -8 m/s
  #   dist m    $  lip m/s  run s  air s  waste  build
  1    132.3  100     36.5    9.8    4.3     0%  Bathtub · Standard · Jet · Oversized · None · Cone · Nitro
  2    130.2   85     35.9   10.3    4.3     0%  Bathtub · Standard · V8 · Oversized · None · Cone · Nitro
  3    130.1   95     36.6    9.9    4.3     0%  Bathtub · Monster · V8 · Oversized · None · Cone · Nitro
  4    130.1   93     35.2   10.4    4.5     0%  Bathtub · Standard · V8 · Oversized · Spoiler · Cone · Nitro
  5    128.5   93     36.1    9.9    4.2     0%  Bathtub · Standard · Jet · Oversized · None · Wedge · Nitro
  6    128.2   95     39.0    9.4    3.8     0%  Go-kart · Standard · Jet · Oversized · None · Cone · Nitro
  7    127.2   95     33.6    9.8    4.9     0%  Bathtub · Standard · Jet · Oversized · None · Cone · Kite
  8    126.8   90     36.1    9.4    4.4     0%  Go-kart · Standard · Jet · Oversized · None · Cone · Kite
  9    126.7   98     35.2    9.5    4.6     0%  Go-kart · Standard · Jet · Oversized · Spoiler · Cone · Kite
 10    125.5   88     36.0   10.0    4.2     0%  Bathtub · Monster · V8 · Oversized · None · Wedge · Nitro
 11    125.4   96     37.7    9.5    3.9     0%  Go-kart · Standard · Jet · Oversized · Spoiler · Wedge · Nitro
 12    125.1   98     37.9    9.7    3.9     0%  Go-kart · Monster · V8 · Oversized · Spoiler · Cone · Nitro
 13    125.1   98     34.0   10.5    4.6     0%  Go-kart · Standard · V8 · Oversized · Glider wings · Wedge · Nitro
 14    125.0   96     35.3   10.1    4.3     0%  Bathtub · Monster · V8 · Oversized · Spoiler · Wedge · Nitro
 15    125.0   78     35.3   10.4    4.3     0%  Bathtub · Standard · V8 · Oversized · None · Wedge · Nitro
DNFs in this wind: 54

## Top 15, calm (0 m/s)
  #   dist m    $  lip m/s  run s  air s  waste  build
  1    146.6   95     39.5    9.6    4.4     0%  Bathtub · Monster · V8 · Oversized · None · Cone · Nitro
  2    146.5   90     36.8    9.6    5.0     0%  Bathtub · Monster · V8 · Oversized · None · Cone · Kite
  3    146.0   93     38.0    9.4    4.8     0%  Go-kart · Monster · V8 · Oversized · Spoiler · Cone · Kite
  4    145.9   98     36.2    9.7    5.1     0%  Bathtub · Monster · V8 · Oversized · Spoiler · Cone · Kite
  5    145.7   85     38.7    9.3    4.7     0%  Go-kart · Monster · V8 · Oversized · None · Cone · Kite
  6    144.4   90     38.1    9.2    4.6     0%  Go-kart · Standard · Jet · Oversized · None · Cone · Kite
  7    144.1   98     37.4    9.3    4.7     0%  Go-kart · Standard · Jet · Oversized · Spoiler · Cone · Kite
  8    143.9   98     40.9    9.4    4.1     0%  Go-kart · Monster · V8 · Oversized · Spoiler · Cone · Nitro
  9    143.6   88     39.2    9.6    4.3     0%  Bathtub · Monster · V8 · Oversized · None · Wedge · Nitro
 10    143.5   96     38.6    9.7    4.4     0%  Bathtub · Monster · V8 · Oversized · Spoiler · Wedge · Nitro
 11    143.3   83     36.4    9.6    5.0     0%  Bathtub · Monster · V8 · Oversized · None · Wedge · Kite
 12    142.9   90     41.6    9.3    4.0     0%  Go-kart · Monster · V8 · Oversized · None · Cone · Nitro
 13    142.7   93     37.9   10.1    4.4     0%  Bathtub · Standard · V8 · Oversized · Spoiler · Cone · Nitro
 14    142.6   78     38.2    9.3    4.7     0%  Go-kart · Monster · V8 · Oversized · None · Wedge · Kite
 15    142.6   86     37.5    9.4    4.8     0%  Go-kart · Monster · V8 · Oversized · Spoiler · Wedge · Kite
DNFs in this wind: 0

## Top 15, tailwind +8 m/s
  #   dist m    $  lip m/s  run s  air s  waste  build
  1    167.0   85     41.1    9.1    4.9     0%  Go-kart · Monster · V8 · Oversized · None · Cone · Kite
  2    166.6   93     40.6    9.2    5.0     0%  Go-kart · Monster · V8 · Oversized · Spoiler · Cone · Kite
  3    165.5   78     40.9    9.1    4.9     0%  Go-kart · Monster · V8 · Oversized · None · Wedge · Kite
  4    164.8   86     40.4    9.2    5.0     0%  Go-kart · Monster · V8 · Oversized · Spoiler · Wedge · Kite
  5    162.7   90     39.4    9.4    5.0     0%  Bathtub · Monster · V8 · Oversized · None · Cone · Kite
  6    160.9   98     38.9    9.4    5.1     0%  Bathtub · Monster · V8 · Oversized · Spoiler · Cone · Kite
  7    160.9   83     39.2    9.4    5.0     0%  Bathtub · Monster · V8 · Oversized · None · Wedge · Kite
  8    160.1   98     43.3    9.2    4.3     0%  Go-kart · Monster · V8 · Oversized · Spoiler · Cone · Nitro
  9    159.9   95     41.9    9.4    4.4     0%  Bathtub · Monster · V8 · Oversized · None · Cone · Nitro
 10    159.4   91     38.8    9.4    5.1     0%  Bathtub · Monster · V8 · Oversized · Spoiler · Wedge · Kite
 11    159.2   90     39.8    9.0    4.8     0%  Go-kart · Standard · Jet · Oversized · None · Cone · Kite
 12    159.2   90     43.8    9.2    4.2     0%  Go-kart · Monster · V8 · Oversized · None · Cone · Nitro
 13    158.5   88     41.8    9.4    4.4     0%  Bathtub · Monster · V8 · Oversized · None · Wedge · Nitro
 14    158.5   91     43.1    9.2    4.2     0%  Go-kart · Monster · V8 · Oversized · Spoiler · Wedge · Nitro
 15    158.3   96     41.4    9.4    4.5     0%  Bathtub · Monster · V8 · Oversized · Spoiler · Wedge · Nitro
DNFs in this wind: 0

## Options: best rank and appearances in the top 10% (243 builds)
slot       option         best  (wind)   top@-8   top@0  top@+8
Chassis    Go-kart           1    (+8)      106     109     114
Chassis    Bathtub           1    (-8)       87      85      85
Chassis    Sedan           115    (-8)       35      38      35
Chassis    Pickup 4x4      140    (-8)       15      11       9
Wheels     Tiny            132    (-8)       34      29      24
Wheels     Standard          1    (-8)      127     128     121
Wheels     Monster           1     (0)       82      86      98
Engine     Lawnmower       182    (-8)        6       3       1
Engine     V8                1     (0)      143     146     152
Engine     Jet               1    (-8)       94      94      90
Fuel tank  Jerry can       182    (-8)        6       3       1
Fuel tank  Standard        160    (-8)        9      11      22
Fuel tank  Oversized         1    (-8)      228     229     220
Wing       None              1    (-8)      117     120     118
Wing       Spoiler           2    (+8)       89      87      90
Wing       Glider wings     13    (-8)       37      36      35
Nose       Blunt            34    (+8)       77      84      85
Nose       Wedge             3    (+8)       92      86      88
Nose       Cone              1    (-8)       74      73      70
Booster    None             47    (-8)       77      79      77
Booster    Nitro             1    (-8)       88      87      97
Booster    Kite              1    (+8)       78      77      69

## Best pick for its slot (other six slots fixed, any wind)
Chassis    Go-kart       1116 contexts
Chassis    Bathtub       155 contexts
Chassis    Sedan         62 contexts
Chassis    Pickup 4x4    636 contexts
Wheels     Tiny          28 contexts
Wheels     Standard      1988 contexts
Wheels     Monster       435 contexts
Engine     Lawnmower     871 contexts
Engine     V8            797 contexts
Engine     Jet           853 contexts
Fuel tank  Jerry can     436 contexts
Fuel tank  Standard      344 contexts
Fuel tank  Oversized     1622 contexts
Wing       None          free: on the price/distance Pareto front
Wing       Spoiler       37 contexts
Wing       Glider wings  102 contexts
Nose       Blunt         free: on the price/distance Pareto front
Nose       Wedge         315 contexts
Nose       Cone          2040 contexts
Booster    None          free: on the price/distance Pareto front
Booster    Nitro         2163 contexts
Booster    Kite          228 contexts

## All-$0 build (Go-kart · Tiny · Lawnmower · Jerry can · None · Blunt · None)
headwind -8 m/s      6.0 m  lip 4.6 m/s, run 26.8 s, air 1.6 s, wasted 16% fuel
calm (0 m/s)         20.9 m  lip 12.1 m/s, run 21.4 s, air 2.0 s, wasted 33% fuel
tailwind +8 m/s      35.3 m  lip 17.3 m/s, run 19.1 s, air 2.3 s, wasted 40% fuel

## Checks
- Distinct #1 builds across winds: 3
- Distinct chassis in each wind's top 5: -8: 1, 0: 2, +8: 2 (union: 2)
- Run-up time, top 10%: 9.0-28.8 s (all finishers: 9.0-30.2 s)
- Flight time, top 10%: 3.1-5.5 s (all finishers: 1.4-5.5 s)
- PASS: every performance option reaches the top 10% in some wind and is the best pick for its slot in some build, the winner changes with wind, the all-$0 build reaches the lip in every wind and splashes 5-25 m out in calm air, best builds fly 80-180 m, no NaNs.
```

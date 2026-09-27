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

- `preview/*.html` are dev-only showroom pages for each scene module (city, landmarks, cars) using the
  game's lighting (`preview/harness.ts`). They are type-checked but not part of the production build.

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
- Both the lip crossing and the splash are interpolated inside their step (position, speed and
  time). The score is clamped at ≥ 0.
- **Residual fixed-step wobble.** Distance can wobble by up to ~0.15 m between neighbouring wind
  values (up to ~0.25 m with a kite and ~0.4 m with glider wings). Two fixed-step effects cause it:
  - The run-up step keeps its starting slope across a slope change (mostly the pier-to-kicker
    corner).
  - Glider wings open at the first step boundary after the apex rather than at the apex itself.

  So some non-glider builds, with or without lift, can fly up to ~0.12 m further in a headwind than
  in calm air. Removing this would need sub-stepping at slope changes and at the apex, which departs
  from the spec's fixed 1/120 s step for a sub-metre effect nobody can see in play. The −8 m/s
  headwind still shortens every build by at least 1.5 m.
- The game and `simulateToEnd` share `CarSim.step(DT)` with a fixed 1/120 s step; the game only
  changes how many steps run per frame, so results match `simulateToEnd` bit for bit.
- **Bit-exact across JS engines.** `Math.cos`, `Math.sin` and `Math.hypot` are not correctly rounded
  and differ in their last bits between V8 versions: Node 22 and Chromium 153 disagreed at ~1e-13.
  So each track segment stores `cos`/`sin` computed from its grade with `Math.sqrt`, which is
  correctly rounded everywhere. The kicker is defined by the literal grade tan 25° = 0.4663076581549986,
  and the sim uses `Math.sqrt(x*x + y*y)` instead of `Math.hypot`. Node (`npm run balance`) and the
  browser now produce identical numbers. Only the display-only `angle` field still uses
  `atan`/`atan2`.

### Glider wings (a deliberate model change)

With the spec's lift model (constant ClA from the lip, perpendicular to the airspeed), glider wings
never *glide*. Verification measured the same ~33–40° water entry with or without wings at any lift
value: lift is strongest in the fast climb, so the car balloons into a taller lob. The physics
check "glider wings on a go-kart visibly glide" could not pass, so the glider changed, in the same
spirit as the spec's kite that opens at the lip:

- **Spring-loaded wings:** folded (sleek, small drag) on the run-up and the climb; they pop open at
  the top of the arc (`wingsOpen` event, "GLIDING!" on the HUD, a swoosh, and the mesh unfolds).
- **Open wings** add their lift area (`clA`) and extra drag (`openCdA`).
- **Trim cap.** Their lift, together with a kite's, is capped at `trim` × the car's weight: the wings
  settle into a steady glide instead of ballooning. A kite that already pulls harder keeps its own
  capped lift.
- The cap also keeps "a headwind shortens distances" true for gliders in the strongest headwind.
  Uncapped, extra airspeed meant extra lift, and gliders flew *further* into a headwind.
- Result: a ballistic climb, then a visibly flatter, longer descent on light cars. Heavy cars barely
  change ("great on light cars").
- The −8 m/s headwind shortens every one of the 2,428 builds. Slow gliders are the exception to
  "wind in your favour means further":
  - A handful whose wings open below their trim speed can gain up to ~1.7 m from a *moderate*
    headwind: extra airspeed adds lift faster than drag.
  - A tailwind can cost such a glider up to ~5 m: less airspeed, less lift.
  - `npm run balance` sweeps every headwind and reports both effects. They follow from the spec's
    airspeed = v − wind. Beyond the fixed-step wobble (see "Residual fixed-step wobble"), only
    slow glider builds are affected.

Body lift (the bathtub), the spoiler and the kite otherwise follow the spec exactly.

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
- The Lift bar shows lift at a typical 30 m/s as a share of the car's weight ("65% wt"; a full bar
  means lift equal to weight). It is composed exactly like the physics: body and spoiler lift, plus
  the kite and glider wings together (wings capped by their trim, the kite by its maximum pull).
  The same wings read higher on a light car (a go-kart shows 65%, a pickup 45%), matching where
  they help most.
- Stat bars: Power and Fuel use a square-root scale so the lawnmower and jerry can are still
  visible; Bump resistance shows the kinetic energy lost per cable-car crossing.
- Toppers have 1–2 kg of mass (the table says "small"), and `computeStats` includes it, so the game
  and `simulateToEnd` stay identical. The balance check uses the no-topper default.
- **"New players"** resets names, the round counter, the first picker (P1), last round's cars and
  the session best (and hides the best-distance buoy). The wind RNG simply continues.
- The best-distance flag buoy sits between the lanes at the record distance and is labelled with
  the record holder's name, tinted in their colour.
- Buoys float in both lanes every 10 m out to 250 m. Their number labels sit between the lanes so
  the two rows never overlap on screen; every 50 m gets a big yellow buoy with a tall marker label.
- `?speed=N` scales all game time (countdown, race, pause before results), clamped to 0.05–50.
- The inactive player's panel is greyed and slightly shrunk rather than made see-through, so both
  builds stay readable on a TV.
- The "central banner" sits bottom-centre, above the key hint. The in-world "LA VOITURE" start
  gantry then stays visible under the wind forecast rather than hidden behind the UI.
- Small text never drops below ~11 px (panels, taglines, HUD) so 1280×720 on a TV stays legible.
- Buttons drop keyboard focus after a mouse click, and the game's keys call `preventDefault`, so
  Enter never re-presses the last clicked button (e.g. the sound toggle). A button reached with Tab
  keeps its native Enter/Space press.
- Names are trimmed, cut to 16 characters and trimmed again; an empty name falls back to "Player N".
  The name box accepts up to 40 raw characters so leading spaces don't eat into the 16.
- Name tags over the cars stack instead of overlapping when the cars are side by side. The upper
  slot only changes hands when the order clearly flips, so tags don't hop rows.
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

## Camera

- **Build:** ~16 m behind the start line and ~6 m up, so the turning cars always sit in the gap
  between the two side panels, with the "LA VOITURE" start gantry, the street and the Bay beyond.
- **Chase:** behind and above the *trailing* car, looking just past the midpoint. It rises and pulls
  back as the cars separate, so both stay in frame up to 45 m apart; beyond that it follows the
  leader, which would otherwise be a speck. It starts low enough to pass under the start-line banner.
- **Flight:** the camera is an orbit (focus, yaw, pitch, distance), so the switch at the first launch
  swings smoothly round from behind to side-on (+z side, so +x reads left to right). It pans with the
  leader. The lip, and any car in the air or within 65 m of the lip, stay in frame until the span
  needs more than ~135 m of distance; after that the lip, then the trailing car, drop out.
- **Straggler follow-up:** if one car splashes while the other is still well up the hill, the
  camera holds the splash for ~1.6 s. It then *cuts* (behind a quick white fade) to chase the
  remaining car, and cuts side-on again 55 m of track before the lip.
  - A blended swing between the Bay and the hill flew the camera through the houses.
  - The side framing includes any running car within 65 m of the lip, so the car is in frame
    straight after each cut.
  - The first launch keeps the spec's smooth swing to the side view.
- **Far-apart races:** while the leader is followed (gap over 45 m), the trailing car is out of
  frame. Its HUD card still shows its speed and fuel, and the straggler follow-up brings it back
  as soon as the leader has splashed. A picture-in-picture inset was considered and left out.
- **Results:** a slow side-on hold on the splash zone. If nobody launched (both stalled), it stays
  on the stalled cars instead, framed above the results card.
- **Rematch / New players** cut back to the start line behind a short white fade. A blended camera
  move from the Bay to the start line flew through the houses.

## Pacing

"Run-up takes about 8–15 s" holds for sensible builds: a V8 or jet with a Standard or Oversized
tank has a median of ~12 s (see the balance report).

Lawnmower builds and jerry-can builds coast most of the way and take ~15–25 s in calm air (median
~22 s; up to ~29 s into a strong headwind). This is a property of
the track rather than something tuning can fix:

- A car coasting from rest down an 18% grade gains only ~1.7 m/s², and must then cross 70 m of flat
  Embarcadero and pier.
- The all-$0 build must land only 5–25 m out, so weak builds have to arrive slowly.
- A sweep of stronger lawnmowers and smaller jerry cans either broke the all-$0 target or made the
  V8 + jerry-can builds even slower.

The straggler camera keeps these runs watchable.

## Known minor issues (left as is)

- **Glider unfold from the side view.** From the side camera the wing unfold is hard to see: the
  wings go from a thin trailing rod to edge-on. The "GLIDING!" flash, the swoosh and the flatter
  trail mark the moment.
- **First-launch hitch.** The first LAUNCH of a session can stall the first countdown beat for
  ~0.2–0.3 s while the flame and effect shaders compile; later launches are smooth.
- **Very wide names** (e.g. sixteen "W"s) are ellipsized in the name box but shown in full elsewhere.

## Test hooks

`window.__game` exposes everything the prompt lists (`state`, `pick(i)`, `configs`, `wind`,
`results`, `launch()`, `rematch()`, `newPlayers()`, `setSpeed(n)`) plus: `ready`, `keep()`,
`draft` (slot, active player, first picker, money, picks, previous picks), `cars` (live sim
states), `events` (bump/fuelEmpty/launch/splash/dnf log), `sessionBest`, `round`, `names`,
`setName(p, name)`, `sound` (`ready`, `muted` and the output RMS `level` from an analyser on the
master bus, so tests can prove audio plays and that M silences it), `toggleMute()`, `predict()`
(simulateToEnd for the current configs and wind), `computeStats`, `simulateToEnd` and `parts`.

- `launch()` works from the build phase at any time: unfinished picks are completed by keeping last
  round's part when affordable, otherwise the $0 option.
- `?autobuild=1` drafts both cars at random (affordable options only) at the start of every round.
- `?wind=W` (extra) pins the wind to W m/s for every round, for deterministic physics checks.

## Balance tuning

The starting numbers in the prompt's table missed every tuning target when simulated: the all-$0
build flew 39–84 m, the best builds ~290 m with 8–10 s of airtime, the same Go-kart + V8 build won in
every wind, and the Pickup never reached the top 10%. `npm run balance` enumerates all 2,428
affordable builds in three winds. A scripted local search over the catalog found the region below,
which was then hand-checked. The search penalised:

- the pass criteria and the tuning targets;
- distance from the table's numbers;
- any broken tagline ordering (the Go-kart stays the slimmest chassis, Blunt > Wedge > Cone,
  Lawnmower < V8 < Jet in power, jerry can < Standard < Oversized, Tiny rolls easiest but loses most
  at the tracks, and so on);
- glide visibility, a headwind that lengthens any flight, over-long flights, and slow sensible builds.

**A stricter test than the prompt's.** The top-10% criterion can pass while a part is never worth
picking: it slips into the top 10% riding on otherwise-strong builds. An early tune did exactly that:
the Bathtub was never the best chassis for any build, and Glider wings made every V8 build fly
*shorter*. `balance.ts` therefore also checks the design rule itself ("every part must be the best
choice for some build and wind"):

- **Paid options:** with the other six slots fixed, each must be the strictly best pick for its slot
  in at least one build and wind.
- **Free "keep the money" options** (no wing, no booster, blunt nose): each must sit on the
  price/distance Pareto front.

It also fails on:

- any build that flies further into the strongest headwind than in calm air (moderate headwinds
  and tailwinds are swept and reported);
- glider wings that don't visibly glide (flatter water entry and longer airtime on two reference
  go-karts);
- sensible builds taking over 15 s to reach the lip;
- any flight over 6.5 s.

What changed and why (prices are all unchanged):

| Part | Table | Now | Why |
|---|---|---|---|
| Go-kart | CdA 0.45 | CdA 0.85 | Everything was too slippery; still the slimmest chassis |
| Bathtub | 350 kg, CdA 1.1, ClA 0.6 | 250 kg, CdA 1.05, ClA 1.7 | A lifting body's lift must repay its drag; now wins in a headwind |
| Sedan | 1000 kg, CdA 0.7 | 660 kg, CdA 0.9 | Heavy chassis were starved of engine energy per kg |
| Pickup 4x4 | 1600 kg, CdA 1.0 | 1210 kg, CdA 1.05 | As above; 4WD grip ×1.35 unchanged |
| Tiny wheels | μ 0.70, crr 0.010, bump 8% | μ 0.85, crr 0.009, bump 25% | Cable-car tracks are the all-$0 build's main brake |
| Standard wheels | crr 0.015, bump 4% | crr 0.021, bump 7% | Makes Monster wheels worth their weight |
| Monster wheels | 200 kg, crr 0.030, +0.3 CdA | 220 kg, crr 0.024, +0.35 CdA | Heavier and draggier to offset near-zero bump loss |
| Lawnmower | 12 kW | 2.5 kW | 150 kJ on a 260 kg kart outran real builds |
| V8 | 120 kW | 185 kW | Now spins its wheels on light cars unless you buy grip |
| Jet | 250 kW, cap 12 kN, 400 kg | 200 kW, cap 17.5 kN, 350 kg | V8-like power that never spins: wins in a headwind |
| Jerry can | 150 kJ | 120 kJ | A lawnmower sips it for the whole run |
| Standard tank | 450 kJ | 460 kJ | |
| Oversized tank | 1200 kJ, 250 kg | 760 kJ, 230 kg | Keeps the best distances in the 80-180 m band |
| Spoiler | ClA 0.4 | ClA 0.7 | Needed a niche next to the stronger glider |
| Glider wings | ClA 3.0, +0.35 CdA | folded +0.2 CdA; open ClA 13.2, +2.6 CdA, trim 0.65 g | New spring-open model (see "Glider wings" above) |
| Blunt nose | +0.3 CdA | +0.5 CdA | Keeps the free nose a real tradeoff |
| Nitro | 150 kJ | 110 kJ | Distances |
| Kite | ClA 6, cap 3000 N, +0.8 CdA | ClA 6.5, cap 2200 N, +1.1 CdA | Airtime; still the best booster for some slow and fast builds |

The design relationships the taglines describe are all still true:

- slim kart, lifting-body tub, heavy 4WD pickup;
- tiny wheels roll easiest but lose the most at the tracks;
- a V8 that spins bad tyres, a grip-free but heavier jet;
- tanks that must match the engine;
- a cheap-but-draggy nose;
- lift that pays off on light cars.

**How the winds differ.**

- Headwind: a Bathtub with a Jet and Nitro wins.
- Calm air and tailwind: a Go-kart with a V8, Glider wings and Nitro wins.
- Jet, Monster-wheel and Kite builds sit within a few metres.

**Targets.**

- All-$0 build: 5–25 m is checked in calm air. In a ±8 m/s wind it must still reach the lip and land
  3–40 m out; it lands 5.9 m in a headwind and 35.1 m in a tailwind.
- Sensible builds reach the lip in a median of 12 s. Lawnmower and jerry-can builds coast (see
  "Pacing").
- The longest flight in any wind is 5.4 s.

### Final balance report (`npm run balance`)

```
La Voiture balance report
Affordable builds (performance slots, budget $100): 2428
Top 10% = 243 builds per wind

## Top 15, headwind -8 m/s
  #   dist m    $  lip m/s  run s  air s  waste  build
  1    109.8  100     33.3   10.0    3.9     0%  Bathtub · Standard · Jet · Oversized · None · Cone · Nitro
  2    108.6   98     30.3   11.4    4.5     0%  Go-kart · Standard · V8 · Oversized · Glider wings · Wedge · Nitro
  3    107.9   95     35.4    9.6    3.5     0%  Go-kart · Standard · Jet · Oversized · None · Cone · Nitro
  4    105.9   93     32.8   10.0    3.8     0%  Bathtub · Standard · Jet · Oversized · None · Wedge · Nitro
  5    104.6   96     33.9    9.8    3.6     0%  Go-kart · Standard · Jet · Oversized · Spoiler · Wedge · Nitro
  6    104.5   90     31.9    9.6    4.1     0%  Go-kart · Standard · Jet · Oversized · None · Cone · Kite
  7    104.2   88     34.8    9.7    3.5     0%  Go-kart · Standard · Jet · Oversized · None · Wedge · Nitro
  8    103.9   98     30.9    9.7    4.3     0%  Go-kart · Standard · Jet · Oversized · Spoiler · Cone · Kite
  9    103.6   98     29.1   10.0    4.4     0%  Go-kart · Standard · Jet · Oversized · Glider wings · Wedge · None
 10    103.3   95     29.8   10.0    4.5     0%  Bathtub · Standard · Jet · Oversized · None · Cone · Kite
 11    101.6  100     28.8   10.5    4.4     0%  Go-kart · Monster · V8 · Oversized · Glider wings · Cone · None
 12    101.1   95     32.3   10.5    3.7     0%  Bathtub · Monster · V8 · Oversized · None · Cone · Nitro
 13    100.2   83     31.2    9.6    4.1     0%  Go-kart · Standard · Jet · Oversized · None · Wedge · Kite
 14    100.1   98     26.5   10.9    4.8     0%  Bathtub · Monster · V8 · Oversized · Glider wings · Wedge · None
 15     99.8  100     29.0   11.0    4.4     0%  Go-kart · Monster · V8 · Oversized · Glider wings · Blunt · Nitro
DNFs in this wind: 35

## Top 15, calm (0 m/s)
  #   dist m    $  lip m/s  run s  air s  waste  build
  1    134.7   98     33.4   10.9    4.8     0%  Go-kart · Standard · V8 · Oversized · Glider wings · Wedge · Nitro
  2    130.1  100     33.5   10.3    4.7     0%  Go-kart · Monster · V8 · Oversized · Glider wings · Blunt · Nitro
  3    129.3   98     32.4    9.6    4.7     0%  Go-kart · Standard · Jet · Oversized · Glider wings · Wedge · None
  4    127.4  100     32.6   10.1    4.6     0%  Go-kart · Monster · V8 · Oversized · Glider wings · Cone · None
  5    123.4   90     34.5    9.3    4.4     0%  Go-kart · Standard · Jet · Oversized · None · Cone · Kite
  6    123.3  100     36.0    9.7    4.0     0%  Bathtub · Standard · Jet · Oversized · None · Cone · Nitro
  7    123.1   98     33.8    9.4    4.5     0%  Go-kart · Standard · Jet · Oversized · Spoiler · Cone · Kite
  8    122.9   93     32.2   10.1    4.5     0%  Go-kart · Monster · V8 · Oversized · Glider wings · Wedge · None
  9    122.2   95     37.7    9.4    3.7     0%  Go-kart · Standard · Jet · Oversized · None · Cone · Nitro
 10    121.8   95     32.8    9.6    4.6     0%  Bathtub · Standard · Jet · Oversized · None · Cone · Kite
 11    121.6  100     29.9   10.8    5.1     0%  Go-kart · Standard · V8 · Oversized · Glider wings · Cone · Kite
 12    121.0   83     34.1    9.3    4.4     0%  Go-kart · Standard · Jet · Oversized · None · Wedge · Kite
 13    120.8  100     30.2    9.8    5.1     0%  Go-kart · Standard · Jet · Oversized · Glider wings · Blunt · Kite
 14    120.8   93     35.7    9.7    3.9     0%  Bathtub · Standard · Jet · Oversized · None · Wedge · Nitro
 15    120.7   90     31.5   11.2    4.6     0%  Go-kart · Standard · V8 · Oversized · Glider wings · Blunt · Nitro
DNFs in this wind: 0

## Top 15, tailwind +8 m/s
  #   dist m    $  lip m/s  run s  air s  waste  build
  1    144.9   98     36.0   10.5    4.6     0%  Go-kart · Standard · V8 · Oversized · Glider wings · Wedge · Nitro
  2    144.5  100     37.1    9.9    4.5     0%  Go-kart · Monster · V8 · Oversized · Glider wings · Blunt · Nitro
  3    138.6   90     36.6    9.1    4.5     0%  Go-kart · Standard · Jet · Oversized · None · Cone · Kite
  4    137.2  100     33.6    9.4    4.9     0%  Go-kart · Standard · Jet · Oversized · Glider wings · Blunt · Kite
  5    137.1   83     36.4    9.1    4.5     0%  Go-kart · Standard · Jet · Oversized · None · Wedge · Kite
  6    136.8   95     34.0    9.9    4.8     0%  Go-kart · Monster · V8 · Oversized · Glider wings · Blunt · Kite
  7    136.8   98     36.0    9.2    4.6     0%  Go-kart · Standard · Jet · Oversized · Spoiler · Cone · Kite
  8    136.5   85     36.7    9.6    4.5     0%  Go-kart · Monster · V8 · Oversized · None · Cone · Kite
  9    135.6   93     36.2    9.6    4.5     0%  Go-kart · Monster · V8 · Oversized · Spoiler · Cone · Kite
 10    135.6   91     35.9    9.2    4.5     0%  Go-kart · Standard · Jet · Oversized · Spoiler · Wedge · Kite
 11    135.2  100     35.7    9.7    4.3     0%  Go-kart · Monster · V8 · Oversized · Glider wings · Cone · None
 12    134.7   95     39.6    9.2    3.9     0%  Go-kart · Standard · Jet · Oversized · None · Cone · Nitro
 13    134.6  100     36.6    9.4    4.4     0%  Go-kart · Monster · Jet · Oversized · None · Cone · Kite
 14    134.6   78     36.4    9.6    4.4     0%  Go-kart · Monster · V8 · Oversized · None · Wedge · Kite
 15    134.4   95     38.5    9.8    4.0     0%  Bathtub · Monster · V8 · Oversized · None · Cone · Nitro
DNFs in this wind: 0

## Options: best rank and appearances in the top 10% (243 builds)
slot       option         best  (wind)   top@-8   top@0  top@+8
Chassis    Go-kart           1     (0)      108     124     128
Chassis    Bathtub           1    (-8)       97      92      95
Chassis    Sedan            60    (-8)       32      27      20
Chassis    Pickup 4x4      161    (-8)        6       0       0
Wheels     Tiny             77    (-8)       34      21      10
Wheels     Standard          1    (-8)      124     126     128
Wheels     Monster           2     (0)       85      96     105
Engine     Lawnmower        63     (0)       30      25      21
Engine     V8                1     (0)      118     118     122
Engine     Jet               1    (-8)       95     100     100
Fuel tank  Jerry can        63     (0)       17      13      12
Fuel tank  Standard         49     (0)       49      60      63
Fuel tank  Oversized         1    (-8)      177     170     168
Wing       None              1    (-8)      100      96     102
Wing       Spoiler           5    (-8)       72      71      76
Wing       Glider wings      1     (0)       71      76      65
Nose       Blunt             2     (0)       57      76      87
Nose       Wedge             1     (0)       95      86      85
Nose       Cone              1    (-8)       91      81      71
Booster    None              3     (0)       57      59      64
Booster    Nitro             1    (-8)      125     113     108
Booster    Kite              3    (+8)       61      71      71

## Best pick for its slot (other six slots fixed, any wind)
Chassis    Go-kart       1036 contexts
Chassis    Bathtub       210 contexts
Chassis    Sedan         139 contexts
Chassis    Pickup 4x4    566 contexts
Wheels     Tiny          34 contexts
Wheels     Standard      1043 contexts
Wheels     Monster       1365 contexts
Engine     Lawnmower     697 contexts
Engine     V8            736 contexts
Engine     Jet           1095 contexts
Fuel tank  Jerry can     462 contexts
Fuel tank  Standard      339 contexts
Fuel tank  Oversized     1602 contexts
Wing       None          free: on the price/distance Pareto front
Wing       Spoiler       24 contexts
Wing       Glider wings  1916 contexts
Nose       Blunt         free: on the price/distance Pareto front
Nose       Wedge         308 contexts
Nose       Cone          2064 contexts
Booster    None          free: on the price/distance Pareto front
Booster    Nitro         2196 contexts
Booster    Kite          199 contexts

## Wind
Builds that fly further into the strongest headwind (-8 m/s) than in calm air: 0
Builds that fly further into some moderate headwind (-7.5 to -0.5 m/s) than in calm air: 13 (worst: Bathtub · Tiny · Lawnmower · Oversized · Glider wings · Cone · Nitro at -4.5 m/s: +1.74 m)
Builds that fly shorter with a tailwind than in calm air: 10 (worst: Bathtub · Tiny · Lawnmower · Standard · Glider wings · Cone · Nitro: 97.8 m calm, 92.4 m at +8 m/s)

## Glide (calm air): go-kart with glider wings vs the same kart with none
Go-kart · Tiny · Lawnmower · Jerry can · Glider wings · Wedge · Nitro: 95.2 vs 79.8 m, air 4.4 vs 3.1 s, water entry 26° vs 37°
Go-kart · Standard · V8 · Oversized · Glider wings · Cone · None: 113.1 vs 88.7 m, air 4.4 vs 3.2 s, water entry 23° vs 35°

## Run-up pacing (calm air)
V8 or jet with a Standard or Oversized tank (894 builds): median 12.0 s, 90% within 14.9 s
Lawnmower or jerry-can builds (1534 builds, coasting most of the way): median 21.7 s, 90% within 23.9 s

## All-$0 build (Go-kart · Tiny · Lawnmower · Jerry can · None · Blunt · None)
headwind -8 m/s      5.9 m  lip 4.5 m/s, run 26.9 s, air 1.6 s, wasted 44% fuel
calm (0 m/s)         20.8 m  lip 12.1 m/s, run 21.5 s, air 2.0 s, wasted 55% fuel
tailwind +8 m/s      35.1 m  lip 17.2 m/s, run 19.2 s, air 2.3 s, wasted 60% fuel

## Checks
- Distinct #1 builds across winds: 2
- Distinct chassis in each wind's top 5: -8: 2, 0: 1, +8: 1 (union: 2)
- Run-up time, top 10%: 9.0-28.3 s (all finishers: 9.0-28.7 s)
- Flight time, top 10%: 3.0-5.4 s (all finishers: 1.4-5.4 s)
- PASS: every performance option reaches the top 10% in some wind and is the best pick for its slot in some build, the winner changes with wind, the strongest headwind shortens every flight, glider wings visibly glide, sensible builds reach the lip in about 8-15 s, no flight lasts over 6.5 s, the all-$0 build reaches the lip in every wind and splashes 5-25 m out in calm air, best builds fly 80-180 m, no NaNs.
```

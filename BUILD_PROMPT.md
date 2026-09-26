# Build prompt: La Voiture (one-shot, run until playable)

You are building a complete, playable browser game in this repo from start to finish. **Do not stop to ask questions.** Every design decision below has already been made with the team. Where something is unspecified, make a sensible choice, record it in `DECISIONS.md`, and keep going. You are done only when every item in **Definition of done** passes, as verified by Playwright agents. If this prompt conflicts with `Ideation.md` or `SPEC.md`, this prompt wins.

## The game in one paragraph
Two players share **one screen** (a laptop, possibly on a TV). They draft cars turn by turn against a budget. Then both cars roll down a steep **San Francisco street** side by side, hit a kicker ramp at the end of a pier, and fly out over the **Bay**. The furthest splash wins. Then they rematch. There are no phones, no networking and no backend.

## Stack
- Vite + TypeScript (strict) + **Three.js**. Plain DOM overlay for the UI (no React). No backend, no network requests at runtime, and no downloaded assets: everything is procedural (geometry, canvas textures, Web Audio).
- **No physics library.** Write a small deterministic physics module, `src/sim/physics.ts`, with no Three.js or DOM imports, so the game and a Node balance-check script share it exactly.
- Scripts: `npm run dev` (vite --host), `npm run build` (tsc + vite build), `npm run balance` (tsx scripts/balance.ts).

Suggested layout: `src/main.ts` (state machine), `src/types.ts`, `src/parts.ts` (catalog + `computeStats`), `src/track.ts`, `src/sim/physics.ts`, `src/scene/{world,city,carMesh,camera,effects}.ts`, `src/ui/{build,hud}.ts`, `src/audio.ts`, `scripts/balance.ts`.

## Game flow (state machine)
`BUILD → COUNTDOWN (3-2-1-GO) → RACE (run-up) → FLIGHT → RESULTS → (Rematch → BUILD) | (New players → BUILD, reset)`

## Build phase: turn-based draft
- The screen is split. **The P1 panel is on the left and P2 is on the right.** The 3D scene in the middle shows both cars on the start line at the top of the hill, slowly turning on the spot and **updating live** as parts are picked. Hovering an option previews it on the car.
- **Wind forecast** at the top centre, rolled at the start of each round: uniform −8…+8 m/s, shown as "12 km/h HEADWIND ←" or "TAILWIND →".
- Slot order: **Chassis, Wheels, Engine, Fuel tank, Wing, Nose, Booster, Paint, Topper.** For each slot, the first picker chooses, then the other player, then the draft moves to the next slot. **P1 picks first in round 1, and the first picker swaps on every rematch.**
- Both builds are always visible. There's no going back. The active player's panel is highlighted and the other is dimmed. A central banner reads: "Slot 3/9 · ENGINE · Player 2's pick".
- **Budget: $100, a hard cap.** Options you can't afford are disabled. Each slot has a $0 option, so nobody can get stuck. Paint and Topper are free.
- Each panel shows: an editable name (default "Player 1"/"Player 2"), a player colour, the money left, the picks so far, and **stat bars** (Mass, Drag, Power, Fuel, Grip, Lift, Bump resistance). For the active player it also shows the option cards for the current slot: name, price, and a one-line pros/cons tagline.
- Input is mouse clicks, plus keyboard keys 1–4 to pick the Nth option on the active player's turn.
- **On a rematch**, each player's previous pick is pre-highlighted, and Enter or a "Keep" button re-picks it.
- After the last pick, a big **LAUNCH** button starts the countdown.

## Parts catalog (`src/parts.ts`): starting numbers, to be tuned with the balance check
The design rule is **no dominated options**: every part must be the best choice for some build and wind. Every card's tagline must state its tradeoff.

| Slot | Option | $ | Mass kg | Effect |
|---|---|---|---|---|
| Chassis | Go-kart | 0 | 200 | CdA 0.45. Light and slim, but drag hurts light cars more in flight |
| | Bathtub | 5 | 350 | CdA 1.1, ClA 0.6. The flat bottom makes it a lifting body |
| | Sedan | 15 | 1000 | CdA 0.7. Balanced |
| | Pickup 4x4 | 25 | 1600 | CdA 1.0, grip ×1.35 (4WD). Heavy momentum resists drag |
| Wheels | Tiny | 0 | 20 | μ 0.70, rolling resistance 0.010, bump loss 8% |
| | Standard | 10 | 60 | μ 0.95, rolling resistance 0.015, bump loss 4% |
| | Monster | 20 | 200 | μ 1.30, rolling resistance 0.030, bump loss 0.5%, +0.3 CdA |
| Engine | Lawnmower | 0 | 30 | 12 kW, wheel-driven |
| | V8 | 20 | 250 | 120 kW, wheel-driven (spins with bad tyres) |
| | Jet | 35 | 400 | 250 kW of thrust, **ignores grip**, thrust capped at 12 kN |
| Fuel tank | Jerry can | 0 | 10 | 150 kJ |
| | Standard | 10 | 60 | 450 kJ |
| | Oversized | 20 | 250 | 1200 kJ |
| Wing | None | 0 | 0 | — |
| | Spoiler | 8 | 10 | ClA 0.4, +0.1 CdA |
| | Glider wings | 25 | 60 | ClA 3.0, +0.35 CdA. Great on light cars |
| Nose | Blunt | 0 | 0 | +0.3 CdA |
| | Wedge | 8 | 20 | +0.1 CdA |
| | Cone | 15 | 40 | +0.0 CdA |
| Booster | None | 0 | 0 | — |
| | Nitro | 15 | 30 | +150 kJ of kinetic energy instantly at the lip |
| | Kite | 10 | 15 | Opens at the lip. Lift ½ρ·6·v² **capped at 3000 N**, +0.8 CdA in flight. Good for slow builds |
| Paint | 8 bold toy colours | 0 | 0 | cosmetic |
| Topper | None / Top hat / Flag / Rubber duck / Traffic cone | 0 | small | cosmetic (keep as data for future style points) |

`computeStats(config)` returns total mass, CdA, ClA, μ (wheels × chassis multiplier), power, energy, isJet, thrustCap, crr, bumpLoss, nitroJ, kite, and price.

## Track (`src/track.ts`, shared by the physics and the visuals)
x is forward and y is up. The track is a 2D elevation polyline with cumulative arc length `s`:
- A 10 m flat start at the top.
- **3 SF blocks**, each 60 m at a −18% grade, each followed by a 12 m intersection at −3% with **cable-car tracks** across the road (one bump per intersection).
- 30 m of flat Embarcadero, then a 40 m flat pier at deck height y=4, then a **kicker**: 12 m at +25°. The **lip** is about 9 m above the water (y=0).
- Two lanes at z = −3 (P1) and z = +3 (P2). The cars never interact.

## Physics (`src/sim/physics.ts`, fixed dt = 1/120 s, deterministic)
Constants: ρ = 1.225, g = 9.81. `wind` is the horizontal wind speed (+ = tailwind), and airspeed = v − wind.

**Run-up (1D along s):**
- Forces along the track: −m·g·sinθ (gravity), − crr·N (rolling resistance, where N = m·g·cosθ), and − ½ρ·CdA·|v_air|·v_air along the tangent (drag).
- **Engine, only while fuel > 0:** fuel burns at a constant P watts. A wheel-driven engine delivers F = min(P / max(v, 1), μ·N). A jet delivers F = min(P / max(v, 1), thrustCap). Any demanded force beyond the grip limit is wasted (the wheels spin). This gives fuel a burn time of E/P.
- **Bumps:** when crossing an intersection's tracks, the car loses bumpLoss × its kinetic energy.
- If the car stalls (v ≤ 0.3 before the lip), it's a DNF with distance 0.

**At the lip:**
- **The engine shuts off. Unused fuel is wasted** and reported ("WASTED 38% FUEL").
- Nitro adds its energy: v = √(v² + 2E/m).
- The kite opens.
- Switch to 2D flight with velocity = v·(cos25°, sin25°).

**Flight:** gravity, plus drag opposite the airspeed, plus lift ½ρ·ClA·|v_air|² acting perpendicular to the airspeed (rotated towards up). The kite's lift is added separately and capped. **Score = x at the first y ≤ 0, minus the lip's x.** Add a safety cap on simulated time.

The module exposes a per-car sim with `step(dt)`, a state (`phase`, `s`, `pos`, `vel`, `fuelFrac`, `wheelspin`, `distance`, etc.) and events (`bump`, `fuelEmpty`, `launch`, `splash`, `dnf`). It also exports `simulateToEnd(stats, wind)` for the balance check.

**Tuning targets:** the all-$0 build reaches the lip and splashes 5–25 m out. Strong builds reach 80–180 m. Run-up takes about 8–15 s and flight about 2–6 s.

## Balance check (`scripts/balance.ts`): must pass
- Enumerate every build within the $100 budget (performance slots only) for winds −8, 0 and +8.
- Print the top 15 builds for each wind, and for every option, its best rank and how often it appears in the top 10%.
- **Pass criteria:**
  - Every performance option appears in the top 10% of builds for at least one wind.
  - At least 2 different builds are #1 across the three winds, or the top-5 builds have ≥3 different chassis.
  - The all-$0 build reaches the lip.
  - No NaN values.
- **Change the numbers in `parts.ts` and rerun until it passes.** Paste the final report into `DECISIONS.md`.

## Visuals: "premium toy" look (Hot Wheels / Micro Machines), all procedural
- **Renderer:** shadows (PCFSoft), ACES tone mapping, sRGB. Three's `Sky` shader and a PMREM environment from `RoomEnvironment` for reflections. Light **Karl-the-Fog** style `FogExp2`, tuned so the Golden Gate Bridge is still clearly visible.
- **Car mesh:** `buildCarMesh(config)` builds a toy car from rounded boxes (`RoundedBoxGeometry`), cylinders and cones, using `MeshPhysicalMaterial` car paint (clearcoat) in the chosen colour. Every part option should look distinct, e.g.:
  - Wheel sizes
  - Visible jet nozzle vs V8 block vs lawnmower motor
  - Tank size
  - Wings, nose shape, nitro bottles, and a packed or open kite
  - Toppers
  
  Wheels spin with speed.
- **SF street:**
  - A road ribbon along the profile with a canvas asphalt texture and lane markings, and sidewalks.
  - **Pastel Victorian row houses** on both sides that step down with the hill, with bay windows, cornices, windows and doors.
  - Cross streets at the intersections, with visible cable-car tracks across them.
  - A red and cream **cable car** parked on a cross street.
- **Waterfront:**
  - A wooden pier on pilings.
  - The kicker made of plywood with yellow and black construction stripes, plus traffic cones.
  - **Sea lions** lounging on a floating dock.
- **The Bay:**
  - Animated water (a physical material with a procedural canvas normal map, scrolling).
  - **Buoys every 10 m** in both lanes, with number labels every 10 m (canvas sprites) and big labels every 50 m.
  - A **"best distance" flag** buoy for the session record.
- **Background:**
  - The **Golden Gate Bridge** in International Orange: towers, deck, catenary main cables (TubeGeometry) and suspender lines, placed so it's visible in the flight shot.
  - **Alcatraz:** a rock island with buildings and a lighthouse.
- **Effects:**
  - A coloured trail line behind each car in flight.
  - A splash particle burst.
  - After splashing, the car bobs and slowly sinks.
  - A small hop on each bump.

## Camera
- **Build phase:** frames both cars on the start line, with the street and the Bay below in the background.
- **Race:** a chase camera **behind and above** both cars (following their midpoint), smoothed.
- **At the first launch:** a smooth transition to a **side-on view that pans right** to follow the leading car, so the horizontal distance is readable. It keeps both cars and the lip in frame while possible.
- **Results:** holds on the splash zone.

## HUD
- **During the race**, for each car: player name and colour, a **fuel gauge**, speed in km/h, a "WHEELSPIN!" flash, "OUT OF FUEL" at the moment it happens, and "WASTED X% FUEL" at the lip.
- **In flight:** a live distance readout.
- **Results:** winner banner, both distances (and DNFs), and the session best, with **Rematch** and **New players** buttons.

## Sound (procedural Web Audio, starts on the first user click, M key mutes)
- Per-car engine: a lawnmower/V8 sawtooth through a lowpass, with pitch rising with speed, or filtered noise for the jet.
- A thump on each bump.
- A wind whoosh in flight that scales with speed.
- A splash (noise burst with a lowpass sweep).
- Countdown beeps, UI click blips, and a crowd cheer at the results.

## Testability hooks (required for verification)
- **URL params:**
  - `?seed=N` for the wind RNG.
  - `?speed=N` for a sim time multiplier.
  - `?autobuild=1` for both players to pick randomly, affordable options only.
- **`window.__game`:**
  - `state`
  - `pick(optionIndex)`
  - `configs`
  - `wind`
  - `results`
  - `launch()`
  - `rematch()`
  - `newPlayers()`
  - a `setSpeed(n)`.
- Zero console errors or warnings during a full loop.

## Process
1. Scaffold. (`package.json`, `node_modules` and `SPEC.md` may already exist; reuse or overwrite them.)
2. Write `types.ts`, `parts.ts`, `track.ts` and `physics.ts`, then the balance check. **Get `npm run balance` passing before building the visuals.**
3. Scene, car mesh, camera, UI, HUD and sound. Make sure `npm run build` passes.
4. Start `npm run dev` in the background, then **spawn Playwright verification agents in parallel** (the Playwright MCP tools are available; if WebGL fails headless, use a SwiftShader/ANGLE flag or headed mode):
   - **Flow agent:** plays the full loop by clicking the real UI (not only the hooks), with both players drafting all 9 slots. It checks:
     - Options you can't afford are disabled.
     - The turn order alternates.
     - The first picker swaps on a rematch.
     - Previous picks are pre-highlighted.
     - "New players" resets everything.
     - Results show sensible distances.
     - There are zero console errors.
   - **Visual agent:** takes screenshots of the build phase, the chase camera mid-hill, the moment of launch, mid-flight side view, splash and results. It critiques them against the Visuals section: are the houses, cable car, bridge, Alcatraz, sea lions, buoys and labels visible? Is the fog not washing everything out? Is the UI readable at 1280×720 and 1920×1080 with nothing overlapping?
   - **Physics agent:** uses the hooks to run several seeded builds. It checks that:
     - Behaviour matches `simulateToEnd` for the same inputs.
     - A V8 with tiny wheels shows wheelspin.
     - An oversized tank with a lawnmower reports wasted fuel.
     - Glider wings on a go-kart visibly glide.
     - A headwind shortens distances.
5. Fix everything they report, then re-verify. **Repeat until a whole verification pass comes back clean.**
6. Commit to `main` at each milestone: physics+balance, playable loop, visuals, sound, verified.

## Definition of done
- [ ] `npm run build` and `npm run balance` both pass.
- [ ] Two people can do the whole loop with only the mouse: draft 9 slots each → countdown → race → flight → results → rematch → new players, with no console errors.
- [ ] Part choices visibly change both the car and the outcome, and every option passes the balance check.
- [ ] The scene clearly reads as San Francisco (the hill with row houses, the cable car, the pier, the Bay, the bridge, Alcatraz and sea lions) in the premium-toy look.
- [ ] The camera does the chase shot, then pans right to the side view. The buoys make the distance readable.
- [ ] Wind is shown before building and affects the results.
- [ ] Sound works and mutes with M.
- [ ] `DECISIONS.md` lists every choice you made that isn't in this prompt, plus the final balance report.
- [ ] The final Playwright pass is clean and its screenshots are saved in `verification/`.

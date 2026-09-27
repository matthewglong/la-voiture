# La Voiture — Spec

Two players build cars on one shared screen, then both cars launch down a San Francisco hill, off a kicker at the pier, and fly out over the Bay. The furthest splash wins.

## Scope (MVP)
- **Single screen, split UI.** Build phase → launch phase → results → rematch. No networking and no backend.
- **3D** with Three.js, using a "premium toy" look: procedural primitives, clearcoat car paint, shadows, a sky shader, fog, and procedural environment lighting.
- **Scene:** a steep SF street with pastel row houses, intersections with cable-car tracks (bumps), a pier with a kicker ramp, the Bay with buoys every 10 m, the Golden Gate Bridge, Alcatraz, a cable car and sea lions.
- **Sound:** procedural Web Audio for engines, bumps, wind, splash, countdown and cheering.
- **Wind:** a random headwind or tailwind each round, shown *before* building.

## Build phase (the garage)
- **Both players build at the same time**, with no turns, and can change any part until they press READY. Both builds are visible live.
- **A tab per slot** shows the fitted part and its price, so every price is visible before anyone spends.
- **Click a part to fit it.** Swapping refunds the part it replaces. **Click the fitted part again to remove it**, and the slot falls back to its free part.
- A **$100 budget** as a hard cap. Every slot has a $0 option, so nobody can get stuck. Parts you can't afford show how much you're short.
- Slots: Chassis, Wheels, Engine, Fuel tank, Wing, Nose, Booster, then the free cosmetics (Paint, Topper).
- **READY** locks a car in. The race starts as soon as both players are ready.
- **One keyboard, two players:** P1 uses A/D (slot tabs), W/S (parts) and Space (READY). P2 uses the arrow keys and Enter.
- **No dominated options:** every part must be the best choice for *some* build. This is checked by `npm run balance`.

## Physics (`src/sim/physics.ts`, deterministic, shared by the game and the balance check)
- **Energy:** the tank holds E joules, and the engine burns it at P watts, so the fuel lasts E/P seconds. **Fuel only burns before the jump**, so any fuel left at the lip is wasted.
- **Grip limit:** a wheel-driven engine's force is ≤ μ·N. Past that the wheels spin and the fuel is wasted. A jet engine ignores grip.
- **Bumps:** cable-car tracks at intersections take a fraction of the car's kinetic energy, and the fraction depends on wheel size.
- **Aero:** drag ½ρ·CdA·v², lift ½ρ·ClA·v² (the kite's lift is capped), and wind is applied as relative airspeed.
- **Nitro:** a burst of energy at the lip.
- **Score:** the horizontal distance from the lip to the first contact with the water.

## Rematch
- Both cars are kept exactly as they raced, and players tweak them in the garage. Changed slots and last race's parts are marked, and each panel shows the last distance. A new wind is rolled. "New players" resets everything.

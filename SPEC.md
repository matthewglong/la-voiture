# La Voiture — Spec

Two players build cars on one shared screen, then both cars launch down a San Francisco hill, off a kicker at the pier, and fly out over the Bay. The furthest splash wins.

## Scope (MVP)
- **Single screen, split UI.** Build phase → launch phase → results → rematch. No networking and no backend.
- **3D** with Three.js, using a "premium toy" look: procedural primitives, clearcoat car paint, shadows, a sky shader, fog, and procedural environment lighting.
- **Scene:** a steep SF street with pastel row houses, intersections with cable-car tracks (bumps), a pier with a kicker ramp, the Bay with buoys every 10 m, the Golden Gate Bridge, Alcatraz, a cable car and sea lions.
- **Sound:** procedural Web Audio for engines, bumps, wind, splash, countdown and cheering.
- **Wind:** a random headwind or tailwind each round, shown *before* building.

## Build phase
- A **turn-based draft, one slot at a time.** For each slot, the first picker chooses, then the other player. The first picker swaps on each rematch.
- Both builds are visible live, with no going back.
- A **$100 budget** as a hard cap. Every slot has a $0 option, so nobody can get stuck.
- Slots: Chassis, Wheels, Engine, Fuel tank, Wing, Nose, Booster, then the free cosmetics (Paint, Topper).
- **No dominated options:** every part must be the best choice for *some* build. This is checked by `npm run balance`.

## Physics (`src/sim/physics.ts`, deterministic, shared by the game and the balance check)
- **Energy:** the tank holds E joules, and the engine burns it at P watts, so the fuel lasts E/P seconds. **Fuel only burns before the jump**, so any fuel left at the lip is wasted.
- **Grip limit:** a wheel-driven engine's force is ≤ μ·N. Past that the wheels spin and the fuel is wasted. A jet engine ignores grip.
- **Bumps:** cable-car tracks at intersections take a fraction of the car's kinetic energy, and the fraction depends on wheel size.
- **Aero:** drag ½ρ·CdA·v², lift ½ρ·ClA·v² (the kite's lift is capped), and wind is applied as relative airspeed.
- **Nitro:** a burst of energy at the lip.
- **Score:** the horizontal distance from the lip to the first contact with the water.

## Rematch
- Cars are kept, a new wind is rolled, and the first picker swaps. "New players" resets everything.

# La Voiture

A two-player, one-screen party game. Build a toy car against a $100 budget, then race side by side
down a San Francisco hill, off a kicker at the end of a pier, and fly out over the Bay. The furthest
splash wins.

Built with Vite, TypeScript and Three.js. Everything is procedural (geometry, textures, sound), and
there is no backend.

## Run it

```sh
npm install
npm run dev        # http://localhost:5199 (also on your LAN, for a TV)
npm run build      # type-check + production build into dist/
npm run balance    # simulate every affordable build in three winds and check the balance
```

## How to play

1. **Build.** Both players build at the same time, each on their own panel. Every slot (chassis,
   wheels, engine, fuel tank, wing, nose, booster, paint, topper) has a tab showing the part fitted
   there and what it cost, so you can check every price before you spend. Click a part to fit it,
   and click it again to remove it and get your money back. Parts you can't afford show how much
   you're short.
2. **Ready.** Hit **READY** when your car is done. It locks your car in, and pressing it again goes
   back to editing. The race starts as soon as both players are ready.
3. **Fly.** Watch the fuel, the wheelspin and the wind. Unused fuel at the lip is wasted.
4. **Rematch** keeps both cars as they raced, so you can tweak them. Changed slots turn gold, last
   race's parts are tagged, and each panel shows your last distance. A new wind is rolled.
   **New players** resets everything.

Two people can build at once on one keyboard:

| | Slot tabs | Parts | Ready |
|---|---|---|---|
| Player 1 | **A** / **D** | **W** / **S** | **Space** |
| Player 2 | **←** / **→** | **↑** / **↓** | **Enter** |

**Enter** or **Space** on the results screen starts the rematch.

**M** mutes. Sound starts after the first click.

## Test hooks

URL parameters:

- `?seed=N`: wind RNG.
- `?speed=N`: game-time multiplier.
- `?autobuild=1`: random affordable builds for both players.
- `?wind=W`: pin the wind in m/s.

`window.__game` exposes the state machine and simulation. See `DECISIONS.md`.

## Layout

- `src/sim/physics.ts`: deterministic fixed-step physics, shared with `scripts/balance.ts`.
- `src/parts.ts`, `src/track.ts`: the parts catalog and the course.
- `src/garage.ts`: the build rules (budget, fitting and removing parts, READY), shared by the UI,
  the keys and the test hooks.
- `src/scene/`: the renderer, the city, landmarks, the Bay, cars, camera and effects.
- `src/ui/`, `src/audio.ts`: the garage UI, HUD and procedural Web Audio.
- `preview/*.html`: dev-only showrooms for the scene modules.
- `DECISIONS.md`: every choice beyond the brief, plus the balance report.
- `verification/`: screenshots from the final Playwright verification pass.

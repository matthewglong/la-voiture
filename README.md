# La Voiture

A two-player, one-screen party game. Draft a toy car against a $100 budget, then race side by side
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

1. **Draft.** Players alternate one slot at a time: chassis, wheels, engine, fuel tank, wing, nose,
   booster, paint, topper. Click a card, or press **1–9**. Parts you can't afford are greyed out.
2. **Launch.** After the last pick, hit **LAUNCH** (or **Enter**). The cars roll off at GO.
3. **Fly.** Watch the fuel, the wheelspin and the wind. Unused fuel at the lip is wasted.
4. **Rematch** keeps your cars. Last round's picks are highlighted, and **Enter** keeps them. The
   first picker swaps and a new wind is rolled. **New players** resets everything.

**M** mutes. Sound starts after the first click.

## Test hooks

URL parameters:

- `?seed=N`: wind RNG.
- `?speed=N`: game-time multiplier.
- `?autobuild=1`: random affordable drafts.
- `?wind=W`: pin the wind in m/s.

`window.__game` exposes the state machine and simulation. See `DECISIONS.md`.

## Layout

- `src/sim/physics.ts`: deterministic fixed-step physics, shared with `scripts/balance.ts`.
- `src/parts.ts`, `src/track.ts`: the parts catalog and the course.
- `src/scene/`: the renderer, the city, landmarks, the Bay, cars, camera and effects.
- `src/ui/`, `src/audio.ts`: the draft UI, HUD and procedural Web Audio.
- `preview/*.html`: dev-only showrooms for the scene modules.
- `DECISIONS.md`: every choice beyond the brief, plus the balance report.
- `verification/`: screenshots from the final Playwright verification pass.

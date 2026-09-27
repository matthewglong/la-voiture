# La Voiture

A two-player, one-screen party game. Build a toy car against a $100 budget, then **race** your rival
down San Francisco: Russian Hill's steep blocks, a jog up Hyde St past the cable car, the switchbacks
of Lombard St, across the Embarcadero, along the pier and off a kicker into the Bay. The furthest
splash wins.

You drive: the gas, the brakes and the wheel are yours, and so is the fuel. Dodge Waymos and wobbly
tourists, grab item boxes (🦘 Jump, 😤 Determination, 💩 Poo), shove your rival, catch air over the
intersections, and build **HYPE** as you go: it boosts your launch off the kicker. When the cars get
too far apart for one camera, the screen splits smoothly into two, and it heals back into one when
they come together again.

Built with Vite, TypeScript and Three.js. Everything is procedural (geometry, textures, sound), and
there is no backend.

## Run it

```sh
npm install
npm run dev        # http://localhost:5199 (also on your LAN, for a TV)
npm run build      # type-check + production build into dist/
npm run balance    # race every affordable build with the autopilot, in three winds, and check the balance
```

## How to play

1. **Build.** Both players build at the same time, each on their own panel. Every slot (chassis,
   wheels, engine, fuel tank, wing, nose, booster, paint, topper) has a tab showing the part fitted
   there and what it cost. Click a part to fit it, and click it again to remove it and get your
   money back. Parts you can't afford show how much you're short. The stat bars show what matters
   on the road (power, fuel as seconds of full throttle, grip, handling, brakes) and in the air
   (drag, lift).
2. **Ready.** Hit **READY** when your car is done. The race starts as soon as both players are
   ready. Playing alone? Click **🤖 CPU** on Player 2's panel and the computer builds and drives a
   rival.
3. **Race.** Hold the gas as **GO!** lands for a rocket start. Fuel only burns when you press the
   gas, and it has to last: save some for the run along the pier. Brake for the Hyde St corners and
   Lombard's hairpins (or jump them), and catch air where the steep blocks drop away after each
   intersection.
4. **Fly.** The lip is where it counts: your speed there (plus nitro, plus up to +15% for full
   HYPE) sets the jump. Glider wings, kites and lifting bodies do the rest.
5. **Rematch** keeps both cars as they raced so you can tweak them; a new wind, new traffic and new
   item luck make every round different. **New players** resets everything.

### Controls

| | Gas | Brake / reverse | Steer | Item (or honk) | Garage |
|---|---|---|---|---|---|
| Player 1 | **W** | **S** | **A** / **D** | **Space** (or E, Left Shift) | A/D tabs, W/S parts, Space READY |
| Player 2 | **↑** | **↓** | **←** / **→** | **Enter** (or Right Shift, /) | ←/→ tabs, ↑/↓ parts, Enter READY |

Gamepads work too (the first pad is Player 1's, the second Player 2's): right trigger or A for gas,
left trigger or B to brake, the stick or d-pad to steer, X or a shoulder button for the item.

**Enter** or **Space** on the results screen starts the rematch. **M** mutes.

### What's on the road

- **Items** from the rainbow boxes: **🦘 Jump** hops over anything (used on the kicker it's a
  slightly higher launch), **😤 Determination** ploughs through the next thing you hit (a Waymo, a
  tourist, poo, or your rival), **💩 Poo** drops behind you and spins out whoever drives through it.
  The leader tends to get poo, the chaser gets comebacks.
- **Hedge hop:** on Lombard, turn across the inside of a hairpin and jump. Land on the next leg and
  you touch down lined up with the road at full speed: a well-aimed hop is worth half a second or
  more and a big chunk of HYPE.
- **Waymos** creep down the blocks, one sits stalled with a traffic cone on its hood, and more cross
  the Embarcadero (they stop for racers, mostly). **Tourists** cross at the crosswalks and stand in
  the road on Lombard for the perfect photo. The **cable car** shuttles up and down Hyde St.
- **Shoving** your rival is part of it: weight wins a shoving match, a Blunt nose is a bull bar, and
  a Wedge scoops the other car off its wheels.
- **HYPE** comes from drifting, air time, near misses, overtakes, slipstreaming, shoves, landing a
  poo, hedge hops, a rocket start and being first onto the pier; crashes cost some. It becomes a
  launch boost: full HYPE flies you a quarter to a third further.

## Test hooks

URL parameters:

- `?seed=N`: wind, traffic and item RNG.
- `?speed=N`: game-time multiplier.
- `?autobuild=1`: random affordable builds for both players.
- `?wind=W`: pin the wind in m/s.
- `?autodrive=1` (or `p1` / `p2`): the autopilot drives both cars (or one). `?cpu=1`: Player 2 is
  the CPU.
- `?traffic=0`, `?items=0`: an empty course.

`window.__game` exposes the state machine, the race and hooks to script it (`input`, `place`,
`giveItem`, `autodrive`, `setCpu`, ...). See `DECISIONS.md`.

## Layout

- `src/track.ts`: the course (a winding centreline with heights, widths and wall types) and fast
  lookups, shared by the physics, the bots and the visuals.
- `src/sim/`: the deterministic fixed-step race (`race.ts`: driving, collisions, traffic, items,
  HYPE, launch), the flight model (`physics.ts`) and the autopilot (`bot.ts`). No Three.js or DOM.
- `src/parts.ts`: the parts catalog; `src/garage.ts`: the build rules.
- `src/scene/`: the renderer, the SF city and Lombard (`city.ts`, `lombard.ts`), landmarks, the Bay,
  cars, the race's cast (`actors.ts`), effects (`fx.ts`, `effects.ts`), the crowd and the split-screen
  cameras (`views.ts`).
- `src/ui/`, `src/input.ts`, `src/audio.ts`: the garage UI, HUD, keyboard/gamepad input and
  procedural Web Audio.
- `scripts/balance.ts`: the balance check. `DECISIONS.md`: every choice beyond the brief, plus the
  balance report.

# La Voiture

A two-player, one-screen party game. Build a toy car against a $100 budget, then **race** your rival
down San Francisco: Russian Hill's steep blocks, a jog up Hyde St past the cable car, the switchbacks
of Lombard St, across the Embarcadero, along the pier and off a kicker into the Bay. The furthest
splash wins.

You drive: the gas, the brakes and the wheel are yours. Tap the brake while turning to **drift**
through the corners, which fills your **boost** bottle; hold boost for a rocket push, and empty it
on the pier for a bigger jump. Dodge Waymos and wobbly tourists, grab item boxes (hold two, swap
between them: 🦘 Jump, 😤 Determination, 💩 Poo, ⚡ Boost +50%, 🌟 Full boost, 🐦 Seagull), shove your
rival, catch air over the intersections, and build **HYPE** as you go: it boosts your launch off the
kicker. Get there first, too: the kicker drops the moment the first car is off it, so whoever is
behind launches lower. When the cars get too far apart for one camera, the screen splits smoothly into two, and it
heals back into one when they come together again. Playing alone? Race the CPU, or train solo
against a ghost of your best run.

Or pick the other event in the garage: a **race** of three laps round **Twin Peaks**, up the
switchbacks, over the crest, round the summit hairpin under Sutro Tower and down the drop, where the
crests throw the quick cars into the air. First across the line wins. The hills are the point: power
pulls you up the climbs, grip gets you round the hairpin.

Built with Vite, TypeScript and Three.js. Everything is procedural (geometry, textures, sound), and
there is no backend.

## Run it

```sh
npm install
npm run dev        # http://localhost:5199 (also on your LAN, for a TV)
npm run build      # type-check + production build into dist/
npm run balance    # race every affordable build with the autopilot, in three winds, and check the balance
npm run balance:race  # every build, one lap of each race loop: how the parts come out racing (a report)
```

## How to play

0. **Pick the event** at the top of the garage: 🪂 the long jump down Russian Hill, or 🏁 a race
   round Twin Peaks (or `?map=twin-peaks`; on a pad, Player 1's Y). Switching un-readies both cars.
1. **Build.** Both players build at the same time, each on their own panel. Every slot (chassis,
   wheels, engine, boost bottle, wing, nose, booster, paint, topper) has a tab showing the part
   fitted there and what it cost. Click a part to fit it, and click it again to remove it and get
   your money back. Parts you can't afford show how much you're short. The stat bars show what
   matters on the road (power, boost in seconds, grip, handling, brakes) and in the air (drag, lift).
2. **Ready.** Hit **READY** when your car is done. The race starts as soon as both players are
   ready. Playing alone? Click **🤖 CPU** on Player 2's panel and the computer builds and drives a
   rival, or **🏁 Solo** to train on your own (see below).
3. **Race.** Hold the gas as **GO!** lands for a rocket start. The gas is free; the **boost** bottle
   isn't: it starts full, lasts a few seconds, and refills when you drift or pick up a boost item.
   **Tap the brake while turning** to throw the car into a drift: keep turning into it for a tight
   arc, let go and the tyres grip again. Drift the Hyde St corners and Lombard's hairpins (or jump
   them), and catch air where the steep blocks drop away after each intersection.
4. **Fly.** The lip is where it counts: your speed there (plus the boost you burn on the pier, the
   launch rocket, and up to +15% for full HYPE) sets the jump. Boost left in the bottle at the lip is
   wasted. Glider wings, kites and lifting bodies do the rest.
5. **Be first.** The kicker stands at its full 25° for the first car off it, then drops 2° a second
   (down to 12°) while its lamps flash: every second behind the leader costs you about 5% of your
   distance, up to about a third.
6. **Rematch** keeps both cars as they raced so you can tweak them; a new wind, new traffic and new
   item luck make every round different. **New players** resets everything.

### Solo training

Click **🏁 Solo** on Player 2's panel. Player 2's panel becomes the training settings: start from the
top, or straight at the tricky bits (Larkin St for the fast Hyde St corners, Hyde St for Lombard's
switchbacks, Leavenworth for the last blocks and the jump), and switch the ghost, traffic and items
on or off. You race a see-through **ghost** of your best run from that start, with split times at
Hyde, Lombard, Leavenworth and the pier. **R** retries at once (same car, wind and traffic), **Esc**
goes back to the garage, and **👥 Add Player 2** ends solo.

### Controls

Two players share the keyboard:

| | Gas | Brake / reverse (tap while turning: **drift**) | Steer | Boost | Item (or honk) | Swap items | Garage |
|---|---|---|---|---|---|---|---|
| Player 1 | **W** | **S** | **A** / **D** | **Left Shift** | **Left Ctrl** | **Tab** | A/D tabs, W/S parts, Space READY |
| Player 2 | **↑** | **↓** | **←** / **→** | **P** | **;** | **O** | ←/→ tabs, ↑/↓ parts, Enter READY |

Playing alone (against the CPU, or solo) the keyboard is yours: **↑ ↓ ← →** drive (WASD works too),
**Shift** boosts (either one), **Space** uses the item and **Tab** swaps items. The garage keys don't
change.

On a Mac, Control with an arrow key switches desktops or opens Mission Control (System Settings →
Keyboard → Keyboard Shortcuts → Mission Control), so if Player 1 taps Ctrl just as Player 2 presses
an arrow, the window can slide away mid-race: turn those shortcuts off before a two-player session.
On Windows and Linux, Ctrl+W closes the tab, which no page can stop, so Player 1 shouldn't hold Ctrl
while pressing W.

Xbox controllers (or any standard gamepad) work too. The first pad to press a button is Player 1's
and the next Player 2's, and each keeps its seat until it disconnects. A pad buzzes when it takes
its seat. Wrong way round? In the garage, click the left stick on either pad to swap them. Right trigger or A for gas, left trigger or B to brake (tap it in a turn to drift), the stick or
d-pad to steer, either shoulder to boost, X for the item and Y to swap. The pads run the menus too:

- **Garage:** ◀ ▶ (or LB/RB) change tabs, ▲ ▼ pick parts, A readies, B un-readies, a left-stick
  click swaps the pads. Player 1's
  **View** button goes round two players → CPU → solo; in solo, Y picks the start. While the CPU
  drives (or in solo), A on the second pad takes over Player 2's car.
- **Results:** A rematches (solo: retries), Y starts over with new players, and solo B goes to the
  garage.
- **Solo run:** Menu retries, View goes back to the garage.

The hints on screen follow whichever a player last used, keys or pad. Pads rumble on crashes,
landings, shoves, the launch and the splash (Chrome and Edge).

**Enter** or **Space** on the results screen starts the rematch (solo: retries). **M** mutes.

### What's on the road

- **Items** from the rainbow boxes. You hold two: the item key uses the one in the big slot, the swap
  key switches them. **🦘 Jump** hops over anything (used on the kicker it's a slightly higher
  launch), **😤 Determination** ploughs through the next thing you hit (a Waymo, a tourist, poo, a
  seagull, or your rival), **💩 Poo** drops behind you and spins out whoever drives through it,
  **⚡ Boost +50%** refills half your bottle, **🌟 Full boost** (rare) fills it, and **🐦 Seagull**
  chases your rival down the road and flaps on their windscreen. The leader tends to get poo, the
  chaser gets comebacks.
- **Hedge hop:** on Lombard, turn across the inside of a hairpin and jump. Land on the next leg and
  you touch down lined up with the road at full speed: a well-aimed hop is worth half a second or
  more and a big chunk of HYPE.
- **Waymos** creep down the blocks, one sits stalled with a traffic cone on its hood, and more cross
  the Embarcadero (they stop for racers, mostly). **Tourists** cross at the crosswalks and stand in
  the road on Lombard for the perfect photo. The **cable car** shuttles up and down Hyde St.
- **Shoving** your rival is part of it: weight wins a shoving match, a Blunt nose is a bull bar, and
  a Wedge scoops the other car off its wheels.
- **HYPE** comes from drifting, air time, near misses, overtakes, slipstreaming, shoves, landing a
  poo or a seagull, hedge hops, a rocket start and being first onto the pier; crashes cost some. It
  becomes a launch boost: full HYPE flies you a quarter to a third further.
- **Boost** is a rocket bottle: hold the boost key for a push that fades out a little past your
  engine's top speed. Drifting fills it (a full bottle can't take more, so spend some before a run of
  corners), and whatever is left at the lip is wasted.
- **The kicker** is a hinged ramp on hydraulic rams. It holds at 25° until the first car goes off it,
  then comes down 2° a second to 12°, with a klaxon and flashing lamps; the chasing car's card says
  how far down it is, and the results show the angle each car got.

## Test hooks

URL parameters:

- `?seed=N`: wind, traffic and item RNG.
- `?speed=N`: game-time multiplier.
- `?autobuild=1`: random affordable builds for both players.
- `?wind=W`: pin the wind in m/s.
- `?autodrive=1` (or `p1` / `p2`): the autopilot drives both cars (or one). `?cpu=1`: Player 2 is
  the CPU. `?solo=1`: solo training.
- `?traffic=0`, `?items=0`: an empty course.
- `?map=russian-hill` (the long jump) or `?map=twin-peaks` (the race): the event to start on.

`window.__game` exposes the state machine, the race and hooks to script it (`input`, `place`,
`giveItem`, `autodrive`, `setCpu`, `setSolo`, `setTraining`, `retry`, `setMap`, ...). See
`DECISIONS.md`.

## Layout

- `src/track.ts`: courses in general (a centreline with heights, widths and wall types; point to
  point or a loop), the builders the maps use and the fast lookups, shared by the physics, the bots
  and the visuals.
- `src/maps/`: the maps. `index.ts` lists them (`MAPS`): each is a course, its event (`'jump'` or
  `'race'` and the laps), its item boxes, its traffic, and the HUD strip, splits and solo starts.
  `russianHill.ts` is the long jump's course (and its x-only hill); `twinPeaks.ts` the race loop.
- `src/sim/`: the deterministic fixed-step race (`race.ts`: driving and drifting, boost, collisions,
  traffic, items and seagulls, HYPE, launch), the flight model (`physics.ts`) and the autopilot
  (`bot.ts`). No Three.js or DOM.
- `src/parts.ts`: the parts catalog; `src/garage.ts`: the build rules.
- `src/scene/`: the renderer, each map's scenery behind one interface (`maps.ts`: the SF city and
  Lombard in `city.ts` and `lombard.ts` with the landmarks and the Bay; Twin Peaks in
  `twinPeaks.ts`), shared props (`props.ts`), cars, the race's cast (`actors.ts`), effects (`fx.ts`,
  `effects.ts`), the crowd and the split-screen cameras (`views.ts`).
- `src/ui/`, `src/input.ts`, `src/audio.ts`: the garage UI, HUD, keyboard/gamepad input and
  procedural Web Audio.
- `scripts/balance.ts`: the balance check; `scripts/balanceRace.ts`: the race-mode report.
  `DECISIONS.md`: every choice beyond the brief, plus the balance report.
- `preview/*.html`: dev-only showrooms for a scene module with the game's lighting (e.g.
  `/preview/twinpeaks.html?view=climb`).

## Adding a map

1. **The course** (`src/maps/<name>.ts`, no Three.js). A loop is `buildLoop({ id, nodes, sections,
   startS })`: nodes round the loop, each with a height (`round: 0` makes a sharp crest that launches
   fast cars), and sections from a node on with a name, half-width and wall types. Check the layout
   before building scenery: the tightest radius must stay above the half-width, and legs must stay
   well apart. A long-jump course needs a `lip` (see `russianHill.ts`).
2. **The map** in `src/maps/index.ts`: its event and laps, item-box rows, a `populate` for traffic
   and tourists (the sim's `addTraffic`, `addStalled`, `addPed`, ...), the strip's landmarks, splits
   and solo starts. Add it to `MAPS`: the garage picker, the CPU and `npm run balance:race` pick it
   up.
3. **The scenery** (`src/scene/<name>.ts`): a `MapScene` (a group, the start gantry named
   `startGantry` so the camera can see through it, and `update`), registered in `src/scene/maps.ts`.
   The road, walls and ground follow the course's points; `scene/props.ts` has the shared props.
4. Check it: `npm run balance:race` (every build gets round), and the autopilot racing it in the
   browser (`?map=<id>&autodrive=1`, then READY on both panels).

# La Voiture

A two-player, one-screen party game. Build a toy car against a $100 budget, then **race** your rival
down San Francisco: Russian Hill's steep blocks, a jog up Hyde St past the cable car, the switchbacks
of Lombard St, across the Embarcadero, along the pier and off a kicker into the Bay. The furthest
splash wins.

You drive: the gas, the brakes and the wheel are yours. Tap the brake while turning to **drift**
through the corners, which fills your **boost** bottle; hold boost for a rocket push, and empty it
on the pier for a bigger jump. Dodge Waymos and wobbly tourists, grab item boxes (hold two, swap
between them: 🦘 Jump, 😤 Determination, 💩 Poo, ⚡ Boost +50%, 🌟 Full boost, 🐦 Seagull, 🦀 Crab,
🪙 IPO coin), shove your
rival, catch air over the intersections, and build **HYPE** as you go: it boosts your launch off the
kicker. Get there first, too: the kicker drops the moment the first car is off it, so whoever is
behind launches lower. The countdown shows both cars on one screen; at GO it splits down the middle, Player 1 on the
left and Player 2 on the right, until the results. Playing alone? Race the CPU, or train solo
against a ghost of your best run.

Or race the same run: the **Russian Hill sprint** is the same streets, traffic and kicker, but the
first car off the kicker wins (and the kicker never drops). Or a **race** of three laps round **Twin Peaks**, up the
switchbacks, over the crest, round the summit hairpin under Sutro Tower and down the drop, where the
crests throw the quick cars into the air. First across the line wins. The hills are the point: power
pulls you up the climbs, grip gets you round the hairpin.

Or three laps of **Old Stomping Grounds**, the old neighbourhood: from the clock stuck at 4:20 on
Haight & Ashbury, along the Panhandle, through Alamo Square (round the dog park, over the summit,
through the tourists photographing the Painted Ladies and off the steps at the northeast corner),
past the Painted Ladies themselves, down Hayes through Hayes Valley's shops and Patricia's Green,
over the Mint's hill to Duboce Ave and the N Judah, through Duboce Park, up the Duboce wall and over
Buena Vista's summit, down its switchbacks (hop the stone walls if you dare) and back to Haight.
Alamo Square and Duboce Park are open: drive anywhere in them, but the grass is slow, the long grass
a crawl (unless you're boosting) and the trees and benches solid, so a cut pays only if you jump it or
boost through it; the dogs chase you.

Or three laps of **Castro, Noe & Mission**: from the start in front of the Castro Theatre, under the
rainbow flag at Harvey Milk Plaza, down Castro St through the rainbow crosswalks at 18th, up the hill
to the crest at 22nd (it throws you) and down to 24th; along 24th through Noe Valley's shops, where
strollers cross at every corner; over the crest at Dolores and down into the Mission; up Mission St
past El Farolito, the BART plaza and the mariachis, lowriders cruising low and slow; along 18th past
the Women's Building, Tartine and Bi-Rite; down Dolores St under its palms and into Dolores Park by
Mexico's Liberty Bell, up the hill (drive anywhere: it's open ground, the dogs chase you) to the top;
down Church St with the J Church; and a sharp left up Market St to the line.

Built with Vite, TypeScript and Three.js. Everything is procedural (geometry, textures, sound), and
there is no backend.

## Run it

```sh
npm install
npm run dev        # http://localhost:5199 (also on your LAN, for a TV)
npm run build      # type-check + production build into dist/
npm run balance    # race every affordable build with the autopilot, in three winds, and check the balance
npm run balance:race  # every build on each race map (a lap of a loop, or the whole sprint): a report
npm run smoke      # CPU vs CPU on every map and mode, plus test courses: no NaNs, results follow the rules
npm run check      # type-check, smoke and balance in one go: run it after any physics or map change
```

## How to play

0. **Pick the event** at the top of the garage: 🪂 the long jump down Russian Hill, 🏁 the sprint
   down Russian Hill (first off the kicker wins), 🏁 a race round Twin Peaks, 🏁 three laps of
   Old Stomping Grounds, or 🏁 three laps of Castro, Noe & Mission (or `?map=russian-hill-race` /
   `?map=twin-peaks` / `?map=old-stomping-grounds` / `?map=castro-noe-mission`; on a pad, Player 1's
   Y). Switching un-readies both cars.
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
  seagull, a crab, or your rival), **💩 Poo** drops behind you, spins out whoever drives through it and
  splatters their screen for 5 seconds,
  **⚡ Boost +50%** refills half your bottle, **🌟 Full boost** (rare) fills it, and **🐦 Seagull**
  swoops on the leader (or whoever's second, if that's you), carries them up into the air and drops
  them. **🦀 Crab** (a green shell) scuttles straight down the road, bouncing off the kerbs, and
  spins out the first car it meets (yours too, if it comes back round); hold brake to throw it
  backwards. **🪙 IPO coin** (only when you're well behind) carries you down the road for 4.5 s at
  122 km/h, straight through traffic, tourists and your rival. The leader tends to get poo, the
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
- `?map=russian-hill` (the long jump), `?map=russian-hill-race` (the sprint), `?map=twin-peaks`,
  `?map=old-stomping-grounds` or `?map=castro-noe-mission` (the lap races): the event to start on.

`window.__game` exposes the state machine, the race and hooks to script it (`input`, `place`,
`giveItem`, `autodrive`, `setCpu`, `setSolo`, `setTraining`, `retry`, `setMap`, ...). See
`DECISIONS.md`.

## Layout

- `src/modes.ts`: the modes (the long jump, the race): what a run is scored on, how it's shown, the
  laps and time limit, whether HYPE pays and the kicker drops. Everything that differs by mode reads
  it from here.
- `src/track.ts`: courses in general (a centreline with heights, widths and wall types; point to
  point or a loop; a lip or a finish line), the two builders the maps use (pieces: straights and
  arcs end to end; a spline through nodes, looped or not, optionally ending in a kicker) and the
  fast lookups, shared by the physics, the bots and the visuals.
- `src/maps/`: the maps. A map is an **event** (a mode, laps) on a **venue** (a course, its item
  boxes, its traffic, the HUD strip, splits, solo starts and tips). `index.ts` defines the events
  (`MAPS`); `russianHill.ts`, `twinPeaks.ts`, `oldStompingGrounds.ts` and `castroNoeMission.ts` each
  define a course and its venue (`data/` holds what was surveyed for them: Alamo Square, Dolores
  Park, the Castro's, Noe Valley's and the Mission's streets and landmarks). Russian Hill hosts two
  events that share everything.
- `src/sim/`: the deterministic fixed-step race (`race.ts`: driving and drifting, boost, collisions,
  traffic, cable cars, items and seagulls, HYPE, the launch, laps and finish lines), the handling and
  flight model (`physics.ts`, which the CPU plans with too) and the autopilot (`bot.ts`). No
  Three.js or DOM. One sim runs every map and every mode.
- `src/parts.ts`: the parts catalog; `src/garage.ts`: the build rules.
- `src/scene/`: the renderer. `maps.ts` composes each venue's own scenery (the SF city, Lombard and
  the landmarks in `city.ts`, `lombard.ts`, `landmarks.ts`; Twin Peaks in `twinPeaks.ts`; Old
  Stomping Grounds in `osg/`, a module per neighbourhood; Castro, Noe & Mission in `cnm/`, one per
  neighbourhood over `osg/`'s shared parts: the context, streets, race furniture, lawns, paving and
  the city and skyline beyond) with what
  every course gets from its shape: the start line, grid and gantries (`trackside.ts`), and for a
  course with a lip the kicker (`kicker.ts`) and the water and buoys (`bay.ts`). Shared props and
  textures (`props.ts`: tyre walls, barriers, the cable car...), cars, the race's cast
  (`actors.ts`), effects (`fx.ts`, `effects.ts`), the crowd and the split-screen cameras
  (`views.ts`).
- `src/ui/`, `src/input.ts`, `src/audio.ts`: the garage UI, HUD, keyboard/gamepad input and
  procedural Web Audio.
- `scripts/balance.ts`: the long jump's balance check; `scripts/balanceRace.ts`: the race report;
  `scripts/smoke.ts`: every map and mode, end to end. `DECISIONS.md`: every choice beyond the brief,
  plus the balance report.
- `preview/*.html`: dev-only showrooms for a map's scenery with the game's lighting (e.g.
  `/preview/twinpeaks.html?view=climb`, `/preview/city.html?view=kickerTop&map=russian-hill-race`,
  `/preview/stomping.html?view=ladies`, `/preview/cnm.html?view=crosswalks`; add `&stats=1` for draw
  calls, triangles and build time).

## Adding a map

A map is an event on a venue. A new event on an existing venue (say, a long jump somewhere that
already has a kicker, or a race on Russian Hill with a different tip) is one `defineMap(...)` call in
`src/maps/index.ts`. A new venue is three steps:

1. **The course and the venue** (`src/maps/<name>.ts`, no Three.js). Draw the course with
   `buildSpline({ id, nodes, sections, startS })`: nodes with a height each (`round: 0` makes a
   sharp crest that launches fast cars) and sections from a node on with a name, half-width and wall
   types. It's a loop by default; `loop: false` runs from the first node to the last, ending at a
   finish line (`runoff` metres before the end) or, with `kicker: {...}`, in a kicker the builder
   ramps up for you. (Or lay it from straights and arcs with `layPieces`, as Russian Hill does; or
   build a loop from **chunks** with `buildChunkLoop`, as Old Stomping Grounds does: each stretch
   drawn in its own frame with a `Pen` (straights, arcs, surveyed points) and laid end to end, the
   last one flexing to close the loop, so a stretch can be added, removed or resized by editing one
   list.) A section can have a paved band narrower than its walls (`pave`) with a `verge` either
   side (`'grass'`: half speed, slidey; `SURFACES` in `sim/physics.ts`). `defineMap` checks the
   course against the rules every map shares (`courseProblems` in `track.ts`): no climb steeper than
   `MAX_CLIMB` (25%), no bend tighter than the road's half-width, no legs running through each
   other. Then export a `Venue`: the
   course, item-box rows, a `populate` for traffic, tourists, dogs and trams (the sim's `addTraffic`,
   `addStalled`, `addCrossing`, `addCable` (a cable car or a `'streetcar'`), `addPed`, `addDog`,
   `addCone`), the strip's landmarks, splits,
   solo starts and tips. Walled-in blocks like Lombard's are `course.gardens`.
2. **The events** in `src/maps/index.ts`: `defineMap(VENUE, { id, mode, laps, blurb })` for each,
   added to `MAPS`. It checks the course can host the mode (a long jump needs a lip). The garage
   picker, the CPU, the HUD, the results, `npm run smoke` and `npm run balance:race` pick it up.
3. **The scenery** (`src/scene/<name>.ts`): a `VenueScene` (a group, and `update`) with only what's
   the venue's own (ground, road surface, walls, houses, landmarks), registered under the venue's id
   in `src/scene/maps.ts`. The start line, grid, gantries, the kicker and the water come from the
   course automatically; `scene/props.ts` has the shared props (tyre walls, barriers, trees,
   cypresses, benches, park lamps, street-name signs...), `scene/victorian.ts` the row houses,
   `scene/terrain.ts` ground that follows a course. A bigger venue can split its scenery by
   neighbourhood, as `scene/osg/` does (a shared context of per-material builders, the ground and a
   record of what's built where, so nothing lands on anything else).
4. Check it: `npm run check` (type-check, every map and mode end to end, the long jump's balance),
   `npm run balance:race`, and the autopilot racing it in the browser (`?map=<id>&autodrive=1`,
   then READY on both panels).

Physics lives in one place: `src/sim/physics.ts` (the handling and flight formulas) and
`src/sim/race.ts` (the sim that uses them). A change there reaches every map, every mode and the CPU
(which plans with the same formulas); `npm run check` then tells you whether anything broke and
whether the long jump is still balanced.

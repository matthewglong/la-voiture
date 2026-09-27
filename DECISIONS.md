# La Voiture — decisions log

Choices made while building that `BUILD_PROMPT.md` did not pin down, plus the final balance report.
Where this file and the prompt disagree, the prompt's intent was followed and the reason is given here.

The game has had three shapes: the prompt's turn-based draft and hands-off run-up; the garage (both
players building at once, see "Garage"); and now **the race**, where players drive the cars down a
much longer course with items, traffic, collisions and a split screen. "The race" below records
every decision behind that change; the older sections that still hold are kept after it.

## The race

### Why, and how it's scored

The request: steering, throttle and brakes instead of automatic fuel use; items (a jump,
"determination" to power through the next obstacle, and poo); Waymos and pedestrians that slow or
stop you; knocking into the other player; car parts that matter for steering and weight; a longer,
more dynamic course with Lombard St half way; and a split screen that breaks apart and heals.

The score is still the jump: the horizontal distance from the lip to the splash. That created a
problem: the launch speed only depends on the last couple of hundred metres, so how you raced the
first half would have been pointless. Two things tie the whole race to the jump:

- **HYPE (0-100)** is earned by racing with flair and turned into launch speed at the lip, up to
  **+15%** at full HYPE: a quarter to a third further (+12-16% distance at 50). Sources: drifting
  (3/s), air time (6/s), slipstream (up to 1.5/s), leading (0.3/s), near misses (+4), overtakes (+6),
  shoves (+4, and −3 for the victim), landing a poo on the rival (+8), powering through something
  with Determination (+6), a hedge hop on Lombard (+12), a rocket start (+8), first onto the pier
  (+10). Crashes cost: a Waymo
  (−12, or −5 for a glancing hit), a tourist (−8), a poo spin (−10), a hard wall (−3), a rescue
  (−5). Tuned so a typical race ends between about 30 and 85 and 100 is rare. It's the original
  ideation's "style points", made to matter.
- **Fuel** only burns when you press the gas, so what you spend on the way down is not there for the
  run along the pier (see "Fuel").

The winner is still the furthest splash; the results also show each player's awards (first to the
lip, rocket start, hedge hopper, poo sniper, bully, drift king, Waymo magnet, ...) and a running score of
rounds won.

### The course (`src/track.ts`)

- A winding centreline in the horizontal plane, built from straights and arcs, sampled every 0.25 m,
  with a road height, a corridor half-width and a wall type on each edge. Every consumer (physics,
  bots, city, cameras) reads the same course. It has exactly the old waterfront: the Embarcadero
  starts at the same x, so the pier, the kicker, the lip, the Bay, the buoys and the landmarks are
  untouched.
- **Route** (614 m): a 40 m flat start on Greenwich St, two steep blocks (−15%, −17%) with the Larkin
  St intersection between them, a right turn up **Hyde St** (52 m, flat: it runs along the hill's
  contour), a left turn into **Lombard St's crooked block**, then Leavenworth, two more steep blocks
  (−18%, −16%) with Mason St between them, across the Embarcadero, along the pier and up the kicker.
  Street names are borrowed for flavour, not geography.
- The course follows grid streets, so the two Hyde St corners turn inside their intersection squares
  (centreline radius 7 m = the road half-width). The drivable area is then exactly the union of
  ordinary street rectangles, which lets the city be a plain SF grid. Tyre walls line the outside of
  each corner.
- **Lombard:** four 120° hairpins (radius 7 m) joined by 14 m legs at ±60°, on a 9.6 m wide brick
  road, descending 13 m over 121 m of road (10.7%). The switchbacks swing ±14.4 m across a 31 m
  garden band. Lombard's hairpins take 11-13 s. (Five hairpins and a 9.2 m road took 17-30 s, too
  long for a third of the race.)
- **Heights:** the city sits on a hill that only varies along x (the old model), built backwards
  from the Embarcadero at deck height. Streets follow it, so cross streets are flat and x-streets
  slope. Lombard's road descends evenly along its winding length instead, and its gardens are a
  heightfield blended between the legs. The city's land slab is cut out under the block (following
  the hill's average slope, it poked up through the bricks as pale green wedges), and the beds are
  lawn right up to the hedges (a soil border on a square grid stepped along the diagonal hedges like
  a staircase).
- **Crests:** each intersection is almost flat (−2%) and the next block drops at −15 to −18%. The
  sharp grade change launches fast cars into the air: the "Bullitt jumps".
- **Edges:** kerbs (behind race barriers), tyre walls on the corners, rails on the pier, invisible
  walls across the Embarcadero lanes (the Waymos cross there), and **hedges** on Lombard wherever the
  ground beyond the edge is garden. Hedges are the only walls low enough (0.9 m) to jump.
- The start line and grid sit 33 m from the course's back wall, behind the garage camera, so the
  barricade there never blocks the view of the cars.
- Cable-car tracks (the energy-losing bumps) cross the course at Larkin, Leavenworth and Mason. The
  final stretch has two, as the old run-up had three, so tiny wheels still pay for being light.

### Driving model (`src/sim/race.ts`)

- The fixed 1/120 s step and seeded RNG are kept: a race is deterministic given its inputs, so the
  same seed with the autopilot replays identically. The old bit-exact agreement between Node and the
  browser is dropped: steering needs sin/cos, whose last bits differ between JS engines, and a race
  with collisions amplifies that. The balance check runs in Node; `predict()` runs the same autopilot
  in the browser.
- **Motion** is in the horizontal plane with the height taken from the road under the car. On a slope
  gravity accelerates the car at g·grade/(1+grade²) along the road's fall line, which is exact for a
  plane. Drag uses the airspeed against the wind (horizontal, along x); rolling resistance and brakes
  slow the rolling speed without ever reversing it.
- **Tyres:** each step the velocity is turned towards the nose as far as the lateral grip allows. Within
  grip the car rolls (no speed lost); beyond it the tyres slide and friction opposing the sideways
  slip scrubs speed. That is a real drift: flick into a hairpin too fast and the car slides wide and
  sheds speed. Braking hard or spinning the wheels leaves less grip for turning.
- **Steering:** the input sets a target yaw rate, the smallest of v / turning radius (the chassis), the
  grip limit × 1.4 (a touch of oversteer, so full lock at speed drifts), and 3.3 rad/s. The nose
  follows it at the chassis' response rate, slowed by weight (mass^0.2). With no steering input above
  5 m/s, the nose eases along the road at 0.35 rad/s: keys can only give full lock or none. Keys
  ramp the wheel at 8 lock/s.
- **Weight's new meaning:** tyres lose a little grip under load (450/m)^0.1, so heavy cars corner and
  brake a little worse; brakes have a force limit (bigger on bigger wheels), so heavy cars stop
  later; the nose answers more slowly; the Jump item is a fixed spring, so heavy cars jump lower
  (about 2.8 m for a kart, 1.8 m for a loaded pickup: the floor is set so that anything can clear a
  hedge and the hop reads on screen); and in any collision mass decides who moves.
- **Top speed and gearing:** a wheel-driven engine revs out near its top speed (full push up to 60%,
  fading to none at 100%): the lawnmower at 17 m/s, the V8 at 32 m/s, the jet at 33 m/s. Wheels are
  the gearing (tiny ×0.82, standard ×1, monster ×1.18; the pickup's drivetrain ×1.1), so wheels now
  trade top speed against weight, grip and drag. Gravity can still take a car past its top speed down
  a hill. Without this, a player flooring it down the last two blocks launched at up to 50 m/s
  and flew 280 m.
- **Wind** shifts the top speed by 0.3 × the wind (a headwind loads the engine). With speeds capped,
  launches had become wind-proof while a headwind still adds lift, so some slow gliders flew further
  into a headwind; now the strongest headwind shortens every build, as the brief requires.
- **Fuel** burns at the engine's power while the gas is held, scaled by how much it can still push
  (an engine on its rev limiter burns 8%). Good tyres waste little of the power they can't put down
  (standard 30%, monster 15%); tiny wheels spin all of it away ("bad tyres just spin"). A jet ignores
  grip. With the tank empty a car can still limp on 5 kW. At the lip the engine shuts off and what's
  left is wasted, as before.
- **Crests and landings:** a grounded car leaves the road when the road's vertical speed drops more
  than 1.2 m/s below what gravity could follow in one step; tiny hops are ignored. In practice cars
  faster than about 9 m/s take off at the intersections (even the all-$0 build gets a small hop). In
  the air it keeps its horizontal speed and has a little air steering; the jet keeps pushing. Hard
  landings cost up to 12% speed and bounce a little.
- **Lombard's flower beds:** a car that comes down beyond a hedge doesn't sink into the hydrangeas: it
  skids across the top of them towards the nearest road (maybe the next leg) and drops onto it. All
  of the block off the road counts as garden, the islands inside the hairpins included. The block
  itself is walled in (its retaining walls and stairs along the sides, the houses at the ends, open
  only where the road comes in and goes out), so a sideways hop can't carry a car out over the city.
  Before that, a car that drifted far over a bed could have its tracked road point slide onto a
  kerbed stretch and be snapped back up to 18 m in one step.
- **Walls** push the car out along the road's normal, bounce it (restitution 0.18), scrape speed along
  the wall, and swing the nose a little along it. The push-out is at most 0.25 m a step, so a car that
  comes down half on a hedge slides off it over a frame or two instead of jumping.
- **Kindness:** a car on the gas that makes less than 2.5 m of progress for 6 s is put back on the
  road a little ahead, on a spot clear of Waymos, tourists and the cable car (−5 HYPE, "BACK ON
  TRACK"); sitting still or reversing never triggers it. A car driving the wrong way for 5 s (the
  HUD says WRONG WAY! after 1.2 s), or facing the wrong way for 8 s, is turned round the same way.
  A car too slow to climb the kicker (the last 12 m before it) is shoved over the lip by the pier crew
  after 2.5 s instead of ending the round on the ramp. Reverse is free (no fuel).
- **Rocket start:** throttle held from less than 0.6 s before GO, or pressed within 0.15 s after it,
  gives a 7 m/s push and +8 HYPE; held for more than 1.4 s bogs the engine for 0.7 s.
- **The end:** when the first car splashes, the other has 25 s to reach the lip (a countdown shows in
  its card after 5 s); a race is capped at 150 s. A car that misses either is DNF.

### Collisions

- Cars, Waymos and the cable car are chains of circles along their length (enough circles that a
  pickup has no waist). Contacts are resolved with a proper impulse including rotation, so an
  off-centre hit spins a car. Restitution 0.35 between cars.
- **The nose:** a car whose nose hits the other is the rammer. A **Blunt** nose is a bull bar (the
  victim takes 1.5× the impulse); a **Wedge** scoops the victim off its wheels (a hop and a moment of
  no control); a **Cone** is just slippery. The free Blunt nose now earns its drag.
- **Waymos** weigh 2,300 kg and the cable car is immovable: hitting either costs a lot of speed and a
  moment of control. A knocked Waymo stops for two seconds with its hazards on, drifts back to its
  path and plays a polite chime.
- **Tourists** are wobbly toy figures: hitting one topples it (it bobs back up after 2.6 s) and costs
  45% of your speed and a little spin. With Determination they dive out of the way instead, up to the
  road's edge, and carry on from where they land.
- **Poo** spins a car round a full turn over about a second (less on grippy wheels) and halves its
  speed; its owner gets HYPE. Loose traffic cones fly off and cost 3%.

### Items

- Rainbow boxes in rows (Greenwich St, Hyde St, Lombard, the block after Leavenworth, the start of
  the pier). Driving through one starts a 0.9 s roulette; you hold one item at a time; a box pops
  back after 3 s.
- **Odds lean on the race order:** the leader draws Poo 55%, Jump 35%, Determination 10%; within
  30 m it's even; further behind, Determination 50%, Jump 35%, Poo 15%.
- **Jump:** a vertical kick (heavier cars jump lower). It clears tourists, poo, cones and, with a
  light car, even Waymos.
- **Hedge hop:** turn across the inside of a Lombard hairpin, jump, and come down on the next leg.
  Any flight that leaves the road and rejoins it further round than the flight alone explains is a
  shortcut ("HEDGE HOP! +n m", +12 HYPE, once per jump). The car then touches down lined up with the
  road, keeping 96% of its speed: without that arcade kindness it landed pointing across the next leg
  and bounced off the far hedge, and even a perfect hop lost time to simply driving the hairpin. Now
  a well-aimed hop at 12 m/s saves 0.4-0.8 s in a kart (up to 1 s in a pickup, which brakes harder
  for the hairpin), plus the HYPE. The CPU doesn't try it: hopping at its braked hairpin speed it
  lost 0.3-0.8 s every time.
- **Jump on the kicker** puts half its spring into the launch: +7-12% distance. At full strength it
  was worth +25-50%, more than the gap between most builds, from one lucky box.
- **Determination** lasts 12 s or one hit: plough through a Waymo (it's shoved aside and spun, and
  you pass through it for a moment instead of snagging on it again), a tourist, poo, or your rival
  (2.2× the shove and a moment of no control for them). Two Determined cars meeting cancel out.
- **Poo** is dropped just behind the car and stays for the rest of the race. The item key with no
  item honks; every chassis has its own horn.

### Traffic and tourists

- Placed from the round's seed: two Waymos creeping down the first blocks and one down the last
  ones (they pull over and park with their hazards on at the end of their stretch, the first ones
  16 m short of the Hyde St corner, where the chase camera swings wide), one stalled mid-block with a
  traffic cone on its hood and loose cones behind it, and three each way crossing the Embarcadero.
  The stalled one faces uphill, so its hood and the cone face the racers coming down (facing
  downhill, the lidar hid the cone from every chase camera). Waymos brake for anything just ahead, and the Embarcadero ones stop short of the
  crossing when a racer is coming (but not once they're committed), so the crossing is a sight to
  steer round rather than a lottery.
- Tourists cross at most of the crosswalks (walking across and back, pausing at the kerb), and four
  stand in the road on Lombard taking photos.
- The Powell-Hyde cable car shuttles up and down the middle of Hyde St (stopping for anything on the
  rails ahead and ringing its bell). Moving along the line it kept arriving in the corners just as
  the cars did.

### The autopilot (`src/sim/bot.ts`)

- A **racing line** solved once per course: the minimum-curvature path within the kerbs (projected
  gradient descent on the summed squared curvature, on a 2 m resampling). It takes Lombard's hairpins
  at about a 6.5 m radius and the Hyde corners at 13 m.
- A **speed plan** per car from its grip (with downforce), turning radius and brakes, braking back
  from every corner.
- Pure-pursuit steering, dodging whatever is ahead near its line, items used sensibly, fuel saved for
  the run to the kicker. It drives the CPU opponent (a little less than full speed, and leaning on
  you when alongside), `?autodrive`, and the balance check (with dodging and items off).
- **Turning round:** facing backwards (knocked round, or landed that way), it makes a three-point
  turn: forward on full lock until its nose is about to meet an edge, back with the wheel the other
  way until its tail is, and so on. The first swing takes the nose away from the nearer wall (the
  short way round can be straight into it), re-aimed once if it has drifted across. Pinned against
  something, it reverses with the wheel held the other way. Placed backwards at a standstill near the
  start fence, every test build now gets going (a long pickup used to dither there for good), and no
  random landing on Lombard leaves it stuck.

### Split screen and cameras (`src/scene/views.ts`)

- Three orbit rigs: one per player and a shared one. Chase rigs sit behind their car and look **down
  the course**, not along the car's nose, averaging the course direction ahead (and over 60 m on
  Lombard, so the hairpins and spin-outs don't whip the view round). On Lombard the camera rises to
  42° and backs off.
- The shared rig sits behind the trailing car and looks between the cars, zooming out and tilting
  down as they string out.
- **Splitting:** when the shared rig can't frame both cars (it would need to be more than 30 m back,
  or either car's projection nears the screen edge) for 0.3 s, the screen splits: Player 1 left,
  Player 2 right, matching the HUD cards, the garage panels and the keyboard. The shared chase camera
  already sits behind the trailing car, so **that player's view carries on**: the divider slides in
  from the other side over 0.5 s, cropping it (an off-centre projection with `setViewOffset`, so
  nothing on it moves), while it eases into that player's own camera. **The leader's view slides in
  attached to the divider**, already their own camera.
- **Healing:** when both cars would fit again (with some margin) for 0.6 s, the same move runs
  backwards: the leader's half slides out to its side and the trailing player's half widens back into
  the shared view. (If only one car is still on the road, that car's view is the one that carries
  on.)
- The first version eased both halves at once, from their halves of the shared view to the players'
  cameras. It was seamless at the two ends, but in between two overlapping blends of the same scene
  sat side by side: with the cars running one behind the other down the middle, both halves showed
  both cars, twice, at slightly different places.
- A Voronoi split (a divider at any angle) was considered: it suits a top-down camera, but with
  forward-looking chase cameras each player's half ends up on the wrong side for seeing ahead.
- **Flight:** each player's rig swings to the side-on flight view when their car launches; if the
  other car is still racing, the screen stays split (flight on one side, the race on the other). Once
  both are in the air or within 25 m of the lip, the shared rig frames them together and the screen
  heals. (At 60 m the shared side view took over while a car was still racing along the pier, as a
  speck.)
- **See-through traffic:** just before each view is drawn, any Waymo (or the cable car) that the
  camera is within 1.5 m of, or that stands between the camera and a car that view follows, swaps to
  dithered see-through versions of its materials (`alphaHash`, so there's nothing to sort). A camera
  swinging round the Hyde St corner used to fill half the screen with a parked Waymo's white panels.
- Each half is drawn with a scissor and its own shadow focus; trails are re-faced for each half. It
  holds 60 fps at 1920×1080 (2× pixel ratio) on an M1 Pro, split or not.
- Big hits, landings and shoves shake that player's view a little.

### Driving controls

- P1: W gas, S brake/reverse, A/D steer, Space item (also E, Left Shift). P2: ↑, ↓, ←/→, Enter (also
  Right Shift, /, Numpad 0). The spares help keyboards that ghost with six keys held.
- Gamepads: the first connected pad drives Player 1 and the second Player 2, alongside the keys.
  Right trigger or A for gas, left trigger or B to brake, the stick or d-pad to steer, X, Y or the
  right shoulder for the item.
- An item press is taken once per key-down, on the first physics step of a frame.

### HUD

- Each card: name, race position and gap, speed (then the live distance in flight), fuel, HYPE with
  the launch boost it's worth, the item slot (with a roulette), and flashes. Flashes that name a
  cause (WAYMO'D!, SPUN BY SAM'S POO!, NEAR MISS!, SLIPSTREAM!, LOW FUEL · save it for the kicker!,
  ...) and big shouts over the car for the moments that matter. At most four timed flashes per card.
- Shouts ride along just above the car's name tag in that player's view, stack upwards when two
  come at once, and are skipped for a car that's only a speck near the horizon (the card's flash
  still says it).
- A strip at the top shows both cars on the course (start, Hyde, Lombard, the pier), which matters
  most when the screen is split. When the two markers meet they step apart, P1 above the line and
  P2 below, clear of the labels.
- The Bay's distance labels fade by where each view is looking (side-on they're solid, end-on they're
  gone), per half of a split screen.
- The countdown shows a controls card with the items explained. A hint appears when you reach Lombard
  holding a Jump ("JUMP THE HEDGES!").
- A Jump bursts a ring of dust from the road and stretches the car on its springs; a landing
  squashes it. A poo hit throws a fountain of brown, shakes the view, flings brown from the wheels
  while the car spins under a halo of dizzy stars, and leaves the splat on the road for a few
  seconds.
- Name tags are projected in every half that shows the car.

### Garage stats and parts

- Stats: Mass, Power, **Fuel as seconds of full throttle** ("6.9 s gas" means more to players than
  kJ), Grip (μ, with "4WD" when traction is well above grip), **Handling** (0-10: nose response and
  turning radius), **Brakes** (g), Drag, Lift.
- Every tagline was rewritten to state the part's tradeoff in the race as well as in the air (for
  example the kart "turns on a dime, but gets shoved around", the pickup is "a tall-geared 4WD
  bulldozer that wins every shove, but slow to turn, stop and jump").
- **CPU:** a toggle on Player 2's panel. The CPU picks one of six sensible builds (a new one each
  round, so the rival varies), is always ready, and its panel is dimmed. `?cpu=1` starts with it on.

### Sound

New procedural voices: a tyre screech that follows the slide, item-box sparkle, roulette ticks, a
boing, a power chord, a plop and a splat, a toy bonk for shoves, a crunch and a robotaxi chime for
Waymos, a cartoon "whoa" for tourists, a plastic tock for cones, the cable-car bell, a horn per
chassis, a rocket start (or a bogged-down sputter), HYPE blips and a near-miss whoosh.

### Test hooks

`window.__game` keeps everything listed under "Test hooks" below, and adds:

- `cars` (live race state per car: position, speed, fuel, HYPE, item, tallies, ...), `world` (the
  traffic, tourists, boxes, poo and the cable car), `split` (0-1), `wins`, `course` (landmark arc
  lengths), `cpu`.
- `input(p, {throttle, brake, steer, item})` drives a car from a script (`null` gives it back),
  `autodrive(p, on)`, `setCpu(on)`, `giveItem(p, 'jump' | 'grit' | 'poo')`, `place(p, s, d, speed)`.
- `predict()` and `simulateToEnd(stats, wind)` now mean the autopilot's run on an empty course.
- URL: `?autodrive=1|p1|p2`, `?cpu=1`, `?traffic=0`, `?items=0`.

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

## Garage (replaces the turn-based draft)

The brief's turn-based draft (one slot at a time, players alternating, no going back) didn't work in
play. You could only act on your turn, and you had to commit to a part before seeing what the later
slots cost, so budgets went wrong. At the team's request the build phase is now a garage that both
players use at the same time. (`BUILD_PROMPT.md` still describes the draft as it was first built.)

- **A tab per slot.** Each panel has a 3×3 grid of tabs, one per slot, showing the part fitted there
  and what it cost. Every price is one click away, and the grid is the budget breakdown. The open
  tab's parts are listed below it.
- **Fit and remove.** Every slot always holds a part: its free stock part (the first, $0 option)
  until something else is fitted. So a car is always complete and within budget, and there's no
  "unfinished" state to fill in at launch.
  - Clicking a part fits it. Swapping refunds the part it replaces, so a part is affordable when
    `price ≤ money left + price of the part fitted in that slot`.
  - Clicking the fitted paid part again removes it, and the slot falls back to its free part. Free
    parts can only be swapped, since there's nothing to refund.
  - Parts you can't afford show "NEED $X MORE". Clicking one shakes the money and buzzes. So does W/S
    or ↑/↓ when every part that way costs too much. At the end of the list they stay quiet.
  - Hovering previews what a click would do, including hovering the fitted paid part: that shows
    its removal (the refund in green, the free part's stats, and the car with it). A click ends the
    preview until the pointer comes back, so a part you've just fitted doesn't flip to showing its
    removal.
  - Cosmetic slots are all free, so their title says "· all free" instead of a FREE chip on every
    card.
- **READY per player.** READY locks a car in: its parts give way to a READY card, and READY again
  ("Edit car") unlocks it. The race starts as soon as both players are ready.
  - A single LAUNCH button would let one player start the race while the other is still building.
  - The `launch()` hook still starts at once, ready or not.
- **Rematch keeps the cars.** A rematch starts from both cars exactly as they raced, and each
  player's open tab is kept. To make tweaking quick:
  - Slots changed since the last race turn gold with a gold edge, and their tooltip says what was
    there. A "changed" legend appears next to YOUR CAR while any slot differs.
  - Last race's part is tagged LAST RACE in its slot.
  - The Stats header shows each player's last distance.

  New players resets both cars to the free build.
- **Two players on one keyboard.** Keys are `KeyboardEvent.code` values, so the same physical keys
  work on any layout. The panels show them next to the tabs, the parts and READY.
  - P1 uses the left of the keyboard: A/D for slot tabs, W/S for parts, Space for READY.
  - P2 uses the arrows: ←/→, ↑/↓, Enter.
  - W/S and ↑/↓ fit the next or previous affordable part straight away. Tab keys wrap around.
  - The old number keys are gone. With both players building at once they'd be ambiguous.
- **Sounds.** A rising chime plays for READY and a falling one when a player goes back to editing.
  A low buzz plays for a part you can't afford.
- **No turn order.** The first-picker swap is gone with the turns.
- **Mashing is safe.** Space and Enter are both READY keys and the results screen's rematch keys,
  so:
  - The results ignore them for 1 s. Otherwise keys still being mashed from the race skip the
    results.
  - A fresh garage ignores the READY keys for 0.6 s, so the press that left the results doesn't
    also ready a player.

  Both grace periods are real time, whatever `?speed` is. On part cards and READY, the second click
  of a double-click is ignored, since it would undo the first (fit then remove, ready then unready).
- **Short windows.** A 1366×768 laptop minus the browser's toolbars leaves about 610–660 px. There
  the 11 px text floor stops the UI shrinking with the height, and the cards spilled over READY. So:
  - Panels never get narrower than at 720p (`--panel-w`).
  - Windows up to 660 px tall get one-line taglines (each card's tooltip leads with the full text),
    no cosmetic taglines, and tighter spacing.
  - The part list scrolls as a last resort, and READY always paints on top.

  Everything fits down to 580 px. At 560 px, Chassis scrolls by 13 px.

## Game flow and UI

- **Wind** is rolled uniformly in −8…+8 m/s at the start of each round and rounded to 0.1 m/s.
  Anything under 0.5 km/h displays as "CALM". Traffic, tourists, the cable car and item luck are
  rolled from the same seed each round, so every round is a little different.
- **Keys.** The garage keys are listed under "Garage" above; the driving keys under "Driving
  controls" below. **Enter** or **Space** starts a rematch from the results screen, after a 1.5 s
  grace period (they're the item keys too, and are often still being mashed when the race ends). **M** mutes, and a clickable sound button does the same for
  mouse-only players. Keys pressed with Ctrl, Cmd or Alt are left to the browser.
- In round 1 a car is the all-$0 build in its player's own default paint (P1 red, P2 blue). On a
  rematch it's last race's car.
- Player identity colours: P1 `#ff5a36` (coral), P2 `#2e8bff` (blue). They tint panels, HUD cards,
  name tags over the cars and the flight trails; the chosen Paint colours the car body.
- Hovering a card previews the part on the car, on the stat bars (striped ghost bar, green/red
  value when it is better/worse) and on the money (dashed, showing what would be left after the
  swap; negative for a part you can't afford).
  - Unaffordable cards stay hoverable: they're `aria-disabled`, not `disabled`.
  - Clicking a part, or pressing that player's garage keys, ends the preview. The car shows the
    change at once, and a removed part doesn't linger as a preview under the pointer.
- The stat bars show what matters on the road and in the air: Mass, Power, Fuel, Grip, Handling,
  Brakes, Drag and Lift (see "Garage stats" under "The race").
- The Lift bar shows lift at a typical 30 m/s as a share of the car's weight ("65% wt"; a full bar
  means lift equal to weight). It is composed exactly like the physics: body and spoiler lift, plus
  the kite and glider wings together (wings capped by their trim, the kite by its maximum pull).
  The same wings read higher on a light car (a go-kart shows 65%, a pickup 45%), matching where
  they help most.
- Stat bars: Power and Fuel use a square-root scale so the lawnmower and jerry can are still
  visible. Bump resistance moved out of the bars into the wheels' taglines.
- Toppers have 1–2 kg of mass (the table says "small"), and `computeStats` includes it, so the game
  and `simulateToEnd` stay identical. The balance check uses the no-topper default.
- **"New players"** resets names, the round counter, last round's cars and distances, and the
  session best (and hides the best-distance buoy). The wind RNG simply continues.
- The best-distance flag buoy sits between the lanes at the record distance and is labelled with
  the record holder's name, tinted in their colour.
- Buoys float in both lanes every 10 m out to 250 m. Their number labels sit between the lanes so
  the two rows never overlap on screen; every 50 m gets a big yellow buoy with a tall marker label.
- `?speed=N` scales all game time (countdown, race, pause before results), clamped to 0.05–50.
- Both panels are live at once, and each glows in its player's colour while they build. A ready
  player's panel loses the glow and its tabs read as a plain summary.
- The status banner ("Build your cars…", "Sam is ready · waiting for Alex") sits bottom-centre,
  above two hints: fitting parts, and the race keys. The in-world "LA VOITURE" start gantry then stays visible under the wind forecast
  rather than hidden behind the UI.
- Topper parts are listed one per row like the performance slots. Only Paint uses the two-column
  swatch grid.
- Small text never drops below ~11 px (panels, taglines, card tags, key chips, HUD) so 1280×720 on a
  TV stays legible.
  - The card tags' fills give their white text at least 5:1 contrast (the FITTED tag is the player
    colour darkened to 72%).
  - Preview numbers use a darker green and red than the bars (`#0f7a4a`, `#c62f35`).
  - The name box is a dark recess, even while typing, so its white text reads on both player
    colours.
  - The stat value column fits "−0.5%/bump" in the fallback fonts too (no web font is bundled).
  - In the "… is ready" banner only the name sits in the coloured pill, so a very long name is cut
    without losing "is ready".
  - The money turns green when a hovered swap gives money back, and red only for a part you can't
    afford. Spending right down to $0 is fine.
  - Taglines keep numbers and units together (`660\u00a0kg`).
- Buttons drop keyboard focus after a mouse click, and the game's keys call `preventDefault`, so
  Enter never re-presses the last clicked button (e.g. the sound toggle). A button reached with Tab
  keeps its native Enter/Space press.
- Names are trimmed, cut to 16 characters and trimmed again; an empty name falls back to
  "Player N". Characters are user-perceived ones (`Intl.Segmenter`), so an emoji, even a flag or a
  family, is never split.
  The name box accepts up to 40 raw characters so leading spaces don't eat into the 16.
- Name tags over the cars stack instead of overlapping when the cars are side by side. The vertical
  gap they need shrinks smoothly as they separate sideways, and a tag only moves as far as it has to,
  so nothing pops. Which tag sits on top only changes when the order clearly flips.
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

## Physics details that carry over

- Lift (wings, the bathtub's body, the kite) only acts in flight. The kite's lift is ½ρ·ClA_kite·|v_air|²
  capped at its limit, added to the body/wing lift along the same "perpendicular, rotated towards up"
  direction; its extra drag only applies once open (at the lip).
- The flight is now 3D (a car can leave the lip at an angle); with no sideways speed it is exactly
  the old 2D model. Lift acts perpendicular to the airspeed in the vertical plane that contains it.
- The lip crossing and the splash are interpolated inside their step. The score is the horizontal
  distance along x (the buoys' axis) and is clamped at ≥ 0.

### Glider wings (a deliberate model change, kept from the first version)

With the spec's lift model (constant ClA from the lip, perpendicular to the airspeed), glider wings
never *glide*. Verification measured the same ~33–40° water entry with or without wings at any lift
value: lift is strongest in the fast climb, so the car balloons into a taller lob. The physics
check "glider wings on a go-kart visibly glide" could not pass, so the glider changed, in the same
spirit as the spec's kite that opens at the lip:

- **Spring-loaded wings:** folded (sleek, small drag) on the run-up and the climb; they pop open at
  the top of the arc (`wingsOpen` event, "GLIDING!" on the HUD, a swoosh, and the mesh unfolds).
  Folded, the mesh also telescopes them to 55% span and tucks the upright tip plates away: swung
  straight back at full span, the tips trailed off the back of short cars like two loose flaps.
- **Open wings** add their lift area (`clA`) and extra drag (`openCdA`).
- **Trim cap.** Their lift, together with a kite's, is capped at `trim` × the car's weight: the wings
  settle into a steady glide instead of ballooning. A kite that already pulls harder keeps its own
  capped lift.
- The cap also keeps "a headwind shortens distances" true for gliders in the strongest headwind.
  Uncapped, extra airspeed meant extra lift, and gliders flew *further* into a headwind.
- Result: a ballistic climb, then a visibly flatter, longer descent on light cars. Heavy cars barely
  change ("great on light cars").
- With the race, the −8 m/s headwind still shortens every one of the 2,428 builds (see "Wind"
  below). Slow gliders can still be the exception to "wind in your favour means further":
  - A handful whose wings open below their trim speed can gain up to ~1.7 m from a *moderate*
    headwind: extra airspeed adds lift faster than drag.
  - A tailwind can cost such a glider up to ~5 m: less airspeed, less lift.
  - `npm run balance` sweeps every headwind and reports both effects. They follow from the spec's
    airspeed = v − wind. Beyond the fixed-step wobble (see "Residual fixed-step wobble"), only
    slow glider builds are affected.

Body lift (the bathtub), the spoiler and the kite otherwise follow the spec exactly.

## Known minor issues (left as is)

- **Glider unfold from the side view.** From the side camera the wing unfold is hard to see: the
  wings go from a thin trailing rod to edge-on. The "GLIDING!" flash, the swoosh and the flatter
  trail mark the moment.
- **First-launch hitch.** The first race of a session can stall a countdown beat for a moment while
  the flame and effect shaders compile.
- **Very wide names** (e.g. sixteen "W"s) are ellipsized in the name box but shown in full elsewhere.
- **Keyboard ghosting.** Some keyboards can't register every combination of six held keys; the
  spare item keys and gamepads are the way round it.
- **The autopilot is decent, not great.** It hits Lombard's tourists more often than a careful human,
  its line through the hairpins is conservative, and it never hedge-hops.
- **Results card at 1280×720** sits a few pixels above the sound button (not overlapping).

## Test hooks

`window.__game` exposes `state`, `configs`, `wind`, `results`, `launch()`, `rematch()`,
`newPlayers()`, `setSpeed(n)` and more:

- **Garage:** `select(p, slot, option)` (fit a part by id or index), `remove(p, slot)`,
  `openTab(p, slot)`, `setReady(p, on)` (the countdown starts once both are ready), and `garage`
  (configs, money, ready flags, open tabs, and last race's cars and distances).
- `ready`, `round`, `names`, `setName(p, name)`, `sessionBest`, `events` (the race's event log),
  `sound` (`ready`, `muted` and the output RMS `level`, to prove audio plays and that M silences it),
  `toggleMute()`, `computeStats`, `parts`, plus the race hooks above.
- `launch()` works from the build phase at any time: it races both cars as they are.
- `?autobuild=1` builds both cars at random (affordable parts only) at the start of every round.
- `?wind=W` pins the wind to W m/s for every round, for deterministic checks.

## Balance

`npm run balance` enumerates all 2,428 affordable builds and has the autopilot race each one down the
empty course in three winds (−8, 0, +8 m/s), with HYPE off so it compares the cars, not the driving.
It takes about 35 s. It fails on:

- a paid part that never makes the top 10% in any wind, or that is never the strictly best pick for
  its slot (the other six slots fixed) in any build and wind;
- a free part that isn't on the price/distance Pareto front in some wind (every free part is the
  "keep the money" option now, not just the empty wing, nose and booster: the lawnmower and jerry
  can can't win a long race on their own, but they fund everything else);
- the same #1 build in every wind with fewer than three chassis in any top 5;
- any build that fails to reach the lip; the strongest headwind lengthening any flight; glider wings
  that don't visibly glide; sensible builds (a V8 or jet with a real tank) taking more than 50 s;
  any flight over 7 s; the all-$0 build outside 5-30 m in calm air; the best build outside 80-180 m.

What changed for the race, and why:

| Part | Before | Now | Why |
|---|---|---|---|
| Lawnmower | 2.5 kW | 5 kW, top speed 17 m/s | A whole race on a jerry can; still the all-$0 build's weak engine |
| V8 | 185 kW | 130 kW, top 32 m/s | Launch speeds; the top speed caps a floored run down the last blocks |
| Jet | 200 kW, cap 17.5 kN | 140 kW, cap 12 kN, top 33 m/s | As above; still wins headwinds |
| Jerry can | 120 kJ | 250 kJ | Fuel is spent across a 40-50 s race now |
| Standard tank | 460 kJ | 1.4 MJ | Enough for careful driving plus the run to the kicker |
| Oversized tank | 760 kJ | 2.6 MJ | Floor it all race; a newcomer who holds the gas doesn't run dry |
| Go-kart | 200 kg, CdA 0.85 | 195 kg, CdA 0.76 | So the slimmest chassis wins tailwinds (the Bathtub won every wind) |
| Bathtub | ClA 1.7 | ClA 1.45 | Lifting body plus glider wings dominated every wind |
| Pickup | 1210 kg, CdA 1.05 | 1000 kg, CdA 0.95, gearing ×1.1 | Never reached the top 10%; now wins some headwind contexts and every shove |
| Wheels | | gearing ×0.82 / ×1 / ×1.18, brakes 6.5/9.5/13 kN, spin waste 100/30/15% | New jobs: top speed, stopping, fuel economy |
| Spoiler | | downforce 2.4 m² | Grip in fast turns |
| Noses | | bull bar / wedge / spike | The free Blunt nose shoves hardest |

**How the winds differ:** a Bathtub with a Jet, Glider wings and Nitro wins headwinds and calm air; a
Go-kart with Monster wheels, a V8, Glider wings and Nitro wins tailwinds. The chassis' race times on
Lombard (the kart quickest, the pickup slowest) and their shoving weight are what the balance check
can't see; they are what makes the Sedan and Pickup worth racing.

**Driving tests** (scripts, not in the repo): a "keyboard" driver (the autopilot's intent quantised
to on/off keys with a 0.15 s reaction) gets round every build cleanly; one that holds the gas all
race runs dry after Lombard with a Standard tank (a LOW FUEL warning comes first) but not with an
Oversized one; in 16 two-car races with traffic, V8 karts land 90-137 m in 37-57 s, and the obstacles
hit most are Lombard's tourists.

### Final balance report (`npm run balance`)

```
La Voiture balance report
Every affordable build (performance slots, budget $100): 2428, each raced down the course by the autopilot
(empty course, no items or HYPE: this compares the cars, not the driving).
Top 10% = 243 builds per wind

## Top 15, headwind -8 m/s
  #   dist m    $  lip m/s  race s  air s  waste  build
  1    147.1   98     33.5    37.1    6.1    29%  Bathtub · Tiny · Jet · Standard · Glider wings · Wedge · Nitro
  2    143.7  100     32.9    37.4    6.1    39%  Bathtub · Standard · V8 · Standard · Glider wings · Cone · Nitro
  3    142.0   93     32.9    37.5    6.1    38%  Bathtub · Standard · V8 · Standard · Glider wings · Wedge · Nitro
  4    141.6   95     34.1    34.8    6.0    23%  Bathtub · Monster · V8 · Standard · Glider wings · Blunt · Nitro
  5    137.9   90     33.1    37.3    6.0    26%  Bathtub · Tiny · Jet · Standard · Glider wings · Blunt · Nitro
  6    136.0  100     32.7    36.6    5.9    28%  Bathtub · Standard · Jet · Standard · Glider wings · Blunt · Nitro
  7    134.0  100     32.2    37.8    5.6    56%  Bathtub · Tiny · Jet · Oversized · Glider wings · Blunt · Nitro
  8    133.8   98     35.4    34.3    5.0    32%  Go-kart · Monster · V8 · Standard · Glider wings · Wedge · Nitro
  9    133.1   85     32.6    37.7    6.0    34%  Bathtub · Standard · V8 · Standard · Glider wings · Blunt · Nitro
 10    130.2  100     34.3    36.8    4.9    35%  Go-kart · Tiny · Jet · Standard · Glider wings · Cone · Nitro
 11    128.7   95     31.5    37.9    5.6    62%  Bathtub · Standard · V8 · Oversized · Glider wings · Blunt · Nitro
 12    128.5   93     34.3    36.8    4.9    35%  Go-kart · Tiny · Jet · Standard · Glider wings · Wedge · Nitro
 13    127.0   95     30.9    34.6    5.5    28%  Bathtub · Monster · V8 · Standard · Glider wings · Cone · None
 14    126.6   90     34.9    34.5    5.0    28%  Go-kart · Monster · V8 · Standard · Glider wings · Blunt · Nitro
 15    125.6  100     33.8    34.8    4.9    58%  Go-kart · Monster · V8 · Oversized · Glider wings · Blunt · Nitro
DNFs in this wind: 0

## Top 15, calm (0 m/s)
  #   dist m    $  lip m/s  race s  air s  waste  build
  1    168.4   98     35.8    36.6    6.0    33%  Bathtub · Tiny · Jet · Standard · Glider wings · Wedge · Nitro
  2    166.0   95     36.5    34.1    5.9    30%  Bathtub · Monster · V8 · Standard · Glider wings · Blunt · Nitro
  3    165.2  100     35.2    36.8    5.9    42%  Bathtub · Standard · V8 · Standard · Glider wings · Cone · Nitro
  4    164.0   93     35.3    36.8    6.0    42%  Bathtub · Standard · V8 · Standard · Glider wings · Wedge · Nitro
  5    161.9   90     35.6    36.7    5.9    32%  Bathtub · Tiny · Jet · Standard · Glider wings · Blunt · Nitro
  6    159.1  100     35.1    35.9    5.8    34%  Bathtub · Standard · Jet · Standard · Glider wings · Blunt · Nitro
  7    158.1   98     37.6    33.6    5.2    35%  Go-kart · Monster · V8 · Standard · Glider wings · Wedge · Nitro
  8    157.4   85     35.0    37.0    5.9    41%  Bathtub · Standard · V8 · Standard · Glider wings · Blunt · Nitro
  9    153.8  100     34.5    37.3    5.5    59%  Bathtub · Tiny · Jet · Oversized · Glider wings · Blunt · Nitro
 10    153.1  100     36.5    36.4    5.1    37%  Go-kart · Tiny · Jet · Standard · Glider wings · Cone · Nitro
 11    152.4   98     33.4    33.9    6.2    31%  Bathtub · Monster · V8 · Standard · Glider wings · Wedge · Kite
 12    152.0   93     36.5    36.3    5.1    38%  Go-kart · Tiny · Jet · Standard · Glider wings · Wedge · Nitro
 13    152.0   90     37.2    33.8    5.2    34%  Go-kart · Monster · V8 · Standard · Glider wings · Blunt · Nitro
 14    149.7   95     33.9    37.1    5.5    65%  Bathtub · Standard · V8 · Oversized · Glider wings · Blunt · Nitro
 15    148.9   95     36.0    36.5    5.1    45%  Go-kart · Standard · V8 · Standard · Glider wings · Cone · Nitro
DNFs in this wind: 0

## Top 15, tailwind +8 m/s
  #   dist m    $  lip m/s  race s  air s  waste  build
  1    179.9   98     39.6    33.2    5.3    35%  Go-kart · Monster · V8 · Standard · Glider wings · Wedge · Nitro
  2    178.5   98     38.0    36.3    5.6    34%  Bathtub · Tiny · Jet · Standard · Glider wings · Wedge · Nitro
  3    178.1   93     37.5    36.3    5.6    43%  Bathtub · Standard · V8 · Standard · Glider wings · Wedge · Nitro
  4    176.8  100     37.4    36.3    5.6    42%  Bathtub · Standard · V8 · Standard · Glider wings · Cone · Nitro
  5    175.5  100     38.5    36.1    5.3    38%  Go-kart · Tiny · Jet · Standard · Glider wings · Cone · Nitro
  6    175.2   93     38.6    36.0    5.3    38%  Go-kart · Tiny · Jet · Standard · Glider wings · Wedge · Nitro
  7    173.8   90     39.5    33.2    5.3    36%  Go-kart · Monster · V8 · Standard · Glider wings · Blunt · Nitro
  8    172.2   90     37.8    36.3    5.5    34%  Bathtub · Tiny · Jet · Standard · Glider wings · Blunt · Nitro
  9    172.1   95     38.8    33.4    5.3    32%  Bathtub · Monster · V8 · Standard · Glider wings · Blunt · Nitro
 10    171.9   95     38.1    36.1    5.3    45%  Go-kart · Standard · V8 · Standard · Glider wings · Cone · Nitro
 11    171.6   85     37.4    36.3    5.5    43%  Bathtub · Standard · V8 · Standard · Glider wings · Blunt · Nitro
 12    171.6   88     38.2    36.1    5.3    46%  Go-kart · Standard · V8 · Standard · Glider wings · Wedge · Nitro
 13    171.3   85     38.5    36.0    5.3    39%  Go-kart · Tiny · Jet · Standard · Glider wings · Blunt · Nitro
 14    167.9  100     36.2    33.2    5.7    36%  Go-kart · Monster · V8 · Standard · Glider wings · Cone · Kite
 15    167.6   93     36.2    33.1    5.7    36%  Go-kart · Monster · V8 · Standard · Glider wings · Wedge · Kite
DNFs in this wind: 0

## Options: best rank, appearances in the top 10% (243 builds), and median times (calm)
slot       option         best  (wind)   top@-8   top@0  top@+8   race s Lombard s
Chassis    Go-kart           1    (+8)      102     114     125     44.8      12.0
Chassis    Bathtub           1    (-8)      128     122     115     45.8      12.2
Chassis    Sedan            47    (-8)       10       7       3     47.9      12.6
Chassis    Pickup 4x4      142    (-8)        3       0       0     49.5      13.0
Wheels     Tiny              1    (-8)       80      82      76     49.2      12.8
Wheels     Standard          2    (-8)       92      93      96     47.6      12.4
Wheels     Monster           1    (+8)       71      68      71     45.1      11.2
Engine     Lawnmower       360    (+8)        0       0       0     49.0      12.5
Engine     V8                1    (+8)      139     141     138     38.6      12.1
Engine     Jet               1    (-8)      104     102     105     38.6      12.1
Fuel tank  Jerry can        51    (+8)       14      20      15     48.6      13.2
Fuel tank  Standard          1    (-8)      148     154     162     38.5      12.0
Fuel tank  Oversized         7    (-8)       81      69      66     39.6      12.2
Wing       None             42    (-8)       53      48      66     45.7      12.2
Wing       Spoiler          23    (-8)       66      59      65     46.1      12.1
Wing       Glider wings      1    (-8)      124     136     112     47.9      12.5
Nose       Blunt             2     (0)       72      79      87     46.2      12.2
Nose       Wedge             1    (-8)       90      88      84     46.4      12.2
Nose       Cone              2    (-8)       81      76      72     47.0      12.3
Booster    None             13    (-8)       43      44      34     45.9      12.2
Booster    Nitro             1    (-8)      125     112     120     47.2      12.3
Booster    Kite             11     (0)       75      87      89     46.8      12.2

## Best pick for its slot (other six slots fixed, any wind)
Chassis    Go-kart       free: on the price/distance Pareto front (best pick in 823 contexts)
Chassis    Bathtub       697 contexts
Chassis    Sedan         8 contexts
Chassis    Pickup 4x4    439 contexts
Wheels     Tiny          free: on the price/distance Pareto front (best pick in 905 contexts)
Wheels     Standard      430 contexts
Wheels     Monster       1090 contexts
Engine     Lawnmower     free: on the price/distance Pareto front (best pick in 0 contexts)
Engine     V8            1613 contexts
Engine     Jet           910 contexts
Fuel tank  Jerry can     free: on the price/distance Pareto front (best pick in 415 contexts)
Fuel tank  Standard      1392 contexts
Fuel tank  Oversized     596 contexts
Wing       None          free: on the price/distance Pareto front (best pick in 161 contexts)
Wing       Spoiler       401 contexts
Wing       Glider wings  1971 contexts
Nose       Blunt         free: on the price/distance Pareto front (best pick in 0 contexts)
Nose       Wedge         461 contexts
Nose       Cone          1845 contexts
Booster    None          free: on the price/distance Pareto front (best pick in 0 contexts)
Booster    Nitro         2189 contexts
Booster    Kite          215 contexts

## Wind
Builds that fly further into the strongest headwind (-8 m/s) than in calm air (by more than 0.5 m): 0
Builds that fly shorter with a tailwind than in calm air (by more than 0.5 m): 44

## Glide (calm air): go-kart with glider wings vs the same kart with none
Go-kart · Tiny · Lawnmower · Jerry can · Glider wings · Wedge · Nitro: 95.3 vs 79.4 m, air 4.3 vs 3.1 s, water entry 26° vs 37°
Go-kart · Standard · V8 · Oversized · Glider wings · Cone · None: 120.8 vs 89.9 m, air 4.6 vs 3.2 s, water entry 22° vs 34°

## Race pacing (calm air, the autopilot)
V8 or jet with a Standard or Oversized tank (894 builds): median 36.7 s, 90% within 39.5 s
Lawnmower or jerry-can builds (1534 builds): median 48.9 s, 90% within 52.2 s

## All-$0 build (Go-kart · Tiny · Lawnmower · Jerry can · None · Blunt · None)
headwind -8 m/s      9.4 m  lip 6.7 m/s, race 57.9 s, air 1.7 s, wasted 69% fuel
calm (0 m/s)         18.1 m  lip 10.8 m/s, race 49.4 s, air 1.9 s, wasted 74% fuel
tailwind +8 m/s      34.0 m  lip 16.8 m/s, race 45.4 s, air 2.3 s, wasted 73% fuel

## Checks
- Distinct #1 builds across winds: 2
- Distinct chassis in each wind's top 5: -8: 1, 0: 1, +8: 2 (union: 2)
- Race time, all builds: 32.8-59.6 s; flight time: 1.7-6.2 s
- PASS: every paid part reaches the top 10% in some wind and is the best pick for its slot in some build, every free part is on the price/distance front, the winner changes with wind, every build reaches the lip in every wind, the strongest headwind shortens every flight, glider wings visibly glide, sensible builds reach the lip within 50 s, no flight lasts over 7 s, the all-$0 build splashes 5-30 m out in calm air, best builds fly 80-180 m, no NaNs.
```

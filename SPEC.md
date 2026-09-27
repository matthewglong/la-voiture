# La Voiture — Spec

Two players build cars on one shared screen, then race each other down a San Francisco hill, through
Lombard Street's switchbacks, along the pier and off a kicker into the Bay. The furthest splash wins.

## Scope
- **One screen, two players.** Build phase → countdown → race → flight → results → rematch. No
  networking and no backend. A CPU can drive Player 2, or one player can train solo.
- **3D** with Three.js, using a "premium toy" look: procedural primitives, clearcoat car paint,
  shadows, a sky shader, fog, and procedural environment lighting.
- **Scene:** an SF street grid on the hill with pastel Victorian row houses, race barriers and
  cheering crowds; cable-car lines (bumps) at the intersections; Lombard St's brick switchbacks with
  hedges and hydrangeas; the Embarcadero; a pier with a kicker ramp; the Bay with buoys every 10 m;
  the Golden Gate Bridge, Alcatraz, sea lions.
- **Sound:** procedural Web Audio for engines, tyres, bumps, crashes, items, the cable-car bell,
  wind, splashes, the countdown and cheering.
- **Wind:** a random headwind or tailwind each round, shown *before* building.

## Build phase (the garage)
- Both players build at the same time and can change any part until they press READY.
- A tab per slot shows the fitted part and its price. Click a part to fit it; click the fitted part
  again to remove it. A **$100 budget** as a hard cap; every slot has a $0 option.
- Slots: Chassis, Wheels, Engine, Boost (the bottle), Wing, Nose, Booster, then the free cosmetics
  (Paint, Topper).
- Stats: Mass, Power, Boost (seconds), Grip, Handling, Brakes, Drag, Lift.
- **No dominated options:** every paid part must make the top 10% for distance in some wind and be
  the best pick for its slot in some build; every free part must sit on the price/distance front.
  Checked by `npm run balance`, which races every build with the autopilot.

## The race
- **Driving:** throttle, brake (and reverse), steering, boost. Keys, or gamepads. The gas is free.
  Two players share the keyboard (P1: WASD, Left Shift boost, Left Ctrl item, Tab swap; P2: the
  arrows, P boost, ; item, O swap); one player alone drives on the arrows (Shift, Space, Tab).
- **Arcade cornering grip,** and a **drift**: tap the brake while turning at speed; the wheel then
  sets the slide's arc (tighter than grip allows), and letting go ends it. Drifting fills the boost.
- **Boost:** a bottle of a few seconds (the Boost slot sets its size), full at the start, refilled by
  drifting and items. Holding boost pushes the car up to a little past its top speed. What's left at
  the lip is wasted.
- **Handling from the parts:** grip (wheels; tyres lose a little under load), how quickly the nose
  answers (chassis, slowed by weight), the tightest turn (chassis), brakes (wheels, limited by grip
  and weight), downforce (spoiler), top speed (engine × wheel gearing; the wind shifts it).
- **Crests** at the intersections launch fast cars into the air.
- **Collisions:** car against car (mass and the nose decide the shove), against walls, Waymos,
  tourists, the cable car, loose cones.
- **Items** from boxes, two held at once with a key to swap which one fires: Jump, Determination,
  Poo, Boost +50%, Full boost (rare), Seagull (chases the rival and blinds them for a moment). The
  odds lean on the race order.
- **HYPE** (0-100) from racing with flair, turned into up to +15% launch speed at the lip.
- **The kicker drops:** it stands at 25° for the first car off it, then comes down 2° a second to
  12°, so whoever is behind launches lower (about 5% less distance per second behind, at most about
  a third). Racing alone, it never moves.
- **Split screen:** one camera while both cars fit; a fluid split when they don't; it heals when they
  come back together.

## Physics (`src/sim/`, deterministic fixed 1/120 s step)
- Driving in the horizontal plane with gravity along the slope, drag against the wind, rolling
  resistance, tyre grip (rolling within grip, sliding beyond it), a jet that ignores grip.
- **At the lip:** unused boost is wasted; the launch rocket adds its energy; HYPE scales the speed;
  the kite opens. The car leaves along the kicker's slope at that moment (the lip stays over the
  same spot and only comes down).
- **Flight:** gravity, drag against the airspeed, lift perpendicular to it (capped kite; glider wings
  that spring open at the top of the arc and trim to a glide).
- **Score:** the horizontal distance from the lip to the first contact with the water.

## Rematch
- Both cars are kept exactly as they raced; changed slots and last race's parts are marked. A new
  wind, new traffic and new item luck are rolled. "New players" resets everything.

## Solo training
- Player 2's panel becomes the settings: start from the top, Larkin St, Hyde St or Leavenworth; a
  ghost of the best run from there; traffic and items on or off.
- One car, one screen, split times against the best run. R retries at once, Esc returns to the
  garage.

# La Voiture — Spec

Two players build cars on one shared screen, then race each other down a San Francisco hill, through
Lombard Street's switchbacks, along the pier and off a kicker into the Bay. The furthest splash wins.

## Scope
- **One screen, two players.** Build phase → countdown → race → flight → results → rematch. No
  networking and no backend. A CPU can drive Player 2.
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
- Slots: Chassis, Wheels, Engine, Fuel tank, Wing, Nose, Booster, then the free cosmetics (Paint,
  Topper).
- Stats: Mass, Power, Fuel (seconds of full throttle), Grip, Handling, Brakes, Drag, Lift.
- **No dominated options:** every paid part must make the top 10% for distance in some wind and be
  the best pick for its slot in some build; every free part must sit on the price/distance front.
  Checked by `npm run balance`, which races every build with the autopilot.

## The race
- **Driving:** throttle, brake (and reverse), steering. Keys, or gamepads.
- **Fuel** burns only on the throttle, at the engine's power (less when it's rev-limited near top
  speed; bad tyres waste what they can't put down). Out of fuel, a car limps along.
- **Handling from the parts:** grip (wheels; tyres lose a little under load), how quickly the nose
  answers (chassis, slowed by weight), the tightest turn (chassis), brakes (wheels, limited by grip
  and weight), downforce (spoiler), top speed (engine × wheel gearing; the wind shifts it).
- **Crests** at the intersections launch fast cars into the air.
- **Collisions:** car against car (mass and the nose decide the shove), against walls, Waymos,
  tourists, the cable car, loose cones.
- **Items** from boxes: Jump, Determination, Poo. The odds lean on the race order.
- **HYPE** (0-100) from racing with flair, turned into up to +15% launch speed at the lip.
- **Split screen:** one camera while both cars fit; a fluid split when they don't; it heals when they
  come back together.

## Physics (`src/sim/`, deterministic fixed 1/120 s step)
- Driving in the horizontal plane with gravity along the slope, drag against the wind, rolling
  resistance, tyre grip (rolling within grip, sliding beyond it), a jet that ignores grip.
- **At the lip:** unused fuel is wasted; nitro adds its energy; HYPE scales the speed; the kite opens.
- **Flight:** gravity, drag against the airspeed, lift perpendicular to it (capped kite; glider wings
  that spring open at the top of the arc and trim to a glide).
- **Score:** the horizontal distance from the lip to the first contact with the water.

## Rematch
- Both cars are kept exactly as they raced; changed slots and last race's parts are marked. A new
  wind, new traffic and new item luck are rolled. "New players" resets everything.

# Furious Squirrels: core mechanics

The technical foundation, synthesized from the samples in `SAMPLES.md` and the house patterns of `games/Cart Racing` (Tub Rally) and `games/baseball`. All numbers here are starting values; `tools/balance.mjs` tunes them against `tools/balance-targets.json`.

## 1. Game loop and timing
- **Fixed-step sim at 120 Hz** (`DT = 1/120`), accumulator-driven from `requestAnimationFrame`, max 8 steps per frame (a long frame never spirals). The renderer interpolates nothing: at 120 Hz the last state is close enough for 60 fps displays.
- **Render on demand.**
  - The rAF loop runs only while something moves: a nut in flight, a squirrel scampering, a camera tween, falling branches or particles, or ambient steam when motion is allowed.
  - When idle it stops and redraws only on input or resize. Ambient steam is cosmetic and is **excluded from `isIdle()`**.
  - `startLoop()` is guarded against re-entry (LESSONS: a doubled rAF loop shipped once).
- **Wall-clock timers** (the optional turn timer, the AI think delay) use `performance.now()` deltas, not sim steps. `step(n)` in tests advances the sim directly.
- **Clock freeze:** `act('clock', ms)` pins the render clock, so mid-flight and mid-effect screenshots are deterministic.

## 2. World and units
- World units are "px at zoom 1". A battlefield is **2,400 × 1,200**, with y pointing down.
  - West Mountain (the Rustlers) fills the left third and Hot Springs Mountain (the Tails) the right third.
  - The valley floor in the middle carries the backdrop Row.
- The terrain shape comes from `research/valley-profile.json`: the battle-line profile, horizontally compressed and given per-level variation (see the PRD level table).
- **Gravity** `g = 520`. **Launch speed** is `power × VMAX`, with `VMAX = 1,120` and power from 0.05 to 1. The range at 45° with no wind is about 2,400.

## 3. State model: one serializable object
`battle` holds everything the rules need, and only plain JSON:
```
battle = {
  v: 1, seed, levelId, mode: 'story'|'quick'|'practice', difficulty: 'easy'|'medium'|'hard',
  round: 1, rounds: 3, roundWins: [0, 0], phase: 'move'|'aim'|'flight'|'settle'|'roundEnd'|'shop'|'battleEnd',
  turn: { team: 0|1, squirrel: id, n: 17, stamina: 300, timer: null|ms },
  wind: -1..1, windMax: 140, steam: { x, w, lift, on },
  teams: [{ id: 'rustlers'|'tails', acorns: 120, inventory: { chinquapin: 1, … }, ai: null|{difficulty, memory} }, …],
  squirrels: [{ id, team, name, perch: {tree, branch, t}|{ground: x}, x, y, grip: 64, out: false, facing: 1|-1, anim }],
  trees: [{ id, x, baseY, trunk: {len, w}, branches: [{ id, a, len, w, hp, broken, parent, t }] }],
  nuts: [{ kind, x, y, vx, vy, r, state, age, owner, tapped }],   // in flight
  terrainHash, events: [],                                          // events: hits, breaks, KOs (for HUD, audio, tests)
  rng: { sim: <u32>, ai: <u32> }
}
```
- **The terrain mask is not inside `battle`.** It is rebuilt from the level plus the crater list (`battle.craters: [{x, y, r}]`), so a save is small and exact.
- **Seeded RNG:** mulberry32, copied from `games/Cart Racing/src/js/rng.js`. It uses named streams: `sim` (wind rolls, debris), `ai` (aim noise) and `fx` (cosmetic only, never touches rules), so cosmetic randomness never shifts the sim.
- **Determinism:** the same seed, level and actions give the same `hashBattle()` in Node and Chromium. FNV-1a runs over the rounded squirrel, tree and crater state, as in Tub Rally's `hashRace`.

## 4. Terrain: a material mask
- **Mask:** `Uint8Array` at half resolution (1 cell = 2 world units, 1,200 × 600 cells). Values are `0` air, `1` dirt, `2` rock (does not carve), `3` tufa (the valley floor, which does not carve) and `4` log (fallen logs and stumps, which do not carve).
- **Carving:** a circle of radius `r` clears dirt cells. The visual terrain canvas is carved with `globalCompositeOperation = 'destination-out'` using the same circle, so the mask and the visuals always change together. That two-part update is the caveat in the Tuts+ technique.
- **Collision:**
  - For each step, walk from the previous to the next position, sampling the mask every `≤ 1` cell along the segment. This is the swept segment, so a fast nut never tunnels.
  - The nut collides with the first solid cell its circle overlaps (radius sampled on 8 points).
- **Surface normal:** the average of the vectors from solid cells to the hit point inside a 5-cell radius, normalised (Tuts+ method). It is used for bounce, roll (the hedge apple) and the dust direction.
- **Each level is its own spot on the two mountains.** The stretch (north, middle or south) keeps its Row backdrop, while each level's `land` recipe in `tools/levels/bake.mjs` varies:
  - `relief`, which scales the mountain heights (0.9–1.25);
  - `spread`, which makes the mountains steeper and narrower or broader;
  - slope `features`: benches (ledges) and gullies. Knolls exist too, but a knoll in front of a family's trees shelters fallen squirrels so well that rounds drag, so the story levels avoid them except level 12;
  - tree count (3–5 per family), where on the slope the trees stand, and the species mix;
  - obstacles standing on the slope: boulders (rock; novaculite on Under the Tower), fallen logs and stumps (log). They are drawn on their own layer, so craters never erase them.
- Everything is generated on West Mountain and mirrored across the valley. Each tree pair shares a leaf class (broadleaf, evergreen or bare), so neither family gets more cover. Levels carry `rev: 2`, and a saved mid-battle resume from an older layout is dropped.

## 5. Trees, branches and perches
- **Geometry, not mask.**
  - Each tree is a trunk segment plus a small tree of branch segments (2–3 levels), defined in the level JSON.
  - Collision is circle against capsule: point-to-segment distance compared with `r + w/2`.
  - **Canopies** are soft circles. A nut passing through one gets extra drag (`v *= 0.985` per step, rustle event), unless it is a Pecan Dart in its dash.
- **Branch hit points:**
  - Branches have `hp = 14 + 4·width` (about 40–54). Hits subtract the nut's `wood` damage.
  - At 0 hp the branch and its child branches **break**: a scripted fall with rotation and a leaf burst.
  - Squirrels perched on a breaking branch drop.
- **Species:** oak, hickory, shortleaf pine, sweetgum, eastern redbud, eastern redcedar (evergreen), Osage-orange (crooked, with hedge apples in fall) and dead snags (bare branches that crack easily).
  - Trunks never break (the tree stays standing, which keeps the family's home).
- **Perch graph.**
  - Nodes are evenly spaced along every unbroken branch (about every 28 units), along the trunk (about every 40), and on the ground along the slope beneath the family's trees (about every 40).
  - Edges join neighbours along a branch, branch and trunk junctions, trunk to ground at the base, and ground nodes to each other along the slope.
  - Scampering follows the shortest path over the edges (Dijkstra; the graphs are small). It costs stamina equal to the path length. The default stamina is 300 per turn.
  - **Squirrels cannot cross the valley floor:** each family's perch graph covers only its own mountain.
- **Dropping:** a squirrel whose perch disappears falls straight down, under gravity, onto the first branch, canopy or ground below it, then snaps to the nearest perch node. Fall grip loss is `max(0, (fallHeight - 60) × 0.12)`.

## 6. Nuts and abilities
**Integrator per step** (semi-implicit Euler, the same as `games/baseball/src/js/flight.js`'s fixed step):
```
ax = wind * windMax * nut.windMul + steamLift.x;  ay = g * nut.gMul - steamLift.y
vx += ax*DT; vy += ay*DT;  (canopy drag, dash, hook steering applied here)
x  += vx*DT;  y += vy*DT;  then sweep-test terrain, trees, squirrels (the owner is immune for 0.25 s;
   a family's own trees never block its nuts: "home leaves")
```
**Steam updraft:**
- Inside the column `|x - steam.x| < steam.w/2`, `lift.y = steam.lift × (0.6 + 0.4·sin(age × 3))`.
- The lift is strongest near the valley floor and fades linearly to 0 at 900 units above the floor (most cross-valley throws pass through it).

**One table defines every nut** (`src/js/sim/nuts.js`):

| Kind | r | Mass | Ability, triggered by a tap or Space during flight (once) | Grip dmg (direct / splash r) | Wood dmg | Crater r |
|---|---|---|---|---|---|---|
| `acorn` | 7 | 1 | none | 34 / 26 at 40 | 30 | 18 |
| `chinquapin` | 6 | 0.8 | **Trio:** splits into 3 at ±9°, speed kept | 20 each / 14 at 30 | 20 | 12 |
| `pecan` | 6 | 0.9 | **Dart:** velocity set to ×1.9 along the current heading for 0.6 s with gravity off; pierces canopies; +50% wood damage | 30 / 18 at 30 | 45 | 14 |
| `walnut` | 9 | 1.3 | **Burst:** explodes now (or on impact): big crater, branch shake | 26 / 34 at 85 | 50 (r 85) | 46 |
| `hickory` | 7 | 1 | **Hook:** a 1.4 s sideways curve that turns the heading by up to 150° back toward the thrower's side | 32 / 22 at 36 | 30 | 16 |
| `sweetgum` | 8 | 0.8 | **Drop:** releases a spiky ball straight down at ×1.4 gravity; the empty husk keeps drifting | ball 36 / 24 at 44 | 35 | 20 |
| `hedgeapple` | 13 | 2.4 | none. Heavy: `gMul` 1.15, `windMul` 0.4; on terrain it **rolls** along the surface normal for up to 1.2 s, hitting everything it touches | 48 / 20 at 30 | 60 | 22 |

- **Grip damage** is reduced by distance in the splash radius: linear from the splash value to 0.
- **Knockback** pushes a hit squirrel along the impact direction. If the push exceeds 18 units, the squirrel loses its perch and drops, as in §5.
- Abilities resolve deterministically from `tapAt` (the sim step of the tap), so the AI and tests can replay any shot exactly.

## 6b. Birds (airborne obstacles)
- **Who:** local and migratory birds, all on Hot Springs National Park's species list (`research/birds.md`):
  - chimney swift (spring, summer): fast zig-zag flocks
  - turkey vulture (all year): circles in the steam thermal
  - blue jay (all year): flies single
  - American crow (all year): flies in ones to threes
  - Canada goose (fall, winter): V flocks
  - cedar waxwing (winter, spring): tight flocks
  - bald eagle (winter): glides
  - There are no birds at night, and fewer in mist.
- **When:** fresh flocks are rolled at the start of every turn from the battle's own `birds` RNG stream.
  - Birds: Off / Some / Lots. Quick Battle offers all three; story levels use Some, except the tutorial, which has none; Practice has none.
  - A bird's position is a pure function of the bird clock `b.birdT`. The clock runs during flight and settle steps, and while a family aims (`sim.idle(dt)`, driven by the app's clock, so it pauses with the game).
  - Birds wrap across the sky, rise over the ridges, and big flocks drift a little with the wind.
- **Hits:** nobody is hurt.
  - A blue jay or crow that meets a plain acorn snatches it half the time, and the nut is gone. Paid special nuts are never taken.
  - Otherwise the nut glances off the bird: its velocity reflects about the bird's centre (restitution 0.4), it keeps 55–90% of its speed by species, and the flight continues.
  - The bird flaps off startled and can't be hit again that turn.
- **Not planned for:** the aim guide, the AI and `tools/check-levels.mjs` preview with no birds, so birds are a surprise hazard for both families, like gusts.

## 7. Turns, grip, knockouts, rounds and the shop
- **Grip** starts at 64, so two solid acorn hits knock a squirrel out. At 0 the squirrel is **out**: a tumble into the leaf pile at its mountain's foot, dizzy stars, and a cheer. A squirrel knocked off its perch that falls 110 units or more onto the ground is also **out** ("knocked out of the tree").
- **Turn sequence:** `move` (stamina, optional) → `aim` (choose nut, angle and power) → `flight` → `settle`.
  - Settle lasts until branches have stopped falling and squirrels have landed, capped at 2.5 s.
  - Then the next turn starts: teams alternate, each team cycles its living squirrels, and wind rerolls.
- **Wind** each turn is `w = clamp(prev × 0.5 + normal(0, 0.45), -1, 1)`, from the sim stream. The sign shows on the HUD with a flag and an arrow, and a numeric strength 0–10.
- **Round end:** a family with every squirrel out loses the round. The battle is best of `rounds` (Story 1 to 3, Quick 1/3/5). Between rounds, the terrain and trees reset.
- **Acorns (shop currency):**

  | Event | Acorns |
  |---|---|
  | Hit | 4 |
  | Branch break | 6 |
  | Knockout | 20 |
  | Round won | 40 |
  | Round played | 15 |

- **Shop:** after each round, each team buys specials, capped at 3 of each kind.
  - Prices: chinquapin 30, pecan 30, hickory 35, sweetgum 40, walnut 45, hedge apple 60.
  - The AI buys from a per-difficulty preference list.
  - Acorns (the nut type) are unlimited.

## 8. AI
`src/js/sim/ai.js` aims by search with **the same simulator**:
1. **Pick a target:** the living enemy with the best score, `-(distance) + 40·(low grip) + 30·(on a breakable branch)`.
2. **Coarse search:** angles 15°–80° in 2.5° steps, against powers 0.3–1.0 in 0.035 steps. The candidate is simulated with the true wind and steam on a cloned mask (abilities off, except planned ones: walnut bursts at its closest approach, chinquapin splits on descent). It scores by miss distance, plus damage to the target, minus self-risk if its own squirrels are within the splash radius.
3. **Refine:** a 5 × 5 local grid at a quarter of the step around the best candidate.
4. **Noise by difficulty:**

   | Difficulty | Angle σ | Power σ | Wind | Bracketing | Nut choice | Moves |
   |---|---|---|---|---|---|---|
   | Easy | 7° | 9% | half the true wind | no | random special 25% of the time | rarely |
   | Medium | 3° | 3.5% | full | yes: remembers the last miss vector and corrects 50% | situational | yes |
   | Hard | 1° | 1.2% | full | 80% | best expected damage | to a perch with a clear line |

   The AI never sees the future: noise is drawn from the `ai` stream after the search.
5. **Pacing:** the AI "thinks" for 0.6–1.2 s (wall clock), then animates its aim from the current angle to the target angle over 0.5 s, so the player can read it.
6. **Cost:** the search runs about 600–800 short simulations, each ending at its first impact. That is budgeted at under 40 ms on desktop and is split across frames with a generator, so the UI never hitches.

## 9. Input
Input comes from `games/Cart Racing/src/js/ui/input.js` (keyboard, gamepad and touch latching, read once per frame).

| Action | Mouse | Touch | Keyboard | Gamepad |
|---|---|---|---|---|
| Aim (angle + power) | Drag back from the squirrel (slingshot pull; the length is the power) | Same drag (`pointerup` releases) | ←/→ angle 1° (Shift 5°), ↑/↓ power 1% (Shift 5%) | Left stick |
| Throw | Release the drag, or the Throw button | Release, or the Throw button | Space / Enter | A |
| Ability | Click anywhere in flight | Tap anywhere | Space | A |
| Choose nut | Nut bar click | Nut bar tap | 1–7, Q/E cycle | LB/RB |
| Scamper | Click a highlighted perch | Tap a perch | A/D along the graph, W/S up and down the trunk | D-pad |
| Camera | Wheel zoom to point, right-drag pan | Pinch, two-finger pan | Z/X zoom, C recentre | Right stick |
| Pause | Pause button | Pause button | Esc / P | Start |

- Act on `pointerup` for touch and ignore the synthetic click that follows (LESSONS).
- Long-press and text-selection guards are copied from mahjong.

## 10. Rendering (Canvas2D, layers back to front)
1. **Sky:** a gradient per time of day, with sun or moon and clouds (cosmetic `fx` stream).
2. **Far backdrop** (parallax 0.25): the painted ridges.
3. **Row backdrop** (parallax 0.55): a painted panorama of that level's stretch of Bathhouse Row.
   - Lamp glows on night levels are drawn in code over the painting.
   - The vector fallback `?art=0` draws skyline polygons from the town-content recipes.
4. **Steam column:** soft translucent curls in the `thermal-water` palette. They are cosmetic; their strength mirrors `steam.lift`.
5. **Terrain:** an offscreen canvas at world resolution ÷ 2, filled once per level with a painted ground texture pattern plus code-drawn grass edges and rocks, and carved with `destination-out`. It is drawn with one `drawImage`.
6. **Trees:**
   - Code-drawn so branches can break: tapered bark strokes, and canopy clusters in season colours.
   - Static trees are cached to a sprite per tree and redrawn only when a branch breaks.
7. **Squirrels:** Blender-rendered sprite atlas frames (idle, scamper, aim, throw, hit, tumble, cheer, for each family and accessory). They sit flush in the scene with only their thin baked ink line, like the trees (no extra halo). Team badges and a name and grip pill sit above each squirrel.
   - **Birds** are Blender sprites in the same toon look (`art-src/blender/scripts/bird.py`, `assets/birds.webp`): six flap frames and a glide frame per species, drawn so the body is `2.2 × r` long. `?art=0` falls back to code-drawn silhouettes.
8. **Nuts and FX:** nuts drawn in code (small, crisp, rotating), plus leaf bursts, dust, wood chips and dizzy stars.
9. **Aim guide:** dots along the first 35% (easy), 20% (medium) or 0% (hard) of the predicted arc. The preview uses the same integrator, with wind on easy (a kid-friendly option).
10. **HUD and DOM screens** sit in the DOM over the canvas.

**Camera:**
- `{x, y, zoom}` with a lerp follow (0.12 per frame at 60 fps, frame-rate corrected).
- Zoom-to-point keeps the world point under the cursor fixed.
- **Zoom range:**
  - Out to about twice the world's width (`max(0.5 × fit-width, min(fit-width, vh/2600))`). On phones this stays at the whole world.
  - In to `clamp(2 × fit-width, 1.0, 1.25)`.
  - Past the world's edges, painted aprons carry the ridges and distant woods 1,200 units each side (visual only). The forest band widens, and the painting cross-fades to an arch-feathered copy, so no panel edge shows.
- Modes:
  - `overview`: fits both families
  - `aim`: the active squirrel plus its throwing arc
  - `follow`: the nut
  - `impact`: holds 0.6 s
- **Portrait phones:**
  - The aim camera zooms to the active squirrel.
  - A **mini-map strip** at the top shows both mountains, every squirrel as a team shape (▲ Tails, ● Rustlers), and the nut.
  - An edge arrow points to the target.

Caches are rebuilt only on size or DPR change. There is no per-frame `shadowBlur` or `imageSmoothingQuality = 'high'` (LESSONS).

## 11. Audio
- WebAudio synthesis only, adapted from `games/Cart Racing/src/js/ui/audio.js`: master, music and SFX buses, and a step sequencer.
- **Music:** a gentle banjo-and-piano ragtime loop per mood (day, dusk, night, victory).
- **SFX:** ZzFX-style parameter sets (MIT, credited) for throw whoosh, nut pops by kind, branch crack, leaf rustle, steam hiss, a squirrel chitter per family, cheer, and UI ticks.
- It starts on first input, is quiet by default, and can be muted.

## 12. Save format
- Key `hsg-furious-squirrels-v1`: one versioned JSON object, wrapped in try/catch with an in-memory fallback. Copied from Tub Rally's `save.js`.
- Fields:
  - `settings` {sound, music, volume, reducedMotion, aimGuide, turnTimer, hudScale, keys}
  - `story` {unlocked: n, stars: {levelId: 0–3}, nuts: [...]}
  - `quick` {last setup, including `birds`: off | some | lots}
  - `stats` {battles, wins, kos, bestShot}
  - optional `resume`: the `battle` object, saved at the start of each turn, with `levelRev` (dropped when the level's layout revision changes)

## 13. `window.__game` hooks
The shared contract (`shared/test-harness/README.md`), all JSON-serializable:
- `seed(n)`, `getState()`, `setState({settings, battle-patch})`.
- `isIdle()`: ready, no assets loading, no flight, scampering, falling or transitions. Ambient steam is ignored.
- `step(n)`, `pause()`, `resume()`.
- `scene('title'|'story'|'quick'|'practice'|'game'|'shop'|'settings'|'help'|'results')`.
- `newGame({mode, levelId, difficulty, teamSize, rounds, wind, steam, seed})`.

**`act(name, …args)`:**

| Verb | Arguments | What it does |
|---|---|---|
| `aim` | `{angle, power}` | Sets the aim |
| `fire` | `{nut, angle, power, tapAt?}` | Throws now; `tapAt` is the sim step of the ability |
| `tap` | | Triggers the ability now |
| `skipFlight` | | Runs the sim until settled |
| `move` | `{toNode}` or `{dx}` | Scampers |
| `perches` | | Lists reachable nodes |
| `buyNut` | `kind` | Buys one special |
| `setWind` | `w` | Overrides this turn's wind |
| `setGrip` | `id, v` | Sets a squirrel's grip |
| `aiTurn` | | Lets the AI play the current turn |
| `aiPlan` | | Returns the AI's chosen shot without firing |
| `hash` | | Returns `hashBattle()` |
| `clock` | `ms\|null` | Freezes or releases the render clock |
| `cam` | `mode\|{x,y,zoom}` | Sets the camera |
| `hud` | `bool` | Shows or hides the HUD |
| `endRound` | `team` | Ends the round with that team winning |
| `menu` | `id` | Opens a menu |
| `fxCount` | | Counts live particles |

`getState()` returns:
```
{ scene, screen, paused, ready, loading,
  battle: { phase, round, roundWins, turn, wind, steam, teams: [{id, acorns, inventory, alive}],
            squirrels: [{id, team, x, y, grip, out, perch}], branches: {total, broken},
            nuts: [{kind, x, y, state}], craters: n, events: [...last 20], hash },
  camera: {x, y, zoom, mode}, settings, save: {story, stats}, render: {w, h, dpr, artLoaded} }
```

## 14. Changes made during balancing and review (shipped values)
- **Fairness:** levels mirror the near-valley slopes, trees and spawn pairs across the valley; beyond West Mountain's crest distance, Hot Springs Mountain keeps its real rise to the tower. Squirrels start on the highest primary branches. Every level is re-baked until `tools/check-levels.mjs` proves every starting squirrel has a hitting acorn throw at wind −1, 0 and +1.
- **Second mover:** the family that throws second each round gets a bonus Black Walnut.
- **Steam:** reaches 900 units above the floor, column 260 wide, lift off/weak/on/strong = 0/420/680/980, square-root fade.
- **Nut table (shipped):** acorn 44/32 at 56; trio 18/14 at 34 each; pecan 48/28 at 46 (wood 60); walnut 38/44 at 100 (wood 55 in 100); hickory 46/30 at 52 (hard shell); sweetgum ball 46/30 at 56; hedge apple 42/22 at 42, wind ×0.3.
- **AI noise (angle σ / power σ):** easy 3.8° / 4.5%, medium 2.0° / 2.2%, hard 0.6° / 0.7%; trick nuts are planned inside the search (trio splits ~280 units short, the dart dashes when heading at the target, the gumball drops over it).
- **Squirrel hit radius** 22 units; the sprite is drawn 1.45–1.55× the hit body.
- **Valley floor** flat for 110 units each side with a smooth fillet; leaf piles on the floor at each foot.

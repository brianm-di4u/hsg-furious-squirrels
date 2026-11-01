# Furious Squirrels: code-sample survey (step B)

Surveyed 2026-11-01. Commits were read from the GitHub REST API (`/commits`, `/branches`, `/git/trees`)
and core files were fetched at the pinned commit into `reference-samples/<name>/` (gitignored, read
only, never executed). Nothing in this file is copied into the game yet. Where code is adapted
later, the attribution comment in "Attribution rules" below is required at the point it lands.

Brief rules applied: adapt only MIT/BSD/ISC/Apache-2.0/Unlicense/CC0 code; GPL, unlicensed or
unclear-license code is reference only; never borrow code from clones of commercial titles; no
third-party art or audio at all (all art is procedural, all audio is WebAudio synthesis).

---

## 1. Squeak & Destroy (lospolosadwords-dev/squeak-and-destroy)

- **URL:** https://github.com/lospolosadwords-dev/squeak-and-destroy
- **License:** code is MIT (`LICENSE`, "Copyright (c) 2026 Los Polos Amigos Kft."). `LICENSE-ASSETS.md`:
  original assets *and every code-drawn graphic* (animal bodies, terrain painting, particles, HUD) are
  CC BY-NC 4.0; fonts/icons/music/SFX are third-party (OFL, CC0, CC BY 3.0/4.0, see `ATTRIBUTIONS.md`).
  The drawing *code* is MIT, but the look it produces is CC BY-NC, so we copy no art, audio or visual
  design from it.
- **Commit:** `8121f1da74d6e7e7e588a24ffab1497f920708c9`, 2026-08-01 (HEAD of default branch).
- **Files read:** `js/terrain.js` (1622 lines), `js/ai.js` (1054), `js/weapons.js` (3382, the projectile
  step and `predict()`), `js/core.js` (camera, loop), `docs/ARCHITECTURE.md`.
- **Does well:**
  - Terrain is a bitmap mask (offscreen canvas, alpha > 128 = solid) with a separate cached *painted*
    canvas; `destroy()` carves with `destination-out`, then refreshes only the dirty rect of the cached
    `ImageData` and repaints only that rect (`refreshRect`/`paintRect`). Keeps 40+ craters at 60 fps.
  - Craters get a few deterministic "lobes" seeded from `(x,y,r)` so edges look organic but replay
    identically.
  - `collideCircle(x,y,r)` samples 16 points on the circle rim, sums the inward directions of solid
    samples, normalises to a surface normal, and estimates depth as `hits/16 * r`. Cheap and robust.
  - Single damage pipeline (`CA.explode`) that carves terrain, applies falloff damage and knockback,
    and shakes the camera, so terrain and units never desync.
  - Swept terrain check for impact projectiles: the move from the previous position is split into
    ~3 px sub-steps and the shell is backed off one sub-step on contact (weapons.js ~L2815).
  - AI `solveShot()`: coarse grid over angle x power (x both facings on normal/hard), scored by
    simulated *outcome* (foe damage - 2.4 x self damage - 0.14 x miss distance, with graze credit
    from closest approach), then a bounded 5x5 / 7x7 local refinement. Per-difficulty aim error
    (about 0.13 / 0.05 / 0.011 rad angle, 0.13 / 0.028 / 0.012 power) applied *after* solving.
  - Self-frag avoidance and "don't waste the turn" fallback to a weapon whose solved shot connects.
  - Camera: fixed 60 Hz accumulator; `lerp` of position (0.08) and zoom (0.09) toward targets;
    follows the live projectile, lingers ~1 s on the impact point, kill-cam; `zoomBy(factor, sx, sy)`
    keeps the world point under the cursor fixed (`cam = before - screen/zoom`).
- **Does badly (for us):**
  - Three separate trajectory integrators (`weapons.js` step, `Weapons.predict()`, `ai.js simulate()`)
    kept in sync by hand with per-weapon speed/gravity scale tables; the comments record several AI
    mis-aim bugs caused by drift. The AI sim also uses point checks with no sweep, unlike the real
    projectile.
  - AI noise and many gameplay rolls use `Math.random()`; not reproducible from a seed.
  - Collision reads RGBA `ImageData` (4 bytes/px, one material); bedrock is a second canvas mask.
    No per-pixel material ids (we need dirt / rock / wood branch).
  - Monolithic: 63 weapons in one 3.4k-line file with per-kind special cases; everything hangs off a
    global `CA` with load-order dependencies. Not liftable as modules.
  - Self-described "Worms-style" game with genre-standard weapon names (bazooka, airstrike, ...).
    We take only generic algorithms, not its roster, names, rules or tuning.
- **Verdict: adapt with attribution, narrowly.** Small generic routines only (rim-sampled normal,
  dirty-rect repaint, zoom-to-point math, grid+refine solver shape), rewritten as ES modules on our
  own data model. No art, audio, drawing code, weapon list or numbers.

## 2. artillery-game (sergiss/artillery-game)

- **URL:** https://github.com/sergiss/artillery-game
- **License:** MIT (`LICENSE`, "Copyright (c) 2022 Sergio Soriano"; API reports `MIT`).
- **Commit:** `f729c750acd079009e615e96cefc1ca43cfa1676`, 2022-03-05 (HEAD of `master`; last push
  2022-03-12).
- **Files read:** `resources/js/script.js` (376 lines, the whole game), `resources/js/vec2.js`, `README.md`.
- **Does well:**
  - The AI's `predict()` runs the *exact same* `updateBullet()` the live shot uses (gravity, wind,
    terrain, target), so prediction cannot drift from reality. This is the key idea we keep.
  - Very small and readable: random midpoint-ish terrain, circle carve over the pixel buffer, turn
    switch with re-rolled wind.
- **Does badly (for us):**
  - AI is pure random sampling (`n = 1 + enemy.score` tries), so difficulty is a rubber band on
    score, not a skill setting; no bracketing, no outcome scoring, no self-damage check.
  - Terrain material is identified by pixel colour (`R === 90`), the world *is* the display
    `ImageData`, and Y is flipped in `toImageDataIndex`; carving recolours pixels rather than
    clearing a mask.
  - No swept collision: 4 px box test after a full-velocity step (up to ~20 px/frame) can tunnel
    through thin ground. Variable-rate `requestAnimationFrame` step, no fixed timestep.
  - `predict()` is an unbounded `for(;;)` loop (terminates only because gravity eventually drops
    the shot off-screen).
- **Verdict: ideas only.** Nothing worth copying line for line; we keep the "AI uses the game's own
  simulator" principle.

## 3. Tuts+ "Coding Destructible Pixel Terrain: How to Make Everything Explode" (Jared Counts)

- **URL:** https://code.tutsplus.com/coding-destructible-pixel-terrain-how-to-make-everything-explode--gamedev-45t
- **License:** none stated for the article, the inline code or the downloadable attachment; the page
  only carries the Envato footer and links to Envato's general terms. Treated as unclear.
- **Version:** article dated 2012-07-27 (no repository, no commit). Code is Processing (Java).
- **Does well:**
  - Clear model: terrain is one image/array, opaque = solid, index `x + y*width`.
  - Surface normal by averaging: sum `(point - solidPixel)` over a small square (about -3..3) around
    the contact, then normalise; larger windows give smoother normals.
  - Swept collision for fast pixels: walk a Bresenham line from previous to current position and stop
    at the first solid pixel, with a fixed 16 ms Euler step.
  - Explosions turn removed pixels into "dynamic pixels" that fly out and either stick (slow) or
    bounce (fast); notes on 2x2 blocks, object reuse and primitive arrays.
- **Does badly (for us):** Processing/Java, loosely written pseudocode (loop and vector variables
  share names), single material, no rendering cache, no AI or turn structure.
- **Verdict: reference only.** Read for the technique; write our own code.

## 4. ZzFX (KilledByAPixel/ZzFX)

- **URL:** https://github.com/KilledByAPixel/ZzFX
- **License:** MIT (`LICENSE` and the header of `ZzFX.js`, "Copyright (c) 2019 Frank Force").
- **Commit / version:** `aab7e2b6b9086746b6e55fab75c75ce03e716c49`, 2026-10-01 (HEAD); `ZzFX.js`
  self-identifies as v1.4.0.
- **Files read:** `ZzFX.js` (260 lines, ES module), `ZzFXMicro.js`, `README.md`.
- **Does well:**
  - One function `buildSamples(volume, randomness, frequency, attack, sustain, release, shape,
    shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush,
    delay, sustainVolume, decay, tremolo, filter)` renders a Float32Array: 6 wave shapes, ADSR, pitch
    slide/jump, FM, noise, bit-crush, echo, tremolo, biquad LP/HP. A sound is a short number array,
    ideal for a single inlined HTML file with zero assets.
  - `ZZFXSound` pre-renders once and replays with pitch randomness via `playbackRate`; stereo pan.
- **Does badly (for us):**
  - `audioContext: new AudioContext` is created at module load, before any user gesture (autoplay
    policy warnings; awkward in headless tests).
  - Connects straight to `destination`: no master bus, compressor/limiter or mute/volume setting.
  - Uses `Math.random()` for per-play variation (acceptable for audio, but keep it out of game RNG).
- **Verdict: adapt with attribution.** Port `buildSamples` and the cached-sound idea into
  `src/audio/sfx.js`, with a lazy context on first gesture, a master gain + `DynamicsCompressor`,
  and a settings-driven volume. Keep the MIT notice in the file.

## 5. Worms-Armageddon-HTML5-Clone (CiaranMcCann)

- **URL:** https://github.com/CiaranMcCann/Worms-Armageddon-HTML5-Clone
- **License:** Apache-2.0 (`LICENSE.txt`, "Copyright 2012 - 2013 and Ciarán McCann"). The README
  describes it as a recreation of Team17's Worms Armageddon and does not state where `data/images`
  and `data/sounds` come from.
- **Commit:** `6b07e61b9bd2e7db361d5babe8a1b9ff1d2b2a50`, 2016-03-22 (HEAD of `master`).
- **Files read:** `src/system/Camera.ts`, `src/environment/Terrain.ts`, `README.md`, `LICENSE.txt`.
- **Notes:** TypeScript + Box2DWeb. Terrain is a canvas buffer carved with `destination-out` in
  batches, then rebuilt into Box2D static boxes per 5 px row band (full-width band, full-buffer
  `getImageData` per rebuild). `Camera.ts` is linear pan only: no follow, no easing, no zoom.
- **Verdict: reference only.** The license would allow adaptation, but the brief bars borrowing code
  from clones of commercial titles, asset provenance is unclear, and the physics-engine approach
  (rebuilding rigid bodies after each blast) is heavier than we need. It confirmed nothing we lack.

Camera zoom-to-point needed no extra sample: Squeak & Destroy's `zoomBy` shows the standard
formula, which we write ourselves.

---

## Side-by-side review

| Concern | Squeak & Destroy | artillery-game | Tuts+ article | ZzFX | Worms clone |
|---|---|---|---|---|---|
| Terrain store | canvas alpha mask + cached ImageData, dirty rects | display ImageData, colour = material | 1-D pixel array | n/a | canvas + Box2D boxes |
| Carving | `destination-out` + lobes, partial repaint | per-pixel recolour | pixels to dynamic particles | n/a | batched `destination-out` |
| Normal | 16 rim samples, averaged | none | averaged solid pixels in a window | n/a | Box2D contacts |
| Projectile collision | 3 px sub-steps (impact shells only) | point/box after full step | Bresenham line prev to cur | n/a | Box2D |
| Timestep | fixed 60 Hz accumulator | rAF, variable | fixed 16 ms | n/a | not checked |
| AI aiming | grid + local refine, outcome score, noise per level | random tries, same simulator | none | n/a | none found |
| AI sim = game sim | no (3 integrators) | yes | n/a | n/a | n/a |
| Determinism | `Math.random` in AI/FX | `Math.random` | n/a | `Math.random` per play | not checked |
| Camera | lerp follow, impact hold, zoom-to-point | none | none | n/a | linear pan |
| Audio | sample bank + synth fallback | none | none | parameterised synth | sample files |
| License fit | MIT code, NC art (avoid) | MIT | unclear | MIT | Apache-2.0, but a clone |

Takeaway: Squeak & Destroy is the strongest overall reference but repeats one mistake we must avoid
(separate AI integrators). artillery-game is weak overall but gets that exact point right. The Tuts+
article supplies the cleanest normal and swept-line descriptions. ZzFX is the only sample we intend to
port as code.

## Foundation we take

1. **Material-mask terrain** (Tuts+ model, Squeak dirty-rect idea). World = `Uint8Array(W*H)` of
   material ids (0 air, 1 dirt, 2 rock/bedrock, 3 wood branch, ...), one byte per pixel, indexed
   `x + y*W`, seeded generation. Circle carving clears ids in the disc's bounding box (rock resists or
   is immune; wood branch pixels are tagged with a branch id so a broken branch can detach). A cached
   painted canvas is re-rendered only for the dirty rect after each carve.
2. **Surface normal by averaging** (Tuts+ window average, Squeak rim sampling). Sum vectors from
   solid pixels to the contact point over a small window (or rim samples), normalise, fall back to
   `(0,-1)`. Used for bounce, roll (heavy nut), and squirrel footing.
3. **Swept-segment collision per fixed step** (Tuts+ Bresenham, Squeak sub-steps). Fixed 60 Hz
   accumulator; each step walks the segment from previous to new position in <= 1-2 px increments
   against the mask for *every* projectile type, including bouncers, and returns the first contact
   point plus normal. No tunnelling at any speed.
4. **One simulator for game and AI** (artillery-game principle, Squeak solver shape). The AI calls the
   same pure `stepProjectile(state, nut, wind)` on a cloned light state, with a step cap. Search:
   coarse angle grid, then for each angle bracket and bisect power on signed miss distance
   (over/undershoot), then a small local refine; score by simulated outcome (damage to foes, heavy
   self-damage penalty, distance). Difficulty adds angle/power noise drawn from the *seeded* game RNG,
   plus a smaller grid on easy.
5. **ZzFX-style parameterised SFX** (ZzFX port). Every sound is a parameter array rendered once into
   an `AudioBuffer`; lazy `AudioContext` on first gesture; master gain + compressor; mute/volume in
   settings.
6. **Camera lerp + zoom-to-point** (Squeak core.js idea). Camera `{x, y, zoom, targetX, targetY,
   targetZoom}` eased by lerp each fixed step; follow the live nut, hold on impact, return to the
   active squirrel; wheel/pinch zoom keeps the world point under the cursor fixed
   (`cam = worldBefore - screen/zoom`); shake suppressed under `prefers-reduced-motion`.
7. **Single damage pipeline** (Squeak `CA.explode` idea). One `explode(x, y, r, dmg, knock)` carves
   terrain, breaks branches, damages and knocks squirrels, spawns FX and camera shake.

## Attribution rules

- Where ported ZzFX code lands (`src/audio/sfx.js` or equivalent), keep its MIT header and add:
  `// Adapted from ZzFX v1.4.0 by Frank Force (MIT), github.com/KilledByAPixel/ZzFX @ aab7e2b`
- If any Squeak & Destroy routine is adapted rather than rewritten from the idea, add:
  `// Adapted from Squeak & Destroy (MIT, (c) 2026 Los Polos Amigos Kft.), js/<file>.js @ 8121f1d`
  and never reuse its art, audio, drawing code or weapon definitions (CC BY-NC / third-party).
- artillery-game, the Tuts+ article and the Worms clone contribute ideas only: no code, no comment
  needed, credited here.
- List every adapted source in `REPORT.md` and in the game's credits/about screen.

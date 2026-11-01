# Furious Squirrels: development plan

## Milestones
| Milestone | Scope | Exit test |
|---|---|---|
| **M0 Foundation and look pilot** | Skeleton, shared copy, `package.json`, sim core (terrain mask, ballistics, trees, levels), Canvas renderer and camera, gray-box level from the valley profile, placeholder squirrels, title and HUD shell, hooks, saves. Look pilot: Blender valley block-out, one Codex backdrop pilot (middle stretch, summer day), one Blender squirrel turnaround. | `run.mjs . --milestone m0` and `--file-url` green; shots `m0-title`, `m0-battle`, `m0-flight`, `m0-crater`; Node determinism test |
| **M1 Core loop and feel** | Aim (drag, keys, touch), throw, wind, steam, craters, branches breaking, perch graph and scamper, grip and knockouts, turns, settle, camera modes, acorn only; one full round vs. easy AI | Full round to results in the browser; real-mouse aim test; touch test with `holdEndMs`; Node = browser hash |
| **M2 Battle systems + site preview** | All 7 nuts, rounds and shop, AI at 3 difficulties, saves and resume, gamepad and touch polish, `balance.mjs` v1, `check-levels.mjs`; then `hsg-furious-squirrels` repo and a "construction" site preview (with your OK) | Balance targets met; per-nut tests and shots; shop caps; AI bands |
| **M3 Content** | 12 Story levels, Story map, Quick Battle setup, Practice range; full Codex backdrop set; Blender squirrel cast (2 families × 4, 7 animations), Field Notes | Every level passes `check-levels` and balance; start shot per level; Story progress survives reload |
| **M4 Polish** | Synth music and SFX, juice, tutorial, accessibility pass, `check-facts`, then the visual review loop (`reviews/PROTOCOL.md`; stop after 3 loops with no new best, all gates met, or loop 8) | Contrast clean; reduced-motion shots; review gates or the stop rule |
| **M5 Release** | Performance and size budgets, full test campaign (`TEST-CAMPAIGN.md`), REPORT.md, sync to `repos/hsg-furious-squirrels`, tag `v1.0.0`, site PR, merge and live check (with your OK at push and merge) | `--milestone final` and `--file-url` green; live page plays |

## Task breakdown
- **M0:**
  - `shared/` copy (`tools/inline.mjs`, `test-harness/`)
  - `src/index.html` and `src/styles/main.css` (tokens inline)
  - `src/js/{main,hooks,save,rng}.js`
  - `src/js/sim/{const,terrain,trees,ballistics,nuts,battle,levels}.js`
  - `src/js/gfx/{renderer,camera,terrainfx,trees,squirrels,backdrop}.js`
  - `src/js/ui/{screens,hud,input}.js`
  - `levels/gray.json`
  - `tools/levels/bake.mjs` (profile → level)
  - `tests/m0.test.mjs`
  - Blender `art-src/blender/scripts/{valley_blockout,squirrel}.py`
  - Codex pilot prompt in `art-src/codex/PROMPTS-pilot.md`
- **M1:** aiming and throw UI, the full turn state machine, perch graph and scamper UI, settle logic, camera modes, `sim/ai.js` (easy), `tests/m1.test.mjs` (mechanics in Node and the browser).
- **M2:**
  - nut abilities
  - shop screen
  - AI medium and hard (bracketing, nut choice, movement)
  - `tools/balance.mjs` and `balance-targets.json`
  - `tools/check-levels.mjs`
  - gamepad
  - `tests/m2.test.mjs`, `tests/11-statefuzz.test.mjs`, `tests/12-interaction.test.mjs`
  - `tools/sync-repo.mjs`, the site entry
- **M3:**
  - `levels/story-01..12.json` from `tools/levels/bake.mjs`
  - story map
  - quick setup
  - practice
  - Codex batches (`PROMPTS-batch*.md`, `art.json`, `art-pack`)
  - Blender cast and sprite atlases (`tools/pack-sprites.mjs`)
  - Field Notes data build (`tools/build-facts.mjs`)
  - `tests/m3.test.mjs`
- **M4:**
  - `ui/audio.js` (music, SFX)
  - FX juice
  - tutorial
  - accessibility (aria-live, text scale, reduced motion)
  - `tools/check-facts.mjs`
  - `reviews/` and `tools/review-*.mjs`
  - `tests/m4.test.mjs`
- **M5:**
  - perf governor (fx caps)
  - `tests/m5.test.mjs` budgets
  - `TEST-CAMPAIGN.md`
  - `REPORT.md`
  - release steps

## `window.__game` hook spec
See MECHANICS.md §13.

## Test matrix
| AC | Test (file › name) | Screenshots (desktop + mobile) |
|---|---|---|
| AC1 | m0 › boots to title; m0 › file:// boot | m0-title, m0-fileurl |
| AC2 | m0 › title buttons; m2 › menus keyboard-only | m0-title, m2-menus |
| AC3 | m0 › battle renders | m0-battle |
| AC4 | m3 › backdrop order per stretch | m3-row-north, m3-row-middle, m3-row-south |
| AC5 | m1 › mouse drag aim and throw; m1 › keyboard aim; m1 › touch aim (holdEndMs); m2 › gamepad (mocked) | m1-aim, m1-aim-touch |
| AC6 | m0 › determinism (node); m1 › Node = browser hash | m0-flight |
| AC7 | m1 › wind bends the arc | m1-wind |
| AC8 | m1 › steam lifts | m1-steam |
| AC9 | m0 › crater mask and visuals; m1 › no tunnelling (node fuzz) | m0-crater |
| AC10 | m1 › branch breaks and drops squirrel | m1-branch-break |
| AC11 | m1 › scamper within stamina, not across the valley | m1-scamper |
| AC12 | m1 › grip and KO; m1 › round end | m1-ko, m1-round-end |
| AC13 | m2 › each nut | m2-nut-<kind> |
| AC14 | m2 › rounds and shop | m2-shop |
| AC15 | m2 › AI bands (node, slow) | — |
| AC16 | m2 › balance (node, slow) | — |
| AC17 | m3 › check-levels (node) | — |
| AC18 | m3 › story flow and reload | m3-story-map, m3-level-NN |
| AC19 | m3 › quick setup applies | m3-quick |
| AC20 | m3 › practice | m3-practice |
| AC21 | m3 › results and Field Notes; m4 › check-facts (node) | m3-results |
| AC22 | m2 › pause, settings, help | m2-pause, m2-settings, m2-help |
| AC23 | m4 › audio graph starts on input and toggles | — |
| AC24 | m4 › contrast; reduced motion; text 150%; aria-live | m4-reduced, m4-text150 |
| AC25 | m2 › touch layout and targets; m4 › pinch | m2-touch |
| AC26 | m2 › save, resume, storage blocked | — |
| AC27 | m5 › budgets | — |
| AC28 | m3 › art manifest; fallback `?art=0`; idle while loading | m3-art-fallback |
| AC29 | review loop (recorded below) | review sheets |
| AC30 | m4 › credits | m4-credits |

## Defect log
| # | Found | Description | Status |
|---|---|---|---|
| D1 | M0 | Perspective street backdrop left the Row tiny and hidden behind the valley slopes | fixed: frontal Row panorama (the view from West Mountain), street line 300 units above the valley floor, parallax |
| D2 | M0 | Backdrop edge fades drew as pale vertical bands | fixed: edges feathered inside the panel canvas |
| D3 | M0 | Camera target outside the clamp kept the camera "moving" forever, so `isIdle()` never settled | fixed: target clamped before the lerp |
| D4 | M0 | Phone HUD overflowed (Throw cut off) | fixed: stacked readout and compact button row under 700 px |
| D5 | M1 | Nuts hit the thrower's own (or a neighbouring family) tree in the first frames | fixed: a nut ignores its own family's trees for 0.6 s |
| D6 | M1 | Steam updraft too low and too narrow to touch real cross-valley throws | fixed: reach 900 units, width 260, lift 420/680/980, sqrt fade |
| D7 | M1 | A stale AI plan blocked human input after the turn changed; moves and knockouts outside a sim step were never drained | fixed: plans are tied to turn and sim; events drained every frame |
| D8 | M1 | Phone aim camera put the active squirrel at the screen edge | fixed: offset 150 units ahead instead of 260 |
| D9 | M2 | Rustlers won almost every AI pairing: generated tree layouts sheltered the steep side | fixed: near-valley slopes, trees and spawn pairs mirrored; own trees never block their family's nuts; squirrels start on treetop branches |
| D10 | M2 | Seventh nut cut off on phones | fixed: compact 44 px nut buttons under 700 px |
| D11 | M2 | Nuts hard to follow at overview zoom | fixed: drawn 1.6x their hit radius, at least 5 px |
| D12 | M2 | One Fall on the Promenade spawn had no hitting throw | fixed: spawn pairs ordered by a two-sided reachability check (tools/check-levels.mjs) |
| D13 | M2 | Rounds ran 55+ throws: hit rates low, AI ignored its trick nuts, grip too deep | fixed: AI plans taps (trio, dart, gumball) inside the search, tighter aim noise, grip 64, splash zones widened, second mover gets a walnut; measured 25 throws per 3 v 3 round |
| D14 | M3 | Plain brown foreground ground dominated the screen | fixed: seasonal forest-floor band, roots, stones, leaf litter; camera frames less dirt |
| D15 | M4 review | Phones framed the rival's mountain at the human's turn; minimap markers clipped; status text truncated | fixed: aim framing on the active squirrel, edge arrow and target inset, short phone copy, markers inset |
| D16 | M4 review | Valley floor read as a gray placeholder block; V-shaped trench | fixed: tufa basin and steaming pool, rounded U floor (levels re-proven), asphalt under the painting |
| D17 | M4 review | Painted backdrop read as a framed panel with seams at the edges | fixed: wide forest band behind, the painting sized past the view and clamped in screen space |
| D18 | M4 review | Hits, bursts and knockouts barely read (thin rings, tiny particles at overview zoom) | fixed: flash, popping numbers, leaf and shard bursts, hitstop, tumble spin and puffs, camera follows the knockout, minimum on-screen particle size |
| D19 | M4 review | Squirrel outlines bled between atlas frames (stray marks); squirrels looked like white stickers | fixed: per-cell outline build, warm-brown outline; four outfit variants per family and distinct family silhouettes |
| D20 | M4 review | Turn prompt and active buttons during the knockout camera | fixed: "Knockout!" label, Throw/Move disabled until the camera returns |
| D21 | Final sheets | At 150% text the nut-bar labels ran into each other | fixed: nut-bar labels stay at base size (the readout and aria-label carry the scaled full name) |

## Visual review (M4)
Recorded per loop in `reviews/HISTORY.md`, with each loop's critiques and `CHANGES.md` in `reviews/loop-N/`.

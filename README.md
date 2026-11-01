# Furious Squirrels

A wholesome, turn-based nut-throwing duel across the real valley of Hot Springs, Arkansas. The **West Ridge
Rustlers** (fox squirrels on West Mountain) and the **Tower Top Tails** (gray squirrels on Hot Springs Mountain)
lob native Arkansas nuts at each other over Bathhouse Row, trying to shake each other's grip loose and tumble the
rivals out of their trees and into the leaf piles. Nobody is ever hurt. Part of the open-source (MIT)
**Hot Springs Games** collection.

The families, the feud, the acorn shop and the steam updraft are game fiction; the bathhouses (in their true order),
the valley's shape, the trees, the nuts and the squirrels are real, and every fact shown in Field Notes has a source.

## Play
Open `index.html` (works from `file://` too).
- **Aim:** drag back from anywhere, like a slingshot (or ←/→ angle, ↑/↓ power, Shift for big steps).
- **Throw:** let go, press Throw, or Space/Enter. **Trick:** tap or press Space once while a special nut flies.
- **Move:** press Move (M), then a glowing perch; A/D/W/S scamper by keyboard. **Pause:** Esc/P.
- Gamepad: left stick aims, A throws and tricks, LB/RB pick nuts, Start pauses. Touch: drag, tap, pinch to zoom.

Modes: **Story** (12 battles across the seasons, unlocking six special nuts), **Quick Battle** (any battlefield,
family size, rounds, wind, steam, nut set and rival skill) and **Practice Range**.

The seven nuts: Acorn, Chinquapin Trio (splits), Pecan Dart (dashes), Black Walnut Burst (big pop), Hickory Hook
(boomerang), Sweetgum Drop (drops a gumball), Hedge Apple (heavy, rolls).

## Build
```bash
npm run setup                     # once: test-harness dependencies + Chromium
node tools/geo/valley-profile.mjs # USGS DEM cross-sections → research/valley-profile.json (needs Tub Rally's DEM tiles)
npm run levels                    # research/valley-profile.json → levels/*.json (each layout proven by the checker)
npm run check                     # every squirrel on every level has a hitting throw at every wind
npm run balance                   # AI-vs-AI battles against tools/balance-targets.json
node tools/build-facts.mjs        # Field Notes facts from the audited trivia bank + research
node tools/check-facts.mjs        # every fact is confirmed and sourced
node shared/test-harness/art-pack.mjs .   # Codex paintings (art-src/codex, git-ignored) → assets/bd-*.webp
node tools/pack-sprites.mjs       # Blender squirrel frames (art-src/sprites) → assets/sq-t*.webp
npm run build                     # src/ → index.html
npm test                          # Playwright tests (--milestone final --slow for everything)
```
Blender scripts: `art-src/blender/scripts/row_guide.py` (backdrop composition guides) and `squirrel.py` (the cast);
see `art-src/blender/README.md` and `README-squirrels.md`. Codex prompts: `art-src/codex/PROMPTS-*.md`.

Only `index.html` and `assets/` ship to the website.

## Layout
| Path | What |
|---|---|
| `src/js/sim/` | deterministic battle rules, terrain mask, trees and perches, nut flight, AI (no DOM; Node tools import it) |
| `src/js/gfx/` | Canvas2D renderer, camera, terrain, trees, squirrels, nuts, backdrop, FX |
| `src/js/ui/` | screens, HUD, audio |
| `levels/` | baked battlefields |
| `research/` | town content, squirrels and nuts, the valley profile |
| `tests/` | milestone tests m0–m4, review captures |
| `reviews/` | the visual review loop (rubric, protocol, briefs, loop records) |
| `PRD.md`, `MECHANICS.md`, `DEV-PLAN.md`, `SAMPLES.md`, `REPORT.md` | design, plan, results |

## Credits
Elevation: USGS 3D Elevation Program (public domain). Viewpoint and tower positions: © OpenStreetMap contributors
(ODbL). Sound effects synthesized after ZzFX by Frank Force (MIT). Backdrop paintings made for this game with Codex
from a Blender block-out; squirrels modelled in Blender. MIT licensed (see `LICENSE`).

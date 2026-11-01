# Furious Squirrels: product requirements

## 1. Vision
A sunny, silly, turn-based nut-throwing duel across the real valley of Hot Springs, Arkansas.
- The **Tower Top Tails** (gray squirrels) live on Hot Springs Mountain under the Mountain Tower. The **West Ridge Rustlers** (fox squirrels) live on West Mountain's east face.
- They lob native Arkansas nuts at each other, each nut with a trick of its own. A hit shakes a rival's grip until the rival tumbles, unhurt, into a leaf pile.
- Bathhouse Row steams away in the valley below, painted in its true order.
- Nobody is ever hurt, and every real fact is sourced.

**Pillars**
1. **Readable artillery.** Angle, power, wind and one steam updraft. Every shot is predictable enough to learn, and surprising enough to laugh at.
2. **Nuts with personality.** Seven nuts, each with one clear trick and a moment to use it.
3. **Real place, cartoon heart.** The real valley shape, the real Row and real trees and squirrels, with cheerful slapstick.
4. **Fair and kind.** Three AI levels that feel human, short turns, and no fail-state frustration.

**Target players:** families and kids aged 7 and up, plus casual players who loved classic tank duels. Sessions last 5–15 minutes. It runs on desktop and phones.

## 2. Modes
| Mode | Content |
|---|---|
| **Story: "The Valley Nut Feud"** | 12 battles (table §5), unlocking one nut every one or two battles. Earn 1–3 acorn stars per battle (win; win with no squirrel out; win within the par turns). |
| **Quick Battle** | Pick any unlocked level, family (Tails or Rustlers), family size 2–4, rounds 1/3/5, wind (off/light/normal/gusty), steam (off/on/strong), loadout (story unlocks or all nuts) and AI difficulty. |
| **Practice range** | Your family's mountain with target boards and practice dummies across the valley. Every nut, a full arc preview, adjustable wind, and no opponent. |

## 3. Rules (complete; numbers in MECHANICS.md)
- **Families and squirrels.**
  - Each family has 2–4 squirrels.
  - Each squirrel has a grip meter starting at 100.
  - Families alternate turns, and within a family the living squirrels take turns in order.
- **A turn** has three parts:
  1. *Scamper* (optional): move along branches, trunks and the slope of your own mountain, up to the stamina budget.
  2. *Aim:* choose a nut from the nut bar, then set angle and power.
  3. *Throw:* the nut flies under gravity, wind and the steam updraft. Tap once during flight to trigger its trick.
- **Wind** changes every turn and is shown as a flag, an arrow and a strength number from 0 to 10.
- **The Valley of Vapors updraft** is a column of thermal steam over the Row that lifts nuts passing through it. It is game fiction, labelled as such on the help screen.
- **Hits.**
  - A direct hit or a nearby splash lowers grip.
  - A strong knock can push a squirrel off its perch, so it drops to the perch below and loses a little more grip.
  - Nuts dig small craters in the dirt and crack branches. A broken branch falls, and anyone on it drops.
- **Out:** at 0 grip, a squirrel tumbles into the leaf pile at the foot of its mountain, with dizzy stars and a cheer. It is out for the round.
- **Rounds and battles:** a round ends when one family has no squirrels left. The battle is best of the chosen rounds. The terrain and trees reset between rounds.
- **Acorn shop:**
  - You earn acorns for hits, branch breaks, knockouts, rounds won and rounds played.
  - After each round, buy special nuts, up to 3 of each.
  - Plain acorns are unlimited.
- **The seven nuts:**

  | Nut | Trick |
  |---|---|
  | Acorn | Basic |
  | Chinquapin Trio | Tap: splits into three |
  | Pecan Dart | Tap: straight dash that zips through leaves and cracks wood |
  | Black Walnut Burst | Tap or impact: big pop that rattles nearby branches |
  | Hickory Hook | Tap: curls back like a boomerang |
  | Sweetgum Drop | Tap: drops a spiky gumball straight down |
  | Hedge Apple | Heavy, barely moved by wind, and rolls downhill on landing |

- **Optional turn timer:** off, 30 s or 60 s. When it runs out, the turn passes with no throw.

## 4. Hot Springs content map
See `research/town-content.md` for sources.

| Where | Content |
|---|---|
| Battlefield shape | The real battle line from the West Mountain Drive viewpoint to the Mountain Tower (`research/valley-profile.md`), stylized and compressed |
| Backdrop | Painted panoramas of Bathhouse Row in true north-to-south order (north, middle and south stretches), with the Grand Promenade, magnolias, five-globe lamp posts, steam and the Arlington or the Administration Building at the ends |
| Hot Springs Mountain | The Mountain Tower on the crest. Shortleaf pines, white and red oaks, and hickories |
| West Mountain | Oak–hickory–pine slope with the overlook switchback |
| Trees and nuts | Native species from `research/squirrels-and-nuts.md` |
| Seasons and lighting | Spring redbud and dogwood, summer green, fall colour, a light winter dusting (the town averages about 1.1 in of snow a year), dusk and night lamps |
| Field Notes card | After each battle, one sourced fact about the stretch of the Row on screen, or the nature of the level, with its source |
| Labels | "A made-up squirrel rivalry set in real Hot Springs" on the title and help; "game rules" marks the steam updraft and shop |

## 5. Story levels
| # | Name | Row stretch | Season and time | Family size | Steam | Wind | New nut | Par turns |
|---|---|---|---|---|---|---|---|---|
| 1 | Morning on the Row | Middle | Summer day | 2 vs 2 | off | light | (acorn; tutorial) | 8 |
| 2 | Under the Tower | North | Summer day | 2 vs 2 | weak | light | Chinquapin Trio | 9 |
| 3 | Dome at Dusk | Middle | Summer dusk | 3 vs 3 | on | normal | Pecan Dart | 10 |
| 4 | Redbud Ridge | South | Spring day | 3 vs 3 | on | normal | Hickory Hook | 10 |
| 5 | Valley of Vapors | Middle | Spring misty morning | 3 vs 3 | strong | light | Black Walnut Burst | 11 |
| 6 | Magnolia Lamps | North | Summer night | 3 vs 3 | on | normal | — | 11 |
| 7 | Fall on the Promenade | South | Fall day | 3 vs 3 | on | gusty | Sweetgum Drop | 12 |
| 8 | Gumball Gulch | Middle | Fall dusk | 3 vs 3 | strong | normal | — | 12 |
| 9 | Hedge Apple Harvest | North | Fall day | 4 vs 4 | on | normal | Hedge Apple | 13 |
| 10 | First Dusting | South | Winter day | 4 vs 4 | on | gusty | — | 13 |
| 11 | Winter Lamps | Middle | Winter night | 4 vs 4 | strong | normal | — | 14 |
| 12 | Battle for the Valley | North | Fall sunset | 4 vs 4, best of 3 | on | gusty | — | 14 |

- Each level is a different spot on its stretch's two mountains, with its own heights, slope features, tree species and obstacles (MECHANICS.md §4). Birds of the season fly over every level except the tutorial and night battles (MECHANICS.md §6b).
- The player picks a family at the start of the Story; the other family is the opponent.
- The difficulty preset (easy, medium or hard) scales the AI's aim, but the story order stays the same.

## 6. Screens and UX flow
**Title** → Story map | Quick Battle setup | Practice | Settings | How to play | Credits.
- **Story map:** a stylized painted valley with 12 nut-shaped markers, stars and padlocks.
- **Battle:**
  - The top HUD shows the family banners (shape plus name), round dots, the wind flag and number, and whose turn it is.
  - The squirrel pills show name and grip.
  - The bottom nut bar shows icons with counts and number keys.
  - Aim readout: angle° and power%.
  - Buttons: Throw, Scamper toggle, Camera recentre and Pause.
  - Portrait phones add a mini-map strip.
- **Between rounds:** the round result, then the acorn shop.
- **End of battle:** results (winner banner, stars, the best shot, acorns earned) and the **Field Notes** card, with Next battle, Replay and Menu.
- **Pause:** Resume, How to play, Settings, Quit to menu.
- **Settings:** sound, music, volume, reduced motion, aim guide (auto, by difficulty, or always), turn timer, text size (100/125/150%), key remapping and "Reset progress".
- **How to play:** five illustrated cards (aim, throw, tap tricks, scamper, wind and steam) and the nut guide.
- **First-battle tutorial:** short hints in level 1 (drag to aim, release, tap mid-air, scamper), which can be skipped.

## 7. Art direction
- **Painted 2D hybrid.**
  - **Backdrops:** Codex paintings, a warm storybook gouache look, frameless and evenly lit. Their composition comes from a Blender block-out of the real valley (DEM terrain plus Row massing in true order). One approved pilot serves as the style reference for every later painting, and Codex edits it for season and time-of-day variants.
  - **Squirrels:** modelled and rigged in Blender, then rendered to sprite atlases in a soft cartoon style: big eyes, bushy tails, friendly.
    - Gray squirrels have a silver-gray agouti coat and white belly, and wear a **teal scarf**; their family emblem is a ▲ pine tree.
    - Fox squirrels have a rusty-orange coat and belly, and wear a **mustard cap**; their family emblem is a ● acorn.
    - Families are told apart by coat, accessory, emblem shape and name, never colour alone.
  - **In code:** trees (so branches can break), the terrain surface edge, nuts, FX and UI.
- **Palettes:** `ouachita-forest`, `thermal-water`, `gilded-spa` and `nps-rustic`, from `shared/design/tokens.css`, copied inline.
  - The UI panels look like routed-wood park signs (sign brown with cream letters) and have rounded, friendly corners.
- **Type:** system font stacks only. "Arial Black"/Impact for headlines, `system-ui` for UI, Palatino-style serif for Field Notes.
- **Juice:** squash and stretch on throws and landings, wobbling branches, leaf and wood-chip bursts, dizzy stars, a camera nudge on big hits (off with reduced motion), and a slow-motion moment on the knockout of the round.
- **Rules:** no logos (no NPS arrowhead, no business marks); the Quapaw ornament is abstract; no weapons imagery beyond nuts; nobody is ever hurt.

## 8. Audio direction
- WebAudio synthesis only.
- **Music:** a light ragtime piano-and-banjo feel, with day, dusk, night and victory loops.
- **SFX:** a woody "thock" per nut, crack and crunch for branches, rustle for leaves, a soft steam hiss, a squirrel chitter per family, and a cheer.
- Starts on first input, quiet by default, with independent mute toggles.

## 9. Accessibility
- **Keyboard-only play** covers every feature: aim, throw, trick, scamper, nut choice, menus and shop.
- **Text contrast ≥ 4.5:1**, checked by `t.contrastReport()`.
- **Colourblind-safe cues:** shapes plus labels on teams, nuts (icons and names) and wind (arrow and number).
- `prefers-reduced-motion` and a setting turn off shake, slow-motion and parallax drift; transitions become fades.
- **Scalable text:** 100/125/150%.
- **Touch targets ≥ 44 px.**
- `aria-live` announcements for turn changes, hits and knockouts.
- **Aim help:** the aim guide setting gives a generous arc preview for younger players.

## 10. Mobile and touch
- Portrait first at 390 × 844, and landscape is supported.
- Drag-to-aim works anywhere on the lower half of the screen, with an on-screen throw button and a nut bar of 44 px+ icons.
- Pinch zoom and two-finger pan. The mini-map strip and an edge arrow show the target.
- Long-press and text-selection guards. Act on `pointerup`.

## 11. Performance budgets
- **60 fps** on a mid-range laptop. Frame task **≤ 6 ms** desktop and ≤ 10 ms at 4× CPU throttle (`t.frameCost`).
- **Size:**
  - `index.html` ≤ 2 MB
  - assets (WebP backdrops, sprite atlases) ≤ 6 MB in total, loaded per level
  - the first level's assets ≤ 1.5 MB
- **Speed:** interactive in ≤ 2 s on desktop over http; AI turn search ≤ 40 ms of main-thread work per frame.
- **Health:** zero console errors and zero network requests outside the game folder, and it works from `file://`.

## 12. Save and load
- One versioned `localStorage` object, `hsg-furious-squirrels-v1`, wrapped in try/catch with an in-memory fallback.
- It stores settings, story progress and stars, quick-battle setup and stats.
- An in-progress Story battle resumes at the last turn start.

## 13. Acceptance criteria
| AC | Criterion |
|---|---|
| AC1 | The game boots to the title over http and `file://` with zero console errors and zero external requests, at desktop and mobile sizes. |
| AC2 | The title shows the game name, "Hot Springs Games", the fiction label, and buttons for Story, Quick Battle, Practice, Settings, How to play and Credits; every button works by mouse, touch and keyboard. |
| AC3 | A battle renders the two mountains from the valley profile, trees, squirrels of both families, the painted Row backdrop for its stretch, steam and the HUD. |
| AC4 | The Row backdrop shows the bathhouses in true north-to-south order (left to right) for its stretch; `getState().render.backdrop.order` matches `research/bathhouse-row-layout.md`. |
| AC5 | Aiming works by mouse drag, touch drag (with hold at release), keyboard and gamepad. The angle and power readout updates, and the throw fires the selected nut. |
| AC6 | Nut flight follows the integrator: the same seed, level and shot give the same impact and `hash` in Node and Chromium. |
| AC7 | Wind changes each turn, is shown as an arrow, a flag and a number, and measurably bends the arc (a test compares impacts at wind −1, 0 and +1). |
| AC8 | The steam updraft lifts a nut passing through the column (a test compares the same shot with steam on and off). |
| AC9 | Nuts carve craters in dirt (the mask and the visuals agree) and never tunnel through thin branches or terrain at full power. |
| AC10 | Branches take damage and break. A broken branch falls, and squirrels on it drop to a lower perch and lose grip. |
| AC11 | Scampering moves the active squirrel along its mountain's perch graph within the stamina budget; it cannot cross the valley. |
| AC12 | Hits reduce grip by distance; at 0 grip the squirrel tumbles into the leaf pile and is out; the round ends when a family is out. |
| AC13 | All seven nuts behave as specified: split, dash, burst, hook, drop, heavy roll, plain. Each has a test with a mid-flight tap where relevant and a screenshot. |
| AC14 | Rounds, best-of battles, acorn earnings and the shop work: purchases are capped at 3 per kind and prices are enforced. |
| AC15 | The AI plays at easy, medium and hard. Its hit rates on a fixed level fall within the bands in `balance-targets.json`, and hard beats easy in ≥ 75% of simulated battles. |
| AC16 | Balance: 3 vs 3 rounds last 10–26 throws on average across AI pairings that include a medium or hard side (measured medium vs medium about 24, hard vs hard about 15), and no special nut's grip removed per throw is more than 1.4× the mean of the specials (`tools/balance.mjs`). |
| AC17 | Every Story level is winnable: `tools/check-levels.mjs` finds, for each level, a valid shot from every starting perch to an enemy across the wind range. |
| AC18 | The Story mode has 12 levels, as in §5, with unlocks, stars and the story map; progress survives a reload. |
| AC19 | Quick Battle setup applies every option (level, family, size, rounds, wind, steam, loadout, difficulty). |
| AC20 | Practice has targets, dummies, every nut and a full arc preview. |
| AC21 | The results screen shows the winner, stars, the best shot, acorns and a Field Notes fact with its source. `tools/check-facts.mjs` confirms every fact id is `confirmed` in the audited bank or listed as sourced in `squirrels-and-nuts.md`. |
| AC22 | Pause, Settings (all options), How to play and Credits work and are reachable by keyboard; Esc/P pauses. |
| AC23 | Audio starts on first input, every bus toggles, and the default volume is quiet. |
| AC24 | Accessibility: contrast report clean; reduced motion removes shake, slow-motion and parallax; text scales to 150% without overlap (`t.checkLayout`); `aria-live` announces turns and knockouts; team, nut and wind cues use shape plus label. |
| AC25 | Mobile: portrait layout with the mini-map and edge arrow; every touch target ≥ 44 px; pinch zoom works; no overlap or clipping. |
| AC26 | Saves work, and the game still plays when `localStorage` throws. |
| AC27 | Performance budgets in §11 are met (frame cost, sizes, AI search time). |
| AC28 | Painted art loads only files listed in `assets/manifest.json`; `?art=0` draws the vector fallback; `isIdle()` stays false while art loads. |
| AC29 | The game is fun and polished: juice, a tutorial, clear feedback for every event, and a satisfying end state, judged in the visual review loop (gates ≥ 7, authenticity ≥ 6, or the stop rule). |
| AC30 | Credits list the families as fiction, the data sources (USGS 3DEP, OSM ODbL, NPS and research sources) and the adapted code (with licences). |
| AC31 | The camera zooms out to about twice the world's width on desktop with painted scenery past the edges, and zooms in no further than 1.25×. |
| AC32 | Levels on the same stretch differ in mountain height, trees and obstacles, mirrored for fairness, and every level still passes `tools/check-levels.mjs`. |
| AC33 | Seasonal local birds fly as airborne obstacles: a hit bounces the nut (or a jay or crow snatches an acorn), nobody is hurt, Quick Battle can turn them off, and the aim guide and AI ignore them. |

## 14. Out of scope
- Online or networked multiplayer (the collection makes no runtime network requests).
- Local hot-seat 2-player in v1. The sim supports two human teams, so it is a cheap later add.
- A level editor or user levels.
- Real-time (non-turn) play.
- Rigid-body physics for debris; falling branches are scripted.
- Leaderboards, accounts and analytics.
- Any real person, business logo or NPS mark.

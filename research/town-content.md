# Furious Squirrels: town content

Every Hot Springs place, fact, name, colour and story the game uses, with its source. Shared-corpus facts cite their `research/` file (which carries the primary links). New research for this game lives beside this file: `squirrels-and-nuts.md` (squirrel species, nut trees, seasons, wind) and `valley-profile.md` (DEM cross-sections). Player-facing landmark facts come only from the audited bank `games/trivia/data/questions.json` (`confidence: confirmed`), per `shared/SESSION-BRIEF.md`.

## 1. Setting: the valley and its two mountains

| Item | Use in game | Fact | Source |
|---|---|---|---|
| Bathhouse Row | Painted backdrop in the valley between the two families | Eight bathhouses on the east side of Central Ave, facing west, about 1,705 ft from Reserve St to Fountain St; National Historic Landmark 1987 | `research/visual-style-guide.md` → Row-wide facts; `research/bathhouse-row-layout.md` |
| Hot Springs Mountain | The Tower Top Tails' home (right side of the screen) | Rises east behind the Row; tower ground 1,036 ft (USGS EPQS) | `research/geography-lakes-mountains.md` elevation table; `games/block-puzzle/research/backdrop-notes.md` §1 |
| Hot Springs Mountain Tower | Landmark on the Tails' crest | Current tower 216 ft, opened June 1983 (`hs-0094`, `hs-0099`); preceded by the steel Rix Tower (`hs-0071`) | audited bank; `research/visual-style-guide.md` → tower table |
| West Mountain | The West Ridge Rustlers' home (left side) | The east face that looks at the Row; the park's West Mountain Drive overlooks are about 0.9 mi from the Row; the surveyed summit (about 1,419 ft) is 2.75 mi WSW | `research/bathhouse-row-layout.md`; `research/geography-lakes-mountains.md` |
| The battle line | Level terrain shape | V-shaped valley about 1.1 km crest to crest: West Mountain spur about 970 ft, Row about 612 ft, tower about 1,034 ft | `valley-profile.md` (USGS 3DEP DEM) |
| "Valley of Vapors" | Name of the mid-valley steam updraft mechanic (a game mechanic, labelled as game fiction) | A long-standing nickname for Hot Springs; springs emerge at about 143°F | `research/visual-style-guide.md` → Thermal water; `research/geography-lakes-mountains.md` |
| Grand Promenade | Brick path drawn on the hillside behind the Row | North–south brick walk behind the bathhouses; begun in the 1930s (`hs-0086`) | audited bank; `research/visual-style-guide.md` → Landscape |
| Magnolia Promenade and lamp posts | Street-level backdrop detail; night levels light the lamps | One row of magnolias about 25 ft apart along the curb; dark green cast-iron posts, each with five white globes | `research/visual-style-guide.md` → Landscape |
| Arlington Hotel | North-end backdrop | Stands at the north end, at the "Y" of Central Ave and Fountain St | `research/visual-style-guide.md` → Skyline recipe |
| Administration Building | South-end backdrop | Stucco block with a red hip roof, south of the Lamar | `research/visual-style-guide.md` → skyline table |

## 2. The eight bathhouses, in order (north → south)

Order confirmed by HABS AR-28, the NHL nomination and OpenStreetMap (`research/visual-style-guide.md` → Skyline recipe and row order). The players look across the valley along a WSW–ENE line, so in the backdrop the **Row runs left to right as north to south**, as seen from West Mountain looking east (the view `games/block-puzzle` painted).

| # | Bathhouse | Silhouette cue for the painter | Est. hexes | Audited fact for Field Notes |
|---|---|---|---|---|
| 1 | Superior (1916) | Flat parapet, brick pilasters, green paterae, one-story sun porch | body `#E6D7B5`, green `#4E7D5B`, brick `#B5654A` | Green tile medallions (`hs-0066`); now a brewery (`hs-0102`) |
| 2 | Hale (1892) | Big red hip roof; bell gable low on the porch | stucco `#F3EFE6`, tile `#A9432C` | Oldest surviving bathhouse (`hs-0061`); Mission facade 1939–40 (`hs-0080`) |
| 3 | Maurice (1912) | White stucco, green tile wing roofs, glazed hipped centre | stucco `#F3EFE6`, green tile `#4E7D5B` | 1931 therapeutic pool (`hs-0081`) |
| 4 | Fordyce (1915) | Dark brown diamonds in light-yellow brick, two red hipped end pavilions, copper marquee | `#E3CF94`, `#6E4B2F`, terra cotta `#C46A3E`, copper `#B87333` | Park visitor center (`hs-0093`) |
| 5 | Quapaw (1922) | Widest house; chevron-striped dome with a lantern (highest point on the Row) | buff `#D8C29A`, ochre `#C8963E`, turquoise `#3FA8A0`, tile `#A9432C` | Large tiled dome (`hs-0082`); sculpin on the parapets (`hs-0084`) |
| 6 | Ozark (1922) | Twin three-tier towers with red hip caps | white `#F3EFE6`, tile `#A9432C` | Twin towers with three-tiered setbacks (`hs-0085`) |
| 7 | Buckstaff (1912) | Cream block, seven-bay column rhythm, taller central attic | cream `#E6D7B5`, brass `#C9A23F` | Baths continuously since 1912 (`hs-0062`); cream brick (`hs-0069`) |
| 8 | Lamar (1923) | Plain stucco box with a low central pediment | stucco `#F3EFE6`, cap `#A9432C` | Its opening completed the Row (`hs-0077`) |

Widths and heights for proportions: the skyline table in `research/visual-style-guide.md` (HABS AR-28 measurements). Gaps: the Maurice Spring fountain garden (about 57–59 ft) and the Main Entrance with the bronze eagles between the Maurice and the Fordyce (about 41–45 ft).

**Row stretches by level:**
- **North:** Arlington, Superior, Hale; tower close behind.
- **Middle:** Maurice, Main Entrance, Fordyce, Quapaw dome.
- **South:** Ozark towers, Buckstaff, Lamar, Administration Building.

## 3. Forest, steam and seasons

- **Forest makeup:** shortleaf pine; southern red, red, black and white oaks; hickories; Ozark chinquapin on the ridges; sweetgum, sycamore, beech and hornbeam in valley bottoms. Ridges run east–west; south-facing slopes are pine–oak–hickory, north-facing slopes mesic hardwoods. Old growth covers about 230 acres on North and Hot Springs mountains. — `research/geography-lakes-mountains.md` (forest paragraph, about line 161).
- **Shortleaf pine form:** 80–100 ft tall with a pyramidal head. — `games/theme-park/research/terrain.md`.
- **Magnolias** along the Row. — `research/fish-and-wildlife.md` → Plants and forests.
- **Squirrels live in the park**: "squirrel" is on the park mammal list, alongside raccoon, gray fox and chipmunk. — `research/fish-and-wildlife.md` (about line 163); `research/hot-springs-national-park.md` (about line 135).
- **Species, nut trees, mast months, fall colour timing and wind:** see `squirrels-and-nuts.md`.
- **Steam, tufa and algae rendering:** steam as translucent white curls (`#FFFFFF` at 15–35% alpha), tufa gray `#9A968C` with rims `#C8C3B6`, algae `#2F8F5B`→`#2A9D8F`. — `research/visual-style-guide.md` → Thermal water.
- **Climate:** about 1.1 in of snow a year, so winter levels show only a light dusting. — `research/geography-lakes-mountains.md` → Climate.

## 4. Palettes and type (copied inline from `shared/design/tokens.css`)

- **`ouachita-forest`:** pine shadow `#1F3324`, pine `#2F4A2C`, oak `#5C7A3A`, novaculite `#EDEAE2`, sandstone `#A08A6A`. Used for the mountains and trees.
- **`thermal-water`:** pool `#1F5F6B`, algae `#2A9D8F`, tufa `#9A968C`. Used for steam vents and the valley mist.
- **`gilded-spa`:** the Row and the UI chrome.
- **`nps-rustic`:** stone `#8C877C`, log `#5B4632`, sign brown `#5E4B3C`, sign letters `#EDE3C8`. Used for HUD panels styled like routed-wood park signs.
- **Type:** system stacks only. Titles use `--font-neon` ("Arial Black", Impact) for the cartoon headline; UI uses `--font-sans`; the Field Notes card uses `--font-serif-victorian`.

## 5. Fiction, clearly labelled

- **Families:** the *Tower Top Tails* (eastern gray squirrels, Hot Springs Mountain) and the *West Ridge Rustlers* (fox squirrels, West Mountain), and every squirrel name, are **game fiction**.
- **Game logic:** the nut-throwing battles, the shop, the "Valley of Vapors updraft" and nut abilities are **game logic**. The title screen and help say "A made-up squirrel rivalry set in real Hot Springs."
- **Content rules** (`research/00-INDEX.md`, `research/visual-style-guide.md`):
  - no logos (no NPS arrowhead, no business marks)
  - the Quapaw cartouche is drawn as an abstract architectural ornament
  - legends are labelled as legends
- **Family friendly:** nobody is hurt. A knocked-out squirrel tumbles into a leaf pile with dizzy stars and cheers from the sidelines; no realistic hunting references.

## 6. Field Notes card (results screen)

Each battle ends with one real fact, chosen by the level's Row stretch or season, with its source line:
- **Landmark facts:** audited ids `hs-0061`, `hs-0062`, `hs-0066`, `hs-0069`, `hs-0071`, `hs-0077`, `hs-0082`, `hs-0084`, `hs-0085`, `hs-0086`, `hs-0093`, `hs-0094`, `hs-0099`, `hs-0102`. Text comes from `games/trivia/data/questions.json`, copied at build time; `tools/check-facts.mjs` verifies each id is `confirmed` and the source matches.
- **Nature facts:** the "Facts worth adding" list in `squirrels-and-nuts.md`, only items without an [UNVERIFIED] tag, each with its source URL.

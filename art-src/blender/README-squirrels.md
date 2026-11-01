# Squirrel sprites (Blender)

`scripts/squirrel.py` builds cartoon squirrels from primitives and swept tubes. It rigs each one with a
small armature, poses it frame by frame, and renders transparent 256×256 sprite frames. There are two
families with four members each. The script runs headless, uses no randomness, and repeated runs give
byte-identical PNGs.

## Families

The two families differ in silhouette, not only in colour:

| Team | Name | Species | Body | Tail | Wears |
|---|---|---|---|---|---|
| 0 | West Ridge Rustlers | eastern fox squirrel | about 8 % larger (heavier build) | full, round and upright, rising above the ears | mustard headwear |
| 1 | Tower Top Tails | eastern gray squirrel | slimmer | longer, lower and flatter in profile; darker grey core with a wide white fringe | teal neckwear |

Colours: coat `#C8763A` / `#8E4E22` / belly `#E9B27A` with accessory `#E0B23A` / `#9C7A1E` (team 0), and
coat `#9A9A96` / `#64645F` / belly `#F2EFE6` with accessory `#2A9D8F` / `#1F6B62` (team 1), matching
`src/js/gfx/looks.js` `TEAM_COLORS`.

The body and tail differences and the tail fringes follow `research/squirrels-and-nuts.md`:
- fox squirrels are "heavy-bodied and larger" and have a reddish-yellow tail fringe;
- gray squirrels are "slender and smaller" and have a white fringe.

All hexes are estimates. The striped scarf's cream is `#F2EBD8` (est.).

## Variants (four per family)

| Folder | Wears | Face extra |
|---|---|---|
| `t0v0` | baseball-style cap, brim forward | none |
| `t0v1` | the same cap worn backwards: brim sticks out behind, strap gap over the forehead | freckles |
| `t0v2` | ribbed knit beanie with a rolled cuff and pom-pom (ears poke through) | bigger blush |
| `t0v3` | sun visor: open-top band (fur shows) and a long, nearly level brim | lashes |
| `t1v0` | knit scarf with two ribbons trailing back | none |
| `t1v1` | bow tie on a thin collar (turned a little toward the camera so both wings show) | arched brows |
| `t1v2` | neckerchief: triangle flap down the chest with cream dots, knotted at the near side | freckles |
| `t1v3` | long teal-and-cream striped scarf: one end hangs down the chest, one trails behind, with tassels | lashes and soft brows |

`VARIANTS` in the script holds this table. Each member's shape and accessory code is in
`Squirrel._cap/_beanie/_visor/_scarf/_bowtie/_bandana/_longscarf`.

## Running

From the game folder (`C:\Video Game Projects\games\Furious Squirrels`). Quote the paths, because they contain spaces.

PowerShell:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup `
  --python "art-src/blender/scripts/squirrel.py" --
```

Git Bash:

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
  --python art-src/blender/scripts/squirrel.py --
```

- `--team 0|1|both`: which family to render (the default is `both`).
- `--variant 0,1,2,3|all`: which members to render (the default is `all`).
- `--poses idle,aim`: render only these poses (useful while tuning).
- `--no-sheet`: skip the contact sheets and the previews.
- `--save-blend`: also save `art-src/blender/squirrel-t<team>v<k>.blend` (in rest pose) for inspection.

All 8 members × 17 frames take about 30–55 s (about 4–7 s per member), using EEVEE at 16 samples.

The script prints one `@@FRAME` line per frame with its alpha bounding box. If any opaque pixel is
within 2 px of the frame edge, the line says `CLIPPED`. It also prints `@@VARIANT`, `@@TEAM` and
`@@DONE` timings.

## Outputs

```
art-src/sprites/t<team>v<k>/<pose>_<i>.png     256×256 RGBA, transparent background, straight alpha
art-src/sprites/sheet-t<team>-variants.png     rows v0..v3 × idle_0, aim_0, hit_0, cheer_0; red cross = anchor
art-src/sprites/small-preview-variants.png     one row per member, every frame at game size (~40 px), shown ×3
art-src/sprites/small-preview-variants-1x.png  the same at 1×
```

The older single-member renders in `art-src/sprites/t0/` and `t1/` (with `sheet-t0.png`, `sheet-t1.png`
and `small-preview.png`) came from the first version of the script. They are left as they were and are
no longer regenerated. The game's `.gitignore` excludes `art-src/**/*.png`, so none of these renders are
tracked. Pack them into `assets/` when the sprite atlas exists (`tools/pack-sprites.mjs` in DEV-PLAN).

## Frame contract (all members)

- **Size:** 256×256 px.
- **Anchor:** the feet centre, which is the perch point and the origin of the vector squirrel in
  `src/js/gfx/squirrels.js`, is at **pixel (128, 236)** from the top-left corner in every frame. Draw a
  frame with `drawImage(img, x - 128*k, y - 236*k, 256*k, 256*k)`.
- **Scale:** **3.4 px per game unit**. A squirrel is about 46 units from feet to ear tips, or about
  156 px. To match the vector squirrel drawn at scale `s`, use `k = s / 3.4`.
- **Facing:** right (+x), with a 25° turn toward the camera. Mirror horizontally about x = 128 to face left.
- **Camera:** orthographic, horizontal, film transparent, Standard view transform.
- **Fit:** every frame of every member keeps at least 2 px clear of every edge. The tightest is
  `scamper_0`, whose dangling feet reach y = 253.

## Poses (the same for every member)

| Pose | Frames | Content |
|---|---|---|
| `idle` | 4 | breathing (body swell, head bob), tail sway as a travelling wave, neckwear drift |
| `scamper` | 4 | bounding run: push, gather, flight (root raised 3 units), land |
| `aim` | 1 | near arm cocked up and back behind the head (empty paw), far arm pointing forward |
| `throw` | 2 | release with the arm straight forward and mouth open, then follow-through low |
| `hit` | 1 | squash (×1.16 wide, ×0.80 tall about the feet), eyes squeezed shut `> <`, paws flinching up |
| `fall` | 2 | both arms up, wide eyes, "o" mouth, legs dangling, tail flung back |
| `out` | 1 | sitting slumped, head tilted, spiral eyes, wavy mouth, tail lying back. The game draws the dizzy stars. |
| `cheer` | 2 | both arms up, happy `^ ^` eyes, open smile; frame 1 is a small hop |

## How it is built

- **Rig:** `root`, `spine`, `head`, `scarf` (neckwear flutter), two-bone arms, thigh + foot legs, and a
  6-bone `tail1..6` chain that follows each family's tail centre line. Rigid parts carry one vertex
  group with weight 1. The tail tubes are weighted smoothly along their length.
- **Posing:** `pose(name, i, n)` returns bone angles as screen-CCW degrees, or arm screen angles with
  optional abduction, stretch and shoulder lift. Those are cartoon cheats so that "arms up" clears the
  big head.
- **Expressions:** eye sets and mouths are separate objects that are shown per pose. The per-member
  freckles, brows and lashes are always on.
- **Look:** emission toon shading (white diffuse → Shader to RGB → constant ramp between a lit and a
  shade colour, plus a back-top rim). Outlines are a Solidify inverted hull with even offset off.
  Striped parts use two surface materials, with one outline slot per surface slot.
- **Determinism:** no randomness, and PNG stamp metadata is turned off.

## Known limits

- At about 40 px, the bow tie (`t1v1`) and the neckerchief (`t1v2`) are the closest pair: both are
  teal at the throat. The bow reads as a wide sideways shape and the neckerchief as a triangle hanging
  down the chest. Side by side they separate, but less strongly than the others.
- The backwards cap's rear brim is mustard against the rust tail, so its contrast is lower than the
  forward brim's.
- In the side view, raised arms cross in front of the head and partly cover the cheek in `cheer` and `fall`.

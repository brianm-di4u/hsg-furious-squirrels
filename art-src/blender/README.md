# Blender composition guides (Bathhouse Row backdrop)

`scripts/row_guide.py` builds a block-out of the backdrop view and renders it as a guide for the painted
backdrop panels. The view is Bathhouse Row from West Mountain's lower east slope, looking east across Central
Avenue to Hot Springs Mountain. North is on the left. The guides are for painters; they are not final art.

## Running it

From the game folder (`C:\Video Game Projects\games\Furious Squirrels`), in Git Bash:

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
  --python art-src/blender/scripts/row_guide.py -- --stretch middle
```

- `--stretch north|middle|south|all`: which panel to render. The default is `middle`. `all` renders all
  three in one run (about 1.5 min).
- `--out <dir>`: output folder. The default is `art-src/blender/renders/`.
- `--blend`: also saves `art-src/blender/row_guide.blend`.

The script writes `renders/guide-<stretch>.png` (2500×1000 RGBA, transparent sky). PNGs under `art-src/` are
git-ignored. It prints `@@SLOT` lines (each slot against the GLB's wall width), and `@@FRAME` and `@@BLD`
lines (each building's projected pixel span). It uses no randomness except a fixed-seed RNG for the
tree clumps, so every run gives the same scene.

## What it reads

- `games/Cart Racing/art-src/blender/export/<name>.glb`: the Tub Rally models of the Arlington, the eight
  bathhouses and the Administration Building. They are read only. After import they are Z-up, with the
  origin at front-centre on the street wall line at grade, the facade facing -Y and +X pointing south.
  The Mountain Tower (`hs-tower.glb`) is **not** imported.
- The layout constants copied from `src/js/gfx/backdrop.js` (`ROW`, `FOCUS`, `SX`, `SY`, `BW`, `BH`,
  `BASE`). If those change, update the copies at the top of the script.
- The hill crest heights, from the DEM transects in `research/valley-profile.json` (the numbers are written
  into the script's `CREST` table).

## Framing

| Item | Value |
|---|---|
| Panel | 2500 × 1000 px, the same as `backdrop.js` |
| Horizontal scale | 1.75 px per ft of frontage, so the orthographic width is 435.43 m |
| Street line | the wall line at grade is at **y = 700 px** |
| Centre (x = 1250 px) | north: **Hale**; middle: **Quapaw**; south: **Buckstaff** (the slot centre, as in `focusX()`) |
| Slots | each GLB origin sits at its `backdrop.js` slot centre: frontage plus gap, in feet, north to south from x = 0 at the Arlington's north edge |
| Camera | orthographic, tilted 12° down |
| Building heights | scaled ×1.752 about grade, which is (3 / 1.75) / cos 12°, so a height of h ft spans 3h px on screen |
| Lawn | y 700–744 |
| Curb and walk strip | y 744–760 |
| Road | y 760 to the bottom of the frame |
| Centre line | y 850, dashes 40 px on and 40 px off |
| Magnolias | 50 ft apart at x = 6 + 50n ft. Trunk base at y 744 and crown top about 73 px above it, as in `backdrop.js` |
| Lamp posts | five-globe posts every 100 ft |

The foreground depths are chosen so that the bands land on the `backdrop.js` rows. They are not true
distances.

## Hill

The hill is a smooth gray-green mass with sphere (broadleaf) and cone (pine) clumps. It is fixed to the
world, so the three panels join up. Its crest is 220 + 3.8 × (DEM rise above the Row, in m) px above the
street, capped at 600 px:

| Latitude | Rise above the Row | Crest above the street |
|---|---|---|
| Tower latitude | 127 m | 600 px (capped) |
| Hale | 85 m | 543 px |
| Quapaw | 52 m | 418 px |
| Lamar | 23 m | 307 px |

So the crest falls from north to south, with small sine shoulders added.

## Differences from the vector layout

- **GLB frontages differ from the `backdrop.js` slots.** Each model is centred in its slot and not
  stretched, so these models over- or under-fill their slots by half the difference on each side:

  | Building | GLB frontage | Slot |
  |---|---|---|
  | Hale | 123 ft | 120 ft |
  | Fordyce | 101 ft (wall to wall) | 105 ft |
  | Admin | 47 ft | 45 ft |
  | Maurice | 91 ft | 90 ft |
  | Quapaw | 183 ft | 184 ft |
  | Ozark | 107 ft | 108 ft |
  | Buckstaff | 104 ft | 105 ft |
  | Lamar | 93 ft | 94 ft |

  The Superior matches (88 ft). Projecting eaves and porches stick out up to about 8 px past the slots.
- **The Arlington is much bigger than its slot.** The model is 136 m across its folded-back wings, with
  towers to 54 m. It is turned 45° so that it faces south-west toward the Central/Fountain junction, and
  this gives it about 105 m of projected width. Its south edge stays on the slot's south edge (230 ft),
  so the 140 ft lawn gap to the Superior is kept, and the hotel runs north past x = 0. It is set back 120 ft
  and its front base is drawn 90 px up, as in `backdrop.js`, on a lawn terrace. With the shared 1.75× height
  scale its towers reach about y 55, against about y 255 in the vector version. It shows only in the north
  panel, where its north wing is cut by the left edge.
- **The hill does not follow the vector's panel-fixed hump.** The vector draws the hill as a hump centred
  in each panel. Here it falls from north to south (see the Hill section).
- **The roofs show.** The 12° tilt shows roof tops (about 30 px for a 25 m deep building), where the
  vector drew pure elevations.

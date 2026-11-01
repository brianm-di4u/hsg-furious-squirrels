# Bird sprites (Blender)

`scripts/bird.py` builds the seven birds over the valley (MECHANICS.md §6b) from ellipsoids and swept tubes. It renders
transparent 256×256 sprite frames in the squirrels' look. It imports the squirrel script's toolkit: the toon materials,
the tube and ellipsoid builders, the scene, light and camera setup, and the PNG helpers. The two sets of sprites
share the same shading, rim light and ink line. The script runs headless, uses no randomness, and repeated runs
give the same PNGs.

## Look

- Toon shading is emission-based: two tones plus a back-top rim. This is `toon()` from `squirrel.py`.
- The ink line is a solidify inverted hull. Its width is set per kind so that it is about 1.25 px on screen at
  zoom 1, which is the squirrels' line weight. Small birds get a thicker line in the render because the game shrinks
  them more.
- Each bird has one big cartoon eye with a pupil and a shine. The far eye is left out, because it would only show as
  a white sliver over the crown.
- The bird faces +x. It is turned 20° toward the camera and rolled 16°, so the view is a little from below and
  both wings read.
- The far wing is one shade darker. Wings get a lighter covert band along the leading half and feather scallops on
  the trailing edge. Vultures, crows and eagles also get "finger" primaries.

| Kind | Key features | Seasons |
|---|---|---|
| swift | sooty cigar body, long swept sickle wings, pale throat | spring, summer |
| vulture | dark body, small red bare head, ivory hooked beak, silver flight feathers, fingered tips | all year |
| jay | blue with a white face and belly, peaked crest, black necklace, barred wings and tail, white wing patch | all year |
| crow | glossy black with a blue rim, heavy beak, fingered tips | all year |
| goose | long black neck, white chin strap, brown body, pale breast, white undertail, dark wingtips | fall, winter |
| waxwing | tan crest, black mask, grey wings with red waxy tips, yellow tail band | winter, spring |
| eagle | dark brown, white head and tail, yellow hooked beak and feet, stern brow, fingered tips | winter |

The colours follow `research/birds.md` and the vector `LOOK` table in `src/js/gfx/birds.js`. All hexes are estimates.
The `SPECIES` table in the script holds every kind's proportions, colours and wing planform.

## Frames

- `flap_0`–`flap_5`: one wingbeat. It starts at the top of the stroke, goes down with the wing spread, then comes back up
  with the hand folded and swept back.
- `glide_0`: wings held out. Vultures use a V (dihedral).

The wings are rebuilt for every frame from three angles: shoulder elevation, wrist bend and hand sweep (`wing_pose`). The body, head and tail stay put.
The game picks a flap frame from the old wingbeat clock (rate and soar share per kind, faster when startled). It shows the glide frame while a soarer glides.

## Running

From the game folder:

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
  --python art-src/blender/scripts/bird.py --
node tools/pack-sprites.mjs
npm run build
```

- `--kind swift,jay`: render only these kinds. The default is `all`. `birds.json` keeps the entries of kinds you didn't render.
- `--no-sheet`: skip the contact sheet and the previews.

All 7 kinds × 7 frames take about 10 s. The script prints one `@@FRAME` line per frame with its alpha bounding box,
and the line says `CLIPPED` if any opaque pixel is within 2 px of the edge. `@@KIND` prints the scale, body length
and line width.

## Outputs

```
art-src/birds/<kind>/flap_<i>.png, glide_0.png   256×256 RGBA, transparent background, straight alpha
art-src/birds/birds.json                         per kind: anchor (body centre, px), bodyPx, linePx
art-src/birds/sheet-birds.png                    every frame; red cross = body centre
art-src/birds/small-preview.png (+ -1x)          every frame at 1/4 size (about game size), ×3
```

Each kind is fitted to the frame on its own. The union of all seven frames fills the 256 px square, less an 8 px
margin. `tools/pack-sprites.mjs` packs the frames into `assets/birds.webp`, which has one row per kind and 256 px cells.
It also writes `sprites.json` → `birds`: `{ cell, cols, flap, species: { <kind>: { row, anchor, bodyPx } } }`. The game
scales each frame so that `bodyPx` maps to the sim body length (`2.2 × r × zoom`) and places the anchor at the bird's
position.

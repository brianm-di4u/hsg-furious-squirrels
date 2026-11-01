# Valley profile: West Mountain to Hot Springs Mountain across Bathhouse Row

East–west elevation cross-sections of the valley that holds Bathhouse Row, sampled from the USGS 3DEP DEM for Furious Squirrels' level shapes. The battle line from the West Mountain Drive viewpoint to the Hot Springs Mountain Tower is a V about 1.1 km crest to crest: West Mountain's east spur is steep and close (about 970 ft, 420 m west of the Row), and Hot Springs Mountain is broader and higher (about 1,034 ft at the tower, 700 m east of the Row). New research for this game (2026-11-01); numbers are **[measured]** from the DEM unless tagged.

## Method

- **Data:** USGS 3D Elevation Program DEM tiles fetched by Tub Rally (`games/Cart Racing/art-src/geo/raw/dem-downtown.tif`, `dem-west.tif`, `dem-east.tif`; 1.8–2.1 m pixels; public domain). Dataset queries, extents and licences: `games/Cart Racing/research/geo/SOURCES.md`.
- **Tool:** `node tools/geo/valley-profile.mjs` samples bilinear elevations every 10 m and writes `research/valley-profile.json` (all points). The DEM reader is Tub Rally's `geo-lib.mjs` (copied, MIT).
- **Anchors (OpenStreetMap, ODbL):** West Mountain Drive viewpoint node 5999161833 (34.51412, −93.05666); a second viewpoint, node 5999161832 (34.51275, −93.05814); Hot Springs Mountain Tower way 999440241 (34.51719, −93.04633). The tower's own ground is 1,036 ft by USGS EPQS — `games/block-puzzle/research/backdrop-notes.md` §1.
- **Check:** the DEM gives 1,030–1,034 ft at the tower end of the line, matching the 1,036 ft EPQS point within 6 ft; the Row samples (605–622 ft) match "Central Ave at the Row ≈ 608 ft" in `research/geography-lakes-mountains.md`.

## The battle line (viewpoint → tower, extended 0.8× west and 0.3× east)

Distance d is metres from the western end, on a bearing of about 070°. Elevations in feet.

| d (m) | 0 | 210 | 421 | 561 | 701 | 841 | 981 | 1,122 | 1,262 | 1,402 | 1,542 | 1,682 | 1,822 | 1,963 | 2,103 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ft | 787 | 806 | 862 | 890 | **972** | 874 | 718 | **612** (Row) | 700 | 823 | 913 | 969 | **1,034** (tower) | 995 | 831 |

- **West Mountain's east spur crest:** about 970 ft at d ≈ 700 m, then a drop of about 360 ft in 420 m to the Row (average about 26% grade, steepest just above Central Ave).
- **Hot Springs Mountain:** a steady climb of about 420 ft in 700 m from the Row to the tower (average about 18%), then falling away east.
- **Crest-to-crest gap:** about 1,120 m (0.7 mi). The surveyed West Mountain summit (about 1,419 ft) is 2.75 mi WSW and not on this line — `research/bathhouse-row-layout.md`.

## East–west transects along the Row

Sampled from −93.072 to −93.036 at each latitude (about 3.3 km). Each row is 26 evenly spaced samples, west → east, in feet.

| Transect | Lat | Profile (ft) |
|---|---|---|
| North end (Superior, Hale; Arlington behind) | 34.5147 | 700 705 688 759 683 696 712 684 709 801 892 **928** 736 **611** 697 812 **894** 834 756 685 640 584 600 558 537 557 |
| Middle (Maurice, Fordyce, Quapaw) | 34.5135 | 738 729 769 752 760 773 709 716 836 874 **991** 827 656 **608** 710 **781** 728 689 642 616 583 581 557 531 523 528 |
| South end (Ozark, Buckstaff, Lamar) | 34.5123 | 735 781 785 780 774 748 758 835 885 **995** 883 730 611 **603** 681 **664** 631 634 601 594 564 573 545 531 518 504 |
| Through the tower | 34.5172 | 704 703 720 694 678 709 701 717 655 651 629 740 643 **620** 633 694 761 916 **1,022** 989 830 674 622 573 556 572 |

Readings:
- West Mountain's near ridge is highest behind the middle and south of the Row (about 990 ft), and lower behind the north end (about 930 ft).
- Hot Springs Mountain's west shoulder directly behind the Row is low in the south (about 660 ft) and rises northward toward the tower summit (about 1,020 ft at the tower latitude). The tower stands behind the **north half** of the Row, as `research/bathhouse-row-layout.md` §9 says.
- Between the ridges, the valley floor at Central Ave is 603–620 ft, lowest at the south end.

## Game hooks
- **Level terrain** is a stylized, horizontally compressed battle line: West Mountain (left, the Rustlers) steeper and closer to the valley, Hot Springs Mountain (right, the Tails) broader and taller, with the tower on its crest. The game compresses the 1.1 km gap to about 8 screen-widths of throw; the elevation ratio (about 360 ft and 420 ft of relief over a 612 ft floor) is kept within ±20% **[inferred, design]**.
- **Three Row stretches** (north, middle, south) differ in real shape, so the levels for each stretch use that transect's ridge heights: north levels have the tower close behind the Tails, south levels a low Hot Springs shoulder and a higher West Mountain.
- **Viewpoint placement:** the Rustlers' home tree stands near the West Mountain Drive viewpoint switchback; the Tails' home tree stands below the tower.

## Caveats
- The DEM is bare earth: tree canopy (up to about 80–100 ft for shortleaf pine) and buildings are not in it.
- The transects are straight lines; real trails and roads wind. Distances are along the line, not along the ground.
- The game's horizontal compression and the vertical ratios are design choices, not measurements.

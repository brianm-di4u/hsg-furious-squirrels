# Loop 2 · Critic B (Codex, blind)

```json
{
  "scores": { "art": 6, "place": 7, "chars": 6.5, "juice": 6.5, "read": 6.5, "ui": 7, "type": 6.5, "mobile": 6, "ground": 6, "polish": 6.5 },
  "ab": { "art": "B", "place": "B", "chars": "B", "juice": "B", "read": "B", "ui": "B", "type": "B", "mobile": "B", "ground": "B", "polish": "B" },
  "issues": [
    { "category": "mobile", "severity": "high", "shot": "mobile/r13-practice.png", "problem": "All practice targets are outside the view; the aiming arc exits right before showing its destination.", "fix": "A framing mode that includes shooter and target area together, with a landing preview.", "effort": "M" },
    { "category": "read", "severity": "high", "shot": "mobile/r03-battle-north-summer.png", "problem": "The aiming view shows only the throwing family; no opponent visible.", "fix": "Opponent inset or zoomed overview while aiming.", "effort": "M" },
    { "category": "ui", "severity": "medium", "shot": "mobile/r12-help.png", "problem": "The sixth instruction fades beneath the fixed Back footer with no scroll cue.", "fix": "Reserve footer space and add a scroll indicator.", "effort": "S" },
    { "category": "read", "severity": "medium", "shot": "mobile/r06-aim.png", "problem": "Minimap markers are cut by its top border.", "fix": "Vertical padding so every marker stays inside.", "effort": "S" },
    { "category": "art", "severity": "high", "shot": "desktop/r04-battle-south-fall.png", "problem": "Painterly forest and architecture behind thick-outlined foliage blobs, geometric clouds and procedural soil: rendering styles disagree.", "fix": "Unify foreground trees, clouds and terrain around the backdrop's brushwork and palette.", "effort": "L" },
    { "category": "ground", "severity": "medium", "shot": "desktop/r07-flight.png", "problem": "Terrain edges end in straight vertical cuts inside the viewport.", "fix": "Extend terrain beyond the camera bounds during flight framing.", "effort": "M" },
    { "category": "ground", "severity": "medium", "shot": "desktop/r03-battle-north-summer.png", "problem": "Valley ends in a flat gray block with pale ovals; leaf piles look like scattered chips.", "fix": "Shaped spring basin, grounded shading, layered leaf piles.", "effort": "M" },
    { "category": "chars", "severity": "medium", "shot": "mobile/r05-battle-middle-winter-night.png", "problem": "Family members repeat the same silhouette, cap and pose; names carry identity.", "fix": "Vary proportions, tails, accessories and expressions within each family.", "effort": "L" },
    { "category": "read", "severity": "medium", "shot": "desktop/r05-battle-middle-winter-night.png", "problem": "Gray opponents and dark branches merge into the detailed blue forest.", "fix": "Reduce backdrop contrast behind the playable trees; restrained rim light.", "effort": "M" },
    { "category": "juice", "severity": "medium", "shot": "mobile/r08-impact.png", "problem": "The oversized -38 overlaps Willow's nameplate and obscures the reaction.", "fix": "Offset damage text above the label; more space for hit pose and debris.", "effort": "M" },
    { "category": "type", "severity": "medium", "shot": "desktop/r06-aim.png", "problem": "Nut descriptions and labels much smaller than controls; walnut text squeezed.", "fix": "Larger secondary text; wider description panel.", "effort": "S" },
    { "category": "type", "severity": "medium", "shot": "mobile/r10-shop.png", "problem": "Buy labels wrap inconsistently.", "fix": "Consistent two-line button: Buy above an unbroken price.", "effort": "S" },
    { "category": "polish", "severity": "medium", "shot": "mobile/r01-title.png", "problem": "The title's stack of buttons hides the squirrels and scenery.", "fix": "A title composition with visible family characters around a compact menu.", "effort": "M" },
    { "category": "place", "severity": "medium", "shot": "desktop/r13-practice.png", "problem": "The tower reads as a thin mast with a tiny cabin.", "fix": "A more distinctive observation-deck silhouette with visual weight.", "effort": "M" }
  ]
}
```

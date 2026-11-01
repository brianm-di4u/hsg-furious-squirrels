# Loop 4 · Critic B (Codex, blind)

```json
{
  "scores": { "art": 6.5, "place": 7, "chars": 7, "juice": 6.5, "read": 6.5, "ui": 7.5, "type": 7, "mobile": 6.5, "ground": 6, "polish": 6.5 },
  "ab": { "art": "B", "place": "B", "chars": "tie", "juice": "B", "read": "B", "ui": "B", "type": "B", "mobile": "B", "ground": "B", "polish": "B" },
  "issues": [
    { "category": "art", "severity": "high", "shot": "desktop/r06-aim.png", "problem": "Softly painted buildings and forest behind heavily outlined geometric branch ladders and foliage blobs; the foreground reads as a separate illustration system.", "fix": "Painterly shading, organic junctions and softer outlines on playable trees.", "effort": "L" },
    { "category": "ground", "severity": "high", "shot": "desktop/r03-battle-north-summer.png", "problem": "The soil repeats conspicuous horizontal bands of equally detailed stones across the lower half.", "fix": "Vary strata and stone density, reduce deep-soil contrast, concentrate detail near the surface.", "effort": "M" },
    { "category": "ground", "severity": "medium", "shot": "desktop/r13-practice.png", "problem": "The valley ends in a narrow outlined trough while the road backdrop fills its interior: an artificial cutout edge.", "fix": "Integrate the valley floor with painted earth, contact shadows and a transition into the road.", "effort": "M" },
    { "category": "mobile", "severity": "high", "shot": "mobile/r06-aim.png", "problem": "The aiming view shows only the throwing family; the opponent is an arrow, so target and trajectory can't be judged together.", "fix": "An aiming camera that includes the target and trajectory extent, or a compact target inset.", "effort": "M" },
    { "category": "mobile", "severity": "high", "shot": "mobile/r13-practice.png", "problem": "Practice compresses the battlefield into a short strip with a blank brown area below; Hazel's label clipped.", "fix": "Fit the arena to the play area; clamp labels inside safe margins.", "effort": "M" },
    { "category": "read", "severity": "high", "shot": "desktop/r05-battle-middle-winter-night.png", "problem": "Gray squirrels, trunks, snow and the blue forest share similar values; the right family loses separation.", "fix": "Darken or soften the background behind combatants; a restrained light rim on squirrels and branches.", "effort": "M" },
    { "category": "chars", "severity": "medium", "shot": "desktop/r04-battle-south-fall.png", "problem": "Family members repeat identical poses and expressions.", "fix": "Distinct idle poses, ear and tail shapes and expressions visible at battle scale.", "effort": "L" },
    { "category": "juice", "severity": "medium", "shot": "desktop/r07-flight.png", "problem": "The walnut is a small outlined disk with no visible directional trail.", "fix": "A short directional trail, contrasting particles, a clearer rotating silhouette.", "effort": "M" },
    { "category": "juice", "severity": "medium", "shot": "desktop/r08-impact.png", "problem": "The impact is dominated by the damage number; ring and particles disappear into the bright facade.", "fix": "Stronger impact silhouette, contrasting burst colours, visible leaves and fragments.", "effort": "M" },
    { "category": "type", "severity": "medium", "shot": "mobile/r03-battle-north-summer.png", "problem": "Seven inventory slots squeeze names, numbers, counts and icons; tiny labels on phones.", "fix": "Drop shortcut numbers on phones; larger item names.", "effort": "M" },
    { "category": "ui", "severity": "medium", "shot": "mobile/r12-help.png", "problem": "The sixth instruction fades under the Back footer; the scroll prompt mentions only the nut guide.", "fix": "An explicit scroll cue for all instructions and enough bottom spacing.", "effort": "S" },
    { "category": "place", "severity": "medium", "shot": "desktop/r03-battle-north-summer.png", "problem": "The tower is a thin skeletal structure beside the bathhouses, weakening its relation to the mountain.", "fix": "Place it within the distant ridge with detail matching the painted architecture.", "effort": "M" },
    { "category": "polish", "severity": "medium", "shot": "mobile/r11-results.png", "problem": "Enlarged result-screen squirrels have soft raster edges beside crisp text.", "fix": "Higher-resolution celebration art for the result panel.", "effort": "M" }
  ]
}
```

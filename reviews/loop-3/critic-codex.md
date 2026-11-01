# Loop 3 · Critic B (Codex, blind)

```json
{
  "scores": { "art": 6.5, "place": 7, "chars": 7, "juice": 6.5, "read": 6.5, "ui": 7, "type": 6.5, "mobile": 6, "ground": 6.5, "polish": 6.5 },
  "ab": { "art": "A", "place": "tie", "chars": "A", "juice": "A", "read": "A", "ui": "A", "type": "tie", "mobile": "A", "ground": "A", "polish": "A" },
  "issues": [
    { "category": "mobile", "severity": "high", "shot": "mobile/r06-aim.png", "problem": "The off-screen arrow and label cover Maple's nameplate; same collision in the winter battle.", "fix": "A separate edge rail for off-screen indicators that avoids labels.", "effort": "M" },
    { "category": "type", "severity": "high", "shot": "mobile/r07-flight.png", "problem": "The instruction ends at 'Tap for th...'; turn instructions truncated.", "fix": "Short mobile copy ('Tap for trick'); allow wrapping.", "effort": "S" },
    { "category": "mobile", "severity": "high", "shot": "mobile/r13-practice.png", "problem": "The practice overview makes squirrels and targets tiny with empty sky and soil; Hazel's label clips the left edge; dense overlapping trajectory dots.", "fix": "Fit the playable bounds to the action area, clamp labels inside the viewport, space dots in screen pixels.", "effort": "M" },
    { "category": "ui", "severity": "medium", "shot": "mobile/r12-help.png", "problem": "The sixth instruction disappears under the fixed Back footer with no scroll cue.", "fix": "A clear scroll indicator and enough bottom padding.", "effort": "S" },
    { "category": "art", "severity": "high", "shot": "desktop/r03-battle-north-summer.png", "problem": "Painted forest and architecture clash with circular cloud clusters, flat distant hills and heavily outlined foliage.", "fix": "Shared painted treatment for clouds, hills and playable trees.", "effort": "L" },
    { "category": "ground", "severity": "medium", "shot": "desktop/r06-aim.png", "problem": "The valley bottom exposes a rectangular gray slab and a bright green patch with abrupt boundaries.", "fix": "A continuous painted valley floor with integrated soil, vegetation and steam.", "effort": "M" },
    { "category": "ground", "severity": "medium", "shot": "desktop/r04-battle-south-fall.png", "problem": "Underground areas repeat pebble dots and parallel contour lines; the grass edge is a thin uniform ribbon.", "fix": "Varied strata and rock clusters; irregular roots, tufts and leaf accumulation along the surface.", "effort": "M" },
    { "category": "chars", "severity": "medium", "shot": "desktop/r05-battle-middle-winter-night.png", "problem": "Family members repeat nearly identical silhouettes and poses.", "fix": "Distinct tails, proportions, accessories and expressions within each family.", "effort": "L" },
    { "category": "juice", "severity": "medium", "shot": "desktop/r09-knockout.png", "problem": "Ash stays upright during the knockout, like a hovering idle squirrel with stars.", "fix": "A rotated, curled tumble pose with a stronger arc and branch debris.", "effort": "M" },
    { "category": "read", "severity": "medium", "shot": "desktop/r06-aim.png", "problem": "The aim guide loses contrast against the yellow-green forest; gray squirrels compete with foliage.", "fix": "Subdue the background behind gameplay; stronger light-and-dark guide outline.", "effort": "M" },
    { "category": "read", "severity": "medium", "shot": "desktop/r07-flight.png", "problem": "A walnut is airborne while the readout says 'Acorn', inconsistent.", "fix": "Keep the launched nut's name visible through flight and impact.", "effort": "S" },
    { "category": "place", "severity": "medium", "shot": "desktop/r13-practice.png", "problem": "The tower is a tiny cabin on a thin mast.", "fix": "A more distinctive observation-deck silhouette at landmark scale.", "effort": "M" },
    { "category": "polish", "severity": "medium", "shot": "mobile/r01-title.png", "problem": "Both title squirrels are cropped by the screen edges; the menu hides the setting.", "fix": "Mascots inside the safe area and a visible strip of the Row.", "effort": "M" }
  ]
}
```

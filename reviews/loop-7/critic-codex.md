# Loop 7 · Critic B (Codex, blind)

```json
{
  "scores": { "art": 7, "place": 7.5, "chars": 7, "juice": 7, "read": 6.5, "ui": 6.5, "type": 7, "mobile": 5.5, "ground": 6.5, "polish": 6.5 },
  "ab": { "art": "A", "place": "A", "chars": "tie", "juice": "A", "read": "A", "ui": "B", "type": "B", "mobile": "B", "ground": "A", "polish": "A" },
  "issues": [
    { "category": "mobile", "severity": "high", "shot": "mobile/r10-shop.png", "problem": "The shop fills the screen with rows, leaving Next round outside the visible panel with no scroll cue.", "fix": "A persistent footer for Next round; the list scrolls within the remaining height.", "effort": "M" },
    { "category": "mobile", "severity": "high", "shot": "mobile/r09-knockout.png", "problem": "The -64 runs beyond the right edge.", "fix": "Clamp damage text to screen-safe bounds.", "effort": "S" },
    { "category": "read", "severity": "high", "shot": "mobile/r13-practice.png", "problem": "Aim dots cross Hazel's name and crowd Rusty's label; labels far above small squirrels.", "fix": "Collision-avoiding labels near their squirrels; a clear trajectory corridor.", "effort": "M" },
    { "category": "mobile", "severity": "medium", "shot": "mobile/r13-practice.png", "problem": "The field occupies a shallow strip between sky and a blank brown band.", "fix": "Fit the practice camera to launcher and target bounds within the play area.", "effort": "M" },
    { "category": "type", "severity": "medium", "shot": "mobile/r06-aim.png", "problem": "The walnut description ends at 'that rattles ...'.", "fix": "Two lines or a concise complete description.", "effort": "S" },
    { "category": "read", "severity": "medium", "shot": "mobile/r08-impact.png", "problem": "Blast rings and -38 cover Willow and overlap nameplates.", "fix": "Nameplates above effects; damage text offset into clear space.", "effort": "M" },
    { "category": "art", "severity": "medium", "shot": "desktop/r03-battle-north-summer.png", "problem": "The detailed painted background competes with outlined squirrels and angular sparse trees.", "fix": "Simplify background contrast; bring trees closer to the character art.", "effort": "L" },
    { "category": "chars", "severity": "medium", "shot": "desktop/r05-battle-middle-winter-night.png", "problem": "Family members repeat the same body, face and pose.", "fix": "Distinct tails, proportions, accessories and idle expressions at battle scale.", "effort": "L" },
    { "category": "ground", "severity": "medium", "shot": "desktop/r04-battle-south-fall.png", "problem": "Dense pebble speckles and horizontal texture; a thin bright rim along the whole edge.", "fix": "Larger strata, fewer speckles, a varied rim with roots, rock and broken turf.", "effort": "L" },
    { "category": "place", "severity": "medium", "shot": "desktop/r13-practice.png", "problem": "The tower reads as a generic lattice lookout with a rectangular cabin.", "fix": "A distinctive observation-deck silhouette integrated into the mountain.", "effort": "M" },
    { "category": "juice", "severity": "medium", "shot": "desktop/r07-flight.png", "problem": "The airborne walnut shows position more than motion.", "fix": "A tapered trail, rotation cues or fading particles.", "effort": "M" },
    { "category": "ui", "severity": "medium", "shot": "mobile/r12-help.png", "problem": "The footer and fade obscure the end of the sixth instruction.", "fix": "Scroll padding; fade between cards.", "effort": "S" },
    { "category": "polish", "severity": "medium", "shot": "mobile/r11-results.png", "problem": "Statistics and prose dominate the victory panel; the celebration sprites are small.", "fix": "A larger celebration composition; shorter Field Notes.", "effort": "M" }
  ]
}
```

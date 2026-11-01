# Loop 7 · Critic A (Claude, blind)

```json
{
  "scores": { "art": 7, "place": 6.5, "chars": 6, "juice": 5.5, "read": 6.5, "ui": 7, "type": 6.5, "mobile": 5.5, "ground": 6, "polish": 6.5 },
  "ab": { "art": "A", "place": "tie", "chars": "tie", "juice": "A", "read": "A", "ui": "A", "type": "A", "mobile": "A", "ground": "A", "polish": "A" },
  "issues": [
    { "category": "mobile", "severity": "high", "shot": "mobile/r13-practice.png", "problem": "In practice the Rustlers sit at the left edge with Hazel partly cut off and plates overlapping; empty sky above and a brown band above the HUD; action in a ~300px strip.", "fix": "Frame the active family with side margin, anchor terrain to the HUD top, zoom so squirrels are 40px+, stack plates.", "effort": "M" },
    { "category": "mobile", "severity": "high", "shot": "mobile/r09-knockout.png", "problem": "The '-64' is cut off at the right edge; the 'Ash is out!' banner wraps to two lines; a leaf pile shows through behind the disabled Move button.", "fix": "Keep numbers in the safe area; one-line banner; opaque HUD dock.", "effort": "S" },
    { "category": "mobile", "severity": "medium", "shot": "mobile/r08-impact.png", "problem": "The flight camera pulls back so far squirrels are ~25px; '-38' over Willow's plate; the ring hides the target.", "fix": "Closer zoom following the nut; numbers above plates.", "effort": "M" },
    { "category": "juice", "severity": "high", "shot": "desktop/r08-impact.png", "problem": "The hit reads as a thin beige double ring and '-38', like a UI focus ring.", "fix": "Leaf-and-bark burst, hit flash and squash, branch wobble, short shake; brighter expanding ring.", "effort": "M" },
    { "category": "juice", "severity": "medium", "shot": "desktop/r09-knockout.png", "problem": "The knockout is a static upside-down pose with tiny stars and faint puffs; 'Knockout!' and 'Ash is out!' repeat.", "fix": "Motion lines and spin, bigger dizzy stars, leaf shower, dust pop on landing; merge the banners.", "effort": "M" },
    { "category": "art", "severity": "medium", "shot": "desktop/r09-knockout.png", "problem": "At knockout zoom the painted backdrop is visibly upscaled and soft while sprites stay crisp.", "fix": "A 2x backdrop or cap zoom at native resolution.", "effort": "L" },
    { "category": "chars", "severity": "high", "shot": "desktop/r03-battle-north-summer.png", "problem": "Squirrels ~35px in the same seated pose; families differ mainly by colour; faces unreadable.", "fix": "Bigger heads and eyes at play scale; distinct silhouettes; wind-up, idle and flinch poses.", "effort": "L" },
    { "category": "place", "severity": "medium", "shot": "desktop/r06-aim.png", "problem": "The backdrop reads as a generic Mediterranean town; steam lies on the asphalt like exhaust.", "fix": "The Row in true order with key facades; rising white steam wisps from the springs.", "effort": "L" },
    { "category": "ground", "severity": "medium", "shot": "desktop/r03-battle-north-summer.png", "problem": "Flat dark-brown fill with even pebbles and a thin green edge; trees with no base; the leaf pile on an odd grey shelf.", "fix": "Lighter topsoil band, roots under trees, grass clumps, occlusion at tree bases; remove the grey shelf.", "effort": "M" },
    { "category": "art", "severity": "low", "shot": "desktop/r06-aim.png", "problem": "The right ~60px of the backdrop fades into a white haze band.", "fix": "Extend past the camera bounds or clamp.", "effort": "S" },
    { "category": "read", "severity": "medium", "shot": "desktop/r03-battle-north-summer.png", "problem": "The active marker is a ~12px triangle; the aim preview shows only 5-6 dots; the wind is far from the play area.", "fix": "A pulsing ring under the active squirrel; a longer preview; drifting wind streaks in the sky.", "effort": "S" },
    { "category": "ui", "severity": "medium", "shot": "desktop/r07-flight.png", "problem": "During flight the bottom bar dims to ~40%, labels unreadable, Throw! muddy; the nut info wraps ragged.", "fix": "Subtle lock instead of heavy dimming; left-aligned two-line nut info.", "effort": "S" },
    { "category": "type", "severity": "medium", "shot": "desktop/r02-story-map.png", "problem": "Story tile names ~9px; tiny chips; three type families.", "fix": "13px+ tile labels; one display face plus one body face.", "effort": "S" },
    { "category": "ui", "severity": "low", "shot": "desktop/r02-story-map.png", "problem": "The story map is a grid of text tiles with no map or route.", "fix": "An illustrated trail with nodes and season thumbnails.", "effort": "M" },
    { "category": "polish", "severity": "low", "shot": "desktop/r12-help.png", "problem": "How to Play is narrow on desktop and needs scrolling despite free space.", "fix": "Wider panel with the nut guide as a second column.", "effort": "S" }
  ]
}
```

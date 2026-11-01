# Loop 1 · Critic B (Codex, blind)

```json
{
  "scores": { "art": 6, "place": 7, "chars": 5.5, "juice": 5.5, "read": 5.5, "ui": 6.5, "type": 6, "mobile": 4, "ground": 5, "polish": 5.5 },
  "issues": [
    { "category": "mobile", "severity": "high", "shot": "mobile/r03-battle-north-summer.png", "problem": "The turn prompt names Hazel but the viewport shows only the opposing family; the thrower is offscreen (also r04, r05).", "fix": "Frame the active squirrel at turn start, with a clear way to pan toward targets.", "effort": "M" },
    { "category": "ui", "severity": "high", "shot": "mobile/r13-practice.png", "problem": "Practice status runs off the left edge; the wind panel overflows right and wraps.", "fix": "Separate responsive row for practice status; constrain the wind panel.", "effort": "S" },
    { "category": "polish", "severity": "high", "shot": "mobile/r13-practice.png", "problem": "An 'Ash is out!' banner remains over the practice range.", "fix": "Clear knockout notifications when entering practice.", "effort": "S" },
    { "category": "ui", "severity": "medium", "shot": "desktop/r12-help.png", "problem": "The nut list is cut off partway through its fourth entry with no visible close button or scroll cue.", "fix": "Bounded scrolling area with a scroll cue and a persistent back control.", "effort": "M" },
    { "category": "art", "severity": "high", "shot": "desktop/r04-battle-south-fall.png", "problem": "The painted forest and architecture clash with thick foliage blobs, stick trunks, gradient-sphere rocks and very simple clouds.", "fix": "Unify edge treatment, shading and detail density across foreground trees, rocks, clouds and the backdrop.", "effort": "L" },
    { "category": "chars", "severity": "medium", "shot": "desktop/r06-aim.png", "problem": "Both families share the same silhouette; faces tiny at desktop size; coat colour and HUD carry the distinction.", "fix": "Distinct tail and body shapes, larger faces, stronger throw and reaction poses.", "effort": "L" },
    { "category": "read", "severity": "high", "shot": "desktop/r06-aim.png", "problem": "Small pale trajectory dots disappear into bright foliage.", "fix": "Strong contrasting outline, consistent dot size, reduce background contrast behind the play area.", "effort": "M" },
    { "category": "juice", "severity": "medium", "shot": "desktop/r07-flight.png", "problem": "The airborne nut is a small dark disk without a trail.", "fix": "Short contrasting motion trail, projectile rim, stronger release pose.", "effort": "M" },
    { "category": "juice", "severity": "medium", "shot": "desktop/r08-impact.png", "problem": "Impact is mostly a thin ring and a damage number; little disruption.", "fix": "Brief burst, displaced leaves, bent branch, exaggerated recoil.", "effort": "M" },
    { "category": "type", "severity": "medium", "shot": "desktop/r03-battle-north-summer.png", "problem": "Names and nut labels much smaller than the HUD; 'Hedge apple' squeezed onto two tiny lines.", "fix": "Larger minimum label sizes, wider nameplates, simpler nut labels.", "effort": "M" },
    { "category": "ground", "severity": "high", "shot": "desktop/r03-battle-north-summer.png", "problem": "Large brown soil fills dominate; scattered round stones; the valley ends in a flat gray rectangular plug.", "fix": "Coherent strata and embedded rocks; finish the valley floor with a designed creek or ground transition.", "effort": "L" },
    { "category": "place", "severity": "medium", "shot": "desktop/r13-practice.png", "problem": "The tower is a narrow lattice mast with a tiny cap, weakening its landmark identity.", "fix": "A more distinctive observation structure integrated into the mountain.", "effort": "M" },
    { "category": "polish", "severity": "medium", "shot": "desktop/r11-results.png", "problem": "Three stars with all-zero stats look unpopulated.", "fix": "Populate meaningful statistics consistent with the stars.", "effort": "M" },
    { "category": "mobile", "severity": "medium", "shot": "mobile/r06-aim.png", "problem": "Mobile readout drops the selected nut's trick explanation.", "fix": "Compact selected-nut description above the controls.", "effort": "M" }
  ]
}
```

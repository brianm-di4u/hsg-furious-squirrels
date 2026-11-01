# Loop 6 · Critic A (Claude, blind)

```json
{
  "scores": { "art": 7, "place": 7.5, "chars": 6.5, "juice": 6, "read": 7, "ui": 7, "type": 6.5, "mobile": 7, "ground": 6.5, "polish": 6.5 },
  "ab": { "art": "A", "place": "B", "chars": "tie", "juice": "B", "read": "B", "ui": "B", "type": "tie", "mobile": "B", "ground": "B", "polish": "tie" },
  "issues": [
    { "category": "art", "severity": "high", "shot": "r03-battle-north-summer.png", "problem": "The painted backdrop does not reach the right edge: from ~x=1190 a washed-out strip with pale blobs and a ghosted dome; same in r01, r04-r08.", "fix": "Backdrop at least as wide as the widest framing (or clamp/scale to cover); drop the edge fade.", "effort": "S" },
    { "category": "art", "severity": "medium", "shot": "r06-aim.png", "problem": "Squirrels read as stickers on the painting; trees are a cruder vector style.", "fix": "Darker thinner outline, soft contact shadow, rim light; canopies in the backdrop's brush style.", "effort": "M" },
    { "category": "chars", "severity": "medium", "shot": "r03-battle-north-summer.png", "problem": "Squirrels ~35px; faces and poses unreadable; grey ones nearly vanish against white facades.", "fix": "Scale up 25-35%; distinct silhouettes; darker coat or outline for the grey family.", "effort": "M" },
    { "category": "juice", "severity": "high", "shot": "r08-impact.png", "problem": "A Black Walnut impact shows only a thin ring and '-38'.", "fix": "Radial burst, shell fragments, leaf shower, squash hit pose, short shake.", "effort": "M" },
    { "category": "juice", "severity": "medium", "shot": "r07-flight.png", "problem": "The nut in flight is a small dark disc with no trail.", "fix": "A fading trail, rim glow and spin blur.", "effort": "S" },
    { "category": "read", "severity": "medium", "shot": "r08-impact.png", "problem": "The '-38' lands on the target's name tag ('Wi-38'); on mobile it covers Pebble's label.", "fix": "Spawn numbers above the tag, offset from other labels.", "effort": "S" },
    { "category": "read", "severity": "medium", "shot": "r04-battle-south-fall.png", "problem": "Aim dots run through Rusty's tag; orange squirrels blend into fall canopy.", "fix": "Tags above the arc; darker outline or halo in autumn.", "effort": "S" },
    { "category": "ground", "severity": "medium", "shot": "r06-aim.png", "problem": "A huge dirt cross-section with pebbles fills ~40% of the screen; the valley floor ends in a small pale oval; the road shows through the V.", "fix": "Strata, roots, buried nuts and moss, darker toward the bottom; a clearly painted steaming pool or a bridge.", "effort": "M" },
    { "category": "ground", "severity": "low", "shot": "r09-knockout.png", "problem": "In the zoomed knockout the terrain softens while the backdrop stays crisp.", "fix": "Render terrain at device-pixel resolution or regenerate on zoom.", "effort": "M" },
    { "category": "ui", "severity": "medium", "shot": "r12-help.png", "problem": "Help cards are uneven; the nut list is cut under the footer; '↓ more below' crowds Back.", "fix": "Two-column tips, a separate nut guide section, scroll hint apart from the button.", "effort": "S" },
    { "category": "ui", "severity": "low", "shot": "r10-shop.png", "problem": "Shop is a plain list; ~16px icons; cramped two-line Buy chips.", "fix": "32-40px icons; single-line price buttons; a wood-sign header.", "effort": "S" },
    { "category": "type", "severity": "medium", "shot": "r03-battle-north-summer.png", "problem": "Name tags ~10px, tray captions ~11px; wind pill reads only '1 →'; three type families.", "fix": "13px minimum HUD text; 'Wind 1 →'; one display plus one body font.", "effort": "S" },
    { "category": "mobile", "severity": "medium", "shot": "mobile/r07-flight.png", "problem": "Top HUD ~300px and bottom ~360px squeeze the playfield; empty sky band.", "fix": "Treeline just under the minimap; merge readout into the Throw row.", "effort": "M" },
    { "category": "mobile", "severity": "low", "shot": "mobile/r06-aim.png", "problem": "The target inset lower right covers Maple and the hillside.", "fix": "Anchor the inset under the off-screen arrow in the sky band.", "effort": "S" },
    { "category": "polish", "severity": "low", "shot": "r01-title.png", "problem": "The tagline wraps leaving an orphan; the disclaimer is loud; the edge seam behind.", "fix": "One-line tagline; softer disclaimer; fix the edge.", "effort": "S" }
  ]
}
```

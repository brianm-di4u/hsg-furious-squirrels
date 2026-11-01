# Loop 3 · Critic A (Claude, blind)

```json
{
  "scores": { "art": 7.0, "place": 7.0, "chars": 6.5, "juice": 6.0, "read": 6.5, "ui": 7.0, "type": 6.5, "mobile": 6.5, "ground": 6.5, "polish": 6.5 },
  "ab": { "art": "A", "place": "tie", "chars": "A", "juice": "tie", "read": "A", "ui": "A", "type": "tie", "mobile": "A", "ground": "A", "polish": "A" },
  "issues": [
    { "category": "art", "severity": "high", "shot": "r03-battle-north-summer.png", "problem": "The painted backdrop is a finite panel; near x~100 and x~1080 it fades into a pale band and then a flat low-detail green hill with blurred blobs: two visible seams in every desktop battle.", "fix": "Extend the painting to full width or paint matching forested ridge wings so there are no fade seams.", "effort": "M" },
    { "category": "ground", "severity": "high", "shot": "r03-battle-north-summer.png", "problem": "A flat grey rectangle with a beige ellipse sits at the valley bottom in every battle and on the title; reads as an untextured placeholder, not a spring basin.", "fix": "A painted stone spring pool or tufa basin with rim stones, steaming water and moss, shaded to match the dirt.", "effort": "S" },
    { "category": "ground", "severity": "medium", "shot": "r05-battle-middle-winter-night.png", "problem": "On the winter night map the valley floor is a reflective water surface but the yellow road dashes are still drawn across it.", "fix": "One floor treatment per map.", "effort": "S" },
    { "category": "juice", "severity": "high", "shot": "r08-impact.png", "problem": "The impact is a thin faint ring and a '-38': no dust or bark puffs, no leaf burst, no squash or recoil on Willow.", "fix": "Chunky leaf-and-bark burst, 2-3 frame squash on the struck squirrel, outlined pop-scaled damage number.", "effort": "M" },
    { "category": "juice", "severity": "high", "shot": "r09-knockout.png", "problem": "'Ash is out!' shows but Ash is nowhere on screen: no tumble, falling body or landing.", "fix": "Keep the camera on the tumble from branch to leaf pile with a spin, leaf splash and dizzy pose; banner after landing.", "effort": "M" },
    { "category": "read", "severity": "medium", "shot": "r08-impact.png", "problem": "The '-38' is drawn over Willow's nameplate, hiding the name and health bar.", "fix": "Offset damage numbers above the nameplate or flash the bar.", "effort": "S" },
    { "category": "chars", "severity": "medium", "shot": "r06-aim.png", "problem": "Squirrels ~25-30px inside similar-value foliage; grey Tails blend into pale blossom trees; identical sitting sprites.", "fix": "~25% larger with a contrasting rim; distinct idle poses per squirrel.", "effort": "M" },
    { "category": "read", "severity": "medium", "shot": "r07-flight.png", "problem": "The nut in flight is a small dark disc ~20px with no trail against the busy forest.", "fix": "Short motion trail or light halo; spin.", "effort": "S" },
    { "category": "mobile", "severity": "high", "shot": "mobile/r09-knockout.png", "problem": "On phones the 'Ash is out!' banner covers the minimap; the status chip is truncated on every mobile battle.", "fix": "Anchor the banner below the minimap; shorter status copy for narrow widths or a two-line chip.", "effort": "S" },
    { "category": "mobile", "severity": "medium", "shot": "mobile/r07-flight.png", "problem": "The bottom panel covers the valley floor and leaf piles; a band of empty sky above; thrower and target cut at the edges.", "fix": "Shift framing down so the valley sits just above the panel; merge the readout into the Throw row.", "effort": "M" },
    { "category": "ui", "severity": "medium", "shot": "r01-title.png", "problem": "Squirrel nameplates poke out behind the title menu buttons; mascots collide with the subtitle pill.", "fix": "Hide in-game nameplates on the title screen or dim behind the menu.", "effort": "S" },
    { "category": "type", "severity": "medium", "shot": "r12-help.png", "problem": "How to Play cards, shop rows and tray labels ~10-11px light tan on brown; 'game fiction' chips smaller still.", "fix": "14px minimum modal body text, 12px tray labels, text colour toward cream.", "effort": "S" },
    { "category": "place", "severity": "low", "shot": "r04-battle-south-fall.png", "problem": "Each map shows only 3-4 bathhouses in varied crops; signature features appear only in some shots.", "fix": "A consistent recognisable segment in every map, including the Quapaw dome and Arlington towers.", "effort": "M" },
    { "category": "polish", "severity": "low", "shot": "r11-results.png", "problem": "Stars are flat outlines with no fill animation; portrait squirrels float with no ground.", "fix": "A small leaf-pile plinth under the portraits and animated star fills.", "effort": "S" }
  ]
}
```

// Prove every level is playable (PRD AC17; LESSONS wave 1: content ships with a Node-side checker).
//   node tools/check-levels.mjs [levelId]
// For each level and family: every spawn snaps to a perch on its own mountain, perch graphs are connected, and from
// EVERY starting squirrel there is an acorn throw that hits a rival (direct or splash) at wind -max, 0 and +max.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Sim } from '../src/js/sim/battle.js';
import { NUTS, SQ_UP } from '../src/js/sim/const.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function checkLevel(L) {
  const issues = [], d = NUTS.acorn;
  const sim = new Sim(L, { seed: 1, teamSize: L.teamSize, human: [true, true] });
  for (let t = 0; t < 2; t++) {
    const g = sim.graphs[t];
    // connectivity: every node reachable from the first ground node
    const seen = new Set([g.nodes[0].id]), stack = [g.nodes[0].id];
    while (stack.length) for (const e of g.edges.get(stack.pop())) if (!seen.has(e.to)) { seen.add(e.to); stack.push(e.to); }
    if (seen.size !== g.nodes.length) issues.push(`team ${t}: ${g.nodes.length - seen.size} perch nodes unreachable`);
    for (const n of g.nodes) if ((t === 0 && n.x > L.floorX) || (t === 1 && n.x < L.floorX)) issues.push(`team ${t}: perch ${n.id} on the wrong mountain`);
  }
  if (L.practice) return issues;
  for (const q of sim.b.squirrels) {
    sim.b.turn.team = q.team; sim.b.turn.sq = q.id;
    for (const w of [-1, 0, 1]) {
      sim.b.wind = w * sim.b.windLevel;
      let ok = false;
      for (let a = 5; a <= 85 && !ok; a += 2.5) for (let p = 0.3; p <= 1 && !ok; p += 0.025) {
        const im = sim.preview({ nut: 'acorn', angle: a, power: p }).impact;
        if (!im) continue;
        for (const e of sim.b.squirrels) {
          if (e.team === q.team) continue;
          if ((im.type === 'squirrel' && im.sq === e.id) || Math.hypot(e.x - im.x, e.y - SQ_UP - im.y) < d.splashR * 0.7) { ok = true; break; }
        }
      }
      if (!ok) issues.push(`${q.name} (team ${q.team}) has no hitting throw at wind ${w}`);
    }
  }
  return issues;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'levels/all.json'), 'utf8'));
  const only = process.argv[2];
  let bad = 0;
  for (const L of Object.values(all)) {
    if (only && L.id !== only) continue;
    const t0 = performance.now(), issues = checkLevel(L);
    console.log(`${issues.length ? 'FAIL' : 'OK  '} ${L.id.padEnd(9)} ${L.name.padEnd(24)} ${(performance.now() - t0).toFixed(0)} ms${issues.length ? '\n     ' + issues.join('\n     ') : ''}`);
    if (issues.length) bad++;
  }
  process.exit(bad ? 1 : 0);
}

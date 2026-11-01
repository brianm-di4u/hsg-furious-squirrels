// Node checks for the birds (MECHANICS.md §6b): deterministic rolls, bounce, snatch, preview ignores birds,
// and old saved battles load without them.   node tools/check-birds.mjs
import fs from 'node:fs';
import { Sim } from '../src/js/sim/battle.js';
import { birdPos } from '../src/js/sim/birds.js';
import { BIRDS } from '../src/js/sim/const.js';

const all = JSON.parse(fs.readFileSync(new URL('../levels/all.json', import.meta.url), 'utf8'));
let bad = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${msg}`); if (!c) bad++; };

// same seed, same birds
const a = new Sim(all['story-07'], { seed: 9, birds: 'lots', human: [true, true] }), b = new Sim(all['story-07'], { seed: 9, birds: 'lots', human: [true, true] });
ok(JSON.stringify(a.b.birds) === JSON.stringify(b.b.birds) && a.b.birds.length > 0, `same seed gives the same ${a.b.birds.length} birds (${[...new Set(a.b.birds.map((x) => x.k))].join(', ')})`);
ok(new Sim(all['story-07'], { seed: 9, human: [true, true] }).b.birds.length === 0, 'birds default to off');
ok(new Sim(all['story-06'], { seed: 9, birds: 'lots', human: [true, true] }).b.birds.length === 0, 'no birds at night');
// fall and winter pools only hold birds that are around then
for (const id of ['story-04', 'story-07', 'story-10', 'story-02']) {
  const L = all[id], ks = new Set();
  for (let s = 1; s < 40; s++) for (const x of new Sim(L, { seed: s, birds: 'lots', human: [true, true] }).b.birds) ks.add(x.k);
  ok([...ks].every((k) => BIRDS[k].seasons.includes(L.season)), `${id} (${L.season}): ${[...ks].join(', ')}`);
}

// put one bird of a kind right on a throw's path and fly it
function shoot(kind, nut, seed = 3) {
  const sim = new Sim(all['story-07'], { seed, birds: 'some', human: [true, true] });
  sim.b.wind = 0;
  const aim = { nut, angle: 45, power: 0.75 }, clean = sim.preview(aim, { squirrels: false });
  const pt = clean.pts[Math.floor(clean.pts.length * 0.3)];
  sim.b.birds = [{ k: kind, dir: 1, x0: 0, alt: 0, v: 0, ph: 0, ox: 0, oy: 0, R: 1, cx: 0, flee: null }];
  // a frozen bird parked at that point (v = 0; oy places it)
  const env = sim.env(); sim.b.birds[0].x0 = pt[0]; sim.b.birds[0].oy = pt[1] - env.floorY; sim.b.birds[0].alt = 0;
  const pos = birdPos(sim.b.birds[0], 0, env);
  const withBird = sim.preview(aim, { squirrels: false });
  sim.throwNut(aim);
  const evs = [];
  for (let i = 0; i < 120 * 20 && sim.busy(); i++) { sim.step(); evs.push(...sim.drain()); }
  return { evs, pos, pt, same: JSON.stringify(withBird.impact) === JSON.stringify(clean.impact) };
}
{
  const r = shoot('goose', 'walnut');
  ok(Math.hypot(r.pos.x - r.pt[0], r.pos.y - r.pt[1]) < 160, `test bird parked near the path (${r.pos.x.toFixed(0)},${r.pos.y.toFixed(0)} vs ${r.pt[0].toFixed(0)},${r.pt[1].toFixed(0)})`);
  ok(r.same, 'preview ignores birds');
  const hit = r.evs.find((e) => e.type === 'bird'), after = r.evs.findIndex((e) => e.type === 'bird');
  ok(!!hit && r.evs.slice(after + 1).some((e) => e.type === 'impact' || e.type === 'miss'), `a goose bounces a walnut and the flight carries on (${r.evs.map((e) => e.type).join(' ')})`);
}
{
  let snatched = 0, bounced = 0;
  for (let s = 1; s <= 20; s++) { const r = shoot('jay', 'acorn', s); if (r.evs.some((e) => e.type === 'snatch')) snatched++; else if (r.evs.some((e) => e.type === 'bird')) bounced++; }
  ok(snatched > 0 && bounced > 0, `jays snatch some acorns (${snatched}/20) and bounce the rest (${bounced})`);
  let walnut = 0; for (let s = 1; s <= 10; s++) if (shoot('jay', 'walnut', s).evs.some((e) => e.type === 'snatch')) walnut++;
  ok(walnut === 0, 'jays never take a walnut');
}
// a battle saved before birds existed
{
  const s = new Sim(all['story-07'], { seed: 4, human: [true, true] }), old = s.toJSON();
  delete old.birds; delete old.birdT; delete old.birdLevel; delete old.rng.birds;
  const r = new Sim(all['story-07'], {}, old); r.throwNut({ nut: 'acorn', angle: 40, power: 0.7 }); r.settleNow(); r.nextTurn && 0;
  ok(Array.isArray(r.b.birds) && Number.isFinite(r.b.rng.birds), 'an old saved battle loads and plays');
}
process.exit(bad ? 1 : 0);

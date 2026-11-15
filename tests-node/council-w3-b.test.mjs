// Council wave 3, batch B, rules that need no browser: the aim preview can fly with the birds (P-N05).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Sim } from '../src/js/sim/battle.js';
import { birdPos } from '../src/js/sim/birds.js';
import { DT } from '../src/js/sim/const.js';

const all = JSON.parse(fs.readFileSync(new URL('../levels/all.json', import.meta.url), 'utf8'));

// A bird that is moving (a crow at 145 units a second) and is exactly where the clean arc is `frac` of the way through
// its flight, at the moment the nut gets there.
function crowOnTheArc(sim, aim, frac = 0.3) {
  const clean = sim.preview(aim, { squirrels: false }), j = Math.floor(clean.pts.length * frac), step = j * 4, T = sim.b.birdT + step * DT;
  const bird = { k: 'crow', dir: 1, x0: 0, alt: 0, v: 145, ph: 0, ox: 0, oy: 0, R: 1, cx: 0, flee: null }, env = sim.env();
  // a crow's height is the floor, its altitude and offset, and a small bob (no ground clamp: the arc is well above it)
  const p0 = birdPos(bird, T, env);
  bird.x0 = clean.pts[j][0] - p0.x; bird.oy = clean.pts[j][1] - (env.floorY + Math.sin(T * 2.2) * 6);
  sim.b.birds = [bird];
  return { clean, pt: clean.pts[j], step };
}

test('the preview flies with the birds on request and meets the bird the real flight meets', () => {
  const sim = new Sim(all['story-07'], { seed: 3, birds: 'some', human: [true, true] }), aim = { nut: 'acorn', angle: 45, power: 0.75 };
  sim.b.wind = 0;
  const { clean, pt } = crowOnTheArc(sim, aim);
  const rngBefore = JSON.stringify(sim.b.rng), birdsBefore = JSON.stringify(sim.b.birds);
  const plain = sim.preview(aim, { squirrels: false }), withBird = sim.preview(aim, { squirrels: false, birds: true });
  assert.equal(JSON.stringify(plain.impact), JSON.stringify(clean.impact), 'by default the preview still ignores birds');
  assert.equal(withBird.impact.type, 'bird', 'asked to, it meets the crow');
  assert.ok(Math.hypot(withBird.impact.bx - pt[0], withBird.impact.by - pt[1]) < 40, 'where the moving crow is as the nut arrives (within its reach of 23 units and its own travel)');
  assert.equal(JSON.stringify(sim.b.rng), rngBefore, 'and draws no random numbers');
  assert.equal(JSON.stringify(sim.b.birds), birdsBefore, 'and startles no bird');
  // the real flight, same battle: the event is at the same place
  sim.throwNut(aim);
  const evs = [];
  for (let i = 0; i < 120 * 20 && sim.busy(); i++) { sim.step(); evs.push(...sim.drain()); }
  const hit = evs.find((e) => e.type === 'bird' || e.type === 'snatch');
  assert.ok(hit, 'the thrown nut meets the crow');
  assert.ok(Math.hypot(hit.x - withBird.impact.bx, hit.y - withBird.impact.by) < 1, 'at the place the preview marked');
});

test('a bird that is not on the arc, or has flown off, changes nothing', () => {
  const sim = new Sim(all['story-07'], { seed: 3, birds: 'some', human: [true, true] }), aim = { nut: 'acorn', angle: 45, power: 0.75 };
  sim.b.wind = 0;
  const { clean } = crowOnTheArc(sim, aim);
  sim.b.birds[0].oy -= 400; // far above the arc
  assert.equal(JSON.stringify(sim.preview(aim, { squirrels: false, birds: true }).impact), JSON.stringify(clean.impact), 'a bird well away from the arc is not met');
  sim.b.birds[0].oy += 400; sim.b.birds[0].flee = { t: 0, x: 0, y: 0, vx: 1, vy: 1 };
  assert.notEqual(sim.preview(aim, { squirrels: false, birds: true }).impact.type, 'bird', 'a startled bird cannot be hit again');
});

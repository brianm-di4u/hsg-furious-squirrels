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

// ---- S3-05 ----
import { starsFor, koAllowed } from '../src/js/story.js';

test('the star rule: two a side keeps every squirrel, three or four a side may lose one', () => {
  const s = (win, outs, size, turns = 5, par = 10) => starsFor({ win, outs, size, turns, par });
  assert.equal(s(false, 0, 3), 0, 'a loss earns nothing, however neat');
  assert.equal(s(true, 0, 2, 20), 2, 'two a side, nothing lost, over par: two stars');
  assert.equal(s(true, 1, 2, 20), 1, 'two a side, one lost: one star');
  assert.equal(s(true, 1, 3, 20), 2, 'three a side, one lost: the second star');
  assert.equal(s(true, 2, 3, 5), 2, 'three a side, two lost, within par: win and par, no second star');
  assert.equal(s(true, 1, 4, 10), 3, 'four a side, one lost, exactly at par: three stars');
  assert.equal(s(true, 2, 4, 5), 2, 'four a side, two lost: no second star');
  assert.equal(s(true, 0, 4, 11), 2, 'four a side, nothing lost, one turn over par: two stars');
  assert.deepEqual([2, 3, 4].map(koAllowed), [0, 1, 1]);
});

// ---- S3-12 ----
import { DIFF, TIERS, aiTier } from '../src/js/sim/ai.js';

test('the human stand-in is noisier than Medium, Sharp and Hard, is not a tier a player can pick, and has targets', () => {
  assert.ok(!TIERS.includes('human'), 'it is not one of the four tiers');
  assert.equal(aiTier('human'), 1, 'asking the game for it by name gives Medium, as for any unknown name');
  for (const t of ['medium', 'sharp', 'hard']) assert.ok(DIFF.human.sa > DIFF[t].sa && DIFF.human.sp > DIFF[t].sp, `noisier than ${t}`);
  assert.ok(DIFF.human.sa >= 2 && DIFF.human.sp >= 0.025, 'a couple of degrees and a few percent of power');
  const T = JSON.parse(fs.readFileSync(new URL('../tools/balance-targets.json', import.meta.url), 'utf8'));
  assert.ok(T.humanBeatsMedium[0] < T.humanBeatsMedium[1] && T.humanBeatsMedium[0] >= 0.3 && T.humanBeatsMedium[1] <= 0.6, 'human against Medium is meant to be an even match');
  assert.ok(T.threeStars[0] > 0 && T.threeStars[1] < 0.5, 'three stars is meant to be reachable but not common');
  assert.ok(Object.keys(DIFF).filter((k) => !TIERS.includes(k)).join() === 'human', 'and nothing else is in the table beside the tiers');
});

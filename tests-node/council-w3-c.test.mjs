// Council wave 3, batch C, rules that need no browser: S3-06 (the special nuts), S3-13 (the second thrower's bonus), P-N02 (Story stars over rounds).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NUTS, NUT_ORDER, NUT_BEST } from '../src/js/sim/const.js';
import { Sim } from '../src/js/sim/battle.js';

const targets = JSON.parse(fs.readFileSync(new URL('../tools/balance-targets.json', import.meta.url), 'utf8'));
const balance = fs.readFileSync(new URL('../tools/balance.mjs', import.meta.url), 'utf8');

test('S3-06 the four weakest specials hit harder, and each special has a best-for line', () => {
  assert.equal(NUTS.pecan.direct, 56);
  assert.equal(NUTS.chinquapin.direct, 22);
  assert.equal(NUTS.sweetgum.direct, 50);
  assert.equal(NUTS.hedgeapple.direct, 50);
  for (const k of NUT_ORDER.filter((n) => n !== 'acorn')) assert.match(NUT_BEST[k], /^Best for: [^.]{12,60}\.$/, k);
});

test('S3-06 the balance tool checks that no special falls far short of the acorn', () => {
  assert.equal(targets.specialFloor, 0.85);
  assert.ok(balance.includes('weakest special / acorn'));
  assert.ok(balance.includes('T.specialFloor'));
});

// ---- S3-13 ----
const levels = JSON.parse(fs.readFileSync(new URL('../levels/all.json', import.meta.url), 'utf8'));
const story2 = levels['story-02'];
const bonusFor = (unlocked) => {
  const sim = new Sim(story2, { seed: 11, mode: 'story', teamSize: 2, rounds: 1, human: [true, false], loadout: 'story', unlocked });
  const first = sim.b.turn.team, second = 1 - first;
  return { first: { ...sim.b.teams[first].inventory }, second: { ...sim.b.teams[second].inventory } };
};

test('S3-13 before the walnut, the second thrower gets one extra of the best special it has', () => {
  let r = bonusFor(['chinquapin']);
  assert.equal(r.second.chinquapin, r.first.chinquapin + 1, 'a family with only the Trio gets a Trio');
  r = bonusFor(['chinquapin', 'pecan']);
  assert.equal(r.second.pecan, r.first.pecan + 1, 'the pecan is chosen before the Trio');
  r = bonusFor(['chinquapin', 'pecan', 'hickory']);
  assert.equal(r.second.hickory, r.first.hickory + 1, 'the hickory is the best of those three');
  assert.equal(r.second.pecan, r.first.pecan, 'and only one kind gets it');
});

test('S3-13 the walnut is still the bonus once it is unlocked, and nothing is given with no special', () => {
  let r = bonusFor(['chinquapin', 'pecan', 'hickory', 'walnut']);
  assert.equal(r.second.walnut, r.first.walnut + 1);
  assert.equal(r.second.hickory, r.first.hickory);
  r = bonusFor([]);
  assert.deepEqual(r.second, r.first, 'battle 1 has only acorns: nothing to give');
});


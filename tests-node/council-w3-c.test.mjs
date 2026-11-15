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

// ---- P-N02 ----
import { starsFor, parFor } from '../src/js/story.js';

test('P-N02 a battle of several rounds is judged over all of them, and a single round is judged as it was', () => {
  const base = { win: true, size: 4, par: 14 };
  assert.equal(starsFor({ ...base, outs: 1, turns: 14 }), 3, 'one round: unchanged');
  assert.equal(starsFor({ ...base, outs: 2, turns: 14 }), 2);
  assert.equal(starsFor({ ...base, outs: 2, turns: 20, rounds: 2 }), 3, 'two rounds allow two lost squirrels and 28 turns');
  assert.equal(starsFor({ ...base, outs: 3, turns: 20, rounds: 2 }), 2, 'a third lost squirrel costs the star');
  assert.equal(starsFor({ ...base, outs: 2, turns: 29, rounds: 2 }), 2, 'and a 29th turn costs the other');
  assert.equal(starsFor({ ...base, size: 2, outs: 1, turns: 10, rounds: 3 }), 2, 'two a side still lose none');
  assert.equal(starsFor({ ...base, win: false, outs: 0, turns: 1, rounds: 3 }), 0);
  assert.equal(parFor(14, 3), 42);
  assert.equal(parFor(14), 14);
});

test('P-N02 the Sim counts the squirrels each family lost over every round, and an old saved battle gets defaults', () => {
  const L = levels['story-12'];
  const sim = new Sim(L, { seed: 5, mode: 'story', teamSize: 4, rounds: 3, human: [true, false], loadout: 'story', unlocked: [] });
  assert.deepEqual([sim.b.played, ...sim.b.lost], [0, 0, 0]);
  sim.forceRound(1); // the rivals win round one: all four of ours are out
  assert.deepEqual([sim.b.played, ...sim.b.lost], [1, 4, 0]);
  sim.continueBattle();
  assert.ok(sim.b.squirrels.every((q) => !q.out), 'the next round starts with everyone back');
  sim.forceRound(0);
  sim.continueBattle();
  sim.forceRound(0);
  assert.equal(sim.b.phase, 'battleEnd');
  assert.deepEqual([sim.b.played, ...sim.b.lost], [3, 4, 8], 'round one is still counted at the end');
  const old = sim.toJSON(); delete old.lost; delete old.played; old.round = 2;
  const back = new Sim(L, {}, old);
  assert.deepEqual([back.b.played, ...back.b.lost], [1, 0, 0], 'a battle saved before this counts its finished rounds and starts the losses at none');
});

// ---- S1-17 ----
import { planTurn, DIFF, aiTier } from '../src/js/sim/ai.js';

// the first throw of a turn-one Hard rival at zero wind and with a plain acorn, over 5 levels x 8 fixed seeds: the same 40 games every run
function firstThrowHits(tier) {
  let hit = 0, n = 0;
  for (const num of [2, 4, 6, 8, 11]) {
    const L = levels[`story-${String(num).padStart(2, '0')}`];
    for (let s = 0; s < 8; s++) {
      const sim = new Sim(L, { seed: 300 + s * 17 + num, teamSize: 3, human: [false, false], loadout: 'practice', wind: 'off', birds: 'off' });
      const team = sim.b.turn.team;
      sim.throwNut(planTurn(sim, tier, { nut: 'acorn', noMove: true })); sim.settleNow();
      if (sim.drain().some((e) => (e.type === 'hit' || e.type === 'ko') && sim.b.squirrels.find((q) => q.id === e.sq).team !== team)) hit++;
      n++;
    }
  }
  return { hit, n };
}

test('S1-17 Hard no longer lands its first throw nearly every time, and still settles once it has a range', () => {
  assert.ok(DIFF.hard.first > 1 && ['easy', 'medium', 'sharp', 'human'].every((k) => DIFF[k].first === 1), 'only Hard starts with a wider aim');
  const mid = aiTier('hard', -0.5);
  assert.ok(mid > 2 && mid < 3);
  const L = levels['story-04'];
  const sim = new Sim(L, { seed: 321, teamSize: 3, human: [false, false], loadout: 'practice', wind: 'off', birds: 'off' });
  const tm = sim.b.teams[sim.b.turn.team];
  planTurn(sim, 'hard', { nut: 'acorn', noMove: true });
  assert.equal(tm.ai.k, DIFF.hard.first, 'a new target gets the first-shot noise');
  const target = tm.ai.target;
  planTurn(sim, 'hard', { nut: 'acorn', noMove: true });
  if (tm.ai.target === target) assert.ok(tm.ai.k < DIFF.hard.first * 0.4, `and the next throw at it is steadier (${tm.ai.k})`);
  const { hit, n } = firstThrowHits('hard');
  assert.ok(hit <= 0.85 * n, `${hit} of ${n} first throws hit`);
  const sharp = firstThrowHits('sharp');
  assert.ok(hit >= sharp.hit - 6, `and Hard is not worse than Sharp by more than luck: ${hit} against ${sharp.hit}`);
});

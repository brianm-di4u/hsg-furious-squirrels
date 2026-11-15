// Council wave 2, batch B: the acorn economy (S3-01) and difficulty tiers (S3-04), the parts that need no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DIFF, TIERS, aiTier, planTurn } from '../src/js/sim/ai.js';
import { Sim, aiBuys, aiShop, startInventory } from '../src/js/sim/battle.js';
import { ACORNS, NUTS, NUT_CAP, PURSE_CAP } from '../src/js/sim/const.js';

const MODULE = new URL('../src/js/save.js', import.meta.url);
const all = JSON.parse(fs.readFileSync(new URL('../levels/all.json', import.meta.url), 'utf8'));
const story = Object.values(all).filter((L) => /^story-/.test(L.id)).sort((a, b) => a.n - b.n);
let serial = 0;
function rig(initial = null) {
  let raw = initial === null ? null : JSON.stringify(initial);
  globalThis.window = { localStorage: { getItem: () => raw, setItem: (_k, v) => { raw = v; } } };
  return {
    get saved() { return raw === null ? null : JSON.parse(raw); },
    async tab() {
      const m = await import(MODULE.href + '?w2b=' + (++serial)); const s = m.loadSave();
      return { m, s, write: (intent = 'merge', fields = []) => m.writeSave(s, { intent, fields }) };
    },
  };
}
// a save as the game wrote it before this wave: no purse, no star tiers
const oldSave = () => ({
  v: 1, settings: { sound: true, music: true, volume: 0.5, reducedMotion: null, aimGuide: 'auto', turnTimer: 0, textScale: 1, difficulty: 'medium', tutorial: true },
  story: { team: 0, unlocked: 4, stars: { 'story-01': 3, 'story-02': 2 }, nuts: [] },
  quick: { level: 'story-01', team: 0, size: 3, rounds: 1, wind: 'normal', steam: 'on', birds: 'some', loadout: 'all', difficulty: 'medium' },
  stats: { battles: 5, wins: 3, kos: 7, bestShot: 40 }, resume: null,
});

test('S3-04 the skill tiers step down in aim noise and up in cunning from Easy to Hard, Sharp between Medium and Hard', () => {
  assert.deepEqual(TIERS, ['easy', 'medium', 'sharp', 'hard']);
  for (let i = 1; i < TIERS.length; i++) {
    const a = DIFF[TIERS[i - 1]], b = DIFF[TIERS[i]];
    assert.ok(b.sa < a.sa, `${TIERS[i]} aims truer than ${TIERS[i - 1]}`);
    assert.ok(b.sp < a.sp, `${TIERS[i]} judges power better`);
    assert.ok(b.special >= a.special && b.move >= a.move && b.bracket >= a.bracket, `${TIERS[i]} uses specials, moves and zeroes in at least as much`);
  }
  assert.ok(DIFF.sharp.sa > DIFF.hard.sa && DIFF.sharp.sa < DIFF.medium.sa);
});

test('S3-04 aiTier moves a rival along the scale, clamped, and an unknown name means Medium', () => {
  assert.equal(aiTier('medium'), 1);
  assert.equal(aiTier('medium', -0.4), 0.6);
  assert.equal(aiTier('hard', 0.4), 3);
  assert.equal(aiTier('easy', -0.4), 0);
  assert.equal(aiTier('nightmare'), 1);
  assert.equal(aiTier('sharp', undefined), 2);
});

test('S3-04 every Story level carries a skill that ramps up the campaign and averages out near zero', () => {
  const sk = story.map((L) => L.skill);
  assert.equal(sk.length, 12);
  assert.ok(sk.every((n) => typeof n === 'number' && Math.abs(n) <= 0.5), 'offsets stay within half a tier');
  for (let i = 1; i < sk.length; i++) assert.ok(sk[i] >= sk[i - 1], 'the rival never gets easier as the story goes on');
  assert.ok(sk[0] < 0 && sk[11] > 0, 'an easier first battle and a harder finale');
  assert.ok(Math.abs(sk.reduce((a, b) => a + b, 0) / sk.length) <= 0.1, 'the campaign as a whole is still the Medium of old');
  assert.equal(all.gray.skill, undefined);
});

test('S3-04 the rival plans a turn at a fractional tier, and the plan is a legal throw', () => {
  for (const tier of [0.6, 1.4, 2.5, 3]) {
    const sim = new Sim(all['story-03'], { seed: 11, mode: 'story', human: [false, false], loadout: 'story', unlocked: ['chinquapin', 'pecan'] });
    const p = planTurn(sim, tier);
    assert.ok(p && Number.isFinite(p.angle) && p.power > 0 && p.power <= 1, `tier ${tier} made a plan`);
    assert.ok(sim.throwNut(p));
  }
});

test('S3-01 the satchel shop: both families start from the same purse and buy by the same rules', () => {
  const kinds = ['chinquapin', 'pecan', 'walnut'];
  const purse = 100;
  const buys = [{ pecan: 2 }, aiBuys(kinds, purse)];
  const sim = new Sim(all['story-05'], { seed: 3, mode: 'story', human: [true, false], loadout: 'story', unlocked: kinds, acorns: [purse, purse], buys });
  const [me, rival] = sim.b.teams;
  assert.equal(me.acorns, purse - 2 * NUTS.pecan.price);
  assert.equal(me.inventory.pecan, 3);
  const rivalCost = Object.entries(buys[1]).reduce((n, [k, c]) => n + c * NUTS[k].price, 0);
  assert.equal(rival.acorns, purse - rivalCost);
  assert.ok(rivalCost > 0 && rivalCost <= purse, 'the rival spent part of the purse and never overspent');
  for (const k of kinds) assert.ok(me.inventory[k] <= NUT_CAP + 1 && rival.inventory[k] <= NUT_CAP + 1);
});

test('S3-01 buying past the cap or the purse is refused, and no opts means the battle of old exactly', () => {
  const kinds = ['pecan'];
  const sim = new Sim(all['story-03'], { seed: 3, mode: 'story', human: [true, false], loadout: 'story', unlocked: kinds, acorns: [50, 50], buys: [{ pecan: 5 }, {}] });
  // one bought, and the family that throws second also gets a bonus of its best special (S3-13: before the walnut, the pecan here)
  assert.equal(sim.b.teams[0].inventory.pecan, 2 + (sim.b.turn.team === 0 ? 0 : 1), 'only one affordable at 30 acorns from 50');
  assert.equal(sim.b.teams[0].acorns, 20);
  const plain = new Sim(all['story-03'], { seed: 3, mode: 'story', human: [true, false], loadout: 'story', unlocked: kinds });
  const same = new Sim(all['story-03'], { seed: 3, mode: 'story', human: [true, false], loadout: 'story', unlocked: kinds, acorns: undefined, buys: undefined });
  assert.equal(plain.b.teams[0].acorns, ACORNS.start);
  assert.deepEqual(plain.b.teams.map((t) => [t.acorns, t.inventory]), same.b.teams.map((t) => [t.acorns, t.inventory]));
});

test('S3-01 aiBuys never overspends and matches what the shop charges', () => {
  const kinds = ['chinquapin', 'pecan', 'walnut', 'hickory'];
  for (const purse of [0, 30, 60, 150, 240]) {
    const buys = aiBuys(kinds, purse);
    const spent = Object.entries(buys).reduce((n, [k, c]) => n + c * NUTS[k].price, 0);
    const twin = new Sim(all['story-07'], { seed: 5, mode: 'story', human: [false, false], loadout: 'story', unlocked: kinds, acorns: [purse, purse], buys: [buys, {}] });
    assert.equal(twin.b.teams[0].acorns, purse - spent, `purse ${purse}`);
    for (const [k, c] of Object.entries(buys)) assert.ok(1 + c <= NUT_CAP, `${k} stays within the cap`);
    const live = new Sim(all['story-07'], { seed: 5, mode: 'story', human: [false, false], loadout: 'story', unlocked: kinds, acorns: [purse, purse] });
    aiShop(live, 0);
    assert.ok(live.b.teams[0].acorns >= 0);
  }
  assert.deepEqual(Object.keys(startInventory('story', ['pecan'])), ['pecan']);
});

test('S3-01 the purse survives a write and a reload, is held at the cap, and a pre-wave save starts with 60', async () => {
  const r = rig(oldSave()); const a = await r.tab();
  assert.equal(a.s.story.acorns, ACORNS.start);
  assert.equal(a.s.story.stars['story-01'], 3);
  a.s.story.acorns = 135; a.write('result');
  assert.equal(r.saved.story.acorns, 135);
  const b = await r.tab();
  assert.equal(b.s.story.acorns, 135);
  b.s.story.acorns = 99999; b.write('result');
  assert.equal((await r.tab()).s.story.acorns, PURSE_CAP);
  const bad = oldSave(); bad.story.acorns = 'lots';
  assert.equal((await rig(bad).tab()).s.story.acorns, ACORNS.start);
});

test('S3-01 a save from before this wave loads with the starting purse, no star tiers, and nothing lost', async () => {
  const r = rig(oldSave()); const a = await r.tab();
  assert.equal(a.s.story.acorns, ACORNS.start);
  assert.deepEqual(a.s.story.starTier, {});
  assert.equal(a.s.story.stars['story-01'], 3);
  assert.equal(a.s.story.unlocked, 4);
  assert.deepEqual(a.m.starTiers(a.s.story, 'story-01'), [2, 2, 2], 'old stars count as earned on Medium');
  assert.deepEqual(a.m.starTiers(a.s.story, 'story-02'), [2, 2, 0]);
  assert.deepEqual(a.m.starTiers(a.s.story, 'story-09'), [0, 0, 0]);
  assert.equal(r.saved.story.acorns, undefined, 'reading a save writes nothing');
});

test('S3-01 the purse and the star tiers survive a write and a reload, and the purse is capped', async () => {
  const r = rig(oldSave()); const a = await r.tab();
  a.s.story.acorns = 135; a.s.story.starTier['story-02'] = [3, 3, 0]; a.s.story.stars['story-02'] = 2; a.write('result');
  assert.equal(r.saved.story.acorns, 135);
  assert.deepEqual(r.saved.story.starTier['story-02'], [3, 3, 0]);
  const b = await r.tab();
  assert.equal(b.s.story.acorns, 135);
  assert.deepEqual(b.s.story.starTier['story-02'], [3, 3, 0]);
  b.s.story.acorns = 99999; b.write('result');
  const c = await r.tab();
  assert.equal(c.s.story.acorns, PURSE_CAP, 'a hand-edited purse is held at the cap');
});

test('S3-01 a damaged purse or tier record falls back to the defaults without touching the rest', async () => {
  const bad = oldSave(); bad.story.acorns = 'lots'; bad.story.starTier = { 'story-01': [9, 1], 'story-02': [3, 2, 1], 'story-03': 'x' };
  const a = await rig(bad).tab();
  assert.equal(a.s.story.acorns, ACORNS.start);
  assert.deepEqual(a.s.story.starTier, { 'story-02': [3, 2, 1] });
  assert.equal(a.s.story.stars['story-01'], 3);
  const neg = oldSave(); neg.story.acorns = -5; neg.settings.difficulty = 'nightmare'; neg.quick.difficulty = 7;
  const b = await rig(neg).tab();
  assert.equal(b.s.story.acorns, ACORNS.start);
  assert.equal(b.s.settings.difficulty, 'medium');
  assert.equal(b.s.quick.difficulty, 'medium');
  const sharp = oldSave(); sharp.settings.difficulty = 'sharp';
  assert.equal((await rig(sharp).tab()).s.settings.difficulty, 'sharp');
});

test('S3-04 two tabs earning on different tiers merge to the highest tier per star', async () => {
  const r = rig(oldSave()); const a = await r.tab(), b = await r.tab();
  a.s.story.stars['story-03'] = 3; a.s.story.starTier['story-03'] = [4, 4, 4]; a.s.story.acorns = 80; a.write('result');
  b.s.story.stars['story-03'] = 2; b.s.story.starTier['story-03'] = [2, 2, 0]; b.s.story.acorns = 150; b.write('result');
  assert.deepEqual(r.saved.story.starTier['story-03'], [4, 4, 4]);
  assert.equal(r.saved.story.stars['story-03'], 3);
  assert.equal(r.saved.story.acorns, 150, 'the purse is the last battle written');
});

test('S3-01 Reset progress puts the purse and the tiers back to the start', async () => {
  const r = rig(oldSave()); const a = await r.tab();
  a.s.story.acorns = 200; a.s.story.starTier['story-01'] = [4, 4, 4]; a.write('result');
  const settings = a.s.settings; for (const k of Object.keys(a.s)) delete a.s[k];
  Object.assign(a.s, a.m.DEFAULT_SAVE(), { settings }); a.write('reset');
  assert.equal(r.saved.story.acorns, ACORNS.start);
  assert.deepEqual(r.saved.story.starTier, {});
});

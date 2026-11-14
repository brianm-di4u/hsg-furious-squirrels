// Council wave 2, batch B: the acorn economy (S3-01) and difficulty tiers (S3-04), the parts that need no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  assert.equal(sim.b.teams[0].inventory.pecan, 2, 'only one affordable at 30 acorns from 50');
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

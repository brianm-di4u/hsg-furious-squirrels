// Council wave 2, batch B: the acorn economy (S3-01) and difficulty tiers (S3-04).
import fs from 'node:fs';
const SAVE_KEY = 'hsg-furious-squirrels-v1';
const SHOTS = '../_council/hsg-furious-squirrels/wave-2/shots';

const saved = (t) => t.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);
// a fresh profile on the Story map with the given progress (written through the game's own save path)
async function profile(t, story = {}, settings = {}) {
  await t.game('act', 'clearSave');
  await t.reload();
  await t.game('setState', { story: { team: 0, ...story }, settings });
  await t.game('act', 'menu', 'story');
}
const snap = async (t, name) => {
  await t.shot(name);
  fs.mkdirSync(SHOTS, { recursive: true });
  await t.page.screenshot({ path: `${SHOTS}/${name}-${t.viewport}.png` });
};
const rows = (t) => t.page.$$eval('.nutrow.pack', (r) => r.map((e) => ({ name: e.querySelector('b').textContent, have: e.querySelector('.price').textContent, buyOff: e.querySelector('[data-act="prepBuy"]').disabled, undoOff: e.querySelector('[data-act="prepUndo"]').disabled })));
const purseText = (t) => t.page.$eval('#screens .panel p b', (e) => e.textContent);
const click = (t, sel) => t.page.click(sel);

export const tests = [
  {
    name: 'S3-01 a Story battle with specials opens the satchel shop, and buying and undoing follow the purse',
    async run(t) {
      await profile(t, { unlocked: 3, acorns: 100 });
      await t.game('act', 'menu', 'play', { v: 'story-03' });
      let s = await t.state();
      t.equal(s.screen, 'prep', 'the satchel screen comes before the battle');
      t.equal(s.scene, 'title', 'no battle has started yet');
      t.expect(/Pack your satchel/.test(await t.page.textContent('#screens')), 'titled Pack your satchel');
      t.expect(/Battle 3: Dome at Dusk/.test(await t.page.textContent('#screens')), 'names the battle');
      t.equal(await purseText(t), 'Your acorns: 100');
      let r = await rows(t);
      t.equal(r.map((x) => x.name).join('|'), 'Chinquapin Trio|Pecan Dart', 'one row per unlocked special');
      t.equal(r[0].have, '1/3', 'one of each to start');
      await snap(t, 'S3-01-satchel');
      await click(t, '[data-act="prepBuy"][data-kind="pecan"]');
      await click(t, '[data-act="prepBuy"][data-kind="pecan"]');
      t.equal(await purseText(t), 'Your acorns: 40', 'two Pecan Darts at 30 each');
      t.equal((await t.state()).lastSaid, 'Pecan Dart packed. 40 acorns left.', 'the purchase is announced');
      r = await rows(t);
      t.equal(r[1].have, '3/3'); t.expect(r[1].buyOff, 'Buy is off at the cap of three');
      await click(t, '[data-act="prepUndo"][data-kind="pecan"]');
      t.equal(await purseText(t), 'Your acorns: 70', 'Undo gives the acorns back');
      await click(t, '[data-act="prepBuy"][data-kind="chinquapin"]');
      await click(t, '[data-act="prepBuy"][data-kind="chinquapin"]');
      t.equal(await purseText(t), 'Your acorns: 10');
      r = await rows(t);
      t.expect(r.every((x) => x.buyOff), 'nothing more is affordable with 10 acorns');
      // every control is a real, big enough button
      const small = await t.page.$$eval('#screens button:not([disabled])', (b) => b.map((e) => { const q = e.getBoundingClientRect(); return [e.textContent.trim(), Math.round(q.width), Math.round(q.height)]; }).filter(([, w, h]) => w < 44 || h < 44));
      t.equal(small.length, 0, 'touch targets under 44 px: ' + JSON.stringify(small));
      await t.checkLayout();
      await click(t, '[data-act="prepGo"]');
      s = await t.state();
      t.equal(s.scene, 'battle', 'Start battle starts the battle');
      const me = s.battle.teams[0], rival = s.battle.teams[1];
      t.equal(me.inventory.pecan, 2); t.equal(me.inventory.chinquapin, 3);
      t.equal(me.acorns, 10, 'the player keeps what was not spent');
      const costOf = (inv) => 30 * ((inv.pecan - 1) + (inv.chinquapin - 1));
      t.equal(rival.acorns, 100 - costOf(rival.inventory), 'the rival started from the same purse and paid for what it packed');
      t.expect(costOf(rival.inventory) > 0, 'the rival shopped too');
    },
  },
  {
    name: 'S3-01 the first battle has nothing to buy, so it starts at once from the purse',
    viewports: ['desktop'],
    async run(t) {
      await profile(t, { unlocked: 1, acorns: 75 });
      await t.game('act', 'menu', 'play', { v: 'story-01' });
      const s = await t.state();
      t.equal(s.scene, 'battle', 'no satchel screen in battle 1');
      t.equal(s.battle.teams[0].acorns, 75, 'the banked purse is what the player starts with');
      t.equal(s.battle.teams[1].acorns, 75, 'and the rival starts with the same');
    },
  },
  {
    name: 'S3-01 unspent acorns are banked after a Story battle, shown on the results, and carry to the next battle',
    async run(t) {
      await profile(t, { unlocked: 2, acorns: 90 });
      await t.game('act', 'menu', 'play', { v: 'story-02' });
      await click(t, '[data-act="prepGo"]');
      let s = await t.state();
      t.equal(s.battle.teams[0].acorns, 90, 'nothing bought, nothing spent');
      await t.game('scene', 'results');
      s = await t.state();
      t.equal(s.screen, 'results');
      const left = s.battle.teams[0].acorns;
      t.expect(left > 90, 'the round earns acorns: ' + left);
      t.equal(s.save.story.acorns, left, 'the purse is what the player had at the end');
      t.equal(await t.page.$eval('.banked b', (e) => e.textContent), String(left), 'results show the acorns banked');
      await snap(t, 'S3-01-results');
      await t.reload();
      t.equal((await t.state()).save.story.acorns, left, 'the purse survives a reload');
      await t.game('act', 'menu', 'story');
      await t.game('act', 'menu', 'play', { v: 'story-03' });
      t.equal(await purseText(t), 'Your acorns: ' + left, 'the next battle shop opens with the banked purse');
    },
  },
  {
    name: 'S3-01 Back from the satchel returns to the map and spends nothing; a restart replays the same battle',
    viewports: ['desktop'],
    async run(t) {
      await profile(t, { unlocked: 3, acorns: 100 });
      await t.game('act', 'menu', 'play', { v: 'story-03' });
      await click(t, '[data-act="prepBuy"][data-kind="pecan"]');
      await click(t, '[data-act="prepBack"]');
      let s = await t.state();
      t.equal(s.screen, 'story'); t.equal(s.save.story.acorns, 100, 'nothing was spent by leaving');
      await t.game('act', 'menu', 'play', { v: 'story-03' });
      t.equal(await purseText(t), 'Your acorns: 100', 'a new visit starts from the purse again');
      await click(t, '[data-act="prepBuy"][data-kind="pecan"]');
      await click(t, '[data-act="prepGo"]');
      await t.game('act', 'menu', 'restart');
      s = await t.state();
      t.equal(s.scene, 'battle'); t.equal(s.battle.teams[0].inventory.pecan, 2, 'Restart keeps the satchel that was packed');
      t.equal(s.battle.teams[0].acorns, 70);
      // after the battle, Play again goes back through the shop with the new purse (no free repeat of the old one)
      await t.game('scene', 'results');
      const bank = (await t.state()).save.story.acorns;
      await t.game('act', 'menu', 'again');
      t.equal((await t.state()).screen, 'prep', 'Play again opens the satchel shop');
      t.equal(await purseText(t), 'Your acorns: ' + bank);
    },
  },
  {
    name: 'S3-01 a Quick Battle opens a shop before round one; Acorns only and Practice skip it',
    async run(t) {
      await profile(t, { unlocked: 1 });
      await t.game('act', 'menu', 'quick');
      await t.game('act', 'menu', 'quickGo');
      let s = await t.state();
      t.equal(s.screen, 'prep', 'the default Quick Battle (all seven nuts) opens the shop');
      t.equal(await purseText(t), 'Your acorns: 60');
      t.equal((await rows(t)).length, 6, 'all six specials are for sale');
      await snap(t, 'S3-01-quick-satchel');
      await click(t, '[data-act="prepBuy"][data-kind="hedgeapple"]');
      await click(t, '[data-act="prepGo"]');
      s = await t.state();
      t.equal(s.scene, 'battle'); t.equal(s.battle.teams[0].inventory.hedgeapple, 2); t.equal(s.battle.teams[0].acorns, 0);
      t.equal(s.save.story.acorns, 60, 'a Quick Battle never touches the Story purse');
      await t.game('scene', 'results');
      t.equal((await saved(t)).story.acorns, 60, 'and does not bank into it afterwards');
      t.equal(await t.page.$$eval('.banked', (e) => e.length), 0, 'no Acorns line where no shop follows');
      await t.game('act', 'menu', 'menu');
      await t.game('act', 'menu', 'quick');
      await t.game('act', 'menu', 'qset', { k: 'loadout', v: 'acorn' });
      await t.game('act', 'menu', 'quickGo');
      t.equal((await t.state()).scene, 'battle', 'Acorns only has nothing to buy');
      await t.game('act', 'menu', 'menu');
      await t.game('act', 'menu', 'practice');
      t.equal((await t.state()).scene, 'battle', 'Practice has no shop');
    },
  },
  {
    name: 'S3-01 a save from before this wave loads with a purse of 60 and every star it had',
    viewports: ['desktop'],
    async run(t) {
      const old = { v: 1, settings: { sound: true, music: true, volume: 0.5, reducedMotion: null, aimGuide: 'auto', turnTimer: 0, textScale: 1, difficulty: 'medium', tutorial: true },
        story: { team: 0, unlocked: 6, stars: { 'story-01': 3, 'story-02': 2, 'story-03': 1 }, nuts: [] },
        quick: { level: 'story-01', team: 0, size: 3, rounds: 1, wind: 'normal', steam: 'on', birds: 'some', loadout: 'all', difficulty: 'medium' },
        stats: { battles: 9, wins: 6, kos: 21, bestShot: 88 }, resume: null };
      await t.game('act', 'clearSave');
      await t.reload();
      await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [SAVE_KEY, old]);
      await t.reload();
      let s = await t.state();
      t.equal(s.save.story.acorns, 60, 'the starting purse');
      t.equal(s.save.story.unlocked, 6); t.equal(s.save.story.stars['story-01'], 3); t.equal(s.save.stats.kos, 21);
      await t.game('act', 'menu', 'story');
      t.equal(await t.page.$$eval('.lvl .tier', (e) => e.length), 0, 'stars from before count as earned on Medium: no difficulty marks on the map');
      t.expect(/Battle 1: Morning on the Row, 3 stars,/.test(await t.page.$eval('.lvl[data-v="story-01"]', (e) => e.getAttribute('aria-label') + ',')), 'story-01 still shows its three stars');
      await t.game('act', 'menu', 'play', { v: 'story-04' });
      t.equal(await purseText(t), 'Your acorns: 60');
    },
  },
];

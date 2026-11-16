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
      t.equal(r.map((x) => x.name).join('|'), 'Trio|Pecan', 'one row per unlocked special');
      t.equal(r[0].have, '1/3', 'one of each to start');
      await snap(t, 'S3-01-satchel');
      await click(t, '[data-act="prepBuy"][data-kind="pecan"]');
      await click(t, '[data-act="prepBuy"][data-kind="pecan"]');
      t.equal(await purseText(t), 'Your acorns: 40', 'two Pecans at 30 each');
      t.equal((await t.state()).lastSaid, 'Pecan packed. 40 acorns left.', 'the purchase is announced');
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
      // the family that throws second also gets a bonus pecan here (S3-13: its best special before the walnut)
      const bonus = (team) => (s.battle.turn.team === team ? 0 : 1);
      t.equal(me.inventory.pecan, 2 + bonus(0)); t.equal(me.inventory.chinquapin, 3);
      t.equal(me.acorns, 10, 'the player keeps what was not spent');
      // what the rival paid is what it packed, plus the second thrower's bonus nut when there is room for it (three of a kind is the most)
      const packed = (rival.inventory.pecan - 1) + (rival.inventory.chinquapin - 1), spent = 100 - rival.acorns;
      const extra = packed - spent / 30;
      t.expect(spent % 30 === 0 && (extra === 0 || extra === bonus(1)), `the rival started from the same purse and paid for what it packed: spent ${spent}, packed ${packed}`);
      t.expect(spent > 0, 'the rival shopped too');
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
      t.equal(s.scene, 'battle'); t.equal(s.battle.teams[0].inventory.pecan, 2 + (s.battle.turn.team === 0 ? 0 : 1), 'Restart keeps the satchel that was packed (and a bonus pecan for the second thrower, S3-13)');
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
      // a new profile now starts on Story unlocks (S2-09), which has no specials yet: All seven is chosen here, as the test always meant
      await t.game('act', 'menu', 'qset', { k: 'loadout', v: 'all' });
      await t.game('act', 'menu', 'quickGo');
      let s = await t.state();
      t.equal(s.screen, 'prep', 'a Quick Battle on all seven nuts opens the shop');
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
  {
    name: 'S3-04 stars are recorded with the difficulty they were earned on, and a lower tier never lowers the record',
    async run(t) {
      await profile(t, { unlocked: 2, stars: { 'story-02': 2 } }, { difficulty: 'hard' });
      await t.game('act', 'menu', 'play', { v: 'story-01' });
      await t.game('scene', 'results');
      let sv = await saved(t);
      t.equal(sv.story.stars['story-01'], 3);
      t.equal(JSON.stringify(sv.story.starTier['story-01']), '[4,4,4]', 'three stars on Hard');
      t.expect(/Played on Hard/.test(await t.page.textContent('#screens')), 'the results say which tier was played');
      await snap(t, 'S3-04-results-hard');
      // replay on Easy: the Hard record stays
      await t.game('act', 'menu', 'set', { k: 'difficulty', v: 'easy' });
      await t.game('act', 'menu', 'play', { v: 'story-01' });
      await t.game('scene', 'results');
      sv = await saved(t);
      t.equal(JSON.stringify(sv.story.starTier['story-01']), '[4,4,4]', 'an Easy win does not lower a Hard record');
      // a Sharp win on a level whose two old stars were Medium
      await t.game('act', 'menu', 'set', { k: 'difficulty', v: 'sharp' });
      await t.game('act', 'menu', 'play', { v: 'story-02' });
      await t.page.click('[data-act="prepGo"]');
      await t.game('scene', 'results');
      sv = await saved(t);
      t.equal(sv.story.stars['story-02'], 3, 'the third star was won');
      t.equal(JSON.stringify(sv.story.starTier['story-02']), '[3,3,3]', 'all three on Sharp (the old two were Medium, now beaten)');
      await t.game('act', 'menu', 'story');
      const marks = await t.page.$$eval('.lvl .tier', (e) => e.map((x) => x.closest('.lvl').dataset.v + ':' + x.textContent));
      t.equal(marks.join(','), 'story-01:Hard,story-02:Sharp', 'the map marks the tier of each level\'s best stars');
      t.expect(/3 stars on Hard/.test(await t.page.$eval('.lvl[data-v="story-01"]', (e) => e.getAttribute('aria-label'))), 'and says so to a screen reader');
      await snap(t, 'S3-04-story-map');
      await t.checkLayout();
    },
  },
  {
    name: 'S3-04 Sharp is offered between Medium and Hard on the Story map and in Quick Battle, and is saved',
    async run(t) {
      await profile(t, { unlocked: 1 });
      const seg = () => t.page.$$eval('.seg .btn[data-k="difficulty"]', (b) => b.map((x) => x.textContent));
      t.equal((await seg()).join('|'), 'Easy|Medium|Sharp|Hard', 'Story map');
      await click(t, '.seg .btn[data-k="difficulty"][data-v="sharp"]');
      t.equal((await t.state()).settings.difficulty, 'sharp');
      await snap(t, 'S3-04-difficulty-row');
      await t.checkLayout();
      await t.reload();
      t.equal((await t.state()).settings.difficulty, 'sharp', 'survives a reload');
      await t.game('act', 'menu', 'quick');
      t.equal((await t.page.$$eval('.btn[data-k="difficulty"]', (b) => b.map((x) => x.textContent))).join('|'), 'Easy|Medium|Sharp|Hard', 'Quick Battle rival skill');
      // a hand-edited save with a tier that does not exist falls back to Medium
      const sv = await saved(t); sv.settings.difficulty = 'nightmare';
      await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [SAVE_KEY, sv]);
      await t.reload();
      t.equal((await t.state()).settings.difficulty, 'medium');
    },
  },
  {
    name: 'S3-04 a Story level shifts the rival along the skill scale; Quick Battle uses the tier as picked',
    viewports: ['desktop'],
    async run(t) {
      await profile(t, { unlocked: 12 }, { difficulty: 'medium' });
      const tierOn = async (id) => { await t.game('act', 'menu', 'play', { v: id }); if ((await t.state()).screen === 'prep') await t.page.click('[data-act="prepGo"]'); return (await t.state()).rivalTier; };
      t.equal(await tierOn('story-01'), 0.6, 'a gentler rival in the first battle on Medium');
      t.equal(await tierOn('story-06'), 1, 'today\'s Medium in the middle of the story');
      t.equal(await tierOn('story-12'), 1.4, 'a harder rival in the finale');
      await t.game('act', 'menu', 'set', { k: 'difficulty', v: 'hard' });
      t.equal(await tierOn('story-12'), 3, 'Hard is as hard as the scale goes');
      await t.game('act', 'menu', 'set', { k: 'difficulty', v: 'easy' });
      t.equal(await tierOn('story-01'), 0, 'and Easy as easy');
      await t.game('newGame', { levelId: 'story-12', difficulty: 'sharp', seed: 4 });
      t.equal((await t.state()).rivalTier, 2, 'a Quick Battle ignores the level skill');
    },
  },
  {
    name: 'S3-04 the Sharp rival plans in short slices, like the others',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { levelId: 'story-09', seed: 6, difficulty: 'sharp' });
      await t.page.waitForFunction(() => window.__FS.loading === 0, null, { timeout: 30000 });
      await t.waitFrames(30);
      await t.page.evaluate(() => {
        const A = window.__FS; A.sim.b.teams.forEach((tm) => { tm.human = false; });
        window.__slices = [];
        A.aiActive = null; A.kick();
        const hook = () => {
          const g = A.aiActive && A.aiActive.gen;
          if (!g) return requestAnimationFrame(hook);
          const next = g.next.bind(g);
          g.next = (v) => { const t0 = performance.now(), r = next(v); window.__slices.push(performance.now() - t0); return r; };
        };
        hook();
      });
      await t.page.waitForFunction(() => window.__FS.aiActive && window.__FS.aiActive.done, null, { timeout: 30000 });
      const sl = await t.page.evaluate(() => window.__slices);
      const worst = [...sl].sort((a, b) => a - b)[Math.floor(sl.length * 0.9)] || 0;
      t.log(`Sharp rival plan: ${sl.length} slices, 90th percentile ${worst.toFixed(1)} ms`);
      t.expect(sl.length > 40, `the plan ran in ${sl.length} slices`);
      t.expect(worst < 20, `planning slices blocked the page for ${worst.toFixed(1)} ms`);
    },
  },
];

// Council wave 2, batch C: Records (S3-02), the feud's voice (S4-01) and the phone HUD (S4-15).
import fs from 'node:fs';
const SAVE_KEY = 'hsg-furious-squirrels-v1';
const SHOTS = '../_council/hsg-furious-squirrels/wave-2/shots';

const saved = (t) => t.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);
// a save as the game wrote it before this wave: no purse, no star tiers, no records
const oldSave = () => ({
  v: 1, settings: { sound: true, music: true, volume: 0.5, reducedMotion: null, aimGuide: 'auto', turnTimer: 0, textScale: 1, difficulty: 'medium', tutorial: true },
  story: { team: 0, unlocked: 4, stars: { 'story-01': 3, 'story-02': 2, 'story-03': 1 }, nuts: ['chinquapin', 'pecan'] },
  quick: { level: 'story-01', team: 0, size: 3, rounds: 1, wind: 'normal', steam: 'on', birds: 'some', loadout: 'all', difficulty: 'medium' },
  stats: { battles: 5, wins: 3, kos: 7, bestShot: 40 }, resume: null,
});
async function withSave(t, save) {
  await t.game('act', 'clearSave');
  await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [SAVE_KEY, save]);
  await t.reload();
}
async function fresh(t, story = {}) {
  await t.game('act', 'clearSave');
  await t.reload();
  if (Object.keys(story).length) await t.game('setState', { story: { team: 0, ...story } });
}
const snap = async (t, name) => {
  await t.shot(name);
  fs.mkdirSync(SHOTS, { recursive: true });
  await t.page.screenshot({ path: `${SHOTS}/${name}-${t.viewport}.png` });
};
const text = (t, sel = '#screens') => t.page.textContent(sel);
// start a Story battle (past the satchel screen when it shows) and finish it as a win for the player
async function winStory(t, id, difficulty = 'medium') {
  await t.game('setState', { settings: { difficulty } });
  await t.game('act', 'menu', 'play', { v: id });
  if ((await t.state()).screen === 'prep') await t.page.click('[data-act="prepGo"]');
  await t.game('scene', 'results');
  return t.state();
}

export const tests = [
  {
    name: 'S3-02 a pre-wave save shows its totals on the Records screen and loses nothing',
    async run(t) {
      await withSave(t, oldSave());
      await t.game('act', 'menu', 'records');
      let s = await t.state();
      t.equal(s.screen, 'records');
      const body = await text(t);
      t.expect(/Battles\s*5/.test(body) && /Wins\s*3/.test(body), 'battles and wins from the save: ' + body.slice(0, 200));
      t.expect(/Win rate\s*60%/.test(body), 'win rate is 3 of 5');
      t.expect(/Knockouts\s*7/.test(body) && /Biggest hit\s*40/.test(body), 'knockouts and biggest hit');
      t.expect(/Stars: 6 \/ 36/.test(body), 'six stars of thirty-six');
      t.expect(/Throw accuracy\s*none yet/.test(body), 'no accuracy is invented for an old save');
      t.expect(/1\. Morning on the Row/.test(body) && /not won yet/.test(body) && /locked/.test(body), 'a row for every battle');
      const st = (await saved(t));
      t.expect(!st || st.stats.battles === 5, 'reading wrote nothing over the old save');
      s = await t.state();
      t.equal(s.save.stats.battles, 5); t.equal(s.save.stats.bestShot, 40); t.equal(s.save.story.stars['story-01'], 3);
      t.equal(s.save.stats.streak, 0); t.equal(s.save.stats.winsHard, 0);
      t.equal(JSON.stringify(s.save.story.bestTurns), '{}', 'no best turns until a battle is won');
      await snap(t, 'S3-02-records');
      const small = await t.page.$$eval('#screens button:not([disabled])', (b) => b.map((e) => { const q = e.getBoundingClientRect(); return [e.textContent.trim(), Math.round(q.width), Math.round(q.height)]; }).filter(([, w, h]) => w < 44 || h < 44));
      t.equal(small.length, 0, 'touch targets under 44 px: ' + JSON.stringify(small));
      await t.checkLayout({ allowScrollY: true });
      await t.page.click('[data-act="recordsBack"]');
      t.equal((await t.state()).screen, 'title', 'Back returns to the title');
    },
  },
  {
    name: 'S3-02 the title and the Story map both open Records, and Back returns to where it was opened',
    viewports: ['desktop'],
    async run(t) {
      await fresh(t);
      await t.game('act', 'menu', 'back');
      t.expect(await t.page.$('.menu [data-act="records"]'), 'the title has a Records button');
      await t.page.click('.menu [data-act="records"]');
      t.equal((await t.state()).screen, 'records');
      await t.page.keyboard.press('Escape');
      t.equal((await t.state()).screen, 'title', 'Escape goes back to the title');
      await t.game('setState', { story: { team: 0 } });
      await t.game('act', 'menu', 'story');
      t.expect(/Stars: 0 \/ 36/.test(await text(t)), 'the map header counts stars');
      await t.page.click('[data-act="records"]');
      await t.page.click('[data-act="recordsBack"]');
      t.equal((await t.state()).screen, 'story', 'Back from Records returns to the Story map');
    },
  },
  {
    name: 'S3-02 a win records turns, streak, skill and throws; a better win says New best and a worse one does not',
    async run(t) {
      await fresh(t, { unlocked: 2 });
      let s = await winStory(t, 'story-01', 'hard');
      const r = s.save;
      t.equal(r.story.bestTurns['story-01'], 1, 'best turns recorded: ' + JSON.stringify(r.story.bestTurns));
      t.equal(r.stats.wins, 1); t.equal(r.stats.streak, 1); t.equal(r.stats.bestStreak, 1); t.equal(r.stats.winsHard, 1); t.equal(r.stats.winsMedium, 0);
      t.expect(/New best!/.test(await text(t)), 'a first win here is a new best');
      await snap(t, 'S3-02-new-best');
      t.expect(/New best: 1 turn/.test(s.lastSaid), 'announced to screen readers: ' + s.lastSaid);
      // a second win in the same number of turns is not a new best, and the streak grows
      s = await winStory(t, 'story-01', 'medium');
      t.expect(!/New best!/.test(await text(t)), 'no new best when equalled');
      t.expect(/Your best here: 1 turn/.test(await text(t)), 'the card shows the best to beat');
      t.expect(/Win streak: 2 in a row/.test(await text(t)), 'the streak shows from two');
      t.equal(s.save.stats.streak, 2); t.equal(s.save.stats.winsMedium, 1);
      // a worse best on file makes the next win a new best
      await t.page.evaluate((k) => { const v = JSON.parse(localStorage.getItem(k)); v.story.bestTurns['story-01'] = 9; localStorage.setItem(k, JSON.stringify(v)); }, SAVE_KEY);
      await t.reload();
      await winStory(t, 'story-01');
      t.expect(/New best!.*before: 9/.test(await text(t)), 'beating 9 turns says so: ' + (await text(t)).slice(0, 300));
      s = await t.state();
      t.equal(s.save.story.bestTurns['story-01'], 1, 'the lower figure is kept');
      // it survives a reload
      await t.reload();
      s = await t.state();
      t.equal(s.save.story.bestTurns['story-01'], 1); t.equal(s.save.stats.winsHard, 1); t.equal(s.save.stats.bestStreak, 3);
      // the story map shows it under the tile
      await t.game('act', 'menu', 'story');
      t.expect(/Best: 1 turn/.test(await text(t)), 'the tile shows the best turns');
      t.expect(/Stars: [1-9]\d? \/ 36/.test(await text(t)), 'and the star total is above the map');
      await snap(t, 'S3-02-story-map');
    },
  },
  {
    name: 'S3-02 a loss ends the streak but keeps the best streak and every record',
    viewports: ['desktop'],
    async run(t) {
      await fresh(t, { unlocked: 2 });
      await winStory(t, 'story-01'); await winStory(t, 'story-01');
      t.equal((await t.state()).save.stats.streak, 2);
      await t.game('act', 'menu', 'play', { v: 'story-01' });
      await t.game('scene', 'results', { lose: true });
      const s = await t.state();
      t.equal(s.save.stats.streak, 0, 'a loss ends the streak');
      t.equal(s.save.stats.bestStreak, 2, 'the best streak stays');
      t.equal(s.save.stats.battles, 3); t.equal(s.save.stats.wins, 2);
      t.equal(s.save.story.bestTurns['story-01'], 1, 'the best turns stay');
      t.expect(!/New best!/.test(await text(t)), 'no new best on a loss');
    },
  },
  {
    name: 'S3-02 the Records numbers merge across two tabs without losing either',
    viewports: ['desktop'],
    async run(t) {
      await fresh(t, { unlocked: 2 });
      const first = await winStory(t, 'story-01', 'sharp');
      t.equal(first.save.stats.winsSharp, 1);
      // another tab wrote a better time and a longer streak meanwhile
      await t.page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.story.bestTurns['story-01'] = 1; s.stats.bestStreak = 7; s.stats.winsSharp = 4; s.stats.battles += 3; localStorage.setItem(k, JSON.stringify(s)); }, SAVE_KEY);
      const s2 = await winStory(t, 'story-01', 'sharp');
      t.equal(s2.save.stats.winsSharp, 5, 'wins add up across tabs');
      t.equal(s2.save.stats.bestStreak, 7, 'the better streak is kept');
      t.equal(s2.save.story.bestTurns['story-01'], 1);
      t.equal((await saved(t)).stats.winsSharp, 5, 'and it is what was written');
    },
  },
  {
    name: 'S3-02 damaged records fall back to defaults without an error, and Reset progress clears them',
    viewports: ['desktop'],
    async run(t) {
      const bad = oldSave();
      bad.story.bestTurns = { 'story-01': -3, 'story-02': 'x', 'story-03': 7 };
      bad.stats.throws = 'many'; bad.stats.winsHard = -1; bad.stats.streak = null;
      await withSave(t, bad);
      const s = await t.state();
      t.equal(JSON.stringify(s.save.story.bestTurns), JSON.stringify({ 'story-03': 7 }), 'only the sound entry is kept');
      t.equal(s.save.stats.throws, 0); t.equal(s.save.stats.winsHard, 0); t.equal(s.save.stats.streak, 0);
      await t.game('act', 'menu', 'records');
      t.expect(/best 7 turns, par 10/.test(await text(t)), 'the sound entry shows');
      await t.game('act', 'menu', 'settings');
      await t.page.click('[data-act="resetProgress"]');
      t.expect(/records/.test(await text(t)), 'the confirmation says records are cleared too');
      await t.page.click('[data-act="resetYes"]');
      const r = await t.state();
      t.equal(r.save.stats.battles, 0); t.equal(JSON.stringify(r.save.story.bestTurns), '{}');
    },
  },
];

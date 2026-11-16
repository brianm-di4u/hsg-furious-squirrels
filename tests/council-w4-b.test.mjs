// Council wave 4, batch B: difficulty, progression and records; feedback, teaching and help; world, words and ceremony
// (S3-19, S4-11, S6-12, C4-03, S2-15, C4-02, C4-04, C4-05).
import fs from 'node:fs';
const SHOTS = '../_council/hsg-furious-squirrels/wave-4/shots';
const snap = async (t, name) => {
  await t.shot(name);
  fs.mkdirSync(SHOTS, { recursive: true });
  await t.page.screenshot({ path: `${SHOTS}/${name}-${t.viewport}.png` });
};
const tiles = (t) => t.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.statgrid div')].map((d) => [d.querySelector('span').textContent, d.querySelector('b').textContent])));

export const tests = [
  // ---- S3-19 ----
  {
    name: 'S3-19 the results grid shows accuracy, grip lost and par beside the old numbers',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('newGame', { levelId: 'story-01', mode: 'story', seed: 5 });
      const par = await t.page.evaluate(() => {
        const S = window.__FS.sim, b = S.b;
        b.turn.n = 9; b.teams[0].stats.throws = 8; b.teams[0].stats.hits = 3; b.teams[0].stats.kos = 1; b.teams[0].stats.best = 61;
        b.teams[1].stats.dmg = 37.4; // grip the rival shook loose from this family's squirrels
        return window.__FS.level.par;
      });
      await t.game('scene', 'results');
      await t.page.waitForSelector('.statgrid');
      const g = await tiles(t);
      t.equal(g.Accuracy, '38%', 'three hits in eight throws');
      t.equal(g['Grip lost'], '37', 'what the rival took off this family, rounded');
      t.equal(g.Par, String(par), "the battle's par");
      t.equal(g.Throws + '/' + g.Hits + '/' + g.Knockouts + '/' + g['Biggest hit'] + '/' + g.Turns, '8/3/1/61/5', 'the old five are still there');
      await snap(t, 'S3-19-results-grid');
      await t.checkLayout();
      // a Quick Battle has no par to show
      await t.game('newGame', { levelId: 'gray', seed: 7 });
      await t.page.evaluate(() => { const b = window.__FS.sim.b; b.teams[0].stats.throws = 4; b.teams[0].stats.hits = 0; });
      await t.game('scene', 'results');
      await t.page.waitForSelector('.statgrid');
      const q = await tiles(t);
      t.expect(!('Par' in q), 'no Par tile outside the Story');
      t.equal(q.Accuracy, '0%', 'no hits is 0%');
      t.equal(q['Grip lost'], '0', 'and no grip lost');
    },
  },
  // ---- S4-11 ----
  {
    name: 'S4-11 the title shows the battle the player has got to, and a new player still sees the first',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      const seen = () => t.page.evaluate(() => ({ id: window.__FS.level.id, season: window.__FS.level.season, air: window.__FS.renderer.weather.kind, scene: window.__FS.scene }));
      let s = await seen();
      t.equal(s.id + '/' + s.scene, 'story-01/title', 'a new profile sees the first battle, as before');
      await snap(t, 'S4-11-title-new');
      // a fresh profile each time: a save never lowers what a player has opened
      const titleFor = async (unlocked) => {
        await t.game('act', 'clearSave');
        await t.reload();
        await t.game('setState', { story: { unlocked, team: 0 } });
        await t.game('scene', 'title');
        await t.page.waitForFunction(() => window.__FS.loading === 0, null, { timeout: 15000 });
        return seen();
      };
      s = await titleFor(10); // the Story's tenth battle is a winter day
      t.equal(s.id, 'story-10', 'a player who has opened battle 10 sees it');
      t.equal(s.season + '/' + s.air, 'winter/snow', "with its season's air");
      await snap(t, 'S4-11-title-winter');
      s = await titleFor(4);
      t.equal(s.id + '/' + s.air, 'story-04/petals', 'a spring battle brings petals');
      t.equal((await titleFor(99)).id, 'story-12', 'past the end it is the last battle');
      t.equal((await titleFor(0)).id, 'story-01', 'and nothing opened is the first');
      await t.checkLayout();
    },
  },
];

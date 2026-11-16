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
];

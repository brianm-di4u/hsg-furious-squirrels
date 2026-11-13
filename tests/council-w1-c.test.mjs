// Council wave 1, batch C: screens, layout and words (S3-07, S1-05, S2-11, S2-14).

const padInit = () => {
  const pad = { index: 0, connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  window.__pad = pad;
  navigator.getGamepads = () => [pad];
};

const myTurn = async (t, opts = {}) => {
  await t.game('newGame', { levelId: 'gray', seed: 7, loadout: 'all', ...opts });
  await t.page.evaluate(() => { const S = window.__FS.sim; if (S.b.turn.team !== 0) { S.b.turn.team = 0; S.pickSquirrel(); } S.b.wind = 0; window.__FS.aiActive = null; });
  await t.game('step', 1);
};

export const tests = [
  {
    name: 'S3-07 results count turns the way par does and state the star rule',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { levelId: 'story-01', mode: 'story', seed: 5 });
      const par = await t.page.evaluate(() => window.__FS.level.par);
      await t.page.evaluate(() => { const S = window.__FS.sim; S.b.turn.n = 9; S.b.teams[0].stats.throws = 5; });
      await t.game('scene', 'results');
      await t.page.waitForSelector('.statgrid');
      const turns = await t.page.evaluate(() => [...document.querySelectorAll('.statgrid div')].find((d) => /Turns/.test(d.textContent)).querySelector('b').textContent);
      t.equal(turns, '5', 'nine turn counts is five of this family\'s turns, as par counts them');
      const rule = await t.page.$eval('.starrule', (p) => p.textContent);
      t.expect(rule.includes(`within ${par} turns`) && /keep every squirrel/.test(rule), `star rule is stated (got "${rule}")`);
    },
  },
];

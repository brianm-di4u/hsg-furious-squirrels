// Council wave 3, batch A: saves, lifecycle and robustness (S2-05, S2-18, S4-06, S5-08, S5-10, S5-11, S6-04, S6-15, S3-03, S4-17).
import fs from 'node:fs';
const SAVE_KEY = 'hsg-furious-squirrels-v1';
const SHOTS = '../_council/hsg-furious-squirrels/wave-3/shots';

const saved = (t) => t.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);
const snap = async (t, name) => {
  await t.shot(name);
  fs.mkdirSync(SHOTS, { recursive: true });
  await t.page.screenshot({ path: `${SHOTS}/${name}-${t.viewport}.png` });
};
const screenText = (t) => t.page.textContent('#screens');
// a fresh profile, then a Story battle in which the player's family throws first (so the resume slot is written at once)
async function storyBattle(t, levelId = 'story-01', settings = {}) {
  await t.game('act', 'clearSave');
  await t.reload();
  await t.game('setState', { settings });
  await t.game('act', 'menu', 'story');
  await t.game('act', 'menu', 'team', { v: '0' });
  await t.seed(35594);
  await t.game('act', 'menu', 'play', { v: levelId });
  await t.page.waitForFunction((k) => { try { return !!JSON.parse(localStorage.getItem(k)).resume.battle; } catch { return false; } }, SAVE_KEY, { timeout: 5000 });
}
const throwOnce = async (t) => { await t.game('act', 'fire', {}); await t.game('act', 'skipFlight'); };

export const tests = [
  // ---- S2-05 ----
  {
    name: 'S2-05 Restart and Quit ask first once a nut has been thrown, and Cancel goes back to the pause card',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('newGame', { levelId: 'gray' });
      await t.game('scene', 'pause');
      await t.game('act', 'menu', 'restart');
      let s = await t.state();
      t.equal(s.screen, null, 'before any throw, Restart goes straight ahead');
      t.equal(s.scene, 'battle', 'and the new battle is on');
      await throwOnce(t);
      await t.game('scene', 'pause');
      await t.game('act', 'menu', 'restart');
      s = await t.state();
      t.equal(s.screen, 'confirmLeave', 'after a throw, Restart asks first');
      t.expect(/Restart this battle\?/.test(await screenText(t)) && /progress in it will be lost/.test(await screenText(t)), 'the card says what is lost');
      t.equal(await t.page.evaluate(() => document.activeElement && document.activeElement.dataset.act), 'back', 'Cancel has the focus');
      await snap(t, 'S2-05-confirm-restart');
      await t.page.keyboard.press('Escape');
      s = await t.state();
      t.equal(s.screen, 'pause', 'Escape (Cancel) returns to the pause card');
      t.equal(s.battle.teams.reduce((n, x) => n + x.stats.throws, 0), 1, 'and the battle is untouched');
      await t.game('act', 'menu', 'menu');
      t.equal((await t.state()).screen, 'confirmLeave', 'Quit to menu asks as well');
      t.expect(/Leave this battle\?/.test(await screenText(t)), 'titled Leave this battle');
      await t.page.click('[data-act="back"]');
      t.equal((await t.state()).screen, 'pause', 'the Cancel button returns to pause');
      await t.game('act', 'menu', 'restart');
      await t.page.click('[data-act="leaveYes"]');
      s = await t.state();
      t.equal(s.screen, null, 'confirming Restart starts the battle again');
      t.equal(s.battle.teams.reduce((n, x) => n + x.stats.throws, 0), 0, 'with nothing thrown');
      await throwOnce(t);
      await t.game('scene', 'pause');
      await t.game('act', 'menu', 'menu');
      await t.page.click('[data-act="leaveYes"]');
      s = await t.state();
      t.equal(s.scene, 'title', 'confirming Leave goes to the title');
    },
  },
  {
    name: 'S2-05 quitting a Story battle keeps its resume slot, and Resume battle brings it back',
    async run(t) {
      await storyBattle(t);
      await throwOnce(t);
      await t.game('scene', 'pause');
      await t.game('act', 'menu', 'menu');
      t.expect(/Resume battle on the title/.test(await screenText(t)), 'the Story card says the battle stays saved');
      await snap(t, 'S2-05-confirm-leave-story');
      await t.page.click('[data-act="leaveYes"]');
      t.equal((await t.state()).scene, 'title', 'back on the title');
      t.expect((await saved(t)).resume && (await saved(t)).resume.battle, 'the resume slot is still in the save');
      t.equal(await t.page.locator('button[data-act="resumeBattle"]').count(), 1, 'the title offers Resume battle');
      await t.page.click('button[data-act="resumeBattle"]');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'battle', null, { timeout: 5000 });
      t.equal((await t.state()).setup.mode, 'story', 'it is the Story battle again');
    },
  },
];

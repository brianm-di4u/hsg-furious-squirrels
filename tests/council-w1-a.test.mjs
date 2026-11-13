// Council wave 1, batch A: stability, saves and lifecycle (S5-07, S6-01, S6-02, S6-07, S6-08, S6-10, S4-26, S6-11).
const SAVE_KEY = 'hsg-furious-squirrels-v1';
const setHidden = (value) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
  document.dispatchEvent(new Event('visibilitychange'));
};

export const tests = [
  {
    name: 'S5-07 music stops with the tab and the pause menu',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { levelId: 'gray', seed: 7 });
      await t.page.keyboard.press('Shift');
      await t.page.waitForFunction(() => window.__game.getState().audio.ctx === 'running', null, { timeout: 5000 });
      let a = (await t.state()).audio;
      t.expect(a.scheduler, 'music scheduler runs in a visible tab');
      await t.page.evaluate(setHidden, true);
      await t.page.waitForFunction(() => window.__game.getState().audio.ctx === 'suspended', null, { timeout: 3000 });
      a = (await t.state()).audio;
      t.equal(a.ctx, 'suspended', 'hidden tab suspends the audio context');
      t.expect(!a.scheduler, 'hidden tab stops the music scheduler');
      await t.page.evaluate(setHidden, false);
      await t.page.waitForFunction(() => window.__game.getState().audio.ctx === 'running', null, { timeout: 3000 });
      a = (await t.state()).audio;
      t.expect(a.scheduler, 'visible again restarts the music scheduler');
      await t.game('scene', 'pause');
      await t.waitFrames(3);
      t.expect((await t.state()).audio.musicPaused, 'pause menu ducks the music');
      await t.game('act', 'menu', 'resume');
      await t.waitFrames(3);
      t.expect(!(await t.state()).audio.musicPaused, 'resuming restores the music');
    },
  },
];

const BAD_SAVES = { truncated: '{"v":1,"settings":{"sou', empty: '{}', nul: 'null' };
for (const [kind, raw] of Object.entries(BAD_SAVES)) {
  tests.push({
    name: `S6-01 a ${kind} save is replaced on the next write and says so`,
    viewports: ['desktop'],
    async run(t) {
      await t.page.evaluate(([k, r]) => localStorage.setItem(k, r), [SAVE_KEY, raw]);
      await t.reload();
      t.expect(/could not be read/i.test(await t.page.textContent('#screens')), 'title says the saved data could not be read');
      t.equal(await t.page.evaluate((k) => localStorage.getItem(k + '-bad'), SAVE_KEY), raw, 'the damaged text is kept under -bad');
      await t.game('act', 'menu', 'set', { k: 'sound', v: 'false' });
      const saved = await t.page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, SAVE_KEY);
      t.expect(saved && saved.v === 1, 'a valid save was written over the damaged one');
      t.equal(saved && saved.settings.sound, false, 'the changed setting was saved');
      await t.reload();
      t.equal((await t.state()).settings.sound, false, 'the setting survives a reload');
    },
  });
}
tests.push({
  name: 'S6-01 a save from a newer version is left alone',
  viewports: ['desktop'],
  async run(t) {
    const raw = JSON.stringify({ v: 2, future: true });
    await t.page.evaluate(([k, r]) => localStorage.setItem(k, r), [SAVE_KEY, raw]);
    await t.reload();
    t.expect(/newer version/i.test(await t.page.textContent('#screens')), 'title explains the save is from a newer version');
    await t.game('act', 'menu', 'set', { k: 'sound', v: 'false' });
    t.equal(await t.page.evaluate((k) => localStorage.getItem(k), SAVE_KEY), raw, 'the newer save is not overwritten');
  },
});

// a real Story resume slot, made by playing into level 1
async function storyResumeSave(t) {
  await t.game('act', 'clearSave');
  await t.reload();
  await t.game('act', 'menu', 'story');
  await t.game('act', 'menu', 'team', { v: '0' });
  await t.seed(35594); // a seed where the player's family throws first, so the resume slot is written at once
  await t.game('act', 'menu', 'play', { v: 'story-01' });
  await t.page.waitForFunction((k) => { try { return !!JSON.parse(localStorage.getItem(k)).resume.battle; } catch { return false; } }, SAVE_KEY, { timeout: 5000 }).catch(() => {});
  const saved = await t.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);
  t.expect(saved && saved.resume && saved.resume.battle, 'playing a Story level writes a resume slot');
  return saved;
}
const BAD_BATTLES = { 'empty battle': () => ({}), 'missing squirrels and rng': (r) => ({ ...r.battle, squirrels: null, rng: undefined }) };
for (const [kind, damage] of Object.entries(BAD_BATTLES)) {
  tests.push({
    name: `S6-02 resuming a saved battle with ${kind} drops the slot instead of throwing`,
    viewports: ['desktop'],
    async run(t) {
      const saved = await storyResumeSave(t);
      saved.resume.battle = damage(saved.resume);
      await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [SAVE_KEY, saved]);
      await t.reload();
      t.equal(await t.page.locator('button[data-act="resumeBattle"]').count(), 1, 'Resume battle is offered');
      await t.page.locator('button[data-act="resumeBattle"]').click();
      await t.waitFrames(3);
      const s = await t.state();
      t.equal(s.scene, 'title', 'still on the title screen');
      t.equal(await t.page.locator('button[data-act="resumeBattle"]').count(), 0, 'the dead Resume button is gone');
      t.expect(/could not be loaded/i.test(await t.page.textContent('#screens')), 'the title says the battle could not be loaded');
      const after = await t.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);
      t.equal(after.resume, null, 'the damaged slot is cleared in the save');
      t.expect((await t.page.textContent('#boot-error')) === '', 'no error bar');
    },
  });
}

tests.push({
  name: 'S6-07 an error in the frame loop offers Back to menu and the game recovers',
  viewports: ['desktop'],
  allowConsoleErrors: true,
  async run(t) {
    await t.game('newGame', { levelId: 'gray', seed: 7 });
    await t.page.evaluate(() => { window.__FS.sim.idle = () => { throw new Error('boom from the frame'); }; window.__FS.kick(); });
    await t.page.waitForSelector('#boot-error:not([hidden]) button', { timeout: 3000 });
    t.expect(/boom from the frame/.test(await t.page.textContent('#boot-error')), 'the error is shown');
    await t.page.click('#boot-error button');
    await t.waitFrames(3);
    const s = await t.state();
    t.equal(s.scene, 'title', 'Back to menu returns to the title');
    t.expect(await t.page.evaluate(() => document.getElementById('boot-error').hidden), 'the error bar is gone');
    await t.game('act', 'menu', 'quick');
    t.equal((await t.state()).screen, 'quick', 'menus work again');
  },
});
tests.push({
  name: 'S6-07 an uncaught error and a rejected promise are shown with Back to menu',
  viewports: ['desktop'],
  allowConsoleErrors: true,
  async run(t) {
    for (const kind of ['error', 'rejection']) {
      await t.page.evaluate((k) => { if (k === 'error') setTimeout(() => { throw new Error('late error'); }); else Promise.reject(new Error('late rejection')); }, kind);
      await t.page.waitForSelector('#boot-error:not([hidden]) button', { timeout: 3000 });
      t.expect(/late (error|rejection)/.test(await t.page.textContent('#boot-error')), kind + ' is shown');
      await t.page.click('#boot-error button');
      t.expect(await t.page.evaluate(() => document.getElementById('boot-error').hidden), kind + ': bar dismissed');
    }
  },
});

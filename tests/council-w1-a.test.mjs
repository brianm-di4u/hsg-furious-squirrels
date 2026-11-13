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

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

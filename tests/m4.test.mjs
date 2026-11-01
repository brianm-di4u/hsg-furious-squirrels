// M4: polish, audio and accessibility (AC21, AC23, AC24, AC30).
export const tests = [
  {
    name: 'Field Notes facts check out',
    node: true,
    async run(t) {
      const { checkFacts } = await import('../tools/check-facts.mjs');
      const r = checkFacts();
      t.equal(r.issues.length, 0, r.issues.join('; ') || r.n + ' facts');
    },
  },
  {
    name: 'contrast on every screen',
    viewports: ['desktop'],
    async run(t) {
      for (const sc of ['title', 'help', 'settings', 'credits', 'quick']) {
        await t.game('scene', sc);
        const r = await t.contrastReport();
        const bad = (r.failures || r.fails || []).length ?? 0;
        t.equal(bad, 0, `${sc}: ${JSON.stringify((r.failures || r.fails || []).slice(0, 2))}`);
      }
      await t.game('newGame', { levelId: 'gray', seed: 2 });
      const r = await t.contrastReport();
      t.equal((r.failures || r.fails || []).length, 0, 'battle HUD: ' + JSON.stringify((r.failures || r.fails || []).slice(0, 2)));
    },
  },
  {
    name: 'reduced motion',
    reducedMotion: true,
    async run(t) {
      const s0 = await t.state();
      t.equal(s0.settings.reducedMotion, null, 'follows the system setting');
      await t.game('newGame', { levelId: 'story-03', seed: 5 });
      const r = await t.page.evaluate(() => ({ reduced: window.__FS.reduced, body: document.body.classList.contains('reduced') }));
      t.expect(r.reduced && r.body, 'reduced motion active');
      // a big hit does not shake the camera
      await t.page.evaluate(() => { window.__FS.renderer.cam.shake = 1; });
      const before = await t.page.evaluate(() => [window.__FS.renderer.cam.x, window.__FS.renderer.reduced]);
      t.expect(before[1] === true, 'renderer ignores shake');
      await t.shot('m4-reduced');
    },
  },
  {
    name: 'text at 150%',
    async run(t) {
      await t.game('setState', { settings: { textScale: 1.5 } });
      await t.game('scene', 'help');
      await t.checkLayout();
      await t.shot('m4-text150-help');
      await t.game('newGame', { levelId: 'gray', seed: 2 });
      await t.checkLayout();
      await t.shot('m4-text150');
      await t.game('setState', { settings: { textScale: 1 } });
    },
  },
  {
    name: 'turns and knockouts announced',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { levelId: 'gray', seed: 6 });
      await t.page.evaluate(() => { const S = window.__FS.sim; S.nextTurn(); });
      await t.game('step', 1);
      let s = await t.state();
      t.expect(/turn/.test(s.lastSaid), 'turn change announced: ' + s.lastSaid);
      const live = await t.page.getAttribute('#live', 'aria-live');
      t.equal(live, 'polite', 'aria-live region');
    },
  },
  {
    name: 'audio starts on input and toggles',
    viewports: ['desktop'],
    async run(t) {
      let s = await t.state();
      t.equal(s.audio.started, false, 'silent before any input');
      await t.page.mouse.click(5, 5);
      s = await t.state();
      t.equal(s.audio.started, true, 'audio starts on first input');
      t.expect(s.audio.vol <= 0.5, 'quiet by default');
      await t.game('setState', { settings: { sound: false, music: false } });
      s = await t.state();
      t.equal(s.audio.on, false, 'sound toggles off');
      t.equal(s.audio.music, false, 'music toggles off');
      await t.game('setState', { settings: { sound: true, music: true } });
    },
  },
  {
    name: 'credits',
    async run(t) {
      await t.game('scene', 'credits');
      const txt = await t.page.textContent('#screens');
      for (const want of ['game fiction', 'USGS', 'OpenStreetMap', 'ODbL', 'ZzFX', 'MIT']) t.expect(txt.includes(want), 'credits mention ' + want);
      await t.shot('m4-credits');
    },
  },
];

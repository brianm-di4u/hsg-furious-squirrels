// Council wave 1, batch B: input, rules and play (S1-01, S5-05, S5-13).

export const tests = [
  {
    name: 'S1-01 the rival plans in short slices',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { levelId: 'story-09', seed: 6, difficulty: 'hard' });
      t.expect(await t.page.evaluate(() => !!window.__FS.sim), 'battle ready');
      await t.waitFrames(30); // past the start-up work
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
      const worst = Math.max(0, ...sl);
      t.log(`rival plan: ${sl.length} slices, longest ${worst.toFixed(1)} ms`);
      t.expect(sl.length > 40, `the plan ran in ${sl.length} slices`);
      t.expect(worst < 40, `one planning slice blocked the page for ${worst.toFixed(1)} ms`);
    },
  },
];

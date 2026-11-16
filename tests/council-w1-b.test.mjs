// Council wave 1, batch B: input, rules and play (S1-01, S5-05, S5-13).

const wrapOsc = () => {
  window.__freqs = [];
  const make = BaseAudioContext.prototype.createOscillator;
  BaseAudioContext.prototype.createOscillator = function () {
    const o = make.call(this), set = o.frequency.setValueAtTime.bind(o.frequency);
    o.frequency.setValueAtTime = (v, t) => { window.__freqs.push(v); return set(v, t); };
    return o;
  };
};

const grabNoise = () => {
  const make = BaseAudioContext.prototype.createBuffer;
  BaseAudioContext.prototype.createBuffer = function (...a) { const b = make.apply(this, a); window.__noise = b; return b; };
};

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
      const worst = [...sl].sort((a, b) => a - b)[Math.floor(sl.length * 0.9)] || 0; // 90th percentile: one slice can be hit by the machine, not the plan
      t.log(`rival plan: ${sl.length} slices, 90th percentile ${worst.toFixed(1)} ms`);
      t.expect(sl.length > 40, `the plan ran in ${sl.length} slices`);
      t.expect(worst < 20, `planning slices blocked the page for ${worst.toFixed(1)} ms`);
    },
  },
  {
    name: 'S5-05 only a rival knockout plays the cheer',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { levelId: 'gray', seed: 7 });
      await t.page.keyboard.press('Shift');
      await t.page.waitForFunction(() => window.__game.getState().audio.ctx === 'running', null, { timeout: 5000 });
      await t.page.evaluate(wrapOsc);
      const ko = (team) => t.page.evaluate((tm) => {
        const S = window.__FS.sim; window.__freqs.length = 0;
        S.knockOut(S.b.squirrels.find((q) => q.team === tm && !q.out)); window.__FS.kick();
      }, team);
      // every cue is detuned by up to 20 cents (S5-03, about 1.2 percent), so a cue is found within 1.5 percent of its pitch
      const heard = (hz) => t.page.evaluate((f) => window.__freqs.some((x) => Math.abs(x - f) / f < 0.015), hz);
      const cheered = () => heard(1046);
      await ko(0);
      await t.page.waitForFunction(() => window.__freqs.some((x) => Math.abs(x - 900) / 900 < 0.015), null, { timeout: 8000 });
      await t.page.waitForTimeout(1200);
      t.expect(!(await cheered()), 'own squirrel knocked out: no rival-knockout cheer');
      t.expect(await heard(900), 'own squirrel knocked out: the knockout cue still plays');
      await ko(1);
      await t.page.waitForFunction(() => window.__freqs.some((x) => Math.abs(x - 900) / 900 < 0.015), null, { timeout: 8000 });
      await t.page.waitForTimeout(1200);
      t.expect(await cheered(), 'rival squirrel knocked out: the cheer plays');
    },
  },
  {
    name: 'S5-13 the noise buffer does not repeat after a short cycle',
    viewports: ['desktop'],
    initScript: grabNoise,
    async run(t) {
      await t.page.keyboard.press('Shift');
      await t.page.waitForFunction(() => window.__game.getState().audio.ctx === 'running', null, { timeout: 5000 });
      const r = await t.page.evaluate(() => {
        const d = window.__noise.getChannelData(0), P = 10466;
        let same = 0;
        for (let i = 20000; i < 30000; i++) if (d[i] === d[i + P]) same++;
        return { same };
      });
      t.expect(r.same < 100, `noise repeats with the old 10466-sample period in ${r.same} of 10000 samples`);
    },
  },
];

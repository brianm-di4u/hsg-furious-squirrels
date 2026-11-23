import fs from 'node:fs';
const SHOTS = 'screenshots/council/wave-2/shots';
// Council wave 2, follow-up pass: ambience floor (S5-01), own voice for title and results (S5-02), landscape nut bar (S4-15).
const render = (t, name, secs, opts) => t.page.evaluate(([n, s, o]) => window.__game.audioRender(n, s, false, o), [name, secs, { raw: true, ...(opts || {}) }]);

export const tests = [
  {
    name: 'S5-01 every ambience scene keeps a floor with the wind and the steam at zero',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      for (const name of list.ambience) {
        for (const birds of [0, 0.2]) {
          const r = await render(t, name, 30, { wind: 0, steam: 0, birds });
          t.log(`${name} (birds ${birds}): peak ${r.peak} rms ${r.rmsDb} dB silence ${r.longestSilence}s`);
          t.expect(r.rmsDb >= -52 && r.rmsDb <= -38, `${name} at wind 0, steam 0, birds ${birds}: rms ${r.rmsDb} dBFS within -52 to -38`);
          t.expect(r.peak < 0.07, `${name} peak ${r.peak} under 0.07`);
          t.expect(r.longestSilence <= 2, `${name} has no silence over 2 s at wind 0 (${r.longestSilence})`);
          t.expect(Math.min(...r.secs.slice(1)) >= 0.001, `${name} never drops to silence in any second (quietest ${Math.min(...r.secs.slice(1))})`);
        }
      }
    },
  },
  {
    name: 'S5-02 the title and results pieces have their own tempo and stay inside the mix limits',
    viewports: ['desktop'],
    async run(t) {
      const kit = { title: 96, results: 66 }; // the kit's ragtime and spaCalm examples
      for (const name of ['title', 'results']) {
        const r = await render(t, name, 60), b = r.built;
        t.log(`${name}: bpm ${b.bpm} peak ${r.peak} rms ${r.rmsDb} dB silence ${r.longestSilence}s form ${b.formSeconds}s distinct ${b.distinctBars} pitches ${b.pitches}`);
        t.expect(b.bpm !== kit[name] && b.bpm !== 108, `${name} is not at the tempo of the kit example or the old tune (${b.bpm} bpm)`);
        t.expect(r.peak >= 0.06 && r.peak <= 0.16 && r.rmsDb >= -40 && r.rmsDb <= -28, `${name} peak ${r.peak}, rms ${r.rmsDb} dB inside the limits`);
        t.expect(b.formSeconds >= 45 && b.distinctBars >= 6 && b.pitches >= 6 && r.longestSilence <= 2, `${name} form ${b.formSeconds}s, ${b.distinctBars} distinct bars, ${b.pitches} pitches, silence ${r.longestSilence}s`);
      }
    },
  },
  {
    name: 'S4-15 all seven nut chips fit the landscape bar and stay 44 px',
    viewports: ['mobile'],
    async run(t) {
      for (const [w, h] of [[844, 390], [932, 430], [390, 844]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.game('newGame', { levelId: 'gray', loadout: 'all' });
        await t.page.waitForSelector('.hud .nut', { timeout: 15000 });
        await t.waitForStable(300);
        const m = await t.page.evaluate(() => {
          const bar = document.querySelector('.nutbar').getBoundingClientRect(), chips = [...document.querySelectorAll('.nutbar .nut')].map((e) => e.getBoundingClientRect());
          const last = chips[chips.length - 1];
          return { n: chips.length, barR: Math.round(bar.right), lastR: Math.round(last.right), lastL: Math.round(last.left), ro: (() => { const r = document.querySelector('.readout'); return r.scrollWidth - r.clientWidth; })(), small: chips.filter((q) => q.width < 44 || q.height < 44).length, scroll: document.querySelector('.nutbar').scrollWidth - document.querySelector('.nutbar').clientWidth };
        });
        t.expect(m.n === 7, `${w}x${h}: seven nuts in the bar (${m.n})`);
        t.expect(m.lastR <= m.barR, `${w}x${h}: the seventh chip ends inside the bar (${m.lastR} <= ${m.barR})`);
        t.expect(m.scroll <= 0, `${w}x${h}: the bar does not need to scroll (${m.scroll})`);
        t.expect(m.ro <= 0, `${w}x${h}: the readout text still fits its box (${m.ro})`);
        fs.mkdirSync(SHOTS, { recursive: true });
        await t.page.screenshot({ path: `${SHOTS}/S4-15-nutbar-seven-${w}x${h}.png` });
        t.equal(m.small, 0, `${w}x${h}: every chip is at least 44 px`);
      }
      await t.page.setViewportSize({ width: 390, height: 844 });
    },
  },
];

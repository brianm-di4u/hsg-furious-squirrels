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
  {
    name: 'S1-05 the gamepad works with the render loop asleep (reduced motion)',
    viewports: ['desktop'],
    reducedMotion: true,
    initScript: padInit,
    async run(t) {
      await myTurn(t);
      await t.page.evaluate(() => window.dispatchEvent(new Event('gamepadconnected')));
      await t.waitFrames(20);
      const a0 = (await t.state()).battle.teams[0].aim.angle;
      await t.page.evaluate(() => { window.__pad.axes[0] = -1; });
      await t.page.waitForTimeout(600);
      await t.page.evaluate(() => { window.__pad.axes[0] = 0; });
      const a1 = (await t.state()).battle.teams[0].aim.angle;
      t.expect(a1 - a0 > 25, `a held stick turns the angle at about 72 degrees a second (${a0} -> ${a1})`);
      await t.page.evaluate(() => { window.__pad.buttons[0].pressed = true; });
      await t.page.waitForTimeout(150);
      await t.page.evaluate(() => { window.__pad.buttons[0].pressed = false; });
      t.equal((await t.state()).battle.phase, 'flight', 'A throws');
    },
  },
  {
    name: 'S2-11 Space and Enter on a focused HUD button do not throw',
    viewports: ['desktop'],
    async run(t) {
      await myTurn(t);
      await t.page.focus('#b-cam');
      await t.page.keyboard.press('Enter');
      await t.page.keyboard.press('Space');
      await t.waitFrames(5);
      t.equal((await t.state()).battle.phase, 'aim', 'still aiming');
      await t.page.evaluate(() => document.activeElement.blur());
      await t.page.keyboard.press('Space');
      t.equal((await t.state()).battle.phase, 'flight', 'Space with no control focused still throws');
      const help = await t.page.evaluate(() => { window.__game.scene('help'); return document.body.textContent; });
      t.expect(/Gamepad/.test(help) && /Z\/X zoom/.test(help), 'How to Play lists the keys and the gamepad');
    },
  },
  {
    name: 'S2-14 the tips do not say Nice after a miss and sit clear of the squirrel on a phone',
    viewports: ['mobile'],
    async run(t) {
      const myAim = () => t.page.waitForFunction(() => { const S = window.__FS.sim; return S.b.turn.team === 0 && S.b.phase === 'aim' && !S.busy(); }, null, { timeout: 20000 });
      const place = () => t.page.evaluate(() => {
        const A = window.__FS, h = document.getElementById('hint').getBoundingClientRect(), b = document.querySelector('#hud .bottom').getBoundingClientRect();
        const q = A.sim.active(), [x, y] = A.renderer.cam.toScreen(q.x, q.y - 20);
        return { hb: h.bottom, bt: b.top, hl: h.left, hr: h.right, ht: h.top, x, y };
      });
      let s = await t.game('newGame', { levelId: 'story-01', seed: 5 });
      if (s.battle.turn.team !== 0) await myAim();
      await t.waitFrames(5);
      for (const step of ['first', 'second']) {
        s = await t.state();
        if (step === 'second') t.expect(/^Next: wind/.test(s.hint), `second tip (got "${s.hint}")`);
        else t.expect(/Drag back/.test(s.hint), 'first tip shows');
        const r = await place();
        t.expect(r.hb <= r.bt + 1 && r.bt - r.hb < 40, `${step} tip sits just above the controls (${r.hb} vs ${r.bt})`);
        t.expect(!(r.x >= r.hl && r.x <= r.hr && r.y >= r.ht && r.y <= r.hb), `${step} tip does not cover the active squirrel`);
        if (step === 'first') {
          await t.tap([20, Math.round(s.render.h / 2)]);
          await t.game('act', 'fire', {}); await t.game('act', 'skipFlight');
          await myAim(); await t.waitFrames(5);
        }
      }
    },
  },

];

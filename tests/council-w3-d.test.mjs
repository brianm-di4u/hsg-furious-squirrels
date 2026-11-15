// Council wave 3, batch D: feedback, teaching and help, and sound
// (S2-02, S6-03, CL-01, S1-15, S5-06, S5-09, S5-12, S5-16, S5-18, S5-19).
import fs from 'node:fs';
const SHOTS = '../_council/hsg-furious-squirrels/wave-3/shots';

const snap = async (t, name) => {
  await t.shot(name);
  fs.mkdirSync(SHOTS, { recursive: true });
  await t.page.screenshot({ path: `${SHOTS}/${name}-${t.viewport}.png` });
};
// a new Quick Battle on the Gray battlefield, no birds, no wind, in which the player's family (team 0) throws first
async function startHuman(t, opts = {}) {
  for (const seed of [7, 8, 9, 10, 11, 12, 13, 14]) {
    await t.seed(seed);
    const s = await t.game('newGame', { levelId: 'gray', birds: 'off', wind: 'off', ...opts });
    if (s.battle.turn.team === 0) return s;
  }
  throw new Error('no seed lets the player throw first');
}
const MASTER = 0.45; // the master gain is the Volume setting times this (audio.js)
const render = (t, name, secs, opts) => t.page.evaluate(([n, s, o]) => window.__game.audioRender(n, s, false, o), [name, secs, opts || {}]);
const humanAims = (t) => t.page.waitForFunction(() => { const s = window.__game.getState(); return s.battle && s.battle.turn.team === 0 && s.battle.phase === 'aim' && !s.aiActive; }, null, { timeout: 90000 });

export const tests = [
  // ---- S2-02 ----
  {
    name: 'S2-02 the last throw stays as faint dots for the next aim, and a throw that hit nothing says why',
    async run(t) {
      await startHuman(t);
      await t.game('act', 'aim', { angle: 45, power: 0.5 });
      await t.game('act', 'fire');
      await t.game('act', 'skipFlight');
      const L = await t.page.evaluate(() => ({ ...window.__FS.lastShot }));
      t.expect(L.pts.length >= 6, `the path was recorded (${L.pts.length} points)`);
      t.equal(L.said, 'Fell short', 'a weak throw into the dirt, no wind: fell short');
      t.equal(await t.page.evaluate(() => window.__FS.hud.el('call').textContent), 'Fell short', 'and the call is on the screen');
      await humanAims(t);
      await t.waitFrames(4);
      const trail = await t.page.evaluate(() => (window.__FS.shotTrail || []).length);
      t.equal(trail, L.pts.length, 'the same dots are drawn on the next aim turn');
      await snap(t, 'S2-02-last-shot');
      // the next throw replaces them
      await t.page.evaluate(() => { window.__old = window.__FS.lastShot; });
      await t.game('act', 'aim', { angle: 60, power: 0.5 });
      await t.game('act', 'fire');
      await t.page.waitForFunction(() => window.__FS.lastShot !== window.__old, null, { timeout: 20000 });
      t.expect(await t.page.evaluate(() => window.__FS.lastShot.pts.length < window.__old.pts.length), 'a new throw starts a new, shorter path');
    },
  },
  {
    name: 'S2-02 the call names the wind when the wind did it, and turning the Aim guide off hides the dots',
    viewports: ['desktop'],
    async run(t) {
      const fire = async (windAlong, power) => {
        await startHuman(t);
        const facing = await t.page.evaluate(() => window.__FS.sim.active().facing);
        await t.game('setState', { wind: windAlong * facing });
        await t.game('act', 'aim', { angle: 45, power });
        await t.game('act', 'fire');
        await t.game('act', 'skipFlight');
        return t.page.evaluate(() => window.__FS.lastShot.said);
      };
      t.equal(await fire(0.9, 0.3), 'Fell short', 'a following wind and a short throw: just short');
      t.equal(await fire(-0.9, 0.3), 'The wind held it back', 'a head wind and a short throw: the wind held it back');
      t.equal(await fire(0.9, 1), 'The wind pushed it long', 'a following wind and a long throw: the wind pushed it long');
      t.equal(await fire(-0.9, 1), 'Flew long', 'a head wind and a long throw: it was the throw');
      await t.game('setState', { settings: { aimGuide: 'off' } });
      await startHuman(t);
      await t.game('act', 'aim', { angle: 40, power: 0.3 }); await t.game('act', 'fire'); await t.game('act', 'skipFlight');
      await humanAims(t); await t.waitFrames(4);
      t.equal(await t.page.evaluate(() => window.__FS.shotTrail), null, 'with the Aim guide off there are no dots');
      await t.game('setState', { settings: { aimGuide: 'auto' } });
    },
  },

  // ---- CL-01 ----
  {
    name: 'CL-01 renders go through the master gain and limiter the player hears, and cues can be rendered',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      t.expect(Array.isArray(list.cues) && ['throw', 'thock', 'boing', 'burst', 'ko', 'win'].every((c) => list.cues.includes(c)), 'the list names the cues: ' + (list.cues || []).join(', '));
      const heard = await render(t, 'day', 30), raw = await render(t, 'day', 30, { raw: true }), full = await render(t, 'day', 30, { volume: 1 });
      // as heard is a fraction of the kit's own scale (the master gain is 0.225 at the shipped volume, and the limiter adds make-up gain), and full volume is twice the shipped one
      const frac = heard.peak / raw.peak;
      t.expect(frac > 0.2 && frac < 0.45, `the default volume renders at ${frac.toFixed(3)} of the kit's own scale (the master gain is ${0.5 * MASTER})`);
      t.expect(Math.abs(full.peak / heard.peak - 2) < 0.06, `full volume is twice the default (${(full.peak / heard.peak).toFixed(2)})`);
      const a = await render(t, 'cue:ko', 2), b = await render(t, 'cue:ko', 2, { volume: 1 });
      t.expect(a.peak > 0.001 && Math.abs(b.peak / a.peak - 2) < 0.1, `a cue renders, and doubles with the volume (${a.peak} then ${b.peak})`);
      const five = await render(t, 'cue:thock', 6, { arg: 'pecan', repeats: 5 });
      t.expect(five.secs.slice(0, 5).every((x) => x > 0.0005) && five.built.repeats === 5, 'repeats strike once a second');
      const before = (await t.state()).audio.played;
      await render(t, 'cue:boing', 2);
      t.equal((await t.state()).audio.played, before, 'a render does not count as a played cue or touch the live audio');
      let err = '';
      try { await render(t, 'cue:nonsense', 2); } catch (e) { err = String(e.message || e); }
      t.expect(/unknown cue/.test(err), 'an unknown cue is refused');
    },
  },
  {
    name: 'CL-01 the busiest moment at the maximum volume stays under 0.95',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      let worst = 0;
      for (const piece of list.music) {
        const r = await render(t, 'mix', 12, { volume: 1, piece });
        t.log(`${piece} + the bed + six loud cues at maximum volume: peak ${r.peak}`);
        worst = Math.max(worst, r.peak);
      }
      t.expect(worst < 0.95, `the loudest mix peaks at ${worst}, under 0.95`);
      t.expect(worst > 0.01, 'and the mix is not silent');
    },
  },
  // ---- S1-15 ----
  {
    name: 'S1-15 a scamper ends Move mode so the next drag aims, and a drag that only pans says Move is on',
    async run(t) {
      await startHuman(t);
      await t.waitFrames(4);
      const move = async (type, x, y, id = 5) => t.page.evaluate(([ty, px, py, pid]) => { document.getElementById('view').dispatchEvent(new PointerEvent(ty, { pointerId: pid, pointerType: 'touch', clientX: px, clientY: py, button: 0, bubbles: true })); }, [type, x, y, id]);
      const call = () => t.page.evaluate(() => ({ text: window.__FS.hud.el('call').textContent, show: window.__FS.hud.el('call').classList.contains('show'), moveOn: window.__FS.showPerches, label: window.__FS.hud.el('b-move').querySelector('.lbl').textContent }));
      // Move on, then a drag that misses every perch: it pans, and says why
      await t.page.evaluate(() => window.__FS.onHud('move'));
      await t.waitFrames(3);
      t.equal((await call()).label, 'Done', 'Move is on and the button says Done');
      const cam0 = (await t.state()).camera;
      await move('pointerdown', 60, 300); await move('pointermove', 100, 300); await move('pointermove', 160, 310);
      let c = await call();
      t.equal(c.text, 'Move is on: tap Done to aim', 'a pan drag in Move mode is explained');
      t.expect((await t.state()).camera.x !== cam0.x, 'and it did pan');
      await move('pointerup', 160, 310);
      t.expect((await call()).moveOn, 'Move stays on until a scamper or Done');
      // a scamper: tap a reachable perch
      const spot = await t.page.evaluate(() => {
        const S = window.__game, p = S.act('perches').find((n) => n.cost > 0), cam = window.__FS.renderer.cam;
        const [x, y] = cam.toScreen(p.x, p.y); return { x, y, id: p.id };
      });
      await move('pointerdown', spot.x, spot.y); await move('pointerup', spot.x, spot.y);
      await t.waitFrames(3);
      c = await call();
      t.expect(!c.moveOn && c.label !== 'Done', 'a scamper ends Move mode, and the button is Move again');
      t.equal(c.text, 'Aim mode', 'and the game says Aim mode');
      // the very next drag aims
      const aim0 = { ...(await t.state()).battle.teams[0].aim };
      await move('pointerdown', 400, 400, 6); await move('pointermove', 330, 440, 6); await move('pointermove', 300, 470, 6);
      const aim1 = (await t.state()).battle.teams[0].aim;
      t.expect(aim1.angle !== aim0.angle || aim1.power !== aim0.power, `the next drag changed the aim (${aim0.angle} deg, ${aim0.power} to ${aim1.angle} deg, ${aim1.power})`);
      await move('pointercancel', 300, 470, 6);
      await t.waitFrames(3);
      await snap(t, 'S1-15-aim-mode');
    },
  },
];

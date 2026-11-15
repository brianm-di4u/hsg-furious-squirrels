// Council wave 3, batch C: controls and play, difficulty and records, feedback and teaching
// (S1-03, S3-06, S1-17, S2-10, S3-13, P-N02, S2-04, S2-09, S2-01).
import fs from 'node:fs';
const SHOTS = '../_council/hsg-furious-squirrels/wave-3/shots';

const snap = async (t, name) => {
  await t.shot(name);
  fs.mkdirSync(SHOTS, { recursive: true });
  await t.page.screenshot({ path: `${SHOTS}/${name}-${t.viewport}.png` });
};
// a fresh Quick Battle on the Gray battlefield in which the player's family (team 0) throws first: the seeds are fixed, so the pick never changes
async function humanFirst(t, opts = {}) {
  await t.game('act', 'clearSave');
  await t.reload();
  for (const seed of [7, 8, 9, 10, 11, 12, 13, 14]) {
    await t.seed(seed);
    const s = await t.game('newGame', { levelId: 'gray', birds: 'off', ...opts });
    if (s.battle.turn.team === 0) return seed;
  }
  throw new Error('no seed lets the player throw first');
}
// synthetic pointer events: the same handlers a mouse or a finger reaches, but the test controls every position
const pointer = (t, type, x, y, id = 7) => t.page.evaluate(([ty, px, py, pid]) => {
  document.getElementById('view').dispatchEvent(new PointerEvent(ty, { pointerId: pid, pointerType: 'touch', clientX: px, clientY: py, button: 0, bubbles: true }));
  return window.__FS.dragRing ? { ...window.__FS.dragRing } : null;
}, [type, x, y, id]);

export const tests = [
  // ---- S1-03 ----
  {
    name: 'S1-03 a short pull is a cancel: the ring is the size of the cancel zone and only a longer pull throws',
    async run(t) {
      await humanFirst(t);
      await t.waitFrames(4);
      const maxLen = await t.page.evaluate(() => Math.min(window.__FS.renderer.cam.vw, window.__FS.renderer.cam.vh) * 0.42);
      const x0 = Math.round(t.vp.width * 0.5), y0 = Math.round(t.vp.height * 0.55);
      const aim0 = (await t.state()).battle.teams[0].aim;
      // a pull of 12 percent of full power: it used to throw a feeble nut, and now it cancels
      const short = Math.round(maxLen * 0.12);
      t.expect(short > 12, `the short pull (${short} px) is past the 12 px dead zone, so the old rule would have thrown`);
      await pointer(t, 'pointerdown', x0, y0);
      let ring = await pointer(t, 'pointermove', x0 - short, y0 + 1);
      t.expect(ring && ring.inside, 'a 12 percent pull is inside the cancel zone');
      t.expect(Math.abs(ring.r - maxLen * 0.18) < 1.5, `the ring is the zone: ${ring.r.toFixed(1)} px for ${(maxLen * 0.18).toFixed(1)}`);
      await t.waitFrames(3);
      await snap(t, 'S1-03-cancel-ring');
      await pointer(t, 'pointerup', x0 - short, y0 + 1);
      let s = await t.state();
      t.equal(s.battle.teams[0].stats.throws, 0, 'a release there throws nothing');
      t.equal(s.battle.teams[0].aim.angle, aim0.angle, 'and the old aim comes back');
      // just over the line throws
      const long = Math.round(maxLen * 0.24);
      await pointer(t, 'pointerdown', x0, y0);
      ring = await pointer(t, 'pointermove', x0 - long, y0 + 1);
      t.expect(ring && !ring.inside, 'a 24 percent pull is outside the zone');
      await pointer(t, 'pointerup', x0 - long, y0 + 1);
      t.equal((await t.state()).battle.teams[0].stats.throws, 1, 'and a release there throws');
    },
  },
  {
    name: 'S1-03 "Release: Only aims" keeps the aim and waits for Throw!; it is saved and defaults to throwing',
    async run(t) {
      await humanFirst(t);
      await t.waitFrames(4);
      t.equal((await t.state()).settings.releaseThrows, true, 'a fresh profile throws on release, as it always did');
      await t.game('setState', { settings: { releaseThrows: false } });
      const maxLen = await t.page.evaluate(() => Math.min(window.__FS.renderer.cam.vw, window.__FS.renderer.cam.vh) * 0.42);
      const x0 = Math.round(t.vp.width * 0.5), y0 = Math.round(t.vp.height * 0.55);
      const aim0 = (await t.state()).battle.teams[0].aim;
      await pointer(t, 'pointerdown', x0, y0);
      await pointer(t, 'pointermove', x0 - Math.round(maxLen * 0.5), y0 + Math.round(maxLen * 0.2));
      await pointer(t, 'pointerup', x0 - Math.round(maxLen * 0.5), y0 + Math.round(maxLen * 0.2));
      let s = await t.state();
      t.equal(s.battle.teams[0].stats.throws, 0, 'a long pull no longer throws on release');
      t.expect(s.battle.teams[0].aim.angle !== aim0.angle || s.battle.teams[0].aim.power !== aim0.power, 'the aim it set is kept');
      t.equal(s.battle.phase, 'aim', 'and it is still the player\'s turn');
      const kept = s.battle.teams[0].aim;
      await pointer(t, 'pointerdown', x0, y0);
      await pointer(t, 'pointermove', x0 - 5, y0 + 1);
      await pointer(t, 'pointerup', x0 - 5, y0 + 1);
      t.equal((await t.state()).battle.teams[0].aim.angle, kept.angle, 'a stray tap does not undo the kept aim');
      await t.page.click('#b-throw');
      s = await t.state();
      t.equal(s.battle.teams[0].stats.throws, 1, 'the Throw! button sends it');
      await t.reload();
      t.equal((await t.state()).settings.releaseThrows, false, 'the choice survives a reload');
      await t.game('scene', 'settings');
      t.expect(/Release/.test(await t.page.textContent('#screens')), 'Settings has the row');
      await snap(t, 'S1-03-settings');
    },
  },
];

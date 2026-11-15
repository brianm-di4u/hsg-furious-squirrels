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
  // ---- S2-10 ----
  {
    name: 'S2-10 Settings has the Difficulty row, each tier says what it changes, and the Story map follows it',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('scene', 'settings');
      const text = () => t.page.evaluate(() => document.getElementById('screens').textContent);
      const body = await text();
      t.expect(/Difficulty/.test(body) && /By difficulty/.test(body) && !/By skill/.test(body), 'the row is there and the aim guide choice is named for it');
      t.expect(/Medium: a short aim guide, a steady rival./.test(body), 'Medium says what it changes');
      await t.page.click('#screens [data-k="difficulty"][data-v="hard"]');
      t.equal((await t.state()).settings.difficulty, 'hard', 'choosing Hard is saved as the Story difficulty');
      t.expect(/Hard: no aim guide, a rival that rarely misses./.test(await text()), 'and the line under the row follows');
      await t.page.click('#screens [data-k="aimGuide"][data-v="always"]');
      t.expect(/Hard: a rival that rarely misses. The aim guide follows your Settings./.test(await text()), 'with the guide set by hand, the line says so rather than promise none');
      await t.page.click('#screens [data-k="aimGuide"][data-v="auto"]');
      await snap(t, 'S2-10-settings-difficulty');
      await t.game('scene', 'story');
      const pressed = await t.page.evaluate(() => [...document.querySelectorAll('#screens [data-k="difficulty"]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.v));
      t.equal(pressed.join(), 'hard', 'the Story map shows the same choice');
      t.expect(/Hard: no aim guide/.test(await text()), 'and the same line');
      await t.game('scene', 'quick');
      t.expect(/Medium: a short aim guide/.test(await text()), 'Quick Battle explains its own Rival skill the same way');
    },
  },
  // ---- S2-09 ----
  {
    name: 'S2-09 Quick Battle setup: battlefields in a grid, Battle and Rules groups, and a new profile starts on Story unlocks',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      t.equal(await t.page.evaluate(() => window.__FS.save.quick.loadout), 'story', 'a new profile starts on the Story unlocks, not all seven nuts');
      await t.game('scene', 'quick');
      const lay = await t.page.evaluate(() => {
        const maps = [...document.querySelectorAll('#screens .qmap .lvl')], r = maps.map((b) => b.getBoundingClientRect());
        const heads = [...document.querySelectorAll('#screens h3')].map((h) => h.textContent);
        const wind = [...document.querySelectorAll('#screens .field label')].find((l) => l.textContent === 'Wind');
        const panel = document.querySelector('#screens .panel');
        return { n: maps.length, cols: new Set(r.map((x) => Math.round(x.left))).size, rows: new Set(r.map((x) => Math.round(x.top))).size, heads, windTop: wind.getBoundingClientRect().top - panel.getBoundingClientRect().top, h: panel.scrollHeight, text: document.getElementById('screens').textContent };
      });
      t.equal(lay.n, 12, 'all twelve battlefields are there');
      t.expect(lay.cols >= 3 && lay.rows <= 4, `in a grid of ${lay.cols} columns and ${lay.rows} rows`);
      t.equal(lay.heads.join(), 'Battle,Rules', 'under Battle and Rules');
      t.expect(/Story so far: 0 of 6/.test(lay.text), 'the Nuts choice says what Story unlocks means');
      if (t.viewport === 'mobile') t.expect(lay.windTop < 800, `the first rule is ${Math.round(lay.windTop)} px down the panel`);
      await snap(t, 'S2-09-quick-setup');
      await t.page.click('#screens .qmap [data-v="story-05"]');
      t.equal(await t.page.evaluate(() => window.__FS.save.quick.level), 'story-05', 'picking a battlefield saves it');
      t.equal(await t.page.evaluate(() => document.querySelector('#screens .qmap [data-v="story-05"]').getAttribute('aria-pressed')), 'true', 'and marks it');
      await t.page.click('#screens [data-k="loadout"][data-v="all"]');
      t.expect(/All seven nuts/.test(await t.page.textContent('#screens')), 'choosing All seven still works');
      // an old save keeps what it had
      await t.page.evaluate(() => localStorage.setItem('hsg-furious-squirrels-v1', JSON.stringify({ v: 1, settings: { sound: true, music: true, volume: 0.5, reducedMotion: null, aimGuide: 'auto', turnTimer: 0, textScale: 1, difficulty: 'medium', tutorial: true }, story: { team: 0, unlocked: 3, stars: { 'story-01': 1 }, nuts: [] }, quick: { level: 'story-02', team: 0, size: 3, rounds: 1, wind: 'normal', steam: 'on', birds: 'some', loadout: 'all', difficulty: 'medium' }, stats: { battles: 4, wins: 2, kos: 1, bestShot: 20 } })));
      await t.reload();
      t.equal(await t.page.evaluate(() => window.__FS.save.quick.loadout), 'all', 'a player whose save says All seven keeps it');
    },
  },
];

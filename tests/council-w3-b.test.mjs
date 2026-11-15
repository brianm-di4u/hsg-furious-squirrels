// Council wave 3, batch B: controls, rules and play (S1-02, S1-06, S1-10, S2-07, S2-13, S3-05, S3-12, S6-09, P-N01, P-N05).
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
const fire = async (t, aim = { angle: 40, power: 0.5 }) => { await t.game('act', 'aim', aim); await t.game('act', 'fire', {}); };
const phase = async (t) => (await t.state()).battle.phase;

export const tests = [
  // ---- S1-02 ----
  {
    name: 'S1-02 a press hurries the rival: it throws within a few frames of the press, without its thinking time',
    viewports: ['desktop'],
    async run(t) {
      await humanFirst(t);
      await fire(t);
      await t.game('act', 'skipFlight');
      t.equal((await t.state()).battle.turn.team, 1, "it is the rival's turn");
      await t.page.waitForFunction(() => window.__FS.aiActive && window.__FS.aiActive.done && window.__FS.aiActive.plan, null, { timeout: 15000 });
      const think = await t.page.evaluate(() => window.__FS.aiActive.plan.think);
      t.expect(think >= 0.4, `the rival would have thought for ${think.toFixed(2)} s`);
      // count animation frames from the press to the rival's throw: frames, not seconds, so a slow machine cannot fail it
      await t.page.evaluate(() => {
        window.__frames = -1;
        const tick = () => { if (window.__game.getState().battle.phase !== 'aim') return; window.__frames++; requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      await t.page.keyboard.press('Space');
      await t.page.waitForFunction(() => window.__FS.sim.b.phase === 'flight', null, { timeout: 8000 });
      const frames = await t.page.evaluate(() => window.__frames);
      t.expect(frames <= 4, `the rival threw ${frames} frames after the press`);
      t.equal((await t.state()).battle.teams[1].stats.throws, 1, 'and it was a real throw');
    },
  },
  {
    name: 'S1-02 a press during a flight runs it faster, a press ends the knockout slow-motion, and the next turn is back at full length',
    viewports: ['desktop'],
    async run(t) {
      await humanFirst(t);
      await t.game('act', 'aim', { angle: 62, power: 0.95 });
      await t.game('act', 'fire', {});
      await t.page.waitForFunction(() => window.__FS.sim.b.phase === 'flight', null, { timeout: 5000 });
      // simulated seconds per real second, before and after the press (the rate is steps over wall time, each over a 250 ms window)
      const rate = (ms) => t.page.evaluate((w) => new Promise((res) => {
        const s0 = window.__FS.steps, t0 = performance.now();
        setTimeout(() => res((window.__FS.steps - s0) / 120 / ((performance.now() - t0) / 1000)), w);
      }), ms);
      await t.waitFrames(12);
      const before = await rate(250);
      t.expect(before > 0.3 && before < 1.6, `a flight runs at about real speed (${before.toFixed(2)}x)`);
      await t.page.evaluate(() => { window.__FS.slowT = 5; });
      await t.page.keyboard.press('Space');
      t.equal(await t.page.evaluate(() => window.__FS.slowT), 0, 'a press ends the slow-motion');
      t.equal(await t.page.evaluate(() => window.__FS.ff), 3, 'and sets the fast-forward');
      const after = await rate(250);
      t.expect(after > before * 1.8, `after the press the flight runs ${after.toFixed(2)}x, against ${before.toFixed(2)}x before`);
      await t.page.waitForFunction(() => window.__FS.sim.b.turn.n >= 1 && window.__FS.sim.b.phase === 'aim', null, { timeout: 20000 });
      t.equal(await t.page.evaluate(() => window.__FS.ff), 1, 'the next turn starts at normal speed again');
    },
  },
  // ---- S1-10 ----
  {
    name: 'S1-10 the knockout camera hold never disables a button, and any key, press or throw ends it',
    async run(t) {
      await humanFirst(t);
      await t.waitFrames(4);
      const hold = () => t.page.evaluate(() => { window.__FS.koHold = 5; window.__FS.reframe = true; window.__FS.guideKey = ''; });
      await hold();
      await t.waitFrames(3);
      const dis = await t.page.evaluate(() => ({ throw: document.getElementById('b-throw').disabled, move: document.getElementById('b-move').disabled }));
      t.expect(!dis.throw && !dis.move, 'Throw and Move are not dead while the camera holds on a knockout');
      const a0 = (await t.state()).battle.teams[0].aim.angle;
      await t.page.keyboard.press('ArrowLeft');
      let st = await t.page.evaluate(() => ({ ko: window.__FS.koHold, re: window.__FS.reframe }));
      t.equal(st.ko, 0, 'a key press ends the hold');
      t.equal(st.re, false, 'and the camera has been put back');
      t.equal((await t.state()).battle.teams[0].aim.angle, a0 + 1, 'the same key still aims');
      await hold();
      await t.page.mouse.click(t.vp.width / 2, t.vp.height / 3);
      t.equal(await t.page.evaluate(() => window.__FS.koHold), 0, 'a press on the field ends the hold');
      await hold();
      await t.page.click('#b-throw');
      st = await t.page.evaluate(() => ({ ko: window.__FS.koHold, re: window.__FS.reframe }));
      t.equal(st.ko, 0, 'the Throw button ends the hold');
      t.equal((await t.state()).battle.teams[0].stats.throws, 1, 'and the nut goes');
    },
  },
  // ---- S2-07 ----
  {
    name: 'S2-07 the Move button shows what stamina is left: a percentage on a desktop, a thin bar on a phone',
    async run(t) {
      await humanFirst(t);
      await t.waitFrames(4);
      const read = () => t.page.evaluate(() => {
        const b = document.getElementById('b-move'), bar = b.querySelector('.stam'), fill = bar.querySelector('b');
        return { label: b.querySelector('.lbl').textContent, aria: b.getAttribute('aria-label'), barShown: getComputedStyle(bar).display !== 'none', fill: fill.getBoundingClientRect().width, track: bar.getBoundingClientRect().width, stam: window.__FS.sim.b.turn.stamina };
      });
      let m = await read();
      t.equal(m.aria, 'Move: 100% stamina left', 'a full turn has 100% stamina');
      if (t.viewport === 'mobile') {
        t.equal(m.label, 'Move', 'the phone label stays short');
        t.expect(m.barShown && Math.abs(m.fill - m.track) < 1.5, `the bar is full (${m.fill.toFixed(1)} of ${m.track.toFixed(1)} px)`);
      } else {
        t.equal(m.label, 'Move (100%)', 'the desktop label carries the percentage');
        t.expect(!m.barShown, 'and the bar is not needed there');
      }
      await snap(t, 'S2-07-move-full');
      const perches = await t.game('act', 'perches');
      const near = perches.filter((p) => p.cost > 0).sort((a, b) => a.cost - b.cost)[0];
      t.expect(!!near, 'a perch is within reach');
      await t.game('act', 'move', { toNode: near.id });
      await t.page.waitForFunction(() => window.__FS.sim.b.turn.stamina < 300, null, { timeout: 5000 });
      await t.page.waitForFunction(() => document.getElementById('b-move').getAttribute('aria-label') !== 'Move: 100% stamina left', null, { timeout: 5000 });
      m = await read();
      const pct = Math.round(m.stam / 3);
      t.equal(m.aria, `Move: ${pct}% stamina left`, 'the label follows the stamina spent');
      if (t.viewport === 'mobile') t.expect(Math.abs(m.fill / m.track - pct / 100) < 0.03, `the bar shrinks to ${pct}% (${((m.fill / m.track) * 100).toFixed(1)}%)`);
      else t.equal(m.label, `Move (${pct}%)`, 'the desktop percentage drops too');
      await t.game('act', 'moveMode');
      await t.waitFrames(4);
      await snap(t, 'S2-07-move-perches');
    },
  },
  // ---- S2-13 ----
  {
    name: 'S2-13 the first tip and the Aim card teach the cancel, and a drag shows a ring where a release cancels',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('act', 'menu', 'story');
      await t.game('act', 'menu', 'team', { v: '0' });
      await t.seed(35594);
      await t.game('act', 'menu', 'play', { v: 'story-01' });
      if ((await t.state()).screen === 'prep') await t.game('act', 'menu', 'prepGo');
      await t.page.waitForFunction(() => /cancel/.test(window.__game.getState().hint), null, { timeout: 8000 });
      t.expect(/Slide back to where you began to cancel/.test((await t.state()).hint), 'the first tip says how to cancel');
      await snap(t, 'S2-13-tip');
      await t.game('scene', 'help');
      t.expect(/slide back to where you began/.test(await t.page.textContent('#screens')), 'the Aim card says it too');
      await humanFirst(t);
      await t.waitFrames(4);
      // synthetic pointer events: the same handlers a mouse or a finger reaches, but the test controls every position
      const pointer = (type, x, y) => t.page.evaluate(([ty, px, py]) => {
        document.getElementById('view').dispatchEvent(new PointerEvent(ty, { pointerId: 7, pointerType: 'touch', clientX: px, clientY: py, button: 0, bubbles: true }));
        return window.__FS.dragRing ? { ...window.__FS.dragRing } : null;
      }, [type, x, y]);
      const x0 = Math.round(t.vp.width * 0.5), y0 = Math.round(t.vp.height * 0.55);
      const aim0 = (await t.state()).battle.teams[0].aim;
      await pointer('pointerdown', x0, y0);
      let ring = await pointer('pointermove', x0 - 120, y0 + 60);
      t.expect(ring && !ring.inside && Math.abs(ring.x - x0) < 1 && Math.abs(ring.y - y0) < 1, 'pulling back draws the ring at the start of the drag');
      t.expect(ring.r >= 12 && ring.r < 60, `of a sensible size (${ring.r.toFixed(1)} px)`);
      await t.waitFrames(3);
      await snap(t, 'S2-13-ring-pull');
      ring = await pointer('pointermove', x0 + 3, y0 + 4);
      t.expect(ring.inside, 'sliding back inside it marks the cancel');
      await t.waitFrames(3);
      await snap(t, 'S2-13-ring-cancel');
      await pointer('pointerup', x0 + 3, y0 + 4);
      let s = await t.state();
      t.equal(s.battle.teams[0].stats.throws, 0, 'a release inside the ring throws nothing');
      t.equal(s.battle.teams[0].aim.angle, aim0.angle, 'and the old aim comes back');
      t.equal(await t.page.evaluate(() => window.__FS.dragRing), null, 'and the ring is gone');
      await pointer('pointerdown', x0, y0);
      await pointer('pointermove', x0 - 120, y0 + 60);
      await pointer('pointerup', x0 - 120, y0 + 60);
      t.equal((await t.state()).battle.teams[0].stats.throws, 1, 'a release outside it still throws');
    },
  },
  // ---- P-N01 ----
  {
    name: 'P-N01 a press on the field spends a trick only when it is short, still and alone; keys still tap at once',
    async run(t) {
      await humanFirst(t);
      await t.waitFrames(4);
      const ptr = (type, id, x, y) => t.page.evaluate(([ty, pid, px, py]) => {
        document.getElementById('view').dispatchEvent(new PointerEvent(ty, { pointerId: pid, pointerType: 'touch', clientX: px, clientY: py, button: 0, bubbles: true }));
      }, [type, id, x, y]);
      const tapped = () => t.page.evaluate(() => { const n = window.__FS.sim.b.nuts[0]; return n ? !!n.tapped : null; });
      const x = Math.round(t.vp.width / 2), y = Math.round(t.vp.height / 2);
      await t.game('setState', { inventory: { chinquapin: 3 } });
      await t.game('act', 'aim', { nut: 'chinquapin', angle: 45, power: 0.7 });
      await t.game('act', 'fire', {});
      await t.game('pause'); // hold the flight still: the test decides when anything happens
      t.equal(await t.page.evaluate(() => window.__FS.sim.b.phase), 'flight', 'a trick nut is in the air');
      t.equal(await tapped(), false, 'and its trick is unspent');
      // 1. a press that moves (a pinch that has not found its second finger, a pan) spends nothing
      await ptr('pointerdown', 1, x, y); await ptr('pointermove', 1, x + 40, y + 10); await ptr('pointerup', 1, x + 40, y + 10);
      t.equal(await tapped(), false, 'a press that moves does not spend the trick');
      // 2. a second finger cancels it, whichever finger lifts first
      await ptr('pointerdown', 1, x, y); await ptr('pointerdown', 2, x + 60, y); await ptr('pointerup', 2, x + 60, y); await ptr('pointerup', 1, x, y);
      t.equal(await tapped(), false, 'a second finger cancels the tap');
      // 3. a long press: holding past the limit (a slow machine only makes it longer)
      await ptr('pointerdown', 1, x, y);
      await t.page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
      await ptr('pointerup', 1, x, y);
      t.equal(await tapped(), false, 'a long press does not spend it either');
      // 4. a short, still press
      await ptr('pointerdown', 1, x, y); await ptr('pointerup', 1, x, y);
      t.equal(await tapped(), true, 'a short still press spends the trick');
      // 5. the keyboard is as it was: Space taps at once, with no release to wait for
      await t.game('resume');
      await humanFirst(t);
      await t.game('setState', { inventory: { chinquapin: 3 } });
      await t.game('act', 'aim', { nut: 'chinquapin', angle: 45, power: 0.7 });
      await t.game('act', 'fire', {});
      await t.game('pause');
      await t.page.keyboard.press('Space');
      t.equal(await tapped(), true, 'Space still spends the trick at once');
    },
  },
  // ---- S6-09 ----
  {
    name: 'S6-09 the title is whole on a phone on its side, and never loses its top edge in a very short window',
    viewports: ['mobile'],
    async run(t) {
      for (const [w, h, fits] of [[844, 390, true], [667, 375, true], [932, 430, true], [568, 320, false], [390, 844, true]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.game('scene', 'title');
        await t.waitFrames(4);
        const m = await t.page.evaluate(() => {
          const logo = document.querySelector('.title-wrap .logo').getBoundingClientRect();
          const credits = [...document.querySelectorAll('.title-wrap .menu .btn')].find((b) => /Credits/.test(b.textContent));
          const before = credits.getBoundingClientRect();
          credits.scrollIntoView({ block: 'end' });
          const after = credits.getBoundingClientRect();
          return { logoTop: logo.top, creditsBefore: Math.round(before.bottom), creditsAfter: Math.round(after.bottom), hScroll: document.documentElement.scrollWidth - innerWidth };
        });
        t.expect(m.logoTop >= 0, `${w}x${h}: the logo starts inside the window (${m.logoTop.toFixed(1)})`);
        t.expect(m.hScroll <= 0, `${w}x${h}: the page does not scroll sideways`);
        t.expect(m.creditsAfter <= h, `${w}x${h}: Credits can be reached (${m.creditsAfter} <= ${h})`);
        if (fits) t.expect(m.creditsBefore <= h, `${w}x${h}: the whole menu is on screen without scrolling (Credits ends at ${m.creditsBefore})`);
        await snap(t, `S6-09-title-${w}x${h}`.replace('x', 'by'));
      }
      await t.page.setViewportSize({ width: 390, height: 844 });
    },
  },
];

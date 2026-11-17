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
    name: 'S1-02 a press hurries the rival: it skips its thinking time and throws on the press, whatever that time was',
    viewports: ['desktop'],
    async run(t) {
      await humanFirst(t);
      await fire(t);
      await t.game('act', 'skipFlight');
      t.equal((await t.state()).battle.turn.team, 1, "it is the rival's turn");
      // make it think for a minute, so that only the press can bring its throw: set in the same call that sees the plan,
      // so a slow machine cannot let the rival throw between the wait and the change
      await t.page.waitForFunction(() => { const A = window.__FS.aiActive; if (!(A && A.done && A.plan)) return false; A.plan.think = 60; return true; }, null, { timeout: 15000 });
      t.equal(await t.page.evaluate(() => !!window.__FS.aiActive.skip), false, 'before the press the rival is not hurried');
      await t.page.keyboard.press('Space');
      // the rival was told to think for a minute, so a throw within the wait can only have come from the press: wait on the state it leaves
      await t.page.waitForFunction(() => window.__FS.sim.b.phase === 'flight', null, { timeout: 8000 });
      t.expect(await t.page.evaluate(() => window.__FS.holdThrow > 0), 'the press set the throw hold, so it does not also throw the next nut');
      t.equal((await t.state()).battle.teams[1].stats.throws, 1, 'and it was a real throw');
    },
  },
  {
    name: 'S1-02 the press that hurries the rival does not also throw the next nut, and a later press does',
    viewports: ['desktop'],
    async run(t) {
      await humanFirst(t);
      await fire(t);
      await t.game('act', 'skipFlight');
      await t.page.waitForFunction(() => { const A = window.__FS.aiActive; if (!(A && A.done && A.plan)) return false; A.plan.think = 60; return true; }, null, { timeout: 15000 });
      await t.page.keyboard.press('Space');
      await t.page.waitForFunction(() => window.__FS.sim.b.phase === 'flight', null, { timeout: 8000 });
      await t.game('act', 'skipFlight');
      // in the same tick in which the turn has passed to the player, the keys that hurried the rival must not throw
      const r = await t.page.evaluate(() => new Promise((res) => {
        const end = performance.now() + 20000;
        const tick = () => {
          const b = window.__FS.sim.b;
          if (performance.now() > end) res({ throws: -1 });
          else if (b.turn.team === 0 && b.phase === 'aim' && window.__FS.holdThrow > performance.now() / 1000) {
            for (const code of ['Space', 'Enter']) window.dispatchEvent(new KeyboardEvent('keydown', { code }));
            res({ throws: b.teams[0].stats.throws });
          } else requestAnimationFrame(tick);
        };
        tick();
      }));
      t.equal(r.throws, 1, 'Space and Enter in the first moments of the next turn throw nothing (the one throw is the first turn)');
      await t.page.waitForFunction(() => performance.now() / 1000 >= window.__FS.holdThrow, null, { timeout: 5000 });
      await t.page.keyboard.press('Space');
      t.equal((await t.state()).battle.teams[0].stats.throws, 2, 'and a press after the pause throws as ever');
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
      await t.waitFrames(4); // the throw event is handled in a frame, and it sets the speed to normal: press after it
      t.equal(await t.page.evaluate(() => window.__FS.ff), 1, 'a flight starts at normal speed');
      await t.page.evaluate(() => { window.__FS.slowT = 5; });
      await t.page.keyboard.press('Space');
      t.equal(await t.page.evaluate(() => window.__FS.slowT), 0, 'a press ends the slow-motion');
      // the speed-up is the fast-forward factor the main loop multiplies its steps by, read as state rather than timed
      t.equal(await t.page.evaluate(() => window.__FS.ff), 3, 'and sets the fast-forward');
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
      t.expect(ring.r >= 12 && ring.r < 70, `of a sensible size (${ring.r.toFixed(1)} px)`);
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
      // a gesture is sent in one page call, so how fast the machine is cannot stretch a press that is meant to be short
      const gesture = (steps) => t.page.evaluate((list) => {
        for (const [ty, pid, px, py] of list) document.getElementById('view').dispatchEvent(new PointerEvent(ty, { pointerId: pid, pointerType: 'touch', clientX: px, clientY: py, button: 0, bubbles: true }));
      }, steps);
      const ptr = (type, id, x, y) => gesture([[type, id, x, y]]);
      const tapped = () => t.page.evaluate(() => { const n = window.__FS.sim.b.nuts[0]; return n ? !!n.tapped : null; });
      const x = Math.round(t.vp.width / 2), y = Math.round(t.vp.height / 2);
      await t.game('setState', { inventory: { chinquapin: 3 } });
      await t.game('act', 'aim', { nut: 'chinquapin', angle: 45, power: 0.7 });
      await t.game('act', 'fire', {});
      await t.game('pause'); // hold the flight still: the test decides when anything happens
      t.equal(await t.page.evaluate(() => window.__FS.sim.b.phase), 'flight', 'a trick nut is in the air');
      t.equal(await tapped(), false, 'and its trick is unspent');
      // 1. a press that moves (a pinch that has not found its second finger, a pan) spends nothing
      await gesture([['pointerdown', 1, x, y], ['pointermove', 1, x + 40, y + 10], ['pointerup', 1, x + 40, y + 10]]);
      t.equal(await tapped(), false, 'a press that moves does not spend the trick');
      // 2. a second finger cancels it, whichever finger lifts first
      await gesture([['pointerdown', 1, x, y], ['pointerdown', 2, x + 60, y], ['pointerup', 2, x + 60, y], ['pointerup', 1, x, y]]);
      t.equal(await tapped(), false, 'a second finger cancels the tap');
      // 3. a long press: holding past the limit (a slow machine only makes it longer)
      await ptr('pointerdown', 1, x, y);
      await t.page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
      await ptr('pointerup', 1, x, y);
      t.equal(await tapped(), false, 'a long press does not spend it either');
      // 4. a short, still press
      await gesture([['pointerdown', 1, x, y], ['pointerup', 1, x, y]]);
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
  // ---- S3-05 ----
  {
    name: 'S3-05 a win with one squirrel lost can earn the second star in a three-a-side battle, and the card says so',
    async run(t) {
      const finish = async (levelId, lost, turnN = 60) => {
        await t.game('act', 'clearSave');
        await t.reload();
        await t.game('setState', { story: { team: 0, unlocked: 12 } });
        await t.seed(5);
        await t.game('newGame', { levelId, mode: 'story', loadout: 'story', unlocked: [], difficulty: 'medium' });
        await t.page.evaluate(([n, tn]) => { const S = window.__FS.sim; S.b.turn.n = tn; S.b.squirrels.filter((q) => q.team === 0).slice(0, n).forEach((q) => { q.out = true; }); }, [lost, turnN]);
        await t.game('scene', 'results');
        await t.page.waitForSelector('.starrule');
        const rule = await t.page.$eval('.starrule', (p) => p.textContent);
        const stars = (await t.state()).save.story.stars[levelId];
        return { rule, stars };
      };
      let r = await finish('story-03', 1);
      t.equal(r.stars, 2, 'story-03 (three a side): a win with one lost, over par: two stars (the win and the squirrels)');
      t.expect(/lose at most one squirrel/.test(r.rule) && !/keep every squirrel/.test(r.rule), `the card names the rule (${r.rule})`);
      await snap(t, 'S3-05-results-three-a-side');
      r = await finish('story-03', 1, 4);
      t.equal(r.stars, 3, 'the same win within par: three stars');
      r = await finish('story-03', 2);
      t.equal(r.stars, 1, 'two lost in a three-a-side battle: one star');
      r = await finish('story-01', 1);
      t.equal(r.stars, 1, 'story-01 (two a side): one lost is still one star');
      t.expect(/keep every squirrel in the trees/.test(r.rule), 'and its card still asks for every squirrel');
      r = await finish('story-01', 0);
      t.equal(r.stars, 2, 'story-01 with nothing lost, over par: two stars');
    },
  },
  // ---- P-N05 ----
  {
    name: 'P-N05 the aim guide rings the bird that a throw made now would meet, and drops the ring when the bird is out of the way',
    async run(t) {
      await humanFirst(t, { birds: 'lots' });
      await t.game('setState', { settings: { aimGuide: 'always' }, wind: 0, aim: { nut: 'acorn', angle: 45, power: 0.7 } });
      await t.game('pause'); // the bird clock stands still, so the test decides where the bird is
      // a bird parked (no speed, no wind) on the arc, a third of the way along it
      const place = (dy) => t.page.evaluate((off) => {
        const sim = window.__FS.sim, clean = sim.preview(sim.b.teams[0].aim, { squirrels: false }), pt = clean.pts[Math.floor(clean.pts.length * 0.3)];
        sim.b.birds = [{ k: 'crow', dir: 1, x0: pt[0], alt: 0, v: 0, ph: 0, ox: 0, oy: 0, R: 1, cx: 0, flee: null }];
        sim.b.birdT = 0;
        sim.b.birds[0].oy = pt[1] - sim.level.floorY + off; // the bird's height is the floor, minus its altitude (0), plus this offset
        window.__FS.guideKey = ''; window.__FS.kick();
        return { n: clean.pts.length };
      }, dy);
      const guide = () => t.page.evaluate(() => { const g = window.__FS.aimGuide; return g ? { dots: g.pts.length, bird: g.bird } : null; });
      const arc = await place(0);
      await t.waitFrames(4);
      let g = await guide();
      t.expect(g && g.bird && g.bird.kind === 'crow', 'a crow on the arc is marked');
      t.expect(g.dots >= Math.round(arc.n * 0.6) - 2, `and the dots are still the whole clear arc (${g.dots} of ${arc.n})`);
      await t.waitFrames(3);
      await snap(t, 'P-N05-bird-in-the-way');
      await place(-500);
      await t.waitFrames(4);
      g = await guide();
      t.expect(g && !g.bird, 'a bird well off the arc is not marked');
    },
  },
  // ---- S6-09 ----
  {
    name: 'S6-09 the title is whole on a phone on its side, and never loses its top edge in a very short window',
    viewports: ['mobile'],
    async run(t) {
      for (const [w, h, fits] of [[844, 390, true], [667, 375, true], [932, 430, true], [568, 320, false], [360, 300, false], [390, 844, true]]) {
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
  // ---- S1-06 ----
  {
    name: 'S1-06 Aim keys: "Toward the rival" flips Left and Right for the family that throws left, and is off by default',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      t.equal((await t.state()).settings.aimKeys, 'asis', 'a fresh profile keeps the keys as they always were');
      // the player's family: the Tails (team 1) throw left, the Rustlers (team 0) right; find a seed where the player goes first
      const start = async (team) => {
        for (const seed of [7, 8, 9, 10, 11, 12, 13, 14]) {
          await t.seed(seed);
          const s = await t.game('newGame', { levelId: 'gray', birds: 'off', team });
          if (s.battle.turn.team === team) return;
        }
        throw new Error('no seed lets the player throw first');
      };
      const angleAfter = async (key) => {
        await t.game('act', 'aim', { angle: 40, power: 0.5 });
        await t.page.keyboard.press(key);
        return (await t.state()).battle.teams[await t.page.evaluate(() => window.__FS.sim.b.turn.team)].aim.angle;
      };
      await start(1);
      t.expect((await angleAfter('ArrowLeft')) > 40, 'as they are: Left raises the arm for the Tails');
      t.expect((await angleAfter('ArrowRight')) < 40, 'and Right lowers it');
      await t.game('setState', { settings: { aimKeys: 'rival' } });
      t.expect((await angleAfter('ArrowLeft')) < 40, 'toward the rival: Left flattens the arm for the Tails');
      t.expect((await angleAfter('ArrowRight')) > 40, 'and Right raises it');
      await start(0);
      t.expect((await angleAfter('ArrowLeft')) > 40, 'the Rustlers throw right: their keys are unchanged');
      t.expect((await angleAfter('ArrowRight')) < 40, 'whichever way the option is set');
      await t.reload();
      t.equal((await t.state()).settings.aimKeys, 'rival', 'the choice survives a reload');
      await t.game('scene', 'settings');
      t.expect(/Aim keys/.test(await t.page.textContent('#screens')) && /Toward the rival/.test(await t.page.textContent('#screens')), 'Settings has the row');
      await t.page.locator('[data-k="aimKeys"]').first().scrollIntoViewIfNeeded();
      await snap(t, 'S1-06-settings');
    },
  },
];

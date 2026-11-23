// Council wave 4, batch A: saves, lifecycle and robustness; controls, rules and play (C4-01, C4-06, S5-14, P-N03, S1-12, S1-13).
import fs from 'node:fs';
const SHOTS = 'screenshots/council/wave-4/shots';
const snap = async (t, name) => {
  await t.shot(name);
  fs.mkdirSync(SHOTS, { recursive: true });
  await t.page.screenshot({ path: `${SHOTS}/${name}-${t.viewport}.png` });
};
async function startHuman(t, opts = {}) {
  for (const seed of [7, 8, 9, 10, 11, 12, 13, 14]) {
    await t.seed(seed);
    const s = await t.game('newGame', { levelId: 'gray', birds: 'off', wind: 'off', ...opts });
    if (s.battle.turn.team === 0) return s;
  }
  throw new Error('no seed lets the player throw first');
}
const aimPhase = (t) => t.page.waitForFunction(() => window.__game.getState().battle.phase === 'aim', null, { timeout: 30000 });

export const tests = [
  {
    name: 'C4-06 Move, View and Throw! have room between them at 150 percent text, and their words fit',
    async run(t) {
      await startHuman(t);
      await aimPhase(t);
      const boxes = () => t.page.evaluate(() => [...document.querySelectorAll('.aimrow .btn')].filter((b) => b.offsetParent).map((b) => {
        const r = b.getBoundingClientRect();
        return { id: b.id, l: r.left, r: r.right, t: r.top, b: r.bottom, cut: b.scrollWidth > b.clientWidth + 1, text: b.textContent.trim() };
      }));
      // the smallest gap between any two buttons of the row (0 or less where they touch or overlap)
      const gap = (bs) => {
        let g = Infinity;
        for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
          const a = bs[i], c = bs[j], dx = Math.max(c.l - a.r, a.l - c.r), dy = Math.max(c.t - a.b, a.t - c.b);
          g = Math.min(g, Math.max(dx, dy));
        }
        return g;
      };
      for (const scale of [1, 1.5]) {
        await t.game('setState', { settings: { textScale: scale } });
        await t.page.waitForFunction((s) => window.__FS.renderer.textScale === s, scale, { timeout: 5000 });
        const bs = await boxes();
        t.expect(bs.length >= 3, `the aim row shows its buttons at ${scale * 100}%: ${bs.map((b) => b.id).join()}`);
        t.expect(gap(bs) >= 4, `at ${scale * 100}% the buttons are at least 4px apart (${gap(bs).toFixed(1)}px)`);
        t.expect(bs.every((b) => !b.cut), `at ${scale * 100}% no button word is cut off: ${bs.filter((b) => b.cut).map((b) => b.text)}`);
        t.expect(bs.every((b) => b.l >= 0 && b.r <= t.vp.width), `at ${scale * 100}% the row stays on the screen`);
        if (scale === 1.5) await snap(t, 'C4-06-text150');
      }
      await t.checkLayout();
    },
  },
  // ---- S5-14 ----
  {
    name: 'S5-14 the delayed cheer is dropped when the player leaves the battle, and still plays when they stay',
    viewports: ['desktop'],
    async run(t) {
      const recent = () => t.page.evaluate(() => window.__game.getState().audio.recent);
      const liveBattle = async () => {
        await t.reload(); // a clean list of the cues heard
        await t.game('newGame', { levelId: 'gray', seed: 7 });
        await t.page.keyboard.press('Shift');
        await t.page.waitForFunction(() => window.__game.getState().audio.ctx === 'running', null, { timeout: 5000 });
      };
      const knockRival = () => t.page.evaluate(() => { const S = window.__FS.sim; S.knockOut(S.b.squirrels.find((q) => q.team === 1 && !q.out)); window.__FS.kick(); });
      // leaving: a knockout, then the title straight away. The page's own 800 ms timer is set after the cheer's 500 ms one, so it
      // cannot fire first, whatever the load: when it has, the cheer's timer has had its turn too.
      await liveBattle();
      await knockRival();
      await t.page.waitForFunction(() => window.__game.getState().audio.recent.includes('ko'), null, { timeout: 8000 });
      await t.game('scene', 'title');
      await t.page.evaluate(() => new Promise((r) => setTimeout(r, 800)));
      t.expect(!(await recent()).includes('cheer'), 'no cheer sounds over the title after leaving: ' + (await recent()).join());
      // a new battle started within the half second drops it too
      await liveBattle();
      await knockRival();
      await t.page.waitForFunction(() => window.__game.getState().audio.recent.includes('ko'), null, { timeout: 8000 });
      await t.game('newGame', { levelId: 'gray', seed: 8 });
      await t.page.evaluate(() => new Promise((r) => setTimeout(r, 800)));
      t.expect(!(await recent()).includes('cheer'), 'nor over a new battle: ' + (await recent()).join());
      // staying: the same knockout, and the cheer comes (this proves the check above can see a cheer)
      await liveBattle();
      await knockRival();
      await t.page.waitForFunction(() => window.__game.getState().audio.recent.includes('cheer'), null, { timeout: 8000 });
    },
  },
  // ---- P-N03 ----
  {
    name: 'P-N03 after a long stall the music scheduler skips ahead: nothing is started in the past, and no pile of notes lands at once',
    viewports: ['desktop'],
    async run(t) {
      // the game's own scheduler (src/js/ui/audiokit.js), run on a context whose clock the test moves by hand
      const r = await t.page.evaluate(async () => {
        const base = new URL('src/js/ui/', location.href).href;
        const { makeAudioKit } = await import(base + 'audiokit.js');
        const { SCORES, SCENES } = await import(base + 'music.js');
        const oc = new OfflineAudioContext(2, 44100, 44100);
        let now = 0, starts = [];
        const ctx = new Proxy(oc, {
          get(o, k) {
            if (k === 'currentTime') return now;
            if (k === 'createOscillator' || k === 'createBufferSource') return () => { const n = o[k](); const go = n.start.bind(n); n.start = (when = 0, ...rest) => { starts.push(when); return go(when, ...rest); }; return n; };
            const v = o[k];
            return typeof v === 'function' ? v.bind(o) : v;
          },
        });
        const kit = makeAudioKit(ctx, oc.destination, { seed: 7 });
        kit.music.play(SCORES[Object.keys(SCORES)[0]], { at: 0, fade: 0.02 });
        kit.amb.play(SCENES[Object.keys(SCENES)[0]], { at: 0, fade: 0.02 });
        // ten seconds of a timer that keeps up (every 25 ms, a quarter second ahead, as the game's does)
        for (now = 0; now < 10; now += 0.025) kit.scheduleUntil(now + 0.25);
        const steady = starts.length;
        // then the page stalls for 6 s (longer than any one bar), and the timer fires once
        starts = [];
        now += 6;
        kit.scheduleUntil(now + 0.25);
        const late = starts.filter((w) => w < now - 0.001).length, atOnce = starts.filter((w) => w < now + 0.1).length;
        return { steady, late, atOnce, total: starts.length, now };
      });
      t.expect(r.steady > 20, `the scheduler really started notes while it kept up (${r.steady} in 10 s)`);
      t.equal(r.late, 0, 'after the stall nothing is started in the past, where it would sound at once');
      t.expect(r.atOnce <= 14, `and no clump starts together: ${r.atOnce} within 0.1 s of the wake-up (a steady second is about ${Math.round(r.steady / 10)})`);
    },
  },
  // ---- S1-12 ----
  {
    name: 'S1-12 a held arrow key steps 1, then 2, then 4, and a first press, a pad nudge and a Shift step stay whole',
    viewports: ['desktop'],
    async run(t) {
      await startHuman(t);
      await aimPhase(t);
      const aim = () => t.page.evaluate(() => { const b = window.__game.getState().battle; return b.teams[b.turn.team].aim; });
      // n key events in one page call: the first is a press, the rest are the operating system's auto-repeats
      const keys = (code, n, extra = {}) => t.page.evaluate(([c, count, ex]) => {
        for (let i = 0; i < count; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code: c, repeat: i > 0, bubbles: true, ...ex }));
      }, [code, n, extra]);
      await t.game('act', 'aim', { angle: -30, power: 1 });
      await keys('ArrowLeft', 1);
      t.equal((await aim()).angle, -29, 'a single press is one degree, as ever');
      await t.game('act', 'aim', { angle: -30, power: 1 });
      await keys('ArrowLeft', 10);
      t.equal((await aim()).angle, -20, 'the first ten steps of a held key are one degree each');
      await t.game('act', 'aim', { angle: -30, power: 1 });
      await keys('ArrowLeft', 40);
      t.equal((await aim()).angle, 70, 'forty steps: 10 at 1, 15 at 2 and 15 at 4 degrees');
      await keys('ArrowLeft', 1);
      t.equal((await aim()).angle, 71, 'a new press starts again at one degree');
      await t.game('act', 'aim', { angle: 0, power: 1 });
      await keys('ArrowDown', 20);
      t.equal(Math.round((await aim()).power * 100), 70, 'power ramps the same way: twenty steps are 10 at 1 and 10 at 2 percent');
      await t.game('act', 'aim', { angle: 0, power: 0.5 });
      await keys('ArrowUp', 1, { shiftKey: true });
      t.equal(Math.round((await aim()).power * 100), 55, 'a Shift step is five percent, as ever');
      await t.game('act', 'aim', { angle: 40, power: 0.5 });
      await keys('ArrowRight', 12, { shiftKey: true });
      t.equal((await aim()).angle, -20, 'and Shift is not ramped: twelve Shift steps are 5 degrees each');
      // a held key hands over to another key from step one
      await t.game('act', 'aim', { angle: 0, power: 0.5 });
      await t.page.evaluate(() => {
        for (let i = 0; i < 30; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', repeat: i > 0, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', repeat: true, bubbles: true }));
      });
      t.equal((await aim()).angle, 10 + 30 + 20 - 1, 'a different key that is already repeating starts at one degree (30 steps: 10 + 30 + 20, then one back)');
    },
  },
  {
    name: 'S1-12 stick nudges move the aim in whole degrees and whole percents, even a gentle push',
    viewports: ['desktop'],
    initScript: () => {
      const pad = { index: 0, connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
      window.__pad = pad;
      navigator.getGamepads = () => [pad];
    },
    async run(t) {
      await startHuman(t);
      await aimPhase(t);
      await t.page.evaluate(() => window.dispatchEvent(new Event('gamepadconnected')));
      const aim = () => t.page.evaluate(() => { const b = window.__game.getState().battle; return b.teams[b.turn.team].aim; });
      const whole = (a) => Number.isInteger(a.angle) && Math.abs(a.power * 100 - Math.round(a.power * 100)) < 1e-9;
      await t.game('act', 'aim', { angle: 30, power: 0.5 });
      // a firm push to the right and down until the aim has moved well past a few frames' worth
      await t.page.evaluate(() => { window.__pad.axes[0] = 0.73; window.__pad.axes[1] = 0.41; });
      await t.page.waitForFunction(() => { const b = window.__game.getState().battle, a = b.teams[b.turn.team].aim; return a.angle <= 24 && a.power <= 0.46; }, null, { timeout: 20000 });
      await t.page.evaluate(() => { window.__pad.axes[0] = 0; window.__pad.axes[1] = 0; });
      const a1 = await aim();
      t.expect(whole(a1), `after a firm push the aim is whole: ${a1.angle} degrees, ${a1.power * 100} percent`);
      // a gentle push: each frame adds well under a degree, and the aim must still creep along
      await t.page.evaluate(() => { window.__pad.axes[0] = -0.25; });
      await t.page.waitForFunction((from) => window.__game.getState().battle.teams[0].aim.angle >= from + 3, a1.angle, { timeout: 20000 });
      await t.page.evaluate(() => { window.__pad.axes[0] = 0; });
      const a2 = await aim();
      t.expect(whole(a2), `after a gentle push it is whole too: ${a2.angle} degrees`);
      t.expect(a2.angle >= a1.angle + 3, 'and a gentle push did move it');
      const shown = await t.page.$eval('#readout', (r) => r.textContent);
      t.expect(shown.startsWith(`${a2.angle}° · ${Math.round(a2.power * 100)}%`), `the readout says what the aim is: ${shown}`);
    },
  },
  {
    name: 'S1-12 How to Play tells a keyboard player that a held key speeds up, and the card fits',
    async run(t) {
      await t.game('scene', 'help');
      await t.page.waitForSelector('.card');
      const card = await t.page.evaluate(() => { const c = [...document.querySelectorAll('.card')].find((d) => /^Keyboard/.test(d.textContent)); const r = c.getBoundingClientRect(); return { text: c.textContent, right: r.right, over: c.scrollWidth > c.clientWidth + 1 }; });
      t.expect(/hold a key to speed up/.test(card.text), 'the Keyboard card says it: ' + card.text.slice(0, 90));
      t.expect(card.right <= t.vp.width && !card.over, 'and the card stays inside the screen');
      await t.page.evaluate(() => [...document.querySelectorAll('.card')].find((d) => /^Keyboard/.test(d.textContent)).scrollIntoView({ block: 'center' }));
      await snap(t, 'S1-12-help-keyboard');
      await t.checkLayout({ allowScrollY: true });
    },
  },
  // ---- S1-13 ----
  {
    name: 'S1-13 a new player on a phone is told once to use two fingers to look around; a mouse, or a player who has finished a battle, is not',
    async run(t) {
      const ALL = ['quick', 'practice', 'nut-chinquapin', 'nut-pecan', 'nut-walnut', 'nut-hickory', 'nut-sweetgum', 'nut-hedgeapple', 'steam', 'wind'];
      const TEXT = 'Two fingers to look around.';
      const fresh = async (battles) => {
        await t.game('act', 'clearSave');
        await t.reload();
        await startHuman(t);
        await aimPhase(t);
        // every other tip has been seen, so the one under test is the only one left
        await t.page.evaluate(([ids, n]) => { const A = window.__FS; A.save.settings.seenTips = ids; A.save.stats.battles = n; A.hud.hint(''); }, [ALL, battles]);
      };
      const hint = async () => { await t.page.evaluate(() => window.__FS.tips()); return (await t.state()).hint.replace(/Tap anywhere to close$/, '').trim(); };
      await fresh(0);
      const first = await hint();
      if (t.viewport === 'mobile') {
        t.equal(first, TEXT, 'a new player on a touch screen is told');
        t.expect(first.split(/\s+/).length <= 12, 'in twelve words or fewer');
        await snap(t, 'S1-13-pan-hint');
        await t.page.evaluate(() => window.__FS.hud.hint(''));
        t.equal(await hint(), '', 'and only once');
        t.equal(await t.page.evaluate(() => window.__FS.save.settings.seenTips.length), ALL.length, 'nothing is added to the save');
        await fresh(1);
        t.equal(await hint(), '', 'a player who has finished a battle is not told');
        await fresh(0);
        await t.page.evaluate(() => { window.__FS.save.settings.tutorial = false; });
        t.equal(await hint(), '', 'and Tutorial hints Off silences it');
      } else {
        t.equal(first, '', 'a mouse player has no use for it');
      }
    },
  },
  // ---- C4-01 ----
  {
    name: 'C4-01 a complete save from a newer version is byte for byte the same after a whole visit, and the player is told once',
    viewports: ['desktop'],
    async run(t) {
      const KEY = 'hsg-furious-squirrels-v1';
      // a real, complete save with progress in it, marked as written by version 2
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('setState', { story: { team: 0, unlocked: 5 }, settings: { textScale: 1.25 } });
      await t.game('act', 'menu', 'set', { k: 'sound', v: 'false' });
      const newer = await t.page.evaluate((k) => { const o = JSON.parse(localStorage.getItem(k)); o.v = 2; o.story.unlocked = 5; const raw = JSON.stringify(o); localStorage.setItem(k, raw); return raw; }, KEY);
      await t.reload();
      const told = () => t.page.evaluate(() => (document.getElementById('screens').textContent.match(/newer version of the game/g) || []).length);
      t.equal(await told(), 1, 'the title says once that the save is from a newer version');
      t.expect(/not be saved/.test(await t.page.textContent('#screens')), 'and that this visit is not being saved');
      t.equal((await t.state()).save.story.unlocked, 1, 'the visit plays from defaults, not from the newer save');
      // a visit that would normally save a lot: settings, a quick-battle setup, a played battle, a result
      await t.game('act', 'menu', 'set', { k: 'sound', v: 'true' });
      await t.game('act', 'menu', 'set', { k: 'textScale', v: '1.5' });
      await t.game('act', 'menu', 'qset', { k: 'size', v: '2' });
      await t.seed(7);
      await t.game('newGame', { levelId: 'story-01', mode: 'story', loadout: 'story' });
      await t.game('act', 'fire', {});
      await t.game('act', 'skipFlight');
      await t.game('scene', 'results');
      await t.page.waitForFunction(() => window.__FS.screens.cur === 'results', null, { timeout: 10000 });
      await t.game('scene', 'title');
      t.equal(await t.page.evaluate((k) => localStorage.getItem(k), KEY), newer, 'the newer save is byte for byte what it was');
      t.equal(await t.page.evaluate((k) => localStorage.getItem(k + '-bad'), KEY), null, 'and no copy was set aside as damaged');
    },
  },
];

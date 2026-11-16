// Council wave 4, batch A: saves, lifecycle and robustness; controls, rules and play (C4-01, C4-06, S5-14, P-N03, S1-12, S1-13).
import fs from 'node:fs';
const SHOTS = '../_council/hsg-furious-squirrels/wave-4/shots';
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
];

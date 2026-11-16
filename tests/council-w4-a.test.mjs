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
];

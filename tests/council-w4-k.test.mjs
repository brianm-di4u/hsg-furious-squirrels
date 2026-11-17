// Council wave 4b, clean-up pass: K-02 (a menu panel can be pinch-zoomed, the battle view keeps its own pinch),
// K-03 (nut names anchored to their own element; the checks live in m3 and council-w2-c).
import fs from 'node:fs';
const SHOTS = '../_council/hsg-furious-squirrels/wave-4b/shots';
const snap = async (t, name) => {
  await t.shot(name);
  fs.mkdirSync(SHOTS, { recursive: true });
  await t.page.screenshot({ path: `${SHOTS}/${name}-${t.viewport}.png` });
};
// The touch-action that really applies to an element: its own value and its ancestors', up to and including the nearest scroll
// container (the browser's rule), kept to the gestures every one of them allows.
const effectiveTouchAction = (t, selector) => t.page.evaluate((sel) => {
  let allowed = null;
  for (let el = document.querySelector(sel); el; el = el.parentElement) {
    const cs = getComputedStyle(el), v = cs.touchAction.split(' ').filter(Boolean);
    const set = v.includes('auto') ? ['pan-x', 'pan-y', 'pinch-zoom'] : v.includes('manipulation') ? ['pan-x', 'pan-y', 'pinch-zoom'] : v.includes('none') ? [] : v;
    allowed = allowed === null ? set : allowed.filter((g) => set.includes(g));
    if (/hidden|scroll|auto/.test(cs.overflowX + cs.overflowY)) break; // clip and visible do not make a scroll container
  }
  return allowed.sort().join(' ');
}, selector);

export const tests = [
  {
    name: 'K-02 a menu panel lets a pinch and a vertical pan through, and the battle view keeps both for its own camera',
    viewports: ['mobile'],
    async run(t) {
      t.equal(await t.page.evaluate(() => window.innerWidth), 390, 'the phone is 390 px wide');
      await t.game('setState', { story: { unlocked: 3, team: 0 } });
      await t.game('scene', 'story');
      await t.page.waitForSelector('.panel', { timeout: 10000 });
      const panel = await effectiveTouchAction(t, '.panel');
      t.equal(panel, 'pan-y pinch-zoom', 'a menu panel allows a vertical pan and a pinch');
      await snap(t, 'K-02-panel');
      await t.game('newGame', { levelId: 'story-01', mode: 'story', seed: 5 });
      await t.page.waitForFunction(() => window.__game.getState().battle.phase === 'aim' || window.__game.getState().battle.phase === 'flight', null, { timeout: 30000 });
      t.equal(await effectiveTouchAction(t, '#view'), '', 'the battle view takes no browser gesture: its own pinch moves the camera');
    },
  },
];

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
];

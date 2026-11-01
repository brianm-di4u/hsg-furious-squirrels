// Fixed capture list for the visual review loop (reviews/PROTOCOL.md). Runs only for review-loop-* milestones.
// Every capture uses a fixed seed and a frozen render clock so loops compare like with like.
const only = (t) => /^review/.test(t.milestone || '');

async function battle(t, levelId, seed, extra = {}) {
  await t.game('newGame', { levelId, seed, mode: 'quick', ...extra });
  await t.page.evaluate(() => { const S = window.__FS.sim; if (S.b.turn.team !== 0) { S.b.turn.team = 0; S.pickSquirrel(); } window.__FS.aiActive = null; window.__FS.guideKey = ''; });
  await t.game('step', 1);
  await t.game('act', 'cam', 'frame');
  await t.page.waitForFunction(() => window.__FS.loading === 0, null, { timeout: 8000 });
}

export const tests = [
  {
    name: 'review captures',
    slow: true,
    async run(t) {
      if (!only(t)) { t.log('review captures run only for review-loop-* milestones'); return; }
      await t.game('scene', 'title');
      await t.page.waitForFunction(() => window.__FS.loading === 0, null, { timeout: 8000 });
      await t.game('act', 'clock', 1200);
      await t.shot('r01-title');
      await t.game('act', 'clock', null);
      await t.game('setState', { story: { team: 0, unlocked: 5, stars: { 'story-01': 3, 'story-02': 2, 'story-03': 2, 'story-04': 1 } } });
      await t.game('act', 'menu', 'story');
      await t.shot('r02-story-map');
      for (const [lv, name] of [['story-02', 'r03-battle-north-summer'], ['story-07', 'r04-battle-south-fall'], ['story-11', 'r05-battle-middle-winter-night']]) {
        await battle(t, lv, 21);
        await t.game('act', 'clock', 1500);
        await t.shot(name);
        await t.game('act', 'clock', null);
      }
      // aiming with the guide
      await battle(t, 'story-04', 8);
      await t.game('act', 'aim', { angle: 48, power: 0.78, nut: 'walnut' });
      await t.game('act', 'clock', 900);
      await t.shot('r06-aim');
      // mid-flight walnut burst near the Tails
      await t.game('pause');
      const plan = await t.game('act', 'aiPlan', 'hard');
      await t.game('act', 'fire', { nut: 'walnut', angle: plan.angle, power: plan.power });
      const steps = await t.page.evaluate(() => { const S = window.__FS.sim; const p = S.preview({ nut: 'walnut', angle: S.b.teams[0].aim.angle, power: S.b.teams[0].aim.power }); return p.steps; });
      await t.game('step', Math.max(1, steps - 40));
      await t.game('act', 'cam', 'frame');
      await t.shot('r07-flight', { wait: false });
      await t.game('step', 44);
      await t.shot('r08-impact', { wait: false });
      await t.game('resume');
      // knockout tumble
      await battle(t, 'story-03', 5);
      await t.page.evaluate(() => { const S = window.__FS.sim; S.b.shot = { team: 0, sq: 0, kind: 'acorn', dmg: 0, kos: 0, breaks: 0 }; S.damage(S.b.squirrels.find((q) => q.team === 1), 100, { team: 0 }); });
      await t.game('step', 1);
      await t.page.waitForTimeout(450);
      await t.shot('r09-knockout', { wait: false });
      await t.game('act', 'clock', null);
      // shop and results
      await battle(t, 'story-05', 3, { rounds: 3 });
      await t.game('scene', 'shop');
      await t.shot('r10-shop');
      // a real battle played out by the AI for both sides, so the results show real numbers
      await t.game('act', 'menu', 'play', { v: 'story-06' });
      await t.page.evaluate(() => {
        const A = window.__FS, S = A.sim; A.testPaused = true;
        for (let i = 0; i < 80 && S.b.phase !== 'battleEnd'; i++) {
          if (S.b.phase === 'roundEnd') { S.continueBattle(); continue; }
          const p = window.__game.act('aiPlan', 'hard'); if (!p) { S.nextTurn(); continue; }
          S.throwNut(p); while (S.busy()) A.stepOnce();
        }
        A.testPaused = false;
      });
      await t.page.waitForFunction(() => window.__game.getState().screen === 'results', null, { timeout: 8000 });
      await t.shot('r11-results');
      await t.game('act', 'menu', 'help');
      await t.shot('r12-help');
      await t.game('scene', 'practice');
      await t.game('act', 'clock', 800);
      await t.shot('r13-practice');
      await t.game('act', 'clock', null);
    },
  },
];

// M2: nuts, rounds and shop, menus, saves, touch and gamepad (AC2, AC13, AC14, AC22, AC25, AC26).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const levels = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'levels/all.json'), 'utf8'));

async function sim() {
  const { Sim } = await import('../src/js/sim/battle.js');
  const S = new Sim(levels().gray, { seed: 5, human: [true, true], loadout: 'practice' });
  if (S.b.turn.team !== 0) { S.b.turn.team = 0; S.pickSquirrel(); }
  S.b.wind = 0;
  return S;
}
// fly a throw step by step and report what happened
function fly(S, shot) {
  S.throwNut(shot);
  let maxNuts = 0, states = new Set(), steps = 0;
  while (S.busy() && steps < 4000) { S.step(); steps++; maxNuts = Math.max(maxNuts, S.b.nuts.length); for (const n of S.b.nuts) states.add(n.state); }
  return { maxNuts, states: [...states], events: S.drain() };
}

async function myTurn(t, opts = {}) {
  await t.game('newGame', { levelId: 'gray', seed: 7, loadout: 'all', ...opts });
  await t.page.evaluate(() => { const S = window.__FS.sim; if (S.b.turn.team !== 0) { S.b.turn.team = 0; S.pickSquirrel(); } S.b.wind = 0; window.__FS.aiActive = null; });
  await t.game('step', 1);
}

export const tests = [
  {
    name: 'each nut behaves as specified',
    node: true,
    async run(t) {
      const { NUTS } = await import('../src/js/sim/const.js');
      let S = await sim(), r = fly(S, { nut: 'chinquapin', angle: 50, power: 0.85, tapAt: 60 });
      t.equal(r.maxNuts, 3, 'trio splits into three');
      S = await sim(); r = fly(S, { nut: 'pecan', angle: 50, power: 0.85, tapAt: 60 });
      t.expect(r.states.includes('dash'), 'pecan dashes');
      S = await sim(); r = fly(S, { nut: 'hickory', angle: 50, power: 0.85, tapAt: 50 });
      t.expect(r.states.includes('hook'), 'hickory hooks');
      S = await sim(); r = fly(S, { nut: 'sweetgum', angle: 50, power: 0.85, tapAt: 60 });
      t.expect(r.states.includes('husk') && r.maxNuts === 2, 'sweetgum drops a ball and leaves a husk');
      S = await sim(); r = fly(S, { nut: 'walnut', angle: 50, power: 0.85, tapAt: 60 });
      t.expect(r.events.some((e) => e.type === 'impact' && e.burst), 'walnut bursts');
      S = await sim(); for (const q of S.b.squirrels) if (q.id !== S.b.turn.sq) q.out = true; // a clear slope below
      r = fly(S, { nut: 'hedgeapple', angle: -20, power: 0.3 }); // down onto our own slope
      t.expect(r.states.includes('roll') || r.events.some((e) => e.type === 'thud'), 'hedge apple rolls on landing');
      // the hook really turns back: x travel with the hook is shorter than without
      const a = await sim(), b = await sim();
      const pa = a.preview({ nut: 'hickory', angle: 55, power: 0.8 }, { squirrels: false }), pb = b.preview({ nut: 'hickory', angle: 55, power: 0.8 }, { squirrels: false, tapAt: 50 });
      t.expect(pb.impact.x < pa.impact.x - 100, `hook lands well short of the straight throw (${Math.round(pb.impact.x)} vs ${Math.round(pa.impact.x)})`);
      // hedge apple shrugs off wind
      const w = await sim();
      // horizontal position 1.5 s into the flight (before anything is hit), with wind each way
      const imp = (nut, wind) => { w.b.wind = wind; return w.preview({ nut, angle: 45, power: 0.8 }, { squirrels: false, every: 1, stopAtFirst: false }).pts[180][0]; };
      const dAcorn = Math.abs(imp('acorn', 1) - imp('acorn', -1)), dHedge = Math.abs(imp('hedgeapple', 1) - imp('hedgeapple', -1));
      t.expect(dHedge < dAcorn * 0.6, `hedge apple drifts less in wind (${Math.round(dHedge)} vs ${Math.round(dAcorn)})`);
      t.expect(Object.keys(NUTS).length === 7, 'seven nuts');
    },
  },
  {
    name: 'nut tricks on screen',
    viewports: ['desktop'],
    async run(t) {
      for (const [nut, tap] of [['chinquapin', 70], ['pecan', 70], ['walnut', 0], ['hickory', 60], ['sweetgum', 70], ['hedgeapple', 0]]) {
        await myTurn(t);
        await t.game('act', 'fire', { nut, angle: 52, power: 0.88 });
        await t.game('pause');
        if (tap) { await t.game('step', tap); await t.game('act', 'tap'); await t.game('step', 22); }
        else await t.game('step', nut === 'walnut' ? 150 : 110);
        await t.game('act', 'cam', 'frame');
        await t.game('act', 'clock', 1500);
        await t.shot('m2-nut-' + nut, { wait: false });
        await t.game('act', 'clock', null);
        await t.game('resume');
      }
    },
  },
  {
    name: 'rounds and the acorn shop',
    async run(t) {
      await myTurn(t, { rounds: 3 });
      await t.game('scene', 'shop');
      let s = await t.state();
      t.equal(s.screen, 'shop', 'shop between rounds');
      const before = s.battle.teams[0];
      const r1 = await t.game('act', 'buyNut', 'pecan', 0);
      t.expect(r1.ok, 'buy a pecan');
      s = await t.state();
      t.equal(s.battle.teams[0].acorns, before.acorns - 30, 'pecan costs 30 acorns');
      await t.game('setState', { acorns: 999, team: 0 });
      for (let i = 0; i < 5; i++) await t.game('act', 'buyNut', 'walnut', 0);
      s = await t.state();
      t.equal(s.battle.teams[0].inventory.walnut, 3, 'capped at 3 walnuts');
      await t.game('setState', { acorns: 10, team: 0 });
      t.equal((await t.game('act', 'buyNut', 'hedgeapple', 0)).why, 'acorns', 'price enforced: not enough acorns for a hedge apple');
      await t.game('pause');
      await t.game('act', 'menu', 'nextRound');
      s = await t.state();
      t.equal(s.battle.round, 2, 'round two starts');
      t.equal(s.battle.roundWins[0], 1, 'round one counted');
      t.expect(s.battle.squirrels.every((q) => !q.out && q.grip === 64), 'fresh grip for round two');
      await t.shot('m2-round-two', { wait: false });
      await t.game('resume');
    },
  },
  {
    name: 'shop screen',
    async run(t) {
      await myTurn(t, { rounds: 3 });
      await t.game('scene', 'shop');
      await t.shot('m2-shop');
      await t.checkLayout();
    },
  },
  {
    name: 'menus keyboard-only',
    viewports: ['desktop'],
    async run(t) {
      await t.game('scene', 'title');
      // Quick Battle via keyboard: arrow down to it, Enter
      await t.page.keyboard.press('ArrowDown');
      const f = await t.page.evaluate(() => document.activeElement.textContent.trim());
      t.equal(f, 'Quick Battle', 'arrow moves focus to Quick Battle');
      await t.page.keyboard.press('Enter');
      t.equal((await t.state()).screen, 'quick', 'Enter opens Quick Battle');
      await t.shot('m2-menus');
      await t.page.keyboard.press('Escape');
      t.equal((await t.state()).screen, 'title', 'Escape goes back');
      // settings toggles with keyboard
      await t.game('scene', 'settings');
      const btn = await t.page.$('button[data-k="sound"][data-v="false"]');
      await btn.focus(); await t.page.keyboard.press('Enter');
      t.equal((await t.state()).settings.sound, false, 'Sound off via keyboard');
      await t.shot('m2-settings');
      await t.page.keyboard.press('Escape');
    },
  },
  {
    name: 'pause, help and settings in battle',
    async run(t) {
      await myTurn(t);
      await t.page.keyboard.press('Escape');
      let s = await t.state();
      t.equal(s.screen, 'pause', 'Esc pauses');
      await t.shot('m2-pause');
      await t.game('act', 'menu', 'help');
      await t.shot('m2-help');
      await t.game('act', 'menu', 'back');
      t.equal((await t.state()).screen, 'pause', 'back to pause');
      await t.game('act', 'menu', 'resume');
      s = await t.state();
      t.equal(s.screen, null, 'resumed');
    },
  },
  {
    name: 'touch layout and targets',
    viewports: ['mobile'],
    async run(t) {
      await myTurn(t);
      const small = await t.page.$$eval('#hud button', (bs) => bs.filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length);
      t.equal(small, 0, 'every HUD button at least 44 px');
      await t.checkLayout();
      await t.shot('m2-touch');
      // tap a nut, tap Throw
      const center = async (sel) => t.page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      await t.tap(await center('.nut[data-nut="walnut"]'));
      t.equal((await t.state()).battle.teams[0].aim.nut, 'walnut', 'tap selects a nut');
      await t.tap(await center('#b-throw'));
      t.equal((await t.state()).battle.phase, 'flight', 'tap Throw throws');
    },
  },
  {
    name: 'saves, resume and blocked storage',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'clearSave');
      await t.game('setState', { story: { team: 0, unlocked: 3, stars: { 'story-01': 2 } } });
      await t.reload();
      let s = await t.state();
      t.equal(s.save.story.unlocked, 3, 'story progress survives a reload');
      t.equal(s.save.story.stars['story-01'], 2, 'stars survive a reload');
      // a story battle saves a resume point at each human turn
      await t.game('act', 'menu', 'play', { v: 'story-02' });
      await t.page.evaluate(() => { const S = window.__FS.sim; if (S.b.turn.team !== 0) { S.b.turn.team = 0; S.pickSquirrel(); window.__FS.aiActive = null; } });
      await t.game('act', 'menu', 'resume');
      await t.page.evaluate(() => { const S = window.__FS.sim; S.nextTurn(); S.nextTurn(); });
      await t.game('step', 2);
      await t.reload();
      s = await t.state();
      t.expect(s.save.resume, 'resume point saved');
      const label = await t.page.textContent('#screens');
      t.expect(/Resume battle/.test(label), 'title offers Resume battle');
    },
  },
  {
    name: 'plays with storage blocked',
    viewports: ['desktop'],
    initScript: () => { const thr = () => { throw new Error('blocked'); }; Object.defineProperty(window, 'localStorage', { get: thr }); },
    async run(t) {
      const s = await t.state();
      t.equal(s.scene, 'title', 'boots without storage');
      await myTurn(t);
      await t.game('act', 'fire', { angle: 45, power: 0.8 });
      await t.game('act', 'skipFlight');
      t.expect((await t.state()).battle.turn.n >= 1, 'battle runs without storage');
    },
  },
  {
    name: 'gamepad aim and throw',
    viewports: ['desktop'],
    initScript: () => {
      const pad = { index: 0, connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
      window.__pad = pad;
      navigator.getGamepads = () => [pad];
    },
    async run(t) {
      await myTurn(t);
      const a0 = (await t.state()).battle.teams[0].aim.angle;
      await t.page.evaluate(() => { window.__pad.axes[0] = -1; });
      await t.page.waitForTimeout(250);
      await t.page.evaluate(() => { window.__pad.axes[0] = 0; });
      const a1 = (await t.state()).battle.teams[0].aim.angle;
      t.expect(a1 > a0, `left stick raises the angle (${a0} -> ${a1})`);
      await t.page.evaluate(() => { window.__pad.buttons[0].pressed = true; });
      await t.page.waitForTimeout(120);
      await t.page.evaluate(() => { window.__pad.buttons[0].pressed = false; });
      t.equal((await t.state()).battle.phase, 'flight', 'A throws');
    },
  },
];

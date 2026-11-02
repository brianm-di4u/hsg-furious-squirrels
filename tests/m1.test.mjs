// M1: the core loop and its feel (DEV-PLAN test matrix AC5, AC6, AC7, AC8, AC9, AC10, AC11, AC12).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const levels = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'levels/all.json'), 'utf8'));

// start a battle and make sure it is the human Rustlers' turn
async function myTurn(t, opts = {}) {
  await t.game('newGame', { levelId: 'gray', seed: 7, ...opts });
  await t.page.evaluate(() => { const S = window.__FS.sim; if (S.b.turn.team !== 0) { S.b.turn.team = 0; S.pickSquirrel(); } S.b.wind = 0; window.__FS.guideKey = ''; });
  await t.game('step', 1);
  return t.state();
}

export const tests = [
  {
    name: 'mouse drag aim and throw',
    viewports: ['desktop'],
    async run(t) {
      await myTurn(t);
      const p = t.page.mouse;
      await p.move(700, 380); await p.down();
      await p.move(620, 460, { steps: 6 }); await p.move(560, 520, { steps: 6 });
      const s = await t.state(), aim = s.battle.teams[0].aim;
      t.expect(Math.abs(aim.angle - 45) <= 3, 'pull back down-left aims about 45° (got ' + aim.angle + ')');
      t.expect(aim.power > 0.3 && aim.power < 0.8, 'drag length sets power (got ' + aim.power + ')');
      await t.shot('m1-aim', { wait: false });
      await p.up();
      const s2 = await t.state();
      t.equal(s2.battle.phase, 'flight', 'release throws');
    },
  },
  {
    name: 'keyboard aim, throw and trick',
    async run(t) {
      await myTurn(t);
      await t.game('act', 'aim', { angle: 40, power: 0.7, nut: 'chinquapin' });
      for (let i = 0; i < 5; i++) await t.page.keyboard.press('ArrowLeft');
      for (let i = 0; i < 10; i++) await t.page.keyboard.press('ArrowUp');
      let s = await t.state();
      t.equal(Math.round(s.battle.teams[0].aim.angle), 45, 'left arrow raises the angle');
      t.equal(Math.round(s.battle.teams[0].aim.power * 100), 80, 'up arrow adds power');
      await t.page.keyboard.press('Space');
      s = await t.state();
      t.equal(s.battle.phase, 'flight', 'Space throws');
      await t.game('pause');
      await t.game('step', 40);
      await t.page.keyboard.press('Space');
      s = await t.state();
      t.equal(s.battle.nuts.length, 3, 'Space in flight splits the trio');
      await t.game('resume');
    },
  },
  {
    name: 'touch aim and throw',
    viewports: ['mobile'],
    async run(t) {
      await myTurn(t);
      await t.touchDrag([230, 520], [150, 600], { holdEndMs: 150 });
      const s = await t.state();
      t.expect(['flight', 'settle', 'aim'].includes(s.battle.phase), 'touch drag handled');
      t.equal(s.battle.phase, 'flight', 'releasing a touch drag throws');
      await t.game('act', 'skipFlight');
      await t.shot('m1-aim-touch');
    },
  },
  {
    name: 'tutorial hints close on a tap and never show on AI turns',
    viewports: ['mobile'],
    slow: true,
    async run(t) {
      const myAim = () => t.page.waitForFunction(() => { const S = window.__FS.sim; return S.b.turn.team === 0 && S.b.phase === 'aim' && !S.busy(); }, null, { timeout: 20000 });
      let s = await t.game('newGame', { levelId: 'story-01', seed: 5 });
      if (s.battle.turn.team !== 0) { t.equal(s.hint, '', 'no hint on the AI turn'); await myAim(); }
      s = await t.state();
      t.expect(/Drag back/.test(s.hint), 'first tip shows on the first turn (got "' + s.hint + '")');
      t.expect(await t.page.$eval('#hint', (h) => h.classList.contains('show') && /Tap anywhere to close/.test(h.textContent)), 'hint is visible with a close note');
      const box = await t.page.$eval('#hint', (h) => { const r = h.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      await t.tap(box);
      s = await t.state();
      t.equal(s.hint, '', 'tapping the hint closes it');
      t.equal(s.battle.phase, 'aim', 'the tap does not throw');
      await t.game('act', 'fire', {});
      await t.game('act', 'skipFlight');
      s = await t.state();
      if (s.battle.turn.team !== 0) t.equal(s.hint, '', 'no hint on the AI turn');
      await myAim();
      s = await t.state();
      t.expect(/Wind/.test(s.hint), 'second tip shows on the next turn (got "' + s.hint + '")');
      await t.tap([20, Math.round(s.render.h / 2)]);
      t.equal((await t.state()).hint, '', 'a tap anywhere closes it');
      // the third tip goes away on its own, then no more tips
      await t.game('act', 'fire', {}); await t.game('act', 'skipFlight');
      await myAim();
      t.expect(/Knock every rival/.test((await t.state()).hint), 'third tip shows');
      await t.page.waitForFunction(() => window.__game.getState().hint === '', null, { timeout: 10000 });
      await t.game('act', 'fire', {}); await t.game('act', 'skipFlight');
      await myAim();
      t.equal((await t.state()).hint, '', 'no tips once all three have shown');
    },
  },
  {
    name: 'wind bends the arc',
    viewports: ['desktop'],
    async run(t) {
      await myTurn(t);
      const xs = [];
      for (const w of [-1, 0, 1]) {
        await t.game('act', 'setWind', w);
        const im = await t.game('act', 'preview', { nut: 'acorn', angle: 60, power: 0.85 }, { squirrels: false });
        xs.push(im.x);
      }
      t.expect(xs[0] < xs[1] && xs[1] < xs[2], 'west wind short, east wind long: ' + xs.map(Math.round).join(' < '));
      await t.game('act', 'setWind', 0.8);
      await t.shot('m1-wind', { wait: false });
    },
  },
  {
    name: 'steam lifts a nut',
    viewports: ['desktop'],
    async run(t) {
      await myTurn(t);
      // find a throw that crosses the column low enough to feel it, then compare steam off and on
      const r = await t.page.evaluate(() => {
        const S = window.__FS.sim;
        for (let a = 10; a <= 70; a += 5) for (let p = 0.5; p <= 1; p += 0.05) {
          const out = [];
          for (const lift of [0, 980]) { S.b.steamLevel = lift; const pr = S.preview({ nut: 'acorn', angle: a, power: p }, { squirrels: false }); out.push({ x: pr.impact && pr.impact.x, steps: pr.steps, a, p }); }
          if (out[1].steps > out[0].steps + 4) return out;
        }
        return [{ steps: 0 }, { steps: 0 }];
      });
      t.expect(r[1].steps > r[0].steps, `steam keeps the nut up longer (${r[0].steps} -> ${r[1].steps} steps)`);
      await t.game('act', 'aim', { angle: r[0].a, power: r[0].p });
      await t.game('act', 'fire', { angle: r[0].a, power: r[0].p });
      await t.game('act', 'flyTo', 110);
      await t.game('act', 'clock', 2000);
      await t.shot('m1-steam', { wait: false });
      await t.game('act', 'clock', null);
    },
  },
  {
    name: 'no tunnelling through terrain or thin branches',
    node: true,
    async run(t) {
      const { Sim } = await import('../src/js/sim/battle.js');
      const { makeNut, stepNut, treeBoxes } = await import('../src/js/sim/flight.js');
      const { DT, VMAX } = await import('../src/js/sim/const.js');
      const all = levels();
      const sim = new Sim(all.gray, { seed: 3, human: [true, true] });
      let bad = 0, n = 0;
      for (let a = -20; a <= 80; a += 4) for (let p = 0.4; p <= 1; p += 0.1) {
        const pr = sim.preview({ nut: 'acorn', angle: a, power: p }, { squirrels: false });
        const im = pr.impact;
        if (!im || im.type !== 'terrain') continue;
        n++;
        if (im.y > sim.terrain.surfaceY(im.x) + 10) bad++;
      }
      t.expect(n > 20, 'enough terrain impacts sampled (' + n + ')');
      t.equal(bad, 0, 'no impact below the surface');
      // a full-speed nut fired flat at the thinnest branch must hit it
      const env = sim.env(), g = sim.geoms;
      let thin = null;
      g.forEach((gg, ti) => gg.segs.forEach((s) => { if (!thin || s.w < thin.s.w) thin = { s, ti }; }));
      const s = thin.s, mx = (s.x0 + s.x1) / 2, my = (s.y0 + s.y1) / 2;
      // straight down onto it from 300 above, at twice the top launch speed
      const nut = makeNut('acorn', mx, my - 300, -90, 1, VMAX * 1.9, 9, -1, 1);
      nut.gMul = 0; nut.windMul = 0;
      env.squirrels = []; env.wind = 0; env.boxes = treeBoxes(g);
      let ev = null;
      for (let i = 0; i < 200 && !ev; i++) { ev = stepNut(nut, env, DT); if (ev && ev.cont) ev = null; }
      t.expect(ev && (ev.type === 'wood' || ev.type === 'squirrel'), 'thin branch caught at 2x full speed (' + (ev && ev.type) + ')');
    },
  },
  {
    name: 'branch breaks and the squirrel drops',
    async run(t) {
      await myTurn(t);
      const info = await t.page.evaluate(() => {
        const S = window.__FS.sim, q = S.b.squirrels.find((s) => s.team === 1 && s.perch && s.perch.startsWith('B'));
        const [, tb, ] = q.perch.split(':'), ti = +q.perch.slice(1).split(':')[0], bi = +tb;
        const y0 = q.y, g0 = q.grip;
        S.b.phase = 'settle'; S.b.settle = 0;
        S.breakBranch(ti, bi);
        return { id: q.id, y0, g0 };
      });
      await t.game('act', 'clock', 400);
      await t.game('step', 30);
      await t.shot('m1-branch-break', { wait: false });
      await t.game('act', 'clock', null);
      await t.game('step', 400);
      const s = await t.state(), q = s.battle.squirrels.find((x) => x.id === info.id);
      t.expect(q.y > info.y0 + 20 || q.out, 'squirrel fell to a lower perch or out of the tree');
      t.expect(s.battle.branches.broken >= 1, 'branch marked broken');
    },
  },
  {
    name: 'scamper within stamina, never across the valley',
    async run(t) {
      await myTurn(t);
      const perches = await t.game('act', 'perches');
      const L = await t.game('act', 'level');
      t.expect(perches.length > 5, 'several perches in reach');
      t.expect(perches.every((p) => p.x < L.floorX), 'every reachable perch is on West Mountain');
      t.expect(perches.every((p) => p.cost <= 300), 'all within the stamina budget');
      await t.game('act', 'moveMode');
      await t.page.waitForFunction(() => window.__game.isIdle(), null, { timeout: 5000 });
      await t.shot('m1-scamper', { wait: false });
      // click the farthest perch that is on screen and clear of the HUD
      const vh = t.vp.height;
      const onScreen = [];
      for (const p of perches) { const sp = await t.game('act', 'perchScreen', p.id); if (sp[1] > 140 && sp[1] < vh - 230 && sp[0] > 20 && sp[0] < t.vp.width - 20) onScreen.push({ ...p, sp }); }
      const far = onScreen.reduce((a, b) => (b.cost > a.cost ? b : a));
      const [sx, sy] = far.sp;
      await t.page.mouse.click(sx, sy - 3);
      const s = await t.state();
      t.expect(s.battle.turn.stamina < 300 - far.cost + 1, 'stamina spent');
      const me = s.battle.squirrels.find((q) => q.id === s.battle.turn.sq);
      t.equal(me.perch, far.id, 'moved to the clicked perch');
    },
  },
  {
    name: 'grip, knockout and round end',
    async run(t) {
      await myTurn(t, { rounds: 1 });
      await t.page.evaluate(() => {
        const S = window.__FS.sim; S.b.shot = { team: 0, sq: 0, kind: 'acorn', dmg: 0, kos: 0, breaks: 0 };
        const foes = S.b.squirrels.filter((q) => q.team === 1);
        S.damage(foes[0], 100, { team: 0 });
      });
      await t.game('step', 1);
      await t.shot('m1-ko');
      let s = await t.state();
      t.expect(s.battle.squirrels.filter((q) => q.team === 1 && q.out).length === 1, 'one Tail out');
      t.expect(/is out/.test(s.lastSaid), 'knockout announced');
      await t.page.evaluate(() => {
        const S = window.__FS.sim;
        for (const q of S.b.squirrels.filter((x) => x.team === 1 && !x.out)) S.damage(q, 100, { team: 0 });
        S.b.phase = 'settle'; S.b.settle = 3;
      });
      await t.game('step', 2);
      await t.page.waitForFunction(() => window.__game.getState().screen === 'results', null, { timeout: 5000 });
      s = await t.state();
      t.equal(s.screen, 'results', 'results screen after the last knockout');
      const txt = await t.page.textContent('#screens');
      t.expect(/Field Notes/.test(txt) && /Source:/.test(txt), 'Field Notes fact with its source');
      await t.shot('m1-round-end');
    },
  },
  {
    name: 'AI battle completes in Node',
    node: true,
    async run(t) {
      const { Sim } = await import('../src/js/sim/battle.js');
      const { planTurn } = await import('../src/js/sim/ai.js');
      const sim = new Sim(levels()['story-01'], { seed: 11, human: [false, false] });
      let turns = 0;
      while (sim.b.phase !== 'battleEnd' && turns < 150) {
        if (sim.b.phase === 'roundEnd') { sim.continueBattle(); continue; }
        const p = planTurn(sim, 'easy');
        sim.throwNut(p); sim.settleNow(); turns++;
      }
      t.equal(sim.b.phase, 'battleEnd', 'battle ends (' + turns + ' turns)');
    },
  },
];

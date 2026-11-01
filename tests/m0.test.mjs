// M0: boot, battle render, flight, crater, determinism (DEV-PLAN test matrix AC1, AC2, AC3, AC6, AC9).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const tests = [
  {
    name: 'boots to title',
    async run(t) {
      const s = await t.state();
      t.equal(s.scene, 'title', 'title scene');
      t.equal(s.screen, 'title', 'title screen');
      const labels = await t.page.$$eval('#screens button', (b) => b.map((x) => x.textContent.trim()));
      for (const want of ['Story', 'Quick Battle', 'Practice Range', 'How to Play', 'Settings', 'Credits']) t.expect(labels.some((l) => l.includes(want)), 'title button ' + want);
      const txt = await t.page.textContent('#screens');
      t.expect(/made-up squirrel rivalry/i.test(txt), 'fiction label on the title');
      t.expect(/Hot Springs Games/.test(txt), 'brand on the title');
      await t.shot('m0-title');
      await t.checkLayout();
    },
  },
  {
    name: 'offline file:// boot',
    fileUrl: true,
    async run(t) {
      const s = await t.state();
      t.equal(s.scene, 'title', 'title over file://');
      await t.game('newGame', { levelId: 'gray', seed: 3 });
      await t.shot('m0-fileurl');
    },
  },
  {
    name: 'battle renders',
    async run(t) {
      await t.seed(7);
      const s = await t.game('newGame', { levelId: 'gray', seed: 7 });
      t.equal(s.scene, 'battle', 'battle scene');
      t.equal(s.battle.squirrels.length, 6, 'six squirrels');
      const { GRIP } = await import('../src/js/sim/const.js');
      t.expect(s.battle.squirrels.every((q) => q.grip === GRIP && !q.out), 'all at full grip');
      t.expect(s.render.backdrop.order.length >= 3, 'backdrop shows bathhouses');
      await t.shot('m0-battle');
    },
  },
  {
    name: 'flight and crater',
    async run(t) {
      await t.game('newGame', { levelId: 'gray', seed: 7 });
      const s0 = await t.state();
      // make it the human's turn on team 0
      if (s0.battle.turn.team !== 0) { await t.game('act', 'aiTurn'); await t.game('act', 'skipFlight'); }
      await t.game('act', 'setWind', 0);
      // a long, high throw toward the Tails: still climbing after 0.6 s
      await t.game('act', 'fire', { nut: 'acorn', angle: 72, power: 1 });
      await t.game('act', 'flyTo', 72);
      await t.game('act', 'clock', 1000);
      const mid = await t.state();
      t.equal(mid.battle.phase, 'flight', 'nut in flight');
      t.expect(mid.battle.nuts.length === 1, 'one nut flying');
      await t.shot('m0-flight', { wait: false });
      await t.game('act', 'clock', null);
      const s1 = await t.game('act', 'skipFlight');
      t.expect(s1.battle.turn.n >= 1, 'turn advanced');
      await t.shot('m0-crater');
    },
  },
  {
    name: 'crater mask and visuals agree',
    // vector terrain: under file:// a painted texture taints the canvas, and only this test reads pixels back
    url: 'index.html?art=0',
    async run(t) {
      await t.game('newGame', { levelId: 'gray', seed: 9 });
      const L = await t.game('act', 'level');
      const x = 300, y = await t.game('act', 'surfaceY', x);
      t.expect((await t.game('act', 'terrainAt', x, y + 6)) > 0, 'solid below the surface');
      t.expect((await t.game('act', 'visualAlpha', x, y + 6)) > 200, 'visual solid below the surface');
      // carve via the page sim directly (as an impact would)
      await t.page.evaluate(([x, y]) => { const s = window.__FS.sim; s.terrain.carve(x, y + 6, 20); s.b.craters.push({ x, y: y + 6, r: 20 }); s.afterTerrainChange(); }, [x, y]);
      await t.game('step', 1);
      t.equal(await t.game('act', 'terrainAt', x, y + 6), 0, 'mask cleared');
      t.expect((await t.game('act', 'visualAlpha', x, y + 6)) < 10, 'visual cleared');
      void L;
    },
  },
  {
    name: 'determinism: Node and browser agree',
    viewports: ['desktop'],
    async run(t) {
      const { Sim, hashBattle } = await import('../src/js/sim/battle.js');
      const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'levels/all.json'), 'utf8'));
      const shots = [{ nut: 'acorn', angle: 41, power: 0.83 }, { nut: 'walnut', angle: 55, power: 0.9 }, { nut: 'chinquapin', angle: 35, power: 0.95, tapAt: 120 }, { nut: 'hedgeapple', angle: 30, power: 0.7 }];
      const sim = new Sim(all.gray, { seed: 21, human: [true, true] });
      for (const sh of shots) { sim.throwNut(sh); sim.settleNow(); }
      const nodeHash = hashBattle(sim.b);
      const browserHash = await t.page.evaluate(async (shots) => {
        window.__game.newGame({ levelId: 'gray', seed: 21 });
        const S = window.__FS.sim; S.b.teams.forEach((tm) => { tm.human = true; });
        for (const sh of shots) { S.throwNut(sh); S.settleNow(); }
        return window.__game.act('hash');
      }, shots);
      // the browser battle was built with human:[true,false]; rebuild the Node one the same way to compare fairly
      const sim2 = new Sim(all.gray, { seed: 21, playerTeam: 0, human: [true, false], mode: 'quick', difficulty: 'medium' });
      sim2.b.teams.forEach((tm) => { tm.human = true; });
      for (const sh of shots) { sim2.throwNut(sh); sim2.settleNow(); }
      t.equal(browserHash, hashBattle(sim2.b), 'browser hash equals Node hash');
      t.log('node hash ' + nodeHash + ', browser ' + browserHash);
    },
  },
];

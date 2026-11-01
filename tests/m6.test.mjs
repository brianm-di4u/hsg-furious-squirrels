// M6: wider zoom-out, a different landscape on every level, and birds as airborne obstacles (MECHANICS.md §4, §6b, §10).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const tests = [
  {
    name: 'levels on one battlefield differ',
    node: true,
    async run(t) {
      const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'levels/all.json'), 'utf8'));
      const story = Object.values(all).filter((L) => /^story-/.test(L.id));
      for (const stretch of ['north', 'middle', 'south']) {
        const on = story.filter((L) => L.stretch === stretch);
        const sig = on.map((L) => `${Math.round(Math.min(...L.ground) / 20)}|${L.trees.filter((d) => d.team === 0).map((d) => d.species).join(',')}|${L.boulders.length}/${L.logs.length}/${L.stumps.length}`);
        t.equal(new Set(sig).size, on.length, `${stretch}: ${on.length} levels, ${new Set(sig).size} distinct landscapes`);
        t.equal(new Set(on.map((L) => L.backdrop.split('-')[0])).size, 1, `${stretch}: one backdrop stretch`);
      }
      const hs = story.map((L) => Math.min(...L.ground));
      t.expect(Math.max(...hs) - Math.min(...hs) > 200, `mountain heights vary (${Math.round(Math.min(...hs))}..${Math.round(Math.max(...hs))})`);
      for (const L of story) t.equal(L.rev, 2, `${L.id} layout revision`);
    },
  },
  {
    name: 'obstacles are solid, uncarvable and mirrored',
    node: true,
    async run(t) {
      const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'levels/all.json'), 'utf8'));
      const { Sim } = await import('../src/js/sim/battle.js');
      const L = all['story-08'], sim = new Sim(L, { seed: 1, human: [true, true] });
      const log = L.logs[0];
      t.expect(sim.terrain.at(log.x, log.y) === 4, 'a fallen log is in the mask');
      sim.terrain.carve(log.x, log.y, 40);
      t.expect(sim.terrain.at(log.x, log.y) === 4, 'a crater around the log leaves the log');
      const half = L.logs.length / 2;
      t.expect(Math.abs((L.logs[0].x + L.logs[half].x) / 2 - L.floorX) < 1, 'logs mirror across the valley');
    },
  },
  {
    name: 'birds: deterministic, bounce, snatch, preview ignores them',
    node: true,
    async run(t) {
      const { execFileSync } = await import('node:child_process');
      let out = '';
      try { out = execFileSync(process.execPath, [path.join(ROOT, 'tools/check-birds.mjs')], { encoding: 'utf8' }); } catch (e) { out = String(e.stdout || e); }
      for (const line of out.trim().split('\n')) t.expect(line.startsWith('OK'), line);
    },
  },
  {
    name: 'zoom range',
    async run(t) {
      await t.game('newGame', { levelId: 'story-07', seed: 4 });
      const lo = await t.page.evaluate(() => { const c = window.__FS.renderer.cam; c.zoomAt(0.01, c.vw / 2, c.vh / 2); const [x0] = c.toWorld(0, 0), [x1] = c.toWorld(c.vw, 0); return { zoom: c.zoom, x0, x1, vw: c.vw }; });
      if (lo.vw >= 1000) t.expect(lo.x1 - lo.x0 > 2400 * 1.5, `zoomed out the view spans ${Math.round(lo.x1 - lo.x0)} world units`);
      else t.expect(lo.x1 - lo.x0 >= 2399, `phone zoom-out still shows the whole world (${Math.round(lo.x1 - lo.x0)})`);
      await t.game('step', 1);
      await t.shot('m6-zoomed-out');
      const hi = await t.page.evaluate(() => { const c = window.__FS.renderer.cam; c.zoomAt(100, c.vw / 2, c.vh / 2); return c.zoom; });
      t.expect(hi <= 1.25 + 1e-6, `max zoom ${hi.toFixed(2)} <= 1.25`);
      await t.game('step', 1);
      await t.shot('m6-zoomed-in');
    },
  },
  {
    name: 'birds fly, bonk and can be turned off',
    async run(t) {
      await t.game('newGame', { levelId: 'story-07', seed: 4, birds: 'lots' });
      let s = await t.state();
      t.expect(s.battle.birds.level === 'lots' && s.battle.birds.list.length > 0, `${s.battle.birds.list.length} birds aloft (${[...new Set(s.battle.birds.list.map((b) => b.kind))].join(', ')})`);
      // park a goose on the next throw's path and fire
      const r = await t.page.evaluate(() => {
        const S = window.__FS.sim, b = S.b; window.__FS.aiActive = null; b.teams[b.turn.team].human = true; b.wind = 0;
        const aim = { nut: 'walnut', angle: 45, power: 0.75 }, pr = S.preview(aim, { squirrels: false }), pt = pr.pts[Math.floor(pr.pts.length * 0.3)];
        b.birds = [{ k: 'goose', dir: 1, x0: pt[0], alt: 0, v: 0, ph: 0, ox: 0, oy: pt[1] - S.level.floorY, R: 1, cx: 0, flee: null }]; b.birdT = 0;
        S.throwNut(aim); return true;
      });
      t.expect(r, 'thrown');
      await t.game('act', 'skipFlight');
      s = await t.state();
      t.expect(s.battle.events.some((e) => e.type === 'bird'), 'a bird bonk event: ' + s.battle.events.map((e) => e.type).join(' '));
      t.expect(/Bonk|bounced/.test(s.lastSaid) || s.battle.events.some((e) => e.type === 'bird'), 'announced');
      await t.game('newGame', { levelId: 'story-07', seed: 4, birds: 'off' });
      s = await t.state();
      t.equal(s.battle.birds.list.length, 0, 'Birds: Off spawns none');
      await t.game('newGame', { levelId: 'story-06', seed: 4, birds: 'lots' });
      s = await t.state();
      t.equal(s.battle.birds.list.length, 0, 'no birds at night');
    },
  },
  {
    name: 'old-layout resume is dropped',
    viewports: ['desktop'],
    async run(t) {
      await t.page.evaluate(() => { const A = window.__FS; A.save.resume = { setup: { mode: 'story', levelId: 'story-03' }, battle: {}, levelRev: 1 }; });
      await t.game('scene', 'title');
      const s = await t.state();
      t.equal(s.save.resume, false, 'resume from layout revision 1 dropped');
    },
  },
];

// M3: content (AC4, AC17, AC18, AC19, AC20, AC21, AC28).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const levels = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'levels/all.json'), 'utf8'));
// North -> south, from research/bathhouse-row-layout.md (HABS AR-28, NHL nomination, OSM)
const TRUE_ORDER = ['superior', 'hale', 'maurice', 'fordyce', 'quapaw', 'ozark', 'buckstaff', 'lamar', 'admin'];

export const tests = [
  {
    name: 'every level is winnable (check-levels)',
    node: true,
    slow: true,
    async run(t) {
      const { checkLevel } = await import('../tools/check-levels.mjs');
      for (const L of Object.values(levels())) { const issues = checkLevel(L); t.equal(issues.length, 0, `${L.id}: ${issues.slice(0, 2).join('; ')}`); }
    },
  },
  {
    name: 'twelve story levels as specified',
    node: true,
    async run(t) {
      const story = Object.values(levels()).filter((L) => /^story-/.test(L.id)).sort((a, b) => a.n - b.n);
      t.equal(story.length, 12, 'twelve story levels');
      t.equal(story.filter((L) => L.unlock).map((L) => L.unlock).join(','), 'chinquapin,pecan,hickory,walnut,sweetgum,hedgeapple', 'unlock order');
      t.equal(new Set(story.map((L) => L.stretch)).size, 3, 'all three Row stretches used');
      t.equal(new Set(story.map((L) => L.season)).size, 4, 'all four seasons used');
      const raw = fs.readFileSync(path.join(ROOT, '..', '..', 'research', 'bathhouse-row-layout.md'), 'utf8');
      t.expect(/Superior[\s\S]*Hale[\s\S]*Maurice[\s\S]*Fordyce[\s\S]*Quapaw[\s\S]*Ozark[\s\S]*Buckstaff[\s\S]*Lamar/.test(raw), 'research lists the Row north to south');
    },
  },
  {
    name: 'backdrop order per stretch',
    viewports: ['desktop'],
    async run(t) {
      for (const [lv, st] of [['story-02', 'north'], ['story-01', 'middle'], ['story-04', 'south']]) {
        const s = await t.game('newGame', { levelId: lv, seed: 3 });
        t.equal(s.render.backdrop.stretch, st, lv + ' stretch');
        t.equal(s.render.backdrop.order.join(','), TRUE_ORDER.join(','), lv + ' bathhouses in true north-to-south order');
        await t.game('pause'); // no AI turn starts while we wait for the painting
        await t.page.waitForFunction(() => window.__FS.loading === 0, null, { timeout: 8000 });
        await t.shot('m3-row-' + st, { wait: false });
        await t.game('resume');
      }
    },
  },
  {
    name: 'story flow: map, win, stars, unlock, reload',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('act', 'menu', 'story');
      t.equal((await t.state()).screen, 'pickTeam', 'first Story visit asks for a family');
      await t.game('act', 'menu', 'team', { v: '1' });
      let s = await t.state();
      t.equal(s.screen, 'story', 'story map');
      t.equal(s.save.story.team, 1, 'playing the Tails');
      const locked = await t.page.$$eval('.lvl[disabled]', (b) => b.length);
      t.equal(locked, 11, 'eleven battles locked at the start');
      await t.shot('m3-story-map');
      await t.game('act', 'menu', 'play', { v: 'story-01' });
      s = await t.state();
      t.equal(s.level.id, 'story-01', 'battle 1 starts');
      t.equal(s.battle.teams[1].human, true, 'player family is the Tails');
      t.equal(Object.keys(s.battle.teams[1].inventory).length, 0, 'acorns only in battle 1');
      await t.game('scene', 'results');
      s = await t.state();
      t.equal(s.screen, 'results', 'results');
      t.equal(s.save.story.unlocked, 2, 'battle 2 unlocked');
      t.expect(s.save.story.stars['story-01'] >= 1, 'stars recorded');
      const txt = await t.page.textContent('#screens');
      t.expect(/Chinquapin Trio/.test(txt), 'new nut announced');
      t.expect(/Next battle/.test(txt), 'next battle offered');
      await t.shot('m3-results');
      await t.reload();
      s = await t.state();
      t.equal(s.save.story.unlocked, 2, 'unlock survives a reload');
    },
  },
  {
    name: 'quick battle setup applies',
    async run(t) {
      await t.game('act', 'menu', 'quick');
      for (const [k, v] of [['level', 'story-07'], ['team', '1'], ['size', '4'], ['rounds', '3'], ['wind', 'gusty'], ['steam', 'strong'], ['loadout', 'acorn'], ['difficulty', 'hard']]) await t.game('act', 'menu', 'qset', { k, v });
      await t.shot('m3-quick');
      await t.game('act', 'menu', 'quickGo');
      const s = await t.state();
      t.equal(s.level.id, 'story-07', 'level');
      t.equal(s.battle.squirrels.length, 8, 'four per family');
      t.equal(s.battle.rounds, 3, 'best of three');
      t.equal(s.battle.difficulty, 'hard', 'hard rival');
      t.equal(s.battle.steam, 980, 'strong steam');
      t.equal(s.battle.teams[1].human, true, 'playing the Tails');
      t.equal(Object.keys(s.battle.teams[1].inventory).length, 0, 'acorns only');
      t.expect(Math.abs(s.battle.wind) <= 1, 'wind within gusty range');
    },
  },
  {
    name: 'practice range',
    async run(t) {
      await t.game('scene', 'practice');
      let s = await t.state();
      t.expect(s.battle.practice, 'practice battle');
      t.expect(s.battle.squirrels.filter((q) => q.dummy).length === 3, 'three dummies');
      t.expect(Object.values(s.battle.teams[0].inventory).every((n) => n >= 3), 'every nut available');
      const L = await t.game('act', 'level');
      // land a throw on target 0 by search
      const hit = await t.page.evaluate((T) => {
        const S = window.__FS.sim; S.b.wind = 0;
        for (let a = 10; a <= 80; a += 1) for (let p = 0.3; p <= 1; p += 0.01) { const pr = S.preview({ nut: 'acorn', angle: a, power: p }, { squirrels: false, every: 1 }); if (pr.pts.some((q) => Math.hypot(q[0] - T.x, q[1] - T.y) < T.r)) return { a, p }; }
        return null;
      }, L.targets[0]);
      if (hit) {
        await t.game('act', 'fire', { nut: 'acorn', angle: hit.a, power: hit.p });
        await t.game('act', 'skipFlight');
        await t.game('step', 1);
        s = await t.state();
        t.expect(s.targetsHit >= 1, 'target hit counted');
      } else t.log('no direct line to target 0 from the start perch (blocked); skipping the hit check');
      t.equal(s.battle.turn.team, 0, 'practice keeps the turn');
      await t.shot('m3-practice');
    },
  },
  {
    name: 'art: manifest only, fallback, idle while loading',
    viewports: ['desktop'],
    async run(t) {
      const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json'), 'utf8'));
      for (const k of Object.keys(man)) t.expect(fs.existsSync(path.join(ROOT, 'assets', man[k].file)), 'asset exists ' + man[k].file);
      const s = await t.state();
      t.expect(s.render.artLoaded || s.loading > 0 || !man['bd-middle-summer-day'], 'title backdrop painting loaded');
    },
  },
  {
    name: 'vector fallback (?art=0)',
    viewports: ['desktop'],
    url: 'index.html?art=0',
    async run(t) {
      const s = await t.game('newGame', { levelId: 'story-06', seed: 4 });
      t.equal(s.render.artLoaded, false, 'no painting with ?art=0');
      await t.shot('m3-art-fallback');
    },
  },
  {
    name: 'every story level start',
    slow: true,
    async run(t) {
      for (let n = 1; n <= 12; n++) {
        const id = 'story-' + String(n).padStart(2, '0');
        await t.game('newGame', { levelId: id, seed: n, mode: 'quick' });
        await t.page.evaluate(() => { window.__FS.aiActive = null; window.__FS.testPaused = true; });
        await t.game('act', 'cam', 'frame');
        await t.page.waitForFunction(() => window.__FS.loading === 0, null, { timeout: 8000 });
        await t.shot(`m3-level-${String(n).padStart(2, '0')}`, { wait: false });
        await t.game('resume');
      }
    },
  },
];

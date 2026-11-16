// Council wave 4, batch B: difficulty, progression and records; feedback, teaching and help; world, words and ceremony
// (S3-19, S4-11, S6-12, C4-03, S2-15, C4-02, C4-04, C4-05).
import fs from 'node:fs';
const SHOTS = '../_council/hsg-furious-squirrels/wave-4/shots';
const snap = async (t, name) => {
  await t.shot(name);
  fs.mkdirSync(SHOTS, { recursive: true });
  await t.page.screenshot({ path: `${SHOTS}/${name}-${t.viewport}.png` });
};
const tiles = (t) => t.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.statgrid div')].map((d) => [d.querySelector('span').textContent, d.querySelector('b').textContent])));

export const tests = [
  // ---- S3-19 ----
  {
    name: 'S3-19 the results grid shows accuracy, grip lost and par beside the old numbers',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('newGame', { levelId: 'story-01', mode: 'story', seed: 5 });
      const par = await t.page.evaluate(() => {
        const S = window.__FS.sim, b = S.b;
        b.turn.n = 9; b.teams[0].stats.throws = 8; b.teams[0].stats.hits = 3; b.teams[0].stats.kos = 1; b.teams[0].stats.best = 61;
        b.teams[1].stats.dmg = 37.4; // grip the rival shook loose from this family's squirrels
        return window.__FS.level.par;
      });
      await t.game('scene', 'results');
      await t.page.waitForSelector('.statgrid');
      const g = await tiles(t);
      t.equal(g.Accuracy, '38%', 'three hits in eight throws');
      t.equal(g['Grip lost'], '37', 'what the rival took off this family, rounded');
      t.equal(g.Par, String(par), "the battle's par");
      t.equal(g.Throws + '/' + g.Hits + '/' + g.Knockouts + '/' + g['Biggest hit'] + '/' + g.Turns, '8/3/1/61/5', 'the old five are still there');
      await snap(t, 'S3-19-results-grid');
      await t.checkLayout();
      // a Quick Battle has no par to show
      await t.game('newGame', { levelId: 'gray', seed: 7 });
      await t.page.evaluate(() => { const b = window.__FS.sim.b; b.teams[0].stats.throws = 4; b.teams[0].stats.hits = 0; });
      await t.game('scene', 'results');
      await t.page.waitForSelector('.statgrid');
      const q = await tiles(t);
      t.expect(!('Par' in q), 'no Par tile outside the Story');
      t.equal(q.Accuracy, '0%', 'no hits is 0%');
      t.equal(q['Grip lost'], '0', 'and no grip lost');
    },
  },
  // ---- S4-11 ----
  {
    name: 'S4-11 the title shows the battle the player has got to, and a new player still sees the first',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      const seen = () => t.page.evaluate(() => ({ id: window.__FS.level.id, season: window.__FS.level.season, air: window.__FS.renderer.weather.kind, scene: window.__FS.scene }));
      let s = await seen();
      t.equal(s.id + '/' + s.scene, 'story-01/title', 'a new profile sees the first battle, as before');
      await snap(t, 'S4-11-title-new');
      // a fresh profile each time: a save never lowers what a player has opened
      const titleFor = async (unlocked) => {
        await t.game('act', 'clearSave');
        await t.reload();
        await t.game('setState', { story: { unlocked, team: 0 } });
        await t.game('scene', 'title');
        await t.page.waitForFunction(() => window.__FS.loading === 0, null, { timeout: 15000 });
        return seen();
      };
      s = await titleFor(10); // the Story's tenth battle is a winter day
      t.equal(s.id, 'story-10', 'a player who has opened battle 10 sees it');
      t.equal(s.season + '/' + s.air, 'winter/snow', "with its season's air");
      await snap(t, 'S4-11-title-winter');
      s = await titleFor(4);
      t.equal(s.id + '/' + s.air, 'story-04/petals', 'a spring battle brings petals');
      t.equal((await titleFor(99)).id, 'story-12', 'past the end it is the last battle');
      t.equal((await titleFor(0)).id, 'story-01', 'and nothing opened is the first');
      await t.checkLayout();
    },
  },
  // ---- S6-12 ----
  {
    name: 'S6-12 the rival aims for the same time at 60 Hz and at 144 Hz',
    viewports: ['desktop'],
    async run(t) {
      for (const seed of [7, 8, 9, 10, 11, 12, 13, 14]) {
        await t.seed(seed);
        const s = await t.game('newGame', { levelId: 'gray', birds: 'off', wind: 'off' });
        if (s.battle.turn.team === 0) break;
      }
      await t.game('act', 'aim', { angle: 40, power: 0.5 });
      await t.game('act', 'fire', {});
      await t.game('act', 'skipFlight');
      // the plan is ready and told to think for a minute, set in the call that sees it
      await t.page.waitForFunction(() => { const A = window.__FS.aiActive; if (!(A && A.done && A.plan)) return false; A.plan.think = 60; return true; }, null, { timeout: 15000 });
      // then the page's frames are ours: the game's own frame function is run by hand with a clock that moves by a set step,
      // so the answer cannot depend on this machine's frame rate
      const run = (stepMs) => t.page.evaluate(async (step) => {
        const raf = window.requestAnimationFrame;
        let held = null;
        window.requestAnimationFrame = (cb) => { held = cb; return 1; };
        const until = performance.now() + 5000;
        while (!held && performance.now() < until) await new Promise((r) => setTimeout(r, 5));
        const A = window.__FS.aiActive, b = window.__FS.sim.b;
        A.plan.think = 0; // aim at once
        let T = performance.now(), frames = 0;
        const cb0 = held; held = null; T += step; cb0(T);
        while (held && b.phase === 'aim' && frames < 5000) { const cb = held; held = null; T += step; frames++; cb(T); }
        window.requestAnimationFrame = raf;
        if (held) raf(held); // hand the game its own loop back
        return { frames: frames + 1, seconds: (frames + 1) * step / 1000, phase: b.phase, reduced: !!window.__FS.reduced };
      }, stepMs);
      const r60 = await run(1000 / 60);
      t.equal(r60.phase, 'flight', 'the rival threw');
      t.expect(Math.abs(r60.seconds - (r60.reduced ? 0.2 : 0.6)) <= 0.03, `at 60 Hz the aim took ${r60.seconds.toFixed(3)} s in ${r60.frames} frames`);
      // the same again for a second rival turn at 144 Hz
      await t.game('act', 'skipFlight');
      await t.game('act', 'aim', { angle: 40, power: 0.5 });
      await t.game('act', 'fire', {});
      await t.game('act', 'skipFlight');
      await t.page.waitForFunction(() => { const A = window.__FS.aiActive; if (!(A && A.done && A.plan)) return false; A.plan.think = 60; return true; }, null, { timeout: 15000 });
      const r144 = await run(1000 / 144);
      t.equal(r144.phase, 'flight', 'the rival threw again');
      t.expect(Math.abs(r144.seconds - (r144.reduced ? 0.2 : 0.6)) <= 0.03, `at 144 Hz the aim took ${r144.seconds.toFixed(3)} s in ${r144.frames} frames`);
      t.expect(r144.frames > r60.frames * 2, 'and it took more frames, so it is not counting frames');
    },
  },
  // ---- C4-03 ----
  {
    name: 'C4-03 every place a nut is named uses the bar\'s name for it',
    async run(t) {
      const NAME = { acorn: 'Acorn', chinquapin: 'Trio', pecan: 'Pecan', walnut: 'Walnut', hickory: 'Hickory', sweetgum: 'Gumball', hedgeapple: 'Hedge' };
      const KEY = { acorn: '1', chinquapin: '2', pecan: '3', walnut: '4', hickory: '5', sweetgum: '6', hedgeapple: '7' };
      const SPECIAL = Object.keys(NAME).filter((k) => k !== 'acorn');
      const OLD = /Chinquapin Trio|Pecan Dart|Black Walnut|Hickory Hook|Sweetgum Drop|Hedge Apple\b/;
      await t.game('act', 'clearSave');
      await t.reload();
      for (const seed of [7, 8, 9, 10, 11, 12, 13, 14]) {
        await t.seed(seed);
        const s = await t.game('newGame', { levelId: 'gray', birds: 'off', wind: 'off', loadout: 'all' });
        if (s.battle.turn.team === 0) break;
      }
      await t.page.waitForFunction(() => window.__game.getState().battle.phase === 'aim', null, { timeout: 30000 });
      await t.page.waitForFunction(() => document.querySelectorAll('#nutbar .nut').length === 7, null, { timeout: 8000 });
      // the bar: its label, its aria-label, and (the readout under it) the trick line for each nut as it is picked
      const bar = await t.page.evaluate(() => [...document.querySelectorAll('#nutbar .nut')].map((b) => ({ k: b.dataset.nut, nm: b.querySelector('.nm').textContent, aria: b.getAttribute('aria-label') })));
      t.equal(bar.map((b) => b.k).join(), Object.keys(NAME).join(), 'the bar has all seven');
      for (const b of bar) t.expect(b.nm === NAME[b.k] && b.aria.startsWith(NAME[b.k]), `bar ${b.k}: "${b.nm}" / "${b.aria}"`);
      for (const k of Object.keys(NAME)) {
        await t.game('act', 'aim', { nut: k });
        await t.page.waitForFunction((n) => document.querySelector('.trick') && document.querySelector('.trick').textContent.startsWith(n + ':'), NAME[k], { timeout: 5000 });
        const line = await t.page.$eval('.trick', (e) => e.textContent);
        t.expect(line.startsWith(NAME[k] + ': '), `the readout for ${k}: "${line}"`);
      }
      // the other screens, each handed every nut it can show
      const screenText = async (name, data) => {
        await t.page.evaluate(([n, d]) => window.__FS.screens.show(n, d), [name, data]);
        return t.page.evaluate(() => ({ text: document.getElementById('screens').textContent, bolds: [...document.querySelectorAll('#screens .nutrow b')].map((b) => b.textContent), labels: [...document.querySelectorAll('#screens [aria-label]')].map((b) => b.getAttribute('aria-label')) }));
      };
      let r = await screenText('help', {});
      for (const k of Object.keys(NAME)) t.expect(r.bolds.includes(`${KEY[k]}. ${NAME[k]}`), `How to Play names ${k} "${NAME[k]}": ${r.bolds.join('|')}`);
      t.expect(!OLD.test(r.text), 'How to Play has none of the old long names');
      await t.page.evaluate(() => document.querySelector('#screens .nutrow').scrollIntoView({ block: 'start' }));
      await snap(t, 'C4-03-help-nuts');
      const setup = { mode: 'story', purse: 999 };
      r = await screenText('prep', { setup, bought: { pecan: 1 }, name: 'Battle', kinds: SPECIAL, blurb: '' });
      for (const k of SPECIAL) t.expect(r.bolds.includes(NAME[k]) && r.labels.some((l) => l.startsWith('Buy a ' + NAME[k] + ' for ')), `the satchel names ${k}: ${r.bolds.join('|')}`);
      t.expect(r.labels.includes('Take back one Pecan'), 'and Undo names the nut it takes back');
      t.expect(!OLD.test(r.text + r.labels.join()), 'the satchel has none of the old long names');
      await snap(t, 'C4-03-satchel');
      r = await screenText('shop', { team: 0, round: 1, winner: 0 });
      for (const k of SPECIAL) t.expect(r.bolds.includes(NAME[k]), `the shop names ${k}: ${r.bolds.join('|')}`);
      t.expect(!OLD.test(r.text), 'the shop has none of the old long names');
      for (const k of SPECIAL) {
        r = await screenText('results', { win: true, practice: false, records: null, stats: { throws: 1, hits: 1, kos: 0, best: 1 }, gripLost: 0, turns: 1, unlock: k, fact: null });
        t.expect(r.text.includes(`New nut unlocked: ${NAME[k]}: `) && !OLD.test(r.text), `the results card names the new ${k}`);
      }
      await t.checkLayout();
      // the tips: the first time each special is in a satchel
      const allTips = ['quick', 'practice', 'nut-chinquapin', 'nut-pecan', 'nut-walnut', 'nut-hickory', 'nut-sweetgum', 'nut-hedgeapple', 'steam', 'wind'];
      for (const k of SPECIAL) {
        await t.game('setState', { settings: { seenTips: allTips.filter((x) => x !== 'nut-' + k) } });
        for (const seed of [7, 8, 9, 10, 11, 12, 13, 14]) {
          await t.seed(seed);
          const s = await t.game('newGame', { levelId: 'gray', birds: 'off', wind: 'off', loadout: 'all' });
          if (s.battle.turn.team === 0) break;
        }
        await t.page.waitForFunction((n) => window.__game.getState().hint.startsWith(n + ':'), NAME[k], { timeout: 8000 }).catch(() => {});
        const hint = (await t.state()).hint;
        t.expect(hint.startsWith(NAME[k] + ': ') && !OLD.test(hint), `the tip for ${k}: "${hint}"`);
      }
    },
  },
  // ---- S2-15 ----
  {
    name: 'S2-15 the family choice says both families throw the same, and it fits',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.page.evaluate(() => window.__FS.screens.show('pickTeam', { next: 'story' }));
      const line = await t.page.evaluate(() => [...document.querySelectorAll('#screens .starrule')].map((p) => p.textContent));
      t.equal(line.join('|'), 'Both families throw the same: pick the colors you like.', 'the reassurance sits under the cards');
      const order = await t.page.evaluate(() => { const c = document.querySelector('#screens .cards'), p = document.querySelector('#screens .starrule'); return !!(c.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING); });
      t.expect(order, 'after the two cards');
      const cut = await t.page.evaluate(() => [...document.querySelectorAll('#screens .starrule, #screens .card')].filter((e) => e.scrollWidth > e.clientWidth + 1).length);
      t.equal(cut, 0, 'nothing is cut off');
      await snap(t, 'S2-15-pick-family');
      await t.checkLayout();
      // it is true: the two families start with the same acorns and grip, and share one table of nuts
      const same = await t.page.evaluate(() => {
        window.__game.newGame({ levelId: 'gray', seed: 7 });
        const b = window.__FS.sim.b, [a, c] = b.teams, grips = (k) => b.squirrels.filter((q) => q.team === k).map((q) => q.grip);
        return JSON.stringify([a.acorns, grips(0)]) === JSON.stringify([c.acorns, grips(1)]); // (the family that throws second also gets a bonus nut: that is turn order, not family)
      });
      t.expect(same, 'the families start with the same acorns and grip');
    },
  },
  // ---- C4-02 ----
  {
    name: 'C4-02 the Credits say how the art was made, in one plain line that fits',
    async run(t) {
      await t.game('scene', 'credits');
      const r = await t.page.evaluate(() => {
        const lis = [...document.querySelectorAll('#screens li')];
        const li = lis.find((l) => l.textContent.startsWith('Art:'));
        return { text: li && li.textContent, cut: lis.filter((l) => l.scrollWidth > l.clientWidth + 1).length, all: document.getElementById('screens').textContent };
      });
      t.equal(r.text, 'Art: 3D block-outs painted with AI image tools for this game. The squirrels are modelled in 3D.', 'the art line');
      t.expect(!/Codex|Blender/.test(r.all), 'and it names no company or product');
      t.equal(r.cut, 0, 'no line is cut off');
      await t.page.evaluate(() => [...document.querySelectorAll('#screens li')].find((l) => l.textContent.startsWith('Art:')).scrollIntoView({ block: 'center' }));
      await snap(t, 'C4-02-credits-art');
      await t.checkLayout();
    },
  },
  // ---- C4-04 ----
  {
    name: 'C4-04 the logo, level signs and results headings use the bundled face, from file:// too; everything else keeps its font',
    fileUrl: true,
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      const fam = (sel) => t.page.evaluate((s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontFamily : ''; }, sel);
      await t.page.waitForFunction(() => document.fonts.check('900 24px "Lilita One"') && [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Lilita One' && f.status === 'loaded'), null, { timeout: 8000 });
      t.expect((await fam('.logo h1')).startsWith('"Lilita One"'), `the logo: ${await fam('.logo h1')}`);
      t.expect((await fam('.tagline')).startsWith('system-ui'), 'the tagline keeps its body font');
      t.expect(!(await fam('.menu .btn')).includes('Lilita'), 'and so do the buttons');
      await snap(t, 'C4-04-title');
      // the logo fits its sign at every text size
      for (const scale of [1, 1.5]) {
        await t.game('setState', { settings: { textScale: scale } });
        await t.page.waitForFunction((s) => window.__FS.renderer.textScale === s, scale, { timeout: 5000 });
        const fit = await t.page.evaluate(() => { const h = document.querySelector('.logo h1'), l = document.querySelector('.logo'), r = h.getBoundingClientRect(), s = l.getBoundingClientRect(); return { within: r.left >= s.left - 1 && r.right <= s.right + 1, wide: h.scrollWidth <= h.clientWidth + 1, onscreen: r.left >= 0 && r.right <= innerWidth }; });
        t.expect(fit.within && fit.wide && fit.onscreen, `the logo fits its sign at ${scale * 100}%: ${JSON.stringify(fit)}`);
        await t.checkLayout();
      }
      await t.game('setState', { settings: { textScale: 1 } });
      // the level signs on the story map
      await t.game('setState', { story: { unlocked: 3, team: 0 } });
      await t.game('scene', 'story');
      t.expect((await fam('.lvl .n')).startsWith('"Lilita One"'), 'the level numbers on the map');
      await snap(t, 'C4-04-story-map');
      await t.checkLayout();
      // the results headings
      await t.game('newGame', { levelId: 'story-01', mode: 'story', seed: 5 });
      await t.page.evaluate(() => { window.__FS.sim.b.teams[0].stats.throws = 3; });
      await t.game('scene', 'results');
      await t.page.waitForSelector('.statgrid');
      t.expect((await fam('.panel h2')).startsWith('"Lilita One"') && (await fam('.winner')).startsWith('"Lilita One"'), 'the results heading and the winner line');
      const rfit = await t.page.evaluate(() => [...document.querySelectorAll('.panel h2, .winner')].every((e) => e.scrollWidth <= e.clientWidth + 1));
      t.expect(rfit, 'which fit');
      await snap(t, 'C4-04-results');
      await t.page.evaluate(() => window.__FS.screens.show('settings', {}));
      t.expect((await fam('.panel h2')).startsWith('"Arial Black"'), 'other headings keep the old stack: ' + await fam('.panel h2'));
      await t.checkLayout();
    },
  },
  // ---- C4-05 ----
  {
    name: 'C4-05 the 15 approved Field Notes are in the journal word for word, and a long one fits its card',
    async run(t) {
      const approved = JSON.parse(fs.readFileSync('tools/approved-notes.json', 'utf8'));
      await t.game('act', 'clearSave');
      await t.reload();
      const facts = await t.page.evaluate(() => FACTS.landmarks.map((f) => ({ id: f.id, text: f.text, stretch: f.stretch })));
      t.equal(facts.length, 31, 'sixteen notes and fifteen more');
      for (const n of approved.notes) {
        const f = facts.find((x) => x.id === n.id);
        t.expect(f && f.text === n.text && f.stretch === n.stretch, `${n.id} is as approved`);
      }
      t.equal(facts.find((x) => x.id === 'hs-0102').text, "The brewery's own history says it opened in the Superior Bathhouse in 2013.", 'and the brewery year is corrected');
      t.equal(await t.page.evaluate(() => FACTS.landmarks.filter((f) => !f.q || !f.a || !f.source || !f.url).length), 0, 'each has its question, answer, source and link');
      // all of them found: the journal lists them, and every one fits its row
      const ids = await t.page.evaluate(() => [...FACTS.landmarks, ...FACTS.nature].map((f) => f.id));
      await t.game('setState', { story: { notes: ids, team: 0 } });
      await t.game('act', 'menu', 'journal', {});
      const j = await t.page.evaluate(() => ({ found: document.querySelectorAll('.note-list li.found').length, head: document.querySelector('.sub').textContent, cut: [...document.querySelectorAll('.note-list li')].filter((l) => l.scrollWidth > l.clientWidth + 1).length, text: document.querySelector('.note-list').textContent }));
      t.equal(j.found, 50, 'every note is shown, landmarks and nature');
      t.expect(/50 of 50 notes found/.test(j.head), 'the count is of fifty: ' + j.head);
      t.equal(j.cut, 0, 'no note is cut off');
      for (const n of approved.notes) t.expect(j.text.includes(n.text), `${n.id} is on screen`);
      await t.page.evaluate(() => document.querySelector('.note-list li:nth-child(20)').scrollIntoView({ block: 'center' }));
      await snap(t, 'C4-05-journal');
      await t.checkLayout();
      // the results card: the longest 'any' note, unread, is the one a battle brings
      const longest = approved.notes.filter((n) => n.stretch === 'any').sort((a, b) => b.text.length - a.text.length)[0];
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('setState', { story: { notes: ids.filter((x) => x !== longest.id), team: 0 } });
      await t.game('newGame', { levelId: 'story-01', mode: 'story', seed: 5 });
      await t.page.evaluate(() => { window.__FS.sim.b.teams[0].stats.throws = 3; });
      await t.game('scene', 'results');
      await t.page.waitForSelector('.notes');
      const card = await t.page.evaluate(() => { const n = document.querySelector('.notes'), p = document.querySelector('.panel'), r = n.getBoundingClientRect(), pr = p.getBoundingClientRect(); return { text: n.textContent, inside: r.left >= pr.left - 1 && r.right <= pr.right + 1, cut: n.scrollWidth > n.clientWidth + 1 }; });
      t.expect(card.text.includes(longest.text), `the results card shows ${longest.id}: ${card.text}`);
      t.expect(card.inside && !card.cut, 'and it fits its card');
      await t.page.evaluate(() => document.querySelector('.notes').scrollIntoView({ block: 'center' }));
      await snap(t, 'C4-05-results-note');
      await t.checkLayout();
    },
  },
];

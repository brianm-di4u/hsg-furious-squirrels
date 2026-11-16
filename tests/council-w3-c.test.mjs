// Council wave 3, batch C: controls and play, difficulty and records, feedback and teaching
// (S1-03, S3-06, S1-17, S2-10, S3-13, P-N02, S2-04, S2-09, S2-01).
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
// a new Quick Battle in which the player throws first, keeping the save as it is
async function startHuman(t, opts = {}) {
  for (const seed of [7, 8, 9, 10, 11, 12, 13, 14]) {
    await t.seed(seed);
    const s = await t.game('newGame', { levelId: 'gray', birds: 'off', wind: 'off', ...opts });
    if (s.battle.turn.team === 0) return s;
  }
  throw new Error('no seed lets the player throw first');
}
// synthetic pointer events: the same handlers a mouse or a finger reaches, but the test controls every position
const pointer = (t, type, x, y, id = 7) => t.page.evaluate(([ty, px, py, pid]) => {
  document.getElementById('view').dispatchEvent(new PointerEvent(ty, { pointerId: pid, pointerType: 'touch', clientX: px, clientY: py, button: 0, bubbles: true }));
  return window.__FS.dragRing ? { ...window.__FS.dragRing } : null;
}, [type, x, y, id]);

export const tests = [
  // ---- S1-03 ----
  {
    name: 'S1-03 a short pull is a cancel: the ring is the size of the cancel zone and only a longer pull throws',
    async run(t) {
      await humanFirst(t);
      await t.waitFrames(4);
      const maxLen = await t.page.evaluate(() => Math.min(window.__FS.renderer.cam.vw, window.__FS.renderer.cam.vh) * 0.42);
      const x0 = Math.round(t.vp.width * 0.5), y0 = Math.round(t.vp.height * 0.55);
      const aim0 = (await t.state()).battle.teams[0].aim;
      // a pull of 12 percent of full power: it used to throw a feeble nut, and now it cancels
      const short = Math.round(maxLen * 0.12);
      t.expect(short > 12, `the short pull (${short} px) is past the 12 px dead zone, so the old rule would have thrown`);
      await pointer(t, 'pointerdown', x0, y0);
      let ring = await pointer(t, 'pointermove', x0 - short, y0 + 1);
      t.expect(ring && ring.inside, 'a 12 percent pull is inside the cancel zone');
      t.expect(Math.abs(ring.r - maxLen * 0.18) < 1.5, `the ring is the zone: ${ring.r.toFixed(1)} px for ${(maxLen * 0.18).toFixed(1)}`);
      await t.waitFrames(3);
      await snap(t, 'S1-03-cancel-ring');
      await pointer(t, 'pointerup', x0 - short, y0 + 1);
      let s = await t.state();
      t.equal(s.battle.teams[0].stats.throws, 0, 'a release there throws nothing');
      t.equal(s.battle.teams[0].aim.angle, aim0.angle, 'and the old aim comes back');
      // just over the line throws
      const long = Math.round(maxLen * 0.24);
      await pointer(t, 'pointerdown', x0, y0);
      ring = await pointer(t, 'pointermove', x0 - long, y0 + 1);
      t.expect(ring && !ring.inside, 'a 24 percent pull is outside the zone');
      await pointer(t, 'pointerup', x0 - long, y0 + 1);
      t.equal((await t.state()).battle.teams[0].stats.throws, 1, 'and a release there throws');
    },
  },
  {
    name: 'S1-03 "Release: Only aims" keeps the aim and waits for Throw!; it is saved and defaults to throwing',
    async run(t) {
      await humanFirst(t);
      await t.waitFrames(4);
      t.equal((await t.state()).settings.releaseThrows, true, 'a fresh profile throws on release, as it always did');
      await t.game('setState', { settings: { releaseThrows: false } });
      const maxLen = await t.page.evaluate(() => Math.min(window.__FS.renderer.cam.vw, window.__FS.renderer.cam.vh) * 0.42);
      const x0 = Math.round(t.vp.width * 0.5), y0 = Math.round(t.vp.height * 0.55);
      const aim0 = (await t.state()).battle.teams[0].aim;
      await pointer(t, 'pointerdown', x0, y0);
      await pointer(t, 'pointermove', x0 - Math.round(maxLen * 0.5), y0 + Math.round(maxLen * 0.2));
      await pointer(t, 'pointerup', x0 - Math.round(maxLen * 0.5), y0 + Math.round(maxLen * 0.2));
      let s = await t.state();
      t.equal(s.battle.teams[0].stats.throws, 0, 'a long pull no longer throws on release');
      t.expect(s.battle.teams[0].aim.angle !== aim0.angle || s.battle.teams[0].aim.power !== aim0.power, 'the aim it set is kept');
      t.equal(s.battle.phase, 'aim', 'and it is still the player\'s turn');
      const kept = s.battle.teams[0].aim;
      await pointer(t, 'pointerdown', x0, y0);
      await pointer(t, 'pointermove', x0 - 5, y0 + 1);
      await pointer(t, 'pointerup', x0 - 5, y0 + 1);
      t.equal((await t.state()).battle.teams[0].aim.angle, kept.angle, 'a stray tap does not undo the kept aim');
      await t.page.click('#b-throw');
      s = await t.state();
      t.equal(s.battle.teams[0].stats.throws, 1, 'the Throw! button sends it');
      await t.reload();
      t.equal((await t.state()).settings.releaseThrows, false, 'the choice survives a reload');
      await t.game('scene', 'settings');
      t.expect(/Release/.test(await t.page.textContent('#screens')), 'Settings has the row');
      await snap(t, 'S1-03-settings');
    },
  },
  // ---- S2-10 ----
  {
    name: 'S2-10 Settings has the Difficulty row, each tier says what it changes, and the Story map follows it',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('scene', 'settings');
      const text = () => t.page.evaluate(() => document.getElementById('screens').textContent);
      const body = await text();
      t.expect(/Difficulty/.test(body) && /By difficulty/.test(body) && !/By skill/.test(body), 'the row is there and the aim guide choice is named for it');
      t.expect(/Medium: a short aim guide, a steady rival./.test(body), 'Medium says what it changes');
      await t.page.click('#screens [data-k="difficulty"][data-v="hard"]');
      t.equal((await t.state()).settings.difficulty, 'hard', 'choosing Hard is saved as the Story difficulty');
      t.expect(/Hard: no aim guide, a rival that rarely misses./.test(await text()), 'and the line under the row follows');
      await t.page.click('#screens [data-k="aimGuide"][data-v="always"]');
      t.expect(/Hard: a rival that rarely misses. The aim guide follows your Settings./.test(await text()), 'with the guide set by hand, the line says so rather than promise none');
      await t.page.click('#screens [data-k="aimGuide"][data-v="auto"]');
      await snap(t, 'S2-10-settings-difficulty');
      await t.game('scene', 'story');
      const pressed = await t.page.evaluate(() => [...document.querySelectorAll('#screens [data-k="difficulty"]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.v));
      t.equal(pressed.join(), 'hard', 'the Story map shows the same choice');
      t.expect(/Hard: no aim guide/.test(await text()), 'and the same line');
      await t.game('scene', 'quick');
      t.expect(/Medium: a short aim guide/.test(await text()), 'Quick Battle explains its own Rival skill the same way');
    },
  },
  // ---- S2-09 ----
  {
    name: 'S2-09 Quick Battle setup: battlefields in a grid, Battle and Rules groups, and a new profile starts on Story unlocks',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      t.equal(await t.page.evaluate(() => window.__FS.save.quick.loadout), 'story', 'a new profile starts on the Story unlocks, not all seven nuts');
      await t.game('scene', 'quick');
      const lay = await t.page.evaluate(() => {
        const maps = [...document.querySelectorAll('#screens .qmap .lvl')], r = maps.map((b) => b.getBoundingClientRect());
        const heads = [...document.querySelectorAll('#screens h3')].map((h) => h.textContent);
        const wind = [...document.querySelectorAll('#screens .field label')].find((l) => l.textContent === 'Wind');
        const panel = document.querySelector('#screens .panel');
        return { n: maps.length, cols: new Set(r.map((x) => Math.round(x.left))).size, rows: new Set(r.map((x) => Math.round(x.top))).size, heads, windTop: wind.getBoundingClientRect().top - panel.getBoundingClientRect().top, h: panel.scrollHeight, text: document.getElementById('screens').textContent };
      });
      t.equal(lay.n, 12, 'all twelve battlefields are there');
      t.expect(lay.cols >= 3 && lay.rows <= 4, `in a grid of ${lay.cols} columns and ${lay.rows} rows`);
      t.equal(lay.heads.join(), 'Battle,Rules', 'under Battle and Rules');
      t.expect(/Story so far: 0 of 6/.test(lay.text), 'the Nuts choice says what Story unlocks means');
      if (t.viewport === 'mobile') t.expect(lay.windTop < 800, `the first rule is ${Math.round(lay.windTop)} px down the panel`);
      await snap(t, 'S2-09-quick-setup');
      await t.page.click('#screens .qmap [data-v="story-05"]');
      t.equal(await t.page.evaluate(() => window.__FS.save.quick.level), 'story-05', 'picking a battlefield saves it');
      t.equal(await t.page.evaluate(() => document.querySelector('#screens .qmap [data-v="story-05"]').getAttribute('aria-pressed')), 'true', 'and marks it');
      await t.page.click('#screens [data-k="loadout"][data-v="all"]');
      t.expect(/All seven nuts/.test(await t.page.textContent('#screens')), 'choosing All seven still works');
      // an old save keeps what it had
      await t.page.evaluate(() => localStorage.setItem('hsg-furious-squirrels-v1', JSON.stringify({ v: 1, settings: { sound: true, music: true, volume: 0.5, reducedMotion: null, aimGuide: 'auto', turnTimer: 0, textScale: 1, difficulty: 'medium', tutorial: true }, story: { team: 0, unlocked: 3, stars: { 'story-01': 1 }, nuts: [] }, quick: { level: 'story-02', team: 0, size: 3, rounds: 1, wind: 'normal', steam: 'on', birds: 'some', loadout: 'all', difficulty: 'medium' }, stats: { battles: 4, wins: 2, kos: 1, bestShot: 20 } })));
      await t.reload();
      t.equal(await t.page.evaluate(() => window.__FS.save.quick.loadout), 'all', 'a player whose save says All seven keeps it');
    },
  },
  // ---- S3-06 ----
  {
    name: 'S3-06 each special on the satchel row says what it is best for',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('setState', { story: { team: 0, unlocked: 9 } });
      await t.game('act', 'menu', 'play', { v: 'story-09' });
      t.equal((await t.state()).screen, 'prep', 'the satchel opens');
      const rows = await t.page.evaluate(() => [...document.querySelectorAll('#screens .nutrow.pack')].map((r) => ({ name: r.querySelector('b').textContent, best: (r.querySelector('.best') || {}).textContent || '', h: r.getBoundingClientRect().height })));
      t.equal(rows.length, 6, 'six specials are packed');
      for (const r of rows) t.expect(/^Best for: [^.]{12,60}\.$/.test(r.best), `${r.name}: "${r.best}"`);
      await snap(t, 'S3-06-satchel-best-for');
    },
  },
  // ---- S2-04 ----
  {
    name: 'S2-04 a loss says why the family lost, chooses its title by the margin, and gives one next step',
    async run(t) {
      const lose = async (prep) => {
        await humanFirst(t);
        await t.waitFrames(2);
        await t.page.evaluate(prep);
        await t.game('scene', 'results', { lose: true });
        await t.waitFrames(2);
        return t.page.evaluate(() => ({ h2: document.querySelector('#screens h2').textContent, cause: (document.querySelector('#screens .losscause') || {}).textContent || '', hint: (document.querySelector('#screens .losshint') || {}).textContent || '', btn: !!document.querySelector('#screens [data-act="guideLong"]') }));
      };
      // two rivals already out, nothing thrown: one left standing, no throws, so the plain wind hint and the near-miss title
      let r = await lose(() => { const q = window.__FS.sim.b.squirrels.filter((x) => x.team === 1); q[0].out = true; q[1].out = true; window.__FS.sim.b.teams[0].stats.throws = 3; window.__FS.sim.b.teams[0].stats.hits = 1; });
      t.equal(r.h2, 'So close!', 'one rival left and a hit landed: So close!');
      t.expect(/All 3 of your squirrels were knocked out of the trees. The Tails had 1 left standing./.test(r.cause), `the cause: ${r.cause}`);
      t.expect(/Wind bends every throw/.test(r.hint) && !r.btn, 'with hits landed the hint is about the wind');
      await snap(t, 'S2-04-loss-close');
      // three rivals left and not one hit: not close, and the aim guide is offered
      r = await lose(() => { window.__FS.sim.b.teams[0].stats.throws = 4; window.__FS.sim.b.teams[0].stats.hits = 0; });
      t.equal(r.h2, 'Not this time', 'three rivals left: Not this time');
      t.expect(/had 3 left standing/.test(r.cause), 'the rivals left are counted');
      t.expect(/None of your throws landed. The long aim guide shows the whole arc./.test(r.hint) && r.btn, 'no hits: the guide is offered with a button');
      await snap(t, 'S2-04-loss-no-hits');
      await t.page.click('#screens [data-act="guideLong"]');
      t.equal((await t.state()).settings.aimGuide, 'always', 'the button sets the guide');
      t.expect(/aim guide is now Always long/.test(await t.page.textContent('#screens .losshint')), 'and says so');
      t.equal(await t.page.evaluate(() => !!document.querySelector('#screens [data-act="guideLong"]')), false, 'the button is gone');
      // the guide already long: no button, a different hint
      r = await lose(() => { window.__FS.save.settings.aimGuide = 'always'; window.__FS.sim.b.teams[0].stats.throws = 2; window.__FS.sim.b.teams[0].stats.hits = 0; });
      t.expect(!r.btn && /Drag farther back for more power/.test(r.hint), 'with the guide on already, the hint turns to power and wind');
      // a win has none of it
      await humanFirst(t);
      await t.game('scene', 'results', {});
      t.equal(await t.page.evaluate(() => document.querySelectorAll('#screens .losscause, #screens .losshint').length), 0, 'a win shows no loss lines');
    },
  },
  // ---- P-N02 ----
  {
    name: 'P-N02 the finale is judged over every round: squirrels lost in an early round cost the star, and the card says so',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.seed(35594);
      await t.game('setState', { story: { team: 0, unlocked: 12 } });
      await t.game('act', 'menu', 'play', { v: 'story-12' });
      if ((await t.state()).screen === 'prep') await t.game('act', 'menu', 'prepGo');
      await t.page.waitForFunction(() => window.__FS.scene === 'battle' && !window.__FS.screens.cur, null, { timeout: 8000 });
      // round one goes to the rivals (all four of ours out), then two rounds won, with no turns taken
      await t.page.evaluate(() => {
        const sim = window.__FS.sim, me = sim.b.teams.findIndex((x) => x.human);
        sim.forceRound(1 - me); sim.drain(); sim.continueBattle();
        sim.forceRound(me); sim.drain(); sim.continueBattle();
      });
      await t.game('scene', 'results', {});
      await t.waitFrames(2);
      const r = await t.page.evaluate(() => ({ text: document.querySelector('#screens .starrule').textContent, stars: window.__FS.save.story.stars['story-12'], lost: window.__FS.sim.b.lost.slice(), played: window.__FS.sim.b.played, outsLastRound: window.__FS.sim.b.squirrels.filter((q) => q.team === 0 && q.out).length }));
      t.equal(r.played, 3, 'three rounds were played');
      t.equal(r.outsLastRound, 0, 'nobody was out in the last round, which is all the old rule looked at');
      t.equal(r.lost[0], 4, 'four squirrels were lost in all');
      t.equal(r.stars, 2, 'so the battle earns the win and the par, not the star for keeping the family');
      t.expect(/lose at most one squirrel in each round, and win within 42 turns over its 3 rounds/.test(r.text), `the card states the rule: ${r.text}`);
      await snap(t, 'P-N02-finale-stars');
      await t.game('act', 'menu', 'records');
      t.expect(/par 14 a round/.test(await t.page.textContent('#screens')), 'the Records screen says the par is a round');
    },
  },
  // ---- S2-01 ----
  {
    name: 'S2-01 a battle teaches one thing at a time: goal, each nut, steam, wind; each once, in twelve words or fewer',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      const start = (opts = {}) => startHuman(t, opts);
      const seq = [];
      for (let i = 0; i < 9; i++) {
        let s = await start();
        if (i === 8) { await t.game('act', 'setWind', 0.6); await t.page.evaluate(() => window.__FS.tips()); s = await t.state(); }
        seq.push({ hint: s.hint.replace(/Tap anywhere to close$/, '').trim(), seen: s.settings.seenTips.slice() });
        if (i === 0) await snap(t, 'S2-01-tip-quick');
        if (i === 1) await snap(t, 'S2-01-tip-nut');
        await t.page.keyboard.press('ArrowLeft');
      }
      const ids = seq.map((x) => x.seen[x.seen.length - 1]);
      t.equal(ids.join(), 'quick,nut-chinquapin,nut-pecan,nut-walnut,nut-hickory,nut-sweetgum,nut-hedgeapple,steam,wind', 'the goal first, then each nut as it is first in the satchel, then steam, then wind');
      for (const x of seq) t.expect(x.hint.length > 0 && x.hint.split(/s+/).length <= 12, `"${x.hint}" is ${x.hint.split(/s+/).length} words`);
      t.equal(new Set(seq.map((x) => x.hint)).size, 9, 'and no two say the same');
      t.expect(/Knock every rival out of the trees/.test(seq[0].hint), 'the first one is the goal');
      t.expect(/Pecan: .* in flight to dash/.test(seq[2].hint), 'a nut tip says when to tap');
      await t.reload();
      t.equal((await t.state()).settings.seenTips.length, 9, 'what was shown is saved');
      // a touch player who has played nothing is told one more thing (how to look around, S1-13): this player has finished a battle
      await t.page.evaluate(() => { window.__FS.save.stats.battles = 1; });
      await start();
      t.equal((await t.state()).hint, '', 'and nothing shows twice');
    },
  },
  {
    name: 'S2-01 Practice shows its goal once; the words follow the keyboard; Tutorial hints Off silences them; Show tips again brings them back',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('scene', 'practice');
      await t.waitFrames(2);
      let s = await t.state();
      t.expect(/^Hit every target./.test(s.hint), `Practice: ${s.hint}`);
      t.equal(s.settings.seenTips.join(), 'practice', 'it is marked seen');
      await t.page.keyboard.press('ArrowLeft');
      // keyboard words: with the last input a key, the goal tip names the arrows
      await t.game('setState', { settings: { seenTips: [] } });
      await startHuman(t);
      await t.page.evaluate(() => { window.__FS.inputKind = 'key'; window.__FS.hud.hint(''); window.__FS.save.settings.seenTips = []; });
      await t.game('act', 'setWind', 0);
      await t.page.evaluate(() => window.__FS.tips());
      s = await t.state();
      t.expect(/Arrows aim./.test(s.hint), `keyboard words: ${s.hint}`);
      // Tutorial hints Off: nothing shows
      await t.game('setState', { settings: { seenTips: [], tutorial: false } });
      await t.page.evaluate(() => { window.__FS.hud.hint(''); window.__FS.tips(); });
      t.equal((await t.state()).hint, '', 'with Tutorial hints off no tip shows');
      // Show tips again: on, and the list is empty
      await t.game('setState', { settings: { seenTips: ['quick', 'steam'] } });
      await t.game('scene', 'settings');
      await t.page.click('#screens [data-act="tipsAgain"]');
      s = await t.state();
      t.equal(s.settings.seenTips.length, 0, 'Show tips again empties the list');
      t.equal(s.settings.tutorial, true, 'and turns the hints back on');
      await snap(t, 'S2-01-settings-tips');
    },
  },
  {
    name: 'S2-01 a player with an existing save is not shown first-run tips, a fresh one is, and a damaged list is dropped',
    async run(t) {
      const old = { v: 1, settings: { sound: true, music: true, volume: 0.5, reducedMotion: null, aimGuide: 'auto', turnTimer: 0, textScale: 1, difficulty: 'medium', tutorial: true }, story: { team: 0, unlocked: 3, stars: { 'story-01': 2 }, nuts: [] }, quick: { level: 'story-02', team: 0, size: 3, rounds: 1, wind: 'normal', steam: 'on', birds: 'some', loadout: 'all', difficulty: 'medium' }, stats: { battles: 5, wins: 3, kos: 4, bestShot: 30 } };
      await t.page.evaluate((o) => localStorage.setItem('hsg-furious-squirrels-v1', JSON.stringify(o)), old);
      await t.reload();
      t.equal((await t.state()).settings.seenTips.length, 10, 'an old save counts every tip as seen');
      await t.game('newGame', { levelId: 'gray', birds: 'off', seed: 7 });
      t.equal((await t.state()).hint, '', 'so none shows');
      // a hand-edited list: unknown ids and non-strings go, the known ones stay
      const bad = { ...old, settings: { ...old.settings, seenTips: ['wind', 'nonsense', 7, 'wind', null, 'steam'] } };
      await t.page.evaluate((o) => localStorage.setItem('hsg-furious-squirrels-v1', JSON.stringify(o)), bad);
      await t.reload();
      t.equal((await t.state()).settings.seenTips.join(), 'wind,steam', 'a damaged list keeps only the real tips');
      await t.game('act', 'clearSave');
      await t.reload();
      t.equal((await t.state()).settings.seenTips.length, 0, 'a fresh profile has seen none');
    },
  },
  {
    name: 'S2-01 a tip is read out after the battle title in the same announcement, not over it',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await startHuman(t, { levelId: 'story-02' });
      const said = (await t.state()).lastSaid;
      t.expect(said.startsWith('Under the Tower'), `the title comes first: ${said}`);
      t.expect(/Knock every rival out of the trees/.test(said), 'and the tip follows it');
    },
  },
];

// Council wave 2, batch A: ambience and longer music (S5-01, S5-02).
const SAVE_KEY = 'hsg-furious-squirrels-v1';
const setHidden = (value) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
  document.dispatchEvent(new Event('visibilitychange'));
};
// counts every oscillator or noise source started, so a test can see whether anything is being scheduled
const countStarts = () => {
  window.__starts = 0;
  const proto = (window.AudioScheduledSourceNode || {}).prototype;
  if (!proto) return;
  const start = proto.start;
  proto.start = function patched(...a) { window.__starts++; return start.apply(this, a); };
};
const render = (t, name, secs, opts) => t.page.evaluate(([n, s, o]) => window.__game.audioRender(n, s, false, o), [name, secs, opts || {}]);
const gesture = async (t) => {
  await t.page.keyboard.press('Shift');
  await t.page.waitForFunction(() => window.__game.getState().audio.ctx === 'running', null, { timeout: 5000 });
};
const audio = async (t) => (await t.state()).audio;
const waitAudio = (t, fn, arg) => t.page.waitForFunction(fn, arg, { timeout: 15000 }); // generous: the audio clock runs slowly when the machine is busy

export const tests = [
  {
    name: 'S5-02 the game lists its music and ambience',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      for (const m of ['title', 'day', 'dusk', 'night', 'results', 'shop']) t.expect(list.music.includes(m), 'music: ' + m);
      t.expect(list.ambience.length >= 6, 'at least six ambience scenes: ' + list.ambience.join(', '));
    },
  },
  {
    name: 'S5-02 every piece of music is long, varied and inside the mix limits',
    viewports: ['desktop'],
    slow: false,
    async run(t) {
      const list = await t.game('audioList');
      for (const name of list.music) {
        const r = await render(t, name, 60);
        const b = r.built;
        t.log(`${name}: peak ${r.peak} rms ${r.rmsDb} dB silence ${r.longestSilence}s form ${b.formSeconds}s (${b.formBars} bars) distinct ${b.distinctBars} pitches ${b.pitches} stereo ${r.stereo}`);
        t.expect(r.peak >= 0.06 && r.peak <= 0.16, `${name} peak ${r.peak} within 0.06 to 0.16`);
        t.expect(r.rmsDb >= -40 && r.rmsDb <= -28, `${name} rms ${r.rmsDb} dBFS within -40 to -28`);
        t.expect(b.formSeconds >= 45, `${name} runs ${b.formSeconds} s before it repeats (45 s needed)`);
        t.expect(b.distinctBars >= 6, `${name} has ${b.distinctBars} distinct bars`);
        t.expect(b.pitches >= 6, `${name} uses ${b.pitches} pitches`);
        t.expect(r.longestSilence <= 2, `${name} has no silence over 2 s (${r.longestSilence})`);
      }
    },
  },
  {
    name: 'S5-02 tension raises the music without breaking the mix limits',
    viewports: ['desktop'],
    async run(t) {
      for (const name of ['day', 'dusk', 'night']) {
        const calm = await render(t, name, 60), tense = await render(t, name, 60, { intensity: 1 });
        t.log(`${name}: calm rms ${calm.rmsDb} peak ${calm.peak} ${calm.built.bars} bars; tense rms ${tense.rmsDb} peak ${tense.peak} ${tense.built.bars} bars`);
        t.expect(tense.rmsDb > calm.rmsDb, `${name} is louder when tense (${calm.rmsDb} to ${tense.rmsDb} dB)`);
        t.expect(tense.built.bars > calm.built.bars, `${name} is quicker when tense (${calm.built.bars} to ${tense.built.bars} bars in a minute)`);
        t.expect(tense.peak >= 0.06 && tense.peak <= 0.16 && tense.rmsDb >= -40 && tense.rmsDb <= -28, `${name} tense stays inside the limits (peak ${tense.peak}, ${tense.rmsDb} dB)`);
      }
    },
  },
  {
    name: 'S5-01 every ambience scene is quiet and never goes silent',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      let worst = 0, loudest = 0;
      for (const name of list.ambience) {
        const r = await render(t, name, 30);
        const gust = await render(t, name, 30, { wind: 1, steam: 1, birds: 1 });
        t.log(`${name}: peak ${r.peak} rms ${r.rmsDb} dB silence ${r.longestSilence}s; wind and steam full: peak ${gust.peak} rms ${gust.rmsDb} dB`);
        t.expect(r.peak < 0.07, `${name} peak ${r.peak} under 0.07`);
        t.expect(r.rmsDb >= -52 && r.rmsDb <= -38, `${name} rms ${r.rmsDb} dBFS within -52 to -38`);
        t.expect(r.longestSilence === 0, `${name} has no silent second`);
        t.expect(gust.peak < 0.07 && gust.rmsDb <= -38, `${name} with wind and steam at full: peak ${gust.peak}, ${gust.rmsDb} dB`);
        worst = Math.max(worst, gust.peak); loudest = Math.max(loudest, r.peak);
      }
      const music = Math.max(...(await Promise.all((await t.game('audioList')).music.map((n) => render(t, n, 30, { intensity: 1 })))).map((r) => r.peak));
      t.expect(music + worst + 0.45 < 0.95, `music ${music} + ambience ${worst} + the loudest cue 0.45 stays under 0.95`);
    },
  },
  {
    name: 'S5-01 wind and steam move the ambience',
    viewports: ['desktop'],
    async run(t) {
      const calm = await render(t, 'summerDay', 20, { wind: 0, steam: 0, birds: 0 });
      const windy = await render(t, 'summerDay', 20, { wind: 1, steam: 0, birds: 0 });
      const steamy = await render(t, 'summerDay', 20, { wind: 0, steam: 1, birds: 0 });
      t.log(`calm ${calm.rmsDb} dB, wind ${windy.rmsDb} dB, steam ${steamy.rmsDb} dB`);
      t.expect(windy.rms > calm.rms * 1.5, `full wind is clearly louder than none (${calm.rmsDb} to ${windy.rmsDb} dB)`);
      t.expect(steamy.rms > calm.rms * 1.1, `steam in earshot is louder than none (${calm.rmsDb} to ${steamy.rmsDb} dB)`);
    },
  },
  {
    name: 'S5-01 nothing is heard or scheduled before the first gesture',
    viewports: ['desktop'],
    initScript: countStarts,
    async run(t) {
      await t.waitFrames(10);
      const a = await audio(t);
      t.equal(a.ctx, 'none', 'no audio context before a gesture');
      t.expect(!a.started && !a.scheduler, 'no scheduler before a gesture');
      t.equal(await t.page.evaluate(() => window.__starts), 0, 'no source started before a gesture');
    },
  },
  {
    name: 'S5-01 battlefields pick their place and hour',
    viewports: ['desktop'],
    async run(t) {
      const cases = [['story-01', 'summerDay', 'day'], ['story-04', 'springBirds', 'day'], ['story-06', 'nightCrickets', 'night'], ['story-03', 'duskCrickets', 'dusk'], ['story-05', 'mistSteam', 'day'], ['story-07', 'fallLeaves', 'day'], ['story-10', 'winterQuiet', 'day'], ['story-11', 'winterNight', 'night']];
      for (const [id, scene, theme] of cases) {
        await t.game('newGame', { levelId: id, seed: 3 });
        const a = await audio(t);
        t.equal(a.scene, scene, `${id} plays the ${scene} ambience`);
        t.equal(a.theme, theme, `${id} plays the ${theme} music`);
      }
      await t.game('scene', 'title');
      const a = await audio(t);
      t.equal(a.theme, 'title', 'the title has its own music');
      t.equal(a.scene, 'summerDay', 'the title has the Row in summer');
    },
  },
  {
    name: 'S5-01 the wind, the steam and the birds drive the ambience',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { levelId: 'story-01', seed: 4, steam: 'strong', birds: 'lots' });
      await gesture(t);
      await t.game('act', 'setWind', 0.9);
      await waitAudio(t, () => window.__game.getState().audio.params.wind >= 0.85);
      let a = await audio(t);
      t.expect(a.params.wind >= 0.85 && a.params.wind <= 0.95, 'wind ambience follows the wind: ' + a.params.wind);
      await t.game('act', 'setWind', 0);
      await waitAudio(t, () => window.__game.getState().audio.params.wind === 0);
      t.equal((await audio(t)).params.wind, 0, 'no wind, no wind bed');
      t.equal((await audio(t)).params.birds, 1, 'lots of birds means a full dawn chorus');
      await t.game('act', 'cam', { x: 1034, y: 600, zoom: 0.5 });
      await waitAudio(t, () => window.__game.getState().audio.params.steam >= 0.5);
      const near = (await audio(t)).params.steam;
      await t.game('act', 'cam', { x: 200, y: 600, zoom: 1.2 });
      await waitAudio(t, (n) => window.__game.getState().audio.params.steam < n, near);
      const far = (await audio(t)).params.steam;
      t.expect(near > 0.5 && far < near * 0.5, `steam is louder near the steam (${near}) than far from it (${far})`);
      await t.game('newGame', { levelId: 'story-01', seed: 4, steam: 'off', birds: 'off' });
      await t.game('act', 'cam', { x: 1034, y: 600, zoom: 0.5 });
      await waitAudio(t, () => window.__game.getState().audio.params.birds < 0.5);
      t.equal((await audio(t)).params.steam, 0, 'steam off means no steam hiss');
    },
  },
  {
    name: 'S5-02 the music tightens when a family is down to one squirrel',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { levelId: 'story-01', seed: 5, size: 3 });
      await gesture(t);
      await t.waitFrames(15);
      t.expect(!(await audio(t)).tension, 'a full family is calm');
      await t.page.evaluate(() => { const b = window.__FS.sim.b; b.squirrels.filter((q) => q.team === 1).slice(0, 2).forEach((q) => { q.out = true; }); });
      await waitAudio(t, () => window.__game.getState().audio.tension === true);
      t.expect((await audio(t)).tension, 'one squirrel left raises the tension');
      await t.game('newGame', { levelId: 'story-01', seed: 5, size: 3 });
      await waitAudio(t, () => window.__game.getState().audio.tension === false);
      t.expect(!(await audio(t)).tension, 'a new battle starts calm');
      await t.game('setState', { settings: { turnTimer: 30 } });
      await t.page.waitForFunction(() => { const b = window.__game.getState().battle; return b.phase === 'aim' && b.teams[b.turn.team].human; }, null, { timeout: 30000 });
      await t.page.evaluate(() => { window.__FS.turnStart = performance.now() / 1000 - 25; });
      await waitAudio(t, () => window.__game.getState().audio.tension === true);
      t.expect((await audio(t)).tension, 'ten seconds left on the turn timer raises the tension');
      await t.game('setState', { settings: { turnTimer: 0 } });
    },
  },
  {
    name: 'S5-02 results and the shop have their own calm music',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { levelId: 'story-01', seed: 6, rounds: 3 });
      await t.game('scene', 'shop');
      await waitAudio(t, () => window.__game.getState().audio.theme === 'shop');
      t.equal((await audio(t)).theme, 'shop', 'the shop has its own music');
      await t.game('newGame', { levelId: 'story-01', seed: 6 });
      await t.game('scene', 'results');
      await waitAudio(t, () => window.__game.getState().audio.theme === 'results');
      t.equal((await audio(t)).theme, 'results', 'the results card has its own music');
      await t.game('act', 'menu', 'again');
      t.equal((await audio(t)).theme, 'day', 'a new battle goes back to the battle music');
    },
  },
  {
    name: 'S5-01 the Music and Ambience settings each silence their own bus and persist',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('scene', 'settings');
      const txt = await t.page.textContent('#screens');
      t.expect(/Ambience/.test(txt) && /Music/.test(txt) && /Sound/.test(txt), 'Settings has Sound, Music and Ambience');
      await t.shot('S5-01-settings');
      await gesture(t);
      await waitAudio(t, () => { const a = window.__game.getState().audio; return a.busMusic > 0.9 && a.busAmbience > 0.9; });
      let a = await audio(t);
      t.expect(a.busMusic > 0.9 && a.busAmbience > 0.9, `music and ambience are on by default (${a.busMusic}, ${a.busAmbience})`);
      await t.game('act', 'menu', 'set', { k: 'ambience', v: 'false' });
      await waitAudio(t, () => window.__game.getState().audio.busAmbience < 0.01);
      a = await audio(t);
      t.expect(a.busAmbience < 0.01 && a.busMusic > 0.9, 'Ambience off silences only the ambience bus');
      await t.game('act', 'menu', 'set', { k: 'ambience', v: 'true' });
      await t.game('act', 'menu', 'set', { k: 'music', v: 'false' });
      await waitAudio(t, () => window.__game.getState().audio.busMusic < 0.01);
      a = await audio(t);
      t.expect(a.busMusic < 0.01 && a.busAmbience > 0.9, 'Music off silences only the music bus');
      await t.game('act', 'menu', 'set', { k: 'ambience', v: 'false' });
      await t.reload();
      const s = (await t.state()).settings;
      t.equal(s.music, false, 'Music off survives a reload');
      t.equal(s.ambience, false, 'Ambience off survives a reload');
      await gesture(t);
      await t.waitFrames(5);
      a = await audio(t);
      t.expect(a.busMusic < 0.01 && a.busAmbience < 0.01, 'both stay silent after the reload');
      await t.game('act', 'menu', 'set', { k: 'music', v: 'true' });
      await t.game('act', 'menu', 'set', { k: 'ambience', v: 'true' });
      await t.game('act', 'menu', 'set', { k: 'sound', v: 'false' });
      a = await audio(t);
      t.equal(a.on, false, 'the master Sound switch is off');
      t.expect(a.music && a.ambience, 'music and ambience are on but obey the master switch');
      const master = await t.page.evaluate(() => window.__game.getState().settings.sound);
      t.equal(master, false, 'Sound off is saved');
      await t.game('act', 'menu', 'set', { k: 'sound', v: 'true' });
    },
  },
  {
    name: 'S5-01 a pre-wave save keeps its settings and gets quiet music and ambience',
    viewports: ['desktop'],
    async run(t) {
      const old = { v: 1, settings: { sound: false, music: true, volume: 0.25, reducedMotion: true, aimGuide: 'always', turnTimer: 30, textScale: 1.25, difficulty: 'hard', tutorial: false }, story: { team: 1, unlocked: 5, stars: { 'story-01': 3, 'story-02': 2 }, nuts: ['pecan'] }, quick: { level: 'story-03', team: 1, size: 4, rounds: 3, wind: 'gusty', steam: 'strong', birds: 'lots', loadout: 'story', difficulty: 'hard' }, stats: { battles: 9, wins: 5, kos: 12, bestShot: 7 }, resume: null };
      await t.page.evaluate(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(old)]);
      await t.reload();
      const st = await t.state();
      t.equal(st.settings.ambience, true, 'ambience defaults on for an old save');
      t.equal(st.settings.sound, false, 'an old save that had sound off stays silent');
      t.equal(st.settings.volume, 0.25, 'volume is kept');
      t.equal(st.settings.turnTimer, 30, 'other settings are kept');
      t.equal(st.save.story.unlocked, 5, 'story progress is kept');
      t.equal(st.save.story.stars['story-01'], 3, 'stars are kept');
      t.equal(st.save.stats.wins, 5, 'stats are kept');
      await gesture(t);
      t.equal((await audio(t)).on, false, 'sound off means the master is silent');
      // a damaged value falls back to the default instead of breaking the settings
      const bad = { ...old, settings: { ...old.settings, ambience: 'loud', music: 'yes' } };
      await t.page.evaluate(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(bad)]);
      await t.reload();
      t.equal((await t.state()).settings.ambience, true, 'a damaged ambience value falls back to on');
      await t.page.evaluate((k) => localStorage.removeItem(k), SAVE_KEY);
    },
  },
  {
    name: 'S5-01 music and ambience fade and stop scheduling on the pause card and in a hidden tab',
    viewports: ['desktop'],
    initScript: countStarts,
    async run(t) {
      await t.game('newGame', { levelId: 'story-01', seed: 8 });
      await gesture(t);
      await waitAudio(t, () => window.__game.getState().audio.busMusic > 0.9);
      const rate = async () => { const a = await t.page.evaluate(() => window.__starts); await t.page.waitForTimeout(4000); return (await t.page.evaluate(() => window.__starts)) - a; };
      t.expect((await rate()) > 3, 'music and ambience are scheduling while playing');
      await t.game('scene', 'pause');
      await waitAudio(t, () => { const a = window.__game.getState().audio; return a.held && a.busMusic < 0.02 && a.busAmbience < 0.02; });
      await t.page.waitForTimeout(600);
      t.equal(await rate(), 0, 'nothing is scheduled while the pause card is up');
      await t.game('act', 'menu', 'resume');
      await waitAudio(t, () => { const a = window.__game.getState().audio; return !a.held && a.busMusic > 0.9 && a.busAmbience > 0.9; });
      t.expect((await rate()) > 3, 'resuming brings both back');
      await t.page.evaluate(setHidden, true);
      await waitAudio(t, () => window.__game.getState().audio.ctx === 'suspended');
      const a = await audio(t);
      t.expect(a.held && !a.scheduler, 'a hidden tab holds the buses and stops the scheduler');
      await t.page.evaluate(setHidden, false);
      await waitAudio(t, () => { const x = window.__game.getState().audio; return x.ctx === 'running' && !x.held && x.scheduler; });
      t.expect((await rate()) > 3, 'a visible tab plays again without a pile-up (' + (await t.page.evaluate(() => window.__starts)) + ' sources so far)');
    },
  },
];

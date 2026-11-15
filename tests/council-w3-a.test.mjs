// Council wave 3, batch A: saves, lifecycle and robustness (S2-05, S2-18, S4-06, S5-08, S5-10, S5-11, S6-04, S6-15, S3-03, S4-17).
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const SAVE_KEY = 'hsg-furious-squirrels-v1';
const SHOTS = '../_council/hsg-furious-squirrels/wave-3/shots';

const saved = (t) => t.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);
const snap = async (t, name) => {
  await t.shot(name);
  fs.mkdirSync(SHOTS, { recursive: true });
  await t.page.screenshot({ path: `${SHOTS}/${name}-${t.viewport}.png` });
};
const screenText = (t) => t.page.textContent('#screens');
// a fresh profile, then a Story battle in which the player's family throws first (so the resume slot is written at once)
async function storyBattle(t, levelId = 'story-01', settings = {}, story = {}) {
  await t.game('act', 'clearSave');
  await t.reload();
  await t.game('setState', { settings, story });
  await t.game('act', 'menu', 'story');
  await t.game('act', 'menu', 'team', { v: '0' });
  await t.seed(35594);
  await t.game('act', 'menu', 'play', { v: levelId });
  if ((await t.state()).screen === 'prep') await t.game('act', 'menu', 'prepGo');
  await t.page.waitForFunction((k) => { try { return !!JSON.parse(localStorage.getItem(k)).resume.battle; } catch { return false; } }, SAVE_KEY, { timeout: 5000 });
}
const gesture = async (t) => {
  await t.page.keyboard.press('Shift');
  await t.page.waitForFunction(() => window.__game.getState().audio.ctx === 'running', null, { timeout: 5000 });
};
const audio = async (t) => (await t.state()).audio;
const waitAudio = (t, fn, arg) => t.page.waitForFunction(fn, arg, { timeout: 15000 }); // generous: the audio clock runs slowly when the machine is busy
const throwOnce = async (t) => { await t.game('act', 'fire', {}); await t.game('act', 'skipFlight'); };

export const tests = [
  // ---- S2-05 ----
  {
    name: 'S2-05 Restart and Quit ask first once a nut has been thrown, and Cancel goes back to the pause card',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('newGame', { levelId: 'gray' });
      await t.game('scene', 'pause');
      await t.game('act', 'menu', 'restart');
      let s = await t.state();
      t.equal(s.screen, null, 'before any throw, Restart goes straight ahead');
      t.equal(s.scene, 'battle', 'and the new battle is on');
      await throwOnce(t);
      await t.game('scene', 'pause');
      await t.game('act', 'menu', 'restart');
      s = await t.state();
      t.equal(s.screen, 'confirmLeave', 'after a throw, Restart asks first');
      t.expect(/Restart this battle\?/.test(await screenText(t)) && /progress in it will be lost/.test(await screenText(t)), 'the card says what is lost');
      t.equal(await t.page.evaluate(() => document.activeElement && document.activeElement.dataset.act), 'back', 'Cancel has the focus');
      await snap(t, 'S2-05-confirm-restart');
      await t.page.keyboard.press('Escape');
      s = await t.state();
      t.equal(s.screen, 'pause', 'Escape (Cancel) returns to the pause card');
      t.equal(s.battle.teams.reduce((n, x) => n + x.stats.throws, 0), 1, 'and the battle is untouched');
      await t.game('act', 'menu', 'menu');
      t.equal((await t.state()).screen, 'confirmLeave', 'Quit to menu asks as well');
      t.expect(/Leave this battle\?/.test(await screenText(t)), 'titled Leave this battle');
      await t.page.click('[data-act="back"]');
      t.equal((await t.state()).screen, 'pause', 'the Cancel button returns to pause');
      await t.game('act', 'menu', 'restart');
      await t.page.click('[data-act="leaveYes"]');
      s = await t.state();
      t.equal(s.screen, null, 'confirming Restart starts the battle again');
      t.equal(s.battle.teams.reduce((n, x) => n + x.stats.throws, 0), 0, 'with nothing thrown');
      await throwOnce(t);
      await t.game('scene', 'pause');
      await t.game('act', 'menu', 'menu');
      await t.page.click('[data-act="leaveYes"]');
      s = await t.state();
      t.equal(s.scene, 'title', 'confirming Leave goes to the title');
    },
  },
  {
    name: 'S2-05 quitting a Story battle keeps its resume slot, and Resume battle brings it back',
    async run(t) {
      await storyBattle(t);
      await throwOnce(t);
      await t.game('scene', 'pause');
      await t.game('act', 'menu', 'menu');
      t.expect(/Resume battle on the title/.test(await screenText(t)), 'the Story card says the battle stays saved');
      await snap(t, 'S2-05-confirm-leave-story');
      await t.page.click('[data-act="leaveYes"]');
      t.equal((await t.state()).scene, 'title', 'back on the title');
      t.expect((await saved(t)).resume && (await saved(t)).resume.battle, 'the resume slot is still in the save');
      t.equal(await t.page.locator('button[data-act="resumeBattle"]').count(), 1, 'the title offers Resume battle');
      await t.page.click('button[data-act="resumeBattle"]');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'battle', null, { timeout: 5000 });
      t.equal((await t.state()).setup.mode, 'story', 'it is the Story battle again');
    },
  },
  // ---- S2-18 ----
  {
    name: 'S2-18 Retry same wind replays the battle with the same seed, wind and first thrower',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('newGame', { levelId: 'gray', seed: 4242 });
      const a = await t.state();
      await t.game('scene', 'results', { lose: true });
      t.equal((await t.state()).screen, 'results', 'a lost battle shows the results card');
      t.equal(await t.page.locator('[data-act="again"][data-same="1"]').count(), 1, 'it offers Retry same wind');
      await snap(t, 'S2-18-retry-same-wind');
      await t.page.click('[data-act="again"][data-same="1"]');
      const b = await t.state();
      t.equal(b.scene, 'battle', 'the battle starts again');
      t.equal(b.setup.seed, 4242, 'with the same seed');
      t.equal(b.battle.wind, a.battle.wind, 'the same wind');
      t.equal(b.battle.turn.team, a.battle.turn.team, 'and the same family throws first');
      // a plain Play again takes a new random seed (a chance of 1 in 65536 of repeating 4242: far under one in ten thousand of a false failure)
      await t.game('scene', 'results', { lose: true });
      await t.page.click('[data-act="again"]:not([data-same])');
      t.expect((await t.state()).setup.seed !== 4242, 'Play again reshuffles');
      await t.game('scene', 'results', { lose: false });
      t.equal(await t.page.locator('[data-act="again"][data-same="1"]').count(), 0, 'a win does not offer it');
    },
  },
  {
    name: 'S2-18 three losses in a row on a Story battle offer Easy; a win clears the run',
    async run(t) {
      await storyBattle(t);
      const lose = async () => { await t.game('scene', 'results', { lose: true }); };
      await lose();
      t.equal((await saved(t)).story.losses['story-01'], 1, 'one loss is counted in the save');
      t.equal(await t.page.locator('[data-act="tryEasy"]').count(), 0, 'one loss offers nothing');
      await t.page.click('[data-act="again"]:not([data-same])');
      await lose();
      t.equal(await t.page.locator('[data-act="tryEasy"]').count(), 0, 'two losses offer nothing');
      await t.page.click('[data-act="again"]:not([data-same])');
      await lose();
      t.equal((await saved(t)).story.losses['story-01'], 3, 'three losses are counted');
      t.equal(await t.page.locator('[data-act="tryEasy"]').count(), 1, 'the third offers Try Easy');
      t.expect(/3 losses in a row/.test(await screenText(t)), 'and says why');
      await snap(t, 'S2-18-try-easy');
      await t.reload();
      t.equal((await saved(t)).story.losses['story-01'], 3, 'the run survives a reload');
      await storyBattle(t, 'story-01'); // clears the save: restart the run for the Easy check below
      for (let i = 0; i < 3; i++) { await lose(); if (i < 2) await t.page.click('[data-act="again"]:not([data-same])'); }
      await t.page.click('[data-act="tryEasy"]');
      let s = await t.state();
      t.equal(s.scene, 'battle', 'Try Easy starts the battle again');
      t.equal(s.setup.difficulty, 'easy', 'on Easy');
      t.equal((await saved(t)).settings.difficulty, 'easy', 'and the setting is saved');
      await lose();
      t.equal(await t.page.locator('[data-act="tryEasy"]').count(), 0, 'already on Easy: no offer');
      await t.page.click('[data-act="again"]:not([data-same])');
      await t.game('scene', 'results', { lose: false });
      t.expect(!('story-01' in (await saved(t)).story.losses), 'a win clears the run');
    },
  },
  // ---- S4-06 ----
  {
    name: 'S4-06 every battle has a Field Note of its own, and a note is not repeated while unread ones remain',
    node: true,
    async run(t) {
      const { LEVEL_FACTS } = await import(pathToFileURL(`${process.cwd()}/src/js/story.js`).href);
      const facts = JSON.parse(fs.readFileSync('data/facts.json', 'utf8')), ids = new Set([...facts.landmarks, ...facts.nature].map((f) => f.id));
      t.equal(LEVEL_FACTS.length, 12, 'one note per Story battle');
      t.expect(LEVEL_FACTS.every((id) => ids.has(id)), 'every id is a real fact in data/facts.json');
      t.equal(new Set(LEVEL_FACTS).size, 12, 'no two battles share one');
    },
  },
  {
    name: 'S4-06 the results card shows the battle\'s own note first, then notes not read yet, and saves what was read',
    async run(t) {
      await storyBattle(t, 'story-02', {}, { unlocked: 2 });
      const noteText = () => t.page.textContent('#screens .notes');
      await t.game('scene', 'results');
      const first = await noteText();
      t.expect(/216 feet|Hot Springs Mountain Tower/.test(first), 'Under the Tower shows the tower note');
      t.expect(((await saved(t)).story.notes || []).includes('hs-0094'), 'its id is saved as read');
      const seen = [first];
      for (let i = 0; i < 3; i++) {
        await t.page.click('[data-act="again"]:not([data-same])');
        if ((await t.state()).screen === 'prep') await t.game('act', 'menu', 'prepGo');
        await t.game('scene', 'results');
        seen.push(await noteText());
      }
      t.equal(new Set(seen).size, 4, 'four results, four different notes');
      t.equal(((await saved(t)).story.notes || []).length, 4, 'four ids saved');
      await t.reload();
      t.equal(((await saved(t)).story.notes || []).length, 4, 'and kept after a reload');
    },
  },
  // ---- S4-17 ----
  {
    name: 'S4-17 the Field Notes journal lists every note, found or not, and is reached from Records',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('act', 'menu', 'records');
      await t.page.click('[data-act="journal"]');
      let s = await t.state();
      t.equal(s.screen, 'journal', 'the Records screen opens the journal');
      t.expect(/0 of 35 notes found/.test(await screenText(t)), 'a new profile has found none of the 35');
      t.equal(await t.page.locator('.note-list li.locked').count(), 35, 'every note is listed, locked');
      t.equal(await t.page.locator('.postcard.locked').count(), 12, 'twelve postcard places, none earned');
      t.expect(/Not found yet\. Try a battle on the north end of the Row\./.test(await screenText(t)), 'a locked landmark says where to look');
      await snap(t, 'S4-17-journal-empty');
      await t.page.keyboard.press('Escape');
      t.equal((await t.state()).screen, 'records', 'Escape goes back to Records');
    },
  },
  {
    name: 'S4-17 found notes read in full and a three-star battle keeps a painted postcard',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('setState', { story: { team: 0, unlocked: 4, stars: { 'story-01': 3, 'story-03': 3, 'story-02': 2 }, notes: ['hs-0082', 'n-wind', 'hs-0094'] } });
      await t.game('act', 'menu', 'journal', {});
      t.expect(/3 of 35 notes found/.test(await screenText(t)), 'three notes found');
      t.equal(await t.page.locator('.note-list li.found').count(), 3, 'three are shown in full');
      t.expect(/Which Bathhouse Row bathhouse is crowned by a large tiled dome\?/.test(await t.page.textContent('.note-list li.found')), 'a note that begins with a pronoun leads with its question');
      t.expect(/Source: /.test(await t.page.textContent('.note-list li.found')), 'and names its source');
      t.expect(/Postcards: 2 of 12/.test(await screenText(t)), 'two postcards, for the two three-star battles');
      await t.page.waitForFunction(() => document.querySelectorAll('canvas[data-card][data-done="1"]').length === 2, null, { timeout: 8000 });
      const px = await t.page.$$eval('canvas[data-card]', (cs) => cs.map((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, seen = new Set(); for (let i = 0; i < d.length; i += 400) seen.add((d[i] >> 5) * 64 + (d[i + 1] >> 5) * 8 + (d[i + 2] >> 5)); return { w: c.width, h: c.height, colors: seen.size }; }));
      t.expect(px.every((p) => p.w === 300 && p.h === 200 && p.colors > 12), `both postcards are painted (${JSON.stringify(px)})`);
      await snap(t, 'S4-17-journal-found');
      await t.page.click('[data-act="journalBack"]');
      t.equal((await t.state()).screen, 'records', 'Back returns to Records');
      t.expect(await t.page.locator('[data-act="journal"]').count() === 1, 'and Records still offers the journal');
    },
  },
  // ---- S5-08 ----
  {
    name: 'S5-08 Settings has an Effects level and a Music level that drive their own buses and are saved',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      const s0 = (await t.state()).settings;
      t.expect(s0.sfxVol === 1 && s0.musicVol === 1, 'a new profile starts at the level the game always had');
      await t.game('scene', 'settings');
      const txt = await screenText(t);
      t.expect(/Effects level/.test(txt) && /Music level/.test(txt) && /Volume/.test(txt), 'Settings shows both new rows beside Volume');
      await snap(t, 'S5-08-settings');
      await gesture(t);
      await waitAudio(t, () => { const a = window.__game.getState().audio; return a.busMusic > 0.95 && a.busSfx > 0.85; });
      let a = await audio(t);
      t.expect(Math.abs(a.busSfx - 0.9) < 0.02, `effects bus is 0.9 by default (${a.busSfx})`);
      await t.page.click('[data-k="musicVol"][data-v="0.35"]');
      await waitAudio(t, () => { const a = window.__game.getState().audio; return Math.abs(a.busMusic - 0.35) < 0.02; });
      a = await audio(t);
      t.expect(a.busSfx > 0.85, 'a lower Music level leaves the effects alone');
      await t.page.click('[data-k="sfxVol"][data-v="0.65"]');
      await waitAudio(t, () => Math.abs(window.__game.getState().audio.busSfx - 0.585) < 0.02);
      a = await audio(t);
      t.expect(Math.abs(a.busMusic - 0.35) < 0.02, 'and a lower Effects level leaves the music alone');
      t.expect(a.on && a.music, 'the Sound and Music switches are untouched');
      await t.page.click('[data-k="sfxVol"][data-v="0"]');
      await waitAudio(t, () => window.__game.getState().audio.busSfx < 0.01);
      const played = (await audio(t)).played;
      await t.page.click('[data-k="musicVol"][data-v="0.65"]');
      t.equal((await audio(t)).played, played, 'Effects Off plays no cue, not even a menu tick');
      await waitAudio(t, () => window.__game.getState().audio.busMusic > 0.6);
      await t.page.click('[data-k="sfxVol"][data-v="1"]');
      await t.page.click('[data-k="musicVol"][data-v="0.35"]');
      await t.reload();
      const s1 = (await t.state()).settings;
      t.expect(s1.sfxVol === 1 && s1.musicVol === 0.35, 'both levels survive a reload');
      await gesture(t);
      await waitAudio(t, () => Math.abs(window.__game.getState().audio.busMusic - 0.35) < 0.02);
    },
  },
  {
    name: 'S5-08 a save from before the levels existed loads at full level, and damaged values fall back',
    viewports: ['desktop'],
    async run(t) {
      const old = { v: 1, settings: { sound: true, music: false, volume: 0.25, reducedMotion: true, aimGuide: 'always', turnTimer: 30, textScale: 1.25, difficulty: 'hard', tutorial: false }, story: { team: 1, unlocked: 5, stars: { 'story-01': 3 }, nuts: ['pecan'] }, quick: {}, stats: { battles: 9, wins: 5 }, resume: null };
      await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [SAVE_KEY, old]);
      await t.reload();
      let s = (await t.state()).settings;
      t.expect(s.sfxVol === 1 && s.musicVol === 1, 'missing levels default to the old, full level');
      t.expect(s.music === false && s.volume === 0.25 && s.turnTimer === 30, 'and nothing else in the old settings moved');
      old.settings.sfxVol = 7; old.settings.musicVol = 'loud';
      await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [SAVE_KEY, old]);
      await t.reload();
      s = (await t.state()).settings;
      t.expect(s.sfxVol === 1 && s.musicVol === 1, 'damaged levels fall back to full');
    },
  },
  {
    name: 'S5-08 the speaker button, the N key and a gamepad Select mute and unmute from inside a battle',
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('newGame', { levelId: 'gray' });
      await t.waitFrames(3);
      const btn = t.page.locator('#b-sound');
      t.equal(await btn.getAttribute('aria-pressed'), 'false', 'the HUD has a speaker button, sound on');
      t.expect(/Mute sound/.test(await btn.getAttribute('aria-label')), 'labelled for screen readers');
      const box = await btn.boundingBox();
      t.expect(box.width >= 40 && box.height >= 40, `a usable target (${Math.round(box.width)}x${Math.round(box.height)})`);
      const pause = await t.page.locator('#b-pause').boundingBox(), throwB = await t.page.locator('#b-throw').boundingBox();
      t.expect(box.x + box.width <= pause.x + 1 && pause.x + pause.width <= throwB.x + 1, 'it sits beside Pause, and nothing overlaps');
      await snap(t, 'S5-08-hud-speaker');
      await btn.click();
      t.equal((await t.state()).settings.sound, false, 'tapping it mutes');
      t.equal(await btn.getAttribute('aria-pressed'), 'true', 'and shows muted');
      t.expect((await saved(t)).settings.sound === false, 'the mute is saved');
      await snap(t, 'S5-08-hud-muted');
      await t.page.keyboard.press('n');
      t.equal((await t.state()).settings.sound, true, 'N turns it back on');
      await t.page.keyboard.press('n');
      t.equal((await t.state()).settings.sound, false, 'and off again');
      await btn.click();
      t.equal((await t.state()).settings.sound, true, 'the button turns it on');
      t.equal((await t.state()).scene, 'battle', 'the battle carried on');
      // a pad's Select button
      await t.page.evaluate(() => {
        window.__padBtn = false;
        const pad = { connected: true, index: 0, id: 'test pad', axes: [0, 0, 0, 0], get buttons() { return Array.from({ length: 17 }, (_, i) => ({ pressed: i === 8 && window.__padBtn, value: 0 })); } };
        navigator.getGamepads = () => [pad];
        window.dispatchEvent(new Event('gamepadconnected'));
      });
      await t.page.evaluate(() => { window.__padBtn = true; });
      await t.page.waitForFunction(() => window.__game.getState().settings.sound === false, null, { timeout: 5000 });
      await t.page.evaluate(() => { window.__padBtn = false; });
      await t.waitFrames(4);
      t.equal((await t.state()).settings.sound, false, 'Select mutes once per press');
    },
  },
  {
    name: 'S5-08 the five HUD buttons fit a phone in portrait and landscape',
    viewports: ['mobile'],
    async run(t) {
      for (const [w, h] of [[390, 844], [844, 390], [360, 640]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.game('newGame', { levelId: 'gray' });
        await t.waitFrames(3);
        const m = await t.page.evaluate(() => {
          const r = ['b-move', 'b-cam', 'b-sound', 'b-pause', 'b-throw'].map((id) => { const e = document.getElementById(id).getBoundingClientRect(); return { id, l: Math.round(e.left), r: Math.round(e.right), w: Math.round(e.width), h: Math.round(e.height) }; });
          return { r, vw: window.innerWidth };
        });
        t.expect(m.r.every((x) => x.l >= 0 && x.r <= m.vw), `${w}x${h}: every button is on screen ${JSON.stringify(m.r.map((x) => x.id + ':' + x.l + '-' + x.r))}`);
        const sorted = [...m.r].sort((p, q) => p.l - q.l);
        t.expect(sorted.every((x, i) => i === 0 || x.l >= sorted[i - 1].r - 1), `${w}x${h}: no two buttons overlap`);
        t.expect(m.r.every((x) => x.w >= 40 && x.h >= 40), `${w}x${h}: each is at least 40 px (${JSON.stringify(m.r.map((x) => x.w + 'x' + x.h))})`);
        fs.mkdirSync(SHOTS, { recursive: true });
        await t.page.screenshot({ path: `${SHOTS}/S5-08-hud-buttons-${w}x${h}.png` });
      }
      await t.page.setViewportSize({ width: 390, height: 844 });
    },
  },
  // ---- S5-11 ----
  ...['touchend', 'click'].map((ev) => ({
    name: `S5-11 a ${ev} alone unlocks the audio, and the context is asked to resume`,
    viewports: ['desktop'],
    initScript: () => {
      const Real = window.AudioContext;
      window.__ac = { made: 0, resumed: 0, last: null };
      window.AudioContext = class extends Real {
        constructor(...a) { super(...a); window.__ac.made++; window.__ac.last = this; }
        resume() { window.__ac.resumed++; return super.resume(); }
      };
    },
    async run(t) {
      t.equal(await t.page.evaluate(() => window.__ac.made), 0, 'nothing is made before a gesture');
      await t.page.evaluate((e) => window.dispatchEvent(new Event(e)), ev);
      await t.page.waitForFunction(() => window.__game.getState().audio.started, null, { timeout: 5000 });
      t.equal(await t.page.evaluate(() => window.__ac.made), 1, `${ev} creates the audio context`);
      t.expect(await t.page.evaluate(() => window.__ac.resumed) >= 1, 'and asks it to run as it is made');
      // the browser suspends it again (an iOS interruption): the next touch brings it back
      await t.page.evaluate(() => window.__ac.last.suspend());
      await t.page.waitForFunction(() => window.__ac.last.state === 'suspended', null, { timeout: 5000 });
      const before = await t.page.evaluate(() => window.__ac.resumed);
      await t.page.evaluate((e) => window.dispatchEvent(new Event(e)), ev);
      await t.page.waitForFunction(() => window.__ac.last.state === 'running', null, { timeout: 5000 });
      t.expect(await t.page.evaluate(() => window.__ac.resumed) > before, `a later ${ev} resumes a suspended context`);
      t.equal(await t.page.evaluate(() => window.__ac.made), 1, 'without making a second one');
    },
  })),
  {
    name: 'S5-11 a gamepad button press in a battle wakes the audio too',
    viewports: ['desktop'],
    initScript: () => {
      const Real = window.AudioContext;
      window.__ac = { made: 0 };
      window.AudioContext = class extends Real { constructor(...a) { super(...a); window.__ac.made++; } };
    },
    async run(t) {
      await t.game('newGame', { levelId: 'gray' });
      t.equal(await t.page.evaluate(() => window.__ac.made), 0, 'no context yet');
      await t.page.evaluate(() => {
        window.__padA = false;
        const pad = { connected: true, index: 0, id: 'test pad', axes: [0, 0, 0, 0], get buttons() { return Array.from({ length: 17 }, (_, i) => ({ pressed: i === 0 && window.__padA, value: 0 })); } };
        navigator.getGamepads = () => [pad];
        window.dispatchEvent(new Event('gamepadconnected'));
      });
      await t.page.evaluate(() => { window.__padA = true; });
      await t.page.waitForFunction(() => window.__ac.made === 1, null, { timeout: 5000 });
      t.expect((await t.state()).audio.started, 'a pad press starts the audio');
    },
  },
  // ---- S6-04 ----
  {
    name: 'S6-04 the turn timer stops on the pause card, behind a screen and in a hidden tab, and shows the seconds left',
    async run(t) {
      await storyBattle(t, 'story-01', { turnTimer: 30 });
      const my = () => t.page.evaluate(() => { const b = window.__game.getState().battle; return { n: b.turn.n, team: b.turn.team, phase: b.phase }; });
      // wait until the game's own clock has run this many seconds (the loop keeps ticking on the pause card), giving up after 20 s of wall time
      const waitClock = (secs) => t.page.evaluate(async (s) => { const t0 = window.__FS.time, w0 = performance.now(); await new Promise((res) => { const id = setInterval(() => { if (window.__FS.time - t0 >= s || performance.now() - w0 > 20000) { clearInterval(id); res(); } }, 50); }); return window.__FS.time - t0; }, secs);
      const first = await my();
      t.equal(first.team, 0, 'it is the player\'s turn');
      await t.page.waitForFunction(() => window.__FS.turnElapsed > 0.3, null, { timeout: 10000 });
      t.expect(/\d+ s$/.test(await t.page.textContent('#turnlabel')), `the turn label shows the seconds left (${await t.page.textContent('#turnlabel')})`);
      await snap(t, 'S6-04-turn-timer');
      await t.page.evaluate(() => { window.__FS.turnElapsed = 25; });
      await t.game('scene', 'pause');
      await waitClock(3);
      let e = await t.page.evaluate(() => window.__FS.turnElapsed);
      t.expect(e >= 25 && e < 25.5, `three seconds on the pause card cost nothing (${e.toFixed(2)})`);
      t.equal((await my()).n, first.n, 'the turn has not passed');
      await t.game('act', 'menu', 'settings');
      await waitClock(2);
      e = await t.page.evaluate(() => window.__FS.turnElapsed);
      t.expect(e < 25.5, `nor on the Settings screen opened from it (${e.toFixed(2)})`);
      await t.game('act', 'menu', 'back');
      await t.game('act', 'menu', 'resume');
      // a hidden tab: its frames are throttled away, so each frame is asked for by hand (the old wall-clock compare would have counted all of it)
      await t.page.evaluate(() => { window.__hid = true; Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hid }); });
      const e0 = await t.page.evaluate(() => window.__FS.turnElapsed);
      await t.page.evaluate(async () => { for (let i = 0; i < 100; i++) { window.__FS.kick(); await new Promise((r) => setTimeout(r, 20)); } });
      e = await t.page.evaluate(() => window.__FS.turnElapsed);
      t.expect(e - e0 < 0.3, `a hidden tab costs nothing (${(e - e0).toFixed(2)})`);
      await t.page.evaluate(() => { window.__hid = false; document.dispatchEvent(new Event('visibilitychange')); });
      // back in play the remaining five seconds run out and the turn passes
      await t.page.waitForFunction((n) => window.__game.getState().battle.turn.n !== n, first.n, { timeout: 20000 });
      t.expect(/Out of time/.test(await t.page.textContent('#call')), 'the player is told "Out of time!"');
      await t.page.waitForFunction(() => window.__FS.turnElapsed < 2, null, { timeout: 10000 }); // the clock starts again for the next turn
    },
  },
  {
    name: 'S6-04 with the turn timer off there is no countdown and no forfeited turn',
    viewports: ['desktop'],
    async run(t) {
      await storyBattle(t, 'story-01', { turnTimer: 0 });
      await t.page.waitForFunction(() => window.__FS.time > 1.5, null, { timeout: 10000 });
      t.expect(!/ s$/.test(await t.page.textContent('#turnlabel')), 'no seconds on the turn label');
      t.equal(await t.page.evaluate(() => window.__FS.turnElapsed), 0, 'and the clock does not run');
    },
  },
];

// Council wave 3, batch D: feedback, teaching and help, and sound
// (S2-02, S6-03, CL-01, S1-15, S5-06, S5-09, S5-12, S5-16, S5-18, S5-19).
import fs from 'node:fs';
const SHOTS = '../_council/hsg-furious-squirrels/wave-3/shots';

const snap = async (t, name) => {
  await t.shot(name);
  fs.mkdirSync(SHOTS, { recursive: true });
  await t.page.screenshot({ path: `${SHOTS}/${name}-${t.viewport}.png` });
};
// a new Quick Battle on the Gray battlefield, no birds, no wind, in which the player's family (team 0) throws first
async function startHuman(t, opts = {}) {
  for (const seed of [7, 8, 9, 10, 11, 12, 13, 14]) {
    await t.seed(seed);
    const s = await t.game('newGame', { levelId: 'gray', birds: 'off', wind: 'off', ...opts });
    if (s.battle.turn.team === 0) return s;
  }
  throw new Error('no seed lets the player throw first');
}
const MASTER = 0.7; // the master gain is the Volume setting times this (audio.js; 0.45 before S5-06)
const render = (t, name, secs, opts) => t.page.evaluate(([n, s, o]) => window.__game.audioRender(n, s, false, o), [name, secs, opts || {}]);
const gesture = async (t) => {
  await t.page.keyboard.press('Shift');
  await t.page.waitForFunction(() => window.__game.getState().audio.ctx === 'running', null, { timeout: 5000 });
};
// counts every oscillator or noise source started, so a test can see whether anything is being scheduled
const countStarts = () => {
  window.__starts = 0;
  const proto = (window.AudioScheduledSourceNode || {}).prototype;
  if (!proto) return;
  const start = proto.start;
  proto.start = function patched(...a) { window.__starts++; return start.apply(this, a); };
};
// a phone's vibration motor, as a list of the patterns asked for
const fakeVibrate = () => {
  window.__vib = [];
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p) => { window.__vib.push(p); return true; } });
};
// an aim, found with the game's own preview, that hits a rival squirrel
const hitAim = (t, nut = 'acorn') => t.page.evaluate((k) => {
  const sim = window.__FS.sim;
  for (let power = 0.5; power <= 1; power += 0.02) for (let angle = 20; angle <= 75; angle += 1) {
    const pr = sim.preview({ nut: k, angle, power }, {});
    if (pr && pr.impact && pr.impact.type === 'squirrel') return { nut: k, angle, power: Math.round(power * 100) / 100 };
  }
  return null;
}, nut);
const waitAudio = (t, fn, arg) => t.page.waitForFunction(fn, arg, { timeout: 15000 });
const humanAims = (t) => t.page.waitForFunction(() => { const s = window.__game.getState(); return s.battle && s.battle.turn.team === 0 && s.battle.phase === 'aim' && !s.aiActive; }, null, { timeout: 90000 });

export const tests = [
  // ---- S2-02 ----
  {
    name: 'S2-02 the last throw stays as faint dots for the next aim, and a throw that hit nothing says why',
    async run(t) {
      await startHuman(t);
      await t.game('act', 'aim', { angle: 45, power: 0.5 });
      await t.game('act', 'fire');
      await t.game('act', 'skipFlight');
      const L = await t.page.evaluate(() => ({ ...window.__FS.lastShot }));
      t.expect(L.pts.length >= 6, `the path was recorded (${L.pts.length} points)`);
      t.equal(L.said, 'Fell short', 'a weak throw into the dirt, no wind: fell short');
      t.equal(await t.page.evaluate(() => window.__FS.hud.el('call').textContent), 'Fell short', 'and the call is on the screen');
      await humanAims(t);
      await t.waitFrames(4);
      const trail = await t.page.evaluate(() => (window.__FS.shotTrail || []).length);
      t.equal(trail, L.pts.length, 'the same dots are drawn on the next aim turn');
      await snap(t, 'S2-02-last-shot');
      // the next throw replaces them
      await t.page.evaluate(() => { window.__old = window.__FS.lastShot; });
      await t.game('act', 'aim', { angle: 60, power: 0.5 });
      await t.game('act', 'fire');
      await t.page.waitForFunction(() => window.__FS.lastShot !== window.__old, null, { timeout: 20000 });
      t.expect(await t.page.evaluate(() => window.__FS.lastShot.pts.length < window.__old.pts.length), 'a new throw starts a new, shorter path');
    },
  },
  {
    name: 'S2-02 the call names the wind when the wind did it, and turning the Aim guide off hides the dots',
    viewports: ['desktop'],
    async run(t) {
      const fire = async (windAlong, power) => {
        await startHuman(t);
        const facing = await t.page.evaluate(() => window.__FS.sim.active().facing);
        await t.game('setState', { wind: windAlong * facing });
        await t.game('act', 'aim', { angle: 45, power });
        await t.game('act', 'fire');
        await t.game('act', 'skipFlight');
        return t.page.evaluate(() => window.__FS.lastShot.said);
      };
      t.equal(await fire(0.9, 0.3), 'Fell short', 'a following wind and a short throw: just short');
      t.equal(await fire(-0.9, 0.3), 'The wind held it back', 'a head wind and a short throw: the wind held it back');
      t.equal(await fire(0.9, 1), 'The wind pushed it long', 'a following wind and a long throw: the wind pushed it long');
      t.equal(await fire(-0.9, 1), 'Flew long', 'a head wind and a long throw: it was the throw');
      await t.game('setState', { settings: { aimGuide: 'off' } });
      await startHuman(t);
      await t.game('act', 'aim', { angle: 40, power: 0.3 }); await t.game('act', 'fire'); await t.game('act', 'skipFlight');
      await humanAims(t); await t.waitFrames(4);
      t.equal(await t.page.evaluate(() => window.__FS.shotTrail), null, 'with the Aim guide off there are no dots');
      await t.game('setState', { settings: { aimGuide: 'auto' } });
    },
  },

  // ---- CL-01 ----
  {
    name: 'CL-01 renders go through the master gain and limiter the player hears, and cues can be rendered',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      t.expect(Array.isArray(list.cues) && ['throw', 'thock', 'boing', 'burst', 'ko', 'win'].every((c) => list.cues.includes(c)), 'the list names the cues: ' + (list.cues || []).join(', '));
      const heard = await render(t, 'day', 30), raw = await render(t, 'day', 30, { raw: true }), full = await render(t, 'day', 30, { volume: 1 });
      // as heard is a fraction of the kit's own scale (the master gain is 0.225 at the shipped volume, and the limiter adds make-up gain), and full volume is twice the shipped one
      const frac = heard.peak / raw.peak;
      t.expect(frac > 0.5 * MASTER && frac < 1 * MASTER, `the default volume renders at ${frac.toFixed(3)} of the kit's own scale (the master gain is ${0.5 * MASTER})`);
      t.expect(Math.abs(full.peak / heard.peak - 2) < 0.06, `full volume is twice the default (${(full.peak / heard.peak).toFixed(2)})`);
      const a = await render(t, 'cue:ko', 2), b = await render(t, 'cue:ko', 2, { volume: 1 });
      t.expect(a.peak > 0.001 && Math.abs(b.peak / a.peak - 2) < 0.1, `a cue renders, and doubles with the volume (${a.peak} then ${b.peak})`);
      const five = await render(t, 'cue:thock', 6, { arg: 'pecan', repeats: 5 });
      t.expect(five.secs.slice(0, 5).every((x) => x > 0.0005) && five.built.repeats === 5, 'repeats strike once a second');
      const before = (await t.state()).audio.played;
      await render(t, 'cue:boing', 2);
      t.equal((await t.state()).audio.played, before, 'a render does not count as a played cue or touch the live audio');
      let err = '';
      try { await render(t, 'cue:nonsense', 2); } catch (e) { err = String(e.message || e); }
      t.expect(/unknown cue/.test(err), 'an unknown cue is refused');
    },
  },
  {
    name: 'CL-01 the busiest moment at the maximum volume stays under 0.95',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      let worst = 0;
      for (const piece of list.music) {
        const r = await render(t, 'mix', 12, { volume: 1, piece });
        t.log(`${piece} + the bed + six loud cues at maximum volume: peak ${r.peak}`);
        worst = Math.max(worst, r.peak);
      }
      t.expect(worst < 0.95, `the loudest mix peaks at ${worst}, under 0.95`);
      t.expect(worst > 0.01, 'and the mix is not silent');
    },
  },
  // ---- S1-15 ----
  {
    name: 'S1-15 a scamper ends Move mode so the next drag aims, and a drag that only pans says Move is on',
    async run(t) {
      await startHuman(t);
      await t.waitFrames(4);
      const move = async (type, x, y, id = 5) => t.page.evaluate(([ty, px, py, pid]) => { document.getElementById('view').dispatchEvent(new PointerEvent(ty, { pointerId: pid, pointerType: 'touch', clientX: px, clientY: py, button: 0, bubbles: true })); }, [type, x, y, id]);
      const call = () => t.page.evaluate(() => ({ text: window.__FS.hud.el('call').textContent, show: window.__FS.hud.el('call').classList.contains('show'), moveOn: window.__FS.showPerches, label: window.__FS.hud.el('b-move').querySelector('.lbl').textContent }));
      // Move on, then a drag that misses every perch: it pans, and says why
      await t.page.evaluate(() => window.__FS.onHud('move'));
      await t.waitFrames(3);
      t.equal((await call()).label, 'Done', 'Move is on and the button says Done');
      const cam0 = (await t.state()).camera;
      await move('pointerdown', 60, 300); await move('pointermove', 100, 300); await move('pointermove', 160, 310);
      let c = await call();
      t.equal(c.text, 'Move is on: tap Done to aim', 'a pan drag in Move mode is explained');
      t.expect((await t.state()).camera.x !== cam0.x, 'and it did pan');
      await move('pointerup', 160, 310);
      t.expect((await call()).moveOn, 'Move stays on until a scamper or Done');
      // a scamper: tap a reachable perch
      const spot = await t.page.evaluate(() => {
        const S = window.__game, p = S.act('perches').find((n) => n.cost > 0), cam = window.__FS.renderer.cam;
        const [x, y] = cam.toScreen(p.x, p.y); return { x, y, id: p.id };
      });
      await move('pointerdown', spot.x, spot.y); await move('pointerup', spot.x, spot.y);
      await t.waitFrames(3);
      c = await call();
      t.expect(!c.moveOn && c.label !== 'Done', 'a scamper ends Move mode, and the button is Move again');
      t.equal(c.text, 'Aim mode', 'and the game says Aim mode');
      // the very next drag aims
      const aim0 = { ...(await t.state()).battle.teams[0].aim };
      await move('pointerdown', 400, 400, 6); await move('pointermove', 330, 440, 6); await move('pointermove', 300, 470, 6);
      const aim1 = (await t.state()).battle.teams[0].aim;
      t.expect(aim1.angle !== aim0.angle || aim1.power !== aim0.power, `the next drag changed the aim (${aim0.angle} deg, ${aim0.power} to ${aim1.angle} deg, ${aim1.power})`);
      await move('pointercancel', 300, 470, 6);
      await t.waitFrames(3);
      await snap(t, 'S1-15-aim-mode');
    },
  },
  // ---- S5-06 ----
  {
    name: 'S5-06 the master gain is the new scale, and the typical cue now sits clearly above the music as heard',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await gesture(t);
      const a = (await t.state()).audio;
      t.expect(Math.abs(a.master - 0.5 * MASTER) < 0.005, `the live master gain is the Volume 0.5 times ${MASTER} (${a.master})`);
      const list = await t.game('audioList');
      const peaks = [];
      for (const c of list.cues) peaks.push((await render(t, 'cue:' + c, 2.5, { arg: c === 'thock' ? 'acorn' : undefined })).peak);
      peaks.sort((x, y) => x - y);
      const median = peaks[peaks.length >> 1], loudest = peaks[peaks.length - 1];
      const music = Math.max(...(await Promise.all(['title', 'day', 'night'].map((n) => render(t, n, 30, { intensity: 1 })))).map((r) => r.peak));
      t.log(`as heard at the default volume: median cue ${median}, loudest cue ${loudest}, loudest music peak ${music}`);
      t.expect(median >= 0.15 && median <= 0.45, `the typical cue peaks at ${median}, inside 0.15 to 0.45 (the range is 0.2 to 0.45, with one repeat's allowance)`);
      t.expect(median > music * 1.8, `the typical cue (${median}) is clearly above the music's peak (${music})`);
      t.expect(music >= 0.06 && music <= 0.16, `the music peaks at ${music} as heard, inside 0.06 to 0.16`);
      const bed = await render(t, 'summerDay', 20);
      t.expect(bed.peak < 0.07 && bed.rmsDb >= -52, `the bed stays under 0.07 and above -52 dB (peak ${bed.peak}, ${bed.rmsDb} dB)`);
      // at the maximum volume the loudest cue, struck twenty times, stays under the clip
      const hot = await render(t, 'cue:burst', 22, { volume: 1, repeats: 20 });
      t.expect(hot.peak < 0.95, `the loudest cue repeated twenty times at maximum volume peaks at ${hot.peak}`);
    },
  },
  {
    name: 'S5-06 the music ducks under a burst and a knockout, then comes back',
    viewports: ['desktop'],
    async run(t) {
      await startHuman(t);
      await gesture(t);
      await t.page.waitForFunction(() => window.__game.getState().audio.busMusic > 0.95, null, { timeout: 15000 });
      await t.game('setState', { inventory: { walnut: 3 } });
      await t.game('act', 'aim', { nut: 'walnut', angle: 45, power: 0.5 });
      await t.page.evaluate(() => { window.__low = 1; window.__sampler = setInterval(() => { window.__low = Math.min(window.__low, window.__game.getState().audio.busMusic); }, 20); });
      await t.game('act', 'fire');
      await t.game('act', 'skipFlight');
      await t.page.waitForFunction(() => window.__low < 0.85, null, { timeout: 8000 });
      await t.page.waitForFunction(() => window.__game.getState().audio.busMusic > 0.95, null, { timeout: 15000 });
      t.expect(true, 'a walnut burst ducked the music and it came back');
      await t.page.evaluate(() => clearInterval(window.__sampler));
    },
  },
  // ---- S5-09 ----
  {
    name: 'S5-09 switched-off music, ambience and sound stop their sources and the scheduler, and come back when switched on',
    viewports: ['desktop'],
    initScript: countStarts,
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await gesture(t);
      // sources keep starting while the music or the bed plays: wait for the count to rise, however slowly the clock runs
      const rises = async () => { const a = await t.page.evaluate(() => window.__starts); await t.page.waitForFunction((n) => window.__starts > n + 3, a, { timeout: 40000 }); return true; };
      // and none start while everything is off: a quiet stretch can only show that nothing starts, so a slow clock cannot fail it
      const rate = async (ms) => { const a = await t.page.evaluate(() => window.__starts); await t.page.waitForTimeout(ms); return (await t.page.evaluate(() => window.__starts)) - a; };
      const set = (settings) => t.game('setState', { settings });
      const audioNow = () => t.page.evaluate(() => window.__game.getState().audio);
      await waitAudio(t, () => { const a = window.__game.getState().audio; return a.scheduler && a.musicPlaying && a.ambiencePlaying; });
      t.expect(await rises(), 'music and ambience schedule while they are on');
      await set({ music: false });
      await waitAudio(t, () => !window.__game.getState().audio.musicPlaying);
      let a = await audioNow();
      t.expect(a.ambiencePlaying && a.scheduler, 'Music off stops the score and leaves the bed and the scheduler running');
      await set({ ambience: false });
      await waitAudio(t, () => !window.__game.getState().audio.scheduler);
      a = await audioNow();
      t.expect(!a.musicPlaying && !a.ambiencePlaying && !a.scheduler, 'Music and Ambience both off: no score, no bed, no scheduler');
      t.equal(await rate(2500), 0, 'and no source is started');
      await set({ music: true, ambience: true });
      await waitAudio(t, () => { const x = window.__game.getState().audio; return x.scheduler && x.musicPlaying && x.ambiencePlaying; });
      t.expect(await rises(), 'turned back on they play again');
      await set({ sound: false });
      await waitAudio(t, () => { const x = window.__game.getState().audio; return !x.scheduler && !x.musicPlaying && !x.ambiencePlaying; });
      t.equal(await rate(2500), 0, 'Sound off starts no source either');
      await set({ sound: true });
      await waitAudio(t, () => { const x = window.__game.getState().audio; return x.scheduler && x.musicPlaying && x.ambiencePlaying && x.busMusic > 0.9; });
      t.expect(await rises(), 'Sound on again brings the music and the bed back');
      t.equal((await audioNow()).theme, 'title', 'and it is still the title theme');
    },
  },
  // ---- S5-12 ----
  {
    name: 'S5-12 a throw, a hit and a walnut burst buzz the phone, and Vibration Off or reduced motion keep it still',
    viewports: ['mobile'],
    initScript: fakeVibrate,
    async run(t) {
      const shoot = async (settings, nut) => {
        await t.game('act', 'clearSave');
        await t.reload();
        await t.game('setState', { settings });
        await startHuman(t);
        await t.page.keyboard.press('Shift'); // a touch or key: the browser allows vibration only after one
        const aim = nut === 'walnut' ? { nut, angle: 45, power: 0.5 } : await hitAim(t);
        if (!aim) throw new Error('no aim hits a rival here');
        await t.game('setState', { inventory: { walnut: 2 } });
        await t.page.evaluate(() => { window.__vib.length = 0; });
        await t.game('act', 'aim', aim);
        await t.game('act', 'fire');
        await t.game('act', 'skipFlight');
        return t.page.evaluate(() => window.__vib.map((p) => JSON.stringify(p)));
      };
      let v = await shoot({}, 'acorn');
      t.expect(v.includes('10') && v.includes('18'), `a throw and a hit buzz (${v.join(" ")})`);
      v = await shoot({}, 'walnut');
      t.expect(v.includes('10') && v.includes('[20,30,40]'), `a walnut burst buzzes the long pattern (${v.join(" ")})`);
      v = await shoot({ vibration: false }, 'acorn');
      t.equal(v.length, 0, 'Vibration Off: nothing');
      v = await shoot({ reducedMotion: true }, 'acorn');
      t.equal(v.length, 0, 'reduced motion: nothing');
    },
  },
  {
    name: 'S5-12 Settings has a Vibration switch that is saved, where the device can vibrate',
    initScript: fakeVibrate,
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      t.equal((await t.state()).settings.vibration, true, 'a new profile has Vibration on');
      await t.game('scene', 'settings');
      t.expect(/Vibration/.test(await t.page.textContent('#screens')), 'Settings shows the row');
      await t.page.click('[data-k="vibration"][data-v="false"]');
      t.equal((await t.state()).settings.vibration, false, 'Off is saved');
      await t.page.locator('[data-k="vibration"][data-v="false"]').scrollIntoViewIfNeeded();
      await snap(t, 'S5-12-settings-vibration');
      await t.reload();
      t.equal((await t.state()).settings.vibration, false, 'and survives a reload');
      await t.game('setState', { settings: { vibration: true } });
    },
  },
  // ---- S5-16 ----
  {
    name: 'S5-16 the music goes dull for a hit-stop and for slow motion, and opens again',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await startHuman(t);
      await gesture(t);
      await waitAudio(t, () => window.__game.getState().audio.cutoff > 5000);
      // slow motion: the knockout sets App.slowT; the music is held at about 800 Hz while it runs
      await t.page.evaluate(() => { window.__FS.slowT = 1.5; });
      await waitAudio(t, () => window.__game.getState().audio.cutoff < 2000);
      t.expect((await t.state()).audio.muffled, 'slow motion dulls the music');
      await t.page.evaluate(() => { window.__FS.slowT = 0; });
      await waitAudio(t, () => window.__game.getState().audio.cutoff > 5000);
      t.expect(!(await t.state()).audio.muffled, 'and it opens when slow motion ends');
      // a hit freezes the sim for a moment: the dulling is counted, however short it is
      const before = (await t.state()).audio.muffles;
      const aim = await hitAim(t);
      await t.game('act', 'aim', aim);
      await t.game('act', 'fire');
      await t.game('act', 'skipFlight');
      await waitAudio(t, (n) => window.__game.getState().audio.muffles > n, before);
      await waitAudio(t, () => window.__game.getState().audio.cutoff > 5000);
      t.expect(true, 'a hit dulled the music for its hit-stop and let go');
    },
  },
  {
    name: 'S5-16 with reduced motion a hit does not dull the music (there is no hit-stop)',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.game('setState', { settings: { reducedMotion: true } });
      await startHuman(t);
      await gesture(t);
      const before = (await t.state()).audio.muffles;
      await t.game('act', 'aim', await hitAim(t));
      await t.game('act', 'fire');
      await t.game('act', 'skipFlight');
      await t.waitFrames(30);
      t.equal((await t.state()).audio.muffles, before, 'no dulling');
    },
  },
  // ---- S5-18 ----
  {
    name: 'S5-18 each nut plucks its own note when chosen, and Move mode has a rising and a falling click',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await startHuman(t);
      await gesture(t);
      await t.waitFrames(3);
      for (const k of ['pecan', 'walnut']) {
        await t.page.click(`#nutbar .nut[data-nut="${k}"]`);
        t.equal((await t.state()).audio.last, `pick:${k}`, `choosing the ${k} plays its own cue`);
      }
      await t.page.click('#b-move');
      t.equal((await t.state()).audio.last, 'move:true', 'opening Move has its own click');
      await t.page.click('#b-move');
      t.equal((await t.state()).audio.last, 'move:false', 'and so does closing it');
      // the pitch is the nut's own: count zero crossings in the first 60 ms of a rendered pluck
      const pitch = async (nut) => {
        const w = await t.page.evaluate((n) => window.__game.audioRender('cue:pick', 1, true, { arg: n, raw: true }).then((r) => r.wav), nut);
        const b = Buffer.from(w, 'base64'), rate = 22050, from = Math.round(0.5 * rate), n = Math.round(0.06 * rate);
        let z = 0, prev = 0;
        for (let i = from; i < from + n; i++) { const v = b.readInt16LE(44 + i * 4); if (prev < 0 && v >= 0) z++; prev = v; }
        return z / 0.06; // Hz, near enough
      };
      const low = await pitch('walnut'), high = await pitch('chinquapin');
      t.expect(high > low * 1.8, `a chinquapin (${Math.round(high)} Hz) plucks well above a walnut (${Math.round(low)} Hz)`);
    },
  },
  // ---- S5-19 ----
  {
    name: 'S5-19 a won Story battle plays the stars and the unlock after the win, a loss and a Quick Battle play neither',
    viewports: ['desktop'],
    async run(t) {
      const results = async (mode, opts, over) => {
        await t.game('act', 'clearSave');
        await t.reload();
        await t.seed(7);
        await t.game('newGame', { mode, levelId: mode === 'story' ? 'story-01' : 'gray', team: 0, birds: 'off', wind: 'off', ...opts });
        await gesture(t);
        await t.game('scene', 'results', over);
        return (await t.state()).audio.recent;
      };
      let r = await results('story', {}, {});
      const at = (n) => r.findIndex((x) => x === n || x.startsWith(n + ':'));
      t.expect(at('win') >= 0 && at('stars') > at('win') && at('unlock') > at('stars'), `win, then stars, then the unlock sparkle (${r.join(" ")})`);
      const stars = +r[at('stars')].split(':')[1];
      t.expect(stars >= 1 && stars <= 3, `one note a star, ${stars} earned`);
      r = await results('story', {}, { lose: true });
      t.expect(at('lose') >= 0 && at('stars') < 0 && at('unlock') < 0, `a loss plays no star and no unlock (${r.join(" ")})`);
      r = await results('quick', {}, {});
      t.expect(at('win') >= 0 && at('stars') < 0, `a Quick Battle win has no stars to play (${r.join(" ")})`);
    },
  },
  {
    name: 'S5-19 a won round plays its own stinger as the shop opens',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'clearSave');
      await t.reload();
      await t.seed(7);
      await t.game('newGame', { mode: 'quick', levelId: 'gray', team: 0, rounds: 3, birds: 'off', wind: 'off' });
      await gesture(t);
      const b = (await t.state()).battle;
      t.expect(b.rounds > 1, `the battle has more than one round (${b.rounds})`);
      await t.page.evaluate(() => { const sim = window.__FS.sim, me = sim.b.teams.findIndex((x) => x.human); sim.forceRound(me); });
      await t.page.waitForFunction(() => window.__game.getState().screen === 'shop', null, { timeout: 15000 });
      const r = (await t.state()).audio.recent;
      t.expect(r.includes('roundWin'), `the round stinger played (${r.join(" ")})`);
      // the cues themselves render
      for (const c of ['stars', 'unlock', 'roundWin']) {
        const x = await t.page.evaluate((n) => window.__game.audioRender('cue:' + n, 3, false, { arg: 3 }), c);
        t.expect(x.peak > 0.01, `${c} renders (peak ${x.peak})`);
      }
    },
  },
  {
    name: 'S5-06 no cue clips at maximum volume, struck twenty times running',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      let worst = 0, name = '';
      for (const c of list.cues) {
        const r = await render(t, 'cue:' + c, 11.5, { volume: 1, repeats: 20, gap: 0.5, arg: c === 'stars' ? 3 : c === 'thock' ? 'acorn' : undefined });
        if (r.peak > worst) { worst = r.peak; name = c; }
      }
      t.log(`loudest at maximum volume over twenty repeats: ${name} ${worst}`);
      t.expect(worst < 0.95, `every cue stays under 0.95 at maximum volume (worst ${name} ${worst})`);
    },
  },
];

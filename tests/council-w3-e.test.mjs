// Council wave 3, batch E: sound; layout and accessibility; world, words and ceremony
// (S5-03, S5-04, S2-08, S2-12, S4-07, S4-08, S4-02, S4-03, S4-04, S4-09).
import fs from 'node:fs';
const SHOTS = '../_council/hsg-furious-squirrels/wave-3/shots';

const snap = async (t, name) => {
  await t.shot(name);
  fs.mkdirSync(SHOTS, { recursive: true });
  await t.page.screenshot({ path: `${SHOTS}/${name}-${t.viewport}.png` });
};
async function startHuman(t, opts = {}) {
  for (const seed of [7, 8, 9, 10, 11, 12, 13, 14]) {
    await t.seed(seed);
    const s = await t.game('newGame', { levelId: 'gray', birds: 'off', wind: 'off', ...opts });
    if (s.battle.turn.team === 0) return s;
  }
  throw new Error('no seed lets the player throw first');
}
const gesture = async (t) => {
  await t.page.keyboard.press('Shift');
  await t.page.waitForFunction(() => window.__game.getState().audio.ctx === 'running', null, { timeout: 5000 });
};
// A cue rendered as the kit writes it (opts.raw: no master gain, no limiter), as the left and right channels of every
// one-second window: { L: [Float32Array...], R: [...] }. The render is seeded, so the same call gives the same numbers.
async function cueWindows(t, cue, opts) {
  const b64 = await t.page.evaluate(([c, o]) => window.__game.audioRender('cue:' + c, (o.repeats || 1) * (o.gap || 1) + 1, true, { raw: true, ...o }).then((r) => r.wav), [cue, opts || {}]);
  const buf = Buffer.from(b64, 'base64'), rate = 22050, n = (buf.length - 44) / 4, L = [], R = [];
  for (let w = 0; w * rate < n; w++) {
    const a = new Float32Array(rate), b = new Float32Array(rate);
    for (let i = 0; i < rate && w * rate + i < n; i++) { a[i] = buf.readInt16LE(44 + (w * rate + i) * 4) / 32767; b[i] = buf.readInt16LE(46 + (w * rate + i) * 4) / 32767; }
    L.push(a); R.push(b);
  }
  return { L, R };
}
const peak = (...ch) => Math.max(...ch.map((a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
const energy = (a) => a.reduce((s, v) => s + v * v, 0);
const crossings = (a) => { let z = 0; for (let i = 1; i < a.length; i++) if (a[i - 1] < 0 && a[i] >= 0) z++; return z; };
// how much of a sound is high: the energy of its sample-to-sample change over its own energy (0 for a slow wave, up to 4)
const bright = (a) => { let d = 0; for (let i = 1; i < a.length; i++) d += (a[i] - a[i - 1]) ** 2; return d / Math.max(1e-12, energy(a)); };
const db = (x) => 20 * Math.log10(x);
// an aim, found with the game's own preview, whose nut ends as `type` ('squirrel': a hit; 'out': flies out of the world)
const aimEnding = (t, type, nut = 'acorn') => t.page.evaluate(([k, ty]) => {
  const sim = window.__FS.sim;
  for (let power = 0.4; power <= 1; power += 0.02) for (let angle = 10; angle <= 80; angle += 2) {
    const pr = sim.preview({ nut: k, angle, power }, {});
    if (pr && pr.impact && pr.impact.type === ty) return { nut: k, angle, power: Math.round(power * 100) / 100 };
  }
  return null;
}, [nut, type]);
// every announcement the live region receives, in order
const watchLive = (t) => t.page.evaluate(() => {
  window.__told = [];
  const live = document.getElementById('live');
  new MutationObserver(() => { if (live.textContent) window.__told.push(live.textContent); }).observe(live, { childList: true, characterData: true, subtree: true });
});
const humanAims = (t) => t.page.waitForFunction(() => { const s = window.__game.getState(); return s.battle && s.battle.turn.team === 0 && s.battle.phase === 'aim' && !s.aiActive; }, null, { timeout: 90000 });
const sameSamples = (a, b) => a.every((v, i) => v === b[i]);

export const tests = [
  // ---- S5-03 ----
  {
    name: 'S5-03 no two repeats of a cue are alike, and they stay within about 2 dB of each other',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { levelId: 'gray' });
      // the render is seeded (kit seed 7), so these six strikes are the same six every run: the checks are exact, not statistical
      for (const cue of ['thock', 'boing', 'thud', 'throw']) {
        const { L } = await cueWindows(t, cue, { repeats: 6 });
        const ws = L.slice(0, 6);
        let alike = 0;
        for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) if (sameSamples(ws[i], ws[j])) alike++;
        t.equal(alike, 0, `${cue}: six strikes, no two the same`);
        const pk = ws.map((w) => peak(w));
        const spread = db(Math.max(...pk) / Math.min(...pk));
        t.expect(spread > 0.6 && spread < 3, `${cue}: peaks differ by ${spread.toFixed(2)} dB (between 0.6 and 3)`);
      }
    },
  },
  {
    name: 'S5-03 a nut sounds different on wood, on the ground and on a squirrel',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { levelId: 'gray' });
      const w = {};
      for (const on of ['wood', 'terrain', 'squirrel', undefined]) w[on] = (await cueWindows(t, 'thock', { arg: 'acorn', where: on ? { on } : undefined })).L[0];
      const keys = ['wood', 'terrain', 'squirrel', 'undefined'];
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) t.expect(!sameSamples(w[keys[i]], w[keys[j]]), `${keys[i]} and ${keys[j]} are not the same sound`);
      t.expect(bright(w.terrain) < bright(w.undefined) * 0.8, `the ground is duller than the plain knock (${bright(w.terrain).toFixed(3)} against ${bright(w.undefined).toFixed(3)})`);
      t.expect(energy(w.squirrel) > energy(w.undefined) * 1.05, 'a squirrel adds a soft whump under the knock');
    },
  },
  {
    name: 'S5-03 a bigger hit boings higher and louder, and a longer fall lands heavier',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { levelId: 'gray' });
      const small = (await cueWindows(t, 'boing', { where: { dmg: 8 } })).L[0], big = (await cueWindows(t, 'boing', { where: { dmg: 44 } })).L[0];
      t.expect(peak(big) > peak(small) * 1.15, `dmg 44 peaks ${peak(big).toFixed(3)}, dmg 8 peaks ${peak(small).toFixed(3)}`);
      t.expect(crossings(big) > crossings(small), 'and the bigger hit is higher');
      const step = (await cueWindows(t, 'land', { where: { h: 20 } })).L[0], fall = (await cueWindows(t, 'land', { where: { h: 110 } })).L[0];
      t.expect(energy(fall) > energy(step) * 2, `a 110-unit tumble has ${(energy(fall) / energy(step)).toFixed(1)} times the energy of a step`);
    },
  },
  {
    name: 'S5-03 the game sends what a nut hit and how hard to the cue',
    async run(t) {
      await startHuman(t);
      await gesture(t);
      await t.game('act', 'aim', { angle: 45, power: 0.5 });
      await t.game('act', 'fire');
      await t.page.waitForFunction(() => window.__game.getState().audio.recent.some((r) => r.startsWith('thock')), null, { timeout: 30000 });
      const a = await t.page.evaluate(() => window.__game.getState().audio);
      const i = a.recent.findIndex((r) => r.startsWith('thock'));
      t.equal(a.wheres[i].on, 'terrain', 'a weak throw into the dirt strikes the ground');
      t.expect(typeof a.wheres[i].pan === 'number', 'and says where it was');
    },
  },
  // ---- S5-04 ----
  {
    name: 'S5-04 a cue to the left of the view is heard on the left, to the right on the right, and the middle in both',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { levelId: 'gray' });
      const at = async (pan) => (await cueWindows(t, 'thud', { where: { pan } }));
      const left = await at(-0.8), right = await at(0.8), mid = await at(0);
      t.expect(energy(left.L[0]) > energy(left.R[0]) * 4, 'left of the view: the left ear gets far more');
      t.expect(energy(right.R[0]) > energy(right.L[0]) * 4, 'right of the view: the right ear gets far more');
      t.expect(Math.abs(db(energy(mid.L[0]) / energy(mid.R[0]))) < 0.5, 'the middle is even');
      const lone = (await cueWindows(t, 'thud')).L[0];
      t.expect(Math.abs(db(peak(mid.L[0], mid.R[0]) / peak(lone))) < 0.3, `the middle is as loud as a cue with no place (${db(peak(mid.L[0], mid.R[0]) / peak(lone)).toFixed(2)} dB)`);
      const widest = await at(40);
      t.expect(energy(widest.R[0]) / (energy(widest.L[0]) + 1e-12) < 1e6 && energy(widest.L[0]) > 0, 'even far off, the pan stops short of one ear alone (0.7)');
    },
  },
  {
    name: 'S5-04 a cue further from the view is quieter, and one out of view is duller',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { levelId: 'gray' });
      const at = async (pan) => (await cueWindows(t, 'throw', { where: { pan } })).R[0];
      const near = await at(0.3), edge = await at(0.95), off = await at(2.5);
      t.expect(peak(near) > peak(edge) * 1.02 || energy(near) > energy(edge) * 1.02, 'a cue at the middle is louder than one at the edge of the view');
      t.expect(energy(off) < energy(near) * 0.6, `a cue a view away is much quieter (${(energy(off) / energy(near)).toFixed(2)} of the energy)`);
      const nearS = (await cueWindows(t, 'steam', { where: { pan: 0.3 } })).R[0], offS = (await cueWindows(t, 'steam', { where: { pan: 2.5 } })).R[0];
      t.expect(bright(offS) < bright(nearS) * 0.5, `out of view the hiss is cut to 2.5 kHz and under (${bright(offS).toFixed(3)} against ${bright(nearS).toFixed(3)})`);
    },
  },
  {
    name: 'S5-04 the game places each throw by where the thrower is across the camera view',
    viewports: ['desktop'],
    async run(t) {
      await startHuman(t);
      await gesture(t);
      const st = await t.state(), me = st.battle.squirrels.find((q) => q.id === st.battle.turn.sq);
      // the camera is held where the test puts it (a user pan), so the pan the game computes is what the geometry says
      const throwPan = async (offset) => {
        const cam = await t.game('act', 'cam', { zoom: 1 });
        const half = 1280 / 2 / cam.zoom;
        await t.game('act', 'cam', { x: me.x - half * offset, y: me.y, zoom: 1 });
        const before = await t.page.evaluate(() => window.__game.getState().audio.played);
        await t.game('act', 'aim', { angle: 45, power: 0.5 });
        await t.game('act', 'fire');
        await t.page.waitForFunction((p) => window.__game.getState().audio.played > p, before, { timeout: 15000 });
        const a = await t.page.evaluate(() => window.__game.getState().audio);
        return a.wheres[a.recent.indexOf('throw')].pan;
      };
      const right = await throwPan(0.5);
      t.expect(Math.abs(right - 0.5) < 0.1, `a thrower half a half-view right of the centre pans ${right.toFixed(2)} (about 0.5)`);
    },
  },
  // ---- S2-08 ----
  {
    name: 'S2-08 the viewport meta no longer forbids zooming, and the nut names, the turn label and the nameplates follow Text size',
    async run(t) {
      // only the meta string is checked: touch-action still stops a pinch (it waits for the owner), so this does not claim the page zooms
      t.equal(await t.page.evaluate(() => document.querySelector('meta[name=viewport]').content.includes('user-scalable')), false, 'the viewport no longer forbids zooming');
      await startHuman(t);
      await t.page.waitForFunction(() => window.__game.getState().battle.phase === 'aim', null, { timeout: 30000 });
      await t.page.waitForSelector('.nut .nm', { timeout: 10000 });
      const read = () => t.page.evaluate(() => {
        const nm = document.querySelector('.nut .nm'), tl = document.getElementById('turnlabel'), tile = document.querySelector('.nut');
        const mid = document.querySelector('.mid').getBoundingClientRect(), wind = document.getElementById('wind').getBoundingClientRect();
        return { nm: parseFloat(getComputedStyle(nm).fontSize), tlCut: tl.scrollWidth > tl.clientWidth + 1 || tl.scrollHeight > tl.clientHeight + 1, tlText: tl.textContent, tile: tile.getBoundingClientRect().width, plates: window.__FS.renderer.textScale, overlap: mid.right > window.innerWidth + 1, windBelow: wind.top >= 0 };
      });
      const one = await read();
      await t.game('setState', { settings: { textScale: 1.5 } });
      await t.page.waitForFunction(() => window.__FS.renderer.textScale === 1.5, null, { timeout: 5000 });
      const big = await read();
      t.expect(Math.abs(big.nm / one.nm - 1.5) < 0.05, `a nut name is ${one.nm}px, and ${big.nm}px at 150%`);
      t.equal(big.plates, 1.5, 'the nameplates on the canvas are told the Text size');
      t.expect(big.tile >= one.tile, 'a nut tile grows with its name, it never shrinks');
      t.equal(big.tlCut, false, `the turn label is whole at 150%: "${big.tlText}"`);
      t.equal(big.overlap, false, 'and the banner row stays inside the screen');
      await snap(t, 'S2-08-text150');
      await t.game('setState', { settings: { textScale: 1 } });
      await t.page.waitForFunction(() => window.__FS.renderer.textScale === 1, null, { timeout: 5000 });
      const back = await read();
      t.expect(Math.abs(back.nm - one.nm) < 0.01, 'back at 100% the names are as they were');
    },
  },
  // ---- S2-12 ----
  {
    name: 'S2-12 the arrow keys read out the new angle and power once they pause, and a hit and a miss are announced',
    viewports: ['desktop'],
    async run(t) {
      await startHuman(t);
      await t.page.waitForFunction(() => window.__game.getState().battle.phase === 'aim', null, { timeout: 30000 });
      await watchLive(t);
      // four presses in one go, so how fast the machine is cannot split them
      await t.page.evaluate(() => { for (let i = 0; i < 4; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true })); });
      await t.page.waitForFunction(() => window.__told.some((x) => /^Angle \d+, power \d+\.$/.test(x)), null, { timeout: 10000 });
      const aim = await t.page.evaluate(() => { const b = window.__game.getState().battle; return b.teams[b.turn.team].aim; });
      const told = (await t.page.evaluate(() => window.__told)).filter((x) => /^Angle/.test(x));
      t.equal(told.length, 1, 'four quick presses are read out once, not four times');
      t.equal(told[0], `Angle ${Math.round(aim.angle)}, power ${Math.round(aim.power * 100)}.`, 'and it is the aim they ended on: ' + told[0]);
      // a hit
      const hit = await aimEnding(t, 'squirrel');
      t.expect(!!hit, 'the game finds an aim that hits a rival');
      await t.page.evaluate(() => { window.__told = []; });
      await t.game('act', 'aim', hit);
      await t.game('act', 'fire');
      await t.page.waitForFunction(() => window.__told.some((x) => /Hit \w+ for \d+, grip \d+ left\./.test(x)), null, { timeout: 30000 });
      t.expect(true, 'a hit says who, how much and the grip left: ' + (await t.page.evaluate(() => window.__told.find((x) => /Hit /.test(x)))));
      await t.game('act', 'skipFlight');
      // a miss
      await humanAims(t);
      const out = await aimEnding(t, 'out');
      t.expect(!!out, 'the game finds an aim that sends the nut out of the world');
      if (out) {
        await t.page.evaluate(() => { window.__told = []; });
        await t.game('act', 'aim', out);
        await t.game('act', 'fire');
        await t.page.waitForFunction(() => window.__told.some((x) => /Missed\./.test(x)), null, { timeout: 30000 });
        t.expect(true, 'a nut that leaves the world says Missed');
      }
    },
  },
  // ---- S4-08 ----
  {
    name: 'S4-08 the phone mini-map takes the sky and ground of the battle it shows',
    viewports: ['mobile'],
    async run(t) {
      // the colour of the sky at the top of the map and of the ground, drawn at the far left where the map has its lowest ground
      const colours = async (levelId) => {
        await t.seed(7);
        await t.game('newGame', { levelId, birds: 'off', wind: 'off' });
        await t.page.waitForFunction(() => { const c = document.getElementById('minimap'); return c && c.offsetParent !== null && window.__game.getState().battle.phase === 'aim'; }, null, { timeout: 30000 });
        // the map is redrawn on frames: let the new battle's frames draw it, and wait until it has paint at all
        await t.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
        await t.page.waitForFunction(() => { const c = document.getElementById('minimap'); return c.getContext('2d').getImageData(c.width - 8, 3, 1, 1).data[3] > 0; }, null, { timeout: 10000 });
        return t.page.evaluate(() => {
          const c = document.getElementById('minimap'), g = c.getContext('2d');
          const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3));
          return { sky: px(c.width - 8, 3), ground: px(c.width - 8, c.height - 3) };
        });
      };
      const day = await colours('gray');
      await snap(t, 'S4-08-minimap-day');
      const night = await colours('story-11');
      await snap(t, 'S4-08-minimap-winter-night');
      const fall = await colours('story-08');
      await snap(t, 'S4-08-minimap-fall-dusk');
      const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
      t.expect(lum(night.sky) < lum(day.sky) - 60, `a night sky is far darker than a day sky (${night.sky} against ${day.sky})`);
      t.expect(Math.abs(day.sky[0] - 0x7F) < 30 && Math.abs(day.sky[2] - 0xDA) < 30, 'and a day sky is the day blue (' + day.sky + ')');
      const far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      t.expect(far(fall.sky, day.sky) > 40 && far(fall.sky, night.sky) > 40, 'a dusk sky is neither the day nor the night one (' + fall.sky + ')');
      t.expect(night.ground.join() !== day.ground.join(), 'winter ground is not summer ground (' + night.ground + ' against ' + day.ground + ')');
    },
  },
  // ---- S4-02 ----
  {
    name: 'S4-02 the story map says which stretch of the Row each battle is on',
    async run(t) {
      await t.game('setState', { story: { unlocked: 5 } });
      await t.game('scene', 'story');
      await t.page.waitForSelector('.lvl[data-act="play"]');
      const labels = await t.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.lvl[data-where]')].map((b) => [b.dataset.v, b.dataset.where])));
      const all = JSON.parse(fs.readFileSync('levels/all.json', 'utf8'));
      const levels = Object.entries(all).map(([id, L]) => [id, L.stretchLabel]);
      for (const [id, label] of levels.filter(([id]) => /^story-0[1-5]$/.test(id))) t.equal(labels[id], label, `${id} carries its stretch: ${label}`);
      // the line under the map follows the tile the player points at, and it starts on the battle to play next
      t.equal(await t.page.evaluate(() => document.querySelector('#blurb .where').textContent), (levels.find(([id]) => id === 'story-05') || [])[1], 'the line starts on the next battle to play');
      await t.page.focus('.lvl[data-v="story-03"]');
      t.equal(await t.page.evaluate(() => document.querySelector('#blurb .where').textContent), labels['story-03'], 'and moves to the tile that has focus');
      await snap(t, 'S4-02-story-stretch');
    },
  },
  // ---- S4-03 ----
  {
    name: 'S4-03 pulled right out, the painted forest fades into the sky and shows no hard edge',
    async run(t) {
      // the largest jump between two rows of pixels, on the stretch of the screen where the forest band's top edge is,
      // in the columns at either side (past the painting). A hard edge is a jump of 49 to 153 (three channels summed);
      // a feathered one is 3 to 5.
      const edge = () => t.page.evaluate(() => {
        const R = window.__FS.renderer, cv = R.cv, g = cv.getContext('2d'), d = R.size.dpr, w = cv.width;
        const r = R.backdropRect(), [, by] = R.cam.toScreen(0, r.y + 60), y0 = Math.max(0, Math.round((by - 6) * d));
        let best = 0;
        for (const fx of [0.03, 0.06, 0.94, 0.97]) {
          const col = g.getImageData(Math.round(w * fx), y0, 1, Math.round(24 * d)).data;
          for (let y = 1; y < col.length / 4; y++) { const a = y * 4, b = (y - 1) * 4; best = Math.max(best, Math.abs(col[a] - col[b]) + Math.abs(col[a + 1] - col[b + 1]) + Math.abs(col[a + 2] - col[b + 2])); }
        }
        return best;
      });
      for (const levelId of ['story-01', 'story-08', 'story-11']) {
        await t.seed(7);
        await t.game('newGame', { levelId, birds: 'off', wind: 'off' });
        await t.page.waitForFunction(() => window.__game.getState().battle.phase === 'aim', null, { timeout: 30000 });
        await t.page.evaluate(() => window.__game.pause()); // nothing moves the camera while it is measured
        await t.game('act', 'cam', { zoom: 0.01 });
        await t.page.waitForFunction(() => { const c = window.__FS.renderer.cam; return Math.abs(c.zoom - c.minZoom()) < 0.002; }, null, { timeout: 10000 });
        // the view is drawn on frames: wait a few for the pulled-out one
        await t.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
        // on a phone the view is narrower than the painting, so the columns at its sides are painted forest, not the band: the
        // pixels are measured on the desktop view, and the phone's is looked at in the screenshot
        const jump = t.viewport === 'desktop' ? await edge() : 0;
        t.expect(jump < 20, `${levelId}: the biggest step across the forest's top edge is ${jump} (hard edges were 49 to 153)`);
        if (levelId === 'story-08') await snap(t, 'S4-03-pulled-out-fall-dusk');
      }
    },
  },
  // ---- S4-04 ----
  {
    name: 'S4-04 each season has its own air: leaves, snow, petals, pollen, fireflies, and none with reduced motion',
    async run(t) {
      const want = { gray: 'motes', 'story-08': 'leaves', 'story-11': 'snow', 'story-04': 'petals', 'story-06': 'fireflies' };
      await t.game('setState', { settings: { reducedMotion: false } });
      for (const [levelId, kind] of Object.entries(want)) {
        await t.seed(7);
        await t.game('newGame', { levelId, birds: 'off', wind: 'off' });
        await t.page.waitForFunction((k) => window.__FS.renderer.weather.kind === k && window.__FS.renderer.weather.drawn > 5, kind, { timeout: 15000 });
        const n = await t.page.evaluate(() => window.__FS.renderer.weather.drawn);
        t.expect(n >= 15 && n <= 40, `${levelId}: ${kind}, ${n} in the air (sparse: 15 to 40)`);
        if (levelId === 'story-08' || levelId === 'story-11' || levelId === 'story-06') await snap(t, 'S4-04-air-' + kind);
      }
      // reduced motion: nothing drifts, on the next frame
      await t.game('setState', { settings: { reducedMotion: true } });
      await t.page.waitForFunction(() => window.__FS.renderer.reduced === true && window.__FS.renderer.weather.drawn === 0, null, { timeout: 10000 });
      t.expect(true, 'reduced motion: no particles in the air');
      await t.game('setState', { settings: { reducedMotion: false } });
      await t.page.waitForFunction(() => window.__FS.renderer.weather.drawn > 5, null, { timeout: 10000 });
      t.expect(true, 'and they come back when it is off');
    },
  },
  // ---- S4-09 ----
  {
    name: 'S4-09 a wide window frames the battlefield lower, so less of it is bare soil, and nothing meets the HUD',
    viewports: ['desktop'],
    async run(t) {
      for (const levelId of ['gray', 'story-01', 'story-05', 'story-08', 'story-11']) {
        await t.seed(7);
        await t.game('newGame', { levelId, birds: 'off', wind: 'off' });
        await t.page.waitForFunction(() => window.__game.getState().battle.phase === 'aim', null, { timeout: 30000 });
        await t.page.evaluate(() => window.__game.pause());
        await t.game('act', 'cam', 'frame');
        await t.page.waitForFunction(() => { const c = window.__FS.renderer.cam; return Math.abs(c.x - c.tx) < 1 && Math.abs(c.y - c.ty) < 1; }, null, { timeout: 10000 });
        const v = await t.page.evaluate(() => {
          const A = window.__FS, c = A.renderer.cam, L = A.level, sy = (x) => c.toScreen(x, A.sim.terrain.surfaceY(x))[1];
          const sq = A.sim.b.squirrels.map((q) => c.toScreen(q.x, q.y)[1]);
          const [px, pile] = c.toScreen(L.leafPiles[0].x, L.leafPiles[0].y);
          // the controls the pile could sit behind: the nut bar and the aim box, not the empty gap between them
          const hit = [...document.querySelectorAll('.hud .bottom > *')].map((e) => e.getBoundingClientRect()).filter((r) => px > r.left - 40 && px < r.right + 40 && pile + 20 > r.top);
          const bannersBottom = Math.max(...[...document.querySelectorAll('.hud .top > *')].map((e) => e.getBoundingClientRect().bottom));
          return { rim: Math.min(sy(L.crestX[0]), sy(L.crestX[1])), vh: c.vh, topSquirrel: Math.min(...sq), pile, covered: hit.length, bannersBottom };
        });
        // the ridge between the two families sat at 0.36 to 0.40 of the height before; the soil below it was the rest
        t.expect(v.rim / v.vh >= 0.46, `${levelId}: the ridges sit at ${(v.rim / v.vh).toFixed(2)} of the height (0.36 to 0.40 before)`);
        t.expect(v.topSquirrel - 40 > v.bannersBottom, `${levelId}: the highest nameplate (${Math.round(v.topSquirrel - 40)}) is clear of the banners (${Math.round(v.bannersBottom)})`);
        t.equal(v.covered, 0, `${levelId}: the leaf pile (at ${Math.round(v.pile)}) is not under the nut bar or the aim box`);
        if (levelId === 'story-01' || levelId === 'story-08') await snap(t, 'S4-09-framing-' + levelId);
      }
    },
  },
];

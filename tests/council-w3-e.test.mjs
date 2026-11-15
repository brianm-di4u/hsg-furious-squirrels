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
    name: 'S2-08 the page can be pinch-zoomed, and the nut names, the turn label and the nameplates follow Text size',
    async run(t) {
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
];

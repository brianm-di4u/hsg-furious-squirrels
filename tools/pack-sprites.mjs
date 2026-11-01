// Pack the Blender squirrel frames (art-src/sprites/t<team>v<k>/<pose>_<i>.png, 256x256, feet at 128,236; four
// outfit variants per family) into one WebP atlas per family: assets/sq-t<team>.webp, 6 columns of 160x160 cells,
// variants one after another (variant k starts at frame k * perVariant), plus assets/sprites.json.
// Also packs the Blender birds (art-src/birds/<kind>/flap_<i>.png and glide_0.png, 256x256, from
// art-src/blender/scripts/bird.py) into assets/birds.webp, one row per kind, under sprites.json "birds".
//   node tools/pack-sprites.mjs
// Uses the harness's Chromium (no image libraries), like shared/test-harness/art-pack.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'shared/test-harness/package.json'));
const { chromium } = require('playwright');
const POSES = [['idle', 4], ['scamper', 4], ['aim', 1], ['throw', 2], ['hit', 1], ['fall', 2], ['out', 1], ['cheer', 2]];
const CELL = 160, COLS = 6, SRC = 256, AX = 128, AY = 236, UNITS_PER_SRC_PX = 1 / 3.4;

const browser = await chromium.launch();
const page = await browser.newPage();
const VARIANTS = 4;
const meta = { cell: CELL, cols: COLS, anchor: [AX * CELL / SRC, AY * CELL / SRC], pxPerUnit: 3.4 * CELL / SRC, frames: {}, variants: VARIANTS };
let i = 0;
for (const [pose, n] of POSES) { meta.frames[pose] = []; for (let k = 0; k < n; k++) meta.frames[pose].push(i++); }
meta.perVariant = i;
for (const team of [0, 1]) {
  const urls = [];
  for (let v = 0; v < VARIANTS; v++) for (const [pose, n] of POSES) for (let k = 0; k < n; k++) urls.push('data:image/png;base64,' + fs.readFileSync(path.join(ROOT, `art-src/sprites/t${team}v${v}/${pose}_${k}.png`)).toString('base64'));
  const b64 = await page.evaluate(async ({ urls, CELL, COLS }) => {
    const rows = Math.ceil(urls.length / COLS), cv = document.createElement('canvas');
    cv.width = CELL * COLS; cv.height = CELL * rows;
    const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
    for (let j = 0; j < urls.length; j++) { const img = new Image(); img.src = urls[j]; await img.decode(); g.drawImage(img, (j % COLS) * CELL, Math.floor(j / COLS) * CELL, CELL, CELL); }
    return cv.toDataURL('image/webp', 0.86).split(',')[1];
  }, { urls, CELL, COLS });
  const out = path.join(ROOT, `assets/sq-t${team}.webp`);
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log('wrote', path.relative(ROOT, out), (fs.statSync(out).size / 1024).toFixed(0), 'KB');
}

// birds: one row per kind, frames flap_0..5 then glide_0; anchor (body centre) and bodyPx in cell pixels
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'art-src/birds/birds.json'), 'utf8'));
const BCELL = 256, bk = BCELL / B.res;
meta.birds = { cell: BCELL, cols: B.frames.length, flap: B.frames.length - 1, species: {} };
const burls = [];
B.order.forEach((kind, row) => {
  const s = B.species[kind];
  meta.birds.species[kind] = { row, anchor: s.anchor.map((v) => +(v * bk).toFixed(2)), bodyPx: +(s.bodyPx * bk).toFixed(2) };
  for (const f of B.frames) burls.push('data:image/png;base64,' + fs.readFileSync(path.join(ROOT, `art-src/birds/${kind}/${f}.png`)).toString('base64'));
});
const bb64 = await page.evaluate(async ({ urls, CELL, COLS }) => {
  const rows = Math.ceil(urls.length / COLS), cv = document.createElement('canvas');
  cv.width = CELL * COLS; cv.height = CELL * rows;
  const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
  for (let j = 0; j < urls.length; j++) { const img = new Image(); img.src = urls[j]; await img.decode(); g.drawImage(img, (j % COLS) * CELL, Math.floor(j / COLS) * CELL, CELL, CELL); }
  return cv.toDataURL('image/webp', 0.86).split(',')[1];
}, { urls: burls, CELL: BCELL, COLS: B.frames.length });
const bout = path.join(ROOT, 'assets/birds.webp');
fs.writeFileSync(bout, Buffer.from(bb64, 'base64'));
console.log('wrote', path.relative(ROOT, bout), (fs.statSync(bout).size / 1024).toFixed(0), 'KB');

await browser.close();
fs.writeFileSync(path.join(ROOT, 'assets/sprites.json'), JSON.stringify(meta, null, 1));
void UNITS_PER_SRC_PX;

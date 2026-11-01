// Blind A/B pairs for review loop N (reviews/PROTOCOL.md).
//   node tools/review-ab.mjs N
// Copies each capture of loop N and loop N-1 to reviews/loop-N/ab/<viewport>-<shot>-A.png / -B.png. The side the new
// build takes is a coin flip seeded by N, written only to reviews/loop-N/ab-key.json (critics never read it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = +process.argv[2];
const cur = path.join(ROOT, 'screenshots', 'review-loop-' + N), prev = path.join(ROOT, 'screenshots', 'review-loop-' + (N - 1));
const out = path.join(ROOT, 'reviews', 'loop-' + N, 'ab');
fs.mkdirSync(out, { recursive: true });
const newSide = ((N * 2654435761) >>> 0) % 2 ? 'A' : 'B', oldSide = newSide === 'A' ? 'B' : 'A';
let n = 0;
for (const vp of ['desktop', 'mobile']) {
  for (const f of fs.readdirSync(path.join(cur, vp)).filter((x) => x.endsWith('.png'))) {
    const p = path.join(prev, vp, f);
    if (!fs.existsSync(p)) continue;
    fs.copyFileSync(path.join(cur, vp, f), path.join(out, `${vp}-${f.replace('.png', '')}-${newSide}.png`));
    fs.copyFileSync(p, path.join(out, `${vp}-${f.replace('.png', '')}-${oldSide}.png`));
    n++;
  }
}
fs.writeFileSync(path.join(ROOT, 'reviews', 'loop-' + N, 'ab-key.json'), JSON.stringify({ loop: N, newSide }, null, 1));
console.log(`${n} pairs in reviews/loop-${N}/ab`);

// Tally a review loop (reviews/PROTOCOL.md).
//   node tools/review-tally.mjs N
// Reads reviews/loop-N/critic-claude.md and critic-codex.md (one ```json block each), loop-N/ab-key.json (from
// loop 2), and the previous loop's scores. Applies the A/B rule, writes loop-N/scores.json, appends to
// reviews/HISTORY.md, prints the gates, the stop-rule verdict and a merged issue backlog.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = +process.argv[2];
if (!N) { console.error('usage: node tools/review-tally.mjs N'); process.exit(2); }
const R = path.join(ROOT, 'reviews'), dir = path.join(R, 'loop-' + N);
const CATS = ['art', 'place', 'chars', 'juice', 'read', 'ui', 'type', 'mobile', 'ground', 'polish'];
const GATE = (c) => (c === 'place' ? 6 : 7);
const parse = (f) => {
  const txt = fs.readFileSync(path.join(dir, f), 'utf8'), m = txt.match(/```json\s*([\s\S]*?)```/);
  const j = JSON.parse(m ? m[1] : txt);
  for (const c of CATS) if (typeof j.scores[c] !== 'number') throw new Error(`${f}: missing score ${c}`);
  return j;
};
const a = parse('critic-claude.md'), b = parse('critic-codex.md');
const prevFile = path.join(R, 'loop-' + (N - 1), 'scores.json');
const prev = fs.existsSync(prevFile) ? JSON.parse(fs.readFileSync(prevFile, 'utf8')) : null;
const key = fs.existsSync(path.join(dir, 'ab-key.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'ab-key.json'), 'utf8')) : null;
const out = { loop: N, scores: {}, raw: { claude: a.scores, codex: b.scores }, held: [] };
for (const c of CATS) {
  let s = Math.round(((a.scores[c] + b.scores[c]) / 2) * 2) / 2;
  if (prev && key) {
    const v = (j) => (j.ab && j.ab[c]) || 'tie';
    const dir2 = (x) => (x === 'tie' ? 0 : x === key.newSide ? 1 : -1);
    const da = dir2(v(a)), db = dir2(v(b)), p = prev.scores[c];
    const ok = (s > p && da > 0 && db > 0) || (s < p && da < 0 && db < 0) || s === p;
    if (!ok) { out.held.push({ c, judged: s, kept: p }); s = p; }
  }
  out.scores[c] = s;
}
out.total = CATS.reduce((t, c) => t + out.scores[c], 0);
const hist = [];
for (let i = 1; i < N; i++) { const f = path.join(R, 'loop-' + i, 'scores.json'); if (fs.existsSync(f)) hist.push(JSON.parse(fs.readFileSync(f, 'utf8')).total); }
const bestBefore = hist.length ? Math.max(...hist) : -Infinity;
out.newBest = out.total >= bestBefore + 1;
const lastThree = [...hist, out.total].slice(-3);
const runs = []; let best = -Infinity; for (const t of [...hist, out.total]) { runs.push(t >= best + 1); if (t >= best + 1) best = t; }
const plateau = runs.length >= 4 && runs.slice(-3).every((x) => !x);
const pass = CATS.every((c) => out.scores[c] >= GATE(c));
out.stop = pass ? 'pass' : plateau ? 'plateau' : N >= 8 ? 'cap' : null;
fs.writeFileSync(path.join(dir, 'scores.json'), JSON.stringify(out, null, 1));
const line = `| ${N} | ${CATS.map((c) => out.scores[c]).join(' | ')} | **${out.total}** | ${out.held.length ? out.held.map((h) => h.c).join(', ') : '—'} | ${out.stop || ''} |`;
const hf = path.join(R, 'HISTORY.md');
if (!fs.existsSync(hf)) fs.writeFileSync(hf, `# Review history\n\n| Loop | ${CATS.join(' | ')} | Total | Held by A/B | Stop |\n|${'---|'.repeat(CATS.length + 4)}\n`);
fs.appendFileSync(hf, line + '\n');
console.log(line);
console.log('gates:', CATS.map((c) => `${c} ${out.scores[c]}${out.scores[c] >= GATE(c) ? '' : '✗'}`).join('  '));
console.log('stop:', out.stop || 'continue', '| last totals', lastThree.join(', '));
const issues = [...(a.issues || []).map((i) => ({ ...i, by: 'claude' })), ...(b.issues || []).map((i) => ({ ...i, by: 'codex' }))];
const sev = { high: 3, medium: 2, low: 1 }, cost = { S: 1, M: 2, L: 4 };
issues.sort((x, y) => sev[y.severity] / cost[y.effort || 'M'] - sev[x.severity] / cost[x.effort || 'M']);
console.log('\nbacklog:');
for (const i of issues.slice(0, 24)) console.log(`- [${i.by} ${i.severity} ${i.effort} ${i.category}] ${i.shot}: ${i.problem} → ${i.fix}`);

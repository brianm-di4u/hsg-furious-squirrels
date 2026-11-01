#!/usr/bin/env node
// Copied from games/Cart Racing/tools/sync-repo.mjs (Hot Springs Games, MIT).
// One-way copy of this game folder into its standalone repository clone (default ../../repos/hsg-furious-squirrels),
// skipping everything .gitignore excludes plus dependency folders. Files deleted here are deleted there.
// Never runs git; commit and push from the target yourself.
//
//   node tools/sync-repo.mjs [--to <dir>] [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const TO = path.resolve(arg('to', path.join(ROOT, '..', '..', 'repos', 'hsg-furious-squirrels')));
const DRY = process.argv.includes('--dry');

// patterns mirror .gitignore (kept simple: directory names, path prefixes and suffixes)
const SKIP_DIRS = new Set(['node_modules', '.git', 'screenshots', 'reference-samples', 'benchmarks', 'renders', '.tmp']);
const SKIP_PREFIX = ['tools/out', 'tools/dev', 'shared/test-harness/smoke/screenshots', '.claude'];
const skipFile = (rel) => ((rel.startsWith('art-src/') || rel.startsWith('reviews/')) && rel.endsWith('.png')) || rel.endsWith('.blend1') || rel.endsWith('.log') || /(^|\/)(Thumbs\.db|\.DS_Store)$/.test(rel);

function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || SKIP_PREFIX.some((p) => rel === p || rel.startsWith(p + '/'))) continue;
      out.push(...walk(path.join(dir, e.name), rel));
    } else if (!skipFile(rel)) out.push(rel);
  }
  return out;
}

const files = walk(ROOT);
let copied = 0, same = 0, bytes = 0;
for (const rel of files) {
  const src = path.join(ROOT, rel), dst = path.join(TO, rel);
  const a = fs.readFileSync(src);
  if (fs.existsSync(dst) && Buffer.compare(a, fs.readFileSync(dst)) === 0) { same++; continue; }
  copied++; bytes += a.length;
  if (!DRY) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, a); }
}
// remove files that no longer exist here (never touches .git)
let removed = 0;
if (fs.existsSync(TO)) {
  const keep = new Set(files);
  for (const rel of walk(TO)) if (!keep.has(rel)) { removed++; if (!DRY) fs.rmSync(path.join(TO, rel)); }
}
console.log(`${DRY ? '[dry] ' : ''}${path.relative(process.cwd(), TO) || TO}: ${copied} copied (${(bytes / 1024 / 1024).toFixed(2)} MB), ${same} unchanged, ${removed} removed, ${files.length} files total`);

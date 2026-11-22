// Verify every Field Notes fact (PRD AC21; LESSONS wave 2: a fact checker in tools/).
//   node tools/check-facts.mjs
// Landmark facts must exist in the audited trivia bank with confidence "confirmed" and the same source; nature
// facts must cite a URL that appears in research/squirrels-and-nuts.md or research/birds.md. Exit code 1 on any problem.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Shared workspace material (reference/, research/, sibling repos/): $HSG_WORKSPACE, else this repo's grandparent
// (the workspace root when the repo sits in <workspace>/repos/).
const WORKSPACE = process.env.HSG_WORKSPACE || path.resolve(ROOT, '..', '..');
// The audited bank: $FS_TRIVIA_BANK, else the sibling checkout <workspace>/repos/hsg-trivia/.
export const BANK = process.env.FS_TRIVIA_BANK || path.join(WORKSPACE, 'repos', 'hsg-trivia', 'data', 'questions.json');

// Which bank file was read, and the commit of the repo that holds it (with "+ uncommitted changes" when its working tree differs),
// so a failure says what it compared against.
export function bankSource() {
  const dir = path.dirname(BANK), git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try { return `${BANK} at commit ${git('rev-parse', '--short', 'HEAD')}${git('status', '--porcelain', '--', BANK) ? ' + uncommitted changes' : ''}`; } catch { return `${BANK} (no git history found beside it)`; }
}

export function checkFacts() {
  const issues = [];
  if (!fs.existsSync(BANK)) return { issues: [`The audited trivia bank is not at ${BANK}. Put the hsg-trivia checkout in <workspace>/repos/ (set HSG_WORKSPACE to the workspace root), or point FS_TRIVIA_BANK at its data/questions.json.`], n: 0 };
  const facts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/facts.json'), 'utf8'));
  const raw = JSON.parse(fs.readFileSync(BANK, 'utf8')), bank = Array.isArray(raw) ? raw : raw.questions;
  const research = ['squirrels-and-nuts.md', 'birds.md'].map((f) => fs.readFileSync(path.join(ROOT, 'research', f), 'utf8')).join(' ');
  for (const f of facts.landmarks) {
    const q = bank.find((x) => x.id === f.id);
    if (!q) { issues.push(`${f.id}: not in the audited bank`); continue; }
    if (q.confidence !== 'confirmed') issues.push(`${f.id}: confidence ${q.confidence}`);
    if (q.source !== f.source || q.sourceUrl !== f.url) issues.push(`${f.id}: source differs from the bank`);
    if (q.answer !== f.a || q.question !== f.q) issues.push(`${f.id}: text differs from the bank (rebuild data/facts.json)`);
  }
  for (const f of facts.nature) {
    if (!f.url || !research.includes(f.url)) issues.push(`${f.id}: source URL not cited in research/squirrels-and-nuts.md or research/birds.md`);
    if (/UNVERIFIED/.test(f.text)) issues.push(`${f.id}: unverified text`);
  }
  const bankIssue = issues.some((i) => /bank/.test(i));
  if (bankIssue) issues.push(`Compared against ${bankSource()}. If the bank moved on, rebuild with: node tools/build-facts.mjs (then commit data/facts.json).`);
  return { issues, n: facts.landmarks.length + facts.nature.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { issues, n } = checkFacts();
  console.log(issues.length ? issues.join('\n') : `${n} facts OK (bank: ${bankSource()})`);
  process.exit(issues.length ? 1 : 0);
}

// Verify every Field Notes fact (PRD AC21; LESSONS wave 2: a fact checker in tools/).
//   node tools/check-facts.mjs
// Landmark facts must exist in the audited trivia bank with confidence "confirmed" and the same source; nature
// facts must cite a URL that appears in research/squirrels-and-nuts.md or research/birds.md. Exit code 1 on any problem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BANK = process.env.FS_TRIVIA_BANK || path.resolve(ROOT, '..', 'trivia', 'data', 'questions.json');

export function checkFacts() {
  const issues = [];
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
  return { issues, n: facts.landmarks.length + facts.nature.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { issues, n } = checkFacts();
  console.log(issues.length ? issues.join('\n') : `${n} facts OK`);
  process.exit(issues.length ? 1 : 0);
}

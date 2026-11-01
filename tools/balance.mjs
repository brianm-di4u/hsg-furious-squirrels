// Balance runs on the real sim (LESSONS wave 2: a Node balance tool that runs the real sim).
//   node tools/balance.mjs [--battles 24] [--quick]
// Reports turns per round, head-to-head win rates by AI difficulty, hit rates, first-mover advantage and the
// grip removed per throw by each nut (forced nut, medium AI aim), against tools/balance-targets.json.
// Exit code 1 when a target is missed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Sim } from '../src/js/sim/battle.js';
import { planTurn } from '../src/js/sim/ai.js';
import { NUT_ORDER } from '../src/js/sim/const.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'levels/all.json'), 'utf8'));
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/balance-targets.json'), 'utf8'));
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const N = +arg('--battles', args.includes('--quick') ? 8 : 24);
const LEVELS = Object.values(all).filter((L) => /^story-/.test(L.id));

export function battle(L, seed, d0, d1, size = 3) {
  const sim = new Sim(L, { seed, teamSize: size, rounds: 1, human: [false, false], loadout: 'all' });
  const first = sim.b.turn.team;
  let turns = 0, throws = [0, 0], hits = [0, 0];
  while (sim.b.phase !== 'battleEnd' && turns < 150) {
    if (sim.b.phase === 'roundEnd') { sim.continueBattle(); continue; }
    const team = sim.b.turn.team, p = planTurn(sim, team ? d1 : d0);
    if (!p) { sim.nextTurn(); continue; }
    sim.throwNut(p); sim.settleNow(); turns++;
    throws[team]++;
    if (sim.drain().some((e) => (e.type === 'hit' || e.type === 'ko') && sim.b.squirrels.find((q) => q.id === e.sq).team !== team)) hits[team]++;
  }
  return { winner: sim.b.result ? sim.b.result.battleWinner : -1, turns, first, throws, hits };
}

function nutStudy(perNut) {
  const out = {};
  for (const kind of NUT_ORDER) {
    let dmg = 0, n = 0;
    for (let i = 0; i < perNut; i++) {
      const L = LEVELS[i % LEVELS.length];
      const sim = new Sim(L, { seed: 1000 + i, teamSize: 3, human: [false, false], loadout: 'practice' });
      const team = sim.b.turn.team;
      const before = sim.b.squirrels.filter((q) => q.team !== team).reduce((s, q) => s + q.grip, 0);
      const p = planTurn(sim, 'medium', { nut: kind, noMove: true });
      sim.throwNut(p); sim.settleNow();
      const after = sim.b.squirrels.filter((q) => q.team !== team).reduce((s, q) => s + (q.out ? 0 : q.grip), 0);
      dmg += before - after; n++;
    }
    out[kind] = +(dmg / n).toFixed(1);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t0 = performance.now();
  const pairs = [['medium', 'medium'], ['hard', 'easy'], ['easy', 'hard'], ['medium', 'easy'], ['easy', 'medium'], ['easy', 'easy'], ['hard', 'hard']];
  const res = {}, hitT = { easy: [0, 0], medium: [0, 0], hard: [0, 0] };
  let turnSum = 0, rounds = 0, firstWins = 0, decided = 0;
  for (const [a, b] of pairs) {
    const r = { w0: 0, w1: 0, turns: 0 };
    for (let i = 0; i < N; i++) {
      const o = battle(LEVELS[i % LEVELS.length], 500 + i * 7, a, b);
      if (o.winner === 0) r.w0++; else if (o.winner === 1) r.w1++;
      r.turns += o.turns;
      // easy vs easy never happens in play (a human is always one side), so it doesn't count toward round length
      if (!(a === 'easy' && b === 'easy')) { turnSum += o.turns; rounds++; }
      if (o.winner >= 0) { decided++; if (o.winner === o.first) firstWins++; }
      hitT[a][0] += o.hits[0]; hitT[a][1] += o.throws[0]; hitT[b][0] += o.hits[1]; hitT[b][1] += o.throws[1];
    }
    res[a + '-' + b] = { win0: +(r.w0 / N).toFixed(2), win1: +(r.w1 / N).toFixed(2), turns: +(r.turns / N).toFixed(1) };
  }
  const turnsMean = turnSum / rounds;
  const hardEasy = (res['hard-easy'].win0 + res['easy-hard'].win1) / 2;
  const medEasy = (res['medium-easy'].win0 + res['easy-medium'].win1) / 2;
  const hit = Object.fromEntries(Object.entries(hitT).map(([k, v]) => [k, +(v[0] / Math.max(1, v[1])).toFixed(2)]));
  const nuts = nutStudy(Math.max(12, N));
  const specials = NUT_ORDER.filter((k) => k !== 'acorn').map((k) => nuts[k]);
  const meanS = specials.reduce((a, b) => a + b, 0) / specials.length;
  const spread = Math.max(...specials) / meanS;
  const checks = [
    ['turns per round', turnsMean, turnsMean >= T.turnsPerRound.min && turnsMean <= T.turnsPerRound.max, `${T.turnsPerRound.min}-${T.turnsPerRound.max}`],
    ['hard beats easy', hardEasy, hardEasy >= T.hardBeatsEasy, '>= ' + T.hardBeatsEasy],
    ['medium beats easy', medEasy, medEasy >= T.mediumBeatsEasy, '>= ' + T.mediumBeatsEasy],
    ['first mover wins', firstWins / Math.max(1, decided), firstWins / Math.max(1, decided) <= T.firstMoverMax, '<= ' + T.firstMoverMax],
    ...Object.entries(T.hitRate).map(([d, [lo, hi]]) => ['hit rate ' + d, hit[d], hit[d] >= lo && hit[d] <= hi, `${lo}-${hi}`]),
    ['special nut spread (max/mean)', spread, spread <= T.specialSpread, '<= ' + T.specialSpread],
  ];
  console.log('head-to-head', JSON.stringify(res));
  console.log('grip removed per throw by nut', JSON.stringify(nuts));
  let bad = 0;
  for (const [name, v, ok, want] of checks) { console.log(`${ok ? 'OK  ' : 'MISS'} ${name.padEnd(30)} ${(+v).toFixed(2).padStart(6)}  target ${want}`); if (!ok) bad++; }
  console.log(`${N * pairs.length} battles in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  fs.mkdirSync(path.join(ROOT, 'tools/out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'tools/out/balance.json'), JSON.stringify({ res, nuts, hit, turnsMean, hardEasy, medEasy, firstMover: firstWins / Math.max(1, decided), spread }, null, 1));
  process.exit(bad ? 1 : 0);
}

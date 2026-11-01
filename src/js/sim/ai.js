// Squirrel AI (MECHANICS.md §8): aims by search with the same simulator the battle uses, then adds
// difficulty noise drawn after the search (it never peeks at its own noise). Medium and hard "bracket": after
// each miss on the same target their noise shrinks, which reads as a player zeroing in.
// Planning is a generator so the browser can spread it across frames; planTurn() runs it to completion (Node).
import { NUTS, SQ_UP, GRIP, clamp } from './const.js';
import { segDist } from './trees.js';

export const DIFF = {
  easy: { sa: 3.8, sp: 0.045, wind: 0.6, special: 0.25, move: 0.08, bracket: 0.25, think: [0.9, 1.4] },
  medium: { sa: 2.0, sp: 0.022, wind: 1, special: 0.55, move: 0.3, bracket: 0.5, think: [0.7, 1.1] },
  hard: { sa: 0.6, sp: 0.007, wind: 1, special: 0.8, move: 0.6, bracket: 0.7, think: [0.5, 0.9] },
};
const TAPPED = { chinquapin: 1, pecan: 1, sweetgum: 1 };

function pickTarget(sim, q) {
  const foes = sim.b.squirrels.filter((e) => e.team !== q.team && !e.out);
  let best = null, bs = -Infinity;
  for (const e of foes) {
    const n = sim.graphs[e.team].byId.get(e.perch);
    const onBranch = n && n.kind === 'branch' ? 30 : 0;
    const s = -Math.hypot(e.x - q.x, e.y - q.y) * 0.05 + (GRIP - e.grip) * 0.5 + onBranch;
    if (s > bs) { bs = s; best = e; }
  }
  return best;
}

// Expected grip removed from rivals (minus own family) if the nut lands at impact.
function score(sim, q, kind, impact, target) {
  if (!impact) return -1e6;
  const d = NUTS[kind], b = sim.b;
  let s = 0;
  for (const e of b.squirrels) {
    if (e.out) continue;
    let dmg = 0;
    if (impact.type === 'squirrel' && impact.sq === e.id) dmg = d.direct;
    else {
      const dd = Math.hypot(e.x - impact.x, e.y - SQ_UP - impact.y);
      if (dd < d.splashR) dmg = d.splash * (1 - dd / d.splashR);
    }
    dmg = Math.min(e.grip, dmg);
    if (e.team === q.team) s -= dmg * 1.6; else s += dmg + (dmg >= e.grip ? 25 : 0);
  }
  // cracking the branch under a rival is worth something even without a hit
  if (impact.type === 'wood' && impact.branch >= 0) {
    const st = b.trees[impact.tree].b[impact.branch];
    const riders = b.squirrels.filter((e) => !e.out && e.team !== q.team && e.perch && e.perch.startsWith(`B${impact.tree}:${impact.branch}:`));
    if (riders.length) s += (d.wood >= st.hp ? 30 : 8) * riders.length;
  }
  if (target) s -= Math.hypot(target.x - impact.x, target.y - SQ_UP - impact.y) * 0.02;
  return s;
}

function chooseNut(sim, team, P, rng, target) {
  const inv = sim.b.teams[team].inventory;
  const have = Object.keys(inv).filter((k) => inv[k] > 0);
  if (!have.length || !rng.chance(P.special)) return 'acorn';
  if (P === DIFF.easy) return rng.pick(have);
  // situational preferences: big blast on clustered rivals, hedge apple downhill, trio at range, pecan on branches
  const foes = sim.b.squirrels.filter((e) => e.team !== team && !e.out);
  const close = target ? foes.filter((e) => Math.hypot(e.x - target.x, e.y - target.y) < 90).length : 0;
  const prefs = [];
  if (close >= 2) prefs.push('walnut', 'chinquapin');
  if (target && target.grip <= 40) prefs.push('hedgeapple', 'sweetgum');
  prefs.push('pecan', 'walnut', 'chinquapin', 'sweetgum', 'hedgeapple', 'hickory');
  return prefs.find((k) => have.includes(k)) || 'acorn';
}

// When to tap the trick, as a sim step, given the untapped arc.
function planTap(kind, pred, target) {
  const steps = pred.steps, pts = pred.pts;
  if (!pts.length) return null;
  if (kind === 'chinquapin') {
    // split about 280 units short of the target so the three spread over it
    if (target) { for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - target.x, pts[i][1] - target.y) < 280) return i * 4; }
    return Math.round(steps * 0.62);
  }
  if (kind === 'pecan') {
    // dash when the nut's heading points at the target
    if (target) {
      let bi = -1, bd = 0.12;
      for (let i = 1; i < pts.length - 1; i++) {
        const vx = pts[i + 1][0] - pts[i][0], vy = pts[i + 1][1] - pts[i][1], tx = target.x - pts[i][0], ty = target.y - SQ_UP - pts[i][1];
        const dist = Math.hypot(tx, ty); if (dist < 120) break;
        const c = 1 - (vx * tx + vy * ty) / (Math.hypot(vx, vy) * dist || 1);
        if (c < bd) { bd = c; bi = i; }
      }
      if (bi >= 0) return bi * 4;
    }
    return Math.round(steps * 0.55);
  }
  if (kind === 'sweetgum' && target && pts.length) {
    let bi = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p[0] - target.x); if (d < bd) { bd = d; bi = i; } });
    return bi * 4;
  }
  return null;
}

// Score one candidate throw; trick nuts are judged with their planned tap (all pieces for the trio).
function evalShot(sim, q, kind, a, p, target) {
  const pred = sim.preview({ nut: kind, angle: a, power: p });
  if (TAPPED[kind] && pred.impact) {
    const tapAt = planTap(kind, pred, target);
    if (tapAt != null && tapAt < pred.steps) {
      const full = sim.preview({ nut: kind, angle: a, power: p }, { tapAt, stopAtFirst: false, allImpacts: true });
      const ims = (full.impacts || []).filter((im) => im.type !== 'out');
      const s = ims.length ? ims.reduce((t, im) => t + score(sim, q, kind, im, target), 0) : -1e6;
      return { a, p, s, pred, tapAt };
    }
  }
  return { a, p, s: score(sim, q, kind, pred.impact, target), pred, tapAt: null };
}

function* search(sim, q, kind, P, target, grid) {
  const save = sim.b.wind;
  sim.b.wind = save * P.wind;
  let best = null, n = 0;
  try {
    for (let a = grid.a0; a <= grid.a1; a += grid.da) for (let p = grid.p0; p <= grid.p1 + 1e-9; p += grid.dp) {
      const r = evalShot(sim, q, kind, a, p, target);
      if (!best || r.s > best.s) best = r;
      if (++n % 60 === 0) yield n;
    }
    // refine around the best
    const ra = grid.da / 4, rp = grid.dp / 4, c = best;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const a = c.a + i * ra, p = clamp(c.p + j * rp, 0.05, 1);
      const r = evalShot(sim, q, kind, a, p, target);
      if (r.s > best.s) best = r;
      if (++n % 60 === 0) yield n;
    }
  } finally { sim.b.wind = save; }
  best.n = n;
  return best;
}

const FULL = { a0: 5, a1: 80, da: 2.5, p0: 0.3, p1: 1, dp: 0.035 };
const QUICK = { a0: 10, a1: 75, da: 7.5, p0: 0.35, p1: 1, dp: 0.09 };

// The whole turn: maybe move, choose a nut, aim, add noise. Returns {move, nut, angle, power, tapAt, target}.
export function* planTurnGen(sim, difficulty = 'medium', force = {}) {
  const P = DIFF[difficulty] || DIFF.medium, rng = sim.rng('ai'), b = sim.b;
  const q = sim.active();
  if (!q) return null;
  const tm = b.teams[q.team];
  const mem = tm.ai || (tm.ai = { target: null, k: 1 });
  let target = pickTarget(sim, q);
  if (!target) return null;
  let move = null;
  // consider moving to a perch with a better quick-search score
  if (!force.noMove && rng.chance(P.move)) {
    const reach = [...sim.reach().keys()].filter((id) => id !== q.perch);
    const cands = [];
    for (let i = 0; i < 3 && reach.length; i++) cands.push(reach.splice(rng.int(reach.length), 1)[0]);
    const here = yield* search(sim, q, 'acorn', P, target, QUICK);
    let bestS = here.s;
    const ox = q.x, oy = q.y;
    for (const id of cands) {
      const n = sim.graphs[q.team].byId.get(id);
      q.x = n.x; q.y = n.y;
      const r = yield* search(sim, q, 'acorn', P, target, QUICK);
      if (r.s > bestS + 6) { bestS = r.s; move = id; }
    }
    q.x = ox; q.y = oy;
  }
  if (move) { sim.move(move); target = pickTarget(sim, q) || target; }
  const kind = force.nut && sim.canUse(q.team, force.nut) ? force.nut : chooseNut(sim, q.team, P, rng, target);
  const best = yield* search(sim, q, kind, P, target, FULL);
  const tapAt = best.tapAt;
  // bracketing: repeated shots at the same target get steadier
  if (mem.target === target.id) mem.k = Math.max(0.3, mem.k * (1 - P.bracket));
  else { mem.target = target.id; mem.k = 1; }
  const angle = clamp(best.a + rng.normal(0, P.sa * mem.k), -30, 90);
  const power = clamp(best.p + rng.normal(0, P.sp * mem.k), 0.05, 1);
  return { move, nut: kind, angle: Math.round(angle * 10) / 10, power: Math.round(power * 1000) / 1000, tapAt, target: target.id, sims: best.n, think: rng.range(P.think[0], P.think[1]) };
}

export function planTurn(sim, difficulty, force) {
  const it = planTurnGen(sim, difficulty, force);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

export { segDist };

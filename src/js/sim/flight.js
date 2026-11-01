// Nut flight (MECHANICS.md §6): one fixed step of the integrator plus swept collision against squirrels, wood and
// terrain. Shared by the battle, the aim preview and the AI, so all three agree. Semi-implicit Euler at DT, the
// same stepping pattern as games/baseball/src/js/flight.js.
import { G, W, H, WIND_MAX, SQ_R, SQ_UP, OWNER_GRACE, FLIGHT_MAX, NUTS, BIRDS } from './const.js';
import { segDist } from './trees.js';
import { birdPos } from './birds.js';

const SUB = 4; // max world units between collision samples
export const HOME_GRACE = 0; // (kept for reference) own trees never block their family's nuts

export function makeNut(kind, x, y, angleDeg, power, vmax, team, sqId, facing, home = -1) {
  const d = NUTS[kind], a = (angleDeg * Math.PI) / 180, v = power * vmax;
  return {
    kind, x, y, vx: Math.cos(a) * v * facing, vy: -Math.sin(a) * v, r: d.r, gMul: d.gMul, windMul: d.windMul, mass: d.mass,
    age: 0, team, sq: sqId, facing, home, state: 'fly', t: 0, tapped: false, spin: 0, inCanopy: -1, rolled: false,
  };
}

// Steam lift at a point: strongest near the valley floor, gone STEAM_TOP units above it.
export const STEAM_TOP = 900;
export function steamLift(env, x, y, age) {
  const s = env.steam;
  if (!s || !s.lift || Math.abs(x - s.x) > s.w / 2) return 0;
  const h = env.floorY - y;
  if (h > STEAM_TOP) return 0;
  const fade = h < 0 ? 1 : Math.sqrt(1 - h / STEAM_TOP);
  const edge = 1 - Math.abs(x - s.x) / (s.w / 2);
  return s.lift * (0.6 + 0.4 * Math.sin(age * 3)) * fade * Math.min(1, edge * 2.5);
}

// Broad phase: tree bounding boxes, built once per geometry change.
export function treeBoxes(geoms) {
  return geoms.map((g) => {
    let x0 = Math.min(g.trunk.x0, g.trunk.x1), x1 = Math.max(g.trunk.x0, g.trunk.x1), y0 = Math.min(g.trunk.y0, g.trunk.y1), y1 = Math.max(g.trunk.y0, g.trunk.y1);
    for (const s of g.segs) { x0 = Math.min(x0, s.x0, s.x1); x1 = Math.max(x1, s.x0, s.x1); y0 = Math.min(y0, s.y0, s.y1); y1 = Math.max(y1, s.y0, s.y1); }
    for (const c of g.canopies) { x0 = Math.min(x0, c.x - c.r); x1 = Math.max(x1, c.x + c.r); y0 = Math.min(y0, c.y - c.r); y1 = Math.max(y1, c.y + c.r); }
    return { x0: x0 - 20, x1: x1 + 20, y0: y0 - 20, y1: y1 + 20 };
  });
}

// Test one point against everything solid. Returns a hit or null. env.squirrels may be empty (preview).
function probe(nut, env, x, y, dash) {
  if (nut.state !== 'husk') {
    for (const q of env.squirrels) {
      if (q.out || (q.id === nut.sq && nut.age < OWNER_GRACE)) continue;
      const dx = x - q.x, dy = y - (q.y - SQ_UP);
      if (dx * dx + dy * dy <= (SQ_R + nut.r) ** 2) return { type: 'squirrel', sq: q.id, x, y };
    }
    // birds (the aim preview and the AI fly with env.birds empty, so they never plan around them)
    const birds = env.birds;
    if (birds) for (let i = 0; i < birds.length; i++) {
      const bd = birds[i];
      if (bd.flee) continue;
      const p = birdPos(bd, env.birdT, env), rr = BIRDS[bd.k].r + nut.r;
      if ((x - p.x) ** 2 + (y - p.y) ** 2 <= rr * rr) return { type: 'bird', bird: i, x, y, bx: p.x, by: p.y, face: p.face };
    }
  }
  const boxes = env.boxes;
  for (let i = 0; i < env.geoms.length; i++) {
    if (env.geoms[i].team === nut.team) continue; // home leaves: a family's nuts slip through its own trees
    const b = boxes[i];
    if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
    const g = env.geoms[i];
    if (nut.state !== 'husk') {
      for (const s of g.segs) {
        if (s.broken) continue;
        if (segDist(x, y, s).d <= nut.r + s.w / 2) return { type: 'wood', tree: i, branch: s.id, x, y };
      }
      if (segDist(x, y, g.trunk).d <= nut.r + g.trunk.w / 2) return { type: 'wood', tree: i, branch: -1, x, y };
    }
    if (!dash) for (let c = 0; c < g.canopies.length; c++) {
      const k = g.canopies[c];
      if ((x - k.x) ** 2 + (y - k.y) ** 2 < k.r * k.r) return { type: 'canopy', tree: i, canopy: c, x, y };
    }
  }
  if (y + nut.r >= env.terrain.minSurf && env.terrain.circleHits(x, y, nut.r)) return { type: 'terrain', x, y };
  return null;
}

// Advance one nut by dt. Returns null (still flying), or an event {type: 'squirrel'|'wood'|'terrain'|'out'|'rollEnd', ...}
// with the nut parked at the last free position.
export function stepNut(nut, env, dt) {
  nut.age += dt;
  nut.spin += dt * (nut.vx >= 0 ? 12 : -12);
  if (nut.age > FLIGHT_MAX) return { type: 'out', x: nut.x, y: nut.y };
  if (nut.burstNow) { nut.burstNow = false; return { type: 'burst', x: nut.x, y: nut.y }; }
  if (nut.state === 'roll') return stepRoll(nut, env, dt);
  const dash = nut.state === 'dash';
  let ax = 0, ay = 0;
  if (!dash) {
    ax = env.wind * WIND_MAX * nut.windMul;
    ay = G * nut.gMul * (nut.state === 'hook' ? 0.45 : 1) - steamLift(env, nut.x, nut.y, nut.age);
  }
  nut.vx += ax * dt; nut.vy += ay * dt;
  if (nut.state === 'hook') {
    const rate = ((NUTS.hickory.hook.turn * Math.PI) / 180 / NUTS.hickory.hook.time) * -nut.facing;
    const c = Math.cos(rate * dt), s = Math.sin(rate * dt), vx = nut.vx;
    nut.vx = vx * c - nut.vy * s; nut.vy = vx * s + nut.vy * c;
  }
  if (nut.state === 'dash' || nut.state === 'hook') {
    nut.t -= dt;
    if (nut.t <= 0) nut.state = 'fly';
  }
  if (nut.state === 'husk') { nut.t -= dt; if (nut.t <= 0) return { type: 'out', x: nut.x, y: nut.y, husk: true }; }
  const x0 = nut.x, y0 = nut.y, x1 = x0 + nut.vx * dt, y1 = y0 + nut.vy * dt;
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / SUB));
  let canopyHit = -1;
  for (let i = 1; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    const h = probe(nut, env, x, y, dash);
    if (h) {
      if (h.type === 'canopy') { canopyHit = h.tree * 100 + h.canopy; continue; }
      if (nut.state === 'husk') { nut.x = x; nut.y = y; return { type: 'out', x, y, husk: true }; }
      nut.x = x0 + ((x1 - x0) * (i - 1)) / n; nut.y = y0 + ((y1 - y0) * (i - 1)) / n;
      return h;
    }
  }
  nut.x = x1; nut.y = y1;
  // leaves slow a nut down (a dashing pecan zips straight through); entering a canopy is a rustle event
  if (canopyHit >= 0) {
    const k = Math.pow(0.985, dt * 120);
    nut.vx *= k; nut.vy *= k;
    if (nut.inCanopy !== canopyHit) { nut.inCanopy = canopyHit; return { type: 'rustle', x: nut.x, y: nut.y, cont: true }; }
  } else nut.inCanopy = -1;
  if (nut.x < -300 || nut.x > W + 300 || nut.y > H + 60) return { type: 'out', x: nut.x, y: nut.y };
  return null;
}

// Hedge apple roll: slides along the surface, accelerated downhill, until its timer or speed runs out.
function stepRoll(nut, env, dt) {
  nut.t -= dt;
  const t = env.terrain;
  const yA = t.surfaceY(nut.x - 6), yB = t.surfaceY(nut.x + 6), slope = (yB - yA) / 12; // + means downhill to the right
  nut.vx += G * 0.6 * (slope / Math.sqrt(1 + slope * slope)) * dt;
  nut.vx *= Math.pow(0.992, dt * 120);
  const x1 = nut.x + nut.vx * dt;
  const y1 = t.surfaceY(x1) - nut.r;
  // climbing a wall: stop
  if (y1 < nut.y - 10) return { type: 'rollEnd', x: nut.x, y: nut.y };
  for (const q of env.squirrels) {
    if (q.out) continue;
    const dx = x1 - q.x, dy = y1 - (q.y - SQ_UP);
    if (dx * dx + dy * dy <= (SQ_R + nut.r) ** 2) { nut.x = x1; nut.y = y1; return { type: 'squirrel', sq: q.id, x: x1, y: y1, rolling: true }; }
  }
  nut.x = x1; nut.y = y1; nut.vy = 0;
  nut.spin += (nut.vx / nut.r) * dt;
  if (nut.t <= 0 || Math.abs(nut.vx) < 25 || x1 < 0 || x1 > W) return { type: 'rollEnd', x: nut.x, y: nut.y };
  return null;
}

// Predict a throw without touching the world: returns the arc points and the first impact. Abilities can be
// planned with tapAt (step index). Used by the aim guide and the AI.
export function predict(env, nut, opts = {}) {
  const pts = [], maxSteps = opts.maxSteps || 1440, every = opts.every || 4, dt = opts.dt;
  const live = [nut];
  let first = null, step = 0;
  for (; step < maxSteps && live.length; step++) {
    if (opts.tapAt != null && step === opts.tapAt) {
      for (const k of applyTap(live[0], opts.rngNull)) live.push(k);
    }
    for (let i = live.length - 1; i >= 0; i--) {
      const k = live[i], ev = stepNut(k, env, dt);
      if (i === 0 && step % every === 0) pts.push([k.x, k.y]);
      if (!ev || ev.cont) continue;
      if (ev.type === 'terrain' && k.kind === 'hedgeapple' && !k.rolled) { startRoll(k, env); continue; }
      if (!first && !(ev.type === 'out' && ev.husk)) first = { ...ev, step, nut: k.kind };
      if (opts.allImpacts) (opts.impacts || (opts.impacts = [])).push({ ...ev, step });
      live.splice(i, 1);
      if (opts.stopAtFirst !== false && first) return { pts, impact: first, steps: step, impacts: opts.impacts };
    }
  }
  return { pts, impact: first, steps: step, impacts: opts.impacts };
}

export function startRoll(nut, env) {
  nut.rolled = true; nut.state = 'roll'; nut.t = NUTS.hedgeapple.roll.time;
  const n = env.terrain.normal(nut.x, nut.y + nut.r);
  // keep the along-surface part of the velocity
  const tx = -n.y, ty = n.x, along = nut.vx * tx + nut.vy * ty;
  nut.vx = along * tx * 0.8 + nut.vx * 0.1; nut.vy = 0;
  nut.y = env.terrain.surfaceY(nut.x) - nut.r;
}

// Trigger a nut's trick. Mutates the nut; returns any new nuts spawned (split, drop).
export function applyTap(nut) {
  if (nut.tapped || nut.state === 'roll' || nut.state === 'husk') return [];
  const d = NUTS[nut.kind];
  nut.tapped = true;
  const out = [];
  if (d.split) {
    const sp = (d.split.spread * Math.PI) / 180, v = Math.hypot(nut.vx, nut.vy), a = Math.atan2(nut.vy, nut.vx);
    for (const s of [-sp, sp]) out.push({ ...nut, vx: Math.cos(a + s) * v, vy: Math.sin(a + s) * v, child: true });
  } else if (d.dash) {
    const v = Math.hypot(nut.vx, nut.vy) || 1, m = (v * d.dash.mul) / v;
    nut.vx *= m; nut.vy *= m; nut.state = 'dash'; nut.t = d.dash.time;
  } else if (d.hook) {
    nut.state = 'hook'; nut.t = d.hook.time;
  } else if (d.drop) {
    out.push({ ...nut, kind: 'sweetgum', ball: true, vx: nut.vx * 0.15, vy: Math.max(nut.vy, 0) + 120, gMul: d.drop.gMul, r: 8, tapped: true, child: true, state: 'fly' });
    nut.state = 'husk'; nut.t = 1.2; nut.r = 5;
  } else if (d.burst) {
    nut.burstNow = true;
  }
  return out;
}

export { H };

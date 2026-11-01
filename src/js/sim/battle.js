// The battle rules engine (MECHANICS.md §3, §7): one serializable `battle` object plus derived world caches
// (terrain mask, tree geometry, perch graphs) rebuilt from the level and that object. No DOM.
import {
  DT, G, W, VMAX, STAMINA, GRIP, SQ_UP, NUTS, NUT_ORDER, NUT_CAP, ACORNS, TEAMS, SETTLE_MAX, WIND_LEVELS, STEAM_LEVELS,
  ANGLE_MIN, ANGLE_MAX, clamp,
} from './const.js';
import { Terrain } from './terrain.js';
import { initTreeState, treeGeom, buildPerches, shortestPath, reachable, segDist } from './trees.js';
import { makeNut, stepNut, applyTap, startRoll, treeBoxes, predict } from './flight.js';
import { makeRng } from '../rng.js';

export const TUMBLE_OUT = 110; // a fall this far onto the ground knocks a squirrel out of the tree (PRD §3)

const NAMES = [
  ['Hazel', 'Rusty', 'Maple', 'Biscuit'],
  ['Ash', 'Pebble', 'Willow', 'Smokey'],
];

export class Sim {
  // opts: {seed, mode, difficulty, teamSize, rounds, wind, steam, loadout, human: [bool, bool], practice}
  constructor(level, opts = {}, battle = null) {
    this.level = level;
    this.queue = []; // events for the renderer/audio, drained each frame
    if (battle) { this.b = battle; this.rebuild(); return; }
    const seed = (opts.seed ?? 7) >>> 0;
    const size = clamp(opts.teamSize || level.teamSize || 3, 1, 4);
    const windKey = opts.wind || level.wind || 'normal', steamKey = opts.steam || level.steam || 'on';
    const loadout = opts.loadout || 'all';
    this.b = {
      v: 1, seed, levelId: level.id, mode: opts.mode || 'quick', difficulty: opts.difficulty || 'medium',
      practice: !!opts.practice || opts.mode === 'practice',
      round: 1, rounds: opts.rounds || level.rounds || 1, roundWins: [0, 0], phase: 'aim',
      windLevel: WIND_LEVELS[windKey] ?? 0.8, wind: 0, steamLevel: STEAM_LEVELS[steamKey] ?? 420,
      turn: { team: 0, sq: null, n: 0, stamina: STAMINA, moved: 0 },
      teams: [0, 1].map((t) => ({
        id: TEAMS[t].id, acorns: ACORNS.start, human: opts.human ? !!opts.human[t] : t === (opts.playerTeam ?? 0),
        inventory: startInventory(loadout, opts.unlocked), next: 0, stats: { throws: 0, hits: 0, kos: 0, dmg: 0, best: 0 },
        aim: { angle: 45, power: 0.6, nut: 'acorn' },
      })),
      squirrels: [], trees: null, craters: [], settle: 0, falling: [], nuts: [], log: [],
      rng: { sim: makeRng(seed ^ 0x5eed).s, ai: makeRng(seed ^ 0xa11ce).s }, result: null, size,
    };
    if (this.b.practice) this.b.teams[1].human = false;
    this.startRound(true);
  }

  // ---- world caches -------------------------------------------------------------------------------------------
  rebuild() {
    const b = this.b, L = this.level;
    this.terrain = new Terrain(L);
    for (const c of b.craters) this.terrain.carve(c.x, c.y, c.r);
    this.refreshTrees();
  }
  refreshTrees() {
    const b = this.b, L = this.level;
    this.geoms = L.trees.map((d, i) => treeGeom(d, b.trees[i]));
    this.boxes = treeBoxes(this.geoms);
    this.graphs = [0, 1].map((t) => buildPerches(L, this.geoms, this.terrain, t));
  }
  env() {
    const b = this.b;
    return { wind: b.wind, steam: { x: this.level.steam.x, w: this.level.steam.w, lift: b.steamLevel }, floorY: this.level.floorY, terrain: this.terrain, geoms: this.geoms, boxes: this.boxes, squirrels: b.squirrels };
  }
  rng(stream) {
    const r = makeRng(1);
    r.s = this.b.rng[stream];
    const self = this;
    // write the state back after every draw so the battle object always holds the live sequence
    const wrap = (fn) => (...a) => { const v = fn(...a); self.b.rng[stream] = r.s; return v; };
    return { next: wrap(r.next), int: wrap(r.int), range: wrap(r.range), normal: wrap(r.normal), pick: wrap(r.pick), chance: wrap(r.chance) };
  }
  emit(ev) { this.queue.push(ev); const log = this.b.log; log.push(ev); if (log.length > 40) log.shift(); }
  drain() { const q = this.queue; this.queue = []; return q; }

  // ---- rounds and turns ---------------------------------------------------------------------------------------
  startRound(first = false) {
    const b = this.b, L = this.level;
    b.trees = initTreeState(L);
    b.craters = [];
    b.nuts = []; b.falling = []; b.settle = 0;
    this.rebuild();
    b.squirrels = [];
    for (let t = 0; t < 2; t++) {
      const spawns = L.spawns[t];
      const n = b.practice && t === 1 ? Math.min(3, L.spawns[1].length) : b.size;
      for (let i = 0; i < n; i++) {
        const node = this.nodeNear(t, spawns[i % spawns.length]);
        b.squirrels.push({
          id: t * 10 + i, team: t, name: b.practice && t === 1 ? 'Practice dummy' : NAMES[t][i], grip: GRIP, out: false,
          perch: node.id, x: node.x, y: node.y, facing: TEAMS[t].facing, fall: null, dummy: b.practice && t === 1, koAt: null,
        });
      }
    }
    b.teams.forEach((tm) => { tm.next = 0; });
    b.turn = { team: first ? (b.seed & 1 ? 1 : 0) : (b.round + (b.seed & 1)) % 2, sq: null, n: b.turn ? b.turn.n : 0, stamina: STAMINA, moved: 0 };
    if (b.practice) b.turn.team = 0;
    // the family that throws second gets a bonus Black Walnut each round (offsets the first-throw edge)
    const second = b.teams[1 - b.turn.team];
    if (!b.practice && 'walnut' in second.inventory) second.inventory.walnut = Math.min(NUT_CAP, second.inventory.walnut + 1);
    b.wind = clamp(this.rng('sim').normal(0, 0.5), -1, 1) * b.windLevel;
    b.phase = 'aim';
    this.pickSquirrel();
    this.emit({ type: 'round', round: b.round });
  }

  pickSquirrel() {
    const b = this.b, tm = b.teams[b.turn.team];
    const mine = b.squirrels.filter((q) => q.team === b.turn.team && !q.out && !q.dummy);
    if (!mine.length) { b.turn.sq = null; return; }
    const q = mine[tm.next % mine.length];
    tm.next = (tm.next + 1) % Math.max(1, mine.length);
    b.turn.sq = q.id;
    const aim = tm.aim;
    if (!b.teams[b.turn.team].inventory[aim.nut]) aim.nut = 'acorn';
  }

  nextTurn() {
    const b = this.b;
    const alive = [0, 1].map((t) => b.squirrels.filter((q) => q.team === t && !q.out).length);
    if (!b.practice && (alive[0] === 0 || alive[1] === 0)) return this.endRound(alive);
    if (!b.practice) b.turn.team = 1 - b.turn.team;
    b.turn.n++;
    b.turn.stamina = STAMINA; b.turn.moved = 0;
    const r = this.rng('sim');
    b.wind = clamp((b.wind / (b.windLevel || 1)) * 0.5 + r.normal(0, 0.45), -1, 1) * b.windLevel;
    b.phase = 'aim';
    this.pickSquirrel();
    this.emit({ type: 'turn', team: b.turn.team, sq: b.turn.sq, wind: b.wind });
  }

  endRound(alive) {
    const b = this.b;
    let winner = alive[0] > 0 ? 0 : alive[1] > 0 ? 1 : -1;
    b.teams.forEach((tm) => { tm.acorns += ACORNS.roundPlayed; });
    if (winner >= 0) { b.roundWins[winner]++; b.teams[winner].acorns += ACORNS.roundWin; }
    const need = Math.floor(b.rounds / 2) + 1;
    const done = winner >= 0 && b.roundWins[winner] >= need;
    b.phase = done ? 'battleEnd' : 'roundEnd';
    b.result = { winner, round: b.round, done, battleWinner: done ? winner : null, turns: b.turn.n };
    this.emit({ type: done ? 'battleEnd' : 'roundEnd', winner });
  }

  // after the shop: next round (a draw replays the round number)
  continueBattle() {
    const b = this.b;
    if (b.phase !== 'roundEnd') return false;
    if (b.result && b.result.winner >= 0) b.round++;
    this.startRound();
    return true;
  }

  // test hook: end the round with a winner
  forceRound(team) {
    const b = this.b;
    for (const q of b.squirrels) if (q.team !== team) { q.out = true; q.grip = 0; }
    this.endRound([0, 1].map((t) => b.squirrels.filter((q) => q.team === t && !q.out).length));
  }

  // ---- shop ---------------------------------------------------------------------------------------------------
  buy(team, kind) {
    const tm = this.b.teams[team], d = NUTS[kind];
    if (!d || kind === 'acorn' || !(kind in tm.inventory)) return { ok: false, why: 'locked' };
    if (tm.inventory[kind] >= NUT_CAP) return { ok: false, why: 'cap' };
    if (tm.acorns < d.price) return { ok: false, why: 'acorns' };
    tm.acorns -= d.price; tm.inventory[kind]++;
    return { ok: true };
  }

  // ---- the active squirrel ------------------------------------------------------------------------------------
  active() { const b = this.b; return b.squirrels.find((q) => q.id === b.turn.sq) || null; }
  hand(q) { return { x: q.x + q.facing * 10, y: q.y - SQ_UP - 12 }; }
  homeTree(q) { const n = q.perch && this.graphs[q.team].byId.get(q.perch); return n && n.tree != null ? n.tree : -1; }
  nodeNear(team, p) {
    const g = this.graphs[team];
    let best = g.nodes[0], bd = Infinity;
    for (const n of g.nodes) {
      if (p.kind && n.kind !== p.kind) continue;
      const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  reach() {
    const q = this.active();
    if (!q || !q.perch || this.b.phase !== 'aim') return new Map();
    return reachable(this.graphs[q.team], q.perch, this.b.turn.stamina);
  }
  // Scamper to a node id; returns the path (animated by the renderer) or null.
  move(toId) {
    const b = this.b, q = this.active();
    if (!q || b.phase !== 'aim' || !q.perch) return null;
    const sp = shortestPath(this.graphs[q.team], q.perch, toId);
    if (!sp || sp.cost > b.turn.stamina + 1e-6) return null;
    b.turn.stamina -= sp.cost; b.turn.moved += sp.cost;
    const pts = sp.path.map((id) => { const n = this.graphs[q.team].byId.get(id); return [n.x, n.y]; });
    const n = this.graphs[q.team].byId.get(toId);
    q.perch = toId; q.x = n.x; q.y = n.y;
    this.emit({ type: 'move', sq: q.id, pts, cost: sp.cost });
    return pts;
  }

  // ---- throwing -----------------------------------------------------------------------------------------------
  setAim(a) {
    const tm = this.b.teams[this.b.turn.team];
    if (a.angle != null) tm.aim.angle = clamp(a.angle, ANGLE_MIN, ANGLE_MAX);
    if (a.power != null) tm.aim.power = clamp(a.power, 0.05, 1);
    if (a.nut && this.canUse(this.b.turn.team, a.nut)) tm.aim.nut = a.nut;
    return tm.aim;
  }
  canUse(team, kind) { const inv = this.b.teams[team].inventory; return kind === 'acorn' || (inv[kind] || 0) > 0; }

  throwNut(a = {}) {
    const b = this.b, q = this.active();
    if (!q || b.phase !== 'aim') return false;
    const aim = this.setAim(a), tm = b.teams[q.team];
    const kind = this.canUse(q.team, aim.nut) ? aim.nut : 'acorn';
    if (kind !== 'acorn') tm.inventory[kind]--;
    const h = this.hand(q);
    const nut = makeNut(kind, h.x, h.y, aim.angle, aim.power, VMAX, q.team, q.id, q.facing, this.homeTree(q));
    b.nuts = [nut];
    b.phase = 'flight';
    b.flightStep = 0;
    b.tapAt = a.tapAt ?? null;
    b.shot = { team: q.team, sq: q.id, kind, dmg: 0, kos: 0, breaks: 0 };
    tm.stats.throws++;
    this.emit({ type: 'throw', sq: q.id, kind, angle: aim.angle, power: aim.power });
    if (!tm.inventory[aim.nut] && aim.nut !== 'acorn') aim.nut = 'acorn';
    return true;
  }

  tap() {
    const b = this.b;
    if (b.phase !== 'flight' || !b.nuts.length) return false;
    const lead = b.nuts[0];
    if (lead.tapped || lead.kind === 'acorn' || lead.kind === 'hedgeapple') return false;
    const spawned = applyTap(lead);
    b.nuts.push(...spawned);
    this.emit({ type: 'tap', kind: lead.kind, x: lead.x, y: lead.y });
    return true;
  }

  // one fixed step
  step() {
    const b = this.b;
    if (b.phase === 'flight') this.stepFlight();
    else if (b.phase === 'settle') this.stepSettle();
  }

  stepFlight() {
    const b = this.b, env = this.env();
    if (b.tapAt != null && b.flightStep === b.tapAt) this.tap();
    b.flightStep++;
    for (let i = b.nuts.length - 1; i >= 0; i--) {
      const nut = b.nuts[i], ev = stepNut(nut, env, DT);
      if (!ev) continue;
      if (ev.type === 'rustle') { this.emit({ type: 'rustle', x: ev.x, y: ev.y }); continue; }
      if (ev.type === 'terrain' && nut.kind === 'hedgeapple' && !nut.rolled) { startRoll(nut, env); this.emit({ type: 'thud', x: nut.x, y: nut.y, kind: nut.kind }); continue; }
      b.nuts.splice(i, 1);
      if (ev.type === 'out') { if (!ev.husk) this.emit({ type: 'miss', x: ev.x, y: ev.y }); continue; }
      this.impact(nut, ev);
    }
    if (!b.nuts.length) { b.phase = 'settle'; b.settle = 0; }
  }

  impact(nut, ev) {
    const b = this.b, d = NUTS[nut.kind], burst = nut.kind === 'walnut';
    const x = ev.x, y = ev.y;
    let direct = null;
    if (ev.type === 'squirrel') {
      direct = b.squirrels.find((q) => q.id === ev.sq);
      const dmg = this.damage(direct, d.direct * (ev.rolling ? 0.7 : 1), nut);
      this.push(direct, nut, dmg > 0 ? Math.hypot(nut.vx, nut.vy) * nut.mass * 0.03 : 0, x);
    }
    if (ev.type === 'wood') this.hitWood(ev.tree, ev.branch, d.wood * (nut.state === 'dash' || nut.tapped && nut.kind === 'pecan' ? 1.5 : 1));
    if (burst) {
      // the blast cracks every branch in reach
      for (let ti = 0; ti < this.geoms.length; ti++) for (const s of this.geoms[ti].segs) {
        if (s.broken) continue;
        const sd = segDist(x, y, s).d;
        if (sd < d.woodR) this.hitWood(ti, s.id, d.wood * (1 - sd / d.woodR), true);
      }
    }
    // splash
    for (const q of b.squirrels) {
      if (q.out || q === direct) continue;
      const dd = Math.hypot(q.x - x, q.y - SQ_UP - y);
      if (dd >= d.splashR) continue;
      const f = 1 - dd / d.splashR;
      const dmg = this.damage(q, d.splash * f, nut);
      this.push(q, nut, f * d.splash * 0.55 * (burst ? 1.2 : 1), x);
      void dmg;
    }
    // crater (in the air nothing is carved; tufa and rock refuse)
    const cr = d.crater;
    const cleared = this.terrain.carve(x, y + (ev.type === 'terrain' ? nut.r * 0.5 : 0), cr);
    if (cleared) {
      b.craters.push({ x: Math.round(x * 10) / 10, y: Math.round((y + (ev.type === 'terrain' ? nut.r * 0.5 : 0)) * 10) / 10, r: cr });
      this.afterTerrainChange();
    }
    this.emit({ type: 'impact', kind: nut.kind, on: ev.type, x, y, r: cr, burst, ball: !!nut.ball });
  }

  damage(q, amount, nut) {
    const b = this.b;
    if (!q || q.out || amount <= 0) return 0;
    let dmg = amount * (q.team === nut.team ? 0.5 : 1); // family friendly fire is gentler
    dmg = Math.round(Math.min(q.grip, dmg) * 10) / 10;
    q.grip = Math.round((q.grip - dmg) * 10) / 10;
    const shot = b.shot;
    if (shot && q.team !== shot.team) {
      shot.dmg += dmg;
      b.teams[shot.team].acorns += ACORNS.hit;
      b.teams[shot.team].stats.hits++; b.teams[shot.team].stats.dmg += dmg;
    }
    this.emit({ type: 'hit', sq: q.id, dmg, grip: q.grip, x: q.x, y: q.y - SQ_UP });
    if (q.grip <= 0) this.knockOut(q);
    return dmg;
  }

  knockOut(q) {
    const b = this.b;
    if (q.out) return;
    q.out = true; q.grip = 0; q.fall = null;
    const pile = this.level.leafPiles[q.team];
    q.koFrom = { x: q.x, y: q.y }; q.perch = null; q.x = pile.x + ((q.id % 10) - 1.5) * 18; q.y = pile.y;
    q.koAt = b.turn.n;
    const shot = b.shot;
    if (shot && q.team !== shot.team) { shot.kos++; b.teams[shot.team].acorns += ACORNS.ko; b.teams[shot.team].stats.kos++; }
    this.emit({ type: 'ko', sq: q.id, from: q.koFrom, to: { x: q.x, y: q.y } });
  }

  // knockback: a strong enough push knocks a squirrel off its perch
  push(q, nut, amount, fromX) {
    if (!q || q.out || amount < 18) return;
    this.dislodge(q, Math.sign(q.x - fromX) || nut.facing);
  }

  dislodge(q, dir = 0) {
    if (q.out || q.fall) return;
    q.fall = { vy: -60, vx: dir * 40, y0: q.y };
    q.perch = null;
    this.emit({ type: 'dislodge', sq: q.id, x: q.x, y: q.y });
  }

  hitWood(ti, bi, amount, quiet) {
    const b = this.b;
    if (bi < 0) { if (!quiet) this.emit({ type: 'knock', tree: ti }); return; }
    const st = b.trees[ti].b[bi];
    if (st.broken) return;
    st.hp = Math.max(0, Math.round((st.hp - amount) * 10) / 10);
    this.emit({ type: 'wood', tree: ti, branch: bi, hp: st.hp });
    if (st.hp <= 0) this.breakBranch(ti, bi);
  }

  breakBranch(ti, bi) {
    const b = this.b, def = this.level.trees[ti];
    st(b, ti, bi).broken = true;
    // children go with it
    for (let i = 0; i < def.branches.length; i++) if (isDescendant(def, i, bi)) st(b, ti, i).broken = true;
    const g = this.geoms[ti];
    b.falling.push({ tree: ti, branch: bi, seg: { ...g.segs[bi] }, age: 0 });
    if (b.shot && def.team !== b.shot.team) { b.shot.breaks++; b.teams[b.shot.team].acorns += ACORNS.branch; }
    this.emit({ type: 'break', tree: ti, branch: bi, x: (g.segs[bi].x0 + g.segs[bi].x1) / 2, y: (g.segs[bi].y0 + g.segs[bi].y1) / 2 });
    this.refreshTrees();
    // anyone standing on a now-missing node falls
    for (const q of b.squirrels) if (!q.out && q.perch && !this.graphs[q.team].byId.has(q.perch)) this.dislodge(q, 0);
  }

  afterTerrainChange() {
    const b = this.b;
    this.graphs = [0, 1].map((t) => buildPerches(this.level, this.geoms, this.terrain, t));
    for (const q of b.squirrels) {
      if (q.out || !q.perch) continue;
      const n = this.graphs[q.team].byId.get(q.perch);
      if (!n) { this.dislodge(q); continue; }
      if (n.kind === 'ground' && n.y > q.y + 6) { q.fall = { vy: 0, vx: 0, y0: q.y }; q.perch = null; }
      else { q.x = n.x; q.y = n.y; }
    }
  }

  stepSettle() {
    const b = this.b;
    b.settle += DT;
    for (const f of b.falling) f.age += DT;
    let busy = false;
    for (const q of b.squirrels) {
      if (q.out || !q.fall) continue;
      busy = true;
      const f = q.fall, y0 = q.y;
      f.vy += G * DT; q.y += f.vy * DT; q.x = clamp(q.x + f.vx * DT, this.level.zones[q.team][0], this.level.zones[q.team][1]);
      if (f.vy <= 0) continue;
      // land on the first perch the fall crosses, or on the ground
      let land = null;
      for (const n of this.graphs[q.team].nodes) {
        if (n.kind === 'trunk') continue;
        if (Math.abs(n.x - q.x) < 22 && n.y > f.y0 + 8 && n.y >= y0 - 0.5 && n.y <= q.y + 0.5 && (!land || n.y < land.y)) land = n;
      }
      const gy = this.terrain.surfaceY(q.x);
      if (!land && q.y >= gy) land = this.nodeNear(q.team, { x: q.x, y: gy, kind: 'ground' });
      if (land) {
        q.fall = null; q.perch = land.id; q.x = land.x; q.y = land.y;
        const h = land.y - f.y0, dmg = Math.max(0, (h - 60) * 0.12);
        this.emit({ type: 'land', sq: q.id, x: q.x, y: q.y, h, ground: land.kind === 'ground' });
        // knocked clean out of the tree: a long tumble to the ground ends the round for that squirrel
        if (land.kind === 'ground' && h >= TUMBLE_OUT) this.knockOut(q);
        else if (dmg > 0) this.damage(q, dmg, { team: -1 });
      }
    }
    b.falling = b.falling.filter((f) => f.age < 1.6);
    if (b.falling.length) busy = true;
    if ((!busy && b.settle > 0.35) || b.settle >= SETTLE_MAX) {
      // anyone still falling lands where they are
      for (const q of b.squirrels) if (!q.out && q.fall) { const n = this.nodeNear(q.team, { x: q.x, y: q.y }); q.fall = null; q.perch = n.id; q.x = n.x; q.y = n.y; }
      b.falling = [];
      this.finishShot();
      this.nextTurn();
    }
  }

  finishShot() {
    const b = this.b, s = b.shot;
    if (!s) return;
    const tm = b.teams[s.team];
    if (s.dmg > tm.stats.best) tm.stats.best = Math.round(s.dmg);
    this.emit({ type: 'shotDone', ...s });
    b.shot = null;
  }

  busy() { const b = this.b; return b.phase === 'flight' || b.phase === 'settle'; }

  // run until the current shot settles (tests, skip)
  settleNow(max = 120 * 30) {
    for (let i = 0; i < max && this.busy(); i++) this.step();
    return !this.busy();
  }

  // Aim guide / AI: where would a throw from the active squirrel go?
  preview(aim, opts = {}) {
    const q = this.active();
    if (!q) return null;
    const h = this.hand(q);
    const nut = makeNut(aim.nut || 'acorn', h.x, h.y, aim.angle, aim.power, VMAX, q.team, q.id, q.facing, this.homeTree(q));
    return predict({ ...this.env(), squirrels: opts.squirrels === false ? [] : this.b.squirrels }, nut, { dt: DT, ...opts });
  }

  alive(team) { return this.b.squirrels.filter((q) => q.team === team && !q.out && !q.dummy).length; }

  toJSON() { return JSON.parse(JSON.stringify(this.b)); }
}

function st(b, ti, bi) { return b.trees[ti].b[bi]; }
function isDescendant(def, i, anc) {
  let p = def.branches[i].parent;
  while (p >= 0) { if (p === anc) return true; p = def.branches[p].parent; }
  return false;
}

function startInventory(loadout, unlocked) {
  const inv = {};
  const kinds = loadout === 'story' && unlocked ? unlocked : NUT_ORDER;
  for (const k of NUT_ORDER) if (k !== 'acorn' && kinds.includes(k)) inv[k] = loadout === 'practice' ? 99 : 1;
  return inv;
}

// FNV-1a over the rounded rule state: identical inputs and seed give the same hash in Node and Chromium.
export function hashBattle(b) {
  let h = 2166136261 >>> 0;
  const mix = (v) => { const s = String(Math.round(v * 100)); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } };
  for (const q of b.squirrels) { mix(q.x); mix(q.y); mix(q.grip); mix(q.out ? 1 : 0); }
  for (const t of b.trees) for (const s of t.b) { mix(s.hp); mix(s.broken ? 1 : 0); }
  for (const c of b.craters) { mix(c.x); mix(c.y); mix(c.r); }
  mix(b.wind); mix(b.turn.n); mix(b.turn.team);
  for (const t of b.teams) { mix(t.acorns); for (const k of Object.keys(t.inventory)) mix(t.inventory[k]); }
  return h >>> 0;
}

export { W };

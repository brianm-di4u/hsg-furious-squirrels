// Trees, branches, canopies and the perch graph (MECHANICS.md §5). Geometry is computed from the level's tree
// definitions plus per-branch state ({hp, broken}) kept in the battle object; it is rebuilt after any break.
import { DEG } from './const.js';

const BR_STEP = 28, TR_STEP = 40, GR_STEP = 40;

export function branchHp(w) { return Math.round(14 + w * 4); }

export function initTreeState(level) {
  return level.trees.map((t) => ({ b: t.branches.map((b) => ({ hp: branchHp(b.w), broken: false })) }));
}

// World segments for one tree. Angles: degrees, 0 = right, 90 = up (screen y grows down).
export function treeGeom(def, st) {
  const lean = (def.trunk.lean || 0) * DEG;
  const x0 = def.x, y0 = def.baseY, h = def.trunk.h;
  const trunk = { x0, y0, x1: x0 + Math.sin(lean) * h, y1: y0 - Math.cos(lean) * h, w: def.trunk.w };
  const segs = [];
  for (let i = 0; i < def.branches.length; i++) {
    const b = def.branches[i], p = b.parent < 0 ? trunk : segs[b.parent];
    const sx = p.x0 + (p.x1 - p.x0) * b.t, sy = p.y0 + (p.y1 - p.y0) * b.t, a = b.a * DEG;
    const broken = st.b[i].broken || (b.parent >= 0 && segs[b.parent].broken);
    segs.push({ id: i, x0: sx, y0: sy, x1: sx + Math.cos(a) * b.len, y1: sy - Math.sin(a) * b.len, w: b.w, broken, parent: b.parent, leaves: !!b.leaves });
  }
  const canopies = [];
  if (def.crown) canopies.push({ x: trunk.x1, y: trunk.y1 - def.crown * 0.3, r: def.crown, branch: -1 });
  for (const s of segs) if (s.leaves && !s.broken) {
    const r = Math.max(26, Math.hypot(s.x1 - s.x0, s.y1 - s.y0) * 0.5);
    canopies.push({ x: s.x0 + (s.x1 - s.x0) * 0.8, y: s.y0 + (s.y1 - s.y0) * 0.8 - r * 0.25, r, branch: s.id });
  }
  return { trunk, segs, canopies, team: def.team };
}

export function segDist(px, py, s) {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - s.x0) * dx + (py - s.y0) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = s.x0 + dx * t, qy = s.y0 + dy * t;
  return { d: Math.hypot(px - qx, py - qy), t, qx, qy };
}

// Perch graph for one team: nodes on its trees' trunks and unbroken branches, plus the ground of its slope.
// Node ids are stable strings so a squirrel's perch survives a rebuild.
export function buildPerches(level, geoms, terrain, team) {
  const nodes = [], byId = new Map(), edges = new Map();
  const add = (n) => { nodes.push(n); byId.set(n.id, n); edges.set(n.id, []); return n; };
  const link = (a, b) => {
    if (!a || !b || a === b) return;
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    edges.get(a.id).push({ to: b.id, d }); edges.get(b.id).push({ to: a.id, d });
  };
  const z = level.zones[team];
  const ground = [];
  for (let x = z[0], k = 0; x <= z[1]; x += GR_STEP, k++) ground.push(add({ id: `G${team}:${k}`, x, y: terrain.surfaceY(x), kind: 'ground', team }));
  for (let i = 1; i < ground.length; i++) link(ground[i - 1], ground[i]);
  level.trees.forEach((def, ti) => {
    if (def.team !== team) return;
    const g = geoms[ti], tr = g.trunk;
    const trunkLen = Math.hypot(tr.x1 - tr.x0, tr.y1 - tr.y0), trunkNodes = [];
    for (let s = 12, k = 0; s <= trunkLen - 6; s += TR_STEP, k++) {
      const u = s / trunkLen;
      trunkNodes.push(add({ id: `T${ti}:${k}`, x: tr.x0 + (tr.x1 - tr.x0) * u, y: tr.y0 + (tr.y1 - tr.y0) * u, kind: 'trunk', tree: ti, u, team }));
    }
    for (let i = 1; i < trunkNodes.length; i++) link(trunkNodes[i - 1], trunkNodes[i]);
    const base = ground.reduce((a, b) => (Math.abs(b.x - tr.x0) < Math.abs(a.x - tr.x0) ? b : a), ground[0]);
    if (base && trunkNodes[0] && Math.abs(base.x - tr.x0) < GR_STEP) link(base, trunkNodes[0]);
    const segNodes = [];
    for (const s of g.segs) {
      const list = [];
      segNodes[s.id] = list;
      if (s.broken) continue;
      const L = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
      for (let d = 14, k = 0; d <= L - 6; d += BR_STEP, k++) {
        const u = d / L;
        list.push(add({ id: `B${ti}:${s.id}:${k}`, x: s.x0 + (s.x1 - s.x0) * u, y: s.y0 + (s.y1 - s.y0) * u - s.w / 2, kind: 'branch', tree: ti, branch: s.id, u, team }));
      }
      for (let i = 1; i < list.length; i++) link(list[i - 1], list[i]);
    }
    // join each branch's first node to the nearest node of its parent (trunk or branch)
    for (const s of g.segs) {
      const list = segNodes[s.id];
      if (!list || !list.length) continue;
      const parentNodes = s.parent < 0 ? trunkNodes : segNodes[s.parent] || [];
      let best = null, bd = 1e9;
      for (const n of parentNodes) { const d = Math.hypot(n.x - list[0].x, n.y - list[0].y); if (d < bd) { bd = d; best = n; } }
      if (best && bd < 60) link(best, list[0]);
    }
  });
  return { nodes, byId, edges };
}

// Dijkstra over a perch graph; returns {path:[ids], cost} or null.
export function shortestPath(graph, from, to) {
  if (!graph.byId.has(from) || !graph.byId.has(to)) return null;
  const dist = new Map([[from, 0]]), prev = new Map(), done = new Set();
  while (true) {
    let u = null, ud = Infinity;
    for (const [k, v] of dist) if (!done.has(k) && v < ud) { u = k; ud = v; }
    if (u == null) return null;
    if (u === to) break;
    done.add(u);
    for (const e of graph.edges.get(u)) {
      const nd = ud + e.d;
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, u); }
    }
  }
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0]));
  return { path, cost: dist.get(to) };
}

// All nodes reachable within a stamina budget: Map id -> cost.
export function reachable(graph, from, budget) {
  const dist = new Map([[from, 0]]), done = new Set();
  if (!graph.byId.has(from)) return dist;
  while (true) {
    let u = null, ud = Infinity;
    for (const [k, v] of dist) if (!done.has(k) && v < ud) { u = k; ud = v; }
    if (u == null) break;
    done.add(u);
    for (const e of graph.edges.get(u)) {
      const nd = ud + e.d;
      if (nd <= budget && nd < (dist.get(e.to) ?? Infinity)) dist.set(e.to, nd);
    }
  }
  return dist;
}

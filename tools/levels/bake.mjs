// Bake battlefield levels from the real valley profile (research/valley-profile.json) and the level specs below.
//
//   node tools/levels/bake.mjs --all        -> levels/<id>.json and levels/all.json (inlined into the page)
//
// The terrain is the West Mountain viewpoint -> Hot Springs Mountain Tower battle line, smoothed, compressed to
// 2,400 world units and vertically exaggerated (x1.44 px per ft of relief, about 3.5x true scale; a design choice
// recorded in research/valley-profile.md). Each Row stretch scales the two mountains' relief by its own transect.
// Trees are generated from a seeded recipe per species; the same seed always gives the same level.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRng } from '../../src/js/rng.js';
import { W, H } from '../../src/js/sim/const.js';
import { treeGeom, initTreeState } from '../../src/js/sim/trees.js';
import { Sim } from '../../src/js/sim/battle.js';
import { NUTS, SQ_UP } from '../../src/js/sim/const.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const profile = JSON.parse(fs.readFileSync(path.join(ROOT, 'research/valley-profile.json'), 'utf8'));
const STEP = 8;
const D0 = 380, D1 = 2103, ROW_FT = 612, FLOOR_Y = 1060, PX_PER_FT = 1.44;

// Relief multipliers per Row stretch, from the transects' near-ridge heights (valley-profile.md)
const STRETCH = {
  north: { west: 0.94, east: 1.0, label: 'North end: Arlington, Superior, Hale', row: ['arlington', 'superior', 'hale', 'maurice'] },
  middle: { west: 1.02, east: 0.93, label: 'Middle: Maurice, Fordyce, Quapaw', row: ['hale', 'maurice', 'entrance', 'fordyce', 'quapaw'] },
  south: { west: 1.04, east: 0.84, label: 'South end: Ozark, Buckstaff, Lamar', row: ['quapaw', 'ozark', 'buckstaff', 'lamar', 'admin'] },
};

export const SPECS = [
  { id: 'gray', name: 'Gray box', stretch: 'middle', season: 'summer', time: 'day', teamSize: 3, steam: 'on', wind: 'normal', seed: 11, par: 10 },
  { id: 'story-01', n: 1, name: 'Morning on the Row', stretch: 'middle', season: 'summer', time: 'day', teamSize: 2, steam: 'off', wind: 'light', seed: 101, par: 8, unlock: null, tutorial: true },
  { id: 'story-02', n: 2, name: 'Under the Tower', stretch: 'north', season: 'summer', time: 'day', teamSize: 2, steam: 'weak', wind: 'light', seed: 102, par: 9, unlock: 'chinquapin' },
  { id: 'story-03', n: 3, name: 'Dome at Dusk', stretch: 'middle', season: 'summer', time: 'dusk', teamSize: 3, steam: 'on', wind: 'normal', seed: 103, par: 10, unlock: 'pecan' },
  { id: 'story-04', n: 4, name: 'Redbud Ridge', stretch: 'south', season: 'spring', time: 'day', teamSize: 3, steam: 'on', wind: 'normal', seed: 104, par: 10, unlock: 'hickory' },
  { id: 'story-05', n: 5, name: 'Valley of Vapors', stretch: 'middle', season: 'spring', time: 'mist', teamSize: 3, steam: 'strong', wind: 'light', seed: 105, par: 11, unlock: 'walnut' },
  { id: 'story-06', n: 6, name: 'Magnolia Lamps', stretch: 'north', season: 'summer', time: 'night', teamSize: 3, steam: 'on', wind: 'normal', seed: 106, par: 11, unlock: null },
  { id: 'story-07', n: 7, name: 'Fall on the Promenade', stretch: 'south', season: 'fall', time: 'day', teamSize: 3, steam: 'on', wind: 'gusty', seed: 107, par: 12, unlock: 'sweetgum' },
  { id: 'story-08', n: 8, name: 'Gumball Gulch', stretch: 'middle', season: 'fall', time: 'dusk', teamSize: 3, steam: 'strong', wind: 'normal', seed: 108, par: 12, unlock: null },
  { id: 'story-09', n: 9, name: 'Hedge Apple Harvest', stretch: 'north', season: 'fall', time: 'day', teamSize: 4, steam: 'on', wind: 'normal', seed: 109, par: 13, unlock: 'hedgeapple' },
  { id: 'story-10', n: 10, name: 'First Dusting', stretch: 'south', season: 'winter', time: 'day', teamSize: 4, steam: 'on', wind: 'gusty', seed: 110, par: 13, unlock: null },
  { id: 'story-11', n: 11, name: 'Winter Lamps', stretch: 'middle', season: 'winter', time: 'night', teamSize: 4, steam: 'strong', wind: 'normal', seed: 111, par: 14, unlock: null },
  { id: 'story-12', n: 12, name: 'Battle for the Valley', stretch: 'north', season: 'fall', time: 'sunset', teamSize: 4, steam: 'on', wind: 'gusty', seed: 112, par: 14, unlock: null, rounds: 3 },
  { id: 'practice', name: 'Practice Range', stretch: 'middle', season: 'summer', time: 'day', teamSize: 3, steam: 'on', wind: 'light', seed: 120, par: 0, practice: true },
];

const ftAt = (() => {
  const pts = profile.battleLine.pts.filter((p) => Number.isFinite(p.z)).map((p) => [p.d, p.z / 0.3048]);
  // smooth with a 90 m moving average so DEM noise (roads, cuts) doesn't make cliffs
  const sm = pts.map((p, i) => { let s = 0, n = 0; for (let k = -4; k <= 4; k++) { const q = pts[i + k]; if (q) { s += q[1]; n++; } } return [p[0], s / n]; });
  return (d) => {
    let i = 1;
    while (i < sm.length - 1 && sm[i][0] < d) i++;
    const a = sm[i - 1], b = sm[i], u = (d - a[0]) / (b[0] - a[0] || 1);
    return a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, u));
  };
})();
const ROW_D = 1122;
const xOfD = (d) => ((d - D0) / (D1 - D0)) * W;
const FLOOR_X = Math.round(xOfD(ROW_D));

function bakeGround(spec, rng) {
  const s = STRETCH[spec.stretch], g = [];
  // gentle seeded wobble (two sines) so levels on the same stretch differ
  const p1 = rng.range(0, 6.28), p2 = rng.range(0, 6.28), a1 = rng.range(6, 14), a2 = rng.range(4, 9);
  for (let x = 0; x <= W; x += STEP) {
    const d = D0 + (x / W) * (D1 - D0), rel = ftAt(d) - ROW_FT;
    const mul = x < FLOOR_X ? s.west : s.east;
    let y = FLOOR_Y - Math.max(0, rel) * PX_PER_FT * mul;
    const far = Math.min(1, Math.abs(x - FLOOR_X) / 300);
    y += far * (Math.sin(x / 140 + p1) * a1 + Math.sin(x / 61 + p2) * a2);
    // a rounded valley floor where the Row stands: flat for 110 units each side, then a smooth fillet
    const dx = Math.abs(x - FLOOR_X);
    if (dx < 110) y = FLOOR_Y;
    else if (dx < 230) { const u = (dx - 110) / 120, k = u * u * (3 - 2 * u); y = FLOOR_Y + (y - FLOOR_Y) * k; }
    g.push(Math.round(y * 10) / 10);
  }
  // Fair play zone: the families live within West Mountain's crest distance of the valley, so Hot Springs
  // Mountain's near slope mirrors West Mountain's there; beyond it the real profile rises to the tower crest.
  const iF = Math.round(FLOOR_X / STEP);
  let iWc = 0; for (let i = 0; i < iF; i++) if (g[i] < g[iWc]) iWc = i;
  const dc = iF - iWc, ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = iF + 1; i < g.length; i++) {
    const d = i - iF, west = d <= dc ? g[iF - d] : g[iWc] - (d - dc) * STEP * 0.12;
    const b = ss(dc - 8, dc + 34, d);
    g[i] = Math.round((west * (1 - b) + g[i] * b) * 10) / 10;
  }
  // keep the far edges from dropping into bowls behind each crest
  const crestW = g.slice(0, Math.floor(FLOOR_X / STEP)).reduce((a, b) => Math.min(a, b));
  const crestE = g.slice(Math.floor(FLOOR_X / STEP)).reduce((a, b) => Math.min(a, b));
  const iW = g.indexOf(crestW), iE = g.lastIndexOf(crestE);
  for (let i = 0; i < iW; i++) g[i] = Math.min(g[i], crestW + 40 + (iW - i) * 0.15);
  for (let i = iE + 1; i < g.length; i++) g[i] = Math.min(g[i], crestE + 40 + (i - iE) * 0.15);
  return { g, crestX: [iW * STEP, iE * STEP] };
}

const groundAt = (g, x) => { const f = Math.max(0, Math.min(g.length - 1.001, x / STEP)), i = Math.floor(f), u = f - i; return g[i] * (1 - u) + g[i + 1] * u; };

// species recipes: trunk height, branch count, angles (toward the valley = "in")
const SPECIES = {
  oak: { h: [230, 290], w: [16, 20], n: [4, 5], len: [80, 120], bw: [8, 10], rise: [12, 32], crown: 46, sub: 0.6 },
  hickory: { h: [250, 310], w: [14, 17], n: [4, 5], len: [70, 105], bw: [7, 9], rise: [18, 38], crown: 40, sub: 0.45 },
  pine: { h: [290, 340], w: [13, 15], n: [5, 6], len: [55, 85], bw: [6, 8], rise: [-6, 10], crown: 34, sub: 0.15 },
  sweetgum: { h: [240, 290], w: [14, 16], n: [4, 5], len: [70, 100], bw: [7, 9], rise: [20, 40], crown: 42, sub: 0.4 },
};
const MIX = { 0: ['oak', 'hickory', 'pine', 'sweetgum'], 1: ['pine', 'oak', 'hickory', 'oak'] };

function bakeTree(id, team, x, baseY, species, rng) {
  const sp = SPECIES[species], inward = team === 0 ? 1 : -1;
  const h = rng.range(...sp.h), trunk = { h: Math.round(h), w: Math.round(rng.range(...sp.w)), lean: Math.round(rng.range(-3, 3) * 10) / 10 };
  const branches = [];
  const n = rng.int(sp.n[1] - sp.n[0] + 1) + sp.n[0];
  for (let i = 0; i < n; i++) {
    const t = 0.42 + (i / (n - 1 || 1)) * 0.48 + rng.range(-0.03, 0.03);
    const side = i % 2 === 0 ? inward : -inward;
    const rise = rng.range(...sp.rise);
    const a = side > 0 ? rise : 180 - rise;
    const len = Math.round(rng.range(...sp.len) * (1 - (t - 0.42) * 0.5));
    branches.push({ parent: -1, t: Math.round(t * 1000) / 1000, a: Math.round(a), len, w: Math.round(rng.range(...sp.bw)), leaves: species === 'pine' ? true : rng.chance(0.55) });
    if (rng.chance(sp.sub) && len > 70) {
      const sub = { parent: branches.length - 1, t: 0.6, a: Math.round(a + (side > 0 ? 1 : -1) * rng.range(-10, 18)), len: Math.round(len * rng.range(0.45, 0.6)), w: Math.max(5, Math.round(branches[branches.length - 1].w * 0.7)), leaves: true };
      branches.push(sub);
    }
  }
  return { id, team, x: Math.round(x), baseY: Math.round(baseY), species, trunk, branches, crown: sp.crown };
}

// Bake, then prove it with the real checker; re-roll the layout seed until every squirrel has a throw.
export async function bakeChecked(spec) {
  const { checkLevel } = await import('../check-levels.mjs');
  for (let k = 0; k < 12; k++) {
    const L = bakeLevel({ ...spec, seed: spec.seed + k * 1000 });
    if (!checkLevel(L).length || L.practice) return L;
    console.log(`  ${spec.id}: layout seed ${spec.seed + k * 1000} failed the check; re-rolling`);
  }
  throw new Error('no playable layout for ' + spec.id);
}

export function bakeLevel(spec) {
  const rng = makeRng(spec.seed);
  const { g, crestX } = bakeGround(spec, rng);
  const zones = [[40, FLOOR_X - 130], [FLOOR_X + 130, W - 40]];
  void zones;
  // Trees on each family's valley-facing slope. Fairness: the Rustlers' trees are generated on West Mountain,
  // then each is mirrored onto Hot Springs Mountain at the SAME ground elevation (same branch structure, mirrored
  // angles; species differ only in look), so neither family gets more shelter or height from the generator.
  const n = spec.teamSize >= 4 ? 4 : 3;
  const trees = [];
  const a0 = Math.max(170, crestX[0] - 230), b0 = FLOOR_X - 300;
  for (let i = 0; i < n; i++) {
    const x = a0 + ((b0 - a0) * (i + 0.5)) / n + rng.range(-25, 25);
    trees.push(bakeTree(trees.length, 0, x, groundAt(g, x) + 6, MIX[0][(i + spec.seed) % 4], rng));
  }
  for (let i = 0; i < n; i++) {
    const src = trees[i], x = 2 * FLOOR_X - src.x; // exact mirror across the valley
    const sp = MIX[1][(i + spec.seed) % 4];
    trees.push({ ...JSON.parse(JSON.stringify(src)), id: trees.length, team: 1, x: Math.round(x), baseY: Math.round(groundAt(g, x) + 6), species: sp,
      crown: SPECIES[sp].crown, trunk: { ...src.trunk, lean: -src.trunk.lean },
      branches: src.branches.map((b) => ({ ...b, a: 180 - b.a, leaves: sp === 'pine' ? true : b.leaves })) });
  }
  const rocks = [];
  for (const cx of crestX) for (let k = 0; k < 3; k++) { const x = cx + rng.range(-160, 160); rocks.push({ x: Math.round(x), y: Math.round(groundAt(g, x) + rng.range(18, 40)), r: Math.round(rng.range(18, 34)) }); }
  const level = {
    id: spec.id, n: spec.n || 0, name: spec.name, stretch: spec.stretch, stretchLabel: STRETCH[spec.stretch].label, row: STRETCH[spec.stretch].row,
    season: spec.season, time: spec.time, teamSize: spec.teamSize, steam: spec.steam, wind: spec.wind, rounds: spec.rounds || 1, par: spec.par,
    unlock: spec.unlock ?? null, tutorial: !!spec.tutorial, practice: !!spec.practice,
    W, H, groundStep: STEP, ground: g, dirtDepth: 150, floor: [FLOOR_X - 100, FLOOR_X + 100], floorX: FLOOR_X, floorY: FLOOR_Y, crestX,
    steamCol: null, steamW: 150, rocks, trees, zones,
    // leaf piles sit on the flat valley floor, one at each foot
    leafPiles: [{ x: FLOOR_X - 66, y: FLOOR_Y }, { x: FLOOR_X + 66, y: FLOOR_Y }],
    tower: { x: crestX[1], y: Math.round(groundAt(g, crestX[1])) },
    backdrop: `${spec.stretch}-${spec.season}-${spec.time}`,
    seed: spec.seed,
  };
  level.steam = { x: FLOOR_X, w: 260 };
  delete level.steamCol; delete level.steamW;
  // spawns: branch midpoints spread across the family's trees, generated in mirrored PAIRS (the same branch of a
  // tree and of its mirror), so both families start equally exposed
  const st = initTreeState(level);
  const pairs = [];
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < n; i++) {
    const g0 = treeGeom(level.trees[i], st[i]), g1 = treeGeom(level.trees[i + n], st[i + n]);
    // squirrels love the treetops: highest primary branches first (open to the sky, so throws can reach them)
    const cands = g0.segs.filter((sg) => sg.parent === -1 && Math.abs(Math.sin(Math.atan2(sg.y1 - sg.y0, sg.x1 - sg.x0))) < 0.6).sort((a, b) => Math.min(a.y0, a.y1) - Math.min(b.y0, b.y1));
    const sg = cands[pass % Math.max(1, cands.length)];
    if (!sg) continue;
    const at = (gg) => { const m = gg.segs[sg.id]; return { x: Math.round(m.x0 + (m.x1 - m.x0) * 0.55), y: Math.round(m.y0 + (m.y1 - m.y0) * 0.55 - m.w / 2), kind: 'branch' }; };
    const p0 = at(g0), p1 = at(g1);
    if (!pairs.some((q) => Math.hypot(q[0].x - p0.x, q[0].y - p0.y) < 30)) pairs.push([p0, p1]);
  }
  level.spawns = [pairs.map((q) => q[0]), pairs.map((q) => q[1])];
  if (!level.practice) orderSpawns(level);
  if (level.practice) {
    level.spawns[1] = [0, 1, 2].map((k) => { const x = FLOOR_X + 360 + k * 260; return { x, y: Math.round(groundAt(g, x)), kind: 'ground' }; });
    level.targets = [0, 1, 2, 3].map((k) => { const x = FLOOR_X + 240 + k * 240; return { x, y: Math.round(groundAt(g, x) - 60), r: 26 }; });
    // an open range: no trees on the far mountain, so every target and dummy can be reached
    level.trees = level.trees.filter((d) => d.team === 0);
  }
  return level;
}

// Put spawn pairs where BOTH families have a clear acorn throw at a rival (at every wind) first.
function orderSpawns(level) {
  const sim = new Sim(level, { seed: 1, teamSize: 4, human: [true, true] });
  const can = (team, sp) => {
    const node = sim.nodeNear(team, sp), q = sim.b.squirrels.find((x) => x.team === team);
    const save = { x: q.x, y: q.y, perch: q.perch };
    q.x = node.x; q.y = node.y; q.perch = node.id; sim.b.turn.team = team; sim.b.turn.sq = q.id;
    let okAll = true;
    for (const w of [-1, 0, 1]) {
      sim.b.wind = w * sim.b.windLevel;
      let ok = false;
      for (let a = 5; a <= 85 && !ok; a += 5) for (let p = 0.3; p <= 1 && !ok; p += 0.035) {
        const im = sim.preview({ nut: 'acorn', angle: a, power: p }).impact;
        if (im) for (const e of sim.b.squirrels) if (e.team !== team && ((im.type === 'squirrel' && im.sq === e.id) || Math.hypot(e.x - im.x, e.y - SQ_UP - im.y) < NUTS.acorn.splashR * 0.7)) { ok = true; break; }
      }
      if (!ok) { okAll = false; break; }
    }
    Object.assign(q, save);
    return okAll;
  };
  const idx = level.spawns[0].map((_, k) => k);
  const good = idx.filter((k) => can(0, level.spawns[0][k]) && can(1, level.spawns[1][k]));
  const order = [...good, ...idx.filter((k) => !good.includes(k))];
  level.spawns = level.spawns.map((list) => order.map((k) => list[k]));
  level.goodSpawns = good.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outDir = path.join(ROOT, 'levels');
  fs.mkdirSync(outDir, { recursive: true });
  const all = {};
  for (const spec of SPECS) {
    const L = await bakeChecked(spec);
    all[L.id] = L;
    fs.writeFileSync(path.join(outDir, `${L.id}.json`), JSON.stringify(L));
    console.log(`${L.id.padEnd(9)} ${L.name.padEnd(24)} floorX ${L.floorX} crests ${L.crestX.join('/')} trees ${L.trees.length} spawns ${L.spawns.map((s) => s.length).join('/')} good pairs ${L.goodSpawns ?? '-'}`);
  }
  fs.writeFileSync(path.join(outDir, 'all.json'), JSON.stringify(all));
  console.log('levels/all.json', (fs.statSync(path.join(outDir, 'all.json')).size / 1024).toFixed(0), 'KB');
}

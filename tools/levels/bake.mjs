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

// Each level is a different spot on the same two mountains: the stretch keeps its backdrop, while the `land`
// recipe sets the relief (mountain height), spread (steep and narrow vs broad), slope features, trees and
// obstacles. Everything is generated on West Mountain and mirrored onto Hot Springs Mountain (fair play).
//   relief, spread: multipliers; features: [{kind: knoll|bench|gully, at: 0..1 of the way crest -> floor, h, w}]
//   (a knoll in front of a family's trees shelters fallen squirrels so well that rounds drag: use sparingly)
//   trees: per family; band: [u0, u1] of the tree zone, crest side first; mix: [west, east] species pairs of the
//   same leaf class; boulders/logs/stumps: counts; stone: boulder colour (sandstone | novaculite)
export const SPECS = [
  { id: 'gray', name: 'Gray box', stretch: 'middle', season: 'summer', time: 'day', teamSize: 3, steam: 'on', wind: 'normal', seed: 11, par: 10,
    land: { trees: 3, mix: [['oak', 'oak'], ['hickory', 'hickory'], ['pine', 'pine']] } },
  { id: 'story-01', n: 1, name: 'Morning on the Row', stretch: 'middle', season: 'summer', time: 'day', teamSize: 2, steam: 'off', wind: 'light', seed: 101, par: 8, unlock: null, tutorial: true,
    land: { relief: 0.9, spread: 1.05, trees: 3, band: [0.2, 1], mix: [['oak', 'oak'], ['hickory', 'hickory']], boulders: 1 } },
  { id: 'story-02', n: 2, name: 'Under the Tower', stretch: 'north', season: 'summer', time: 'day', teamSize: 2, steam: 'weak', wind: 'light', seed: 102, par: 9, unlock: 'chinquapin',
    land: { relief: 1.15, spread: 0.95, trees: 3, band: [0, 0.75], mix: [['pine', 'pine'], ['oak', 'oak'], ['pine', 'redcedar']], features: [{ kind: 'bench', at: 0.62, w: 70 }], boulders: 3, stone: 'novaculite' } },
  { id: 'story-03', n: 3, name: 'Dome at Dusk', stretch: 'middle', season: 'summer', time: 'dusk', teamSize: 3, steam: 'on', wind: 'normal', seed: 103, par: 10, unlock: 'pecan',
    land: { trees: 4, mix: [['sweetgum', 'sweetgum'], ['oak', 'hickory']], features: [{ kind: 'bench', at: 0.45, w: 90 }], stumps: 2, boulders: 1 } },
  { id: 'story-04', n: 4, name: 'Redbud Ridge', stretch: 'south', season: 'spring', time: 'day', teamSize: 3, steam: 'on', wind: 'normal', seed: 104, par: 10, unlock: 'hickory',
    land: { trees: 4, band: [0.15, 1], mix: [['redbud', 'redbud'], ['oak', 'oak'], ['redbud', 'redbud'], ['hickory', 'sweetgum']], features: [{ kind: 'bench', at: 0.55, w: 70 }], boulders: 1 } },
  { id: 'story-05', n: 5, name: 'Valley of Vapors', stretch: 'middle', season: 'spring', time: 'mist', teamSize: 3, steam: 'strong', wind: 'light', seed: 105, par: 11, unlock: 'walnut',
    land: { relief: 0.95, spread: 0.9, trees: 3, band: [0.1, 0.9], mix: [['sweetgum', 'sweetgum'], ['oak', 'oak']], features: [{ kind: 'gully', at: 0.5, h: 44, w: 70 }], logs: 1, boulders: 1 } },
  { id: 'story-06', n: 6, name: 'Magnolia Lamps', stretch: 'north', season: 'summer', time: 'night', teamSize: 3, steam: 'on', wind: 'normal', seed: 106, par: 11, unlock: null,
    land: { relief: 1.05, trees: 3, mix: [['pine', 'pine'], ['oak', 'oak']], boulders: 2 } },
  { id: 'story-07', n: 7, name: 'Fall on the Promenade', stretch: 'south', season: 'fall', time: 'day', teamSize: 3, steam: 'on', wind: 'gusty', seed: 107, par: 12, unlock: 'sweetgum',
    land: { relief: 1, trees: 3, mix: [['hickory', 'hickory'], ['oak', 'oak']], features: [{ kind: 'bench', at: 0.6, w: 70 }], stumps: 1, logs: 1 } },
  { id: 'story-08', n: 8, name: 'Gumball Gulch', stretch: 'middle', season: 'fall', time: 'dusk', teamSize: 3, steam: 'strong', wind: 'normal', seed: 108, par: 12, unlock: null,
    land: { relief: 1.05, spread: 0.95, trees: 4, mix: [['sweetgum', 'sweetgum']], features: [{ kind: 'gully', at: 0.45, h: 45, w: 80 }], logs: 2 } },
  { id: 'story-09', n: 9, name: 'Hedge Apple Harvest', stretch: 'north', season: 'fall', time: 'day', teamSize: 4, steam: 'on', wind: 'normal', seed: 109, par: 13, unlock: 'hedgeapple',
    land: { relief: 1.1, trees: 4, mix: [['osage', 'osage'], ['oak', 'hickory'], ['osage', 'osage'], ['pine', 'pine']], features: [{ kind: 'gully', at: 0.7, h: 30, w: 50 }], stumps: 3, boulders: 1 } },
  { id: 'story-10', n: 10, name: 'First Dusting', stretch: 'south', season: 'winter', time: 'day', teamSize: 4, steam: 'on', wind: 'gusty', seed: 110, par: 13, unlock: null,
    land: { relief: 0.95, spread: 1.05, trees: 4, mix: [['redcedar', 'redcedar'], ['oak', 'oak'], ['redcedar', 'pine'], ['hickory', 'hickory']], boulders: 3 } },
  { id: 'story-11', n: 11, name: 'Winter Lamps', stretch: 'middle', season: 'winter', time: 'night', teamSize: 4, steam: 'strong', wind: 'normal', seed: 111, par: 14, unlock: null,
    land: { relief: 1.1, trees: 5, mix: [['pine', 'pine'], ['redcedar', 'redcedar']], features: [{ kind: 'bench', at: 0.3, w: 70 }, { kind: 'bench', at: 0.68, w: 70 }], boulders: 2 } },
  { id: 'story-12', n: 12, name: 'Battle for the Valley', stretch: 'north', season: 'fall', time: 'sunset', teamSize: 4, steam: 'on', wind: 'gusty', seed: 112, par: 14, unlock: null, rounds: 3,
    land: { relief: 1.25, spread: 0.95, trees: 5, mix: [['oak', 'oak'], ['sweetgum', 'hickory'], ['pine', 'redcedar'], ['snag', 'snag'], ['osage', 'osage']], features: [{ kind: 'knoll', at: 0.4, h: 40, w: 70 }, { kind: 'bench', at: 0.72, w: 70 }], boulders: 2, logs: 1, stumps: 1 } },
  { id: 'practice', name: 'Practice Range', stretch: 'middle', season: 'summer', time: 'day', teamSize: 3, steam: 'on', wind: 'light', seed: 120, par: 0, practice: true,
    land: { trees: 3, mix: [['oak', 'oak'], ['hickory', 'hickory'], ['pine', 'pine']] } },
];
export const LEVEL_REV = 2; // bump when layouts change: saved mid-battle resumes from older layouts are dropped

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
  const s = STRETCH[spec.stretch], g = [], land = spec.land || {};
  const relief = land.relief ?? 1, spread = land.spread ?? 1;
  // gentle seeded wobble (two sines) so levels on the same stretch differ
  const p1 = rng.range(0, 6.28), p2 = rng.range(0, 6.28), a1 = rng.range(6, 14), a2 = rng.range(4, 9);
  for (let x = 0; x <= W; x += STEP) {
    // spread > 1 stretches each slope away from the valley (broader mountains); < 1 squeezes it (steeper)
    const xs = FLOOR_X + (x - FLOOR_X) / spread;
    const d = D0 + (xs / W) * (D1 - D0), rel = ftAt(d) - ROW_FT;
    const mul = x < FLOOR_X ? s.west : s.east;
    let y = FLOOR_Y - Math.max(0, rel) * PX_PER_FT * mul * relief;
    const far = Math.min(1, Math.abs(x - FLOOR_X) / 300);
    y += far * (Math.sin(x / 140 + p1) * a1 + Math.sin(x / 61 + p2) * a2);
    // a rounded valley floor where the Row stands: flat for 110 units each side, then a smooth fillet
    const dx = Math.abs(x - FLOOR_X);
    if (dx < 110) y = FLOOR_Y;
    else if (dx < 230) { const u = (dx - 110) / 120, k = u * u * (3 - 2 * u); y = FLOOR_Y + (y - FLOOR_Y) * k; }
    g.push(Math.round(y * 10) / 10);
  }
  // slope features on West Mountain, between its crest and the valley fillet (the fair zone below mirrors them)
  if (land.features && land.features.length) {
    const iF0 = Math.round(FLOOR_X / STEP);
    let iC = 0; for (let i = 0; i < iF0; i++) if (g[i] < g[iC]) iC = i;
    const xC = iC * STEP, xF = FLOOR_X - 250;
    for (const f of land.features) {
      const cx = xC + (xF - xC) * f.at, w = f.w || 70, h = f.h || 40;
      if (f.kind === 'bench') {
        // a ledge: the slope is held level across the bench, then rejoins smoothly
        const yc = groundAt(g, cx);
        for (let i = 0; i < iF0; i++) {
          const ax = Math.abs(i * STEP - cx); if (ax > w * 1.8) continue;
          const k = ax < w ? 1 : 1 - (ax - w) / (w * 0.8), kk = k * k * (3 - 2 * k);
          g[i] = Math.round((g[i] * (1 - kk) + yc * kk) * 10) / 10;
        }
      } else {
        const sign = f.kind === 'gully' ? 1 : -1;
        for (let i = 0; i < iF0; i++) { const u = (i * STEP - cx) / w; if (Math.abs(u) < 3) g[i] = Math.round((g[i] + sign * h * Math.exp(-u * u)) * 10) / 10; }
      }
    }
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

// species recipes: trunk height, branch count, angles (toward the valley = "in"); leaf: broad | ever | none
export const SPECIES = {
  oak: { h: [230, 290], w: [16, 20], n: [4, 5], len: [80, 120], bw: [8, 10], rise: [12, 32], crown: 46, sub: 0.6, leaf: 'broad' },
  hickory: { h: [250, 310], w: [14, 17], n: [4, 5], len: [70, 105], bw: [7, 9], rise: [18, 38], crown: 40, sub: 0.45, leaf: 'broad' },
  pine: { h: [290, 340], w: [13, 15], n: [5, 6], len: [55, 85], bw: [6, 8], rise: [-6, 10], crown: 34, sub: 0.15, leaf: 'ever' },
  sweetgum: { h: [240, 290], w: [14, 16], n: [4, 5], len: [70, 100], bw: [7, 9], rise: [20, 40], crown: 42, sub: 0.4, leaf: 'broad' },
  // eastern redbud: a short, wide understory tree
  redbud: { h: [215, 250], w: [13, 16], n: [3, 4], len: [80, 105], bw: [7, 9], rise: [14, 30], crown: 38, sub: 0.55, leaf: 'broad' },
  // eastern redcedar: an evergreen cone of short, level boughs
  redcedar: { h: [240, 290], w: [13, 16], n: [5, 6], len: [50, 75], bw: [6, 8], rise: [-4, 12], crown: 30, sub: 0.1, leaf: 'ever' },
  // Osage-orange, the hedge apple tree: low, crooked and spreading
  osage: { h: [205, 245], w: [16, 19], n: [4, 5], len: [80, 115], bw: [8, 10], rise: [6, 26], crown: 42, sub: 0.6, leaf: 'broad', lean: 7 },
  // a dead snag: bare, thin branches that crack easily
  snag: { h: [240, 300], w: [12, 15], n: [3, 4], len: [55, 85], bw: [5, 6], rise: [16, 40], crown: 0, sub: 0.2, leaf: 'none' },
};
const DEFAULT_MIX = [['oak', 'pine'], ['hickory', 'oak'], ['pine', 'hickory'], ['sweetgum', 'oak']];
// evergreens carry needles on every bough, broadleaves on about half, snags on none; a mirrored tree keeps its source's
// flags, so both families get the same cover.
const leavesOf = (sp, own) => (SPECIES[sp].leaf === 'ever' ? true : SPECIES[sp].leaf === 'none' ? false : own);

function bakeTree(id, team, x, baseY, species, rng) {
  const sp = SPECIES[species], inward = team === 0 ? 1 : -1, lean = sp.lean || 3;
  const h = rng.range(...sp.h), trunk = { h: Math.round(h), w: Math.round(rng.range(...sp.w)), lean: Math.round(rng.range(-lean, lean) * 10) / 10 };
  const branches = [];
  const n = rng.int(sp.n[1] - sp.n[0] + 1) + sp.n[0];
  for (let i = 0; i < n; i++) {
    const t = 0.42 + (i / (n - 1 || 1)) * 0.48 + rng.range(-0.03, 0.03);
    const side = i % 2 === 0 ? inward : -inward;
    const rise = rng.range(...sp.rise);
    const a = side > 0 ? rise : 180 - rise;
    const len = Math.round(rng.range(...sp.len) * (1 - (t - 0.42) * 0.5));
    branches.push({ parent: -1, t: Math.round(t * 1000) / 1000, a: Math.round(a), len, w: Math.round(rng.range(...sp.bw)), leaves: leavesOf(species, rng.chance(0.55)) });
    if (rng.chance(sp.sub) && len > 70) {
      const sub = { parent: branches.length - 1, t: 0.6, a: Math.round(a + (side > 0 ? 1 : -1) * rng.range(-10, 18)), len: Math.round(len * rng.range(0.45, 0.6)), w: Math.max(5, Math.round(branches[branches.length - 1].w * 0.7)), leaves: leavesOf(species, true) };
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
  const land = spec.land || {}, mix = land.mix || DEFAULT_MIX;
  for (const [a, b] of mix) if (SPECIES[a].leaf !== SPECIES[b].leaf) throw new Error(`${spec.id}: ${a}/${b} are not the same leaf class`);
  const n = land.trees || (spec.teamSize >= 4 ? 4 : 3);
  const trees = [];
  const z0 = Math.max(170, crestX[0] - 230), z1 = FLOOR_X - 300, [u0, u1] = land.band || [0, 1];
  const a0 = z0 + (z1 - z0) * u0, b0 = z0 + (z1 - z0) * u1;
  const pair = (i) => mix[(i + spec.seed) % mix.length];
  for (let i = 0; i < n; i++) {
    const x = a0 + ((b0 - a0) * (i + 0.5)) / n + rng.range(-25, 25) * Math.min(1, (b0 - a0) / n / 110);
    trees.push(bakeTree(trees.length, 0, x, groundAt(g, x) + 6, pair(i)[0], rng));
  }
  for (let i = 0; i < n; i++) {
    const src = trees[i], x = 2 * FLOOR_X - src.x; // exact mirror across the valley
    const sp = pair(i)[1];
    trees.push({ ...JSON.parse(JSON.stringify(src)), id: trees.length, team: 1, x: Math.round(x), baseY: Math.round(groundAt(g, x) + 6), species: sp,
      crown: SPECIES[sp].crown, trunk: { ...src.trunk, lean: -src.trunk.lean },
      branches: src.branches.map((b) => ({ ...b, a: 180 - b.a, leaves: leavesOf(sp, b.leaves) })) });
  }
  const rocks = [];
  for (const cx of crestX) for (let k = 0; k < 3; k++) { const x = cx + rng.range(-160, 160); rocks.push({ x: Math.round(x), y: Math.round(groundAt(g, x) + rng.range(18, 40)), r: Math.round(rng.range(18, 34)) }); }
  // obstacles standing on the slope (solid, never carved), clear of tree roots and of each other, then mirrored
  const used = trees.filter((t) => t.team === 0).map((t) => t.x), slots = [];
  const spot = (minGap) => {
    for (let k = 0; k < 40; k++) {
      const x = rng.range(Math.max(60, crestX[0] - 180), FLOOR_X - 190);
      if (used.some((u) => Math.abs(u - x) < 50) || slots.some((u) => Math.abs(u - x) < minGap)) continue;
      slots.push(x); return x;
    }
    return null;
  };
  const slopeA = (x) => (Math.atan2(groundAt(g, x + 20) - groundAt(g, x - 20), 40) * 180) / Math.PI;
  const boulders = [], logs = [], stumps = [], stone = land.stone || 'sandstone';
  for (let k = 0; k < (land.boulders || 0); k++) { const x = spot(70); if (x == null) continue; const r = rng.range(22, 36); boulders.push({ x, y: groundAt(g, x) + r * 0.35, r, stone }); }
  for (let k = 0; k < (land.logs || 0); k++) { const x = spot(130); if (x == null) continue; const r = rng.range(11, 14); logs.push({ x, y: groundAt(g, x) - r * 0.4, len: rng.range(90, 130), a: slopeA(x), r }); }
  for (let k = 0; k < (land.stumps || 0); k++) { const x = spot(60); if (x == null) continue; stumps.push({ x, y: groundAt(g, x) + 6, h: rng.range(26, 40), r: rng.range(13, 17) }); }
  const mir = (o) => { const x = 2 * FLOOR_X - o.x; return { ...o, x, y: o.y - groundAt(g, o.x) + groundAt(g, x), ...(o.a != null ? { a: -o.a } : {}) }; };
  const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 10) / 10 : v]));
  const both = (list) => [...list, ...list.map(mir)].map(round);
  const level = {
    id: spec.id, n: spec.n || 0, name: spec.name, stretch: spec.stretch, stretchLabel: STRETCH[spec.stretch].label, row: STRETCH[spec.stretch].row,
    season: spec.season, time: spec.time, teamSize: spec.teamSize, steam: spec.steam, wind: spec.wind, rounds: spec.rounds || 1, par: spec.par,
    unlock: spec.unlock ?? null, tutorial: !!spec.tutorial, practice: !!spec.practice,
    W, H, groundStep: STEP, ground: g, dirtDepth: 150, floor: [FLOOR_X - 100, FLOOR_X + 100], floorX: FLOOR_X, floorY: FLOOR_Y, crestX,
    steamCol: null, steamW: 150, rocks, trees, zones, rev: LEVEL_REV,
    boulders: both(boulders), logs: both(logs), stumps: both(stumps),
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
    console.log(`${L.id.padEnd(9)} ${L.name.padEnd(24)} floorX ${L.floorX} crests ${L.crestX.join('/')} minY ${Math.round(Math.min(...L.ground))} trees ${L.trees.filter((t) => t.team === 0).map((t) => t.species).join(',')} obst ${L.boulders.length}b/${L.logs.length}l/${L.stumps.length}s spawns ${L.spawns.map((s) => s.length).join('/')} good pairs ${L.goodSpawns ?? '-'}`);
  }
  fs.writeFileSync(path.join(outDir, 'all.json'), JSON.stringify(all));
  console.log('levels/all.json', (fs.statSync(path.join(outDir, 'all.json')).size / 1024).toFixed(0), 'KB');
}

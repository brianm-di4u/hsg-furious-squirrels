// Furious Squirrels: app shell. Owns the battle Sim, the renderer, HUD and screens, input, the camera director,
// AI turns and saves. The rules live in sim/ (no DOM); this file only drives them.
import { DT, W, NUTS, NUT_ORDER, TEAMS, SQ_UP, ANGLE_MIN, ANGLE_MAX, clamp } from './sim/const.js';
import { Sim, hashBattle } from './sim/battle.js';
import { planTurnGen, planTurn } from './sim/ai.js';
import { Renderer } from './gfx/renderer.js';
import { SKY } from './gfx/looks.js';
import { makeRng } from './rng.js';
import { Hud } from './ui/hud.js';
import { Screens } from './ui/screens.js';
import { initAudio, setAudio, sfx, playTheme, audioState } from './ui/audio.js';
import { loadSave, writeSave, DEFAULT_SAVE } from './save.js';
import { installHooks } from './hooks.js';

/* global LEVELS, FACTS, MANIFEST, SPRITES */
const ALL = typeof LEVELS !== 'undefined' ? LEVELS : {};
const STORY = Object.values(ALL).filter((L) => /^story-/.test(L.id)).sort((a, b) => a.n - b.n);
const GUIDE = { easy: 0.4, medium: 0.22, hard: 0 };

const App = {
  scene: 'boot', ready: false, loading: 0, paused: false, testPaused: false, time: 0, clock: null, steps: 0,
  save: loadSave(), sim: null, level: null, setup: null, vis: {}, showPerches: false, hoverPerch: null,
  aimGuide: null, guideKey: '', aiActive: null, aimAnim: null, pendingEnd: null, held: new Set(), craterN: 0,
  turnStart: 0, tutorialStep: 0, nextSeed: null, art: {}, reduced: false,
};
window.__FS = App;

const canvas = document.getElementById('view');
const renderer = new Renderer(canvas);
App.renderer = renderer;
const hud = new Hud(document.getElementById('hud'), App);
const screens = new Screens(document.getElementById('screens'), App);
App.hud = hud; App.screens = screens;
const live = document.getElementById('live');
const say = (t) => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); App.lastSaid = t; };

// ---------------------------------------------------------------------------------------------------------------
// settings
function applySettings() {
  const s = App.save.settings;
  document.documentElement.style.setProperty('--text-scale', s.textScale || 1);
  const sys = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  App.reduced = s.reducedMotion == null ? sys : !!s.reducedMotion;
  renderer.reduced = App.reduced;
  document.body.classList.toggle('reduced', App.reduced);
  setAudio(s);
}
function persist() { writeSave(App.save); }

// ---------------------------------------------------------------------------------------------------------------
// battles
function storyInventory(n) { return STORY.filter((L) => L.n <= n && L.unlock).map((L) => L.unlock); }

function startBattle(setup) {
  const L = ALL[setup.levelId];
  if (!L) throw new Error('no level ' + setup.levelId);
  const playerTeam = setup.team ?? 0;
  const seed = setup.seed ?? App.nextSeed ?? (Date.now() & 0xffff);
  const opts = {
    seed, mode: setup.mode, difficulty: setup.difficulty || 'medium', teamSize: setup.size || L.teamSize, rounds: setup.rounds || L.rounds,
    wind: setup.wind || L.wind, steam: setup.steam || L.steam, loadout: setup.loadout || 'all', unlocked: setup.unlocked,
    playerTeam, human: setup.mode === 'practice' ? [true, false] : [playerTeam === 0, playerTeam === 1],
    practice: setup.mode === 'practice',
  };
  if (setup.loadout === 'acorn') { opts.loadout = 'story'; opts.unlocked = []; }
  if (setup.mode === 'practice') opts.loadout = 'practice';
  App.setup = { ...setup, seed };
  App.sim = setup.battle ? new Sim(L, opts, JSON.parse(JSON.stringify(setup.battle))) : new Sim(L, opts);
  App.level = L;
  enterBattleScene();
}

function enterBattleScene() {
  const L = App.level, sim = App.sim;
  renderer.setLevel(L, sim);
  loadArt(L);
  App.vis = {}; App.aiActive = null; App.aimAnim = null; App.pendingEnd = null; App.showPerches = false; App.guideKey = '';
  App.craterN = sim.b.craters.length;
  App.scene = 'battle'; document.body.dataset.scene = 'battle';
  App.paused = false;
  screens.hide();
  hud.show(true); hud.barKey = '';
  App.tutorialStep = 0; App.targetsHit = []; App.koHold = 0; App.reframe = false; hud.clearCalls();
  sim.drain();
  playTheme(L.time === 'night' ? 'night' : L.time === 'dusk' || L.time === 'sunset' ? 'dusk' : 'day');
  onTurnStart(true);
  frameCamera(true);
  kick();
}

function onTurnStart(first) {
  const sim = App.sim, q = sim.active();
  App.turnStart = wallNow();
  App.renderer.cam.user = false;
  App.showPerches = false;
  App.guideKey = '';
  if (!q) return;
  const tm = sim.b.teams[q.team];
  if (!first) say(`${q.name}'s turn, ${TEAMS[q.team].name}. Wind ${Math.round(Math.abs(sim.b.wind) * 10)}${sim.b.wind > 0.02 ? ' to the right' : sim.b.wind < -0.02 ? ' to the left' : ''}.`);
  if (tm.human && App.setup.mode === 'story') {
    App.save.resume = { setup: { ...App.setup, battle: null }, battle: sim.toJSON() };
    persist();
  }
  tutorial();
}

function tutorial() {
  if (!App.level || !App.level.tutorial || !App.save.settings.tutorial) { hud.hint(''); return; }
  const tips = ['Drag back from anywhere, like a slingshot, to aim. Let go to throw!', 'Nice! Wind (top) bends your throw. Press Move to scamper to another branch.', 'Knock every rival out of the trees to win the round.'];
  hud.hint(tips[Math.min(App.tutorialStep, tips.length - 1)] || '');
}

function wallNow() { return performance.now() / 1000; }

// ---------------------------------------------------------------------------------------------------------------
// player actions
App.pickNut = (k) => {
  const sim = App.sim;
  if (!sim || sim.b.phase !== 'aim' || !humanTurn()) return;
  if (!sim.canUse(sim.b.turn.team, k)) return;
  sim.setAim({ nut: k }); App.guideKey = ''; sfx('ui'); kick();
};
function humanTurn() {
  const b = App.sim.b;
  if (App.aiActive && (App.aiActive.n !== b.turn.n || App.aiActive.team !== b.turn.team)) App.aiActive = null;
  return b.teams[b.turn.team].human && !App.aiActive;
}
function throwNow() {
  const sim = App.sim;
  if (!sim || sim.b.phase !== 'aim' || !humanTurn() || screens.cur) return false;
  App.showPerches = false;
  const ok = sim.throwNut({});
  if (ok) { App.tutorialStep = Math.max(App.tutorialStep, 1); hud.hint(''); }
  kick();
  return ok;
}
function tapNow() {
  const sim = App.sim;
  if (!sim || sim.b.phase !== 'flight') return false;
  if (!sim.b.teams[sim.b.shot ? sim.b.shot.team : sim.b.turn.team].human) return false;
  return sim.tap();
}
function nudgeAim(da, dp) {
  const sim = App.sim;
  if (!sim || sim.b.phase !== 'aim' || !humanTurn()) return;
  const a = sim.b.teams[sim.b.turn.team].aim;
  sim.setAim({ angle: a.angle + da, power: a.power + dp });
  App.guideKey = ''; kick();
}
function toggleMove(on) {
  const sim = App.sim;
  if (!sim || sim.b.phase !== 'aim' || !humanTurn()) return;
  App.showPerches = on ?? !App.showPerches;
  if (App.showPerches) { const q = sim.active(); App.renderer.cam.set(q.x, q.y - 60, Math.max(App.renderer.cam.zoom, Math.min(1, App.renderer.cam.vw / 700)), false); App.renderer.cam.user = true; }
  kick();
}
function stepPerch(dx, dy) {
  // keyboard scamper: the neighbouring node in the pressed direction
  const sim = App.sim, q = sim && sim.active();
  if (!q || !humanTurn() || sim.b.phase !== 'aim') return;
  const g = sim.graphs[q.team], edges = g.edges.get(q.perch) || [];
  let best = null, bs = 0;
  for (const e of edges) {
    const n = g.byId.get(e.to), vx = n.x - q.x, vy = n.y - q.y, l = Math.hypot(vx, vy) || 1;
    const s = (vx * dx + vy * dy) / l;
    if (s > bs + 0.3 && e.d <= sim.b.turn.stamina) { bs = s; best = n; }
  }
  if (best) sim.move(best.id);
  kick();
}

App.onHud = (a) => {
  if (a === 'throw') throwNow();
  else if (a === 'move') toggleMove();
  else if (a === 'cam') { App.renderer.cam.user = false; frameCamera(false); kick(); }
  else if (a === 'pause') pauseGame();
};

function pauseGame() {
  if (App.scene !== 'battle' || screens.cur) return;
  App.paused = true; screens.show('pause'); kick();
}

// ---------------------------------------------------------------------------------------------------------------
// menus
App.onMenu = (act, d) => {
  sfx('ui');
  const s = App.save;
  switch (act) {
    case 'story':
      if (s.story.team == null) return screens.show('pickTeam', { next: 'story' });
      return screens.show('story', { levels: STORY });
    case 'team': s.story.team = +d.v; persist(); return screens.show('story', { levels: STORY });
    case 'switchTeam': return screens.show('pickTeam', { next: 'story' });
    case 'play': {
      const L = ALL[d.v];
      if (!L) return;
      if (L.practice) return App.onMenu('practice', {});
      if (/^story-/.test(L.id)) return startBattle({ mode: 'story', levelId: L.id, team: s.story.team ?? 0, difficulty: s.settings.difficulty, loadout: 'story', unlocked: storyInventory(L.n) });
      return startBattle({ mode: 'quick', levelId: L.id, team: s.quick.team });
    }
    case 'quick': return screens.show('quick', { levels: STORY });
    case 'qset': s.quick[d.k] = /^(team|size|rounds)$/.test(d.k) ? +d.v : d.v; persist(); return screens.refresh();
    case 'quickGo': { const q = s.quick; return startBattle({ mode: 'quick', levelId: q.level, team: q.team, size: q.size, rounds: q.rounds, wind: q.wind, steam: q.steam, loadout: q.loadout, difficulty: q.difficulty, unlocked: storyInventory(s.story.unlocked) }); }
    case 'practice': return startBattle({ mode: 'practice', levelId: 'practice', team: 0 });
    case 'help': return screens.show('help', { from: screens.cur });
    case 'settings': return screens.show('settings', { from: screens.cur === 'pause' || App.scene === 'battle' ? 'pause' : 'title' });
    case 'credits': return screens.show('credits');
    case 'set': {
      const v = d.v === 'true' ? true : d.v === 'false' ? false : d.v === 'auto' && d.k === 'reducedMotion' ? null : isNaN(+d.v) || d.v === '' ? d.v : +d.v;
      s.settings[d.k] = v; persist(); applySettings(); App.guideKey = '';
      return screens.refresh();
    }
    case 'resetProgress': return screens.show('confirmReset');
    case 'resetYes': { const keep = s.settings; App.save = DEFAULT_SAVE(); App.save.settings = keep; persist(); return screens.show('settings'); }
    case 'back':
      if (App.scene === 'battle') return screens.show('pause');
      return showTitle();
    case 'resume': App.paused = false; screens.hide(); kick(); return;
    case 'restart': return startBattle({ ...App.setup, battle: null, seed: undefined });
    case 'again': return startBattle({ ...App.setup, battle: null, seed: undefined });
    case 'menu': s.resume = null; persist(); return showTitle();
    case 'resumeBattle': { const r = s.resume; if (r) return startBattle({ ...r.setup, battle: r.battle }); return; }
    case 'buy': { const r = App.sim.buy(App.sim.b.teams.findIndex((t) => t.human), d.kind); if (r.ok) sfx('buy'); return screens.refresh(); }
    case 'nextRound': aiShop(); App.sim.continueBattle(); App.sim.drain(); screens.hide(); renderer.setLevel(App.level, App.sim); App.vis = {}; App.craterN = 0; onTurnStart(false); frameCamera(true); kick(); return;
    case 'locked': return;
    default: return;
  }
};

function showTitle() {
  App.scene = 'title'; document.body.dataset.scene = 'title';
  hud.show(false);
  // a living battlefield behind the title
  const L = ALL['story-01'] || Object.values(ALL)[0];
  App.level = L; App.sim = new Sim(L, { seed: 5, teamSize: 3, human: [false, false] }); App.setup = { mode: 'title', levelId: L.id };
  renderer.setLevel(L, App.sim); loadArt(L);
  App.vis = {}; App.aiActive = null; App.paused = false;
  renderer.cam.frame(0, 330, W, 1110, 0, true);
  screens.show('title'); decorateScreen();
  if (App.save.resume) {
    const nav = screens.root.querySelector('.menu');
    const b = document.createElement('button'); b.className = 'btn teal'; b.type = 'button'; b.textContent = 'Resume battle'; b.dataset.act = 'resumeBattle';
    b.addEventListener('click', () => App.onMenu('resumeBattle', {}));
    nav.insertBefore(b, nav.children[1]);
  }
  playTheme('title');
  kick();
}

function aiShop() {
  const b = App.sim.b;
  b.teams.forEach((tm, t) => {
    if (tm.human) return;
    const pref = ['walnut', 'pecan', 'chinquapin', 'sweetgum', 'hedgeapple', 'hickory'];
    for (let pass = 0; pass < 3; pass++) for (const k of pref) App.sim.buy(t, k);
  });
}

function battleOver() {
  const sim = App.sim, b = sim.b, res = b.result, L = App.level, s = App.save;
  const me = b.teams.findIndex((t) => t.human);
  const win = res.battleWinner === me;
  const myStats = b.teams[me].stats;
  let stars = null, unlock = null, next = null;
  if (App.setup.mode === 'story') {
    const outs = b.squirrels.filter((q) => q.team === me && q.out).length, myTurns = Math.ceil(b.turn.n / 2);
    stars = win ? 1 + (outs === 0 ? 1 : 0) + (myTurns <= L.par ? 1 : 0) : 0;
    s.story.stars[L.id] = Math.max(s.story.stars[L.id] || 0, stars);
    if (win && L.n >= s.story.unlocked && L.n < STORY.length) { s.story.unlocked = L.n + 1; const nl = STORY[L.n]; unlock = nl && nl.unlock; }
    if (win && STORY[L.n]) next = STORY[L.n].id;
    s.resume = null;
  }
  if (App.setup.mode !== 'practice') { s.stats.battles++; if (win) s.stats.wins++; }
  s.stats.kos += myStats.kos; s.stats.bestShot = Math.max(s.stats.bestShot, myStats.best);
  persist();
  sfx(win || App.setup.mode === 'practice' ? 'win' : 'lose');
  screens.show('results', {
    win, practice: App.setup.mode === 'practice', stars, unlock, next,
    winnerName: res.battleWinner >= 0 && App.setup.mode !== 'practice' ? TEAMS[res.battleWinner].name : '',
    stats: myStats, turns: b.turn.n, acorns: b.teams[me].acorns, fact: pickFact(L), me, winner: res.battleWinner,
  });
  decorateScreen();
  say(win ? 'Victory!' : 'Battle over.');
}

function pickFact(L) {
  if (typeof FACTS === 'undefined') return null;
  const land = FACTS.landmarks.filter((f) => f.stretch === L.stretch || f.stretch === 'any');
  const nat = FACTS.nature.filter((f) => f.season === L.season || f.season === 'any');
  const pool = [...land.map((f) => ({ ...f, kind: 'land' })), ...nat.map((f) => ({ ...f, kind: 'nature' }))];
  if (!pool.length) return null;
  const f = pool[(L.n * 7 + App.save.stats.battles * 3) % pool.length];
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  // skip the short answer when the explanation already states it
  const says = f.kind === 'land' && f.text.toLowerCase().includes(String(f.a).toLowerCase().split(' ')[0]);
  const html = f.kind === 'land' ? `<p><b>${esc(f.q)}</b> ${says ? '' : esc(f.a) + '. '}${esc(f.text)}</p>` : `<p>${esc(f.text)}</p>`;
  return { id: f.id, html, source: esc(f.source) };
}

// ---------------------------------------------------------------------------------------------------------------
// camera director
function overviewBox() {
  const L = App.level, sim = App.sim;
  let top = Infinity;
  for (const g of sim.geoms) for (const c of g.canopies) top = Math.min(top, c.y - c.r);
  top = Math.min(top, L.tower.y - 330);
  return { x0: 20, y0: top - 40, x1: W - 20, y1: L.floorY + 10 };
}
function frameCamera(snap) {
  const cam = renderer.cam, sim = App.sim, b = sim.b, box = overviewBox();
  const fit = Math.min(cam.vw / (box.x1 - box.x0), cam.vh / (box.y1 - box.y0 + 160));
  const q = sim.active();
  if (b.phase === 'flight' && b.nuts.length) {
    const n = b.nuts[0];
    if (fit >= 0.36) {
      const x0 = Math.min(box.x0, n.x - 80), x1 = Math.max(box.x1, n.x + 80), y0 = Math.min(box.y0, n.y - 120), y1 = Math.max(box.y1, n.y + 80);
      cam.frame(x0, y0, x1, y1, 30, snap);
    } else cam.set(n.x, n.y + 60, Math.max(cam.minZoom(), Math.min(0.32, cam.vw / 1200)), snap);
    return;
  }
  if (sim.b.practice && fit < 0.36 && q) {
    const T = App.level.targets; cam.frame(q.x - 120, q.y - 160, T[1].x + 60, App.level.floorY - 40, 4, false);
    cam.ty = App.level.floorY - 30 - (cam.vh / 2 - 240) / cam.tz; if (snap) cam.snap(); return;
  }
  if (fit >= 0.36 || !q || App.scene !== 'battle') { cam.frame(box.x0, box.y0, box.x1, box.y1, 0, snap); cam.ty += 50 / cam.tz; if (snap) cam.snap(); return; }
  // phones: frame the active squirrel and the first part of its throw
  const span = 820, cx = q.x + q.facing * 150;
  cam.set(cx, q.y + 170, cam.vw / span, snap);
}

// ---------------------------------------------------------------------------------------------------------------
// input
const ptrs = new Map();
let drag = null, pinch = null;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  if (App.scene !== 'battle' || screens.cur) return;
  canvas.setPointerCapture && (() => { try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* synthetic */ } })();
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const sim = App.sim, b = sim.b;
  if (ptrs.size === 2) { const [p1, p2] = [...ptrs.values()]; pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), cx: (p1.x + p2.x) / 2, cy: (p1.y + p2.y) / 2 }; drag = null; return; }
  if (e.button === 1 || e.button === 2) { drag = { pan: true, x: e.clientX, y: e.clientY }; return; }
  if (b.phase === 'flight') { if (tapNow()) kick(); return; }
  if (b.phase !== 'aim' || !humanTurn()) { drag = { pan: true, x: e.clientX, y: e.clientY }; return; }
  if (App.showPerches) {
    const id = perchAt(e.clientX, e.clientY);
    if (id) { sim.move(id); sfx('chitter', sim.b.turn.team); App.guideKey = ''; kick(); return; }
    drag = { pan: true, x: e.clientX, y: e.clientY }; return;
  }
  drag = { aim: true, x0: e.clientX, y0: e.clientY, moved: false, a0: { ...b.teams[b.turn.team].aim } };
});
canvas.addEventListener('pointermove', (e) => {
  if (!ptrs.has(e.pointerId)) { if (App.showPerches && App.scene === 'battle') { const h = perchAt(e.clientX, e.clientY); if (h !== App.hoverPerch) { App.hoverPerch = h; kick(); } } return; }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const cam = renderer.cam;
  if (pinch && ptrs.size >= 2) {
    const [p1, p2] = [...ptrs.values()], d = Math.hypot(p1.x - p2.x, p1.y - p2.y), cx = (p1.x + p2.x) / 2, cy = (p1.y + p2.y) / 2;
    cam.zoomAt(d / pinch.d, cx, cy); cam.panBy(cx - pinch.cx, cy - pinch.cy);
    pinch = { d, cx, cy }; kick(); return;
  }
  if (!drag) return;
  if (drag.pan) { cam.panBy(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; kick(); return; }
  if (drag.aim) {
    const tx = drag.x0 - e.clientX, ty = drag.y0 - e.clientY, len = Math.hypot(tx, ty);
    if (len < 12 && !drag.moved) return;
    drag.moved = true;
    const sim = App.sim, q = sim.active(), maxLen = Math.min(cam.vw, cam.vh) * 0.42;
    const ang = (Math.atan2(-ty, tx * q.facing) * 180) / Math.PI;
    sim.setAim({ angle: clamp(Math.round(ang), ANGLE_MIN, ANGLE_MAX), power: clamp(Math.round((len / maxLen) * 100) / 100, 0.05, 1) });
    drag.power = len / maxLen;
    App.guideKey = ''; kick();
  }
});
const endPtr = (e) => {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (!drag) return;
  const d = drag; drag = null;
  if (d.aim && d.moved && (d.power || 0) >= 0.08 && e.type === 'pointerup') throwNow();
  else if (d.aim && d.moved && e.type === 'pointerup') { App.sim.setAim(d.a0); App.guideKey = ''; kick(); }
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => { if (App.scene !== 'battle') return; e.preventDefault(); renderer.cam.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); kick(); }, { passive: false });

function perchAt(sx, sy) {
  const sim = App.sim, q = sim.active();
  if (!q) return null;
  const reach = sim.reach(), g = sim.graphs[q.team], cam = renderer.cam;
  let best = null, bd = Math.max(22, 14 * cam.zoom) ** 2;
  for (const [id] of reach) {
    if (id === q.perch) continue;
    const n = g.byId.get(id), [x, y] = cam.toScreen(n.x, n.y), d = (x - sx) ** 2 + (y - sy) ** 2;
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}

window.addEventListener('keydown', (e) => {
  if (screens.cur) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { e.preventDefault(); screens.nav({ up: e.code === 'ArrowUp', down: e.code === 'ArrowDown', left: e.code === 'ArrowLeft', right: e.code === 'ArrowRight' }); }
    else if (e.code === 'Escape') { e.preventDefault(); if (screens.cur === 'pause') App.onMenu('resume', {}); else screens.nav({ cancel: true }); }
    return;
  }
  if (App.scene !== 'battle') return;
  const big = e.shiftKey ? 5 : 1;
  let used = true;
  switch (e.code) {
    case 'ArrowLeft': nudgeAim(big, 0); break;
    case 'ArrowRight': nudgeAim(-big, 0); break;
    case 'ArrowUp': nudgeAim(0, big / 100); break;
    case 'ArrowDown': nudgeAim(0, -big / 100); break;
    case 'Space': case 'Enter': case 'NumpadEnter':
      if (e.repeat) break;
      if (App.sim.b.phase === 'flight') tapNow(); else throwNow();
      break;
    case 'KeyM': toggleMove(); break;
    case 'KeyA': stepPerch(-1, 0); break;
    case 'KeyD': stepPerch(1, 0); break;
    case 'KeyW': stepPerch(0, -1); break;
    case 'KeyS': stepPerch(0, 1); break;
    case 'KeyQ': case 'KeyE': cycleNut(e.code === 'KeyE' ? 1 : -1); break;
    case 'KeyZ': renderer.cam.zoomAt(1.15, renderer.cam.vw / 2, renderer.cam.vh / 2); break;
    case 'KeyX': renderer.cam.zoomAt(1 / 1.15, renderer.cam.vw / 2, renderer.cam.vh / 2); break;
    case 'KeyC': App.onHud('cam'); break;
    case 'Escape': case 'KeyP': pauseGame(); break;
    default: {
      const k = NUT_ORDER.find((n) => NUTS[n].key === e.key);
      if (k) App.pickNut(k); else used = false;
    }
  }
  if (used) { e.preventDefault(); kick(); }
});
function cycleNut(dir) {
  const sim = App.sim, team = sim.b.turn.team, list = NUT_ORDER.filter((k) => sim.canUse(team, k));
  const i = list.indexOf(sim.b.teams[team].aim.nut);
  App.pickNut(list[(i + dir + list.length) % list.length]);
}

const padPrev = {};
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p || !p.connected) continue;
    const bt = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
    const now = { a: bt(0), b: bt(1), lb: bt(4), rb: bt(5), start: bt(9), up: bt(12), down: bt(13), left: bt(14), right: bt(15) };
    const prev = padPrev[p.index] || {}, edge = (k) => now[k] && !prev[k];
    if (screens.cur) {
      const m = { up: edge('up') || (p.axes[1] < -0.6 && !prev.ay), down: edge('down') || (p.axes[1] > 0.6 && !prev.ay), left: edge('left'), right: edge('right'), cancel: edge('b') };
      if (m.up || m.down || m.left || m.right || m.cancel) screens.nav(m);
      if (edge('a') && document.activeElement && document.activeElement.click) document.activeElement.click();
    } else if (App.scene === 'battle') {
      if (Math.abs(p.axes[0]) > 0.2) nudgeAim(-p.axes[0] * 1.2, 0);
      if (Math.abs(p.axes[1]) > 0.2) nudgeAim(0, -p.axes[1] * 0.012);
      if (edge('a')) { if (App.sim.b.phase === 'flight') tapNow(); else throwNow(); }
      if (edge('lb')) cycleNut(-1);
      if (edge('rb')) cycleNut(1);
      if (edge('left')) stepPerch(-1, 0);
      if (edge('right')) stepPerch(1, 0);
      if (edge('start')) pauseGame();
    }
    now.ay = Math.abs(p.axes[1]) > 0.6;
    padPrev[p.index] = now;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------------
// art
// the painted soil texture for the terrain (once); repaints the current battlefield when it arrives
function loadSoil() {
  const man = typeof MANIFEST !== 'undefined' ? MANIFEST : null;
  if (!man || !man['tex-soil'] || /[?&]art=0/.test(location.search)) return;
  const img = new Image();
  App.loading++;
  img.src = 'assets/' + man['tex-soil'].file;
  img.decode().then(() => { renderer.terrain.tex = mirrorTile(img); if (App.level && App.sim) { renderer.terrain.paint(App.level, App.sim, makeRng(App.level.seed ^ 0x7e11)); App.craterN = App.sim.b.craters.length; } }).catch(() => {}).finally(() => { App.loading--; kick(); });
}

// a 2x2 mirrored copy of a texture tiles without seams (a painted texture rarely matches at its edges)
function mirrorTile(img) {
  const w = img.naturalWidth, h = img.naturalHeight, cv = document.createElement('canvas');
  cv.width = w * 2; cv.height = h * 2;
  const g = cv.getContext('2d');
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { g.save(); g.translate(sx < 0 ? w * 2 : 0, sy < 0 ? h * 2 : 0); g.scale(sx, sy); g.drawImage(img, 0, 0); g.restore(); }
  return cv;
}

function loadArt(L) {
  renderer.art = null;
  const man = typeof MANIFEST !== 'undefined' ? MANIFEST : null;
  if (!man || /[?&]art=0/.test(location.search)) return;
  // dusk, mist and sunset levels reuse the season's day painting with a code tint
  const ent = man['bd-' + L.backdrop] || man[`bd-${L.stretch}-${L.season}-day`];
  if (!ent) return;
  const file = ent.file, key = file + ':' + L.time;
  if (App.art[key]) { renderer.art = App.art[key]; return; }
  const img = new Image();
  App.loading++;
  img.src = 'assets/' + file;
  img.decode().then(() => { App.art[key] = { img: featherArt(img, L), w: ent.w, h: ent.h }; if (App.level === L) renderer.art = App.art[key]; })
    .catch(() => {}).finally(() => { App.loading--; kick(); });
}

// squirrel sprite atlases (Blender renders packed by tools/pack-sprites.mjs); the vector squirrel is the fallback
function loadSprites() {
  if (typeof SPRITES === 'undefined' || /[?&]art=0/.test(location.search)) return;
  const imgs = [0, 1].map((t) => { const im = new Image(); im.src = `assets/sq-t${t}.webp`; return im; });
  App.loading++;
  Promise.all(imgs.map((im) => im.decode())).then(() => { renderer.sprites = { imgs, meta: SPRITES, rims: imgs.map(rimOf) }; decorateScreen(); }).catch(() => {}).finally(() => { App.loading--; kick(); });
}

// a cream silhouette 2 px larger than each frame, drawn under the sprite (built once; never read back)
function rimOf(img) {
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const g = cv.getContext('2d');
  const cell = SPRITES.cell;
  const ring = (d, col) => {
    const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
    const h = c2.getContext('2d');
    for (let cy = 0; cy < cv.height; cy += cell) for (let cx = 0; cx < cv.width; cx += cell) {
      h.save(); h.beginPath(); h.rect(cx, cy, cell, cell); h.clip();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; h.drawImage(img, cx, cy, cell, cell, cx + Math.cos(a) * d, cy + Math.sin(a) * d, cell, cell); }
      h.restore();
    }
    h.globalCompositeOperation = 'source-in'; h.fillStyle = col; h.fillRect(0, 0, c2.width, c2.height);
    g.drawImage(c2, 0, 0);
  };
  ring(7, 'rgba(58,36,22,0.95)');
  ring(3.5, 'rgba(255,240,210,0.55)');
  return cv;
}

// squirrels on menu screens: canvases marked data-sq="team:pose" get a sprite frame
function decorateScreen() {
  const sp = renderer.sprites;
  if (!sp) return;
  document.querySelectorAll('#screens canvas[data-sq]').forEach((cv) => {
    const [team, pose, flip] = cv.dataset.sq.split(':'), m = sp.meta, f = (m.frames[pose] || m.frames.idle)[0], c = m.cell;
    cv.width = c; cv.height = c;
    const g = cv.getContext('2d');
    if (flip) { g.translate(c, 0); g.scale(-1, 1); }
    g.drawImage(sp.rims[+team], (f % m.cols) * c, Math.floor(f / m.cols) * c, c, c, 0, 0, c, c);
    g.drawImage(sp.imgs[+team], (f % m.cols) * c, Math.floor(f / m.cols) * c, c, c, 0, 0, c, c);
  });
}

// soften a painting's left and right edges once, so the panel melts into the sky (never read back: file:// safe)
function featherArt(img, L) {
  const cv = document.createElement('canvas'), w = img.naturalWidth, h = img.naturalHeight;
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  // aerial haze and the time-of-day tint, painted only onto the picture (source-atop), so the valley reads as distant
  g.globalCompositeOperation = 'source-atop';
  const sky = SKY[L.time] || SKY.day;
  g.fillStyle = sky.low; g.globalAlpha = 0.36; g.fillRect(0, 0, w, h); g.globalAlpha = 1;
  if (sky.tint && !/night/.test(img.src)) { g.fillStyle = sky.tint; g.fillRect(0, 0, w, h); }
  g.globalCompositeOperation = 'destination-in';
  const fe = g.createLinearGradient(0, 0, w, 0);
  fe.addColorStop(0, 'rgba(0,0,0,0)'); fe.addColorStop(0.04, 'rgba(0,0,0,1)'); fe.addColorStop(0.96, 'rgba(0,0,0,1)'); fe.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fe; g.fillRect(0, 0, w, h);
  return cv;
}

// ---------------------------------------------------------------------------------------------------------------
// the frame
let rafId = 0, last = 0, acc = 0, inFrame = false;
function kick() { if (!rafId && !inFrame) { last = performance.now(); rafId = requestAnimationFrame(frame); } }
App.kick = kick;

function stepOnce() {
  const sim = App.sim;
  if (!sim) return;
  sim.step();
  App.steps++;
  checkTargets();
  handleEvents();
}

// Practice targets are not solid: a nut that flies through one counts as a hit
function checkTargets() {
  const L = App.level, sim = App.sim;
  if (!L || !L.targets || !sim.b.nuts.length) return;
  for (const n of sim.b.nuts) for (let i = 0; i < L.targets.length; i++) {
    const T = L.targets[i];
    if (App.targetsHit.includes(i) || Math.hypot(n.x - T.x, n.y - T.y) > T.r + n.r) continue;
    App.targetsHit.push(i);
    renderer.fx.ring(T.x, T.y, 50, '#F2C230'); sfx('cheer');
    hud.call(App.targetsHit.length === L.targets.length ? 'All targets hit!' : 'Bullseye!', 900);
    say(`Target ${App.targetsHit.length} of ${L.targets.length} hit.`);
  }
}
App.stepOnce = stepOnce;

function handleEvents() {
  const sim = App.sim, L = App.level, fx = renderer.fx, cam = renderer.cam, b = sim.b;
  // new craters -> carve the visual terrain at exactly the sim's circles
  while (App.craterN < b.craters.length) { const c = b.craters[App.craterN++]; renderer.carve(c.x, c.y, c.r); }
  for (const ev of sim.drain()) {
    const v = vis(ev.sq);
    switch (ev.type) {
      case 'throw': if (v) { v.pose = 'throw'; v.poseT = 0.35; v.squash = 0.6; } sfx('throw'); break;
      case 'tap': fx.ring(ev.x, ev.y, 40); sfx('tap'); break;
      case 'impact':
        if (ev.burst) { fx.flash(ev.x, ev.y, 70); fx.ring(ev.x, ev.y, 110, '#FFE9A8'); fx.dust(ev.x, ev.y, 30); fx.shards(ev.x, ev.y, 26); fx.leaves(ev.x, ev.y, 30, L.season); fx.chips(ev.x, ev.y, 14); cam.shake = Math.max(cam.shake, 1.1); sfx('burst'); }
        else { fx.dust(ev.x, ev.y, ev.on === 'terrain' ? 16 : 8, L.season === 'winter' && ev.on === 'terrain' ? '#E8ECEA' : '#8A6A44'); fx.ring(ev.x, ev.y, 34, '#FFF6C8'); sfx('thock', ev.kind); if (ev.kind === 'hedgeapple') cam.shake = Math.max(cam.shake, 0.6); }
        if (ev.on === 'wood') { fx.chips(ev.x, ev.y, 12); fx.leaves(ev.x, ev.y, 12, L.season); }
        break;
      case 'thud': fx.dust(ev.x, ev.y, 10); sfx('thud'); break;
      case 'rustle': fx.leaves(ev.x, ev.y, 4, L.season); sfx('rustle'); break;
      case 'hit':
        if (v) { v.pose = 'hit'; v.poseT = 0.55; v.squash = 0.9; v.flash = 0.18; }
        fx.text(ev.x + 36, ev.y - 150, '-' + Math.round(ev.dmg), '#FFE0DA', true); fx.stars(ev.x, ev.y - 20);
        fx.leaves(ev.x, ev.y, 18, L.season); fx.chips(ev.x, ev.y, 8); fx.ring(ev.x, ev.y, 52, '#F2C230');
        if (!App.reduced) { App.hitstop = 0.06; cam.shake = Math.max(cam.shake, 0.35); }
        sfx('boing');
        break;
      case 'wood': fx.chips(ev.x || 0, ev.y || 0, 0); break;
      case 'break': {
        renderer.trees.invalidate(ev.tree);
        fx.leaves(ev.x, ev.y, 16, L.season, L.trees[ev.tree].species); fx.chips(ev.x, ev.y, 12); sfx('crack');
        hud.call('Crack!', 700);
        break;
      }
      case 'dislodge': if (v) { v.pose = 'fall'; v.poseT = 0; } sfx('chitter', sim.b.squirrels.find((q) => q.id === ev.sq).team); break;
      case 'land': if (v) { v.pose = 'idle'; v.squash = 0.7; } fx.dust(ev.x, ev.y, 6); sfx('land'); break;
      case 'ko': {
        const q = sim.b.squirrels.find((s) => s.id === ev.sq);
        if (v) { v.tumble = { from: ev.from, to: ev.to, t: 0 }; v.pose = 'fall'; }
        // follow the tumble into the leaf pile
        if (!sim.b.practice) { const mx = (ev.from.x + ev.to.x) / 2, my = Math.min(ev.from.y, ev.to.y) - 40; cam.set(mx, my, Math.max(cam.zoom, Math.min(1.1, cam.vw / 900)), false); App.koHold = 1.4; }
        fx.stars(ev.from.x, ev.from.y - 30); fx.chips(ev.from.x, ev.from.y, 10); fx.leaves(ev.from.x, ev.from.y - 10, 14, L.season);
        sfx('ko'); setTimeout(() => sfx('cheer'), 500);
        hud.call(`${q.name} is out!`, 1400); say(`${q.name} of the ${TEAMS[q.team].short} is out, tumbling into the leaf pile.`);
        // the round's last knockout plays in slow motion (not with reduced motion)
        if (!App.reduced && sim.alive(q.team) === 0 && !sim.b.practice) App.slowT = 0.9;
        break;
      }
      case 'move': if (v) { v.path = ev.pts.slice(1); v.pathFrom = ev.pts[0]; v.pathT = 0; } break;
      case 'miss': hud.call('Missed!', 600); break;
      case 'turn': onTurnStart(false); if (!(App.koHold > 0)) frameCamera(false); else App.reframe = true; break;
      case 'round': break;
      case 'roundEnd': case 'battleEnd': App.pendingEnd = { type: ev.type, t: wallNow() + 1.3 }; break;
      default: break;
    }
  }
}

function vis(id) {
  if (id == null) return null;
  const q = App.sim.b.squirrels.find((s) => s.id === id);
  if (!q) return null;
  return App.vis[id] || (App.vis[id] = { x: q.x, y: q.y, pose: 'idle', facing: q.facing });
}

function updateVis(dt) {
  const sim = App.sim;
  let busy = false;
  for (const q of sim.b.squirrels) {
    const v = vis(q.id);
    if (v.poseT > 0) { v.poseT -= dt; if (v.poseT <= 0 && v.pose !== 'fall') v.pose = 'idle'; }
    v.squash = Math.max(0, (v.squash || 0) - dt * 4);
    if (v.flash > 0) { v.flash -= dt; busy = true; }
    if (v.squash > 0) busy = true;
    if (v.tumble) {
      const T = v.tumble; T.t += dt / (App.reduced ? 0.4 : 1.2);
      const u = Math.min(1, T.t);
      v.x = T.from.x + (T.to.x - T.from.x) * u; v.y = T.from.y + (T.to.y - T.from.y) * u - Math.sin(u * Math.PI) * 120;
      if (!App.reduced && (T.trail = (T.trail || 0) + dt) > 0.04) { T.trail = 0; renderer.fx.puff(v.x, v.y - 20); }
      v.pose = 'fall';
      if (u >= 1) { v.tumble = null; v.pose = 'out'; renderer.fx.leaves(T.to.x, T.to.y - 6, 18, App.level.season); renderer.fx.dust(T.to.x, T.to.y, 8, '#B07A30'); }
      busy = true; continue;
    }
    if (v.path && v.path.length) {
      const [tx, ty] = v.path[0], dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy), sp = 300 * dt;
      if (Math.abs(dx) > 0.5) v.facing = Math.sign(dx);
      if (d <= sp) { v.x = tx; v.y = ty; v.path.shift(); } else { v.x += (dx / d) * sp; v.y += (dy / d) * sp; }
      v.pose = 'scamper';
      if (!v.path.length) { v.path = null; v.facing = q.facing; v.pose = 'idle'; }
      busy = true; continue;
    }
    if (q.fall) { v.x = q.x; v.y = q.y; v.pose = 'fall'; busy = true; continue; }
    if (!q.out) { v.x = q.x; v.y = q.y; if (v.pose === 'fall' || v.pose === 'out') v.pose = 'idle'; }
    else if (!v.tumble) { v.x = q.x; v.y = q.y; v.pose = 'out'; }
  }
  return busy;
}

function updateAI() {
  const sim = App.sim, b = sim.b;
  if (App.scene !== 'battle' || screens.cur || App.paused || App.testPaused || b.phase !== 'aim' || App.pendingEnd) return false;
  // a plan made for another turn (tests and restarts can switch turns) is dropped
  if (App.aiActive && (App.aiActive.n !== b.turn.n || App.aiActive.team !== b.turn.team || App.aiActive.sim !== sim)) App.aiActive = null;
  if (b.teams[b.turn.team].human) return false;
  const diff = App.setup.difficulty || 'medium';
  if (!App.aiActive) App.aiActive = { gen: planTurnGen(sim, diff), t0: wallNow(), plan: null, done: false, n: b.turn.n, team: b.turn.team, sim };
  const A = App.aiActive;
  if (!A.done) {
    const t0 = performance.now();
    while (performance.now() - t0 < 6) { const r = A.gen.next(); if (r.done) { A.plan = r.value; A.done = true; break; } }
    return true;
  }
  if (!A.plan) { App.aiActive = null; sim.nextTurn(); return true; }
  const now = wallNow();
  if (now < A.t0 + A.plan.think) return true;
  // animate the aim, then throw
  if (!A.anim) A.anim = { t: 0, from: { ...b.teams[b.turn.team].aim } };
  A.anim.t += 1 / 30;
  const u = Math.min(1, A.anim.t / (App.reduced ? 0.2 : 0.6)), e = u * u * (3 - 2 * u);
  sim.setAim({ nut: A.plan.nut, angle: A.anim.from.angle + (A.plan.angle - A.anim.from.angle) * e, power: A.anim.from.power + (A.plan.power - A.anim.from.power) * e });
  if (u >= 1) {
    const plan = A.plan; App.aiActive = null;
    sim.throwNut({ nut: plan.nut, angle: plan.angle, power: plan.power, tapAt: plan.tapAt });
  }
  return true;
}

function frame(now) {
  rafId = 0; inFrame = true;
  try {
    const dtw = Math.min(0.1, (now - last) / 1000); last = now;
    App.time = App.clock != null ? App.clock : App.time + dtw;
    const resized = renderer.resize();
    if (resized && App.sim) frameCamera(true);
    pollPad();
    let busy = false;
    const sim = App.sim;
    if (sim && App.scene === 'battle' && !App.paused && !App.testPaused && !screens.cur) {
      if (App.hitstop > 0) App.hitstop -= dtw;
      if (sim.busy()) {
        acc += App.hitstop > 0 ? 0 : App.slowT > 0 ? dtw * 0.35 : dtw;
        let n = 0;
        while (acc >= DT && n < 12) { stepOnce(); acc -= DT; n++; }
        busy = true;
        if (sim.b.phase === 'flight' && !renderer.cam.user && !(App.koHold > 0)) frameCamera(false);
        if (sim.b.phase === 'flight' && !App.reduced && (App.puffT = (App.puffT || 0) + dtw) > 0.035) { App.puffT = 0; for (const n of sim.b.nuts) if (n.state !== 'husk') renderer.fx.puff(n.x, n.y); }
      } else acc = 0;
      handleEvents(); // moves and test-driven changes emit events outside a sim step
      if (updateAI()) busy = true;
      if (App.pendingEnd && wallNow() >= App.pendingEnd.t) {
        const pe = App.pendingEnd; App.pendingEnd = null;
        if (pe.type === 'battleEnd') battleOver();
        else { const me = sim.b.teams.findIndex((t) => t.human); screens.show('shop', { team: me, round: sim.b.result.round, winner: sim.b.result.winner }); }
      } else if (App.pendingEnd) busy = true;
      // turn timer
      const tt = App.save.settings.turnTimer;
      if (tt && sim.b.phase === 'aim' && humanTurn() && wallNow() - App.turnStart > tt) { sim.nextTurn(); }
    }
    if (App.slowT > 0) { App.slowT -= dtw; busy = true; }
    if (App.koHold > 0) { App.koHold -= dtw; busy = true; if (App.koHold <= 0 && App.reframe) { App.reframe = false; frameCamera(false); } }
    if (sim && updateVis(App.slowT > 0 ? dtw * 0.35 : dtw)) busy = true;
    if (renderer.cam.update(dtw)) busy = true;
    renderer.fx.update(dtw); if (renderer.fx.busy()) busy = true;
    renderer.steam.update(App.reduced ? dtw * 0.5 : dtw);
    if (sim) updateGuide();
    if (sim) renderer.draw(App);
    if (App.scene === 'battle' && sim) { hud.update(); hud.root.style.visibility = screens.cur ? 'hidden' : ''; }
    App.busy = busy;
    // ambient life (tails, clouds, steam) keeps a slow redraw going; isIdle() ignores it
    const ambient = !App.reduced && !document.hidden;
    if (busy || App.loading) { rafId = requestAnimationFrame(frame); }
    else if (ambient) { setTimeout(() => { if (!rafId) { last = performance.now() - 33; rafId = requestAnimationFrame(frame); } }, 33); }
  } catch (err) { showError(err); }
  inFrame = false;
}

function updateGuide() {
  const sim = App.sim, b = sim.b;
  if (App.scene !== 'battle' || b.phase !== 'aim' || !b.teams[b.turn.team].human || App.aiActive) { App.aimGuide = null; return; }
  const set = App.save.settings.aimGuide;
  let frac = App.setup.mode === 'practice' ? 1 : set === 'always' ? 0.6 : set === 'off' ? 0 : GUIDE[App.setup.difficulty || 'medium'] ?? 0.22;
  if (!frac) { App.aimGuide = null; return; }
  const aim = b.teams[b.turn.team].aim, q = sim.active();
  const key = [aim.nut, aim.angle, aim.power, q.x, q.y, b.wind, b.turn.n, frac].join(',');
  if (key === App.guideKey) return;
  App.guideKey = key;
  const pr = sim.preview(aim, { every: 4, squirrels: false });
  const n = Math.max(2, Math.round(pr.pts.length * frac));
  App.aimGuide = { pts: pr.pts.slice(1, n) };
}

function showError(err) {
  console.error(err);
  const el = document.getElementById('boot-error');
  el.hidden = false; el.textContent = 'Something went wrong: ' + (err && err.message ? err.message : err);
}

window.addEventListener('resize', () => kick());
document.addEventListener('visibilitychange', () => kick());

// ---------------------------------------------------------------------------------------------------------------
// boot
installHooks(App, {
  stepOnce, startBattle, showTitle, frameCamera, battleOver, planTurn, hashBattle, ALL, STORY, persist, applySettings,
  idle: () => App.ready && App.loading === 0 && !(App.sim && App.sim.busy() && App.scene === 'battle') && !App.aiActive && !App.pendingEnd && !App.busy,
});
try {
  applySettings();
  loadSprites();
  loadSoil();
  initAudio(App.save.settings);
  showTitle();
  App.ready = true;
  document.body.dataset.ready = '1';
} catch (err) { showError(err); }

export { audioState, SQ_UP };

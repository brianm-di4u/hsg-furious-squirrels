// Furious Squirrels: app shell. Owns the battle Sim, the renderer, HUD and screens, input, the camera director,
// AI turns and saves. The rules live in sim/ (no DOM); this file only drives them.
import { DT, W, NUTS, NUT_ORDER, TEAMS, SQ_UP, ANGLE_MIN, ANGLE_MAX, BIRDS, STEAM_LEVELS, ACORNS, PURSE_CAP, NUT_CAP, clamp } from './sim/const.js';
import { Sim, hashBattle, aiBuys, aiShop } from './sim/battle.js';
import { planTurnGen, planTurn, aiTier, TIERS } from './sim/ai.js';
import { Renderer, ART_BASE } from './gfx/renderer.js';
import { SKY } from './gfx/looks.js';
import { makeRng } from './rng.js';
import { Hud } from './ui/hud.js';
import { Screens, factHtml } from './ui/screens.js';
import { initAudio, wakeAudio, setAudio, sfx, playTheme, playAmbience, ambienceParam, setTension, muffleAudio, audioState, pauseAudio, handleVisibility } from './ui/audio.js';
import { themeFor, sceneFor } from './ui/music.js';
import { loadSave, writeSave, refreshSave, beginBattleSave, takeSaveNotice, storageWorks, starTiers, DEFAULT_SAVE, TIP_IDS } from './save.js';
import { installHooks } from './hooks.js';
import { dayKey, dailyPlan, recordDaily, liveStreak } from './daily.js';
import { blurbFor, resultLine, LEVEL_FACTS, TAUNTS, GROANS, koAllowed, starsFor, parFor } from './story.js';

/* global LEVELS, FACTS, MANIFEST, SPRITES */
const ALL = typeof LEVELS !== 'undefined' ? LEVELS : {};
const STORY = Object.values(ALL).filter((L) => /^story-/.test(L.id)).sort((a, b) => a.n - b.n);
const GUIDE = { easy: 0.4, medium: 0.22, sharp: 0.1, hard: 0 };

const App = {
  scene: 'boot', ready: false, loading: 0, paused: false, testPaused: false, time: 0, clock: null, steps: 0,
  save: loadSave(), sim: null, level: null, setup: null, vis: {}, showPerches: false, hoverPerch: null,
  aimGuide: null, guideKey: '', aiActive: null, aimAnim: null, pendingEnd: null, held: new Set(), craterN: 0,
  turnElapsed: 0, ff: 1, tutorialStep: 0, nextSeed: null, art: {}, reduced: false,
};
window.__FS = App;

const canvas = document.getElementById('view');
const renderer = new Renderer(canvas);
App.renderer = renderer;
const hud = new Hud(document.getElementById('hud'), App);
const screens = new Screens(document.getElementById('screens'), App);
App.hud = hud; App.screens = screens;
const live = document.getElementById('live');
// `add`: a tip that follows a call made a moment ago (the battle's title, the turn) is read after it, in the same announcement, not over it
const say = (t, add) => { const full = add && App.lastSaid && performance.now() - (App.saidAt || 0) < 1500 ? `${App.lastSaid} ${t}` : t; live.textContent = ''; setTimeout(() => { live.textContent = full; }, 30); App.lastSaid = full; App.saidAt = performance.now(); };

// ---------------------------------------------------------------------------------------------------------------
// settings
function applySettings() {
  const s = App.save.settings;
  document.documentElement.style.setProperty('--text-scale', s.textScale || 1);
  const sys = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  App.reduced = s.reducedMotion == null ? sys : !!s.reducedMotion;
  renderer.reduced = App.reduced;
  renderer.textScale = s.textScale || 1;
  document.documentElement.classList.toggle('bigtext', (s.textScale || 1) > 1);
  document.body.classList.toggle('reduced', App.reduced);
  setAudio(s);
}
// A one-line notice on the title screen (shown once); during a battle it also goes out as a call.
let titleNotice = '';
const OLD_BATTLE = 'This battle was saved before an update and could not be resumed';
function showNotice(text) { say(text); titleNotice = text; paintNotice(); }
function paintNotice() {
  if (!titleNotice || App.scene !== 'title') return;
  const wrap = screens.root.querySelector('.title-wrap'), tag = wrap && wrap.querySelector('.tagline');
  if (!tag) return;
  const p = document.createElement('p'); p.className = 'tagline notice'; p.setAttribute('role', 'status'); p.textContent = titleNotice;
  tag.after(p); titleNotice = '';
}
// Once a session the player is told if nothing they do will be kept (S6-15): at boot when storage is blocked, or the
// first time a save fails later (a full disk, say). The newer-version notice already says as much, so it counts.
const UNSAVED = "Progress can't be saved in this browser";
let unsavedTold = false;
function checkSaveNotice() {
  const n = takeSaveNotice();
  if (!n) return;
  if (/not be saved/.test(n)) unsavedTold = true;
  if (App.scene === 'battle') hud.call(n, 4500);
  showNotice(n);
}
function tellUnsaved() {
  if (unsavedTold) return;
  unsavedTold = true;
  if (App.scene === 'battle') hud.call(UNSAVED, 4500);
  showNotice(UNSAVED);
}
function saveConflict() {
  hud.call('Saved battle changed in another tab', 4500);
  say('This battle is still playable here. Resume the saved battle from the title, or start a new battle.');
}
function persist(intent = 'merge', fields = [], expectedResume) {
  const before = JSON.stringify(App.save.settings);
  const ok = writeSave(App.save, { intent, fields: Array.isArray(fields) ? fields : [fields], expectedResume, notify: saveConflict });
  if (before !== JSON.stringify(App.save.settings)) { applySettings(); App.guideKey = ''; }
  checkSaveNotice();
  if (!ok) tellUnsaved();
  return ok;
}
// a saved Quick Battle level that no longer exists falls back to the first Story level
function fixQuickLevel() {
  if (ALL[App.save.quick.level]) return;
  App.save.quick.level = 'story-01'; persist('quick', 'level');
}
function freshSave() { refreshSave(App.save, saveConflict); applySettings(); checkSaveNotice(); }

// ---------------------------------------------------------------------------------------------------------------
// battles
function storyInventory(n) { return STORY.filter((L) => L.n <= n && L.unlock).map((L) => L.unlock); }

// The special nuts a battle can offer in the satchel shop: none for Practice and "Acorns only".
function packKinds(setup) {
  if (setup.mode === 'practice' || setup.loadout === 'acorn') return [];
  const kinds = setup.loadout === 'story' ? setup.unlocked || [] : NUT_ORDER;
  return NUT_ORDER.filter((k) => k !== 'acorn' && kinds.includes(k));
}
// Story battles start from the banked purse, Quick Battles from the usual 60. The satchel screen shows when there is
// something to buy; otherwise the battle starts straight away (battle 1 has no specials to spend on).
function openPrep(setup) {
  const purse = setup.mode === 'story' ? App.save.story.acorns : ACORNS.start;
  const full = { ...setup, purse, buys: {} };
  if (!packKinds(full).length) return startBattle(full);
  const L = ALL[setup.levelId];
  screens.show('prep', { setup: full, bought: {}, kinds: packKinds(full), blurb: setup.mode === 'story' ? blurbFor(L.n) : '', name: L.n && setup.mode === 'story' ? `Battle ${L.n}: ${L.name}` : L.name });
}
function startBattle(setup) {
  let L = ALL[setup.levelId];
  if (!L) { showTitle(); showNotice('That battlefield could not be found'); return; }
  const saved = beginBattleSave(App.save, { mode: setup.mode, resume: !!setup.battle, levelNumber: L.n || 0, notify: saveConflict });
  applySettings();
  if (!saved.started) {
    if (saved.reason === 'locked') return screens.show('story', { levels: STORY });
    return showTitle();
  }
  if (saved.resume) {
    setup = { ...saved.resume.setup, battle: saved.resume.battle }; L = ALL[setup.levelId];
    if (!L || (L.rev || 1) !== (saved.resume.levelRev || 1)) {
      App.save.resume = null; persist('invalidate', [], saved.resume); showTitle(); showNotice(OLD_BATTLE); return;
    }
  }
  const playerTeam = setup.team ?? 0;
  const seed = setup.seed ?? App.nextSeed ?? (Date.now() & 0xffff);
  const opts = {
    seed, mode: setup.mode, difficulty: setup.difficulty || 'medium', teamSize: setup.size || L.teamSize, rounds: setup.rounds || L.rounds,
    wind: setup.wind || L.wind, steam: setup.steam || L.steam, birds: setup.birds || 'off', loadout: setup.loadout || 'all', unlocked: setup.unlocked,
    playerTeam, human: setup.mode === 'practice' ? [true, false] : [playerTeam === 0, playerTeam === 1],
    practice: setup.mode === 'practice',
  };
  if (setup.loadout === 'acorn') { opts.loadout = 'story'; opts.unlocked = []; }
  // the shop before round one (S3-01): both families start from the same purse; the player packs what was bought on
  // the satchel screen and the rival packs by its own rules, so neither has a free edge
  if (setup.purse != null && setup.mode !== 'practice') {
    const buys = [{}, {}];
    buys[playerTeam] = setup.buys || {}; buys[1 - playerTeam] = aiBuys(packKinds(setup), setup.purse);
    opts.acorns = [setup.purse, setup.purse]; opts.buys = buys;
  }
  if (setup.mode === 'practice') opts.loadout = 'practice';
  App.setup = { ...setup, seed };
  const B = setup.battle;
  try {
    if (B && !(Array.isArray(B.squirrels) && Array.isArray(B.teams) && Array.isArray(B.trees) && B.rng && typeof B.rng === 'object')) throw new Error('damaged saved battle');
    App.sim = B ? new Sim(L, opts, JSON.parse(JSON.stringify(B))) : new Sim(L, opts);
  } catch (err) {
    if (!B) throw err;
    // a damaged resume slot would otherwise leave a dead Resume button for good
    App.save.resume = null; persist('invalidate', [], saved.resume);
    showTitle(); showNotice('That saved battle could not be loaded');
    return;
  }
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
  App.ff = 1; App.tutorialStep = 0; App.tauntN = 0; clearTimeout(tipTimer); App.targetsHit = []; App.koHold = 0; App.reframe = false; hud.clearCalls();
  App.lastShot = null; App.shotTrail = null;
  sim.drain();
  setTension(false); playTheme(themeFor(L)); playAmbience(sceneFor(L));
  // a new battle opens with its place and a line about it (not on a resumed battle or in Practice)
  if (!App.setup.battle && App.setup.mode !== 'practice' && L.n) {
    const head = App.setup.mode === 'story' ? `Battle ${L.n}: ${L.name}` : App.setup.mode === 'daily' ? `Daily Duel: ${L.name}` : L.name;
    hud.titleCard(head, blurbFor(L.n), L.stretchLabel || '', 3200); say(`${head}. ${blurbFor(L.n)}`);
  }
  onTurnStart(true);
  frameCamera(true);
  kick();
}

function onTurnStart(first) {
  const sim = App.sim, q = sim.active();
  App.turnElapsed = 0; // seconds of this turn the player has actually had: see the turn timer in frame()
  App.renderer.cam.user = false;
  App.showPerches = false;
  App.guideKey = '';
  if (!q) return;
  const tm = sim.b.teams[q.team];
  if (!first) say(`${q.name}'s turn, ${TEAMS[q.team].name}. Wind ${Math.round(Math.abs(sim.b.wind) * 10)}${sim.b.wind > 0.02 ? ' to the right' : sim.b.wind < -0.02 ? ' to the left' : ''}.`);
  if (tm.human && App.setup.mode === 'story') {
    App.save.resume = { setup: { ...App.setup, battle: null }, battle: sim.toJSON(), levelRev: App.level.rev || 1 };
    persist('turn');
  }
  tutorial();
}

// tutorial tips: each shows once, on the player's own turn, until any tap/key or TIP_MS passes
const TIPS = ['Drag back from anywhere to aim. Let go to throw. Slide back to where you began to cancel.', 'Next: wind (top) bends your throw. Press Move to scamper to another branch.', 'Knock every rival out of the trees to win the round.'];
const TIP_AIM_ONLY = 'Drag back from anywhere to aim. Then press Throw! Slide back to where you began to cancel.';
const TIP_MS = 8000;
let tipTimer = 0;
function tutorial() {
  clearTimeout(tipTimer);
  const q = App.sim && App.sim.active();
  // past Story battle 1's three tips, a battle teaches one thing at a time, the first time it matters (S2-01)
  if (App.level && App.save.settings.tutorial && q && App.sim.b.teams[q.team].human && !(App.level.tutorial && App.tutorialStep < TIPS.length) && contextTip(q)) return;
  if (!App.level || !App.level.tutorial || !App.save.settings.tutorial || !q || !App.sim.b.teams[q.team].human || App.tutorialStep >= TIPS.length) { hud.hint(''); return; }
  // in a short (landscape) window the title card and a tip would not both fit: the tip waits for the card to go
  if (hud.cardOn && window.innerHeight <= 480) { hud.hint(''); tipTimer = setTimeout(tutorial, 3400); return; }
  // with "Release: Only aims" the first tip names the Throw button instead of the release
  hud.hint(App.tutorialStep === 0 && App.save.settings.releaseThrows === false ? TIP_AIM_ONLY : TIPS[App.tutorialStep]);
  if (App.tutorialStep === 1) markTip('wind'); // that tip is about the wind, so the wind tip need not come again
  tipTimer = setTimeout(dismissTip, TIP_MS);
}
// the words for what the player is using: a finger, the keyboard or a pad (the last input seen)
App.inputKind = window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
const aimWords = () => ({ key: 'Arrows aim, Space throws.', pad: 'Stick aims, A throws.', touch: 'Drag back to aim, let go to throw.', mouse: 'Drag back to aim, let go to throw.' })[App.inputKind];
const tapWord = () => ({ key: 'press Space', pad: 'press A', touch: 'tap', mouse: 'click' })[App.inputKind];
// each tip is twelve words or fewer, the goal or the one verb first
const CONTEXT_TIPS = {
  quick: () => `Knock every rival out of the trees. ${App.inputKind === 'key' ? 'Arrows aim.' : App.inputKind === 'pad' ? 'Stick aims.' : 'Drag back to aim.'}`,
  practice: () => `Hit every target. ${aimWords()}`,
  'nut-chinquapin': () => `Chinquapin Trio: ${tapWord()} in flight to split into three.`,
  'nut-pecan': () => `Pecan Dart: ${tapWord()} in flight to dash straight through leaves.`,
  'nut-walnut': () => `Black Walnut: ${tapWord()} in flight, or let it land, for a big pop.`,
  'nut-hickory': () => `Hickory Hook: ${tapWord()} in flight to curl it back.`,
  'nut-sweetgum': () => `Sweetgum Drop: ${tapWord()} in flight to drop a spiky gumball.`,
  'nut-hedgeapple': () => 'Hedge Apple: heavy, it shrugs off wind and rolls downhill.',
  steam: () => 'Steam over the Row lifts nuts that fly through it.',
  wind: () => 'The wind flag at the top bends every throw. Aim into it.',
};
function contextTip(q) {
  const seen = App.save.settings.seenTips, b = App.sim.b, tm = b.teams[q.team];
  const ids = [b.practice ? 'practice' : App.setup.mode === 'quick' ? 'quick' : '', ...NUT_ORDER.filter((k) => k !== 'acorn' && (tm.inventory[k] || 0) > 0).map((k) => 'nut-' + k),
    b.steamLevel > 0 && App.level.steam ? 'steam' : '', Math.round(Math.abs(b.wind) * 10) >= 1 ? 'wind' : ''];
  const id = ids.find((x) => x && TIP_IDS.includes(x) && !seen.includes(x));
  if (!id) return false;
  // in a short (landscape) window the title card and a tip would not both fit: the tip waits for the card to go
  if (hud.cardOn && window.innerHeight <= 480) { hud.hint(''); tipTimer = setTimeout(tutorial, 3400); return true; }
  const text = CONTEXT_TIPS[id]();
  hud.hint(text); say(text, true);
  tipTimer = setTimeout(dismissTip, TIP_MS);
  markTip(id);
  return true;
}
function markTip(id) {
  const seen = App.save.settings.seenTips;
  if (seen.includes(id)) return;
  App.save.settings.seenTips = [...seen, id]; persist('settings', 'seenTips');
}
App.tips = tutorial;
function dismissTip() {
  clearTimeout(tipTimer);
  if (!hud.hintText) return;
  hud.hint('');
  App.tutorialStep++;
}

function wallNow() { return performance.now() / 1000; }

// ---------------------------------------------------------------------------------------------------------------
// player actions
App.pickNut = (k) => {
  const sim = App.sim;
  if (!sim || sim.b.phase !== 'aim' || !humanTurn()) return;
  if (!sim.canUse(sim.b.turn.team, k)) return;
  sim.setAim({ nut: k }); App.guideKey = ''; sfx('pick', k); kick();
};
function humanTurn() {
  const b = App.sim.b;
  if (App.aiActive && (App.aiActive.n !== b.turn.n || App.aiActive.team !== b.turn.team)) App.aiActive = null;
  return b.teams[b.turn.team].human && !App.aiActive;
}
// The camera holds on a knockout for a moment; any input ends the hold (S1-10), so the view is back on the player's own
// squirrel before a throw goes out, and the buttons never look dead while a key or a drag still works.
function endKo() {
  if (!(App.koHold > 0)) return;
  App.koHold = 0;
  if (App.reframe) { App.reframe = false; frameCamera(false); }
}
function throwNow() {
  const sim = App.sim;
  if (!sim || sim.b.phase !== 'aim' || !humanTurn() || screens.cur) return false;
  endKo();
  App.showPerches = false;
  const ok = sim.throwNut({});
  if (ok) dismissTip();
  kick();
  return ok;
}
// the lead nut of the player's own shot still has a trick to give
function canTap() {
  const sim = App.sim, n = sim && sim.b.phase === 'flight' && sim.b.nuts[0];
  if (!n || n.tapped || n.kind === 'acorn' || n.kind === 'hedgeapple') return false;
  return sim.b.teams[sim.b.shot ? sim.b.shot.team : sim.b.turn.team].human;
}
function tapNow() {
  const sim = App.sim;
  if (!sim || sim.b.phase !== 'flight') return false;
  if (!sim.b.teams[sim.b.shot ? sim.b.shot.team : sim.b.turn.team].human) return false;
  return sim.tap();
}
// A press while a shot or the rival's turn plays out hurries it along (S1-02): the rival skips its thinking and aim
// animation, a flight or settle runs FAST times quicker until the turn passes, and the knockout slow-motion ends.
const FAST = 3;
function hurry() {
  const sim = App.sim;
  if (!sim || App.scene !== 'battle' || screens.cur || App.paused || App.testPaused) return false;
  const ph = sim.b.phase;
  if (ph === 'aim') { const A = App.aiActive; if (!A || A.skip) return false; A.skip = true; return true; }
  if (ph !== 'flight' && ph !== 'settle') return false;
  if (App.ff >= FAST && !(App.slowT > 0)) return false;
  App.ff = FAST; App.slowT = 0;
  return true;
}
const AIM_SAY_MS = 400; // how long the arrow keys must rest before the aim is read out
function nudgeAim(da, dp) {
  const sim = App.sim;
  if (!sim || sim.b.phase !== 'aim' || !humanTurn()) return;
  const a = sim.b.teams[sim.b.turn.team].aim;
  sim.setAim({ angle: a.angle + da, power: a.power + dp });
  App.guideKey = ''; kick();
  // read the new aim out once the keys pause (S2-12), so a held arrow is not read a hundred times
  clearTimeout(App.aimSayT);
  App.aimSayT = setTimeout(() => { const n = sim.b.teams[sim.b.turn.team].aim; say(`Angle ${Math.round(n.angle)}, power ${Math.round(n.power * 100)}.`); }, AIM_SAY_MS);
}
function toggleMove(on) {
  const sim = App.sim;
  if (!sim || sim.b.phase !== 'aim' || !humanTurn()) return;
  App.showPerches = on ?? !App.showPerches;
  sfx('move', App.showPerches);
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
  else if (a === 'sound') toggleSound();
};
// the speaker button, the N key and the pad's Select button flip the master Sound switch from inside a battle (S5-08)
function toggleSound() {
  const s = App.save.settings;
  s.sound = !s.sound; persist('settings', 'sound'); applySettings();
  say(s.sound ? 'Sound on' : 'Sound off'); kick();
}

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
      freshSave();
      if (s.story.team == null) return screens.show('pickTeam', { next: 'story' });
      return screens.show('story', { levels: STORY });
    case 'team': s.story.team = +d.v; persist('family'); return screens.show('story', { levels: STORY });
    case 'switchTeam': return screens.show('pickTeam', { next: 'story' });
    case 'play': {
      freshSave();
      const L = ALL[d.v];
      if (!L) return;
      if (L.practice) return App.onMenu('practice', {});
      if (/^story-/.test(L.id)) return openPrep({ mode: 'story', levelId: L.id, seed: d.seed != null ? +d.seed : undefined, team: s.story.team ?? 0, difficulty: s.settings.difficulty, loadout: 'story', unlocked: storyInventory(L.n), birds: L.tutorial ? 'off' : 'some' });
      return startBattle({ mode: 'quick', levelId: L.id, team: s.quick.team, birds: s.quick.birds });
    }
    case 'quick': freshSave(); fixQuickLevel(); return screens.show('quick', { levels: STORY });
    case 'qset': s.quick[d.k] = /^(team|size|rounds)$/.test(d.k) ? +d.v : d.v; persist('quick', d.k); return screens.refresh();
    case 'quickGo': { freshSave(); fixQuickLevel(); const q = s.quick; return openPrep({ mode: 'quick', levelId: q.level, team: q.team, size: q.size, rounds: q.rounds, wind: q.wind, steam: q.steam, birds: q.birds, loadout: q.loadout, difficulty: q.difficulty, unlocked: storyInventory(s.story.unlocked) }); }
    case 'practice': return startBattle({ mode: 'practice', levelId: 'practice', team: 0 });
    case 'daily': {
      // the day's battle (S3-03): map, wind and seed from the date, acorns only, a medium rival, three a side
      freshSave();
      const day = dayKey(), plan = dailyPlan(day, STORY.map((L) => L.id));
      return startBattle({ mode: 'daily', levelId: plan.levelId, seed: plan.seed, day, team: s.quick.team, size: 3, rounds: 1, wind: plan.wind, steam: 'on', birds: 'some', loadout: 'acorn', difficulty: 'medium' });
    }
    case 'help': return screens.show('help', { from: screens.cur });
    case 'settings': return screens.show('settings', { from: screens.cur === 'pause' || App.scene === 'battle' ? 'pause' : 'title' });
    case 'credits': return screens.show('credits', { from: screens.cur === 'results' ? 'results' : '' });
    case 'creditsBack': return d.from === 'results' ? App.onMenu('menu', {}) : App.onMenu('back', {});
    case 'records': freshSave(); return screens.show('records', { levels: STORY, from: d.from || '' });
    case 'journal': freshSave(); screens.show('journal', { levels: STORY, from: d.from || '' }); return paintPostcards();
    case 'journalBack': return App.onMenu('records', { from: d.from });
    case 'recordsBack': return d.from === 'story' ? screens.show('story', { levels: STORY }) : showTitle();
    case 'set': {
      const v = d.v === 'true' ? true : d.v === 'false' ? false : d.v === 'auto' && d.k === 'reducedMotion' ? null : isNaN(+d.v) || d.v === '' ? d.v : +d.v;
      s.settings[d.k] = v; persist('settings', d.k); applySettings(); App.guideKey = '';
      return screens.refresh();
    }
    case 'tipsAgain': s.settings.seenTips = []; s.settings.tutorial = true; persist('settings', ['seenTips', 'tutorial']); say('Tips will show again in your next battles.'); return screens.refresh();
    case 'resetProgress': return screens.show('confirmReset');
    case 'resetYes': { const keep = s.settings; App.save = DEFAULT_SAVE(); App.save.settings = keep; persist('reset'); applySettings(); return screens.show('settings'); }
    case 'back':
      if (App.scene === 'battle') return screens.show('pause');
      return showTitle();
    case 'resume': App.paused = false; screens.hide(); kick(); return;
    case 'restart': if (askLeave('restart')) return; return startBattle({ ...App.setup, battle: null, seed: App.setup.mode === 'daily' ? App.setup.seed : undefined });
    case 'again': {
      // "Retry same wind" replays the battle's own seed: the same wind, birds and first thrower
      const seed = d.same || App.setup.mode === 'daily' ? App.setup.seed : undefined;
      if (App.setup.mode === 'story') return App.onMenu('play', { v: App.setup.levelId, seed });
      return startBattle({ ...App.setup, battle: null, seed, buys: App.setup.buys });
    }
    case 'guideLong': {
      s.settings.aimGuide = 'always'; persist('settings', 'aimGuide'); applySettings(); App.guideKey = '';
      const btn = screens.root.querySelector('[data-act="guideLong"]'), p = btn && btn.closest('p');
      if (p) { p.textContent = 'The aim guide is now Always long. You can change it in Settings.'; p.setAttribute('role', 'status'); }
      say('Aim guide set to Always long.');
      const go = screens.root.querySelector('[data-act="again"]'); if (go) go.focus({ preventScroll: true });
      return;
    }
    case 'tryEasy': s.settings.difficulty = 'easy'; persist('settings', 'difficulty'); applySettings(); return App.onMenu('play', { v: App.setup.levelId });
    case 'menu': if (askLeave('menu')) return; persist(); return showTitle();
    case 'leaveYes': return App.onMenu(d.then, {});
    case 'resumeBattle': { const r = s.resume; if (r) return startBattle({ ...r.setup, battle: r.battle }); return; }
    case 'prepBuy': case 'prepUndo': {
      const pd = screens.data, k = d.kind, left = pd.setup.purse - Object.entries(pd.bought).reduce((n, [q, c]) => n + c * NUTS[q].price, 0), have = 1 + (pd.bought[k] || 0);
      if (act === 'prepBuy' && have < NUT_CAP && left >= NUTS[k].price) { pd.bought[k] = (pd.bought[k] || 0) + 1; sfx('buy'); say(`${NUTS[k].name} packed. ${left - NUTS[k].price} acorns left.`); }
      else if (act === 'prepUndo' && pd.bought[k]) { pd.bought[k]--; say(`${NUTS[k].name} taken back. ${left + NUTS[k].price} acorns left.`); }
      return screens.refresh();
    }
    case 'prepGo': { const pd = screens.data; return startBattle({ ...pd.setup, buys: { ...pd.bought } }); }
    case 'prepBack': return App.onMenu(screens.data.setup.mode === 'story' ? 'story' : 'quick');
    case 'buy': { const r = App.sim.buy(App.sim.b.teams.findIndex((t) => t.human), d.kind); if (r.ok) sfx('buy'); return screens.refresh(); }
    case 'nextRound': App.lastShot = null; App.shotTrail = null; playTheme(themeFor(App.level)); App.sim.b.teams.forEach((tm, t) => { if (!tm.human) aiShop(App.sim, t); }); App.sim.continueBattle(); App.sim.drain(); screens.hide(); renderer.setLevel(App.level, App.sim); App.vis = {}; App.craterN = 0; onTurnStart(false); frameCamera(true); kick(); return;
    case 'locked': return;
    default: return;
  }
};

// Restart and Quit on the pause card ask first once something has been thrown (S2-05), so a slipped thumb does not
// cost a battle. A Story battle quit this way keeps its resume slot, so the title still offers Resume battle.
function askLeave(then) {
  if (screens.cur !== 'pause' || !App.sim || App.sim.b.practice || !App.sim.b.teams.some((t) => t.stats.throws > 0)) return false;
  screens.show('confirmLeave', { then, story: App.setup.mode === 'story' });
  return true;
}

function showTitle() {
  App.scene = 'title'; document.body.dataset.scene = 'title';
  hud.show(false);
  // a living battlefield behind the title
  const L = ALL['story-01'] || Object.values(ALL)[0];
  App.level = L; App.sim = new Sim(L, { seed: 5, teamSize: 3, human: [false, false], birds: 'lots' }); App.setup = { mode: 'title', levelId: L.id };
  renderer.setLevel(L, App.sim); loadArt(L);
  App.vis = {}; App.aiActive = null; App.paused = false;
  renderer.cam.frame(0, 330, W, 1110, 0, true);
  screens.show('title'); decorateScreen();
  checkSaveNotice(); paintNotice();
  // a battle saved on an older layout of its level can't be resumed (its trees and perches no longer line up)
  { const r = App.save.resume; if (r && (!ALL[r.setup?.levelId] || (ALL[r.setup.levelId].rev || 1) !== (r.levelRev || 1))) { App.save.resume = null; persist('invalidate', [], r); showNotice(OLD_BATTLE); } }
  if (App.save.resume) {
    const nav = screens.root.querySelector('.menu');
    const b = document.createElement('button'); b.className = 'btn teal'; b.type = 'button'; b.textContent = 'Resume battle'; b.dataset.act = 'resumeBattle';
    b.addEventListener('click', () => App.onMenu('resumeBattle', {}));
    nav.insertBefore(b, nav.children[1]);
  }
  setTension(false); playTheme('title'); playAmbience(sceneFor(L));
  kick();
}

const TIER_KEYS = ['Easy', 'Medium', 'Sharp', 'Hard']; // the saved win counters, in the order of TIERS
const LOSS_OFFER = 3; // losses in a row on one Story battle before the results card offers Easy
function battleOver() {
  const sim = App.sim, b = sim.b, res = b.result, L = App.level, s = App.save;
  const me = b.teams.findIndex((t) => t.human);
  const win = res.battleWinner === me;
  const myTurns = Math.ceil(b.turn.n / 2); // this family's turns: the count par is judged by
  const myStats = b.teams[me].stats;
  let stars = null, unlock = null, next = null, tier = null, opened = false;
  // what this battle may beat, read before the save changes (the Records screen and the "New best!" lines)
  const before = { turns: s.story.bestTurns[L.id], stars: s.story.stars[L.id] || 0, shot: s.stats.bestShot };
  const ti = TIERS.indexOf(App.setup.difficulty);
  if (App.setup.mode === 'story') {
    // every round counts, not only the last (P-N02): the squirrels lost over all of them, and the turns over all of them against a par a round
    const outs = b.lost ? b.lost[me] : b.squirrels.filter((q) => q.team === me && q.out).length;
    stars = starsFor({ win, outs, size: L.teamSize, turns: myTurns, par: L.par, rounds: b.played || 1 });
    s.story.stars[L.id] = Math.max(s.story.stars[L.id] || 0, stars);
    // the difficulty each star was earned on: slot i holds the highest tier on which a run reached i + 1 stars
    tier = ti < 0 ? 2 : ti + 1;
    s.story.starTier[L.id] = starTiers(s.story, L.id).map((t, i) => (i < stars ? Math.max(t, tier) : t));
    if (App.setup.purse != null) s.story.acorns = clamp(Math.floor(b.teams[me].acorns), 0, PURSE_CAP);
    if (win) s.story.bestTurns[L.id] = Math.min(Math.max(1, myTurns), s.story.bestTurns[L.id] ?? Infinity);
    // a run of losses on one battle ends with a win; after LOSS_OFFER of them the results card offers Easy (S2-18)
    if (win) delete s.story.losses[L.id]; else s.story.losses[L.id] = Math.min(99, (s.story.losses[L.id] || 0) + 1);
    if (win && L.n >= s.story.unlocked && L.n < STORY.length) { s.story.unlocked = L.n + 1; opened = true; const nl = STORY[L.n]; unlock = nl && nl.unlock; }
    if (win && STORY[L.n]) next = STORY[L.n].id;
    s.resume = null;
  }
  const practice = App.setup.mode === 'practice';
  if (!practice) {
    s.stats.battles++;
    if (win) { s.stats.wins++; s.stats.streak++; s.stats['wins' + TIER_KEYS[ti < 0 ? 1 : ti]]++; } else s.stats.streak = 0;
    s.stats.bestStreak = Math.max(s.stats.bestStreak, s.stats.streak);
  }
  s.stats.kos += myStats.kos; s.stats.bestShot = Math.max(s.stats.bestShot, myStats.best);
  s.stats.throws += myStats.throws || 0; s.stats.hits += myStats.hits || 0;
  const records = {
    // a first win counts as a new best only for a player who had no stars here yet (older saves hold stars but no turns)
    turns: App.setup.mode === 'story' && win ? { now: Math.max(1, myTurns), was: before.turns ?? null, best: before.turns == null ? !before.stars : Math.max(1, myTurns) < before.turns } : null,
    shot: !practice && myStats.best > before.shot && before.shot > 0 ? myStats.best : 0,
    streak: !practice && win && s.stats.streak >= 2 ? s.stats.streak : 0,
  };
  // the Daily Duel keeps the best win of the day and the days-in-a-row streak
  let daily = null;
  if (App.setup.mode === 'daily') {
    const day = App.setup.day ?? dayKey(), outs = b.squirrels.filter((q) => q.team === me && q.out).length;
    if (win) { const r = recordDaily(s.daily, day, Math.max(1, myTurns), outs); s.daily = r.daily; daily = { won: true, day, turns: Math.max(1, myTurns), outs, best: r.best, streak: r.streak, bestStreak: s.daily.bestStreak, today: s.daily.hist[day] }; }
    else daily = { won: false, day, streak: liveStreak(s.daily, day), today: s.daily.hist[day] || null };
  }
  const fact = pickFact(L);
  if (fact && !s.story.notes.includes(fact.id)) s.story.notes.push(fact.id);
  persist('result');
  sfx(win || App.setup.mode === 'practice' ? 'win' : 'lose');
  if (win && stars) sfx('stars', stars);
  if (win && (unlock || opened)) sfx('unlock', stars || 0);
  screens.show('results', {
    win, practice, records, n: L.n, stars,
    finale: App.setup.mode === 'story' && win && L.n === STORY.length,
    line: App.setup.mode === 'story' && !App.setup.practice ? resultLine(L.n, win, me, TEAMS[1 - me].short, TEAMS[me].home) : '', unlock, next, tier,
    banked: App.setup.mode === 'story' && App.setup.purse != null ? s.story.acorns : null,
    winnerName: res.battleWinner >= 0 && App.setup.mode !== 'practice' ? TEAMS[res.battleWinner].name : '',
    losses: App.setup.mode === 'story' && !win ? s.story.losses[L.id] || 0 : 0, offerEasy: App.setup.mode === 'story' && !win && (s.story.losses[L.id] || 0) >= LOSS_OFFER && s.settings.difficulty !== 'easy',
    retry: !win && !practice && !daily, daily, loss: !win && !practice ? lossText(b, me, myStats) : null,
    stats: myStats, turns: myTurns, par: App.setup.mode === 'story' ? parFor(L.par, b.played || 1) : null, rounds: b.played || 1, koAllowed: koAllowed(L.teamSize), acorns: b.teams[me].acorns, fact, me, winner: res.battleWinner,
  });
  decorateScreen();
  say((win ? 'Victory!' : 'Battle over.') + (daily && daily.won ? ` Daily Duel won in ${daily.turns} ${daily.turns === 1 ? 'turn' : 'turns'}.` : '') + (records.turns && records.turns.best ? ' New best: ' + records.turns.now + (records.turns.now === 1 ? ' turn.' : ' turns.') : '') + (records.shot ? ' New best hit: ' + records.shot + '.' : ''));
}

// What a loss says (S2-04): why the family lost, a title chosen by how near it was, and one next step picked by rule.
function lossText(b, me, stats) {
  const mine = b.squirrels.filter((q) => q.team === me), out = mine.filter((q) => q.out).length, foe = b.squirrels.filter((q) => q.team !== me && !q.out).length;
  const rivals = TEAMS[1 - me].short;
  let cause = out >= mine.length ? `All ${mine.length} of your squirrels were knocked out of the trees.` : 'Your squirrels were knocked out of the trees.';
  cause += foe > 0 ? ` The ${rivals} had ${foe} left standing.` : '';
  if (b.rounds > 1) cause += ` Rounds: ${b.roundWins[me]} to ${b.roundWins[1 - me]}.`;
  const title = foe <= 1 && stats.hits > 0 ? 'So close!' : 'Not this time';
  const guide = App.save.settings.aimGuide;
  let hint = 'Wind bends every throw. Check the flag before you let go.', button = '';
  if (stats.throws > 0 && stats.hits === 0) { hint = 'None of your throws landed.'; if (guide !== 'always') { hint += ' The long aim guide shows the whole arc.'; button = 'guideLong'; } else hint += ' Drag farther back for more power, and watch the wind flag.'; }
  return { title, cause, hint, button };
}

function pickFact(L) {
  if (typeof FACTS === 'undefined') return null;
  const land = FACTS.landmarks.filter((f) => f.stretch === L.stretch || f.stretch === 'any');
  const nat = FACTS.nature.filter((f) => f.season === L.season || f.season === 'any');
  const pool = [...land.map((f) => ({ ...f, kind: 'land' })), ...nat.map((f) => ({ ...f, kind: 'nature' }))];
  if (!pool.length) return null;
  // the battle's own note if it has not been read yet, then any unread note that suits the place, then the old rotation
  const seen = App.save.story.notes, fresh = (x) => !seen.includes(x.id), start = (L.n * 7 + App.save.stats.battles * 3) % pool.length;
  const all = [...FACTS.landmarks.map((x) => ({ ...x, kind: 'land' })), ...FACTS.nature.map((x) => ({ ...x, kind: 'nature' }))], own = all.find((x) => x.id === LEVEL_FACTS[L.n - 1]);
  const f = (own && fresh(own) ? own : null) || pool.slice(start).concat(pool.slice(0, start)).find(fresh) || pool[start];
  return factHtml(f);
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
// a press on the field spends a trick nut's trick only if it is a short press that does not move and has no second finger (P-N01)
const TAP_MS = 250, TAP_PX = 10;
let tapArm = null;
const CANCEL_POWER = 0.18; // a drag shorter than this fraction of full power is a cancel, not a throw (S1-03; it was 0.08, a few pixels of finger jitter)
const ptrs = new Map();
let drag = null, pinch = null;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  if (App.scene !== 'battle' || screens.cur) return;
  canvas.setPointerCapture && (() => { try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* synthetic */ } })();
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const sim = App.sim, b = sim.b;
  if (ptrs.size === 2) { tapArm = null; const [p1, p2] = [...ptrs.values()]; pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), cx: (p1.x + p2.x) / 2, cy: (p1.y + p2.y) / 2 }; drag = null; return; }
  if (e.button === 1 || e.button === 2) { drag = { pan: true, x: e.clientX, y: e.clientY }; return; }
  if (b.phase === 'flight') { if (canTap()) tapArm = { id: e.pointerId, t: performance.now(), x: e.clientX, y: e.clientY }; else if (hurry()) kick(); return; }
  if (b.phase !== 'aim' || !humanTurn()) { if (hurry()) kick(); drag = { pan: true, x: e.clientX, y: e.clientY }; return; }
  if (App.showPerches) {
    const id = perchAt(e.clientX, e.clientY);
    // a scamper ends Move mode, so the next drag aims (S1-15); a drag that misses a perch only pans, and says so
    if (id) { sim.move(id); sfx('chitter', sim.b.turn.team); App.guideKey = ''; App.showPerches = false; sfx('move', false); hud.call('Aim mode', 900); say('Aim mode.'); kick(); return; }
    drag = { pan: true, x: e.clientX, y: e.clientY, dist: 0, move: true }; return;
  }
  drag = { aim: true, x0: e.clientX, y0: e.clientY, moved: false, a0: { ...b.teams[b.turn.team].aim } };
});
canvas.addEventListener('pointermove', (e) => {
  if (!ptrs.has(e.pointerId)) { if (App.showPerches && App.scene === 'battle') { const h = perchAt(e.clientX, e.clientY); if (h !== App.hoverPerch) { App.hoverPerch = h; kick(); } } return; }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (tapArm && Math.hypot(e.clientX - tapArm.x, e.clientY - tapArm.y) > TAP_PX) tapArm = null;
  const cam = renderer.cam;
  if (pinch && ptrs.size >= 2) {
    const [p1, p2] = [...ptrs.values()], d = Math.hypot(p1.x - p2.x, p1.y - p2.y), cx = (p1.x + p2.x) / 2, cy = (p1.y + p2.y) / 2;
    cam.zoomAt(d / pinch.d, cx, cy); cam.panBy(cx - pinch.cx, cy - pinch.cy);
    pinch = { d, cx, cy }; kick(); return;
  }
  if (!drag) return;
  if (drag.pan) {
    drag.dist = (drag.dist || 0) + Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
    if (drag.move && !drag.noted && drag.dist > 12 && App.showPerches) { drag.noted = true; hud.call('Move is on: tap Done to aim', 1400); }
    cam.panBy(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; kick(); return;
  }
  if (drag.aim) {
    const tx = drag.x0 - e.clientX, ty = drag.y0 - e.clientY, len = Math.hypot(tx, ty);
    if (len < 12 && !drag.moved) return;
    drag.moved = true;
    const sim = App.sim, q = sim.active(), maxLen = Math.min(cam.vw, cam.vh) * 0.42;
    const ang = (Math.atan2(-ty, tx * q.facing) * 180) / Math.PI;
    sim.setAim({ angle: clamp(Math.round(ang), ANGLE_MIN, ANGLE_MAX), power: clamp(Math.round((len / maxLen) * 100) / 100, 0.05, 1) });
    drag.power = len / maxLen;
    // the cancel ring: where the pull started and how far back it must slide for a release to cancel (S2-13)
    App.dragRing = { x: drag.x0, y: drag.y0, r: Math.max(12, maxLen * CANCEL_POWER), inside: drag.power < CANCEL_POWER };
    App.guideKey = ''; kick();
  }
});
const endPtr = (e) => {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (tapArm && tapArm.id === e.pointerId) {
    const ok = e.type === 'pointerup' && performance.now() - tapArm.t <= TAP_MS;
    tapArm = null;
    if (ok && tapNow()) kick();
  }
  if (!drag) return;
  const d = drag; drag = null;
  if (App.dragRing) { App.dragRing = null; kick(); }
  if (d.aim && d.moved && (d.power || 0) >= CANCEL_POWER && e.type === 'pointerup' && App.save.settings.releaseThrows !== false) throwNow();
  else if (d.aim && d.moved && (d.power || 0) >= CANCEL_POWER && e.type === 'pointerup') { App.guideKey = ''; kick(); } // "Only aims": the aim stays and Throw! sends it
  else if (d.aim && d.moved && e.type === 'pointerup') { App.sim.setAim(d.a0); App.guideKey = ''; kick(); }
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
// the hint is click-through, so a tap on it (or anywhere in the battle, HUD buttons included) closes it
window.addEventListener('pointerdown', (e) => { App.inputKind = e.pointerType === 'touch' || e.pointerType === 'pen' ? 'touch' : 'mouse'; if (App.scene === 'battle' && !screens.cur) { dismissTip(); endKo(); } });
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
  App.inputKind = 'key';
  dismissTip(); endKo();
  const big = e.shiftKey ? 5 : 1;
  let used = true;
  switch (e.code) {
    case 'ArrowLeft': nudgeAim(big, 0); break;
    case 'ArrowRight': nudgeAim(-big, 0); break;
    case 'ArrowUp': nudgeAim(0, big / 100); break;
    case 'ArrowDown': nudgeAim(0, -big / 100); break;
    case 'Space': case 'Enter': case 'NumpadEnter':
      if (e.target && e.target.closest && e.target.closest('#hud button')) return; // activates the focused HUD button, not a throw
      if (e.repeat) break;
      if (App.sim.b.phase === 'flight') { if (!tapNow()) hurry(); } else if (!throwNow()) hurry();
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
    case 'KeyN': toggleSound(); break;
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
let padT = 0, padTimer = 0;
// the stick is read on its own clock, so aiming works while the render loop sleeps (reduced motion) and its speed does not follow the frame rate
function pollPad() {
  const nowT = performance.now(), dtw = padT ? Math.min(0.1, (nowT - padT) / 1000) : 0; padT = nowT;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p || !p.connected) continue;
    const bt = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
    const now = { a: bt(0), b: bt(1), lb: bt(4), rb: bt(5), start: bt(9), select: bt(8), up: bt(12), down: bt(13), left: bt(14), right: bt(15) };
    const prev = padPrev[p.index] || {}, edge = (k) => now[k] && !prev[k];
    if (edge('a') || edge('b') || edge('start')) wakeAudio();
    if (screens.cur) {
      const m = { up: edge('up') || (p.axes[1] < -0.6 && !prev.ay), down: edge('down') || (p.axes[1] > 0.6 && !prev.ay), left: edge('left'), right: edge('right'), cancel: edge('b') };
      if (m.up || m.down || m.left || m.right || m.cancel) screens.nav(m);
      if (edge('a') && document.activeElement && document.activeElement.click) document.activeElement.click();
    } else if (App.scene === 'battle') {
      if (Object.keys(now).some((k) => now[k] && !prev[k]) || Math.abs(p.axes[0]) > 0.2 || Math.abs(p.axes[1]) > 0.2) { endKo(); App.inputKind = 'pad'; }
      if (Math.abs(p.axes[0]) > 0.2) nudgeAim(-p.axes[0] * 72 * dtw, 0);
      if (Math.abs(p.axes[1]) > 0.2) nudgeAim(0, -p.axes[1] * 0.72 * dtw);
      if (edge('a')) { if (App.sim.b.phase === 'flight') { if (!tapNow()) hurry(); } else if (!throwNow()) hurry(); }
      if (edge('lb')) cycleNut(-1);
      if (edge('rb')) cycleNut(1);
      if (edge('left')) stepPerch(-1, 0);
      if (edge('right')) stepPerch(1, 0);
      if (edge('start')) pauseGame();
      if (edge('select')) toggleSound();
    }
    now.ay = Math.abs(p.axes[1]) > 0.6;
    padPrev[p.index] = now;
    return true;
  }
  return false;
}
function watchPad() {
  if (padTimer) return;
  padTimer = setInterval(() => { if (!pollPad()) { clearInterval(padTimer); padTimer = 0; } }, 16);
}
window.addEventListener('gamepadconnected', watchPad);
if (navigator.getGamepads && [...navigator.getGamepads()].some((p) => p && p.connected)) watchPad(); // a pad that was already live when the page loaded

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
  img.decode().then(() => { const fa = featherArt(img, L); App.art[key] = { img: fa, soft: archArt(fa), w: ent.w, h: ent.h, base: ART_BASE[file.split('-')[1]] ?? ART_BASE.middle }; if (App.level === L) renderer.art = App.art[key]; })
    .catch(() => {}).finally(() => { App.loading--; kick(); });
}

// squirrel and bird sprite atlases (Blender renders packed by tools/pack-sprites.mjs); the vector drawings are the fallback
function loadSprites() {
  if (typeof SPRITES === 'undefined' || /[?&]art=0/.test(location.search)) return;
  if (SPRITES.birds) {
    const img = new Image();
    img.src = 'assets/birds.webp';
    App.loading++;
    img.decode().then(() => { renderer.birdSprites = { img, meta: SPRITES.birds }; }).catch(() => {}).finally(() => { App.loading--; kick(); });
  }
  const imgs = [0, 1].map((t) => { const im = new Image(); im.src = `assets/sq-t${t}.webp`; return im; });
  App.loading++;
  Promise.all(imgs.map((im) => im.decode())).then(() => { renderer.sprites = { imgs, meta: SPRITES }; decorateScreen(); }).catch(() => {}).finally(() => { App.loading--; kick(); });
}

// the journal's postcards: the battle's own painting, cropped to a card, for each battle won with three stars (S4-17)
function paintPostcards() {
  const man = typeof MANIFEST !== 'undefined' ? MANIFEST : null;
  if (!man || /[?&]art=0/.test(location.search)) return;
  document.querySelectorAll('#screens canvas[data-card]').forEach((cv) => {
    const L = ALL[cv.dataset.card], ent = L && (man['bd-' + L.backdrop] || man[`bd-${L.stretch}-${L.season}-day`]);
    if (!ent) return;
    const img = new Image();
    img.onload = () => {
      cv.width = 300; cv.height = 200;
      const g = cv.getContext('2d'), k = Math.max(300 / img.naturalWidth, 200 / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
      // the paintings are open at the top (the game draws its own sky behind them): the card gets the battle's sky
      const sky = SKY[L.time] || SKY.day, sg = g.createLinearGradient(0, 0, 0, 200);
      sg.addColorStop(0, sky.top); sg.addColorStop(0.55, sky.mid); sg.addColorStop(1, sky.low);
      g.fillStyle = sg; g.fillRect(0, 0, 300, 200);
      g.drawImage(img, (300 - w) / 2, (200 - h) / 2, w, h);
      if (sky.tint && !/night/.test(ent.file)) { g.fillStyle = sky.tint; g.fillRect(0, 0, 300, 200); }
      cv.dataset.done = '1';
    };
    img.src = 'assets/' + ent.file;
  });
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

// a second copy faded to an arch (upper corners and sides melt away) for views zoomed out past the painting's edges
function archArt(src) {
  const cv = document.createElement('canvas'), w = src.width, h = src.height;
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.setTransform(1, 0, 0, (h * 1.15) / (w * 0.5), 0, 0);
  const cy = (h * 1.02) / ((h * 1.15) / (w * 0.5)), rg = g.createRadialGradient(w / 2, cy, w * 0.3, w / 2, cy, w * 0.5);
  rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, w, cy * 2);
  return cv;
}

// ---------------------------------------------------------------------------------------------------------------
// the frame
let rafId = 0, last = 0, acc = 0, inFrame = false, errorKicked = false;
function kick() { if (!rafId && !inFrame) { last = performance.now(); rafId = requestAnimationFrame(frame); } }
App.kick = kick;

function stepOnce() {
  const sim = App.sim;
  if (!sim) return;
  sim.step();
  App.steps++;
  recordShot();
  checkTargets();
  handleEvents();
}

// Haptics (S5-12): a short pulse on the player's throw (10 ms), a hit (18 ms) and a knockout or walnut burst (20, 30, 40),
// where the device has a motor and the player has not turned Vibration off or asked for reduced motion.
function buzz(pattern) {
  if (App.save.settings.vibration === false || App.reduced || typeof navigator.vibrate !== 'function') return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; // the browser only allows it after a touch or key
  try { navigator.vibrate(pattern); } catch (e) { /* not allowed here */ }
}
// The last human throw leaves its path as faint dots until the next throw (S2-02), and a throw that hit nothing says why.
const TRAIL_EVERY = 4, TRAIL_MAX = 600, SHOT_CLOSE = 70, SHOT_WIND = 0.25;
function recordShot() {
  const L = App.lastShot, n = L && L.rec && App.sim.b.phase === 'flight' && App.sim.b.nuts[0];
  if (!n) return;
  if (++L.n % TRAIL_EVERY === 0 && L.pts.length < TRAIL_MAX) L.pts.push([Math.round(n.x), Math.round(n.y)]);
}
function startShot(ev) {
  const b = App.sim.b, q = b.squirrels.find((s) => s.id === ev.sq);
  if (!q || !b.teams[q.team].human) { if (App.lastShot) App.lastShot.rec = false; return; }
  App.lastShot = { pts: [], wind: b.wind, facing: q.facing, team: q.team, n: 0, rec: true, hit: false, end: null };
}
function shotCall() {
  const L = App.lastShot, sim = App.sim;
  if (!L || !L.end || L.hit) return '';
  const foes = sim.b.squirrels.filter((q) => q.team !== L.team && !q.out);
  if (!foes.length) return '';
  const near = foes.reduce((m, q) => (Math.abs(q.x - L.end.x) < Math.abs(m.x - L.end.x) ? q : m)), d = (L.end.x - near.x) * L.facing, along = L.wind * L.facing;
  if (Math.abs(d) < SHOT_CLOSE) return 'So close!';
  return d < 0 ? (along < -SHOT_WIND ? 'The wind held it back' : 'Fell short') : along > SHOT_WIND ? 'The wind pushed it long' : 'Flew long';
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
  // where across the view an event is, for the cues: -1 at the left edge, 1 at the right, past 1 out of view (S5-04)
  const pan = (x) => (x - cam.x) / (cam.vw / 2 / cam.zoom);
  for (const ev of sim.drain()) {
    const v = vis(ev.sq);
    switch (ev.type) {
      case 'throw': App.ff = 1; if (v) { v.pose = 'throw'; v.poseT = 0.35; v.squash = 0.6; } sfx('throw', undefined, { pan: pan(sim.b.squirrels.find((q) => q.id === ev.sq).x) }); startShot(ev);
        if (b.teams[b.turn.team].human && ev.kind !== 'acorn' && ev.kind !== 'hedgeapple') say('Nut in the air. Tap or press Space for its trick.', true); if (b.teams[b.turn.team].human) buzz(10); break;
      case 'tap': fx.ring(ev.x, ev.y, 40); sfx('tap', undefined, { pan: pan(ev.x) }); break;
      case 'impact':
        if (ev.burst) { fx.flash(ev.x, ev.y, 70); fx.ring(ev.x, ev.y, 110, '#FFE9A8'); fx.dust(ev.x, ev.y, 30); fx.shards(ev.x, ev.y, 26); fx.leaves(ev.x, ev.y, 30, L.season); fx.chips(ev.x, ev.y, 14); cam.shake = Math.max(cam.shake, 1.1); sfx('burst', undefined, { pan: pan(ev.x) }); buzz([20, 30, 40]); }
        else { fx.dust(ev.x, ev.y, ev.on === 'terrain' ? 16 : 8, L.season === 'winter' && ev.on === 'terrain' ? '#E8ECEA' : '#8A6A44'); fx.ring(ev.x, ev.y, 34, '#FFF6C8'); sfx('thock', ev.kind, { on: ev.on, pan: pan(ev.x) }); if (ev.kind === 'hedgeapple') cam.shake = Math.max(cam.shake, 0.6); }
        if (ev.on === 'wood') { fx.chips(ev.x, ev.y, 12); fx.leaves(ev.x, ev.y, 12, L.season); }
        if (App.lastShot && App.lastShot.rec && ev.on === 'terrain') App.lastShot.end = { x: ev.x, y: ev.y };
        break;
      case 'thud': fx.dust(ev.x, ev.y, 10); sfx('thud', undefined, { pan: pan(ev.x) }); break;
      case 'rustle': fx.leaves(ev.x, ev.y, 4, L.season); sfx('rustle', undefined, { pan: pan(ev.x) }); break;
      case 'hit':
        if (App.lastShot) App.lastShot.hit = true;
        if (v) { v.pose = 'hit'; v.poseT = 0.55; v.squash = 0.9; v.flash = 0.18; }
        fx.text(ev.x + 36, ev.y - 150, '-' + Math.round(ev.dmg), '#FFE0DA', true); fx.stars(ev.x, ev.y - 20);
        fx.leaves(ev.x, ev.y, 18, L.season); fx.chips(ev.x, ev.y, 8); fx.ring(ev.x, ev.y, 52, '#F2C230');
        if (!App.reduced) { App.hitstop = 0.06; cam.shake = Math.max(cam.shake, 0.35); }
        { const hq = b.squirrels.find((s) => s.id === ev.sq); if (hq) say(`Hit ${hq.name} for ${Math.round(ev.dmg)}, grip ${Math.round(ev.grip)} left.`, true); }
        sfx('boing', undefined, { dmg: ev.dmg, pan: pan(ev.x) }); buzz(18);
        break;
      case 'wood': fx.chips(ev.x || 0, ev.y || 0, 0); break;
      case 'break': {
        renderer.trees.invalidate(ev.tree);
        fx.leaves(ev.x, ev.y, 16, L.season, L.trees[ev.tree].species); fx.chips(ev.x, ev.y, 12); sfx('crack', undefined, { pan: pan(ev.x) });
        hud.call('Crack!', 700);
        break;
      }
      case 'dislodge': if (v) { v.pose = 'fall'; v.poseT = 0; } sfx('chitter', sim.b.squirrels.find((q) => q.id === ev.sq).team, { pan: pan(ev.x) }); break;
      case 'land': if (v) { v.pose = 'idle'; v.squash = 0.7; } fx.dust(ev.x, ev.y, 6); sfx('land', undefined, { h: ev.h, pan: pan(ev.x) }); break;
      case 'ko': {
        const q = sim.b.squirrels.find((s) => s.id === ev.sq);
        if (v) { v.tumble = { from: ev.from, to: ev.to, t: 0 }; v.pose = 'fall'; }
        // follow the tumble into the leaf pile
        if (!sim.b.practice) { const mx = (ev.from.x + ev.to.x) / 2, my = Math.min(ev.from.y, ev.to.y) - 40; cam.set(mx, my, Math.max(cam.zoom, Math.min(1.1, cam.vw / 900)), false); App.koHold = 1.4; }
        fx.stars(ev.from.x, ev.from.y - 30); fx.chips(ev.from.x, ev.from.y, 10); fx.leaves(ev.from.x, ev.from.y - 10, 14, L.season);
        sfx('ko', undefined, { pan: pan(ev.from.x) }); buzz([20, 30, 40]);
        // the cheer is for the rival's loss: when the one human side loses a squirrel it stays quiet
        if (!(b.teams[q.team].human && b.teams.filter((tm) => tm.human).length === 1)) setTimeout(() => sfx('cheer'), 500);
        hud.call(`${q.name} is out!`, 1400);
        let said = `${q.name} of the ${TEAMS[q.team].short} is out, tumbling into the leaf pile.`;
        if (!sim.b.practice) {
          // the family that did it crows, or the family that lost the squirrel groans (taken in turn, not at random)
          const lost = b.teams[q.team].human, fam = lost ? 1 - q.team : q.team, pool = lost ? TAUNTS[fam] : GROANS[fam], line = pool[App.tauntN++ % pool.length];
          hud.taunt(`${TEAMS[fam].short}: "${line}"`, 2400); said += ` The ${TEAMS[fam].short} call out: ${line}`;
        }
        say(said, true);
        // the round's last knockout plays in slow motion (not with reduced motion)
        if (!App.reduced && sim.alive(q.team) === 0 && !sim.b.practice) App.slowT = 0.9;
        break;
      }
      case 'move': if (v) { v.path = ev.pts.slice(1); v.pathFrom = ev.pts[0]; v.pathT = 0; } break;
      case 'bird': {
        // a glancing bonk: the bird flaps off startled and the nut flies on
        const d = BIRDS[ev.bird]; fx.feathers(ev.x, ev.y, ev.bird); fx.ring(ev.x, ev.y, 30, '#FFF6C8');
        sfx(ev.bird === 'goose' ? 'honk' : 'squawk', ev.bird, { pan: pan(ev.x) }); hud.call(`Bonk! ${article(d.name)}`, 900); say(`The nut bounced off ${article(d.name).toLowerCase()}.`);
        break;
      }
      case 'snatch': {
        const d = BIRDS[ev.bird]; fx.feathers(ev.x, ev.y, ev.bird); sfx('squawk', ev.bird, { pan: pan(ev.x) });
        hud.call(`${cap(article(d.name))} snatched the acorn!`, 1300); say(`${cap(article(d.name))} snatched the acorn out of the air.`);
        break;
      }
      case 'miss': hud.call('Missed!', 600); say('Missed.', true); if (App.lastShot && App.lastShot.rec) App.lastShot.end = { x: ev.x, y: ev.y }; break;
      case 'turn': {
        App.ff = 1;
        const L = App.lastShot, call = L && L.rec ? shotCall() : '';
        if (call) { hud.call(call, 1400); say(call + '.', true); }
        if (L) { L.said = call; L.rec = false; }
        onTurnStart(false); if (!(App.koHold > 0)) frameCamera(false); else App.reframe = true; break;
      }
      case 'round': break;
      case 'roundEnd': case 'battleEnd': App.pendingEnd = { type: ev.type, t: wallNow() + 1.3 }; break;
      default: break;
    }
  }
}

const article = (n) => (/^[aeiou]/i.test(n) ? 'An ' : 'A ') + n;
const cap = (t) => t[0].toUpperCase() + t.slice(1);

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

// A Story level nudges the rival up or down the skill scale (its `skill` field); Quick Battles use the tier as picked.
function rivalTier() { return aiTier(App.setup.difficulty || 'medium', App.setup.mode === 'story' && App.level ? App.level.skill : 0); }

function updateAI() {
  const sim = App.sim, b = sim.b;
  if (App.scene !== 'battle' || screens.cur || App.paused || App.testPaused || b.phase !== 'aim' || App.pendingEnd) return false;
  // a plan made for another turn (tests and restarts can switch turns) is dropped
  if (App.aiActive && (App.aiActive.n !== b.turn.n || App.aiActive.team !== b.turn.team || App.aiActive.sim !== sim)) App.aiActive = null;
  if (b.teams[b.turn.team].human) return false;
  const diff = rivalTier();
  if (!App.aiActive) App.aiActive = { gen: planTurnGen(sim, diff), t0: wallNow(), plan: null, done: false, n: b.turn.n, team: b.turn.team, sim };
  const A = App.aiActive;
  if (!A.done) {
    const r = A.gen.next(performance.now() + 4); // the planner ends its slice by that time
    if (r.done) { A.plan = r.value; A.done = true; }
    return true;
  }
  if (!A.plan) { App.aiActive = null; sim.nextTurn(); return true; }
  const now = wallNow();
  if (!A.skip && now < A.t0 + A.plan.think) return true;
  // animate the aim, then throw
  if (!A.anim) A.anim = { t: 0, from: { ...b.teams[b.turn.team].aim } };
  A.anim.t += A.skip ? 1 : 1 / 30;
  const u = Math.min(1, A.anim.t / (App.reduced ? 0.2 : 0.6)), e = u * u * (3 - 2 * u);
  sim.setAim({ nut: A.plan.nut, angle: A.anim.from.angle + (A.plan.angle - A.anim.from.angle) * e, power: A.anim.from.power + (A.plan.power - A.anim.from.power) * e });
  if (u >= 1) {
    const plan = A.plan; App.aiActive = null;
    sim.throwNut({ nut: plan.nut, angle: plan.angle, power: plan.power, tapAt: plan.tapAt });
  }
  return true;
}

// The wind, the steam and the music's tension follow the battle a few times a second.
const STEAM_EARSHOT = 400; // world units beyond the edge of the view within which the steam can still be heard
const BIRD_AMBIENCE = { off: 0.2, some: 0.6, lots: 1 }; // how many birds the ambience carries, by the battle's birds setting
const TENSION_SECONDS = 10; // the music tightens when the turn timer has this long left
let soundT = 0;
function tensionNow() {
  const sim = App.sim, b = sim && sim.b;
  if (!b || App.scene !== 'battle' || b.practice || b.phase === 'roundEnd' || b.phase === 'battleEnd') return false;
  for (let i = 0; i < b.teams.length; i++) if (sim.alive(i) === 1 && b.squirrels.filter((q) => q.team === i && !q.dummy).length > 1) return true;
  const tt = App.save.settings.turnTimer;
  return !!(tt && b.phase === 'aim' && humanTurn() && App.turnElapsed > tt - TENSION_SECONDS);
}
function updateSoundscape() {
  const sim = App.sim;
  if (!sim || App.paused || performance.now() - soundT < 120) return;
  soundT = performance.now();
  const b = sim.b, cam = renderer.cam, st = App.level && App.level.steam, battle = App.scene === 'battle';
  ambienceParam('wind', battle ? Math.round(Math.min(1, Math.abs(b.wind)) * 20) / 20 : 0.3);
  ambienceParam('birds', BIRD_AMBIENCE[b.birdLevel] ?? 0.2);
  let steam = 0;
  if (st && b.steamLevel > 0) {
    const reach = cam.vw / 2 / cam.zoom + STEAM_EARSHOT, dx = Math.max(0, Math.abs(cam.x - st.x) - st.w / 2);
    steam = Math.max(0, 1 - dx / reach) * (0.35 + 0.65 * Math.min(1, b.steamLevel / STEAM_LEVELS.strong));
  }
  ambienceParam('steam', Math.round(steam * 20) / 20);
  setTension(tensionNow());
  if (screens.cur === 'shop' || screens.cur === 'results') playTheme(screens.cur); // the calm tunes for the acorn shop and the results card
}

function frame(now) {
  rafId = 0; inFrame = true;
  try {
    const dtw = Math.min(0.1, (now - last) / 1000); last = now;
    const t0 = App.time;
    App.time = App.clock != null ? App.clock : App.time + dtw;
    const dtt = App.time - t0; // follows the test clock, so captures with a fixed clock hold the birds still
    const resized = renderer.resize();
    if (resized && App.sim) frameCamera(true);
    pollPad();
    pauseAudio(App.paused && App.scene === 'battle');
    updateSoundscape();
    muffleAudio(App.scene === 'battle' && !App.paused && (App.hitstop > 0 || App.slowT > 0)); // the music goes dull for a hit-stop and the slow-motion knockout
    let busy = false;
    const sim = App.sim;
    if (sim && App.scene === 'battle' && !App.paused && !App.testPaused && !screens.cur) {
      if (App.hitstop > 0) App.hitstop -= dtw;
      sim.idle(dtt);
      if (sim.busy()) {
        acc += App.hitstop > 0 ? 0 : App.slowT > 0 ? dtw * 0.35 : dtw * App.ff;
        let n = 0;
        while (acc >= DT && n < 12 * App.ff) { stepOnce(); acc -= DT; n++; }
        busy = true;
        if (sim.b.phase === 'flight' && !renderer.cam.user && !(App.koHold > 0)) frameCamera(false);
        if (sim.b.phase === 'flight' && !App.reduced && (App.puffT = (App.puffT || 0) + dtw) > 0.035) { App.puffT = 0; for (const n of sim.b.nuts) if (n.state !== 'husk') renderer.fx.puff(n.x, n.y); }
      } else acc = 0;
      handleEvents(); // moves and test-driven changes emit events outside a sim step
      if (updateAI()) busy = true;
      if (App.pendingEnd && wallNow() >= App.pendingEnd.t) {
        const pe = App.pendingEnd; App.pendingEnd = null;
        if (pe.type === 'battleEnd') battleOver();
        else { const me = sim.b.teams.findIndex((t) => t.human); if (sim.b.result.winner === me) sfx('roundWin'); screens.show('shop', { team: me, round: sim.b.result.round, winner: sim.b.result.winner }); }
      } else if (App.pendingEnd) busy = true;
      // turn timer
      // (S6-04) only time the player could use counts: not on the pause card, behind a screen, or in a hidden tab
      const tt = App.save.settings.turnTimer;
      if (tt && sim.b.phase === 'aim' && humanTurn() && !document.hidden) {
        App.turnElapsed += dtw;
        if (App.turnElapsed > tt) { hud.call('Out of time!', 1400); say('Out of time. Your turn passes.'); sim.nextTurn(); }
      }
    }
    if (sim && App.scene === 'title') sim.idle(dtt);
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
    errorKicked = false;
  } catch (err) {
    showError(err);
    inFrame = false;
    if (!errorKicked) { errorKicked = true; kick(); } // one more frame, so the title can still animate; a repeating error stops here
  }
  inFrame = false;
}

function updateGuide() {
  const sim = App.sim, b = sim.b;
  if (App.scene !== 'battle' || b.phase !== 'aim' || !b.teams[b.turn.team].human || App.aiActive) { App.aimGuide = null; App.shotTrail = null; return; }
  const set = App.save.settings.aimGuide;
  let frac = App.setup.mode === 'practice' ? 1 : set === 'always' ? 0.6 : set === 'off' ? 0 : GUIDE[App.setup.difficulty || 'medium'] ?? 0.22;
  // where the last throw went stays on screen for the next aim, unless the Aim guide is off
  App.shotTrail = set !== 'off' && App.lastShot && App.lastShot.pts.length > 1 ? App.lastShot.pts : null;
  if (!frac) { App.aimGuide = null; return; }
  const aim = b.teams[b.turn.team].aim, q = sim.active();
  // the birds fly while the player aims, so with any aloft the guide is worked out again as they move (P-N05): it is what a throw made now would do
  const aloft = (b.birds || []).some((x) => !x.flee), key = [aim.nut, aim.angle, aim.power, q.x, q.y, b.wind, b.turn.n, frac, aloft ? Math.round(b.birdT * 15) : 0].join(',');
  if (key === App.guideKey) return;
  App.guideKey = key;
  let pr = sim.preview(aim, { every: 4, squirrels: false, birds: aloft }), bird = null;
  if (pr.impact && pr.impact.type === 'bird') {
    // the dots stay the clear arc; a ring marks the bird that would meet it
    bird = { x: pr.impact.bx, y: pr.impact.by, kind: sim.b.birds[pr.impact.bird].k };
    pr = sim.preview(aim, { every: 4, squirrels: false });
  }
  const n = Math.max(2, Math.round(pr.pts.length * frac));
  App.aimGuide = { pts: pr.pts.slice(1, n), bird };
}

function showError(err) {
  console.error(err);
  const el = document.getElementById('boot-error');
  el.hidden = false; el.textContent = 'Something went wrong: ' + (err && err.message ? err.message : err) + ' ';
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.textContent = 'Back to menu';
  b.addEventListener('click', backToMenu);
  el.append(b);
}
function backToMenu() {
  const el = document.getElementById('boot-error');
  el.hidden = true; el.textContent = ''; errorKicked = false;
  App.sim = null; App.aiActive = null; App.pendingEnd = null; App.paused = false;
  try { showTitle(); } catch (err) { showError(err); }
}
window.addEventListener('error', (e) => showError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => showError(e.reason));

window.addEventListener('resize', () => kick());
document.addEventListener('visibilitychange', () => { handleVisibility(document.hidden); kick(); });
window.addEventListener('pagehide', () => handleVisibility(true));
window.addEventListener('pageshow', () => handleVisibility(document.hidden));

// ---------------------------------------------------------------------------------------------------------------
// boot
installHooks(App, {
  stepOnce, startBattle, showTitle, rivalTier, frameCamera, battleOver, planTurn, hashBattle, ALL, STORY, persist, applySettings,
  idle: () => App.ready && App.loading === 0 && !(App.sim && App.sim.busy() && App.scene === 'battle') && !App.aiActive && !App.pendingEnd && !App.busy,
});
try {
  applySettings();
  loadSprites();
  loadSoil();
  initAudio(App.save.settings);
  showTitle();
  if (!storageWorks()) tellUnsaved();
  App.ready = true;
  document.body.dataset.ready = '1';
} catch (err) { showError(err); }

export { audioState, SQ_UP };

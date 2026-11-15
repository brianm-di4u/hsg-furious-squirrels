// Saves: one versioned JSON object in localStorage, wrapped in try/catch with an in-memory fallback so the game
// works when storage is blocked. Pattern from games/Cart Racing/src/js/save.js (Hot Springs Games, MIT).
import { ACORNS, PURSE_CAP } from './sim/const.js';
const KEY = 'hsg-furious-squirrels-v1';
const STORY_LEVELS = 12;
const TIER_NAMES = ['easy', 'medium', 'sharp', 'hard'];
// counters the Records screen shows that only ever grow: two tabs each add what they earned (streaks are kept apart)
const TALLIES = ['battles', 'wins', 'kos', 'throws', 'hits', 'winsEasy', 'winsMedium', 'winsSharp', 'winsHard'];
const TIER_COUNT = 4; // difficulty tiers a star can be earned on: 1 Easy, 2 Medium, 3 Sharp, 4 Hard (0 = not earned)
let mem = null;

export const DEFAULT_SAVE = () => ({
  v: 1,
  settings: { sound: true, music: true, ambience: true, volume: 0.5, sfxVol: 1, musicVol: 1, reducedMotion: null, aimGuide: 'auto', turnTimer: 0, textScale: 1, difficulty: 'medium', tutorial: true },
  story: { team: null, unlocked: 1, stars: {}, nuts: [], acorns: ACORNS.start, starTier: {}, bestTurns: {}, losses: {}, notes: [] },
  quick: { level: 'story-01', team: 0, size: 3, rounds: 1, wind: 'normal', steam: 'on', birds: 'some', loadout: 'all', difficulty: 'medium' },
  stats: { battles: 0, wins: 0, kos: 0, bestShot: 0, throws: 0, hits: 0, streak: 0, bestStreak: 0, winsEasy: 0, winsMedium: 0, winsSharp: 0, winsHard: 0 },
  resume: null,
});

const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const put = (target, key, value) => Object.defineProperty(target, key, { value: copy(value), writable: true, enumerable: true, configurable: true });
let serial = 0;
const revision = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + (++serial) + '-' + Math.random().toString(36).slice(2);
const epoch = s => s.progressGeneration ?? null;
const slot = s => ({ generation: s.resumeGeneration ?? null, revision: s.resumeRevision ?? null, resume: s.resume });
// The highest tier each star of a level was earned on. Stars a player already had before tiers were recorded count as
// earned on Medium, and a star count that outruns its record is filled in the same way.
export function starTiers(story, id) {
  const n = Math.min(3, story.stars[id] || 0), rec = Array.isArray(story.starTier?.[id]) ? story.starTier[id] : [];
  return [0, 1, 2].map((i) => rec[i] || (i < n ? 2 : 0));
}
const progress = s => ({ epoch: epoch(s), story: s.story, quick: s.quick, stats: s.stats, slot: slot(s) });
// observed tracks already captured local mutations, not successful persistence.
// Pending intents survive reads/rebases/failures; only setItem success acknowledges them.
let observed = null, acknowledged = null, run = null, warned = false;
const pending = { settings: {}, quick: {}, team: null, earned: [], resume: null, reset: null };

function decoded(s) {
  if (!object(s) || s.v !== 1) return null;
  const d = DEFAULT_SAVE(), out = { ...d, ...s };
  for (const key of ['settings', 'story', 'quick', 'stats']) out[key] = { ...d[key], ...(object(s[key]) ? s[key] : {}) };
  out.story.stars = { ...(object(out.story.stars) ? out.story.stars : {}) };
  out.story.nuts = Array.isArray(out.story.nuts) ? out.story.nuts.slice() : [];
  for (const key of ['unlocked']) if (!number(out.story[key])) out.story[key] = d.story[key];
  // the Story purse (acorns carried between battles) and, per level, the highest difficulty each of its three stars
  // (won, nobody out, within par) was earned on; a save from before both has neither and loads with the defaults
  out.story.acorns = number(out.story.acorns) ? Math.min(PURSE_CAP, Math.floor(out.story.acorns)) : d.story.acorns;
  out.story.starTier = object(out.story.starTier) ? { ...out.story.starTier } : {};
  for (const [id, slots] of Object.entries(out.story.starTier)) {
    if (Array.isArray(slots) && slots.length === 3 && slots.every((n) => Number.isInteger(n) && n >= 0 && n <= TIER_COUNT)) out.story.starTier[id] = slots.slice();
    else delete out.story.starTier[id];
  }
  // the fewest turns each Story battle was won in (a Records figure); a damaged entry is dropped, never guessed at
  out.story.bestTurns = object(out.story.bestTurns) ? { ...out.story.bestTurns } : {};
  for (const [id, n] of Object.entries(out.story.bestTurns)) if (!(Number.isInteger(n) && n >= 1 && n <= 999)) delete out.story.bestTurns[id];
  // the Field Notes read so far (ids from data/facts.json); anything else in the list is dropped
  out.story.notes = Array.isArray(out.story.notes) ? [...new Set(out.story.notes.filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 40))].slice(0, 200) : [];
  // consecutive losses per Story battle (S2-18), cleared by a win; a damaged entry is dropped
  out.story.losses = object(out.story.losses) ? { ...out.story.losses } : {};
  for (const [id, n] of Object.entries(out.story.losses)) if (!(Number.isInteger(n) && n >= 1 && n <= 99)) delete out.story.losses[id];
  for (const key of Object.keys(d.stats)) if (!number(out.stats[key])) out.stats[key] = 0;
  // a hand-edited or damaged save must not feed odd values to CSS, audio or the Story map
  if (![1, 1.25, 1.5].includes(out.settings.textScale)) out.settings.textScale = d.settings.textScale;
  if (!TIER_NAMES.includes(out.settings.difficulty)) out.settings.difficulty = d.settings.difficulty;
  if (!TIER_NAMES.includes(out.quick.difficulty)) out.quick.difficulty = d.quick.difficulty;
  if (typeof out.settings.ambience !== 'boolean') out.settings.ambience = d.settings.ambience;
  // the effects and music levels (S5-08): 1 is the level the game always had, so a save without them sounds as before
  for (const key of ['sfxVol', 'musicVol']) if (!(typeof out.settings[key] === 'number' && out.settings[key] >= 0 && out.settings[key] <= 1)) out.settings[key] = d.settings[key];
  out.settings.volume = typeof out.settings.volume === 'number' && Number.isFinite(out.settings.volume) ? Math.min(1, Math.max(0, out.settings.volume)) : d.settings.volume;
  out.story.unlocked = Math.min(STORY_LEVELS, Math.max(1, Math.floor(out.story.unlocked)));
  for (const [id, n] of Object.entries(out.story.stars)) { if (number(n)) out.story.stars[id] = Math.min(3, Math.floor(n)); else delete out.story.stars[id]; }
  // The existing v1 setup/battle/levelRev group stays opaque. Layout validity is checked by main.
  if (out.resume !== null && !object(out.resume)) return null;
  for (const key of ['progressGeneration', 'resumeGeneration', 'resumeRevision']) {
    if (Object.hasOwn(out, key) && (typeof out[key] !== 'string' || !out[key])) return null;
  }
  return out;
}
// A save that cannot be read is damaged: keep a copy under KEY-bad and treat the slot as empty so the next write
// replaces it. Only a save from a newer version (v > 1) is refused, and left alone.
let notice_ = '', raised = { bad: false, newer: false };
const raise = (kind, text) => { if (!raised[kind]) { raised[kind] = true; notice_ = text; } };
export function takeSaveNotice() { const n = notice_; notice_ = ''; return n; }
// Whether this browser lets the page keep anything at all (a private window or blocked site data often does not).
export function storageWorks() {
  try { const k = KEY + '-probe'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k); return true; } catch { return false; }
}
function read() {
  let raw;
  try { raw = window.localStorage.getItem(KEY); } catch { return { valid: false, save: null }; }
  if (!raw) return { valid: true, save: DEFAULT_SAVE() };
  let parsed = null, save = null;
  try { parsed = JSON.parse(raw); save = decoded(parsed); } catch { save = null; }
  if (save) return { valid: true, save };
  if (object(parsed) && typeof parsed.v === 'number' && parsed.v > 1) {
    raise('newer', 'This save is from a newer version of the game, so progress will not be saved');
    return { valid: false, save: null };
  }
  try { window.localStorage.setItem(KEY + '-bad', raw); } catch { /* storage full or blocked: the copy is best effort */ }
  raise('bad', 'Saved data could not be read, starting fresh');
  return { valid: true, save: DEFAULT_SAVE() };
}
function sync(s, value) {
  for (const key of Object.keys(s)) if (!Object.hasOwn(value, key)) delete s[key];
  for (const [key, item] of Object.entries(value)) put(s, key, item);
  mem = copy(s); observed = copy(s);
}
function capture(s, intent, fresh, fields = []) {
  const before = observed || DEFAULT_SAVE(), localEpoch = epoch(before);
  for (const key of Object.keys(s.settings || {})) {
    if (!same(s.settings[key], before.settings[key]) || (intent === 'settings' && fields.includes(key))) put(pending.settings, key, s.settings[key]);
  }
  if (intent !== 'reset') {
    const setupEpoch = ['quick', 'family'].includes(intent) && fresh.valid ? epoch(fresh.save) : localEpoch;
    for (const key of Object.keys(s.quick || {})) {
      if (!same(s.quick[key], before.quick[key]) || (intent === 'quick' && fields.includes(key))) put(pending.quick, key, { value: s.quick[key], epoch: setupEpoch });
    }
    if (!same(s.story.team, before.story.team) || intent === 'family') pending.team = { value: s.story.team, epoch: setupEpoch };
    const earned = { epoch: intent === 'result' && run ? run.epoch : localEpoch, stars: {}, nuts: [], stats: {}, unlocked: 0, bestShot: 0, tiers: {}, acorns: null, turns: {}, bestStreak: 0, streak: null, losses: {}, notes: [] };
    for (const [id, n] of Object.entries(s.story.stars || {})) if (number(n) && n > (before.story.stars[id] || 0)) put(earned.stars, id, n);
    earned.nuts = (s.story.nuts || []).filter(id => !before.story.nuts.includes(id));
    earned.notes = (s.story.notes || []).filter(id => !(before.story.notes || []).includes(id));
    if (s.story.unlocked > before.story.unlocked) earned.unlocked = s.story.unlocked;
    for (const key of TALLIES) earned.stats[key] = Math.max(0, s.stats[key] - before.stats[key]);
    if (s.stats.bestStreak > before.stats.bestStreak) earned.bestStreak = s.stats.bestStreak;
    if (s.stats.streak !== before.stats.streak) earned.streak = s.stats.streak;
    for (const [id, n] of Object.entries(s.story.bestTurns || {})) if (Number.isInteger(n) && n >= 1 && n < (before.story.bestTurns?.[id] ?? Infinity)) earned.turns[id] = n;
    if (s.stats.bestShot > before.stats.bestShot) earned.bestShot = s.stats.bestShot;
    for (const [id, slots] of Object.entries(s.story.starTier || {})) {
      const old = before.story.starTier?.[id] || [0, 0, 0];
      if (Array.isArray(slots) && slots.some((n, i) => n > (old[i] || 0))) put(earned.tiers, id, slots);
    }
    if (number(s.story.acorns) && s.story.acorns !== before.story.acorns) earned.acorns = s.story.acorns;
    // a loss run that changed (a win clears it to 0); the latest value wins when two tabs disagree
    for (const id of new Set([...Object.keys(s.story.losses || {}), ...Object.keys(before.story.losses || {})])) {
      const n = (s.story.losses || {})[id] || 0;
      if (n !== ((before.story.losses || {})[id] || 0)) earned.losses[id] = n;
    }
    if (!(intent === 'result' && run?.invalidated) && (Object.keys(earned.stars).length || earned.nuts.length || earned.notes.length || earned.unlocked || earned.bestShot || earned.acorns != null || Object.keys(earned.tiers).length || Object.keys(earned.turns).length || Object.keys(earned.losses).length || earned.bestStreak || earned.streak != null || Object.values(earned.stats).some(Boolean))) pending.earned.push(earned);
  }
  mem = copy(s); observed = copy(s);
}
function notice(callback) { if (!warned && callback) { warned = true; callback(); } }
function merged(latest, callback) {
  let value = copy(latest), resetApplied = false;
  if (pending.reset) {
    if (pending.reset.known && same(progress(latest), pending.reset.expected)) {
      const d = DEFAULT_SAVE();
      value = { ...value, story: d.story, quick: d.quick, stats: d.stats, resume: null,
        progressGeneration: pending.reset.generation, resumeGeneration: pending.reset.resumeGeneration, resumeRevision: pending.reset.resumeRevision };
      resetApplied = true;
    } else { pending.reset = null; notice(callback); }
  }
  for (const [key, item] of Object.entries(pending.settings)) put(value.settings, key, item);
  for (const [key, item] of Object.entries(pending.quick)) {
    if (item.epoch === epoch(value)) put(value.quick, key, item.value); else notice(callback);
  }
  if (pending.team) { if (pending.team.epoch === epoch(value)) value.story.team = pending.team.value; else notice(callback); }
  for (const e of pending.earned) if (e.epoch === epoch(value)) {
    value.story.unlocked = Math.max(value.story.unlocked, e.unlocked);
    for (const [id, n] of Object.entries(e.stars)) put(value.story.stars, id, Math.max(value.story.stars[id] || 0, n));
    value.story.nuts = [...new Set([...value.story.nuts, ...e.nuts])];
    value.story.notes = [...new Set([...value.story.notes, ...e.notes])];
    for (const key of TALLIES) value.stats[key] += e.stats[key];
    if (e.streak != null) value.stats.streak = e.streak;
    value.stats.bestStreak = Math.max(value.stats.bestStreak, e.bestStreak || 0, value.stats.streak);
    for (const [id, n] of Object.entries(e.turns || {})) value.story.bestTurns[id] = Math.min(n, value.story.bestTurns[id] ?? Infinity);
    value.stats.bestShot = Math.max(value.stats.bestShot, e.bestShot);
    for (const [id, slots] of Object.entries(e.tiers || {})) {
      const old = value.story.starTier[id] || [0, 0, 0];
      put(value.story.starTier, id, slots.map((n, i) => Math.max(n, old[i] || 0)));
    }
    if (e.acorns != null) value.story.acorns = e.acorns;
    for (const [id, n] of Object.entries(e.losses || {})) { if (n > 0) put(value.story.losses, id, n); else delete value.story.losses[id]; }
  } else notice(callback);
  let resumeApplied = false;
  if (pending.resume) {
    const p = pending.resume;
    if (p.known && p.epoch === epoch(value) && same(slot(latest), p.expected)) {
      value.resume = copy(p.value);
      value.resumeGeneration = p.newGeneration || !latest.resumeGeneration ? p.generation : latest.resumeGeneration;
      value.resumeRevision = p.revision; resumeApplied = true;
    } else { pending.resume = null; notice(callback); }
  }
  return { value, resetApplied, resumeApplied };
}
function commit(s, fresh, callback) {
  if (!fresh.valid) { mem = copy(s); observed = copy(s); return false; }
  const result = merged(fresh.save, callback);
  sync(s, result.value);
  try { window.localStorage.setItem(KEY, JSON.stringify(result.value)); }
  catch { return false; }
  acknowledged = copy(result.value);
  if (result.resumeApplied && run) { run.expected = copy(slot(result.value)); run.known = true; }
  if (result.resetApplied && run) run.invalidated = true;
  pending.settings = {}; pending.quick = {}; pending.team = null; pending.earned = []; pending.resume = null; pending.reset = null;
  return true;
}
export function loadSave() {
  if (mem && (Object.keys(pending.settings).length || Object.keys(pending.quick).length || pending.team || pending.earned.length || pending.resume || pending.reset)) return copy(mem);
  const fresh = read(), value = fresh.valid ? fresh.save : mem || DEFAULT_SAVE();
  mem = copy(value); observed = copy(value); acknowledged = fresh.valid ? copy(value) : null;
  return copy(value);
}
export function refreshSave(s, notify) {
  const fresh = read(); capture(s, 'merge', fresh);
  if (fresh.valid) sync(s, merged(fresh.save, notify).value);
  return s;
}
export function beginBattleSave(s, { mode, resume = false, levelNumber = 0, notify } = {}) {
  const fresh = read(); capture(s, 'merge', fresh);
  const current = fresh.valid ? merged(fresh.save, notify).value : copy(s);
  sync(s, current);
  if (mode === 'story' && !resume && levelNumber > current.story.unlocked) return { started: false, reason: 'locked' };
  if (resume) {
    // Explicit Continue discards a stale slot intent and reads the latest whole saved battle.
    pending.resume = null;
    const r = fresh.valid ? fresh.save.resume : current.resume;
    if (!r) return { started: false, reason: 'missing' };
    s.resume = copy(r); sync(s, s);
    run = { mode, epoch: fresh.valid ? epoch(fresh.save) : epoch(current), expected: copy(slot(fresh.valid ? fresh.save : acknowledged || current)), known: fresh.valid || !!acknowledged, invalidated: false };
    warned = false;
    return { started: true, resume: copy(r) };
  }
  run = { mode, epoch: epoch(current), expected: copy(slot(fresh.valid ? fresh.save : acknowledged || current)), known: fresh.valid || !!acknowledged, invalidated: false };
  warned = false;
  if (mode === 'story') {
    pending.resume = { known: run.known, epoch: run.epoch, expected: copy(run.expected), value: null, newGeneration: true, generation: revision(), revision: revision() };
    s.resume = null;
    commit(s, fresh, notify);
  }
  return { started: true };
}
export function writeSave(s, { intent = 'merge', fields = [], expectedResume, notify } = {}) {
  const fresh = read(), invalidSlot = intent === 'invalidate' ? { ...slot(s), resume: copy(expectedResume) } : null;
  capture(s, intent, fresh, fields);
  if (intent === 'reset') {
    const original = fresh.valid ? fresh.save : acknowledged;
    pending.quick = {}; pending.team = null; pending.earned = []; pending.resume = null;
    pending.reset = { known: !!original, expected: original ? copy(progress(original)) : null, generation: revision(), resumeGeneration: revision(), resumeRevision: revision() };
    if (run) run.invalidated = true;
  } else if (intent === 'turn' || intent === 'clear' || intent === 'invalidate' || (intent === 'result' && run?.mode === 'story')) {
    const previous = pending.resume;
    const expected = intent === 'invalidate' ? invalidSlot : previous?.expected || run?.expected;
    pending.resume = { known: intent === 'invalidate' ? fresh.valid : previous?.known ?? !!run?.known,
      epoch: intent === 'invalidate' ? epoch(observed) : previous?.epoch ?? run?.epoch,
      expected: copy(expected), value: intent === 'turn' ? copy(s.resume) : null,
      newGeneration: intent !== 'turn' || !!previous?.newGeneration,
      generation: previous?.generation || revision(), revision: revision() };
    if (run?.invalidated) pending.resume.known = false;
  }
  return commit(s, fresh, notify);
}

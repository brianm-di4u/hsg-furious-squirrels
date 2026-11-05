// Saves: one versioned JSON object in localStorage, wrapped in try/catch with an in-memory fallback so the game
// works when storage is blocked. Pattern from games/Cart Racing/src/js/save.js (Hot Springs Games, MIT).
const KEY = 'hsg-furious-squirrels-v1';
let mem = null;

export const DEFAULT_SAVE = () => ({
  v: 1,
  settings: { sound: true, music: true, volume: 0.5, reducedMotion: null, aimGuide: 'auto', turnTimer: 0, textScale: 1, difficulty: 'medium', tutorial: true },
  story: { team: null, unlocked: 1, stars: {}, nuts: [] },
  quick: { level: 'story-01', team: 0, size: 3, rounds: 1, wind: 'normal', steam: 'on', birds: 'some', loadout: 'all', difficulty: 'medium' },
  stats: { battles: 0, wins: 0, kos: 0, bestShot: 0 },
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
  for (const key of Object.keys(d.stats)) if (!number(out.stats[key])) out.stats[key] = 0;
  // The existing v1 setup/battle/levelRev group stays opaque. Layout validity is checked by main.
  if (out.resume !== null && !object(out.resume)) return null;
  for (const key of ['progressGeneration', 'resumeGeneration', 'resumeRevision']) {
    if (Object.hasOwn(out, key) && (typeof out[key] !== 'string' || !out[key])) return null;
  }
  return out;
}
function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { valid: true, save: DEFAULT_SAVE() };
    const save = decoded(JSON.parse(raw));
    return { valid: !!save, save };
  } catch { return { valid: false, save: null }; }
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
    const earned = { epoch: intent === 'result' && run ? run.epoch : localEpoch, stars: {}, nuts: [], stats: {}, unlocked: 0, bestShot: 0 };
    for (const [id, n] of Object.entries(s.story.stars || {})) if (number(n) && n > (before.story.stars[id] || 0)) put(earned.stars, id, n);
    earned.nuts = (s.story.nuts || []).filter(id => !before.story.nuts.includes(id));
    if (s.story.unlocked > before.story.unlocked) earned.unlocked = s.story.unlocked;
    for (const key of ['battles', 'wins', 'kos']) earned.stats[key] = Math.max(0, s.stats[key] - before.stats[key]);
    if (s.stats.bestShot > before.stats.bestShot) earned.bestShot = s.stats.bestShot;
    if (!(intent === 'result' && run?.invalidated) && (Object.keys(earned.stars).length || earned.nuts.length || earned.unlocked || earned.bestShot || Object.values(earned.stats).some(Boolean))) pending.earned.push(earned);
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
    for (const key of ['battles', 'wins', 'kos']) value.stats[key] += e.stats[key];
    value.stats.bestShot = Math.max(value.stats.bestShot, e.bestShot);
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

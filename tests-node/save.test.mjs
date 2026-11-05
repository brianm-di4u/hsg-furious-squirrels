import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const MODULE = new URL('../src/js/save.js', import.meta.url);
const READER = new URL('../test-fixtures/save-v1-reader.mjs', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(new URL('../test-fixtures/save-v1-earned-story.json', import.meta.url), 'utf8'));
const copy = value => JSON.parse(JSON.stringify(value));
let serial = 0;
function rig(initial = null) {
  let raw = initial === null ? null : JSON.stringify(initial);
  const storage = { readBlocked: false, writeBlocked: false, writes: 0, getItem() { if (this.readBlocked) throw Error('blocked'); return raw; }, setItem(_key, value) { if (this.writeBlocked) throw Error('quota'); raw = value; this.writes++; } };
  globalThis.window = { localStorage: storage };
  return { storage, get raw() { return raw; }, set raw(value) { raw = value; }, get saved() { return raw === null ? null : JSON.parse(raw); }, async tab(source = MODULE) { const m = await import(source.href + '?save-test=' + (++serial)); const s = m.loadSave(); const notices = []; return { m, s, notices, write(intent = 'merge', fields = []) { return m.writeSave(s, { intent, fields, notify: () => notices.push('conflict') }); }, begin(mode = 'story', resume = false, levelNumber = 1) { return m.beginBattleSave?.(s, { mode, resume, levelNumber, notify: () => notices.push('conflict') }); }, reset() { const settings = s.settings; for (const k of Object.keys(s)) delete s[k]; Object.assign(s, m.DEFAULT_SAVE(), { settings }); return this.write('reset'); } }; } };
}
function turn(a, n = 1) { const r = copy(fixture.resume); r.battle.turn.n += n; r.battle.rng = { ...(r.battle.rng || {}), ownedTest: n }; a.s.resume = r; return r; }
function earn(a, n = 1) { a.s.story.unlocked += n; a.s.story.stars['story-01'] = n; a.s.story.nuts.push('owned-' + n); a.s.stats.battles++; a.s.stats.wins++; a.s.stats.kos += n; a.s.stats.bestShot = Math.max(a.s.stats.bestShot, n * 5); }

test('behavior: stale Sound preserves a newer complete committed Story resume', async () => {
  const r = rig(), b = await r.tab(); r.raw = JSON.stringify(fixture); b.s.settings.sound = false; b.write('settings', ['sound']);
  assert.deepEqual(r.saved.resume, fixture.resume); assert.equal(r.saved.settings.sound, false);
});
test('behavior: independent preferences and Quick setup edits retain each other', async () => {
  const r = rig(), a = await r.tab(), b = await r.tab(); a.s.settings.music = false; a.s.quick.birds = 'lots'; a.write('quick', ['birds']);
  b.s.settings.volume = .2; b.s.quick.rounds = 5; b.write('quick', ['rounds']);
  assert.equal(r.saved.settings.music, false); assert.equal(r.saved.settings.volume, .2); assert.equal(r.saved.quick.birds, 'lots'); assert.equal(r.saved.quick.rounds, 5);
});
test('behavior: active turn autosave retains remote preference and its complete new snapshot', async () => {
  const r = rig(fixture), a = await r.tab(), b = await r.tab(); a.begin('story', true); b.s.settings.sound = false; b.write('settings', ['sound']); const next = turn(a); a.write('turn');
  assert.deepEqual(r.saved.resume, next); assert.equal(r.saved.settings.sound, false); assert.equal(a.s.settings.sound, false);
});
test('behavior: independent earned progress and stats survive both writers', async () => {
  const r = rig(), a = await r.tab(), b = await r.tab(); earn(a, 2); a.write('result'); earn(b, 3); b.write('result');
  assert.equal(r.saved.story.unlocked, 4); assert.equal(r.saved.story.stars['story-01'], 3); assert.deepEqual(r.saved.story.nuts, ['owned-2', 'owned-3']); assert.equal(r.saved.stats.battles, 2); assert.equal(r.saved.stats.kos, 5);
});
test('legacy fixture forward and original reader backward preserve the opaque whole group', async () => {
  const r = rig(fixture), a = await r.tab(); assert.deepEqual(a.s.resume, fixture.resume); a.begin('story', true); const next = turn(a); a.write('turn'); const old = await r.tab(READER); assert.deepEqual(old.s.resume, next); assert.equal(old.s.v, 1);
});
test('same-generation continued tabs reject a newer revision without hybridizing data', async () => {
  const r = rig({ ...fixture, resumeGeneration: 'g', resumeRevision: 'r' }), a = await r.tab(), b = await r.tab(); a.begin('story', true); b.begin('story', true); const winner = turn(a, 2); a.write('turn'); turn(b, 3); b.write('turn');
  assert.deepEqual(r.saved.resume, winner); assert.equal(r.saved.resumeGeneration, 'g'); assert.equal(b.notices.length, 1); turn(b, 4); b.write('turn'); assert.equal(b.notices.length, 1); assert.deepEqual(r.saved.resume, winner);
});
test('whole snapshot guard also catches a changed battle with unchanged metadata', async () => {
  const r = rig({ ...fixture, resumeGeneration: 'g', resumeRevision: 'r' }), a = await r.tab(); a.begin('story', true); const foreign = r.saved; foreign.resume.battle.turn.n += 9; r.raw = JSON.stringify(foreign); turn(a); a.write('turn'); assert.deepEqual(r.saved.resume, foreign.resume); assert.equal(a.notices.length, 1);
});
test('new Story advances generation even null to null', async () => {
  const r = rig(), a = await r.tab(); a.begin(); const old = r.saved.resumeGeneration; a.begin(); assert.equal(r.saved.resume, null); assert.notEqual(r.saved.resumeGeneration, old);
});
test('stale Quit cannot clear a new Story reservation or resurrect an old run', async () => {
  const r = rig(fixture), a = await r.tab(), b = await r.tab(); a.begin('story', true); b.begin(); const newer = turn(b, 2); b.write('turn'); a.s.resume = null; a.write('clear'); assert.deepEqual(r.saved.resume, newer);
});
test('Story result clears only its owned slot and advances generation', async () => {
  const r = rig(fixture), a = await r.tab(); a.begin('story', true); const before = r.saved.resumeGeneration; earn(a); a.s.resume = null; a.write('result'); assert.equal(r.saved.resume, null); assert.notEqual(r.saved.resumeGeneration, before); assert.equal(r.saved.stats.battles, fixture.stats.battles + 1);
});
test('old legitimate result merges awards but cannot clear a foreign new run', async () => {
  const r = rig(fixture), a = await r.tab(), b = await r.tab(); a.begin('story', true); b.begin(); const foreign = turn(b, 2); b.write('turn'); earn(a); a.s.resume = null; a.write('result'); assert.deepEqual(r.saved.resume, foreign); assert.equal(r.saved.stats.battles, fixture.stats.battles + 1);
});
test('Quick and Practice start, results and plain Quit do not erase a Story slot', async () => {
  const r = rig(fixture), a = await r.tab(); for (const mode of ['quick', 'practice']) { a.begin(mode); earn(a); a.write('result'); a.write(); assert.deepEqual(r.saved.resume, fixture.resume); }
});
test('all failed explicit preferences survive later progress success with foreign preferences', async () => {
  const r = rig(fixture), a = await r.tab(), b = await r.tab(); a.begin('story', true); r.storage.writeBlocked = true; a.s.settings.sound = false; assert.equal(a.write('settings', ['sound']), false); a.s.settings.textScale = 1.5; assert.equal(a.write('settings', ['textScale']), false);
  r.storage.writeBlocked = false; b.s.settings.music = false; b.write('settings', ['music']); turn(a); a.write('turn'); assert.equal(r.saved.settings.sound, false); assert.equal(r.saved.settings.textScale, 1.5); assert.equal(r.saved.settings.music, false);
});
test('failed new reservation retries its original slot on the next real turn save', async () => {
  const r = rig(fixture), a = await r.tab(); r.storage.writeBlocked = true; a.begin(); const generation = a.s.resumeGeneration; assert.deepEqual(r.saved.resume, fixture.resume); r.storage.writeBlocked = false; const next = turn(a); a.write('turn'); assert.deepEqual(r.saved.resume, next); assert.equal(r.saved.resumeGeneration, generation);
});
test('failed old reservation cannot claim a later foreign run; fresh explicit New can', async () => {
  const r = rig(fixture), a = await r.tab(), b = await r.tab(); r.storage.writeBlocked = true; a.begin(); r.storage.writeBlocked = false; b.begin(); const foreign = turn(b, 2); b.write('turn'); turn(a); a.write('turn'); assert.deepEqual(r.saved.resume, foreign); assert.equal(a.notices.length, 1); a.begin(); const own = turn(a, 3); a.write('turn'); assert.deepEqual(r.saved.resume, own);
});
test('unknown blocked startup does not later gain stale slot overwrite authority', async () => {
  const r = rig(fixture); r.storage.readBlocked = true; const a = await r.tab(); a.begin(); turn(a); a.write('turn'); r.storage.readBlocked = false; const b = await r.tab(); b.begin(); const foreign = turn(b, 3); b.write('turn'); a.write('turn'); assert.deepEqual(r.saved.resume, foreign);
});
test('failed result awards survive replacing the unsaved run with a new Story once', async () => {
  const r = rig(fixture), a = await r.tab(); a.begin('story', true); r.storage.writeBlocked = true; earn(a, 2); a.s.resume = null; assert.equal(a.write('result'), false); r.storage.writeBlocked = false; a.begin(); assert.equal(r.saved.stats.battles, fixture.stats.battles + 1); assert.equal(r.saved.story.stars['story-01'], 2); turn(a); a.write('turn'); a.write(); assert.equal(r.saved.stats.battles, fixture.stats.battles + 1);
});
test('Reset retains latest preferences and resets original story Quick stats and resume domains', async () => {
  const r = rig(fixture), a = await r.tab(), b = await r.tab(); b.s.settings.music = false; b.write('settings', ['music']); a.s.settings.textScale = 1.5; a.write('settings', ['textScale']); a.reset(); assert.equal(r.saved.settings.music, false); assert.equal(r.saved.settings.textScale, 1.5); assert.deepEqual(r.saved.story, a.m.DEFAULT_SAVE().story); assert.deepEqual(r.saved.quick, a.m.DEFAULT_SAVE().quick); assert.deepEqual(r.saved.stats, a.m.DEFAULT_SAVE().stats); assert.equal(r.saved.resume, null); assert.equal(typeof r.saved.progressGeneration, 'string');
});
test('pre-reset failed Quick family and awards cannot replay through later setting success', async () => {
  const r = rig(fixture), a = await r.tab(), b = await r.tab(); r.storage.writeBlocked = true; a.s.quick.rounds = 5; a.write('quick', ['rounds']); a.s.story.team = 1; a.write('family'); earn(a, 2); a.write('result'); a.s.settings.sound = false; a.write('settings', ['sound']); r.storage.writeBlocked = false; b.reset(); a.write(); assert.deepEqual(r.saved.story, a.m.DEFAULT_SAVE().story); assert.deepEqual(r.saved.quick, a.m.DEFAULT_SAVE().quick); assert.deepEqual(r.saved.stats, a.m.DEFAULT_SAVE().stats); assert.equal(r.saved.settings.sound, false);
});
test('pre-reset active Story cannot rebind through preference merge and later resurrect results', async () => {
  const r = rig(fixture), a = await r.tab(), b = await r.tab(); a.begin('story', true); b.reset(); a.s.settings.sound = false; a.write('settings', ['sound']); earn(a, 3); a.s.resume = null; a.write('result'); assert.deepEqual(r.saved.story, a.m.DEFAULT_SAVE().story); assert.deepEqual(r.saved.stats, a.m.DEFAULT_SAVE().stats); assert.equal(r.saved.resume, null);
});
test('pre-reset active Quick result is also bound to its old progress generation', async () => {
  const r = rig(fixture), a = await r.tab(), b = await r.tab(); a.begin('quick'); b.reset(); a.s.settings.sound = false; a.write('settings', ['sound']); earn(a, 2); a.write('result'); assert.deepEqual(r.saved.stats, a.m.DEFAULT_SAVE().stats); assert.deepEqual(r.saved.story, a.m.DEFAULT_SAVE().story);
});
test('fresh deliberate family and Quick edits after Reset may use the current generation', async () => {
  const r = rig(fixture), a = await r.tab(), b = await r.tab(); r.storage.writeBlocked = true; a.s.quick.rounds = 5; a.write('quick', ['rounds']); a.s.story.team = 1; a.write('family'); r.storage.writeBlocked = false; b.reset(); a.s.quick.rounds = 5; a.write('quick', ['rounds']); a.s.story.team = 1; a.write('family'); assert.equal(r.saved.quick.rounds, 5); assert.equal(r.saved.story.team, 1); assert.equal(r.saved.story.unlocked, 1);
});
test('failed Reset cannot later erase newer foreign earned data without a fresh Reset action', async () => {
  const r = rig(fixture), a = await r.tab(), b = await r.tab(); r.storage.writeBlocked = true; assert.equal(a.reset(), false); r.storage.writeBlocked = false; earn(b, 3); b.write('result'); const protectedValue = r.saved; a.s.settings.sound = false; a.write('settings', ['sound']); assert.deepEqual(r.saved.story, protectedValue.story); assert.deepEqual(r.saved.stats, protectedValue.stats); assert.equal(a.notices.length, 1); a.reset(); assert.deepEqual(r.saved.story, a.m.DEFAULT_SAVE().story);
});
test('corrupt wrong-version malformed-token and blocked bytes cannot authorize a run overwrite', async () => {
  for (const raw of ['{bad', JSON.stringify({v:2}), JSON.stringify({...fixture,resumeRevision:42})]) { const r = rig(); r.raw = raw; const a = await r.tab(); a.begin(); turn(a); assert.equal(a.write('turn'), false); assert.equal(r.raw, raw); }
});
test('partial accepted sections default safely while optional opaque run fields remain intact', async () => {
  const optional = copy(fixture); delete optional.resume.battle.rng; optional.resume.battle.future = { keep:true }; const r = rig(optional), a = await r.tab(); a.s.settings.sound = false; a.write('settings', ['sound']); assert.deepEqual(r.saved.resume, optional.resume);
  r.raw = JSON.stringify({v:1,settings:null,story:{stars:null,nuts:null},quick:null,stats:{battles:'bad'},resume:null}); const b = await r.tab(); assert.deepEqual(b.s.story.stars, {}); assert.deepEqual(b.s.story.nuts, []); assert.equal(b.s.stats.battles, 0); b.s.settings.sound = false; assert.equal(b.write('settings', ['sound']), true);
});
test('old-layout invalidation clears only the exact inspected group', async () => {
  const r = rig(fixture), a = await r.tab(), b = await r.tab(); const invalid = copy(a.s.resume); b.begin(); const foreign = turn(b, 2); b.write('turn'); a.s.resume = null; a.m.writeSave(a.s,{intent:'invalidate',expectedResume:invalid}); assert.deepEqual(r.saved.resume, foreign);
  const c = await r.tab(), exact = copy(c.s.resume); c.s.resume = null; c.m.writeSave(c.s,{intent:'invalidate',expectedResume:exact}); assert.equal(r.saved.resume, null);
});
test('unknown compatible data and own prototype-looking keys stay data', async () => {
  const value = JSON.parse(JSON.stringify(fixture).replace('"v":1','"v":1,"__proto__":{"polluted":true},"future":{"a":1}')); value.settings.future = 'keep'; const r = rig(value), a = await r.tab(); a.s.settings.sound = false; a.write('settings', ['sound']); assert.deepEqual(r.saved.future,{a:1}); assert.equal(r.saved.settings.future,'keep'); assert.equal(Object.hasOwn(r.saved,'__proto__'),true); assert.equal(({}).polluted,undefined);
});
test('quota memory on an initially empty store survives load and counters are acknowledged once', async () => {
  const r = rig(), a = await r.tab(); r.storage.writeBlocked = true; a.s.settings.sound = false; a.write('settings',['sound']); earn(a,2); a.write('result'); assert.equal(a.m.loadSave().settings.sound,false); r.storage.writeBlocked=false; a.write(); a.write(); assert.equal(r.saved.settings.sound,false); assert.equal(r.saved.stats.battles,1); assert.equal(r.saved.stats.kos,2);
});
test('current hook Object.assign settings/story plus ordinary persist retains its intended fixture fields', async () => {
  const r = rig(), a = await r.tab(); Object.assign(a.s.settings,{sound:false,textScale:1.5}); a.write(); Object.assign(a.s.story,{team:0,unlocked:3,stars:{'story-01':2}}); a.write(); const reloaded=await r.tab(); assert.equal(reloaded.s.settings.sound,false); assert.equal(reloaded.s.story.unlocked,3); assert.equal(reloaded.s.story.stars['story-01'],2); assert.equal(reloaded.s.story.team,0);
});
test('a stale post-reset map cannot begin a formerly unlocked Story level', async () => {
  const value=copy(fixture);value.story.unlocked=8;const r=rig(value),a=await r.tab(),b=await r.tab();b.reset();const begun=a.begin('story',false,8);assert.equal(begun.started,false);assert.equal(begun.reason,'locked');assert.equal(r.saved.resume,null);assert.equal(r.saved.story.unlocked,1);
});

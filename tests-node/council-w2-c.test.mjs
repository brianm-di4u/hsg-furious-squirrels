// Council wave 2, batch C: the Records figures in the save (S3-02) and the feud's words (S4-01), no browser needed.
import test from 'node:test';
import assert from 'node:assert/strict';

const MODULE = new URL('../src/js/save.js', import.meta.url);
let serial = 0;
function rig(initial = null) {
  let raw = initial === null ? null : JSON.stringify(initial);
  globalThis.window = { localStorage: { getItem: () => raw, setItem: (_k, v) => { raw = v; } } };
  return {
    get saved() { return raw === null ? null : JSON.parse(raw); },
    set(v) { raw = JSON.stringify(v); },
    async tab() {
      const m = await import(MODULE.href + '?w2c=' + (++serial)); const s = m.loadSave();
      return { m, s, write: (intent = 'merge', fields = []) => m.writeSave(s, { intent, fields }) };
    },
  };
}
const oldSave = () => ({
  v: 1, settings: { sound: true, music: true, volume: 0.5, reducedMotion: null, aimGuide: 'auto', turnTimer: 0, textScale: 1, difficulty: 'medium', tutorial: true },
  story: { team: 0, unlocked: 4, stars: { 'story-01': 3 }, nuts: [] },
  quick: { level: 'story-01', team: 0, size: 3, rounds: 1, wind: 'normal', steam: 'on', birds: 'some', loadout: 'all', difficulty: 'medium' },
  stats: { battles: 5, wins: 3, kos: 7, bestShot: 40 }, resume: null,
});

test('S3-02 a save from before the Records loads with zeroed counters and nothing else changed', async () => {
  const r = rig(oldSave()); const { s } = await r.tab();
  assert.deepEqual(s.story.bestTurns, {});
  assert.equal(s.stats.battles, 5); assert.equal(s.stats.bestShot, 40); assert.equal(s.stats.throws, 0); assert.equal(s.stats.winsHard, 0);
  assert.equal(s.stats.streak, 0); assert.equal(s.stats.bestStreak, 0);
  assert.equal(s.story.stars['story-01'], 3);
  assert.equal(JSON.stringify(r.saved), JSON.stringify(oldSave()), 'reading wrote nothing');
});

test('S3-02 a win is saved with its turns, streak and skill tallies and a reload reads them back', async () => {
  const r = rig(oldSave()); const { s, write } = await r.tab();
  s.stats.battles++; s.stats.wins++; s.stats.streak++; s.stats.bestStreak = 1; s.stats.winsSharp++; s.stats.throws += 6; s.stats.hits += 4;
  s.story.bestTurns['story-01'] = 7;
  assert.ok(write('result'));
  const back = (await r.tab()).s;
  assert.equal(back.story.bestTurns['story-01'], 7); assert.equal(back.stats.winsSharp, 1); assert.equal(back.stats.hits, 4); assert.equal(back.stats.battles, 6);
});

test('S3-02 two tabs add their tallies, keep the lower turns and the longer best streak', async () => {
  const r = rig(oldSave());
  const a = await r.tab(), b = await r.tab();
  a.s.stats.battles++; a.s.stats.wins++; a.s.stats.winsHard++; a.s.stats.streak = 1; a.s.stats.bestStreak = 1; a.s.story.bestTurns['story-01'] = 9; a.write('result');
  b.s.stats.battles++; b.s.stats.wins++; b.s.stats.winsHard++; b.s.stats.streak = 4; b.s.stats.bestStreak = 4; b.s.story.bestTurns['story-01'] = 6; b.write('result');
  const c = (await r.tab()).s;
  assert.equal(c.stats.battles, 7); assert.equal(c.stats.winsHard, 2); assert.equal(c.stats.bestStreak, 4); assert.equal(c.story.bestTurns['story-01'], 6);
});

test('S3-02 damaged Records values fall back to defaults and a sound entry is kept', async () => {
  const bad = oldSave(); bad.story.bestTurns = { 'story-01': 0, 'story-02': 1.5, 'story-03': 'x', 'story-04': 12 }; bad.stats.throws = -4; bad.stats.streak = 'a';
  const r = rig(bad); const { s } = await r.tab();
  assert.deepEqual(s.story.bestTurns, { 'story-04': 12 }); assert.equal(s.stats.throws, 0); assert.equal(s.stats.streak, 0);
  const worse = oldSave(); worse.story.bestTurns = [3, 4];
  assert.deepEqual((await rig(worse).tab()).s.story.bestTurns, {});
});

test('S3-02 Reset progress returns every Records figure to zero', async () => {
  const r = rig(oldSave()); const { s, write, m } = await r.tab();
  s.stats.winsHard = 3; s.story.bestTurns['story-01'] = 5; write('result');
  const fresh = m.DEFAULT_SAVE(); s.story = fresh.story; s.stats = fresh.stats;
  write('reset');
  const back = (await r.tab()).s;
  assert.equal(back.stats.winsHard, 0); assert.deepEqual(back.story.bestTurns, {}); assert.equal(back.stats.battles, 0);
});

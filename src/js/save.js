// Saves: one versioned JSON object in localStorage, wrapped in try/catch with an in-memory fallback so the game
// works when storage is blocked. Pattern from games/Cart Racing/src/js/save.js (Hot Springs Games, MIT).
const KEY = 'hsg-furious-squirrels-v1';
let mem = null;

export const DEFAULT_SAVE = () => ({
  v: 1,
  settings: { sound: true, music: true, volume: 0.5, reducedMotion: null, aimGuide: 'auto', turnTimer: 0, textScale: 1, difficulty: 'medium', tutorial: true },
  story: { team: null, unlocked: 1, stars: {}, nuts: [] },
  quick: { level: 'story-01', team: 0, size: 3, rounds: 1, wind: 'normal', steam: 'on', loadout: 'all', difficulty: 'medium' },
  stats: { battles: 0, wins: 0, kos: 0, bestShot: 0 },
  resume: null,
});

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === 1) {
        const d = DEFAULT_SAVE();
        return { ...d, ...s, settings: { ...d.settings, ...s.settings }, story: { ...d.story, ...s.story }, quick: { ...d.quick, ...s.quick }, stats: { ...d.stats, ...s.stats } };
      }
    }
  } catch (e) { /* storage unavailable */ }
  return mem ? JSON.parse(JSON.stringify(mem)) : DEFAULT_SAVE();
}

export function writeSave(s) {
  mem = JSON.parse(JSON.stringify(s));
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
}

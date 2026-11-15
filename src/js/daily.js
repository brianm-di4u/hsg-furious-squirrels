// The Daily Duel (S3-03): one battle a day, the same for everyone who plays that day. The map, the wind and the
// seed come from the local date, so a retry is the exact same battle; the save keeps the best win of each recent day
// and a streak of days in a row. Pure functions, no DOM.

const KEEP_DAYS = 14; // recent days kept in the save; older ones are pruned
const WINDS = ['light', 'normal', 'gusty'];

// 20261114 for 14 November 2026, in the player's own time zone
export const dayKey = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
export const fromKey = (k) => new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100);
export const prevDay = (k) => { const d = fromKey(k); d.setDate(d.getDate() - 1); return dayKey(d); };

// a well-mixed 32-bit number from the day, so neighbouring days get unrelated maps
const mix = (k) => { let h = Math.imul(k ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; };

// the day's battle: which of the maps, the battle seed (wind, birds, who throws first) and the wind setting
export function dailyPlan(k, levelIds) {
  const h = mix(k);
  return { levelId: levelIds[h % levelIds.length], seed: (h >>> 12) & 0xffff, wind: WINDS[(h >>> 5) % WINDS.length] };
}

export const emptyDaily = () => ({ last: 0, streak: 0, bestStreak: 0, wins: 0, hist: {} });

// The days in a row ending today (or yesterday: today is still to play).
export const liveStreak = (daily, today) => daily.last === today || daily.last === prevDay(today) ? daily.streak : 0;

// A win on `day` in `turns` turns with `outs` squirrels knocked out: the record after it, and whether it is the day's best.
// Fewer turns beats more; the same turns with fewer squirrels lost beats more. Returns a new object.
export function recordDaily(daily, day, turns, outs) {
  const d = { ...daily, hist: { ...daily.hist } }, old = d.hist[day];
  const best = !old || turns < old[0] || (turns === old[0] && outs < old[1]);
  if (best) d.hist[day] = [turns, outs];
  if (day < d.last) { /* an older day replayed after midnight: its best is kept, the streak is not touched */ }
  else if (d.last !== day) { d.streak = d.last === prevDay(day) ? d.streak + 1 : 1; d.wins += 1; d.last = day; }
  else if (!old) d.wins += 1;
  d.bestStreak = Math.max(d.bestStreak, d.streak);
  const keep = Object.keys(d.hist).sort().slice(-KEEP_DAYS);
  for (const key of Object.keys(d.hist)) if (!keep.includes(key)) delete d.hist[key];
  return { daily: d, best, streak: d.streak };
}

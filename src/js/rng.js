// Copied from games/Cart Racing/src/js/rng.js (itself from games/football; Hot Springs Games, MIT).
// Seeded RNG. mulberry32 by bryc (public domain): https://github.com/bryc/code/blob/master/jshash/PRNGs.md
// The generator's 32-bit state lives in `rng.s` so saves resume the same sequence.

export function makeRng(seed = 1) {
  const r = {
    s: seed >>> 0,
    next() {
      let a = (r.s = (r.s + 0x6d2b79f5) | 0);
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n) { return Math.floor(r.next() * n); },
    range(a, b) { return a + r.next() * (b - a); },
    chance(p) { return r.next() < p; },
    pick(arr) { return arr[Math.floor(r.next() * arr.length)]; },
    normal(mu = 0, sd = 1) {
      const u = 1 - r.next(), v = r.next();
      return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    weighted(pairs) { // [[item, weight], ...]
      let tot = 0;
      for (const p of pairs) tot += Math.max(0, p[1]);
      let x = r.next() * tot;
      for (const p of pairs) { x -= Math.max(0, p[1]); if (x <= 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    },
  };
  return r;
}

export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Named, independently seeded streams so cosmetic randomness (leaves, steam) never shifts the battle sim.
export function makeStreams(seed = 1) {
  const s = seed >>> 0;
  return { ai: makeRng(s ^ 0xa11ce), sim: makeRng(s ^ 0x5eed), fx: makeRng(s ^ 0xf00d) };
}

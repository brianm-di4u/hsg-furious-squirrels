// Birds as airborne obstacles (MECHANICS.md §6b). Each turn rolls a few flocks from the species around Hot Springs
// in the level's season; a bird's position is a pure function of the battle's bird clock, so the sim, a saved
// battle and the renderer all agree. No DOM: the Node tools import it too.
import { W, WIND_MAX, BIRDS, BIRD_LEVELS } from './const.js';

const SPAN = 700; // birds wrap across [-SPAN, W + SPAN] so the sky stays busy through a long aim
const CLEAR = 150; // low fliers stay at least this far above the slope (they rise over the ridges)

// Species that can appear on a level: by season, none at night (they roost)
export function birdPool(level) {
  if (level.time === 'night') return [];
  return Object.keys(BIRDS).filter((k) => BIRDS[k].seasons.includes(level.season) && (k !== 'swift' || level.time !== 'mist'));
}

// Roll this turn's birds into b.birds (individuals, each with its flock's path and an offset in the formation).
export function rollBirds(level, b, rng) {
  b.birds = []; b.birdT = 0;
  const dens = BIRD_LEVELS[b.birdLevel] || 0, pool = birdPool(level);
  if (!dens || !pool.length) return;
  let flocks = dens === 1 ? (rng.chance(0.35) ? 0 : rng.chance(0.75) ? 1 : 2) : 1 + rng.int(3);
  if (level.time === 'mist' && flocks && rng.chance(0.5)) flocks--;
  for (let f = 0; f < flocks; f++) {
    const k = rng.pick(pool), d = BIRDS[k];
    const n = d.flock[0] + rng.int(d.flock[1] - d.flock[0] + 1), dir = rng.chance(0.5) ? 1 : -1;
    const x0 = rng.range(-SPAN, W + SPAN), alt = rng.range(d.alt[0], d.alt[1]), ph = rng.range(0, 6.28);
    const v = d.v * rng.range(0.9, 1.1), R = rng.range(120, 210), cx = level.steam ? level.steam.x + rng.range(-80, 80) : level.floorX;
    for (let i = 0; i < n; i++) {
      let ox = 0, oy = 0;
      if (d.form === 'v' && i) { const rank = Math.ceil(i / 2); ox = -rank * 48; oy = (i % 2 ? -1 : 1) * rank * 24; }
      else if (d.form === 'line') { ox = -i * 46; oy = i * 7; }
      else if (d.form === 'loose' || d.form === 'zig') { ox = i ? rng.range(-90, 90) : 0; oy = i ? rng.range(-45, 45) : 0; }
      else if (d.form === 'glide' && i) { ox = -rng.range(120, 200); oy = rng.range(-50, 50); }
      b.birds.push({ k, dir, x0, alt, v, ph: ph + (d.form === 'circle' ? (i / n) * 6.28 : i * 0.7), ox, oy, R: R * (d.form === 'circle' ? rng.range(0.7, 1.15) : 1), cx, flee: null });
    }
  }
}

const wrap = (x) => { const L = W + SPAN * 2; return ((((x + SPAN) % L) + L) % L) - SPAN; };

// Where a bird is at bird-clock time t. ctx: {wind, floorY, groundY(x)}. Returns {x, y, face} (face: +1 right).
export function birdPos(bd, t, ctx) {
  const d = BIRDS[bd.k];
  if (bd.flee) { const u = t - bd.flee.t; return { x: bd.flee.x + bd.flee.vx * u, y: bd.flee.y + bd.flee.vy * u - 40 * u * u, face: Math.sign(bd.flee.vx) || 1 }; }
  if (d.form === 'circle') {
    // riding the steam thermal in slow circles (drawn as a flattened ellipse)
    const a = bd.ph + (bd.v / bd.R) * t * bd.dir;
    return { x: bd.cx + Math.cos(a) * bd.R + bd.ox, y: ctx.floorY - bd.alt + Math.sin(a) * bd.R * 0.3 + bd.oy, face: -Math.sin(a) * bd.dir >= 0 ? 1 : -1 };
  }
  const drift = d.form === 'v' || d.form === 'line' || d.form === 'glide' ? 0.25 : 0.1;
  const vx = bd.dir * bd.v + (ctx.wind || 0) * WIND_MAX * drift;
  const x = wrap(bd.x0 + vx * t + bd.ox * bd.dir);
  let y = ctx.floorY - bd.alt + bd.oy;
  if (d.form === 'zig') y += Math.sin(t * 5.5 + bd.ph) * 34 + Math.sin(t * 13 + bd.ph * 2) * 10;
  else if (d.form === 'glide') y += Math.sin(t * 0.7 + bd.ph) * 40;
  else y += Math.sin(t * 2.2 + bd.ph) * 6;
  y = Math.min(y, ctx.groundY(Math.max(0, Math.min(W, x))) - CLEAR);
  return { x, y, face: vx >= 0 ? 1 : -1 };
}

// A startled bird flaps up and away from the hit and can't be hit again this turn.
export function startle(bd, t, p, fromX) {
  const d = BIRDS[bd.k], away = Math.sign(p.x - fromX) || p.face;
  bd.flee = { t, x: p.x, y: p.y, vx: away * d.v * 1.8, vy: -d.v * 0.9 };
}

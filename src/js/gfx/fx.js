// Cosmetic particles: leaves, dust, wood chips, steam curls, pop rings and damage numbers. Uses the `fx` RNG
// stream only, so nothing here can change the battle.
import { CANOPY } from './looks.js';
import { star } from './squirrels.js';

const MAX = 600;

export class Fx {
  constructor(rng) { this.rng = rng; this.p = []; this.texts = []; this.rings = []; this.steam = []; }
  get count() { return this.p.length + this.texts.length + this.rings.length; }
  busy() { return this.p.length > 0 || this.texts.length > 0 || this.rings.length > 0; }
  clear() { this.p = []; this.texts = []; this.rings = []; }
  add(o) { if (this.p.length < MAX) this.p.push(o); }

  leaves(x, y, n, season, species = 'oak') {
    const r = this.rng, pal = (CANOPY[season] || CANOPY.summer)[species] || CANOPY.summer.oak;
    for (let i = 0; i < n; i++) this.add({ k: 'leaf', x: x + r.range(-14, 14), y: y + r.range(-14, 14), vx: r.range(-90, 90), vy: r.range(-140, -20), life: r.range(1.2, 2.2), t: 0, rot: r.range(0, 6), vr: r.range(-6, 6), c: r.pick([pal.base, pal.light, pal.dark]), s: r.range(3, 6) });
  }
  dust(x, y, n, col = '#8A6A44') {
    const r = this.rng;
    for (let i = 0; i < n; i++) { const a = r.range(-Math.PI, 0), v = r.range(40, 220); this.add({ k: 'dust', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: r.range(0.4, 0.9), t: 0, s: r.range(3, 9), c: col }); }
  }
  chips(x, y, n) {
    const r = this.rng;
    for (let i = 0; i < n; i++) { const a = r.range(0, Math.PI * 2), v = r.range(60, 260); this.add({ k: 'chip', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: r.range(0.6, 1.1), t: 0, rot: r.range(0, 6), vr: r.range(-12, 12), s: r.range(2, 5), c: r.pick(['#C49A6C', '#8A6A44', '#5B4632']) }); }
  }
  ring(x, y, r, col = '#FFF6C8') { this.rings.push({ x, y, r, t: 0, life: 0.45, c: col }); }
  text(x, y, s, col = '#FFFFFF', big = false) { this.texts.push({ x, y, s, t: 0, life: big ? 1.3 : 1.1, c: col, big }); }
  shards(x, y, n) {
    const r = this.rng;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r.range(-0.2, 0.2), v = r.range(220, 420); this.add({ k: 'chip', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: r.range(0.5, 0.8), t: 0, rot: r.range(0, 6), vr: r.range(-14, 14), s: r.range(4, 7), c: r.pick(['#3A2A1E', '#5E4530', '#2B1E14']) }); }
  }
  flash(x, y, r) { this.rings.push({ x, y, r, t: 0, life: 0.18, c: '#FFFFFF', fill: true }); }
  puff(x, y) { this.add({ k: 'puff', x, y, vx: 0, vy: -10, life: 0.5, t: 0, s: 5 }); }
  stars(x, y) { const r = this.rng; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; this.add({ k: 'star', x, y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 - 60, life: 0.8, t: 0, s: r.range(4, 7) }); } }

  update(dt) {
    for (const o of this.p) {
      o.t += dt;
      if (o.k === 'leaf') { o.vy += 120 * dt; o.vx *= 1 - dt * 1.5; o.vy = Math.min(o.vy, 70); o.x += (o.vx + Math.sin(o.t * 5 + o.rot) * 30) * dt; o.y += o.vy * dt; o.rot += o.vr * dt; }
      else if (o.k === 'dust') { o.vx *= 1 - dt * 3; o.vy = o.vy * (1 - dt * 3) + 30 * dt; o.x += o.vx * dt; o.y += o.vy * dt; }
      else if (o.k === 'puff') { o.y += o.vy * dt; }
      else { o.vy += 500 * dt; o.x += o.vx * dt; o.y += o.vy * dt; if (o.rot != null) o.rot += o.vr * dt; }
    }
    this.p = this.p.filter((o) => o.t < o.life);
    for (const o of this.texts) o.t += dt;
    this.texts = this.texts.filter((o) => o.t < o.life);
    for (const o of this.rings) o.t += dt;
    this.rings = this.rings.filter((o) => o.t < o.life);
  }

  draw(g, cam) {
    const z = Math.max(cam.zoom, 0.95); // effects never shrink below about their 1:1 size
    for (const o of this.p) {
      const [x, y] = cam.toScreen(o.x, o.y), a = 1 - o.t / o.life;
      g.globalAlpha = Math.max(0, Math.min(1, a * 1.6));
      if (o.k === 'leaf') { g.save(); g.translate(x, y); g.rotate(o.rot); g.fillStyle = o.c; g.beginPath(); g.ellipse(0, 0, o.s * z, o.s * 0.5 * z, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      else if (o.k === 'dust') { g.fillStyle = o.c; g.beginPath(); g.arc(x, y, o.s * z * (1 + o.t * 1.5), 0, Math.PI * 2); g.fill(); }
      else if (o.k === 'star') star(g, x, y, o.s * z, '#F2C230');
      else if (o.k === 'puff') { g.fillStyle = 'rgba(255,250,235,0.85)'; g.beginPath(); g.arc(x, y, Math.max(4, o.s * z * (1 + o.t * 2.5)), 0, Math.PI * 2); g.fill(); }
      else { g.save(); g.translate(x, y); g.rotate(o.rot || 0); g.fillStyle = o.c; g.fillRect(-o.s * z, -o.s * 0.4 * z, o.s * 2 * z, o.s * 0.8 * z); g.restore(); }
    }
    g.globalAlpha = 1;
    for (const o of this.rings) {
      const [x, y] = cam.toScreen(o.x, o.y), u = o.t / o.life;
      g.globalAlpha = 1 - u;
      if (o.fill) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.arc(x, y, o.r * z * (0.5 + u), 0, Math.PI * 2); g.fill(); continue; }
      g.strokeStyle = '#1A1410'; g.lineWidth = Math.max(3.5, 10 * z * (1 - u));
      g.beginPath(); g.arc(x, y, o.r * z * (0.4 + u), 0, Math.PI * 2); g.stroke();
      g.strokeStyle = o.c; g.lineWidth = Math.max(2, 6 * z * (1 - u)); g.stroke();
    }
    g.globalAlpha = 1;
    for (const o of this.texts) {
      let [x, y] = cam.toScreen(o.x, o.y);
      x = Math.max(40, Math.min(cam.vw - 40, x)); y = Math.max(70, y);
      const u = o.t / o.life, pop = o.big ? 1 + Math.max(0, 0.6 - o.t * 4) : 1;
      const fs = Math.max(o.big ? 22 : 14, (o.big ? 30 : 22) * Math.min(1.2, z * 1.4)) * pop;
      g.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      g.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center';
      g.lineWidth = o.big ? 6 : 4; g.strokeStyle = '#1A1410'; g.strokeText(o.s, x, y - u * 40);
      g.fillStyle = o.c; g.fillText(o.s, x, y - u * 40);
    }
    g.globalAlpha = 1;
  }
}

// Steam curls over the valley: purely ambient, drawn in world space, strength follows the level's lift.
export class Steam {
  constructor(rng) { this.rng = rng; this.puffs = []; }
  reset(level, lift) {
    this.level = level; this.lift = lift; this.puffs = [];
    for (let i = 0; i < 26; i++) this.spawn(true);
  }
  spawn(scatter) {
    const r = this.rng, L = this.level, w = L.steam.w;
    this.puffs.push({ x: L.steam.x + r.range(-w / 2, w / 2) * 0.8, y: L.floorY - (scatter ? r.range(0, 700) : 0), r: r.range(22, 46), ph: r.range(0, 6.28), v: r.range(40, 80) });
  }
  update(dt) {
    if (!this.level) return;
    const k = 0.4 + (this.lift / 980) * 0.9;
    for (const p of this.puffs) { p.y -= p.v * k * dt; p.ph += dt; p.r += dt * 6; }
    this.puffs = this.puffs.filter((p) => p.y > this.level.floorY - 940);
    while (this.puffs.length < Math.round(10 + (this.lift / 980) * 22)) this.spawn(false);
  }
  draw(g, cam, alphaMul = 1) {
    if (!this.level || !this.lift) return;
    const z = cam.zoom, fl = this.level.floorY;
    for (const p of this.puffs) {
      const h = fl - p.y, a = Math.max(0, 1 - h / 940) * 0.32 * alphaMul;
      const [x, y] = cam.toScreen(p.x + Math.sin(p.ph) * 14, p.y);
      const gr = g.createRadialGradient(x, y, 0, x, y, p.r * z);
      gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, p.r * z, 0, Math.PI * 2); g.fill();
    }
  }
}

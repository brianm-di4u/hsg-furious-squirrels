// The visual terrain: an offscreen canvas painted once per round from the level's ground line, then carved with
// destination-out at the same circles as the sim's mask (MECHANICS.md §4), plus a dark rim so craters read as dug.
import { W, H } from '../sim/const.js';
import { GROUND, SKY, CANOPY } from './looks.js';
import { APRON } from './camera.js';
import { makeRng } from '../rng.js';

export class TerrainLayer {
  constructor(scale = 1) { this.scale = scale; this.cv = null; }

  paint(level, sim, fxRng) {
    const s = this.scale, cv = this.cv || document.createElement('canvas');
    cv.width = Math.ceil(W * s); cv.height = Math.ceil(H * s);
    const g = cv.getContext('2d'), look = GROUND[level.season] || GROUND.summer, t = sim.terrain;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.clearRect(0, 0, W, H);
    const pathGround = () => {
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) g.lineTo(x, t.groundY(x));
      g.lineTo(W, H); g.closePath();
    };
    // soil body with depth shading
    const grad = g.createLinearGradient(0, 400, 0, H);
    grad.addColorStop(0, look.soil); grad.addColorStop(1, look.deep);
    pathGround(); g.fillStyle = grad; g.fill();
    // the painted soil texture (art-src/codex/tex-soil.png), multiplied over the depth gradient when loaded
    if (this.tex) {
      g.save(); pathGround(); g.clip();
      const pat = g.createPattern(this.tex, 'repeat');
      pat.setTransform(new DOMMatrix().scale(0.62));
      g.globalAlpha = 0.62; g.fillStyle = pat; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.7; g.fillStyle = grad; g.fillRect(0, 0, W, H);
      g.restore();
    }
    // strata speckle (cosmetic)
    g.save(); pathGround(); g.clip();
    // a forest-floor band under the surface: humus darkening into soil
    for (let x = 0; x < W; x += 6) {
      const gy = t.groundY(x), band = g.createLinearGradient(0, gy, 0, gy + 70);
      band.addColorStop(0, look.litter); band.addColorStop(0.35, look.soil); band.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = band; g.fillRect(x, gy, 6.5, 70);
    }
    // depth: the soil darkens with distance below the surface (not just with height on the screen)
    for (let x = 0; x < W; x += 6) {
      const gy = t.groundY(x), dg = g.createLinearGradient(0, gy + 40, 0, gy + 620);
      dg.addColorStop(0, 'rgba(30,20,12,0)'); dg.addColorStop(1, 'rgba(30,20,12,0.6)');
      g.fillStyle = dg; g.fillRect(x, gy + 40, 6.5, 580);
    }
    // a few big buried stones near the surface (outlined, lit from the upper left)
    for (let i = 0; i < 14; i++) {
      const x = fxRng.range(40, W - 40); if (Math.abs(x - level.floorX) < 120) continue;
      const y = t.groundY(x) + fxRng.range(40, 160), r = fxRng.range(12, 26);
      stone(g, x, y, r, fxRng, ['#A08A6A', '#B8B0A0', '#8C877C'][i % 3]);
    }
    // soil strata that follow the slope
    for (const [d, a] of (this.tex ? [] : [[150, 0.16], [260, 0.13], [380, 0.1]])) {
      g.strokeStyle = `rgba(46,32,20,${a})`; g.lineWidth = 16;
      g.beginPath();
      for (let x = 0; x <= W; x += 8) { const y = t.groundY(x) + d + Math.sin(x / 90 + d) * 8; x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      g.strokeStyle = `rgba(210,180,130,${a * 0.6})`; g.lineWidth = 3; g.stroke();
    }
    // roots and buried stones
    for (let i = 0; i < 160; i++) {
      const x = fxRng.range(0, W), gy = t.groundY(x), y = gy + fxRng.range(14, 90);
      g.strokeStyle = 'rgba(60,40,24,0.45)'; g.lineWidth = fxRng.range(1.5, 3);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + fxRng.range(-20, 20), y + fxRng.range(4, 18), x + fxRng.range(-34, 34), y + fxRng.range(10, 30)); g.stroke();
    }
    for (let i = 0; i < 260; i++) {
      const x = fxRng.range(0, W), y = t.groundY(x) + fxRng.range(30, 400);
      const r = fxRng.range(3, 10); g.fillStyle = fxRng.chance(0.5) ? 'rgba(160,138,106,0.55)' : 'rgba(110,100,90,0.5)';
      g.beginPath(); g.ellipse(x, y, r * 1.3, r, fxRng.range(0, 3), 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < (this.tex ? 300 : 1400); i++) {
      const x = fxRng.range(0, W), gy = t.groundY(x), y = gy + fxRng.range(12, 260);
      g.fillStyle = fxRng.chance(0.5) ? 'rgba(40,28,18,0.18)' : 'rgba(200,170,120,0.12)';
      g.beginPath(); g.ellipse(x, y, fxRng.range(2, 7), fxRng.range(1, 3), 0, 0, Math.PI * 2); g.fill();
    }
    // rock outcrops (match the mask's rock circles): irregular sandstone boulders with moss on top
    for (const r of level.rocks) {
      stone(g, r.x, r.y, r.r, fxRng, '#B8A88A');
      g.fillStyle = level.season === 'winter' ? '#F4F6F5' : 'rgba(107,142,58,0.85)';
      g.beginPath(); g.ellipse(r.x - r.r * 0.1, r.y - r.r * 0.82, r.r * 0.62, r.r * 0.2, -0.1, 0, Math.PI * 2); g.fill();
    }
    // the valley floor: a steaming hot-spring pool in tufa terraces (gray tufa, emerald algae, blue-green water;
    // research/visual-style-guide.md -> Thermal water)
    const [f0, f1] = level.floor, fy = level.floorY, fw = f1 - f0;
    // rim stones and stepped tufa lobes that fade into the soil below
    for (let k = 2; k >= 0; k--) { g.fillStyle = ['#C8C3B6', '#ABA79C', '#8E8A80'][k]; g.beginPath(); g.ellipse(f0 + fw / 2, fy + 6 + k * 9, fw * (0.36 - k * 0.07), 9, 0, 0, Math.PI * 2); g.fill(); }
    for (let k = 0; k < 7; k++) { const sx = f0 + fw * (0.2 + k * 0.1), sr = 4 + (k % 3) * 1.6; g.fillStyle = '#2B2A27'; g.beginPath(); g.arc(sx, fy - 1, sr + 1.5, 0, Math.PI * 2); g.fill(); g.fillStyle = k % 2 ? '#A8A296' : '#C8C1B2'; g.beginPath(); g.arc(sx, fy - 1, sr, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(107,142,58,0.45)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(f0 + fw * (0.05 + k * 0.067), fy + 2, 3.5, 1.6, 0, 0, Math.PI * 2); g.fill(); }
    const pool = g.createRadialGradient(f0 + fw / 2, fy + 4, 4, f0 + fw / 2, fy + 4, fw * 0.45);
    pool.addColorStop(0, '#1F5F6B'); pool.addColorStop(1, '#2A9D8F');
    g.fillStyle = '#2F8F5B'; g.beginPath(); g.ellipse(f0 + fw / 2, fy + 3, fw * 0.3, 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = pool; g.beginPath(); g.ellipse(f0 + fw / 2, fy + 3, fw * 0.26, 6, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(f0 + fw / 2 + (k - 1) * 18, fy + 2, 8 + k * 3, 1.6, 0, 0, Math.PI * 2); g.stroke(); }
    g.restore();
    // grass / litter / snow band along the top edge
    g.lineJoin = 'round';
    g.beginPath();
    for (let x = 0; x <= W; x += 4) { const y = t.groundY(x); x === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.strokeStyle = look.top; g.lineWidth = 16; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3; g.stroke();
    // leaf litter flecks along the surface (season colours)
    const flecks = { fall: ['#C27A40', '#D4A72C', '#A8352E'], winter: ['#FFFFFF', '#DCE2E0'], spring: ['#B5568F', '#F6F3EC', '#A3C46A'], summer: ['#7C9A4C', '#B07A30'] }[level.season] || ['#7C9A4C'];
    for (let i = 0; i < 700; i++) {
      const x = fxRng.range(0, W); if (Math.abs(x - level.floorX) < 80) continue;
      const y = t.groundY(x) + fxRng.range(-6, 10);
      g.fillStyle = flecks[i % flecks.length]; g.beginPath(); g.ellipse(x, y, fxRng.range(1.5, 3.5), fxRng.range(1, 2), fxRng.range(0, 3), 0, Math.PI * 2); g.fill();
    }
    // drifts of leaf litter collected in hollows
    for (let i = 0; i < 40; i++) {
      const x = fxRng.range(60, W - 60); if (Math.abs(x - level.floorX) < 140) continue;
      const y = t.groundY(x) + 2;
      for (let k = 0; k < 9; k++) { g.fillStyle = flecks[(i + k) % flecks.length]; g.beginPath(); g.ellipse(x + fxRng.range(-14, 14), y + fxRng.range(-3, 3), fxRng.range(3, 5), fxRng.range(1.5, 2.5), fxRng.range(0, 3), 0, Math.PI * 2); g.fill(); }
    }
    // tufts
    for (let x = 0; x < W; x += 9) {
      if (Math.abs(x - level.floorX) < 80) continue;
      const y = t.groundY(x) - 5, h = fxRng.range(4, 11);
      g.strokeStyle = fxRng.chance(0.5) ? look.top : look.litter; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y + 4); g.quadraticCurveTo(x + fxRng.range(-3, 3), y - h / 2, x + fxRng.range(-4, 4), y - h); g.stroke();
    }
    // dusk and night grade the whole play layer, so it sits in the same light as the backdrop
    const sky = SKY[level.time];
    if (sky && sky.tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = sky.tint; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
    this.cv = cv;
    for (const c of sim.b.craters) this.carve(c.x, c.y, c.r, true);
    const ar = makeRng(level.seed ^ 0xa9a0);
    this.aprons = [-1, 1].map((side) => paintApron(level, t, side, ar, this.tex));
    this.obs = paintObstacles(level, makeRng(level.seed ^ 0x0b57), this.obs);
  }

  carve(x, y, r, quiet) {
    if (!this.cv) return;
    const g = this.cv.getContext('2d');
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    // dug rim drawn only onto remaining soil
    g.globalCompositeOperation = 'source-atop';
    g.strokeStyle = 'rgba(46,32,20,0.55)'; g.lineWidth = 5;
    g.beginPath(); g.arc(x, y, r + 1.5, 0, Math.PI * 2); g.stroke();
    g.restore();
    void quiet;
  }

  draw(ctx, cam) {
    if (!this.cv) return;
    const [sx, sy] = cam.toScreen(0, 0);
    // the aprons overlap the world edge by a few units so no seam shows between the canvases
    for (const a of this.aprons || []) {
      const [ax, ay] = cam.toScreen(a.x, 0);
      if (ax > cam.vw || ax + a.w * cam.zoom < 0) continue;
      ctx.drawImage(a.cv, ax, ay, a.w * cam.zoom, H * cam.zoom);
    }
    ctx.drawImage(this.cv, sx, sy, W * cam.zoom, H * cam.zoom);
    // boulders, logs and stumps sit on their own layer: craters never erase them (the sim never carves them)
    if (this.obs) ctx.drawImage(this.obs, sx, sy, W * cam.zoom, H * cam.zoom);
  }
}

// Scenery past one edge of the world (side -1 west, +1 east): the ridge carries on past the crest, dips into a
// saddle and rises to a lower far knob, with a row of distant trees. Visual only; the sim mask ends at the edge.
export function apronY(t, side, u) {
  const y0 = t.groundY(side < 0 ? 0 : W), k = Math.min(1, u / 650), dip = k * k * (3 - 2 * k);
  const knob = Math.exp(-(((u - 980) / 260) ** 2));
  return Math.min(H - 60, y0 + dip * 230 - knob * 120 + Math.sin(u / 97 + side) * 9 * Math.min(1, u / 200));
}

function paintApron(level, t, side, rng, tex) {
  const s = 0.5, ov = 8, aw = APRON + ov, cv = document.createElement('canvas');
  cv.width = Math.ceil(aw * s); cv.height = Math.ceil(H * s);
  const g = cv.getContext('2d'), look = GROUND[level.season] || GROUND.summer;
  // local x across the canvas; u = distance past the world edge
  const uOf = (lx) => (side < 0 ? APRON - lx : lx - ov);
  const yAt = (lx) => apronY(t, side, Math.max(0, uOf(lx)));
  g.setTransform(s, 0, 0, s, 0, 0);
  const path = () => { g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= aw; x += 8) g.lineTo(x, yAt(x)); g.lineTo(aw, H); g.closePath(); };
  const grad = g.createLinearGradient(0, 400, 0, H);
  grad.addColorStop(0, look.soil); grad.addColorStop(1, look.deep);
  path(); g.fillStyle = grad; g.fill();
  g.save(); path(); g.clip();
  if (tex) { const pat = g.createPattern(tex, 'repeat'); pat.setTransform(new DOMMatrix().scale(0.62)); g.globalAlpha = 0.5; g.fillStyle = pat; g.fillRect(0, 0, aw, H); g.globalAlpha = 1; }
  for (let x = 0; x < aw; x += 8) {
    const gy = yAt(x), band = g.createLinearGradient(0, gy, 0, gy + 70);
    band.addColorStop(0, look.litter); band.addColorStop(0.35, look.soil); band.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = band; g.fillRect(x, gy, 8.5, 70);
    // the same darkening with depth as the battlefield, so the two meet without a seam
    const dg = g.createLinearGradient(0, gy + 40, 0, gy + 620);
    dg.addColorStop(0, 'rgba(30,20,12,0)'); dg.addColorStop(1, 'rgba(30,20,12,0.6)');
    g.fillStyle = dg; g.fillRect(x, gy + 40, 8.5, H - gy);
  }
  if (tex) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.7; g.fillStyle = grad; g.fillRect(0, 0, aw, H); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
  for (let i = 0; i < 70; i++) { const x = rng.range(0, aw), y = yAt(x) + rng.range(30, 300), r = rng.range(3, 9); g.fillStyle = 'rgba(110,100,90,0.45)'; g.beginPath(); g.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
  // distant woods: rounded crowns (or bare crowns in winter) standing on the ridge, darker the further out
  const pal = CANOPY[level.season] || CANOPY.summer, kinds = ['oak', 'pine', 'hickory', 'sweetgum'];
  for (let x = 30; x < aw - 10; x += rng.range(34, 70)) {
    const u = Math.max(0, uOf(x)); if (u < 60) continue;
    const gy = yAt(x) + 4, sp = kinds[Math.floor(rng.range(0, 4))], c = pal[sp] || pal.pine || CANOPY.summer.pine, h = rng.range(130, 220);
    g.strokeStyle = '#4E3A28'; g.lineWidth = 7; g.beginPath(); g.moveTo(x, gy); g.lineTo(x, gy - h * 0.7); g.stroke();
    if (!pal[sp]) { g.lineWidth = 2.5; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x, gy - h * (0.4 + k * 0.1)); g.lineTo(x + (k % 2 ? 1 : -1) * rng.range(18, 34), gy - h * (0.55 + k * 0.1)); g.stroke(); } continue; }
    for (let k = 0; k < 4; k++) {
      const bx = x + rng.range(-22, 22), by = gy - h * rng.range(0.62, 0.95), r = sp === 'pine' ? rng.range(18, 26) : rng.range(24, 36);
      g.fillStyle = 'rgba(26,20,16,0.6)'; g.beginPath(); g.arc(bx, by + 3, r + 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = k % 2 ? c.base : c.dark; g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = c.light; g.globalAlpha = 0.7; g.beginPath(); g.arc(bx - r * 0.3, by - r * 0.35, r * 0.45, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    }
  }
  // the same grass / litter / snow band as the battlefield's top edge
  g.lineJoin = 'round'; g.beginPath();
  for (let x = 0; x <= aw; x += 8) { const y = yAt(x); x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.strokeStyle = look.top; g.lineWidth = 16; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3; g.stroke();
  // fade the far end so the scenery recedes rather than stopping
  const sky = SKY[level.time];
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (sky && sky.tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = sky.tint; g.fillRect(0, 0, cv.width, cv.height); }
  g.globalCompositeOperation = 'source-atop';
  const fade = g.createLinearGradient(side < 0 ? 0 : cv.width, 0, side < 0 ? cv.width : 0, 0);
  fade.addColorStop(0, `rgba(${sky && sky.low ? hexRgb(sky.low) : '234,241,230'},0.55)`); fade.addColorStop(0.6, 'rgba(0,0,0,0)');
  g.fillStyle = fade; g.fillRect(0, 0, cv.width, cv.height);
  g.globalCompositeOperation = 'source-over';
  return { cv, x: side < 0 ? -APRON : W - ov, w: aw };
}
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };

// Obstacles standing on the slope (they match the sim mask's boulder circles and log/stump capsules).
function paintObstacles(level, rng, reuse) {
  const list = [...(level.boulders || []), ...(level.logs || []), ...(level.stumps || [])];
  if (!list.length) return null;
  const cv = reuse || document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), winter = level.season === 'winter';
  g.clearRect(0, 0, W, H);
  const moss = 'rgba(107,142,58,0.85)', snow = '#F4F6F5';
  for (const b of level.boulders || []) {
    // novaculite (the Ouachitas' hard white whetstone rock) or the slope's tan sandstone
    stone(g, b.x, b.y, b.r, rng, b.stone === 'novaculite' ? '#E6E2D6' : '#B8A88A');
    g.fillStyle = winter ? snow : moss;
    g.beginPath(); g.ellipse(b.x - b.r * 0.1, b.y - b.r * 0.8, b.r * 0.6, b.r * 0.2, -0.1, 0, Math.PI * 2); g.fill();
  }
  for (const l of level.logs || []) {
    const a = (l.a * Math.PI) / 180, hl = l.len / 2, r = l.r;
    g.save(); g.translate(l.x, l.y); g.rotate(a);
    g.fillStyle = 'rgba(26,20,16,0.3)'; g.beginPath(); g.ellipse(4, r * 0.9, hl + 6, r * 0.45, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1A1410'; g.beginPath(); g.roundRect(-hl - 2, -r - 2, l.len + 4, r * 2 + 4, r + 2); g.fill();
    const lg = g.createLinearGradient(0, -r, 0, r); lg.addColorStop(0, '#8A6A48'); lg.addColorStop(0.5, '#5B4632'); lg.addColorStop(1, '#3E2F22');
    g.fillStyle = lg; g.beginPath(); g.roundRect(-hl, -r, l.len, r * 2, r); g.fill();
    g.strokeStyle = 'rgba(25,15,8,0.35)'; g.lineWidth = 1.4;
    for (let x = -hl + 10; x < hl - 10; x += rng.range(9, 16)) { g.beginPath(); g.moveTo(x, -r * 0.7); g.lineTo(x + rng.range(4, 10), -r * 0.1); g.stroke(); }
    // the sawn end: pale wood with growth rings
    g.fillStyle = '#D8B98A'; g.beginPath(); g.ellipse(hl - 2, 0, r * 0.45, r * 0.92, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(110,70,40,0.6)'; g.lineWidth = 1;
    for (let k = 1; k < 3; k++) { g.beginPath(); g.ellipse(hl - 2, 0, r * 0.45 * k / 3, r * 0.92 * k / 3, 0, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = winter ? snow : moss; g.beginPath(); g.ellipse(-hl * 0.2, -r * 0.85, hl * 0.55, r * 0.28, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  for (const s of level.stumps || []) {
    const top = s.y - s.h, r = s.r;
    g.fillStyle = '#1A1410'; g.fillRect(s.x - r - 2, top - 2, r * 2 + 4, s.h + 2);
    g.beginPath(); g.ellipse(s.x, s.y, r * 1.45, 7, 0, Math.PI, 0); g.fill();
    const lg = g.createLinearGradient(s.x - r, 0, s.x + r, 0); lg.addColorStop(0, '#7A5E42'); lg.addColorStop(0.6, '#5B4632'); lg.addColorStop(1, '#3E2F22');
    g.fillStyle = lg; g.fillRect(s.x - r, top, r * 2, s.h);
    g.beginPath(); g.ellipse(s.x, s.y - 1, r * 1.35, 6, 0, Math.PI, 0); g.fill(); // root flare
    g.strokeStyle = 'rgba(25,15,8,0.3)'; g.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) { const x = s.x - r * 0.6 + k * r * 0.6; g.beginPath(); g.moveTo(x, top + 6); g.lineTo(x + rng.range(-2, 2), s.y - 6); g.stroke(); }
    g.fillStyle = winter ? snow : '#D8B98A'; g.beginPath(); g.ellipse(s.x, top, r, r * 0.32, 0, 0, Math.PI * 2); g.fill();
    if (!winter) { g.strokeStyle = 'rgba(110,70,40,0.6)'; g.lineWidth = 1; g.beginPath(); g.ellipse(s.x, top, r * 0.55, r * 0.17, 0, 0, Math.PI * 2); g.stroke(); }
  }
  const sky = SKY[level.time];
  if (sky && sky.tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = sky.tint; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
  return cv;
}

// An irregular outlined stone: a jittered polygon, lit top-left, with a crack.
function stone(g, x, y, r, rng, col) {
  const n = 9, pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rr = r * rng.range(0.78, 1.08); pts.push([x + Math.cos(a) * rr * 1.15, y + Math.sin(a) * rr * 0.85]); }
  const path = () => { g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); };
  g.fillStyle = 'rgba(26,20,16,0.35)'; g.save(); g.translate(3, 4); path(); g.fill(); g.restore();
  path(); g.fillStyle = '#2B2A27'; g.lineWidth = 3.5; g.strokeStyle = '#2B2A27'; g.stroke();
  const lg = g.createLinearGradient(x - r, y - r, x + r, y + r);
  lg.addColorStop(0, '#F2EBDC'); lg.addColorStop(0.35, col); lg.addColorStop(1, '#5E5A52');
  g.fillStyle = lg; path(); g.fill();
  g.strokeStyle = 'rgba(40,36,30,0.5)'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(x - r * 0.5, y - r * 0.1); g.lineTo(x + r * 0.05, y + r * 0.25); g.lineTo(x + r * 0.5, y - r * 0.2); g.stroke();
}

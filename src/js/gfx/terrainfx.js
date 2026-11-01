// The visual terrain: an offscreen canvas painted once per round from the level's ground line, then carved with
// destination-out at the same circles as the sim's mask (MECHANICS.md §4), plus a dark rim so craters read as dug.
import { W, H } from '../sim/const.js';
import { GROUND, SKY } from './looks.js';

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
    ctx.drawImage(this.cv, sx, sy, W * cam.zoom, H * cam.zoom);
  }
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

// Code-drawn trees (branches must be able to break): tapered bark strokes and clustered leaf canopies in the
// season's colours. Each tree is cached to its own sprite and redrawn only when one of its branches breaks.
import { CANOPY, BARK, ACCENT, SKY } from './looks.js';
import { makeRng } from '../rng.js';

const PAD = 90;

export class TreeLayer {
  constructor() { this.cache = []; this.res = 1; }
  invalidate(i) { if (i == null) this.cache = []; else this.cache[i] = null; }

  sprite(i, def, geom, season) {
    const c = this.cache[i];
    if (c && c.res === this.res) return c;
    const bb = bounds(geom);
    const r = this.res, cv = document.createElement('canvas');
    cv.width = Math.ceil((bb.x1 - bb.x0 + PAD * 2) * r); cv.height = Math.ceil((bb.y1 - bb.y0 + PAD * 2) * r);
    const g = cv.getContext('2d');
    g.setTransform(r, 0, 0, r, (-bb.x0 + PAD) * r, (-bb.y0 + PAD) * r);
    drawTree(g, def, geom, season, makeRng(def.x * 31 + def.baseY));
    const sky = SKY[this.time];
    if (sky && sky.tint) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = sky.tint; g.fillRect(0, 0, cv.width, cv.height); g.globalCompositeOperation = 'source-over'; }
    const out = { cv, x: bb.x0 - PAD, y: bb.y0 - PAD, res: r };
    this.cache[i] = out;
    return out;
  }

  draw(ctx, cam, level, sim) {
    this.time = level.time;
    for (let i = 0; i < level.trees.length; i++) {
      const s = this.sprite(i, level.trees[i], sim.geoms[i], level.season);
      const [sx, sy] = cam.toScreen(s.x, s.y);
      const w = (s.cv.width / s.res) * cam.zoom, h = (s.cv.height / s.res) * cam.zoom;
      if (sx > cam.vw || sy > cam.vh || sx + w < 0 || sy + h < 0) continue;
      ctx.drawImage(s.cv, sx, sy, w, h);
    }
  }
}

function bounds(geom) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  add(geom.trunk.x0, geom.trunk.y0); add(geom.trunk.x1, geom.trunk.y1);
  for (const s of geom.segs) { add(s.x0, s.y0); add(s.x1, s.y1); }
  for (const c of geom.canopies) { add(c.x - c.r, c.y - c.r); add(c.x + c.r, c.y + c.r); }
  return { x0, y0, x1, y1 };
}

export function barkStroke(g, x0, y0, x1, y1, w0, w1, col, outline = true) {
  if (outline) { barkStroke(g, x0, y0, x1, y1, w0 + 3, w1 + 3, 'rgba(26,20,16,0.85)', false); }
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  g.beginPath();
  g.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2);
  g.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  g.arc(x1, y1, w1 / 2, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
  g.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  g.closePath();
  g.fillStyle = col; g.fill();
  // light edge on one side, dark on the other
  g.strokeStyle = 'rgba(255,240,210,0.16)'; g.lineWidth = Math.max(1, w1 * 0.25);
  g.beginPath(); g.moveTo(x0 + nx * w0 * 0.3, y0 + ny * w0 * 0.3); g.lineTo(x1 + nx * w1 * 0.3, y1 + ny * w1 * 0.3); g.stroke();
  g.strokeStyle = 'rgba(20,12,6,0.25)';
  g.beginPath(); g.moveTo(x0 - nx * w0 * 0.32, y0 - ny * w0 * 0.32); g.lineTo(x1 - nx * w1 * 0.32, y1 - ny * w1 * 0.32); g.stroke();
}

export function drawTree(g, def, geom, season, rng) {
  const bark = BARK[def.species] || BARK.oak, tr = geom.trunk;
  const pal = (CANOPY[season] || CANOPY.summer)[def.species];
  // roots flare
  g.fillStyle = bark;
  g.beginPath(); g.ellipse(tr.x0, tr.y0 - 4, tr.w * 1.1, 8, 0, Math.PI, 0); g.fill();
  barkStroke(g, tr.x0, tr.y0, tr.x1, tr.y1, tr.w, tr.w * 0.45, bark);
  // bark texture: short horizontal ticks
  g.strokeStyle = 'rgba(25,15,8,0.22)'; g.lineWidth = 1.2;
  const L = Math.hypot(tr.x1 - tr.x0, tr.y1 - tr.y0);
  for (let s = 10; s < L - 10; s += def.species === 'pine' ? 9 : 14) {
    const u = s / L, x = tr.x0 + (tr.x1 - tr.x0) * u, y = tr.y0 + (tr.y1 - tr.y0) * u, w = tr.w * (1 - u * 0.55) * 0.35;
    g.beginPath(); g.moveTo(x - w + rng.range(-1, 1), y); g.lineTo(x + w * rng.range(0.2, 1), y + rng.range(-1, 1)); g.stroke();
  }
  for (const s of geom.segs) {
    if (s.broken) continue;
    barkStroke(g, s.x0, s.y0, s.x1, s.y1, s.w, Math.max(2.5, s.w * 0.4), bark);
  }
  if (!pal) { // bare winter crown: a few twigs
    g.strokeStyle = bark; g.lineWidth = 1.5;
    for (const s of geom.segs) if (!s.broken) for (let k = 0; k < 3; k++) {
      const u = 0.5 + k * 0.2, x = s.x0 + (s.x1 - s.x0) * u, y = s.y0 + (s.y1 - s.y0) * u;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + rng.range(-14, 14), y - rng.range(8, 20)); g.stroke();
    }
    return;
  }
  for (const c of geom.canopies) canopy(g, c, pal, def.species, season, rng);
}

function canopy(g, c, pal, species, season, rng) {
  const n = species === 'pine' ? 9 : 12;
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(0, c.r * 0.62);
    blobs.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * (species === 'pine' ? 0.55 : 0.8), r: c.r * rng.range(0.34, 0.5) });
  }
  blobs.sort((a, b) => a.y - b.y);
  // ink outline (matches the squirrels), dark under-layer, mid, then lit tops
  for (const b of blobs) { g.fillStyle = 'rgba(26,20,16,0.85)'; leafBlob(g, b.x, b.y + b.r * 0.12, b.r * 1.1, species, rng); }
  for (const b of blobs) { g.fillStyle = pal.dark; leafBlob(g, b.x, b.y + b.r * 0.18, b.r * 1.02, species, rng); }
  for (const b of blobs) {
    const rg = g.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.1, b.x, b.y, b.r);
    rg.addColorStop(0, pal.light); rg.addColorStop(0.55, pal.base); rg.addColorStop(1, pal.dark);
    g.fillStyle = rg; leafBlob(g, b.x, b.y, b.r * 0.92, species, rng);
  }
  for (const b of blobs) { g.fillStyle = pal.light; leafBlob(g, b.x - b.r * 0.22, b.y - b.r * 0.3, b.r * 0.5, species, rng); }
  // leaf texture: small lit and shaded leaves scattered over each canopy
  for (let i = 0; i < 46; i++) {
    const b = blobs[i % blobs.length], a = rng.range(0, Math.PI * 2), d = rng.range(0, b.r * 0.85);
    const lx = b.x + Math.cos(a) * d, ly = b.y + Math.sin(a) * d * 0.8;
    g.fillStyle = i % 3 ? pal.light : pal.dark; g.globalAlpha = 0.75;
    g.beginPath(); g.ellipse(lx, ly, rng.range(2, 4), rng.range(1.2, 2.4), rng.range(0, 3), 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  if (season === 'winter') for (const b of blobs) { g.fillStyle = '#F4F6F5'; g.beginPath(); g.ellipse(b.x - b.r * 0.1, b.y - b.r * 0.62, b.r * 0.62, b.r * 0.22, 0, 0, Math.PI * 2); g.fill(); }
  const acc = ACCENT[season];
  if (acc && species !== 'pine') for (let i = 0; i < 7; i++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(0, c.r * 0.8);
    g.fillStyle = acc[i % 2];
    g.beginPath(); g.arc(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.8, rng.range(2, 4), 0, Math.PI * 2); g.fill();
  }
}

function leafBlob(g, x, y, r, species, rng) {
  g.beginPath();
  if (species === 'pine') {
    // needle tufts: a flattened, spiky ellipse
    const k = 10;
    for (let i = 0; i <= k; i++) {
      const a = (i / k) * Math.PI * 2, rr = r * (i % 2 ? 0.78 : 1.05);
      const px = x + Math.cos(a) * rr * 1.25, py = y + Math.sin(a) * rr * 0.55;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
  } else {
    const k = 7;
    for (let i = 0; i <= k; i++) {
      const a = (i / k) * Math.PI * 2, rr = r * (0.88 + rng.range(0, 0.16));
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (!i) g.moveTo(px, py); else g.quadraticCurveTo(x + Math.cos(a - 0.45) * rr * 1.25, y + Math.sin(a - 0.45) * rr * 1.25, px, py);
    }
  }
  g.closePath(); g.fill();
}

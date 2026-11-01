// Canvas2D renderer (MECHANICS.md §10): sky, painted/vector Row backdrop with parallax, steam, terrain, the
// tower, trees, leaf piles, squirrels, nuts, falling branches, FX, the aim guide and in-world labels.
import { W, H, SQ_UP, NUTS, GRIP } from '../sim/const.js';
import { SKY } from './looks.js';
import { Camera } from './camera.js';
import { TerrainLayer } from './terrainfx.js';
import { TreeLayer, barkStroke } from './trees.js';
import { paintBackdrop, paintForestBand, BW, BH, BASE } from './backdrop.js';

export const ART_BASE = 0.762; // street line height in the Codex paintings (pilot: curb at 780 of 1024 px)
import { drawSquirrel, emblem, star } from './squirrels.js';
import { drawNut, NUT_COLORS } from './nuts.js';
import { Fx, Steam } from './fx.js';
import { TEAM_COLORS, BARK } from './looks.js';
import { makeRng } from '../rng.js';
import { drawBirds } from './birds.js';

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.cam = new Camera();
    this.terrain = new TerrainLayer(1);
    this.trees = new TreeLayer();
    this.fx = new Fx(makeRng(0xf00d));
    this.steam = new Steam(makeRng(0x57ea));
    this.backdrop = null;
    this.art = null; // {img, order} painted backdrop when loaded
    this.size = { w: 0, h: 0, dpr: 1 };
    this.reduced = false;
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(window.innerWidth)), h = Math.max(1, Math.round(window.innerHeight));
    if (w === this.size.w && h === this.size.h && dpr === this.size.dpr) return false;
    this.size = { w, h, dpr };
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.cam.resize(w, h);
    // tree sprites are cached at the zoom range we expect for this screen
    const res = Math.min(2, Math.max(0.5, dpr * Math.min(1, w / 1100) * 1.2));
    if (Math.abs(res - this.trees.res) > 0.01) { this.trees.res = res; this.trees.invalidate(); }
    return true;
  }

  setLevel(level, sim) {
    this.level = level;
    this.terrain.paint(level, sim, makeRng(level.seed ^ 0x7e11));
    const bd = paintBackdrop(level, makeRng(level.seed ^ 0xbd));
    this.backdrop = bd;
    this.band = paintForestBand(level, makeRng(level.seed ^ 0xba));
    this.trees.invalidate();
    this.fx.clear();
    this.steam.reset(level, sim.b.steamLevel);
  }

  carve(x, y, r) { this.terrain.carve(x, y, r); }

  draw(app) {
    const { g, cam, level } = this, { w, h, dpr } = this.size, sim = app.sim;
    if (!level || !sim) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    let ox = 0, oy = 0;
    if (cam.shake > 0 && !this.reduced) { ox = Math.sin(app.time * 70) * cam.shake * 6; oy = Math.cos(app.time * 53) * cam.shake * 5; }
    g.save(); g.translate(ox, oy);
    this.drawSky(g, w, h, app.time);
    this.drawBackdrop(g);
    this.steam.draw(g, cam, this.reduced ? 0.7 : 1);
    this.drawTower(g);
    this.terrain.draw(g, cam);
    // bedrock below the world: a deep-soil fade over the last stretch hides the canvas edges, then solid ground
    { const [, by] = cam.toScreen(0, H - 1); if (by < h) {
      const [, fy] = cam.toScreen(0, H - 260), fg = g.createLinearGradient(0, fy, 0, by);
      fg.addColorStop(0, 'rgba(38,28,19,0)'); fg.addColorStop(1, 'rgba(38,28,19,1)');
      g.fillStyle = fg; g.fillRect(-10, fy, w + 20, by - fy + 1);
      g.fillStyle = '#261C13'; g.fillRect(-10, by, w + 20, h - by + 10);
    } }
    this.drawPiles(g);
    this.trees.draw(g, cam, level, sim);
    this.drawFalling(g, sim);
    drawBirds(g, cam, sim, app.time);
    if (level.targets) this.drawTargets(g, app);
    if (app.showPerches) this.drawPerches(g, app);
    if (app.aimGuide) this.drawGuide(g, app.aimGuide);
    this.drawSquirrels(g, app);
    this.drawAimWedge(g, app);
    this.drawRivalPointer(g, app);
    this.drawInset(g, app);
    this.drawNuts(g, sim);
    this.fx.draw(g, cam);
    const sky = SKY[level.time] || SKY.day;
    if (sky.tint && level.time === 'night') { g.fillStyle = 'rgba(20,30,70,0.18)'; g.fillRect(-10, -10, w + 20, h + 20); }
    g.restore();
  }

  drawSky(g, w, h, t) {
    const sky = SKY[this.level.time] || SKY.day;
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, sky.top); gr.addColorStop(0.55, sky.mid); gr.addColorStop(1, sky.low);
    g.fillStyle = gr; g.fillRect(-10, -10, w + 20, h + 20);
    // sun or moon, fixed in screen space with a little parallax
    const night = this.level.time === 'night';
    const [sx, sy] = [w * 0.78 - (this.cam.x - W / 2) * 0.02 * this.cam.zoom, h * 0.16];
    g.fillStyle = sky.sun; g.globalAlpha = night ? 0.95 : 0.85;
    g.beginPath(); g.arc(sx, sy, Math.max(18, Math.min(w, h) * 0.045), 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    if (night) {
      const r = makeRng(9);
      g.fillStyle = 'rgba(255,255,240,0.8)';
      for (let i = 0; i < 70; i++) { const x = r.range(0, w), y = r.range(0, h * 0.5); g.fillRect(x, y, 1.5, 1.5); }
    } else {
      const r = makeRng(this.level.seed);
      for (let i = 0; i < 6; i++) {
        const cx = ((r.range(0, w * 1.4) + t * (6 + i * 2)) % (w * 1.4)) - w * 0.2, cy = r.range(h * 0.16, h * 0.34), s = r.range(26, 56) * Math.max(0.6, Math.min(1.4, w / 1000));
        const lobes = [[0, 0, 1], [-0.9, 0.2, 0.7], [0.9, 0.2, 0.75], [-0.35, -0.35, 0.8], [0.4, -0.3, 0.7]];
        // soft painted puffs: each lobe a radial gradient, cool shade underneath
        for (const [dx, dy, k] of lobes) {
          const lx = cx + dx * s, ly = cy + dy * s, lr = s * 0.62 * k, gr = g.createRadialGradient(lx - lr * 0.3, ly - lr * 0.35, lr * 0.1, lx, ly, lr);
          gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.65, 'rgba(244,246,250,0.85)'); gr.addColorStop(1, 'rgba(190,205,222,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(lx, ly, lr, 0, Math.PI * 2); g.fill();
        }
      }
    }
  }

  // world position of the backdrop panel, with parallax relative to the camera: the panel's street line sits
  // about 300 units above the valley floor so the Row shows through the valley between the two mountains
  backdropRect() {
    const L = this.level, cam = this.cam, p = this.reduced ? 0 : 0.5, k = 0.95;
    const cx = L.floorX + (cam.x - L.floorX) * p;
    const base = L.floorY - 300 + (this.reduced ? 0 : (cam.y - (L.floorY - 360)) * p * 0.5);
    return { x: cx - (BW * k) / 2, y: base - BASE * k, w: BW * k, h: BH * k };
  }
  drawBackdrop(g) {
    const r = this.backdropRect(), cam = this.cam;
    // continuous forest behind the backdrop's feathered edges (wide enough for the furthest zoom-out)
    if (this.band) {
      const bw = this.band.w * (r.w / BW), bh = this.band.h * (r.h / BH);
      const [bx, by] = cam.toScreen(r.x + r.w / 2 - bw / 2, r.y + 60);
      g.drawImage(this.band.cv, bx, by, bw * cam.zoom, bh * cam.zoom);
    }
    if (this.art && this.art.img) {
      // paintings keep their own aspect; their street line sits at ART_BASE of the height. They stretch to fill the
      // view only up to 1.3 panels wide, so zooming far out doesn't balloon the Row; past that the feathered
      // edges blend into the forest band
      const vwW = (cam.vw / cam.zoom) * 1.04, w = Math.max(r.w * 0.78, Math.min(vwW, r.w * 1.3)), h = (w * this.art.h) / this.art.w, base = r.y + BASE * (r.h / BH), y = base - h * ART_BASE;
      let [sx, sy] = cam.toScreen(r.x + (r.w - w) / 2, y);
      if (w >= vwW) sx = Math.min(0, Math.max(cam.vw - w * cam.zoom, sx)); // never let an edge into the view
      g.fillStyle = '#6E6E6C'; g.fillRect(sx, sy + h * cam.zoom - 2, w * cam.zoom, 500 * cam.zoom);
      // once the view is wider than the painting, cross-fade to its arch-feathered copy so no hard edge shows
      const u = this.art.soft ? Math.max(0, Math.min(1, (vwW / w - 1) / 0.2)) : 0;
      if (u < 1) { g.globalAlpha = 1 - u; g.drawImage(this.art.img, sx, sy, w * cam.zoom, h * cam.zoom); }
      if (u > 0) { g.globalAlpha = u; g.drawImage(this.art.soft, sx, sy, w * cam.zoom, h * cam.zoom); }
      g.globalAlpha = 1;
      return;
    }
    const [sx, sy] = cam.toScreen(r.x, r.y);
    if (this.backdrop) g.drawImage(this.backdrop.cv, sx, sy, r.w * cam.zoom, r.h * cam.zoom);
  }

  drawTower(g) {
    const L = this.level, cam = this.cam, T = L.tower;
    if (!T) return;
    // the Hot Springs Mountain Tower, 216 ft, at the level's vertical scale (a background prop, not solid)
    const hgt = 216 * 1.44, [bx, by] = cam.toScreen(T.x + 30, T.y + 10), z0 = cam.zoom, z = z0 * 1.35;
    const top = by - hgt * z0, w0 = 22 * z, w1 = 9 * z;
    g.fillStyle = 'rgba(120,116,106,0.35)';
    g.beginPath(); g.moveTo(bx - w0 * 1.4, by); g.lineTo(bx - w1, top); g.lineTo(bx + w1, top); g.lineTo(bx + w0 * 1.4, by); g.closePath(); g.fill();
    g.strokeStyle = '#2B2A27'; g.lineWidth = Math.max(2, 5 * z0);
    g.beginPath(); g.moveTo(bx - w0 * 1.4, by); g.lineTo(bx - w1, top); g.moveTo(bx + w0 * 1.4, by); g.lineTo(bx + w1, top); g.stroke();
    g.strokeStyle = '#8C877C'; g.lineWidth = Math.max(1, 3 * z0);
    g.beginPath(); g.moveTo(bx - w0 * 1.4, by); g.lineTo(bx - w1, top); g.moveTo(bx + w0 * 1.4, by); g.lineTo(bx + w1, top); g.stroke();
    g.lineWidth = Math.max(0.8, 1.6 * z);
    for (let k = 0; k < 12; k++) {
      const u1 = k / 12, u2 = (k + 1) / 12, wa = w0 + (w1 - w0) * u1, wb = w0 + (w1 - w0) * u2;
      g.beginPath(); g.moveTo(bx - wa, by - hgt * z0 * u1); g.lineTo(bx + wb, by - hgt * z0 * u2); g.moveTo(bx + wa, by - hgt * z0 * u1); g.lineTo(bx - wb, by - hgt * z0 * u2); g.stroke();
    }
    // the observation levels: an enclosed glass deck with an open deck and rail above
    g.fillStyle = '#2B2A27'; g.fillRect(bx - 31 * z, top - 34 * z, 62 * z, 36 * z);
    g.fillStyle = '#8C877C'; g.fillRect(bx - 29 * z, top - 14 * z, 58 * z, 14 * z);
    g.fillStyle = '#A7DDF2'; g.fillRect(bx - 26 * z, top - 12 * z, 52 * z, 9 * z);
    g.strokeStyle = '#5A564E'; g.lineWidth = Math.max(1, 1.4 * z);
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(bx + k * 10 * z, top - 12 * z); g.lineTo(bx + k * 10 * z, top - 3 * z); g.stroke(); }
    g.fillStyle = '#6E6A62'; g.fillRect(bx - 33 * z, top - 18 * z, 66 * z, 5 * z);
    g.fillStyle = '#8C877C'; g.fillRect(bx - 22 * z, top - 30 * z, 44 * z, 12 * z);
    g.strokeStyle = '#2B2A27'; g.beginPath(); g.moveTo(bx - 26 * z, top - 32 * z); g.lineTo(bx + 26 * z, top - 32 * z); g.stroke();
    g.fillStyle = '#C8392E'; g.beginPath(); g.arc(bx, top - 38 * z, 2.5 * z, 0, Math.PI * 2); g.fill();
  }

  drawPiles(g) {
    const cam = this.cam, z = cam.zoom, L = this.level;
    L.leafPiles.forEach((p, i) => {
      const [x, y] = cam.toScreen(p.x, p.y + 6);
      const cols = L.season === 'winter' ? ['#8A6A45', '#A8875E', '#E8ECEA', '#6E5438'] : ['#B07A30', '#9A5A2E', '#D4A72C', '#C8582E'];
      // a soft mound, then layered leaves from the back to the front
      g.fillStyle = 'rgba(26,20,16,0.3)'; g.beginPath(); g.ellipse(x + 6 * z, y + 2 * z, 100 * z, 16 * z, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#6B4A26'; g.beginPath(); g.ellipse(x, y - 4 * z, 96 * z, 34 * z, 0, Math.PI, 0); g.fill();
      for (let k = 0; k < 70; k++) {
        const a = Math.PI + (k * 2.39) % Math.PI, d = 14 + ((k * 37) % 76);
        const lx = x + Math.cos(a) * d * z, ly = y - 4 * z + Math.sin(a) * d * 0.42 * z - (76 - d) * 0.16 * z;
        g.fillStyle = cols[k % 4]; g.strokeStyle = 'rgba(26,20,16,0.5)'; g.lineWidth = Math.max(0.6, 1 * z);
        g.beginPath(); g.ellipse(lx, ly, 9 * z, 4.5 * z, (k * 1.3) % Math.PI, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      emblem(g, x, y - 46 * z, 8 * z, i);
    });
  }

  drawFalling(g, sim) {
    const cam = this.cam, z = cam.zoom;
    for (const f of sim.b.falling) {
      const s = f.seg, t = f.age, drop = 0.5 * 900 * t * t, rot = t * 2.2 * (s.x1 > s.x0 ? 1 : -1);
      const mx = (s.x0 + s.x1) / 2, my = (s.y0 + s.y1) / 2 + drop, hl = Math.hypot(s.x1 - s.x0, s.y1 - s.y0) / 2, a = Math.atan2(s.y1 - s.y0, s.x1 - s.x0) + rot;
      const [x0, y0] = cam.toScreen(mx - Math.cos(a) * hl, my - Math.sin(a) * hl), [x1, y1] = cam.toScreen(mx + Math.cos(a) * hl, my + Math.sin(a) * hl);
      g.globalAlpha = Math.max(0, 1 - t / 1.6);
      barkStroke(g, x0, y0, x1, y1, s.w * z, s.w * 0.4 * z, BARK[this.level.trees[f.tree].species] || BARK.oak);
      g.globalAlpha = 1;
    }
  }

  drawTargets(g, app) {
    const cam = this.cam, z = cam.zoom;
    this.level.targets.forEach((t, i) => {
      const [x, y] = cam.toScreen(t.x, t.y), hit = (app.targetsHit || []).includes(i);
      g.strokeStyle = '#5B4632'; g.lineWidth = 3 * z; g.beginPath(); g.moveTo(x, y + t.r * z); g.lineTo(x, y + 60 * z); g.stroke();
      for (let k = 3; k >= 0; k--) { g.fillStyle = k % 2 ? '#F6F3EC' : hit ? '#2A9D8F' : '#A9432C'; g.beginPath(); g.arc(x, y, t.r * z * (k + 1) / 4, 0, Math.PI * 2); g.fill(); }
      if (hit) star(g, x, y - t.r * z - 8 * z, 7 * z, '#F2C230');
    });
  }

  drawPerches(g, app) {
    const cam = this.cam, z = cam.zoom, sim = app.sim, q = sim.active();
    if (!q) return;
    const reach = sim.reach(), graph = sim.graphs[q.team];
    for (const [id] of reach) {
      const n = graph.byId.get(id);
      if (!n || id === q.perch) continue;
      const [x, y] = cam.toScreen(n.x, n.y);
      const hot = app.hoverPerch === id;
      g.fillStyle = hot ? 'rgba(255,246,200,0.95)' : 'rgba(255,246,200,0.55)';
      g.strokeStyle = '#1A1410'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(x, y - 3 * z, Math.max(3, (hot ? 7 : 4.5) * z), 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }

  drawSquirrels(g, app) {
    const cam = this.cam, z = cam.zoom, sim = app.sim, b = sim.b;
    const activeId = b.phase === 'aim' ? b.turn.sq : null;
    const plates = [];
    for (const q of b.squirrels) {
      const v = app.vis[q.id] || { x: q.x, y: q.y, pose: 'idle' };
      const [x, y] = cam.toScreen(v.x, v.y);
      if (x < -60 || x > cam.vw + 60 || y < -80 || y > cam.vh + 60) continue;
      // drawn larger than the hit body; fox squirrels are the bigger species; each family member a little different
      const s = z * (v.scale || 1) * (q.team === 0 ? 1.55 : 1.45) * [1, 0.93, 1.06, 0.97][q.id % 10];
      if (q.dummy) { dummy(g, x, y, s, q.out); continue; }
      let pose = q.out && !v.tumble ? 'out' : v.pose || 'idle';
      if (pose === 'idle' && q.id === activeId) pose = 'aim';
      if (v.tumble) { g.save(); g.translate(x, y - 24 * s); g.rotate(v.tumble.t * 9 * (q.facing || 1)); g.translate(-x, -(y - 24 * s)); }
      if (this.sprites) this.drawSprite(g, x, y, s, q.team, pose, app.time + q.id * 0.7, v.facing || q.facing, v.squash || 0, v.flash > 0, q.id % 10);
      else drawSquirrel(g, x, y, s, q.team, pose, app.time + q.id * 0.7, v.facing || q.facing, { squash: v.squash || 0, nutColor: q.id === activeId ? NUT_COLORS[b.teams[q.team].aim.nut] : null });
      if (v.tumble) g.restore();
      if (q.out && this.sprites) for (let i = 0; i < 3; i++) { const a = app.time * 3 + (i * Math.PI * 2) / 3; star(g, x + Math.cos(a) * 12 * s, y - 48 * s + Math.sin(a) * 4 * s, 4 * s, '#F2C230'); }
      if (q.out || app.scene !== 'battle' || this.inInset || x < -10 || x > cam.vw + 10) continue;
      // name + grip pill (shape emblem + label + bar)
      const k = Math.max(1.05, Math.min(1.35, z * 1.8)), ph = 21 * k, pw = Math.max(72 * k, ph + 12 + q.name.length * 8.8 * k);
      const px = Math.max(4, Math.min(cam.vw - pw - 4, x - pw / 2)); // kept inside the view
      let py = y - 74 * z - ph - 4;
      // stack nameplates that would overlap one already drawn this frame
      for (let k = 0; k < 4; k++) { const hit = plates.find((r) => px < r.x + r.w && px + pw > r.x && py < r.y + r.h && py + ph > r.y); if (!hit) break; py = hit.y - ph - 3; }
      plates.push({ x: px, y: py, w: pw, h: ph });
      g.fillStyle = 'rgba(26,20,16,0.78)'; roundRect(g, px, py, pw, ph, ph / 2); g.fill();
      const c = TEAM_COLORS[q.team];
      g.fillStyle = q.grip > GRIP * 0.5 ? '#7FC86A' : q.grip > GRIP * 0.25 ? '#F2C230' : '#E8604C';
      roundRect(g, px + ph, py + ph * 0.68, (pw - ph - 6) * (q.grip / GRIP), ph * 0.2, 2); g.fill();
      emblem(g, px + ph / 2, py + ph / 2, ph * 0.32, q.team);
      g.fillStyle = '#FFFFFF'; g.font = `700 ${Math.max(13, Math.round(ph * 0.56))}px system-ui, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(q.name, px + ph, py + ph * 0.34);
      g.textBaseline = 'alphabetic';
      if (q.id === activeId) {
        const bob = Math.sin(app.time * 5) * 3;
        g.fillStyle = c.acc; g.strokeStyle = '#1A1410'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, py - 6 + bob); g.lineTo(x - 8, py - 18 + bob); g.lineTo(x + 8, py - 18 + bob); g.closePath(); g.fill(); g.stroke();
      }
    }
  }

  // one frame from a family's sprite atlas; feet at (x, y), mirrored for facing left
  drawSprite(g, x, y, s, team, pose, t, facing, squash, flash, variant = 0) {
    const { imgs, meta } = this.sprites, list = meta.frames[pose] || meta.frames.idle;
    const rate = pose === 'scamper' ? 12 : pose === 'idle' ? 3 : pose === 'cheer' || pose === 'fall' ? 5 : 4;
    const f = list[Math.floor(t * rate) % list.length] + (meta.perVariant || 0) * (variant % (meta.variants || 1)), c = meta.cell, sx = (f % meta.cols) * c, sy = Math.floor(f / meta.cols) * c;
    const k = (s * 1.05) / meta.pxPerUnit; // screen px per atlas px (a touch larger than the 46-unit hit body)
    g.save(); g.translate(x, y); g.scale(facing * (1 + squash * 0.18), 1 - squash * 0.18);
    // a cream rim (pre-baked silhouette) keeps squirrels readable against foliage of their own colour
    if (this.sprites.rims) g.drawImage(this.sprites.rims[team], sx, sy, c, c, -meta.anchor[0] * k, -meta.anchor[1] * k, c * k, c * k);
    g.drawImage(imgs[team], sx, sy, c, c, -meta.anchor[0] * k, -meta.anchor[1] * k, c * k, c * k);
    if (flash) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.28; g.drawImage(imgs[team], sx, sy, c, c, -meta.anchor[0] * k, -meta.anchor[1] * k, c * k, c * k); }
    g.restore();
  }

  // Phones: while aiming with every rival off screen, a small picture-in-picture shows the nearest rival's tree.
  drawInset(g, app) {
    const sim = app.sim, b = sim.b, q = sim.active(), cam = this.cam;
    if (!q || b.phase !== 'aim' || b.practice || cam.vw > 700 || this.inInset) return;
    const foes = b.squirrels.filter((e) => e.team !== q.team && !e.out);
    const on = (e) => { const [x, y] = cam.toScreen(e.x, e.y - 20); return x > 0 && x < cam.vw && y > 0 && y < cam.vh; };
    if (!foes.length || foes.some(on)) return;
    const e = foes.reduce((a, c) => (Math.abs(c.x - q.x) < Math.abs(a.x - q.x) ? c : a));
    const iw = 128, ih = 96, ix = q.facing > 0 ? cam.vw - iw - 10 : 10, iy = 232;
    const inset = new Camera(); inset.resize(iw, ih); inset.x = e.x; inset.y = e.y - 40; inset.zoom = 0.42;
    const save = this.cam;
    g.save();
    g.fillStyle = '#1A1410'; g.fillRect(ix - 3, iy - 3, iw + 6, ih + 6);
    g.beginPath(); g.rect(ix, iy, iw, ih); g.clip(); g.translate(ix, iy);
    this.cam = inset; this.inInset = true;
    try {
      const sky = SKY[this.level.time] || SKY.day; g.fillStyle = sky.mid; g.fillRect(0, 0, iw, ih);
      this.drawBackdrop(g); this.terrain.draw(g, inset); this.trees.draw(g, inset, this.level, sim); this.drawSquirrels(g, app);
    } finally { this.cam = save; this.inInset = false; }
    g.restore();
    g.fillStyle = '#1A1410'; g.fillRect(ix - 3, iy + ih, iw + 6, 18);
    g.fillStyle = '#FFF6C8'; g.font = '700 12px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('Target: ' + e.name, ix + iw / 2, iy + ih + 13);
  }

  // when every rival is off screen (phones), an edge arrow points to the nearest one, with its distance
  drawRivalPointer(g, app) {
    const sim = app.sim, b = sim.b, q = sim.active(), cam = this.cam;
    if (!q || b.phase !== 'aim' || b.practice) return;
    const foes = b.squirrels.filter((e) => e.team !== q.team && !e.out);
    if (!foes.length) return;
    const on = (e) => { const [x, y] = cam.toScreen(e.x, e.y - 20); return x > 0 && x < cam.vw && y > 0 && y < cam.vh; };
    if (foes.some(on)) return;
    const e = foes.reduce((a, c) => (Math.abs(c.x - q.x) < Math.abs(a.x - q.x) ? c : a));
    const [ex, ey] = cam.toScreen(e.x, e.y - 20), cx = cam.vw / 2, cy = cam.vh / 2;
    const side = ex > cx ? 1 : -1, px = side > 0 ? cam.vw - 30 : 30, py = cam.vw <= 700 ? 205 : 120, a = side > 0 ? 0 : Math.PI;
    g.save(); g.translate(px, py); g.rotate(a);
    g.fillStyle = '#F2C230'; g.strokeStyle = '#1A1410'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(18, 0); g.lineTo(-10, -13); g.lineTo(-4, 0); g.lineTo(-10, 13); g.closePath(); g.fill(); g.stroke();
    g.restore();
    emblem(g, px - Math.cos(a) * 26, py - Math.sin(a) * 26, 9, e.team);
    g.font = '700 13px system-ui, sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#1A1410'; g.fillStyle = '#FFFFFF';
    const lbl = e.name, lx = px - Math.cos(a) * 26, ly = py - Math.sin(a) * 26 + 24;
    g.strokeText(lbl, lx, ly); g.fillText(lbl, lx, ly);
  }

  drawGuide(g, guide) {
    const cam = this.cam, n = guide.pts.length;
    let lx = -1e9, ly = -1e9;
    for (let i = 0; i < n; i++) {
      const [x, y] = cam.toScreen(guide.pts[i][0], guide.pts[i][1]);
      if (Math.hypot(x - lx, y - ly) < 11) continue;
      lx = x; ly = y;
      const r = Math.max(3.2, 5 * cam.zoom) * (1 - (i / n) * 0.35);
      g.globalAlpha = 1 - (i / n) * 0.5;
      g.fillStyle = '#1A1410'; g.beginPath(); g.arc(x, y, r + 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = i % 2 ? '#FFF6C8' : '#F2C230'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }

  // angle-and-power wedge at the thrower's hand: an arc from flat to the aim, a needle as long as the power
  drawAimWedge(g, app) {
    const sim = app.sim, b = sim.b, q = sim.active();
    if (!q || b.phase !== 'aim' || !b.teams[b.turn.team].human || app.aiActive) return;
    const aim = b.teams[b.turn.team].aim, h = sim.hand(q), [x, y] = this.cam.toScreen(h.x, h.y);
    const R = Math.max(26, 46 * this.cam.zoom), a = (aim.angle * Math.PI) / 180, f = q.facing;
    const ang = (d) => (f > 0 ? -d : Math.PI + d);
    g.save();
    g.fillStyle = 'rgba(242,194,48,0.22)'; g.strokeStyle = 'rgba(26,20,16,0.8)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y); g.arc(x, y, R, Math.min(ang(0), ang(a)), Math.max(ang(0), ang(a))); g.closePath(); g.fill(); g.stroke();
    const L = R * (0.35 + aim.power * 0.95), ex = x + Math.cos(ang(a)) * L, ey = y + Math.sin(ang(a)) * L;
    g.strokeStyle = '#1A1410'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = '#F2C230'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
    g.restore();
  }

  drawNuts(g, sim) {
    const cam = this.cam;
    for (const n of sim.b.nuts) {
      const [x, y] = cam.toScreen(n.x, n.y);
      const r = Math.max(9, n.r * cam.zoom * 2.3); // drawn larger than its hit circle so it reads in flight
      // a soft trail for readability
      const tx = x - n.vx * 0.09 * cam.zoom, ty = y - n.vy * 0.09 * cam.zoom, tr = g.createLinearGradient(x, y, tx, ty);
      tr.addColorStop(0, 'rgba(255,246,200,0.85)'); tr.addColorStop(1, 'rgba(255,246,200,0)');
      g.strokeStyle = tr; g.lineWidth = Math.max(2, r * 1.1); g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(x, y, r * 1.35, 0, Math.PI * 2); g.fill();
      drawNut(g, n.state === 'husk' ? 'sweetgum' : n.kind, x, y, r, n.spin);
      if (n.state === 'dash') { g.strokeStyle = 'rgba(255,246,200,0.8)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r * 1.8, 0, Math.PI * 2); g.stroke(); }
    }
  }

  // squirrel position helpers for the UI
  screenOf(wx, wy) { return this.cam.toScreen(wx, wy); }
}

function dummy(g, x, y, s, out) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#C49A6C'; g.strokeStyle = '#5B4632'; g.lineWidth = 2;
  g.fillRect(-3, -40, 6, 40);
  g.beginPath(); g.ellipse(0, -36, 13, 16, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#A9432C'; g.beginPath(); g.arc(0, -36, 5, 0, Math.PI * 2); g.fill();
  g.restore();
  if (out) star(g, x, y - 60 * s, 5 * s, '#F2C230');
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export { W, H, SQ_UP, NUTS };

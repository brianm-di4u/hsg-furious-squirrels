// Terrain as a material mask (MECHANICS.md §4): a Uint8Array at CELL world units per cell.
// Technique after the Tuts+ destructible pixel-terrain article (ideas only; see SAMPLES.md): circle carving,
// swept segment tests every step so nothing tunnels, and surface normals by averaging nearby solid cells.
import { W, H, CELL, MAT } from './const.js';

export class Terrain {
  constructor(level) {
    this.cw = Math.ceil(W / CELL);
    this.ch = Math.ceil(H / CELL);
    this.m = new Uint8Array(this.cw * this.ch);
    this.level = level;
    this.fill(level);
  }

  // Ground heights are sampled every level.groundStep units; rock and tufa are drawn into the dirt.
  groundY(x) {
    const g = this.level.ground, s = this.level.groundStep;
    const f = Math.max(0, Math.min(g.length - 1.001, x / s)), i = Math.floor(f), u = f - i;
    return g[i] * (1 - u) + g[i + 1] * u;
  }

  fill(level) {
    const { cw, ch, m } = this;
    for (let cx = 0; cx < cw; cx++) {
      const x = (cx + 0.5) * CELL, gy = this.groundY(x);
      const top = Math.max(0, Math.ceil(gy / CELL - 0.5));
      for (let cy = top; cy < ch; cy++) m[cy * cw + cx] = MAT.DIRT;
    }
    // bedrock: never carved, so every crater has a floor
    for (let cx = 0; cx < cw; cx++) {
      const x = (cx + 0.5) * CELL, rockTop = Math.max(this.groundY(x) + (level.dirtDepth || 140), H - 40);
      for (let cy = Math.floor(rockTop / CELL); cy < ch; cy++) m[cy * cw + cx] = MAT.ROCK;
    }
    for (const r of level.rocks || []) this.paint(r.x, r.y, r.r, MAT.ROCK, true);
    // obstacles on the slope stand above the ground: boulders, fallen logs (capsules along the slope), stumps
    for (const b of level.boulders || []) this.paint(b.x, b.y, b.r, MAT.ROCK, false);
    for (const l of level.logs || []) { const a = (l.a * Math.PI) / 180, hx = Math.cos(a) * l.len / 2, hy = Math.sin(a) * l.len / 2; this.capsule(l.x - hx, l.y - hy, l.x + hx, l.y + hy, l.r, MAT.LOG); }
    for (const s of level.stumps || []) this.capsule(s.x, s.y, s.x, s.y - s.h, s.r, MAT.LOG, true);
    // the valley floor (Central Ave and the Row's footing) is tufa and pavement: it does not carve
    if (level.floor) {
      const [x0, x1] = level.floor;
      for (let cx = Math.floor(x0 / CELL); cx <= Math.min(cw - 1, Math.ceil(x1 / CELL)); cx++) {
        const top = Math.ceil(this.groundY((cx + 0.5) * CELL) / CELL - 0.5);
        for (let cy = Math.max(0, top); cy < Math.min(ch, top + 30); cy++) m[cy * cw + cx] = MAT.TUFA;
      }
    }
    this.surf = new Float32Array(cw);
    this.refreshSurface(0, cw - 1);
  }

  paint(x, y, r, mat, onlySolid) {
    const { cw, ch, m } = this, r2 = (r / CELL) ** 2;
    const cx0 = Math.max(0, Math.floor((x - r) / CELL)), cx1 = Math.min(cw - 1, Math.ceil((x + r) / CELL));
    const cy0 = Math.max(0, Math.floor((y - r) / CELL)), cy1 = Math.min(ch - 1, Math.ceil((y + r) / CELL));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const dx = cx + 0.5 - x / CELL, dy = cy + 0.5 - y / CELL;
      if (dx * dx + dy * dy > r2) continue;
      const i = cy * cw + cx;
      if (!onlySolid || m[i]) m[i] = mat;
    }
  }

  // Fill a capsule (segment x0,y0 -> x1,y1 swept by radius r); flat: square ends (a sawn stump top).
  capsule(x0, y0, x1, y1, r, mat, flat = false) {
    const { cw, ch, m } = this, dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1;
    const cx0 = Math.max(0, Math.floor((Math.min(x0, x1) - r) / CELL)), cx1 = Math.min(cw - 1, Math.ceil((Math.max(x0, x1) + r) / CELL));
    const cy0 = Math.max(0, Math.floor((Math.min(y0, y1) - r) / CELL)), cy1 = Math.min(ch - 1, Math.ceil((Math.max(y0, y1) + r) / CELL));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const px = (cx + 0.5) * CELL, py = (cy + 0.5) * CELL, tr = ((px - x0) * dx + (py - y0) * dy) / l2;
      if (flat && (tr < 0 || tr > 1)) continue;
      const t = Math.max(0, Math.min(1, tr));
      if ((px - x0 - dx * t) ** 2 + (py - y0 - dy * t) ** 2 <= r * r) m[cy * cw + cx] = mat;
    }
  }

  // Remove dirt in a circle; rock and tufa stay. Returns cells cleared.
  carve(x, y, r) {
    const { cw, ch, m } = this, r2 = (r / CELL) ** 2;
    const cx0 = Math.max(0, Math.floor((x - r) / CELL)), cx1 = Math.min(cw - 1, Math.ceil((x + r) / CELL));
    const cy0 = Math.max(0, Math.floor((y - r) / CELL)), cy1 = Math.min(ch - 1, Math.ceil((y + r) / CELL));
    let n = 0;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const dx = cx + 0.5 - x / CELL, dy = cy + 0.5 - y / CELL;
      if (dx * dx + dy * dy > r2) continue;
      const i = cy * cw + cx;
      if (m[i] === MAT.DIRT) { m[i] = MAT.AIR; n++; }
    }
    if (n) this.refreshSurface(cx0, cx1);
    return n;
  }

  refreshSurface(cx0, cx1) {
    const { cw, ch, m, surf } = this;
    for (let cx = cx0; cx <= cx1; cx++) {
      let cy = 0;
      while (cy < ch && !m[cy * cw + cx]) cy++;
      surf[cx] = cy * CELL;
    }
    let mn = Infinity;
    for (let i = 0; i < cw; i++) if (surf[i] < mn) mn = surf[i];
    this.minSurf = mn;
  }

  // Top solid y at world x (after craters).
  surfaceY(x) {
    const cx = Math.max(0, Math.min(this.cw - 1, Math.floor(x / CELL)));
    return this.surf[cx];
  }

  at(x, y) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    if (cx < 0 || cx >= this.cw) return MAT.AIR;
    if (cy < 0) return MAT.AIR;
    if (cy >= this.ch) return MAT.ROCK;
    return this.m[cy * this.cw + cx];
  }

  // Does a circle of radius r at (x, y) touch anything solid? Centre plus 8 rim points.
  circleHits(x, y, r) {
    if (this.at(x, y)) return true;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      if (this.at(x + Math.cos(a) * r, y + Math.sin(a) * r)) return true;
    }
    return false;
  }

  // First contact of a circle swept from (x0,y0) to (x1,y1): {x, y, t} at the last free position, or null.
  sweep(x0, y0, x1, y1, r) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    const n = Math.max(1, Math.ceil(len / CELL));
    let px = x0, py = y0;
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = x0 + dx * t, y = y0 + dy * t;
      if (this.circleHits(x, y, r)) return { x: px, y: py, t: (i - 1) / n, hx: x, hy: y };
      px = x; py = y;
    }
    return null;
  }

  // Outward surface normal near (x, y): average of vectors from nearby solid cells, normalised.
  normal(x, y, rad = 10) {
    let nx = 0, ny = 0;
    const s = CELL;
    for (let oy = -rad; oy <= rad; oy += s) for (let ox = -rad; ox <= rad; ox += s) {
      if (ox * ox + oy * oy > rad * rad) continue;
      if (this.at(x + ox, y + oy)) { nx -= ox; ny -= oy; }
    }
    const l = Math.hypot(nx, ny);
    return l > 1e-6 ? { x: nx / l, y: ny / l } : { x: 0, y: -1 };
  }
}

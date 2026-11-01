// 2D camera: {x, y, zoom} centred on a world point, lerp-followed toward a target, zoom-to-point for wheel and
// pinch (the world point under the cursor stays put). Modes set targets; the user's pan/zoom overrides until the
// next shot (MECHANICS.md §10).
import { W, H } from '../sim/const.js';

export class Camera {
  constructor() {
    this.x = W / 2; this.y = H / 2; this.zoom = 0.5;
    this.tx = this.x; this.ty = this.y; this.tz = this.zoom;
    this.vw = 800; this.vh = 600; this.mode = 'overview'; this.user = false;
    this.shake = 0;
  }
  resize(w, h) { this.vw = w; this.vh = h; }
  fitZoom(spanX, spanY) { return Math.min(this.vw / spanX, this.vh / spanY); }
  minZoom() { return this.vw / W; } // the world always fills the width
  maxZoom() { return Math.max(1.6, this.minZoom() * 4); }
  set(x, y, zoom, snap = false) {
    this.tx = x; this.ty = y; this.tz = Math.max(this.minZoom(), Math.min(this.maxZoom(), zoom));
    if (snap) this.snap();
  }
  snap() { this.x = this.tx; this.y = this.ty; this.zoom = this.tz; }
  // frame a world box with a margin (in screen px)
  frame(x0, y0, x1, y1, margin = 60, snap = false) {
    const z = Math.min((this.vw - margin * 2) / Math.max(40, x1 - x0), (this.vh - margin * 2) / Math.max(40, y1 - y0));
    this.set((x0 + x1) / 2, (y0 + y1) / 2, z, snap);
  }
  update(dt) {
    // keep the target inside the clamp, or the camera chases a point it can never reach
    { const sx = this.x, sy = this.y, sz = this.zoom; this.x = this.tx; this.y = this.ty; this.zoom = this.tz; this.clamp(); this.tx = this.x; this.ty = this.y; this.x = sx; this.y = sy; this.zoom = sz; }
    const k = 1 - Math.pow(1 - 0.12, dt * 60);
    this.x += (this.tx - this.x) * k; this.y += (this.ty - this.y) * k;
    this.zoom *= Math.pow(this.tz / this.zoom, k);
    this.clamp();
    this.shake = Math.max(0, this.shake - dt * 3);
    return Math.abs(this.tx - this.x) > 0.5 || Math.abs(this.ty - this.y) > 0.5 || Math.abs(this.tz / this.zoom - 1) > 0.002 || this.shake > 0;
  }
  clamp() {
    const hw = this.vw / 2 / this.zoom, hh = this.vh / 2 / this.zoom;
    const x0 = hw, x1 = W - hw;
    this.x = x0 > x1 ? W / 2 : Math.max(x0, Math.min(x1, this.x));
    const y0 = -900 + hh, y1 = H - hh;
    this.y = y0 > y1 ? (H - 400) / 2 : Math.max(y0, Math.min(y1, this.y));
  }
  toScreen(wx, wy) { return [(wx - this.x) * this.zoom + this.vw / 2, (wy - this.y) * this.zoom + this.vh / 2]; }
  toWorld(sx, sy) { return [(sx - this.vw / 2) / this.zoom + this.x, (sy - this.vh / 2) / this.zoom + this.y]; }
  // zoom by factor f keeping screen point (sx, sy) fixed
  zoomAt(f, sx, sy) {
    const [wx, wy] = this.toWorld(sx, sy);
    const z = Math.max(this.minZoom(), Math.min(this.maxZoom(), this.zoom * f));
    this.zoom = this.tz = z;
    this.x = this.tx = wx - (sx - this.vw / 2) / z;
    this.y = this.ty = wy - (sy - this.vh / 2) / z;
    this.clamp(); this.tx = this.x; this.ty = this.y;
    this.user = true;
  }
  panBy(dx, dy) {
    this.x -= dx / this.zoom; this.y -= dy / this.zoom; this.clamp();
    this.tx = this.x; this.ty = this.y; this.user = true;
  }
}

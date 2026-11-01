// The Bathhouse Row backdrop: a frontal panorama of the Row as seen from West Mountain's lower east slope,
// looking east across Central Avenue to Hot Springs Mountain (the view games/block-puzzle painted). The
// bathhouses run left to right as north to south in their true order (research/town-content.md §2;
// research/visual-style-guide.md skyline table). It is a background layer: a stylized theatre backdrop behind
// the battlefield's cross-section, drawn with parallax. Painted panoramas in assets/ replace this vector
// version when loaded; this is the ?art=0 fallback.
import { SKY } from './looks.js';

// North -> south. front: frontage ft; h: main height ft (HABS AR-28 measurements, rounded); gap: ft to the next.
export const ROW = [
  { id: 'arlington', name: 'Arlington Hotel', front: 230, h: 95, gap: 140, kind: 'arlington', body: '#E3CF94', roof: '#A9432C', set: 120 },
  { id: 'superior', name: 'Superior', front: 88, h: 30, gap: 3, kind: 'superior', body: '#E6D7B5', roof: '#B5654A', acc: '#4E7D5B' },
  { id: 'hale', name: 'Hale', front: 120, h: 23, gap: 58, kind: 'hale', body: '#F3EFE6', roof: '#A9432C' },
  { id: 'maurice', name: 'Maurice', front: 90, h: 36, gap: 43, kind: 'maurice', body: '#F3EFE6', roof: '#4E7D5B' },
  { id: 'fordyce', name: 'Fordyce', front: 105, h: 40, gap: 32, kind: 'fordyce', body: '#E3CF94', roof: '#A9432C', acc: '#6E4B2F' },
  { id: 'quapaw', name: 'Quapaw', front: 184, h: 35, gap: 30, kind: 'quapaw', body: '#F3EFE6', roof: '#A9432C' },
  { id: 'ozark', name: 'Ozark', front: 108, h: 26, gap: 18, kind: 'ozark', body: '#F3EFE6', roof: '#A9432C' },
  { id: 'buckstaff', name: 'Buckstaff', front: 105, h: 35, gap: 10, kind: 'buckstaff', body: '#E6D7B5', roof: '#C9A23F' },
  { id: 'lamar', name: 'Lamar', front: 94, h: 31, gap: 11, kind: 'lamar', body: '#F3EFE6', roof: '#A9432C' },
  { id: 'admin', name: 'Administration Building', front: 45, h: 28, gap: 0, kind: 'admin', body: '#F3EFE6', roof: '#A9432C' },
];
const FOCUS = { north: 'hale', middle: 'quapaw', south: 'buckstaff' };
export const SX = 1.75, SY = 3.0; // panel px per ft (heights exaggerated for readability)
export const BW = 2500, BH = 1000, BASE = 700; // panel size; street baseline y within the panel

export function rowLayout() {
  let x = 0;
  const out = [];
  for (const b of ROW) { out.push({ ...b, x0: x * SX, x1: (x + b.front) * SX }); x += b.front + b.gap; }
  return { list: out, total: x * SX };
}
// panel x of the stretch's focus building centre, so the battlefield's valley frames it
export function focusX(stretch) {
  const { list } = rowLayout(), f = list.find((b) => b.id === FOCUS[stretch]) || list[4];
  return (f.x0 + f.x1) / 2;
}
export function rowOrderFor() { return ROW.filter((b) => b.id !== 'arlington').map((b) => b.id); }

// A wide forested-mountain band (no buildings or street) drawn behind a painting, so the painted panel bleeds
// into continuous forest instead of ending in sky. Same hill and canopy recipe as the vector backdrop.
export function paintForestBand(level, rng) {
  const BWW = BW * 2.2, cv = document.createElement('canvas');
  cv.width = Math.round(BWW / 2); cv.height = Math.round(BH / 2);
  const g = cv.getContext('2d'), sky = SKY[level.time] || SKY.day, season = level.season;
  g.scale(0.5, 0.5);
  const leaf = { spring: '#7FA54A', summer: '#4F6B35', fall: '#B07A30', winter: '#6E6A55' }[season] || '#4F6B35';
  const hill = (y0, col, amp, ph) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, BH);
    for (let x = 0; x <= BWW; x += 25) g.lineTo(x, y0 - Math.sin((x / BWW) * Math.PI) * amp - Math.sin(x / 170 + ph) * 18);
    g.lineTo(BWW, BH); g.closePath(); g.fill();
  };
  hill(BASE - 300, mix(mix(leaf, '#5B7A8A', 0.35), sky.low, 0.4), 230, 1);
  hill(BASE - 180, mix(leaf, sky.low, 0.22), 200, 2.4);
  const pal = season === 'fall' ? ['#C27A40', '#D4A72C', '#9A5A2E', '#A8352E', '#5C7A3A'] : season === 'spring' ? ['#7FA54A', '#A3C46A', '#58783A', '#B5568F', '#F6F3EC'] : season === 'winter' ? ['#8A8676', '#A09A88', '#2F4A2C', '#B6B0A0', '#6E6A58'] : ['#4F6B35', '#6E8C45', '#33492A', '#5C7A3A', '#2F4A2C'];
  for (let i = 0; i < 1600; i++) {
    const x = rng.range(0, BWW), top = BASE - 180 - Math.sin((x / BWW) * Math.PI) * 200;
    const y = rng.range(top + 8, BH - 40), r = rng.range(12, 26);
    g.fillStyle = mix(pal[i % pal.length], sky.low, 0.28);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  if (sky.tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = sky.tint; g.fillRect(0, 0, BWW, BH); }
  return { cv, w: BWW, h: BH };
}

export function paintBackdrop(level, rng) {
  const cv = document.createElement('canvas');
  cv.width = BW; cv.height = BH;
  const g = cv.getContext('2d'), sky = SKY[level.time] || SKY.day, season = level.season;
  const { list } = rowLayout();
  const ox = BW / 2 - focusX(level.stretch); // shift so the focus building sits at the panel centre
  // Hot Springs Mountain's forested west face behind the Row
  const hill = (y0, col, amp, ph) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, BH);
    for (let x = 0; x <= BW; x += 25) g.lineTo(x, y0 - Math.sin((x / BW) * Math.PI * 0.9 + 0.25) * amp - Math.sin(x / 130 + ph) * 10);
    g.lineTo(BW, BH); g.closePath(); g.fill();
  };
  const leaf = { spring: '#7FA54A', summer: '#4F6B35', fall: '#B07A30', winter: '#6E6A55' }[season] || '#4F6B35';
  hill(BASE - 330, mix(mix(leaf, '#5B7A8A', 0.35), sky.low, 0.35), 260, 1);
  hill(BASE - 210, mix(leaf, sky.low, 0.15), 200, 2.4);
  // canopy texture on the slope
  const pal = season === 'fall' ? ['#C27A40', '#D4A72C', '#9A5A2E', '#A8352E', '#5C7A3A'] : season === 'spring' ? ['#7FA54A', '#A3C46A', '#58783A', '#B5568F', '#F6F3EC'] : season === 'winter' ? ['#6E6A55', '#8A7A60', '#2F4A2C', '#9A8F7A', '#5E5A48'] : ['#4F6B35', '#6E8C45', '#33492A', '#5C7A3A', '#2F4A2C'];
  for (let i = 0; i < 900; i++) {
    const x = rng.range(0, BW), top = BASE - 210 - Math.sin((x / BW) * Math.PI * 0.9 + 0.25) * 200;
    const y = rng.range(top + 10, BASE - 20), r = rng.range(10, 24) * (0.7 + (y - top) / 500);
    g.fillStyle = mix(pal[i % pal.length], sky.low, Math.max(0, 0.3 - (y - top) / 1200));
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // the Grand Promenade: a brick walk along the hillside behind the bathhouses
  g.strokeStyle = mix('#B5654A', sky.low, 0.35); g.lineWidth = 6;
  g.beginPath(); g.moveTo(0, BASE - 118); g.bezierCurveTo(BW * 0.3, BASE - 110, BW * 0.7, BASE - 126, BW, BASE - 114); g.stroke();
  // trees on the slope below the walk partly hide it
  for (let i = 0; i < 160; i++) { const x = rng.range(0, BW), y = rng.range(BASE - 120, BASE - 30); g.fillStyle = mix(pal[i % 3], sky.low, 0.12); g.beginPath(); g.arc(x, y, rng.range(12, 22), 0, Math.PI * 2); g.fill(); }
  // steam drifting up from the hillside springs
  for (let i = 0; i < 9; i++) {
    const x = rng.range(BW * 0.1, BW * 0.9), y = BASE - rng.range(60, 160);
    const gr = g.createRadialGradient(x, y - 40, 4, x, y - 40, 70);
    gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y - 40, 40, 80, 0, 0, Math.PI * 2); g.fill();
  }
  // lawn and Central Avenue in front
  g.fillStyle = season === 'winter' ? '#DCE2E0' : mix('#6E8C45', sky.low, 0.08); g.fillRect(0, BASE - 6, BW, 60);
  g.fillStyle = '#B8B2A4'; g.fillRect(0, BASE + 44, BW, 16);
  g.fillStyle = '#6A6A68'; g.fillRect(0, BASE + 60, BW, BH - BASE - 60);
  g.strokeStyle = '#E8D27A'; g.lineWidth = 4; g.setLineDash([40, 40]);
  g.beginPath(); g.moveTo(0, BASE + 150); g.lineTo(BW, BASE + 150); g.stroke(); g.setLineDash([]);
  // buildings, back (Arlington, set back on the hill) first
  for (const b of list) building(g, b, ox, sky, level, rng);
  // magnolias (about 25 ft apart) and five-globe lamp posts along the curb
  for (let f = 0; f * 50 * SX < BW + 200; f++) {
    const x = (f * 50 + 6) * SX - ((-ox) % (50 * SX));
    magnolia(g, x, BASE + 44, season);
    if (f % 2 === 1) lamp(g, x + 12 * SX, BASE + 50, level.time === 'night');
  }
  if (sky.tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = sky.tint; g.fillRect(0, 0, BW, BH); g.globalCompositeOperation = 'source-over'; }
  if (level.time === 'night') {
    // lit windows and lamp glows after the tint
    for (const b of list) { if (b.id === 'arlington') continue; for (let k = 0; k < 4; k++) { if (rng.chance(0.5)) continue; const x = b.x0 + ox + (b.x1 - b.x0) * (0.15 + k * 0.22); g.fillStyle = 'rgba(255,214,140,0.85)'; g.fillRect(x, BASE - b.h * SY * 0.55, 10, 16); } }
  }
  // feather the panel edges into the sky
  g.globalCompositeOperation = 'destination-in';
  const fe = g.createLinearGradient(0, 0, BW, 0);
  fe.addColorStop(0, 'rgba(0,0,0,0)'); fe.addColorStop(0.08, 'rgba(0,0,0,1)'); fe.addColorStop(0.92, 'rgba(0,0,0,1)'); fe.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fe; g.fillRect(0, 0, BW, BH);
  g.globalCompositeOperation = 'source-over';
  const order = list.filter((b) => b.id !== 'arlington').map((b) => b.id);
  return { cv, order };
}

function building(g, b, ox, sky, level, rng) {
  const x0 = b.x0 + ox, x1 = b.x1 + ox, w = x1 - x0, h = b.h * SY, base = BASE - (b.set ? 90 : 0), top = base - h;
  if (x1 < -50 || x0 > BW + 50) return;
  const body = mix(b.body, sky.low, b.set ? 0.25 : 0.04), shade = mix(b.body, '#5E4B3C', 0.25), win = '#2B4C6E';
  const rect = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); };
  const hip = (xa, xb, y, rise, c, over = 6) => { g.fillStyle = c; g.beginPath(); g.moveTo(xa - over, y); g.lineTo(xa + (xb - xa) * 0.18, y - rise); g.lineTo(xb - (xb - xa) * 0.18, y - rise); g.lineTo(xb + over, y); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1.5; for (let k = 1; k < 5; k++) { const yy = y - (rise * k) / 5; g.beginPath(); g.moveTo(xa - over + ((xa + (xb - xa) * 0.18) - (xa - over)) * k / 5, yy); g.lineTo(xb + over - ((xb + over) - (xb - (xb - xa) * 0.18)) * k / 5, yy); g.stroke(); } };
  const windows = (n, yTop, wh, arch, c = win) => {
    for (let i = 0; i < n; i++) {
      const cx = x0 + ((i + 0.5) / n) * w, ww = Math.min(w / n * 0.5, 22);
      g.fillStyle = c; g.beginPath();
      if (arch) { g.moveTo(cx - ww / 2, yTop + wh); g.lineTo(cx - ww / 2, yTop + ww / 2); g.arc(cx, yTop + ww / 2, ww / 2, Math.PI, 0); g.lineTo(cx + ww / 2, yTop + wh); }
      else g.rect(cx - ww / 2, yTop, ww, wh);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(cx - ww / 2 + 2, yTop + (arch ? ww / 2 : 2), 3, wh * 0.5);
    }
  };
  // body
  rect(x0, top, w, h, body);
  rect(x0, base - 8, w, 8, shade);
  switch (b.kind) {
    case 'arlington': {
      windows(9, top + 30, h - 60, false, mix(win, sky.low, 0.25));
      for (let r = 1; r < 6; r++) { g.fillStyle = 'rgba(80,60,40,0.18)'; g.fillRect(x0, top + r * h / 6, w, 3); }
      for (const u of [0.18, 0.82]) { const tx = x0 + w * u - 24; rect(tx, top - 70, 48, 70, body); hip(tx, tx + 48, top - 70, 26, b.roof, 4); windows(1, top - 56, 30, true); }
      break;
    }
    case 'superior':
      for (let i = 0; i <= 6; i++) rect(x0 + (i / 6) * w - 4, top, 8, h, mix('#B5654A', body, 0.2));
      windows(6, top + h * 0.3, h * 0.45, false);
      for (let i = 0; i < 6; i++) { g.fillStyle = b.acc; g.beginPath(); g.arc(x0 + ((i + 0.5) / 6) * w, top + 14, 8, 0, Math.PI * 2); g.fill(); }
      rect(x0 - 4, top - 6, w + 8, 8, b.roof);
      rect(x0 + w * 0.15, base - h * 0.45, w * 0.7, h * 0.45, mix(body, '#FFFFFF', 0.3)); // sun porch
      windows(4, base - h * 0.38, h * 0.25, false);
      break;
    case 'hale':
      windows(5, top + 16, h * 0.55, true);
      hip(x0, x1, top, 52, b.roof, 10);
      // the bell gable sits low on the porch
      g.fillStyle = body; g.beginPath(); g.moveTo(x0 + w * 0.36, top + 20); g.quadraticCurveTo(x0 + w * 0.42, top - 12, x0 + w * 0.5, top - 18); g.quadraticCurveTo(x0 + w * 0.58, top - 12, x0 + w * 0.64, top + 20); g.closePath(); g.fill();
      rect(x0 + w * 0.3, base - h * 0.5, w * 0.4, h * 0.5, mix(body, '#C8C3B6', 0.3));
      break;
    case 'maurice':
      windows(3, top + 18, h * 0.35, true); windows(4, top + h * 0.58, h * 0.25, false);
      hip(x0, x0 + w * 0.36, top, 28, b.roof, 5); hip(x0 + w * 0.64, x1, top, 28, b.roof, 5);
      rect(x0 + w * 0.36, top - 28, w * 0.28, 28, body); hip(x0 + w * 0.36, x0 + w * 0.64, top - 28, 30, '#7FC8B8', 3);
      break;
    case 'fordyce': {
      rect(x0, base - h * 0.36, w, h * 0.36, mix('#E6D7B5', sky.low, 0.04));
      // brown diamonds in the light-yellow upper stories
      g.fillStyle = b.acc;
      for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) { const cx = x0 + ((i + 0.5) / 9) * w, cy = top + 14 + r * 18; g.beginPath(); g.moveTo(cx, cy - 6); g.lineTo(cx + 6, cy); g.lineTo(cx, cy + 6); g.lineTo(cx - 6, cy); g.fill(); }
      windows(7, top + h * 0.5, h * 0.16, true);
      hip(x0, x0 + w * 0.22, top, 26, b.roof, 4); hip(x0 + w * 0.78, x1, top, 26, b.roof, 4);
      rect(x0 + w * 0.32, top - 22, w * 0.36, 22, mix(body, '#FFFFFF', 0.2));
      // copper-and-glass marquee
      g.fillStyle = '#5E9C8C'; g.beginPath(); g.moveTo(x0 + w * 0.36, base - h * 0.3); g.lineTo(x0 + w * 0.64, base - h * 0.3); g.lineTo(x0 + w * 0.6, base - h * 0.22); g.lineTo(x0 + w * 0.4, base - h * 0.22); g.fill();
      break;
    }
    case 'quapaw': {
      windows(9, top + h * 0.35, h * 0.4, true);
      hip(x0, x1, top, 18, b.roof, 6);
      const cx = x0 + w / 2, dr = Math.min(80, w * 0.24);
      // the chevron-tiled dome and its lantern (the highest point on the Row)
      g.save(); g.beginPath(); g.ellipse(cx, top - 6, dr, dr * 0.85, 0, Math.PI, 0); g.closePath(); g.clip();
      const cols = ['#D8C29A', '#C8963E', '#3FA8A0', '#B89A6A', '#2B4C9B', '#E6D7B5'];
      for (let i = 0; i < 12; i++) { g.strokeStyle = cols[i % cols.length]; g.lineWidth = 9; g.beginPath(); for (let x = cx - dr; x <= cx + dr; x += 14) g.lineTo(x, top - 6 - i * 7 - ((x - cx) / 14 % 2 === 0 ? 0 : 5)); g.stroke(); }
      g.restore();
      g.strokeStyle = '#6E4B2F'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, top - 6, dr, dr * 0.85, 0, Math.PI, 0); g.stroke();
      rect(cx - 10, top - 6 - dr * 0.85 - 30, 20, 30, '#6B4E2E'); g.fillStyle = '#6B4E2E'; g.beginPath(); g.arc(cx, top - 6 - dr * 0.85 - 30, 11, Math.PI, 0); g.fill();
      break;
    }
    case 'ozark':
      windows(3, top + h * 0.35, h * 0.45, true);
      for (const u of [0.15, 0.85]) {
        const tx = x0 + w * u, tw = 30;
        for (let k = 0; k < 3; k++) rect(tx - tw / 2 + k * 3, top - 22 - k * 20, tw - k * 6, 22, body);
        hip(tx - tw / 2 + 9, tx + tw / 2 - 9, top - 62, 14, b.roof, 3);
        windows(0, 0, 0);
        g.fillStyle = win; g.beginPath(); g.arc(tx, top - 34, 5, 0, Math.PI * 2); g.fill();
      }
      break;
    case 'buckstaff':
      rect(x0 + w * 0.3, top - 28, w * 0.4, 28, body);
      for (let i = 0; i < 7; i++) { const cx = x0 + w * 0.12 + (i / 6) * w * 0.76; rect(cx - 4, top + 12, 8, h - 28, mix(body, '#FFFFFF', 0.4)); }
      windows(6, top + h * 0.3, h * 0.45, false);
      rect(x0 - 3, top - 5, w + 6, 7, mix(body, '#5E4B3C', 0.15));
      g.fillStyle = b.roof; g.fillRect(x0 + w * 0.4, top + 4, w * 0.2, 6); // brass name band (no letters)
      break;
    case 'lamar':
      windows(6, top + h * 0.3, h * 0.45, false);
      g.fillStyle = body; g.beginPath(); g.moveTo(x0 + w * 0.36, top); g.lineTo(x0 + w * 0.5, top - 14); g.lineTo(x0 + w * 0.64, top); g.fill();
      rect(x0 - 3, top - 4, w + 6, 6, b.roof);
      break;
    case 'admin':
      windows(2, top + h * 0.3, h * 0.45, false);
      hip(x0, x1, top, 26, b.roof, 6);
      break;
    default: break;
  }
  // door
  if (b.kind !== 'arlington') rect(x0 + w / 2 - 9, base - 34, 18, 26, '#3E3226');
  // entrance steps
  rect(x0 + w / 2 - 16, base - 8, 32, 8, '#C8C3B6');
  void level; void rng;
}

function magnolia(g, x, y, season) {
  g.fillStyle = '#4E3A28'; g.fillRect(x - 3, y - 30, 6, 30);
  const dark = season === 'winter' ? '#24402C' : '#1F3A26', mid = '#2F5233';
  g.fillStyle = dark; g.beginPath(); g.ellipse(x, y - 46, 19, 27, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = mid; g.beginPath(); g.ellipse(x - 4, y - 52, 13, 18, 0, 0, Math.PI * 2); g.fill();
  if (season === 'spring' || season === 'summer') { g.fillStyle = '#F6F3EC'; for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(x - 12 + (j * 8) % 24, y - 62 + ((j * 11) % 26), 3, 0, Math.PI * 2); g.fill(); } }
}

function lamp(g, x, y, lit) {
  g.strokeStyle = '#1F2A24'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 92); g.moveTo(x - 16, y - 80); g.lineTo(x + 16, y - 80); g.stroke();
  for (const [dx, dy] of [[0, -98], [-16, -84], [16, -84], [-9, -76], [9, -76]]) {
    if (lit) { const gr = g.createRadialGradient(x + dx, y + dy, 1, x + dx, y + dy, 22); gr.addColorStop(0, 'rgba(255,230,160,0.55)'); gr.addColorStop(1, 'rgba(255,230,160,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x + dx, y + dy, 22, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = lit ? '#FFF2C8' : '#F6F3EC'; g.beginPath(); g.arc(x + dx, y + dy, 5, 0, Math.PI * 2); g.fill();
  }
}

export function mix(a, b, t) {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const r = Math.round((p >> 16) * (1 - t) + (q >> 16) * t), gg = Math.round(((p >> 8) & 255) * (1 - t) + ((q >> 8) & 255) * t), bb = Math.round((p & 255) * (1 - t) + (q & 255) * t);
  return '#' + ((1 << 24) | (r << 16) | (gg << 8) | bb).toString(16).slice(1);
}

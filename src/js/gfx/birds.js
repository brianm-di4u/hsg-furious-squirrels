// Code-drawn birds in side view (MECHANICS.md §6b): one parametric silhouette per species, ink-outlined to match
// the squirrels, with flapping wings. Soarers (vulture, eagle) mostly hold their wings and glide.
import { BIRDS } from '../sim/const.js';
import { birdPos } from '../sim/birds.js';

// body: length; neck: head reach; beak: [length, colour]; span: one wing's length; flap: beats per second;
// soar: share of the time spent gliding; crest, mask, collar, tip: markings
const LOOK = {
  swift: { body: 15, belly: '#4A4440', back: '#34302C', head: '#34302C', neck: 4, beak: [2, '#1A1410'], span: 22, wing: '#2E2A26', tip: null, tail: [6, '#2E2A26'], flap: 9, soar: 0.2 },
  vulture: { body: 30, belly: '#2E2622', back: '#2E2622', head: '#C0453A', neck: 7, beak: [5, '#EDE3C8'], span: 46, wing: '#2E2622', trail: '#9A948C', tail: [12, '#2E2622'], flap: 1.6, soar: 0.92, dihedral: 0.35 },
  jay: { body: 18, belly: '#F2F0EA', back: '#3D7CC9', head: '#3D7CC9', neck: 4, beak: [4, '#1A1410'], span: 20, wing: '#3D7CC9', tip: '#1E3E7A', bars: true, tail: [12, '#3D7CC9'], flap: 7, soar: 0.1, crest: '#3D7CC9', collar: '#1A1410' },
  crow: { body: 22, belly: '#1C1C22', back: '#1C1C22', head: '#1C1C22', neck: 5, beak: [6, '#1A1410'], span: 28, wing: '#22222A', tip: null, tail: [12, '#1C1C22'], flap: 4.5, soar: 0.15 },
  goose: { body: 28, belly: '#C8BCA8', back: '#7A6A58', head: '#1A1A1A', neck: 16, beak: [6, '#1A1A1A'], span: 38, wing: '#6A5A4A', tip: '#3A3028', tail: [7, '#1A1A1A'], flap: 3.2, soar: 0.05, chin: '#F2F0EA' },
  waxwing: { body: 14, belly: '#D8C49A', back: '#B89A6A', head: '#B89A6A', neck: 4, beak: [2, '#1A1410'], span: 16, wing: '#8A8A80', tip: '#4A4A44', tail: [8, '#6A6A60'], tailTip: '#E8C83A', flap: 9, soar: 0.1, crest: '#B89A6A', mask: '#1A1410' },
  eagle: { body: 32, belly: '#3A2A1E', back: '#3A2A1E', head: '#F6F4EE', neck: 8, beak: [7, '#E8B83A'], span: 52, wing: '#3A2A1E', tip: '#2A1E14', tail: [14, '#F6F4EE'], flap: 1.8, soar: 0.85 },
};
const INK = '#1A1410';

export function drawBirds(g, cam, sim, t) {
  const b = sim.b;
  if (!b.birds || !b.birds.length) return;
  const env = sim.env(), k = Math.max(cam.zoom, 0.5); // birds never shrink below half size, so they read zoomed out
  for (let i = 0; i < b.birds.length; i++) {
    const bd = b.birds[i], p = birdPos(bd, b.birdT, env);
    const [x, y] = cam.toScreen(p.x, p.y);
    if (x < -80 || x > cam.vw + 80 || y < -80 || y > cam.vh + 80) continue;
    drawBird(g, bd.k, x, y, k * BIRDS[bd.k].r * 2.2, p.face, t + bd.ph, !!bd.flee);
  }
}

// one bird centred at (x, y), facing right when face > 0, its body len px long on screen
export function drawBird(g, kind, x, y, len, face, t, startled) {
  const L = LOOK[kind] || LOOK.crow, sc = len / L.body;
  // flap: a soaring bird glides most of each cycle; startled birds beat hard
  const rate = startled ? L.flap * 2.2 + 3 : L.flap, cyc = (t * rate) % 1, soarNow = !startled && ((t * 0.37) % 1) < L.soar;
  const beat = soarNow ? (L.dihedral || 0.1) : Math.sin(cyc * Math.PI * 2) * 0.9;
  g.save(); g.translate(x, y); g.scale(face * sc, sc);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const bl = L.body, bh = bl * 0.32;
  const wing = (front) => {
    // a wing from the shoulder, raised or lowered by the beat; the far wing is darker and drawn first
    const a = -beat * (front ? 1 : 0.8), sp = L.span * (front ? 1 : 0.85);
    const tx = -sp * 0.35, ty = Math.sin(a) * -sp - (front ? 0 : 2), mx = -sp * 0.1, my = ty * 0.55;
    g.beginPath(); g.moveTo(bl * 0.12, -bh * 0.2); g.quadraticCurveTo(mx + bl * 0.1, my - 4, tx, ty); g.quadraticCurveTo(mx - 4, my + 6, -bl * 0.22, bh * 0.1); g.closePath();
    g.fillStyle = INK; g.lineWidth = 3.2 / sc; g.strokeStyle = INK; g.stroke();
    g.fillStyle = front ? L.wing : shade(L.wing); g.fill();
    if (L.trail) { g.strokeStyle = L.trail; g.lineWidth = 3.4; g.beginPath(); g.moveTo(-bl * 0.18, bh * 0.05); g.quadraticCurveTo(mx - 3, my + 4, tx + 2, ty + 1); g.stroke(); }
    if (L.tip) { g.fillStyle = L.tip; g.beginPath(); g.arc(tx + 2, ty, Math.max(2.5, sp * 0.1), 0, Math.PI * 2); g.fill(); }
    if (L.bars && front) { g.strokeStyle = '#F2F0EA'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(mx * 0.6, my * 0.6); g.lineTo(mx * 0.6 - 4, my * 0.6 + 2); g.stroke(); }
  };
  wing(false);
  // tail
  const tl = L.tail[0];
  g.beginPath(); g.moveTo(-bl * 0.42, -bh * 0.25); g.lineTo(-bl * 0.42 - tl, -bh * 0.45); g.lineTo(-bl * 0.42 - tl, bh * 0.35); g.lineTo(-bl * 0.42, bh * 0.25); g.closePath();
  g.lineWidth = 3 / sc; g.strokeStyle = INK; g.stroke(); g.fillStyle = L.tail[1]; g.fill();
  if (L.tailTip) { g.fillStyle = L.tailTip; g.fillRect(-bl * 0.42 - tl - 0.5, -bh * 0.45, 3, bh * 0.8); }
  // body
  g.beginPath(); g.ellipse(0, 0, bl * 0.5, bh, 0, 0, Math.PI * 2);
  g.lineWidth = 3.2 / sc; g.stroke();
  g.fillStyle = L.back; g.fill();
  g.fillStyle = L.belly; g.beginPath(); g.ellipse(bl * 0.04, bh * 0.35, bl * 0.4, bh * 0.6, 0, 0, Math.PI); g.fill();
  // neck and head
  const hx = bl * 0.42 + L.neck, hy = -bh * 0.35 - (kind === 'goose' ? 1 : 0), hr = Math.max(3.2, bh * 0.62);
  if (L.neck > 6) { g.strokeStyle = INK; g.lineWidth = hr * 1.5 + 3 / sc; g.beginPath(); g.moveTo(bl * 0.3, -bh * 0.1); g.lineTo(hx, hy); g.stroke(); g.strokeStyle = kind === 'goose' ? L.head : L.back; g.lineWidth = hr * 1.5; g.stroke(); }
  g.beginPath(); g.arc(hx, hy, hr, 0, Math.PI * 2); g.lineWidth = 3 / sc; g.strokeStyle = INK; g.stroke(); g.fillStyle = L.head; g.fill();
  if (L.crest) { g.fillStyle = L.crest; g.beginPath(); g.moveTo(hx - hr * 0.6, hy - hr * 0.5); g.lineTo(hx - hr * 1.5, hy - hr * 1.6); g.lineTo(hx + hr * 0.2, hy - hr * 0.9); g.closePath(); g.fill(); }
  if (L.chin) { g.fillStyle = L.chin; g.beginPath(); g.ellipse(hx - hr * 0.1, hy + hr * 0.35, hr * 0.55, hr * 0.32, -0.4, 0, Math.PI * 2); g.fill(); }
  if (L.mask) { g.fillStyle = L.mask; g.fillRect(hx - hr * 0.2, hy - hr * 0.25, hr * 1.1, hr * 0.4); }
  if (L.collar) { g.strokeStyle = L.collar; g.lineWidth = 1.6; g.beginPath(); g.arc(hx - hr * 0.5, hy + hr * 0.2, hr * 0.9, 0.4, 2.2); g.stroke(); }
  // beak and eye
  g.fillStyle = L.beak[1]; g.beginPath(); g.moveTo(hx + hr * 0.8, hy - hr * 0.25); g.lineTo(hx + hr * 0.8 + L.beak[0], hy); g.lineTo(hx + hr * 0.8, hy + hr * 0.35); g.closePath(); g.fill();
  g.fillStyle = kind === 'eagle' ? INK : '#FFF6C8';
  g.beginPath(); g.arc(hx + hr * 0.3, hy - hr * 0.2, Math.max(1, hr * 0.22), 0, Math.PI * 2); g.fill();
  if (kind !== 'eagle') { g.fillStyle = INK; g.beginPath(); g.arc(hx + hr * 0.34, hy - hr * 0.2, Math.max(0.7, hr * 0.12), 0, Math.PI * 2); g.fill(); }
  wing(true);
  g.restore();
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.round(v * 0.72);
  return '#' + ((1 << 24) | (f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1);
}

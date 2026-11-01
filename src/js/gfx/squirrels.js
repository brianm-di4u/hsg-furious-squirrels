// Squirrels. Painted sprite atlases (Blender renders, M3) when loaded; this vector drawing is the fallback
// (?art=0) and the M0 placeholder. Origin is the perch point (feet); the body is about 46 units tall.
import { TEAM_COLORS } from './looks.js';

export function drawSquirrel(g, x, y, s, team, pose, t, facing, opts = {}) {
  const c = TEAM_COLORS[team];
  g.save();
  g.translate(x, y);
  g.scale(s * facing, s);
  const squash = opts.squash || 0;
  g.scale(1 + squash * 0.25, 1 - squash * 0.25);
  const bob = pose === 'idle' ? Math.sin(t * 3) * 0.8 : 0;
  const tailWave = Math.sin(t * (pose === 'idle' ? 2.4 : 6)) * (pose === 'cheer' ? 0.35 : 0.15);
  const out = pose === 'out';
  // tail: a bushy S-curve built from stacked circles behind the body
  g.save();
  g.translate(-9, -10 + bob);
  g.rotate(-0.25 + tailWave + (pose === 'fall' ? 0.8 : 0));
  const tail = [[0, 0, 7], [-5, -6, 8.5], [-8, -14, 9.5], [-7, -23, 9.5], [-2, -30, 8.5], [4, -33, 6.5]];
  g.fillStyle = c.coatDark;
  for (const [tx, ty, tr] of tail) { g.beginPath(); g.arc(tx, ty, tr + 1.6, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = c.coat;
  for (const [tx, ty, tr] of tail) { g.beginPath(); g.arc(tx, ty, tr, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (const [tx, ty, tr] of tail.slice(1, 5)) { g.beginPath(); g.arc(tx - tr * 0.3, ty - tr * 0.2, tr * 0.45, 0, Math.PI * 2); g.fill(); }
  g.restore();
  // body
  g.fillStyle = c.coatDark;
  g.beginPath(); g.ellipse(0, -15 + bob, 11.5, 15, 0.12, 0, Math.PI * 2); g.fill();
  g.fillStyle = c.coat;
  g.beginPath(); g.ellipse(0, -15 + bob, 10.5, 14, 0.12, 0, Math.PI * 2); g.fill();
  g.fillStyle = c.belly;
  g.beginPath(); g.ellipse(3.5, -13 + bob, 5.5, 10, 0.15, 0, Math.PI * 2); g.fill();
  // feet
  g.fillStyle = c.coatDark;
  g.beginPath(); g.ellipse(-3, -1, 5, 2.6, 0, 0, Math.PI * 2); g.ellipse(6, -1, 4.5, 2.4, 0, 0, Math.PI * 2); g.fill();
  // head
  const hy = -33 + bob + (pose === 'hit' ? 2 : 0);
  g.fillStyle = c.coatDark;
  g.beginPath(); g.ellipse(3, hy, 10.5, 9.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = c.coat;
  g.beginPath(); g.ellipse(3, hy, 9.6, 8.6, 0, 0, Math.PI * 2); g.fill();
  // ears
  g.fillStyle = c.coatDark;
  g.beginPath(); g.moveTo(-3, hy - 6); g.lineTo(-1, hy - 15); g.lineTo(3, hy - 7); g.fill();
  g.beginPath(); g.moveTo(4, hy - 7); g.lineTo(7, hy - 15.5); g.lineTo(9.5, hy - 6); g.fill();
  // muzzle and nose
  g.fillStyle = c.belly;
  g.beginPath(); g.ellipse(10, hy + 3, 4.8, 3.6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2B1E16';
  g.beginPath(); g.arc(14, hy + 1.5, 1.6, 0, Math.PI * 2); g.fill();
  // eye
  if (out || pose === 'hit') {
    g.strokeStyle = '#2B1E16'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(5, hy - 4); g.lineTo(9, hy); g.moveTo(9, hy - 4); g.lineTo(5, hy); g.stroke();
  } else {
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(7, hy - 2, 3.4, 3.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1A120C'; g.beginPath(); g.ellipse(8, hy - 1.8, 2.1, 2.6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(8.7, hy - 2.8, 0.8, 0, Math.PI * 2); g.fill();
  }
  // accessory: Rustlers wear a mustard cap, Tails a teal scarf
  if (team === 0) {
    g.fillStyle = c.accDark;
    g.beginPath(); g.ellipse(2, hy - 7, 9, 4.2, -0.1, Math.PI, 0); g.fill();
    g.fillStyle = c.acc;
    g.beginPath(); g.ellipse(2, hy - 7.4, 8.2, 3.6, -0.1, Math.PI, 0); g.fill();
    g.fillStyle = c.accDark; g.fillRect(6, hy - 8.2, 9, 2.4);
  } else {
    g.fillStyle = c.accDark;
    g.beginPath(); g.ellipse(2, hy + 8.5, 9.5, 3.6, 0.1, 0, Math.PI * 2); g.fill();
    g.fillStyle = c.acc;
    g.beginPath(); g.ellipse(2, hy + 8, 8.8, 3, 0.1, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-4, hy + 9); g.lineTo(-10, hy + 18); g.lineTo(-5, hy + 19); g.closePath(); g.fill();
  }
  // arm (and the nut in hand while aiming)
  g.strokeStyle = c.coatDark; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath();
  const ay = -20 + bob;
  if (pose === 'aim') { g.moveTo(4, ay); g.lineTo(-2, ay - 14); }
  else if (pose === 'throw') { g.moveTo(4, ay); g.lineTo(16, ay - 8); }
  else if (pose === 'cheer' || pose === 'fall') { g.moveTo(4, ay); g.lineTo(8, ay - 16); }
  else { g.moveTo(4, ay); g.lineTo(9, ay + 6); }
  g.stroke();
  if (pose === 'aim' && opts.nutColor) { g.fillStyle = opts.nutColor; g.beginPath(); g.arc(-2, ay - 16, 4, 0, Math.PI * 2); g.fill(); }
  g.restore();
  // dizzy stars over a knocked-out squirrel (drawn unflipped)
  if (out && !opts.noStars) {
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + (i * Math.PI * 2) / 3, sx = x + Math.cos(a) * 12 * s, sy = y - 44 * s + Math.sin(a) * 4 * s;
      star(g, sx, sy, 4 * s, '#F2C230');
    }
  }
}

export function star(g, x, y, r, col) {
  g.fillStyle = col; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}

// team emblem shapes, never colour alone: Rustlers ● acorn disc, Tails ▲ pine
export function emblem(g, x, y, r, team) {
  const c = TEAM_COLORS[team];
  g.fillStyle = c.ui; g.strokeStyle = '#1A1410'; g.lineWidth = Math.max(1, r * 0.18);
  g.beginPath();
  if (team === 0) g.arc(x, y, r, 0, Math.PI * 2);
  else { g.moveTo(x, y - r * 1.1); g.lineTo(x + r, y + r * 0.8); g.lineTo(x - r, y + r * 0.8); g.closePath(); }
  g.fill(); g.stroke();
}

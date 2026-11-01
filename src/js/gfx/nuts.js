// Nut drawings (code, crisp at any zoom). Each kind has its own silhouette so the nut bar never relies on colour.
export const NUT_COLORS = { acorn: '#A8703A', chinquapin: '#5A3420', pecan: '#8A5530', walnut: '#3A2A1E', hickory: '#D8C29A', sweetgum: '#7A5A3A', hedgeapple: '#9BBF3A' };

export function drawNut(g, kind, x, y, r, spin = 0) {
  g.save(); g.translate(x, y); g.rotate(spin);
  const ink = '#1A1410';
  g.lineWidth = Math.max(1, r * 0.16); g.strokeStyle = ink;
  switch (kind) {
    case 'acorn':
      g.fillStyle = '#B87A3E'; g.beginPath(); g.ellipse(0, r * 0.25, r * 0.78, r * 0.95, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#6E4A2A'; g.beginPath(); g.ellipse(0, -r * 0.35, r * 0.95, r * 0.5, 0, Math.PI, 0); g.lineTo(r * 0.95, -r * 0.3); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, -r * 0.8); g.lineTo(r * 0.15, -r * 1.25); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-r * 0.3, r * 0.2, r * 0.18, r * 0.35, 0, 0, Math.PI * 2); g.fill();
      break;
    case 'chinquapin':
      g.fillStyle = '#5A3420'; g.beginPath(); g.moveTo(0, -r); g.quadraticCurveTo(r * 1.1, -r * 0.2, 0, r); g.quadraticCurveTo(-r * 1.1, -r * 0.2, 0, -r); g.fill(); g.stroke();
      g.fillStyle = '#D8C29A'; g.beginPath(); g.ellipse(0, r * 0.62, r * 0.4, r * 0.28, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(-r * 0.25, -r * 0.25, r * 0.15, r * 0.3, 0.3, 0, Math.PI * 2); g.fill();
      break;
    case 'pecan':
      g.fillStyle = '#9A6236'; g.beginPath(); g.ellipse(0, 0, r * 1.25, r * 0.7, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.strokeStyle = '#3A2414'; g.lineWidth = Math.max(1, r * 0.2);
      for (const k of [-0.5, 0.1, 0.6]) { g.beginPath(); g.moveTo(r * k, -r * 0.55); g.lineTo(r * (k + 0.15), r * 0.55); g.stroke(); }
      break;
    case 'walnut':
      g.fillStyle = '#3A2A1E'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.stroke();
      g.strokeStyle = '#6E5440'; g.lineWidth = Math.max(1, r * 0.14);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2); g.quadraticCurveTo(Math.cos(a + 0.6) * r * 0.7, Math.sin(a + 0.6) * r * 0.7, Math.cos(a + 0.2) * r * 0.9, Math.sin(a + 0.2) * r * 0.9); g.stroke(); }
      break;
    case 'hickory':
      g.fillStyle = '#E2CFA2'; g.beginPath(); g.ellipse(0, 0, r * 0.95, r * 0.85, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.strokeStyle = '#8A7048'; g.lineWidth = Math.max(1, r * 0.14);
      g.beginPath(); g.moveTo(0, -r * 0.85); g.lineTo(0, r * 0.85); g.moveTo(-r * 0.95, 0); g.quadraticCurveTo(0, r * 0.3, r * 0.95, 0); g.stroke();
      break;
    case 'sweetgum': {
      g.fillStyle = '#7A5A3A';
      g.beginPath();
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? r * 0.75 : r * 1.15; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#4E3A26';
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.14, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'hedgeapple':
      g.fillStyle = '#9BBF3A'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.stroke();
      g.strokeStyle = '#6E8E24'; g.lineWidth = Math.max(1, r * 0.1);
      for (let i = 0; i < 9; i++) { const a = i * 2.4, d = (i % 3) * r * 0.28 + r * 0.15; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.24, 0, Math.PI * 1.4); g.stroke(); }
      g.fillStyle = 'rgba(255,255,230,0.3)'; g.beginPath(); g.arc(-r * 0.35, -r * 0.35, r * 0.3, 0, Math.PI * 2); g.fill();
      break;
    default:
      g.fillStyle = '#A8703A'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// a small canvas icon for the nut bar / shop / help (DOM)
export function nutIcon(kind, px = 40, dpr = 2) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = px * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  drawNut(g, kind, px / 2, px / 2 + 1, px * (kind === 'hedgeapple' ? 0.36 : kind === 'pecan' ? 0.28 : 0.32), kind === 'pecan' ? -0.5 : 0);
  return cv;
}

// Battle HUD (DOM over the canvas): family banners with emblem shapes and squirrel pips, turn label, wind flag
// with arrow + number, the nut bar, aim readout and action buttons, a phone mini-map, hints and big calls.
import { NUTS, NUT_ORDER, TEAMS, W, BIRDS } from '../sim/const.js';
import { nutIcon } from '../gfx/nuts.js';
import { TEAM_COLORS } from '../gfx/looks.js';

const EM = ['<svg class="em" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="10" fill="#E0B23A" stroke="#1A1410" stroke-width="2.5"/></svg>',
  '<svg class="em" viewBox="0 0 26 26" aria-hidden="true"><path d="M13 2 L24 22 L2 22 Z" fill="#2A9D8F" stroke="#1A1410" stroke-width="2.5"/></svg>'];

export class Hud {
  constructor(root, app) {
    this.root = root; this.app = app; this.last = '';
    root.innerHTML = `
      <div class="top">
        <div class="banner t0" id="ban0"></div>
        <div class="mid"><div class="turnlabel" id="turnlabel"></div><div class="wind" id="wind" role="img"><canvas width="128" height="52"></canvas><span></span><small class="aloft" id="aloft"></small></div></div>
        <div class="banner t1" id="ban1"></div>
      </div>
      <canvas class="minimap" id="minimap" width="740" height="88" aria-hidden="true"></canvas>
      <div class="hint" id="hint"></div>
      <div class="call" id="call" aria-hidden="true"></div>
      <div class="bottom">
        <div class="nutbar" id="nutbar" role="toolbar" aria-label="Choose a nut"></div>
        <div class="aimbox">
          <div class="readout" id="readout"></div>
          <div class="aimrow">
            <button type="button" class="btn small" id="b-move" data-hud="move" aria-pressed="false">Move</button>
            <button type="button" class="btn small" id="b-cam" data-hud="cam" aria-label="Recenter the camera">View</button>
            <button type="button" class="btn small pause" id="b-pause" data-hud="pause" aria-label="Pause">❚❚</button>
            <button type="button" class="btn primary throw" id="b-throw" data-hud="throw">Throw!</button>
          </div>
        </div>
      </div>`;
    this.el = (id) => root.querySelector('#' + id);
    this.windCv = root.querySelector('#wind canvas');
    root.querySelectorAll('[data-hud]').forEach((b) => {
      // act on pointerup for touch (LESSONS: a synthesized click may never come after a canvas drag)
      b.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { e.preventDefault(); b._t = performance.now(); app.onHud(b.dataset.hud); } });
      b.addEventListener('click', () => { if (b._t && performance.now() - b._t < 600) return; app.onHud(b.dataset.hud); });
    });
    this.callT = 0; this.hintText = '';
  }

  show(on) { this.root.classList.toggle('on', on); }

  buildNutBar() {
    const sim = this.app.sim, team = sim.b.turn.team, inv = sim.b.teams[team].inventory;
    const bar = this.el('nutbar');
    bar.innerHTML = NUT_ORDER.filter((k) => k === 'acorn' || k in inv).map((k) => `<button type="button" class="nut" data-nut="${k}" aria-label="${NUTS[k].name}${k === 'acorn' ? '' : ', ' + (inv[k] || 0) + ' left'}"><span class="key">${NUTS[k].key}</span><canvas></canvas><span class="nm">${NUTS[k].short}</span>${k === 'acorn' ? '<span class="ct">∞</span>' : `<span class="ct">${inv[k] || 0}</span>`}</button>`).join('');
    bar.querySelectorAll('.nut').forEach((b) => {
      const ic = nutIcon(b.dataset.nut, 34), c = b.querySelector('canvas');
      c.width = ic.width; c.height = ic.height; c.getContext('2d').drawImage(ic, 0, 0);
      b.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { e.preventDefault(); b._t = performance.now(); this.app.pickNut(b.dataset.nut); } });
      b.addEventListener('click', () => { if (b._t && performance.now() - b._t < 600) return; this.app.pickNut(b.dataset.nut); });
    });
    this.barKey = team + ':' + JSON.stringify(inv);
  }

  update() {
    const app = this.app, sim = app.sim, b = sim.b;
    if (!sim) return;
    const q = sim.active(), team = b.turn.team, tm = b.teams[team], human = tm.human && !app.aiActive;
    for (const t of [0, 1]) {
      const sq = b.squirrels.filter((s) => s.team === t && !s.dummy);
      const html = `${EM[t]}<div><div><span class="name-long">${TEAMS[t].name}</span><span class="name-short" ${t ? '' : ''}>${window.innerWidth <= 700 ? TEAMS[t].short : ''}</span></div>
        <div class="pips" aria-label="${sq.filter((s) => !s.out).length} of ${sq.length} squirrels left">${sq.map((s) => `<i class="pip ${s.out ? 'off' : ''}"></i>`).join('')}</div>
        ${b.rounds > 1 ? `<div class="rounds">Rounds ${b.roundWins[t]}</div>` : ''}</div>`;
      const ban = this.el('ban' + t);
      if (ban._h !== html) { ban.innerHTML = html; ban._h = html; }
      ban.classList.toggle('turn', team === t && !b.practice);
      if (b.practice && t === 1) ban.style.visibility = 'hidden'; else ban.style.visibility = '';
    }
    const who = q ? q.name : '';
    const phase = b.phase;
    let label = '';
    const narrow = window.innerWidth <= 700;
    if (phase === 'aim') label = human ? (narrow ? `${who}: aim & throw` : `${who}'s turn: aim and throw`) : `${who} (${TEAMS[team].short}) is aiming${app.aiActive ? '…' : ''}`;
    else if (phase === 'flight') label = (narrow ? '' : 'Nut in the air! ') + (b.nuts[0] && !b.nuts[0].tapped && NUTS[b.nuts[0].kind] && b.nuts[0].kind !== 'acorn' && b.nuts[0].kind !== 'hedgeapple' && tm.human ? 'Tap for trick!' : narrow ? 'Nut in the air!' : '');
    else if (phase === 'settle') label = 'Leaves settling…';
    else label = '';
    if (app.koHold > 0) label = '';
    if (b.practice && phase === 'aim') label = `Targets ${(app.targetsHit || []).length}/${(app.level.targets || []).length}`;
    const tl = this.el('turnlabel');
    if (tl.textContent !== label) tl.textContent = label;
    tl.style.visibility = label ? '' : 'hidden';
    // wind
    const wv = Math.round(Math.abs(b.wind) * 10), dir = b.wind > 0.02 ? 1 : b.wind < -0.02 ? -1 : 0;
    // birds aloft this turn (names, by flock)
    const kinds = [...new Set((b.birds || []).filter((x) => !x.flee).map((x) => x.k))], aloft = kinds.map((k) => BIRDS[k].plural).join(', ');
    const wk = wv + ':' + dir + ':' + aloft;
    if (this.windKey !== wk) {
      this.windKey = wk;
      drawWind(this.windCv, b.wind);
      const sp = this.el('wind').querySelector('span');
      sp.textContent = wv === 0 ? 'Calm' : `Wind ${wv} ${dir > 0 ? '→' : '←'}`;
      const al = this.el('aloft'); al.textContent = aloft ? 'Aloft: ' + aloft : ''; al.hidden = !aloft;
      this.el('wind').setAttribute('aria-label', (wv === 0 ? 'Wind calm' : `Wind ${wv} of 10 blowing ${dir > 0 ? 'east, to the right' : 'west, to the left'}`) + (aloft ? `. Birds aloft: ${aloft}` : ''));
    }
    // nut bar
    const key = team + ':' + JSON.stringify(tm.inventory);
    if (this.barKey !== key) this.buildNutBar();
    this.el('nutbar').querySelectorAll('.nut').forEach((bt) => {
      const k = bt.dataset.nut, can = sim.canUse(team, k);
      bt.classList.toggle('sel', tm.aim.nut === k);
      bt.disabled = !human || phase !== 'aim' || !can;
      bt.setAttribute('aria-pressed', String(tm.aim.nut === k));
    });
    const d = NUTS[(phase !== 'aim' && b.shot) ? b.shot.kind : tm.aim.nut];
    const ro = `${Math.round(tm.aim.angle)}° · ${Math.round(tm.aim.power * 100)}%<span class="trick">${d.name}: ${d.trick}</span>`;
    const r = this.el('readout');
    if (r._h !== ro) { r.innerHTML = ro; r._h = ro; }
    this.el('b-throw').disabled = !human || phase !== 'aim' || app.koHold > 0;
    const mv = this.el('b-move');
    mv.disabled = !human || phase !== 'aim' || b.turn.stamina < 20 || app.koHold > 0;
    mv.setAttribute('aria-pressed', String(!!app.showPerches));
    mv.textContent = app.showPerches ? 'Done' : window.innerWidth <= 700 ? 'Move' : `Move (${Math.round(b.turn.stamina / 3)}%)`;
    mv.setAttribute('aria-label', `Move: ${Math.round(b.turn.stamina / 3)}% stamina left`);
    // call fade
    if (this.callT > 0) { this.callT -= 1 / 60; if (this.callT <= 0) this.el('call').classList.remove('show'); }
    this.drawMinimap();
  }

  clearCalls() { this.callT = 0; this.el('call').classList.remove('show'); this.hint(''); }
  call(text, ms = 1200) { const c = this.el('call'); c.textContent = text; c.classList.add('show'); this.callT = ms / 1000; }
  hint(text) {
    const h = this.el('hint'); if (this.hintText === text) return; this.hintText = text; h.textContent = text || ''; h.classList.toggle('show', !!text);
    if (text) { const s = document.createElement('small'); s.textContent = 'Tap anywhere to close'; h.append(s); }
  }

  drawMinimap() {
    const cv = this.el('minimap');
    if (!cv || cv.offsetParent === null) return;
    const app = this.app, sim = app.sim, L = app.level, g = cv.getContext('2d'), w = cv.width, h = cv.height;
    const sx = w / W, y0 = 380, sy = h / (1120 - y0);
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#9FC6DE'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5E7A34';
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= W; x += 24) g.lineTo(x * sx, (sim.terrain.surfaceY(x) - y0) * sy);
    g.lineTo(w, h); g.closePath(); g.fill();
    // camera box
    const cam = app.renderer.cam, [wx0, wy0] = cam.toWorld(0, 0), [wx1, wy1] = cam.toWorld(cam.vw, cam.vh);
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
    // zoomed out past the world, the box is clipped to the map
    const bx0 = Math.max(1, wx0 * sx), bx1 = Math.min(w - 1, wx1 * sx), by0 = Math.max(1, (wy0 - y0) * sy), by1 = Math.min(h - 1, (wy1 - y0) * sy);
    if (bx1 > bx0 && by1 > by0) g.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
    for (const q of sim.b.squirrels) {
      if (q.out) continue;
      const x = Math.max(12, Math.min(w - 12, q.x * sx)), y = Math.max(13, Math.min(h - 10, (q.y - 20 - y0) * sy)), c = TEAM_COLORS[q.team];
      g.fillStyle = q.id === sim.b.turn.sq ? '#F2C230' : c.ui; g.strokeStyle = '#1A1410'; g.lineWidth = 2.5;
      g.beginPath();
      if (q.team === 0) g.arc(x, y, 10, 0, Math.PI * 2); else { g.moveTo(x, y - 11); g.lineTo(x + 10, y + 8); g.lineTo(x - 10, y + 8); g.closePath(); }
      g.fill(); g.stroke();
    }
    for (const n of sim.b.nuts) { g.fillStyle = '#FFF6C8'; g.beginPath(); g.arc(n.x * sx, (n.y - y0) * sy, 4, 0, Math.PI * 2); g.fill(); }
    void L;
  }
}

function drawWind(cv, wind) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height;
  g.clearRect(0, 0, w, h);
  // flagpole and a flag whose length shows strength
  g.strokeStyle = '#EDE3C8'; g.lineWidth = 4;
  const px = wind >= 0 ? 16 : w - 16;
  g.beginPath(); g.moveTo(px, 6); g.lineTo(px, h - 4); g.stroke();
  const len = 14 + Math.abs(wind) * (w - 46), dir = wind >= 0 ? 1 : -1;
  g.fillStyle = '#F2C230'; g.strokeStyle = '#1A1410'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(px, 8);
  g.quadraticCurveTo(px + dir * len * 0.5, 8 + (Math.abs(wind) < 0.1 ? 10 : 2), px + dir * len, 14 + (1 - Math.abs(wind)) * 12);
  g.lineTo(px, 28); g.closePath(); g.fill(); g.stroke();
}

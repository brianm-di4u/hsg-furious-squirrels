// Menu screens (DOM). Every action is a real <button>; arrow keys / d-pad move focus, Enter / A confirms,
// Esc / B goes back. Structure after games/Cart Racing/src/js/ui/screens.js (Hot Springs Games, MIT).
import { NUTS, NUT_ORDER, NUT_CAP, TEAMS } from '../sim/const.js';
import { nutIcon } from '../gfx/nuts.js';

export class Screens {
  constructor(root, app) { this.root = root; this.app = app; this.cur = null; this.data = {}; }
  show(name, data = {}) {
    this.cur = name; this.data = data;
    const html = TEMPLATES[name] ? TEMPLATES[name](this.app, data) : '';
    this.root.innerHTML = html;
    this.root.className = 'screens' + (html ? ' on' : '') + (name === 'title' ? '' : ' dim');
    document.body.dataset.screen = name;
    this.root.querySelectorAll('canvas[data-nut]').forEach((c) => { const ic = nutIcon(c.dataset.nut, 40); c.width = ic.width; c.height = ic.height; c.getContext('2d').drawImage(ic, 0, 0); });
    const more = this.root.querySelector('.help-more'), panel = this.root.querySelector('.panel');
    if (more && panel) panel.addEventListener('scroll', () => { more.style.visibility = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 30 ? 'hidden' : ''; });
    this.root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => { if (!b.disabled) this.app.onMenu(b.dataset.act, b.dataset); }));
    const first = this.root.querySelector('[autofocus]:not([disabled])') || this.root.querySelector('button:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }
  refresh() { if (this.cur) { const f = document.activeElement && document.activeElement.dataset ? { act: document.activeElement.dataset.act, v: document.activeElement.dataset.v, k: document.activeElement.dataset.k, kind: document.activeElement.dataset.kind } : null; this.show(this.cur, this.data); if (f) { const el = [...this.root.querySelectorAll('button')].find((b) => b.dataset.act === f.act && b.dataset.v === f.v && b.dataset.k === f.k && b.dataset.kind === f.kind); if (el) el.focus({ preventScroll: true }); } } }
  hide() { this.cur = null; this.root.innerHTML = ''; this.root.className = 'screens'; delete document.body.dataset.screen; }
  nav(m) {
    if (!this.cur) return false;
    const btns = [...this.root.querySelectorAll('button:not([disabled])')];
    if (!btns.length) return false;
    let i = btns.indexOf(document.activeElement);
    if (m.down || m.right) i = (i + 1) % btns.length;
    else if (m.up || m.left) i = (i - 1 + btns.length) % btns.length;
    else if (m.cancel) { const back = this.root.querySelector('[data-back]'); if (back) back.click(); return true; }
    else return false;
    btns[Math.max(0, i)].focus({ preventScroll: true });
    return true;
  }
}

const btn = (act, label, extra = '', cls = 'btn') => `<button type="button" class="${cls}" data-act="${act}" ${extra}>${label}</button>`;
const seg = (k, cur, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" class="btn small" data-act="set" data-k="${k}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
const field = (label, inner) => `<div class="field"><label>${label}</label>${inner}</div>`;
const starStr = (n) => `<span class="stars" aria-label="${n} of 3 stars">${[0, 1, 2].map((i) => (i < n ? `<span class="on" style="animation-delay:${0.25 + i * 0.2}s">★</span>` : '<span class="off">★</span>')).join('')}</span>`;
const FICTION = 'A made-up squirrel rivalry set in real Hot Springs, Arkansas.';

const TEMPLATES = {
  title: (app) => `
    <div class="title-wrap">
      <div class="logo-row"><canvas class="title-sq" data-sq="0:cheer" aria-hidden="true"></canvas><div class="logo"><h1>Furious<span>Squirrels</span></h1></div><canvas class="title-sq" data-sq="1:cheer:flip" aria-hidden="true"></canvas></div>
      <p class="tagline">Two families. Two mountains. One valley of nuts.</p>
      <div class="brand">Hot Springs Games</div>
      <nav class="menu" aria-label="Main menu">
        ${btn('story', app.save.story.unlocked > 1 ? 'Story: The Valley Nut Feud (continue)' : 'Story: The Valley Nut Feud', 'autofocus', 'btn primary')}
        ${btn('quick', 'Quick Battle')}
        ${btn('practice', 'Practice Range')}
        ${btn('help', 'How to Play')}
        ${btn('settings', 'Settings')}
        ${btn('credits', 'Credits')}
      </nav>
      <p class="fineprint">${FICTION} The places, trees and squirrels are real; the feud is game fiction.</p>
    </div>`,

  pickTeam: (app, { next }) => `
    <div class="panel" role="dialog" aria-label="Choose your family">
      <h2>Choose your family</h2>
      <p class="sub">The other family will be your rival. <span class="label-fiction">game fiction</span></p>
      <div class="cards">
        ${[0, 1].map((t) => `<button type="button" class="card btn" data-act="team" data-v="${t}" data-next="${next}" ${t === 0 ? 'autofocus' : ''} style="text-align:left;min-height:120px">
          <b>${t === 0 ? '● ' : '▲ '}${TEAMS[t].name}</b><br>${TEAMS[t].species} of ${TEAMS[t].home}${t === 0 ? ', in mustard caps' : ', in teal scarves'}.<br><small>${t === 0 ? 'Throwing right, across the valley toward the Tower.' : 'Throwing left, across the valley toward West Mountain.'}</small></button>`).join('')}
      </div>
      <nav class="menu row">${btn('back', 'Back', 'data-back')}</nav>
    </div>`,

  story: (app, { levels }) => {
    const st = app.save.story;
    return `
    <div class="panel" role="dialog" aria-label="Story map">
      <h2>The Valley Nut Feud</h2>
      <p class="sub">${TEAMS[st.team ?? 0].name} vs. ${TEAMS[1 - (st.team ?? 0)].name}. Win battles to unlock new nuts. <span class="label-fiction">game fiction</span></p>
      <div class="map">${levels.map((L, i) => {
        const open = L.n <= st.unlocked, s = st.stars[L.id] || 0;
        return `<button type="button" class="lvl" data-act="${open ? 'play' : 'locked'}" data-v="${L.id}" ${open ? '' : 'disabled'} ${L.n === Math.min(st.unlocked, levels.length) ? 'autofocus' : ''} aria-label="Battle ${L.n}: ${L.name}${open ? `, ${s} stars` : ', locked'}">
          <span class="n">${L.n}</span><span>${L.name}</span><span class="st">${open ? '★'.repeat(s) + '☆'.repeat(3 - s) : '🔒'}</span></button>`;
      }).join('')}</div>
      ${field('Difficulty', seg('difficulty', app.save.settings.difficulty, [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]))}
      <nav class="menu row">${btn('switchTeam', 'Switch family')}${btn('back', 'Back', 'data-back')}</nav>
    </div>`;
  },

  quick: (app, { levels }) => {
    const q = app.save.quick;
    return `
    <div class="panel" role="dialog" aria-label="Quick Battle setup">
      <h2>Quick Battle</h2>
      ${field('Battlefield', `<div class="seg">${levels.map((L) => `<button type="button" class="btn small" data-act="qset" data-k="level" data-v="${L.id}" aria-pressed="${q.level === L.id}">${L.n}. ${L.name}</button>`).join('')}</div>`)}
      ${field('Your family', `<div class="seg"><button type="button" class="btn small" data-act="qset" data-k="team" data-v="0" aria-pressed="${q.team == 0}">● Rustlers</button><button type="button" class="btn small" data-act="qset" data-k="team" data-v="1" aria-pressed="${q.team == 1}">▲ Tails</button></div>`)}
      ${field('Family size', `<div class="seg">${[2, 3, 4].map((n) => `<button type="button" class="btn small" data-act="qset" data-k="size" data-v="${n}" aria-pressed="${q.size == n}">${n}</button>`).join('')}</div>`)}
      ${field('Rounds', `<div class="seg">${[1, 3, 5].map((n) => `<button type="button" class="btn small" data-act="qset" data-k="rounds" data-v="${n}" aria-pressed="${q.rounds == n}">Best of ${n}</button>`).join('')}</div>`)}
      ${field('Wind', `<div class="seg">${[['off', 'Off'], ['light', 'Light'], ['normal', 'Normal'], ['gusty', 'Gusty']].map(([v, l]) => `<button type="button" class="btn small" data-act="qset" data-k="wind" data-v="${v}" aria-pressed="${q.wind === v}">${l}</button>`).join('')}</div>`)}
      ${field('Steam updraft', `<div class="seg">${[['off', 'Off'], ['on', 'On'], ['strong', 'Strong']].map(([v, l]) => `<button type="button" class="btn small" data-act="qset" data-k="steam" data-v="${v}" aria-pressed="${q.steam === v}">${l}</button>`).join('')}</div>`)}
      ${field('Birds', `<div class="seg">${[['off', 'Off'], ['some', 'Some'], ['lots', 'Lots']].map(([v, l]) => `<button type="button" class="btn small" data-act="qset" data-k="birds" data-v="${v}" aria-pressed="${(q.birds || 'some') === v}">${l}</button>`).join('')}</div>`)}
      ${field('Nuts', `<div class="seg"><button type="button" class="btn small" data-act="qset" data-k="loadout" data-v="all" aria-pressed="${q.loadout === 'all'}">All seven</button><button type="button" class="btn small" data-act="qset" data-k="loadout" data-v="story" aria-pressed="${q.loadout === 'story'}">Story unlocks</button><button type="button" class="btn small" data-act="qset" data-k="loadout" data-v="acorn" aria-pressed="${q.loadout === 'acorn'}">Acorns only</button></div>`)}
      ${field('Rival skill', `<div class="seg">${[['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].map(([v, l]) => `<button type="button" class="btn small" data-act="qset" data-k="difficulty" data-v="${v}" aria-pressed="${q.difficulty === v}">${l}</button>`).join('')}</div>`)}
      <nav class="menu row">${btn('quickGo', 'Start battle', 'autofocus', 'btn primary')}${btn('back', 'Back', 'data-back')}</nav>
    </div>`;
  },

  shop: (app, { team, round, winner }) => {
    const tm = app.sim.b.teams[team];
    return `
    <div class="panel" role="dialog" aria-label="Acorn shop">
      <h2>${winner === team ? 'Round won!' : winner < 0 ? 'A draw!' : 'Round to the rivals'}</h2>
      <p class="sub">Round ${round} done. Spend acorns on special nuts for the next round (up to ${NUT_CAP} of each). <span class="label-fiction">game rules</span></p>
      <p><b>Your acorns: ${tm.acorns}</b> <small>(prices in acorns)</small></p>
      ${NUT_ORDER.filter((k) => k !== 'acorn' && k in tm.inventory).map((k) => `<div class="nutrow"><canvas data-nut="${k}"></canvas><div><b>${NUTS[k].name}</b><br><small>${NUTS[k].trick}</small></div>
        <span class="price">${tm.inventory[k]}/${NUT_CAP}</span>${btn('buy', `Buy · ${NUTS[k].price}`, `data-kind="${k}" ${tm.inventory[k] >= NUT_CAP || tm.acorns < NUTS[k].price ? 'disabled' : ''}`, 'btn small')}</div>`).join('') || '<p>No special nuts unlocked yet.</p>'}
      <nav class="menu row">${btn('nextRound', 'Next round', 'autofocus', 'btn primary')}</nav>
    </div>`;
  },

  results: (app, d) => `
    <div class="panel" role="dialog" aria-label="Battle results">
      ${d.practice ? '' : `<div class="res-sq" aria-hidden="true"><canvas data-sq="${d.winner >= 0 ? d.winner : 0}:cheer"></canvas><canvas data-sq="${d.winner >= 0 ? 1 - d.winner : 1}:out:flip"></canvas></div>`}
      <h2>${d.win ? 'Victory!' : d.practice ? 'Practice done' : 'So close!'}</h2>
      <p class="winner">${d.winnerName ? `${d.winnerName} win the valley` : ''}</p>
      ${d.stars != null ? starStr(d.stars) : ''}
      ${d.unlock ? `<p><b>New nut unlocked:</b> ${NUTS[d.unlock].name}: ${NUTS[d.unlock].trick}</p>` : ''}
      ${d.stats.throws ? `<div class="statgrid">
        <div><span>Throws</span><b>${d.stats.throws}</b></div><div><span>Hits</span><b>${d.stats.hits}</b></div>
        <div><span>Knockouts</span><b>${d.stats.kos}</b></div><div><span>Biggest hit</span><b>${d.stats.best}</b></div>
        <div><span>Turns</span><b>${d.turns}</b></div><div><span>Acorns</span><b>${d.acorns}</b></div>
      </div>` : ''}
      ${d.fact ? `<div class="notes" role="note"><h3>Field Notes</h3>${d.fact.html}<span class="src">Source: ${d.fact.source}</span></div>` : ''}
      <nav class="menu row">${d.next ? btn('play', 'Next battle', `data-v="${d.next}" autofocus`, 'btn primary') : ''}${btn('again', 'Play again', d.next ? '' : 'autofocus')}${btn('menu', 'Menu', 'data-back')}</nav>
    </div>`,

  pause: () => `
    <div class="panel" role="dialog" aria-label="Paused" style="width:min(420px,100%)">
      <h2>Paused</h2>
      <nav class="menu">${btn('resume', 'Resume', 'autofocus data-back', 'btn primary')}${btn('help', 'How to Play')}${btn('settings', 'Settings')}${btn('restart', 'Restart battle')}${btn('menu', 'Quit to menu')}</nav>
    </div>`,

  help: () => `
    <div class="panel" role="dialog" aria-label="How to play">
      <h2>How to Play</h2>
      <p class="sub">${FICTION} <span class="label-fiction">Scroll for all six tips and the nut guide ↓</span></p>
      <div class="cards">
        <div class="card"><b>1. Aim</b><br>Drag back from anywhere like a slingshot: the direction sets the angle, the length sets the power. Keys: ←/→ angle, ↑/↓ power (Shift for big steps).</div>
        <div class="card"><b>2. Throw</b><br>Let go, press <b>Throw</b>, or press Space/Enter.</div>
        <div class="card"><b>3. Tap for the trick</b><br>While a special nut flies, tap or press Space once to trigger its trick.</div>
        <div class="card"><b>4. Scamper</b><br>Press <b>Move</b> (or M), then pick a glowing perch on your own mountain. Each turn has a little stamina.</div>
        <div class="card"><b>5. Wind and steam</b><br>The flag shows wind (0–10). The steam over Bathhouse Row lifts nuts that fly through it (game rule).</div>
        <div class="card"><b>6. Knock them out!</b><br>Hits shake a squirrel's grip loose. At zero grip, or after a long tumble to the ground, it's out: into the leaf pile, unhurt. Out of squirrels, out of the round.</div>
      </div>
      <h3>The nuts</h3>
      ${NUT_ORDER.map((k) => `<div class="nutrow"><canvas data-nut="${k}"></canvas><div><b>${NUTS[k].key}. ${NUTS[k].name}</b><br><small>${NUTS[k].trick}</small></div></div>`).join('')}
      <nav class="menu row sticky"><span class="help-more" aria-hidden="true">↓ more below</span>${btn('back', 'Back', 'autofocus data-back', 'btn primary')}</nav>
    </div>`,

  settings: (app) => {
    const s = app.save.settings;
    return `
    <div class="panel" role="dialog" aria-label="Settings">
      <h2>Settings</h2>
      ${field('Sound', seg('sound', s.sound, [[true, 'On'], [false, 'Off']]))}
      ${field('Music', seg('music', s.music, [[true, 'On'], [false, 'Off']]))}
      ${field('Volume', seg('volume', s.volume, [[0.25, 'Low'], [0.5, 'Medium'], [0.8, 'High']]))}
      ${field('Motion', seg('reducedMotion', s.reducedMotion == null ? 'auto' : s.reducedMotion, [['auto', 'System'], [false, 'Full'], [true, 'Reduced']]))}
      ${field('Aim guide', seg('aimGuide', s.aimGuide, [['auto', 'By skill'], ['always', 'Always long'], ['off', 'Off']]))}
      ${field('Turn timer', seg('turnTimer', s.turnTimer, [[0, 'Off'], [30, '30 s'], [60, '60 s']]))}
      ${field('Text size', seg('textScale', s.textScale, [[1, '100%'], [1.25, '125%'], [1.5, '150%']]))}
      ${field('Tutorial hints', seg('tutorial', s.tutorial, [[true, 'On'], [false, 'Off']]))}
      <nav class="menu row">${btn('back', 'Done', 'autofocus data-back', 'btn primary')}${btn('resetProgress', 'Reset progress')}</nav>
    </div>`;
  },

  confirmReset: () => `
    <div class="panel" role="dialog" aria-label="Reset progress" style="width:min(420px,100%)">
      <h2>Reset progress?</h2><p>This clears Story stars and unlocks on this device.</p>
      <nav class="menu row">${btn('resetYes', 'Reset')}${btn('settings', 'Cancel', 'autofocus data-back', 'btn primary')}</nav>
    </div>`,

  credits: () => `
    <div class="panel" role="dialog" aria-label="Credits">
      <h2>Credits</h2>
      <p>${FICTION} Every squirrel name, the two families, the nut feud, the acorn shop and the steam updraft are game fiction. Nobody is ever hurt.</p>
      <h3>Real places and facts</h3>
      <ul>
        <li>Bathhouse Row order, architecture and colors: the Hot Springs Games research corpus (NPS, HABS AR-28, the NHL nomination, Encyclopedia of Arkansas); Field Notes facts from the collection's audited trivia bank, each with its source.</li>
        <li>Valley shape: USGS 3D Elevation Program (public domain). Viewpoint and tower positions: © OpenStreetMap contributors (ODbL 1.0).</li>
        <li>Squirrels and nut trees: NPS NPSpecies, Missouri Department of Conservation, University of Arkansas Extension, USDA Forest Service Silvics; wind from the Iowa Environmental Mesonet ASOS archive.</li>
        <li>Birds: the NPS species list for Hot Springs National Park, the National Park Service (oaks and blue jays), Missouri Department of Conservation field guides and the Arkansas Game &amp; Fish Commission.</li>
        <li>No logos or marks of the National Park Service or any business; not affiliated with or endorsed by anyone shown.</li>
      </ul>
      <h3>Made with</h3>
      <ul><li>Hand-written Canvas2D and WebAudio. Backdrop paintings made for this game with Codex from a Blender block-out of the real valley; squirrels modelled in Blender. Sound-effect synthesis after ZzFX by Frank Force (MIT).</li>
      <li>Part of the open-source (MIT) Hot Springs Games collection.</li></ul>
      <nav class="menu row">${btn('back', 'Back', 'autofocus data-back')}</nav>
    </div>`,
};

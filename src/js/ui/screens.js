// Menu screens (DOM). Every action is a real <button>; arrow keys / d-pad move focus, Enter / A confirms,
// Esc / B goes back. Structure after games/Cart Racing/src/js/ui/screens.js (Hot Springs Games, MIT).
import { NUTS, NUT_ORDER, NUT_CAP, TEAMS } from '../sim/const.js';
import { nutIcon } from '../gfx/nuts.js';
import { starTiers } from '../save.js';
import { dayKey, fromKey, prevDay, liveStreak } from '../daily.js';
import { blurbFor, FINALE } from '../story.js';

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
    const bar = this.root.querySelector('#blurb');
    if (bar) this.root.querySelectorAll('.lvl[data-blurb]').forEach((b) => { const set = () => { bar.textContent = b.dataset.blurb; }; b.addEventListener('focus', set); b.addEventListener('mouseenter', set); });
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
const TIER_NAME = ['', 'Easy', 'Medium', 'Sharp', 'Hard']; // difficulty tier numbers saved with each star
const escHtml = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
// a Field Note as it reads on the results card and in the journal: a landmark note leads with its question and answer
// (so a text that begins "Its dome..." still stands alone); a nature note is its text. The source follows.
export function factHtml(f) {
  const land = f.q != null;
  // skip the short answer when the explanation already states it
  const says = land && f.text.toLowerCase().includes(String(f.a).toLowerCase().split(' ')[0]);
  return { id: f.id, html: land ? `<p><b>${escHtml(f.q)}</b> ${says ? '' : escHtml(f.a) + '. '}${escHtml(f.text)}</p>` : `<p>${escHtml(f.text)}</p>`, source: escHtml(f.source) };
}
const FICTION = 'A made-up squirrel rivalry set in real Hot Springs, Arkansas.';

const totalStars = (st, levels) => levels.reduce((n, L) => n + Math.min(3, st.stars[L.id] || 0), 0);
// the "New best!" lines on the results card
const recordLines = (r) => !r ? '' : [
  r.turns ? (r.turns.best ? `<p class="newbest"><b>New best!</b> Won in ${turns(r.turns.now)}${r.turns.was ? ` (before: ${r.turns.was})` : ''}.</p>` : `<p class="starrule">Your best here: ${turns(r.turns.was)}.</p>`) : '',
  r.shot ? `<p class="newbest"><b>New best hit!</b> ${r.shot} grip shaken loose.</p>` : '',
  r.streak ? `<p class="starrule">Win streak: ${r.streak} in a row.</p>` : '',
].join('');
const turns = (n) => n + (n === 1 ? ' turn' : ' turns');
const dayName = (k) => fromKey(k).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const lostText = (n) => n === 0 ? 'nobody knocked out' : `${n} ${n === 1 ? 'squirrel' : 'squirrels'} knocked out`;
// the Daily Duel lines on the results card
const dailyLines = (d) => d.won
  ? `<p class="newbest"><b>Daily Duel won!</b> ${turns(d.turns)}, ${lostText(d.outs)}.${d.best ? ' Your best for today.' : ` Your best for today: ${turns(d.today[0])}, ${lostText(d.today[1])}.`}</p><p class="starrule">${d.streak >= 2 ? `${d.streak} days in a row.` : 'A streak starts today.'} Best streak: ${d.bestStreak}. Come back tomorrow for a new battle.</p>`
  : `<p class="starrule"><b>Daily Duel:</b> not won yet today. Retry the exact same battle: the map, wind and birds stay put.${d.today ? ` Your best today: ${turns(d.today[0])}.` : ''}</p>`;
// the finale picture, drawn in code from the game's own squirrels and nut icons: both families cheering at one nut pile
const finaleScene = () => `<div class="finale" aria-hidden="true"><canvas data-sq="0:cheer"></canvas>
  <div class="pile"><div><canvas data-nut="acorn"></canvas></div><div><canvas data-nut="chinquapin"></canvas><canvas data-nut="hickory"></canvas></div><div><canvas data-nut="walnut"></canvas><canvas data-nut="hedgeapple"></canvas><canvas data-nut="pecan"></canvas></div></div>
  <canvas data-sq="1:cheer:flip"></canvas></div>`;
// the last seven days of the Daily Duel: the best win of each, or "no win"
const dailyHistory = (daily) => {
  const rows = [];
  for (let k = dayKey(), i = 0; i < 7; i++, k = prevDay(k)) {
    const h = daily.hist[k];
    rows.push(`<div class="rec-row day" role="row"><span class="rn" role="cell">${dayName(k)}</span><span class="rb" role="cell">${h ? `${turns(h[0])}, ${lostText(h[1])}` : 'no win'}</span></div>`);
  }
  return `<div class="rec-table" role="table" aria-label="Daily Duel, last seven days">${rows.join('')}</div>`;
};
const pct = (a, b) => b > 0 ? Math.round(100 * a / b) + '%' : 'none yet';

const TEMPLATES = {
  title: (app) => `
    <div class="title-wrap">
      <div class="logo-row"><canvas class="title-sq" data-sq="0:cheer" aria-hidden="true"></canvas><div class="logo"><h1>Furious<span>Squirrels</span></h1></div><canvas class="title-sq" data-sq="1:cheer:flip" aria-hidden="true"></canvas></div>
      <p class="tagline">Two families. Two mountains. One valley of nuts.</p>
      <div class="brand">Hot Springs Games</div>
      <nav class="menu" aria-label="Main menu">
        ${btn('story', app.save.story.unlocked > 1 ? 'Story: The Valley Nut Feud (continue)' : 'Story: The Valley Nut Feud', 'autofocus', 'btn primary')}
        ${btn('quick', 'Quick Battle')}
        ${btn('daily', app.save.daily.last === dayKey() ? 'Daily Duel (won today)' : 'Daily Duel')}
        ${btn('practice', 'Practice Range')}
        ${btn('help', 'How to Play')}
        ${btn('records', 'Records')}
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
      <p class="sub">${TEAMS[st.team ?? 0].name} vs. ${TEAMS[1 - (st.team ?? 0)].name}. Win battles to unlock new nuts, and carry your acorns to the next one. <span class="label-fiction">game fiction</span></p>
      <p class="starcount row"><b>Stars: ${totalStars(st, levels)} / ${levels.length * 3}</b>${btn('records', 'Records', 'data-from="story"', 'btn small')}</p>
      <div class="map">${levels.map((L, i) => {
        const open = L.n <= st.unlocked, best = st.bestTurns[L.id], s = st.stars[L.id] || 0, tiers = starTiers(st, L.id), top = s ? tiers[Math.min(3, s) - 1] : 0, note = top && top !== 2 ? TIER_NAME[top] : '';
        return `<button type="button" class="lvl" data-act="${open ? 'play' : 'locked'}" data-v="${L.id}" ${open ? `data-blurb="${blurbFor(L.n)}" aria-describedby="blurb"` : 'disabled'} ${L.n === Math.min(st.unlocked, levels.length) ? 'autofocus' : ''} aria-label="Battle ${L.n}: ${L.name}${open ? `, ${s} stars${note ? ' on ' + note : ''}${best ? `, best ${turns(best)}` : ''}` : ', locked'}">
          <span class="n">${L.n}</span><span>${L.name}</span><span class="st">${open ? [0, 1, 2].map((i) => (i < s ? `<span class="t${tiers[i]}">★</span>` : '☆')).join('') : '🔒'}</span>${note ? `<span class="tier">${note}</span>` : ''}${open && best ? `<span class="best">Best: ${turns(best)}</span>` : ''}</button>`;
      }).join('')}</div>
      <p class="blurb" id="blurb">${blurbFor(Math.min(st.unlocked, levels.length))}</p>
      ${field('Difficulty', seg('difficulty', app.save.settings.difficulty, [['easy', 'Easy'], ['medium', 'Medium'], ['sharp', 'Sharp'], ['hard', 'Hard']]))}
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
      ${field('Rival skill', `<div class="seg">${[['easy', 'Easy'], ['medium', 'Medium'], ['sharp', 'Sharp'], ['hard', 'Hard']].map(([v, l]) => `<button type="button" class="btn small" data-act="qset" data-k="difficulty" data-v="${v}" aria-pressed="${q.difficulty === v}">${l}</button>`).join('')}</div>`)}
      <nav class="menu row">${btn('quickGo', 'Start battle', 'autofocus', 'btn primary')}${btn('back', 'Back', 'data-back')}</nav>
    </div>`;
  },

  prep: (app, { setup, bought, name, kinds, blurb }) => {
    const spent = Object.entries(bought).reduce((n, [k, c]) => n + c * NUTS[k].price, 0), left = setup.purse - spent;
    return `
    <div class="panel" role="dialog" aria-label="Pack your satchel">
      <h2>Pack your satchel</h2>
      ${blurb ? `<p class="blurb">${blurb}</p>` : ''}
      <p class="sub">${name}. Spend acorns on special nuts for this battle (up to ${NUT_CAP} of each). ${setup.mode === 'story' ? 'What you leave unspent stays in your purse. ' : ''}<span class="label-fiction">game rules</span></p>
      <p><b>Your acorns: ${left}</b> <small>(prices in acorns)</small></p>
      ${kinds.map((k) => { const have = 1 + (bought[k] || 0); return `<div class="nutrow pack"><canvas data-nut="${k}"></canvas><div class="what"><b>${NUTS[k].name}</b><br><small>${NUTS[k].trick}</small></div>
        <span class="price">${have}/${NUT_CAP}</span><span class="steps">${btn('prepUndo', 'Undo', `data-kind="${k}" aria-label="Take back one ${NUTS[k].name}" ${bought[k] ? '' : 'disabled'}`, 'btn small')}${btn('prepBuy', `Buy · ${NUTS[k].price}`, `data-kind="${k}" aria-label="Buy a ${NUTS[k].name} for ${NUTS[k].price} acorns" ${have >= NUT_CAP || left < NUTS[k].price ? 'disabled' : ''}`, 'btn small')}</span></div>`; }).join('')}
      <nav class="menu row">${btn('prepGo', 'Start battle', 'autofocus', 'btn primary')}${btn('prepBack', 'Back', 'data-back')}</nav>
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
      ${d.finale ? finaleScene() : d.practice ? '' : `<div class="res-sq" aria-hidden="true"><canvas data-sq="${d.winner >= 0 ? d.winner : 0}:cheer"></canvas><canvas data-sq="${d.winner >= 0 ? 1 - d.winner : 1}:out:flip"></canvas></div>`}
      <h2>${d.win ? 'Victory!' : d.practice ? 'Practice done' : 'So close!'}</h2>
      <p class="winner">${d.winnerName ? `${d.winnerName} win the valley` : ''}</p>
      ${d.finale ? `<div class="finale-text"><h3>${FINALE.title}</h3>${FINALE.text.map((p) => `<p>${p}</p>`).join('')}</div>` : ''}
      ${d.line ? `<p class="feudline">${d.line}</p>` : ''}
      ${d.stars != null ? starStr(d.stars) : ''}
      ${d.par ? `<p class="starrule">Stars: win the battle, keep every squirrel in the trees, and win within ${d.par} turns (this battle: ${d.turns}).</p>` : ''}
      ${d.tier ? `<p class="starrule">Played on ${TIER_NAME[d.tier]}.${d.tier > 2 && d.stars ? ' Those stars are marked on the map.' : ''}</p>` : ''}
      ${recordLines(d.records)}
      ${d.daily ? dailyLines(d.daily) : ''}
      ${d.offerEasy ? `<p class="starrule"><b>${d.losses} losses in a row on this battle.</b> Easy gives a longer aim guide and a gentler rival. You can change it back on the story map.</p>` : ''}
      ${d.unlock ? `<p><b>New nut unlocked:</b> ${NUTS[d.unlock].name}: ${NUTS[d.unlock].trick}</p>` : ''}
      ${d.stats.throws ? `<div class="statgrid">
        <div><span>Throws</span><b>${d.stats.throws}</b></div><div><span>Hits</span><b>${d.stats.hits}</b></div>
        <div><span>Knockouts</span><b>${d.stats.kos}</b></div><div><span>Biggest hit</span><b>${d.stats.best}</b></div>
        <div><span>Turns</span><b>${d.turns}</b></div>
      </div>` : ''}
      ${d.banked != null ? `<p class="banked">Acorns banked: <b>${d.banked}</b> <small>(kept for your next battle)</small></p>` : ''}
      ${d.fact ? `<div class="notes" role="note"><h3>Field Notes</h3>${d.fact.html}<span class="src">Source: ${d.fact.source}</span></div>` : ''}
      <nav class="menu row">${d.next ? btn('play', 'Next battle', `data-v="${d.next}" autofocus`, 'btn primary') : ''}${d.finale ? btn('credits', FINALE.button, 'autofocus', 'btn primary') : ''}${d.offerEasy ? btn('tryEasy', 'Try Easy', 'autofocus', 'btn primary') : ''}${btn('again', d.daily ? 'Retry this exact battle' : 'Play again', d.next || d.finale || d.offerEasy ? '' : 'autofocus')}${d.retry ? btn('again', 'Retry same wind', 'data-same="1"') : ''}${btn('menu', 'Menu', 'data-back')}</nav>
    </div>`,

  pause: () => `
    <div class="panel" role="dialog" aria-label="Paused" style="width:min(420px,100%)">
      <h2>Paused</h2>
      <nav class="menu">${btn('resume', 'Resume', 'autofocus data-back', 'btn primary')}${btn('help', 'How to Play')}${btn('settings', 'Settings')}${btn('restart', 'Restart battle')}${btn('menu', 'Quit to menu')}</nav>
    </div>`,

  confirmLeave: (app, { then, story }) => `
    <div class="panel" role="dialog" aria-label="${then === 'restart' ? 'Restart battle' : 'Leave battle'}" style="width:min(420px,100%)">
      <h2>${then === 'restart' ? 'Restart this battle?' : 'Leave this battle?'}</h2>
      <p>${then === 'menu' && story ? 'Your battle stays saved. Choose Resume battle on the title to pick it up from the start of your last turn.' : 'Your progress in it will be lost.'}</p>
      <nav class="menu row">${btn('leaveYes', then === 'restart' ? 'Restart' : 'Leave', `data-then="${then}"`)}${btn('back', 'Cancel', 'autofocus data-back', 'btn primary')}</nav>
    </div>`,

  help: () => `
    <div class="panel" role="dialog" aria-label="How to play">
      <h2>How to Play</h2>
      <p class="sub">${FICTION} <span class="label-fiction">Scroll for all seven tips and the nut guide ↓</span></p>
      <div class="cards">
        <div class="card"><b>1. Aim</b><br>Drag back from anywhere like a slingshot: the direction sets the angle, the length sets the power. Keys: ←/→ angle, ↑/↓ power (Shift for big steps).</div>
        <div class="card"><b>2. Throw</b><br>Let go, press <b>Throw</b>, or press Space/Enter. While a shot flies or the rival takes a turn, tap or press Space to hurry it along.</div>
        <div class="card"><b>3. Tap for the trick</b><br>While a special nut flies, tap or press Space once to trigger its trick.</div>
        <div class="card"><b>4. Scamper</b><br>Press <b>Move</b> (or M), then pick a glowing perch on your own mountain. Each turn has a little stamina.</div>
        <div class="card"><b>5. Wind and steam</b><br>The flag shows wind (0–10). The steam over Bathhouse Row lifts nuts that fly through it (game rule).</div>
        <div class="card"><b>6. Spend your acorns</b><br>Hits, cracked branches and knockouts earn acorns. Before a battle, pack special nuts in the satchel shop. In the Story, acorns you keep carry over.</div>
        <div class="card"><b>7. Knock them out!</b><br>Hits shake a squirrel's grip loose. At zero grip, or after a long tumble to the ground, it's out: into the leaf pile, unhurt. Out of squirrels, out of the round.</div>
      </div>
      <h3>Controls</h3>
      <div class="cards">
        <div class="card"><b>Keyboard</b><br>←/→ angle, ↑/↓ power (Shift for big steps). Space or Enter throws, and taps a flying nut. 1–7 or Q/E pick a nut. M moves; then A/D/W/S step between perches. Z/X zoom, C recenters the view, N mutes the sound, P or Esc pauses.</div>
        <div class="card"><b>Gamepad</b><br>Left stick aims. A throws, and taps a flying nut. LB/RB pick a nut, left/right on the D-pad step between perches, Start pauses, Select mutes the sound.</div>
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
      ${field('Ambience', seg('ambience', s.ambience, [[true, 'On'], [false, 'Off']]))}
      ${field('Volume', seg('volume', s.volume, [[0.25, 'Low'], [0.5, 'Medium'], [0.8, 'High']]))}
      ${field('Effects level', seg('sfxVol', s.sfxVol, [[0, 'Off'], [0.35, 'Low'], [0.65, 'Medium'], [1, 'High']]))}
      ${field('Music level', seg('musicVol', s.musicVol, [[0.35, 'Low'], [0.65, 'Medium'], [1, 'High']]))}
      ${field('Motion', seg('reducedMotion', s.reducedMotion == null ? 'auto' : s.reducedMotion, [['auto', 'System'], [false, 'Full'], [true, 'Reduced']]))}
      ${field('Aim guide', seg('aimGuide', s.aimGuide, [['auto', 'By skill'], ['always', 'Always long'], ['off', 'Off']]))}
      ${field('Turn timer', seg('turnTimer', s.turnTimer, [[0, 'Off'], [30, '30 s'], [60, '60 s']]))}
      ${field('Text size', seg('textScale', s.textScale, [[1, '100%'], [1.25, '125%'], [1.5, '150%']]))}
      ${field('Tutorial hints', seg('tutorial', s.tutorial, [[true, 'On'], [false, 'Off']]))}
      <nav class="menu row">${btn('back', 'Done', 'autofocus data-back', 'btn primary')}${btn('resetProgress', 'Reset progress')}</nav>
    </div>`;
  },

  records: (app, { levels, from }) => {
    const st = app.save.story, k = app.save.stats, won = levels.filter((L) => (st.stars[L.id] || 0) > 0).length;
    const tile = (label, value) => `<div><span>${label}</span><b>${value}</b></div>`;
    return `
    <div class="panel" role="dialog" aria-label="Records">
      <h2>Records</h2>
      <p class="sub">What this device remembers of your valley battles. Practice is not counted.</p>
      <h3>All battles</h3>
      <div class="statgrid">
        ${tile('Battles', k.battles)}${tile('Wins', k.wins)}
        ${tile('Win rate', pct(k.wins, k.battles))}${tile('Knockouts', k.kos)}
        ${tile('Biggest hit', k.bestShot)}${tile('Throw accuracy', pct(k.hits, k.throws))}
        ${tile('Win streak', k.streak)}${tile('Best streak', k.bestStreak)}
      </div>
      <h3>Wins by rival skill</h3>
      <div class="statgrid">${tile('Easy', k.winsEasy)}${tile('Medium', k.winsMedium)}${tile('Sharp', k.winsSharp)}${tile('Hard', k.winsHard)}</div>
      <p class="starrule">Wins and throws from before this list was kept are in the totals above, not in the skill split.</p>
      <h3>Daily Duel</h3>
      <div class="statgrid">${tile('Days won', app.save.daily.wins)}${tile('Streak', liveStreak(app.save.daily, dayKey()))}${tile('Best streak', app.save.daily.bestStreak)}</div>
      ${dailyHistory(app.save.daily)}
      <h3>The Valley Nut Feud</h3>
      <p class="starcount"><b>Stars: ${totalStars(st, levels)} / ${levels.length * 3}</b> · Battles won: ${won} of ${levels.length}</p>
      <div class="rec-table" role="table" aria-label="Best result in each Story battle">
        ${levels.map((L) => { const n = st.stars[L.id] || 0, tiers = starTiers(st, L.id), top = n ? tiers[Math.min(3, n) - 1] : 0, best = st.bestTurns[L.id], open = L.n <= st.unlocked;
          return `<div class="rec-row" role="row"><span class="rn" role="cell">${L.n}. ${L.name}</span>${open ? `<span class="st" role="cell" aria-label="${n} of 3 stars${top && top !== 2 ? ' on ' + TIER_NAME[top] : ''}">${[0, 1, 2].map((i) => (i < n ? `<span class="t${tiers[i]}">★</span>` : '☆')).join('')}</span><span class="rb" role="cell">${best ? `best ${turns(best)}, par ${L.par}` : n ? 'won' : 'not won yet'}</span>` : '<span class="rb" role="cell">locked</span>'}</div>`; }).join('')}
      </div>
      <nav class="menu row">${btn('recordsBack', 'Back', `autofocus data-back data-from="${from || ''}"`, 'btn primary')}${btn('journal', 'Field Notes', `data-from="${from || ''}"`)}</nav>
    </div>`;
  },

  journal: (app, { levels, from }) => {
    const st = app.save.story, seen = new Set(st.notes), F = typeof FACTS !== 'undefined' ? FACTS : { landmarks: [], nature: [] };
    const cards = levels.filter((L) => (st.stars[L.id] || 0) >= 3).length;
    const entry = (f, hint) => seen.has(f.id) ? (({ html, source }) => `<li class="found">${html}<span class="src">Source: ${source}</span></li>`)(factHtml(f)) : `<li class="locked">Not found yet. ${hint(f)}</li>`;
    const place = (f) => f.stretch === 'any' ? 'It can turn up in any battle.' : `Try a battle on the ${{ north: 'north end', middle: 'middle', south: 'south end' }[f.stretch] || 'Row'} of the Row.`;
    const when = (f) => f.season === 'any' ? 'It can turn up in any battle.' : `Try a battle in ${f.season}.`;
    const count = (list) => list.filter((f) => seen.has(f.id)).length;
    return `
    <div class="panel" role="dialog" aria-label="Field Notes">
      <h2>Field Notes</h2>
      <p class="sub">${count(F.landmarks) + count(F.nature)} of ${F.landmarks.length + F.nature.length} notes found. A new note turns up on the results card after a battle.</p>
      <h3>Postcards: ${cards} of ${levels.length}</h3>
      <p class="starrule">Win a battle with all three stars to keep a postcard of its view.</p>
      <div class="postcards">${levels.map((L) => (st.stars[L.id] || 0) >= 3
        ? `<figure class="postcard"><canvas data-card="${L.id}" role="img" aria-label="Postcard: ${L.name}"></canvas><figcaption>${L.n}. ${L.name}</figcaption></figure>`
        : `<figure class="postcard locked"><div class="blank">${L.n <= st.unlocked ? '★★★' : '🔒'}</div><figcaption>${L.n}. ${L.n <= st.unlocked ? 'Win with 3 stars' : 'Locked'}</figcaption></figure>`).join('')}</div>
      <h3>Landmarks: ${count(F.landmarks)} of ${F.landmarks.length}</h3>
      <ul class="note-list">${F.landmarks.map((f) => entry(f, place)).join('')}</ul>
      <h3>Nature: ${count(F.nature)} of ${F.nature.length}</h3>
      <ul class="note-list">${F.nature.map((f) => entry(f, when)).join('')}</ul>
      <nav class="menu row">${btn('journalBack', 'Back', `autofocus data-back data-from="${from || ''}"`, 'btn primary')}</nav>
    </div>`;
  },

  confirmReset: () => `
    <div class="panel" role="dialog" aria-label="Reset progress" style="width:min(420px,100%)">
      <h2>Reset progress?</h2><p>This clears Story stars, unlocks and records on this device.</p>
      <nav class="menu row">${btn('resetYes', 'Reset')}${btn('settings', 'Cancel', 'autofocus data-back', 'btn primary')}</nav>
    </div>`,

  credits: (app, { from }) => `
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
      <nav class="menu row">${btn('creditsBack', 'Back', `autofocus data-back data-from="${from || ''}"`)}</nav>
    </div>`,
};

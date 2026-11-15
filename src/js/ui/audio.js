// Sound: WebAudio synthesis only (no audio files). Starts on the first key or touch (browser autoplay rules),
// quiet by default and mutable. Bus layout and tone/noise primitives after games/Cart Racing/src/js/ui/audio.js
// (Hot Springs Games, MIT). Cues are the short effects below; music and ambience come from audiokit.js (scores and
// scenes in music.js). Sound effects, Music and Ambience each have a switch, and all three obey the master Sound switch.
import { makeAudioKit, measureAudio } from './audiokit.js';
import { SCORES, SCENES } from './music.js';

let ctx = null, master = null, sfxBus = null, noiseBuf = null, kit = null, tOff = 0; // tOff: seconds added to every cue's start, for the offline render
const state = { on: true, music: true, ambience: true, vol: 0.5, sfxVol: 1, musicVol: 1, started: false, theme: null, scene: null, params: {}, tension: false, muffled: false, muffles: 0, last: '', recent: [], wheres: [], hidden: false, paused: false, timer: false, played: 0 };
const SFX_GAIN = 0.9; // the effects bus at its full level
// The mix (S5-06): the master gain is the Volume setting times MASTER_SCALE (0.45 before wave 3: the quietest game in the
// collection by a factor of two), and every cue is struck CUE_BOOST times harder than it is written (1 before wave 3, when
// the loudest cue sat below the music's peak as heard). To undo the retune set them back to 0.45 and 1.
const MASTER_SCALE = 0.7;
const CUE_BOOST = 5.5;
const SHIPPED_VOLUME = 0.5; // the Volume a new profile starts at (save.js)
const FADE_MUSIC = 1.6, FADE_SCENE = 2.5; // seconds a mood or a place takes to cross-fade into the next

export function initAudio(settings) {
  setFlags(settings);
  const start = () => { if (!state.started) unlock(); else if (ctx && ctx.state !== 'running' && !document.hidden) ctx.resume().catch(() => {}); };
  wake = start;
  // older iOS Safari only unlocks audio from touchend or click, not from pointerdown, so all four are listened for
  // for as long as the page lives: each one also resumes a context the browser has suspended again (S5-11)
  for (const ev of ['keydown', 'pointerdown', 'touchend', 'click']) window.addEventListener(ev, start);
}
// A pad's button press is not a gesture on every browser, so this is a best effort: it unlocks or resumes where allowed.
let wake = () => {};
export function wakeAudio() { wake(); }
function setFlags(s) { state.on = s.sound !== false; state.music = s.music !== false; state.ambience = s.ambience !== false; state.vol = s.volume ?? 0.5; state.sfxVol = s.sfxVol ?? 1; state.musicVol = s.musicVol ?? 1; }
function applyLevels() { if (!kit) return; if (sfxBus) sfxBus.gain.setTargetAtTime(SFX_GAIN * state.sfxVol, ctx.currentTime, 0.05); kit.music.level(state.music ? state.musicVol : 0); kit.amb.level(state.ambience ? 1 : 0); }
// Music and ambience are held (faded out, nothing scheduled) on the pause card and in a hidden tab.
function syncHold() { if (!kit) return; if (state.paused || state.hidden) kit.hold(); else kit.release(); }
function runScheduler(on) {
  if (!kit) return;
  if (on && !state.timer) { kit.start(); state.timer = true; } else if (!on && state.timer) { kit.stop(); state.timer = false; }
}
// A switched-off piece is not just muted (S5-09): with Sound off, Music off or the Music level at Off its score is
// stopped, with Ambience off or Sound off its bed is, and with neither wanted the scheduler stops too, so a phone is not
// kept busy building notes nobody hears. Turning it back on starts the piece again. The scheduler runs on a moment
// after a stop, because it is what silences and frees the retired nodes.
const musicWanted = () => state.on && state.music && state.musicVol > 0;
const ambWanted = () => state.on && state.ambience;
let idleTimer = 0;
function syncSources() {
  if (!kit) return;
  if (musicWanted()) { if (state.theme && !kit.music.score) kit.music.play(SCORES[state.theme] || SCORES.day, { fade: FADE_MUSIC }); } else if (kit.music.score) kit.music.stop(0.3);
  if (ambWanted()) { if (state.scene && !kit.amb.scene) kit.amb.play(SCENES[state.scene], { fade: FADE_SCENE }); } else if (kit.amb.scene) kit.amb.stop(0.3);
  clearTimeout(idleTimer);
  if (state.hidden) return;
  if (musicWanted() || ambWanted()) runScheduler(true);
  else idleTimer = setTimeout(() => { if (!musicWanted() && !ambWanted()) runScheduler(false); }, 800);
}

// What every sound passes through on its way out: the master gain, then a limiter so music, ambience and the loudest cue
// cannot clip together. The page and the offline render hook build it the same way.
function makeChain(c, dest, gain) {
  const m = c.createGain(); m.gain.value = gain;
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -8; limiter.knee.value = 6; limiter.ratio.value = 14; limiter.attack.value = 0.003; limiter.release.value = 0.25;
  m.connect(limiter); limiter.connect(dest);
  return m;
}
function makeNoise(c) {
  const buf = c.createBuffer(1, c.sampleRate, c.sampleRate), d = buf.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < d.length; i++) { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
  return buf;
}

function unlock() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // a context made outside an unlocking gesture starts suspended: ask for it to run, and play one silent sample to prime iOS
    ctx.resume().catch(() => {});
    const prime = ctx.createBufferSource(); prime.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); prime.connect(ctx.destination); prime.start(0);
    master = makeChain(ctx, ctx.destination, state.on ? state.vol * MASTER_SCALE : 0);
    sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_GAIN * state.sfxVol; sfxBus.connect(master);
    noiseBuf = makeNoise(ctx);
    ctx.onstatechange = () => { if (ctx && ctx.state === 'interrupted' && !document.hidden) ctx.resume().catch(() => {}); };
    kit = makeAudioKit(ctx, master, { seed: (Math.random() * 0x7fffffff) >>> 0, music: state.music ? state.musicVol : 0, ambience: state.ambience ? 1 : 0 });
    state.started = true;
    for (const [k, v] of Object.entries(state.params)) kit.amb.set(k, v, 0.01);
    kit.music.intensity(state.tension ? 1 : 0);
    if (state.muffled) kit.music.muffle(true, 0.015);
    state.hidden = !!document.hidden;
    syncHold();
    syncSources();
  } catch (e) { ctx = null; kit = null; }
}

export function setAudio(settings) {
  setFlags(settings);
  if (!ctx) return;
  master.gain.setTargetAtTime(state.on ? state.vol * MASTER_SCALE : 0, ctx.currentTime, 0.05);
  applyLevels();
  syncSources();
}
// The pause card fades the music and ambience out, so a paused battle does not sound like it is still running.
export function pauseAudio(flag) {
  flag = !!flag;
  if (state.paused === flag) return;
  state.paused = flag;
  syncHold();
}
// A hidden tab (or a page being put away) suspends the context and the scheduler; coming back resumes both from
// "now", so bars the throttled timer missed are not fired as one burst.
export function handleVisibility(hidden) {
  if (!ctx) return;
  state.hidden = !!hidden;
  if (hidden) {
    runScheduler(false);
    syncHold();
    ctx.suspend().catch(() => {});
  } else {
    ctx.resume().catch(() => {});
    syncHold();
    syncSources();
  }
}
export function audioState() {
  const lv = kit ? kit.levels() : { music: 0, ambience: 0 };
  return { started: state.started, on: state.on, music: state.music, ambience: state.ambience, vol: state.vol, master: master ? +master.gain.value.toFixed(3) : 0, theme: state.theme, scene: state.scene, params: { ...state.params }, tension: state.tension, last: state.last, recent: state.recent.slice(), wheres: state.wheres.map((x) => x && { ...x }), muffled: state.muffled, muffles: state.muffles, cutoff: kit ? Math.round(kit.music.cutoff) : 0, ctx: ctx ? ctx.state : 'none', played: state.played, scheduler: state.timer, musicPlaying: kit ? !!kit.music.score : false, ambiencePlaying: kit ? !!kit.amb.scene : false, musicPaused: state.paused, held: kit ? kit.held : false, busMusic: +lv.music.toFixed(3), busAmbience: +lv.ambience.toFixed(3), busSfx: sfxBus ? +sfxBus.gain.value.toFixed(3) : 0 };
}

// What one cue is struck with (S5-03, S5-04): a small random detune and level and a noise offset, so no two repeats are
// alike (the kit's own seeded generator, so a render is the same every time), and where it sounds from, so a cue in the
// world sits left or right of the middle, is quieter when further off and duller once it is out of view.
const NEUTRAL = { f: 1, g: 1, o: 0, place: null };
let V = NEUTRAL;
const PAN_MAX = 0.7, FAR_CUT = 2500; // the widest pan a cue gets, and the lowpass for a cue out of view
function placeOf(pan) {
  if (pan == null || !isFinite(pan) || !ctx.createStereoPanner) return null;
  const a = Math.abs(pan), p = Math.max(-1, Math.min(1, pan)) * PAN_MAX, x = (p + 1) / 2;
  // a mono voice has 3 dB less in each ear at the middle: bring the louder ear back to what an unpanned voice has
  return { p, g: (1 - 0.4 * Math.min(1, a / 2)) / Math.max(Math.cos(x * Math.PI / 2), Math.sin(x * Math.PI / 2)), far: a > 1 };
}
function route(node, bus) {
  if (V.place) {
    if (V.place.far) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = FAR_CUT; node.connect(f); node = f; }
    const p = ctx.createStereoPanner(); p.pan.value = V.place.p; node.connect(p); node = p;
  }
  node.connect(bus);
}
const level = (v) => v * CUE_BOOST * V.g * (V.place ? V.place.g : 1);
function tone(freq, dur, { type = 'triangle', vol = 0.2, at = 0, slide = 0, attack = 0.005, bus = sfxBus, filter = 0 } = {}) {
  if (!ctx) return;
  freq *= V.f;
  const t = ctx.currentTime + tOff + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level(vol), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
  node.connect(g); route(g, bus);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, { vol = 0.2, at = 0, type = 'bandpass', freq = 1200, q = 1, sweep = 0, bus = sfxBus } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + tOff + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true;
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level(vol), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); route(g, bus);
  s.start(t, 0.1 + V.o % 0.8); s.stop(t + dur + 0.02);
}

// Short parameterised effects (in the spirit of ZzFX by Frank Force, MIT: one call per sound, no samples).
const STAR_AT = 0.95; // seconds after the win jingle starts that the star notes begin (the jingle is about 0.9 s long)
const POP = { acorn: 520, chinquapin: 760, pecan: 620, walnut: 300, hickory: 560, sweetgum: 680, hedgeapple: 220 };
export const CUES = ['ui', 'pick', 'move', 'aim', 'throw', 'tap', 'thock', 'thud', 'burst', 'crack', 'rustle', 'boing', 'chitter', 'ko', 'cheer', 'win', 'lose', 'buy', 'land', 'honk', 'squawk', 'steam', 'stars', 'unlock', 'roundWin'];
// `w` says what happened and where, for the cues that follow it (S5-03, S5-04): `on` is what a nut struck (terrain, wood or
// squirrel), `dmg` the damage of a hit, `h` the height of a fall, and `pan` where the event is across the view, -1 at its
// left edge and 1 at its right (past 1 is out of view). A cue with no `w` is as it always was, in the middle.
export function sfx(name, arg, w) {
  if (!ctx || !state.on || state.sfxVol <= 0) return;
  state.played++;
  state.last = arg === undefined ? name : name + ':' + arg;
  state.recent.push(state.last); if (state.recent.length > 8) state.recent.shift();
  state.wheres.push(w ? { ...w } : null); if (state.wheres.length > 8) state.wheres.shift();
  const j = kit ? kit.jit(20, 1.5) : null;
  V = { f: j ? j.f : 1, g: j ? j.g : 1, o: j ? j.o : 0, place: w ? placeOf(w.pan) : null };
  try { play(name, arg, w || {}); } finally { V = NEUTRAL; }
}
function play(name, arg, w) {
  switch (name) {
    case 'ui': tone(880, 0.05, { type: 'square', vol: 0.05, filter: 3000 }); break;
    // choosing a nut plucks that nut's own note; Move mode opens with a rising click and closes with a falling one (S5-18)
    case 'pick': tone(POP[arg] || 500, 0.12, { type: 'triangle', vol: 0.1, slide: 0.9 }); tone((POP[arg] || 500) * 2, 0.07, { type: 'sine', vol: 0.03 }); break;
    case 'move': tone(arg ? 520 : 780, 0.045, { type: 'square', vol: 0.05, filter: 3000 }); tone(arg ? 780 : 520, 0.06, { type: 'square', vol: 0.05, at: 0.05, filter: 3000 }); break;
    case 'aim': tone(420 + (arg || 0) * 500, 0.03, { type: 'sine', vol: 0.03 }); break;
    case 'throw': noise(0.22, { vol: 0.12, freq: 900, sweep: 2.4, q: 0.8 }); tone(240, 0.12, { type: 'sine', vol: 0.06, slide: 1.8 }); break;
    case 'tap': for (let i = 0; i < 3; i++) tone(1200 + i * 300, 0.07, { type: 'sine', vol: 0.06, at: i * 0.03 }); break;
    // what a nut hits is heard: a hollow knock on wood, a dull thud and grit on the ground, a soft whump of fur on a squirrel,
    // each with a second voice a few cents off the first for body (S5-03)
    case 'thock': {
      const f = POP[arg] || 500;
      if (w.on === 'wood') { tone(f * 0.6, 0.12, { type: 'triangle', vol: 0.16, slide: 0.7 }); noise(0.07, { vol: 0.09, freq: 900, q: 4 }); }
      else if (w.on === 'terrain') { tone(f * 0.5, 0.11, { type: 'triangle', vol: 0.15, slide: 0.6 }); noise(0.12, { vol: 0.1, type: 'lowpass', freq: 800 }); }
      else { tone(f, 0.09, { type: 'triangle', vol: 0.16, slide: 0.55 }); noise(0.06, { vol: 0.08, freq: 2200, q: 2 }); if (w.on === 'squirrel') { tone(150, 0.14, { type: 'sine', vol: 0.1, slide: 0.7 }); noise(0.1, { vol: 0.05, type: 'lowpass', freq: 400 }); } }
      tone(f * (w.on === 'wood' ? 0.6 : w.on === 'terrain' ? 0.5 : 1) * 1.012, 0.07, { type: 'sine', vol: 0.06, slide: 0.55 });
      break;
    }
    case 'thud': tone(110, 0.25, { type: 'sine', vol: 0.2, slide: 0.6 }); noise(0.2, { vol: 0.12, type: 'lowpass', freq: 500 }); break;
    case 'burst': if (kit) kit.music.duck(4, 450); noise(0.45, { vol: 0.22, type: 'lowpass', freq: 900, sweep: 0.25 }); tone(90, 0.4, { type: 'sine', vol: 0.18, slide: 0.5 }); break;
    case 'crack': noise(0.12, { vol: 0.2, freq: 2600, q: 3 }); noise(0.3, { vol: 0.1, freq: 600, q: 1, at: 0.05 }); tone(180, 0.18, { type: 'sawtooth', vol: 0.05, slide: 0.5, filter: 900 }); break;
    case 'rustle': noise(0.25, { vol: 0.07, type: 'highpass', freq: 3500 }); break;
    // a bigger hit boings higher and louder (S5-03); `dmg` is the damage, about 20 for a graze and 44 and over for a clean hit
    case 'boing': { const d = Math.min(1, (w.dmg == null ? 32 : w.dmg) / 44), k = 0.9 + 0.2 * d, v = 0.7 + 0.3 * d; tone(300 * k, 0.28, { type: 'sine', vol: 0.12 * v, slide: 2.2 }); tone(600 * k, 0.2, { type: 'sine', vol: 0.05 * v, at: 0.05, slide: 1.5 }); break; }
    case 'chitter': for (let i = 0; i < 4; i++) tone((arg ? 2200 : 1800) + (i % 2) * 300, 0.04, { type: 'square', vol: 0.035, at: i * 0.055, filter: 4000 }); break;
    case 'ko': if (kit) kit.music.duck(4, 600); tone(900, 0.7, { type: 'sine', vol: 0.12, slide: 0.3 }); noise(0.4, { vol: 0.08, type: 'highpass', freq: 3000, at: 0.5 }); break;
    case 'cheer': if (kit) kit.music.duck(6, 500); for (let i = 0; i < 4; i++) tone([523, 659, 784, 1046][i], 0.18, { type: 'triangle', vol: 0.09, at: i * 0.09 }); noise(0.6, { vol: 0.05, freq: 1500, q: 0.6 }); break;
    case 'win': if (kit) kit.music.duck(6, 700); [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.1, at: i * 0.12 })); break;
    case 'lose': if (kit) kit.music.duck(6, 700); [392, 349, 330, 262].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.08, at: i * 0.16 })); break;
    case 'buy': tone(988, 0.07, { type: 'square', vol: 0.05, filter: 3000 }); tone(1319, 0.12, { type: 'square', vol: 0.05, at: 0.07, filter: 3000 }); break;
    // a short step is a light tap and a long fall is a thump, with a low layer under it (S5-03; `h` is the height fallen)
    case 'land': { const d = Math.min(1, (w.h == null ? 40 : w.h) / 110); tone(160 - 40 * d, 0.08 + 0.06 * d, { type: 'sine', vol: 0.05 + 0.04 * d }); if (d > 0.4) tone(80, 0.2, { type: 'sine', vol: 0.12 * d, slide: 0.6 }); break; }
    // birds: a two-note goose honk, or a jay/crow squawk (other birds chirp)
    case 'honk': for (let i = 0; i < 2; i++) tone(330 - i * 40, 0.13, { type: 'sawtooth', vol: 0.07, at: i * 0.16, slide: 0.8, filter: 1400 }); break;
    case 'squawk': if (arg === 'jay' || arg === 'crow') { tone(arg === 'crow' ? 520 : 900, 0.16, { type: 'sawtooth', vol: 0.06, slide: 0.7, filter: 2600 }); noise(0.1, { vol: 0.05, freq: 2400, q: 1.5 }); } else for (let i = 0; i < 3; i++) tone(2600 + i * 400, 0.05, { type: 'sine', vol: 0.05, at: i * 0.05, slide: 1.2 }); break;
    // milestones (S5-19), played after the win jingle: a rising note for each star earned, a sparkle for an unlock, and a
    // short stinger when a round is won and the shop opens
    case 'stars': if (kit) kit.music.duck(5, 1300 + (arg || 0) * 150); for (let i = 0; i < (arg || 0); i++) { tone([784, 988, 1175][i], 0.22, { type: 'triangle', vol: 0.09, at: STAR_AT + i * 0.15 }); tone([1568, 1976, 2349][i], 0.14, { type: 'sine', vol: 0.03, at: STAR_AT + i * 0.15 }); } break;
    case 'unlock': for (let i = 0; i < 5; i++) tone([1319, 1568, 1760, 2093, 2637][i], 0.16, { type: 'sine', vol: 0.05, at: STAR_AT + (arg || 0) * 0.15 + 0.1 + i * 0.05 }); break;
    case 'roundWin': if (kit) kit.music.duck(5, 700); [392, 523, 659].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.09, at: i * 0.09 })); tone(1319, 0.12, { type: 'square', vol: 0.03, at: 0.3, filter: 3000 }); break;
    case 'steam': noise(0.5, { vol: 0.03, type: 'highpass', freq: 5000 }); break;
    default: break;
  }
}

// ---- music and ambience (the engine is audiokit.js) ----------------------------------------------------
export function playTheme(name, force) {
  if (state.theme === name && !force) return;
  state.theme = name;
  if (kit && musicWanted()) kit.music.play(SCORES[name] || SCORES.day, { fade: FADE_MUSIC });
}
export function stopMusic() { state.theme = null; if (kit) kit.music.stop(FADE_MUSIC); }
export function playAmbience(name) {
  if (state.scene === name) return;
  state.scene = name;
  if (kit && ambWanted()) kit.amb.play(SCENES[name], { fade: FADE_SCENE });
}
// 'wind' (0..1), 'steam' (0..1, how near the steam is to the view) and 'birds' (0..1) move the ambience beds.
export function ambienceParam(name, v) {
  if (state.params[name] === v) return;
  state.params[name] = v;
  if (kit) kit.amb.set(name, v, 0.6);
}
// Extra percussion, a higher melody and a quicker tempo while a family is down to one squirrel or time runs short.
export function setTension(on) {
  on = !!on;
  if (state.tension === on) return;
  state.tension = on;
  if (kit) kit.music.intensity(on ? 1 : 0);
}

// The music is dulled while the sim is frozen for a hit and while the last knockout runs in slow motion (S5-16), so the
// weight of the picture has a sound. It opens again over a moment.
export function muffleAudio(on) {
  on = !!on;
  if (state.muffled === on) return;
  state.muffled = on;
  if (on) state.muffles++;
  if (kit) kit.music.muffle(on, on ? 0.015 : 0.18);
}

// Test hooks: every piece, bed and cue by name, and a render of one on its own offline context, through the master
// gain and the limiter the player hears, so its levels are the levels at the speakers. The Volume setting is
// `opts.volume` (0 to 1, default the shipped 0.5); `opts.raw` skips the master gain and the limiter and gives the
// kit's own scale (the limiter also adds make-up gain, so this is not just the volume divided out). A render never
// touches the live audio or the settings.
//   name: a score, a scene, 'cue:<name>' (opts.arg, opts.where as the sfx third argument, opts.repeats times, one a second) or 'mix' (the busiest moment).
const RENDER_PARAMS = { wind: 0.6, steam: 0.6, birds: 1 };
// a render starts with the limiter at rest, which holds the first hit back for a moment: the cues begin after this lead, as they do on a live page
const CUE_LEAD = 0.5;
const MIX_CUES = [['burst'], ['crack'], ['boing'], ['ko'], ['cheer'], ['win']]; // struck in turn, one a second, over the piece and the bed
export function audioList() { return { music: Object.keys(SCORES), ambience: Object.keys(SCENES), cues: CUES.slice() }; }
function renderCues(oc, m, k, list, repeats, gap) {
  const keep = { ctx, sfxBus, noiseBuf, kit, tOff, on: state.on, sfxVol: state.sfxVol, played: state.played };
  try {
    ctx = oc; kit = k; noiseBuf = makeNoise(oc); state.on = true; state.sfxVol = 1;
    sfxBus = oc.createGain(); sfxBus.gain.value = SFX_GAIN; sfxBus.connect(m);
    for (let i = 0; i < repeats; i++) { tOff = CUE_LEAD + i * gap; const [n, a, w] = list[i % list.length]; sfx(n, a, w); }
  } finally { ({ ctx, sfxBus, noiseBuf, kit, tOff } = keep); state.on = keep.on; state.sfxVol = keep.sfxVol; state.played = keep.played; }
}
export function audioRender(name, seconds = 60, wantWav = false, opts = {}) {
  const cue = /^cue:(.+)$/.exec(name), score = SCORES[name], scene = SCENES[name];
  if (!score && !scene && !cue && name !== 'mix') return Promise.reject(new Error('unknown piece: ' + name));
  if (cue && !CUES.includes(cue[1])) return Promise.reject(new Error('unknown cue: ' + cue[1]));
  return measureAudio((oc, dest) => {
    const m = opts.raw ? dest : makeChain(oc, dest, (opts.volume ?? SHIPPED_VOLUME) * MASTER_SCALE), k = makeAudioKit(oc, m, { seed: 7 });
    if (cue) { const n = opts.repeats || 1; renderCues(oc, m, k, [[cue[1], opts.arg, opts.where]], n, opts.gap || 1); return () => ({ cue: cue[1], repeats: n }); }
    if (name === 'mix') {
      k.music.intensity(1); k.music.play(SCORES[opts.piece || 'day'], { at: 0, fade: 0.02 });
      for (const [p, v] of Object.entries({ wind: 1, steam: 1, birds: 1 })) k.amb.set(p, v, 0.01);
      k.amb.play(SCENES[opts.scene || 'summerDay'], { at: 0, fade: 0.02 });
      renderCues(oc, m, k, MIX_CUES, Math.max(1, Math.floor(seconds) - 1), 1);
      k.scheduleUntil(seconds);
      return () => ({ mix: true });
    }
    if (score) { k.music.intensity(opts.intensity || 0); k.music.play(score, { at: 0, fade: 0.02 }); }
    else { for (const [p, v] of Object.entries({ ...RENDER_PARAMS, ...opts })) if (typeof v === 'number' && p in RENDER_PARAMS) k.amb.set(p, v, 0.01); k.amb.play(scene, { at: 0, fade: 0.02 }); }
    k.scheduleUntil(seconds);
    return () => {
      if (!score) return { scene: name };
      const info = k.music.info();
      return { ...info, bpm: score.bpm, formSeconds: +(info.formBars * (score.beats || 4) * 60 / score.bpm).toFixed(1) };
    };
  }, seconds, { wav: wantWav });
}

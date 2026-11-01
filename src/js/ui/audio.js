// Sound: WebAudio synthesis only (no audio files). Starts on the first key or touch (browser autoplay rules),
// quiet by default and mutable. Bus layout and tone/noise primitives after games/Cart Racing/src/js/ui/audio.js
// (Hot Springs Games, MIT). Music: original short ragtime-and-banjo loops on a tiny step sequencer.

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
const state = { on: true, music: true, vol: 0.5, started: false, theme: null, step: 0, nextT: 0, timer: null, played: 0 };

export function initAudio(settings) {
  setFlags(settings);
  const start = () => { if (!state.started) unlock(); };
  window.addEventListener('keydown', start);
  window.addEventListener('pointerdown', start);
}
function setFlags(s) { state.on = s.sound !== false; state.music = s.music !== false; state.vol = s.volume ?? 0.5; }

function unlock() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = state.on ? state.vol * 0.45 : 0; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = state.music ? 0.3 : 0; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
    state.started = true;
    if (state.theme) playTheme(state.theme, true);
  } catch (e) { ctx = null; }
}

export function setAudio(settings) {
  setFlags(settings);
  if (!ctx) return;
  master.gain.setTargetAtTime(state.on ? state.vol * 0.45 : 0, ctx.currentTime, 0.05);
  musicBus.gain.setTargetAtTime(state.music ? 0.3 : 0, ctx.currentTime, 0.05);
}
export function audioState() { return { started: state.started, on: state.on, music: state.music, vol: state.vol, theme: state.theme, ctx: ctx ? ctx.state : 'none', played: state.played }; }

function tone(freq, dur, { type = 'triangle', vol = 0.2, at = 0, slide = 0, attack = 0.005, bus = sfxBus, filter = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
  node.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, { vol = 0.2, at = 0, type = 'bandpass', freq = 1200, q = 1, sweep = 0, bus = sfxBus } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true;
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t, 0.1); s.stop(t + dur + 0.02);
}

// Short parameterised effects (in the spirit of ZzFX by Frank Force, MIT: one call per sound, no samples).
const POP = { acorn: 520, chinquapin: 760, pecan: 620, walnut: 300, hickory: 560, sweetgum: 680, hedgeapple: 220 };
export function sfx(name, arg) {
  if (!ctx || !state.on) return;
  state.played++;
  switch (name) {
    case 'ui': tone(880, 0.05, { type: 'square', vol: 0.05, filter: 3000 }); break;
    case 'aim': tone(420 + (arg || 0) * 500, 0.03, { type: 'sine', vol: 0.03 }); break;
    case 'throw': noise(0.22, { vol: 0.12, freq: 900, sweep: 2.4, q: 0.8 }); tone(240, 0.12, { type: 'sine', vol: 0.06, slide: 1.8 }); break;
    case 'tap': for (let i = 0; i < 3; i++) tone(1200 + i * 300, 0.07, { type: 'sine', vol: 0.06, at: i * 0.03 }); break;
    case 'thock': tone(POP[arg] || 500, 0.09, { type: 'triangle', vol: 0.16, slide: 0.55 }); noise(0.06, { vol: 0.08, freq: 2200, q: 2 }); break;
    case 'thud': tone(110, 0.25, { type: 'sine', vol: 0.2, slide: 0.6 }); noise(0.2, { vol: 0.12, type: 'lowpass', freq: 500 }); break;
    case 'burst': noise(0.45, { vol: 0.22, type: 'lowpass', freq: 900, sweep: 0.25 }); tone(90, 0.4, { type: 'sine', vol: 0.18, slide: 0.5 }); break;
    case 'crack': noise(0.12, { vol: 0.2, freq: 2600, q: 3 }); noise(0.3, { vol: 0.1, freq: 600, q: 1, at: 0.05 }); tone(180, 0.18, { type: 'sawtooth', vol: 0.05, slide: 0.5, filter: 900 }); break;
    case 'rustle': noise(0.25, { vol: 0.07, type: 'highpass', freq: 3500 }); break;
    case 'boing': tone(300, 0.28, { type: 'sine', vol: 0.12, slide: 2.2 }); tone(600, 0.2, { type: 'sine', vol: 0.05, at: 0.05, slide: 1.5 }); break;
    case 'chitter': for (let i = 0; i < 4; i++) tone((arg ? 2200 : 1800) + (i % 2) * 300, 0.04, { type: 'square', vol: 0.035, at: i * 0.055, filter: 4000 }); break;
    case 'ko': tone(900, 0.7, { type: 'sine', vol: 0.12, slide: 0.3 }); noise(0.4, { vol: 0.08, type: 'highpass', freq: 3000, at: 0.5 }); break;
    case 'cheer': for (let i = 0; i < 4; i++) tone([523, 659, 784, 1046][i], 0.18, { type: 'triangle', vol: 0.09, at: i * 0.09 }); noise(0.6, { vol: 0.05, freq: 1500, q: 0.6 }); break;
    case 'win': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.1, at: i * 0.12 })); break;
    case 'lose': [392, 349, 330, 262].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.08, at: i * 0.16 })); break;
    case 'buy': tone(988, 0.07, { type: 'square', vol: 0.05, filter: 3000 }); tone(1319, 0.12, { type: 'square', vol: 0.05, at: 0.07, filter: 3000 }); break;
    case 'land': tone(160, 0.08, { type: 'sine', vol: 0.08 }); break;
    case 'steam': noise(0.5, { vol: 0.03, type: 'highpass', freq: 5000 }); break;
    default: break;
  }
}

// ---- music: a ragtime-ish loop per mood, 8th-note steps ----------------------------------------------------
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
const THEMES = {
  title: { bpm: 112, bass: [48, 0, 55, 0, 52, 0, 55, 0, 50, 0, 57, 0, 53, 0, 57, 0], mel: [72, 0, 76, 79, 0, 76, 74, 72, 74, 0, 77, 81, 79, 0, 77, 74] },
  day: { bpm: 104, bass: [48, 0, 52, 0, 55, 0, 52, 0, 53, 0, 57, 0, 55, 0, 52, 0], mel: [0, 72, 0, 74, 76, 0, 79, 0, 77, 0, 76, 74, 72, 0, 0, 0] },
  dusk: { bpm: 92, bass: [45, 0, 52, 0, 48, 0, 52, 0, 41, 0, 48, 0, 43, 0, 50, 0], mel: [0, 69, 72, 0, 76, 0, 74, 72, 0, 69, 0, 72, 71, 0, 0, 0] },
  night: { bpm: 80, bass: [45, 0, 0, 0, 52, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0], mel: [0, 0, 76, 0, 0, 74, 0, 0, 72, 0, 0, 69, 0, 0, 71, 0] },
};
export function playTheme(name, force) {
  if (state.theme === name && !force) return;
  state.theme = name;
  if (!ctx) return;
  if (state.timer) clearInterval(state.timer);
  const th = THEMES[name] || THEMES.day, stepDur = 60 / th.bpm / 2;
  state.step = 0; state.nextT = ctx.currentTime + 0.05;
  state.timer = setInterval(() => {
    if (!ctx) return;
    while (state.nextT < ctx.currentTime + 0.2) {
      const i = state.step % 16, at = Math.max(0, state.nextT - ctx.currentTime);
      if (th.bass[i]) tone(N(th.bass[i]), stepDur * 1.6, { type: 'triangle', vol: 0.12, at, bus: musicBus, filter: 900 });
      if (th.mel[i]) { tone(N(th.mel[i]), stepDur * 0.9, { type: 'square', vol: 0.035, at, bus: musicBus, filter: 2200 }); tone(N(th.mel[i]) * 2, stepDur * 0.4, { type: 'triangle', vol: 0.02, at, bus: musicBus }); }
      if (i % 4 === 2) noise(0.03, { vol: 0.02, type: 'highpass', freq: 6000, at, bus: musicBus });
      state.step++; state.nextT += stepDur;
    }
  }, 60);
}
export function stopMusic() { if (state.timer) clearInterval(state.timer); state.timer = null; state.theme = null; }

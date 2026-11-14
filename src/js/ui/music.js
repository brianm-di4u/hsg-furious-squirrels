// Furious Squirrels: the scores and ambience scenes (data for audiokit.js). Original pieces: a ragtime title tune,
// banjo-and-piano battle music for the day, slower minor-key versions for dusk and night, and calm tunes for the
// results card and the acorn shop. Every piece runs 45 seconds or more before it repeats (the form is AABA or ABA
// with different chords in B) and each pass of the lead varies a little. Chord roots are scale degrees: 0 = I.
// Levels: the gains here are tuned so each piece measures inside the mix limits (see tests/council-w2-a.test.mjs).

export const SCORES = {
  // Title: a brisk marimba rag in B flat over a tuba and organ, with its own rhythms and a bridge that wanders to
  // the relative minor. 32 bars, about 64 s.
  title: {
    bpm: 120, swing: 0.2, key: 58, sevenths: [4, 1], form: 'AABA',
    sections: { A: [0, 4, 0, 3, 4, 4, 0, 0], B: [5, 2, 3, 1, 5, 5, 1, 4] },
    bass: { inst: 'tuba', pattern: 'two', gain: 0.1 }, comp: { inst: 'organ', at: [1, 3], gain: 0.05, len: 0.4 },
    lead: { inst: 'mallet', gain: 0.115, vary: 0.4, rest: 0.05, lift: true, rhythms: [[0, 2, 3, 6, 7], [1, 3, 4, 5], [0, 1, 2, 5, 6], [0, 3, 5, 7], [2, 3, 6], [0, 4, 6, 7]] },
    perc: { h: [1, 3], gain: 0.3 }, perc2: { s: [1.5, 3.5], h: [0.5, 1.5, 2.5, 3.5], gain: 0.4 },
    lp: 4800, delay: 0.04, delayBeats: 0.5,
  },
  // Day: banjo melody over a piano and brush backing, in G. 32 bars, about 77 s. Faster and brighter when tense.
  day: {
    bpm: 100, swing: 0.1, key: 55, sevenths: [4], form: 'AABA',
    sections: { A: [0, 0, 3, 3, 0, 0, 4, 0], B: [5, 5, 3, 3, 1, 4, 0, 4] },
    bass: { inst: 'bass', pattern: 'two', gain: 0.14 }, comp: { inst: 'banjo', at: [1, 3], gain: 0.045, len: 0.35 },
    lead: { inst: 'banjo', gain: 0.095, vary: 0.35, rest: 0.1, lift: true, rhythms: [[0, 2, 3, 4, 6], [0, 3, 4, 6, 7], [0, 1, 2, 4], [1, 3, 4, 6], [0, 2, 4, 5, 7], [0, 3, 6]] },
    perc: { b: [1, 3], h: [0.5, 1.5, 2.5, 3.5], gain: 0.32 }, perc2: { k: [0, 2], s: [1, 3], gain: 0.4 },
    lp: 4800, delay: 0.05, delayBeats: 0.5,
  },
  // Dusk: A minor, slower, plucked lead with a soft echo. 32 bars, about 87 s.
  dusk: {
    bpm: 88, swing: 0.08, key: 57, scale: [0, 2, 3, 5, 7, 8, 10], sevenths: [4], form: 'AABA',
    sections: { A: [0, 5, 3, 6, 0, 5, 4, 0], B: [3, 3, 0, 0, 5, 6, 4, 4] },
    bass: { inst: 'bass', pattern: 'two', gain: 0.14 }, comp: { inst: 'piano', at: [1, 3], gain: 0.04 },
    lead: { inst: 'banjo', gain: 0.085, oct: 1, vary: 0.35, rest: 0.2, lift: true },
    perc: { b: [1, 3], gain: 0.3 }, perc2: { k: [0, 2], h: [0.5, 1.5, 2.5, 3.5], gain: 0.4 },
    lp: 4200, delay: 0.2, delayBeats: 0.75,
  },
  // Night: E minor, slow, a pad under a mallet melody and a long echo. 32 bars, about 107 s.
  night: {
    bpm: 72, key: 52, scale: [0, 2, 3, 5, 7, 8, 10], form: 'AABA',
    sections: { A: [0, 5, 3, 6, 0, 5, 6, 4], B: [3, 3, 5, 5, 6, 6, 4, 4] },
    pad: { gain: 0.05 }, bass: { inst: 'bass', pattern: 'root', gain: 0.1 },
    lead: { inst: 'mallet', gain: 0.08, oct: 1, vary: 0.5, rest: 0.08, lift: true },
    perc2: { k: [0, 2], h: [0.5, 1.5, 2.5, 3.5], gain: 0.3 },
    lp: 3400, delay: 0.26, delayBeats: 0.75,
  },
  // Results: warm and unhurried, in a bright Lydian C with a flute over a soft piano. 16 bars, about 61 s.
  results: {
    bpm: 63, key: 60, scale: [0, 2, 4, 6, 7, 9, 11], form: 'AABA',
    sections: { A: [0, 1, 5, 3], B: [2, 5, 1, 4] },
    pad: { gain: 0.05 }, bass: { inst: 'bass', pattern: 'root', gain: 0.1 }, comp: { inst: 'piano', at: [2], gain: 0.04, len: 0.8 },
    lead: { inst: 'flute', gain: 0.085, lo: -3, hi: 10, classes: [0, 1, 2, 3, 4, 5], vary: 0.5, rest: 0.05, rhythms: [[0, 2, 4], [0, 4], [0, 3, 4, 6], [2, 4, 6], [0, 2, 5], [0, 4, 6]] },
    lp: 3800, delay: 0.22,
  },
  // Shop: a light walking tune in F for choosing nuts. 24 bars, about 69 s.
  shop: {
    bpm: 84, swing: 0.1, key: 65, sevenths: [4], form: 'ABA',
    sections: { A: [0, 5, 1, 4, 0, 3, 4, 0], B: [3, 3, 0, 5, 1, 4, 0, 4] },
    bass: { inst: 'bass', pattern: 'walk', gain: 0.13 }, comp: { inst: 'piano', at: [1, 3], gain: 0.04 },
    lead: { inst: 'mallet', gain: 0.095, vary: 0.35, rest: 0.18 },
    lp: 4000, delay: 0.12, delayBeats: 0.5,
  },
};

// Ambience scenes, one per kind of place and hour. Three values move them while a battle runs (amb.set):
// 'wind' follows the wind number, 'steam' rises as the view comes near the steam over the Row, and 'birds' follows
// the battle's birds setting. Beds are continuous noise; the birds, hoots, cawing and drips are sparse one-shots at
// random gaps, so a place never audibly loops.
// k scales the wind beds for the place: a still summer evening is quieter than the ridge in winter
const wind = (k) => [
  { type: 'lowpass', freq: 420, gain: 0.05 * k, lfo: { rate: 0.09, depth: 0.7 }, flfo: { rate: 0.04, depth: 120 }, param: 'wind', range: [0.35, 1.8] },
  { type: 'bandpass', freq: 950, q: 1.1, gain: 0.011 * k, pan: -0.25, flfo: { rate: 0.06, depth: 260 }, param: 'wind', range: [0, 2] },
];
const STEAM = [
  { type: 'highpass', freq: 4300, gain: 0.014, pan: 0.2, flfo: { rate: 0.12, depth: 600 }, param: 'steam', range: [0, 1] },
  { type: 'bandpass', freq: 1700, q: 0.5, gain: 0.011, pan: 0.1, flfo: { rate: 0.07, depth: 300 }, param: 'steam', range: [0, 1] },
];
const VENT = { make: 'hiss', every: [7, 15], gain: 0.03, param: 'steam' };
// A small floor that does not follow the wind or the steam, so a calm turn with Wind Off still has a room tone
// (-52 to -38 dBFS with the wind and the steam at zero) instead of near silence. k scales it for the place.
const FLOOR_K = 1.7; // the one number to turn the whole floor up or down
const floor = (k) => [
  { type: 'lowpass', freq: 380, gain: 0.034 * k * FLOOR_K, lfo: { rate: 0.05, depth: 0.35 }, flfo: { rate: 0.03, depth: 90 } },
  { type: 'bandpass', freq: 780, q: 0.6, gain: 0.014 * k * FLOOR_K, pan: 0.2, lfo: { rate: 0.07, depth: 0.4 }, flfo: { rate: 0.05, depth: 180 } },
];
const bedsWith = (k, ...more) => [...floor(k), ...wind(k), ...STEAM, ...more];
export const SCENES = {
  springBirds: { beds: bedsWith(0.9), spots: [{ make: 'bird', every: [1.6, 5], gain: 0.04, param: 'birds' }, { make: 'bird', every: [3, 9], gain: 0.03, pan: [-0.8, -0.3], param: 'birds' }, VENT] },
  summerDay: { beds: bedsWith(0.8), spots: [{ make: 'bird', every: [2.5, 8], gain: 0.04, param: 'birds' }, { make: 'bird', every: [6, 15], gain: 0.028, pan: [-0.8, -0.3], param: 'birds' }, VENT] },
  fallLeaves: { beds: bedsWith(1.1), spots: [{ make: 'leaf', every: [3, 9], gain: 0.02 }, { make: 'caw', every: [11, 26], gain: 0.016, pan: [-0.7, 0.7], param: 'birds' }, { make: 'bird', every: [7, 18], gain: 0.02, param: 'birds' }, VENT] },
  winterQuiet: { beds: bedsWith(1.35), spots: [{ make: 'bird', every: [12, 30], gain: 0.018, param: 'birds' }, { make: 'leaf', every: [8, 18], gain: 0.012 }, VENT] },
  duskCrickets: { beds: bedsWith(0.8), spots: [{ make: 'bird', every: [7, 16], gain: 0.02, param: 'birds' }, { make: 'cricket', every: [0.9, 2.4], gain: 0.022, pan: [-0.7, 0.7] }, VENT] },
  nightCrickets: { beds: bedsWith(0.7), spots: [{ make: 'cricket', every: [0.5, 1.4], gain: 0.026, pan: [-0.7, 0.7] }, { make: 'cricket', every: [0.9, 2.2], gain: 0.016, pan: [0.2, 0.9] }, { make: 'hoot', every: [18, 40], gain: 0.02, pan: [-0.6, 0.6] }, VENT] },
  winterNight: { beds: bedsWith(1.2), spots: [{ make: 'hoot', every: [14, 32], gain: 0.02, pan: [-0.6, 0.6] }, { make: 'leaf', every: [9, 20], gain: 0.01 }, VENT] },
  mistSteam: { beds: bedsWith(0.6, { type: 'lowpass', freq: 520, gain: 0.025, lfo: { rate: 0.06, depth: 0.5 } }), spots: [{ make: 'drip', every: [1.8, 6], gain: 0.03 }, { make: 'bird', every: [9, 20], gain: 0.016, param: 'birds' }, { make: 'hiss', every: [5, 11], gain: 0.032 }] },
};

// The scene for a battlefield: its hour first, then its season.
export function sceneFor(level) {
  const time = level && level.time, season = level && level.season;
  if (time === 'night') return season === 'winter' ? 'winterNight' : 'nightCrickets';
  if (time === 'dusk' || time === 'sunset') return 'duskCrickets';
  if (time === 'mist') return 'mistSteam';
  return { spring: 'springBirds', fall: 'fallLeaves', winter: 'winterQuiet' }[season] || 'summerDay';
}
// The battle music for a battlefield.
export function themeFor(level) {
  const time = level && level.time;
  return time === 'night' ? 'night' : time === 'dusk' || time === 'sunset' ? 'dusk' : 'day';
}

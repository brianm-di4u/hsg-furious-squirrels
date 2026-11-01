// Shared sim constants and the nut table (MECHANICS.md §2, §6, §7). No DOM: imported by Node tools too.

export const DT = 1 / 120;
export const W = 2400, H = 1200;
export const CELL = 2; // terrain mask cell size in world units
export const G = 520;
export const VMAX = 1120;
export const WIND_MAX = 140;
export const STAMINA = 300;
export const SQ_R = 22; // squirrel hit radius (body centre is SQ_UP above the perch point)
export const SQ_UP = 20;
export const GRIP = 64;
export const ANGLE_MIN = -30, ANGLE_MAX = 90;
export const SETTLE_MAX = 2.5;
export const FLIGHT_MAX = 12; // seconds; a nut still flying after this is retired
export const OWNER_GRACE = 0.25;

export const MAT = { AIR: 0, DIRT: 1, ROCK: 2, TUFA: 3, LOG: 4 }; // LOG: fallen logs and stumps (solid, never carved)

export const TEAMS = [
  { id: 'rustlers', name: 'West Ridge Rustlers', short: 'Rustlers', species: 'fox squirrels', home: 'West Mountain', shape: 'circle', facing: 1 },
  { id: 'tails', name: 'Tower Top Tails', short: 'Tails', species: 'gray squirrels', home: 'Hot Springs Mountain', shape: 'triangle', facing: -1 },
];

// grip: direct hit, splash peak at the impact point (falls linearly to 0 at splashR); wood: branch damage
// (walnut damages every branch within its blast radius); crater: radius carved in dirt.
export const NUTS = {
  acorn: { short: 'Acorn', name: 'Acorn', trick: 'Plain and dependable', r: 7, mass: 1, gMul: 1, windMul: 1, direct: 44, splash: 32, splashR: 56, wood: 30, crater: 18, price: 0, key: '1' },
  chinquapin: { short: 'Trio', name: 'Chinquapin Trio', trick: 'Tap: splits into three', r: 6, mass: 0.8, gMul: 1, windMul: 1, direct: 18, splash: 14, splashR: 34, wood: 20, crater: 12, price: 30, key: '2', split: { n: 3, spread: 9 } },
  pecan: { short: 'Pecan', name: 'Pecan Dart', trick: 'Tap: dashes straight, zips through leaves', r: 6, mass: 0.9, gMul: 1, windMul: 1, direct: 48, splash: 28, splashR: 46, wood: 60, crater: 14, price: 30, key: '3', dash: { mul: 1.9, time: 0.6 } },
  walnut: { short: 'Walnut', name: 'Black Walnut Burst', trick: 'Tap or land: big pop that rattles branches', r: 9, mass: 1.3, gMul: 1, windMul: 0.9, direct: 38, splash: 44, splashR: 100, wood: 55, woodR: 100, crater: 46, price: 45, key: '4', burst: true },
  hickory: { short: 'Hickory', name: 'Hickory Hook', trick: 'Hard shell. Tap: curls back like a boomerang', r: 7, mass: 1.1, gMul: 1, windMul: 0.9, direct: 46, splash: 30, splashR: 52, wood: 45, crater: 16, price: 35, key: '5', hook: { time: 1.4, turn: 150 } },
  sweetgum: { short: 'Gumball', name: 'Sweetgum Drop', trick: 'Tap: drops a spiky gumball straight down', r: 8, mass: 0.8, gMul: 1, windMul: 1, direct: 46, splash: 30, splashR: 56, wood: 40, crater: 20, price: 40, key: '6', drop: { gMul: 1.4 } },
  hedgeapple: { short: 'Hedge', name: 'Hedge Apple', trick: 'Heavy, shrugs off wind, rolls downhill', r: 13, mass: 2.4, gMul: 1.15, windMul: 0.3, direct: 42, splash: 22, splashR: 42, wood: 60, crater: 22, price: 60, key: '7', roll: { time: 1.2 } },
};
export const NUT_ORDER = ['acorn', 'chinquapin', 'pecan', 'walnut', 'hickory', 'sweetgum', 'hedgeapple'];
export const NUT_CAP = 3;

export const ACORNS = { hit: 4, branch: 6, ko: 20, roundWin: 40, roundPlayed: 15, start: 60 };

// Birds over the valley (MECHANICS.md §6b): airborne obstacles rolled fresh each turn. r: hit radius; v: air
// speed; alt: height band above the valley floor; keep: how much of a nut's speed survives a glancing bounce;
// snatch: may grab a plain acorn in mid-air. Seasons follow when each species is around Hot Springs.
const ALL_YEAR = ['spring', 'summer', 'fall', 'winter'];
export const BIRDS = {
  swift: { name: 'chimney swift', plural: 'chimney swifts', r: 9, v: 250, flock: [4, 7], form: 'zig', alt: [380, 880], seasons: ['spring', 'summer'], keep: 0.9 },
  vulture: { name: 'turkey vulture', plural: 'turkey vultures', r: 22, v: 85, flock: [2, 4], form: 'circle', alt: [700, 1100], seasons: ALL_YEAR, keep: 0.7 },
  jay: { name: 'blue jay', plural: 'blue jays', r: 12, v: 165, flock: [1, 1], form: 'single', alt: [380, 760], seasons: ALL_YEAR, keep: 0.85, snatch: true },
  crow: { name: 'American crow', plural: 'American crows', r: 16, v: 145, flock: [1, 3], form: 'loose', alt: [420, 900], seasons: ALL_YEAR, keep: 0.8, snatch: true },
  goose: { name: 'Canada goose', plural: 'Canada geese', r: 20, v: 150, flock: [5, 9], form: 'v', alt: [650, 1250], seasons: ['fall', 'winter'], keep: 0.6 },
  waxwing: { name: 'cedar waxwing', plural: 'cedar waxwings', r: 9, v: 195, flock: [6, 10], form: 'loose', alt: [360, 720], seasons: ['winter', 'spring'], keep: 0.9 },
  eagle: { name: 'bald eagle', plural: 'bald eagles', r: 25, v: 115, flock: [1, 1], form: 'glide', alt: [750, 1250], seasons: ['winter'], keep: 0.6 },
};
export const BIRD_LEVELS = { off: 0, some: 1, lots: 2 };

export const WIND_LEVELS = { off: 0, light: 0.45, normal: 0.8, gusty: 1 };
export const STEAM_LEVELS = { off: 0, weak: 420, on: 680, strong: 980 };

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const DEG = Math.PI / 180;

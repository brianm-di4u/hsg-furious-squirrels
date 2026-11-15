// The Valley Nut Feud in words: a blurb for each battle, the line after a win or a loss, the finale, and what the
// families call out when a squirrel is knocked out. Only the places, trees, nuts and families the game already has.
// {rival} is the other family's short name ("Rustlers" or "Tails"); {home} is the player's own mountain.

export const BLURBS = [
  'The steam is rising and the acorns are ripe. Two families spot the same tree.',
  'The tower rises over the north end, and the high ground is up for grabs.',
  'Gold light over the Row, and the chinquapins are ready to fall.',
  'Redbuds in bloom along the south end, and the pecans are close.',
  'Mist fills the valley. Trust the wind flag and keep your nerve.',
  'Magnolia lamps glow on the north end, and the night is long.',
  'Gusts shove the leaves along the Promenade, and your nuts with them.',
  'Sweetgum balls rattle down the gulch in the dusk.',
  'Four squirrels a side, and the hedge apples are heavy on the branch.',
  'A first dusting of white on the south end, and the wind will not settle.',
  'Lamps along the Row, cold air, and a rival who has learned your tricks.',
  'Three rounds, four a side, and the last sunset. Whoever holds the valley keeps the nuts.',
];

// what is said after the battle: the win line, then the loss line
export const WIN_LINES = [
  'A fine start. The {rival} are still shaking leaves out of their ears.',
  'The north end goes quiet while the {rival} regroup behind the tower.',
  'Dusk settles over a good win. The pecans go to the victors.',
  'Petals everywhere, and the ridge is yours.',
  'You read the mist like a book. The {rival} are still looking for the Row.',
  'The lamps glow on a win, and the {rival} slip off into the dark.',
  'The wind blew hard. You threw harder, and the Promenade is yours.',
  'Sweetgum balls roll down the gulch toward your victory.',
  'The harvest is in, and every basket is yours.',
  'A dusting of white on the ridge and a win in the books.',
  'Lamplight on the snow, and a warm walk home to {home}.',
];
export const LOSS_LINES = [
  'Close one. The {rival} got the morning, but the Row has plenty of days.',
  'The tower held this time. Rest up and climb again.',
  'The light went before the luck did. Try the dusk again.',
  'The ridge keeps its secrets for now. Another go will find them.',
  'The mist won that one, but the wind flag will not fool you twice.',
  'The night belonged to the {rival} this time. Dawn comes soon enough.',
  'The gusts had the last word. Watch the flag and try again.',
  'The gulch kept its sweetgum balls this time.',
  'The {rival} carried off the harvest. There is more on the branch.',
  'The cold got into your aim. Warm up and have another go.',
  'The {rival} read your tricks that round. Show them a new one.',
  'The valley holds one more battle for you. Take a breath and try the sunset again.',
];

// what each mountain adds after a result, by the player's family (0 West Ridge Rustlers, 1 Tower Top Tails)
export const CHEER = [
  { win: 'West Mountain is hollering your name.', loss: 'West Mountain says there is always another morning.' },
  { win: 'Hot Springs Mountain is hollering your name.', loss: 'Hot Springs Mountain says there is always another morning.' },
];

export const FINALE = {
  title: 'Sunset over the valley',
  text: [
    'The last acorn rolled to a stop, and the valley went quiet.',
    'Then a Rustler passed a pecan across the gap, and a Tail passed back a hickory nut. By the time the lamps lit along the Row, both families were sitting on one big pile, arguing happily about whose throw was best.',
  ],
  button: 'Roll the credits',
};

// what a family calls out when it knocks a squirrel out, and when one of its own is knocked out
export const TAUNTS = [
  ['Right off the branch, neighbor!', 'Mind the leaf pile!', 'West Ridge sends its regards!'],
  ['Tail first, friend!', 'Hope the landing was soft!', 'Tower Top sends its regards!'],
];
export const GROANS = [
  ['Well, shake my tail!', 'Not my best branch!', 'Leaves in my ears again!'],
  ['Oh, my acorns!', 'That stung my pride!', 'Somebody catch my cap!'],
];

// the Field Note that goes with each battle (S4-06), by battle number: ids from data/facts.json. A battle shows its own
// note first; after that it shows one the player has not read yet.
export const LEVEL_FACTS = ['hs-0093', 'hs-0094', 'hs-0082', 'n-redbud', 'n-wind', 'hs-0066', 'hs-0086', 'n-gumball', 'n-hedgeapple', 'n-pine', 'hs-0084', 'hs-0071'];

// The three stars of a Story battle (S3-05): the win, at most KO_ALLOWED squirrels lost (none in a battle of two a side, one in
// three or four a side: keeping all four untouched was met in about 3 battles in 100 by an even match, and by 9 in 100 for a
// stronger player), and the win within the level's par of the family's own turns. KO_ALLOWED was 0 for every size.
const KO_SIZE = 3, KO_ALLOWED = 1;
export const koAllowed = (size) => (size >= KO_SIZE ? KO_ALLOWED : 0);
// A battle of several rounds (P-N02, the finale is best of three) is judged over all the rounds played, by the rule of a one-round battle
// for each: the squirrels lost across the rounds may be KO_ALLOWED a round, and the par is the level's par a round. `rounds` is the
// number of rounds played (1 for every other battle, so nothing there moves).
export const parFor = (par, rounds = 1) => par * Math.max(1, rounds);
export function starsFor({ win, outs, size, turns, par, rounds = 1 }) { return win ? 1 + (outs <= koAllowed(size) * Math.max(1, rounds) ? 1 : 0) + (turns <= parFor(par, rounds) ? 1 : 0) : 0; }

export function blurbFor(n) { return BLURBS[n - 1] || ''; }

// the line shown on the results card
export function resultLine(n, win, me, rivalShort, home) {
  const list = win ? WIN_LINES : LOSS_LINES;
  const base = (list[n - 1] || '').replace('{rival}', rivalShort).replace('{home}', home);
  return base ? `${base} ${CHEER[me][win ? 'win' : 'loss']}` : '';
}

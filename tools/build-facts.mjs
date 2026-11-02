// Build data/facts.json for the Field Notes card (PRD §4, AC21).
//   node tools/build-facts.mjs
// Landmark facts are copied from the audited trivia bank (games/trivia/data/questions.json, confirmed only);
// nature facts are the sourced items from research/squirrels-and-nuts.md and research/birds.md "Facts worth adding" (no
// [UNVERIFIED] or search-summary items). tools/check-facts.mjs re-verifies both sets.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BANK = process.env.FS_TRIVIA_BANK || path.resolve(ROOT, '..', 'hsg-trivia', 'data', 'questions.json');

// id -> which Row stretch it belongs to (for picking a fact that matches the backdrop)
export const LANDMARK_IDS = {
  'hs-0066': 'north', 'hs-0102': 'north', 'hs-0061': 'north', 'hs-0080': 'north',
  'hs-0081': 'middle', 'hs-0093': 'middle', 'hs-0082': 'middle', 'hs-0084': 'middle',
  'hs-0085': 'south', 'hs-0062': 'south', 'hs-0069': 'south', 'hs-0077': 'south',
  'hs-0086': 'any', 'hs-0094': 'north', 'hs-0099': 'north', 'hs-0071': 'north',
};

export const NATURE = [
  { id: 'n-squirrels-park', season: 'any', text: 'Both families are real neighbors: the park\'s species list counts the eastern gray squirrel as present and the fox squirrel as probably present.', source: 'NPS NPSpecies, Hot Springs National Park mammals', url: 'https://irmaservices.nps.gov/v3/rest/npspecies/checklist/HOSP/Mammal' },
  { id: 'n-size', season: 'any', text: 'Fox squirrels are the bigger cousins: about 1½–2 lb in Arkansas, while gray squirrels weigh just over a pound.', source: 'University of Arkansas Cooperative Extension', url: 'https://uaex.uada.edu/environment-nature/musings-on-nature-blog/posts/squirrels.aspx' },
  { id: 'n-dreys', season: 'any', text: 'A squirrel\'s leaf nest sits about 40 feet up, is 12–20 inches across, and can be built in under 12 hours.', source: 'Missouri Department of Conservation', url: 'https://mdc.mo.gov/discover-nature/field-guide/eastern-gray-squirrel-and-eastern-fox-squirrel' },
  { id: 'n-planters', season: 'fall', text: 'Gray squirrels bury nuts one at a time and never find them all, so they plant new trees every fall.', source: 'University of Arkansas Cooperative Extension', url: 'https://uaex.uada.edu/environment-nature/musings-on-nature-blog/posts/squirrels.aspx' },
  { id: 'n-mast', season: 'fall', text: 'Oak and hickory nuts in the region fall in September and October. Red-oak acorns take two years to ripen; white oak acorns take one.', source: 'Missouri Department of Conservation tree guide', url: 'https://mdc.mo.gov/discover-nature/field-guide/white-oak' },
  { id: 'n-pine', season: 'winter', text: 'Squirrels snip shortleaf pine cones and eat the seeds before the cones even open.', source: 'USDA Forest Service, Silvics of North America', url: 'https://research.fs.usda.gov/silvics/shortleaf-pine' },
  { id: 'n-hedgeapple', season: 'fall', text: 'Hedge apples (Osage-orange) are native to the Red River country of Oklahoma, Texas and Arkansas. Squirrels tear them open for the seeds.', source: 'Missouri Department of Conservation', url: 'https://mdc.mo.gov/discover-nature/field-guide/osage-orange' },
  { id: 'n-gumball', season: 'winter', text: 'Sweetgum "gumballs" aren\'t nuts: they are spiky 1–1½ inch seed balls that ripen in fall and hang on all winter.', source: 'Missouri Department of Conservation', url: 'https://mdc.mo.gov/discover-nature/field-guide/sweet-gum' },
  { id: 'n-chinquapin', season: 'summer', text: 'The Ozark chinquapin still grows in the park but is rare: chestnut blight reached it by 1940, and volunteers now breed blight-resistant trees.', source: 'University of Arkansas Cooperative Extension', url: 'https://uaex.uada.edu/yard-garden/resource-library/plant-week/chinquapin-ozark.aspx' },
  { id: 'n-fallcolor', season: 'fall', text: 'In fall, hickories turn golden yellow and sweetgums go red, orange, maroon and purple.', source: 'Missouri Department of Conservation', url: 'https://mdc.mo.gov/discover-nature/field-guide/shagbark-hickory' },
  { id: 'n-redbud', season: 'spring', text: 'Redbuds bloom pink to reddish purple from March before their leaves come out; flowering dogwood follows with white bracts.', source: 'USDA Forest Service, Silvics of North America', url: 'https://research.fs.usda.gov/silvics/eastern-redbud' },
  { id: 'n-wind', season: 'any', text: 'Hot Springs breezes are gentle: at Memorial Field the wind averages about 5 mph and blows from the east more than any other direction (2016–2025 records).', source: 'Iowa Environmental Mesonet ASOS archive (computed)', url: 'https://mesonet.agron.iastate.edu/request/download.phtml?network=AR_ASOS' },
  // birds over the valley (research/birds.md)
  { id: 'n-birds-park', season: 'any', text: 'Every bird that flies over these battles is on Hot Springs National Park\'s species list, from chimney swifts to bald eagles.', source: 'NPS NPSpecies, Hot Springs National Park birds', url: 'https://irmaservices.nps.gov/v3/rest/npspecies/checklist/HOSP/Bird' },
  { id: 'n-jays', season: 'fall', text: 'A blue jay can carry five acorns at once and bury up to 5,000 in a season, but finds only about one in four, so jays plant oak trees.', source: 'National Park Service, Species Spotlight: Oaks', url: 'https://www.nps.gov/articles/species-spotlight-oaks.htm' },
  { id: 'n-vultures', season: 'any', text: 'Turkey vultures ride rising warm air, holding their wings in a shallow V and tilting side to side. Their wings span about 70 inches.', source: 'Missouri Department of Conservation', url: 'https://mdc.mo.gov/discover-nature/field-guide/turkey-vulture' },
  { id: 'n-swifts', season: 'summer', text: 'Chimney swifts look like flying cigars and catch insects on the wing. They arrive in April and leave for South America in October.', source: 'Missouri Department of Conservation', url: 'https://mdc.mo.gov/discover-nature/field-guide/chimney-swift' },
  { id: 'n-waxwings', season: 'winter', text: 'Cedar waxwings travel in big, quiet flocks and eat cedar berries in winter. Look for the yellow tips on their tails.', source: 'Missouri Department of Conservation', url: 'https://mdc.mo.gov/discover-nature/field-guide/cedar-waxwing' },
  { id: 'n-geese', season: 'fall', text: 'Migrating Canada geese fly in V-shaped chevrons, and the males call a long, loud "a-honk!"', source: 'Missouri Department of Conservation', url: 'https://mdc.mo.gov/discover-nature/field-guide/canada-goose' },
  { id: 'n-eagles', season: 'winter', text: 'Arkansas\'s first modern bald eagle nest was found in 1983; now about 150–160 pairs nest in the state, and winter is the best time to spot one.', source: 'Arkansas Game & Fish Commission', url: 'https://www.agfc.com/news/eagles-inspire-awe-appreciation-for-conservation-efforts/' },
];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
  const qs = Array.isArray(bank) ? bank : bank.questions;
  const landmarks = Object.entries(LANDMARK_IDS).map(([id, stretch]) => {
    const q = qs.find((x) => x.id === id);
    if (!q) throw new Error('missing trivia id ' + id);
    if (q.confidence !== 'confirmed') throw new Error(id + ' is not confirmed');
    return { id, stretch, text: q.explanation, q: q.question, a: q.answer, source: q.source, url: q.sourceUrl };
  });
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'data', 'facts.json'), JSON.stringify({ landmarks, nature: NATURE }, null, 1));
  console.log('data/facts.json:', landmarks.length, 'landmark +', NATURE.length, 'nature facts');
}

// Season and time-of-day looks. Hexes are estimates (est.) from shared/design/tokens.css palettes
// (ouachita-forest, thermal-water, gilded-spa, nps-rustic) and research/squirrels-and-nuts.md canopy notes.

export const SKY = {
  day: { top: '#7FB4DA', mid: '#B9D8EA', low: '#EAF1E6', sun: '#FFF6D8', tint: null, light: 1 },
  mist: { top: '#A9C2CF', mid: '#CBD9DE', low: '#EEF1EC', sun: '#FFF9E8', tint: 'rgba(235,240,238,0.22)', light: 0.96 },
  dusk: { top: '#4B5D8E', mid: '#C98A7A', low: '#F2C08A', sun: '#FFD9A0', tint: 'rgba(120,70,90,0.16)', light: 0.88 },
  sunset: { top: '#3F4F86', mid: '#E0866A', low: '#F6C27A', sun: '#FFE0A8', tint: 'rgba(200,110,60,0.14)', light: 0.9 },
  night: { top: '#0F1A33', mid: '#1F2F52', low: '#3A4A6A', sun: '#F4F1DE', tint: 'rgba(20,30,70,0.42)', light: 0.6 },
};

// canopy colours by species and season: [base, light, dark]
const C = (b, l, d) => ({ base: b, light: l, dark: d });
export const CANOPY = {
  summer: { oak: C('#4F6B35', '#6E8C45', '#33492A'), hickory: C('#5C7A3A', '#7C9A4C', '#3C5428'), pine: C('#2F4A2C', '#46653A', '#1F3324'), sweetgum: C('#4E7A3A', '#6D9A4A', '#355628'),
    redbud: C('#5E8A3E', '#7FA855', '#3E6028'), redcedar: C('#2E4B3A', '#45664F', '#1D3226'), osage: C('#4A7434', '#6A9446', '#30502A'), snag: null },
  spring: { oak: C('#7FA54A', '#A3C46A', '#58783A'), hickory: C('#8DB85A', '#B2D47E', '#62873E'), pine: C('#36553A', '#4F7046', '#22382A'), sweetgum: C('#86B356', '#ABCF78', '#5E853C'),
    redbud: C('#C25A93', '#E08AB8', '#8E3A6A'), redcedar: C('#34523E', '#4C6E55', '#20372A'), osage: C('#7FAE4C', '#A2CA6E', '#577E36'), snag: null },
  fall: { oak: C('#9A5A2E', '#C27A40', '#6B3A20'), hickory: C('#D4A72C', '#EBC85A', '#9C7420'), pine: C('#33502E', '#4A6A3C', '#22382A'), sweetgum: C('#A8352E', '#D0574A', '#6E2230'),
    redbud: C('#C9A43A', '#E6C760', '#93762A'), redcedar: C('#3A5238', '#52704C', '#253826'), osage: C('#C8B040', '#E2CE66', '#8E7A2A'), snag: null },
  winter: { oak: C('#9C7A52', '#B8966A', '#6E5438'), hickory: null, pine: C('#2E4A34', '#45634A', '#1E3226'), sweetgum: null,
    redbud: null, redcedar: C('#4A5638', '#62704C', '#2E3A26'), osage: null, snag: null },
};
export const ACCENT = { spring: ['#B5568F', '#F6F3EC'], fall: ['#E07A2E', '#B8402C'] }; // redbud, dogwood / fall leaf bits

export const GROUND = {
  summer: { top: '#5E7A34', soil: '#7A5A3A', deep: '#4E3A28', litter: '#8A7A3E' },
  spring: { top: '#78993E', soil: '#7A5A3A', deep: '#4E3A28', litter: '#94A04A' },
  fall: { top: '#8A6A34', soil: '#7A5A3A', deep: '#4E3A28', litter: '#B07A30' },
  winter: { top: '#E8ECEA', soil: '#6E5640', deep: '#463426', litter: '#9A8A70' },
};

export const BARK = { oak: '#5B4632', hickory: '#6A5848', pine: '#7A4E34', sweetgum: '#5E4E44', redbud: '#4A3A34', redcedar: '#8A5A3E', osage: '#8A5E34', snag: '#7E7468' };
// evergreen needle crowns (drawn as spiky tufts; every bough carries needles)
export const EVERGREEN = new Set(['pine', 'redcedar']);

export const TEAM_COLORS = [
  { coat: '#C8763A', coatDark: '#8E4E22', belly: '#E9B27A', acc: '#E0B23A', accDark: '#9C7A1E', ui: '#B5541E', uiText: '#FFF4E0', label: 'Rustlers' },
  { coat: '#9A9A96', coatDark: '#64645F', belly: '#F2EFE6', acc: '#2A9D8F', accDark: '#1F6B62', ui: '#2C6E68', uiText: '#F0FBF9', label: 'Tails' },
];

// Adult skin for regulated markets. Checked against the audit's minors-appeal findings:
//
//  - UK CAP 16.3.12 / 16.3.14 and the under-18 guidance (Oct 2025): no cartoon mascots, no "cute
//    animal" treatment, and the guidance reaches in-game themes, not just ad creative.
//  - Kenya Gambling Control (Licensing) Regulations 2026 reg 95(1)(d): no cartoons, toys or
//    child-oriented imagery.
//  - Portugal Reg. 308/2023 R7c and Brazil Portaria 1.231/2024 art. 12 XVIII: nothing particularly
//    appealing to minors.
//
// What changes against Candy: charcoal, teal and brass palette; no crown, no blush, no buck teeth;
// natural, muted fur tones; earthy hole and turf. The shapes stay the same so the frame names and
// the layout are unchanged, which keeps one certified client for every market.
export const ADULT = {
  name: 'adult',
  crown: false,
  blush: false,
  teeth: false,
  grass: '#4a6b52',
  tuft: '#3c5744',
  holeBack: '#241f25',
  holeShadow: '#151217',
  moles: {
    gold: { body: '#b98a3c', snout: '#d9c193', shine: '#d8b978' },
    decoy: { body: '#7a6a5c', snout: '#b2a495', shine: '#93826f' },
    bad: { body: '#3f4b57', snout: '#8e9aa6', shine: '#5b6b7a' },
    good: { body: '#2f6f63', snout: '#a9cfc6', shine: '#4f9a89' },
  },
};

// ===========================================================================
// GUIDE CONTENT — this is the only file you need to edit to fill in the guide.
//
//  * Add a town hall: copy one block in `townHalls`, change `level`, and put its
//    picture at assets/th/th<level>.webp. Set `soon: true` while it has no guide yet
//    (it still slides into the middle and says "coming soon"). Leave `image: null`
//    until you have its picture, then set it to 'assets/th/th<level>.webp'. Town halls are shown
//    in level order. `theme` is an [r, g, b] colour for the floating lights.
//  * Bases: give each one a `link` (the "copy base" link from the game, which
//    starts with https://link.clashofclans.com/) and, optionally, an `image`
//    (path like "assets/bases/th14-village.jpg", about 900px wide). With no link it shows "link coming soon".
//  * Armies: at most 3 per town hall: one `ground`, one `air`, one `recommended`.
//    `type` on the recommended army is "air" or "ground" (shows a blue AIR or
//    orange GROUND tag next to RECOMMENDED); leave it null for no tag.
//    `by` is the creator's name, `video` a YouTube link, and
//    `link` is the game's "copy army" link. `troops` is a list like
//    [{ name: "Electro Dragon", count: 8 }, ...] (leave [] until you know it).
//  * Army pictures: give an army `art` to show a picture on its card. Each layer is
//    placed freely; later layers sit in front of earlier ones:
//      art: { layers: [
//        { src: 'assets/troops/dragon.webp', x: 20, y: 24, h: 70, dim: true },
//        { src: 'assets/troops/royal-champion.webp', x: 50, y: 0, h: 92 },
//      ] }
//    x = centre across the card (0-100), y = height above the floor (0-100),
//    h = picture height (% of the card). Optional: dim (darker), ghost (see-through
//    cloned look), flip (mirror it). Use transparent images from public/assets/troops/.
//    (A simpler `{ front: [...], back: [...] }` form also works.) With no `art`, or
//    if a file is missing, the card shows an "Army picture coming soon" box.
//  * Tips: `generalTips` show on every town hall (a tip with `from: N` only shows from town
//    hall N up); a town hall's own `tips` are added after them (set `onlyOwnTips: true` on a
//    town hall to show only its own).
// ===========================================================================
window.GUIDE_DATA = {
  // The town hall that is centred when the Guide opens.
  defaultLevel: 14,

  // Shown next to the "Armies" heading (a town hall can override it with its own `armiesNote`).
  armiesNote: 'Guarantees you consistent 3 stars',

  generalTips: [
    {
      from: 14, // pets arrive at TH14
      title: "Don't sink upgrades into L.A.S.S.I once a better pet is available",
      text: "Upgrade the newer, stronger pet instead. Upgrades on the starter pet are mostly wasted once you can move on.",
    },
    {
      title: 'Offense before defense',
      text: 'Prioritise offensive buildings (Army Camps, Barracks, Laboratory and the like) over defensive upgrades. Stronger attacks win you far more than slightly tougher walls and towers.',
    },
    {
      title: 'Upgrade the Blacksmith over defenses',
      text: 'Blacksmith upgrades unlock level 18 for all equipment, which makes a huge difference in your attacks.',
    },
    {
      from: 13, // the Royal Champion arrives at TH13
      title: 'Hero upgrade order',
      text: 'Royal Champion first, then Grand Warden, then Archer Queen and Minion Prince equally, and Barbarian King last (RC > GW > AQ = MP > BK).',
    },
  ],

  townHalls: [
    {
      level: 11,
      image: 'assets/th/th11.webp',
      theme: [255, 140, 56], // orange
      onlyOwnTips: true,
      bases: [
        { name: 'Village base', note: '', by: 'COC Layouts', image: 'assets/bases/th11-village.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH11%3AHV%3AAAAAFwAAAAI54DercfC80Kvl5x8NjcBc' },
        { name: 'War base', note: '', by: 'Unknown2', image: 'assets/bases/th11-war.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH11%3AWB%3AAAAAFwAAAALGsYXdv7ux7Yl8vUW8fpV2' },
        { name: 'Progress base', note: '', by: 'COC Bases', image: 'assets/bases/th11-progress.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH11%3AHV%3AAAAAVwAAAAFO02hA0btQhGtd-DTszHoZ' },
      ],
      armies: [
        { kind: 'recommended', type: 'air', name: 'Super Yeti Clone Dragons', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 33, y: 16, h: 90 }, { src: 'assets/troops/super-yeti.webp', x: 72, y: 0, h: 88 }, { src: 'assets/troops/clone-spell.webp', x: 10, y: 64, h: 30 }] }, summary: '', troops: [], link: 'https://link.clashofclans.com/en/?action=CopyArmy&army=h1e48_17-6e42_43-2m1e4_24i1x147-1x52d1x120-1x9u11x8-2x23-4x5s3x16-1x2', video: 'https://www.youtube.com/watch?v=zRYwi0rFkd0&t=10s' },
        { kind: 'ground', name: 'Queen Charge Hybrid', by: 'Sturge', art: { layers: [{ src: 'assets/troops/miner.webp', x: 20, y: 0, h: 66 }, { src: 'assets/troops/hog-rider.webp', x: 80, y: 0, h: 82 }, { src: 'assets/troops/archer-queen.webp', x: 50, y: 0, h: 100 }] }, summary: '', troops: [], link: 'https://link.clashofclans.com/en/?action=CopyArmy&army=h0e14_8-1e15_48-2e4_5i7x11-1x75d2x5u5x7-1x5-1x23-11x11-13x24-3x1-1x10-1x6-3x55-3x28s2x2-2x1-2x5-1x9', video: 'https://www.youtube.com/watch?v=ufQ-VwmAdmI&t=488s' },
        { kind: 'air', name: 'Modified Dragons', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 24, y: 16, h: 78, dim: true }, { src: 'assets/troops/dragon.webp', x: 44, y: 18, h: 92 }, { src: 'assets/troops/archer.webp', x: 78, y: 0, h: 80 }] }, summary: '', troops: [], link: 'https://link.clashofclans.com/en/?action=CopyArmy&army=h0e14_32-1e48_16-2e24_5i1x52-1x1-2x4-3x83d2x120u2x5-1x23-3x28-9x27-5x7-1x6-4x1-1x17s1x2-5x35-1x9-3x5', video: 'https://www.youtube.com/watch?v=zRYwi0rFkd0&t=486s' },
      ],
      tips: [
        {
          title: 'Upgrade the Grand Warden',
          text: 'Prioritise him and his common equipment, the Eternal Tome and the Rage Gem.',
        },
        {
          title: 'Offensive buildings over defensive buildings',
          text: 'Upgrade your offensive buildings (Army Camps, Laboratory and the like) before defensive ones.',
        },
        {
          title: 'Eagle Artillery is strong',
          text: 'Get this building first when you do upgrade your defences.',
        },
      ],
    },
    { level: 12, image: 'assets/th/th12.webp', soon: true, theme: [64, 152, 255] },
    { level: 13, image: 'assets/th/th13.webp', soon: true, theme: [60, 206, 206] },
    {
      level: 14,
      image: 'assets/th/th14.webp',
      theme: [72, 214, 112], // colour of the floating lights while this town hall is centred (green)
      bases: [
        { name: 'Village base', note: '', by: 'COC Layouts', image: 'assets/bases/th14-village.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH14%3AHV%3AAAAAQAAAAAJaylAU8C9KEr_3IIxmptIW' },
        { name: 'War base', note: '', by: '-CRIMSON-', image: 'assets/bases/th14-war.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH14%3AWB%3AAAAAQAAAAAJeLOaSHi2NcHAiHclV7cCQ' },
        { name: 'Progress base', note: '', by: 'COC Bases', image: 'assets/bases/th14-progress.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH14%3AHV%3AAAAAHwAAAAKiS60K7p0yxeED25PQ6NEA' },
      ],
      armies: [
        { kind: 'recommended', type: 'air', name: 'RC Charge Dragons', by: 'Sturge', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 20, y: 24, h: 70, dim: true }, { src: 'assets/troops/dragon.webp', x: 80, y: 24, h: 70, dim: true, flip: true }, { src: 'assets/troops/royal-champion.webp', x: 50, y: 0, h: 92 }] }, summary: '', troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p1e20_17-6p0e42_43-2m1p2e4_34-4p3e6_40i9x5-1x62d1x2-1x5u9x8-3x65-7x5-1x23-3x62s8x35-1x10-1x53', video: 'https://www.youtube.com/watch?v=MqEyKk7kI9M' },
        { kind: 'ground', name: 'Icy Witch Bat', by: 'Sturge', art: { layers: [{ src: 'assets/troops/bat.webp', x: 76, y: 66, h: 17, dim: true }, { src: 'assets/troops/bat.webp', x: 87, y: 50, h: 14, dim: true }, { src: 'assets/troops/bat.webp', x: 66, y: 78, h: 12, dim: true }, { src: 'assets/troops/ice-golem.webp', x: 33, y: 0, h: 88 }, { src: 'assets/troops/witch.webp', x: 68, y: 0, h: 96 }] }, summary: '', troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p3e20_48-2p2e34_4-0p1e14_8-4p0e13_40i1x53-1x110-1x26-1x87-2x1d2x5-1x120u8x58-10x15-6x6-2x28-1x97-1x87-1x75-1x91s1x2-3x5-1x9-5x28', video: 'https://www.youtube.com/watch?v=MqEyKk7kI9M&t=165s' },
        { kind: 'air', name: 'Clone Dragons', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 38, y: 24, h: 76, ghost: true }, { src: 'assets/troops/dragon.webp', x: 58, y: 14, h: 84 }, { src: 'assets/troops/clone-spell.webp', x: 11, y: 66, h: 28 }] }, summary: '', troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p3e17_20-6e42_43-2m1p2e4_34-4p0e6_13i1x147-1x52d1x16u4x5-13x8-1x82-1x23-2x10-1x52s1x2-3x16', video: 'https://www.youtube.com/watch?v=6PZlG-Zx1qo' },
      ],
      tips: [
        {
          title: 'TH14 is an easy town hall',
          text: 'Feel free to catch up on upgrades here, or rush to TH15.',
        },
        {
          title: 'Do not sleep on these equipment',
          text: "The Archer Queen's Giant Arrow and the Royal Champion's Royal Gem and Seeking Shield are the best common equipment of all the hero equipment. Prioritise them when upgrading equipment at TH14.",
        },
      ],
    },
    {
      level: 15,
      image: 'assets/th/th15.webp',
      theme: [176, 110, 255], // purple
      onlyOwnTips: true, // skip the general tips; this town hall has its own full list
      bases: [
        { name: 'Village base', note: '', by: 'COC Layout', image: 'assets/bases/th15-village.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH15%3AHV%3AAAAARQAAAAIzAIceWmGs0k4Y9mcp5GF7' },
        { name: 'War base', note: '', by: '-CRIMSON-', image: 'assets/bases/th15-war.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH15%3AWB%3AAAAARQAAAAJP4fzvJ45DA-F8C747NQmj' },
        { name: 'Progress base', note: '', by: 'COC Bases', image: 'assets/bases/th15-progress.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH15%3AHV%3AAAAAMAAAAAJi3-4akhEouEXtoACzZn-6' },
      ],
      armies: [
        { kind: 'recommended', type: 'air', name: 'Dragon Super Yeti Clone (Basic)', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 33, y: 16, h: 90 }, { src: 'assets/troops/super-yeti.webp', x: 72, y: 0, h: 88 }, { src: 'assets/troops/clone-spell.webp', x: 10, y: 64, h: 30 }] }, summary: '', troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p9e17_48-6p2e49_43-2m1e4_34-7p4e52_60i1x52-1x147d1x16u14x8-1x23-4x5-1x82-2x10s3x16-1x2', video: 'https://www.youtube.com/watch?v=eR4dtyQ3PJ0&t=9s' },
        { kind: 'ground', name: 'Root Riders with Backpack Arrow', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/root-rider.webp', x: 24, y: 0, h: 100 }, { src: 'assets/troops/rocket-backpack.webp', x: 53, y: 40, h: 56 }, { src: 'assets/troops/giant-arrow.webp', x: 75, y: 14, h: 56 }] }, summary: '', troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h7p4e57_53-1p9e17_48-2p7e4_24-4p3e40_13i3x63-1x5-1x188d1x120-1x53u5x7-3x5-1x97-4x110-5x12-2x58-4x57-2x1-5x26-1x82-1x75s5x35-1x5-3x10-1x70', video: 'https://www.youtube.com/watch?v=eR4dtyQ3PJ0&t=986s' },
        { kind: 'air', name: 'Dragon Super Yeti Clone (Advance)', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 25, y: 16, h: 90 }, { src: 'assets/troops/super-yeti.webp', x: 79, y: 0, h: 88 }, { src: 'assets/troops/dragon-duke.webp', x: 52, y: 6, h: 104 }, { src: 'assets/troops/clone-spell.webp', x: 9, y: 64, h: 30 }] }, summary: '', troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p9e17_48-6p2e49_43-2m1e4_34-7p4e52_60i1x52-1x147d1x109-2x120u14x8-1x23-4x5-1x82-2x10s3x16-1x2', video: 'https://www.youtube.com/watch?v=eR4dtyQ3PJ0&t=224s' },
      ],
      tips: [
        {
          title: 'Upgrade the Dragon Duke ASAP',
          text: 'He replaces the Minion Prince and the Barbarian King in your attacks.',
        },
        {
          title: 'Offence over defence',
          text: 'Upgrade offensive buildings before defences, with the exception of the Spell Towers and the Monolith, which are extremely strong.',
        },
        {
          title: 'Phoenix is really strong',
          text: 'Upgrade that pet immediately if you get the chance. Other pets to consider are the Unicorn, Frosty and Diggy.',
        },
        {
          title: 'Similar to TH14 attacks',
          text: "Most attacks at TH15 are pretty similar to TH14. If you don't like to deviate much, you don't have to.",
        },
        {
          title: 'Building your own base?',
          text: 'Consider multi-target Infernos, because they pair up well with the new Monoliths and Spell Towers.',
        },
      ],
    },
    { level: 16, image: 'assets/th/th16.webp', soon: true, theme: [235, 72, 84] },
    { level: 17, image: 'assets/th/th17.webp', soon: true, theme: [92, 120, 255] },
  ],
};

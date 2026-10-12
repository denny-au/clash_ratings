// ===========================================================================
// GUIDE CONTENT — this is the only file you need to edit to fill in the guide.
//
//  * Add a town hall: copy one block in `townHalls`, change `level`, and put its
//    picture at assets/th/th<level>.webp. Set `soon: true` while it has no guide yet
//    (it still slides into the middle and says "coming soon"). Leave `image: null`
//    until you have its picture, then set it to 'assets/th/th<level>.webp'. Town halls are shown
//    in level order. `theme` is an [r, g, b] colour for the floating lights.
//  * Bases: give each one a `link` (the "copy base" link from the game, which
//    starts with https://link.clashofclans.com/, or a base page on https://cocbases.com/ which
//    shows a "View base" button) and, optionally, an `image`
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
      title: 'Prioritize offense over defense',
      text: 'Upgrade your offensive buildings (Army Camps, Laboratory and the like) before defensive ones.',
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
        { kind: 'recommended', type: 'air', name: 'Super Yeti Clone Dragons', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 33, y: 10, h: 90 }, { src: 'assets/troops/super-yeti.webp', x: 72, y: 0, h: 88 }, { src: 'assets/troops/clone-spell.webp', x: 10, y: 64, h: 30 }] }, summary: "The recommended army stays the same through TH15, which builds consistency and is proven to work. It is easy to train and doesn't require much planning in the laboratory.", troops: [], link: 'https://link.clashofclans.com/en/?action=CopyArmy&army=h1e48_17-6e42_43-2m1e4_24i1x147-1x52d1x120-1x9u11x8-2x23-4x5s3x16-1x2', video: 'https://www.youtube.com/watch?v=zRYwi0rFkd0&t=10s' },
        { kind: 'ground', name: 'Queen Charge Hybrid', by: 'Sturge', art: { layers: [{ src: 'assets/troops/miner.webp', x: 20, y: 0, h: 66 }, { src: 'assets/troops/hog-rider.webp', x: 80, y: 0, h: 82 }, { src: 'assets/troops/archer-queen.webp', x: 50, y: 0, h: 100 }] }, summary: "If you want to try an old but gold strategy, you can try out a Queen Charge.", troops: [], link: 'https://link.clashofclans.com/en/?action=CopyArmy&army=h0e14_8-1e15_48-2e4_5i7x11-1x75d2x5u5x7-1x5-1x23-11x11-13x24-3x1-1x10-1x6-3x55-3x28s2x2-2x1-2x5-1x9', video: 'https://www.youtube.com/watch?v=ufQ-VwmAdmI&t=488s' },
        { kind: 'air', name: 'Modified Dragons', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 24, y: 16, h: 78, dim: true }, { src: 'assets/troops/dragon.webp', x: 44, y: 8, h: 92 }, { src: 'assets/troops/archer.webp', x: 78, y: 0, h: 80 }] }, summary: 'Only for attacking stronger town halls. Against the same town hall or lower, use the recommended army.', troops: [], link: 'https://link.clashofclans.com/en/?action=CopyArmy&army=h0e14_32-1e48_16-2e24_5i1x52-1x1-2x4-3x83d2x120u2x5-1x23-3x28-9x27-5x7-1x6-4x1-1x17s1x2-5x35-1x9-3x5', video: 'https://www.youtube.com/watch?v=zRYwi0rFkd0&t=486s' },
      ],
      tips: [
        {
          title: 'Welcome to the middle game',
          text: 'Town Hall 11 is where the middle game of Clash of Clans begins. The easy early upgrades are behind you, so the choices you make from here start to matter.',
        },
        {
          title: 'Upgrade the Grand Warden',
          text: 'Prioritise him and his common equipment, the Eternal Tome and the Rage Gem.',
        },
        {
          title: 'Prioritize offense over defense',
          text: 'Upgrade your offensive buildings (Army Camps, Laboratory and the like) before defensive ones.',
        },
        {
          title: 'Eagle Artillery is strong',
          text: 'Get this building first when you do upgrade your defences.',
        },
      ],
    },
    {
      level: 12,
      image: 'assets/th/th12.webp',
      theme: [64, 152, 255], // blue
      onlyOwnTips: true,
      bases: [
        { name: 'Village base', note: '', by: 'Kane', image: 'assets/bases/th12-village.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH12%3AHV%3AAAAAMQAAAAJ1KNQ-5GE2tH382TNz_8u0' },
        { name: 'War base', note: '', by: 'COC Layouts', image: 'assets/bases/th12-war.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH12%3AWB%3AAAAAMQAAAAJ1J46kBC-XrN1TQw39MaB_' },
        { name: 'Progress base', note: '', by: 'COC Bases', image: 'assets/bases/th12-progress.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH12%3AHV%3AAAAAPwAAAAIVnLZ6AlUiIBNsYcve-Rzk' },
      ],
      armies: [
        { kind: 'recommended', type: 'air', name: 'Super Yeti Clone Dragons', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 33, y: 10, h: 90 }, { src: 'assets/troops/super-yeti.webp', x: 72, y: 0, h: 88 }, { src: 'assets/troops/clone-spell.webp', x: 10, y: 64, h: 30 }] }, summary: "The recommended army stays the same through TH15, which builds consistency and is proven to work. It is easy to train and doesn't require much planning in the laboratory.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1e17_20-6e42_43-2m1e4_24i1x52-1x147d1x9-1x120u13x8-2x5-1x23-1x52-1x62s3x16-1x2', video: 'https://www.youtube.com/watch?v=_oh6bWIrqmE&t=10s' },
        { kind: 'ground', name: 'Blizzard Super Archers', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/super-archer.webp', x: 35, y: 0, h: 96 }, { src: 'assets/troops/super-archer.webp', x: 64, y: 0, h: 96 }, { src: 'assets/troops/freeze-spell.webp', x: 10, y: 64, h: 30 }] }, summary: "Use this army if you are going up against a town hall higher than yours during war.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h0e32_14-1e16_48-2e24_5i4x83-1x52d2x120u5x7-2x5-10x27-2x1-1x23-2x6-1x82-3x28-1x17-1x62s5x35-1x2-1x9-3x5', video: 'https://www.youtube.com/watch?v=_oh6bWIrqmE&t=524s' },
        { kind: 'air', name: 'Super Dragon', by: 'Sir Moose Gaming', art: { layers: [{ src: 'assets/troops/super-dragon.webp', x: 30, y: 4, h: 64, flip: true }, { src: 'assets/troops/super-dragon.webp', x: 70, y: 30, h: 64 }] }, summary: "This is the easiest army to play with and requires the least effort to get up and running when you first arrive at TH12.", troops: [], link: 'https://link.clashofclans.com/en/?action=CopyArmy&army=h1e20_17-2m1e41_4-6e49_43i2x53-2x4-1x62d1x98u7x81-1x62-1x52-1x51s3x16-1x2', video: 'https://www.youtube.com/watch?v=DuC3Ti9qukw&t=146s' },
      ],
      tips: [
        {
          title: 'Prioritize offense over defense',
          text: 'Upgrade your offensive buildings (Army Camps, Laboratory and the like) before defensive ones.',
        },
        {
          title: 'You can delay the Workshop',
          text: 'If your clan is active with donations, you can delay building the Workshop.',
        },
      ],
    },
    {
      level: 13,
      image: 'assets/th/th13.webp',
      theme: [60, 206, 206], // teal
      onlyOwnTips: true,
      bases: [
        { name: 'Village base', note: '', by: 'COC Layouts', image: 'assets/bases/th13-village.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH13%3AHV%3AAAAADgAAAALGbaLn3M33DZpUtp8uoqyg' },
        { name: 'War base', note: '', by: 'COC Layouts', image: 'assets/bases/th13-war.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH13%3AWB%3AAAAADgAAAALkEa20eLZkXFtnhO9vrzn3' },
        { name: 'Progress base', note: '', by: 'COC Bases', image: 'assets/bases/th13-progress.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH13%3AHV%3AAAAAHwAAAAJz7eq4erqDPv5sM32oy3sR' },
      ],
      armies: [
        { kind: 'recommended', type: 'air', name: 'Super Yeti Clone Dragons', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 33, y: 10, h: 90 }, { src: 'assets/troops/super-yeti.webp', x: 72, y: 0, h: 88 }, { src: 'assets/troops/clone-spell.webp', x: 10, y: 64, h: 30 }] }, summary: "The recommended army stays the same through TH15, which builds consistency and is proven to work. It is easy to train and doesn't require much planning in the laboratory.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1e17_20-6e43_49-2m1e4_34-4e6_13i1x52-1x147d1x9-1x120u4x5-1x23-2x10-1x82-13x8-1x52s3x16-1x2', video: 'https://www.youtube.com/watch?v=Asl9WtPygIc&t=10s' },
        { kind: 'ground', name: 'Super Witch Smash', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/super-witch.webp', x: 32, y: 0, h: 96 }, { src: 'assets/troops/ice-golem.webp', x: 68, y: 0, h: 88 }] }, summary: "This army can destroy any town hall below TH16 comfortably.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h0e14_8-1e48_39-2e22_24-4e6_13i1x1-1x10-2x84-1x91-1x150d1x109-1x120u1x0-4x1-2x28-3x5-2x6-5x7-1x23-3x66-2x58-1x82-1x97-1x62-1x75-1x87s1x2-2x5-3x35-1x9-3x10', video: 'https://www.youtube.com/watch?v=Asl9WtPygIc&t=1031s' },
        { kind: 'air', name: 'RC Charge Dragons', by: 'The Stealth', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 20, y: 24, h: 70, dim: true }, { src: 'assets/troops/dragon.webp', x: 80, y: 24, h: 70, dim: true, flip: true }, { src: 'assets/troops/royal-champion.webp', x: 50, y: 0, h: 92 }] }, summary: "This is an interesting strategy because it gives a glimpse of what end game attack strategies will look like as you keep upgrading your town hall. Be careful, though: you may fail to finish in time if the attack is executed slowly.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h4e40_13-1e17_20-0e14_32-2e4_24i3x84-1x57-1x1-1x75d2x120u15x8s7x35-1x53-1x9-1x5', video: 'https://www.youtube.com/watch?v=YWRKyjuJa-A&t=466s' },
      ],
      tips: [
        {
          title: 'Upgrade the Royal Champion first',
          text: 'Upgrade her before all your other heroes. She is pretty decent with her starting hero equipment.',
        },
        {
          title: 'Prioritize offense over defense',
          text: 'Upgrade your offensive buildings (Army Camps, Laboratory and the like) before defensive ones.',
        },
        {
          title: 'Upgrades are long here',
          text: 'Everything needs to be upgraded twice. Most players around this town hall either rush to TH16 strategically or do half upgrades before moving on.',
        },
        {
          title: 'Do not completely max TH13',
          text: "If you don't know how pets work in TH14, they get their own separate timer for upgrades (much like the Laboratory). The longer you stay in this town hall maxing, the more time you spend in the next town hall upgrading pets.",
        },
      ],
    },
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
        { kind: 'recommended', type: 'air', name: 'RC Charge Dragons', by: 'Sturge', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 20, y: 24, h: 70, dim: true }, { src: 'assets/troops/dragon.webp', x: 80, y: 24, h: 70, dim: true, flip: true }, { src: 'assets/troops/royal-champion.webp', x: 50, y: 0, h: 92 }] }, summary: "This is the recommended pick because many players get destroyed by the town hall's poison damage plus the other defensive buildings. The RC Charge also helps tame the chaos of attacking higher town halls.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p1e20_17-6p0e42_43-2m1p2e4_34-4p3e6_40i9x5-1x62d1x2-1x5u9x8-3x65-7x5-1x23-3x62s8x35-1x10-1x53', video: 'https://www.youtube.com/watch?v=MqEyKk7kI9M' },
        { kind: 'ground', name: 'Icy Witch Bat', by: 'Sturge', art: { layers: [{ src: 'assets/troops/bat.webp', x: 76, y: 66, h: 17, dim: true }, { src: 'assets/troops/bat.webp', x: 87, y: 50, h: 14, dim: true }, { src: 'assets/troops/bat.webp', x: 66, y: 78, h: 12, dim: true }, { src: 'assets/troops/ice-golem.webp', x: 33, y: 0, h: 88 }, { src: 'assets/troops/witch.webp', x: 68, y: 0, h: 96 }] }, summary: "A nice ground attack that doesn't time fail, and it helps spice up your attack strategy.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p3e20_48-2p2e34_4-0p1e14_8-4p0e13_40i1x53-1x110-1x26-1x87-2x1d2x5-1x120u8x58-10x15-6x6-2x28-1x97-1x87-1x75-1x91s1x2-3x5-1x9-5x28', video: 'https://www.youtube.com/watch?v=MqEyKk7kI9M&t=165s' },
        { kind: 'air', name: 'Super Yeti Clone Dragons', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 33, y: 10, h: 90 }, { src: 'assets/troops/super-yeti.webp', x: 72, y: 0, h: 88 }, { src: 'assets/troops/clone-spell.webp', x: 10, y: 64, h: 30 }] }, summary: "Still a solid fallback if you would like to keep playing the same strategy as before.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p3e17_20-6e42_43-2m1p2e4_34-4p0e6_13i1x147-1x52d1x16u4x5-13x8-1x82-1x23-2x10-1x52s1x2-3x16', video: 'https://www.youtube.com/watch?v=6PZlG-Zx1qo' },
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
        {
          title: 'Place your town hall wisely',
          text: 'From this town hall onwards, the town hall itself becomes too deadly to ignore. It can sometimes prevent attacks from achieving 3 stars because of its poison effect after it is destroyed.',
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
        { kind: 'recommended', type: 'air', name: 'Super Yeti Clone Dragons (Basic)', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 33, y: 10, h: 90 }, { src: 'assets/troops/super-yeti.webp', x: 72, y: 0, h: 88 }, { src: 'assets/troops/clone-spell.webp', x: 10, y: 64, h: 30 }] }, summary: "A free to play friendly army that can be trained up pretty quickly once you get into TH15.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p9e17_48-6p2e49_43-2m1e4_34-7p4e52_60i1x52-1x147d1x16u14x8-1x23-4x5-1x82-2x10s3x16-1x2', video: 'https://www.youtube.com/watch?v=eR4dtyQ3PJ0&t=9s' },
        { kind: 'ground', name: 'Root Riders with Backpack Arrow', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/root-rider.webp', x: 24, y: 0, h: 100 }, { src: 'assets/troops/rocket-backpack.webp', x: 53, y: 40, h: 56 }, { src: 'assets/troops/giant-arrow.webp', x: 75, y: 14, h: 56 }] }, summary: "One of the most fun strategies anyone has ever played in Clash. If you have the epic Rocket Backpack equipment, you should definitely check this one out.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h7p4e57_53-1p9e17_48-2p7e4_24-4p3e40_13i3x63-1x5-1x188d1x120-1x53u5x7-3x5-1x97-4x110-5x12-2x58-4x57-2x1-5x26-1x82-1x75s5x35-1x5-3x10-1x70', video: 'https://www.youtube.com/watch?v=eR4dtyQ3PJ0&t=986s' },
        { kind: 'air', name: 'Super Yeti Clone Dragons (Advance)', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 25, y: 10, h: 90 }, { src: 'assets/troops/super-yeti.webp', x: 79, y: 0, h: 88 }, { src: 'assets/troops/dragon-duke.webp', x: 52, y: 0, h: 100 }, { src: 'assets/troops/clone-spell.webp', x: 9, y: 64, h: 30 }] }, summary: "Shows you what this army can look like with better hero equipment, and it can destroy higher town halls.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p9e17_48-6p2e49_43-2m1e4_34-7p4e52_60i1x52-1x147d1x109-2x120u14x8-1x23-4x5-1x82-2x10s3x16-1x2', video: 'https://www.youtube.com/watch?v=eR4dtyQ3PJ0&t=224s' },
      ],
      tips: [
        {
          title: 'Upgrade the Dragon Duke ASAP',
          text: 'He replaces the Minion Prince and the Barbarian King in your attacks.',
        },
        {
          title: 'Prioritize offense over defense',
          text: 'Upgrade your offensive buildings (Army Camps, Laboratory and the like) before defensive ones. The exceptions are the Spell Towers and the Monolith, which are extremely strong.',
        },
        {
          title: 'Skip the Blacksmith',
          text: "If you have strong epic equipment for your Royal Champion and Dragon Duke, it is highly recommended not to invest in your Blacksmith. It gives you bad common equipment, so it should be the lowest priority on your list. Bonus: if you want your epic equipment to reach level 27, you should upgrade it, but it is highly unlikely you will have enough ore to get past level 26.",
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
    {
      level: 16,
      image: 'assets/th/th16.webp',
      theme: [235, 72, 84], // red
      onlyOwnTips: true,
      bases: [
        { name: 'Village base', note: '', by: 'COC Layouts', image: 'assets/bases/th16-village.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH16%3AHV%3AAAAAEAAAAAK48xKaQHG8JKQ3G48gdnYJ' },
        { name: 'War base', note: '', by: 'GXD', image: 'assets/bases/th16-war.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH16%3AWB%3AAAAAEAAAAALe-fUBf4QAmyjlXXoj21FY' },
        { name: 'Progress base', note: '', by: 'COC Bases', image: 'assets/bases/th16-progress.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH16%3AHV%3AAAAASgAAAAISI09P-WtcDcX_tKxrXg7m' },
      ],
      armies: [
        { kind: 'recommended', type: 'ground', name: 'Thrower Smash', by: 'CorruptYT', art: { layers: [{ src: 'assets/troops/thrower.webp', x: 27, y: 10, h: 68 }, { src: 'assets/troops/thrower.webp', x: 73, y: 10, h: 68 }, { src: 'assets/troops/thrower.webp', x: 50, y: 0, h: 96 }] }, summary: "Throwers may get nerfed soon, but for now they are easily the strongest army. It scales well as you upgrade further to TH17 and can destroy higher level town halls as well.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p11e48_16-0p10e32_14-2p7e4_19-7p4e60_52i1x188-1x135-1x147-1x58d2x120-1x9u5x7-1x109-5x80-2x28-1x58-1x97-2x5-1x23-3x1s2x2-3x35-1x53-1x98', video: 'https://www.youtube.com/watch?v=TY0OnEhIuQY&t=525s' },
        { kind: 'ground', name: 'RC Charge Root Rider with Backpack Arrow', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/royal-champion.webp', x: 16, y: 4, h: 70 }, { src: 'assets/troops/root-rider.webp', x: 38, y: 0, h: 100 }, { src: 'assets/troops/rocket-backpack.webp', x: 62, y: 42, h: 48 }, { src: 'assets/troops/giant-arrow.webp', x: 84, y: 14, h: 50 }] }, summary: "If your attacks are not consistent and you want to guarantee yourself a three star at any town hall, check out this Root Rider strategy combined with the invisible Royal Champion. It is a lot easier to execute if your Spirit Fox is level 10, but if not, you can still get by.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h7p4e52_53-1p9e17_48-2p8e4_24-4p10e40_13i3x63-1x5-1x188d1x120-1x53u5x7-3x5-1x97-4x110-5x12-2x58-4x57-2x1-5x26-1x82-1x75s5x35-1x5-3x10-1x70', video: 'https://www.youtube.com/watch?v=JEM-kTBTmz4&t=985s' },
        { kind: 'air', name: 'Dragon Spam', by: 'CorruptYT', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 23, y: 14, h: 80 }, { src: 'assets/troops/dragon.webp', x: 77, y: 14, h: 80, flip: true }, { src: 'assets/troops/dragon-duke.webp', x: 50, y: 0, h: 100 }] }, summary: "The air army is not the Super Yeti Clone anymore, but there is a simpler version that uses just Dragons and the Dragon Duke. With these troops by your side, you can comfortably turn your brain off and let this army cruise to a 2 star, and sometimes a 3 star.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h7p4e60_52-4p10e12_40-6p11e49_43-2m1p2e4_34i2x188-2x65d1x98-1x9u1x1-2x10-1x76-1x23-6x63-7x65s5x35-2x70-1x2', video: 'https://www.youtube.com/watch?v=TY0OnEhIuQY&t=420s' },
      ],
      tips: [
        {
          title: 'Welcome to the end game',
          text: 'Town Hall 16 is where the end game of Clash of Clans begins. Most of the big decisions are behind you, so now it is all about getting the most out of your heroes, equipment and pets.',
        },
        {
          title: 'Level up the Dragon Duke',
          text: 'He is used in every single army, so it is extremely important to level him up. You cannot go wrong picking the Revenge Deck or the Rocket Backpack for him, as the Dragon Duke pairs so well with everything.',
        },
        {
          title: 'Prioritize offense over defense',
          text: 'Upgrade your offensive buildings (Army Camps, Laboratory and the like) before defensive ones.',
        },
        {
          title: 'Skip the Blacksmith',
          text: "If you have strong epic equipment for your Royal Champion and Dragon Duke, it is highly recommended not to invest in your Blacksmith. It gives you bad common equipment, so it should be the lowest priority on your list.",
        },
        {
          title: 'Clan Castle bait',
          text: 'Upgrading the Clan Castle from level 11 to level 12 is useless. Upgrade it near the end of your time at TH16.',
        },
        {
          title: 'Angry Jelly benched',
          text: 'Angry Jelly is not all that good. Upgrading your Pet House to only level 9 instead of 10 is generally a good idea. You can upgrade the Pet House later.',
        },
        {
          title: 'Spirit Fox is a great pet',
          text: 'Keep this pet on your Royal Champion to conduct a deep attack that can destroy core defenses and create openings for your armies.',
        },
        {
          title: 'No epic equipment?',
          text: "If you haven't been getting any epic equipment so far, you will most likely have to run the Dragon Duke, Royal Champion and Grand Warden with any flexible hero. This composition is strong, but make sure you gather some epic equipment from here on out.",
        },
        {
          title: 'NO RUSHING',
          text: 'After TH16, your base will become significantly weaker, so make sure your defensive buildings are being upgraded. The only exception is special events like Hammer Jam or Summer Jam, where strategic rushing is worth considering.',
        },
        {
          title: 'One eye on the Eagle, one eye on the Monolith',
          text: "These two defensive buildings can easily stop your attack if they aren't dealt with early. If they aren't taken out yet, approach them with caution and always have a plan ready.",
        },
      ],
    },
    {
      level: 17,
      image: 'assets/th/th17.webp',
      theme: [92, 120, 255], // royal blue
      onlyOwnTips: true,
      // Shows a gold * beside "TH17" in the picker and this note under the guide. Put `star: true` on any
      // army, base or tip you are still unsure about and it gets its own * too.
      footnote: "I'm a TH17 player, but I'm still learning everything about it, so this guide may change as I learn more.",
      bases: [
        { name: 'Village base', note: '', by: 'COC Layouts', image: 'assets/bases/th17-village.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH17%3AHV%3AAAAAVwAAAAHXtOcMJ1KXJEqkkaMTNO1s' },
        { name: 'War base', note: '', by: 'Call Me Smoker', image: 'assets/bases/th17-war.jpg', link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH17%3AWB%3AAAAAWAAAAAH2s5fzvyn8MG3sy_CB-NhC' },
        // This one is a COC Bases page (it has the in-game copy link on it), so its button reads "View base".
        { name: 'Progress base', note: '', by: 'COC Bases', image: 'assets/bases/th17-progress.jpg', link: 'https://cocbases.com/town-hall-17/base-id-p9hyn/' },
      ],
      armies: [
        // NOTE: the Dragon picture stands in for the Hydra until a Hydra picture is supplied.
        { kind: 'recommended', type: 'air', name: 'Mass Hydra', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 23, y: 14, h: 80 }, { src: 'assets/troops/dragon.webp', x: 77, y: 14, h: 80, flip: true }, { src: 'assets/troops/dragon-duke.webp', x: 50, y: 0, h: 100 }] }, summary: "Extremely flexible to use with or without epic equipment. Watch the video to find the non-epic equipment army in the description.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p9e17_48-6p4e43_49-2m1p16e4_34-7p11e52_60i2x188-2x5-3x63d1x98-1x9u8x8-5x65-4x57-2x23-1x10-1x1s2x120-2x5-1x70-3x109-1x2', video: 'https://www.youtube.com/watch?v=pFhlymPi6z4&t=10s' },
        { kind: 'ground', name: 'Mass Throwers', by: 'HookedToClash', art: { layers: [{ src: 'assets/troops/thrower.webp', x: 27, y: 10, h: 68 }, { src: 'assets/troops/thrower.webp', x: 73, y: 10, h: 68 }, { src: 'assets/troops/thrower.webp', x: 50, y: 0, h: 96 }] }, summary: "If you use mass Throwers in TH16, it is highly recommended to use them in TH17 too. It is even more insane than the recommended army, but be cautious of a potential nerf to Throwers (this troop is seriously that broken).", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h0p9e14_32-1p3e39_48-2p16e24_5-7p4e52_60i4x5-2x87-1x147d1x98-1x9u5x7-11x132-3x28-1x58-1x82-4x5-2x23-2x6-1x1-2x135-1x188s3x120-2x5-1x17-1x70-3x109', video: 'https://www.youtube.com/watch?v=pFhlymPi6z4&t=772s' },
        { kind: 'air', name: 'Simplified Mass Hydra', by: 'CorruptYT', art: { layers: [{ src: 'assets/troops/dragon.webp', x: 30, y: 12, h: 88 }, { src: 'assets/troops/dragon.webp', x: 70, y: 12, h: 88, flip: true }] }, summary: "If you don't want to research a lot of troops like the ones in the recommended army, run this simplified version of the Dragon spam. The only downside is that you will have to run something other than the Lavaloon for the Grand Warden, because I'm pretty sure no one is going to buy that equipment. You can replace it with any common equipment and get by, or replace one of your troops with another Ice Hound.", troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p9e17_20-6p2e49_43-2m1p16e4_34-7p4e60_53i2x188-1x81-1x63d2x5-1x120u1x76-8x8-5x65-1x23-1x5s1x98-2x120-1x5-1x2-2x70', video: 'https://www.youtube.com/watch?v=KlUrC4fhcNw&t=331s' },
      ],
      tips: [
        {
          title: 'Prioritize offense over defense',
          text: 'Upgrade your offensive buildings (Army Camps, Laboratory and the like) before defensive ones.',
        },
        {
          title: 'Not every defense upgrade is worth it',
          text: "From this town hall onwards, you need to tell the amazing defense upgrades from the bad ones. More likely than not, the merged defensive buildings are way better than the non-merged ones. The only exceptions are the Monolith and the Inferno Towers, which are still beasts at this town hall.",
        },
        {
          title: 'Dragon Duke before every other hero',
          text: 'Your Dragon Duke is still overpowered, so always prioritize him over your other heroes. He is just too strong.',
        },
        {
          title: 'Focus on Frosty, Diggy and the Unicorn',
          text: 'The new Sneezy is a decent pet, but other than that, put all of your time and investment into Frosty, Diggy and the Unicorn.',
        },
      ],
    },
  ],
};
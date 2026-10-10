// ===========================================================================
// GUIDE CONTENT — this is the only file you need to edit to fill in the guide.
//
//  * Add a town hall: copy one block in `townHalls`, change `level`, and put its
//    picture at assets/th/th<level>.png. Set `soon: true` to show it greyed out.
//  * Bases: give each one a `link` (the "copy base" link from the game, which
//    starts with https://link.clashofclans.com/) and, optionally, an `image`
//    (path like "assets/bases/th14-1.png"). With no link it shows "link coming soon".
//  * Armies: at most 3 per town hall: one `ground`, one `air`, one `recommended`.
//    `type` on the recommended army is "air" or "ground" (shows a blue AIR or
//    orange GROUND tag next to RECOMMENDED); leave it null for no tag.
//    `by` is the creator's name, `video` a YouTube link, and
//    `link` is the game's "copy army" link. `troops` is a list like
//    [{ name: "Electro Dragon", count: 8 }, ...] (leave [] until you know it).
//  * Tips: `generalTips` show on every town hall; a town hall's own `tips` are
//    added after them.
// ===========================================================================
window.GUIDE_DATA = {
  generalTips: [
    {
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
  ],

  townHalls: [
    {
      level: 14,
      image: 'assets/th/th14.png',
      bases: [
        { name: 'Village base', note: '', by: 'COC Layouts', image: null, link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH14%3AHV%3AAAAAQAAAAAJaylAU8C9KEr_3IIxmptIW' },
        { name: 'War base', note: '', by: '-CRIMSON-', image: null, link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH14%3AWB%3AAAAAQAAAAAJeLOaSHi2NcHAiHclV7cCQ' },
        { name: 'Progress base', note: '', by: 'COC Bases', image: null, link: 'https://link.clashofclans.com/en/?action=OpenLayout&id=TH14%3AHV%3AAAAAHwAAAAKiS60K7p0yxeED25PQ6NEA' },
      ],
      armies: [
        { kind: 'recommended', type: 'air', name: 'RC Charge Dragons', by: 'Sturge', summary: 'Guarantees you consistent 3 stars.', troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p1e20_17-6p0e42_43-2m1p2e4_34-4p3e6_40i9x5-1x62d1x2-1x5u9x8-3x65-7x5-1x23-3x62s8x35-1x10-1x53', video: 'https://www.youtube.com/watch?v=MqEyKk7kI9M' },
        { kind: 'ground', name: 'Icy Witch Bat', by: 'Sturge', summary: '', troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p3e20_48-2p2e34_4-0p1e14_8-4p0e13_40i1x53-1x110-1x26-1x87-2x1d2x5-1x120u8x58-10x15-6x6-2x28-1x97-1x87-1x75-1x91s1x2-3x5-1x9-5x28', video: 'https://www.youtube.com/watch?v=MqEyKk7kI9M&t=165s' },
        { kind: 'air', name: 'Clone Dragons', by: 'HookedToClash', summary: '', troops: [], link: 'https://link.clashofclans.com/en?action=CopyArmy&army=h1p3e17_20-6e42_43-2m1p2e4_34-4p0e6_13i1x147-1x52d1x16u4x5-13x8-1x82-1x23-2x10-1x52s1x2-3x16', video: 'https://www.youtube.com/watch?v=6PZlG-Zx1qo' },
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
      image: 'assets/th/th15.png',
      bases: [
        { name: 'Village base', note: '', by: '', image: null, link: null },
        { name: 'War base', note: '', by: '', image: null, link: null },
        { name: 'Progress base', note: '', by: '', image: null, link: null },
      ],
      armies: [
        { kind: 'recommended', type: null, name: 'Recommended army', by: '', summary: 'Guarantees you consistent 3 stars.', troops: [], link: null, video: null },
        { kind: 'ground', name: 'Ground army', by: '', summary: '', troops: [], link: null, video: null },
        { kind: 'air', name: 'Air army', by: '', summary: '', troops: [], link: null, video: null },
      ],
      tips: [],
    },
    { level: 16, image: 'assets/th/th16.png', soon: true },
    { level: 17, image: 'assets/th/th17.png', soon: true },
  ],
};

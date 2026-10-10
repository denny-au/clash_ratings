// ===========================================================================
// GUIDE CONTENT — this is the only file you need to edit to fill in the guide.
//
//  * Add a town hall: copy one block in `townHalls`, change `level`, and put its
//    picture at assets/th/th<level>.png. Set `soon: true` to show it greyed out.
//  * Bases: give each one a `link` (the "copy base" link from the game, which
//    starts with https://link.clashofclans.com/) and, optionally, an `image`
//    (path like "assets/bases/th14-1.png"). With no link it shows "link coming soon".
//  * Armies: at most 3 per town hall: one `ground`, one `air`, one `recommended`.
//    `variantOf` on the recommended army says which of the other two it is a
//    small variation of ("ground" or "air"); leave it null if it stands alone.
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
        { name: 'Base 1', note: '', image: null, link: null },
        { name: 'Base 2', note: '', image: null, link: null },
        { name: 'Base 3', note: '', image: null, link: null },
      ],
      armies: [
        { kind: 'recommended', name: 'Recommended army', variantOf: null, summary: '', troops: [], link: null },
        { kind: 'ground', name: 'Ground army', summary: '', troops: [], link: null },
        { kind: 'air', name: 'Air army', summary: '', troops: [], link: null },
      ],
      tips: [],
    },
    {
      level: 15,
      image: 'assets/th/th15.png',
      bases: [
        { name: 'Base 1', note: '', image: null, link: null },
        { name: 'Base 2', note: '', image: null, link: null },
        { name: 'Base 3', note: '', image: null, link: null },
      ],
      armies: [
        { kind: 'recommended', name: 'Recommended army', variantOf: null, summary: '', troops: [], link: null },
        { kind: 'ground', name: 'Ground army', summary: '', troops: [], link: null },
        { kind: 'air', name: 'Air army', summary: '', troops: [], link: null },
      ],
      tips: [],
    },
    { level: 16, image: 'assets/th/th16.png', soon: true },
    { level: 17, image: 'assets/th/th17.png', soon: true },
  ],
};

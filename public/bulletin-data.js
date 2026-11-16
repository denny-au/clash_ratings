// The Bulletin tab reads its posts from this list. Newest first.
//
// To add a post: copy one block, paste it at the TOP of the list, edit the text, save and push.
// To remove a post (e.g. when an event ends): delete its block.
//
// Each post:
//   title     – the headline (required)
//   date      – "YYYY-MM-DD" (shown as e.g. "4 Nov 2026"), or just "YYYY-MM" when the day is not known yet (shown as "Nov 2026")
//   label     – optional small tag next to the date, e.g. "Event", "Balance change", "Special"
//   image     – optional picture under the headline: a file inside public/assets/ or an https:// link
//   imageAlt  – short description of the picture (for screen readers)
//   body      – optional list of paragraphs (each one a line of text in quotes)
//   list      – optional bullet points shown under the paragraphs
//   sections  – optional numbered tips, each a closed dropdown (tap the headline to open), each with:
//                 title   – the section headline (required)
//                 text    – optional paragraph (or a list of paragraphs). A link inside text is written [label](https://...) and shows iridescent + underlined
//                 art     – optional picture at the top of the tip: { image: 'assets/...', alt: 'what it shows' }; add behind: [ {image, alt}, {image, alt} ] to tuck one picture behind it on each side, or beside: {image, alt} to stand a second picture next to it
//                 podium  – optional picture podium: up to 3 items { image: 'assets/...', label: 'Name' }, listed 1st, 2nd, 3rd
//                 points  – optional bullet points
//                 links   – optional list of { label: 'text', url: 'https://...' }
//
// Plain text only (no HTML). Keep every item inside quotes and end each with a comma.
window.CR_BULLETIN = [
  {
    title: 'TH19 Update',
    date: '2026-11-16',
    label: 'Update',
    sections: [
      {
        title: 'Squads',
        text: [
          'A new attack mechanic is here! With squads, you tap a single squad icon and it summons several troops at once: either multiple troops of the same type, or a mix of troops that work well together. Every squad also comes with a nice bonus.',
          'Squads are WAY better than summoning single troops multiple times in a row.',
        ],
      },
      {
        title: 'Firecracker Tower and Spiky Tower',
        text: [
          'The Firecracker Tower deals an explosion, followed by piercing damage that trails after the first blast (a bit like Clash Royale).',
          'The Spiky Tower attacks whichever troop attacks the building. Think of it as a mix of the Revenge Deck and the Monolith, with its percentage-style damage.',
        ],
      },
      {
        title: 'Heroic Spell',
        text: 'It works a lot like the Heroic Torch. Troops inside the spell circle phase through walls and get more damage and more defense for a short time.',
      },
      {
        title: 'Cheaper and faster upgrades',
        text: 'All the reductions in cost and time apply to every town hall below 19, not just to TH19.',
      },
    ],
  },
];
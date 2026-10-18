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
//                 text    – optional paragraph (or a list of paragraphs)
//                 art     – optional single picture at the top of the tip: { image: 'assets/...', alt: 'what it shows' }
//                 podium  – optional picture podium: up to 3 items { image: 'assets/...', label: 'Name' }, listed 1st, 2nd, 3rd
//                 points  – optional bullet points
//                 links   – optional list of { label: 'text', url: 'https://...' }
//
// Plain text only (no HTML). Keep every item inside quotes and end each with a comma.
window.CR_BULLETIN = [
  {
    title: 'Hammer Jam',
    date: '2026-11',
    label: 'Event',
    image: 'assets/bulletin/hammer-jam.jpg',
    imageAlt: 'Hammer Jam event art: a Builder raising a glowing blue hammer while meteors streak across the sky',
    sections: [
      {
        title: 'Builder Potions are king',
        podium: [
          { image: 'assets/bulletin/potion-builder.png', label: 'Builder Potion' },
          { image: 'assets/bulletin/potion-research.png', label: 'Research Potion' },
          { image: 'assets/bulletin/potion-pet.png', label: 'Pet Potion' },
        ],
        text: [
          'Invest in these potions in this order: Builder Potion first, then Research Potion, then Pet Potion.',
          'During Hammer Jam, Builder Potions are so overpowered that choosing another potion without a good reason could set you back weeks of progress. If you are below TH17, use nothing but Builder Potions to rush.',
        ],
      },
      {
        title: 'Spending your CWL medals',
        art: { image: 'assets/bulletin/cwl-medal.png', alt: 'Clan War League medal' },
        text: [
          'Clan War League (CWL) medals let you buy whatever you want, but the most useful item during Hammer Jam is the Builder Potion.',
          'Many players buy 1 hammer before the event starts, but think carefully: that means saying goodbye to 4 Builder Potions, or about 18 days of progress.',
        ],
      },
      {
        title: 'Save your raid medals for research potions and pet potions',
        points: ['Prioritize research potions over pet potions, unless you desperately need a certain level on one of your pets (Spirit Fox level 10, for example).'],
      },
      {
        title: 'Goblin Builder or Goblin Researcher',
        text: 'If you plan on using the Goblin Builder or the Goblin Researcher, you might need around 1,000-2,000 gems to keep either one going throughout the event.',
        points: ['If you had to choose one, pick the Goblin Builder. The Goblin Researcher is also good, and gets better the higher your town hall is.'],
      },
      {
        title: 'P2P: Supercell ID Rewards',
        text: 'Supercell ID Rewards stack up on a separate website (id.supercell.com) whenever you purchase an item. Be sure to take advantage of the potions there during the event.',
        points: [
          'The shop offers many builder potions during this time, and some are worth buying. Offers under $10 that give out a lot of builder potions are worth considering.',
          'Keep in mind that the more you spend, the more Supercell may charge you for the next bundle. For example, if you spend $5-10 a week, they may start charging $15-20 and ramp up slowly from there. Be careful with how you spend your money.',
        ],
        links: [{ label: 'id.supercell.com', url: 'https://id.supercell.com' }],
      },
      {
        title: 'The 6th builder, B.O.B. the Builder',
        text: 'You will need to rush your Builder Base for him. It normally takes about 2 months to unlock him, and some people report 3 months, depending on how you get there.',
        links: [{ label: 'Video guide by DrewTookMyName', url: 'https://www.youtube.com/watch?v=1_-3_C3wI2M' }],
      },
      {
        title: 'Your resources will drain fast',
        text: 'During the event you will run out of resources extremely quickly. Use any fun army you like, or go with sneaky goblin or E-dragon armies. Do not be afraid to 1-star: your time in Hammer Jam is all about improving your base!',
      },
    ],
  },
];

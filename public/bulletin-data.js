// The Bulletin tab reads its posts from this list. Newest first.
//
// To add a post: copy one block, paste it at the TOP of the list, edit the text, save and push.
// To remove a post (e.g. when an event ends): delete its block.
//
// Each post:
//   title     – the headline (required)
//   date      – "YYYY-MM-DD" (required; shown as e.g. "17 Oct 2026")
//   label     – optional small tag next to the date, e.g. "Event", "Balance change", "Special"
//   image     – optional picture under the headline: a file inside public/assets/ or an https:// link
//   imageAlt  – short description of the picture (for screen readers)
//   body      – optional list of paragraphs (each one a line of text in quotes)
//   list      – optional bullet points shown under the paragraphs
//   sections  – optional numbered sections, each with:
//                 title   – the section headline (required)
//                 text    – optional paragraph
//                 points  – optional bullet points
//                 links   – optional list of { label: 'text', url: 'https://...' }
//
// Plain text only (no HTML). Keep every item inside quotes and end each with a comma.
window.CR_BULLETIN = [
  {
    title: 'Hammer Jam',
    date: '2026-10-17',
    label: 'Event',
    image: 'assets/site/hammer-jam.jpg',
    imageAlt: 'Hammer Jam event art: a Builder raising a glowing blue hammer while meteors streak across the sky',
    body: ['50% off upgrade time and cost, and double production. Here is how to get the most out of it.'],
    list: [
      '-50% upgrade time and cost (all town halls)',
      '2x collector production and capacity',
      'Supercharges and crafted defenses are not included',
    ],
    sections: [
      {
        title: 'Builder Potions are king',
        text: 'They are the most valuable item during Hammer Jam. Research and pet potions are also good during the event, but builder potions save double the amount of time.',
        points: [
          'Here is how much value that is: with 6 builders, a single builder potion normally saves 54 hours, but during Hammer Jam it saves 108. Put those hours into upgrades that already take half the time, and anyone below TH17 can blast through the next town hall during the event.',
          'TL;DR: if you are below TH17, rushing 1-2 town halls above you with builder potions is 100% recommended.',
        ],
      },
      {
        title: 'Do not spend CWL medals unless you are about to hit the limit you can hold',
        points: [
          'Builder potions are the top priority.',
          'Research potions are fine to use. Definitely invest in them if you want to train up a particular army, but do not go out of your way to max out everything in the lab.',
          'Hammers are decent, but do not over-invest in them. Most people use 1 hammer on their town hall to rush it, but that only applies at TH15 and above. Below that, I recommend sticking with builder potions.',
        ],
      },
      {
        title: 'Save your raid medals for research potions and pet potions',
      },
      {
        title: 'Goblin Builder or Researcher',
        text: 'If you plan on using the Goblin Builder or the Researcher, you might need around 1,000-2,000 gems to keep them going throughout the event.',
        points: ['If you had to choose one, pick the Goblin Builder. The Researcher is also good, and gets better the higher your town hall is.'],
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

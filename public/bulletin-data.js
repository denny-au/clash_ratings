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
        title: 'Save your CWL medals',
        art: {
          image: 'assets/bulletin/cwl-medal.png',
          alt: 'Clan War League medal',
          behind: [
            { image: 'assets/bulletin/builder-hammer.png', alt: 'Hammer' },
            { image: 'assets/bulletin/potion-builder.png', alt: 'Builder Potion' },
          ],
        },
        text: [
          'Only spend your Clan War League (CWL) medals during Hammer Jam, and spend them on Builder Potions above all. They are the most useful item you can buy.',
          'Many players buy 1 hammer before the event starts, but think carefully: that means saying goodbye to 4 Builder Potions, or about 18 days of progress.',
        ],
      },
      {
        title: 'Save your raid medals',
        art: {
          image: 'assets/bulletin/raid-medal.png',
          alt: 'Raid medal',
          behind: [
            { image: 'assets/bulletin/potion-research.png', alt: 'Research Potion' },
            { image: 'assets/bulletin/potion-pet.png', alt: 'Pet Potion' },
          ],
        },
        text: [
          'Save your raid medals the same way you save your CWL medals. The only things worth buying with them are Research Potions and Pet Potions.',
          'Prioritize Research Potions over Pet Potions, unless you desperately need a certain level on one of your pets (Spirit Fox level 10, for example).',
        ],
      },
      {
        title: 'Goblin Builder / Goblin Researcher',
        art: {
          image: 'assets/bulletin/goblin.png',
          alt: 'Goblin',
          beside: { image: 'assets/bulletin/gem-chest.png', alt: 'Chest of gems' },
        },
        text: [
          'If you plan on using a goblin, expect to spend around 1,000-2,000 gems to keep it working throughout the event. Running both the Goblin Builder and the Goblin Researcher means paying that much twice.',
          'If you can only choose one, go with the Goblin Builder. The Goblin Researcher is only a decent pick once you reach a higher town hall level.',
        ],
      },
      {
        title: 'Is your pocket feeling breezy?',
        art: { image: 'assets/bulletin/barbarian.png', alt: 'Barbarian scratching his chin' },
        text: [
          'If you have been spending, your Supercell ID Rewards stack up on [id.supercell.com](https://id.supercell.com). Be sure to buy potions on that site before you buy more bundle deals in the shop.',
          'Keep in mind that the more you spend, the more Supercell may charge you for the next bundle. For example, if you spend $5-10 a week, they may start charging $15-20 and ramp up slowly from there. Be careful with how you spend your money.',
          'A good rule of thumb for telling a deal from a scam: value every potion at 50 cents and every book at 2 dollars. If you get 5 builder potions for 1 dollar, that is pretty good. If you have to pay 5 dollars for 2 builder potions and 1 book of heroes, that is a scam.',
        ],
      },
      {
        title: 'The 6th builder, B.O.B. the Builder',
        art: { image: 'assets/bulletin/bob.png', alt: 'B.O.B. the Builder' },
        text: [
          'You will need to rush your Builder Base for him. It normally takes about 2-3 months to unlock him.',
          'Here is a helpful guide: [Video guide by DrewTookMyName](https://www.youtube.com/watch?v=1_-3_C3wI2M)',
        ],
      },
      {
        title: 'Your resources will drain fast',
        art: { image: 'assets/bulletin/collectors.png', alt: 'Gold mine, Elixir collector and Dark Elixir drill' },
        text: 'During the event you will run out of resources extremely quickly. Use any fun army you like, or go with sneaky goblin or E-dragon armies. Do not be afraid to 1-star: your time in Hammer Jam is all about improving your base!',
      },
    ],
  },
];

// The Bulletin tab reads its posts from this list. Newest first.
//
// To add a post: copy one block, paste it at the TOP of the list, edit the text, save and push.
// To remove a post (e.g. when an event ends): delete its block.
//
// Each post:
//   title  – the headline (required)
//   date   – "YYYY-MM-DD" (required; shown as e.g. "4 Oct 2026")
//   label  – optional small tag next to the date, e.g. "Event", "Balance change", "Special"
//   body   – list of paragraphs (each one a line of text in quotes)
//   list   – optional bullet points shown under the paragraphs
//
// Plain text only (no HTML). Keep every item inside quotes and end each with a comma.
window.CR_BULLETIN = [
  {
    title: 'Sample post (replace me)',
    date: '2026-10-04',
    label: 'Sample',
    body: [
      'This is a placeholder so you can see how a Bulletin post looks. Edit bulletin-data.js to replace it with your real Hammer Jam post.',
    ],
    list: ['Add the dates here', 'Add what members should do here'],
  },
];

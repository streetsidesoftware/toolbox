import * as md from '@streetsidesoftware/markdown-toolkit';

// From the dictionary's own docs, already written as Markdown.
const about =
  'Adds **Dutch** words. See [cspell.org](https://cspell.org).';

const page = md.document(md.heading(2, 'About'), md.parse(about));

console.log(page.toString());

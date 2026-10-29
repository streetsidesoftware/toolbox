import * as md from '@streetsidesoftware/markdown-toolkit';

const commands = [
  { command: 'cSpell.addWordToDictionary', title: 'Add Words to Dictionary' },
  { command: 'cSpell.toggleEnableSpellChecker', title: 'Toggle Spell Checking', when: 'editorTextFocus' },
];

const doc = md.document(
  md.heading(2, 'Commands'),
  md.table(
    ['Command', 'Title'],
    commands.map((c) => [
      md.inlineCode(c.command),
      c.when ? [c.title, md.lineBreak(), md.strong('When:'), ' ', md.inlineCode(c.when)] : c.title,
    ]),
  ),
);

process.stdout.write(doc.toString());

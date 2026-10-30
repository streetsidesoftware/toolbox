import * as md from '@streetsidesoftware/markdown-toolkit';

const dictionaries = {
  Languages: ['Dutch', 'French', 'German'],
  Programming: ['Python', 'Rust', 'TypeScript'],
};

const page = md.document(
  md.list(
    Object.entries(dictionaries).map(([group, names]) => [
      group,
      md.list(names),
    ]),
  ),
  md.p('To add one:'),
  md.ol(['Install the dictionary.', 'Add it to the config.']),
);

console.log(page.toString());

import * as md from '@streetsidesoftware/markdown-toolkit';

const readme = md.template(
  `## {@ name @}

Install with \`npm i {@ name @}\`, then see {@ docs @}.

{@ features @}
`,
  {
    name: 'my_package*',
    docs: md.link('the docs', 'https://example.com'),
    features: md.list(['Fast', ['Escapes ', md.inlineCode('*'), ' for you']]),
  },
);

console.log(readme.toString());

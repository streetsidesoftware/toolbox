import {
  createUnindent,
  unindent,
} from '@streetsidesoftware/unindent';

const trimmedUnindent = createUnindent({
  trimFirstNewline: true,
  trimLastLine: true,
});

const untrimmed = unindent`
  Could not read config.json.
  Run tool init to create one.
`;

const trimmed = trimmedUnindent`
  Could not read config.json.
  Run tool init to create one.
`;

console.log(JSON.stringify(untrimmed));
console.log(JSON.stringify(trimmed));

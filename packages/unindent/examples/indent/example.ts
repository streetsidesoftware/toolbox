import { indent } from '@streetsidesoftware/unindent';

const changes = [
  'Fix a crash on empty input.\nIt now returns an empty string.',
  'Add `indent`.',
];

const items = changes.map((change) => indent(change, '  ', '- '));

console.log(items.join('\n'));

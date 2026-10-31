import {
  createUnindent,
  unindent,
} from '@streetsidesoftware/unindent';

const trimmed = createUnindent({
  trimFirstNewline: true,
  trimLastLine: true,
});

const kept = unindent`
  #!/bin/sh
  echo "Hello"
`;

const script = trimmed`
  #!/bin/sh
  echo "Hello"
`;

console.log(JSON.stringify(kept));
console.log(JSON.stringify(script));

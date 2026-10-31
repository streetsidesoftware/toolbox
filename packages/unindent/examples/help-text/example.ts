import { unindent } from '@streetsidesoftware/unindent';

const HELP = unindent`\
  Usage: tool [options] <file>

  Options:
    -h, --help     Show help.
    -o, --out DIR  Write the result to DIR.
`;

process.stdout.write(HELP);

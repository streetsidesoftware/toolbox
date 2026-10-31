import { unindent } from '@streetsidesoftware/unindent';

const steps = ['pnpm install', 'pnpm test'].join('\n');

const workflow = unindent`\
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - run: |
            ${steps}
`;

process.stdout.write(workflow);

import { unindent } from '@streetsidesoftware/unindent';

// Lines copied out of an indented function.
const snippet = '    if (ok) {\n      run();\n    }';

console.log(unindent(snippet));

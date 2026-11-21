import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { testEach } from '@streetsidesoftware/test-each';

import { run } from './run.ts';

interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

async function call(args: string[], stdin: string | AsyncIterable<string> = ''): Promise<Result> {
  const result = { code: 0, stdout: '', stderr: '' };
  result.code = await run(args, {
    stdin: typeof stdin === 'string' ? Readable.from([stdin]) : stdin,
    stdout: (text) => (result.stdout += text),
    stderr: (text) => (result.stderr += text),
  });
  return result;
}

let dir = '';

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'markdown-sanitizer-'));
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function file(name: string, content: string | Uint8Array): Promise<string> {
  const filePath = path.join(dir, name);
  await writeFile(filePath, content);
  return filePath;
}

describe('check', () => {
  test('lists hidden text in a file and exits with 1', async () => {
    const name = await file('hidden.md', 'Fix.\n\n<!-- secret -->\n');
    assert.deepEqual(await call(['check', name]), {
      code: 1,
      stdout: `${name}:3:1 comment "<!-- secret -->"\n`,
      stderr: '',
    });
  });

  test('prints nothing and exits with 0 when nothing is hidden', async () => {
    const name = await file('clean.md', 'Fix the parser.\n');
    assert.deepEqual(await call(['check', name]), { code: 0, stdout: '', stderr: '' });
  });

  test('reads standard input when no file is given', async () => {
    assert.deepEqual(await call(['check'], 'a <!-- x -->'), {
      code: 1,
      stdout: '<stdin>:1:3 comment "<!-- x -->"\n',
      stderr: '',
    });
  });

  test('checks every file given', async () => {
    const first = await file('first.md', '<!-- a -->');
    const second = await file('second.md', 'clean');
    const third = await file('third.md', '<!-- c -->');
    const { code, stdout } = await call(['check', first, second, third]);
    assert.equal(code, 1);
    assert.equal(stdout, `${first}:1:1 comment "<!-- a -->"\n${third}:1:1 comment "<!-- c -->"\n`);
  });

  testEach`
    name                          | markdown                      | quoted
    ${'line breaks'}              | ${'<!-- a\nb -->'}            | ${'"<!-- a\\nb -->"'}
    ${'tag characters'}           | ${'a\u{E0041}\u{E0042} b'}    | ${'"\\u{E0041}\\u{E0042}"'}
    ${'variation selectors'}      | ${'a\u{FE00}\u{FE01} b'}      | ${'"\\u{FE00}\\u{FE01}"'}
    ${'a zero-width space'}       | ${'<!-- a\u{200B}b -->'}      | ${'"<!-- a\\u{200B}b -->"'}
    ${'a delete character'}       | ${'<!-- a\u{7F}b -->'}        | ${'"<!-- a\\u{7F}b -->"'}
    ${'a C1 control'}             | ${'<!-- a\u{9B}b -->'}        | ${'"<!-- a\\u{9B}b -->"'}
    ${'an escape character'}      | ${'<!-- a\u{1B}b -->'}        | ${'"<!-- a\\u{1B}b -->"'}
    ${'a line separator'}         | ${'<!-- a\u{2028}b -->'}      | ${'"<!-- a\\u{2028}b -->"'}
    ${'a default ignorable'}      | ${'<!-- a\u{34F}b -->'}       | ${'"<!-- a\\u{34F}b -->"'}
    ${'quotes and backslashes'}   | ${'<!-- "a\\b" -->'}         | ${'"<!-- \\"a\\\\b\\" -->"'}
  `('shows $name as escapes', async ({ markdown, quoted }: { markdown: string; quoted: string }) => {
    const { stdout } = await call(['check'], markdown);
    assert.equal(stdout.slice(stdout.indexOf('"')), `${quoted}\n`);
  });
});

test('check escapes the file name', async () => {
  const name = await file('a\u{202E}b.md', '<!-- x -->');
  const { stdout } = await call(['check', name]);
  assert.equal(stdout, `${name.replace('\u{202E}', '\\u{202E}')}:1:1 comment "<!-- x -->"\n`);
});

describe('remove and reveal', () => {
  test('prints the Markdown without the hidden text', async () => {
    const name = await file('remove.md', 'Fix the <!-- secret --> parser.');
    assert.deepEqual(await call(['remove', name]), { code: 0, stdout: 'Fix the  parser.', stderr: '' });
  });

  test('prints the Markdown with the hidden text shown as code', async () => {
    const name = await file('reveal.md', 'Fix the <!-- secret --> parser.');
    assert.deepEqual(await call(['reveal', name]), {
      code: 0,
      stdout: 'Fix the `<!-- secret -->` parser.',
      stderr: '',
    });
  });

  test('prints the result for each file, in order', async () => {
    const first = await file('one.md', 'a <!-- x -->\n');
    const second = await file('two.md', 'b\n');
    assert.equal((await call(['remove', first, second])).stdout, 'a \nb\n');
  });

  test('reads standard input when no file is given', async () => {
    assert.equal((await call(['remove'], 'a <!-- x --> b')).stdout, 'a  b');
  });

  test('replaces each file with --write', async () => {
    const first = await file('write-one.md', 'a <!-- x --> b');
    const second = await file('write-two.md', 'c <!-- y --> d');
    assert.deepEqual(await call(['remove', '--write', first, second]), { code: 0, stdout: '', stderr: '' });
    assert.equal(await readFile(first, 'utf8'), 'a  b');
    assert.equal(await readFile(second, 'utf8'), 'c  d');
  });

  test('replaces each file with the revealed text with reveal --write', async () => {
    const name = await file('reveal-write.md', 'a <!-- x --> b');
    assert.deepEqual(await call(['reveal', '--write', name]), { code: 0, stdout: '', stderr: '' });
    assert.equal(await readFile(name, 'utf8'), 'a `<!-- x -->` b');
  });

  test('leaves a file that hides nothing unwritten', async () => {
    const name = await file('unchanged.md', 'c');
    await chmod(name, 0o444);
    assert.deepEqual(await call(['remove', '--write', name]), { code: 0, stdout: '', stderr: '' });
  });

  test('reports a file it cannot write', async () => {
    const name = await file('read-only.md', 'a <!-- x --> b');
    await chmod(name, 0o444);
    assert.deepEqual(await call(['remove', '--write', name]), {
      code: 2,
      stdout: '',
      stderr: `markdown-sanitizer: ${name}: the file must be writable\n`,
    });
  });

  test('leaves every file as it was when one input fails', async () => {
    const name = await file('kept.md', 'a <!-- x --> b');
    const { code } = await call(['remove', '--write', name, path.join(dir, 'missing.md')]);
    assert.equal(code, 2);
    assert.equal(await readFile(name, 'utf8'), 'a <!-- x --> b');
  });
});

describe('input', () => {
  test('reports bytes that are not UTF-8 and leaves the file as it was', async () => {
    const bytes = Buffer.from('Caf\xE9 <!-- x -->', 'latin1');
    const name = await file('latin1.md', bytes);
    assert.deepEqual(await call(['remove', '--write', name]), {
      code: 2,
      stdout: '',
      stderr: `markdown-sanitizer: ${name}: input must be UTF-8\n`,
    });
    assert.deepEqual(await readFile(name), bytes);
  });

  test('reports a directory', async () => {
    const name = path.join(dir, 'folder');
    await mkdir(name);
    assert.deepEqual(await call(['check', name]), {
      code: 2,
      stdout: '',
      stderr: `markdown-sanitizer: ${name}: must be a readable file\n`,
    });
  });

  test('reads a file named like an option after --', async () => {
    const name = await file('--write', '<!-- x -->');
    const { code, stdout } = await call(['check', '--', name]);
    assert.equal(code, 1);
    assert.equal(stdout, `${name}:1:1 comment "<!-- x -->"\n`);
  });
});

describe('limits', () => {
  test('stops at --max-size for a file', async () => {
    const name = await file('large.md', 'x'.repeat(11));
    assert.deepEqual(await call(['check', '--max-size', '10', name]), {
      code: 2,
      stdout: '',
      stderr: `markdown-sanitizer: ${name}: input must be at most 10 bytes, the --max-size limit\n`,
    });
  });

  test('stops at --max-size for standard input', async () => {
    const { code, stderr } = await call(['check', '--max-size', '10'], 'x'.repeat(11));
    assert.equal(code, 2);
    assert.match(stderr, /<stdin>: input must be at most 10 bytes/);
  });

  test('stops at --max-size for standard input in several chunks', async () => {
    const { code, stderr } = await call(['check', '--max-size', '9'], Readable.from(['aaaa', 'bbbb', 'cc']));
    assert.equal(code, 2);
    assert.match(stderr, /<stdin>: input must be at most 9 bytes/);
  });

  test('stops reading an endless input at --max-size', async () => {
    async function* endless(): AsyncGenerator<string> {
      for (;;) yield 'x'.repeat(1000);
    }
    assert.equal((await call(['check', '--max-size', '100000'], endless())).code, 2);
  });

  test('takes a --max-size past the largest safe integer', async () => {
    assert.equal((await call(['check', '--max-size', '99999999999999999999'], 'x')).code, 0);
  });

  test('takes a --max-size with leading zeros', async () => {
    assert.equal((await call(['check', '--max-size', '0010'], 'x'.repeat(10))).code, 0);
  });

  test('takes input up to --max-size', async () => {
    assert.equal((await call(['check', '--max-size', '10'], 'x'.repeat(10))).code, 0);
  });

  test('takes input up to 10 MB by default', async () => {
    assert.equal((await call(['check'], 'x'.repeat(10_000_000))).code, 0);
    assert.equal((await call(['check'], 'x'.repeat(10_000_001))).code, 2);
  });
});

describe('wrong calls', () => {
  testEach`
    name                              | args                                 | message
    ${'no command'}                   | ${[]}                                | ${'the command must be check, remove or reveal'}
    ${'an unknown command'}           | ${['clean']}                         | ${'the command must be check, remove or reveal'}
    ${'an unknown option'}            | ${['check', '--fix']}                | ${'options must be --write, --max-size <bytes> or --help'}
    ${'--write with check'}           | ${['check', '--write', 'a.md']}      | ${'--write works only with remove and reveal'}
    ${'--write without a file'}       | ${['remove', '--write']}             | ${'--write needs at least one file'}
    ${'a --max-size of 0'}            | ${['check', '--max-size', '0']}      | ${'--max-size must be a whole number of bytes, at least 1'}
    ${'a --max-size with a unit'}     | ${['check', '--max-size', '5MB']}    | ${'--max-size must be a whole number of bytes, at least 1'}
    ${'a missing file'}               | ${['check', 'missing.md']}           | ${'missing.md: must be a readable file'}
  `('reports $name and exits with 2', async ({ args, message }: { args: string[]; message: string }) => {
    assert.deepEqual(await call(args), { code: 2, stdout: '', stderr: `markdown-sanitizer: ${message}\n` });
  });

  testEach`
    flag
    ${'--help'}
    ${'-h'}
  `('shows the help with $flag', async ({ flag }: { flag: string }) => {
    const { code, stdout } = await call([flag]);
    assert.equal(code, 0);
    assert.match(stdout, /^Usage: markdown-sanitizer <command>/);
  });
});

test('runs as a command', () => {
  const bin = fileURLToPath(new URL('../bin.ts', import.meta.url));
  const { status, stdout } = spawnSync(process.execPath, [bin, 'check'], { input: 'a <!-- x -->', encoding: 'utf8' });
  assert.equal(status, 1);
  assert.equal(stdout, '<stdin>:1:3 comment "<!-- x -->"\n');
});

test('stops quietly when the reader closes the pipe early', async () => {
  const bin = fileURLToPath(new URL('../bin.ts', import.meta.url));
  const child = spawn(process.execPath, [bin, 'check']);
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  child.stdout.once('data', () => child.stdout.destroy());
  child.stdin.end('a <!-- x -->\n\n'.repeat(20000));
  const status = await new Promise((resolve) => child.on('close', resolve));
  assert.equal(stderr, '');
  assert.equal(status, 1);
});

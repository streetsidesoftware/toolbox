// cspell:ignore outptu
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { TestContext } from 'node:test';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { run, usage } from './bin.ts';
import { fakeGitHub } from './fake-github.ts';

const upstream: Record<string, string> = {
  'static/sponsor.md': 'Sponsor us.\n',
  'static/footer.md': 'Footer.\n',
};

let cwd = '';

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), 'copy-github-files-'));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('run', () => {
  test('copies each file to its path in the repository', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/sponsor.md', 'static/footer.md'], context);

    assert.equal(code, 0);
    assert.equal(await readFile(path.join(cwd, 'static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
    assert.equal(await readFile(path.join(cwd, 'static/footer.md'), 'utf8'), 'Footer.\n');
    assert.deepEqual(context.logged.toSorted(), [
      `Copied ${localPath('static/footer.md')}`,
      `Copied ${localPath('static/sponsor.md')}`,
    ]);
  });

  test('writes the files below the --output folder', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/sponsor.md', '--output', 'docs'], context);

    assert.equal(code, 0);
    assert.equal(await readFile(path.join(cwd, 'docs/static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
    assert.deepEqual(context.logged, [`Copied ${localPath('docs/static/sponsor.md')}`]);
  });

  test('reads from the --ref', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/sponsor.md', '--ref', 'v2'], context);

    assert.equal(code, 0);
    assert.deepEqual(context.urls, ['https://api.github.com/repos/owner/repo/contents/static/sponsor.md?ref=v2']);
  });

  test('passes the token on', async (t) => {
    const context = createContext(t, { token: 'secret' });
    const code = await run(['owner/repo', 'static/sponsor.md'], context);

    assert.equal(code, 0);
    assert.deepEqual(context.authorizations, ['Bearer secret']);
  });

  test('replaces an existing local copy', async (t) => {
    await writeLocal('static/sponsor.md', 'Old text.\n');
    const context = createContext(t);
    await run(['owner/repo', 'static/sponsor.md', 'static/footer.md'], context);

    assert.equal(await readFile(path.join(cwd, 'static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
    assert.deepEqual(context.logged.toSorted(), [
      `Copied ${localPath('static/footer.md')}`,
      `Copied ${localPath('static/sponsor.md')}`,
    ]);
  });

  test('reads a path named twice once', async (t) => {
    const context = createContext(t);
    await run(['owner/repo', 'static/sponsor.md', 'static/sponsor.md'], context);

    assert.equal(context.urls.length, 1);
  });

  test('copies the other files when one cannot be fetched', async (t) => {
    await writeLocal('static/sponsor.md', 'Old text.\n');
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/sponsor.md', 'static/missing.md', 'static/footer.md'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['Failed to copy static/missing.md: GitHub responded with status 404']);
    assert.deepEqual(context.logged.toSorted(), [
      `Copied ${localPath('static/footer.md')}`,
      `Copied ${localPath('static/sponsor.md')}`,
    ]);
    assert.equal(await readFile(path.join(cwd, 'static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
    assert.deepEqual((await readdir(path.join(cwd, 'static'))).sort(), ['footer.md', 'sponsor.md']);
  });

  test('shows the usage for --help', async (t) => {
    const context = createContext(t);
    const code = await run(['--help'], context);

    assert.equal(code, 0);
    assert.deepEqual(context.logged, [usage]);
  });

  testEach`
    option             | rawName
    ${'--outptu'}      | ${'--outptu'}
    ${'--outptu=docs'} | ${'--outptu'}
    ${'-o'}            | ${'-o'}
  `('names the unknown option in $option', async ({ option, rawName }: { option: string; rawName: string }, t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'a.md', option], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, [
      `Unknown option ${rawName}. The options are --output, --ref, --concurrency, --fail-fast, --silent and --help.`,
    ]);
    assert.deepEqual(context.urls, []);
  });

  testEach`
    args
    ${['--ref']}
    ${['--ref', '--output', 'docs']}
  `('names the option without its value in $args', async ({ args }: { args: string[] }, t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'a.md', ...args], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['The --ref option must name a branch, tag or commit.']);
    assert.deepEqual(context.urls, []);
  });

  test('accepts a value that starts with a dash when written with =', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/sponsor.md', '--ref=-v1'], context);

    assert.equal(code, 0);
    assert.deepEqual(context.urls, ['https://api.github.com/repos/owner/repo/contents/static/sponsor.md?ref=-v1']);
  });

  test('refuses a value for --help', async (t) => {
    const context = createContext(t);
    const code = await run(['--help=yes'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['The --help option takes no value.']);
    assert.deepEqual(context.logged, []);
  });

  testEach`
    repo
    ${'owner'}
    ${'owner/repo/extra'}
    ${'https://github.com/owner/repo'}
    ${'../..'}
    ${'owner/..'}
    ${'own.er/repo'}
  `('refuses the repository $repo', async ({ repo }: { repo: string }, t) => {
    const context = createContext(t);
    const code = await run([repo, 'a.md'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, [
      'The repository must be written as <owner>/<repo>, such as streetsidesoftware/.github.',
    ]);
    assert.deepEqual(context.urls, []);
  });

  test('accepts a repository name with dots', async (t) => {
    const context = createContext(t);
    await run(['owner/.github', 'a.md'], context);

    assert.deepEqual(context.urls, ['https://api.github.com/repos/owner/.github/contents/a.md']);
  });

  test('refuses an empty --output', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/sponsor.md', '--output='], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['The --output option must name a folder.']);
    assert.deepEqual(context.urls, []);
  });

  test('lists no copied file with --silent, but still shows failures', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/sponsor.md', 'static/missing.md', '--silent'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.logged, []);
    assert.deepEqual(context.errors, ['Failed to copy static/missing.md: GitHub responded with status 404']);
    assert.equal(await readFile(path.join(cwd, 'static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
  });

  test('refuses a value for --silent', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/sponsor.md', '--silent=yes'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['The --silent option takes no value.']);
    assert.deepEqual(context.urls, []);
  });

  test('downloads up to --concurrency files at once', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/sponsor.md', 'static/footer.md', '--concurrency', '1'], context);

    assert.equal(code, 0);
    assert.deepEqual(context.logged, [
      `Copied ${localPath('static/sponsor.md')}`,
      `Copied ${localPath('static/footer.md')}`,
    ]);
  });

  testEach`
    value
    ${'0'}
    ${'-1'}
    ${'1.5'}
    ${'many'}
    ${''}
    ${'08'}
  `('refuses --concurrency=$value', async ({ value }: { value: string }, t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/sponsor.md', `--concurrency=${value}`], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['The --concurrency option must be a whole number of at least 1.']);
    assert.deepEqual(context.urls, []);
  });

  test('refuses an empty --ref', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/sponsor.md', '--ref='], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['The --ref option must name a branch, tag or commit.']);
    assert.deepEqual(context.urls, []);
  });

  test('copies the other files when one cannot be written', async (t) => {
    await mkdir(path.join(cwd, 'static/sponsor.md'), { recursive: true });
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/footer.md', 'static/sponsor.md'], context);

    assert.equal(code, 1);
    assert.equal(context.errors.length, 1);
    assert.ok(context.errors[0]?.startsWith('Failed to copy static/sponsor.md: EISDIR'));
    assert.deepEqual(context.logged, [`Copied ${localPath('static/footer.md')}`]);
    assert.equal(await readFile(path.join(cwd, 'static/footer.md'), 'utf8'), 'Footer.\n');
  });

  test('refuses a command without a file to copy', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['Name at least one file to copy.']);
  });

  test('refuses a path outside the repository, and copies the others', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', '../a.md', 'static/sponsor.md'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, [
      'Failed to copy ../a.md: A path must name a file from the root of the repository, such as static/sponsor.md, without . or .. segments.',
    ]);
    assert.deepEqual(context.logged, [`Copied ${localPath('static/sponsor.md')}`]);
  });

  test('stops at the first failure with --fail-fast', async (t) => {
    const context = createContext(t);
    const code = await run(
      ['owner/repo', 'static/missing.md', 'static/sponsor.md', '--fail-fast', '--concurrency', '1'],
      context,
    );

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['Failed to copy static/missing.md: GitHub responded with status 404']);
    assert.deepEqual(context.logged, []);
    assert.equal(context.urls.length, 1);
  });
});

/** The path as the command prints it, with the platform's separator. */
function localPath(filePath: string): string {
  return path.join(...filePath.split('/'));
}

async function writeLocal(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(path.join(cwd, filePath)), { recursive: true });
  await writeFile(path.join(cwd, filePath), content);
}

function createContext(t: TestContext, { token }: { token?: string } = {}) {
  const logged: string[] = [];
  const errors: string[] = [];
  const requests = fakeGitHub(t, upstream);
  return {
    cwd,
    token,
    log: (line: string) => logged.push(line),
    error: (line: string) => errors.push(line),
    logged,
    errors,
    get urls() {
      return requests.map((request) => request.url);
    },
    get authorizations() {
      return requests.map((request) => request.headers['Authorization']);
    },
  };
}

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { TestContext } from 'node:test';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { fakeGitHub } from '../testing/fake-github.ts';
import { usage } from './parse.ts';
import { run } from './run.ts';

const upstream: Record<string, string> = {
  'static/sponsor.md': 'Sponsor us.\n',
  'static/footer.md': 'Footer.\n',
  'static/img/logo.png': 'logo',
  'static/img/banner.png': 'banner',
  'static/img/logo.svg': 'svg',
};

const startFolder = process.cwd();
let cwd = '';

// The command writes below the working folder, as it does for a user, so each test runs in a folder of its own.
beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), 'copy-github-files-'));
  process.chdir(cwd);
});

afterEach(async () => {
  process.chdir(startFolder);
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
    assert.deepEqual(context.errors, [
      'Failed to copy static/missing.md: GitHub responded with status 404 for static/missing.md',
    ]);
    assert.deepEqual(context.logged.toSorted(), [
      `Copied ${localPath('static/footer.md')}`,
      `Copied ${localPath('static/sponsor.md')}`,
    ]);
    assert.equal(await readFile(path.join(cwd, 'static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
    assert.deepEqual((await readdir(path.join(cwd, 'static'))).sort(), ['footer.md', 'sponsor.md']);
  });

  test('prints to the console and reads GITHUB_TOKEN when no context is given', async (t) => {
    const requests = fakeGitHub(t, upstream);
    const log = t.mock.method(console, 'log', () => undefined);
    setToken(t, 'from-env');
    const code = await run(['owner/repo', 'static/sponsor.md']);

    assert.equal(code, 0);
    assert.deepEqual(
      log.mock.calls.map((call) => call.arguments),
      [[`Copied ${localPath('static/sponsor.md')}`]],
    );
    assert.equal(requests[0]?.headers['Authorization'], 'Bearer from-env');
  });

  test('uses the console only for the parts of the context left out', async (t) => {
    const consoleError = t.mock.method(console, 'error', () => undefined);
    const logged: string[] = [];
    const code = await run(['owner/repo', 'a.md', '--nope'], { log: (line) => logged.push(line) });

    assert.equal(code, 1);
    assert.equal(consoleError.mock.callCount(), 1);
    assert.deepEqual(logged, []);
  });

  test('prefers the token in the context to GITHUB_TOKEN', async (t) => {
    const context = createContext(t, { token: 'given' });
    setToken(t, 'from-env');
    await run(['owner/repo', 'static/sponsor.md'], context);

    assert.deepEqual(context.authorizations, ['Bearer given']);
  });

  test('shows the usage for --help', async (t) => {
    const context = createContext(t);
    const code = await run(['--help'], context);

    assert.equal(code, 0);
    assert.deepEqual(context.logged, [usage]);
  });

  test('reports a wrong option, without a request', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/sponsor.md', '--silent=yes'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['The --silent option takes no value.']);
    assert.deepEqual(context.logged, []);
    assert.deepEqual(context.urls, []);
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

  test('lists no copied file with --silent, but still shows failures', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/sponsor.md', 'static/missing.md', '--silent'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.logged, []);
    assert.deepEqual(context.errors, [
      'Failed to copy static/missing.md: GitHub responded with status 404 for static/missing.md',
    ]);
    assert.equal(await readFile(path.join(cwd, 'static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
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

  test('refuses a command without a repository or a file to copy', async (t) => {
    for (const args of [[], ['owner/repo']]) {
      const context = createContext(t);
      const code = await run(args, context);

      assert.equal(code, 1);
      assert.deepEqual(context.errors, [
        'Name a repository and at least one file to copy: copy-github-files <owner>/<repo> <path>...',
      ]);
    }
  });

  test('refuses a path outside the repository, and copies the others', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', '../a.md', 'static/sponsor.md'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, [
      'Failed to copy ../a.md: A path must be written from the root of the repository, such as static/sponsor.md, without . or .. segments.',
    ]);
    assert.deepEqual(context.logged, [`Copied ${localPath('static/sponsor.md')}`]);
  });

  test('copies the files a pattern matches', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/*.md'], context);

    assert.equal(code, 0);
    assert.equal(await readFile(path.join(cwd, 'static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
    assert.deepEqual(context.logged.toSorted(), [
      `Copied ${localPath('static/footer.md')}`,
      `Copied ${localPath('static/sponsor.md')}`,
    ]);
  });

  test('skips the files each --exclude matches, and keeps those a ! glob matches', async (t) => {
    const context = createContext(t);
    const code = await run(
      ['owner/repo', 'static/img/*', '--exclude', 'static/img/*', '--exclude', '!static/img/*.png'],
      context,
    );

    assert.equal(code, 0);
    assert.deepEqual(context.logged.toSorted(), [
      `Copied ${localPath('static/img/banner.png')}`,
      `Copied ${localPath('static/img/logo.png')}`,
    ]);
  });

  test('copies a path given in full that an --exclude matches', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/img/banner.png', '--exclude', 'banner.png'], context);

    assert.equal(code, 0);
    assert.deepEqual(context.logged, [`Copied ${localPath('static/img/banner.png')}`]);
  });

  testEach`
    reason                       | pattern               | exclude
    ${'nothing matches'}         | ${'static/img/*.gif'} | ${[]}
    ${'every match is excluded'} | ${'static/img/*.svg'} | ${['--exclude', 'logo.svg']}
  `(
    'lists a pattern that matches no file at the end, when $reason, and copies the others',
    async ({ pattern, exclude }: { pattern: string; exclude: string[] }, t) => {
      fakeGitHub(t, upstream);
      const lines: string[] = [];
      const print = (line: string) => lines.push(line);
      const code = await run(['owner/repo', pattern, 'static/sponsor.md', ...exclude], { log: print, error: print });

      assert.equal(code, 1);
      assert.deepEqual(lines, [`Copied ${localPath('static/sponsor.md')}`, `No file matches ${pattern}`]);
    },
  );

  test('copies nothing when a pattern looks in a folder that cannot be listed', async (t) => {
    const context = createContext(t);
    const code = await run(['owner/repo', 'static/sponsor.md', 'missing/*.md'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['GitHub responded with status 404 for missing']);
    assert.deepEqual(context.logged, []);
    assert.deepEqual(await readdir(cwd), []);
  });

  test('stops at the first failure with --fail-fast', async (t) => {
    const context = createContext(t);
    const code = await run(
      ['owner/repo', 'static/missing.md', 'static/sponsor.md', '--fail-fast', '--concurrency', '1'],
      context,
    );

    assert.equal(code, 1);
    assert.deepEqual(context.errors, [
      'Failed to copy static/missing.md: GitHub responded with status 404 for static/missing.md',
    ]);
    assert.deepEqual(context.logged, []);
    assert.equal(context.urls.length, 1);
  });
});

/** Set GITHUB_TOKEN for one test. */
function setToken(t: TestContext, token: string): void {
  const before = process.env['GITHUB_TOKEN'];
  process.env['GITHUB_TOKEN'] = token;
  t.after(() => {
    if (before === undefined) delete process.env['GITHUB_TOKEN'];
    else process.env['GITHUB_TOKEN'] = before;
  });
}

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

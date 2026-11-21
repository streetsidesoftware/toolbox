// cspell:ignore outptu
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { run, usage } from './run.ts';

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
  test('copies each file to its path in the repository', async () => {
    const context = createContext();
    const code = await run(['owner/repo', 'static/sponsor.md', 'static/footer.md'], context);

    assert.equal(code, 0);
    assert.equal(await readFile(path.join(cwd, 'static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
    assert.equal(await readFile(path.join(cwd, 'static/footer.md'), 'utf8'), 'Footer.\n');
    assert.deepEqual(context.logged, [
      `Copied ${localPath('static/sponsor.md')}`,
      `Copied ${localPath('static/footer.md')}`,
    ]);
  });

  test('writes the files below the --output folder', async () => {
    const context = createContext();
    const code = await run(['owner/repo', 'static/sponsor.md', '--output', 'docs'], context);

    assert.equal(code, 0);
    assert.equal(await readFile(path.join(cwd, 'docs/static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
    assert.deepEqual(context.logged, [`Copied ${localPath('docs/static/sponsor.md')}`]);
  });

  test('reads from the --ref', async () => {
    const context = createContext();
    const code = await run(['owner/repo', 'static/sponsor.md', '--ref', 'v2'], context);

    assert.equal(code, 0);
    assert.deepEqual(context.urls, ['https://api.github.com/repos/owner/repo/contents/static/sponsor.md?ref=v2']);
  });

  test('passes the token on', async () => {
    const context = createContext({ token: 'secret' });
    const code = await run(['owner/repo', 'static/sponsor.md'], context);

    assert.equal(code, 0);
    assert.deepEqual(context.authorizations, ['Bearer secret']);
  });

  test('replaces an existing local copy', async () => {
    await writeLocal('static/sponsor.md', 'Old text.\n');
    const context = createContext();
    await run(['owner/repo', 'static/sponsor.md', 'static/footer.md'], context);

    assert.equal(await readFile(path.join(cwd, 'static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
    assert.deepEqual(context.logged, [
      `Copied ${localPath('static/sponsor.md')}`,
      `Copied ${localPath('static/footer.md')}`,
    ]);
  });

  test('reads a path named twice once', async () => {
    const context = createContext();
    await run(['owner/repo', 'static/sponsor.md', 'static/sponsor.md'], context);

    assert.equal(context.urls.length, 1);
  });

  test('copies the other files when one cannot be fetched', async () => {
    await writeLocal('static/sponsor.md', 'Old text.\n');
    const context = createContext();
    const code = await run(['owner/repo', 'static/sponsor.md', 'static/missing.md', 'static/footer.md'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['Failed to copy static/missing.md: GitHub responded with status 404']);
    assert.deepEqual(context.logged, [
      `Copied ${localPath('static/sponsor.md')}`,
      `Copied ${localPath('static/footer.md')}`,
    ]);
    assert.equal(await readFile(path.join(cwd, 'static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
    assert.deepEqual((await readdir(path.join(cwd, 'static'))).sort(), ['footer.md', 'sponsor.md']);
  });

  test('shows the usage for --help', async () => {
    const context = createContext();
    const code = await run(['--help'], context);

    assert.equal(code, 0);
    assert.deepEqual(context.logged, [usage]);
  });

  test('names an unknown option', async () => {
    const cases: [option: string, rawName: string][] = [
      ['--outptu', '--outptu'],
      ['--outptu=docs', '--outptu'],
      ['-o', '-o'],
    ];
    for (const [option, rawName] of cases) {
      const context = createContext();
      const code = await run(['owner/repo', 'a.md', option], context);

      assert.equal(code, 1, option);
      assert.deepEqual(
        context.errors,
        [`Unknown option ${rawName}. The options are --output, --ref and --help.`],
        option,
      );
      assert.deepEqual(context.urls, [], option);
    }
  });

  test('names an option without its value', async () => {
    for (const args of [['--ref'], ['--ref', '--output', 'docs']]) {
      const context = createContext();
      const code = await run(['owner/repo', 'a.md', ...args], context);

      assert.equal(code, 1, args.join(' '));
      assert.deepEqual(context.errors, ['The --ref option must name a branch, tag or commit.'], args.join(' '));
      assert.deepEqual(context.urls, [], args.join(' '));
    }
  });

  test('accepts a value that starts with a dash when written with =', async () => {
    const context = createContext();
    const code = await run(['owner/repo', 'static/sponsor.md', '--ref=-v1'], context);

    assert.equal(code, 0);
    assert.deepEqual(context.urls, ['https://api.github.com/repos/owner/repo/contents/static/sponsor.md?ref=-v1']);
  });

  test('refuses a value for --help', async () => {
    const context = createContext();
    const code = await run(['--help=yes'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['The --help option takes no value.']);
    assert.deepEqual(context.logged, []);
  });

  test('refuses a repository not written as owner/repo', async () => {
    for (const repo of [
      'owner',
      'owner/repo/extra',
      'https://github.com/owner/repo',
      '../..',
      'owner/..',
      'own.er/repo',
    ]) {
      const context = createContext();
      const code = await run([repo, 'a.md'], context);

      assert.equal(code, 1);
      assert.deepEqual(context.errors, [
        'The repository must be written as <owner>/<repo>, such as streetsidesoftware/.github.',
      ]);
      assert.deepEqual(context.urls, []);
    }
  });

  test('accepts a repository name with dots', async () => {
    const context = createContext();
    await run(['owner/.github', 'a.md'], context);

    assert.deepEqual(context.urls, ['https://api.github.com/repos/owner/.github/contents/a.md']);
  });

  test('refuses an empty --output', async () => {
    const context = createContext();
    const code = await run(['owner/repo', 'static/sponsor.md', '--output='], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['The --output option must name a folder.']);
    assert.deepEqual(context.urls, []);
  });

  test('refuses an empty --ref', async () => {
    const context = createContext();
    const code = await run(['owner/repo', 'static/sponsor.md', '--ref='], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['The --ref option must name a branch, tag or commit.']);
    assert.deepEqual(context.urls, []);
  });

  test('copies the other files when one cannot be written', async () => {
    await mkdir(path.join(cwd, 'static/sponsor.md'), { recursive: true });
    const context = createContext();
    const code = await run(['owner/repo', 'static/footer.md', 'static/sponsor.md'], context);

    assert.equal(code, 1);
    assert.equal(context.errors.length, 1);
    assert.ok(context.errors[0]?.startsWith(`Failed to write ${localPath('static/sponsor.md')}: `));
    assert.deepEqual(context.logged, [`Copied ${localPath('static/footer.md')}`]);
    assert.equal(await readFile(path.join(cwd, 'static/footer.md'), 'utf8'), 'Footer.\n');
  });

  test('refuses a command without a file to copy', async () => {
    const context = createContext();
    const code = await run(['owner/repo'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['Name at least one file to copy.']);
  });

  test('refuses a path outside the repository', async () => {
    for (const filePath of ['../a.md', '/a.md', 'static/./a.md', 'static//a.md']) {
      const context = createContext();
      const code = await run(['owner/repo', filePath], context);

      assert.equal(code, 1);
      assert.deepEqual(context.errors, [
        'A path must name a file from the root of the repository, such as static/sponsor.md, without . or .. segments.',
      ]);
      assert.deepEqual(context.urls, []);
    }
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

function createContext({ token }: { token?: string } = {}) {
  const logged: string[] = [];
  const errors: string[] = [];
  const urls: string[] = [];
  const authorizations: (string | undefined)[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    urls.push(url.href);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    authorizations.push(headers['Authorization']);
    const content = upstream[url.pathname.replace('/repos/owner/repo/contents/', '')];
    if (content === undefined) return new Response('{}', { status: 404 });
    return new Response(content, { headers: { 'content-type': 'application/vnd.github.raw+json; charset=utf-8' } });
  };
  return {
    cwd,
    token,
    fetch,
    log: (line: string) => logged.push(line),
    error: (line: string) => errors.push(line),
    logged,
    errors,
    urls,
    authorizations,
  };
}

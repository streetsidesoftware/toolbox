import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
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
      `Added ${localPath('static/sponsor.md')}`,
      `Added ${localPath('static/footer.md')}`,
    ]);
  });

  test('writes the files below the --output folder', async () => {
    const context = createContext();
    const code = await run(['owner/repo', 'static/sponsor.md', '--output', 'docs'], context);

    assert.equal(code, 0);
    assert.equal(await readFile(path.join(cwd, 'docs/static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
    assert.deepEqual(context.logged, [`Added ${localPath('docs/static/sponsor.md')}`]);
  });

  test('reads from the --ref', async () => {
    const context = createContext();
    await run(['owner/repo', 'static/sponsor.md', '--ref', 'v2'], context);

    assert.deepEqual(context.urls, ['https://api.github.com/repos/owner/repo/contents/static/sponsor.md?ref=v2']);
  });

  test('passes the token on', async () => {
    const context = createContext({ token: 'secret' });
    await run(['owner/repo', 'static/sponsor.md'], context);

    assert.deepEqual(context.authorizations, ['Bearer secret']);
  });

  test('leaves a file alone when it already matches', async () => {
    await writeLocal('static/sponsor.md', 'Sponsor us.\n');
    const before = await stat(path.join(cwd, 'static/sponsor.md'));
    const context = createContext();
    const code = await run(['owner/repo', 'static/sponsor.md'], context);

    assert.equal(code, 0);
    assert.equal((await stat(path.join(cwd, 'static/sponsor.md'))).mtimeMs, before.mtimeMs);
    assert.deepEqual(context.logged, ['No changes.']);
  });

  test('replaces a file that differs', async () => {
    await writeLocal('static/sponsor.md', 'Old text.\n');
    const context = createContext();
    await run(['owner/repo', 'static/sponsor.md', 'static/footer.md'], context);

    assert.equal(await readFile(path.join(cwd, 'static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
    assert.deepEqual(context.logged, [
      `Updated ${localPath('static/sponsor.md')}`,
      `Added ${localPath('static/footer.md')}`,
    ]);
  });

  test('reads a path named twice once', async () => {
    const context = createContext();
    await run(['owner/repo', 'static/sponsor.md', 'static/sponsor.md'], context);

    assert.equal(context.urls.length, 1);
  });

  test('writes nothing when one file fails', async () => {
    await writeLocal('static/sponsor.md', 'Old text.\n');
    const context = createContext();
    const code = await run(['owner/repo', 'static/sponsor.md', 'static/missing.md', 'static/footer.md'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, ['Failed to copy static/missing.md: GitHub responded 404 Not Found']);
    assert.equal(await readFile(path.join(cwd, 'static/sponsor.md'), 'utf8'), 'Old text.\n');
    assert.deepEqual(await readdir(path.join(cwd, 'static')), ['sponsor.md']);
  });

  test('shows the usage for --help', async () => {
    const context = createContext();
    const code = await run(['--help'], context);

    assert.equal(code, 0);
    assert.deepEqual(context.logged, [usage]);
  });

  test('shows the usage for an unknown option', async () => {
    const context = createContext();
    const code = await run(['owner/repo', 'a.md', '--force'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, [usage]);
  });

  test('shows the usage for an option without its value', async () => {
    const context = createContext();
    const code = await run(['owner/repo', 'a.md', '--ref'], context);

    assert.equal(code, 1);
    assert.deepEqual(context.errors, [usage]);
  });

  test('refuses a repository not written as owner/repo', async () => {
    for (const repo of ['owner', 'owner/repo/extra', 'https://github.com/owner/repo']) {
      const context = createContext();
      const code = await run([repo, 'a.md'], context);

      assert.equal(code, 1);
      assert.deepEqual(context.errors, [
        'The repository must be written as <owner>/<repo>, such as streetsidesoftware/.github.',
      ]);
      assert.deepEqual(context.urls, []);
    }
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
    if (content === undefined) return new Response('{}', { status: 404, statusText: 'Not Found' });
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

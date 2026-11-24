import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { TestContext } from 'node:test';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { setTimeout as delay, setImmediate as nextTurn } from 'node:timers/promises';

import { testEach } from '@streetsidesoftware/test-each';

import { GitHubError } from '../github/index.ts';
import { fakeGitHub } from '../testing/fake-github.ts';
import type { CopyResult } from './copy.ts';
import { copyGitHubFiles } from './copy.ts';

const upstream: Record<string, string> = {
  'static/sponsor.md': 'Sponsor us.\n',
  'static/footer.md': 'Footer.\n',
};

const source = { repo: 'owner/repo' };

let folder = '';

beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), 'copy-github-files-'));
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe('copyGitHubFiles', () => {
  test('writes each file below the folder, at its path in the repository', async (t) => {
    fakeGitHub(t, upstream);
    const results = await collect(copyGitHubFiles(source, ['static/sponsor.md', 'static/footer.md'], folder));

    assert.deepEqual(byPath(results), [
      { path: 'static/footer.md', file: path.join(folder, 'static', 'footer.md') },
      { path: 'static/sponsor.md', file: path.join(folder, 'static', 'sponsor.md') },
    ]);
    assert.equal(await readFile(path.join(folder, 'static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
    assert.equal(await readFile(path.join(folder, 'static/footer.md'), 'utf8'), 'Footer.\n');
  });

  test('reads paths only while there is room, and closes the source when the loop breaks', async (t) => {
    fakeGitHub(t, upstream);
    let pulled = 0;
    let closed = false;
    function* paths() {
      try {
        for (;;) yield `file-${++pulled}.md`;
      } finally {
        closed = true;
      }
    }
    for await (const result of copyGitHubFiles(source, paths(), folder, { concurrency: 2 })) {
      assert.ok('error' in result);
      break;
    }

    assert.equal(pulled, 2);
    assert.equal(closed, true);
  });

  test('reads a path named twice once', async (t) => {
    const requests = fakeGitHub(t, upstream);
    const results = await collect(copyGitHubFiles(source, ['static/sponsor.md', 'static/sponsor.md'], folder));

    assert.equal(results.length, 1);
    assert.equal(requests.length, 1);
  });

  test('gives each file as soon as it finishes', async (t) => {
    slowGitHub(t, { 'slow.md': 30, 'fast.md': 0 });
    const results = await collect(copyGitHubFiles(source, ['slow.md', 'fast.md'], folder));

    assert.deepEqual(
      results.map((result) => result.path),
      ['fast.md', 'slow.md'],
    );
  });

  test('downloads up to the concurrency at once', async (t) => {
    const github = slowGitHub(t, { 'a.md': 10, 'b.md': 10, 'c.md': 10, 'd.md': 10, 'e.md': 10 });
    await collect(copyGitHubFiles(source, ['a.md', 'b.md', 'c.md', 'd.md', 'e.md'], folder, { concurrency: 2 }));

    assert.equal(github.mostAtOnce, 2);
  });

  test('downloads 8 files at once by default', async (t) => {
    const delays = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`${index}.md`, 10]));
    const github = slowGitHub(t, delays);
    await collect(copyGitHubFiles(source, Object.keys(delays), folder));

    assert.equal(github.mostAtOnce, 8);
  });

  testEach`
    concurrency
    ${0}
    ${-1}
    ${1.5}
    ${Number.NaN}
  `(
    'refuses a concurrency of $concurrency, before any request',
    async ({ concurrency }: { concurrency: number }, t) => {
      const requests = fakeGitHub(t, upstream);

      await assert.rejects(collect(copyGitHubFiles(source, ['static/sponsor.md'], folder, { concurrency })), {
        message: 'The concurrency must be a whole number of at least 1.',
      });
      assert.deepEqual(requests, []);
    },
  );

  test('gives a failed file as a result and copies the others', async (t) => {
    fakeGitHub(t, upstream);
    const results = await collect(
      copyGitHubFiles(source, ['static/sponsor.md', 'static/missing.md', 'static/footer.md'], folder),
    );

    assert.deepEqual(
      byPath(results).map((result) => ('error' in result ? `${result.path}: ${result.error.message}` : result.path)),
      [
        'static/footer.md',
        'static/missing.md: GitHub responded with status 404 for static/missing.md in owner/repo',
        'static/sponsor.md',
      ],
    );
    const failure = results.find((result) => result.path === 'static/missing.md');
    assert.ok(failure && 'error' in failure && failure.error instanceof GitHubError);
    assert.equal(failure.error.status, 404);
    assert.deepEqual((await readdir(path.join(folder, 'static'))).sort(), ['footer.md', 'sponsor.md']);
  });

  test('gives a file that cannot be written as a failed result', async (t) => {
    fakeGitHub(t, upstream);
    await mkdir(path.join(folder, 'static/sponsor.md'), { recursive: true });
    const [result] = await collect(copyGitHubFiles(source, ['static/sponsor.md'], folder));

    assert.ok(result && 'error' in result);
    assert.equal((result.error as NodeJS.ErrnoException).code, 'EISDIR');
  });

  test('gives a folder as a failed result, with no file found', async (t) => {
    fakeGitHub(t, upstream);
    const [result] = await collect(copyGitHubFiles(source, ['static'], folder));

    assert.ok(result && 'error' in result && result.error instanceof GitHubError);
    assert.equal(result.error.status, 404);
    assert.equal(result.error.message, 'The path static names a folder, not a file.');
    assert.deepEqual(await readdir(folder), []);
  });

  test('never writes outside the folder', async (t) => {
    const requests = fakeGitHub(t, upstream);
    const results = await collect(copyGitHubFiles(source, ['../escape.md', 'static/../../escape.md'], folder));

    assert.ok(results.every((result) => 'error' in result));
    assert.deepEqual(requests, []);
    assert.deepEqual(await readdir(folder), []);
  });

  test('never writes outside the folder through a backslash, which Windows reads as a separator', async (t) => {
    const name = 'a\\..\\..\\escape.md';
    fakeGitHub(t, { [name]: 'Escaped.\n' });
    await collect(copyGitHubFiles(source, [name], path.join(folder, 'out')));

    await assert.rejects(readFile(path.join(folder, 'escape.md')), { code: 'ENOENT' });
  });

  test('refuses a source that is not a repository, before any request', async (t) => {
    const requests = fakeGitHub(t, upstream);

    await assert.rejects(collect(copyGitHubFiles({ repo: '../..' }, ['static/sponsor.md'], folder)), {
      message: 'The repository must be written as <owner>/<repo>, such as streetsidesoftware/.github.',
    });
    assert.deepEqual(requests, []);
  });

  test('refuses a lone path in place of a list, before any request', async (t) => {
    const requests = fakeGitHub(t, upstream);

    await assert.rejects(collect(copyGitHubFiles(source, 'static/sponsor.md', folder)), {
      message: "The paths must be a list of paths, such as ['static/sponsor.md'].",
    });
    assert.deepEqual(requests, []);
  });

  test('stops the running downloads when the loop breaks', async (t) => {
    const github = slowGitHub(t, { 'fast.md': 0, 'slow.md': 1000 });
    for await (const result of copyGitHubFiles(source, ['fast.md', 'slow.md'], folder)) {
      assert.equal(result.path, 'fast.md');
      break;
    }

    // The request for slow.md was the second.
    assert.equal(github.signals[1]?.aborted, true);
    assert.deepEqual(await readdir(folder), ['fast.md']);
  });

  test('writes no file that finished downloading after the loop breaks', async (t) => {
    fakeGitHub(t, upstream);
    let given = '';
    for await (const result of copyGitHubFiles(source, ['static/sponsor.md', 'static/footer.md'], folder)) {
      // The other file has finished downloading by now, but its result hasn't been given.
      await delay(10);
      given = result.path;
      break;
    }

    assert.deepEqual(await readdir(path.join(folder, 'static')), [path.basename(given)]);
  });

  test('stops with the abort reason when the signal is aborted', async (t) => {
    fakeGitHub(t, upstream);
    const controller = new AbortController();
    const given: CopyResult[] = [];
    await assert.rejects(
      async () => {
        const results = copyGitHubFiles(source, ['static/sponsor.md', 'static/footer.md'], folder, {
          signal: controller.signal,
        });
        for await (const result of results) {
          given.push(result);
          controller.abort();
        }
      },
      { name: 'AbortError' },
    );

    assert.equal(given.length, 1);
    assert.deepEqual(await readdir(path.join(folder, 'static')), [path.basename(given[0]?.path ?? '')]);
  });

  test('never empties a file, or gives a failed result for a written file, when aborted during a write', async (t) => {
    const content = 'x'.repeat(2 ** 21);
    fakeGitHub(t, { 'big.md': content });
    const file = path.join(folder, 'big.md');
    // Abort after more and more turns of the event loop, so some aborts land while the file is being written.
    for (let turns = 0; turns < 40; turns += 1) {
      await writeFile(file, 'Old.\n');
      const controller = new AbortController();
      void abortAfter(turns, controller);
      const given: CopyResult[] = [];
      try {
        for await (const result of copyGitHubFiles(source, ['big.md'], folder, { signal: controller.signal })) {
          given.push(result);
        }
      } catch (error) {
        assert.equal((error as Error).name, 'AbortError');
      }

      assert.ok(given.every((result) => !('error' in result)));
      assert.equal(await readFile(file, 'utf8'), given.length ? content : 'Old.\n');
    }
  });

  test('passes an abort of the signal on to each request', async (t) => {
    const requests = fakeGitHub(t, upstream);
    const controller = new AbortController();
    await collect(copyGitHubFiles(source, ['static/sponsor.md'], folder, { signal: controller.signal }));
    controller.abort();

    assert.equal(requests[0]?.signal?.aborted, true);
  });
});

async function collect(results: AsyncIterable<CopyResult>): Promise<CopyResult[]> {
  const collected: CopyResult[] = [];
  for await (const result of results) collected.push(result);
  return collected;
}

async function abortAfter(turns: number, controller: AbortController): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) await nextTurn();
  controller.abort();
}

function byPath(results: CopyResult[]): CopyResult[] {
  return results.toSorted((a, b) => a.path.localeCompare(b.path));
}

/**
 * Replace the global `fetch` for one test with a GitHub that answers each path after its delay in milliseconds.
 * Counts how many requests ran at once, and keeps each request's signal.
 */
function slowGitHub(t: TestContext, delays: Record<string, number>) {
  const github = { mostAtOnce: 0, signals: [] as (AbortSignal | null | undefined)[] };
  let atOnce = 0;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    github.signals.push(init?.signal);
    atOnce += 1;
    github.mostAtOnce = Math.max(github.mostAtOnce, atOnce);
    try {
      const filePath = new URL(String(input)).pathname.replace('/repos/owner/repo/contents/', '');
      await delay(delays[filePath] ?? 0, undefined, { signal: init?.signal ?? undefined });
      return new Response(filePath, { headers: { 'content-type': 'application/vnd.github.raw+json' } });
    } finally {
      atOnce -= 1;
    }
  });
  return github;
}

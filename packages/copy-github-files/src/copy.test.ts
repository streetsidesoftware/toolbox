import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';

import type { CopyResult } from './copy.ts';
import { copyGitHubFiles } from './copy.ts';
import { fakeGitHub } from './fake-github.ts';

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

    assert.deepEqual(results, [
      { path: 'static/sponsor.md', file: path.join(folder, 'static', 'sponsor.md') },
      { path: 'static/footer.md', file: path.join(folder, 'static', 'footer.md') },
    ]);
    assert.equal(await readFile(path.join(folder, 'static/sponsor.md'), 'utf8'), 'Sponsor us.\n');
    assert.equal(await readFile(path.join(folder, 'static/footer.md'), 'utf8'), 'Footer.\n');
  });

  test('takes the paths from an async iterable', async (t) => {
    fakeGitHub(t, upstream);
    async function* paths() {
      yield 'static/sponsor.md';
    }
    const results = await collect(copyGitHubFiles(source, paths(), folder));

    assert.deepEqual(results, [{ path: 'static/sponsor.md', file: path.join(folder, 'static', 'sponsor.md') }]);
  });

  test('reads a path named twice once', async (t) => {
    const requests = fakeGitHub(t, upstream);
    const results = await collect(copyGitHubFiles(source, ['static/sponsor.md', 'static/sponsor.md'], folder));

    assert.equal(results.length, 1);
    assert.equal(requests.length, 1);
  });

  test('gives a failed file as a result and copies the others', async (t) => {
    fakeGitHub(t, upstream);
    const results = await collect(
      copyGitHubFiles(source, ['static/sponsor.md', 'static/missing.md', 'static/footer.md'], folder),
    );

    assert.deepEqual(
      results.map((result) => ('error' in result ? `${result.path}: ${result.error.message}` : result.path)),
      ['static/sponsor.md', 'static/missing.md: GitHub responded with status 404', 'static/footer.md'],
    );
    assert.deepEqual((await readdir(path.join(folder, 'static'))).sort(), ['footer.md', 'sponsor.md']);
  });

  test('gives a file that cannot be written as a failed result', async (t) => {
    fakeGitHub(t, upstream);
    await mkdir(path.join(folder, 'static/sponsor.md'), { recursive: true });
    const [result] = await collect(copyGitHubFiles(source, ['static/sponsor.md'], folder));

    assert.ok(result && 'error' in result);
    assert.equal((result.error as NodeJS.ErrnoException).code, 'EISDIR');
  });

  test('never writes outside the folder', async (t) => {
    const requests = fakeGitHub(t, upstream);
    const results = await collect(copyGitHubFiles(source, ['../escape.md', 'static/../../escape.md'], folder));

    assert.ok(results.every((result) => 'error' in result));
    assert.deepEqual(requests, []);
    assert.deepEqual(await readdir(folder), []);
  });

  test('refuses a source that is not a repository, before any request', async (t) => {
    const requests = fakeGitHub(t, upstream);

    await assert.rejects(collect(copyGitHubFiles({ repo: '../..' }, ['static/sponsor.md'], folder)), {
      message: 'The repository must be written as <owner>/<repo>, such as streetsidesoftware/.github.',
    });
    assert.deepEqual(requests, []);
  });

  test('stops at the next file when the loop breaks', async (t) => {
    const requests = fakeGitHub(t, upstream);
    for await (const result of copyGitHubFiles(source, ['static/missing.md', 'static/sponsor.md'], folder)) {
      if ('error' in result) break;
    }

    assert.equal(requests.length, 1);
    assert.deepEqual(await readdir(folder), []);
  });

  test('stops when the signal is aborted', async (t) => {
    const requests = fakeGitHub(t, upstream);
    const controller = new AbortController();
    const copied: CopyResult[] = [];
    await assert.rejects(
      async () => {
        for await (const result of copyGitHubFiles(source, ['static/sponsor.md', 'static/footer.md'], folder, {
          signal: controller.signal,
        })) {
          copied.push(result);
          controller.abort();
        }
      },
      { name: 'AbortError' },
    );

    assert.equal(copied.length, 1);
    assert.equal(requests.length, 1);
  });

  test('passes the signal to each request', async (t) => {
    const requests = fakeGitHub(t, upstream);
    const controller = new AbortController();
    await collect(copyGitHubFiles(source, ['static/sponsor.md'], folder, { signal: controller.signal }));

    assert.equal(requests[0]?.signal, controller.signal);
  });
});

async function collect(results: AsyncIterable<CopyResult>): Promise<CopyResult[]> {
  const collected: CopyResult[] = [];
  for await (const result of results) collected.push(result);
  return collected;
}

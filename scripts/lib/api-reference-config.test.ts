import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import Path from 'node:path';
import { describe, test } from 'node:test';

import type { ApiFunction } from './api-exports.ts';
import type { ApiReferenceConfig } from './api-reference-config.ts';
import { groupFunctions, parseApiReferenceConfig, readApiReferenceConfig } from './api-reference-config.ts';

const NAME = 'packages/a/.api-referencerc.json';

describe('readApiReferenceConfig', () => {
  test('reads and checks the config', async () => {
    const dir = await fs.mkdtemp(Path.join(os.tmpdir(), 'api-reference-config-'));
    try {
      const file = Path.join(dir, '.api-referencerc.json');
      await fs.writeFile(file, JSON.stringify({ groups: [{ heading: 'Text', categories: ['text'] }] }));
      assert.deepEqual(await readApiReferenceConfig(file, NAME), {
        groups: [{ heading: 'Text', categories: ['text'] }],
      });
      await assert.rejects(
        readApiReferenceConfig(Path.join(dir, 'none.json'), NAME),
        /\.api-referencerc\.json is missing/,
      );
      await assert.rejects(readApiReferenceConfig(dir, NAME), { code: 'EISDIR' });
      await fs.writeFile(file, '{ "groups": [], }');
      await assert.rejects(readApiReferenceConfig(file, NAME), /^Error: packages\/a\/\.api-referencerc\.json: /);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe('parseApiReferenceConfig', () => {
  test('keeps an optional functions list', () => {
    const config = { groups: [{ heading: 'Text', categories: ['text'], functions: ['paragraph'] }] };
    assert.deepEqual(parseApiReferenceConfig(config, NAME), config);
  });

  test('throws on a config of the wrong shape, naming where', () => {
    assert.throws(() => parseApiReferenceConfig([], NAME), /"groups" must be an array/);
    assert.throws(() => parseApiReferenceConfig({ groups: [{ categories: ['a'] }] }, NAME), /groups\[0\]\.heading/);
    assert.throws(
      () => parseApiReferenceConfig({ groups: [{ heading: 'A', categories: [] }] }, NAME),
      /groups\[0\]\.categories must be a non-empty array/,
    );
    assert.throws(
      () => parseApiReferenceConfig({ groups: [{ heading: 'A', categories: ['a'], functions: 'f' }] }, NAME),
      /groups\[0\]\.functions must be an array/,
    );
    assert.throws(
      () => parseApiReferenceConfig({ groups: [{ heading: ' ', categories: ['a'] }] }, NAME),
      /groups\[0\]\.heading must be a non-empty string/,
    );
  });

  test('throws on an unknown key, such as a misspelled one', () => {
    assert.throws(
      () => parseApiReferenceConfig({ groups: [], group: [] }, NAME),
      /packages\/a\/\.api-referencerc\.json has an unknown key "group"/,
    );
    assert.throws(
      () => parseApiReferenceConfig({ groups: [{ heading: 'A', categories: ['a'], functons: ['f'] }] }, NAME),
      /groups\[0\] has an unknown key "functons"/,
    );
  });

  test('throws on a category or function listed twice in a group, or a heading used twice', () => {
    assert.throws(
      () => parseApiReferenceConfig({ groups: [{ heading: 'A', categories: ['a', 'a'] }] }, NAME),
      /groups\[0\] lists "a" more than once/,
    );
    assert.throws(
      () => parseApiReferenceConfig({ groups: [{ heading: 'A', categories: ['a'], functions: ['f', 'f'] }] }, NAME),
      /groups\[0\] lists "f" more than once/,
    );
    const groups = [
      { heading: 'A', categories: ['a'] },
      { heading: 'A', categories: ['b'] },
    ];
    assert.throws(() => parseApiReferenceConfig({ groups }, NAME), /two groups have the heading "A"/);
  });
});

describe('groupFunctions', () => {
  const functions = [
    fn('blockText', 'text'),
    fn('br', 'line-breaks'),
    fn('lineBreak', 'line-breaks'),
    fn('paragraph', 'text'),
    fn('template', 'templates'),
  ];

  test('puts each group in config order, its listed functions first and the rest alphabetically', () => {
    const config: ApiReferenceConfig = {
      groups: [
        { heading: 'Templates', categories: ['templates'] },
        { heading: 'Text', categories: ['text', 'line-breaks'], functions: ['paragraph', 'lineBreak'] },
      ],
    };
    assert.deepEqual(
      groupFunctions(functions, config, NAME).map((group) => [group.heading, group.functions.map((f) => f.name)]),
      [
        ['Templates', ['template']],
        ['Text', ['paragraph', 'lineBreak', 'blockText', 'br']],
      ],
    );
  });

  test('throws on a category in no group, in two groups, or used by no function', () => {
    const groups = [{ heading: 'Text', categories: ['text', 'line-breaks'] }];
    assert.throws(
      () => groupFunctions(functions, { groups }, NAME),
      /template has @category templates, which no group in packages\/a\/\.api-referencerc\.json lists/,
    );
    assert.throws(
      () =>
        groupFunctions(functions, { groups: [...groups, { heading: 'T', categories: ['templates', 'text'] }] }, NAME),
      /category "text" is in more than one group/,
    );
    assert.throws(
      () =>
        groupFunctions(functions, { groups: [...groups, { heading: 'T', categories: ['templates', 'style'] }] }, NAME),
      /no function has @category style/,
    );
  });

  test('throws on a listed function that is not in its group', () => {
    const config: ApiReferenceConfig = {
      groups: [
        { heading: 'Templates', categories: ['templates'], functions: ['paragraph'] },
        { heading: 'Text', categories: ['text', 'line-breaks'] },
      ],
    };
    assert.throws(
      () => groupFunctions(functions, config, NAME),
      /paragraph is listed under "Templates" but isn't in it/,
    );
  });

  test('throws on a listed alias, naming the function to list instead', () => {
    const config: ApiReferenceConfig = { groups: [{ heading: 'Text', categories: ['text'], functions: ['p'] }] };
    assert.throws(
      () => groupFunctions([fn('paragraph', 'text', ['p'])], config, NAME),
      /list paragraph under "Text", not its alias p/,
    );
  });
});

function fn(name: string, category: string, aliases: string[] = []): ApiFunction {
  return { name, params: [], summary: 'Summary.', category, aliases };
}

import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';
import type { Root } from 'mdast';

import { substituteInString, substituteInTree } from './placeholders.ts';
import type { MdastRoot } from './placeholders.ts';

interface SubstituteRow {
  text: string;
  values: Record<string, string>;
  expected: string;
}

describe('substituteInString', () => {
  testEach`
        text                       | values                            | expected
        ${'v{@ version @}'}        | ${{ version: '1.2.3' }}           | ${'v1.2.3'}
        ${'v{@version@}'}          | ${{ version: '1.2.3' }}           | ${'v1.2.3'}
        ${'v{@  version  @}'}      | ${{ version: '1.2.3' }}           | ${'v1.2.3'}
        ${'{@ package.version @}'} | ${{ 'package.version': '9.9.9' }} | ${'9.9.9'}
        ${'no placeholder here'}   | ${{}}                             | ${'no placeholder here'}
        ${'\\{@ version @}'}       | ${{ version: '1.2.3' }}           | ${'{@ version @}'}
    `('substituteInString($text)', ({ text, values, expected }: SubstituteRow) => {
    const resolve = (name: string): string | undefined => values[name];
    const onUnresolved = mock.fn();
    assert.equal(substituteInString(text, resolve, onUnresolved), expected);
    assert.equal(onUnresolved.mock.callCount(), 0);
  });

  test('reports an unresolved placeholder and leaves it untouched', () => {
    const onUnresolved = mock.fn();
    const result = substituteInString('{@ missing @}', () => undefined, onUnresolved);
    assert.equal(result, '{@ missing @}');
    assert.deepEqual(onUnresolved.mock.calls.at(-1)?.arguments, ['missing']);
  });

  test('reports each occurrence of a repeated unresolved name', () => {
    const onUnresolved = mock.fn();
    substituteInString('{@ missing @} and {@ missing @}', () => undefined, onUnresolved);
    assert.equal(onUnresolved.mock.callCount(), 2);
  });
});

describe('substituteInTree', () => {
  function root(children: Root['children']): Root {
    return { type: 'root', children };
  }

  test("mdast's Root fits MdastRoot, the copy the /placeholders functions take", () => {
    const tree = root([]) satisfies MdastRoot;
    assert.equal(tree.type, 'root');
  });

  test('substitutes in text, inlineCode, code, and html nodes', () => {
    const tree = root([
      { type: 'paragraph', children: [{ type: 'text', value: 'v{@ version @}' }] },
      { type: 'paragraph', children: [{ type: 'inlineCode', value: 'pkg@{@ version @}' }] },
      { type: 'code', lang: null, value: "print('{@ version @}')" },
      { type: 'html', value: '<!-- {@ version @} -->' },
    ]);
    const onUnresolved = mock.fn();
    substituteInTree(tree, () => '1.2.3', onUnresolved);
    assert.equal(onUnresolved.mock.callCount(), 0);
    assert.equal((tree.children[0] as { children: { value: string }[] }).children[0].value, 'v1.2.3');
    assert.equal((tree.children[1] as { children: { value: string }[] }).children[0].value, 'pkg@1.2.3');
    assert.equal((tree.children[2] as { value: string }).value, "print('1.2.3')");
    assert.equal((tree.children[3] as { value: string }).value, '<!-- 1.2.3 -->');
  });
});

describe('name grammar', () => {
  const resolve = (name: string) => (name === 'ok' || name === 'a-b' ? 'X' : undefined);

  testEach`
        text            | expected        | why
        ${'{@ ok @}'}   | ${'X'}          | ${'plain name'}
        ${'{@ a-b @}'}  | ${'X'}          | ${'hyphen inside a segment'}
        ${'{@ -foo @}'} | ${'{@ -foo @}'} | ${'leading hyphen is not a placeholder'}
        ${'{@ a.-b @}'} | ${'{@ a.-b @}'} | ${'segment starting with a hyphen'}
        ${'{@ .foo @}'} | ${'{@ .foo @}'} | ${'leading dot'}
    `('$why', ({ text, expected }: Record<string, string>) => {
    assert.equal(
      substituteInString(text, resolve, () => undefined),
      expected,
    );
  });

  test('a name that is not a placeholder reports nothing unresolved', () => {
    const unresolved: string[] = [];
    substituteInString('{@ -foo @}', resolve, (n) => unresolved.push(n));
    assert.deepEqual(unresolved, []);
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { readFrontmatter } from './frontmatter.ts';
import {
  document,
  frontmatter,
  heading,
  link,
  list,
  listItem,
  parse,
  parseDocument,
  parseFragment,
  substitutePlaceholders,
  template,
  templateDocument,
  templateFragment,
} from './index.ts';
import type { MDValue } from './index.ts';

const page = '---\n# AUTO-GENERATED\ntitle: CSpell\nid: cspell\n---\n\n# CSpell\n';

interface ReadRow {
  markdown: string;
  expected: ReturnType<typeof readFrontmatter>;
}

describe('readFrontmatter', () => {
  testEach`
        markdown                         | expected
        ${'---\na: 1\n---\n# H'}         | ${{ yaml: 'a: 1', end: 13 }}
        ${'---\na: 1\nb: 2\n---'}        | ${{ yaml: 'a: 1\nb: 2', end: 17 }}
        ${'---\r\na: 1\r\n---\r\n'}      | ${{ yaml: 'a: 1', end: 16 }}
        ${'---\n---\n'}                  | ${{ yaml: '', end: 8 }}
        ${'---\n---\na\n---\n'}          | ${{ yaml: '', end: 8 }}
        ${'---\na\n----\n---\n'}         | ${{ yaml: 'a\n----', end: 15 }}
        ${'---\n\nText\n'}               | ${undefined}
        ${'--- \na\n---\n'}              | ${undefined}
        ${'\n---\na\n---\n'}             | ${undefined}
        ${'# H\n'}                       | ${undefined}
    `('$markdown', ({ markdown, expected }: ReadRow) => {
    assert.deepEqual(readFrontmatter(markdown), expected);
  });
});

describe('frontmatter', () => {
  test('goes first in a document, as written', () => {
    const md = document(frontmatter('# AUTO-GENERATED\ntitle: A *b*\nid: a'), heading(1, 'A *b*'));
    assert.equal(md.toString(), '---\n# AUTO-GENERATED\ntitle: A *b*\nid: a\n---\n\n# A \\*b\\*\n');
  });

  test('inserts the text as given', () => {
    assert.equal(document(frontmatter('\n  \ntitle: A\n\n')).toString(), '---\n\n  \ntitle: A\n\n---\n');
    assert.equal(document(frontmatter('title: A\n')).toString(), '---\ntitle: A\n---\n');
  });

  test('empty frontmatter', () => {
    assert.equal(document(frontmatter(''), 'Text').toString(), '---\n---\n\nText\n');
  });

  test('a document keeps it in a new style', () => {
    const md = document(frontmatter('a: 1'), list(['x'])).withStyle({ bullet: '*' });
    assert.equal(md.toString(), '---\na: 1\n---\n\n* x\n');
  });

  test('anywhere but first in a document throws', () => {
    assert.throws(() => document(heading(1, 'A'), frontmatter('a: 1') as unknown as MDValue as never), {
      message: 'frontmatter must be the first content of a document',
    });
  });

  test('outside a document throws', () => {
    assert.throws(() => listItem(frontmatter('a: 1') as unknown as MDValue as never), TypeError);
  });
});

describe('parseDocument', () => {
  test('keeps frontmatter as written', () => {
    const md = parseDocument('---\ntitle:   "A"   # note\n\nid: a\n---\n# A\n\n* x\n');
    assert.equal(md.toString(), '---\ntitle:   "A"   # note\n\nid: a\n---\n\n# A\n\n* x\n');
  });

  test('a file without frontmatter', () => {
    assert.equal(parseDocument('# A\n').toString(), '# A\n');
  });

  test('a leading rule with no closing line is a rule', () => {
    assert.equal(parseDocument('---\n\nText\n').toString(), '---\n\nText\n');
  });

  test('parse reads a fragment, so a leading `---` is a rule', () => {
    assert.equal(parse('---\n\nIntro\n\n---\n\nMore').toString(), '---\n\nIntro\n\n---\n\nMore');
    assert.equal(parseFragment, parse);
    assert.equal(templateFragment, template);
  });

  test('substitutePlaceholders fills its frontmatter', () => {
    const md = substitutePlaceholders(parseDocument('---\ntitle: {@ title @}\n---\n\n# {@ title @}\n'), {
      title: 'A *b*',
    });
    assert.equal(md.toString(), '---\ntitle: A *b*\n---\n\n# A \\*b\\*\n');
  });
});

interface FillRow {
  markdown: string;
  value: unknown;
  expected: string;
}

describe('templateDocument', () => {
  test('fills a page with frontmatter', () => {
    const md = templateDocument(page.replaceAll('CSpell', '{@ title @}').replace('cspell', '{@ id @}'), {
      title: 'Code *Spell*',
      id: 'code-spell',
    });
    assert.equal(
      md.toString(),
      '---\n# AUTO-GENERATED\ntitle: Code *Spell*\nid: code-spell\n---\n\n# Code \\*Spell\\*\n',
    );
  });

  testEach`
        kind                     | markdown                           | value                       | expected
        ${'a string as written'} | ${'---\na: {@ v @}\n---\n'}        | ${'x: "y"'}                 | ${'---\na: x: "y"\n---\n'}
        ${'a number'}            | ${'---\na: {@ v @}\n---\n'}        | ${3}                        | ${'---\na: 3\n---\n'}
        ${'a link as rendered'}  | ${'---\na: {@ v @}\n---\n'}        | ${link('A', 'a.md')}        | ${'---\na: [A](a.md)\n---\n'}
        ${'a multi-line string'} | ${'---\na: >-\n  {@ v @}\n---\n'}  | ${'one\ntwo'}               | ${'---\na: >-\n  one\n  two\n---\n'}
        ${'a list'}              | ${'---\na: |\n    {@ v @}\n---\n'} | ${list(['x', 'y'])}         | ${'---\na: |\n    - x\n    - y\n---\n'}
        ${'a sequence'}          | ${'---\na: {@ v @}\n---\n'}        | ${['See ', link('A', 'a')]} | ${'---\na: See [A](a)\n---\n'}
    `('$kind', ({ markdown, value, expected }: FillRow) => {
    assert.equal(templateDocument(markdown, { v: value as never }).toString(), expected);
  });

  test('a placeholder with no value is kept', () => {
    assert.equal(templateDocument('---\na: {@ v @}\n---\n', {}).toString(), '---\na: {@ v @}\n---\n');
  });

  test('without frontmatter, a leading `---` is a rule', () => {
    assert.equal(templateDocument('---\n\n{@ v @}\n', { v: 'A' }).toString(), '---\n\nA\n');
  });
});

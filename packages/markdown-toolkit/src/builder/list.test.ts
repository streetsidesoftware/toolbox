import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import { document, li, link, list, listItem, ol, taskListItem, text, ul } from '../index.ts';
import type { MDElement } from '../index.ts';

describe('numbered lists', () => {
  testEach`
    value                                                         | expected
    ${list(['a', 'b'])}                                           | ${'- a\n- b'}
    ${list(['a', 'b'], { ordered: false })}                       | ${'- a\n- b'}
    ${list(['a', 'b'], { ordered: true })}                        | ${'1. a\n1. b'}
    ${list(['a', 'b'], { ordered: true, start: 3 })}              | ${'3. a\n3. b'}
    ${ol(['a', 'b'])}                                             | ${'1. a\n1. b'}
    ${ol(['a', 'b'], { start: 0 })}                               | ${'0. a\n0. b'}
    ${ol(['a'], { start: 999_999_999 })}                          | ${'999999999. a'}
    ${ul(['a', 'b'])}                                             | ${'- a\n- b'}
    ${list([['Steps:', ol(['one', 'two'])]])}                     | ${'- Steps:\n  1. one\n  1. two'}
    ${document(ol(['a']), listItem('b'))}                         | ${'1. a\n1. b\n'}
    ${document(listItem('a'), ol(['b'], { start: 5 }))}           | ${'5. a\n5. b\n'}
    ${document(ol(['a']), ul(['b']))}                             | ${'1. a\n\n- b\n'}
  `('$expected', ({ value, expected }: { value: MDElement; expected: string }) => {
    assert.equal(value.toString(), expected);
  });

  test('ordered can come from a script', () => {
    assert.equal(numberedIf(true).toString(), '1. a');
    assert.equal(numberedIf(false).toString(), '- a');

    function numberedIf(numbered: boolean): MDElement {
      return list(['a'], { ordered: numbered });
    }
  });

  test('the page counts up, and a style can write each number', () => {
    assert.equal(
      document(ol(['a', 'b']))
        .withStyle({ incrementListMarker: true })
        .toString(),
      '1. a\n2. b\n',
    );
  });

  testEach`
    start      | given
    ${-1}      | ${'-1'}
    ${1.5}     | ${'1.5'}
    ${1e9}     | ${'1000000000'}
    ${'3'}     | ${'a string'}
  `(
    'a start that is not a whole number from 0 to 999999999: $start',
    ({ start, given }: { start: number; given: string }) => {
      assert.throws(
        () => ol(['a'], { start }),
        new TypeError(`a list start must be a whole number from 0 to 999999999, got ${given}`),
      );
    },
  );
});

describe('li', () => {
  testEach`
    value                                                         | expected
    ${li('a')}                                                    | ${'- a'}
    ${li('a', { checked: true })}                                 | ${'- [x] a'}
    ${li('a', { checked: false })}                                | ${'- [ ] a'}
    ${li(['See ', link('docs', 'u')], { checked: true })}         | ${'- [x] See [docs](u)'}
    ${li('Steps:', list(['one']), { checked: false })}            | ${'- [ ] Steps:\n  - one'}
    ${ol([li('a', { checked: true }), 'b'])}                      | ${'1. [x] a\n1. b'}
    ${document(li('a', { checked: true }), li('b'))}              | ${'- [x] a\n- b\n'}
    ${taskListItem('a')}                                          | ${'- [ ] a'}
    ${taskListItem('a', { checked: true })}                       | ${'- [x] a'}
    ${taskListItem('a', { checked: false })}                      | ${'- [ ] a'}
    ${taskListItem('a', list(['b']), { checked: true })}          | ${'- [x] a\n  - b'}
  `('$expected', ({ value, expected }: { value: MDElement; expected: string }) => {
    assert.equal(value.toString(), expected);
  });

  test('checked can come from a script', () => {
    const tasks = [
      { title: 'Write tests', done: true },
      { title: 'Ship', done: false },
    ];
    const md = list(tasks.map((task) => li(task.title, { checked: task.done })));
    assert.equal(md.toString(), '- [x] Write tests\n- [ ] Ship');
  });

  test('a list item takes an array of pieces spread into its arguments', () => {
    const pieces: string[] = ['a', 'b'];
    assert.equal(listItem(...pieces).toString(), '- a\n  b');
    assert.equal(listItem(...pieces, { checked: true }).toString(), '- [x] a\n  b');
  });

  test('a list item with no pieces has no box', () => {
    assert.equal(listItem().toString(), '-');
    assert.equal(listItem({ checked: true }).toString(), '-');
  });

  test('options come once, after the pieces', () => {
    const error = new TypeError('list item content must be inline, got an object');
    // @ts-expect-error options go after the pieces
    assert.throws(() => listItem({ checked: true }, 'a'), error);
    // @ts-expect-error one options object at most
    assert.throws(() => listItem('a', { checked: true }, { checked: false }), error);
  });

  test('options never hold kind or type', () => {
    // @ts-expect-error an element's key
    assert.equal(listItem('a', { checked: true, kind: undefined }).toString(), '- [x] a');
    // @ts-expect-error an element's key
    assert.equal(listItem('a', { checked: true, type: undefined }).toString(), '- [x] a');
  });

  test('only an element is taken for a piece', () => {
    const notAnElement = { kind: 'inline', type: 'text', checked: true };
    // @ts-expect-error options never hold kind or type
    assert.equal(listItem('a', notAnElement).toString(), '- [x] a');
    assert.equal(listItem('a', text('b')).toString(), '- a\n  b');
    assert.equal(listItem('a', link('docs', 'u')).toString(), '- a\n  [docs](u)');
  });

  test('options take only their own keys', () => {
    // @ts-expect-error not an option
    assert.equal(listItem('a', { size: 1 }).toString(), '- a');
  });

  test('options can be undefined', () => {
    const options: { checked?: boolean } | undefined = undefined;
    assert.equal(listItem('a', options).toString(), '- a');
  });

  test('a task list item takes an array of pieces spread into its arguments', () => {
    const pieces: string[] = ['a', 'b'];
    assert.equal(taskListItem(...pieces).toString(), '- [ ] a\n  b');
  });

  test('a task list item with no pieces has no box', () => {
    assert.equal(taskListItem().toString(), '-');
    assert.equal(taskListItem({ checked: true }).toString(), '-');
  });
});

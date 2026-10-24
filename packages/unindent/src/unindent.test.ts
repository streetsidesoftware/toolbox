import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createUnindent, indent, unindent } from './index.ts';

describe('unindent string', () => {
  test('removes the common indentation', () => {
    assert.equal(unindent('    a\n      b\n    c'), 'a\n  b\nc');
  });

  test('keeps leading and trailing newlines', () => {
    assert.equal(unindent('\n  a\n'), '\na\n');
  });

  test('ignores blank and whitespace-only lines when finding the indentation', () => {
    assert.equal(unindent('    a\n\n \n    b'), 'a\n\n\nb');
  });

  test('keeps the extra whitespace of a whitespace-only line longer than the indentation', () => {
    assert.equal(unindent('  a\n      \n  b'), 'a\n    \nb');
  });

  test('counts indentation in characters, without normalizing tabs', () => {
    assert.equal(unindent('\ta\n  b'), 'a\n b');
  });

  test('passes CRLF line endings through', () => {
    assert.equal(unindent('  a\r\n    b\r\n'), 'a\r\n  b\r\n');
  });

  test('returns an empty string for all-blank input', () => {
    assert.equal(unindent('  \n  '), '\n');
    assert.equal(unindent(''), '');
  });
});

describe('unindent tagged template', () => {
  test('removes the common indentation', () => {
    const s = unindent`
      a
        b
    `;
    assert.equal(s, '\na\n  b\n');
  });

  test('a line continuation drops the first newline', () => {
    const s = unindent`\
      a
        b`;
    assert.equal(s, 'a\n  b');
  });

  test('processes escape sequences', () => {
    assert.equal(unindent`  a\n  b\t`, 'a\nb\t');
  });

  test('indents a multi-line value to the line it is inserted on', () => {
    const items = 'a\nb';
    const s = unindent`
      list:
        ${items}
    `;
    assert.equal(s, '\nlist:\n  a\n  b\n');
  });

  test('uses the line indentation, not the column of the value', () => {
    const items = 'a\nb';
    const s = unindent`
      - ${items}
    `;
    assert.equal(s, '\n- a\nb\n');
  });

  test('pads a later value on the same line by the line indentation', () => {
    const a = 'a1\na2';
    const b = 'b1\nb2';
    const s = unindent`
        x: ${a}, y: ${b}
    `;
    assert.equal(s, '\nx: a1\na2, y: b1\nb2\n');
  });

  test('keeps tab indentation for inserted values', () => {
    const value = 'a\nb';
    const s = unindent`\n\tx:\n\t\t${value}\n`;
    assert.equal(s, '\nx:\n\ta\n\tb\n');
  });

  test('converts values to strings', () => {
    assert.equal(unindent`  ${1} ${true} ${null}`, '1 true null');
  });
});

describe('createUnindent', () => {
  test('with no options, matches unindent', () => {
    const u = createUnindent();
    assert.equal(u`\n    a\n      b\n  `, unindent`\n    a\n      b\n  `);
    assert.equal(u('\n  a\n'), '\na\n');
  });

  test('trimFirstNewline drops one leading newline', () => {
    const u = createUnindent({ trimFirstNewline: true });
    const s = u`
      a
        b
    `;
    assert.equal(s, 'a\n  b\n');
    assert.equal(u('\n\n  a'), '\na');
    assert.equal(u('\r\n  a'), 'a');
  });

  test('trimLastLine drops a trailing whitespace-only line', () => {
    const u = createUnindent({ trimLastLine: true });
    const s = u`
      a
        b
    `;
    assert.equal(s, '\na\n  b');
    assert.equal(u('  a\n\n'), 'a\n');
    assert.equal(u('  a\r\n  '), 'a');
    assert.equal(u('  a\n  b'), 'a\nb');
  });

  test('both options together', () => {
    const u = createUnindent({ trimFirstNewline: true, trimLastLine: true });
    const items = 'x\ny';
    const s = u`
      Usage: tool
        ${items}
    `;
    assert.equal(s, 'Usage: tool\n  x\n  y');
  });
});

describe('indent', () => {
  test('pads every line except the first', () => {
    assert.equal(indent('a\nb\nc', '  '), 'a\n  b\n  c');
  });

  test('pads the first line with firstLinePadding', () => {
    assert.equal(indent('a\nb', '  ', '- '), '- a\n  b');
  });
});

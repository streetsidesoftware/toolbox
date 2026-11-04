import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { testEach } from '@streetsidesoftware/test-each';

import {
  blockPlaceholder,
  blockTemplate,
  inlineTemplate,
  list,
  paragraph,
  placeholder,
  substitutePlaceholders,
  template,
  templateDocument,
} from '../index.ts';
import type { TemplateResolver, TemplateValue, TemplateValues } from '../index.ts';
import { resolveValue } from './values.ts';

interface ResolveRow {
  values: TemplateValues;
  name: string;
  expected: TemplateValue | undefined;
}

describe('resolveValue', () => {
  const laterNested = { 'a.b': { c: 1, e: 5 }, a: { b: { c: 0, d: 1 } } };
  const laterDotted = { a: { b: { c: 0, d: 1 } }, 'a.b': { c: 1 } };

  testEach`
        values         | name       | expected
        ${laterNested} | ${'a.b.c'} | ${0}
        ${laterNested} | ${'a.b.d'} | ${1}
        ${laterNested} | ${'a.b.e'} | ${5}
        ${laterDotted} | ${'a.b.c'} | ${1}
        ${laterDotted} | ${'a.b.d'} | ${1}
        ${laterDotted} | ${'a.b.e'} | ${undefined}
        ${laterDotted} | ${'a.b'}   | ${undefined}
    `('$name in $values is $expected', ({ values, name, expected }: ResolveRow) => {
    assert.equal(resolveValue(values, name), expected);
  });

  test('a nested key with a dot never matches', () => {
    assert.equal(resolveValue({ a: { 'b.c': 1 } }, 'a.b.c'), undefined);
  });

  test('only own properties count', () => {
    assert.equal(resolveValue({}, 'toString'), undefined);
    assert.equal(resolveValue({ a: {} }, 'a.constructor'), undefined);
  });
});

describe('a resolver', () => {
  const versions: TemplateResolver = (name) => (name.startsWith('v.') ? name.slice(2) : undefined);

  test('substitutes the value it returns', () => {
    assert.equal(template('Version {@ v.1 @}', versions).toString(), 'Version 1');
  });

  test('gets the whole dotted name', () => {
    const names: string[] = [];
    template('{@ engines.cspell @}', (name) => {
      names.push(name);
      return undefined;
    });
    assert.deepEqual(names, ['engines.cspell']);
  });

  test('a placeholder it returns undefined for is kept', () => {
    assert.equal(template('{@ v.1 @} and {@ other @}', versions).toString(), '1 and {@ other @}');
  });

  test('a result that is not a template value counts as no value', () => {
    const resolve = (() => ({ a: 1 })) as unknown as TemplateResolver;
    assert.equal(template('Hi {@ x @}', resolve).toString(), 'Hi {@ x @}');
    assert.equal(template('`{@ x @}`', resolve).toString(), '`{@ x @}`');
    const none = (() => null) as unknown as TemplateResolver;
    assert.equal(template('Hi {@ x @}', none).toString(), 'Hi {@ x @}');
  });

  test('works in HTML', () => {
    assert.equal(template('<b>{@ v.5 @}</b>', versions).toString(), '<b>5</b>');
  });

  test('a returned element is substituted', () => {
    const md = template('Intro.\n\n{@ items @}\n', () => list(['a', 'b']));
    assert.equal(md.toString(), 'Intro.\n\n- a\n- b');
  });

  test('works in code and frontmatter', () => {
    const md = templateDocument('---\nversion: {@ v.2 @}\n---\n\n`npm i x@{@ v.2 @}`\n', versions);
    assert.equal(md.toString(), '---\nversion: 2\n---\n\n`npm i x@2`\n');
  });

  test('works with blockTemplate and inlineTemplate', () => {
    assert.equal(blockTemplate('Version {@ v.3 @}', versions).toString(), 'Version 3');
    assert.equal(inlineTemplate('Version {@ v.3 @}', versions).toString(), 'Version 3');
  });

  test('works with substitutePlaceholders', () => {
    assert.equal(substitutePlaceholders('Version {@ v.4 @}', versions).toString(), 'Version 4');
    assert.equal(substitutePlaceholders(paragraph('Version ', placeholder('v.4')), versions).toString(), 'Version 4');
    assert.equal(substitutePlaceholders(placeholder('v.4'), versions).toString(), '4');
    const kept = placeholder('other');
    assert.equal(substitutePlaceholders(kept, versions), kept);
    const block = blockPlaceholder('other');
    assert.equal(substitutePlaceholders(block, versions), block);
    assert.equal(substitutePlaceholders(blockPlaceholder('items'), () => list(['a'])).toString(), '- a');
  });
});

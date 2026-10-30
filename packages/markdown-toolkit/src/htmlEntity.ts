import { characterEntities } from 'character-entities';

import { htmlEntityNode } from './htmlEntityNode.ts';
import { isKind, MarkdownElement } from './nodes.ts';
import type { MDHtmlEntity } from './types.ts';

class HtmlEntityElement extends MarkdownElement<'inline', 'htmlEntity'> implements MDHtmlEntity {
  readonly character: string;

  constructor(reference: string, character: string) {
    super('inline', 'htmlEntity', 'an HTML entity', [htmlEntityNode(reference)]);
    this.character = character;
  }
}

/**
 * Create a character written as an HTML reference, such as `&nbsp;` for a no-break space.
 *
 * Use it for a character that's hard to type or to see in the file, such as a no-break space.
 *
 * It takes any of:
 * - A character: `'\u00A0'` gives `&nbsp;`. A character with several names gets the shortest, and one with none
 *   gets its number, such as `&#x20;` for a space.
 * - A name: `'nbsp'` gives `&nbsp;`.
 * - A reference: `'&nbsp;'` or `'&#xA0;'` is kept unchanged.
 *
 * A name HTML doesn't define is an error. For the common ones, use a constant such as {@link nbsp} or {@link mdash}.
 *
 * @example
 * md.p('10', md.htmlEntity('nbsp'), 'km');
 * // 10&nbsp;km
 * @category text
 */
export function htmlEntity(value: string): MDHtmlEntity {
  const numeric = /^&#(?:x([\da-f]+)|(\d+));$/i.exec(value);
  if (numeric) {
    const codePoint = numeric[1] ? Number.parseInt(numeric[1], 16) : Number(numeric[2]);
    return new HtmlEntityElement(value, String.fromCodePoint(codePoint));
  }
  const given = /^&(.+);$/.exec(value)?.[1] ?? value;
  if (Object.hasOwn(characterEntities, given)) return new HtmlEntityElement(`&${given};`, characterEntities[given]);
  // A few names stand for two code points, such as `nvlt` for `<` and U+20D2.
  const name = nameOf(value);
  if (name) return new HtmlEntityElement(`&${name};`, value);
  if ([...value].length === 1) return new HtmlEntityElement(numberFor(value), value);
  throw new Error(`unknown HTML entity name: "${given}"`);
}

/**
 * Holds a no-break space, written `&nbsp;`. The words on either side of it stay on one line.
 * @category text
 */
export const nbsp: MDHtmlEntity = htmlEntity('nbsp');

/**
 * Holds a space as wide as the letter n, written `&ensp;`.
 * @category text
 */
export const ensp: MDHtmlEntity = htmlEntity('ensp');

/**
 * Holds a space as wide as the letter m, written `&emsp;`.
 * @category text
 */
export const emsp: MDHtmlEntity = htmlEntity('emsp');

/**
 * Holds a thin space, written `&thinsp;`.
 * @category text
 */
export const thinsp: MDHtmlEntity = htmlEntity('thinsp');

/**
 * Holds a soft hyphen, written `&shy;`. A long word may break there, and shows a hyphen only when it does.
 * @category text
 */
export const shy: MDHtmlEntity = htmlEntity('shy');

/**
 * Holds an em dash, written `&mdash;`.
 * @category text
 */
export const mdash: MDHtmlEntity = htmlEntity('mdash');

/**
 * Holds an en dash, written `&ndash;`.
 * @category text
 */
export const ndash: MDHtmlEntity = htmlEntity('ndash');

/**
 * Holds an ellipsis, written `&hellip;`.
 * @category text
 */
export const hellip: MDHtmlEntity = htmlEntity('hellip');

/**
 * Holds a copyright sign, written `&copy;`.
 * @category text
 */
export const copy: MDHtmlEntity = htmlEntity('copy');

/** Check whether a value is a character made by {@link htmlEntity}. */
export function isHtmlEntity(value: unknown): value is MDHtmlEntity {
  return isKind(value, 'inline') && value.type === 'htmlEntity';
}

function numberFor(character: string): string {
  return `&#x${(character.codePointAt(0) as number).toString(16).toUpperCase()};`;
}

let names: Map<string, string> | undefined;

/** Holds familiar HTML 4 names for characters whose alphabetical tie picks an obscure one, such as `angst` for Å. */
const familiarNames: Record<string, string> = { '\u00C5': 'Aring', '\u00A8': 'uml' };

/**
 * Return the name for a character: its shortest, and between spellings of one name, such as `lt` and `LT`, the
 * lowercase one.
 * Other ties go to the first name alphabetically, ignoring case, unless the character has a familiar name.
 */
function nameOf(character: string): string | undefined {
  names ??= shortestNames();
  return names.get(character);
}

function shortestNames(): Map<string, string> {
  const result = new Map<string, string>();
  for (const [name, character] of Object.entries(characterEntities)) {
    const known = result.get(character);
    if (known === undefined || comesFirst(name, known)) result.set(character, name);
  }
  for (const [character, name] of Object.entries(familiarNames)) result.set(character, name);
  return result;
}

function comesFirst(name: string, other: string): boolean {
  if (name.length !== other.length) return name.length < other.length;
  const [a, b] = [name.toLowerCase(), other.toLowerCase()];
  return a === b ? name === a : a < b;
}

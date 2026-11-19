import { characterEntities } from 'character-entities';

import type { Span } from './span.ts';

const ignorable = /\p{Default_Ignorable_Code_Point}/u;
const emoji = /\p{Emoji}/u;
const pictographic = /\p{Extended_Pictographic}/u;
const reference = /&(?:#[xX]([0-9a-fA-F]{1,6})|#([0-9]{1,7})|([A-Za-z][A-Za-z0-9]{0,31}));/g;

const ZWJ = 0x200d;
const VS15 = 0xfe0e;
const VS16 = 0xfe0f;
const BLACK_FLAG = 0x1f3f4;
const CANCEL_TAG = 0xe007f;

/**
 * Find the runs of invisible characters, as spans of the source.
 *
 * A character is invisible when Unicode says a font may draw nothing for it: its Default_Ignorable_Code_Point
 * property. That covers zero-width characters, bidi controls, variation selectors and tag characters.
 *
 * Emoji need some of them, so these are left alone:
 * - Variation selector 15 or 16 right after an emoji character, as in U+2764 U+FE0F, a red heart.
 * - A zero-width joiner between two emoji, as in U+1F469 U+200D U+1F4BB, a technologist. A skin tone or variation
 *   selector 16 may come between the first emoji and the joiner.
 * - A subdivision flag, such as the Scotland flag: 🏴, then a subdivision code in tag letters and digits, then the
 *   cancel tag. A subdivision code is a two-letter region and one to four letters or digits.
 *
 * @param skip - spans already found hidden, sorted and not overlapping. A run inside one isn't reported.
 */
export function findInvisibleCharacters(markdown: string, skip: Span[]): Span[] {
  const spans: Span[] = [];
  let skipIndex = 0;
  let before = 0;
  let previous = 0;

  for (let pos = 0; pos < markdown.length;) {
    while (skipIndex < skip.length && skip[skipIndex].end <= pos) skipIndex++;
    const covering = skip[skipIndex];
    if (covering && covering.start <= pos) {
      pos = covering.end;
      before = previous = 0;
      continue;
    }

    const cp = markdown.codePointAt(pos) ?? 0;
    const size = cp > 0xffff ? 2 : 1;

    if (cp === BLACK_FLAG) {
      const flagEnd = subdivisionFlagEnd(markdown, pos + size);
      if (flagEnd !== undefined) {
        pos = flagEnd;
        before = previous = 0;
        continue;
      }
    }

    if (
      ignorable.test(String.fromCodePoint(cp)) &&
      !isEmojiPart(cp, before, previous, markdown.codePointAt(pos + size))
    ) {
      addSpan(spans, pos, pos + size);
    }

    before = previous;
    previous = cp;
    pos += size;
  }

  return spans;
}

/**
 * Find the character references, such as `&#x200B;` or `&zwj;`, that the page turns into invisible characters, as
 * spans of the source. Emoji written as references aren't left alone, since nobody writes them that way.
 *
 * @param skip - spans where a reference is no reference or is already found hidden, such as code, sorted and not
 *   overlapping.
 */
export function findInvisibleReferences(markdown: string, skip: Span[]): Span[] {
  const spans: Span[] = [];
  let skipIndex = 0;

  for (const match of markdown.matchAll(reference)) {
    const start = match.index;
    while (skipIndex < skip.length && skip[skipIndex].end <= start) skipIndex++;
    if (skip[skipIndex] && skip[skipIndex].start <= start) continue;
    if (isEscaped(markdown, start)) continue;
    const [, hex, decimal, name] = match;
    const decoded = name !== undefined ? characterEntities[name] : String.fromCodePoint(codePoint(hex, decimal));
    if (decoded !== undefined && ignorable.test(decoded)) addSpan(spans, start, start + match[0].length);
  }

  return spans;
}

/** Add a span, joining it to the last one when they touch. */
function addSpan(spans: Span[], start: number, end: number): void {
  const last = spans.at(-1);
  if (last && last.end === start) last.end = end;
  else spans.push({ start, end });
}

/**
 * Tell whether an invisible character is one an emoji needs.
 * @param before - the code point before `previous`, or 0.
 * @param previous - the code point before `cp`, or 0.
 * @param next - the code point after `cp`.
 */
function isEmojiPart(cp: number, before: number, previous: number, next: number | undefined): boolean {
  if (cp === VS15 || cp === VS16) return previous !== 0 && emoji.test(String.fromCodePoint(previous));
  if (cp !== ZWJ || next === undefined) return false;
  const base = previous === VS16 || isSkinTone(previous) ? before : previous;
  return base !== 0 && pictographic.test(String.fromCodePoint(base)) && pictographic.test(String.fromCodePoint(next));
}

function isSkinTone(cp: number): boolean {
  return cp >= 0x1f3fb && cp <= 0x1f3ff;
}

/** Return the end of the subdivision code and cancel tag at `pos`, after a 🏴, or `undefined` if there isn't one. */
function subdivisionFlagEnd(markdown: string, pos: number): number | undefined {
  let code = '';
  for (let at = pos; at < markdown.length; at += 2) {
    const cp = markdown.codePointAt(at) ?? 0;
    if (cp === CANCEL_TAG) return /^[a-z]{2}[a-z0-9]{1,4}$/.test(code) ? at + 2 : undefined;
    if (cp < 0xe0020 || cp > 0xe007e || code.length >= 6) return undefined;
    code += String.fromCodePoint(cp - 0xe0000);
  }
  return undefined;
}

/** Tell whether an odd number of backslashes comes right before `pos`, so the `&` there is plain text. */
function isEscaped(markdown: string, pos: number): boolean {
  let count = 0;
  while (pos - count > 0 && markdown[pos - count - 1] === '\\') count++;
  return count % 2 === 1;
}

/** Decode a numeric reference as the page does: an invalid code point becomes U+FFFD. */
function codePoint(hex: string | undefined, decimal: string | undefined): number {
  const cp = hex !== undefined ? Number.parseInt(hex, 16) : Number(decimal);
  return cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? 0xfffd : cp;
}

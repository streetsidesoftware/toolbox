import { characterEntities } from 'character-entities';

import type { Span } from './span.ts';

const ignorable = /\p{Default_Ignorable_Code_Point}/u;
const emoji = /\p{Emoji}/u;
const reference = /&(?:#[xX]([0-9a-fA-F]{1,6})|#([0-9]{1,7})|([A-Za-z][A-Za-z0-9]{0,31}));/g;

/**
 * The invisible characters that are ok anywhere. They only control line breaks, joining or the direction of
 * punctuation, and one of them alone carries nothing a reader can decode.
 */
const ok = new Set([
  0x00ad, // soft hyphen
  0x061c, // Arabic letter mark
  0x200b, // zero-width space
  0x200c, // zero-width non-joiner
  0x200d, // zero-width joiner
  0x200e, // left-to-right mark
  0x200f, // right-to-left mark
  0x2060, // word joiner
  0xfeff, // byte order mark
]);

const VS15 = 0xfe0e;
const VS16 = 0xfe0f;
const BLACK_FLAG = 0x1f3f4;
const CANCEL_TAG = 0xe007f;

/**
 * Find the runs of invisible characters, as spans of the source.
 *
 * A character is invisible when Unicode says a font may draw nothing for it: its Default_Ignorable_Code_Point
 * property. That covers bidi controls, variation selectors, tag characters and more. The characters in {@link ok}
 * aren't reported.
 *
 * Emoji need some of the others, so these are left alone:
 * - Variation selector 15 or 16 right after an emoji character, as in U+2764 U+FE0F, a red heart.
 * - A subdivision flag, such as the Scotland flag: 🏴, then a subdivision code in tag letters and digits, then the
 *   cancel tag. A subdivision code is a two-letter region and one to four letters or digits.
 *
 * @param skip - spans already found hidden, sorted and not overlapping. A run inside one isn't reported.
 */
export function findInvisibleCharacters(markdown: string, skip: Span[]): Span[] {
  const spans: Span[] = [];
  let skipIndex = 0;
  let previous = 0;

  for (let pos = 0; pos < markdown.length;) {
    while (skipIndex < skip.length && skip[skipIndex].end <= pos) skipIndex++;
    const covering = skip[skipIndex];
    if (covering && covering.start <= pos) {
      pos = covering.end;
      previous = 0;
      continue;
    }

    const cp = markdown.codePointAt(pos) ?? 0;
    const size = cp > 0xffff ? 2 : 1;

    if (cp === BLACK_FLAG) {
      const flagEnd = subdivisionFlagEnd(markdown, pos + size);
      if (flagEnd !== undefined) {
        pos = flagEnd;
        previous = 0;
        continue;
      }
    }

    if (isHiding(String.fromCodePoint(cp)) && !isEmojiSelector(cp, previous)) addSpan(spans, pos, pos + size);

    previous = cp;
    pos += size;
  }

  return spans;
}

/**
 * Find the character references, such as `&#x202E;`, that the page turns into invisible characters that aren't ok,
 * as spans of the source. Emoji written as references aren't left alone, since nobody writes them that way.
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
    if (decoded !== undefined && [...decoded].some(isHiding)) addSpan(spans, start, start + match[0].length);
  }

  return spans;
}

/** Add a span, joining it to the last one when they touch. */
function addSpan(spans: Span[], start: number, end: number): void {
  const last = spans.at(-1);
  if (last && last.end === start) last.end = end;
  else spans.push({ start, end });
}

/** Tell whether a character is invisible and not ok. */
function isHiding(char: string): boolean {
  return ignorable.test(char) && !ok.has(char.codePointAt(0) ?? 0);
}

/** Tell whether `cp` is variation selector 15 or 16 right after an emoji character, `previous`. */
function isEmojiSelector(cp: number, previous: number): boolean {
  return (cp === VS15 || cp === VS16) && previous !== 0 && emoji.test(String.fromCodePoint(previous));
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

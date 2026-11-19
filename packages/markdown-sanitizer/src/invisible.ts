import type { Span } from './span.ts';

const emoji = /\p{Emoji}/u;
const reference = /&#(?:[xX]([0-9a-fA-F]{1,6})|([0-9]{1,7}));/g;

const VS15 = 0xfe0e;
const VS16 = 0xfe0f;
const BLACK_FLAG = 0x1f3f4;
const CANCEL_TAG = 0xe007f;

/**
 * Find the runs of tag characters and variation selectors, as spans of the source.
 *
 * The page shows nothing for either, yet both reach a model: it reads tag characters as text, and a run of variation
 * selectors can steer it. Other invisible characters, such as the zero-width space, carry nothing a model acts on.
 *
 * Emoji need some of them, so these are left alone:
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

    if (isHiding(cp) && !isEmojiSelector(cp, previous)) addSpan(spans, pos, pos + size);

    previous = cp;
    pos += size;
  }

  return spans;
}

/**
 * Find the numeric character references, such as `&#xE0041;`, that the page turns into tag characters or variation
 * selectors, as spans of the source. Emoji written as references aren't left alone, since nobody writes them that way.
 *
 * A named reference never hides anything: the only ones with a variation selector put it after a visible math symbol.
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
    const [, hex, decimal] = match;
    const cp = hex !== undefined ? Number.parseInt(hex, 16) : Number(decimal);
    if (isHiding(cp)) addSpan(spans, start, start + match[0].length);
  }

  return spans;
}

/** Add a span, joining it to the last one when they touch. */
function addSpan(spans: Span[], start: number, end: number): void {
  const last = spans.at(-1);
  if (last && last.end === start) last.end = end;
  else spans.push({ start, end });
}

/** Tell whether `cp` is a tag character or a variation selector, which a model reads though the page shows nothing. */
function isHiding(cp: number): boolean {
  return (cp >= 0xe0000 && cp <= 0xe007f) || (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef);
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

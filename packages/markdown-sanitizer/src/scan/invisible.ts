// cspell:ignore gbeng gbsct gbwls
import type { Span } from './spans.ts';

const emoji = /\p{Emoji}/u;
/** A numeric character reference as a browser reads it in HTML, which allows more than Markdown does. */
const reference = /&#(?:[xX]([0-9a-fA-F]+)|([0-9]+));?/g;

const VS15 = 0xfe0e;
const VS16 = 0xfe0f;
const BLACK_FLAG = 0x1f3f4;
const CANCEL_TAG = 0xe007f;

/** The subdivisions with a flag emoji: England, Scotland and Wales. */
const flagSubdivisions = new Set(['gbeng', 'gbsct', 'gbwls']);

/**
 * Find the runs of tag characters and variation selectors, as spans of the source.
 *
 * The page shows nothing for either, yet both reach a model: it reads tag characters as text, and a run of variation
 * selectors can steer it. Other invisible characters, such as the zero-width space, carry nothing a model acts on.
 *
 * Emoji need some of them, so these are left alone:
 * - Variation selector 15 or 16 right after an emoji character, as in U+2764 U+FE0F, a red heart.
 * - The flag of England, Scotland or Wales: 🏴, then the subdivision's code in tag letters, then the cancel tag. No
 *   other subdivision has a flag emoji, so the page shows a plain black flag for it, and its tags spell text.
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
 * - In text, a reference follows Markdown: up to 6 hex or 7 decimal digits, then `;`, with no backslash before it.
 * - In raw HTML, the browser reads it: any number of digits, the `;` left out, and a backslash before it is text.
 *
 * A named reference never hides anything: the only ones with a variation selector put it after a visible math symbol.
 *
 * @param skip - spans where a reference is no reference or is already found hidden, such as code, sorted and not
 *   overlapping.
 * @param html - the spans of raw HTML, sorted and not overlapping.
 */
export function findInvisibleReferences(markdown: string, skip: Span[], html: Span[]): Span[] {
  const spans: Span[] = [];
  const inSkip = cursor(skip);
  const inHtml = cursor(html);

  for (const match of markdown.matchAll(reference)) {
    const start = match.index;
    if (inSkip(start)) continue;
    const [text, hex, decimal] = match;
    if (!inHtml(start) && !isMarkdownReference(markdown, start, text, hex ?? decimal)) continue;
    const cp = hex !== undefined ? Number.parseInt(hex, 16) : Number(decimal);
    if (isHiding(cp)) addSpan(spans, start, start + text.length);
  }

  return spans;
}

/** Return a test of whether a position is inside one of `spans`, for positions that only grow. */
function cursor(spans: Span[]): (pos: number) => boolean {
  let index = 0;
  return (pos) => {
    while (index < spans.length && spans[index].end <= pos) index++;
    return index < spans.length && spans[index].start <= pos;
  };
}

/** Tell whether a reference that a browser reads is one in Markdown text too. */
function isMarkdownReference(markdown: string, start: number, text: string, digits: string): boolean {
  const limit = text[2] === 'x' || text[2] === 'X' ? 6 : 7;
  return text.endsWith(';') && digits.length <= limit && !isEscaped(markdown, start);
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

/**
 * Return the end of the subdivision code and cancel tag at `pos`, after a 🏴, or `undefined` if they don't make the
 * flag of England, Scotland or Wales.
 */
function subdivisionFlagEnd(markdown: string, pos: number): number | undefined {
  let code = '';
  for (let at = pos; at < markdown.length && code.length <= 5; at += 2) {
    const cp = markdown.codePointAt(at) ?? 0;
    if (cp === CANCEL_TAG) return flagSubdivisions.has(code) ? at + 2 : undefined;
    if (cp < 0xe0020 || cp > 0xe007e) return undefined;
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

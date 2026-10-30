/** Describes a function that removes the common leading whitespace, called on a string or as a template tag. */
export interface Unindent {
  /**
   * Remove the common leading whitespace from every line of a multi-line string.
   *
   * Blank and whitespace-only lines don't count when finding the common indentation.
   */
  (str: string): string;

  /**
   * Remove the common leading whitespace from every line of a template literal.
   *
   * A multi-line value keeps its shape: each of its lines after the first gets the leading whitespace of the
   * template line it goes on. An empty line stays empty.
   */
  (template: TemplateStringsArray, ...values: unknown[]): string;
}

/** Describes which lines {@link createUnindent} drops. */
export interface UnindentOptions {
  /** Drops one leading newline. Default: `false`. */
  trimFirstNewline?: boolean | undefined;
  /** Drops the last line, with the newline before it, when it's blank or whitespace-only. Default: `false`. */
  trimLastLine?: boolean | undefined;
}

/**
 * Create a function that works like {@link unindent}, and can also drop a leading newline and a blank last line.
 *
 * @example
 * const trimmedUnindent = createUnindent({ trimFirstNewline: true, trimLastLine: true });
 * trimmedUnindent`
 *     Hello
 *       world
 *     `;
 * // 'Hello\n  world'
 */
export function createUnindent(options: UnindentOptions = {}): Unindent {
  const { trimFirstNewline = false, trimLastLine = false } = options;

  function customUnindent(templateOrString: TemplateStringsArray | string, ...values: unknown[]): string {
    let str = unindentAny(templateOrString, values);
    if (trimFirstNewline) str = str.replace(/^\r?\n/, '');
    if (trimLastLine) str = str.replace(/\r?\n[^\S\r\n]*$/, '');
    return str;
  }

  return customUnindent;
}

/**
 * Remove the common leading whitespace from every line of a string or template literal.
 *
 * A leading newline and a blank last line stay. To drop them, use {@link createUnindent}.
 *
 * @example
 * unindent`
 *     Hello
 *       world
 * `;
 * // '\nHello\n  world\n'
 */
export const unindent: Unindent = function unindent(
  templateOrString: TemplateStringsArray | string,
  ...values: unknown[]
): string {
  return unindentAny(templateOrString, values);
};

/**
 * Add padding to the start of each line of a multi-line string.
 *
 * - Each line after the first gets `padding`. An empty one stays empty.
 * - The first line gets `firstLinePadding`, empty by default, so the result can follow text already on a line.
 *
 * @example
 * indent('a\nb\n\nc', '  ');
 * // 'a\n  b\n\n  c'
 */
export function indent(str: string, padding: string, firstLinePadding: string = ''): string {
  const [first, ...rest] = str.split('\n');
  const lines = [firstLinePadding + first];
  for (const line of rest) {
    // A lone `\r` is the line ending of an empty CRLF line.
    lines.push(line === '' || line === '\r' ? line : padding + line);
  }

  return lines.join('\n');
}

function unindentAny(templateOrString: TemplateStringsArray | string, values: unknown[]): string {
  const str = typeof templateOrString === 'string' ? templateOrString : keepIndent(templateOrString, values);
  return unindentString(str);
}

function keepIndent(template: TemplateStringsArray, values: unknown[]): string {
  const adjValues = values.map((value, i) => indent(`${value}`, linePadding(template, i)));
  return String.raw({ raw: template }, ...adjValues);
}

/** Return the leading whitespace of the template line that value `pos` goes on. */
function linePadding(template: TemplateStringsArray, pos: number): string {
  // The line can start in an earlier chunk when several values share it.
  while (pos > 0 && !template[pos]?.includes('\n')) {
    --pos;
  }
  const chunk = template[pos] ?? '';
  const line = chunk.slice(chunk.lastIndexOf('\n') + 1);
  return line.slice(0, padLength(line));
}

/**
 * Return the length of the leading whitespace.
 * A `\r` doesn't count, so unindenting keeps CRLF line endings.
 */
function padLength(s: string): number {
  return /^[^\S\r]*/.exec(s)?.[0].length ?? 0;
}

function unindentString(str: string): string {
  const lines = str.split('\n');
  let curPad = str.length;
  for (const line of lines) {
    if (!line.trim()) continue;
    curPad = Math.min(curPad, padLength(line));
  }

  // A whitespace-only line can be shorter than curPad.
  return lines.map((line) => line.slice(Math.min(curPad, padLength(line)))).join('\n');
}

/**
 * Remove the common leading whitespace from every line of a multi-line string.
 * Blank and whitespace-only lines are ignored when finding the common indentation.
 * @param str - multi-line string to unindent
 * @returns the unindented string
 */
export function unindent(str: string): string;

/**
 * Tagged template that removes the common leading whitespace from every line.
 * A multi-line value keeps its shape: each of its lines after the first gets the leading whitespace of the
 * template line it is inserted on.
 * @param template - template strings
 * @param values - values to insert
 * @returns the unindented string
 */
export function unindent(template: TemplateStringsArray, ...values: unknown[]): string;

export function unindent(templateOrString: TemplateStringsArray | string, ...values: unknown[]): string {
  const str = typeof templateOrString === 'string' ? templateOrString : keepIndent(templateOrString, values);
  return unindentString(str);
}

/**
 * Add padding to each line of a multi-line string.
 * @param str - multi-line string to indent
 * @param padding - the padding added to every line except the first
 * @param firstLinePadding - the padding added to the first line
 * @returns the indented string
 */
export function indent(str: string, padding: string, firstLinePadding: string = ''): string {
  let pad = firstLinePadding;
  const lines: string[] = [];
  for (const line of str.split('\n')) {
    lines.push(pad + line);
    pad = padding;
  }

  return lines.join('\n');
}

function keepIndent(template: TemplateStringsArray, values: unknown[]): string {
  const adjValues = values.map((value, i) => indent(`${value}`, linePadding(template, i)));
  return String.raw({ raw: template }, ...adjValues);
}

/** The leading whitespace of the template line that value `pos` is inserted on. */
function linePadding(template: TemplateStringsArray, pos: number): string {
  // The line can start in an earlier chunk when several values share it.
  while (pos > 0 && !template[pos]?.includes('\n')) {
    --pos;
  }
  const chunk = template[pos] ?? '';
  const line = chunk.slice(chunk.lastIndexOf('\n') + 1);
  return line.slice(0, padLength(line));
}

function padLength(s: string): number {
  return s.length - s.trimStart().length;
}

function unindentString(str: string): string {
  const lines = str.split('\n');
  let curPad = str.length;
  for (const line of lines) {
    if (!line.trim()) continue;
    curPad = Math.min(curPad, padLength(line));
  }

  return lines.map((line) => line.slice(curPad)).join('\n');
}

/** Describes the delimiters that mark a placeholder. */
export interface PlaceholderOptions {
  /** Holds the opening delimiter. Default: `{@`. */
  open?: string | undefined;
  /** Holds the closing delimiter. Default: `@}`. */
  close?: string | undefined;
}

/** Describes the delimiters, and whether {@link replacePlaceholders} indents a multi-line value. */
export interface ReplacePlaceholdersOptions extends PlaceholderOptions {
  /** Gives each later line of a multi-line value the leading whitespace of its placeholder's line. Default: `true`. */
  autoIndent?: boolean | undefined;
}

/** Returns the value for a placeholder name, or `undefined` to leave the placeholder as written. */
export type PlaceholderResolver = (name: string) => string | undefined;

/**
 * Supplies the values for placeholders: a {@link PlaceholderResolver}, or an object.
 *
 * A dotted name walks the object's properties: `a.b` reads `values.a.b`.
 * A string or number value is used. Anything else leaves the placeholder as written.
 */
export type PlaceholderValues = PlaceholderResolver | object;

/** Describes a placeholder found in a string. */
export interface Placeholder {
  /** Holds the name, without the delimiters or the whitespace inside them. */
  name: string;
  /** Holds the offset of the opening delimiter. */
  start: number;
  /** Holds the offset just past the closing delimiter. */
  end: number;
}

export const DEFAULT_OPEN = '{@';
export const DEFAULT_CLOSE = '@}';

// Matches one segment of a name. It's non-greedy, so a name ends at the first close delimiter even when the delimiter
// is made of name characters.
const segment = '[A-Za-z0-9_][A-Za-z0-9_-]*?';
const namePattern = `${segment}(?:\\.${segment})*?`;
const validName = new RegExp(`^${namePattern}$`);

// Holds the regex for the last delimiter pair used, so repeated calls with the same pair don't recompile it.
let cached: { open: string; close: string; regExp: RegExp } | undefined;

/**
 * Check whether a name is a valid placeholder name.
 *
 * A valid name is one or more segments of `[A-Za-z0-9_][A-Za-z0-9_-]*` joined by `.`.
 * A hyphen may appear inside a segment but not at its start.
 *
 * @example
 * isValidPlaceholderName('engines.cspell');
 * // true
 * isValidPlaceholderName('-name');
 * // false
 */
export function isValidPlaceholderName(name: string): boolean {
  return validName.test(name);
}

/**
 * Replace the placeholders in `text`, such as `{​@ name @​}`, with their values.
 *
 * - Whitespace just inside the delimiters is optional.
 * - A placeholder without a value stays as written. To find what's left, use {@link listPlaceholders} or
 *   {@link hasPlaceholders}.
 * - Each later line of a multi-line value gets the leading whitespace of the placeholder's line, except an empty
 *   line.
 *
 * @example
 * replacePlaceholders('Hello {@user.name@}!', { user: { name: 'Ada' } });
 * // 'Hello Ada!'
 */
export function replacePlaceholders(
  text: string,
  values: PlaceholderValues,
  options?: ReplacePlaceholdersOptions,
): string {
  const resolve = typeof values === 'function' ? (values as PlaceholderResolver) : objectResolver(values);
  const autoIndent = options?.autoIndent ?? true;
  return text.replaceAll(placeholderRegExp(options), (match, name: string, offset: number) => {
    const value = resolve(name);
    if (value === undefined) return match;
    return autoIndent ? indentLines(value, lineIndent(text, offset)) : value;
  });
}

/**
 * Find the placeholders in `text`, in order.
 *
 * Each placeholder is found as it's iterated, so a caller can stop early.
 *
 * @example
 * [...listPlaceholders('{@a@} and {@b.c@}')];
 * // [{ name: 'a', start: 0, end: 5 }, { name: 'b.c', start: 10, end: 17 }]
 */
export function listPlaceholders(text: string, options?: PlaceholderOptions): Iterable<Placeholder> {
  // matchAll copies the shared regex now, so a later call can't move where this search starts.
  return placeholdersOf(text.matchAll(placeholderRegExp(options)));
}

/**
 * Check whether `text` has any placeholders.
 *
 * @example
 * hasPlaceholders('Hello {@name@}');
 * // true
 */
export function hasPlaceholders(text: string, options?: PlaceholderOptions): boolean {
  return placeholderRegExp(options).test(text);
}

function placeholderRegExp(options: PlaceholderOptions = {}): RegExp {
  const { open = DEFAULT_OPEN, close = DEFAULT_CLOSE } = options;
  if (cached?.open === open && cached.close === close) {
    // Shared and global, so start every reuse at 0.
    cached.regExp.lastIndex = 0;
    return cached.regExp;
  }
  if (!open || !close) throw new TypeError('The open and close delimiters must not be empty.');
  const regExp = new RegExp(`${escapeRegExp(open)}\\s*(${namePattern})\\s*${escapeRegExp(close)}`, 'g');
  cached = { open, close, regExp };
  return regExp;
}

function* placeholdersOf(matches: Iterable<RegExpExecArray>): Generator<Placeholder> {
  for (const match of matches) {
    yield { name: match[1] ?? '', start: match.index, end: match.index + match[0].length };
  }
}

function objectResolver(values: object): PlaceholderResolver {
  return (name) => {
    let value: unknown = values;
    for (const key of name.split('.')) {
      // Own properties only, so a name never reads `Object.prototype` and the like.
      if (typeof value !== 'object' || value === null || !Object.hasOwn(value, key)) return undefined;
      value = (value as Record<string, unknown>)[key];
    }
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return undefined;
  };
}

/** Return the leading whitespace of the line `offset` is on, up to `offset`. */
function lineIndent(text: string, offset: number): string {
  const prefix = text.slice(text.lastIndexOf('\n', offset - 1) + 1, offset);
  return prefix.slice(0, prefix.length - prefix.trimStart().length);
}

/** Add `indent` to each line after the first, except an empty one. */
function indentLines(value: string, indent: string): string {
  if (!indent || !value.includes('\n')) return value;
  return value
    .split('\n')
    .map((line, i) => (i && line !== '' && line !== '\r' ? indent + line : line))
    .join('\n');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

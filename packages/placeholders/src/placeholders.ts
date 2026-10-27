export interface PlaceholderOptions {
  /** The opening delimiter. Default: `{@`. */
  open?: string | undefined;
  /** The closing delimiter. Default: `@}`. */
  close?: string | undefined;
}

export interface ReplacePlaceholdersOptions extends PlaceholderOptions {
  /** Give each later line of a multi-line value the leading whitespace of its placeholder's line. Default: `true`. */
  autoIndent?: boolean | undefined;
}

/** Returns the value for a placeholder name, or `undefined` to leave the placeholder as written. */
export type PlaceholderResolver = (name: string) => string | undefined;

/**
 * A resolver, or an object whose properties a dotted name walks: `a.b` reads `values.a.b`.
 * A string or number value is used; anything else leaves the placeholder as written.
 */
export type PlaceholderValues = PlaceholderResolver | object;

/** A placeholder found in a string. `start` and `end` are offsets into it; `end` is exclusive. */
export interface Placeholder {
  name: string;
  start: number;
  end: number;
}

export const DEFAULT_OPEN = '{@';
export const DEFAULT_CLOSE = '@}';

// Non-greedy, so a name ends at the first close delimiter even when the delimiter is made of name characters.
const segment = '[A-Za-z0-9_][A-Za-z0-9_-]*?';
const namePattern = `${segment}(?:\\.${segment})*?`;
const validName = new RegExp(`^${namePattern}$`);

// The regex for the last delimiter pair used, so repeated calls with the same pair don't recompile it.
let cached: { open: string; close: string; regExp: RegExp } | undefined;

/**
 * A dotted placeholder name: one or more segments of `[A-Za-z0-9_][A-Za-z0-9_-]*` joined by `.`.
 * A hyphen may appear inside a segment but not at its start.
 */
export function isValidPlaceholderName(name: string): boolean {
  return validName.test(name);
}

/**
 * Replace the placeholders in `text`, such as `{​@ name @​}`, with their values.
 * Whitespace just inside the delimiters is optional. A placeholder without a value is left as written; use
 * {@link listPlaceholders} or {@link hasPlaceholders} to find what is left.
 * Each later line of a multi-line value gets the leading whitespace of the placeholder's line, except an empty line.
 * @param text - the text to fill
 * @param values - a resolver, or an object a dotted name walks
 * @param options - the delimiters, and whether to indent multi-line values
 * @returns the filled text
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
 * Find the placeholders in `text`, in order. They are found as they are iterated, so a caller can stop early.
 * @param text - the text to search
 * @param options - the delimiters
 * @returns each placeholder's name and offsets
 */
export function listPlaceholders(text: string, options?: PlaceholderOptions): Iterable<Placeholder> {
  // matchAll copies the shared regex now, so a later call can't move where this search starts.
  return placeholdersOf(text.matchAll(placeholderRegExp(options)));
}

/**
 * Whether `text` has any placeholders.
 * @param text - the text to search
 * @param options - the delimiters
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

/** The leading whitespace of the line `offset` is on, up to `offset`. */
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

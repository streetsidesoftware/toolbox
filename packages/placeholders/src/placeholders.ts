export interface PlaceholderOptions {
  /** The opening delimiter. Default: `{@`. */
  open?: string | undefined;
  /** The closing delimiter. Default: `@}`. */
  close?: string | undefined;
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

/** Segments that would reach `Object.prototype` if walked. */
const unsafeSegments = new Set(['__proto__', 'constructor', 'prototype']);

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
 * @param text - the text to fill
 * @param values - a resolver, or an object a dotted name walks
 * @param options - the delimiters
 * @returns the filled text
 */
export function replacePlaceholders(text: string, values: PlaceholderValues, options?: PlaceholderOptions): string {
  const resolve = typeof values === 'function' ? (values as PlaceholderResolver) : objectResolver(values);
  return text.replaceAll(placeholderRegExp(options, 'g'), (match, name: string) => resolve(name) ?? match);
}

/**
 * Find the placeholders in `text`, in order.
 * @param text - the text to search
 * @param options - the delimiters
 * @returns each placeholder's name and offsets
 */
export function listPlaceholders(text: string, options?: PlaceholderOptions): Placeholder[] {
  return [...text.matchAll(placeholderRegExp(options, 'g'))].map((match) => ({
    name: match[1] ?? '',
    start: match.index,
    end: match.index + match[0].length,
  }));
}

/**
 * Whether `text` has any placeholders.
 * @param text - the text to search
 * @param options - the delimiters
 */
export function hasPlaceholders(text: string, options?: PlaceholderOptions): boolean {
  return placeholderRegExp(options).test(text);
}

function placeholderRegExp(options: PlaceholderOptions = {}, flags?: string): RegExp {
  const { open = DEFAULT_OPEN, close = DEFAULT_CLOSE } = options;
  if (!open || !close) throw new TypeError('The open and close delimiters must not be empty.');
  return new RegExp(`${escapeRegExp(open)}\\s*(${namePattern})\\s*${escapeRegExp(close)}`, flags);
}

function objectResolver(values: object): PlaceholderResolver {
  return (name) => {
    let value: unknown = values;
    for (const key of name.split('.')) {
      if (typeof value !== 'object' || value === null || unsafeSegments.has(key) || !Object.hasOwn(value, key)) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[key];
    }
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return undefined;
  };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

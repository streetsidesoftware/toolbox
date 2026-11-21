/** A part of the source, from `start` up to but not including `end`, as string offsets. */
export interface Span {
  start: number;
  end: number;
}

export function shifted(spans: Span[], offset: number): Span[] {
  return spans.map(({ start, end }) => ({ start: start + offset, end: end + offset }));
}

/**
 * Sort spans and merge each one that overlaps an earlier one into it, keeping the earlier one's other fields.
 * A comment left open inside a footnote runs past the footnote's end, so spans can overlap without nesting.
 */
export function merged<T extends Span>(spans: T[]): T[] {
  const kept: T[] = [];
  for (const span of [...spans].sort((a, b) => a.start - b.start || b.end - a.end)) {
    const last = kept.at(-1);
    if (last && span.start < last.end) last.end = Math.max(last.end, span.end);
    else kept.push({ ...span });
  }
  return kept;
}

/** Join sorted spans where one ends right where the next starts. */
export function joinTouching(spans: Span[]): Span[] {
  const joined: Span[] = [];
  for (const { start, end } of spans) {
    const last = joined.at(-1);
    if (last && last.end === start) last.end = end;
    else joined.push({ start, end });
  }
  return joined;
}

export function byStart(a: Span, b: Span): number {
  return a.start - b.start;
}

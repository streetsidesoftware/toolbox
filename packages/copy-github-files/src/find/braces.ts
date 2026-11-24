/**
 * Expand each brace that holds a `/`, such as `a/{b/c,d}` into `a/b/c` and `a/d`.
 * A pattern is matched one segment at a time, so a brace can't reach across segments. Any other brace is left as it is.
 */
export function expandBraces(pattern: string): string[] {
  for (let start = pattern.indexOf('{'); start >= 0; start = pattern.indexOf('{', start + 1)) {
    const brace = readBrace(pattern, start);
    if (!brace || brace.alternatives.length < 2 || !brace.alternatives.some((text) => text.includes('/'))) continue;
    const before = pattern.slice(0, start);
    const after = pattern.slice(brace.end);
    return brace.alternatives.flatMap((text) => expandBraces(before + text + after));
  }
  return [pattern];
}

/** Read the brace that opens at an index, or return `undefined` when it's never closed. */
function readBrace(pattern: string, start: number): { alternatives: string[]; end: number } | undefined {
  const alternatives: string[] = [];
  let depth = 0;
  let from = start + 1;
  for (let index = start; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '{') depth += 1;
    else if (character === '}') depth -= 1;
    if (depth > 1 || (depth === 1 && character !== ',')) continue;
    alternatives.push(pattern.slice(from, index));
    from = index + 1;
    if (depth === 0) return { alternatives, end: from };
  }
  return undefined;
}

import type { Root, RootContent } from 'mdast';
import { visit } from 'unist-util-visit';

import type { MarkdownStyle } from '../types.ts';

/**
 * Detect the markers that parsed nodes use, such as their bullets, emphasis and fences, by majority vote.
 * Rendering them again can then keep those markers, instead of falling back to remark-stringify's defaults.
 * @param content - the text the nodes were parsed from.
 */
export function detectMarkdownStyle(nodes: RootContent[], content: string): MarkdownStyle {
  const rule = new Tally<'-' | '_' | '*'>();
  const bullet = new Tally<'-' | '+' | '*'>();
  const bulletOrdered = new Tally<'.' | ')'>();
  const emphasis = new Tally<'_' | '*'>();
  const strong = new Tally<'_' | '*'>();
  const fence = new Tally<'`' | '~'>();

  const root: Root = { type: 'root', children: nodes };
  visit(root, (node) => {
    const offset = node.position?.start.offset;
    if (offset === undefined) return;

    switch (node.type) {
      case 'thematicBreak':
        rule.add(charAt(content[offset]));
        break;
      case 'list': {
        const first = node.children[0];
        const firstOffset = first?.position?.start.offset;
        if (firstOffset === undefined) break;
        if (node.ordered) {
          bulletOrdered.add(charAt(orderedMarkerAt(content, firstOffset)));
        } else {
          bullet.add(charAt(content[firstOffset]));
        }
        break;
      }
      case 'emphasis':
        emphasis.add(charAt(content[offset]));
        break;
      case 'strong':
        strong.add(charAt(content[offset]));
        break;
      case 'code': {
        const marker = content.slice(offset, offset + 3);
        if (marker.startsWith('```')) fence.add('`');
        else if (marker.startsWith('~~~')) fence.add('~');
        break;
      }
    }
  });

  const options: MarkdownStyle = {
    bullet: bullet.winner() ?? '-',
    emphasis: emphasis.winner() ?? '_',
    fence: fence.winner() ?? '`',
    fences: true,
    incrementListMarker: false,
    rule: rule.winner() ?? '-',
    strong: strong.winner() ?? '*',
  };
  const ordered = bulletOrdered.winner();
  if (ordered) options.bulletOrdered = ordered;

  return options;
}

/** Return the character after the number of the ordered list marker at `offset`, such as `.` or `)`. */
function orderedMarkerAt(content: string, offset: number): string | undefined {
  let i = offset;
  while (i < content.length && /[0-9]/.test(content[i])) ++i;
  return content[i];
}

function charAt<T extends string>(c: string | undefined): T | undefined {
  return c as T | undefined;
}

/** Counts votes for candidate marker characters and reports the most common. */
class Tally<T extends string> {
  private counts = new Map<T, number>();

  add(value: T | undefined): void {
    if (value === undefined) return;
    this.counts.set(value, (this.counts.get(value) ?? 0) + 1);
  }

  winner(): T | undefined {
    let best: T | undefined;
    let bestCount = 0;
    for (const [value, count] of this.counts) {
      if (count > bestCount) {
        best = value;
        bestCount = count;
      }
    }
    return best;
  }
}

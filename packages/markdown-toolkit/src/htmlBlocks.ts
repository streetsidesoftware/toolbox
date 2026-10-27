import type { Html, RootContent } from 'mdast';

import { describe, groupedNodes, inlineNodes, isArray, MarkdownValue } from './nodes.ts';
import type { AnyContent, DefinitionEntry, InlineContent, MDDefinitionList, MDDetails } from './types.ts';

/**
 * A collapsible `<details>` block. Its content goes after the summary, with blank lines around it so Markdown renders.
 * A plain-text summary is written on one line, `<summary>text</summary>`. Inline Markdown in it gets blank lines.
 */
export function details(summary: InlineContent, ...content: AnyContent[]): MDDetails {
  return new MarkdownValue('block', 'a details block', [
    ...wrapped('<details>\n', 'summary', summary, '', 'details summary'),
    ...groupedNodes(content, 'details content'),
    html('</details>'),
  ]);
}

/**
 * A `<dl>` definition list, one `[term, definition]` pair per entry.
 * A plain-text term is written on one line, `<dt>term</dt>`. Inline Markdown in it gets blank lines.
 * The definition gets blank lines around it, so Markdown renders.
 */
export function definitionList(entries: readonly DefinitionEntry[]): MDDefinitionList {
  if (!Array.isArray(entries)) {
    throw new TypeError(`definition list entries must be an array, got ${describe(entries)}`);
  }
  const nodes = entries.flatMap((entry): RootContent[] => {
    if (!isArray(entry) || entry.length !== 2) {
      throw new TypeError(`definition list entry must be a [term, definition] pair, got ${describe(entry)}`);
    }
    const [term, definition] = entry;
    return [
      ...wrapped('', 'dt', term, '\n<dd>', 'definition term'),
      ...groupedNodes([definition], 'definition'),
      html('</dd>'),
    ];
  });
  return new MarkdownValue('block', 'a definition list', [html('<dl>'), ...nodes, html('</dl>')]);
}

/** The same as {@link definitionList}. */
export const dl: typeof definitionList = definitionList;

/**
 * Inline content in an HTML element, with HTML written before and after it.
 * Plain text goes on one line, HTML-escaped, since Markdown isn't read there. Anything else gets blank lines, so it renders.
 */
function wrapped(before: string, tag: string, content: InlineContent, after: string, where: string): RootContent[] {
  const children = inlineNodes(content, where);
  if (children.every((node) => node.type === 'text')) {
    const text = htmlEscape(children.map((node) => node.value).join(''));
    return [html(`${before}<${tag}>${text}</${tag}>${after}`)];
  }
  return [html(`${before}<${tag}>`), { type: 'paragraph', children }, html(`</${tag}>${after}`)];
}

/** Text for an HTML block: `&` and `<` escaped, and no blank line, which would end the block. */
function htmlEscape(text: string): string {
  return text
    .split(/\r\n?|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;');
}

function html(value: string): Html {
  return { type: 'html', value };
}

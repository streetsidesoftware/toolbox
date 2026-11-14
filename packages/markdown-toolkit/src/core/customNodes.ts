// This package's own nodes, added to mdast's content types for this package's own code.
// The tsconfig includes every file under `src/`, so type-checking applies these additions without an import.
// Nothing may import this file: the published types would then carry these additions, and change mdast's types for
// anyone who uses this package.
import type { HtmlEntityNode } from './htmlEntityNode.ts';
import type { HtmlGroupNode, HtmlSlotNode } from './htmlGroupNode.ts';
import type { InlineHtmlNode } from './inlineHtmlNode.ts';
import type { PlaceholderNode } from './placeholderNode.ts';

// mdast builds `RootContent` from its own map, so a node that goes inside a line goes in both.
declare module 'mdast' {
  interface PhrasingContentMap {
    htmlEntity: HtmlEntityNode;
    inlineHtml: InlineHtmlNode;
    placeholder: PlaceholderNode;
  }
  interface RootContentMap {
    htmlBlockSlot: HtmlSlotNode;
    htmlEntity: HtmlEntityNode;
    htmlGroup: HtmlGroupNode;
    htmlInlineSlot: HtmlSlotNode;
    inlineHtml: InlineHtmlNode;
    placeholder: PlaceholderNode;
  }
}

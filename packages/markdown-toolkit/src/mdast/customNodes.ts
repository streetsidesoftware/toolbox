// Adds this package's own nodes to mdast's content types, for its own code only.
// Nothing imports this file, so the built types never reach it, and they leave mdast unchanged.
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

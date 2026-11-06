import type { Literal, PhrasingContent, Text } from 'mdast';
import type { CompileContext, Extension as FromMarkdownExtension, Token } from 'mdast-util-from-markdown';

/**
 * An HTML character reference, such as `&nbsp;`. It has a node type of its own, so rendering writes it as is.
 * An `html` node won't do: remark-stringify turns a line ending before one into a space.
 * Only this package's own code sees it in mdast's content types; the published types leave mdast unchanged.
 */
export interface HtmlEntityNode extends Literal {
  type: 'htmlEntity';
}

// mdast builds `RootContent` from its own map, so the node goes in both.
declare module 'mdast' {
  interface PhrasingContentMap {
    htmlEntity: HtmlEntityNode;
  }
  interface RootContentMap {
    htmlEntity: HtmlEntityNode;
  }
}

/** Return the node for a reference such as `&nbsp;`. */
export function htmlEntityNode(reference: string): PhrasingContent {
  const node: HtmlEntityNode = { type: 'htmlEntity', value: reference };
  return node;
}

/**
 * The parser extension that reads a character reference in text, such as `&nbsp;`, as an `htmlEntity` node.
 * Where the parser collects a string instead, such as a URL, a title or an image's alt text, it stays decoded.
 */
export const htmlEntityFromMarkdown: FromMarkdownExtension = {
  enter: { characterReference: enterReference, label: enterLabel },
  exit: { characterReference: exitReference },
};

/** The fragments that collect a link's or an image's label. Only a link's label becomes text. */
const labels = new WeakSet<object>();

function enterLabel(this: CompileContext): undefined {
  this.buffer();
  labels.add(this.stack[this.stack.length - 1]);
}

function enterReference(this: CompileContext, token: Token): undefined {
  // remark's own handler for the reference's value adds the character to this node.
  this.enter({ type: 'text', value: '' }, token);
}

function exitReference(this: CompileContext, token: Token): undefined {
  const node = this.stack[this.stack.length - 1] as Text | HtmlEntityNode;
  if (inText(this.stack)) {
    node.type = 'htmlEntity';
    node.value = this.sliceSerialize(token);
  }
  this.exit(token);
}

/** Check whether the node on top of the stack ends up in text, rather than in a string. */
function inText(stack: CompileContext['stack']): boolean {
  return stack.every((node, i) => node.type !== 'fragment' || (labels.has(node) && stack[i - 1]?.type === 'link'));
}

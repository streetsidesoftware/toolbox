import type { Parent, Root, RootContent, Text } from 'mdast';
import type { CompileContext, Extension as FromMarkdownExtension, Token } from 'mdast-util-from-markdown';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import type { Processor } from 'unified';

import type { HtmlEntityNode } from './htmlEntityNode.ts';
import { textNodes } from './text.ts';

/**
 * The block constructs turned off when parsing text that goes inside a line.
 * The names are micromark's construct names.
 */
const blockConstructs = [
  'blockQuote',
  'codeFenced',
  'codeIndented',
  'definition',
  'gfmFootnoteDefinition',
  'headingAtx',
  'htmlFlow',
  'list',
  'setextUnderline',
  'table',
  'thematicBreak',
];

/**
 * Parse Markdown text into a tree. Each placeholder in its text is a node of its own, and so is each HTML entity.
 * @param inline - the text goes inside a line, so block syntax, such as a list marker, stays text.
 */
export function parseTree(markdown: string, inline: boolean): Root {
  const processor = unified().use(remarkParse).use(remarkGfm).use(readEntities);
  if (inline) {
    processor.use(function disableBlocks() {
      const data = this.data();
      (data.micromarkExtensions ??= []).push({ disable: { null: blockConstructs } });
    });
  }
  const root = processor.parse(markdown);
  keepPlaceholders(root);
  return root;
}

/** Make the placeholders in text raw, in place, so rendering can't escape them. */
function keepPlaceholders(parent: Parent): void {
  parent.children = parent.children.flatMap((child): RootContent[] => {
    if (child.type === 'text') return textNodes(child.value);
    if ('children' in child) keepPlaceholders(child);
    return [child];
  });
}

function readEntities(this: Processor): void {
  (this.data().fromMarkdownExtensions ??= []).push(htmlEntityFromMarkdown);
}

/**
 * The parser extension that reads a character reference in text, such as `&nbsp;`, as an `htmlEntity` node.
 * Where the parser collects a string instead, such as a URL, a title or an image's alt text, it stays decoded.
 */
const htmlEntityFromMarkdown: FromMarkdownExtension = {
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

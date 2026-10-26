import type { RootContent } from 'mdast';

import { MarkdownValue, renderingOf } from './nodes.ts';
import type { StyleOptions } from './render.ts';
import type { MarkdownStyle, MDDocument } from './types.ts';

/** A whole document. It renders with a trailing newline, since it stands alone as a file. */
export class DocumentValue extends MarkdownValue<'block', 'a document'> implements MDDocument {
  constructor(nodes: RootContent[], style?: StyleOptions) {
    super('block', 'a document', nodes, style);
  }

  withStyle(style: MarkdownStyle): MDDocument {
    return new DocumentValue(renderingOf(this)?.nodes ?? [], style);
  }

  override toString(): string {
    return super.toString() + '\n';
  }
}

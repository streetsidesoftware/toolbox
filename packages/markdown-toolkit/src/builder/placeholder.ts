import { isValidPlaceholderName } from '@streetsidesoftware/placeholders';

import { placeholderNode } from '../core/index.ts';
import { assertCondition, MarkdownElement } from '../element/index.ts';
import type { MDBlockPlaceholder, MDPlaceholder } from '../types.ts';

class PlaceholderElement extends MarkdownElement<'inline', 'placeholder'> implements MDPlaceholder {
  readonly name: string;

  constructor(name: string) {
    super('inline', 'placeholder', 'a placeholder', [placeholderNode(name)]);
    this.name = name;
  }
}

class BlockPlaceholderElement extends MarkdownElement<'block', 'blockPlaceholder'> implements MDBlockPlaceholder {
  readonly name: string;

  constructor(name: string) {
    super('block', 'blockPlaceholder', 'a block placeholder', [
      { type: 'paragraph', children: [placeholderNode(name)] },
    ]);
    this.name = name;
  }
}

/**
 * Create a `{​@ name @​}` placeholder to be replaced later.
 *
 * - Within a sentence, it takes text, links, formatting or code.
 * - On a line of its own, it can also take a list, table or other block.
 *
 * @example
 * const page = md.p('Hello ', md.placeholder('name'), '.');
 * md.substitutePlaceholders(page, { name: 'world' });
 * // Hello world.
 * @category placeholders
 */
export function placeholder(name: string): MDPlaceholder {
  assertIsPlaceholderName(name);
  return new PlaceholderElement(name);
}

/**
 * Create a `{​@ name @​}` placeholder on lines of its own, to be replaced later.
 *
 * It takes any replacement, including a list, table or other block.
 *
 * @example
 * md.substitutePlaceholders(md.blockPlaceholder('languages'), { languages: md.list(['Dutch', 'French']) });
 * // - Dutch
 * // - French
 * @category placeholders
 */
export function blockPlaceholder(name: string): MDBlockPlaceholder {
  assertIsPlaceholderName(name);
  return new BlockPlaceholderElement(name);
}

function assertIsPlaceholderName(name: string): void {
  assertCondition(
    isValidPlaceholderName(name),
    "a placeholder name must be parts joined by '.', each of ASCII letters, digits, '_' and '-', and not starting with '-'",
  );
}

import {
  argumentNodes,
  assertCondition,
  assertIsArray,
  isListItem,
  isMDElement,
  MarkdownElement,
  markdownInternalsOf,
} from '../element/index.ts';
import { listItemNode, listNode } from '../mdast/index.ts';
import type { ListItem } from '../mdast/index.ts';
import type {
  AnyContent,
  ListEntry,
  ListItemContent,
  ListItemOptions,
  ListOptions,
  MDList,
  MDListItem,
  OrderedListOptions,
} from '../types.ts';

/**
 * Create one list item from several pieces.
 *
 * Each piece goes on a line of its own:
 * - Text, links and other pieces in a row form one paragraph. The page shows a space between them.
 * - A piece that shows nothing ends the paragraph.
 * - A paragraph, list or other block goes on its own lines.
 * - An array is one piece, and its parts join with no spaces added. For a sentence built from pieces, use an array or
 *   {@link p}.
 *
 * It goes in a {@link list}, or anywhere a paragraph can go:
 * - List items in a row form a list.
 * - A list item right before or after a list becomes one more item of it.
 * - In a heading, a link or anywhere else inside a line, a list item is an error.
 *
 * Options can follow the pieces. With `{ checked: true }` the page shows a checked box, and with `{ checked: false }`
 * an empty one. Without `checked`, the item has no box.
 *
 * @example
 * md.listItem('Dutch', md.list(['Flemish']));
 * // - Dutch
 * //   - Flemish
 * @example
 * md.listItem('Write tests', { checked: true });
 * // Markdown:
 * // - [x] Write tests
 * // The page shows a checked box next to "Write tests".
 * @category lists
 */
export function listItem(
  ...content: ListItemContent[] | [...ListItemContent[], ListItemOptions | undefined]
): MDListItem {
  return buildListItem(...piecesAndOptions(content));
}

/** The same as {@link listItem}. */
export const li: typeof listItem = listItem;

function isListItemOptions(value: ListItemOptions | ListItemContent | undefined): value is ListItemOptions {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !isMDElement(value);
}

function buildListItem(content: readonly ListItemContent[], options?: ListItemOptions): MDListItem {
  return new MarkdownElement('listItem', 'listItem', 'a list item', [itemNode(content, options?.checked)]);
}

/**
 * Create one task list item: a list item with a checkbox.
 *
 * Each piece goes on a line of its own:
 * - Text, links and other pieces in a row form one paragraph. The page shows a space between them.
 * - A piece that shows nothing ends the paragraph.
 * - A paragraph, list or other block goes on its own lines.
 * - An array is one piece, and its parts join with no spaces added. For a sentence built from pieces, use an array or
 *   {@link p}.
 *
 * It goes in a {@link list}, or anywhere a paragraph can go:
 * - List items in a row form a list.
 * - A list item right before or after a list becomes one more item of it.
 * - In a heading, a link or anywhere else inside a line, a list item is an error.
 *
 * Options can follow the pieces. The box is empty unless they hold `{ checked: true }`.
 *
 * @example
 * md.taskListItem('Ship');
 * // Markdown:
 * // - [ ] Ship
 * // The page shows an empty box next to "Ship".
 * @category lists
 */
export function taskListItem(
  ...content: ListItemContent[] | [...ListItemContent[], ListItemOptions | undefined]
): MDListItem {
  const [pieces, options] = piecesAndOptions(content);
  return buildListItem(pieces, { checked: options?.checked ?? false });
}

/** Split a list item's arguments into its pieces and the options that can follow them. */
function piecesAndOptions(
  content: readonly (ListItemContent | ListItemOptions | undefined)[],
): [pieces: ListItemContent[], options: ListItemOptions | undefined] {
  const last = content.at(-1);
  if (last !== undefined && !isListItemOptions(last)) return [content as ListItemContent[], undefined];
  return [content.slice(0, -1) as ListItemContent[], last];
}

/**
 * Create a bulleted or numbered list, one item per entry.
 *
 * An entry can be an array of pieces, and a list among them makes a nested list.
 *
 * The list is bulleted unless `ordered` is `true`. For one kind only, {@link ul} and {@link ol} are shorter.
 *
 * @param options - `ordered: true` numbers the items. `start` sets the first number, a whole number from 0 to
 * 999999999, and goes only with `ordered: true`.
 * @example <caption>A list</caption>
 * md.list(['Dutch', 'French', 'German']);
 * // - Dutch
 * // - French
 * // - German
 * @example <caption>Nested lists</caption>
 * md.list([['Nested:', md.list(['Item 1', 'Item 2'])], 'Item 3']);
 * // - Nested:
 * //   - Item 1
 * //   - Item 2
 * // - Item 3
 * @category lists
 */
export function list(entries: readonly ListEntry[], options?: ListOptions): MDList {
  assertIsArray(entries, 'list entries');
  // The type allows `start` only with `ordered: true`; JavaScript callers can still pass it alone.
  const { ordered = false, start } = (options ?? {}) as { ordered?: boolean; start?: number };
  assertCondition(
    start === undefined || (Number.isInteger(start) && start >= 0 && start <= 999_999_999),
    'a list start must be a whole number from 0 to 999999999',
  );
  const items = entries.map((entry) =>
    isListItem(entry) ? (markdownInternalsOf(entry).nodes[0] as ListItem) : itemNode([entry]),
  );
  return new MarkdownElement('block', 'list', 'a list', [listNode(items, ordered ? (start ?? 1) : undefined)]);
}

/**
 * Create a numbered list, one item per entry.
 *
 * It's the same as {@link list} with `ordered: true`.
 *
 * @param options - `start` sets the first number, a whole number from 0 to 999999999. It's 1 by default.
 * @example
 * md.ol(['Install', 'Run'], { start: 3 });
 * // Markdown:
 * // 3. Install
 * // 3. Run
 * // The page shows a numbered list: 3. Install, 4. Run.
 * @category lists
 */
export function ol(entries: readonly ListEntry[], options?: OrderedListOptions): MDList {
  return list(entries, { ...options, ordered: true });
}

/**
 * Create a bulleted list, one item per entry.
 *
 * It's the same as {@link list} with no options.
 *
 * @example
 * md.ul(['Dutch', 'French']);
 * // Markdown:
 * // - Dutch
 * // - French
 * // The page shows a bulleted list: Dutch, French.
 * @category lists
 */
export function ul(entries: readonly ListEntry[]): MDList {
  return list(entries);
}

/** Return the node for a list item's arguments, grouped as in {@link argumentNodes}, and a task when `checked` is given. */
function itemNode(content: readonly AnyContent[], checked?: boolean): ListItem {
  return listItemNode(argumentNodes(content, 'list item content'), checked);
}

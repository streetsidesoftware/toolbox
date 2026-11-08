/** The public types of the Markdown builders. This module imports nothing, so every other module can depend on it. */

/**
 * Where an element may go:
 * - `inline`: inside a line, or where a paragraph can go, as part of a paragraph.
 * - `block`: on its own lines.
 * - `listItem`: in a list, or anywhere a paragraph can go.
 * - `frontmatter`: only first in a document.
 */
export type MDKind = 'inline' | 'block' | 'listItem' | 'frontmatter';

/** The values of {@link MDElement.type}, one for each element interface. */
export type MDType =
  | 'text'
  | 'placeholder'
  | 'blockPlaceholder'
  | 'link'
  | 'strong'
  | 'emphasis'
  | 'strikethrough'
  | 'sup'
  | 'sub'
  | 'inlineCode'
  | 'lineBreak'
  | 'br'
  | 'htmlEntity'
  | 'comment'
  | 'inlineComment'
  | 'blockComment'
  | 'heading'
  | 'paragraph'
  | 'horizontalRule'
  | 'codeBlock'
  | 'listItem'
  | 'list'
  | 'details'
  | 'definitionList'
  | 'table'
  | 'htmlTable'
  | 'document'
  | 'frontmatter'
  | 'fragment'
  | 'inlineFragment';

export interface MDElement {
  /** Where the element can go, such as inside a line or on its own lines. */
  readonly kind: MDKind;
  /** A name unique to the element's interface, such as `'link'` for {@link MDLink}. */
  readonly type: MDType;
  /** A short name for the element in error messages, such as `a list`. */
  readonly description: string;
  /** Return the element's Markdown. */
  toString(): string;
}

/**
 * The same as {@link MDElement}.
 *
 * @deprecated Use {@link MDElement}.
 */
export type MDValue = MDElement;

/**
 * Text whose Markdown and HTML show on the page as text, not as formatting.
 *
 * A `{​@ name @​}` placeholder in it stays, so a later call can substitute it.
 */
export interface MDText extends MDElement {
  readonly kind: 'inline';
  readonly type: 'text';
  /** The string the text was made from. */
  readonly text: string;
}

/**
 * A `{​@ name @​}` placeholder that goes anywhere a string can.
 *
 * What it takes depends on where it sits:
 * - Within a sentence, text, links, formatting or code.
 * - On a line of its own, also a list, table or other block.
 */
export interface MDPlaceholder extends MDElement {
  readonly kind: 'inline';
  readonly type: 'placeholder';
  /** The name the placeholder's value is looked up by. */
  readonly name: string;
}

/**
 * A `{​@ name @​}` placeholder on lines of its own.
 *
 * It takes any value, including a list, table or other block.
 */
export interface MDBlockPlaceholder extends MDElement {
  readonly kind: 'block';
  readonly type: 'blockPlaceholder';
  /** The name the placeholder's value is looked up by. */
  readonly name: string;
}

export interface MDLink extends MDElement {
  readonly kind: 'inline';
  readonly type: 'link';
}

/** Bold text. */
export interface MDStrong extends MDElement {
  readonly kind: 'inline';
  readonly type: 'strong';
}

/** Italic text. */
export interface MDEmphasis extends MDElement {
  readonly kind: 'inline';
  readonly type: 'emphasis';
}

/** Text with a line through it. */
export interface MDStrikethrough extends MDElement {
  readonly kind: 'inline';
  readonly type: 'strikethrough';
}

/** Superscript text. */
export interface MDSup extends MDElement {
  readonly kind: 'inline';
  readonly type: 'sup';
}

/** Subscript text. */
export interface MDSub extends MDElement {
  readonly kind: 'inline';
  readonly type: 'sub';
}

/** Code within a line of text. */
export interface MDInlineCode extends MDElement {
  readonly kind: 'inline';
  readonly type: 'inlineCode';
}

/** A new line that doesn't start a new paragraph. */
export interface MDLineBreak extends MDElement {
  readonly kind: 'inline';
  readonly type: 'lineBreak';
}

/** An HTML `<br/>` line break. */
export interface MDBr extends MDElement {
  readonly kind: 'inline';
  readonly type: 'br';
}

/** A character written as an HTML reference, such as `&nbsp;`. */
export interface MDHtmlEntity extends MDElement {
  readonly kind: 'inline';
  readonly type: 'htmlEntity';
  /** The character the reference stands for. */
  readonly character: string;
}

/**
 * An HTML comment, which the page doesn't show.
 *
 * - Text without a line ending goes on one line, and works anywhere a string can go.
 * - Text with a line ending gets its markers on lines of their own, and goes on its own lines.
 */
export interface MDComment extends MDElement {
  readonly kind: 'inline' | 'block';
  readonly type: 'comment';
}

/** An HTML comment that goes inside a line, which the page doesn't show. */
export interface MDInlineComment extends MDElement {
  readonly kind: 'inline';
  readonly type: 'inlineComment';
}

/** An HTML comment with its markers on lines of their own, which the page doesn't show. */
export interface MDBlockComment extends MDElement {
  readonly kind: 'block';
  readonly type: 'blockComment';
}

export interface MDHeading extends MDElement {
  readonly kind: 'block';
  readonly type: 'heading';
}

export interface MDParagraph extends MDElement {
  readonly kind: 'block';
  readonly type: 'paragraph';
}

/** A line across the page between sections. */
export interface MDHorizontalRule extends MDElement {
  readonly kind: 'block';
  readonly type: 'horizontalRule';
}

export interface MDCodeBlock extends MDElement {
  readonly kind: 'block';
  readonly type: 'codeBlock';
}

export interface MDListItem extends MDElement {
  readonly kind: 'listItem';
  readonly type: 'listItem';
}

/** A bulleted or numbered list. */
export interface MDList extends MDElement {
  readonly kind: 'block';
  readonly type: 'list';
}

/** A collapsible section. */
export interface MDDetails extends MDElement {
  readonly kind: 'block';
  readonly type: 'details';
}

/** A list of terms and their definitions. */
export interface MDDefinitionList extends MDElement {
  readonly kind: 'block';
  readonly type: 'definitionList';
}

/** A table whose cells hold text, links, formatting or code. */
export interface MDTable extends MDElement {
  readonly kind: 'block';
  readonly type: 'table';
}

/** A table whose cells can hold anything, including lists and paragraphs. */
export interface MDHtmlTable extends MDElement {
  readonly kind: 'block';
  readonly type: 'htmlTable';
}

/**
 * A whole Markdown file.
 *
 * Its Markdown ends with a newline.
 */
export interface MDDocument extends MDElement {
  readonly kind: 'block';
  readonly type: 'document';
  /**
   * Return a copy of the document with the given style preferences.
   *
   * The style is replaced and not merged with the existing document style.
   *
   * @example
   * md.document(md.list(['German'])).withStyle({ bullet: '*' });
   * // * German
   */
  withStyle(style: MarkdownStyle): MDDocument;
}

/**
 * YAML frontmatter between `---` lines.
 *
 * It goes only first in a document.
 */
export interface MDFrontmatter extends MDElement {
  readonly kind: 'frontmatter';
  readonly type: 'frontmatter';
}

/**
 * Paragraphs, lists and other blocks that go where paragraphs can.
 *
 * {@link blockText} and {@link blockTemplate} always make this. {@link parse} and {@link template} make it unless the
 * result is one paragraph or blank, when they make an {@link MDInlineFragment}.
 *
 * Alone, it writes the markers of the text it was parsed from, such as `*` bullets. Inside a document or another
 * element, it writes that element's markers.
 */
export interface MDFragment extends MDElement {
  readonly kind: 'block';
  readonly type: 'fragment';
}

/**
 * Formatted text that goes anywhere a string can.
 *
 * {@link inlineTemplate} always makes this. {@link parse} and {@link template} make it for one paragraph or blank text.
 */
export interface MDInlineFragment extends MDElement {
  readonly kind: 'inline';
  readonly type: 'inlineFragment';
}

/** A heading's depth: 1 for the page title, 2 for its sections, and so on down to 6. */
export type HeadingDepth = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * An element that goes inside a line, such as text, a link or formatting.
 *
 * A comment from {@link comment} goes inside a line only when its text has no line ending.
 */
export type MDInline =
  | MDText
  | MDPlaceholder
  | MDLink
  | MDStrong
  | MDEmphasis
  | MDStrikethrough
  | MDSup
  | MDSub
  | MDInlineCode
  | MDLineBreak
  | MDBr
  | MDHtmlEntity
  | MDComment
  | MDInlineComment
  | MDInlineFragment;

/** An element that goes on its own lines, such as a paragraph, list or table. */
export type MDBlock =
  | MDHeading
  | MDParagraph
  | MDList
  | MDCodeBlock
  | MDHorizontalRule
  | MDDetails
  | MDDefinitionList
  | MDTable
  | MDHtmlTable
  | MDComment
  | MDBlockComment
  | MDDocument
  | MDFragment
  | MDBlockPlaceholder;

/**
 * What goes inside a line: text, links, formatting or code.
 *
 * - A string's Markdown and HTML show as text, not as formatting, and each newline is a line break.
 * - An array's pieces are joined as given, with no spaces added.
 */
export type InlineContent = string | MDInline | readonly InlineContent[];

export type BlockContent = MDBlock | readonly BlockContent[];

/**
 * One piece of content:
 * - text, links, formatting or code
 * - a paragraph, list, table or other block
 * - a list item, which forms a list with the list items next to it
 */
export type BlockOrInlineContent = InlineContent | BlockContent | MDListItem;

export type AnyContent = BlockOrInlineContent | readonly BlockOrInlineContent[];

/**
 * A piece of a list item:
 * - text, links, formatting or code
 * - a paragraph, list, table or other block
 * - another list item, which forms a list with the list items next to it
 */
export type ListItemContent = BlockOrInlineContent;

/**
 * The key that marks a type as options.
 *
 * No object sets it.
 */
export const OPTION_TYPE_GUARD_SYMBOL: unique symbol = Symbol('option_type_guard');

/**
 * The type {@link ListItemOptions} extends, so that an element never passes for options.
 *
 * Every element has a `kind` and a `type`, and options never do.
 */
export interface OptionTypeGuard {
  readonly [OPTION_TYPE_GUARD_SYMBOL]?: true;
  readonly kind?: never;
  readonly type?: never;
}

export interface ListItemOptions extends OptionTypeGuard {
  /**
   * Controls the list item checkbox:
   * - `true` - the checkbox is checked
   * - `false` - the checkbox is not checked
   * - `undefined` - {@link listItem} shows no checkbox, and {@link taskListItem} shows one that is not checked
   */
  checked?: boolean | undefined;
}

/**
 * One item of a list: a single piece, or an array of pieces.
 *
 * A list among the pieces makes a nested list.
 */
export type ListEntry = InlineContent | MDBlock | MDListItem | readonly ListItemContent[];

/**
 * The options of {@link list}:
 * - `ordered: true` - a numbered list, which can also take `start`
 * - `ordered: false` or left out - a bulleted list
 */
export type ListOptions = { ordered?: false | undefined } | ({ ordered: true } & OrderedListOptions);

export interface OrderedListOptions {
  /**
   * The number of the first item, a whole number from 0 to 999999999.
   *
   * @default 1
   */
  start?: number | undefined;
}

export type DefinitionEntry = readonly [term: InlineContent, definition: AnyContent];

export type ColumnAlignName = 'left' | 'center' | 'right';

/**
 * A table column's alignment, written as one of the delimiters GitHub's docs use:
 * - `:---` - left-aligned
 * - `:---:` - centered
 * - `---:` - right-aligned
 * - `---` - not aligned
 */
export type ColumnDelimiterExplicit = ':---' | ':---:' | '---:' | '---';

/**
 * A table column's alignment, written as a delimiter in a table:
 * - a `:` at the start - left-aligned
 * - a `:` at both ends - centered
 * - a `:` at the end - right-aligned
 * - no `:` - not aligned
 *
 * It has one or more `-`.
 *
 * @pattern ^:?-+:?$
 * @example ':---:'
 */
export type ColumnDelimiter = string;

/**
 * The alignment of a table column:
 * - `'left'` or `':---'` - left-aligned
 * - `'center'` or `':---:'` - centered
 * - `'right'` or `'---:'` - right-aligned
 * - `'---'` or `undefined` - not aligned
 */
export type ColumnAlign = ColumnAlignName | ColumnDelimiter | ColumnDelimiterExplicit | undefined;

export interface TableOptions {
  /**
   * The alignment of each column, one entry per column.
   *
   * A column without an entry isn't aligned.
   */
  align?: readonly ColumnAlign[] | undefined;
}

export type BulletMarker = '*' | '+' | '-';
/** The characters that can follow the number of a numbered list item. */
export type OrderedBulletMarker = '.' | ')';
/** The characters that can mark italic or bold text. */
export type EmphasisMarker = '*' | '_';
export type FenceMarker = '`' | '~';
/** The characters that can make a line across the page. */
export type RuleMarker = '*' | '-' | '_';

/** Markdown style preferences. */
export interface MarkdownStyle {
  /**
   * The preferred marker of a bulleted list item.
   *
   * @default '-'
   */
  bullet?: BulletMarker | undefined;
  /**
   * The preferred marker after the number of a numbered list item.
   *
   * @default '.'
   */
  bulletOrdered?: OrderedBulletMarker | undefined;
  /**
   * The marker around italic text.
   *
   * @default '_'
   */
  emphasis?: EmphasisMarker | undefined;
  /**
   * The marker around bold text, written twice on each side.
   *
   * @default '*'
   */
  strong?: EmphasisMarker | undefined;
  /**
   * The character a code fence is made of.
   *
   * @default '`'
   */
  fence?: FenceMarker | undefined;
  /**
   * Sets the preferred form of a code block:
   * - `true` - a code fence like ```` ``` ````
   * - `false` - an indent, where the block can use one
   *
   * @default true
   */
  fences?: boolean | undefined;
  /**
   * Controls how a numbered list's numbers are written:
   * - `true` - the numbers count up: `1.`, `2.`, `3.`
   * - `false` - every item repeats the first number: `1.`, `1.`, `1.`
   *
   * The page counts up either way.
   *
   * @default false
   */
  incrementListMarker?: boolean | undefined;
  /**
   * The character a line across the page is made of.
   *
   * @default '-'
   */
  rule?: RuleMarker | undefined;
}

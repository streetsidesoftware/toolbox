/** The public types of the Markdown builders. This module imports nothing, so every other module can depend on it. */

/**
 * What an element is, which decides where it may go:
 * - `inline`: inside a line.
 * - `block`: on its own lines.
 * - `comment`: either one.
 * - `listItem`: only directly in a list.
 * - `frontmatter`: only first in a document.
 */
export type MDKind = 'inline' | 'block' | 'comment' | 'listItem' | 'frontmatter';

/** The types that distinguish the MDElement interfaces, one for each. See {@link MDElement.type}. */
export type MDType =
  | 'text'
  | 'placeholder'
  | 'blockPlaceholder'
  | 'link'
  | 'strong'
  | 'emphasis'
  | 'strikethrough'
  | 'inlineCode'
  | 'lineBreak'
  | 'br'
  | 'htmlEntity'
  | 'comment'
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

/** A Markdown element. Converting it to a string renders it. */
export interface MDElement {
  readonly kind: MDKind;
  /** The type that distinguishes each MDElement interface from the others, such as `'link'` for {@link MDLink}. */
  readonly type: MDType;
  /** What the element is, for error messages only, such as `a list`. */
  readonly description: string;
  toString(): string;
}

/** @deprecated Use {@link MDElement}. */
export type MDValue = MDElement;

/** Text. A `{@ name @}` placeholder in it is kept as written. */
export interface MDText extends MDElement {
  readonly kind: 'inline';
  readonly type: 'text';
  /** The text as written, unescaped. */
  readonly text: string;
}

/** A `{​@ name @​}` placeholder that goes where inline content does. Where it sits decides what it takes. */
export interface MDPlaceholder extends MDElement {
  readonly kind: 'inline';
  readonly type: 'placeholder';
  readonly name: string;
}

/** A `{​@ name @​}` placeholder on its own lines. It takes blocks or inline content. */
export interface MDBlockPlaceholder extends MDElement {
  readonly kind: 'block';
  readonly type: 'blockPlaceholder';
  readonly name: string;
}

export interface MDLink extends MDElement {
  readonly kind: 'inline';
  readonly type: 'link';
}

export interface MDStrong extends MDElement {
  readonly kind: 'inline';
  readonly type: 'strong';
}

export interface MDEmphasis extends MDElement {
  readonly kind: 'inline';
  readonly type: 'emphasis';
}

export interface MDStrikethrough extends MDElement {
  readonly kind: 'inline';
  readonly type: 'strikethrough';
}

export interface MDInlineCode extends MDElement {
  readonly kind: 'inline';
  readonly type: 'inlineCode';
}

/** A line break in the form that works where it ends up. */
export interface MDLineBreak extends MDElement {
  readonly kind: 'inline';
  readonly type: 'lineBreak';
}

/** An HTML line break, `<br/>`. */
export interface MDBr extends MDElement {
  readonly kind: 'inline';
  readonly type: 'br';
}

/** A character written as an HTML reference, such as `&nbsp;`. */
export interface MDHtmlEntity extends MDElement {
  readonly kind: 'inline';
  readonly type: 'htmlEntity';
  /** Holds the character the reference stands for. */
  readonly character: string;
}

export interface MDComment extends MDElement {
  readonly kind: 'comment';
  readonly type: 'comment';
}

export interface MDHeading extends MDElement {
  readonly kind: 'block';
  readonly type: 'heading';
}

export interface MDParagraph extends MDElement {
  readonly kind: 'block';
  readonly type: 'paragraph';
}

/** A line between sections, `---` in the default style. */
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

export interface MDList extends MDElement {
  readonly kind: 'block';
  readonly type: 'list';
}

/** A collapsible `<details>` block with a summary. */
export interface MDDetails extends MDElement {
  readonly kind: 'block';
  readonly type: 'details';
}

/** A `<dl>` definition list. */
export interface MDDefinitionList extends MDElement {
  readonly kind: 'block';
  readonly type: 'definitionList';
}

/** A GFM table. */
export interface MDTable extends MDElement {
  readonly kind: 'block';
  readonly type: 'table';
}

/** An HTML `<table>`, whose cells can hold blocks. */
export interface MDHtmlTable extends MDElement {
  readonly kind: 'block';
  readonly type: 'htmlTable';
}

/** A whole document. It renders with a trailing newline, as a file should end. */
export interface MDDocument extends MDElement {
  readonly kind: 'block';
  readonly type: 'document';
  /**
   * A copy of the document that renders in the given style.
   * The style replaces any style the document had. Everything inside the document renders in it.
   * Without it, a template or parsed text keeps the style of its own text, though spacing and table padding may change.
   */
  withStyle(style: MarkdownStyle): MDDocument;
}

/** YAML frontmatter between `---` lines. It goes only first in a document. */
export interface MDFrontmatter extends MDElement {
  readonly kind: 'frontmatter';
  readonly type: 'frontmatter';
}

/** Blocks made from a string. Markdown text renders in its own style. */
export interface MDFragment extends MDElement {
  readonly kind: 'block';
  readonly type: 'fragment';
}

/** Inline Markdown from Markdown text. */
export interface MDInlineFragment extends MDElement {
  readonly kind: 'inline';
  readonly type: 'inlineFragment';
}

export type HeadingDepth = 1 | 2 | 3 | 4 | 5 | 6;

/** An element that goes inside a line. A comment goes either inside a line or on its own. */
export type MDInline =
  | MDText
  | MDPlaceholder
  | MDLink
  | MDStrong
  | MDEmphasis
  | MDStrikethrough
  | MDInlineCode
  | MDLineBreak
  | MDBr
  | MDHtmlEntity
  | MDComment
  | MDInlineFragment;

/** An element that goes on its own lines. */
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
  | MDDocument
  | MDFragment
  | MDBlockPlaceholder;

/**
 * Content that goes inside a line:
 * - A string is text, and is escaped.
 * - An array is a sequence. Its pieces are joined as given, with no added spaces.
 */
export type InlineContent = string | MDInline | readonly InlineContent[];

/** Content on its own lines. An array is a sequence of blocks. */
export type BlockContent = MDBlock | readonly BlockContent[];

/** Describes content that can be a block, inline, or a list item, which forms a list with the list items next to it. */
export type BlockOrInlineContent = InlineContent | BlockContent | MDListItem;

/** Block or inline content, or an array that mixes them. */
export type AnyContent = BlockOrInlineContent | readonly BlockOrInlineContent[];

/** Describes a piece of a list item: text, a block, or a list item, which forms a list with the list items next to it. */
export type ListItemContent = BlockOrInlineContent;

/** One item of a list. */
export type ListEntry = InlineContent | MDBlock | MDListItem | readonly ListItemContent[];

/** Describes a list: bulleted by default, or numbered with `ordered: true`. */
export type ListOptions = { ordered?: false | undefined } | ({ ordered: true } & OrderedListOptions);

/** Describes a numbered list. */
export interface OrderedListOptions {
  /** Holds the number of the first item, a whole number from 0 to 999999999. It's 1 by default. */
  start?: number | undefined;
}

/** One entry of a definition list: an inline term and its definition. */
export type DefinitionEntry = readonly [term: InlineContent, definition: AnyContent];

/** How a table column is aligned, by name. */
export type ColumnAlignName = 'left' | 'center' | 'right';

/** The table delimiters GitHub's docs use: `:---` left, `:---:` center, `---:` right, `---` none. */
export type ColumnDelimiterExplicit = ':---' | ':---:' | '---:' | '---';

/**
 * How a table column is aligned, as its delimiter is written in a table: `:---` left, `:---:` center, `---:` right,
 * or `---` for none. Any number of `-` works, one or more.
 * @pattern ^:?-+:?$
 * @example ':---:'
 */
export type ColumnDelimiter = string;

/** How a table column is aligned: a name, a delimiter, or `undefined` for none. */
export type ColumnAlign = ColumnAlignName | ColumnDelimiter | ColumnDelimiterExplicit | undefined;

export interface TableOptions {
  /** One entry per column. A column without one isn't aligned. */
  align?: readonly ColumnAlign[] | undefined;
}

export type BulletMarker = '*' | '+' | '-';
export type OrderedBulletMarker = '.' | ')';
export type EmphasisMarker = '*' | '_';
export type FenceMarker = '`' | '~';
export type RuleMarker = '*' | '-' | '_';

/** How Markdown is written. A field left out keeps the default. */
export interface MarkdownStyle {
  /** The marker of a bulleted list item. */
  bullet?: BulletMarker | undefined;
  /** The marker after the number of an ordered list item. */
  bulletOrdered?: OrderedBulletMarker | undefined;
  /** The marker around emphasized text. */
  emphasis?: EmphasisMarker | undefined;
  /** The marker around strong text, written twice. */
  strong?: EmphasisMarker | undefined;
  /** The character of a code fence. */
  fence?: FenceMarker | undefined;
  /** Whether a code block is fenced, rather than indented. */
  fences?: boolean | undefined;
  /** Whether ordered list numbers count up, rather than repeat. */
  incrementListMarker?: boolean | undefined;
  /** The character of a thematic break. */
  rule?: RuleMarker | undefined;
}

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

/** A Markdown element. Converting it to a string renders it. */
export interface MDElement {
  readonly kind: MDKind;
  /** What the element is, for error messages, such as `a list`. */
  readonly description: string;
  toString(): string;
}

/** @deprecated Use {@link MDElement}. */
export type MDValue = MDElement;

/** Text. A `{@ name @}` placeholder in it is kept as written. */
export interface MDText extends MDElement {
  readonly kind: 'inline';
  readonly description: 'text';
  /** The text as written, unescaped. */
  readonly text: string;
}

/** A `{​@ name @​}` placeholder that goes where inline content does. Where it sits decides what it takes. */
export interface MDPlaceholder extends MDElement {
  readonly kind: 'inline';
  readonly description: 'a placeholder';
  readonly name: string;
}

/** A `{​@ name @​}` placeholder on its own lines. It takes blocks or inline content. */
export interface MDBlockPlaceholder extends MDElement {
  readonly kind: 'block';
  readonly description: 'a block placeholder';
  readonly name: string;
}

export interface MDLink extends MDElement {
  readonly kind: 'inline';
  readonly description: 'a link';
}

export interface MDStrong extends MDElement {
  readonly kind: 'inline';
  readonly description: 'strong text';
}

export interface MDEmphasis extends MDElement {
  readonly kind: 'inline';
  readonly description: 'emphasized text';
}

export interface MDStrikethrough extends MDElement {
  readonly kind: 'inline';
  readonly description: 'struck-through text';
}

export interface MDInlineCode extends MDElement {
  readonly kind: 'inline';
  readonly description: 'inline code';
}

/** A line break in the form that works where it ends up. */
export interface MDLineBreak extends MDElement {
  readonly kind: 'inline';
  readonly description: 'a line break';
}

/** An HTML line break, `<br/>`. */
export interface MDBr extends MDElement {
  readonly kind: 'inline';
  readonly description: 'a <br/>';
}

export interface MDComment extends MDElement {
  readonly kind: 'comment';
  readonly description: 'a comment';
}

export interface MDHeading extends MDElement {
  readonly kind: 'block';
  readonly description: 'a heading';
}

export interface MDParagraph extends MDElement {
  readonly kind: 'block';
  readonly description: 'a paragraph';
}

/** A line between sections, `---` in the default style. */
export interface MDHorizontalRule extends MDElement {
  readonly kind: 'block';
  readonly description: 'a horizontal rule';
}

export interface MDCodeBlock extends MDElement {
  readonly kind: 'block';
  readonly description: 'a code block';
}

export interface MDListItem extends MDElement {
  readonly kind: 'listItem';
  readonly description: 'a list item';
}

export interface MDList extends MDElement {
  readonly kind: 'block';
  readonly description: 'a list';
}

/** A collapsible `<details>` block with a summary. */
export interface MDDetails extends MDElement {
  readonly kind: 'block';
  readonly description: 'a details block';
}

/** A `<dl>` definition list. */
export interface MDDefinitionList extends MDElement {
  readonly kind: 'block';
  readonly description: 'a definition list';
}

/** A GFM table. */
export interface MDTable extends MDElement {
  readonly kind: 'block';
  readonly description: 'a table';
}

/** A whole document. It renders with a trailing newline, as a file should end. */
export interface MDDocument extends MDElement {
  readonly kind: 'block';
  readonly description: 'a document';
  /**
   * A copy of the document that renders in the given style.
   * The style replaces any style the document had. Everything inside the document renders in it.
   */
  withStyle(style: MarkdownStyle): MDDocument;
}

/** YAML frontmatter between `---` lines. It goes only first in a document. */
export interface MDFrontmatter extends MDElement {
  readonly kind: 'frontmatter';
  readonly description: 'frontmatter';
}

/** Blocks made from a string. Markdown text renders in its own style. */
export interface MDFragment extends MDElement {
  readonly kind: 'block';
  readonly description: 'a Markdown fragment';
}

/** Inline Markdown from Markdown text. */
export interface MDInlineFragment extends MDElement {
  readonly kind: 'inline';
  readonly description: 'an inline Markdown fragment';
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

/** Content that can be either a block or inline. */
export type BlockOrInlineContent = InlineContent | BlockContent;

/** Block or inline content, or an array that mixes them. */
export type AnyContent = BlockOrInlineContent | readonly BlockOrInlineContent[];

/** A piece of a list item. Inline pieces in a row form a line, and blocks follow on their own lines. */
export type ListItemContent = BlockOrInlineContent;

/** One item of a list. */
export type ListEntry = InlineContent | MDBlock | MDListItem | readonly ListItemContent[];

/** One entry of a definition list: an inline term and its definition. */
export type DefinitionEntry = readonly [term: InlineContent, definition: AnyContent];

/** How a table column is aligned, by name. */
export type ColumnAlignName = 'left' | 'center' | 'right';

/**
 * How a table column is aligned, as its delimiter is written in a table: `:-` left, `:-:` center, `-:` right,
 * or `-` for none, with one or more `-`.
 * @pattern ^:?-+:?$
 */
export type ColumnDelimiter = string;

/** How a table column is aligned: a name, a delimiter, or `undefined` for none. */
export type ColumnAlign = ColumnAlignName | ColumnDelimiter | undefined;

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

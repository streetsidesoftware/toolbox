/** The public types of the Markdown builders. This module imports nothing, so every other module can depend on it. */

/**
 * Describes what an element is, which decides where it may go:
 * - `inline`: inside a line.
 * - `block`: on its own lines.
 * - `comment`: either one.
 * - `listItem`: only directly in a list.
 * - `frontmatter`: only first in a document.
 */
export type MDKind = 'inline' | 'block' | 'comment' | 'listItem' | 'frontmatter';

/** Lists the types that tell the MDElement interfaces apart, one for each. See {@link MDElement.type}. */
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

/** Describes a Markdown element, such as a paragraph or a link. */
export interface MDElement {
  /** Holds what the element is, which decides where it can go, such as inside a line or on its own lines. */
  readonly kind: MDKind;
  /** Holds the type that tells each MDElement interface apart, such as `'link'` for {@link MDLink}. */
  readonly type: MDType;
  /** Holds what the element is, for error messages only, such as `a list`. */
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
 * Describes text that shows exactly as given, made by {@link text}.
 *
 * A `{​@ name @​}` placeholder in it stays, so a later call can substitute it.
 */
export interface MDText extends MDElement {
  readonly kind: 'inline';
  readonly type: 'text';
  /** Holds the text, exactly as given. */
  readonly text: string;
}

/**
 * Describes a `{​@ name @​}` placeholder that goes anywhere a string can, made by {@link placeholder}.
 *
 * Where it sits decides what it takes.
 */
export interface MDPlaceholder extends MDElement {
  readonly kind: 'inline';
  readonly type: 'placeholder';
  /** Holds the name its value is looked up by. */
  readonly name: string;
}

/**
 * Describes a `{​@ name @​}` placeholder on lines of its own, made by {@link blockPlaceholder}.
 *
 * It takes any value, including a list, table or other block.
 */
export interface MDBlockPlaceholder extends MDElement {
  readonly kind: 'block';
  readonly type: 'blockPlaceholder';
  /** Holds the name its value is looked up by. */
  readonly name: string;
}

/** Describes a link, made by {@link link}. */
export interface MDLink extends MDElement {
  readonly kind: 'inline';
  readonly type: 'link';
}

/** Describes bold text, made by {@link strong}. */
export interface MDStrong extends MDElement {
  readonly kind: 'inline';
  readonly type: 'strong';
}

/** Describes italic text, made by {@link emphasis}. */
export interface MDEmphasis extends MDElement {
  readonly kind: 'inline';
  readonly type: 'emphasis';
}

/** Describes text with a line through it, made by {@link strikethrough}. */
export interface MDStrikethrough extends MDElement {
  readonly kind: 'inline';
  readonly type: 'strikethrough';
}

/** Describes code within a line of text, made by {@link inlineCode}. */
export interface MDInlineCode extends MDElement {
  readonly kind: 'inline';
  readonly type: 'inlineCode';
}

/** Describes a new line that doesn't start a new paragraph, made by {@link lineBreak}. */
export interface MDLineBreak extends MDElement {
  readonly kind: 'inline';
  readonly type: 'lineBreak';
}

/** Describes an HTML `<br/>` line break, made by {@link br}. */
export interface MDBr extends MDElement {
  readonly kind: 'inline';
  readonly type: 'br';
}

/** Describes a character written as an HTML reference, such as `&nbsp;`, made by {@link htmlEntity}. */
export interface MDHtmlEntity extends MDElement {
  readonly kind: 'inline';
  readonly type: 'htmlEntity';
  /** Holds the character the reference stands for. */
  readonly character: string;
}

/** Describes an HTML comment, which the page doesn't show, made by {@link comment}. */
export interface MDComment extends MDElement {
  readonly kind: 'comment';
  readonly type: 'comment';
}

/** Describes a heading, made by {@link heading}. */
export interface MDHeading extends MDElement {
  readonly kind: 'block';
  readonly type: 'heading';
}

/** Describes a paragraph, made by {@link p}. */
export interface MDParagraph extends MDElement {
  readonly kind: 'block';
  readonly type: 'paragraph';
}

/** Describes a line across the page between sections, made by {@link hr}. */
export interface MDHorizontalRule extends MDElement {
  readonly kind: 'block';
  readonly type: 'horizontalRule';
}

/** Describes a block of code, made by {@link codeBlock}. */
export interface MDCodeBlock extends MDElement {
  readonly kind: 'block';
  readonly type: 'codeBlock';
}

/** Describes one list item, made by {@link listItem}. */
export interface MDListItem extends MDElement {
  readonly kind: 'listItem';
  readonly type: 'listItem';
}

/** Describes a bulleted or numbered list, made by {@link list}. */
export interface MDList extends MDElement {
  readonly kind: 'block';
  readonly type: 'list';
}

/** Describes a collapsible section, made by {@link details}. */
export interface MDDetails extends MDElement {
  readonly kind: 'block';
  readonly type: 'details';
}

/** Describes a list of terms and their definitions, made by {@link dl}. */
export interface MDDefinitionList extends MDElement {
  readonly kind: 'block';
  readonly type: 'definitionList';
}

/** Describes a table whose cells hold text, links, formatting or code, made by {@link table}. */
export interface MDTable extends MDElement {
  readonly kind: 'block';
  readonly type: 'table';
}

/** Describes a table whose cells can hold anything, including lists and paragraphs, made by {@link htmlTable}. */
export interface MDHtmlTable extends MDElement {
  readonly kind: 'block';
  readonly type: 'htmlTable';
}

/**
 * Describes a whole Markdown file, made by {@link document}, {@link parseDocument} or {@link templateDocument}.
 *
 * Its Markdown ends with a newline, as a file should.
 */
export interface MDDocument extends MDElement {
  readonly kind: 'block';
  readonly type: 'document';
  /**
   * Return a copy of the document that writes its Markdown in the given style.
   *
   * The style replaces any style the document had, and applies to everything inside it.
   *
   * Without this call, a template or parsed text keeps the style of its own text. Spacing and table padding may still
   * change.
   *
   * @example
   * md.document(md.list(['German'])).withStyle({ bullet: '*' });
   * // * German
   */
  withStyle(style: MarkdownStyle): MDDocument;
}

/**
 * Describes YAML frontmatter between `---` lines, made by {@link frontmatter}.
 *
 * It goes only first in a document.
 */
export interface MDFrontmatter extends MDElement {
  readonly kind: 'frontmatter';
  readonly type: 'frontmatter';
}

/**
 * Describes paragraphs, lists and other blocks that go where paragraphs can, such as {@link parse} returns for text
 * longer than one paragraph.
 *
 * Markdown from text keeps the style of that text, such as its bullet markers.
 */
export interface MDFragment extends MDElement {
  readonly kind: 'block';
  readonly type: 'fragment';
}

/** Describes formatted text that goes anywhere a string can, such as {@link parse} returns for one paragraph. */
export interface MDInlineFragment extends MDElement {
  readonly kind: 'inline';
  readonly type: 'inlineFragment';
}

/** Describes a heading's depth: 1 for the page title, 2 for its sections, and so on down to 6. */
export type HeadingDepth = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Describes an element that goes inside a line, such as text, a link or formatting.
 *
 * A comment goes either inside a line or on its own.
 */
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

/** Describes an element that goes on its own lines, such as a paragraph, list or table. */
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
 * Describes what goes inside a line: text, links, formatting or code.
 *
 * - A string shows exactly as given, even if it contains Markdown.
 * - An array's pieces are joined as given, with no spaces added.
 */
export type InlineContent = string | MDInline | readonly InlineContent[];

/** Describes a paragraph, list, table or other block, or an array of them. */
export type BlockContent = MDBlock | readonly BlockContent[];

/**
 * Describes text, links, formatting or code; a list, table or other block; or a list item.
 *
 * A list item forms a list with the list items next to it.
 */
export type BlockOrInlineContent = InlineContent | BlockContent | MDListItem;

/** Describes any {@link BlockOrInlineContent}, or an array that mixes them. */
export type AnyContent = BlockOrInlineContent | readonly BlockOrInlineContent[];

/**
 * Describes a piece of a list item.
 *
 * Text, links, formatting and code in a row form one line. A paragraph, list or other block goes on its own lines below
 * them.
 */
export type ListItemContent = BlockOrInlineContent;

/** Describes one item of a list: a single piece, or an array of pieces. */
export type ListEntry = InlineContent | MDBlock | MDListItem | readonly ListItemContent[];

/** Describes a list: bulleted by default, or numbered with `ordered: true`. */
export type ListOptions = { ordered?: false | undefined } | ({ ordered: true } & OrderedListOptions);

/** Describes a numbered list. */
export interface OrderedListOptions {
  /** Holds the number of the first item, a whole number from 0 to 999999999. It's 1 by default. */
  start?: number | undefined;
}

/** Describes one entry of a definition list: a term and its definition. */
export type DefinitionEntry = readonly [term: InlineContent, definition: AnyContent];

/** Names how a table column is aligned. */
export type ColumnAlignName = 'left' | 'center' | 'right';

/** Lists the table delimiters GitHub's docs use: `:---` left, `:---:` center, `---:` right, `---` none. */
export type ColumnDelimiterExplicit = ':---' | ':---:' | '---:' | '---';

/**
 * Describes how a table column is aligned, as its delimiter is written in a table: `:---` left, `:---:` center,
 * `---:` right, or `---` for none.
 *
 * Any number of `-` works, one or more.
 *
 * @pattern ^:?-+:?$
 * @example ':---:'
 */
export type ColumnDelimiter = string;

/** Describes how a table column is aligned: a name, a delimiter, or `undefined` for none. */
export type ColumnAlign = ColumnAlignName | ColumnDelimiter | ColumnDelimiterExplicit | undefined;

/** Describes the options of {@link table} and {@link htmlTable}. */
export interface TableOptions {
  /** Holds each column's alignment, one entry per column. A column without one isn't aligned. */
  align?: readonly ColumnAlign[] | undefined;
}

/** Lists the characters that can mark a bulleted list item. */
export type BulletMarker = '*' | '+' | '-';
/** Lists the characters that can follow the number of a numbered list item. */
export type OrderedBulletMarker = '.' | ')';
/** Lists the characters that can mark italic or bold text. */
export type EmphasisMarker = '*' | '_';
/** Lists the characters that can make a code fence. */
export type FenceMarker = '`' | '~';
/** Lists the characters that can make a line across the page. */
export type RuleMarker = '*' | '-' | '_';

/**
 * Describes how Markdown is written.
 *
 * A field left out keeps the default.
 */
export interface MarkdownStyle {
  /** Holds the marker of a bulleted list item. */
  bullet?: BulletMarker | undefined;
  /** Holds the marker after the number of a numbered list item. */
  bulletOrdered?: OrderedBulletMarker | undefined;
  /** Holds the marker around italic text. */
  emphasis?: EmphasisMarker | undefined;
  /** Holds the marker around bold text, written twice. */
  strong?: EmphasisMarker | undefined;
  /** Holds the character of a code fence. */
  fence?: FenceMarker | undefined;
  /** Holds whether a code block is fenced, rather than indented. */
  fences?: boolean | undefined;
  /** Holds whether numbered list numbers count up, rather than repeat. */
  incrementListMarker?: boolean | undefined;
  /** Holds the character of a line across the page. */
  rule?: RuleMarker | undefined;
}

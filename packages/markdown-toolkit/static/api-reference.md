## Functions

### Text

- `p(...content)` (also `paragraph`): Creates a paragraph from one or more pieces, such as strings and links.
- `text(value)` (also `inlineText`): Creates text that shows exactly as given, even if it contains Markdown or HTML.
- `blockText(value)`: Creates paragraphs from plain text, starting a new one at each blank line.
- `parse(markdown)` (also `parseFragment`): Parses Markdown text so it can be added to a page with its formatting.
- `lineBreak()`: Starts a new line without starting a new paragraph.
- `htmlEntity(value)`: Creates a character written as an HTML reference, such as `&nbsp;` for a no-break space.
- `br()`: Starts a new line with an HTML `<br/>` tag.
- `comment(text)`: Creates an HTML comment, `<!-- text -->`, which the page doesn't show.
- `copy`: A copyright sign, written `&copy;`.
- `emsp`: A space as wide as the letter m, written `&emsp;`.
- `ensp`: A space as wide as the letter n, written `&ensp;`.
- `hellip`: An ellipsis, written `&hellip;`.
- `mdash`: An em dash, written `&mdash;`.
- `nbsp`: A no-break space, written `&nbsp;`. The words on either side of it stay on one line.
- `ndash`: An en dash, written `&ndash;`.
- `shy`: A soft hyphen, written `&shy;`. A long word may break there, and shows a hyphen only when it does.
- `thinsp`: A thin space, written `&thinsp;`.

### Links and formatting

- `link(content, url)`: Creates a link that shows `content` and goes to `url`.
- `strong(content)`: Creates bold text.
- `emphasis(content)`: Creates italic text.
- `strikethrough(content)`: Creates text with a line through it.

### Headings and sections

- `heading(depth, content)`: Creates a heading.
- `hr()` (also `horizontalRule`): Creates a line across the page, to separate sections.
- `details(summary, ...content)`: Creates a collapsible section: the reader sees `summary` and clicks it to show the content.

### Lists and tables

- `list(entries, options?)`: Creates a bulleted or numbered list, one item per entry.
- `ol(entries, options?)`: Creates a numbered list, one item per entry.
- `ul(entries)`: Creates a bulleted list, one item per entry.
- `listItem(...content)`: Creates one list item from several pieces.
- `table(header, rows, options?)`: Creates a table with a header row, then one row per entry.
- `htmlTable(header, rows, options?)`: Creates a table whose cells can hold anything, including lists and paragraphs.
- `dl(entries)` (also `definitionList`): Creates a list of terms, each followed by its definition.

### Code

- `codeBlock(code, lang?)`: Creates a block of code, shown exactly as given.
- `inlineCode(code)`: Creates code within a line of text, shown exactly as given.

### Templates

- `template(markdown, values)` (also `templateFragment`): Creates Markdown from a template by substituting values for its `{@ name @}` placeholders.
- `inlineTemplate(markdown, values)`: Creates a line of Markdown from a template by substituting values for its `{@ name @}` placeholders.
- `blockTemplate(markdown, values)`: Creates paragraphs and other blocks from a template by substituting values for its `{@ name @}` placeholders.
- `templateDocument(markdown, values)`: Creates a whole Markdown file from a template by substituting values for its `{@ name @}` placeholders.
- `substitutePlaceholders(content, values)`: Substitute values for the `{@ name @}` placeholders in an existing element, such as a parsed file, or in plain text.
- `placeholder(name)`: Creates a `{@ name @}` placeholder for a value to be substituted later.
- `blockPlaceholder(name)`: Creates a `{@ name @}` placeholder on lines of its own, for a value to be substituted later.

### Documents

- `document(...content)`: Creates a whole Markdown file from its parts, in order.
- `frontmatter(yaml)`: Creates YAML frontmatter for the start of a file, between `---` lines.
- `detectStyle(markdown)`: Detects how an existing Markdown text is written, such as its bullet and emphasis markers.
- `parseDocument(markdown)`: Parses a whole Markdown file, frontmatter included.

### Elements

- `isMarkdown(value)`: Checks whether a value is an element made by this library, such as a paragraph or a link.
- `toBlock(content)`: Puts text, links and other pieces in a paragraph of their own, and leaves paragraphs, lists and other blocks as they are.

## Functions

### Text

- `p(...content)` (also `paragraph`): Create a paragraph from one or more pieces, such as strings and links.
- `text(value)` (also `inlineText`): Create text that shows exactly as given, even if it contains Markdown or HTML.
- `blockText(value)`: Create paragraphs from plain text, starting a new one at each blank line.
- `parse(markdown)` (also `parseFragment`): Parse Markdown text so it can be added to a page with its formatting.
- `lineBreak()`: Start a new line without starting a new paragraph.
- `htmlEntity(value)`: Create a character written as an HTML reference, such as `&nbsp;` for a no-break space.
- `nbsp`: Holds a no-break space, written `&nbsp;`. The words on either side of it stay on one line.
- `ensp`: Holds a space as wide as the letter n, written `&ensp;`.
- `emsp`: Holds a space as wide as the letter m, written `&emsp;`.
- `thinsp`: Holds a thin space, written `&thinsp;`.
- `shy`: Holds a soft hyphen, written `&shy;`. A long word may break there, and shows a hyphen only when it does.
- `mdash`: Holds an em dash, written `&mdash;`.
- `ndash`: Holds an en dash, written `&ndash;`.
- `hellip`: Holds an ellipsis, written `&hellip;`.
- `copy`: Holds a copyright sign, written `&copy;`.
- `br()`: Start a new line with an HTML `<br/>` tag.
- `comment(text)`: Create an HTML comment, `<!-- text -->`, which the page doesn't show.

### Links and formatting

- `link(content, url)`: Create a link that shows `content` and goes to `url`.
- `strong(content)`: Create bold text.
- `emphasis(content)`: Create italic text.
- `strikethrough(content)`: Create text with a line through it.

### Headings and sections

- `heading(depth, content)`: Create a heading.
- `hr()` (also `horizontalRule`): Create a line across the page, to separate sections.
- `details(summary, ...content)`: Create a collapsible section: the reader sees `summary` and clicks it to show the content.

### Lists and tables

- `list(entries, options?)`: Create a bulleted or numbered list, one item per entry.
- `ol(entries, options?)`: Create a numbered list, one item per entry.
- `ul(entries)`: Create a bulleted list, one item per entry.
- `listItem(...contentRest)` (also `li`): Create one list item from several pieces.
- `taskListItem(...content)`: Create one task list item: a list item with a checkbox.
- `table(header, rows, options?)`: Create a table with a header row, then one row per entry.
- `htmlTable(header, rows, options?)`: Create a table whose cells can hold anything, including lists and paragraphs.
- `dl(entries)` (also `definitionList`): Create a list of terms, each followed by its definition.

### Code

- `codeBlock(code, lang?)`: Create a block of code, shown exactly as given.
- `inlineCode(code)`: Create code within a line of text, shown exactly as given.

### Templates

- `template(markdown, values)` (also `templateFragment`): Create Markdown from a template by substituting values for its `{@ name @}` placeholders.
- `inlineTemplate(markdown, values)`: Create a line of Markdown from a template by substituting values for its `{@ name @}` placeholders.
- `blockTemplate(markdown, values)`: Create paragraphs and other blocks from a template by substituting values for its `{@ name @}` placeholders.
- `templateDocument(markdown, values)`: Create a whole Markdown file from a template by substituting values for its `{@ name @}` placeholders.
- `substitutePlaceholders(content, values)`: Substitute values for the `{@ name @}` placeholders in an existing element, such as a parsed file, or in plain text.
- `placeholder(name)`: Create a `{@ name @}` placeholder for a value to be substituted later.
- `blockPlaceholder(name)`: Create a `{@ name @}` placeholder on lines of its own, for a value to be substituted later.

### Documents

- `document(...content)`: Create a whole Markdown file from its parts, in order.
- `frontmatter(yaml)`: Create YAML frontmatter for the start of a file, between `---` lines.
- `detectStyle(markdown)`: Detect how existing Markdown is written, such as its bullet and emphasis markers.
- `parseDocument(markdown)`: Parse a whole Markdown file, frontmatter included.

### Elements

- `isMarkdown(value)`: Check whether a value is an element made by this library, such as a paragraph or a link.
- `toBlock(content)`: Put text, links and other pieces in a paragraph of their own.

## Functions

### Blocks

- `codeBlock(code, lang?)`: A fenced code block. The code is inserted as is.
- `heading(depth, content)`: A heading, `## content`.
- `horizontalRule()` (also `hr`): A horizontal rule, a line between sections: `---` in the default style.
- `list(entries)`: A bulleted list, one item per entry.
- `listItem(...content)`: One list item from several pieces, for use in `list`.
- `paragraph(...content)` (also `p`): A paragraph: inline content as a block.
- `table(header, rows, options?)`: A GFM table: a header row, then one row per entry. Each cell is inline content.

### Documents

- `document(...content)`: A whole document. Arrays are flattened.
- `frontmatter(yaml)`: YAML frontmatter, for the start of a document. The text is inserted as is, between `---` lines.

### HTML blocks

- `definitionList(entries)` (also `dl`): A `<dl>` definition list, one `[term, definition]` pair per entry.
- `details(summary, ...content)`: A collapsible `<details>` block. Its content goes after the summary, with blank lines around it so Markdown renders.

### Inline

- `br()`: An HTML line break, always `<br/>`. It's self-closed, so it also works in MDX.
- `comment(text)`: An HTML comment, `<!-- text -->`. It goes inside a line or on its own.
- `emphasis(content)`: Emphasized text, `_content_`.
- `inlineCode(code)`: Inline code. The code is inserted as is.
- `lineBreak()`: A line break in the form that works where it ends up.
- `link(content, url)`: A link, `[content](url)`.
- `strikethrough(content)`: Struck-through text, `~~content~~`.
- `strong(content)`: Strong text, `**content**`.

### Parsing

- `parse(markdown)` (also `parseFragment`): Markdown text as an element, for Markdown made elsewhere.
- `parseDocument(markdown)`: A whole file as a document. Frontmatter at its start is kept as written.

### Style

- `detectStyle(markdown)`: The style an existing Markdown text uses. A construct the text doesn't use gets the default.

### Templates

- `blockPlaceholder(name)`: A `{@ name @}` placeholder on its own lines, rendered exactly as written so it can be substituted later.
- `blockTemplate(markdown, values)`: Substitute values for a Markdown template's placeholders as blocks, the same way as `template`.
- `inlineTemplate(markdown, values)`: Substitute values for an inline template's placeholders, for use inside a line.
- `placeholder(name)`: A `{@ name @}` placeholder that goes where inline content does, rendered exactly as written so it can be substituted later.
- `substitutePlaceholders(element, values)`: Substitute values for the placeholders in a Markdown element.
- `template(markdown, values)` (also `templateFragment`): Substitute values for a Markdown template's `{@ name @}` placeholders.
- `templateDocument(markdown, values)`: Substitute values for a whole file's placeholders, the same way as `template`, as a document.

### Text

- `blockText(value)`: Plain text as paragraphs.
- `inlineText(value)` (also `text`): Text, for use inside a line. A `{@ name @}` placeholder in it is kept as written.

### Utilities

- `isMarkdown(value)`: Whether a value is a Markdown element.
- `toBlock(content)`: Content as blocks, for where only blocks can go.

# Markdown toolkit design

This doc records the decisions behind `@streetsidesoftware/markdown-toolkit`, for anyone changing it. The README shows how to use it.

The toolkit is for scripts that generate Markdown. A script builds Markdown elements, composes them, and calls `toString()` on the outermost one. Each piece renders correctly for where it ends up, so the script never needs to know Markdown's escaping rules.

## Elements

A builder returns a Markdown element, not a string. The element keeps its structure until it's rendered, so each piece is escaped for where it ends up. A string that is a whole paragraph is escaped differently from the same string after other text: `document('- b')` renders `\- b`, so it doesn't become a list, but `document(['x ', '- b'])` renders `x - b`.

Every element has a `kind`, which decides where it may go:

- **Inline** (`'inline'`) goes inside a line: text, a placeholder, a link, strong, emphasis, strikethrough, inline code, a line break, `<br/>`, and an inline fragment.
- **Block** (`'block'`) goes on its own lines: a heading, a paragraph, a list, a code block, a horizontal rule, a table, an HTML table, details, a definition list, a document, a fragment, and a block placeholder.
- **Comment** (`'comment'`) goes either inside a line or on its own lines, so it covers a block notice such as `cspell:disable` and an inline `cspell:ignore`.
- **List item** (`'listItem'`) goes in a list, or wherever blocks can go. There, list items in a row form a bullet list and join a list right before or after them, so items a script builds one by one form one list. Two lists in a row stay two lists. Where only inline content can go, a list item is an error that says it goes in a list.
- **Frontmatter** (`'frontmatter'`) goes only first in a document.

A fragment is blocks of Markdown made from text or by substitution: it comes from `parse()`, a template, `blockText()`, or `substitutePlaceholders()`. An inline fragment is the same for inline content, from `parse()`, a template, or `substitutePlaceholders()`. A heading and a paragraph are blocks that hold inline content.

Putting an element where its kind can't go, such as a list inside a heading, is an error. The builder types catch it at compile time, and the builders check again at runtime, for JavaScript callers and `any` values.

Converting an element to a string too early loses its kind. Writing ``text(`see ${link('a', 'u')}`)`` makes the link plain text, and it renders as `see \[a]\(u)`. Scripts compose elements, not strings.

## Building content

### Plain text

Wherever inline content goes, a plain string is text and is escaped. A `{@ name @}` placeholder in it is kept as written. Inline code and code blocks take their string as code, inserted as is.

A string is inline text everywhere, even where blocks can go. A newline in it, `\r\n` or `\r` included, is a line break wherever text goes: in a paragraph, link text, formatting, `text()`, a table cell, and a string substituted for a placeholder. That's what someone writing the string expects to see, and it's the same everywhere. The spaces and tabs next to any line break go, wherever they come from and inside formatting too, since at the edge of a line they would only show up escaped.

A blank line in a string is two line breaks. A string never splits into paragraphs by itself, because the same string would then mean something different in a list item than in a paragraph.

To turn plain text into paragraphs, a script calls `blockText(text)`. A blank line, or a line of only spaces and tabs, ends a paragraph. A newline between other lines is a soft break, so text wrapped at 80 columns reads as normal paragraphs. Each line is escaped, so a line such as `- b` stays text. The result is always a fragment, even for one paragraph.

### Sequences and lists

An array is a sequence. Arrays are flattened.

- Inline pieces are joined exactly as given, with no added spaces: `['Ref: ', link('German', '../g.md')]`. A space would need a way to suppress it before a comma, or in `` `x`s ``.
- Where only inline content can go, a block in the array is an error.
- Where blocks can go, in a document, a list item, details content, a definition, or an HTML table cell, inline pieces in a row form a paragraph and blocks follow, as in a Markdown list item.

The parts of a document, a list item and details content are listed one by one, and each goes on a line of its own, as someone typing the file would put them. Parts of text in a row still form one paragraph, which the page shows with a space between them. Joining them with nothing ran sentences together, and a script that lists sentences one by one expects them apart. A sentence built from pieces goes in a paragraph or an array, which join as given. An array is one part.

- A space or tab at the start or end of a part, or next to a block within one, is dropped. Before a line ending it would only show up escaped, and the page doesn't show it. The same goes for the edges of a summary, a term and an HTML table cell.
- A part that renders nothing still gets its line, so the parts around it are two paragraphs, as a blank line in the file would make them.
- A part that starts or ends with a line break, such as a newline in a string, needs no second line ending.

In a list, each entry is one item. An array entry is one item holding a sequence, never a nested list. A nested list is a `list(…)` inside an item.

A list is bulleted unless an option makes it numbered. In Markdown, numbering belongs to the whole list, not to an item, so the option is the list's, and so is the number it starts at. Two short builders, one per kind, sit next to it for scripts that always want the same kind.

A list item can have a checkbox, as in a GFM task list. The checkbox belongs to the item, not the list, so the option is the item's. The option follows the item's pieces, which are separate arguments as in a paragraph or a document, so square brackets in a call only ever mark a list's entries. A task list item builder, named for the GFM term, takes the same arguments, and its box is empty unless the option checks it.

The function `toBlock(content)` makes content fit where only blocks can go: blocks come back unchanged, and each run of inline pieces becomes a paragraph. It's how the result of `template()` or `parse()`, which can be either kind, goes where only blocks can go.

### Line breaks and comments

There are two line-break elements, both inline. A `lineBreak()` is a Markdown hard break, as a newline in a string is. A `br()` is always `<br/>`, never `<br>`, because MDX reads HTML as JSX, where an unclosed `<br>` is a syntax error.

Where a hard break can't go, a line break renders as `<br/>`: in a heading, a table cell, and a plain-text summary or term. In a heading, remark writes a hard break as a space at depths 3 to 6, and turns depths 1 and 2 into underlined headings.

A comment renders as `<!-- … -->`, with two dashes, as third-party bots write them. The renderer keeps the text from ending the comment early.

A comment goes where the call puts it: inside a line, at the end of one, on a line of its own, or at the start of a line. Every placement is reachable, as someone typing the file could write it. The page follows Markdown: a line that starts with a comment is HTML, so it ends the paragraph before it.

### HTML entities

Some characters are better written as an HTML reference, such as `&nbsp;`: a space the page would otherwise drop, or a character that's hard to type or to see in the file. Since a string is escaped, a reference typed in it shows as written, so an entity is an element of its own.

- It takes a character, a name or a reference, whichever the script has at hand.
- A character is written by name, since `&mdash;` reads better in the file than a number. Where a character has several names, the shortest is used, and between spellings of one name the lowercase one. A character with no name is written as a number.
- An unknown name is an error. The check is only that HTML defines the name; nothing more is worth the code.
- Constants cover the few characters scripts reach for most: spaces, dashes, the ellipsis, the soft hyphen and the copyright sign.

Raw HTML won't do: the renderer turns a line ending before raw HTML into a space. So an entity is a node of its own, written as is. As a placeholder value, it goes in as its reference in HTML, and as its character in code and frontmatter, which don't read references.

### Tables

A table takes a header and rows as arrays: `table(header, rows)`, the shape scripts already have their data in. Each cell holds inline content. Rendering keeps every cell on one line, which a GFM row needs:

- A `|` is escaped wherever it lands, in text, inline code, link text and a URL, so it never ends the cell. On GitHub, `\|` inside a code span displays as `|`.
- A line break renders as `<br/>`, since a Markdown hard break would end the row.
- A line ending in inline code, or in text from `parse()`, renders as a space, as it displays elsewhere. One at the start or end of a cell is dropped.

A column is aligned only when the script asks: `{ align: [undefined, 'right'] }`, one entry per column. An entry is `'left'`, `'center'`, `'right'`, `undefined` for none, or the delimiter as written in a table: `:---`, `:---:`, `---:` or `---`, the forms GitHub's docs use. Any number of `-` works, and a plain `---` means none, as in GFM. The type lists the four forms for docs, and is a `string` with a `@pattern`, so it maps to a JSON schema.

A short row is padded with empty cells. A row longer than the header adds a column with an empty title, rather than throwing, so the mistake shows in the output.

A table always renders padded, so its pipes line up. There's no style field for compact tables, and `detectStyle` doesn't look at tables, until a script needs it. A table from a template or `parse()` is re-rendered padded too.

### HTML tables

A GFM row is one line, so its cells hold only inline content. When a cell needs a list, a code block or a second paragraph, `htmlTable(header, rows)` writes a `<table>` instead. It takes the same arguments and options as `table()`, so a script can switch between them, and each cell holds any content, like a document. The output follows inject-markdown's HTML tables:

- `<table>`, `<thead>`, `<tbody>`, each `<tr>` and its closing tag go on their own lines.
- A cell of plain text stays on its tag's line, `<td>42</td>`, with `&` and `<` HTML-escaped. An empty cell is `<td></td>`.
- Any other cell, with inline code, a link, a placeholder or blocks, gets blank lines around it, so it renders.
- A line break, such as a newline in a string, is `<br/>` in a plain-text cell, and a hard break in a cell with Markdown. One at the start or end of a cell is dropped. Text from `parse()` is Markdown, so its line endings keep their Markdown meaning.
- An aligned column puts `align="…"` on each of its cells. GitHub keeps the `align` attribute and strips `style`.
- Every row, the header included, is filled with empty cells to the widest row, as in `table()`.
- An empty header leaves out `<thead>`. Several header rows wait until a script needs them.

### Details and definition lists

A `<details>` summary and a `<dl>` term are inline. The content and each definition are like a document's. A definition list takes `[term, definition]` pairs.

Markdown inside HTML is read only after a blank line, so rendering picks the form that works on GitHub:

- A summary or term of plain text is written on one line, `<summary>TypeScript:</summary>`, as in GitHub's own examples. Its `&` and `<` are HTML-escaped, and a line break is `<br/>`. HTML entities stay on the line too.
- A summary or term with any other inline element, such as inline code or a placeholder, gets blank lines around it, so it renders.
- The content and each definition always get blank lines around them.

### Documents and frontmatter

A document is the one element that renders with a trailing newline, because it stands alone as a file. It carries its own style; see [Rendering and style](#rendering-and-style).

Frontmatter goes first: `document(frontmatter(yaml), heading(1, title), …)`, so the code reads in file order. Anywhere else in a document, it throws. It takes YAML text, inserted as is between `---` lines. Text keeps comments and needs no YAML dependency. Making it valid YAML is the script's job.

## Placeholders

A placeholder is a `{@ name @}` slot that a later step substitutes: a template, `substitutePlaceholders`, or [inject-markdown](https://github.com/streetsidesoftware/inject-markdown), which injects generated content into Markdown files. A placeholder renders exactly as written, unescaped.

The grammar comes from [@streetsidesoftware/placeholders](../../placeholders/README.md), which inject-markdown uses too, so both read placeholders the same way. There's no escape: a backslash before `{@` doesn't stop a placeholder, in a string, a template, or `parse()`.

A placeholder isn't inline or block by itself. Where it sits decides what it can take:

- Inside a line, it takes only inline content.
- On a line of its own, where blocks can go, it also takes blocks.
- Inside code or HTML, it takes only a string, text, a placeholder or an HTML entity.

A value substituted later gives the same result as the value passed directly. So a value on a line of its own is trimmed as a part is. Empty values that leave a line empty, alone or side by side, end the paragraph, as `document('a', '', 'b')` does. In an inline template, which is one paragraph, the empty line goes instead.

Where a placeholder sits is the same whether it's written in Markdown text, in a string, or made with a builder:

- `placeholder(name)` goes anywhere inline content does. In `document('Fruit:', placeholder('fruit'))` it's on a line of its own, so it can take a list. In `p('Fruit: ', placeholder('fruit'))` it's inside the line.
- `blockPlaceholder(name)` is a block, so it always stands on its own lines and takes blocks or inline content. Inside a line it's an error, as for any block. Two types, rather than one with an `'inline' | 'block'` kind, let the compiler keep a block placeholder out of a line.
- A placeholder's string form is exactly `{@ name @}`, so it also goes inside code: ``inlineCode(`version: ${placeholder('engine.version')}`)``.

## Templates and parsing

A template is Markdown text with placeholders. Each template function substitutes the values in one call. A script that reuses a template keeps the string and calls the function again.

- `template(markdown, values)` lets the result decide its kind: a single paragraph is an inline fragment, without the whitespace around it, and anything else is a fragment. Checking `kind` narrows the result.
- `blockTemplate(markdown, values)` always returns a fragment. A single paragraph stays a paragraph.
- `inlineTemplate(markdown, values)` substitutes values in text for use inside a line. Its text must be one paragraph, and a blank line throws. Block syntax is parsed as text, so `' - Adds …'` stays text, not a list. Leading and trailing whitespace is kept, so the fragment joins the pieces around it as written.
- `templateDocument(markdown, values)` reads a whole file, frontmatter included, and returns a document.

### How values go in

A value goes in where its placeholder sits, as [Placeholders](#placeholders) describes. A value of the wrong kind is an error. Beyond that:

- A string, number, or boolean is inserted as text and escaped.
- A placeholder that is a whole line splits its paragraph around the blocks it takes, as it would around a list written in place: `Fruit:\n{@ fruit @}` gives `Fruit:` and then the list.
- Inside code or HTML, a value is inserted as is, with no Markdown escaping. The common case is a package name in an install command. The renderer lengthens a code fence when the inserted text needs it.
- In frontmatter, a placeholder takes any value, inserted as is: a string as written, and a Markdown element as it renders. Nothing is escaped or checked as YAML. As in `unindent`, each line of a value after the first gets the leading whitespace of the placeholder's line, except an empty line, which stays empty. A multi-line value stays inside a YAML block.

A placeholder with no value is kept as written. Templates can be chained, so a later template, `substitutePlaceholders`, or injection may substitute it. There's no strict option: a script that needs every placeholder substituted checks its output with `hasPlaceholders` or `listPlaceholders` from @streetsidesoftware/placeholders.

The concerns that apply at injection time, such as untrusted values and link rebasing, don't apply here. The same script owns the template and its values, so values aren't sanitized and links aren't rebased.

### Resolving names

The values are a plain object or a function. A function gets the whole name, so the values can come from anywhere, such as a `Map`. It works as in @streetsidesoftware/placeholders: `undefined` keeps the placeholder, as a missing key does. A result that isn't a value counts as no value, as it does in an object.

In an object, dotted names walk into it: `template(tpl, { pkg: { name: '@cspell/dict-grc' } })`. The object resolves names the same way inject-markdown does:

- The top-level keys are candidates, in the object's key order. A top-level key may be a dotted name. Below the top level, a key is a single segment, and only own properties count.
- The last key wins: keys are tried from last to first.
- A key matches when it equals the name, or when it equals a leading part of it and the rest of the name resolves inside its value.
- A key that doesn't hold the rest of the name doesn't stop the search. The next earlier key is tried.

```ts
{
    'a.b': { c: 1, e: 5 },
    a: { b: { c: 0, d: 1 } },
}
```

- `a.b.c` is `0`: the later key `a` wins.
- `a.b.d` is `1`, from `a`.
- `a.b.e` is `5`: `a` has no `e`, so `'a.b'` is tried.

Trying the exact key first, or the longest key first, would ignore the order a reader sees, and a later key couldn't override an earlier, longer one.

JavaScript moves integer-like keys, such as `'2'`, to the front of the key order. That only matters for a name whose first segment is all digits.

### Markdown made elsewhere

The function `parse(markdown)` brings in Markdown that is already written, such as a `markdownDescription` from a `package.json`. It's `template()` without the substitution: a single paragraph is an inline fragment, anything else is a fragment, and placeholders are kept as written. Its counterpart `parseDocument(markdown)` reads a whole file as a document.

Whether a leading `---` starts frontmatter or is a rule can't be told from the text alone, so the script says what it reads:

- The functions `parseDocument` and `templateDocument` read a whole file. Frontmatter starts with a first line of exactly `---` and ends at the next line of exactly `---`. Without a closing line, there's none. The frontmatter is kept as written.
- The functions `parse` and `template` read fragments, where a leading `---` is always a rule. The names `parseFragment` and `templateFragment` are aliases for them.

## Substituting placeholders

The function `substitutePlaceholders` puts values in place of the placeholders of an element already made, such as one from `parse()`, so content can be built in steps:

- Values go in as in templates, and names resolve the same way.
- Only the names given a value are substituted. The others stay as written, for a later step or injection.
- Placeholders in a document's frontmatter are substituted too.
- The element given is left unchanged.

The result is the same kind of element, in the same style, when it can hold what was substituted. One that can't becomes a fragment, rather than throwing, so the caller never has to rebuild an element to fit.

## Rendering and style

Calling `toString()` renders an element and everything in it, without a trailing newline (except a document). There's no separate render function, and `toString()` takes no options, because a template literal calls it with no arguments. An element also renders inside `${element}`, so it drops into existing templates such as `unindent`.

An element renders in a fixed default style: `-` bullets, `_emphasis_`, `**strong**`, backtick fences, and `---` rules. The exceptions:

- A fragment from `template()` or `parse()`, or a document from `parseDocument()` or `templateDocument()`, renders in the style detected from its own text.
- `doc.withStyle(style)` returns a copy of a document that renders in that style. Fields the style leaves out keep the default.
- `detectStyle(markdown)` reads the style an existing file uses, so a script can match it: `document(…).withStyle(detectStyle(existing))`. A construct the file doesn't use gets the default.

Everything inside a document renders in the document's style. A fragment's own style applies only when it's rendered by itself. When builder output is injected, inject-markdown re-renders it in the target file's style, so the default shows only when a script writes a file directly.

A line ending or `lineBreak()` at the start or end of a paragraph, heading or table cell is dropped. Nothing is on its other side, so it can't display, and kept it would render as `&#xA;` or a literal `\`.

Empty bold, italic or struck-through text, and empty inline code, render as one space in that form. The reader should still see that it's there. Markdown has no empty form of either: markers with nothing between them show as text, as in `a****b`, or as a horizontal rule for `****` on its own line, and two empty code spans turn the text between them into code. This covers content left empty by substitution. Whitespace stays as given.

An empty paragraph renders nothing, since it would only add blank lines between blocks. A link always stays, even with no text or URL, since the Markdown is the output and a link's text and URL are part of it. A paragraph of whitespace or of empty formatting isn't empty: it still shows something.

Spaces and tabs at the start or end of a paragraph, a heading or a table cell go, as line endings and line breaks there do. The page never shows them, so in the file they would only show up escaped. A paragraph of only whitespace keeps it. The same goes for spaces and tabs around a line ending inside a paragraph's text. A paragraph can't hold an empty line either, so one in its text, such as a value's own line ending next to the template's, becomes one line ending. A paragraph that this trimming leaves empty renders nothing.

## Errors

An element of the wrong kind throws a `TypeError`, such as a block where only inline content can go, or frontmatter that isn't first in a document. Other misuse throws an `Error`, such as a heading depth outside 1–6, an invalid placeholder name, or an inline template that isn't one paragraph. Each message names what was wrong: `heading content must be inline, got a list`.

A toolkit-specific error class waits until a caller needs to catch one specifically.

## Internals

An element is made only by a factory function, such as `link(…)` or `list(…)`. The public types (`MDLink`, `MDList`, and so on) are interfaces: a `kind`, which says where the element may go, a `type`, which says which element it is, a `description` for error messages, and `toString()`. The literal type of `type` tells the public types apart, and code branches on `type`, never on `description`, so rewording a message changes no type and no behavior. Underneath, one internal class stores the mdast nodes an element renders as, and its style, under the key `Symbol.for('@streetsidesoftware/markdown-toolkit.value')`. Having that key is what makes a value a Markdown element, and what `isMarkdown(x)` checks.

- The node tree stays internal. The public types never mention mdast.
- Factories are the only way to make an element, so the internal class can change without changing the API.
- The key comes from the global symbol registry, so an element made by another loaded copy of the package is recognized. The key keeps the name `.value` from before elements were renamed, so older copies still match.
- The key names the package. If what's stored under it ever changes incompatibly, a new key such as `….value.1` can be used.
- The key is a brand, not privacy: anyone can read it.

A placeholder is an mdast node type of its own, which the renderer writes as is. If it were an HTML node, a line ending before it would render as a space, and a placeholder written on its own line would end up inside the line before it. HTML inside a line, such as a comment or `<br/>`, gets a node type of its own for the same reason.

The `MarkdownStyle` type is the package's own interface, not remark-stringify's options, so the public types don't tie the API to remark's version. Fields are added when a script needs them.

The package has one entry, and it doesn't re-export the placeholder helpers. A script that needs them, such as `listPlaceholders`, imports @streetsidesoftware/placeholders.

## Not built: flavors

A possible feature. The issue it addresses is real: Docusaurus 3 parses even `.md` files as MDX, so output that is valid GitHub Markdown can fail to build there.

- A document would render for a target flavor. The default, `'github'`, is GitHub's Markdown.
- A call like `doc.withFlavor('mdx')` would return a copy of the document that renders as valid MDX.
- The toolkit helps scripts whose Markdown is consumed by MDX. It isn't another way to write MDX, so MDX-only helpers, such as an MDX comment, are added only when a script needs them.
- Flavor is separate from style. A style chooses between equivalent forms and can be detected from a file. A flavor decides what is valid, and only the script knows its target.
- In `'mdx'`:
  - `{` and `<` in text are escaped.
  - A comment renders as `{/* … */}`. Docusaurus accepts `<!-- -->` today only through its MDX 1 compatibility setting, which its v4 defaults turn off.
  - Raw HTML is valid JSX, as `<br/>` already is.
  - A plain-text summary or term, written on one line in `'github'`, also needs Markdown escaping. MDX reads Markdown inside JSX, where GitHub reads raw HTML.
  - A kept placeholder throws when rendering. The text `{@ name @}` is an invalid MDX expression, and an `'mdx'` document is final output.
- Flavor-only constructs, such as GitHub alerts (`> [!NOTE]`) and Docusaurus admonitions (`:::note`), wait until a script needs them.

## README examples

The README opens with two examples that make the same page, one with a template and one with builders, to show that generating Markdown from data is easy. A guide follows, in parts: Build in code, Templates, Whole pages, and Match an existing file's style. Each part goes from common and simple elements to rare ones, so text and headings come first, tables after lists, then details and definition lists last.

- Each section teaches the main path. A rule stays only if a reader would get it wrong without it; the full rules are in the JSDoc.
- Steps are imperative, behavior is in the present tense, and the text never says "you".
- Every example prints with `console.log(x.toString())`, names its result for what it is, and uses realistic cspell data.
- Code and output fit in 70 columns, since npmjs.com scrolls a wider code block. A Prettier override sets that width for example code.

The [examples README](../examples/README.md) describes the folder layout. Running `pnpm run build:readme` from the repo root runs the examples, so the output shown is what the code printed. One example shows one idea and has one output.

## Function reference

The README ends with a `## Functions` section that `gen-api-reference` writes from the code into `static/api-reference.md`, so the README never carries a hand-edited list of exports. It lists every function `src/index.ts` exports, one line each: its parameter names, its other names, such as `paragraph` for `p`, and its summary.

- Each exported function's JSDoc has a `@category` tag that says what the function is, such as `style` or `line-breaks`. Users see it in editor hovers, so it describes the function, not the README's layout.
- `.api-referencerc.json` lays out the reference. It lists the groups in order, each with its heading and the categories under it, so several small categories can share one heading. Changing a heading or the order never touches `src/`, and neither does renaming a guide section.
- A heading is named for what a reader wants to do, such as Code, Lists and tables or Documents, not for Markdown's block and inline split.
- Groups go from common to rare, as the guide does. Within a group, the config's `functions` list leads with the main functions, then their variants; the rest follow alphabetically.
- A new function needs a category, and a new category needs a group in the config. A category in no group, in two, or used by no function fails.
- An alias, a `const` that names a function or a renamed re-export, needs no tag of its own.
- The summary is the first paragraph of the JSDoc, as Markdown renders it, so a blank line ends it. A `@summary` tag replaces it.
- A summary is at most 140 characters, the length of a comment line. The only inline tag it may use is `{@link name}`, and raw HTML fails, since it's almost always a tag meant as text: write `` `<details>` ``.
- A function without JSDoc, a `@category` or a summary fails `pnpm run build:readme` and the `scripts` tests. So does a config that doesn't match the code.

How to write the JSDoc itself, from the summary to the examples, is in [Writing comments and JSDoc](../../../docs/writing-comments.md#exported-functions-and-types).

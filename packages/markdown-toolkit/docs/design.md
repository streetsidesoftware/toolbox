# Markdown toolkit design

This doc records the decisions behind `@streetsidesoftware/markdown-toolkit`, for anyone changing it. The README shows how to use it.

The toolkit is for scripts that generate Markdown. A script builds Markdown values, composes them, and calls `toString()` on the outermost one. Escaping happens there, based on where each piece ends up, so the script never needs to know the escaping rules.

```ts
const extensions = [
  { name: 'Greek [Ancient]', url: 'https://example.com/grc', description: 'Adds *Ancient Greek* words' },
  { name: 'Arabic', url: 'https://example.com/ar', description: 'Adds Arabic words' },
];
list(extensions.map((e) => [link(e.name, e.url), ` - ${e.description}`])).toString();
```

```markdown
- [Greek \[Ancient\]](https://example.com/grc) - Adds \*Ancient Greek\* words
- [Arabic](https://example.com/ar) - Adds Arabic words
```

The brackets in the link text and the asterisks in the description are escaped, so they show as written.

## Values

A builder returns a Markdown value, not a string. The value keeps its structure until it's rendered, so each piece is escaped for where it ends up. A string that is a whole paragraph is escaped differently from the same string after other text: `document('- b')` renders `\- b`, so it doesn't become a list, but `document(['x ', '- b'])` renders `x - b`.

Every value has a `kind`, which decides where it may go:

- **Inline** goes inside a line: text, a placeholder, a link, strong, emphasis, strikethrough, inline code, a line break, `<br/>`, and an inline fragment.
- **Block** goes on its own lines: a heading, a paragraph, a list, a code block, a horizontal rule, details, a definition list, a document, a fragment, and a block placeholder.
- **Comment** goes either inside a line or on its own lines, so it covers a block notice such as `cspell:disable` and an inline `cspell:ignore`.
- **List item** goes only directly in a list.
- **Frontmatter** goes only first in a document.

A fragment is blocks made from text, by `parse()`, a template, or `blockText()`. An inline fragment is the content of one paragraph made from text, by `parse()` or a template. A heading and a paragraph are blocks that hold inline content.

Putting a value where its kind can't go, such as a list inside a heading, is an error. The builder types catch it at compile time, and the builders check again at runtime, for JavaScript callers and `any` values.

Converting a value to a string too early loses its kind. Writing ``text(`see ${link('a', 'u')}`)`` makes the link plain text, and it renders as `see \[a]\(u)`. Scripts compose values, not strings.

## Building content

### Plain text

Wherever inline content goes, a plain string is text and is escaped. A `{@ name @}` placeholder in it is kept as written. Inline code and code blocks take their string as code, inserted as is.

A string is inline text everywhere, even where blocks can go. A newline in it stays in the text and displays as a space. A string never splits into paragraphs by itself, because the same string would then mean something different in a list item than in a paragraph.

To turn plain text into paragraphs, a script calls `blockText(text)`. A blank line, or a line of only spaces and tabs, ends a paragraph. A newline between other lines is a soft break, so text wrapped at 80 columns reads as normal paragraphs. Each line is escaped, so a line such as `- b` stays text. The result is always a fragment, even for one paragraph.

### Sequences and lists

An array is a sequence. Arrays are flattened.

- Inline pieces are joined exactly as given, with no added spaces: `['Ref: ', link('German', '../g.md')]`. A space would need a way to suppress it before a comma, or in `` `x`s ``.
- Where only inline content can go, a block in the array is an error.
- Where blocks can go, in a document, a list item, details content, or a definition, inline pieces in a row form a paragraph and blocks follow, as in a Markdown list item: `document('See ', link(…), '.')` is one paragraph.

In a list, each entry is one item. An array entry is one item holding a sequence, never a nested list. A nested list is a `list(…)` inside an item.

The function `toBlock(content)` makes content fit where only blocks can go: blocks come back unchanged, and each run of inline pieces becomes a paragraph. It's how the result of `template()` or `parse()`, which can be either kind, goes where only blocks can go.

### Documents and frontmatter

A document is the one value that renders with a trailing newline, because it stands alone as a file. It carries its own style; see [Rendering and style](#rendering-and-style).

Frontmatter goes first: `document(frontmatter(yaml), heading(1, title), …)`, so the code reads in file order. Anywhere else in a document, it throws. It takes YAML text, inserted as is between `---` lines. Text keeps comments and needs no YAML dependency. Making it valid YAML is the script's job.

### Details and definition lists

A `<details>` summary and a `<dl>` term are inline. The content and each definition are like a document's. A definition list takes `[term, definition]` pairs.

Markdown inside HTML is read only after a blank line, so rendering picks the form that works on GitHub:

- A summary or term of plain text is written on one line, `<summary>TypeScript:</summary>`, as in GitHub's own examples. Its `&` and `<` are HTML-escaped, and blank lines are dropped, since one would end the HTML block.
- A summary or term with any other inline value, such as inline code or a placeholder, gets blank lines around it, so it renders.
- The content and each definition always get blank lines around them.

### Line breaks and comments

There are two line-break values, both inline. A `lineBreak()` is a Markdown hard break. A `br()` is always `<br/>`, never `<br>`, because MDX reads HTML as JSX, where an unclosed `<br>` is a syntax error.

A comment renders as `<!-- … -->`, with two dashes, as third-party bots write them. The renderer keeps the text from ending the comment early.

## Placeholders

A placeholder is a `{@ name @}` slot that a later step fills: a template, `substitutePlaceholders`, or [inject-markdown](https://github.com/streetsidesoftware/inject-markdown), which injects generated content into Markdown files. A placeholder renders exactly as written, unescaped.

The grammar comes from [@streetsidesoftware/placeholders](../../placeholders/README.md), which inject-markdown uses too, so both read placeholders the same way. There's no escape: a backslash before `{@` doesn't stop a placeholder, in a string, a template, or `parse()`.

A placeholder isn't inline or block by itself. Where it sits decides what it can take:

- Inside a line, it takes only inline content.
- On a line of its own, where blocks can go, it also takes blocks.
- Inside code or HTML, it takes only a string, text, or a placeholder.

Where a placeholder sits is the same whether it's written in Markdown text, in a string, or made with a builder:

- `placeholder(name)` goes anywhere inline content does. In `document('Fruit:\n', placeholder('fruit'))` it's on a line of its own, so it can take a list. In `document('Fruit:', placeholder('fruit'))` it's inside the line.
- `blockPlaceholder(name)` is a block, so it always stands on its own lines and takes blocks or inline content. Inside a line it's an error, as for any block. Two types, rather than one with an `'inline' | 'block'` kind, let the compiler keep a block placeholder out of a line.
- A placeholder's string form is exactly `{@ name @}`, so it also goes inside code: ``inlineCode(`version: ${placeholder('engine.version')}`)``.

## Templates and parsing

A template is Markdown text with placeholders. Each template function fills one in one call. A script that reuses a template keeps the string and calls the function again.

- `template(markdown, values)` lets the filled result decide its kind: a single paragraph is an inline fragment, without the whitespace around it, and anything else is a fragment. Checking `kind` narrows the result.
- `blockTemplate(markdown, values)` always returns a fragment. A single paragraph stays a paragraph.
- `inlineTemplate(markdown, values)` fills text for use inside a line. Its text must be one paragraph, and a blank line throws. Block syntax is parsed as text, so `' - Adds …'` stays text, not a list. Leading and trailing whitespace is kept.
- `templateDocument(markdown, values)` reads a whole file, frontmatter included, and returns a document.

### How values go in

A value goes in where its placeholder sits, as [Placeholders](#placeholders) describes. A value of the wrong kind is an error. Beyond that:

- A string, number, or boolean is inserted as text and escaped.
- A placeholder that is a whole line splits its paragraph around the blocks it takes, as it would around a list written in place: `Fruit:\n{@ fruit @}` gives `Fruit:` and then the list.
- Inside code or HTML, a value is inserted as is, with no Markdown escaping. The common case is a package name in an install command. The renderer lengthens a code fence when the inserted text needs it.
- In frontmatter, a placeholder takes any value, inserted as is: a string as written, and a Markdown value as it renders. Nothing is escaped or checked as YAML. As in `unindent`, each line of a value after the first gets the leading whitespace of the placeholder's line, so a multi-line value stays inside a YAML block.

A placeholder with no value is kept as written. Templates can be chained, so a later template, `substitutePlaceholders`, or injection may fill it. There's no strict option: a script that needs every placeholder filled checks its output with `hasPlaceholders` or `listPlaceholders` from @streetsidesoftware/placeholders.

The concerns that apply at injection time, such as untrusted values and link rebasing, don't apply here. The same script owns the template and its values, so values aren't sanitized and links aren't rebased.

### Resolving names

The values are a plain object, and dotted names walk into it: `template(tpl, { pkg: { name: '@cspell/dict-grc' } })`. The object resolves names the way inject-markdown resolves declarations:

- Each top-level key acts as a declaration, in the object's key order. A top-level key may be a dotted name. Below the top level, a key is a single segment, and only own properties count.
- The newest declaration wins: keys are tried from last to first.
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

The function `parse(markdown)` brings in Markdown that is already written, such as a `markdownDescription` from a `package.json`. It's `template()` without the filling: a single paragraph is an inline fragment, anything else is a fragment, and placeholders are kept as written. Its counterpart `parseDocument(markdown)` reads a whole file as a document.

Whether a leading `---` starts frontmatter or is a rule can't be told from the text alone, so the script says what it reads:

- The functions `parseDocument` and `templateDocument` read a whole file. Frontmatter starts with a first line of exactly `---` and ends at the next line of exactly `---`. Without a closing line, there's none. The frontmatter is kept as written.
- The functions `parse` and `template` read fragments, where a leading `---` is always a rule. The names `parseFragment` and `templateFragment` are aliases for them.

## Substituting placeholders

The function `substitutePlaceholders(value, values)` puts values in place of the placeholders of a value already made, such as one from `parse()`, so content can be built in steps:

- Values go in as in templates, and names resolve the same way.
- Only the names that `values` has are substituted. The others stay as written, for a later step or injection.
- A document's frontmatter is filled too.
- The value given is left unchanged.

The result is the same type, in the same style, when the value can hold what was substituted. A value that can't becomes a fragment, rather than throwing, so the caller never has to rebuild a value to fit. The return type, `SubstitutedValue<T>`, says which values can change:

- Text stays text when every value is a string or text. Otherwise it becomes an inline fragment, or a fragment when a whole-line placeholder took blocks.
- An inline fragment or a paragraph that takes blocks becomes a fragment. That includes `parse('{@ x @}')` given a list, as in `template()`.
- A placeholder with a value becomes a fragment of it. A block placeholder always becomes a fragment.

## Rendering and style

Calling `toString()` renders a value and everything in it, without a trailing newline (except a document). There's no separate render function, and `toString()` takes no options, because a template literal calls it with no arguments. A value also renders inside `${value}`, so it drops into existing templates such as `unindent`.

A value renders in a fixed default style: `-` bullets, `_emphasis_`, `**strong**`, backtick fences, and `---` rules. The exceptions:

- A fragment from `template()` or `parse()`, or a document from `parseDocument()` or `templateDocument()`, renders in the style detected from its own text.
- `doc.withStyle(style)` returns a copy of a document that renders in that style. Fields the style leaves out keep the default.
- `detectStyle(markdown)` reads the style an existing file uses, so a script can match it: `document(…).withStyle(detectStyle(existing))`. A construct the file doesn't use gets the default.

Everything inside a document renders in the document's style. A fragment's own style applies only when it's rendered by itself. When builder output is injected, inject-markdown re-renders it in the target file's style, so the default shows only when a script writes a file directly.

A line ending or `lineBreak()` at the start or end of a paragraph or heading is dropped. Nothing is on its other side, so it can't display, and kept it would render as `&#xA;` or a literal `\`.

## Errors

A value of the wrong kind throws a `TypeError`, such as a block where only inline content can go, or frontmatter that isn't first in a document. Other misuse throws an `Error`, such as a heading depth outside 1–6, an invalid placeholder name, or an inline template that isn't one paragraph. Each message names what was wrong: `heading content must be inline, got a list`.

A toolkit-specific error class waits until a caller needs to catch one specifically.

## Internals

A value is made only by a factory function, such as `link(…)` or `list(…)`. The public types (`MDLink`, `MDList`, and so on) are interfaces: a `kind`, a `description` for error messages, and `toString()`. The literal type of `description` tells the public types apart. Underneath, one internal class stores the mdast nodes a value renders as, and its style, under the key `Symbol.for('@streetsidesoftware/markdown-toolkit.value')`. Having that key is what makes a value a Markdown value, and what `isMarkdown(x)` checks.

- The node tree stays internal. The public types never mention mdast.
- Factories are the only way to make a value, so the internal class can change without changing the API.
- The key comes from the global symbol registry, so a value made by another loaded copy of the package is recognized.
- The key names the package. If what's stored under it ever changes incompatibly, a new key such as `….value.1` can be used.
- The key is a brand, not privacy: anyone can read it.

A placeholder is an mdast node type of its own, which the renderer writes as is. If it were an HTML node, a line ending before it would render as a space, and a placeholder written on its own line would end up inside the line before it.

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

The README leads a user through their goals in order: generate a file, put any text in safely, write the Markdown yourself, build a page in steps, add frontmatter, generate a page from a template file, and match an existing style. Each goal is a folder under `examples/`, with a complete `example.ts`, the `output.md` it printed, and a `README.md` that injects both. The package README injects each folder's `README.md`. Running `pnpm run build:readme` from the repo root runs the examples, so the output shown is what the code printed. One example shows one idea and has one output.

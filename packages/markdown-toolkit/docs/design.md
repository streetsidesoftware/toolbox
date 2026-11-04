# Markdown toolkit design

This doc records the decisions behind the markdown-toolkit package and their reasons, for anyone changing it. The README shows how to use it, and the code and its tests show how it behaves.

The toolkit is for scripts that generate Markdown. A script builds Markdown elements, composes them, and renders the outermost one. Each piece renders correctly for where it ends up, so the script never needs to know Markdown's escaping rules.

## Elements

A builder returns a Markdown element, not a string. The element keeps its structure until it's rendered, so each piece is escaped for where it ends up.

Every element has a kind, which decides where it may go:

- **Inline** goes inside a line.
- **Block** goes on its own lines.
- **Comment** goes either inside a line or on its own lines, so it covers both a block notice and an inline one.
- **List item** goes in a list, or wherever blocks can go. There, list items in a row form a list and join a list next to them, so items a script builds one by one form one list.
- **Frontmatter** goes only first in a document.

Putting an element where its kind can't go is an error. The builder types catch it at compile time, and the builders check again at runtime, for untyped callers.

Converting an element to a string too early loses its kind. Scripts compose elements, not strings.

## Building content

### Plain text

Wherever inline content goes, a plain string is text and is escaped. Code takes its string as code, inserted as is.

A string is inline text everywhere, even where blocks can go. A newline in it is a line break wherever text goes. That's what someone writing the string expects to see, and it's the same everywhere.

A string never splits into paragraphs by itself, because the same string would then mean something different in a list item than in a paragraph.

Turning plain text into paragraphs takes an explicit call. There, a single newline is a soft break, so text wrapped at 80 columns reads as normal paragraphs.

### Sequences and lists

An array is a sequence. Inline pieces are joined exactly as given, with no added spaces, since an added space would need a way to suppress it before a comma.

The parts of a document or a list item are listed one by one, and each goes on a line of its own, as someone typing the file would put them. Parts of text in a row still form one paragraph, which the page shows with a space between them. Joining them with nothing ran sentences together, and a script that lists sentences one by one expects them apart. A sentence built from pieces goes in a paragraph or an array, which join as given.

In a list, an array entry is one item holding a sequence, never a nested list.

In Markdown, numbering belongs to the whole list, not to an item, so the option is the list's, and so is the number it starts at. Two short builders, one per kind, sit next to it for scripts that always want the same kind.

A checkbox belongs to the item, not the list, so the option is the item's. The option follows the item's pieces, which are separate arguments as in a paragraph or a document, so square brackets in a call only ever mark a list's entries.

### Line breaks and comments

There are two line-break elements, both inline: a Markdown hard break and `<br/>`. The second is never written `<br>`, because MDX reads HTML as JSX, where an unclosed `<br>` is a syntax error. Where a hard break can't go, a line break renders as `<br/>`.

A comment renders with two dashes, as third-party bots write them. It goes where the call puts it. Every placement is reachable, as someone typing the file could write it.

### HTML entities

Some characters are better written as an HTML reference, such as `&nbsp;`: a space the page would otherwise drop, or a character that's hard to type or to see in the file. Since a string is escaped, a reference typed in it shows as written, so an entity is an element of its own. It takes whatever form the script has at hand.

A character is written by name when it has one, since `&mdash;` reads better in the file than a number.

An entity in parsed Markdown stays a reference in the output, not the character it stands for. The character would be hard to see, and a script reading the file may strip it.

### Tables

A table takes a header and rows as arrays, the shape scripts already have their data in. Each cell holds inline content, and rendering keeps every cell on one line, which a GFM row needs. A `|` is escaped even in inline code, since on GitHub `\|` inside a code span displays as `|`.

A column is aligned only when the script asks. Alignment can also be given as the delimiter written in a table, the forms GitHub's docs use. Its type is a string with a pattern, so it maps to a JSON schema.

A row longer than the header adds a column with an empty title, rather than throwing, so the mistake shows in the output.

A table always renders padded, so its pipes line up. Compact tables wait until a script needs them.

### HTML tables, details and definition lists

A GFM row is one line, so its cells hold only inline content. An HTML table is for cells that need a list, a code block or a second paragraph. It takes the same arguments and options as a table, so a script can switch between them, and its output follows inject-markdown's HTML tables. Several header rows wait until a script needs them.

An aligned column uses the `align` attribute, because GitHub keeps it and strips `style`.

A details summary and a definition term are inline. The content and each definition are like a document's.

Markdown inside HTML is read only after a blank line, so rendering picks the form that works on GitHub. Plain text stays on its tag's line, as in GitHub's own examples, and anything else gets blank lines around it, so it renders.

### Documents and frontmatter

A document is the one element that renders with a trailing newline, because it stands alone as a file. It carries its own style; see [Rendering and style](#rendering-and-style).

Frontmatter goes first in the call, so the code reads in file order. It takes YAML text, which keeps comments and needs no YAML dependency. Making it valid YAML is the script's job.

## Placeholders

A placeholder is a `{@ name @}` slot that a later step substitutes: a template, a substitution call, or [inject-markdown](https://github.com/streetsidesoftware/inject-markdown), which injects generated content into Markdown files. A placeholder renders exactly as written, unescaped.

The grammar comes from [@streetsidesoftware/placeholders](../../placeholders/README.md), which inject-markdown uses too, so both read placeholders the same way. There's no escape for a placeholder.

A placeholder isn't inline or block by itself. Where it sits decides what it can take: inside a line, only inline content; on a line of its own, blocks too. Where it sits is the same whether it's written in Markdown text, in a string, or made with a builder.

A value substituted later gives the same result as the value passed directly.

A placeholder that is always a block has a type of its own, rather than one type with a kind option, so the compiler can keep it out of a line.

## Templates and parsing

A template is Markdown text with placeholders. Each template function substitutes the values in one call. A script that reuses a template keeps the string and calls the function again.

A template's result takes its kind from its content, unless the script asks for a fixed kind.

### How values go in

A value goes in where its placeholder sits, as [Placeholders](#placeholders) describes. A value of the wrong kind is an error. Beyond that:

- A string, number, or boolean is inserted as text and escaped.
- Inside code or HTML, a value is inserted as is. The common case is a package name in an install command.
- In a URL, a value is inserted as is, as in code. The URL is the script's own.
- In frontmatter, a value is inserted as is and isn't checked as YAML. Its later lines are indented to match the placeholder's line, so a multi-line value stays inside a YAML block.

A placeholder with no value is kept as written, so templates can be chained. There's no strict option: a script that needs every placeholder substituted checks its output with @streetsidesoftware/placeholders.

The concerns that apply at injection time, such as untrusted values and link rebasing, don't apply here. The same script owns the template and its values, so values aren't sanitized and links aren't rebased.

### Resolving names

The values are a plain object or a function. A function gets the whole name, so the values can come from anywhere.

In an object, dotted names walk into it. When several keys could supply a name, the last key wins. Trying the exact key first, or the longest key first, would ignore the order a reader sees, and a later key couldn't override an earlier, longer one.

### Markdown made elsewhere

Parsing brings in Markdown that is already written, such as a description from a `package.json`. It's a template without the substitution.

Whether a leading `---` starts frontmatter or is a rule can't be told from the text alone, so the script says what it reads: a whole file, or a fragment, where it's always a rule.

## Substituting placeholders

Substituting into an element already made lets content be built in steps. Only the names given a value are substituted. The others stay as written, for a later step or injection.

The result is the same kind of element, in the same style, when it can hold what was substituted. One that can't becomes a fragment, rather than throwing, so the caller never has to rebuild an element to fit.

## Rendering and style

Converting an element to a string renders it. There's no separate render function and no render options, because a template literal does the conversion and passes no arguments. So an element also drops into existing templates.

An element renders in a fixed default style. Markdown from a template or a parser renders in the style detected from its own text. A document can be given a style, and a style can be detected from an existing file, so a script can match it.

Everything inside a document renders in the document's style. A fragment's own style applies only when it's rendered by itself. When builder output is injected, inject-markdown re-renders it in the target file's style, so the default shows only when a script writes a file directly.

Whitespace and line breaks the page never shows are dropped, because in the file they would only show up escaped.

Empty formatting and empty inline code render as one space in that form. The reader should still see that it's there, and Markdown has no empty form of either. This covers content left empty by substitution.

An empty paragraph renders nothing, since it would only add blank lines between blocks. A link always stays, even with no text or URL, since the Markdown is the output and a link's text and URL are part of it.

## Errors

An element of the wrong kind throws a `TypeError`. Other misuse throws an `Error`. Each message names what was wrong.

A toolkit-specific error class waits until a caller needs to catch one specifically.

## Internals

- An element is made only by a factory function, so the internals can change without changing the API.
- The node tree stays internal. The public types never mention mdast.
- Code branches on which element it has, never on its description for error messages, so rewording a message changes no type and no behavior.
- What marks a value as a Markdown element is a key from the global symbol registry, so an element made by another loaded copy of the package is recognized.
- The key names the package. If what's stored under it ever changes incompatibly, a new key can be used.
- The key is a brand, not privacy: anyone can read it.

Placeholders, HTML entities and HTML inside a line, such as a comment or `<br/>`, each get an mdast node type of their own, which the renderer writes as is. As HTML nodes, a line ending before them would render as a space, and a placeholder written on its own line would end up inside the line before it.

The style type is the package's own interface, not remark-stringify's options, so the public types don't tie the API to remark's version. Fields are added when a script needs them.

The package has one entry, and it doesn't re-export the placeholder helpers. A script that needs them imports @streetsidesoftware/placeholders.

## Not built: flavors

A possible feature. The issue it addresses is real: Docusaurus 3 parses even `.md` files as MDX, so output that is valid GitHub Markdown can fail to build there.

- A document would render for a target flavor. The default is GitHub's Markdown.
- A call would return a copy of the document that renders as valid MDX.
- The toolkit helps scripts whose Markdown is consumed by MDX. It isn't another way to write MDX, so MDX-only helpers, such as an MDX comment, are added only when a script needs them.
- Flavor is separate from style. A style chooses between equivalent forms and can be detected from a file. A flavor decides what is valid, and only the script knows its target.
- In MDX:
  - `{` and `<` in text are escaped.
  - A comment renders as `{/* … */}`. Docusaurus accepts `<!-- -->` today only through its MDX 1 compatibility setting, which its v4 defaults turn off.
  - Raw HTML is valid JSX, as `<br/>` already is.
  - A plain-text summary or term, written on one line for GitHub, also needs Markdown escaping. MDX reads Markdown inside JSX, where GitHub reads raw HTML.
  - A kept placeholder throws when rendering. The text `{@ name @}` is an invalid MDX expression, and an MDX document is final output.
- Flavor-only constructs, such as GitHub alerts (`> [!NOTE]`) and Docusaurus admonitions (`:::note`), wait until a script needs them.

## README examples

The README opens with two examples that make the same page, one with a template and one with builders, to show that generating Markdown from data is easy. A guide follows, and each part goes from common and simple elements to rare ones.

- Each section teaches the main path. A rule stays only if a reader would get it wrong without it; the full rules are in the JSDoc.
- Steps are imperative, behavior is in the present tense, and the text never says "you".
- Every example prints its result, names it for what it is, and uses realistic cspell data.
- Code and output fit in 70 columns, since npmjs.com scrolls a wider code block.

The [examples README](../examples/README.md) describes the folder layout. Building the READMEs runs the examples, so the output shown is what the code printed. One example shows one idea and has one output.

## Function reference

The README ends with a function reference generated from the code, so the README never carries a hand-edited list of exports.

- A function's category says what the function is. Users see it in editor hovers, so it describes the function, not the README's layout.
- A separate config lays out the reference, so changing a heading or the order never touches the source, and neither does renaming a guide section.
- A heading is named for what a reader wants to do, not for Markdown's block and inline split.
- Groups go from common to rare, as the guide does.

How to write the JSDoc itself, from the summary to the examples, is in [Writing comments and JSDoc](../../../docs/writing-comments.md#exported-functions-and-types).

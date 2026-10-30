# Writing comments and JSDoc

How to write comments and JSDoc in this repo, in every package and in `scripts/`:

- [Every comment](#every-comment) covers all comments.
- [Internal functions](#internal-functions) covers functions a package doesn't export.
- [Exported functions](#exported-functions) covers the JSDoc users read on hover. Its
  [markdown-toolkit](#markdown-toolkit) section adds that package's own rules.

## Every comment

- Keep a comment short. It covers the "what" and, only when it's non-obvious, a bit of the "why".
- Write short sentences, one idea each, as many as the comment needs. Don't squeeze several facts into one long line.
- Use a list when a comment covers several cases.
- Don't restate what a well-named identifier already says.
- Keep a comment line to 140 characters or fewer.

Source code uses explicit escape sequences, not literal invisible characters. The one exception is a U+200B (zero-width
space) in a comment, to break up text that JSDoc, TypeScript or editors would misread:

- A placeholder such as `{@ name @}`, which TypeScript reads as an inline tag. Put a U+200B between `{` and `@` and
  between `@` and `}`.
- A glob such as `src/**/*.ts`, whose `*/` ends the comment.

The code in this doc leaves them out, since they can't be seen.

## Internal functions

An internal function's comment is for a maintainer. It lets them call or change the function correctly without reading
its body.

The name, the parameter names, the types and the comment work together. The comment carries only what the others can't:

- To call the function: the contract the types don't show, such as what an `undefined` result means.
- To change it: the reason behind anything that looks arbitrary, so nobody "fixes" something deliberate.

Leave out:

- what the code already says
- a step-by-step of how the body works
- history, which belongs in the commit message

A name and its comment don't restate their context: the file, or the caller just above. A helper in `htmlBlocks.ts`
doesn't need "HTML" in its name.

A comment that's hard to write can mean the name is wrong. Fix the name first.

Length follows what the maintainer needs. Two facts read better as two short sentences or a list than as one long line,
so there's no one-line limit.

The rules for exported functions don't apply. There's no summary or `@example`, and internal terms such as "node" are
fine. A `@param` helps when one argument needs explaining.

To check a comment, cover the body and read only the signature and the comment. Could you call the function correctly?
Would you leave its deliberate parts alone?

When a function changes:

- After a rename, reread its comment.
- When it moves to another file, read its name and comment as a reader there would. Add what the old file used to
  supply.

Examples from `packages/markdown-toolkit/src`:

The contract, including the `undefined` case a caller must handle (`nodes.ts`):

```ts
/** How a Markdown element renders, or `undefined` for anything else. */
```

What it does, then why it doesn't escape, so nobody adds escaping (`render.ts`):

```ts
/**
 * Render Markdown nodes as text, without a trailing newline.
 * Escaping is left to remark, which knows where each node sits.
 */
```

A contract with several cases, as a list (`template.ts`):

```ts
/**
 * Look up a placeholder name.
 * Each top-level key acts as a declaration, and the newest one wins:
 * - Keys are tried from last to first.
 * - A key matches when it equals the name, or a leading part of it whose rest resolves inside its value.
 * - A key that doesn't supply the name doesn't stop the search.
 */
```

## Exported functions

The JSDoc of a function a package exports is what a user sees on hover. These rules apply to every package.
[markdown-toolkit](#markdown-toolkit) adds rules of its own.

### What gets this treatment

- Every function a package exports gets a full comment: summary, details where needed, and an `@example`.
- A `const` alias gets one line: `/** The same as {@link p}. */`. A renamed re-export, such as markdown-toolkit's
  `parseFragment`, gets none: the hover shows the original's comment.

### Who reads it

The reader is the person importing the package, deciding which function to use and how. They read the hover, which
renders the comment as Markdown.

- Describe what the function gives the reader. Never describe how the package builds it.
- Help the reader choose. When another function fits a case better, point to it: "For a string that's already
  Markdown, use {@link parse}." Never tell the reader not to use a function.
- Write short sentences in plain words. Call the reader "you" where a sentence needs a person.

### The summary

The summary is the first paragraph: one sentence in the third person, starting with a verb, that says what the function
does.

- Say what it makes or does, from the reader's side: "Creates bold text.", "Starts a new line without starting a new
  paragraph."
- Keep advice out of it. "Use it for notes to tools" tells the reader when to call the function, not what it does.
- Leave rules, exceptions and edge cases for the details.

### The details

The paragraphs after the summary answer what a user would ask next: what the function accepts, what it gives back, and
which function to use instead.

- One topic per paragraph or list. Every sentence in a paragraph is about that paragraph's subject.
- The hover joins consecutive lines into one paragraph. Separate ideas need a blank line between them, or a list.
- Use a list when there are several parallel rules or cases.
- Say what isn't allowed, and point to the function that allows it: "A cell holds text, links, formatting or code, but
  not lists or paragraphs. For those, use {@link htmlTable}."
- What an argument can hold goes in the details, where the hover gives it room. A short fact about writing one
  argument, such as a range or a naming rule, goes in its `@param`.
- Drop a sentence that answers nothing the reader would ask. PR 92 dropped markdown-toolkit `template`'s "Its paragraph
  splits around them." for that reason.

### Tags

- `@param` only where the name and type don't say enough: `@param depth - 1 for the page title, 2 for its sections,
and so on down to 6.`
- No `@throws`. It goes stale fast and misleads. Say what isn't allowed in the details instead.
- Name another exported function with `{@link name}`, so the hover links to it.
- One `@example` per function, two only when a second shows something the first can't. With two, give each a
  `<caption>`, the only text the hover shows outside the code.
- An example shows the call, then its result as `//` comments.
- An example uses only the function it documents, and other functions only when it can't do without them.
- A line starting with three backticks would end the hover's code block, so a fence in the result goes in `//` comments
  too.

### Changing a comment

When behavior changes, or a fact needs adding:

1. Reread the whole comment: the summary, the details, every `@param` and every example. Then reread the package's
   docs on that behavior, such as markdown-toolkit's
   [design doc](../packages/markdown-toolkit/docs/design.md).
2. Find where the new fact belongs: the summary, a details paragraph, a list, a `@param`, or an example. Rewrite that
   place so the fact fits, instead of appending it to the nearest sentence.
3. Update every example whose result changed.
4. After renaming a parameter, search the package's README, the other functions' JSDoc and the package's docs for the
   old name.

### Final check

Read each changed comment as the hover a user sees, top to bottom.

- Does every sentence answer something that user would ask?
- Is each sentence in the right place: summary, details, `@param` or example?
- Does anything describe the package's internals where the result is what matters?

### markdown-toolkit

A markdown-toolkit call returns Markdown, but the reader cares about the rendered page. These rules add to the ones
above.

- Describe what the reader sees on the rendered page. Name the Markdown source only when the function exists to
  control it, as `br`, `comment`, `frontmatter` and `detectStyle` do.
- In an example, show the Markdown when it tells the reader what they'll see, such as `// **important**`. When it
  doesn't, describe the page: `// The page shows "Show more"; clicking it reveals "Hidden text."`.
- Write a placeholder in an example as `{@name@}`, with no spaces, so the hover renders it and copied code works. In
  prose, write it with zero-width spaces, as [Every comment](#every-comment) says.
- A rule about placeholder values is repeated in `template`, `blockTemplate`, `templateDocument`,
  `substitutePlaceholders`, `inlineTemplate`, `placeholder` and `blockPlaceholder`. Change it in each, in the same
  words.
- The README ends with a [function reference](../packages/markdown-toolkit/docs/design.md#function-reference),
  generated from each function's parameter names and summary. The mechanical rules, such as the 140-character summary
  and `@category`, are in that section of the design doc.

Words to avoid:

| Avoid                                    | Why                                                         | Write instead                                                 |
| ---------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| escape, escaped                          | Not worrying about escaping is the whole point              | shows exactly as given, even if it contains Markdown          |
| inline content, block content, node, run | Internal terms the reader doesn't use                       | text, links, formatting or code; a list, table or other block |
| as written, written elsewhere            | Vague: the reader can't tell what they'll see               | Say what the page shows                                       |
| Values go in as in {@link template}.     | The reader leaves the hover to guess which rules carry over | Repeat the rules that apply                                   |
| fill (a placeholder)                     | Not the library's word                                      | substitute                                                    |

### Examples

Before and after, from markdown-toolkit's rewrite in PR [#92](https://github.com/streetsidesoftware/toolbox/pull/92).
They show the general rules and the markdown-toolkit ones.

#### Text

Before: describes internals and the source, and leaves the reader wondering what a newline or a placeholder does to
them.

```ts
/**
 * Text, for use inside a line. A `{@ name @}` placeholder in it is kept as written.
 *
 * A newline stays in the text, and displays as a space.
 */
```

After: says what the reader gets, and shows it.

```ts
/**
 * Creates text that shows exactly as given, even if it contains Markdown or HTML.
 *
 * @example
 * md.text('Use <details> for *long* notes');
 * // The page shows: Use <details> for *long* notes
 */
```

#### Line break

Before: names the Markdown it writes.

```ts
/**
 * A line break in the form that works where it ends up.
 *
 * In a paragraph or list item it's a Markdown hard break, a `\` at the end of the line.
 */
```

After: says what the page shows and where it works.

```ts
/**
 * Starts a new line without starting a new paragraph.
 *
 * It works anywhere a string can go, even in a heading or a table cell.
 *
 * @example
 * md.p('Line one', md.lineBreak(), 'line two');
 * // The page shows "Line one" and "line two" on separate lines.
 */
```

#### Template

Before: escaping, internal terms ("inline values", "blocks", "kind") and an `@throws`.

```ts
/**
 * Substitute values for a Markdown template's `{@ name @}` placeholders.
 * - A string is inserted as text and escaped.
 * - A placeholder inside a line takes only inline values.
 * - A placeholder that is a whole line also takes blocks. Its paragraph splits around them.
 * - A placeholder inside code or HTML takes only a string, text, or a placeholder, inserted as is.
 *
 * The result decides its kind:
 * - A single paragraph is inline, without the whitespace around it.
 * - Anything else is blocks, rendered in the template's own style.
 *
 * A placeholder with no value is kept as written, so it can be substituted later.
 * @throws if a value doesn't fit where its placeholder is.
 */
```

After: one list for the value rules, one paragraph for where the result goes, and the nested-name rule in `@param`.

```ts
/**
 * Creates Markdown from a template by substituting values for its `{@ name @}` placeholders.
 *
 * - A string value shows exactly as given.
 * - A placeholder within a sentence takes text, links, formatting or code.
 * - A placeholder on a line of its own can also take a list, table or other block.
 * - A placeholder inside code or HTML takes only a string, which goes in as given.
 * - A placeholder without a value stays in place, so a later call can substitute it.
 *
 * A result of one paragraph can go anywhere a string can. A longer one goes where paragraphs can.
 *
 * @param values - by placeholder name. A dotted name, such as `engines.cspell`, reaches into a nested object.
 * @example
 * md.template('Install {@name@} with npm.', { name: 'cspell' });
 * // Install cspell with npm.
 */
```

#### Don't: append a fact to the nearest sentence

These come from the fixes that followed the rewrite. Each new fact was added to whatever sentence was nearest.

When `substitutePlaceholders` learned to take a string, a fact about that input went into a paragraph about values:

```ts
/**
 * Placeholders without a value stay in place, so you can substitute values in steps. A string is text, as given to
 * {@link text}, so Markdown in it shows exactly as written.
 */
```

The two sentences have different subjects, and the hover shows them as one paragraph. Next to the list of value rules,
the second reads like a rule for string values. The fact is about the input, so it gets a paragraph of its own, away
from the value rules.

When a newline in a string started to show as a line break, `blockText` got a sentence about its own newlines, added to
the one about Markdown:

```ts
/**
 * The text shows exactly as given, even if it contains Markdown or HTML. Any other newline shows as a space, so text
 * wrapped at a fixed width reads as normal paragraphs.
 */
```

"Any other newline" points back to the summary's blank lines, past a sentence about something else. Newlines are their
own topic, so they get their own paragraph, or a list with the blank-line rule.

The string fix also gave `substitutePlaceholders` a new summary, by adding "text or" to the old one:

```ts
/**
 * Substitutes values for the `{@ name @}` placeholders in text or an element you've already built, such as a parsed file.
 */
```

"You've already built" and "such as a parsed file" now seem to apply to text too. When a summary gains a case, rewrite
the sentence for all its cases.

# Writing JSDoc

How to write the JSDoc of markdown-toolkit's exported functions. It's what a user sees on hover, and its summary is the README's [function reference](design.md#function-reference). The mechanical rules, such as the 140-character summary and `@category`, are in that section of the design doc.

## What gets this treatment

- Every function `src/index.ts` exports gets a full comment: summary, details where needed, and an `@example`.
- An alias gets one line: `/** The same as {@link p}. */`.
- An internal function gets a one-line comment, and only when its name doesn't say what it does. Don't write a full docblock for it.

## Who reads it

The reader is the person importing the library, deciding which function to use and how. They read the hover, which renders the comment as Markdown, and the README reference, which shows only the summary.

- Describe what the reader sees on the rendered page, not the Markdown source or how the library builds it.
- Help the reader choose. When another function fits a case better, point to it: "For a string that's already Markdown, use {@link parse}." Never tell the reader not to use a function.
- Write short sentences in plain words. Call the reader "you" where a sentence needs a person.

## The summary

The summary is the first paragraph: one sentence in the third person, starting with a verb, that says what the function does.

- Say what it makes or does, from the reader's side: "Creates bold text.", "Starts a new line without starting a new paragraph."
- Keep advice out of it. "Use it for notes to tools" tells the reader when to call the function, not what it does.
- Leave rules, exceptions and edge cases for the details.

## The details

The paragraphs after the summary answer what a user would ask next: what the function accepts, what shows on the page, and which function to use instead.

- One topic per paragraph or list. Every sentence in a paragraph is about that paragraph's subject.
- The hover joins consecutive lines into one paragraph. Separate ideas need a blank line between them, or a list.
- Use a list when there are several parallel rules or cases, such as which values a placeholder takes.
- Say what's not allowed in terms of the page: "The content can hold text, formatting and code, but not another link: a page can't show a link inside a link."
- A fact about an argument goes in its `@param`. A fact about values or the result goes in the details.
- Drop a sentence that answers nothing the reader would ask. "Even a one-line template gives a paragraph of its own, so it never joins the text next to it." was dropped for that reason.

## Tags

- `@param` only where the name and type don't say enough: `@param depth - 1 for the page title, 2 for its sections, and so on down to 6.`
- No `@throws`.
- One `@example` per function, two only when a second shows something the first can't. With two, give each a `<caption>`, the only text the hover shows outside the code.
- An example shows the call, then its output as `//` comments. Show the Markdown when it tells the reader what they'll see, such as `// **important**`. When it doesn't, describe the page: `// The page shows "Show more"; clicking it reveals "Hidden text."`.
- An example uses only the function it documents, and other functions only when it can't do without them.
- The hover wraps an example in a code block. A line starting with three backticks breaks that, so a code fence in the output goes in `//` comments.
- Write a placeholder in an example as `{@name@}`, with no spaces, so the hover renders it and copied code works. In the prose, write it as `{@ name @}` with zero-width spaces, as the repo's code style says.

## Words

| Avoid                                    | Why                                                         | Write instead                                                 |
| ---------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| escape, escaped                          | Not worrying about escaping is the whole point              | shows exactly as given, even if it contains Markdown          |
| inline content, block content, node, run | Internal terms the reader doesn't use                       | text, links, formatting or code; a list, table or other block |
| as written, written elsewhere            | Vague: the reader can't tell what they'll see               | Say what the page shows                                       |
| Values go in as in {@link template}.     | The reader leaves the hover to guess which rules carry over | Repeat the rules that apply                                   |
| fill (a placeholder)                     | Not the library's word                                      | substitute                                                    |
| Use it for…, don't use…                  | Advice in place of a description                            | Say what it does, and point to the better function            |

## Changing a comment

When behavior changes, or a fact needs adding:

1. Reread the whole comment: the summary, the details, every `@param` and every example. Then reread the matching section of the [design doc](design.md).
2. Find where the new fact belongs: the summary, a details paragraph, a list, a `@param`, or an example. Rewrite that place so the fact fits, instead of appending it to the nearest sentence.
3. Update every example whose output changed.
4. After renaming a parameter, search the docs and the design doc for the old name.

## Final check

Read each changed comment as the hover a user sees, top to bottom.

- Does every sentence answer something that user would ask?
- Is each sentence in the right place: summary, details, `@param` or example?
- Does anything describe the Markdown source or the library's internals where the page is what matters?

## Examples

Before and after, from the rewrite in PR [#92](https://github.com/streetsidesoftware/toolbox/pull/92).

### Text

Before: describes internals and the source, and leaves the reader wondering what a newline or a placeholder does to them.

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

### Line break

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

### Template

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

### Don't: append a fact to the nearest sentence

These come from the fixes that followed the rewrite. Each new fact was added to whatever sentence was nearest.

When `substitutePlaceholders` learned to take a string, a fact about that input went into a paragraph about values:

```ts
/**
 * Placeholders without a value stay in place, so you can substitute values in steps. A string is text, as given to
 * {@link text}, so Markdown in it shows exactly as written.
 */
```

The two sentences have different subjects, and the hover shows them as one paragraph. Next to the list of value rules, the second reads like a rule for string values. The fact is about the input, so it goes in that parameter's `@param`.

When a newline in a string started to show as a line break, `blockText` got a sentence about its own newlines, added to the one about Markdown:

```ts
/**
 * The text shows exactly as given, even if it contains Markdown or HTML. Any other newline shows as a space, so text
 * wrapped at a fixed width reads as normal paragraphs.
 */
```

"Any other newline" points back to the summary's blank lines, past a sentence about something else. Newlines are their own topic, so they get their own paragraph, or a list with the blank-line rule.

The string fix also gave `substitutePlaceholders` a new summary, by adding "text or" to the old one:

```ts
/**
 * Substitutes values for the `{@ name @}` placeholders in text or an element you've already built, such as a parsed file.
 */
```

"You've already built" and "such as a parsed file" now seem to apply to text too. When a summary gains a case, rewrite the sentence for all its cases.

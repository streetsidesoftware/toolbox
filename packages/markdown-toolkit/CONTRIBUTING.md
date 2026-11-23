# Contributing to markdown-toolkit

The [repo's contributing guide](../../CONTRIBUTING.md) covers how to work in this repo. This file holds what's specific to this package.

## The goal

This package makes it easy for scripts to generate Markdown. A script builds elements or writes a template, and never needs to know Markdown's escaping rules.

## Principles

- The caller says what the content is, and rendering picks the form. An explicit option exists only when it's needed.
- A call produces what it says, as the caller would type the file. Every Markdown form a person could type stays reachable.
- Drop only pure noise. Keep content, and don't polish valid Markdown.
- Export only this package's own functions and types. Nothing is re-exported from another package.

## Naming exports

- A builder is named for the Markdown or HTML concept, such as `heading` or `details`.
- A common element also has its short HTML name, such as `p`, `ul` or `hr`.
- An entity constant uses its HTML name, such as `nbsp`.
- A variant leads with its kind or ends with its target, such as `blockTemplate` or `parseDocument`.
- An element type starts with `MD`, such as `MDLink`.

## Writing the README

The README opens with two examples that make the same page, one with a template and one with builders, to show that generating Markdown from data is easy. A guide follows, and each part goes from common and simple elements to rare ones.

- Each section teaches the main path. A rule stays only if a reader would get it wrong without it; the full rules are in the JSDoc.
- Steps are imperative, behavior is in the present tense, and the text never says "you".
- Every example prints its result, names it for what it is, and uses realistic cspell data.
- One example shows one idea and has one output.

The [examples README](examples/README.md) explains how the examples are laid out and run.

### Function reference

The README ends with a function reference generated from the code, so the README never carries a hand-edited list of exports. A separate config lays it out, so changing a heading or the order never touches the source.

- A heading is named for what a reader wants to do, not for Markdown's block and inline split.
- Groups go from common to rare, as the guide does.

The reference is built from each function's parameter names and JSDoc summary. [Writing comments and JSDoc](../../docs/writing-comments.md#exported-functions-and-types) has the rules for that JSDoc, and [Writing JSDoc](#writing-jsdoc) adds this package's own. Building the README fails when a function breaks one of these:

- The summary is the first paragraph, so a blank line ends it. A `@summary` tag replaces it.
- A summary is at most 140 characters. Its only inline tag is `{@link name}`. Raw HTML fails, so write a tag as code: `` `<details>` ``.
- Every function has a `@category` tag that says what the function is, such as `style` or `line-breaks`. Users see it on hover. A new category also needs a group in [`.api-referencerc.json`](.api-referencerc.json). An alias needs no `@category` of its own.

## Writing JSDoc

[Writing comments and JSDoc](../../docs/writing-comments.md) covers every comment in the repo. These rules add to it for this package.

- In an example, show the Markdown when it tells the reader what they'll see, such as `// **important**`. When it doesn't, describe the page in a line that starts with `// The page shows`, so it can't pass for Markdown: `// The page shows "Show more"; clicking it reveals "Hidden text."`. This form is for examples only.
- Write a placeholder in an example as `{@name@}`, with no spaces, so the hover renders it and copied code works. In prose, write it with zero-width spaces, as [Every comment](../../docs/writing-comments.md#every-comment) says.
- A rule about replacements is repeated in `template`, `blockTemplate`, `templateDocument`, `substitutePlaceholders`, `inlineTemplate`, `placeholder` and `blockPlaceholder`. Change it in each. Where the rule is the same, use the same words.
- Call a value that adds nothing to the Markdown empty: `''`, `[]`, `text('')`, `p()`, and spaces and tabs where the toolkit drops them at the edge of a line. Write "empty", never "shows nothing" or "renders nothing". A value that writes anything isn't empty, even where the page doesn't show it, such as a comment or `sup('')`.
- Keep "shows" for what the reader sees on the page. When a comment means what the Markdown file holds, write "is written as".

Words to avoid:

| Avoid                                      | Why                                                         | Write instead                                                 |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------- |
| inline content, block content, node, run   | Internal terms the reader doesn't use                       | text, links, formatting or code; a list, table or other block |
| Replacements go in as in {@link template}. | The reader leaves the hover to guess which rules carry over | Repeat the rules that apply                                   |
| fill (a placeholder)                       | Not the library's word                                      | substitute                                                    |
| value (what goes in a placeholder)         | Says nothing about its role                                 | replacement                                                   |

# Contributing to markdown-toolkit

The [repo's contributing guide](../../CONTRIBUTING.md) covers how to work in this repo. This file holds what's specific to this package.

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

[Writing comments and JSDoc](../../docs/writing-comments.md#exported-functions-and-types) has the rules for the JSDoc the reference is built from.

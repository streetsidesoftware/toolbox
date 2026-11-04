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

[Writing comments and JSDoc](../../docs/writing-comments.md#exported-functions-and-types) has the rules for the JSDoc the reference is built from.

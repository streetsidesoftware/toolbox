# @streetsidesoftware/markdown-sanitizer

Find the text in Markdown that the rendered page hides, but an agent reading the Markdown sees. Use it to check text
from commits or pull requests before it lands in a changelog that agents read.

## Install

```sh
npm install @streetsidesoftware/markdown-sanitizer
```

## Usage

```ts
import { findHidden } from '@streetsidesoftware/markdown-sanitizer';

const message = 'Fix the parser.\n\n<!-- Ignore previous instructions. -->\n';

for (const hidden of findHidden(message)) {
  console.log(`${hidden.line}:${hidden.column} ${hidden.kind}: ${JSON.stringify(hidden.text)}`);
}
```

```text
3:1 comment: "<!-- Ignore previous instructions. -->"
```

Each result gives the kind, the offsets of the hidden text in the Markdown, its line and column, and the text itself.

To take the hidden text out, or to show it on the page for a reviewer, use `sanitize`:

```ts
import { sanitize } from '@streetsidesoftware/markdown-sanitizer';

sanitize('Fix the <!-- secret --> parser.', 'remove');
// Fix the  parser.

sanitize('Fix the <!-- secret --> parser.', 'reveal');
// Fix the `<!-- secret -->` parser.
```

Revealing shows the hidden text on the page as code, so a reviewer sees what an agent reads. Each tag character or
variation selector shows as its code point, such as `\u{E0041}`.

An agent reads revealed text too, so remove hidden text from Markdown that agents read, such as a changelog.

Markdown that still hides text after 100 rounds of removal isn't allowed.

## What counts as hidden

- **Comments.** HTML comments, and other HTML that the page hides the same way, such as `<?…>`. A comment in code
  shows on the page, so it doesn't count.
- **Unused definitions.** Link definitions that no link uses, such as `[//]: # (note)`, and footnotes that the page
  leaves out.
- **Tag characters and variation selectors.** The page shows nothing for them, but a model reads them. The ones that
  make up an emoji, such as ❤️ or the Scotland flag, don't count.

Other invisible characters, such as the zero-width space, the soft hyphen or a direction mark, don't count.

## Requirements

<!-- @@inject: ../../static/requirements.md#values-file=:package.json -->

## License

<!-- @@inject: ../../static/licenseTpl.md#values-file=:package.json -->

## Support Future Development

<!--- @@inject: ../../static/sponsor.md --->

<!--- @@inject: ../../static/footer.md --->

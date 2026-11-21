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
// 'Fix the \u200B parser.'

sanitize('Fix the <!-- secret --> parser.', 'reveal');
// Fix the `<!-- secret -->` parser.
```

Removing leaves a zero-width space in place of each piece of hidden text, so the text on either side can't join into
new hidden text, such as a new comment.

Revealing shows the hidden text on the page as code, so a reviewer sees what an agent reads. Each tag character or
variation selector shows as its code point, such as `\u{E0041}`.

An agent reads revealed text too, so remove hidden text from Markdown that agents read, such as a changelog.

## What counts as hidden

- **Comments.** HTML comments, and other HTML that the page hides the same way, such as `<?…>`. A comment in code
  shows on the page, so it doesn't count.
- **Unused definitions.** Link definitions that no link uses, such as `[//]: # (note)`, and footnotes that the page
  leaves out.
- **Tag characters and variation selectors.** The page shows nothing for them, but a model reads them. The ones that
  make up an emoji, such as ❤️ or the Scotland flag, don't count.

Other invisible characters, such as the zero-width space, the soft hyphen or a direction mark, don't count.

## Requirements

<!--- @@inject: ../../static/requirements.md#values-file=:package.json --->

Requires Node.js >=22.18.0. ESM only.

<!--- @@inject-end: ../../static/requirements.md#values-file=:package.json --->

## License

<!--- @@inject: ../../static/licenseTpl.md#values-file=:package.json --->

MIT

<!--- @@inject-end: ../../static/licenseTpl.md#values-file=:package.json --->

## Support Future Development

<!--- @@inject: ../../static/sponsor.md --->

If our tools save you time, please consider supporting their development.

Please show your support through one of the following sites:

<p align="left">
  <a href="https://github.com/sponsors/streetsidesoftware" title="GitHub Sponsor"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/github-sponsor-dark.png" /><img alt="GitHub Sponsor" src="https://streetsidesoftware.com/img/sponsor/github-sponsor.png" width="180" /></picture></a> &nbsp; <a href="https://www.paypal.com/donate/?hosted_button_id=26LNBP2Q6MKCY" title="PayPal"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/paypal-dark.png" /><img alt="PayPal" src="https://streetsidesoftware.com/img/sponsor/paypal.png" width="180" /></picture></a> &nbsp; <a href="https://opencollective.com/cspell" title="Open Collective"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/open-collective-dark.png" /><img alt="Open Collective" src="https://streetsidesoftware.com/img/sponsor/open-collective.png" width="180" /></picture></a> &nbsp; <a href="https://streetsidesoftware.com/sponsor/" title="Street Side Software"><picture><source media="(prefers-color-scheme: dark)" srcset="https://streetsidesoftware.com/img/sponsor/cspell-dark.png" /><img alt="CSpell" src="https://streetsidesoftware.com/img/sponsor/cspell.png" width="180" /></picture></a>
</p>

<!--- @@inject-end: ../../static/sponsor.md --->

<!--- @@inject: ../../static/footer.md --->

<br/>

---

<p align="center">
Brought to you by <a href="https://streetsidesoftware.com" title="Street Side Software">
<img width="16" alt="Street Side Software Logo" src="https://i.imgur.com/CyduuVY.png" /> Street Side Software
</a>
</p>

<!--- @@inject-end: ../../static/footer.md --->

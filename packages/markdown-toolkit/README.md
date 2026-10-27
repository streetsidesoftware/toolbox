# @streetsidesoftware/markdown-toolkit

A toolkit for generating Markdown: builders, templates and placeholders. Compose links, lists, headings and code,
then render the result with `toString()`.

> [!WARNING]
> Experimental. The API may change while it settles. Breaking changes ship as minor releases, called out in the
> release notes.

## Install

```sh
npm install @streetsidesoftware/markdown-toolkit
```

Requires Node.js 22.18 or later. ESM only.

## Usage

```ts
import * as md from '@streetsidesoftware/markdown-toolkit';

const doc = md.document(
  md.heading(2, ['Using ', md.inlineCode('cspell')]),
  md.list([
    md.link('Docs [beta]', 'https://cspell.org'),
    md.link('Source', 'https://github.com/streetsidesoftware/cspell'),
  ]),
  md.codeBlock('npm install -D cspell', 'sh'),
);
console.log(doc.toString());
```

````markdown
## Using `cspell`

- [Docs \[beta\]](https://cspell.org)
- [Source](https://github.com/streetsidesoftware/cspell)

```sh
npm install -D cspell
```
````

Each builder escapes its content for where it ends up, so the `]` in the link text doesn't end the link.

## License

MIT

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

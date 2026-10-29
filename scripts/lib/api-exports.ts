import fs from 'node:fs/promises';
import Path from 'node:path';

import type { Nodes } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { BindingPattern, BindingRestElement, Comment, ParamPattern, Statement } from 'oxc-parser';
import { parseSync } from 'oxc-parser';

/** The longest summary, in characters: the length of one comment line. */
export const SUMMARY_LIMIT = 140;

/** A function a package exports, with what its JSDoc says about it. */
export interface ApiFunction {
  /** The name it's declared with, or the first name it's exported as when that one isn't exported. */
  name: string;
  /** Parameter names: `lang?` when optional, `...content` for a rest parameter. */
  params: string[];
  /** Its `@summary` tag, or else the first paragraph of its JSDoc, as one line of Markdown. */
  summary: string;
  /** Its `@category` tag. */
  category: string;
  /** The other names it's exported as. */
  aliases: string[];
}

interface FunctionDeclaration {
  file: string;
  name: string;
  params: string[];
  /** The JSDoc of its first declaration, an overload's when it has them. */
  jsdoc: string | undefined;
}

interface Module {
  file: string;
  functions: Map<string, FunctionDeclaration>;
  /** `const a = b`, where `b` is a function: alias name to function name. */
  aliases: Map<string, string>;
  exports: ValueExport[];
  /** An `export *` or `export default`, which the reference can't list. */
  unsupported: string | undefined;
}

interface ValueExport {
  exported: string;
  local: string;
  /** The module that declares `local`. */
  file: string;
}

/**
 * The functions a module exports, in export order, read from its source and that of the modules it re-exports from.
 * Type exports are skipped. Any other value export must be a function, or a `const` that names one.
 * @throws if an export isn't a function, or a function's JSDoc has no `@category` or no usable summary.
 */
export async function readApiFunctions(entryFile: string): Promise<ApiFunction[]> {
  const modules = new Map<string, Module>();
  const exportedAs = new Map<FunctionDeclaration, string[]>();
  const entry = await readModule(entryFile, modules);
  if (entry.unsupported) throw new Error(`${shown(entryFile)}: ${entry.unsupported} isn't supported`);
  for (const { exported, local, file } of entry.exports) {
    const fn = resolveFunction(await readModule(file, modules), local);
    exportedAs.set(fn, [...(exportedAs.get(fn) ?? []), exported]);
  }
  return [...exportedAs].map(([fn, names]) => {
    const name = names.includes(fn.name) ? fn.name : names[0];
    const where = `${name} in ${shown(fn.file)}`;
    if (fn.jsdoc === undefined) throw new Error(`${where} has no JSDoc`);
    const { description, tags } = parseJsDoc(fn.jsdoc);
    const category = tags.get('category');
    if (!category) throw new Error(`${where} has no @category in its JSDoc`);
    const summary = summaryOf(where, tags.get('summary') ?? firstParagraph(description));
    return { name, params: fn.params, summary, category, aliases: names.filter((n) => n !== name) };
  });
}

async function readModule(file: string, modules: Map<string, Module>): Promise<Module> {
  const found = modules.get(file);
  if (found) return found;
  const module = parseModule(file, await fs.readFile(file, 'utf8'));
  modules.set(file, module);
  return module;
}

function parseModule(file: string, source: string): Module {
  const { program, comments, errors } = parseSync(file, source);
  if (errors.length) throw new Error(`can't parse ${shown(file)}: ${errors[0].message}`);
  const module: Module = { file, functions: new Map(), aliases: new Map(), exports: [], unsupported: undefined };
  for (const statement of program.body) {
    if (statement.type === 'ExportAllDeclaration' || statement.type === 'ExportDefaultDeclaration') {
      module.unsupported ??= statement.type === 'ExportAllDeclaration' ? 'export *' : 'export default';
      continue;
    }
    if (statement.type !== 'ExportNamedDeclaration') {
      addDeclaration(module, statement, jsdocAt(comments, source, statement.start));
      continue;
    }
    if (statement.exportKind === 'type') continue;
    if (statement.declaration) {
      for (const name of addDeclaration(module, statement.declaration, jsdocAt(comments, source, statement.start))) {
        module.exports.push({ exported: name, local: name, file });
      }
      continue;
    }
    const from = statement.source ? Path.resolve(Path.dirname(file), statement.source.value) : file;
    for (const specifier of statement.specifiers) {
      if (specifier.exportKind === 'type') continue;
      if (nameOf(specifier.exported) === 'default') module.unsupported ??= 'export default';
      module.exports.push({ exported: nameOf(specifier.exported), local: nameOf(specifier.local), file: from });
    }
  }
  return module;
}

/** Records a function or a function alias. Returns the value names it declares. */
function addDeclaration(module: Module, statement: Statement, jsdoc: string | undefined): string[] {
  if (statement.type === 'FunctionDeclaration' || statement.type === 'TSDeclareFunction') {
    const name = statement.id?.name;
    if (!name) return [];
    const previous = module.functions.get(name);
    // The JSDoc is on the first overload; the parameter names come from the implementation.
    const params = statement.body || !previous ? paramNames(statement.params) : previous.params;
    module.functions.set(name, { file: module.file, name, params, jsdoc: previous ? previous.jsdoc : jsdoc });
    return previous ? [] : [name];
  }
  if (statement.type === 'VariableDeclaration') {
    return statement.declarations.flatMap((declarator) => {
      if (declarator.id.type !== 'Identifier') return boundNames(declarator.id);
      if (statement.kind === 'const' && declarator.init?.type === 'Identifier') {
        module.aliases.set(declarator.id.name, declarator.init.name);
      }
      return [declarator.id.name];
    });
  }
  if (statement.type === 'ClassDeclaration') return statement.id ? [statement.id.name] : [];
  return [];
}

function resolveFunction(module: Module, name: string): FunctionDeclaration {
  const fn = module.functions.get(name) ?? module.functions.get(module.aliases.get(name) ?? '');
  if (!fn) throw new Error(`${name} in ${shown(module.file)} isn't a function, or a const that names one`);
  return fn;
}

/** The arguments a caller passes; a TypeScript `this` parameter isn't one. */
function paramNames(params: readonly ParamPattern[]): string[] {
  return params.filter((param) => !(param.type === 'Identifier' && param.name === 'this')).map(paramName);
}

function paramName(param: ParamPattern): string {
  const pattern = param.type === 'TSParameterProperty' ? param.parameter : param;
  if (pattern.type === 'Identifier') {
    // oxc types `optional` as `false`, but a parameter such as `lang?` has it `true`.
    const optional: unknown = pattern.optional;
    return optional === true ? `${pattern.name}?` : pattern.name;
  }
  if (pattern.type === 'RestElement' && pattern.argument.type === 'Identifier') return `...${pattern.argument.name}`;
  if (pattern.type === 'AssignmentPattern' && pattern.left.type === 'Identifier') return `${pattern.left.name}?`;
  throw new Error(`unsupported parameter: ${pattern.type}`);
}

/** The names a destructuring pattern declares. */
function boundNames(pattern: BindingPattern | BindingRestElement | null): string[] {
  if (!pattern) return [];
  switch (pattern.type) {
    case 'Identifier':
      return [pattern.name];
    case 'AssignmentPattern':
      return boundNames(pattern.left);
    case 'RestElement':
      return boundNames(pattern.argument);
    case 'ArrayPattern':
      return pattern.elements.flatMap((element) => boundNames(element));
    case 'ObjectPattern':
      return pattern.properties.flatMap((property) =>
        boundNames(property.type === 'RestElement' ? property : property.value),
      );
  }
  return [];
}

function nameOf(node: { type: string; name?: string; value?: unknown }): string {
  return node.type === 'Identifier' ? (node.name ?? '') : String(node.value);
}

/** The text of the `/** … *\/` comment that ends just before `start`, with only whitespace between. */
function jsdocAt(comments: readonly Comment[], source: string, start: number): string | undefined {
  const comment = comments.findLast((c) => c.end <= start);
  if (!comment || comment.type !== 'Block' || !comment.value.startsWith('*')) return undefined;
  return source.slice(comment.end, start).trim() ? undefined : comment.value;
}

/** A JSDoc's description, the Markdown before its first tag, and its tags, each on one line. */
export function parseJsDoc(jsdoc: string): { description: string; tags: Map<string, string> } {
  const lines = jsdoc
    .slice(1)
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, '').trimEnd());
  const tagStart = lines.findIndex((line) => line.trimStart().startsWith('@'));
  const description = (tagStart < 0 ? lines : lines.slice(0, tagStart)).join('\n').trim();
  const tags = new Map<string, string>();
  let tag: string | undefined;
  for (const line of tagStart < 0 ? [] : lines.slice(tagStart)) {
    const match = /^\s*@(\w+)\s*(.*)$/.exec(line);
    if (match) tag = tags.has(match[1]) ? undefined : match[1];
    if (tag) tags.set(tag, joinLines([tags.get(tag) ?? '', match ? match[2] : line]));
  }
  return { description, tags };
}

/** The first paragraph of some Markdown, as Markdown on one line, or `''` when it doesn't start with a paragraph. */
export function firstParagraph(markdown: string): string {
  const first = fromMarkdown(markdown).children[0];
  if (first?.type !== 'paragraph') return '';
  return joinLines(markdown.slice(first.position?.start.offset, first.position?.end.offset).split('\n'));
}

/**
 * A summary ready for the reference: zero-width spaces removed and `{@link name}` as code.
 * @throws if it's empty, longer than {@link SUMMARY_LIMIT}, or has another inline tag or raw HTML.
 */
function summaryOf(where: string, text: string): string {
  const summary = text.replaceAll('\u200B', '').replace(/\{@link\s+([\w$.]+)\s*\}/g, '`$1`');
  if (!summary) throw new Error(`${where} has no summary: start its JSDoc with one, or add @summary`);
  const tag = /\{@\w+[^}]*\}?/.exec(summary);
  if (tag) throw new Error(`${where} has an unsupported inline tag in its summary: ${tag[0]}`);
  // Raw HTML is almost always a tag meant as text, and it would vanish on npm and in editor hovers.
  const html = rawHtml(fromMarkdown(summary));
  if (html) throw new Error(`${where} has raw HTML in its summary: ${html}; put it in backticks`);
  if (summary.length > SUMMARY_LIMIT) {
    throw new Error(
      `${where} has a summary of ${summary.length} characters, over ${SUMMARY_LIMIT}: shorten it, or add @summary`,
    );
  }
  return summary;
}

/** The first raw HTML in a Markdown tree, outside code. */
function rawHtml(node: Nodes): string | undefined {
  if (node.type === 'html') return node.value;
  if (!('children' in node)) return undefined;
  for (const child of node.children) {
    const html = rawHtml(child);
    if (html) return html;
  }
  return undefined;
}

function joinLines(lines: readonly string[]): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
}

/** A file path as an error shows it, relative to the current folder. */
function shown(file: string): string {
  return Path.relative(process.cwd(), file);
}

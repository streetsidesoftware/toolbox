import { readFile, stat, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { findHidden } from '../findHidden.ts';
import { sanitize } from '../sanitize/index.ts';

/** The default limit on each input, in bytes. The parser slows down sharply on large input. */
const DEFAULT_MAX_SIZE = 10_000_000;

const STDIN_NAME = '<stdin>';

const USAGE = `Usage: markdown-sanitizer <command> [options] [file...]

Find the text in Markdown that the page hides, but an agent reading the Markdown sees.
Reads each file given, or standard input when there is none.

Commands:
  check    List the hidden text. Exits with 1 when there is any.
  remove   Print the Markdown without the hidden text.
  reveal   Print the Markdown with the hidden text shown as code.

Options:
  --write            Replace each file with the result, for remove and reveal.
  --max-size <bytes> The largest input allowed, in bytes. Default: ${DEFAULT_MAX_SIZE}.
  -h, --help         Show this help.
`;

const commands = new Set(['check', 'remove', 'reveal']);

/** Where the command reads standard input and writes its output, so tests can stand in for the process. */
export interface Io {
  stdin: AsyncIterable<Buffer | string>;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

interface Input {
  /** The file path, or `<stdin>`. */
  name: string;
  markdown: string;
}

/** A wrong call, or input the command can't read or clean, reported as one line with exit code 2. */
class CommandError extends Error {}

/**
 * Run the command line and return the exit code: 0 when it succeeds, 1 when `check` finds hidden text, and 2 for a
 * wrong call or input it can't read.
 *
 * Every input is read before anything is written, so an error leaves the files as they were.
 */
export async function run(args: string[], io: Io): Promise<number> {
  try {
    const options = parse(args);
    if (options.help) {
      io.stdout(USAGE);
      return 0;
    }
    const inputs = await readInputs(options.files, options.maxSize, io.stdin);
    if (options.command === 'check') return check(inputs, io);
    const results = inputs.map((input) => ({ ...input, result: sanitizeInput(input, options.command) }));
    if (!options.write) {
      for (const { result } of results) io.stdout(result);
      return 0;
    }
    for (const { name, markdown, result } of results) {
      if (result !== markdown) await writeFile(name, result);
    }
    return 0;
  } catch (error) {
    if (!(error instanceof CommandError)) throw error;
    io.stderr(`markdown-sanitizer: ${error.message}\n`);
    return 2;
  }
}

interface Options {
  help: boolean;
  command: string;
  files: string[];
  write: boolean;
  maxSize: number;
}

function parse(args: string[]): Options {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        write: { type: 'boolean', default: false },
        'max-size': { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch {
    throw new CommandError('options must be --write, --max-size <bytes> or --help');
  }
  const { values, positionals } = parsed;
  const [command = '', ...files] = positionals;
  if (values.help) return { help: true, command, files, write: false, maxSize: DEFAULT_MAX_SIZE };
  if (!commands.has(command)) throw new CommandError('the command must be check, remove or reveal');
  if (values.write && command === 'check') throw new CommandError('--write works with remove and reveal');
  if (values.write && !files.length) throw new CommandError('--write needs at least one file');
  return { help: false, command, files, write: values.write, maxSize: maxSize(values['max-size']) };
}

function maxSize(value: string | undefined): number {
  if (value === undefined) return DEFAULT_MAX_SIZE;
  if (!/^[1-9][0-9]*$/.test(value)) throw new CommandError('--max-size must be a positive whole number of bytes');
  return Number(value);
}

async function readInputs(files: string[], max: number, stdin: AsyncIterable<Buffer | string>): Promise<Input[]> {
  if (!files.length) return [{ name: STDIN_NAME, markdown: await readStdin(stdin, max) }];
  const inputs: Input[] = [];
  for (const name of files) inputs.push({ name, markdown: await readMarkdownFile(name, max) });
  return inputs;
}

async function readMarkdownFile(name: string, max: number): Promise<string> {
  let size;
  try {
    size = (await stat(name)).size;
  } catch {
    throw new CommandError(`${name}: the file must exist and be readable`);
  }
  if (size > max) throw tooLarge(name, max);
  try {
    return await readFile(name, 'utf8');
  } catch {
    throw new CommandError(`${name}: the file must exist and be readable`);
  }
}

/** Read standard input, stopping as soon as it passes `max` bytes, so a huge stream isn't held in memory. */
async function readStdin(stdin: AsyncIterable<Buffer | string>, max: number): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stdin) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > max) throw tooLarge(STDIN_NAME, max);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function tooLarge(name: string, max: number): CommandError {
  return new CommandError(`${name}: input must be at most ${max} bytes; raise the limit with --max-size`);
}

function check(inputs: Input[], io: Io): number {
  let found = false;
  for (const { name, markdown } of inputs) {
    for (const hidden of findHidden(markdown)) {
      found = true;
      io.stdout(`${name}:${hidden.line}:${hidden.column} ${hidden.kind} ${quote(hidden.text)}\n`);
    }
  }
  return found ? 1 : 0;
}

function sanitizeInput({ name, markdown }: Input, command: string): string {
  try {
    return sanitize(markdown, command === 'remove' ? 'remove' : 'reveal');
  } catch (error) {
    throw new CommandError(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Quote hidden text on one line, with line breaks, control characters, format characters such as tag characters,
 * and variation selectors as escapes, so the terminal shows every character the text holds.
 */
function quote(text: string): string {
  return JSON.stringify(text).replaceAll(/[\p{Cf}\p{Variation_Selector}]/gu, escape);
}

function escape(char: string): string {
  return `\\u{${(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}}`;
}

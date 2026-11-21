import { createReadStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
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

/**
 * The characters a terminal doesn't show as themselves: controls, format characters such as tag characters, line and
 * paragraph separators, lone surrogates, and the characters Unicode says to ignore, such as variation selectors.
 */
const unseen = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/gu;

const shortEscapes = new Map([
  ['\n', '\\n'],
  ['\r', '\\r'],
  ['\t', '\\t'],
]);

/** Where the command reads standard input and writes its output, so tests can stand in for the process. */
interface Io {
  stdin: AsyncIterable<Buffer | string>;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

interface Input {
  /** The file path, or `<stdin>`. */
  name: string;
  markdown: string;
}

/** A wrong call, or input the command can't read, clean or write, reported as one line with exit code 2. */
class CommandError extends Error {}

/**
 * Run the command line and return the exit code: 0 when it succeeds, 1 when `check` finds hidden text, and 2 for a
 * wrong call or a file it can't read, clean or write.
 *
 * Every input is read and cleaned before any file is written, so input that can't be read or cleaned leaves the files
 * as they were.
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
      if (result !== markdown) await writeMarkdownFile(name, result);
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
  if (values.write && command === 'check') throw new CommandError('--write works only with remove and reveal');
  if (values.write && !files.length) throw new CommandError('--write needs at least one file');
  return { help: false, command, files, write: values.write, maxSize: maxSize(values['max-size']) };
}

function maxSize(value: string | undefined): number {
  if (value === undefined) return DEFAULT_MAX_SIZE;
  const size = Number(value);
  if (!/^[0-9]+$/.test(value) || size < 1) {
    throw new CommandError('--max-size must be a whole number of bytes, at least 1');
  }
  return size;
}

async function readInputs(files: string[], max: number, stdin: AsyncIterable<Buffer | string>): Promise<Input[]> {
  if (!files.length) return [{ name: STDIN_NAME, markdown: await readText(STDIN_NAME, stdin, max) }];
  const inputs: Input[] = [];
  for (const name of files) inputs.push({ name, markdown: await readMarkdownFile(name, max) });
  return inputs;
}

async function readMarkdownFile(name: string, max: number): Promise<string> {
  try {
    return await readText(name, createReadStream(name), max);
  } catch (error) {
    if (error instanceof CommandError) throw error;
    throw new CommandError(`${displayName(name)}: must be a readable file`);
  }
}

/**
 * Read a stream as UTF-8 text. It stops as soon as the stream passes `max` bytes, so an endless stream, such as a
 * device, isn't held in memory.
 *
 * Throws a CommandError past `max`, or for bytes that aren't UTF-8, so a file is never rewritten with them replaced.
 */
async function readText(name: string, stream: AsyncIterable<Buffer | string>, max: number): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > max) throw tooLarge(name, max);
    chunks.push(buffer);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks));
  } catch {
    throw new CommandError(`${displayName(name)}: input must be UTF-8`);
  }
}

function tooLarge(name: string, max: number): CommandError {
  const limit = max === 1 ? '1 byte' : `${max} bytes`;
  return new CommandError(`${displayName(name)}: input must be at most ${limit}, the --max-size limit`);
}

async function writeMarkdownFile(name: string, text: string): Promise<void> {
  try {
    await writeFile(name, text);
  } catch {
    throw new CommandError(`${displayName(name)}: the file must be writable`);
  }
}

function check(inputs: Input[], io: Io): number {
  let found = false;
  for (const { name, markdown } of inputs) {
    for (const hidden of findHidden(markdown)) {
      found = true;
      io.stdout(`${displayName(name)}:${hidden.line}:${hidden.column} ${hidden.kind} ${quote(hidden.text)}\n`);
    }
  }
  return found ? 1 : 0;
}

function sanitizeInput({ name, markdown }: Input, command: string): string {
  try {
    return sanitize(markdown, command === 'remove' ? 'remove' : 'reveal');
  } catch (error) {
    throw new CommandError(`${displayName(name)}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Quote hidden text on one line, so the terminal shows every character it holds. */
function quote(text: string): string {
  return `"${escapeUnseen(text.replaceAll(/["\\]/g, '\\$&'))}"`;
}

/** Show a file name with the characters a terminal wouldn't show as escapes, since anyone can choose the name. */
function displayName(name: string): string {
  return escapeUnseen(name);
}

function escapeUnseen(text: string): string {
  return text.replaceAll(unseen, (char) => shortEscapes.get(char) ?? escape(char));
}

function escape(char: string): string {
  return `\\u{${(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}}`;
}

#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { findHidden } from './findHidden.ts';
import { sanitize } from './sanitize/index.ts';

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

/** Where {@link run} reads standard input and writes its output, such as to collect the output in a string. */
export interface Io {
  /** Read when no file is given. */
  stdin: AsyncIterable<Buffer | string>;
  /** Gets the command's output. */
  stdout: (text: string) => void;
  /** Gets the message for an error, one line. */
  stderr: (text: string) => void;
}

interface Input {
  /** The file path, or `<stdin>`. */
  name: string;
  markdown: string;
}

/** A wrong call, or input the command can't read or write, reported as one line with exit code 2. */
class CommandError extends Error {}

/**
 * Run the `markdown-sanitizer` command and return its exit code: 0 when it succeeds, 1 when `check` finds hidden text,
 * and 2 for a wrong call or a file it can't read or write.
 *
 * Every input is read before any file is written, so input that can't be read leaves the files as they were.
 *
 * @param args - the arguments after the program name, such as `process.argv.slice(2)`.
 * @param io - where to read standard input and write the output. By default, the process's own.
 *
 * @example
 * #!/usr/bin/env node
 * import { run } from '@streetsidesoftware/markdown-sanitizer/cli';
 *
 * process.exitCode = await run(process.argv.slice(2));
 */
export async function run(args: string[], io: Io = processIo()): Promise<number> {
  try {
    const options = parse(args);
    if (options.help) {
      io.stdout(USAGE);
      return 0;
    }
    const inputs = await readInputs(options.files, options.maxSize, io.stdin);
    if (options.command === 'check') return check(inputs, io);
    const mode = options.command === 'remove' ? 'remove' : 'reveal';
    const results = inputs.map((input) => ({ ...input, result: sanitize(input.markdown, mode) }));
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

/** The process's own standard input and output, made once, so each call doesn't add another listener. */
let defaultIo: Io | undefined;

/** The error codes a write gets once the reader has closed the pipe: `EPIPE`, or `ENOTCONN` for a socket on macOS. */
const closedPipeCodes = new Set(['EPIPE', 'ENOTCONN']);

/**
 * Return the process's own standard input and output. When the reader closes the pipe early, as `head` does, the rest of
 * the output is dropped, and the exit code still tells what was found.
 */
function processIo(): Io {
  if (defaultIo) return defaultIo;
  let closed = false;
  process.stdout.on('error', (error: NodeJS.ErrnoException) => {
    if (!closedPipeCodes.has(error.code ?? '')) throw error;
    closed = true;
  });
  defaultIo = {
    stdin: process.stdin,
    stdout: (text) => {
      if (!closed) process.stdout.write(text);
    },
    stderr: (text) => process.stderr.write(text),
  };
  return defaultIo;
}

// Last, so every constant above is set before the command runs.
if (import.meta.main) process.exitCode = await run(process.argv.slice(2));

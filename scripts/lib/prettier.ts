import { format, resolveConfig } from 'prettier';

/** Format `text` the way `prettier --write` would format `filepath`, with the repo's Prettier config. */
export async function formatFile(text: string, filepath: string): Promise<string> {
  const config = await resolveConfig(filepath);
  return format(text, { ...config, filepath });
}

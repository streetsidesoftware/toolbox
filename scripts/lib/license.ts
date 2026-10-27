import fs from 'node:fs/promises';

/**
 * Makes `file` a copy of `licenseText`, the root `LICENSE`, optionally only reporting.
 * @returns `true` if the file was missing or different.
 */
export async function syncLicense(
  file: string,
  licenseText: string,
  options: { dryRun?: boolean } = {},
): Promise<boolean> {
  const current = await fs.readFile(file, 'utf-8').catch(() => undefined);
  if (current === licenseText) return false;
  if (!options.dryRun) await fs.writeFile(file, licenseText, 'utf-8');
  return true;
}

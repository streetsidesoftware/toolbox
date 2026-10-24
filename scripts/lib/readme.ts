import type { WorkspacePackage } from './packages.ts';

/** The packages table the root README injects, relative to the repo root. */
export const PACKAGES_CSV_FILE = 'static/packages.csv';

/** The READMEs `build:readme` injects into, relative to the repo root. */
export const README_GLOBS = ['README.md', 'packages/*/README.md'];

/**
 * The `Package,Description` table of published (non-private) packages, sorted by name.
 * Links are relative to `static/`; inject-markdown rebases them into the README.
 */
export function packagesCsv(packages: WorkspacePackage[]): string {
  const rows = packages
    .filter((p) => !p.packageJson.private && p.packageJson.name)
    .map(({ dir, packageJson }) => ({ name: packageJson.name ?? '', dir, description: packageJson.description }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map(({ name, dir, description }) => [`[\`${name}\`](../${dir})`, markdownCell(`${description ?? ''}`)]);
  return [['Package', 'Description'], ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

/** A `|` would end the Markdown table cell. */
function markdownCell(text: string): string {
  return text.replaceAll('|', '\\|');
}

function csvCell(text: string): string {
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

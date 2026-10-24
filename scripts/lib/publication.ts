import type { PackageJson } from './package-json-util.ts';
import type { WorkspacePackage } from './packages.ts';
import type { Published } from './trusted-publishing.ts';

/** Appended to a private package's `description` until it is published. */
export const PRIVATE_SUFFIX = ' -- Private until verified';

/** A copy of `pkg` without `private` and without the private suffix on `description`. */
export function makePublic(pkg: PackageJson): PackageJson {
  const { private: _, ...rest } = pkg;
  if (typeof rest.description === 'string' && rest.description.endsWith(PRIVATE_SUFFIX)) {
    rest.description = rest.description.slice(0, -PRIVATE_SUFFIX.length);
  }
  return rest;
}

export interface PublicationCandidate {
  /** Directory under `packages/`, such as `unindent`. */
  dir: string;
  name: string;
}

/** Private packages waiting for publication: every one that `published` doesn't mark `false`. */
export function publicationCandidates(packages: WorkspacePackage[], published: Published): PublicationCandidate[] {
  return packages
    .filter(({ packageJson: { private: isPrivate, name } }) => isPrivate && name && published[name] !== false)
    .map(({ dir, packageJson }) => ({ dir: dir.replace(/^packages\//, ''), name: packageJson.name ?? '' }));
}

import type { PackageJson } from './package-json-util.ts';
import type { WorkspacePackage } from './packages.ts';
import type { Published } from './trusted-publishing.ts';

/** Appended to a private package's `description` until it is published. */
export const PRIVATE_SUFFIX = ' -- Private until verified';

/** Return a copy of `pkg` without `private` and without the private suffix on `description`. */
export function makePublic(pkg: PackageJson): PackageJson {
  const { private: _, ...rest } = pkg;
  if (typeof rest.description === 'string' && rest.description.endsWith(PRIVATE_SUFFIX)) {
    rest.description = rest.description.slice(0, -PRIVATE_SUFFIX.length);
  }
  return rest;
}

export interface PublicationCandidate {
  /** Holds the directory under `packages/`, such as `unindent`. */
  dir: string;
  name: string;
}

/** Return the branch of a package's publication PR. */
export function publicationBranch(dir: string): string {
  return `prepare-publication-${dir}`;
}

/**
 * Return the private packages waiting for publication: every one that `published` doesn't mark `false`.
 * A package waits until it's one of the Release Please config's `components`, since its publication PR sets its
 * `release-as`.
 */
export function publicationCandidates(
  packages: WorkspacePackage[],
  published: Published,
  components: string[],
): PublicationCandidate[] {
  return packages
    .filter(
      ({ packageJson: { private: isPrivate, name } }) =>
        isPrivate && name && published[name] !== false && components.includes(name),
    )
    .map(({ dir, packageJson }) => ({ dir: dir.replace(/^packages\//, ''), name: packageJson.name ?? '' }));
}

/** Return the candidates whose publication PR isn't open, given the head branches of the open PRs. */
export function withoutOpenPrs(candidates: PublicationCandidate[], openBranches: string[]): PublicationCandidate[] {
  return candidates.filter((c) => !openBranches.includes(publicationBranch(c.dir)));
}

import type { PackageJson } from './package-json-util.ts';

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

import Path from 'node:path';

const __dirname = import.meta.dirname;

export const REPO_ROOT_DIR = Path.resolve(__dirname, '../../');

/** Holds the path of the root `LICENSE`, which every package has a copy of. */
export const ROOT_LICENSE_FILE: string = Path.join(REPO_ROOT_DIR, 'LICENSE');

/** Holds the folder of the new-package template files. */
export const TEMPLATE_DIR: string = Path.join(REPO_ROOT_DIR, 'static', 'templates');

export const REPOSITORY_URL = 'https://github.com/streetsidesoftware/toolbox.git';
export const REPOSITORY_GIT_URL = 'git+' + REPOSITORY_URL;

/** Holds the GitHub repository, as `owner/name`. */
export const REPOSITORY = 'streetsidesoftware/toolbox';

import Path from 'node:path';

const __dirname = import.meta.dirname;

export const REPO_ROOT_DIR = Path.resolve(__dirname, '../../');

/** The path of the root `LICENSE`, copied into each package under `packages/`. */
export const ROOT_LICENSE_FILE: string = Path.join(REPO_ROOT_DIR, 'LICENSE');

/** The folder of template files for a new package. */
export const TEMPLATE_DIR: string = Path.join(REPO_ROOT_DIR, 'static', 'templates');

export const REPOSITORY_URL = 'https://github.com/streetsidesoftware/toolbox.git';
export const REPOSITORY_GIT_URL = 'git+' + REPOSITORY_URL;

/** The GitHub repository, as `owner/name`. */
export const REPOSITORY = 'streetsidesoftware/toolbox';

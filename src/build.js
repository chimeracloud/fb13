// The build that made this page: the version from package.json and the short
// commit hash Cloudflare Pages hands the build, stamped in by vite.config.js as
// __FB13_COMMIT__. Outside a Pages build (tests, a dev server) the hash is
// empty, and the page says so rather than inventing one.

import { version } from '../package.json';

export const VERSION = version;

// typeof keeps this safe where the stamp was never defined: no ReferenceError.
export const COMMIT = typeof __FB13_COMMIT__ === 'string' ? __FB13_COMMIT__ : '';

export const BUILD = { version: VERSION, commit: COMMIT };

/** "version 0.4.1, commit 7642519"; "version 0.4.1, no commit hash"; "build not recorded". */
export function buildLabel(b) {
  if (!b || !b.version) return 'build not recorded';
  return `version ${b.version}, ${b.commit ? `commit ${b.commit}` : 'no commit hash'}`;
}

import { describe, it, expect } from 'vitest';
import { version as pkgVersion } from '../package.json';
import { VERSION, COMMIT, BUILD, buildLabel } from './build.js';

describe('the build stamp', () => {
  it('carries the version from package.json', () => {
    expect(VERSION).toBe(pkgVersion);
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(BUILD).toEqual({ version: VERSION, commit: COMMIT });
  });

  it('carries the short commit hash Pages hands the build, or nothing outside one', () => {
    expect(COMMIT === '' || /^[0-9a-f]{7}$/.test(COMMIT)).toBe(true);
  });

  it('labels a build in words, and says when none was recorded', () => {
    expect(buildLabel({ version: '0.4.1', commit: '7642519' })).toBe('version 0.4.1, commit 7642519');
    expect(buildLabel({ version: '0.4.1', commit: '' })).toBe('version 0.4.1, no commit hash');
    expect(buildLabel(null)).toBe('build not recorded');
    expect(buildLabel({})).toBe('build not recorded');
  });
});

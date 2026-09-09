import fs from 'fs';
import os from 'os';
import path from 'path';
import { findPackageRoot, isHubPackageName } from '../../src/utils/path.js';

const withPackage = (name: string, run: (root: string, start: string) => void): void => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ylune-pkg-'));
  try {
    const root = path.join(tmp, 'app');
    const start = path.join(root, 'dist', 'utils');
    fs.mkdirSync(start, { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name, version: 'dev' }));
    run(root, start);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};

describe('isHubPackageName', () => {
  it('accepts this fork and upstream names', () => {
    expect(isHubPackageName('@ylune/mcphub')).toBe(true);
    expect(isHubPackageName('@samanhappy/mcphub')).toBe(true);
    expect(isHubPackageName('mcphub')).toBe(true);
  });

  it('rejects unrelated package names', () => {
    expect(isHubPackageName('express')).toBe(false);
    expect(isHubPackageName(undefined)).toBe(false);
  });
});

describe('findPackageRoot', () => {
  it('finds the YLune package when name is @ylune/mcphub', () => {
    withPackage('@ylune/mcphub', (root, start) => {
      expect(findPackageRoot(start)).toBe(root);
    });
  });

  it('still finds upstream MCPHub package names', () => {
    withPackage('@samanhappy/mcphub', (root, start) => {
      expect(findPackageRoot(start)).toBe(root);
    });
    withPackage('mcphub', (root, start) => {
      expect(findPackageRoot(start)).toBe(root);
    });
  });
});

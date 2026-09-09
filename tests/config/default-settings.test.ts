import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../..');

const readJsonFile = (filename: string) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectRoot, filename), 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read ${filename}: ${message}`);
  }
};

describe('default settings files', () => {
  it('keeps the repository settings free of pre-seeded users', () => {
    const settings = readJsonFile('mcp_settings.json');

    expect(Array.isArray(settings.users)).toBe(true);
    expect(settings.users).toHaveLength(0);
  });

  it('does not maintain a separate Docker settings file', () => {
    expect(fs.existsSync(path.join(projectRoot, 'mcp_settings.docker.json'))).toBe(false);
  });

  it('keeps local settings files out of the Docker build context', () => {
    const dockerignore = fs.readFileSync(path.join(projectRoot, '.dockerignore'), 'utf8');
    const dockerfile = fs.readFileSync(path.join(projectRoot, 'Dockerfile'), 'utf8');
    const ignored = new Set(dockerignore.split(/\r?\n/).map((line) => line.trim()));

    expect(ignored.has('mcp_settings.json')).toBe(true);
    expect(ignored.has('data/')).toBe(true);
    expect(dockerfile).not.toContain('mcp_settings.docker.json');
  });
});

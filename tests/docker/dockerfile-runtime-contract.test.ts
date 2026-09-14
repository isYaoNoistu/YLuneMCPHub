import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../..');
const dockerfile = fs.readFileSync(path.join(projectRoot, 'Dockerfile'), 'utf8');
const dockerignore = fs.readFileSync(path.join(projectRoot, '.dockerignore'), 'utf8');
const compose = fs.readFileSync(path.join(projectRoot, 'deploy', 'docker-compose.yml'), 'utf8');
const lockfile = fs.readFileSync(path.join(projectRoot, 'pnpm-lock.yaml'), 'utf8');
const frontendCss = fs.readFileSync(
  path.join(projectRoot, 'frontend', 'src', 'index.css'),
  'utf8',
);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
) as {
  dependencies?: Record<string, string>;
};

const stageBody = (stage: string, nextStage?: string): string => {
  const startPattern = new RegExp(`^FROM .+ AS ${stage}\\s*$`, 'im');
  const start = dockerfile.search(startPattern);
  if (start < 0) {
    return '';
  }

  if (!nextStage) {
    return dockerfile.slice(start);
  }

  const remainder = dockerfile.slice(start);
  const nextPattern = new RegExp(`^FROM .+ AS ${nextStage}\\s*$`, 'im');
  const next = remainder.search(nextPattern);
  return next < 0 ? remainder : remainder.slice(0, next);
};

describe('Docker runtime contract', () => {
  it('uses disposable build and production dependency stages', () => {
    expect(dockerfile).toMatch(/^FROM .+ AS build\s*$/im);
    expect(dockerfile).toMatch(/^FROM .+ AS prod-deps\s*$/im);
    expect(dockerfile).toMatch(/^FROM .+ AS runtime\s*$/im);
    expect(dockerfile).toMatch(/^FROM .+ AS full\s*$/im);
    expect(dockerfile).toContain('deploy --prod');
  });

  it('keeps the default runtime free of optional build and extension toolchains', () => {
    const runtime = `${stageBody('runtime-base', 'build')}\n${stageBody('runtime', 'full')}`;

    expect(runtime).not.toBe('');
    expect(runtime).not.toMatch(
      /\b(build-essential|python3-dev|rustc|cargo|chromium|playwright|docker-ce|docker-buildx-plugin)\b/i,
    );
  });

  it('preserves commands and paths required by dynamic MCP servers', () => {
    const runtime = `${stageBody('runtime-base', 'build')}\n${stageBody('runtime', 'full')}`;

    for (const required of [
      'node',
      'npm',
      'npx',
      'uv',
      'uvx',
      'procps',
      'curl',
      '/app/dist',
      '/app/frontend/dist',
      '/app/locales',
      '/app/servers.json',
      '/app/node_modules',
      '/opt/mcp',
      'HEALTHCHECK',
    ]) {
      expect(runtime).toContain(required);
    }
  });

  it('keeps the slim runtime as the default final image', () => {
    expect(dockerfile.trimEnd()).toMatch(/FROM runtime AS default[\s\S]*$/);
    expect(compose).toContain('target: ${YLUNE_IMAGE_TARGET:-runtime}');
  });

  it('excludes development-only content from the build context', () => {
    const ignored = new Set(
      dockerignore
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#')),
    );

    for (const pathName of [
      '.cursor',
      'docs',
      'login',
      'tests',
      'Dockerfile.*.bak',
    ]) {
      expect(ignored).toContain(pathName);
    }
  });

  it('keeps shared hub styles required by the frontend build context', () => {
    expect(frontendCss).toMatch(/@import ['"]\.\.\/\.\.\/hub\/styles\//);
    expect(dockerignore.split(/\r?\n/).map((line) => line.trim())).not.toContain('hub');
  });

  it('does not ship TypeScript declaration packages as runtime dependencies', () => {
    const runtimePackages = Object.keys(packageJson.dependencies ?? {});

    expect(runtimePackages.filter((name) => name.startsWith('@types/'))).toEqual([]);
  });

  it('does not ship unused alternative database clients', () => {
    const runtimePackages = Object.keys(packageJson.dependencies ?? {});

    expect(runtimePackages).not.toContain('postgres');
    expect(runtimePackages).not.toContain('better-sqlite3');
    expect(lockfile).not.toContain('better-sqlite3@');
  });
});

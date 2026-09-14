# Docker Image Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the default YLuneMCPHub image from about 1.5 GB to at most 700 MB while preserving the documented gateway, Node, Python/uvx, dynamic MCP, database, OAuth, health-check, and `/opt/mcp` behaviors.

**Architecture:** Build application artifacts and production dependencies in disposable builder stages. Ship a default `runtime` target with only runtime packages, and a separate `full` target for Docker CLI, Rust/Cargo, Chromium/Playwright, and other optional extension tooling. Keep one Dockerfile so both variants share the same tested application runtime.

**Tech Stack:** Docker BuildKit, `python:3.13-slim-bookworm`, Node.js 22, Corepack/pnpm 10, TypeScript, Vite, Express.

## Global Constraints

- Default image must be `<= 700 MB` when measured as Docker image size.
- Existing HTTP endpoints, `/mcp`, OAuth, JSON mode, PostgreSQL mode, dynamic `npx`, dynamic `uvx`, health check, and `/opt/mcp` mount contract must remain compatible.
- Default image excludes Docker CLI/daemon, Rust/Cargo, Chromium/Playwright, and general build tools.
- `full` target retains optional extension tooling for installations that need it.
- Dockerfile must be backed up before editing as `Dockerfile.before-multistage-slim.bak`; retain no more than three `Dockerfile.*.bak` files.
- No credential, token, or environment secret may be added to the image or repository.
- README files must be updated in the same task as behavior changes.
- Do not commit unless the user explicitly requests a commit.

---

### Task 1: Lock the runtime contract with static tests

**Files:**
- Create: `tests/docker/dockerfile-runtime-contract.test.ts`
- Read: `Dockerfile`
- Read: `docker-compose.yml`
- Read: `package.json`

**Interfaces:**
- Consumes: the repository-root `Dockerfile`.
- Produces: static assertions for named stages `build`, `prod-deps`, `runtime`, and `full`, plus required runtime commands and paths.

- [ ] **Step 1: Write a failing Dockerfile contract test**

Add Jest assertions that read `Dockerfile` and require:

```typescript
expect(dockerfile).toContain('AS build');
expect(dockerfile).toContain('AS prod-deps');
expect(dockerfile).toContain('AS runtime');
expect(dockerfile).toContain('AS full');
expect(dockerfile).toContain('HEALTHCHECK');
expect(dockerfile).toContain('/opt/mcp');
expect(dockerfile).toContain('pnpm deploy --prod');
```

Also assert that the text between `AS runtime` and `AS full` does not contain `build-essential`, `cargo`, `rustc`, `chromium`, `playwright`, or Docker repository setup.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
pnpm exec jest tests/docker/dockerfile-runtime-contract.test.ts --runInBand
```

Expected: FAIL because the current Dockerfile is single-stage and has no `prod-deps` or `full` stage.

- [ ] **Step 3: Record the current build contract**

Document in the test comments that runtime must include Node/npm/npx, Python/pip, `uv`/`uvx`, `curl`, `procps`, CA certificates, `/app/dist`, `/app/frontend/dist`, `/app/locales`, `/app/servers.json`, and production `node_modules`.

### Task 2: Back up the Dockerfile and enforce Docker context exclusions

**Files:**
- Create: `Dockerfile.before-multistage-slim.bak`
- Modify: `.dockerignore`

**Interfaces:**
- Consumes: the unmodified current Dockerfile.
- Produces: a reversible backup and a minimal build context.

- [ ] **Step 1: Copy the complete current Dockerfile**

Create `Dockerfile.before-multistage-slim.bak` with the exact pre-change Dockerfile contents and a leading comment explaining that it is the rollback copy before the multi-stage slim-image change.

- [ ] **Step 2: Retain at most three Dockerfile backups**

List `Dockerfile.*.bak` by modification time and remove only the oldest backups when the new backup raises the count above three.

- [ ] **Step 3: Tighten `.dockerignore`**

Exclude at least:

```dockerignore
.git
.github
.cursor
coverage
docs
hub
login
tests
data
*.log
Dockerfile.*.bak
node_modules
frontend/node_modules
dist
frontend/dist
```

Do not exclude files used by the build: `package.json`, `pnpm-lock.yaml`, `frontend/package.json`, `src`, `frontend/src`, `locales`, `servers.json`, `scripts`, `tsconfig.json`, or Vite/Tailwind/PostCSS configuration.

### Task 3: Implement disposable build and production dependency stages

**Files:**
- Modify: `Dockerfile`
- Test: `tests/docker/dockerfile-runtime-contract.test.ts`

**Interfaces:**
- Produces: compiled backend/frontend artifacts in `build`; a deployable production dependency tree in `prod-deps`.

- [ ] **Step 1: Define a shared toolchain base**

Use `python:3.13-slim-bookworm`, install Node.js 22 from the official tarball, verify architecture (`amd64`/`arm64`), enable Corepack, and pin pnpm to the version declared by `packageManager`.

- [ ] **Step 2: Create the `build` stage**

Install build-only packages (`build-essential`, `python3-dev`, `pkg-config`, download utilities), copy lockfiles and package manifests before source code, run:

```dockerfile
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build
```

The stage may compile native modules and frontend assets because it is not shipped.

- [ ] **Step 3: Create the `prod-deps` stage**

Use the installed workspace and lockfile to create a production deployment directory:

```dockerfile
RUN pnpm --filter ylune-mcp-hub deploy --prod /prod/app
```

If the root package cannot be selected by name, use the verified pnpm deploy syntax that targets the repository root. Do not fall back to copying the full development `node_modules`.

- [ ] **Step 4: Run static contract tests**

Run:

```powershell
pnpm exec jest tests/docker/dockerfile-runtime-contract.test.ts --runInBand
```

Expected: PASS for stage presence and production dependency deployment.

### Task 4: Build the default runtime and optional full target

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml` if it currently assumes optional tools are always present
- Test: `tests/docker/dockerfile-runtime-contract.test.ts`

**Interfaces:**
- Produces: default final stage `runtime`; optional `full` target selectable with `docker build --target full`.

- [ ] **Step 1: Create the minimal `runtime` stage**

Install only runtime OS packages:

```text
ca-certificates curl tini procps
```

Install Node.js 22, `uv`, and the Python MCP fetch package required by the current image contract. Copy production dependencies from `prod-deps` and artifacts/configuration from `build`.

- [ ] **Step 2: Preserve runtime layout**

Ensure these paths exist and are owned by the runtime user where writes are expected:

```text
/app/dist
/app/frontend/dist
/app/locales
/app/servers.json
/app/node_modules
/opt/mcp
```

Keep the existing exposed port, `HEALTHCHECK`, entrypoint/signal handling, and startup command.

- [ ] **Step 3: Create the `full` target**

Derive `full` from `runtime`. Install Docker CLI/Buildx/Compose plugin, Rust/Cargo, Chromium/Playwright dependencies, and any extension packages that were previously installed only when `INSTALL_EXT=true`.

The default final stage remains `runtime`; full installations build with:

```powershell
docker build --target full -t ylune-mcp-hub:full .
```

- [ ] **Step 4: Verify optional tooling is absent from default**

Static test must ensure `runtime` does not install Docker, Rust, Cargo, Chromium, Playwright, `build-essential`, or `python3-dev`.

### Task 5: Remove runtime dependency bloat safely

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Test: relevant backend unit tests and `pnpm run build`

**Interfaces:**
- Produces: a smaller production dependency closure without changing imports or public APIs.

- [ ] **Step 1: Move type-only packages to dev dependencies**

Move `@types/bcrypt`, `@types/express`, `@types/jsonwebtoken`, `@types/pg`, and `@types/uuid` from `dependencies` to `devDependencies`.

- [ ] **Step 2: Prove unused runtime packages are unused**

Search imports and package references for `postgres` and `better-sqlite3`. Remove a package only when there is no runtime import, no dynamic `require`, no TypeORM driver selection requiring it, and no test proving support for that driver.

- [ ] **Step 3: Reinstall from the lockfile**

Run:

```powershell
pnpm install
pnpm run build
```

Expected: lockfile updates cleanly and build passes.

- [ ] **Step 4: Run focused database and tokenizer tests**

Run tests covering JSON DAO, PostgreSQL DAO, TypeORM initialization, activity logging, token counting, and tool-result compression. Expected: all focused tests pass.

### Task 6: Build, measure, and smoke-test both targets

**Files:**
- Create: `scripts/verify-docker-runtime.mjs`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `docs/linux-deploy.md`

**Interfaces:**
- Produces: repeatable image checks and documented target selection.

- [ ] **Step 1: Add runtime smoke checks**

The script must fail unless these commands succeed inside the default image:

```text
node --version
npm --version
npx --version
python --version
uv --version
uvx --version
ps --version
curl --version
```

It must also verify that `/app/dist`, `/app/frontend/dist`, `/app/locales`, `/app/servers.json`, and `/opt/mcp` exist.

- [ ] **Step 2: Build both variants**

Run on a host with a running Docker daemon:

```powershell
docker build --target runtime -t ylune-mcp-hub:slim .
docker build --target full -t ylune-mcp-hub:full .
```

Expected: both builds succeed.

- [ ] **Step 3: Enforce the size target**

Run:

```powershell
docker image inspect ylune-mcp-hub:slim --format '{{.Size}}'
```

Expected: result is `<= 734003200` bytes (700 MiB). If larger, inspect layers with `docker history`; do not remove required runtime capabilities to meet the target.

- [ ] **Step 4: Start the default image**

Start with an isolated test configuration, wait for the health check, request the health endpoint, and make one built-in `ylune` tool-list/call flow. Expected: container becomes healthy and returns successful responses.

- [ ] **Step 5: Verify full-only tools**

Inside `ylune-mcp-hub:full`, verify `docker --version`, `cargo --version`, and the documented browser command. Inside slim, verify these commands are absent.

- [ ] **Step 6: Update documentation**

Document:
- slim is the default and target size is at most 700 MB;
- exact `docker build` commands for slim and full;
- features excluded from slim;
- dynamic `npx`/`uvx` and `/opt/mcp` remain supported;
- migration guidance for users who relied on `INSTALL_EXT=true`.

- [ ] **Step 7: Review checkpoint**

Run `git diff --check`, inspect the Dockerfile backup count, and present image sizes plus smoke-test evidence. Do not commit unless explicitly authorized.

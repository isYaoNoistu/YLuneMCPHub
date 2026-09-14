# Code Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove verified dead code and dependencies, centralize duplicated rules and capability operations, and reduce maintenance paths without changing existing APIs or user-visible behavior.

**Architecture:** Start with reference-proven deletions, then introduce small internal factories behind unchanged service/controller exports. Keep frontend/backend validation implementations separate where runtime boundaries require it, but lock them to shared test vectors.

**Tech Stack:** TypeScript, React, Express, Jest, pnpm, i18next JSON locales.

## Global Constraints

- Preserve all current HTTP routes, exported function names, request/response shapes, permissions, locale behavior, and JSON/PostgreSQL support.
- Do not remove compatibility migrations, dual DAO factories, or MCP runtime fallback paths.
- Use failing tests before behavioral refactors.
- Avoid a generic abstraction unless all three capability domains use it with simpler call sites.
- Update README/user guide only when user-visible behavior changes.
- Do not commit unless the user explicitly requests a commit.

---

### Task 1: Delete reference-proven dead compatibility shims

**Files:**
- Delete: `frontend/src/utils/api.ts`
- Modify: `src/services/credentialService.ts`
- Test: `tests/frontend/runtime.test.ts`
- Test: credential service/controller tests

**Interfaces:**
- Consumes: current imports and exports.
- Produces: no API change for reachable application code.

- [ ] **Step 1: Re-run exact reference searches**

Verify there are zero imports of `frontend/src/utils/api.ts`, `getApiBaseUrl`, and `getApiUrl`, and zero callers of deprecated `openCredentialSecret`.

- [ ] **Step 2: Run existing tests**

Run runtime URL and credential service/controller tests. Expected: PASS before deletion.

- [ ] **Step 3: Delete only zero-reference symbols**

Delete `frontend/src/utils/api.ts`. Remove only the deprecated `openCredentialSecret` alias, leaving the canonical credential decrypt/open function untouched.

- [ ] **Step 4: Re-run tests and build**

Run:

```powershell
pnpm exec jest tests/frontend/runtime.test.ts --runInBand
pnpm run build
```

Expected: PASS.

### Task 2: Centralize frontend token-expiry presentation rules

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/utils/expiryCenter.ts`
- Modify: `tests/frontend/expiryCenter.test.ts`

**Interfaces:**
- Consumes: `isExpiredUser(user, now?)`.
- Produces: Dashboard uses the same expiration predicate as Users and diagnostics.

- [ ] **Step 1: Add Dashboard-shaped test cases**

Extend expiry tests with:

```typescript
[
  { mcpEnabled: false, expired: false, tokenExpiresAt: null, expected: true },
  { mcpEnabled: true, expired: true, tokenExpiresAt: null, expected: true },
  { mcpEnabled: true, expired: false, tokenExpiresAt: 'past ISO value', expected: true },
  { mcpEnabled: true, expired: false, tokenExpiresAt: 'future ISO value', expected: false },
]
```

- [ ] **Step 2: Run tests**

Expected: PASS against the canonical helper.

- [ ] **Step 3: Remove Dashboard's local predicate**

Import `isExpiredUser` from `expiryCenter.ts` and replace the local `isTokenExpired` calls. Keep display-only remaining-time formatting local unless it has another real consumer.

- [ ] **Step 4: Verify**

Run expiry tests and the frontend TypeScript/Vite build. Expected: PASS.

### Task 3: Enforce zh/en locale parity

**Files:**
- Create: `scripts/check-locale-parity.mjs`
- Modify: `package.json`
- Modify: `locales/zh.json`
- Modify: `locales/en.json`
- Test: `tests/frontend/serverLocales.test.ts`

**Interfaces:**
- Produces: `pnpm run locale:check`, which exits non-zero when flattened zh/en key sets differ.

- [ ] **Step 1: Add a failing parity test/script**

Recursively flatten both locale objects to dotted paths, compare sorted key sets, and print keys missing from each locale. Values may differ; keys may not.

- [ ] **Step 2: Verify current failure**

Run:

```powershell
pnpm run locale:check
```

Expected: FAIL and report the currently mismatched `failedToReloadServer`, `failedToUpdateSystemConfig`, and `llmProviderApiKeyDescription` paths.

- [ ] **Step 3: Align canonical keys**

Use the path referenced by application code as canonical. Add translated missing values, update callers only if a mismatched old path is unused, and do not bulk-merge keys merely because their displayed text matches.

- [ ] **Step 4: Verify**

Run locale parity, locale tests, and frontend build. Expected: PASS.

### Task 4: Share frontend capability mutation transport

**Files:**
- Create: `frontend/src/services/capabilityMutationClient.ts`
- Modify: `frontend/src/services/toolService.ts`
- Modify: `frontend/src/services/promptService.ts`
- Modify: `frontend/src/services/resourceService.ts`
- Create: `tests/frontend/capabilityMutationClient.test.ts`

**Interfaces:**
- Produces:

```typescript
createCapabilityMutationClient<TId>({
  segment,
  encodeId,
}): {
  toggle(serverName: string, id: TId, enabled: boolean): Promise<void>;
  updateDescription(serverName: string, id: TId, description: string): Promise<void>;
  resetDescription(serverName: string, id: TId): Promise<void>;
}
```

- Existing exports such as `toggleTool`, `togglePrompt`, and `toggleResource` remain unchanged.

- [ ] **Step 1: Add parameterized request tests**

Mock the existing fetch layer and assert exact method, path encoding, body, success handling, and error propagation for tool name, prompt name, and resource URI.

- [ ] **Step 2: Verify tests fail**

Expected: FAIL because the factory does not exist.

- [ ] **Step 3: Implement the internal factory**

Keep response/error handling identical to the current services. Support resource URIs through injected `encodeId`; do not introduce capability-specific conditionals into the factory.

- [ ] **Step 4: Preserve public wrappers**

Each existing service calls the factory and exports its current function names and signatures. No component import changes should be necessary.

- [ ] **Step 5: Verify**

Run the new test, frontend tests that mock these services, and frontend build. Expected: PASS.

### Task 5: Share backend capability handler mechanics

**Files:**
- Create: `src/controllers/capabilityHandlers.ts`
- Modify: `src/controllers/serverController.ts`
- Modify: `tests/controllers/serverController.test.ts`

**Interfaces:**
- Produces an internal handler factory parameterized by:
  - capability collection key;
  - request identifier reader;
  - DAO updater;
  - reload/notification hook;
  - optional embedding synchronization.
- Existing controller exports and routes remain unchanged.

- [ ] **Step 1: Add a capability behavior matrix**

Parameterize existing controller tests across tool, prompt, and resource for:
- admin authorization;
- server not found;
- toggle enabled/disabled;
- custom description update;
- reset description;
- URI/name encoding;
- persistence failure response.

- [ ] **Step 2: Run the matrix against current code**

Expected: PASS. This establishes exact behavior before refactoring.

- [ ] **Step 3: Implement the smallest shared mechanics**

Extract authorization/server loading, collection mutation, persistence, and standard response/error mapping. Keep capability-specific embedding and notification hooks injected. Do not move unrelated server controller logic.

- [ ] **Step 4: Replace handlers with thin named wrappers**

Retain exports:

```typescript
toggleTool
updateToolDescription
resetToolDescription
togglePrompt
updatePromptDescription
resetPromptDescription
toggleResource
updateResourceDescription
resetResourceDescription
```

- [ ] **Step 5: Verify**

Run all `serverController` tests and backend build. Expected: PASS with no route changes.

### Task 6: Lock duplicated cross-runtime validation contracts

**Files:**
- Create: `tests/fixtures/validation-contracts.json`
- Modify: backend server-name/password/token-expiry tests
- Create or modify: corresponding frontend utility tests

**Interfaces:**
- Produces: shared data vectors, not a shared runtime package.

- [ ] **Step 1: Define explicit vectors**

Include valid/invalid server names, slug outputs, reserved `ylune`, password boundaries, and custom expiry past/future cases.

- [ ] **Step 2: Run vectors through backend implementations**

Expected: PASS.

- [ ] **Step 3: Run the same vectors through frontend implementations**

Expected: PASS. Keep frontend i18n error keys and backend API messages separate.

- [ ] **Step 4: Fix only discovered drift**

If implementations disagree, use documented backend API rules as canonical and update frontend pre-validation to match.

### Task 7: Remove only proven unused runtime dependencies

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Test: build and focused database/runtime tests

**Interfaces:**
- Produces: smaller install closure with no supported driver loss.

- [ ] **Step 1: Produce an evidence list**

For each candidate package, record static imports, dynamic imports, configuration references, peer dependency requirements, and tests. Initial candidates are `postgres`, direct `better-sqlite3`, and production `@types/*`.

- [ ] **Step 2: Move type packages**

Move runtime-unnecessary `@types/*` to `devDependencies`.

- [ ] **Step 3: Remove only packages with no supported runtime path**

Do not remove `typeorm`, `pg`, `bcrypt`, `bcryptjs`, `gpt-tokenizer`, MCP SDK packages, OAuth packages, or compression/runtime observability packages without a separate feature-removal decision.

- [ ] **Step 4: Verify clean install**

Run:

```powershell
pnpm install --frozen-lockfile
pnpm run build
```

Then run focused JSON DAO, PostgreSQL DAO, auth, activity log, and compression tests.

### Task 8: Final regression and documentation checkpoint

**Files:**
- Modify: `README.md` and `README.en.md` only if developer-facing commands changed

**Interfaces:**
- Produces: verified cleanup diff and measured net line/dependency reduction.

- [ ] **Step 1: Run static checks**

Run `pnpm run build`, locale parity, `git diff --check`, and lints for edited files.

- [ ] **Step 2: Run unit tests**

Run all non-integration Jest projects/suites. Record the known baseline failures separately; no new failures are allowed.

- [ ] **Step 3: Report measurable results**

Report deleted files/symbols, package changes, net line reduction, preserved exports/routes, and test counts. Do not commit unless explicitly authorized.

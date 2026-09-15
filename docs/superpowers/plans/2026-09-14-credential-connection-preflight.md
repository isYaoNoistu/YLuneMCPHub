# Credential Connection Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let administrators test any credential against any MCP and let bound credentials establish the server discovery connection during startup and reload.

**Architecture:** Keep the existing environment-only preflight as one view, and reuse `probeServerWithCredential` for real credential validation. Extract one persistent connection routine from `mcpService.ts`; initialization tries the original config first when complete, then bound credential overlays sorted by credential ID until one connects. User tool calls keep their existing user-selected credential clients.

**Tech Stack:** TypeScript, Express, React, Jest, MCP SDK, existing encrypted credential store.

## Global Constraints

- Preserve existing API routes and add fields or UI only in backward-compatible ways.
- Never return credential values in API responses or include them in logs.
- Only administrators may list all credentials, run credential probes, or bind an unbound credential.
- Do not add a default-credential column or database migration.
- Do not commit until the user explicitly requests it.

---

### Task 1: Credential-aware preflight contracts

**Files:**
- Modify: `src/utils/envPreflight.ts`
- Modify: `frontend/src/types/index.ts`
- Test: `tests/utils/envPreflight.test.ts`

**Interfaces:**
- Produce: `EnvPreflightSource = 'process_env' | 'credential' | 'missing'`
- Produce: `buildEnvPreflight(config, env?, credentialFields?)`

- [ ] **Step 1: Add a failing source and secret-safety test**

Add cases proving `FOO` resolves from `process_env`, `BAR` resolves from credential keys, and `BAZ` remains missing. Assert that serialized output contains neither environment nor credential values.

```ts
expect(buildEnvPreflight(config, { FOO: 'env-secret' }, { BAR: 'credential-secret' })).toEqual([
  { name: 'BAR', referenced: true, resolved: true, source: 'credential' },
  { name: 'BAZ', referenced: true, resolved: false, source: 'missing' },
  { name: 'FOO', referenced: true, resolved: true, source: 'process_env' },
]);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `pnpm exec jest tests/utils/envPreflight.test.ts --runInBand`

Expected: FAIL because `source` and `credentialFields` are not implemented.

- [ ] **Step 3: Implement the minimal contract**

Resolve each referenced name with environment precedence, then credential presence:

```ts
export type EnvPreflightSource = 'process_env' | 'credential' | 'missing';

export interface EnvPreflightItem {
  name: string;
  referenced: boolean;
  resolved: boolean;
  source: EnvPreflightSource;
}
```

Only inspect key presence/non-empty values; never place values in the result.

- [ ] **Step 4: Keep the frontend type in parity**

Add the same `source` union to `frontend/src/types/index.ts`.

- [ ] **Step 5: Run the focused test and confirm GREEN**

Run: `pnpm exec jest tests/utils/envPreflight.test.ts --runInBand`

Expected: PASS.

### Task 2: Persistent startup and reload through bound credentials

**Files:**
- Modify: `src/services/mcpService.ts`
- Modify: `src/services/credentialBindingService.ts` only if a sorted public-ID helper is needed
- Test: `tests/services/credentialBinding.test.ts`
- Test: add `tests/services/mcpService-bound-credential-startup.test.ts`

**Interfaces:**
- Produce: `resolveBoundCredentialConfigs(server): Promise<Array<{ credentialId: string; config: ServerConfigWithName }>>`
- Produce: one internal persistent connection routine used by base and credential-overlay attempts.

- [ ] **Step 1: Write failing startup and reload tests**

Mock a stdio server whose config references `${JENKINS_URL}`, `${JENKINS_USER}`, and `${JENKINS_API_TOKEN}` while `process.env` lacks them. Provide two bound credentials sorted out of order: the first fails connection and the second succeeds.

Assert:

```ts
expect(connectAttempts.map((row) => row.credentialId)).toEqual(['cred-a', 'cred-b']);
expect(serverInfo.status).toBe('connected');
expect(serverInfo.error).toBeNull();
expect(serializedLogs).not.toContain('actual-token');
```

Repeat through `reconnectServer(serverName)` to prove reload uses the same path.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `pnpm exec jest tests/services/credentialBinding.test.ts tests/services/mcpService-bound-credential-startup.test.ts --runInBand`

Expected: FAIL because persistent initialization only expands `process.env`; the current probe closes its temporary client.

- [ ] **Step 3: Resolve candidate overlay configs safely**

Load enabled bound credentials, sort IDs with `localeCompare`, decrypt through `openCredentialFields`, and create immutable overlays with `overlayCredentialFields`. Catch a single unusable credential and continue; log only credential ID and a summarized error.

- [ ] **Step 4: Extract and reuse the persistent connection routine**

Move the existing transport creation, `client.connect`, capability listing, cache update, keepalive setup, and `serverInfo.client/transport/config` assignment into one internal routine:

```ts
const connectPersistentServer = async (
  serverInfo: ServerInfo,
  config: ServerConfigWithName,
): Promise<void>;
```

Do not call `probeServerWithCredential` for the persistent connection because its `finally` block closes the client.

- [ ] **Step 5: Try base and bound candidates deterministically**

When the base configuration has unresolved credential needs or its connection fails, try each bound overlay. Stop on the first complete persistent connection. Preserve current OAuth, OpenAPI, on-demand, prompt/resource listing, cache broadcast, and keepalive behavior.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run: `pnpm exec jest tests/services/credentialBinding.test.ts tests/services/mcpService-bound-credential-startup.test.ts --runInBand`

Expected: PASS with no secret values in output.

### Task 3: Connection preflight dialog

**Files:**
- Create: `frontend/src/components/server-card/ConnectionPreflightDialog.tsx`
- Modify: `frontend/src/components/ServerCard.tsx`
- Modify: `frontend/src/components/server-card/ActionsMenu.tsx`
- Modify: `frontend/src/services/opsService.ts`
- Modify: `frontend/src/services/credentialService.ts` only if response typing changes
- Modify: `locales/zh.json`
- Modify: `locales/en.json`
- Test: add `tests/frontend/connectionPreflight.test.ts`

**Interfaces:**
- Consume: `getServerEnvPreflight`, `getCredentials`, `getCredentialContracts`, `testServerCredential`, `setServerCredentials`
- Produce: `ConnectionPreflightDialog({ serverName, open, onClose, onServerChanged })`

- [ ] **Step 1: Write failing pure-state tests**

Test helpers for:

- sorting credentials by name;
- marking bound IDs from the server contract;
- computing missing `neededKeys` from public `Credential.keys`;
- appending a tested credential ID without removing existing bindings.

- [ ] **Step 2: Run the frontend test and confirm RED**

Run: `pnpm exec jest tests/frontend/connectionPreflight.test.ts --runInBand`

Expected: FAIL because the dialog helpers do not exist.

- [ ] **Step 3: Implement the dialog**

The dialog has two tabs:

- “运行环境”: current variable list with `source` labels.
- “凭据验证”: all enabled credentials, bound badge, key-coverage summary, selection, and real connection test.

Use the existing `YluneDialog`, `hub-btn`, `hub-status`, and `hub-kbd` patterns. Disable the test button while loading; render the API’s sanitized `message` and `toolCount`.

- [ ] **Step 4: Add bind-after-success**

Show “绑定到此 MCP” only when the selected credential is unbound and the latest test succeeded for that exact credential ID. Call:

```ts
setServerCredentials(serverName, [...new Set([...boundIds, credentialId])]);
```

Reload contracts and trigger the server refresh after success.

- [ ] **Step 5: Replace the menu action without breaking callers**

Rename the visible label from “ENV 预检” to “连接预检”; keep the existing callback prop shape in `ActionsMenu` unless renaming improves type clarity without widening the diff. `ServerCard` owns only dialog open/close state.

- [ ] **Step 6: Add Chinese and English copy with parity**

Add keys for tabs, bound/unbound, key coverage, testing, tool count, success/failure, and bind action. Run locale parity coverage.

- [ ] **Step 7: Run frontend tests and build**

Run:

```bash
pnpm exec jest tests/frontend/connectionPreflight.test.ts tests/frontend/serverLocales.test.ts --runInBand
pnpm frontend:build
```

Expected: all tests PASS and Vite exits 0.

### Task 4: Documentation and integrated verification

**Files:**
- Modify: `docs/user-guide.md`
- Modify: `README.md` only if the credential summary needs clarification
- Modify: `README.en.md` only if the credential summary needs clarification

- [ ] **Step 1: Document the two preflight modes**

Explain that any credential can be tested, only explicitly confirmed credentials become bound, and startup/reload tries bound credentials without exposing values.

- [ ] **Step 2: Run security-sensitive and full verification**

Run:

```bash
pnpm exec jest tests/utils/envPreflight.test.ts tests/services/credentialBinding.test.ts tests/services/mcpService-bound-credential-startup.test.ts tests/frontend/connectionPreflight.test.ts --runInBand
pnpm test -- --runInBand --silent
pnpm run lint
pnpm run build
git diff --check
```

Expected: all tests PASS; lint, build, and diff check exit 0.

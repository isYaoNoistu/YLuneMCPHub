# Large Module Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the largest backend and frontend modules reviewable and maintainable by separating stable responsibilities while preserving every external import, API route, permission check, migration, and runtime feature.

**Architecture:** Refactor one hotspot at a time behind compatibility barrels and unchanged component/controller/service entry points. Begin with pure extraction and characterization tests; defer behavior changes. Use domain boundaries already visible in the code instead of introducing a framework-wide generic layer.

**Tech Stack:** TypeScript, React, Express, MCP SDK, Jest, Vite.

## Global Constraints

- Preserve all existing public exports, route paths, request/response shapes, storage formats, locale keys, and UI capabilities.
- Preserve legacy smart-routing migration, bearer-key migration, invalid legacy server-name edit exemption, JSON/database DAO factories, credential overlays, OAuth reconnect, hosted auth, MCP Apps, smart routing, compression, and fallback dispatch.
- Each hotspot is a separate review checkpoint and may be stopped independently.
- No behavior change may be bundled into a pure extraction task.
- Add component/characterization tests before extracting areas without coverage.
- README/user guide must be synchronized if a user-visible workflow changes; pure file moves require no user-facing documentation claim.
- Do not commit unless the user explicitly requests a commit.

---

### Task 1: Extract Settings page leaf sections

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Create: `frontend/src/components/settings/BearerKeysSection.tsx`
- Create: `frontend/src/components/settings/BearerKeyRow.tsx`
- Create: `frontend/src/components/settings/SmartRoutingSection.tsx`
- Create: `frontend/src/components/settings/ToolResultCompressionSection.tsx`
- Create: `frontend/src/components/settings/McpRouterSection.tsx`
- Create: `frontend/src/components/settings/settingsDiff.ts`
- Create: `tests/frontend/settingsDiff.test.ts`

**Interfaces:**
- `SettingsPage` remains the route component.
- `buildSmartRoutingUpdates(saved, draft)` returns the same partial update object currently assembled inline.
- Section components receive data and callbacks; they do not fetch independently.

- [ ] **Step 1: Characterize smart-routing diff behavior**

Add test cases for unchanged data, primitive field changes, nested model/provider fields, reset-to-empty behavior, and preservation of omitted fields.

- [ ] **Step 2: Extract the pure diff function**

Move only field comparison/object construction to `settingsDiff.ts`; use it from the existing page before moving JSX. Run tests and frontend build.

- [ ] **Step 3: Extract `BearerKeyRow` and bearer-key section**

Move local row state and JSX without changing callback signatures, masking behavior, copy behavior, confirmation flow, or demo read-only state.

- [ ] **Step 4: Extract smart routing, compression, and router sections**

Pass saved/draft values and mutation callbacks as props. Keep `SettingsContext` as the API owner.

- [ ] **Step 5: Verify**

Run settings diff tests, demo/read-only frontend tests, and frontend build. Manually check dirty-state, save, reset, and validation for each moved section.

### Task 2: Consolidate Settings draft ownership

**Files:**
- Modify: `frontend/src/contexts/SettingsContext.tsx`
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Create: `frontend/src/types/settings.ts`
- Modify: extracted settings sections
- Create: `tests/frontend/settingsDraft.test.ts`

**Interfaces:**
- Produces one owner for each saved/draft config pair.
- Shared settings types move to `frontend/src/types/settings.ts`; existing imports can re-export temporarily.

- [ ] **Step 1: Map duplicate draft fields**

List every config stored in both context and page. Mark one canonical owner based on whether the state is shared across sections.

- [ ] **Step 2: Add reducer/helper tests**

Test initialize-from-server, local edit, dirty detection, successful commit, failed commit preservation, and reset.

- [ ] **Step 3: Move shared types**

Extract interfaces without changing field names or optionality. Add temporary re-exports when needed to keep import paths stable.

- [ ] **Step 4: Remove duplicate page state**

Use context draft state for shared configs and local section state only for truly isolated forms. Do not change API call count or save timing.

- [ ] **Step 5: Verify**

Run new tests and frontend build; manually verify navigation between settings sections does not lose unsaved values unexpectedly.

### Task 3: Split ServerForm by transport

**Files:**
- Modify: `frontend/src/components/ServerForm.tsx`
- Create: `frontend/src/components/server-form/ServerFormCoreFields.tsx`
- Create: `frontend/src/components/server-form/StdioTransportFields.tsx`
- Create: `frontend/src/components/server-form/HttpTransportFields.tsx`
- Create: `frontend/src/components/server-form/OpenApiTransportFields.tsx`
- Create: `frontend/src/components/server-form/types.ts`
- Modify: existing `serverFormPayload`, OpenAPI security, and source-analysis tests

**Interfaces:**
- `ServerForm` keeps its current props and submit payload.
- Transport sections receive typed value/error/change props and never submit independently.
- Existing invalid legacy server-name edit exemption remains in the top-level coordinator.

- [ ] **Step 1: Expand payload characterization**

Cover create/edit payloads for `stdio`, `sse`, `streamable-http`, and `openapi`, including auth, headers, environment, credentials, visibility, shared users, OpenAPI security prefill, and unchanged invalid legacy name.

- [ ] **Step 2: Extract shared field types**

Move only type declarations and transport-specific prop interfaces. Run TypeScript build.

- [ ] **Step 3: Extract OpenAPI fields first**

Move OpenAPI source analysis, security prefill display, and statistics UI while keeping analysis hooks/utilities unchanged.

- [ ] **Step 4: Extract stdio and HTTP fields**

Keep all validation and value normalization at the current boundary. Do not merge SSE and streamable HTTP payload semantics merely because their forms look similar.

- [ ] **Step 5: Verify**

Run payload/OpenAPI tests and frontend build. Manually submit add/edit flows for all four transports and compare network payloads to characterization fixtures.

### Task 4: Split ServerCard presentation from actions

**Files:**
- Modify: `frontend/src/components/ServerCard.tsx`
- Create: `frontend/src/components/server-card/ServerCardActionsMenu.tsx`
- Create: `frontend/src/components/server-card/ServerCapabilityTabs.tsx`
- Create: `frontend/src/components/server-card/ServerMcpAppBadge.tsx`
- Create: `frontend/src/components/ui/LoadingControl.tsx`
- Modify: `frontend/src/utils/mcpApps.ts`
- Create: `tests/frontend/mcpApps.test.ts`

**Interfaces:**
- `ServerCard` keeps its current props.
- MCP Apps MIME detection comes from `mcpApps.ts`; only one constant definition remains.
- Action callbacks continue to be owned/wired by `ServerCard`.

- [ ] **Step 1: Characterize MCP Apps detection**

Test exact MIME type, metadata-based detection, non-app resources, and missing metadata.

- [ ] **Step 2: Export the canonical constant/helper**

Move duplicate MIME values to `mcpApps.ts` and update `ServerCard`.

- [ ] **Step 3: Extract leaf UI components**

Move loading control, badge, tabs, and menu presentation. Preserve clone, preflight, reload, reinstall, OAuth disconnect, export, visibility, and toggle callbacks.

- [ ] **Step 4: Verify**

Run MCP Apps and OAuth service tests, frontend build, and manually exercise every action in admin and demo/read-only modes.

### Task 5: Decompose `updateSystemConfig`

**Files:**
- Modify: `src/controllers/serverController.ts`
- Create: `src/controllers/systemConfigPatches.ts`
- Modify: `tests/controllers/serverController.test.ts`
- Create: `tests/controllers/systemConfigPatches.test.ts`

**Interfaces:**
- `updateSystemConfig(req, res)` remains exported from `serverController.ts`.
- Pure patch functions consume current config plus request patch and return validated partial config updates.

- [ ] **Step 1: Characterize each configuration domain**

Cover routing, install, smart routing, compression, MCP router, OAuth server, auth, and activity logging, including omitted-field semantics and invalid input.

- [ ] **Step 2: Lock legacy migration order**

Add a test proving `migrateLegacySmartRoutingConfig` runs before new smart-routing patch validation/merge.

- [ ] **Step 3: Extract domain patch functions**

Create named functions such as `applyRoutingPatch` and `applySmartRoutingPatch`. They must not persist or send HTTP responses.

- [ ] **Step 4: Keep orchestration in the controller**

The controller performs admin authorization, migration, invokes patch functions, persists once, triggers required runtime updates, and maps errors/responses exactly as before.

- [ ] **Step 5: Verify**

Run all 77+ server controller tests and backend build. No route snapshot or response fixture may change.

### Task 6: Extract MCP transport construction

**Files:**
- Modify: `src/services/mcpService.ts`
- Create: `src/services/mcp/mcpTransport.ts`
- Create: `src/services/mcp/processLifecycle.ts`
- Modify: transport/proxy/stdio cleanup tests

**Interfaces:**
- `mcpService.ts` remains the public import path and delegates transport creation.
- Transport factory accepts explicit config/dependencies and returns the same MCP SDK transport types.

- [ ] **Step 1: Run and extend transport characterization tests**

Cover stdio, SSE, streamable HTTP, OpenAPI, proxychains config, abort, Windows/POSIX process cleanup, and failure cleanup.

- [ ] **Step 2: Extract process lifecycle helpers**

Move process-tree and cleanup orchestration without changing platform checks or logging.

- [ ] **Step 3: Extract transport factory**

Move `createTransportFromConfig` and proxy helpers. Inject environment/credential overlays; do not read global mutable state inside new pure helpers when the caller already has the value.

- [ ] **Step 4: Preserve compatibility exports**

Re-export test-visible functions from `mcpService.ts` where existing tests/importers depend on them.

- [ ] **Step 5: Verify**

Run all transport, proxy, process cleanup, and MCP service initialization tests plus backend build.

### Task 7: Extract MCP list/read handlers

**Files:**
- Modify: `src/services/mcpService.ts`
- Create: `src/services/mcp/mcpListHandlers.ts`
- Create: `src/services/mcp/capabilityFilters.ts`
- Modify: list-tools/prompts/resources and group-filter tests

**Interfaces:**
- Existing handler exports remain available through `mcpService.ts`.
- Filters receive caller grants, groups, and server capability lists explicitly.

- [ ] **Step 1: Characterize filtered outputs**

Cover admin, regular user, demo/system key, group grants, disabled capability, built-in `ylune`, credential requirements, and duplicate qualified names.

- [ ] **Step 2: Extract pure filters**

Move tool/prompt/resource filtering and qualification helpers without connection access.

- [ ] **Step 3: Extract list/get handlers**

Move list tools, list prompts, list resources, read resource, and get prompt orchestration. Keep current logging and error mapping.

- [ ] **Step 4: Verify**

Run every MCP list/group/access test and backend build.

### Task 8: Extract MCP tool dispatch last

**Files:**
- Modify: `src/services/mcpService.ts`
- Create: `src/services/mcp/mcpToolDispatch.ts`
- Create: `src/services/mcp/toolCallLogging.ts`
- Modify: all `mcpService-*call*`, hosted, credential, compression, router, and built-in ylune tests

**Interfaces:**
- `handleCallToolRequest` remains exported from `mcpService.ts`.
- Dispatch dependencies are passed as one typed object: registry lookup, caller authorization, credential binding, hosted auth, smart router, compression, logger, and built-in ylune executor.

- [ ] **Step 1: Build a dispatch behavior matrix**

Characterize direct/qualified/short names, `call_tool` wrapper, built-in `ylune`, missing client, disabled tool, group denial, credentials, hosted auth, smart route, compressed result, activity log success/failure, and legacy fallback.

- [ ] **Step 2: Run the full matrix before extraction**

Expected: PASS. Known environment-specific integration failures remain separately documented.

- [ ] **Step 3: Extract logging first**

Centralize success/failure activity log payload construction while preserving redaction, duration, user/server/tool fields, and best-effort failure behavior.

- [ ] **Step 4: Extract dispatch orchestration**

Move code without reordering authorization, credential binding, client selection, built-in dispatch, execution, compression, or logging. Keep legacy fallback comments and tests.

- [ ] **Step 5: Keep registry/session ownership in `mcpService.ts`**

Do not create circular imports. The root service owns mutable clients/sessions and passes closures to the dispatcher.

- [ ] **Step 6: Verify**

Run all MCP service unit tests, backend build, and isolated SSE/HTTP integration suites with the correct test configuration.

### Task 9: Final architecture regression

**Files:**
- Modify: developer documentation only if module ownership needs documenting

**Interfaces:**
- Produces: unchanged public surface with smaller focused modules.

- [ ] **Step 1: Verify public imports**

Search callers of `mcpService.ts`, `serverController.ts`, `SettingsPage`, `ServerForm`, and `ServerCard`; ensure none require migration.

- [ ] **Step 2: Run builds and unit suites**

Run backend/frontend build and all non-integration tests. Compare failures with the recorded baseline; no new failure is allowed.

- [ ] **Step 3: Run integration suites in isolated configuration**

Ensure database-mode environment does not leak into JSON-mode SSE tests. Run SSE, streamable HTTP, OAuth, and real-client suites separately and clean up processes.

- [ ] **Step 4: Measure structural outcome**

Report line counts and responsibilities. Targets:
- no extracted leaf module exceeds roughly 800 lines without a documented reason;
- `SettingsPage`, `ServerForm`, and `ServerCard` become coordinators;
- `mcpService.ts` keeps registry/session ownership while transport, list/read, and dispatch move to focused modules;
- net public API changes: zero.

- [ ] **Step 5: Review checkpoint**

Run `git diff --check`, inspect lints for every edited file, and present test/build evidence. Do not commit unless explicitly authorized.

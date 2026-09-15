# Dashboard Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose the complete Dashboard into a compact operations overview and replace the oversized smoothed chart with a restrained, accessible seven-day trend.

**Architecture:** Keep the existing Dashboard API calls and data model. Extract pure chart geometry into a testable utility, keep rendering in `UsageLineChart`, and reorganize `Dashboard.tsx` into three visual tiers styled exclusively with existing YLune theme tokens.

**Tech Stack:** React, TypeScript, SVG, CSS, i18next, Jest, Vite.

## Global Constraints

- Do not add a charting dependency or new backend endpoint.
- Reuse `hub/styles/tokens.css` and existing `--hub-*` / `--color-*` variables.
- Preserve admin, demo, and regular-user content and authorization behavior.
- Use a 120–140px desktop trend plot and a smaller mobile plot.
- Calls use the accent color; errors remain a dashed danger-color line.
- Support mouse, touch, and keyboard reading of daily values.
- Do not commit until the user explicitly requests it.

---

### Task 1: Stable chart geometry

**Files:**
- Create: `frontend/src/utils/usageChart.ts`
- Modify: `frontend/src/components/UsageLineChart.tsx`
- Test: add `tests/frontend/usageChart.test.ts`

**Interfaces:**
- Produce: `buildUsageChart(days, options): UsageChartModel`
- Produce: `linePath(points): string`
- Consume: `ActivityUsageDay[]`

- [ ] **Step 1: Write failing geometry tests**

Cover:

- seven zero days produce a non-zero scale and a flat baseline;
- a single peak receives at least 15% headroom;
- call and error points use identical X positions;
- generated paths contain only `M` and `L`, never `C`;
- values are clamped at zero.

```ts
expect(linePath([{ x: 0, y: 10 }, { x: 20, y: 5 }])).toBe('M 0 10 L 20 5');
expect(model.callPath).not.toContain('C');
expect(model.peak).toBeGreaterThan(100);
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `pnpm exec jest tests/frontend/usageChart.test.ts --runInBand`

Expected: FAIL because the utility does not exist.

- [ ] **Step 3: Implement pure chart math**

Use a fixed `viewBox` width of 720 and desktop height of 132. Use 24px left, 10px right, 12px top, and 24px bottom margins. Compute a readable rounded peak with at least 15% headroom and a minimum of 4.

Return points, straight-line paths, baseline, ticks, dimensions, and `xFor`. Do not create an area path.

- [ ] **Step 4: Rebuild the component around the model**

Remove `smoothPath`, the gradient `<defs>`, and the area `<path>`. Keep two paths and sparse grid lines.

Add:

```tsx
tabIndex={0}
onKeyDown={handleArrowSelection}
onPointerMove={handlePointerSelection}
aria-describedby={summaryId}
```

Use left/right arrows to change the active day, pointer events for mouse/touch, and `aria-live="polite"` on the selected-day values.

- [ ] **Step 5: Run geometry tests and frontend build**

Run:

```bash
pnpm exec jest tests/frontend/usageChart.test.ts --runInBand
pnpm frontend:build
```

Expected: PASS and Vite exits 0.

### Task 2: Three-tier Dashboard composition

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/styles/ylune-shell.css`
- Modify: `locales/zh.json`
- Modify: `locales/en.json`
- Test: `tests/frontend/serverLocales.test.ts`

**Interfaces:**
- Consume: existing `stats`, `todayUsage`, `weekCalls`, `usage`, `allServers`, and `users`
- Produce: compact summary, operations overview, trend, rankings, and recent-failure cards.

- [ ] **Step 1: Reorganize the admin layout without changing data loading**

Compose:

1. `.dash-summary-grid`: four compact metrics for server health, tools, today calls, and seven-day calls.
2. `.dash-overview-grid`: operations snapshot card beside the seven-day trend card.
3. `.dash-detail-grid`: tool ranking and user ranking.
4. `.dash-failures-card`: recent failures with a compact empty state.

Move endpoint, last failure, offline count, and server roster into the operations snapshot. Preserve demo and regular-user branches with the same underlying content, using the new card shell.

- [ ] **Step 2: Remove visual noise from JSX**

Replace inline font-size/color styles with named classes. Keep labels concise and remove the external `// usageTitle` heading when the cards already provide their own titles.

- [ ] **Step 3: Implement the restrained theme**

Apply:

- 1px `var(--color-border)` outlines;
- 8–10px radii;
- 12–16px card padding;
- no decorative side stripe or large gradient;
- 24–28px mono summary numbers;
- 11–13px supporting labels;
- consistent card headers with title left and a quiet value/status right.

Trend CSS:

```css
.dash-line-calls { stroke-width: 1.4; }
.dash-line-errors { stroke-width: 1.15; stroke-dasharray: 4 4; }
.dash-line-grid { opacity: 0.55; stroke-dasharray: 2 5; }
```

Render the selected-day detail as a bordered surface chip inside the chart card, not a floating translucent overlay.

- [ ] **Step 4: Add responsive rules**

- At `max-width: 900px`, overview and detail grids become one column.
- At `max-width: 640px`, summary cards become two columns, plot height reduces, non-terminal X labels hide, and bar rows simplify without horizontal overflow.
- Keep focus rings visible in both themes.

- [ ] **Step 5: Update copy and enforce locale parity**

Add only labels needed by the new card headings or summaries. Keep Chinese and English keys identical.

- [ ] **Step 6: Run locale, build, and lint verification**

Run:

```bash
pnpm exec jest tests/frontend/serverLocales.test.ts tests/frontend/usageChart.test.ts --runInBand
pnpm frontend:build
pnpm run lint
```

Expected: tests PASS; build and lint exit 0.

### Task 3: Visual regression and documentation

**Files:**
- Modify: `docs/images/dashboard.png`
- Modify: `docs/user-guide.md`
- Modify: `README.md` only if the Dashboard description changes
- Modify: `README.en.md` only if the Dashboard description changes

- [ ] **Step 1: Exercise realistic states**

Run the development UI with representative seven-day calls, errors, online/offline servers, users, and one recent failure. Check:

- all-zero usage;
- one-day spike;
- errors close to calls;
- long server/tool/user names;
- no recent failures.

- [ ] **Step 2: Inspect four viewport/theme combinations**

Verify desktop light, desktop dark, mobile light, and mobile dark. Confirm the chart no longer dominates the page and no label or tooltip overflows.

- [ ] **Step 3: Verify input accessibility**

Use Tab to focus the chart, left/right arrows to move across days, and touch/pointer selection at narrow width. Confirm selected values are announced without exposing hidden duplicate text.

- [ ] **Step 4: Refresh the Dashboard screenshot**

Capture the production-shaped desktop state into `docs/images/dashboard.png`, preserving the current README image path.

- [ ] **Step 5: Update the user guide**

Describe the three-tier overview and compact seven-day call/error trend. Do not describe removed visual details.

- [ ] **Step 6: Run final integrated verification**

Run:

```bash
pnpm exec jest tests/frontend/usageChart.test.ts tests/frontend/serverLocales.test.ts --runInBand
pnpm test -- --runInBand --silent
pnpm run lint
pnpm run build
git diff --check
```

Expected: all tests PASS; lint, build, and diff check exit 0.

# Income Management Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an independent income management workspace for viewing, editing, and correcting income records.

**Architecture:** Reuse the existing `IncomeRecord` API and domain helpers. Add a new React page at `/income`, add the navigation item, and keep Dashboard as a summary/shortcut surface.

**Tech Stack:** React, TypeScript, Vitest, Recharts, existing Worker income-record APIs.

---

## File Structure

- Modify `modules/web-app/src/components/Layout.tsx`: add the income navigation item.
- Modify `modules/web-app/src/App.tsx`: route `/income` to the new page.
- Create `modules/web-app/src/pages/IncomeManagementPage.tsx`: page state, summaries, chart, table, modal form.
- Create `modules/web-app/src/pages/IncomeManagementPage.css`: compact financial-workbench styling.
- Create `modules/web-app/src/pages/IncomeManagementPage.test.tsx`: page rendering and CRUD tests.
- Modify `modules/web-app/src/App.test.tsx`: assert the main navigation exposes income management.
- Modify `modules/web-app/src/pages/DashboardPage.tsx`: add a weak link to `/income`.
- Modify `modules/web-app/src/pages/DashboardPage.test.tsx`: assert Dashboard exposes the income management link.

## Task 1: Navigation and Route

**Files:**
- Modify: `modules/web-app/src/components/Layout.tsx`
- Modify: `modules/web-app/src/App.tsx`
- Modify: `modules/web-app/src/App.test.tsx`

- [ ] **Step 1: Write failing tests**

Assert:

```ts
expect(screen.getByRole('link', { name: '收入管理' }).getAttribute('href')).toBe('/income')
```

- [ ] **Step 2: Run test to verify red**

Run: `npm run test:app -- modules/web-app/src/App.test.tsx`

Expected: FAIL because the navigation item does not exist.

- [ ] **Step 3: Implement route and navigation**

Add a `/income` route and a nav item with a simple line icon.

- [ ] **Step 4: Verify green**

Run: `npm run test:app -- modules/web-app/src/App.test.tsx`

Expected: PASS.

## Task 2: Income Management Page

**Files:**
- Create: `modules/web-app/src/pages/IncomeManagementPage.tsx`
- Create: `modules/web-app/src/pages/IncomeManagementPage.css`
- Create: `modules/web-app/src/pages/IncomeManagementPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Assert:

```ts
expect(await screen.findByRole('heading', { name: '收入管理' })).toBeTruthy()
expect(screen.getByText('本月收入')).toBeTruthy()
expect(screen.getByText('工资')).toBeTruthy()
expect(screen.getByRole('button', { name: '编辑 2026-07-05 工资' })).toBeTruthy()
```

Also assert create, update, and delete call `createIncomeRecord`, `updateIncomeRecord`, and `deleteIncomeRecord`.

- [ ] **Step 2: Run test to verify red**

Run: `npm run test:app -- modules/web-app/src/pages/IncomeManagementPage.test.tsx`

Expected: FAIL because the page does not exist yet.

- [ ] **Step 3: Implement minimal page**

Load records, compute current-month total, last-three-month total, record count, primary category, category totals, and monthly chart data. Add modal form and table actions.

- [ ] **Step 4: Verify green**

Run: `npm run test:app -- modules/web-app/src/pages/IncomeManagementPage.test.tsx`

Expected: PASS.

## Task 3: Dashboard Link

**Files:**
- Modify: `modules/web-app/src/pages/DashboardPage.tsx`
- Modify: `modules/web-app/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: Write failing test**

Assert Dashboard includes:

```ts
expect(screen.getByRole('link', { name: '收入管理' }).getAttribute('href')).toBe('/income')
```

- [ ] **Step 2: Run test to verify red**

Run: `npm run test:app -- modules/web-app/src/pages/DashboardPage.test.tsx`

Expected: FAIL because Dashboard has no income management link yet.

- [ ] **Step 3: Implement link**

Add a weak link in the income summary actions.

- [ ] **Step 4: Verify green**

Run: `npm run test:app -- modules/web-app/src/pages/DashboardPage.test.tsx`

Expected: PASS.

## Task 4: Full Verification

**Files:**
- No direct edits unless checks reveal a bug.

- [ ] **Step 1: Run all tests**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: PASS. Existing Vite chunk-size warning is acceptable.

- [ ] **Step 3: Local smoke**

Use the existing local dev stack or start `npm run dev:all`. Confirm:

- `/income` renders when authenticated shell is available.
- `GET /api/income-records` remains protected and returns 401 when unauthenticated.

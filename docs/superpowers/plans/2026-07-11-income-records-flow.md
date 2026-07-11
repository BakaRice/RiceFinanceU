# Income Records Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monthly-income-only feature with independent income records that aggregate into the existing asset trend analysis.

**Architecture:** Store `incomeRecords` beside assets and snapshots in the same ledger JSON while keeping income as a flow metric. Preserve old `monthlyIncomes` as a compatibility input, migrate it into records, and make the PC dashboard consume only the new income-record APIs.

**Tech Stack:** React, TypeScript, Vitest, Recharts, Cloudflare Worker, Node test runner.

---

## File Structure

- Modify `modules/web-app/src/types/finance.ts`: add `IncomeCategory` and `IncomeRecord`, keep `MonthlyIncome` as legacy compatibility.
- Modify `modules/web-app/src/domain/income.ts`: aggregate `IncomeRecord[]` by trend scale and migrate legacy monthly records.
- Modify `modules/web-app/src/domain/income.test.ts`: drive the new domain API first.
- Modify `modules/web-app/src/api/client.ts`: add `/income-records` client methods while leaving legacy monthly methods available.
- Modify `modules/worker-api/index.js`: normalize, validate, migrate, import/export, and route `/api/income-records`.
- Modify `modules/worker-api/worker.test.mjs`: cover CRUD, validation, sorting, and legacy import migration.
- Modify `modules/web-app/src/pages/DashboardPage.tsx`: replace monthly-income state/form/UI with income-record state/form/UI.
- Modify `modules/web-app/src/pages/DashboardPage.css`: keep the compact UI consistent with the refreshed workbench.
- Modify `modules/web-app/src/pages/DashboardPage.test.tsx`: assert new labels and API calls.
- Modify `modules/web-app/src/pages/DataManagementPage.tsx`: validate `incomeRecords` and update copy.
- Modify `modules/web-app/src/pages/DataManagementPage.test.tsx`: cover the new pre-validation rules.

## Task 1: Domain Model

**Files:**
- Modify: `modules/web-app/src/types/finance.ts`
- Modify: `modules/web-app/src/domain/income.ts`
- Test: `modules/web-app/src/domain/income.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that:

```ts
expect(calculateIncomeRecordTotal(records)).toBe(14800.34)
expect(buildIncomeSeriesByScale(records, 'month').get('2026-07')).toBe(14800.34)
expect(buildIncomeSeriesByScale(records, 'quarter').get('2026-Q3')).toBe(14800.34)
expect(buildIncomeSeriesByScale(records, 'year').get('2026')).toBe(14800.34)
expect(migrateMonthlyIncomesToIncomeRecords(legacy)[0]).toMatchObject({
  occurredAt: '2026-07-01',
  category: 'salary',
  amount: 12000,
})
```

- [ ] **Step 2: Verify red**

Run: `npm run test:app -- modules/web-app/src/domain/income.test.ts`

Expected: FAIL because `IncomeRecord` helpers do not exist yet.

- [ ] **Step 3: Implement minimal domain changes**

Add `IncomeCategory`, `IncomeRecord`, `incomeRecords?: IncomeRecord[]`, category labels, record total, scale aggregation, and legacy migration.

- [ ] **Step 4: Verify green**

Run: `npm run test:app -- modules/web-app/src/domain/income.test.ts`

Expected: PASS.

## Task 2: Worker API and Storage

**Files:**
- Modify: `modules/worker-api/index.js`
- Test: `modules/worker-api/worker.test.mjs`

- [ ] **Step 1: Write failing tests**

Add Worker tests for:

```js
GET /api/income-records
POST /api/income-records
PATCH /api/income-records/:id
DELETE /api/income-records/:id
```

Also test invalid category, invalid date, negative amount, old `monthlyIncomes` import migration, and export containing `incomeRecords`.

- [ ] **Step 2: Verify red**

Run: `npm run worker:test`

Expected: FAIL with missing `/api/income-records` route.

- [ ] **Step 3: Implement minimal Worker changes**

Add default `incomeRecords: []`, sanitize income records, migrate legacy monthly records when normalizing/importing, add route handler, and keep old `/monthly-incomes` route intact.

- [ ] **Step 4: Verify green**

Run: `npm run worker:test`

Expected: PASS.

## Task 3: Data Management Compatibility

**Files:**
- Modify: `modules/web-app/src/pages/DataManagementPage.tsx`
- Test: `modules/web-app/src/pages/DataManagementPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Assert malformed `incomeRecords` are reported and missing `incomeRecords` remains compatible.

- [ ] **Step 2: Verify red**

Run: `npm run test:app -- modules/web-app/src/pages/DataManagementPage.test.tsx`

Expected: FAIL because pre-validation only checks `monthlyIncomes`.

- [ ] **Step 3: Implement pre-validation and copy updates**

Validate `incomeRecords`, keep old `monthlyIncomes` compatible, and update labels from monthly income to income records.

- [ ] **Step 4: Verify green**

Run: `npm run test:app -- modules/web-app/src/pages/DataManagementPage.test.tsx`

Expected: PASS.

## Task 4: Dashboard UI and Chart

**Files:**
- Modify: `modules/web-app/src/api/client.ts`
- Modify: `modules/web-app/src/pages/DashboardPage.tsx`
- Modify: `modules/web-app/src/pages/DashboardPage.css`
- Test: `modules/web-app/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Assert Dashboard loads `getIncomeRecords`, shows “收入流入”, creates a single income record, and displays the trend line label for monthly scale.

- [ ] **Step 2: Verify red**

Run: `npm run test:app -- modules/web-app/src/pages/DashboardPage.test.tsx`

Expected: FAIL because Dashboard still calls monthly-income APIs and uses old labels.

- [ ] **Step 3: Implement Dashboard changes**

Replace monthly-income state and form with record-based state, add category selector/source/date fields, aggregate records for summary, and keep the chart right-axis income line.

- [ ] **Step 4: Verify green**

Run: `npm run test:app -- modules/web-app/src/pages/DashboardPage.test.tsx`

Expected: PASS.

## Task 5: Full Verification and Local Smoke

**Files:**
- No direct edits unless verification reveals a bug.

- [ ] **Step 1: Run full automated checks**

Run:

```bash
npm run test
npm run build
```

Expected: both pass. The Vite chunk-size warning is acceptable if it matches existing behavior.

- [ ] **Step 2: Start local stack**

Run: `npm run dev:all`

Expected:

- Vite serves `http://localhost:5173`.
- Worker serves `http://localhost:8787`.

- [ ] **Step 3: Smoke test API**

Call unauthenticated `/api/income-records`.

Expected: `401 请先登录`, confirming the new route exists behind auth.

- [ ] **Step 4: Smoke test browser**

Open the local app, confirm the login page renders, and inspect that the app bundle has no runtime crash at startup.

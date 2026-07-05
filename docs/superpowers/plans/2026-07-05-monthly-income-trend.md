# Monthly Income Trend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local monthly income records and show income as a monthly/quarterly/yearly trend alongside total assets.

**Architecture:** Keep income as a separate flow entity, not a snapshot value. The Worker stores `monthlyIncomes` in the same normalized KV JSON document, while the web app adds pure income helpers and merges income into dashboard chart data.

**Tech Stack:** React, TypeScript, Vitest, Recharts, Cloudflare Worker, Node test runner.

---

## File Map

- Create `modules/web-app/src/domain/income.ts`: pure income total, validation, period aggregation helpers.
- Create `modules/web-app/src/domain/income.test.ts`: unit tests for income totals and scale aggregation.
- Modify `modules/web-app/src/types/finance.ts`: add `MonthlyIncome` and include it in `ExportData`.
- Modify `modules/web-app/src/api/client.ts`: add monthly income API methods.
- Modify `modules/web-app/src/pages/DashboardPage.tsx`: load income records, add form, summary, and chart line.
- Modify `modules/web-app/src/pages/DashboardPage.css`: compact finance-style income panel and modal styles.
- Modify `modules/web-app/src/pages/DashboardPage.test.tsx`: mock income API, verify line visibility by scale and form entry.
- Modify `modules/web-app/src/pages/DataManagementPage.tsx`: pre-validate optional `monthlyIncomes`.
- Modify `modules/worker-api/index.js`: normalize, validate, persist, import/export, and route monthly incomes.
- Modify `modules/worker-api/worker.test.mjs`: API and import/export coverage.

## Task 1: Income Domain Helpers

- [ ] **Step 1: Write failing tests** in `modules/web-app/src/domain/income.test.ts` for:
  - `calculateMonthlyIncomeTotal` sums salary, extra income, housing fund, and other income.
  - `buildIncomeSeriesByScale` returns month totals for `month`, quarter sums for `quarter`, year sums for `year`, and empty maps for `day`/`week`.

- [ ] **Step 2: Run red test**

Run: `npm run test:app -- modules/web-app/src/domain/income.test.ts`

Expected: fail because `./income` does not exist.

- [ ] **Step 3: Implement helpers** in `modules/web-app/src/domain/income.ts` and add `MonthlyIncome` to `finance.ts`.

- [ ] **Step 4: Run green test**

Run: `npm run test:app -- modules/web-app/src/domain/income.test.ts`

Expected: pass.

## Task 2: Worker Monthly Income API

- [ ] **Step 1: Write failing Worker tests** in `modules/worker-api/worker.test.mjs` for:
  - create/list/update/delete monthly income records.
  - duplicate months return `400`.
  - invalid month or negative amounts return `400`.
  - export includes `monthlyIncomes`.
  - old imports normalize missing `monthlyIncomes` to `[]`.

- [ ] **Step 2: Run red Worker test**

Run: `npm run worker:test`

Expected: fail because `/api/monthly-incomes` is not routed.

- [ ] **Step 3: Implement Worker support** in `modules/worker-api/index.js`:
  - add `monthlyIncomes` to default and normalized data.
  - add `sanitizeMonthlyIncomeInput`.
  - add `handleMonthlyIncomes`.
  - preserve income records in import/export.

- [ ] **Step 4: Run green Worker test**

Run: `npm run worker:test`

Expected: pass.

## Task 3: Web API and Dashboard UI

- [ ] **Step 1: Write failing dashboard tests** in `modules/web-app/src/pages/DashboardPage.test.tsx`:
  - monthly scale renders an `incomeAmount` line.
  - day scale hides the income line.
  - creating current-month income calls `api.createMonthlyIncome`.

- [ ] **Step 2: Run red dashboard test**

Run: `npm run test:app -- modules/web-app/src/pages/DashboardPage.test.tsx`

Expected: fail because income API and line are missing.

- [ ] **Step 3: Implement web app support**:
  - add API client methods.
  - load `monthlyIncomes` in `DashboardPage`.
  - add a compact month income panel and modal.
  - merge income values into chart data for `month`/`quarter`/`year`.
  - add right-side Y axis for the income line.

- [ ] **Step 4: Run green dashboard test**

Run: `npm run test:app -- modules/web-app/src/pages/DashboardPage.test.tsx`

Expected: pass.

## Task 4: Data Management and Full Verification

- [ ] **Step 1: Update import pre-validation** in `DataManagementPage.tsx` so missing `monthlyIncomes` is OK and malformed income records show issues.

- [ ] **Step 2: Run app tests**

Run: `npm run test:app`

Expected: all tests pass.

- [ ] **Step 3: Run Worker tests**

Run: `npm run worker:test`

Expected: all tests pass.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 5: Run local app**

Run: `npm run dev:all`

Expected: Vite serves `http://localhost:5173` and Worker serves API on port `8787`.

- [ ] **Step 6: Browser smoke test**

Open `http://localhost:5173`, verify the dashboard renders and the monthly income panel/chart controls are present.

# DCA Backup Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve valid DCA plans in backups while rejecting any import that would silently discard invalid DCA data.

**Architecture:** Keep `Asset.dcaPlan` nested in asset master data and retain schema v1/v2 compatibility. Mirror a small strict DCA import validator in the React preflight and Worker boundary; the Worker remains authoritative, while the UI reports counts and actionable errors before submission.

**Tech Stack:** React 19, TypeScript, Vitest, Cloudflare Worker JavaScript, Node test runner.

---

### Task 1: Frontend DCA backup preflight

**Files:**
- Modify: `modules/web-app/src/pages/DataManagementPage.tsx`
- Test: `modules/web-app/src/pages/DataManagementPage.test.tsx`

- [ ] **Step 1: Write failing preflight tests**

Add cases that expect `preValidate()` to return `dcaPlanCount: 1` for a valid investment plan, accept a backup without `dcaPlan`, and report critical issues for a balance asset plan, invalid frequency, zero contribution, invalid optional target fields, and invalid daily `excludeWeekends`.

- [ ] **Step 2: Run the focused frontend test and verify RED**

Run: `npm run test:app -- --run modules/web-app/src/pages/DataManagementPage.test.tsx`

Expected: FAIL because `dcaPlanCount` and DCA validation issues do not exist.

- [ ] **Step 3: Add strict frontend validation**

Add `dcaPlanCount` to `ImportSummary`, define the valid DCA frequencies, and add a local helper with this contract:

```ts
function validateImportedDcaPlan(assetType: unknown, plan: unknown): string | null
```

Return `null` when the field is absent or valid. Return a Chinese reason when the plan would be removed or partially discarded by the Worker. Count present valid plans and add asset-scoped issues such as `资产[0] "指数基金": 定投计划的每期投入金额必须大于 0`. Include invalid DCA plans in `hasCriticalIssues`.

- [ ] **Step 4: Run the focused frontend test and verify GREEN**

Run: `npm run test:app -- --run modules/web-app/src/pages/DataManagementPage.test.tsx`

Expected: PASS.

### Task 2: Worker atomic rejection

**Files:**
- Modify: `modules/worker-api/index.js`
- Test: `modules/worker-api/worker.test.mjs`

- [ ] **Step 1: Write failing Worker tests**

Add table-driven import cases for a cash asset carrying `dcaPlan`, invalid frequency, zero `plannedContribution`, invalid `targetAmount`, invalid `targetDate`, invalid `toleranceRate`, and invalid `excludeWeekends`. Each case must expect HTTP 400 and then export the original seeded asset to prove the failed import did not replace KV data. Retain the existing valid round-trip test and add an old-backup-without-plan success assertion if needed.

- [ ] **Step 2: Run focused Worker tests and verify RED**

Run: `node --test --test-name-pattern='定投计划|DCA' modules/worker-api/worker.test.mjs`

Expected: FAIL because malformed plans currently return 200 and are silently deleted or trimmed.

- [ ] **Step 3: Add authoritative Worker validation**

Add a mirrored helper:

```js
function validateImportedDcaPlan(type, plan) // returns an English reason or ''
```

Before constructing `imported`, loop over `body.assets`. If a present plan is invalid, return `badRequest('Invalid backup: assets[index].dcaPlan ...')`. Keep `sanitizeDcaPlan()` for normalization only after the complete backup passes validation, so KV replacement remains atomic.

- [ ] **Step 4: Run focused Worker tests and verify GREEN**

Run: `node --test --test-name-pattern='定投计划|DCA' modules/worker-api/worker.test.mjs`

Expected: PASS.

### Task 3: Data Management visibility and import guard

**Files:**
- Modify: `modules/web-app/src/pages/DataManagementPage.tsx`
- Test: `modules/web-app/src/pages/DataManagementPage.test.tsx`

- [ ] **Step 1: Write failing UI assertions**

Render the page inside `FeedbackProvider`; assert the backup description mentions `定投计划`. For an uploaded backup with a valid plan, assert the confirmation summary shows `定投计划: 1`. For an invalid plan, assert the confirm button is disabled.

- [ ] **Step 2: Run the page test and verify RED**

Run: `npm run test:app -- --run modules/web-app/src/pages/DataManagementPage.test.tsx`

Expected: FAIL because the page neither describes nor displays DCA backup information and does not disable confirmation.

- [ ] **Step 3: Update the UI**

Change the description to include定投计划, append `定投计划: {importSummary.dcaPlanCount}` to the summary, and set `disabled={importing || importSummary.hasCriticalIssues}` on the confirmation button. Keep the detailed issue list visible so the user can repair the backup.

- [ ] **Step 4: Run the page test and verify GREEN**

Run: `npm run test:app -- --run modules/web-app/src/pages/DataManagementPage.test.tsx`

Expected: PASS.

### Task 4: Full verification

**Files:**
- Verify all modified files and preserve unrelated `modules/miniprogram-app/project.config.json` changes.

- [ ] **Step 1: Run all tests**

Run: `npm run test`

Expected: all Vitest and Worker tests pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite build exit successfully.

- [ ] **Step 3: Check the final diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only the planned files plus the user-owned `modules/miniprogram-app/project.config.json` are modified.

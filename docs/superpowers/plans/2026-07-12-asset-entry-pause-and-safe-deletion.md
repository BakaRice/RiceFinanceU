# Asset Entry Pause and Safe Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ambiguous active/inactive asset state with normal/paused entry participation, add history-safe permanent deletion with two confirmations, deploy it, and delete the one verified unused gold asset.

**Architecture:** The Worker owns canonical normalization, validation, migration, and deletion safety. Web and miniprogram clients treat `entryStatus` only as an entry-participation flag: paused assets are omitted from entry and DCA workbenches but remain in totals and history. Existing `isActive` is accepted only while normalizing old stored data or imports.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, Cloudflare Workers, KV, Node test runner, WeChat miniprogram JavaScript tests, Wrangler 4.

---

## File map

- `modules/worker-api/index.js`: normalize legacy assets, validate status updates and snapshot submissions, and enforce hard-delete invariants.
- `modules/worker-api/worker.test.mjs`: prove migration, pause behavior, and permanent deletion safety.
- `modules/web-app/src/types/finance.ts`: expose `AssetEntryStatus` and replace `isActive` on `Asset`.
- `modules/web-app/src/domain/assets.ts`: centralize entry-status helpers.
- `modules/web-app/src/domain/assets.test.ts`: prove legacy-compatible status helpers.
- `modules/web-app/src/components/SnapshotForm.tsx`: show only normal-entry assets.
- `modules/web-app/src/components/SnapshotForm.test.tsx`: prove paused assets are omitted.
- `modules/web-app/src/pages/DashboardPage.tsx`: stop excluding paused assets from totals and trends.
- `modules/web-app/src/pages/DashboardPage.test.tsx`: prove paused assets remain in totals.
- `modules/web-app/src/pages/DcaManagementPage.tsx`: omit paused plans.
- `modules/web-app/src/pages/DcaManagementPage.test.tsx`: prove paused plans are omitted.
- `modules/web-app/src/api/client.ts`: send `confirmName` with permanent delete.
- `modules/web-app/src/pages/AssetsPage.tsx`: edit entry status and provide the two-step typed-name deletion flow.
- `modules/web-app/src/pages/AssetsPage.test.tsx`: prove pause/resume and deletion confirmation behavior.
- `modules/web-app/src/pages/AssetDetailPage.tsx`: replace deactivation with pause/resume and safe delete.
- `modules/web-app/src/pages/AssetDetailPage.test.tsx`: prove detail-page lifecycle actions.
- `modules/web-app/src/pages/DataManagementPage.tsx`: validate new status while accepting legacy imports.
- `modules/web-app/src/pages/DataManagementPage.test.tsx`: prove import compatibility.
- `modules/miniprogram-app/pages/assets/assets.js`: expose normal/paused state and two-step deletion.
- `modules/miniprogram-app/pages/assets/assets.wxml`: update status labels and actions.
- `modules/miniprogram-app/pages/entry/entry.js`: omit paused assets from entry.
- `modules/miniprogram-app/pages/index/index.js`: include paused assets in totals.
- `modules/miniprogram-app/utils/api.js`: send deletion confirmation name.
- Relevant miniprogram `*.test.mjs` files: prove lifecycle behavior and API payloads.

The worktree already contains unrelated and overlapping user changes, especially in Dashboard and income files. Preserve them, edit only lifecycle-specific lines, and do not create implementation commits that would capture unrelated hunks.

### Task 1: Worker-owned lifecycle and migration

**Files:**
- Modify: `modules/worker-api/worker.test.mjs`
- Modify: `modules/worker-api/index.js`

- [ ] **Step 1: Write failing Worker tests**

Add tests with these exact behaviors:

```js
test('旧 isActive 资产会迁移为 entryStatus', async () => {
  // import an old backup containing true and false isActive values
  // assert exported assets contain normal and paused entryStatus values
})

test('暂停录入资产不能被显式提交，但会沿用上一份快照值', async () => {
  // create and record an asset, PATCH it to paused
  // explicit submission returns 400; a new snapshot for another asset carries it forward
})

test('只有无历史且名称确认匹配的资产可以永久删除', async () => {
  // wrong confirmName => 400 and unchanged
  // referenced asset => 409 ASSET_HAS_SNAPSHOT_HISTORY and unchanged
  // unreferenced asset => 200 and removed from GET /assets
})
```

- [ ] **Step 2: Run Worker tests and verify RED**

Run: `npm run worker:test`

Expected: the new assertions fail because assets still expose `isActive`, paused status is unknown, and DELETE still performs a soft delete.

- [ ] **Step 3: Implement canonical normalization and API rules**

Add canonical helpers near the existing asset sanitizers:

```js
const VALID_ASSET_ENTRY_STATUSES = ['normal', 'paused']

function normalizeAssetEntryStatus(asset) {
  if (VALID_ASSET_ENTRY_STATUSES.includes(asset?.entryStatus)) return asset.entryStatus
  return asset?.isActive === false ? 'paused' : 'normal'
}

function normalizeAsset(asset) {
  const { isActive: _legacyIsActive, ...rest } = asset
  return { ...rest, entryStatus: normalizeAssetEntryStatus(asset) }
}
```

Use `normalizeAsset` inside `normalizeData`, default new assets to `normal`, validate PATCH status, reject explicit snapshot values for paused assets, and replace DELETE soft deletion with:

```js
const body = await readJsonBody(request)
if (body?.confirmName !== asset.name) return badRequest('confirmName must exactly match asset name')
if (data.snapshotValues.some((value) => value.assetId === id)) {
  return json({
    error: '该资产已有历史快照，只能暂停录入',
    code: 'ASSET_HAS_SNAPSHOT_HISTORY',
  }, { status: 409 })
}
data.assets.splice(assetIndex, 1)
```

- [ ] **Step 4: Run Worker tests and verify GREEN**

Run: `npm run worker:test`

Expected: all Worker tests pass with no failures.

### Task 2: Web domain, entry, totals, and DCA behavior

**Files:**
- Modify: `modules/web-app/src/types/finance.ts`
- Modify: `modules/web-app/src/domain/assets.ts`
- Modify: `modules/web-app/src/domain/assets.test.ts`
- Modify: `modules/web-app/src/components/SnapshotForm.tsx`
- Modify: `modules/web-app/src/components/SnapshotForm.test.tsx`
- Modify: `modules/web-app/src/pages/DashboardPage.tsx`
- Modify: `modules/web-app/src/pages/DashboardPage.test.tsx`
- Modify: `modules/web-app/src/pages/DcaManagementPage.tsx`
- Modify: `modules/web-app/src/pages/DcaManagementPage.test.tsx`

- [ ] **Step 1: Write failing domain and page tests**

Define wished-for helpers in tests:

```ts
expect(isAssetEntryNormal({ entryStatus: 'normal' } as Asset)).toBe(true)
expect(isAssetEntryNormal({ entryStatus: 'paused' } as Asset)).toBe(false)
```

Add page assertions that a paused asset is absent from SnapshotForm and DCA management, while Dashboard total and allocation still include its latest value.

- [ ] **Step 2: Run targeted tests and verify RED**

Run:

```bash
npm run test:app -- modules/web-app/src/domain/assets.test.ts modules/web-app/src/components/SnapshotForm.test.tsx modules/web-app/src/pages/DashboardPage.test.tsx modules/web-app/src/pages/DcaManagementPage.test.tsx
```

Expected: failures reference missing `entryStatus` helpers and paused filtering.

- [ ] **Step 3: Implement the minimal web domain changes**

Define:

```ts
export type AssetEntryStatus = 'normal' | 'paused'

export function isAssetEntryNormal(asset: Pick<Asset, 'entryStatus'>): boolean {
  return asset.entryStatus === 'normal'
}
```

Replace entry and DCA `isActive` filters with `isAssetEntryNormal`. Remove Dashboard filters that exclude assets by entry status so all returned assets participate in totals, allocation, comparison, and trend series.

- [ ] **Step 4: Run targeted tests and verify GREEN**

Run the command from Step 2.

Expected: all targeted tests pass.

### Task 3: Web asset management and typed-name deletion

**Files:**
- Modify: `modules/web-app/src/api/client.ts`
- Modify: `modules/web-app/src/pages/AssetsPage.tsx`
- Modify: `modules/web-app/src/pages/AssetsPage.css`
- Modify: `modules/web-app/src/pages/AssetsPage.test.tsx`

- [ ] **Step 1: Write failing AssetsPage tests**

Add tests that:

```ts
// changing 状态 to paused calls PATCH with entryStatus: 'paused'
// paused rows render 暂停录入 and can be restored
// first delete confirmation does not call the API
// second dialog keeps 永久删除 disabled until the exact asset name is entered
// exact name calls api.deleteAsset(id, name)
// a 409 error is rendered as 该资产已有历史快照，只能暂停录入
```

- [ ] **Step 2: Run AssetsPage tests and verify RED**

Run: `npm run test:app -- modules/web-app/src/pages/AssetsPage.test.tsx`

Expected: failures reference old active/inactive values, old one-step deactivation, and the missing typed-name dialog.

- [ ] **Step 3: Implement status editing and two confirmations**

Update API signature:

```ts
deleteAsset: (id: string, confirmName: string) =>
  request<{ success: boolean }>(`/assets/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ confirmName }),
  })
```

Use `entryStatus` in drafts and the status select. Keep the existing feedback confirmation as step one. Add page state for the second dialog:

```ts
const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null)
const [deleteConfirmation, setDeleteConfirmation] = useState('')
```

Render an accessible modal with an exact-name input and a disabled destructive button until `deleteConfirmation === deleteTarget.name`.

- [ ] **Step 4: Run AssetsPage tests and verify GREEN**

Run: `npm run test:app -- modules/web-app/src/pages/AssetsPage.test.tsx`

Expected: all AssetsPage tests pass.

### Task 4: Asset detail and import compatibility

**Files:**
- Modify: `modules/web-app/src/pages/AssetDetailPage.tsx`
- Modify: `modules/web-app/src/pages/AssetDetailPage.test.tsx`
- Modify: `modules/web-app/src/pages/DataManagementPage.tsx`
- Modify: `modules/web-app/src/pages/DataManagementPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Add detail-page tests for pause/resume and typed-name deletion. Add import tests proving `{ isActive: false }` is accepted as paused and an invalid `entryStatus` is reported.

- [ ] **Step 2: Run targeted tests and verify RED**

Run:

```bash
npm run test:app -- modules/web-app/src/pages/AssetDetailPage.test.tsx modules/web-app/src/pages/DataManagementPage.test.tsx
```

Expected: old “停用” UI and `isActive` validation cause failures.

- [ ] **Step 3: Implement detail lifecycle and import validation**

Use the same labels and API calls as AssetsPage. Validate `entryStatus` when present; accept legacy boolean `isActive` only when `entryStatus` is absent.

- [ ] **Step 4: Run targeted tests and verify GREEN**

Run the command from Step 2.

Expected: all targeted tests pass.

### Task 5: Miniprogram lifecycle parity

**Files:**
- Modify: `modules/miniprogram-app/pages/assets/assets.js`
- Modify: `modules/miniprogram-app/pages/assets/assets.wxml`
- Create: `modules/miniprogram-app/pages/assets/assets.test.mjs`
- Modify: `modules/miniprogram-app/pages/entry/entry.js`
- Modify: `modules/miniprogram-app/pages/index/index.js`
- Modify: `modules/miniprogram-app/utils/api.js`
- Modify: relevant `modules/miniprogram-app/**/*.test.mjs`

- [ ] **Step 1: Write failing miniprogram tests**

Assert that paused assets are omitted from entry, included in dashboard total calculations, status actions PATCH `entryStatus`, and DELETE sends `{ confirmName }` only after two confirmations.

- [ ] **Step 2: Run miniprogram tests and verify RED**

Run: `npm run mini:test`

Expected: tests fail because miniprogram code still filters and mutates `isActive` and DELETE has no confirmation payload.

- [ ] **Step 3: Implement miniprogram parity**

Replace `isActive` checks with `entryStatus === 'normal'` only in entry and DCA-like action surfaces. Keep all assets in dashboard totals. Update asset status labels/actions and API payload. Use `wx.showModal` for the first warning, then a second `wx.showModal` with `editable: true` for exact-name confirmation.

- [ ] **Step 4: Run miniprogram tests and verify GREEN**

Run: `npm run mini:test`

Expected: all miniprogram tests pass.

### Task 6: Full verification, deployment, and verified cleanup

**Files:**
- Verify all modified files
- No direct KV mutation

- [ ] **Step 1: Run complete local verification**

Run:

```bash
npm run test
npm run mini:test
npm run build
git diff --check
```

Expected: all commands exit 0. The Vite chunk-size advisory may remain; no test or build failure is allowed.

- [ ] **Step 2: Deploy through the canonical script**

Run: `npm run deploy`

Expected: Wrangler reports a successful deployment of Worker and static assets.

- [ ] **Step 3: Verify live health**

Run: `curl -fsS https://ricefinanceu.ricemarch-finance.workers.dev/api/health`

Expected: `{"status":"ok","storage":"kv"}`.

- [ ] **Step 4: Permanently delete only the verified unused gold asset**

Authenticate through the deployed API, then call:

```http
DELETE /api/assets/b931c351-9db0-4567-9223-9c63daf5094f
Content-Type: application/json

{"confirmName":"黄金"}
```

Do not issue the request if a fresh pre-delete check reports any snapshot reference for that ID.

- [ ] **Step 5: Verify deletion and protected history**

Read remote KV or authenticated API data and assert:

```text
b931c351-9db0-4567-9223-9c63daf5094f is absent
062d37b9-7925-4229-89a5-6a746bdf9d1d is present
the retained gold still has 7 snapshot values
```

Expected: only the unused legacy gold is gone.

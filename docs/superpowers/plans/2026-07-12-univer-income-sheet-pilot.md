# Univer Income Sheet Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the income page's hand-built editable table with a constrained Univer worksheet that supports spreadsheet-grade batch editing and atomically persists one validated change set.

**Architecture:** Keep `IncomeRecord` and the existing Worker/KV document as the source of truth. A pure `incomeSheetAdapter` projects records into stable worksheet rows and derives create/update/delete changes; `IncomeSheet` owns the Univer lifecycle and interaction surface; `IncomeManagementPage` only loads, saves, and reports feedback. Add one Worker batch endpoint that validates every operation before a single KV write.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest/Testing Library, Univer Sheets OSS presets, Cloudflare Worker, Node test runner.

---

## File map

- Create `modules/web-app/src/pages/incomeSheetAdapter.ts`: pure row projection, validation, diffing, and batch payload construction.
- Create `modules/web-app/src/pages/incomeSheetAdapter.test.ts`: adapter behavior and identity tests.
- Create `modules/web-app/src/components/IncomeSheet.tsx`: Univer instance lifecycle and a small imperative API for save/discard/error focus.
- Create `modules/web-app/src/components/IncomeSheet.css`: constrained workbench sizing and theme integration.
- Create `modules/web-app/src/components/IncomeSheet.test.tsx`: mock-boundary tests for component events without pretending jsdom can exercise Canvas.
- Modify `modules/web-app/src/pages/IncomeManagementPage.tsx`: replace native table/filter state with `IncomeSheet` and one batch save call.
- Modify `modules/web-app/src/pages/IncomeManagementPage.test.tsx`: assert page orchestration through the component boundary.
- Modify `modules/web-app/src/api/client.ts`: add typed batch request/response methods.
- Modify `modules/worker-api/index.js`: add atomic `POST /income-records/batch` handling before the `/:id` branch.
- Modify `modules/worker-api/worker.test.mjs`: verify success and all-or-nothing failures.
- Modify `package.json` and `package-lock.json`: add aligned Univer OSS packages.

### Task 1: Add atomic Worker batch persistence

**Files:**
- Modify: `modules/worker-api/index.js`
- Test: `modules/worker-api/worker.test.mjs`

- [ ] **Step 1: Write a failing success-path Worker test**

Add a test that creates two seed records, then posts one create, one update, and one delete in one request:

```js
test('收入批量接口会一次应用新增修改删除', async () => {
  const env = createEnv()
  const token = await login(env)
  const first = await createIncomeRecord(env, token, {
    occurredAt: '2026-07-01', category: 'salary', amount: 10000,
  })
  const second = await createIncomeRecord(env, token, {
    occurredAt: '2026-07-02', category: 'bonus', amount: 1000,
  })

  const response = await authedRequest(env, '/api/income-records/batch', {
    token,
    method: 'POST',
    body: JSON.stringify({
      creates: [{ occurredAt: '2026-07-03', category: 'side_income', amount: 500 }],
      updates: [{ id: first.id, occurredAt: '2026-07-01', category: 'salary', amount: 12000 }],
      deletes: [second.id],
    }),
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.records.length, 2)
  assert.equal(body.records.find((record) => record.id === first.id).amount, 12000)
  assert.equal(body.records.some((record) => record.id === second.id), false)
  assert.equal(body.records.some((record) => record.amount === 500), true)
})
```

- [ ] **Step 2: Run the targeted Worker test and verify it fails**

Run: `npm run worker:test -- --test-name-pattern="收入批量接口"`

Expected: FAIL because `/api/income-records/batch` is treated as a record ID and returns 404.

- [ ] **Step 3: Add rejection tests before implementation**

Cover these exact cases and assert a subsequent GET returns the unchanged seed records:

```js
const invalidBodies = [
  { creates: [{ occurredAt: '2026-02-30', category: 'salary', amount: 1 }], updates: [], deletes: [] },
  { creates: [], updates: [{ id: 'missing', occurredAt: '2026-07-01', category: 'salary', amount: 1 }], deletes: [] },
  { creates: [], updates: [{ id: first.id, occurredAt: '2026-07-01', category: 'salary', amount: 1 }], deletes: [first.id] },
]
```

- [ ] **Step 4: Implement validation-first, single-write batch handling**

Add helpers that normalize the request shape and reject duplicate/conflicting IDs. Insert the batch branch before the existing `segments.length === 2` record branch:

```js
if (segments.length === 2 && segments[1] === 'batch') {
  if (request.method !== 'POST') return methodNotAllowed()
  const body = await readJsonBody(request)
  const creates = Array.isArray(body.creates) ? body.creates : null
  const updates = Array.isArray(body.updates) ? body.updates : null
  const deletes = Array.isArray(body.deletes) ? body.deletes : null
  if (!creates || !updates || !deletes) return badRequest('creates, updates and deletes must be arrays')

  const existingById = new Map(data.incomeRecords.map((record) => [record.id, record]))
  const updateIds = updates.map((item) => item?.id)
  const deleteIds = deletes
  if (new Set(updateIds).size !== updateIds.length || new Set(deleteIds).size !== deleteIds.length) {
    return badRequest('income batch contains duplicate ids')
  }
  if (updateIds.some((id) => deleteIds.includes(id))) {
    return badRequest('income batch contains conflicting operations')
  }
  if ([...updateIds, ...deleteIds].some((id) => typeof id !== 'string' || !existingById.has(id))) {
    return json({ error: 'Income record not found' }, { status: 404 })
  }

  const sanitizedCreates = []
  for (const input of creates) {
    const sanitized = sanitizeIncomeRecordInput(input)
    if (sanitized.error) return badRequest(sanitized.error)
    sanitizedCreates.push(sanitized.value)
  }
  const sanitizedUpdates = []
  for (const input of updates) {
    const existing = existingById.get(input.id)
    const sanitized = sanitizeIncomeRecordInput(input, existing)
    if (sanitized.error) return badRequest(sanitized.error)
    sanitizedUpdates.push({ id: input.id, value: sanitized.value })
  }

  const now = new Date().toISOString()
  const deleted = new Set(deleteIds)
  const updated = new Map(sanitizedUpdates.map(({ id, value }) => [id, value]))
  data.incomeRecords = data.incomeRecords
    .filter((record) => !deleted.has(record.id))
    .map((record) => updated.has(record.id)
      ? { ...record, ...updated.get(record.id), updatedAt: now }
      : record)
  data.incomeRecords.push(...sanitizedCreates.map((value) => ({
    id: createId(), ...value, createdAt: now, updatedAt: now,
  })))
  await writeData(env, data)
  return json({ records: [...data.incomeRecords].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)) })
}
```

When applying updates, explicitly delete `sourceName` and `note` if the sanitized value omits them, matching the existing PATCH behavior.

- [ ] **Step 5: Run Worker tests**

Run: `npm run worker:test`

Expected: all Worker tests PASS.

- [ ] **Step 6: Commit the Worker slice**

```bash
git add modules/worker-api/index.js modules/worker-api/worker.test.mjs
git commit -m "feat: save income changes atomically"
```

### Task 2: Build the pure income sheet adapter

**Files:**
- Create: `modules/web-app/src/pages/incomeSheetAdapter.ts`
- Test: `modules/web-app/src/pages/incomeSheetAdapter.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Define tests for projection, blank-row omission, create/update/delete diffing, sorted rows retaining IDs, copied IDs becoming creates, and cell-addressed validation:

```ts
expect(buildIncomeBatch(original, [
  { rowKey: 'salary-1', occurredAt: '2026-07-01', category: 'salary', amount: '12000', sourceName: '', note: '' },
  { rowKey: 'new:1', occurredAt: '2026-07-02', category: 'bonus', amount: '500', sourceName: '', note: '' },
])).toEqual({
  creates: [{ occurredAt: '2026-07-02', category: 'bonus', amount: 500 }],
  updates: [{ id: 'salary-1', occurredAt: '2026-07-01', category: 'salary', amount: 12000 }],
  deletes: ['removed-id'],
})

expect(() => buildIncomeBatch([], [
  { rowKey: 'new:1', occurredAt: '2026-02-30', category: 'salary', amount: '1', sourceName: '', note: '' },
])).toThrowError(expect.objectContaining({ row: 0, column: 'occurredAt' }))
```

- [ ] **Step 2: Run the adapter test and verify it fails**

Run: `npx vitest run --config modules/web-app/vite.config.ts modules/web-app/src/pages/incomeSheetAdapter.test.ts`

Expected: FAIL because the adapter module does not exist.

- [ ] **Step 3: Implement focused adapter types and functions**

Create these public types and functions:

```ts
export const INCOME_SHEET_COLUMNS = ['occurredAt', 'category', 'amount', 'sourceName', 'note'] as const
export type IncomeSheetColumn = typeof INCOME_SHEET_COLUMNS[number]

export type IncomeSheetRow = {
  rowKey: string
  occurredAt: string
  category: string
  amount: string
  sourceName: string
  note: string
}

export type IncomeBatch = {
  creates: IncomeRecordInput[]
  updates: Array<IncomeRecordInput & { id: string }>
  deletes: string[]
}

export class IncomeSheetValidationError extends Error {
  constructor(
    message: string,
    readonly row: number,
    readonly column: IncomeSheetColumn,
  ) { super(message) }
}

export function recordsToIncomeSheetRows(records: IncomeRecord[]): IncomeSheetRow[]
export function buildIncomeBatch(original: IncomeRecord[], rows: IncomeSheetRow[]): IncomeBatch
export function countIncomeChanges(original: IncomeRecord[], rows: IncomeSheetRow[]): number
```

Use `normalizeIncomeDateInput`, the current category union, two-decimal amount rounding, trimmed optional strings, and semantic payload comparison. Treat an unknown or duplicated existing `rowKey` as a new row so copied records never overwrite the source.

- [ ] **Step 4: Run adapter tests**

Run: `npx vitest run --config modules/web-app/vite.config.ts modules/web-app/src/pages/incomeSheetAdapter.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the adapter slice**

```bash
git add modules/web-app/src/pages/incomeSheetAdapter.ts modules/web-app/src/pages/incomeSheetAdapter.test.ts
git commit -m "feat: adapt income records to sheet rows"
```

### Task 3: Add the typed web API batch contract

**Files:**
- Modify: `modules/web-app/src/api/client.ts`

- [ ] **Step 1: Export the batch contract and add the client method**

```ts
export type IncomeRecordBatchInput = {
  creates: IncomeRecordInput[]
  updates: Array<IncomeRecordInput & { id: string }>
  deletes: string[]
}

saveIncomeRecords: (data: IncomeRecordBatchInput) =>
  request<{ records: IncomeRecord[] }>('/income-records/batch', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
```

- [ ] **Step 2: Run TypeScript build**

Run: `npm run build`

Expected: PASS with no type errors.

- [ ] **Step 3: Commit the API contract**

```bash
git add modules/web-app/src/api/client.ts
git commit -m "feat: add income batch client"
```

### Task 4: Install and wrap Univer

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `modules/web-app/src/components/IncomeSheet.tsx`
- Create: `modules/web-app/src/components/IncomeSheet.css`
- Test: `modules/web-app/src/components/IncomeSheet.test.tsx`

- [ ] **Step 1: Install aligned OSS presets**

Run:

```bash
npm install @univerjs/presets @univerjs/preset-sheets-core @univerjs/preset-sheets-data-validation @univerjs/preset-sheets-filter @univerjs/preset-sheets-sort
```

Expected: `package.json` and lockfile contain one aligned Univer version family with no peer dependency errors.

- [ ] **Step 2: Write the component boundary test first**

Mock the imported Univer preset/facade functions and verify that the component creates one workbook, publishes changed rows, can reset to new records, and disposes on unmount. Do not assert Canvas pixels in jsdom.

```tsx
const ref = createRef<IncomeSheetHandle>()
const onRowsChange = vi.fn()
const view = render(<IncomeSheet ref={ref} records={records} onRowsChange={onRowsChange} />)
expect(createIncomeWorkbook).toHaveBeenCalledOnce()
act(() => fakeWorkbook.emitRows(changedRows))
expect(onRowsChange).toHaveBeenCalledWith(changedRows)
view.unmount()
expect(fakeWorkbook.dispose).toHaveBeenCalledOnce()
```

- [ ] **Step 3: Run the component test and verify it fails**

Run: `npx vitest run --config modules/web-app/vite.config.ts modules/web-app/src/components/IncomeSheet.test.tsx`

Expected: FAIL because `IncomeSheet` does not exist.

- [ ] **Step 4: Implement a narrow Univer lifecycle wrapper**

Expose this handle:

```ts
export type IncomeSheetHandle = {
  reset(records: IncomeRecord[]): void
  focusCell(row: number, column: IncomeSheetColumn): void
}
```

The wrapper must:

- use `createUniver` with the core, validation, filter, and sort presets;
- create exactly one worksheet named `收入`;
- hide the formula bar, sheet tabs, arbitrary column insertion, and formatting-heavy menus;
- set five fixed headers and enough blank rows for paste growth;
- apply date, category-dropdown, and non-negative-number validation;
- protect the header and structural columns while leaving business cells editable;
- subscribe to value and row-structure changes and emit normalized `IncomeSheetRow[]`;
- keep row identity in system-owned metadata that sorting preserves and copy sanitization cannot duplicate;
- dispose every Univer subscription and instance on unmount.

Keep Univer-specific command IDs and facade calls inside `IncomeSheet.tsx`; the page and adapter must not import Univer packages.

- [ ] **Step 5: Add constrained workbench CSS**

```css
.income-sheet {
  min-height: 560px;
  height: calc(100vh - 190px);
  border: 1px solid var(--table-border);
  background: var(--surface-primary);
  overflow: hidden;
}

.income-sheet .univer-app-container {
  font-variant-numeric: tabular-nums;
}
```

Map Univer light/dark colors from existing theme variables and keep the money column right-aligned.

- [ ] **Step 6: Run component tests and build**

Run:

```bash
npx vitest run --config modules/web-app/vite.config.ts modules/web-app/src/components/IncomeSheet.test.tsx
npm run build
```

Expected: both commands PASS.

- [ ] **Step 7: Commit the Univer wrapper**

```bash
git add package.json package-lock.json modules/web-app/src/components/IncomeSheet.tsx modules/web-app/src/components/IncomeSheet.css modules/web-app/src/components/IncomeSheet.test.tsx
git commit -m "feat: add constrained Univer income sheet"
```

### Task 5: Replace the income page table

**Files:**
- Modify: `modules/web-app/src/pages/IncomeManagementPage.tsx`
- Modify: `modules/web-app/src/pages/IncomeManagementPage.test.tsx`
- Modify: `modules/web-app/src/pages/IncomeManagementPage.css`

- [ ] **Step 1: Rewrite page tests around the IncomeSheet boundary**

Mock `IncomeSheet` as an interactive test double. Verify:

```tsx
expect(screen.getByTestId('income-sheet')).toBeTruthy()
fireEvent.click(screen.getByRole('button', { name: '模拟修改' }))
expect(screen.getByText('1 项未保存')).toBeTruthy()
fireEvent.click(screen.getByRole('button', { name: '保存收入' }))
await waitFor(() => expect(mockedApi.saveIncomeRecords).toHaveBeenCalledWith(expectedBatch))
```

Replace assertions for native inputs, external filter controls, per-row delete buttons, and three single-record API methods. Add tests for validation focus, save failure retaining rows, save success reloading records, and discard calling `reset`.

- [ ] **Step 2: Run page tests and verify they fail**

Run: `npx vitest run --config modules/web-app/vite.config.ts modules/web-app/src/pages/IncomeManagementPage.test.tsx`

Expected: FAIL because the page still renders the native table.

- [ ] **Step 3: Replace draft/filter orchestration with sheet orchestration**

Keep only:

```ts
const [records, setRecords] = useState<IncomeRecord[]>([])
const [sheetRows, setSheetRows] = useState<IncomeSheetRow[]>([])
const sheetRef = useRef<IncomeSheetHandle>(null)
const dirtyCount = useMemo(
  () => countIncomeChanges(records, sheetRows),
  [records, sheetRows],
)
```

Save with one batch call:

```ts
async function saveChanges() {
  let batch: IncomeBatch
  try {
    batch = buildIncomeBatch(records, sheetRows)
  } catch (error) {
    if (error instanceof IncomeSheetValidationError) {
      sheetRef.current?.focusCell(error.row, error.column)
      toast(error.message, 'error')
      return
    }
    throw error
  }
  setSaving(true)
  try {
    await api.saveIncomeRecords(batch)
    toast(`已保存 ${dirtyCount} 条收入变更`)
    await load()
  } catch (error: any) {
    toast('保存收入失败: ' + error.message, 'error')
  } finally {
    setSaving(false)
  }
}
```

Render `IncomeSheet` inside `TableWorkspace`; remove the external filter bar, native table, `新增行` button, and single-row delete controls. Keep “放弃修改”.

- [ ] **Step 4: Remove obsolete page CSS and keep only shell sizing**

Delete selectors for `.income-filter-*`, `.income-workbook-table`, row status, and native cell inputs. Preserve only page-level layout that still applies to the Univer container.

- [ ] **Step 5: Run page and adapter tests**

Run:

```bash
npx vitest run --config modules/web-app/vite.config.ts modules/web-app/src/pages/IncomeManagementPage.test.tsx modules/web-app/src/pages/incomeSheetAdapter.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the page migration**

```bash
git add modules/web-app/src/pages/IncomeManagementPage.tsx modules/web-app/src/pages/IncomeManagementPage.test.tsx modules/web-app/src/pages/IncomeManagementPage.css
git commit -m "feat: migrate income editing to Univer"
```

### Task 6: Verify real spreadsheet behavior and finish

**Files:**
- Modify only files implicated by verification failures.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
npm run test
npm run build
```

Expected: all frontend/domain tests, Worker tests, TypeScript checks, and Vite build PASS.

- [ ] **Step 2: Start the real local stack**

Run: `npm run dev:all`

Expected: Vite serves `http://localhost:5173` and Wrangler serves the Worker on `http://localhost:8787`.

- [ ] **Step 3: Perform the browser acceptance checklist**

Use realistic local income records and verify:

1. Paste a five-column, multi-row block copied from Excel or Google Sheets.
2. Copy a date/category down with the fill handle.
3. Sort by amount and filter by category, then edit a record and save the correct ID.
4. Duplicate an existing row and confirm it saves as a new record.
5. Delete multiple rows, undo, redo, and save.
6. Enter `2026-02-30`, a negative amount, and an invalid category; each blocks saving and focuses the bad cell.
7. Force one invalid batch request and confirm no records change.
8. Refresh the page and confirm the successful saved state exactly matches the worksheet.
9. Switch light/dark theme and verify readable headers, cells, selection, and validation messages.

- [ ] **Step 4: Re-run checks after any acceptance fixes**

Run:

```bash
npm run test
npm run build
git diff --check
```

Expected: all commands PASS and no whitespace errors.

- [ ] **Step 5: Commit acceptance fixes, if any**

```bash
git add package.json package-lock.json modules/web-app/src/components/IncomeSheet.tsx modules/web-app/src/components/IncomeSheet.css modules/web-app/src/pages/IncomeManagementPage.tsx modules/web-app/src/pages/IncomeManagementPage.css modules/web-app/src/pages/incomeSheetAdapter.ts modules/worker-api/index.js
git commit -m "fix: polish Univer income sheet workflow"
```

If no fixes were required, do not create an empty commit.

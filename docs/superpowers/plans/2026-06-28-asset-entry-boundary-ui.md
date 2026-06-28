# Asset Entry Boundary UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clarify the product boundary between asset master data management and snapshot entry, while adding mature UI details for numeric formatting, unsaved-change protection, and entry review.

**Architecture:** Keep the existing React + Express snapshot-ledger architecture. The main change is frontend responsibility separation: `AssetsPage` remains the master-data screen, while `SnapshotForm` only references existing active assets and creates snapshots. Shared numeric formatting and validation helpers should live in domain utilities so pages and tests use one rule set.

**Tech Stack:** React, TypeScript, React Router, Vite, Vitest, Express, file-backed JSON storage.

---

## Spec

Implement against: `docs/superpowers/specs/2026-06-28-asset-entry-boundary-ui-design.md`.

## File Structure

- Modify `src/components/Layout.tsx`: rename navigation labels from `资产项` / `录入` to `资产管理` / `快照录入`.
- Modify `src/pages/AssetsPage.tsx`: update page copy, make latest value columns visibly read-only, add post-create hint that points users to snapshot entry.
- Modify `src/pages/AssetsPage.css`: polish master-data table copy and hint styling.
- Modify `src/pages/EntryPage.tsx`: rename page heading, remove data backup from the primary entry workflow if implementing Task 7, and pass navigation callbacks to `SnapshotForm`.
- Modify `src/pages/EntryPage.css`: support a cleaner entry layout and optional data-management layout.
- Modify `src/components/SnapshotForm.tsx`: remove inline asset creation, add asset-management jump link, track dirty state, add entry summary and save review.
- Modify `src/components/SnapshotForm.css`: remove inline-add styles, add summary/review/jump-link styles.
- Modify `src/domain/money.ts`: add canonical fixed-decimal display helpers if they do not already exist.
- Modify `src/domain/money.test.ts`: cover amount/profit/rate display and decimal normalization rules.
- Modify `src/components/SnapshotForm.test.tsx` if test infrastructure already supports component tests; otherwise add domain-level tests and manually verify UI.
- Optional create `src/pages/DataManagementPage.tsx` and `src/pages/DataManagementPage.css`: move JSON import/export out of entry page.
- Optional modify `src/App.tsx`: add `/data` route if Task 7 is included.

## Task 1: Rename Navigation and Page Copy

**Files:**
- Modify: `src/components/Layout.tsx`
- Modify: `src/pages/AssetsPage.tsx`
- Modify: `src/pages/EntryPage.tsx`

- [ ] **Step 1: Update navigation labels**

In `src/components/Layout.tsx`, change only visible nav text:

```tsx
<NavLink to="/assets" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
  资产管理
</NavLink>
<NavLink to="/entry" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
  快照录入
</NavLink>
```

- [ ] **Step 2: Update Assets page heading and hint**

In `src/pages/AssetsPage.tsx`, change:

```tsx
<h1>资产管理</h1>
<button className="btn-primary" onClick={openCreate}>+ 新增资产</button>
```

and:

```tsx
<p className="assets-hint">
  维护需要长期追踪的资产档案。金额、收益和收益率来自最新快照，仅作只读参考。
</p>
```

- [ ] **Step 3: Update Entry page heading**

In `src/pages/EntryPage.tsx`, change:

```tsx
<h1>快照录入</h1>
```

- [ ] **Step 4: Run verification**

Run:

```bash
npm test -- --run
npm run build
```

Expected: tests pass and build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout.tsx src/pages/AssetsPage.tsx src/pages/EntryPage.tsx
git commit -m "chore: clarify asset and snapshot navigation labels"
```

## Task 2: Add Canonical Number Formatting Rules

**Files:**
- Modify: `src/domain/money.ts`
- Modify: `src/domain/money.test.ts`

- [ ] **Step 1: Add failing tests**

Append tests in `src/domain/money.test.ts`:

```ts
import { formatMoneyFixed, formatPercentFixed, isValidCurrencyAmount, isValidPercentInput } from './money'

describe('mature numeric display helpers', () => {
  it('formats money with thousand separators and two decimals', () => {
    expect(formatMoneyFixed(12345.6)).toBe('12,345.60')
    expect(formatMoneyFixed(0)).toBe('0.00')
    expect(formatMoneyFixed(undefined)).toBe('-')
  })

  it('formats percentages with two decimals', () => {
    expect(formatPercentFixed(0.0865)).toBe('8.65%')
    expect(formatPercentFixed(0)).toBe('0.00%')
    expect(formatPercentFixed(undefined)).toBe('-')
  })

  it('validates currency amount input', () => {
    expect(isValidCurrencyAmount('123.45')).toBe(true)
    expect(isValidCurrencyAmount('123.456')).toBe(false)
    expect(isValidCurrencyAmount('-1')).toBe(false)
    expect(isValidCurrencyAmount('')).toBe(false)
  })

  it('validates percent input', () => {
    expect(isValidPercentInput('8.65')).toBe(true)
    expect(isValidPercentInput('-99.99')).toBe(true)
    expect(isValidPercentInput('-100.01')).toBe(false)
    expect(isValidPercentInput('8.999')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- --run src/domain/money.test.ts
```

Expected: FAIL because helpers are not implemented.

- [ ] **Step 3: Implement helpers**

In `src/domain/money.ts`, add:

```ts
export function formatMoneyFixed(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '-'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatPercentFixed(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '-'
  return `${(value * 100).toFixed(2)}%`
}

export function isValidCurrencyAmount(value: string): boolean {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return false
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0
}

export function isValidSignedMoney(value: string): boolean {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) return false
  return Number.isFinite(Number(value))
}

export function isValidPercentInput(value: string): boolean {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) return false
  const percent = Number(value)
  return Number.isFinite(percent) && percent >= -100
}
```

- [ ] **Step 4: Run tests and build**

Run:

```bash
npm test -- --run src/domain/money.test.ts
npm run build
```

Expected: tests pass and build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/domain/money.ts src/domain/money.test.ts
git commit -m "feat: add stable numeric formatting helpers"
```

## Task 3: Remove Inline Asset Creation From Snapshot Form

**Files:**
- Modify: `src/components/SnapshotForm.tsx`
- Modify: `src/components/SnapshotForm.css`

- [ ] **Step 1: Remove inline asset state**

In `src/components/SnapshotForm.tsx`, remove these state variables:

```ts
const [showAddAsset, setShowAddAsset] = useState(false)
const [newAssetName, setNewAssetName] = useState('')
const [newAssetType, setNewAssetType] = useState('fund')
const [newAssetCurrency, setNewAssetCurrency] = useState<Currency>('CNY')
const [newAssetInstitution, setNewAssetInstitution] = useState('')
```

Remove `Currency` from the import if it becomes unused.

- [ ] **Step 2: Remove inline asset methods**

Delete these functions from `SnapshotForm.tsx`:

```ts
function addInlineAsset() { /* delete entire function */ }
function removeInlineAsset(index: number) { /* delete entire function */ }
```

- [ ] **Step 3: Remove inline creation UI**

Delete the `+ 新增资产项` button, the `{showAddAsset && (...)}` block, and the `r.isNew` remove button.

Replace the actions bar with:

```tsx
<div className="snapshot-actions-bar">
  <span className="hint-text">
    勾选需要更新的资产，填写当前金额。未勾选的资产沿用上次快照值。投资类资产可填写收益。
  </span>
  <button type="button" className="btn-secondary" onClick={handleManageAssets}>
    管理资产项
  </button>
</div>
```

- [ ] **Step 4: Keep submit payload assetId-only**

In `handleSubmit`, replace the item construction with:

```ts
const item: any = { assetId: r.assetId, amount }
```

Remove the branch that assigns `item.asset = {...}`.

- [ ] **Step 5: Remove inline styles**

In `src/components/SnapshotForm.css`, delete `.inline-add-asset`, `.inline-add-asset input`, `.inline-add-asset select`, `.snapshot-row.is-new`, and `.btn-remove-inline` rules.

- [ ] **Step 6: Run verification**

Run:

```bash
npm test -- --run
npm run build
```

Expected: tests pass and build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/SnapshotForm.tsx src/components/SnapshotForm.css
git commit -m "feat: keep asset creation out of snapshot entry"
```

## Task 4: Add Asset Management Jump With Unsaved-Change Protection

**Files:**
- Modify: `src/components/SnapshotForm.tsx`
- Modify: `src/pages/EntryPage.tsx`

- [ ] **Step 1: Extend SnapshotForm props**

Update `SnapshotFormProps`:

```ts
interface SnapshotFormProps {
  onSuccess: () => void
  onManageAssets: () => void
}
```

- [ ] **Step 2: Track dirty state**

Add:

```ts
const initialRecordedAt = useRef(recordedAt)
const initialRecordingTime = useRef(recordingTime)
const [isDirty, setIsDirty] = useState(false)

function markDirty() {
  setIsDirty(true)
}
```

Call `markDirty()` in handlers that change date, time, note, included state, amount, profit, or profit rate.

- [ ] **Step 3: Add protected navigation**

Add:

```ts
function handleManageAssets() {
  if (isDirty) {
    const ok = confirm('当前快照尚未保存，离开后本次填写内容会丢失。确定要离开吗？')
    if (!ok) return
  }
  onManageAssets()
}
```

- [ ] **Step 4: Reset dirty state after save**

After `await loadData()` and `setNote('')`, add:

```ts
setIsDirty(false)
initialRecordedAt.current = recordedAt
initialRecordingTime.current = recordingTime
```

- [ ] **Step 5: Wire navigation from EntryPage**

In `src/pages/EntryPage.tsx`, import `useNavigate`:

```ts
import { useNavigate } from 'react-router-dom'
```

Inside component:

```ts
const navigate = useNavigate()
```

Render:

```tsx
<SnapshotForm onSuccess={load} onManageAssets={() => navigate('/assets')} />
```

- [ ] **Step 6: Run verification**

Run:

```bash
npm test -- --run
npm run build
```

Expected: tests pass and build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/SnapshotForm.tsx src/pages/EntryPage.tsx
git commit -m "feat: add protected asset management jump"
```

## Task 5: Apply Numeric Rules in Assets and Snapshot Form

**Files:**
- Modify: `src/pages/AssetsPage.tsx`
- Modify: `src/components/SnapshotForm.tsx`
- Modify: `src/domain/money.ts`

- [ ] **Step 1: Use fixed money display in AssetsPage**

Change imports:

```ts
import { formatMoneyFixed, formatPercentFixed } from '../domain/money'
```

Change amount display:

```tsx
<td className="amount-cell">{lv ? `${sym}${formatMoneyFixed(lv.amount)} ${a.currency}` : '-'}</td>
```

Change profit display:

```tsx
{lv?.profit !== undefined ? `${lv.profit >= 0 ? '+' : ''}${formatMoneyFixed(lv.profit)}` : '-'}
```

Change rate display:

```tsx
{lv?.profitRate !== undefined ? formatPercentFixed(lv.profitRate) : '-'}
```

- [ ] **Step 2: Use fixed placeholders in SnapshotForm**

Change placeholder formatting:

```tsx
placeholder={r.previousAmount !== undefined ? `上次: ${formatMoneyFixed(r.previousAmount)}` : '0.00'}
```

and:

```tsx
placeholder={r.previousProfit !== undefined ? `上次: ${formatMoneyFixed(r.previousProfit)}` : '如 500.00'}
```

and:

```tsx
placeholder={r.previousProfitRate !== undefined ? `上次: ${formatPercentFixed(r.previousProfitRate)}` : '如 8.65'}
```

- [ ] **Step 3: Validate decimal precision before submit**

In `SnapshotForm.tsx`, import:

```ts
import { formatMoneyFixed, formatPercentFixed, isValidCurrencyAmount, isValidPercentInput, isValidSignedMoney } from '../domain/money'
```

Before parsing `amount`, add:

```ts
if (!isValidCurrencyAmount(r.amount)) {
  throw new Error(`资产 "${r.name}" 的金额无效，请输入非负数字，最多 2 位小数`)
}
```

Before parsing profit:

```ts
if (r.profit !== '' && !isValidSignedMoney(r.profit)) {
  throw new Error(`资产 "${r.name}" 的收益无效，请最多保留 2 位小数`)
}
```

Before parsing profit rate:

```ts
if (r.profitRate !== '' && !isValidPercentInput(r.profitRate)) {
  throw new Error(`资产 "${r.name}" 的收益率无效，不能小于 -100%，且最多保留 2 位小数`)
}
```

- [ ] **Step 4: Run verification**

Run:

```bash
npm test -- --run
npm run build
```

Expected: tests pass and build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AssetsPage.tsx src/components/SnapshotForm.tsx src/domain/money.ts
git commit -m "feat: apply stable numeric display rules"
```

## Task 6: Add Snapshot Entry Summary and Save Review

**Files:**
- Modify: `src/components/SnapshotForm.tsx`
- Modify: `src/components/SnapshotForm.css`

- [ ] **Step 1: Add summary calculations**

In `SnapshotForm.tsx`, before `return`, add:

```ts
const includedRows = rows.filter((r) => r.included)
const changedRows = includedRows.filter((r) => {
  if (r.previousAmount === undefined) return true
  const amount = Number(r.amount)
  return Number.isFinite(amount) && amount !== r.previousAmount
})
const largeChangeRows = changedRows.filter((r) => {
  if (r.previousAmount === undefined || r.previousAmount === 0) return false
  const amount = Number(r.amount)
  if (!Number.isFinite(amount)) return false
  return Math.abs(amount - r.previousAmount) / Math.abs(r.previousAmount) > 0.5
})
```

- [ ] **Step 2: Render summary near actions bar**

Add after `.snapshot-actions-bar`:

```tsx
<div className="snapshot-summary">
  <span>快照时间：{recordedAt} {recordingTime}</span>
  <span>本次更新：{includedRows.length} 项</span>
  <span>金额变化：{changedRows.length} 项</span>
</div>
```

- [ ] **Step 3: Add save review confirmation**

Before `await api.createSnapshot(...)`, add:

```ts
const reviewLines = [
  `快照时间：${recordedAt} ${recordingTime}`,
  `本次更新：${includedRows.length} 项`,
  `金额变化：${changedRows.length} 项`,
]

if (largeChangeRows.length > 0) {
  reviewLines.push(`大额变化：${largeChangeRows.map((r) => r.name).join('、')}`)
}

if (!confirm(`${reviewLines.join('\n')}\n\n确认保存这次快照吗？`)) {
  setSubmitting(false)
  return
}
```

- [ ] **Step 4: Style summary**

In `SnapshotForm.css`, add:

```css
.snapshot-summary {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  color: #666;
  font-size: 13px;
}

.snapshot-summary span {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 6px 10px;
}
```

- [ ] **Step 5: Run verification**

Run:

```bash
npm test -- --run
npm run build
```

Expected: tests pass and build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/SnapshotForm.tsx src/components/SnapshotForm.css
git commit -m "feat: add snapshot entry review summary"
```

## Task 7: Move Backup UI Out of Snapshot Entry

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Layout.tsx`
- Modify: `src/pages/EntryPage.tsx`
- Create: `src/pages/DataManagementPage.tsx`
- Create: `src/pages/DataManagementPage.css`

- [ ] **Step 1: Create DataManagementPage**

Move `handleExport`, `handleFileChange`, `handleImport`, `showImportConfirm`, `importData`, and `importing` from `EntryPage.tsx` into new file `src/pages/DataManagementPage.tsx`.

Use this component shell:

```tsx
import { useState } from 'react'
import { api } from '../api/client'
import './DataManagementPage.css'

export default function DataManagementPage() {
  const [importing, setImporting] = useState(false)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const [importData, setImportData] = useState<any>(null)

  async function handleExport() {
    const data = await api.exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finance-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        setImportData(data)
        const version = data.meta?.schemaVersion
        if (version === 1 || version === 2) setShowImportConfirm(true)
        else alert('备份文件格式不正确或不支持的版本')
      } catch {
        alert('无法解析 JSON 文件')
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!importData) return
    setImporting(true)
    try {
      await api.importData(importData)
      setShowImportConfirm(false)
      setImportData(null)
      alert('数据导入成功！')
    } catch (e: any) {
      alert('导入失败: ' + e.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="data-page">
      <h1>数据管理</h1>
      <section className="data-section">
        <h3>JSON 备份</h3>
        <button className="btn-secondary" onClick={handleExport}>导出 JSON 备份</button>
        <label className="btn-secondary data-import-button">
          导入 JSON 备份
          <input type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />
        </label>
      </section>

      {showImportConfirm && (
        <div className="modal-overlay" onClick={() => setShowImportConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>确认导入</h2>
            <p>即将覆盖当前所有数据，此操作不可撤销。</p>
            <p className="data-import-summary">
              Schema v{importData?.meta?.schemaVersion} |
              资产: {importData?.assets?.length || importData?.deposits?.length || 0} |
              快照: {importData?.snapshots?.length || importData?.transactions?.length || 0}
            </p>
            <div className="form-buttons">
              <button className="btn-danger" onClick={handleImport} disabled={importing}>
                {importing ? '导入中...' : '确认导入'}
              </button>
              <button className="btn-secondary" onClick={() => { setShowImportConfirm(false); setImportData(null) }}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add styles**

Create `src/pages/DataManagementPage.css`:

```css
.data-page h1 { margin-bottom: 20px; }
.data-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  max-width: 520px;
}
.data-section h3 { margin-bottom: 12px; }
.data-import-button { display: inline-block; margin-top: 10px; }
.data-import-summary { color: #888; font-size: 13px; margin-top: 8px; }
```

- [ ] **Step 3: Register route and nav**

In `src/App.tsx`, import and route:

```tsx
import DataManagementPage from './pages/DataManagementPage'
```

```tsx
<Route path="/data" element={<DataManagementPage />} />
```

In `Layout.tsx`, add:

```tsx
<NavLink to="/data" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
  数据管理
</NavLink>
```

- [ ] **Step 4: Remove backup UI from EntryPage**

Delete backup section state and handlers from `EntryPage.tsx`, leaving only snapshot form and recent snapshots.

- [ ] **Step 5: Run verification**

Run:

```bash
npm test -- --run
npm run build
```

Expected: tests pass and build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/Layout.tsx src/pages/EntryPage.tsx src/pages/DataManagementPage.tsx src/pages/DataManagementPage.css
git commit -m "feat: move backup tools to data management"
```

## Task 8: Final UI Pass and Manual Verification

**Files:**
- Modify: `src/pages/AssetsPage.css`
- Modify: `src/pages/EntryPage.css`
- Modify: `src/components/SnapshotForm.css`

- [ ] **Step 1: Ensure cards use restrained 8px radius**

Change page containers that use `border-radius:10px` or `12px` to `8px` unless they are modals.

- [ ] **Step 2: Make entry layout ergonomic on desktop and mobile**

In `EntryPage.css`, ensure:

```css
.entry-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 24px;
  align-items: start;
}

@media(max-width:768px) {
  .entry-layout { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: Ensure buttons do not overflow**

Check `.snapshot-actions-bar`, `.snapshot-summary`, and `.form-buttons` have `flex-wrap: wrap`.

- [ ] **Step 4: Run app locally**

Run:

```bash
npm run dev
```

Open the printed local URL and manually verify:

- Navigation says `资产管理`, `快照录入`, and optionally `数据管理`.
- Snapshot entry no longer contains inline asset creation.
- `管理资产项` navigates to `/assets`.
- Unsaved entry changes trigger a confirmation before leaving.
- Amounts display with 2 decimals.
- Snapshot save review appears before saving.
- Mobile viewport does not overlap text or controls.

- [ ] **Step 5: Run final verification**

Run:

```bash
npm test -- --run
npm run build
```

Expected: tests pass and build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AssetsPage.css src/pages/EntryPage.css src/components/SnapshotForm.css
git commit -m "style: polish asset entry ergonomics"
```

## Self-Review Checklist

- Spec coverage: Tasks cover navigation, asset/entry boundary, inline creation removal, PMS jump, unsaved protection, numeric formatting, entry summary, save review, and optional backup relocation.
- Placeholder scan: No steps require unspecified behavior. All code-level tasks include exact snippets or exact expected behavior.
- Type consistency: `SnapshotFormProps`, numeric helper names, and route paths are consistent across tasks.
- Scope check: The plan remains focused on UI/UX boundary cleanup. It does not introduce transaction ledgering, external data, or multi-user workflow.

## Recommended Execution Notes for Claude

Start with Tasks 1-6. Task 7 is useful but can be deferred if you want a smaller first PR. Task 8 should always happen before handoff because it catches mobile layout and visual regressions.

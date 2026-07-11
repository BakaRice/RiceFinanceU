# Workbook UI First Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不修改 Worker API 和账本 JSON 结构的前提下，把 Web 端改造成可评审的“工作簿导航 + 统一 Table”前端切片。

**Architecture:** 新增一个纯展示型 `TableWorkspace`，统一表名、工具栏、未保存提示和表格画布。现有资产、快照和汇率 API 通过页面适配器继续使用；录入页保留现有快照提交语义，只取消投资类/余额类界面分区；资产页第一阶段统一启用/停用行并提供直接编辑草稿；汇率从大盘编辑器迁移为独立 Table，大盘保持只读。

**Tech Stack:** React 19、TypeScript、React Router、Vitest、Testing Library、现有 CSS variables 和 Worker API client。

---

## Scope Boundary

本计划只验证前端交互模型：

- 不修改 `modules/worker-api/`。
- 不修改现有 JSON schema。
- 不实现服务端批量事务；资产 Table 点击保存时按现有单条 API 顺序提交，页面需要明确保持草稿直到全部请求结束。
- 不实现 Excel 文件解析或导出。
- 不重写当前工作区中已有未提交改动的 `IncomeManagementPage.*`；收入页只通过全局工作簿导航进入，后续单独迁移到 `TableWorkspace`。
- 不处理小程序端。

## File Map

### Create

- `modules/web-app/src/components/TableWorkspace.tsx`：统一 Table 页标题、工具栏、状态和画布容器。
- `modules/web-app/src/components/TableWorkspace.css`：工作簿表格通用视觉样式。
- `modules/web-app/src/components/TableWorkspace.test.tsx`：通用容器行为测试。
- `modules/web-app/src/pages/ExchangeRatesPage.tsx`：汇率 Table 页面。
- `modules/web-app/src/pages/ExchangeRatesPage.css`：汇率单元格样式。
- `modules/web-app/src/pages/ExchangeRatesPage.test.tsx`：汇率加载、草稿和保存测试。

### Modify

- `modules/web-app/src/components/Layout.tsx`：侧栏导航改成工作簿顶栏和 Sheet 标签。
- `modules/web-app/src/components/Layout.css`：全宽工作簿布局。
- `modules/web-app/src/App.tsx`：在汇率页面落地时增加 `/rates` 路由。
- `modules/web-app/src/App.test.tsx`：验证新的 Sheet 导航与汇率入口。
- `modules/web-app/src/pages/EntryPage.tsx`：移除独立最近快照侧栏，使用全宽 Table 工作区。
- `modules/web-app/src/pages/EntryPage.css`：录入页改成全宽表格画布。
- `modules/web-app/src/components/SnapshotForm.tsx`：把投资类和余额类合成一张表，保留条件单元格规则。
- `modules/web-app/src/components/SnapshotForm.css`：统一只读列、编辑列和脏单元格视觉。
- `modules/web-app/src/components/SnapshotForm.test.tsx`：验证全部资产同表、预填和条件编辑。
- `modules/web-app/src/components/MoneyInput.tsx`：增加可访问名称透传，让表格单元格可被定位。
- `modules/web-app/src/pages/AssetsPage.tsx`：启用和停用资产同表展示；核心字段直接编辑并显式保存。
- `modules/web-app/src/pages/AssetsPage.css`：资产表编辑单元格、状态列和保存工具栏。
- `modules/web-app/src/pages/AssetsPage.test.tsx`：资产草稿、统一状态列和保存测试。
- `modules/web-app/src/pages/DashboardPage.tsx`：移除汇率编辑控件，只显示当前汇率并链接汇率 Table。
- `modules/web-app/src/pages/DashboardPage.css`：汇率展示改为只读。
- `modules/web-app/src/pages/DashboardPage.test.tsx`：验证大盘不再直接更新汇率。

## Task 1: Build the workbook navigation shell

**Files:**
- Modify: `modules/web-app/src/components/Layout.tsx`
- Modify: `modules/web-app/src/components/Layout.css`
- Modify: `modules/web-app/src/App.test.tsx`

- [ ] **Step 1: Write the failing navigation test**

在 `App.test.tsx` 中把现有侧栏名称断言替换为工作簿标签断言，并增加汇率入口：

```tsx
expect(screen.getByRole('navigation', { name: '工作簿标签' })).toBeTruthy()
expect(screen.getByRole('link', { name: '大盘' })).toBeTruthy()
expect(screen.getByRole('link', { name: '资产' })).toBeTruthy()
expect(screen.getByRole('link', { name: '录入' })).toBeTruthy()
expect(screen.getByRole('link', { name: '收入' })).toBeTruthy()
expect(screen.getByRole('link', { name: '汇率' })).toBeTruthy()
expect(screen.getByRole('link', { name: '数据' })).toBeTruthy()
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npm run test:app -- modules/web-app/src/App.test.tsx
```

Expected: FAIL because `工作簿标签` and 汇率标签 do not exist.

- [ ] **Step 3: Add the workbook tab configuration**

在 `Layout.tsx` 用固定标签配置替换带图标侧栏：

```tsx
const sheetTabs = [
  { to: '/', label: '大盘', end: true },
  { to: '/assets', label: '资产' },
  { to: '/entry', label: '录入' },
  { to: '/income', label: '收入' },
  { to: '/rates', label: '汇率' },
  { to: '/data', label: '数据' },
]
```

渲染结构固定为：

```tsx
<div className="workbook-shell" data-testid="financial-workbench">
  <header className="workbook-header">
    <div className="workbook-brand">
      <strong>RiceFinanceU</strong>
      <span>个人资产工作簿</span>
    </div>
    <div className="workbook-account-actions">
      <ThemeSelector variant="sidebar" />
      {onLogout && <button type="button" onClick={onLogout}>退出</button>}
    </div>
  </header>
  <nav className="workbook-tabs" aria-label="工作簿标签">
    {sheetTabs.map((tab) => (
      <NavLink key={tab.to} to={tab.to} end={tab.end}>
        {tab.label}
      </NavLink>
    ))}
  </nav>
  <main className="workbook-content"><Outlet /></main>
</div>
```

`Layout.css` 使用全宽内容区、固定顶部品牌栏和 Sheet 标签；窄屏允许标签横向滚动：

```css
.workbook-shell {
  min-height: 100vh;
  background: var(--color-canvas);
}

.workbook-header {
  display: flex;
  min-height: 54px;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.workbook-brand,
.workbook-account-actions,
.workbook-tabs {
  display: flex;
  align-items: center;
}

.workbook-brand { gap: 10px; }
.workbook-account-actions { gap: 8px; }

.workbook-tabs {
  min-height: 42px;
  gap: 2px;
  overflow-x: auto;
  padding: 0 20px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.workbook-tabs a {
  align-self: stretch;
  display: grid;
  place-items: center;
  padding: 0 16px;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  text-decoration: none;
  white-space: nowrap;
}

.workbook-tabs a.active {
  border-bottom-color: var(--color-primary);
  color: var(--color-primary);
}

.workbook-content {
  min-width: 0;
  padding: 16px 20px 28px;
}
```

- [ ] **Step 4: Run the navigation test**

Run:

```bash
npm run test:app -- modules/web-app/src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the workbook shell**

```bash
git add modules/web-app/src/App.test.tsx modules/web-app/src/components/Layout.tsx modules/web-app/src/components/Layout.css
git commit -m "feat: add workbook navigation shell"
```

## Task 2: Create the shared TableWorkspace primitive

**Files:**
- Create: `modules/web-app/src/components/TableWorkspace.tsx`
- Create: `modules/web-app/src/components/TableWorkspace.css`
- Create: `modules/web-app/src/components/TableWorkspace.test.tsx`

- [ ] **Step 1: Write the failing component tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TableWorkspace from './TableWorkspace'

describe('TableWorkspace', () => {
  it('shows table identity, dirty count, and primary save action', () => {
    const onPrimaryAction = vi.fn()
    render(
      <TableWorkspace
        title="资产"
        description="一行一个资产"
        dirtyCount={3}
        primaryActionLabel="保存资产"
        onPrimaryAction={onPrimaryAction}
      >
        <table><tbody><tr><td>现金</td></tr></tbody></table>
      </TableWorkspace>,
    )

    expect(screen.getByRole('heading', { name: '资产' })).toBeTruthy()
    expect(screen.getByText('3 项未保存')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '保存资产' }))
    expect(onPrimaryAction).toHaveBeenCalledTimes(1)
  })

  it('disables save while clean or saving', () => {
    const { rerender } = render(
      <TableWorkspace title="汇率" dirtyCount={0} primaryActionLabel="保存汇率">
        <div />
      </TableWorkspace>,
    )
    expect(screen.getByRole('button', { name: '保存汇率' })).toBeDisabled()

    rerender(
      <TableWorkspace title="汇率" dirtyCount={1} primaryActionLabel="保存中…" saving>
        <div />
      </TableWorkspace>,
    )
    expect(screen.getByRole('button', { name: '保存中…' })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run the test and verify module-not-found failure**

Run:

```bash
npm run test:app -- modules/web-app/src/components/TableWorkspace.test.tsx
```

Expected: FAIL because `TableWorkspace.tsx` does not exist.

- [ ] **Step 3: Implement the minimal presentational component**

```tsx
import type { ReactNode } from 'react'
import './TableWorkspace.css'

interface TableWorkspaceProps {
  title: string
  description?: string
  dirtyCount?: number
  saving?: boolean
  primaryActionLabel?: string
  onPrimaryAction?: () => void
  secondaryActions?: ReactNode
  children: ReactNode
}

export default function TableWorkspace({
  title,
  description,
  dirtyCount = 0,
  saving = false,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActions,
  children,
}: TableWorkspaceProps) {
  return (
    <section className="table-workspace">
      <header className="table-workspace-toolbar">
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        <div className="table-workspace-actions">
          {dirtyCount > 0 && <span className="table-dirty-count">{dirtyCount} 项未保存</span>}
          {secondaryActions}
          {primaryActionLabel && (
            <button
              className="btn-primary"
              type="button"
              disabled={dirtyCount === 0 || saving}
              onClick={onPrimaryAction}
            >
              {primaryActionLabel}
            </button>
          )}
        </div>
      </header>
      <div className="table-workspace-grid">{children}</div>
    </section>
  )
}
```

`TableWorkspace.css` 使用以下基础样式，不添加第三方 grid 库：

```css
.table-workspace {
  width: 100%;
  min-width: 0;
}

.table-workspace-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 0 12px;
}

.table-workspace-toolbar h1,
.table-workspace-toolbar p { margin: 0; }
.table-workspace-toolbar p { margin-top: 4px; color: var(--color-text-muted); }

.table-workspace-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.table-dirty-count {
  color: var(--color-warning);
  font-size: var(--font-size-xs);
}

.table-workspace-grid {
  overflow: auto;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.table-workspace-grid table { width: 100%; border-collapse: separate; border-spacing: 0; }
.table-workspace-grid th { position: sticky; top: 0; z-index: 2; background: var(--color-surface-muted); }
.table-workspace-grid th,
.table-workspace-grid td { min-height: 36px; border-right: 1px solid var(--color-border-light); border-bottom: 1px solid var(--color-border-light); }
.table-workspace-grid td.is-readonly { background: var(--color-surface-muted); }
.table-workspace-grid td.is-dirty { box-shadow: inset 3px 0 0 var(--color-primary); }
.table-workspace-grid input:focus,
.table-workspace-grid select:focus { outline: 2px solid var(--color-border-focus); outline-offset: -2px; }
```

- [ ] **Step 4: Run component tests**

Run:

```bash
npm run test:app -- modules/web-app/src/components/TableWorkspace.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the primitive**

```bash
git add modules/web-app/src/components/TableWorkspace.tsx modules/web-app/src/components/TableWorkspace.css modules/web-app/src/components/TableWorkspace.test.tsx
git commit -m "feat: add shared table workspace"
```

## Task 3: Convert snapshot entry into one prefilled table

**Files:**
- Modify: `modules/web-app/src/pages/EntryPage.tsx`
- Modify: `modules/web-app/src/pages/EntryPage.css`
- Modify: `modules/web-app/src/components/SnapshotForm.tsx`
- Modify: `modules/web-app/src/components/SnapshotForm.css`
- Modify: `modules/web-app/src/components/SnapshotForm.test.tsx`
- Modify: `modules/web-app/src/components/MoneyInput.tsx`

- [ ] **Step 1: Add failing tests for one-table entry**

在 `SnapshotForm.test.tsx` 增加一个投资资产和一个余额资产，断言只有一个表格且两类资产都在其中：

```tsx
expect(await screen.findByRole('table', { name: '快照录入表' })).toBeTruthy()
expect(screen.getAllByRole('table')).toHaveLength(1)
expect(screen.getByText('指数基金')).toBeTruthy()
expect(screen.getByText('现金')).toBeTruthy()
expect(screen.getByDisplayValue('12000')).toBeTruthy()
expect(screen.getByDisplayValue('5000')).toBeTruthy()
expect(screen.queryByRole('heading', { name: '投资类资产' })).toBeNull()
expect(screen.queryByRole('heading', { name: '余额类资产' })).toBeNull()
```

再断言余额类行的收益列不可编辑，投资类行仍然可编辑：

```tsx
expect(screen.getByLabelText('现金 收益')).toBeDisabled()
expect(screen.getByLabelText('指数基金 收益')).not.toBeDisabled()
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npm run test:app -- modules/web-app/src/components/SnapshotForm.test.tsx
```

Expected: FAIL because the component currently renders separate investment and balance tables.

- [ ] **Step 3: Replace category tables with one row renderer**

删除现有的两个派生分组：

```tsx
const investmentRows = rows.filter((r) => isInvestmentType(r.type as any))
const balanceRows = rows.filter((r) => !isInvestmentType(r.type as any))
```

把 `renderTable(assetRows, isInvestment)` 改成单个 `renderTable(rows)`。表头始终包含收益和收益率；每行根据 `isInvestmentType(r.type)` 决定单元格：

```tsx
const investment = isInvestmentType(r.type as AssetType)

<MoneyInput
  ariaLabel={`${r.name} 收益`}
  value={investment ? r.profit : ''}
  onChange={(value) => updateRow(globalIdx, 'profit', value)}
  disabled={!investment || !r.included}
/>
```

在 `MoneyInput.tsx` 增加并透传可访问名称：

```tsx
ariaLabel?: string
```

在现有函数参数解构中加入：

```tsx
ariaLabel,
```

在现有内部 `<input>` 上加入：

```tsx
aria-label={ariaLabel}
```

不改动现有输入、格式化和单位逻辑。

余额类收益和收益率显示禁用空单元格，不删除整列。表格增加：

```tsx
<table className="fin-table snapshot-table" aria-label="快照录入表">
```

保留现有全部资产预填、上次值带入、变化计算、确认弹窗和 `api.createSnapshot` 调用。

- [ ] **Step 4: Wrap the page in TableWorkspace**

`EntryPage.tsx` 删除最近快照右侧栏，保留数据加载，把 `SnapshotForm` 放入全宽工作区。录入的保存按钮仍由表单自身控制，因此容器不重复提供 primary action：

```tsx
<TableWorkspace title="录入" description="全部启用资产已预填；只修改发生变化的单元格">
  <SnapshotForm onSuccess={load} onManageAssets={() => navigate('/assets')} />
</TableWorkspace>
```

- [ ] **Step 5: Run snapshot and entry tests**

Run:

```bash
npm run test:app -- modules/web-app/src/components/SnapshotForm.test.tsx modules/web-app/src/App.test.tsx
```

Expected: PASS. `App.test.tsx` covers the `/entry` route because this repository currently has no standalone `EntryPage.test.tsx`.

- [ ] **Step 6: Commit the unified entry table**

```bash
git add modules/web-app/src/pages/EntryPage.tsx modules/web-app/src/pages/EntryPage.css modules/web-app/src/components/SnapshotForm.tsx modules/web-app/src/components/SnapshotForm.css modules/web-app/src/components/SnapshotForm.test.tsx modules/web-app/src/components/MoneyInput.tsx
git commit -m "feat: unify snapshot entry in one table"
```

## Task 4: Present all assets in one table with editable drafts

**Files:**
- Modify: `modules/web-app/src/pages/AssetsPage.tsx`
- Modify: `modules/web-app/src/pages/AssetsPage.css`
- Modify: `modules/web-app/src/pages/AssetsPage.test.tsx`

- [ ] **Step 1: Write failing tests for unified rows and direct editing**

```tsx
expect(await screen.findByRole('table', { name: '资产表' })).toBeTruthy()
expect(screen.getAllByRole('table')).toHaveLength(1)
expect(screen.getByDisplayValue('指数基金')).toBeTruthy()
expect(screen.getByDisplayValue('停用现金')).toBeTruthy()
expect(screen.getByLabelText('停用现金 状态')).toHaveValue('inactive')

fireEvent.change(screen.getByLabelText('指数基金 名称'), {
  target: { value: '沪深 300' },
})
expect(screen.getByText('1 项未保存')).toBeTruthy()
fireEvent.click(screen.getByRole('button', { name: '保存资产' }))
await waitFor(() => {
  expect(mockedApi.updateAsset).toHaveBeenCalledWith(
    'asset-fund',
    expect.objectContaining({ name: '沪深 300' }),
  )
})
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
npm run test:app -- modules/web-app/src/pages/AssetsPage.test.tsx
```

Expected: FAIL because assets are currently split into active/inactive tables and edited in a modal.

- [ ] **Step 3: Introduce an AssetDraft row model inside the page**

```tsx
type AssetDraft = {
  id: string
  name: string
  type: AssetType
  institution: string
  currency: Currency
  isActive: boolean
  note: string
  original: Asset
}

function assetToDraft(asset: Asset): AssetDraft {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    institution: asset.institution || '',
    currency: asset.currency,
    isActive: asset.isActive,
    note: asset.note || '',
    original: asset,
  }
}
```

加载后生成 `drafts`，使用字段比较计算 `dirtyDrafts`。这一阶段保留已有新建资产和复杂档案编辑入口，但核心列直接在表格中编辑。

- [ ] **Step 4: Render one TableWorkspace and one asset table**

不再分别计算 `activeAssets` 和 `inactiveAssets`。统一渲染排序后的全部资产：

```tsx
<TableWorkspace
  title="资产"
  description="一行一个资产；金额状态来自最新快照"
  dirtyCount={dirtyDrafts.length}
  saving={savingDrafts}
  primaryActionLabel={savingDrafts ? '保存中…' : '保存资产'}
  onPrimaryAction={saveDrafts}
  secondaryActions={<button onClick={openCreate}>新增一行</button>}
>
  <table className="fin-table assets-table" aria-label="资产表">
    <thead>
      <tr>
        <th>名称</th><th>类型</th><th>标识</th><th>机构</th><th>币种</th>
        <th>最新金额</th><th>收益</th><th>收益率</th><th>状态</th><th>备注</th>
      </tr>
    </thead>
    <tbody>
      {drafts.map((draft) => {
        const latest = latestValues.get(draft.id)
        const investment = isInvestmentType(draft.type)
        return (
          <tr key={draft.id} className={isDraftDirty(draft) ? 'asset-row-dirty' : ''}>
            <td><input aria-label={`${draft.original.name} 名称`} value={draft.name} onChange={(event) => updateDraft(draft.id, 'name', event.target.value)} /></td>
            <td><select aria-label={`${draft.original.name} 类型`} value={draft.type} onChange={(event) => updateDraft(draft.id, 'type', event.target.value as AssetType)}>{Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
            <td className="is-readonly">{formatAssetProfileIdentifier(draft.original)}</td>
            <td><input aria-label={`${draft.original.name} 机构`} value={draft.institution} onChange={(event) => updateDraft(draft.id, 'institution', event.target.value)} /></td>
            <td><select aria-label={`${draft.original.name} 币种`} value={draft.currency} onChange={(event) => updateDraft(draft.id, 'currency', event.target.value as Currency)}><option value="CNY">CNY</option><option value="USD">USD</option><option value="HKD">HKD</option></select></td>
            <td className="is-readonly align-right"><MoneyDisplay value={latest?.amount} showCurrency={false} /></td>
            <td className="is-readonly align-right">{investment ? <MoneyDisplay value={latest?.profit} isProfit /> : '-'}</td>
            <td className="is-readonly align-right">{investment && latest?.profitRate !== undefined ? `${formatProfitRateInput(latest.profitRate)}%` : '-'}</td>
            <td><select aria-label={`${draft.original.name} 状态`} value={draft.isActive ? 'active' : 'inactive'} onChange={(event) => updateDraft(draft.id, 'isActive', event.target.value === 'active')}><option value="active">启用</option><option value="inactive">停用</option></select></td>
            <td><input aria-label={`${draft.original.name} 备注`} value={draft.note} onChange={(event) => updateDraft(draft.id, 'note', event.target.value)} /></td>
          </tr>
        )
      })}
    </tbody>
  </table>
</TableWorkspace>
```

每行核心输入使用明确 aria-label，例如：

```tsx
<input
  aria-label={`${draft.original.name} 名称`}
  value={draft.name}
  onChange={(event) => updateDraft(draft.id, 'name', event.target.value)}
/>

<select
  aria-label={`${draft.original.name} 状态`}
  value={draft.isActive ? 'active' : 'inactive'}
  onChange={(event) => updateDraft(draft.id, 'isActive', event.target.value === 'active')}
>
  <option value="active">启用</option>
  <option value="inactive">停用</option>
</select>
```

最新金额、收益和收益率保持只读；余额类资产对应收益单元格显示 `-`，不拆表。

- [ ] **Step 5: Save drafts through existing APIs**

按现有接口逐行提交：

```tsx
async function saveDrafts() {
  setSavingDrafts(true)
  try {
    for (const draft of dirtyDrafts) {
      await api.updateAsset(draft.id, {
        name: draft.name.trim(),
        type: draft.type,
        institution: draft.institution.trim() || undefined,
        currency: draft.currency,
        isActive: draft.isActive,
        note: draft.note.trim() || undefined,
      })
    }
    toast(`已保存 ${dirtyDrafts.length} 项资产修改`)
    await load()
  } catch (error: any) {
    toast(`保存失败: ${error.message}`, 'error')
  } finally {
    setSavingDrafts(false)
  }
}
```

前端不能宣称原子性；失败时重新加载前必须让用户决定，默认保留当前草稿以便再次保存。

- [ ] **Step 6: Run asset tests**

Run:

```bash
npm run test:app -- modules/web-app/src/pages/AssetsPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the unified asset table**

```bash
git add modules/web-app/src/pages/AssetsPage.tsx modules/web-app/src/pages/AssetsPage.css modules/web-app/src/pages/AssetsPage.test.tsx
git commit -m "feat: edit assets in one table"
```

## Task 5: Move exchange-rate editing into its own table

**Files:**
- Create: `modules/web-app/src/pages/ExchangeRatesPage.tsx`
- Create: `modules/web-app/src/pages/ExchangeRatesPage.css`
- Create: `modules/web-app/src/pages/ExchangeRatesPage.test.tsx`
- Modify: `modules/web-app/src/App.tsx`
- Modify: `modules/web-app/src/pages/DashboardPage.tsx`
- Modify: `modules/web-app/src/pages/DashboardPage.css`
- Modify: `modules/web-app/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: Write failing rate-table tests**

```tsx
it('loads USD and HKD as rows and saves edited rates', async () => {
  mockedApi.getRates.mockResolvedValue({
    USD: 7.2,
    HKD: 0.92,
    updatedAt: '2026-07-11T00:00:00.000Z',
  })
  mockedApi.updateRates.mockResolvedValue({
    USD: 7.25,
    HKD: 0.92,
    updatedAt: '2026-07-11T01:00:00.000Z',
  })

  render(<ExchangeRatesPage />)
  fireEvent.change(await screen.findByLabelText('USD 对人民币汇率'), {
    target: { value: '7.25' },
  })
  expect(screen.getByText('1 项未保存')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '保存汇率' }))

  await waitFor(() => {
    expect(mockedApi.updateRates).toHaveBeenCalledWith({ USD: 7.25, HKD: 0.92 })
  })
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npm run test:app -- modules/web-app/src/pages/ExchangeRatesPage.test.tsx
```

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement ExchangeRatesPage using existing endpoints**

先在 `App.tsx` 导入并注册页面：

```tsx
import ExchangeRatesPage from './pages/ExchangeRatesPage'

<Route path="/rates" element={<ExchangeRatesPage />} />
```

维护两个字符串草稿，避免输入过程中的小数状态被破坏：

```tsx
const rows = [
  { currency: 'USD', value: usdRate },
  { currency: 'HKD', value: hkdRate },
]
```

渲染统一 Table：

```tsx
<TableWorkspace
  title="汇率"
  description="1 单位外币可兑换的人民币金额"
  dirtyCount={dirtyCount}
  saving={saving}
  primaryActionLabel={saving ? '保存中…' : '保存汇率'}
  onPrimaryAction={saveRates}
>
  <table className="fin-table rates-table" aria-label="汇率表">
    <thead><tr><th>币种</th><th>对人民币汇率</th><th>更新时间</th></tr></thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.currency}>
          <td className="is-readonly">{row.currency}</td>
          <td>
            <input
              aria-label={`${row.currency} 对人民币汇率`}
              inputMode="decimal"
              value={row.value}
              onChange={(event) => row.currency === 'USD' ? setUsdRate(event.target.value) : setHkdRate(event.target.value)}
            />
          </td>
          <td className="is-readonly">{rates.updatedAt || '-'}</td>
        </tr>
      ))}
    </tbody>
  </table>
</TableWorkspace>
```

保存前要求两个值都为有限正数，然后调用：

```tsx
await api.updateRates({ USD: Number(usdRate), HKD: Number(hkdRate) })
```

- [ ] **Step 4: Make DashboardPage read-only for rates**

删除 `editingRates`、`usdRate`、`hkdRate` 和 `api.updateRates` 调用。保留只读展示并增加链接：

```tsx
<Link className="rates-trigger" to="/rates">
  汇率 · USD {rates.USD.toFixed(2)} · HKD {rates.HKD.toFixed(2)}
</Link>
```

更新 `DashboardPage.test.tsx`：

```tsx
expect(await screen.findByRole('link', { name: /汇率 · USD 7\.20 · HKD 0\.92/ })).toHaveAttribute('href', '/rates')
expect(screen.queryByRole('button', { name: '保存汇率' })).toBeNull()
expect(mockedApi.updateRates).not.toHaveBeenCalled()
```

- [ ] **Step 5: Run rate and dashboard tests**

Run:

```bash
npm run test:app -- modules/web-app/src/pages/ExchangeRatesPage.test.tsx modules/web-app/src/pages/DashboardPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the rate table**

```bash
git add modules/web-app/src/App.tsx modules/web-app/src/pages/ExchangeRatesPage.tsx modules/web-app/src/pages/ExchangeRatesPage.css modules/web-app/src/pages/ExchangeRatesPage.test.tsx modules/web-app/src/pages/DashboardPage.tsx modules/web-app/src/pages/DashboardPage.css modules/web-app/src/pages/DashboardPage.test.tsx
git commit -m "feat: manage rates in a table"
```

## Task 6: Verify the first frontend slice

**Files:**
- Verify only; no planned source edits.

- [ ] **Step 1: Run focused Web tests**

```bash
npm run test:app -- modules/web-app/src/App.test.tsx modules/web-app/src/components/TableWorkspace.test.tsx modules/web-app/src/components/SnapshotForm.test.tsx modules/web-app/src/pages/AssetsPage.test.tsx modules/web-app/src/pages/ExchangeRatesPage.test.tsx modules/web-app/src/pages/DashboardPage.test.tsx
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run the complete frontend test suite**

```bash
npm run test:app
```

Expected: PASS. Existing uncommitted income-page tests must remain passing.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: TypeScript and Vite build complete with exit code 0.

- [ ] **Step 4: Start the local app for visual review**

```bash
npm run dev:all
```

Expected: Vite serves `http://localhost:5173` and Wrangler serves the local API on `http://localhost:8787`.

- [ ] **Step 5: Smoke-test the complete path**

Verify in the browser:

1. The top tabs read `大盘 / 资产 / 录入 / 收入 / 汇率 / 数据`.
2. 大盘汇率 is read-only and links to 汇率.
3. 资产 contains active and inactive rows in one table.
4. Editing an asset cell shows an unsaved count and explicit save button.
5. 录入 contains investment and balance assets in one prefilled table.
6. Balance-asset profit cells are disabled without creating a separate section.
7. 汇率 edits remain local until clicking save.
8. Existing 收入 and 数据 pages still load without visual overflow.

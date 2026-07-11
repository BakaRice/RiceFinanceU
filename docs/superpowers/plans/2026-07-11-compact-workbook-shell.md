# Compact Workbook Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the workbook chrome into one compact row, keep table cells single-line, and let users resize asset, snapshot, and rate columns with browser-local persistence.

**Architecture:** `Layout` owns the single-row application chrome. A focused `useResizableColumns` hook owns column-width state, pointer dragging, validation, and localStorage persistence; each table declares its own stable table/column identifiers and renders widths through `colgroup`. Shared CSS in `TableWorkspace.css` enforces compact, non-wrapping table behavior without changing finance data or API calls.

**Tech Stack:** React 19, TypeScript, React Router, CSS, Vitest, Testing Library, browser `localStorage` and Pointer Events.

---

### Task 1: Merge the title and Sheet navigation

**Files:**
- Modify: `modules/web-app/src/App.test.tsx`
- Modify: `modules/web-app/src/components/Layout.tsx`
- Modify: `modules/web-app/src/components/Layout.css`

- [ ] **Step 1: Write the failing shell-structure test**

Add assertions proving the navigation is inside the banner and there is only one top-level chrome row:

```tsx
const banner = screen.getByRole('banner')
const navigation = screen.getByRole('navigation', { name: '工作簿标签' })
expect(banner.contains(navigation)).toBe(true)
expect(screen.queryByText('个人资产工作簿')).toBeNull()
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:app -- modules/web-app/src/App.test.tsx`

Expected: FAIL because the navigation is currently a sibling of the banner and the subtitle still renders.

- [ ] **Step 3: Move the navigation into the header**

Keep the brand, navigation, and account actions as three siblings inside the same `<header>`:

```tsx
<header className="workbook-header">
  <div className="workbook-brand">
    <span className="workbook-mark" aria-hidden="true">RF</span>
    <strong>RiceFinanceU</strong>
  </div>
  <nav className="workbook-tabs" aria-label="工作簿标签">
    {sheetTabs.map((tab) => (
      <NavLink key={tab.to} to={tab.to} end={tab.end}
        className={({ isActive }) => isActive ? 'workbook-tab active' : 'workbook-tab'}>
        {tab.label}
      </NavLink>
    ))}
  </nav>
  <div className="workbook-account-actions">
    <ThemeSelector variant="sidebar" />
    {onLogout && (
      <button className="workbook-logout" type="button" onClick={onLogout} aria-label="退出登录">
        退出
      </button>
    )}
  </div>
</header>
```

Update CSS so `.workbook-header` is a 48px single row, `.workbook-tabs` flexes and scrolls horizontally without its own border/padding, and `.workbook-content` uses `min-height: calc(100vh - 49px)`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test:app -- modules/web-app/src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the shell change**

```bash
git add modules/web-app/src/App.test.tsx modules/web-app/src/components/Layout.tsx modules/web-app/src/components/Layout.css
git commit -m "feat: compact workbook navigation"
```

### Task 2: Add reusable, browser-local column resizing

**Files:**
- Create: `modules/web-app/src/components/useResizableColumns.ts`
- Create: `modules/web-app/src/components/useResizableColumns.test.tsx`
- Modify: `modules/web-app/src/components/TableWorkspace.css`

- [ ] **Step 1: Write failing hook tests**

Build a small harness with a resizer and assert the default width, minimum width, and persisted width:

```tsx
function Harness() {
  const { widths, startResize } = useResizableColumns('assets', { name: 160 })
  return <button data-testid="handle" style={{ width: widths.name }}
    onPointerDown={(event) => startResize('name', event)}>名称</button>
}

fireEvent.pointerDown(screen.getByTestId('handle'), { clientX: 100 })
fireEvent.pointerMove(window, { clientX: 150 })
fireEvent.pointerUp(window)
expect(screen.getByTestId('handle').style.width).toBe('210px')
expect(localStorage.setItem).toHaveBeenCalledWith(
  'ricefinanceu:column-widths:assets',
  JSON.stringify({ name: 210 }),
)
```

Add another case where dragging left clamps the value to `72px`, plus a remount case that restores a valid stored width and ignores invalid JSON.

- [ ] **Step 2: Run the focused hook test and verify RED**

Run: `npm run test:app -- modules/web-app/src/components/useResizableColumns.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the minimal hook**

Export the following API:

```ts
export function useResizableColumns(
  tableId: string,
  defaults: Record<string, number>,
  minWidth = 72,
): {
  widths: Record<string, number>
  startResize: (column: string, event: React.PointerEvent<HTMLElement>) => void
}
```

Initialize state by parsing `localStorage.getItem('ricefinanceu:column-widths:' + tableId)`, accepting only finite numbers at or above `minWidth`. On pointer down, register `window` pointermove/pointerup handlers, update only the active column, remove both listeners on pointerup, and persist the final width inside `try/catch`.

Add shared resizer styling:

```css
.column-resize-handle {
  position: absolute;
  top: 0;
  right: -3px;
  width: 7px;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: col-resize;
}
.column-resize-handle:hover,
.column-resize-handle:focus-visible {
  background: var(--color-primary);
}
```

- [ ] **Step 4: Run the focused hook test and verify GREEN**

Run: `npm run test:app -- modules/web-app/src/components/useResizableColumns.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the reusable resizing primitive**

```bash
git add modules/web-app/src/components/useResizableColumns.ts modules/web-app/src/components/useResizableColumns.test.tsx modules/web-app/src/components/TableWorkspace.css
git commit -m "feat: add persistent column resizing"
```

### Task 3: Connect resizing and compact density to all editable tables

**Files:**
- Modify: `modules/web-app/src/pages/AssetsPage.tsx`
- Modify: `modules/web-app/src/pages/AssetsPage.css`
- Modify: `modules/web-app/src/pages/AssetsPage.test.tsx`
- Modify: `modules/web-app/src/components/SnapshotForm.tsx`
- Modify: `modules/web-app/src/components/SnapshotForm.css`
- Modify: `modules/web-app/src/components/SnapshotForm.test.tsx`
- Modify: `modules/web-app/src/pages/ExchangeRatesPage.tsx`
- Modify: `modules/web-app/src/pages/ExchangeRatesPage.css`
- Modify: `modules/web-app/src/pages/ExchangeRatesPage.test.tsx`
- Modify: `modules/web-app/src/components/TableWorkspace.css`

- [ ] **Step 1: Write failing integration assertions**

For each table, assert a stable resize control exists:

```tsx
expect(await screen.findByRole('separator', { name: '调整名称列宽' })).toBeTruthy()
expect(screen.getByRole('separator', { name: '调整本次金额列宽' })).toBeTruthy()
expect(await screen.findByRole('separator', { name: '调整币种列宽' })).toBeTruthy()
```

Also assert the rendered table owns a fixed layout marker class `resizable-table`.

- [ ] **Step 2: Run the three focused test files and verify RED**

Run: `npm run test:app -- modules/web-app/src/pages/AssetsPage.test.tsx modules/web-app/src/components/SnapshotForm.test.tsx modules/web-app/src/pages/ExchangeRatesPage.test.tsx`

Expected: FAIL because resize controls and the marker class are absent.

- [ ] **Step 3: Connect each table to the hook**

For each page, declare stable defaults, render a `colgroup`, and add a separator button to every header:

```tsx
const { widths, startResize } = useResizableColumns('assets', ASSET_COLUMN_WIDTHS)

<table className="fin-table assets-table resizable-table" aria-label="资产表">
  <colgroup>
    {Object.entries(widths).map(([key, width]) => <col key={key} style={{ width }} />)}
  </colgroup>
  <thead>
    <tr>
      <th className="sortable" onClick={() => toggleSort('name')}>
        名称 {sortIcon('name')}
        <button type="button" role="separator" aria-label="调整名称列宽"
          className="column-resize-handle"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => { event.stopPropagation(); startResize('name', event) }} />
      </th>
    </tr>
  </thead>
</table>
```

Use these table IDs and defaults exactly:

```ts
const ASSET_COLUMN_WIDTHS = {
  name: 180, type: 130, identifier: 150, institution: 140, currency: 90,
  amount: 130, profit: 110, profitRate: 100, status: 90, note: 180, actions: 112,
}
const SNAPSHOT_COLUMN_WIDTHS = {
  included: 72, name: 180, currency: 80, previousAmount: 120,
  amount: 135, delta: 100, profit: 130, profitRate: 110, status: 100,
}
const RATE_COLUMN_WIDTHS = { currency: 120, rate: 220, updatedAt: 240 }
```

Render headers in the same insertion order as these maps so each `colgroup` width maps to the correct cell. Each header receives a separator button whose accessible name is `调整${可见表头}列宽`; sortable asset headers stop pointer and click propagation from the separator so resizing never changes sort order.

- [ ] **Step 4: Enforce compact single-line cells**

In shared table CSS, apply:

```css
.table-workspace-grid th,
.table-workspace-grid td {
  height: 36px;
  min-height: 36px;
  padding-block: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.table-workspace-grid input,
.table-workspace-grid select {
  height: 35px;
  white-space: nowrap;
}
.resizable-table {
  width: max-content;
  table-layout: fixed;
}
```

Remove conflicting `42px` row and `41px` input heights from the page CSS files. Keep wrappers horizontally scrollable.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm run test:app -- modules/web-app/src/pages/AssetsPage.test.tsx modules/web-app/src/components/SnapshotForm.test.tsx modules/web-app/src/pages/ExchangeRatesPage.test.tsx`

Expected: PASS.

- [ ] **Step 6: Run complete verification**

Run: `npm run test:app && npm run build && git diff --check`

Expected: all front-end tests pass, production build succeeds, and no whitespace errors are reported.

- [ ] **Step 7: Commit the table integration**

```bash
git add modules/web-app/src/pages/AssetsPage.tsx modules/web-app/src/pages/AssetsPage.css modules/web-app/src/pages/AssetsPage.test.tsx modules/web-app/src/components/SnapshotForm.tsx modules/web-app/src/components/SnapshotForm.css modules/web-app/src/components/SnapshotForm.test.tsx modules/web-app/src/pages/ExchangeRatesPage.tsx modules/web-app/src/pages/ExchangeRatesPage.css modules/web-app/src/pages/ExchangeRatesPage.test.tsx modules/web-app/src/components/TableWorkspace.css
git commit -m "feat: compact and resize workbook tables"
```

### Task 4: Browser acceptance check

**Files:**
- No source files unless the browser check exposes a defect.

- [ ] **Step 1: Reload the running local app**

Open `http://localhost:5173/` and reload after Vite has applied the changes.

- [ ] **Step 2: Verify the top chrome**

Confirm the brand, Sheet tabs, theme controls, and logout button appear in one row with no standalone navigation strip.

- [ ] **Step 3: Verify the tables**

Check `/assets`, `/entry`, and `/rates`: rows are single-line and compact; each header exposes a resize separator; dragging changes the column width; refreshing keeps the width.

- [ ] **Step 4: Verify regression signals**

Confirm no new browser console errors, asset/snapshot/rate data still load, and resizing does not create an unsaved-data indicator.

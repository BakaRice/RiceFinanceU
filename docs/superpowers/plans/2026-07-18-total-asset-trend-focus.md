# Total Asset Trend Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard asset trend show only total assets and automatically zoom its Y axis around the visible values.

**Architecture:** Add a pure Y-axis domain calculator beside the existing snapshot trend helpers, then derive the domain from `assetChartData` in `DashboardPage`. Keep the existing trend data contract and scale controls, but remove the two category lines from the asset chart so its tooltip and visual focus contain only total assets.

**Tech Stack:** React 19, TypeScript 6, Recharts 3, Vitest, Testing Library

---

## File structure

- `modules/web-app/src/domain/snapshots.ts`: owns the pure total-asset Y-axis domain calculation.
- `modules/web-app/src/domain/snapshots.test.ts`: verifies adaptive ranges and edge cases independently of React.
- `modules/web-app/src/pages/DashboardPage.tsx`: applies the derived domain and renders only the total-asset line.
- `modules/web-app/src/pages/DashboardPage.test.tsx`: verifies the rendered line set, axis domain, scale switching, and isolation from the income chart.

### Task 1: Add the adaptive total-asset Y-axis domain

**Files:**
- Modify: `modules/web-app/src/domain/snapshots.ts`
- Test: `modules/web-app/src/domain/snapshots.test.ts`

- [ ] **Step 1: Write failing domain tests**

Add `calculateTotalAssetYAxisDomain` to the value imports and `TotalAssetPoint` to the type imports from `./snapshots`, then append:

```ts
describe('calculateTotalAssetYAxisDomain', () => {
  const point = (totalAmount: number): TotalAssetPoint => ({
    recordedAt: '2026-07-18',
    periodKey: '2026-07-18',
    periodLabel: '2026-07-18',
    totalAmount,
    investmentAmount: 0,
    balanceAmount: 0,
    totalProfit: 0,
  })

  it('adds ten percent of the visible spread around distinct totals', () => {
    expect(calculateTotalAssetYAxisDomain([
      point(390000),
      point(450000),
    ])).toEqual([384000, 456000])
  })

  it('adds a five percent range around equal totals', () => {
    expect(calculateTotalAssetYAxisDomain([
      point(400000),
      point(400000),
    ])).toEqual([380000, 420000])
  })

  it('never returns a negative lower bound', () => {
    expect(calculateTotalAssetYAxisDomain([
      point(0),
      point(5),
    ])).toEqual([0, 5.5])
  })

  it('returns a safe range for empty or non-finite totals', () => {
    expect(calculateTotalAssetYAxisDomain([])).toEqual([0, 1])
    expect(calculateTotalAssetYAxisDomain([point(Number.NaN)])).toEqual([0, 1])
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run test:app -- modules/web-app/src/domain/snapshots.test.ts
```

Expected: FAIL because `calculateTotalAssetYAxisDomain` is not exported.

- [ ] **Step 3: Implement the minimal pure helper**

Add after `TotalAssetPoint` in `snapshots.ts`:

```ts
export function calculateTotalAssetYAxisDomain(
  points: TotalAssetPoint[],
): [number, number] {
  const amounts = points
    .map((point) => point.totalAmount)
    .filter((amount) => Number.isFinite(amount))

  if (amounts.length === 0) return [0, 1]

  const minimum = Math.min(...amounts)
  const maximum = Math.max(...amounts)
  const spread = maximum - minimum
  const padding = spread > 0
    ? Math.max(spread * 0.1, 1)
    : Math.max(Math.abs(maximum) * 0.05, 1)

  return [Math.max(0, minimum - padding), maximum + padding]
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm run test:app -- modules/web-app/src/domain/snapshots.test.ts
```

Expected: PASS for the snapshot domain test file.

- [ ] **Step 5: Commit the domain behavior**

```bash
git add modules/web-app/src/domain/snapshots.ts modules/web-app/src/domain/snapshots.test.ts
git commit -m "feat: calculate focused asset trend range"
```

### Task 2: Focus the dashboard chart on total assets

**Files:**
- Modify: `modules/web-app/src/pages/DashboardPage.tsx`
- Test: `modules/web-app/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: Make the Recharts test double expose its domain**

Replace the `YAxis` mock with:

```tsx
YAxis: ({ domain }: any) => (
  <div
    data-testid="y-axis"
    data-domain={Array.isArray(domain) ? domain.join('|') : ''}
  />
),
```

- [ ] **Step 2: Write a failing page test for the focused chart**

Add inside `DashboardPage trend scale controls`:

```tsx
it('shows only total assets with an adaptive y-axis range', async () => {
  renderDashboard()

  await screen.findByText('总资产走势')
  const assetPanel = screen.getByTestId('asset-trend-panel')

  expect(within(assetPanel).getByTestId('line-totalAmount').textContent).toBe('总资产')
  expect(within(assetPanel).queryByTestId('line-investmentAmount')).toBeNull()
  expect(within(assetPanel).queryByTestId('line-balanceAmount')).toBeNull()
  expect(within(assetPanel).getByTestId('y-axis').getAttribute('data-domain')).toBe('152|368')

  fireEvent.click(within(assetPanel).getByRole('button', { name: '月' }))

  await waitFor(() => {
    expect(within(assetPanel).getByTestId('y-axis').getAttribute('data-domain')).toBe('240|360')
  })
})
```

- [ ] **Step 3: Run the page test and verify RED**

Run:

```bash
npm run test:app -- modules/web-app/src/pages/DashboardPage.test.tsx
```

Expected: FAIL because the category lines still render and the asset Y axis has no explicit domain.

- [ ] **Step 4: Apply the helper and remove category lines**

Add the helper to the snapshots import:

```ts
import {
  calculateSnapshotTotal,
  calculateAllocation,
  compareSnapshots,
  buildScaledTotalAssetSeries,
  calculateTotalAssetYAxisDomain,
} from '../domain/snapshots'
```

Derive the range immediately after `assetChartData`:

```ts
const assetYAxisDomain = useMemo(
  () => calculateTotalAssetYAxisDomain(assetChartData),
  [assetChartData],
)
```

Pass it to the asset `YAxis`:

```tsx
<YAxis
  yAxisId="asset"
  domain={assetYAxisDomain}
  tick={{ fontSize: 11 }}
  tickFormatter={(v) =>
    v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v)
  }
/>
```

Keep the existing `totalAmount` line and delete the complete `investmentAmount` and `balanceAmount` `<Line>` elements from the asset chart.

- [ ] **Step 5: Run the page test and verify GREEN**

Run:

```bash
npm run test:app -- modules/web-app/src/pages/DashboardPage.test.tsx
```

Expected: PASS, including existing independent asset/income scale tests.

- [ ] **Step 6: Commit the focused chart**

```bash
git add modules/web-app/src/pages/DashboardPage.tsx modules/web-app/src/pages/DashboardPage.test.tsx
git commit -m "feat: focus trend chart on total assets"
```

### Task 3: Verify the complete change

**Files:**
- Verify: `modules/web-app/src/domain/snapshots.ts`
- Verify: `modules/web-app/src/domain/snapshots.test.ts`
- Verify: `modules/web-app/src/pages/DashboardPage.tsx`
- Verify: `modules/web-app/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: Run all frontend tests**

```bash
npm run test:app
```

Expected: all Vitest suites pass with no errors.

- [ ] **Step 2: Run the production build**

```bash
npm run build
```

Expected: TypeScript checking and the Vite production build both succeed.

- [ ] **Step 3: Review the final diff**

```bash
git diff HEAD~2 --check
git diff HEAD~2 -- modules/web-app/src/domain/snapshots.ts modules/web-app/src/domain/snapshots.test.ts modules/web-app/src/pages/DashboardPage.tsx modules/web-app/src/pages/DashboardPage.test.tsx
```

Expected: no whitespace errors; the diff contains only the helper, its tests, the chart domain, the single-line rendering change, and test-double support.

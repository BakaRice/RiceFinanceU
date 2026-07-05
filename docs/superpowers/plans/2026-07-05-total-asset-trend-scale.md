# Total Asset Trend Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add day, week, month, quarter, and year scale switching to the dashboard total asset trend chart.

**Architecture:** Keep aggregation in the frontend domain layer because the dashboard already loads snapshots, snapshot values, assets, and exchange rates. Add a pure `buildScaledTotalAssetSeries` function that buckets snapshots by local period and keeps the latest snapshot per bucket, then render a compact segmented control in `DashboardPage`.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Recharts, plain CSS.

---

## File Structure

- Modify `src/domain/snapshots.ts`: define `TrendScale`, add period bucketing helpers, add `buildScaledTotalAssetSeries`, and keep `buildTotalAssetSeries` as a day-scale wrapper.
- Modify `src/domain/snapshots.test.ts`: add focused tests for period bucketing, latest snapshot selection, sorting, and exchange-rate conversion.
- Create `src/pages/DashboardPage.test.tsx`: mock the API and Recharts, then verify scale controls and chart data labels.
- Modify `src/pages/DashboardPage.tsx`: derive chart data with `useMemo`, add scale state, add segmented controls, switch the X axis to `periodLabel`, and add a custom tooltip.
- Modify `src/pages/DashboardPage.css`: style the chart header, segmented control, tooltip, and mobile wrapping.

## Task 1: Domain Trend Scale Aggregation

**Files:**
- Modify: `src/domain/snapshots.test.ts`
- Modify: `src/domain/snapshots.ts`

- [ ] **Step 1: Write the failing domain tests**

In `src/domain/snapshots.test.ts`, update the import from `./snapshots` so it includes `buildScaledTotalAssetSeries`:

```ts
import {
  completeSnapshotValues,
  calculateSnapshotTotal,
  calculateAllocation,
  compareSnapshots,
  buildTotalAssetSeries,
  buildScaledTotalAssetSeries,
} from './snapshots'
```

Append this describe block after the existing `describe('buildTotalAssetSeries', ...)` block:

```ts
// —— buildScaledTotalAssetSeries ——

describe('buildScaledTotalAssetSeries', () => {
  it('keeps the latest snapshot in each day bucket', () => {
    const assets = [makeAsset({ id: 'a1', type: 'fund' })]
    const snapshots: Snapshot[] = [
      { id: 'morning', recordedAt: '2026-07-05T09:00:00', createdAt: '2026-07-05T09:00:00' },
      { id: 'night', recordedAt: '2026-07-05T21:30:00', createdAt: '2026-07-05T21:30:00' },
    ]
    const valuesBySnapshot = new Map<string, SnapshotValue[]>([
      ['morning', [makeValue({ snapshotId: 'morning', assetId: 'a1', amount: 100 })]],
      ['night', [makeValue({ snapshotId: 'night', assetId: 'a1', amount: 150 })]],
    ])

    const series = buildScaledTotalAssetSeries(snapshots, valuesBySnapshot, assets, 'day')

    expect(series).toHaveLength(1)
    expect(series[0].periodKey).toBe('2026-07-05')
    expect(series[0].periodLabel).toBe('2026-07-05')
    expect(series[0].recordedAt).toBe('2026-07-05T21:30:00')
    expect(series[0].totalAmount).toBe(150)
  })

  it('groups weeks from Monday to Sunday', () => {
    const assets = [makeAsset({ id: 'a1', type: 'fund' })]
    const snapshots: Snapshot[] = [
      { id: 'sunday', recordedAt: '2026-07-05T12:00:00', createdAt: '2026-07-05T12:00:00' },
      { id: 'wednesday', recordedAt: '2026-07-08T12:00:00', createdAt: '2026-07-08T12:00:00' },
    ]
    const valuesBySnapshot = new Map<string, SnapshotValue[]>([
      ['sunday', [makeValue({ snapshotId: 'sunday', assetId: 'a1', amount: 100 })]],
      ['wednesday', [makeValue({ snapshotId: 'wednesday', assetId: 'a1', amount: 200 })]],
    ])

    const series = buildScaledTotalAssetSeries(snapshots, valuesBySnapshot, assets, 'week')

    expect(series.map((point) => point.periodKey)).toEqual(['2026-06-29', '2026-07-06'])
    expect(series.map((point) => point.periodLabel)).toEqual(['2026-06-29 周', '2026-07-06 周'])
    expect(series.map((point) => point.totalAmount)).toEqual([100, 200])
  })

  it('builds sorted quarter labels across years', () => {
    const assets = [makeAsset({ id: 'a1', type: 'deposit' })]
    const snapshots: Snapshot[] = [
      { id: 'q3', recordedAt: '2026-07-01T12:00:00', createdAt: '2026-07-01T12:00:00' },
      { id: 'q4prev', recordedAt: '2025-12-31T12:00:00', createdAt: '2025-12-31T12:00:00' },
      { id: 'q1', recordedAt: '2026-01-01T12:00:00', createdAt: '2026-01-01T12:00:00' },
      { id: 'q2', recordedAt: '2026-04-01T12:00:00', createdAt: '2026-04-01T12:00:00' },
    ]
    const valuesBySnapshot = new Map<string, SnapshotValue[]>([
      ['q3', [makeValue({ snapshotId: 'q3', assetId: 'a1', amount: 400 })]],
      ['q4prev', [makeValue({ snapshotId: 'q4prev', assetId: 'a1', amount: 100 })]],
      ['q1', [makeValue({ snapshotId: 'q1', assetId: 'a1', amount: 200 })]],
      ['q2', [makeValue({ snapshotId: 'q2', assetId: 'a1', amount: 300 })]],
    ])

    const series = buildScaledTotalAssetSeries(snapshots, valuesBySnapshot, assets, 'quarter')

    expect(series.map((point) => point.periodKey)).toEqual(['2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3'])
    expect(series.map((point) => point.periodLabel)).toEqual(['2025 Q4', '2026 Q1', '2026 Q2', '2026 Q3'])
    expect(series.map((point) => point.totalAmount)).toEqual([100, 200, 300, 400])
  })

  it('applies exchange rates to scaled trend points', () => {
    const assets = [makeAsset({ id: 'usd', type: 'stock', currency: 'USD' })]
    const snapshots: Snapshot[] = [
      { id: 's1', recordedAt: '2026-07-05T12:00:00', createdAt: '2026-07-05T12:00:00' },
    ]
    const valuesBySnapshot = new Map<string, SnapshotValue[]>([
      ['s1', [makeValue({ snapshotId: 's1', assetId: 'usd', amount: 10, profit: 2 })]],
    ])

    const series = buildScaledTotalAssetSeries(
      snapshots,
      valuesBySnapshot,
      assets,
      'month',
      { USD: 7, HKD: 0.9, updatedAt: '2026-07-05T00:00:00' },
    )

    expect(series).toHaveLength(1)
    expect(series[0].periodKey).toBe('2026-07')
    expect(series[0].periodLabel).toBe('2026-07')
    expect(series[0].totalAmount).toBe(70)
    expect(series[0].totalProfit).toBe(14)
  })

  it('returns empty series for empty or invalid snapshots', () => {
    const invalidSnapshots: Snapshot[] = [
      { id: 'bad', recordedAt: 'not-a-date', createdAt: '2026-07-05T00:00:00' },
    ]

    expect(buildScaledTotalAssetSeries([], new Map(), [], 'year')).toEqual([])
    expect(buildScaledTotalAssetSeries(invalidSnapshots, new Map(), [], 'year')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the domain tests and verify they fail**

Run:

```bash
npx vitest run src/domain/snapshots.test.ts
```

Expected result: FAIL. The failure should say that `buildScaledTotalAssetSeries` is not exported from `src/domain/snapshots.ts` or is not a function.

- [ ] **Step 3: Add the scaled trend implementation**

In `src/domain/snapshots.ts`, replace the current total asset history series section, starting at `// ——— Total asset history series ———`, with this code:

```ts
// ——— Total asset history series ———

export type TrendScale = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface TotalAssetPoint {
  recordedAt: string
  periodKey: string
  periodLabel: string
  totalAmount: number
  investmentAmount: number
  balanceAmount: number
  totalProfit: number
}

interface TrendPeriod {
  key: string
  label: string
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function getMondayStart(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  return start
}

function getTrendPeriod(date: Date, scale: TrendScale): TrendPeriod {
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  switch (scale) {
    case 'week': {
      const weekStart = getMondayStart(date)
      const key = formatLocalDateKey(weekStart)
      return { key, label: `${key} 周` }
    }
    case 'month': {
      const key = `${year}-${pad2(month)}`
      return { key, label: key }
    }
    case 'quarter': {
      const quarter = Math.floor((month - 1) / 3) + 1
      return { key: `${year}-Q${quarter}`, label: `${year} Q${quarter}` }
    }
    case 'year': {
      const key = String(year)
      return { key, label: key }
    }
    case 'day':
    default: {
      const key = formatLocalDateKey(date)
      return { key, label: key }
    }
  }
}

export function buildScaledTotalAssetSeries(
  snapshots: Snapshot[],
  valuesBySnapshot: Map<string, SnapshotValue[]>,
  assets: Asset[],
  scale: TrendScale,
  rates?: ExchangeRates
): TotalAssetPoint[] {
  const sorted = [...snapshots].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
  const pointsByPeriod = new Map<string, TotalAssetPoint>()

  for (const snap of sorted) {
    const date = new Date(snap.recordedAt)
    const snapshotTime = date.getTime()
    if (Number.isNaN(snapshotTime)) continue

    const period = getTrendPeriod(date, scale)
    const existing = pointsByPeriod.get(period.key)
    const existingTime = existing ? new Date(existing.recordedAt).getTime() : Number.NEGATIVE_INFINITY

    if (!existing || snapshotTime >= existingTime) {
      const values = valuesBySnapshot.get(snap.id) || []
      const total = calculateSnapshotTotal(values, assets, rates)
      pointsByPeriod.set(period.key, {
        recordedAt: snap.recordedAt,
        periodKey: period.key,
        periodLabel: period.label,
        totalAmount: total.totalAmountCNY,
        investmentAmount: total.investmentAmountCNY,
        balanceAmount: total.balanceAmountCNY,
        totalProfit: total.totalProfitCNY,
      })
    }
  }

  return [...pointsByPeriod.values()].sort((a, b) => a.periodKey.localeCompare(b.periodKey))
}

export function buildTotalAssetSeries(
  snapshots: Snapshot[],
  valuesBySnapshot: Map<string, SnapshotValue[]>,
  assets: Asset[],
  rates?: ExchangeRates
): TotalAssetPoint[] {
  return buildScaledTotalAssetSeries(snapshots, valuesBySnapshot, assets, 'day', rates)
}
```

- [ ] **Step 4: Run the domain tests and verify they pass**

Run:

```bash
npx vitest run src/domain/snapshots.test.ts
```

Expected result: PASS for all tests in `src/domain/snapshots.test.ts`.

- [ ] **Step 5: Commit the domain change**

Run:

```bash
git add src/domain/snapshots.ts src/domain/snapshots.test.ts
git commit -m "feat: aggregate asset trend by scale"
```

Expected result: a commit containing only the domain implementation and domain tests.

## Task 2: Dashboard Scale Control and Tooltip

**Files:**
- Create: `src/pages/DashboardPage.test.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.css`

- [ ] **Step 1: Write the failing dashboard test**

Create `src/pages/DashboardPage.test.tsx` with this complete file:

```tsx
/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '../components/Feedback/FeedbackContext'
import { api } from '../api/client'
import DashboardPage from './DashboardPage'

vi.mock('../api/client', () => ({
  api: {
    getAssets: vi.fn(),
    getLatestSnapshot: vi.fn(),
    getSnapshots: vi.fn(),
    getSnapshotValues: vi.fn(),
    getRates: vi.fn(),
    deleteSnapshot: vi.fn(),
    updateRates: vi.fn(),
  },
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ data, children }: any) => (
    <div
      data-testid="line-chart"
      data-point-count={data.length}
      data-point-labels={data.map((point: any) => point.periodLabel).join('|')}
    >
      {children}
    </div>
  ),
  Line: ({ dataKey, name }: any) => <div data-testid={`line-${dataKey}`}>{name}</div>,
  XAxis: ({ dataKey }: any) => <div data-testid="x-axis">{dataKey}</div>,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}))

const mockedApi = vi.mocked(api)

function renderDashboard() {
  return render(
    <FeedbackProvider>
      <DashboardPage />
    </FeedbackProvider>,
  )
}

describe('DashboardPage trend scale controls', () => {
  beforeEach(() => {
    vi.restoreAllMocks()

    const assets = [
      {
        id: 'fund',
        name: '指数基金',
        type: 'fund',
        currency: 'CNY',
        isActive: true,
        createdAt: '2026-01-01T00:00:00',
        updatedAt: '2026-01-01T00:00:00',
      },
      {
        id: 'cash',
        name: '现金',
        type: 'cash',
        currency: 'CNY',
        isActive: true,
        createdAt: '2026-01-01T00:00:00',
        updatedAt: '2026-01-01T00:00:00',
      },
    ]
    const snapshots = [
      { id: 's1', recordedAt: '2026-07-05T09:00:00', createdAt: '2026-07-05T09:00:00' },
      { id: 's2', recordedAt: '2026-07-05T21:00:00', createdAt: '2026-07-05T21:00:00' },
      { id: 's3', recordedAt: '2026-07-08T10:00:00', createdAt: '2026-07-08T10:00:00' },
      { id: 's4', recordedAt: '2026-10-02T10:00:00', createdAt: '2026-10-02T10:00:00' },
    ]
    const snapshotValues = [
      { id: 'v1', snapshotId: 's1', assetId: 'fund', amount: 100 },
      { id: 'v2', snapshotId: 's1', assetId: 'cash', amount: 50 },
      { id: 'v3', snapshotId: 's2', assetId: 'fund', amount: 120 },
      { id: 'v4', snapshotId: 's2', assetId: 'cash', amount: 50 },
      { id: 'v5', snapshotId: 's3', assetId: 'fund', amount: 200 },
      { id: 'v6', snapshotId: 's3', assetId: 'cash', amount: 50 },
      { id: 'v7', snapshotId: 's4', assetId: 'fund', amount: 300 },
      { id: 'v8', snapshotId: 's4', assetId: 'cash', amount: 50 },
    ]

    mockedApi.getAssets.mockResolvedValue(assets as any)
    mockedApi.getLatestSnapshot.mockResolvedValue({
      snapshot: snapshots[3],
      values: snapshotValues.filter((value) => value.snapshotId === 's4'),
    } as any)
    mockedApi.getSnapshots.mockResolvedValue(snapshots as any)
    mockedApi.getSnapshotValues.mockResolvedValue(snapshotValues as any)
    mockedApi.getRates.mockResolvedValue({ USD: 7.2, HKD: 0.92, updatedAt: '2026-07-05T00:00:00' })
  })

  it('renders day, week, month, quarter, and year trend controls', async () => {
    renderDashboard()

    await screen.findByText('总资产走势')

    expect(screen.getByRole('button', { name: '日' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '周' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '月' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '季' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '年' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '日' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('x-axis').textContent).toBe('periodLabel')
  })

  it('switches chart data to the selected scale without reloading api data', async () => {
    renderDashboard()

    await screen.findByText('总资产走势')
    const chart = screen.getByTestId('line-chart')
    expect(chart.getAttribute('data-point-count')).toBe('3')
    expect(chart.getAttribute('data-point-labels')).toBe('2026-07-05|2026-07-08|2026-10-02')

    fireEvent.click(screen.getByRole('button', { name: '月' }))

    await waitFor(() => {
      expect(screen.getByTestId('line-chart').getAttribute('data-point-count')).toBe('2')
    })
    expect(screen.getByTestId('line-chart').getAttribute('data-point-labels')).toBe('2026-07|2026-10')
    expect(screen.getByRole('button', { name: '月' }).getAttribute('aria-pressed')).toBe('true')
    expect(mockedApi.getSnapshots).toHaveBeenCalledTimes(1)
    expect(mockedApi.getSnapshotValues).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the dashboard test and verify it fails**

Run:

```bash
npx vitest run src/pages/DashboardPage.test.tsx
```

Expected result: FAIL. The failure should say Testing Library cannot find a button named `日` or `月`.

- [ ] **Step 3: Update dashboard imports, scale options, and tooltip helpers**

In `src/pages/DashboardPage.tsx`, change the first import to include `useMemo`:

```ts
import { useState, useEffect, useMemo } from 'react'
```

Change the snapshots domain import to use `buildScaledTotalAssetSeries`:

```ts
import {
  calculateSnapshotTotal,
  calculateAllocation,
  compareSnapshots,
  buildScaledTotalAssetSeries,
} from '../domain/snapshots'
```

Change the type import from `../domain/snapshots` to include `TrendScale`:

```ts
import type {
  SnapshotTotal,
  AllocationItem,
  SnapshotComparison as SnapshotComparisonType,
  TotalAssetPoint,
  TrendScale,
} from '../domain/snapshots'
```

Add these constants and helper components after the Recharts import block and before `export default function DashboardPage()`:

```tsx
const TREND_SCALE_OPTIONS: Array<{ value: TrendScale; label: string }> = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'quarter', label: '季' },
  { value: 'year', label: '年' },
]

function formatChartDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatChartMoney(value: unknown): string {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null

  const point = payload[0].payload as TotalAssetPoint

  return (
    <div className="trend-tooltip">
      <div className="trend-tooltip-row">
        <span>周期</span>
        <strong>{label}</strong>
      </div>
      <div className="trend-tooltip-row">
        <span>实际快照</span>
        <strong>{formatChartDateTime(point.recordedAt)}</strong>
      </div>
      {payload.map((item: any) => (
        <div key={item.dataKey} className="trend-tooltip-row">
          <span>{item.name}</span>
          <strong>{formatChartMoney(item.value)}</strong>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Replace chart state with derived chart data**

In `DashboardPage`, replace this state line:

```ts
const [chartData, setChartData] = useState<TotalAssetPoint[]>([])
```

with this line:

```ts
const [trendScale, setTrendScale] = useState<TrendScale>('day')
```

After the `load()` function and before `async function handleDelete(id: string)`, add this derived chart data:

```ts
const activeAssetsForChart = useMemo(
  () => allAssets.filter((asset) => asset.isActive),
  [allAssets]
)

const chartValuesBySnapshot = useMemo(() => {
  const map = new Map<string, SnapshotValue[]>()
  for (const value of allValues) {
    const list = map.get(value.snapshotId) || []
    list.push(value)
    map.set(value.snapshotId, list)
  }
  return map
}, [allValues])

const chartData = useMemo(
  () =>
    buildScaledTotalAssetSeries(
      allSnapshots,
      chartValuesBySnapshot,
      activeAssetsForChart,
      trendScale,
      rates
    ),
  [allSnapshots, chartValuesBySnapshot, activeAssetsForChart, trendScale, rates]
)
```

Inside `load()`, delete this block:

```ts
setChartData(
  buildTotalAssetSeries(sortedSnapshots, valuesBySnapshot, activeAssets, ratesData)
)
```

Do not delete the local `valuesBySnapshot` map in `load()` because the comparison calculation still uses it.

- [ ] **Step 5: Add the chart scale controls and tooltip to the JSX**

In the chart section JSX, replace:

```tsx
<h3 className="section-title">总资产走势</h3>
```

with:

```tsx
<div className="chart-section-head">
  <h3 className="section-title">总资产走势</h3>
  <div className="trend-scale-control" aria-label="走势图尺度">
    {TREND_SCALE_OPTIONS.map((option) => (
      <button
        key={option.value}
        type="button"
        className={`trend-scale-btn ${trendScale === option.value ? 'active' : ''}`}
        aria-pressed={trendScale === option.value}
        onClick={() => setTrendScale(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
</div>
```

In the same chart section, replace:

```tsx
<XAxis dataKey="recordedAt" tick={{ fontSize: 11 }} />
```

with:

```tsx
<XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} />
```

Replace the existing `<Tooltip ... />` block with:

```tsx
<Tooltip content={<TrendTooltip />} />
```

- [ ] **Step 6: Add the chart control and tooltip CSS**

Append this CSS after the existing `.chart-container` rule in `src/pages/DashboardPage.css`:

```css
.chart-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-sm);
}

.chart-section-head .section-title {
  margin-bottom: 0;
}

.trend-scale-control {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-surface-muted);
  flex-shrink: 0;
}

.trend-scale-btn {
  height: 26px;
  min-width: 32px;
  padding: 0 9px;
  border: 0;
  border-right: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  font-family: var(--font-family);
  font-size: var(--font-size-sm);
  line-height: 26px;
}

.trend-scale-btn:last-child {
  border-right: 0;
}

.trend-scale-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-primary);
}

.trend-scale-btn.active,
.trend-scale-btn[aria-pressed='true'] {
  background: var(--color-primary);
  color: #fff;
}

.trend-tooltip {
  min-width: 190px;
  padding: 10px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-overlay);
  font-size: var(--font-size-sm);
}

.trend-tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 6px;
}

.trend-tooltip-row:last-child {
  margin-bottom: 0;
}

.trend-tooltip-row span {
  color: var(--color-text-muted);
}

.trend-tooltip-row strong {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
```

Inside the existing `@media (max-width: 768px)` block in `src/pages/DashboardPage.css`, add:

```css
  .chart-section-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .trend-scale-control {
    width: 100%;
  }

  .trend-scale-btn {
    flex: 1;
  }
```

- [ ] **Step 7: Run the dashboard test and verify it passes**

Run:

```bash
npx vitest run src/pages/DashboardPage.test.tsx
```

Expected result: PASS for both tests in `src/pages/DashboardPage.test.tsx`.

- [ ] **Step 8: Run the focused app tests**

Run:

```bash
npx vitest run src/domain/snapshots.test.ts src/pages/DashboardPage.test.tsx
```

Expected result: PASS for both test files.

- [ ] **Step 9: Commit the dashboard change**

Run:

```bash
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.css src/pages/DashboardPage.test.tsx
git commit -m "feat: add dashboard trend scale controls"
```

Expected result: a commit containing only dashboard UI, CSS, and dashboard tests.

## Task 3: Full Verification and Local Smoke Test

**Files:**
- No source files should be modified in this task.

- [ ] **Step 1: Run the app test suite**

Run:

```bash
npm run test:app
```

Expected result: Vitest exits successfully.

- [ ] **Step 2: Run the worker test suite**

Run:

```bash
npm run worker:test
```

Expected result: Node test runner exits successfully.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected result: TypeScript and Vite build successfully.

- [ ] **Step 4: Start the local dev server**

Run:

```bash
npm run dev
```

Expected result: Vite prints a local URL, normally `http://localhost:5173/`. Keep this session running until the browser smoke test is complete.

- [ ] **Step 5: Smoke test the dashboard in a browser**

Open the local URL printed by Vite. If login is required, use the existing local session or log in with the configured local credentials. Navigate to `总览` and verify:

1. The `总资产走势` card shows `日` selected by default.
2. The scale buttons read `日`, `周`, `月`, `季`, `年`.
3. Clicking each scale updates the X-axis labels.
4. Hovering a point shows both `周期` and `实际快照`.
5. The `快照历史` section still lists individual snapshots.

- [ ] **Step 6: Stop the local dev server**

Stop the Vite process with `Ctrl-C`.

- [ ] **Step 7: Check git status**

Run:

```bash
git status --short
```

Expected result: no uncommitted changes except artifacts that are intentionally ignored by `.gitignore`.

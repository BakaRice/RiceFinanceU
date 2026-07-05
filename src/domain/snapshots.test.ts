// src/domain/snapshots.test.ts
import { describe, it, expect } from 'vitest'
import {
  completeSnapshotValues,
  calculateSnapshotTotal,
  calculateAllocation,
  compareSnapshots,
  buildTotalAssetSeries,
  buildScaledTotalAssetSeries,
} from './snapshots'
import type { Asset, Snapshot, SnapshotValue, CreateSnapshotInput } from '../types/finance'

const makeAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'a1',
  name: '测试',
  type: 'fund',
  currency: 'CNY',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

const makeValue = (overrides: Partial<SnapshotValue> = {}): SnapshotValue => ({
  id: 'v1',
  snapshotId: 's1',
  assetId: 'a1',
  amount: 10000,
  ...overrides,
})

// —— completeSnapshotValues ——

describe('completeSnapshotValues', () => {
  it('copies all previous values when input is empty', () => {
    const prev = [makeValue({ assetId: 'a1', amount: 1000 }), makeValue({ assetId: 'a2', amount: 2000 })]
    const result = completeSnapshotValues(prev, [], {})
    expect(result).toHaveLength(2)
    expect(result[0].amount).toBe(1000)
    expect(result[1].amount).toBe(2000)
  })

  it('overrides submitted asset values', () => {
    const prev = [makeValue({ assetId: 'a1', amount: 1000 }), makeValue({ assetId: 'a2', amount: 2000 })]
    const input: CreateSnapshotInput['values'] = [{ assetId: 'a1', amount: 1500 }]
    const result = completeSnapshotValues(prev, input, {})
    expect(result).toHaveLength(2)
    expect(result.find((v) => v.assetId === 'a1')!.amount).toBe(1500)
    expect(result.find((v) => v.assetId === 'a2')!.amount).toBe(2000)
  })

  it('adds new asset from input', () => {
    const prev = [makeValue({ assetId: 'a1', amount: 1000 })]
    const input: CreateSnapshotInput['values'] = [{ assetId: 'a2', amount: 500 }]
    const result = completeSnapshotValues(prev, input, {})
    expect(result).toHaveLength(2)
    expect(result.find((v) => v.assetId === 'a2')!.amount).toBe(500)
  })

  it('supports inline new assets via newAssetIds map', () => {
    const prev = [makeValue({ assetId: 'a1', amount: 1000 })]
    const input: CreateSnapshotInput['values'] = [{ amount: 800 }]
    const result = completeSnapshotValues(prev, input, { inline_0: 'new-id' })
    expect(result).toHaveLength(2)
    expect(result.find((v) => v.assetId === 'new-id')!.amount).toBe(800)
  })

  it('saves profit and profitRate for investment assets', () => {
    const prev: SnapshotValue[] = []
    const input: CreateSnapshotInput['values'] = [{ assetId: 'a1', amount: 10000, profit: 500, profitRate: 0.05 }]
    const result = completeSnapshotValues(prev, input, {})
    expect(result).toHaveLength(1)
    expect(result[0].profit).toBe(500)
    expect(result[0].profitRate).toBe(0.05)
  })

  it('rounds amount to 2 decimal places', () => {
    const prev: SnapshotValue[] = []
    const input: CreateSnapshotInput['values'] = [{ assetId: 'a1', amount: 100.555 }]
    const result = completeSnapshotValues(prev, input, {})
    expect(result[0].amount).toBe(100.56)
  })
})

// —— calculateSnapshotTotal ——

describe('calculateSnapshotTotal', () => {
  it('sums all values', () => {
    const assets = [makeAsset({ id: 'a1', type: 'fund' }), makeAsset({ id: 'a2', type: 'deposit' })]
    const values = [makeValue({ assetId: 'a1', amount: 10000 }), makeValue({ assetId: 'a2', amount: 5000 })]
    const total = calculateSnapshotTotal(values, assets)
    expect(total.totalAmount).toBe(15000)
  })

  it('separates investment and balance amounts', () => {
    const assets = [
      makeAsset({ id: 'f1', type: 'fund' }),
      makeAsset({ id: 's1', type: 'stock' }),
      makeAsset({ id: 'd1', type: 'deposit' }),
      makeAsset({ id: 'c1', type: 'cash' }),
    ]
    const values = [
      makeValue({ assetId: 'f1', amount: 100 }),
      makeValue({ assetId: 's1', amount: 200 }),
      makeValue({ assetId: 'd1', amount: 300 }),
      makeValue({ assetId: 'c1', amount: 400 }),
    ]
    const total = calculateSnapshotTotal(values, assets)
    expect(total.investmentAmount).toBe(300)
    expect(total.balanceAmount).toBe(700)
    expect(total.totalAmount).toBe(1000)
  })

  it('sums profits from investment assets only', () => {
    const assets = [makeAsset({ id: 'f1', type: 'fund' }), makeAsset({ id: 'd1', type: 'deposit' })]
    const values = [
      makeValue({ assetId: 'f1', amount: 100, profit: 10 }),
      makeValue({ assetId: 'd1', amount: 200 }), // no profit for deposit
    ]
    const total = calculateSnapshotTotal(values, assets)
    expect(total.totalProfit).toBe(10)
  })

  it('ignores non-finite profit values', () => {
    const assets = [makeAsset({ id: 'f1', type: 'fund' })]
    const values = [makeValue({ assetId: 'f1', amount: 100, profit: Infinity })]
    const total = calculateSnapshotTotal(values, assets)
    expect(total.totalProfit).toBe(0)
  })

  it('handles empty values', () => {
    const total = calculateSnapshotTotal([], [])
    expect(total.totalAmount).toBe(0)
    expect(total.investmentAmount).toBe(0)
    expect(total.balanceAmount).toBe(0)
    expect(total.totalProfit).toBe(0)
  })

  it('handles asset not found in asset map (treats as balance)', () => {
    const values = [makeValue({ assetId: 'unknown', amount: 500 })]
    const total = calculateSnapshotTotal(values, [])
    expect(total.balanceAmount).toBe(500)
    expect(total.investmentAmount).toBe(0)
  })
})

// —— calculateAllocation ——

describe('calculateAllocation', () => {
  it('computes allocation by asset type', () => {
    const assets = [
      makeAsset({ id: 'f1', type: 'fund' }),
      makeAsset({ id: 'f2', type: 'fund' }),
      makeAsset({ id: 'd1', type: 'deposit' }),
    ]
    const values = [
      makeValue({ assetId: 'f1', amount: 300 }),
      makeValue({ assetId: 'f2', amount: 300 }),
      makeValue({ assetId: 'd1', amount: 400 }),
    ]
    const alloc = calculateAllocation(values, assets)
    expect(alloc.find((a) => a.type === 'fund')!.amount).toBe(600)
    expect(alloc.find((a) => a.type === 'fund')!.percentage).toBe(60)
    expect(alloc.find((a) => a.type === 'deposit')!.amount).toBe(400)
    expect(alloc.find((a) => a.type === 'deposit')!.percentage).toBe(40)
  })

  it('sorted by amount descending', () => {
    const assets = [
      makeAsset({ id: 'd1', type: 'deposit' }),
      makeAsset({ id: 'f1', type: 'fund' }),
    ]
    const values = [makeValue({ assetId: 'd1', amount: 800 }), makeValue({ assetId: 'f1', amount: 200 })]
    const alloc = calculateAllocation(values, assets)
    expect(alloc[0].type).toBe('deposit')
  })

  it('returns empty array for empty values', () => {
    expect(calculateAllocation([], [])).toEqual([])
  })
})

// —— compareSnapshots ——

describe('compareSnapshots', () => {
  it('computes amount change between two snapshots', () => {
    const assets = [makeAsset({ id: 'a1', type: 'fund', name: '测试基金' })]
    const prev = [makeValue({ snapshotId: 's1', assetId: 'a1', amount: 1000 })]
    const curr = [makeValue({ snapshotId: 's2', assetId: 'a1', amount: 1200 })]
    const cmp = compareSnapshots(assets, prev, curr)
    expect(cmp.items).toHaveLength(1)
    expect(cmp.items[0].amountChange).toBe(200)
    expect(cmp.totalAmountChange).toBe(200)
  })

  it('computes profit change for investment assets', () => {
    const assets = [makeAsset({ id: 'a1', type: 'fund', name: '测试基金' })]
    const prev = [makeValue({ snapshotId: 's1', assetId: 'a1', amount: 1000, profit: 50 })]
    const curr = [makeValue({ snapshotId: 's2', assetId: 'a1', amount: 1200, profit: 80 })]
    const cmp = compareSnapshots(assets, prev, curr)
    expect(cmp.items[0].profitChange).toBe(30)
    expect(cmp.totalProfitChange).toBe(30)
  })

  it('does not compute profit change for balance assets', () => {
    const assets = [makeAsset({ id: 'a1', type: 'deposit', name: '存款' })]
    const prev = [makeValue({ snapshotId: 's1', assetId: 'a1', amount: 1000 })]
    const curr = [makeValue({ snapshotId: 's2', assetId: 'a1', amount: 1200 })]
    const cmp = compareSnapshots(assets, prev, curr)
    expect(cmp.items[0].profitChange).toBeUndefined()
    expect(cmp.totalProfitChange).toBe(0)
  })

  it('handles new assets appearing in current snapshot', () => {
    const assets = [
      makeAsset({ id: 'a1', type: 'fund', name: '老基金' }),
      makeAsset({ id: 'a2', type: 'fund', name: '新基金' }),
    ]
    const prev = [makeValue({ snapshotId: 's1', assetId: 'a1', amount: 1000 })]
    const curr = [
      makeValue({ snapshotId: 's2', assetId: 'a1', amount: 1100 }),
      makeValue({ snapshotId: 's2', assetId: 'a2', amount: 500 }),
    ]
    const cmp = compareSnapshots(assets, prev, curr)
    expect(cmp.items).toHaveLength(2)
    const newItem = cmp.items.find((i) => i.assetId === 'a2')!
    expect(newItem.previousAmount).toBe(0)
    expect(newItem.amountChange).toBe(500)
  })

  it('profit change is undefined when either side missing profit', () => {
    const assets = [makeAsset({ id: 'a1', type: 'fund', name: '基金' })]
    const prev = [makeValue({ snapshotId: 's1', assetId: 'a1', amount: 1000 })]
    const curr = [makeValue({ snapshotId: 's2', assetId: 'a1', amount: 1200, profit: 80 })]
    const cmp = compareSnapshots(assets, prev, curr)
    expect(cmp.items[0].profitChange).toBeUndefined()
  })
})

// —— buildTotalAssetSeries ——

describe('buildTotalAssetSeries', () => {
  it('builds time series from snapshots', () => {
    const assets = [
      makeAsset({ id: 'a1', type: 'fund' }),
      makeAsset({ id: 'a2', type: 'deposit' }),
    ]
    const snapshots: Snapshot[] = [
      { id: 's1', recordedAt: '2026-01-01', createdAt: '2026-01-01T00:00:00Z' },
      { id: 's2', recordedAt: '2026-02-01', createdAt: '2026-02-01T00:00:00Z' },
    ]
    const valuesBySnapshot = new Map<string, SnapshotValue[]>([
      ['s1', [makeValue({ snapshotId: 's1', assetId: 'a1', amount: 100 }), makeValue({ snapshotId: 's1', assetId: 'a2', amount: 200 })]],
      ['s2', [makeValue({ snapshotId: 's2', assetId: 'a1', amount: 150 }), makeValue({ snapshotId: 's2', assetId: 'a2', amount: 250 })]],
    ])
    const series = buildTotalAssetSeries(snapshots, valuesBySnapshot, assets)
    expect(series).toHaveLength(2)
    expect(series[0].periodKey).toBe('2026-01-01')
    expect(series[0].periodLabel).toBe('2026-01-01')
    expect(series[0].totalAmount).toBe(300)
    expect(series[1].periodKey).toBe('2026-02-01')
    expect(series[1].periodLabel).toBe('2026-02-01')
    expect(series[1].totalAmount).toBe(400)
  })

  it('sorts snapshots chronologically', () => {
    const snapshots: Snapshot[] = [
      { id: 's2', recordedAt: '2026-03-01', createdAt: '2026-03-01T00:00:00Z' },
      { id: 's1', recordedAt: '2026-01-01', createdAt: '2026-01-01T00:00:00Z' },
    ]
    const valuesBySnapshot = new Map<string, SnapshotValue[]>([
      ['s1', [makeValue({ snapshotId: 's1', assetId: 'a1', amount: 100 })]],
      ['s2', [makeValue({ snapshotId: 's2', assetId: 'a1', amount: 200 })]],
    ])
    const series = buildTotalAssetSeries(snapshots, valuesBySnapshot, [makeAsset()])
    expect(series[0].recordedAt).toBe('2026-01-01')
    expect(series[1].recordedAt).toBe('2026-03-01')
  })

  it('returns empty array for no snapshots', () => {
    expect(buildTotalAssetSeries([], new Map(), [])).toEqual([])
  })
})

// —— buildScaledTotalAssetSeries ——

describe('buildScaledTotalAssetSeries', () => {
  it('treats date-only snapshot strings as local dates', () => {
    const originalTimeZone = process.env.TZ
    process.env.TZ = 'America/New_York'

    try {
      const assets = [makeAsset({ id: 'a1', type: 'fund' })]
      const snapshots: Snapshot[] = [
        { id: 'new-year', recordedAt: '2026-01-01', createdAt: '2026-01-01T00:00:00' },
      ]
      const valuesBySnapshot = new Map<string, SnapshotValue[]>([
        ['new-year', [makeValue({ snapshotId: 'new-year', assetId: 'a1', amount: 100 })]],
      ])

      const series = buildScaledTotalAssetSeries(snapshots, valuesBySnapshot, assets, 'day')

      expect(series).toHaveLength(1)
      expect(series[0].periodKey).toBe('2026-01-01')
      expect(series[0].periodLabel).toBe('2026-01-01')
    } finally {
      if (originalTimeZone === undefined) {
        delete process.env.TZ
      } else {
        process.env.TZ = originalTimeZone
      }
    }
  })

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

  it('keeps the latest snapshot in a month bucket when input is unsorted', () => {
    const assets = [makeAsset({ id: 'a1', type: 'deposit' })]
    const snapshots: Snapshot[] = [
      { id: 'later', recordedAt: '2026-07-31T23:00:00', createdAt: '2026-07-31T23:00:00' },
      { id: 'earlier', recordedAt: '2026-07-01T09:00:00', createdAt: '2026-07-01T09:00:00' },
    ]
    const valuesBySnapshot = new Map<string, SnapshotValue[]>([
      ['later', [makeValue({ snapshotId: 'later', assetId: 'a1', amount: 300 })]],
      ['earlier', [makeValue({ snapshotId: 'earlier', assetId: 'a1', amount: 100 })]],
    ])

    const series = buildScaledTotalAssetSeries(snapshots, valuesBySnapshot, assets, 'month')

    expect(series).toHaveLength(1)
    expect(series[0].periodKey).toBe('2026-07')
    expect(series[0].recordedAt).toBe('2026-07-31T23:00:00')
    expect(series[0].totalAmount).toBe(300)
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

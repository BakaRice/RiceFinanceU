import { describe, expect, it } from 'vitest'
import { preValidate } from './DataManagementPage'

function backup(overrides: Record<string, unknown> = {}) {
  return {
    meta: { schemaVersion: 2, updatedAt: '2026-07-01T00:00:00.000Z' },
    assets: [],
    snapshots: [],
    snapshotValues: [],
    ...overrides,
  }
}

describe('DataManagementPage preValidate monthly incomes', () => {
  it('treats missing monthlyIncomes as an empty compatible list', () => {
    const result = preValidate(backup())

    expect(result.incomeCount).toBe(0)
    expect(result.issues).not.toContain('monthlyIncomes 应为数组')
  })

  it('reports malformed monthly income backup data', () => {
    const result = preValidate(backup({
      monthlyIncomes: [
        {
          id: 'income-1',
          month: '2026-13',
          salary: -1,
          extraIncome: Number.NaN,
          housingFund: 0,
          otherIncome: 0,
        },
      ],
    }))

    expect(result.incomeCount).toBe(1)
    expect(result.issues).toContain('月收入[0] "income-1": 月份无效 "2026-13"')
    expect(result.issues).toContain('月收入[0] "income-1": salary 金额无效 (-1)')
    expect(result.issues).toContain('月收入[0] "income-1": extraIncome 金额无效 (NaN)')
  })

  it('reports monthlyIncomes when it is not an array', () => {
    const result = preValidate(backup({ monthlyIncomes: {} }))

    expect(result.incomeCount).toBe(0)
    expect(result.issues).toContain('monthlyIncomes 应为数组')
  })
})

describe('DataManagementPage preValidate profit rates', () => {
  it('reports invalid rates and counts valid high-precision rates for normalization', () => {
    const result = preValidate(backup({
      assets: [
        {
          id: 'fund-1',
          name: '指数基金',
          type: 'fund',
          currency: 'CNY',
          isActive: true,
        },
      ],
      snapshots: [
        { id: 'snapshot-1', recordedAt: '2026-07-01T00:00:00.000Z' },
      ],
      snapshotValues: [
        {
          id: 'value-normalized',
          snapshotId: 'snapshot-1',
          assetId: 'fund-1',
          amount: 100,
          profitRate: 0.3076923076923077,
        },
        {
          id: 'value-invalid',
          snapshotId: 'snapshot-1',
          assetId: 'fund-1',
          amount: 100,
          profitRate: -1.01,
        },
      ],
    }))

    expect(result.normalizedProfitRateCount).toBe(1)
    expect(result.issues).toContain('1 个收益率将在导入时截断为百分比两位小数')
    expect(result.issues).toContain('快照值[1] "value-invalid": 收益率无效 (-1.01)')
    expect(result.hasCriticalIssues).toBe(true)
  })
})

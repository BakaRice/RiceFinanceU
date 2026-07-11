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

describe('DataManagementPage preValidate income records', () => {
  it('treats missing incomeRecords as an empty compatible list', () => {
    const result = preValidate(backup())

    expect(result.incomeCount).toBe(0)
    expect(result.issues).not.toContain('incomeRecords 应为数组')
  })

  it('reports malformed income record backup data', () => {
    const result = preValidate(backup({
      incomeRecords: [
        {
          id: 'record-1',
          occurredAt: '2026-02-31',
          amount: -1,
          category: 'unexpected',
        },
      ],
    }))

    expect(result.incomeCount).toBe(1)
    expect(result.issues).toContain('收入记录[0] "record-1": 日期无效 "2026-02-31"')
    expect(result.issues).toContain('收入记录[0] "record-1": 金额无效 (-1)')
    expect(result.issues).toContain('收入记录[0] "record-1": 分类无效 "unexpected"')
  })

  it('reports incomeRecords when it is not an array', () => {
    const result = preValidate(backup({ incomeRecords: {} }))

    expect(result.incomeCount).toBe(0)
    expect(result.issues).toContain('incomeRecords 应为数组')
  })

  it('keeps legacy monthlyIncomes backups compatible', () => {
    const result = preValidate(backup({
      monthlyIncomes: [
        {
          id: 'legacy-income',
          month: '2026-07',
          salary: 12000,
          extraIncome: 800,
          housingFund: 1800,
          otherIncome: 0,
        },
      ],
    }))

    expect(result.incomeCount).toBe(1)
    expect(result.issues).not.toContain('incomeRecords 应为数组')
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

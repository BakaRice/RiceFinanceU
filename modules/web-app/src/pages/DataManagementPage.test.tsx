/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FeedbackProvider } from '../components/Feedback/FeedbackContext'
import DataManagementPage, { preValidate } from './DataManagementPage'

function backup(overrides: Record<string, unknown> = {}) {
  return {
    meta: { schemaVersion: 2, updatedAt: '2026-07-01T00:00:00.000Z' },
    assets: [],
    snapshots: [],
    snapshotValues: [],
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
})

function investmentAsset(dcaPlan?: Record<string, unknown>) {
  return {
    id: 'fund-1',
    name: '指数基金',
    type: 'fund',
    currency: 'CNY',
    isActive: true,
    ...(dcaPlan ? { dcaPlan } : {}),
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

describe('DataManagementPage preValidate DCA plans', () => {
  it('counts a valid DCA plan and keeps backups without plans compatible', () => {
    const valid = preValidate(backup({
      assets: [investmentAsset({
        enabled: true,
        frequency: 'daily',
        excludeWeekends: false,
        plannedContribution: '200',
        targetAmount: '20000',
        targetDate: '2026-12-31',
        toleranceRate: '0.15',
      })],
    }))
    const legacy = preValidate(backup({ assets: [investmentAsset()] }))

    expect(valid.dcaPlanCount).toBe(1)
    expect(valid.hasCriticalIssues).toBe(false)
    expect(legacy.dcaPlanCount).toBe(0)
    expect(legacy.hasCriticalIssues).toBe(false)
  })

  const invalidCases: Array<[string, { type?: string; dcaPlan: Record<string, unknown> }]> = [
    ['余额类资产包含定投', { type: 'cash', dcaPlan: { enabled: true, frequency: 'monthly', plannedContribution: 100 } }],
    ['定投频率无效', { dcaPlan: { enabled: true, frequency: 'yearly', plannedContribution: 100 } }],
    ['每期投入为零', { dcaPlan: { enabled: true, frequency: 'monthly', plannedContribution: 0 } }],
    ['每期投入是布尔值', { dcaPlan: { enabled: true, frequency: 'monthly', plannedContribution: true } }],
    ['目标金额无效', { dcaPlan: { enabled: true, frequency: 'monthly', plannedContribution: 100, targetAmount: -1 } }],
    ['目标金额显式为空', { dcaPlan: { enabled: true, frequency: 'monthly', plannedContribution: 100, targetAmount: null } }],
    ['目标日期无效', { dcaPlan: { enabled: true, frequency: 'monthly', plannedContribution: 100, targetDate: '2026-02-31' } }],
    ['目标日期显式为空', { dcaPlan: { enabled: true, frequency: 'monthly', plannedContribution: 100, targetDate: '' } }],
    ['容忍偏差无效', { dcaPlan: { enabled: true, frequency: 'monthly', plannedContribution: 100, toleranceRate: -1 } }],
    ['容忍偏差显式为空', { dcaPlan: { enabled: true, frequency: 'monthly', plannedContribution: 100, toleranceRate: null } }],
    ['工作日选项无效', { dcaPlan: { enabled: true, frequency: 'daily', plannedContribution: 100, excludeWeekends: 'no' } }],
    ['工作日选项显式为空', { dcaPlan: { enabled: true, frequency: 'daily', plannedContribution: 100, excludeWeekends: null } }],
    ['备注类型无效', { dcaPlan: { enabled: true, frequency: 'monthly', plannedContribution: 100, note: null } }],
  ]

  it.each(invalidCases)('reports %s as a critical issue', (_label, override) => {
    const result = preValidate(backup({
      assets: [{
        ...investmentAsset(override.dcaPlan),
        ...(override.type ? { type: override.type } : {}),
      }],
    }))

    expect(result.hasCriticalIssues).toBe(true)
    expect(result.issues.some((issue) => issue.includes('定投计划'))).toBe(true)
  })
})

describe('DataManagementPage DCA backup visibility', () => {
  function renderPage() {
    return render(
      <FeedbackProvider>
        <DataManagementPage />
      </FeedbackProvider>,
    )
  }

  async function uploadBackup(data: unknown) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File([JSON.stringify(data)], 'backup.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByRole('heading', { name: '确认导入' })
  }

  it('describes and counts DCA plans in a backup', async () => {
    renderPage()
    expect(screen.getByText(/备份包含.*定投计划/)).toBeTruthy()

    await uploadBackup(backup({
      assets: [investmentAsset({ enabled: true, frequency: 'monthly', plannedContribution: 100 })],
    }))

    expect(screen.getByText(/定投计划: 1/)).toBeTruthy()
  })

  it('disables import confirmation when a DCA plan is invalid', async () => {
    renderPage()
    await uploadBackup(backup({
      assets: [investmentAsset({ enabled: true, frequency: 'monthly', plannedContribution: 0 })],
    }))

    expect((screen.getByRole('button', { name: '确认导入' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

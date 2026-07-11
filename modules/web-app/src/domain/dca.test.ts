import { describe, expect, it } from 'vitest'
import type { Asset } from '../types/finance'
import {
  calculateDcaMonthlyPeriods,
  calculateDcaPeriodsRemaining,
  estimateDcaMonthlyContribution,
  estimateDcaPlan,
  sanitizeDcaPlan,
  summarizeDcaMonthlyContributions,
} from './dca'

const makeAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: '指数基金',
  type: 'fund',
  currency: 'CNY',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('sanitizeDcaPlan', () => {
  it('keeps a valid investment asset plan and defaults daily weekend exclusion', () => {
    const plan = sanitizeDcaPlan('fund', {
      enabled: true,
      frequency: 'daily',
      plannedContribution: '100.50',
      targetAmount: '10000',
      targetDate: '2026-12-31',
      toleranceRate: '0.15',
      note: ' 长期定投 ',
    })

    expect(plan).toEqual({
      enabled: true,
      frequency: 'daily',
      excludeWeekends: true,
      plannedContribution: 100.5,
      targetAmount: 10000,
      targetDate: '2026-12-31',
      toleranceRate: 0.15,
      note: '长期定投',
    })
  })

  it('drops DCA plans from balance assets', () => {
    expect(sanitizeDcaPlan('cash', {
      enabled: true,
      frequency: 'monthly',
      plannedContribution: 100,
    })).toBeUndefined()
  })

  it('drops invalid enabled plans that do not have a finite contribution', () => {
    expect(sanitizeDcaPlan('stock', {
      enabled: true,
      frequency: 'monthly',
      plannedContribution: 'abc',
    })).toBeUndefined()
  })
})

describe('calculateDcaPeriodsRemaining', () => {
  it('counts daily periods after the current date and excludes weekends by default', () => {
    expect(calculateDcaPeriodsRemaining({
      fromDate: '2026-07-03',
      targetDate: '2026-07-10',
      frequency: 'daily',
    })).toBe(5)
  })

  it('can include weekends for daily plans', () => {
    expect(calculateDcaPeriodsRemaining({
      fromDate: '2026-07-03',
      targetDate: '2026-07-10',
      frequency: 'daily',
      excludeWeekends: false,
    })).toBe(7)
  })
})

describe('calculateDcaMonthlyPeriods', () => {
  it('counts all weekdays in the current month for daily plans by default', () => {
    expect(calculateDcaMonthlyPeriods({
      asOfDate: '2026-07-05',
      frequency: 'daily',
    })).toBe(23)
  })

  it('counts all natural days when daily weekend exclusion is disabled', () => {
    expect(calculateDcaMonthlyPeriods({
      asOfDate: '2026-07-05',
      frequency: 'daily',
      excludeWeekends: false,
    })).toBe(31)
  })

  it('uses simple current-month estimates for recurring frequencies', () => {
    expect(calculateDcaMonthlyPeriods({
      asOfDate: '2026-07-05',
      frequency: 'weekly',
    })).toBe(5)
    expect(calculateDcaMonthlyPeriods({
      asOfDate: '2026-07-05',
      frequency: 'biweekly',
    })).toBe(3)
    expect(calculateDcaMonthlyPeriods({
      asOfDate: '2026-07-05',
      frequency: 'monthly',
    })).toBe(1)
    expect(calculateDcaMonthlyPeriods({
      asOfDate: '2026-07-05',
      frequency: 'quarterly',
    })).toBeCloseTo(1 / 3)
  })
})

describe('estimateDcaMonthlyContribution', () => {
  it('estimates current-month contribution in original currency and CNY', () => {
    const result = estimateDcaMonthlyContribution({
      asset: makeAsset({
        currency: 'USD',
        dcaPlan: {
          enabled: true,
          frequency: 'weekly',
          plannedContribution: 100,
        },
      }),
      asOfDate: '2026-07-05',
      rates: { USD: 7.2, HKD: 0.92, updatedAt: '' },
    })

    expect(result).toEqual({
      periodsInMonth: 5,
      monthlyContribution: 500,
      monthlyContributionCNY: 3600,
      approximate: false,
    })
  })

  it('marks quarterly monthly estimates as approximate', () => {
    const result = estimateDcaMonthlyContribution({
      asset: makeAsset({
        dcaPlan: {
          enabled: true,
          frequency: 'quarterly',
          plannedContribution: 900,
        },
      }),
      asOfDate: '2026-07-05',
      rates: { USD: 7.2, HKD: 0.92, updatedAt: '' },
    })

    expect(result).toEqual({
      periodsInMonth: 1 / 3,
      monthlyContribution: 300,
      monthlyContributionCNY: 300,
      approximate: true,
    })
  })
})

describe('summarizeDcaMonthlyContributions', () => {
  it('summarizes enabled investment DCA plans in CNY and ignores non-investment assets', () => {
    const summary = summarizeDcaMonthlyContributions([
      makeAsset({
        id: 'fund-1',
        currency: 'CNY',
        dcaPlan: {
          enabled: true,
          frequency: 'monthly',
          plannedContribution: 1000,
        },
      }),
      makeAsset({
        id: 'stock-1',
        type: 'stock',
        currency: 'USD',
        dcaPlan: {
          enabled: true,
          frequency: 'weekly',
          plannedContribution: 100,
        },
      }),
      makeAsset({
        id: 'cash-1',
        type: 'cash',
        dcaPlan: {
          enabled: true,
          frequency: 'monthly',
          plannedContribution: 9999,
        },
      } as any),
    ], { USD: 7.2, HKD: 0.92, updatedAt: '' }, '2026-07-05')

    expect(summary).toEqual({
      planCount: 2,
      monthlyContributionCNY: 4600,
      averageContributionCNY: 860,
    })
  })
})

describe('estimateDcaPlan', () => {
  it('marks a plan underfunded when planned contribution is below target-derived contribution', () => {
    const result = estimateDcaPlan({
      asset: makeAsset({
        dcaPlan: {
          enabled: true,
          frequency: 'daily',
          excludeWeekends: true,
          plannedContribution: 100,
          targetAmount: 1500,
          targetDate: '2026-07-10',
          toleranceRate: 0.2,
        },
      }),
      latestAmount: 500,
      asOfDate: '2026-07-03',
    })

    expect(result.status).toBe('underfunded')
    expect(result.periodsRemaining).toBe(5)
    expect(result.remainingAmount).toBe(1000)
    expect(result.suggestedContribution).toBe(200)
    expect(result.contributionGap).toBe(-100)
    expect(result.contributionGapRate).toBe(-0.5)
  })

  it('marks a plan overfunded when planned contribution is above target-derived contribution', () => {
    const result = estimateDcaPlan({
      asset: makeAsset({
        dcaPlan: {
          enabled: true,
          frequency: 'weekly',
          plannedContribution: 1000,
          targetAmount: 1500,
          targetDate: '2026-07-17',
          toleranceRate: 0.2,
        },
      }),
      latestAmount: 500,
      asOfDate: '2026-07-03',
    })

    expect(result.status).toBe('overfunded')
    expect(result.periodsRemaining).toBe(2)
    expect(result.suggestedContribution).toBe(500)
    expect(result.contributionGap).toBe(500)
    expect(result.contributionGapRate).toBe(1)
  })

  it('marks a plan on track when the contribution gap is within tolerance', () => {
    const result = estimateDcaPlan({
      asset: makeAsset({
        dcaPlan: {
          enabled: true,
          frequency: 'weekly',
          plannedContribution: 550,
          targetAmount: 1500,
          targetDate: '2026-07-17',
          toleranceRate: 0.2,
        },
      }),
      latestAmount: 500,
      asOfDate: '2026-07-03',
    })

    expect(result.status).toBe('on_track')
  })

  it('reports insufficient data when a saved plan lacks target data or latest amount', () => {
    const result = estimateDcaPlan({
      asset: makeAsset({
        dcaPlan: {
          enabled: true,
          frequency: 'monthly',
          plannedContribution: 500,
        },
      }),
      asOfDate: '2026-07-03',
    })

    expect(result.status).toBe('insufficient_data')
    expect(result.message).toContain('补充目标金额和目标日期')
  })
})

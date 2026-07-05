import { describe, expect, it } from 'vitest'
import type { MonthlyIncome } from '../types/finance'
import { buildIncomeSeriesByScale, calculateMonthlyIncomeTotal } from './income'

function income(overrides: Partial<MonthlyIncome>): MonthlyIncome {
  return {
    id: 'income-1',
    month: '2026-07',
    salary: 0,
    extraIncome: 0,
    housingFund: 0,
    otherIncome: 0,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('income domain helpers', () => {
  it('calculates monthly income total from all categories', () => {
    const result = calculateMonthlyIncomeTotal(
      income({
        salary: 12000.235,
        extraIncome: 800.1,
        housingFund: 1800,
        otherIncome: 200,
      }),
    )

    expect(result).toBe(14800.34)
  })

  it('returns monthly income totals for month scale', () => {
    const series = buildIncomeSeriesByScale([
      income({ id: 'income-1', month: '2026-07', salary: 10000 }),
      income({ id: 'income-2', month: '2026-08', salary: 12000, extraIncome: 300 }),
    ], 'month')

    expect(series.get('2026-07')).toBe(10000)
    expect(series.get('2026-08')).toBe(12300)
  })

  it('groups monthly incomes into quarter totals', () => {
    const series = buildIncomeSeriesByScale([
      income({ id: 'income-1', month: '2026-01', salary: 10000 }),
      income({ id: 'income-2', month: '2026-02', salary: 12000 }),
      income({ id: 'income-3', month: '2026-04', salary: 15000 }),
    ], 'quarter')

    expect(series.get('2026-Q1')).toBe(22000)
    expect(series.get('2026-Q2')).toBe(15000)
  })

  it('groups monthly incomes into year totals', () => {
    const series = buildIncomeSeriesByScale([
      income({ id: 'income-1', month: '2026-01', salary: 10000 }),
      income({ id: 'income-2', month: '2026-12', salary: 12000 }),
      income({ id: 'income-3', month: '2027-01', salary: 15000 }),
    ], 'year')

    expect(series.get('2026')).toBe(22000)
    expect(series.get('2027')).toBe(15000)
  })

  it('does not generate income series for day or week scale', () => {
    const incomes = [income({ id: 'income-1', month: '2026-07', salary: 10000 })]

    expect(buildIncomeSeriesByScale(incomes, 'day').size).toBe(0)
    expect(buildIncomeSeriesByScale(incomes, 'week').size).toBe(0)
  })
})

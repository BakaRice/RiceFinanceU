import { describe, expect, it } from 'vitest'
import type { IncomeRecord, MonthlyIncome } from '../types/finance'
import {
  buildIncomeSeriesByScale,
  calculateIncomeRecordTotal,
  calculateRestrictedIncomeRecordTotal,
  calculateSpendableIncomeRecordTotal,
  migrateMonthlyIncomesToIncomeRecords,
  normalizeIncomeDateInput,
} from './income'

function record(overrides: Partial<IncomeRecord>): IncomeRecord {
  return {
    id: 'record-1',
    occurredAt: '2026-07-05',
    amount: 0,
    category: 'salary',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function monthlyIncome(overrides: Partial<MonthlyIncome>): MonthlyIncome {
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
  it('normalizes common typed date formats and rejects impossible dates', () => {
    expect(normalizeIncomeDateInput('2026-07-10')).toBe('2026-07-10')
    expect(normalizeIncomeDateInput('2026/7/10')).toBe('2026-07-10')
    expect(normalizeIncomeDateInput('20260710')).toBe('2026-07-10')
    expect(normalizeIncomeDateInput('2026年7月10日')).toBe('2026-07-10')
    expect(normalizeIncomeDateInput(' 2024/2/29 ')).toBe('2024-02-29')
    expect(normalizeIncomeDateInput('2026-02-29')).toBeNull()
    expect(normalizeIncomeDateInput('2026-02-30')).toBeNull()
    expect(normalizeIncomeDateInput('7月10日')).toBeNull()
  })

  it('calculates income record totals from separate income records', () => {
    const result = calculateIncomeRecordTotal([
      record({ id: 'salary', amount: 12000.235, category: 'salary' }),
      record({ id: 'bonus', amount: 800.1, category: 'bonus' }),
      record({ id: 'fund', amount: 1800, category: 'housing_fund' }),
      record({ id: 'other', amount: 200, category: 'other' }),
    ])

    expect(result).toBe(14800.34)
  })

  it('separates spendable tax-after income from restricted housing fund income', () => {
    const records = [
      record({ id: 'salary', amount: 12000.235, category: 'salary' }),
      record({ id: 'bonus', amount: 800.1, category: 'bonus' }),
      record({ id: 'fund', amount: 1800, category: 'housing_fund' }),
      record({ id: 'other', amount: 200, category: 'other' }),
    ]

    expect(calculateIncomeRecordTotal(records)).toBe(14800.34)
    expect(calculateSpendableIncomeRecordTotal(records)).toBe(13000.34)
    expect(calculateRestrictedIncomeRecordTotal(records)).toBe(1800)
  })

  it('returns monthly totals from income records for month scale', () => {
    const series = buildIncomeSeriesByScale([
      record({ id: 'income-1', occurredAt: '2026-07-05', amount: 10000 }),
      record({ id: 'income-2', occurredAt: '2026-07-28', amount: 500 }),
      record({ id: 'income-3', occurredAt: '2026-08-01', amount: 12000 }),
    ], 'month')

    expect(series.get('2026-07')).toBe(10500)
    expect(series.get('2026-08')).toBe(12000)
  })

  it('groups income records into quarter totals', () => {
    const series = buildIncomeSeriesByScale([
      record({ id: 'income-1', occurredAt: '2026-01-12', amount: 10000 }),
      record({ id: 'income-2', occurredAt: '2026-02-28', amount: 12000 }),
      record({ id: 'income-3', occurredAt: '2026-04-01', amount: 15000 }),
    ], 'quarter')

    expect(series.get('2026-Q1')).toBe(22000)
    expect(series.get('2026-Q2')).toBe(15000)
  })

  it('groups income records into year totals', () => {
    const series = buildIncomeSeriesByScale([
      record({ id: 'income-1', occurredAt: '2026-01-01', amount: 10000 }),
      record({ id: 'income-2', occurredAt: '2026-12-31', amount: 12000 }),
      record({ id: 'income-3', occurredAt: '2027-01-01', amount: 15000 }),
    ], 'year')

    expect(series.get('2026')).toBe(22000)
    expect(series.get('2027')).toBe(15000)
  })

  it('groups income records into day and Monday-based week totals', () => {
    const incomes = [
      record({ id: 'income-1', occurredAt: '2026-07-05', amount: 10000 }),
      record({ id: 'income-2', occurredAt: '2026-07-05', amount: 500 }),
      record({ id: 'income-3', occurredAt: '2026-07-06', amount: 12000 }),
      record({ id: 'income-4', occurredAt: '2026-07-12', amount: 800 }),
    ]

    const daily = buildIncomeSeriesByScale(incomes, 'day')
    expect(daily.get('2026-07-05')).toBe(10500)
    expect(daily.get('2026-07-06')).toBe(12000)

    const weekly = buildIncomeSeriesByScale(incomes, 'week')
    expect(weekly.get('2026-06-29')).toBe(10500)
    expect(weekly.get('2026-07-06')).toBe(12800)
  })

  it('migrates legacy monthly income summaries into income records', () => {
    const records = migrateMonthlyIncomesToIncomeRecords([
      monthlyIncome({
        id: 'legacy-income',
        month: '2026-07',
        salary: 12000,
        extraIncome: 800,
        housingFund: 1800,
        otherIncome: 0,
        note: '7月收入',
      }),
    ])

    expect(records).toHaveLength(3)
    expect(records[0]).toMatchObject({
      id: 'legacy-income-salary',
      occurredAt: '2026-07-01',
      category: 'salary',
      amount: 12000,
      note: '7月收入',
    })
    expect(records[1]).toMatchObject({
      id: 'legacy-income-extraIncome',
      occurredAt: '2026-07-01',
      category: 'side_income',
      amount: 800,
    })
    expect(records[2]).toMatchObject({
      id: 'legacy-income-housingFund',
      occurredAt: '2026-07-01',
      category: 'housing_fund',
      amount: 1800,
    })
  })
})

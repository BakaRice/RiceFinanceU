import type { IncomeCategory, IncomeRecord, MonthlyIncome } from '../types/finance'
import { roundMoney } from './money'
import type { TrendScale } from './snapshots'

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function normalizeIncomeDateInput(value: string): string | null {
  const input = value.trim()
  let match: RegExpExecArray | null = null

  if (/^\d{8}$/.test(input)) {
    match = /^(\d{4})(\d{2})(\d{2})$/.exec(input)
  } else if (input.includes('年')) {
    match = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(input)
  } else {
    match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(input)
  }

  if (!match) return null

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, monthIndex, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return [
    String(year).padStart(4, '0'),
    String(monthIndex + 1).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')
}

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  salary: '工资',
  bonus: '奖金',
  side_income: '副业/额外收入',
  housing_fund: '公积金',
  investment: '投资分红',
  other: '其他收入',
}

export const INCOME_CATEGORY_AVAILABILITY: Record<IncomeCategory, 'spendable' | 'restricted'> = {
  salary: 'spendable',
  bonus: 'spendable',
  side_income: 'spendable',
  housing_fund: 'restricted',
  investment: 'spendable',
  other: 'spendable',
}

export function isRestrictedIncomeCategory(category: IncomeCategory): boolean {
  return INCOME_CATEGORY_AVAILABILITY[category] === 'restricted'
}

function parseMonthKey(month: string): { year: string; monthNumber: number } | null {
  const match = MONTH_KEY_PATTERN.exec(month)
  if (!match) return null

  const monthNumber = Number(match[2])
  if (monthNumber < 1 || monthNumber > 12) return null

  return { year: match[1], monthNumber }
}

function parseDateKey(dateKey: string): {
  year: string
  monthNumber: number
  monthKey: string
  date: Date
} | null {
  const match = DATE_KEY_PATTERN.exec(dateKey)
  if (!match) return null

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, monthIndex, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return {
    year: match[1],
    monthNumber: monthIndex + 1,
    monthKey: `${match[1]}-${match[2]}`,
    date,
  }
}

function formatUtcDateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function addToSeries(series: Map<string, number>, key: string, amount: number) {
  series.set(key, roundMoney((series.get(key) || 0) + amount))
}

export function calculateMonthlyIncomeTotal(income: MonthlyIncome): number {
  return roundMoney(
    income.salary +
      income.extraIncome +
      income.housingFund +
      income.otherIncome,
  )
}

export function calculateIncomeRecordTotal(records: IncomeRecord[]): number {
  return roundMoney(records.reduce((sum, record) => sum + record.amount, 0))
}

export function calculateSpendableIncomeRecordTotal(records: IncomeRecord[]): number {
  return roundMoney(records.reduce((sum, record) => {
    if (isRestrictedIncomeCategory(record.category)) return sum
    return sum + record.amount
  }, 0))
}

export function calculateRestrictedIncomeRecordTotal(records: IncomeRecord[]): number {
  return roundMoney(records.reduce((sum, record) => {
    if (!isRestrictedIncomeCategory(record.category)) return sum
    return sum + record.amount
  }, 0))
}

export function buildIncomeSeriesByScale(
  incomes: IncomeRecord[],
  scale: TrendScale,
): Map<string, number> {
  const series = new Map<string, number>()

  for (const income of incomes) {
    const parsed = parseDateKey(income.occurredAt)
    if (!parsed) continue

    const amount = roundMoney(income.amount)
    if (scale === 'day') {
      addToSeries(series, income.occurredAt, amount)
      continue
    }

    if (scale === 'week') {
      const weekStart = new Date(parsed.date)
      const daysSinceMonday = (weekStart.getUTCDay() + 6) % 7
      weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday)
      addToSeries(series, formatUtcDateKey(weekStart), amount)
      continue
    }

    if (scale === 'month') {
      addToSeries(series, parsed.monthKey, amount)
      continue
    }

    if (scale === 'quarter') {
      const quarter = Math.floor((parsed.monthNumber - 1) / 3) + 1
      addToSeries(series, `${parsed.year}-Q${quarter}`, amount)
      continue
    }

    if (scale === 'year') {
      addToSeries(series, parsed.year, amount)
    }
  }

  return series
}

export function getIncomeLineLabel(scale: TrendScale): string {
  if (scale === 'day') return '日收入'
  if (scale === 'week') return '周收入'
  if (scale === 'quarter') return '季度收入'
  if (scale === 'year') return '年度收入'
  return '月收入'
}

export function migrateMonthlyIncomesToIncomeRecords(incomes: MonthlyIncome[]): IncomeRecord[] {
  const records: IncomeRecord[] = []

  for (const income of incomes) {
    const parsed = parseMonthKey(income.month)
    if (!parsed) continue

    const occurredAt = `${income.month}-01`
    const createdAt = income.createdAt
    const updatedAt = income.updatedAt
    const note = income.note

    const categoryMappings: Array<{
      key: 'salary' | 'extraIncome' | 'housingFund' | 'otherIncome'
      category: IncomeCategory
    }> = [
      { key: 'salary', category: 'salary' },
      { key: 'extraIncome', category: 'side_income' },
      { key: 'housingFund', category: 'housing_fund' },
      { key: 'otherIncome', category: 'other' },
    ]

    for (const mapping of categoryMappings) {
      const amount = roundMoney(income[mapping.key])
      if (amount <= 0) continue

      records.push({
        id: `${income.id}-${mapping.key}`,
        occurredAt,
        amount,
        category: mapping.category,
        ...(note ? { note } : {}),
        createdAt,
        updatedAt,
      })
    }
  }

  return records
}

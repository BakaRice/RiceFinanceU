import type { MonthlyIncome } from '../types/finance'
import { roundMoney } from './money'
import type { TrendScale } from './snapshots'

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/

function parseMonthKey(month: string): { year: string; monthNumber: number } | null {
  const match = MONTH_KEY_PATTERN.exec(month)
  if (!match) return null

  const monthNumber = Number(match[2])
  if (monthNumber < 1 || monthNumber > 12) return null

  return { year: match[1], monthNumber }
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

export function buildIncomeSeriesByScale(
  incomes: MonthlyIncome[],
  scale: TrendScale,
): Map<string, number> {
  const series = new Map<string, number>()

  if (scale === 'day' || scale === 'week') return series

  for (const income of incomes) {
    const parsed = parseMonthKey(income.month)
    if (!parsed) continue

    const amount = calculateMonthlyIncomeTotal(income)
    if (scale === 'month') {
      addToSeries(series, income.month, amount)
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

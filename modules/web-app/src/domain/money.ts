// src/domain/money.ts

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function truncateDecimal(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value
  const factor = 10 ** decimals
  return Math.trunc(value * factor) / factor
}

export function normalizeStoredProfitRate(value: unknown): number | null {
  const rate = Number(value)
  if (!Number.isFinite(rate) || rate < -1) return null
  return truncateDecimal(rate, 4)
}

export function formatProfitRateInput(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return ''
  return truncateDecimal(value * 100, 2).toFixed(2)
}

export function formatMoney(n: number): string {
  const isNegative = n < 0
  const abs = Math.abs(n)
  const parts = abs.toFixed(2).split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${isNegative ? '-' : ''}${intPart}.${parts[1]}`
}

export function formatMoneyFixed(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '-'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatPercentFixed(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '-'
  return `${(value * 100).toFixed(2)}%`
}

export function isValidCurrencyAmount(value: string): boolean {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return false
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0
}

export function isValidSignedMoney(value: string): boolean {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) return false
  return Number.isFinite(Number(value))
}

export function isValidPercentInput(value: string): boolean {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) return false
  const percent = Number(value)
  return Number.isFinite(percent) && percent >= -100
}

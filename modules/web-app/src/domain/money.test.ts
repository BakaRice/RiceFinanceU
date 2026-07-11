// src/domain/money.test.ts
import { describe, it, expect } from 'vitest'
import {
  formatMoney,
  roundMoney,
  formatMoneyFixed,
  formatPercentFixed,
  formatProfitRateInput,
  isValidCurrencyAmount,
  isValidPercentInput,
  isValidSignedMoney,
  normalizeStoredProfitRate,
  truncateDecimal,
} from './money'

describe('roundMoney', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundMoney(100.456)).toBe(100.46)
    expect(roundMoney(100.454)).toBe(100.45)
    expect(roundMoney(100)).toBe(100.00)
  })
  it('handles zero', () => expect(roundMoney(0)).toBe(0.00))
  it('handles negative', () => expect(roundMoney(-50.678)).toBe(-50.68))
})

describe('formatMoney', () => {
  it('formats with commas and 2 decimals', () => {
    expect(formatMoney(1234.5)).toBe('1,234.50')
    expect(formatMoney(1000000)).toBe('1,000,000.00')
  })
  it('formats zero', () => expect(formatMoney(0)).toBe('0.00'))
  it('formats negative', () => expect(formatMoney(-500.5)).toBe('-500.50'))
})

describe('mature numeric display helpers', () => {
  it('formats money with thousand separators and two decimals', () => {
    expect(formatMoneyFixed(12345.6)).toBe('12,345.60')
    expect(formatMoneyFixed(0)).toBe('0.00')
    expect(formatMoneyFixed(undefined)).toBe('-')
  })

  it('formats percentages with two decimals', () => {
    expect(formatPercentFixed(0.0865)).toBe('8.65%')
    expect(formatPercentFixed(0)).toBe('0.00%')
    expect(formatPercentFixed(undefined)).toBe('-')
  })

  it('validates currency amount input', () => {
    expect(isValidCurrencyAmount('123.45')).toBe(true)
    expect(isValidCurrencyAmount('123.456')).toBe(false)
    expect(isValidCurrencyAmount('-1')).toBe(false)
    expect(isValidCurrencyAmount('')).toBe(false)
  })

  it('validates percent input', () => {
    expect(isValidPercentInput('8.65')).toBe(true)
    expect(isValidPercentInput('-99.99')).toBe(true)
    expect(isValidPercentInput('-100.01')).toBe(false)
    expect(isValidPercentInput('8.999')).toBe(false)
  })

  it('validates signed money input', () => {
    expect(isValidSignedMoney('-100.50')).toBe(true)
    expect(isValidSignedMoney('100')).toBe(true)
    expect(isValidSignedMoney('')).toBe(false)
    expect(isValidSignedMoney('-100.999')).toBe(false)
  })
})

describe('profit rate precision', () => {
  it('truncates instead of rounding', () => {
    expect(truncateDecimal(30.769230769, 2)).toBe(30.76)
    expect(truncateDecimal(-30.769230769, 2)).toBe(-30.76)
  })

  it('formats stored ratio as a two-decimal percent input', () => {
    expect(formatProfitRateInput(0.3076923076923077)).toBe('30.76')
    expect(formatProfitRateInput(0)).toBe('0.00')
    expect(formatProfitRateInput(undefined)).toBe('')
  })

  it('normalizes imported stored ratios to four decimals', () => {
    expect(normalizeStoredProfitRate(0.3076923076923077)).toBe(0.3076)
    expect(normalizeStoredProfitRate(-0.3076923076923077)).toBe(-0.3076)
    expect(normalizeStoredProfitRate(-1.01)).toBeNull()
    expect(normalizeStoredProfitRate(Number.NaN)).toBeNull()
    expect(normalizeStoredProfitRate('0.3076')).toBeNull()
  })
})

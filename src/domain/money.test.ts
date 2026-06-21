// src/domain/money.test.ts
import { describe, it, expect } from 'vitest'
import { formatMoney, roundMoney } from './money'

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

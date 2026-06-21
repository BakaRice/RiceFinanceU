// src/domain/deposits.test.ts
import { describe, it, expect } from 'vitest'
import { calculateDepositTotal } from './deposits'
import type { DepositAccount } from '../types/finance'

const mk = (balance: number): DepositAccount => ({
  id: 'x', name: 'x', institution: 'x', accountType: 'current', balance, currency: 'CNY', updatedAt: '2026-01-01',
})

describe('calculateDepositTotal', () => {
  it('returns 0 for empty', () => expect(calculateDepositTotal([])).toBe(0))
  it('sums balances', () => {
    expect(calculateDepositTotal([mk(10000), mk(5000.50), mk(234.56)])).toBe(15235.06)
  })
  it('handles single account', () => expect(calculateDepositTotal([mk(10000)])).toBe(10000))
})

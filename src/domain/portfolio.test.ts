// src/domain/portfolio.test.ts
import { describe, it, expect } from 'vitest'
import { calculateTotalAssets, calculateAssetAllocation } from './portfolio'
import type { DepositAccount } from '../types/finance'
import type { FundPosition } from './funds'

const mkDep = (balance: number): DepositAccount => ({
  id: 'x', name: 'x', institution: 'x', accountType: 'current', balance, currency: 'CNY', updatedAt: '2026-01-01',
})

const mkPos = (marketValue: number): FundPosition => ({
  totalShares: 100, totalCost: 100, avgCost: 1, latestNav: 2, marketValue,
  unrealizedPnl: 0, realizedPnl: 0, totalPnl: 0,
})

describe('calculateTotalAssets', () => {
  it('sums deposits and fund values', () => {
    expect(calculateTotalAssets([mkDep(60000)], [mkPos(25000)])).toBe(85000)
  })
  it('zero when empty', () => expect(calculateTotalAssets([], [])).toBe(0))
})

describe('calculateAssetAllocation', () => {
  it('breaks down allocation', () => {
    const a = calculateAssetAllocation([mkDep(60000)], [mkPos(25000)])
    expect(a.deposits).toBe(60000)
    expect(a.funds).toBe(25000)
    expect(a.total).toBe(85000)
  })
  it('all zero', () => {
    const a = calculateAssetAllocation([], [])
    expect(a.total).toBe(0)
  })
})

// src/domain/funds.test.ts
import { describe, it, expect } from 'vitest'
import { calculateFundPosition, buildFundChartSeries, calculateFundMarketValue } from './funds'
import type { Transaction, FundNavPrice } from '../types/finance'

describe('calculateFundMarketValue', () => {
  it('shares * nav', () => expect(calculateFundMarketValue(1000, 12.5)).toBe(12500))
  it('zero shares', () => expect(calculateFundMarketValue(0, 12.5)).toBe(0))
})

describe('calculateFundPosition', () => {
  it('empty when no transactions', () => {
    const p = calculateFundPosition('f1', [], [])
    expect(p.totalShares).toBe(0)
    expect(p.totalCost).toBe(0)
    expect(p.marketValue).toBe(0)
  })

  it('single buy', () => {
    const txs: Transaction[] = [
      { id: '1', type: 'fund_buy', fundId: 'f1', amount: 10000, shares: 1000, occurredAt: '2026-01-15' },
    ]
    const navs: FundNavPrice[] = [{ id: 'n1', fundId: 'f1', nav: 12.5, date: '2026-06-01' }]
    const p = calculateFundPosition('f1', txs, navs)
    expect(p.totalShares).toBe(1000)
    expect(p.totalCost).toBe(10000)
    expect(p.avgCost).toBe(10)
    expect(p.latestNav).toBe(12.5)
    expect(p.marketValue).toBe(12500)
    expect(p.unrealizedPnl).toBe(2500)
  })

  it('multiple buys average cost', () => {
    const txs: Transaction[] = [
      { id: '1', type: 'fund_buy', fundId: 'f1', amount: 10000, shares: 1000, occurredAt: '2026-01-15' },
      { id: '2', type: 'fund_buy', fundId: 'f1', amount: 20000, shares: 1000, occurredAt: '2026-02-15' },
    ]
    const navs: FundNavPrice[] = [{ id: 'n1', fundId: 'f1', nav: 18, date: '2026-06-01' }]
    const p = calculateFundPosition('f1', txs, navs)
    expect(p.totalShares).toBe(2000)
    expect(p.totalCost).toBe(30000)
    expect(p.avgCost).toBe(15)
    expect(p.marketValue).toBe(36000)
  })

  it('sell with average cost', () => {
    const txs: Transaction[] = [
      { id: '1', type: 'fund_buy', fundId: 'f1', amount: 10000, shares: 1000, occurredAt: '2026-01-15' },
      { id: '2', type: 'fund_sell', fundId: 'f1', amount: 8000, shares: 500, occurredAt: '2026-03-15' },
    ]
    const navs: FundNavPrice[] = [{ id: 'n1', fundId: 'f1', nav: 14, date: '2026-06-01' }]
    const p = calculateFundPosition('f1', txs, navs)
    expect(p.totalShares).toBe(500)
    expect(p.totalCost).toBe(5000) // 10000 - 500*10
    expect(p.realizedPnl).toBe(3000) // 8000 - 5000
    expect(p.marketValue).toBe(7000) // 500*14
    expect(p.unrealizedPnl).toBe(2000) // 7000 - 5000
    expect(p.totalPnl).toBe(5000)
  })

  it('sell with fee', () => {
    const txs: Transaction[] = [
      { id: '1', type: 'fund_buy', fundId: 'f1', amount: 10000, shares: 1000, occurredAt: '2026-01-15' },
      { id: '2', type: 'fund_sell', fundId: 'f1', amount: 8000, shares: 500, fee: 50, occurredAt: '2026-03-15' },
    ]
    const navs: FundNavPrice[] = [{ id: 'n1', fundId: 'f1', nav: 14, date: '2026-06-01' }]
    const p = calculateFundPosition('f1', txs, navs)
    expect(p.realizedPnl).toBe(2950) // 8000 - 5000 - 50
  })

  it('latest NAV by date', () => {
    const navs: FundNavPrice[] = [
      { id: 'n1', fundId: 'f1', nav: 10, date: '2026-01-01' },
      { id: 'n2', fundId: 'f1', nav: 15, date: '2026-06-15' },
      { id: 'n3', fundId: 'f1', nav: 12, date: '2026-03-01' },
    ]
    const txs: Transaction[] = [
      { id: '1', type: 'fund_buy', fundId: 'f1', amount: 10000, shares: 1000, occurredAt: '2026-01-15' },
    ]
    expect(calculateFundPosition('f1', txs, navs).latestNav).toBe(15)
  })

  it('only includes given fund', () => {
    const txs: Transaction[] = [
      { id: '1', type: 'fund_buy', fundId: 'f1', amount: 10000, shares: 1000, occurredAt: '2026-01-15' },
      { id: '2', type: 'fund_buy', fundId: 'f2', amount: 5000, shares: 500, occurredAt: '2026-02-01' },
    ]
    const navs: FundNavPrice[] = [{ id: 'n1', fundId: 'f1', nav: 12, date: '2026-06-01' }]
    const p = calculateFundPosition('f1', txs, navs)
    expect(p.totalShares).toBe(1000)
  })
})

describe('buildFundChartSeries', () => {
  it('builds sorted chart points', () => {
    const txs: Transaction[] = [
      { id: '1', type: 'fund_buy', fundId: 'f1', amount: 10000, shares: 1000, occurredAt: '2026-01-15' },
      { id: '2', type: 'fund_buy', fundId: 'f1', amount: 5000, shares: 400, occurredAt: '2026-03-01' },
    ]
    const navs: FundNavPrice[] = [
      { id: 'n1', fundId: 'f1', nav: 10, date: '2026-01-15' },
      { id: 'n2', fundId: 'f1', nav: 12, date: '2026-02-01' },
      { id: 'n3', fundId: 'f1', nav: 14, date: '2026-03-15' },
    ]
    const result = buildFundChartSeries('f1', txs, navs)
    expect(result).toHaveLength(3)
    expect(result[0].date).toBe('2026-01-15')
    expect(result[2].date).toBe('2026-03-15')
    expect(result[0].nav).toBe(10)
    expect(result[0].shares).toBe(1000)
    expect(result[0].marketValue).toBe(10000)
    expect(result[0].costBasis).toBe(10000)
    // last point: nav=14, shares=1400, marketValue=19600, costBasis=15000, pnl=4600
    expect(result[2].shares).toBe(1400)
    expect(result[2].marketValue).toBe(19600)
    expect(result[2].costBasis).toBe(15000)
    expect(result[2].pnl).toBe(4600)
  })

  it('empty when no nav data', () => {
    expect(buildFundChartSeries('f1', [], [])).toEqual([])
  })
})

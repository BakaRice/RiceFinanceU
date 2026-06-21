// src/domain/funds.ts
import type { Transaction, FundNavPrice } from '../types/finance'
import { roundMoney } from './money'

export interface FundPosition {
  totalShares: number
  totalCost: number
  avgCost: number
  latestNav: number
  marketValue: number
  unrealizedPnl: number
  realizedPnl: number
  totalPnl: number
}

export interface ChartDataPoint {
  date: string
  nav: number
  shares: number
  marketValue: number
  costBasis: number
  pnl: number
}

export function calculateFundMarketValue(shares: number, nav: number): number {
  return roundMoney(shares * nav)
}

export function calculateFundPosition(
  fundId: string,
  transactions: Transaction[],
  navPrices: FundNavPrice[]
): FundPosition {
  const fundTxs = transactions.filter(
    (tx) => tx.type !== 'deposit_adjustment' && tx.fundId === fundId
  )

  let totalShares = 0
  let totalCost = 0
  let realizedPnl = 0

  const sortedTxs = [...fundTxs].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))

  for (const tx of sortedTxs) {
    if (tx.type === 'fund_buy') {
      totalShares += tx.shares
      totalCost += tx.amount
    } else if (tx.type === 'fund_sell') {
      const avgCost = totalShares > 0 ? totalCost / totalShares : 0
      const soldCost = roundMoney(avgCost * tx.shares)
      const fee = tx.fee || 0
      realizedPnl += roundMoney(tx.amount - soldCost - fee)
      totalShares -= tx.shares
      totalCost -= soldCost
    }
    // fund_nav doesn't affect position
  }

  totalShares = roundMoney(totalShares)
  totalCost = roundMoney(totalCost)

  const fundNavs = navPrices
    .filter((n) => n.fundId === fundId)
    .sort((a, b) => b.date.localeCompare(a.date))

  const latestNav = fundNavs.length > 0 ? fundNavs[0].nav : 0
  const marketValue = calculateFundMarketValue(totalShares, latestNav)
  const avgCost = totalShares > 0 ? roundMoney(totalCost / totalShares) : 0
  const unrealizedPnl = roundMoney(marketValue - totalCost)
  const totalPnl = roundMoney(unrealizedPnl + realizedPnl)

  return { totalShares, totalCost, avgCost, latestNav, marketValue, unrealizedPnl, realizedPnl, totalPnl }
}

export function buildFundChartSeries(
  fundId: string,
  transactions: Transaction[],
  navPrices: FundNavPrice[]
): ChartDataPoint[] {
  const fundNavs = navPrices
    .filter((n) => n.fundId === fundId)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (fundNavs.length === 0) return []

  let cumulativeShares = 0
  let cumulativeCost = 0

  const fundTxs = transactions
    .filter((tx) => tx.type !== 'deposit_adjustment' && tx.fundId === fundId)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))

  let txIndex = 0
  const points: ChartDataPoint[] = []

  for (const nav of fundNavs) {
    while (txIndex < fundTxs.length && fundTxs[txIndex].occurredAt <= nav.date) {
      const tx = fundTxs[txIndex]
      if (tx.type === 'fund_buy') {
        cumulativeShares += tx.shares
        cumulativeCost += tx.amount
      } else if (tx.type === 'fund_sell') {
        const avgCost = cumulativeShares > 0 ? cumulativeCost / cumulativeShares : 0
        cumulativeCost -= roundMoney(avgCost * tx.shares)
        cumulativeShares -= tx.shares
      }
      txIndex++
    }

    const marketValue = roundMoney(cumulativeShares * nav.nav)
    points.push({
      date: nav.date,
      nav: nav.nav,
      shares: roundMoney(cumulativeShares),
      marketValue,
      costBasis: roundMoney(cumulativeCost),
      pnl: roundMoney(marketValue - cumulativeCost),
    })
  }

  return points
}

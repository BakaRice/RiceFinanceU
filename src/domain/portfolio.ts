// src/domain/portfolio.ts
import type { DepositAccount } from '../types/finance'
import type { FundPosition } from './funds'
import { calculateDepositTotal } from './deposits'

export function calculateTotalAssets(
  deposits: DepositAccount[],
  fundPositions: FundPosition[]
): number {
  const depositTotal = calculateDepositTotal(deposits)
  const fundTotal = fundPositions.reduce((sum, pos) => sum + pos.marketValue, 0)
  return depositTotal + fundTotal
}

export function calculateAssetAllocation(
  deposits: DepositAccount[],
  fundPositions: FundPosition[]
): { deposits: number; funds: number; total: number } {
  const depositsTotal = calculateDepositTotal(deposits)
  const fundsTotal = fundPositions.reduce((sum, pos) => sum + pos.marketValue, 0)
  return { deposits: depositsTotal, funds: fundsTotal, total: depositsTotal + fundsTotal }
}

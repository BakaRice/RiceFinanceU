// src/domain/portfolio.ts
// Legacy v1 calculations (kept for backward compatibility)
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

// Re-export snapshot-based calculations for v2 consumers
export {
  calculateSnapshotTotal,
  calculateAllocation,
  compareSnapshots,
  buildTotalAssetSeries,
} from './snapshots'
export type {
  SnapshotTotal,
  AllocationItem,
  SnapshotComparison,
  SnapshotComparisonItem,
  TotalAssetPoint,
} from './snapshots'

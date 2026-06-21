// src/domain/deposits.ts
import type { DepositAccount } from '../types/finance'

export function calculateDepositTotal(accounts: DepositAccount[]): number {
  return accounts.reduce((sum, a) => sum + a.balance, 0)
}

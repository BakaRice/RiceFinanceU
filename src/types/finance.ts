// src/types/finance.ts
// Schema v1 (legacy — kept for backward compatibility during migration)

export type DepositAccount = {
  id: string
  name: string
  institution: string
  accountType: 'cash' | 'current' | 'fixed' | 'money_market' | 'other'
  balance: number
  currency: 'CNY'
  note?: string
  updatedAt: string
}

export type Fund = {
  id: string
  code?: string
  name: string
  platform?: string
  currency: 'CNY'
  note?: string
  createdAt: string
  updatedAt: string
}

export type DepositAdjustment = {
  id: string
  type: 'deposit_adjustment'
  depositAccountId: string
  amountBefore: number
  amountAfter: number
  occurredAt: string
  note?: string
}

export type FundBuy = {
  id: string
  type: 'fund_buy'
  fundId: string
  amount: number
  shares: number
  fee?: number
  occurredAt: string
  note?: string
}

export type FundSell = {
  id: string
  type: 'fund_sell'
  fundId: string
  amount: number
  shares: number
  fee?: number
  occurredAt: string
  note?: string
}

export type FundNav = {
  id: string
  type: 'fund_nav'
  fundId: string
  nav: number
  occurredAt: string
  note?: string
}

export type Transaction = DepositAdjustment | FundBuy | FundSell | FundNav

export type FundNavPrice = {
  id: string
  fundId: string
  nav: number
  date: string
}

export type Meta = {
  schemaVersion: number
  updatedAt: string
}

// Schema v1 export
export type ExportDataV1 = {
  meta: Meta
  deposits: DepositAccount[]
  funds: Fund[]
  transactions: Transaction[]
  navPrices: FundNavPrice[]
}

export type ExportData = ExportDataV1

// ——— Schema v2: Asset Snapshot Ledger ———

export type AssetType =
  | 'fund'
  | 'stock'
  | 'gold'
  | 'deposit'
  | 'cash'
  | 'housing_fund'
  | 'other'

export function isInvestmentAsset(type: AssetType): boolean {
  return type === 'fund' || type === 'stock' || type === 'gold'
}

export function isBalanceAsset(type: AssetType): boolean {
  return type === 'deposit' || type === 'cash' || type === 'housing_fund' || type === 'other'
}

export type Asset = {
  id: string
  name: string
  type: AssetType
  institution?: string
  currency: 'CNY'
  isActive: boolean
  note?: string
  createdAt: string
  updatedAt: string
}

export type Snapshot = {
  id: string
  recordedAt: string
  note?: string
  createdAt: string
}

export type SnapshotValue = {
  id: string
  snapshotId: string
  assetId: string
  amount: number
  profit?: number
  profitRate?: number
  note?: string
}

export interface CreateSnapshotInput {
  recordedAt: string
  note?: string
  values: Array<{
    assetId?: string
    asset?: {
      name: string
      type: AssetType
      institution?: string
      note?: string
    }
    amount: number
    profit?: number
    profitRate?: number
    note?: string
  }>
}

// Schema v2 export
export type ExportDataV2 = {
  meta: { schemaVersion: 2; updatedAt: string }
  assets: Asset[]
  snapshots: Snapshot[]
  snapshotValues: SnapshotValue[]
}

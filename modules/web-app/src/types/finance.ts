// src/types/finance.ts — Asset Snapshot Ledger (v2)

export type AssetType =
  | 'fund'
  | 'stock'
  | 'gold'
  | 'deposit'
  | 'cash'
  | 'housing_fund'
  | 'other'

export type Currency = 'CNY' | 'USD' | 'HKD'

// Asset profile fields are master-data identifiers, not valuation inputs.
// They help describe "what this asset is"; SnapshotValue describes "what it is worth now".
export type AssetProfileKey =
  | 'fundCode'
  | 'fundCategory'
  | 'marketTheme'
  | 'holdingPlatform'
  | 'ticker'
  | 'exchange'
  | 'brokerAccount'
  | 'industryTag'
  | 'holdingForm'
  | 'custodian'
  | 'unit'
  | 'sourceNote'
  | 'bank'
  | 'depositType'
  | 'term'
  | 'maturityDate'
  | 'annualRate'
  | 'accountChannel'
  | 'purposeTag'
  | 'availabilityNote'
  | 'contributionCity'
  | 'accountOwner'
  | 'managementNote'
  | 'customCategory'
  | 'ownershipNote'
  | 'reminderDate'

export type AssetProfile = Partial<Record<AssetProfileKey, string>>

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  CNY: '¥',
  USD: '$',
  HKD: 'HK$',
}

export type ExchangeRates = {
  USD: number  // 1 USD = ? CNY
  HKD: number  // 1 HKD = ? CNY
  updatedAt: string
}

export type Asset = {
  id: string
  name: string
  type: AssetType
  institution?: string
  currency: Currency
  isActive: boolean
  note?: string
  // Optional type-specific asset dossier. Kept out of snapshot calculations by design.
  profile?: AssetProfile
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
  // Only investment asset types should use profit/profitRate.
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
      currency?: Currency
      institution?: string
      note?: string
      profile?: AssetProfile
    }
    amount: number
    profit?: number
    profitRate?: number
    note?: string
  }>
}

export type ExportData = {
  meta: { schemaVersion: number; updatedAt: string }
  assets: Asset[]
  snapshots: Snapshot[]
  snapshotValues: SnapshotValue[]
  rates?: ExchangeRates
}

// src/types/finance.ts — Asset Snapshot Ledger (v2)

export type AssetType =
  | 'fund'
  | 'stock'
  | 'gold'
  | 'deposit'
  | 'cash'
  | 'housing_fund'
  | 'other'

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

export type ExportData = {
  meta: { schemaVersion: number; updatedAt: string }
  assets: Asset[]
  snapshots: Snapshot[]
  snapshotValues: SnapshotValue[]
}

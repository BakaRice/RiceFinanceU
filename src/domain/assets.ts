// src/domain/assets.ts
import type { Asset, AssetType } from '../types/finance'

export function isInvestmentType(type: AssetType): boolean {
  return type === 'fund' || type === 'stock' || type === 'gold'
}

export function isBalanceType(type: AssetType): boolean {
  return !isInvestmentType(type)
}

export function filterActiveAssets(assets: Asset[]): Asset[] {
  return assets.filter((a) => a.isActive)
}

export function groupAssetsByType(assets: Asset[]): Record<AssetType, Asset[]> {
  const groups: Record<string, Asset[]> = {}
  for (const a of assets) {
    if (!groups[a.type]) groups[a.type] = []
    groups[a.type].push(a)
  }
  return groups as Record<AssetType, Asset[]>
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  fund: '基金',
  stock: '股票',
  gold: '黄金',
  deposit: '存款',
  cash: '现金',
  housing_fund: '公积金',
  other: '其他',
}

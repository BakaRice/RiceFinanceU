// src/domain/assets.ts
import type { Asset, AssetProfile, AssetProfileKey, AssetType } from '../types/finance'

export interface AssetProfileField {
  key: AssetProfileKey
  label: string
  placeholder?: string
  inputType?: 'text' | 'date'
}

// Single source of truth for asset dossier fields. These fields are intentionally
// descriptive only; do not use them for amount/profit/trend calculations.
export const ASSET_PROFILE_FIELDS: Record<AssetType, AssetProfileField[]> = {
  fund: [
    { key: 'fundCode', label: '基金代码', placeholder: '如：513100' },
    { key: 'fundCategory', label: '基金类别', placeholder: '如：指数基金、债券基金' },
    { key: 'marketTheme', label: '投资市场/主题', placeholder: '如：美股/纳指100' },
    { key: 'holdingPlatform', label: '持有平台', placeholder: '如：蚂蚁财富' },
  ],
  stock: [
    { key: 'ticker', label: '证券代码', placeholder: '如：AAPL、00700' },
    { key: 'exchange', label: '交易市场', placeholder: '如：NASDAQ、HKEX' },
    { key: 'brokerAccount', label: '券商/账户', placeholder: '如：富途证券' },
    { key: 'industryTag', label: '行业/策略标签', placeholder: '如：科技/长期持有' },
  ],
  gold: [
    { key: 'holdingForm', label: '持有形态', placeholder: '如：积存金、实物金' },
    { key: 'custodian', label: '平台/保管方', placeholder: '如：支付宝、银行保险箱' },
    { key: 'unit', label: '计量单位', placeholder: '如：克' },
    { key: 'sourceNote', label: '来源备注', placeholder: '如：手动盘点' },
  ],
  deposit: [
    { key: 'bank', label: '银行', placeholder: '如：招商银行' },
    { key: 'depositType', label: '存款类型', placeholder: '如：定期、结构性存款' },
    { key: 'term', label: '期限', placeholder: '如：3个月、1年' },
    { key: 'maturityDate', label: '到期日', inputType: 'date' },
    { key: 'annualRate', label: '约定年利率', placeholder: '如：2.10%' },
  ],
  cash: [
    { key: 'accountChannel', label: '账户渠道', placeholder: '如：微信零钱、现金钱包' },
    { key: 'purposeTag', label: '用途标签', placeholder: '如：日常备用' },
    { key: 'availabilityNote', label: '可用性备注', placeholder: '如：随时可用' },
  ],
  housing_fund: [
    { key: 'contributionCity', label: '缴存城市', placeholder: '如：上海' },
    { key: 'accountOwner', label: '账户归属', placeholder: '如：本人' },
    { key: 'managementNote', label: '管理中心/单位备注', placeholder: '如：市公积金中心' },
  ],
  other: [
    { key: 'customCategory', label: '自定义分类', placeholder: '如：保险现金价值' },
    { key: 'ownershipNote', label: '权属说明', placeholder: '如：本人持有' },
    { key: 'managementNote', label: '管理备注', placeholder: '如：年度盘点' },
    { key: 'reminderDate', label: '到期/提醒日期', inputType: 'date' },
  ],
}

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

export function getAssetProfileFields(type: AssetType): AssetProfileField[] {
  return ASSET_PROFILE_FIELDS[type] || []
}

export function sanitizeAssetProfile(
  type: AssetType,
  profile: unknown,
): AssetProfile | undefined {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return undefined

  const input = profile as Record<string, unknown>
  const cleaned: AssetProfile = {}

  // Type switches can leave hidden form fields behind. Only persist keys that
  // belong to the current asset type, and drop empty strings.
  for (const field of getAssetProfileFields(type)) {
    const value = input[field.key]
    if (typeof value !== 'string') continue

    const trimmed = value.trim()
    if (trimmed) {
      cleaned[field.key] = trimmed
    }
  }

  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}

export function formatAssetProfileIdentifier(asset: Asset): string {
  const profile = asset.profile || {}

  // The asset list needs one compact searchable hint, not the full dossier.
  switch (asset.type) {
    case 'fund':
      return profile.fundCode || '-'
    case 'stock':
      return [profile.exchange, profile.ticker].filter(Boolean).join(' ') || '-'
    case 'gold':
      return profile.holdingForm || '-'
    case 'deposit':
      return profile.maturityDate || '-'
    case 'cash':
      return profile.accountChannel || '-'
    case 'housing_fund':
      return profile.contributionCity || '-'
    case 'other':
      return profile.customCategory || '-'
  }
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

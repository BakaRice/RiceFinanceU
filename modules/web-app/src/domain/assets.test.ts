// src/domain/assets.test.ts
import { describe, it, expect } from 'vitest'
import {
  formatAssetProfileIdentifier,
  getAssetProfileFields,
  isRestrictedAssetType,
  isInvestmentType,
  isBalanceType,
  filterActiveAssets,
  groupAssetsByType,
  sanitizeAssetProfile,
} from './assets'
import type { Asset } from '../types/finance'

const makeAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'a1',
  name: '测试资产',
  type: 'fund',
  currency: 'CNY',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('isInvestmentType', () => {
  it('fund is investment', () => { expect(isInvestmentType('fund')).toBe(true) })
  it('stock is investment', () => { expect(isInvestmentType('stock')).toBe(true) })
  it('gold is investment', () => { expect(isInvestmentType('gold')).toBe(true) })
  it('deposit is not investment', () => { expect(isInvestmentType('deposit')).toBe(false) })
  it('cash is not investment', () => { expect(isInvestmentType('cash')).toBe(false) })
  it('housing_fund is not investment', () => { expect(isInvestmentType('housing_fund')).toBe(false) })
  it('other is not investment', () => { expect(isInvestmentType('other')).toBe(false) })
})

describe('isBalanceType', () => {
  it('fund is not balance', () => { expect(isBalanceType('fund')).toBe(false) })
  it('deposit is balance', () => { expect(isBalanceType('deposit')).toBe(true) })
})

describe('isRestrictedAssetType', () => {
  it('marks housing fund as restricted and leaves cash/deposit spendable by default', () => {
    expect(isRestrictedAssetType('housing_fund')).toBe(true)
    expect(isRestrictedAssetType('cash')).toBe(false)
    expect(isRestrictedAssetType('deposit')).toBe(false)
  })
})

describe('filterActiveAssets', () => {
  it('filters out inactive assets', () => {
    const assets = [makeAsset({ id: '1', isActive: true }), makeAsset({ id: '2', isActive: false })]
    expect(filterActiveAssets(assets)).toHaveLength(1)
    expect(filterActiveAssets(assets)[0].id).toBe('1')
  })

  it('returns all when all active', () => {
    const assets = [makeAsset({ id: '1' }), makeAsset({ id: '2' })]
    expect(filterActiveAssets(assets)).toHaveLength(2)
  })
})

describe('groupAssetsByType', () => {
  it('groups assets by type', () => {
    const assets = [
      makeAsset({ id: '1', type: 'fund' }),
      makeAsset({ id: '2', type: 'fund' }),
      makeAsset({ id: '3', type: 'deposit' }),
    ]
    const groups = groupAssetsByType(assets)
    expect(groups.fund).toHaveLength(2)
    expect(groups.deposit).toHaveLength(1)
  })
})

describe('asset profile fields', () => {
  it('lists type-specific profile fields', () => {
    expect(getAssetProfileFields('fund').map((field) => field.key)).toEqual([
      'fundCode',
      'fundCategory',
      'marketTheme',
      'holdingPlatform',
    ])
    expect(getAssetProfileFields('deposit').map((field) => field.key)).toContain('maturityDate')
  })

  it('keeps only non-empty fields allowed by the selected asset type', () => {
    const profile = sanitizeAssetProfile('fund', {
      fundCode: ' 513100 ',
      marketTheme: ' 美股 ',
      maturityDate: '2027-01-01',
      brokerAccount: 'hidden',
      empty: '',
    })

    expect(profile).toEqual({
      fundCode: '513100',
      marketTheme: '美股',
    })
  })

  it('returns undefined when a profile has no usable values', () => {
    expect(sanitizeAssetProfile('cash', { accountChannel: '   ' })).toBeUndefined()
  })

  it('formats compact identifiers for asset lists', () => {
    expect(formatAssetProfileIdentifier(makeAsset({
      type: 'stock',
      profile: { exchange: 'NASDAQ', ticker: 'AAPL' },
    }))).toBe('NASDAQ AAPL')
    expect(formatAssetProfileIdentifier(makeAsset({
      type: 'housing_fund',
      profile: { contributionCity: '上海' },
    }))).toBe('上海')
    expect(formatAssetProfileIdentifier(makeAsset({ type: 'other' }))).toBe('-')
  })
})

// src/domain/snapshots.ts
import type { Asset, Snapshot, SnapshotValue, CreateSnapshotInput, ExchangeRates } from '../types/finance'
import { isInvestmentType, ASSET_TYPE_LABELS } from './assets'
import { roundMoney } from './money'

// ——— Currency conversion ———

const DEFAULT_RATES: ExchangeRates = { USD: 7.2, HKD: 0.92, updatedAt: '' }

export function convertToCNY(amount: number, currency: string, rates?: ExchangeRates): number {
  const r = rates || DEFAULT_RATES
  switch (currency) {
    case 'USD': return roundMoney(amount * r.USD)
    case 'HKD': return roundMoney(amount * r.HKD)
    default: return amount
  }
}

// ——— Partial update completion ———

/**
 * Complete a partial snapshot submission into a full snapshot.
 * Rules:
 * 1. Copy all values from the previous latest snapshot.
 * 2. Override with values submitted this time (matched by assetId).
 * 3. If a submitted value has no assetId but has an inline asset, the asset is new.
 */
export function completeSnapshotValues(
  previousValues: SnapshotValue[],
  input: CreateSnapshotInput['values'],
  newAssetIds: Record<string, string> // maps temporary index → real assetId
): SnapshotValue[] {
  // Start with a copy of previous values
  const result: SnapshotValue[] = previousValues.map((v) => ({ ...v }))

  for (let i = 0; i < input.length; i++) {
    const item = input[i]
    const assetId = item.assetId || newAssetIds[`inline_${i}`]

    if (!assetId) continue

    const sv: SnapshotValue = {
      id: '', // will be assigned by the server
      snapshotId: '', // will be assigned by the server
      assetId,
      amount: roundMoney(item.amount),
      profit: item.profit !== undefined ? roundMoney(item.profit) : undefined,
      profitRate: item.profitRate !== undefined ? roundMoney(item.profitRate * 10000) / 10000 : undefined,
      note: item.note,
    }

    // Find and replace existing, or push new
    const existingIdx = result.findIndex((v) => v.assetId === assetId)
    if (existingIdx >= 0) {
      result[existingIdx] = { ...result[existingIdx], ...sv, id: result[existingIdx].id }
    } else {
      result.push(sv)
    }
  }

  return result
}

// ——— Aggregation ———

export interface CurrencyBreakdown {
  currency: string
  amount: number
  count: number
}

export interface SnapshotTotal {
  totalAmount: number
  totalAmountCNY: number
  investmentAmount: number
  investmentAmountCNY: number
  balanceAmount: number
  balanceAmountCNY: number
  totalProfit: number
  totalProfitCNY: number
  valueCount: number
  byCurrency: CurrencyBreakdown[]
}

export function calculateSnapshotTotal(
  values: SnapshotValue[],
  assets: Asset[],
  rates?: ExchangeRates
): SnapshotTotal {
  const assetMap = new Map(assets.map((a) => [a.id, a]))
  let totalAmount = 0
  let totalAmountCNY = 0
  let investmentAmount = 0
  let investmentAmountCNY = 0
  let balanceAmount = 0
  let balanceAmountCNY = 0
  let totalProfit = 0
  let totalProfitCNY = 0

  const currencyAmounts: Record<string, { amount: number; count: number }> = {}

  for (const v of values) {
    const asset = assetMap.get(v.assetId)
    const currency = asset?.currency || 'CNY'
    const factor = currency === 'USD' ? (rates?.USD || DEFAULT_RATES.USD) : currency === 'HKD' ? (rates?.HKD || DEFAULT_RATES.HKD) : 1

    if (!currencyAmounts[currency]) currencyAmounts[currency] = { amount: 0, count: 0 }
    currencyAmounts[currency].amount += v.amount
    currencyAmounts[currency].count++

    totalAmount += v.amount
    totalAmountCNY += roundMoney(v.amount * factor)

    if (asset && isInvestmentType(asset.type)) {
      investmentAmount += v.amount
      investmentAmountCNY += roundMoney(v.amount * factor)
      if (v.profit !== undefined && Number.isFinite(v.profit)) {
        totalProfit += v.profit
        totalProfitCNY += roundMoney(v.profit * factor)
      }
    } else {
      balanceAmount += v.amount
      balanceAmountCNY += roundMoney(v.amount * factor)
    }
  }

  const byCurrency: CurrencyBreakdown[] = Object.entries(currencyAmounts)
    .map(([currency, data]) => ({ currency, amount: roundMoney(data.amount), count: data.count }))
    .sort((a, b) => b.amount - a.amount)

  return {
    totalAmount: roundMoney(totalAmount),
    totalAmountCNY: roundMoney(totalAmountCNY),
    investmentAmount: roundMoney(investmentAmount),
    investmentAmountCNY: roundMoney(investmentAmountCNY),
    balanceAmount: roundMoney(balanceAmount),
    balanceAmountCNY: roundMoney(balanceAmountCNY),
    totalProfit: roundMoney(totalProfit),
    totalProfitCNY: roundMoney(totalProfitCNY),
    valueCount: values.length,
    byCurrency,
  }
}

// ——— Allocation ———

export interface AllocationItem {
  type: string
  label: string
  amount: number
  percentage: number
}

export function calculateAllocation(
  values: SnapshotValue[],
  assets: Asset[],
  rates?: ExchangeRates
): AllocationItem[] {
  const assetMap = new Map(assets.map((a) => [a.id, a]))
  const typeAmounts: Record<string, number> = {}
  let totalAmount = 0

  for (const v of values) {
    const asset = assetMap.get(v.assetId)
    const currency = asset?.currency || 'CNY'
    const factor = currency === 'USD' ? (rates?.USD || DEFAULT_RATES.USD) : currency === 'HKD' ? (rates?.HKD || DEFAULT_RATES.HKD) : 1
    const amountCNY = roundMoney(v.amount * factor)
    const type = asset?.type || 'other'
    typeAmounts[type] = (typeAmounts[type] || 0) + amountCNY
    totalAmount += amountCNY
  }

  const items: AllocationItem[] = Object.entries(typeAmounts)
    .map(([type, amount]) => ({
      type,
      label: ASSET_TYPE_LABELS[type as keyof typeof ASSET_TYPE_LABELS] || type,
      amount: roundMoney(amount),
      percentage: totalAmount > 0 ? roundMoney((amount / totalAmount) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  return items
}

// ——— Comparison between two snapshots ———

export interface SnapshotComparisonItem {
  assetId: string
  assetName: string
  assetType: string
  previousAmount: number
  currentAmount: number
  amountChange: number
  previousProfit?: number
  currentProfit?: number
  profitChange?: number
}

export interface SnapshotComparison {
  snapshotId: string
  previousSnapshotId: string
  items: SnapshotComparisonItem[]
  totalAmountChange: number
  totalProfitChange?: number
}

export function compareSnapshots(
  assets: Asset[],
  previousValues: SnapshotValue[],
  currentValues: SnapshotValue[]
): SnapshotComparison {
  const assetMap = new Map(assets.map((a) => [a.id, a]))
  const prevMap = new Map(previousValues.map((v) => [v.assetId, v]))
  const currMap = new Map(currentValues.map((v) => [v.assetId, v]))

  const allAssetIds = new Set([...prevMap.keys(), ...currMap.keys()])

  const items: SnapshotComparisonItem[] = []
  let totalAmountChange = 0
  let totalProfitChange = 0

  for (const assetId of allAssetIds) {
    const asset = assetMap.get(assetId)
    const prev = prevMap.get(assetId)
    const curr = currMap.get(assetId)
    const previousAmount = prev?.amount || 0
    const currentAmount = curr?.amount || 0
    const amountChange = roundMoney(currentAmount - previousAmount)

    let previousProfit: number | undefined
    let currentProfit: number | undefined
    let profitChange: number | undefined

    if (asset && isInvestmentType(asset.type)) {
      previousProfit = prev?.profit
      currentProfit = curr?.profit
      if (previousProfit !== undefined && currentProfit !== undefined && Number.isFinite(previousProfit) && Number.isFinite(currentProfit)) {
        profitChange = roundMoney(currentProfit - previousProfit)
        totalProfitChange += profitChange
      }
    }

    totalAmountChange += amountChange
    items.push({
      assetId,
      assetName: asset?.name || assetId,
      assetType: asset?.type || 'other',
      previousAmount,
      currentAmount,
      amountChange,
      previousProfit,
      currentProfit,
      profitChange,
    })
  }

  items.sort((a, b) => Math.abs(b.amountChange) - Math.abs(a.amountChange))

  return {
    snapshotId: currentValues[0]?.snapshotId || '',
    previousSnapshotId: previousValues[0]?.snapshotId || '',
    items,
    totalAmountChange: roundMoney(totalAmountChange),
    totalProfitChange: roundMoney(totalProfitChange),
  }
}

// ——— Total asset history series ———

export interface TotalAssetPoint {
  recordedAt: string
  totalAmount: number
  investmentAmount: number
  balanceAmount: number
  totalProfit: number
}

export function buildTotalAssetSeries(
  snapshots: Snapshot[],
  valuesBySnapshot: Map<string, SnapshotValue[]>,
  assets: Asset[],
  rates?: ExchangeRates
): TotalAssetPoint[] {
  const sorted = [...snapshots].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
  return sorted.map((snap) => {
    const values = valuesBySnapshot.get(snap.id) || []
    const total = calculateSnapshotTotal(values, assets, rates)
    return {
      recordedAt: snap.recordedAt,
      totalAmount: total.totalAmountCNY,
      investmentAmount: total.investmentAmountCNY,
      balanceAmount: total.balanceAmountCNY,
      totalProfit: total.totalProfitCNY,
    }
  })
}

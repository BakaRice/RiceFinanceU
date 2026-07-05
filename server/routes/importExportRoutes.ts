// server/routes/importExportRoutes.ts
import { Router, Request, Response } from 'express'
import {
  readAssets, writeAssets,
  readSnapshots, writeSnapshots,
  readSnapshotValues, writeSnapshotValues,
  readMeta, writeMeta,
} from '../storage'
import type { ExportData, Asset, Snapshot, SnapshotValue } from '../../src/types/finance'
import { sanitizeAssetProfile } from '../../src/domain/assets'

const VALID_ASSET_TYPES = ['fund', 'stock', 'gold', 'deposit', 'cash', 'housing_fund', 'other']
const VALID_CURRENCIES = ['CNY', 'USD', 'HKD']

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

export const importExportRoutes = Router()

importExportRoutes.get('/export', (_req: Request, res: Response) => {
  try {
    const meta = readMeta()
    res.json({
      meta: { schemaVersion: 2, updatedAt: meta.updatedAt },
      assets: readAssets(),
      snapshots: readSnapshots(),
      snapshotValues: readSnapshotValues(),
    } as ExportData)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ——— Validation helpers ———

interface ValidationError {
  entity: string
  index: number
  id: string
  field: string
  message: string
}

function validateAsset(a: any, index: number): ValidationError[] {
  const errs: ValidationError[] = []
  const id = a?.id ? String(a.id) : `index-${index}`
  const tag = (field: string, msg: string) => ({ entity: 'asset', index, id, field, message: msg })

  if (!a || typeof a !== 'object') { errs.push(tag('_', 'is not an object')); return errs }
  if (typeof a.id !== 'string' || !a.id.trim()) errs.push(tag('id', 'missing or empty'))
  if (typeof a.name !== 'string' || !a.name.trim()) errs.push(tag('name', 'missing or empty'))
  if (!VALID_ASSET_TYPES.includes(a.type)) errs.push(tag('type', `invalid type "${a.type}", must be one of: ${VALID_ASSET_TYPES.join(', ')}`))
  if (!VALID_CURRENCIES.includes(a.currency)) errs.push(tag('currency', `invalid currency "${a.currency}", must be one of: ${VALID_CURRENCIES.join(', ')}`))
  if (typeof a.isActive !== 'boolean') errs.push(tag('isActive', 'must be a boolean'))
  if (typeof a.createdAt !== 'string' || isNaN(Date.parse(a.createdAt))) errs.push(tag('createdAt', 'invalid or missing date'))
  if (typeof a.updatedAt !== 'string' || isNaN(Date.parse(a.updatedAt))) errs.push(tag('updatedAt', 'invalid or missing date'))
  // Optional fields type checks
  if (a.institution !== undefined && a.institution !== null && typeof a.institution !== 'string') errs.push(tag('institution', 'must be a string if present'))
  if (a.note !== undefined && a.note !== null && typeof a.note !== 'string') errs.push(tag('note', 'must be a string if present'))
  if (a.profile !== undefined && a.profile !== null) {
    if (typeof a.profile !== 'object' || Array.isArray(a.profile)) {
      errs.push(tag('profile', 'must be an object if present'))
    } else {
      for (const [key, value] of Object.entries(a.profile)) {
        if (typeof value !== 'string') {
          errs.push(tag(`profile.${key}`, 'must be a string if present'))
        }
      }
    }
  }

  return errs
}

function validateSnapshot(s: any, index: number): ValidationError[] {
  const errs: ValidationError[] = []
  const id = s?.id ? String(s.id) : `index-${index}`
  const tag = (field: string, msg: string) => ({ entity: 'snapshot', index, id, field, message: msg })

  if (!s || typeof s !== 'object') { errs.push(tag('_', 'is not an object')); return errs }
  if (typeof s.id !== 'string' || !s.id.trim()) errs.push(tag('id', 'missing or empty'))
  if (typeof s.recordedAt !== 'string' || isNaN(Date.parse(s.recordedAt))) errs.push(tag('recordedAt', 'invalid or missing date'))
  if (typeof s.createdAt !== 'string' || isNaN(Date.parse(s.createdAt))) errs.push(tag('createdAt', 'invalid or missing date'))
  if (s.note !== undefined && s.note !== null && typeof s.note !== 'string') errs.push(tag('note', 'must be a string if present'))

  return errs
}

function validateSnapshotValue(v: any, index: number, assetIds: Set<string>, snapIds: Set<string>): ValidationError[] {
  const errs: ValidationError[] = []
  const id = v?.id ? String(v.id) : `index-${index}`
  const tag = (field: string, msg: string) => ({ entity: 'snapshotValue', index, id, field, message: msg })

  if (!v || typeof v !== 'object') { errs.push(tag('_', 'is not an object')); return errs }
  if (typeof v.id !== 'string' || !v.id.trim()) errs.push(tag('id', 'missing or empty'))
  if (typeof v.snapshotId !== 'string' || !v.snapshotId.trim()) {
    errs.push(tag('snapshotId', 'missing or empty'))
  } else if (!snapIds.has(v.snapshotId)) {
    errs.push(tag('snapshotId', `snapshotId "${v.snapshotId}" does not match any snapshot in this import`))
  }
  if (typeof v.assetId !== 'string' || !v.assetId.trim()) {
    errs.push(tag('assetId', 'missing or empty'))
  } else if (!assetIds.has(v.assetId)) {
    errs.push(tag('assetId', `assetId "${v.assetId}" does not match any asset in this import`))
  }
  if (typeof v.amount !== 'number' || !Number.isFinite(v.amount) || v.amount < 0) {
    errs.push(tag('amount', `must be a non-negative number, got "${v.amount}"`))
  }
  if (v.profit !== undefined && v.profit !== null) {
    if (typeof v.profit !== 'number' || !Number.isFinite(v.profit)) errs.push(tag('profit', `must be a finite number, got "${v.profit}"`))
  }
  if (v.profitRate !== undefined && v.profitRate !== null) {
    if (typeof v.profitRate !== 'number' || !Number.isFinite(v.profitRate)) errs.push(tag('profitRate', `must be a finite number, got "${v.profitRate}"`))
  }
  if (v.note !== undefined && v.note !== null && typeof v.note !== 'string') errs.push(tag('note', 'must be a string if present'))

  return errs
}

function formatValidationErrors(errors: ValidationError[], maxShow: number = 10): string {
  const total = errors.length
  const shown = errors.slice(0, maxShow)
  const lines = shown.map((e) => `  ${e.entity}[${e.index}] ${e.id}: ${e.field} — ${e.message}`)
  if (total > maxShow) lines.push(`  ... and ${total - maxShow} more errors`)
  return `${total} validation error(s):\n${lines.join('\n')}`
}

importExportRoutes.post('/import', (req: Request, res: Response) => {
  try {
    const data = req.body

    // ——— Structural checks ———
    if (!data || typeof data !== 'object') {
      res.status(400).json({ error: 'Invalid backup: request body is not an object' })
      return
    }
    if (!data.meta || typeof data.meta.schemaVersion !== 'number') {
      res.status(400).json({ error: 'Invalid backup: missing or invalid meta.schemaVersion' })
      return
    }
    if (data.meta.schemaVersion !== 1 && data.meta.schemaVersion !== 2) {
      res.status(400).json({ error: `Unsupported schema version: ${data.meta.schemaVersion}. Supported: 1, 2` })
      return
    }
    if (!Array.isArray(data.assets)) {
      res.status(400).json({ error: 'Invalid backup: assets must be an array' })
      return
    }
    if (!Array.isArray(data.snapshots) && !Array.isArray(data.transactions)) {
      res.status(400).json({ error: 'Invalid backup: snapshots must be an array' })
      return
    }
    if (!Array.isArray(data.snapshotValues)) {
      res.status(400).json({ error: 'Invalid backup: snapshotValues must be an array' })
      return
    }

    // Normalize v1 → v2
    const snapshots: any[] = data.snapshots || data.transactions || []
    const allErrors: ValidationError[] = []

    // ——— Validate assets ———
    for (let i = 0; i < data.assets.length; i++) {
      allErrors.push(...validateAsset(data.assets[i], i))
    }

    // Build ID sets for referential checks
    const assetIds = new Set<string>()
    for (const a of data.assets) {
      if (a && typeof a.id === 'string' && a.id.trim()) assetIds.add(a.id)
    }
    const snapIds = new Set<string>()
    for (const s of snapshots) {
      if (s && typeof s.id === 'string' && s.id.trim()) snapIds.add(s.id)
    }

    // ——— Validate snapshots ———
    for (let i = 0; i < snapshots.length; i++) {
      allErrors.push(...validateSnapshot(snapshots[i], i))
    }

    // ——— Validate snapshot values ———
    for (let i = 0; i < data.snapshotValues.length; i++) {
      allErrors.push(...validateSnapshotValue(data.snapshotValues[i], i, assetIds, snapIds))
    }

    if (allErrors.length > 0) {
      res.status(400).json({
        error: formatValidationErrors(allErrors),
        errorCount: allErrors.length,
      })
      return
    }

    // ——— Normalize values: round amounts, recalculate profitRate ———
    const investmentTypes = new Set(['fund', 'stock', 'gold'])
    const assetTypeMap = new Map<string, string>()
    for (const a of data.assets) {
      if (a && typeof a.id === 'string' && a.type) {
        assetTypeMap.set(a.id, a.type)
      }
    }

    const normalizedAssets: Asset[] = data.assets.map((asset: any) => {
      const profile = sanitizeAssetProfile(asset.type, asset.profile)
      const normalizedAsset = { ...asset } as Asset
      if (profile) {
        normalizedAsset.profile = profile
      } else {
        delete normalizedAsset.profile
      }
      return normalizedAsset
    })

    const normalizedValues: SnapshotValue[] = data.snapshotValues.map((v: any) => {
      const amount = round2(v.amount)
      const assetType = assetTypeMap.get(v.assetId)
      const isInvestment = assetType ? investmentTypes.has(assetType) : false

      let profit: number | undefined
      let profitRate: number | undefined

      if (!isInvestment) {
        // Balance-type assets: strip profit/profitRate
        return {
          id: v.id,
          snapshotId: v.snapshotId,
          assetId: v.assetId,
          amount,
          note: v.note || undefined,
        }
      }

      const hasProfit = typeof v.profit === 'number' && Number.isFinite(v.profit)
      const hasRate = typeof v.profitRate === 'number' && Number.isFinite(v.profitRate) && v.profitRate > -1

      if (hasProfit) {
        // profit present → recalculate profitRate from profit / (amount - profit)
        profit = round2(v.profit)
        const cost = amount - profit
        if (cost > 0) {
          profitRate = round4(profit / cost)
        }
      } else if (hasRate) {
        // profitRate present, no profit → calculate profit from rate
        profitRate = round4(v.profitRate)
        const cost = amount / (1 + profitRate)
        profit = round2(amount - cost)
      }
      // If neither, both stay undefined

      return {
        id: v.id,
        snapshotId: v.snapshotId,
        assetId: v.assetId,
        amount,
        profit,
        profitRate,
        note: v.note || undefined,
      }
    })

    // ——— All valid, write ———
    writeAssets(normalizedAssets)
    writeSnapshots(snapshots as Snapshot[])
    writeSnapshotValues(normalizedValues)
    writeMeta({ schemaVersion: 2, updatedAt: new Date().toISOString() })

    res.json({
      success: true,
      message: `Data imported: ${data.assets.length} assets, ${snapshots.length} snapshots, ${data.snapshotValues.length} values`,
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

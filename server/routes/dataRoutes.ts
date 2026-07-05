// server/routes/dataRoutes.ts
import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
  readAssets, writeAssets,
  readSnapshots, writeSnapshots,
  readSnapshotValues, writeSnapshotValues,
  readRates, writeRates,
} from '../storage'
import type { Asset, Snapshot, SnapshotValue, CreateSnapshotInput, ExchangeRates } from '../../src/types/finance'
import { isInvestmentType, sanitizeAssetProfile } from '../../src/domain/assets'
import { completeSnapshotValues } from '../../src/domain/snapshots'

const VALID_ASSET_TYPES = ['fund', 'stock', 'gold', 'deposit', 'cash', 'housing_fund', 'other']
const VALID_CURRENCIES = ['CNY', 'USD', 'HKD']

function validateAssetType(type: string): boolean {
  return VALID_ASSET_TYPES.includes(type)
}

export const dataRoutes = Router()

// ——— Assets ———

dataRoutes.get('/assets', (_req: Request, res: Response) => {
  try { res.json(readAssets()) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.post('/assets', (req: Request, res: Response) => {
  try {
    const { name, type, currency, institution, note, profile } = req.body
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required and must be non-empty' })
      return
    }
    if (!type || !validateAssetType(type)) {
      res.status(400).json({ error: `type must be one of: ${VALID_ASSET_TYPES.join(', ')}` })
      return
    }
    const assetCurrency = currency && VALID_CURRENCIES.includes(currency) ? currency : 'CNY'
    const assets = readAssets()
    const now = new Date().toISOString()
    const assetProfile = sanitizeAssetProfile(type, profile)
    const newAsset: Asset = {
      id: uuidv4(), name: name.trim(), type,
      currency: assetCurrency, institution, isActive: true, note,
      ...(assetProfile ? { profile: assetProfile } : {}),
      createdAt: now, updatedAt: now,
    }
    assets.push(newAsset)
    writeAssets(assets)
    res.status(201).json(newAsset)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.patch('/assets/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const assets = readAssets()
    const idx = assets.findIndex((a) => a.id === id)
    if (idx === -1) { res.status(404).json({ error: 'Asset not found' }); return }
    if (req.body.type && !validateAssetType(req.body.type)) {
      res.status(400).json({ error: `type must be one of: ${VALID_ASSET_TYPES.join(', ')}` })
      return
    }
    const nextType = req.body.type || assets[idx].type
    const nextProfile = sanitizeAssetProfile(
      nextType,
      req.body.profile !== undefined ? req.body.profile : assets[idx].profile,
    )
    const nextAsset: Asset = {
      ...assets[idx],
      ...req.body,
      id,
      type: nextType,
      updatedAt: new Date().toISOString(),
    }
    if (nextProfile) {
      nextAsset.profile = nextProfile
    } else {
      delete nextAsset.profile
    }
    assets[idx] = nextAsset
    writeAssets(assets)
    res.json(assets[idx])
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.delete('/assets/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const assets = readAssets()
    const idx = assets.findIndex((a) => a.id === id)
    if (idx === -1) { res.status(404).json({ error: 'Asset not found' }); return }
    // Soft delete
    assets[idx] = { ...assets[idx], isActive: false, updatedAt: new Date().toISOString() }
    writeAssets(assets)
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ——— Snapshots ———

dataRoutes.get('/snapshots', (_req: Request, res: Response) => {
  try {
    const snapshots = readSnapshots()
    snapshots.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    res.json(snapshots)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.get('/snapshots/latest', (_req: Request, res: Response) => {
  try {
    const snapshots = readSnapshots()
    if (snapshots.length === 0) { res.json(null); return }
    snapshots.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    const latest = snapshots[0]
    const values = readSnapshotValues().filter((v) => v.snapshotId === latest.id)
    res.json({ snapshot: latest, values })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.get('/snapshots/:id', (req: Request, res: Response) => {
  try {
    const snapshots = readSnapshots()
    const snapshot = snapshots.find((s) => s.id === req.params.id)
    if (!snapshot) { res.status(404).json({ error: 'Snapshot not found' }); return }
    const values = readSnapshotValues().filter((v) => v.snapshotId === snapshot.id)
    res.json({ snapshot, values })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.delete('/snapshots/:id', (req: Request, res: Response) => {
  try {
    const snapshots = readSnapshots()
    const idx = snapshots.findIndex((s) => s.id === req.params.id)
    if (idx === -1) { res.status(404).json({ error: 'Snapshot not found' }); return }

    // Remove snapshot and its values
    snapshots.splice(idx, 1)
    writeSnapshots(snapshots)

    const allValues = readSnapshotValues().filter((v) => v.snapshotId !== req.params.id)
    writeSnapshotValues(allValues)

    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.post('/snapshots', (req: Request, res: Response) => {
  try {
    const input = req.body as CreateSnapshotInput

    if (!input.recordedAt || typeof input.recordedAt !== 'string') {
      res.status(400).json({ error: 'recordedAt is required' })
      return
    }
    if (isNaN(Date.parse(input.recordedAt))) {
      res.status(400).json({ error: 'recordedAt must be a valid date/time' })
      return
    }
    if (!Array.isArray(input.values) || input.values.length === 0) {
      res.status(400).json({ error: 'values must be a non-empty array' })
      return
    }

    for (const v of input.values) {
      if (v.amount === undefined || !Number.isFinite(Number(v.amount))) {
        res.status(400).json({ error: 'each value must have a valid amount (finite number)' })
        return
      }
      if (v.assetId) {
        const assets = readAssets()
        const asset = assets.find((a) => a.id === v.assetId)
        if (!asset) { res.status(400).json({ error: `asset ${v.assetId} not found` }); return }
        if (!asset.isActive) { res.status(400).json({ error: `asset ${v.assetId} is not active` }); return }
        if (!isInvestmentType(asset.type)) {
          if (v.profit !== undefined || v.profitRate !== undefined) {
            res.status(400).json({ error: `balance asset ${v.assetId} cannot have profit or profitRate` })
            return
          }
        }
      }
      if (!v.assetId && !v.asset) {
        res.status(400).json({ error: 'each value must have either assetId or inline asset' })
        return
      }
      if (v.asset) {
        if (!v.asset.name || !v.asset.type) {
          res.status(400).json({ error: 'inline asset must have name and type' })
          return
        }
        if (!validateAssetType(v.asset.type)) {
          res.status(400).json({ error: `inline asset type must be one of: ${VALID_ASSET_TYPES.join(', ')}` })
          return
        }
      }
    }

    // Handle inline asset creation
    const assets = readAssets()
    const newAssetIds: Record<string, string> = {}

    for (let i = 0; i < input.values.length; i++) {
      const v = input.values[i]
      if (!v.assetId && v.asset) {
        const newId = uuidv4()
        const now = new Date().toISOString()
        const assetCurrency = v.asset.currency && VALID_CURRENCIES.includes(v.asset.currency) ? v.asset.currency : 'CNY'
        const profile = sanitizeAssetProfile(v.asset.type, v.asset.profile)
        assets.push({
          id: newId, name: v.asset.name.trim(), type: v.asset.type,
          currency: assetCurrency, institution: v.asset.institution,
          ...(profile ? { profile } : {}),
          isActive: true, note: v.asset.note,
          createdAt: now, updatedAt: now,
        })
        newAssetIds[`inline_${i}`] = newId
      }
    }

    if (Object.keys(newAssetIds).length > 0) {
      writeAssets(assets)
    }

    // Partial update completion
    const snapshots = readSnapshots()
    let previousValues: SnapshotValue[] = []
    if (snapshots.length > 0) {
      snapshots.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
      previousValues = readSnapshotValues().filter((v) => v.snapshotId === snapshots[0].id)
    }

    const now = new Date().toISOString()
    const snapshotId = uuidv4()
    const completedValues = completeSnapshotValues(previousValues, input.values, newAssetIds)

    const allValues: SnapshotValue[] = completedValues.map((v) => ({
      ...v, id: uuidv4(), snapshotId,
    }))

    const snapshot: Snapshot = { id: snapshotId, recordedAt: input.recordedAt, note: input.note, createdAt: now }
    snapshots.push(snapshot)
    writeSnapshots(snapshots)

    const allSnapshotValues = readSnapshotValues()
    allSnapshotValues.push(...allValues)
    writeSnapshotValues(allSnapshotValues)

    res.status(201).json({ snapshot, values: allValues })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ——— Snapshot values ———

dataRoutes.get('/snapshot-values', (_req: Request, res: Response) => {
  try { res.json(readSnapshotValues()) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ——— Exchange Rates ———

dataRoutes.get('/rates', (_req: Request, res: Response) => {
  try { res.json(readRates()) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.post('/rates', (req: Request, res: Response) => {
  try {
    const { USD, HKD } = req.body
    const rates = readRates()
    if (USD !== undefined && Number.isFinite(Number(USD)) && Number(USD) > 0) rates.USD = Number(USD)
    if (HKD !== undefined && Number.isFinite(Number(HKD)) && Number(HKD) > 0) rates.HKD = Number(HKD)
    writeRates(rates)
    res.json(rates)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// server/routes/dataRoutes.ts
import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
  readDeposits, writeDeposits,
  readFunds, writeFunds,
  readTransactions, writeTransactions,
  readNavPrices, writeNavPrices,
  readAssets, writeAssets,
  readSnapshots, writeSnapshots,
  readSnapshotValues, writeSnapshotValues,
  readMeta, writeMeta,
} from '../storage'
import type {
  DepositAccount, Fund, Transaction, FundNavPrice,
  Asset, Snapshot, SnapshotValue, CreateSnapshotInput,
} from '../../src/types/finance'
import { isInvestmentType } from '../../src/domain/assets'
import { completeSnapshotValues } from '../../src/domain/snapshots'
import {
  buildFundInitialization,
  FUND_INITIALIZATION_BUY_NOTE,
  FUND_INITIALIZATION_NAV_NOTE,
} from '../../src/domain/funds'

// —— Validation helpers ——

const VALID_ASSET_TYPES = ['fund', 'stock', 'gold', 'deposit', 'cash', 'housing_fund', 'other']

function validateAssetType(type: string): boolean {
  return VALID_ASSET_TYPES.includes(type)
}

export const dataRoutes = Router()

// —— v1: Deposits ——

dataRoutes.get('/deposits', (_req: Request, res: Response) => {
  try { res.json(readDeposits()) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.post('/deposits', (req: Request, res: Response) => {
  try {
    const { name, institution, accountType, balance, note } = req.body
    if (!name || !institution || !accountType || balance === undefined) {
      res.status(400).json({ error: 'name, institution, accountType, balance are required' })
      return
    }
    const deposits = readDeposits()
    const newAccount: DepositAccount = {
      id: uuidv4(), name, institution,
      accountType: accountType || 'other',
      balance: Number(balance), currency: 'CNY', note,
      updatedAt: new Date().toISOString(),
    }
    deposits.push(newAccount)
    writeDeposits(deposits)
    res.status(201).json(newAccount)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.patch('/deposits/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const deposits = readDeposits()
    const idx = deposits.findIndex((d) => d.id === id)
    if (idx === -1) { res.status(404).json({ error: 'Deposit not found' }); return }
    deposits[idx] = { ...deposits[idx], ...req.body, id, updatedAt: new Date().toISOString() }
    writeDeposits(deposits)
    res.json(deposits[idx])
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.delete('/deposits/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const deposits = readDeposits()
    const filtered = deposits.filter((d) => d.id !== id)
    if (filtered.length === deposits.length) { res.status(404).json({ error: 'Deposit not found' }); return }
    writeDeposits(filtered)
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// —— v1: Funds ——

dataRoutes.get('/funds', (_req: Request, res: Response) => {
  try { res.json(readFunds()) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.post('/funds', (req: Request, res: Response) => {
  try {
    const { code, name, platform, note } = req.body
    if (!name) { res.status(400).json({ error: 'name is required' }); return }
    const funds = readFunds()
    const now = new Date().toISOString()
    const newFund: Fund = { id: uuidv4(), code, name, platform, currency: 'CNY', note, createdAt: now, updatedAt: now }
    funds.push(newFund)
    writeFunds(funds)
    res.status(201).json(newFund)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.patch('/funds/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const funds = readFunds()
    const idx = funds.findIndex((f) => f.id === id)
    if (idx === -1) { res.status(404).json({ error: 'Fund not found' }); return }
    funds[idx] = { ...funds[idx], ...req.body, id, updatedAt: new Date().toISOString() }
    writeFunds(funds)
    res.json(funds[idx])
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.delete('/funds/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const funds = readFunds()
    const filtered = funds.filter((f) => f.id !== id)
    if (filtered.length === funds.length) { res.status(404).json({ error: 'Fund not found' }); return }
    writeFunds(filtered)
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.post('/funds/:id/initialize-position', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { marketValue, holdingPnl, shares, nav, date } = req.body
    const funds = readFunds()
    if (!funds.some((f) => f.id === id)) { res.status(404).json({ error: 'Fund not found' }); return }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.status(400).json({ error: 'date must be YYYY-MM-DD' }); return }

    const input = {
      fundId: id, marketValue: Number(marketValue), holdingPnl: Number(holdingPnl),
      shares: Number(shares), nav: Number(nav), date,
    }
    if (![input.marketValue, input.holdingPnl, input.shares, input.nav].every(Number.isFinite)) {
      res.status(400).json({ error: 'marketValue, holdingPnl, shares, nav must be valid numbers' })
      return
    }
    if (input.shares <= 0 || input.nav <= 0) {
      res.status(400).json({ error: 'shares and nav must be greater than 0' })
      return
    }

    const initialization = buildFundInitialization(input)
    const buy: Transaction = { ...initialization.buy, id: uuidv4() }
    const navTransaction: Transaction = { ...initialization.navTransaction, id: uuidv4() }
    const initNotes = new Set([FUND_INITIALIZATION_BUY_NOTE, FUND_INITIALIZATION_NAV_NOTE])

    const existingTransactions = readTransactions()
    const previousInitNavDates = new Set(
      existingTransactions
        .filter((tx) => tx.type === 'fund_nav' && tx.fundId === id && tx.note === FUND_INITIALIZATION_NAV_NOTE)
        .map((tx) => tx.occurredAt.split('T')[0])
    )
    const transactions = existingTransactions
      .filter((tx) => tx.type === 'deposit_adjustment' || tx.fundId !== id || !initNotes.has(tx.note || ''))
    transactions.push(buy, navTransaction)
    writeTransactions(transactions)

    const navPrices = readNavPrices()
      .filter((price) => price.fundId !== id || !previousInitNavDates.has(price.date))
    const existingNavIndex = navPrices.findIndex((price) => price.fundId === id && price.date === date)
    const navPrice: FundNavPrice = { ...initialization.navPrice, id: existingNavIndex >= 0 ? navPrices[existingNavIndex].id : uuidv4() }
    if (existingNavIndex >= 0) { navPrices[existingNavIndex] = navPrice } else { navPrices.push(navPrice) }
    writeNavPrices(navPrices)

    res.status(201).json({ buy, navTransaction, navPrice })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// —— v1: Transactions ——

dataRoutes.get('/transactions', (_req: Request, res: Response) => {
  try {
    const data = readTransactions()
    data.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    res.json(data)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.post('/transactions', (req: Request, res: Response) => {
  try {
    const { type, ...fields } = req.body
    if (!type) { res.status(400).json({ error: 'type is required' }); return }
    const newTx: Transaction = {
      id: uuidv4(), type, ...fields,
      occurredAt: fields.occurredAt || new Date().toISOString(),
    } as Transaction

    if (newTx.type === 'deposit_adjustment') {
      const deposits = readDeposits()
      const idx = deposits.findIndex((d) => d.id === newTx.depositAccountId)
      if (idx === -1) { res.status(400).json({ error: 'Deposit account not found' }); return }
      deposits[idx].balance = newTx.amountAfter
      deposits[idx].updatedAt = new Date().toISOString()
      writeDeposits(deposits)
    }

    const transactions = readTransactions()
    transactions.push(newTx)
    writeTransactions(transactions)

    if (newTx.type === 'fund_nav') {
      const navPrices = readNavPrices()
      navPrices.push({ id: uuidv4(), fundId: newTx.fundId, nav: newTx.nav, date: newTx.occurredAt.split('T')[0] })
      writeNavPrices(navPrices)
    }

    res.status(201).json(newTx)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// —— v1: NAV Prices ——

dataRoutes.get('/funds/:id/nav-prices', (req: Request, res: Response) => {
  try {
    const navs = readNavPrices()
      .filter((n) => n.fundId === req.params.id)
      .sort((a, b) => a.date.localeCompare(b.date))
    res.json(navs)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.post('/funds/:id/nav-prices', (req: Request, res: Response) => {
  try {
    const { nav, date } = req.body
    if (nav === undefined || !date) { res.status(400).json({ error: 'nav and date are required' }); return }
    const navPrices = readNavPrices()
    const newNav: FundNavPrice = { id: uuidv4(), fundId: req.params.id, nav: Number(nav), date }
    navPrices.push(newNav)
    writeNavPrices(navPrices)
    res.status(201).json(newNav)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ——— v2: Assets ———

dataRoutes.get('/assets', (_req: Request, res: Response) => {
  try { res.json(readAssets()) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.post('/assets', (req: Request, res: Response) => {
  try {
    const { name, type, institution, note } = req.body
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required and must be non-empty' })
      return
    }
    if (!type || !validateAssetType(type)) {
      res.status(400).json({ error: `type must be one of: ${VALID_ASSET_TYPES.join(', ')}` })
      return
    }
    const assets = readAssets()
    const now = new Date().toISOString()
    const newAsset: Asset = {
      id: uuidv4(), name: name.trim(), type,
      institution, currency: 'CNY', isActive: true, note,
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
    assets[idx] = { ...assets[idx], ...req.body, id, updatedAt: new Date().toISOString() }
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

// ——— v2: Snapshots ———

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

    // Validate each value
    for (const v of input.values) {
      if (v.amount === undefined || !Number.isFinite(Number(v.amount))) {
        res.status(400).json({ error: 'each value must have a valid amount (finite number)' })
        return
      }
      if (v.assetId) {
        const assets = readAssets()
        const asset = assets.find((a) => a.id === v.assetId)
        if (!asset) {
          res.status(400).json({ error: `asset ${v.assetId} not found` })
          return
        }
        if (!asset.isActive) {
          res.status(400).json({ error: `asset ${v.assetId} is not active` })
          return
        }
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
        assets.push({
          id: newId, name: v.asset.name.trim(), type: v.asset.type,
          institution: v.asset.institution, currency: 'CNY',
          isActive: true, note: v.asset.note,
          createdAt: now, updatedAt: now,
        })
        newAssetIds[`inline_${i}`] = newId
      }
    }

    if (Object.keys(newAssetIds).length > 0) {
      writeAssets(assets)
    }

    // Get previous snapshot values for partial update completion
    const snapshots = readSnapshots()
    let previousValues: SnapshotValue[] = []
    if (snapshots.length > 0) {
      snapshots.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
      previousValues = readSnapshotValues().filter((v) => v.snapshotId === snapshots[0].id)
    }

    // Complete the snapshot values
    const now = new Date().toISOString()
    const snapshotId = uuidv4()
    const completedValues = completeSnapshotValues(previousValues, input.values, newAssetIds)

    const allValues: SnapshotValue[] = completedValues.map((v) => ({
      ...v, id: uuidv4(), snapshotId,
    }))

    // Save snapshot
    const snapshot: Snapshot = { id: snapshotId, recordedAt: input.recordedAt, note: input.note, createdAt: now }
    snapshots.push(snapshot)
    writeSnapshots(snapshots)

    // Save all values for this snapshot
    const allSnapshotValues = readSnapshotValues()
    allSnapshotValues.push(...allValues)
    writeSnapshotValues(allSnapshotValues)

    // Ensure meta schemaVersion is at least 2
    const meta = readMeta()
    if (meta.schemaVersion < 2) {
      meta.schemaVersion = 2
      writeMeta(meta)
    }

    res.status(201).json({ snapshot, values: allValues })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ——— v2: Snapshot values (bulk read) ———

dataRoutes.get('/snapshot-values', (_req: Request, res: Response) => {
  try { res.json(readSnapshotValues()) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

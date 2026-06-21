// server/routes/importExportRoutes.ts
import { Router, Request, Response } from 'express'
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
import type { ExportDataV1, ExportDataV2 } from '../../src/types/finance'

export const importExportRoutes = Router()

importExportRoutes.get('/export', (_req: Request, res: Response) => {
  try {
    const meta = readMeta()
    // Export v2 if snapshot data exists, otherwise v1
    const snapshots = readSnapshots()
    if (meta.schemaVersion >= 2 || snapshots.length > 0) {
      res.json({
        meta: { schemaVersion: 2, updatedAt: meta.updatedAt },
        assets: readAssets(),
        snapshots: readSnapshots(),
        snapshotValues: readSnapshotValues(),
      } as ExportDataV2)
    } else {
      res.json({
        meta: { schemaVersion: 1, updatedAt: meta.updatedAt },
        deposits: readDeposits(),
        funds: readFunds(),
        transactions: readTransactions(),
        navPrices: readNavPrices(),
      } as ExportDataV1)
    }
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

importExportRoutes.post('/import', (req: Request, res: Response) => {
  try {
    const data = req.body

    if (!data.meta || typeof data.meta.schemaVersion !== 'number') {
      res.status(400).json({ error: 'Invalid backup: missing or invalid meta.schemaVersion' })
      return
    }

    if (data.meta.schemaVersion === 1) {
      // v1 import
      const v1 = data as ExportDataV1
      if (!Array.isArray(v1.deposits) || !Array.isArray(v1.funds) ||
          !Array.isArray(v1.transactions) || !Array.isArray(v1.navPrices)) {
        res.status(400).json({ error: 'Invalid v1 backup: missing required array fields' })
        return
      }
      writeDeposits(v1.deposits)
      writeFunds(v1.funds)
      writeTransactions(v1.transactions)
      writeNavPrices(v1.navPrices)
      writeMeta({ ...v1.meta, schemaVersion: 1, updatedAt: new Date().toISOString() })
      res.json({ success: true, message: 'Data imported (schema v1)' })
    } else if (data.meta.schemaVersion === 2) {
      // v2 import
      const v2 = data as ExportDataV2
      if (!Array.isArray(v2.assets) || !Array.isArray(v2.snapshots) || !Array.isArray(v2.snapshotValues)) {
        res.status(400).json({ error: 'Invalid v2 backup: missing required array fields' })
        return
      }
      writeAssets(v2.assets)
      writeSnapshots(v2.snapshots)
      writeSnapshotValues(v2.snapshotValues)
      writeMeta({ ...v2.meta, schemaVersion: 2, updatedAt: new Date().toISOString() })
      res.json({ success: true, message: 'Data imported (schema v2)' })
    } else {
      res.status(400).json({ error: `Unsupported schema version: ${data.meta.schemaVersion}. Supported: 1, 2` })
    }
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

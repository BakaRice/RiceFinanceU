// server/routes/importExportRoutes.ts
import { Router, Request, Response } from 'express'
import {
  readDeposits, writeDeposits,
  readFunds, writeFunds,
  readTransactions, writeTransactions,
  readNavPrices, writeNavPrices,
  readMeta, writeMeta,
} from '../storage'
import type { ExportData } from '../../src/types/finance'

export const importExportRoutes = Router()

importExportRoutes.get('/export', (_req: Request, res: Response) => {
  try {
    res.json({
      meta: readMeta(),
      deposits: readDeposits(),
      funds: readFunds(),
      transactions: readTransactions(),
      navPrices: readNavPrices(),
    } as ExportData)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

importExportRoutes.post('/import', (req: Request, res: Response) => {
  try {
    const data = req.body as ExportData

    if (!data.meta || typeof data.meta.schemaVersion !== 'number') {
      res.status(400).json({ error: 'Invalid backup: missing or invalid meta.schemaVersion' })
      return
    }
    if (data.meta.schemaVersion !== 1) {
      res.status(400).json({ error: `Unsupported schema version: ${data.meta.schemaVersion}. Expected: 1` })
      return
    }
    if (!Array.isArray(data.deposits) || !Array.isArray(data.funds) ||
        !Array.isArray(data.transactions) || !Array.isArray(data.navPrices)) {
      res.status(400).json({ error: 'Invalid backup: missing required array fields' })
      return
    }

    // All validations passed — write all files
    writeDeposits(data.deposits)
    writeFunds(data.funds)
    writeTransactions(data.transactions)
    writeNavPrices(data.navPrices)
    writeMeta({ ...data.meta, updatedAt: new Date().toISOString() })

    res.json({ success: true, message: 'Data imported successfully' })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

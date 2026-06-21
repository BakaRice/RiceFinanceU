// server/routes/importExportRoutes.ts
import { Router, Request, Response } from 'express'
import {
  readAssets, writeAssets,
  readSnapshots, writeSnapshots,
  readSnapshotValues, writeSnapshotValues,
  readMeta, writeMeta,
} from '../storage'
import type { ExportData } from '../../src/types/finance'

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

importExportRoutes.post('/import', (req: Request, res: Response) => {
  try {
    const data = req.body as ExportData

    if (!data.meta || typeof data.meta.schemaVersion !== 'number') {
      res.status(400).json({ error: 'Invalid backup: missing or invalid meta.schemaVersion' })
      return
    }
    if (data.meta.schemaVersion !== 2) {
      res.status(400).json({ error: `Unsupported schema version: ${data.meta.schemaVersion}. Expected: 2` })
      return
    }
    if (!Array.isArray(data.assets) || !Array.isArray(data.snapshots) || !Array.isArray(data.snapshotValues)) {
      res.status(400).json({ error: 'Invalid backup: missing required array fields' })
      return
    }

    writeAssets(data.assets)
    writeSnapshots(data.snapshots)
    writeSnapshotValues(data.snapshotValues)
    writeMeta({ schemaVersion: 2, updatedAt: new Date().toISOString() })

    res.json({ success: true, message: 'Data imported successfully' })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  ensureDataDir, readCollection, writeCollection,
  readMeta, writeMeta,
  readAssets, writeAssets,
  readSnapshots, writeSnapshots,
  readSnapshotValues, writeSnapshotValues,
} from './storage'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, '..', 'data')

const DATA_FILES = ['assets.json', 'snapshots.json', 'snapshot-values.json']

function cleanupDataFiles(): void {
  for (const f of DATA_FILES) {
    const p = path.join(DATA_DIR, f)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
  const metaPath = path.join(DATA_DIR, 'meta.json')
  if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath)
}

describe('Storage module', () => {
  beforeEach(() => {
    cleanupDataFiles()
    ensureDataDir()
  })

  describe('ensureDataDir', () => {
    it('creates all data files with correct initial content', () => {
      for (const f of DATA_FILES) {
        const p = path.join(DATA_DIR, f)
        expect(fs.existsSync(p)).toBe(true)
        expect(JSON.parse(fs.readFileSync(p, 'utf-8'))).toEqual([])
      }
      const metaPath = path.join(DATA_DIR, 'meta.json')
      expect(fs.existsSync(metaPath)).toBe(true)
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      expect(meta).toHaveProperty('schemaVersion', 2)
      expect(typeof meta.updatedAt).toBe('string')
    })

    it('does not overwrite existing files', () => {
      const p = path.join(DATA_DIR, 'assets.json')
      fs.writeFileSync(p, JSON.stringify([{ id: 'keep' }]), 'utf-8')
      ensureDataDir()
      expect(JSON.parse(fs.readFileSync(p, 'utf-8'))).toEqual([{ id: 'keep' }])
    })
  })

  describe('readCollection / writeCollection', () => {
    it('reads and writes round-trip', () => {
      const assets = [{
        id: '1', name: 'Test', type: 'fund' as const,
        currency: 'CNY' as const, isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      }]
      writeCollection('assets', assets)
      expect(readCollection('assets')).toEqual(assets)
    })

    it('returns empty array for missing collection file', () => {
      cleanupDataFiles()
      ensureDataDir()
      expect(readCollection('snapshots')).toEqual([])
    })

    it('rejects writing non-array data', () => {
      expect(() => writeCollection('assets', { not: 'array' } as any)).toThrow(/non-array/)
    })
  })

  describe('corrupt JSON handling', () => {
    it('throws when reading a corrupt JSON file', () => {
      fs.writeFileSync(path.join(DATA_DIR, 'assets.json'), '{invalid json}', 'utf-8')
      expect(() => readCollection('assets')).toThrow(/Failed to parse assets.json/)
    })

    it('throws when file contains an object instead of an array', () => {
      fs.writeFileSync(path.join(DATA_DIR, 'assets.json'), JSON.stringify({ not: 'array' }), 'utf-8')
      expect(() => readCollection('assets')).toThrow(/assets.json is not an array/)
    })
  })

  describe('atomic write via temp file', () => {
    it('writes atomically and removes the .tmp file', () => {
      const snapshots = [{ id: 's1', recordedAt: '2026-06-21', createdAt: '2026-06-21T00:00:00.000Z' }]
      writeCollection('snapshots', snapshots)
      expect(fs.existsSync(path.join(DATA_DIR, 'snapshots.json.tmp'))).toBe(false)
      expect(readCollection('snapshots')).toEqual(snapshots)
    })

    it('writes meta atomically', () => {
      writeMeta({ schemaVersion: 2, updatedAt: '2026-06-21T12:00:00.000Z' })
      expect(fs.existsSync(path.join(DATA_DIR, 'meta.json.tmp'))).toBe(false)
      expect(readMeta().updatedAt).toBe('2026-06-21T12:00:00.000Z')
    })
  })

  describe('meta timestamp update', () => {
    it('updates meta.updatedAt when writing', () => {
      const metaBefore = readMeta()
      writeAssets([{
        id: '1', name: 'Test', type: 'fund' as const,
        currency: 'CNY' as const, isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      }])
      expect(new Date(readMeta().updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(metaBefore.updatedAt).getTime()
      )
    })
  })

  describe('typed wrappers', () => {
    it('readAssets / writeAssets round-trip', () => {
      const assets = [{
        id: 'a1', name: '测试基金', type: 'fund' as const,
        currency: 'CNY' as const, isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      }]
      writeAssets(assets)
      expect(readAssets()).toEqual(assets)
    })

    it('readSnapshots / writeSnapshots round-trip', () => {
      const snapshots = [{ id: 's1', recordedAt: '2026-06-21', note: '测试', createdAt: '2026-06-21T00:00:00.000Z' }]
      writeSnapshots(snapshots)
      expect(readSnapshots()).toEqual(snapshots)
    })

    it('readSnapshotValues / writeSnapshotValues round-trip', () => {
      const values = [{ id: 'v1', snapshotId: 's1', assetId: 'a1', amount: 10000, profit: 500, profitRate: 0.05 }]
      writeSnapshotValues(values)
      expect(readSnapshotValues()).toEqual(values)
    })
  })
})

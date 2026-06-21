import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  ensureDataDir,
  readCollection,
  writeCollection,
  readMeta,
  writeMeta,
  readDeposits,
  writeDeposits,
  readFunds,
  writeFunds,
  readAssets,
  writeAssets,
  readSnapshots,
  writeSnapshots,
  readSnapshotValues,
  writeSnapshotValues,
} from './storage'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, '..', 'data')

const V1_FILES = ['deposits.json', 'funds.json', 'transactions.json', 'nav-prices.json']
const V2_FILES = ['assets.json', 'snapshots.json', 'snapshot-values.json']
const ALL_DATA_FILES = [...V1_FILES, ...V2_FILES]

function cleanupDataFiles(): void {
  for (const f of ALL_DATA_FILES) {
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
      for (const f of ALL_DATA_FILES) {
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
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'))
      expect(data).toEqual([{ id: 'keep' }])
    })
  })

  describe('readCollection / writeCollection', () => {
    it('reads and writes deposits round-trip', () => {
      const deposits = [{
        id: '1', name: 'Test Savings', institution: 'Bank',
        accountType: 'cash' as const, balance: 1000, currency: 'CNY' as const,
        updatedAt: '2026-01-01T00:00:00.000Z',
      }]
      writeCollection('deposits', deposits)
      expect(readCollection('deposits')).toEqual(deposits)
    })

    it('returns empty array for missing collection file after ensureDataDir', () => {
      cleanupDataFiles()
      ensureDataDir()
      expect(readCollection('assets')).toEqual([])
    })

    it('rejects writing non-array data', () => {
      expect(() => writeCollection('deposits', { not: 'array' } as any)).toThrow(/non-array/)
    })
  })

  describe('corrupt JSON handling', () => {
    it('throws when reading a corrupt JSON file', () => {
      fs.writeFileSync(path.join(DATA_DIR, 'deposits.json'), '{invalid json}', 'utf-8')
      expect(() => readCollection('deposits')).toThrow(/Failed to parse deposits.json/)
    })

    it('throws when file contains an object instead of an array', () => {
      fs.writeFileSync(path.join(DATA_DIR, 'deposits.json'), JSON.stringify({ not: 'array' }), 'utf-8')
      expect(() => readCollection('deposits')).toThrow(/deposits.json is not an array/)
    })
  })

  describe('atomic write via temp file', () => {
    it('writes atomically and removes the .tmp file', () => {
      const deposits = [{
        id: '1', name: 'Atomic', institution: 'Bank',
        accountType: 'cash' as const, balance: 500, currency: 'CNY' as const,
        updatedAt: '2026-06-21T00:00:00.000Z',
      }]
      writeCollection('deposits', deposits)
      expect(fs.existsSync(path.join(DATA_DIR, 'deposits.json.tmp'))).toBe(false)
      expect(readCollection('deposits')).toEqual(deposits)
    })

    it('writes meta atomically and removes the .tmp file', () => {
      writeMeta({ schemaVersion: 2, updatedAt: '2026-06-21T12:00:00.000Z' })
      expect(fs.existsSync(path.join(DATA_DIR, 'meta.json.tmp'))).toBe(false)
      expect(readMeta().updatedAt).toBe('2026-06-21T12:00:00.000Z')
    })
  })

  describe('meta timestamp update', () => {
    it('updates meta.updatedAt when writing deposits', () => {
      const metaBefore = readMeta()
      writeDeposits([{
        id: '1', name: 'Time Test', institution: 'Bank',
        accountType: 'cash' as const, balance: 2000, currency: 'CNY' as const,
        updatedAt: '2026-01-01T00:00:00.000Z',
      }])
      const metaAfter = readMeta()
      expect(new Date(metaAfter.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(metaBefore.updatedAt).getTime()
      )
    })
  })

  describe('typed wrappers', () => {
    it('readFunds / writeFunds round-trip', () => {
      const funds = [{
        id: 'f1', name: 'Test Fund', currency: 'CNY' as const,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      }]
      writeFunds(funds)
      expect(readFunds()).toEqual(funds)
    })
  })

  describe('v2 collections', () => {
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
      const snapshots = [{
        id: 's1', recordedAt: '2026-06-21', note: '测试',
        createdAt: '2026-06-21T00:00:00.000Z',
      }]
      writeSnapshots(snapshots)
      expect(readSnapshots()).toEqual(snapshots)
    })

    it('readSnapshotValues / writeSnapshotValues round-trip', () => {
      const values = [{
        id: 'v1', snapshotId: 's1', assetId: 'a1',
        amount: 10000, profit: 500, profitRate: 0.05,
      }]
      writeSnapshotValues(values)
      expect(readSnapshotValues()).toEqual(values)
    })
  })
})

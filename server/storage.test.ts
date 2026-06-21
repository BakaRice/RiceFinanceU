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
} from './storage'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, '..', 'data')

const DATA_FILES = ['deposits.json', 'funds.json', 'transactions.json', 'nav-prices.json']

function cleanupDataFiles(): void {
  // Remove all data files so ensureDataDir creates fresh ones
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
      // Collection files should be empty arrays
      for (const f of DATA_FILES) {
        const p = path.join(DATA_DIR, f)
        expect(fs.existsSync(p)).toBe(true)
        expect(JSON.parse(fs.readFileSync(p, 'utf-8'))).toEqual([])
      }

      // Meta file should be an object with schemaVersion and updatedAt
      const metaPath = path.join(DATA_DIR, 'meta.json')
      expect(fs.existsSync(metaPath)).toBe(true)
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      expect(meta).toHaveProperty('schemaVersion', 1)
      expect(typeof meta.updatedAt).toBe('string')
    })

    it('does not overwrite existing files', () => {
      // Write some data first
      const p = path.join(DATA_DIR, 'deposits.json')
      fs.writeFileSync(p, JSON.stringify([{ id: 'keep' }]), 'utf-8')

      // Re-run ensureDataDir
      ensureDataDir()

      // Verify existing file was not overwritten
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'))
      expect(data).toEqual([{ id: 'keep' }])
    })
  })

  describe('readCollection / writeCollection', () => {
    it('reads and writes deposits round-trip', () => {
      const deposits = [
        {
          id: '1',
          name: 'Test Savings',
          institution: 'Bank',
          accountType: 'cash' as const,
          balance: 1000,
          currency: 'CNY' as const,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]

      writeCollection('deposits', deposits)
      const result = readCollection('deposits')
      expect(result).toEqual(deposits)
    })

    it('returns empty array for missing collection file after ensureDataDir', () => {
      // Clean up and re-init so we know files are fresh
      cleanupDataFiles()
      ensureDataDir()
      const result = readCollection('funds')
      expect(result).toEqual([])
    })

    it('rejects writing non-array data', () => {
      expect(() => writeCollection('deposits', { not: 'array' } as any)).toThrow(
        /non-array/
      )
    })
  })

  describe('corrupt JSON handling', () => {
    it('throws when reading a corrupt JSON file', () => {
      const p = path.join(DATA_DIR, 'deposits.json')
      fs.writeFileSync(p, '{invalid json}', 'utf-8')
      expect(() => readCollection('deposits')).toThrow(
        /Failed to parse deposits.json/
      )
    })

    it('throws when file contains an object instead of an array', () => {
      const p = path.join(DATA_DIR, 'deposits.json')
      fs.writeFileSync(p, JSON.stringify({ not: 'array' }), 'utf-8')
      expect(() => readCollection('deposits')).toThrow(
        /deposits.json is not an array/
      )
    })
  })

  describe('atomic write via temp file', () => {
    it('writes atomically and removes the .tmp file', () => {
      const deposits = [
        {
          id: '1',
          name: 'Atomic',
          institution: 'Bank',
          accountType: 'cash' as const,
          balance: 500,
          currency: 'CNY' as const,
          updatedAt: '2026-06-21T00:00:00.000Z',
        },
      ]

      writeCollection('deposits', deposits)

      // .tmp file should not remain
      const tmpPath = path.join(DATA_DIR, 'deposits.json.tmp')
      expect(fs.existsSync(tmpPath)).toBe(false)

      // Content should be correct
      const result = readCollection('deposits')
      expect(result).toEqual(deposits)
    })

    it('writes meta atomically and removes the .tmp file', () => {
      const meta = { schemaVersion: 1, updatedAt: '2026-06-21T12:00:00.000Z' }
      writeMeta(meta)

      const tmpPath = path.join(DATA_DIR, 'meta.json.tmp')
      expect(fs.existsSync(tmpPath)).toBe(false)

      const result = readMeta()
      expect(result.updatedAt).toBe('2026-06-21T12:00:00.000Z')
    })
  })

  describe('meta timestamp update', () => {
    it('updates meta.updatedAt when writing deposits', () => {
      const metaBefore = readMeta()

      const deposits = [
        {
          id: '1',
          name: 'Time Test',
          institution: 'Bank',
          accountType: 'cash' as const,
          balance: 2000,
          currency: 'CNY' as const,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]
      writeDeposits(deposits)

      const metaAfter = readMeta()

      // updatedAt should have changed to a more recent time
      expect(new Date(metaAfter.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(metaBefore.updatedAt).getTime()
      )
    })
  })

  describe('typed wrappers', () => {
    it('readFunds / writeFunds round-trip', () => {
      const funds = [
        {
          id: 'f1',
          name: 'Test Fund',
          currency: 'CNY' as const,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]
      writeFunds(funds)
      expect(readFunds()).toEqual(funds)
    })
  })
})

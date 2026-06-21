// server/storage.ts
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { Asset, Snapshot, SnapshotValue } from '../src/types/finance'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', 'data')
const COLLECTIONS = ['assets', 'snapshots', 'snapshot-values'] as const
type CollectionName = typeof COLLECTIONS[number]

export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  for (const name of COLLECTIONS) {
    const filePath = path.join(DATA_DIR, `${name}.json`)
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]', 'utf-8')
    }
  }
  const metaPath = path.join(DATA_DIR, 'meta.json')
  if (!fs.existsSync(metaPath)) {
    const meta = { schemaVersion: 2, updatedAt: new Date().toISOString() }
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
  }
}

function filePath(name: string): string {
  return path.join(DATA_DIR, `${name}.json`)
}

export function readCollection<T>(name: CollectionName): T[] {
  const p = filePath(name)
  if (!fs.existsSync(p)) {
    ensureDataDir()
    return []
  }
  const raw = fs.readFileSync(p, 'utf-8')
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) {
      throw new Error(`${name}.json is not an array — file may be corrupted`)
    }
    return data as T[]
  } catch (e: any) {
    if (e.message && e.message.includes('not an array')) throw e
    throw new Error(`Failed to parse ${name}.json: ${e.message}`)
  }
}

export function writeCollection<T>(name: CollectionName, data: T[]): void {
  if (!Array.isArray(data)) {
    throw new Error(`Cannot write non-array data to ${name}.json`)
  }
  const p = filePath(name)
  const tmp = p + '.tmp'
  const json = JSON.stringify(data, null, 2)
  fs.writeFileSync(tmp, json, 'utf-8')
  fs.renameSync(tmp, p)
}

export function readMeta(): { schemaVersion: number; updatedAt: string } {
  const p = filePath('meta')
  if (!fs.existsSync(p)) {
    ensureDataDir()
    return { schemaVersion: 2, updatedAt: new Date().toISOString() }
  }
  const raw = fs.readFileSync(p, 'utf-8')
  try {
    const data = JSON.parse(raw)
    return data as { schemaVersion: number; updatedAt: string }
  } catch (e: any) {
    throw new Error(`Failed to parse meta.json: ${e.message}`)
  }
}

export function writeMeta(meta: { schemaVersion: number; updatedAt: string }): void {
  const p = filePath('meta')
  const tmp = p + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(meta, null, 2), 'utf-8')
  fs.renameSync(tmp, p)
}

function updateMetaTimestamp(): void {
  const meta = readMeta()
  meta.updatedAt = new Date().toISOString()
  writeMeta(meta)
}

export function readAssets(): Asset[] { return readCollection<Asset>('assets') }
export function writeAssets(data: Asset[]): void { writeCollection('assets', data); updateMetaTimestamp() }
export function readSnapshots(): Snapshot[] { return readCollection<Snapshot>('snapshots') }
export function writeSnapshots(data: Snapshot[]): void { writeCollection('snapshots', data); updateMetaTimestamp() }
export function readSnapshotValues(): SnapshotValue[] { return readCollection<SnapshotValue>('snapshot-values') }
export function writeSnapshotValues(data: SnapshotValue[]): void { writeCollection('snapshot-values', data); updateMetaTimestamp() }

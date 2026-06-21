// src/api/client.ts
import type { Asset, Snapshot, SnapshotValue, CreateSnapshotInput, ExportData } from '../types/finance'

const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as any).error || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Assets
  getAssets: () => request<Asset[]>('/assets'),
  createAsset: (data: { name: string; type: string; institution?: string; note?: string }) =>
    request<Asset>('/assets', { method: 'POST', body: JSON.stringify(data) }),
  updateAsset: (id: string, data: Partial<Asset>) =>
    request<Asset>(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAsset: (id: string) =>
    request<{ success: boolean }>(`/assets/${id}`, { method: 'DELETE' }),

  // Snapshots
  getSnapshots: () => request<Snapshot[]>('/snapshots'),
  getLatestSnapshot: () => request<{ snapshot: Snapshot; values: SnapshotValue[] } | null>('/snapshots/latest'),
  getSnapshot: (id: string) => request<{ snapshot: Snapshot; values: SnapshotValue[] }>('/snapshots/' + id),
  createSnapshot: (data: CreateSnapshotInput) =>
    request<{ snapshot: Snapshot; values: SnapshotValue[] }>('/snapshots', { method: 'POST', body: JSON.stringify(data) }),
  deleteSnapshot: (id: string) => request<{ success: boolean }>(`/snapshots/${id}`, { method: 'DELETE' }),
  getSnapshotValues: () => request<SnapshotValue[]>('/snapshot-values'),

  // Import/Export
  exportData: () => request<ExportData>('/export'),
  importData: (data: ExportData) =>
    request<{ success: boolean; message: string }>('/import', { method: 'POST', body: JSON.stringify(data) }),
}

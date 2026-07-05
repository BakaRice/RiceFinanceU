// src/api/client.ts
import type { Asset, AssetDcaPlan, AssetProfile, Snapshot, SnapshotValue, CreateSnapshotInput, ExportData, ExchangeRates } from '../types/finance'
import { clearSessionToken, getSessionToken, setSessionToken } from './session'

const BASE = '/api'

export interface LoginResult {
  token: string
  expiresAt: string
  user: { email: string }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getSessionToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    if (res.status === 401) {
      clearSessionToken()
    }
    throw new Error((body as any).error || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Auth
  login: async (data: { email: string; password: string }) => {
    const result = await request<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    setSessionToken(result.token)
    return result
  },
  logout: async () => {
    try {
      await request<{ success: boolean }>('/auth/logout', { method: 'POST' })
    } finally {
      clearSessionToken()
    }
  },

  // Assets
  getAssets: () => request<Asset[]>('/assets'),
  createAsset: (data: { name: string; type: string; currency?: string; institution?: string; note?: string; profile?: AssetProfile; dcaPlan?: AssetDcaPlan }) =>
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

  // Rates
  getRates: () => request<ExchangeRates>('/rates'),
  updateRates: (data: Partial<ExchangeRates>) => request<ExchangeRates>('/rates', { method: 'POST', body: JSON.stringify(data) }),

  // Import/Export
  exportData: () => request<ExportData>('/export'),
  importData: (data: ExportData) =>
    request<{ success: boolean; message: string }>('/import', { method: 'POST', body: JSON.stringify(data) }),
}

// src/api/client.ts
import type { Asset, AssetDcaPlan, AssetProfile, Snapshot, SnapshotValue, CreateSnapshotInput, ExportData, ExchangeRates, IncomeCategory, IncomeRecord, MonthlyIncome } from '../types/finance'
import { clearSessionToken, getSessionToken, setSessionToken } from './session'

const BASE = '/api'

export interface LoginResult {
  token: string
  expiresAt: string
  user: { email: string }
}

export type MonthlyIncomeInput = {
  month: string
  salary?: number
  extraIncome?: number
  housingFund?: number
  otherIncome?: number
  note?: string
}

export type IncomeRecordInput = {
  occurredAt: string
  amount: number
  category: IncomeCategory
  sourceName?: string
  note?: string
}

export type IncomeRecordBatchInput = {
  creates: IncomeRecordInput[]
  updates: Array<IncomeRecordInput & { id: string }>
  deletes: string[]
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
  deleteAsset: (id: string, confirmName: string) =>
    request<{ success: boolean }>(`/assets/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmName }),
    }),

  // Snapshots
  getSnapshots: () => request<Snapshot[]>('/snapshots'),
  getLatestSnapshot: () => request<{ snapshot: Snapshot; values: SnapshotValue[] } | null>('/snapshots/latest'),
  getSnapshot: (id: string) => request<{ snapshot: Snapshot; values: SnapshotValue[] }>('/snapshots/' + id),
  createSnapshot: (data: CreateSnapshotInput) =>
    request<{ snapshot: Snapshot; values: SnapshotValue[] }>('/snapshots', { method: 'POST', body: JSON.stringify(data) }),
  deleteSnapshot: (id: string) => request<{ success: boolean }>(`/snapshots/${id}`, { method: 'DELETE' }),
  getSnapshotValues: () => request<SnapshotValue[]>('/snapshot-values'),

  // Income records
  getIncomeRecords: () => request<IncomeRecord[]>('/income-records'),
  createIncomeRecord: (data: IncomeRecordInput) =>
    request<IncomeRecord>('/income-records', { method: 'POST', body: JSON.stringify(data) }),
  updateIncomeRecord: (id: string, data: IncomeRecordInput) =>
    request<IncomeRecord>(`/income-records/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteIncomeRecord: (id: string) =>
    request<{ success: boolean }>(`/income-records/${id}`, { method: 'DELETE' }),
  saveIncomeRecords: (data: IncomeRecordBatchInput) =>
    request<{ records: IncomeRecord[] }>('/income-records/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Monthly incomes
  getMonthlyIncomes: () => request<MonthlyIncome[]>('/monthly-incomes'),
  createMonthlyIncome: (data: MonthlyIncomeInput) =>
    request<MonthlyIncome>('/monthly-incomes', { method: 'POST', body: JSON.stringify(data) }),
  updateMonthlyIncome: (id: string, data: MonthlyIncomeInput) =>
    request<MonthlyIncome>(`/monthly-incomes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMonthlyIncome: (id: string) =>
    request<{ success: boolean }>(`/monthly-incomes/${id}`, { method: 'DELETE' }),

  // Rates
  getRates: () => request<ExchangeRates>('/rates'),
  updateRates: (data: Partial<ExchangeRates>) => request<ExchangeRates>('/rates', { method: 'POST', body: JSON.stringify(data) }),

  // Import/Export
  exportData: () => request<ExportData>('/export'),
  importData: (data: ExportData) =>
    request<{ success: boolean; message: string }>('/import', { method: 'POST', body: JSON.stringify(data) }),
}

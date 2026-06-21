// src/api/client.ts
import type {
  DepositAccount, Fund, Transaction, FundNavPrice,
  Asset, Snapshot, SnapshotValue, CreateSnapshotInput,
  ExportDataV1, ExportDataV2,
} from '../types/finance'

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
  // —— v1: Deposits ——
  getDeposits: () => request<DepositAccount[]>('/deposits'),
  createDeposit: (data: Partial<DepositAccount>) =>
    request<DepositAccount>('/deposits', { method: 'POST', body: JSON.stringify(data) }),
  updateDeposit: (id: string, data: Partial<DepositAccount>) =>
    request<DepositAccount>(`/deposits/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDeposit: (id: string) =>
    request<{ success: boolean }>(`/deposits/${id}`, { method: 'DELETE' }),

  // —— v1: Funds ——
  getFunds: () => request<Fund[]>('/funds'),
  createFund: (data: Partial<Fund>) =>
    request<Fund>('/funds', { method: 'POST', body: JSON.stringify(data) }),
  updateFund: (id: string, data: Partial<Fund>) =>
    request<Fund>(`/funds/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteFund: (id: string) =>
    request<{ success: boolean }>(`/funds/${id}`, { method: 'DELETE' }),

  // —— v1: Transactions ——
  getTransactions: () => request<Transaction[]>('/transactions'),
  createTransaction: (data: Partial<Transaction>) =>
    request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(data) }),

  // —— v1: NAV Prices ——
  getNavPrices: (fundId: string) => request<FundNavPrice[]>(`/funds/${fundId}/nav-prices`),
  createNavPrice: (fundId: string, data: { nav: number; date: string }) =>
    request<FundNavPrice>(`/funds/${fundId}/nav-prices`, { method: 'POST', body: JSON.stringify(data) }),
  initializeFundPosition: (fundId: string, data: {
    marketValue: number; holdingPnl: number; shares: number; nav: number; date: string
  }) =>
    request<{ buy: Transaction; navTransaction: Transaction; navPrice: FundNavPrice }>(
      `/funds/${fundId}/initialize-position`, { method: 'POST', body: JSON.stringify(data) }
    ),

  // —— v2: Assets ——
  getAssets: () => request<Asset[]>('/assets'),
  createAsset: (data: { name: string; type: string; institution?: string; note?: string }) =>
    request<Asset>('/assets', { method: 'POST', body: JSON.stringify(data) }),
  updateAsset: (id: string, data: Partial<Asset>) =>
    request<Asset>(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAsset: (id: string) =>
    request<{ success: boolean }>(`/assets/${id}`, { method: 'DELETE' }),

  // —— v2: Snapshots ——
  getSnapshots: () => request<Snapshot[]>('/snapshots'),
  getLatestSnapshot: () => request<{ snapshot: Snapshot; values: SnapshotValue[] } | null>('/snapshots/latest'),
  getSnapshot: (id: string) => request<{ snapshot: Snapshot; values: SnapshotValue[] }>('/snapshots/' + id),
  createSnapshot: (data: CreateSnapshotInput) =>
    request<{ snapshot: Snapshot; values: SnapshotValue[] }>('/snapshots', { method: 'POST', body: JSON.stringify(data) }),
  getSnapshotValues: () => request<SnapshotValue[]>('/snapshot-values'),

  // —— Import/Export ——
  exportData: () => request<ExportDataV1 | ExportDataV2>('/export'),
  importData: (data: ExportDataV1 | ExportDataV2) =>
    request<{ success: boolean; message: string }>('/import', { method: 'POST', body: JSON.stringify(data) }),
}

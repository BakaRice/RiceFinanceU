// src/api/client.ts
import type { DepositAccount, Fund, Transaction, FundNavPrice, ExportData } from '../types/finance'

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
  getDeposits: () => request<DepositAccount[]>('/deposits'),
  createDeposit: (data: Partial<DepositAccount>) =>
    request<DepositAccount>('/deposits', { method: 'POST', body: JSON.stringify(data) }),
  updateDeposit: (id: string, data: Partial<DepositAccount>) =>
    request<DepositAccount>(`/deposits/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDeposit: (id: string) =>
    request<{ success: boolean }>(`/deposits/${id}`, { method: 'DELETE' }),

  getFunds: () => request<Fund[]>('/funds'),
  createFund: (data: Partial<Fund>) =>
    request<Fund>('/funds', { method: 'POST', body: JSON.stringify(data) }),
  updateFund: (id: string, data: Partial<Fund>) =>
    request<Fund>(`/funds/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteFund: (id: string) =>
    request<{ success: boolean }>(`/funds/${id}`, { method: 'DELETE' }),

  getTransactions: () => request<Transaction[]>('/transactions'),
  createTransaction: (data: Partial<Transaction>) =>
    request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(data) }),

  getNavPrices: (fundId: string) => request<FundNavPrice[]>(`/funds/${fundId}/nav-prices`),
  createNavPrice: (fundId: string, data: { nav: number; date: string }) =>
    request<FundNavPrice>(`/funds/${fundId}/nav-prices`, { method: 'POST', body: JSON.stringify(data) }),

  exportData: () => request<ExportData>('/export'),
  importData: (data: ExportData) =>
    request<{ success: boolean; message: string }>('/import', { method: 'POST', body: JSON.stringify(data) }),
}

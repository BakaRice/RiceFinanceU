// src/types/finance.ts

export type DepositAccount = {
  id: string
  name: string
  institution: string
  accountType: 'cash' | 'current' | 'fixed' | 'money_market' | 'other'
  balance: number
  currency: 'CNY'
  note?: string
  updatedAt: string
}

export type Fund = {
  id: string
  code?: string
  name: string
  platform?: string
  currency: 'CNY'
  note?: string
  createdAt: string
  updatedAt: string
}

export type DepositAdjustment = {
  id: string
  type: 'deposit_adjustment'
  depositAccountId: string
  amountBefore: number
  amountAfter: number
  occurredAt: string
  note?: string
}

export type FundBuy = {
  id: string
  type: 'fund_buy'
  fundId: string
  amount: number
  shares: number
  fee?: number
  occurredAt: string
  note?: string
}

export type FundSell = {
  id: string
  type: 'fund_sell'
  fundId: string
  amount: number
  shares: number
  fee?: number
  occurredAt: string
  note?: string
}

export type FundNav = {
  id: string
  type: 'fund_nav'
  fundId: string
  nav: number
  occurredAt: string
  note?: string
}

export type Transaction = DepositAdjustment | FundBuy | FundSell | FundNav

export type FundNavPrice = {
  id: string
  fundId: string
  nav: number
  date: string
}

export type Meta = {
  schemaVersion: number
  updatedAt: string
}

export type ExportData = {
  meta: Meta
  deposits: DepositAccount[]
  funds: Fund[]
  transactions: Transaction[]
  navPrices: FundNavPrice[]
}

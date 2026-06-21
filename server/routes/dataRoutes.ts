// server/routes/dataRoutes.ts
import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
  readDeposits, writeDeposits,
  readFunds, writeFunds,
  readTransactions, writeTransactions,
  readNavPrices, writeNavPrices,
} from '../storage'
import type { DepositAccount, Fund, Transaction, FundNavPrice } from '../../src/types/finance'

export const dataRoutes = Router()

// —— Deposits ——

dataRoutes.get('/deposits', (_req: Request, res: Response) => {
  try {
    res.json(readDeposits())
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

dataRoutes.post('/deposits', (req: Request, res: Response) => {
  try {
    const { name, institution, accountType, balance, note } = req.body
    if (!name || !institution || !accountType || balance === undefined) {
      res.status(400).json({ error: 'name, institution, accountType, balance are required' })
      return
    }
    const deposits = readDeposits()
    const newAccount: DepositAccount = {
      id: uuidv4(), name, institution,
      accountType: accountType || 'other',
      balance: Number(balance), currency: 'CNY', note,
      updatedAt: new Date().toISOString(),
    }
    deposits.push(newAccount)
    writeDeposits(deposits)
    res.status(201).json(newAccount)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.patch('/deposits/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const deposits = readDeposits()
    const idx = deposits.findIndex((d) => d.id === id)
    if (idx === -1) { res.status(404).json({ error: 'Deposit not found' }); return }
    deposits[idx] = { ...deposits[idx], ...req.body, id, updatedAt: new Date().toISOString() }
    writeDeposits(deposits)
    res.json(deposits[idx])
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.delete('/deposits/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const deposits = readDeposits()
    const filtered = deposits.filter((d) => d.id !== id)
    if (filtered.length === deposits.length) { res.status(404).json({ error: 'Deposit not found' }); return }
    writeDeposits(filtered)
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// —— Funds ——

dataRoutes.get('/funds', (_req: Request, res: Response) => {
  try { res.json(readFunds()) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.post('/funds', (req: Request, res: Response) => {
  try {
    const { code, name, platform, note } = req.body
    if (!name) { res.status(400).json({ error: 'name is required' }); return }
    const funds = readFunds()
    const now = new Date().toISOString()
    const newFund: Fund = { id: uuidv4(), code, name, platform, currency: 'CNY', note, createdAt: now, updatedAt: now }
    funds.push(newFund)
    writeFunds(funds)
    res.status(201).json(newFund)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.patch('/funds/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const funds = readFunds()
    const idx = funds.findIndex((f) => f.id === id)
    if (idx === -1) { res.status(404).json({ error: 'Fund not found' }); return }
    funds[idx] = { ...funds[idx], ...req.body, id, updatedAt: new Date().toISOString() }
    writeFunds(funds)
    res.json(funds[idx])
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.delete('/funds/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const funds = readFunds()
    const filtered = funds.filter((f) => f.id !== id)
    if (filtered.length === funds.length) { res.status(404).json({ error: 'Fund not found' }); return }
    writeFunds(filtered)
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// —— Transactions ——

dataRoutes.get('/transactions', (_req: Request, res: Response) => {
  try {
    const data = readTransactions()
    data.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    res.json(data)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.post('/transactions', (req: Request, res: Response) => {
  try {
    const { type, ...fields } = req.body
    if (!type) { res.status(400).json({ error: 'type is required' }); return }

    const newTx: Transaction = {
      id: uuidv4(), type, ...fields,
      occurredAt: fields.occurredAt || new Date().toISOString(),
    } as Transaction

    // deposit_adjustment: also update account balance
    if (newTx.type === 'deposit_adjustment') {
      const deposits = readDeposits()
      const idx = deposits.findIndex((d) => d.id === newTx.depositAccountId)
      if (idx === -1) { res.status(400).json({ error: 'Deposit account not found' }); return }
      deposits[idx].balance = newTx.amountAfter
      deposits[idx].updatedAt = new Date().toISOString()
      writeDeposits(deposits)
    }

    const transactions = readTransactions()
    transactions.push(newTx)
    writeTransactions(transactions)

    // fund_nav: also write nav price point (atomic with transaction)
    if (newTx.type === 'fund_nav') {
      const navPrices = readNavPrices()
      navPrices.push({
        id: uuidv4(), fundId: newTx.fundId, nav: newTx.nav,
        date: newTx.occurredAt.split('T')[0],
      })
      writeNavPrices(navPrices)
    }

    res.status(201).json(newTx)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// —— NAV Prices ——

dataRoutes.get('/funds/:id/nav-prices', (req: Request, res: Response) => {
  try {
    const navs = readNavPrices()
      .filter((n) => n.fundId === req.params.id)
      .sort((a, b) => a.date.localeCompare(b.date))
    res.json(navs)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

dataRoutes.post('/funds/:id/nav-prices', (req: Request, res: Response) => {
  try {
    const { nav, date } = req.body
    if (nav === undefined || !date) { res.status(400).json({ error: 'nav and date are required' }); return }
    const navPrices = readNavPrices()
    const newNav: FundNavPrice = { id: uuidv4(), fundId: req.params.id, nav: Number(nav), date }
    navPrices.push(newNav)
    writeNavPrices(navPrices)
    res.status(201).json(newNav)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

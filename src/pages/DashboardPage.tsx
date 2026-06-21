import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { calculateDepositTotal } from '../domain/deposits'
import { calculateFundPosition } from '../domain/funds'
import { calculateTotalAssets, calculateAssetAllocation } from '../domain/portfolio'
import AssetSummary from '../components/AssetSummary'
import TransactionList from '../components/TransactionList'
import type { DepositAccount, Fund, Transaction, FundNavPrice } from '../types/finance'
import './DashboardPage.css'

export default function DashboardPage() {
  const [deposits, setDeposits] = useState<DepositAccount[]>([])
  const [funds, setFunds] = useState<Fund[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [navPrices, setNavPrices] = useState<FundNavPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const [d, f, t] = await Promise.all([api.getDeposits(), api.getFunds(), api.getTransactions()])
      setDeposits(d); setFunds(f); setTransactions(t)
      const navs = await Promise.all(f.map((fd) => api.getNavPrices(fd.id)))
      setNavPrices(navs.flat())
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="page-loading">加载中...</div>
  if (error) return <div className="page-error"><p>加载失败: {error}</p><button onClick={load}>重试</button></div>

  const depositTotal = calculateDepositTotal(deposits)
  const positions = funds.map((f) => calculateFundPosition(f.id, transactions, navPrices))
  const fundMarketValue = positions.reduce((s, p) => s + p.marketValue, 0)
  const totalPnl = positions.reduce((s, p) => s + p.totalPnl, 0)
  const totalAssets = calculateTotalAssets(deposits, positions)
  const alloc = calculateAssetAllocation(deposits, positions)

  return (
    <div className="dashboard">
      <h1>总览</h1>
      <AssetSummary totalAssets={totalAssets} depositTotal={depositTotal} fundMarketValue={fundMarketValue} totalPnl={totalPnl} />
      <div className="dashboard-grid">
        <div className="allocation-section">
          <h3>资产构成</h3>
          {alloc.total > 0 ? (
            <div className="allocation-bar">
              <div className="alloc-deposits" style={{width:`${(alloc.deposits/alloc.total)*100}%`}}>{alloc.deposits>0?`存款 ${((alloc.deposits/alloc.total)*100).toFixed(0)}%`:''}</div>
              <div className="alloc-funds" style={{width:`${(alloc.funds/alloc.total)*100}%`}}>{alloc.funds>0?`基金 ${((alloc.funds/alloc.total)*100).toFixed(0)}%`:''}</div>
            </div>
          ) : <p className="alloc-empty">暂无资产数据</p>}
        </div>
        <TransactionList transactions={transactions} depositNames={new Map(deposits.map(d=>[d.id,d.name]))} fundNames={new Map(funds.map(f=>[f.id,f.name]))} />
      </div>
    </div>
  )
}

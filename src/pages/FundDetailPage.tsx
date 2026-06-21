import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { calculateFundPosition, buildFundChartSeries } from '../domain/funds'
import { formatMoney } from '../domain/money'
import FundChart from '../components/FundChart'
import type { Fund, Transaction, FundNavPrice } from '../types/finance'
import './FundDetailPage.css'

export default function FundDetailPage() {
  const { id } = useParams<{ id: string }>(); const navigate = useNavigate()
  const [fund, setFund] = useState<Fund|null>(null); const [transactions, setTransactions] = useState<Transaction[]>([])
  const [navPrices, setNavPrices] = useState<FundNavPrice[]>([]); const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null); const [showNavForm, setShowNavForm] = useState(false)
  const [nav, setNav] = useState(''); const [navDate, setNavDate] = useState(new Date().toISOString().split('T')[0])

  async function load(){ if(!id) return; setLoading(true); setError(null); try{const funds=await api.getFunds(); const f=funds.find(f=>f.id===id); if(!f){setError('基金不存在');setLoading(false);return}; setFund(f); const[txs,navs]=await Promise.all([api.getTransactions(),api.getNavPrices(id)]); setTransactions(txs); setNavPrices(navs) } catch(e:any){setError(e.message)} finally{setLoading(false)} }
  useEffect(()=>{load()},[id])

  async function handleAddNav(e:React.FormEvent){ e.preventDefault(); if(!id)return; try{await api.createTransaction({type:'fund_nav',fundId:id,nav:Number(nav),occurredAt:navDate}as any); setShowNavForm(false); setNav(''); load() } catch(e:any){alert('保存失败: '+e.message)} }

  if(loading) return <div className="page-loading">加载中...</div>
  if(error) return <div className="page-error"><p>{error}</p><button onClick={()=>navigate('/funds')}>返回基金列表</button></div>
  if(!fund) return null

  const pos = calculateFundPosition(fund.id, transactions, navPrices)
  const chartData = buildFundChartSeries(fund.id, transactions, navPrices)
  const fundTxs = transactions.filter(t=>t.type!=='deposit_adjustment'&&t.fundId===fund.id).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt))

  return (<div className="fund-detail">
    <button className="back-btn" onClick={()=>navigate('/funds')}>← 返回基金列表</button>
    <h1>{fund.name}</h1>
    <div className="fund-meta">{fund.code&&<span>代码: {fund.code}</span>}{fund.platform&&<span>平台: {fund.platform}</span>}{fund.note&&<span>备注: {fund.note}</span>}</div>
    <div className="fund-position-summary">
      <div className="pos-card"><div className="pos-label">当前份额</div><div className="pos-value">{pos.totalShares}</div></div>
      <div className="pos-card"><div className="pos-label">平均成本</div><div className="pos-value">{formatMoney(pos.avgCost)}</div></div>
      <div className="pos-card"><div className="pos-label">最新净值</div><div className="pos-value">{pos.latestNav||'-'}</div></div>
      <div className="pos-card"><div className="pos-label">持仓市值</div><div className="pos-value">{formatMoney(pos.marketValue)}</div></div>
      <div className="pos-card"><div className="pos-label">浮动盈亏</div><div className={`pos-value ${pos.unrealizedPnl>=0?'profit':'loss'}`}>{pos.unrealizedPnl>=0?'+':''}{formatMoney(pos.unrealizedPnl)}</div></div>
      <div className="pos-card"><div className="pos-label">已实现收益</div><div className={`pos-value ${pos.realizedPnl>=0?'profit':'loss'}`}>{pos.realizedPnl>=0?'+':''}{formatMoney(pos.realizedPnl)}</div></div>
      <div className="pos-card"><div className="pos-label">总收益</div><div className={`pos-value ${pos.totalPnl>=0?'profit':'loss'}`}>{pos.totalPnl>=0?'+':''}{formatMoney(pos.totalPnl)}</div></div>
    </div>
    <FundChart data={chartData}/>
    <div className="fund-section-header"><h3>交易记录</h3><button className="btn-primary" onClick={()=>setShowNavForm(true)}>+ 录入净值</button></div>
    {fundTxs.length===0?<p className="tx-empty">暂无交易记录</p>:(
      <table className="fund-tx-table"><thead><tr><th>时间</th><th>类型</th><th>份额</th><th>金额</th><th>净值</th><th>手续费</th></tr></thead><tbody>
        {fundTxs.map(tx=>(<tr key={tx.id}><td>{new Date(tx.occurredAt).toLocaleString('zh-CN')}</td><td>{tx.type==='fund_buy'?'买入':tx.type==='fund_sell'?'卖出':'净值录入'}</td><td>{('shares' in tx)?(tx as any).shares:'-'}</td><td>{('amount' in tx)?formatMoney((tx as any).amount):'-'}</td><td>{tx.type==='fund_nav'?(tx as any).nav:'-'}</td><td>{('fee' in tx)&&(tx as any).fee?formatMoney((tx as any).fee):'-'}</td></tr>))}
      </tbody></table>
    )}
    {showNavForm&&(<div className="modal-overlay" onClick={()=>setShowNavForm(false)}><div className="modal" onClick={e=>e.stopPropagation()}><h2>录入净值</h2><form onSubmit={handleAddNav}>
      <label>净值 *</label><input type="number" step="0.0001" value={nav} onChange={e=>setNav(e.target.value)} required/>
      <label>日期 *</label><input type="date" value={navDate} onChange={e=>setNavDate(e.target.value)} required/>
      <div className="form-buttons"><button type="submit" className="btn-primary">保存</button><button type="button" className="btn-secondary" onClick={()=>setShowNavForm(false)}>取消</button></div>
    </form></div></div>)}
  </div>)
}

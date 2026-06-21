import { useState, useEffect } from 'react'
import { api } from '../api/client'
import TransactionForm from '../components/TransactionForm'
import type { Transaction } from '../types/finance'
import './EntryPage.css'

export default function EntryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]); const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null); const [importing, setImporting] = useState(false)
  const [showImportConfirm, setShowImportConfirm] = useState(false); const [importData, setImportData] = useState<any>(null)

  async function load(){ setLoading(true); setError(null); try{setTransactions(await api.getTransactions())} catch(e:any){setError(e.message)} finally{setLoading(false)} }
  useEffect(()=>{load()},[])

  async function handleExport(){ try{const data=await api.exportData(); const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`finance-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url) } catch(e:any){alert('导出失败: '+e.message)} }

  function handleFileChange(e:React.ChangeEvent<HTMLInputElement>){ const file=e.target.files?.[0]; if(!file)return; const reader=new FileReader(); reader.onload=ev=>{try{const data=JSON.parse(ev.target?.result as string); setImportData(data); if(data.meta?.schemaVersion===1)setShowImportConfirm(true); else alert('备份文件格式不正确或不支持的版本')}catch{alert('无法解析 JSON 文件')}}; reader.readAsText(file) }

  async function handleImport(){ if(!importData)return; setImporting(true); try{await api.importData(importData); setShowImportConfirm(false); setImportData(null); load(); alert('数据导入成功！')} catch(e:any){alert('导入失败: '+e.message)}finally{setImporting(false)} }

  if(loading) return <div className="page-loading">加载中...</div>
  if(error) return <div className="page-error"><p>{error}</p><button onClick={load}>重试</button></div>

  return (<div className="entry-page"><h1>录入</h1>
    <div className="entry-layout">
      <div className="entry-form-col"><TransactionForm onSuccess={load}/></div>
      <div className="entry-side-col">
        <div className="backup-section"><h3>数据备份</h3><button className="btn-secondary" onClick={handleExport}>导出 JSON 备份</button>
          <div style={{marginTop:10}}><label className="btn-secondary" style={{cursor:'pointer'}}>导入 JSON 备份<input type="file" accept=".json" onChange={handleFileChange} style={{display:'none'}}/></label></div>
        </div>
        <div className="recent-tx"><h3>最近操作记录</h3>
          {transactions.slice(0,10).map(tx=>(<div key={tx.id} className="tx-row"><span className="tx-time">{new Date(tx.occurredAt).toLocaleString('zh-CN')}</span><span className="tx-type-badge">{tx.type==='deposit_adjustment'?'存款':tx.type==='fund_buy'?'买入':tx.type==='fund_sell'?'卖出':'净值'}</span></div>))}
          {transactions.length===0&&<p className="tx-empty">暂无记录</p>}
        </div>
      </div>
    </div>
    {showImportConfirm&&(<div className="modal-overlay" onClick={()=>setShowImportConfirm(false)}><div className="modal" onClick={e=>e.stopPropagation()}><h2>确认导入</h2><p>即将覆盖当前所有数据，此操作不可撤销。</p><p style={{color:'#888',fontSize:13,marginTop:8}}>存款账户: {importData?.deposits?.length||0} | 基金: {importData?.funds?.length||0} | 交易记录: {importData?.transactions?.length||0}</p><div className="form-buttons"><button className="btn-danger" onClick={handleImport} disabled={importing}>{importing?'导入中...':'确认导入'}</button><button className="btn-secondary" onClick={()=>{setShowImportConfirm(false);setImportData(null)}}>取消</button></div></div></div>)}
  </div>)
}

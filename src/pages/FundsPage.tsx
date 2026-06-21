import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { calculateFundPosition } from '../domain/funds'
import FundTable from '../components/FundTable'
import type { Fund, Transaction, FundNavPrice } from '../types/finance'
import type { FundPosition } from '../domain/funds'
import './FundsPage.css'

export default function FundsPage() {
  const [funds, setFunds] = useState<Fund[]>([]); const [transactions, setTransactions] = useState<Transaction[]>([])
  const [navPrices, setNavPrices] = useState<FundNavPrice[]>([]); const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null); const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Fund|null>(null); const [deletingId, setDeletingId] = useState<string|null>(null)
  const [name, setName] = useState(''); const [code, setCode] = useState(''); const [platform, setPlatform] = useState(''); const [note, setNote] = useState('')

  async function load(){ setLoading(true); setError(null); try{const[f,t]=await Promise.all([api.getFunds(),api.getTransactions()]); setFunds(f); setTransactions(t); const n=await Promise.all(f.map(fd=>api.getNavPrices(fd.id))); setNavPrices(n.flat())} catch(e:any){setError(e.message)} finally{setLoading(false)} }
  useEffect(()=>{load()},[])

  function reset(){ setName(''); setCode(''); setPlatform(''); setNote(''); setEditing(null); setShowForm(false) }
  function startEdit(f:Fund){ setName(f.name); setCode(f.code||''); setPlatform(f.platform||''); setNote(f.note||''); setEditing(f); setShowForm(true) }

  async function handleSubmit(e:React.FormEvent){ e.preventDefault()
    try { if(editing) await api.updateFund(editing.id,{name,code:code||undefined,platform:platform||undefined,note:note||undefined}); else await api.createFund({name,code:code||undefined,platform:platform||undefined,note:note||undefined}as any); reset(); load() }
    catch(e:any){ alert('保存失败: '+e.message) } }

  async function handleDelete(){ if(!deletingId) return; try{await api.deleteFund(deletingId); setDeletingId(null); load()} catch(e:any){alert('删除失败: '+e.message)} }

  const positions = new Map<string, FundPosition>()
  funds.forEach(f=>positions.set(f.id, calculateFundPosition(f.id, transactions, navPrices)))

  if(loading) return <div className="page-loading">加载中...</div>
  if(error) return <div className="page-error"><p>加载失败: {error}</p><button onClick={load}>重试</button></div>

  return (<div className="funds-page">
    <div className="funds-header"><h1>基金持仓</h1><button className="btn-primary" onClick={()=>{reset();setShowForm(true)}}>+ 新增基金</button></div>
    <FundTable funds={funds} positions={positions} onEdit={startEdit} onDelete={id=>setDeletingId(id)}/>
    {showForm&&(<div className="modal-overlay" onClick={reset}><div className="modal" onClick={e=>e.stopPropagation()}><h2>{editing?'编辑基金':'新增基金'}</h2><form onSubmit={handleSubmit}>
      <label>基金名称 *</label><input value={name} onChange={e=>setName(e.target.value)} required/>
      <label>基金代码</label><input value={code} onChange={e=>setCode(e.target.value)} placeholder="如 000001"/>
      <label>平台</label><input value={platform} onChange={e=>setPlatform(e.target.value)} placeholder="如 蚂蚁财富"/>
      <label>备注</label><input value={note} onChange={e=>setNote(e.target.value)}/>
      <div className="form-buttons"><button type="submit" className="btn-primary">保存</button><button type="button" className="btn-secondary" onClick={reset}>取消</button></div>
    </form></div></div>)}
    {deletingId&&(<div className="modal-overlay" onClick={()=>setDeletingId(null)}><div className="modal confirm-modal" onClick={e=>e.stopPropagation()}><p>确认删除此基金？相关交易记录将保留。</p><div className="form-buttons"><button className="btn-danger" onClick={handleDelete}>确认删除</button><button className="btn-secondary" onClick={()=>setDeletingId(null)}>取消</button></div></div></div>)}
  </div>)
}

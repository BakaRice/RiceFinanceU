import { useState, useEffect } from 'react'
import { api } from '../api/client'
import DepositTable from '../components/DepositTable'
import type { DepositAccount } from '../types/finance'
import './DepositsPage.css'

export default function DepositsPage() {
  const [deposits, setDeposits] = useState<DepositAccount[]>([])
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string|null>(null)
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<DepositAccount|null>(null)
  const [deletingId, setDeletingId] = useState<string|null>(null)
  const [name, setName] = useState(''); const [institution, setInstitution] = useState('')
  const [accountType, setAccountType] = useState<DepositAccount['accountType']>('current')
  const [balance, setBalance] = useState(''); const [note, setNote] = useState('')

  async function load() { setLoading(true); setError(null); try { setDeposits(await api.getDeposits()) } catch(e:any){ setError(e.message) } finally { setLoading(false) } }
  useEffect(()=>{load()},[])

  function reset() { setName(''); setInstitution(''); setAccountType('current'); setBalance(''); setNote(''); setEditing(null); setShowForm(false) }
  function startEdit(d:DepositAccount){ setName(d.name); setInstitution(d.institution); setAccountType(d.accountType); setBalance(String(d.balance)); setNote(d.note||''); setEditing(d); setShowForm(true) }

  async function handleSubmit(e:React.FormEvent){ e.preventDefault()
    try { if(editing) await api.updateDeposit(editing.id,{name,institution,accountType,balance:Number(balance),note:note||undefined}); else await api.createDeposit({name,institution,accountType,balance:Number(balance),note:note||undefined}as any); reset(); load() }
    catch(e:any){ alert('保存失败: '+e.message) } }

  async function handleDelete(){ if(!deletingId) return; try{await api.deleteDeposit(deletingId); setDeletingId(null); load()} catch(e:any){alert('删除失败: '+e.message)} }

  if(loading) return <div className="page-loading">加载中...</div>
  if(error) return <div className="page-error"><p>加载失败: {error}</p><button onClick={load}>重试</button></div>

  return (<div className="deposits-page">
    <div className="deposits-header"><h1>存款账户</h1><button className="btn-primary" onClick={()=>{reset();setShowForm(true)}}>+ 新增账户</button></div>
    <DepositTable deposits={deposits} onEdit={startEdit} onDelete={id=>setDeletingId(id)}/>
    {showForm&&(<div className="modal-overlay" onClick={reset}><div className="modal" onClick={e=>e.stopPropagation()}><h2>{editing?'编辑账户':'新增账户'}</h2><form onSubmit={handleSubmit}>
      <label>账户名称 *</label><input value={name} onChange={e=>setName(e.target.value)} required/>
      <label>机构 *</label><input value={institution} onChange={e=>setInstitution(e.target.value)} required/>
      <label>类型 *</label><select value={accountType} onChange={e=>setAccountType(e.target.value as any)}><option value="current">活期</option><option value="fixed">定期</option><option value="cash">现金</option><option value="money_market">货币基金</option><option value="other">其他</option></select>
      <label>余额 *</label><input type="number" step="0.01" value={balance} onChange={e=>setBalance(e.target.value)} required/>
      <label>备注</label><input value={note} onChange={e=>setNote(e.target.value)}/>
      <div className="form-buttons"><button type="submit" className="btn-primary">保存</button><button type="button" className="btn-secondary" onClick={reset}>取消</button></div>
    </form></div></div>)}
    {deletingId&&(<div className="modal-overlay" onClick={()=>setDeletingId(null)}><div className="modal confirm-modal" onClick={e=>e.stopPropagation()}><p>确认删除此账户？此操作不可撤销。</p><div className="form-buttons"><button className="btn-danger" onClick={handleDelete}>确认删除</button><button className="btn-secondary" onClick={()=>setDeletingId(null)}>取消</button></div></div></div>)}
  </div>)
}

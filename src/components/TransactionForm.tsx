import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { DepositAccount, Fund, Transaction } from '../types/finance'
import './TransactionForm.css'

type TxType = Transaction['type'] | ''

interface Props { onSuccess: () => void }

export default function TransactionForm({ onSuccess }: Props) {
  const [txType, setTxType] = useState<TxType>(''); const [deposits, setDeposits] = useState<DepositAccount[]>([])
  const [funds, setFunds] = useState<Fund[]>([]); const [submitting, setSubmitting] = useState(false)
  const [depositAccountId, setDepositAccountId] = useState(''); const [fundId, setFundId] = useState('')
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0,16)); const [note, setNote] = useState('')
  const [amountBefore, setAmountBefore] = useState(''); const [amountAfter, setAmountAfter] = useState('')
  const [amount, setAmount] = useState(''); const [shares, setShares] = useState(''); const [fee, setFee] = useState('')
  const [nav, setNav] = useState('')

  useEffect(()=>{api.getDeposits().then(setDeposits); api.getFunds().then(setFunds)},[])
  useEffect(()=>{if(txType==='deposit_adjustment'&&depositAccountId){const d=deposits.find(d=>d.id===depositAccountId); if(d)setAmountBefore(String(d.balance))}},[depositAccountId,txType,deposits])

  function reset(){ setTxType(''); setDepositAccountId(''); setFundId(''); setAmountBefore(''); setAmountAfter(''); setAmount(''); setShares(''); setFee(''); setNav(''); setNote('') }

  async function handleSubmit(e:React.FormEvent){ e.preventDefault(); setSubmitting(true)
    try{const base={occurredAt:new Date(occurredAt).toISOString(),note:note||undefined}
      if(txType==='deposit_adjustment') await api.createTransaction({type:'deposit_adjustment',depositAccountId,amountBefore:Number(amountBefore),amountAfter:Number(amountAfter),...base}as any)
      else if(txType==='fund_buy') await api.createTransaction({type:'fund_buy',fundId,amount:Number(amount),shares:Number(shares),fee:fee?Number(fee):undefined,...base}as any)
      else if(txType==='fund_sell') await api.createTransaction({type:'fund_sell',fundId,amount:Number(amount),shares:Number(shares),fee:fee?Number(fee):undefined,...base}as any)
      else if(txType==='fund_nav') await api.createTransaction({type:'fund_nav',fundId,nav:Number(nav),...base}as any)
      reset(); onSuccess()
    }catch(e:any){alert('保存失败: '+e.message)}finally{setSubmitting(false)} }

  return (<form className="tx-form" onSubmit={handleSubmit}><h3>新增操作</h3>
    <label>操作类型 *</label><select value={txType} onChange={e=>setTxType(e.target.value as TxType)} required><option value="">请选择...</option><option value="deposit_adjustment">存款余额调整</option><option value="fund_buy">基金买入</option><option value="fund_sell">基金卖出</option><option value="fund_nav">基金净值录入</option></select>
    <label>操作时间 *</label><input type="datetime-local" value={occurredAt} onChange={e=>setOccurredAt(e.target.value)} required/>
    {txType==='deposit_adjustment'&&(<><label>存款账户 *</label><select value={depositAccountId} onChange={e=>setDepositAccountId(e.target.value)} required><option value="">请选择...</option>{deposits.map(d=><option key={d.id} value={d.id}>{d.name} (当前: {d.balance})</option>)}</select><label>调整前余额</label><input type="number" step="0.01" value={amountBefore} readOnly/><label>调整后余额 *</label><input type="number" step="0.01" value={amountAfter} onChange={e=>setAmountAfter(e.target.value)} required/></>)}
    {(txType==='fund_buy'||txType==='fund_sell'||txType==='fund_nav')&&(<><label>基金 *</label><select value={fundId} onChange={e=>setFundId(e.target.value)} required><option value="">请选择...</option>{funds.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></>)}
    {txType==='fund_buy'&&(<><label>买入金额 *</label><input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required/><label>买入份额 *</label><input type="number" step="0.01" value={shares} onChange={e=>setShares(e.target.value)} required/><label>手续费</label><input type="number" step="0.01" value={fee} onChange={e=>setFee(e.target.value)}/></>)}
    {txType==='fund_sell'&&(<><label>卖出金额 *</label><input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required/><label>卖出份额 *</label><input type="number" step="0.01" value={shares} onChange={e=>setShares(e.target.value)} required/><label>手续费</label><input type="number" step="0.01" value={fee} onChange={e=>setFee(e.target.value)}/></>)}
    {txType==='fund_nav'&&(<><label>净值 *</label><input type="number" step="0.0001" value={nav} onChange={e=>setNav(e.target.value)} required/></>)}
    <label>备注</label><input value={note} onChange={e=>setNote(e.target.value)}/>
    <button type="submit" className="btn-primary" disabled={!txType||submitting}>{submitting?'保存中...':'保存'}</button>
  </form>)
}

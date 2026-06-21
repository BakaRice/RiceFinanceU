import type { Transaction } from '../types/finance'
import { formatMoney } from '../domain/money'
import './TransactionList.css'

interface Props { transactions: Transaction[]; depositNames?: Map<string, string>; fundNames?: Map<string, string> }

function desc(tx: Transaction, dn: Map<string, string>, fn: Map<string, string>): string {
  switch (tx.type) {
    case 'deposit_adjustment': return `${dn.get(tx.depositAccountId) || tx.depositAccountId}: ${formatMoney(tx.amountBefore)} → ${formatMoney(tx.amountAfter)}`
    case 'fund_buy': return `买入 ${fn.get(tx.fundId) || tx.fundId}: ${formatMoney(tx.amount)} / ${tx.shares}份`
    case 'fund_sell': return `卖出 ${fn.get(tx.fundId) || tx.fundId}: ${formatMoney(tx.amount)} / ${tx.shares}份`
    case 'fund_nav': return `${fn.get(tx.fundId) || tx.fundId} 净值: ${tx.nav}`
  }
}

export default function TransactionList({ transactions, depositNames, fundNames }: Props) {
  const dn = depositNames || new Map(); const fn = fundNames || new Map()
  const items = transactions.slice(0, 20)
  return (
    <div className="tx-list">
      <h3>最近操作</h3>
      {items.length === 0 ? <p className="tx-empty">暂无操作记录</p> : (
        <table><thead><tr><th>时间</th><th>类型</th><th>详情</th></tr></thead><tbody>
          {items.map(tx => (
            <tr key={tx.id}><td>{new Date(tx.occurredAt).toLocaleString('zh-CN')}</td><td>{tx.type==='deposit_adjustment'?'存款调整':tx.type==='fund_buy'?'基金买入':tx.type==='fund_sell'?'基金卖出':'净值录入'}</td><td>{desc(tx, dn, fn)}</td></tr>
          ))}
        </tbody></table>
      )}
    </div>
  )
}

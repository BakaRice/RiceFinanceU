import type { DepositAccount } from '../types/finance'
import { formatMoney } from '../domain/money'
import './DepositTable.css'

const TYPES: Record<string, string> = { cash: '现金', current: '活期', fixed: '定期', money_market: '货币基金', other: '其他' }

interface Props { deposits: DepositAccount[]; onEdit: (d: DepositAccount) => void; onDelete: (id: string) => void }

export default function DepositTable({ deposits, onEdit, onDelete }: Props) {
  if (deposits.length === 0) return <p className="deposit-empty">暂无存款账户，请点击"新增账户"添加。</p>
  return (
    <table className="deposit-table"><thead><tr><th>账户名称</th><th>机构</th><th>类型</th><th>余额</th><th>更新时间</th><th>操作</th></tr></thead><tbody>
      {deposits.map(d => (<tr key={d.id}><td>{d.name}</td><td>{d.institution}</td><td>{TYPES[d.accountType]||d.accountType}</td><td className="money">{formatMoney(d.balance)}</td><td>{new Date(d.updatedAt).toLocaleDateString('zh-CN')}</td><td><button className="btn-sm" onClick={()=>onEdit(d)}>编辑</button><button className="btn-sm btn-danger" onClick={()=>onDelete(d.id)}>删除</button></td></tr>))}
    </tbody></table>
  )
}

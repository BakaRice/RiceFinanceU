import { Link } from 'react-router-dom'
import type { Fund } from '../types/finance'
import type { FundPosition } from '../domain/funds'
import { formatMoney } from '../domain/money'
import './FundTable.css'

interface Props { funds: Fund[]; positions: Map<string, FundPosition>; onEdit: (f: Fund) => void; onDelete: (id: string) => void }

export default function FundTable({ funds, positions, onEdit, onDelete }: Props) {
  if (funds.length === 0) return <p className="fund-empty">暂无基金，请点击"新增基金"添加。</p>
  return (<table className="fund-table"><thead><tr><th>基金名称</th><th>代码</th><th>平台</th><th>当前份额</th><th>最新净值</th><th>市值</th><th>累计投入</th><th>浮动盈亏</th><th>操作</th></tr></thead><tbody>
    {funds.map(f=>{const p=positions.get(f.id);return(<tr key={f.id}>
      <td><Link to={`/funds/${f.id}`} className="fund-link">{f.name}</Link></td><td>{f.code||'-'}</td><td>{f.platform||'-'}</td>
      <td>{p?p.totalShares:0}</td><td>{p?p.latestNav:'-'}</td><td className="money">{p?formatMoney(p.marketValue):formatMoney(0)}</td>
      <td className="money">{p?formatMoney(p.totalCost):formatMoney(0)}</td>
      <td className={`money ${p&&p.totalPnl>=0?'profit':'loss'}`}>{p?`${p.totalPnl>=0?'+':''}${formatMoney(p.totalPnl)}`:formatMoney(0)}</td>
      <td><button className="btn-sm" onClick={()=>onEdit(f)}>编辑</button><button className="btn-sm btn-danger" onClick={()=>onDelete(f.id)}>删除</button></td>
    </tr>)})}
  </tbody></table>)
}

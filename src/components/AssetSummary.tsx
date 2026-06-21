import { formatMoney } from '../domain/money'
import './AssetSummary.css'

interface Props { totalAssets: number; depositTotal: number; fundMarketValue: number; totalPnl: number }

export default function AssetSummary({ totalAssets, depositTotal, fundMarketValue, totalPnl }: Props) {
  return (
    <div className="asset-summary">
      <div className="summary-card primary"><div className="summary-label">总资产</div><div className="summary-value">{formatMoney(totalAssets)}</div></div>
      <div className="summary-card"><div className="summary-label">存款总额</div><div className="summary-value">{formatMoney(depositTotal)}</div></div>
      <div className="summary-card"><div className="summary-label">基金市值</div><div className="summary-value">{formatMoney(fundMarketValue)}</div></div>
      <div className="summary-card"><div className="summary-label">浮动盈亏</div><div className={`summary-value ${totalPnl >= 0 ? 'profit' : 'loss'}`}>{totalPnl >= 0 ? '+' : ''}{formatMoney(totalPnl)}</div></div>
    </div>
  )
}

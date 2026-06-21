import type { SnapshotComparison as SnapshotComparisonType } from '../domain/snapshots'
import { formatMoney } from '../domain/money'
import './SnapshotComparison.css'

interface Props {
  comparison: SnapshotComparisonType | null
}

export default function SnapshotComparison({ comparison }: Props) {
  if (!comparison || comparison.items.length === 0) {
    return <div className="comparison-empty">暂无对比数据</div>
  }

  return (
    <div className="snapshot-comparison">
      <div className="comparison-summary">
        <div className="comparison-stat">
          <span className="stat-label">资产变化</span>
          <span className={`stat-value ${comparison.totalAmountChange >= 0 ? 'positive' : 'negative'}`}>
            {comparison.totalAmountChange >= 0 ? '+' : ''}{formatMoney(comparison.totalAmountChange)}
          </span>
        </div>
        {comparison.totalProfitChange !== undefined && (
          <div className="comparison-stat">
            <span className="stat-label">收益变化</span>
            <span className={`stat-value ${comparison.totalProfitChange >= 0 ? 'positive' : 'negative'}`}>
              {comparison.totalProfitChange >= 0 ? '+' : ''}{formatMoney(comparison.totalProfitChange)}
            </span>
          </div>
        )}
      </div>

      <div className="comparison-items">
        {comparison.items
          .filter((item) => item.amountChange !== 0)
          .map((item) => (
            <div key={item.assetId} className="comparison-item">
              <div className="comparison-item-header">
                <span className="comparison-item-name">{item.assetName}</span>
                <span className={`comparison-item-change ${item.amountChange >= 0 ? 'positive' : 'negative'}`}>
                  {item.amountChange >= 0 ? '+' : ''}{formatMoney(item.amountChange)}
                </span>
              </div>
              <div className="comparison-item-detail">
                <span className="detail-prev">{formatMoney(item.previousAmount)}</span>
                <span className="detail-arrow">→</span>
                <span className="detail-curr">{formatMoney(item.currentAmount)}</span>
                {item.profitChange !== undefined && (
                  <span className={`detail-profit ${item.profitChange >= 0 ? 'positive' : 'negative'}`}>
                    收益 {item.profitChange >= 0 ? '+' : ''}{formatMoney(item.profitChange)}
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

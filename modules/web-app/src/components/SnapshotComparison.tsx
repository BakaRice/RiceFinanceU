import type { SnapshotComparison as SnapshotComparisonType } from '../domain/snapshots'
import MoneyDisplay from './MoneyDisplay'
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
          <MoneyDisplay value={comparison.totalAmountChange} isProfit size="large" />
        </div>
        {comparison.totalProfitChange !== undefined && (
          <div className="comparison-stat">
            <span className="stat-label">收益变化</span>
            <MoneyDisplay value={comparison.totalProfitChange} isProfit size="large" />
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
                <MoneyDisplay value={item.amountChange} isProfit />
              </div>
              <div className="comparison-item-detail">
                <span className="detail-prev">
                  <MoneyDisplay value={item.previousAmount} showCurrency={false} />
                </span>
                <span className="detail-arrow">→</span>
                <span className="detail-curr">
                  <MoneyDisplay value={item.currentAmount} showCurrency={false} />
                </span>
                {item.profitChange !== undefined && (
                  <span className="detail-profit">
                    收益 <MoneyDisplay value={item.profitChange} isProfit showCurrency={false} />
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

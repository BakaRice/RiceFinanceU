import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Asset, SnapshotValue } from '../types/finance'
import { CURRENCY_SYMBOLS } from '../types/finance'
import { ASSET_TYPE_LABELS, getAssetProfileFields, isInvestmentType } from '../domain/assets'
import { DCA_FREQUENCY_LABELS, estimateDcaPlan } from '../domain/dca'
import { formatProfitRateInput } from '../domain/money'
import MoneyDisplay from '../components/MoneyDisplay'
import { useFeedback } from '../components/Feedback/FeedbackContext'
import './AssetDetailPage.css'

interface AssetSnapshotRecord {
  snapshotId: string
  recordedAt: string
  amount: number
  profit?: number
  profitRate?: number
}

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { confirm } = useFeedback()

  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [latestValue, setLatestValue] = useState<SnapshotValue | null>(null)
  const [history, setHistory] = useState<AssetSnapshotRecord[]>([])
  const [latestSnapshotTime, setLatestSnapshotTime] = useState<string>('')

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [assets, snapshots, values] = await Promise.all([
        api.getAssets(),
        api.getSnapshots(),
        api.getSnapshotValues(),
      ])

      const found = assets.find((a) => a.id === id)
      if (!found) {
        setError('资产不存在')
        setLoading(false)
        return
      }
      setAsset(found)

      // Build history from snapshots
      const sortedSnapshots = [...snapshots].sort(
        (a, b) => b.recordedAt.localeCompare(a.recordedAt)
      )

      const records: AssetSnapshotRecord[] = []
      let latest: SnapshotValue | null = null
      let latestTime = ''

      for (const snap of sortedSnapshots) {
        const val = values.find(
          (v) => v.snapshotId === snap.id && v.assetId === id
        )
        if (val) {
          records.push({
            snapshotId: snap.id,
            recordedAt: snap.recordedAt,
            amount: val.amount,
            profit: val.profit,
            profitRate: val.profitRate,
          })
          if (!latest) {
            latest = val
            latestTime = snap.recordedAt
          }
        }
      }

      setLatestValue(latest)
      setLatestSnapshotTime(latestTime)
      setHistory(records)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeactivate() {
    if (!asset) return
    const ok = await confirm({
      title: '停用资产',
      message: `确定要停用 "${asset.name}" 吗？停用后仍可在历史快照中查看。`,
      confirmLabel: '停用',
      cancelLabel: '取消',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteAsset(asset.id)
      navigate('/assets')
    } catch (e: any) {
      // Error handling via toast would go here
    }
  }

  if (loading) return <div className="page-loading">加载中...</div>
  if (error) return (
    <div className="page-error">
      <p>{error}</p>
      <button onClick={() => navigate('/assets')}>返回资产管理</button>
    </div>
  )
  if (!asset) return null

  const isInvestment = isInvestmentType(asset.type)
  const profileRows = getAssetProfileFields(asset.type)
    .map((field) => ({
      label: field.label,
      value: asset.profile?.[field.key],
    }))
    .filter((row) => row.value)

  // Calculate cost basis for investment assets
  const costBasis = latestValue && isInvestment && latestValue.profit !== undefined
    ? latestValue.amount - latestValue.profit
    : undefined
  const dcaEstimate = isInvestment && asset.dcaPlan
    ? estimateDcaPlan({
      asset,
      latestAmount: latestValue?.amount,
      asOfDate: latestSnapshotTime || new Date(),
    })
    : undefined

  return (
    <div className="asset-detail">
      {/* Back nav */}
      <button className="btn-link" onClick={() => navigate('/assets')} style={{ marginBottom: 12 }}>
        ← 返回资产管理
      </button>

      {/* Header */}
      <div className="detail-header">
        <div className="detail-header-left">
          <h1 className="detail-name">{asset.name}</h1>
          <div className="detail-meta">
            <span className={`status-badge ${asset.isActive ? 'status-active' : 'status-inactive'}`}>
              {asset.isActive ? '启用' : '停用'}
            </span>
            <span className={`type-badge type-${asset.type}`}>
              {ASSET_TYPE_LABELS[asset.type as keyof typeof ASSET_TYPE_LABELS] || asset.type}
            </span>
            {asset.institution && <span className="detail-institution">{asset.institution}</span>}
          </div>
        </div>
        <div className="detail-header-right">
          <button className="btn-secondary" aria-label={`编辑 ${asset.name}`} onClick={() => navigate('/assets', { state: { editId: asset.id } })}>
            编辑
          </button>
          {asset.isActive && (
            <button className="btn-danger" onClick={handleDeactivate}>
              停用
            </button>
          )}
        </div>
      </div>

      {/* Main metrics */}
      <div className="detail-metrics">
        <div className="detail-main-amount">
          <div className="detail-metric-label">最新金额</div>
          <MoneyDisplay
            value={latestValue?.amount}
            currency={asset.currency}
            size="large"
          />
          {latestSnapshotTime && (
            <div className="detail-update-time">
              最近快照：{new Date(latestSnapshotTime).toLocaleString('zh-CN')}
            </div>
          )}
          {!latestValue && (
            <div className="detail-no-data">暂无快照数据</div>
          )}
        </div>

        {isInvestment && (
          <div className="detail-secondary-metrics">
            <div className="detail-metric-item">
              <div className="detail-metric-label">收益</div>
              <MoneyDisplay value={latestValue?.profit} isProfit />
            </div>
            <div className="detail-metric-item">
              <div className="detail-metric-label">收益率</div>
              <span className={`money-display ${(latestValue?.profitRate || 0) >= 0 ? 'is-profit' : 'is-loss'}`}>
                {latestValue?.profitRate !== undefined
                  ? `${latestValue.profitRate >= 0 ? '+' : ''}${formatProfitRateInput(latestValue.profitRate)}%`
                  : '-'}
              </span>
            </div>
            {costBasis !== undefined && (
              <div className="detail-metric-item">
                <div className="detail-metric-label">成本</div>
                <MoneyDisplay value={costBasis} currency={asset.currency} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail info */}
      <div className="detail-info-grid">
        <div className="detail-info-section detail-history-section">
          <h3 className="section-title">基础信息</h3>
          <dl className="detail-dl">
            <dt>类型</dt>
            <dd>{ASSET_TYPE_LABELS[asset.type as keyof typeof ASSET_TYPE_LABELS] || asset.type}</dd>
            <dt>币种</dt>
            <dd>{asset.currency} {CURRENCY_SYMBOLS[asset.currency]}</dd>
            {asset.institution && (
              <>
                <dt>机构</dt>
                <dd>{asset.institution}</dd>
              </>
            )}
            <dt>创建时间</dt>
            <dd>{new Date(asset.createdAt).toLocaleString('zh-CN')}</dd>
            {asset.note && (
              <>
                <dt>备注</dt>
                <dd>{asset.note}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="detail-info-section">
          <h3 className="section-title">资产档案</h3>
          {profileRows.length === 0 ? (
            <p className="detail-profile-empty">未补充档案信息</p>
          ) : (
            <dl className="detail-dl">
              {profileRows.map((row) => (
                <div className="detail-dl-row" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {isInvestment && asset.dcaPlan?.enabled && (
          <div className="detail-info-section dca-detail-section">
            <h3 className="section-title">定投计划</h3>
            <div className={`dca-status dca-status-${dcaEstimate?.status || 'insufficient_data'}`}>
              {dcaEstimate?.message}
            </div>
            <dl className="detail-dl">
              <dt>周期</dt>
              <dd>{DCA_FREQUENCY_LABELS[asset.dcaPlan.frequency]}</dd>
              {asset.dcaPlan.frequency === 'daily' && (
                <>
                  <dt>排除周末</dt>
                  <dd>{asset.dcaPlan.excludeWeekends === false ? '否' : '是'}</dd>
                </>
              )}
              <dt>每期计划投入</dt>
              <dd><MoneyDisplay value={asset.dcaPlan.plannedContribution} currency={asset.currency} /></dd>
              {asset.dcaPlan.targetAmount !== undefined && (
                <>
                  <dt>目标金额</dt>
                  <dd><MoneyDisplay value={asset.dcaPlan.targetAmount} currency={asset.currency} /></dd>
                </>
              )}
              {asset.dcaPlan.targetDate && (
                <>
                  <dt>目标日期</dt>
                  <dd>{asset.dcaPlan.targetDate}</dd>
                </>
              )}
              {dcaEstimate?.periodsRemaining !== undefined && (
                <>
                  <dt>剩余周期</dt>
                  <dd>{dcaEstimate.periodsRemaining}</dd>
                </>
              )}
              {dcaEstimate?.remainingAmount !== undefined && (
                <>
                  <dt>剩余目标金额</dt>
                  <dd><MoneyDisplay value={dcaEstimate.remainingAmount} currency={asset.currency} /></dd>
                </>
              )}
              {dcaEstimate?.suggestedContribution !== undefined && (
                <>
                  <dt>建议每期投入</dt>
                  <dd><MoneyDisplay value={dcaEstimate.suggestedContribution} currency={asset.currency} /></dd>
                </>
              )}
              {dcaEstimate?.contributionGap !== undefined && (
                <>
                  <dt>计划偏差</dt>
                  <dd><MoneyDisplay value={dcaEstimate.contributionGap} isProfit /></dd>
                </>
              )}
              {asset.dcaPlan.note && (
                <>
                  <dt>备注</dt>
                  <dd>{asset.dcaPlan.note}</dd>
                </>
              )}
            </dl>
          </div>
        )}

        {/* History */}
        <div className="detail-info-section">
          <h3 className="section-title">历史变化 ({history.length})</h3>
          {history.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13, padding: '12px 0' }}>暂无快照记录</p>
          ) : (
            <table className="fin-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th className="align-right">金额</th>
                  {isInvestment && (
                    <>
                      <th className="align-right">收益</th>
                      <th className="align-right">收益率</th>
                    </>
                  )}
                  <th className="align-right">变化</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map((record, idx) => {
                  const prev = history[idx + 1]
                  const delta = prev ? record.amount - prev.amount : undefined
                  return (
                    <tr key={record.snapshotId}>
                      <td className="text-muted" style={{ fontSize: 12 }}>
                        {new Date(record.recordedAt).toLocaleString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="align-right">
                        <MoneyDisplay value={record.amount} currency={asset.currency} showCurrency={false} />
                      </td>
                      {isInvestment && (
                        <>
                          <td className="align-right">
                            <MoneyDisplay value={record.profit} isProfit />
                          </td>
                          <td className="align-right">
                            {record.profitRate !== undefined ? (
                              <span className={`money-display ${record.profitRate >= 0 ? 'is-profit' : 'is-loss'}`}>
                                {record.profitRate >= 0 ? '+' : ''}{formatProfitRateInput(record.profitRate)}%
                              </span>
                            ) : '-'}
                          </td>
                        </>
                      )}
                      <td className="align-right">
                        {delta !== undefined ? (
                          <MoneyDisplay value={delta} isProfit showCurrency={false} />
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

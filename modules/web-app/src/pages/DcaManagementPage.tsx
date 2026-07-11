import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import MoneyDisplay from '../components/MoneyDisplay'
import { ASSET_TYPE_LABELS, isInvestmentType } from '../domain/assets'
import {
  DCA_FREQUENCY_LABELS,
  estimateDcaMonthlyContribution,
  summarizeDcaMonthlyContributions,
} from '../domain/dca'
import type { Asset, DcaFrequency, ExchangeRates } from '../types/finance'
import './DcaManagementPage.css'

type FrequencyFilter = 'all' | DcaFrequency

const DEFAULT_RATES: ExchangeRates = { USD: 7.2, HKD: 0.92, updatedAt: '' }

const FREQUENCY_FILTERS: Array<{ value: FrequencyFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
  { value: 'biweekly', label: '每两周' },
  { value: 'monthly', label: '每月' },
  { value: 'quarterly', label: '每季度' },
]

export default function DcaManagementPage() {
  const navigate = useNavigate()
  const [assets, setAssets] = useState<Asset[]>([])
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_RATES)
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [assetData, rateData] = await Promise.all([
        api.getAssets(),
        api.getRates().catch(() => DEFAULT_RATES),
      ])
      setAssets(assetData)
      setRates(rateData)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const dcaAssets = useMemo(
    () => assets.filter((asset) => asset.isActive && isInvestmentType(asset.type) && asset.dcaPlan?.enabled),
    [assets],
  )
  const filteredAssets = useMemo(
    () => frequencyFilter === 'all'
      ? dcaAssets
      : dcaAssets.filter((asset) => asset.dcaPlan?.frequency === frequencyFilter),
    [dcaAssets, frequencyFilter],
  )
  const summary = useMemo(
    () => summarizeDcaMonthlyContributions(dcaAssets, rates),
    [dcaAssets, rates],
  )

  if (loading) return <div className="page-loading">加载中...</div>
  if (error) {
    return (
      <div className="page-error">
        <p>{error}</p>
        <button onClick={load}>重试</button>
      </div>
    )
  }

  return (
    <div className="dca-management-page">
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">定投管理</h1>
          <p className="page-subtitle">集中查看启用中的投资类定投计划</p>
          <div className="page-stats">
            <span>本月估算 · CNY 汇总口径</span>
          </div>
        </div>
        {dcaAssets.length > 0 && (
          <button className="btn-primary" onClick={() => navigate('/assets')}>
            去资产管理
          </button>
        )}
      </div>

      <div className="dca-summary-strip section-panel">
        <div className="dca-summary-item">
          <span className="dca-summary-label">本月计划投入</span>
          <MoneyDisplay value={summary.monthlyContributionCNY} currency="CNY" />
        </div>
        <div className="dca-summary-item">
          <span className="dca-summary-label">启用计划数</span>
          <strong>{summary.planCount}</strong>
        </div>
        <div className="dca-summary-item">
          <span className="dca-summary-label">平均每期投入</span>
          <MoneyDisplay value={summary.averageContributionCNY} currency="CNY" />
        </div>
      </div>

      {dcaAssets.length === 0 ? (
        <div className="empty-state dca-empty-state section-panel">
          <p>还没有启用定投计划</p>
          <span>在资产管理中编辑基金、股票或黄金资产，可以为它们添加定投计划。</span>
          <button className="btn-primary" onClick={() => navigate('/assets')}>
            去资产管理
          </button>
        </div>
      ) : (
        <div className="dca-plan-section section-panel">
          <div className="dca-filter-row" aria-label="定投周期筛选">
            {FREQUENCY_FILTERS.map((item) => (
              <button
                className={frequencyFilter === item.value ? 'dca-filter active' : 'dca-filter'}
                key={item.value}
                onClick={() => setFrequencyFilter(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="table-container">
            <table className="fin-table dca-plan-table">
              <thead>
                <tr>
                  <th>资产</th>
                  <th>周期</th>
                  <th className="align-right">每期计划投入</th>
                  <th className="align-right">本月预计投入</th>
                  <th>目标</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => {
                  const estimate = estimateDcaMonthlyContribution({ asset, rates })
                  return (
                    <tr key={asset.id}>
                      <td>
                        <button
                          className="asset-name-link dca-asset-link"
                          onClick={() => navigate(`/assets/${asset.id}`)}
                          type="button"
                        >
                          {asset.name}
                        </button>
                        <div className="dca-asset-meta">
                          <span>{ASSET_TYPE_LABELS[asset.type]}</span>
                          {asset.institution && <span>{asset.institution}</span>}
                          <span>{asset.currency}</span>
                        </div>
                      </td>
                      <td>
                        <span className="dca-frequency-chip">
                          {DCA_FREQUENCY_LABELS[asset.dcaPlan!.frequency]}
                        </span>
                      </td>
                      <td className="align-right">
                        <MoneyDisplay value={asset.dcaPlan!.plannedContribution} currency={asset.currency} />
                      </td>
                      <td className="align-right">
                        {estimate?.approximate && <span className="dca-approx-prefix">约</span>}
                        <MoneyDisplay value={estimate?.monthlyContribution} currency={asset.currency} />
                      </td>
                      <td className="dca-target-cell">
                        {asset.dcaPlan!.targetAmount !== undefined ? (
                          <>
                            <MoneyDisplay value={asset.dcaPlan!.targetAmount} currency={asset.currency} />
                            {asset.dcaPlan!.targetDate && (
                              <span className="dca-target-date">{asset.dcaPlan!.targetDate}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted">未设置</span>
                        )}
                      </td>
                      <td className="dca-note-cell" title={asset.dcaPlan!.note || undefined}>
                        {asset.dcaPlan!.note || '-'}
                      </td>
                      <td className="dca-actions">
                        <button
                          className="btn-link"
                          onClick={() => navigate('/assets', { state: { editId: asset.id } })}
                          type="button"
                        >
                          编辑计划
                        </button>
                        <button
                          className="btn-link"
                          onClick={() => navigate(`/assets/${asset.id}`)}
                          type="button"
                        >
                          查看资产
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

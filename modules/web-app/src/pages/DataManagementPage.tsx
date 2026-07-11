import { useState } from 'react'
import { api } from '../api/client'
import { useFeedback } from '../components/Feedback/FeedbackContext'
import { normalizeStoredProfitRate } from '../domain/money'
import './DataManagementPage.css'

const VALID_ASSET_TYPES = ['fund', 'stock', 'gold', 'deposit', 'cash', 'housing_fund', 'other']
const VALID_CURRENCIES = ['CNY', 'USD', 'HKD']

interface ImportSummary {
  schemaVersion: number
  assetCount: number
  snapshotCount: number
  valueCount: number
  incomeCount: number
  assetIdSet: Set<string>
  snapIdSet: Set<string>
  normalizedProfitRateCount: number
  issues: string[]
  hasCriticalIssues: boolean
}

const INCOME_AMOUNT_FIELDS = ['salary', 'extraIncome', 'housingFund', 'otherIncome']

function isValidMonthKey(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return false
  const month = Number(match[2])
  return month >= 1 && month <= 12
}

function isValidIncomeAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function preValidate(data: any): ImportSummary {
  const issues: string[] = []

  // Normalize v1/v2
  const assets: any[] = data.assets || []
  const snapshots: any[] = data.snapshots || data.transactions || []
  const values: any[] = data.snapshotValues || []
  const monthlyIncomes: any[] = data.monthlyIncomes === undefined
    ? []
    : Array.isArray(data.monthlyIncomes)
      ? data.monthlyIncomes
      : []
  if (data.monthlyIncomes !== undefined && !Array.isArray(data.monthlyIncomes)) {
    issues.push('monthlyIncomes 应为数组')
  }

  const assetIdSet = new Set<string>()
  const snapIdSet = new Set<string>()

  // Check assets
  let badAssetCount = 0
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i]
    if (!a || typeof a !== 'object' || typeof a.id !== 'string' || !a.id.trim()) {
      badAssetCount++
      continue
    }
    assetIdSet.add(a.id)
    if (typeof a.name !== 'string' || !a.name.trim()) {
      issues.push(`资产[${i}] "${a.id}": 缺少名称`)
    }
    if (!VALID_ASSET_TYPES.includes(a.type)) {
      issues.push(`资产[${i}] "${a.name || a.id}": 无效类型 "${a.type}"`)
    }
    if (!VALID_CURRENCIES.includes(a.currency)) {
      issues.push(`资产[${i}] "${a.name || a.id}": 无效币种 "${a.currency}"`)
    }
    if (typeof a.isActive !== 'boolean') {
      issues.push(`资产[${i}] "${a.name || a.id}": isActive 应为布尔值`)
    }
  }
  if (badAssetCount > 0) issues.push(`${badAssetCount} 个资产缺少有效 ID`)

  // Check snapshots
  let badSnapCount = 0
  for (let i = 0; i < snapshots.length; i++) {
    const s = snapshots[i]
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !s.id.trim()) {
      badSnapCount++
      continue
    }
    snapIdSet.add(s.id)
    if (typeof s.recordedAt !== 'string' || isNaN(Date.parse(s.recordedAt))) {
      issues.push(`快照[${i}] "${s.id}": 缺少有效日期`)
    }
  }
  if (badSnapCount > 0) issues.push(`${badSnapCount} 个快照缺少有效 ID`)

  // Check snapshot values
  let badValueCount = 0
  let orphanSnapCount = 0
  let orphanAssetCount = 0
  let normalizedProfitRateCount = 0
  let invalidProfitRateCount = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (!v || typeof v !== 'object' || typeof v.id !== 'string' || !v.id.trim()) {
      badValueCount++
      continue
    }
    if (typeof v.snapshotId !== 'string' || !snapIdSet.has(v.snapshotId)) {
      orphanSnapCount++
    }
    if (typeof v.assetId !== 'string' || !assetIdSet.has(v.assetId)) {
      orphanAssetCount++
    }
    if (typeof v.amount !== 'number' || !Number.isFinite(v.amount) || v.amount < 0) {
      issues.push(`快照值[${i}] "${v.id}": 金额无效 (${v.amount})`)
    }
    if (v.profitRate !== undefined) {
      const normalizedProfitRate = normalizeStoredProfitRate(v.profitRate)
      if (normalizedProfitRate === null) {
        invalidProfitRateCount++
        issues.push(`快照值[${i}] "${v.id}": 收益率无效 (${v.profitRate})`)
      } else if (normalizedProfitRate !== v.profitRate) {
        normalizedProfitRateCount++
      }
    }
  }
  if (badValueCount > 0) issues.push(`${badValueCount} 个快照值缺少有效 ID`)
  if (orphanSnapCount > 0) issues.push(`${orphanSnapCount} 个快照值引用了不存在的快照`)
  if (orphanAssetCount > 0) issues.push(`${orphanAssetCount} 个快照值引用了不存在的资产`)
  if (normalizedProfitRateCount > 0) {
    issues.push(`${normalizedProfitRateCount} 个收益率将在导入时截断为百分比两位小数`)
  }

  // Check monthly incomes
  for (let i = 0; i < monthlyIncomes.length; i++) {
    const income = monthlyIncomes[i]
    const label = income && typeof income.id === 'string' && income.id.trim()
      ? income.id
      : `第 ${i + 1} 条`

    if (!income || typeof income !== 'object' || Array.isArray(income)) {
      issues.push(`月收入[${i}] "${label}": 记录格式无效`)
      continue
    }
    if (!isValidMonthKey(income.month)) {
      issues.push(`月收入[${i}] "${label}": 月份无效 "${income.month}"`)
    }
    for (const field of INCOME_AMOUNT_FIELDS) {
      if (!isValidIncomeAmount(income[field])) {
        issues.push(`月收入[${i}] "${label}": ${field} 金额无效 (${income[field]})`)
      }
    }
  }

  // Cap issues shown
  const maxIssues = 15
  const shown = issues.slice(0, maxIssues)
  if (issues.length > maxIssues) shown.push(`... 还有 ${issues.length - maxIssues} 个问题`)

  const hasCriticalIssues =
    badAssetCount > 0 || badSnapCount > 0 || badValueCount > 0 || invalidProfitRateCount > 0

  return {
    schemaVersion: data.meta?.schemaVersion || 0,
    assetCount: assets.length,
    snapshotCount: snapshots.length,
    valueCount: values.length,
    incomeCount: monthlyIncomes.length,
    assetIdSet,
    snapIdSet,
    normalizedProfitRateCount,
    issues: shown,
    hasCriticalIssues,
  }
}

export default function DataManagementPage() {
  const { toast } = useFeedback()
  const [importing, setImporting] = useState(false)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [importData, setImportData] = useState<any>(null)

  async function handleExport() {
    const data = await api.exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finance-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('备份已导出')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)

        // Structural check
        if (!data || typeof data !== 'object') {
          toast('文件内容不是有效的 JSON 对象', 'error')
          return
        }
        if (!data.meta || typeof data.meta.schemaVersion !== 'number') {
          toast('缺少 meta.schemaVersion 字段', 'error')
          return
        }
        const version = data.meta.schemaVersion
        if (version !== 1 && version !== 2) {
          toast(`不支持的 schema 版本: ${version}，支持: 1, 2`, 'error')
          return
        }
        if (!Array.isArray(data.assets)) {
          toast('缺少 assets 数组', 'error')
          return
        }
        if (!Array.isArray(data.snapshots) && !Array.isArray(data.transactions)) {
          toast('缺少 snapshots 数组', 'error')
          return
        }
        if (!Array.isArray(data.snapshotValues)) {
          toast('缺少 snapshotValues 数组', 'error')
          return
        }

        // Pre-validate
        const summary = preValidate(data)
        setImportSummary(summary)
        setImportData(data)
        setShowImportConfirm(true)
      } catch {
        toast('无法解析 JSON 文件', 'error')
      }
    }
    reader.readAsText(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  async function handleImport() {
    if (!importData) return
    setImporting(true)
    try {
      const result = await api.importData(importData)
      setShowImportConfirm(false)
      setImportData(null)
      setImportSummary(null)
      toast(result.message || '数据导入成功')
    } catch (e: any) {
      toast('导入失败: ' + e.message, 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="data-page">
      <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, marginBottom: 16 }}>
        数据管理
      </h1>

      <section className="data-section">
        <h3 className="section-title">JSON 备份</h3>
        <div className="data-actions">
          <button className="btn-secondary" onClick={handleExport}>
            导出 JSON 备份
          </button>
          <label className="btn-secondary data-import-label">
            导入 JSON 备份
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </section>

      {showImportConfirm && importSummary && (
        <div className="modal-overlay" onClick={() => setShowImportConfirm(false)}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h2>确认导入</h2>
            <p className="confirm-body">即将覆盖当前所有数据，此操作不可撤销。</p>

            {/* Summary stats */}
            <div className="confirm-detail">
              <div>Schema v{importSummary.schemaVersion}</div>
              <div>
                资产: {importSummary.assetCount} | 快照: {importSummary.snapshotCount} | 记录:{' '}
                {importSummary.valueCount} | 月收入: {importSummary.incomeCount}
              </div>
            </div>

            {/* Validation issues */}
            {importSummary.issues.length > 0 && (
              <div className="import-issues">
                <div className="import-issues-title">
                  {importSummary.hasCriticalIssues ? '⚠ 发现问题' : 'ℹ 注意事项'}
                </div>
                <ul className="import-issues-list">
                  {importSummary.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {importSummary.hasCriticalIssues && (
              <p className="import-warning-text">
                存在严重问题，导入可能失败或数据不完整。建议修复 JSON 文件后重试。
              </p>
            )}

            <div className="confirm-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowImportConfirm(false)
                  setImportData(null)
                  setImportSummary(null)
                }}
              >
                取消
              </button>
              <button
                className="btn-danger"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? '导入中...' : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Asset, AssetProfile, AssetProfileKey, AssetType, Currency, SnapshotValue } from '../types/finance'
import {
  ASSET_TYPE_LABELS,
  formatAssetProfileIdentifier,
  getAssetProfileFields,
  isInvestmentType,
  sanitizeAssetProfile,
} from '../domain/assets'
import MoneyDisplay from '../components/MoneyDisplay'
import { useFeedback } from '../components/Feedback/FeedbackContext'
import './AssetsPage.css'

type SortKey = 'name' | 'type' | 'currency' | 'amount' | 'profit' | 'profitRate' | 'institution'

export default function AssetsPage() {
  const navigate = useNavigate()
  const { toast, confirm } = useFeedback()

  const [assets, setAssets] = useState<Asset[]>([])
  const [latestValues, setLatestValues] = useState<Map<string, SnapshotValue>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<AssetType>('fund')
  const [currency, setCurrency] = useState<Currency>('CNY')
  const [institution, setInstitution] = useState('')
  const [note, setNote] = useState('')
  const [profileDraft, setProfileDraft] = useState<AssetProfile>({})
  const [sortKey, setSortKey] = useState<SortKey>('type')
  const [sortDir, setSortDir] = useState<1 | -1>(1)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [allAssets, latestData] = await Promise.all([
        api.getAssets(),
        api.getLatestSnapshot(),
      ])
      setAssets(allAssets)
      const valMap = new Map<string, SnapshotValue>()
      if (latestData && latestData.values) {
        for (const v of latestData.values) {
          valMap.set(v.assetId, v)
        }
      }
      setLatestValues(valMap)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditingId(null)
    setName('')
    setType('fund')
    setCurrency('CNY')
    setInstitution('')
    setNote('')
    setProfileDraft({})
    setShowForm(true)
  }

  function openEdit(a: Asset) {
    setEditingId(a.id)
    setName(a.name)
    setType(a.type)
    setCurrency(a.currency)
    setInstitution(a.institution || '')
    setNote(a.note || '')
    setProfileDraft(a.profile || {})
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const profile = sanitizeAssetProfile(type, profileDraft)
    const payload = {
      name,
      type,
      currency,
      institution: institution || undefined,
      note: note || undefined,
      profile: profile || {},
    }
    try {
      if (editingId) {
        await api.updateAsset(editingId, payload)
        toast('资产已更新')
      } else {
        await api.createAsset(payload)
        toast('资产已创建')
      }
      setShowForm(false)
      load()
    } catch (e: any) {
      toast('保存失败: ' + e.message, 'error')
    }
  }

  function updateProfileDraft(key: AssetProfileKey, value: string) {
    setProfileDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function handleDeactivate(a: Asset) {
    const ok = await confirm({
      title: '停用资产',
      message: `确定要停用 "${a.name}" 吗？`,
      detail: '停用后该资产将不在录入页显示，但仍可在历史快照中查看。',
      confirmLabel: '停用',
      cancelLabel: '取消',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteAsset(a.id)
      toast(`已停用 "${a.name}"`)
      load()
    } catch (e: any) {
      toast('操作失败: ' + e.message, 'error')
    }
  }

  if (loading) return <div className="page-loading">加载中...</div>
  if (error)
    return (
      <div className="page-error">
        <p>{error}</p>
        <button onClick={load}>重试</button>
      </div>
    )

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 1 ? -1 : 1)
    } else {
      setSortKey(key)
      setSortDir(1)
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <span className="sort-icon">▸</span>
    return <span className="sort-icon active">{sortDir === 1 ? '▲' : '▼'}</span>
  }

  function sortAssets(list: Asset[]): Asset[] {
    return [...list].sort((a, b) => {
      const va = latestValues.get(a.id)
      const vb = latestValues.get(b.id)
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'zh')
          break
        case 'type':
          cmp = a.type.localeCompare(b.type)
          break
        case 'currency':
          cmp = a.currency.localeCompare(b.currency)
          break
        case 'institution':
          cmp = (a.institution || '').localeCompare(b.institution || '', 'zh')
          break
        case 'amount':
          cmp = (va?.amount || 0) - (vb?.amount || 0)
          break
        case 'profit':
          cmp = (va?.profit || 0) - (vb?.profit || 0)
          break
        case 'profitRate':
          cmp = (va?.profitRate || 0) - (vb?.profitRate || 0)
          break
      }
      return cmp * sortDir
    })
  }

  const hasInvestmentCol = assets.some((a) => isInvestmentType(a.type))

  const activeAssets = sortAssets(assets.filter((a) => a.isActive))
  const inactiveAssets = assets.filter((a) => !a.isActive)

  const activeCount = activeAssets.length
  const inactiveCount = inactiveAssets.length
  const currencySet = new Set(assets.map((a) => a.currency))
  const currencyList = Array.from(currencySet).join('/')

  function renderTable(assetList: Asset[], isInactive: boolean) {
    return (
      <table className="fin-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => toggleSort('name')}>
              名称 {sortIcon('name')}
            </th>
            <th className="sortable" onClick={() => toggleSort('type')}>
              类型 {sortIcon('type')}
            </th>
            <th>标识</th>
            <th className="sortable" onClick={() => toggleSort('institution')}>
              机构 {sortIcon('institution')}
            </th>
            <th className="sortable" onClick={() => toggleSort('currency')}>
              币种 {sortIcon('currency')}
            </th>
            <th className="sortable align-right" onClick={() => toggleSort('amount')}>
              最新金额 {sortIcon('amount')}
            </th>
            {hasInvestmentCol && (
              <>
                <th className="sortable align-right" onClick={() => toggleSort('profit')}>
                  收益 {sortIcon('profit')}
                </th>
                <th className="sortable align-right" onClick={() => toggleSort('profitRate')}>
                  收益率 {sortIcon('profitRate')}
                </th>
              </>
            )}
            <th>备注</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {assetList.map((a) => {
            const lv = latestValues.get(a.id)
            return (
              <tr key={a.id} className={isInactive ? 'row-inactive' : ''}>
                <td>
                  <a
                    className="asset-name-link"
                    onClick={(e) => {
                      e.preventDefault()
                      navigate(`/assets/${a.id}`)
                    }}
                  >
                    {a.name}
                  </a>
                </td>
                <td>
                  <span className={`type-badge type-${a.type}`}>
                    {ASSET_TYPE_LABELS[a.type as keyof typeof ASSET_TYPE_LABELS] || a.type}
                  </span>
                </td>
                <td className="asset-profile-identifier">
                  {formatAssetProfileIdentifier(a)}
                </td>
                <td className="text-muted" style={{ fontSize: 13 }}>
                  {a.institution || '-'}
                </td>
                <td>
                  <span className="currency-tag">{a.currency}</span>
                </td>
                <td className="align-right">
                  {lv ? (
                    <MoneyDisplay value={lv.amount} currency={a.currency} showCurrency={false} />
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                {hasInvestmentCol &&
                  (isInvestmentType(a.type) ? (
                    <>
                      <td className="align-right">
                        <MoneyDisplay value={lv?.profit} isProfit />
                      </td>
                      <td className="align-right">
                        {lv?.profitRate !== undefined ? (
                          <span className={`money-display ${lv.profitRate >= 0 ? 'is-profit' : 'is-loss'}`}>
                            {lv.profitRate >= 0 ? '+' : ''}
                            {(lv.profitRate * 100).toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="align-right text-muted">-</td>
                      <td className="align-right text-muted">-</td>
                    </>
                  ))}
                <td className="text-muted" style={{ fontSize: 12, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.note || '-'}
                </td>
                <td>
                  <button className="btn-link" onClick={() => openEdit(a)}>
                    编辑
                  </button>
                  <button className="btn-link btn-link-danger" onClick={() => handleDeactivate(a)}>
                    停用
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <div className="assets-page">
      <div className="page-header">
        <div>
          <h1>资产管理</h1>
          <div className="page-stats">
            <span>启用 {activeCount}</span>
            {inactiveCount > 0 && <span>· 停用 {inactiveCount}</span>}
            <span>· {currencyList}</span>
          </div>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          + 新增资产
        </button>
      </div>

      {activeAssets.length === 0 && inactiveAssets.length === 0 && (
        <div className="empty-state">
          <p>暂无资产项。先新增资产，再录入快照。</p>
        </div>
      )}

      {activeAssets.length > 0 && (
        <div className="assets-section">
          <h3 className="section-title">已启用 ({activeCount})</h3>
          <div className="table-container">{renderTable(activeAssets, false)}</div>
        </div>
      )}

      {inactiveAssets.length > 0 && (
        <div className="assets-section">
          <h3 className="section-title">已停用 ({inactiveCount})</h3>
          <div className="table-container">{renderTable(inactiveAssets, true)}</div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? '编辑资产' : '新增资产'}</h2>
            <form onSubmit={handleSubmit}>
              <label className="form-label">名称 *</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <label className="form-label">类型 *</label>
              <select
                className="form-input"
                value={type}
                onChange={(e) => setType(e.target.value as AssetType)}
              >
                <option value="fund">基金</option>
                <option value="stock">股票</option>
                <option value="gold">黄金</option>
                <option value="deposit">存款</option>
                <option value="cash">现金</option>
                <option value="housing_fund">公积金</option>
                <option value="other">其他</option>
              </select>
              <label className="form-label">币种</label>
              <select
                className="form-input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                <option value="CNY">CNY ¥ 人民币</option>
                <option value="USD">USD $ 美元</option>
                <option value="HKD">HKD HK$ 港币</option>
              </select>
              <label className="form-label">平台/机构</label>
              <input
                type="text"
                className="form-input"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="如：蚂蚁财富、工商银行"
              />
              <label className="form-label">备注</label>
              <input
                type="text"
                className="form-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="profile-fields">
                <div className="profile-fields-title">类型档案</div>
                <div className="profile-field-grid">
                  {getAssetProfileFields(type).map((field) => (
                    <label className="profile-field" key={field.key}>
                      <span className="form-label">{field.label}</span>
                      <input
                        type={field.inputType || 'text'}
                        className="form-input"
                        value={profileDraft[field.key] || ''}
                        onChange={(e) => updateProfileDraft(field.key, e.target.value)}
                        placeholder={field.placeholder}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-buttons">
                <button type="submit" className="btn-primary">保存</button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

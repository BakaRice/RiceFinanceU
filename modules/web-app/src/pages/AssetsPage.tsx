import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Asset, AssetDcaPlan, AssetProfile, AssetProfileKey, AssetType, Currency, DcaFrequency, SnapshotValue } from '../types/finance'
import {
  ASSET_TYPE_LABELS,
  formatAssetProfileIdentifier,
  getAssetProfileFields,
  isInvestmentType,
  isRestrictedAssetType,
  sanitizeAssetProfile,
} from '../domain/assets'
import { DCA_FREQUENCY_LABELS, sanitizeDcaPlan } from '../domain/dca'
import { formatProfitRateInput } from '../domain/money'
import MoneyDisplay from '../components/MoneyDisplay'
import TableWorkspace from '../components/TableWorkspace'
import { useFeedback } from '../components/Feedback/FeedbackContext'
import './AssetsPage.css'

type SortKey = 'name' | 'type' | 'currency' | 'amount' | 'profit' | 'profitRate' | 'institution'

type AssetDraft = {
  id: string
  name: string
  type: AssetType
  institution: string
  currency: Currency
  isActive: boolean
  note: string
  original: Asset
}

function assetToDraft(asset: Asset): AssetDraft {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    institution: asset.institution || '',
    currency: asset.currency,
    isActive: asset.isActive,
    note: asset.note || '',
    original: asset,
  }
}

export default function AssetsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast, confirm } = useFeedback()

  const [assets, setAssets] = useState<Asset[]>([])
  const [drafts, setDrafts] = useState<AssetDraft[]>([])
  const [latestValues, setLatestValues] = useState<Map<string, SnapshotValue>>(new Map())
  const [savingDrafts, setSavingDrafts] = useState(false)
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
  const [dcaEnabled, setDcaEnabled] = useState(false)
  const [dcaFrequency, setDcaFrequency] = useState<DcaFrequency>('monthly')
  const [dcaExcludeWeekends, setDcaExcludeWeekends] = useState(true)
  const [dcaPlannedContribution, setDcaPlannedContribution] = useState('')
  const [dcaTargetAmount, setDcaTargetAmount] = useState('')
  const [dcaTargetDate, setDcaTargetDate] = useState('')
  const [dcaTolerancePercent, setDcaTolerancePercent] = useState('')
  const [dcaNote, setDcaNote] = useState('')
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
      setDrafts(allAssets.map(assetToDraft))
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
    resetDcaDraft()
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
    setDcaDraft(a.dcaPlan)
    setShowForm(true)
  }

  useEffect(() => {
    if (loading || showForm) return

    const editId = (location.state as { editId?: string } | null)?.editId
    if (!editId) return

    const target = assets.find((a) => a.id === editId)
    if (!target) return

    openEdit(target)
    navigate('/assets', { replace: true, state: null })
  }, [assets, loading, location.state, navigate, showForm])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const profile = sanitizeAssetProfile(type, profileDraft)
    const dcaPlan = buildDcaPlanPayload()
    const payload = {
      name,
      type,
      currency,
      institution: institution || undefined,
      note: note || undefined,
      // Send {} when the form has no usable dossier fields so editing can clear
      // an older profile instead of silently keeping hidden values on the server.
      profile: profile || {},
      ...(editingId
        ? { dcaPlan: dcaPlan || ({} as AssetDcaPlan) }
        : dcaPlan
          ? { dcaPlan }
          : {}),
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

  function resetDcaDraft() {
    setDcaEnabled(false)
    setDcaFrequency('monthly')
    setDcaExcludeWeekends(true)
    setDcaPlannedContribution('')
    setDcaTargetAmount('')
    setDcaTargetDate('')
    setDcaTolerancePercent('')
    setDcaNote('')
  }

  function setDcaDraft(plan: AssetDcaPlan | undefined) {
    if (!plan?.enabled) {
      resetDcaDraft()
      return
    }

    setDcaEnabled(true)
    setDcaFrequency(plan.frequency)
    setDcaExcludeWeekends(plan.excludeWeekends !== false)
    setDcaPlannedContribution(String(plan.plannedContribution))
    setDcaTargetAmount(plan.targetAmount === undefined ? '' : String(plan.targetAmount))
    setDcaTargetDate(plan.targetDate || '')
    setDcaTolerancePercent(
      plan.toleranceRate === undefined ? '' : String(plan.toleranceRate * 100),
    )
    setDcaNote(plan.note || '')
  }

  function buildDcaPlanPayload(): AssetDcaPlan | undefined {
    if (!dcaEnabled || !isInvestmentType(type)) return undefined

    return sanitizeDcaPlan(type, {
      enabled: true,
      frequency: dcaFrequency,
      excludeWeekends: dcaFrequency === 'daily' ? dcaExcludeWeekends : undefined,
      plannedContribution: dcaPlannedContribution,
      targetAmount: dcaTargetAmount,
      targetDate: dcaTargetDate,
      toleranceRate: dcaTolerancePercent === '' ? undefined : Number(dcaTolerancePercent) / 100,
      note: dcaNote,
    })
  }

  function isDraftDirty(draft: AssetDraft): boolean {
    return (
      draft.name !== draft.original.name ||
      draft.type !== draft.original.type ||
      draft.institution !== (draft.original.institution || '') ||
      draft.currency !== draft.original.currency ||
      draft.isActive !== draft.original.isActive ||
      draft.note !== (draft.original.note || '')
    )
  }

  function updateDraft<K extends keyof Omit<AssetDraft, 'id' | 'original'>>(
    id: string,
    key: K,
    value: AssetDraft[K],
  ) {
    setDrafts((current) => current.map((draft) => (
      draft.id === id ? { ...draft, [key]: value } : draft
    )))
  }

  const dirtyDrafts = drafts.filter(isDraftDirty)

  async function saveDrafts() {
    const invalidDraft = dirtyDrafts.find((draft) => !draft.name.trim())
    if (invalidDraft) {
      toast('资产名称不能为空', 'error')
      return
    }

    setSavingDrafts(true)
    try {
      for (const draft of dirtyDrafts) {
        await api.updateAsset(draft.id, {
          name: draft.name.trim(),
          type: draft.type,
          institution: draft.institution.trim() || undefined,
          currency: draft.currency,
          isActive: draft.isActive,
          note: draft.note.trim() || undefined,
        })
      }
      toast(`已保存 ${dirtyDrafts.length} 项资产修改`)
      await load()
    } catch (e: any) {
      toast('保存失败: ' + e.message, 'error')
    } finally {
      setSavingDrafts(false)
    }
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

  const draftsById = new Map(drafts.map((draft) => [draft.id, draft]))
  const sortedDrafts = sortAssets(assets)
    .map((asset) => draftsById.get(asset.id))
    .filter((draft): draft is AssetDraft => Boolean(draft))

  function renderAssetTable() {
    return (
      <table className="fin-table assets-table" aria-label="资产表">
        <thead>
          <tr>
            <th className="sortable" onClick={() => toggleSort('name')}>名称 {sortIcon('name')}</th>
            <th className="sortable" onClick={() => toggleSort('type')}>类型 {sortIcon('type')}</th>
            <th>标识</th>
            <th className="sortable" onClick={() => toggleSort('institution')}>机构 {sortIcon('institution')}</th>
            <th className="sortable" onClick={() => toggleSort('currency')}>币种 {sortIcon('currency')}</th>
            <th className="sortable align-right" onClick={() => toggleSort('amount')}>最新金额 {sortIcon('amount')}</th>
            <th className="sortable align-right" onClick={() => toggleSort('profit')}>收益 {sortIcon('profit')}</th>
            <th className="sortable align-right" onClick={() => toggleSort('profitRate')}>收益率 {sortIcon('profitRate')}</th>
            <th>状态</th>
            <th>备注</th>
            <th>更多</th>
          </tr>
        </thead>
        <tbody>
          {sortedDrafts.map((draft) => {
            const latest = latestValues.get(draft.id)
            const investment = isInvestmentType(draft.type)
            return (
              <tr key={draft.id} className={`${draft.isActive ? '' : 'row-inactive'} ${isDraftDirty(draft) ? 'is-dirty' : ''}`.trim()}>
                <td className="asset-edit-cell asset-name-edit-cell">
                  <input
                    aria-label={`${draft.original.name} 名称`}
                    value={draft.name}
                    onChange={(event) => updateDraft(draft.id, 'name', event.target.value)}
                  />
                  <a
                    className="asset-detail-link"
                    href={`/assets/${draft.id}`}
                    aria-label={draft.original.name}
                    onClick={(event) => {
                      event.preventDefault()
                      navigate(`/assets/${draft.id}`)
                    }}
                  >
                    ↗
                  </a>
                  {draft.original.dcaPlan?.enabled && <span className="asset-dca-tag">定投</span>}
                </td>
                <td className="asset-edit-cell asset-type-cell">
                  <select
                    aria-label={`${draft.original.name} 类型`}
                    value={draft.type}
                    onChange={(event) => updateDraft(draft.id, 'type', event.target.value as AssetType)}
                  >
                    {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                  {isRestrictedAssetType(draft.type) && (
                    <span className="asset-restricted-marker">
                      <span>受限资产</span>
                      <small>不可随意提取</small>
                    </span>
                  )}
                </td>
                <td className="asset-profile-identifier is-readonly">
                  {formatAssetProfileIdentifier(draft.original)}
                </td>
                <td className="asset-edit-cell">
                  <input
                    aria-label={`${draft.original.name} 机构`}
                    value={draft.institution}
                    onChange={(event) => updateDraft(draft.id, 'institution', event.target.value)}
                  />
                </td>
                <td className="asset-edit-cell">
                  <select
                    aria-label={`${draft.original.name} 币种`}
                    value={draft.currency}
                    onChange={(event) => updateDraft(draft.id, 'currency', event.target.value as Currency)}
                  >
                    <option value="CNY">CNY</option>
                    <option value="USD">USD</option>
                    <option value="HKD">HKD</option>
                  </select>
                </td>
                <td className="align-right asset-amount-cell is-readonly">
                  {latest ? <MoneyDisplay value={latest.amount} currency={draft.currency} showCurrency={false} /> : <span className="text-muted">-</span>}
                </td>
                <td className="align-right is-readonly">
                  {investment ? <MoneyDisplay value={latest?.profit} isProfit /> : <span className="text-muted">-</span>}
                </td>
                <td className="align-right is-readonly">
                  {investment && latest?.profitRate !== undefined ? (
                    <span className={`money-display ${latest.profitRate >= 0 ? 'is-profit' : 'is-loss'}`}>
                      {latest.profitRate >= 0 ? '+' : ''}{formatProfitRateInput(latest.profitRate)}%
                    </span>
                  ) : <span className="text-muted">-</span>}
                </td>
                <td className="asset-edit-cell">
                  <select
                    aria-label={`${draft.original.name} 状态`}
                    value={draft.isActive ? 'active' : 'inactive'}
                    onChange={(event) => updateDraft(draft.id, 'isActive', event.target.value === 'active')}
                  >
                    <option value="active">启用</option>
                    <option value="inactive">停用</option>
                  </select>
                </td>
                <td className="asset-edit-cell">
                  <input
                    aria-label={`${draft.original.name} 备注`}
                    value={draft.note}
                    onChange={(event) => updateDraft(draft.id, 'note', event.target.value)}
                  />
                </td>
                <td className="asset-actions">
                  <button className="btn-link" aria-label={`编辑 ${draft.original.name}`} onClick={() => openEdit(draft.original)}>档案</button>
                  {draft.original.isActive && (
                    <button className="btn-link btn-link-danger" aria-label={`停用 ${draft.original.name}`} onClick={() => handleDeactivate(draft.original)}>停用</button>
                  )}
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
      <TableWorkspace
        title="资产"
        description="一行一个资产；金额、收益和收益率来自最新快照"
        dirtyCount={dirtyDrafts.length}
        saving={savingDrafts}
        primaryActionLabel={savingDrafts ? '保存中…' : '保存资产'}
        onPrimaryAction={saveDrafts}
        secondaryActions={<button className="btn-secondary" type="button" onClick={openCreate}>新增资产</button>}
      >
        {sortedDrafts.length > 0 ? renderAssetTable() : (
          <div className="empty-state"><p>暂无资产项。先新增资产，再录入快照。</p></div>
        )}
      </TableWorkspace>

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
              {isRestrictedAssetType(type) && (
                <p className="asset-restricted-form-note">
                  受限资产：这类余额纳入总资产，但通常不可随意提取或日常使用。
                </p>
              )}
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
                  {/* The field list follows the selected asset type. Hidden fields
                      are still cleaned again by sanitizeAssetProfile before save. */}
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
              {isInvestmentType(type) && (
                <div className="dca-fields">
                  <div className="profile-fields-title">定投计划</div>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={dcaEnabled}
                      onChange={(e) => setDcaEnabled(e.target.checked)}
                    />
                    <span>启用定投计划</span>
                  </label>
                  {dcaEnabled && (
                    <>
                      <div className="profile-field-grid">
                        <label className="profile-field" htmlFor="dca-frequency">
                          <span className="form-label">定投周期</span>
                          <select
                            id="dca-frequency"
                            className="form-input"
                            value={dcaFrequency}
                            onChange={(e) => setDcaFrequency(e.target.value as DcaFrequency)}
                          >
                            {Object.entries(DCA_FREQUENCY_LABELS).map(([value, label]) => (
                              <option value={value} key={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="profile-field" htmlFor="dca-planned-contribution">
                          <span className="form-label">每期计划投入</span>
                          <input
                            id="dca-planned-contribution"
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input"
                            value={dcaPlannedContribution}
                            onChange={(e) => setDcaPlannedContribution(e.target.value)}
                            required={dcaEnabled}
                          />
                        </label>
                        <label className="profile-field" htmlFor="dca-target-amount">
                          <span className="form-label">目标金额</span>
                          <input
                            id="dca-target-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input"
                            value={dcaTargetAmount}
                            onChange={(e) => setDcaTargetAmount(e.target.value)}
                          />
                        </label>
                        <label className="profile-field" htmlFor="dca-target-date">
                          <span className="form-label">目标日期</span>
                          <input
                            id="dca-target-date"
                            type="date"
                            className="form-input"
                            value={dcaTargetDate}
                            onChange={(e) => setDcaTargetDate(e.target.value)}
                          />
                        </label>
                        <label className="profile-field" htmlFor="dca-tolerance">
                          <span className="form-label">容忍偏差 (%)</span>
                          <input
                            id="dca-tolerance"
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input"
                            value={dcaTolerancePercent}
                            onChange={(e) => setDcaTolerancePercent(e.target.value)}
                            placeholder="默认 20"
                          />
                        </label>
                        <label className="profile-field" htmlFor="dca-note">
                          <span className="form-label">定投备注</span>
                          <input
                            id="dca-note"
                            type="text"
                            className="form-input"
                            value={dcaNote}
                            onChange={(e) => setDcaNote(e.target.value)}
                            placeholder="如：工资到账后投入"
                          />
                        </label>
                      </div>
                      {dcaFrequency === 'daily' && (
                        <label className="checkbox-row dca-weekend-row">
                          <input
                            type="checkbox"
                            checked={dcaExcludeWeekends}
                            onChange={(e) => setDcaExcludeWeekends(e.target.checked)}
                          />
                          <span>排除周末</span>
                        </label>
                      )}
                    </>
                  )}
                </div>
              )}
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

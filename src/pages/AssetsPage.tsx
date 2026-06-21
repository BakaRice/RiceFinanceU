import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { Asset, AssetType, Currency, SnapshotValue } from '../types/finance'
import { CURRENCY_SYMBOLS } from '../types/finance'
import { ASSET_TYPE_LABELS, isInvestmentType } from '../domain/assets'
import { formatMoney } from '../domain/money'
import './AssetsPage.css'

export default function AssetsPage() {
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

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError(null)
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
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  function openCreate() {
    setEditingId(null)
    setName(''); setType('fund'); setCurrency('CNY'); setInstitution(''); setNote('')
    setShowForm(true)
  }

  function openEdit(a: Asset) {
    setEditingId(a.id)
    setName(a.name); setType(a.type); setCurrency(a.currency); setInstitution(a.institution || ''); setNote(a.note || '')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingId) {
        await api.updateAsset(editingId, { name, type, currency, institution: institution || undefined, note: note || undefined } as any)
      } else {
        await api.createAsset({ name, type, currency, institution: institution || undefined, note: note || undefined } as any)
      }
      setShowForm(false)
      load()
    } catch (e: any) { alert('保存失败: ' + e.message) }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要停用这个资产项吗？停用后仍可在历史快照中查看。')) return
    try { await api.deleteAsset(id); load() } catch (e: any) { alert('删除失败: ' + e.message) }
  }

  if (loading) return <div className="page-loading">加载中...</div>
  if (error) return <div className="page-error"><p>{error}</p><button onClick={load}>重试</button></div>

  const activeAssets = assets.filter((a) => a.isActive)
  const inactiveAssets = assets.filter((a) => !a.isActive)

  function renderTable(assetList: Asset[], isInactive: boolean) {
    return (
      <table className="assets-table">
        <thead><tr>
          <th>名称</th><th>类型</th><th>币种</th><th>平台/机构</th>
          <th>最新金额</th>
          {assetList.some((a) => isInvestmentType(a.type)) && <><th>收益</th><th>收益率</th></>}
          <th>备注</th><th>操作</th>
        </tr></thead>
        <tbody>
          {assetList.map((a) => {
            const lv = latestValues.get(a.id)
            const hasInvestmentCol = assetList.some((x) => isInvestmentType(x.type))
            const sym = CURRENCY_SYMBOLS[a.currency] || '¥'
            return (
              <tr key={a.id} className={isInactive ? 'inactive-row' : ''}>
                <td className="asset-name">{a.name}</td>
                <td>
                  <span className={`type-badge type-${a.type}`}>
                    {ASSET_TYPE_LABELS[a.type] || a.type}
                  </span>
                  {isInvestmentType(a.type) && <span className="invest-tag">投资</span>}
                </td>
                <td><span className="currency-badge">{a.currency}</span></td>
                <td>{a.institution || '-'}</td>
                <td className="amount-cell">{lv ? `${sym}${formatMoney(lv.amount)}` : '-'}</td>
                {hasInvestmentCol && (
                  isInvestmentType(a.type) ? (
                    <>
                      <td className={`amount-cell ${(lv?.profit || 0) >= 0 ? 'profit' : 'loss'}`}>
                        {lv?.profit !== undefined ? ((lv.profit >= 0 ? '+' : '') + formatMoney(lv.profit)) : '-'}
                      </td>
                      <td className="amount-cell">
                        {lv?.profitRate !== undefined ? `${(lv.profitRate * 100).toFixed(2)}%` : '-'}
                      </td>
                    </>
                  ) : (
                    <><td className="amount-cell muted">-</td><td className="amount-cell muted">-</td></>
                  )
                )}
                <td className="asset-note">{a.note || '-'}</td>
                <td>
                  <button className="btn-link" onClick={() => openEdit(a)}>编辑</button>
                  <button className="btn-link btn-link-danger" onClick={() => handleDelete(a.id)}>停用</button>
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
      <div className="assets-header">
        <h1>资产项</h1>
        <button className="btn-primary" onClick={openCreate}>+ 新增资产</button>
      </div>

      <p className="assets-hint">资产项是你需要长期追踪的明细标的或账户。金额和收益来自最新快照。</p>

      {activeAssets.length === 0 && inactiveAssets.length === 0 && (
        <div className="empty-state"><p>暂无资产项</p></div>
      )}

      {activeAssets.length > 0 && (
        <div className="assets-table-container">
          <h3>已启用 ({activeAssets.length})</h3>
          {renderTable(activeAssets, false)}
        </div>
      )}

      {inactiveAssets.length > 0 && (
        <div className="assets-table-container inactive-section">
          <h3>已停用 ({inactiveAssets.length})</h3>
          {renderTable(inactiveAssets, true)}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? '编辑资产' : '新增资产'}</h2>
            <form onSubmit={handleSubmit}>
              <label>名称 *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              <label>类型 *</label>
              <select value={type} onChange={(e) => setType(e.target.value as AssetType)}>
                <option value="fund">基金</option>
                <option value="stock">股票</option>
                <option value="gold">黄金</option>
                <option value="deposit">存款</option>
                <option value="cash">现金</option>
                <option value="housing_fund">公积金</option>
                <option value="other">其他</option>
              </select>
              <label>币种</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                <option value="CNY">CNY ¥ 人民币</option>
                <option value="USD">USD $ 美元</option>
                <option value="HKD">HKD HK$ 港币</option>
              </select>
              <label>平台/机构</label>
              <input type="text" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="如：蚂蚁财富、工商银行" />
              <label>备注</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="form-buttons">
                <button type="submit" className="btn-primary">保存</button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

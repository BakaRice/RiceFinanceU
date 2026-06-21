import { useState, useEffect } from 'react'
import { api } from '../api/client'
import SnapshotForm from '../components/SnapshotForm'
import type { Snapshot } from '../types/finance'
import './EntryPage.css'

export default function EntryPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]); const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null); const [importing, setImporting] = useState(false)
  const [showImportConfirm, setShowImportConfirm] = useState(false); const [importData, setImportData] = useState<any>(null)
  async function load() {
    setLoading(true); setError(null)
    try { setSnapshots(await api.getSnapshots()) } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function handleExport() {
    try {
      const data = await api.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `finance-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { alert('导出失败: ' + e.message) }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        setImportData(data)
        const version = data.meta?.schemaVersion
        if (version === 1 || version === 2) setShowImportConfirm(true)
        else alert('备份文件格式不正确或不支持的版本')
      } catch { alert('无法解析 JSON 文件') }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!importData) return; setImporting(true)
    try { await api.importData(importData); setShowImportConfirm(false); setImportData(null); load(); alert('数据导入成功！') } catch (e: any) { alert('导入失败: ' + e.message) } finally { setImporting(false) }
  }

  function formatSnapshotLabel(s: Snapshot): string {
    const d = new Date(s.recordedAt)
    return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <div className="page-loading">加载中...</div>
  if (error) return <div className="page-error"><p>{error}</p><button onClick={load}>重试</button></div>

  return (
    <div className="entry-page">
      <h1>录入</h1>
      <div className="entry-layout">
        <div className="entry-form-col">
          <SnapshotForm onSuccess={load} />
        </div>

        <div className="entry-side-col">
          <div className="backup-section">
            <h3>数据备份</h3>
            <button className="btn-secondary" onClick={handleExport}>导出 JSON 备份</button>
            <div style={{ marginTop: 10 }}>
              <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                导入 JSON 备份
                <input type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          <div className="recent-tx">
            <h3>最近快照</h3>
            {snapshots.slice(0, 10).map((s) => (
              <div key={s.id} className="tx-row">
                <span className="tx-time">{formatSnapshotLabel(s)}</span>
                <span className="tx-type-badge">{s.note || '快照'}</span>
              </div>
            ))}
            {snapshots.length === 0 && <p className="tx-empty">暂无快照记录</p>}
          </div>
        </div>
      </div>

      {showImportConfirm && (
        <div className="modal-overlay" onClick={() => setShowImportConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>确认导入</h2>
            <p>即将覆盖当前所有数据，此操作不可撤销。</p>
            <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>
              Schema v{importData?.meta?.schemaVersion} |
              资产: {importData?.assets?.length || importData?.deposits?.length || 0} |
              快照: {importData?.snapshots?.length || importData?.transactions?.length || 0}
            </p>
            <div className="form-buttons">
              <button className="btn-danger" onClick={handleImport} disabled={importing}>
                {importing ? '导入中...' : '确认导入'}
              </button>
              <button className="btn-secondary" onClick={() => { setShowImportConfirm(false); setImportData(null) }}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

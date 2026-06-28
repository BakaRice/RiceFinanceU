import { useState } from 'react'
import { api } from '../api/client'
import './DataManagementPage.css'

export default function DataManagementPage() {
  const [importing, setImporting] = useState(false)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
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
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        setImportData(data)
        const version = data.meta?.schemaVersion
        if (version === 1 || version === 2) setShowImportConfirm(true)
        else alert('备份文件格式不正确或不支持的版本')
      } catch {
        alert('无法解析 JSON 文件')
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!importData) return
    setImporting(true)
    try {
      await api.importData(importData)
      setShowImportConfirm(false)
      setImportData(null)
      alert('数据导入成功！')
    } catch (e: any) {
      alert('导入失败: ' + e.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="data-page">
      <h1>数据管理</h1>
      <section className="data-section">
        <h3>JSON 备份</h3>
        <button className="btn-secondary" onClick={handleExport}>导出 JSON 备份</button>
        <label className="btn-secondary data-import-button">
          导入 JSON 备份
          <input type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />
        </label>
      </section>

      {showImportConfirm && (
        <div className="modal-overlay" onClick={() => setShowImportConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>确认导入</h2>
            <p>即将覆盖当前所有数据，此操作不可撤销。</p>
            <p className="data-import-summary">
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

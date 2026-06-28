import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import SnapshotForm from '../components/SnapshotForm'
import type { Snapshot } from '../types/finance'
import './EntryPage.css'

export default function EntryPage() {
  const navigate = useNavigate()
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]); const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  async function load() {
    setLoading(true); setError(null)
    try { setSnapshots(await api.getSnapshots()) } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function formatSnapshotLabel(s: Snapshot): string {
    const d = new Date(s.recordedAt)
    return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <div className="page-loading">加载中...</div>
  if (error) return <div className="page-error"><p>{error}</p><button onClick={load}>重试</button></div>

  return (
    <div className="entry-page">
      <h1>快照录入</h1>
      <div className="entry-layout">
        <div className="entry-form-col">
          <SnapshotForm onSuccess={load} onManageAssets={() => navigate('/assets')} />
        </div>

        <div className="entry-side-col">
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
    </div>
  )
}

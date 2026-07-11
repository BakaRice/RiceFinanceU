import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useFeedback } from '../components/Feedback/FeedbackContext'
import TableWorkspace from '../components/TableWorkspace'
import type { ExchangeRates } from '../types/finance'
import './ExchangeRatesPage.css'

const DEFAULT_RATES: ExchangeRates = { USD: 7.2, HKD: 0.92, updatedAt: '' }

export default function ExchangeRatesPage() {
  const { toast } = useFeedback()
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_RATES)
  const [usdRate, setUsdRate] = useState(String(DEFAULT_RATES.USD))
  const [hkdRate, setHkdRate] = useState(String(DEFAULT_RATES.HKD))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const nextRates = await api.getRates()
      setRates(nextRates)
      setUsdRate(String(nextRates.USD))
      setHkdRate(String(nextRates.HKD))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const dirtyCount = Number(Number(usdRate) !== rates.USD) + Number(Number(hkdRate) !== rates.HKD)
  const rows = [
    { currency: 'USD' as const, value: usdRate },
    { currency: 'HKD' as const, value: hkdRate },
  ]

  async function saveRates() {
    const nextUsd = Number(usdRate)
    const nextHkd = Number(hkdRate)
    if (!Number.isFinite(nextUsd) || nextUsd <= 0 || !Number.isFinite(nextHkd) || nextHkd <= 0) {
      toast('汇率必须是大于 0 的数字', 'error')
      return
    }

    setSaving(true)
    try {
      const saved = await api.updateRates({ USD: nextUsd, HKD: nextHkd })
      setRates(saved)
      setUsdRate(String(saved.USD))
      setHkdRate(String(saved.HKD))
      toast('汇率已保存')
    } catch (e: any) {
      toast('保存失败: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page-loading">加载中...</div>
  if (error) return <div className="page-error"><p>{error}</p><button onClick={load}>重试</button></div>

  return (
    <TableWorkspace
      title="汇率"
      description="1 单位外币可兑换的人民币金额"
      dirtyCount={dirtyCount}
      saving={saving}
      primaryActionLabel={saving ? '保存中…' : '保存汇率'}
      onPrimaryAction={saveRates}
    >
      <table className="fin-table rates-table" aria-label="汇率表">
        <thead>
          <tr><th>币种</th><th>对人民币汇率</th><th>更新时间</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.currency} className={Number(row.value) !== rates[row.currency] ? 'is-dirty' : ''}>
              <td className="is-readonly rates-currency">{row.currency}</td>
              <td className="rates-edit-cell">
                <input
                  aria-label={`${row.currency} 对人民币汇率`}
                  inputMode="decimal"
                  value={row.value}
                  onChange={(event) => row.currency === 'USD'
                    ? setUsdRate(event.target.value)
                    : setHkdRate(event.target.value)}
                />
              </td>
              <td className="is-readonly rates-updated-at">
                {rates.updatedAt ? new Date(rates.updatedAt).toLocaleString('zh-CN') : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWorkspace>
  )
}

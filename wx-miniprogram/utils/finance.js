const ASSET_TYPE_LABELS = {
  fund: '基金',
  stock: '股票',
  gold: '黄金',
  deposit: '存款',
  cash: '现金',
  housing_fund: '公积金',
  other: '其他',
}

const DEFAULT_RATES = {
  USD: 7.2,
  HKD: 0.92,
  updatedAt: '',
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100
}

function roundRate(value) {
  return Math.round(Number(value) * 10000) / 10000
}

function isInvestmentType(type) {
  return type === 'fund' || type === 'stock' || type === 'gold'
}

function getAssetTypeLabel(type) {
  return ASSET_TYPE_LABELS[type] || '其他'
}

function formatPlainNumber(value) {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return ''
  return String(Number(value))
}

function formatMoney(value) {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return '-'
  const number = Number(value)
  const sign = number < 0 ? '-' : ''
  const parts = Math.abs(number).toFixed(2).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${parts[0]}.${parts[1]}`
}

function formatPercent(value) {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return '-'
  return `${(Number(value) * 100).toFixed(2)}%`
}

function convertToCNY(amount, currency, rates) {
  const currentRates = rates || DEFAULT_RATES
  if (currency === 'USD') return roundMoney(Number(amount) * Number(currentRates.USD || DEFAULT_RATES.USD))
  if (currency === 'HKD') return roundMoney(Number(amount) * Number(currentRates.HKD || DEFAULT_RATES.HKD))
  return roundMoney(Number(amount))
}

function calculateSnapshotTotal(values, assets, rates) {
  const assetMap = new Map((assets || []).map((asset) => [asset.id, asset]))
  const total = {
    totalAmountCNY: 0,
    investmentAmountCNY: 0,
    balanceAmountCNY: 0,
    totalProfitCNY: 0,
    valueCount: 0,
  }

  for (const value of values || []) {
    const asset = assetMap.get(value.assetId)
    const currency = asset && asset.currency ? asset.currency : 'CNY'
    const amountCNY = convertToCNY(value.amount, currency, rates)
    total.totalAmountCNY += amountCNY
    total.valueCount += 1

    if (asset && isInvestmentType(asset.type)) {
      total.investmentAmountCNY += amountCNY
      if (value.profit !== undefined && Number.isFinite(Number(value.profit))) {
        total.totalProfitCNY += convertToCNY(value.profit, currency, rates)
      }
    } else {
      total.balanceAmountCNY += amountCNY
    }
  }

  return {
    totalAmountCNY: roundMoney(total.totalAmountCNY),
    investmentAmountCNY: roundMoney(total.investmentAmountCNY),
    balanceAmountCNY: roundMoney(total.balanceAmountCNY),
    totalProfitCNY: roundMoney(total.totalProfitCNY),
    valueCount: total.valueCount,
  }
}

function buildValueMap(latestData) {
  const values = latestData && Array.isArray(latestData.values) ? latestData.values : []
  const map = new Map()
  for (const value of values) {
    map.set(value.assetId, value)
  }
  return map
}

function buildEntryRows(assets, latestData) {
  const latestValues = buildValueMap(latestData)
  const rows = (assets || [])
    .filter((asset) => asset.isActive)
    .map((asset) => {
      const previous = latestValues.get(asset.id)
      return {
        assetId: asset.id,
        name: asset.name,
        type: asset.type,
        typeLabel: getAssetTypeLabel(asset.type),
        currency: asset.currency || 'CNY',
        amount: formatPlainNumber(previous && previous.amount),
        profit: formatPlainNumber(previous && previous.profit),
        profitRate: previous && previous.profitRate !== undefined
          ? formatPlainNumber(Number(previous.profitRate) * 100)
          : '',
        included: Boolean(previous),
      }
    })

  rows.sort((left, right) => {
    const leftAmount = Number(left.amount)
    const rightAmount = Number(right.amount)
    if (!Number.isFinite(leftAmount) && !Number.isFinite(rightAmount)) return 0
    if (!Number.isFinite(leftAmount)) return 1
    if (!Number.isFinite(rightAmount)) return -1
    return rightAmount - leftAmount
  })

  return rows
}

function isValidAmount(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value || ''))) return false
  return Number.isFinite(Number(value)) && Number(value) >= 0
}

function isValidSignedMoney(value) {
  if (!/^-?\d+(\.\d{1,2})?$/.test(String(value || ''))) return false
  return Number.isFinite(Number(value))
}

function isValidPercent(value) {
  if (!/^-?\d+(\.\d{1,2})?$/.test(String(value || ''))) return false
  return Number.isFinite(Number(value)) && Number(value) >= -100
}

function buildRecordedAt(recordedDate, recordedTime) {
  const date = String(recordedDate || '').trim()
  const time = String(recordedTime || '00:00').trim() || '00:00'
  const parsed = new Date(`${date}T${time}:00`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('快照时间无效')
  }
  return parsed.toISOString()
}

function buildSnapshotPayload(input) {
  const rows = (input.rows || []).filter((row) => row.included)
  if (rows.length === 0) {
    throw new Error('请至少选择一个资产项')
  }

  const values = rows.map((row) => {
    if (!isValidAmount(row.amount)) {
      throw new Error(`资产 "${row.name}" 的金额无效`)
    }

    const value = {
      assetId: row.assetId,
      amount: roundMoney(row.amount),
    }

    if (isInvestmentType(row.type)) {
      if (row.profit !== undefined && row.profit !== '') {
        if (!isValidSignedMoney(row.profit)) {
          throw new Error(`资产 "${row.name}" 的收益无效`)
        }
        value.profit = roundMoney(row.profit)
      }

      if (row.profitRate !== undefined && row.profitRate !== '') {
        if (!isValidPercent(row.profitRate)) {
          throw new Error(`资产 "${row.name}" 的收益率无效`)
        }
        value.profitRate = roundRate(Number(row.profitRate) / 100)
      }
    }

    return value
  })

  const note = String(input.note || '').trim()
  const payload = {
    recordedAt: buildRecordedAt(input.recordedDate, input.recordedTime),
    values,
  }

  if (note) payload.note = note
  return payload
}

function formatDateTimeLabel(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

module.exports = {
  ASSET_TYPE_LABELS,
  calculateSnapshotTotal,
  buildEntryRows,
  buildSnapshotPayload,
  convertToCNY,
  formatDateTimeLabel,
  formatMoney,
  formatPercent,
  getAssetTypeLabel,
  isInvestmentType,
  roundRate,
  roundMoney,
}

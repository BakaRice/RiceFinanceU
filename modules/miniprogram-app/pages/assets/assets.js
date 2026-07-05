const api = require('../../utils/api')
const session = require('../../utils/session')
const finance = require('../../utils/finance')

const ASSET_TYPE_OPTIONS = [
  { label: '基金', value: 'fund' },
  { label: '股票', value: 'stock' },
  { label: '黄金', value: 'gold' },
  { label: '存款', value: 'deposit' },
  { label: '现金', value: 'cash' },
  { label: '公积金', value: 'housing_fund' },
  { label: '其他', value: 'other' },
]

const CURRENCY_OPTIONS = [
  { label: 'CNY', value: 'CNY' },
  { label: 'USD', value: 'USD' },
  { label: 'HKD', value: 'HKD' },
]

function buildValueMap(latestData) {
  const values = latestData && Array.isArray(latestData.values) ? latestData.values : []
  const map = new Map()
  values.forEach((value) => {
    map.set(value.assetId, value)
  })
  return map
}

function findOptionIndex(options, value) {
  const index = options.findIndex((option) => option.value === value)
  return index >= 0 ? index : 0
}

function formatProfitRate(value) {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return '-'
  return `${(Number(value) * 100).toFixed(2)}%`
}

function buildAssetRows(assets, latestData) {
  const valueMap = buildValueMap(latestData)
  return (assets || []).map((asset) => {
    const latest = valueMap.get(asset.id)
    const profit = latest && latest.profit !== undefined ? Number(latest.profit) : null
    return {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      typeLabel: finance.getAssetTypeLabel(asset.type),
      currency: asset.currency || 'CNY',
      institution: asset.institution || '-',
      note: asset.note || '',
      isActive: asset.isActive,
      amountText: latest ? finance.formatMoney(latest.amount) : '-',
      profitText: profit === null ? '-' : finance.formatMoney(profit),
      profitTone: profit === null || profit === 0 ? 'neutral' : profit > 0 ? 'profit' : 'loss',
      profitRateText: latest ? formatProfitRate(latest.profitRate) : '-',
      raw: asset,
    }
  })
}

Component({
  data: {
    loading: true,
    error: '',
    activeRows: [],
    inactiveRows: [],
    activeCount: 0,
    inactiveCount: 0,
    currencyLabel: '-',
    showForm: false,
    formTitle: '新增资产',
    editingId: '',
    assetTypeOptions: ASSET_TYPE_OPTIONS,
    currencyOptions: CURRENCY_OPTIONS,
    typeIndex: 0,
    currencyIndex: 0,
    name: '',
    institution: '',
    note: '',
    saving: false,
  },

  lifetimes: {
    attached() {
      this.loadIfAuthenticated()
    },
  },

  pageLifetimes: {
    show() {
      this.loadIfAuthenticated()
    },
  },

  methods: {
    loadIfAuthenticated() {
      if (!session.hasSessionToken()) {
        wx.redirectTo({ url: '/pages/login/login' })
        return Promise.resolve()
      }
      if (this._assetsLoadPromise) return this._assetsLoadPromise
      this._assetsLoadPromise = this.load().finally(() => {
        this._assetsLoadPromise = null
      })
      return this._assetsLoadPromise
    },

    onPullDownRefresh() {
      this.loadIfAuthenticated().finally(() => {
        wx.stopPullDownRefresh()
      })
    },

    async load() {
      this.setData({ loading: true, error: '' })
      try {
        const [assets, latestData] = await Promise.all([
          api.getAssets(),
          api.getLatestSnapshot(),
        ])
        const rows = buildAssetRows(assets, latestData)
        const activeRows = rows.filter((row) => row.isActive)
        const inactiveRows = rows.filter((row) => !row.isActive)
        const currencySet = new Set((assets || []).map((asset) => asset.currency || 'CNY'))

        this.setData({
          loading: false,
          activeRows,
          inactiveRows,
          activeCount: activeRows.length,
          inactiveCount: inactiveRows.length,
          currencyLabel: Array.from(currencySet).join('/') || '-',
        })
      } catch (error) {
        this.setData({
          loading: false,
          error: error.message || '加载失败',
        })
      }
    },

    openCreate() {
      this.setData({
        showForm: true,
        formTitle: '新增资产',
        editingId: '',
        name: '',
        typeIndex: 0,
        currencyIndex: 0,
        institution: '',
        note: '',
      })
    },

    openEdit(event) {
      const row = this.findRow(event.currentTarget.dataset.id)
      if (!row) return
      const asset = row.raw
      this.setData({
        showForm: true,
        formTitle: '编辑资产',
        editingId: asset.id,
        name: asset.name,
        typeIndex: findOptionIndex(ASSET_TYPE_OPTIONS, asset.type),
        currencyIndex: findOptionIndex(CURRENCY_OPTIONS, asset.currency),
        institution: asset.institution || '',
        note: asset.note || '',
      })
    },

    closeForm() {
      this.setData({ showForm: false })
    },

    findRow(id) {
      return [...this.data.activeRows, ...this.data.inactiveRows].find((row) => row.id === id)
    },

    onNameInput(event) {
      this.setData({ name: event.detail.value })
    },

    onInstitutionInput(event) {
      this.setData({ institution: event.detail.value })
    },

    onNoteInput(event) {
      this.setData({ note: event.detail.value })
    },

    onTypeChange(event) {
      this.setData({ typeIndex: Number(event.detail.value) })
    },

    onCurrencyChange(event) {
      this.setData({ currencyIndex: Number(event.detail.value) })
    },

    async handleSave() {
      if (this.data.saving) return
      const name = this.data.name.trim()
      if (!name) {
        wx.showToast({ title: '请输入名称', icon: 'none' })
        return
      }

      const payload = {
        name,
        type: ASSET_TYPE_OPTIONS[this.data.typeIndex].value,
        currency: CURRENCY_OPTIONS[this.data.currencyIndex].value,
        institution: this.data.institution.trim() || undefined,
        note: this.data.note.trim() || undefined,
      }

      this.setData({ saving: true })
      try {
        if (this.data.editingId) {
          await api.updateAsset(this.data.editingId, payload)
          wx.showToast({ title: '已更新', icon: 'success' })
        } else {
          await api.createAsset(payload)
          wx.showToast({ title: '已创建', icon: 'success' })
        }
        this.setData({ showForm: false })
        await this.load()
      } catch (error) {
        wx.showToast({ title: error.message || '保存失败', icon: 'none' })
      } finally {
        this.setData({ saving: false })
      }
    },

    handleDeactivate(event) {
      const row = this.findRow(event.currentTarget.dataset.id)
      if (!row) return
      wx.showModal({
        title: '停用资产',
        content: row.name,
        confirmText: '停用',
        confirmColor: '#c0392b',
        success: async (res) => {
          if (!res.confirm) return
          try {
            await api.deleteAsset(row.id)
            wx.showToast({ title: '已停用', icon: 'success' })
            await this.load()
          } catch (error) {
            wx.showToast({ title: error.message || '操作失败', icon: 'none' })
          }
        },
      })
    },

    handleRefresh() {
      this.loadIfAuthenticated()
    },

    noop() {},
  },
})

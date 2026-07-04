const api = require('../../utils/api')
const session = require('../../utils/session')
const finance = require('../../utils/finance')

function buildValueMap(latestData) {
  const values = latestData && Array.isArray(latestData.values) ? latestData.values : []
  const map = new Map()
  values.forEach((value) => {
    map.set(value.assetId, value)
  })
  return map
}

function buildMoneyParts(value, prefix) {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) {
    return {
      prefix: '',
      main: '-',
      decimal: '',
    }
  }

  const [main, decimal] = finance.formatMoney(value).split('.')
  return {
    prefix: prefix || '',
    main,
    decimal: decimal ? `.${decimal}` : '',
  }
}

function getSignedTone(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return 'neutral'
  return number > 0 ? 'profit' : 'loss'
}

function buildAssetRows(assets, latestData, rates) {
  const valueMap = buildValueMap(latestData)
  return assets
    .filter((asset) => asset.isActive)
    .map((asset) => {
      const value = valueMap.get(asset.id)
      const amount = value ? Number(value.amount) : null
      const amountCNY = value ? finance.convertToCNY(value.amount, asset.currency, rates) : null
      const profit = value && value.profit !== undefined ? Number(value.profit) : null
      return {
        id: asset.id,
        name: asset.name,
        typeLabel: finance.getAssetTypeLabel(asset.type),
        currency: asset.currency || 'CNY',
        amountValue: amount === null ? -1 : amountCNY,
        amountText: amount === null ? '-' : finance.formatMoney(amount),
        amountParts: buildMoneyParts(amount),
        amountCNYText: amountCNY === null || asset.currency === 'CNY' ? '' : `约 ¥${finance.formatMoney(amountCNY)}`,
        amountCNYParts: amountCNY === null || asset.currency === 'CNY' ? null : buildMoneyParts(amountCNY, '¥'),
        profitText: profit === null ? '' : finance.formatMoney(profit),
        profitParts: profit === null ? null : buildMoneyParts(profit),
        profitTone: getSignedTone(profit),
      }
    })
    .sort((left, right) => right.amountValue - left.amountValue)
}

Component({
  data: {
    loading: true,
    error: '',
    latestLabel: '-',
    ratesLabel: '',
    summary: {
      total: '¥0.00',
    },
    statCards: [],
    assetRows: [],
    snapshotRows: [],
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
      if (this._dashboardLoadPromise) return this._dashboardLoadPromise
      this._dashboardLoadPromise = this.load().finally(() => {
        this._dashboardLoadPromise = null
      })
      return this._dashboardLoadPromise
    },

    onPullDownRefresh() {
      this.loadIfAuthenticated().finally(() => {
        wx.stopPullDownRefresh()
      })
    },

    async load() {
      this.setData({ loading: true, error: '' })
      try {
        const [assets, latestData, snapshots, rates] = await Promise.all([
          api.getAssets(),
          api.getLatestSnapshot(),
          api.getSnapshots(),
          api.getRates(),
        ])

        const activeAssets = assets.filter((asset) => asset.isActive)
        const latestValues = latestData && Array.isArray(latestData.values) ? latestData.values : []
        const total = finance.calculateSnapshotTotal(latestValues, activeAssets, rates)
        const assetRows = buildAssetRows(assets, latestData, rates)
        const snapshotRows = snapshots.slice(0, 6).map((snapshot) => ({
          id: snapshot.id,
          time: finance.formatDateTimeLabel(snapshot.recordedAt),
          note: snapshot.note || '快照',
        }))

        this.setData({
          loading: false,
          latestLabel: latestData ? finance.formatDateTimeLabel(latestData.snapshot.recordedAt) : '-',
          ratesLabel: `USD ${Number(rates.USD).toFixed(2)} / HKD ${Number(rates.HKD).toFixed(2)}`,
          summary: {
            total: `¥${finance.formatMoney(total.totalAmountCNY)}`,
            totalParts: buildMoneyParts(total.totalAmountCNY, '¥'),
          },
          statCards: [
            {
              label: '投资',
              value: `¥${finance.formatMoney(total.investmentAmountCNY)}`,
              valueParts: buildMoneyParts(total.investmentAmountCNY, '¥'),
              tone: 'neutral',
            },
            {
              label: '余额',
              value: `¥${finance.formatMoney(total.balanceAmountCNY)}`,
              valueParts: buildMoneyParts(total.balanceAmountCNY, '¥'),
              tone: 'neutral',
            },
            {
              label: '收益',
              value: `¥${finance.formatMoney(total.totalProfitCNY)}`,
              valueParts: buildMoneyParts(total.totalProfitCNY, '¥'),
              tone: getSignedTone(total.totalProfitCNY),
            },
          ],
          assetRows,
          snapshotRows,
        })
      } catch (error) {
        this.setData({
          loading: false,
          error: error.message || '加载失败',
        })
      }
    },

    goEntry() {
      wx.navigateTo({ url: '/pages/entry/entry' })
    },

    handleRefresh() {
      this.loadIfAuthenticated()
    },

    handleLogout() {
      wx.showModal({
        title: '退出登录',
        content: '确定要退出这个小程序吗？',
        confirmText: '退出',
        confirmColor: '#b83232',
        success: async (res) => {
          if (!res.confirm) return
          await api.logout()
          wx.redirectTo({ url: '/pages/login/login' })
        },
      })
    },
  },
})

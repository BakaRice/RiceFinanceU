const api = require('../../utils/api')
const session = require('../../utils/session')

function validateBackup(data) {
  if (!data || typeof data !== 'object') return 'JSON 无效'
  if (!data.meta || typeof data.meta.schemaVersion !== 'number') return '缺少 meta.schemaVersion'
  if (!Array.isArray(data.assets)) return '缺少 assets'
  if (!Array.isArray(data.snapshots) && !Array.isArray(data.transactions)) return '缺少 snapshots'
  if (!Array.isArray(data.snapshotValues)) return '缺少 snapshotValues'
  return ''
}

function buildImportSummary(data) {
  const snapshots = data.snapshots || data.transactions || []
  return `资产 ${data.assets.length} / 快照 ${snapshots.length} / 记录 ${data.snapshotValues.length}`
}

Component({
  data: {
    importText: '',
    importing: false,
    exporting: false,
  },

  lifetimes: {
    attached() {
      this.ensureAuthenticated()
    },
  },

  pageLifetimes: {
    show() {
      this.ensureAuthenticated()
    },
  },

  methods: {
    ensureAuthenticated() {
      if (!session.hasSessionToken()) {
        wx.redirectTo({ url: '/pages/login/login' })
        return false
      }
      return true
    },

    onImportInput(event) {
      this.setData({ importText: event.detail.value })
    },

    async handleExport() {
      if (!this.ensureAuthenticated() || this.data.exporting) return
      this.setData({ exporting: true })
      try {
        const data = await api.exportData()
        const text = JSON.stringify(data, null, 2)
        wx.setClipboardData({
          data: text,
          success() {
            wx.showToast({ title: '已复制', icon: 'success' })
          },
        })
      } catch (error) {
        wx.showToast({ title: error.message || '导出失败', icon: 'none' })
      } finally {
        this.setData({ exporting: false })
      }
    },

    handleImport() {
      if (!this.ensureAuthenticated() || this.data.importing) return
      let data
      try {
        data = JSON.parse(this.data.importText)
      } catch (error) {
        wx.showToast({ title: 'JSON 无效', icon: 'none' })
        return
      }

      const validationError = validateBackup(data)
      if (validationError) {
        wx.showToast({ title: validationError, icon: 'none' })
        return
      }

      wx.showModal({
        title: '确认导入',
        content: buildImportSummary(data),
        confirmText: '导入',
        confirmColor: '#c0392b',
        success: async (res) => {
          if (!res.confirm) return
          this.setData({ importing: true })
          try {
            await api.importData(data)
            this.setData({ importText: '' })
            wx.showToast({ title: '已导入', icon: 'success' })
          } catch (error) {
            wx.showToast({ title: error.message || '导入失败', icon: 'none' })
          } finally {
            this.setData({ importing: false })
          }
        },
      })
    },

    handleLogout() {
      wx.showModal({
        title: '退出登录',
        content: '确定退出当前账号吗？',
        confirmText: '退出',
        confirmColor: '#c0392b',
        success: async (res) => {
          if (!res.confirm) return
          await api.logout()
          wx.redirectTo({ url: '/pages/login/login' })
        },
      })
    },
  },
})

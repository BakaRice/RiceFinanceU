const api = require('../../utils/api')
const session = require('../../utils/session')
const finance = require('../../utils/finance')

function pad(value) {
  return String(value).padStart(2, '0')
}

function getCurrentDateParts() {
  const now = new Date()
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  }
}

function confirmSave(content) {
  return new Promise((resolve) => {
    wx.showModal({
      title: '确认保存快照',
      content,
      confirmText: '保存',
      confirmColor: '#17694c',
      success(res) {
        resolve(Boolean(res.confirm))
      },
      fail() {
        resolve(false)
      },
    })
  })
}

Page({
  data: {
    loading: true,
    error: '',
    rows: [],
    includedCount: 0,
    recordedDate: '',
    recordedTime: '',
    note: '',
    submitting: false,
  },

  onLoad() {
    if (!session.hasSessionToken()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    const parts = getCurrentDateParts()
    this.setData({
      recordedDate: parts.date,
      recordedTime: parts.time,
    })
    this.load()
  },

  async load() {
    this.setData({ loading: true, error: '' })
    try {
      const [assets, latestData] = await Promise.all([
        api.getAssets(),
        api.getLatestSnapshot(),
      ])
      const rows = finance.buildEntryRows(assets, latestData)
      this.updateRows(rows, { loading: false })
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '加载失败',
      })
    }
  },

  updateRows(rows, extraData) {
    this.setData({
      rows,
      includedCount: rows.filter((row) => row.included).length,
      ...(extraData || {}),
    })
  },

  onDateChange(event) {
    this.setData({ recordedDate: event.detail.value })
  },

  onTimeChange(event) {
    this.setData({ recordedTime: event.detail.value })
  },

  onNoteInput(event) {
    this.setData({ note: event.detail.value })
  },

  onIncludedChange(event) {
    const index = Number(event.currentTarget.dataset.index)
    const rows = this.data.rows.slice()
    rows[index] = {
      ...rows[index],
      included: event.detail.value,
    }
    this.updateRows(rows)
  },

  onFieldInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field
    const rows = this.data.rows.slice()
    rows[index] = {
      ...rows[index],
      [field]: event.detail.value,
      included: true,
    }
    this.updateRows(rows)
  },

  async handleSubmit() {
    if (this.data.submitting) return

    let payload
    try {
      payload = finance.buildSnapshotPayload({
        rows: this.data.rows,
        recordedDate: this.data.recordedDate,
        recordedTime: this.data.recordedTime,
        note: this.data.note,
      })
    } catch (error) {
      wx.showToast({
        title: error.message || '输入有误',
        icon: 'none',
      })
      return
    }

    const ok = await confirmSave(`时间：${this.data.recordedDate} ${this.data.recordedTime}\n资产项：${payload.values.length} 项`)
    if (!ok) return

    this.setData({ submitting: true })
    try {
      await api.createSnapshot(payload)
      wx.showToast({
        title: '已保存',
        icon: 'success',
      })
      setTimeout(() => {
        if (getCurrentPages().length > 1) {
          wx.navigateBack({ delta: 1 })
        } else {
          wx.redirectTo({ url: '/pages/index/index' })
        }
      }, 450)
    } catch (error) {
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none',
      })
    } finally {
      this.setData({ submitting: false })
    }
  },
})

const api = require('../../utils/api')
const session = require('../../utils/session')

Page({
  data: {
    email: '',
    password: '',
    canSubmit: false,
    submitting: false,
    error: '',
    hasToken: false,
  },

  onLoad() {
    this.setData({
      hasToken: session.hasSessionToken(),
    })
  },

  onEmailInput(event) {
    this.setData({ email: event.detail.value }, () => this.updateSubmitState())
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value }, () => this.updateSubmitState())
  },

  updateSubmitState() {
    this.setData({
      canSubmit: Boolean(this.data.email.trim() && this.data.password),
    })
  },

  async handleLogin() {
    if (!this.data.canSubmit || this.data.submitting) return

    this.setData({ submitting: true, error: '' })
    try {
      await api.login({
        email: this.data.email.trim(),
        password: this.data.password,
      })
      wx.switchTab({ url: '/pages/index/index' })
    } catch (error) {
      this.setData({
        error: error.message || '登录失败',
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  goDashboard() {
    wx.switchTab({ url: '/pages/index/index' })
  },
})

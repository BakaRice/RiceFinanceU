const TOKEN_KEY = 'ricefinanceu.sessionToken'

function getSessionToken() {
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function setSessionToken(token) {
  wx.setStorageSync(TOKEN_KEY, token)
}

function clearSessionToken() {
  wx.removeStorageSync(TOKEN_KEY)
}

function hasSessionToken() {
  return Boolean(getSessionToken())
}

module.exports = {
  TOKEN_KEY,
  clearSessionToken,
  getSessionToken,
  hasSessionToken,
  setSessionToken,
}

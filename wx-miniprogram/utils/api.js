const { API_BASE } = require('../config')
const session = require('./session')

function redirectToLogin() {
  wx.redirectTo({
    url: '/pages/login/login',
  })
}

function request(path, options) {
  const requestOptions = options || {}
  const token = session.getSessionToken()
  const header = {
    'content-type': 'application/json',
    ...(requestOptions.header || {}),
  }

  if (token) {
    header.Authorization = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method: requestOptions.method || 'GET',
      data: requestOptions.data,
      header,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
          return
        }

        const message = res.data && res.data.error
          ? res.data.error
          : `请求失败: ${res.statusCode}`

        if (res.statusCode === 401) {
          session.clearSessionToken()
          redirectToLogin()
        }

        reject(new Error(message))
      },
      fail() {
        reject(new Error('网络请求失败，请稍后重试'))
      },
    })
  })
}

async function login(data) {
  const result = await request('/auth/login', {
    method: 'POST',
    data,
  })
  session.setSessionToken(result.token)
  return result
}

async function logout() {
  try {
    await request('/auth/logout', {
      method: 'POST',
    })
  } catch (error) {
    // 本地退出优先，远端 session 删除失败也不阻断用户退出。
  } finally {
    session.clearSessionToken()
  }
}

module.exports = {
  createSnapshot(data) {
    return request('/snapshots', {
      method: 'POST',
      data,
    })
  },
  getAssets() {
    return request('/assets')
  },
  getLatestSnapshot() {
    return request('/snapshots/latest')
  },
  getRates() {
    return request('/rates')
  },
  getSnapshots() {
    return request('/snapshots')
  },
  login,
  logout,
  request,
}

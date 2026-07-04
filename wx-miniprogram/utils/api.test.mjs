import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function createWxMock(responseForRequest) {
  const storage = {}
  const requests = []
  const redirects = []

  return {
    storage,
    requests,
    redirects,
    getStorageSync(key) {
      return storage[key]
    },
    setStorageSync(key, value) {
      storage[key] = value
    },
    removeStorageSync(key) {
      delete storage[key]
    },
    redirectTo(options) {
      redirects.push(options)
    },
    request(options) {
      requests.push(options)
      const response = responseForRequest(options)
      options.success(response)
    },
  }
}

function loadCommonJs(filePath, cache = new Map()) {
  const filename = path.resolve(rootDir, filePath)
  if (cache.has(filename)) return cache.get(filename).exports

  const code = readFileSync(filename, 'utf8')
  const module = { exports: {} }
  cache.set(filename, module)

  function localRequire(request) {
    const resolved = request.startsWith('.')
      ? path.relative(rootDir, path.resolve(path.dirname(filename), request)) + '.js'
      : request
    return loadCommonJs(resolved, cache)
  }

  const run = new Function('module', 'exports', 'require', 'console', `${code}\n//# sourceURL=${filename}`)
  run(module, module.exports, localRequire, console)
  return module.exports
}

test('login sends credentials to Cloudflare API and stores the returned token', async () => {
  globalThis.wx = createWxMock(() => ({
    statusCode: 200,
    data: {
      token: 'session-token',
      expiresAt: '2026-08-03T00:00:00.000Z',
      user: { email: 'ricemarch404@gmail.com' },
    },
  }))

  const api = loadCommonJs('utils/api.js')

  const result = await api.login({
    email: 'ricemarch404@gmail.com',
    password: 'secret',
  })

  assert.equal(result.token, 'session-token')
  assert.equal(globalThis.wx.storage['ricefinanceu.sessionToken'], 'session-token')
  assert.equal(globalThis.wx.requests[0].url, 'https://ricefinanceu.ricemarch-finance.workers.dev/api/auth/login')
  assert.equal(globalThis.wx.requests[0].method, 'POST')
  assert.deepEqual(globalThis.wx.requests[0].data, {
    email: 'ricemarch404@gmail.com',
    password: 'secret',
  })
})

test('authenticated requests include bearer token and clear it on unauthorized response', async () => {
  let callCount = 0
  globalThis.wx = createWxMock(() => {
    callCount += 1
    if (callCount === 1) return { statusCode: 200, data: [] }
    return { statusCode: 401, data: { error: '请先登录' } }
  })
  globalThis.wx.storage['ricefinanceu.sessionToken'] = 'stored-token'

  const api = loadCommonJs('utils/api.js')

  await api.getAssets()
  assert.equal(globalThis.wx.requests[0].header.Authorization, 'Bearer stored-token')

  await assert.rejects(() => api.getSnapshots(), /请先登录/)
  assert.equal(globalThis.wx.storage['ricefinanceu.sessionToken'], undefined)
  assert.deepEqual(globalThis.wx.redirects[0], {
    url: '/pages/login/login',
  })
})

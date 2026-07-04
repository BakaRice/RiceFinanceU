import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../..')

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

  const run = new Function('module', 'exports', 'require', 'console', 'Page', `${code}\n//# sourceURL=${filename}`)
  run(module, module.exports, localRequire, console, globalThis.Page)
  return module.exports
}

function createPageInstance(definition) {
  const instance = {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch, callback) {
      this.data = {
        ...this.data,
        ...patch,
      }
      if (callback) callback()
    },
  }
  return instance
}

test('登录页有本地 token 时也先展示登录页，不自动跳走', () => {
  const redirects = []
  globalThis.wx = {
    getStorageSync(key) {
      return key === 'ricefinanceu.sessionToken' ? 'stored-token' : ''
    },
    setStorageSync() {},
    removeStorageSync() {},
    redirectTo(options) {
      redirects.push(options)
    },
  }

  let pageDefinition = null
  globalThis.Page = (definition) => {
    pageDefinition = definition
  }

  loadCommonJs('pages/login/login.js')
  const page = createPageInstance(pageDefinition)

  page.onLoad()

  assert.equal(page.data.hasToken, true)
  assert.deepEqual(redirects, [])
})

test('登录成功后进入总览 tab', async () => {
  const switchTabs = []
  const redirects = []
  globalThis.wx = {
    getStorageSync() {
      return ''
    },
    setStorageSync() {},
    removeStorageSync() {},
    request(options) {
      options.success({
        statusCode: 200,
        data: {
          token: 'session-token',
          expiresAt: '2026-08-03T00:00:00.000Z',
          user: { email: 'ricemarch404@gmail.com' },
        },
      })
    },
    redirectTo(options) {
      redirects.push(options)
    },
    switchTab(options) {
      switchTabs.push(options)
    },
  }

  let pageDefinition = null
  globalThis.Page = (definition) => {
    pageDefinition = definition
  }

  loadCommonJs('pages/login/login.js')
  const page = createPageInstance(pageDefinition)

  page.onEmailInput({ detail: { value: 'ricemarch404@gmail.com' } })
  page.onPasswordInput({ detail: { value: 'secret' } })
  await page.handleLogin()

  assert.deepEqual(switchTabs, [{ url: '/pages/index/index' }])
  assert.deepEqual(redirects, [])
})

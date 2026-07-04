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

  const run = new Function('module', 'exports', 'require', 'console', 'Page', 'Component', `${code}\n//# sourceURL=${filename}`)
  run(module, module.exports, localRequire, console, globalThis.Page, globalThis.Component)
  return module.exports
}

function createPageInstance(definition) {
  return {
    ...definition,
    ...(definition.methods || {}),
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch) {
      this.data = {
        ...this.data,
        ...patch,
      }
    },
  }
}

test('总览页展示时如果已有 token，会立即请求总览所需接口', async () => {
  const requests = []
  const redirects = []
  globalThis.wx = {
    getStorageSync(key) {
      return key === 'ricefinanceu.sessionToken' ? 'stored-token' : ''
    },
    request(options) {
      requests.push(options.url)
      const dataByPath = {
        '/assets': [
          { id: 'cash', name: '现金', type: 'cash', currency: 'CNY', isActive: true },
          { id: 'fund', name: '美元基金', type: 'fund', currency: 'USD', isActive: true },
        ],
        '/snapshots/latest': {
          snapshot: { id: 's1', recordedAt: '2026-07-04T12:00:00.000Z' },
          values: [
            { assetId: 'cash', amount: 100 },
            { assetId: 'fund', amount: 20, profit: 2 },
          ],
        },
        '/snapshots': [
          { id: 's1', recordedAt: '2026-07-04T12:00:00.000Z', note: '测试' },
        ],
        '/rates': { USD: 7.2, HKD: 0.92, updatedAt: '2026-07-04T12:00:00.000Z' },
      }
      const matchedPath = Object.keys(dataByPath).find((item) => options.url.endsWith(item))
      options.success({
        statusCode: 200,
        data: dataByPath[matchedPath],
      })
    },
    redirectTo(options) {
      redirects.push(options)
    },
  }

  let pageDefinition = null
  globalThis.Page = (definition) => {
    pageDefinition = definition
  }
  globalThis.Component = (definition) => {
    pageDefinition = definition
  }

  loadCommonJs('pages/index/index.js')
  const page = createPageInstance(pageDefinition)

  const show = page.onShow || page.pageLifetimes?.show
  await show.call(page)
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(redirects.length, 0)
  assert.deepEqual(
    requests.map((url) => url.replace('https://ricefinanceu.ricemarch-finance.workers.dev/api', '')).sort(),
    ['/assets', '/rates', '/snapshots', '/snapshots/latest'].sort()
  )
  assert.equal(page.data.summary.total, '¥244.00')
  assert.deepEqual(page.data.summary.totalParts, {
    prefix: '¥',
    main: '244',
    decimal: '.00',
  })
  assert.equal(page.data.statCards[2].tone, 'profit')
  assert.equal(page.data.assetRows[0].id, 'fund')
  assert.deepEqual(page.data.assetRows[0].amountParts, {
    prefix: '',
    main: '20',
    decimal: '.00',
  })
  assert.equal(page.data.assetRows[0].profitTone, 'profit')
})

test('总览页事件处理函数放在 methods 中，匹配微信 Component 页面结构', () => {
  globalThis.wx = {
    getStorageSync() {
      return ''
    },
  }

  let pageDefinition = null
  globalThis.Page = (definition) => {
    pageDefinition = definition
  }
  globalThis.Component = (definition) => {
    pageDefinition = definition
  }

  loadCommonJs('pages/index/index.js')

  assert.equal(typeof pageDefinition.methods?.handleRefresh, 'function')
})

test('总览页不展示常驻录入、退出、刷新主按钮', () => {
  const wxml = readFileSync(path.resolve(rootDir, 'pages/index/index.wxml'), 'utf8')

  assert.equal(wxml.includes('quick-actions'), false)
  assert.equal(wxml.includes('bindtap="goEntry"'), false)
  assert.equal(wxml.includes('bindtap="handleLogout"'), false)
  assert.equal(wxml.includes('class="topbar-button"'), false)
})

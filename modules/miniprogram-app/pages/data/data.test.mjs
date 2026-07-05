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

  const run = new Function('module', 'exports', 'require', 'console', 'Component', `${code}\n//# sourceURL=${filename}`)
  run(module, module.exports, localRequire, console, globalThis.Component)
  return module.exports
}

function createComponentInstance(definition) {
  return {
    ...definition,
    ...(definition.methods || {}),
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch, callback) {
      this.data = {
        ...this.data,
        ...patch,
      }
      if (callback) callback()
    },
  }
}

test('导出备份时把 JSON 放进文本框，不依赖剪贴板可用性', async () => {
  const backup = {
    meta: { schemaVersion: 2, exportedAt: '2026-07-05T00:00:00.000Z' },
    assets: [{ id: 'cash', name: '现金', type: 'cash', currency: 'CNY', isActive: true }],
    snapshots: [],
    snapshotValues: [],
    rates: { USD: 7.2, HKD: 0.92, updatedAt: '2026-07-05T00:00:00.000Z' },
  }
  const requests = []
  const toasts = []

  globalThis.wx = {
    getStorageSync(key) {
      return key === 'ricefinanceu.sessionToken' ? 'stored-token' : ''
    },
    request(options) {
      requests.push(options)
      options.success({
        statusCode: 200,
        data: backup,
      })
    },
    redirectTo() {},
    showToast(options) {
      toasts.push(options)
    },
    setClipboardData() {
      throw new Error('clipboard unavailable')
    },
  }

  let pageDefinition = null
  globalThis.Component = (definition) => {
    pageDefinition = definition
  }

  loadCommonJs('pages/data/data.js')
  const page = createComponentInstance(pageDefinition)

  await page.handleExport()

  assert.equal(requests[0].url, 'https://ricefinanceu.ricemarch-finance.workers.dev/api/export')
  assert.equal(page.data.importText, JSON.stringify(backup, null, 2))
  assert.equal(page.data.exporting, false)
  assert.deepEqual(toasts, [{ title: '已导出到文本框', icon: 'success' }])
})

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
  const localRequire = (request) => loadCommonJs(
    path.relative(rootDir, path.resolve(path.dirname(filename), request)) + '.js',
    cache,
  )
  const run = new Function('module', 'exports', 'require', 'console', 'Page', 'Component', `${code}\n//# sourceURL=${filename}`)
  run(module, module.exports, localRequire, console, globalThis.Page, globalThis.Component)
  return module.exports
}

function createPageInstance(definition) {
  return {
    ...definition,
    ...definition.methods,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch) { this.data = { ...this.data, ...patch } },
  }
}

test('资产页使用暂停录入，并对永久删除执行两次强确认', async () => {
  const requests = []
  const modals = []
  const modalResponses = [
    { confirm: true },
    { confirm: true, content: '黄金' },
  ]
  globalThis.wx = {
    getStorageSync() { return 'stored-token' },
    request(options) {
      requests.push(options)
      let data = { success: true }
      if (options.url.endsWith('/assets') && (!options.method || options.method === 'GET')) {
        data = [
          { id: 'gold', name: '黄金', type: 'gold', currency: 'CNY', entryStatus: 'normal' },
          { id: 'cash', name: '现金', type: 'cash', currency: 'CNY', entryStatus: 'paused' },
        ]
      } else if (options.url.endsWith('/snapshots/latest')) {
        data = { snapshot: { id: 's1' }, values: [{ assetId: 'cash', amount: 100 }] }
      }
      options.success({ statusCode: 200, data })
    },
    showModal(options) {
      modals.push(options)
      const response = modalResponses.shift()
      Promise.resolve().then(() => options.success(response))
    },
    showToast() {},
  }
  let definition
  globalThis.Component = (value) => { definition = value }
  globalThis.Page = globalThis.Component
  loadCommonJs('pages/assets/assets.js')
  const page = createPageInstance(definition)
  await page.load()

  assert.equal(page.data.normalCount, 1)
  assert.equal(page.data.pausedCount, 1)
  await page.handleEntryStatusChange({ currentTarget: { dataset: { id: 'gold' } } })
  assert.deepEqual(requests.find((request) => request.method === 'PATCH').data, { entryStatus: 'paused' })

  page.handlePermanentDelete({ currentTarget: { dataset: { id: 'gold' } } })
  await new Promise((resolve) => setImmediate(resolve))
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(modals.length, 2)
  assert.match(modals[0].title, /永久删除/)
  assert.equal(modals[1].editable, true)
  const deleteRequest = requests.find((request) => request.method === 'DELETE')
  assert.deepEqual(deleteRequest.data, { confirmName: '黄金' })
})

test('资产页不再展示停用文案', () => {
  const wxml = readFileSync(path.resolve(rootDir, 'pages/assets/assets.wxml'), 'utf8')
  assert.equal(wxml.includes('停用'), false)
  assert.equal(wxml.includes('暂停录入'), true)
})

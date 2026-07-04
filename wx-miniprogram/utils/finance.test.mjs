import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadCommonJs(fileName) {
  const filename = path.join(__dirname, fileName)
  const code = readFileSync(filename, 'utf8')
  const module = { exports: {} }
  const run = new Function('module', 'exports', 'console', `${code}\n//# sourceURL=${filename}`)
  run(module, module.exports, console)
  return module.exports
}

const finance = loadCommonJs('finance.js')

test('calculateSnapshotTotal converts currencies and separates investment from balance assets', () => {
  const assets = [
    { id: 'cash', name: '现金', type: 'cash', currency: 'CNY', isActive: true },
    { id: 'fund', name: '美元基金', type: 'fund', currency: 'USD', isActive: true },
    { id: 'stock', name: '港股', type: 'stock', currency: 'HKD', isActive: true },
  ]
  const values = [
    { assetId: 'cash', amount: 1000 },
    { assetId: 'fund', amount: 10, profit: 2 },
    { assetId: 'stock', amount: 100, profit: -5 },
  ]

  const total = finance.calculateSnapshotTotal(values, assets, {
    USD: 7.2,
    HKD: 0.92,
    updatedAt: '2026-07-04T00:00:00.000Z',
  })

  assert.equal(total.totalAmountCNY, 1164)
  assert.equal(total.investmentAmountCNY, 164)
  assert.equal(total.balanceAmountCNY, 1000)
  assert.equal(total.totalProfitCNY, 9.8)
})

test('buildEntryRows keeps active assets and pre-fills the latest snapshot values', () => {
  const assets = [
    { id: 'inactive', name: '旧账户', type: 'cash', currency: 'CNY', isActive: false },
    { id: 'cash', name: '现金', type: 'cash', currency: 'CNY', isActive: true },
    { id: 'fund', name: '基金', type: 'fund', currency: 'CNY', isActive: true },
  ]
  const latestData = {
    snapshot: { id: 's1' },
    values: [
      { assetId: 'cash', amount: 300 },
      { assetId: 'fund', amount: 1200.5, profit: 100.25, profitRate: 0.0812 },
    ],
  }

  const rows = finance.buildEntryRows(assets, latestData)

  assert.deepEqual(rows.map((row) => row.assetId), ['fund', 'cash'])
  assert.equal(rows[0].amount, '1200.5')
  assert.equal(rows[0].profit, '100.25')
  assert.equal(rows[0].profitRate, '8.12')
  assert.equal(rows[0].isInvestment, true)
  assert.equal(rows[0].included, true)
  assert.equal(rows[1].amount, '300')
  assert.equal(rows[1].isInvestment, false)
  assert.equal(rows[1].included, true)
})

test('buildSnapshotPayload validates rows and converts percent input to decimal profitRate', () => {
  const rows = [
    {
      assetId: 'fund',
      name: '基金',
      type: 'fund',
      amount: '1200.50',
      profit: '100.25',
      profitRate: '8.12',
      included: true,
    },
    {
      assetId: 'cash',
      name: '现金',
      type: 'cash',
      amount: '300',
      profit: '999',
      profitRate: '99',
      included: true,
    },
    {
      assetId: 'ignored',
      name: '忽略项',
      type: 'cash',
      amount: '1',
      included: false,
    },
  ]

  const payload = finance.buildSnapshotPayload({
    rows,
    recordedDate: '2026-07-04',
    recordedTime: '22:30',
    note: '  小程序录入  ',
  })

  assert.equal(payload.recordedAt, new Date('2026-07-04T22:30:00').toISOString())
  assert.equal(payload.note, '小程序录入')
  assert.deepEqual(payload.values, [
    { assetId: 'fund', amount: 1200.5, profit: 100.25, profitRate: 0.0812 },
    { assetId: 'cash', amount: 300 },
  ])

  assert.throws(
    () =>
      finance.buildSnapshotPayload({
        rows: [{ ...rows[0], amount: '-1' }],
        recordedDate: '2026-07-04',
        recordedTime: '22:30',
        note: '',
      }),
    /金额无效/
  )
})

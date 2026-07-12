import assert from 'node:assert/strict'
import test from 'node:test'

import worker from './index.js'

const TEST_EMAIL = 'owner@example.com'

class MemoryKV {
  constructor() {
    this.values = new Map()
  }

  async get(key, options) {
    const record = this.values.get(key)
    if (!record) return null
    if (record.expiresAt && record.expiresAt <= Date.now()) {
      this.values.delete(key)
      return null
    }
    if (options?.type === 'json') {
      return JSON.parse(record.value)
    }
    return record.value
  }

  async put(key, value, options = {}) {
    const expiresAt = options.expirationTtl
      ? Date.now() + options.expirationTtl * 1000
      : undefined
    this.values.set(key, { value, expiresAt })
  }

  async delete(key) {
    this.values.delete(key)
  }
}

function createEnv() {
  return {
    FINANCE_KV: new MemoryKV(),
    APP_USER_EMAIL: TEST_EMAIL,
    APP_PASSWORD: 'correct-password',
  }
}

async function request(env, path, init = {}) {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  return worker.fetch(
    new Request(`https://ricefinance.test${path}`, {
      ...init,
      headers,
    }),
    env,
    { waitUntil() {} },
  )
}

async function login(env) {
  const response = await request(env, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: 'correct-password',
    }),
  })
  const body = await response.json()
  return body.token
}

async function authedRequest(env, path, init = {}) {
  const token = init.token || await login(env)
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${token}`)
  return request(env, path, {
    ...init,
    headers,
  })
}

test('正确邮箱和密码可以登录，并用 session 访问受保护接口', async () => {
  const env = createEnv()

  const loginResponse = await request(env, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: 'correct-password',
    }),
  })

  assert.equal(loginResponse.status, 200)
  const loginBody = await loginResponse.json()
  assert.equal(loginBody.user.email, TEST_EMAIL)
  assert.equal(typeof loginBody.token, 'string')
  assert.ok(loginBody.token.length > 20)

  const assetsResponse = await request(env, '/api/assets', {
    headers: {
      authorization: `Bearer ${loginBody.token}`,
    },
  })

  assert.equal(assetsResponse.status, 200)
  assert.deepEqual(await assetsResponse.json(), [])
})

test('密码错误时登录失败', async () => {
  const env = createEnv()

  const response = await request(env, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: 'wrong-password',
    }),
  })

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: '邮箱或密码错误' })
})

test('没有配置登录密码时拒绝登录', async () => {
  const env = createEnv()
  delete env.APP_PASSWORD

  const response = await request(env, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: '',
    }),
  })

  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: '登录配置未完成' })
})

test('不提供公开登录配置接口', async () => {
  const env = createEnv()

  const response = await request(env, '/api/auth/config')

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: '请先登录' })
})

test('没有 session 时不能访问受保护接口', async () => {
  const env = createEnv()

  const response = await request(env, '/api/assets')

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: '请先登录' })
})

test('只有无历史且名称确认匹配的资产可以永久删除', async () => {
  const env = createEnv()
  const token = await login(env)

  const createResponse = await authedRequest(env, '/api/assets', {
    token,
    method: 'POST',
    body: JSON.stringify({
      name: '招商银行现金',
      type: 'cash',
      currency: 'CNY',
      institution: '招商银行',
    }),
  })

  assert.equal(createResponse.status, 201)
  const asset = await createResponse.json()
  assert.equal(asset.name, '招商银行现金')
  assert.equal(asset.entryStatus, 'normal')

  const listResponse = await authedRequest(env, '/api/assets', { token })
  assert.equal(listResponse.status, 200)
  assert.equal((await listResponse.json()).length, 1)

  const wrongNameResponse = await authedRequest(env, `/api/assets/${asset.id}`, {
    token,
    method: 'DELETE',
    body: JSON.stringify({ confirmName: '错误名称' }),
  })
  assert.equal(wrongNameResponse.status, 400)

  const deleteResponse = await authedRequest(env, `/api/assets/${asset.id}`, {
    token,
    method: 'DELETE',
    body: JSON.stringify({ confirmName: asset.name }),
  })
  assert.equal(deleteResponse.status, 200)
  assert.deepEqual(await deleteResponse.json(), { success: true })

  const afterDeleteResponse = await authedRequest(env, '/api/assets', { token })
  const assets = await afterDeleteResponse.json()
  assert.deepEqual(assets, [])
})

test('存在历史快照引用的资产不能永久删除', async () => {
  const env = createEnv()
  const token = await login(env)
  const createResponse = await authedRequest(env, '/api/assets', {
    token,
    method: 'POST',
    body: JSON.stringify({ name: '历史黄金', type: 'gold', currency: 'CNY' }),
  })
  const asset = await createResponse.json()

  const snapshotResponse = await authedRequest(env, '/api/snapshots', {
    token,
    method: 'POST',
    body: JSON.stringify({
      recordedAt: '2026-07-01T00:00:00.000Z',
      values: [{ assetId: asset.id, amount: 1000, profit: 0, profitRate: 0 }],
    }),
  })
  assert.equal(snapshotResponse.status, 201)

  const deleteResponse = await authedRequest(env, `/api/assets/${asset.id}`, {
    token,
    method: 'DELETE',
    body: JSON.stringify({ confirmName: asset.name }),
  })

  assert.equal(deleteResponse.status, 409)
  assert.deepEqual(await deleteResponse.json(), {
    error: '该资产已有历史快照，只能暂停录入',
    code: 'ASSET_HAS_SNAPSHOT_HISTORY',
  })
  const assetsResponse = await authedRequest(env, '/api/assets', { token })
  assert.equal((await assetsResponse.json()).length, 1)
})

test('旧 isActive 资产会迁移为 entryStatus', async () => {
  const env = createEnv()
  const token = await login(env)
  await env.FINANCE_KV.put('finance:data:v2', JSON.stringify({
    assets: [
      { id: 'active', name: '正常资产', type: 'cash', currency: 'CNY', isActive: true },
      { id: 'inactive', name: '旧停用资产', type: 'gold', currency: 'CNY', isActive: false },
    ],
    snapshots: [],
    snapshotValues: [],
  }))

  const response = await authedRequest(env, '/api/assets', { token })
  const assets = await response.json()

  assert.deepEqual(assets.map(({ id, entryStatus, isActive }) => ({ id, entryStatus, isActive })), [
    { id: 'active', entryStatus: 'normal', isActive: undefined },
    { id: 'inactive', entryStatus: 'paused', isActive: undefined },
  ])
})

test('暂停录入资产不能显式提交，但会沿用上一份快照值', async () => {
  const env = createEnv()
  const token = await login(env)
  const create = async (name) => {
    const response = await authedRequest(env, '/api/assets', {
      token,
      method: 'POST',
      body: JSON.stringify({ name, type: 'cash', currency: 'CNY' }),
    })
    return response.json()
  }
  const pausedAsset = await create('暂停资产')
  const normalAsset = await create('正常资产')

  const firstSnapshot = await authedRequest(env, '/api/snapshots', {
    token,
    method: 'POST',
    body: JSON.stringify({
      recordedAt: '2026-07-01T00:00:00.000Z',
      values: [
        { assetId: pausedAsset.id, amount: 100 },
        { assetId: normalAsset.id, amount: 200 },
      ],
    }),
  })
  assert.equal(firstSnapshot.status, 201)

  const pauseResponse = await authedRequest(env, `/api/assets/${pausedAsset.id}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ entryStatus: 'paused' }),
  })
  assert.equal(pauseResponse.status, 200)

  const explicitPausedValue = await authedRequest(env, '/api/snapshots', {
    token,
    method: 'POST',
    body: JSON.stringify({
      recordedAt: '2026-07-02T00:00:00.000Z',
      values: [{ assetId: pausedAsset.id, amount: 110 }],
    }),
  })
  assert.equal(explicitPausedValue.status, 400)

  const secondSnapshot = await authedRequest(env, '/api/snapshots', {
    token,
    method: 'POST',
    body: JSON.stringify({
      recordedAt: '2026-07-02T00:00:00.000Z',
      values: [{ assetId: normalAsset.id, amount: 250 }],
    }),
  })
  assert.equal(secondSnapshot.status, 201)
  const body = await secondSnapshot.json()
  const pausedValue = body.values.find((value) => value.assetId === pausedAsset.id)
  assert.equal(pausedValue.amount, 100)
})

test('资产接口会清理并保存类型档案字段', async () => {
  const env = createEnv()
  const token = await login(env)

  const createResponse = await authedRequest(env, '/api/assets', {
    token,
    method: 'POST',
    body: JSON.stringify({
      name: '零钱',
      type: 'cash',
      currency: 'CNY',
      profile: {
        accountChannel: ' 微信零钱 ',
        fundCode: 'should-drop',
        purposeTag: '',
      },
    }),
  })

  assert.equal(createResponse.status, 201)
  const asset = await createResponse.json()
  assert.deepEqual(asset.profile, { accountChannel: '微信零钱' })

  const updateResponse = await authedRequest(env, `/api/assets/${asset.id}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({
      profile: {},
    }),
  })

  assert.equal(updateResponse.status, 200)
  const updatedAsset = await updateResponse.json()
  assert.equal(updatedAsset.profile, undefined)
})

test('资产接口只为投资类资产保存清理后的定投计划', async () => {
  const env = createEnv()
  const token = await login(env)

  const fundResponse = await authedRequest(env, '/api/assets', {
    token,
    method: 'POST',
    body: JSON.stringify({
      name: '纳指基金',
      type: 'fund',
      currency: 'CNY',
      dcaPlan: {
        enabled: true,
        frequency: 'daily',
        plannedContribution: '100.50',
        targetAmount: '10000',
        targetDate: '2026-12-31',
        toleranceRate: '0.15',
        note: ' 长期定投 ',
      },
    }),
  })

  assert.equal(fundResponse.status, 201)
  const fund = await fundResponse.json()
  assert.deepEqual(fund.dcaPlan, {
    enabled: true,
    frequency: 'daily',
    excludeWeekends: true,
    plannedContribution: 100.5,
    targetAmount: 10000,
    targetDate: '2026-12-31',
    toleranceRate: 0.15,
    note: '长期定投',
  })

  const cashResponse = await authedRequest(env, '/api/assets', {
    token,
    method: 'POST',
    body: JSON.stringify({
      name: '现金',
      type: 'cash',
      currency: 'CNY',
      dcaPlan: {
        enabled: true,
        frequency: 'monthly',
        plannedContribution: 500,
      },
    }),
  })

  assert.equal(cashResponse.status, 201)
  const cash = await cashResponse.json()
  assert.equal(cash.dcaPlan, undefined)
})

test('导入导出会保留投资类资产的结构化定投计划', async () => {
  const env = createEnv()
  const token = await login(env)

  const importResponse = await authedRequest(env, '/api/import', {
    token,
    method: 'POST',
    body: JSON.stringify({
      meta: { schemaVersion: 2, updatedAt: '2026-07-01T00:00:00.000Z' },
      assets: [
        {
          id: 'fund-1',
          name: '指数基金',
          type: 'fund',
          currency: 'CNY',
          isActive: true,
          dcaPlan: {
            enabled: true,
            frequency: 'daily',
            excludeWeekends: false,
            plannedContribution: '200',
            targetAmount: '20000',
            targetDate: '2026-12-31',
          },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      snapshots: [],
      snapshotValues: [],
    }),
  })

  assert.equal(importResponse.status, 200)

  const exportResponse = await authedRequest(env, '/api/export', { token })
  const exported = await exportResponse.json()
  const fund = exported.assets.find((asset) => asset.id === 'fund-1')

  assert.deepEqual(fund.dcaPlan, {
    enabled: true,
    frequency: 'daily',
    excludeWeekends: false,
    plannedContribution: 200,
    targetAmount: 20000,
    targetDate: '2026-12-31',
  })
})

test('导入接受旧 isActive 并拒绝未知 entryStatus', async () => {
  const env = createEnv()
  const token = await login(env)
  const base = {
    meta: { schemaVersion: 2, updatedAt: '2026-07-01T00:00:00.000Z' },
    snapshots: [],
    snapshotValues: [],
  }

  const legacyResponse = await authedRequest(env, '/api/import', {
    token,
    method: 'POST',
    body: JSON.stringify({
      ...base,
      assets: [{ id: 'legacy', name: '旧资产', type: 'cash', currency: 'CNY', isActive: false }],
    }),
  })
  assert.equal(legacyResponse.status, 200)

  const invalidResponse = await authedRequest(env, '/api/import', {
    token,
    method: 'POST',
    body: JSON.stringify({
      ...base,
      assets: [{ id: 'invalid', name: '非法资产', type: 'cash', currency: 'CNY', entryStatus: 'archived' }],
    }),
  })
  assert.equal(invalidResponse.status, 400)
  assert.match((await invalidResponse.json()).error, /entryStatus/)
})

test('导入会拒绝非法定投计划并保持原账本不变', async () => {
  const invalidCases = [
    ['balance asset plan', 'cash', { enabled: true, frequency: 'monthly', plannedContribution: 100 }],
    ['invalid frequency', 'fund', { enabled: true, frequency: 'yearly', plannedContribution: 100 }],
    ['zero contribution', 'fund', { enabled: true, frequency: 'monthly', plannedContribution: 0 }],
    ['boolean contribution', 'fund', { enabled: true, frequency: 'monthly', plannedContribution: true }],
    ['invalid target amount', 'fund', { enabled: true, frequency: 'monthly', plannedContribution: 100, targetAmount: -1 }],
    ['null target amount', 'fund', { enabled: true, frequency: 'monthly', plannedContribution: 100, targetAmount: null }],
    ['invalid target date', 'fund', { enabled: true, frequency: 'monthly', plannedContribution: 100, targetDate: '2026-02-31' }],
    ['empty target date', 'fund', { enabled: true, frequency: 'monthly', plannedContribution: 100, targetDate: '' }],
    ['invalid tolerance rate', 'fund', { enabled: true, frequency: 'monthly', plannedContribution: 100, toleranceRate: -1 }],
    ['null tolerance rate', 'fund', { enabled: true, frequency: 'monthly', plannedContribution: 100, toleranceRate: null }],
    ['invalid exclude weekends', 'fund', { enabled: true, frequency: 'daily', plannedContribution: 100, excludeWeekends: 'no' }],
    ['null exclude weekends', 'fund', { enabled: true, frequency: 'daily', plannedContribution: 100, excludeWeekends: null }],
    ['null note', 'fund', { enabled: true, frequency: 'monthly', plannedContribution: 100, note: null }],
  ]

  for (const [label, type, dcaPlan] of invalidCases) {
    const env = createEnv()
    const token = await login(env)
    await authedRequest(env, '/api/assets', {
      token,
      method: 'POST',
      body: JSON.stringify({ name: '原有资产', type: 'fund', currency: 'CNY' }),
    })

    const importResponse = await authedRequest(env, '/api/import', {
      token,
      method: 'POST',
      body: JSON.stringify({
        meta: { schemaVersion: 2, updatedAt: '2026-07-01T00:00:00.000Z' },
        assets: [{ id: 'invalid-dca', name: label, type, currency: 'CNY', isActive: true, dcaPlan }],
        snapshots: [],
        snapshotValues: [],
      }),
    })

    assert.equal(importResponse.status, 400, label)
    const error = await importResponse.json()
    assert.match(error.error, /assets\[0\]\.dcaPlan/, label)

    const exportResponse = await authedRequest(env, '/api/export', { token })
    const exported = await exportResponse.json()
    assert.equal(exported.assets.length, 1, label)
    assert.equal(exported.assets[0].name, '原有资产', label)
  }
})

test('导入旧备份缺少定投计划时继续兼容', async () => {
  const env = createEnv()
  const token = await login(env)
  const importResponse = await authedRequest(env, '/api/import', {
    token,
    method: 'POST',
    body: JSON.stringify({
      meta: { schemaVersion: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
      assets: [{ id: 'legacy-fund', name: '旧基金', type: 'fund', currency: 'CNY', isActive: true }],
      transactions: [],
      snapshotValues: [],
    }),
  })

  assert.equal(importResponse.status, 200)
  const exported = await (await authedRequest(env, '/api/export', { token })).json()
  assert.equal(exported.assets[0].dcaPlan, undefined)
})

test('导入会截断高精度收益率并拒绝非法收益率', async () => {
  const env = createEnv()
  const token = await login(env)
  const baseBackup = {
    meta: { schemaVersion: 2, updatedAt: '2026-07-01T00:00:00.000Z' },
    assets: [
      {
        id: 'fund-precision',
        name: '精度测试基金',
        type: 'fund',
        currency: 'CNY',
        isActive: true,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    ],
    snapshots: [
      {
        id: 'snapshot-precision',
        recordedAt: '2026-07-01T00:00:00.000Z',
      },
    ],
  }

  const importResponse = await authedRequest(env, '/api/import', {
    token,
    method: 'POST',
    body: JSON.stringify({
      ...baseBackup,
      snapshotValues: [
        {
          id: 'value-precision',
          snapshotId: 'snapshot-precision',
          assetId: 'fund-precision',
          amount: 1000,
          profitRate: 0.3076923076923077,
        },
      ],
    }),
  })

  assert.equal(importResponse.status, 200)
  const exportResponse = await authedRequest(env, '/api/export', { token })
  const exported = await exportResponse.json()
  assert.equal(exported.snapshotValues[0].profitRate, 0.3076)

  const invalidResponse = await authedRequest(env, '/api/import', {
    token,
    method: 'POST',
    body: JSON.stringify({
      ...baseBackup,
      snapshotValues: [
        {
          id: 'value-invalid',
          snapshotId: 'snapshot-precision',
          assetId: 'fund-precision',
          amount: 1000,
          profitRate: -1.01,
        },
      ],
    }),
  })

  assert.equal(invalidResponse.status, 400)
})

test('可以创建快照，并在第二次快照中继承未提交资产的上一次数值', async () => {
  const env = createEnv()
  const token = await login(env)

  const cashResponse = await authedRequest(env, '/api/assets', {
    token,
    method: 'POST',
    body: JSON.stringify({ name: '现金', type: 'cash', currency: 'CNY' }),
  })
  const fundResponse = await authedRequest(env, '/api/assets', {
    token,
    method: 'POST',
    body: JSON.stringify({ name: '指数基金', type: 'fund', currency: 'CNY' }),
  })
  const cash = await cashResponse.json()
  const fund = await fundResponse.json()

  const firstSnapshotResponse = await authedRequest(env, '/api/snapshots', {
    token,
    method: 'POST',
    body: JSON.stringify({
      recordedAt: '2026-07-01T00:00:00.000Z',
      values: [
        { assetId: cash.id, amount: 1000 },
        { assetId: fund.id, amount: 2000, profit: 200, profitRate: 0.1111 },
      ],
    }),
  })
  assert.equal(firstSnapshotResponse.status, 201)

  const secondSnapshotResponse = await authedRequest(env, '/api/snapshots', {
    token,
    method: 'POST',
    body: JSON.stringify({
      recordedAt: '2026-07-02T00:00:00.000Z',
      values: [
        { assetId: cash.id, amount: 1500 },
      ],
    }),
  })

  assert.equal(secondSnapshotResponse.status, 201)
  const secondSnapshot = await secondSnapshotResponse.json()
  assert.equal(secondSnapshot.values.length, 2)
  assert.equal(secondSnapshot.values.find((value) => value.assetId === cash.id).amount, 1500)
  assert.equal(secondSnapshot.values.find((value) => value.assetId === fund.id).amount, 2000)

  const latestResponse = await authedRequest(env, '/api/snapshots/latest', { token })
  assert.equal(latestResponse.status, 200)
  assert.equal((await latestResponse.json()).snapshot.id, secondSnapshot.snapshot.id)
})

test('汇率更新会写入导出 JSON，导入旧备份时会补默认汇率', async () => {
  const env = createEnv()
  const token = await login(env)

  const ratesResponse = await authedRequest(env, '/api/rates', {
    token,
    method: 'POST',
    body: JSON.stringify({ USD: 7.3, HKD: 0.93 }),
  })
  assert.equal(ratesResponse.status, 200)
  const rates = await ratesResponse.json()
  assert.equal(rates.USD, 7.3)
  assert.equal(rates.HKD, 0.93)

  const exportResponse = await authedRequest(env, '/api/export', { token })
  assert.equal(exportResponse.status, 200)
  const exported = await exportResponse.json()
  assert.equal(exported.rates.USD, 7.3)

  const importResponse = await authedRequest(env, '/api/import', {
    token,
    method: 'POST',
    body: JSON.stringify({
      meta: { schemaVersion: 2, updatedAt: '2026-07-01T00:00:00.000Z' },
      assets: [],
      snapshots: [],
      snapshotValues: [],
    }),
  })
  assert.equal(importResponse.status, 200)

  const importedRatesResponse = await authedRequest(env, '/api/rates', { token })
  const importedRates = await importedRatesResponse.json()
  assert.equal(importedRates.USD, 7.2)
  assert.equal(importedRates.HKD, 0.92)
})

test('可以创建、更新、删除收入记录，并按发生日期倒序列出', async () => {
  const env = createEnv()
  const token = await login(env)

  const salaryResponse = await authedRequest(env, '/api/income-records', {
    token,
    method: 'POST',
    body: JSON.stringify({
      occurredAt: '2026-07-05',
      amount: '12000.235',
      category: 'salary',
      sourceName: ' 公司 ',
      note: ' 7月工资 ',
    }),
  })
  assert.equal(salaryResponse.status, 201)
  const salary = await salaryResponse.json()
  assert.equal(salary.occurredAt, '2026-07-05')
  assert.equal(salary.amount, 12000.24)
  assert.equal(salary.category, 'salary')
  assert.equal(salary.sourceName, '公司')
  assert.equal(salary.note, '7月工资')

  const bonusResponse = await authedRequest(env, '/api/income-records', {
    token,
    method: 'POST',
    body: JSON.stringify({
      occurredAt: '2026-08-01',
      amount: 3000,
      category: 'bonus',
    }),
  })
  assert.equal(bonusResponse.status, 201)

  const listResponse = await authedRequest(env, '/api/income-records', { token })
  assert.equal(listResponse.status, 200)
  const records = await listResponse.json()
  assert.deepEqual(records.map((record) => record.occurredAt), ['2026-08-01', '2026-07-05'])

  const updateResponse = await authedRequest(env, `/api/income-records/${salary.id}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({
      amount: 12500,
      category: 'side_income',
      sourceName: '',
      note: '',
    }),
  })
  assert.equal(updateResponse.status, 200)
  const updated = await updateResponse.json()
  assert.equal(updated.amount, 12500)
  assert.equal(updated.category, 'side_income')
  assert.equal(updated.sourceName, undefined)
  assert.equal(updated.note, undefined)

  const deleteResponse = await authedRequest(env, `/api/income-records/${salary.id}`, {
    token,
    method: 'DELETE',
  })
  assert.equal(deleteResponse.status, 200)
  assert.deepEqual(await deleteResponse.json(), { success: true })

  const afterDeleteResponse = await authedRequest(env, '/api/income-records', { token })
  const remaining = await afterDeleteResponse.json()
  assert.deepEqual(remaining.map((record) => record.category), ['bonus'])
})

test('收入记录接口会拒绝非法日期、非法分类和负数金额', async () => {
  const env = createEnv()
  const token = await login(env)

  const invalidDateResponse = await authedRequest(env, '/api/income-records', {
    token,
    method: 'POST',
    body: JSON.stringify({
      occurredAt: '2026-02-31',
      amount: 12000,
      category: 'salary',
    }),
  })
  assert.equal(invalidDateResponse.status, 400)
  assert.deepEqual(await invalidDateResponse.json(), { error: 'occurredAt must use a valid YYYY-MM-DD date' })

  const invalidCategoryResponse = await authedRequest(env, '/api/income-records', {
    token,
    method: 'POST',
    body: JSON.stringify({
      occurredAt: '2026-07-05',
      amount: 12000,
      category: 'unexpected',
    }),
  })
  assert.equal(invalidCategoryResponse.status, 400)
  assert.deepEqual(await invalidCategoryResponse.json(), { error: 'category must be a valid income category' })

  const negativeAmountResponse = await authedRequest(env, '/api/income-records', {
    token,
    method: 'POST',
    body: JSON.stringify({
      occurredAt: '2026-07-05',
      amount: -1,
      category: 'salary',
    }),
  })
  assert.equal(negativeAmountResponse.status, 400)
  assert.deepEqual(await negativeAmountResponse.json(), { error: 'amount must be a non-negative finite number' })
})

test('导入旧月收入会迁移为收入记录，导出新账本包含收入记录', async () => {
  const env = createEnv()
  const token = await login(env)

  const importResponse = await authedRequest(env, '/api/import', {
    token,
    method: 'POST',
    body: JSON.stringify({
      meta: { schemaVersion: 2, updatedAt: '2026-07-01T00:00:00.000Z' },
      assets: [],
      snapshots: [],
      snapshotValues: [],
      monthlyIncomes: [
        {
          id: 'legacy-income',
          month: '2026-07',
          salary: '12000.235',
          extraIncome: 800,
          housingFund: 1800,
          otherIncome: 0,
          note: ' 7月收入 ',
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
    }),
  })
  assert.equal(importResponse.status, 200)

  const exportResponse = await authedRequest(env, '/api/export', { token })
  const exported = await exportResponse.json()
  assert.deepEqual(
    exported.incomeRecords.map((record) => [record.id, record.occurredAt, record.category, record.amount]),
    [
      ['legacy-income-salary', '2026-07-01', 'salary', 12000.24],
      ['legacy-income-extraIncome', '2026-07-01', 'side_income', 800],
      ['legacy-income-housingFund', '2026-07-01', 'housing_fund', 1800],
    ],
  )
  assert.equal(exported.incomeRecords[0].note, '7月收入')
})

test('可以创建、更新、删除月收入记录，并按月份倒序列出', async () => {
  const env = createEnv()
  const token = await login(env)

  const julyResponse = await authedRequest(env, '/api/monthly-incomes', {
    token,
    method: 'POST',
    body: JSON.stringify({
      month: '2026-07',
      salary: '12000.235',
      extraIncome: 800,
      housingFund: 1800,
      otherIncome: 200,
      note: ' 7月收入 ',
    }),
  })
  assert.equal(julyResponse.status, 201)
  const july = await julyResponse.json()
  assert.equal(july.month, '2026-07')
  assert.equal(july.salary, 12000.24)
  assert.equal(july.note, '7月收入')

  const augustResponse = await authedRequest(env, '/api/monthly-incomes', {
    token,
    method: 'POST',
    body: JSON.stringify({
      month: '2026-08',
      salary: 13000,
    }),
  })
  assert.equal(augustResponse.status, 201)

  const listResponse = await authedRequest(env, '/api/monthly-incomes', { token })
  assert.equal(listResponse.status, 200)
  const incomes = await listResponse.json()
  assert.deepEqual(incomes.map((income) => income.month), ['2026-08', '2026-07'])

  const updateResponse = await authedRequest(env, `/api/monthly-incomes/${july.id}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({
      salary: 12500,
      note: '',
    }),
  })
  assert.equal(updateResponse.status, 200)
  const updated = await updateResponse.json()
  assert.equal(updated.salary, 12500)
  assert.equal(updated.note, undefined)

  const deleteResponse = await authedRequest(env, `/api/monthly-incomes/${july.id}`, {
    token,
    method: 'DELETE',
  })
  assert.equal(deleteResponse.status, 200)
  assert.deepEqual(await deleteResponse.json(), { success: true })

  const afterDeleteResponse = await authedRequest(env, '/api/monthly-incomes', { token })
  const remaining = await afterDeleteResponse.json()
  assert.deepEqual(remaining.map((income) => income.month), ['2026-08'])
})

test('月收入接口会拒绝重复月份、非法月份和负数金额', async () => {
  const env = createEnv()
  const token = await login(env)

  const createResponse = await authedRequest(env, '/api/monthly-incomes', {
    token,
    method: 'POST',
    body: JSON.stringify({
      month: '2026-07',
      salary: 12000,
    }),
  })
  assert.equal(createResponse.status, 201)

  const duplicateResponse = await authedRequest(env, '/api/monthly-incomes', {
    token,
    method: 'POST',
    body: JSON.stringify({
      month: '2026-07',
      salary: 13000,
    }),
  })
  assert.equal(duplicateResponse.status, 400)
  assert.deepEqual(await duplicateResponse.json(), { error: 'monthly income for 2026-07 already exists' })

  const invalidMonthResponse = await authedRequest(env, '/api/monthly-incomes', {
    token,
    method: 'POST',
    body: JSON.stringify({
      month: '2026-13',
      salary: 12000,
    }),
  })
  assert.equal(invalidMonthResponse.status, 400)
  assert.deepEqual(await invalidMonthResponse.json(), { error: 'month must use YYYY-MM with month 01-12' })

  const negativeAmountResponse = await authedRequest(env, '/api/monthly-incomes', {
    token,
    method: 'POST',
    body: JSON.stringify({
      month: '2026-08',
      salary: -1,
    }),
  })
  assert.equal(negativeAmountResponse.status, 400)
  assert.deepEqual(await negativeAmountResponse.json(), { error: 'salary must be a non-negative finite number' })
})

test('导入导出会保留月收入记录，旧备份会补空月收入数组', async () => {
  const env = createEnv()
  const token = await login(env)

  const importResponse = await authedRequest(env, '/api/import', {
    token,
    method: 'POST',
    body: JSON.stringify({
      meta: { schemaVersion: 2, updatedAt: '2026-07-01T00:00:00.000Z' },
      assets: [],
      snapshots: [],
      snapshotValues: [],
      monthlyIncomes: [
        {
          id: 'income-1',
          month: '2026-07',
          salary: '12000.235',
          extraIncome: 800,
          housingFund: 1800,
          otherIncome: 200,
          note: ' 7月收入 ',
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
    }),
  })
  assert.equal(importResponse.status, 200)

  const exportResponse = await authedRequest(env, '/api/export', { token })
  const exported = await exportResponse.json()
  assert.equal(exported.monthlyIncomes.length, 1)
  assert.equal(exported.monthlyIncomes[0].salary, 12000.24)
  assert.equal(exported.monthlyIncomes[0].note, '7月收入')

  const oldImportResponse = await authedRequest(env, '/api/import', {
    token,
    method: 'POST',
    body: JSON.stringify({
      meta: { schemaVersion: 2, updatedAt: '2026-08-01T00:00:00.000Z' },
      assets: [],
      snapshots: [],
      snapshotValues: [],
    }),
  })
  assert.equal(oldImportResponse.status, 200)

  const oldExportResponse = await authedRequest(env, '/api/export', { token })
  const oldExported = await oldExportResponse.json()
  assert.deepEqual(oldExported.monthlyIncomes, [])
})

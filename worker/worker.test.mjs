import assert from 'node:assert/strict'
import test from 'node:test'

import worker from './index.js'

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
    APP_USER_EMAIL: 'resmarch404@gmail.com',
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
      email: 'resmarch404@gmail.com',
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
      email: 'resmarch404@gmail.com',
      password: 'correct-password',
    }),
  })

  assert.equal(loginResponse.status, 200)
  const loginBody = await loginResponse.json()
  assert.equal(loginBody.user.email, 'resmarch404@gmail.com')
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
      email: 'resmarch404@gmail.com',
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
      email: 'resmarch404@gmail.com',
      password: '',
    }),
  })

  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: '登录配置未完成' })
})

test('没有 session 时不能访问受保护接口', async () => {
  const env = createEnv()

  const response = await request(env, '/api/assets')

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: '请先登录' })
})

test('可以创建资产并软删除资产', async () => {
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
  assert.equal(asset.isActive, true)

  const listResponse = await authedRequest(env, '/api/assets', { token })
  assert.equal(listResponse.status, 200)
  assert.equal((await listResponse.json()).length, 1)

  const deleteResponse = await authedRequest(env, `/api/assets/${asset.id}`, {
    token,
    method: 'DELETE',
  })
  assert.equal(deleteResponse.status, 200)
  assert.deepEqual(await deleteResponse.json(), { success: true })

  const afterDeleteResponse = await authedRequest(env, '/api/assets', { token })
  const assets = await afterDeleteResponse.json()
  assert.equal(assets[0].isActive, false)
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

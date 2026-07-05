import assert from 'node:assert/strict'
import { test } from 'node:test'
import worker from '../src/index.js'

function createKvMock() {
  const store = new Map()
  return {
    async get(key) {
      return store.get(key) ?? null
    },
    async put(key, value) {
      store.set(key, value)
    },
    async delete(key) {
      store.delete(key)
    },
  }
}

async function request(path, options = {}, env = { DEMO_KV: createKvMock() }) {
  const url = `https://worker.example${path}`
  return worker.fetch(new Request(url, options), env, {})
}

test('GET /api/health 返回 Worker 状态', async () => {
  const response = await request('/api/health')
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.service, 'cloudflare-worker-demo')
  assert.equal(body.kvBound, true)
})

test('先 PUT 再 GET /api/note 可以把一条便签存进 KV', async () => {
  const env = { DEMO_KV: createKvMock() }

  const putResponse = await request(
    '/api/note',
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note: 'hello worker kv' }),
    },
    env
  )
  const putBody = await putResponse.json()

  assert.equal(putResponse.status, 200)
  assert.equal(putBody.note, 'hello worker kv')
  assert.equal(typeof putBody.updatedAt, 'string')

  const getResponse = await request('/api/note', {}, env)
  const getBody = await getResponse.json()

  assert.equal(getResponse.status, 200)
  assert.equal(getBody.note, 'hello worker kv')
  assert.equal(getBody.updatedAt, putBody.updatedAt)
})

test('POST /api/note 返回方法不允许', async () => {
  const response = await request('/api/note', { method: 'POST' })
  const body = await response.json()

  assert.equal(response.status, 405)
  assert.equal(body.error, '方法不允许')
})

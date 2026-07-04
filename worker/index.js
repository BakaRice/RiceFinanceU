const DATA_KEY = 'finance:data:v2'
const SESSION_PREFIX = 'finance:session:'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

const DEFAULT_RATES = {
  USD: 7.2,
  HKD: 0.92,
  updatedAt: '',
}

const VALID_ASSET_TYPES = ['fund', 'stock', 'gold', 'deposit', 'cash', 'housing_fund', 'other']
const VALID_CURRENCIES = ['CNY', 'USD', 'HKD']
const INVESTMENT_TYPES = ['fund', 'stock', 'gold']

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
  })
}

function methodNotAllowed() {
  return json({ error: '方法不允许' }, { status: 405 })
}

function badRequest(message) {
  return json({ error: message }, { status: 400 })
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return toHex(new Uint8Array(hash))
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }
  return diff === 0
}

function createSessionToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

function createDefaultData() {
  const now = new Date().toISOString()
  return {
    meta: { schemaVersion: 2, updatedAt: now },
    assets: [],
    snapshots: [],
    snapshotValues: [],
    rates: { ...DEFAULT_RATES, updatedAt: now },
  }
}

function normalizeData(data) {
  if (!data || typeof data !== 'object') {
    return createDefaultData()
  }

  return {
    meta: data.meta && typeof data.meta === 'object'
      ? { schemaVersion: 2, updatedAt: String(data.meta.updatedAt || new Date().toISOString()) }
      : { schemaVersion: 2, updatedAt: new Date().toISOString() },
    assets: Array.isArray(data.assets) ? data.assets : [],
    snapshots: Array.isArray(data.snapshots) ? data.snapshots : [],
    snapshotValues: Array.isArray(data.snapshotValues) ? data.snapshotValues : [],
    rates: data.rates && typeof data.rates === 'object'
      ? { ...DEFAULT_RATES, ...data.rates }
      : { ...DEFAULT_RATES, updatedAt: new Date().toISOString() },
  }
}

async function readData(env) {
  const data = await env.FINANCE_KV.get(DATA_KEY, { type: 'json' })
  return normalizeData(data)
}

async function writeData(env, data) {
  const normalized = normalizeData(data)
  normalized.meta.updatedAt = new Date().toISOString()
  await env.FINANCE_KV.put(DATA_KEY, JSON.stringify(normalized))
  return normalized
}

async function readJsonBody(request) {
  return request.json().catch(() => null)
}

function isInvestmentType(type) {
  return INVESTMENT_TYPES.includes(type)
}

function isValidAssetType(type) {
  return VALID_ASSET_TYPES.includes(type)
}

function normalizeCurrency(currency) {
  return VALID_CURRENCIES.includes(currency) ? currency : 'CNY'
}

function createId() {
  return crypto.randomUUID()
}

function findLatestSnapshot(snapshots) {
  if (snapshots.length === 0) return null
  return [...snapshots].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0]
}

function completeSnapshotValues(previousValues, inputValues, newAssetIds) {
  const valuesByAsset = new Map()

  for (const previous of previousValues) {
    valuesByAsset.set(previous.assetId, {
      assetId: previous.assetId,
      amount: previous.amount,
      profit: previous.profit,
      profitRate: previous.profitRate,
      note: previous.note,
    })
  }

  inputValues.forEach((value, index) => {
    const assetId = value.assetId || newAssetIds[`inline_${index}`]
    valuesByAsset.set(assetId, {
      assetId,
      amount: Number(value.amount),
      profit: value.profit === undefined ? undefined : Number(value.profit),
      profitRate: value.profitRate === undefined ? undefined : Number(value.profitRate),
      note: value.note,
    })
  })

  return Array.from(valuesByAsset.values())
}

function validateImportData(data) {
  if (!data || typeof data !== 'object') return 'Invalid backup: request body is not an object'
  if (!data.meta || typeof data.meta.schemaVersion !== 'number') {
    return 'Invalid backup: missing or invalid meta.schemaVersion'
  }
  if (data.meta.schemaVersion !== 1 && data.meta.schemaVersion !== 2) {
    return `Unsupported schema version: ${data.meta.schemaVersion}. Supported: 1, 2`
  }
  if (!Array.isArray(data.assets)) return 'Invalid backup: assets must be an array'
  if (!Array.isArray(data.snapshots) && !Array.isArray(data.transactions)) {
    return 'Invalid backup: snapshots must be an array'
  }
  if (!Array.isArray(data.snapshotValues)) return 'Invalid backup: snapshotValues must be an array'
  return ''
}

function getBearerToken(request) {
  const header = request.headers.get('authorization') || ''
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return ''
  return token
}

async function createSession(env, email) {
  const token = createSessionToken()
  const tokenHash = await sha256Hex(token)
  const now = Date.now()
  const session = {
    email,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_SECONDS * 1000).toISOString(),
  }

  await env.FINANCE_KV.put(`${SESSION_PREFIX}${tokenHash}`, JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS,
  })

  return { token, session }
}

async function authenticate(request, env) {
  const token = getBearerToken(request)
  if (!token) return null

  const tokenHash = await sha256Hex(token)
  const session = await env.FINANCE_KV.get(`${SESSION_PREFIX}${tokenHash}`, { type: 'json' })
  if (!session || session.email !== normalizeEmail(env.APP_USER_EMAIL)) return null
  if (Date.parse(session.expiresAt) <= Date.now()) return null

  return session
}

async function handleLogin(request, env) {
  if (request.method !== 'POST') return methodNotAllowed()

  const body = await request.json().catch(() => null)
  const email = normalizeEmail(body?.email)
  const password = String(body?.password || '')
  const allowedEmail = normalizeEmail(env.APP_USER_EMAIL)
  const configuredPassword = String(env.APP_PASSWORD || '')

  if (!allowedEmail || !configuredPassword) {
    console.error({ message: 'Worker auth is not configured' })
    return json({ error: '登录配置未完成' }, { status: 500 })
  }

  const passwordHash = await sha256Hex(password)
  const expectedPasswordHash = await sha256Hex(configuredPassword)
  const passwordMatches = constantTimeEqual(passwordHash, expectedPasswordHash)

  if (email !== allowedEmail || !passwordMatches) {
    return json({ error: '邮箱或密码错误' }, { status: 401 })
  }

  const { token, session } = await createSession(env, allowedEmail)
  return json({
    token,
    expiresAt: session.expiresAt,
    user: { email: allowedEmail },
  })
}

function handleAuthConfig(request, env) {
  if (request.method !== 'GET') return methodNotAllowed()
  return json({ userEmail: normalizeEmail(env.APP_USER_EMAIL) })
}

async function handleLogout(request, env) {
  if (request.method !== 'POST') return methodNotAllowed()

  const token = getBearerToken(request)
  if (token) {
    const tokenHash = await sha256Hex(token)
    await env.FINANCE_KV.delete(`${SESSION_PREFIX}${tokenHash}`)
  }

  return json({ success: true })
}

async function handleAssets(request, env, segments) {
  const data = await readData(env)

  if (segments.length === 1) {
    if (request.method === 'GET') return json(data.assets)

    if (request.method === 'POST') {
      const body = await readJsonBody(request)
      const { name, type, currency, institution, note } = body || {}

      if (!name || typeof name !== 'string' || !name.trim()) {
        return badRequest('name is required and must be non-empty')
      }
      if (!type || !isValidAssetType(type)) {
        return badRequest(`type must be one of: ${VALID_ASSET_TYPES.join(', ')}`)
      }

      const now = new Date().toISOString()
      const asset = {
        id: createId(),
        name: name.trim(),
        type,
        currency: normalizeCurrency(currency),
        institution,
        isActive: true,
        note,
        createdAt: now,
        updatedAt: now,
      }

      data.assets.push(asset)
      await writeData(env, data)
      return json(asset, { status: 201 })
    }

    return methodNotAllowed()
  }

  if (segments.length === 2) {
    const id = segments[1]
    const assetIndex = data.assets.findIndex((asset) => asset.id === id)
    if (assetIndex === -1) return json({ error: 'Asset not found' }, { status: 404 })

    if (request.method === 'PATCH') {
      const body = await readJsonBody(request)
      if (body?.type && !isValidAssetType(body.type)) {
        return badRequest(`type must be one of: ${VALID_ASSET_TYPES.join(', ')}`)
      }
      data.assets[assetIndex] = {
        ...data.assets[assetIndex],
        ...(body || {}),
        id,
        updatedAt: new Date().toISOString(),
      }
      await writeData(env, data)
      return json(data.assets[assetIndex])
    }

    if (request.method === 'DELETE') {
      data.assets[assetIndex] = {
        ...data.assets[assetIndex],
        isActive: false,
        updatedAt: new Date().toISOString(),
      }
      await writeData(env, data)
      return json({ success: true })
    }

    return methodNotAllowed()
  }

  return json({ error: '接口不存在' }, { status: 404 })
}

function validateSnapshotInput(input, assets) {
  if (!input?.recordedAt || typeof input.recordedAt !== 'string') {
    return 'recordedAt is required'
  }
  if (Number.isNaN(Date.parse(input.recordedAt))) {
    return 'recordedAt must be a valid date/time'
  }
  if (!Array.isArray(input.values) || input.values.length === 0) {
    return 'values must be a non-empty array'
  }

  for (const value of input.values) {
    if (value.amount === undefined || !Number.isFinite(Number(value.amount))) {
      return 'each value must have a valid amount (finite number)'
    }

    if (value.assetId) {
      const asset = assets.find((item) => item.id === value.assetId)
      if (!asset) return `asset ${value.assetId} not found`
      if (!asset.isActive) return `asset ${value.assetId} is not active`
      if (!isInvestmentType(asset.type) && (value.profit !== undefined || value.profitRate !== undefined)) {
        return `balance asset ${value.assetId} cannot have profit or profitRate`
      }
    }

    if (!value.assetId && !value.asset) {
      return 'each value must have either assetId or inline asset'
    }

    if (value.asset) {
      if (!value.asset.name || !value.asset.type) return 'inline asset must have name and type'
      if (!isValidAssetType(value.asset.type)) {
        return `inline asset type must be one of: ${VALID_ASSET_TYPES.join(', ')}`
      }
    }
  }

  return ''
}

async function handleSnapshots(request, env, segments) {
  const data = await readData(env)

  if (segments.length === 1) {
    if (request.method === 'GET') {
      const snapshots = [...data.snapshots].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
      return json(snapshots)
    }

    if (request.method === 'POST') {
      const input = await readJsonBody(request)
      const validationError = validateSnapshotInput(input, data.assets)
      if (validationError) return badRequest(validationError)

      const newAssetIds = {}
      const now = new Date().toISOString()

      input.values.forEach((value, index) => {
        if (!value.assetId && value.asset) {
          const id = createId()
          data.assets.push({
            id,
            name: value.asset.name.trim(),
            type: value.asset.type,
            currency: normalizeCurrency(value.asset.currency),
            institution: value.asset.institution,
            isActive: true,
            note: value.asset.note,
            createdAt: now,
            updatedAt: now,
          })
          newAssetIds[`inline_${index}`] = id
        }
      })

      const latestSnapshot = findLatestSnapshot(data.snapshots)
      const previousValues = latestSnapshot
        ? data.snapshotValues.filter((value) => value.snapshotId === latestSnapshot.id)
        : []

      const snapshotId = createId()
      const completedValues = completeSnapshotValues(previousValues, input.values, newAssetIds)
      const values = completedValues.map((value) => ({
        ...value,
        id: createId(),
        snapshotId,
      }))
      const snapshot = {
        id: snapshotId,
        recordedAt: input.recordedAt,
        note: input.note,
        createdAt: now,
      }

      data.snapshots.push(snapshot)
      data.snapshotValues.push(...values)
      await writeData(env, data)
      return json({ snapshot, values }, { status: 201 })
    }

    return methodNotAllowed()
  }

  if (segments.length === 2 && segments[1] === 'latest') {
    if (request.method !== 'GET') return methodNotAllowed()
    const latest = findLatestSnapshot(data.snapshots)
    if (!latest) return json(null)
    const values = data.snapshotValues.filter((value) => value.snapshotId === latest.id)
    return json({ snapshot: latest, values })
  }

  if (segments.length === 2) {
    const id = segments[1]
    const snapshotIndex = data.snapshots.findIndex((snapshot) => snapshot.id === id)
    if (snapshotIndex === -1) return json({ error: 'Snapshot not found' }, { status: 404 })

    if (request.method === 'GET') {
      const snapshot = data.snapshots[snapshotIndex]
      const values = data.snapshotValues.filter((value) => value.snapshotId === snapshot.id)
      return json({ snapshot, values })
    }

    if (request.method === 'DELETE') {
      data.snapshots.splice(snapshotIndex, 1)
      data.snapshotValues = data.snapshotValues.filter((value) => value.snapshotId !== id)
      await writeData(env, data)
      return json({ success: true })
    }

    return methodNotAllowed()
  }

  return json({ error: '接口不存在' }, { status: 404 })
}

async function handleRates(request, env) {
  const data = await readData(env)

  if (request.method === 'GET') return json(data.rates)

  if (request.method === 'POST') {
    const body = await readJsonBody(request)
    if (body?.USD !== undefined && Number.isFinite(Number(body.USD)) && Number(body.USD) > 0) {
      data.rates.USD = Number(body.USD)
    }
    if (body?.HKD !== undefined && Number.isFinite(Number(body.HKD)) && Number(body.HKD) > 0) {
      data.rates.HKD = Number(body.HKD)
    }
    data.rates.updatedAt = new Date().toISOString()
    await writeData(env, data)
    return json(data.rates)
  }

  return methodNotAllowed()
}

async function handleExport(request, env) {
  if (request.method !== 'GET') return methodNotAllowed()
  const data = await readData(env)
  return json(data)
}

async function handleImport(request, env) {
  if (request.method !== 'POST') return methodNotAllowed()
  const body = await readJsonBody(request)
  const validationError = validateImportData(body)
  if (validationError) return badRequest(validationError)

  const imported = normalizeData({
    meta: { schemaVersion: 2, updatedAt: new Date().toISOString() },
    assets: body.assets,
    snapshots: body.snapshots || body.transactions || [],
    snapshotValues: body.snapshotValues,
    rates: body.rates || { ...DEFAULT_RATES, updatedAt: new Date().toISOString() },
  })

  await writeData(env, imported)
  return json({
    success: true,
    message: `Data imported: ${imported.assets.length} assets, ${imported.snapshots.length} snapshots, ${imported.snapshotValues.length} values`,
  })
}

async function handleApi(request, env) {
  const url = new URL(request.url)
  const segments = url.pathname.slice('/api/'.length).split('/').filter(Boolean)

  if (url.pathname === '/api/health' && request.method === 'GET') {
    return json({ status: 'ok', storage: 'kv' })
  }

  if (url.pathname === '/api/auth/login') {
    return handleLogin(request, env)
  }

  if (url.pathname === '/api/auth/config') {
    return handleAuthConfig(request, env)
  }

  if (url.pathname === '/api/auth/logout') {
    return handleLogout(request, env)
  }

  const session = await authenticate(request, env)
  if (!session) {
    return json({ error: '请先登录' }, { status: 401 })
  }

  if (segments[0] === 'assets') return handleAssets(request, env, segments)
  if (segments[0] === 'snapshots') return handleSnapshots(request, env, segments)
  if (segments[0] === 'snapshot-values' && segments.length === 1 && request.method === 'GET') {
    const data = await readData(env)
    return json(data.snapshotValues)
  }
  if (segments[0] === 'rates' && segments.length === 1) return handleRates(request, env)
  if (segments[0] === 'export' && segments.length === 1) return handleExport(request, env)
  if (segments[0] === 'import' && segments.length === 1) return handleImport(request, env)

  return json({ error: '接口不存在' }, { status: 404 })
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url)
      if (url.pathname.startsWith('/api/')) {
        return await handleApi(request, env, ctx)
      }

      return json({ error: 'Not found' }, { status: 404 })
    } catch (error) {
      console.error({ message: 'Worker request failed', error: error?.message })
      return json({ error: '服务器错误' }, { status: 500 })
    }
  },
}

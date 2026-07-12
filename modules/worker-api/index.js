// RiceFinanceU 生产 API。
//
// 这个 Worker 刻意保持很薄：一个个人账号、一个 KV namespace、
// 一份完整的资产账本 JSON。当前产品还是低频个人使用，这样能把部署和维护成本压低。
const DATA_KEY = 'finance:data:v2'
const SESSION_PREFIX = 'finance:session:'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

// 旧备份或空 KV 里可能还没有汇率字段，先用这组默认值兜底。
// 用户后续可以在界面里通过 /api/rates 更新。
const DEFAULT_RATES = {
  USD: 7.2,
  HKD: 0.92,
  updatedAt: '',
}

// 这些常量镜像前端领域模型。新增资产类型时，需要和
// src/types/finance.ts、src/domain/assets.ts 保持一致。
const VALID_ASSET_TYPES = ['fund', 'stock', 'gold', 'deposit', 'cash', 'housing_fund', 'other']
const VALID_ASSET_ENTRY_STATUSES = ['normal', 'paused']
const VALID_CURRENCIES = ['CNY', 'USD', 'HKD']
const INVESTMENT_TYPES = ['fund', 'stock', 'gold']
const VALID_DCA_FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly']
const VALID_INCOME_CATEGORIES = ['salary', 'bonus', 'side_income', 'housing_fund', 'investment', 'other']
// 镜像 src/domain/assets.ts。Worker 是生产 API，不能假设所有客户端都会先
// 按前端逻辑清理资产档案字段。
const ASSET_PROFILE_FIELDS = {
  fund: ['fundCode', 'fundCategory', 'marketTheme', 'holdingPlatform'],
  stock: ['ticker', 'exchange', 'brokerAccount', 'industryTag'],
  gold: ['holdingForm', 'custodian', 'unit', 'sourceNote'],
  deposit: ['bank', 'depositType', 'term', 'maturityDate', 'annualRate'],
  cash: ['accountChannel', 'purposeTag', 'availabilityNote'],
  housing_fund: ['contributionCity', 'accountOwner', 'managementNote'],
  other: ['customCategory', 'ownershipNote', 'managementNote', 'reminderDate'],
}

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

// 调用方传进来的是 SHA-256 hex 字符串，长度理论上固定。
// 这里避免用普通字符串相等比较泄露密码匹配进度。
function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }
  return diff === 0
}

// 生成只返回给客户端一次的 bearer token。KV 里只保存它的 hash，
// 即使 KV 数据被导出，也不会直接暴露可用 session token。
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
    incomeRecords: [],
    monthlyIncomes: [],
    rates: { ...DEFAULT_RATES, updatedAt: now },
  }
}

function normalizeAssetEntryStatus(asset) {
  if (VALID_ASSET_ENTRY_STATUSES.includes(asset?.entryStatus)) return asset.entryStatus
  return asset?.isActive === false ? 'paused' : 'normal'
}

function normalizeAsset(asset) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return null
  const { isActive: _legacyIsActive, ...rest } = asset
  return {
    ...rest,
    entryStatus: normalizeAssetEntryStatus(asset),
  }
}

// 把空 KV、现有 KV 数据和导入备份统一整理成当前 v2 结构。
// 这样即使旧备份没有 rates 字段，也能继续兼容。
function normalizeData(data) {
  if (!data || typeof data !== 'object') {
    return createDefaultData()
  }

  const monthlyIncomes = Array.isArray(data.monthlyIncomes)
    ? data.monthlyIncomes
        .map((income) => sanitizeImportedMonthlyIncome(income))
        .filter(Boolean)
    : []
  const incomeRecords = Array.isArray(data.incomeRecords)
    ? data.incomeRecords
        .map((record) => sanitizeImportedIncomeRecord(record))
        .filter(Boolean)
    : migrateMonthlyIncomesToIncomeRecords(monthlyIncomes)

  return {
    meta: data.meta && typeof data.meta === 'object'
      ? { schemaVersion: 2, updatedAt: String(data.meta.updatedAt || new Date().toISOString()) }
      : { schemaVersion: 2, updatedAt: new Date().toISOString() },
    assets: Array.isArray(data.assets) ? data.assets.map(normalizeAsset).filter(Boolean) : [],
    snapshots: Array.isArray(data.snapshots) ? data.snapshots : [],
    snapshotValues: Array.isArray(data.snapshotValues) ? data.snapshotValues : [],
    incomeRecords,
    monthlyIncomes,
    rates: data.rates && typeof data.rates === 'object'
      ? { ...DEFAULT_RATES, ...data.rates }
      : { ...DEFAULT_RATES, updatedAt: new Date().toISOString() },
  }
}

// 当前存储策略：KV 里保存一份完整资产账本 JSON。
// 这对备份和个人维护很友好，但不是高并发模型：多个客户端同时写入时，
// 后写入可能覆盖先写入。以当前自用、低频流程来看，这个取舍可以接受。
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

function sanitizeAssetProfile(type, profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return undefined

  const cleaned = {}
  // 只保存当前资产类型允许的档案字段，避免编辑器切换类型后，
  // 被隐藏的旧字段继续留在数据里。
  for (const key of ASSET_PROFILE_FIELDS[type] || []) {
    const value = profile[key]
    if (typeof value !== 'string') continue

    const trimmed = value.trim()
    if (trimmed) {
      cleaned[key] = trimmed
    }
  }

  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}

function sanitizeDcaPlan(type, plan) {
  if (!isInvestmentType(type)) return undefined
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return undefined
  if (plan.enabled !== true) return undefined

  const frequency = VALID_DCA_FREQUENCIES.includes(plan.frequency) ? plan.frequency : ''
  const plannedContribution = parsePositiveNumber(plan.plannedContribution)
  if (!frequency || plannedContribution === undefined) return undefined

  const targetAmount = parsePositiveNumber(plan.targetAmount)
  const targetDate = parseDateOnly(plan.targetDate)
  const toleranceRate = parseNonNegativeNumber(plan.toleranceRate)
  const note = typeof plan.note === 'string' ? plan.note.trim() : ''

  return {
    enabled: true,
    frequency,
    ...(frequency === 'daily'
      ? { excludeWeekends: typeof plan.excludeWeekends === 'boolean' ? plan.excludeWeekends : true }
      : {}),
    plannedContribution,
    ...(targetAmount !== undefined ? { targetAmount } : {}),
    ...(targetDate ? { targetDate } : {}),
    ...(toleranceRate !== undefined ? { toleranceRate } : {}),
    ...(note ? { note } : {}),
  }
}

function hasOwnImportField(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function isImportNumberLike(value) {
  return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')
}

function validateImportedDcaPlan(type, plan) {
  if (!isInvestmentType(type)) return 'is only allowed for investment assets'
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return 'must be an object'
  if (plan.enabled !== true) return 'must be enabled'
  if (!VALID_DCA_FREQUENCIES.includes(plan.frequency)) return 'has an invalid frequency'
  if (!isImportNumberLike(plan.plannedContribution) || parsePositiveNumber(plan.plannedContribution) === undefined) {
    return 'plannedContribution must be greater than 0'
  }
  if (hasOwnImportField(plan, 'targetAmount') && (
    !isImportNumberLike(plan.targetAmount) || parsePositiveNumber(plan.targetAmount) === undefined
  )) {
    return 'targetAmount must be greater than 0'
  }
  if (hasOwnImportField(plan, 'targetDate') && !parseDateOnly(plan.targetDate)) {
    return 'targetDate must be a valid YYYY-MM-DD date'
  }
  if (hasOwnImportField(plan, 'toleranceRate') && (
    !isImportNumberLike(plan.toleranceRate) || parseNonNegativeNumber(plan.toleranceRate) === undefined
  )) {
    return 'toleranceRate must be non-negative'
  }
  if (hasOwnImportField(plan, 'note') && typeof plan.note !== 'string') {
    return 'note must be a string'
  }
  if (hasOwnImportField(plan, 'excludeWeekends')) {
    if (plan.frequency !== 'daily') return 'excludeWeekends is only allowed for daily plans'
    if (typeof plan.excludeWeekends !== 'boolean') return 'excludeWeekends must be a boolean'
  }
  return ''
}

function parsePositiveNumber(value) {
  if (value === undefined || value === null || value === '') return undefined
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined
}

function parseNonNegativeNumber(value) {
  if (value === undefined || value === null || value === '') return undefined
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : undefined
}

function roundMoney(value) {
  return Math.round(value * 100) / 100
}

function parseDateOnly(value) {
  if (typeof value !== 'string') return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, monthIndex, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return undefined
  }
  return value
}

function isValidMonthKey(value) {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return false
  const month = Number(match[2])
  return month >= 1 && month <= 12
}

function parseMonthlyIncomeAmount(body, key, defaultValue = 0) {
  if (body?.[key] === undefined || body?.[key] === null || body?.[key] === '') {
    return { value: defaultValue }
  }

  const numberValue = Number(body[key])
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return { error: `${key} must be a non-negative finite number` }
  }

  return { value: roundMoney(numberValue) }
}

function sanitizeMonthlyIncomeInput(body, existing = undefined) {
  const month = body?.month === undefined ? existing?.month : String(body.month || '').trim()
  if (!isValidMonthKey(month)) {
    return { error: 'month must use YYYY-MM with month 01-12' }
  }

  const salary = parseMonthlyIncomeAmount(body, 'salary', existing?.salary || 0)
  if (salary.error) return { error: salary.error }
  const extraIncome = parseMonthlyIncomeAmount(body, 'extraIncome', existing?.extraIncome || 0)
  if (extraIncome.error) return { error: extraIncome.error }
  const housingFund = parseMonthlyIncomeAmount(body, 'housingFund', existing?.housingFund || 0)
  if (housingFund.error) return { error: housingFund.error }
  const otherIncome = parseMonthlyIncomeAmount(body, 'otherIncome', existing?.otherIncome || 0)
  if (otherIncome.error) return { error: otherIncome.error }

  const note = typeof body?.note === 'string'
    ? body.note.trim()
    : typeof existing?.note === 'string'
      ? existing.note
      : ''

  return {
    value: {
      month,
      salary: salary.value,
      extraIncome: extraIncome.value,
      housingFund: housingFund.value,
      otherIncome: otherIncome.value,
      ...(note ? { note } : {}),
    },
  }
}

function sanitizeImportedMonthlyIncome(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null

  const sanitized = sanitizeMonthlyIncomeInput(record)
  if (sanitized.error) return null

  const now = new Date().toISOString()
  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id : createId(),
    ...sanitized.value,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now,
  }
}

function parseIncomeRecordAmount(body, key = 'amount', defaultValue = undefined) {
  if (body?.[key] === undefined || body?.[key] === null || body?.[key] === '') {
    return defaultValue === undefined ? { error: `${key} must be a non-negative finite number` } : { value: defaultValue }
  }

  const numberValue = Number(body[key])
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return { error: `${key} must be a non-negative finite number` }
  }

  return { value: roundMoney(numberValue) }
}

function sanitizeIncomeRecordInput(body, existing = undefined) {
  const occurredAt = body?.occurredAt === undefined
    ? existing?.occurredAt
    : String(body.occurredAt || '').trim()
  if (!parseDateOnly(occurredAt)) {
    return { error: 'occurredAt must use a valid YYYY-MM-DD date' }
  }

  const category = body?.category === undefined
    ? existing?.category
    : String(body.category || '').trim()
  if (!VALID_INCOME_CATEGORIES.includes(category)) {
    return { error: 'category must be a valid income category' }
  }

  const amount = parseIncomeRecordAmount(body, 'amount', existing?.amount)
  if (amount.error) return { error: amount.error }

  const sourceName = typeof body?.sourceName === 'string'
    ? body.sourceName.trim()
    : typeof existing?.sourceName === 'string'
      ? existing.sourceName
      : ''
  const note = typeof body?.note === 'string'
    ? body.note.trim()
    : typeof existing?.note === 'string'
      ? existing.note
      : ''

  return {
    value: {
      occurredAt,
      amount: amount.value,
      category,
      ...(sourceName ? { sourceName } : {}),
      ...(note ? { note } : {}),
    },
  }
}

function sanitizeImportedIncomeRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null

  const sanitized = sanitizeIncomeRecordInput(record)
  if (sanitized.error) return null

  const now = new Date().toISOString()
  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id : createId(),
    ...sanitized.value,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now,
  }
}

function migrateMonthlyIncomesToIncomeRecords(monthlyIncomes) {
  const records = []

  for (const income of monthlyIncomes) {
    if (!income || !isValidMonthKey(income.month)) continue

    const occurredAt = `${income.month}-01`
    const mappings = [
      { key: 'salary', category: 'salary' },
      { key: 'extraIncome', category: 'side_income' },
      { key: 'housingFund', category: 'housing_fund' },
      { key: 'otherIncome', category: 'other' },
    ]

    for (const mapping of mappings) {
      const amount = roundMoney(Number(income[mapping.key] || 0))
      if (!Number.isFinite(amount) || amount <= 0) continue

      records.push({
        id: `${income.id}-${mapping.key}`,
        occurredAt,
        amount,
        category: mapping.category,
        ...(income.note ? { note: income.note } : {}),
        createdAt: income.createdAt,
        updatedAt: income.updatedAt,
      })
    }
  }

  return records
}

// 浏览器和小程序客户端都以 Worker 生成的 ID 为准。
function createId() {
  return crypto.randomUUID()
}

function findLatestSnapshot(snapshots) {
  if (snapshots.length === 0) return null
  return [...snapshots].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0]
}

function completeSnapshotValues(previousValues, inputValues, newAssetIds) {
  const valuesByAsset = new Map()

  // 已保存的快照必须是完整组合状态：先继承上一份完整快照，
  // 再用本次提交的资产值覆盖其中一部分。
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

// 导入校验只做结构守门，不做完整财务审计。
// 浏览器端负责更丰富的预览，Worker 负责挡掉明显不兼容的备份形状。
function validateImportData(data) {
  if (!data || typeof data !== 'object') return 'Invalid backup: request body is not an object'
  if (!data.meta || typeof data.meta.schemaVersion !== 'number') {
    return 'Invalid backup: missing or invalid meta.schemaVersion'
  }
  if (data.meta.schemaVersion !== 1 && data.meta.schemaVersion !== 2) {
    return `Unsupported schema version: ${data.meta.schemaVersion}. Supported: 1, 2`
  }
  if (!Array.isArray(data.assets)) return 'Invalid backup: assets must be an array'
  for (const asset of data.assets) {
    if (asset?.entryStatus !== undefined && !VALID_ASSET_ENTRY_STATUSES.includes(asset.entryStatus)) {
      return `Invalid backup: asset entryStatus must be one of: ${VALID_ASSET_ENTRY_STATUSES.join(', ')}`
    }
    if (asset?.entryStatus === undefined && typeof asset?.isActive !== 'boolean') {
      return 'Invalid backup: asset must include a valid entryStatus or legacy isActive'
    }
  }
  if (!Array.isArray(data.snapshots) && !Array.isArray(data.transactions)) {
    return 'Invalid backup: snapshots must be an array'
  }
  if (!Array.isArray(data.snapshotValues)) return 'Invalid backup: snapshotValues must be an array'
  return ''
}

function normalizeStoredProfitRate(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -1) return null
  return Math.trunc(value * 10000) / 10000
}

function getBearerToken(request) {
  const header = request.headers.get('authorization') || ''
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return ''
  return token
}

// session 记录是短 JSON，用 bearer token 的 hash 作为 key。
// KV 的 expirationTtl 负责 30 天后自动清理。
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

// 所有业务接口都走同一套 bearer token 校验。
// 只有登录和健康检查是公开接口。
async function authenticate(request, env) {
  const token = getBearerToken(request)
  if (!token) return null

  const tokenHash = await sha256Hex(token)
  const session = await env.FINANCE_KV.get(`${SESSION_PREFIX}${tokenHash}`, { type: 'json' })
  if (!session || session.email !== normalizeEmail(env.APP_USER_EMAIL)) return null
  if (Date.parse(session.expiresAt) <= Date.now()) return null

  return session
}

// 单用户登录：邮箱和密码来自 Wrangler secrets 或本地 .dev.vars，
// 不写进源码。
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

async function handleLogout(request, env) {
  if (request.method !== 'POST') return methodNotAllowed()

  const token = getBearerToken(request)
  if (token) {
    const tokenHash = await sha256Hex(token)
    await env.FINANCE_KV.delete(`${SESSION_PREFIX}${tokenHash}`)
  }

  return json({ success: true })
}

// 资产接口维护主数据。删除采用软删除，历史快照仍然可以指向原资产 ID。
async function handleAssets(request, env, segments) {
  const data = await readData(env)

  if (segments.length === 1) {
    if (request.method === 'GET') return json(data.assets)

    if (request.method === 'POST') {
      const body = await readJsonBody(request)
      const { name, type, currency, institution, note, profile, dcaPlan } = body || {}

      if (!name || typeof name !== 'string' || !name.trim()) {
        return badRequest('name is required and must be non-empty')
      }
      if (!type || !isValidAssetType(type)) {
        return badRequest(`type must be one of: ${VALID_ASSET_TYPES.join(', ')}`)
      }

      const now = new Date().toISOString()
      const assetProfile = sanitizeAssetProfile(type, profile)
      const assetDcaPlan = sanitizeDcaPlan(type, dcaPlan)
      const asset = {
        id: createId(),
        name: name.trim(),
        type,
        currency: normalizeCurrency(currency),
        institution,
        ...(assetProfile ? { profile: assetProfile } : {}),
        ...(assetDcaPlan ? { dcaPlan: assetDcaPlan } : {}),
        entryStatus: 'normal',
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
      if (body?.entryStatus !== undefined && !VALID_ASSET_ENTRY_STATUSES.includes(body.entryStatus)) {
        return badRequest(`entryStatus must be one of: ${VALID_ASSET_ENTRY_STATUSES.join(', ')}`)
      }
      const nextType = body?.type || data.assets[assetIndex].type
      // profile 未传时保留并重新清洗已有档案；传入 {} 时表示清空档案。
      const nextProfile = sanitizeAssetProfile(
        nextType,
        body?.profile !== undefined ? body.profile : data.assets[assetIndex].profile,
      )
      const nextDcaPlan = sanitizeDcaPlan(
        nextType,
        body?.dcaPlan !== undefined ? body.dcaPlan : data.assets[assetIndex].dcaPlan,
      )
      const nextAsset = normalizeAsset({
        ...data.assets[assetIndex],
        ...(body || {}),
        id,
        type: nextType,
        updatedAt: new Date().toISOString(),
      })
      if (nextProfile) {
        nextAsset.profile = nextProfile
      } else {
        delete nextAsset.profile
      }
      if (nextDcaPlan) {
        nextAsset.dcaPlan = nextDcaPlan
      } else {
        delete nextAsset.dcaPlan
      }
      data.assets[assetIndex] = nextAsset
      await writeData(env, data)
      return json(data.assets[assetIndex])
    }

    if (request.method === 'DELETE') {
      const asset = data.assets[assetIndex]
      const body = await readJsonBody(request)
      if (body?.confirmName !== asset.name) {
        return badRequest('confirmName must exactly match asset name')
      }
      if (data.snapshotValues.some((value) => value.assetId === id)) {
        return json({
          error: '该资产已有历史快照，只能暂停录入',
          code: 'ASSET_HAS_SNAPSHOT_HISTORY',
        }, { status: 409 })
      }
      data.assets.splice(assetIndex, 1)
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
      if (asset.entryStatus !== 'normal') return `asset ${value.assetId} is paused for entry`
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

// 快照接口保存某个时间点的组合状态。
// POST 可以只提交部分资产，写入 KV 前会扩展成完整快照。
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
          // 兼容仍会在快照里内联新增资产的客户端。
          // 主界面仍应优先在资产管理里维护主数据。
          const id = createId()
          const profile = sanitizeAssetProfile(value.asset.type, value.asset.profile)
          const dcaPlan = sanitizeDcaPlan(value.asset.type, value.asset.dcaPlan)
          data.assets.push({
            id,
            name: value.asset.name.trim(),
            type: value.asset.type,
            currency: normalizeCurrency(value.asset.currency),
            institution: value.asset.institution,
            ...(profile ? { profile } : {}),
            ...(dcaPlan ? { dcaPlan } : {}),
            entryStatus: 'normal',
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

// 汇率和资产账本一起存储，让导出的 JSON 自包含；
// 旧备份没有汇率时也能补默认值。
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

async function handleMonthlyIncomes(request, env, segments) {
  const data = await readData(env)

  if (segments.length === 1) {
    if (request.method === 'GET') {
      return json([...data.monthlyIncomes].sort((a, b) => b.month.localeCompare(a.month)))
    }

    if (request.method === 'POST') {
      const body = await readJsonBody(request)
      const sanitized = sanitizeMonthlyIncomeInput(body)
      if (sanitized.error) return badRequest(sanitized.error)

      if (data.monthlyIncomes.some((income) => income.month === sanitized.value.month)) {
        return badRequest(`monthly income for ${sanitized.value.month} already exists`)
      }

      const now = new Date().toISOString()
      const income = {
        id: createId(),
        ...sanitized.value,
        createdAt: now,
        updatedAt: now,
      }

      data.monthlyIncomes.push(income)
      await writeData(env, data)
      return json(income, { status: 201 })
    }

    return methodNotAllowed()
  }

  if (segments.length === 2) {
    const id = segments[1]
    const incomeIndex = data.monthlyIncomes.findIndex((income) => income.id === id)
    if (incomeIndex === -1) return json({ error: 'Monthly income not found' }, { status: 404 })

    if (request.method === 'PATCH') {
      const body = await readJsonBody(request)
      const existing = data.monthlyIncomes[incomeIndex]
      const sanitized = sanitizeMonthlyIncomeInput(body, existing)
      if (sanitized.error) return badRequest(sanitized.error)

      if (data.monthlyIncomes.some((income) => income.id !== id && income.month === sanitized.value.month)) {
        return badRequest(`monthly income for ${sanitized.value.month} already exists`)
      }

      const nextIncome = {
        ...existing,
        ...sanitized.value,
        updatedAt: new Date().toISOString(),
      }
      if (!sanitized.value.note) {
        delete nextIncome.note
      }

      data.monthlyIncomes[incomeIndex] = nextIncome
      await writeData(env, data)
      return json(nextIncome)
    }

    if (request.method === 'DELETE') {
      data.monthlyIncomes.splice(incomeIndex, 1)
      await writeData(env, data)
      return json({ success: true })
    }

    return methodNotAllowed()
  }

  return json({ error: '接口不存在' }, { status: 404 })
}

async function handleIncomeRecords(request, env, segments) {
  const data = await readData(env)

  if (segments.length === 1) {
    if (request.method === 'GET') {
      return json([...data.incomeRecords].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)))
    }

    if (request.method === 'POST') {
      const body = await readJsonBody(request)
      const sanitized = sanitizeIncomeRecordInput(body)
      if (sanitized.error) return badRequest(sanitized.error)

      const now = new Date().toISOString()
      const record = {
        id: createId(),
        ...sanitized.value,
        createdAt: now,
        updatedAt: now,
      }

      data.incomeRecords.push(record)
      await writeData(env, data)
      return json(record, { status: 201 })
    }

    return methodNotAllowed()
  }

  if (segments.length === 2 && segments[1] === 'batch') {
    if (request.method !== 'POST') return methodNotAllowed()

    const body = await readJsonBody(request)
    const creates = Array.isArray(body?.creates) ? body.creates : null
    const updates = Array.isArray(body?.updates) ? body.updates : null
    const deletes = Array.isArray(body?.deletes) ? body.deletes : null
    if (!creates || !updates || !deletes) {
      return badRequest('creates, updates and deletes must be arrays')
    }

    const existingById = new Map(data.incomeRecords.map((record) => [record.id, record]))
    const updateIds = updates.map((input) => input?.id)
    const deleteIds = deletes
    if (
      new Set(updateIds).size !== updateIds.length ||
      new Set(deleteIds).size !== deleteIds.length
    ) {
      return badRequest('income batch contains duplicate ids')
    }
    if (updateIds.some((id) => deleteIds.includes(id))) {
      return badRequest('income batch contains conflicting operations')
    }
    if (
      [...updateIds, ...deleteIds].some(
        (id) => typeof id !== 'string' || !existingById.has(id),
      )
    ) {
      return json({ error: 'Income record not found' }, { status: 404 })
    }

    const sanitizedCreates = []
    for (const input of creates) {
      const sanitized = sanitizeIncomeRecordInput(input)
      if (sanitized.error) return badRequest(sanitized.error)
      sanitizedCreates.push(sanitized.value)
    }

    const sanitizedUpdates = []
    for (const input of updates) {
      if (
        !Object.prototype.hasOwnProperty.call(input || {}, 'occurredAt') ||
        !Object.prototype.hasOwnProperty.call(input || {}, 'category') ||
        !Object.prototype.hasOwnProperty.call(input || {}, 'amount')
      ) {
        return badRequest('income batch updates require occurredAt, category and amount')
      }
      const sanitized = sanitizeIncomeRecordInput(input)
      if (sanitized.error) return badRequest(sanitized.error)
      sanitizedUpdates.push({ id: input.id, value: sanitized.value })
    }

    const now = new Date().toISOString()
    const deletedIds = new Set(deleteIds)
    const updatedById = new Map(sanitizedUpdates.map(({ id, value }) => [id, value]))
    data.incomeRecords = data.incomeRecords
      .filter((record) => !deletedIds.has(record.id))
      .map((record) => {
        const value = updatedById.get(record.id)
        if (!value) return record
        const updatedRecord = { ...record, ...value, updatedAt: now }
        if (!value.sourceName) delete updatedRecord.sourceName
        if (!value.note) delete updatedRecord.note
        return updatedRecord
      })
    data.incomeRecords.push(...sanitizedCreates.map((value) => ({
      id: createId(),
      ...value,
      createdAt: now,
      updatedAt: now,
    })))

    await writeData(env, data)
    return json({
      records: [...data.incomeRecords].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    })
  }

  if (segments.length === 2) {
    const id = segments[1]
    const recordIndex = data.incomeRecords.findIndex((record) => record.id === id)
    if (recordIndex === -1) return json({ error: 'Income record not found' }, { status: 404 })

    if (request.method === 'PATCH') {
      const body = await readJsonBody(request)
      const existing = data.incomeRecords[recordIndex]
      const sanitized = sanitizeIncomeRecordInput(body, existing)
      if (sanitized.error) return badRequest(sanitized.error)

      const nextRecord = {
        ...existing,
        ...sanitized.value,
        updatedAt: new Date().toISOString(),
      }
      if (!sanitized.value.sourceName) {
        delete nextRecord.sourceName
      }
      if (!sanitized.value.note) {
        delete nextRecord.note
      }

      data.incomeRecords[recordIndex] = nextRecord
      await writeData(env, data)
      return json(nextRecord)
    }

    if (request.method === 'DELETE') {
      data.incomeRecords.splice(recordIndex, 1)
      await writeData(env, data)
      return json({ success: true })
    }

    return methodNotAllowed()
  }

  return json({ error: '接口不存在' }, { status: 404 })
}

// 导出返回标准化后的完整 KV 文档，用于备份和手动迁移。
// 这里不要隐藏字段，因为这份 JSON 本身就是恢复介质。
async function handleExport(request, env) {
  if (request.method !== 'GET') return methodNotAllowed()
  const data = await readData(env)
  return json(data)
}

// 导入会整体替换 KV 文档。它兼容 v1 里旧的 transactions 字段，
// 统一转换成 snapshots 后再按 v2 写回。
async function handleImport(request, env) {
  if (request.method !== 'POST') return methodNotAllowed()
  const body = await readJsonBody(request)
  const validationError = validateImportData(body)
  if (validationError) return badRequest(validationError)

  for (let index = 0; index < body.assets.length; index++) {
    const asset = body.assets[index]
    if (asset?.dcaPlan === undefined) continue
    const dcaPlanError = validateImportedDcaPlan(asset.type, asset.dcaPlan)
    if (dcaPlanError) {
      return badRequest(`Invalid backup: assets[${index}].dcaPlan ${dcaPlanError}`)
    }
  }

  const snapshotValues = []
  for (let index = 0; index < body.snapshotValues.length; index++) {
    const value = body.snapshotValues[index]
    const normalizedValue = { ...value }
    if (value?.profitRate !== undefined) {
      const normalizedProfitRate = normalizeStoredProfitRate(value.profitRate)
      if (normalizedProfitRate === null) {
        return badRequest(`Invalid backup: snapshotValues[${index}].profitRate is invalid`)
      }
      normalizedValue.profitRate = normalizedProfitRate
    }
    snapshotValues.push(normalizedValue)
  }

  const imported = normalizeData({
    meta: { schemaVersion: 2, updatedAt: new Date().toISOString() },
    assets: body.assets.map((asset) => {
      const profile = sanitizeAssetProfile(asset.type, asset.profile)
      const dcaPlan = sanitizeDcaPlan(asset.type, asset.dcaPlan)
      const normalizedAsset = { ...asset }
      if (profile) {
        normalizedAsset.profile = profile
      } else {
        delete normalizedAsset.profile
      }
      if (dcaPlan) {
        normalizedAsset.dcaPlan = dcaPlan
      } else {
        delete normalizedAsset.dcaPlan
      }
      return normalizedAsset
    }),
    snapshots: body.snapshots || body.transactions || [],
    snapshotValues,
    incomeRecords: Array.isArray(body.incomeRecords)
      ? body.incomeRecords
          .map((record) => sanitizeImportedIncomeRecord(record))
          .filter(Boolean)
      : Array.isArray(body.monthlyIncomes)
        ? migrateMonthlyIncomesToIncomeRecords(
            body.monthlyIncomes
              .map((income) => sanitizeImportedMonthlyIncome(income))
              .filter(Boolean),
          )
        : [],
    monthlyIncomes: Array.isArray(body.monthlyIncomes)
      ? body.monthlyIncomes
          .map((income) => sanitizeImportedMonthlyIncome(income))
          .filter(Boolean)
      : [],
    rates: body.rates || { ...DEFAULT_RATES, updatedAt: new Date().toISOString() },
  })

  await writeData(env, imported)
  return json({
    success: true,
    message: `Data imported: ${imported.assets.length} assets, ${imported.snapshots.length} snapshots, ${imported.snapshotValues.length} values, ${imported.incomeRecords.length} income records`,
  })
}

// API 路由边界：
// - health/login/logout 是公开接口；
// - 下面的资产业务接口都需要有效 session。
async function handleApi(request, env) {
  const url = new URL(request.url)
  const segments = url.pathname.slice('/api/'.length).split('/').filter(Boolean)

  if (url.pathname === '/api/health' && request.method === 'GET') {
    return json({ status: 'ok', storage: 'kv' })
  }

  if (url.pathname === '/api/auth/login') {
    return handleLogin(request, env)
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
  if (segments[0] === 'income-records') return handleIncomeRecords(request, env, segments)
  if (segments[0] === 'monthly-incomes') return handleMonthlyIncomes(request, env, segments)
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

      // 静态前端资源由 wrangler.jsonc 配置。正常部署时只有 /api/*
      // 会优先进入 Worker，所以非 API 请求走到这里就明确视为未命中。
      return json({ error: 'Not found' }, { status: 404 })
    } catch (error) {
      console.error({ message: 'Worker request failed', error: error?.message })
      return json({ error: '服务器错误' }, { status: 500 })
    }
  },
}

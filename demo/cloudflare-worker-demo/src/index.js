const NOTE_KEY = 'demo:note'

// CORS 头用于允许浏览器网页直接调用这个 Worker。
// Demo 阶段先全部放开，正式项目里可以改成只允许自己的域名。
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

// 返回 JSON 的小工具，避免每个接口都重复写 headers。
function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

// 返回纯文本的小工具，用在首页说明。
function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'text/plain; charset=utf-8',
    },
  })
}

function notAllowed() {
  return json({ error: '方法不允许' }, 405)
}

function requireKv(env) {
  if (!env.DEMO_KV) {
    throw new Error('缺少 DEMO_KV 绑定。请在 wrangler.jsonc 里添加 KV namespace binding。')
  }
  return env.DEMO_KV
}

// 尝试读取 JSON 请求体。解析失败时返回 null，让调用方给出明确错误。
async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

async function handleNote(request, env) {
  const kv = requireKv(env)

  // 读取 KV 里保存的便签。
  if (request.method === 'GET') {
    const raw = await kv.get(NOTE_KEY)
    return json(raw ? JSON.parse(raw) : { note: null, updatedAt: null })
  }

  // 保存一条便签到 KV。这个动作类似未来“上传一份备份 JSON”。
  if (request.method === 'PUT') {
    const body = await readJson(request)
    if (!body || typeof body.note !== 'string') {
      return json({ error: '请求体需要是 JSON：{ "note": "..." }' }, 400)
    }

    const note = body.note.trim()
    if (!note) {
      return json({ error: 'note 不能为空' }, 400)
    }
    if (note.length > 5000) {
      return json({ error: 'note 不能超过 5000 个字符' }, 400)
    }

    const saved = { note, updatedAt: new Date().toISOString() }
    await kv.put(NOTE_KEY, JSON.stringify(saved))
    return json(saved)
  }

  // 删除 KV 里的便签。
  if (request.method === 'DELETE') {
    await kv.delete(NOTE_KEY)
    return json({ deleted: true })
  }

  return notAllowed()
}

function help() {
  return text(
    [
      'Cloudflare Worker + KV 小 Demo',
      '',
      '可以试试这些接口：',
      'GET    /api/health    检查 Worker 是否正常',
      'GET    /api/note      读取 KV 里的便签',
      'PUT    /api/note      保存便签，请求体：{ "note": "hello" }',
      'DELETE /api/note      删除便签',
    ].join('\n')
  )
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // 浏览器跨域请求会先发 OPTIONS 预检请求。
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
      if (url.pathname === '/') return help()

      if (url.pathname === '/api/health') {
        return json({
          ok: true,
          service: 'cloudflare-worker-demo',
          kvBound: Boolean(env.DEMO_KV),
          time: new Date().toISOString(),
        })
      }

      if (url.pathname === '/api/note') {
        return handleNote(request, env)
      }

      return json({ error: '接口不存在' }, 404)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : '未知错误' }, 500)
    }
  },
}

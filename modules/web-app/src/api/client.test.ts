import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './client'
import { getSessionToken, setSessionToken } from './session'

const TEST_EMAIL = 'owner@example.com'

function installLocalStorageMock() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
  })
}

describe('api client auth session', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    installLocalStorageMock()
  })

  it('登录成功后保存 session token', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      token: 'session-token',
      expiresAt: '2026-08-01T00:00:00.000Z',
      user: { email: TEST_EMAIL },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.login({
      email: TEST_EMAIL,
      password: 'correct-password',
    })

    expect(result.user.email).toBe(TEST_EMAIL)
    expect(getSessionToken()).toBe('session-token')
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: 'correct-password',
      }),
    }))
  })

  it('已登录后普通请求会带 Authorization header', async () => {
    setSessionToken('session-token')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await api.getAssets()

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>
    const [, options] = calls[0]
    expect((options?.headers as Record<string, string>).Authorization).toBe('Bearer session-token')
  })

  it('接口返回 401 时会清理 session token', async () => {
    setSessionToken('expired-token')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: '请先登录',
    }), { status: 401 })))

    await expect(api.getAssets()).rejects.toThrow('请先登录')

    expect(getSessionToken()).toBeNull()
  })
})

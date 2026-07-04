/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage'

describe('LoginPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('从服务端登录配置读取默认邮箱', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      userEmail: 'owner@example.com',
    }), { status: 200 })))

    render(<LoginPage onLogin={() => undefined} />)

    await waitFor(() => {
      expect((screen.getByLabelText('邮箱') as HTMLInputElement).value).toBe('owner@example.com')
    })
  })
})

/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage'

describe('LoginPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('默认不自动填充邮箱，也不读取登录配置', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<LoginPage onLogin={() => undefined} />)

    expect((screen.getByLabelText('邮箱') as HTMLInputElement).value).toBe('')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

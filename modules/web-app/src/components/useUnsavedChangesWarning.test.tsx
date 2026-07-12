/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useUnsavedChangesWarning } from './useUnsavedChangesWarning'

function DirtyPage({ dirty }: { dirty: boolean }) {
  useUnsavedChangesWarning(dirty, '收入修改尚未保存，确定离开吗？')
  return <Link to="/assets">去资产页</Link>
}

function renderWarning(dirty = true) {
  return render(
    <MemoryRouter initialEntries={['/income']}>
      <Routes>
        <Route path="/income" element={<DirtyPage dirty={dirty} />} />
        <Route path="/assets" element={<h1>资产页</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useUnsavedChangesWarning', () => {
  it('warns on browser unload only while changes are dirty', () => {
    const view = renderWarning(true)
    const dirtyEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirtyEvent)
    expect(dirtyEvent.defaultPrevented).toBe(true)

    view.rerender(
      <MemoryRouter initialEntries={['/income']}>
        <DirtyPage dirty={false} />
      </MemoryRouter>,
    )
    const cleanEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(cleanEvent)
    expect(cleanEvent.defaultPrevented).toBe(false)
  })

  it('keeps the user on the page when an internal navigation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderWarning()

    fireEvent.click(screen.getByRole('link', { name: '去资产页' }))

    expect(window.confirm).toHaveBeenCalledWith('收入修改尚未保存，确定离开吗？')
    expect(screen.queryByRole('heading', { name: '资产页' })).toBeNull()
  })

  it('continues an internal navigation after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderWarning()

    fireEvent.click(screen.getByRole('link', { name: '去资产页' }))

    expect(screen.getByRole('heading', { name: '资产页' })).toBeTruthy()
  })
})

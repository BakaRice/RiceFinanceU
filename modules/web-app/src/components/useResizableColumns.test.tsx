/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useResizableColumns } from './useResizableColumns'

function installLocalStorageMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  const localStorageMock = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: vi.fn((key: string) => store.delete(key)),
  }
  vi.stubGlobal('localStorage', localStorageMock)
  return localStorageMock
}

function Harness({ tableId = 'assets' }: { tableId?: string }) {
  const { widths, startResize } = useResizableColumns(tableId, { name: 160 })
  return (
    <button
      type="button"
      data-testid="handle"
      style={{ width: widths.name }}
      onPointerDown={(event) => startResize('name', event)}
    >
      名称
    </button>
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useResizableColumns', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resizes a column and persists its width after the drag ends', () => {
    const storage = installLocalStorageMock()
    render(<Harness />)

    fireEvent.pointerDown(screen.getByTestId('handle'), { clientX: 100 })
    fireEvent.pointerMove(window, { clientX: 150 })
    fireEvent.pointerUp(window)

    expect(screen.getByTestId('handle').style.width).toBe('210px')
    expect(storage.setItem).toHaveBeenCalledWith(
      'ricefinanceu:column-widths:assets',
      JSON.stringify({ name: 210 }),
    )
  })

  it('never shrinks a column below 72 pixels', () => {
    installLocalStorageMock()
    render(<Harness />)

    fireEvent.pointerDown(screen.getByTestId('handle'), { clientX: 200 })
    fireEvent.pointerMove(window, { clientX: 0 })
    fireEvent.pointerUp(window)

    expect(screen.getByTestId('handle').style.width).toBe('72px')
  })

  it('restores valid stored widths and ignores invalid stored data', () => {
    installLocalStorageMock({
      'ricefinanceu:column-widths:assets': JSON.stringify({ name: 240 }),
      'ricefinanceu:column-widths:broken': '{bad json',
    })

    const { unmount } = render(<Harness />)
    expect(screen.getByTestId('handle').style.width).toBe('240px')

    unmount()
    render(<Harness tableId="broken" />)
    expect(screen.getByTestId('handle').style.width).toBe('160px')
  })
})

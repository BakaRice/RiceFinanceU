import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

const STORAGE_PREFIX = 'ricefinanceu:column-widths:'

function loadWidths(
  tableId: string,
  defaults: Record<string, number>,
  minWidth: number,
): Record<string, number> {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${tableId}`)
    if (!stored) return defaults
    const parsed = JSON.parse(stored) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(defaults).map(([column, defaultWidth]) => {
        const storedWidth = parsed[column]
        return [
          column,
          typeof storedWidth === 'number' && Number.isFinite(storedWidth) && storedWidth >= minWidth
            ? storedWidth
            : defaultWidth,
        ]
      }),
    )
  } catch {
    return defaults
  }
}

export function useResizableColumns(
  tableId: string,
  defaults: Record<string, number>,
  minWidth = 72,
) {
  const [widths, setWidths] = useState<Record<string, number>>(
    () => loadWidths(tableId, defaults, minWidth),
  )
  const removeDragListenersRef = useRef<(() => void) | null>(null)

  useEffect(() => () => removeDragListenersRef.current?.(), [])

  function startResize(column: string, event: ReactPointerEvent<HTMLElement>) {
    event.preventDefault()
    removeDragListenersRef.current?.()

    const startX = event.clientX
    const startWidth = widths[column] ?? defaults[column] ?? minWidth
    let nextWidths = widths

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.max(minWidth, startWidth + moveEvent.clientX - startX)
      nextWidths = { ...nextWidths, [column]: nextWidth }
      setWidths(nextWidths)
    }

    const removeListeners = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      removeDragListenersRef.current = null
    }

    const handlePointerUp = () => {
      removeListeners()
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${tableId}`, JSON.stringify(nextWidths))
      } catch {
        // 浏览器禁用本地存储时，列宽仍在当前页面会话内有效。
      }
    }

    removeDragListenersRef.current = removeListeners
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  return { widths, startResize }
}

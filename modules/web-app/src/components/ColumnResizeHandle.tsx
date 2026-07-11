import type { PointerEvent as ReactPointerEvent } from 'react'

interface ColumnResizeHandleProps {
  column: string
  label: string
  onResizeStart: (column: string, event: ReactPointerEvent<HTMLElement>) => void
}

export default function ColumnResizeHandle({
  column,
  label,
  onResizeStart,
}: ColumnResizeHandleProps) {
  return (
    <button
      type="button"
      role="separator"
      aria-orientation="vertical"
      aria-label={`调整${label}列宽`}
      title={`拖动调整${label}列宽`}
      className="column-resize-handle"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        event.stopPropagation()
        onResizeStart(column, event)
      }}
    />
  )
}

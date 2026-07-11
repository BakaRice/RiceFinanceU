import type { ReactNode } from 'react'
import './TableWorkspace.css'

interface TableWorkspaceProps {
  title: string
  description?: string
  dirtyCount?: number
  saving?: boolean
  primaryActionLabel?: string
  onPrimaryAction?: () => void
  secondaryActions?: ReactNode
  children: ReactNode
}

export default function TableWorkspace({
  title,
  description,
  dirtyCount = 0,
  saving = false,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActions,
  children,
}: TableWorkspaceProps) {
  return (
    <section className="table-workspace">
      <header className="table-workspace-toolbar">
        <div className="table-workspace-heading">
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        <div className="table-workspace-actions">
          {dirtyCount > 0 && <span className="table-dirty-count">{dirtyCount} 项未保存</span>}
          {secondaryActions}
          {primaryActionLabel && (
            <button
              className="btn-primary"
              type="button"
              disabled={dirtyCount === 0 || saving}
              onClick={onPrimaryAction}
            >
              {primaryActionLabel}
            </button>
          )}
        </div>
      </header>
      <div className="table-workspace-grid">{children}</div>
    </section>
  )
}

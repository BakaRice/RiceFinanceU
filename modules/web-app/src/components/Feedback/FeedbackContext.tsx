import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

// --- Toast ---
export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
  fading: boolean
}

// --- Confirm ---
interface ConfirmOptions {
  title: string
  message: string
  detail?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
}

interface ConfirmState extends ConfirmOptions {
  id: number
  resolve: (value: boolean) => void
}

// --- Context ---
interface FeedbackContextType {
  toast: (message: string, type?: ToastType) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackContextType | null>(null)

export function useFeedback(): FeedbackContextType {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be inside FeedbackProvider')
  return ctx
}

// --- Provider ---
let nextId = 1

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, type, fading: false }])
    // Auto-dismiss after 3s
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, fading: true } : t)))
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 300)
    }, 3000)
  }, [])

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      const id = nextId++
      setConfirmState({ ...options, id, resolve })
    })
  }, [])

  const handleConfirmResult = useCallback(
    (result: boolean) => {
      if (confirmState) {
        confirmState.resolve(result)
        setConfirmState(null)
      }
    },
    [confirmState]
  )

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`toast toast-${t.type} ${t.fading ? 'toast-fade-out' : ''}`}
              onClick={() => {
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }}
            >
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
              {' '}
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Confirm modal */}
      {confirmState && (
        <div className="modal-overlay" onClick={() => handleConfirmResult(false)}>
          <div
            className="modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`confirm-title-${confirmState.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={`confirm-title-${confirmState.id}`}>{confirmState.title}</h2>
            <p className="confirm-body">{confirmState.message}</p>
            {confirmState.detail && (
              <div className="confirm-detail">{confirmState.detail}</div>
            )}
            <div className="confirm-actions">
              <button className="btn-secondary" onClick={() => handleConfirmResult(false)}>
                {confirmState.cancelLabel || '取消'}
              </button>
              <button
                className={confirmState.variant === 'danger' ? 'btn-danger' : 'btn-primary'}
                onClick={() => handleConfirmResult(true)}
              >
                {confirmState.confirmLabel || '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  )
}

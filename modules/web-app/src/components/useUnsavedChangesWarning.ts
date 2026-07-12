import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function useUnsavedChangesWarning(shouldWarn: boolean, message: string) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!shouldWarn) return
    const currentHistoryIndex = Number(window.history.state?.idx ?? 0)
    let restoringHistory = false

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const handleInternalLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return

      const target = event.target
      const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return

      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin) return
      if (!window.confirm(message)) {
        event.preventDefault()
        event.stopPropagation()
        return
      }

      event.preventDefault()
      event.stopPropagation()
      navigate(`${destination.pathname}${destination.search}${destination.hash}`)
    }
    const handlePopState = (event: PopStateEvent) => {
      if (restoringHistory) {
        restoringHistory = false
        return
      }
      if (window.confirm(message)) return

      const nextHistoryIndex = Number(event.state?.idx)
      const delta = Number.isFinite(nextHistoryIndex)
        ? currentHistoryIndex - nextHistoryIndex
        : 1
      event.stopImmediatePropagation()
      restoringHistory = true
      window.history.go(delta === 0 ? 1 : delta)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState, true)
    document.addEventListener('click', handleInternalLink, true)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState, true)
      document.removeEventListener('click', handleInternalLink, true)
    }
  }, [message, navigate, shouldWarn])
}

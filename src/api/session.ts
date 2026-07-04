const SESSION_TOKEN_KEY = 'ricefinanceu.sessionToken'

function getStorage(): Storage | null {
  if (typeof globalThis.localStorage === 'undefined') return null
  return globalThis.localStorage
}

export function getSessionToken(): string | null {
  return getStorage()?.getItem(SESSION_TOKEN_KEY) || null
}

export function setSessionToken(token: string): void {
  getStorage()?.setItem(SESSION_TOKEN_KEY, token)
}

export function clearSessionToken(): void {
  getStorage()?.removeItem(SESSION_TOKEN_KEY)
}

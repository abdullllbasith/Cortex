import { getSessionSnapshot } from '@/store/sessionStore'

const STORAGE_PREFIX = 'saios:assistant:lastSession'

function storageKey(): string | null {
  const { tenant, user } = getSessionSnapshot()
  if (!tenant?.id || !user?.id) return null
  return `${STORAGE_PREFIX}:${tenant.id}:${user.id}`
}

export function getLastAssistantSessionId(): string | null {
  if (typeof window === 'undefined') return null
  const key = storageKey()
  if (!key) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function setLastAssistantSessionId(sessionId: string): void {
  if (typeof window === 'undefined') return
  const key = storageKey()
  if (!key) return
  try {
    localStorage.setItem(key, sessionId)
  } catch {
    /* quota / private mode */
  }
}

export function clearLastAssistantSessionId(): void {
  if (typeof window === 'undefined') return
  const key = storageKey()
  if (!key) return
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

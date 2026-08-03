export const REMEMBER_ME_STORAGE_KEY = 'saios:remember-me'

export function readRememberMePreference(): boolean {
  if (typeof window === 'undefined') return true
  const stored = localStorage.getItem(REMEMBER_ME_STORAGE_KEY)
  if (stored === '0') return false
  if (stored === '1') return true
  return true
}

export function writeRememberMePreference(value: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(REMEMBER_ME_STORAGE_KEY, value ? '1' : '0')
}

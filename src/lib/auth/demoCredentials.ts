/** Public demo login shown on auth pages (e.g. for judges / reviewers). */
export interface DemoCredentials {
  email: string
  password: string
  label: string
}

const DEFAULT_EMAIL = 'demo@saios.app'
const DEFAULT_PASSWORD = 'Demo@SAIOS2026'

export function getDemoCredentials(): DemoCredentials | null {
  if (process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === 'false') return null

  const email = (process.env.NEXT_PUBLIC_DEMO_EMAIL ?? DEFAULT_EMAIL).trim()
  const password = (process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? DEFAULT_PASSWORD).trim()

  if (!email || !password) return null

  return {
    email,
    password,
    label: process.env.NEXT_PUBLIC_DEMO_LABEL?.trim() || 'Demo account',
  }
}

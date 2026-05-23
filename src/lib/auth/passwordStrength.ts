export type PasswordStrength = 'weak' | 'fair' | 'strong' | 'very-strong'

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3
  label: PasswordStrength
  color: string
  width: string
}

export function getPasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return { score: 0, label: 'weak', color: 'bg-red-500', width: '0%' }
  }

  let points = 0
  if (password.length >= 8) points++
  if (password.length >= 12) points++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++
  if (/\d/.test(password)) points++
  if (/[^a-zA-Z0-9]/.test(password)) points++

  if (points <= 1) return { score: 0, label: 'weak', color: 'bg-red-500', width: '25%' }
  if (points === 2) return { score: 1, label: 'fair', color: 'bg-amber-500', width: '50%' }
  if (points === 3 || points === 4) return { score: 2, label: 'strong', color: 'bg-emerald-500', width: '75%' }
  return { score: 3, label: 'very-strong', color: 'bg-indigo-600', width: '100%' }
}

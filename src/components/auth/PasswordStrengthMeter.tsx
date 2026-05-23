'use client'

import { getPasswordStrength } from '@/lib/auth/passwordStrength'

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password)

  if (!password) return null

  return (
    <div className="mt-2 space-y-1.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
          style={{ width: strength.width }}
        />
      </div>
      <p className="text-xs capitalize text-slate-500 dark:text-slate-400">
        Password strength:{' '}
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {strength.label.replace('-', ' ')}
        </span>
      </p>
    </div>
  )
}

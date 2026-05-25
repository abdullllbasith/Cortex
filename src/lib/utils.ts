import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes without conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Generate initials from a display name (up to 2 chars). */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** Format a number with compact notation (1.2k, 3.4M). */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(n)
}

/** Sleep for `ms` milliseconds (useful in tests/storybook). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Turn an app path (/settings/audit) into a full URL for emails and external links.
 * Relative paths in email become invalid (e.g. http:///settings/audit) without a host.
 */
export function resolveAppUrl(path?: string | null): string | undefined {
  if (!path?.trim()) return undefined
  const trimmed = path.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return base ? `${base}${normalized}` : normalized
}

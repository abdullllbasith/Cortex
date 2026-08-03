/**
 * Runtime flags to reduce background CPU/network during local development.
 * Helps prevent whole-system lag on 16GB machines when Next.js dev + DB + seed run together.
 */

export function shouldReduceBackgroundWork(): boolean {
  if (process.env.NEXT_PUBLIC_REDUCE_BACKGROUND_LOAD === 'false') return false
  if (process.env.NEXT_PUBLIC_REDUCE_BACKGROUND_LOAD === 'true') return true
  return process.env.NODE_ENV === 'development'
}

export function swrRefreshIntervalMs(defaultMs: number): number {
  return shouldReduceBackgroundWork() ? Math.max(defaultMs, defaultMs * 3) : defaultMs
}

export function analyticsPollIntervalMs(): number {
  return shouldReduceBackgroundWork() ? 180_000 : 60_000
}

export function enableNotificationStream(): boolean {
  return !shouldReduceBackgroundWork()
}

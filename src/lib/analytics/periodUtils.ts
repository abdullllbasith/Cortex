export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'last_month' | 'quarter' | 'year' | 'custom'
export type AnalyticsGranularity = 'hour' | 'day' | 'week' | 'month'

export interface DateRange {
  start: Date
  end: Date
  previousStart: Date
  previousEnd: Date
  period: AnalyticsPeriod
  label: string
}

export function resolveDateRange(
  period: AnalyticsPeriod,
  startDate?: string,
  endDate?: string,
): DateRange {
  const now = new Date()
  const end = endDate ? new Date(endDate) : now
  let start: Date
  let previousStart: Date
  let previousEnd: Date
  let label: string = period

  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      previousEnd = new Date(start.getTime() - 1)
      previousStart = new Date(previousEnd.getFullYear(), previousEnd.getMonth(), previousEnd.getDate())
      label = 'Today'
      break
    case 'week':
      start = new Date(now.getTime() - 7 * 86400000)
      previousEnd = new Date(start.getTime() - 1)
      previousStart = new Date(previousEnd.getTime() - 7 * 86400000)
      label = 'Last 7 days'
      break
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      previousEnd = new Date(start.getTime() - 1)
      previousStart = new Date(previousEnd.getFullYear(), previousEnd.getMonth(), 1)
      label = 'This month'
      break
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      end.setTime(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime())
      previousEnd = new Date(start.getTime() - 1)
      previousStart = new Date(previousEnd.getFullYear(), previousEnd.getMonth(), 1)
      label = 'Last month'
      break
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3)
      start = new Date(now.getFullYear(), q * 3, 1)
      previousEnd = new Date(start.getTime() - 1)
      const pq = Math.floor(previousEnd.getMonth() / 3)
      previousStart = new Date(previousEnd.getFullYear(), pq * 3, 1)
      label = 'This quarter'
      break
    }
    case 'year':
      start = new Date(now.getFullYear(), 0, 1)
      previousEnd = new Date(start.getTime() - 1)
      previousStart = new Date(previousEnd.getFullYear(), 0, 1)
      label = 'This year'
      break
    case 'custom':
    default:
      start = startDate ? new Date(startDate) : new Date(now.getTime() - 30 * 86400000)
      if (!endDate) end.setTime(now.getTime())
      const duration = end.getTime() - start.getTime()
      previousEnd = new Date(start.getTime() - 1)
      previousStart = new Date(previousEnd.getTime() - duration)
      label = 'Custom range'
      break
  }

  return { start, end, previousStart, previousEnd, period, label }
}

export function periodKey(range: DateRange): string {
  return `${range.period}:${range.start.toISOString().slice(0, 10)}:${range.end.toISOString().slice(0, 10)}`
}

export function trendDirection(current: number, previous: number): 'up' | 'down' | 'flat' {
  if (previous === 0) return current > 0 ? 'up' : 'flat'
  const change = ((current - previous) / previous) * 100
  if (Math.abs(change) < 1) return 'flat'
  return change > 0 ? 'up' : 'down'
}

export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export function ragStatus(value: number, green: number, amber: number, higherIsBetter = true): 'green' | 'amber' | 'red' {
  if (higherIsBetter) {
    if (value >= green) return 'green'
    if (value >= amber) return 'amber'
    return 'red'
  }
  if (value <= green) return 'green'
  if (value <= amber) return 'amber'
  return 'red'
}

/** Fill missing calendar days in a daily timeseries so charts always have a complete x-axis. */
export function fillDailyTimeseriesGaps<T extends { date: string; revenue: number }>(
  range: DateRange,
  points: T[],
  emptyDay: (date: string) => T,
): T[] {
  const byDate = new Map(points.map((p) => [p.date, p]))
  const result: T[] = []
  const cursor = new Date(range.start)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(range.end)
  end.setHours(0, 0, 0, 0)

  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10)
    result.push(byDate.get(date) ?? emptyDay(date))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return result
}

export function truncateDate(date: Date, granularity: AnalyticsGranularity): string {
  const d = new Date(date)
  if (granularity === 'hour') return d.toISOString().slice(0, 13) + ':00'
  if (granularity === 'day') return d.toISOString().slice(0, 10)
  if (granularity === 'week') {
    const day = d.getDay()
    const diff = d.getDate() - day
    return new Date(d.setDate(diff)).toISOString().slice(0, 10)
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Numeric feature preprocessing utilities */

export function median(values: number[]): number {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!sorted.length) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

export function iqrBounds(values: number[]): { q1: number; q3: number; lower: number; upper: number } {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!sorted.length) return { q1: 0, q3: 0, lower: 0, upper: 0 }
  const q1 = percentile(sorted, 0.25)
  const q3 = percentile(sorted, 0.75)
  const iqr = q3 - q1
  return { q1, q3, lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr }
}

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]!
  return sorted[lo]! * (hi - idx) + sorted[hi]! * (idx - lo)
}

export function capOutliers(row: Record<string, number | string | boolean | null>, bounds: Map<string, { lower: number; upper: number }>): Record<string, number | string | boolean | null> {
  const out = { ...row }
  for (const [key, val] of Object.entries(out)) {
    if (typeof val !== 'number') continue
    const b = bounds.get(key)
    if (!b) continue
    if (val < b.lower) out[key] = b.lower
    else if (val > b.upper) out[key] = b.upper
  }
  return out
}

export function imputeMissing(
  rows: Array<Record<string, number | string | boolean | null>>,
): Array<Record<string, number | string | boolean | null>> {
  const numericKeys = new Set<string>()
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'number' || v === null) numericKeys.add(k)
    }
  }

  const medians = new Map<string, number>()
  for (const key of numericKeys) {
    const vals = rows.map((r) => r[key]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    medians.set(key, median(vals))
  }

  return rows.map((row) => {
    const next = { ...row }
    for (const key of numericKeys) {
      const val = next[key]
      if (val === null || val === undefined || (typeof val === 'number' && !Number.isFinite(val))) {
        next[key] = medians.get(key) ?? 0
      }
    }
    return next
  })
}

export function buildOutlierBounds(
  rows: Array<Record<string, number | string | boolean | null>>,
): Map<string, { lower: number; upper: number }> {
  const bounds = new Map<string, { lower: number; upper: number }>()
  const keys = new Set<string>()
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'number') keys.add(k)
    }
  }
  for (const key of keys) {
    const vals = rows.map((r) => r[key]).filter((v): v is number => typeof v === 'number')
    if (vals.length >= 4) {
      const { lower, upper } = iqrBounds(vals)
      bounds.set(key, { lower, upper })
    }
  }
  return bounds
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Simple US federal holidays (month-day) for is_holiday flag */
const US_HOLIDAYS = new Set([
  '01-01', '07-04', '12-25', '12-31',
  '11-11', '06-19',
])

export function isHoliday(d: Date): boolean {
  const md = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  return US_HOLIDAYS.has(md)
}

export function exponentialSmoothing(series: number[], alpha = 0.3): number[] {
  if (!series.length) return []
  const out: number[] = [series[0]!]
  for (let i = 1; i < series.length; i++) {
    out.push(alpha * series[i]! + (1 - alpha) * out[i - 1]!)
  }
  return out
}

export function forecastExponentialSmoothing(
  history: number[],
  horizon: number,
  alpha = 0.3,
): number[] {
  const smoothed = exponentialSmoothing(history, alpha)
  const last = smoothed[smoothed.length - 1] ?? 0
  return Array.from({ length: horizon }, () => last)
}

/** Wilson EOQ: √(2DS/H) with safety stock factor */
export function wilsonEoq(dailyDemand: number, orderCost = 50, holdingCostPerUnit = 2, leadTimeDays = 7): number {
  const annualDemand = dailyDemand * 365
  if (annualDemand <= 0) return 0
  const eoq = Math.sqrt((2 * annualDemand * orderCost) / holdingCostPerUnit)
  const safetyStock = dailyDemand * leadTimeDays * 0.5
  return Math.ceil(eoq + safetyStock)
}

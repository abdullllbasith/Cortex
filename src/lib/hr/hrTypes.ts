import { Decimal } from '@prisma/client/runtime/library'

export function toNumber(value: unknown): number {
  if (value == null) return 0
  if (value instanceof Decimal) return value.toNumber()
  return Number(value)
}

export function currentFiscalYear(date = new Date()): number {
  return date.getFullYear()
}

export function countLeaveDays(startDate: Date, endDate: Date): number {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  if (end < start) throw new Error('End date must be on or after start date')
  let days = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) days += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export function monthRange(month?: string) {
  const base = month ? new Date(`${month}-01T00:00:00`) : new Date()
  const start = new Date(base.getFullYear(), base.getMonth(), 1)
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

export function countWorkingDaysInMonth(month: number, year: number): number {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  let days = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) days += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

import { FinancePaymentType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

function toNumber(v: { toNumber(): number } | number | null | undefined): number {
  if (v == null) return 0
  return typeof v === 'number' ? v : v.toNumber()
}

/** Collected revenue from invoice payments (same source as Finance Agent / Finance page). */
export async function getCollectedRevenueTotal(
  tenantId: string,
  start: Date,
  end: Date,
): Promise<{ total: number; paymentCount: number }> {
  const agg = await prisma.payment.aggregate({
    where: {
      tenantId,
      type: FinancePaymentType.INVOICE_PAYMENT,
      paymentDate: { gte: start, lte: end },
    },
    _sum: { amount: true },
    _count: true,
  })
  return {
    total: Math.round(toNumber(agg._sum.amount) * 100) / 100,
    paymentCount: agg._count,
  }
}

export async function getCollectedRevenueByDay(
  tenantId: string,
  start: Date,
  end: Date,
): Promise<Array<{ date: string; revenue: number }>> {
  const rows = await prisma.$queryRaw<Array<{ day: Date; revenue: number }>>`
    SELECT
      date_trunc('day', "paymentDate")::timestamp AS day,
      COALESCE(SUM(amount), 0)::float AS revenue
    FROM finance_payments
    WHERE "tenantId" = ${tenantId}
      AND type = 'INVOICE_PAYMENT'::"FinancePaymentType"
      AND "paymentDate" >= ${start}
      AND "paymentDate" <= ${end}
    GROUP BY 1
    ORDER BY 1 ASC
  `

  return rows.map((r) => {
    const d = new Date(r.day)
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    return {
      date: `${yyyy}-${mm}-${dd}`,
      revenue: Math.round(Number(r.revenue) * 100) / 100,
    }
  })
}

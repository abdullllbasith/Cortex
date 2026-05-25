import { NextRequest, NextResponse } from 'next/server'
import { checkOverdueAllTenants } from '@/lib/finance/invoiceService'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
  }

  const results = await checkOverdueAllTenants()
  return NextResponse.json({ success: true, data: { results, totalUpdated: results.reduce((s, r) => s + r.updated, 0) } })
}

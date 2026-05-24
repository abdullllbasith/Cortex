import { NextRequest, NextResponse } from 'next/server'
import { apiSuccess } from '@/lib/knowledge/response'
import { endImpersonation, getImpersonationSession } from '@/lib/admin/impersonationService'

/** Reads impersonation cookie — no admin JWT required (used by dashboard banner) */
export async function GET(request: NextRequest) {
  const session = await getImpersonationSession(request)
  return NextResponse.json(
    apiSuccess({
      active: !!session,
      session,
    }),
  )
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    apiSuccess({ ended: true, redirectUrl: '/admin/dashboard' }),
  )
  await endImpersonation(request, response)
  return response
}

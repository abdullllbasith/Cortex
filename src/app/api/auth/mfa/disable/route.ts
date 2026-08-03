import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { prisma } from '@/lib/db/prisma'
import { createSupabaseServerClient } from '@/lib/auth/supabaseServer'
import { logSecurityEvent } from '@/lib/audit/securityMonitor'

const schema = z.object({
  password: z.string().min(1),
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = schema.parse(await request.json())
    const user = await prisma.user.findFirstOrThrow({
      where: { id: auth.userId, tenantId: auth.tenantId },
    })

    const supabase = await createSupabaseServerClient()
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: body.password,
      })
      if (error) {
        return NextResponse.json({ success: false, error: { message: 'Password incorrect' } }, { status: 401 })
      }
    } else if (process.env.AUTH_DEV_MODE !== 'true') {
      return NextResponse.json({ success: false, error: { message: 'Auth unavailable' } }, { status: 503 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false, mfaSecretEnc: null },
    })

    await logSecurityEvent({
      tenantId: auth.tenantId,
      userId: auth.userId,
      eventType: 'MFA_DISABLED',
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })

    return NextResponse.json(apiSuccess({ disabled: true }))
  } catch (err) {
    return handleRouteError(err)
  }
})

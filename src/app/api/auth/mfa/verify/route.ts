import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySync } from 'otplib'
import { apiSuccess } from '@/lib/knowledge/response'
import { prisma } from '@/lib/db/prisma'
import { decryptField, encryptField } from '@/lib/security/encryption'
import { issueSession } from '@/lib/auth/sessionService'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { logSecurityEvent } from '@/lib/audit/securityMonitor'
import { extractRequestMeta } from '@/lib/audit/auditLogger'
import {
  setRefreshCookie,
  clearMfaPendingCookie,
} from '@/lib/auth/sessionCookies'
import {
  generatePlainBackupCodes,
  storeBackupCodeHashes,
  verifyAndConsumeBackupCode,
} from '@/lib/auth/mfaBackupCodes'

const schema = z.object({
  code: z.string().min(6).max(12),
  setupToken: z.string().optional(),
  rememberMe: z.boolean().optional().default(true),
})

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json())
    const authHeader = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
    }

    const payload = await verifyAccessToken(authHeader)
    const user = await prisma.user.findFirstOrThrow({
      where: { id: payload.sub, tenantId: payload.tenantId },
    })

    if (!user.mfaSecretEnc) {
      return NextResponse.json({ success: false, error: { message: 'MFA not initialized' } }, { status: 400 })
    }

    const stored = decryptField(user.mfaSecretEnc, payload.tenantId)
    const colonIdx = stored.indexOf(':')
    const hasSetupToken = colonIdx > 0 && !user.mfaEnabled
    const setupToken = hasSetupToken ? stored.slice(0, colonIdx) : null
    const secret = hasSetupToken ? stored.slice(colonIdx + 1) : stored

    if (body.setupToken && setupToken && body.setupToken !== setupToken) {
      return NextResponse.json({ success: false, error: { message: 'Invalid setup token' } }, { status: 400 })
    }

    let verified = false
    let usedBackupCode = false

    if (body.code.length === 6) {
      const result = verifySync({ token: body.code, secret })
      verified = result.valid
    } else {
      verified = await verifyAndConsumeBackupCode(user.id, body.code)
      usedBackupCode = verified
    }

    if (!verified) {
      return NextResponse.json({ success: false, error: { message: 'Invalid code' } }, { status: 401 })
    }

    let backupCodes: string[] | undefined

    if (!user.mfaEnabled && body.setupToken) {
      backupCodes = generatePlainBackupCodes()
      await storeBackupCodeHashes(user.id, backupCodes)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: true,
          mfaSecretEnc: encryptField(secret, payload.tenantId),
        },
      })
      await logSecurityEvent({
        tenantId: payload.tenantId,
        userId: user.id,
        eventType: 'MFA_ENABLED',
        ipAddress: extractRequestMeta(request).ipAddress,
      })
    }

    const meta = extractRequestMeta(request)

    if (payload.mfaPending || user.mfaEnabled || usedBackupCode) {
      const session = await issueSession(user.id, meta, { rememberMe: body.rememberMe })
      const response = NextResponse.json(apiSuccess({
        accessToken: session.accessToken,
        permissions: session.permissions,
        backupCodes,
        usedBackupCode,
      }))
      setRefreshCookie(response, session.refreshToken, body.rememberMe)
      clearMfaPendingCookie(response)
      await logSecurityEvent({
        tenantId: payload.tenantId,
        userId: user.id,
        eventType: usedBackupCode ? 'MFA_BACKUP_CODE_USED' : 'LOGIN_SUCCESS',
        ipAddress: meta.ipAddress,
      })
      return response
    }

    return NextResponse.json(apiSuccess({ verified: true, backupCodes }))
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { message: 'Invalid code format' } }, { status: 400 })
    }
    console.error('[mfa/verify]', err)
    return NextResponse.json({ success: false, error: { message: 'Verification failed' } }, { status: 500 })
  }
}

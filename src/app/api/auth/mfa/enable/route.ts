import { NextResponse } from 'next/server'
import { generateSecret, generateURI } from 'otplib'
import QRCode from 'qrcode'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { prisma } from '@/lib/db/prisma'
import { encryptField, generateSecureToken } from '@/lib/security/encryption'

export const POST = withTenantAuth(async (_request, { auth }) => {
  try {
    const user = await prisma.user.findFirstOrThrow({
      where: { id: auth.userId, tenantId: auth.tenantId },
    })

    if (user.mfaEnabled) {
      return NextResponse.json({ success: false, error: { message: 'MFA already enabled' } }, { status: 400 })
    }

    const secret = generateSecret()
    const otpauth = generateURI({ issuer: 'Cortex', label: user.email, secret })
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth)
    const setupToken = generateSecureToken(16)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaSecretEnc: encryptField(`${setupToken}:${secret}`, auth.tenantId),
      },
    })

    return NextResponse.json(apiSuccess({ qrCodeDataUrl, setupToken, manualEntry: secret }))
  } catch (err) {
    return handleRouteError(err)
  }
})

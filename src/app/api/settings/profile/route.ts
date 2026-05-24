import { NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { profileUpdateSchema } from '@/lib/settings/schemas'
import { getUserProfile, updateUserProfile } from '@/lib/settings/profileService'

export const GET = requirePermission(PERMISSIONS.KNOWLEDGE_READ)(
  async (_request, { auth }) => {
    try {
      const data = await getUserProfile(auth.userId, auth.tenantId)
      return NextResponse.json(apiSuccess(data))
    } catch (err) {
      return handleRouteError(err)
    }
  },
)

export const PUT = requirePermission(PERMISSIONS.KNOWLEDGE_READ)(
  async (request, { auth }) => {
    try {
      const body = profileUpdateSchema.parse(await request.json())

      if (body.newPassword) {
        if (!body.currentPassword) {
          return NextResponse.json(
            { success: false, error: { message: 'Current password required', code: 'VALIDATION_ERROR' } },
            { status: 400 },
          )
        }
        // Password change via Supabase is client-side; server stores profile fields only
      }

      const { currentPassword: _c, newPassword: _n, ...profileData } = body
      const data = await updateUserProfile(auth.userId, auth.tenantId, profileData)
      return NextResponse.json(apiSuccess(data))
    } catch (err) {
      return handleRouteError(err)
    }
  },
)

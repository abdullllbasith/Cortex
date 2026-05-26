import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { approvePO, getPO } from '@/lib/inventory/purchaseOrderService'
import { prisma } from '@/lib/db/prisma'

export const POST = withTenantAuth(
  async (_request, { auth, params }) => {
    try {
      const { id } = await params
      const approver = await prisma.user.findFirst({
        where: { id: auth.userId, tenantId: auth.tenantId },
        select: { role: true },
      })
      if (!approver) {
        return NextResponse.json({ success: false, error: { message: 'User not found' } }, { status: 404 })
      }
      await approvePO(id, auth.userId, approver.role)
      const po = await getPO(auth.tenantId, id)
      return NextResponse.json(apiSuccess(po))
    } catch (err) {
      return handleRouteError(err)
    }
  },
  { resourceType: 'purchase_order' },
)

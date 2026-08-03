import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { deleteCategory, updateCategory } from '@/lib/inventory/inventoryCategoryService'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().optional(),
  parentId: z.string().optional().nullable(),
})

export const PUT = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = updateSchema.parse(await request.json())
    const category = await updateCategory(auth.tenantId, id, body)
    return NextResponse.json(apiSuccess(category))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const result = await deleteCategory(auth.tenantId, id)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

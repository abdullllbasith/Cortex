import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '@/lib/inventory/inventoryCategoryService'

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  parentId: z.string().optional().nullable(),
})

const updateSchema = createSchema.partial()

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const categories = await listCategories(auth.tenantId)
    return NextResponse.json(apiSuccess(categories))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = createSchema.parse(await request.json())
    const category = await createCategory(auth.tenantId, body)
    return NextResponse.json(apiSuccess(category), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth }) => {
  try {
    const body = z
      .object({ id: z.string().min(1) })
      .merge(updateSchema)
      .parse(await request.json())
    const category = await updateCategory(auth.tenantId, body.id, body)
    return NextResponse.json(apiSuccess(category))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = withTenantAuth(async (request, { auth }) => {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'Category id is required' } },
        { status: 400 },
      )
    }
    const result = await deleteCategory(auth.tenantId, id)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})

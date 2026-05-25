import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import {
  createCategory,
  deleteCategory,
  getCategoryTree,
  listCategoriesFlat,
  reorderCategory,
  updateCategory,
} from '@/lib/inventory/inventoryCategoryService'

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  parentId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

const updateSchema = createSchema.partial().extend({
  sortOrder: z.number().int().optional(),
})

const reorderSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  siblingOrder: z.array(z.string()).optional(),
})

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const tree = request.nextUrl.searchParams.get('tree') === 'true'
    if (tree) {
      const categories = await getCategoryTree(auth.tenantId)
      return NextResponse.json(apiSuccess(categories))
    }
    const categories = await listCategoriesFlat(auth.tenantId)
    return NextResponse.json(apiSuccess(categories))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = await request.json()
    const action = String(body.action ?? 'create')

    if (action === 'reorder') {
      const input = reorderSchema.parse(body)
      const result = await reorderCategory(auth.tenantId, input.id, {
        parentId: input.parentId,
        sortOrder: input.sortOrder,
        siblingOrder: input.siblingOrder,
      })
      return NextResponse.json(apiSuccess(result))
    }

    const input = createSchema.parse(body)
    const category = await createCategory(auth.tenantId, input)
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

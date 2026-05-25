import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { pipelineSchema } from '@/lib/crm/crmSchemas'
import {
  calculatePipelineValue,
  listPipelines,
  seedPipelinesForTenant,
  upsertPipeline,
} from '@/lib/crm/pipelineService'
import { z } from 'zod'

const pipelineUpdateSchema = pipelineSchema.extend({ id: z.string().min(1) })

const pipelineQuerySchema = z.object({
  summary: z.enum(['true']).optional(),
  pipelineId: z.string().optional(),
  seed: z.enum(['true']).optional(),
})

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = pipelineQuerySchema.parse(parseQuery(request))
    if (query.seed === 'true') {
      await seedPipelinesForTenant(auth.tenantId)
    }
    if (query.summary === 'true') {
      const summary = await calculatePipelineValue(auth.tenantId, query.pipelineId)
      return NextResponse.json(apiSuccess(summary))
    }
    const items = await listPipelines(auth.tenantId)
    return NextResponse.json(apiSuccess({ items }))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = pipelineSchema.parse(await request.json())
    const record = await upsertPipeline(auth.tenantId, body)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth }) => {
  try {
    const body = pipelineUpdateSchema.parse(await request.json())
    const record = await upsertPipeline(auth.tenantId, body)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

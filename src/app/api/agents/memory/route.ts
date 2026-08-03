import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { memoryInjectSchema } from '@/lib/agents/schemas'
import { AgentMemoryStore } from '@/lib/agents/core/AgentMemory'
import type { AgentTypeKey } from '@/lib/agents/core/types'
import { z } from 'zod'

const querySchema = z.object({
  agentType: z.enum(['finance', 'sales', 'inventory', 'operations', 'executive']),
})

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const { agentType } = querySchema.parse(parseQuery(request))
    const store = new AgentMemoryStore(auth.tenantId, agentType as AgentTypeKey)
    const memories = await store.listAll()
    return NextResponse.json(apiSuccess(memories))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = memoryInjectSchema.extend({
      agentType: z.enum(['finance', 'sales', 'inventory', 'operations', 'executive']),
    }).parse(await request.json())

    const store = new AgentMemoryStore(auth.tenantId, body.agentType as AgentTypeKey)
    await store.remember(body.key, body.value, body.ttlSeconds)

    return NextResponse.json(apiSuccess({ key: body.key, injected: true }), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

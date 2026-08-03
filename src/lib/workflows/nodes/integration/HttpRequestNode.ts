import { z } from 'zod'
import { WorkflowContext } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { nodeError, validateConfig } from '../utils'

const schema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
  responseMapping: z.record(z.string(), z.string()).optional(),
})

export const httpRequestHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'integration.http_request')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)

  const url = String(ctx.interpolate(cfg.url))
  const headers = (ctx.interpolate(cfg.headers ?? {}) ?? {}) as Record<string, string>
  const body = cfg.body != null ? ctx.interpolate(cfg.body) : undefined

  const res = await fetch(url, {
    method: cfg.method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body != null && cfg.method !== 'GET' ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let json: unknown
  try { json = JSON.parse(text) } catch { json = { raw: text } }

  if (!res.ok) {
    throw nodeError('integration.http_request', `HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  if (cfg.responseMapping && json && typeof json === 'object') {
    for (const [varPath, jsonPath] of Object.entries(cfg.responseMapping)) {
      const parts = jsonPath.split('.')
      let cur: unknown = json
      for (const p of parts) {
        if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[p]
        else cur = undefined
      }
      ctx.setVariable(varPath, cur)
    }
  }

  ctx.appendLog(`HTTP ${cfg.method} ${url} → ${res.status}`)

  return {
    outputData: {
      ...inputData,
      httpStatus: res.status,
      response: json,
    },
  }
}

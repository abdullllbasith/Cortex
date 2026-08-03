import { prisma } from '@/lib/db/prisma'
import { Prisma, AgentLogStatus, AgentType } from '@prisma/client'
import { semanticSearch } from '@/lib/embeddings/semanticSearch'
import type { KnowledgeEntityType } from '@/lib/embeddings/knowledgeIndexer'
import type { AgentTypeKey } from './types'
import { AGENT_TYPE_MAP } from './types'

const ALLOWED_TABLES = new Set([
  'customers',
  'products',
  'suppliers',
  'business_knowledge',
  'agent_logs',
  'agent_tasks',
])

const BLOCKED_SQL = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC|EXECUTE)\b/i

export class AgentToolkit {
  constructor(
    private readonly tenantId: string,
    private readonly agentId: string,
    private readonly agentType: AgentTypeKey,
    private readonly userId?: string,
    private readonly taskId?: string,
  ) {}

  async queryKnowledgeBase(
    query: string,
    entityType: KnowledgeEntityType | 'all' = 'all',
    topK = 10,
  ) {
    return semanticSearch({ tenantId: this.tenantId, query, entityType, topK })
  }

  async executeSQL(query: string, params: unknown[] = []): Promise<unknown[]> {
    const trimmed = query.trim()

    if (BLOCKED_SQL.test(trimmed)) {
      throw new Error('Only SELECT queries are permitted')
    }

    if (!/^SELECT\b/i.test(trimmed)) {
      throw new Error('Query must start with SELECT')
    }

    const tableMatch = trimmed.match(/\bFROM\s+["']?(\w+)["']?/i)
    if (tableMatch && !ALLOWED_TABLES.has(tableMatch[1].toLowerCase())) {
      throw new Error(`Table "${tableMatch[1]}" is not allowed`)
    }

    if (!/\btenantId\b/i.test(trimmed) && !/\b"tenantId"\b/.test(trimmed)) {
      throw new Error('Query must filter by tenantId')
    }

    const start = Date.now()
    try {
      const rows = await prisma.$queryRawUnsafe(trimmed, ...params, this.tenantId)
      await this.logAction('executeSQL', { query: trimmed }, { rowCount: (rows as unknown[]).length }, 'SUCCESS', Date.now() - start)
      return rows as unknown[]
    } catch (err) {
      await this.logAction(
        'executeSQL',
        { query: trimmed },
        { error: err instanceof Error ? err.message : 'SQL error' },
        'FAILURE',
        Date.now() - start,
      )
      throw err
    }
  }

  async callExternalAPI(
    endpoint: string,
    params: Record<string, unknown> = {},
    options: { method?: string; timeoutMs?: number } = {},
  ): Promise<unknown> {
    const allowedHosts = (process.env.AGENT_ALLOWED_API_HOSTS ?? '').split(',').filter(Boolean)
    const url = new URL(endpoint, process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')

    if (allowedHosts.length > 0 && !allowedHosts.some((h) => url.hostname.endsWith(h))) {
      throw new Error(`External API host "${url.hostname}" is not in allowlist`)
    }

    const start = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000)

    try {
      const res = await fetch(url.toString(), {
        method: options.method ?? 'GET',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': this.tenantId },
        body: options.method !== 'GET' ? JSON.stringify(params) : undefined,
        signal: controller.signal,
      })

      const data = await res.json().catch(() => ({}))
      await this.logAction(
        'callExternalAPI',
        { endpoint, params },
        { status: res.status, data },
        res.ok ? 'SUCCESS' : 'FAILURE',
        Date.now() - start,
      )

      if (!res.ok) throw new Error(`API call failed: ${res.status}`)
      return data
    } catch (err) {
      await this.logAction(
        'callExternalAPI',
        { endpoint, params },
        { error: err instanceof Error ? err.message : 'API error' },
        'FAILURE',
        Date.now() - start,
      )
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  async logAction(
    action: string,
    input: Record<string, unknown>,
    result: unknown,
    status: AgentLogStatus = 'SUCCESS',
    durationMs?: number,
  ): Promise<void> {
    await prisma.agentLog.create({
      data: {
        tenantId: this.tenantId,
        agentId: this.agentId,
        agentType: AGENT_TYPE_MAP[this.agentType] as AgentType,
        action,
        input: input as Prisma.InputJsonValue,
        result: (result ?? {}) as Prisma.InputJsonValue,
        status,
        durationMs,
        userId: this.userId,
        taskId: this.taskId,
      },
    })
  }
}

export function createToolkit(
  tenantId: string,
  agentId: string,
  agentType: AgentTypeKey,
  userId?: string,
  taskId?: string,
): AgentToolkit {
  return new AgentToolkit(tenantId, agentId, agentType, userId, taskId)
}

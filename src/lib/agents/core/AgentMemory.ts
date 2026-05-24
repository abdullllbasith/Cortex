import { prisma } from '@/lib/db/prisma'
import { Prisma, AgentType } from '@prisma/client'
import type { AgentTypeKey } from './types'
import { AGENT_TYPE_MAP } from './types'

const shortTermStore = new Map<string, Map<string, unknown>>()

function shortTermKey(tenantId: string, agentType: AgentTypeKey): string {
  return `${tenantId}:${agentType}`
}

export class AgentMemoryStore {
  constructor(
    private readonly tenantId: string,
    private readonly agentType: AgentTypeKey,
  ) {}

  private shortTermMap(): Map<string, unknown> {
    const key = shortTermKey(this.tenantId, this.agentType)
    if (!shortTermStore.has(key)) shortTermStore.set(key, new Map())
    return shortTermStore.get(key)!
  }

  setShortTerm(key: string, value: unknown): void {
    this.shortTermMap().set(key, value)
  }

  getShortTerm<T = unknown>(key: string): T | undefined {
    return this.shortTermMap().get(key) as T | undefined
  }

  clearShortTerm(): void {
    shortTermStore.delete(shortTermKey(this.tenantId, this.agentType))
  }

  async remember(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    this.setShortTerm(key, value)

    const expiresAt = ttlSeconds
      ? new Date(Date.now() + ttlSeconds * 1000)
      : null

    await prisma.agentMemory.upsert({
      where: {
        tenantId_agentType_key: {
          tenantId: this.tenantId,
          agentType: AGENT_TYPE_MAP[this.agentType],
          key,
        },
      },
      create: {
        tenantId: this.tenantId,
        agentType: AGENT_TYPE_MAP[this.agentType],
        key,
        value: value as Prisma.InputJsonValue,
        expiresAt,
      },
      update: {
        value: value as Prisma.InputJsonValue,
        expiresAt,
      },
    })
  }

  async recall<T = unknown>(key: string): Promise<T | null> {
    const cached = this.getShortTerm<T>(key)
    if (cached !== undefined) return cached

    const record = await prisma.agentMemory.findUnique({
      where: {
        tenantId_agentType_key: {
          tenantId: this.tenantId,
          agentType: AGENT_TYPE_MAP[this.agentType],
          key,
        },
      },
    })

    if (!record) return null
    if (record.expiresAt && record.expiresAt < new Date()) {
      await this.forget(key)
      return null
    }

    const value = record.value as T
    this.setShortTerm(key, value)
    return value
  }

  async forget(key: string): Promise<void> {
    this.shortTermMap().delete(key)
    await prisma.agentMemory.deleteMany({
      where: {
        tenantId: this.tenantId,
        agentType: AGENT_TYPE_MAP[this.agentType],
        key,
      },
    })
  }

  async listAll(): Promise<Array<{ key: string; value: unknown; expiresAt: Date | null }>> {
    const records = await prisma.agentMemory.findMany({
      where: {
        tenantId: this.tenantId,
        agentType: AGENT_TYPE_MAP[this.agentType],
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { updatedAt: 'desc' },
    })

    return records.map((r) => ({
      key: r.key,
      value: r.value,
      expiresAt: r.expiresAt,
    }))
  }
}

export async function injectAgentMemory(
  tenantId: string,
  agentType: AgentTypeKey,
  key: string,
  value: unknown,
): Promise<void> {
  const store = new AgentMemoryStore(tenantId, agentType)
  await store.remember(key, value)
}

export async function cleanupExpiredMemories(): Promise<number> {
  const result = await prisma.agentMemory.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return result.count
}

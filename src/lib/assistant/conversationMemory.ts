import { prisma } from '@/lib/db/prisma'
import { MessageRole, ConversationIntent, Prisma } from '@prisma/client'
import { summarizeWithClaude } from './claudeClient'
import type { ConversationTurn, ActionTaken } from './types'
import type { SemanticSearchResult } from '@/lib/embeddings/semanticSearch'

const SLIDING_WINDOW_SIZE = 20

export interface StoredMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  intent?: string
  confidence?: number
  sourcesUsed?: SemanticSearchResult[]
  actionsTaken?: ActionTaken[]
  suggestedFollowUps?: string[]
  createdAt: Date
}

export async function createSession(
  tenantId: string,
  userId: string,
  title = 'New conversation',
  channel = 'web',
) {
  return prisma.conversationSession.create({
    data: { tenantId, userId, title, channel },
  })
}

export async function getSession(tenantId: string, sessionId: string, userId: string) {
  return prisma.conversationSession.findFirst({
    where: { id: sessionId, tenantId, userId, archived: false },
  })
}

export async function listSessions(
  tenantId: string,
  userId: string,
  opts: { page?: number; limit?: number; archived?: boolean } = {},
) {
  const { page = 1, limit = 20, archived = false } = opts
  const where = { tenantId, userId, archived }

  const [data, total] = await Promise.all([
    prisma.conversationSession.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, role: true, createdAt: true },
        },
      },
    }),
    prisma.conversationSession.count({ where }),
  ])

  return { data, total }
}

export async function archiveSession(tenantId: string, sessionId: string, userId: string) {
  const session = await prisma.conversationSession.findFirst({
    where: { id: sessionId, tenantId, userId },
  })
  if (!session) return null

  return prisma.conversationSession.update({
    where: { id: sessionId },
    data: { archived: true },
  })
}

export async function saveMessage(params: {
  sessionId: string
  tenantId: string
  role: MessageRole
  content: string
  intent?: ConversationIntent
  confidence?: number
  sourcesUsed?: SemanticSearchResult[]
  actionsTaken?: ActionTaken[]
  suggestedFollowUps?: string[]
  metadata?: Record<string, unknown>
}) {
  const message = await prisma.conversationMessage.create({
    data: {
      sessionId: params.sessionId,
      tenantId: params.tenantId,
      role: params.role,
      content: params.content,
      intent: params.intent,
      confidence: params.confidence,
      sourcesUsed: (params.sourcesUsed ?? []) as unknown as Prisma.InputJsonValue,
      actionsTaken: (params.actionsTaken ?? []) as unknown as Prisma.InputJsonValue,
      suggestedFollowUps: (params.suggestedFollowUps ?? []) as unknown as Prisma.InputJsonValue,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
    },
  })

  await prisma.conversationSession.update({
    where: { id: params.sessionId },
    data: { updatedAt: new Date() },
  })

  return message
}

export async function getMessageHistory(
  tenantId: string,
  sessionId: string,
  opts: { page?: number; limit?: number } = {},
): Promise<{ messages: StoredMessage[]; total: number }> {
  const { page = 1, limit = 50 } = opts

  const [rows, total] = await Promise.all([
    prisma.conversationMessage.findMany({
      where: { sessionId, tenantId },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.conversationMessage.count({ where: { sessionId, tenantId } }),
  ])

  const messages: StoredMessage[] = rows.map((r) => ({
    id: r.id,
    role: r.role.toLowerCase() as StoredMessage['role'],
    content: r.content,
    intent: r.intent ?? undefined,
    confidence: r.confidence ?? undefined,
    sourcesUsed: r.sourcesUsed as unknown as SemanticSearchResult[],
    actionsTaken: r.actionsTaken as unknown as ActionTaken[],
    suggestedFollowUps: r.suggestedFollowUps as string[],
    createdAt: r.createdAt,
  }))

  return { messages, total }
}

export async function getContextWindow(
  tenantId: string,
  sessionId: string,
): Promise<{ recentTurns: ConversationTurn[]; summary?: string }> {
  const session = await prisma.conversationSession.findFirst({
    where: { id: sessionId, tenantId },
    select: { summary: true },
  })
  if (!session) return { recentTurns: [] }

  const [recentRows, total] = await Promise.all([
    prisma.conversationMessage.findMany({
      where: { sessionId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: SLIDING_WINDOW_SIZE,
      select: { role: true, content: true },
    }),
    prisma.conversationMessage.count({ where: { sessionId, tenantId } }),
  ])

  const recentTurns = recentRows.reverse().map((m) => ({
    role: m.role.toLowerCase() as ConversationTurn['role'],
    content: m.content,
  }))

  if (total <= SLIDING_WINDOW_SIZE) {
    return { recentTurns, summary: session.summary ?? undefined }
  }

  let summary = session.summary
  if (!summary) {
    const older = await prisma.conversationMessage.findMany({
      where: { sessionId, tenantId },
      orderBy: { createdAt: 'asc' },
      take: total - SLIDING_WINDOW_SIZE,
      select: { role: true, content: true },
    })
    const olderText = older.map((m) => `${m.role}: ${m.content}`).join('\n')

    void summarizeWithClaude(olderText)
      .then((newSummary) =>
        prisma.conversationSession.update({
          where: { id: sessionId },
          data: { summary: newSummary },
        }),
      )
      .catch(() => {})

    summary = olderText.slice(0, 4000)
  }

  return { recentTurns, summary }
}

export async function updateSessionTitle(sessionId: string, title: string) {
  return prisma.conversationSession.update({
    where: { id: sessionId },
    data: { title: title.slice(0, 200) },
  })
}

export function toConversationHistory(messages: StoredMessage[]): ConversationTurn[] {
  return messages.map((m) => ({ role: m.role, content: m.content }))
}

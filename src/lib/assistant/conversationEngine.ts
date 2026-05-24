import { prisma } from '@/lib/db/prisma'
import { semanticSearch } from '@/lib/embeddings/semanticSearch'
import { classifyIntent } from './intentClassifier'
import { routeActionHandler } from './actionHandlers'
import {
  completeWithClaude,
  streamWithClaude,
  isAssistantLlmAvailable,
} from './claudeClient'
import type {
  ConversationEngineInput,
  ConversationEngineResult,
  ConversationTurn,
} from './types'

const FALLBACK_MESSAGE =
  "I'm temporarily unable to reach the AI service. Based on your knowledge base, here's what I found relevant to your question. Please try again shortly or contact your administrator if this persists."

function buildSystemPrompt(params: {
  tenantName?: string
  permissions: string[]
  userRole?: string
  knowledgeContext: string
  actionsSummary?: string
  sessionSummary?: string
}): string {
  const now = new Date().toISOString()
  const permissionList = params.permissions.includes('*')
    ? 'Full access (*)'
    : params.permissions.join(', ') || 'Standard user'

  return `You are SAIOS, an enterprise AI executive assistant for ${params.tenantName ?? 'the organization'}.

Current date/time (UTC): ${now}

User role: ${params.userRole ?? 'Team member'}
Permissions: ${permissionList}

Your responsibilities:
- Answer business questions using ONLY the retrieved knowledge context below
- Execute and explain actions taken on behalf of the user
- Be concise, professional, and actionable
- Cite sources when referencing specific records
- If information is missing, say so clearly — never invent data

${params.sessionSummary ? `Earlier conversation summary:\n${params.sessionSummary}\n` : ''}

Retrieved knowledge context:
${params.knowledgeContext || 'No relevant knowledge retrieved for this query.'}

${params.actionsSummary ? `Actions executed this turn:\n${params.actionsSummary}\n` : ''}

Respond in clear markdown. End with 2-3 suggested follow-up questions when appropriate.`
}

function formatKnowledgeContext(
  sources: Awaited<ReturnType<typeof semanticSearch>>,
): string {
  if (sources.length === 0) return ''
  return sources
    .map(
      (s, i) =>
        `[${i + 1}] (${s.entityType}) ${s.title} — similarity ${(s.similarity * 100).toFixed(0)}%\n${s.snippet}`,
    )
    .join('\n\n')
}

function extractFollowUps(text: string): string[] {
  const lines = text.split('\n')
  const followUps: string[] = []
  let inFollowUp = false

  for (const line of lines) {
    if (/follow[- ]?up|you might also|consider asking/i.test(line)) {
      inFollowUp = true
      continue
    }
    if (inFollowUp && /^[-*•]\s+(.+)/.test(line)) {
      followUps.push(line.replace(/^[-*•]\s+/, '').trim())
    }
    if (inFollowUp && followUps.length >= 3) break
  }

  if (followUps.length === 0) {
    return [
      'Show me a summary of key metrics',
      'What actions can you help me with?',
      'Search our knowledge base for related policies',
    ].slice(0, 3)
  }

  return followUps.slice(0, 3)
}

async function resolveTenantName(tenantId: string): Promise<string | undefined> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  })
  return tenant?.name
}

export async function runConversationEngine(
  input: ConversationEngineInput,
): Promise<ConversationEngineResult> {
  const {
    tenantId,
    userId,
    userMessage,
    conversationHistory,
    permissions = [],
    userRole,
    tenantName: inputTenantName,
  } = input

  const [sourcesUsed, tenantName] = await Promise.all([
    semanticSearch({ tenantId, query: userMessage, topK: 10 }),
    inputTenantName ? Promise.resolve(inputTenantName) : resolveTenantName(tenantId),
  ])

  const classification = classifyIntent(userMessage)
  const actionsTaken = await routeActionHandler(tenantId, userId, userMessage, classification)

  const knowledgeContext = formatKnowledgeContext(sourcesUsed)
  const actionsSummary = actionsTaken
    .map((a) => `- ${a.description} (${a.status})`)
    .join('\n')

  const systemPrompt = buildSystemPrompt({
    tenantName,
    permissions,
    userRole,
    knowledgeContext,
    actionsSummary,
  })

  const messages: ConversationTurn[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ]

  let assistantMessage: string

  try {
    if (isAssistantLlmAvailable()) {
      assistantMessage = await completeWithClaude({ systemPrompt, messages })
    } else {
      assistantMessage = buildFallbackResponse(userMessage, sourcesUsed, actionsTaken)
    }
  } catch (err) {
    console.error('[conversationEngine]', err)
    assistantMessage = buildFallbackResponse(userMessage, sourcesUsed, actionsTaken, true)
  }

  return {
    assistantMessage,
    sourcesUsed,
    actionsTaken,
    suggestedFollowUps: extractFollowUps(assistantMessage),
    intent: classification,
  }
}

export async function* streamConversationEngine(
  input: ConversationEngineInput & { sessionSummary?: string },
): AsyncGenerator<
  | { type: 'token'; content: string }
  | { type: 'metadata'; data: ConversationEngineResult },
  void,
  unknown
> {
  const result = await prepareEngineContext(input)

  if (!isAssistantLlmAvailable()) {
    yield { type: 'token', content: result.fallbackMessage }
    yield { type: 'metadata', data: result.engineResult }
    return
  }

  try {
    let fullText = ''
    for await (const token of streamWithClaude({
      systemPrompt: result.systemPrompt,
      messages: result.messages,
    })) {
      fullText += token
      yield { type: 'token', content: token }
    }

    yield {
      type: 'metadata',
      data: {
        ...result.engineResult,
        assistantMessage: fullText,
        suggestedFollowUps: extractFollowUps(fullText),
      },
    }
  } catch (err) {
    console.error('[conversationEngine:stream]', err)
    yield { type: 'token', content: result.fallbackMessage }
    yield { type: 'metadata', data: result.engineResult }
  }
}

async function prepareEngineContext(input: ConversationEngineInput & { sessionSummary?: string }) {
  const {
    tenantId,
    userId,
    userMessage,
    conversationHistory,
    permissions = [],
    userRole,
    sessionSummary,
    tenantName: inputTenantName,
  } = input

  const classification = classifyIntent(userMessage)

  const [sourcesUsed, tenantName, actionsTaken] = await Promise.all([
    semanticSearch({ tenantId, query: userMessage, topK: 10 }),
    inputTenantName ? Promise.resolve(inputTenantName) : resolveTenantName(tenantId),
    routeActionHandler(tenantId, userId, userMessage, classification),
  ])

  const knowledgeContext = formatKnowledgeContext(sourcesUsed)
  const actionsSummary = actionsTaken.map((a) => `- ${a.description} (${a.status})`).join('\n')

  const systemPrompt = buildSystemPrompt({
    tenantName,
    permissions,
    userRole,
    knowledgeContext,
    actionsSummary,
    sessionSummary,
  })

  const messages: ConversationTurn[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ]

  const engineResult: ConversationEngineResult = {
    assistantMessage: '',
    sourcesUsed,
    actionsTaken,
    suggestedFollowUps: [],
    intent: classification,
  }

  const fallbackMessage = buildFallbackResponse(userMessage, sourcesUsed, actionsTaken, true)

  return { systemPrompt, messages, engineResult, fallbackMessage }
}

function buildFallbackResponse(
  userMessage: string,
  sources: Awaited<ReturnType<typeof semanticSearch>>,
  actions: ConversationEngineResult['actionsTaken'],
  isError = false,
): string {
  const intro = isError ? FALLBACK_MESSAGE : "Here's what I found in your knowledge base:"

  const sourceBlock =
    sources.length > 0
      ? sources
          .slice(0, 5)
          .map((s) => `- **${s.title}** (${s.entityType}): ${s.snippet.slice(0, 120)}…`)
          .join('\n')
      : '- No closely matching records found.'

  const actionBlock =
    actions.length > 0
      ? `\n\n**Actions taken:**\n${actions.map((a) => `- ${a.description}`).join('\n')}`
      : ''

  return `${intro}\n\nRegarding: "${userMessage.slice(0, 100)}"\n\n${sourceBlock}${actionBlock}`
}

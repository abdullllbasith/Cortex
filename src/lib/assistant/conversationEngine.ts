import { prisma } from '@/lib/db/prisma'
import { classifyIntent, isLightweightAssistantMessage } from './intentClassifier'
import { routeActionHandler } from './actionHandlers'
import {
  detectModuleContext,
  buildERPContext,
  searchErpKnowledge,
} from './erpContext'
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
  userName?: string
  userRole?: string
  permissions: string[]
  erpContextFormatted: string
  knowledgeContext: string
  actionsSummary?: string
  sessionSummary?: string
}): string {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const permissionList = params.permissions.includes('*')
    ? 'Full access'
    : params.permissions.join(', ') || 'Standard user'

  return `You are SAIOS, the AI operating system for ${params.tenantName ?? 'this organization'}.
Today is ${today}. The current user is ${params.userName ?? 'a team member'} (${params.userRole ?? 'user'}).
Permissions: ${permissionList}

LIVE BUSINESS DATA:
${params.erpContextFormatted || 'No live module data loaded for this message.'}

RELEVANT KNOWLEDGE:
${params.knowledgeContext || 'No relevant knowledge retrieved.'}

You can take real actions:
- View and update inventory, stock, and products
- Create and manage purchase orders
- View and manage customers, deals, and activities
- Create quotes and orders
- Create invoices and record payments
- Answer any question about the business using the data above

Always confirm before taking irreversible actions (stock adjustments, PO creation, payments, deal stage changes).
For data queries, answer directly with specific numbers from LIVE BUSINESS DATA.
For proposed actions marked awaiting_confirmation, describe what will happen and ask the user to confirm in the UI.

${params.sessionSummary ? `Earlier conversation summary:\n${params.sessionSummary}\n` : ''}
${params.actionsSummary ? `Actions this turn:\n${params.actionsSummary}\n` : ''}

Respond in clear markdown. End with 2-3 suggested follow-up questions when appropriate.`
}

function formatKnowledgeContext(
  sources: Awaited<ReturnType<typeof searchErpKnowledge>>,
): string {
  if (sources.length === 0) return ''
  return sources
    .map(
      (s, i) =>
        `[${i + 1}] (${s.entityType}) ${s.title} — ${(s.similarity * 100).toFixed(0)}% match\n${s.snippet}`,
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
      'What needs my attention today?',
      'Show overdue invoices and follow-ups',
      'Summarize pipeline and low stock',
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

async function resolveUserName(userId: string): Promise<string | undefined> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true, email: true },
  })
  return user?.fullName ?? user?.email
}

export async function runConversationEngine(
  input: ConversationEngineInput,
): Promise<ConversationEngineResult> {
  const ctx = await prepareEngineContext(input)
  let assistantMessage: string

  try {
    if (isAssistantLlmAvailable()) {
      assistantMessage = await completeWithClaude({
        systemPrompt: ctx.systemPrompt,
        messages: ctx.messages,
      })
    } else {
      assistantMessage = ctx.fallbackMessage
    }
  } catch (err) {
    console.error('[conversationEngine]', err)
    assistantMessage = ctx.fallbackMessage
  }

  return {
    ...ctx.engineResult,
    assistantMessage,
    suggestedFollowUps: extractFollowUps(assistantMessage),
  }
}

export async function* streamConversationEngine(
  input: ConversationEngineInput & { sessionSummary?: string },
): AsyncGenerator<
  | { type: 'status'; content: string }
  | { type: 'token'; content: string }
  | { type: 'metadata'; data: ConversationEngineResult },
  void,
  unknown
> {
  yield { type: 'status', content: 'Preparing context…' }
  const ctx = await prepareEngineContext(input)

  if (!isAssistantLlmAvailable()) {
    yield { type: 'token', content: ctx.fallbackMessage }
    yield { type: 'metadata', data: { ...ctx.engineResult, assistantMessage: ctx.fallbackMessage } }
    return
  }

  try {
    let fullText = ''
    for await (const token of streamWithClaude({
      systemPrompt: ctx.systemPrompt,
      messages: ctx.messages,
    })) {
      fullText += token
      yield { type: 'token', content: token }
    }

    yield {
      type: 'metadata',
      data: {
        ...ctx.engineResult,
        assistantMessage: fullText,
        suggestedFollowUps: extractFollowUps(fullText),
      },
    }
  } catch (err) {
    console.error('[conversationEngine:stream]', err)
    yield { type: 'token', content: ctx.fallbackMessage }
    yield { type: 'metadata', data: { ...ctx.engineResult, assistantMessage: ctx.fallbackMessage } }
  }
}

async function prepareEngineContext(
  input: ConversationEngineInput & { sessionSummary?: string },
) {
  const {
    tenantId,
    userId,
    userMessage,
    conversationHistory,
    permissions = [],
    userRole,
    userName: inputUserName,
    tenantName: inputTenantName,
    sessionSummary,
  } = input

  const classification = classifyIntent(userMessage)
  const modules = detectModuleContext(userMessage)
  const skipHeavyContext = isLightweightAssistantMessage(userMessage, classification)

  const emptyErp = {
    structured: {},
    formatted: 'No module-specific live data loaded for this query.',
  }

  const [sourcesUsed, tenantName, userName, erpBuilt, actionsTaken] = await Promise.all([
    skipHeavyContext
      ? Promise.resolve([] as Awaited<ReturnType<typeof searchErpKnowledge>>)
      : searchErpKnowledge(tenantId, userMessage, modules, 5),
    inputTenantName ? Promise.resolve(inputTenantName) : resolveTenantName(tenantId),
    inputUserName ? Promise.resolve(inputUserName) : resolveUserName(userId),
    skipHeavyContext || modules.length === 0
      ? Promise.resolve(emptyErp)
      : buildERPContext(tenantId, modules),
    skipHeavyContext
      ? Promise.resolve([] as ConversationEngineResult['actionsTaken'])
      : routeActionHandler(tenantId, userId, userMessage, classification),
  ])

  const knowledgeContext = formatKnowledgeContext(sourcesUsed)
  const actionsSummary = actionsTaken
    .map((a) => {
      if (a.status === 'awaiting_confirmation') {
        return `- [Awaiting confirmation] ${a.displayTitle ?? a.description}`
      }
      return `- ${a.description} (${a.status})`
    })
    .join('\n')

  const systemPrompt = buildSystemPrompt({
    tenantName,
    userName,
    userRole,
    permissions,
    erpContextFormatted: erpBuilt.formatted,
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

  const fallbackMessage = buildFallbackResponse(
    userMessage,
    sourcesUsed,
    actionsTaken,
    erpBuilt.formatted,
    true,
  )

  return { systemPrompt, messages, engineResult, fallbackMessage }
}

function buildFallbackResponse(
  userMessage: string,
  sources: Awaited<ReturnType<typeof searchErpKnowledge>>,
  actions: ConversationEngineResult['actionsTaken'],
  erpContext: string,
  isError = false,
): string {
  const intro = isError ? FALLBACK_MESSAGE : "Here's what I found from your live ERP data:"

  const erpBlock = erpContext ? `\n\n**Live data:**\n${erpContext}` : ''

  const sourceBlock =
    sources.length > 0
      ? `\n\n**Knowledge:**\n${sources
          .slice(0, 5)
          .map((s) => `- **${s.title}**: ${s.snippet.slice(0, 120)}…`)
          .join('\n')}`
      : ''

  const actionBlock =
    actions.length > 0
      ? `\n\n**Actions:**\n${actions.map((a) => `- ${a.description}${a.requiresConfirmation ? ' (confirm in UI)' : ''}`).join('\n')}`
      : ''

  return `${intro}\n\nRegarding: "${userMessage.slice(0, 100)}"${erpBlock}${sourceBlock}${actionBlock}`
}

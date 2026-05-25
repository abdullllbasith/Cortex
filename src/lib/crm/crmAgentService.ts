import { completeWithClaude, isAssistantLlmAvailable } from '@/lib/assistant/claudeClient'
import { prisma } from '@/lib/db/prisma'
import { getContact } from './contactService'

export interface ContactInsights {
  summary: string
  nextBestAction: string
  generatedAt: string
  source: 'ai' | 'heuristic'
}

function daysSince(date: Date | null | undefined): number | null {
  if (!date) return null
  return Math.floor((Date.now() - date.getTime()) / 86400000)
}

function buildHeuristicInsights(contact: NonNullable<Awaited<ReturnType<typeof getContact>>>): ContactInsights {
  const fullName = `${contact.firstName} ${contact.lastName}`.trim()
  const openDeals = contact.deals ?? []
  const openValue = openDeals.reduce((s, d) => s + Number(d.value), 0)
  const gap = daysSince(contact.lastContactedAt)
  const overdue = contact.nextFollowUpAt && contact.nextFollowUpAt < new Date()

  const parts: string[] = []
  if (openValue > 0) {
    parts.push(`${fullName} has $${openValue.toLocaleString()} in open pipeline across ${openDeals.length} deal(s).`)
  } else {
    parts.push(`${fullName} is a ${contact.type.toLowerCase()} with no open deals currently.`)
  }

  if (gap != null && gap > 30) {
    parts.push(`Last touchpoint was ${gap} days ago — engagement gap suggests churn risk.`)
  } else if (gap != null) {
    parts.push(`Last contacted ${gap} day(s) ago via ${contact.source.toLowerCase().replace('_', ' ')} source.`)
  } else {
    parts.push('No recorded contact activity yet — early-stage relationship.')
  }

  if (contact.type === 'CUSTOMER' && openValue >= 10000) {
    parts.push('High-value account worth proactive retention outreach.')
  }

  let nextBestAction = 'Schedule a discovery call to qualify needs.'
  if (overdue) nextBestAction = 'Send follow-up now — follow-up date is overdue.'
  else if (gap != null && gap > 45) nextBestAction = 'Re-engage with a personalized check-in email or call.'
  else if (openValue > 0) nextBestAction = 'Advance the open deal — confirm next steps and timeline.'
  else if (contact.type === 'LEAD') nextBestAction = 'Send intro email and book a demo within 48 hours.'

  return {
    summary: parts.slice(0, 3).join(' '),
    nextBestAction,
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
  }
}

export async function generateContactInsights(
  tenantId: string,
  contactId: string,
): Promise<ContactInsights> {
  const contact = await getContact(tenantId, contactId)
  if (!contact) throw new Error('Contact not found')

  const activities = await prisma.crmActivity.findMany({
    where: { tenantId, contactId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { type: true, subject: true, createdAt: true },
  })

  const heuristic = buildHeuristicInsights(contact)

  if (!isAssistantLlmAvailable()) return heuristic

  const context = JSON.stringify({
    name: `${contact.firstName} ${contact.lastName}`,
    type: contact.type,
    company: contact.company,
    source: contact.source,
    tags: contact.tags,
    openDeals: contact.deals,
    lastContactedAt: contact.lastContactedAt,
    nextFollowUpAt: contact.nextFollowUpAt,
    recentActivities: activities,
    notes: contact.notes?.slice(0, 500),
  })

  try {
    const raw = await completeWithClaude({
      systemPrompt: `You are SalesAgent, an expert sales director AI for SAIOS CRM.
Return JSON only: {"summary":"3 sentences about this contact","nextBestAction":"one specific action"}`,
      messages: [
        {
          role: 'user',
          content: `Analyze this CRM contact and provide a 3-sentence summary plus one next-best-action recommendation:\n${context}`,
        },
      ],
      maxTokens: 400,
      temperature: 0.3,
    })

    const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim()) as {
      summary?: string
      nextBestAction?: string
    }

    if (parsed.summary && parsed.nextBestAction) {
      return {
        summary: parsed.summary,
        nextBestAction: parsed.nextBestAction,
        generatedAt: new Date().toISOString(),
        source: 'ai',
      }
    }
  } catch {
    /* fall back to heuristic */
  }

  return heuristic
}

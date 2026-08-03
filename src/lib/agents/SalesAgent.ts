import { prisma } from '@/lib/db/prisma'
import { calculatePipelineValue, getDefaultPipeline, moveDeal, parseStages } from '@/lib/crm/pipelineService'
import { createQuote as createQuoteRecord } from '@/lib/sales/quoteService'
import { BaseAgent } from './core/BaseAgent'
import type { AgentTaskInput, AgentToolDefinition } from './core/types'

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

export class SalesAgent extends BaseAgent<AgentTaskInput, Record<string, unknown>> {
  private readonly actorId?: string

  readonly systemPrompt = `You are an expert Sales Director AI agent with full CRM and quote-to-order access.
Manage leads, pipeline, quotes, and follow-ups. All responses use live tenant data from Postgres — never invent customers or deals.`

  readonly tools: AgentToolDefinition[] = [
    { name: 'getLeads', description: 'CRM contacts type=LEAD, newest first (limit 20)' },
    { name: 'getPipelineValue', description: 'Open pipeline value and weighted forecast from default pipeline' },
    { name: 'getDealsNeedingAttention', description: 'Open deals past stage rottenDays threshold' },
    { name: 'moveDealToStage', description: 'Move deal to pipeline stage by name', parameters: { dealId: 'string', stageName: 'string' } },
    { name: 'createQuote', description: 'Create sales quote', parameters: { contactId: 'string', productIds: 'array', quantities: 'array', items: 'array' } },
    { name: 'getOverdueFollowUps', description: 'Incomplete scheduled activities past due with contact context' },
    { name: 'queryKnowledgeBase', description: 'Search sales knowledge' },
  ]

  constructor(tenantId: string, userId?: string, taskId?: string) {
    super(tenantId, 'sales', undefined, userId, taskId)
    this.actorId = userId
  }

  protected async executeTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'getLeads':
        return this.getLeads()
      case 'getPipelineValue':
        return this.getPipelineValue()
      case 'getDealsNeedingAttention':
        return this.getDealsNeedingAttention()
      case 'moveDealToStage':
        return this.moveDealToStage(String(input.dealId ?? ''), String(input.stageName ?? ''))
      case 'createQuote':
        return this.createQuote(
          String(input.contactId ?? ''),
          input.productIds as string[] | undefined,
          input.quantities as number[] | undefined,
          input.items as Array<Record<string, unknown>> | undefined,
        )
      case 'getOverdueFollowUps':
        return this.getOverdueFollowUps()
      case 'queryKnowledgeBase':
        return this.toolkit.queryKnowledgeBase(String(input.query ?? 'sales'), 'customer')
      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }

  protected heuristicThink(input: AgentTaskInput, iteration: number) {
    const lower = input.task.toLowerCase()
    if (/\b(rotten|stale|attention)\b/i.test(lower)) {
      return { reasoning: 'Deals needing attention', plannedTool: 'getDealsNeedingAttention', plannedInput: {}, iteration }
    }
    if (/\bpipeline\b/i.test(lower)) {
      return { reasoning: 'Pipeline value', plannedTool: 'getPipelineValue', plannedInput: {}, iteration }
    }
    if (/\blead/i.test(lower)) {
      return { reasoning: 'Recent leads', plannedTool: 'getLeads', plannedInput: {}, iteration }
    }
    if (/follow[- ]?up|overdue/i.test(lower)) {
      return { reasoning: 'Overdue follow-ups', plannedTool: 'getOverdueFollowUps', plannedInput: {}, iteration }
    }
    if (/quote/i.test(lower)) {
      return { reasoning: 'Create quote', plannedTool: 'createQuote', plannedInput: {}, iteration }
    }
    return { reasoning: 'Sales pipeline overview', plannedTool: 'getPipelineValue', plannedInput: {}, iteration }
  }

  async getLeads() {
    const contacts = await prisma.crmContact.findMany({
      where: { tenantId: this.tenantId, type: 'LEAD', isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        source: true,
        createdAt: true,
        nextFollowUpAt: true,
        owner: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return {
      count: contacts.length,
      leads: contacts.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: c.email,
        phone: c.phone,
        company: c.company,
        source: c.source,
        ownerName: c.owner?.fullName ?? null,
        createdAt: c.createdAt.toISOString(),
        nextFollowUpAt: c.nextFollowUpAt?.toISOString() ?? null,
      })),
    }
  }

  async getPipelineValue() {
    const defaultPipeline = await getDefaultPipeline(this.tenantId)
    const pipeline = await calculatePipelineValue(
      this.tenantId,
      defaultPipeline?.id,
    )
    const stages = defaultPipeline ? parseStages(defaultPipeline.stages) : []
    const stageNames = new Map(stages.map((s) => [s.id, s.name]))

    return {
      pipelineId: defaultPipeline?.id ?? null,
      pipelineName: defaultPipeline?.name ?? null,
      totalValue: Math.round(pipeline.totalValue),
      weightedValue: Math.round(pipeline.weightedValue),
      dealCount: pipeline.dealCount,
      dealsByStage: pipeline.dealsByStage.map((s) => ({
        ...s,
        stageName: stageNames.get(s.stageId) ?? s.stageId,
        value: Math.round(s.value),
      })),
    }
  }

  async getDealsNeedingAttention() {
    const deals = await prisma.crmDeal.findMany({
      where: { tenantId: this.tenantId, status: 'OPEN' },
      include: {
        contact: { select: { firstName: true, lastName: true, email: true } },
        owner: { select: { fullName: true } },
        pipeline: { select: { stages: true, name: true } },
      },
      orderBy: { stageEnteredAt: 'asc' },
    })

    const now = Date.now()
    const attention = deals
      .map((d) => {
        const stages = parseStages(d.pipeline.stages)
        const stage = stages.find((s) => s.id === d.stageId)
        const rottenDays = stage?.rottenDays ?? 14
        const daysInStage = Math.floor((now - d.stageEnteredAt.getTime()) / 86400000)
        const rotten = daysInStage > rottenDays
        return {
          id: d.id,
          title: d.title,
          stageId: d.stageId,
          stageName: stage?.name ?? d.stageId,
          pipelineName: d.pipeline.name,
          value: toNumber(d.value),
          probability: d.probability,
          daysInStage,
          rottenThresholdDays: rottenDays,
          rotten,
          contactName: d.contact
            ? `${d.contact.firstName} ${d.contact.lastName}`.trim()
            : null,
          contactEmail: d.contact?.email ?? null,
          ownerName: d.owner?.fullName ?? null,
          stageEnteredAt: d.stageEnteredAt.toISOString(),
        }
      })
      .filter((d) => d.rotten)

    return {
      count: attention.length,
      deals: attention.sort((a, b) => b.daysInStage - a.daysInStage),
    }
  }

  async moveDealToStage(dealId: string, stageName: string) {
    if (!dealId || !stageName) throw new Error('dealId and stageName are required')

    const deal = await prisma.crmDeal.findFirst({
      where: { id: dealId, tenantId: this.tenantId },
      include: { pipeline: true },
    })
    if (!deal) throw new Error('Deal not found')

    const stages = parseStages(deal.pipeline.stages)
    const match = stages.find((s) => s.name.toLowerCase() === stageName.toLowerCase())
    if (!match) throw new Error(`Stage "${stageName}" not found in pipeline`)

    return moveDeal(dealId, match.id, this.tenantId, this.actorId)
  }

  async createQuote(
    contactId: string,
    productIds?: string[],
    quantities?: number[],
    items?: Array<Record<string, unknown>>,
  ) {
    if (!contactId) throw new Error('contactId is required')

    let lineItems = items ?? []

    if (productIds?.length) {
      const products = await prisma.product.findMany({
        where: { tenantId: this.tenantId, id: { in: productIds }, isActive: true },
        select: {
          id: true,
          name: true,
          sku: true,
          sellingPrice: true,
          taxRate: true,
        },
      })
      const productMap = new Map(products.map((p) => [p.id, p]))

      lineItems = productIds.map((pid, index) => {
        const product = productMap.get(pid)
        if (!product) throw new Error(`Product ${pid} not found`)
        const qty = quantities?.[index] ?? 1
        const unitPrice = toNumber(product.sellingPrice)
        const discount = 0
        const taxRate = toNumber(product.taxRate)
        const lineSubtotal = unitPrice * qty * (1 - discount / 100)
        const lineTotal = lineSubtotal * (1 + taxRate / 100)
        return {
          productId: pid,
          description: product.name,
          sku: product.sku,
          quantity: qty,
          unitPrice,
          discount,
          taxRate,
          lineTotal: Math.round(lineTotal * 100) / 100,
        }
      })
    }

    if (!lineItems.length) throw new Error('productIds or items are required')

    const quote = await createQuoteRecord(
      this.tenantId,
      { contactId, items: lineItems },
      this.actorId,
    )

    return {
      id: quote?.id,
      quoteNumber: quote?.quoteNumber,
      status: quote?.status,
      total: quote?.total,
      contactId,
    }
  }

  async getOverdueFollowUps() {
    const now = new Date()
    const activities = await prisma.crmActivity.findMany({
      where: {
        tenantId: this.tenantId,
        isCompleted: false,
        scheduledAt: { lt: now },
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
            phone: true,
          },
        },
        assignee: { select: { fullName: true } },
        deal: { select: { id: true, title: true, value: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    })

    const contactFollowUps = await prisma.crmContact.findMany({
      where: {
        tenantId: this.tenantId,
        isActive: true,
        nextFollowUpAt: { lt: now },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        company: true,
        nextFollowUpAt: true,
      },
      take: 20,
    })

    return {
      activityCount: activities.length,
      activities: activities.map((a) => ({
        id: a.id,
        type: a.type,
        subject: a.subject,
        scheduledAt: a.scheduledAt?.toISOString() ?? null,
        daysOverdue: a.scheduledAt
          ? Math.floor((now.getTime() - a.scheduledAt.getTime()) / 86400000)
          : 0,
        contactId: a.contactId,
        contactName: a.contact
          ? `${a.contact.firstName} ${a.contact.lastName}`.trim()
          : null,
        contactEmail: a.contact?.email ?? null,
        contactCompany: a.contact?.company ?? null,
        assigneeName: a.assignee?.fullName ?? null,
        dealTitle: a.deal?.title ?? null,
        dealValue: a.deal ? toNumber(a.deal.value) : null,
      })),
      contactFollowUpCount: contactFollowUps.length,
      contactFollowUps: contactFollowUps.map((c) => ({
        contactId: c.id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: c.email,
        company: c.company,
        nextFollowUpAt: c.nextFollowUpAt?.toISOString() ?? null,
      })),
    }
  }
}

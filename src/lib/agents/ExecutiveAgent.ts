import { InvoiceStatus } from '@prisma/client'
import { completeWithClaude, isAssistantLlmAvailable } from '@/lib/assistant/claudeClient'
import { prisma } from '@/lib/db/prisma'
import { BaseAgent } from './core/BaseAgent'
import { FinanceAgent } from './FinanceAgent'
import { InventoryAgent } from './InventoryAgent'
import { OperationsAgent } from './OperationsAgent'
import { SalesAgent } from './SalesAgent'
import type {
  AgentAction,
  AgentResponse,
  AgentTaskInput,
  AgentTaskStep,
  AgentToolDefinition,
  AgentTypeKey,
} from './core/types'

export class ExecutiveAgent extends BaseAgent<AgentTaskInput, Record<string, unknown>> {
  readonly systemPrompt = `You are an expert CEO and strategic advisor AI agent with cross-module ERP visibility.
Synthesize finance, sales, inventory, and HR data into board-level recommendations. Every metric is loaded from live ERP services.`

  readonly tools: AgentToolDefinition[] = [
    { name: 'getBusinessHealthSummary', description: 'Cross-module health with AI executive synthesis' },
    { name: 'getDailyBriefing', description: 'Daily briefing: health + overdue AR, follow-ups, deliveries, approvals' },
    { name: 'getWeeklyDigest', description: 'Alias for getDailyBriefing (backward compatible)' },
    { name: 'delegateToAgent', description: 'Delegate sub-task to specialized agent', parameters: { agentType: 'string', task: 'string' } },
    { name: 'synthesizeInsights', description: 'Synthesize multiple agent responses' },
    { name: 'queryKnowledgeBase', description: 'Search strategic knowledge' },
  ]

  private stepCallback?: (step: AgentTaskStep) => void
  private involvedAgents: AgentTypeKey[] = []
  private taskIdRef?: string

  constructor(tenantId: string, userId?: string, taskId?: string) {
    super(tenantId, 'executive', undefined, userId, taskId)
    this.taskIdRef = taskId
  }

  setStepCallback(cb: (step: AgentTaskStep) => void): void {
    this.stepCallback = cb
  }

  protected async executeTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'getBusinessHealthSummary':
        return this.getBusinessHealthSummary()
      case 'getDailyBriefing':
      case 'getWeeklyDigest':
        return this.getDailyBriefing()
      case 'delegateToAgent':
        return this.delegateToAgent(String(input.agentType ?? 'finance'), String(input.task ?? ''))
      case 'synthesizeInsights':
        return this.synthesizeInsights((input.responses as AgentResponse[]) ?? [])
      case 'queryKnowledgeBase':
        return this.toolkit.queryKnowledgeBase(String(input.query ?? 'strategy'), 'all')
      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }

  protected heuristicThink(input: AgentTaskInput, iteration: number) {
    const lower = input.task.toLowerCase()
    if (/daily|briefing|morning/i.test(lower)) {
      return { reasoning: 'Daily executive briefing', plannedTool: 'getDailyBriefing', plannedInput: {}, iteration }
    }
    if (iteration === 1) {
      return {
        reasoning: 'Cross-module business health synthesis',
        plannedTool: 'getBusinessHealthSummary',
        plannedInput: {},
        iteration,
      }
    }
    return super.heuristicThink(input, iteration)
  }

  async getBusinessHealthSummary() {
    this.involvedAgents.push('finance', 'inventory', 'sales')

    const tenant = await prisma.tenant.findUnique({
      where: { id: this.tenantId },
      select: { name: true },
    })
    const companyName = tenant?.name ?? 'Your company'

    const inventory = new InventoryAgent(this.tenantId, undefined, this.taskIdRef)
    const sales = new SalesAgent(this.tenantId, undefined, this.taskIdRef)
    const finance = new FinanceAgent(this.tenantId, undefined, this.taskIdRef)

    const [lowStock, pipeline, ar, pnl] = await Promise.all([
      inventory.getLowStockItems(),
      sales.getPipelineValue(),
      finance.getOutstandingAR(),
      finance.getProfitAndLoss('month'),
    ])

    const dataBlock = {
      inventory: {
        lowStockCount: lowStock.count,
        criticalItems: lowStock.items.filter((i) => i.urgency === 'critical').slice(0, 8),
        warningItems: lowStock.items.filter((i) => i.urgency === 'warning').slice(0, 5),
      },
      pipeline: {
        totalValue: pipeline.totalValue,
        weightedValue: pipeline.weightedValue,
        dealCount: pipeline.dealCount,
        dealsByStage: pipeline.dealsByStage,
      },
      outstandingAR: ar,
      profitAndLoss: pnl,
    }

    let executiveSummary = ''
    let priorityActions: string[] = []

    if (isAssistantLlmAvailable()) {
      const answer = await completeWithClaude({
        systemPrompt: `You are the executive AI for ${companyName}. Be concise, numeric, and action-oriented.`,
        messages: [
          {
            role: 'user',
            content: `You are the executive AI for ${companyName}. Here is today's data:

Inventory (low stock): ${JSON.stringify(dataBlock.inventory)}

Pipeline: ${JSON.stringify(dataBlock.pipeline)}

Outstanding AR: ${JSON.stringify(dataBlock.outstandingAR)}

This month P&L: ${JSON.stringify(dataBlock.profitAndLoss)}

Provide a 3-sentence executive summary and list exactly 3 priority actions as a JSON object:
{"summary":"...","priorityActions":["action1","action2","action3"]}`,
          },
        ],
        maxTokens: 1024,
        temperature: 0.3,
      })

      try {
        const parsed = JSON.parse(answer.replace(/```json\n?|\n?```/g, '').trim()) as {
          summary?: string
          priorityActions?: string[]
        }
        executiveSummary = parsed.summary ?? answer
        priorityActions = parsed.priorityActions ?? []
      } catch {
        executiveSummary = answer
        priorityActions = this.buildDefaultPriorities(dataBlock)
      }
    } else {
      executiveSummary = [
        `MTD net income is $${pnl.netIncome?.toLocaleString() ?? 0} (${pnl.changePercent ?? 0}% vs prior).`,
        `Pipeline: $${pipeline.totalValue.toLocaleString()} across ${pipeline.dealCount} open deals (weighted $${pipeline.weightedValue.toLocaleString()}).`,
        lowStock.count
          ? `${lowStock.count} SKUs need reorder attention.`
          : 'Inventory is within reorder thresholds.',
        `AR outstanding: $${ar.totalOutstanding.toLocaleString()}.`,
      ].join(' ')
      priorityActions = this.buildDefaultPriorities(dataBlock)
    }

    const risks: string[] = []
    if (pnl.netIncome < 0) risks.push('Negative net income this month')
    if (lowStock.count > 0) risks.push(`${lowStock.count} SKUs below reorder point`)
    if (ar.totalOutstanding > (pnl.revenueTotal ?? 0) * 0.5 && ar.totalOutstanding > 0) {
      risks.push('AR outstanding exceeds 50% of MTD revenue')
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      companyName,
      executiveSummary,
      priorityActions: priorityActions.length ? priorityActions : this.buildDefaultPriorities(dataBlock),
      data: dataBlock,
      risks,
    }

    this.stepCallback?.({
      type: 'action',
      agentType: 'executive',
      agentId: this.agentId,
      content: 'Synthesized cross-module business health summary',
      timestamp: new Date().toISOString(),
    })

    return summary
  }

  private buildDefaultPriorities(data: {
    inventory: { lowStockCount: number }
    pipeline: { dealCount: number; weightedValue: number }
    outstandingAR: { totalOutstanding: number }
    profitAndLoss: { netIncome: number }
  }): string[] {
    const actions: string[] = []
    if (data.inventory.lowStockCount > 0) {
      actions.push(`Replenish ${data.inventory.lowStockCount} low-stock SKUs`)
    }
    if (data.profitAndLoss.netIncome < 0) {
      actions.push('Review expense drivers and margin recovery plan')
    }
    if (data.pipeline.dealCount > 0) {
      actions.push(
        `Advance ${data.pipeline.dealCount} open deals ($${data.pipeline.weightedValue.toLocaleString()} weighted)`,
      )
    }
    if (data.outstandingAR.totalOutstanding > 0) {
      actions.push(`Collect $${data.outstandingAR.totalOutstanding.toLocaleString()} in outstanding AR`)
    }
    return actions.slice(0, 3)
  }

  async getDailyBriefing() {
    const health = await this.getBusinessHealthSummary()
    this.involvedAgents.push('sales', 'operations', 'finance')

    const sales = new SalesAgent(this.tenantId, undefined, this.taskIdRef)
    const operations = new OperationsAgent(this.tenantId, undefined, this.taskIdRef)

    const now = new Date()
    const [overdueInvoices, overdueFollowUps, upcomingDeliveries, pendingLeave] =
      await Promise.all([
        prisma.invoice.findMany({
          where: {
            tenantId: this.tenantId,
            status: { in: [InvoiceStatus.OVERDUE, InvoiceStatus.SENT, InvoiceStatus.PARTIAL] },
            dueDate: { lt: now },
            amountDue: { gt: 0 },
          },
          select: { id: true, invoiceNumber: true, amountDue: true, dueDate: true },
          take: 20,
        }),
        sales.getOverdueFollowUps(),
        prisma.salesOrder.findMany({
          where: {
            tenantId: this.tenantId,
            status: { in: ['PACKED', 'SHIPPED', 'CONFIRMED', 'PROCESSING'] },
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            confirmedAt: true,
            total: true,
            contact: { select: { firstName: true, lastName: true } },
          },
          orderBy: { updatedAt: 'asc' },
          take: 15,
        }),
        operations.getPendingLeaveRequests(),
      ])

    const overdueInvoiceValue = overdueInvoices.reduce(
      (s, inv) => s + Number(inv.amountDue),
      0,
    )

    const briefing = {
      date: now.toISOString().slice(0, 10),
      executiveSummary: health.executiveSummary,
      priorityActions: health.priorityActions,
      risks: health.risks,
      kpis: {
        lowStockSkus: health.data.inventory.lowStockCount,
        pipelineTotal: health.data.pipeline.totalValue,
        weightedPipeline: health.data.pipeline.weightedValue,
        arOutstanding: health.data.outstandingAR.totalOutstanding,
        mtdNetIncome: health.data.profitAndLoss.netIncome,
      },
      overdueInvoices: {
        count: overdueInvoices.length,
        totalValue: Math.round(overdueInvoiceValue * 100) / 100,
        items: overdueInvoices.map((i) => ({
          invoiceNumber: i.invoiceNumber,
          amountDue: Number(i.amountDue),
          dueDate: i.dueDate.toISOString().slice(0, 10),
        })),
      },
      overdueFollowUps: {
        activityCount: overdueFollowUps.activityCount,
        contactCount: overdueFollowUps.contactFollowUpCount,
        topActivities: overdueFollowUps.activities.slice(0, 5),
      },
      upcomingDeliveries: upcomingDeliveries.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        confirmedAt: o.confirmedAt?.toISOString() ?? null,
        total: Number(o.total),
        contactName: o.contact
          ? `${o.contact.firstName} ${o.contact.lastName}`.trim()
          : null,
      })),
      pendingApprovals: {
        leaveRequests: pendingLeave.count,
        items: pendingLeave.requests.slice(0, 5),
      },
      formattedBriefing: [
        `# Daily briefing — ${health.companyName}`,
        `**${now.toLocaleDateString()}**`,
        '',
        health.executiveSummary,
        '',
        '## Priority actions',
        ...health.priorityActions.map((a, i) => `${i + 1}. ${a}`),
        '',
        '## Alerts',
        `- Overdue invoices: ${overdueInvoices.length} ($${overdueInvoiceValue.toLocaleString()})`,
        `- Overdue follow-ups: ${overdueFollowUps.activityCount} activities, ${overdueFollowUps.contactFollowUpCount} contacts`,
        `- Orders in fulfillment: ${upcomingDeliveries.length}`,
        `- Pending leave approvals: ${pendingLeave.count}`,
      ].join('\n'),
      health,
    }

    return briefing
  }

  async delegateToAgent(agentType: string, task: string): Promise<AgentResponse> {
    const type = agentType as AgentTypeKey
    this.involvedAgents.push(type)

    this.stepCallback?.({
      type: 'action',
      agentType: type,
      agentId: `${type}-agent`,
      content: `Delegating: ${task}`,
      timestamp: new Date().toISOString(),
    })

    const { getOrchestrator } = await import('./core/AgentOrchestrator')
    const orchestrator = getOrchestrator(this.tenantId)
    return orchestrator.delegateToAgent(type, task, 'executive-delegate', this.taskIdRef, this.permissions)
  }

  async synthesizeInsights(responses: AgentResponse[]): Promise<Record<string, unknown>> {
    return {
      synthesizedAt: new Date().toISOString(),
      insightCount: responses.length,
      insights: responses.map((r) => ({
        summary: r.answer.slice(0, 300),
        actions: r.actions.length,
        agent: r.attributions?.[0]?.agentType,
      })),
    }
  }

  protected extractOutput(actions: AgentAction[]): unknown {
    const briefing = actions.find(
      (a) => (a.tool === 'getDailyBriefing' || a.tool === 'getWeeklyDigest') && a.success,
    )
    if (briefing?.result) return briefing.result
    const summary = actions.find((a) => a.tool === 'getBusinessHealthSummary' && a.success)
    return summary?.result
  }

  async run(input: AgentTaskInput): Promise<AgentResponse<Record<string, unknown>>> {
    this.involvedAgents = []
    const response = await super.run(input)
    return {
      ...response,
      metadata: {
        ...response.metadata,
        involvedAgents: [...new Set(this.involvedAgents)],
      },
    }
  }
}

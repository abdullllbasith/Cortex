import { BaseAgent } from './core/BaseAgent'
import type { AgentTaskInput, AgentToolDefinition } from './core/types'
import { getTenantCustomerStats, getTenantProductStats } from './tools/tenantData'

export class SalesAgent extends BaseAgent<AgentTaskInput, Record<string, unknown>> {
  readonly systemPrompt = `You are an expert Sales Director AI agent.
Specialize in lead scoring, conversion analysis, customer segmentation, upsell opportunities, and churn prediction.
Prioritize actionable recommendations with specific customer names and revenue impact.`

  readonly tools: AgentToolDefinition[] = [
    { name: 'getLeads', description: 'Get current sales leads with scores' },
    { name: 'getConversions', description: 'Get conversion metrics' },
    { name: 'getCustomerSegments', description: 'Segment customers by value and behavior' },
    { name: 'getUpsellOpportunities', description: 'Find upsell and cross-sell opportunities' },
    { name: 'queryKnowledgeBase', description: 'Search sales knowledge' },
  ]

  constructor(tenantId: string, userId?: string, taskId?: string) {
    super(tenantId, 'sales', undefined, userId, taskId)
  }

  protected async executeTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'getLeads':
        return this.getLeads()
      case 'getConversions':
        return this.getConversions()
      case 'getCustomerSegments':
        return this.getCustomerSegments()
      case 'getUpsellOpportunities':
        return this.getUpsellOpportunities()
      case 'queryKnowledgeBase':
        return this.toolkit.queryKnowledgeBase(String(input.query ?? 'sales'), 'customer')
      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }

  protected heuristicThink(input: AgentTaskInput, iteration: number) {
    const lower = input.task.toLowerCase()
    if (/\bchurn/i.test(lower)) {
      return { reasoning: 'Churn analysis', plannedTool: 'getCustomerSegments', plannedInput: {}, iteration }
    }
    if (/\bupsell|cross-sell/i.test(lower)) {
      return { reasoning: 'Upsell opportunities', plannedTool: 'getUpsellOpportunities', plannedInput: {}, iteration }
    }
    if (/\blead/i.test(lower)) {
      return { reasoning: 'Lead scoring', plannedTool: 'getLeads', plannedInput: {}, iteration }
    }
    return { reasoning: 'Sales analysis', plannedTool: 'getConversions', plannedInput: {}, iteration }
  }

  async getLeads() {
    const customers = await getTenantCustomerStats(this.tenantId)
    return customers.slice(0, 10).map((c, i) => {
      const profile = c.profile as Record<string, unknown>
      const history = c.purchaseHistory as unknown[]
      return {
        id: c.id,
        name: profile.name ?? 'Unknown',
        company: profile.company ?? 'N/A',
        score: Math.max(20, 100 - i * 8 + (history?.length ?? 0) * 5),
        stage: i < 3 ? 'hot' : i < 6 ? 'warm' : 'cold',
        lastActivity: c.updatedAt,
      }
    })
  }

  async getConversions() {
    const customers = await getTenantCustomerStats(this.tenantId)
    const withPurchases = customers.filter((c) => (c.purchaseHistory as unknown[])?.length > 0)
    return {
      totalLeads: customers.length,
      converted: withPurchases.length,
      conversionRate: customers.length ? Math.round((withPurchases.length / customers.length) * 1000) / 10 : 0,
      avgDealSize: 12500,
      trend: 'up',
    }
  }

  async getCustomerSegments() {
    const customers = await getTenantCustomerStats(this.tenantId)
    return {
      segments: [
        {
          name: 'Enterprise',
          count: Math.ceil(customers.length * 0.2),
          avgValue: 85000,
          churnRisk: 'low',
        },
        {
          name: 'Mid-Market',
          count: Math.ceil(customers.length * 0.45),
          avgValue: 22000,
          churnRisk: 'medium',
        },
        {
          name: 'SMB',
          count: Math.floor(customers.length * 0.35),
          avgValue: 4500,
          churnRisk: 'high',
        },
      ],
      atRiskCustomers: customers.slice(0, 3).map((c) => ({
        id: c.id,
        name: (c.profile as Record<string, unknown>).name ?? 'Customer',
        churnScore: 0.72,
      })),
    }
  }

  async getUpsellOpportunities() {
    const [customers, products] = await Promise.all([
      getTenantCustomerStats(this.tenantId),
      getTenantProductStats(this.tenantId),
    ])

    return customers.slice(0, 5).map((c, i) => ({
      customerId: c.id,
      customerName: (c.profile as Record<string, unknown>).name ?? 'Customer',
      recommendedProduct: products.products[i % products.products.length]?.name ?? 'Premium Plan',
      estimatedValue: 5000 + i * 2000,
      confidence: 0.85 - i * 0.1,
    }))
  }
}

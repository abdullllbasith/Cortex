import { prisma } from '@/lib/db/prisma'
import { BaseAgent } from './core/BaseAgent'
import type { AgentTaskInput, AgentToolDefinition } from './core/types'

export class OperationsAgent extends BaseAgent<AgentTaskInput, Record<string, unknown>> {
  readonly systemPrompt = `You are an expert COO AI agent focused on operational excellence.
Analyze productivity, workflow status, department KPIs, and bottlenecks.
Provide clear recommendations to improve efficiency and remove blockers.`

  readonly tools: AgentToolDefinition[] = [
    { name: 'getEmployeeMetrics', description: 'Get workforce productivity metrics' },
    { name: 'getWorkflowStatus', description: 'Get active workflow statuses' },
    { name: 'getDepartmentKPIs', description: 'Get KPIs by department' },
    { name: 'getBottlenecks', description: 'Identify operational bottlenecks' },
    { name: 'queryKnowledgeBase', description: 'Search SOPs and operations docs' },
  ]

  constructor(tenantId: string, userId?: string, taskId?: string) {
    super(tenantId, 'operations', undefined, userId, taskId)
  }

  protected async executeTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'getEmployeeMetrics':
        return this.getEmployeeMetrics()
      case 'getWorkflowStatus':
        return this.getWorkflowStatus()
      case 'getDepartmentKPIs':
        return this.getDepartmentKPIs()
      case 'getBottlenecks':
        return this.getBottlenecks()
      case 'queryKnowledgeBase':
        return this.toolkit.queryKnowledgeBase(String(input.query ?? 'operations SOP'), 'knowledge')
      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }

  protected heuristicThink(input: AgentTaskInput, iteration: number) {
    const lower = input.task.toLowerCase()
    if (/bottleneck|blocker/i.test(lower)) {
      return { reasoning: 'Identifying bottlenecks', plannedTool: 'getBottlenecks', plannedInput: {}, iteration }
    }
    if (/workflow/i.test(lower)) {
      return { reasoning: 'Workflow status check', plannedTool: 'getWorkflowStatus', plannedInput: {}, iteration }
    }
    return { reasoning: 'Operations KPI review', plannedTool: 'getDepartmentKPIs', plannedInput: {}, iteration }
  }

  async getEmployeeMetrics() {
    const taskCount = await prisma.agentTask.count({ where: { tenantId: this.tenantId } })
    return {
      headcount: 48,
      utilization: 82,
      tasksCompleted: taskCount,
      avgTasksPerDay: Math.max(1, Math.round(taskCount / 30)),
      productivityTrend: 'stable',
    }
  }

  async getWorkflowStatus() {
    const pending = await prisma.agentTask.count({
      where: { tenantId: this.tenantId, status: { in: ['PENDING', 'PROCESSING'] } },
    })
    const completed = await prisma.agentTask.count({
      where: { tenantId: this.tenantId, status: 'COMPLETED' },
    })

    return {
      active: pending,
      completed,
      workflows: [
        { name: 'Order Fulfillment', status: 'on_track', completion: 94 },
        { name: 'Customer Onboarding', status: 'delayed', completion: 67 },
        { name: 'Inventory Sync', status: 'on_track', completion: 88 },
      ],
    }
  }

  async getDepartmentKPIs() {
    return {
      departments: [
        { name: 'Sales', kpi: 'Quota Attainment', value: 87, target: 100, unit: '%' },
        { name: 'Operations', kpi: 'Order Cycle Time', value: 2.4, target: 2.0, unit: 'days' },
        { name: 'Finance', kpi: 'DSO', value: 32, target: 30, unit: 'days' },
        { name: 'Support', kpi: 'CSAT', value: 4.6, target: 4.5, unit: '/5' },
      ],
    }
  }

  async getBottlenecks() {
    const lowStock = await prisma.product.count({
      where: { tenantId: this.tenantId, inventoryLevel: { lt: 10 } },
    })

    return {
      bottlenecks: [
        ...(lowStock > 0
          ? [{ area: 'Inventory', issue: `${lowStock} products critically low`, severity: 'high' }]
          : []),
        { area: 'Customer Onboarding', issue: 'Manual approval step causing 3-day delay', severity: 'medium' },
        { area: 'Reporting', issue: 'Data sync lag between systems', severity: 'low' },
      ],
      recommendations: [
        'Automate inventory reorder triggers',
        'Streamline onboarding approval workflow',
      ],
    }
  }
}

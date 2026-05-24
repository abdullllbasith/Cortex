import { BaseAgent } from './core/BaseAgent'
import type {
  AgentAction,
  AgentResponse,
  AgentTaskInput,
  AgentTaskStep,
  AgentToolDefinition,
  AgentTypeKey,
} from './core/types'

export class ExecutiveAgent extends BaseAgent<AgentTaskInput, Record<string, unknown>> {
  readonly systemPrompt = `You are an expert CEO and strategic advisor AI agent.
Coordinate specialized agents (Finance, Sales, Inventory, Operations) to answer complex business questions.
Synthesize insights into board-level recommendations with clear priorities and risk assessment.`

  readonly tools: AgentToolDefinition[] = [
    { name: 'delegateToAgent', description: 'Delegate sub-task to specialized agent', parameters: { agentType: 'string', task: 'string' } },
    { name: 'synthesizeInsights', description: 'Synthesize multiple agent responses' },
    { name: 'generateReport', description: 'Generate executive report', parameters: { topic: 'string' } },
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
      case 'delegateToAgent':
        return this.delegateToAgent(String(input.agentType ?? 'finance'), String(input.task ?? ''))
      case 'synthesizeInsights':
        return this.synthesizeInsights((input.responses as AgentResponse[]) ?? [])
      case 'generateReport':
        return this.generateReport(String(input.topic ?? 'executive summary'))
      case 'queryKnowledgeBase':
        return this.toolkit.queryKnowledgeBase(String(input.query ?? 'strategy'), 'all')
      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }

  protected heuristicThink(input: AgentTaskInput, iteration: number) {
    if (iteration === 1) {
      return {
        reasoning: 'Complex query — delegating to specialized agents in parallel',
        plannedTool: 'generateReport',
        plannedInput: { topic: input.task },
        iteration,
      }
    }
    return super.heuristicThink(input, iteration)
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
    const insights = responses.map((r) => ({
      summary: r.answer.slice(0, 300),
      actions: r.actions.length,
      agent: r.attributions?.[0]?.agentType,
    }))

    return {
      synthesizedAt: new Date().toISOString(),
      insightCount: insights.length,
      insights,
      keyThemes: ['Revenue growth opportunities', 'Operational efficiency gaps', 'Inventory optimization'],
      recommendations: [
        'Prioritize high-value customer retention',
        'Automate low-stock reorder workflows',
        'Review March expense anomalies with Finance',
      ],
    }
  }

  async generateReport(topic: string): Promise<Record<string, unknown>> {
    const { getOrchestrator } = await import('./core/AgentOrchestrator')
    const orchestrator = getOrchestrator(this.tenantId)
    const subTasks: Array<{ type: AgentTypeKey; task: string }> = [
      { type: 'finance', task: `Financial summary for: ${topic}` },
      { type: 'sales', task: `Sales performance for: ${topic}` },
      { type: 'inventory', task: `Inventory status for: ${topic}` },
      { type: 'operations', task: `Operations KPIs for: ${topic}` },
    ]

    const responses = await Promise.all(
      subTasks.map(async ({ type, task }) => {
        this.involvedAgents.push(type)
        this.stepCallback?.({
          type: 'thought',
          agentType: type,
          agentId: `${type}-agent`,
          content: `Parallel execution: ${task}`,
          timestamp: new Date().toISOString(),
        })
        return orchestrator.delegateToAgent(type, task, 'executive', this.taskIdRef, this.permissions)
      }),
    )

    const synthesis = await this.synthesizeInsights(responses)

    return {
      topic,
      generatedAt: new Date().toISOString(),
      sections: responses.map((r, i) => ({
        agent: subTasks[i].type,
        summary: r.answer.slice(0, 500),
        data: r.output,
      })),
      synthesis,
      involvedAgents: [...new Set(this.involvedAgents)],
    }
  }

  protected extractOutput(actions: AgentAction[]): unknown {
    const reportAction = actions.find((a) => a.tool === 'generateReport' && a.success)
    return reportAction?.result
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

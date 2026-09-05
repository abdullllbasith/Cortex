import { prisma } from '@/lib/db/prisma'
import { FinanceAgent } from '../FinanceAgent'
import { SalesAgent } from '../SalesAgent'
import { InventoryAgent } from '../InventoryAgent'
import { OperationsAgent } from '../OperationsAgent'
import { ExecutiveAgent } from '../ExecutiveAgent'
import type {
  AgentResponse,
  AgentTaskInput,
  AgentTaskStep,
  AgentTypeKey,
  OrchestratorResult,
} from './types'
import { BaseAgent } from './BaseAgent'

type AgentInstance = BaseAgent<AgentTaskInput, unknown>

const agentRegistry = new Map<string, Map<AgentTypeKey, AgentInstance>>()

function registryKey(tenantId: string): string {
  return tenantId
}

export class AgentOrchestrator {
  constructor(private readonly tenantId: string) {}

  private getTenantRegistry(): Map<AgentTypeKey, AgentInstance> {
    const key = registryKey(this.tenantId)
    if (!agentRegistry.has(key)) {
      agentRegistry.set(key, new Map())
    }
    return agentRegistry.get(key)!
  }

  createAgent(type: AgentTypeKey, userId?: string, taskId?: string): AgentInstance {
    const agents: Record<AgentTypeKey, () => AgentInstance> = {
      finance: () => new FinanceAgent(this.tenantId, userId, taskId),
      sales: () => new SalesAgent(this.tenantId, userId, taskId),
      inventory: () => new InventoryAgent(this.tenantId, userId, taskId),
      operations: () => new OperationsAgent(this.tenantId, userId, taskId),
      executive: () => new ExecutiveAgent(this.tenantId, userId, taskId),
    }
    return agents[type]()
  }

  registerAgent(type: AgentTypeKey, userId?: string, taskId?: string): AgentInstance {
    const agent = this.createAgent(type, userId, taskId)
    this.getTenantRegistry().set(type, agent)
    return agent
  }

  getAgent(type: AgentTypeKey, userId?: string, taskId?: string): AgentInstance {
    // Fresh instance per run — avoids stale taskId and shared mutable state across requests.
    return this.createAgent(type, userId, taskId)
  }

  resolveAgentType(task: string, preferred?: AgentTypeKey): AgentTypeKey {
    if (preferred) return preferred

    const lower = task.toLowerCase()
    if (/\b(revenue|expense|profit|cashflow|financial|budget|margin|cfo)\b/.test(lower)) return 'finance'
    if (/\b(sales|lead|conversion|churn|customer segment|upsell|pipeline)\b/.test(lower)) return 'sales'
    if (/\b(inventory|stock|reorder|supplier|supply chain|warehouse)\b/.test(lower)) return 'inventory'
    if (/\b(operations|workflow|productivity|bottleneck|department|kpi|employee)\b/.test(lower)) return 'operations'
    if (/\b(strategic|board|executive|report|synthesize|overview|all agents)\b/.test(lower)) return 'executive'
    return 'executive'
  }

  isComplexTask(task: string, preferred?: AgentTypeKey): boolean {
    if (preferred === 'executive') return true
    const lower = task.toLowerCase()
    return (
      /\b(report|forecast|analyze all|comprehensive|board|strategic|compare across)\b/.test(lower) ||
      (lower.match(/\band\b/g)?.length ?? 0) >= 2
    )
  }

  async executeTask(
    input: AgentTaskInput,
    preferredAgent?: AgentTypeKey,
    onStep?: (step: AgentTaskStep) => void,
  ): Promise<OrchestratorResult> {
    const agentType = this.resolveAgentType(input.task, preferredAgent)
    const involvedAgents: AgentTypeKey[] = []

    if (agentType === 'executive' || this.isComplexTask(input.task, preferredAgent)) {
      const executive = this.getAgent('executive', input.userId, input.taskId) as ExecutiveAgent
      executive.setPermissions(input.permissions ?? ['*'])
      if (onStep) executive.setStepCallback(onStep)

      const response = await executive.run({
        ...input,
        context: { ...input.context, orchestrator: true },
      })

      involvedAgents.push('executive', ...(response.metadata?.involvedAgents as AgentTypeKey[] ?? []))

      return {
        taskId: input.taskId ?? `task-${Date.now()}`,
        response,
        primaryAgent: 'executive',
        involvedAgents: [...new Set(involvedAgents)],
      }
    }

    const agent = this.getAgent(agentType, input.userId, input.taskId)
    agent.setPermissions(input.permissions ?? ['*'])
    involvedAgents.push(agentType)

    const thoughtCallback = onStep
    const originalRun = agent.run.bind(agent)
    const wrappedAgent = agent

    if (thoughtCallback) {
      const response = await this.runWithSteps(wrappedAgent, input, agentType, thoughtCallback)
      return {
        taskId: input.taskId ?? `task-${Date.now()}`,
        response,
        primaryAgent: agentType,
        involvedAgents,
      }
    }

    const response = await originalRun(input)
    return {
      taskId: input.taskId ?? `task-${Date.now()}`,
      response,
      primaryAgent: agentType,
      involvedAgents,
    }
  }

  private async runWithSteps(
    agent: AgentInstance,
    input: AgentTaskInput,
    agentType: AgentTypeKey,
    onStep: (step: AgentTaskStep) => void,
  ): Promise<AgentResponse> {
    onStep({
      type: 'thought',
      agentType,
      agentId: agent.agentId,
      content: `Starting ${agentType} agent for task`,
      timestamp: new Date().toISOString(),
    })

    const response = await agent.run(input)

    for (const thought of response.thoughts) {
      onStep({
        type: 'thought',
        agentType,
        agentId: agent.agentId,
        content: thought.reasoning,
        data: { plannedTool: thought.plannedTool },
        timestamp: new Date().toISOString(),
      })
    }

    for (const action of response.actions) {
      onStep({
        type: 'action',
        agentType,
        agentId: agent.agentId,
        content: `${action.tool}: ${action.success ? 'success' : action.error}`,
        data: { input: action.input, result: action.result },
        timestamp: new Date().toISOString(),
      })
    }

    onStep({
      type: 'response',
      agentType,
      agentId: agent.agentId,
      content: response.answer,
      timestamp: new Date().toISOString(),
    })

    return response
  }

  async delegateToAgent(
    targetType: AgentTypeKey,
    task: string,
    userId: string,
    taskId?: string,
    permissions?: string[],
  ): Promise<AgentResponse> {
    const agent = this.getAgent(targetType, userId, taskId)
    agent.setPermissions(permissions ?? ['*'])
    return agent.run({ task, userId, taskId, permissions })
  }

  static clearRegistry(tenantId?: string): void {
    if (tenantId) agentRegistry.delete(registryKey(tenantId))
    else agentRegistry.clear()
  }
}

export const orchestratorCache = new Map<string, AgentOrchestrator>()

export function getOrchestrator(tenantId: string): AgentOrchestrator {
  if (!orchestratorCache.has(tenantId)) {
    orchestratorCache.set(tenantId, new AgentOrchestrator(tenantId))
  }
  return orchestratorCache.get(tenantId)!
}

export async function appendTaskStep(taskId: string, step: AgentTaskStep): Promise<void> {
  const task = await prisma.agentTask.findUnique({ where: { id: taskId } })
  if (!task) return

  const steps = (task.steps as unknown as AgentTaskStep[]) ?? []
  steps.push(step)

  await prisma.agentTask.update({
    where: { id: taskId },
    data: { steps: steps as never },
  })
}

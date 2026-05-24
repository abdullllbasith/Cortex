import { completeWithClaude, isAssistantLlmAvailable } from '@/lib/assistant/claudeClient'
import { AgentToolkit, createToolkit } from './AgentToolkit'
import { AgentMemoryStore } from './AgentMemory'
import type {
  AgentAction,
  AgentResponse,
  AgentTaskInput,
  AgentThought,
  AgentToolDefinition,
  AgentTypeKey,
} from './types'

const MAX_REACT_ITERATIONS = 5

export abstract class BaseAgent<TInput = AgentTaskInput, TOutput = unknown> {
  abstract readonly systemPrompt: string
  abstract readonly tools: AgentToolDefinition[]

  readonly agentType: AgentTypeKey
  readonly agentId: string
  protected toolkit: AgentToolkit
  protected memory: AgentMemoryStore
  protected permissions: string[] = ['*']

  constructor(
    protected readonly tenantId: string,
    agentType: AgentTypeKey,
    agentId?: string,
    userId?: string,
    taskId?: string,
  ) {
    this.agentType = agentType
    this.agentId = agentId ?? `${agentType}-agent-${tenantId.slice(0, 8)}`
    this.toolkit = createToolkit(tenantId, this.agentId, agentType, userId, taskId)
    this.memory = new AgentMemoryStore(tenantId, agentType)
  }

  validatePermissions(required: string[]): boolean {
    if (this.permissions.includes('*')) return true
    return required.every((p) => this.permissions.includes(p))
  }

  setPermissions(permissions: string[]): void {
    this.permissions = permissions
  }

  protected abstract executeTool(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown>

  async think(
    input: TInput,
    iteration: number,
    priorThoughts: AgentThought[],
    priorActions: AgentAction[],
  ): Promise<AgentThought> {
    const context = this.buildReActContext(input, iteration, priorThoughts, priorActions)

    if (isAssistantLlmAvailable()) {
      const reasoning = await completeWithClaude({
        systemPrompt: `${this.systemPrompt}\n\nAvailable tools: ${this.tools.map((t) => t.name).join(', ')}\nRespond with JSON: {"reasoning":"...","plannedTool":"toolName or null","plannedInput":{}}`,
        messages: [{ role: 'user', content: context }],
        maxTokens: 1024,
        temperature: 0.2,
      })

      try {
        const parsed = JSON.parse(reasoning.replace(/```json\n?|\n?```/g, '').trim()) as {
          reasoning: string
          plannedTool?: string
          plannedInput?: Record<string, unknown>
        }
        return {
          reasoning: parsed.reasoning,
          plannedTool: parsed.plannedTool ?? undefined,
          plannedInput: parsed.plannedInput,
          iteration,
        }
      } catch {
        return { reasoning, iteration }
      }
    }

    return this.heuristicThink(input, iteration)
  }

  protected heuristicThink(input: TInput, iteration: number): AgentThought {
    const taskInput = input as AgentTaskInput
    const defaultTool = this.tools[0]?.name
    return {
      reasoning: `Analyzing task: "${taskInput.task}" (iteration ${iteration})`,
      plannedTool: iteration === 1 ? defaultTool : undefined,
      plannedInput: {},
      iteration,
    }
  }

  async act(thought: AgentThought): Promise<AgentAction> {
    if (!thought.plannedTool) {
      return { tool: 'none', input: {}, success: true, result: 'No action required' }
    }

    const start = Date.now()
    try {
      const result = await this.executeTool(thought.plannedTool, thought.plannedInput ?? {})
      const action: AgentAction = {
        tool: thought.plannedTool,
        input: thought.plannedInput ?? {},
        result,
        success: true,
        durationMs: Date.now() - start,
      }
      await this.toolkit.logAction(thought.plannedTool, thought.plannedInput ?? {}, result)
      return action
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Tool execution failed'
      const action: AgentAction = {
        tool: thought.plannedTool,
        input: thought.plannedInput ?? {},
        error,
        success: false,
        durationMs: Date.now() - start,
      }
      await this.toolkit.logAction(thought.plannedTool, thought.plannedInput ?? {}, { error }, 'FAILURE')
      return action
    }
  }

  async respond(
    input: TInput,
    thoughts: AgentThought[],
    actions: AgentAction[],
  ): Promise<AgentResponse<TOutput>> {
    const summary = this.synthesizeResults(input, thoughts, actions)

    if (isAssistantLlmAvailable()) {
      const taskInput = input as AgentTaskInput
      const answer = await completeWithClaude({
        systemPrompt: this.systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Task: ${taskInput.task}\n\nAnalysis:\n${summary}\n\nProvide a clear, actionable response.`,
          },
        ],
        maxTokens: 2048,
      })

      return {
        answer,
        thoughts,
        actions,
        output: this.extractOutput(actions) as TOutput,
        attributions: [{ agentType: this.agentType, agentId: this.agentId, summary: answer.slice(0, 200) }],
      }
    }

    return {
      answer: summary,
      thoughts,
      actions,
      output: this.extractOutput(actions) as TOutput,
      attributions: [{ agentType: this.agentType, agentId: this.agentId, summary: summary.slice(0, 200) }],
    }
  }

  protected extractOutput(actions: AgentAction[]): unknown {
    const lastSuccess = [...actions].reverse().find((a) => a.success && a.result)
    return lastSuccess?.result
  }

  protected synthesizeResults(
    input: TInput,
    thoughts: AgentThought[],
    actions: AgentAction[],
  ): string {
    const taskInput = input as AgentTaskInput
    const actionSummaries = actions
      .map((a) => `${a.tool}: ${a.success ? JSON.stringify(a.result).slice(0, 300) : a.error}`)
      .join('\n')

    return `Task: ${taskInput.task}\nReasoning steps: ${thoughts.length}\nActions:\n${actionSummaries}`
  }

  protected buildReActContext(
    input: TInput,
    iteration: number,
    thoughts: AgentThought[],
    actions: AgentAction[],
  ): string {
    const taskInput = input as AgentTaskInput
    const history = thoughts
      .map((t, i) => {
        const action = actions[i]
        return `Iteration ${t.iteration}:\nThought: ${t.reasoning}\nAction: ${action?.tool ?? 'none'}\nObservation: ${action?.success ? JSON.stringify(action.result).slice(0, 500) : action?.error ?? 'N/A'}`
      })
      .join('\n\n')

    return `Task: ${taskInput.task}\nIteration: ${iteration}/${MAX_REACT_ITERATIONS}\n\nHistory:\n${history || 'None yet'}`
  }

  shouldContinue(thought: AgentThought, actions: AgentAction[], iteration: number): boolean {
    if (iteration >= MAX_REACT_ITERATIONS) return false
    if (!thought.plannedTool) return false
    const lastAction = actions[actions.length - 1]
    if (lastAction && !lastAction.success && iteration >= 2) return false
    return true
  }

  async run(input: TInput): Promise<AgentResponse<TOutput>> {
    if (!this.validatePermissions(this.requiredPermissions())) {
      throw new Error('Insufficient permissions for this agent')
    }

    const thoughts: AgentThought[] = []
    const actions: AgentAction[] = []

    for (let i = 1; i <= MAX_REACT_ITERATIONS; i++) {
      const thought = await this.think(input, i, thoughts, actions)
      thoughts.push(thought)

      if (!thought.plannedTool) break

      const action = await this.act(thought)
      actions.push(action)

      thought.observation = action.success
        ? JSON.stringify(action.result).slice(0, 500)
        : action.error

      if (!this.shouldContinue(thought, actions, i)) break
    }

    return this.respond(input, thoughts, actions)
  }

  protected requiredPermissions(): string[] {
    return [`agent:${this.agentType}`]
  }
}

export { MAX_REACT_ITERATIONS }

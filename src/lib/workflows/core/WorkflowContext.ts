import type { WorkflowEngineContext } from '../types'

const VAR_PATTERN = /\{\{([^}]+)\}\}/g

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.trim().split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.trim().split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]!
    if (!(p in cur) || typeof cur[p] !== 'object' || cur[p] === null) {
      cur[p] = {}
    }
    cur = cur[p] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]!] = value
}

export class WorkflowContext {
  readonly tenantId: string
  readonly workflowDefinitionId: string
  readonly executionId: string
  readonly triggeredBy: string
  variables: Record<string, unknown>
  logs: string[]

  constructor(params: WorkflowEngineContext) {
    this.tenantId = params.tenantId
    this.workflowDefinitionId = params.workflowDefinitionId
    this.executionId = params.executionId
    this.triggeredBy = params.triggeredBy
    this.variables = params.variables
    this.logs = params.logs
  }

  getVariable(path: string): unknown {
    return getByPath(this.variables, path)
  }

  setVariable(path: string, value: unknown): void {
    setByPath(this.variables, path, value)
  }

  appendLog(message: string): void {
    const entry = `[${new Date().toISOString()}] ${message}`
    this.logs.push(entry)
  }

  interpolate(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.replace(VAR_PATTERN, (_, path: string) => {
        const resolved = getByPath(this.variables, path)
        if (resolved === undefined || resolved === null) return ''
        return typeof resolved === 'object' ? JSON.stringify(resolved) : String(resolved)
      })
    }
    if (Array.isArray(value)) return value.map((v) => this.interpolate(v))
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value)) {
        out[k] = this.interpolate(v)
      }
      return out
    }
    return value
  }

  toEngineContext(): WorkflowEngineContext {
    return {
      tenantId: this.tenantId,
      workflowDefinitionId: this.workflowDefinitionId,
      executionId: this.executionId,
      triggeredBy: this.triggeredBy,
      variables: this.variables,
      logs: this.logs,
    }
  }
}

export { getByPath, setByPath }

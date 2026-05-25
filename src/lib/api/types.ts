/* ─────────────────────────────────────────────────────────────────────────────
   Shared API types
   ───────────────────────────────────────────────────────────────────────────── */

export interface ApiErrorDetails {
  [key: string]: unknown
}

/** Coerce API / thrown values into a human-readable error string */
export function formatApiErrorMessage(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value
  if (value instanceof Error) return value.message || 'Request failed'
  if (Array.isArray(value)) {
    const parts = value.map(formatApiErrorMessage).filter((part) => part && part !== 'Request failed')
    if (parts.length) return parts.join('; ')
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (obj.message !== undefined && obj.message !== value) {
      return formatApiErrorMessage(obj.message)
    }
    if (Array.isArray(obj.issues)) {
      const issueMessages = obj.issues
        .map((issue) =>
          issue && typeof issue === 'object' && 'message' in issue
            ? String((issue as { message: unknown }).message)
            : '',
        )
        .filter(Boolean)
      if (issueMessages.length) return issueMessages.join('; ')
    }
    try {
      const json = JSON.stringify(value)
      if (json && json !== '{}') return json
    } catch {
      /* non-serializable */
    }
  }
  if (value == null) return 'Request failed'
  const text = String(value)
  return text === '[object Object]' ? 'Request failed' : text
}

export class ApiError extends Error {
  readonly code: string
  readonly statusCode: number
  readonly details?: ApiErrorDetails

  constructor(
    message: unknown,
    statusCode: number,
    code = 'API_ERROR',
    details?: ApiErrorDetails,
  ) {
    super(formatApiErrorMessage(message))
    this.name = 'ApiError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface ListParams {
  page?: number
  limit?: number
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
  [key: string]: unknown
}

export interface Customer {
  id: string
  name: string
  email: string
  status: string
  createdAt: string
}

export interface Product {
  id: string
  name: string
  sku: string
  price: number
  stock: number
  status: string
}

export interface Supplier {
  id: string
  name: string
  email: string
  status: string
  leadTimeDays: number
}

export interface Agent {
  id: string
  type: string
  name: string
  status: 'active' | 'idle' | 'error'
  lastRunAt?: string
}

export interface AgentLog {
  id: string
  agentType: string
  action: string
  status: string
  createdAt: string
}

export interface Workflow {
  id: string
  name: string
  status: 'active' | 'draft' | 'paused'
  updatedAt: string
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  status: 'success' | 'running' | 'failed'
  startedAt: string
  duration?: string
}

export interface Alert {
  id: string
  title: string
  severity: 'danger' | 'warning' | 'info'
  read: boolean
  createdAt: string
}

export interface User {
  id: string
  name: string
  email: string
  role: string
  avatarUrl?: string
}

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
}

export interface TeamMember extends User {
  invitedAt?: string
  lastActiveAt?: string
}

export interface AnalyticsResult {
  type: string
  period: string
  metrics: Record<string, number>
  series?: Array<{ date: string; value: number }>
}

export interface PredictionResult {
  type: string
  predictions: Array<{
    id: string
    event: string
    confidence: number
    daysOut: number
    severity: string
  }>
}

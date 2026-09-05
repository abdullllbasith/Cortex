import { InvoiceStatus, PurchaseOrderStatus, SalesOrderStatus } from '@prisma/client'
import { semanticSearchWithVector, type SemanticSearchResult } from '@/lib/embeddings/semanticSearch'
import { generateEmbedding } from '@/lib/embeddings/embeddingService'
import { toVectorLiteral } from '@/lib/embeddings/types'
import type { KnowledgeEntityType } from '@/lib/embeddings/knowledgeIndexer'
import { prisma } from '@/lib/db/prisma'
import { SalesAgent } from '@/lib/agents/SalesAgent'
import { FinanceAgent } from '@/lib/agents/FinanceAgent'
import { OperationsAgent } from '@/lib/agents/OperationsAgent'
import { GL_ACCOUNTS, resolveAccount } from '@/lib/finance/accountResolver'
import { getAccountBalance } from '@/lib/finance/journalEngine'
import { getLowStockSummaryForDashboard } from '@/lib/inventory/reorderService'

export type ErpModule = 'inventory' | 'crm' | 'sales' | 'finance' | 'hr'

const MODULE_KEYWORDS: Array<{ modules: ErpModule[]; pattern: RegExp }> = [
  {
    modules: ['inventory'],
    pattern: /\b(stock|inventory|product|warehouse|reorder)\b/i,
  },
  {
    modules: ['crm'],
    pattern: /\b(customer|client|lead|deal|pipeline|contact)\b/i,
  },
  {
    modules: ['sales', 'inventory'],
    pattern: /\b(order|quote|sale|deliver|ship)\b/i,
  },
  {
    modules: ['finance'],
    pattern: /\b(invoice|payment|overdue|profit|expense|cash|revenue|ar|p\s*&\s*l|pnl)\b/i,
  },
  {
    modules: ['hr'],
    pattern: /\b(employee|leave|payroll|salary|attendance)\b/i,
  },
  {
    modules: ['inventory', 'finance'],
    pattern: /\b(supplier|purchase|po|vendor)\b/i,
  },
]

/** Detect which ERP modules are relevant to the user message. */
export function detectModuleContext(message: string): ErpModule[] {
  const found = new Set<ErpModule>()
  for (const { modules, pattern } of MODULE_KEYWORDS) {
    if (pattern.test(message)) {
      for (const m of modules) found.add(m)
    }
  }
  return found.size ? [...found] : []
}

/** @deprecated Use detectModuleContext */
export function detectErpModules(message: string): ErpModule[] {
  return detectModuleContext(message)
}

export function semanticEntityTypeForModules(modules: ErpModule[]): KnowledgeEntityType | 'all' {
  if (modules.includes('inventory')) return 'product'
  if (modules.includes('crm') || modules.includes('sales')) return 'customer'
  if (modules.includes('finance')) return 'knowledge'
  if (modules.includes('hr')) return 'knowledge'
  return 'all'
}

export async function searchErpKnowledge(
  tenantId: string,
  query: string,
  modules: ErpModule[],
  topK = 5,
): Promise<SemanticSearchResult[]> {
  if (!query.trim()) return []

  try {
    const entityType = semanticEntityTypeForModules(modules)
    const embedding = await generateEmbedding(query)
    const vectorLiteral = toVectorLiteral(embedding)

    if (entityType === 'all') {
      return semanticSearchWithVector(tenantId, vectorLiteral, 'all', topK)
    }

    const [primary, secondary] = await Promise.all([
      semanticSearchWithVector(tenantId, vectorLiteral, entityType, topK),
      semanticSearchWithVector(tenantId, vectorLiteral, 'knowledge', Math.min(4, topK)),
    ])

    const seen = new Set(primary.map((r) => `${r.entityType}:${r.id}`))
    const merged = [...primary]
    for (const row of secondary) {
      const key = `${row.entityType}:${row.id}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(row)
      }
    }
    return merged.sort((a, b) => b.similarity - a.similarity).slice(0, topK)
  } catch (err) {
    // Chat LLMs (OpenRouter) are separate from OpenAI embeddings used for RAG.
    // Don't fail the whole assistant if embedding credits/quota are exhausted.
    console.warn(
      '[erpContext] Semantic search skipped (embeddings unavailable):',
      err instanceof Error ? err.message : err,
    )
    return []
  }
}

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

const ERP_CONTEXT_CACHE_MS = 45_000
const erpContextCache = new Map<
  string,
  { at: number; data: { structured: ERPContextBlock; formatted: string } }
>()

export interface ERPContextBlock {
  inventory?: { lowStockCount: number; totalValue: number; pendingPOs: number }
  crm?: { openDeals: number; overdueFollowUps: number; pipelineValue: number }
  sales?: { pendingOrders: number; deliveredToday: number }
  finance?: {
    revenueMtd: number
    paymentCountMtd: number
    outstandingAR: number
    overdueInvoices: number
    cashBalance: number
    asOf?: string
  }
  hr?: { onLeaveToday: number; pendingApprovals: number }
}

export async function buildERPContext(
  tenantId: string,
  modules: ErpModule[],
): Promise<{ structured: ERPContextBlock; formatted: string }> {
  if (modules.length === 0) {
    return {
      structured: {},
      formatted: 'No module-specific live data loaded for this query.',
    }
  }

  const cacheKey = `${tenantId}:${[...modules].sort().join(',')}`
  const cached = erpContextCache.get(cacheKey)
  if (cached && Date.now() - cached.at < ERP_CONTEXT_CACHE_MS) {
    return cached.data
  }

  const structured: ERPContextBlock = {}
  const lines: string[] = []

  const tasks: Promise<void>[] = []

  if (modules.includes('inventory')) {
    tasks.push(
      (async () => {
        const [lowStock, pendingPOs] = await Promise.all([
          getLowStockSummaryForDashboard(tenantId, 1),
          prisma.purchaseOrder.count({
            where: {
              tenantId,
              status: {
                in: [
                  PurchaseOrderStatus.DRAFT,
                  PurchaseOrderStatus.SENT,
                  PurchaseOrderStatus.PARTIAL,
                ],
              },
            },
          }),
        ])
        structured.inventory = {
          lowStockCount: lowStock.count,
          totalValue: 0,
          pendingPOs,
        }
        lines.push(
          `INVENTORY: ${lowStock.count} SKU(s) below reorder point; ${pendingPOs} open purchase order(s).`,
        )
      })(),
    )
  }

  if (modules.includes('crm')) {
    tasks.push(
      (async () => {
        const sales = new SalesAgent(tenantId)
        const [pipeline, overdue, openDeals] = await Promise.all([
          sales.getPipelineValue(),
          sales.getOverdueFollowUps(),
          prisma.crmDeal.count({ where: { tenantId, status: 'OPEN' } }),
        ])
        structured.crm = {
          openDeals,
          overdueFollowUps: overdue.activityCount + overdue.contactFollowUpCount,
          pipelineValue: pipeline.totalValue,
        }
        lines.push(
          `CRM: ${openDeals} open deals; pipeline $${pipeline.totalValue.toLocaleString()} (weighted $${Math.round(pipeline.weightedValue).toLocaleString()}); ${structured.crm.overdueFollowUps} overdue follow-up(s).`,
        )
      })(),
    )
  }

  if (modules.includes('sales')) {
    tasks.push(
      (async () => {
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)
        const [pendingOrders, deliveredToday] = await Promise.all([
          prisma.salesOrder.count({
            where: {
              tenantId,
              status: {
                notIn: [SalesOrderStatus.DELIVERED, SalesOrderStatus.CANCELLED],
              },
            },
          }),
          prisma.salesOrder.count({
            where: {
              tenantId,
              status: SalesOrderStatus.DELIVERED,
              deliveredAt: { gte: startOfDay },
            },
          }),
        ])
        structured.sales = { pendingOrders, deliveredToday }
        lines.push(
          `SALES: ${pendingOrders} order(s) not yet delivered; ${deliveredToday} delivered today.`,
        )
      })(),
    )
  }

  if (modules.includes('finance')) {
    tasks.push(
      (async () => {
        const finance = new FinanceAgent(tenantId)
        const now = new Date()
        const [ar, overdueCount, revenueMtd] = await Promise.all([
          finance.getOutstandingAR(),
          prisma.invoice.count({
            where: {
              tenantId,
              status: InvoiceStatus.OVERDUE,
              amountDue: { gt: 0 },
            },
          }),
          finance.getRevenue('month'),
        ])
        let cashBalance = 0
        try {
          const bankAccount = await resolveAccount(tenantId, GL_ACCOUNTS.BANK.subtype, [
            ...GL_ACCOUNTS.BANK.codes,
          ])
          if (bankAccount) {
            cashBalance = await getAccountBalance(bankAccount.id, tenantId)
          }
        } catch {
          cashBalance = 0
        }
        structured.finance = {
          revenueMtd: revenueMtd.totalRevenue,
          paymentCountMtd: revenueMtd.paymentCount,
          outstandingAR: ar.totalOutstanding,
          overdueInvoices: overdueCount,
          cashBalance: Math.round(cashBalance * 100) / 100,
          asOf: now.toISOString(),
        }
        lines.push(
          `FINANCE: Month-to-date collected revenue $${revenueMtd.totalRevenue.toLocaleString()} (${revenueMtd.paymentCount} payment(s)); AR outstanding $${ar.totalOutstanding.toLocaleString()}; ${overdueCount} overdue invoice(s); cash balance $${cashBalance.toLocaleString()}.`,
        )
      })(),
    )
  }

  if (modules.includes('hr')) {
    tasks.push(
      (async () => {
        const ops = new OperationsAgent(tenantId)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const [pendingLeave, onLeaveToday] = await Promise.all([
          ops.getPendingLeaveRequests(),
          prisma.leaveRequest.count({
            where: {
              tenantId,
              status: 'APPROVED',
              startDate: { lte: tomorrow },
              endDate: { gte: today },
            },
          }),
        ])
        structured.hr = {
          onLeaveToday,
          pendingApprovals: pendingLeave.count,
        }
        lines.push(
          `HR: ${onLeaveToday} on leave today; ${pendingLeave.count} leave approval(s) pending.`,
        )
      })(),
    )
  }

  await Promise.all(tasks)

  const result = {
    structured,
    formatted: lines.length ? lines.join('\n') : 'No module-specific live data loaded for this query.',
  }
  erpContextCache.set(cacheKey, { at: Date.now(), data: result })
  return result
}

/** Format live ERP context for the system prompt. */
export async function fetchErpLiveContext(tenantId: string, modules: ErpModule[]): Promise<string> {
  const { structured, formatted } = await buildERPContext(tenantId, modules)
  return `${formatted}\n\nStructured snapshot:\n${JSON.stringify(structured, null, 2)}`
}

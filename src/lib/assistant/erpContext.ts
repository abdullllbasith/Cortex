import { InvoiceStatus, PurchaseOrderStatus, SalesOrderStatus } from '@prisma/client'
import { semanticSearch, type SemanticSearchResult } from '@/lib/embeddings/semanticSearch'
import type { KnowledgeEntityType } from '@/lib/embeddings/knowledgeIndexer'
import { prisma } from '@/lib/db/prisma'
import { InventoryAgent } from '@/lib/agents/InventoryAgent'
import { SalesAgent } from '@/lib/agents/SalesAgent'
import { FinanceAgent } from '@/lib/agents/FinanceAgent'
import { OperationsAgent } from '@/lib/agents/OperationsAgent'
import { GL_ACCOUNTS, resolveAccount } from '@/lib/finance/accountResolver'
import { getAccountBalance } from '@/lib/finance/journalEngine'

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
    pattern: /\b(invoice|payment|overdue|profit|expense|cash)\b/i,
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
  return found.size ? [...found] : ['crm', 'sales']
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
  topK = 8,
): Promise<SemanticSearchResult[]> {
  const entityType = semanticEntityTypeForModules(modules)
  const primary = await semanticSearch({ tenantId, query, entityType, topK })

  if (entityType === 'all') return primary

  const secondary = await semanticSearch({ tenantId, query, entityType: 'knowledge', topK: 4 })
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
}

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

export interface ERPContextBlock {
  inventory?: { lowStockCount: number; totalValue: number; pendingPOs: number }
  crm?: { openDeals: number; overdueFollowUps: number; pipelineValue: number }
  sales?: { pendingOrders: number; deliveredToday: number }
  finance?: { outstandingAR: number; overdueInvoices: number; cashBalance: number }
  hr?: { onLeaveToday: number; pendingApprovals: number }
}

export async function buildERPContext(
  tenantId: string,
  modules: ErpModule[],
): Promise<{ structured: ERPContextBlock; formatted: string }> {
  const structured: ERPContextBlock = {}
  const lines: string[] = []

  const tasks: Promise<void>[] = []

  if (modules.includes('inventory')) {
    tasks.push(
      (async () => {
        const agent = new InventoryAgent(tenantId)
        const [lowStock, pendingPOs] = await Promise.all([
          agent.getLowStockItems(),
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
        const balances = await prisma.stockBalance.findMany({
          where: { tenantId },
          select: { quantityOnHand: true, product: { select: { costPrice: true } } },
          take: 500,
        })
        const totalValue = balances.reduce(
          (s, b) => s + toNumber(b.quantityOnHand) * toNumber(b.product.costPrice),
          0,
        )
        structured.inventory = {
          lowStockCount: lowStock.count,
          totalValue: Math.round(totalValue * 100) / 100,
          pendingPOs,
        }
        lines.push(
          `INVENTORY: ${lowStock.count} SKUs below reorder point; inventory value ~$${structured.inventory.totalValue.toLocaleString()}; ${pendingPOs} open purchase order(s).`,
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
        const [ar, overdueCount] = await Promise.all([
          finance.getOutstandingAR(),
          prisma.invoice.count({
            where: {
              tenantId,
              status: InvoiceStatus.OVERDUE,
              amountDue: { gt: 0 },
            },
          }),
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
          outstandingAR: ar.totalOutstanding,
          overdueInvoices: overdueCount,
          cashBalance: Math.round(cashBalance * 100) / 100,
        }
        lines.push(
          `FINANCE: AR outstanding $${ar.totalOutstanding.toLocaleString()}; ${overdueCount} overdue invoice(s); cash balance $${cashBalance.toLocaleString()}.`,
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

  return {
    structured,
    formatted: lines.length ? lines.join('\n') : 'No module-specific live data loaded for this query.',
  }
}

/** Format live ERP context for the system prompt. */
export async function fetchErpLiveContext(tenantId: string, modules: ErpModule[]): Promise<string> {
  const { structured, formatted } = await buildERPContext(tenantId, modules)
  return `${formatted}\n\nStructured snapshot:\n${JSON.stringify(structured, null, 2)}`
}

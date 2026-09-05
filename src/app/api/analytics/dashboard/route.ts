import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getMasterDashboardData } from '@/lib/analytics/masterDashboardService'
import { noStoreHeaders } from '@/lib/http/cacheHeaders'
import { getEffectivePermissions } from '@/lib/auth/rbac'
import { PERMISSIONS, type Permission } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

function redactDashboardForPermissions(
  data: Awaited<ReturnType<typeof getMasterDashboardData>>,
  permissions: Permission[],
) {
  const has = (p: Permission) =>
    (permissions as string[]).includes('*') || permissions.includes(p)

  const canSales = has(PERMISSIONS.SALES_VIEW)
  const canFinance = has(PERMISSIONS.FINANCE_VIEW)
  const canInventory = has(PERMISSIONS.INVENTORY_VIEW)
  const canCrm = has(PERMISSIONS.CRM_VIEW)
  const canAgents = has(PERMISSIONS.AGENTS_USE)

  return {
    ...data,
    kpis: {
      revenueToday: canSales || canFinance ? data.kpis.revenueToday : 0,
      activeOrders: canSales ? data.kpis.activeOrders : 0,
      pipelineValue: canCrm || canSales ? data.kpis.pipelineValue : 0,
      lowStockItems: canInventory ? data.kpis.lowStockItems : 0,
      arOutstanding: canFinance ? data.kpis.arOutstanding : 0,
      aiCallsToday: canAgents ? data.kpis.aiCallsToday : 0,
      aiCallsLimit: data.kpis.aiCallsLimit,
    },
    kpiSparklines: data.kpiSparklines
      ? {
          revenueToday:
            canSales || canFinance ? data.kpiSparklines.revenueToday : [],
          activeOrders: canSales ? data.kpiSparklines.activeOrders : [],
          pipelineValue: canCrm || canSales ? data.kpiSparklines.pipelineValue : [],
          lowStockItems: canInventory ? data.kpiSparklines.lowStockItems : [],
          arOutstanding: canFinance ? data.kpiSparklines.arOutstanding : [],
          aiCallsToday: canAgents ? data.kpiSparklines.aiCallsToday : [],
        }
      : data.kpiSparklines,
    revenueChart14d: canSales || canFinance ? data.revenueChart14d : [],
    pipelineByStage: canCrm || canSales ? data.pipelineByStage : [],
    overdueInvoices: canFinance ? data.overdueInvoices : [],
    reorderAlerts: canInventory ? data.reorderAlerts : [],
    overdueFollowUps: canCrm ? data.overdueFollowUps : [],
    recentTransactions: canSales ? data.recentTransactions : [],
    visibility: {
      revenue: canSales || canFinance,
      orders: canSales,
      pipeline: canCrm || canSales,
      inventory: canInventory,
      finance: canFinance,
      agents: canAgents,
      crm: canCrm,
    },
  }
}

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const data = await getMasterDashboardData(auth.tenantId, auth.userId)
    const permissions = await getEffectivePermissions(auth.userId, auth.tenantId)
    const redacted = redactDashboardForPermissions(data, permissions)
    // Live KPIs/charts — never serve a stale empty revenue window after seed refresh.
    return NextResponse.json(apiSuccess(redacted), { headers: noStoreHeaders() })
  } catch (err) {
    return handleRouteError(err)
  }
})

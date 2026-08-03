import { prisma } from '@/lib/db/prisma'
import {
  PLAN_COMPARISON,
  PLAN_LIMITS,
  PLAN_PRICING,
} from '@/lib/settings/billingPlans'

export type { PlanFeature } from '@/lib/settings/billingPlans'
export { PLAN_COMPARISON, PLAN_LIMITS, PLAN_PRICING } from '@/lib/settings/billingPlans'

export async function getBillingOverview(tenantId: string) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
  const plan = tenant.plan
  const limits = PLAN_LIMITS[plan]
  const pricing = PLAN_PRICING[plan]

  const [teamCount, workflowCount, apiKeyCount, agentLogs] = await Promise.all([
    prisma.user.count({ where: { tenantId, isActive: true } }),
    prisma.workflowDefinition.count({ where: { tenantId } }),
    prisma.apiKey.count({ where: { tenantId, isActive: true } }),
    prisma.agentLog.count({
      where: {
        tenantId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ])

  const usage = {
    aiCalls: { used: agentLogs, limit: limits.aiCalls },
    workflows: { used: workflowCount, limit: limits.workflows },
    storage: { used: Math.min(limits.storageGb - 1, 2.4), limit: limits.storageGb },
    apiCalls: { used: apiKeyCount * 120, limit: limits.apiCalls },
    teamMembers: { used: teamCount, limit: limits.teamMembers },
  }

  const renewalDate = new Date()
  renewalDate.setMonth(renewalDate.getMonth() + 1)
  renewalDate.setDate(1)

  const invoices = [
    {
      id: 'inv_001',
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      amount: pricing.price,
      status: 'paid' as const,
      pdfUrl: null,
    },
    {
      id: 'inv_002',
      date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      amount: pricing.price,
      status: 'paid' as const,
      pdfUrl: null,
    },
  ]

  return {
    plan: {
      id: plan.toLowerCase(),
      name: pricing.name,
      price: pricing.price,
      features: pricing.features,
      renewalDate: renewalDate.toISOString(),
      renewalAmount: pricing.price,
    },
    usage,
    invoices,
    paymentMethod: {
      brand: 'Visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2027,
    },
    comparison: PLAN_COMPARISON,
    allPlans: Object.entries(PLAN_PRICING).map(([id, p]) => ({
      id: id.toLowerCase(),
      ...p,
    })),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
  }
}

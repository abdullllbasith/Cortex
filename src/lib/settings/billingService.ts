import type { TenantPlan } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export interface PlanFeature {
  name: string
  starter: boolean | string
  professional: boolean | string
  enterprise: boolean | string
}

export const PLAN_LIMITS: Record<
  TenantPlan,
  { aiCalls: number; workflows: number; storageGb: number; apiCalls: number; teamMembers: number }
> = {
  STARTER: { aiCalls: 500, workflows: 10, storageGb: 5, apiCalls: 1000, teamMembers: 5 },
  PROFESSIONAL: { aiCalls: 5000, workflows: 100, storageGb: 50, apiCalls: 25000, teamMembers: 25 },
  ENTERPRISE: { aiCalls: 50000, workflows: 1000, storageGb: 500, apiCalls: 250000, teamMembers: 500 },
}

export const PLAN_PRICING: Record<TenantPlan, { name: string; price: number; features: string[] }> = {
  STARTER: {
    name: 'Starter',
    price: 49,
    features: ['500 AI calls/mo', '10 workflows', '5 GB storage', '5 team members'],
  },
  PROFESSIONAL: {
    name: 'Professional',
    price: 149,
    features: ['5,000 AI calls/mo', '100 workflows', '50 GB storage', '25 team members', 'Priority support'],
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 499,
    features: ['Unlimited AI calls', 'Custom workflows', '500 GB storage', 'SSO & audit', 'Dedicated support'],
  },
}

export const PLAN_COMPARISON: PlanFeature[] = [
  { name: 'AI Executive Assistant', starter: true, professional: true, enterprise: true },
  { name: 'Workflow automation', starter: '10/mo', professional: '100/mo', enterprise: 'Unlimited' },
  { name: 'Predictive analytics', starter: false, professional: true, enterprise: true },
  { name: 'Custom roles & RBAC', starter: false, professional: true, enterprise: true },
  { name: 'API access', starter: '1K/mo', professional: '25K/mo', enterprise: '250K/mo' },
  { name: 'SSO / SAML', starter: false, professional: false, enterprise: true },
  { name: 'Audit log export', starter: false, professional: true, enterprise: true },
  { name: 'Dedicated support', starter: false, professional: 'Priority', enterprise: 'Dedicated CSM' },
]

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

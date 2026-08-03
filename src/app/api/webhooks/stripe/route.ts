import { TenantPlan } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { notificationService } from '@/lib/notifications/notificationService'
import { renderNotificationTemplate } from '@/lib/notifications/notificationTemplates'

export const runtime = 'nodejs'

interface StripeEvent {
  type: string
  data: { object: Record<string, unknown> }
}

function resolveTenantId(obj: Record<string, unknown>): string | null {
  const metadata = obj.metadata as { tenantId?: string } | undefined
  return metadata?.tenantId ?? (obj.client_reference_id as string | undefined) ?? null
}

function mapStripePlan(metadata: Record<string, unknown> | undefined): TenantPlan | null {
  const plan = metadata?.plan ?? metadata?.planId ?? metadata?.tier
  if (typeof plan !== 'string') return null
  const normalized = plan.toUpperCase()
  if (normalized === 'STARTER') return TenantPlan.STARTER
  if (normalized === 'PRO' || normalized === 'PROFESSIONAL') return TenantPlan.PROFESSIONAL
  if (normalized === 'ENTERPRISE') return TenantPlan.ENTERPRISE
  return null
}

export async function POST(request: Request) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) {
      return NextResponse.json(
        { success: false, error: { message: 'Stripe webhook not configured' } },
        { status: 503 },
      )
    }

    const token = request.headers.get('x-stripe-webhook-token')
    if (token !== secret) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 })
    }

    let event: StripeEvent
    try {
      event = (await request.json()) as StripeEvent
    } catch {
      return NextResponse.json({ success: false, error: { message: 'Invalid payload' } }, { status: 400 })
    }

    const obj = event.data.object
    const tenantId = resolveTenantId(obj)

    switch (event.type) {
      case 'checkout.session.completed': {
        if (!tenantId) break
        const sessionMeta = obj.metadata as Record<string, unknown> | undefined
        const plan = mapStripePlan(sessionMeta)
        if (plan) {
          await prisma.tenant.update({
            where: { id: tenantId },
            data: { plan },
          })
        }
        break
      }
      case 'invoice.payment_succeeded': {
        if (!tenantId) break
        const amount = ((obj.amount_paid as number) ?? 0) / 100
        const customerName = (obj.customer_name as string) ?? 'Customer'
        const rendered = renderNotificationTemplate('PAYMENT_RECEIVED', {
          amount: `$${amount.toFixed(2)}`,
          customerName,
        })
        await notificationService.send({
          tenantId,
          roleTarget: 'OWNER',
          title: rendered.title,
          body: rendered.body,
          type: rendered.type,
          severity: rendered.severity,
          actionUrl: rendered.actionUrl,
          actionLabel: rendered.actionLabel,
          entityId: String(obj.id ?? event.type),
        })
        break
      }
      case 'customer.subscription.updated':
      case 'invoice.upcoming': {
        if (!tenantId) break
        const subMeta = obj.metadata as Record<string, unknown> | undefined
        const plan = mapStripePlan(subMeta)
        if (plan && event.type === 'customer.subscription.updated') {
          await prisma.tenant.update({
            where: { id: tenantId },
            data: { plan },
          })
        }
        const lines = obj.lines as { data?: Array<{ plan?: { nickname?: string } }> } | undefined
        const planLabel = lines?.data?.[0]?.plan?.nickname ?? plan ?? 'Pro'
        const amount = ((obj.amount_due as number) ?? (obj.total as number) ?? 0) / 100
        const date = obj.period_end
          ? new Date(Number(obj.period_end) * 1000).toLocaleDateString()
          : 'soon'
        const rendered = renderNotificationTemplate('BILLING_RENEWAL', {
          plan: planLabel,
          date,
          amount: `$${amount.toFixed(2)}`,
        })
        await notificationService.send({
          tenantId,
          roleTarget: ['OWNER', 'FINANCE_OFFICER'],
          title: rendered.title,
          body: rendered.body,
          type: rendered.type,
          severity: rendered.severity,
          actionUrl: rendered.actionUrl,
          actionLabel: rendered.actionLabel,
          entityId: String(obj.id ?? event.type),
        })
        break
      }
      default:
        break
    }

    return NextResponse.json({ success: true, received: true })
  } catch (err) {
    console.error('[webhooks/stripe]', err)
    return NextResponse.json(
      { success: false, error: { message: 'Webhook processing failed' } },
      { status: 500 },
    )
  }
}

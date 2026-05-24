import { NextResponse } from 'next/server'
import { notificationService } from '@/lib/notifications/notificationService'
import { renderNotificationTemplate } from '@/lib/notifications/notificationTemplates'

export const runtime = 'nodejs'

interface StripeEvent {
  type: string
  data: { object: Record<string, unknown> }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Stripe webhook not configured' }, { status: 503 })
  }

  const token = request.headers.get('x-stripe-webhook-token')
  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let event: StripeEvent
  try {
    event = (await request.json()) as StripeEvent
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const obj = event.data.object
  const tenantId =
    (obj.metadata as { tenantId?: string } | undefined)?.tenantId ??
    (obj.client_reference_id as string | undefined)

  if (!tenantId) {
    return NextResponse.json({ received: true })
  }

  switch (event.type) {
    case 'invoice.payment_succeeded': {
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
      const lines = obj.lines as { data?: Array<{ plan?: { nickname?: string } }> } | undefined
      const plan = lines?.data?.[0]?.plan?.nickname ?? 'Pro'
      const amount = ((obj.amount_due as number) ?? (obj.total as number) ?? 0) / 100
      const date = obj.period_end
        ? new Date(Number(obj.period_end) * 1000).toLocaleDateString()
        : 'soon'
      const rendered = renderNotificationTemplate('BILLING_RENEWAL', {
        plan,
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

  return NextResponse.json({ received: true })
}

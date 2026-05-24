import { AlertSeverity, AlertType, NotificationSeverity } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { notificationService } from '@/lib/notifications/notificationService'
import { renderNotificationTemplate } from '@/lib/notifications/notificationTemplates'
import type {
  CustomerChurnPrediction,
  InventoryForecastItem,
  SalesForecastResult,
  SupplierRiskPrediction,
} from './types'
import { addDays, startOfDay } from './utils'
import { sendMail, isEmailConfigured } from '@/lib/email/mailTransport'

const DEDUP_HOURS = 24

function mapAlertSeverity(severity: AlertSeverity): NotificationSeverity {
  switch (severity) {
    case AlertSeverity.CRITICAL:
      return NotificationSeverity.CRITICAL
    case AlertSeverity.HIGH:
      return NotificationSeverity.ERROR
    case AlertSeverity.MEDIUM:
      return NotificationSeverity.WARNING
    default:
      return NotificationSeverity.INFO
  }
}

async function dispatchModule09Notification(params: {
  tenantId: string
  title: string
  message: string
  severity: AlertSeverity
  relatedEntityId?: string
  actionUrl?: string
}): Promise<void> {
  const isPrediction =
    params.title.toLowerCase().includes('churn') ||
    params.title.toLowerCase().includes('revenue') ||
    params.title.toLowerCase().includes('predict')

  if (isPrediction) {
    const rendered = renderNotificationTemplate('PREDICTION_ALERT', {
      metric: params.title.replace(/.*?:\s*/, '').slice(0, 40) || 'Metric',
      direction: params.message.toLowerCase().includes('drop') ? 'decrease' : 'change',
      percent: '20',
      period: 'week',
    })
    await notificationService.send({
      tenantId: params.tenantId,
      roleTarget: ['OWNER', 'CEO', 'MANAGER'],
      title: rendered.title,
      body: params.message,
      type: rendered.type,
      severity: mapAlertSeverity(params.severity),
      actionUrl: params.actionUrl ?? rendered.actionUrl,
      actionLabel: rendered.actionLabel,
      entityId: params.relatedEntityId,
    })
    return
  }

  await notificationService.send({
    tenantId: params.tenantId,
    roleTarget: ['OWNER', 'CEO', 'MANAGER'],
    title: params.title,
    body: params.message,
    type: 'ALERT',
    severity: mapAlertSeverity(params.severity),
    actionUrl: params.actionUrl ?? '/alerts',
    actionLabel: 'View alert',
    entityId: params.relatedEntityId,
  })
}

export interface AlertRuleConfig {
  ruleType: string
  name: string
  threshold: number
  severity: AlertSeverity
  enabled?: boolean
}

export const DEFAULT_ALERT_RULES: AlertRuleConfig[] = [
  { ruleType: 'stockout_days', name: 'Stock-out within 7 days', threshold: 7, severity: AlertSeverity.CRITICAL },
  { ruleType: 'revenue_drop_pct', name: 'Revenue forecast drop > 20%', threshold: 0.2, severity: AlertSeverity.HIGH },
  { ruleType: 'churn_threshold', name: 'Top customer churn risk', threshold: 0.8, severity: AlertSeverity.HIGH },
  { ruleType: 'supplier_delay_prob', name: 'Supplier delay probability', threshold: 0.6, severity: AlertSeverity.MEDIUM },
]

async function ensureDefaultRules(tenantId: string) {
  for (const rule of DEFAULT_ALERT_RULES) {
    await prisma.alertRule.upsert({
      where: { tenantId_ruleType: { tenantId, ruleType: rule.ruleType } },
      create: {
        tenantId,
        name: rule.name,
        ruleType: rule.ruleType,
        threshold: rule.threshold,
        severity: rule.severity,
        enabled: true,
      },
      update: {},
    })
  }
}

async function hasRecentAlert(
  tenantId: string,
  type: AlertType,
  relatedEntityId: string | null,
): Promise<boolean> {
  const since = addDays(new Date(), -DEDUP_HOURS / 24)
  const existing = await prisma.alert.findFirst({
    where: {
      tenantId,
      type,
      relatedEntityId: relatedEntityId ?? undefined,
      createdAt: { gte: since },
    },
  })
  return Boolean(existing)
}

async function createAlert(params: {
  tenantId: string
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  relatedEntityId?: string
  relatedEntityType?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const dup = await hasRecentAlert(params.tenantId, params.type, params.relatedEntityId ?? null)
  if (dup) return

  const alert = await prisma.alert.create({
    data: {
      tenantId: params.tenantId,
      type: params.type,
      severity: params.severity,
      title: params.title,
      message: params.message,
      relatedEntityId: params.relatedEntityId,
      relatedEntityType: params.relatedEntityType,
      expiresAt: addDays(new Date(), 7),
      metadata: (params.metadata ?? {}) as never,
    },
  })

  await sendAlertNotifications(params.tenantId, alert.title, alert.message, params.severity)

  await dispatchModule09Notification({
    tenantId: params.tenantId,
    title: params.title,
    message: params.message,
    severity: params.severity,
    relatedEntityId: params.relatedEntityId,
    actionUrl: params.relatedEntityType === 'product' ? '/knowledge/products' : '/predictions',
  }).catch(() => {})
}

async function sendAlertNotifications(
  tenantId: string,
  title: string,
  message: string,
  severity: AlertSeverity,
): Promise<void> {
  const connections = await prisma.channelConnection.findMany({
    where: { tenantId, enabled: true },
  })

  const text = `[${severity}] ${title}\n${message}`

  for (const conn of connections) {
    try {
      if (conn.channel === 'slack' && process.env.SLACK_BOT_TOKEN) {
        const config = conn.config as { channel?: string }
        await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: config.channel ?? '#alerts',
            text,
          }),
        })
      }

      if (conn.channel === 'email' && isEmailConfigured()) {
        const config = conn.config as { to?: string }
        const to = config.to ?? process.env.ALERT_EMAIL_TO
        if (to) {
          await sendMail({
            to,
            subject: title,
            text: message,
            fromName: 'SAIOS Alerts',
          })
        }
      }

      if (conn.channel === 'whatsapp' && process.env.WHATSAPP_ACCESS_TOKEN) {
        const config = conn.config as { to?: string }
        const to = config.to
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
        if (to && phoneNumberId) {
          await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to,
              type: 'text',
              text: { body: text.slice(0, 4096) },
            }),
          })
        }
      }
    } catch (err) {
      console.warn(`[alertEngine] Failed to notify via ${conn.channel}`, err)
    }
  }
}

export async function evaluatePredictionsAndAlert(
  tenantId: string,
  data: {
    sales: SalesForecastResult
    inventory: InventoryForecastItem[]
    customers: CustomerChurnPrediction[]
    suppliers: SupplierRiskPrediction[]
  },
): Promise<number> {
  await ensureDefaultRules(tenantId)
  const rules = await prisma.alertRule.findMany({ where: { tenantId, enabled: true } })
  const ruleMap = new Map(rules.map((r) => [r.ruleType, r]))
  let created = 0

  const stockoutRule = ruleMap.get('stockout_days')
  if (stockoutRule) {
    for (const item of data.inventory) {
      if (item.urgencyLevel !== 'critical') continue
      const daysLeft = item.predictedStockOutDate
        ? Math.ceil((new Date(item.predictedStockOutDate).getTime() - startOfDay(new Date()).getTime()) / 86400000)
        : 999
      if (daysLeft <= stockoutRule.threshold) {
        await createAlert({
          tenantId,
          type: AlertType.STOCKOUT,
          severity: stockoutRule.severity,
          title: `Critical stock-out: ${item.productName}`,
          message: `${item.productName} predicted to stock out on ${item.predictedStockOutDate}. Reorder ${item.reorderQuantity} units by ${item.recommendedOrderDate}.`,
          relatedEntityId: item.productId,
          relatedEntityType: 'product',
          metadata: { item },
        })
        created++
      }
    }
  }

  const revenueRule = ruleMap.get('revenue_drop_pct')
  if (revenueRule && data.sales.dailyForecast.length >= 14) {
    const next7 = data.sales.dailyForecast.slice(0, 7).reduce((s, p) => s + p.predictedRevenue, 0)
    const prev7 = data.sales.dailyForecast.slice(7, 14).reduce((s, p) => s + p.predictedRevenue, 0)
    if (prev7 > 0) {
      const drop = (prev7 - next7) / prev7
      if (drop >= revenueRule.threshold) {
        await createAlert({
          tenantId,
          type: AlertType.REVENUE_DROP,
          severity: revenueRule.severity,
          title: 'Revenue forecast decline detected',
          message: `Forecast revenue expected to drop ${Math.round(drop * 100)}% over the next 7 days vs prior week. Trend: ${data.sales.trendDirection}.`,
          relatedEntityId: 'tenant',
          relatedEntityType: 'sales',
          metadata: { drop, trend: data.sales.trendDirection },
        })
        created++
      }
    }
  }

  const churnRule = ruleMap.get('churn_threshold')
  if (churnRule) {
    const topCustomers = [...data.customers]
      .sort((a, b) => (b.monetary90d ?? b.ltvAtRisk) - (a.monetary90d ?? a.ltvAtRisk))
      .slice(0, 20)
      .filter((c) => c.churnProbability >= churnRule.threshold)

    for (const c of topCustomers) {
      await createAlert({
        tenantId,
        type: AlertType.CUSTOMER_CHURN,
        severity: churnRule.severity,
        title: `High churn risk: ${c.customerName}`,
        message: `${c.customerName} has ${Math.round(c.churnProbability * 100)}% churn probability. LTV at risk: $${c.ltvAtRisk.toLocaleString()}. Actions: ${c.retentionActions.join('; ')}`,
        relatedEntityId: c.customerId,
        relatedEntityType: 'customer',
        metadata: { churn: c },
      })
      created++
    }
  }

  const supplierRule = ruleMap.get('supplier_delay_prob')
  if (supplierRule) {
    for (const s of data.suppliers) {
      if (s.delayProbability < supplierRule.threshold) continue
      await createAlert({
        tenantId,
        type: AlertType.SUPPLIER_DELAY,
        severity: supplierRule.severity,
        title: `Supplier delay risk: ${s.supplierName}`,
        message: `${s.supplierName} has ${Math.round(s.delayProbability * 100)}% delay probability. Expected delay: ${s.expectedDelayDays} days. ${s.mitigationSuggestions.join('; ')}`,
        relatedEntityId: s.supplierId,
        relatedEntityType: 'supplier',
        metadata: { supplier: s },
      })
      created++
    }
  }

  return created
}

export async function listAlerts(
  tenantId: string,
  opts: { unreadOnly?: boolean; limit?: number } = {},
) {
  return prisma.alert.findMany({
    where: {
      tenantId,
      ...(opts.unreadOnly ? { isRead: false } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    take: opts.limit ?? 50,
  })
}

export async function markAlertRead(tenantId: string, alertId: string) {
  return prisma.alert.updateMany({
    where: { id: alertId, tenantId },
    data: { isRead: true },
  })
}

export async function markAllAlertsRead(tenantId: string) {
  return prisma.alert.updateMany({
    where: { tenantId, isRead: false },
    data: { isRead: true },
  })
}

export async function dismissAlerts(tenantId: string, alertIds: string[]) {
  return prisma.alert.updateMany({
    where: { tenantId, id: { in: alertIds } },
    data: { isRead: true, expiresAt: new Date() },
  })
}

export async function getAlertRules(tenantId: string) {
  await ensureDefaultRules(tenantId)
  return prisma.alertRule.findMany({ where: { tenantId }, orderBy: { ruleType: 'asc' } })
}

export async function upsertAlertRule(
  tenantId: string,
  data: {
    id?: string
    name: string
    ruleType: string
    threshold: number
    severity: AlertSeverity
    enabled?: boolean
    config?: Record<string, unknown>
  },
) {
  if (data.id) {
    return prisma.alertRule.update({
      where: { id: data.id },
      data: {
        name: data.name,
        threshold: data.threshold,
        severity: data.severity,
        enabled: data.enabled ?? true,
        config: (data.config ?? {}) as never,
      },
    })
  }

  return prisma.alertRule.upsert({
    where: { tenantId_ruleType: { tenantId, ruleType: data.ruleType } },
    create: {
      tenantId,
      name: data.name,
      ruleType: data.ruleType,
      threshold: data.threshold,
      severity: data.severity,
      enabled: data.enabled ?? true,
      config: (data.config ?? {}) as never,
    },
    update: {
      name: data.name,
      threshold: data.threshold,
      severity: data.severity,
      enabled: data.enabled ?? true,
      config: (data.config ?? {}) as never,
    },
  })
}

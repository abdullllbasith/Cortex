import type { NotificationSeverity, NotificationType } from '@prisma/client'

export interface NotificationTemplate {
  key: string
  titlePattern: string
  bodyPattern: string
  defaultSeverity: NotificationSeverity
  defaultType: NotificationType
  actionUrlPattern?: string
  actionLabel?: string
}

function render(pattern: string, vars: Record<string, string | number>): string {
  return pattern.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ''))
}

export const NOTIFICATION_TEMPLATES = {
  LOW_STOCK_ALERT: {
    key: 'LOW_STOCK_ALERT',
    titlePattern: 'Low stock: {{productName}}',
    bodyPattern: '{{productName}} has {{qty}} units remaining — reorder needed',
    defaultSeverity: 'WARNING',
    defaultType: 'ALERT',
    actionUrlPattern: '/knowledge/products',
    actionLabel: 'View products',
  },
  CHURN_RISK: {
    key: 'CHURN_RISK',
    titlePattern: 'Churn risk: {{customerName}}',
    bodyPattern: '{{customerName}} has a {{probability}}% churn risk this week',
    defaultSeverity: 'WARNING',
    defaultType: 'ALERT',
    actionUrlPattern: '/predictions',
    actionLabel: 'View predictions',
  },
  PAYMENT_RECEIVED: {
    key: 'PAYMENT_RECEIVED',
    titlePattern: 'Payment received',
    bodyPattern: 'Payment of {{amount}} received from {{customerName}}',
    defaultSeverity: 'INFO',
    defaultType: 'BILLING',
    actionUrlPattern: '/settings/billing',
    actionLabel: 'View billing',
  },
  WORKFLOW_FAILED: {
    key: 'WORKFLOW_FAILED',
    titlePattern: 'Workflow failed: {{workflowName}}',
    bodyPattern: "Workflow '{{workflowName}}' failed at step {{stepName}}",
    defaultSeverity: 'ERROR',
    defaultType: 'SYSTEM',
    actionUrlPattern: '/workflows/{{workflowId}}/executions',
    actionLabel: 'View execution',
  },
  SECURITY_LOGIN: {
    key: 'SECURITY_LOGIN',
    titlePattern: 'New login detected',
    bodyPattern: 'New login from {{location}} on {{device}}',
    defaultSeverity: 'INFO',
    defaultType: 'SECURITY',
    actionUrlPattern: '/settings/audit',
    actionLabel: 'Review audit log',
  },
  BILLING_RENEWAL: {
    key: 'BILLING_RENEWAL',
    titlePattern: 'Plan renewal upcoming',
    bodyPattern: 'Your {{plan}} plan renews on {{date}} for {{amount}}',
    defaultSeverity: 'INFO',
    defaultType: 'BILLING',
    actionUrlPattern: '/settings/billing',
    actionLabel: 'Manage billing',
  },
  PREDICTION_ALERT: {
    key: 'PREDICTION_ALERT',
    titlePattern: 'Prediction alert: {{metric}}',
    bodyPattern: '{{metric}} predicted to {{direction}} by {{percent}}% next {{period}}',
    defaultSeverity: 'WARNING',
    defaultType: 'ALERT',
    actionUrlPattern: '/predictions',
    actionLabel: 'View predictions',
  },
} as const satisfies Record<string, NotificationTemplate>

export type NotificationTemplateKey = keyof typeof NOTIFICATION_TEMPLATES

export function renderNotificationTemplate(
  key: NotificationTemplateKey,
  vars: Record<string, string | number>,
): {
  title: string
  body: string
  severity: NotificationSeverity
  type: NotificationType
  actionUrl?: string
  actionLabel?: string
} {
  const t = NOTIFICATION_TEMPLATES[key]
  return {
    title: render(t.titlePattern, vars),
    body: render(t.bodyPattern, vars),
    severity: t.defaultSeverity,
    type: t.defaultType,
    actionUrl: t.actionUrlPattern ? render(t.actionUrlPattern, vars) : undefined,
    actionLabel: t.actionLabel,
  }
}

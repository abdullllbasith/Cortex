import type { WorkflowDefinitionJSON } from '../types'
import orderToCash from './orderToCashWorkflow.json'
import procureToPay from './procureToPayWorkflow.json'
import procureToPayReceipt from './procureToPayReceiptWorkflow.json'
import leadToDeal from './leadToDealWorkflow.json'
import employeeOnboarding from './employeeOnboardingWorkflow.json'
import monthEnd from './monthEndWorkflow.json'
import autoReorder from './autoReorderWorkflow.json'
import orderFulfillment from './orderFulfillmentWorkflow.json'
import lowStockReorder from './lowStockReorderWorkflow.json'
import newLeadNurture from './newLeadNurtureWorkflow.json'
import invoiceReminder from './invoiceReminderWorkflow.json'
import monthlyReport from './monthlyReportWorkflow.json'
import churnRetention from './churnRetentionWorkflow.json'
import supplierReview from './supplierReviewWorkflow.json'
import crmLeadNurture from './crmLeadNurtureWorkflow.json'
import crmDealWonOnboarding from './crmDealWonOnboardingWorkflow.json'
import crmDealLostReengagement from './crmDealLostReengagementWorkflow.json'
import crmFollowUpDue from './crmFollowUpDueWorkflow.json'

export interface WorkflowTemplateMeta {
  id: string
  name: string
  category: string
  description: string
  definition: WorkflowDefinitionJSON
}

export const CROSS_MODULE_TEMPLATES: WorkflowTemplateMeta[] = [
  {
    id: 'order-to-cash',
    name: 'Order to Cash',
    category: 'Finance',
    description: 'ORDER_DELIVERED → inventory SALE → invoice → reminders → manager escalation',
    definition: orderToCash as WorkflowDefinitionJSON,
  },
  {
    id: 'procure-to-pay',
    name: 'Procure to Pay',
    category: 'Procurement',
    description: 'STOCK_BELOW_REORDER → AI auto-order decision → PO or manager alert',
    definition: procureToPay as WorkflowDefinitionJSON,
  },
  {
    id: 'procure-to-pay-receipt',
    name: 'Procure to Pay (Goods Received)',
    category: 'Procurement',
    description: 'GOODS_RECEIVED → bill → finance reminder → record payment',
    definition: procureToPayReceipt as WorkflowDefinitionJSON,
  },
  {
    id: 'lead-to-deal',
    name: 'Lead to Deal',
    category: 'CRM',
    description: 'NEW_CONTACT_CREATED (LEAD) → welcome → tasks → escalation → offer → re-engagement',
    definition: leadToDeal as WorkflowDefinitionJSON,
  },
  {
    id: 'employee-onboarding-v2',
    name: 'Employee Onboarding (Full)',
    category: 'HR',
    description: 'New hire → user account → leave allocations → welcome → checklist → manager task',
    definition: employeeOnboarding as WorkflowDefinitionJSON,
  },
  {
    id: 'month-end-close',
    name: 'Month-End Close',
    category: 'Finance',
    description: 'Cron 0 8 1 * * — P&L, AR aging, overdue batch, reorder report, executive digest email',
    definition: monthEnd as WorkflowDefinitionJSON,
  },
]

const LEGACY_TEMPLATES: WorkflowTemplateMeta[] = [
  { id: 'order-fulfillment', name: 'Order Fulfillment', category: 'Sales', description: 'Order → confirm → inventory → invoice → notify customer', definition: orderFulfillment as WorkflowDefinitionJSON },
  { id: 'low-stock-reorder', name: 'Low Stock Reorder', category: 'Inventory', description: 'Low stock event → PO → notify supplier & manager', definition: lowStockReorder as WorkflowDefinitionJSON },
  { id: 'auto-reorder', name: 'Auto Reorder', category: 'Inventory', description: 'Stock below reorder → generate suggestion → draft PO (if auto-approve) → notify manager', definition: autoReorder as WorkflowDefinitionJSON },
  { id: 'new-lead-nurture', name: 'New Lead Nurture', category: 'Sales', description: 'Welcome series with conditional sales assignment', definition: newLeadNurture as WorkflowDefinitionJSON },
  { id: 'invoice-reminder', name: 'Invoice Reminder', category: 'Finance', description: 'Daily overdue invoice reminders with escalation', definition: invoiceReminder as WorkflowDefinitionJSON },
  { id: 'monthly-report', name: 'Monthly Report', category: 'Analytics', description: 'Generate and distribute monthly executive report', definition: monthlyReport as WorkflowDefinitionJSON },
  { id: 'churn-retention', name: 'Churn Retention', category: 'Customer Success', description: 'High churn risk → retention offer → assign rep', definition: churnRetention as WorkflowDefinitionJSON },
  { id: 'supplier-review', name: 'Supplier Review', category: 'Procurement', description: 'Quarterly supplier performance review workflow', definition: supplierReview as WorkflowDefinitionJSON },
  { id: 'crm-lead-nurture', name: 'CRM Lead Nurture', category: 'CRM', description: 'New contact → welcome email → sales assignment', definition: crmLeadNurture as WorkflowDefinitionJSON },
  { id: 'crm-deal-won-onboarding', name: 'CRM Deal Won Onboarding', category: 'CRM', description: 'Celebrate win → kick off customer onboarding', definition: crmDealWonOnboarding as WorkflowDefinitionJSON },
  { id: 'crm-deal-lost-reengagement', name: 'CRM Deal Lost Re-engagement', category: 'CRM', description: 'Log loss → 90-day delay → re-engagement outreach', definition: crmDealLostReengagement as WorkflowDefinitionJSON },
  { id: 'crm-follow-up-due', name: 'CRM Follow-up Reminder', category: 'CRM', description: 'Notify deal owner when contact follow-up is overdue', definition: crmFollowUpDue as WorkflowDefinitionJSON },
]

const TEMPLATES: WorkflowTemplateMeta[] = [...CROSS_MODULE_TEMPLATES, ...LEGACY_TEMPLATES]

export function listTemplates(): WorkflowTemplateMeta[] {
  return TEMPLATES
}

export function getTemplateById(id: string): WorkflowDefinitionJSON | undefined {
  return TEMPLATES.find((t) => t.id === id)?.definition
}

export function getCrossModuleTemplates(): WorkflowTemplateMeta[] {
  return CROSS_MODULE_TEMPLATES
}

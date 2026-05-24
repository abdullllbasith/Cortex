import type { WorkflowDefinitionJSON } from '../types'
import orderFulfillment from './orderFulfillmentWorkflow.json'
import lowStockReorder from './lowStockReorderWorkflow.json'
import newLeadNurture from './newLeadNurtureWorkflow.json'
import invoiceReminder from './invoiceReminderWorkflow.json'
import employeeOnboarding from './employeeOnboardingWorkflow.json'
import monthlyReport from './monthlyReportWorkflow.json'
import churnRetention from './churnRetentionWorkflow.json'
import supplierReview from './supplierReviewWorkflow.json'

export interface WorkflowTemplateMeta {
  id: string
  name: string
  category: string
  description: string
  definition: WorkflowDefinitionJSON
}

const TEMPLATES: WorkflowTemplateMeta[] = [
  { id: 'order-fulfillment', name: 'Order Fulfillment', category: 'Sales', description: 'Order → confirm → inventory → invoice → notify customer', definition: orderFulfillment as WorkflowDefinitionJSON },
  { id: 'low-stock-reorder', name: 'Low Stock Reorder', category: 'Inventory', description: 'Low stock event → PO → notify supplier & manager', definition: lowStockReorder as WorkflowDefinitionJSON },
  { id: 'new-lead-nurture', name: 'New Lead Nurture', category: 'Sales', description: 'Welcome series with conditional sales assignment', definition: newLeadNurture as WorkflowDefinitionJSON },
  { id: 'invoice-reminder', name: 'Invoice Reminder', category: 'Finance', description: 'Daily overdue invoice reminders with escalation', definition: invoiceReminder as WorkflowDefinitionJSON },
  { id: 'employee-onboarding', name: 'Employee Onboarding', category: 'HR', description: 'Automated onboarding checklist and notifications', definition: employeeOnboarding as WorkflowDefinitionJSON },
  { id: 'monthly-report', name: 'Monthly Report', category: 'Analytics', description: 'Generate and distribute monthly executive report', definition: monthlyReport as WorkflowDefinitionJSON },
  { id: 'churn-retention', name: 'Churn Retention', category: 'Customer Success', description: 'High churn risk → retention offer → assign rep', definition: churnRetention as WorkflowDefinitionJSON },
  { id: 'supplier-review', name: 'Supplier Review', category: 'Procurement', description: 'Quarterly supplier performance review workflow', definition: supplierReview as WorkflowDefinitionJSON },
]

export function listTemplates(): WorkflowTemplateMeta[] {
  return TEMPLATES
}

export function getTemplateById(id: string): WorkflowDefinitionJSON | undefined {
  return TEMPLATES.find((t) => t.id === id)?.definition
}

import { NodeRegistry } from '../core/NodeRegistry'
import { scheduleTriggerHandler } from './trigger/ScheduleNode'
import { eventTriggerHandler } from './trigger/EventNode'
import { webhookTriggerHandler, manualTriggerHandler } from './trigger/WebhookNode'
import { sendNotificationHandler } from './action/SendNotificationNode'
import { updateRecordHandler } from './action/UpdateRecordNode'
import { generateDocumentHandler } from './action/GenerateDocumentNode'
import { aiDecisionHandler } from './action/AIDecisionNode'
import { generateReorderSuggestionHandler } from './action/GenerateReorderSuggestionNode'
import { createDraftPOHandler } from './action/CreateDraftPONode'
import { createInvoiceHandler } from './action/CreateInvoiceNode'
import { recordPaymentHandler } from './action/RecordPaymentNode'
import { createPurchaseOrderHandler } from './action/CreatePurchaseOrderNode'
import { updateInventoryHandler } from './action/UpdateInventoryNode'
import { runPayrollHandler } from './action/RunPayrollNode'
import { updateOrderStatusHandler } from './action/UpdateOrderStatusNode'
import { generateMonthlyReportHandler } from './action/GenerateMonthlyReportNode'
import { setupEmployeeHandler } from './action/SetupEmployeeNode'
import { createBillHandler } from './action/CreateBillNode'
import { processOrderDeliveryHandler } from './action/ProcessOrderDeliveryNode'
import { checkInvoicePaymentHandler } from './action/CheckInvoicePaymentNode'
import { crmLeadWorkflowHandler } from './action/CrmLeadWorkflowNode'
import { generateExecutiveDigestHandler } from './action/GenerateExecutiveDigestNode'
import { conditionHandler } from './control/ConditionNode'
import { delayHandler } from './control/DelayNode'
import { loopHandler } from './control/LoopNode'
import { httpRequestHandler } from './integration/HttpRequestNode'

let registered = false

export function registerAllNodes(): void {
  if (registered) return
  registered = true

  NodeRegistry.register('trigger.schedule', scheduleTriggerHandler)
  NodeRegistry.register('trigger.event', eventTriggerHandler)
  NodeRegistry.register('trigger.webhook', webhookTriggerHandler)
  NodeRegistry.register('trigger.manual', manualTriggerHandler)

  NodeRegistry.register('action.send_notification', sendNotificationHandler)
  NodeRegistry.register('action.update_record', updateRecordHandler)
  NodeRegistry.register('action.generate_document', generateDocumentHandler)
  NodeRegistry.register('action.ai_decision', aiDecisionHandler)
  NodeRegistry.register('action.generate_reorder_suggestion', generateReorderSuggestionHandler)
  NodeRegistry.register('action.create_draft_po', createDraftPOHandler)
  NodeRegistry.register('action.create_invoice', createInvoiceHandler)
  NodeRegistry.register('action.record_payment', recordPaymentHandler)
  NodeRegistry.register('action.create_purchase_order', createPurchaseOrderHandler)
  NodeRegistry.register('action.update_inventory', updateInventoryHandler)
  NodeRegistry.register('action.run_payroll', runPayrollHandler)
  NodeRegistry.register('action.update_order_status', updateOrderStatusHandler)
  NodeRegistry.register('action.generate_monthly_report', generateMonthlyReportHandler)
  NodeRegistry.register('action.setup_employee', setupEmployeeHandler)
  NodeRegistry.register('action.create_bill', createBillHandler)
  NodeRegistry.register('action.process_order_delivery', processOrderDeliveryHandler)
  NodeRegistry.register('action.check_invoice_payment', checkInvoicePaymentHandler)
  NodeRegistry.register('action.crm_lead_workflow', crmLeadWorkflowHandler)
  NodeRegistry.register('action.generate_executive_digest', generateExecutiveDigestHandler)

  NodeRegistry.register('control.condition', conditionHandler)
  NodeRegistry.register('control.delay', delayHandler)
  NodeRegistry.register('control.loop', loopHandler)

  NodeRegistry.register('integration.http_request', httpRequestHandler)
}

registerAllNodes()

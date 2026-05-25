/** Default config applied when a node is added from the palette. */
export function defaultNodeConfig(nodeType: string): Record<string, unknown> {
  switch (nodeType) {
    case 'action.send_notification':
      return {
        channel: 'email',
        recipient: '{{customer.email}}',
        message: 'Hello {{customer.name}}',
      }
    case 'trigger.event':
      return { eventType: 'new_customer' }
    case 'trigger.schedule':
      return { cronExpression: '0 9 * * *' }
    case 'control.delay':
      return { duration: 1, unit: 'minutes' }
    case 'control.condition':
      return {
        conditions: [{ field: 'customer.purchaseCount', operator: 'eq', value: 0 }],
        logic: 'AND',
      }
    case 'action.update_record':
      return { entity: 'customer', entityId: '{{customer.id}}' }
    case 'action.generate_document':
      return { documentType: 'invoice' }
    case 'action.ai_decision':
      return { prompt: 'Review this workflow context and suggest the next best action.' }
    case 'action.generate_reorder_suggestion':
      return { productIdField: 'productId', urgency: 'all' }
    case 'action.create_draft_po':
      return { respectAutoApprove: true, supplierIdField: 'reorderSuggestion.supplierId', suggestionsField: 'reorderSuggestions' }
    case 'action.create_invoice':
      return { source: 'order', orderIdField: 'orderId', sendAfterCreate: true }
    case 'action.record_payment':
      return { mode: 'record', targetType: 'invoice', invoiceIdField: 'invoiceId', amountField: 'amount' }
    case 'action.create_purchase_order':
      return { respectAutoApprove: true, autoApproveThreshold: 5000 }
    case 'action.update_inventory':
      return { mode: 'check_availability', orderIdField: 'orderId' }
    case 'action.run_payroll':
      return { onlyIfPayrollDate: true, payrollDayOfMonth: 25 }
    case 'action.update_order_status':
      return { orderIdField: 'orderId', paymentStatus: 'PAID' }
    case 'action.generate_monthly_report':
      return { includePnL: true, includeArAging: true, includeApAging: true }
    case 'action.setup_employee':
      return { employeeIdField: 'employeeId', createUserIfMissing: true, createLeaveAllocations: true }
    case 'action.create_bill':
      return { poIdField: 'poId' }
    case 'integration.http_request':
      return { url: '', method: 'GET' }
    default:
      return {}
  }
}

export function defaultNodeLabel(nodeType: string): string {
  const labels: Record<string, string> = {
    'trigger.event': 'Event',
    'trigger.schedule': 'Schedule',
    'trigger.manual': 'Manual Trigger',
    'trigger.webhook': 'Webhook',
    'action.send_notification': 'Send Notification',
    'action.update_record': 'Update Record',
    'action.generate_document': 'Generate Document',
    'action.ai_decision': 'AI Decision',
    'action.generate_reorder_suggestion': 'Generate Reorder Suggestion',
    'action.create_draft_po': 'Create Draft PO',
    'action.create_invoice': 'Create Invoice',
    'action.record_payment': 'Record Payment',
    'action.create_purchase_order': 'Create Purchase Order',
    'action.update_inventory': 'Update Inventory',
    'action.run_payroll': 'Run Payroll',
    'action.update_order_status': 'Update Order Status',
    'action.generate_monthly_report': 'Generate Monthly Report',
    'action.setup_employee': 'Setup Employee',
    'action.create_bill': 'Create Bill',
    'control.condition': 'Condition',
    'control.delay': 'Delay',
    'control.loop': 'Loop',
    'integration.http_request': 'HTTP Request',
  }
  return labels[nodeType] ?? nodeType.split('.').pop()?.replace(/_/g, ' ') ?? nodeType
}

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
    'control.condition': 'Condition',
    'control.delay': 'Delay',
    'control.loop': 'Loop',
    'integration.http_request': 'HTTP Request',
  }
  return labels[nodeType] ?? nodeType.split('.').pop()?.replace(/_/g, ' ') ?? nodeType
}
